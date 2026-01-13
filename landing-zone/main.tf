# 1. Version Pinning (Complete)
#terraform {
#  required_version = ">= 1.5.0"
#  
#  # 2. Remote State Configuration (Added)
#  # Replace values with your actual bootstrap bucket/table
#  backend "s3" {
#    bucket         = "securebase-tf-state-${var.environment}"
#    key            = "orchestrator/terraform.tfstate"
#    region         = "us-east-1"
#    dynamodb_table = "securebase-tf-lock"
#    encrypt        = true
#  }
#
 # required_providers {
 #   aws = {
 #     source  = "hashicorp/aws"
 #     version = "~> 5.0"
 #   }
 # }
#}

# 3. Dynamic Identity (Prevents Hard-coding)
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

provider "aws" {
  region = var.target_region
}

# --- Modules ---

module "organization" {
  source   = "./modules/org"
  org_name = var.org_name
  org_root_id = aws_organizations_organization.this.roots[0].id
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

# Organizational Units
#resource "aws_organizations_organizational_unit" "security" {
#  name      = "Security"
#  parent_id = aws_organizations_organization.this.roots[0].id
#}

# ... (shared and workloads OUs remain as you wrote them)

# 4. Destroy Safety (Complete in your version)
resource "aws_organizations_account" "accounts" {
  for_each = var.accounts

  name      = each.key
  email     = each.value.email
# Use a dynamic lookup or a conditional to place it in the right OU
  #OLD#parent_id = each.value.ou_id
  parent_id = module.organization.workloads_ou_id

  lifecycle {
    prevent_destroy = true
  }
}

# ... (SCPs and Attachments remain as you wrote them)
resource "aws_ebs_encryption_by_default" "enforced" {
  enabled = true
}
# Attach Security Guardrails to all OUs
#resource "aws_organizations_policy_attachment" "guardrails_workloads" {
#  policy_id = aws_organizations_policy.security_guardrails.id
#  target_id = module.organization.workloads_ou_id
#}

###############
# Attach Security Guardrails to Security OU
resource "aws_organizations_policy_attachment" "guardrails_security" {
  policy_id = module.organization.guardrails_policy_id # Corrected reference
  target_id = module.organization.security_ou_id
}

# Block IAM Users specifically in Workloads
resource "aws_organizations_policy_attachment" "block_iam_workloads" {
  policy_id = module.organization.block_iam_policy_id # Corrected reference
  target_id = module.organization.workloads_ou_id
}
#resource "aws_organizations_policy_attachment" "guardrails_security" {
#  policy_id = aws_organizations_policy.security_guardrails.id
#  target_id = module.organization.security_ou_id
#}

# Block IAM Users specifically in Workloads
#resource "aws_organizations_policy_attachment" "block_iam_workloads" {
#  policy_id = aws_organizations_policy.block_iam_users.id
#  target_id = module.organization.workloads_ou_id
#}
resource "aws_organizations_policy_attachment" "guardrails_workloads" {
  policy_id = module.organization.guardrails_policy_id # Corrected reference
  target_id = module.organization.workloads_ou_id
}

module "security" {
  source = "./modules/security"

  central_log_bucket_name = module.central_logging.central_log_bucket_name
}
