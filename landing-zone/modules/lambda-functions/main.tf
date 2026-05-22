# Lambda Functions Module
# Deploys all Phase 2 backend Lambda functions

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================================================
# Data Sources
# ============================================================================

data "aws_caller_identity" "current" {}

# ============================================================================
# Lambda Execution Role
# ============================================================================

resource "aws_iam_role" "lambda_execution" {
  # Role name uses underscores (not hyphens) — matches pre-existing live role
  # imported via landing-zone/environments/dev/imports.tf.
  # DO NOT change to hyphens without a live rename + state mv operation.
  name = "securebase_lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC execution policy (for RDS access)
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom policy for DynamoDB, RDS, Secrets Manager, SNS, SES
resource "aws_iam_role_policy" "lambda_custom" {
  name = "lambda-custom-permissions"
  role = aws_iam_role.lambda_execution.id

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
          "arn:aws:dynamodb:${var.aws_region}:*:table/securebase-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:*:secret:securebase/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBClusters",
          "rds:DescribeDBInstances"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          "arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:securebase-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        # Scoped to the verified SES identity when ses_identity_arn is provided.
        # Defaults to unrestricted only when the variable is left empty.
        Resource = var.ses_identity_arn != "" ? [var.ses_identity_arn] : ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/securebase-${var.environment}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      },
      {
        Sid    = "AssumeCustomerRoles"
        Effect = "Allow"
        # Resource uses wildcard account ID by design: SecureBase is a multi-tenant
        # SaaS that scans customer AWS accounts in any account. Access is bounded by
        # the role name prefix (SecureBase*) and enforced via ExternalId in each
        # customer's trust policy — preventing confused-deputy escalation.
        Action = ["sts:AssumeRole"]
        Resource = "arn:aws:iam::*:role/SecureBase*"
      }
    ]
  })
}

# ============================================================================
# Customer Activation SNS Topic
# ============================================================================

# SNS topic that receives invite_accepted and first_login events from auth_v2.
resource "aws_sns_topic" "customer_activation" {
  name         = "securebase-${var.environment}-customer-activations"
  display_name = "SecureBase Customer Activations"

  tags = merge(var.tags, {
    Name    = "securebase-${var.environment}-customer-activations"
    Purpose = "Customer activation alerts (invite_accepted, first_login)"
  })
}

# Allow the Lambda execution role to publish to this topic.
resource "aws_sns_topic_policy" "customer_activation" {
  arn = aws_sns_topic.customer_activation.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.customer_activation.arn
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:securebase-${var.environment}-*"
          }
        }
      }
    ]
  })
}

# CEO email subscription — receives instant alerts on every activation event.
# Requires one-time email confirmation from AWS before messages are delivered.
# Omitted entirely when var.ceo_alert_email is left empty.
resource "aws_sns_topic_subscription" "ceo_activation_alert" {
  count     = var.ceo_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.customer_activation.arn
  protocol  = "email"
  endpoint  = var.ceo_alert_email
}

# ============================================================================
# Lambda Functions
# ============================================================================

# Authentication Lambda
resource "aws_lambda_function" "auth_v2" {
  filename         = var.lambda_packages["auth_v2"]
  function_name    = "securebase-${var.environment}-auth-v2"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["auth_v2"])
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 512
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT            = var.environment
      JWT_SECRET_ARN         = var.jwt_secret_arn
      DYNAMODB_TABLE         = var.dynamodb_table_name
      RDS_PROXY_ENDPOINT     = var.rds_proxy_endpoint
      ACTIVATION_SNS_TOPIC_ARN = aws_sns_topic.customer_activation.arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-auth-v2"
  })
}

# Health Check Lambda
resource "aws_lambda_function" "health_check" {
  filename         = var.lambda_packages["health_check"]
  function_name    = "securebase-${var.environment}-health-check"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "health_check.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["health_check"])
  runtime         = "python3.11"
  timeout         = 10
  memory_size     = 256
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      LOG_LEVEL          = "INFO"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-health-check"
  })
}

# Webhook Manager Lambda
resource "aws_lambda_function" "webhook_manager" {
  filename         = var.lambda_packages["webhook_manager"]
  function_name    = "securebase-${var.environment}-webhook-manager"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["webhook_manager"])
  runtime         = "python3.11"
  timeout         = 60
  memory_size     = 512
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT           = var.environment
      WEBHOOKS_TABLE        = "securebase-${var.environment}-webhooks"
      WEBHOOK_DELIVERIES_TABLE = "securebase-${var.environment}-webhook-deliveries"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-webhook-manager"
  })
}

# Billing Worker Lambda
resource "aws_lambda_function" "billing_worker" {
  filename         = var.lambda_packages["billing_worker"]
  function_name    = "securebase-${var.environment}-billing-worker"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["billing_worker"])
  runtime         = "python3.11"
  timeout         = 60
  memory_size     = 1024
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT    = var.environment
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      DB_NAME        = var.database_name
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-billing-worker"
  })
}

# Support Tickets Lambda
resource "aws_lambda_function" "support_tickets" {
  filename         = var.lambda_packages["support_tickets"]
  function_name    = "securebase-${var.environment}-support-tickets"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["support_tickets"])
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 512
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      SUPPORT_TICKETS_TABLE = "securebase-${var.environment}-support-tickets"
      TICKET_COMMENTS_TABLE = "securebase-${var.environment}-ticket-comments"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-support-tickets"
  })
}

# Cost Forecasting Lambda
resource "aws_lambda_function" "cost_forecasting" {
  filename         = var.lambda_packages["cost_forecasting"]
  function_name    = "securebase-${var.environment}-cost-forecasting"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["cost_forecasting"])
  runtime         = "python3.11"
  timeout         = 60
  memory_size     = 1024
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      METRICS_TABLE      = "securebase-${var.environment}-metrics"
      FORECASTS_TABLE    = "securebase-${var.environment}-cost-forecasts"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-cost-forecasting"
  })
}

# ============================================================================
# CloudWatch Log Groups
# ============================================================================

resource "aws_cloudwatch_log_group" "auth_v2" {
  name              = "/aws/lambda/securebase-${var.environment}-auth-v2"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "health_check" {
  name              = "/aws/lambda/securebase-${var.environment}-health-check"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "webhook_manager" {
  name              = "/aws/lambda/securebase-${var.environment}-webhook-manager"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "billing_worker" {
  name              = "/aws/lambda/securebase-${var.environment}-billing-worker"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "support_tickets" {
  name              = "/aws/lambda/securebase-${var.environment}-support-tickets"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "cost_forecasting" {
  name              = "/aws/lambda/securebase-${var.environment}-cost-forecasting"
  retention_in_days = 30
  tags              = var.tags
}

# ============================================================================
# Lead Capture Lambda
# ============================================================================

resource "aws_lambda_function" "submit_lead" {
  filename         = var.lambda_packages["submit_lead"]
  function_name    = "securebase-${var.environment}-submit-lead"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "submit_lead.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["submit_lead"])
  runtime          = "python3.11"
  timeout          = 10
  memory_size      = 256
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT                    = var.environment
      ALLOWED_ORIGIN                 = var.lead_capture_allowed_origin
      LEAD_NOTIFICATION_WEBHOOK_URL  = var.lead_notification_webhook_url
    }
  }

  # This function is intentionally NOT placed in the VPC — it does not need
  # database access and benefits from faster cold starts without VPC overhead.

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-submit-lead"
  })
}

resource "aws_cloudwatch_log_group" "submit_lead" {
  name              = "/aws/lambda/securebase-${var.environment}-submit-lead"
  retention_in_days = 30
  tags              = var.tags
}

# Demo Auth Lambda — issues short-lived HttpOnly JWT cookies for demo visitors.
# NOT placed in the VPC: no database access required, benefits from faster cold starts.
resource "aws_lambda_function" "demo_auth" {
  filename         = var.lambda_packages["demo_auth"]
  function_name    = "securebase-${var.environment}-demo-auth"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "demo_auth.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["demo_auth"])
  runtime          = "python3.11"
  timeout          = 10
  memory_size      = 256
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT    = var.environment
      JWT_SECRET     = var.demo_auth_jwt_secret
      DEMO_EMAIL     = var.demo_auth_email
      DEMO_PASSWORD  = var.demo_auth_password
      ALLOWED_ORIGIN = var.demo_auth_allowed_origin
      TOKEN_TTL_SECS = tostring(var.demo_auth_token_ttl_secs)
    }
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-demo-auth"
  })
}

resource "aws_cloudwatch_log_group" "demo_auth" {
  name              = "/aws/lambda/securebase-${var.environment}-demo-auth"
  retention_in_days = 30
  tags              = var.tags
}

# Session Management Lambda (handles POST /auth/login, /auth/mfa, /auth/logout, etc.)
resource "aws_lambda_function" "session_management" {
  filename         = var.lambda_packages["session_management"]
  function_name    = "securebase-${var.environment}-session-management"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "session_management.lambda_handler"
  source_code_hash = filebase64sha256(var.lambda_packages["session_management"])
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      JWT_SECRET_ARN     = coalesce(var.session_management_jwt_secret_arn != "" ? var.session_management_jwt_secret_arn : null, var.jwt_secret_arn)
      COOKIE_DOMAIN      = var.session_management_cookie_domain
      ALLOWED_ORIGIN     = var.session_management_allowed_origin
      RDS_HOST           = var.rds_proxy_endpoint
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      RDS_DATABASE       = var.database_name
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-session-management"
  })
}

resource "aws_cloudwatch_log_group" "session_management" {
  name              = "/aws/lambda/securebase-${var.environment}-session-management"
  retention_in_days = 30
  tags              = var.tags
}

#
# MODULES
#
module "netlify_sites" {
  source        = "../../modules/netlify-sites"
  netlify_token = var.netlify_api_token 
#  team_slug     = "cedrickbyrd"
  # ... other variables
}
