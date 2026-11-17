import { BenchmarkScenario } from '../types/compliance';

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: 'banking-ffiec-gcp',
    name: 'Banking Core: GCP Financial Ledger Vault',
    domain: 'Banking (FFIEC/FDIC)',
    platform: 'GCP',
    expectedStatus: 'CRITICAL_FAILURE',
    highlightedViolation: 'Missing CMEK HSM key, public IAM leak, and unsealed WORM retention policy violating FFIEC Appendix A.',
    description: 'Pre-flight OpenTofu definition for a tier-1 banking transaction journal bucket in us-central1. Evaluated against FFIEC IT Handbook, FDIC guidelines, and NIST SP 800-53.',
    initialCode: `# OpenTofu / Terraform Configuration: Tier-1 Core Banking Ledger
# Target: GCP Project SecureBase-GCP [594006980795]
# Provider: hashicorp/google ~> 5.20

resource "google_storage_bucket" "core_ledger_vault" {
  name          = "bank-ledger-transact-prod-001"
  location      = "US-CENTRAL1"
  storage_class = "STANDARD"

  # DRIFT: Uniform bucket-level access disabled (legacy ACLs allowed)
  uniform_bucket_level_access = false

  versioning {
    enabled = true
  }

  # VIOLATION: Missing customer-managed encryption key (CMEK)
  # Uses default Google-managed keys instead of customer Cloud KMS HSM

  # CRITICAL FAILURE: WORM retention policy not configured
  # Statutory 7-year (2555 days) retention lock required by FFIEC & FDIC
}

resource "google_storage_bucket_iam_binding" "ledger_public_read" {
  bucket = google_storage_bucket.core_ledger_vault.name
  role   = "roles/storage.objectViewer"

  # CRITICAL FAILURE: Public read exposure
  members = [
    "allUsers",
  ]
}`
  },
  {
    id: 'healthcare-hipaa-aws',
    name: 'Healthcare EHR: AWS Patient Record Core',
    domain: 'Healthcare (HIPAA)',
    platform: 'AWS',
    expectedStatus: 'CRITICAL_FAILURE',
    highlightedViolation: 'Missing S3 Object Lock, SSE-S3 default key instead of KMS, and public database ingress violating 45 CFR § 164.312.',
    description: 'AWS infrastructure handling Electronic Protected Health Information (ePHI) across S3 telemetry storage and relational RDS database.',
    initialCode: `# OpenTofu / Terraform Configuration: HIPAA ePHI Ingestion Pipeline
# Target: AWS us-east-1
# Evaluated against 45 CFR § 164.312 and NIST SP 800-53 Rev. 5

resource "aws_s3_bucket" "ephi_patient_telemetry" {
  bucket = "hospital-ehr-patient-telemetry-vault"

  # VIOLATION: S3 Object Lock (WORM) disabled
  object_lock_enabled = false

  tags = {
    Environment = "production"
    DataClass   = "ePHI-Restricted"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ephi_encryption" {
  bucket = aws_s3_bucket.ephi_patient_telemetry.id

  rule {
    apply_server_side_encryption_by_default {
      # VIOLATION: AWS-managed SSE-S3 instead of customer-managed KMS key
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_db_instance" "ehr_primary_postgres" {
  allocated_storage       = 100
  engine                  = "postgres"
  engine_version          = "16.1"
  instance_class          = "db.r6g.xlarge"
  db_name                 = "ehr_records"
  
  # CRITICAL VIOLATION: In-transit and at-rest encryption disabled
  storage_encrypted       = false
  publicly_accessible     = true

  # VIOLATION: TLS 1.0 / 1.1 allowed by default parameter group
  skip_final_snapshot     = true
}`
  },
  {
    id: 'nist-critical-infra-gcp',
    name: 'Critical Infra: Sovereign GKE & Network Perimeter',
    domain: 'Critical Infrastructure (NIST)',
    platform: 'GCP',
    expectedStatus: 'CRITICAL_FAILURE',
    highlightedViolation: 'Public CIDR 0.0.0.0/0 ingress, disabled Workload Identity, and missing CMEK cluster encryption violating NIST AC-3, SC-13, and SC-28.',
    description: 'Federal critical infrastructure SCADA telemetry cluster and network boundary evaluated against NIST SP 800-53 Rev. 5 and SOC 2 Type II.',
    initialCode: `# OpenTofu / Terraform Configuration: Critical Infrastructure Kubernetes
# Target: GCP us-east4 (Sovereign Enclave)
# Compliance: NIST SP 800-53 Rev. 5 & SOC 2 CC6.1 / CC6.6

resource "google_compute_firewall" "scada_perimeter_ingress" {
  name    = "fw-allow-scada-ingress"
  network = "projects/securebase-gcp/global/networks/scada-vpc"

  allow {
    protocol = "tcp"
    ports    = ["22", "443", "8443", "9090"]
  }

  # CRITICAL VIOLATION: Unrestricted global CIDR ingress
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["scada-node"]
}

resource "google_container_cluster" "scada_control_plane" {
  name     = "scada-sov-cluster-01"
  location = "us-east4-a"

  # VIOLATION: Workload Identity Federation disabled (uses node service account)
  # Missing workload_identity_config block

  # VIOLATION: Public control plane and node endpoints exposed
  private_cluster_config {
    enable_private_nodes    = false
    enable_private_endpoint = false
  }

  # VIOLATION: Application layer secret encryption using Cloud KMS missing
  # Database encryption missing
}`
  },
  {
    id: 'soc2-fintech-azure',
    name: 'FinTech Cloud: Azure KeyVault & Private Storage',
    domain: 'FinTech (SOC 2)',
    platform: 'Azure',
    expectedStatus: 'DRIFT_DETECTED',
    highlightedViolation: 'Public endpoint allowed, minimum TLS version below 1.3, and KeyVault purge protection disabled violating SOC 2 CC6.1 and CC6.6.',
    description: 'Payment transaction tokenization pipeline running in Azure East US, evaluated against AICPA SOC 2 Type II trust criteria.',
    initialCode: `# OpenTofu / Terraform Configuration: FinTech Tokenization Service
# Target: Azure East US
# Compliance: SOC 2 Type II (CC6.1, CC6.6, CC6.8, CC7.1)

resource "azurerm_storage_account" "token_store" {
  name                     = "fintechtokenstores01"
  resource_group_name      = "rg-fintech-prod"
  location                 = "eastus"
  account_tier             = "Standard"
  account_replication_type = "GRS"

  # DRIFT: Public network access allowed
  public_network_access_enabled = true

  # VIOLATION: Outdated TLS version allowed
  min_tls_version               = "TLS1_0"

  blob_properties {
    versioning_enabled = true
    # VIOLATION: Container immutability policy missing
  }
}

resource "azurerm_key_vault" "prod_vault" {
  name                = "kv-fintech-prod-01"
  location            = "eastus"
  resource_group_name = "rg-fintech-prod"
  tenant_id           = "00000000-0000-0000-0000-000000000000"
  sku_name            = "premium"

  # DRIFT: Purge protection disabled allows permanent key destruction
  purge_protection_enabled = false
  soft_delete_retention_days = 7
}`
  }
];
