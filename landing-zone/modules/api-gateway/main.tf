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

locals {
  # Single authoritative origin for gateway-level CORS responses.
  # Must be a specific origin (not *) because all portal requests use credentials: include.
  portal_cors_origin = var.portal_origin
  marketplace_enabled = var.marketplace_resolve_lambda_arn != null && var.marketplace_resolve_lambda_name != null
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
# FIX (naming mismatch): resource was previously named "login_post"; renamed
# to "auth_login_post" to clarify scope and avoid reference errors. All
# depends_on and triggers references have been updated accordingly.
resource "aws_api_gateway_method" "auth_login_post" {
  count                = var.session_management_lambda_name != null ? 1 : 0
  rest_api_id          = aws_api_gateway_rest_api.securebase_api.id
  resource_id          = aws_api_gateway_resource.auth_login[0].id
  http_method          = "POST"
  authorization        = "NONE"
  request_validator_id = aws_api_gateway_request_validator.full_validator.id
  request_models = {
    "application/json" = aws_api_gateway_model.login_model.name
  }
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

# Use enhanced CORS with credentials for auth endpoints
module "cors_auth" {
  source = "./cors-with-credentials"

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
  source = "./cors-with-credentials"

  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.users[0].id
}

module "cors_auth_login" {
  count  = var.session_management_lambda_name != null ? 1 : 0
  source = "./cors-with-credentials"

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
# Request Validation (Phase 4 Security Baseline)
# ============================================================================

resource "aws_api_gateway_request_validator" "full_validator" {
  name                        = "securebase-full-validator"
  rest_api_id                 = aws_api_gateway_rest_api.securebase_api.id
  validate_request_body       = true
  validate_request_parameters = true
}

resource "aws_api_gateway_model" "login_model" {
  rest_api_id  = aws_api_gateway_rest_api.securebase_api.id
  name         = "LoginModel"
  description  = "Schema for Phase 4 Login Validation"
  content_type = "application/json"

  schema = jsonencode({
    type = "object"
    required = ["email", "password"]
    properties = {
      email    = { type = "string" }
      password = { type = "string", minLength = 8 }
    }
  })
}

# ============================================================================
# Deployment and Stage 
# ============================================================================

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.auth_post.id,
      aws_api_gateway_integration.auth_lambda.id,
      try(aws_api_gateway_method.auth_login_post[0].id, null),
      try(aws_api_gateway_integration.auth_login_post[0].id, null),
      try(aws_lambda_permission.session_management_api_gateway[0].id, null),
      try(aws_api_gateway_method.marketplace_resolve_post[0].id, null),
      try(aws_api_gateway_integration.marketplace_resolve_post[0].id, null),
      try(aws_lambda_permission.marketplace_resolve_api_gateway[0].id, null),
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.auth_login_post,
    aws_api_gateway_integration.auth_lambda,
    aws_api_gateway_integration.marketplace_resolve_post
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  stage_name    = var.environment
  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format          = jsonencode({
      requestId = "$context.requestId",
      ip        = "$context.identity.sourceIp",
      caller    = "$context.identity.caller",
      user      = "$context.identity.user",
      tenantId  = "$context.authorizer.customer_id",
      requestTime = "$context.requestTime",
      httpMethod = "$context.httpMethod",
      resourcePath = "$context.resourcePath",
      status = "$context.status",
      protocol = "$context.protocol",
      responseLength = "$context.responseLength"
    })
  }
}

# ============================================================================
# API Gateway Response Headers (Security)
# ============================================================================

resource "aws_api_gateway_gateway_response" "cors_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "DEFAULT_4XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"      = "'${local.portal_cors_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers"     = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-CSRF-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods"     = "'GET,OPTIONS,POST,PUT,DELETE'"
    "gatewayresponse.header.Access-Control-Allow-Credentials" = "'true'"
  }
}

resource "aws_api_gateway_gateway_response" "cors_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "DEFAULT_5XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"      = "'${local.portal_cors_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers"     = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-CSRF-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods"     = "'GET,OPTIONS,POST,PUT,DELETE'"
    "gatewayresponse.header.Access-Control-Allow-Credentials" = "'true'"
  }
}

resource "aws_api_gateway_gateway_response" "cors_missing_auth_token" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "MISSING_AUTHENTICATION_TOKEN"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"      = "'${local.portal_cors_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers"     = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-CSRF-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods"     = "'GET,OPTIONS,POST,PUT,DELETE'"
    "gatewayresponse.header.Access-Control-Allow-Credentials" = "'true'"
  }
}

resource "aws_api_gateway_gateway_response" "cors_access_denied" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  response_type = "ACCESS_DENIED"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"      = "'${local.portal_cors_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers"     = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-CSRF-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods"     = "'GET,OPTIONS,POST,PUT,DELETE'"
    "gatewayresponse.header.Access-Control-Allow-Credentials" = "'true'"
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

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = "INFO"
    data_trace_enabled = false
    throttling_burst_limit = 500
    throttling_rate_limit  = 1000
  }
}

# Per-route throttle for marketplace/resolve — tighter limits to prevent abuse
resource "aws_api_gateway_method_settings" "marketplace_resolve_throttle" {
  count       = local.marketplace_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "marketplace/resolve/POST"

  settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 0.1667
    metrics_enabled        = true
    logging_level          = "INFO"
  }
}

# ============================================================================
# Per-Tenant Usage Plan and API Key
# ============================================================================

resource "aws_api_gateway_usage_plan" "per_tenant" {
  name        = "securebase-${var.environment}-per-tenant"
  description = "Per-tenant rate/burst throttle — 100 req/s, 200 burst"

  api_stages {
    api_id = aws_api_gateway_rest_api.securebase_api.id
    stage  = aws_api_gateway_stage.main.stage_name
  }

  throttle_settings {
    rate_limit  = var.default_rate_limit
    burst_limit = var.default_burst_limit
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-per-tenant-usage-plan"
    Environment = var.environment
    Component   = "api-gateway"
  })
}

resource "aws_api_gateway_rest_api_policy" "securebase_api_policy" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*"
      }
    ]
  })
}

# ============================================================================
# API Resources - AWS Marketplace Fulfillment (public)
# ============================================================================

resource "aws_api_gateway_resource" "marketplace" {
  count       = local.marketplace_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "marketplace"
}

resource "aws_api_gateway_resource" "marketplace_resolve" {
  count       = local.marketplace_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.marketplace[0].id
  path_part   = "resolve"
}

resource "aws_api_gateway_method" "marketplace_resolve_post" {
  count         = local.marketplace_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.marketplace_resolve[0].id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "marketplace_resolve_post" {
  count                   = local.marketplace_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.marketplace_resolve[0].id
  http_method             = aws_api_gateway_method.marketplace_resolve_post[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.marketplace_resolve_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "marketplace_resolve_api_gateway" {
  count         = local.marketplace_enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeMarketplaceResolve"
  action        = "lambda:InvokeFunction"
  function_name = var.marketplace_resolve_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Lead Capture (public, no auth required)
# ============================================================================

resource "aws_api_gateway_resource" "leads" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "leads"
}

resource "aws_api_gateway_method" "leads_options" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.leads.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "leads_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.leads.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "leads_options" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.leads.id
  http_method             = aws_api_gateway_method.leads_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.submit_lead_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "leads_post" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.leads.id
  http_method             = aws_api_gateway_method.leads_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.submit_lead_lambda_arn}/invocations"
}

resource "aws_lambda_permission" "leads_api_gateway" {
  statement_id  = "AllowAPIGatewayInvokeLeads"
  action        = "lambda:InvokeFunction"
  function_name = var.submit_lead_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Demo Auth (public, no JWT required — issues demo cookie)
# ============================================================================

resource "aws_api_gateway_resource" "demo_auth" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "demo-auth"
}

resource "aws_api_gateway_method" "demo_auth_post" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.demo_auth.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "demo_auth_post" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.demo_auth.id
  http_method             = aws_api_gateway_method.demo_auth_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.demo_auth_lambda_invoke_arn
}

resource "aws_api_gateway_method" "demo_auth_options" {
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.demo_auth.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "demo_auth_options" {
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.demo_auth.id
  http_method             = aws_api_gateway_method.demo_auth_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.demo_auth_lambda_invoke_arn
}

resource "aws_lambda_permission" "demo_auth_api_gateway" {
  statement_id  = "AllowAPIGatewayInvokeDemoAuth"
  action        = "lambda:InvokeFunction"
  function_name = var.demo_auth_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# API Resources - Phase 6 Compliance (Component 1–5)
# ============================================================================

resource "aws_api_gateway_resource" "compliance" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "compliance"
}

resource "aws_api_gateway_resource" "compliance_soc2" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "soc2"
}

resource "aws_api_gateway_resource" "compliance_soc2_collect" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_soc2.id
  path_part   = "collect"
}

resource "aws_api_gateway_resource" "compliance_soc2_export" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_soc2.id
  path_part   = "audit-export"
}

resource "aws_api_gateway_resource" "compliance_fedramp" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "fedramp"
}

resource "aws_api_gateway_resource" "compliance_fedramp_collect" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_fedramp.id
  path_part   = "collect"
}

resource "aws_api_gateway_resource" "compliance_export" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "export"
}

resource "aws_api_gateway_resource" "compliance_export_job" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_export.id
  path_part   = "{job_id}"
}

resource "aws_api_gateway_resource" "compliance_controls" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "controls"
}

resource "aws_api_gateway_resource" "compliance_controls_status" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_controls.id
  path_part   = "status"
}

resource "aws_api_gateway_resource" "compliance_controls_test" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_controls.id
  path_part   = "test"
}

resource "aws_api_gateway_resource" "compliance_vendors" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "vendors"
}

resource "aws_api_gateway_resource" "compliance_vendor_id" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_vendors.id
  path_part   = "{vendor_id}"
}

resource "aws_api_gateway_resource" "compliance_vendor_baa" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_vendor_id.id
  path_part   = "baa"
}

resource "aws_api_gateway_resource" "compliance_baa" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance.id
  path_part   = "baa"
}

resource "aws_api_gateway_resource" "compliance_baa_expiring" {
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.compliance_baa.id
  path_part   = "expiring"
}

module "cors_compliance_soc2_collect" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_soc2_collect.id
}

module "cors_compliance_soc2_export" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_soc2_export.id
}

module "cors_compliance_fedramp_collect" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_fedramp_collect.id
}

module "cors_compliance_export" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_export.id
}

module "cors_compliance_export_job" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_export_job.id
}

module "cors_compliance_controls_status" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_controls_status.id
}

module "cors_compliance_controls_test" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_controls_test.id
}

module "cors_compliance_vendors" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_vendors.id
}

module "cors_compliance_vendor_id" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_vendor_id.id
}

module "cors_compliance_vendor_baa" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_vendor_baa.id
}

module "cors_compliance_baa_expiring" {
  source      = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.compliance_baa_expiring.id
}

# ============================================================================
# API Resources - Phase 5.3 SRE Metrics (/sre/*)
# ============================================================================

locals {
  sre_enabled = var.sre_metrics_lambda_invoke_arn != null
}

resource "aws_api_gateway_resource" "sre" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "sre"
}

resource "aws_api_gateway_resource" "sre_infrastructure" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "infrastructure"
}

resource "aws_api_gateway_resource" "sre_deployments" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "deployments"
}

resource "aws_api_gateway_resource" "sre_scaling" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "scaling"
}

resource "aws_api_gateway_resource" "sre_database" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "database"
}

resource "aws_api_gateway_resource" "sre_cache" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "cache"
}

resource "aws_api_gateway_resource" "sre_errors" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "errors"
}

resource "aws_api_gateway_resource" "sre_lambda" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "lambda"
}

resource "aws_api_gateway_resource" "sre_costs" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "costs"
}

resource "aws_api_gateway_resource" "sre_health" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.sre[0].id
  path_part   = "health"
}

resource "aws_api_gateway_method" "sre_infrastructure_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_deployments_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_deployments[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_scaling_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_scaling[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_database_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_database[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_cache_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_cache[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_errors_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_errors[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_lambda_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_lambda[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_costs_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_costs[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sre_health_get" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_health[0].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_infrastructure_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method             = aws_api_gateway_method.sre_infrastructure_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_deployments_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_deployments[0].id
  http_method             = aws_api_gateway_method.sre_deployments_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_scaling_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_scaling[0].id
  http_method             = aws_api_gateway_method.sre_scaling_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_database_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_database[0].id
  http_method             = aws_api_gateway_method.sre_database_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_cache_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_cache[0].id
  http_method             = aws_api_gateway_method.sre_cache_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_errors_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_errors[0].id
  http_method             = aws_api_gateway_method.sre_errors_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_lambda_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_lambda[0].id
  http_method             = aws_api_gateway_method.sre_lambda_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_costs_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_costs[0].id
  http_method             = aws_api_gateway_method.sre_costs_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "sre_health_lambda" {
  count                   = local.sre_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.sre_health[0].id
  http_method             = aws_api_gateway_method.sre_health_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.sre_metrics_lambda_invoke_arn
}

resource "aws_api_gateway_method" "sre_infrastructure_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_infrastructure_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method = aws_api_gateway_method.sre_infrastructure_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_infrastructure_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method = aws_api_gateway_method.sre_infrastructure_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_infrastructure_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_infrastructure[0].id
  http_method = aws_api_gateway_method.sre_infrastructure_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_infrastructure_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_infrastructure_options]
}

resource "aws_api_gateway_method" "sre_deployments_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_deployments[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_deployments_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_deployments[0].id
  http_method = aws_api_gateway_method.sre_deployments_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_deployments_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_deployments[0].id
  http_method = aws_api_gateway_method.sre_deployments_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_deployments_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_deployments[0].id
  http_method = aws_api_gateway_method.sre_deployments_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_deployments_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_deployments_options]
}

resource "aws_api_gateway_method" "sre_scaling_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_scaling[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_scaling_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_scaling[0].id
  http_method = aws_api_gateway_method.sre_scaling_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_scaling_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_scaling[0].id
  http_method = aws_api_gateway_method.sre_scaling_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_scaling_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_scaling[0].id
  http_method = aws_api_gateway_method.sre_scaling_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_scaling_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_scaling_options]
}

resource "aws_api_gateway_method" "sre_database_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_database[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_database_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_database[0].id
  http_method = aws_api_gateway_method.sre_database_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_database_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_database[0].id
  http_method = aws_api_gateway_method.sre_database_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_database_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_database[0].id
  http_method = aws_api_gateway_method.sre_database_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_database_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_database_options]
}

resource "aws_api_gateway_method" "sre_cache_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_cache[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_cache_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_cache[0].id
  http_method = aws_api_gateway_method.sre_cache_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_cache_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_cache[0].id
  http_method = aws_api_gateway_method.sre_cache_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_cache_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_cache[0].id
  http_method = aws_api_gateway_method.sre_cache_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_cache_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_cache_options]
}

resource "aws_api_gateway_method" "sre_errors_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_errors[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_errors_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_errors[0].id
  http_method = aws_api_gateway_method.sre_errors_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_errors_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_errors[0].id
  http_method = aws_api_gateway_method.sre_errors_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_errors_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_errors[0].id
  http_method = aws_api_gateway_method.sre_errors_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_errors_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_errors_options]
}

resource "aws_api_gateway_method" "sre_lambda_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_lambda[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_lambda_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_lambda[0].id
  http_method = aws_api_gateway_method.sre_lambda_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_lambda_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_lambda[0].id
  http_method = aws_api_gateway_method.sre_lambda_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_lambda_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_lambda[0].id
  http_method = aws_api_gateway_method.sre_lambda_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_lambda_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_lambda_options]
}

resource "aws_api_gateway_method" "sre_costs_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_costs[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_costs_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_costs[0].id
  http_method = aws_api_gateway_method.sre_costs_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_costs_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_costs[0].id
  http_method = aws_api_gateway_method.sre_costs_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_costs_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_costs[0].id
  http_method = aws_api_gateway_method.sre_costs_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_costs_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_costs_options]
}

resource "aws_api_gateway_method" "sre_health_options" {
  count         = local.sre_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.sre_health[0].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "sre_health_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_health[0].id
  http_method = aws_api_gateway_method.sre_health_options[0].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "sre_health_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_health[0].id
  http_method = aws_api_gateway_method.sre_health_options[0].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "sre_health_options" {
  count       = local.sre_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.sre_health[0].id
  http_method = aws_api_gateway_method.sre_health_options[0].http_method
  status_code = aws_api_gateway_method_response.sre_health_options[0].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.sre_health_options]
}

resource "aws_lambda_permission" "sre_metrics_api_gateway" {
  count         = local.sre_enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeSREMetrics"
  action        = "lambda:InvokeFunction"
  function_name = var.sre_metrics_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}
