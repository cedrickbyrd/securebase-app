# SecureBase Phase 2: Serverless Backend Implementation Guide

**Status:** Ready for Implementation  
**Estimated Timeline:** 4-6 weeks  
**Team Size:** 2 developers

---

## Quick Start: What Was Just Designed

### 1. **Database Layer** ✅
- **Aurora Serverless v2 PostgreSQL** (scales 0.5-4 ACUs)
- **RDS Proxy** (connection pooling, 100 concurrent)
- **3 DynamoDB Tables** (metrics, events, cache)
- **Row-Level Security (RLS)** (automatic data isolation)

### 2. **Compute Layer** ✅
- **Lambda Functions** (stateless, auto-scaling)
- **API Gateway** (REST/GraphQL entry point)
- **EventBridge** (scheduled billing, event-driven workflows)
- **SES** (email notifications)

### 3. **Security Layer** ✅
- **KMS Encryption** (at-rest, in-transit TLS 1.3)
- **API Key Authentication** (hashed, scoped)
- **RLS Policies** (customer isolation enforced at DB level)
- **Audit Trail** (immutable, 7-year retention)

---

## Implementation Roadmap

### **Phase 2a: Infrastructure (Week 1-2)**

```bash
# Deploy database infrastructure
cd landing-zone
terraform apply -target=module.phase2-database

# Verify outputs
terraform output rds_proxy_endpoint
terraform output dynamodb_metrics_table
```

**Deliverables:**
- [ ] Aurora cluster running (verified in RDS console)
- [ ] RDS Proxy responding on port 5432
- [ ] DynamoDB tables created with TTL enabled
- [ ] KMS key created and accessible
- [ ] RDS admin secret in Secrets Manager

### **Phase 2b: Database Schema (Week 1-2)**

```bash
# Connect to Aurora via RDS Proxy
psql -h <RDS_PROXY_ENDPOINT> -U adminuser -d securebase

# Run schema initialization
psql -h <RDS_PROXY_ENDPOINT> -U adminuser -d securebase < schema.sql
```

**Schema includes:**
- Customers table (with tier-based features)
- Usage metrics tracking
- Invoice generation & storage
- Audit events (immutable)
- API key management
- Support tickets
- Notifications

**Key Features:**
- RLS policies active on all sensitive tables
- TTL policies for archive data
- Indexes optimized for common queries
- Foreign key constraints for referential integrity

### **Phase 2c: API Implementation (Week 2-4)**

**File Structure:**
```
phase2-backend/
├── functions/
│   ├── auth.py (authentication + session management)
│   ├── billing-worker.py (monthly invoice calculation)
│   ├── invoices-api.py (GET /invoices, GET /invoices/{id})
│   ├── metrics-api.py (GET /metrics)
│   ├── customers-api.py (GET /customers/{id})
│   ├── audit-api.py (GET /audit-events)
│   └── support-api.py (POST /support-tickets, etc)
├── layers/
│   └── db-connection/ (shared DB utilities)
├── tests/
│   ├── test_auth.py
│   ├── test_rls_isolation.py
│   └── test_billing.py
└── requirements.txt
```

**Environment Variables (Lambda):**
```
RDS_ENDPOINT=securebase-phase2-proxy-dev.proxy-xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
DB_NAME=securebase
RDS_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:securebase/dev/rds/admin-password
CACHE_TABLE=securebase-cache-dev
EVENTS_TABLE=securebase-events-dev
METRICS_TABLE=securebase-metrics-dev
JWT_SECRET=change-me-in-production
```

### **Phase 2d: Testing & Hardening (Week 3-5)**

**RLS Isolation Tests:**
```python
# Test 1: Verify customer isolation
def test_customer_cannot_access_other_invoices():
    # Login as customer A
    auth_response = authenticate_api_key('customer_a_key')
    customer_a_id = auth_response['customer_id']
    
    # Try to query customer B's invoices
    response = get_invoices_for_customer('customer_b_id')
    
    # Should return 0 results (RLS enforced)
    assert response['count'] == 0
```

**Security Tests:**
```python
# Test 2: Verify API key hashing
def test_api_key_not_stored_plaintext():
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    assert key_hash != api_key  # Never match

# Test 3: Verify JWT expiration
def test_session_token_expires():
    old_token = jwt.encode({'exp': datetime.utcnow() - timedelta(hours=1)}, SECRET)
    assert validate_session_token(old_token) is None
```

### **Phase 2e: Go-Live (Week 5-6)**

**Pre-Launch Checklist:**
- [ ] Aurora backup tested & verified (manual restore)
- [ ] RLS policies tested with multi-customer data
- [ ] API load testing (100+ concurrent users)
- [ ] Security audit completed (no SQL injection vulnerabilities)
- [ ] Compliance: SOC 2 control evidence collected
- [ ] Customer portal tested (login, invoice view, export)
- [ ] Billing calculation verified with test data
- [ ] Email templates approved by marketing
- [ ] Payment integration (Stripe/AWS Marketplace) tested

**Launch Steps:**
1. Migrate first customer data to PostgreSQL
2. Enable API key generation in portal
3. Activate monthly billing schedule
4. Monitor: CloudWatch dashboards, error rates, latency
5. Gradual rollout: Week 1 (pilot), Week 2-4 (50%), Week 5+ (100%)

---

## Integration with Phase 1 (AWS Landing Zone)

**How Phase 2 reads Phase 1 data:**

```python
# EventBridge: AWS Organizations account events
# → DynamoDB (real-time metrics)
# → Lambda (triggered on new account, policy change, etc.)
# → Aurora (aggregated usage + audit trail)

# Example: New account created in customer's org
# 1. AWS Organizations generates event
# 2. EventBridge routes to securebase-account-created Lambda
# 3. Lambda increments customer's account_count in usage_metrics
# 4. Monthly worker reads usage_metrics and calculates charges
```

**API Integration Points:**

| Phase 1 (Infrastructure) | Phase 2 (SaaS Platform) |
|--------------------------|------------------------|
| AWS Organization ID → | customers.aws_org_id |
| Account count (via AWS API) → | usage_metrics.account_count |
| CloudTrail logs → | audit_events.cloudtrail_events_logged |
| GuardDuty findings → | usage_metrics.guardduty_findings |
| Customer self-service → | Customer portal (React frontend) |

---

## Cost Optimization Tips

### 1. **Connection Pooling**
- RDS Proxy reduces Lambda cold starts from 5s → 100ms
- Cost: ~$0.015/hour (included in Terraform)

### 2. **Reserved Capacity (Future)**
- Aurora Reserved Instances: 40% discount on compute
- DynamoDB Reserved Capacity: 25% discount on throughput
- Recommended after 3 months of production data

### 3. **Data Tiering**
- Hot data (0-90 days): Aurora + DynamoDB
- Warm data (90-365 days): S3 Standard
- Cold data (365+ days): S3 Glacier Deep Archive ($0.00099/GB/month)

### 4. **Lambda Optimization**
- Use 1024 MB memory (best price/performance)
- Estimated cost: $0.02 per 1M invocations
- Current projection: 10M invocations/month = $0.20

---

## Monitoring & Alerting

**CloudWatch Dashboards (auto-create):**

```
SecureBase/Database:
  - Aurora CPU utilization
  - Database connections (via RDS Proxy)
  - Query latency (p50, p99)
  - Storage used (GB)

SecureBase/API:
  - Lambda invocations
  - Lambda errors
  - API response time
  - 4xx/5xx rates

SecureBase/Billing:
  - Invoices processed (monthly)
  - Invoice errors
  - Total revenue (all tiers combined)
  - Per-customer charges

SecureBase/Security:
  - Failed auth attempts
  - RLS policy violations (should be 0)
  - Encryption operations
  - Audit events logged
```

**Critical Alerts:**
```
CRITICAL: Aurora connection pool exhausted
CRITICAL: RLS bypass attempt detected
CRITICAL: Billing calculation failed
WARNING: Database CPU > 80% (auto-scale up)
WARNING: API errors > 1%
```

---

## Customer Communication (Phase 2 Launch)

### **Email Template: API Key Generation**
```
Subject: Your SecureBase API Key is Ready

Dear {customer_name},

Your SecureBase API key has been generated!

Start Date: {date}
Billing Period: Monthly, on the 1st
Invoice Delivery: Automatic email to {billing_email}

API Documentation: https://docs.securebase.io/api

Your API Key (save securely):
sk_live_{customer_id}_{random_suffix}

Questions? Reply to this email or contact support@securebase.io
```

### **Portal Feature: Billing Dashboard**
```
Current Month Usage:
  • Accounts: 15 / 20 allowed
  • Estimated Charges: $2,450
  • Projected Total: $8,450 (base) + $450 (usage) = $8,900

Previous Invoices:
  • December 2025: $8,650 (paid)
  • November 2025: $8,200 (paid)
  • October 2025: $8,050 (paid)
```

---

## Next Steps (After Phase 2)

### **Phase 3: Customer Portal (Weeks 7-12)**
- React frontend for login, invoice view, settings
- Compliance reporting (SOC 2, HIPAA, etc.)
- Support ticket system
- Usage analytics & forecasting

### **Phase 4: Advanced Features (Weeks 13+)**
- Multi-cloud support (GCP, Azure)
- Custom compliance frameworks
- Terraform workspace management UI
- ChatOps integration (Slack billing alerts)
- Terraform module marketplace

---

## Success Metrics

**Technical:**
- API latency < 200ms (p99)
- Database availability > 99.95%
- Zero RLS violations (audit)
- Cost per invoice < $0.10

**Business:**
- Customer self-service adoption > 80%
- Invoice accuracy 100%
- Support ticket volume < 5/month
- Customer retention > 95%

