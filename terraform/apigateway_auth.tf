# API Gateway routes for POST /auth and OPTIONS /auth (CORS preflight)

resource "aws_api_gateway_resource" "auth" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "auth_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.auth.id
  http_method             = aws_api_gateway_method.auth_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.auth_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "auth_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.auth.id
  http_method       = aws_api_gateway_method.auth_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "auth_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "auth_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  status_code = aws_api_gateway_method_response.auth_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.auth_options]
}

resource "aws_lambda_permission" "apigw_auth" {
  statement_id  = "AllowAPIGatewayAuth"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/auth"
}
