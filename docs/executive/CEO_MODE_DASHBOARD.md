# CEO Mode — Executive Dashboard
*Snapshot date: 2026-06-26*

A live-state companion to `Executive Summary.md`. Where that describes strategy and positioning, this tracks **what is actually true in production right now**, pulled from the most recent engineering sessions (`Claude.md`, `docs/STATE_DRIFT_2026-04-22.md`, commit history). This dashboard supersedes the now-removed `docs/CEO_REVIEW_PLAN.md` (May 2026) as the executive-facing status view.

---

## 1. Platform Status at a Glance

| Area | Status | Notes |
|---|---|---|
| Core platform (Phases 1-5) | 🟢 Complete | Landing zone, serverless backend, customer portal, enterprise features, multi-region DR all shipped |
| Phase 6 — Compliance Automation | 🟡 In progress (~15%) | No change since May plan; not re-verified this session |
| AWS Marketplace integration | 🟡 Partially working | Resolve/fulfillment flow live; subscription handler has an open defect (below) |
| CI/CD apply path | 🟢 Fixed | `terraform-apply.yml` converted from auto-apply-on-push to gated `workflow_dispatch` (confirmed=APPLY) |
| Database | 🟢 Confirmed correct | `securebase-phase2-dev` cluster verified as the real prod target despite its name; no customer data misplaced |

---

## 2. Open Engineering Risks (from most recent session, 2026-06-22)

1. **Marketplace subscription handler — broken in production.**
   `marketplace_subscription_handler` fails with `ModuleNotFoundError: db_utils`. A packaging fix was written (`extra_files_for()` in `package-lambda.sh`) but **not confirmed deployed** as of session end. 9 real customer events are backlogged in its DLQ and need manual, chronologically-ordered replay once fixed.
   → Verify before assuming resolved: see `Claude.md` for the exact grep/unzip checks.

2. **`db_utils.py` duplicated across 4 locations with 3 different MD5 hashes**, one of which is stale and must not be used as a deploy source. Needs consolidation.

3. **Second ungated Terraform apply path existed undetected** (`terraform-apply.yml`, separate from the documented `terraform-securebase-apply.yml`) — pushed straight to prod on every merge to `main` with no plan step or approval gate. Now fixed; root cause traced to a March script (`remove_workflow_approvals.sh`) whose blast radius elsewhere in the repo is **unverified**.

4. **GitHubActionsRole is under-permissioned** for the now-re-gated workflow (missing SNS/SQS/EC2/KMS/S3/XRay/CloudWatch read access). Deliberately left unfixed to avoid widening the role beyond what re-gating intended — needs scoped follow-up.

5. **Netlify deploy footgun**: three separate Netlify sites build from this one repo (root, portal, demo), and `--site` only controls the destination, not the build source — deploying from the wrong working directory has shipped the wrong app to a domain at least once.

None of these are customer-data-loss risks; all are availability/operational risks.

---

## 3. Business Snapshot (unchanged from May plan — needs refresh)

| Metric | Value | Source |
|---|---|---|
| Pricing tiers | $2K–$25K/mo (Standard → Government) | `PRICING.md` |
| Pilot program | 50% off, 6 months, target 20 companies | carried over from removed `CEO_REVIEW_PLAN.md` |
| Year 1 ARR target | $1.2M (20 pilot customers) | carried over from removed `CEO_REVIEW_PLAN.md` |
| Pilot status | Marketing ready; outreach not confirmed launched this session | unverified |

*No commercial/financial data was re-verified in this session — only engineering state was. Treat business figures above as carried over, not confirmed current.*

---

## 4. What "Done" Looks Like Next

- [ ] Confirm `extra_files_for()` fix is deployed, then replay the 9-event DLQ backlog in order
- [ ] Consolidate `db_utils.py` to one canonical source
- [ ] Audit `remove_workflow_approvals.sh`'s March blast radius across all workflow files
- [ ] Scope IAM grants for `GitHubActionsRole` instead of leaving the workflow unable to plan cleanly
- [ ] Refresh the business metrics in §3 with current pilot/ARR numbers

---

*This dashboard is meant to be regenerated each session from `Claude.md` and recent commits — it is a status mirror, not a plan.*
