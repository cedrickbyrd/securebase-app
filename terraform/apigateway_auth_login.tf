# API Gateway Resource Tree: /auth/login
#
# Restructures the resource path so the frontend's expected route
# (/auth/login) matches the actual API Gateway resource hierarchy.

# /auth parent resource
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = "9xyetu7zq3"
  parent_id   = "7q9sggej19" # Root (/) resource ID
  path_part   = "auth"
}

# /login child resource (nested under /auth)
resource "aws_api_gateway_resource" "login" {
  rest_api_id = "9xyetu7zq3"
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# POST /auth/login method
resource "aws_api_gateway_method" "login_post" {
  rest_api_id   = "9xyetu7zq3"
  resource_id   = aws_api_gateway_resource.login.id
  http_method   = "POST"
  authorization = "NONE"
}

# Lambda proxy integration for POST /auth/login
resource "aws_api_gateway_integration" "login_integration" {
  rest_api_id             = "9xyetu7zq3"
  resource_id             = aws_api_gateway_resource.login.id
  http_method             = aws_api_gateway_method.login_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:731184206915:function:prod-securebase-api/invocations"
}
