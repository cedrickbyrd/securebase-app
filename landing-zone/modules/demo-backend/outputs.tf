output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_api_gateway_stage.demo.invoke_url
}

output "api_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.demo_api.id
}

output "lambda_functions" {
  description = "Lambda function ARNs"
  value = {
    auth      = aws_lambda_function.auth.arn
    customers = aws_lambda_function.customers.arn
    invoices  = aws_lambda_function.invoices.arn
    metrics   = aws_lambda_function.metrics.arn
    health    = aws_lambda_function.health.arn
  }
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    customers = aws_dynamodb_table.customers.name
    invoices  = aws_dynamodb_table.invoices.name
    metrics   = aws_dynamodb_table.metrics.name
  }
}

output "health_check_url" {
  description = "Health check endpoint"
  value       = "${aws_api_gateway_stage.demo.invoke_url}/health"
}

output "demo_credentials" {
  description = "Demo customer login credentials"
  value = {
    customer_1 = {
      email    = "admin@healthcorp.example.com"
      password = "demo-healthcare-2026"
      name     = "HealthCorp Medical Systems"
    }
    customer_2 = {
      email    = "admin@fintechai.example.com"
      password = "demo-fintech-2026"
      name     = "FinTechAI Analytics"
    }
    customer_3 = {
      email    = "admin@startupmvp.example.com"
      password = "demo-standard-2026"
      name     = "StartupMVP Inc"
    }
    customer_4 = {
      email    = "admin@govcontractor.example.com"
      password = "demo-government-2026"
      name     = "GovContractor Defense Solutions"
    }
    customer_5 = {
      email    = "admin@saasplatform.example.com"
      password = "demo-fintech2-2026"
      name     = "SaaSPlatform Cloud Services"
    }
  }
  sensitive = true
}

output "test_commands" {
  description = "Example API test commands"
  value = {
    health_check = "curl ${aws_api_gateway_stage.demo.invoke_url}/health"
    login        = "curl -X POST ${aws_api_gateway_stage.demo.invoke_url}/auth -H 'Content-Type: application/json' -d '{\"action\":\"login\",\"email\":\"admin@healthcorp.example.com\",\"password\":\"demo-healthcare-2026\"}'"
    get_metrics  = "curl ${aws_api_gateway_stage.demo.invoke_url}/metrics -H 'Authorization: Bearer YOUR_TOKEN'"
  }
}
