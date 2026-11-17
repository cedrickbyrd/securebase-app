# Keyless Workload Identity Federation (WIF / OIDC) Pool for CoreLink & CI/CD
variable "project_id" { type = string }
variable "github_repo" { type = string }

resource "google_iam_workload_identity_pool" "mvno_wif" {
  workload_identity_pool_id = "securebase-mvno-wif-pool"
  display_name              = "SecureBase MVNO Keyless WIF Pool"
}

resource "google_iam_workload_identity_pool_provider" "github_oidc" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.mvno_wif.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc-provider"
  attribute_condition                = "assertion.repository == '${var.github_repo}'"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
