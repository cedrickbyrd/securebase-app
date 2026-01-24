variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "database_endpoint" {
  description = "RDS Proxy endpoint for database connections"
  type        = string
}

variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "securebase"
}

variable "database_secret_arn" {
  description = "ARN of Secrets Manager secret containing database credentials"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of Secrets Manager secret containing JWT signing key"
  type        = string
}
