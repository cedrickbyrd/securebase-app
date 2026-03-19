#!/bin/bash
set -e

echo "🚀 Deploying SecureBase Demo Environment"
echo "=========================================="

# Step 1: Create demo customer in database
echo ""
echo "Step 1: Creating demo customer..."

psql -h securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com \
  -U adminuser \
  -d securebase \
  << SQL
-- Create demo customer
INSERT INTO customers (
  id, email, first_name, last_name, org_name, tier, status,
  subscription_status, created_at
) VALUES (
  'demo-001',
  'demo@securebase.io',
  'Demo',
  'Account',
  'Demo Company',
  'fintech',
  'active',
  'trialing',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create demo job
INSERT INTO onboarding_jobs (
  id, customer_id, overall_status, created_at
) VALUES (
  'demo-job-001',
  'demo-001',
  'completed',
  NOW()
) ON CONFLICT (id) DO NOTHING;

SELECT 'Demo customer created!' as status;
SQL

echo "✅ Demo customer created"

# Step 2: Configure DNS (manual step)
echo ""
echo "Step 2: Configure DNS"
echo "⚠️  MANUAL STEP REQUIRED:"
echo "   Add CNAME record in your DNS provider:"
echo "   demo.securebase.tximhotep.com → securebase.tximhotep.com"
echo ""
read -p "Press Enter when DNS is configured..."

# Step 3: Deploy portal
echo ""
echo "Step 3: Deploying demo portal..."
cd phase3a-portal

# Create demo build
VITE_DEMO_MODE=true \
VITE_API_URL=https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod \
npm run build

echo "✅ Demo portal built"

# Step 4: Upload to S3 (if using S3)
echo ""
echo "Step 4: Deploy to hosting..."
echo "Choose deployment method:"
echo "1. S3 + CloudFront"
echo "2. Netlify"
echo "3. Manual (I'll do it myself)"
read -p "Choice (1/2/3): " choice

case $choice in
  1)
    aws s3 sync dist/ s3://demo-securebase-portal/ --delete
    echo "✅ Deployed to S3"
    ;;
  2)
    echo "Deploy to Netlify:"
    echo "  cd phase3a-portal"
    echo "  netlify deploy --prod --dir=dist"
    ;;
  3)
    echo "Manual deployment - upload dist/ folder to your hosting"
    ;;
esac

echo ""
echo "=========================================="
echo "✅ Demo Environment Deployed!"
echo "=========================================="
echo ""
echo "🎯 Next steps:"
echo "1. Visit: https://demo.securebase.tximhotep.com"
echo "2. Login with: demo@securebase.io"
echo "3. Test the full experience"
echo "4. Use it on your next demo call!"
echo ""
echo "📋 Demo customer details:"
echo "   Email: demo@securebase.io"
echo "   Customer ID: demo-001"
echo "   Job ID: demo-job-001"
echo "   Status: Active (trialing)"
