#!/usr/bin/env bash
# =============================================================================
# push_to_branch.sh
#
# Pushes this sprint's deliverables into the Copilot PR branch:
#   copilot/implement-self-service-signup-onboarding
#
# Run this from the ROOT of your local securebase-app clone.
# Prerequisites: git, the repo cloned, you're authenticated with write access.
# =============================================================================

set -euo pipefail

BRANCH="copilot/implement-self-service-signup-onboarding"
SPRINT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Fetching latest from origin..."
git fetch origin

echo "▶ Checking out branch: $BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" --track "origin/$BRANCH"

echo "▶ Pulling latest..."
git pull origin "$BRANCH" --rebase

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "▶ Copying frontend components..."
mkdir -p phase3a-portal/src/components/signup
mkdir -p phase3a-portal/src/components/onboarding

cp "$SPRINT_DIR/frontend/src/components/signup/SignupForm.jsx"         phase3a-portal/src/components/signup/SignupForm.jsx
cp "$SPRINT_DIR/frontend/src/components/signup/SignupForm.css"         phase3a-portal/src/components/signup/SignupForm.css
cp "$SPRINT_DIR/frontend/src/components/onboarding/OnboardingProgress.jsx" phase3a-portal/src/components/onboarding/OnboardingProgress.jsx
cp "$SPRINT_DIR/frontend/src/components/onboarding/OnboardingProgress.css" phase3a-portal/src/components/onboarding/OnboardingProgress.css

# ── Lambda ────────────────────────────────────────────────────────────────────
echo "▶ Copying Lambda functions..."
mkdir -p lambda

cp "$SPRINT_DIR/lambda/signup_handler.py"      lambda/signup_handler.py
cp "$SPRINT_DIR/lambda/account_provisioner.py" lambda/account_provisioner.py
cp "$SPRINT_DIR/lambda/onboarding_status.py"   lambda/onboarding_status.py

# ── Database ──────────────────────────────────────────────────────────────────
echo "▶ Copying DB migration..."
mkdir -p database/migrations

cp "$SPRINT_DIR/database/003_customer_signup_onboarding.sql" database/migrations/003_customer_signup_onboarding.sql

# ── Terraform ─────────────────────────────────────────────────────────────────
echo "▶ Copying Terraform module..."
mkdir -p terraform/modules/customer-baseline

cp "$SPRINT_DIR/terraform/modules/customer-baseline/main.tf" terraform/modules/customer-baseline/main.tf

# ── Docs ──────────────────────────────────────────────────────────────────────
echo "▶ Copying sprint README..."
cp "$SPRINT_DIR/SPRINT_README.md" SPRINT_README.md

# ── Stage & commit ────────────────────────────────────────────────────────────
echo "▶ Staging files..."
git add \
  phase3a-portal/src/components/signup/SignupForm.jsx \
  phase3a-portal/src/components/signup/SignupForm.css \
  phase3a-portal/src/components/onboarding/OnboardingProgress.jsx \
  phase3a-portal/src/components/onboarding/OnboardingProgress.css \
  lambda/signup_handler.py \
  lambda/account_provisioner.py \
  lambda/onboarding_status.py \
  database/migrations/003_customer_signup_onboarding.sql \
  terraform/modules/customer-baseline/main.tf \
  SPRINT_README.md

echo "▶ Committing..."
git commit -m "feat: implement customer self-service signup & onboarding

- SignupForm.jsx: 4-step signup UI (account, org, config, verify)
- OnboardingProgress.jsx: live status poller with 7-step tracker
- signup_handler.py: Lambda for POST /signup (Cognito + Aurora + SES)
- account_provisioner.py: async Lambda for AWS Org + Terraform provisioning
- onboarding_status.py: Lambda for GET /onboarding/status polling endpoint
- 003_customer_signup_onboarding.sql: customers, onboarding_jobs/steps/events tables
- terraform/modules/customer-baseline: parameterized VPC/IAM/guardrails module

All config via SSM Parameter Store. Zero hardcoded secrets.
See SPRINT_README.md for integration instructions and SSM params list.

Closes #344 prerequisites. Remaining: /verify-email Lambda."

echo "▶ Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo ""
echo "✅ Done! Files are live on branch: $BRANCH"
echo "   PR: https://github.com/cedrickbyrd/securebase-app/pull/344"
echo ""
echo "Next steps:"
echo "  1. Mark the PR as 'Ready for review' (remove [WIP] / undraft)"
echo "  2. Add VITE_API_BASE_URL to Netlify environment variables"
echo "  3. Run: psql \$DATABASE_URL < database/migrations/003_customer_signup_onboarding.sql"
echo "  4. Create SSM parameters (see SPRINT_README.md)"
echo "  5. Deploy the three Lambda functions"
