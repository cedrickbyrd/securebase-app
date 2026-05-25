# GCP Integration Architecture — Phase 7 (Draft)

**Last Updated:** May 2026  
**Status:** Draft — Phase 7 Planning

---

## 1. Overview & Strategic Context

SecureBase is a compliance-first AWS Landing Zone SaaS platform designed for regulated workloads (SOC 2, HIPAA, FedRAMP). Phase 7 introduces a GCP integration layer as a controlled multi-cloud extension for analytics and AI use cases, while preserving SecureBase's AWS-first trust and control plane.

### Strategic Positioning

- **Additive-only model:** Phase 7 does not modify or replace existing Phase 1–6 AWS infrastructure, Terraform state, or production runtime paths.
- **Commercial driver:** Enable enterprise, fintech, healthcare, and government buyers with GCP commitments (BigQuery/Vertex AI requirements) to adopt SecureBase without architecture exceptions.
- **Compliance continuity:** Preserve existing SecureBase control objectives while extending equivalent safeguards into GCP.

### Non-Negotiable Security Principles

- **PHI trust boundary:** PHI never leaves the AWS trust boundary. Only anonymized/aggregated outputs can cross into GCP.
- **Identity model:** No long-lived GCP service account keys. Authentication is exclusively through Workload Identity Federation (WIF) using short-lived tokens.

---

## 2. Architecture Diagram (ASCII)

```text
┌────────────────────────────────────── AWS SecureBase Trust Boundary ───────────────────────────────────────┐
│                                                                                                             │
│  DynamoDB Streams      Aurora Metrics Views       S3 The Vault (Object Lock, 7y)      KMS (AES-256)      │
│         │                     │                              ▲                              ▲              │
│         └──────────────┬──────┴──────────────┐               │                              │              │
│                        ▼                     ▼               │                              │              │
│              Lambda Anonymizer        Audit Log Packager ────┴──────► SHA-256 manifests + PDF cover      │
│       (strip PHI/hash emails/tenant IDs)        ▲                                                         │
│                        │                         │                                                         │
│                        ▼                         │                                                         │
│                Kinesis Data Firehose             │                                                         │
│                        │                         │                                                         │
│                        ▼                         │                                                         │
│             S3 Staging Bucket (KMS, 7-day TTL)   │                                                         │
│                        │                         │                                                         │
└────────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────────┘
                         │                         │
                         │ OIDC token exchange     │ Audit webhook ingest
                         ▼                         ▼
              ┌────────────────────────────────────────────────────────────────────┐
              │ Workload Identity Federation (AWS IAM Role ↔ GCP Service Account) │
              └────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────── GCP Security Perimeter (VPC SC) ─────────────────────────────────┐
│                                                                                                             │
│  BigQuery Data Transfer ◄──── S3 staged anonymized exports                                                  │
│         │                                                                                                   │
│         ▼                                                                                                   │
│  BigQuery Datasets (CMEK, 90-day key rotation) ─────► Vertex AI Feature/Dataset Pipelines                 │
│         │                                                                                                   │
│         └──────────────► Cloud Logging / Monitoring                                                         │
│                                                                                                             │
│  Cloud Audit Logs ─► Pub/Sub Topic ─► Push Subscription ─► AWS API Gateway Webhook ─► SecureBase Vault   │
│                                                                                                             │
│  Private Google Access + deny-by-default firewall + WIF principal allowlist                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Required Data Flow

`DynamoDB → Lambda anonymizer (PHI stripped) → Firehose → S3 staging → BigQuery Data Transfer`

### Required Audit Flow

`GCP Cloud Audit Logs → Pub/Sub → SecureBase Vault (S3 Object Lock)`

---

## 3. Workload Identity Federation (WIF) Design

WIF is mandatory for AWS→GCP identity federation. Service account keys are prohibited because they are static secrets, increase credential sprawl, and expand compromise persistence windows.

### Why WIF Instead of Service Account Keys

- Aligns with **SOC 2 CC6.1** (logical access controls and credential hygiene)
- Eliminates key file distribution/rotation burden
- Reduces attack surface from leaked CI/CD artifacts or workstation copies
- Enables scoped, conditional trust based on AWS role identity

### Allowed AWS IAM Roles (Federation Allowlist)

Only these SecureBase AWS roles may federate:

- `securebase-analytics-exporter`
- `securebase-ai-bridge`
- `securebase-audit-exporter`

### Attribute Mapping and Conditions

- `google.subject` → `assertion.arn`
- `attribute.aws_role` → extracted role name from `assertion.arn`
- Attribute condition enforces explicit role allowlist
- Max token lifetime: **1 hour**

```hcl
resource "google_iam_workload_identity_pool" "securebase_aws" {
  project                   = var.gcp_project_id
  workload_identity_pool_id = "securebase-aws-pool"
  display_name              = "SecureBase AWS Federation Pool"
  description               = "Federation pool for SecureBase AWS runtime roles"
}

resource "google_iam_workload_identity_pool_provider" "securebase_aws_provider" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.securebase_aws.workload_identity_pool_id
  workload_identity_pool_provider_id = "securebase-aws-provider"
  display_name                       = "AWS OIDC Provider"

  aws {
    account_id = var.aws_account_id
  }

  attribute_mapping = {
    "google.subject"     = "assertion.arn"
    "attribute.aws_role" = "assertion.arn.extract('assumed-role/{role}/')"
  }

  attribute_condition = "attribute.aws_role in ['securebase-analytics-exporter', 'securebase-ai-bridge', 'securebase-audit-exporter']"
}

resource "google_service_account_iam_binding" "wif_sa_binding" {
  service_account_id = google_service_account.securebase_bridge.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.securebase_aws.name}/attribute.aws_role/securebase-analytics-exporter",
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.securebase_aws.name}/attribute.aws_role/securebase-ai-bridge",
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.securebase_aws.name}/attribute.aws_role/securebase-audit-exporter"
  ]
}

resource "google_service_account" "securebase_bridge" {
  project      = var.gcp_project_id
  account_id   = "securebase-bridge"
  display_name = "SecureBase Federated Bridge"
}
```

> Implementation guardrail: deny creation of `google_service_account_key` resources via policy-as-code and CI checks.

---

## 4. Secure Data Bridge — AWS → GCP

The secure data bridge moves only anonymized operational/compliance metrics to GCP analytics services.

### PHI Boundary Rule (Mandatory)

The AWS Lambda anonymizer is the final pre-egress control point and must:

1. Hash all email addresses (`SHA-256 + tenant-specific salt`)
2. Replace tenant names with opaque tenant IDs
3. Strip free-text fields that could contain PHI
4. Forward only aggregated/anonymized compliance and usage metrics

### Pipeline Stages

1. **DynamoDB Streams** emit source events
2. **Lambda anonymizer** enforces PHI stripping and schema allowlist
3. **Kinesis Data Firehose** buffers and delivers export objects
4. **S3 staging bucket** stores encrypted transfer objects (KMS, 7-day lifecycle)
5. **BigQuery Data Transfer Service** ingests into governed datasets

### Failure/Fallback Behavior

- If BigQuery transfer fails, source artifacts remain in S3 staging (durable retry buffer)
- Alert is sent to SNS for operational response
- No event deletion before successful ingestion acknowledgment

### BigQuery Dataset Schema (No PHI Columns)

| Dataset/Table | Purpose | Allowed Fields (examples) | PHI Allowed |
|---|---|---|---|
| `securebase_analytics.compliance_scores` | Framework trend scoring | `tenant_id`, `framework`, `score`, `control_pass_count`, `snapshot_ts` | No |
| `securebase_analytics.usage_metrics` | Capacity/usage analytics | `tenant_id`, `service`, `region`, `metric_name`, `metric_value`, `window_start`, `window_end` | No |
| `securebase_analytics.audit_events` | Normalized audit telemetry for analytics | `tenant_id`, `source_cloud`, `event_type`, `resource_type`, `severity`, `event_ts` | No |

### CMEK Requirements

- All BigQuery datasets must use Cloud KMS **CMEK**
- Key rotation every **90 days**
- KMS IAM scoped to federated service account and minimum required service agents

```hcl
resource "google_bigquery_dataset" "securebase_analytics" {
  project    = var.gcp_project_id
  dataset_id = "securebase_analytics"
  location   = var.region

  default_encryption_configuration {
    kms_key_name = google_kms_crypto_key.bigquery_cmek.id
  }

  labels = local.gcp_labels
}

resource "google_storage_bucket" "bridge_staging" {
  name                        = "${var.project_prefix}-gcp-bridge-staging"
  location                    = var.region
  uniform_bucket_level_access = true

  encryption {
    default_kms_key_name = google_kms_crypto_key.bridge_staging.id
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 7 }
  }

  labels = local.gcp_labels
}
```

---

## 5. Unified Audit Log Pipeline

Phase 7 extends Phase 6.1 Vault architecture to include GCP audit evidence in the same immutable artifact model.

### End-to-End Flow

`GCP Cloud Audit Logs (Admin Activity, Data Access, System Event) → Pub/Sub topic → push subscription → AWS API Gateway webhook → audit_log_packager.py Lambda → S3 Object Lock (COMPLIANCE, 7 years)`

### Evidence Packaging Requirements

- Generate SHA-256 manifest (aligned with existing Vault chain-of-custody design)
- Auditor PDF cover page must include:
  - GCP project ID
  - Log sink name
  - Event count
  - Collection window
- Compliance package must include both AWS CloudTrail and GCP audit events in one artifact per compliance period

### Latency SLO and Alerting

- Pipeline latency threshold: **5 minutes max**
- Trigger alert if ingestion delay exceeds threshold
- Alert route aligns with existing Phase 5 detection target (`< 5 min`)

```hcl
resource "google_logging_project_sink" "audit_export" {
  name        = "securebase-audit-export"
  project     = var.gcp_project_id
  destination = "pubsub.googleapis.com/${google_pubsub_topic.audit_topic.id}"

  filter = "logName:cloudaudit.googleapis.com"

  unique_writer_identity = true
}

resource "google_pubsub_topic" "audit_topic" {
  name   = "securebase-audit-events"
  labels = local.gcp_labels
}

resource "google_pubsub_subscription" "audit_push" {
  name  = "securebase-audit-push"
  topic = google_pubsub_topic.audit_topic.name

  push_config {
    push_endpoint = var.aws_audit_webhook_url
    oidc_token {
      service_account_email = google_service_account.securebase_bridge.email
      audience              = var.aws_audit_webhook_audience
    }
  }
}
```

---

## 6. VPC Service Controls & Network Isolation

### Control Objectives

- Enforce VPC Service Controls perimeter around BigQuery and Vertex AI data services
- Restrict data access to WIF-authenticated principals from SecureBase AWS account
- Ensure private access paths for production workloads

### Network Isolation Requirements

- **Private Google Access** for all participating subnets and services
- **No public endpoints** for sensitive data-plane operations
- **Production transfer path:** Cloud Interconnect or PrivateLink-equivalent private routing
- **Dev/Staging transfer path:** VPN acceptable with perimeter and IAM constraints
- **Firewall baseline:** deny-all ingress; explicit allow only for token exchange and approved control-plane calls

```hcl
resource "google_access_context_manager_service_perimeter" "securebase_perimeter" {
  parent = "accessPolicies/${var.access_policy_id}"
  name   = "accessPolicies/${var.access_policy_id}/servicePerimeters/securebase_phase7"
  title  = "securebase-phase7"

  status {
    restricted_services = [
      "bigquery.googleapis.com",
      "aiplatform.googleapis.com",
      "storage.googleapis.com"
    ]

    ingress_policies {
      ingress_from {
        identities = [
          "principal://iam.googleapis.com/${google_service_account.securebase_bridge.name}"
        ]
      }

      ingress_to {
        operations {
          service_name = "bigquery.googleapis.com"
          method_selectors { method = "*" }
        }
      }
    }
  }
}
```

---

## 7. Compliance Mapping

| Control | AWS Implementation | GCP Implementation | Framework |
|---------|--------------------|-------------------|-----------|
| Encryption at rest | KMS (AES-256) | Cloud KMS CMEK (AES-256) | SOC 2, HIPAA, FedRAMP |
| Encryption in transit | TLS 1.3 | TLS 1.3 | SOC 2, HIPAA |
| No long-lived credentials | IAM roles + OIDC | WIF (no SA keys) | SOC 2 CC6.1 |
| Audit logging | CloudTrail → Vault | Cloud Audit Logs → Vault | SOC 2, HIPAA, FedRAMP |
| PHI protection | Lambda strips PHI pre-logging | PHI never reaches GCP | HIPAA §164.312 |
| Access control | RBAC + MFA | WIF allowlist + IAM conditions | SOC 2 CC6.2 |
| Resource tagging | AWS tags | GCP labels (parity enforced) | SOC 2 CC7.2 |
| Incident response | Phase 5 alerting (40+ alarms) | Cloud Monitoring → SNS bridge | SOC 2 CC7.3 |

---

## 8. Terraform Module Structure

```text
gcp-landing-zone/
├── modules/
│   ├── org-bootstrap/
│   ├── identity-federation/
│   ├── secure-data-bridge/
│   ├── audit-export/
│   └── vertex-ai/
└── environments/
    ├── dev/
    └── prod/
```

### Label Standard (Must Match AWS Tag Semantics)

```hcl
locals {
  gcp_labels = {
    environment          = var.environment
    compliance_framework = "soc2-hipaa-fedramp"
    data_classification  = "confidential"
    managed_by           = "terraform"
    securebase_phase     = "phase7"
  }
}
```

### Module Contracts

| Module | Inputs | Outputs | Key Resources | Dependencies |
|---|---|---|---|---|
| `org-bootstrap` | `org_id`, `billing_account_id`, `environment`, `project_ids` | `folder_ids`, `project_numbers`, `network_self_links` | Folders, projects, billing bindings, shared VPC baseline, org policies | None (foundation module) |
| `identity-federation` | `gcp_project_id`, `aws_account_id`, `allowed_roles` | `wif_pool_name`, `provider_name`, `bridge_service_account_email` | WIF pool/provider, service accounts, IAM bindings/conditions | `org-bootstrap` (project created) |
| `secure-data-bridge` | `gcp_project_id`, `region`, `source_s3_uri`, `kms_key_ring`, `kms_key_name` | `bigquery_dataset_id`, `staging_bucket`, `transfer_config_id` | BigQuery dataset/tables, Cloud Storage staging, Data Transfer configs, CMEK keys | `identity-federation`, `org-bootstrap` |
| `audit-export` | `gcp_project_id`, `aws_audit_webhook_url`, `aws_audit_webhook_audience` | `pubsub_topic`, `subscription`, `log_sink_writer_identity` | Cloud Logging sinks, Pub/Sub topic/subscription, push delivery with OIDC | `identity-federation` |
| `vertex-ai` | `gcp_project_id`, `region`, `dataset_id`, `kms_key_name` | `vertex_dataset_id`, `featurestore_id`, `pipeline_sa_email` | Vertex AI datasets/pipelines, IAM bindings, VPC SC-compatible service configs | `secure-data-bridge`, `identity-federation` |

---

## 9. Portal Integration Design

Phase 7 introduces a feature-gated portal experience in `phase3a-portal/` with existing conventions: functional components, Tailwind-only styling, no Supabase.

### New Components

1. `phase3a-portal/src/components/GCPIntegration.jsx`
   - Displays WIF connection status
   - Displays BigQuery pipeline health
   - Displays last audit export timestamp
   - Displays Vertex AI dataset status
2. `phase3a-portal/src/components/MultiCloudCompliance.jsx`
   - Unified AWS + GCP compliance score card

### Gating & Feature Flag

- Tier gate: render only for `enterprise` and `government` tiers (same conditional model used by `HIPAADashboard.jsx` gating patterns)
- Feature flag: `VITE_GCP_ENABLED=false` (returns `null`/no render in production until launch)

### Routing

- Add `/gcp-integration` route in `phase3a-portal/src/App.jsx`
- Route must remain behind both:
  1. Tier gate (`enterprise`/`government`)
  2. Feature flag gate (`VITE_GCP_ENABLED`)

### Analytics

- Emit GA4 event: `gcp_integration_viewed`
- No PII in event payload
- Follow `analyticsService.js` patterns for sanitized event fields

---

## 10. Development Isolation Strategy

Phase 7 must be developed in strict isolation to avoid disruption to active Phase 6 delivery.

### Isolation Controls

- **Branch strategy:** `feature/gcp-landing-zone`
- **Terraform state isolation:** separate backend key `gcp-landing-zone/terraform.tfstate`
- **CI isolation:** `.github/workflows/gcp-validate.yml` triggers only on `gcp-landing-zone/**`
- **Runtime safety:** `VITE_GCP_ENABLED=false` in all environments until launch approval
- **No touch list (during Phase 7 build):**
  - No modifications to existing Lambda functions
  - No DynamoDB table changes
  - No API Gateway route changes
- **IAM change model:** create new IAM roles only; do not modify existing `securebase-production-*` roles

```hcl
terraform {
  backend "s3" {
    bucket         = "securebase-terraform-state"
    key            = "gcp-landing-zone/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "securebase-terraform-locks"
    encrypt        = true
  }
}
```

```yaml
# Example GitHub Actions path filter model for gcp-validate workflow
on:
  pull_request:
    paths:
      - "gcp-landing-zone/**"
      - ".github/workflows/gcp-validate.yml"
  push:
    branches: [main, develop]
    paths:
      - "gcp-landing-zone/**"
```

---

## 11. Phase 7 Sprint Plan

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| 7.1 | GCP org bootstrap + WIF Terraform module | 📋 Planned |
| 7.2 | Secure data bridge: DynamoDB → BigQuery (anonymized) | 📋 Planned |
| 7.3 | Unified audit log pipeline → The Vault | 📋 Planned |
| 7.4 | Portal `GCPIntegration.jsx` + tier gate | 📋 Planned |
| 7.5 | Vertex AI dataset pipeline + CMEK | 📋 Planned |
| 7.6 | Sales enablement: demo tenant with GCP panel | 📋 Planned |

---

## 12. Open Questions / Decision Log

| Decision Topic | Options | Current Status | Owner |
|---|---|---|---|
| Private transfer architecture | Cloud Interconnect vs PrivateLink-equivalent vs internet + VPC SC | Open | Platform Architecture |
| Ingestion engine | BigQuery Data Transfer Service vs custom Dataflow pipeline | Open | Data Platform |
| Project topology | Single project vs folder hierarchy aligned to AWS multi-account strategy | Open | Cloud Governance |
| Vertex AI refresh cadence | Real-time streaming vs nightly batch | Open | AI/ML Platform |
| Org policy parity | Mirror AWS SCP intent with GCP Org Policies | Open | Security Engineering |

### Decision Criteria (Required)

- Compliance impact (SOC 2, HIPAA, FedRAMP)
- Residual security risk (credential, egress, data residency)
- Operational overhead (on-call burden, drift risk)
- Cost profile at enterprise scale
- Time-to-revenue for regulated enterprise onboarding

---

## Appendix A — Implementation Guardrails

- Do not add Markdown documentation files in repository root; place all new docs under `/docs`.
- Do not include customer PII in architecture documents, examples, commits, or issue comments.
- Do not introduce long-lived credentials to bridge AWS and GCP.
- Keep GCP integration additive and feature-flagged until Phase 7 launch governance approval.
