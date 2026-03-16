variable "api_stage_name" {
  description = "Name of the API Gateway stage to deploy to (e.g. prod, dev)"
  type        = string
  default     = "prod"
}
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = var.rest_api_id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth_login,
      aws_api_gateway_method.auth_login_post,
      aws_api_gateway_integration.auth_login,
      aws_lambda_permission.apigw_auth_login,
      aws_api_gateway_resource.signup,
      aws_api_gateway_method.signup_post,
      aws_api_gateway_integration.signup_post,
      aws_lambda_permission.apigw_signup,
      aws_api_gateway_resource.verify_email,
      aws_api_gateway_method.verify_email_post,
      aws_api_gateway_integration.verify_email_post,
      aws_lambda_permission.apigw_verify_email,
      aws_api_gateway_resource.onboarding_status,
      aws_api_gateway_method.onboarding_status_get,
      aws_api_gateway_integration.onboarding_status_get,
      aws_lambda_permission.apigw_onboarding_status,
    ]))
  }
  lifecycle { create_before_destroy = true }
  depends_on = [
    aws_api_gateway_method.auth_login_post,
    aws_api_gateway_integration.auth_login,
    aws_api_gateway_method.signup_post,
    aws_api_gateway_integration.signup_post,
    aws_api_gateway_method.verify_email_post,
    aws_api_gateway_integration.verify_email_post,
    aws_api_gateway_method.onboarding_status_get,
    aws_api_gateway_integration.onboarding_status_get,
  ]
}
resource "aws_api_gateway_stage" "main" {
  rest_api_id   = var.rest_api_id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = var.api_stage_name
}