# =============================================================================
# Phase 5.4 Multi-Region DR — Production
# Verified against live AWS environment: 2026-05-10
# Apply complete: 49/49 resources
# =============================================================================

environment      = "prod"
primary_region   = "us-east-1"
secondary_region = "us-west-2"

# ── Aurora ───────────────────────────────────────────────────────────────────
aurora_cluster_id      = "securebase-phase2-dev"
aurora_engine_version  = "15.15"
aurora_instance_class  = "db.r6g.large"

# ── DynamoDB — prod tables (streams enabled 2026-05-10) ──────────────────────────
dynamodb_table_names = [
  "securebase-prod-metrics",
  "securebase-prod-report-cache",
  "securebase-prod-report-schedules",
  "securebase-prod-reports"
]

# ── VPC ──────────────────────────────────────────────────────────────────────
primary_vpc_id   = "vpc-003c9d5b0f9f1a02b"
primary_vpc_cidr = "10.0.0.0/16"

secondary_vpc_id     = ""
secondary_vpc_cidr   = ""
secondary_subnet_ids = []

# ── Route53 (disabled — DNS in Netlify) ────────────────────────────────────────
route53_hosted_zone_id = ""
api_dns_name           = ""
primary_api_endpoint   = ""
secondary_api_endpoint = ""

# ── CloudFront failover ───────────────────────────────────────────────────────
# Primary origin: API Gateway custom domain (accepts api.securebase.tximhotep.com host header)
# Previously: 9xyetu7zq3.execute-api.us-east-1.amazonaws.com (returned 403 ForbiddenException)
acm_certificate_arn = "arn:aws:acm:us-east-1:731184206915:certificate/109a7267-8b0e-438b-acf6-15ddbe5206d5"
primary_api_fqdn    = "d-ky35u7ca93.execute-api.us-east-1.amazonaws.com"
secondary_api_fqdn  = "bi8ixc75nl.execute-api.us-west-2.amazonaws.com"
cloudfront_aliases  = ["api.securebase.tximhotep.com"]

# ── S3 audit log replication ─────────────────────────────────────────────────
audit_log_bucket_name = "securebase-audit-logs-prod"

# ── Tags ─────────────────────────────────────────────────────────────────────
tags = {
  Project     = "SecureBase"
  Environment = "prod"
  Phase       = "5.4"
  ManagedBy   = "terraform"
  Owner       = "TxImhotep LLC"
}
