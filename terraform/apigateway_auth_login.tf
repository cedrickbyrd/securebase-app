# API Gateway Resource Tree: /auth/login
#
# Restructures the resource path so the frontend's expected route
# (/auth/login) matches the actual API Gateway resource hierarchy.
#
# Terraform 1.5+ import blocks: bring existing AWS resources under IaC
# management without recreating them.
#
# IDs are in the format <rest_api_id>/<resource_id> (and
# <rest_api_id>/<resource_id>/<http_method> for methods/integrations),
# obtained from the AWS Console for REST API 9xyetu7zq3.
#
# NOTE: These import blocks are only needed for the initial `terraform apply`
# that adopts the existing resources into state. Once the apply succeeds,
# these blocks can be removed from the configuration.

# /auth parent resource (resource ID: sfrsaw)
import {
  to = aws_api_gateway_resource.auth
  id = "9xyetu7zq3/sfrsaw"
}

# /login child resource (resource ID: ogsr28)
import {
  to = aws_api_gateway_resource.login
  id = "9xyetu7zq3/ogsr28"
}

# POST method on /login
import {
  to = aws_api_gateway_method.login_post
  id = "9xyetu7zq3/ogsr28/POST"
}

# Lambda proxy integration for POST /auth/login
import {
  to = aws_api_gateway_integration.login_integration
  id = "9xyetu7zq3/ogsr28/POST"
}

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
