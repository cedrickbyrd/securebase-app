# 🗺️ SecureBase — Sales Paths

**Two active go-to-market paths. One deferred.  
Each path below tells you exactly what demo to show, what pain to lead with, what tier to pitch, and what the CTA is.**

---

## 📋 Overview

| Path | Market | Demo Entry | Tier | Price | Motion |
|------|--------|-----------|------|-------|--------|
| **1 — FinTech / Banks** | SOC 2 SaaS + FFIEC/BSA-AML | `demo.securebase.tximhotep.com/compliance` | Fintech | $8K/mo | ✅ Self-service |
| **2 — Healthcare / HIPAA** | Specialty pharmacy, EHR, telemedicine | `demo.securebase.tximhotep.com` (HIPAA card) | Healthcare | $12K/mo | ☎️ Contact Sales |
| **3 — Government** | Federal/state agencies, defense contractors | *(not deployed)* | Government | Deferred | ⏸️ See gates below |

---

## 🏦 Path 1 — FinTech / Banks

### Entry Point
**`demo.securebase.tximhotep.com/compliance`**  
`DemoDashboard.jsx` defaults to *"Acme Corporation • FinTech Tier"* — 94% SOC 2 score pre-loaded.

### Two Sub-Personas

#### Sub-Persona A: SOC 2 Type II Buyer

| Field | Detail |
|-------|--------|
| **Who** | VP Engineering at Series A/B SaaS company |
| **Trigger** | Enterprise customers demanding SOC 2 Type II before signing |
| **Pain** | 6–12 weeks to build controls in-house; audit prep blocks sales |
| **Lead with** | *"Your enterprise deals are on hold until you have SOC 2. We can get you audit-ready in <10 minutes."* |
| **Demo to show** | SOC 2 dashboard — 200+ automated controls, quarterly audit reports |
| **Tier** | Fintech — $8,000/mo (pilot: $4,000/mo) |
| **CTA** | Self-service Stripe checkout → 14-day free trial, no credit card required |

#### Sub-Persona B: FFIEC / BSA-AML Buyer

| Field | Detail |
|-------|--------|
| **Who** | Chief Compliance Officer at a Texas-chartered bank, money transmitter, or DASP |
| **Trigger** | DOB examination scheduled; CTR/SAR/CIP controls not yet automated |
| **Pain** | Examiners can pull transaction records at any time; manual evidence collection = exam failure risk |
| **Lead with** | *"Texas DOB examination prep — your CTR, SAR, and CIP controls are already built in."* |
| **Demo to show** | Compliance dashboard → FFIEC/BSA-AML section (TX-MT-R1 through TX-DASP-R1) |
| **Differentiated wedge** | These FFIEC/BSA controls (`docs/TEXAS_FINTECH_COMPLIANCE.md`) are **not offered** by SOC 2-only competitors |
| **Tier** | Fintech — $8,000/mo (pilot: $4,000/mo) |
| **CTA** | Self-service Stripe checkout → 14-day free trial, no credit card required |

### FFIEC Controls Already Built

| Control | Regulation | What It Does |
|---------|-----------|-------------|
| TX-MT-R1 | 31 CFR §1010.410(e) | Transaction recordkeeping completeness |
| TX-MT-R2 | 31 CFR §1010.311 | CTR filing for >$10K transactions |
| TX-MT-R3 | 31 CFR §1022.210 | Customer Identification Program (CIP) |
| TX-MT-R4 | 31 CFR §1023.320 | SAR filing within 30 calendar days |
| TX-DASP-R1 | HB 1666 | Digital Asset Service Provider fund segregation |

### Full CTA Flow

```
demo.securebase.tximhotep.com/compliance
  ↓  (show compliance dashboard, SOC 2 or FFIEC angle)
securebase.tximhotep.com/pricing
  ↓  (Fintech Tier — $8K/mo, 14-day free trial)
Stripe Checkout
  ↓  (payment or pilot coupon)
24hr AWS provisioning  ✅
```

---

## 🏥 Path 2 — Healthcare / HIPAA Posture

### Entry Point
**`demo.securebase.tximhotep.com`** → HIPAA Dashboard card  
*(Added via PR #592 — HIPAA framework shown alongside SOC 2/FedRAMP/CIS)*

### Buyer Persona

| Field | Detail |
|-------|--------|
| **Who** | CTO or VP Engineering at specialty pharmacy, EHR, telemedicine, medical device, or clinical research company |
| **Trigger** | New pharmacy/hospital partnership requires signed BAA before data sharing |
| **Pain** | Can't onboard healthcare clients without BAA; building HIPAA-compliant AWS in-house = 6–12 weeks + $272K+ |
| **Lead with** | *"Your next pharmacy partnership is waiting on your BAA. We deploy HIPAA-compliant AWS in <10 minutes and the BAA is included."* |
| **Demo to show** | HIPAA Dashboard — PHI encryption status, audit log retention, AWS Macie alerts, 300+ HIPAA controls |
| **Tier** | Healthcare — $12,000/mo (pilot: $6,000/mo) |
| **CTA** | Contact Sales → BAA contract review → countersigned → 24hr AWS provisioning |

> **⚠️ NOT self-service.** BAA review is required before provisioning. `ContactSales.jsx` surfaces the HIPAA-specific heading: *"Let's discuss your HIPAA compliance requirements, BAA needs, and PHI protection strategy."*

### Key Differentiators vs. SOC 2-Only Competitors

| Feature | SecureBase Healthcare | SOC 2-Only |
|---------|----------------------|-----------|
| BAA included | ✅ | ❌ |
| PHI encryption automated | ✅ | ❌ |
| 7-year audit log retention | ✅ | ❌ |
| AWS Macie PHI detection | ✅ | ❌ |
| 4-hour support SLA | ✅ | ❌ |
| 300+ HIPAA controls | ✅ | ❌ |

### Primary Prospect — Trellis (trellis.health)

> **Fit Score: 95/100** — See [`trellis-research.md`](trellis-research.md) for full profile.

| Field | Detail |
|-------|--------|
| **Company** | Trellis AI |
| **What they do** | Specialty pharmacy automation — patient intake with PHI at every step |
| **HQ** | Dallas, TX |
| **Funding** | $8M raised (2021) |
| **Employees** | ~45 |
| **Decision maker** | CTO or VP Engineering |
| **Email** | `cto@trellis.health`, `engineering@trellis.health` |
| **Why now** | Every new pharmacy partnership is blocked without a BAA; urgency is structural |
| **Pilot value** | $6,000/mo → $72K/year; full rate $12K/mo → $144K/year |

### Full CTA Flow

```
demo.securebase.tximhotep.com  →  HIPAA Dashboard card
  ↓  (show PHI controls, BAA requirement, 7-year retention)
securebase.tximhotep.com/contact  (Healthcare tier)
  ↓  (sales call, BAA sent for review)
BAA countersigned  ✅
  ↓
24hr AWS provisioning  ✅
```

---

## 🏛️ Path 3 — Government ⏸️ Deferred

**Status:** Scaffolded only — DNS configured, NOT deployed. Do not present as an active path.

### Why Deferred

| Blocker | Detail |
|---------|--------|
| FedRAMP P-ATO cost | $500K–$1M upfront (3PAO assessment + remediation) |
| Timeline to first revenue | 12–24 months (RFP 6–12 mo + ATO 3–6 mo + contract 2–4 mo) |
| LTV:CAC | Commercial = 20:1 · Government = 10:1 |
| GovCloud infrastructure | $10K–$20K/month additional AWS costs before first customer |
| Cleared personnel | $150K–$200K/year per engineer required |

### Gate Conditions (from [`THREE_TIER_ARCHITECTURE.md`](THREE_TIER_ARCHITECTURE.md))

All four conditions must be met before activating:

- [ ] **$80K+ MRR** from commercial tiers (Fintech + Healthcare)
- [ ] **10+ paying** commercial customers
- [ ] **18+ months** runway
- [ ] **5+ engineers** (to dedicate 2–3 to gov build-out)

### DNS Placeholder (configured, not deployed)

```
demo-gov.securebase.tximhotep.com      CNAME  securebase-demo-gov.netlify.app  (404)
portal-gov.securebase.tximhotep.com    CNAME  securebase-portal-gov.netlify.app (404)
```

**Funding logic:** Two FinTech customers ($16K/mo) + one Healthcare customer ($12K/mo) = $28K MRR. Three more customers of each type funds the government tier investment without touching runway.

---

## 🔀 Demo URL → Path Map

```
demo.securebase.tximhotep.com
│
├── /compliance  ────────────────────────────  Path 1: FinTech / Banks
│     │
│     ├── SOC 2 Type II angle
│     │     └── CTA: Self-service Stripe checkout
│     │            → Fintech Tier $8K/mo (pilot $4K/mo)
│     │
│     └── FFIEC / BSA-AML angle  (TX bank CCO)
│           └── CTA: Self-service Stripe checkout
│                  → Fintech Tier $8K/mo (pilot $4K/mo)
│
├── /  (HIPAA Dashboard card)  ──────────────  Path 2: Healthcare / HIPAA
│     └── CTA: Contact Sales → BAA review
│                → Healthcare Tier $12K/mo (pilot $6K/mo)
│
└── /gov  ────────────────────────────────────  Path 3: Government ⏸️
      └── NOT DEPLOYED — placeholder only
             → Launch at $80K MRR gate
```

---

## 📊 Path Comparison

| | Path 1 — FinTech | Path 2 — Healthcare | Path 3 — Government |
|--|-----------------|---------------------|---------------------|
| **Status** | ✅ Active | ✅ Active | ⏸️ Deferred |
| **Demo URL** | `/compliance` | `/` (HIPAA card) | Not deployed |
| **Tier** | Fintech | Healthcare | Government |
| **Price** | $8K/mo | $12K/mo | *TBD on launch* |
| **Pilot** | $4K/mo | $6K/mo | — |
| **Self-service** | ✅ Stripe checkout | ❌ Contact Sales | — |
| **Trial** | 14 days, no CC | 14 days (sales handoff) | — |
| **Key compliance** | SOC 2 + FFIEC/BSA | HIPAA + BAA | FedRAMP + NIST |
| **Sales cycle** | 2–4 weeks | 4–6 weeks | 12–24 months |
| **Differentiator** | FFIEC/BSA controls not in SOC 2-only tools | BAA included, PHI auto-encrypted | GovCloud + cleared support |

---

## 📚 Cross-References

| Document | Relevance |
|----------|-----------|
| [`THREE_TIER_ARCHITECTURE.md`](THREE_TIER_ARCHITECTURE.md) | Full tier comparison, gov gate conditions, infrastructure segregation |
| [`trellis-research.md`](trellis-research.md) | Healthcare Path 2 primary prospect deep-dive |
| [`dallas-outreach-plan.md`](dallas-outreach-plan.md) | Dallas/FW prospect rankings (Trellis #1, Strados Labs #2) |
| [`PRICING.md`](PRICING.md) | Full pricing tables, pilot discount details, tier feature lists |
| [`docs/TEXAS_FINTECH_COMPLIANCE.md`](docs/TEXAS_FINTECH_COMPLIANCE.md) | FFIEC/BSA-AML controls (TX-MT-R1 → TX-DASP-R1) — the FinTech wedge |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | Revenue model, value proposition, ROI vs. DIY |

---

*Last updated: May 2026 · Maintained by: SecureBase GTM team*
