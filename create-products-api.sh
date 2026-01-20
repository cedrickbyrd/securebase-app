#!/bin/bash
# 🚀 Create Stripe Products via API (No CLI needed)
# Replace YOUR_LIVE_SECRET_KEY with your actual sk_live_... key

SECRET_KEY="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"

echo "🏥 Creating Healthcare tier..."
HEALTHCARE_PRODUCT=$(curl -s https://api.stripe.com/v1/products \
  -u "$SECRET_KEY": \
  -d "name=SecureBase Healthcare" \
  -d "description=HIPAA-compliant AWS Landing Zone with 7-year retention" \
  -d "metadata[tier]=healthcare" \
  -d "metadata[framework]=hipaa" | jq -r '.id')

HEALTHCARE_PRICE=$(curl -s https://api.stripe.com/v1/prices \
  -u "$SECRET_KEY": \
  -d "product=$HEALTHCARE_PRODUCT" \
  -d "currency=usd" \
  -d "unit_amount=1500000" \
  -d "recurring[interval]=month" \
  -d "nickname=Healthcare Monthly" | jq -r '.id')

echo "Healthcare Product: $HEALTHCARE_PRODUCT"
echo "Healthcare Price: $HEALTHCARE_PRICE"

echo ""
echo "💰 Creating Fintech tier..."
FINTECH_PRODUCT=$(curl -s https://api.stripe.com/v1/products \
  -u "$SECRET_KEY": \
  -d "name=SecureBase Fintech" \
  -d "description=SOC2 Type II compliant AWS Landing Zone" \
  -d "metadata[tier]=fintech" \
  -d "metadata[framework]=soc2" | jq -r '.id')

FINTECH_PRICE=$(curl -s https://api.stripe.com/v1/prices \
  -u "$SECRET_KEY": \
  -d "product=$FINTECH_PRODUCT" \
  -d "currency=usd" \
  -d "unit_amount=800000" \
  -d "recurring[interval]=month" \
  -d "nickname=Fintech Monthly" | jq -r '.id')

echo "Fintech Product: $FINTECH_PRODUCT"
echo "Fintech Price: $FINTECH_PRICE"

echo ""
echo "🏛️ Creating Government tier..."
GOV_PRODUCT=$(curl -s https://api.stripe.com/v1/products \
  -u "$SECRET_KEY": \
  -d "name=SecureBase Government" \
  -d "description=FedRAMP-aligned AWS Landing Zone" \
  -d "metadata[tier]=government" \
  -d "metadata[framework]=fedramp" | jq -r '.id')

GOV_PRICE=$(curl -s https://api.stripe.com/v1/prices \
  -u "$SECRET_KEY": \
  -d "product=$GOV_PRODUCT" \
  -d "currency=usd" \
  -d "unit_amount=2500000" \
  -d "recurring[interval]=month" \
  -d "nickname=Government Monthly" | jq -r '.id')

echo "Government Product: $GOV_PRODUCT"
echo "Government Price: $GOV_PRICE"

echo ""
echo "📊 Creating Standard tier..."
STANDARD_PRODUCT=$(curl -s https://api.stripe.com/v1/products \
  -u "$SECRET_KEY": \
  -d "name=SecureBase Standard" \
  -d "description=CIS Foundations compliant AWS Landing Zone" \
  -d "metadata[tier]=standard" \
  -d "metadata[framework]=cis" | jq -r '.id')

STANDARD_PRICE=$(curl -s https://api.stripe.com/v1/prices \
  -u "$SECRET_KEY": \
  -d "product=$STANDARD_PRODUCT" \
  -d "currency=usd" \
  -d "unit_amount=200000" \
  -d "recurring[interval]=month" \
  -d "nickname=Standard Monthly" | jq -r '.id')

echo "Standard Product: $STANDARD_PRODUCT"
echo "Standard Price: $STANDARD_PRICE"

echo ""
echo "🎟️ Creating Pilot Coupon..."
PILOT_COUPON=$(curl -s https://api.stripe.com/v1/coupons \
  -u "$SECRET_KEY": \
  -d "percent_off=50" \
  -d "duration=repeating" \
  -d "duration_in_months=6" \
  -d "max_redemptions=20" \
  -d "name=SecureBase Pilot Program" | jq -r '.id')

echo "Pilot Coupon: $PILOT_COUPON"

echo ""
echo "🎉 ALL PRODUCTS CREATED!"
echo "========================="
echo ""
echo "📋 COPY THESE FOR YOUR .env.production:"
echo "VITE_HEALTHCARE_PRICE_ID=$HEALTHCARE_PRICE"
echo "VITE_FINTECH_PRICE_ID=$FINTECH_PRICE"
echo "VITE_GOVERNMENT_PRICE_ID=$GOV_PRICE"
echo "VITE_STANDARD_PRICE_ID=$STANDARD_PRICE"
echo "VITE_PILOT_COUPON_ID=$PILOT_COUPON"