# SecureBase AI Coding Agent Instructions

## Project Overview
SecureBase is a **dual-stack project**: a production-grade AWS Landing Zone (Terraform IaC) paired with an interactive React web application. The project delivers AWS Organizations with centralized identity, logging, and baseline security guardrails suitable for SOC 2 and RMF-aligned environments.

### Architecture
- **Backend/IaC**: `landing-zone/` contains modular Terraform that deploys AWS Organizations, IAM Identity Center, centralized logging, and Security Hub
- **Frontend**: `src/` is a React + Vite + Tailwind app providing interactive documentation and deployment guidance UI
- **Modules**: Terraform modules in `landing-zone/modules/{org,iam,logging,security}` implement distinct security domains (not interdependent)

## Critical Developer Workflows

### Terraform Deployment
```bash
cd landing-zone/environments/dev
terraform init          # First time only; backend config in landing-zone/main.tf (currently commented)
terraform plan          # Inspect changes before apply
terraform apply
```
- **Convention**: Environment-specific tfvars in `environments/dev/terraform.tfvars` (use `.example` as template)
- **Key files**: Root variables at `landing-zone/variables.tf`; module outputs wired in `landing-zone/main.tf`
- **Bootstrap prerequisite**: Remote state backend (S3 + DynamoDB) must be manually created; see commented backend config in `landing-zone/main.tf` lines 5-14

### React Development
```bash
npm run dev       # Vite dev server (localhost:5173)
npm run build     # Production bundle to dist/
npm run lint      # ESLint checks
npm run preview   # Serve built bundle locally
```

### Code Quality
- **Linting**: ESLint configured for React + React Refresh in `eslint.config.js`; unused vars allowed if capitalized (e.g., `Icon` components imported but passed as props)
- **Styling**: Tailwind CSS v4 (via PostCSS); config in `tailwind.config.js`

## Project-Specific Patterns & Conventions

### Terraform Module Structure
Each module is **self-contained with explicit outputs**:
- `modules/org/`: AWS Organizations, OUs, SCPs (org structure foundation)
- `modules/iam/`: Identity Center, permission sets, break-glass roles (identity guardrails)
- `modules/logging/`: CloudWatch Logs, S3 audit trails with Object Lock (compliance/audit)
- `modules/security/`: GuardDuty, Security Hub, Config Rules (detection/compliance)

**Pattern**: Root `main.tf` passes environment variables to modules (e.g., `environment` → `module.central_logging.environment`). Modules declare required inputs in `variables.tf` and export outputs in `outputs.tf`.

### React Component Patterns
- **Single file design**: `src/App.jsx` is monolithic (990 lines); contains all UI state, modal dialogs, deployment simulation, and configuration logic
- **Icon library**: Lucide React icons imported destructured from `lucide-react` (e.g., `Shield`, `Cloud`, `Users`)
- **State management**: `useState` for component state (activeTab, selectedModule, devConfig, deploymentLog); no Redux/Context
- **Compliance tracking**: Components display `compliance` arrays (CIS, SOC2, NIST) and `devCost` metadata for each module

### Security Conventions
- **SCP (Service Control Policy)**: Deny-by-default pattern; see `modules/org/main.tf` for examples of RestrictRootUser, RestrictRegions policies
- **Break-glass access**: Documented in module descriptions; special IAM role for emergency management account access
- **Immutable audit logs**: S3 Object Lock (Compliance Mode) enforced in logging module; prevents log tampering
- **No long-lived credentials**: Landing Zone enforces IAM Identity Center + MFA over static AWS keys

## Integration Points & Dependencies

### External Dependencies
- **AWS Provider ~5.0**: Pinned in `landing-zone/versions.tf` (currently commented; must be uncommented for production)
- **Terraform >= 1.5.0**: Required for dynamic provider configs and state backends
- **React 19.2.0**: Latest major version; uses hooks pattern throughout

### Data Flow
1. **Terraform → AWS**: Modules deploy resources to AWS Organization (management account primary region is `us-east-1` by default, customizable via `target_region` variable)
2. **AWS → UI**: React app reads hardcoded module definitions (`modules` array in App.jsx) and displays them; deployment simulation logs to `deploymentLog` state (not connected to real AWS)
3. **Variables → Deployment**: User fills `devConfig` (org name, email, region, enabled modules) in React UI; this config is displayed but not automatically persisted or sent to Terraform

### Environment Configuration
- **Dev environment**: `landing-zone/environments/dev/` contains environment-specific overrides (terraform.tfvars)
- **Common tags**: Applied to all resources via `tags` variable (default: Project=SecureBase, ManagedBy=Terraform)

## Key Files to Know
- [landing-zone/main.tf](landing-zone/main.tf) — Root module orchestration; wires variables to submodules
- [landing-zone/variables.tf](landing-zone/variables.tf) — Root-level variables (org_name, environment, allowed_regions, tags)
- [landing-zone/modules/org/main.tf](landing-zone/modules/org/main.tf) — Organization structure, OUs, SCPs (guardrails foundation)
- [landing-zone/DEPLOYMENT_GUIDE.md](landing-zone/DEPLOYMENT_GUIDE.md) — Step-by-step deployment walkthrough
- [src/App.jsx](src/App.jsx) — React landing page UI; module definitions hardcoded; deployment simulation
- [Securebase-ProductDefinition.md](Securebase-ProductDefinition.md) — Use case scope (SOC 2, RMF, fintech/SaaS targets); clarifies what is/isn't included (platform-only, no app-level security)

## Common Gotchas
1. **Bootstrap state backend not set up**: S3 + DynamoDB must exist before `terraform apply`; currently commented in main.tf
2. **Email uniqueness**: AWS requires unique emails per account; deployment will fail if email is reused
3. **Modular independence**: Security module is commented out in main.tf; uncomment only after org + identity modules succeed
4. **UI ≠ Real Terraform**: React app UI is for documentation/education; actual deployments happen via Terraform CLI
