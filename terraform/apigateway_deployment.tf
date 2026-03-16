# API Gateway Deployment and Stage
#
# A new deployment snapshot is created automatically whenever the /auth/login
# resource, method, or integration changes (via the sha1 trigger).  The stage
# is then updated to point to the latest deployment.
#
# NOTE: If the target stage already exists outside of this workspace, import
# it before running `terraform apply`:
#
#   terraform import aws_api_gateway_stage.main \
#     <rest_api_id>/<stage_name>
#
# e.g.
#   terraform import aws_api_gateway_stage.main 9xyetu7zq3/prod

variable "api_stage_name" {
  description = "Name of the API Gateway stage to deploy to (e.g. prod, dev)"
  type        = string
  default     = "prod"
}

# Deployment snapshot – recreated whenever auth/login resources change.
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = var.rest_api_id

  # Changing any of the managed resources forces a new deployment so the
  # live stage is always in sync with the Terraform-managed configuration.
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth_login,
      aws_api_gateway_method.auth_login_post,
      aws_api_gateway_integration.auth_login,
      aws_lambda_permission.apigw_auth_login,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_method.auth_login_post,
    aws_api_gateway_integration.auth_login,
  ]
}

# Stage – points to the latest deployment.
resource "aws_api_gateway_stage" "main" {
  rest_api_id   = var.rest_api_id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = var.api_stage_name
}
