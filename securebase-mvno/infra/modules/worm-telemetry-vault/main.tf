# Immutable 7-Year (2555-Day) WORM CDR Telemetry Vault
variable "sovereign_scope" { type = string }
variable "location" { type = string }
variable "cmek_key_id" { type = string }

resource "google_storage_bucket" "worm_cdr_vault" {
  name                        = "securebase-worm-cdr-${var.sovereign_scope}"
  location                    = var.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  retention_policy {
    is_locked        = true
    retention_period = 220752000 # 2,555 days (7 years)
  }

  encryption {
    default_kms_key_name = var.cmek_key_id
  }
}
