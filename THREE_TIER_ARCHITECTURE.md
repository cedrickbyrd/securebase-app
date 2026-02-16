# Three-Tier Architecture Documentation

Complete documentation of the **SecureBase multi-tier product strategy** implementing Path A (Multi-Tier Platform) with Fintech, Healthcare, and Government market segments.

---

## 📋 Overview

SecureBase is transitioning from a single-product offering to a **three-tier SaaS platform** targeting distinct compliance markets:

- **Tier 1: Fintech** ($8K/month) - SOC2, PCI-DSS compliance
- **Tier 2: Healthcare** ($12K/month) - HIPAA, HITRUST compliance
- **Tier 3: Government** ($15K/month) - FedRAMP, NIST 800-53 compliance

**Current Status**:
- ✅ **Fintech + Healthcare** - Active, deployed, ready for customers
- 🔜 **Government** - Scaffolded, deployment deferred until revenue supports compliance costs

---

## 🏗️ Architecture Overview

### URL Hierarchy

```
tximhotep.com (Corporate)
│
└── SecureBase Product
    │
    ├── Commercial Tiers (ACTIVE)
    │   ├── Fintech ($8K/mo)
    │   ├── Healthcare ($12K/mo)
    │   ├── demo.securebase.tximhotep.com ✅
    │   ├── portal.securebase.tximhotep.com 🔜
    │   └── support@securebase.tximhotep.com
    │
    └── Government Tier (PLACEHOLDER)
        ├── Government ($15K/mo)
        ├── demo-gov.securebase.tximhotep.com 🔜
        ├── portal-gov.securebase.tximhotep.com 🔜
        └── support-gov@securebase.tximhotep.com 🔜

Legend:
✅ = Deployed now
🔜 = Scaffold DNS, deploy later
```

### Infrastructure Segregation

```
┌─────────────────────────────────────────────────────┐
│           Commercial Tiers (Fintech + Healthcare)   │
│                                                       │
│  AWS Commercial Region: us-east-1                    │
│  ├── Landing Zone (Phase 1)                          │
│  ├── Aurora PostgreSQL (Phase 2)                     │
│  ├── Lambda Functions (Phase 2)                      │
│  ├── Customer Portal (Phase 3a)                      │
│  └── Advanced Features (Phase 3b)                    │
│                                                       │
│  Domain: demo.securebase.tximhotep.com               │
│  Portal: portal.securebase.tximhotep.com             │
│  Email:  support@securebase.tximhotep.com            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Government Tier (Future)                │
│                                                       │
│  AWS GovCloud Region: us-gov-west-1                  │
│  ├── FedRAMP-compliant Landing Zone                  │
│  ├── Aurora PostgreSQL (encrypted, isolated)         │
│  ├── Lambda Functions (cleared personnel access)     │
│  ├── Government Portal (restricted access)           │
│  └── Enhanced security controls                      │
│                                                       │
│  Domain: demo-gov.securebase.tximhotep.com           │
│  Portal: portal-gov.securebase.tximhotep.com         │
│  Email:  support-gov@securebase.tximhotep.com        │
│                                                       │
│  Status: DNS configured, NOT DEPLOYED                │
└─────────────────────────────────────────────────────┘
```

---

## 💼 Commercial Tiers (Fintech + Healthcare)

### Target Markets

#### Fintech Tier
**Target Customers**:
- Digital banks and neobanks
- Payment processors
- Cryptocurrency exchanges
- Investment platforms
- Lending platforms

**Compliance Requirements**:
- SOC2 Type II
- PCI-DSS Level 1
- GDPR (for EU customers)
- State money transmitter licenses

**Key Features**:
- Pre-configured AWS Organization with OU structure
- Automated SOC2 audit log collection
- PCI-DSS network segmentation
- Real-time compliance dashboards
- Self-service API key management

**Pricing**: $8,000/month
- Up to 10 AWS accounts
- 7-year log retention
- Standard support (24-hour SLA)

---

#### Healthcare Tier
**Target Customers**:
- Electronic Health Record (EHR) providers
- Telemedicine platforms
- Health insurance companies
- Medical device manufacturers
- Clinical research organizations

**Compliance Requirements**:
- HIPAA
- HITRUST CSF
- GDPR (for EU patient data)
- State privacy laws (CCPA, etc.)

**Key Features**:
- HIPAA-compliant AWS Organization
- Automated Business Associate Agreement (BAA) workflows
- PHI encryption at rest and in transit
- Audit logging for HIPAA compliance
- Patient data access controls

**Pricing**: $12,000/month
- Up to 15 AWS accounts
- 7-year log retention (HIPAA requirement)
- Priority support (4-hour SLA)
- BAA included

---

### Shared Infrastructure

Both Fintech and Healthcare tiers share:

✅ **AWS Commercial Region** (us-east-1, us-west-2)
✅ **Single customer portal** (portal.securebase.tximhotep.com)
✅ **Single demo environment** (demo.securebase.tximhotep.com)
✅ **Shared backend** (Aurora PostgreSQL, Lambda functions)
✅ **Unified billing** (Stripe integration)

**Benefits**:
- Lower infrastructure costs
- Faster feature development
- Consistent user experience
- Simplified operations

---

### Sales Motion

**Self-Service Model**:
1. Visit marketing site (tximhotep.com)
2. Try live demo (demo.securebase.tximhotep.com)
3. Sign up online
4. Choose tier (Fintech or Healthcare)
5. Enter payment info (Stripe)
6. Receive AWS Organization within 24 hours

**No Enterprise Sales Required**:
- Automated onboarding
- Transparent pricing
- Monthly billing
- Cancel anytime

---

## 🏛️ Government Tier (Future)

### Why Separate from Commercial Tiers?

**Regulatory Requirements**:
- FedRAMP authorization required (12-18 months, $500K-$1M cost)
- AWS GovCloud deployment (isolated from commercial AWS)
- Cleared personnel for support (Secret or Top Secret clearance)
- On-premise authority to operate (ATO) per agency

**Infrastructure Constraints**:
- Cannot share resources with commercial tiers
- Must use US-citizen-only support staff
- Requires dedicated networking (VPC, Direct Connect)
- Enhanced logging and monitoring

**Sales Constraints**:
- Enterprise sales motion only (no self-service)
- RFP process (6-12 months)
- No free trials or demos (classified environments)
- Multi-year contracts required

---

### Target Markets

**Target Customers**:
- Department of Defense (DoD)
- Intelligence agencies
- Civilian federal agencies (DHS, HHS, etc.)
- State and local governments
- Defense contractors

**Compliance Requirements**:
- FedRAMP Moderate or High
- NIST 800-53
- FIPS 140-2 encryption
- Continuous monitoring (ConMon)

**Pricing**: $15,000/month (starting)
- Up to 10 AWS GovCloud accounts
- 7-year log retention
- Enterprise support (1-hour SLA)
- Dedicated Technical Account Manager (TAM)
- Cleared support personnel

---

### Deployment Timeline

**Why Not Launch Now?**

❌ **High compliance costs**:
- FedRAMP P-ATO: $500K-$1M (3PAO assessment, remediation)
- GovCloud infrastructure: $10K-$20K/month (higher AWS costs)
- Cleared personnel: $150K-$200K/year per engineer
- Total upfront: $750K-$1.5M before first customer

❌ **Long sales cycles**:
- RFP process: 6-12 months
- ATO approval: 3-6 months per agency
- Contract negotiation: 2-4 months
- **Total**: 12-24 months to first revenue

❌ **Opportunity cost**:
- Fintech + Healthcare have 2-4 week sales cycles
- Can acquire 10+ commercial customers in time to close 1 gov deal
- Commercial revenue funds government tier investment

**When to Launch Government Tier?**

✅ **Revenue threshold**: $80K+ MRR ($1M ARR) from commercial tiers
✅ **Customer count**: 10+ paying commercial customers
✅ **Team size**: 5+ engineers (can dedicate 2-3 to gov tier)
✅ **Runway**: 18+ months of cash (to cover FedRAMP timeline)

**Estimated Timeline**: Q2-Q3 2025 (6-9 months from now)

---

## 🎯 Placeholder Strategy

### DNS Records Configured

All government tier DNS records are **configured now** but point to non-existent services:

```dns
demo-gov.securebase.tximhotep.com      CNAME  securebase-demo-gov.netlify.app
portal-gov.securebase.tximhotep.com    CNAME  securebase-portal-gov.netlify.app
```

**Why configure now?**
- Avoids DNS propagation delays when ready to launch
- Shows enterprise readiness to potential customers
- Allows testing of domain architecture

**What happens if users visit?**
- Returns 404 error (Netlify site doesn't exist)
- Can add "Coming Soon" page later

---

### Email Addresses Documented

Government tier email addresses are **documented** but not active:

```
sales-gov@securebase.tximhotep.com     → Forwarded to sales@securebase.tximhotep.com (for now)
support-gov@securebase.tximhotep.com   → Not configured (returns bounce)
```

**Activation Plan**:
1. Create email aliases in Google Workspace
2. Hire cleared support personnel
3. Set up tier-aware routing in Zendesk

---

### Infrastructure Placeholder

**No GovCloud deployment**:
- ❌ Do NOT create AWS GovCloud account yet (costs money)
- ❌ Do NOT deploy Netlify sites for government tier
- ❌ Do NOT build government-specific features

**Document architecture**:
- ✅ Write infrastructure-as-code (Terraform) for future deployment
- ✅ Design government tier data model (Aurora schema)
- ✅ Plan FedRAMP compliance checklist

---

## 📊 Tier Comparison Table

| Feature                  | Fintech          | Healthcare       | Government       |
|--------------------------|------------------|------------------|------------------|
| **Pricing**              | $8K/month        | $12K/month       | $15K/month       |
| **Compliance**           | SOC2, PCI-DSS    | HIPAA, HITRUST   | FedRAMP, NIST    |
| **AWS Region**           | Commercial       | Commercial       | GovCloud         |
| **Support SLA**          | 24 hours         | 4 hours          | 1 hour           |
| **Sales Motion**         | Self-service     | Self-service     | Enterprise RFP   |
| **Free Trial**           | ✅ Yes (14 days) | ✅ Yes (14 days) | ❌ No            |
| **Demo Available**       | ✅ Yes           | ✅ Yes           | ❌ No (classified)|
| **Contract Length**      | Monthly          | Monthly          | Annual (multi-year)|
| **Account Limit**        | 10 accounts      | 15 accounts      | 10 accounts      |
| **Log Retention**        | 7 years          | 7 years          | 7 years          |
| **Custom Features**      | Limited          | Limited          | Extensive        |
| **Dedicated TAM**        | ❌ No            | ❌ No            | ✅ Yes           |
| **Cleared Support**      | ❌ No            | ❌ No            | ✅ Yes           |
| **On-Premise Option**    | ❌ No            | ❌ No            | ✅ Available     |
| **Status**               | ✅ Active        | ✅ Active        | 🔜 Placeholder   |

---

## 🚀 Path A Decision Rationale

### Why Multi-Tier Platform? (vs. separate products)

**Advantages**:
- ✅ Shared codebase (faster development)
- ✅ Cross-tier feature reuse (billing, analytics, etc.)
- ✅ Unified customer portal
- ✅ Simplified marketing (one brand, multiple tiers)

**Challenges**:
- ⚠️ Feature bloat (one-size-fits-all risk)
- ⚠️ Compliance complexity (must satisfy highest tier requirements)
- ⚠️ Infrastructure isolation (government tier requires GovCloud)

**Mitigation**:
- Use **tier-specific configurations** in code (e.g., `customer.tier === 'healthcare'`)
- Separate **government tier infrastructure** entirely (GovCloud)
- Share **common features** (billing, analytics) across commercial tiers

---

### Enterprise SaaS Patterns

**Inspired by**:

#### Atlassian (Jira, Confluence, Bitbucket)
```
atlassian.com → Parent brand
├── jira.atlassian.com → Product 1
├── confluence.atlassian.com → Product 2
└── bitbucket.org → Separate product
```

#### Amazon Web Services
```
amazon.com → Retail
└── aws.amazon.com → Cloud platform
    ├── console.aws.amazon.com → Commercial console
    └── console.amazonaws-us-gov.com → GovCloud console
```

#### Microsoft Azure
```
microsoft.com → Parent brand
└── azure.microsoft.com → Cloud platform
    ├── portal.azure.com → Commercial portal
    └── portal.azure.us → Government portal
```

**Our Pattern**:
```
tximhotep.com → Parent brand
└── securebase.tximhotep.com → Product
    ├── demo.securebase.tximhotep.com → Commercial demo
    ├── portal.securebase.tximhotep.com → Commercial portal
    ├── demo-gov.securebase.tximhotep.com → Government demo (future)
    └── portal-gov.securebase.tximhotep.com → Government portal (future)
```

---

## 📈 Revenue Projections

### Year 1 (Commercial Tiers Only)

**Fintech Customers**:
- Target: 5 customers × $8K/month = $40K MRR
- ARR: $480K

**Healthcare Customers**:
- Target: 3 customers × $12K/month = $36K MRR
- ARR: $432K

**Total Commercial ARR**: $912K (Year 1)

---

### Year 2 (Add Government Tier)

**Fintech Customers**:
- Target: 10 customers × $8K/month = $80K MRR
- ARR: $960K

**Healthcare Customers**:
- Target: 6 customers × $12K/month = $72K MRR
- ARR: $864K

**Government Customers**:
- Target: 2 customers × $15K/month = $30K MRR
- ARR: $360K

**Total ARR**: $2.18M (Year 2)

---

### Key Metrics

**Customer Acquisition Cost (CAC)**:
- Commercial: $5K-$10K (paid ads, content marketing)
- Government: $50K-$100K (RFP process, enterprise sales)

**CAC Payback Period**:
- Commercial: 1 month
- Government: 6-12 months

**Lifetime Value (LTV)**:
- Commercial: $200K-$300K (2-3 years)
- Government: $500K-$1M (3-5 years)

**LTV:CAC Ratio**:
- Commercial: 20:1 (excellent)
- Government: 10:1 (good)

---

## 🛠️ Implementation Checklist

### Phase 1: Commercial Tiers (Complete)
- [x] Deploy AWS Landing Zone (Phase 1)
- [x] Deploy Aurora + Lambda backend (Phase 2)
- [x] Deploy customer portal (Phase 3a)
- [x] Configure custom domains (tximhotep.com)
- [x] Set up email routing (support@securebase.tximhotep.com)

### Phase 2: Government Tier Scaffolding (Complete)
- [x] Document DNS records
- [x] Document email addresses
- [x] Write placeholder Terraform modules
- [x] Design government tier data model

### Phase 3: Government Tier Launch (Future - Q2-Q3 2025)
- [ ] Achieve $80K+ MRR from commercial tiers
- [ ] Hire cleared engineers (Secret clearance minimum)
- [ ] Set up AWS GovCloud account
- [ ] Begin FedRAMP P-ATO process ($500K-$1M, 12-18 months)
- [ ] Deploy GovCloud infrastructure
- [ ] Launch government tier sales motion

---

## 🔒 Security & Compliance

### Commercial Tiers

**SOC2 Type II** (Fintech + Healthcare):
- Annual audit by 3rd party auditor
- Cost: $50K-$100K/year
- Timeline: 6-9 months for initial certification

**HIPAA** (Healthcare only):
- Self-attestation (no 3rd party audit required)
- Business Associate Agreements (BAAs) with customers
- Annual risk assessments

**PCI-DSS Level 1** (Fintech only):
- Annual audit for payment processors
- Cost: $100K-$200K/year
- Timeline: 9-12 months

---

### Government Tier

**FedRAMP Moderate**:
- 3PAO audit (3rd party assessment organization)
- Cost: $500K-$1M (initial) + $100K-$200K/year (continuous monitoring)
- Timeline: 12-18 months
- Requires: AWS GovCloud, enhanced controls, continuous monitoring

**NIST 800-53**:
- 325 security controls (vs. 100 for SOC2)
- Automated compliance checking (AWS Config, Security Hub)
- Quarterly control testing

---

## 📚 Related Documentation

- **DNS_SETUP.md** - DNS configuration for all tiers
- **EMAIL_SETUP.md** - Email routing and tier-aware support
- **DEMO_QUICK_START.md** - Commercial demo setup
- **NETLIFY_DEPLOYMENT.md** - Deployment guide
- **PROJECT_INDEX.md** - Complete project roadmap

---

## 🎯 Success Metrics

### Commercial Tiers (Active)
- ✅ Marketing site: tximhotep.com
- ✅ Demo portal: demo.securebase.tximhotep.com
- ✅ Product landing: securebase.tximhotep.com (redirects to main site)
- ✅ Email: support@securebase.tximhotep.com

### Government Tier (Placeholder)
- ✅ DNS records configured (not deployed)
- ✅ Email addresses documented (not active)
- ✅ Architecture documented
- ✅ Terraform modules written (not applied)

### Revenue Milestones
- 🎯 $80K MRR → Trigger government tier investment
- 🎯 10+ commercial customers → Hire cleared engineers
- 🎯 18+ months runway → Begin FedRAMP process

---

## 📞 Contact

**Sales Inquiries**:
- Commercial: sales@securebase.tximhotep.com
- Government: sales-gov@securebase.tximhotep.com (forwarded to sales)

**Technical Support**:
- Commercial: support@securebase.tximhotep.com
- Government: support-gov@securebase.tximhotep.com (not active)

**Corporate**:
- General: team@tximhotep.com
- Press: press@tximhotep.com
