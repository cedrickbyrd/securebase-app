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

# Call the root module
module "securebase" {
  source = "../.."
  
  org_name       = var.org_name
  target_region  = var.target_region
  environment    = var.environment
  accounts       = var.accounts
  allowed_regions = var.allowed_regions
  clients        = var.clients
  tags           = var.tags
}

# Phase 4: Advanced Analytics & Reporting Module
module "analytics" {
  source = "../../modules/analytics"
  
  environment          = var.environment
  reporting_layer_arn  = var.reporting_layer_arn
  tags                 = var.tags
}

# Netlify Sites Module - Manages marketing site and portal demo deployments
module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
  tags                = var.tags
}
