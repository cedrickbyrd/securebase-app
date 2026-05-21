terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_organizations_organization" "current" {}

variable "project_name" {
  description = "Project prefix used for Config rule naming."
  type        = string
  default     = "securebase"
}

variable "environment" {
  description = "Environment name (dev/staging/prod)."
  type        = string
}

variable "tenant_account_ids" {
  description = "Tenant account IDs discovered from Organizations data sources in the root module."
  type        = list(string)
  default     = []
}

variable "healthcare_account_ids" {
  description = "Healthcare OU tenant account IDs discovered from Organizations data sources in the root module."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to AWS Config managed rules."
  type        = map(string)
  default     = {}
}

locals {
  non_healthcare_account_ids = tolist(setsubtract(toset(var.tenant_account_ids), toset(var.healthcare_account_ids)))

  managed_rules = {
    "cloudtrail-enabled"                                     = { identifier = "CLOUD_TRAIL_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "HIPAA", "FedRAMP"] }
    "cloudtrail-s3-dataevents-enabled"                      = { identifier = "CLOUDTRAIL_S3_DATAEVENTS_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2"] }
    "cloudtrail-log-file-validation-enabled"                = { identifier = "CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2"] }
    "guardduty-enabled-centralized"                         = { identifier = "GUARDDUTY_ENABLED_CENTRALIZED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "HIPAA"] }
    "iam-password-policy"                                   = { identifier = "IAM_PASSWORD_POLICY", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2"] }
    "iam-root-access-key-check"                             = { identifier = "IAM_ROOT_ACCESS_KEY_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "HIPAA"] }
    "iam-user-mfa-enabled"                                  = { identifier = "IAM_USER_MFA_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2"] }
    "root-account-mfa-enabled"                              = { identifier = "ROOT_ACCOUNT_MFA_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "HIPAA"] }
    "s3-bucket-public-read-prohibited"                      = { identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "FedRAMP"] }
    "s3-bucket-public-write-prohibited"                     = { identifier = "S3_BUCKET_PUBLIC_WRITE_PROHIBITED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["SOC2", "FedRAMP"] }
    "s3-bucket-ssl-requests-only"                           = { identifier = "S3_BUCKET_SSL_REQUESTS_ONLY", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "HIPAA", "FedRAMP"] }
    "encrypted-volumes"                                     = { identifier = "ENCRYPTED_VOLUMES", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "HIPAA"] }
    "rds-storage-encrypted"                                 = { identifier = "RDS_STORAGE_ENCRYPTED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "HIPAA"] }
    "vpc-flow-logs-enabled"                                 = { identifier = "VPC_FLOW_LOGS_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "HIPAA", "FedRAMP"] }
    "restricted-ssh"                                        = { identifier = "INCOMING_SSH_DISABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "CIS"] }
    "restricted-common-ports"                               = { identifier = "VPC_SG_PORT_RESTRICTION_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["SOC2", "CIS"] }

    "dynamodb-pitr-enabled"                                 = { identifier = "DYNAMODB_PITR_ENABLED", mode = "CONTINUOUS", healthcare_only = true, severity = "High", frameworks = ["HIPAA"] }
    "rds-automatic-minor-version-upgrade-enabled"           = { identifier = "RDS_AUTOMATIC_MINOR_VERSION_UPGRADE_ENABLED", mode = "CONTINUOUS", healthcare_only = true, severity = "Medium", frameworks = ["HIPAA"] }
    "rds-instance-deletion-protection-enabled"              = { identifier = "RDS_INSTANCE_DELETION_PROTECTION_ENABLED", mode = "CONTINUOUS", healthcare_only = true, severity = "High", frameworks = ["HIPAA"] }
    "kms-cmk-not-scheduled-for-deletion"                    = { identifier = "KMS_CMK_NOT_SCHEDULED_FOR_DELETION", mode = "CONTINUOUS", healthcare_only = true, severity = "High", frameworks = ["HIPAA", "FedRAMP"] }
    "ec2-instances-in-vpc"                                  = { identifier = "INSTANCES_IN_VPC", mode = "CONTINUOUS", healthcare_only = true, severity = "Medium", frameworks = ["HIPAA"] }
    "s3-bucket-logging-enabled"                             = { identifier = "S3_BUCKET_LOGGING_ENABLED", mode = "CONTINUOUS", healthcare_only = true, severity = "Medium", frameworks = ["HIPAA", "FedRAMP"] }
    "cloudwatch-log-group-encrypted"                        = { identifier = "CLOUDWATCH_LOG_GROUP_ENCRYPTED", mode = "CONTINUOUS", healthcare_only = true, severity = "High", frameworks = ["HIPAA"] }
    "backup-plan-min-frequency-and-min-retention-check"     = { identifier = "BACKUP_PLAN_MIN_FREQUENCY_AND_MIN_RETENTION_CHECK", mode = "PERIODIC", healthcare_only = true, severity = "High", frameworks = ["HIPAA"] }
    "acm-certificate-expiration-check"                      = { identifier = "ACM_CERTIFICATE_EXPIRATION_CHECK", mode = "PERIODIC", healthcare_only = true, severity = "Medium", frameworks = ["HIPAA"] }
    "wafv2-webacl-not-empty"                                = { identifier = "WAFV2_WEBACL_NOT_EMPTY", mode = "CONTINUOUS", healthcare_only = true, severity = "Medium", frameworks = ["HIPAA"] }

    "config-enabled-in-region"                              = { identifier = "CONFIG_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["FedRAMP"] }
    "securityhub-enabled"                                   = { identifier = "SECURITYHUB_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "ec2-imdsv2-check"                                      = { identifier = "EC2_IMDSV2_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "lambda-function-public-access-prohibited"              = { identifier = "LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "api-gw-ssl-enabled"                                    = { identifier = "API_GW_SSL_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "alb-http-to-https-redirection-check"                   = { identifier = "ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "Medium", frameworks = ["FedRAMP"] }
    "elb-tls-https-listeners-only"                          = { identifier = "ELB_TLS_HTTPS_LISTENERS_ONLY", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "iam-no-inline-policy-check"                            = { identifier = "IAM_NO_INLINE_POLICY_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP"] }
    "iam-policy-no-statements-with-admin-access"            = { identifier = "IAM_POLICY_NO_STATEMENTS_WITH_ADMIN_ACCESS", mode = "CONTINUOUS", healthcare_only = false, severity = "Critical", frameworks = ["FedRAMP"] }
    "access-keys-rotated"                                   = { identifier = "ACCESS_KEYS_ROTATED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP", "SOC2"] }
    "secretsmanager-rotation-enabled-check"                 = { identifier = "SECRETSMANAGER_ROTATION_ENABLED_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["FedRAMP", "SOC2"] }
    "s3-bucket-versioning-enabled"                          = { identifier = "S3_BUCKET_VERSIONING_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "Medium", frameworks = ["FedRAMP", "HIPAA"] }

    "s3-bucket-server-side-encryption-enabled"              = { identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS", "SOC2"] }
    "s3-account-level-public-access-blocks-periodic"        = { identifier = "S3_ACCOUNT_LEVEL_PUBLIC_ACCESS_BLOCKS", mode = "PERIODIC", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "s3-bucket-level-public-access-prohibited"              = { identifier = "S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "s3-bucket-replication-enabled"                         = { identifier = "S3_BUCKET_REPLICATION_ENABLED", mode = "CONTINUOUS", healthcare_only = false, severity = "Low", frameworks = ["CIS"] }
    "ebs-snapshot-public-restorable-check"                  = { identifier = "EBS_SNAPSHOT_PUBLIC_RESTORABLE_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "ebs-optimized-instance"                                = { identifier = "EBS_OPTIMIZED_INSTANCE", mode = "CONTINUOUS", healthcare_only = false, severity = "Low", frameworks = ["CIS"] }
    "ec2-instance-no-public-ip"                             = { identifier = "EC2_INSTANCE_NO_PUBLIC_IP", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "ec2-volume-inuse-check"                                = { identifier = "EC2_VOLUME_INUSE_CHECK", mode = "PERIODIC", healthcare_only = false, severity = "Low", frameworks = ["CIS"] }
    "eip-attached"                                          = { identifier = "EIP_ATTACHED", mode = "CONTINUOUS", healthcare_only = false, severity = "Low", frameworks = ["CIS"] }
    "internet-gateway-authorized-vpc-only"                 = { identifier = "INTERNET_GATEWAY_AUTHORIZED_VPC_ONLY", mode = "CONTINUOUS", healthcare_only = false, severity = "Medium", frameworks = ["CIS"] }
    "vpc-default-security-group-closed"                     = { identifier = "VPC_DEFAULT_SECURITY_GROUP_CLOSED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "cloudwatch-log-group-retention-period-check"           = { identifier = "CLOUDWATCH_LOG_GROUP_RETENTION_PERIOD_CHECK", mode = "PERIODIC", healthcare_only = false, severity = "Medium", frameworks = ["CIS"] }
    "rds-snapshots-public-prohibited"                       = { identifier = "RDS_SNAPSHOTS_PUBLIC_PROHIBITED", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "redshift-cluster-public-access-check"                  = { identifier = "REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK", mode = "CONTINUOUS", healthcare_only = false, severity = "High", frameworks = ["CIS"] }
    "autoscaling-group-elb-healthcheck-required"            = { identifier = "AUTOSCALING_GROUP_ELB_HEALTHCHECK_REQUIRED", mode = "CONTINUOUS", healthcare_only = false, severity = "Medium", frameworks = ["CIS"] }
    "desired-instance-tenancy"                              = { identifier = "DESIRED_INSTANCE_TENANCY", mode = "CONTINUOUS", healthcare_only = false, severity = "Low", frameworks = ["CIS"] }
  }
}

resource "aws_config_organization_managed_rule" "phase6" {
  for_each = local.managed_rules

  name            = each.key
  description     = "${var.project_name} ${var.environment} ${join("/", each.value.frameworks)} ${each.key}"
  rule_identifier = each.value.identifier

  excluded_accounts = each.value.healthcare_only ? local.non_healthcare_account_ids : null

  maximum_execution_frequency = each.value.mode == "PERIODIC" ? "TwentyFour_Hours" : null

  input_parameters = each.key == "access-keys-rotated" ? jsonencode({
    maxAccessKeyAge = "90"
  }) : null

  tags = merge(var.tags, {
    Environment         = var.environment
    Phase               = "6.2"
    ComplianceFramework = join(",", each.value.frameworks)
    EvaluationMode      = each.value.mode
    Severity            = each.value.severity
  })
}
