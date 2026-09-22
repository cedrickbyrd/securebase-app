#!/usr/bin/env bash
set -euo pipefail

# Configuration
PROJECT_ID="securebase-gcp-dev"
PROJECT_NUMBER="594006980795"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-actions-provider"
SA_NAME="github-actions-sa"
GITHUB_REPO="cedrickbyrd/securebase-app"

echo "=== 1. Creating Workload Identity Pool ==="
if ! gcloud iam workload-identity-pools describe "${POOL_NAME}" --location="global" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam workload-identity-pools create "${POOL_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool"
  echo "Pool created."
else
  echo "Pool already exists."
fi

echo "=== 2. Creating OIDC Workload Identity Provider ==="
if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
    --workload-identity-pool="${POOL_NAME}" \
    --location="global" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" \
    --display-name="GitHub Actions Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
  echo "Provider created with repo constraint: ${GITHUB_REPO}"
else
  echo "Provider already exists."
fi

echo "=== 3. Creating Dedicated Service Account ==="
if ! gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="GitHub Actions Deployer"
  echo "Service account created."
else
  echo "Service account already exists."
fi

echo "=== 4. Binding Workload Identity User Role ==="
gcloud iam service-accounts add-iam-policy-binding "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

echo "=== Setup Complete ==="
echo "Workload Identity Provider Resource Name:"
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"
echo ""
echo "Service Account Email:"
echo "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
