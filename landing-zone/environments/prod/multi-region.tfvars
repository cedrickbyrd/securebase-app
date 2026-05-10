# =============================================================================
# Phase 5.4 Multi-Region DR — Production
# Verified against live AWS environment: 2026-05-10
# =============================================================================
#
# APPLY ORDER:
#   1. Wait for securebase-phase2-dev-provisioned to reach status: available
#      aws rds describe-db-instances \
#        --db-instance-identifier securebase-phase2-dev-provisioned \
#        --query 'DBInstances[0].DBInstanceStatus' --output text
#   2. terraform init -backend-config=environments/backend.hcl
#   3. terraform apply -var-file=environments/prod/multi-region.tfvars
#   4. After apply: fill secondary_api_fqdn from terraform output
#   5. Update netlify.toml /api/* proxy to CloudFront distribution domain
#
# DNS: Netlify manages tximhotep.com — Route53 is NOT used.
# Failover: CloudFront origin group (automatic 5xx retry to secondary).
# =============================================================================

environment      = "prod"
primary_region   = "us-east-1"
secondary_region = "us-west-2"

# ── Aurora ───────────────────────────────────────────────────────────────────
# Cluster:  securebase-phase2-dev (aurora-postgresql 15.15)
# Instance: securebase-phase2-dev-provisioned (db.r6g.large) — creating
# VPC:      vpc-003c9d5b0f9f1a02b
# Subnets:  subnet-09fb0628c71ceb4a8 (us-east-1a), subnet-0cc564ec5c26cb829 (us-east-1b)
# KMS:      arn:aws:kms:us-east-1:731184206915:key/2fd37c90-b9dd-4355-9846-60772d64aa0f
aurora_cluster_id      = "securebase-phase2-dev"
aurora_engine_version  = "15.15"
aurora_instance_class  = "db.r6g.large"

# ── DynamoDB — prod tables (streams enabled 2026-05-10) ──────────────────────────
# All 4 tables: StreamEnabled=true, StreamViewType=NEW_AND_OLD_IMAGES
# KMS: arn:aws:kms:us-east-1:731184206915:key/2fc4ff39-8394-481f-8a94-3db5f4c4a151
dynamodb_table_names = [
  "securebase-prod-metrics",
  "securebase-prod-report-cache",
  "securebase-prod-report-schedules",
  "securebase-prod-reports"
]

# ── VPC ──────────────────────────────────────────────────────────────────────
# Primary VPC confirmed from Aurora instance subnet group
primary_vpc_id   = "vpc-003c9d5b0f9f1a02b"
primary_vpc_cidr = ""  # fill: aws ec2 describe-vpcs --vpc-ids vpc-003c9d5b0f9f1a02b --query 'Vpcs[0].CidrBlock' --output text

# Secondary VPC (us-west-2) does not exist yet.
# Create before apply or leave blank to skip secondary Aurora cluster.
# CloudFront + DynamoDB replication apply without these.
secondary_vpc_id     = ""
secondary_vpc_cidr   = ""
secondary_subnet_ids = []

# ── Route53 (disabled — DNS in Netlify) ────────────────────────────────────────
route53_hosted_zone_id = ""
api_dns_name           = ""
primary_api_endpoint   = ""
secondary_api_endpoint = ""

# ── CloudFront failover ───────────────────────────────────────────────────────
# ACM cert covers tximhotep.com (us-east-1, required for CloudFront)
acm_certificate_arn = "arn:aws:acm:us-east-1:731184206915:certificate/109a7267-8b0e-438b-acf6-15ddbe5206d5"
primary_api_fqdn    = "9xyetu7zq3.execute-api.us-east-1.amazonaws.com"
secondary_api_fqdn  = ""  # fill after apply: terraform output secondary_health_endpoint
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
