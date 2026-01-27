# API Gateway Integration for Analytics Endpoints
# Phase 4 - Advanced Analytics

# Analytics API Gateway Routes (if API Gateway ID is provided)
# These integrate with existing API Gateway from Phase 2

# GET /analytics/usage - Usage analytics endpoint
resource "aws_apigatewayv2_route" "get_usage" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "GET /analytics/usage"
  target    = "integrations/${aws_apigatewayv2_integration.analytics_query[0].id}"

  authorization_type = "JWT"
  authorizer_id      = var.api_authorizer_id
}

# GET /analytics/compliance - Compliance analytics endpoint
resource "aws_apigatewayv2_route" "get_compliance" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "GET /analytics/compliance"
  target    = "integrations/${aws_apigatewayv2_integration.analytics_query[0].id}"

  authorization_type = "JWT"
  authorizer_id      = var.api_authorizer_id
}

# GET /analytics/costs - Cost analytics endpoint
resource "aws_apigatewayv2_route" "get_costs" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "GET /analytics/costs"
  target    = "integrations/${aws_apigatewayv2_integration.analytics_query[0].id}"

  authorization_type = "JWT"
  authorizer_id      = var.api_authorizer_id
}

# POST /analytics/reports - Generate custom report
resource "aws_apigatewayv2_route" "post_reports" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "POST /analytics/reports"
  target    = "integrations/${aws_apigatewayv2_integration.analytics_reporter[0].id}"

  authorization_type = "JWT"
  authorizer_id      = var.api_authorizer_id
}

# Lambda Integration for Query Endpoints
resource "aws_apigatewayv2_integration" "analytics_query" {
  count              = var.api_gateway_id != null ? 1 : 0
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.analytics_query.invoke_arn

  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

# Lambda Integration for Reporter Endpoints
resource "aws_apigatewayv2_integration" "analytics_reporter" {
  count              = var.api_gateway_id != null ? 1 : 0
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.analytics_reporter.invoke_arn

  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

# CORS Configuration for Analytics Endpoints
resource "aws_apigatewayv2_route" "options_analytics_usage" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "OPTIONS /analytics/usage"
  target    = "integrations/${aws_apigatewayv2_integration.cors_options[0].id}"
}

resource "aws_apigatewayv2_route" "options_analytics_compliance" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "OPTIONS /analytics/compliance"
  target    = "integrations/${aws_apigatewayv2_integration.cors_options[0].id}"
}

resource "aws_apigatewayv2_route" "options_analytics_costs" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "OPTIONS /analytics/costs"
  target    = "integrations/${aws_apigatewayv2_integration.cors_options[0].id}"
}

resource "aws_apigatewayv2_route" "options_analytics_reports" {
  count     = var.api_gateway_id != null ? 1 : 0
  api_id    = var.api_gateway_id
  route_key = "OPTIONS /analytics/reports"
  target    = "integrations/${aws_apigatewayv2_integration.cors_options[0].id}"
}

# CORS Mock Integration
resource "aws_apigatewayv2_integration" "cors_options" {
  count            = var.api_gateway_id != null ? 1 : 0
  api_id           = var.api_gateway_id
  integration_type = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }

  payload_format_version = "1.0"
}

# Outputs for API endpoints
output "api_endpoints" {
  description = "Analytics API endpoints"
  value = var.api_gateway_id != null ? {
    usage      = "GET ${var.api_gateway_url}/analytics/usage"
    compliance = "GET ${var.api_gateway_url}/analytics/compliance"
    costs      = "GET ${var.api_gateway_url}/analytics/costs"
    reports    = "POST ${var.api_gateway_url}/analytics/reports"
  } : null
}
