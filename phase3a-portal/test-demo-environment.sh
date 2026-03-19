#!/bin/bash

echo "🧪 Testing Demo Environment"
echo "============================"

# Test 1: DNS resolves
echo ""
echo "Test 1: DNS Resolution..."
if nslookup demo.securebase.tximhotep.com > /dev/null 2>&1; then
  echo "✅ DNS resolves"
else
  echo "⚠️  DNS not yet propagated (may take a few minutes)"
fi

# Test 2: Site loads
echo ""
echo "Test 2: Site loads..."
if curl -s -o /dev/null -w "%{http_code}" https://demo.securebase.tximhotep.com | grep -q "200"; then
  echo "✅ Site is live"
else
  echo "⚠️  Site not yet accessible"
fi

# Test 3: Demo customer exists
echo ""
echo "Test 3: Demo customer in database..."
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds/admin-password \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

RESULT=$(PGPASSWORD=$DB_PASSWORD psql \
  -h securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com \
  -U adminuser \
  -d securebase \
  -t \
  -c "SELECT email FROM customers WHERE id='demo-user-001';")

if echo "$RESULT" | grep -q "demo@securebase.tximhotep.com"; then
  echo "✅ Demo customer exists"
else
  echo "❌ Demo customer not found"
fi

echo ""
echo "============================"
echo "🎯 Manual Test:"
echo "   Visit: https://demo.securebase.tximhotep.com"
echo "   Login: demo@securebase.tximhotep.com"
echo "============================"
