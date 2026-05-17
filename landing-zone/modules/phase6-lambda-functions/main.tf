# Phase 6 Lambda Functions Module
# Deploys audit_evidence_api and compliance_history_api Lambdas
# wired to the evidence S3 bucket, KMS key, and DynamoDB scores table.

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

# ============================================================================
# IAM Role for phase6 Lambdas
# ============================================================================

resource "aws_iam_role" "phase6_lambda" {
  name = "securebase-${var.environment}-phase6-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(var.tags, { Phase = "6" })
}

resource "aws_iam_role_policy_attachment" "phase6_basic" {
  role       = aws_iam_role.phase6_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "phase6_permissions" {
  name = "securebase-${var.environment}-phase6-permissions"
  role = aws_iam_role.phase6_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3EvidenceBucket"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.evidence_bucket_name}",
          "arn:aws:s3:::${var.evidence_bucket_name}/*"
        ]
      },
      {
        Sid    = "KMSEvidence"
        Effect = "Allow"
        Action = ["kms:GenerateDataKey*", "kms:Decrypt", "kms:DescribeKey"]
        Resource = var.evidence_kms_key_arn
      },
      {
        Sid    = "DynamoDBScores"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:Query", "dynamodb:Scan"
        ]
        Resource = [
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/securebase-compliance-scores",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/control_violation_log",
        ]
      },
      {
        Sid    = "RDSProxy"
        Effect = "Allow"
        Action = ["rds-db:connect"]
        Resource = "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:*/securebase"
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:securebase/${var.environment}/*"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:*:log-group:/aws/lambda/securebase-${var.environment}-phase6-*"
      },
      {
        Sid    = "AWSConfigRead"
        Effect = "Allow"
        Action = [
          "config:GetComplianceDetailsByConfigRule",
          "config:DescribeComplianceByConfigRule",
          "config:GetComplianceSummaryByConfigRule",
        ]
        # AWS Config read APIs do not support resource-level ARN restrictions.
        # Wildcard is required; access is scoped to the deployment region via condition.
        Resource = "*"
        Condition = {
          StringEquals = { "aws:RequestedRegion" = data.aws_region.current.name }
        }
      },
      {
        Sid    = "SecurityHubRead"
        Effect = "Allow"
        Action = ["securityhub:GetFindings"]
        # Security Hub read APIs do not support resource-level ARN restrictions.
        # Wildcard is required; access is scoped to the deployment region via condition.
        Resource = "*"
        Condition = {
          StringEquals = { "aws:RequestedRegion" = data.aws_region.current.name }
        }
      },
      {
        Sid    = "GuardDutyRead"
        Effect = "Allow"
        Action = [
          "guardduty:ListFindings",
          "guardduty:GetFindings",
          "guardduty:ListDetectors",
        ]
        # GuardDuty read APIs require wildcard resource; scoped to deployment region.
        Resource = "*"
        Condition = {
          StringEquals = { "aws:RequestedRegion" = data.aws_region.current.name }
        }
      },
    ]
  })
}

# Optional: S3 GetObject permission for compliance mapping files stored in S3
resource "aws_iam_role_policy" "phase6_s3_mappings" {
  count = var.mappings_bucket != "" ? 1 : 0
  name  = "securebase-${var.environment}-phase6-s3-mappings"
  role  = aws_iam_role.phase6_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "S3MappingsBucket"
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "arn:aws:s3:::${var.mappings_bucket}/compliance/*"
    }]
  })
}

# ============================================================================
# audit_evidence_api Lambda
# Handles: GET /admin/evidence, GET /admin/evidence/{id},
#          POST /admin/evidence/generate
# ============================================================================

resource "aws_lambda_function" "audit_evidence_api" {
  filename         = var.audit_evidence_api_zip
  function_name    = "securebase-${var.environment}-phase6-audit-evidence-api"
  role             = aws_iam_role.phase6_lambda.arn
  handler          = "audit_evidence_api.lambda_handler"
  source_code_hash = filebase64sha256(var.audit_evidence_api_zip)
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512

  tracing_config { mode = "Active" }

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      EVIDENCE_BUCKET      = var.evidence_bucket_name
      EVIDENCE_KMS_KEY_ARN = var.evidence_kms_key_arn
      RDS_HOST             = var.rds_proxy_endpoint
      RDS_DATABASE         = var.database_name
      RDS_USER             = var.database_user
      LOG_LEVEL            = "INFO"
      PRESIGNED_URL_EXPIRY = "3600"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = var.security_group_ids
  }

  tags = merge(var.tags, { Phase = "6.1", Name = "securebase-${var.environment}-phase6-audit-evidence-api" })
}

resource "aws_cloudwatch_log_group" "audit_evidence_api" {
  name              = "/aws/lambda/securebase-${var.environment}-phase6-audit-evidence-api"
  retention_in_days = 90
  tags              = var.tags
}

# ============================================================================
# compliance_history_api Lambda
# Handles: GET /tenant/compliance/history
# ============================================================================

resource "aws_lambda_function" "compliance_history_api" {
  filename         = var.compliance_history_api_zip
  function_name    = "securebase-${var.environment}-phase6-compliance-history-api"
  role             = aws_iam_role.phase6_lambda.arn
  handler          = "compliance_history_api.lambda_handler"
  source_code_hash = filebase64sha256(var.compliance_history_api_zip)
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512

  tracing_config { mode = "Active" }

  environment {
    variables = {
      ENVIRONMENT             = var.environment
      COMPLIANCE_SCORES_TABLE = aws_dynamodb_table.compliance_scores.name
      LOG_LEVEL               = "INFO"
    }
  }

  # No VPC needed — only reads from DynamoDB (public endpoint via VPC endpoint or NAT)
  tags = merge(var.tags, { Phase = "6.2", Name = "securebase-${var.environment}-phase6-compliance-history-api" })
}

resource "aws_cloudwatch_log_group" "compliance_history_api" {
  name              = "/aws/lambda/securebase-${var.environment}-phase6-compliance-history-api"
  retention_in_days = 90
  tags              = var.tags
}

# ============================================================================
# DynamoDB Tables — Compliance Scoring
# ============================================================================

resource "aws_dynamodb_table" "compliance_scores" {
  name         = "securebase-compliance-scores"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Phase = "6.2"
    Name  = "securebase-compliance-scores"
  })
}

resource "aws_dynamodb_table" "control_violation_log" {
  name         = "control_violation_log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Phase = "6.2"
    Name  = "control_violation_log"
  })
}

# ============================================================================
# compliance_score_recalculator Lambda
# Trigger: EventBridge daily at 02:00 UTC
# ============================================================================

resource "aws_lambda_function" "compliance_score_recalculator" {
  filename         = var.compliance_score_recalculator_zip
  function_name    = "securebase-${var.environment}-phase6-compliance-score-recalculator"
  role             = aws_iam_role.phase6_lambda.arn
  handler          = "compliance_score_recalculator.lambda_handler"
  source_code_hash = filebase64sha256(var.compliance_score_recalculator_zip)
  runtime          = "python3.11"
  timeout     = 600  # 10 minutes — sequential per-tenant scoring across 3 frameworks.
  # Viable for up to ~200 tenants. For larger deployments, consider SQS fanout or Step Functions.
  memory_size      = 512

  tracing_config { mode = "Active" }

  environment {
    variables = {
      ENVIRONMENT             = var.environment
      COMPLIANCE_SCORES_TABLE = aws_dynamodb_table.compliance_scores.name
      CONTROL_VIOLATION_TABLE = aws_dynamodb_table.control_violation_log.name
      MAPPINGS_BUCKET         = var.mappings_bucket
      LOG_LEVEL               = "INFO"
    }
  }

  # Runs against AWS Config / Security Hub / GuardDuty — no VPC required
  tags = merge(var.tags, {
    Phase = "6.2"
    Name  = "securebase-${var.environment}-phase6-compliance-score-recalculator"
  })

  depends_on = [
    aws_dynamodb_table.compliance_scores,
    aws_dynamodb_table.control_violation_log,
  ]
}

resource "aws_cloudwatch_log_group" "compliance_score_recalculator" {
  name              = "/aws/lambda/securebase-${var.environment}-phase6-compliance-score-recalculator"
  retention_in_days = 90
  tags              = var.tags
}

# ============================================================================
# EventBridge — Daily compliance score recalculation cron (02:00 UTC)
# ============================================================================

resource "aws_cloudwatch_event_rule" "score_recalculator_daily" {
  name                = "securebase-${var.environment}-phase6-score-recalculator-daily"
  description         = "Phase 6.2: trigger compliance_score_recalculator Lambda daily at 02:00 UTC"
  schedule_expression = "cron(0 2 * * ? *)"

  tags = merge(var.tags, {
    Phase = "6.2"
    Name  = "securebase-${var.environment}-phase6-score-recalculator-daily"
  })
}

resource "aws_cloudwatch_event_target" "score_recalculator_daily" {
  rule      = aws_cloudwatch_event_rule.score_recalculator_daily.name
  target_id = "phase6-compliance-score-recalculator"
  arn       = aws_lambda_function.compliance_score_recalculator.arn

  retry_policy {
    maximum_event_age_in_seconds = 120
    maximum_retry_attempts       = 2
  }
}

resource "aws_lambda_permission" "score_recalculator_eventbridge" {
  statement_id  = "AllowEventBridgePhase6ScoreRecalculator"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.compliance_score_recalculator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.score_recalculator_daily.arn
}

# ============================================================================
# CloudWatch Alarms — Score Recalculator
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "score_recalculator_errors" {
  count               = var.alert_sns_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-compliance-score-recalculator-failure"
  alarm_description   = "compliance_score_recalculator Lambda errors > 0 in 5-minute window"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.compliance_score_recalculator.function_name
  }

  alarm_actions = [var.alert_sns_arn]
  ok_actions    = [var.alert_sns_arn]

  tags = merge(var.tags, { Phase = "6.2", Severity = "high" })
}
