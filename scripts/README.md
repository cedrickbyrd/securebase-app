# Scripts Directory

This directory contains automation scripts for SecureBase operations.

## Stripe Payment Integration Scripts

### validate-stripe.py

Python script for validating Stripe payment configuration.

**Usage:**
```bash
# Run all validation checks
python scripts/validate-stripe.py --all

# Run specific checks
python scripts/validate-stripe.py --test-connection
python scripts/validate-stripe.py --check-products
python scripts/validate-stripe.py --verify-prices
python scripts/validate-stripe.py --test-webhook
```

**Required Environment Variables:**
- `STRIPE_SECRET_KEY` - Stripe API secret key (required for all checks)
- `STRIPE_PRICE_HEALTHCARE` - Healthcare tier price ID (for price verification)
- `STRIPE_PRICE_FINTECH` - Fintech tier price ID (for price verification)
- `STRIPE_PRICE_GOVERNMENT` - Government tier price ID (for price verification)
- `STRIPE_PRICE_STANDARD` - Standard tier price ID (for price verification)
- `WEBHOOK_URL` - Webhook endpoint URL (optional, for endpoint check)

### test-stripe-flow.sh

Bash script for end-to-end payment flow testing.

**Usage:**
```bash
# Set required environment variables
export API_BASE_URL=https://api.securebase.dev
export DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Run the test
bash scripts/test-stripe-flow.sh
```

This script will:
1. Create a checkout session via API
2. Prompt you to complete payment manually
3. Wait for webhook processing
4. Verify customer record in database

## Demo snapshot API & auto-generation

A small HTTP endpoint is available to generate demo snapshots on demand:

- services/demo_api.py exposes GET /demo/report
- Secure with env var: export DEMO_API_TOKEN="your-token"
- Start: uvicorn services.demo_api:app --host 0.0.0.0 --port 8080

Seed integration:
- After running seed_demo_data(), call scripts/seed_post_seed_hooks.generate_snapshot() (or run the CLI)
- The seed flow will write exports/demo_snapshot.html which is ready for demos

Security:
- Set DEMO_API_TOKEN and restrict access (IP allow-list), or run behind an auth proxy in public environments.
