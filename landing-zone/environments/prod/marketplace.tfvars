# AWS Marketplace integration — production
# Apply with: terraform apply -var-file=marketplace.tfvars
# Product code source: AWS Marketplace Management Portal (confirmed May 19, 2026)
# Status: Staging — product code is live and usable before listing goes public

# ---------------------------------------------------------------------------
# Core marketplace identity
# ---------------------------------------------------------------------------
marketplace_product_code = "blblyu28f6s5mzwl089d4xoea"

# AWS-owned SNS topic that publishes subscribe/unsubscribe/entitlement events
# for this product. Account 287250355862 is the AWS Marketplace service account.
aws_marketplace_sns_topic_arn = "arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-blblyu28f6s5mzwl089d4xoea"

# ---------------------------------------------------------------------------
# Infra — reuse prod Lambda VPC config (same subnets/SG as phase6_lambdas)
# ---------------------------------------------------------------------------
# NOTE: Only one Aurora cluster exists in this account (securebase-phase2-dev).
# marketplace_db_host points at dev cluster until a prod Aurora cluster is provisioned.
# TODO: provision securebase-phase2-prod cluster and update both this file and
#       rds_proxy_endpoint default in variables.tf post-TriNetX conversion.
marketplace_db_host                  = "securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com"
marketplace_db_secret_arn            = "arn:aws:secretsmanager:us-east-1:731184206915:secret:phase2/rds/app-5VPsB7"
marketplace_lambda_role_arn          = "arn:aws:iam::731184206915:role/securebase-production-lambda-execution"
marketplace_private_subnet_ids       = ["subnet-0783b18ae893a8df9", "subnet-0f3dfdab04381608c"]
marketplace_lambda_security_group_id = "sg-0127b93c1653cf90f"

# ---------------------------------------------------------------------------
# Lambda packages — prod S3 bucket
# Upload zips to s3://securebase-terraform-state-prod/lambda/ before applying
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
