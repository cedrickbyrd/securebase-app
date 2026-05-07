# Hybrid Stripe Testing Implementation Guide

## Executive Summary

This guide covers the two-tier testing strategy that gives SecureBase both
speed **and** confidence:

| Mode | Duration | External deps | When it runs |
|------|----------|---------------|--------------|
| **MOCK** | ~2–3 min | None | PRs, nightly cron, `workflow_dispatch` |
| **SANDBOX** | ~8–10 min | api.stripe.com | `push` to `main` |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [GitHub Secrets Setup](#github-secrets-setup)
3. [Stripe Configuration](#stripe-configuration)
4. [Workflow Integration](#workflow-integration)
5. [Test Implementation](#test-implementation)
6. [Webhook Testing](#webhook-testing)
7. [Data Cleanup](#data-cleanup)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Troubleshooting](#troubleshooting)
10. [Migration Checklist](#migration-checklist)
11. [Cost Analysis](#cost-analysis)

---

## Architecture Overview

### Current state (fully mocked)

```
┌─────────────────┐
│   GitHub PR     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Unit Tests     │ ◄── All mocks (MagicMock)
│  - stripe       │
│  - psycopg2     │
│  - boto3        │
└─────────────────┘
         │
         ▼
    ✅ PASS (but no real API validation)
```

Problems: fast, but DNS issues / Stripe API changes break silently.

### Proposed state (hybrid)

```
┌──────────────┐         ┌──────────────┐
│  Feature PR  │         │  Push main   │
└──────┬───────┘         └──────┬───────┘
       │                        │
       ▼                        ▼
┌─────────────┐         ┌─────────────┐
│ MOCK MODE   │         │SANDBOX MODE │
│  (Fast)     │         │  (Real API) │
└──────┬──────┘         └──────┬──────┘
       │                        │
       │                        ├─► Real Stripe API
       │                        ├─► Real webhooks
       │                        └─► DNS validation
       │                                │
       ▼                                ▼
   ✅ 2–3 min                      ✅ 8–10 min
                                   + production confidence
```

### Mode selection logic

| Trigger | Branch | Mode | Reason |
|---------|--------|------|--------|
| `push` | `main` | **SANDBOX** | Validate before production |
| `push` | `feature/*` | MOCK | Fast feedback |
| `pull_request` | any | MOCK | Don't burn API quota on PRs |
| `schedule` (nightly) | — | MOCK | Stability check |
| `workflow_dispatch` | any | MOCK | Manual override |

---

## GitHub Secrets Setup

Navigate to **Settings → Secrets and variables → Actions → New repository secret**.

### Stripe secrets

```
STRIPE_SECRET_KEY       sk_test_51…  (restricted test key — see below)
STRIPE_PRICE_STANDARD   price_…
STRIPE_PRICE_HEALTHCARE price_…
STRIPE_PRICE_FINTECH    price_…
STRIPE_PRICE_GOVERNMENT price_…
```

> **CRITICAL:** Only ever add **test mode** keys (`sk_test_…`).  
> Never add live keys (`sk_live_…`) to GitHub.

### Slack (optional, for failure alerts)

```
SLACK_WEBHOOK_URL   https://hooks.slack.com/services/…
```

### AWS credentials (OIDC — preferred over long-lived keys)

```
AWS_ROLE_ARN   arn:aws:iam::YOUR_ACCOUNT_ID:role/github-actions-sales-e2e
```

Create the OIDC role in Terraform:

```hcl
# landing-zone/modules/iam/github-actions-oidc.tf
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "sales_e2e" {
  name = "github-actions-sales-e2e"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" =
            "repo:cedrickbyrd/securebase-*:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "sales_e2e_permissions" {
  name = "sales-e2e-permissions"
  role = aws_iam_role.sales_e2e.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:GetFunction", "lambda:InvokeFunction"]
        Resource = "arn:aws:lambda:us-east-1:*:function:securebase-*"
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = "arn:aws:sns:us-east-1:*:onboarding*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = "*"
      }
    ]
  })
}
```

---

## Stripe Configuration

### Create test products & prices

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe
stripe login

# Create products
stripe products create --name="SecureBase Standard" \
  --description="Standard tier – up to 50 users"

stripe products create --name="SecureBase Healthcare" \
  --description="Healthcare tier – HIPAA compliant"

# Create recurring prices (replace prod_… with IDs from above)
stripe prices create \
  --product=prod_STANDARD_ID \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month \
  --nickname="standard-monthly"

stripe prices create \
  --product=prod_HEALTHCARE_ID \
  --unit-amount=29900 \
  --currency=usd \
  --recurring[interval]=month \
  --nickname="healthcare-monthly"
```

Save the resulting `price_…` IDs to GitHub Secrets.

### Create a restricted API key

**Dashboard → Developers → API keys → Create restricted key**

Required permissions:

| Resource | Permission |
|----------|-----------|
| Customers | Read / Write |
| Checkout Sessions | Read / Write |
| Subscriptions | Read / Write |
| Products | Read |
| Prices | Read |
| Charges | ❌ No access |
| Payouts | ❌ No access |

Using a restricted key limits blast radius if the key is ever compromised.

---

## Workflow Integration

The workflow file (`.github/workflows/e2e-online-sales.yml`) automatically
selects the mode.  Key additions in the `customer-journey-e2e` job:

```yaml
# 1. Resolve credentials once (no duplicated ternaries)
- name: Resolve Stripe credentials
  env:
    _SK: ${{ secrets.STRIPE_SECRET_KEY }}
    _PRICE_STD: ${{ secrets.STRIPE_PRICE_STANDARD }}
  run: |
    if [ "$STRIPE_MODE" = "sandbox" ]; then
      echo "RESOLVED_STRIPE_SECRET_KEY=${_SK}" >> "$GITHUB_ENV"
      echo "RESOLVED_STRIPE_PRICE_STANDARD=${_PRICE_STD}" >> "$GITHUB_ENV"
    else
      echo "RESOLVED_STRIPE_SECRET_KEY=sk_test_mock" >> "$GITHUB_ENV"
      echo "RESOLVED_STRIPE_PRICE_STANDARD=price_mock_standard" >> "$GITHUB_ENV"
    fi

# 2. Stripe CLI webhook signing secret (--print-secret exits immediately)
- name: Start Stripe CLI webhook listener
  if: env.STRIPE_MODE == 'sandbox'
  run: |
    WHSEC=$(stripe listen --api-key "$RESOLVED_STRIPE_SECRET_KEY" \
              --print-secret 2>/dev/null || true)
    echo "STRIPE_WEBHOOK_SECRET=${WHSEC}" >> "$GITHUB_ENV"
    stripe listen --api-key "$RESOLVED_STRIPE_SECRET_KEY" \
      --forward-to http://localhost:9090/stripe-webhook \
      > /tmp/stripe-cli.log 2>&1 &

# 3. Run tests with --stripe-mode flag
- name: Run complete sales journey E2E tests
  run: |
    python -m pytest tests/e2e/test_sales_journey_e2e.py -v \
      --stripe-mode=${{ env.STRIPE_MODE }} \
      --junitxml=test-results/junit-sales-journey.xml

# 4. Clean up via the StripeTestCleaner CLI
- name: Clean up Stripe test data
  if: env.STRIPE_MODE == 'sandbox' && always()
  run: python scripts/stripe_cleanup.py --run-id="${{ github.run_id }}"

# 5. Slack alert on sandbox failures
- name: Notify Slack on SANDBOX failure
  if: failure() && env.STRIPE_MODE == 'sandbox'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  run: |
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      --data-binary '{ "text": "🚨 SANDBOX E2E tests failed on main" }'
```

---

## Test Implementation

### Running tests locally

```bash
# MOCK mode (fast, offline)
export STRIPE_MODE=mock
pytest tests/e2e/test_sales_journey_e2e.py -v

# SANDBOX mode (requires real Stripe key)
export STRIPE_MODE=sandbox
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_PRICE_STANDARD=price_...
pytest tests/e2e/test_sales_journey_e2e.py -v --stripe-mode=sandbox
```

### Expected output

**MOCK mode:**
```
tests/e2e/test_sales_journey_e2e.py::TestSalesJourneyE2E::test_step1_initiate_checkout PASSED
tests/e2e/test_sales_journey_e2e.py::TestStripeSandboxHandshake::test_checkout_handshake PASSED
  ✓ Mock handshake: checkout.Session.create wired correctly → cs_test_mock_handshake_001

======== 9 passed in 2.34s ========
```

**SANDBOX mode:**
```
tests/e2e/test_sales_journey_e2e.py::TestStripeSandboxHandshake::test_checkout_handshake PASSED
  ✓ Sandbox handshake: Stripe checkout session created → cs_test_a1b2c3d4...

======== 9 passed in 8.92s ========
```

---

## Webhook Testing

### Option 1: Stripe CLI (recommended for CI)

The workflow already starts the Stripe CLI listener in sandbox mode.  For
manual testing:

```bash
# Terminal 1 – start webhook listener
stripe listen --forward-to http://localhost:5000/stripe-webhook
# Copy the whsec_... secret printed to the terminal

# Terminal 2 – set secret and start your local Lambda/server
export STRIPE_WEBHOOK_SECRET=whsec_...
python phase2-backend/functions/stripe_webhook.py

# Terminal 3 – trigger a test event
stripe trigger checkout.session.completed
```

### Option 2: Smee.io (for persistent public URL)

```bash
npm install -g smee-client
# Create a channel at https://smee.io, then:
smee --url https://smee.io/YOUR_CHANNEL \
     --path /stripe-webhook \
     --port 5000
```

Update the Stripe webhook endpoint in the Dashboard to your Smee URL.

---

## Data Cleanup

All Stripe objects created by the sandbox tests are tagged with
`metadata.test_run_id = <GITHUB_RUN_ID>` so cleanup is precise and
idempotent.

### Cleanup script (`scripts/stripe_cleanup.py`)

```bash
# Clean up a specific CI run (used automatically by the workflow)
python scripts/stripe_cleanup.py --run-id 12345678

# Clean up objects created in the last 2 hours
python scripts/stripe_cleanup.py --hours 2

# Preview without deleting
python scripts/stripe_cleanup.py --run-id 12345678 --dry-run

# Remove ALL test-tagged objects (interactive confirmation)
python scripts/stripe_cleanup.py --all-test-data
```

### Verify cleanup

```bash
# List recent customers – should show none with test_run_id metadata
stripe customers list --limit=10

# Or via the Stripe Dashboard → Customers → filter by metadata
```

---

## Monitoring & Alerting

### CloudWatch dashboard widget

Add to `cloudwatch_dashboard.json`:

```json
{
  "type": "metric",
  "properties": {
    "title": "Stripe API Calls (Test Mode)",
    "metrics": [
      ["SecureBase/E2E", "StripeAPICalls", {"stat": "Sum"}],
      [".",              "StripeAPIErrors", {"stat": "Sum"}]
    ],
    "period": 300,
    "region": "us-east-1"
  }
}
```

### Slack alerts

The workflow sends a Slack notification when sandbox tests fail on `main`.
To enable, add `SLACK_WEBHOOK_URL` to GitHub Secrets (see
[GitHub Secrets Setup](#github-secrets-setup)).

---

## Troubleshooting

### "SANDBOX tests pass but real production fails"

```bash
# Check DNS resolution
host api.securebase.com

# Health check the live API
curl https://api.securebase.com/health

# Verify Stripe webhook endpoint is reachable
curl -X POST https://api.securebase.com/stripe-webhook \
  -H "stripe-signature: test"
```

### "Rate limit exceeded in SANDBOX mode"

```bash
# Check recent API requests
stripe api_requests list --limit=10
```

Add a delay between test API calls:

```python
import time, os
time.sleep(int(os.getenv('STRIPE_API_DELAY_MS', '0')) / 1000)
```

Set `STRIPE_API_DELAY_MS=1000` in the workflow env to add a 1-second pause.

### "Webhook signature verification fails"

```bash
# Refresh the signing secret
stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret

# Update the GitHub secret
gh secret set STRIPE_WEBHOOK_SECRET --body "whsec_..."
```

### "Test data not cleaning up"

```bash
# Check for orphaned objects
stripe customers list --limit=100 | grep test_run_id

# Manual full cleanup (requires confirmation)
STRIPE_SECRET_KEY=sk_test_... \
  python scripts/stripe_cleanup.py --all-test-data
```

---

## Migration Checklist

- [ ] GitHub secrets configured: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STANDARD`, etc.
- [ ] Stripe test products & prices created in **test mode**
- [ ] `STRIPE_PRICE_*` secrets set in the repository
- [ ] MOCK mode tests passing on a feature branch
- [ ] SANDBOX mode tests passing on `main`
- [ ] Cleanup script tested manually (`--dry-run` first)
- [ ] Slack notifications working (optional)
- [ ] CloudWatch dashboard updated (optional)

---

## Cost Analysis

| Scenario | Stripe API calls | Cost |
|----------|-----------------|------|
| Feature PR (MOCK) | 0 | $0 |
| Nightly cron (MOCK) | 0 | $0 |
| Push to main (SANDBOX) | ~15–20 | < $0.01 |

**Monthly projection** (3 main pushes/day):
~90 SANDBOX runs × ~$0.05 AWS costs = **~$4.50/month**

ROI: catching one production bug saves hours of debugging.
