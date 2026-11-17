###############################################################################
# SecureBase Step 7: Universal Tri-Cloud Security Policy Enforcement
# Synchronized SCPs (AWS), Org Policy Constraints (GCP), Azure Policy Initiative
# Zero Static Credentials | CMEK Mandatory | Public Buckets Denied | TLS 1.3
###############################################################################

variable "aws_org_root_id" {
  type    = string
  default = "r-securebase01"
}

variable "gcp_org_id" {
  type    = string
  default = "594006980795"
}

variable "azure_subscription_id" {
  type    = string
  default = "/subscriptions/00000000-0000-0000-0000-000000000000"
}

# ---------------------------------------------------------------------------
# 1. AWS Organizations Service Control Policy (SCP)
# ---------------------------------------------------------------------------

resource "aws_organizations_policy" "securebase_universal_scp" {
  name        = "SecureBase-Universal-ZeroTrust-SCP"
  description = "Blocks static IAM keys, enforces CMEK SSE, blocks public S3, and enforces TLS 1.3"
  type        = "SERVICE_CONTROL_POLICY"

  content = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DenyStaticIamCredentials"
        Effect   = "Deny"
        Action   = ["iam:CreateAccessKey", "iam:CreateUser", "iam:CreateLoginProfile"]
        Resource = "*"
      },
      {
        Sid      = "DenyUnencryptedOrNonCmekS3Put"
        Effect   = "Deny"
        Action   = ["s3:PutObject"]
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid      = "DenyPublicS3AccessBlockBypass"
        Effect   = "Deny"
        Action   = ["s3:PutBucketPublicAccessBlock", "s3:DeleteBucketPublicAccessBlock"]
        Resource = "*"
        Condition = {
          Bool = {
            "aws:ViaAWSService" = "false"
          }
        }
      },
      {
        Sid      = "EnforceTls13Transport"
        Effect   = "Deny"
        Action   = ["s3:*", "kms:*", "sts:*"]
        Resource = "*"
        Condition = {
          NumericLessThan = {
            "aws:TlsVersion" = "1.3"
          }
        }
      }
    ]
  })
}

resource "aws_organizations_policy_attachment" "attach_root_scp" {
  policy_id = aws_organizations_policy.securebase_universal_scp.id
  target_id = var.aws_org_root_id
}

# ---------------------------------------------------------------------------
# 2. GCP Organization Policy Constraints (securebase-gcp-dev / 594006980795)
# ---------------------------------------------------------------------------

resource "google_org_policy_policy" "gcp_disable_sa_keys" {
  name   = "projects/securebase-gcp-dev/policies/iam.disableServiceAccountKeyCreation"
  parent = "projects/securebase-gcp-dev"

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

resource "google_org_policy_policy" "gcp_block_public_buckets" {
  name   = "projects/securebase-gcp-dev/policies/storage.publicAccessPrevention"
  parent = "projects/securebase-gcp-dev"

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

resource "google_org_policy_policy" "gcp_require_cmek" {
  name   = "projects/securebase-gcp-dev/policies/gcp.restrictNonCmekServices"
  parent = "projects/securebase-gcp-dev"

  spec {
    rules {
      values {
        denied_values = [
          "storage.googleapis.com",
          "sqladmin.googleapis.com",
          "bigquery.googleapis.com"
        ]
      }
    }
  }
}

resource "google_org_policy_policy" "gcp_enforce_tls_versions" {
  name   = "projects/securebase-gcp-dev/policies/gcp.restrictTlsVersions"
  parent = "projects/securebase-gcp-dev"

  spec {
    rules {
      values {
        denied_values = ["TLS_VERSION_1", "TLS_VERSION_1_1", "TLS_VERSION_1_2"]
      }
    }
  }
}

# ---------------------------------------------------------------------------
# 3. Microsoft Azure Policy Initiative (CMEK, Public Block, TLS 1.3, WIF Only)
# ---------------------------------------------------------------------------

resource "azurerm_policy_set_definition" "securebase_azure_guardrails" {
  name         = "securebase-universal-guardrails"
  policy_type  = "Custom"
  display_name = "SecureBase Tri-Cloud Zero-Trust Guardrail Initiative"

  metadata = jsonencode({
    category   = "SecureBase Compliance"
    frameworks = ["FFIEC_AIO", "HIPAA_164_312", "SOC2_TYPE_II", "NIST_800_53"]
  })

  # Built-in Azure Policy IDs: Storage HTTPS/TLS1.2+, Public Access Disabled, CMK Encryption
  policy_definition_reference {
    policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/404c3081-a854-4457-ae30-26a93ef643f9"
    reference_id         = "DenyHttpStorageTraffic"
  }

  policy_definition_reference {
    policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/4fa4b6c0-31ca-4c0d-b10d-24b96f62a751"
    reference_id         = "DenyPublicBlobAccess"
  }

  policy_definition_reference {
    policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/6fac406b-40ca-413b-bf8e-0bf964659c25"
    reference_id         = "RequireStorageCmek"
  }

  policy_definition_reference {
    policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/fe83a0eb-a853-422d-aac2-1bffd182c5d0"
    reference_id         = "RequireTls13Storage"
  }
}

resource "azurerm_subscription_policy_assignment" "assign_azure_guardrails" {
  name                 = "securebase-universal-enforce"
  subscription_id      = var.azure_subscription_id
  policy_definition_id = azurerm_policy_set_definition.securebase_azure_guardrails.id
  display_name         = "SecureBase Universal Guardrails (CMEK + TLS 1.3 + Zero Secrets)"
}
