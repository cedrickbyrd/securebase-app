provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

data "aws_sns_topic" "alerts" {
  name = var.alert_topic_name
}

# ============================================================================
# Phase 6 / Track 1: Immutable Audit Logging + Evidence Vault
# ============================================================================
module "phase6_audit_logging" {
  source = "../../modules/phase6-audit-logging"

  environment                = var.environment
  project_name               = "securebase"
  evidence_bucket_name       = "securebase-evidence-${var.environment}"
  audit_source_bucket_name   = var.audit_log_bucket_name
  object_lock_retention_days = 2555
  macie_already_enabled      = true
  enable_macie_scan          = false
  macie_alert_email          = var.alert_email

  tags = merge(var.tags, {
    Phase = "6"
    Track = "1"
  })
}

# ============================================================================
# Phase 6 / Track 2: Compliance Automation (26 Config rules)
# Conformance packs disabled — require valid CloudFormation templates in S3
# ============================================================================
module "phase6_compliance" {
  source = "../../modules/phase6-compliance"

  environment                     = var.environment
  project_name                    = "securebase"
  config_delivery_bucket_name     = var.audit_log_bucket_name
  config_recorder_already_enabled = true
  enable_hipaa_conformance_pack   = false
  enable_nist_conformance_pack    = false

  tags = merge(var.tags, {
    Phase = "6"
    Track = "2"
  })

  depends_on = [module.phase6_audit_logging]
}

# ============================================================================
# Phase 6 / Track 2: Lambda functions
# ============================================================================
module "phase6_lambdas" {
  source = "../../modules/phase6-lambda-functions"

  environment                       = var.environment
  audit_evidence_api_zip            = "${path.module}/../../files/phase6/audit_evidence_api.zip"
  audit_log_packager_zip            = "${path.module}/../../files/phase6/audit_log_packager.zip"
  compliance_history_api_zip        = "${path.module}/../../files/phase6/compliance_history_api.zip"
  compliance_score_recalculator_zip = "${path.module}/../../files/phase6/compliance_score_recalculator.zip"
  evidence_bucket_name              = module.phase6_audit_logging.evidence_bucket_name
  evidence_kms_key_arn              = module.phase6_audit_logging.kms_key_arn
  audit_packager_role_arn           = module.phase6_audit_logging.lambda_role_arn
  audit_source_bucket_name          = var.audit_log_bucket_name
  rds_proxy_endpoint                = var.rds_proxy_endpoint
  private_subnet_ids                = var.lambda_private_subnet_ids
  security_group_ids                = var.lambda_security_group_ids
  alert_sns_arn                     = data.aws_sns_topic.alerts.arn

  tags = merge(var.tags, { Phase = "6" })

  depends_on = [module.phase6_audit_logging]
}

# ============================================================================
# Phase 6 / Track 2: Alerting
# ============================================================================
module "phase6_alerting" {
  source = "../../modules/phase6-alerting"

  environment   = var.environment
  sns_topic_arn = data.aws_sns_topic.alerts.arn

  packager_function_name = "securebase-${var.environment}-audit-log-packager"
  packager_log_group     = "/aws/lambda/securebase-${var.environment}-audit-log-packager"

  score_recalculator_function_name = module.phase6_lambdas.compliance_score_recalculator_name
  score_recalculator_log_group     = module.phase6_lambdas.compliance_score_recalculator_log_group

  tags = merge(var.tags, {
    Phase = "6"
    Track = "2"
  })

  depends_on = [module.phase6_lambdas]
}

# ============================================================================
# Phase 6 / Track 4: Distributed tracing
# ============================================================================
module "phase6_tracing" {
  source = "../../modules/phase6-tracing"

  environment = var.environment
  aws_region  = var.target_region

  api_gateway_name           = var.api_gateway_name
  api_gateway_stage          = var.api_gateway_stage
  api_gateway_log_group_name = var.api_gateway_log_group_name
  sns_topic_arn              = data.aws_sns_topic.alerts.arn

  lambda_function_names       = var.lambda_function_names
  lambda_execution_role_names = var.lambda_execution_role_names
  xray_tenant_filters         = var.xray_tenant_filters

  tags = var.tags
}

# ============================================================================
# Phase 6 / Track 5: Cost-per-tenant — DISABLED pending cost_per_tenant.zip build
# ============================================================================
# module "phase6_cost" { ... }

module "marketplace" {
  count = alltrue([
    contains(keys(var.lambda_packages), "marketplace_resolve_customer"),
    contains(keys(var.lambda_packages), "marketplace_subscription_handler"),
    contains(keys(var.lambda_packages), "marketplace_metering_worker"),
    var.marketplace_product_code != "",
    var.marketplace_db_host != "",
    var.marketplace_db_secret_arn != "",
    var.marketplace_lambda_role_arn != "",
    length(var.marketplace_private_subnet_ids) > 0,
    var.marketplace_lambda_security_group_id != "",
  ]) ? 1 : 0

  source = "../../modules/marketplace"

  environment                   = var.environment
  aws_region                    = var.target_region
  lambda_packages               = var.lambda_packages
  lambda_role_arn               = var.marketplace_lambda_role_arn
  db_host                       = var.marketplace_db_host
  db_secret_arn                 = var.marketplace_db_secret_arn
  alerts_sns_topic_arn          = var.marketplace_alerts_sns_topic_arn
  ceo_sns_topic_arn             = var.marketplace_ceo_sns_topic_arn
  marketplace_product_code      = var.marketplace_product_code
  private_subnet_ids            = var.marketplace_private_subnet_ids
  lambda_security_group_id      = var.marketplace_lambda_security_group_id
  aws_marketplace_sns_topic_arn = var.aws_marketplace_sns_topic_arn
  tags                          = merge(var.tags, { Phase = "marketplace" })
}

# ============================================================================
# Phase 6 / DB Migrator
# ============================================================================
module "db_migrator" {
  source = "../../modules/db-migrator"

  environment        = var.environment
  vpc_id             = "vpc-003c9d5b0f9f1a02b"
  private_subnet_ids = ["subnet-0783b18ae893a8df9", "subnet-0f3dfdab04381608c"]
  zip_path           = "${path.module}/../../../files/phase6/db_migrator.zip"
  allowed_secret_arns = [
    "arn:aws:secretsmanager:us-east-1:731184206915:secret:securebase/dev/rds/admin-password-sejDay"
  ]
  invoker_role_arns = [
    "arn:aws:iam::731184206915:role/GitHubActionsRole"
  ]

  tags = merge(var.tags, {
    Phase = "6"
    Track = "migrations"
  })
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {}
}
