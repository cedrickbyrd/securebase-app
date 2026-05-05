# SecureBase FFIEC Integration Strategy

**Version:** 2.0  
**Owner:** SecureBase Engineering  
**Audience:** Solutions Engineers, Integration Engineers, Customer Engineering  
**Updated:** May 2026

---

## Overview

SecureBase integrates with FFIEC-regulated institutions at two levels:

1. **Regulatory Evidence Level** — Instead of showing "S3 encryption: Passed ✓", the platform explicitly links each telemetry finding to the specific FFIEC IT Handbook section it satisfies (e.g., IS §II.C: Data in Transit and at Rest). The goal: when an examiner asks "How do you ensure data integrity?", the application produces a one-click Evidence Package containing the policy, the technical proof (live AWS telemetry), and the remediation history — not a spreadsheet.

2. **CAT Auto-Mapping Level** — The FFIEC Cybersecurity Assessment Tool (CAT) is a voluntary self-assessment that most institutions complete manually over 3 months. SecureBase ingests AWS/GCP metadata to automatically suggest Maturity Levels (Baseline → Evolving → Intermediate → Advanced → Innovative) per CAT domain, turning the exercise into a real-time dashboard.

The integration operates within a **Sovereign Cloud** architecture: all raw data and evidence stays in the customer's AWS account; SecureBase never holds or can decrypt customer evidence.

---

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Customer AWS Account                               │
│                                                                           │
│  ┌────────────────┐  VPC Peering / Read Replica                          │
│  │ Transaction DB │ ───────────────────────────────────┐                 │
│  │ (PostgreSQL /  │                                     │                 │
│  │  MySQL / Aurora│                                     ▼                 │
│  └────────────────┘              ┌──────────────────────────────────┐    │
│                                  │  SecureBase Lambda               │    │
│  ┌────────────────┐  Webhook /   │  (VPC-attached, read-only IAM)   │    │
│  │ AML System     │  REST API    │                                  │    │
│  │ (Unit21 /      │ ────────────►│  texas_fintech_                  │    │
│  │  Sardine)      │              │  compliance_collector.py         │    │
│  └────────────────┘              │  + metrics_aggregation.py        │    │
│                                  └──────────────┬───────────────────┘    │
│  ┌────────────────┐  REST API                   │                        │
│  │ KYC/CIP System │ ─────────────►──────────────┘                       │
│  │ (Alloy/Socure) │                              │ collect + map          │
│  └────────────────┘                              ▼                        │
│                                  ┌──────────────────────────────────┐    │
│  AWS Telemetry Sources           │  DynamoDB                        │    │
│  ┌──────────────────────┐        │  securebase-compliance-violations │    │
│  │ CloudTrail           │        │  securebase-metrics-history      │    │
│  │ AWS Config           │        │  securebase-audit-trail          │    │
│  │ GuardDuty            │───────►│  (KMS encrypted, per-customer)   │    │
│  │ Security Hub         │        └──────────────┬───────────────────┘    │
│  │ IAM Access Analyzer  │                        │ sign + vault           │
│  │ VPC Flow Logs        │                        ▼                        │
│  └──────────────────────┘        ┌──────────────────────────────────┐    │
│                                  │  S3 Evidence Bucket              │    │
│                                  │  Object Lock (Compliance mode)   │    │
│                                  │  KMS encrypted + KMS-signed      │    │
│                                  └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                    │ API calls (read-only, no PII exported)
                    ▼
          SecureBase Portal (phase3a-portal)
          ├── FFIECCATDashboard.jsx
          ├── FFIECControlMapping.jsx
          ├── ComplianceDrift.jsx
          └── TenantDashboard.jsx
```

**Sovereign Cloud principles:**
- All raw data stays in the customer's AWS account — no cross-account data transfer
- PII is HMAC-SHA256 hashed (per-customer salt from Secrets Manager) before leaving the customer's VPC
- Customer holds the KMS CMK; SecureBase cannot decrypt evidence
- S3 Object Lock (Compliance mode) prevents modification for the retention period
- Row-Level Security in Aurora enforces `customer_id` isolation for all SecureBase managed data

---

## Functional Mapping: From "Passed ✓" to Regulatory Evidence

### The Problem with Generic Compliance Dashboards

Most platforms display a status like:
```
✓ s3-bucket-server-side-encryption-enabled  — Passed
```

This is meaningless to an FFIEC examiner. The examiner's framework asks:

> *"Does the institution encrypt sensitive data at rest using approved cryptographic algorithms?"* — FFIEC IS §II.C

SecureBase links the two:

```
AWS Config Rule: s3-bucket-server-side-encryption-enabled — Passed
    └──► FFIEC IT Handbook: IS §II.C — Data in Transit and at Rest
         └──► CAT Statement (Domain 3): "Sensitive data is encrypted in transit and at rest."
              └──► Evidence: "All S3 buckets: SSE-KMS (AES-256), KMS key: arn:aws:kms:..."
```

This is what the `FFIECControlMapping` component renders. Every telemetry check has:
1. The AWS source (service + rule name)
2. The finding (passed/warning/failed)
3. The FFIEC IT Handbook section it satisfies
4. The CAT assessment statement it maps to
5. The raw evidence string (exportable to examiner package)

### Control Mapping Table

| AWS Telemetry | FFIEC IT Handbook | CAT Domain | CAT Statement |
|---|---|---|---|
| Config: `s3-bucket-server-side-encryption-enabled` | IS §II.C | 3: Cybersecurity Controls | Sensitive data encrypted at rest |
| Config: `rds-storage-encrypted` | IS §II.C | 3: Cybersecurity Controls | Sensitive data encrypted at rest |
| Config: `elb-tls-https-listeners-only` | IS §II.C | 3: Cybersecurity Controls | Sensitive data encrypted in transit |
| Security Hub: IAM.6 (root MFA) | IS §II.D | 1: Cyber Risk Management | MFA controls are in place |
| Security Hub: IAM.19 (user MFA) | IS §II.D | 1: Cyber Risk Management | MFA controls are in place |
| IAM Access Analyzer: external access | IS §II.D | 1: Cyber Risk Management | Access controls limit access to authorized users |
| CloudTrail: multi-region trail + Object Lock | IS §II.E | 3: Cybersecurity Controls | Audit logs captured and tamper-evident |
| Config: `cloud-trail-log-file-validation-enabled` | IS §II.E | 3: Cybersecurity Controls | Log integrity validation enabled |
| GuardDuty: HIGH/CRITICAL detections | CS §II.A | 2: Threat Intelligence | Threat monitoring and alerting is in place |
| Security Hub: CISA KEV integration | CS §II.A | 2: Threat Intelligence | Threat intelligence feeds are current |
| Aurora Global: replication lag | BCP §II.B | 5: Cyber Incident Management | RPO < 1 minute documented and tested |
| Route 53 Health Check: failover | BCP §II.B | 5: Cyber Incident Management | RTO < 15 minutes documented and tested |
| EventBridge: GuardDuty alert routing | BCP §III.A | 5: Cyber Incident Management | Incident response plan with automated escalation |
| Config: `restricted-ssh` / `restricted-common-ports` | CS §II.A | 3: Cybersecurity Controls | Network perimeter controls implemented |
| VPC Flow Logs: all VPCs | CS §II.A | 3: Cybersecurity Controls | Network traffic monitoring enabled |
| Organizations SCPs: DenyRootUser | IS §II.A | 1: Cyber Risk Management | Information security program with board oversight |
| Inspector: EC2 vulnerability findings | CS §I.B | 3: Cybersecurity Controls | Vulnerability management process in place |

---

## CAT Auto-Mapping Architecture

### From Manual Spreadsheet to Real-Time Dashboard

**Before SecureBase (manual process):**
1. CCO downloads FFIEC CAT Excel workbook (~200 rows)
2. Convenes 3-month working group: IT, Compliance, Risk
3. Each row is manually assessed against policy documents
4. Consulting firm validates responses: $75K–$150K
5. Result: point-in-time snapshot, outdated within weeks
6. No link between CAT responses and actual AWS configuration

**With SecureBase (automated):**
1. Lambda runs daily at 03:00 UTC, collecting Config/GuardDuty/Security Hub results
2. `metrics_aggregation.py` maps each finding to its CAT domain and assessment statement
3. `FFIECCATDashboard.jsx` renders live maturity levels per domain
4. When a Config rule regresses (e.g., encryption disabled on a new bucket), the CAT score drops and an alert fires
5. `ComplianceDrift` shows the regression timeline with MTTR analytics
6. One-click examiner package includes the CAT assessment with evidence citations

### Maturity Level Calculation

Each CAT domain's maturity is calculated from the control scores of its constituent AWS telemetry checks:

```
Domain Maturity Score = (controls_passing / controls_total) × 100

Maturity Level:
  0–39%  → Baseline
  40–59% → Evolving
  60–79% → Intermediate
  80–94% → Advanced
  95–100% → Innovative
```

The `FFIECCATDashboard` component exposes `telemetry` props that accept live data from the `GET /admin/compliance-summary` API endpoint (when `VITE_USE_MOCK_API=false`).

### Lambda Evidence Collection Flow

```python
# metrics_aggregation.py — FFIEC CAT mapping section (simplified)

FFIEC_CONTROL_MAPPINGS = {
    "s3-bucket-server-side-encryption-enabled": {
        "cat_domain": "cybersecurity_controls",
        "handbook_section": "IS §II.C",
        "cat_statement": "Sensitive data is encrypted in transit and at rest.",
        "weight": 1.0,
    },
    "iam-root-access-key-check": {
        "cat_domain": "cyber_risk_management",
        "handbook_section": "IS §II.D",
        "cat_statement": "Multi-factor authentication controls are in place.",
        "weight": 1.5,  # Higher weight = more impact on domain score
    },
    # ... all 20+ mappings
}

def score_cat_domain(domain_id: str, config_findings: list) -> dict:
    domain_controls = [
        m for m in FFIEC_CONTROL_MAPPINGS.values()
        if m["cat_domain"] == domain_id
    ]
    relevant_findings = [
        f for f in config_findings
        if f["rule_name"] in FFIEC_CONTROL_MAPPINGS
        and FFIEC_CONTROL_MAPPINGS[f["rule_name"]]["cat_domain"] == domain_id
    ]
    passing = sum(
        FFIEC_CONTROL_MAPPINGS[f["rule_name"]]["weight"]
        for f in relevant_findings if f["status"] == "COMPLIANT"
    )
    total = sum(m["weight"] for m in domain_controls)
    score = (passing / total * 100) if total > 0 else 0
    return {
        "domain_id": domain_id,
        "score": round(score, 1),
        "maturity": _score_to_maturity(score),
        "findings": len([f for f in relevant_findings if f["status"] != "COMPLIANT"]),
    }
```

---

## Replacing "Self-Service" with "Briefings" for Banking Visitors

### The Change

For users arriving from banking domains (Texas Bankers Association, IBAT, ABA, NMLS campaigns), the platform replaces the low-friction "14-day trial" CTA with a "Request Regulatory Briefing" flow.

**Rationale:**
- Community banks and credit unions have mandatory vendor due diligence processes
- A "Start Free Trial" button signals a consumer SaaS product — not an enterprise compliance platform
- Banking buyers need to see the SOC 2 Type II report, Sovereign Cloud architecture brief, and penetration test results BEFORE touching any code
- The regulatory briefing positions SecureBase as a peer institution rather than a vendor

### Implementation

**Detection:** `isBankingDomainTraffic()` in `src/utils/trackingUtils.js` detects banking-origin visitors via UTM parameters:
- `utm_source`: `tba`, `ibat`, `aba`, `cba`, `texas_bankers`, `banking`, `ffiec`
- `utm_campaign`: contains `ffiec`, `banking`, or `examiner`
- `utm_medium`: `banking`

**CTA swap in `Pricing.jsx`:**
- Fintech/Healthcare plan card: "Start Free Trial" → "Request Regulatory Briefing →"
- Urgency banner (pilot countdown): hidden for banking visitors
- Banking banner shown instead: "FFIEC-regulated institution? Start with a Regulatory Briefing."
- Click routes to: `/contact-sales?tier=fintech&source=banking&topic=ffiec&briefing=true`

**FAQ update:**
- "Is there a free trial?" FAQ replaced with "What is a Regulatory Briefing?" and "Does SecureBase support FFIEC examinations directly?" for banking visitors

### UTM Campaign Setup (Texas Bankers Association)

```
TBA email campaign link:
https://securebase.tximhotep.com/pricing?utm_source=tba&utm_medium=banking&utm_campaign=ffiec_cat_2026&utm_content=cco_email

TBA LinkedIn sponsored content:
https://securebase.tximhotep.com/pricing?utm_source=tba&utm_medium=linkedin&utm_campaign=ffiec_examiner_2026&utm_content=banner

IBAT outreach:
https://securebase.tximhotep.com/pricing?utm_source=ibat&utm_medium=banking&utm_campaign=ffiec_community_bank_2026
```

---

## Sovereign Cloud as the "Hook"

### Why This Wins Banking Sales

Generic compliance SaaS tools (Vanta, Drata, Ncontracts) operate as multi-tenant cloud services — customer evidence lives in the vendor's database. For financial institutions subject to OCC Bulletin 2013-29 (Third-Party Relationships) and FDIC FIL-44-2008 (Third-Party Risk Management), this creates a material vendor risk that must be disclosed to examiners.

SecureBase's Sovereign Cloud architecture eliminates this risk:

| Concern | Generic SaaS | SecureBase Sovereign Cloud |
|---|---|---|
| Data residency | Vendor's multi-tenant cloud | Customer's own AWS account |
| Encryption key control | Vendor holds keys | Customer holds KMS CMK |
| Evidence tampering risk | Vendor DB could be altered | S3 Object Lock (Compliance mode) prevents modification |
| Regulatory disclosure | Must disclose to OCC/FDIC as critical vendor | Architecture aligns with OCC 2013-29 guidance |
| Data export on termination | Vendor-dependent | All evidence in customer's S3; no migration needed |
| Sub-processor risk | Vendor's sub-processors (AWS + others) | Customer is AWS account holder directly |

### Sovereign Cloud Messaging for Sales Calls

> *"When a Texas bank examiner or OCC examiner asks 'where is your compliance evidence stored?', you tell them: it's in our S3 bucket, in our AWS account, in us-east-1. Encrypted with our KMS key. We can prove the key ID right now. SecureBase has never touched it. That's a fundamentally different answer from 'it's in our GRC vendor's cloud.'"*

**For OCC/FDIC-chartered banks specifically:**
> *"We've structured SecureBase to satisfy OCC 2013-29. We're a critical vendor — and we know it. We've completed your due diligence package: SOC 2 Type II, BCP summary, penetration test executive summary, and a Sovereign Cloud architecture brief. We can have the full package to your vendor risk committee in 24 hours."*

### Pricing Narrative: Not "Cheap SaaS," But "Infrastructure Investment"

Position the price as infrastructure, not SaaS subscription:

> *"You're not buying a subscription to a dashboard. You're deploying a compliance-grade data collection infrastructure inside your own AWS account. When you stop paying SecureBase, your evidence stays in your S3 bucket. You own it. That's how infrastructure works — it's not like turning off a SaaS tool and losing your data."*

---

## Database Schema Mapping

The SecureBase Lambda maps customer transaction fields to the `tx_transaction_records` table. Customers provide a `schema_mapping.json` file during onboarding.

### Required Field Mappings (TX-MT-R1)

| SecureBase Field | CFR Requirement | Customer Source | Example Column |
|---|---|---|---|
| `transaction_id` | Unique identifier | Transaction DB | `id`, `txn_id`, `reference_number` |
| `transaction_timestamp` | Date/time | Transaction DB | `created_at`, `txn_date` |
| `amount_usd` | Amount | Transaction DB | `amount`, `usd_amount` |
| `sender_name` | Sender full name | Transaction DB or CIP | `sender_name`, `from_name` |
| `sender_id_type` | Government ID type | CIP system | `id_type`, `verification_type` |
| `sender_id_number` | Government ID (hashed) | CIP system | HMAC-SHA256 hashed with per-customer salt (Secrets Manager) before storage |
| `recipient_name` | Recipient name | Transaction DB | `recipient_name`, `to_name` |
| `payment_method` | Method | Transaction DB | `payment_method`, `channel` |
| `fee_charged` | Fee | Transaction DB | `fee`, `service_fee` |
| `receipt_number` | Receipt/confirmation | Transaction DB | `receipt_id`, `confirmation_number` |
| `texas_nexus` | TX connection flag | Derived | `state = 'TX'` or boolean |

---

## Deployment Guide

### Prerequisites

| Requirement | Detail |
|---|---|
| AWS Account | Customer must have AWS account |
| Transaction DB | PostgreSQL 12+ or MySQL 8+ |
| AML System | Unit21, Sardine, or custom webhook |
| KYC/CIP System | Alloy, Socure, or Jumio |
| S3 Bucket | Object Lock-enabled bucket |
| KMS Key | RSA-4096 CMK for evidence signing |

### Step-by-Step: 48-Hour Onboarding

**Hour 0–4: Database Schema Mapping**
```bash
curl -O https://docs.securebase.io/onboarding/schema_mapping_template.json
# Fill in field mappings, then:
POST /api/onboarding/schema-mapping
Authorization: Bearer <onboarding_token>
```

**Hour 4–12: VPC Peering or API Webhook Setup**
```bash
# Option A — VPC Peering:
# Customer initiates in AWS Console:
# VPC → Peering Connections → Create Peering Connection
# Accepter: SecureBase VPC ID (provided during onboarding)

# Option B — AML Webhook (Unit21):
POST https://app.unit21.ai/api/v1/webhooks
{
  "url": "https://api.securebase.tximhotep.com/fintech/webhook/<customer_id>/unit21",
  "events": ["alert.created", "case.filed", "ctr.filed"],
  "secret": "<provided_by_securebase>"
}
```

**Hour 12–24: S3 + KMS Setup**
```bash
aws s3api create-bucket \
  --bucket securebase-evidence-<customer_id> \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

aws s3api put-object-lock-configuration \
  --bucket securebase-evidence-<customer_id> \
  --object-lock-configuration '{
    "ObjectLockEnabled":"Enabled",
    "Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":1826}}
  }'

aws kms create-key \
  --key-usage SIGN_VERIFY \
  --key-spec RSA_4096 \
  --description "SecureBase FFIEC evidence signing key"
```

**Hour 24–48: Lambda Deployment + POC Collection**
```bash
# Trigger on-demand collection for POC period
POST /fintech/collect
Authorization: Bearer <api_key>
{
  "customer_id": "<uuid>",
  "controls": ["TX-MT-R1", "TX-MT-R2a", "TX-MT-R2b", "TX-MT-R3"],
  "start_date": "2025-01-01",
  "end_date": "2025-03-31",
  "sample_size": 500
}
```

---

## API Reference

### Evidence Collection
```
POST /fintech/collect
Authorization: Bearer <api_key>
{ "customer_id": "uuid", "controls": [...], "start_date": "...", "end_date": "..." }

Response 200: { "collection_id", "compliance_scores", "evidence_s3_keys" }
```

### Examiner Package Generation
```
POST /fintech/examiner-export
Authorization: Bearer <api_key>
{ "customer_id": "uuid", "period_start": "...", "period_end": "...", "examiner_name": "...", "examiner_email": "..." }

Response 200: { "export_reference", "s3_key", "package_hash", "signature", "record_counts" }
```

### FFIEC CAT Status
```
GET /fintech/cat-status?customer_id=<uuid>
Authorization: Bearer <api_key>

Response 200: {
  "overall_maturity": "intermediate",
  "domains": [
    { "domain_id": "cybersecurity_controls", "maturity": "intermediate", "score": 81.0, "findings": 2 },
    ...
  ],
  "last_collected": "2026-05-01T03:00:00Z"
}
```

### Compliance Status
```
GET /fintech/compliance-status?customer_id=<uuid>
Authorization: Bearer <api_key>

Response 200: { "overall_score": 94.2, "controls": [...] }
```

---

## Multi-Region Considerations

For Fintech Elite / Enterprise customers:

| State | Regulator | Additional Controls |
|---|---|---|
| **Texas** | TX DOB + FinCEN | TX-MT-R1 through TX-DASP-R1 (fully automated) |
| **New York** | NY DFS (Part 504) | SAR lookback period, transaction monitoring program |
| **California** | CA DFPI | CA-specific CIP requirements |
| **Florida** | FL OFR | FL Chapter 560 recordkeeping |

Multi-state coverage is included in Fintech Elite ($12,000/month).

---

## Security Architecture Summary

| Data Type | Location | Access |
|---|---|---|
| Raw transaction records | Customer RDS/Aurora read replica | Read-only Lambda query |
| PII (names, IDs) | Customer database — never exported | HMAC-SHA256 hashed (per-customer salt) before leaving VPC |
| Evidence records | SecureBase Aurora (`tx_*` tables) | RLS per `customer_id` |
| Evidence packages | Customer's S3 bucket (Object Lock) | Examiner Portal only |
| Signing keys | Customer's KMS (CMK) | Lambda IAM role only |

**IAM: Principle of Least Privilege**
- Lambda execution role: `secretsmanager:GetSecretValue`, `kms:Sign`, `kms:GetPublicKey`, `s3:PutObject` only
- No `s3:DeleteObject`, no `rds:*` write, no `iam:*`
- Customer DB user: `SELECT` only; no `INSERT`, `UPDATE`, `DELETE`

---

## References

| Resource | Location |
|---|---|
| FFIEC Sales Playbook | [`docs/FFIEC_SALES_PLAYBOOK.md`](./FFIEC_SALES_PLAYBOOK.md) |
| Texas Fintech Compliance | [`docs/TEXAS_FINTECH_COMPLIANCE.md`](./TEXAS_FINTECH_COMPLIANCE.md) |
| Compliance Lambda | `phase2-backend/functions/texas_fintech_compliance_collector.py` |
| Metrics Aggregation Lambda | `phase2-backend/functions/metrics_aggregation.py` |
| CAT Dashboard Component | `src/components/FFIECCATDashboard.jsx` |
| Control Mapping Component | `src/components/compliance/FFIECControlMapping.jsx` |
| Database Schema | `phase2-backend/database/migrations/005_texas_fintech_compliance.sql` |
| FFIEC IT Examination Handbooks | https://ithandbook.ffiec.gov/ |
| FFIEC CAT Official Tool | https://www.ffiec.gov/cyberassessmenttool.htm |
| OCC Bulletin 2013-29 | https://www.occ.gov/news-issuances/bulletins/2013/bulletin-2013-29.html |

---

*Maintained by: SecureBase Engineering · Questions: compliance-tech@securebase.io · Last updated: May 2026*
