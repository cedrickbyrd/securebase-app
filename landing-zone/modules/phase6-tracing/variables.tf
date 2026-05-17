variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region where observability resources are provisioned"
  type        = string
  default     = "us-east-1"
}

variable "api_gateway_name" {
  description = "API Gateway name dimension for AWS/ApiGateway metrics"
  type        = string
}

variable "api_gateway_stage" {
  description = "API Gateway stage dimension for AWS/ApiGateway metrics"
  type        = string
}

variable "api_gateway_log_group_name" {
  description = "CloudWatch log group used by API Gateway access logs"
  type        = string
  default     = null
}

variable "sns_topic_arn" {
  description = "Existing SNS topic ARN used for anomaly alarm actions"
  type        = string
}

variable "lambda_function_names" {
  description = "Lambda functions to monitor for p99 duration and error-rate anomalies"
  type        = list(string)
}

variable "lambda_execution_role_names" {
  description = "Lambda IAM role names that should receive Lambda Insights permissions"
  type        = list(string)
  default     = []
}

variable "xray_tenant_filters" {
  description = "Map of X-Ray tenant segment group name suffix => filter expression"
  type        = map(string)
  default = {
    tenant = "http.url CONTAINS \"/tenant/\""
    admin  = "http.url CONTAINS \"/admin/\""
  }
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
