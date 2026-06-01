#!/usr/bin/env bash
# ============================================
#  SecureBase Portal Health Check
#  Mirrors demo health check format
#  Target: https://portal.securebase.tximhotep.com
# ============================================

PORTAL="${PORTAL_URL:-https://portal.securebase.tximhotep.com}"
API="${API_URL:-https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod}"

PASS=0; FAIL=0; WARN=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

check_get() {
  local label="$1" url="$2" expected="${3:-200}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "[${GREEN}PASS${NC}] $label → $url ($code)"
    ((PASS++))
  else
    echo -e "[${RED}FAIL${NC}] $label → $url (got $code, expected $expected)"
    ((FAIL++))
  fi
}

check_post() {
  local label="$1" url="$2" expected="$3" body="${4:-}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST -H "Content-Type: application/json" -d "$body" "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "[${GREEN}PASS${NC}] $label → $url ($code)"
    ((PASS++))
  else
    echo -e "[${RED}FAIL${NC}] $label → $url (got $code, expected $expected)"
    ((FAIL++))
  fi
}

check_options() {
  local label="$1" url="$2"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X OPTIONS "$url")
  cors=$(curl -s -I --max-time 10 -X OPTIONS "$url" | grep -i "access-control-allow-origin" | wc -l)
  if [ "$code" = "200" ] && [ "$cors" -gt 0 ]; then
    echo -e "[${GREEN}PASS${NC}] $label → CORS preflight $url ($code + CORS header present)"
    ((PASS++))
  elif [ "$code" = "200" ]; then
    echo -e "[${YELLOW}WARN${NC}] $label → $url ($code but missing CORS header)"
    ((WARN++))
  else
    echo -e "[${RED}FAIL${NC}] $label → $url (got $code)"
    ((FAIL++))
  fi
}

echo "============================================"
echo " SecureBase Portal Health Check"
echo " $(date)"
echo " Portal: $PORTAL"
echo " API:    $API"
echo "============================================"
echo ""

# --- SPA / Public Routes ---
echo "--- SPA Public Routes ---"
check_get "Root"                    "$PORTAL/"
check_get "Login Page"              "$PORTAL/login"
check_get "Accept Invite"           "$PORTAL/accept-invite"
check_get "Forgot Password"         "$PORTAL/forgot-password"
check_get "Reset Password"          "$PORTAL/reset-password"
check_get "Pricing"                 "$PORTAL/pricing"
check_get "Checkout"                "$PORTAL/checkout"
check_get "Contact Sales"           "$PORTAL/contact-sales"
check_get "Thank You"               "$PORTAL/thank-you"
check_get "Pilot: Compliance"       "$PORTAL/pilots/compliance-jumpstart"
check_get "Pilot: HIPAA"            "$PORTAL/pilots/hipaa-readiness"
check_get "Setup"                   "$PORTAL/setup"
check_get "Onboarding"              "$PORTAL/onboarding"
echo ""

# --- SPA Protected Routes (SPA fallback — should still 200) ---
echo "--- SPA Protected Routes (client-side auth redirect) ---"
check_get "Dashboard"               "$PORTAL/dashboard"
check_get "Demo Dashboard"          "$PORTAL/demo-dashboard"
check_get "Compliance"              "$PORTAL/compliance"
check_get "HIPAA Dashboard"         "$PORTAL/hipaa-dashboard"
check_get "SRE Dashboard"           "$PORTAL/sre-dashboard"
check_get "Alerts"                  "$PORTAL/alerts"
check_get "Admin"                   "$PORTAL/admin"
check_get "Fintech Portal"          "$PORTAL/fintech-portal"
check_get "SPA 404 Fallback"        "$PORTAL/this-route-does-not-exist-xyz"
echo ""

# --- Auth API — CORS Preflight ---
echo "--- Auth API CORS Preflight (OPTIONS) ---"
check_options "OPTIONS /auth/login"           "$API/auth/login"
check_options "OPTIONS /auth/register"        "$API/auth/register"
check_options "OPTIONS /auth/invite"          "$API/auth/invite"
check_options "OPTIONS /auth/accept-invite"   "$API/auth/accept-invite"
check_options "OPTIONS /auth/forgot-password" "$API/auth/forgot-password"
check_options "OPTIONS /auth/reset-password"  "$API/auth/reset-password"
check_options "OPTIONS /auth/mfa/setup"       "$API/auth/mfa/setup"
check_options "OPTIONS /auth/mfa/verify"      "$API/auth/mfa/verify"
echo ""

# --- Auth API — Error Contracts (empty body → should be 400, not 404/500) ---
echo "--- Auth API Error Contracts (empty body → 400) ---"
check_post "POST /auth/login (empty)"           "$API/auth/login"           "400"
check_post "POST /auth/register (empty)"        "$API/auth/register"        "400"
check_post "POST /auth/invite (empty)"          "$API/auth/invite"          "400"
check_post "POST /auth/accept-invite (empty)"   "$API/auth/accept-invite"   "400"
check_post "POST /auth/forgot-password (empty)" "$API/auth/forgot-password" "400"
check_post "POST /auth/reset-password (empty)"  "$API/auth/reset-password"  "400"
check_post "POST /auth/mfa/setup (empty)"       "$API/auth/mfa/setup"       "400"
check_post "POST /auth/mfa/verify (empty)"      "$API/auth/mfa/verify"      "400"
echo ""

# --- Auth API — Specific Contracts ---
echo "--- Auth API Specific Contracts ---"
check_post "POST /auth/login (wrong creds → 401)"           "$API/auth/login"           "401" '{"email":"nobody@example.com","password":"wrongpass"}'
check_post "POST /auth/forgot-password (unknown → 200)"     "$API/auth/forgot-password" "200" '{"email":"ghost@nowhere.com"}'
check_post "POST /auth/accept-invite (invalid token → 400)" "$API/auth/accept-invite"   "400" '{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","password":"ValidPass123!"}'
check_post "POST /auth/reset-password (invalid token → 400)" "$API/auth/reset-password" "400" '{"token":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","password":"NewPassword123!"}'
echo ""

# --- Netlify Proxy → Lambda (via /api) ---
echo "--- Netlify Proxy → Lambda (/api/auth/*) ---"
check_post "Proxy /api/auth/login"           "$PORTAL/api/auth/login"           "400"
check_post "Proxy /api/auth/register"        "$PORTAL/api/auth/register"        "400"
check_post "Proxy /api/auth/invite"          "$PORTAL/api/auth/invite"          "400"
check_post "Proxy /api/auth/accept-invite"   "$PORTAL/api/auth/accept-invite"   "400"
check_post "Proxy /api/auth/forgot-password" "$PORTAL/api/auth/forgot-password" "400"
check_post "Proxy /api/auth/reset-password"  "$PORTAL/api/auth/reset-password"  "400"
check_post "Proxy /api/auth/mfa/setup"       "$PORTAL/api/auth/mfa/setup"       "400"
check_post "Proxy /api/auth/mfa/verify"      "$PORTAL/api/auth/mfa/verify"      "400"
echo ""

# --- Customer #1 User Record ---
echo "--- Customer #1 User Record Health ---"
check_post "Matthew login probe (401 = user exists)" \
  "$API/auth/login" "401" \
  '{"email":"Matthew.matturro@trinetx.com","password":"probe_password_should_fail"}'
check_post "Matthew forgot-password (200 = user exists)" \
  "$API/auth/forgot-password" "200" \
  '{"email":"Matthew.matturro@trinetx.com"}'
echo ""

echo "============================================"
echo -e " Results: ${GREEN}$PASS PASS${NC} | ${RED}$FAIL FAIL${NC} | ${YELLOW}$WARN WARN${NC}"
echo "============================================"
