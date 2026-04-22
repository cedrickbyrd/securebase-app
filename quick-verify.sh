#!/bin/bash
# quick-verify.sh
# Quick inline verification without needing separate Node.js files

echo "════════════════════════════════════════════════════════"
echo "  SecureBase Production Verification"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if STRIPE_API_KEY is set
if [ -z "$STRIPE_API_KEY" ]; then
    echo "⚠️  STRIPE_API_KEY not set. Setting it now..."
    export STRIPE_API_KEY=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
    echo "✅ API key set"
else
    echo "✅ STRIPE_API_KEY already set"
fi

echo ""
echo "━━━━ Product Verification ━━━━"
echo ""

# List products
echo "Checking SecureBase product..."
stripe products list --limit 10 | head -30

echo ""
echo "━━━━ Pricing Verification ━━━━"
echo ""

# List prices
echo "Checking pricing tiers..."
stripe prices list --limit 10 | head -40

echo ""
echo "━━━━ Webhook Verification ━━━━"
echo ""

# List webhooks
echo "Checking webhook endpoints..."
WEBHOOK_OUTPUT=$(stripe webhook_endpoints list 2>&1)

if echo "$WEBHOOK_OUTPUT" | grep -q "id.*we_"; then
    echo "✅ Webhooks found!"
    echo "$WEBHOOK_OUTPUT" | head -50
else
    echo "❌ NO WEBHOOKS CONFIGURED!"
    echo ""
    echo "You need to configure webhooks:"
    echo "1. Go to: https://dashboard.stripe.com/webhooks"
    echo "2. Toggle to Live mode"
    echo "3. Click '+ Add endpoint'"
    echo "4. Enter your webhook URL"
    echo "5. Select events or use '*' for all events"
    echo ""
fi

echo ""
echo "━━━━ Account Status ━━━━"
echo ""

# Get balance
echo "Checking account balance..."
stripe balance retrieve | head -20

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Verification Complete"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Verify webhooks are configured above"
echo "2. Get your publishable key: https://dashboard.stripe.com/apikeys"
echo "3. Test checkout with: stripe checkout sessions create --help"
echo ""
