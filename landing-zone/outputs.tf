output "netlify_observer_access_key" {
  description = "Access Key for Netlify Functions to read AWS Telemetry"
  value       = aws_iam_access_key.netlify_observer_keys.id
}

output "netlify_observer_secret_key" {
  description = "Secret Key for Netlify Functions (SENSITIVE)"
  value       = aws_iam_access_key.netlify_observer_keys.secret
  sensitive   = true
}

output "central_log_bucket" {
  value = module.central_logging.central_log_bucket_name
}

output "api_gateway_endpoint" {
  value = try(module.api_gateway.api_gateway_endpoint, "Not deployed")
}
