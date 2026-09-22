#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "===> Creating /marketing directory structure..."
#mkdir -p /marketing/01-strategy
#mkdir -p /marketing/02-campaigns
#mkdir -p ./marketing/03-collateral/one-pagers
#mkdir -p ./marketing/03-collateral/case-studies
#mkdir -p ./marketing/03-collateral/pitch-decks
#mkdir -p ./marketing/04-analytics

echo "===> Scaffolding README.md..."
cat << 'EOF' > ./marketing/README.md
# SecureBase Marketing Directory

This directory houses the comprehensive marketing strategy, go-to-market playbooks, collateral, and analytics runbooks for the SecureBase Compliance Posture Platform.

## Structure
* `01-strategy/` - Core positioning, buyer personas, market segments, and PLG funnel design.
* `02-campaigns/` - Outreach sequences, AWS Marketplace co-sell playbooks, and lead capture workflows.
* `03-collateral/` - Sales one-pagers, technical briefs, pilot frameworks, and executive pitch decks.
* `04-analytics/` - Conversion funnels, role-based view tracking, and KPI dashboards.
EOF

echo "===> Scaffolding 01-strategy/positioning-and-messaging.md..."
cat << 'EOF' > ./marketing/01-strategy/positioning-and-messaging.md
# SecureBase Positioning & Messaging

## Core Value Proposition
SecureBase provides mid-sized financial institutions and regional banks with automated compliance landing zones and continuous cloud posture management, eliminating manual audit friction and accelerating secure deployments.

## Target Audience & Personas
* **Chief Information Security Officers (CISOs):** Require verifiable, continuous audit readiness and automated drift remediation.
* **Compliance Directors:** Focused on streamlining regulatory frameworks (e.g., FFIEC) without bloating operational overhead.
* **IT Directors / Cloud Infrastructure Leads:** Need rapid, secure landing-zone provisioning without sacrificing engineering velocity.

## Messaging Pillars
1. **Frictionless Compliance:** Instantaneous alignment with regulatory mandates through pre-configured compliance templates.
2. **Mid-Market Tailored:** Built specifically for organizations that require enterprise-grade security posture control without complex enterprise overhead.
3. **AWS Ecosystem Synergy:** Native integration with AWS infrastructure, Marketplace co-sell programs, and automated deployment pipelines.
EOF

echo "===> Scaffolding 02-campaigns/email-outreach-sequences.md..."
cat << 'EOF' > ./marketing/02-campaigns/email-outreach-sequences.md
# Email Outreach Sequences

## Sequence 1: Regional Banking & Compliance Leadership (Cold Outreach)

### Email 1: The Audit Friction Hook
**Subject:** Streamlining FFIEC compliance audits at [Company Name]

Hi [First Name],

Manual compliance tracking and audit preparation often drain valuable engineering and risk resources—especially for regional institutions navigating tightening regulatory expectations.

SecureBase deploys automated compliance landing zones designed specifically for mid-sized financial institutions, cutting audit prep time and maintaining continuous FFIEC posture alignment. 

Would you be open to a brief 10-minute overview next week to see how we automate posture management on AWS?

Best regards,

Cedrick J. Byrd
Founder & Principal Cloud Architect, SecureBase  

---

### Email 2: Follow-up on AWS Landing Zone Automation
**Subject:** Re: Streamlining FFIEC compliance audits at [Company Name]

Hi [First Name],

Following up on my previous note. Many compliance directors spend weeks gathering evidence across cloud environments before quarterly or annual reviews. 

Our compliance jumpstart loop establishes secure, pre-configured guardrails out of the box, shifting your team from reactive evidence-gathering to continuous posture verification.

Do you have 5 minutes this Thursday for a quick technical walkthrough?

Best regards,

Cedrick J. Byrd 
SecureBase by TxImhotep LLC 
EOF

echo "===> Scaffolding 03-collateral/one-pagers/compliance-landing-zones.md..."
cat << 'EOF' > ./marketing/03-collateral/one-pagers/compliance-landing-zones.md
# SecureBase: Automated Compliance Landing Zones

## Executive Summary
Financial institutions face rigorous regulatory requirements (such as FFIEC guidelines) while needing to scale cloud operations rapidly. SecureBase bridges the gap between infrastructure speed and regulatory rigor by delivering automated, audit-ready cloud landing zones.

## Key Capabilities
* **Pre-Configured Guardrails:** Instantly provision secure AWS environments equipped with logging, IAM baselines, and encrypted storage out of the box.
* **Continuous Posture Verification:** Real-time monitoring of resource drift against core compliance frameworks, drastically reducing manual audit overhead.
* **Product-Led Onboarding:** Public-facing discovery views that transition smoothly into authenticated, role-based management dashboards upon onboarding.
* **AWS Marketplace Integration:** Seamless procurement, co-sell alignment, and billing integration directly through your AWS enterprise relationship.

## Target Impact
* **70% Reduction** in manual compliance evidence collection time.
* **Accelerated Deployment** of secure cloud infrastructure for regional banking applications.
* **Complete Visibility** into cloud risk posture for executive and compliance leadership.
EOF

echo "===> Success: ./marketing scaffolded successfully with SecureBase configurations!"
