# API Gateway routes for POST /checkout and OPTIONS /checkout (CORS preflight)
#
# Required tfvars:
#   checkout_lambda_arn  = "arn:aws:lambda:..."
#   checkout_lambda_name = "securebase-create-checkout-session"

resource "aws_api_gateway_resource" "checkout" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "checkout"
}

resource "aws_api_gateway_method" "checkout_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.checkout.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "checkout_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.checkout.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "checkout_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.checkout.id
  http_method             = aws_api_gateway_method.checkout_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.checkout_lambda_arn}/invocations"
}

resource "aws_api_gateway_integration" "checkout_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.checkout.id
  http_method       = aws_api_gateway_method.checkout_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "checkout_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.checkout.id
  http_method = aws_api_gateway_method.checkout_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "checkout_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.checkout.id
  http_method = aws_api_gateway_method.checkout_options.http_method
  status_code = aws_api_gateway_method_response.checkout_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.checkout_options]
}

resource "aws_lambda_permission" "apigw_checkout" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.checkout_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/checkout"
}
