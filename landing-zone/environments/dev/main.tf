provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

# Netlify provider for managing Netlify deployments
provider "netlify" {
  token = var.netlify_token
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

module "phase2_database" {
  source = "../../modules/phase2-database"

  environment          = var.environment
  vpc_id               = var.default_vpc_id
  database_subnets     = var.database_subnets
  lambda_subnets       = var.lambda_subnets
  max_aurora_capacity  = var.max_aurora_capacity
  min_aurora_capacity  = var.min_aurora_capacity
  rds_backup_retention = var.rds_backup_retention
  tags                 = var.tags
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {}
}
