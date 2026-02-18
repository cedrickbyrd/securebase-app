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
  name = "securebase-${var.environment}-lambda-execution"

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
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/securebase-${var.environment}-*"
      }
    ]
  })
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

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      JWT_SECRET_ARN    = var.jwt_secret_arn
      DYNAMODB_TABLE    = var.dynamodb_table_name
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
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

#
# MODULES
#
module "netlify_sites" {
  source        = "../../modules/netlify-sites"
  netlify_token = var.netlify_api_token 
#  team_slug     = "cedrickbyrd"
  # ... other variables
}
