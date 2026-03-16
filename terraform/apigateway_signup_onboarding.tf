# Phase 3C: API Gateway routes for self-service signup & onboarding
#
# Adds three new routes to the existing SecureBase API Gateway:
#   POST /signup                – customer self-registration
#   POST /verify-email          – email verification + provisioner trigger
#   GET  /onboarding/status     – provisioning progress polling
#
# Required tfvars (add to your terraform.tfvars):
#   signup_lambda_arn          = "arn:aws:lambda:..."
#   signup_lambda_name         = "securebase-signup-handler"
#   verify_email_lambda_arn    = "arn:aws:lambda:..."
#   verify_email_lambda_name   = "securebase-verify-email"
#   onboarding_lambda_arn      = "arn:aws:lambda:..."
#   onboarding_lambda_name     = "securebase-onboarding-status"
#   root_resource_id           = "<root / resource ID from AWS console>"

resource "aws_api_gateway_resource" "signup" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "signup"
}
resource "aws_api_gateway_method" "signup_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.signup.id
  http_method   = "POST"
  authorization = "NONE"
}
resource "aws_api_gateway_method" "signup_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.signup.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "signup_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.signup.id
  http_method             = aws_api_gateway_method.signup_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.signup_lambda_arn}/invocations"
}
resource "aws_api_gateway_integration" "signup_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.signup.id
  http_method       = aws_api_gateway_method.signup_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}
resource "aws_api_gateway_method_response" "signup_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.signup.id
  http_method = aws_api_gateway_method.signup_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}
resource "aws_api_gateway_integration_response" "signup_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.signup.id
  http_method = aws_api_gateway_method.signup_options.http_method
  status_code = aws_api_gateway_method_response.signup_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.signup_options]
}
resource "aws_lambda_permission" "apigw_signup" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.signup_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/signup"
}

resource "aws_api_gateway_resource" "verify_email" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "verify-email"
}
resource "aws_api_gateway_method" "verify_email_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.verify_email.id
  http_method   = "POST"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "verify_email_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.verify_email.id
  http_method             = aws_api_gateway_method.verify_email_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.verify_email_lambda_arn}/invocations"
}
resource "aws_lambda_permission" "apigw_verify_email" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.verify_email_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/verify-email"
}

resource "aws_api_gateway_resource" "onboarding" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "onboarding"
}
resource "aws_api_gateway_resource" "onboarding_status" {
  rest_api_id = var.rest_api_id
  parent_id   = aws_api_gateway_resource.onboarding.id
  path_part   = "status"
}
resource "aws_api_gateway_method" "onboarding_status_get" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.onboarding_status.id
  http_method   = "GET"
  authorization = "NONE"
  request_parameters = { "method.request.querystring.jobId" = true }
}
resource "aws_api_gateway_integration" "onboarding_status_get" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.onboarding_status.id
  http_method             = aws_api_gateway_method.onboarding_status_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.onboarding_lambda_arn}/invocations"
}
resource "aws_lambda_permission" "apigw_onboarding_status" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.onboarding_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/GET/onboarding/status"
}