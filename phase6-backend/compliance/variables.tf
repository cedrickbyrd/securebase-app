variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "sns_topic_arn" {
  description = "ARN of the Phase 5 SNS alert topic to route alarm notifications to"
  type        = string
}

variable "score_recalculator_function_name" {
  description = "Lambda function name for compliance_score_recalculator (used for Invocations metric dimension)"
  type        = string
  default     = "securebase-prod-phase6-compliance-score-recalculator"
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
