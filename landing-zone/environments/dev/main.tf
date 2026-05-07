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

# Netlify provider for managing Netlify deployments
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
}

data "aws_ssoadmin_instances" "this" {}



# Call the root module
module "securebase" {
  source = "../.." 
  sso_instance_arn = tolist(data.aws_ssoadmin_instances.this.arns)[0]  # ← dynamic
# sso_instance_arn = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d"

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
}

# Phase 4: Advanced Analytics & Reporting Module
module "analytics" {
  source = "../../modules/analytics"

  environment         = var.environment
  reporting_layer_arn = var.reporting_layer_arn
  tags                = var.tags
}

# Netlify Sites Module - Manages marketing site and portal demo deployments
module "netlify_sites" {
  source = "../../modules/netlify-sites"

  netlify_token      = var.netlify_token
  github_owner       = "cedrickbyrd"
  github_repo        = "securebase-app"
  marketing_domain   = "securebase.tximhotep.com"
  portal_demo_domain = "demo.securebase.tximhotep.com"
  tags               = var.tags
}

# ── Phase 5.3: Logging & Distributed Tracing ──────────────────────────────────
module "phase5_logging" {
  source = "../../modules/phase5-logging"

  environment = var.environment
  aws_region  = var.target_region

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id = "9xyetu7zq3"
  tags           = var.tags
}

# ── Phase 5.3: Alerting & Incident Response ──────────────────────────────────
module "phase5_alerting" {
  source = "../../modules/phase5-alerting"

  environment     = var.environment
  aws_region      = var.target_region
  sns_kms_key_arn = module.phase5_logging.kms_key_arn

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id    = "9xyetu7zq3"
  aurora_cluster_id = var.aurora_cluster_id

  alert_email = var.alert_email

  # Legacy alerting vars (kept for backward compatibility)
  pagerduty_routing_key        = var.pagerduty_routing_key
  oncall_email                 = var.oncall_email
  lambda_concurrency_threshold = var.lambda_concurrency_threshold
  api_usage_spike_threshold    = var.api_usage_spike_threshold

  tags = var.tags
}

# ── Phase 5.3: Multi-Region DR ───────────────────────────────────────────────
module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
    aws           = aws
    aws.secondary = aws.secondary
  }

  environment       = var.environment
  aurora_cluster_id = var.aurora_cluster_id
  alert_sns_arn     = module.phase5_alerting.sns_topic_arn

  route53_hosted_zone_id = var.route53_hosted_zone_id
  primary_api_endpoint   = var.primary_api_endpoint
  secondary_api_endpoint = var.secondary_api_endpoint

  tags = var.tags
}

# ── Phase 5.3: Cost Optimization ─────────────────────────────────────────────────
module "phase5_cost" {
  source = "../../modules/phase5-cost"

  environment               = var.environment
  alert_sns_arn             = module.phase5_alerting.alert_sns_arn
  anomaly_threshold_percent = 20

  aurora_off_peak_min_acu    = var.aurora_off_peak_min_acu
  cost_anomaly_threshold_usd = var.cost_anomaly_threshold_usd

  s3_bucket_names = var.s3_cost_tiering_buckets

  tags = var.tags
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {}
}
