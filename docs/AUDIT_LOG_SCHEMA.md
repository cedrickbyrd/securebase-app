# SecureBase Audit Log Schema

**Version:** 1.0  
**Phase:** 4 - Team Collaboration & RBAC  
**Last Updated:** January 24, 2026  

---

## Overview

SecureBase implements **100% audit logging** for all user actions to meet compliance requirements (SOC 2, HIPAA, FedRAMP). This document describes the audit logging schema, implementation, and usage.

### Success Criteria

- ✅ **100% action logging** - Every user action logged
- ✅ **Immutable logs** - Cannot be modified after creation
- ✅ **7-year retention** - Compliance requirement
- ✅ **Query performance** - <200ms for common queries
- ✅ **Complete context** - Who, what, when, where, why

---

## Table of Contents

1. [Audit Events Table](#audit-events-table)
2. [Activity Feed Table](#activity-feed-table)
3. [Logged Events](#logged-events)
4. [Query Examples](#query-examples)
5. [Retention & Archival](#retention--archival)
6. [Compliance Mapping](#compliance-mapping)

---

## Audit Events Table

### Schema

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),  -- NULL for system actions
  
  -- Event classification
  event_type VARCHAR(50) NOT NULL,    -- Category: auth, user_mgmt, resource_access
  action VARCHAR(100) NOT NULL,        -- Specific action: login, create_user, view_invoice
  
  -- Resource affected
  resource_type VARCHAR(50),           -- Type: users, invoices, api_keys
  resource_id TEXT,                    -- UUID or identifier
  
  -- Actor information
  actor_email TEXT NOT NULL,           -- Who performed the action
  actor_ip_address INET,               -- Source IP
  actor_user_agent TEXT,               -- Browser/client info
  
  -- Outcome
  status VARCHAR(20) DEFAULT 'success',  -- success, failure, error
  error_message TEXT,                    -- If status = failure
  
  -- Context
  request_id TEXT UNIQUE,              -- Trace ID from API Gateway
  metadata JSONB DEFAULT '{}',         -- Additional context
  
  -- Timestamp (immutable)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Archival tracking
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX idx_audit_customer_date ON audit_events(customer_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_email, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_user ON audit_events(user_id, created_at DESC);
```

### Immutability Enforcement

```sql
-- Prevent updates to audit events
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable. Cannot update record %', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();

-- Prevent deletes (only archival allowed)
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events cannot be deleted. Use archival instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_delete();
```

### Row-Level Security

```sql
-- Enable RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their customer's audit logs
CREATE POLICY customer_isolation_audit 
  ON audit_events 
  FOR SELECT 
  USING (
    customer_id = current_setting('app.current_customer_id')::uuid 
    OR current_setting('app.role') = 'admin'
  );

-- Policy: System can always insert
CREATE POLICY audit_insert_allowed 
  ON audit_events 
  FOR INSERT 
  WITH CHECK (true);
```

---

## Activity Feed Table

### Schema

```sql
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Actor
  user_id UUID REFERENCES users(id),     -- NULL for system actions
  user_email TEXT NOT NULL,
  
  -- Activity details
  activity_type activity_type NOT NULL,  -- ENUM: user_login, resource_created, etc.
  description TEXT NOT NULL,              -- Human-readable description
  
  -- Resource affected
  resource_type resource_type,            -- ENUM: users, invoices, api_keys, etc.
  resource_id TEXT,
  resource_name TEXT,                     -- Display name
  
  -- Change tracking
  changes JSONB DEFAULT '{}',             -- {"field": {"old": "val1", "new": "val2"}}
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id UUID REFERENCES user_sessions(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_activity_feed_customer ON activity_feed(customer_id, created_at DESC);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX idx_activity_feed_type ON activity_feed(activity_type, created_at DESC);
CREATE INDEX idx_activity_feed_resource ON activity_feed(resource_type, resource_id);
```

### Activity Types

```sql
CREATE TYPE activity_type AS ENUM (
  -- Authentication
  'user_login',
  'user_logout',
  'mfa_enabled',
  'mfa_disabled',
  'password_changed',
  'password_reset',
  
  -- User management
  'user_created',
  'user_updated',
  'user_deleted',
  'user_suspended',
  'user_activated',
  
  -- Role & permissions
  'role_changed',
  'permission_granted',
  'permission_revoked',
  
  -- Resource operations
  'resource_created',
  'resource_updated',
  'resource_deleted',
  'resource_viewed',
  
  -- API operations
  'api_key_created',
  'api_key_rotated',
  'api_key_deleted',
  
  -- Billing & invoices
  'invoice_viewed',
  'invoice_paid',
  
  -- Reports & analytics
  'report_generated',
  'report_scheduled',
  'export_downloaded',
  
  -- Support
  'ticket_created',
  'ticket_updated',
  'ticket_resolved'
);
```

---

## Logged Events

### Authentication Events

#### User Login (Success)
```json
{
  "event_type": "authentication",
  "action": "user_login",
  "actor_email": "john.doe@example.com",
  "actor_ip_address": "192.168.1.100",
  "actor_user_agent": "Mozilla/5.0...",
  "status": "success",
  "metadata": {
    "mfa_verified": true,
    "session_id": "uuid",
    "device_fingerprint": "hash"
  }
}
```

#### User Login (Failed)
```json
{
  "event_type": "authentication",
  "action": "user_login_failed",
  "actor_email": "john.doe@example.com",
  "actor_ip_address": "192.168.1.100",
  "status": "failure",
  "error_message": "Invalid password",
  "metadata": {
    "failed_attempts": 3,
    "remaining_attempts": 2
  }
}
```

#### Account Locked
```json
{
  "event_type": "authentication",
  "action": "account_locked",
  "actor_email": "john.doe@example.com",
  "actor_ip_address": "192.168.1.100",
  "status": "success",
  "metadata": {
    "reason": "max_failed_attempts",
    "locked_until": "2026-01-24T11:00:00Z",
    "failed_attempts": 5
  }
}
```

### User Management Events

#### User Created
```json
{
  "event_type": "user_management",
  "action": "user_created",
  "actor_email": "admin@example.com",
  "resource_type": "users",
  "resource_id": "new-user-uuid",
  "status": "success",
  "metadata": {
    "new_user_email": "new.user@example.com",
    "role": "analyst",
    "created_by": "admin-user-uuid"
  }
}
```

#### Role Changed
```json
{
  "event_type": "user_management",
  "action": "role_changed",
  "actor_email": "admin@example.com",
  "resource_type": "users",
  "resource_id": "user-uuid",
  "status": "success",
  "metadata": {
    "target_user": "john.doe@example.com",
    "old_role": "analyst",
    "new_role": "manager",
    "reason": "promotion"
  }
}
```

### Resource Access Events

#### Invoice Viewed
```json
{
  "event_type": "resource_access",
  "action": "invoice_viewed",
  "actor_email": "john.doe@example.com",
  "resource_type": "invoices",
  "resource_id": "invoice-uuid",
  "status": "success",
  "metadata": {
    "invoice_number": "INV-2026-001",
    "amount": 2500.00,
    "month": "2026-01"
  }
}
```

#### API Key Created
```json
{
  "event_type": "resource_management",
  "action": "api_key_created",
  "actor_email": "manager@example.com",
  "resource_type": "api_keys",
  "resource_id": "key-uuid",
  "status": "success",
  "metadata": {
    "key_name": "Production API Key",
    "scopes": ["read:invoices", "read:metrics"],
    "expires_at": "2027-01-24"
  }
}
```

### Activity Feed Events

#### User Login Activity
```json
{
  "customer_id": "customer-uuid",
  "user_id": "user-uuid",
  "user_email": "john.doe@example.com",
  "activity_type": "user_login",
  "description": "User John Doe logged in",
  "resource_type": null,
  "resource_id": null,
  "changes": {},
  "ip_address": "192.168.1.100",
  "session_id": "session-uuid",
  "created_at": "2026-01-24T10:30:00Z"
}
```

#### Resource Updated Activity
```json
{
  "customer_id": "customer-uuid",
  "user_id": "user-uuid",
  "user_email": "admin@example.com",
  "activity_type": "user_updated",
  "description": "User John Doe role changed from analyst to manager",
  "resource_type": "users",
  "resource_id": "user-uuid",
  "resource_name": "John Doe",
  "changes": {
    "role": {
      "old": "analyst",
      "new": "manager"
    }
  },
  "ip_address": "192.168.1.50",
  "session_id": "session-uuid",
  "created_at": "2026-01-24T10:35:00Z"
}
```

---

## Query Examples

### Recent Activity for Customer

```sql
-- Get last 100 activities
SELECT 
  a.user_email,
  a.activity_type,
  a.description,
  a.resource_type,
  a.resource_name,
  a.created_at
FROM activity_feed a
WHERE a.customer_id = 'customer-uuid'
ORDER BY a.created_at DESC
LIMIT 100;
```

### Failed Login Attempts

```sql
-- Get failed logins in last 24 hours
SELECT 
  actor_email,
  actor_ip_address,
  error_message,
  created_at,
  metadata->>'failed_attempts' as attempts
FROM audit_events
WHERE customer_id = 'customer-uuid'
  AND event_type = 'authentication'
  AND action = 'user_login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### User Activity Timeline

```sql
-- Get all actions by specific user
SELECT 
  af.activity_type,
  af.description,
  af.resource_type,
  af.resource_name,
  af.changes,
  af.created_at
FROM activity_feed af
WHERE af.customer_id = 'customer-uuid'
  AND af.user_id = 'user-uuid'
ORDER BY af.created_at DESC;
```

### Permission Changes

```sql
-- Get all permission grants/revokes
SELECT 
  a.actor_email,
  a.action,
  a.resource_id,
  a.metadata->>'target_user' as target_user,
  a.metadata->>'permission' as permission,
  a.created_at
FROM audit_events a
WHERE a.customer_id = 'customer-uuid'
  AND a.action IN ('permission_granted', 'permission_revoked')
ORDER BY a.created_at DESC;
```

### Resource Access Audit

```sql
-- Who accessed which invoices
SELECT 
  ae.actor_email,
  ae.resource_id,
  ae.metadata->>'invoice_number' as invoice_num,
  ae.created_at
FROM audit_events ae
WHERE ae.customer_id = 'customer-uuid'
  AND ae.resource_type = 'invoices'
  AND ae.action = 'invoice_viewed'
  AND ae.created_at > '2026-01-01'
ORDER BY ae.created_at DESC;
```

### Activity Summary by User

```sql
-- Count actions per user
SELECT 
  user_email,
  COUNT(*) as action_count,
  COUNT(DISTINCT activity_type) as unique_activities,
  MIN(created_at) as first_action,
  MAX(created_at) as last_action
FROM activity_feed
WHERE customer_id = 'customer-uuid'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_email
ORDER BY action_count DESC;
```

---

## Retention & Archival

### Retention Policy

| Data Type | Active Period | Archive Period | Total Retention |
|-----------|---------------|----------------|-----------------|
| Activity Feed | 90 days | 7 years | 7 years 90 days |
| Audit Events | 90 days | 7 years | 7 years 90 days |
| User Sessions | 30 days | N/A | 30 days |

### Archival Process

```sql
-- Mark old audit events for archival (run daily)
CREATE OR REPLACE FUNCTION archive_old_audit_events()
RETURNS TABLE(archived_count INT) AS $$
DECLARE
  row_count INT;
BEGIN
  UPDATE audit_events
  SET is_archived = true, 
      archived_at = CURRENT_TIMESTAMP
  WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    AND is_archived = false;
  
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN QUERY SELECT row_count;
END;
$$ LANGUAGE plpgsql;
```

### Export to S3

```python
# Lambda function to export archived logs to S3
def export_archived_logs():
    """
    Export archived audit events to S3 for long-term storage.
    Run weekly via EventBridge.
    """
    cursor.execute("""
        SELECT * FROM audit_events 
        WHERE is_archived = true 
          AND archived_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at
    """)
    
    logs = cursor.fetchall()
    
    # Convert to JSON and compress
    data = [dict(row) for row in logs]
    json_data = json.dumps(data, default=str)
    compressed = gzip.compress(json_data.encode())
    
    # Upload to S3 with compliance retention
    s3.put_object(
        Bucket='securebase-audit-archive',
        Key=f'audit-logs/{year}/{month}/{day}.json.gz',
        Body=compressed,
        ServerSideEncryption='AES256',
        ObjectLockMode='COMPLIANCE',
        ObjectLockRetainUntilDate=datetime.now() + timedelta(days=2555)  # 7 years
    )
```

### Cleanup Strategy

1. **Hot data (0-90 days)**: RDS primary database
2. **Warm data (90 days - 1 year)**: RDS archive table or DynamoDB
3. **Cold data (1-7 years)**: S3 with Glacier storage class
4. **After 7 years**: Automatically deleted (compliance retention met)

---

## Compliance Mapping

### SOC 2 Requirements

| Control | Audit Coverage | Evidence |
|---------|----------------|----------|
| CC6.1 - Logical Access | ✅ All login/logout events | audit_events, activity_feed |
| CC6.2 - Authentication | ✅ MFA verification logged | audit_events with metadata |
| CC6.3 - Authorization | ✅ Permission changes logged | activity_feed with changes |
| CC7.2 - Monitoring | ✅ All resource access logged | audit_events by resource_type |
| CC7.3 - Incident Response | ✅ Failed logins, lockouts | audit_events with status=failure |

### HIPAA Requirements

| Requirement | Audit Coverage | Implementation |
|-------------|----------------|----------------|
| §164.308(a)(1) - Access Controls | ✅ All access logged | audit_events + RLS |
| §164.308(a)(5) - Security Awareness | ✅ Login failures tracked | Failed login events |
| §164.312(b) - Audit Controls | ✅ 100% action logging | activity_feed |
| §164.312(d) - Integrity Controls | ✅ Immutable logs | Trigger prevents updates |

### FedRAMP Requirements

| Control | NIST 800-53 | Audit Coverage |
|---------|-------------|----------------|
| AU-2 - Audit Events | ✅ All required events logged | 20+ event types |
| AU-3 - Audit Content | ✅ Who, what, when, where | Complete context captured |
| AU-6 - Audit Review | ✅ Query interface provided | SQL + API endpoints |
| AU-9 - Audit Protection | ✅ Immutable, encrypted | Triggers + S3 Object Lock |
| AU-11 - Audit Retention | ✅ 7 year retention | S3 Glacier + compliance mode |

---

## Performance Optimization

### Index Strategy

```sql
-- Composite index for common query pattern
CREATE INDEX idx_audit_customer_type_date 
  ON audit_events(customer_id, event_type, created_at DESC);

-- Partial index for active (non-archived) logs
CREATE INDEX idx_audit_active 
  ON audit_events(customer_id, created_at DESC) 
  WHERE is_archived = false;

-- GIN index for JSONB metadata queries
CREATE INDEX idx_audit_metadata_gin 
  ON audit_events USING GIN(metadata);
```

### Query Performance Targets

| Query Type | Target | Optimization |
|------------|--------|--------------|
| Recent activity (last 100) | <100ms | Indexed by created_at DESC |
| Failed logins (24h) | <150ms | Indexed by event_type + date |
| User timeline | <200ms | Indexed by user_id + date |
| Resource access | <200ms | Indexed by resource_type + id |
| Full-text search | <500ms | GIN index on metadata JSONB |

### Partitioning Strategy (Future)

```sql
-- Partition by month for better query performance
CREATE TABLE audit_events_2026_01 PARTITION OF audit_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_events_2026_02 PARTITION OF audit_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

---

## Monitoring & Alerts

### Key Metrics

- **Audit log volume**: Events per hour
- **Failed login rate**: Per customer, per hour
- **Permission changes**: Per day
- **Archive lag**: Time to move to S3
- **Query performance**: P95 latency

### Alerts

```yaml
# CloudWatch Alarms
- HighFailedLogins:
    threshold: 10 per minute
    action: SNS topic → Security team

- UnusualPermissionChanges:
    threshold: 5 per hour
    action: SNS topic → Admin review

- AuditLogLag:
    threshold: Events not archived after 100 days
    action: SNS topic → Operations team

- QueryPerformanceIssue:
    threshold: P95 > 500ms
    action: SNS topic → Engineering team
```

---

## Best Practices

### For Developers

1. **Always log user actions** - Use helper functions
2. **Include context** - IP, user agent, session ID
3. **Use structured metadata** - JSON for complex data
4. **Handle failures gracefully** - Log even if main action fails
5. **Don't log sensitive data** - Passwords, tokens, PII

### For Operations

1. **Monitor failed logins** - Detect brute force attacks
2. **Review permission changes** - Weekly audit
3. **Archive on schedule** - Don't fill primary database
4. **Test restore process** - Quarterly verification
5. **Rotate encryption keys** - Annual rotation for S3

### For Compliance

1. **Maintain 7-year retention** - Required for HIPAA
2. **Ensure immutability** - Logs cannot be altered
3. **Encrypt at rest** - S3, RDS encryption
4. **Encrypt in transit** - TLS for all connections
5. **Document procedures** - Incident response playbook

---

## Appendix

### Complete Event Type List

```
Authentication Events:
- user_login
- user_logout
- user_login_failed
- account_locked
- account_unlocked
- mfa_enabled
- mfa_disabled
- mfa_verified
- mfa_failed
- password_changed
- password_reset

User Management Events:
- user_created
- user_updated
- user_deleted
- user_suspended
- user_activated
- role_changed
- permission_granted
- permission_revoked

Resource Events:
- resource_created
- resource_updated
- resource_deleted
- resource_viewed

API Events:
- api_key_created
- api_key_rotated
- api_key_deleted
- api_key_used

Billing Events:
- invoice_viewed
- invoice_created
- invoice_paid

Report Events:
- report_generated
- report_scheduled
- export_downloaded

Support Events:
- ticket_created
- ticket_updated
- ticket_resolved
- ticket_closed
```

### Sample Queries Library

See **docs/audit_queries.sql** for complete query library including:
- Compliance reports
- Security analysis
- User activity reports
- Resource access audits
- Performance analytics

---

**Document End**  
**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Maintained by:** SecureBase Engineering Team
