terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (demo, staging, production)"
  type        = string
  default     = "demo"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "securebase"
}

# Local variables
locals {
  function_name = "${var.project_name}-${var.environment}-customer-index"
  table_name    = "${var.project_name}-${var.environment}-visitor-counter"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = "demo-counter"
    CostCenter  = "demo-environment"
  }
}

# DynamoDB Table for visitor counter
resource "aws_dynamodb_table" "visitor_counter" {
  name           = local.table_name
  billing_mode   = "PAY_PER_REQUEST"  # On-demand pricing (~$0.25/month)
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  # Enable point-in-time recovery for free
  point_in_time_recovery {
    enabled = false  # Not needed for demo counter
  }
  
  # Server-side encryption
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-${var.environment}-visitor-counter"
    }
  )
}

# Initialize counter item
resource "null_resource" "initialize_counter" {
  depends_on = [aws_dynamodb_table.visitor_counter]
  
  provisioner "local-exec" {
    command = <<-EOT
      aws dynamodb put-item \
        --table-name ${local.table_name} \
        --item '{"id":{"S":"visitor-counter"},"visitor_count":{"N":"0"}}' \
        --condition-expression "attribute_not_exists(id)" \
        --region ${var.aws_region} || true
    EOT
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${local.function_name}-role"
  
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
  
  tags = local.common_tags
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "${local.function_name}-dynamodb"
  role = aws_iam_role.lambda_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.visitor_counter.arn
      }
    ]
  })
}

# Attach basic Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Archive Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/get-customer-index.py"
  output_path = "${path.module}/lambda/get-customer-index.zip"
}

# Lambda function
resource "aws_lambda_function" "customer_index" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = local.function_name
  role            = aws_iam_role.lambda_role.arn
  handler         = "get-customer-index.lambda_handler"
  runtime         = "python3.11"
  timeout         = 3
  memory_size     = 128  # Minimum memory (cheapest)
  
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  
  environment {
    variables = {
      DYNAMODB_TABLE = local.table_name
    }
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = local.function_name
    }
  )
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 7  # Keep logs for 1 week
  
  tags = local.common_tags
}

# API Gateway (HTTP API - cheaper than REST API)
resource "aws_apigatewayv2_api" "demo_api" {
  name          = "${var.project_name}-${var.environment}-counter-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type"]
    max_age       = 300
  }
  
  tags = local.common_tags
}

# API Gateway integration with Lambda
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id             = aws_apigatewayv2_api.demo_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.customer_index.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

# API Gateway route
resource "aws_apigatewayv2_route" "get_customer_index" {
  api_id    = aws_apigatewayv2_api.demo_api.id
  route_key = "GET /demo/customer-index"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.demo_api.id
  name        = "$default"
  auto_deploy = true
  
  tags = local.common_tags
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.customer_index.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.demo_api.execution_arn}/*/*"
}

# Outputs
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.demo_api.api_endpoint}/demo/customer-index"
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.visitor_counter.name
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.customer_index.function_name
}

output "environment_variable" {
  description = "Environment variable to add to .env.demo"
  value       = "VITE_DEMO_COUNTER_API=${aws_apigatewayv2_api.demo_api.api_endpoint}/demo/customer-index"
}
