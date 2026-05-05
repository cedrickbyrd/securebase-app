# SecureBase FFIEC Sales Playbook

**Version:** 2.0  
**Owner:** SecureBase GTM Team  
**Audience:** Account Executives, Sales Engineers, SDRs  
**Updated:** May 2026

---

## Section 1 — Executive Summary

### Market Opportunity

The FFIEC (Federal Financial Institutions Examination Council) supervises ~10,000 federally chartered and state-chartered financial institutions in the United States. Every one of these institutions is subject to mandatory IT and cybersecurity examinations against the FFIEC IT Examination Handbooks and the Cybersecurity Assessment Tool (CAT). The Texas market alone includes:

- ~850 active Texas Money Transmitter License (MTL) holders (NMLS data)
- ~200 active or pending Texas DASP (Digital Asset Service Provider) license holders
- ~300+ Texas-chartered banks and credit unions subject to Texas DOB IT examination
- ~4,500+ community banks across the FFIEC's five member agencies nationally

**The pain:** Every regulated institution completes FFIEC CAT manually — a 3-month spreadsheet exercise, typically led by a consulting firm at $150K–$300K per engagement. No software product automates FFIEC CAT today.

**SecureBase's position:** The platform already collects the AWS telemetry (CloudTrail, Config, GuardDuty, Security Hub) that FFIEC CAT assessment statements map to. FFIEC coverage is not a new product — it is a regulatory *lens* over infrastructure evidence we already collect for SOC 2 and HIPAA customers.

### Capability Confirmation

**SecureBase is architecturally capable of auto-mapping FFIEC IT Handbook metrics.** The Phase 6 Compliance Automation roadmap is the formal delivery vehicle, but:

| Component | Status | FFIEC Relevance |
|---|---|---|
| Evidence ingestion pipeline (CloudTrail → Lambda → DynamoDB) | ✅ Live | Provides telemetry for CAT Domain 3: Cybersecurity Controls |
| ComplianceDrift component (drift timeline + MTTR analytics) | ✅ Live | Maps to CAT Domain 5: Cyber Incident Management & Resilience |
| TenantDashboard compliance engine (framework score cards) | ✅ Live | Displays CAT maturity per domain |
| `FFIECCATDashboard` component | ✅ Built | Real-time CAT maturity levels from AWS telemetry |
| `FFIECControlMapping` component | ✅ Built | Telemetry→IT Handbook section mapping panel |

### Why SecureBase Wins

1. **Sovereign / Regional Cloud architecture** — data stays in the customer's AWS account (jurisdiction preserved); no multi-tenant SaaS data co-mingling
2. **Auto-mapped CAT** — turns a 3-month manual exercise into a real-time dashboard
3. **Examiner-ready evidence packages** — KMS-signed, tamper-proof, one-click generation
4. **BSA/AML built in** — the only platform automating CTR/SAR evidence AND FFIEC IT Handbook controls
5. **No new infrastructure** — FFIEC coverage rides on top of the existing AWS SOC 2 landing zone

---

## Section 2 — Market & Buyer Profiles

### 7 FFIEC IT Handbook Domains → SecureBase Coverage

| FFIEC IT Handbook | Domain | SecureBase Coverage |
|---|---|---|
| **IS** | Information Security | ✅ Full — KMS, TLS, IAM, CloudTrail |
| **BCP** | Business Continuity Planning | ✅ Full — Aurora Global, Route 53, DR runbooks |
| **VM** | Vendor Management | ✅ Full — SCPs, IAM Access Analyzer, cross-account controls |
| **CS** | Cybersecurity (2015 Statement) | ✅ Full — GuardDuty, Security Hub, WAF, VPC Flow Logs |
| **OPS** | Operations | ✅ Partial — Config drift, CloudWatch, EventBridge |
| **E-Banking** | Electronic Banking | 🔜 Phase 6 — API Gateway + WAF coverage |
| **FedLine** | FedLine Security | 🔜 Phase 6 — Scoped for Federal Reserve member banks |

### CAT Domains → SecureBase Coverage

| CAT Domain | SecureBase AWS Sources | Current Maturity |
|---|---|---|
| 1: Cyber Risk Management & Oversight | IAM, Organizations SCPs, SSO | Intermediate |
| 2: Threat Intelligence & Collaboration | GuardDuty, Security Hub | Evolving |
| 3: Cybersecurity Controls | Config, Security Hub, KMS, VPC Flow Logs | Intermediate |
| 4: External Dependency Management | Organizations, IAM Access Analyzer | Evolving |
| 5: Cyber Incident Management & Resilience | CloudTrail, GuardDuty, EventBridge, Route 53 | Intermediate |

### 5-Persona Buyer Matrix

| Persona | Title | Institution Type | Primary Pain | Buy Signal |
|---|---|---|---|---|
| **P1 — Bank CCO** | Chief Compliance Officer | Community / regional bank | Manual CAT spreadsheet; examiner findings on cyber controls | DOB / OCC examination scheduled in next 12 months |
| **P2 — Money Transmitter CCO** | Chief Compliance Officer / VP Compliance | Texas MTL holder (fintech, remittance, neo-bank) | $50K+ exam prep; manual CTR/SAR evidence; CIP gaps | DOB examination date received or MTL renewal pending |
| **P3 — DASP CCO** | Chief Compliance Officer | Digital Asset Service Provider | HB 1666 fund segregation unaudited; no automated DASP controls | DASP license granted or under review |
| **P4 — CTO/VP Eng** | VP Engineering, CTO | Fintech (any size) | Engineering team asked to support compliance evidence requests; no AWS compliance tooling | Series A/B funding closed; enterprise customer demands SOC 2 + FFIEC |
| **P5 — CEO (SMB)** | CEO / Founder | Community bank, credit union, MTL <50 employees | Personal liability for exam failures; no compliance staff | Received examiner MRA (Matter Requiring Attention) |

### ICP by Firmographic

| Signal | Target | Disqualify |
|---|---|---|
| **License** | Active TX MTL, TX DASP, FDIC/OCC-chartered bank | No regulated license |
| **AWS usage** | Active AWS account | GCP/Azure only (no AWS integration path) |
| **Annual compliance spend** | $100K–$500K | <$50K (under-resourced to act) |
| **Exam frequency** | 18–24 months (TX DOB), annual (OCC/FDIC) | No exam history |
| **Employee count** | 15–500 | Solo operators; enterprise (>500 with existing GRC suite) |

### Behavioral Triggers (Immediate Outreach)

| Trigger | Source | Response |
|---|---|---|
| DOB examination notice received | LinkedIn, TDSML enforcement DB | Outreach within 24 hours |
| OCC/FDIC enforcement action published | FFIEC public enforcement database | Personalized outreach with relevant finding |
| MTL granted (new) | NMLS weekly updates | Welcome sequence: "Start exam-ready" |
| CAT-related job posting | LinkedIn | CCO or VP Compliance hiring = compliance tooling budget |
| Texas Bankers Association event | TBA calendar | Pre-event outreach + booth presence |

---

## Section 3 — Platform Capabilities

### FFIEC Auto-Mapping Engine Architecture

```
AWS Telemetry Sources
  ├── CloudTrail (management + data events)
  ├── AWS Config (rule evaluations + conformance packs)
  ├── GuardDuty (threat detections by severity)
  ├── Security Hub (findings, standards compliance scores)
  ├── IAM Access Analyzer (external + cross-account access)
  ├── VPC Flow Logs (network traffic anomalies)
  └── Aurora audit logs (DB access + query patterns)
         │
         ▼ (daily Lambda: metrics_aggregation.py)
  DynamoDB: securebase-compliance-violations
         │
         ▼
  FFIEC CAT Maturity Engine (FFIECCATDashboard.jsx)
  ├── Domain 1–5 maturity levels (Baseline → Innovative)
  ├── Assessment factor scores per domain
  └── Drill-down: AWS evidence → FFIEC IT Handbook section
         │
         ▼
  FFIEC Control Mapping Panel (FFIECControlMapping.jsx)
  ├── IS §II.A → Organizations SCPs + IAM Identity Center
  ├── IS §II.C → S3 encryption + Aurora KMS + TLS 1.3
  ├── IS §II.D → MFA + IAM Access Analyzer
  ├── IS §II.E → CloudTrail Object Lock + log validation
  ├── BCP §II.B → Aurora Global + Route 53 health checks
  ├── BCP §III.A → GuardDuty + EventBridge + PagerDuty
  ├── VM §II.A → SCPs + cross-account role analysis
  └── CS §I.B → Inspector vulnerability findings
         │
         ▼
  One-click Examiner Evidence Package (KMS-signed, S3 Object Lock)
```

### 7-Step Assessment Flow (mirrors HIPAA flow)

1. **Ingest** — Lambda attaches to customer VPC, connects to read replica
2. **Collect** — Daily evidence collection across all active CAT domains
3. **Map** — Evidence mapped to FFIEC IT Handbook sections + CAT statements
4. **Score** — Maturity level calculated per domain (Baseline → Innovative)
5. **Drift** — ComplianceDrift detects regressions vs. prior assessment
6. **Alert** — MTTR analytics for each domain's open findings
7. **Package** — One-click examiner evidence package (PDF + CSV, KMS-signed)

### Drift Detection

The `ComplianceDrift` component displays a 90-day timeline showing:
- Maturity level changes per CAT domain
- New findings introduced (regression events)
- Findings resolved (improvement events)
- Mean Time to Remediate (MTTR) per domain

This gives the examiner a continuous evidence trail rather than a point-in-time snapshot.

### Auditor / Examiner Portal

Examiners receive a dedicated Cognito login that grants:
- Read-only access to the CAT dashboard for their assigned institution
- Transaction search (for TX-MT-R1 evidence)
- One-click evidence package download (CSV + PDF)
- No access to other customers' data (RLS enforced per `customer_id`)

### Sovereign Cloud Positioning

**This is the single most powerful differentiator against generic compliance SaaS tools:**

> *"SecureBase doesn't run your compliance in our cloud. Your AWS account IS the compliance platform. Every piece of evidence — every CloudTrail log, every Config evaluation, every CTR filing — lives in YOUR S3 bucket, encrypted with YOUR KMS key, in YOUR AWS region. When a Texas examiner asks for your data, you hand them a package from your own vault. We never touch it."*

Key messaging for banking buyers:
- **Data residency**: Evidence stays in the customer's AWS account (no cross-border data flows)
- **Jurisdictional control**: Customer holds the KMS key; SecureBase cannot decrypt evidence
- **No multi-tenancy risk**: Dedicated Lambda, dedicated S3 bucket, dedicated DynamoDB per customer
- **Regulatory alignment**: Satisfies OCC guidance on third-party cloud vendor risk (OCC 2013-29)

---

## Section 4 — Discovery & Qualification

### MEDDPPICC Framework (Banking-Adapted)

| Letter | Criterion | Banking-Specific Questions |
|---|---|---|
| **M** — Metrics | Quantify the pain | "What did your last examination cost in staff hours + consulting fees?" "How many findings did you receive?" |
| **E** — Economic Buyer | CCO with budget authority | "Who owns your IT security examination budget? Is that separate from your compliance budget?" |
| **D** — Decision Criteria | Must-have requirements | "What would a passing examiner report require that you can't produce today?" |
| **D** — Decision Process | Approval chain | "Does your board's audit committee approve compliance tooling purchases?" |
| **P** — Paper Process | Procurement/vendor mgmt | "Do you have a vendor due diligence process? We have a SOC 2 Type II report ready." |
| **P** — Identify Pain | Quantified problem | "Have you ever received an MRA? What was the remediation cost?" |
| **I** — Champion | Internal sponsor | "Who is the person inside your institution who will own the relationship with us?" |
| **C** — Competition | Current solution | "Are you using Ncontracts, Archer, or a spreadsheet today?" |
| **C** — Close Plan | Defined next steps | "What does your board approval timeline look like? Can we present at the next audit committee meeting?" |

### 12+ Pain-Based Discovery Questions

1. *"When was your last DOB/OCC/FDIC IT examination? How did it go?"*
2. *"How many staff hours did your team spend preparing for the last exam?"*
3. *"Have you ever received a Matter Requiring Attention (MRA) or a Matters Requiring Board Attention (MRBA)?"*
4. *"Walk me through how you complete your FFIEC CAT today. Do you use a spreadsheet?"*
5. *"Who is responsible for keeping the CAT current between examinations?"*
6. *"If an examiner walked in tomorrow and asked for your CTR filing evidence for Q4 2025, how long would it take you to produce it?"*
7. *"What AML system do you use? How does your team pull SAR/CTR evidence from it for the examiner?"*
8. *"Do you have a dedicated compliance team, or does this fall on IT/Engineering?"*
9. *"Your examiners are increasingly asking about cloud controls. How are you documenting your AWS security posture for them?"*
10. *"Are you subject to HB 1666 (digital asset fund segregation)? How are you tracking that today?"*
11. *"What's your RTO/RPO target? Have you ever tested your failover? How do you document that for BCP §II.B?"*
12. *"What would it mean to your CCO personally if the next exam came back with zero findings?"*

---

## Section 5 — Objection Handling

### Objection 1: "We already use Ncontracts / Archer / AuditBoard"

> *"Those are strong GRC platforms for policy management and risk register tracking. They don't collect live AWS telemetry. Ncontracts doesn't know whether your S3 buckets are encrypted right now — it only knows what you told it in the questionnaire six months ago. SecureBase pulls the actual Config rule evaluation results every day. When your examiner asks 'is your data encrypted at rest?' we show them a real-time AWS Config finding, not a checkbox you filled in last year."*

**Follow-up:** *"We actually integrate with GRC tools via API. If you're already using Ncontracts, we can push our AWS telemetry results into your risk register automatically."*

### Objection 2: "Our examiners don't accept automated evidence"

> *"That was true in 2018. Today, FDIC, OCC, and Texas DOB examiners are specifically trained on the FFIEC CAT. Our evidence packages are structured exactly how the CAT assessment statements are framed — each finding links directly to the handbook section it satisfies. The package is KMS-signed and stored in S3 with Object Lock, which means it's tamper-evident. Examiners prefer this over a spreadsheet because they can verify integrity themselves."*

**Reference:** FFIEC IT Examination Handbook updates (2021) explicitly acknowledge cloud-based evidence collection.

### Objection 3: "We don't have the resources to implement this"

> *"Implementation is 48 hours, not 6 months. We deploy a Terraform module that creates a read-only connection to your AWS account. Your team doesn't write a line of code. We have one customer — a 35-person money transmitter — whose entire onboarding was handled by their one-person IT team in two days."*

**Offer:** *"Let us do a 2-week POC at no cost. We'll connect to your staging database, run evidence collection, and show you a complete examiner package. If accuracy is below 90%, there's no obligation."*

### Objection 4: "We're a community bank — this is for fintechs"

> *"Community banks are actually our fastest-growing segment right now. The FFIEC CAT was designed for all sizes of institution — and smaller banks often have fewer compliance staff to complete it manually. The fact that you're a $400M community bank doesn't reduce your examination obligations. If anything, community banks receive more scrutiny per dollar of assets than the big four."*

**Pricing note:** Community Bank tier starts at $2,000/month with a 6-month pilot at $1,000/month.

### Objection 5: "We're worried about a vendor having access to our audit data"

> *"This is exactly why we built SecureBase with a Sovereign Cloud architecture. SecureBase never touches your audit data. Your evidence lives in your AWS account, encrypted with your KMS key. We deploy a read-only Lambda function that collects the evidence and stores it in your S3 bucket. We can't read what's in that bucket. When you hand the examiner a package, it comes from your vault — not ours. This satisfies OCC 2013-29 third-party cloud guidance."*

---

## Section 6 — Competitive Positioning

### 6-Competitor Matrix

| Competitor | Category | What They Do | Why They Lose to SecureBase |
|---|---|---|---|
| **Ncontracts** | GRC SaaS | Policy management, vendor risk, exam tracking | No live AWS telemetry; questionnaire-based only; no automated CAT mapping |
| **Archer (RSA)** | Enterprise GRC | Risk register, audit management, compliance workflows | $300K+ implementation; no cloud infrastructure evidence; too heavyweight for <500 employees |
| **AuditBoard** | Audit Management | SOC audits, operational audits, risk management | SOC 2 focused; no FFIEC CAT; no AWS telemetry; no examiner package generation |
| **Vanta** | Compliance Automation | SOC 2, ISO 27001, HIPAA automation | No BSA/AML; no FFIEC; no examiner packages; no Sovereign Cloud architecture |
| **TrustCloud** | GRC Platform | Trust reports, compliance automation | No banking/FFIEC focus; no AWS-native evidence collection |
| **Build Internal** | DIY | Custom SQL queries, Excel, consulting | $200K+ build cost; 6–12 months; no ongoing collection; exam failures while building |

### Battlecard: SecureBase vs. Ncontracts

| Feature | SecureBase | Ncontracts |
|---|---|---|
| Live AWS telemetry collection | ✅ Daily, automated | ❌ Questionnaire-based |
| FFIEC CAT auto-mapping | ✅ Real-time dashboard | ❌ Manual scoring |
| CTR/SAR evidence collection | ✅ Automated | ❌ Not available |
| Examiner package generation | ✅ One-click, KMS-signed | ❌ Not available |
| Sovereign Cloud architecture | ✅ Data stays in customer AWS | ❌ Multi-tenant SaaS |
| Implementation time | 48 hours | 3–6 months |
| Price (comparable tier) | $7,500/month | $30,000–$80,000/year |
| SOC 2 Type II report | ✅ Available | ✅ Available |

---

## Section 7 — Sales Process

### ICP Tiers

| Tier | Institution | Monthly Price | Pilot Price |
|---|---|---|---|
| **Community Bank** | TX-chartered bank <$1B assets | $2,000 | $1,000 (6 mo) |
| **Regional / MTL** | TX-chartered bank $1B–$10B, or MTL holder | $7,500 | $5,000 (6 mo) |
| **Enterprise / DASP** | Multi-state MT, DASP, or bank >$10B assets | $12,000 | $8,000 (6 mo) |

### 7-Stage Sales Motion

| Stage | Activity | Owner | Duration | Exit Criteria |
|---|---|---|---|---|
| **1 — Trigger-Based Outreach** | NMLS/TDSML trigger → personalized email referencing license # or recent enforcement | SDR | Day 1 | Reply or 3x follow-up |
| **2 — Discovery Call** | 30-min call: MEDDPPICC questions, qualify pain, confirm AWS usage | AE | Day 3–7 | Quantified pain, economic buyer identified |
| **3 — Regulatory Briefing** | 60-min: SOC 2 report walkthrough, Sovereign Cloud architecture, FFIEC control mapping demo | AE + SE | Day 10–14 | Vendor due diligence package accepted |
| **4 — Demo** | 45-min: Live FFIEC CAT dashboard, examiner package generation, drift detection | SE | Day 14–21 | "This is what we've been looking for" |
| **5 — POC** | 2-week: Connect to staging DB, run evidence collection, validate accuracy | SE + Customer IT | Day 21–35 | ≥90% evidence accuracy, customer validates |
| **6 — Proposal & Negotiation** | Present commercial proposal; offer annual prepay (20% discount) or pilot | AE | Day 35–45 | Signed order form or verbal commit |
| **7 — Onboarding** | 48-hour technical setup; connect to production; kickoff with CCO | SE + CSM | Day 45–47 | First examiner package generated |

### Trigger-Based Outreach Templates

**Template A — Post-Examination MRA:**
> Subject: [Company] — addressing your recent DOB finding on [control]
>
> I saw the Texas DOB enforcement notice for [Company] published last week. The finding on [citation] is one of the three most common issues we see with Texas money transmitters.
>
> SecureBase automates the evidence collection for exactly this control — CTR filing completeness, CIP records, transaction recordkeeping. Our customers generate a DOB examiner package in 30 seconds.
>
> Would a 20-minute call this week be useful? I can show you how [peer company] addressed the same finding.

**Template B — Texas Bankers Association Source:**
> Subject: FFIEC CAT — turning a 3-month spreadsheet into a real-time dashboard
>
> After your presentation at the TBA conference, I wanted to follow up on the FFIEC CAT discussion.
>
> Most of the community banks I talk to are still completing CAT in Excel. We've built a platform that maps your live AWS controls to CAT assessment statements automatically — so when the next examination comes, the CAT is already done.
>
> Would a 30-minute regulatory briefing (SOC 2 report + demo) fit your calendar this month?

---

## Section 8 — Demo Script (30 Minutes)

### Pre-Demo Setup
- Load `demo.securebase.tximhotep.com/compliance` in a fresh tab
- Set institution name: "First State Community Bank, N.A. — Texas"
- Pre-load FFIEC CAT dashboard with realistic maturity levels

### Opening (3 min)
> *"Before I show you anything — you mentioned in discovery that your last exam prep took [N] weeks and cost [N] in consulting. I want to make sure the next one is different. Let me show you what that looks like."*

### Act 1: FFIEC CAT Dashboard (8 min)

1. Open **FFIEC CAT Dashboard** tab
2. Show **overall maturity: Intermediate**
   > *"This is your FFIEC CAT score, live, based on what your AWS account is actually doing right now — not what you told a questionnaire."*
3. Click **Domain 3: Cybersecurity Controls** → expand
4. Show the AWS telemetry sources: Config rules, Security Hub, Macie
5. Click a domain finding → drill to FFIEC IT Handbook section
   > *"See this? Your S3 encryption finding links directly to IS §II.C in the handbook. When your examiner asks for encryption evidence, this is what you show them."*
6. Ask: *"Is your CAT currently in a spreadsheet? How often is it updated?"*

### Act 2: BSA/AML Evidence (8 min)

1. Navigate to **Compliance → TX-MT-R2: CTR Filing**
2. Show CTR compliance table: "3 CTRs — all filed within 15-day window"
3. Click one CTR → show FinCEN tracking ID, filing date, transaction chain
4. Navigate to **Structuring Detection** → show sub-$10K pattern flag
   > *"We automatically detect structuring patterns — the kind of thing an examiner will ask about if they see a lot of $9,500 transactions."*
5. Ask: *"How are you monitoring for structuring today?"*

### Act 3: Examiner Package (7 min)

> *"Now — the moment that matters. An examiner walks in Monday morning."*

1. Click **Generate Examiner Package**
2. Enter: examiner name, email, date range (Q1 2026)
3. Watch 30-second generation
4. Open the PDF: cover page → control results → evidence manifest
5. Show KMS signature verification panel
   > *"This package is KMS-signed with your own AWS key. The examiner can verify its integrity. It's tamper-proof. This is what you hand them — not a folder of Excel files."*

### Act 4: Drift & Sovereign Cloud (5 min)

1. Show **ComplianceDrift** timeline — 90-day view
2. Point to a regression event: "Domain 2 dropped from Intermediate to Evolving on March 15"
3. Click → show root cause: "GuardDuty high-severity findings unresolved for 15+ days"
4. Close with Sovereign Cloud pitch:
   > *"One last thing — everything you've seen stays in your AWS account. Your S3 bucket. Your KMS key. Your region. SecureBase can't read your evidence. That's how we satisfy OCC 2013-29."*

### Closing (4 min)

> *"Based on what you've shown me, your next examination is in [timeframe]. We can have evidence collecting in 48 hours. What would it take to move this forward before [month]?"*

---

## Section 9 — Pricing Guidance

### Three-Tier Framework

| Tier | Target | Monthly | Annual (20% off) | Pilot (6 mo) |
|---|---|---|---|---|
| **Community Bank** | TX-chartered bank <$1B assets, credit union | $2,000 | $19,200 | $1,000/mo |
| **Regional / MTL** | Bank $1B–$10B, TX MTL (Fintech Pro) | $7,500 | $72,000 | $5,000/mo |
| **Enterprise / DASP** | Multi-state MT, DASP, bank >$10B (Fintech Elite) | $12,000 | $115,200 | $8,000/mo |

### ROI Framing by Tier

**Community Bank ($2,000/month = $24,000/year):**
- Typical CAT consulting engagement: $75,000–$150,000 per cycle
- Internal hours saved: 120 hrs × $150/hr = $18,000/exam
- ROI after 2 exams: 5x return

**Regional / MTL ($7,500/month = $90,000/year):**
- TX DOB exam prep (money transmitter): $40,000–$60,000 per exam
- Internal hours: 200 hrs × $250/hr = $50,000/exam
- ROI: breakeven Year 1; 60%+ savings Year 2+

**Enterprise / DASP ($12,000/month = $144,000/year):**
- Multi-state exam prep + DASP compliance: $200,000–$400,000/year
- ROI: 50–70% cost reduction

### Vendor Due Diligence Package (Pre-Requisite for Banking Sales)

Banking buyers must complete vendor due diligence before signing. Have these ready:

1. **SOC 2 Type II Report** — available upon NDA (current period)
2. **Sovereign Cloud Architecture Brief** — 2-page summary of data residency model
3. **Penetration Test Results** — last 12 months (redacted executive summary)
4. **Business Continuity Plan** — SecureBase platform BCP summary
5. **FFIEC IT Handbook Self-Assessment** — SecureBase's own CAT completion

Typical due diligence timeline: 2–4 weeks for community banks, 4–8 weeks for regional banks.

---

## Section 10 — Multi-Framework Overlap

### FFIEC + HIPAA Control Crosswalk

| Control Area | FFIEC IT Handbook | HIPAA Safeguard | SecureBase Evidence |
|---|---|---|---|
| Encryption at rest | IS §II.C | §164.312(a)(2)(iv) | S3 SSE-KMS, Aurora KMS |
| Encryption in transit | IS §II.C | §164.312(e)(2)(ii) | TLS 1.3, ALB policy |
| Access controls / MFA | IS §II.D | §164.312(d) | IAM Identity Center, MFA enforcement |
| Audit logging | IS §II.E | §164.312(b) | CloudTrail Object Lock, 7-year retention |
| Incident response | BCP §III.A | §164.308(a)(6) | GuardDuty + EventBridge response |
| Business continuity | BCP §II.B | §164.308(a)(7) | Aurora Global, Route 53 failover |
| Workforce training | IS §II.A | §164.308(a)(5) | IAM MFA enrollment rate |
| Vendor management | VM §II.A | §164.308(b)(1) | SCPs, BAA templates |

**Land-and-expand motion:** Healthcare fintechs subject to BOTH HIPAA and FFIEC can start on the Healthcare tier ($12,000/month) and add FFIEC CAT coverage at no incremental charge — it uses the same telemetry pipeline.

### FFIEC + SOC 2 Crosswalk

| Control Area | FFIEC IT Handbook | SOC 2 TSC | SecureBase Evidence |
|---|---|---|---|
| Logical access | IS §II.D | CC6.1, CC6.2 | IAM roles, SSO enforcement |
| Change management | OPS | CC8.1 | Config drift detection |
| Risk assessment | IS §II.A | CC3.1, CC3.2 | Security Hub findings |
| Monitoring | CS §II.A | CC7.1, CC7.2 | GuardDuty, Config continuous |
| Incident response | BCP §III.A | CC7.3, CC7.4 | EventBridge + PagerDuty |
| Availability | BCP §II.B | A1.1, A1.2, A1.3 | Aurora Global, Route 53, S3 CRR |

---

## Section 11 — Closing Strategies & Resources

### POC Closure Framework

**POC Success Criteria (2-week window):**
- Evidence collection accuracy ≥90% on TX-MT-R1 (transaction recordkeeping)
- CTR/SAR counts match AML system records ±2%
- CIP completeness rate matches internal KYC system ±5%
- Examiner package generated and reviewed by CCO: "This is what we'd hand a DOB examiner"

**POC → Close (within 5 business days of POC completion):**

> *"You've validated that the evidence is accurate. Your next DOB examination is [date]. If we sign this week, you'll have [N] months of continuous evidence collected before the examiner walks in. After that point, you're handing them a year's worth of daily evidence — not scrambling to pull records for 6 weeks."*

Annual prepay offer (20% discount, activate within 5 days of POC sign-off):
> *"If you're ready to commit to an annual contract today, the price is [$X] — that's 20% below the monthly rate and locks in your pricing before our Q3 2026 price adjustment."*

### Executive Sponsor Outreach Template

For deals requiring board/audit committee approval:

> **Subject:** SecureBase — FFIEC compliance automation for [Institution Name]
>
> Dear [Board Chair / Audit Committee Chair],
>
> [CCO Name] asked me to provide context on a compliance tooling decision that may come before the audit committee at your next meeting.
>
> [Institution Name] currently completes its FFIEC Cybersecurity Assessment Tool manually — a process that typically takes 3 months and $75,000–$150,000 in consulting fees per examination cycle. SecureBase automates this using your existing AWS infrastructure, at $[price]/month.
>
> We have a SOC 2 Type II report, a Sovereign Cloud architecture brief (all data stays in your AWS account), and a reference from [peer bank] available for your due diligence review.
>
> I would welcome the opportunity to present to the audit committee in [month]. [CCO Name] can coordinate timing.

### Success Metrics (by Milestone)

| Milestone | Target |
|---|---|
| Discovery → Demo conversion | ≥40% |
| Demo → POC conversion | ≥60% |
| POC → Close conversion | ≥80% |
| Time to close (from first touch) | ≤45 days |
| CAC (fully-loaded) | ≤$8,500 |
| LTV (12-month average contract, low churn) | ≥$90,000 |
| LTV:CAC | ≥10x |
| Month 6 NPS | ≥50 |
| Churn | ≤5% annually |

---

## Cross-References

| Document | Location |
|---|---|
| FFIEC Integration Strategy | [`docs/FFIEC_INTEGRATION_STRATEGY.md`](./FFIEC_INTEGRATION_STRATEGY.md) |
| Texas Fintech Compliance Controls | [`docs/TEXAS_FINTECH_COMPLIANCE.md`](./TEXAS_FINTECH_COMPLIANCE.md) |
| Fintech Pro GTM Strategy | [`docs/fintech_pro_gtm_strategy.md`](./fintech_pro_gtm_strategy.md) |
| Sales Paths Overview | [`SALES_PATHS.md`](../SALES_PATHS.md) |
| Pricing Details | [`PRICING.md`](../PRICING.md) |
| CAT Dashboard Component | `src/components/FFIECCATDashboard.jsx` |
| Control Mapping Component | `src/components/compliance/FFIECControlMapping.jsx` |
| Demo Environment | `demo.securebase.tximhotep.com/compliance` |

---

*Maintained by: SecureBase GTM Team · Questions: sales@securebase.io · Last updated: May 2026*
