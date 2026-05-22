# Lambda Functions Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "lambda_packages" {
  description = "Map of Lambda function names to ZIP package paths"
  type        = map(string)
}

variable "jwt_secret_arn" {
  description = "ARN of JWT secret in Secrets Manager"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of DynamoDB table for auth"
  type        = string
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for database connections"
  type        = string
}

variable "database_name" {
  description = "Name of RDS database"
  type        = string
  default     = "securebase"
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Lambda VPC configuration"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  type        = string
}

variable "netlify_api_token" {
  description = "Netlify API token for site management"
  type        = string
  sensitive   = true
}

variable "lead_capture_allowed_origin" {
  description = "CORS allowed origin for the submit-lead Lambda (e.g. https://demo.securebase.tximhotep.com)"
  type        = string
  default     = "https://demo.securebase.tximhotep.com"
}

variable "lead_notification_webhook_url" {
  description = "Outbound webhook URL for lead notifications (Zapier, Make, n8n, etc.). Leave empty to disable."
  type        = string
  sensitive   = true
  default     = ""
}

variable "ses_identity_arn" {
  description = "ARN of the SES verified identity (domain or email) Lambdas are permitted to send from. Defaults to unrestricted if empty."
  type        = string
  default     = ""
}

variable "demo_auth_jwt_secret" {
  description = "JWT signing secret for the demo-auth Lambda. Store in Secrets Manager and pass via TF_VAR."
  type        = string
  sensitive   = true
}

variable "demo_auth_email" {
  description = "Demo login email accepted by the demo-auth Lambda"
  type        = string
  default     = "demo@securebase.tximhotep.com"
}

variable "demo_auth_password" {
  description = "Demo login password accepted by the demo-auth Lambda"
  type        = string
  sensitive   = true
}

variable "demo_auth_allowed_origin" {
  description = "CORS allowed origin for the demo-auth Lambda"
  type        = string
  default     = "https://demo.securebase.tximhotep.com"
}

variable "demo_auth_token_ttl_secs" {
  description = "JWT cookie lifetime in seconds for demo sessions (default 1 hour)"
  type        = number
  default     = 3600
}

variable "session_management_jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the JWT signing key for session_management Lambda"
  type        = string
  default     = ""
}

variable "session_management_cookie_domain" {
  description = "Cookie domain for session cookies (default: .tximhotep.com)"
  type        = string
  default     = ".tximhotep.com"
}

variable "session_management_allowed_origin" {
  description = "CORS allowed origin for the session_management Lambda"
  type        = string
  default     = "https://securebase.tximhotep.com"
}

variable "ceo_alert_email" {
  description = "Email address to receive customer activation alerts (invite_accepted and first_login events). Leave empty to skip the SNS email subscription."
  type        = string
  default     = ""
}
