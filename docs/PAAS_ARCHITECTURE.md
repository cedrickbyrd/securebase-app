# SecureBase PaaS Architecture Specification

## Executive Summary

SecureBase evolves from a standalone Landing Zone tool into a **managed Platform-as-a-Service (PaaS)** that enables you to deploy and manage AWS Organizations for multiple customers at scale. The platform automates deployment, compliance reporting, and lifecycle management.

## Target Customers

### Tier 1: Healthcare Organizations
- **Compliance**: HIPAA, HITRUST
- **Features**: VPC Endpoint enforcement, ePHI audit trails, automatic remediation
- **Cost**: $15,000/month base + usage

### Tier 2: Fintech/Regulated Tech
- **Compliance**: SOC2 Type II, PCI-DSS
- **Features**: Enhanced CloudTrail, real-time alerting, advanced remediation
- **Cost**: $8,000/month base + usage

### Tier 3: Government/Federal
- **Compliance**: FedRAMP, NIST 800-53
- **Features**: Full audit trail, cross-account logging, compliance reporting
- **Cost**: $25,000/month base + usage

### Tier 4: Standard (SMB/Startup)
- **Compliance**: CIS Foundations
- **Features**: Basic guardrails, monthly compliance reports
- **Cost**: $2,000/month base + usage

---

## Platform Architecture (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│                     PaaS Control Plane                       │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │ REST API     │  │ WebSocket     │  │ gRPC Events     │ │
│  │ (/tenants)   │  │ (Real-time)    │  │ (Notifications) │ │
│  └──────────────┘  └────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │
          ├─ Auth Service (OAuth2 + API Keys)
          ├─ Orchestration Engine (Terraform)
          ├─ Multi-Tenant DB (PostgreSQL + RLS)
          ├─ Billing Engine
          ├─ Compliance Reporting
          └─ Observability Stack
          
┌─────────────────────────────────────────────────────────────┐
│                   AWS Landing Zone Layer                     │
│  (Tenant Account)              (Tenant Account)              │
│  ┌─────────────────┐          ┌─────────────────┐           │
│  │ AWS Org + IAM   │          │ AWS Org + IAM   │           │
│  │ + Guardrails    │          │ + Guardrails    │           │
│  └─────────────────┘          └─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: API & Orchestration Layer

### 1.1 REST API Specification

**Base URL:** `https://api.securebase.com/v1`

#### Endpoint: Create Tenant

```http
POST /tenants
Content-Type: application/json
Authorization: Bearer {api_token}

{
  "name": "customer-name",
  "tier": "fintech",
  "framework": "soc2",
  "organization_name": "Customer Inc",
  "contact_email": "admin@customer.com",
  "billing_code": "CUST-001",
  "custom_guardrails": {
    "restrict_regions": ["us-east-1", "us-west-2"],
    "enforce_vpce": true
  }
}

Response (201):
{
  "tenant_id": "tnnt_xxxxx",
  "status": "provisioning",
  "created_at": "2026-01-19T10:30:00Z",
  "estimated_ready_at": "2026-01-19T10:45:00Z",
  "aws_account_id": "111122223333",
  "aws_organization_arn": "arn:aws:organizations::111122223333:organization/o-xxxxx"
}
```

#### Endpoint: List Tenants

```http
GET /tenants?skip=0&limit=10
Authorization: Bearer {api_token}

Response (200):
{
  "items": [
    {
      "tenant_id": "tnnt_xxxxx",
      "name": "customer-name",
      "tier": "fintech",
      "status": "active",
      "created_at": "2026-01-19T10:30:00Z"
    }
  ],
  "total": 42,
  "skip": 0,
  "limit": 10
}
```

#### Endpoint: Get Tenant Details

```http
GET /tenants/{tenant_id}
Authorization: Bearer {api_token}

Response (200):
{
  "tenant_id": "tnnt_xxxxx",
  "name": "customer-name",
  "tier": "fintech",
  "framework": "soc2",
  "status": "active",
  "aws_account_id": "111122223333",
  "aws_org_id": "o-xxxxx",
  "compliance_status": {
    "framework": "soc2",
    "last_scan": "2026-01-18T23:00:00Z",
    "passing_controls": 45,
    "total_controls": 50,
    "score": 90
  },
  "usage_this_month": {
    "api_calls": 15420,
    "compliance_scans": 4,
    "estimated_cost": 2450
  }
}
```

#### Endpoint: Update Tenant

```http
PATCH /tenants/{tenant_id}
Authorization: Bearer {api_token}

{
  "tier": "healthcare",
  "custom_guardrails": {
    "enforce_vpce": true
  }
}

Response (200):
{
  "tenant_id": "tnnt_xxxxx",
  "update_status": "queued",
  "estimated_completion": "2026-01-19T11:15:00Z"
}
```

#### Endpoint: Delete Tenant

```http
DELETE /tenants/{tenant_id}?confirmation=true
Authorization: Bearer {api_token}

Response (202):
{
  "tenant_id": "tnnt_xxxxx",
  "deletion_status": "scheduled",
  "estimated_completion": "2026-01-19T12:00:00Z"
}
```

#### Endpoint: Get Compliance Report

```http
GET /tenants/{tenant_id}/compliance-report
Authorization: Bearer {api_token}

Response (200):
{
  "tenant_id": "tnnt_xxxxx",
  "framework": "soc2",
  "generated_at": "2026-01-19T10:00:00Z",
  "report_url": "https://reports.securebase.com/xxxxx.pdf",
  "summary": {
    "total_controls": 50,
    "passing": 48,
    "failing": 2,
    "non_applicable": 0,
    "score": 96
  },
  "findings": [
    {
      "control_id": "CC7.1",
      "status": "failing",
      "description": "CloudTrail not enabled in backup account",
      "remediation": "Enable CloudTrail in backup account"
    }
  ]
}
```

---

## Phase 2: Multi-Tenant Database

### 2.1 Schema Overview (PostgreSQL + Row-Level Security)

```sql
-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  framework VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  aws_account_id VARCHAR(12),
  aws_org_id VARCHAR(15),
  api_key_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Usage & Billing table
CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2),
  recorded_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_tenant_date (tenant_id, recorded_at)
);

-- Compliance Reports table
CREATE TABLE compliance_reports (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  framework VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  passing_controls INTEGER,
  total_controls INTEGER,
  report_url VARCHAR(500),
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log table
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  actor_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  result VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_tenant_action (tenant_id, created_at)
);

-- Enable Row-Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Policies enforce data isolation per tenant
CREATE POLICY tenant_isolation ON tenants
  USING (id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY usage_isolation ON usage_events
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## Phase 3: Billing & Metering

### 3.1 Metering Events

```json
{
  "event_id": "evt_xxxxx",
  "timestamp": "2026-01-19T10:30:00Z",
  "tenant_id": "tnnt_xxxxx",
  "event_type": "compliance_scan",
  "details": {
    "framework": "soc2",
    "controls_evaluated": 50,
    "duration_seconds": 35
  },
  "billable": true,
  "unit_cost": 5.00
}
```

### 3.2 Tier Pricing Model

| Metric | Healthcare | Fintech | Gov-Federal | Standard |
|--------|-----------|---------|-------------|----------|
| Base Monthly | $15,000 | $8,000 | $25,000 | $2,000 |
| Per API Call | $0.0005 | $0.0003 | $0.0004 | $0.0001 |
| Compliance Scan | $50 | $35 | $75 | $15 |
| Support Tier | Premium | Standard | Premium | Basic |

---

## Phase 4: Deployment Orchestration Service

### 4.1 Orchestration Flow

```
Tenant Created (API) 
    ↓
Validate Configuration
    ↓
Generate Terraform Variables
    ↓
Run terraform plan (with approval)
    ↓
Run terraform apply
    ↓
Bootstrap Account (SSO, CloudTrail, etc.)
    ↓
Run Compliance Baseline Scan
    ↓
Generate Initial Report
    ↓
Notify Customer (Webhook + Email)
    ↓
Tenant Ready (status = "active")
```

### 4.2 Error Handling & Rollback

- Terraform plan failures → mark tenant as "provisioning_failed"
- Account creation failures → retry with exponential backoff
- Compliance failures → escalate to human review

---

## Phase 5: Observability & Monitoring

### 5.1 Metrics to Track

- **Platform Health**: API latency, error rates, deployment success rate
- **Tenant Health**: Compliance drift, configuration changes, policy violations
- **Billing**: Revenue, usage trends, customer tier distribution

### 5.2 Dashboards

- **Admin Dashboard**: System health, customer overview, billing summary
- **Tenant Dashboard**: Compliance status, usage metrics, cost analysis
- **SRE Dashboard**: Infrastructure health, deployment pipeline, alerts

---

## Phase 6: Compliance & Security

### 6.1 Data Isolation
- Each tenant's data segregated using PostgreSQL RLS
- Audit logs immutable; stored in S3 with Object Lock

### 6.2 API Security
- OAuth2 + API keys for authentication
- Rate limiting per tenant (API calls/minute)
- IP whitelisting for government tier

### 6.3 Tenant Isolation
- Separate AWS accounts per tenant (blast radius containment)
- Tier-specific guardrails prevent cross-tenant access
- Encrypted secrets for cross-account role assumption

---

## Implementation Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| 1: API & Orchestration | 4 weeks | REST API, Terraform wrapper, basic auth |
| 2: Database & Multi-tenancy | 3 weeks | PostgreSQL schema, RLS policies, migrations |
| 3: Billing | 2 weeks | Usage metering, invoice generation, billing reports |
| 4: Dashboard | 3 weeks | Admin + tenant dashboards, real-time updates |
| 5: Observability | 2 weeks | Logging, metrics, alerting |
| 6: Operations & Scale | 2 weeks | CI/CD, runbooks, disaster recovery |

**Total: 16 weeks to MVP**

---

## Success Metrics

1. ✓ Deploy first tenant in < 5 minutes
2. ✓ 99.9% uptime for control plane
3. ✓ Sub-second API response times (p99)
4. ✓ Zero unplanned tenant downtime
5. ✓ 100% compliance scan accuracy
6. ✓ < $2/tenant/month operational cost

---

## See Also

- [Multi-Tenant Deployment Guide](MULTI_TENANT_GUIDE.md)
- [API Reference](../docs/api-reference.md) (to be created)
- [Runbook: Disaster Recovery](../docs/runbooks/dr.md) (to be created)
