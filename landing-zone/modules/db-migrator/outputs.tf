output "function_name" { value = aws_lambda_function.migrator.function_name }
output "function_arn"  { value = aws_lambda_function.migrator.arn }
output "role_arn"      { value = aws_iam_role.migrator.arn }
