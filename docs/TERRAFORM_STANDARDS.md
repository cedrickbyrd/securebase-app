# Terraform Standards (Phase 6 Track 6)

## Module Structure
Each module must include:
- `main.tf`
- `variables.tf`
- `outputs.tf`
- `README.md` (when module is reusable across environments)

## Naming
- Modules: `kebab-case` (example: `tenant-provisioning`)
- Resources: `snake_case`
- Variables/outputs: `snake_case`

## State & Workspaces
- Remote backend: S3 + DynamoDB lock table.
- Workspace names are fixed: `dev`, `staging`, `prod`.
- Backend key format: `landing-zone/<workspace>/terraform.tfstate`.

## Tagging Requirements
All resources must carry at least:
- `Environment`
- `ManagedBy=terraform`
- `ComplianceFramework`
- `DataClassification`
- `TenantId` (tenant-scoped resources)

## CI Requirements
- Every PR targeting `main` runs `terraform init`, `terraform validate`, `terraform plan`.
- Plan output is posted to PR comments and full output is stored as artifact.
- Merge is blocked on plan errors.
