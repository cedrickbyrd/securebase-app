variable "api_stage_name" {
  description = "Name of the API Gateway stage to deploy to (e.g. prod, dev)"
  type        = string
  default     = "prod"
}
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = var.rest_api_id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth,
      aws_api_gateway_method.auth_post,
      aws_api_gateway_integration.auth_post,
      aws_api_gateway_method.auth_options,
      aws_api_gateway_integration.auth_options,
      aws_api_gateway_method_response.auth_options_200,
      aws_api_gateway_integration_response.auth_options,
      aws_lambda_permission.apigw_auth,
      aws_api_gateway_resource.marketplace,
      aws_api_gateway_resource.marketplace_resolve,
      aws_api_gateway_method.marketplace_resolve_post,
      aws_api_gateway_integration.marketplace_resolve_post,
      aws_api_gateway_method.marketplace_resolve_options,
      aws_api_gateway_integration.marketplace_resolve_options,
      aws_api_gateway_method_response.marketplace_resolve_options_200,
      aws_api_gateway_integration_response.marketplace_resolve_options,
      aws_lambda_permission.apigw_marketplace_resolve,
    ]))
  }
  lifecycle { create_before_destroy = true }
  depends_on = [
    aws_api_gateway_method.auth_post,
    aws_api_gateway_integration.auth_post,
    aws_api_gateway_method.auth_options,
    aws_api_gateway_integration.auth_options,
    aws_api_gateway_method_response.auth_options_200,
    aws_api_gateway_integration_response.auth_options,
    aws_api_gateway_method.marketplace_resolve_post,
    aws_api_gateway_integration.marketplace_resolve_post,
    aws_api_gateway_method.marketplace_resolve_options,
    aws_api_gateway_integration.marketplace_resolve_options,
    aws_api_gateway_method_response.marketplace_resolve_options_200,
    aws_api_gateway_integration_response.marketplace_resolve_options,
    aws_lambda_permission.apigw_marketplace_resolve,
  ]
}
resource "aws_api_gateway_stage" "main" {
  rest_api_id   = var.rest_api_id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = var.api_stage_name
}
