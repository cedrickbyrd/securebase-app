# 1. Cloud KMS KeyRing
resource "google_kms_key_ring" "securebase_keyring" {
  name     = "securebase-keyring-${var.environment}"
  location = var.region
}

# 2. Customer-Managed Encryption Key (CMEK) with 365-day automated rotation
resource "google_kms_crypto_key" "evidence_key" {
  name            = "securebase-evidence-key"
  key_ring        = google_kms_key_ring.securebase_keyring.id
  rotation_period = "31536000s" # 365 days

  lifecycle {
    prevent_destroy = true
  }
}

# 3. Retrieve GCS Service Agent
data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id
}

# 4. Grant GCS Service Agent permissions to encrypt/decrypt with CMEK
resource "google_kms_crypto_key_iam_binding" "gcs_kms_binding" {
  crypto_key_id = google_kms_crypto_key.evidence_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  members = [
    "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
  ]
}
