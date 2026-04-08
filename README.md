# SecureBase

### Sovereign AI Infrastructure & Security Orchestration
**Deployment:** [securebase.tximhotep.com](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)  
**Developer:** [Cedrick J. Byrd / TxImhotep LLC](https://tximhotep.com)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-securebase.tximhotep.com-blue?style=for-the-badge)](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)
[![Book a Demo](https://img.shields.io/badge/Book%20a%20Demo-Schedule%20Now-green?style=for-the-badge)](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=book_demo)

---

## ## Overview
**SecureBase** is a security-first orchestration platform designed for the next generation of sovereign infrastructure. Originally conceived as an AWS landing zone orchestrator, SecureBase has evolved into a comprehensive suite for **AI Agent Authentication**, **Non-Human Identity Management (IAM)**, and **Regulatory Compliance Automation**.

In an era where AI agents and autonomous systems interact with critical infrastructure, SecureBase provides the "Source of Truth" for security posture, asset discovery, and audit readiness.

📋 **[Full Project Roadmap →](ROADMAP.md)**

## ## Key Capabilities (2026 Roadmap)
* **Sovereign Identity:** Advanced IAM protocols for non-human identities and AI agents.
* **Compliance Drift Monitoring:** Real-time visualization of infrastructure status against NERC CIP and NIST standards.
* **AI-Native Orchestration:** Security-hardened landing zones optimized for LLM inference and agentic workloads.
* **Executive Insights:** High-fidelity data visualization for regulatory reporting and risk assessment.

## ## Tech Stack
* **Frontend:** React 18+ (Vite)
* **Data Visualization:** Chart.js with `react-chartjs-2`
* **Cloud Infrastructure:** AWS (Terraform/IaC)
* **Deployment:** Netlify

## ## Getting Started

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

[🚀 Book a Demo](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=book_demo) | 📞 Sales Inquiries
🌐 The Two Portals

We maintain two distinct environments to serve both prospects and active pilot partners:
1. The Interactive Demo Endpoint: [demo.securebase.tximhotep.com](https://securebase.tximhotep.com/?utm_source=github&utm_medium=readme&utm_campaign=demo)

    Purpose: A high-fidelity, read-only "Sandbox" for prospects to explore the UI.

    Features: Pre-populated with mock data for Healthcare (HIPAA), Fintech (SOC 2), and Gov-Tech (FedRAMP).

    Availability: Public access; no signup required.

2. The Production Audit Portal

Endpoint: [tximhotep.com/compliance](https://tximhotep.com/compliance?utm_source=github&utm_medium=readme&utm_campaign=portal)

    Purpose: The live "Source of Truth" for SecureBase customers.

    Live Data: Fetches real-time, signed evidence from private S3 vaults.

    Current Baseline: 75% Compliance Pass Rate (Active Monitoring).

    Security: Requires customer authentication and AWS KMS signature verification.

🛠️ The "Integrity Loop" Architecture

SecureBase is built on a "Zero-Trust Audit" model to ensure evidence cannot be tampered with.

    Collect: The ComplianceEvidenceCollector (Python 3.11) probes 20+ control points across AWS/macOS/Linux.

    Vault: Evidence is hashed (SHA-256) and stored in a private S3 bucket with AWS Object Lock enabled.

    Sign: Every audit manifest is digitally signed via AWS KMS (RSASSA-PSS).

    Verify: The Production Portal verifies the signature before rendering the compliance score to the customer.

💰 Pilot Program (Phase 4)

Status: 8 Spots Remaining (as of Feb 2026)

    30-Day Free Trial: Deploy production workloads with zero commitment.

    White-Glove Onboarding: Automated SES welcome flow and dedicated technical support.

    Pricing: 50% discount for the first 6 months ($4,000/mo for Fintech tier).

🚀 Technical Quick Start (For Developers)

To run a manual audit of your environment and vault it to your S3 bucket:
Bash

# Navigate to the app root
cd securebase-app

# Run the SOC 2 audit engine
python3 ../projects/securebase-terraform/compliance_evidence_collector.py --frameworks soc2 --output-dir ./vault

🏢 About TxImhotep LLC

Based in Mexia, Texas. Founded by veterans. Built for companies that need compliant AWS infrastructure without the 12-week wait.

"Infrastructure HIPAA-Ready (BAA Active)." 2/26/26

Contact:

    Sales: sales@securebase.tximhotep.com

    Support: support@securebase.tximhotep.com

    Security: security@securebase.tximhotep.com

© 2026 SecureBase. All rights reserved.
