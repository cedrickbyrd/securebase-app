# SecureBase

### Executive Risk Intelligence for Institutional Governance  
**Deployment:** [securebase.tximhotep.com](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)  
**Developer:** [Cedrick J. Byrd / TxImhotep LLC](https://tximhotep.com)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-demo.securebase.tximhotep.com-blue?style=for-the-badge)](https://demo.securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)
[![Book a Demo](https://img.shields.io/badge/Executive%20Briefing-Schedule%20Now-green?style=for-the-badge)](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=book_demo)

---

## Overview

**SecureBase** is an executive-grade governance intelligence platform that transforms fragmented security telemetry, compliance signals, and infrastructure evidence into clear, defensible risk insight for institutional leadership.

Originally conceived as an AWS landing zone orchestrator, SecureBase now serves as a unified governance layer for organizations that need board-ready visibility into operational exposure, regulatory posture, control maturity, and evidentiary integrity.

In an era where cloud infrastructure, AI workloads, and non-human identities introduce compounding operational risk, SecureBase provides a single command center for executive accountability, institutional resilience, and defensible audit narratives.

📋 **[Full Project Roadmap →](ROADMAP.md)**

## Phase Status (May 2026)

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | AWS Landing Zone (Terraform IaC) | ✅ Complete |
| Phase 2 | Serverless Database & API Backend | ✅ Complete |
| Phase 3a | Executive Portal (React) | ✅ Complete |
| Phase 3b | Support Tickets, Webhooks & Cost Forecasting | ✅ Complete |
| Phase 4 | Enterprise Governance Features (RBAC, Analytics, Notifications) | ✅ Complete |
| Phase 5 | Observability, Multi-Region DR & Incident Response | ✅ Complete |
| Phase 6.1 | Immutable Audit Vault + Evidence Baseline | ✅ Complete |
| Phase 6.1.1 | Scheduled Evidence Runs (Repeatable Vault) | ✅ Complete |
| Phase 6.2 | Compliance Score Engine (54 Config rules, SOC2/HIPAA/FedRAMP) | ✅ Complete |
| Phase 6.3 | Scalability to 10,000+ concurrent users | 📅 Planned |
| Phase 6.4 | Build debt cleanup | 📅 Planned |
| Phase 6.5 | Developer experience hardening | 🔨 In Progress |

## Strategic Capabilities

* **Unified Governance Visibility:** Consolidates infrastructure, compliance, and security signals into a single executive view of organizational exposure.
* **Board-Ready Risk Intelligence:** Organizes telemetry around institutional risk domains leadership can review, defend, and act upon.
* **Defensible Audit Accountability:** Preserves immutable evidence, time-bound governance snapshots, and historical risk posture reconstruction.
* **Regulatory Posture Monitoring:** Visualizes trajectory across SOC 2, HIPAA, PCI DSS, SOX, FedRAMP, and related control environments — with daily automated scoring.
* **Compliance Score Engine:** 54 AWS Config rules evaluate continuously across all tenant OUs. Weighted scoring (Critical 3×, High 2×, Medium 1×, Low 0.5×) produces daily SOC2/HIPAA/FedRAMP scores with 90-day trend history visible in the customer portal.
* **Operational Resilience:** Supports executive decisions with insight into exposure concentration, remediation priority, and control integrity.

## Strategic Exposure Domains

SecureBase organizes intelligence around five executive governance lenses:

* **Data Sovereignty & Privacy Risk**
* **Access Governance & Privileged Identity Exposure**
* **Regulatory Compliance Posture**
* **Vendor & Third-Party Risk**
* **Operational Resilience & Control Integrity**

## Tech Stack

* **Frontend:** React 18+ (Vite), Tailwind CSS, Chart.js, Recharts
* **Data Visualization:** `react-chartjs-2` + `chart.js` + `recharts`
* **Cloud Infrastructure:** AWS (Terraform/IaC) — Organizations, Lambda, Aurora Serverless v2, DynamoDB, API Gateway, CloudWatch, X-Ray, AWS Config
* **Compliance Engine:** 54 AWS Config org-level rules, Security Hub, GuardDuty, weighted scoring model
* **Deployment:** Netlify (portal) + AWS (backend)

## Getting Started

### Prerequisites
* Node.js (LTS)
* npm

### Installation
Clone the repository and install dependencies. To ensure environment stability with our visualization suite, use the legacy peer dependency flag:

```bash
git clone https://github.com/cedrickbyrd/securebase-app.git
cd securebase-app
npm install react-chartjs-2 chart.js --save --legacy-peer-deps
```

> **Dependency compatibility note:** Root ESLint is intentionally pinned to `^9.39.4` because `eslint-plugin-react-hooks@^7.0.1` currently supports ESLint up to `^9`. This pin avoids `npm` `ERESOLVE` conflicts while preserving hook linting behavior.

[📞 Schedule an Executive Briefing](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=book_demo) | [💬 Sales Inquiries](mailto:sales@securebase.tximhotep.com)

## 🌐 The Two Portals

We maintain two distinct environments for institutional buyers, pilot partners, and governance stakeholders:

### 1. Interactive Executive Demo
**URL:** [demo.securebase.tximhotep.com](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)

- **Purpose:** A high-fidelity, read-only executive command center for exploring board-ready risk intelligence.
- **Features:** Pre-populated governance scenarios for Healthcare (HIPAA), Fintech (SOC 2), and Gov-Tech (FedRAMP).
- **Availability:** Public access; no signup required.

### 2. Production Governance Portal
**URL:** [tximhotep.com/compliance](https://tximhotep.com/compliance?utm_source=github&utm_medium=readme&utm_campaign=portal)

- **Purpose:** The live system of record for SecureBase customers.
- **Live Data:** Fetches real-time, signed evidence from private S3 vaults. Daily compliance scores across SOC2, HIPAA, and FedRAMP frameworks with 90-day trend history.
- **Security:** Requires customer authentication and AWS KMS signature verification.

## 🛠️ The Integrity Loop Architecture

SecureBase is built on a zero-trust audit model designed for evidentiary integrity and institutional defensibility.

- **Evaluate:** 54 AWS Config org-level rules continuously evaluate controls across all tenant OUs — SOC2, HIPAA, FedRAMP, CIS.
- **Score:** The `compliance_score_recalculator` Lambda fires daily at 02:00 UTC, applies weighted scoring per framework, and writes snapshots to DynamoDB (365-day retention).
- **Collect:** The ComplianceEvidenceCollector (Python 3.11) probes 20+ control points across AWS/macOS/Linux weekly via EventBridge.
- **Vault:** Evidence is hashed (SHA-256) and stored in a private S3 bucket with AWS Object Lock enabled.
- **Sign:** Every audit manifest is digitally signed via AWS KMS (RSASSA-PSS).
- **Verify:** The Production Portal verifies the signature before rendering risk and compliance posture to customers.
- **Surface:** Customer portal displays SOC2/HIPAA/FedRAMP score cards, 90-day trend chart, control violation table, and Improving/Stable/Declining trend indicator.

## 💼 Executive Access Program

**Status:** Active — Limited availability (as of May 2026)

- **Executive Briefing:** Governance-focused walkthrough for leadership, board, and audit stakeholders.
- **White-Glove Onboarding:** Guided deployment, evidence activation, and stakeholder alignment support.
- **Pilot Pricing:** 50% discount for the first 6 months ($4,000/mo for Fintech tier).

## 🚀 Technical Quick Start (For Developers)

To run a manual audit of your environment and vault it to your S3 bucket:

```bash
# Navigate to the app root
cd securebase-app

# Run the SOC 2 audit engine
python3 ../projects/securebase-terraform/compliance_evidence_collector.py --frameworks soc2 --output-dir ./vault
```

## 🏢 About TxImhotep LLC

Based in Mexia, Texas. Founded by veterans. Built for organizations that need defensible governance operations, evidentiary integrity, and executive-level risk clarity.

**Contact:**
- Sales: sales@securebase.tximhotep.com
- Support: support@securebase.tximhotep.com
- Security: security@securebase.tximhotep.com

© 2026 SecureBase. All rights reserved.
