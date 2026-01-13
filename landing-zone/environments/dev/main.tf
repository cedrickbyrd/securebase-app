terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = var.tags
  }
}

module "org" {
  source = "../../modules/org"
  org_name = "tximhotep"

  accounts        = var.accounts
  allowed_regions = var.allowed_regions
  tags            = var.tags
}

module "iam" {
  source = "../../modules/iam"

  management_account_id = var.management_account_id

  depends_on = [module.org]
}
