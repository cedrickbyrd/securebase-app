provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

provider "aws" {
  alias  = "secondary"
  region = "us-west-2"

  default_tags {
    tags = var.tags
  }
}

provider "netlify" {
  token = var.netlify_token
}

locals {
  phase5_lambda_names = [
    "securebase-${var.environment}-auth-v2",
    "securebase-${var.environment}-webhook-manager",
    "securebase-${var.environment}-billing-worker",
    "securebase-${var.environment}-support-tickets",
    "securebase-${var.environment}-cost-forecasting",
    "securebase-${var.environment}-health-check",
    "securebase-${var.environment}-submit-lead",
    "securebase-${var.environment}-metrics-aggregation",
    "securebase-${var.environment}-tenant-metrics",
    "securebase-${var.environment}-alert-router",
    "securebase-${var.environment}-health-check-aggregator",
    "securebase-${var.environment}-failover-orchestrator",
    "securebase-${var.environment}-failback-orchestrator",
  ]
  # Track 1 fallback: use existing audit log bucket when provided, otherwise
  # use the standard securebase-audit-logs-{env} naming convention.
  phase6_audit_source_bucket = var.audit_log_bucket_name != "" ? var.audit_log_bucket_name : "securebase-audit-logs-${var.environment}"
}

data "aws_ssoadmin_instances" "this" {}

module "securebase" {
  source = "../.." 
  sso_instance_arn = tolist(data.aws_ssoadmin_instances.this.arns)[0]

  org_name        = var.org_name
  target_region   = var.target_region
  environment     = var.environment
  accounts        = var.accounts
  allowed_regions = var.allowed_regions
  clients         = var.clients
  tags            = var.tags
  stripe_public_key    = var.stripe_public_key
  stripe_secret_key    = var.stripe_secret_key
  netlify_api_token    = var.netlify_token
  lambda_packages      = var.lambda_packages
  default_vpc_id       = var.default_vpc_id
  lambda_subnets       = var.lambda_subnets
  database_subnets     = var.database_subnets
  max_aurora_capacity  = var.max_aurora_capacity
  min_aurora_capacity  = var.min_aurora_capacity
  rds_backup_retention = var.rds_backup_retention
  demo_auth_password   = var.demo_auth_password
  demo_auth_jwt_secret = var.demo_auth_jwt_secret
  sre_metrics_lambda_invoke_arn = module.phase5_sre_metrics.sre_metrics_lambda_invoke_arn
  sre_metrics_lambda_name       = module.phase5_sre_metrics.sre_metrics_lambda_name
}

module "analytics" {
  source = "../../modules/analytics"

  environment         = var.environment
  reporting_layer_arn = var.reporting_layer_arn
  tags                = var.tags
}

module "netlify_sites" {
  source = "../../modules/netlify-sites"

  netlify_token      = var.netlify_token
  github_owner       = "cedrickbyrd"
  github_repo        = "securebase-app"
  marketing_domain   = "securebase.tximhotep.com"
  portal_demo_domain = "demo.securebase.tximhotep.com"
  tags               = var.tags
}

module "phase5_logging" {
  source = "../../modules/phase5-logging"

  environment = var.environment
  aws_region  = var.target_region

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id = "9xyetu7zq3"
  tags           = var.tags
}

module "phase5_alerting" {
  source = "../../modules/phase5-alerting"

  environment     = var.environment
  aws_region      = var.target_region
  sns_kms_key_arn = module.phase5_logging.kms_key_arn

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id    = "9xyetu7zq3"
  aurora_cluster_id = var.aurora_cluster_id

  alert_email = var.alert_email

  pagerduty_routing_key        = var.pagerduty_routing_key
  oncall_email                 = var.oncall_email
  lambda_concurrency_threshold = var.lambda_concurrency_threshold
  api_usage_spike_threshold    = var.api_usage_spike_threshold

  tags = var.tags
}

module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
    aws           = aws
    aws.secondary = aws.secondary
  }

  environment       = var.environment
  primary_region    = var.target_region
  secondary_region  = "us-west-2"
  aurora_cluster_id = var.aurora_cluster_id
  alert_sns_arn     = module.phase5_alerting.sns_topic_arn

  primary_vpc_id   = var.primary_vpc_id
  primary_vpc_cidr = var.primary_vpc_cidr

  dynamodb_table_names = var.dynamodb_table_names

  audit_log_bucket_name = var.audit_log_bucket_name

  route53_hosted_zone_id   = var.route53_hosted_zone_id
  primary_api_endpoint     = var.primary_api_endpoint
  secondary_api_endpoint   = var.secondary_api_endpoint
  secondary_api_gateway_id = var.secondary_api_gateway_id

  acm_certificate_arn       = var.acm_certificate_arn
  primary_api_fqdn          = var.primary_api_fqdn
  secondary_api_fqdn        = var.secondary_api_fqdn
  secondary_health_api_fqdn = var.secondary_health_api_fqdn
  cloudfront_aliases        = var.cloudfront_aliases

  tags = var.tags
}

module "phase5_cost" {
  source = "../../modules/phase5-cost"

  environment               = var.environment
  alert_sns_arn             = module.phase5_alerting.alert_sns_arn
  anomaly_threshold_percent = 20

  s3_bucket_names = var.s3_cost_tiering_buckets

  tags = var.tags
}

module "phase5_sre_metrics" {
  source = "../../modules/phase5-sre-metrics"

  environment     = var.environment
  tags            = var.tags
  lambda_zip_path = var.sre_metrics_lambda_zip_path
  cors_origin     = "https://securebase.tximhotep.com"
  alert_email     = var.alert_email
}

module "phase6_audit_logging" {
  source = "../../modules/phase6-audit-logging"

  environment               = var.environment
  project_name              = "securebase"
  evidence_bucket_name      = "securebase-evidence-${var.environment}"
  audit_source_bucket_name  = local.phase6_audit_source_bucket
  object_lock_retention_days = 2555
  macie_alert_email         = var.alert_email

  tags = merge(var.tags, {
    Phase = "6"
    Track = "1"
  })
}

module "phase6_compliance" {
  source = "../../modules/phase6-compliance"

  environment                     = var.environment
  project_name                    = "securebase"
  config_delivery_bucket_name     = local.phase6_audit_source_bucket
  config_recorder_already_enabled = true
  enable_hipaa_conformance_pack   = true
  enable_nist_conformance_pack    = true

  tags = merge(var.tags, {
    Phase = "6"
    Track = "1"
  })

  depends_on = [module.phase6_audit_logging]
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {}
}

module "phase6_lambdas" {
  source                     = "../../modules/phase6-lambda-functions"
  environment                = var.environment
  audit_evidence_api_zip     = "${path.module}/../../files/phase6/audit_evidence_api.zip"
  compliance_history_api_zip = "${path.module}/../../files/phase6/compliance_history_api.zip"
  evidence_bucket_name       = module.phase6_audit_logging.evidence_bucket_name
  evidence_kms_key_arn       = module.phase6_audit_logging.kms_key_arn
  rds_proxy_endpoint         = module.securebase.rds_proxy_endpoint
  private_subnet_ids         = var.lambda_subnets
  security_group_ids         = [module.securebase.lambda_security_group_id]
  tags                       = merge(var.tags, { Phase = "6" })
}
