# Terraform Onboarding Queue — Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "kms_key_arn" {
  description = "ARN of a customer-managed KMS key for SQS encryption. Leave empty to use the AWS-managed key (alias/aws/sqs)."
  type        = string
  default     = ""
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout in seconds. Must exceed the maximum expected terraform apply duration. Default: 900 (15 minutes)."
  type        = number
  default     = 900
}

variable "max_receive_count" {
  description = "Number of times a message can be received before being moved to the DLQ."
  type        = number
  default     = 3
}

variable "worker_lambda_function_name" {
  description = "Name (not ARN) of the Lambda function that processes onboarding queue messages. Leave empty to skip creating the event source mapping."
  type        = string
  default     = ""
}

variable "trigger_lambda_role_arn" {
  description = "IAM role ARN of the Lambda that sends messages to the queue (e.g., trigger_onboarding Lambda). Leave empty to grant the account root (useful when the role ARN is not yet known)."
  type        = string
  default     = ""
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN to notify when the DLQ receives messages. Leave empty to disable alerting."
  type        = string
  default     = ""
}
