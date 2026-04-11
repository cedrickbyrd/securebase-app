# Lambda Functions

This directory contains the Python Lambda handlers deployed by the SecureBase Terraform stack.

## Functions

| File | Handler | Purpose |
|------|---------|---------|
| `signup_handler.py` | `signup_handler.handler` | Customer self-registration |
| `verify_email.py` | `verify_email.lambda_handler` | Email verification |
| `onboarding_status.py` | `onboarding_status.handler` | Provisioning progress polling |
| `account_provisioner.py` | `account_provisioner.handler` | AWS account provisioning |
| `metric_aggregator.py` | `metric_aggregator.handler` | Usage metric aggregation |
| `stripe_webhook_handler.py` | `stripe_webhook_handler.handler` | Stripe webhook → GA4 tracking + account provisioning |
| `ga4_client.py` | _(imported by stripe_webhook_handler)_ | GA4 Measurement Protocol client |

> **Note:** `metric_aggregator.py` is **not** in this directory. The real implementation lives at
> `landing-zone/lambda/metric_aggregator.py` (handler: `metric_aggregator.lambda_handler`) and is
> archived by Terraform from that path. A 0-byte placeholder that was formerly in `lambda/` has been removed.

## Deploy

### Build the Stripe webhook zip

```bash
cd lambda && zip stripe_webhook.zip stripe_webhook_handler.py ga4_client.py
```

Upload via Terraform (`terraform apply`) or directly with the AWS CLI:

```bash
aws lambda update-function-code \
  --function-name securebase-stripe-webhook \
  --zip-file fileb://lambda/stripe_webhook.zip
```

### Create required SSM parameters

Before running `terraform apply`, store the secrets in SSM Parameter Store:

```bash
# Stripe webhook signing secret (from Stripe Dashboard → Webhooks → Signing secret)
aws ssm put-parameter \
  --name "/securebase/stripe/webhook_secret" \
  --value "whsec_..." \
  --type "SecureString" \
  --overwrite

# Stripe secret key (from Stripe Dashboard → Developers → API keys)
# Use sk_test_... for non-production environments to avoid accidental charges
aws ssm put-parameter \
  --name "/securebase/stripe/secret_key" \
  --value "sk_live_..." \
  --type "SecureString" \
  --overwrite

# GA4 Measurement Protocol API secret (from GA4 Admin → Data Streams → Measurement Protocol API secrets)
aws ssm put-parameter \
  --name "/securebase/ga4/api_secret" \
  --value "..." \
  --type "SecureString" \
  --overwrite

# Provisioner Lambda function name (deployed by account_provisioner Terraform module)
aws ssm put-parameter \
  --name "/securebase/provisioner/function" \
  --value "securebase-account-provisioner" \
  --type "String" \
  --overwrite
```
