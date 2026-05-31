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
  macie_alert_email          = var.alert_email

  tags = merge(var.tags, {
    Phase = "6"
    Track = "1"
  })
}

# ============================================================================
# Phase 6 / Track 2: Compliance Automation (50+ Config rules, scoring)
# ============================================================================
module "phase6_compliance" {
  source = "../../modules/phase6-compliance"

  environment                     = var.environment
  project_name                    = "securebase"
  config_delivery_bucket_name     = var.audit_log_bucket_name
  config_recorder_already_enabled = true
  enable_hipaa_conformance_pack   = true
  enable_nist_conformance_pack    = true

  tags = merge(var.tags, {
    Phase = "6"
    Track = "2"
  })

  depends_on = [module.phase6_audit_logging]
}

# ============================================================================
# Phase 6 / Track 2: Lambda functions (evidence API, audit_log_packager,
#                    compliance history API, score recalculator)
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

  depends_on = [module.phase6_audit_logging, module.phase6_compliance]
}

# ============================================================================
# Phase 6 / Track 2: Alerting — packager failure + score recalculator alarms
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
# Phase 6 / Track 4: Distributed tracing and anomaly observability
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
# Phase 6 / Track 5: Cost-per-tenant reporting and CloudWatch alarms
# ============================================================================
module "phase6_cost" {
  source = "../../modules/phase6-cost"

  environment                      = var.environment
  cost_per_tenant_lambda_zip       = "${path.module}/../../files/phase6/cost_per_tenant.zip"
  alert_sns_arn                    = var.alert_sns_arn
  monthly_cost_alert_threshold_usd = 50

  tags = merge(var.tags, {
    Phase = "6"
    Track = "5"
  })
}

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

terraform {
  required_version = ">= 1.5.0"

  # Backend configured at init time:
  #   terraform init -backend-config=prod-backend.hcl
  # Example prod-backend.hcl:
  #   bucket         = "securebase-terraform-state-prod"
  #   key            = "prod/securebase.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "securebase-terraform-locks"
  #   encrypt        = true
  backend "s3" {}
}
