terraform {
  required_version = ">= 1.5.0"
}

locals {
  backend_state_key = "landing-zone/${var.environment}/terraform.tfstate"
  workspace_name    = var.environment
}

resource "null_resource" "pipeline_configuration" {
  triggers = {
    environment     = var.environment
    backend_bucket  = var.backend_bucket
    lock_table      = var.lock_table
    workspace_name  = local.workspace_name
    backend_state   = local.backend_state_key
  }
}
