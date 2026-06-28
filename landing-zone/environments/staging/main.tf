provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

# Call the root module
module "securebase" {
  source = "../.."  

  org_name        = var.org_name
  target_region   = var.target_region
  environment     = var.environment
  accounts        = var.accounts
  allowed_regions = var.allowed_regions
  clients         = var.clients
  tags            = var.tags

  stripe_public_key    = var.stripe_public_key
  stripe_secret_key    = var.stripe_secret_key
  netlify_api_token    = var.netlify_api_token
  lambda_packages      = var.lambda_packages
  demo_auth_jwt_secret = var.demo_auth_jwt_secret
  demo_auth_password   = var.demo_auth_password
}

# ============================================================================
# Phase 6 / DB Migrator
# VPC-resident Lambda that applies Aurora migrations from within the private subnet.
# GitHub Actions runners have no direct VPC path to Aurora — this Lambda bridges that gap.
# Secret ARN is injected via GitHub secret STAGING_DB_CREDENTIALS_SECRET_ARN
# passed as TF_VAR_staging_db_credentials_secret_arn.
# ============================================================================
module "db_migrator" {
  source = "../../modules/db-migrator"

  environment        = var.environment
  vpc_id             = var.vpc_id
  private_subnet_ids = var.private_subnet_ids
  zip_path           = "${path.module}/../../files/phase6/db_migrator.zip"

  allowed_secret_arns = [var.staging_db_credentials_secret_arn]

  invoker_role_arns = [
    "arn:aws:iam::731184206915:role/GitHubActionsRole"
  ]

  tags = merge(var.tags, {
    Phase = "6"
    Track = "migrations"
  })
}
