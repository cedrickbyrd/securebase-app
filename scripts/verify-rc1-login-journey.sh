#!/usr/bin/env bash
# verify-rc1-login-journey.sh
#
# Captures the full login journey for an RC1 pilot customer.
#
# PRIMARY CHECK: DynamoDB user record (authoritative, instant)
#   - password_hash present → account activated
#   - status = active → invite accepted
#   - first_login_at set → has logged in at least once
#   - locked_until → brute-force lockout active
#   - failed_login_attempts → recent bad password attempts
#
# SECONDARY CHECK: CloudWatch Logs — auth Lambda (error paths only)
#   The production auth Lambda (securebase-production-auth-v2) does not emit
#   structured logs on the success path. Log queries surface error-path signals:
#   invalid credentials, lockout, SES failures, token expiry.
#   Absence of log hits does NOT mean the customer never logged in.
#
# OUTPUT: one of four classifications printed on the last line:
#   VERIFIED_LOGIN      — first_login_at is set in DynamoDB
#   ACTIVATED_NO_LOGIN  — account active, password_hash present, no first_login_at
#   INVITE_PENDING      — status=invited, no password_hash
#   RECORD_MISSING      — no DynamoDB record found for this email
#   ERROR_INDETERMINATE — DynamoDB check failed; cannot classify
#
# Usage:
#   ./scripts/verify-rc1-login-journey.sh
#   CUSTOMER_EMAIL=other@example.com ./scripts/verify-rc1-login-journey.sh
#   SKIP_LOGS=1 ./scripts/verify-rc1-login-journey.sh   # DynamoDB only, faster
#
# Required: aws CLI configured with read access to:
#   dynamodb:GetItem on securebase-users
#   logs:StartQuery + logs:GetQueryResults on /aws/lambda/securebase-production-auth-v2
#   (logs access is optional — set SKIP_LOGS=1 to bypass)

set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────────

AWS_REGION="${AWS_REGION:-us-east-1}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-matthew.matturro@trinetx.com}"
USERS_TABLE="${USERS_TABLE:-securebase-users}"
AUTH_LOG_GROUP="${AUTH_LOG_GROUP:-/aws/lambda/securebase-production-auth-v2}"

# Window for CloudWatch log queries.
# START defaults to RC1 invite date; END defaults to right now.
LOG_START="${LOG_START:-2026-05-16T00:00:00Z}"
LOG_END="${LOG_END:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

# Set SKIP_LOGS=1 to skip CloudWatch queries (DynamoDB check only).
SKIP_LOGS="${SKIP_LOGS:-0}"

# ── prerequisites ─────────────────────────────────────────────────────────────

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required tool not found: $1" >&2; exit 1; }; }
need aws
need jq
need python3

# ── helpers ───────────────────────────────────────────────────────────────────

to_epoch() {
  python3 - "$1" <<'PY'
from datetime import datetime, timezone
import sys
dt = datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
print(int(dt.timestamp()))
PY
}

# Print a section header.
header() { echo; echo "── $1 "; }

# Emit a pass/fail indicator line.
check() {
  local label="$1" value="$2" status="$3"  # status: ok | warn | fail | info
  local icon
  case "$status" in
    ok)   icon="✅" ;;
    warn) icon="⚠️ " ;;
    fail) icon="❌" ;;
    info) icon="ℹ️ " ;;
    *)    icon="   " ;;
  esac
  printf "  %s  %-32s %s\n" "$icon" "$label" "$value"
}

# ── banner ────────────────────────────────────────────────────────────────────

echo
echo "============================================================"
echo "  RC1 Login Journey Verification"
echo "  Email  : $CUSTOMER_EMAIL"
echo "  Table  : $USERS_TABLE"
echo "  Region : $AWS_REGION"
echo "  Run at : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================"

# ── STEP 1: DynamoDB user record (authoritative) ─────────────────────────────

header "STEP 1: DynamoDB user record"

DYNAMO_RESULT=""
DYNAMO_ERROR=""

if DYNAMO_RESULT=$(aws dynamodb get-item \
  --region "$AWS_REGION" \
  --table-name "$USERS_TABLE" \
  --key "{\"email\": {\"S\": \"$CUSTOMER_EMAIL\"}}" \
  --output json 2>&1); then
  : # success
else
  DYNAMO_ERROR="$DYNAMO_RESULT"
  DYNAMO_RESULT=""
fi

if [[ -n "$DYNAMO_ERROR" ]]; then
  check "DynamoDB query" "FAILED" "fail"
  echo "  Error: $DYNAMO_ERROR"
  echo
  echo "CLASSIFICATION: ERROR_INDETERMINATE"
  exit 1
fi

# Check if a record exists at all.
ITEM=$(echo "$DYNAMO_RESULT" | jq -r '.Item // empty')

if [[ -z "$ITEM" ]]; then
  check "Record exists" "NO — email not found in $USERS_TABLE" "fail"
  echo
  echo "  Possible causes:"
  echo "    - Email key mismatch (mixed-case stored key vs lowercase lookup)"
  echo "    - Invite was never sent / DynamoDB write failed"
  echo "    - Wrong USERS_TABLE value"
  echo
  echo "  To check for mixed-case variants:"
  echo "    aws dynamodb scan --table-name $USERS_TABLE \\"
  echo "      --filter-expression 'contains(email, :e)' \\"
  echo "      --expression-attribute-values '{\":e\":{\"S\":\"matturro\"}}' \\"
  echo "      --region $AWS_REGION | jq '.Items[].email'"
  echo
  echo "CLASSIFICATION: RECORD_MISSING"
  exit 0
fi

check "Record exists" "yes" "ok"

# Extract fields.
EMAIL_STORED=$(echo "$ITEM" | jq -r '.email.S // "(missing)"')
STATUS=$(echo "$ITEM" | jq -r '.status.S // "(not set)"')
ROLE=$(echo "$ITEM" | jq -r '.role.S // "(not set)"')
CREATED_AT=$(echo "$ITEM" | jq -r '.created_at.S // "(not set)"')
FIRST_LOGIN_AT=$(echo "$ITEM" | jq -r '.first_login_at.S // ""')
HAS_PASSWORD=$(echo "$ITEM" | jq -r 'if .password_hash.S and (.password_hash.S | length) > 0 then "yes" else "no" end')
MFA_ENABLED=$(echo "$ITEM" | jq -r '.mfa_enabled.BOOL // false')
FAILED_ATTEMPTS=$(echo "$ITEM" | jq -r '.failed_login_attempts.N // "0"')
LOCKED_UNTIL=$(echo "$ITEM" | jq -r '.locked_until.N // "0"')

# Email key check — warn if stored key differs from what we queried.
if [[ "$EMAIL_STORED" != "$CUSTOMER_EMAIL" ]]; then
  check "Email key" "$EMAIL_STORED (MISMATCH — queried $CUSTOMER_EMAIL)" "warn"
else
  check "Email key" "$EMAIL_STORED (lowercase ✓)" "ok"
fi

# Status.
case "$STATUS" in
  active)  check "Account status" "$STATUS" "ok" ;;
  invited) check "Account status" "$STATUS — invite not yet accepted" "warn" ;;
  *)       check "Account status" "$STATUS" "info" ;;
esac

# password_hash.
if [[ "$HAS_PASSWORD" == "yes" ]]; then
  check "Password set" "yes" "ok"
else
  check "Password set" "no — acceptInvite has not run" "fail"
fi

# first_login_at — the definitive login signal.
if [[ -n "$FIRST_LOGIN_AT" ]]; then
  check "First login at" "$FIRST_LOGIN_AT" "ok"
else
  check "First login at" "(not set — never logged in)" "warn"
fi

# Role, MFA, created_at.
check "Role" "$ROLE" "info"
check "MFA enabled" "$MFA_ENABLED" "info"
check "Created at" "$CREATED_AT" "info"

# Lockout check.
NOW_EPOCH=$(python3 -c "import time; print(int(time.time()))")
if [[ "$LOCKED_UNTIL" != "0" ]] && [[ "$LOCKED_UNTIL" -gt "$NOW_EPOCH" ]]; then
  UNLOCK_IN=$(( LOCKED_UNTIL - NOW_EPOCH ))
  check "Lockout" "ACTIVE — locked for ${UNLOCK_IN}s more (failed_attempts=$FAILED_ATTEMPTS)" "fail"
elif [[ "$FAILED_ATTEMPTS" -gt 0 ]]; then
  check "Failed attempts" "$FAILED_ATTEMPTS recent failures (not yet locked)" "warn"
else
  check "Lockout" "none" "ok"
fi

# ── STEP 2: Token record — has a valid invite token ──────────────────────────
# We don't scan the tokens table (expensive) but we flag if status=invited
# so the operator knows to resend.

if [[ "$STATUS" == "invited" && "$HAS_PASSWORD" == "no" ]]; then
  echo
  echo "  ACTION REQUIRED: account is in 'invited' state with no password."
  echo "  The invite email may not have been received, or the link expired."
  echo "  To resend: call POST /auth/invite/resend with the original token,"
  echo "  or re-invite via POST /auth/invite with the customer's email."
fi

# ── STEP 3: CloudWatch Logs — error-path signals ─────────────────────────────

if [[ "$SKIP_LOGS" == "1" ]]; then
  echo
  echo "  (CloudWatch log query skipped — SKIP_LOGS=1)"
else
  header "STEP 2: CloudWatch auth log query"
  echo "  Log group : $AUTH_LOG_GROUP"
  echo "  Window    : $LOG_START → $LOG_END"
  echo

  # Check the log group exists before querying — avoids a misleading
  # 'No matching events' result when the group simply doesn't exist.
  LOG_GROUP_EXISTS=""
  if aws logs describe-log-groups \
    --region "$AWS_REGION" \
    --log-group-name-prefix "$AUTH_LOG_GROUP" \
    --output json 2>/dev/null | jq -e '.logGroups | length > 0' >/dev/null 2>&1; then
    LOG_GROUP_EXISTS="yes"
  fi

  if [[ -z "$LOG_GROUP_EXISTS" ]]; then
    echo "  ⚠️  Log group not found: $AUTH_LOG_GROUP"
    echo "      Skipping CloudWatch query."
  else
    START_EPOCH=$(to_epoch "$LOG_START")
    END_EPOCH=$(to_epoch "$LOG_END")

    # NOTE: The production auth Lambda does not log on the success path.
    # This query surfaces error-path signals only:
    #   - "Invalid credentials" → failed password attempt
    #   - "Too many failed login attempts" → lockout triggered
    #   - "Invalid or expired invite link" → token consumed/expired before password set
    #   - "Auth service misconfigured" → JWT_SECRET missing at cold start
    #   - "SES send failed" → email delivery failure
    #   - "Auth Lambda error" → unhandled exception
    # Absence of results means either: no errors occurred, or the customer
    # has not attempted login at all. Check first_login_at in DynamoDB above.
    AUTH_QUERY=$(cat <<EOF
fields @timestamp, @message
| filter @message like /$(echo "$CUSTOMER_EMAIL" | sed 's/@/\\@/g')/
   or @message like /Invalid credentials/
   or @message like /Too many failed login/
   or @message like /Invalid or expired invite/
   or @message like /Auth service misconfigured/
   or @message like /SES send failed/
   or @message like /Auth Lambda error/
   or @message like /FATAL: JWT_SECRET/
| sort @timestamp desc
| limit 50
EOF
)

    # Start the Insights query.
    QUERY_ID=""
    if QUERY_ID=$(aws logs start-query \
      --region "$AWS_REGION" \
      --log-group-name "$AUTH_LOG_GROUP" \
      --start-time "$START_EPOCH" \
      --end-time "$END_EPOCH" \
      --query-string "$AUTH_QUERY" \
      --output json 2>/dev/null | jq -r '.queryId'); then
      : # started
    else
      echo "  ⚠️  Could not start CloudWatch Insights query. Check IAM permissions."
      QUERY_ID=""
    fi

    if [[ -n "$QUERY_ID" && "$QUERY_ID" != "null" ]]; then
      echo "  Query ID: $QUERY_ID"
      echo "  Waiting for results..."

      LOG_RESULTS=""
      for _ in $(seq 1 20); do
        sleep 2
        QUERY_OUT=$(aws logs get-query-results \
          --region "$AWS_REGION" \
          --query-id "$QUERY_ID" \
          --output json 2>/dev/null || echo '{"status":"Failed","results":[]}')
        QUERY_STATUS=$(echo "$QUERY_OUT" | jq -r '.status')

        if [[ "$QUERY_STATUS" == "Complete" ]]; then
          LOG_RESULTS="$QUERY_OUT"
          break
        fi
        if [[ "$QUERY_STATUS" == "Failed" || "$QUERY_STATUS" == "Cancelled" || "$QUERY_STATUS" == "Timeout" ]]; then
          echo "  ⚠️  Query ended with status: $QUERY_STATUS"
          break
        fi
      done

      if [[ -n "$LOG_RESULTS" ]]; then
        ROW_COUNT=$(echo "$LOG_RESULTS" | jq '.results | length')
        if [[ "$ROW_COUNT" -eq 0 ]]; then
          echo "  ✅  No error-path log events found for this customer in the window."
          echo "      This is expected if the customer has not attempted login,"
          echo "      or if all login attempts succeeded (success path is not logged)."
        else
          echo "  Found $ROW_COUNT error-path event(s):"
          echo
          echo "$LOG_RESULTS" | jq -r '
            .results[] |
            map({key:.field, value:.value}) | from_entries |
            "  [\(.[ "@timestamp"])]  \(.[ "@message"] | split("\n")[0] | .[0:120])"
          '
        fi
      else
        echo "  ⚠️  Query did not complete within timeout. Check manually:"
        echo "      https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:logs-insights"
      fi
    fi
  fi
fi

# ── CLASSIFICATION ────────────────────────────────────────────────────────────

header "CLASSIFICATION"

if [[ -n "$FIRST_LOGIN_AT" ]]; then
  echo "  CLASSIFICATION: VERIFIED_LOGIN"
  echo "  First login recorded at: $FIRST_LOGIN_AT"
  echo
  echo "  ✅ Customer has successfully logged in. Account is fully activated."
elif [[ "$HAS_PASSWORD" == "yes" && "$STATUS" == "active" ]]; then
  echo "  CLASSIFICATION: ACTIVATED_NO_LOGIN"
  echo
  echo "  ⚠️  Account is active and password is set, but no login has been recorded."
  echo "  The customer may have set their password but not yet signed in."
  echo "  Recommended action: reach out and confirm they can access the portal."
  echo "  Portal URL: https://portal.securebase.tximhotep.com"
elif [[ "$HAS_PASSWORD" == "no" ]]; then
  echo "  CLASSIFICATION: INVITE_PENDING"
  echo
  echo "  ❌ Customer has not completed invite activation (no password_hash)."
  echo "  Recommended actions:"
  echo "    1. Verify the invite email was delivered (check SES logs or customer inbox)"
  echo "    2. Re-send invite: POST /auth/invite with body {\"email\":\"$CUSTOMER_EMAIL\"}"
  echo "    3. Confirm the customer received and clicked the activation link"
else
  echo "  CLASSIFICATION: INVITE_PENDING"
  echo "  (status=$STATUS, password=$HAS_PASSWORD)"
fi

echo
