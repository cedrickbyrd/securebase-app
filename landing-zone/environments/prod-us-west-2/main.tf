provider "aws" {
<<<<<<< HEAD
  alias  = "primary"
  region = "us-east-1"
=======
  region = var.primary_region
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization

  default_tags {
    tags = var.tags
  }
}

provider "aws" {
  alias  = "secondary"
<<<<<<< HEAD
  region = "us-west-2"
=======
  region = var.secondary_region
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization

  default_tags {
    tags = var.tags
  }
}

<<<<<<< HEAD
# =============================================================================
# Multi-Region DR Module
# =============================================================================

=======
# ── Multi-Region DR ────────────────────────────────────────────────────────────
# This environment manages only the cross-region DR infrastructure.
# Primary region resources (Aurora primary, API GW, Lambdas) are managed by
# landing-zone/environments/production.
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
<<<<<<< HEAD
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
=======
    aws           = aws
    aws.secondary = aws.secondary
  }

  environment       = var.environment
  primary_region    = var.primary_region
  secondary_region  = var.secondary_region
  aurora_cluster_id = var.aurora_cluster_id

  aurora_engine_version  = var.aurora_engine_version
  dynamodb_table_names   = var.dynamodb_table_names

  route53_hosted_zone_id = var.route53_hosted_zone_id
  primary_api_endpoint   = var.primary_api_endpoint
  secondary_api_endpoint = var.secondary_api_endpoint

  alert_sns_arn = var.alert_sns_arn

  tags = var.tags
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
}

terraform {
  required_version = ">= 1.5.0"
<<<<<<< HEAD
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
=======
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization

  backend "s3" {}
}
