# API Gateway routes for POST /marketplace/resolve and OPTIONS (CORS preflight)
# Called by AWS Marketplace auditor (server-to-server POST with x-amzn-marketplace-token)
# and by the portal MarketplaceRedirect.jsx component (browser POST via /api/marketplace/resolve proxy)

resource "aws_api_gateway_resource" "marketplace" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "marketplace"
}

resource "aws_api_gateway_resource" "marketplace_resolve" {
  rest_api_id = var.rest_api_id
  parent_id   = aws_api_gateway_resource.marketplace.id
  path_part   = "resolve"
}

resource "aws_api_gateway_method" "marketplace_resolve_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.marketplace_resolve.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "marketplace_resolve_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.marketplace_resolve.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "marketplace_resolve_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.marketplace_resolve.id
  http_method             = aws_api_gateway_method.marketplace_resolve_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.marketplace_resolve_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "marketplace_resolve_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.marketplace_resolve.id
  http_method       = aws_api_gateway_method.marketplace_resolve_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "marketplace_resolve_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.marketplace_resolve.id
  http_method = aws_api_gateway_method.marketplace_resolve_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "marketplace_resolve_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.marketplace_resolve.id
  http_method = aws_api_gateway_method.marketplace_resolve_options.http_method
  status_code = aws_api_gateway_method_response.marketplace_resolve_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,x-amzn-marketplace-token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://portal.securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.marketplace_resolve_options]
}

resource "aws_lambda_permission" "apigw_marketplace_resolve" {
  statement_id  = "AllowAPIGatewayMarketplaceResolve"
  action        = "lambda:InvokeFunction"
  function_name = var.marketplace_resolve_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/marketplace/resolve"
}
