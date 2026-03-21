# Texas Examiner Gap Analysis
## SOC2 vs. Texas DOB Requirements for Licensed Money Transmitters

**Version:** 1.0  
**Date:** March 2026  
**Audience:** Internal — Product & Engineering  

---

## Executive Summary

SecureBase's current SOC2 automation platform does **not** satisfy Texas Department of Banking (DOB)
examination requirements for licensed money transmitters (MTs). This creates a "bait-and-switch" risk
for fintech customers who purchase SecureBase assuming it covers state regulatory compliance.

This gap analysis identifies **5 critical gaps**, maps them to specific regulations, and provides a
remediation roadmap. Closing these gaps positions SecureBase as the **only** compliance automation
platform built for Texas-licensed fintechs — a blue ocean opportunity with no direct competitors.

---

## Gap 1: Transaction Recordkeeping (TX-MT-R1)

**Regulation:** 7 TAC §33.35; Texas Finance Code §151.307  
**Requirement:** Retain records of every transaction for **5 years**, including:
- Sender name, address, and identification
- Recipient name and destination
- Transaction amount and currency
- Date and channel

**SOC2 Coverage:** ❌ None. SOC2 audits infrastructure controls (access, availability, confidentiality),
not financial transaction records.

**Customer Impact:**  
During a routine DOB exam, examiners request 5 years of transaction records with sender/recipient
identification. Customers using SOC2-only platforms must manually export records from their core
banking system — a process that takes 200+ hours and costs $40K–$60K per exam.

**SecureBase Gap:**  
No data connector to customer transaction databases. No `tx_transaction_records` table. No 5-year
Object Lock retention policy for transaction data.

**Remediation:** Implement `TransactionDatabaseConnector` → `tx_transaction_records` table (Migration 005).

---

## Gap 2: CTR/SAR Filing Evidence (TX-MT-R2)

**Regulation:** 31 CFR §1022.310 (CTR ≥$10,000 cash); 31 CFR §1022.320 (SAR)  
**Requirement:** Evidence that all required Currency Transaction Reports and Suspicious Activity
Reports were filed timely with FinCEN, including:
- FinCEN BSA tracking IDs
- Disposition records for every AML alert
- Structuring detection documentation

**SOC2 Coverage:** ❌ None. SOC2 Trust Service Criteria do not address AML/BSA obligations.

**Customer Impact:**  
Examiners issue Matters Requiring Attention (MRAs) when CTR/SAR filing evidence is incomplete.
Repeat MRAs lead to enforcement actions, fines, and license suspension.

**SecureBase Gap:**  
No integration with AML systems (Unit21, Sardine, Verafin). No `tx_ctr_filings` or `tx_sar_filings`
tables. No structuring detection queries.

**Remediation:** Implement `AMLSystemCollector` → `tx_ctr_filings`, `tx_sar_filings`, `tx_aml_alerts`
(Migration 005). Add `check_ctr_filing_compliance()` and `detect_structuring()` SQL functions.

---

## Gap 3: Customer Identification Program (TX-MT-R3)

**Regulation:** 31 CFR §1022.210; 7 TAC §33.3  
**Requirement:** Evidence that a CIP is in place and applied to all customers, including:
- Identity verification records (documentary or non-documentary)
- Risk ratings (low / standard / high / PEP)
- Enhanced Due Diligence (EDD) for high-risk customers
- Ongoing monitoring cadence

**SOC2 Coverage:** ❌ SOC2 CC6 (Logical Access) is adjacent but does not cover end-customer identity
verification for AML purposes.

**Customer Impact:**  
Examiners sample CIP records for 25–50 customers per exam. Missing EDD documentation for high-risk
customers triggers immediate MRAs. PEP screening gaps can trigger enforcement.

**SecureBase Gap:**  
No `tx_cip_records` table. No integration with identity verification providers (Alloy, Socure,
Onfido). No PEP/sanctions screening evidence collection.

**Remediation:** Implement `CIPCollector` → `tx_cip_records` (Migration 005).

---

## Gap 4: Digital Asset Segregation (TX-MT-R4 / TX-DASP-R1)

**Regulation:** Texas HB 1666 (effective September 2023); Texas Finance Code Chapter 152 (DASP)  
**Requirement:**
- Customer digital assets must be held in **segregated wallets** (not commingled with operational funds)
- Digital Asset Service Providers (DASPs) must maintain proof of segregation at all times
- Balance snapshots required for examiner review

**SOC2 Coverage:** ❌ None. SOC2 has no concept of on-chain asset segregation.

**Customer Impact:**  
Texas is the first state with a comprehensive DASP licensing regime. Crypto-native MTs operating
in Texas must demonstrate wallet segregation or face immediate license revocation. No existing
compliance automation tool covers HB 1666.

**SecureBase Gap:**  
No `tx_digital_asset_wallets` table. No blockchain RPC integration for balance snapshots.
No DASP-specific controls.

**Remediation:** Implement `DigitalAssetCollector` → `tx_digital_asset_wallets` (Migration 005).

---

## Gap 5: Examiner Evidence Package Format

**Regulation:** Texas DOB Examination Manual (informal guidance)  
**Requirement:** Examiners expect evidence delivered in a **structured, searchable format**:
- Transaction records searchable by sender/recipient/amount/date
- CTR/SAR filings with FinCEN tracking IDs
- Evidence of tamper-resistance (hash + digital signature)
- Ability to export to CSV and PDF

**SOC2 Coverage:** ❌ SOC2 reports are third-party auditor opinions — not raw evidence packages.
Examiners do not accept SOC2 reports as a substitute for transaction-level evidence.

**Customer Impact:**  
Without a structured examiner portal, customers spend 200+ hours manually compiling evidence
spreadsheets before each exam. One customer described it: *"We basically shut down operations
for two weeks every time DOB comes in."*

**SecureBase Gap:**  
No examiner-facing portal. No evidence package export. No KMS signing for tamper evidence.

**Remediation:** Implement `ExaminerPortal` (React, Cognito auth) + `GenerateExaminerExport` Lambda.

---

## Competitive Landscape

| Competitor | SOC2 | HIPAA | Texas DOB MT | Texas DASP | AML/BSA |
|---|---|---|---|---|---|
| **Vanta** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Drata** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Secureframe** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Compliance law firms** | Manual | Manual | Manual ($150K+) | Manual | Manual |
| **SecureBase (current)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **SecureBase (with this roadmap)** | ✅ | ✅ | ✅ | ✅ | ✅ |

**Conclusion:** There is **no direct competitor** in Texas regulatory compliance automation for MTs.
This is a blue ocean opportunity.

---

## Remediation Roadmap

| Phase | Weeks | Deliverable | Controls Closed |
|---|---|---|---|
| 1 — Transaction Connector | 1–3 | `tx_transaction_records` + DB connector | TX-MT-R1 |
| 2 — AML Integration | 4–5 | `tx_ctr_filings`, `tx_sar_filings`, `tx_aml_alerts` | TX-MT-R2a, TX-MT-R2b |
| 3 — CIP + Digital Assets | 5–6 | `tx_cip_records`, `tx_digital_asset_wallets` | TX-MT-R3, TX-MT-R4 |
| 4 — Examiner Portal | 7–8 | React portal + export Lambda | TX-DASP-R1 |

---

## New Pricing Tiers

| Tier | Price | Target Customer | ROI |
|---|---|---|---|
| Foundation (SOC2 only) | $2,000/mo | Standard SMB | — |
| Enterprise | $4,000/mo | Multi-framework SOC2 | — |
| **Fintech Pro** | **$7,500/mo** | Licensed TX MT | Save $50K/exam, 180h prep time |
| **Fintech Elite** | **$12,000/mo** | Multi-state MT + DASP | Save $150K+/year |

**Fintech Pro ROI for customers:**
- Average exam prep cost: $50,000 (200h × $250/h compliance staff)
- SecureBase annual cost: $90,000
- Evidence collection automation saves: ~180h per exam × 2 exams/year = $90,000 saved
- Net savings: breakeven Year 1, $90K+ savings Year 2+

---

## Decision Criteria

Proceed to build **if** customer validation (Week 1) yields:

- ≥ 6 of 10 interviewees express strong interest at $5,000/mo beta pricing
- Average current compliance spend > $150,000/year
- ≥ 3 interviewees confirm "transaction evidence compilation" as top pain point

See `customer_validation_script.md` for the interview guide.
