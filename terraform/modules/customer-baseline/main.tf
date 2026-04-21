# ============================================================
# terraform/modules/customer-baseline/main.tf
# SecureBase – parameterized per-customer AWS baseline
# ============================================================
# Provisions a complete security-compliant baseline in a
# dedicated customer AWS account:
#   - VPC with public/private/data subnets across 2 AZs
#   - NAT Gateway for outbound private-subnet access
#   - S3 public-access block (account-level)
#   - EBS encryption by default
#   - Customer-managed KMS key for all encryption
#   - CloudTrail (multi-region, log-file validation)
#   - AWS Config (recorder + delivery channel)
#   - IAM account password policy
#   - SecureBase cross-account access role
#   - GuardDuty (fintech / healthcare / government tiers)
#   - Security Hub (fintech / healthcare / government tiers)
#   - Macie (government / sovereign tier only)
#
# Usage:
#   module "customer_baseline" {
#     source      = "../../modules/customer-baseline"
#     customer_id = var.customer_id
#     tier        = var.tier
#     aws_region  = var.aws_region
#     ...
#   }
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Variables ──────────────────────────────────────────────

variable "customer_id" {
  description = "Unique SecureBase customer UUID."
  type        = string
}

variable "customer_name" {
  description = "Human-readable customer / company name."
  type        = string
}

variable "tier" {
  description = "Compliance tier: standard | fintech | healthcare | government."
  type        = string
  validation {
    condition     = contains(["standard", "fintech", "healthcare", "government"], var.tier)
    error_message = "tier must be one of: standard, fintech, healthcare, government."
  }
}

variable "aws_region" {
  description = "Primary AWS region for this customer."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the customer VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "mfa_required" {
  description = "Enforce MFA for all IAM console access."
  type        = bool
  default     = true
}

variable "management_account_id" {
  description = "AWS account ID of the SecureBase management account."
  type        = string
}

variable "audit_log_retention_days" {
  description = "CloudTrail / Config log S3 retention (days). Defaults vary by tier."
  type        = number
  default     = 0  # 0 = derive from tier
}

variable "tags" {
  description = "Additional resource tags to merge."
  type        = map(string)
  default     = {}
}

variable "app_role_arn" {
  description = "IAM role ARN of the application (e.g. Lambda execution role) that may sign/verify with the CMK."
  type        = string
  default     = ""   # empty = no app-sign key created
}

variable "key_admin_role_arn" {
  description = "IAM role ARN allowed to administer the KMS key (rotate, describe, update policy). Defaults to management account root."
  type        = string
  default     = ""   # empty = derived from management_account_id
}

# ── Locals ─────────────────────────────────────────────────

locals {
  tier_retention = {
    standard   = 90
    fintech    = 365
    healthcare = 2555  # 7 years (HIPAA)
    government = 2555
  }

  log_retention_days = (
    var.audit_log_retention_days > 0
    ? var.audit_log_retention_days
    : local.tier_retention[var.tier]
  )

  enhanced_tiers  = ["fintech", "healthcare", "government"]
  sovereign_tiers = ["government"]

  enable_guardduty    = contains(local.enhanced_tiers, var.tier)
  enable_security_hub = contains(local.enhanced_tiers, var.tier)
  enable_macie        = contains(local.sovereign_tiers, var.tier)

  common_tags = merge(
    {
      ManagedBy    = "SecureBase"
      CustomerId   = var.customer_id
      CustomerName = var.customer_name
      Tier         = var.tier
      Environment  = "customer"
    },
    var.tags
  )

  az_suffixes = ["a", "b"]
  azs         = [for s in local.az_suffixes : "${var.aws_region}${s}"]

  # Divide the VPC CIDR into /20 subnets
  pub_cidrs  = [cidrsubnet(var.vpc_cidr, 4, 0), cidrsubnet(var.vpc_cidr, 4, 1)]
  priv_cidrs = [cidrsubnet(var.vpc_cidr, 4, 2), cidrsubnet(var.vpc_cidr, 4, 3)]
  data_cidrs = [cidrsubnet(var.vpc_cidr, 4, 4), cidrsubnet(var.vpc_cidr, 4, 5)]

  # Key admin: prefer explicit role; fall back to management-account root
  _key_admin_arn = (
    var.key_admin_role_arn != ""
    ? var.key_admin_role_arn
    : "arn:aws:iam::${var.management_account_id}:root"
  )
}

# ── KMS customer-managed key ───────────────────────────────

data "aws_caller_identity" "current" {}

# ── KMS key policies ───────────────────────────────────────

# Policy for the encrypt/decrypt key (symmetric AES-256)
# Statements: RootFullAccess, KeyAdminAccess, DenyKeyDeletionForAdmin, AWSServiceEncryptDecrypt
data "aws_iam_policy_document" "kms_encrypt_key_policy" {
  # Statement 1: Root escape-hatch (AWS requirement)
  statement {
    sid    = "RootFullAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  # Statement 2: Key administrators – can rotate/describe/update but NOT delete
  statement {
    sid    = "KeyAdminAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [local._key_admin_arn]
    }
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:RevokeGrant",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:TagResource",
      "kms:UntagResource",
    ]
    resources = ["*"]
  }

  # Statement 3: Explicit deny of deletion for key admin – only root can delete
  statement {
    sid    = "DenyKeyDeletionForAdmin"
    effect = "Deny"
    principals {
      type        = "AWS"
      identifiers = [local._key_admin_arn]
    }
    actions = [
      "kms:ScheduleKeyDeletion",
      "kms:DeleteKey",
    ]
    resources = ["*"]
  }

  # Statement 5 (per spec): AWS services – encrypt/decrypt only
  # Note: Statement 4 (AppSignVerifyOnly) applies to the sign key, not this key.
  # CloudTrail, Config, S3 need GenerateDataKey + Decrypt
  statement {
    sid    = "AWSServiceEncryptDecrypt"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [
        "cloudtrail.amazonaws.com",
        "config.amazonaws.com",
        "s3.amazonaws.com",
      ]
    }
    actions = [
      "kms:GenerateDataKey",
      "kms:Decrypt",
      "kms:DescribeKey",
    ]
    resources = ["*"]
  }
}

# Policy for the sign/verify key (asymmetric ECC_NIST_P256)
# Statements: RootFullAccess, AppSignVerifyOnly
# Only created when var.app_role_arn != ""
data "aws_iam_policy_document" "kms_sign_key_policy" {
  # Statement 1: Root escape-hatch (AWS requirement)
  statement {
    sid    = "RootFullAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  # Statement 4: Application signing role – sign/verify only, no admin or encrypt/decrypt
  dynamic "statement" {
    for_each = var.app_role_arn != "" ? [var.app_role_arn] : []
    content {
      sid    = "AppSignVerifyOnly"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = [statement.value]
      }
      actions = [
        "kms:Sign",
        "kms:Verify",
        "kms:GetPublicKey",
        "kms:DescribeKey",
      ]
      resources = ["*"]
    }
  }
}

# Symmetric AES-256 key – used for S3 SSE, CloudTrail, EBS, Config
# Replaces the former aws_kms_key.main
resource "aws_kms_key" "encrypt" {
  description             = "SecureBase Encrypt CMK – ${var.customer_id}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.kms_encrypt_key_policy.json
  tags                    = merge(local.common_tags, { Name = "securebase-${var.customer_id}-cmk-encrypt" })
}

# Asymmetric ECC key – used by the application for signing tokens/JWTs
# Only created when var.app_role_arn is supplied
resource "aws_kms_key" "sign" {
  count                    = var.app_role_arn != "" ? 1 : 0
  description              = "SecureBase Sign CMK – ${var.customer_id}"
  key_usage                = "SIGN_VERIFY"
  customer_master_key_spec = "ECC_NIST_P256"
  enable_key_rotation      = false   # asymmetric keys do not support automatic rotation
  deletion_window_in_days  = 30
  policy                   = data.aws_iam_policy_document.kms_sign_key_policy.json
  tags                     = merge(local.common_tags, { Name = "securebase-${var.customer_id}-cmk-sign" })
}

resource "aws_kms_alias" "main" {
  name          = "alias/securebase-${var.customer_id}"
  target_key_id = aws_kms_key.encrypt.key_id
}

resource "aws_kms_alias" "sign" {
  count         = var.app_role_arn != "" ? 1 : 0
  name          = "alias/securebase-${var.customer_id}-sign"
  target_key_id = aws_kms_key.sign[0].key_id
}

# ── VPC ────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "securebase-${var.customer_id}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "securebase-${var.customer_id}-igw" })
}

# Public subnets
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.pub_cidrs[count.index]
  availability_zone = local.azs[count.index]
  map_public_ip_on_launch = false
  tags = merge(local.common_tags, {
    Name = "securebase-${var.customer_id}-public-${local.az_suffixes[count.index]}"
    Tier = "public"
  })
}

# Private subnets (application layer)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.priv_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags = merge(local.common_tags, {
    Name = "securebase-${var.customer_id}-private-${local.az_suffixes[count.index]}"
    Tier = "private"
  })
}

# Data subnets (database / storage layer)
resource "aws_subnet" "data" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.data_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags = merge(local.common_tags, {
    Name = "securebase-${var.customer_id}-data-${local.az_suffixes[count.index]}"
    Tier = "data"
  })
}

# NAT Gateway (single AZ – cost-optimised; use one per AZ for HA in prod)
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "securebase-${var.customer_id}-nat-eip" })
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.common_tags, { Name = "securebase-${var.customer_id}-nat" })
  depends_on    = [aws_internet_gateway.main]
}

# Route tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = merge(local.common_tags, { Name = "securebase-${var.customer_id}-rt-public" })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = merge(local.common_tags, { Name = "securebase-${var.customer_id}-rt-private" })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "data" {
  count          = 2
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Account-level S3 & EBS hardening ──────────────────────

resource "aws_s3_account_public_access_block" "main" {
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_ebs_encryption_by_default" "main" {
  enabled = true
}

resource "aws_ebs_default_kms_key" "main" {
  key_arn    = aws_kms_key.encrypt.arn
  depends_on = [aws_kms_key.encrypt]
}

# ── CloudTrail ─────────────────────────────────────────────

resource "aws_s3_bucket" "cloudtrail" {
  bucket        = "securebase-trail-${var.customer_id}"
  force_destroy = false
  tags          = merge(local.common_tags, { Name = "securebase-${var.customer_id}-cloudtrail" })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.encrypt.arn
    }
  }
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  rule {
    id     = "expire-logs"
    status = "Enabled"
    expiration { days = local.log_retention_days }
    filter { prefix = "" }
  }
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  bucket                  = aws_s3_bucket.cloudtrail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "cloudtrail_bucket" {
  statement {
    sid     = "AWSCloudTrailAclCheck"
    actions = ["s3:GetBucketAcl"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    resources = [aws_s3_bucket.cloudtrail.arn]
  }
  statement {
    sid     = "AWSCloudTrailWrite"
    actions = ["s3:PutObject"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    resources = ["${aws_s3_bucket.cloudtrail.arn}/AWSLogs/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }
}

resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  policy = data.aws_iam_policy_document.cloudtrail_bucket.json
}

resource "aws_cloudtrail" "main" {
  name                          = "securebase-${var.customer_id}"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
  kms_key_id                    = aws_kms_key.encrypt.arn
  tags                          = local.common_tags
  depends_on                    = [aws_s3_bucket_policy.cloudtrail]
}

# ── AWS Config ─────────────────────────────────────────────

resource "aws_iam_role" "config" {
  name = "securebase-${var.customer_id}-config-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "config" {
  role       = aws_iam_role.config.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_config_configuration_recorder" "main" {
  name     = "securebase-${var.customer_id}"
  role_arn = aws_iam_role.config.arn
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_s3_bucket" "config" {
  bucket        = "securebase-config-${var.customer_id}"
  force_destroy = false
  tags          = merge(local.common_tags, { Name = "securebase-${var.customer_id}-config" })
}

resource "aws_s3_bucket_public_access_block" "config" {
  bucket                  = aws_s3_bucket.config.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "config" {
  bucket = aws_s3_bucket.config.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.encrypt.arn
    }
  }
}

resource "aws_config_delivery_channel" "main" {
  name           = "securebase-${var.customer_id}"
  s3_bucket_name = aws_s3_bucket.config.bucket
  depends_on     = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  name       = aws_config_configuration_recorder.main.name
  is_enabled = true
  depends_on = [aws_config_delivery_channel.main]
}

# ── IAM password policy ────────────────────────────────────

resource "aws_iam_account_password_policy" "main" {
  minimum_password_length        = 14
  require_uppercase_characters   = true
  require_lowercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
  max_password_age               = 90
  password_reuse_prevention      = 24
  hard_expiry                    = false
}

# ── SecureBase cross-account access role ──────────────────

data "aws_iam_policy_document" "securebase_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.management_account_id}:root"]
    }
    actions = ["sts:AssumeRole"]
    dynamic "condition" {
      for_each = var.mfa_required ? [1] : []
      content {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }

  # Allow SecureBase Lambda functions (running in the management account) to
  # assume this role in the customer account.  The aws:SourceAccount condition
  # restricts the service principal to invocations originating from the
  # SecureBase management account, enforcing least-privilege cross-account access.
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.management_account_id]
    }
  }
}

resource "aws_iam_role" "securebase_access" {
  name               = "SecureBaseAccess"
  assume_role_policy = data.aws_iam_policy_document.securebase_assume.json
  tags               = merge(local.common_tags, { Name = "SecureBaseAccess" })
}

resource "aws_iam_role_policy_attachment" "securebase_readonly" {
  role       = aws_iam_role.securebase_access.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# ── GuardDuty (enhanced + sovereign tiers) ────────────────

resource "aws_guardduty_detector" "main" {
  count  = local.enable_guardduty ? 1 : 0
  enable = true
  tags   = local.common_tags
}

# ── Security Hub (enhanced + sovereign tiers) ─────────────

resource "aws_securityhub_account" "main" {
  count      = local.enable_security_hub ? 1 : 0
  depends_on = [aws_config_configuration_recorder_status.main]
}

resource "aws_securityhub_standards_subscription" "cis" {
  count         = local.enable_security_hub ? 1 : 0
  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/cis-aws-foundations-benchmark/v/1.4.0"
  depends_on    = [aws_securityhub_account.main]
}

resource "aws_securityhub_standards_subscription" "fsbp" {
  count         = local.enable_security_hub ? 1 : 0
  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
  depends_on    = [aws_securityhub_account.main]
}

# ── Macie (sovereign / government tier) ───────────────────

resource "aws_macie2_account" "main" {
  count                        = local.enable_macie ? 1 : 0
  finding_publishing_frequency = "FIFTEEN_MINUTES"
  status                       = "ENABLED"
}

# ── Outputs ────────────────────────────────────────────────

output "vpc_id" {
  description = "Customer VPC ID."
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (application layer)."
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "Data subnet IDs (database layer)."
  value       = aws_subnet.data[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = aws_subnet.public[*].id
}

output "kms_key_arn" {
  description = "ARN of the customer-managed KMS encrypt key (symmetric AES-256)."
  value       = aws_kms_key.encrypt.arn
}

output "kms_key_id" {
  description = "ID of the customer-managed KMS encrypt key (symmetric AES-256)."
  value       = aws_kms_key.encrypt.key_id
}

output "kms_key_alias_arn" {
  description = "Full ARN of the KMS encrypt key alias."
  value       = aws_kms_alias.main.arn
}

output "kms_key_policy_summary" {
  description = "Human-readable summary of key policy statements applied to the encrypt key."
  value = join(", ", compact([
    "RootFullAccess",
    "KeyAdminAccess",
    "DenyKeyDeletionForAdmin",
    "AWSServiceEncryptDecrypt",
  ]))
}

output "kms_sign_key_arn" {
  description = "ARN of the KMS sign key (asymmetric ECC_NIST_P256). Empty string when app_role_arn is not set."
  value       = var.app_role_arn != "" ? aws_kms_key.sign[0].arn : ""
}

output "kms_sign_key_id" {
  description = "ID of the KMS sign key (asymmetric ECC_NIST_P256). Empty string when app_role_arn is not set."
  value       = var.app_role_arn != "" ? aws_kms_key.sign[0].key_id : ""
}

output "cloudtrail_bucket" {
  description = "S3 bucket name for CloudTrail logs."
  value       = aws_s3_bucket.cloudtrail.bucket
}

output "config_bucket" {
  description = "S3 bucket name for AWS Config snapshots."
  value       = aws_s3_bucket.config.bucket
}

output "securebase_access_role_arn" {
  description = "ARN of the SecureBase cross-account access role."
  value       = aws_iam_role.securebase_access.arn
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID (empty string for standard tier)."
  value       = local.enable_guardduty ? aws_guardduty_detector.main[0].id : ""
}
