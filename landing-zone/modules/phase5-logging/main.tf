# ── Phase 5.3: Logging & Distributed Tracing ──────────────────────────────────
# Delivers:
#   - KMS-encrypted CloudWatch log groups per Lambda function
#   - Shared audit and application log groups
#   - API Gateway access-log group
#   - AWS X-Ray group and sampling rule

data "aws_caller_identity" "current" {}

locals {
  # dev: 7 days | staging: 90 days | prod: 365 days
  retention_days = var.environment == "prod" ? 365 : (var.environment == "staging" ? 90 : 7)
}

# ── KMS key for log-group encryption ─────────────────────────────────────────

resource "aws_kms_key" "logs" {
  description             = "SecureBase ${var.environment} CloudWatch Logs encryption"
  deletion_window_in_days = var.kms_key_deletion_days
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMRoot"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
        Action = [
          "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
          "kms:GenerateDataKey*", "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, { Name = "securebase-${var.environment}-logs-kms", Phase = "5.3" })
}

resource "aws_kms_alias" "logs" {
  name          = "alias/securebase-${var.environment}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# ── Per-Lambda log groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = toset(var.lambda_function_names)

  name              = "/aws/lambda/${each.key}"
  retention_in_days = local.retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = merge(var.tags, {
    Name     = "${each.key}-logs"
    Phase    = "5.3"
    Function = each.key
  })
}

# ── Shared log groups ─────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "audit" {
  name              = "/securebase/${var.environment}/audit"
  retention_in_days = local.retention_days
  kms_key_id        = aws_kms_key.logs.arn
  tags              = merge(var.tags, { Name = "securebase-${var.environment}-audit", Phase = "5.3" })
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/securebase/${var.environment}/application"
  retention_in_days = local.retention_days
  kms_key_id        = aws_kms_key.logs.arn
  tags              = merge(var.tags, { Name = "securebase-${var.environment}-application", Phase = "5.3" })
}

resource "aws_cloudwatch_log_group" "api_gateway_access" {
  name              = "/aws/securebase/${var.environment}/api-gateway/access-logs"
  retention_in_days = local.retention_days
  kms_key_id        = aws_kms_key.logs.arn
  tags              = merge(var.tags, { Name = "securebase-${var.environment}-api-gw-access", Phase = "5.3" })
}

# ── X-Ray ─────────────────────────────────────────────────────────────────────

resource "aws_xray_group" "securebase" {
  group_name        = "securebase-${var.environment}"
  filter_expression = "service(\"securebase-${var.environment}\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.environment == "prod"
  }

  tags = merge(var.tags, { Phase = "5.3" })
}

resource "aws_xray_sampling_rule" "securebase" {
  rule_name      = "securebase-${var.environment}"
  priority       = 1000
  reservoir_size = 1
  fixed_rate     = var.xray_sampling_rate
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "securebase-${var.environment}-*"
  resource_arn   = "*"
  version        = 1

  tags = merge(var.tags, { Phase = "5.3" })
}
