# Evidence Records - Data Structure & Examples

## Evidence Record Schema

```typescript
interface EvidenceRecord {
  // Identification
  id: UUID;
  customer_id: UUID;
  
  // Control Details
  control_id: string;          // "CC1.1", "164.308(a)(1)(i)", "AC-2", "CIS-1.1"
  control_name: string;        // "Control Environment - Board of Directors"
  framework: ComplianceFramework;  // "soc2" | "hipaa" | "fedramp" | "cis"
  category: EvidenceCategory;  // "CC" | "AC" | "AU" | "PI" | "CM" | "IA" | "SC" | "SI" | "RA" | "CA" | "CP"
  
  // Evidence Attributes
  evidence_type: EvidenceType;     // "policy" | "system" | "log" | "attestation" | "screenshot" | "report" | "configuration"
  source_system: string;           // "Okta" | "AWS" | "GitHub" | "Stripe" | "Google Drive"
  owner: string;                   // Email of responsible party
  collection_method: CollectionMethod;  // "automated" | "manual" | "semi_automated"
  
  // Status & Validity
  status: EvidenceStatus;      // "pass" | "fail" | "missing" | "pending" | "expired"
  last_collected: timestamp;
  valid_until: timestamp;
  next_collection: timestamp;
  
  // Artifact Reference
  artifact_ref: string;        // S3 URI: "s3://securebase-evidence/..."
  artifact_hash: string;       // SHA-256 hash for integrity
  artifact_size_bytes: bigint;
  
  // Rich Metadata with Raw Facts ⭐
  metadata: {
    // Quantifiable metrics
    okta_users?: number;
    active_users?: number;
    last_access_review?: string;
    aws_accounts_connected?: boolean;
    
    // Policy documents
    policy_docs?: Array<{
      name: string;
      version: string;
      approved_date?: string;
      approved_by?: string;
    }>;
    
    // System configurations
    password_policy?: {
      min_length: number;
      complexity: string;
      rotation_days: number;
    };
    
    // Integration status
    integrations?: string[];
    
    // Custom facts per control
    [key: string]: any;
  };
  
  // Audit Trail
  description: string;
  collected_by: string;
  reviewed_by?: string;
  reviewed_at?: timestamp;
  created_at: timestamp;
  updated_at: timestamp;
}
```

## Example Evidence Records

### SOC2 Access Control (AC1.1) - TechFlow Financial

```json
{
  "control_id": "AC1.1",
  "control_name": "Logical Access - User Access Provisioning",
  "framework": "soc2",
  "category": "AC",
  "evidence_type": "system",
  "source_system": "Okta",
  "owner": "it@techflowfin.example.com",
  "collection_method": "automated",
  "status": "pass",
  "last_collected": "2025-01-31T12:00:00Z",
  "valid_until": "2025-03-02T00:00:00Z",
  "artifact_ref": "s3://securebase-evidence/techflow/soc2/AC1.1-okta-user-audit-2025-01-31.csv",
  "artifact_hash": "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
  "metadata": {
    "okta_users": 52,
    "active_users": 48,
    "inactive_users": 4,
    "mfa_enabled": 52,
    "passwordless": 35,
    "last_access_review": "2025-01-30",
    "sso_enabled": true,
    "session_timeout_minutes": 30,
    "password_policy": {
      "min_length": 14,
      "complexity": "high",
      "rotation_days": 90
    },
    "access_policies": [
      {"name": "MFA Required", "enforced": true},
      {"name": "IP Whitelist", "enforced": true}
    ],
    "integrations": ["AWS", "GitHub", "Stripe", "Salesforce"],
    "groups": 12,
    "roles": 8
  }
}
```

### HIPAA Workforce Security (164.308(a)(3)(i)) - ACME Healthcare

```json
{
  "control_id": "164.308(a)(3)(i)",
  "control_name": "Workforce Security - Authorization/Supervision",
  "framework": "hipaa",
  "category": "AC",
  "evidence_type": "system",
  "source_system": "Okta",
  "owner": "hr@acmehealthcare.example.com",
  "collection_method": "automated",
  "status": "pass",
  "last_collected": "2025-01-30T12:00:00Z",
  "valid_until": "2025-02-28T00:00:00Z",
  "artifact_ref": "s3://securebase-evidence/acme/hipaa/164.308a3i-workforce-access-2025-01-30.csv",
  "metadata": {
    "total_employees": 245,
    "phi_access": 89,
    "admin_access": 12,
    "terminated_count": 3,
    "okta_users": 245,
    "active_users": 242,
    "last_access_review": "2025-01-30",
    "role_based_access": true,
    "phi_roles": ["Physician", "Nurse", "Lab Technician", "Billing Specialist"],
    "access_policies": [
      {"name": "PHI Access Policy", "version": "v2.3", "enforced": true},
      {"name": "Minimum Necessary Rule", "version": "v1.8", "enforced": true}
    ],
    "background_checks_completed": 245,
    "hipaa_training_completed": 242,
    "training_completion_rate": 98.8,
    "aws_accounts_connected": true
  }
}
```

### FedRAMP Account Management (AC-2) - Federal Energy

```json
{
  "control_id": "AC-2",
  "control_name": "Account Management",
  "framework": "fedramp",
  "category": "AC",
  "evidence_type": "system",
  "source_system": "AWS IAM Identity Center",
  "owner": "cloudadmin@energy.gov.example.com",
  "collection_method": "automated",
  "status": "pass",
  "last_collected": "2025-01-30T06:00:00Z",
  "valid_until": "2025-04-30T00:00:00Z",
  "artifact_ref": "s3://securebase-evidence/federal/fedramp/AC-2-account-management-2025-01-30.json",
  "metadata": {
    "total_users": 127,
    "active_users": 125,
    "disabled_users": 2,
    "privileged_users": 15,
    "review_frequency": "weekly",
    "aws_accounts_connected": true,
    "sso_enabled": true,
    "piv_required": true,
    "last_access_review": "2025-01-29",
    "account_lifecycle": {
      "provisioning": "automated",
      "deprovisioning": "automated",
      "approval_required": true
    },
    "access_certifications": {
      "last_completed": "2025-01-15",
      "frequency": "quarterly",
      "completion_rate": 100
    },
    "security_groups": 23,
    "permission_sets": 45,
    "policy_enforcement": "strict"
  }
}
```

## Evidence Categories by Framework

### SOC2 Trust Services Criteria
- **CC** - Common Criteria (control environment, communication, risk assessment)
- **AC** - Access Control
- **AU** - Audit & Accountability
- **PI** - Processing Integrity
- **CA** - Confidentiality & Privacy

### HIPAA Security Rule
- **AC** - Administrative Controls (164.308)
- **IA** - Identification & Authentication (164.312(a))
- **AU** - Audit Controls (164.312(b))
- **SC** - Security Controls (164.312(e))

### FedRAMP Controls (NIST 800-53)
- **AC** - Access Control
- **AU** - Audit and Accountability
- **CM** - Configuration Management
- **IA** - Identification and Authentication
- **SC** - System and Communications Protection
- **SI** - System and Information Integrity
- **RA** - Risk Assessment
- **CA** - Security Assessment and Authorization
- **CP** - Contingency Planning

### CIS Benchmarks
- **CM** - Configuration Management (inventory, patching)
- **AC** - Access Control
- **AU** - Audit & Logging

## Raw Facts Patterns

### User Management
```json
{
  "okta_users": 52,
  "active_users": 48,
  "inactive_users": 4,
  "last_access_review": "2025-01-30",
  "mfa_enabled": 52
}
```

### AWS Integration
```json
{
  "aws_accounts_connected": true,
  "total_accounts": 8,
  "cloudtrail_enabled": true,
  "config_recorders_active": 8
}
```

### Policy Documentation
```json
{
  "policy_docs": [
    {
      "name": "Access Control Policy",
      "version": "v1.2",
      "approved_date": "2024-01-15",
      "approved_by": "CISO"
    }
  ]
}
```

### Security Configurations
```json
{
  "password_policy": {
    "min_length": 14,
    "complexity": "high",
    "rotation_days": 90,
    "prevent_reuse": 24
  },
  "session_timeout_minutes": 30,
  "mfa_required": true
}
```

## Query Examples

### Evidence by Status
```sql
SELECT 
  framework,
  status,
  COUNT(*) as count
FROM evidence_records
GROUP BY framework, status
ORDER BY framework, status;
```

### Extract Raw Facts
```sql
SELECT 
  control_id,
  control_name,
  metadata->>'okta_users' as users,
  metadata->>'last_access_review' as last_review,
  (metadata->>'aws_accounts_connected')::boolean as aws_connected
FROM evidence_records
WHERE framework = 'soc2'
  AND status = 'pass';
```

### Evidence Expiring Soon
```sql
SELECT 
  customer_id,
  control_id,
  control_name,
  valid_until,
  EXTRACT(DAY FROM (valid_until - CURRENT_TIMESTAMP)) as days_remaining
FROM evidence_records
WHERE valid_until < CURRENT_TIMESTAMP + INTERVAL '30 days'
  AND status = 'pass'
ORDER BY valid_until ASC;
```

### Collection Frequency Analysis
```sql
SELECT 
  collection_method,
  AVG(EXTRACT(EPOCH FROM (valid_until - last_collected))/86400)::int as avg_validity_days,
  COUNT(*) as total_evidence
FROM evidence_records
WHERE status = 'pass'
GROUP BY collection_method;
```

## Benefits

### ✅ Authoritative Evidence
- Real control IDs from compliance frameworks
- Artifact references with SHA-256 integrity checks
- Audit trail with collection and review timestamps

### ✅ Quantifiable Metrics
- Raw facts provide concrete, measurable data
- Easy to verify against source systems
- Supports automated compliance reporting

### ✅ Multi-Framework Support
- SOC2, HIPAA, FedRAMP, CIS in single schema
- Consistent structure across frameworks
- Framework-specific categories and controls

### ✅ Automated Collection Ready
- Tracks collection method and frequency
- Validity periods enforce regular updates
- Next collection date for scheduling

### ✅ Audit-Ready
- Immutable artifact hashes
- Complete audit trail (who, when, what)
- Review workflow (collected_by, reviewed_by)

## Integration with Portal

The evidence records integrate with the customer portal for:

1. **Compliance Dashboard** - Visual status of controls by framework
2. **Evidence Vault** - Downloadable artifacts with integrity verification
3. **Collection Scheduler** - Automated evidence gathering
4. **Audit Reports** - Generate compliance reports for auditors
5. **Alert System** - Notifications for expiring evidence

## Next Steps

1. Deploy evidence collection Lambda functions
2. Configure automated collectors for AWS, Okta, GitHub
3. Build compliance dashboard in portal
4. Set up evidence expiration alerts
5. Create audit report generator
