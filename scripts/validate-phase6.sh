#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
FAILED=0

declare -A GAPS=(
  ["track3_tests"]="Track 3 integration gap: alerting lambda behavior or test fixtures are out of sync."
  ["track6_tests"]="Track 6 integration gap: provisioning lambdas/tests are not aligned with current contract."
  ["tf_alerting_validate"]="IaC pipeline gap: terraform/modules/alerting is invalid or missing required provider/config updates."
  ["tf_tenant_provisioning_validate"]="IaC pipeline gap: terraform/modules/tenant-provisioning contract is invalid for Track 6."
  ["tf_pipeline_validate"]="IaC pipeline gap: terraform/modules/pipeline workspace/backend automation is invalid."
)

run_step() {
  local key="$1"
  shift
  echo ""
  echo "==> ${key}"
  if "$@"; then
    echo "PASS: ${key}"
  else
    echo "FAIL: ${key}"
    echo "GAP: ${GAPS[$key]}"
    FAILED=1
  fi
}

mark_gap() {
  local key="$1"
  echo ""
  echo "FAIL: ${key}"
  echo "GAP: ${GAPS[$key]}"
  FAILED=1
}

echo "Validating Phase 6 Track 3 + Track 6..."
cd "$ROOT" || exit 1

if python -c "import pytest" >/dev/null 2>&1; then
  run_step "track3_tests" python -m pytest tests/phase6/test_alerting_track3.py -q
else
  mark_gap "track3_tests"
  echo "DETAIL: pytest is not installed in the runner image; Track 3 test job is not operationalized."
fi

run_step "track6_tests" python -m unittest tests.phase6.test_track6_provisioning

if command -v terraform >/dev/null 2>&1; then
  run_step "tf_alerting_validate" bash -c "cd \"$ROOT/terraform/modules/alerting\" && terraform init -backend=false -input=false >/dev/null && terraform validate"
  run_step "tf_tenant_provisioning_validate" bash -c "cd \"$ROOT/terraform/modules/tenant-provisioning\" && terraform init -backend=false -input=false >/dev/null && terraform validate"
  run_step "tf_pipeline_validate" bash -c "cd \"$ROOT/terraform/modules/pipeline\" && terraform init -backend=false -input=false >/dev/null && terraform validate"
else
  mark_gap "tf_alerting_validate"
  mark_gap "tf_tenant_provisioning_validate"
  mark_gap "tf_pipeline_validate"
  echo "DETAIL: terraform CLI is not available in PATH; IaC validation stage cannot execute."
fi

echo ""
if [[ "$FAILED" -ne 0 ]]; then
  echo "Phase 6 validation: FAILED"
  exit 1
fi

echo "Phase 6 validation: PASSED"
exit 0
