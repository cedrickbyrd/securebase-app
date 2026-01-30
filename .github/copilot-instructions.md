# SecureBase AI Coding Agent Instructions

## Project Overview
SecureBase is a **multi-phase, multi-tenant AWS PaaS platform** transitioning from a standalone AWS Landing Zone into a managed service. It combines Terraform infrastructure-as-code, serverless backend APIs, and customer portal UI to deliver compliant AWS Organizations at scale.

### Architecture Stack
```
├─ Phase 1: Landing Zone (✅ Complete)
│  └─ landing-zone/ — Terraform IaC for AWS Organizations, IAM, logging, security
├─ Phase 2: Serverless Backend (✅ Code Complete, Deployment Pending)
│  └─ phase2-backend/ — Aurora PostgreSQL, Lambda functions, API Gateway
├─ Phase 3a: Customer Portal (✅ Complete)
│  └─ phase3a-portal/ — React dashboard for billing, compliance, API keys
├─ Phase 3b: Advanced Features (🔨 Planned)
│  └─ Support tickets, webhooks, cost forecasting
├─ Phase 4+: Enterprise Scaling (📅 Q2-Q3 2025)
│  └─ Analytics, RBAC, white-label, multi-region
└─ Root src/ — Original React marketing/landing page (separate from portal)
```

### Multi-Tenancy Model
- **Tier-based deployments**: Healthcare (HIPAA), Fintech (SOC2), Government (FedRAMP), Standard (CIS)
- **Customer isolation**: Dedicated AWS accounts per customer, per-customer OUs, Row-Level Security (RLS) in PostgreSQL
- **Client definitions**: `landing-zone/environments/dev/client.auto.tfvars` defines customer deployments (blue-cross, goldman-fin, etc.)

---

## Critical Developer Workflows

### ⚠️ Terraform Deployment (MUST RUN FROM ENVIRONMENT DIR)
```bash
# ❌ WRONG - Do NOT run from project root or landing-zone/
cd landing-zone && terraform apply  # FAILS

# ✅ CORRECT - ALWAYS deploy from environment directory
cd landing-zone/environments/dev
terraform init
terraform plan
terraform apply
```

**Why**: Root `landing-zone/main.tf` expects to be invoked from `environments/{env}/`, which provides environment-specific variables and backend config.

**Key files**:
- `landing-zone/environments/dev/terraform.tfvars` — Root variables (org_name, environment, region)
- `landing-zone/environments/dev/client.auto.tfvars` — Customer tenant definitions
- `landing-zone/environments/dev/main.tf` — Calls parent modules with symlinked paths (`../../modules/`)

### Phase 2 Backend Deployment
```bash
# Step 1: Deploy Terraform infrastructure (Aurora, Lambda, API Gateway)
cd landing-zone/environments/dev
# Uncomment phase2-database module in main.tf first
terraform apply

# Step 2: Initialize database schema
cd ../../phase2-backend/database
chmod +x init_database.sh
./init_database.sh  # Connects to Aurora, runs schema.sql, seeds data

# Step 3: Package & deploy Lambda functions
cd ../functions
chmod +x package-lambda.sh
./package-lambda.sh  # Creates deployment zips in ../deploy/

# Step 4: Upload Lambda code (done via Terraform or AWS CLI)
aws lambda update-function-code --function-name securebase-dev-auth-v2 \
  --zip-file fileb://../deploy/auth_v2.zip
```

**Key dependencies**:
- Aurora Serverless v2 PostgreSQL (15.4) with RLS enabled
- Lambda Layer with `psycopg2-binary` (database connectivity) at `phase2-backend/lambda_layer/python/`
- API Gateway REST API with Lambda proxy integration
- Secrets Manager for database credentials

### Phase 3a Portal Development
```bash
cd phase3a-portal
npm install
npm run dev        # Vite dev server (localhost:5173)
npm run build      # Production bundle to dist/
npm run lint       # ESLint + React checks
```

**Integration**: Portal calls Phase 2 API endpoints (defined in `phase3a-portal/src/services/apiService.js`). API base URL configured via environment variable `VITE_API_BASE_URL`.

### React Marketing Site (Root src/)
```bash
# Original landing page (separate from customer portal)
npm run dev        # Vite dev server for root index.html
npm run build      # Bundles src/App.jsx to dist/
```

**Note**: Root React app (`src/App.jsx`) is a standalone marketing site with hardcoded module definitions for demonstration. Not connected to Phase 2/3 backend.

---

## Project-Specific Patterns & Conventions

### Terraform Module Structure
**Critical pattern**: All Terraform modules are **environment-agnostic** and **customer-parameterized**. Customer definitions live in `client.auto.tfvars`, not in module code.

```hcl
# landing-zone/environments/dev/client.auto.tfvars
customers = [
  {
    name         = "blue-cross"
    tier         = "healthcare"
    framework    = "hipaa"
    email        = "admin@bluecross.example.com"
    ou_name      = "Customers-Healthcare"
    account_id   = "111122223333"  # Optional; AWS will create if omitted
    guardrails   = {
      restrict_regions    = ["us-east-1", "us-west-2"]
      enforce_vpce        = true
      mfa_required        = true
      retention_days      = 2555  # 7 years
    }
  }
]
```

**Module conventions**:
- `landing-zone/modules/org/` — Creates OUs, SCPs, accounts; loops over `var.customers`
- `landing-zone/modules/phase2-database/` — Aurora, DynamoDB tables, IAM roles for Lambda
- `landing-zone/modules/api-gateway/` — REST API with Lambda integrations; authentication via API keys
- Modules export outputs in `outputs.tf`; root wires them via module references

### Database Schema Patterns (Phase 2)
**Row-Level Security (RLS)** enforces multi-tenancy in `phase2-backend/database/schema.sql`:

```sql
-- All tables have customer_id foreign key
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),  -- RLS pivot
  ...
);

-- RLS policy isolates data per session context
CREATE POLICY customer_isolation ON usage_metrics
  USING (customer_id = current_setting('app.current_customer_id')::UUID);

ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
```

**Pattern**: Lambda functions set session variable via `SET app.current_customer_id = '{customer_uuid}'` before queries. See `phase2-backend/lambda_layer/python/db_utils.py` → `set_rls_context()`.

### Lambda Function Architecture
**Shared layer pattern**: Common database utilities in Lambda Layer to avoid code duplication.

```
phase2-backend/
├─ lambda_layer/python/db_utils.py  # 50+ shared functions
│  ├─ get_db_connection()           # Connects to Aurora
│  ├─ set_rls_context(customer_id)  # Enforces RLS
│  ├─ execute_query(sql, params)    # Parameterized queries
│  └─ get_customer_by_api_key(key)  # Auth helper
├─ functions/
│  ├─ auth_v2.py          # API key validation; sets RLS context
│  ├─ billing_worker.py   # Monthly invoice generation (EventBridge cron)
│  ├─ metrics.py          # Usage aggregation for billing
│  └─ report_engine.py    # PDF/Excel export (Phase 4; uses ReportLab layer)
```

**Deployment**: Functions zip with dependencies via `package-lambda.sh`; layer built separately and attached via Terraform.

### React Portal Component Patterns (Phase 3a)
**API-first design**: All data fetched from Phase 2 API; no hardcoded data.

```javascript
// phase3a-portal/src/services/apiService.js
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const getCustomerInvoices = async (customerId, apiKey) => {
  const res = await fetch(`${API_BASE}/invoices?customer_id=${customerId}`, {
    headers: { 'X-API-Key': apiKey }
  });
  return res.json();
};
```

**Component structure**:
- `Dashboard.jsx` — Metrics cards, cost trends, compliance status
- `Invoices.jsx` — Invoice list, PDF download, payment status
- `ApiKeys.jsx` — API key management (create, revoke, rotate)
- `Compliance.jsx` — Security Hub findings, Config rule violations
- `Login.jsx` — Authentication via email + API key

**State management**: React Context for global auth state (`AuthContext`); `useState` for component state; no Redux.

### Security Conventions (Landing Zone)
**SCP deny-by-default pattern**: Service Control Policies prevent account-level privilege escalation.

```hcl
# landing-zone/modules/org/main.tf
resource "aws_organizations_policy" "restrict_root_user" {
  name        = "DenyRootUserActions"
  description = "Prevent root user usage (CIS 1.7)"
  content     = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = "*"
      Resource = "*"
      Condition = {
        StringLike = { "aws:PrincipalArn": "arn:aws:iam::*:root" }
      }
    }]
  })
}
```

**Compliance features**:
- Immutable audit logs: S3 Object Lock (Compliance Mode, 7-year retention)
- Break-glass access: Emergency IAM role in management account (MFA required)
- Encryption by default: EBS, S3, RDS encrypted via KMS
- Zero long-lived credentials: IAM Identity Center (SSO) enforced; no IAM users

---

## Integration Points & Dependencies

### External Services
- **AWS Services**: Organizations, IAM Identity Center, CloudTrail, Config, GuardDuty, Security Hub, Aurora Serverless v2, Lambda, API Gateway, Secrets Manager, EventBridge
- **Terraform Provider**: `hashicorp/aws ~> 5.0` (pinned in `landing-zone/main.tf`)
- **Database**: PostgreSQL 15.4 (Aurora Serverless v2) with `uuid-ossp`, `pgcrypto`, `pg_stat_statements` extensions
- **Python Runtime**: Lambda Python 3.11; dependencies in `phase2-backend/functions/requirements.txt` (psycopg2-binary, boto3, requests)
- **React Build**: Vite 7.2.5 (via rolldown-vite override); Tailwind CSS 4.1.18

### Data Flow (Multi-Phase)
```
User → Portal (Phase 3a) → API Gateway (Phase 2) → Lambda → Aurora (RLS) → AWS Organizations (Phase 1)
  ↓                           ↓                        ↓                           ↓
  UI State              API Key Auth              customer_id session      Deployed accounts/OUs
```

1. **User authenticates** in portal with email + API key
2. **Portal calls** Phase 2 API (`GET /invoices`, `POST /api-keys`, etc.)
3. **Lambda validates** API key, fetches customer_id, sets RLS context
4. **PostgreSQL enforces** RLS policies; only returns rows for that customer
5. **Metrics aggregated** from AWS Cost Explorer, CloudWatch, Security Hub (via Lambda cron jobs)

### Environment Configuration
**Multi-environment strategy**:
- `landing-zone/environments/dev/` — Development (test customers, lower retention)
- `landing-zone/environments/staging/` — Staging (production-like configs)
- `landing-zone/environments/prod/` — Production (real customers, full compliance)

**Convention**: Environment-specific variables in `terraform.tfvars`; customer data in `client.auto.tfvars`.

---

## Key Files to Know

### Phase 1 (Landing Zone)
- [landing-zone/environments/dev/README.md](landing-zone/environments/dev/README.md) — ⚠️ START HERE for deployment
- [landing-zone/environments/dev/main.tf](landing-zone/environments/dev/main.tf) — Environment entry point; calls parent modules
- [landing-zone/modules/org/main.tf](landing-zone/modules/org/main.tf) — AWS Organizations, OUs, SCPs
- [landing-zone/modules/phase2-database/main.tf](landing-zone/modules/phase2-database/main.tf) — Aurora, DynamoDB, IAM roles

### Phase 2 (Backend)
- [phase2-backend/database/schema.sql](phase2-backend/database/schema.sql) — 15+ tables, RLS policies, customer tiers
- [phase2-backend/database/init_database.sh](phase2-backend/database/init_database.sh) — Automated schema setup
- [phase2-backend/lambda_layer/python/db_utils.py](phase2-backend/lambda_layer/python/db_utils.py) — Shared database utilities
- [phase2-backend/functions/auth_v2.py](phase2-backend/functions/auth_v2.py) — API authentication handler

### Phase 3a (Portal)
- [phase3a-portal/src/components/Dashboard.jsx](phase3a-portal/src/components/Dashboard.jsx) — Main dashboard UI
- [phase3a-portal/src/services/apiService.js](phase3a-portal/src/services/apiService.js) — API integration layer

### Documentation
- [PROJECT_INDEX.md](PROJECT_INDEX.md) — Complete phase roadmap, status tracking
- [GETTING_STARTED.md](GETTING_STARTED.md) — Quick deployment guide
- [docs/PAAS_ARCHITECTURE.md](docs/PAAS_ARCHITECTURE.md) — Full PaaS specification, API contracts
- [Securebase-ProductDefinition.md](Securebase-ProductDefinition.md) — Scope boundaries (platform-only, not app-level security)

---

## Common Gotchas

1. **Terraform must run from environments/dev/**, not root or `landing-zone/` — symlinks break otherwise
2. **Phase 2 requires Phase 1 deployed first** — Aurora cluster needs AWS Organizations management account
3. **Database init fails if schema already exists** — Use `DROP SCHEMA IF EXISTS` or `init_database.sh --force`
4. **Lambda cold starts** — Aurora Serverless v2 may pause; first invocation after idle = 5-10s latency
5. **RLS context not set** — If queries return empty results, check `SET app.current_customer_id` in Lambda logs
6. **Portal API_BASE_URL mismatch** — Set `VITE_API_BASE_URL` in `.env` to match API Gateway endpoint
7. **Customer email uniqueness** — AWS requires unique emails per account; use `+tag` syntax (e.g., `admin+blue@example.com`)
8. **Phase 4 layer dependencies** — ReportLab/openpyxl require `build-layer.sh` in `phase2-backend/layers/reporting/`

---

## Testing Guidelines

### Test Infrastructure
**Location**: `tests/` directory contains comprehensive test suites:
- `tests/integration/` — API, database, and service integration tests
- `tests/e2e/` — End-to-end user workflow tests
- `tests/performance/` — Load testing and performance benchmarks
- `tests/security/` — Security and penetration tests
- `tests/accessibility/` — WCAG AA compliance tests

### Running Tests

**Frontend Tests (React Portal)**:
```bash
cd phase3a-portal
npm test                  # Run all tests
npm run test:coverage     # Generate coverage report
npm run test:ui           # Interactive test UI
```

**Backend Tests (Python Lambda)**:
```bash
cd phase2-backend/functions
python -m pytest test_*.py -v
python -m pytest --cov=. --cov-report=html  # With coverage
```

**Integration Tests**:
```bash
cd tests/integration
export API_BASE_URL=https://api.securebase.dev
export TEST_API_KEY=your-test-key
python -m unittest discover -v
```

**Linting**:
```bash
# Root React app
npm run lint

# Phase 3a Portal
cd phase3a-portal && npm run lint

# Python backend
cd phase2-backend/functions
pylint *.py
```

### Test Coverage Requirements
- **Unit Tests**: >90% code coverage
- **Integration Tests**: All API endpoints must be tested
- **E2E Tests**: All critical user workflows
- **Performance**: <2s page load, <200ms API response
- **Security**: OWASP Top 10 compliance
- **Accessibility**: WCAG AA compliance

### Required Environment Variables for Testing
```bash
# API Testing
export API_BASE_URL=https://api.securebase.dev
export TEST_API_KEY=sk_test_...
export TEST_CUSTOMER_ID=customer-test-123

# Database Testing
export DB_HOST=securebase-dev.cluster-xxx.us-east-1.rds.amazonaws.com
export DB_NAME=securebase
export DB_USER=test_user
export DB_PASSWORD=test-password

# Portal Testing
export VITE_API_BASE_URL=https://api.securebase.dev
export VITE_ENVIRONMENT=test
```

### CI/CD Integration
Tests run automatically on:
- Every pull request
- Before staging deployment
- Before production deployment

**Pre-deployment validation**:
```bash
# Run full test suite before deployment
./run_all_tests.sh

# Specific test suites
./test-frontend.sh        # Frontend tests
./test-phase4-staging.sh  # Phase 4 staging tests
./validate-paas.sh        # Full PaaS validation
```

### Test-Driven Development (TDD) Workflow
1. Write unit tests first for new features
2. Add integration tests for API changes
3. Update E2E tests for UI changes
4. Run full test suite before committing
5. Ensure coverage doesn't decrease

---

## Deployment Cheat Sheet

```bash
# Phase 1: Deploy Landing Zone
cd landing-zone/environments/dev
terraform init && terraform apply

# Phase 2: Deploy Backend
# 1. Uncomment phase2-database module in main.tf
terraform apply
# 2. Initialize database
cd ../../phase2-backend/database && ./init_database.sh
# 3. Package Lambdas
cd ../functions && ./package-lambda.sh
# 4. Deploy function code (via Terraform or AWS CLI)

# Phase 3a: Deploy Portal
cd ../../../phase3a-portal
npm install && npm run build
# Upload dist/ to S3 bucket + CloudFront (manual or via CI/CD)

# Diagnostics
cd landing-zone/environments/dev
terraform validate  # Check syntax
terraform plan      # Preview changes
terraform output    # View deployed resources
```
