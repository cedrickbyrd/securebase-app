# Lambda Function Configuration for Analytics
# Phase 4 - Advanced Analytics

# Analytics Aggregator Lambda (metrics collection)
resource "aws_lambda_function" "analytics_aggregator" {
  filename      = "${path.root}/../phase2-backend/deploy/analytics_aggregator.zip"
  function_name = "securebase-${var.environment}-analytics-aggregator"
  role          = aws_iam_role.analytics_write_role.arn
  handler       = "analytics_aggregator.lambda_handler"
  runtime       = "python3.11"
  timeout       = 60
  memory_size   = 512

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/analytics_aggregator.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/analytics_aggregator.zip") : null

  environment {
    variables = {
      METRICS_TABLE   = aws_dynamodb_table.metrics.name
      CUSTOMERS_TABLE = var.customers_table_name
      ENVIRONMENT     = var.environment
      LOG_LEVEL       = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-aggregator"
    Component = "Analytics"
    Phase     = "4"
  })
}

# Analytics Reporter Lambda (report generation)
resource "aws_lambda_function" "analytics_reporter" {
  filename      = "${path.root}/../phase2-backend/deploy/analytics_reporter.zip"
  function_name = "securebase-${var.environment}-analytics-reporter"
  role          = aws_iam_role.analytics_write_role.arn
  handler       = "analytics_reporter.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/analytics_reporter.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/analytics_reporter.zip") : null

  # Attach Lambda layer for ReportLab/openpyxl
  layers = var.reporting_layer_arn != null ? [var.reporting_layer_arn] : []

  environment {
    variables = {
      METRICS_TABLE = aws_dynamodb_table.metrics.name
      REPORTS_TABLE = aws_dynamodb_table.reports.name
      S3_BUCKET     = aws_s3_bucket.reports.bucket
      SNS_TOPIC     = var.sns_topic_arn
      ENVIRONMENT   = var.environment
      LOG_LEVEL     = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-reporter"
    Component = "Analytics"
    Phase     = "4"
  })
}

# Analytics Query Lambda (API endpoints)
resource "aws_lambda_function" "analytics_query" {
  filename      = "${path.root}/../phase2-backend/deploy/analytics_query.zip"
  function_name = "securebase-${var.environment}-analytics-query"
  role          = aws_iam_role.analytics_read_role.arn
  handler       = "analytics_query.lambda_handler"
  runtime       = "python3.11"
  timeout       = 10
  memory_size   = 256

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/analytics_query.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/analytics_query.zip") : null

  environment {
    variables = {
      METRICS_TABLE     = aws_dynamodb_table.metrics.name
      CACHE_TABLE       = aws_dynamodb_table.report_cache.name
      CACHE_TTL_SECONDS = "3600"
      ENVIRONMENT       = var.environment
      LOG_LEVEL         = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-query"
    Component = "Analytics"
    Phase     = "4"
  })
}

# Legacy Report Engine Lambda (kept for backwards compatibility)
resource "aws_lambda_function" "report_engine" {
  filename      = "${path.root}/../phase2-backend/deploy/report_engine.zip"
  function_name = "securebase-${var.environment}-report-engine"
  role          = aws_iam_role.analytics_write_role.arn
  handler       = "report_engine.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/report_engine.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/report_engine.zip") : null

  # Attach Lambda layer for ReportLab/openpyxl
  layers = var.reporting_layer_arn != null ? [var.reporting_layer_arn] : []

  environment {
    variables = {
      REPORTS_TABLE   = aws_dynamodb_table.reports.name
      SCHEDULES_TABLE = aws_dynamodb_table.report_schedules.name
      CACHE_TABLE     = aws_dynamodb_table.report_cache.name
      METRICS_TABLE   = aws_dynamodb_table.metrics.name
      S3_BUCKET       = aws_s3_bucket.reports.bucket
      ENVIRONMENT     = var.environment
      LOG_LEVEL       = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-report-engine"
    Component = "Analytics"
    Phase     = "4"
  })
}

# ── Analytics IAM Role — Read (analytics_query only) ──────────────────────
# Verified not live as of 2026-04-22 — will be created on next apply
resource "aws_iam_role" "analytics_read_role" {
  name = "securebase-${var.environment}-analytics-read-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-read-role"
    Component = "Analytics"
  })
}

resource "aws_iam_role_policy_attachment" "analytics_read_role_basic" {
  role       = aws_iam_role.analytics_read_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Verified not live as of 2026-04-22 — will be created on next apply
resource "aws_iam_role_policy" "analytics_query_permissions" {
  name = "analytics-query-permissions"
  role = aws_iam_role.analytics_read_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.report_cache.arn,
          aws_dynamodb_table.metrics.arn,
          "${aws_dynamodb_table.report_cache.arn}/index/*",
          "${aws_dynamodb_table.metrics.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        # CloudWatch does not support resource-level restrictions for PutMetricData
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/securebase-${var.environment}-analytics-query:*"
      }
    ]
  })
}

# ── Analytics IAM Role — Write (aggregator, reporter, report_engine) ──────
# Imports the pre-existing role securebase-dev-analytics-functions-role.
# See landing-zone/environments/dev/imports.tf for the import block.
# Verified not live (inline policy) as of 2026-04-22 — will be applied on next apply
resource "aws_iam_role" "analytics_write_role" {
  name = "securebase-${var.environment}-analytics-write-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-write-role"
    Component = "Analytics"
  })
}

resource "aws_iam_role_policy_attachment" "analytics_write_role_basic" {
  role       = aws_iam_role.analytics_write_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Verified not live as of 2026-04-22 — will be created on next apply
resource "aws_iam_role_policy" "analytics_write_permissions" {
  name = "analytics-write-permissions"
  role = aws_iam_role.analytics_write_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.reports.arn,
          aws_dynamodb_table.report_schedules.arn,
          aws_dynamodb_table.report_cache.arn,
          aws_dynamodb_table.metrics.arn,
          "${aws_dynamodb_table.reports.arn}/index/*",
          "${aws_dynamodb_table.report_schedules.arn}/index/*",
          "${aws_dynamodb_table.metrics.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.reports.arn,
          "${aws_s3_bucket.reports.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        # CloudWatch does not support resource-level restrictions for PutMetricData.
        # cloudwatch:GetMetricData removed — not required for write-path Lambdas.
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/securebase-${var.environment}-analytics-*:*"
      }
    ]
  })
}

# ── Kept for Terraform state continuity — DO NOT remove until state mv is done ──
# This resource is superseded by analytics_write_role (which imports the same live
# AWS resource) and analytics_read_role (new). No policies are attached to this
# resource; all permissions now flow through the new split roles.
#
# REMOVAL GATE (complete all before deleting this block):
#   1. Both analytics_read_role and analytics_write_role confirmed in live state.
#   2. All four Lambda functions confirm correct role ARNs via `aws lambda get-function-configuration`.
#   3. `terraform state rm module.analytics.aws_iam_role.analytics_functions` run.
#   4. State drift document archived (docs/archive/STATE_DRIFT_2026-04-22-RESOLVED.md).
resource "aws_iam_role" "analytics_functions" {
  name = "securebase-${var.environment}-analytics-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-analytics-functions-role"
    Component = "Analytics"
  })

  lifecycle {
    # Prevent accidental destroy of the live role while state migration is in progress.
    # Remove this once the REMOVAL GATE above is satisfied.
    prevent_destroy = true
  }
}

# CloudWatch Log Groups for all Analytics Lambdas
resource "aws_cloudwatch_log_group" "analytics_aggregator" {
  name              = "/aws/lambda/securebase-${var.environment}-analytics-aggregator"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "analytics-aggregator-logs"
    Component = "Analytics"
  })
}

resource "aws_cloudwatch_log_group" "analytics_reporter" {
  name              = "/aws/lambda/securebase-${var.environment}-analytics-reporter"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "analytics-reporter-logs"
    Component = "Analytics"
  })
}

resource "aws_cloudwatch_log_group" "analytics_query" {
  name              = "/aws/lambda/securebase-${var.environment}-analytics-query"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "analytics-query-logs"
    Component = "Analytics"
  })
}

resource "aws_cloudwatch_log_group" "report_engine" {
  name              = "/aws/lambda/securebase-${var.environment}-report-engine"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "report-engine-logs"
    Component = "Analytics"
  })
}

# EventBridge Rule to trigger aggregator (runs every hour)
resource "aws_cloudwatch_event_rule" "analytics_aggregator_schedule" {
  name                = "securebase-${var.environment}-analytics-aggregator-schedule"
  description         = "Trigger analytics aggregation every hour"
  schedule_expression = "rate(1 hour)"

  tags = merge(var.tags, {
    Name      = "analytics-aggregator-schedule"
    Component = "Analytics"
  })
}

resource "aws_cloudwatch_event_target" "analytics_aggregator" {
  rule      = aws_cloudwatch_event_rule.analytics_aggregator_schedule.name
  target_id = "analytics-aggregator"
  arn       = aws_lambda_function.analytics_aggregator.arn
}

resource "aws_lambda_permission" "allow_eventbridge_aggregator" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_aggregator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.analytics_aggregator_schedule.arn
}

# API Gateway Lambda Permissions
resource "aws_lambda_permission" "analytics_query_api" {
  count         = var.api_gateway_execution_arn != null ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_query.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*"
}

resource "aws_lambda_permission" "analytics_reporter_api" {
  count         = var.api_gateway_execution_arn != null ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_reporter.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*"
}
