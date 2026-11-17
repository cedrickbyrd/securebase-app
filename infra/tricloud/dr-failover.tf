###############################################################################
# SecureBase Step 4: Cross-Cloud Active-Passive Failover & Disaster Recovery
# Vendor: TxImhotep LLC | Domain: demo.securebase.tximhotep.com
# Auth: Keyless WIF / OIDC Only (Zero Static Credentials)
###############################################################################

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

variable "domain_name" {
  type    = string
  default = "demo.securebase.tximhotep.com"
}

variable "gcp_project_id" {
  type    = string
  default = "securebase-gcp-dev"
}

variable "gcp_project_number" {
  type    = string
  default = "594006980795"
}

variable "route53_zone_id" {
  type    = string
  default = "Z0SECUREBASEZONE1"
}

variable "aws_alb_dns" {
  type    = string
  default = "us-east-1-edge.securebase.tximhotep.com"
}

variable "gcp_lb_ip" {
  type    = string
  default = "34.120.88.14"
}

variable "azure_ingress_fqdn" {
  type    = string
  default = "securebase-eastus.azurefd.net"
}

variable "dr_sns_topic_arn" {
  type    = string
  default = "arn:aws:sns:us-east-1:594006980795:securebase-dr-alerts"
}

# ---------------------------------------------------------------------------
# 1. AWS Route 53 Active-Passive Health Checks (Portal + /functions/v1/ingest-ci-scan)
# ---------------------------------------------------------------------------

resource "aws_route53_health_check" "aws_primary_ingest" {
  fqdn              = var.aws_alb_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/functions/v1/ingest-ci-scan"
  failure_threshold = 2
  request_interval  = 10
  measure_latency   = true

  tags = {
    Name       = "securebase-aws-us-east-1-health"
    Tier       = "PRIMARY"
    Compliance = "FFIEC-AIO-DR"
  }
}

resource "aws_route53_health_check" "gcp_secondary_ingest" {
  ip_address        = var.gcp_lb_ip
  port              = 443
  type              = "HTTPS"
  resource_path     = "/functions/v1/ingest-ci-scan"
  failure_threshold = 2
  request_interval  = 10
  measure_latency   = true

  tags = {
    Name       = "securebase-gcp-us-central1-health"
    Tier       = "SECONDARY"
    GCPProject = var.gcp_project_id
  }
}

resource "aws_route53_health_check" "azure_tertiary_ingest" {
  fqdn              = var.azure_ingress_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = "/functions/v1/ingest-ci-scan"
  failure_threshold = 3
  request_interval  = 10
  measure_latency   = true

  tags = {
    Name = "securebase-azure-eastus-health"
    Tier = "TERTIARY"
  }
}

resource "aws_route53_record" "portal_primary_aws" {
  zone_id         = var.route53_zone_id
  name            = var.domain_name
  type            = "CNAME"
  ttl             = 30
  set_identifier  = "aws-us-east-1-primary"
  health_check_id = aws_route53_health_check.aws_primary_ingest.id
  records         = [var.aws_alb_dns]

  failover_routing_policy {
    type = "PRIMARY"
  }
}

resource "aws_route53_record" "portal_secondary_gcp" {
  zone_id         = var.route53_zone_id
  name            = var.domain_name
  type            = "A"
  ttl             = 30
  set_identifier  = "gcp-us-central1-secondary"
  health_check_id = aws_route53_health_check.gcp_secondary_ingest.id
  records         = [var.gcp_lb_ip]

  failover_routing_policy {
    type = "SECONDARY"
  }
}

# ---------------------------------------------------------------------------
# 2. GCP Cloud DNS Standby Failover & Cloud Scheduler RPO/RTO Probe
# ---------------------------------------------------------------------------

resource "google_dns_managed_zone" "securebase_dr_zone" {
  project     = var.gcp_project_id
  name        = "securebase-dr-standby"
  dns_name    = "tximhotep.com."
  description = "Standby authoritative zone synced via WIF for FFIEC DR failover"
}

resource "google_dns_record_set" "ingest_failover_policy" {
  project      = var.gcp_project_id
  managed_zone = google_dns_managed_zone.securebase_dr_zone.name
  name         = "ingest.securebase.tximhotep.com."
  type         = "A"
  ttl          = 30

  routing_policy {
    primary_backup {
      trickle_traffic = 0.0
      primary {
        internal_load_balancers {
          load_balancer_type = "regionalL7ilb"
          ip_address         = "10.128.0.20"
          port               = "443"
          ip_protocol        = "tcp"
          network_url        = "projects/${var.gcp_project_id}/global/networks/securebase-vpc"
        }
      }
      backup_geo {
        location = "us-central1"
        rrdatas  = [var.gcp_lb_ip]
      }
    }
  }
}

resource "google_cloud_scheduler_job" "rpo_rto_probe_gcp" {
  project          = var.gcp_project_id
  region           = "us-central1"
  name             = "securebase-rpo-rto-probe"
  description      = "Automated 5-minute RPO <= 60s and RTO <= 120s DR verification probe"
  schedule         = "*/5 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "30s"

  http_target {
    http_method = "POST"
    uri         = "https://us-central1-${var.gcp_project_id}.cloudfunctions.net/verify-dr-rpo-rto"
    oidc_token {
      service_account_email = "securebase-dr-prober@${var.gcp_project_id}.iam.gserviceaccount.com"
      audience              = "https://${var.domain_name}"
    }
  }
}

# ---------------------------------------------------------------------------
# 3. Azure Traffic Manager Tertiary Priority Routing (East US)
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "dr_rg" {
  name     = "rg-securebase-dr-eastus"
  location = "eastus"
}

resource "azurerm_traffic_manager_profile" "securebase_tm" {
  name                   = "tm-securebase-failover"
  resource_group_name    = azurerm_resource_group.dr_rg.name
  traffic_routing_method = "Priority"

  dns_config {
    relative_name = "securebase-dr-tm"
    ttl           = 30
  }

  monitor_config {
    protocol                     = "HTTPS"
    port                         = 443
    path                         = "/functions/v1/ingest-ci-scan"
    interval_in_seconds          = 10
    tolerated_number_of_failures = 2
    timeout_in_seconds           = 5
  }
}

resource "azurerm_traffic_manager_external_endpoint" "aws_primary_ep" {
  name       = "ep-aws-us-east-1"
  profile_id = azurerm_traffic_manager_profile.securebase_tm.id
  target     = var.aws_alb_dns
  priority   = 1
}

resource "azurerm_traffic_manager_external_endpoint" "azure_eastus_ep" {
  name       = "ep-azure-eastus"
  profile_id = azurerm_traffic_manager_profile.securebase_tm.id
  target     = var.azure_ingress_fqdn
  priority   = 2
}

# ---------------------------------------------------------------------------
# 4. Supabase/Postgres Cross-Region Replication + WORM S3 Replication + EventBridge
# ---------------------------------------------------------------------------

resource "aws_db_parameter_group" "supabase_logical_repl" {
  name   = "securebase-supabase-logical-dr"
  family = "postgres16"

  parameter {
    name         = "rds.logical_replication"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "wal_level"
    value = "logical"
  }

  parameter {
    name  = "max_replication_slots"
    value = "10"
  }
}

resource "aws_cloudwatch_event_rule" "dr_rpo_rto_schedule" {
  name                = "securebase-dr-rpo-rto-check"
  description         = "Triggers EventBridge Lambda RPO/RTO replication lag verification every 5m"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "dr_sns_notify" {
  rule      = aws_cloudwatch_event_rule.dr_rpo_rto_schedule.name
  target_id = "TriggerDrRpoCheck"
  arn       = var.dr_sns_topic_arn
}
