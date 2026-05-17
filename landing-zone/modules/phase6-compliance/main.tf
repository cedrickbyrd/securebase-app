# Phase 6.2 — Compliance Automation Module
# Deploys 25+ AWS Config managed rules mapped to SOC 2, HIPAA, and FedRAMP
# controls.  Includes HIPAA and NIST 800-53 conformance packs.
#
# IMPORTANT: This module uses a `count` guard on the Config recorder to avoid
# conflicts with the phase1 security module.  Set
#   var.config_recorder_already_enabled = true
# if the recorder is already deployed.
#
# Usage:
#   module "phase6_compliance" {
#     source                          = "../../modules/phase6-compliance"
#     environment                     = var.environment
#     project_name                    = "securebase"
#     config_delivery_bucket_name     = "securebase-config-logs-${var.environment}"
#     config_recorder_already_enabled = true
#     tags                            = local.common_tags
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# AWS Config Recorder
# Guard: only create if not already enabled by phase1 security module.
# ============================================================================

resource "aws_iam_role" "config_recorder" {
  count = var.config_recorder_already_enabled ? 0 : 1
  name  = "${var.project_name}-${var.environment}-config-recorder"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "config.amazonaws.com"
      }
    }]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-config-recorder"
    Environment = var.environment
    Phase       = "6.2"
  })
}

resource "aws_iam_role_policy_attachment" "config_recorder" {
  count      = var.config_recorder_already_enabled ? 0 : 1
  role       = aws_iam_role.config_recorder[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_config_configuration_recorder" "this" {
  count    = var.config_recorder_already_enabled ? 0 : 1
  name     = "${var.project_name}-${var.environment}-config-recorder"
  role_arn = aws_iam_role.config_recorder[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "this" {
  count          = var.config_recorder_already_enabled ? 0 : 1
  name           = "${var.project_name}-${var.environment}-config-delivery"
  s3_bucket_name = var.config_delivery_bucket_name

  depends_on = [aws_config_configuration_recorder.this]
}

resource "aws_config_configuration_recorder_status" "this" {
  count      = var.config_recorder_already_enabled ? 0 : 1
  name       = aws_config_configuration_recorder.this[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.this]
}

# ============================================================================
# AWS Config Managed Rules — SOC 2 Controls
# ============================================================================

resource "aws_config_config_rule" "s3_ssl_requests_only" {
  name        = "${var.project_name}-${var.environment}-s3-ssl-requests-only"
  description = "SOC2 CC6.7 / FedRAMP SC-8: S3 buckets must require SSL for all requests"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SSL_REQUESTS_ONLY"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "encrypted_volumes" {
  name        = "${var.project_name}-${var.environment}-encrypted-volumes"
  description = "SOC2 CC9.2 / HIPAA 164.312(e)(2)(ii): EBS volumes must be encrypted"

  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "iam_password_policy" {
  name        = "${var.project_name}-${var.environment}-iam-password-policy"
  description = "SOC2 CC6.2: IAM password policy must meet complexity requirements"

  source {
    owner             = "AWS"
    source_identifier = "IAM_PASSWORD_POLICY"
  }

  input_parameters = jsonencode({
    RequireUppercaseCharacters = "true"
    RequireLowercaseCharacters = "true"
    RequireSymbols             = "true"
    RequireNumbers             = "true"
    MinimumPasswordLength      = "14"
    PasswordReusePrevention    = "24"
    MaxPasswordAge             = "90"
  })

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "mfa_iam_console" {
  name        = "${var.project_name}-${var.environment}-mfa-iam-console"
  description = "SOC2 CC6.1 / FedRAMP IA-2: MFA must be enabled for IAM console access"

  source {
    owner             = "AWS"
    source_identifier = "MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "root_account_mfa" {
  name        = "${var.project_name}-${var.environment}-root-account-mfa"
  description = "SOC2 CC9.1 / CIS 1.13: Root account must have MFA enabled"

  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCOUNT_MFA_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "cloudtrail_enabled" {
  name        = "${var.project_name}-${var.environment}-cloudtrail-enabled"
  description = "SOC2 CC7.1 / HIPAA 164.312(b) / FedRAMP AU-2: CloudTrail must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "cloudtrail_log_validation" {
  name        = "${var.project_name}-${var.environment}-cloudtrail-log-validation"
  description = "SOC2 CC7.1 / FedRAMP AU-9: CloudTrail log file validation must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "vpc_flow_logs" {
  name        = "${var.project_name}-${var.environment}-vpc-flow-logs"
  description = "SOC2 CC8.1 / FedRAMP SC-7 / HIPAA 164.312(e)(2)(i): VPC flow logs must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "VPC_FLOW_LOGS_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "guardduty_enabled" {
  name        = "${var.project_name}-${var.environment}-guardduty-enabled"
  description = "SOC2 CC6.8 / HIPAA 164.308(a)(1) / FedRAMP SI-3: GuardDuty must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "GUARDDUTY_ENABLED_CENTRALIZED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "s3_bucket_logging" {
  name        = "${var.project_name}-${var.environment}-s3-bucket-logging"
  description = "FedRAMP AU-9: S3 bucket access logging must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_LOGGING_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "s3_bucket_versioning" {
  name        = "${var.project_name}-${var.environment}-s3-bucket-versioning"
  description = "HIPAA 164.312(c)(1) / FedRAMP CM-6: S3 bucket versioning must be enabled"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_VERSIONING_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "s3_public_read_prohibited" {
  name        = "${var.project_name}-${var.environment}-s3-public-read-prohibited"
  description = "SOC2 CC6.6 / FedRAMP AC-3: S3 bucket public read access must be prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "s3_public_write_prohibited" {
  name        = "${var.project_name}-${var.environment}-s3-public-write-prohibited"
  description = "SOC2 CC6.6 / FedRAMP AC-3: S3 bucket public write access must be prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_WRITE_PROHIBITED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "iam_no_inline_policy" {
  name        = "${var.project_name}-${var.environment}-iam-no-inline-policy"
  description = "SOC2 CC6.3 / FedRAMP AC-2: IAM users must not have inline policies"

  source {
    owner             = "AWS"
    source_identifier = "IAM_NO_INLINE_POLICY_CHECK"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "iam_root_access_key" {
  name        = "${var.project_name}-${var.environment}-iam-root-access-key"
  description = "SOC2 CC6.4 / HIPAA 164.312(a)(1): Root account must not have active access keys"

  source {
    owner             = "AWS"
    source_identifier = "IAM_ROOT_ACCESS_KEY_CHECK"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "access_keys_rotated" {
  name        = "${var.project_name}-${var.environment}-access-keys-rotated"
  description = "SOC2 CC6.5 / FedRAMP IA-5: IAM access keys must be rotated within 90 days"

  source {
    owner             = "AWS"
    source_identifier = "ACCESS_KEYS_ROTATED"
  }

  input_parameters = jsonencode({
    maxAccessKeyAge = "90"
  })

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "rds_public_access" {
  name        = "${var.project_name}-${var.environment}-rds-no-public-access"
  description = "FedRAMP AC-17: RDS instances must not be publicly accessible"

  source {
    owner             = "AWS"
    source_identifier = "RDS_INSTANCE_PUBLIC_ACCESS_CHECK"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "rds_storage_encrypted" {
  name        = "${var.project_name}-${var.environment}-rds-storage-encrypted"
  description = "SOC2 CC9.3 / HIPAA 164.312(a)(2)(iv): RDS storage must be encrypted"

  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "rds_multi_az" {
  name        = "${var.project_name}-${var.environment}-rds-multi-az"
  description = "FedRAMP SI-2 / CIS: RDS instances must have Multi-AZ enabled"

  source {
    owner             = "AWS"
    source_identifier = "RDS_MULTI_AZ_SUPPORT"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "lambda_no_public_access" {
  name        = "${var.project_name}-${var.environment}-lambda-no-public-access"
  description = "SOC2 CC6.6: Lambda functions must not allow public access"

  source {
    owner             = "AWS"
    source_identifier = "LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "api_gw_ssl" {
  name        = "${var.project_name}-${var.environment}-api-gw-ssl"
  description = "HIPAA 164.312(e)(1): API Gateway stages must have SSL client certificate enabled"

  source {
    owner             = "AWS"
    source_identifier = "API_GW_SSL_ENABLED"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "cloudwatch_alarm_action" {
  name        = "${var.project_name}-${var.environment}-cloudwatch-alarm-action"
  description = "SOC2 CC7.2: CloudWatch alarms must have at least one action configured"

  source {
    owner             = "AWS"
    source_identifier = "CLOUDWATCH_ALARM_ACTION_CHECK"
  }

  input_parameters = jsonencode({
    alarmActionRequired            = "true"
    insufficientDataActionRequired = "false"
    okActionRequired               = "false"
  })

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "kms_not_scheduled_deletion" {
  name        = "${var.project_name}-${var.environment}-kms-not-deletion"
  description = "FedRAMP SI-7: KMS CMKs must not be scheduled for deletion"

  source {
    owner             = "AWS"
    source_identifier = "KMS_CMK_NOT_SCHEDULED_FOR_DELETION"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "secretsmanager_rotation" {
  name        = "${var.project_name}-${var.environment}-secretsmanager-rotation"
  description = "SOC2 CC9.4: Secrets Manager secrets must have automatic rotation enabled"

  source {
    owner             = "AWS"
    source_identifier = "SECRETSMANAGER_ROTATION_ENABLED_CHECK"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "ec2_imdsv2" {
  name        = "${var.project_name}-${var.environment}-ec2-imdsv2"
  description = "FedRAMP CM-2 / HIPAA 164.308(a)(5): EC2 instances must use IMDSv2"

  source {
    owner             = "AWS"
    source_identifier = "EC2_IMDSV2_CHECK"
  }

  tags = local.config_rule_tags
}

resource "aws_config_config_rule" "dynamodb_backup_plan" {
  name        = "${var.project_name}-${var.environment}-dynamodb-backup-plan"
  description = "SOC2 / CIS: DynamoDB tables must be covered by a backup plan"

  source {
    owner             = "AWS"
    source_identifier = "DYNAMODB_IN_BACKUP_PLAN"
  }

  tags = local.config_rule_tags
}

# ============================================================================
# AWS Config Conformance Packs
# ============================================================================

resource "aws_config_conformance_pack" "hipaa" {
  count = var.enable_hipaa_conformance_pack ? 1 : 0
  name  = "${var.project_name}-${var.environment}-hipaa"

  template_body = <<-EOT
    Parameters:
      ConformancePackName:
        Type: String
    Resources:
      HIPAAConformancePack:
        Type: AWS::Config::ConformancePack
        Properties:
          ConformancePackName: !Ref ConformancePackName
  EOT

  # TODO: Replace with the managed AWS HIPAA conformance pack template URL
  # when deploying to production.  The template_body above is a placeholder.
}

resource "aws_config_conformance_pack" "nist_800_53" {
  count = var.enable_nist_conformance_pack ? 1 : 0
  name  = "${var.project_name}-${var.environment}-nist-800-53"

  template_body = <<-EOT
    Parameters:
      ConformancePackName:
        Type: String
    Resources:
      NISTConformancePack:
        Type: AWS::Config::ConformancePack
        Properties:
          ConformancePackName: !Ref ConformancePackName
  EOT

  # TODO: Replace with the managed AWS NIST 800-53 conformance pack template URL
  # when deploying to production.  The template_body above is a placeholder.
}

# ============================================================================
# Local values
# ============================================================================

locals {
  config_rule_tags = merge(var.tags, {
    Environment         = var.environment
    Phase               = "6.2"
    ComplianceFramework = "SOC2,HIPAA,FedRAMP,CIS"
  })
}
