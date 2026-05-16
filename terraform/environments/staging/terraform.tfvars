environment             = "staging"
api_stage_name          = "staging"
rest_api_id             = "9xyetu7zq3"
root_resource_id        = "7q9sggej19"
auth_parent_resource_id = "7q9sggej19"
aws_region              = "us-east-1"

auth_lambda_arn  = "arn:aws:lambda:us-east-1:731184206915:function:securebase-staging-auth-v2"
auth_lambda_name = "securebase-staging-auth-v2"

checkout_lambda_arn  = "arn:aws:lambda:us-east-1:731184206915:function:securebase-staging-create-checkout-session"
checkout_lambda_name = "securebase-staging-create-checkout-session"

signup_lambda_arn       = "arn:aws:lambda:us-east-1:731184206915:function:securebase-staging-signup-handler"
signup_lambda_name      = "securebase-staging-signup-handler"
verify_email_lambda_arn = "arn:aws:lambda:us-east-1:731184206915:function:securebase-staging-verify-email"
verify_email_lambda_name = "securebase-staging-verify-email"
onboarding_lambda_arn   = "arn:aws:lambda:us-east-1:731184206915:function:securebase-staging-trigger-onboarding"
onboarding_lambda_name  = "securebase-staging-trigger-onboarding"

pilot_availability_lambda_name = "securebase-staging-pilot-availability"
validate_session_lambda_name   = "securebase-staging-validate-session"
stripe_webhook_lambda_name     = "securebase-staging-stripe-webhook"
