# Outputs for Phase 6.2 Compliance Automation Module

output "config_rule_arns" {
  description = "Map of Config rule names to their ARNs"
  value = {
    s3_ssl_requests_only    = aws_config_rule.s3_ssl_requests_only.arn
    encrypted_volumes       = aws_config_rule.encrypted_volumes.arn
    iam_password_policy     = aws_config_rule.iam_password_policy.arn
    mfa_iam_console         = aws_config_rule.mfa_iam_console.arn
    root_account_mfa        = aws_config_rule.root_account_mfa.arn
    cloudtrail_enabled      = aws_config_rule.cloudtrail_enabled.arn
    cloudtrail_log_valid    = aws_config_rule.cloudtrail_log_validation.arn
    vpc_flow_logs           = aws_config_rule.vpc_flow_logs.arn
    guardduty_enabled       = aws_config_rule.guardduty_enabled.arn
    s3_bucket_logging       = aws_config_rule.s3_bucket_logging.arn
    s3_bucket_versioning    = aws_config_rule.s3_bucket_versioning.arn
    s3_public_read_prohib   = aws_config_rule.s3_public_read_prohibited.arn
    s3_public_write_prohib  = aws_config_rule.s3_public_write_prohibited.arn
    iam_no_inline_policy    = aws_config_rule.iam_no_inline_policy.arn
    iam_root_access_key     = aws_config_rule.iam_root_access_key.arn
    access_keys_rotated     = aws_config_rule.access_keys_rotated.arn
    rds_no_public_access    = aws_config_rule.rds_public_access.arn
    rds_storage_encrypted   = aws_config_rule.rds_storage_encrypted.arn
    rds_multi_az            = aws_config_rule.rds_multi_az.arn
    lambda_no_public_access = aws_config_rule.lambda_no_public_access.arn
    api_gw_ssl              = aws_config_rule.api_gw_ssl.arn
    cloudwatch_alarm_action = aws_config_rule.cloudwatch_alarm_action.arn
    kms_not_scheduled_del   = aws_config_rule.kms_not_scheduled_deletion.arn
    secretsmanager_rotation = aws_config_rule.secretsmanager_rotation.arn
    ec2_imdsv2              = aws_config_rule.ec2_imdsv2.arn
    dynamodb_backup_plan    = aws_config_rule.dynamodb_backup_plan.arn
  }
}

output "config_rule_count" {
  description = "Total number of AWS Config rules deployed by this module"
  value       = 26
}

output "config_recorder_role_arn" {
  description = "ARN of the IAM role used by the Config recorder (null if recorder_already_enabled)"
  value       = length(aws_iam_role.config_recorder) > 0 ? aws_iam_role.config_recorder[0].arn : null
}

output "hipaa_conformance_pack_arn" {
  description = "ARN of the HIPAA conformance pack (null if not enabled)"
  value       = length(aws_config_conformance_pack.hipaa) > 0 ? aws_config_conformance_pack.hipaa[0].arn : null
}

output "nist_conformance_pack_arn" {
  description = "ARN of the NIST 800-53 conformance pack (null if not enabled)"
  value       = length(aws_config_conformance_pack.nist_800_53) > 0 ? aws_config_conformance_pack.nist_800_53[0].arn : null
}
