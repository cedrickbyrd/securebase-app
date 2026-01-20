# Lambda Function Configuration for Report Engine
# Phase 4 - Advanced Analytics

resource "aws_lambda_function" "report_engine" {
  filename         = "${path.root}/../phase2-backend/deploy/report_engine.zip"
  function_name    = "securebase-${var.environment}-report-engine"
  role            = aws_iam_role.report_engine.arn
  handler         = "report_engine.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 512

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/report_engine.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/report_engine.zip") : null

  # Attach Lambda layer for ReportLab/openpyxl
  layers = var.reporting_layer_arn != null ? [var.reporting_layer_arn] : []

  environment {
    variables = {
      REPORTS_TABLE    = aws_dynamodb_table.reports.name
      SCHEDULES_TABLE  = aws_dynamodb_table.report_schedules.name
      CACHE_TABLE      = aws_dynamodb_table.report_cache.name
      METRICS_TABLE    = aws_dynamodb_table.metrics.name
      S3_BUCKET        = aws_s3_bucket.reports.bucket
      ENVIRONMENT      = var.environment
      LOG_LEVEL        = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-report-engine"
    Component = "Analytics"
    Phase     = "4"
  })
}

# IAM Role for Report Engine Lambda
resource "aws_iam_role" "report_engine" {
  name = "securebase-${var.environment}-report-engine-role"

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
    Name      = "securebase-${var.environment}-report-engine-role"
    Component = "Analytics"
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "report_engine_basic" {
  role       = aws_iam_role.report_engine.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for DynamoDB and S3 access
resource "aws_iam_role_policy" "report_engine_permissions" {
  name = "report-engine-permissions"
  role = aws_iam_role.report_engine.id

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
          "dynamodb:Scan"
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
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "report_engine" {
  name              = "/aws/lambda/securebase-${var.environment}-report-engine"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "report-engine-logs"
    Component = "Analytics"
  })
}
