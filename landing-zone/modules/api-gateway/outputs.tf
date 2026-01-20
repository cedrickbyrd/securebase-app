# API Gateway Module Outputs

output "api_gateway_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.securebase_api.id
}

output "api_gateway_arn" {
  description = "ARN of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.securebase_api.arn
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway (for Lambda permissions)"
  value       = aws_api_gateway_rest_api.securebase_api.execution_arn
}

output "api_gateway_endpoint" {
  description = "Base URL for API Gateway stage"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "api_gateway_stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_stage.main.stage_name
}

output "api_gateway_deployment_id" {
  description = "ID of the API Gateway deployment"
  value       = aws_api_gateway_deployment.main.id
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for API Gateway logs"
  value       = aws_cloudwatch_log_group.api_gateway_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for API Gateway logs"
  value       = aws_cloudwatch_log_group.api_gateway_logs.arn
}

output "authorizer_id" {
  description = "ID of the JWT authorizer"
  value       = aws_api_gateway_authorizer.jwt_authorizer.id
}

output "api_endpoints" {
  description = "Map of API endpoints"
  value = {
    auth        = "${aws_api_gateway_stage.main.invoke_url}/auth"
    webhooks    = "${aws_api_gateway_stage.main.invoke_url}/webhooks"
    invoices    = "${aws_api_gateway_stage.main.invoke_url}/invoices"
    support     = "${aws_api_gateway_stage.main.invoke_url}/support/tickets"
    forecasting = "${aws_api_gateway_stage.main.invoke_url}/forecasting"
  }
}
