# AWS Marketplace integration — production
# Apply with: terraform apply -var-file=marketplace.tfvars
# Product code source: AWS Marketplace Management Portal (confirmed May 19, 2026)
# Status: Limited — Under Review (as of June 16, 2026)

# ---------------------------------------------------------------------------
# Environment / alerting
# ---------------------------------------------------------------------------
# Override default (securebase-prod-analytics-alerts) — Phase 6 data source
# lookup and alerting modules use this topic.
alert_topic_name = "securebase-production-alerts"
alert_email      = "cedrickjbyrd@me.com"
alert_sns_arn    = "arn:aws:sns:us-east-1:731184206915:securebase-production-alerts"

# ---------------------------------------------------------------------------
# Core marketplace identity
# ---------------------------------------------------------------------------
marketplace_product_code = "blblyu28f6s5mzwl089d4xoea"

# AWS Marketplace SNS topics (account 287250355862) — populated from AMMP product page.
# Terraform cannot SNS:Subscribe to these topics (403 by design).
# Register the subscription_handler Lambda endpoint via AMMP UI after listing publishes.
# These ARNs grant Lambda invoke permission to the Marketplace SNS topics.
aws_marketplace_sns_topic_arn             = "arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-blblyu28f6s5mzwl089d4xoea"
aws_marketplace_entitlement_sns_topic_arn = "arn:aws:sns:us-east-1:287250355862:aws-mp-entitlement-notification-blblyu28f6s5mzwl089d4xoea"

# ---------------------------------------------------------------------------
# Marketplace alerting
# ---------------------------------------------------------------------------
marketplace_alerts_sns_topic_arn = "arn:aws:sns:us-east-1:731184206915:securebase-production-alerts"
marketplace_ceo_sns_topic_arn    = "arn:aws:sns:us-east-1:731184206915:securebase-production-ceo-alerts"

# DLQ encryption — SSE-SQS (AWS-managed, free). Set to a KMS ARN to enforce CMEK.
# metering_worker_dlq_kms_key_arn is intentionally omitted — the variable is
# declared in the marketplace module but not wired at the environment level;
# the module default of "" (SSE-SQS) is correct.
marketplace_dlq_kms_key_arn = ""

# ---------------------------------------------------------------------------
# Infra — reuse prod Lambda VPC config
# ---------------------------------------------------------------------------
# NOTE: Only one Aurora cluster exists (securebase-phase2-dev).
# Marketplace Lambdas connect via RDS Proxy.
# TODO: provision securebase-phase2-prod cluster post first paid conversion.
marketplace_db_host = "securebase-phase2-proxy-dev.proxy-coti40osot2c.us-east-1.rds.amazonaws.com"

# App credential — read/write privileges appropriate for Lambda runtime.
# (migrator secret securebase/prod/rds/migrator-CAjTMT is for db_migrator only)
marketplace_db_secret_arn = "arn:aws:secretsmanager:us-east-1:731184206915:secret:securebase/prod/rds/app-uw9J2e"

marketplace_lambda_role_arn          = "arn:aws:iam::731184206915:role/securebase-production-lambda-execution"
marketplace_private_subnet_ids       = ["subnet-0783b18ae893a8df9", "subnet-0f3dfdab04381608c"]
marketplace_lambda_security_group_id = "sg-0127b93c1653cf90f"
marketplace_onboarding_function_name = "securebase-trigger-onboarding"

# db_migrator IAM policy — migrator secret retains DDL privileges (intentional)
prod_db_credentials_secret_arn = "arn:aws:secretsmanager:us-east-1:731184206915:secret:securebase/prod/rds/migrator-CAjTMT"

# ---------------------------------------------------------------------------
# Lambda packages — prod S3 bucket
# ---------------------------------------------------------------------------
lambda_packages = {
  auth_v2                          = "s3://securebase-terraform-state-prod/lambda/auth_v2.zip"
  health_check                     = "s3://securebase-terraform-state-prod/lambda/health_check.zip"
  webhook_manager                  = "s3://securebase-terraform-state-prod/lambda/webhook_manager.zip"
  billing_worker                   = "s3://securebase-terraform-state-prod/lambda/billing_worker.zip"
  support_tickets                  = "s3://securebase-terraform-state-prod/lambda/support_tickets.zip"
  cost_forecasting                 = "s3://securebase-terraform-state-prod/lambda/cost_forecasting.zip"
  submit_lead                      = "s3://securebase-terraform-state-prod/lambda/submit_lead.zip"
  demo_auth                        = "s3://securebase-terraform-state-prod/lambda/demo_auth.zip"
  session_management               = "s3://securebase-terraform-state-prod/lambda/session_management.zip"
  stripe_handler                   = "s3://securebase-terraform-state-prod/lambda/stripe_handler.zip"
  marketplace_resolve_customer     = "s3://securebase-terraform-state-prod/lambda/marketplace_resolve_customer.zip"
  marketplace_subscription_handler = "s3://securebase-terraform-state-prod/lambda/marketplace-entitlement.zip"
  marketplace_metering_worker      = "s3://securebase-terraform-state-prod/lambda/marketplace-metering.zip"
}
