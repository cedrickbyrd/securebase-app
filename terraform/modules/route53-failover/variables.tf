# ── terraform/modules/route53-failover/variables.tf ───────────────────────────
# Phase 6 / Track 2 — Sub-task 2.4: Route53 Health-Check-Based Failover
# ──────────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "primary_region" {
  description = "Primary AWS region (active writer)"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region (failover target)"
  type        = string
  default     = "us-west-2"
}

# ── DNS ────────────────────────────────────────────────────────────────────────

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID in which to create failover records"
  type        = string
}

variable "api_dns_name" {
  description = "DNS record name for the API endpoint (e.g. api.securebase.example.com)"
  type        = string
}

variable "primary_api_endpoint" {
  description = "FQDN of the primary region API Gateway endpoint (no https:// prefix)"
  type        = string
}

variable "secondary_api_endpoint" {
  description = "FQDN of the secondary region API Gateway endpoint (no https:// prefix)"
  type        = string
}

# ── Health Check settings ──────────────────────────────────────────────────────

variable "health_check_path" {
  description = "URL path probed by Route53 health checks"
  type        = string
  default     = "/health"
}

variable "health_check_interval_seconds" {
  description = "How often (seconds) Route53 sends a health check request (10 or 30)"
  type        = number
  default     = 30

  validation {
    condition     = contains([10, 30], var.health_check_interval_seconds)
    error_message = "health_check_interval_seconds must be 10 or 30."
  }
}

variable "health_check_failure_threshold" {
  description = "Number of consecutive failures before Route53 marks the endpoint unhealthy"
  type        = number
  default     = 3
}

variable "dns_ttl" {
  description = "TTL (seconds) for the Route53 failover records"
  type        = number
  default     = 60
}

# ── Alerting ───────────────────────────────────────────────────────────────────

variable "alert_sns_arn" {
  description = "SNS topic ARN to notify when a health check fails (leave empty to disable)"
  type        = string
  default     = ""
}

variable "alarm_evaluation_periods" {
  description = "Number of consecutive periods the health check must be unhealthy before firing the CloudWatch alarm"
  type        = number
  default     = 1
}

# ── Tags ───────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to apply to all resources (merged with module defaults)"
  type        = map(string)
  default     = {}
}
