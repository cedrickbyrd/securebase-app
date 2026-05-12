output "tenant_id" {
  description = "Provisioned tenant id"
  value       = var.tenant_id
}

output "tenant_name_normalized" {
  description = "Normalized tenant name"
  value       = local.tenant_name_normalized
}

output "tags" {
  description = "Computed tags for tenant resources"
  value       = local.common_tags
}
