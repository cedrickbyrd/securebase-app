# customer-baseline Terraform Module

Provisions a complete security-compliant baseline in a dedicated customer AWS account.

## Resources Created

- VPC with public / private / data subnets across 2 AZs
- NAT Gateway for outbound private-subnet access
- S3 public-access block (account-level)
- EBS encryption by default (using the encrypt CMK)
- Two customer-managed KMS keys (see below)
- CloudTrail (multi-region, log-file validation, KMS-encrypted)
- AWS Config (recorder + delivery channel, KMS-encrypted)
- IAM account password policy
- SecureBase cross-account access role
- GuardDuty (fintech / healthcare / government tiers)
- Security Hub (fintech / healthcare / government tiers)
- Macie (government / sovereign tier only)

---

## KMS Key Policy

The module creates **two separate KMS keys** because AWS does not allow a single key to
be used for both symmetric encryption (SSE) and asymmetric signing operations.

### Key 1 – `aws_kms_key.encrypt` (always created)

| Attribute | Value |
|-----------|-------|
| Key usage | `ENCRYPT_DECRYPT` (symmetric AES-256) |
| Rotation  | Enabled (annual) |
| Used by   | S3 SSE (CloudTrail, Config buckets), EBS default encryption, CloudTrail log encryption |
| Alias     | `alias/securebase-<customer_id>` |

#### Policy Statements

| # | SID | Effect | Principal | Actions |
|---|-----|--------|-----------|---------|
| 1 | `RootFullAccess` | Allow | Account root | `kms:*` — AWS-required escape hatch so the account can always recover the key |
| 2 | `KeyAdminAccess` | Allow | `key_admin_role_arn` (or management-account root) | Rotate, describe, enable/disable, list, update policy, tag — but **not** delete |
| 3 | `DenyKeyDeletionForAdmin` | **Deny** | `key_admin_role_arn` | `kms:ScheduleKeyDeletion`, `kms:DeleteKey` — only root can ever delete the key |
| 5 | `AWSServiceEncryptDecrypt` | Allow | `cloudtrail.amazonaws.com`, `config.amazonaws.com`, `s3.amazonaws.com` | `kms:GenerateDataKey`, `kms:Decrypt`, `kms:DescribeKey` |

> **Note:** Statement numbers match those in the problem specification; statement 4
> (`AppSignVerifyOnly`) lives on the sign key only.

### Key 2 – `aws_kms_key.sign` (only when `var.app_role_arn != ""`)

| Attribute | Value |
|-----------|-------|
| Key usage | `SIGN_VERIFY` (asymmetric ECC_NIST_P256) |
| Rotation  | Disabled (not supported for asymmetric keys) |
| Used by   | Application Lambda for JWT / token signing |
| Alias     | `alias/securebase-<customer_id>-sign` |

#### Policy Statements

| # | SID | Effect | Principal | Actions |
|---|-----|--------|-----------|---------|
| 1 | `RootFullAccess` | Allow | Account root | `kms:*` — escape hatch |
| 4 | `AppSignVerifyOnly` | Allow | `app_role_arn` | `kms:Sign`, `kms:Verify`, `kms:GetPublicKey`, `kms:DescribeKey` — no encrypt/decrypt, no admin |

> **Only root can delete either key.** The explicit `DenyKeyDeletionForAdmin` statement
> (statement 3) ensures even a delegated key-admin role cannot schedule deletion.

---

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `customer_id` | `string` | — | Unique SecureBase customer UUID |
| `customer_name` | `string` | — | Human-readable customer name |
| `tier` | `string` | — | `standard` \| `fintech` \| `healthcare` \| `government` |
| `aws_region` | `string` | `us-east-1` | Primary AWS region |
| `vpc_cidr` | `string` | `10.0.0.0/16` | CIDR block for the customer VPC |
| `mfa_required` | `bool` | `true` | Enforce MFA for IAM console access |
| `management_account_id` | `string` | — | AWS account ID of the SecureBase management account |
| `audit_log_retention_days` | `number` | `0` | Override log retention; `0` = derive from tier |
| `tags` | `map(string)` | `{}` | Additional resource tags |
| `app_role_arn` | `string` | `""` | IAM role ARN granted sign/verify-only access. When empty, the sign key is **not** created |
| `key_admin_role_arn` | `string` | `""` | IAM role ARN for key administration. When empty, defaults to `arn:aws:iam::<management_account_id>:root` |

### Supplying the new KMS variables

```hcl
module "customer_baseline" {
  source                = "../../modules/customer-baseline"
  customer_id           = "acme-corp"
  customer_name         = "Acme Corp"
  tier                  = "fintech"
  management_account_id = "123456789012"

  # Optional: create the signing key and grant the Lambda role sign/verify access
  app_role_arn = "arn:aws:iam::123456789012:role/securebase-lambda-exec"

  # Optional: delegate key administration to a dedicated role instead of account root
  key_admin_role_arn = "arn:aws:iam::123456789012:role/SecureBaseKeyAdmin"
}
```

---

## Outputs

| Name | Description |
|------|-------------|
| `vpc_id` | Customer VPC ID |
| `private_subnet_ids` | Private subnet IDs (application layer) |
| `data_subnet_ids` | Data subnet IDs (database layer) |
| `public_subnet_ids` | Public subnet IDs |
| `kms_key_arn` | ARN of the encrypt CMK (symmetric AES-256) |
| `kms_key_id` | Key ID of the encrypt CMK |
| `kms_key_alias_arn` | Full ARN of the KMS encrypt key alias |
| `kms_key_policy_summary` | Human-readable list of policy statements applied to the encrypt key |
| `kms_sign_key_arn` | ARN of the sign CMK (ECC_NIST_P256); empty string when `app_role_arn` is not set |
| `kms_sign_key_id` | Key ID of the sign CMK; empty string when `app_role_arn` is not set |
| `cloudtrail_bucket` | S3 bucket name for CloudTrail logs |
| `config_bucket` | S3 bucket name for AWS Config snapshots |
| `securebase_access_role_arn` | ARN of the SecureBase cross-account access role |
| `guardduty_detector_id` | GuardDuty detector ID (empty string for standard tier) |

---

## Trade-offs: Symmetric vs. Asymmetric Keys

AWS KMS keys have a fixed `key_usage` that cannot be changed after creation:

- **`ENCRYPT_DECRYPT`** — symmetric AES-256; used for S3 SSE, EBS, CloudTrail encryption.
  Does **not** support `kms:Sign` / `kms:Verify`.
- **`SIGN_VERIFY`** — asymmetric (RSA or ECC); used for signing JWTs / tokens.
  Does **not** support `kms:GenerateDataKey` / `kms:Decrypt`.

This module therefore creates two keys when `app_role_arn` is provided, keeping
encryption and signing concerns cleanly separated and ensuring the application
role can never perform encryption/decryption operations or administer either key.
