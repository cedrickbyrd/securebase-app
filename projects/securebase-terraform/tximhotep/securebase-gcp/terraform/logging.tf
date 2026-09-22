# 1. Project-wide Audit Log Sink to Evidence Storage Bucket
resource "google_logging_project_sink" "compliance_audit_sink" {
  name        = "securebase-compliance-audit-sink"
  destination = "storage.googleapis.com/${google_storage_bucket.evidence_vault.name}"
  
  # Export all Admin Activity, System Events, and Data Access logs
  filter = "logName:\"logs/cloudaudit.googleapis.com\""

  unique_writer_identity = true
}

# 2. Grant Log Sink Writer permission to write to GCS Evidence Bucket
resource "google_storage_bucket_iam_member" "sink_writer" {
  bucket = google_storage_bucket.evidence_vault.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.compliance_audit_sink.writer_identity
}
