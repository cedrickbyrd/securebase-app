provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
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
