variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for RDS placement"
  type        = string
}

variable "database_subnets" {
  description = "Database subnet IDs (must be in different AZs)"
  type        = list(string)
}

variable "lambda_subnets" {
  description = "Lambda execution subnets"
  type        = list(string)
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

variable "max_aurora_capacity" {
  description = "Maximum Aurora Serverless v2 capacity (ACUs)"
  type        = number
  default     = 4
}

variable "min_aurora_capacity" {
  description = "Minimum Aurora Serverless v2 capacity (ACUs)"
  type        = number
  default     = 0.5
}

variable "rds_backup_retention" {
  description = "RDS backup retention period (days)"
  type        = number
  default     = 35
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
}
