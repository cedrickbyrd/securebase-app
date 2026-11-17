# Phase 2: Sovereign Thick MVNO Cloud-Native Core (Triggered at 10+ Clients)
terraform {
  required_version = ">= 1.7.0"
}

module "worm_vault_us" {
  source          = "../../modules/worm-telemetry-vault"
  sovereign_scope = "us"
  location        = "US-CENTRAL1"
  cmek_key_id     = var.us_cmek_key_id
}

module "sovereign_core_us" {
  source          = "../../modules/sovereign-packet-core"
  project_id      = var.project_id
  sovereign_scope = "us"
  primary_region  = "us-central1"
  hsm_cmek_key_id = var.us_cmek_key_id
}

module "tenant_psc_breakout" {
  source                     = "../../modules/transit-vpc-breakout"
  tenant_slug                = "cnb-waxahachie"
  primary_region             = "us-central1"
  cgnat_psc_subnet_id        = var.cgnat_psc_subnet_id
  upf_n6_ilb_forwarding_rule = var.upf_n6_ilb_forwarding_rule
  customer_project_id        = var.customer_project_id
}

module "wif_pool" {
  source      = "../../modules/wif-identity-pool"
  project_id  = var.project_id
  github_repo = "cedrickbyrd/securebase-mvno"
}
