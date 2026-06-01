#!/bin/bash
# Deploy auth Lambda code + config to production
# Usage: ./update-auth-lambdas.sh
#
# This script:
#   1. Builds a fresh zip from lambdas/auth/
#   2. Deploys code to the correct production Lambda (securebase-production-auth-v2)
#   3. Updates environment variables
#   4. Waits for deployment to complete before exiting

set -e

FUNCTION_NAME="securebase-production-auth-v2"
REGION="us-east-1"
ZIP_PATH="auth-lambda.zip"

echo "🔧 Deploying Auth Lambda: ${FUNCTION_NAME}"
echo "======================================================"
echo ""

# ── 1. Build zip ─────────────────────────────────────────
echo "📦 Building deployment package..."
(cd lambdas/auth && npm install --omit=dev 2>/dev/null)
rm -f "${ZIP_PATH}"
zip -r "${ZIP_PATH}" lambdas/auth -x "*.test.*" -x "*/__tests__/*" -x "*/test/*" > /dev/null
echo "   Built ${ZIP_PATH} ($(du -sh "${ZIP_PATH}" | cut -f1))"

# ── 2. Deploy code ────────────────────────────────────────
echo ""
echo "🚀 Uploading code to ${FUNCTION_NAME}..."
aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "${REGION}" \
    --no-cli-pager \
    --query '{CodeSize: CodeSize, LastUpdateStatus: LastUpdateStatus}'

echo "   Waiting for code deployment to complete..."
aws lambda wait function-updated \
    --function-name "${FUNCTION_NAME}" \
    --region "${REGION}"
echo "   ✅ Code deployed"

# ── 3. Update environment variables ──────────────────────
echo ""
echo "⚙️  Updating environment variables..."
aws lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --environment "Variables={
        JWT_SECRET=securebase-jwt-secret-1aa6f154bbb064ff4fb6e910b0645a38,
        USERS_TABLE=securebase-users,
        CORS_ORIGIN=https://portal.securebase.tximhotep.com,
        COOKIE_DOMAIN=.tximhotep.com,
        SESSION_DURATION=86400,
        ENABLE_COOKIES=true
    }" \
    --region "${REGION}" \
    --no-cli-pager \
    --query '{LastUpdateStatus: LastUpdateStatus}'

echo "   Waiting for config update to complete..."
aws lambda wait function-updated \
    --function-name "${FUNCTION_NAME}" \
    --region "${REGION}"
echo "   ✅ Config updated"

# ── 4. Update validate-session (env vars only) ────────────
echo ""
echo "⚙️  Updating securebase-validate-session..."
aws lambda update-function-configuration \
    --function-name securebase-validate-session \
    --environment "Variables={COOKIE_DOMAIN=.tximhotep.com,SESSION_DURATION=86400,ENABLE_COOKIES=true}" \
    --region "${REGION}" \
    --no-cli-pager \
    --query '{LastUpdateStatus: LastUpdateStatus}'

# ── 5. Summary ────────────────────────────────────────────
echo ""
echo "======================================================"
echo "✅ Auth Lambda deployment complete!"
echo ""
echo "   Function : ${FUNCTION_NAME}"
echo "   CORS     : https://portal.securebase.tximhotep.com"
echo "   Table    : securebase-users"
echo ""
echo "Run ./check-portal-health.sh to verify."
