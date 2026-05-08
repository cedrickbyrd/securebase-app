# Feature Batching Guide

**Last Updated:** May 8, 2026  
**Purpose:** Show how closely related micro-PRs should be grouped into auditable, reversible release branches

---

## Overview

SecureBase has moved quickly through many small PRs. This guide documents where related work should be batched together in future development so releases are easier to review, validate, and roll back.

---

## Recommended Consolidation Patterns

| Feature Area | Micro-PRs (example) | Recommended Consolidated Branch |
|---|---|---|
| HIPAA Checkout | #604, #606, #607, #608, #609, #610, #611, #614, #623 | `feat/hipaa-checkout-v2` |
| FFIEC Banking | #599, #600, #601 | `feat/ffiec-banking-vertical` |
| Auth Hardening | #612, #613, #619 | `feat/unified-auth-hardening` |
| CI/CD Fixes | #603, #615, #616 | `chore/ci-hardening` |
| Analytics Pipeline | multiple analytics branches | `feat/analytics-pipeline` |
| Multi-Region Infra | #622 | `infra/multi-region-dr` |

---

## When to Split vs. Batch

Split work into separate PRs only when the changes are:

- Independently deployable
- Independently reversible
- Safe to validate without the rest of the feature batch

Batch work together when the changes share the same release goal, rollout timing, or rollback story.

---

## Draft PR Guidance

Use draft PRs to accumulate related work-in-progress before marking the branch ready for review. This is the preferred way to batch a feature that needs multiple implementation steps but should still ship as one coherent release.

---

## Labeling Guidance

Tag related PRs and draft PRs with a consistent label set so release history stays searchable.

Recommended labels:

- `hipaa`
- `ffiec`
- `ci`
- `infra`

Add `core` or `docs` when the work is platform-wide or documentation-focused.
