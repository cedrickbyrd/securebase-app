# Contributing to SecureBase

**Last Updated:** May 8, 2026  
**Scope:** Branch strategy, PR batching, deployment hygiene, and branch cleanup

---

## Overview

SecureBase ships infrastructure, backend, portal, and compliance work across multiple regulated verticals. To keep deployments auditable, reversible, and safe, contributors should batch related changes into coherent branches and PRs instead of shipping long chains of overlapping micro-PRs.

---

## Branch Naming Conventions

Use branch names that make the feature area and deployment intent immediately clear:

- `feat/<vertical>-<feature>` — new feature work  
  Example: `feat/hipaa-checkout-v2`
- `fix/<area>-<description>` — targeted bug fixes  
  Example: `fix/portal-tier-propagation`
- `chore/ci` — CI/CD workflow batching and pipeline hygiene
- `infra/<component>` — Terraform, AWS, networking, or shared infrastructure changes  
  Example: `infra/multi-region-dr`

When possible, keep one branch scoped to one releaseable area of work.

---

## PR Batching Policy

Related work in the same feature area should ship in a single PR whenever the changes are intended to be deployed together.

**Example:** HIPAA checkout hardening work such as BAA enforcement, email blocklist rules, deferred billing behavior, and audit logging should be batched into one PR instead of being merged as isolated micro-fixes.

Split work into separate PRs only when the changes are independently deployable, independently reversible, and do not depend on the rest of the batch to be safe in staging or production.

---

## Feature Verticals & Release Lifecycles

SecureBase work should generally map to one of three primary verticals, each with its own milestone and branch lifecycle:

- **Banking (FFIEC)** — banking-specific control mapping, CAT dashboard, vertical packaging
- **Healthcare (HIPAA)** — checkout, BAA, assessments, deferred billing, enrollment hardening
- **Core Platform** — auth, RBAC, analytics, CI/CD, shared platform capabilities

Use the vertical name in the branch when it helps make release intent obvious.

---

## CI/CD Fixes

All GitHub Actions workflow repairs should be batched into a `chore/ci` branch before merging to `main`.

This keeps the stable CI baseline easy to audit and avoids spreading pipeline repairs across unrelated feature PRs.

---

## Multi-Region Infrastructure Changes

Any `[WIP]` or infrastructure work that spans multiple AWS regions must be tracked as a milestone with defined acceptance criteria before merge.

At minimum, the milestone should cover:

- Health checks
- Disaster recovery failover validation
- Routing policy validation
- Runbook updates
- Clear rollback and failback steps

See `docs/MULTI_REGION_EPIC.md` for the current multi-region DR tracking checklist.

---

## Stale Branch Cleanup

Merged `copilot/*` branches should be deleted after merge.

This repository already has `delete_branch_on_merge` enabled, so contributors should **not** re-push or reuse merged branches after GitHub cleans them up. If more work is needed, create a new branch with a fresh name that matches the current scope.

---

## Pull Request Hygiene Checklist

Before marking a PR ready for review:

- [ ] Branch name matches the release area (`feat/*`, `fix/*`, `chore/*`, or `infra/*`)
- [ ] Related work is batched into one coherent PR
- [ ] Staging validation is complete for feature, fix, chore, or infra changes
- [ ] CI/CD changes are grouped into `chore/ci` when applicable
- [ ] Multi-region changes have milestone acceptance criteria and runbook references
- [ ] Any merged `copilot/*` predecessor branches are deleted and not re-pushed
