# API Gateway Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for API Gateway deployment"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================================================
# Lambda Function ARNs and Names
# ============================================================================

variable "auth_lambda_arn" {
  description = "ARN of the authentication Lambda function"
  type        = string
}

variable "auth_lambda_name" {
  description = "Name of the authentication Lambda function"
  type        = string
}

variable "health_check_lambda_arn" {
  description = "ARN of the health check Lambda function"
  type        = string
}

variable "health_check_lambda_name" {
  description = "Name of the health check Lambda function"
  type        = string
}

variable "webhook_lambda_arn" {
  description = "ARN of the webhook manager Lambda function"
  type        = string
}

variable "webhook_lambda_name" {
  description = "Name of the webhook manager Lambda function"
  type        = string
}

variable "billing_lambda_arn" {
  description = "ARN of the billing worker Lambda function"
  type        = string
}

variable "billing_lambda_name" {
  description = "Name of the billing worker Lambda function"
  type        = string
}

variable "support_lambda_arn" {
  description = "ARN of the support tickets Lambda function"
  type        = string
}

variable "support_lambda_name" {
  description = "Name of the support tickets Lambda function"
  type        = string
}

variable "forecasting_lambda_arn" {
  description = "ARN of the cost forecasting Lambda function"
  type        = string
}

variable "forecasting_lambda_name" {
  description = "Name of the cost forecasting Lambda function"
  type        = string
}

variable "analytics_lambda_arn" {
  description = "ARN of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

variable "analytics_lambda_name" {
  description = "Name of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

variable "analytics_lambda_invoke_arn" {
  description = "Invoke ARN of the analytics/reporting Lambda function"
  type        = string
  default     = null
}

# RBAC Lambda Functions (Phase 4 Component 2)

variable "user_management_lambda_arn" {
  type    = string
  default = null
}

variable "user_management_lambda_name" {
  type    = string
  default = null
}

variable "user_management_lambda_invoke_arn" {
  type    = string
  default = null
}

variable "session_management_lambda_arn" {
  type    = string
  default = null
}

variable "session_management_lambda_name" {
  type    = string
  default = null
}

variable "session_management_lambda_invoke_arn" {
  type    = string
  default = null
}

variable "permission_management_lambda_arn" {
  type    = string
  default = null
}

variable "permission_management_lambda_name" {
  type    = string
  default = null
}

variable "permission_management_lambda_invoke_arn" {
  type    = string
  default = null
}

# ============================================================================
# Security and Performance Settings
# ============================================================================

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "default_rate_limit" {
  type    = number
  default = 100
}

variable "default_burst_limit" {
  type    = number
  default = 200
}

variable "error_threshold_4xx" {
  type    = number
  default = 100
}

variable "error_threshold_5xx" {
  type    = number
  default = 10
}

variable "latency_threshold_ms" {
  type    = number
  default = 5000
}

variable "allowed_origins" {
  type    = list(string)
  default = ["https://portal.securebase.com"]
}

variable "portal_origin" {
  description = "Primary portal origin used in API Gateway gateway responses"
  type        = string
  default     = "https://securebase.tximhotep.com"
}

variable "submit_lead_lambda_arn" {
  type = string
}

variable "submit_lead_lambda_name" {
  type = string
}

variable "demo_auth_lambda_arn" {
  type = string
}

variable "demo_auth_lambda_invoke_arn" {
  type = string
}

variable "demo_auth_lambda_name" {
  type = string
}

# ============================================================================
# Phase 6 Compliance Lambdas
# ============================================================================

variable "soc2_collector_lambda_arn"      { type = string; default = null }
variable "soc2_collector_lambda_name"     { type = string; default = null }
variable "fedramp_collector_lambda_arn"   { type = string; default = null }
variable "fedramp_collector_lambda_name"  { type = string; default = null }
variable "compliance_export_lambda_arn"   { type = string; default = null }
variable "compliance_export_lambda_name"  { type = string; default = null }
variable "control_test_runner_lambda_arn" { type = string; default = null }
variable "control_test_runner_lambda_name"{ type = string; default = null }
variable "vendor_risk_lambda_arn"         { type = string; default = null }
variable "vendor_risk_lambda_name"        { type = string; default = null }

# ============================================================================
# Phase 6.1 — Audit Evidence API Lambda
# Optional: wires /admin/evidence/* routes when provided.
# ============================================================================

variable "audit_evidence_lambda_arn" {
  description = "ARN of the audit_evidence_api Lambda (phase6-backend). Set to null to skip /admin/evidence routes."
  type        = string
  default     = null
}

variable "audit_evidence_lambda_invoke_arn" {
  description = "Invoke ARN of the audit_evidence_api Lambda."
  type        = string
  default     = null
}

variable "audit_evidence_lambda_name" {
  description = "Name of the audit_evidence_api Lambda (used for Lambda permission resource)."
  type        = string
  default     = null
}

# ============================================================================
# Phase 6.2 — Compliance History API Lambda
# Optional: wires /tenant/compliance/history when provided.
# ============================================================================

variable "compliance_history_lambda_arn" {
  description = "ARN of the compliance_history_api Lambda (phase6-backend). Set to null to skip /tenant/compliance/history route."
  type        = string
  default     = null
}

variable "compliance_history_lambda_invoke_arn" {
  description = "Invoke ARN of the compliance_history_api Lambda."
  type        = string
  default     = null
}

variable "compliance_history_lambda_name" {
  description = "Name of the compliance_history_api Lambda."
  type        = string
  default     = null
}

# ============================================================================
# Phase 5.3 SRE Metrics Lambda
# ============================================================================

variable "sre_metrics_lambda_invoke_arn" {
  description = "Invoke ARN of the SRE metrics Lambda. Set to null to skip /sre/* routes."
  type        = string
  default     = null
}

variable "sre_metrics_lambda_name" {
  description = "Name of the SRE metrics Lambda."
  type        = string
  default     = null
}
