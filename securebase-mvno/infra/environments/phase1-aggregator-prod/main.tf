# Phase 1: Light MVNO / Wholesale MVNE Private APN Aggregator Pilot (Clients 5-9)
terraform {
  required_version = ">= 1.7.0"
}

module "worm_vault_us" {
  source          = "../../modules/worm-telemetry-vault"
  sovereign_scope = "us"
  location        = "US-CENTRAL1"
  cmek_key_id     = var.us_cmek_key_id
}

resource "google_compute_ha_vpn_gateway" "mvne_aggregator_gw" {
  name    = "securebase-mvne-ha-vpn-us"
  network = var.transit_vpc_id
  region  = "us-central1"
}

resource "google_compute_vpn_tunnel" "mvne_ipsec_tunnel_a" {
  name                  = "mvne-private-apn-tunnel-a"
  region                = "us-central1"
  vpn_gateway           = google_compute_ha_vpn_gateway.mvne_aggregator_gw.id
  vpn_gateway_interface = 0
  ike_version           = 2
  shared_secret         = var.ephemeral_ike_psk
}
