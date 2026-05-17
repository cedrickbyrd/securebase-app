provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

# ============================================================================
# Phase 6 / Track 5: Cost-per-tenant reporting and CloudWatch alarms
# Deploys standalone cost infrastructure for the production environment.
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

terraform {
  required_version = ">= 1.5.0"

  # Backend configured at init time:
  #   terraform init -backend-config=prod-backend.hcl
  # Example prod-backend.hcl:
  #   bucket         = "securebase-terraform-state-prod"
  #   key            = "prod/phase6-cost.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "securebase-terraform-locks"
  #   encrypt        = true
  backend "s3" {}
}
