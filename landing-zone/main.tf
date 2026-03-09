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
  source                = "./modules/iam"
  management_account_id = data.aws_caller_identity.current.account_id
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
    "iam.amazonaws.com",        # Re-enables IAM service access
    "securityhub.amazonaws.com",
    "sso.amazonaws.com"
  ]
}
resource "aws_organizations_account" "clients" {
  for_each = var.clients
  name     = each.value.prefix
  email    = coalesce(each.value.email, "${each.value.prefix}+${each.key}@securebase-demo.com")
  parent_id = local.tier_to_ou_id[each.value.tier]
  lifecycle { prevent_destroy = true }
  tags = merge(var.tags, each.value.tags)
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
  tags = merge(var.tags, { Phase = "Phase3-API" })
  depends_on = [module.lambda_functions]
}

# [Omitted logic for customer OUs and legacy accounts for brevity, but they should remain in your final file]

locals {
  tier_to_ou_id = {
    healthcare   = try(aws_organizations_organizational_unit.customer_healthcare[0].id, null)
    fintech      = try(aws_organizations_organizational_unit.customer_fintech[0].id, null)
    gov-federal  = try(aws_organizations_organizational_unit.customer_govfed[0].id, null)
    standard     = try(aws_organizations_organizational_unit.customer_standard[0].id, null)
  }
}
