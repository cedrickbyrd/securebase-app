# Fintech Pro — MVP Technical Specification
## Texas DOB Compliance Automation for Licensed Money Transmitters

**Version:** 1.0  
**Timeline:** 8 weeks to beta  
**Beta target:** 3 customers × $5,000/month = $15,000 MRR  

---

## Problem Statement

Licensed Texas money transmitters spend $40,000–$60,000 per Department of Banking examination,
primarily on manual evidence compilation: pulling transaction records, organizing CTR/SAR filings,
assembling CIP documentation. No software automates this today.

**Goal:** Automate 90% of Texas DOB examination evidence collection so customers can generate
a complete, signed evidence package in minutes instead of 200 hours.

---

## Success Criteria

| Milestone | Metric | Target |
|---|---|---|
| Week 4 checkpoint | Evidence collection accuracy | ≥ 90% (validated by beta customer) |
| Week 8 beta launch | Beta customers paying | 3 customers |
| Week 8 beta launch | MRR | $15,000/month |
| Week 8 beta launch | Evidence success rate | ≥ 90% records collected without errors |
| Month 4 GA launch | Paying customers | ≥ 10 |
| Month 4 GA launch | MRR | ≥ $75,000 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Customer Environment                          │
│                                                                      │
│  ┌──────────────┐    VPC Peering / Read Replica                     │
│  │  Transaction │ ──────────────────────────────────┐               │
│  │  Database    │                                    │               │
│  │  (Postgres/  │                                    ▼               │
│  │   MySQL)     │                       ┌──────────────────────┐    │
│  └──────────────┘                       │  SecureBase Lambda   │    │
│                                         │  (VPC-attached)      │    │
│  ┌──────────────┐    Unit21 / Sardine   │                      │    │
│  │  AML System  │ ──► Webhook / API ───►│  texas_fintech_      │    │
│  └──────────────┘                       │  compliance_         │    │
│                                         │  collector.py        │    │
│  ┌──────────────┐    Alloy / Socure     │                      │    │
│  │  KYC/CIP     │ ──► API ────────────►│                      │    │
│  │  System      │                       └────────┬─────────────┘    │
│  └──────────────┘                                │                  │
└─────────────────────────────────────────────────┼────────────────── ┘
                                                   │
                              ┌────────────────────▼──────────────────┐
                              │         SecureBase Platform            │
                              │                                        │
                              │  Aurora PostgreSQL (tx_* tables, RLS) │
                              │  S3 Evidence Vault (Object Lock 5yr)  │
                              │  KMS (SHA-256 signing)                │
                              │  EventBridge (daily cron)             │
                              └────────────────────┬──────────────────┘
                                                   │
                              ┌────────────────────▼──────────────────┐
                              │     Examiner Portal (React)            │
                              │                                        │
                              │  Transaction search & filter          │
                              │  CTR/SAR viewer                       │
                              │  CSV/PDF export                       │
                              │  Cognito auth (examiner access)       │
                              └───────────────────────────────────────┘
```

---

## Build Plan

### Week 1–2: Foundation

**Goal:** Database schema + core Lambda skeleton running in dev.

**Tasks:**
- [ ] Run `005_texas_fintech_compliance.sql` migration in dev Aurora
- [ ] Deploy `texas_fintech_compliance_collector.py` Lambda (no-op mode)
- [ ] Set up S3 evidence bucket with Object Lock (Compliance mode, 5 years)
- [ ] Configure KMS key for evidence signing
- [ ] Add `fintech_pro` and `fintech_elite` tiers to customer schema
- [ ] Configure EventBridge rule: daily 02:00 UTC → Lambda

**Deliverable:** Lambda runs without errors against dev database.

---

### Week 3–4: Transaction Recordkeeping (TX-MT-R1)

**Goal:** Connect to beta customer's transaction database and collect records.

**Tasks:**
- [ ] Build `TransactionDatabaseConnector` class
  - PostgreSQL and MySQL support
  - Read-only IAM user / VPC peering setup
  - Field mapping configuration per customer
- [ ] Implement `collect_tx_mt_r1()` with real data
- [ ] Validate record counts against customer's own reports (90% accuracy gate)
- [ ] Test `check_ctr_filing_compliance()` SQL function with real data
- [ ] Test `detect_structuring()` SQL function

**Deliverable:** Week 4 checkpoint — beta customer confirms >90% of their transactions are
captured correctly. **If this fails, pause and fix before proceeding.**

**Code example — field mapping config:**
```python
CUSTOMER_FIELD_MAP = {
    "customer-uuid": {
        "source_table": "transactions",
        "field_map": {
            "external_txn_id":   "id",
            "transaction_date":  "created_at",
            "transaction_type":  "type",          # maps 'wire' → 'wire_transfer'
            "amount":            "amount_usd",
            "sender_name":       "sender_full_name",
            "sender_account":    "sender_account_number",
            "recipient_name":    "beneficiary_name",
            "recipient_country": "destination_country_code"
        }
    }
}
```

---

### Week 4–5: AML Integration (TX-MT-R2a, TX-MT-R2b)

**Goal:** Pull CTR and SAR filing evidence from customer's AML system.

**Tasks:**
- [ ] Build `Unit21Collector` (Unit21 REST API)
  - `GET /entities/{id}/alerts` for open AML alerts
  - `GET /filings` for CTR/SAR submissions
- [ ] Build `SardineCollector` (Sardine webhook receiver)
- [ ] Implement `collect_tx_mt_r2a()` and `collect_tx_mt_r2b()`
- [ ] Add AML alert → SAR disposition tracking
- [ ] End-to-end test with beta customer's staging AML data

**Unit21 API integration:**
```python
import requests

class Unit21Collector:
    BASE_URL = "https://api.unit21.ai/v1"

    def __init__(self, api_key: str):
        self.headers = {"u21-key": api_key, "Content-Type": "application/json"}

    def get_alerts(self, start_date: str, end_date: str, limit: int = 100):
        resp = requests.get(
            f"{self.BASE_URL}/alerts",
            headers=self.headers,
            params={"start_date": start_date, "end_date": end_date, "limit": limit},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json().get("alerts", [])

    def get_filings(self, filing_type: str = "CTR"):
        resp = requests.get(
            f"{self.BASE_URL}/filings",
            headers=self.headers,
            params={"type": filing_type},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json().get("filings", [])
```

---

### Week 5–6: CIP + Digital Assets (TX-MT-R3, TX-MT-R4, TX-DASP-R1)

**Goal:** Collect CIP records and digital asset segregation evidence.

**Tasks:**
- [ ] Build `AlloyCollector` (Alloy Identity REST API)
  - `GET /persons/{id}` for identity verification records
  - Risk rating extraction
- [ ] Build `SocureCollector` (Socure Module API)
- [ ] Implement `collect_tx_mt_r3()`
- [ ] Build `DigitalAssetCollector`
  - Read wallet addresses from customer config
  - Call blockchain RPC (Infura/Alchemy) for balance snapshots (Ethereum)
  - Bitcoin RPC for BTC wallets
- [ ] Implement `collect_tx_mt_r4_dasp_r1()`

**Digital asset balance snapshot:**
```python
import requests

def get_eth_balance(wallet_address: str, rpc_url: str) -> float:
    payload = {
        "jsonrpc": "2.0", "method": "eth_getBalance",
        "params": [wallet_address, "latest"], "id": 1
    }
    resp = requests.post(rpc_url, json=payload, timeout=10)
    resp.raise_for_status()
    hex_balance = resp.json()["result"]
    return int(hex_balance, 16) / 1e18  # Convert wei to ETH
```

---

### Week 7–8: Examiner Portal + Beta Launch

**Goal:** React portal for examiners + beta customer onboarding.

**Tasks:**
- [ ] Build `ExaminerPortal` React component
  - Transaction search (date range, amount, sender name)
  - CTR/SAR viewer (filterable, sortable)
  - Control status dashboard
  - "Generate Evidence Package" button → calls `/fintech/examiner-export`
- [ ] Add Cognito authentication for examiner access (separate from customer login)
- [ ] Build CSV export (all transactions, CTRs, SARs)
- [ ] Build PDF summary report (control status, key metrics)
- [ ] Onboard 3 beta customers
  - Set up VPC peering / read replica
  - Configure field mapping
  - Run first evidence collection
  - Confirm data accuracy with customer

**Examiner Portal API endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/fintech/compliance-status?customer_id=X` | Control status dashboard |
| GET | `/fintech/transactions?customer_id=X&from=Y&to=Z` | Transaction search |
| GET | `/fintech/ctrs?customer_id=X&status=pending` | CTR filings |
| GET | `/fintech/sars?customer_id=X&status=pending` | SAR filings |
| POST | `/fintech/collect` | On-demand evidence collection |
| POST | `/fintech/examiner-export` | Generate signed evidence package |

---

## Infrastructure

### New AWS Resources

| Resource | Type | Purpose | Monthly Cost |
|---|---|---|---|
| Lambda (texas-fintech-compliance) | 512 MB, 5 min timeout | Evidence collection | ~$0.10/customer |
| S3 evidence bucket | Object Lock, Compliance | 5-year retention | ~$5/customer |
| KMS key | Asymmetric RSA 2048 | Evidence signing | $1/month |
| EventBridge rule | Cron (daily) | Scheduled collection | $0 |
| **Total** | | | **~$6/customer/month** |

**Margin:** $7,500 (revenue) – $6 (infrastructure) – $50 (support est.) = **99.3% gross margin**

### Database

New tables in existing Aurora cluster (Migration 005). No new RDS instances needed.

---

## Security

- **Read-only database access:** Customer grants a read-only IAM user to their transaction
  replica. SecureBase never has write access to customer data.
- **VPC isolation:** Lambda runs in customer VPC via VPC peering.
- **PII hashing:** TIN and ID numbers stored with application-level hashing before Aurora.
- **Object Lock:** S3 evidence bucket uses Compliance mode — even SecureBase cannot delete
  evidence files within the retention period.
- **KMS signing:** SHA-256 of each evidence record is signed with RSA private key in KMS.
  Examiners can verify signatures using the KMS public key.

---

## Week 4 Checkpoint (Go/No-Go)

Before building the examiner portal, validate with beta customer:

1. **Record completeness:** Are ≥90% of transactions captured?
2. **Field accuracy:** Are sender/recipient names and amounts correct?
3. **CTR matching:** Do CTR filings match what the customer filed with FinCEN?
4. **Performance:** Does collection complete within 5 minutes for 30 days of data?

**If YES on all 4:** Proceed to Weeks 5–8 (examiner portal).  
**If NO on any:** Stop and fix the data quality issues before proceeding.

---

## Beta Customer Requirements

Beta customers (design partners) must:

1. Hold an active Texas Money Transmitter License
2. Use a supported transaction database (PostgreSQL or MySQL)
3. Use a supported AML system (Unit21, Sardine, or provide CSV export)
4. Allow read-only VPC peering or provide a read replica
5. Sign a beta agreement (includes 12-month pricing lock at $5K/month)
6. Participate in weekly feedback calls (30 min) during beta

In exchange, beta customers receive:
- Earliest access (8 weeks ahead of GA launch)
- $5,000/month pricing locked for 12 months
- Direct product input (2 feature requests prioritized)
- Featured case study (optional, with approval)
