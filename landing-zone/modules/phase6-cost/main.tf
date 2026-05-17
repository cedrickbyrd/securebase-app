# Phase 6 / Track 5 — Platform Scale & Cost Optimization
#
# Delivers:
# - DynamoDB table for per-tenant daily cost history (PAY_PER_REQUEST)
# - cost_per_tenant Lambda (CloudWatch metric emission + anomaly detection)
# - EventBridge daily aggregation rule (1 AM UTC)
# - CloudWatch alarm: fires when any tenant's projected monthly cost > $50
# - S3 bucket for monthly cost report exports
# - EventBridge monthly export rule (1st of each month, 2 AM UTC)
# - AWS Cost Allocation Tag activation (tenant_id, phase, environment)
#
# Usage:
#   module "phase6_cost" {
#     source                         = "../../modules/phase6-cost"
#     environment                    = var.environment
#     cost_per_tenant_lambda_zip     = "${path.module}/../../files/phase6/cost_per_tenant.zip"
#     alert_sns_arn                  = module.phase5_alerting.alert_sns_arn
#     monthly_cost_alert_threshold_usd = 50
#     tags                           = merge(var.tags, { Phase = "6", Track = "5" })
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  common_tags = merge(var.tags, {
    Phase     = "6"
    Track     = "5"
    Component = "cost-optimization"
    ManagedBy = "terraform"
  })

  # Prefer the explicitly provided table name; fall back to the convention used
  # by the phase5-admin-metrics module so both deployment paths work.
  cost_table_name = var.cost_per_tenant_table_name != "" ? var.cost_per_tenant_table_name : "securebase-${var.environment}-cost-per-tenant"
}

# ============================================================================
# DynamoDB Table — per-tenant daily cost history
# The table may already exist (created by phase5-admin-metrics).  When
# deploying phase6-cost standalone, this resource creates it; when both
# modules are active in the same workspace, set
#   var.cost_per_tenant_table_name = module.phase5_admin_metrics.cost_per_tenant_table_name
# so this resource is skipped and the existing table is referenced.
# ============================================================================

resource "aws_dynamodb_table" "cost_per_tenant" {
  count = var.cost_per_tenant_table_name == "" ? 1 : 0

  name         = local.cost_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "date"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name    = local.cost_table_name
    Purpose = "Daily tenant cost history and anomaly baseline"
  })
}

# ============================================================================
# S3 Bucket — monthly cost report exports
# ============================================================================

resource "aws_s3_bucket" "cost_reports" {
  bucket = "securebase-${var.environment}-cost-reports-${data.aws_caller_identity.current.account_id}"
  tags   = merge(local.common_tags, { Name = "securebase-${var.environment}-cost-reports" })
}

resource "aws_s3_bucket_versioning" "cost_reports" {
  bucket = aws_s3_bucket.cost_reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cost_reports" {
  bucket = aws_s3_bucket.cost_reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cost_reports" {
  bucket = aws_s3_bucket.cost_reports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "cost_reports" {
  bucket = aws_s3_bucket.cost_reports.id

  rule {
    id     = "intelligent-tiering-after-${var.cost_report_retention_days}d"
    status = "Enabled"

    transition {
      days          = var.cost_report_retention_days
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}

# ============================================================================
# IAM Role — cost_per_tenant Lambda execution
# ============================================================================

resource "aws_iam_role" "cost_per_tenant" {
  name = "securebase-${var.environment}-phase6-cost-per-tenant"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(local.common_tags, {
    Name = "securebase-${var.environment}-phase6-cost-per-tenant"
  })
}

resource "aws_iam_role_policy_attachment" "cost_basic_execution" {
  role       = aws_iam_role.cost_per_tenant.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "cost_billing_readonly" {
  role       = aws_iam_role.cost_per_tenant.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBillingReadOnlyAccess"
}

resource "aws_iam_role_policy" "cost_per_tenant_custom" {
  name = "securebase-${var.environment}-phase6-cost-per-tenant-custom"
  role = aws_iam_role.cost_per_tenant.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBCostHistory"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${local.cost_table_name}",
        ]
      },
      {
        Sid    = "SNSPublishAlerts"
        Effect = "Allow"
        Action = ["sns:Publish"]
        Resource = compact([
          var.alert_sns_arn,
          "arn:aws:sns:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:securebase-${var.environment}-*",
        ])
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData"]
        # Resource must be "*" — PutMetricData does not support resource-level
        # restrictions by ARN.  The Condition key narrows writes to the
        # SecureBase/CostPerTenant namespace only.
        Resource = "*"
        Condition = {
          StringEquals = { "cloudwatch:namespace" = "SecureBase/CostPerTenant" }
        }
      },
      {
        Sid    = "S3CostReports"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.cost_reports.arn,
          "${aws_s3_bucket.cost_reports.arn}/*",
        ]
      },
      {
        Sid    = "XRayTracing"
        Effect = "Allow"
        Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
        # X-Ray segment resources do not have ARNs; "*" is required by the AWS
        # IAM documentation for these actions.
        Resource = "*"
      },
    ]
  })
}

# ============================================================================
# Lambda — cost_per_tenant
# ============================================================================

resource "aws_lambda_function" "cost_per_tenant" {
  filename      = var.cost_per_tenant_lambda_zip
  function_name = "securebase-${var.environment}-cost-per-tenant"
  handler       = "cost_per_tenant.lambda_handler"
  runtime       = "python3.11"
  # Publish immutable versions for alias + provisioned-concurrency support.
  publish     = true
  timeout     = 120
  memory_size = 512
  role        = aws_iam_role.cost_per_tenant.arn

  source_code_hash = fileexists(var.cost_per_tenant_lambda_zip) ? filebase64sha256(var.cost_per_tenant_lambda_zip) : null

  environment {
    variables = {
      ENVIRONMENT                      = var.environment
      COST_PER_TENANT_TABLE            = local.cost_table_name
      ALERT_TOPIC_ARN                  = var.alert_sns_arn
      TENANT_TAG_KEY                   = "tenant_id"
      MONTHLY_COST_ALERT_THRESHOLD_USD = tostring(var.monthly_cost_alert_threshold_usd)
      COST_REPORT_BUCKET               = aws_s3_bucket.cost_reports.id
      LOG_LEVEL                        = "INFO"
    }
  }

  tags = merge(local.common_tags, {
    Name = "securebase-${var.environment}-cost-per-tenant"
  })
}

# ============================================================================
# EventBridge — daily cost aggregation (1 AM UTC)
# ============================================================================

resource "aws_cloudwatch_event_rule" "daily_aggregation" {
  name                = "securebase-${var.environment}-phase6-cost-daily"
  description         = "Phase 6 Track 5: daily cost-per-tenant aggregation at 01:00 UTC"
  schedule_expression = "cron(0 1 * * ? *)"

  tags = merge(local.common_tags, { Name = "securebase-${var.environment}-phase6-cost-daily" })
}

resource "aws_cloudwatch_event_target" "daily_aggregation" {
  rule      = aws_cloudwatch_event_rule.daily_aggregation.name
  target_id = "phase6-cost-per-tenant-lambda"
  arn       = aws_lambda_function.cost_per_tenant.arn
}

resource "aws_lambda_permission" "daily_aggregation_schedule" {
  statement_id  = "AllowEventBridgePhase6CostDaily"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_per_tenant.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_aggregation.arn
}

# ============================================================================
# EventBridge — monthly cost export to S3 (1st of each month, 2 AM UTC)
# ============================================================================

resource "aws_cloudwatch_event_rule" "monthly_export" {
  name                = "securebase-${var.environment}-phase6-cost-monthly-export"
  description         = "Phase 6 Track 5: export monthly cost report to S3 on the 1st of each month"
  schedule_expression = "cron(0 2 1 * ? *)"

  tags = merge(local.common_tags, { Name = "securebase-${var.environment}-phase6-cost-monthly-export" })
}

resource "aws_cloudwatch_event_target" "monthly_export" {
  rule      = aws_cloudwatch_event_rule.monthly_export.name
  target_id = "phase6-cost-monthly-export-lambda"
  arn       = aws_lambda_function.cost_per_tenant.arn

  input = jsonencode({ action = "monthly_export" })
}

resource "aws_lambda_permission" "monthly_export_schedule" {
  statement_id  = "AllowEventBridgePhase6CostMonthlyExport"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_per_tenant.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_export.arn
}

# ============================================================================
# CloudWatch Alarm — per-tenant monthly cost > threshold
#
# The Lambda emits SecureBase/CostPerTenant::MaxTenantEstimatedMonthlyCostUSD
# once per daily run.  This alarm fires when the maximum projected monthly
# spend across all tenants exceeds the configured threshold (default $50).
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "max_tenant_monthly_cost" {
  alarm_name          = "securebase-${var.environment}-max-tenant-monthly-cost"
  alarm_description   = "Alert when any tenant's estimated monthly AWS cost exceeds $${var.monthly_cost_alert_threshold_usd}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = "MaxTenantEstimatedMonthlyCostUSD"
  namespace           = "SecureBase/CostPerTenant"
  period              = 86400 # 1 day — matches the daily Lambda run
  statistic           = "Maximum"
  threshold           = var.monthly_cost_alert_threshold_usd
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = compact([var.alert_sns_arn])
  ok_actions    = compact([var.alert_sns_arn])

  tags = merge(local.common_tags, {
    Name = "securebase-${var.environment}-max-tenant-monthly-cost"
  })
}

# ============================================================================
# AWS Cost Allocation Tags — activate tenant_id, phase, environment
# Cost Allocation Tags enable Cost Explorer to filter and group by these tags,
# which is the foundation for per-tenant cost attribution reports.
# ============================================================================

resource "aws_ce_cost_allocation_tag" "tenant_id" {
  tag_key = "tenant_id"
  status  = "Active"
}

resource "aws_ce_cost_allocation_tag" "phase" {
  tag_key = "Phase"
  status  = "Active"
}

resource "aws_ce_cost_allocation_tag" "environment" {
  tag_key = "Environment"
  status  = "Active"
}
