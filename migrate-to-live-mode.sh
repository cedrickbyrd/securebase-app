#!/bin/bash
# migrate-to-live-mode-v2.sh
# Compatible with older Stripe CLI versions

echo "════════════════════════════════════════════════════════"
echo "  SecureBase Product - Migration to LIVE Mode"
echo "════════════════════════════════════════════════════════"
echo ""
echo "⚠️  WARNING: You are about to work in PRODUCTION mode!"
echo "   Real money will be processed."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled."
    exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  IMPORTANT SETUP INSTRUCTIONS"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Your Stripe CLI version doesn't support the --live flag."
echo "You need to manually configure live mode using environment variables."
echo ""
echo "Step 1: Get your LIVE Secret Key"
echo "   1. Go to: https://dashboard.stripe.com/apikeys"
echo "   2. Toggle to 'Live mode' (switch in top right)"
echo "   3. Copy your 'Secret key' (starts with sk_live_)"
echo ""
read -p "Paste your LIVE Secret Key here (sk_live_...): " STRIPE_API_KEY

# Validate the key
if [[ ! $STRIPE_API_KEY =~ ^sk_live_ ]]; then
    echo ""
    echo "❌ ERROR: This doesn't look like a live secret key!"
    echo "   Live keys start with: sk_live_"
    echo "   You provided: ${STRIPE_API_KEY:0:10}..."
    echo ""
    echo "Please make sure you're copying the LIVE secret key, not TEST."
    exit 1
fi

echo ""
echo "✅ Valid live key detected!"
echo ""
echo "Step 2: Setting up environment..."
export STRIPE_API_KEY

echo "✅ Environment configured"
echo ""
echo "Step 3: Creating SecureBase product in LIVE mode..."

# Create product
PRODUCT_OUTPUT=$(stripe products create \
  -d name="SecureBase by TxImhotep LLC" \
  -d description="Audit-Ready AWS Infrastructure - HIPAA, SOC2, and FedRAMP Compliance" \
  -d type=service 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to create product!"
    echo "$PRODUCT_OUTPUT"
    exit 1
fi

echo "✅ Product created successfully!"
echo ""
echo "$PRODUCT_OUTPUT"
echo ""

# Extract product ID from output
PRODUCT_ID=$(echo "$PRODUCT_OUTPUT" | grep -o 'prod_[A-Za-z0-9]*' | head -1)

if [ -z "$PRODUCT_ID" ]; then
    echo "❌ Could not extract product ID. Please check the output above."
    exit 1
fi

echo "Product ID: $PRODUCT_ID"
echo "$PRODUCT_ID" > .securebase-product-id

echo ""
echo "Step 4: Creating pricing tiers..."
echo ""

# Starter Monthly - $99/month
echo "Creating Starter Monthly ($99/month)..."
STARTER_MONTHLY_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=9900 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d nickname="Starter Monthly" 2>&1)

if [ $? -eq 0 ]; then
    STARTER_MONTHLY_ID=$(echo "$STARTER_MONTHLY_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Starter Monthly: $STARTER_MONTHLY_ID"
    echo "$STARTER_MONTHLY_ID" > .starter-monthly-price-id
else
    echo "⚠️  Failed to create Starter Monthly"
fi

# Professional Monthly - $299/month
echo "Creating Professional Monthly ($299/month)..."
PROFESSIONAL_MONTHLY_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=29900 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d nickname="Professional Monthly" 2>&1)

if [ $? -eq 0 ]; then
    PROFESSIONAL_MONTHLY_ID=$(echo "$PROFESSIONAL_MONTHLY_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Professional Monthly: $PROFESSIONAL_MONTHLY_ID"
    echo "$PROFESSIONAL_MONTHLY_ID" > .professional-monthly-price-id
else
    echo "⚠️  Failed to create Professional Monthly"
fi

# Enterprise Monthly - $999/month
echo "Creating Enterprise Monthly ($999/month)..."
ENTERPRISE_MONTHLY_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=99900 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d nickname="Enterprise Monthly" 2>&1)

if [ $? -eq 0 ]; then
    ENTERPRISE_MONTHLY_ID=$(echo "$ENTERPRISE_MONTHLY_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Enterprise Monthly: $ENTERPRISE_MONTHLY_ID"
    echo "$ENTERPRISE_MONTHLY_ID" > .enterprise-monthly-price-id
else
    echo "⚠️  Failed to create Enterprise Monthly"
fi

echo ""
echo "Creating Annual pricing (with 2 months discount)..."
echo ""

# Starter Annual - $990/year
echo "Creating Starter Annual ($990/year - save \$198)..."
STARTER_ANNUAL_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=99000 \
  -d currency=usd \
  -d "recurring[interval]"=year \
  -d nickname="Starter Annual" 2>&1)

if [ $? -eq 0 ]; then
    STARTER_ANNUAL_ID=$(echo "$STARTER_ANNUAL_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Starter Annual: $STARTER_ANNUAL_ID"
    echo "$STARTER_ANNUAL_ID" > .starter-annual-price-id
else
    echo "⚠️  Failed to create Starter Annual"
fi

# Professional Annual - $2,990/year
echo "Creating Professional Annual ($2,990/year - save \$598)..."
PROFESSIONAL_ANNUAL_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=299000 \
  -d currency=usd \
  -d "recurring[interval]"=year \
  -d nickname="Professional Annual" 2>&1)

if [ $? -eq 0 ]; then
    PROFESSIONAL_ANNUAL_ID=$(echo "$PROFESSIONAL_ANNUAL_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Professional Annual: $PROFESSIONAL_ANNUAL_ID"
    echo "$PROFESSIONAL_ANNUAL_ID" > .professional-annual-price-id
else
    echo "⚠️  Failed to create Professional Annual"
fi

# Enterprise Annual - $9,990/year
echo "Creating Enterprise Annual ($9,990/year - save \$1,998)..."
ENTERPRISE_ANNUAL_OUTPUT=$(stripe prices create \
  -d product=$PRODUCT_ID \
  -d unit_amount=999000 \
  -d currency=usd \
  -d "recurring[interval]"=year \
  -d nickname="Enterprise Annual" 2>&1)

if [ $? -eq 0 ]; then
    ENTERPRISE_ANNUAL_ID=$(echo "$ENTERPRISE_ANNUAL_OUTPUT" | grep -o 'price_[A-Za-z0-9]*' | head -1)
    echo "✅ Enterprise Annual: $ENTERPRISE_ANNUAL_ID"
    echo "$ENTERPRISE_ANNUAL_ID" > .enterprise-annual-price-id
else
    echo "⚠️  Failed to create Enterprise Annual"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Migration Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Product: SecureBase by TxImhotep LLC"
echo "Product ID: $PRODUCT_ID"
echo ""
echo "Monthly Pricing:"
[ ! -z "$STARTER_MONTHLY_ID" ] && echo "  Starter:       \$99/month  - $STARTER_MONTHLY_ID"
[ ! -z "$PROFESSIONAL_MONTHLY_ID" ] && echo "  Professional:  \$299/month - $PROFESSIONAL_MONTHLY_ID"
[ ! -z "$ENTERPRISE_MONTHLY_ID" ] && echo "  Enterprise:    \$999/month - $ENTERPRISE_MONTHLY_ID"
echo ""
echo "Annual Pricing (2 months free):"
[ ! -z "$STARTER_ANNUAL_ID" ] && echo "  Starter:       \$990/year  - $STARTER_ANNUAL_ID"
[ ! -z "$PROFESSIONAL_ANNUAL_ID" ] && echo "  Professional:  \$2,990/year - $PROFESSIONAL_ANNUAL_ID"
[ ! -z "$ENTERPRISE_ANNUAL_ID" ] && echo "  Enterprise:    \$9,990/year - $ENTERPRISE_ANNUAL_ID"
echo ""
echo "All IDs saved to local files for easy reference."
echo ""
echo "Next steps:"
echo "  1. View in dashboard: https://dashboard.stripe.com/products"
echo "  2. List all products: stripe products list"
echo "  3. List all prices: stripe prices list"
echo ""
echo "⚠️  Remember to keep your STRIPE_API_KEY environment variable set:"
echo "   export STRIPE_API_KEY=$STRIPE_API_KEY"
echo ""
