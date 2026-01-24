# DynamoDB Table Outputs
output "user_sessions_table_name" {
  description = "DynamoDB user sessions table name"
  value       = aws_dynamodb_table.user_sessions.name
}

output "user_sessions_table_arn" {
  description = "DynamoDB user sessions table ARN"
  value       = aws_dynamodb_table.user_sessions.arn
}

output "user_invites_table_name" {
  description = "DynamoDB user invites table name"
  value       = aws_dynamodb_table.user_invites.name
}

output "user_invites_table_arn" {
  description = "DynamoDB user invites table ARN"
  value       = aws_dynamodb_table.user_invites.arn
}

output "activity_feed_table_name" {
  description = "DynamoDB activity feed table name"
  value       = aws_dynamodb_table.activity_feed.name
}

output "activity_feed_table_arn" {
  description = "DynamoDB activity feed table ARN"
  value       = aws_dynamodb_table.activity_feed.arn
}

# Lambda Function Outputs
output "user_management_function_name" {
  description = "Lambda function name for user management"
  value       = aws_lambda_function.user_management.function_name
}

output "user_management_function_arn" {
  description = "Lambda function ARN for user management"
  value       = aws_lambda_function.user_management.arn
}

output "user_management_invoke_arn" {
  description = "Lambda function invoke ARN for API Gateway"
  value       = aws_lambda_function.user_management.invoke_arn
}

output "session_management_function_name" {
  description = "Lambda function name for session management"
  value       = aws_lambda_function.session_management.function_name
}

output "session_management_function_arn" {
  description = "Lambda function ARN for session management"
  value       = aws_lambda_function.session_management.arn
}

output "session_management_invoke_arn" {
  description = "Lambda function invoke ARN for API Gateway"
  value       = aws_lambda_function.session_management.invoke_arn
}

output "permission_management_function_name" {
  description = "Lambda function name for permission management"
  value       = aws_lambda_function.permission_management.function_name
}

output "permission_management_function_arn" {
  description = "Lambda function ARN for permission management"
  value       = aws_lambda_function.permission_management.arn
}

output "permission_management_invoke_arn" {
  description = "Lambda function invoke ARN for API Gateway"
  value       = aws_lambda_function.permission_management.invoke_arn
}
