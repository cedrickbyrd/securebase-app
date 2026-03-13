# Phase 3B: API Gateway /auth/login resource and Lambda integration
#
# NOTE: rest_api_id and auth_parent_resource_id are passed as variables
# because this workspace manages incremental additions to an existing API
# Gateway that is NOT owned by this workspace.  Supply the IDs captured from
# the AWS console (or from the landing-zone workspace output) as tfvars:
#
#   rest_api_id             = "9xyetu7zq3"  (SecureBase API Gateway)
#   auth_parent_resource_id = "7q9sggej19"  (existing /auth resource ID)

# /auth/login resource
resource "aws_api_gateway_resource" "auth_login" {
  rest_api_id = var.rest_api_id
  parent_id   = var.auth_parent_resource_id
  path_part   = "login"
}

# POST /auth/login – public endpoint (no authorizer)
resource "aws_api_gateway_method" "auth_login_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "POST"
  authorization = "NONE"
}

# Lambda Proxy integration
resource "aws_api_gateway_integration" "auth_login" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.auth_login.id
  http_method             = aws_api_gateway_method.auth_login_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.auth_lambda_arn}/invocations"
}

# Grant API Gateway permission to invoke the auth Lambda.
# Without this resource-based policy, API Gateway cannot call the function
# and returns a 502 Internal Server Error to the caller.
# source_arn is scoped to POST /auth/login only (principle of least privilege).
resource "aws_lambda_permission" "apigw_auth_login" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/POST/auth/login"
}

# Caller identity is needed to build the source_arn above
data "aws_caller_identity" "current" {}
