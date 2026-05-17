variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "sns_topic_arn" {
  description = "ARN of the Phase 5 SNS alert topic to route alarm notifications to"
  type        = string
}

variable "packager_function_name" {
  description = "Lambda function name for the audit_log_packager (used for Errors metric dimension)"
  type        = string
  default     = "securebase-prod-audit-log-packager"
}

variable "packager_log_group" {
  description = "CloudWatch Logs log group for the audit_log_packager Lambda (used for metric filter)"
  type        = string
  default     = "/aws/lambda/securebase-prod-audit-log-packager"
}

variable "score_recalculator_function_name" {
  description = "Lambda function name for compliance_score_recalculator"
  type        = string
  default     = "securebase-prod-phase6-compliance-score-recalculator"
}

variable "score_recalculator_log_group" {
  description = "CloudWatch Logs log group for compliance_score_recalculator"
  type        = string
  default     = "/aws/lambda/securebase-prod-phase6-compliance-score-recalculator"
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
