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
