output "evidence_bucket_name" {
  description = "Name of the sovereign evidence storage bucket"
  value       = google_storage_bucket.evidence_vault.name
}

output "kms_key_id" {
  description = "Resource ID of the CMEK crypto key"
  value       = google_kms_crypto_key.evidence_key.id
}

output "audit_sink_writer" {
  description = "Service account identity writing audit logs to storage"
  value       = google_logging_project_sink.compliance_audit_sink.writer_identity
}
