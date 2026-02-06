# Example Terraform configuration for using the demo-backend module
# Add this to your landing-zone/environments/dev/main.tf

module "demo_backend" {
  source = "../../modules/demo-backend"
  
  # Basic configuration
  project_name = "securebase"
  environment  = "demo"
  
  # JWT secret (change in production!)
  jwt_secret = "demo-secret-change-in-production-2026"
  
  # Automatic data population
  auto_populate_data = true
  
  # CloudWatch log retention
  log_retention_days = 7  # 7 days for demo, 30+ for production
  
  # Enable point-in-time recovery (adds cost)
  enable_point_in_time_recovery = false  # true for production
  
  # Tags
  tags = {
    Project     = "SecureBase"
    Environment = "Demo"
    ManagedBy   = "Terraform"
    CostCenter  = "Engineering"
  }
}

# Outputs
output "demo_backend_api_endpoint" {
  description = "Demo Backend API endpoint URL"
  value       = module.demo_backend.api_endpoint
}

output "demo_backend_health_check" {
  description = "Health check endpoint"
  value       = module.demo_backend.health_check_url
}

output "demo_backend_credentials" {
  description = "Demo customer login credentials"
  value       = module.demo_backend.demo_credentials
  sensitive   = true
}

output "demo_backend_test_commands" {
  description = "Example test commands"
  value       = module.demo_backend.test_commands
}

output "demo_backend_dynamodb_tables" {
  description = "DynamoDB table names"
  value       = module.demo_backend.dynamodb_tables
}
