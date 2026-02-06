/**
 * SecureBase Demo Backend Module
 * 
 * Lightweight serverless backend for Phase 2 demo
 * - Uses exact 5 test clients from mockData.js
 * - Provides real API endpoints with JWT auth
 * - Returns deterministic data (same as mock)
 * - Costs pennies to run (DynamoDB + Lambda)
 */

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  # Project tags
  common_tags = merge(var.tags, {
    Module      = "demo-backend"
    Environment = var.environment
    ManagedBy   = "Terraform"
  })
  
  # Lambda function names
  lambda_functions = {
    auth      = "${var.project_name}-demo-auth-${var.environment}"
    customers = "${var.project_name}-demo-customers-${var.environment}"
    invoices  = "${var.project_name}-demo-invoices-${var.environment}"
    metrics   = "${var.project_name}-demo-metrics-${var.environment}"
    health    = "${var.project_name}-demo-health-${var.environment}"
  }
  
  # DynamoDB table names
  table_names = {
    customers = "${var.project_name}-demo-customers-${var.environment}"
    invoices  = "${var.project_name}-demo-invoices-${var.environment}"
    metrics   = "${var.project_name}-demo-metrics-${var.environment}"
  }
}

#############################################################################
# DynamoDB Tables
#############################################################################

# Customers table
resource "aws_dynamodb_table" "customers" {
  name           = local.table_names.customers
  billing_mode   = "PAY_PER_REQUEST"  # On-demand pricing for demo
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "email"
    type = "S"
  }
  
  # GSI for email lookups
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
  
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Customers"
  })
}

# Invoices table
resource "aws_dynamodb_table" "invoices" {
  name           = local.table_names.invoices
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "customer_id"
    type = "S"
  }
  
  attribute {
    name = "created_at"
    type = "S"
  }
  
  # GSI for customer invoice queries
  global_secondary_index {
    name            = "customer-index"
    hash_key        = "customer_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }
  
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Invoices"
  })
}

# Metrics table (single record)
resource "aws_dynamodb_table" "metrics" {
  name           = local.table_names.metrics
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }
  
  server_side_encryption {
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Metrics"
  })
}

#############################################################################
# IAM Roles for Lambda Functions
#############################################################################

# IAM role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-demo-lambda-role-${var.environment}"
  
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

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for DynamoDB access
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.project_name}-demo-lambda-dynamodb-${var.environment}"
  role = aws_iam_role.lambda_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.customers.arn,
          aws_dynamodb_table.invoices.arn,
          aws_dynamodb_table.metrics.arn,
          "${aws_dynamodb_table.customers.arn}/index/*",
          "${aws_dynamodb_table.invoices.arn}/index/*"
        ]
      }
    ]
  })
}

#############################################################################
# Lambda Functions
#############################################################################

# Create Lambda deployment packages
data "archive_file" "lambda_auth" {
  type        = "zip"
  source_file = "${path.module}/lambda/auth.py"
  output_path = "${path.module}/builds/auth.zip"
}

data "archive_file" "lambda_customers" {
  type        = "zip"
  source_file = "${path.module}/lambda/customers.py"
  output_path = "${path.module}/builds/customers.zip"
}

data "archive_file" "lambda_invoices" {
  type        = "zip"
  source_file = "${path.module}/lambda/invoices.py"
  output_path = "${path.module}/builds/invoices.zip"
}

data "archive_file" "lambda_metrics" {
  type        = "zip"
  source_file = "${path.module}/lambda/metrics.py"
  output_path = "${path.module}/builds/metrics.zip"
}

data "archive_file" "lambda_health" {
  type        = "zip"
  source_file = "${path.module}/lambda/health.py"
  output_path = "${path.module}/builds/health.zip"
}

# Auth Lambda
resource "aws_lambda_function" "auth" {
  filename         = data.archive_file.lambda_auth.output_path
  function_name    = local.lambda_functions.auth
  role            = aws_iam_role.lambda_role.arn
  handler         = "auth.lambda_handler"
  source_code_hash = data.archive_file.lambda_auth.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      JWT_SECRET = var.jwt_secret
      ENVIRONMENT = var.environment
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Auth"
  })
}

# Customers Lambda
resource "aws_lambda_function" "customers" {
  filename         = data.archive_file.lambda_customers.output_path
  function_name    = local.lambda_functions.customers
  role            = aws_iam_role.lambda_role.arn
  handler         = "customers.lambda_handler"
  source_code_hash = data.archive_file.lambda_customers.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      CUSTOMERS_TABLE = aws_dynamodb_table.customers.name
      ENVIRONMENT = var.environment
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Customers"
  })
}

# Invoices Lambda
resource "aws_lambda_function" "invoices" {
  filename         = data.archive_file.lambda_invoices.output_path
  function_name    = local.lambda_functions.invoices
  role            = aws_iam_role.lambda_role.arn
  handler         = "invoices.lambda_handler"
  source_code_hash = data.archive_file.lambda_invoices.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      INVOICES_TABLE = aws_dynamodb_table.invoices.name
      ENVIRONMENT = var.environment
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Invoices"
  })
}

# Metrics Lambda
resource "aws_lambda_function" "metrics" {
  filename         = data.archive_file.lambda_metrics.output_path
  function_name    = local.lambda_functions.metrics
  role            = aws_iam_role.lambda_role.arn
  handler         = "metrics.lambda_handler"
  source_code_hash = data.archive_file.lambda_metrics.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      METRICS_TABLE = aws_dynamodb_table.metrics.name
      ENVIRONMENT = var.environment
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Metrics"
  })
}

# Health Lambda
resource "aws_lambda_function" "health" {
  filename         = data.archive_file.lambda_health.output_path
  function_name    = local.lambda_functions.health
  role            = aws_iam_role.lambda_role.arn
  handler         = "health.lambda_handler"
  source_code_hash = data.archive_file.lambda_health.output_base64sha256
  runtime         = "python3.11"
  timeout         = 10
  memory_size     = 128
  
  environment {
    variables = {
      CUSTOMERS_TABLE = aws_dynamodb_table.customers.name
      ENVIRONMENT = var.environment
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "SecureBase Demo Health"
  })
}

#############################################################################
# CloudWatch Log Groups
#############################################################################

resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${local.lambda_functions.auth}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "customers" {
  name              = "/aws/lambda/${local.lambda_functions.customers}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "invoices" {
  name              = "/aws/lambda/${local.lambda_functions.invoices}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "metrics" {
  name              = "/aws/lambda/${local.lambda_functions.metrics}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "health" {
  name              = "/aws/lambda/${local.lambda_functions.health}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

#############################################################################
# API Gateway REST API
#############################################################################

resource "aws_api_gateway_rest_api" "demo_api" {
  name        = "${var.project_name}-demo-api-${var.environment}"
  description = "SecureBase Demo Backend API"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  tags = local.common_tags
}

# /auth resource
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_rest_api.demo_api.root_resource_id
  path_part   = "auth"
}

# /customers resource
resource "aws_api_gateway_resource" "customers" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_rest_api.demo_api.root_resource_id
  path_part   = "customers"
}

# /customers/{id} resource
resource "aws_api_gateway_resource" "customer_id" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_resource.customers.id
  path_part   = "{id}"
}

# /invoices resource
resource "aws_api_gateway_resource" "invoices" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_rest_api.demo_api.root_resource_id
  path_part   = "invoices"
}

# /invoices/{id} resource
resource "aws_api_gateway_resource" "invoice_id" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_resource.invoices.id
  path_part   = "{id}"
}

# /metrics resource
resource "aws_api_gateway_resource" "metrics" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_rest_api.demo_api.root_resource_id
  path_part   = "metrics"
}

# /health resource
resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  parent_id   = aws_api_gateway_rest_api.demo_api.root_resource_id
  path_part   = "health"
}

#############################################################################
# API Gateway Methods - Auth
#############################################################################

# POST /auth
resource "aws_api_gateway_method" "auth_post" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_post" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_post.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth.invoke_arn
}

# OPTIONS /auth (CORS)
resource "aws_api_gateway_method" "auth_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth.invoke_arn
}

#############################################################################
# API Gateway Methods - Customers
#############################################################################

# GET /customers
resource "aws_api_gateway_method" "customers_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.customers.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "customers_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.customers.id
  http_method = aws_api_gateway_method.customers_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.customers.invoke_arn
}

# OPTIONS /customers (CORS)
resource "aws_api_gateway_method" "customers_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.customers.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "customers_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.customers.id
  http_method = aws_api_gateway_method.customers_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.customers.invoke_arn
}

# GET /customers/{id}
resource "aws_api_gateway_method" "customer_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.customer_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "customer_id_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.customer_id.id
  http_method = aws_api_gateway_method.customer_id_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.customers.invoke_arn
}

# OPTIONS /customers/{id} (CORS)
resource "aws_api_gateway_method" "customer_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.customer_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "customer_id_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.customer_id.id
  http_method = aws_api_gateway_method.customer_id_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.customers.invoke_arn
}

#############################################################################
# API Gateway Methods - Invoices
#############################################################################

# GET /invoices
resource "aws_api_gateway_method" "invoices_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.invoices.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invoices_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.invoices.id
  http_method = aws_api_gateway_method.invoices_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invoices.invoke_arn
}

# OPTIONS /invoices (CORS)
resource "aws_api_gateway_method" "invoices_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.invoices.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invoices_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.invoices.id
  http_method = aws_api_gateway_method.invoices_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invoices.invoke_arn
}

# GET /invoices/{id}
resource "aws_api_gateway_method" "invoice_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.invoice_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invoice_id_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.invoice_id.id
  http_method = aws_api_gateway_method.invoice_id_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invoices.invoke_arn
}

# OPTIONS /invoices/{id} (CORS)
resource "aws_api_gateway_method" "invoice_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.invoice_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invoice_id_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.invoice_id.id
  http_method = aws_api_gateway_method.invoice_id_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invoices.invoke_arn
}

#############################################################################
# API Gateway Methods - Metrics
#############################################################################

# GET /metrics
resource "aws_api_gateway_method" "metrics_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.metrics.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "metrics_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.metrics.id
  http_method = aws_api_gateway_method.metrics_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.metrics.invoke_arn
}

# OPTIONS /metrics (CORS)
resource "aws_api_gateway_method" "metrics_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.metrics.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "metrics_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.metrics.id
  http_method = aws_api_gateway_method.metrics_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.metrics.invoke_arn
}

#############################################################################
# API Gateway Methods - Health
#############################################################################

# GET /health
resource "aws_api_gateway_method" "health_get" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "health_get" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_get.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.health.invoke_arn
}

# OPTIONS /health (CORS)
resource "aws_api_gateway_method" "health_options" {
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "health_options" {
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_options.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.health.invoke_arn
}

#############################################################################
# Lambda Permissions for API Gateway
#############################################################################

resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.demo_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "customers" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.customers.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.demo_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "invoices" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invoices.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.demo_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "metrics" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.metrics.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.demo_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "health" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.demo_api.execution_arn}/*/*"
}

#############################################################################
# API Gateway Deployment
#############################################################################

resource "aws_api_gateway_deployment" "demo" {
  depends_on = [
    aws_api_gateway_integration.auth_post,
    aws_api_gateway_integration.customers_get,
    aws_api_gateway_integration.customer_id_get,
    aws_api_gateway_integration.invoices_get,
    aws_api_gateway_integration.invoice_id_get,
    aws_api_gateway_integration.metrics_get,
    aws_api_gateway_integration.health_get
  ]
  
  rest_api_id = aws_api_gateway_rest_api.demo_api.id
  
  # Force new deployment on changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_integration.auth_post,
      aws_api_gateway_integration.customers_get,
      aws_api_gateway_integration.invoices_get,
      aws_api_gateway_integration.metrics_get,
      aws_api_gateway_integration.health_get
    ]))
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "demo" {
  deployment_id = aws_api_gateway_deployment.demo.id
  rest_api_id   = aws_api_gateway_rest_api.demo_api.id
  stage_name    = var.environment
  
  tags = local.common_tags
}

#############################################################################
# Data Population (using null_resource for initial load)
#############################################################################

# Note: Set auto_populate_data = false after initial deployment to prevent
# unnecessary data reloads on subsequent applies. Use scripts/load_data.sh
# for manual data reloading when needed.

resource "null_resource" "populate_data" {
  count = var.auto_populate_data ? 1 : 0
  
  depends_on = [
    aws_dynamodb_table.customers,
    aws_dynamodb_table.invoices,
    aws_dynamodb_table.metrics
  ]
  
  provisioner "local-exec" {
    command = <<-EOT
      # Populate customers
      aws dynamodb batch-write-item \
        --request-items file://${path.module}/scripts/load_customers.json \
        --region ${data.aws_region.current.name}
      
      # Populate invoices
      aws dynamodb batch-write-item \
        --request-items file://${path.module}/scripts/load_invoices.json \
        --region ${data.aws_region.current.name}
      
      # Populate metrics
      aws dynamodb put-item \
        --table-name ${aws_dynamodb_table.metrics.name} \
        --item file://${path.module}/data/metrics.json \
        --region ${data.aws_region.current.name}
    EOT
  }
  
  # Only run on table creation by tracking table ARNs
  triggers = {
    customers_table = aws_dynamodb_table.customers.arn
    invoices_table  = aws_dynamodb_table.invoices.arn
    metrics_table   = aws_dynamodb_table.metrics.arn
  }
}

# Get current region
data "aws_region" "current" {}
