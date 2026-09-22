# 1. Create Workload Identity Pool
resource "google_iam_workload_identity_pool" "aws_pool" {
  workload_identity_pool_id = "securebase-aws-pool"
  display_name              = "SecureBase AWS Identity Pool"
  description               = "Enables keyless AWS-to-GCP telemetry ingestion"
}

# 2. Add AWS OIDC / STS Provider to Pool
resource "google_iam_workload_identity_pool_provider" "aws_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.aws_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "aws-control-plane-provider"
  display_name                       = "SecureBase AWS Control Plane"

  aws {
    account_id = "731184206915" # TxImhotep AWS Production Account ID
  }

  attribute_mapping = {
    "google.subject"        = "assertion.arn"
    "attribute.aws_account" = "assertion.account"
    "attribute.aws_role"    = "assertion.arn"
  }
}

# 3. Allow AWS Production Role to Impersonate the GCP Telemetry Service Account
resource "google_service_account_iam_member" "wif_impersonation" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/securebase-telemetry-agent@${var.project_id}.iam.gserviceaccount.com"
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.aws_pool.name}/attribute.aws_account/731184206915"
}
