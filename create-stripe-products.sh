#!/bin/bash
# 🚀 Stripe Live Products Creation
# Replace sk_live_YOUR_KEY with your actual live secret key

export STRIPE_API_KEY=sk_live_YOUR_SECRET_KEY_HERE

echo "Creating Healthcare tier..."
HEALTHCARE_PRODUCT=$(stripe products create \
  --name "SecureBase Healthcare" \
  --description "HIPAA-compliant AWS Landing Zone with 7-year retention" \
  --metadata tier=healthcare \
  --metadata framework=hipaa \
  -o json | jq -r '.id')

HEALTHCARE_PRICE=$(stripe prices create \
  --product $HEALTHCARE_PRODUCT \
  --currency usd \
  --unit-amount 1500000 \
  --recurring interval=month \
  --nickname "Healthcare Monthly" \
  -o json | jq -r '.id')

echo "✅ Healthcare: $HEALTHCARE_PRICE"

echo "Creating Fintech tier..."
FINTECH_PRODUCT=$(stripe products create \
  --name "SecureBase Fintech" \
  --description "SOC2 Type II compliant AWS Landing Zone" \
  --metadata tier=fintech \
  --metadata framework=soc2 \
  -o json | jq -r '.id')

FINTECH_PRICE=$(stripe prices create \
  --product $FINTECH_PRODUCT \
  --currency usd \
  --unit-amount 800000 \
  --recurring interval=month \
  --nickname "Fintech Monthly" \
  -o json | jq -r '.id')

echo "✅ Fintech: $FINTECH_PRICE"

echo "Creating Government tier..."
GOV_PRODUCT=$(stripe products create \
  --name "SecureBase Government" \
  --description "FedRAMP-aligned AWS Landing Zone" \
  --metadata tier=government \
  --metadata framework=fedramp \
  -o json | jq -r '.id')

GOV_PRICE=$(stripe prices create \
  --product $GOV_PRODUCT \
  --currency usd \
  --unit-amount 2500000 \
  --recurring interval=month \
  --nickname "Government Monthly" \
  -o json | jq -r '.id')

echo "✅ Government: $GOV_PRICE"

echo "Creating Standard tier..."
STANDARD_PRODUCT=$(stripe products create \
  --name "SecureBase Standard" \
  --description "CIS Foundations compliant AWS Landing Zone" \
  --metadata tier=standard \
  --metadata framework=cis \
  -o json | jq -r '.id')

STANDARD_PRICE=$(stripe prices create \
  --product $STANDARD_PRODUCT \
  --currency usd \
  --unit-amount 200000 \
  --recurring interval=month \
  --nickname "Standard Monthly" \
  -o json | jq -r '.id')

echo "✅ Standard: $STANDARD_PRICE"

echo "Creating pilot coupon..."
PILOT_COUPON=$(stripe coupons create \
  --percent-off 50 \
  --duration repeating \
  --duration-in-months 6 \
  --max-redemptions 20 \
  --name "SecureBase Pilot Program" \
  -o json | jq -r '.id')

echo "✅ Pilot coupon: $PILOT_COUPON"

echo ""
echo "🎊 ALL PRODUCTS CREATED!"
echo "========================="
echo ""
echo "📝 COPY THESE IDs FOR NEXT STEP:"
echo "Healthcare Price ID: $HEALTHCARE_PRICE"
echo "Fintech Price ID: $FINTECH_PRICE" 
echo "Government Price ID: $GOV_PRICE"
echo "Standard Price ID: $STANDARD_PRICE"
echo "Pilot Coupon ID: $PILOT_COUPON"