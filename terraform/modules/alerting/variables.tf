variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# ── Lambda function names ─────────────────────────────────────────────────────

variable "lambda_function_names" {
  description = "Lambda function names to create per-function alarms for"
  type        = list(string)
  default     = []
}

variable "lambda_dlq_arns" {
  description = "Map of DLQ queue name to ARN for Lambda DLQ depth alarms"
  type        = map(string)
  default     = {}
}

# ── API Gateway ───────────────────────────────────────────────────────────────

variable "api_gateway_id" {
  description = "REST API Gateway ID for 5xx/latency alarms"
  type        = string
  default     = ""
}

variable "api_gateway_stage" {
  description = "API Gateway deployment stage name"
  type        = string
  default     = "prod"
}

variable "apigw_4xx_threshold" {
  description = "API Gateway 4xx error count threshold per 5-min period"
  type        = number
  default     = 100
}

# ── Aurora ────────────────────────────────────────────────────────────────────

variable "aurora_cluster_id" {
  description = "Aurora cluster identifier for DB alarms"
  type        = string
  default     = ""
}

variable "aurora_max_connections_threshold" {
  description = "Aurora connection count that triggers the alarm (80% of max_connections)"
  type        = number
  default     = 160
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────

variable "dynamodb_table_names" {
  description = "DynamoDB table names to create throughput/error alarms for"
  type        = list(string)
  default     = []
}

variable "dynamodb_read_capacity_threshold" {
  description = "DynamoDB consumed read capacity units threshold (80% of provisioned)"
  type        = number
  default     = 800
}

variable "dynamodb_write_capacity_threshold" {
  description = "DynamoDB consumed write capacity units threshold (80% of provisioned)"
  type        = number
  default     = 800
}

# ── Security ──────────────────────────────────────────────────────────────────

variable "enable_security_alarms" {
  description = "Enable security-specific alarms (GuardDuty, CloudTrail, WAF)"
  type        = bool
  default     = true
}

variable "cloudtrail_log_group" {
  description = "CloudWatch log group name for CloudTrail logs (for metric filters)"
  type        = string
  default     = ""
}

variable "compliance_log_group" {
  description = "CloudWatch log group name for compliance/audit log events"
  type        = string
  default     = ""
}

# ── PagerDuty / notification routing ─────────────────────────────────────────

variable "pagerduty_api_key_ssm_param" {
  description = "SSM Parameter Store path for the PagerDuty Events API v2 routing key"
  type        = string
  default     = "/securebase/alerts/pagerduty_routing_key"
}

variable "pagerduty_routing_key" {
  description = "PagerDuty routing key value (written to SSM if create_pagerduty_ssm_param=true)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "create_pagerduty_ssm_param" {
  description = "Create the PagerDuty API key SSM parameter (set false if already exists)"
  type        = bool
  default     = false
}

variable "slack_webhook_ssm_param" {
  description = "SSM Parameter Store path for the Slack incoming webhook URL"
  type        = string
  default     = "/securebase/alerts/slack_webhook_url"
}

variable "slack_webhook_url" {
  description = "Slack webhook URL (written to SSM if create_slack_ssm_param=true)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "create_slack_ssm_param" {
  description = "Create the Slack webhook URL SSM parameter (set false if already exists)"
  type        = bool
  default     = false
}

# ── Email subscriptions ───────────────────────────────────────────────────────

variable "p1_email" {
  description = "Email address for P1 (critical) alert SNS subscription"
  type        = string
  default     = ""
}

variable "p2_email" {
  description = "Email address for P2 (high) alert SNS subscription"
  type        = string
  default     = ""
}

variable "p3_email" {
  description = "Email address for P3 (medium) alert SNS subscription"
  type        = string
  default     = ""
}

variable "oncall_email" {
  description = "On-call engineer email for additional P1 SNS subscription"
  type        = string
  default     = ""
}

# ── KMS ───────────────────────────────────────────────────────────────────────

variable "kms_key_arn" {
  description = "KMS key ARN for SNS and SSM encryption (empty = use AWS-managed keys)"
  type        = string
  default     = ""
}

# ── Runbooks ──────────────────────────────────────────────────────────────────

variable "runbook_s3_bucket" {
  description = "S3 bucket name where runbook JSON files are stored"
  type        = string
  default     = ""
}

variable "runbook_s3_prefix" {
  description = "S3 key prefix for runbook JSON files"
  type        = string
  default     = "runbooks/"
}

# ── Alarm history ─────────────────────────────────────────────────────────────

variable "alarm_history_table" {
  description = "DynamoDB table name for storing alarm history (MTTA/MTTR tracking)"
  type        = string
  default     = "securebase-alarm-history"
}

# ── Chaos drill ───────────────────────────────────────────────────────────────

variable "enable_chaos_drill_schedule" {
  description = "Enable monthly scheduled chaos drill via EventBridge"
  type        = bool
  default     = false
}

variable "chaos_drill_schedule" {
  description = "EventBridge cron expression for chaos drill schedule"
  type        = string
  default     = "cron(0 2 ? * 2#1 *)"
}

# ── Tags ──────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
