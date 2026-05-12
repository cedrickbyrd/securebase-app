# Terraform Modules Index

## Existing Modules
- `customer-baseline` — baseline landing-zone resources for customer accounts.

## Phase 6 Track 6 Modules
- `tenant-provisioning` — reusable tenant onboarding input contract and tagging conventions.
- `pipeline` — workspace/backend conventions for plan/apply/promotion pipelines.

## State Backend
- S3 remote state bucket with versioning enabled.
- DynamoDB lock table for state locking.
- Workspace per environment (`dev`, `staging`, `prod`).
