resource "google_storage_bucket" "evidence_vault" {
  name          = "securebase-evidence-vault-${var.environment}-${var.project_id}"
  location      = var.region
  storage_class = "STANDARD"

  # Enforce Uniform IAM and Public Access Prevention
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Object Versioning
  versioning {
    enabled = true
  }

  # Customer-Managed Encryption
  encryption {
    default_kms_key_name = google_kms_crypto_key.evidence_key.id
  }

  # Compliance Retention Policy (WORM baseline)
  retention_policy {
    is_locked        = false # Unlocked in dev
    retention_period = var.retention_period_seconds
  }

  depends_on = [
    google_kms_crypto_key_iam_binding.gcs_kms_binding
  ]
}
