name: "SecureBase Shift-Left IaC Governance"

on:
  pull_request:
    branches: [ "main", "master", "develop" ]
  workflow_dispatch:

permissions:
  id-token: write     # Required for OIDC token federation with Supabase Edge Functions
  contents: read
  pull-requests: write

jobs:
  securebase-compliance-check:
    name: "Validate Compliance Guardrails (FFIEC / HIPAA)"
    runs-on: ubuntu-latest

    env:
      SUPABASE_URL: ${{ secrets.SECUREBASE_SUPABASE_URL }}
      SECUREBASE_SESSION_ID: ${{ secrets.SECUREBASE_DEMO_SESSION_ID }}

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Terraform / OpenTofu
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"

      - name: Generate Speculative Terraform Plan
        id: tf_plan
        run: |
          terraform init -backend=false
          terraform plan -no-color -out=tfplan.binary
          terraform show -json tfplan.binary > tfplan.json

      - name: Execute SecureBase Shift-Left Engine
        id: securebase_eval
        uses: tx-imhotep/securebase-compliance-action@v1
        with:
          plan-json-path: "tfplan.json"
          primary-framework: "FFIEC"
          fail-on-critical: "true"

      - name: Ingest Findings to Supabase Operational Plane
        if: always()
        run: |
          cat << 'EOF' > dispatch.js
          const fs = require('fs');

          async function sendTelemetry() {
            const reportExists = fs.existsSync('./securebase-summary.json');
            const summary = reportExists 
              ? JSON.parse(fs.readFileSync('./securebase-summary.json', 'utf8'))
              : { score: 0, status: "FAILED", rules_evaluated: 0, passed: 0, failed: 1, findings: [] };

            const payload = {
              session_id: process.env.SECUREBASE_SESSION_ID || "github-actions-default",
              repository: process.env.GITHUB_REPOSITORY,
              commit_sha: process.env.GITHUB_SHA,
              branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
              pr_number: process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER ? parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER, 10) : null,
              actor: process.env.GITHUB_ACTOR,
              status: summary.status,
              score_percentage: summary.score,
              rules_evaluated: summary.rules_evaluated,
              rules_passed: summary.passed,
              rules_failed: summary.failed,
              findings: summary.findings || []
            };

            const endpoint = `${process.env.SUPABASE_URL}/functions/v1/ingest-ci-scan`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${{ secrets.SECUREBASE_SERVICE_ROLE_KEY }}`
              },
              body: JSON.stringify(payload)
            });

            if (!res.ok) {
              console.warn(`Supabase ingestion warning: HTTP ${res.status}`);
            } else {
              const body = await res.json();
              console.log(`Scan telemetry recorded to Supabase. Realtime broadcast triggered. Scan ID: ${body.scan_id}`);
              console.log(`Live Dashboard: https://demo.securebase.tximhotep.com/runs/${body.scan_id}`);
            }
          }

          sendTelemetry().catch(err => console.error(err));
          EOF

          node dispatch.js

      - name: Annotate Pull Request with Defense Evidence
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let markdown = '### 🛡️ SecureBase In-Tenant Governance Scan Complete\n\n';
            if (fs.existsSync('./securebase-summary.md')) {
              markdown += fs.readFileSync('./securebase-summary.md', 'utf8');
            } else {
              markdown += 'Scan finished. Visit [demo.securebase.tximhotep.com](https://demo.securebase.tximhotep.com) for audit results.';
            }
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: markdown
            });