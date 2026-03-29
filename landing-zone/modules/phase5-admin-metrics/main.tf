# Phase 5.1 Admin Metrics Module
# Wires metrics_aggregation.py Lambda to API Gateway for live CloudWatch data

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================================================
# Lambda Function - Admin Metrics Aggregation
# ============================================================================

resource "aws_lambda_function" "admin_metrics" {
  filename      = "${path.module}/lambda/metrics_aggregation.zip"
  function_name = "securebase-${var.environment}-admin-metrics"
  handler       = "metrics_aggregation.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256
  role          = aws_iam_role.admin_metrics_lambda.arn

  source_code_hash = fileexists("${path.module}/lambda/metrics_aggregation.zip") ? filebase64sha256("${path.module}/lambda/metrics_aggregation.zip") : null

  environment {
    variables = {
      CUSTOMERS_TABLE   = "securebase-${var.environment}-customers"
      METRICS_TABLE     = "securebase-${var.environment}-metrics"
      DEPLOYMENTS_TABLE = "securebase-${var.environment}-deployments"
      ENVIRONMENT       = var.environment
      LOG_LEVEL         = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-admin-metrics"
    Environment = var.environment
    Phase       = "5.1"
  })
}

# ============================================================================
# IAM Role for Lambda
# ============================================================================

resource "aws_iam_role" "admin_metrics_lambda" {
  name = "securebase-${var.environment}-admin-metrics-lambda"

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

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-admin-metrics-lambda"
  })
}

# Basic Lambda execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.admin_metrics_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudWatch read-only access
resource "aws_iam_role_policy_attachment" "cloudwatch_readonly" {
  role       = aws_iam_role.admin_metrics_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess"
}

# Cost Explorer read-only access
resource "aws_iam_role_policy_attachment" "cost_explorer_readonly" {
  role       = aws_iam_role.admin_metrics_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBillingReadOnlyAccess"
}

# Inline policy for Security Hub and DynamoDB
resource "aws_iam_role_policy" "admin_metrics_custom" {
  name = "securebase-${var.environment}-admin-metrics-custom"
  role = aws_iam_role.admin_metrics_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "securityhub:GetFindings",
          "securityhub:DescribeHub",
          "securityhub:ListFindingAggregators"
        ]
        Resource = "arn:aws:securityhub:${var.aws_region}:*:hub/default"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/securebase-${var.environment}-customers",
          "arn:aws:dynamodb:${var.aws_region}:*:table/securebase-${var.environment}-metrics",
          "arn:aws:dynamodb:${var.aws_region}:*:table/securebase-${var.environment}-deployments"
        ]
      }
    ]
  })
}

# ============================================================================
# API Gateway Resources - /admin parent resource
# ============================================================================

resource "aws_api_gateway_resource" "admin" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "admin"
}

# ============================================================================
# API Gateway Resources - /admin child resources
# ============================================================================

resource "aws_api_gateway_resource" "metrics" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "metrics"
}

resource "aws_api_gateway_resource" "customers" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "customers"
}

resource "aws_api_gateway_resource" "api_performance" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "api-performance"
}

resource "aws_api_gateway_resource" "infrastructure" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "infrastructure"
}

resource "aws_api_gateway_resource" "security" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "security"
}

resource "aws_api_gateway_resource" "costs" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "costs"
}

resource "aws_api_gateway_resource" "deployments" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "deployments"
}

# ============================================================================
# API Gateway Methods (GET)
# NOTE: Authorization is NONE at API Gateway level per requirements
# (JWT validation happens in Lambda). For enhanced security, consider
# using API Gateway's CUSTOM authorizer in production.
# ============================================================================

resource "aws_api_gateway_method" "metrics_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.metrics.id
  http_method   = "GET"
  authorization = "NONE"  # JWT auth handled in Lambda
}

resource "aws_api_gateway_method" "customers_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.customers.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_performance_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.api_performance.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "infrastructure_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.infrastructure.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "security_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.security.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "costs_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.costs.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "deployments_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.deployments.id
  http_method   = "GET"
  authorization = "NONE"
}

# ============================================================================
# API Gateway Integrations (Lambda Proxy)
# ============================================================================

resource "aws_api_gateway_integration" "metrics_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.metrics.id
  http_method             = aws_api_gateway_method.metrics_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "customers_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.customers.id
  http_method             = aws_api_gateway_method.customers_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "api_performance_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.api_performance.id
  http_method             = aws_api_gateway_method.api_performance_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "infrastructure_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.infrastructure.id
  http_method             = aws_api_gateway_method.infrastructure_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "security_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.security.id
  http_method             = aws_api_gateway_method.security_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "costs_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.costs.id
  http_method             = aws_api_gateway_method.costs_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

resource "aws_api_gateway_integration" "deployments_lambda" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.deployments.id
  http_method             = aws_api_gateway_method.deployments_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.admin_metrics.arn}/invocations"
}

# ============================================================================
# Lambda Permissions (Allow API Gateway to invoke)
# ============================================================================

resource "aws_lambda_permission" "admin_metrics_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin_metrics.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ============================================================================
# CORS Configuration
# ============================================================================

# OPTIONS /admin/metrics
resource "aws_api_gateway_method" "metrics_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.metrics.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "metrics_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.metrics.id
  http_method = aws_api_gateway_method.metrics_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "metrics_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.metrics.id
  http_method = aws_api_gateway_method.metrics_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "metrics_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.metrics.id
  http_method = aws_api_gateway_method.metrics_options.http_method
  status_code = aws_api_gateway_method_response.metrics_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.metrics_options]
}

# OPTIONS /admin/customers
resource "aws_api_gateway_method" "customers_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.customers.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "customers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.customers.id
  http_method = aws_api_gateway_method.customers_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "customers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.customers.id
  http_method = aws_api_gateway_method.customers_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "customers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.customers.id
  http_method = aws_api_gateway_method.customers_options.http_method
  status_code = aws_api_gateway_method_response.customers_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.customers_options]
}

# OPTIONS /admin/api-performance
resource "aws_api_gateway_method" "api_performance_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.api_performance.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "api_performance_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.api_performance.id
  http_method = aws_api_gateway_method.api_performance_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "api_performance_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.api_performance.id
  http_method = aws_api_gateway_method.api_performance_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "api_performance_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.api_performance.id
  http_method = aws_api_gateway_method.api_performance_options.http_method
  status_code = aws_api_gateway_method_response.api_performance_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.api_performance_options]
}

# OPTIONS /admin/infrastructure
resource "aws_api_gateway_method" "infrastructure_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.infrastructure.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "infrastructure_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.infrastructure.id
  http_method = aws_api_gateway_method.infrastructure_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "infrastructure_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.infrastructure.id
  http_method = aws_api_gateway_method.infrastructure_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "infrastructure_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.infrastructure.id
  http_method = aws_api_gateway_method.infrastructure_options.http_method
  status_code = aws_api_gateway_method_response.infrastructure_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.infrastructure_options]
}

# OPTIONS /admin/security
resource "aws_api_gateway_method" "security_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.security.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "security_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.security.id
  http_method = aws_api_gateway_method.security_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "security_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.security.id
  http_method = aws_api_gateway_method.security_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "security_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.security.id
  http_method = aws_api_gateway_method.security_options.http_method
  status_code = aws_api_gateway_method_response.security_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.security_options]
}

# OPTIONS /admin/costs
resource "aws_api_gateway_method" "costs_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.costs.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "costs_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.costs.id
  http_method = aws_api_gateway_method.costs_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "costs_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.costs.id
  http_method = aws_api_gateway_method.costs_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "costs_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.costs.id
  http_method = aws_api_gateway_method.costs_options.http_method
  status_code = aws_api_gateway_method_response.costs_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.costs_options]
}

# OPTIONS /admin/deployments
resource "aws_api_gateway_method" "deployments_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.deployments.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "deployments_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.deployments.id
  http_method = aws_api_gateway_method.deployments_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "deployments_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.deployments.id
  http_method = aws_api_gateway_method.deployments_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "deployments_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.deployments.id
  http_method = aws_api_gateway_method.deployments_options.http_method
  status_code = aws_api_gateway_method_response.deployments_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.deployments_options]
}
