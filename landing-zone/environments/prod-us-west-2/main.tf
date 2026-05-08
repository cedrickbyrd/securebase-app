provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

provider "aws" {
  alias  = "secondary"
  region = var.source_region

  default_tags {
    tags = var.tags
  }
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

# ── Phase 5.3: Logging & Distributed Tracing (standby region) ─────────────────
module "phase5_logging" {
  source = "../../modules/phase5-logging"

  environment = var.environment
  aws_region  = var.target_region

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id = var.api_gateway_id
  tags           = var.tags
}

# ── Phase 5.3: Alerting & Incident Response (standby region) ──────────────────
module "phase5_alerting" {
  source = "../../modules/phase5-alerting"

  environment     = var.environment
  aws_region      = var.target_region
  sns_kms_key_arn = module.phase5_logging.kms_key_arn

  lambda_function_names = local.phase5_lambda_names

  api_gateway_id    = var.api_gateway_id
  aurora_cluster_id = var.aurora_cluster_id

  alert_email = var.alert_email

  pagerduty_routing_key        = var.pagerduty_routing_key
  oncall_email                 = var.oncall_email
  lambda_concurrency_threshold = var.lambda_concurrency_threshold
  api_usage_spike_threshold    = var.api_usage_spike_threshold

  tags = var.tags
}

# ── Phase 5.3: Multi-Region DR (reversed providers: west primary, east secondary) ─
module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
    aws           = aws
    aws.secondary = aws.secondary
  }

  environment       = var.environment
  primary_region    = var.target_region
  secondary_region  = var.source_region
  aurora_cluster_id = var.aurora_cluster_id

  aurora_engine_version = var.aurora_engine_version
  dynamodb_table_names  = var.dynamodb_table_names

  route53_hosted_zone_id = var.route53_hosted_zone_id
  primary_api_endpoint   = var.primary_api_endpoint
  secondary_api_endpoint = var.secondary_api_endpoint

  alert_sns_arn = module.phase5_alerting.sns_topic_arn

  tags = var.tags
}

# ── Phase 5.3: Cost Optimization (standby region) ──────────────────────────────
module "phase5_cost" {
  source = "../../modules/phase5-cost"

  environment               = var.environment
  alert_sns_arn             = module.phase5_alerting.sns_topic_arn
  anomaly_threshold_percent = var.anomaly_threshold_percent

  s3_bucket_names = var.s3_cost_tiering_buckets

  tags = var.tags
}

# ── Phase 5.3: SRE Metrics (standby region) ───────────────────────────────────
module "phase5_sre_metrics" {
  source = "../../modules/phase5-sre-metrics"

  environment     = var.environment
  tags            = var.tags
  lambda_zip_path = var.sre_metrics_lambda_zip_path
  cors_origin     = var.sre_metrics_cors_origin
  alert_email     = var.alert_email
}

terraform {
  backend "s3" {}
}
