# Phase 6 route parent resource IDs
# These allow the phase6 routes file to attach to the correct parent
# resources created by phase5-admin-metrics without creating conflicts.

variable "tenant_compliance_resource_id" {
  description = "API Gateway resource ID for /tenant/compliance (created by phase5-admin-metrics). Required to wire /tenant/compliance/history correctly."
  type        = string
  default     = null
}
