# 3. Dynamic Identity (Prevents Hard-coding)
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Outputs for API Gateway endpoint
output "api_gateway_endpoint" {
  description = "Base URL for API Gateway"
  value       = try(module.api_gateway.api_gateway_endpoint, "Not deployed yet")
}

output "api_endpoints" {
  description = "Map of all API endpoints"
  value       = try(module.api_gateway.api_endpoints, {})
}

provider "aws" {
  region = var.target_region
}

# --- Modules ---

module "organization" {
  source   = "./modules/org"
  org_name = var.org_name
  org_root_id = aws_organizations_organization.this.roots[0].id
  
  depends_on = [aws_organizations_organization.this]
}

#module "security" {
# source     = "./modules/security"
#  depends_on = [module.organization]
#}

module "central_logging" {
  source             = "./modules/logging"
  environment        = var.environment  # This "wires" the root variable to the module
  log_retention_days = 365
}

module "identity" {
  source                = "./modules/iam"
  management_account_id = data.aws_caller_identity.current.account_id
}

# --- Phase 2: Database & API Backend ---
# If no VPC is provided, create one
resource "aws_vpc" "default" {
  count             = var.default_vpc_id == null ? 1 : 0
  cidr_block        = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "SecureBase-Phase2-VPC"
  })
}

# Database subnets (if not provided)
resource "aws_subnet" "database" {
  count             = var.database_subnets == null ? 2 : 0
  vpc_id            = aws_vpc.default[0].id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = "10.0.${100 + count.index}.0/24"

  tags = merge(var.tags, {
    Name = "SecureBase-Database-Subnet-${count.index + 1}"
  })
}

# Lambda subnets (if not provided)
resource "aws_subnet" "lambda" {
  count             = var.lambda_subnets == null ? 2 : 0
  vpc_id            = aws_vpc.default[0].id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = "10.0.${200 + count.index}.0/24"

  tags = merge(var.tags, {
    Name = "SecureBase-Lambda-Subnet-${count.index + 1}"
  })
}

# Get availability zones for the region
data "aws_availability_zones" "available" {
  state = "available"
}

module "phase2_database" {
  source = "./modules/phase2-database"

  environment        = var.environment
  vpc_id             = var.default_vpc_id != null ? var.default_vpc_id : aws_vpc.default[0].id
  database_subnets   = var.database_subnets != null ? var.database_subnets : aws_subnet.database.*.id
  lambda_subnets     = var.lambda_subnets != null ? var.lambda_subnets : aws_subnet.lambda.*.id
  
  max_aurora_capacity = var.max_aurora_capacity
  min_aurora_capacity = var.min_aurora_capacity
  rds_backup_retention = var.rds_backup_retention
  
  tags = merge(var.tags, {
    Phase = "Phase2-Database"
  })

  depends_on = [module.organization, module.central_logging]
}

# --- Per-Customer VPC Module ---
# Creates dedicated VPC, subnets, NAT gateway, and Flow Logs for each customer
module "customer_vpcs" {
  for_each = var.enable_vpc ? var.clients : {}

  source = "./modules/vpc"

  customer_name       = each.key
  customer_framework  = each.value.framework
  vpc_cidr            = each.value.vpc_cidr
  region              = var.target_region
  vpc_config          = var.vpc_config

  # Calculate subnet CIDRs from VPC CIDR
  public_subnet_cidr       = "${regex("10\\.(\\d+)", each.value.vpc_cidr)[0]}.0.0/24"
  private_subnet_1a_cidr   = "${regex("10\\.(\\d+)", each.value.vpc_cidr)[0]}.1.0/24"
  private_subnet_1b_cidr   = "${regex("10\\.(\\d+)", each.value.vpc_cidr)[0]}.2.0/24"

  tags = merge(
    var.tags,
    {
      Customer = each.value.tags["Customer"]
      Tier     = each.value.tags["Tier"]
    }
  )

  depends_on = [aws_organizations_organization.this]
}

# --- VPC Configuration (Per-Customer) ---
# Store VPC configurations for each client
locals {
  client_vpcs = {
    for client_key, client_config in var.clients :
    client_key => {
      cidr_block = client_config.vpc_cidr != null ? client_config.vpc_cidr : "10.${1 + index(keys(var.clients), client_key)}.0.0/16"
      tier = client_config.tier
      framework = client_config.framework
      account_id = client_config.account_id
    }
  }
  
  vpc_subnets = {
    for client_key, vpc_config in local.client_vpcs :
    client_key => {
      private_subnets = [
        "${regex("10\\.(\\d+)", vpc_config.cidr_block)[0]}.1.0/24",
        "${regex("10\\.(\\d+)", vpc_config.cidr_block)[0]}.2.0/24"
      ]
      public_subnets = [
        "${regex("10\\.(\\d+)", vpc_config.cidr_block)[0]}.0.0/24"
      ]
    }
  }
}

# --- Resources ---

resource "aws_organizations_organization" "this" {
  feature_set = "ALL"
  enabled_policy_types = ["SERVICE_CONTROL_POLICY"]
  
  aws_service_access_principals = [
    "cloudtrail.amazonaws.com",
    "config.amazonaws.com",
    "guardduty.amazonaws.com",
    "securityhub.amazonaws.com",
    "sso.amazonaws.com"
  ]
}

# --- Multi-Tenant Organizational Units for PaaS Clients ---
# Create a separate OU for each customer tier to enable tier-specific guardrails

resource "aws_organizations_organizational_unit" "customer_healthcare" {
  count     = length([for c in var.clients : c if c.tier == "healthcare"]) > 0 ? 1 : 0
  name      = "Customers-Healthcare"
  parent_id = aws_organizations_organization.this.roots[0].id
  
  tags = merge(var.tags, {
    Purpose = "Multi-Tenant-Healthcare"
  })
}

resource "aws_organizations_organizational_unit" "customer_fintech" {
  count     = length([for c in var.clients : c if c.tier == "fintech"]) > 0 ? 1 : 0
  name      = "Customers-Fintech"
  parent_id = aws_organizations_organization.this.roots[0].id
  
  tags = merge(var.tags, {
    Purpose = "Multi-Tenant-Fintech"
  })
}

resource "aws_organizations_organizational_unit" "customer_govfed" {
  count     = length([for c in var.clients : c if c.tier == "gov-federal"]) > 0 ? 1 : 0
  name      = "Customers-Government-Federal"
  parent_id = aws_organizations_organization.this.roots[0].id
  
  tags = merge(var.tags, {
    Purpose = "Multi-Tenant-GovFederal"
  })
}

resource "aws_organizations_organizational_unit" "customer_standard" {
  count     = length([for c in var.clients : c if c.tier == "standard"]) > 0 ? 1 : 0
  name      = "Customers-Standard"
  parent_id = aws_organizations_organization.this.roots[0].id
  
  tags = merge(var.tags, {
    Purpose = "Multi-Tenant-Standard"
  })
}

# Helper local to map client tier to OU ID
locals {
  tier_to_ou_id = {
    healthcare   = try(aws_organizations_organizational_unit.customer_healthcare[0].id, null)
    fintech      = try(aws_organizations_organizational_unit.customer_fintech[0].id, null)
    gov-federal  = try(aws_organizations_organizational_unit.customer_govfed[0].id, null)
    standard     = try(aws_organizations_organizational_unit.customer_standard[0].id, null)
  }
  
  # Map clients to their target OUs
  clients_by_ou = {
    for client_key, client_config in var.clients :
    local.tier_to_ou_id[client_config.tier] => merge(client_config, { name = client_key })
  }
}

# 4. Multi-Tenant Account Creation (Destroy Safety)
resource "aws_organizations_account" "clients" {
  for_each = var.clients

  name  = each.value.prefix
  email = coalesce(each.value.email, "${each.value.prefix}+${each.key}@securebase-demo.com")
  # Route to tier-specific OU
  parent_id = local.tier_to_ou_id[each.value.tier]

  lifecycle {
    prevent_destroy = true
  }
  
  tags = merge(var.tags, each.value.tags)
}

# Legacy accounts support
resource "aws_organizations_account" "accounts" {
  for_each = var.accounts

  name      = each.key
  email     = each.value.email
  parent_id = module.organization.workloads_ou_id

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ebs_encryption_by_default" "enforced" {
  enabled = true
}

# --- Attach Security Guardrails to All OUs ---

# Attach Security Guardrails to Security OU
resource "aws_organizations_policy_attachment" "guardrails_security" {
  policy_id = module.organization.guardrails_policy_id
  target_id = module.organization.security_ou_id
}

# Block IAM Users specifically in Workloads
resource "aws_organizations_policy_attachment" "block_iam_workloads" {
  policy_id = module.organization.block_iam_policy_id
  target_id = module.organization.workloads_ou_id
}

# Attach Guardrails to Workloads OU
resource "aws_organizations_policy_attachment" "guardrails_workloads" {
  policy_id = module.organization.guardrails_policy_id
  target_id = module.organization.workloads_ou_id
}

# --- Multi-Tenant Guardrail Attachments ---

# Healthcare tier customers - enforce HIPAA controls
resource "aws_organizations_policy_attachment" "guardrails_healthcare" {
  count     = length(aws_organizations_organizational_unit.customer_healthcare) > 0 ? 1 : 0
  policy_id = module.organization.guardrails_policy_id
  target_id = aws_organizations_organizational_unit.customer_healthcare[0].id
}

# Fintech tier customers - enforce PCI/SOC2 controls
resource "aws_organizations_policy_attachment" "guardrails_fintech" {
  count     = length(aws_organizations_organizational_unit.customer_fintech) > 0 ? 1 : 0
  policy_id = module.organization.guardrails_policy_id
  target_id = aws_organizations_organizational_unit.customer_fintech[0].id
}

# Government-Federal tier customers - enforce FedRAMP controls
resource "aws_organizations_policy_attachment" "guardrails_govfed" {
  count     = length(aws_organizations_organizational_unit.customer_govfed) > 0 ? 1 : 0
  policy_id = module.organization.guardrails_policy_id
  target_id = aws_organizations_organizational_unit.customer_govfed[0].id
}

# Standard tier customers - baseline guardrails
resource "aws_organizations_policy_attachment" "guardrails_standard" {
  count     = length(aws_organizations_organizational_unit.customer_standard) > 0 ? 1 : 0
  policy_id = module.organization.guardrails_policy_id
  target_id = aws_organizations_organizational_unit.customer_standard[0].id
}

module "security" {
  source = "./modules/security"

  central_log_bucket_name = module.central_logging.central_log_bucket_name
}

# --- Phase 2: Lambda Functions ---
module "lambda_functions" {
  source = "./modules/lambda-functions"

  environment = var.environment
  aws_region  = var.target_region

  # Lambda packages (ZIP files)
  lambda_packages = {
    auth_v2          = "${path.root}/../phase2-backend/deploy/auth_v2.zip"
    webhook_manager  = "${path.root}/../phase2-backend/deploy/webhook_manager.zip"
    billing_worker   = "${path.root}/../phase2-backend/deploy/billing_worker.zip"
    support_tickets  = "${path.root}/../phase2-backend/deploy/support_tickets.zip"
    cost_forecasting = "${path.root}/../phase2-backend/deploy/cost_forecasting.zip"
  }

  # Database configuration
  jwt_secret_arn      = module.phase2_database.jwt_secret_arn
  dynamodb_table_name = module.phase2_database.customers_table_name
  rds_proxy_endpoint  = module.phase2_database.rds_proxy_endpoint
  database_name       = "securebase"

  # VPC configuration
  private_subnet_ids       = var.lambda_subnets != null ? var.lambda_subnets : aws_subnet.lambda.*.id
  lambda_security_group_id = module.phase2_database.lambda_security_group_id

  tags = merge(var.tags, {
    Phase = "Phase2-Lambda"
  })

  depends_on = [module.phase2_database]
}

# --- Phase 3: API Gateway ---
module "api_gateway" {
  source = "./modules/api-gateway"

  environment = var.environment
  aws_region  = var.target_region

  # Lambda function ARNs
  auth_lambda_arn        = module.lambda_functions.auth_v2_arn
  auth_lambda_name       = module.lambda_functions.auth_v2_name
  webhook_lambda_arn     = module.lambda_functions.webhook_manager_arn
  webhook_lambda_name    = module.lambda_functions.webhook_manager_name
  billing_lambda_arn     = module.lambda_functions.billing_worker_arn
  billing_lambda_name    = module.lambda_functions.billing_worker_name
  support_lambda_arn     = module.lambda_functions.support_tickets_arn
  support_lambda_name    = module.lambda_functions.support_tickets_name
  forecasting_lambda_arn = module.lambda_functions.cost_forecasting_arn
  forecasting_lambda_name = module.lambda_functions.cost_forecasting_name

  # Phase 4: Analytics Lambda
  analytics_lambda_arn        = try(module.analytics.report_engine_function_arn, null)
  analytics_lambda_name       = try(module.analytics.report_engine_function_name, null)
  analytics_lambda_invoke_arn = try(module.analytics.report_engine_invoke_arn, null)

  # Security settings
  default_rate_limit  = 100
  default_burst_limit = 200
  log_retention_days  = 30

  # CORS
  allowed_origins = ["http://localhost:5173", "https://portal.securebase.com"]

  tags = merge(var.tags, {
    Phase = "Phase3-API"
  })

  depends_on = [module.lambda_functions, module.analytics]
}

# --- Phase 4: Advanced Analytics & Reporting ---
module "analytics" {
  source = "./modules/analytics"

  environment = var.environment

  tags = merge(var.tags, {
    Phase     = "Phase4-Analytics"
    Component = "Analytics"
  })
}
