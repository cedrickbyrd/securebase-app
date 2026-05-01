provider "aws" {
  alias  = "primary"
  region = "us-east-1"

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

# =============================================================================
# Multi-Region DR Module
# =============================================================================

module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
    aws.primary   = aws.primary
    aws.secondary = aws.secondary
  }

  environment    = var.environment
  primary_region = "us-east-1"
  secondary_region = "us-west-2"
  tags           = var.tags

  primary_api_fqdn     = var.primary_api_fqdn
  secondary_api_fqdn   = var.secondary_api_fqdn
  hosted_zone_id       = var.hosted_zone_id
  secondary_vpc_id     = var.secondary_vpc_id
  secondary_vpc_cidr   = var.secondary_vpc_cidr
  secondary_subnet_ids = var.secondary_subnet_ids
  cloudfront_aliases   = var.cloudfront_aliases
  acm_certificate_arn  = var.acm_certificate_arn
}

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {}
}
