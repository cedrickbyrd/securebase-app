# SecureBase: Live Demo Portal, GitHub Marketplace Action & Supabase Architecture

**Entity:** TxImhotep LLC  
**Product:** SecureBase Compliance Control Plane (`demo.securebase.tximhotep.com`)  
**Ecosystem Motion:** Product-Led Growth (PLG) & Shift-Left Developer Governance  
**Persistence & Auth Plane:** Supabase (PostgreSQL + PostgREST + Auth + Row-Level Security)  
**Integration Scope:** Web Interactive Sandbox $\longleftrightarrow$ Supabase Operational Data Plane $\longleftrightarrow$ GitHub Marketplace Action CI/CD Engine  

---

## 1. High-Level Overview: `demo.securebase.tximhotep.com`

`demo.securebase.tximhotep.com` functions as TxImhotep’s primary **Top-of-Funnel (TOFU) Interactive Validation Sandbox**. Rather than requiring enterprise prospects (e.g., regional bank CISOs, healthcare security directors, defense contractors) to sit through static slide decks or wait for sales-assisted provisioning, the demo portal provides immediate, self-guided proof of the **SecureBase Compliance Control Plane**.

### Core Platform Capabilities Demonstrated in the Demo
1. **Continuous Regulatory Mapping:**
   * Live posture scoring and crosswalks against **FFIEC IT Examination Booklets** (Information Security §II.A–E, Business Continuity), **HIPAA Security Rule** (45 CFR §164.312 Technical Safeguards), and **FedRAMP High / NIST SP 800-53 Rev. 5**.
2. **Cryptographic WORM Audit Defense:**
   * Demonstrates automated evidence collection, tamper-evident SHA-256 digital digest generation, and immutable 7-year storage locking via AWS S3 Object Lock (`securebase-vault-logs`).
3. **Friction Acceptance Governance Engine:**
   * Proves that privileged security overrides and configuration exceptions are not silently permitted or bypassed, but captured through cryptographic justification gates and board-reportable audit trails.
4. **Zero Third-Party Telemetry Egress:**
   * Highlights the sovereign in-tenant model: metadata is evaluated locally without customer ePHI, banking transactions, or confidential payload data leaving the security perimeter.

---

## 2. Factoring in Supabase: The Operational & State Plane

While immutable, finalized audit manifests and compliance binders are anchored in AWS S3 WORM Object Lock for statutory defense, **Supabase** operates as the low-latency, transactional operational plane powering both `demo.securebase.tximhotep.com` and the developer lifecycle.

```
                    DEVELOPER WORKSPACE (Shift-Left)
            ┌──────────────────────────────────────────────┐
            │   Developer submits Pull Request with IaC    │
            │          (Terraform / OpenTofu)              │
            └──────────────────────┬───────────────────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────────┐
            │       GitHub Marketplace Action              │
            │      (`securebase/compliance-action`)        │
            │  • Validates `terraform plan` locally        │
            │  • Evaluates guardrails against cached policy│
            │  • Generates signed scan execution summary   │
            └──────────────┬───────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             │ REST / PostgREST (HMAC)   │ (Pass/Fail Evidence Payload)
             ▼                           ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│       SUPABASE (Postgres)    │       │     AWS S3 WORM VAULT        │
│ • Row-Level Security (RLS)   │       │ • SHA-256 Signed Digest      │
│ • Ephemeral Sandbox Sessions │       │ • Immutable 7-Year Lock      │
│ • Audit Run History & Diff   │       │ • Regulatory Examination     │
│ • Realtime Webhook Broadcast │       └──────────────▲───────────────┘
└──────────────┬───────────────┘                      │ (Daily Anchor)
               │                                      │
               │ Supabase Realtime (WebSockets)       │
               ▼                                      │
┌─────────────────────────────────────────────────────┴────────┐
│               demo.securebase.tximhotep.com                  │
│ • Live UI updates via Postgres Realtime subscriptions        │
│ • Anonymous demo tenancy isolated via RLS guest session tokens│
│ • "Try Your Own PR" live inspection sandbox                  │
└──────────────────────────────────────────────────────────────┘
```

### Strategic Roles of Supabase in the Architecture:
1. **Dynamic Demo Session Isolation (Row-Level Security):**
   * Demo visitors can simulate scans, adjust compliance policies, and toggle regulatory frameworks without contaminating shared state or seeing other visitors' data. Supabase RLS enforces strict `tenant_id` and anonymous guest session isolation (`anon` JWTs).
2. **Postgres Realtime for CI/CD Feedback Loops:**
   * When a developer runs the GitHub Action or runs a simulated PR scan in the demo sandbox, Supabase Realtime broadcasts the scan ingestion event over WebSockets directly to the web dashboard, updating compliance radar charts in sub-200ms.
3. **Bridge Between Fast Metadata and Immutable WORM:**
   * Supabase stores fast relational operational data (run timestamps, target repositories, rule pass/fail summaries, user exception workflows), while storing the SHA-256 fingerprint that points to the raw immutable manifest stored in AWS S3 Object Lock.
4. **Developer Auth & Marketplace Claiming:**
   * Supabase Auth (GitHub OAuth integration) allows developers who install the GitHub Action to claim their demo session, linking their organization's repository runs to an executive workspace without friction.

---

## 3. Relationship to the GitHub Marketplace Action

While `demo.securebase.tximhotep.com` serves the **executive, risk, and audit persona** (CISO, CRO, external 3PAO / FDIC examiner), the **SecureBase GitHub Marketplace Action** serves the **builder persona** (DevOps, Platform Engineers, Cloud Architects).

### The Architectural Handshake
1. **Pre-Flight IaC Validation (`validate_terraform_plan`):**
   * The GitHub Action runs in the customer’s CI/CD pipeline, parsing Terraform plans before `terraform apply`. It evaluates infrastructure against SecureBase’s pre-hardened baseline policies.
2. **Telemetry Ingestion via Supabase Edge Function / PostgREST:**
   * The GitHub Action dispatches a lightweight JSON telemetry envelope (sanitized policy violations, check summary, signed commit metadata) to a SecureBase Supabase Edge Function using an API key or ephemeral GitHub OIDC token.
   * Supabase writes the run to the `ci_scans` table and triggers a Realtime notification.
3. **The PLG Funnel Linkage:**
   * **Demo Site $\rightarrow$ Action:** A prospect testing the web portal sees: *"Enforce these guardrails in your PRs today — Install the GitHub Action in 60 seconds."*
   * **Action $\rightarrow$ Demo Site / SaaS:** Developers installing the free GitHub Action receive a CLI/PR summary output pointing back to `demo.securebase.tximhotep.com` with a deep-linked run ID (`demo.securebase.tximhotep.com/runs/:id`), immediately surfacing their PR's compliance posture in the executive interface.

---

## 4. Prioritized Improvement Backlog for `demo.securebase.tximhotep.com`

### Phase 1: Supabase Integration & Interactive Feedback (P0 — Immediate)

- [ ] **Supabase Schema & RLS Policy Implementation:**
  * Provision tables: `demo_tenants`, `ci_scans`, `compliance_findings`, and `framework_mappings`.
  * Configure RLS policies allowing anonymous guest sessions to insert and read only their own simulated scans (`session_id = current_setting('request.jwt.claim.session_id')`).
- [ ] **Supabase Realtime Stream in Demo Dashboard:**
  * Replace static mock data with a Supabase Realtime channel subscription listening to `ci_scans`. When a mock CI/CD scan executes, stream findings directly into the UI table.
- [ ] **Interactive CI/CD Simulation Sandbox ("The Drift Playground"):**
  * Split-screen view: Left side displays a mock Terraform diff (`main.tf` with an unencrypted S3 bucket or open security group); clicking "Trigger GitHub Action" writes to Supabase and streams live remediation HCL to the right pane.
- [ ] **One-Click Framework Toggle:**
  * Allow visitors to switch between **Texas Banking (FFIEC CAT/IT Handbook)**, **Healthcare (HIPAA §164.312)**, and **Defense (FedRAMP High / NIST 800-53)**, using Supabase-stored mapping vectors to re-index the compliance score.
- [ ] **Direct GitHub Action Installation Callout:**
  * Place a high-visibility badge: *"Shift-Left with SecureBase: Add to GitHub Actions (Free Developer Tier)"* linked directly to the GitHub Marketplace repo/action.

### Phase 2: Security, Performance & Storage Hybridization (P1 — Production Polish)

- [ ] **Dual-Storage Engine (Supabase Metadata + S3 WORM Anchor):**
  * Configure Supabase Edge Function to store structured scan results in Postgres while generating an HMAC-SHA256 digest and asynchronous upload of the raw audit JSON to the AWS S3 Object Lock bucket.
- [ ] **GitHub OIDC Token Verification in Supabase Edge Functions:**
  * Implement zero-secret authentication for the GitHub Action by exchanging GitHub's OIDC token (`id-token: write`) for a scoped Supabase session.
- [ ] **Sample Audit Binder Generator:**
  * Enable visitors to click *"Download Examiner Binder (PDF/JSON)"* to generate a formatted sample FDIC/OCR audit report using data fetched directly from the visitor's Supabase session.

### Phase 3: Commercial & AWS Marketplace Funnel Alignment (P2 — Mid-Term)

- [ ] **GitHub OAuth & Tenant Claiming:**
  * Add a "Save Workspace & Link GitHub Repo" button using Supabase Auth (GitHub Provider), migrating ephemeral guest sessions into permanent enterprise evaluation accounts.
- [ ] **AWS Marketplace Private Offer & Co-Sell CTA Integration:**
  * Seamlessly connect the demo’s terminal state to the `$4,000 Paid Sandbox Pilot` via AWS Marketplace (Product ID: `prod-p7z4iqf7gg6dk`), displaying the *"Net +$1,000 with AWS WAR Credit"* promotional calculation.
- [ ] **UTM Parameter & Lead Routing Instrumentation:**
  * Capture incoming campaign referrals (`utm_source`, `utm_campaign`) in the Supabase `demo_tenants` table to dynamically customize the demo welcome banner with the visitor's company name and vertical.