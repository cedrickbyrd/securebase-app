# ============================================
# Phase 4: Enterprise Security Infrastructure
# ============================================
# SSO, Enhanced MFA, IP Whitelisting, Security Monitoring

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================
# VARIABLES
# ============================================

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "securebase"
}

variable "lambda_execution_role_arn" {
  description = "IAM role ARN for Lambda execution"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for Lambda functions"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda functions"
  type        = list(string)
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for database connections"
  type        = string
}

variable "rds_database_name" {
  description = "RDS database name"
  type        = string
  default     = "securebase"
}

variable "rds_secret_arn" {
  description = "ARN of RDS credentials secret in Secrets Manager"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of JWT secret in Secrets Manager"
  type        = string
}

variable "callback_base_url" {
  description = "Base URL for SSO callbacks (e.g., https://portal.securebase.com)"
  type        = string
}

variable "db_layer_arn" {
  description = "ARN of shared database utilities Lambda layer"
  type        = string
}

variable "security_alert_email" {
  description = "Email address for security alerts"
  type        = string
  default     = "security@securebase.com"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================
# KMS KEY FOR SSO SECRETS ENCRYPTION
# ============================================

resource "aws_kms_key" "sso_secrets" {
  description             = "${var.project_name}-${var.environment}-sso-secrets"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-sso-secrets"
    Environment = var.environment
    Purpose     = "SSO client secrets encryption"
  })
}

resource "aws_kms_alias" "sso_secrets" {
  name          = "alias/${var.project_name}-${var.environment}-sso-secrets"
  target_key_id = aws_kms_key.sso_secrets.key_id
}

# ============================================
# SNS TOPIC FOR SECURITY ALERTS
# ============================================

resource "aws_sns_topic" "security_alerts" {
  name              = "${var.project_name}-${var.environment}-security-alerts"
  display_name      = "SecureBase Security Alerts"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-security-alerts"
    Environment = var.environment
    Purpose     = "Security incident notifications"
  })
}

resource "aws_sns_topic_policy" "security_alerts" {
  arn = aws_sns_topic.security_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.security_alerts.arn
      }
    ]
  })
}

# Email subscription for security alerts (must be confirmed)
resource "aws_sns_topic_subscription" "security_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = var.security_alert_email

  # Note: This requires manual confirmation via email
}

# ============================================
# SECURITY GROUP FOR LAMBDA FUNCTIONS
# ============================================

resource "aws_security_group" "phase4_lambda" {
  name_prefix = "${var.project_name}-${var.environment}-phase4-lambda-sg"
  description = "Security group for Phase 4 Lambda functions"
  vpc_id      = var.vpc_id

  # Outbound to RDS
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Should be restricted to RDS security group
    description = "PostgreSQL access"
  }

  # Outbound to internet (for SSO provider APIs)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access for SSO providers"
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-phase4-lambda-sg"
    Environment = var.environment
  })
}

# ============================================
# SSO HANDLER LAMBDA FUNCTION
# ============================================

resource "aws_lambda_function" "sso_handler" {
  function_name = "${var.project_name}-${var.environment}-sso-handler"
  description   = "SSO authentication handler (OIDC, SAML 2.0)"
  role          = var.lambda_execution_role_arn
  
  # Deployment package (created by package-lambda.sh)
  filename         = "${path.module}/../../../phase2-backend/deploy/sso_handler.zip"
  source_code_hash = fileexists("${path.module}/../../../phase2-backend/deploy/sso_handler.zip") ? filebase64sha256("${path.module}/../../../phase2-backend/deploy/sso_handler.zip") : null
  
  handler = "sso_handler.lambda_handler"
  runtime = "python3.11"
  timeout = 30  # SSO requires external API calls
  memory_size = 512

  environment {
    variables = {
      RDS_HOST           = var.rds_proxy_endpoint
      RDS_DATABASE       = var.rds_database_name
      RDS_USER           = "securebase_app"
      RDS_SECRET_ARN     = var.rds_secret_arn
      JWT_SECRET_ARN     = var.jwt_secret_arn
      KMS_KEY_ID         = aws_kms_key.sso_secrets.id
      CALLBACK_BASE_URL  = var.callback_base_url
      LOG_LEVEL          = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.phase4_lambda.id]
  }

  # Use shared database layer
  layers = [var.db_layer_arn]

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-sso-handler"
    Environment = var.environment
    Function    = "SSO Authentication"
  })
}

# CloudWatch Logs for SSO handler
resource "aws_cloudwatch_log_group" "sso_handler" {
  name              = "/aws/lambda/${aws_lambda_function.sso_handler.function_name}"
  retention_in_days = var.environment == "prod" ? 90 : 14

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# ============================================
# SECURITY MIDDLEWARE LAMBDA FUNCTION
# ============================================

resource "aws_lambda_function" "security_middleware" {
  function_name = "${var.project_name}-${var.environment}-security-middleware"
  description   = "Security validation (IP whitelist, device fingerprinting, alerts)"
  role          = var.lambda_execution_role_arn
  
  filename         = "${path.module}/../../../phase2-backend/deploy/security_middleware.zip"
  source_code_hash = fileexists("${path.module}/../../../phase2-backend/deploy/security_middleware.zip") ? filebase64sha256("${path.module}/../../../phase2-backend/deploy/security_middleware.zip") : null
  
  handler = "security_middleware.lambda_handler"
  runtime = "python3.11"
  timeout = 10
  memory_size = 256

  environment {
    variables = {
      RDS_HOST               = var.rds_proxy_endpoint
      RDS_DATABASE           = var.rds_database_name
      RDS_USER               = "securebase_app"
      RDS_SECRET_ARN         = var.rds_secret_arn
      SECURITY_SNS_TOPIC_ARN = aws_sns_topic.security_alerts.arn
      LOG_LEVEL              = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.phase4_lambda.id]
  }

  layers = [var.db_layer_arn]

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-security-middleware"
    Environment = var.environment
    Function    = "Security Validation"
  })
}

resource "aws_cloudwatch_log_group" "security_middleware" {
  name              = "/aws/lambda/${aws_lambda_function.security_middleware.function_name}"
  retention_in_days = var.environment == "prod" ? 90 : 14

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# Grant SNS publish permission
resource "aws_lambda_permission" "security_middleware_sns" {
  statement_id  = "AllowSNSPublish"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.security_middleware.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.security_alerts.arn
}

# ============================================
# API KEY ROTATION SCHEDULER
# ============================================

resource "aws_lambda_function" "api_key_rotation" {
  function_name = "${var.project_name}-${var.environment}-api-key-rotation"
  description   = "Automated API key rotation based on policies"
  role          = var.lambda_execution_role_arn
  
  filename         = "${path.module}/../../../phase2-backend/deploy/api_key_rotation.zip"
  source_code_hash = fileexists("${path.module}/../../../phase2-backend/deploy/api_key_rotation.zip") ? filebase64sha256("${path.module}/../../../phase2-backend/deploy/api_key_rotation.zip") : null
  
  handler = "api_key_rotation.lambda_handler"
  runtime = "python3.11"
  timeout = 60
  memory_size = 256

  environment {
    variables = {
      RDS_HOST       = var.rds_proxy_endpoint
      RDS_DATABASE   = var.rds_database_name
      RDS_USER       = "securebase_app"
      RDS_SECRET_ARN = var.rds_secret_arn
      LOG_LEVEL      = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.phase4_lambda.id]
  }

  layers = [var.db_layer_arn]

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-api-key-rotation"
    Environment = var.environment
    Function    = "API Key Rotation"
  })
}

resource "aws_cloudwatch_log_group" "api_key_rotation" {
  name              = "/aws/lambda/${aws_lambda_function.api_key_rotation.function_name}"
  retention_in_days = var.environment == "prod" ? 90 : 14

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# EventBridge rule to trigger rotation daily
resource "aws_cloudwatch_event_rule" "api_key_rotation_schedule" {
  name                = "${var.project_name}-${var.environment}-api-key-rotation-schedule"
  description         = "Trigger API key rotation check daily"
  schedule_expression = "cron(0 2 * * ? *)"  # 2 AM UTC daily

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

resource "aws_cloudwatch_event_target" "api_key_rotation" {
  rule      = aws_cloudwatch_event_rule.api_key_rotation_schedule.name
  target_id = "api-key-rotation-lambda"
  arn       = aws_lambda_function.api_key_rotation.arn
}

resource "aws_lambda_permission" "api_key_rotation_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_key_rotation.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.api_key_rotation_schedule.arn
}

# ============================================
# SESSION CLEANUP SCHEDULER
# ============================================

resource "aws_cloudwatch_event_rule" "session_cleanup_schedule" {
  name                = "${var.project_name}-${var.environment}-session-cleanup-schedule"
  description         = "Cleanup expired sessions hourly"
  schedule_expression = "rate(1 hour)"

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# This would trigger a Lambda that calls the database cleanup functions
# For simplicity, we can add this to the existing session_management Lambda
# or create a dedicated cleanup Lambda

# ============================================
# CLOUDWATCH ALARMS FOR SECURITY
# ============================================

# High-severity security events alarm
resource "aws_cloudwatch_metric_alarm" "high_severity_events" {
  alarm_name          = "${var.project_name}-${var.environment}-high-severity-security-events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HighSeverityEvents"
  namespace           = "SecureBase/Security"
  period              = "300"  # 5 minutes
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when >5 high-severity security events in 5 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.security_alerts.arn]

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# Failed login attempts alarm
resource "aws_cloudwatch_metric_alarm" "failed_logins" {
  alarm_name          = "${var.project_name}-${var.environment}-excessive-failed-logins"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FailedLogins"
  namespace           = "SecureBase/Security"
  period              = "300"  # 5 minutes
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when >10 failed logins in 5 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.security_alerts.arn]

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# SSO login performance alarm (<2s target)
resource "aws_cloudwatch_metric_alarm" "slow_sso_logins" {
  alarm_name          = "${var.project_name}-${var.environment}-slow-sso-logins"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SSOLoginDuration"
  namespace           = "SecureBase/Performance"
  period              = "300"  # 5 minutes
  statistic           = "Average"
  threshold           = "2000"  # 2000ms = 2s
  alarm_description   = "Alert when average SSO login >2s"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.security_alerts.arn]

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# ============================================
# IAM PERMISSIONS FOR KMS
# ============================================

# Allow Lambda to use KMS key
resource "aws_kms_grant" "lambda_sso_secrets" {
  name              = "${var.project_name}-${var.environment}-lambda-sso-secrets-grant"
  key_id            = aws_kms_key.sso_secrets.key_id
  grantee_principal = var.lambda_execution_role_arn

  operations = [
    "Encrypt",
    "Decrypt",
    "GenerateDataKey",
    "DescribeKey"
  ]
}

# ============================================
# OUTPUTS
# ============================================

output "sso_handler_function_arn" {
  description = "ARN of SSO handler Lambda function"
  value       = aws_lambda_function.sso_handler.arn
}

output "sso_handler_function_name" {
  description = "Name of SSO handler Lambda function"
  value       = aws_lambda_function.sso_handler.function_name
}

output "security_middleware_function_arn" {
  description = "ARN of security middleware Lambda function"
  value       = aws_lambda_function.security_middleware.arn
}

output "security_middleware_function_name" {
  description = "Name of security middleware Lambda function"
  value       = aws_lambda_function.security_middleware.function_name
}

output "api_key_rotation_function_arn" {
  description = "ARN of API key rotation Lambda function"
  value       = aws_lambda_function.api_key_rotation.arn
}

output "security_alerts_topic_arn" {
  description = "ARN of security alerts SNS topic"
  value       = aws_sns_topic.security_alerts.arn
}

output "sso_kms_key_id" {
  description = "KMS key ID for SSO secrets encryption"
  value       = aws_kms_key.sso_secrets.id
}

output "sso_kms_key_arn" {
  description = "KMS key ARN for SSO secrets encryption"
  value       = aws_kms_key.sso_secrets.arn
}
