terraform {
  required_version = ">= 1.5.0"
}

locals {
  tenant_name_normalized = lower(replace(var.tenant_name, " ", "-"))
  common_tags = merge(var.tags, {
    TenantId   = var.tenant_id
    TenantTier = var.tier
    Framework  = var.framework
    ManagedBy  = "terraform"
  })
}

resource "null_resource" "tenant_provisioning_marker" {
  triggers = {
    tenant_id = var.tenant_id
    tier      = var.tier
    framework = var.framework
    region    = var.region
  }
}
