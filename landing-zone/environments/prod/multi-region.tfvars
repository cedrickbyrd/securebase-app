# =============================================================================
# Phase 5.4 Multi-Region DR — Production
# Verified against live AWS environment: 2026-05-09
# =============================================================================
#
# APPLY ORDER:
#   1. Ensure provisioned Aurora instance exists (see aurora-global.tf header)
#   2. terraform apply -var-file=environments/prod/multi-region.tfvars
#   3. After apply, update netlify.toml /api/* proxy to CloudFront distribution
#
# DNS: Netlify manages tximhotep.com — Route53 failover is NOT used.
# Failover is handled by CloudFront origin group (automatic 5xx retry).
# =============================================================================

environment      = "prod"
primary_region   = "us-east-1"
secondary_region = "us-west-2"

# ── Aurora ───────────────────────────────────────────────────────────────────
# Cluster: securebase-phase2-dev (aurora-postgresql 15.15)
# ⚠️  db.serverless instance must be supplemented with db.r6g.large before apply
# See aurora-global.tf header for the aws rds create-db-instance command.
aurora_cluster_id      = "securebase-phase2-dev"
aurora_engine_version  = "15.15"
aurora_instance_class  = "db.r6g.large"

# ── DynamoDB — prod tables only ──────────────────────────────────────────────
# Excludes: dev tables, terraform lock tables, pilot-slots, users (non-critical)
# Each table must have Streams enabled (NEW_AND_OLD_IMAGES) before apply:
#   aws dynamodb update-table --table-name <name> \
#     --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
dynamodb_table_names = [
  "securebase-prod-metrics",
  "securebase-prod-report-cache",
  "securebase-prod-report-schedules",
  "securebase-prod-reports"
]

# ── VPC ──────────────────────────────────────────────────────────────────────
# Secondary VPC (us-west-2) does not exist yet.
# Create it before apply or leave blank to skip secondary Aurora creation.
# The CloudFront + DynamoDB replication will still apply without these.
primary_vpc_id       = ""  # fill: aws ec2 describe-vpcs --region us-east-1
primary_vpc_cidr     = ""  # fill: aws ec2 describe-vpcs --region us-east-1
secondary_vpc_id     = ""  # fill after creating secondary VPC in us-west-2
secondary_vpc_cidr   = ""  # fill after creating secondary VPC in us-west-2
secondary_subnet_ids = []  # fill after creating secondary subnets in us-west-2

# ── Route53 ──────────────────────────────────────────────────────────────────
# DNS is managed by Netlify — Route53 failover records are NOT used.
# Leave blank; route53-failover.tf guards on non-empty values.
route53_hosted_zone_id = ""
api_dns_name           = ""
primary_api_endpoint   = ""
secondary_api_endpoint = ""

# ── CloudFront failover ───────────────────────────────────────────────────────
# ACM cert: arn:aws:acm:us-east-1:731184206915:certificate/109a7267-8b0e-438b-acf6-15ddbe5206d5
# Covers: tximhotep.com
# Primary API:   securebase-phase2-api  (9xyetu7zq3.execute-api.us-east-1.amazonaws.com)
# Secondary API: filled after health-endpoint.tf apply in us-west-2
acm_certificate_arn  = "arn:aws:acm:us-east-1:731184206915:certificate/109a7267-8b0e-438b-acf6-15ddbe5206d5"
primary_api_fqdn     = "9xyetu7zq3.execute-api.us-east-1.amazonaws.com"
secondary_api_fqdn   = ""  # fill after: terraform output secondary_health_endpoint
cloudfront_aliases   = ["api.securebase.tximhotep.com"]

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
