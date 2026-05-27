# Committed intentionally: this non-sensitive env tfvars is required by CI apply
# (repo .gitignore includes *.tfvars; stage with `git add -f` when needed).

# Core
org_name      = "securebase"
environment   = "dev"
target_region = "us-east-1"

# Networking
lambda_subnets   = ["subnet-09fb0628c71ceb4a8", "subnet-0cc564ec5c26cb829"]
database_subnets = ["subnet-09fb0628c71ceb4a8", "subnet-0cc564ec5c26cb829"]

# Marketplace
marketplace_product_code             = "prod-p7z4iqf7gg6dk"
marketplace_db_host                  = "securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com"
marketplace_db_secret_arn            = "arn:aws:secretsmanager:us-east-1:731184206915:secret:securebase/dev/rds/admin-password-sejDay"
marketplace_lambda_role_arn          = "arn:aws:iam::731184206915:role/securebase_lambda_exec_role"
marketplace_lambda_security_group_id = "sg-01f9c85ea97298066"

lambda_packages = {
  auth_v2                          = "s3://securebase-terraform-state-dev/lambda/auth_v2.zip"
  health_check                     = "s3://securebase-terraform-state-dev/lambda/health_check.zip"
  webhook_manager                  = "s3://securebase-terraform-state-dev/lambda/webhook_manager.zip"
  billing_worker                   = "s3://securebase-terraform-state-dev/lambda/billing_worker.zip"
  support_tickets                  = "s3://securebase-terraform-state-dev/lambda/support_tickets.zip"
  cost_forecasting                 = "s3://securebase-terraform-state-dev/lambda/cost_forecasting.zip"
  submit_lead                      = "s3://securebase-terraform-state-dev/lambda/submit_lead.zip"
  demo_auth                        = "s3://securebase-terraform-state-dev/lambda/demo_auth.zip"
  session_management               = "s3://securebase-terraform-state-dev/lambda/session_management.zip"
  stripe_handler                   = "s3://securebase-terraform-state-dev/lambda/stripe_handler.zip"
  marketplace_resolve_customer     = "s3://securebase-terraform-state-dev/lambda/marketplace-registration.zip"
  marketplace_subscription_handler = "s3://securebase-terraform-state-dev/lambda/marketplace-entitlement.zip"
  marketplace_metering_worker      = "s3://securebase-terraform-state-dev/lambda/marketplace-metering.zip"
}
