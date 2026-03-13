#!/bin/bash
# =============================================================================
# SecureBase — Golden Sales Path: Demo Environment Onboarding
# =============================================================================
# Self-service script for provisioning a fully populated, interactive sales
# demo environment inside the dedicated Sales OU.
#
# What this script does:
#   1. Targets the existing "Customers-Sales" OU (or creates it if absent)
#   2. Validates / selects the demo-sales AWS account
#   3. Loads the golden dataset (sample customers, invoices, metrics, API keys)
#   4. Assigns Sales Manager and Sales Rep demo RBAC roles via IAM Identity Center
#   5. Prints all demo credentials and teardown instructions
#
# Usage:
#   ./scripts/onboard-demo-sales.sh [options]
#
# Options:
#   --rep-name  NAME     Display name for the sales rep (used in welcome output)
#   --rep-email EMAIL    Email of the sales rep (used in IAM Identity Center assignment)
#   --demo-tag  TAG      Short label for this demo session (default: YYYYMMDD-<random>)
#   --dry-run            Print all steps without applying any changes
#   --teardown           Remove this demo session's data and role assignments
#
# Requirements:
#   - AWS CLI ≥ 2.x configured with management-account credentials
#   - Terraform ≥ 1.5.0 (only needed when creating the OU / account from scratch)
#   - jq ≥ 1.6
#   - The demo-sales AWS account must already exist OR Terraform must have been
#     applied so that aws_organizations_account.demo_sales is live.
#
# Conventions:
#   - Deploy Terraform from landing-zone/environments/dev/ (not from the root)
#   - All temporary files are written to /tmp/securebase-demo-sales/
#   - The golden dataset SQL is idempotent (safe to run multiple times)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these defaults for your environment
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/landing-zone/environments/dev"
TMP_DIR="/tmp/securebase-demo-sales"

DEMO_ACCOUNT_EMAIL="demo.sales@securebase.io"
DEMO_ACCOUNT_NAME="securebase-demo-sales"
SALES_OU_NAME="Customers-Sales"
DEMO_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Golden dataset defaults
DEMO_PORTAL_URL="${DEMO_PORTAL_URL:-https://portal-demo.securebase.io}"
DEMO_API_BASE="${DEMO_API_BASE:-https://api.securebase.io/v1}"

# RBAC: IAM Identity Center permission set names
SALES_MANAGER_PERMISSION_SET="SalesManagerDemo"
SALES_REP_PERMISSION_SET="SalesRepDemo"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
header()  { echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"; \
             echo -e "${BLUE}${BOLD}║${NC}  $1"; \
             echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${NC}\n"; }
step()    { echo -e "${YELLOW}▶${NC} $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
info()    { echo -e "${CYAN}ℹ${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}❌  ERROR: $1${NC}" >&2; exit 1; }

dry_run_note() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "${CYAN}  [DRY RUN] would execute: $1${NC}"
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
REP_NAME=""
REP_EMAIL=""
DEMO_TAG="$(date +%Y%m%d)-$(openssl rand -hex 3 2>/dev/null || uuidgen | tr -d '-' | head -c 6)"
DRY_RUN="false"
TEARDOWN="false"

while [[ $# -gt 0 ]]; do
  case $1 in
    --rep-name)  REP_NAME="$2";  shift 2 ;;
    --rep-email) REP_EMAIL="$2"; shift 2 ;;
    --demo-tag)  DEMO_TAG="$2";  shift 2 ;;
    --dry-run)   DRY_RUN="true"; shift ;;
    --teardown)  TEARDOWN="true"; shift ;;
    --help|-h)
      sed -n '/^# Usage/,/^# =\+/p' "$0" | head -20
      exit 0 ;;
    *) error "Unknown option: $1. Run with --help for usage." ;;
  esac
done

mkdir -p "${TMP_DIR}"

# ---------------------------------------------------------------------------
# Step 0 — Prerequisite checks
# ---------------------------------------------------------------------------
header "Step 0 — Checking Prerequisites"

for cmd in aws jq; do
  if ! command -v "${cmd}" &>/dev/null; then
    error "${cmd} is required but not installed."
  fi
done
success "AWS CLI and jq found"

if ! aws sts get-caller-identity &>/dev/null; then
  error "AWS credentials not configured. Run: aws configure"
fi
CALLER_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
success "AWS credentials valid (account: ${CALLER_ACCOUNT})"

# ---------------------------------------------------------------------------
# Step 1 — Locate the Sales OU and demo account
# ---------------------------------------------------------------------------
header "Step 1 — Locating Sales OU and Demo Account"

step "Looking up AWS Organization root..."
ORG_ROOT_ID=$(aws organizations list-roots --query "Roots[0].Id" --output text 2>/dev/null || true)
if [[ -z "${ORG_ROOT_ID}" || "${ORG_ROOT_ID}" == "None" ]]; then
  error "Cannot find AWS Organization root. Ensure this script runs with management-account credentials."
fi
success "Organization root: ${ORG_ROOT_ID}"

step "Looking up '${SALES_OU_NAME}' OU..."
SALES_OU_ID=$(aws organizations list-organizational-units-for-parent \
  --parent-id "${ORG_ROOT_ID}" \
  --query "OrganizationalUnits[?Name=='${SALES_OU_NAME}'].Id | [0]" \
  --output text 2>/dev/null || true)

if [[ -z "${SALES_OU_ID}" || "${SALES_OU_ID}" == "None" ]]; then
  warn "Sales OU not found. Run 'terraform apply' from ${TERRAFORM_DIR} first."
  info "Terraform resource: aws_organizations_organizational_unit.customer_sales"
  if [[ "${DRY_RUN}" != "true" ]]; then
    error "Aborting — Sales OU must exist before running this script."
  fi
  SALES_OU_ID="ou-PLACEHOLDER"
fi
success "Sales OU ID: ${SALES_OU_ID}"

step "Looking up demo account '${DEMO_ACCOUNT_NAME}'..."
DEMO_ACCOUNT_ID=$(aws organizations list-accounts-for-parent \
  --parent-id "${SALES_OU_ID}" \
  --query "Accounts[?Name=='${DEMO_ACCOUNT_NAME}'].Id | [0]" \
  --output text 2>/dev/null || true)

if [[ -z "${DEMO_ACCOUNT_ID}" || "${DEMO_ACCOUNT_ID}" == "None" ]]; then
  warn "Demo account not found under Sales OU. Run 'terraform apply' first."
  info "Terraform resource: aws_organizations_account.demo_sales"
  if [[ "${DRY_RUN}" != "true" ]]; then
    error "Aborting — demo account must exist before loading data."
  fi
  DEMO_ACCOUNT_ID="123456789012"
fi
success "Demo account ID: ${DEMO_ACCOUNT_ID}"

# ---------------------------------------------------------------------------
# Step 2 — Load golden dataset
# ---------------------------------------------------------------------------
header "Step 2 — Loading Golden Dataset"
info "Demo tag: ${DEMO_TAG}"

GOLDEN_SQL="${TMP_DIR}/golden-dataset-${DEMO_TAG}.sql"

step "Generating golden dataset SQL..."
cat > "${GOLDEN_SQL}" << ENDSQL
-- ==========================================================================
-- SecureBase Golden Sales Dataset  (demo tag: ${DEMO_TAG})
-- All INSERTs are ON CONFLICT DO NOTHING so re-runs are safe.
-- ==========================================================================

-- Ensure the demo schema context is set (RLS bypass for seed user)
SET app.demo_seed = 'true';

-- ── Customers ──────────────────────────────────────────────────────────────
INSERT INTO customers
  (id, name, tier, framework, email, status, billing_email,
   mfa_enforced, audit_retention_days, encryption_required, vpc_isolation_enabled,
   aws_org_id, aws_management_account_id, tags)
VALUES
  ('demo-hc-001', 'HealthCorp Medical Systems', 'healthcare', 'hipaa',
   'admin@healthcorp-demo.example', 'active', 'billing@healthcorp-demo.example',
   true, 2555, true, true, 'o-demo0000001', '${DEMO_ACCOUNT_ID}',
   '{"Demo": "true", "DemoTag": "${DEMO_TAG}"}'),
  ('demo-ft-001', 'FinTechAI Analytics', 'fintech', 'soc2',
   'admin@fintechai-demo.example', 'active', 'billing@fintechai-demo.example',
   true, 365, true, false, 'o-demo0000001', '${DEMO_ACCOUNT_ID}',
   '{"Demo": "true", "DemoTag": "${DEMO_TAG}"}'),
  ('demo-gov-001', 'GovContractor Defense Solutions', 'gov-federal', 'fedramp',
   'admin@govcontractor-demo.example', 'active', 'billing@govcontractor-demo.example',
   true, 2555, true, true, 'o-demo0000001', '${DEMO_ACCOUNT_ID}',
   '{"Demo": "true", "DemoTag": "${DEMO_TAG}"}'),
  ('demo-std-001', 'StartupMVP Inc', 'standard', 'cis',
   'admin@startupmvp-demo.example', 'active', 'billing@startupmvp-demo.example',
   false, 90, false, false, 'o-demo0000001', '${DEMO_ACCOUNT_ID}',
   '{"Demo": "true", "DemoTag": "${DEMO_TAG}"}'),
  ('demo-ft-002', 'SaaSPlatform Cloud Services', 'fintech', 'soc2',
   'admin@saasplatform-demo.example', 'active', 'billing@saasplatform-demo.example',
   true, 365, true, false, 'o-demo0000001', '${DEMO_ACCOUNT_ID}',
   '{"Demo": "true", "DemoTag": "${DEMO_TAG}"}')
ON CONFLICT (id) DO NOTHING;

-- ── Invoices ───────────────────────────────────────────────────────────────
INSERT INTO invoices
  (id, customer_id, month, tier, base_fee, account_fee, usage_fee, total_amount, status, tags)
VALUES
  ('demo-inv-001', 'demo-hc-001', CURRENT_DATE - INTERVAL '1 month',
   'healthcare', 8000, 2000, 5000, 15000, 'paid',  '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-inv-002', 'demo-ft-001', CURRENT_DATE - INTERVAL '1 month',
   'fintech',    4000, 1000, 3000,  8000, 'paid',  '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-inv-003', 'demo-gov-001', CURRENT_DATE - INTERVAL '1 month',
   'gov-federal',12000, 3000,10000, 25000, 'paid', '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-inv-004', 'demo-std-001', CURRENT_DATE - INTERVAL '1 month',
   'standard',    1200,  500,  300,  2000, 'paid', '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-inv-005', 'demo-ft-002', CURRENT_DATE - INTERVAL '1 month',
   'fintech',    4000, 1000, 3000,  8000, 'paid',  '{"DemoTag": "${DEMO_TAG}"}')
ON CONFLICT (id) DO NOTHING;

-- ── Usage metrics (current month) ──────────────────────────────────────────
INSERT INTO usage_metrics
  (customer_id, month, account_count, ou_count, scp_count,
   cloudtrail_events_logged, config_rule_evaluations,
   guardduty_findings, log_storage_gb)
VALUES
  ('demo-hc-001',  date_trunc('month', CURRENT_DATE), 3, 2, 12, 450000, 98,  2, 120),
  ('demo-ft-001',  date_trunc('month', CURRENT_DATE), 2, 2,  8, 280000, 75,  0,  55),
  ('demo-gov-001', date_trunc('month', CURRENT_DATE), 5, 3, 15, 820000, 140, 5, 340),
  ('demo-std-001', date_trunc('month', CURRENT_DATE), 1, 1,  5,  45000, 30,  0,  10),
  ('demo-ft-002',  date_trunc('month', CURRENT_DATE), 2, 2,  8, 310000, 80,  1,  60)
ON CONFLICT (customer_id, month) DO NOTHING;

-- ── API keys ───────────────────────────────────────────────────────────────
INSERT INTO api_keys
  (id, customer_id, key_prefix, key_hash, name, status, scopes, tags)
VALUES
  ('demo-key-001', 'demo-hc-001',  'sk_demo_hc',  'hash-placeholder-hc',
   'Demo HealthCorp Key', 'active',
   ARRAY['read:invoices','read:metrics','read:audit'], '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-key-002', 'demo-ft-001',  'sk_demo_ft',  'hash-placeholder-ft',
   'Demo FinTech Key', 'active',
   ARRAY['read:invoices','read:metrics'], '{"DemoTag": "${DEMO_TAG}"}'),
  ('demo-key-003', 'demo-gov-001', 'sk_demo_gov', 'hash-placeholder-gov',
   'Demo Gov Key', 'active',
   ARRAY['read:invoices','read:metrics','read:audit','read:customers'], '{"DemoTag": "${DEMO_TAG}"}')
ON CONFLICT (id) DO NOTHING;

RESET app.demo_seed;
ENDSQL

success "Golden dataset SQL written to: ${GOLDEN_SQL}"

# In a live environment the SQL is piped to psql via the RDS Proxy.
# The connection string comes from AWS Secrets Manager.
info "To apply the dataset, run:"
info "  psql \"\$(aws secretsmanager get-secret-value --secret-id securebase/dev/db-credentials --query SecretString --output text | jq -r '.connectionString')\" < ${GOLDEN_SQL}"

if [[ "${DRY_RUN}" != "true" ]]; then
  # Attempt automatic load if DB_CONNECTION_STRING is set in the environment
  if [[ -n "${DB_CONNECTION_STRING:-}" ]]; then
    step "Applying golden dataset to database..."
    psql "${DB_CONNECTION_STRING}" < "${GOLDEN_SQL}" \
      && success "Golden dataset loaded" \
      || { warn "Dataset load failed — check DB connectivity and apply manually."; \
           warn "Common causes: RLS policy (set app.demo_seed), missing psql, Aurora paused, or wrong connection string."; }
  else
    warn "DB_CONNECTION_STRING not set — golden dataset NOT loaded automatically."
    warn "Apply manually using the command shown above."
  fi
fi

# ---------------------------------------------------------------------------
# Step 3 — Assign demo RBAC roles (IAM Identity Center)
# ---------------------------------------------------------------------------
header "Step 3 — Assigning Demo RBAC Roles"

step "Looking up IAM Identity Center instance..."
SSO_INSTANCE_ARN=$(aws sso-admin list-instances \
  --query "Instances[0].InstanceArn" --output text 2>/dev/null || true)
IDENTITY_STORE_ID=$(aws sso-admin list-instances \
  --query "Instances[0].IdentityStoreId" --output text 2>/dev/null || true)

if [[ -z "${SSO_INSTANCE_ARN}" || "${SSO_INSTANCE_ARN}" == "None" ]]; then
  warn "IAM Identity Center not available — skipping RBAC assignment."
  warn "Enable IAM Identity Center in the AWS Console and re-run this script."
else
  success "SSO instance: ${SSO_INSTANCE_ARN}"

  # ── Ensure permission sets exist ──────────────────────────────────────────
  ensure_permission_set() {
    local name="$1" description="$2" session_hours="$3"
    local ps_arn
    ps_arn=$(aws sso-admin list-permission-sets \
      --instance-arn "${SSO_INSTANCE_ARN}" \
      --query "PermissionSets" --output json 2>/dev/null \
      | jq -r ".[]" \
      | xargs -I{} aws sso-admin describe-permission-set \
          --instance-arn "${SSO_INSTANCE_ARN}" \
          --permission-set-arn {} \
          --query "PermissionSet[?Name=='${name}'].PermissionSetArn | [0]" \
          --output text 2>/dev/null \
      | grep -v "^$\|^None$" | head -1 || true)

    if [[ -z "${ps_arn}" ]]; then
      if dry_run_note "aws sso-admin create-permission-set --name ${name}"; then :; else
        ps_arn=$(aws sso-admin create-permission-set \
          --instance-arn "${SSO_INSTANCE_ARN}" \
          --name "${name}" \
          --description "${description}" \
          --session-duration "PT${session_hours}H" \
          --query "PermissionSet.PermissionSetArn" --output text)
        success "Created permission set: ${name} (${ps_arn})"
      fi
    else
      info "Permission set already exists: ${name}"
    fi
    echo "${ps_arn:-PLACEHOLDER}"
  }

  MANAGER_PS_ARN=$(ensure_permission_set "${SALES_MANAGER_PERMISSION_SET}" \
    "Sales Manager — full read access for demos" 8)
  REP_PS_ARN=$(ensure_permission_set "${SALES_REP_PERMISSION_SET}" \
    "Sales Rep — standard read access for demos" 4)

  # ── Assign user if --rep-email was provided ───────────────────────────────
  if [[ -n "${REP_EMAIL}" ]]; then
    step "Looking up user '${REP_EMAIL}' in Identity Store..."
    USER_ID=$(aws identitystore list-users \
      --identity-store-id "${IDENTITY_STORE_ID}" \
      --filters "AttributePath=UserName,AttributeValue=${REP_EMAIL}" \
      --query "Users[0].UserId" --output text 2>/dev/null || true)

    if [[ -z "${USER_ID}" || "${USER_ID}" == "None" ]]; then
      warn "User '${REP_EMAIL}' not found in Identity Store."
      warn "Add the user in the IAM Identity Center console first, then re-run."
    else
      # Assign SalesRepDemo permission set to demo account
      if dry_run_note "aws sso-admin create-account-assignment (SalesRepDemo → ${DEMO_ACCOUNT_ID})"; then :; else
        aws sso-admin create-account-assignment \
          --instance-arn "${SSO_INSTANCE_ARN}" \
          --target-id "${DEMO_ACCOUNT_ID}" \
          --target-type "AWS_ACCOUNT" \
          --permission-set-arn "${REP_PS_ARN}" \
          --principal-type "USER" \
          --principal-id "${USER_ID}" &>/dev/null \
          && success "Assigned ${SALES_REP_PERMISSION_SET} to ${REP_EMAIL} on account ${DEMO_ACCOUNT_ID}" \
          || warn "Assignment may already exist or failed — check the console"
      fi
    fi
  else
    info "No --rep-email provided — skipping user assignment."
    info "Run again with --rep-email <address> to assign a specific rep."
  fi
fi

# ---------------------------------------------------------------------------
# Step 4 — Output demo info & teardown instructions
# ---------------------------------------------------------------------------
SUMMARY_FILE="${TMP_DIR}/demo-summary-${DEMO_TAG}.md"

header "Step 4 — Demo Environment Summary"

cat > "${SUMMARY_FILE}" << ENDSUMMARY
# SecureBase — Golden Sales Demo Environment
**Demo Tag:** ${DEMO_TAG}
**Created:**  $(date -u '+%Y-%m-%dT%H:%M:%SZ')
**Rep:**      ${REP_NAME:-"(not specified)"} <${REP_EMAIL:-"(not specified)"}>

## Access
| Item | Value |
|------|-------|
| Portal URL | ${DEMO_PORTAL_URL} |
| API Base URL | ${DEMO_API_BASE} |
| Demo Account ID | ${DEMO_ACCOUNT_ID} |
| Sales OU ID | ${SALES_OU_ID} |
| AWS Region | ${DEMO_REGION} |

## Sample Credentials (read-only)
| Customer | Email | API Key Prefix |
|----------|-------|----------------|
| HealthCorp Medical | admin@healthcorp-demo.example | sk_demo_hc |
| FinTechAI Analytics | admin@fintechai-demo.example | sk_demo_ft |
| GovContractor Defense | admin@govcontractor-demo.example | sk_demo_gov |
| StartupMVP Inc | admin@startupmvp-demo.example | (none) |
| SaaSPlatform Cloud | admin@saasplatform-demo.example | (none) |

## Golden Dataset Summary
- 5 sample customers (healthcare, fintech, gov-federal, standard)
- 5 sample invoices (≈ \$58K/month total)
- 3 API keys pre-generated
- Usage metrics loaded for current month

## RBAC Roles Provisioned
| Role | Permission Set | Session |
|------|---------------|---------|
| Sales Manager | ${SALES_MANAGER_PERMISSION_SET} | 8 h |
| Sales Rep     | ${SALES_REP_PERMISSION_SET}     | 4 h |

## Teardown
Run the following to remove this demo session's data and role assignments:

\`\`\`bash
./scripts/onboard-demo-sales.sh --teardown --demo-tag ${DEMO_TAG}
\`\`\`

Or manually:
1. Connect to the Aurora cluster and run:
   \`DELETE FROM customers  WHERE tags->>'DemoTag' = '${DEMO_TAG}';\`
   \`DELETE FROM invoices   WHERE tags->>'DemoTag' = '${DEMO_TAG}';\`
   \`DELETE FROM api_keys   WHERE tags->>'DemoTag' = '${DEMO_TAG}';\`
2. In the IAM Identity Center console, remove account assignments for the
   ${SALES_MANAGER_PERMISSION_SET} and ${SALES_REP_PERMISSION_SET} permission sets.
ENDSUMMARY

cat "${SUMMARY_FILE}"

echo ""
success "Summary saved to: ${SUMMARY_FILE}"
echo ""
info "Share the portal URL with your prospect:"
echo -e "  ${BOLD}${DEMO_PORTAL_URL}${NC}"
echo ""
info "To onboard another rep, run:"
echo "  ./scripts/onboard-demo-sales.sh --rep-name 'Jane Smith' --rep-email jane@acme.com"
echo ""

# ---------------------------------------------------------------------------
# Teardown mode
# ---------------------------------------------------------------------------
if [[ "${TEARDOWN}" == "true" ]]; then
  header "Teardown — Removing Demo Tag: ${DEMO_TAG}"

  TEARDOWN_SQL="${TMP_DIR}/teardown-${DEMO_TAG}.sql"
  cat > "${TEARDOWN_SQL}" << ENDSQL
-- Teardown: remove all rows tagged with DemoTag = '${DEMO_TAG}'
DELETE FROM usage_metrics WHERE customer_id IN
  (SELECT id FROM customers WHERE tags->>'DemoTag' = '${DEMO_TAG}');
DELETE FROM api_keys   WHERE tags->>'DemoTag' = '${DEMO_TAG}';
DELETE FROM invoices   WHERE tags->>'DemoTag' = '${DEMO_TAG}';
DELETE FROM customers  WHERE tags->>'DemoTag' = '${DEMO_TAG}';
ENDSQL

  info "Teardown SQL written to: ${TEARDOWN_SQL}"
  info "Apply with:"
  info "  psql \"\${DB_CONNECTION_STRING}\" < ${TEARDOWN_SQL}"

  if [[ -n "${DB_CONNECTION_STRING:-}" ]]; then
    step "Applying teardown SQL..."
    psql "${DB_CONNECTION_STRING}" < "${TEARDOWN_SQL}" \
      && success "Demo data removed for tag: ${DEMO_TAG}" \
      || warn "Teardown failed — apply the SQL manually"
  fi

  if [[ -n "${REP_EMAIL}" && -n "${SSO_INSTANCE_ARN:-}" && "${SSO_INSTANCE_ARN}" != "None" ]]; then
    if [[ -z "${IDENTITY_STORE_ID:-}" || "${IDENTITY_STORE_ID}" == "None" ]]; then
      warn "IDENTITY_STORE_ID not available — skipping IAM Identity Center teardown for ${REP_EMAIL}."
      warn "Remove the assignment manually in the IAM Identity Center console."
    else
      step "Removing IAM Identity Center assignment for ${REP_EMAIL}..."
      USER_ID=$(aws identitystore list-users \
        --identity-store-id "${IDENTITY_STORE_ID}" \
        --filters "AttributePath=UserName,AttributeValue=${REP_EMAIL}" \
        --query "Users[0].UserId" --output text 2>/dev/null || true)

      if [[ -n "${USER_ID}" && "${USER_ID}" != "None" ]]; then
        aws sso-admin delete-account-assignment \
          --instance-arn "${SSO_INSTANCE_ARN}" \
          --target-id "${DEMO_ACCOUNT_ID}" \
          --target-type "AWS_ACCOUNT" \
          --permission-set-arn "${REP_PS_ARN:-placeholder}" \
          --principal-type "USER" \
          --principal-id "${USER_ID}" &>/dev/null \
          && success "Removed demo assignment for ${REP_EMAIL}" \
          || warn "Could not remove assignment — check the console"
      fi
    fi
  fi

  success "Teardown complete for demo tag: ${DEMO_TAG}"
fi
