terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    netlify = {
      source  = "netlify/netlify"
      version = "~> 0.4.0" 
    }
  }
}

# --- Data Sources & Identity ---
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" { state = "available" }
data "aws_ssoadmin_instances" "this" {}

# --- Lambda Archives (Existing) ---
data "archive_file" "checkout_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../src/functions/securebase-checkout-api"
  output_path = "${path.module}/files/checkout.zip"
}

data "archive_file" "webhook_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../src/functions/securebase-stripe-webhook"
  output_path = "${path.module}/files/webhook.zip"
}

data "archive_file" "metric_aggregator_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/metric_aggregator.py"
  output_path = "${path.module}/lambda/metric_aggregator.zip"
}

provider "aws" { region = var.target_region }

# Secondary provider for multi-region DR (us-west-2)
provider "aws" {
  alias  = "secondary"
  region = "us-west-2"
}

provider "netlify" {
  token             = var.netlify_api_token
  default_team_slug = "cedrickbyrd"
}

# --- Modules (Core Infrastructure) ---
module "organization" {
  source      = "./modules/org"
  org_name    = var.org_name
  org_root_id = aws_organizations_organization.this.roots[0].id
  depends_on  = [aws_organizations_organization.this]
}

module "central_logging" {
  source             = "./modules/logging"
  environment        = var.environment
  log_retention_days = 365
}

module "identity" {
  source           = "./modules/identity"
  sso_instance_arn = tolist(data.aws_ssoadmin_instances.this.arns)[0]
  tags             = var.tags
}

# --- Phase 5: Observability Sensors (New) ---
# 1. The Intelligence Identity for Netlify
resource "aws_iam_user" "netlify_observer" {
  name = "securebase-netlify-observer-${var.environment}"
  tags = merge(var.tags, { Phase = "5" })
}

resource "aws_iam_user_policy" "netlify_observability_access" {
  name = "SecureBaseTelemetryRead"
  user = aws_iam_user.netlify_observer.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:GetMetricData", "cloudwatch:ListMetrics", "apigateway:GET"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:Get*", "s3:List*"]
        Resource = [
          "arn:aws:s3:::${module.central_logging.central_log_bucket_name}",
          "arn:aws:s3:::${module.central_logging.central_log_bucket_name}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_access_key" "netlify_observer_keys" {
  user = aws_iam_user.netlify_observer.name
}

# 2. Traffic Sensors (Flow Logs)
resource "aws_flow_log" "main_telemetry" {
  log_destination      = "arn:aws:s3:::${module.central_logging.central_log_bucket_name}"
  log_destination_type = "s3"
  traffic_type         = "ALL"
  vpc_id               = var.default_vpc_id != null ? var.default_vpc_id : aws_vpc.default[0].id
}

# --- Networking & Database (Phase 2) ---
resource "aws_vpc" "default" {
  count                = var.default_vpc_id == null ? 1 : 0
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = merge(var.tags, { Name = "SecureBase-Phase2-VPC" })
}

resource "aws_subnet" "database" {
  count             = var.database_subnets == null ? 2 : 0
  vpc_id            = aws_vpc.default[0].id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = "10.0.${100 + count.index}.0/24"
  tags = merge(var.tags, { Name = "SecureBase-Database-Subnet-${count.index + 1}" })
}

resource "aws_subnet" "lambda" {
  count             = var.lambda_subnets == null ? 2 : 0
  vpc_id            = aws_vpc.default[0].id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = "10.0.${200 + count.index}.0/24"
  tags = merge(var.tags, { Name = "SecureBase-Lambda-Subnet-${count.index + 1}" })
}

module "phase2_database" {
  source = "./modules/phase2-database"
  environment         = var.environment
  vpc_id              = var.default_vpc_id != null ? var.default_vpc_id : aws_vpc.default[0].id
  database_subnets    = var.database_subnets != null ? var.database_subnets : aws_subnet.database.*.id
  lambda_subnets      = var.lambda_subnets != null ? var.lambda_subnets : aws_subnet.lambda.*.id
  max_aurora_capacity = var.max_aurora_capacity
  min_aurora_capacity = var.min_aurora_capacity
  rds_backup_retention = var.rds_backup_retention
  tags = merge(var.tags, { Phase = "Phase2-Database" })
  depends_on = [module.organization, module.central_logging]
}

# --- Multi-Tenant Account Creation ---
resource "aws_organizations_organization" "this" {
  feature_set          = "ALL"
  enabled_policy_types = ["SERVICE_CONTROL_POLICY"]
  
  aws_service_access_principals = [
    "cloudtrail.amazonaws.com",
    "config.amazonaws.com",
    "guardduty.amazonaws.com",
    "iam.amazonaws.com",
    "securityhub.amazonaws.com",
    "sso.amazonaws.com"
  ]
}
resource "aws_organizations_account" "clients" {
  for_each = var.clients
  name     = each.value.prefix
  email    = coalesce(each.value.email, "${lower(replace(each.value.prefix, " ", "-"))}+${lower(replace(each.key, "_", "-"))}@securebase-demo.com")
  parent_id = local.tier_to_ou_id[each.value.tier]
  lifecycle { prevent_destroy = true }
  tags = merge(var.tags, each.value.tags)
}

# --- Lambda Functions (Phase 2 Backend) ---
module "lambda_functions" {
  source      = "./modules/lambda-functions"
  environment = var.environment
  aws_region  = var.target_region
  tags        = var.tags

  lambda_packages          = var.lambda_packages
  jwt_secret_arn           = module.phase2_database.jwt_secret_arn
  dynamodb_table_name      = module.phase2_database.customers_table_name
  rds_proxy_endpoint       = module.phase2_database.rds_proxy_endpoint
  private_subnet_ids       = var.lambda_subnets != null ? var.lambda_subnets : aws_subnet.lambda.*.id
  lambda_security_group_id = module.phase2_database.lambda_security_group_id
  netlify_api_token        = var.netlify_api_token

  demo_auth_jwt_secret     = var.demo_auth_jwt_secret
  demo_auth_email          = var.demo_auth_email
  demo_auth_password       = var.demo_auth_password

  depends_on = [module.phase2_database]
}

# --- API & Analytics (Phases 3 & 4) ---
module "api_gateway" {
  source = "./modules/api-gateway"
  environment = var.environment
  aws_region  = var.target_region
  auth_lambda_arn        = module.lambda_functions.auth_v2_arn
  auth_lambda_name       = module.lambda_functions.auth_v2_name
  webhook_lambda_arn      = module.lambda_functions.webhook_manager_arn
  webhook_lambda_name     = module.lambda_functions.webhook_manager_name
  billing_lambda_arn      = module.lambda_functions.billing_worker_arn
  billing_lambda_name     = module.lambda_functions.billing_worker_name
  support_lambda_arn      = module.lambda_functions.support_tickets_arn
  support_lambda_name     = module.lambda_functions.support_tickets_name
  forecasting_lambda_arn = module.lambda_functions.cost_forecasting_arn
  forecasting_lambda_name = module.lambda_functions.cost_forecasting_name
  health_check_lambda_arn  = module.lambda_functions.health_check_arn
  health_check_lambda_name = module.lambda_functions.health_check_name
  submit_lead_lambda_arn   = module.lambda_functions.submit_lead_arn
  submit_lead_lambda_name  = module.lambda_functions.submit_lead_name
  demo_auth_lambda_arn        = module.lambda_functions.demo_auth_arn
  demo_auth_lambda_invoke_arn = module.lambda_functions.demo_auth_invoke_arn
  demo_auth_lambda_name       = module.lambda_functions.demo_auth_name
  sre_metrics_lambda_invoke_arn = var.sre_metrics_lambda_invoke_arn
  sre_metrics_lambda_name       = var.sre_metrics_lambda_name
  tags = merge(var.tags, { Phase = "Phase3-API" })
  depends_on = [module.lambda_functions]
}

# ============================================================================
# Phase 5.1: Admin Metrics API (CloudWatch/Cost Explorer/Security Hub)
# ============================================================================

module "phase5_admin_metrics" {
  source      = "./modules/phase5-admin-metrics"
  environment = var.environment
  aws_region  = var.target_region
  tags        = merge(var.tags, { Phase = "5.1" })
  
  api_gateway_id                = module.api_gateway.api_gateway_id
  api_gateway_root_resource_id  = module.api_gateway.root_resource_id
  api_gateway_execution_arn     = module.api_gateway.api_gateway_execution_arn
  
  cors_allowed_origin = "https://demo.securebase.tximhotep.com"
  
  depends_on = [module.api_gateway]
}

# ============================================================================
# Phase 6 / Track 5: Lambda scaling and provisioned concurrency
# ============================================================================
module "lambda_scaling" {
  source      = "./modules/lambda-scaling"
  environment = var.environment
  tags        = merge(var.tags, { Phase = "6", Track = "5" })
  alarm_actions = var.lambda_scaling_alarm_actions

  non_critical_functions = [
    "securebase-${var.environment}-auth-v2",
    "securebase-${var.environment}-webhook-manager",
    "securebase-${var.environment}-billing-worker",
    "securebase-${var.environment}-support-tickets",
    "securebase-${var.environment}-cost-forecasting",
    "securebase-${var.environment}-health-check",
    "securebase-${var.environment}-submit-lead",
    "securebase-${var.environment}-cost-per-tenant",
  ]

  high_traffic_functions = {
    tenant_metrics = {
      function_name      = "securebase-${var.environment}-tenant-metrics"
      function_version   = var.tenant_metrics_function_version
      alias              = "live"
      provisioned_min    = 2
      provisioned_max    = 20
      target_utilization = 0.7
    }
    evidence_collector = {
      function_name      = "securebase-${var.environment}-evidence-collector"
      function_version   = var.evidence_collector_function_version
      alias              = "live"
      provisioned_min    = 2
      provisioned_max    = 20
      target_utilization = 0.7
    }
    admin_metrics = {
      function_name      = module.phase5_admin_metrics.lambda_function_name
      function_version   = module.phase5_admin_metrics.lambda_function_version
      alias              = "live"
      provisioned_min    = 2
      provisioned_max    = 20
      target_utilization = 0.7
    }
  }

  depends_on = [module.phase5_admin_metrics]
}

# ============================================================================
# Phase 5.4: Multi-Region DR
# Aurora Global Cluster, DynamoDB Global Tables, S3 CRR,
# Health Lambda in us-west-2, CloudFront origin failover.
# DNS remains in Netlify; Route53 failover is disabled (leave route53
# variables blank in tfvars to skip those resources).
#
# APPLY: terraform apply -target=module.multi_region \
#          -var-file=./environments/prod/multi-region.tfvars
# ============================================================================

module "multi_region" {
  source = "./modules/multi-region"

  providers = {
    aws           = aws
    aws.secondary = aws.secondary
  }

  environment      = var.environment
  primary_region   = var.target_region
  secondary_region = "us-west-2"

  aurora_cluster_id     = var.aurora_cluster_id
  aurora_engine_version = var.aurora_engine_version
  aurora_instance_class = var.aurora_instance_class

  dynamodb_table_names = var.dynamodb_table_names

  primary_vpc_id       = var.primary_vpc_id
  primary_vpc_cidr     = var.primary_vpc_cidr
  secondary_vpc_id     = var.secondary_vpc_id
  secondary_vpc_cidr   = var.secondary_vpc_cidr
  secondary_subnet_ids = var.secondary_subnet_ids

  # Route53 disabled — DNS in Netlify
  route53_hosted_zone_id = ""
  api_dns_name           = ""
  primary_api_endpoint   = ""
  secondary_api_endpoint = ""

  # CloudFront failover
  acm_certificate_arn = var.acm_certificate_arn
  primary_api_fqdn    = var.primary_api_fqdn
  secondary_api_fqdn  = var.secondary_api_fqdn
  cloudfront_aliases  = var.cloudfront_aliases

  audit_log_bucket_name = var.audit_log_bucket_name

  tags = var.tags
}

# ============================================================================
# Organizational Units (Tier OUs)
# ============================================================================

resource "aws_organizations_organizational_unit" "customer_healthcare" {
  count     = 1
  name      = "Healthcare"
  parent_id = aws_organizations_organization.this.roots[0].id
  tags      = merge(var.tags, { Tier = "healthcare" })
}

resource "aws_organizations_organizational_unit" "customer_fintech" {
  count     = 1
  name      = "Fintech"
  parent_id = aws_organizations_organization.this.roots[0].id
  tags      = merge(var.tags, { Tier = "fintech" })
}

resource "aws_organizations_organizational_unit" "customer_govfed" {
  count     = 1
  name      = "GovFederal"
  parent_id = aws_organizations_organization.this.roots[0].id
  tags      = merge(var.tags, { Tier = "gov-federal" })
}

resource "aws_organizations_organizational_unit" "customer_standard" {
  count     = 1
  name      = "Standard"
  parent_id = aws_organizations_organization.this.roots[0].id
  tags      = merge(var.tags, { Tier = "standard" })
}

resource "aws_organizations_organizational_unit" "customer_sales" {
  count     = 1
  name      = "Customers-Sales"
  parent_id = aws_organizations_organization.this.roots[0].id
  tags      = merge(var.tags, { Tier = "sales", Purpose = "demo" })
}

resource "aws_organizations_account" "demo_sales" {
  name      = "securebase-demo-sales"
  email     = "demo.sales@securebase.io"
  parent_id = aws_organizations_organizational_unit.customer_sales[0].id
  lifecycle { prevent_destroy = true }
  tags = merge(var.tags, { Tier = "sales", Purpose = "demo" })
}

locals {
  tier_to_ou_id = {
    healthcare   = try(aws_organizations_organizational_unit.customer_healthcare[0].id, null)
    fintech      = try(aws_organizations_organizational_unit.customer_fintech[0].id, null)
    gov-federal  = try(aws_organizations_organizational_unit.customer_govfed[0].id, null)
    standard     = try(aws_organizations_organizational_unit.customer_standard[0].id, null)
    sales        = try(aws_organizations_organizational_unit.customer_sales[0].id, null)
  }
}
