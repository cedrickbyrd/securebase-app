# SecureBase FFIEC Sales Playbook

**Version:** 1.0  
**Owner:** SecureBase GTM Team  
**Audience:** Account Executives, Sales Engineers, SDRs  
**Updated:** May 2026

---

## Overview

The FFIEC (Federal Financial Institutions Examination Council) sales motion targets **Texas-chartered banks, money transmitters, and Digital Asset Service Providers (DASPs)** who face mandatory regulatory examinations they are not equipped to pass efficiently.

SecureBase is the only compliance platform that **automates BSA/AML examination evidence** for Texas-licensed financial institutions — turning a 200-hour, $50K+ manual exam prep process into a 30-second, one-click package.

> **Elevator pitch:** *"SecureBase prepares your institution for Texas DOB and FinCEN examination in minutes, not months. Your CTR filings, SAR reports, CIP records, and transaction evidence are collected automatically every day — so when the examiner walks in, you hand them a signed evidence package instead of scrambling for six weeks."*

---

## Target Market

### Primary: Texas-Licensed Money Transmitters (TMLs)

| Attribute | Detail |
|---|---|
| **Population** | ~850 active MTL holders (NMLS Consumer Access, public) |
| **Profile** | Fintech, neo-banks, crypto on/off ramps, remittance companies |
| **Annual compliance spend** | $150K–$500K |
| **Examination frequency** | Every 18–24 months (Texas DOB) |
| **Exam prep cost** | $40K–$60K per exam (200+ hours of manual evidence collection) |
| **Regulatory risk** | License revocation, civil money penalties up to $1M/day |

### Secondary: Texas Digital Asset Service Providers (DASPs)

| Attribute | Detail |
|---|---|
| **Population** | ~200 active or pending TX DASP license holders |
| **Trigger** | HB 1666 (2023) — new fund segregation requirements, no existing software addresses them |
| **Pain** | DASP compliance is novel; no competitor automates HB 1666 controls |
| **Target tier** | Fintech Elite ($12,000/mo) |

### Tertiary: Pre-Licensure MTL Applicants

| Attribute | Detail |
|---|---|
| **Population** | ~300 applicants in pipeline (NMLS data) |
| **Pain** | Must demonstrate compliance controls are *in place* before license is granted |
| **Value prop** | "Show DOB you're ready before day one" |

---

## Ideal Customer Profile (ICP)

### Firmographic

| Signal | Target | Disqualify |
|---|---|---|
| **License** | Active TX MTL (NMLS) or TX DASP license | No license, purely SOC 2 need |
| **Transaction volume** | >1,000 transactions/month | <100 transactions/month |
| **Annual revenue** | $2M–$200M | Pre-revenue startups |
| **HQ** | Texas (primary); SE/SW US (secondary) | International only |
| **Employee count** | 15–500 | Solo operators |

### Technographic

| Signal | Fit |
|---|---|
| **AML system** | Unit21, Sardine, Verafin, Featurespace — integrates natively |
| **KYC/CIP system** | Alloy, Socure, Jumio — import-ready |
| **Database** | PostgreSQL, MySQL, Aurora — direct VPC connection |
| **Cloud** | AWS-native — no migration required |

### Behavioral Triggers (Immediate Outreach)

| Trigger | Source | Action |
|---|---|---|
| DOB examination notice received | Examiner notification / LinkedIn post | Outreach within 24 hours |
| DOB enforcement action published | TDSML enforcement database | Research + personalized outreach |
| MTL granted (new license) | NMLS weekly updates | Welcome sequence: "Start exam-ready" |
| DASP rule violation (HB 1666) | TX regulatory enforcement | Direct CCO outreach with HB 1666 demo |
| CCO LinkedIn post about "exam prep" | LinkedIn alerts | Comment + DM |

---

## Buyer Personas

### Persona 1: Chief Compliance Officer (CCO) — Primary Decision Maker

| Field | Detail |
|---|---|
| **Title** | Chief Compliance Officer, VP Compliance, Head of BSA/AML |
| **Reports to** | CEO or General Counsel |
| **Age** | 40–58 |
| **Background** | Former bank examiner, banking attorney, or FinCEN analyst |
| **Day job** | Managing the compliance program, training staff, preparing exam binders |
| **Biggest fear** | Receiving an MRA (Matter Requiring Attention) or license suspension |
| **Primary motivator** | Passing the exam without personal risk to their career |
| **How they buy** | Slow and deliberate; wants proof of accuracy; needs to see the examiner package before signing |

**Discovery questions for CCO:**
- "When was your last DOB examination? How did evidence collection go?"
- "How many hours does your team spend preparing transaction records for an exam?"
- "Have you ever received an MRA or a DOB enforcement action?"
- "If an examiner walked in tomorrow, what's the one thing you'd be scrambling to pull together?"

### Persona 2: VP Engineering / CTO — Technical Champion

| Field | Detail |
|---|---|
| **Title** | VP Engineering, CTO, Engineering Director |
| **Role in deal** | Technical validation, security review, integration scoping |
| **Primary concern** | "How does this connect to our transaction database without breaking anything?" |
| **Key question to answer** | Read-only VPC connection, no PII leaves their environment |

**Discovery questions for VPE:**
- "What database do you use for transactions? PostgreSQL or MySQL?"
- "Are you on AWS? What region?"
- "Do you have a read replica we can point to, or do we set up VPC peering?"
- "Who owns the security review process?"

### Persona 3: CEO / Founder — Economic Buyer (SMB ≤50 people)

| Field | Detail |
|---|---|
| **Context** | At smaller companies, CEO also carries compliance budget |
| **Motivator** | Protect the license; avoid regulatory penalties |
| **What they respond to** | Hard dollar ROI, risk reduction, "your competitors are already doing this" |

---

## Pain Points & Value Mapping

| Customer Pain | Root Cause | SecureBase Solution |
|---|---|---|
| 200 hours per exam | Manual SQL queries, spreadsheet assembly | Daily automated collection, one-click examiner package |
| $40K–$60K per exam | Consulting fees + internal staff hours | $7,500–$12,000/month subscription covers unlimited exams |
| MRA risk from missing records | No monitoring for compliance gaps | Real-time compliance score; alerts on missing CTRs |
| CTR/SAR filing deadline misses | Manual tracking in spreadsheets | Automated detection + filing deadline monitoring |
| Structuring patterns undetected | No systematic sub-$10K transaction analysis | Built-in structuring detection algorithm |
| DOB examiner makes last-minute requests | No organized evidence vault | Examiner Portal with on-demand package generation |
| CIP records incomplete | Manual identity verification tracking | CIP completeness check against all active customers |
| HB 1666 fund segregation unaudited | New regulation, no tools exist | TX-DASP-R1 automated balance reconciliation |

---

## FFIEC Controls Built Into SecureBase

| Control ID | Regulation | What SecureBase Automates |
|---|---|---|
| **TX-MT-R1** | 31 CFR §1010.410(e), 7 TAC §33.35 | Transaction recordkeeping completeness — verifies 100% of required fields across all transactions |
| **TX-MT-R2a** | 31 CFR §1022.310 | CTR filing compliance — flags every transaction >$10K, verifies FinCEN Form 112 filed within 15 days |
| **TX-MT-R2b** | 31 CFR §1022.320 | SAR filing compliance — detects suspicious activity patterns, verifies FinCEN Form 111 filed within 30 days |
| **TX-MT-R3** | 31 CFR §1022.210, 7 TAC §33.3 | Customer Identification Program (CIP) — verifies name, DOB, SSN/TIN, government ID on all active accounts |
| **TX-MT-R4** | 7 TAC §33.35(b)(3) | Authorized delegate oversight — validates signed agreements, annual audits, and transaction monitoring |
| **TX-DASP-R1** | TX HB 1666, Fin. Code §152 | Digital asset fund segregation — daily reconciliation of customer vs. company funds |

---

## Demo Script (45 Minutes)

### Pre-Demo Preparation (5 min before call)
1. Pull their NMLS license number from [NMLS Consumer Access](https://www.nmlsconsumeraccess.org/)
2. Check [TDSML enforcement actions](https://www.dob.texas.gov/public/uploads/files/Consumer-Information/mortgageenforcement.pdf) for their company name
3. Have the compliance dashboard preloaded with "Acme Financial, LLC – Fintech Elite"

### Opening (5 min)
> *"Before I show you anything, I want to understand your situation. You told me [personalized pain from discovery]. Tell me more — how does your team handle exam prep today?"*

Let them talk. Listen for: hours spent, tools used (Excel?), recent MRAs, examiner frequency.

### Act 1: The Problem (5 min)
> *"What you're describing is exactly what we hear from every Texas CCO. The DOB examiner doesn't care that your team worked 200 hours — they care that the records are there and accurate. Let me show you what this looks like when it's automated."*

### Act 2: Compliance Dashboard (10 min)

1. **Open the compliance dashboard** → show overall compliance score (94%)
2. **Click TX-MT-R1** → Transaction Recordkeeping
   - Show "1,247 transactions sampled — 98.7% complete"
   - Drill into one incomplete record → show exactly which field is missing
3. **Click TX-MT-R2** → CTR/SAR Filing
   - Show "3 CTR filings — all filed within 15-day window"
   - Show SAR viewer with FinCEN tracking IDs
4. **Click TX-MT-R3** → CIP Completeness
   - Show "482 customers — 96.4% fully verified"
   - Drill into flagged customer → show EDD required
5. **Pause and ask:** *"How does your team track this today? Spreadsheets? AML system dashboard?"*

### Act 3: The Examiner Package (10 min)

> *"Now let me show you the moment that matters — when the examiner walks in and says 'I need your evidence for Q1 2024.'"*

1. Click **"Generate Examiner Package"**
2. Enter: examiner name, email, date range
3. Watch the 30-second generation
4. Open the PDF: show cover page, control results table, signed evidence manifest
5. > *"This is what you hand the examiner. KMS-signed, SHA-256 hashed, tamper-proof. Compare that to your current process."*

### Act 4: ROI Conversation (10 min)

Use the ROI calculator live:
- Hours per exam: `___` × hourly blended rate: `$250`
- Exams per year: typically 2
- Current cost: `___`
- SecureBase: `$7,500/month` = `$90,000/year`
- **Net savings in Year 1: usually $0–$30K; Year 2+: $40K–$60K annually**

> *"We're not trying to be cheap — we're trying to be the best ROI decision you made this year. You're already spending $150K+/year on compliance. This replaces $50K of exam prep, frees up your team, and gives your CCO peace of mind every single day."*

### Closing (5 min)

> *"Based on what you've shared, you have your next DOB examination in [timeframe]. We can have you collecting evidence within 48 hours of signing. What would it take to move this forward this quarter?"*

**Next step options:**
1. **POC offer:** "Connect to your staging database, run 30 days of evidence collection, validate accuracy — free, 2 weeks"
2. **Pilot:** "Fintech Pro at $5,000/month for 6 months, locked"
3. **Full contract:** Annual prepay at 20% discount

---

## Objection Handling

### "We already have an AML system (Unit21, Sardine, etc.)"

> *"That's great — those systems detect suspicious activity. SecureBase is the layer between your AML system and your DOB examiner. We pull the SAR/CTR filing evidence from your AML system, organize it the way examiners want it, and generate the signed package. We integrate directly with Unit21 via webhook."*

### "Our team can handle exam prep manually"

> *"I hear that — and I'd ask: what did the last exam cost you in staff hours? [wait] If it was more than 100 hours at $250/hr, that's already $25,000. SecureBase costs $7,500/month. After three months, you've paid for itself. After that, every exam is essentially free."*

### "We're worried about giving you access to transaction data"

> *"Totally valid. We don't take your data anywhere. We attach a read-only Lambda to your existing VPC, point it at a read replica, and the evidence stays in your AWS account — signed and locked in S3 with Object Lock. We never see your raw transaction data; we only see hashed compliance results."*

### "The price is too high"

> *"Let me ask — what did your last examination cost you? [wait] Most Texas CCOs tell us $50K–$60K just in preparation time. At $7,500/month, you hit breakeven after less than two exams. And after that, every exam costs you nothing extra."*

> *Never discount below $5,000/month.* If budget is a firm constraint, offer 6-month pilot pricing at $5,000/month.

### "We'll build it internally"

> *"We've talked to three companies that said that — two of them became customers after spending 6 months and $200K building something that still doesn't cover TX-DASP-R1. The third company received an MRA before their internal tool was ready. The DOB doesn't wait for your sprint cycle."*

### "Vanta / Drata / Secureframe already does compliance"

> *"Those are great SOC 2 platforms. They don't touch BSA/AML. No existing SOC 2 tool automates CTR filings, SAR evidence, or Texas Department of Banking exam packages. We're the only platform that does. Ask any of those vendors if they cover TX-MT-R1 — you'll get a blank stare."*

---

## Competitive Landscape

| Competitor | What They Do | Why They Lose to SecureBase |
|---|---|---|
| **Vanta** | SOC 2 / ISO 27001 automation | No BSA/AML, no FFIEC, no examiner package generation |
| **Drata** | SOC 2 compliance automation | Same as Vanta |
| **Secureframe** | SOC 2 / HIPAA | No financial regulation support |
| **Hummingbird** | BSA/AML case management | Manages cases but doesn't generate DOB examiner packages; no CIP automation |
| **AML RightSource** | Managed AML service | Consulting services, not software; 10x the cost |
| **Unit21 / Sardine** | AML detection systems | Detects activity but doesn't produce examiner-ready evidence packages |
| **Manual process** | Excel + law firm + big4 audit firm | $50K–$100K per exam, 200+ hours, error-prone |

**SecureBase wins because:**
- Only platform automating TX-specific controls (TX-MT-R1 through TX-DASP-R1)
- Only platform with one-click DOB examiner package generation
- Evidence is KMS-signed + tamper-proof (examiners accept this without question)
- Evidence stays in the customer's AWS account (data residency)

---

## Pricing & Packaging

| Tier | Monthly | Annual (20% disc.) | Controls Included |
|---|---|---|---|
| **Fintech Pro** | **$7,500** | **$72,000** | TX-MT-R1, TX-MT-R2a/b, TX-MT-R3, TX-MT-R4 |
| **Fintech Elite** | **$12,000** | **$115,200** | All Fintech Pro + TX-DASP-R1 + multi-state (NY DFS, CA DFPI) |

**Pilot pricing (first 10 customers):** $5,000/month locked for 12 months.

### Proposal Template

```
Company: [Customer Name]
Tier: Fintech Pro / Fintech Elite
MRR: $7,500 / $12,000
Pilot (optional): $5,000/month for 6 months, converts to standard
Contract term: Month-to-month or Annual (20% discount)
Onboarding: 48-hour technical setup, 2-week POC window
```

---

## Sales Process & Qualification (MEDDIC)

| Letter | Criterion | Questions to Ask |
|---|---|---|
| **M** — Metrics | Current exam prep cost >$50K? Hours >100? | "What did your last exam cost in staff time?" |
| **E** — Economic Buyer | CCO has budget authority? | "Who owns the compliance budget?" |
| **D** — Decision Criteria | Must automate transaction evidence? | "What does success look like after your next exam?" |
| **D** — Decision Process | Who else must approve? | "Besides you, who needs to sign off on a compliance tool?" |
| **I** — Identify Pain | Have they had a DOB MRA? | "Have you ever received a Matter Requiring Attention from DOB?" |
| **C** — Champion | Is the CCO enthusiastic and willing to push internally? | "Would you be willing to walk me through your current process on a call with your CFO?" |

**Disqualify if:**
- No active MTL or DASP license (they don't need FFIEC controls)
- Examination not scheduled in next 18 months (low urgency)
- CCO is unwilling to do a 2-week POC (accuracy concerns won't be resolved)

---

## Proof of Concept (POC) Framework

**Duration:** 2 weeks  
**Goal:** Validate ≥90% evidence collection accuracy against customer's own records

| Week | Activity | Owner | Success Metric |
|---|---|---|---|
| **Week 1, Day 1–2** | Technical setup: VPC peering or read replica, Lambda deployment | SecureBase SE | Lambda collecting without errors |
| **Week 1, Day 3–5** | Run evidence collection for 1 month of historical data | SecureBase Lambda | 100% records sampled, no timeouts |
| **Week 2, Day 1–3** | Customer validates CTR/SAR counts, CIP completeness vs. internal records | Customer CCO | ≥90% match on all controls |
| **Week 2, Day 4–5** | Generate examiner package; customer reviews PDF/CSV | Joint review | Customer says "this is what we'd hand a DOB examiner" |

**POC success → Close:** If accuracy ≥90%, proceed directly to contract. Offer annual prepay at the POC pricing if commitment made within 5 business days.

---

## Customer Success Metrics & Expansion Triggers

### Renewal Signals (Healthy Customer)
- Compliance score consistently ≥90%
- Examiner package generated ≥1x per quarter
- No support tickets about data accuracy
- CCO logs in at least monthly

### Upsell: Fintech Pro → Fintech Elite
**Trigger:** Customer mentions multi-state expansion, crypto/digital assets, or HB 1666 compliance  
**Pitch:** *"You mentioned expanding to New York / launching a digital asset product. Fintech Elite adds NY DFS controls and TX-DASP-R1 fund segregation. The upgrade is $4,500/month."*

### Expansion: Add Environments
**Trigger:** Customer acquires a subsidiary or spins up a new licensed entity  
**Pitch:** *"Each additional licensed entity is $80/month for a dedicated environment. Since you're on Fintech Pro, all controls carry over."*

---

## Resources & References

| Resource | Location |
|---|---|
| FFIEC Integration Strategy | [`docs/FFIEC_INTEGRATION_STRATEGY.md`](./FFIEC_INTEGRATION_STRATEGY.md) |
| Texas Fintech Compliance Controls | [`docs/TEXAS_FINTECH_COMPLIANCE.md`](./TEXAS_FINTECH_COMPLIANCE.md) |
| Fintech Pro GTM Strategy | [`docs/fintech_pro_gtm_strategy.md`](./fintech_pro_gtm_strategy.md) |
| Fintech Pro MVP Spec | [`docs/fintech_pro_mvp_spec.md`](./fintech_pro_mvp_spec.md) |
| Sales Paths Overview | [`SALES_PATHS.md`](../SALES_PATHS.md) |
| Pricing Details | [`PRICING.md`](../PRICING.md) |
| Demo Environment | `demo.securebase.tximhotep.com/compliance` |

---

*Maintained by: SecureBase GTM Team · Questions: sales@securebase.io*
