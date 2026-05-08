# Deployment Strategy

**Last Updated:** May 8, 2026  
**Status:** Recommended promotion model for ongoing SecureBase releases

---

## Overview

SecureBase should use a simple, auditable promotion path: validate change sets in staging first, then promote to production only from `main` after staging validation is complete.

---

## Environment Promotion Model

### Staging → Production

- **Staging** — used for all `feat/*`, `fix/*`, and `chore/*` branches before merge
- **Production** — promoted only from `main` after staging validation succeeds

This keeps pre-merge validation separate from production promotion and reduces the risk of partial or overlapping releases reaching customers.

---

## Recommended GitHub Environments

Configure GitHub Environments in **Settings → Environments** with the following baseline rules:

### `staging`

- No required reviewers
- Auto-deploy on push to any `feat/*` branch
- Also used to validate `fix/*` and `chore/*` branches before merge

### `production`

- Required reviewer: `cedrickbyrd`
- Deploy only from `main`
- Promotion occurs only after staging validation is complete

---

## Feature Grouping by Vertical

### HIPAA / Healthcare

Group checkout, BAA, assessment, and deferred billing work into versioned releases such as:

- `hipaa-v1`
- `hipaa-v2`

### FFIEC / Banking

Group banking-specific work into versioned releases such as:

- CAT dashboard
- Control mapping
- Sales playbook

### Core Platform

Group shared platform changes into their own release tracks, including:

- Authentication and session hardening
- RBAC
- Analytics
- CI/CD improvements

---

## Multi-Region Rollout Model

- **Primary region:** `us-east-1`
- **Secondary region:** `us-west-2` (added in PR #622)

All multi-region changes should be treated as milestone work and must include verification of:

- Route 53 health checks
- Lambda regional replication
- DR runbook updates
- Failback procedure testing

See [MULTI_REGION_EPIC.md](./MULTI_REGION_EPIC.md) for the current acceptance checklist.

---

## Multi-Region Release Gates

Before multi-region changes are promoted beyond staging, confirm:

- Route 53 health checks are configured in both regions
- Lambda regional replication is validated in `us-west-2`
- API routing and failover behavior are verified
- DR documentation is updated
- Failback steps are tested, not just documented

---

## Deployment Scripts Consolidation Note

The repository root currently contains 20+ phase-specific deployment scripts such as `deploy-phase2.sh`, `deploy-phase4-analytics.sh`, `deploy-phase4-staging.sh`, `DEPLOY_NOW.sh`, and `deploy-phase2-production.sh`.

These should be consolidated into one of the following long-term approaches:

1. A single `scripts/deploy.sh` entry point with environment and phase flags
2. GitHub Actions workflows as the primary deployment interface

Until that consolidation happens, contributors should avoid adding more one-off root deployment scripts for feature-specific releases.
