# Notification Pilot Audit — Current State Assessment

_Date:_ 2026-05-24  
_Repository:_ `cedrickbyrd/securebase-app`  
_Scope:_ Read-only architecture audit (no functional code changes)

## Executive Summary

| Risk Area | Readiness | Summary |
|---|---|---|
| 1. Alert Fatigue (Dedup / Batching) | **Red** | No global deduplication or batching window is implemented across active notification dispatch paths. Repeated events can fan out one-by-one. |
| 2. Secure Delivery (Payload Sanitization) | **Red** | Outbound payloads currently include raw event/body metadata and account-identifying fields in multiple paths; no shared `sanitizeNotificationPayload()` utility exists. |
| 3. Delivery Logging (Success/Failure Tracking) | **Amber** | Partial logging exists (CloudWatch logs + webhook delivery table), but no unified `NotificationDeliveryLog`, no robust retry-exhaustion pipeline for webhook manager, and inconsistent escalation into Phase 5 alerting. |

---

## Files / Functions Examined

### Primary dispatch and notification code
- `phase2-backend/functions/notification_worker.py`
- `phase2-backend/functions/notification_api.py`
- `phase2-backend/functions/webhook_manager.py`
- `phase2-backend/functions/alert_router.py`
- `phase2-backend/functions/support_tickets.py`

### Infrastructure wiring / alerting
- `landing-zone/main.tf`
- `landing-zone/modules/lambda-functions/main.tf`
- `landing-zone/modules/api-gateway/main.tf`
- `landing-zone/modules/notifications/main.tf`
- `landing-zone/modules/webhooks/main.tf`
- `landing-zone/modules/phase5-alerting/main.tf`
- `landing-zone/modules/phase5-alerting/webhook-integration.tf`

### Portal and API client context
- `phase3a-portal/src/components/Webhooks.jsx`
- `phase3a-portal/src/services/notificationService.js`
- `phase3a-portal/src/services/analyticsService.js`
- `src/utils/analytics.js` (root marketing site; includes concrete PII/PHI redaction primitives)

### Validation/tests/docs context
- `phase2-backend/tests/test_notification_worker.py`
- `phase2-backend/functions/test_alert_router.py`
- `phase2-backend/.env.example`

## Pilot constraints used for this assessment

From the pilot issue requirements for this audit:
- Rate limiting target: **100 req/hr per customer** (server-side Lambda enforcement)
- Notification implementation path: **AWS Lambda + API Gateway** (no Netlify Functions)
- Logging posture: no PII/PHI in notification delivery logs
- Retry exhaustion should integrate with existing **Phase 5 alerting SNS** path

---

## 1) Alert Fatigue — De-duplication / Batching

### Current state
1. **`notification_worker.py` processes each SQS record independently** and dispatches channel-by-channel; there is no dedup cache key, no batching buffer, and no dedup TTL/batch window configuration.
2. **Webhook dispatch in `webhook_manager.py` triggers per event per webhook** immediately (`trigger_webhook` loop), also without dedup/batch controls.
3. **`support_tickets.py` emits SNS events per ticket action** (`ticket_created`, `ticket_updated`, `comment_added`) and does not aggregate repeated updates.
4. **`alert_router.py` includes only provider-level PagerDuty dedup key behavior** (`dedup_key = AlarmName`), which is not a general SecureBase dedup/batch control and does not cover Slack/webhook fanout behavior.

### Avalanche risk assessment
- Yes — repeated high-churn event sources can generate notification storms to customers/channels.
- No repository-level configurable `NOTIFICATION_DEDUP_TTL` or `NOTIFICATION_BATCH_WINDOW` was found in active paths.

### Gap assessment
- Missing shared dedup strategy and batching window across Lambda dispatch paths.
- Missing per-customer/event suppression controls.
- Missing pilot-safe defaults for noisy environments.

---

## 2) Secure Delivery — Payload Sanitization

### Current state
1. **No shared `sanitizeNotificationPayload()` utility exists** in backend notification dispatch code.
2. **`notification_worker.py` webhook payload includes raw `body` and `metadata`** and passes through values originating from source events/templates.
3. **`webhook_manager.py` forwards raw `data` payloads and stores full payload/response bodies** in delivery logs (`log_delivery`).
4. **`alert_router.py` forwards CloudWatch alarm details including `AWSAccountId` and full alarm reason text** to third-party webhook destinations.
5. **No deep-link-first pattern is used** (for example to `portal.securebase.tximhotep.com`) in outbound notification payloads; payloads currently carry event detail directly.

### Sensitive-field exposure assessment
Potentially exposed in outbound payloads/logged delivery records:
- Account identifiers (`customer_id`, AWS-native alarm field `AWSAccountId`)
- Raw metadata/body contents (including security/compliance context)
- Full webhook response bodies (could include secrets/errors from third-party endpoints)

### Gap assessment
- No central sanitizer/redaction policy applied before outbound delivery.
- No enforced allowlist schema per channel.
- No standard “summary + secure dashboard deep link” model.

---

## 3) Delivery Logging — Success/Failure Tracking

### Current state
1. **`notification_worker.py` logs delivery results to CloudWatch via `print(json.dumps(...))` only**; no dedicated persistence table is used there.
2. **`webhook_manager.py` writes delivery attempts to DynamoDB (`DELIVERIES_TABLE`)** and tracks `delivery_success_count` / `delivery_failure_count` on webhook records.
3. **Retry behavior is incomplete in webhook manager**:
   - `schedule_retry()` is a placeholder (`print(...)` only).
   - No actual delayed retry queue/step function implementation.
   - No explicit exhausted-retry alarm tied to this path.
4. **Phase 5 alerting has strong existing plumbing** (`phase5-alerting`): SNS topic, alert router DLQ, and DLQ depth alarm to SNS.
5. **Notification-specific retry exhaustion is not integrated into Phase 5 alerting topic** for webhook-manager delivery failures.

### `NotificationDeliveryLog` table assessment
- No table named `NotificationDeliveryLog` exists.
- Closest equivalent: webhook-specific delivery table (`webhook_deliveries`) in `landing-zone/modules/webhooks/main.tf`.

### Gap assessment
- Missing unified delivery outcome model across all notification channels.
- Missing robust retry + backoff execution (not just placeholders).
- Missing critical-alert failure escalation pipeline into existing Phase 5 alerting stack.

---

## Recommended Remediation (Prioritized)

## P0 (Pilot blocking)
1. **Implement shared payload sanitizer utility**
   - Add backend utility (e.g., `phase2-backend/lambda_layer/python/notification_sanitizer.py`) and use it in:
     - `notification_worker.py` (email/webhook/SMS payload assembly)
     - `webhook_manager.py` (`payload` creation + persisted log records)
     - `alert_router.py` (third-party alert payloads)
   - Mirror the sanitization style already used in `phase3a-portal/src/services/analyticsService.js` and reuse the concrete redaction primitives from `src/utils/analytics.js` (`PII_PATTERNS`, `sanitizePath`) as the baseline.
   - Implement sanitization server-side in Lambda only; frontend analytics patterns are reference input, not an execution boundary.
   - Implement a notification-specific allowlist schema per channel (webhook/email/SMS) for delivery payloads.
   - Enforce allowlist output fields and redact/remove: account IDs, ARNs, raw policy blobs, CVE internals, secret identifiers.
   - Emit dashboard deep links to `https://portal.securebase.tximhotep.com/...` for sensitive drill-down.

2. **Add dedup + batch controls for high-churn events**
   - Introduce environment-driven controls (example):
     - `NOTIFICATION_DEDUP_TTL_SECONDS`
     - `NOTIFICATION_BATCH_WINDOW_SECONDS`
   - Apply to `notification_worker.py` and webhook fanout path in `webhook_manager.py`.
   - Persist dedup keys in DynamoDB with TTL (customer_id + event fingerprint + channel).

3. **Fix retry execution path for webhook delivery failures**
   - Replace `schedule_retry()` placeholder in `webhook_manager.py` with real delayed retry orchestration (SQS delay queue or Step Functions).
   - Add max-attempt tracking and explicit exhausted status.

4. **Resolve runtime configuration mismatches before pilot traffic**
   - Align webhook delivery log environment variable naming between runtime and Lambda config (`DELIVERIES_TABLE` vs `WEBHOOK_DELIVERIES_TABLE`) so delivery logging does not silently fail.
   - Add startup validation in notification/webhook Lambdas for required environment variables.

5. **Rate-limit enforcement alignment**
   - Current API Gateway defaults are 100 req/sec per key (`api-gateway` usage plan), which does not satisfy the pilot guardrail of 100 req/hr/customer documented in **Pilot constraints used for this assessment**. This is a critical operational and abuse-risk gap (3600x mismatch) for pilot traffic.
   - Add server-side per-customer hourly limiter in notification Lambdas before pilot rollout.

## P1 (Pilot hardening)
6. **Create unified delivery log table and schema**
   - Add a `NotificationDeliveryLog`-style table (or extend existing webhook delivery model) in Terraform with:
     - KMS encryption
     - Required tags: `Environment`, `ComplianceFramework`, `DataClassification`
     - TTL for retention lifecycle
   - Store minimal non-PII fields only: `clientId` (opaque), `alertType`, `channel`, `status`, `attempt`, `errorCode`, timestamps.

7. **Integrate exhausted retry alarms into Phase 5 alerting**
   - Reuse `landing-zone/modules/phase5-alerting` SNS topic output.
   - Add CloudWatch metric + alarm for retry exhaustion counts and route to `aws_sns_topic.alerts.arn`.

8. **Normalize active infra wiring and remove drift**
   - Root `landing-zone/main.tf` currently wires active notification-like paths via `lambda-functions` + `api-gateway`, while dedicated `modules/notifications` and `modules/webhooks` are not wired.
   - Consolidate to one canonical deployment path before pilot rollout.
   - Keep implementation strictly in AWS Lambda + API Gateway paths (no new Netlify Functions), aligned with the repository cost-optimization policy in CLAUDE.md.

## P2 (Operational maturity)
9. **Add notification delivery SLO dashboards**
   - Build dashboards for success rate, retries, exhausted retries, median/95p delivery latency, per-channel failure heatmap.

---

## Compliance Notes (SOC 2 / HIPAA / FedRAMP)

1. **SOC 2 (CC6/CC7)**
   - Lack of centralized sanitization and incomplete retry/audit outcomes weakens logical access control evidence and monitoring effectiveness.

2. **HIPAA safeguards**
   - Raw payload forwarding/logging risks accidental leakage of sensitive operational details. Pilot logs should be minimal and non-PII/PHI by design.

3. **FedRAMP continuous monitoring**
   - Retry-exhaustion and delivery failure telemetry must be alarmed and routed through existing incident channels; placeholders are insufficient for operational assurance.

4. **Data minimization / least disclosure**
   - Notifications should carry summary + secure dashboard link; deep technical content should remain behind authenticated portal access.

5. **CI/CD credential posture**
   - Follow existing GitHub Actions OIDC posture (`id-token: write`) for any notification-related deployment workflow updates; do not introduce static AWS keys.

---

## Phase 5 Integration Opportunities

1. **Reuse existing alert transport**
   - Use `phase5-alerting` SNS topic (`aws_sns_topic.alerts.arn`) for retry-exhaustion and critical-delivery-failure alarms.

2. **Reuse alert router DLQ pattern**
   - Mirror `phase5-alerting/webhook-integration.tf` DLQ + CloudWatch alarm pattern for notification retry pipelines.

3. **Leverage existing CloudWatch/X-Ray posture**
   - Keep notification Lambdas on active tracing and emit structured metrics compatible with existing alarm conventions.

4. **Converge into existing governance tags and encryption standards**
   - Any new notification data stores should follow existing tagging/KMS patterns already present in landing-zone modules.

---

## Additional Observations (Current-State Risks)

1. **Infrastructure drift risk**
   - `modules/notifications` and `modules/webhooks` are present but not wired in root `landing-zone/main.tf`.
   - Active deployment currently routes webhooks through `modules/lambda-functions` + `modules/api-gateway`.

2. **Environment variable mismatch risk**
   - `phase2-backend/functions/webhook_manager.py` expects `DELIVERIES_TABLE`, while `landing-zone/modules/lambda-functions/main.tf` configures `WEBHOOK_DELIVERIES_TABLE` for the active webhook-manager Lambda path.
   - This should be reconciled during implementation PR to avoid runtime misconfiguration.

---

## Follow-up PR scope recommendation

A follow-up implementation PR should focus on:
1. Shared payload sanitization utility and channel allowlists
2. Dedup/batch controls with TTL windows
3. Real retry orchestration + exhaustion alarms to Phase 5 SNS
4. Unified minimal delivery logging schema (non-PII/PHI) with KMS + required tags
5. Notification infra wiring cleanup to a single canonical path
