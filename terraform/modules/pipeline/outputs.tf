output "workspace_name" {
  description = "Workspace configured for this pipeline"
  value       = local.workspace_name
}

output "backend_state_key" {
  description = "S3 key used for terraform state"
  value       = local.backend_state_key
}
