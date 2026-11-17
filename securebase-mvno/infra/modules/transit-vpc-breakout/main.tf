# Tenant Private APN Breakout: Zero Public Internet Exposure (NIST SC-7)
variable "tenant_slug" { type = string }
variable "primary_region" { type = string }
variable "cgnat_psc_subnet_id" { type = string }
variable "upf_n6_ilb_forwarding_rule" { type = string }
variable "customer_project_id" { type = string }

resource "google_compute_service_attachment" "apn_psc_breakout" {
  name                  = "psc-apn-${var.tenant_slug}"
  region                = var.primary_region
  connection_preference = "ACCEPT_MANUAL"
  nat_subnets           = [var.cgnat_psc_subnet_id]
  target_service        = var.upf_n6_ilb_forwarding_rule

  consumer_accept_lists {
    project_id_or_num = var.customer_project_id
    connection_limit  = 10
  }
}
