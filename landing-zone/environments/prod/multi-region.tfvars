# =============================================================================
# Phase 5.4 Multi-Region DR — Production
# Verified against live AWS environment: 2026-05-10
# Apply complete: 49/49 resources
#
# NEXT APPLY: terraform apply -target=module.multi_region -var-file=multi-region.tfvars
# This will update the CloudFront distribution to add the /health behavior.
# Estimated: 10-15 min (CloudFront propagation)
# =============================================================================

environment      = "prod"
primary_region   = "us-east-1"
secondary_region = "us-west-2"

# ── Aurora ──────────────────────────────────────────────────────────────────────
aurora_cluster_id      = "securebase-phase2-dev"
aurora_engine_version  = "15.15"
aurora_instance_class  = "db.r6g.large"

# ── DynamoDB — prod tables (streams enabled 2026-05-10) ──────────────────────
dynamodb_table_names = [
  "securebase-prod-metrics",
  "securebase-prod-report-cache",
  "securebase-prod-report-schedules",
  "securebase-prod-reports"
]

# ── VPC ──────────────────────────────────────────────────────────────────────────
primary_vpc_id   = "vpc-003c9d5b0f9f1a02b"
primary_vpc_cidr = "10.0.0.0/16"

secondary_vpc_id     = ""
secondary_vpc_cidr   = ""
secondary_subnet_ids = []

# ── Route53 (disabled — DNS in Netlify) ───────────────────────────────────────
route53_hosted_zone_id = ""
api_dns_name           = ""
primary_api_endpoint   = ""
secondary_api_endpoint = ""

# ── CloudFront failover ────────────────────────────────────────────────────
acm_certificate_arn = "arn:aws:acm:us-east-1:731184206915:certificate/109a7267-8b0e-438b-acf6-15ddbe5206d5"
primary_api_fqdn    = "d-ky35u7ca93.execute-api.us-east-1.amazonaws.com"
secondary_api_fqdn  = "bi8ixc75nl.execute-api.us-west-2.amazonaws.com"
secondary_health_api_fqdn  = "bi8ixc75nl.execute-api.us-west-2.amazonaws.com"
cloudfront_aliases  = ["api.securebase.tximhotep.com"]

# Secondary health APIGWv2 endpoint (FQDN only, no https:// prefix, no /health suffix)
# Retrieve with:
#   aws apigatewayv2 get-apis --region us-west-2 \
#     --query "Items[?contains(Name,'health-secondary')].ApiEndpoint" \
#     --output text | sed 's|https://||'
# Paste the result (e.g. abc123def.execute-api.us-west-2.amazonaws.com) below:

# ── S3 audit log replication ──────────────────────────────────────────────────
audit_log_bucket_name = "securebase-audit-logs-prod"

# ── Tags ─────────────────────────────────────────────────────────────────────────────
tags = {
  Project     = "SecureBase"
  Environment = "prod"
  Phase       = "5.4"
  ManagedBy   = "terraform"
  Owner       = "TxImhotep LLC"
}
