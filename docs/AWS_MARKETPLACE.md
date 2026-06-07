# AWS Marketplace — SecureBase Compliance Posture Platform

Canonical reference for the SecureBase SaaS listing on AWS Marketplace.
Update this document whenever pricing dimensions, product identifiers, or
the Stripe tier mapping changes.

---

## Product Identity

| Field | Value |
|---|---|
| **Product ID** | `prod-p7z4iqf7gg6dk` |
| **Product Code** | `blblyu28f6s5mzwl089d4xoea` |
| **Listing type** | SaaS subscriptions |
| **Fulfillment URL** | `https://portal.securebase.tximhotep.com/marketplace-redirect` |
| **AWS account** | `731184206915` |
| **SNS topic ARN** | `arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-blblyu28f6s5mzwl089d4xoea` |

> The SNS topic is owned by the AWS Marketplace service account (`287250355862`).
> The ARN is set as the CI/CD secret `AWS_MARKETPLACE_SNS_TOPIC_ARN` — never commit it to the repo.

---

## Pricing Dimensions

Dimensions are defined in the AWS Marketplace Management Portal (AMMP) and
must exactly match the keys in `DIMENSION_TO_TIER` in
`phase2-backend/functions/marketplace_subscription_handler.py`.

| AMMP Dimension API name | Display name | Price | Internal tier | Framework | Stripe env var |
|---|---|---|---|---|---|
| `standard_monthly` | Standard | $2,000/mo | `standard` | CIS | `STRIPE_PRICE_STANDARD` |
| `fintech_monthly` | Fintech | $8,000/mo | `fintech` | FFIEC | `STRIPE_PRICE_FINTECH` |
| `healthcare_monthly` | Healthcare | $15,000/mo | `healthcare` | HIPAA | `STRIPE_PRICE_HEALTHCARE` |
| `government_monthly` | Government | $25,000/mo | `gov-federal` | FedRAMP | `STRIPE_PRICE_GOVERNMENT` |

### Alignment rules

- **Dimension API name** is the string AWS sends in entitlement events. It must
  match a key in `DIMENSION_TO_TIER` exactly — case-sensitive.
- **Internal tier** is the value written to `customers.tier` in Aurora and used
  throughout the application (compliance rules, reporting, JWT claims).
- **Framework** is the compliance framework assigned at customer creation via
  `TIER_FRAMEWORK_MAP` in `marketplace_resolve_customer.py`.
- **Stripe env var** is the corresponding Lambda environment variable for the
  direct (non-Marketplace) Stripe checkout path. Prices must be kept in sync
  between channels.

---

## Stripe ↔ Marketplace Channel Mapping

Customers can subscribe through two independent billing channels. Both channels
write to the same `customers` table using the same internal tier names.

```
Direct (Stripe checkout)              AWS Marketplace
────────────────────────              ───────────────
portal /signup → /checkout            AWS subscribe → SNS event
       ↓                                     ↓
create_checkout_session.py           marketplace_subscription_handler.py
       ↓                                     ↓
stripe_webhook.py                    DIMENSION_TO_TIER lookup
       ↓                                     ↓
trigger_onboarding.py                marketplace_resolve_customer.py
       ↓                                     ↓
customers.tier = 'standard'          customers.tier = 'standard'
                 'fintech'                            'fintech'
                 'healthcare'                         'healthcare'
                 'gov-federal'                        'gov-federal'
```

> **Rule:** Any change to tier names, prices, or the Stripe→Marketplace mapping
> must be reflected in both `DIMENSION_TO_TIER` (subscription handler) and
> the Stripe price IDs stored in Lambda env vars / GitHub secrets.

---

## Architecture

### Lambda functions

| Function | S3 artifact | Purpose |
|---|---|---|
| `securebase-prod-marketplace-resolve-customer` | `s3://securebase-terraform-state-prod/lambda/marketplace_resolve_customer.zip` | Resolves buyer registration token via `ResolveCustomer` API; provisions customer record; mints 24-hr JWT; triggers onboarding |
| `securebase-prod-marketplace-subscription-handler` | `s3://securebase-terraform-state-prod/lambda/marketplace-entitlement.zip` | Handles SNS lifecycle events (subscribe-success, unsubscribe, entitlement-updated); updates `customers` table |
| `securebase-prod-marketplace-metering-worker` | `s3://securebase-terraform-state-prod/lambda/marketplace-metering.zip` | Runs hourly via EventBridge; reports usage records to AWS Metering API |

### SNS event flow

```
AWS Marketplace
  └─ publishes to: arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-<product-code>
        └─ subscribed by: marketplace_subscription_handler Lambda
              └─ event types handled:
                    subscribe-success    → customers.subscription_status = 'active'
                    subscribe-fail       → customers.subscription_status = 'failed'
                    unsubscribe-pending  → customers.subscription_status = 'unsubscribe-pending'
                    unsubscribe-success  → customers.subscription_status = 'cancelled'
                    entitlement-updated  → calls GetEntitlements; updates tier via DIMENSION_TO_TIER
```

### Terraform module

Source: `landing-zone/modules/marketplace/`
Instantiated in: `landing-zone/environments/prod/main.tf` (module `marketplace`)
Variables: `landing-zone/environments/prod/marketplace.tfvars`

The module is conditionally enabled — all required variables must be non-empty
or it creates zero resources. See `main.tf` `count = alltrue([...])` guard.

**Outstanding fix required before go-live:**
`marketplace_db_host` in `marketplace.tfvars` currently points at the dev RDS
proxy endpoint. Must be updated to the prod Aurora endpoint before the listing
goes public.

---

## CI/CD Secrets

The following GitHub Actions secrets are required for marketplace deploys.
Never commit these values to the repository.

| Secret | Description |
|---|---|
| `AWS_MARKETPLACE_SNS_TOPIC_ARN` | ARN of the AWS-owned SNS topic for this product |
| `MARKETPLACE_PRODUCT_CODE` | Product code from AMMP (`blblyu28f6s5mzwl089d4xoea`) |

---

## AMMP Configuration Checklist

Use this checklist when updating the listing in the AWS Marketplace Management
Portal.

- [ ] Pricing dimension API names match exactly: `standard_monthly`, `fintech_monthly`, `healthcare_monthly`, `government_monthly`
- [ ] Dimension prices match Stripe: $2K / $8K / $15K / $25K
- [ ] Fulfillment URL set to `https://portal.securebase.tximhotep.com/marketplace-redirect`
- [ ] `DIMENSION_TO_TIER` in `marketplace_subscription_handler.py` matches AMMP dimension names
- [ ] `marketplace_db_host` in `marketplace.tfvars` updated to prod Aurora endpoint
- [ ] `marketplace-entitlement.zip` rebuilt and uploaded to prod S3 after any Lambda code changes
- [ ] `AWS_MARKETPLACE_SNS_TOPIC_ARN` CI/CD secret set (not in repo)

---

## Operational Runbook

### Verify a subscriber resolved correctly

```bash
# Check CloudWatch logs for resolve-customer Lambda
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-prod-marketplace-resolve-customer \
  --filter-pattern "marketplace_customer_id" \
  --start-time $(date -d '1 hour ago' +%s000)

# Confirm customer record in Aurora
psql $PROD_DB_URL -c \
  "SELECT id, tier, subscription_status, marketplace_entitlement_status \
   FROM customers WHERE payment_method = 'aws_marketplace' ORDER BY created_at DESC LIMIT 10;"
```

### Force an entitlement refresh

```bash
# Invoke subscription handler with a synthetic entitlement-updated event
aws lambda invoke \
  --function-name securebase-prod-marketplace-subscription-handler \
  --payload '{"Records":[{"Sns":{"Message":"{\"eventType\":\"entitlement-updated\",\"customerIdentifier\":\"<MARKETPLACE_CUSTOMER_ID>\"}","MessageId":"manual-refresh"}}]}' \
  /tmp/out.json
cat /tmp/out.json
```

### Rebuild and redeploy marketplace Lambdas

```bash
cd phase2-backend/functions
bash package-lambda.sh marketplace_subscription_handler marketplace_resolve_customer marketplace_metering_worker

# Upload to prod S3
aws s3 cp deploy/marketplace-entitlement.zip \
  s3://securebase-terraform-state-prod/lambda/marketplace-entitlement.zip
aws s3 cp deploy/marketplace_resolve_customer.zip \
  s3://securebase-terraform-state-prod/lambda/marketplace_resolve_customer.zip
aws s3 cp deploy/marketplace-metering.zip \
  s3://securebase-terraform-state-prod/lambda/marketplace-metering.zip

# Trigger terraform-apply workflow targeting marketplace module
# (or update function code directly for a hotfix)
aws lambda update-function-code \
  --function-name securebase-prod-marketplace-subscription-handler \
  --s3-bucket securebase-terraform-state-prod \
  --s3-key lambda/marketplace-entitlement.zip
```

### Monitor metering worker

```bash
# Check last metering run
aws logs filter-log-events \
  --log-group-name /aws/lambda/securebase-prod-marketplace-metering-worker \
  --filter-pattern "processed" \
  --start-time $(date -d '2 hours ago' +%s000)

# CloudWatch alarm: securebase-prod-marketplace-metering-worker-errors
# Fires on any Lambda error in a 1-hour window.
```

---

## Related Files

| File | Purpose |
|---|---|
| `phase2-backend/functions/marketplace_resolve_customer.py` | Buyer token resolution + customer provisioning |
| `phase2-backend/functions/marketplace_subscription_handler.py` | SNS lifecycle event handler; contains `DIMENSION_TO_TIER` |
| `phase2-backend/functions/marketplace_metering_worker.py` | Hourly metering reporter |
| `landing-zone/modules/marketplace/main.tf` | Terraform module (Lambdas, SNS subscription, EventBridge, alarms) |
| `landing-zone/environments/prod/marketplace.tfvars` | Prod variable overrides (db_host, role ARN, subnet IDs) |
| `docs/SIGNUP_WORKFLOW.md` | Direct Stripe checkout flow (non-Marketplace path) |
