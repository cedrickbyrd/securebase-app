# CORS Module for API Gateway with Credentials Support
# Enables preflight OPTIONS requests with security headers and cookie support

variable "api_id" {
  description = "API Gateway REST API ID"
  type        = string
}

variable "resource_id" {
  description = "API Gateway resource ID"
  type        = string
}

variable "allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = [
    "https://securebase.tximhotep.com",
    "https://www.securebase.tximhotep.com",
    "https://demo.securebase.tximhotep.com",
    "http://localhost:3000",
    "http://localhost:5173"
  ]
}

variable "allowed_methods" {
  description = "List of allowed HTTP methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
}

variable "allowed_headers" {
  description = "List of allowed request headers"
  type        = list(string)
  default     = [
    "Content-Type",
    "Authorization",
    "X-Amz-Date",
    "X-Api-Key",
    "X-Amz-Security-Token",
    "X-CSRF-Token",
    "Cookie"
  ]
}

variable "exposed_headers" {
  description = "List of headers to expose to the client"
  type        = list(string)
  default     = [
    "Set-Cookie",
    "X-CSRF-Token"
  ]
}

# OPTIONS method for CORS preflight
resource "aws_api_gateway_method" "options" {
  rest_api_id   = var.api_id
  resource_id   = var.resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Mock integration for OPTIONS
resource "aws_api_gateway_integration" "options" {
  rest_api_id = var.api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Method response for OPTIONS
resource "aws_api_gateway_method_response" "options" {
  rest_api_id = var.api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Expose-Headers"    = true
    "method.response.header.Access-Control-Max-Age"          = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

# Integration response for OPTIONS
resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = var.api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers"     = "'${join(",", var.allowed_headers)}'"
    "method.response.header.Access-Control-Allow-Methods"     = "'${join(",", var.allowed_methods)}'"
    # For credentials, we must use specific origins, not wildcards
    "method.response.header.Access-Control-Allow-Origin"      = "'https://securebase.tximhotep.com'"
    "method.response.header.Access-Control-Allow-Credentials" = "'true'"
    "method.response.header.Access-Control-Expose-Headers"    = "'${join(",", var.exposed_headers)}'"
    "method.response.header.Access-Control-Max-Age"          = "'7200'"
  }

  depends_on = [aws_api_gateway_integration.options]
}