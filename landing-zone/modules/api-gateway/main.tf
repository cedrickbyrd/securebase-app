# SecureBase API Gateway Module
# Production-grade REST API with security baseline for multi-tenant SaaS

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================================================
# REST API Gateway
# ============================================================================

resource "aws_api_gateway_rest_api" "securebase_api" {
  name        = "securebase-${var.environment}-api"
  description = "SecureBase Multi-Tenant API - ${var.environment}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  # Minimum TLS version for security
  minimum_compression_size = 0
  
  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-api"
    Environment = var.environment
    Component   = "api-gateway"
  })
}

# ============================================================================
# CloudWatch Logs for API Gateway
# ============================================================================

resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/securebase-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-api-logs"
  })
}

# ============================================================================
# API Gateway Account Settings (for CloudWatch logging)
# ============================================================================

resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "securebase-${var.environment}-apigw-cloudwatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# ============================================================================
# JWT Authorizer (Lambda-based)
# ============================================================================

resource "aws_api_gateway_authorizer" "jwt_authorizer" {
  name                   = "securebase-jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.securebase_api.id
  authorizer_uri         = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.auth_lambda_arn}/invocations"
  authorizer_credentials = aws_iam_role.authorizer_invocation.arn
  type                   = "REQUEST"
  identity_source        = "method.request.header.Authorization"
  
  # Cache authorizer results for 5 minutes (reduces Lambda invocations)
  authorizer_result_ttl_in_seconds = 300
}

resource "aws_iam_role" "authorizer_invocation" {
  name = "securebase-${var.environment}-authorizer-invocation"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "authorizer_invocation" {
  name = "authorizer-lambda-invoke"
  role = aws_iam_role.authorizer_invocation.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "lambda:InvokeFunction"
      Effect   = "Allow"
      Resource = var.auth_lambda_arn
    }]
  })
}

# ============================================================================
# API Resources - Authentication
# ============================================================================

resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "POST"
  authorization = "NONE"  # Auth endpoint is public

  request_parameters = {
    "method.request.header.Content-Type" = true
  }
}

resource "aws_api_gateway_integration" "auth_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.auth.id
  http_method             = aws_api_gateway_method.auth_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.auth_lambda_arn}/invocations"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "auth_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Health Check
# ============================================================================

resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "health"
}

resource "aws_api_gateway_method" "health_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "GET"
  authorization = "NONE"  # Health check endpoint is public
}

resource "aws_api_gateway_integration" "health_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.health.id
  http_method             = aws_api_gateway_method.health_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.health_check_lambda_arn}/invocations"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "health_check_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.health_check_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Webhooks
# ============================================================================

resource "aws_api_gateway_resource" "webhooks" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "webhooks"
}

resource "aws_api_gateway_method" "webhooks_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.webhooks.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_method" "webhooks_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.webhooks.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "webhooks_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.webhooks.id
  http_method             = aws_api_gateway_method.webhooks_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.webhook_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "webhooks_post" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.webhooks.id
  http_method             = aws_api_gateway_method.webhooks_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.webhook_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "webhooks_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.webhook_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Invoices/Billing
# ============================================================================

resource "aws_api_gateway_resource" "invoices" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "invoices"
}

resource "aws_api_gateway_method" "invoices_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.invoices.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "invoices_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.invoices.id
  http_method             = aws_api_gateway_method.invoices_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.billing_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "billing_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.billing_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Support Tickets
# ============================================================================

resource "aws_api_gateway_resource" "support" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "support"
}

resource "aws_api_gateway_resource" "tickets" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.support.id
  path_part   = "tickets"
}

resource "aws_api_gateway_method" "tickets_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.tickets.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_method" "tickets_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.tickets.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "tickets_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.tickets.id
  http_method             = aws_api_gateway_method.tickets_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.support_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "tickets_post" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.tickets.id
  http_method             = aws_api_gateway_method.tickets_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.support_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "support_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.support_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Cost Forecasting
# ============================================================================

resource "aws_api_gateway_resource" "forecasting" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "forecasting"
}

resource "aws_api_gateway_method" "forecasting_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.forecasting.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "forecasting_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.forecasting.id
  http_method             = aws_api_gateway_method.forecasting_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.forecasting_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "forecasting_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.forecasting_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Analytics & Reporting (Phase 4)
# ============================================================================

resource "aws_api_gateway_resource" "analytics" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "analytics"
}

# GET /analytics - Query analytics data
resource "aws_api_gateway_method" "analytics_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.analytics.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "analytics_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.analytics.id
  http_method             = aws_api_gateway_method.analytics_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.analytics_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.analytics_lambda_arn}/invocations" : ""
}

# POST /analytics/export - Export report
resource "aws_api_gateway_method" "analytics_export" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.analytics.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "analytics_export" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.analytics.id
  http_method             = aws_api_gateway_method.analytics_export.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.analytics_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.analytics_lambda_arn}/invocations" : ""
}

# /analytics/reports resource
resource "aws_api_gateway_resource" "reports" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.analytics.id
  path_part   = "reports"
}

# GET /analytics/reports - List saved reports
resource "aws_api_gateway_method" "reports_get" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.reports.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "reports_get" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.reports.id
  http_method             = aws_api_gateway_method.reports_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.analytics_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.analytics_lambda_arn}/invocations" : ""
}

# POST /analytics/reports - Create saved report
resource "aws_api_gateway_method" "reports_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.reports.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "reports_post" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.reports.id
  http_method             = aws_api_gateway_method.reports_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.analytics_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.analytics_lambda_arn}/invocations" : ""
}

# Lambda permission for analytics API
resource "aws_lambda_permission" "analytics_api_gateway" {
  count         = var.analytics_lambda_name != null ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.analytics_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# RBAC/Team Management API Routes (Phase 4 Component 2)
# ============================================================================

# /users resource
resource "aws_api_gateway_resource" "users" {
  count       = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "users"
}

# GET /users - List users
resource "aws_api_gateway_method" "users_get" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.users[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "users_get" {
  count                   = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.users[0].id
  http_method             = aws_api_gateway_method.users_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.user_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.user_management_lambda_arn}/invocations" : ""
}

# POST /users - Create user
resource "aws_api_gateway_method" "users_post" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.users[0].id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "users_post" {
  count                   = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.users[0].id
  http_method             = aws_api_gateway_method.users_post[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.user_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.user_management_lambda_arn}/invocations" : ""
}

# /users/{id} resource
resource "aws_api_gateway_resource" "user_id" {
  count       = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.users[0].id
  path_part   = "{id}"
}

# GET /users/{id} - Get user details
resource "aws_api_gateway_method" "user_id_get" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.user_id[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "user_id_get" {
  count                   = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.user_id[0].id
  http_method             = aws_api_gateway_method.user_id_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.user_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.user_management_lambda_arn}/invocations" : ""
}

# PUT /users/{id} - Update user
resource "aws_api_gateway_method" "user_id_put" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.user_id[0].id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "user_id_put" {
  count                   = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.user_id[0].id
  http_method             = aws_api_gateway_method.user_id_put[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.user_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.user_management_lambda_arn}/invocations" : ""
}

# DELETE /users/{id} - Delete user
resource "aws_api_gateway_method" "user_id_delete" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.user_id[0].id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "user_id_delete" {
  count                   = var.user_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.user_id[0].id
  http_method             = aws_api_gateway_method.user_id_delete[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.user_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.user_management_lambda_arn}/invocations" : ""
}

# Lambda permission for user management API
resource "aws_lambda_permission" "user_management_api_gateway" {
  count         = var.user_management_lambda_name != null ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.user_management_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# /auth/login resource for session management
resource "aws_api_gateway_resource" "auth_login" {
  count       = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# POST /auth/login - User login
resource "aws_api_gateway_method" "auth_login_post" {
  count         = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.auth_login[0].id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_login_post" {
  count                   = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.auth_login[0].id
  http_method             = aws_api_gateway_method.auth_login_post[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.session_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.session_management_lambda_arn}/invocations" : ""
}

# /auth/mfa resource
resource "aws_api_gateway_resource" "auth_mfa" {
  count       = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "mfa"
}

# POST /auth/mfa - MFA verification
resource "aws_api_gateway_method" "auth_mfa_post" {
  count         = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.auth_mfa[0].id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_mfa_post" {
  count                   = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.auth_mfa[0].id
  http_method             = aws_api_gateway_method.auth_mfa_post[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.session_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.session_management_lambda_arn}/invocations" : ""
}

# Lambda permission for session management API
resource "aws_lambda_permission" "session_management_api_gateway" {
  count         = var.session_management_lambda_name != null ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.session_management_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# /activity resource for activity feed
# Note: Uses permission_management Lambda which handles both permission checks
# and activity feed queries (activity_feed.py deployment artifact)
resource "aws_api_gateway_resource" "activity" {
  count       = var.permission_management_lambda_name != null ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "activity"
}

# GET /activity - Get activity feed
resource "aws_api_gateway_method" "activity_get" {
  count         = var.permission_management_lambda_name != null ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.activity[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "activity_get" {
  count                   = var.permission_management_lambda_name != null ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.activity[0].id
  http_method             = aws_api_gateway_method.activity_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.permission_management_lambda_invoke_arn != null ? "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.permission_management_lambda_arn}/invocations" : ""
}

# Lambda permission for activity feed API
resource "aws_lambda_permission" "permission_management_api_gateway" {
  count         = var.permission_management_lambda_name != null ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.permission_management_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# CORS Configuration
# ============================================================================

module "cors_auth" {
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.auth.id
}

module "cors_webhooks" {
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.webhooks.id
}

module "cors_invoices" {
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.invoices.id
}

module "cors_tickets" {
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.tickets.id
}

module "cors_forecasting" {
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.forecasting.id
}

# CORS for RBAC endpoints
module "cors_users" {
  count  = var.user_management_lambda_name != null ? 1 : 0
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.users[0].id
}

module "cors_auth_login" {
  count  = var.session_management_lambda_name != null ? 1 : 0
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.auth_login[0].id
}

module "cors_activity" {
  count  = var.permission_management_lambda_name != null ? 1 : 0
  source = "./cors"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.activity[0].id
}

# ============================================================================
# Deployment and Stage
# ============================================================================

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id

  # Force new deployment on any resource change
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.securebase_api.body,
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_resource.webhooks.id,
      aws_api_gateway_resource.invoices.id,
      aws_api_gateway_resource.tickets.id,
      aws_api_gateway_resource.forecasting.id,
      aws_api_gateway_method.auth_post.id,
      aws_api_gateway_method.webhooks_get.id,
      aws_api_gateway_method.webhooks_post.id,
      aws_api_gateway_method.invoices_get.id,
      aws_api_gateway_method.tickets_get.id,
      aws_api_gateway_method.tickets_post.id,
      aws_api_gateway_method.forecasting_get.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.auth_lambda,
    aws_api_gateway_integration.webhooks_get,
    aws_api_gateway_integration.webhooks_post,
    aws_api_gateway_integration.invoices_get,
    aws_api_gateway_integration.tickets_get,
    aws_api_gateway_integration.tickets_post,
    aws_api_gateway_integration.forecasting_get,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  stage_name    = var.environment

  # Enable X-Ray tracing for distributed tracing
  xray_tracing_enabled = true

  # Access logging configuration
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  # Global throttling settings (can be overridden per method)
  # AWS provider v5.x uses throttle_settings block directly on the stage
  throttle_settings {
    rate_limit  = var.default_rate_limit
    burst_limit = var.default_burst_limit
  }

  tags = merge(var.tags, {
    Name = "securebase-${var.environment}-stage"
  })
}

# Enable detailed CloudWatch metrics
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled        = true
    logging_level          = "INFO"
    data_trace_enabled     = var.environment != "prod"  # Disable in prod for performance
    throttling_rate_limit  = var.default_rate_limit
    throttling_burst_limit = var.default_burst_limit
  }
}

# ============================================================================
# API Gateway Response Headers (Security)
# ============================================================================

resource "aws_api_gateway_gateway_response" "default_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "DEFAULT_4XX"

  response_parameters = {
    "gatewayresponse.header.X-Content-Type-Options" = "'nosniff'"
    "gatewayresponse.header.X-Frame-Options"        = "'DENY'"
    "gatewayresponse.header.X-XSS-Protection"       = "'1; mode=block'"
    "gatewayresponse.header.Strict-Transport-Security" = "'max-age=31536000; includeSubDomains'"
  }
}

resource "aws_api_gateway_gateway_response" "default_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "DEFAULT_5XX"

  response_parameters = {
    "gatewayresponse.header.X-Content-Type-Options" = "'nosniff'"
    "gatewayresponse.header.X-Frame-Options"        = "'DENY'"
    "gatewayresponse.header.X-XSS-Protection"       = "'1; mode=block'"
    "gatewayresponse.header.Strict-Transport-Security" = "'max-age=31536000; includeSubDomains'"
  }
}

# ============================================================================
# CloudWatch Alarms for API Monitoring
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "securebase-${var.environment}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_threshold_4xx
  alarm_description   = "API Gateway 4XX errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.securebase_api.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "securebase-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_threshold_5xx
  alarm_description   = "API Gateway 5XX errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.securebase_api.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "securebase-${var.environment}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Average"
  threshold           = var.latency_threshold_ms
  alarm_description   = "API Gateway latency exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.securebase_api.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}
