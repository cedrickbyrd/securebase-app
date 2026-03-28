# Compliance Drift Detection Guide

## Overview

Compliance drift occurs when a security control or configuration changes from a compliant state to non-compliant without proper authorization or notification. SecureBase's drift detection system continuously monitors your infrastructure to identify, alert, and track remediation of drift events.

**Key Benefits:**
- Real-time detection of compliance violations
- Root cause analysis and remediation tracking
- Historical trend analysis (Mean Time to Resolve)
- Proactive prevention through automation

---

## Table of Contents

1. [Understanding Drift](#understanding-drift)
2. [How Drift Detection Works](#how-drift-detection-works)
3. [Drift Detection Timeline](#drift-detection-timeline)
4. [Drift Event Lifecycle](#drift-event-lifecycle)
5. [Root Cause Analysis](#root-cause-analysis)
6. [Remediation Workflows](#remediation-workflows)
7. [Analytics & Metrics](#analytics--metrics)
8. [Prevention Strategies](#prevention-strategies)
9. [Best Practices](#best-practices)
10. [FAQ](#faq)

---

## Understanding Drift

### What is Compliance Drift?

**Definition**: An unauthorized or unintended change to a security control or configuration that causes it to transition from a **compliant** state to a **non-compliant** state.

### Common Examples

#### 1. Password Policy Weakening
- **Compliant State**: Password minimum length = 14 characters, complexity required
- **Drift Event**: Admin reduces minimum to 8 characters without approval
- **Impact**: SOC 2 Type II violation, audit finding
- **Detection Time**: Immediate (CloudWatch Events)

#### 2. MFA Deactivation
- **Compliant State**: MFA required for all privileged accounts
- **Drift Event**: User disables MFA on their admin account
- **Impact**: HIPAA Technical Safeguard violation
- **Detection Time**: Within 5 minutes (AWS Config rule evaluation)

#### 3. Security Group Rule Addition
- **Compliant State**: No inbound SSH from 0.0.0.0/0
- **Drift Event**: Developer adds rule allowing SSH from internet
- **Impact**: PCI-DSS Requirement 1.3 violation
- **Detection Time**: Immediate (VPC Flow Log analysis)

#### 4. Audit Log Retention Change
- **Compliant State**: CloudTrail logs retained for 7 years (SOC 2 requirement)
- **Drift Event**: S3 lifecycle policy changed to 30 days
- **Impact**: Audit evidence loss, compliance certification risk
- **Detection Time**: Within 1 hour (DynamoDB stream processing)

#### 5. Encryption Key Rotation Failure
- **Compliant State**: KMS keys rotated annually
- **Drift Event**: Key rotation disabled or delayed past due date
- **Impact**: GDPR Article 32 (Security of Processing) violation
- **Detection Time**: Daily batch job check

---

## How Drift Detection Works

### Detection Mechanisms

SecureBase uses multiple layers of drift detection:

#### 1. AWS Config Rules (Real-time)
- Evaluates resource configurations against compliance policies
- Triggers on resource changes (CloudWatch Events)
- Covers: IAM, S3, EC2, RDS, Lambda, KMS, CloudTrail

**Example Config Rule**:
```python
# Rule: MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS
def evaluate_compliance(config_item):
    user = config_item['configuration']
    if user.get('passwordEnabled'):
        if not user.get('mfaDevices'):
            return 'NON_COMPLIANT'
    return 'COMPLIANT'
```

#### 2. CloudWatch Events (Immediate)
- Captures API calls via CloudTrail
- Pattern matching for high-risk actions
- Sub-second notification latency

**Example Event Pattern**:
```json
{
  "source": ["aws.iam"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventName": ["DeactivateMFADevice", "DeleteAccessKey"]
  }
}
```

#### 3. Custom Lambda Scanners (Scheduled)
- Hourly/daily scans for complex compliance checks
- Cross-account aggregation
- Integration with third-party tools (Tenable, Qualys)

**Example Scanner**:
```python
def scan_password_policies():
    """Check password policies across all AWS accounts"""
    for account in get_managed_accounts():
        policy = iam.get_account_password_policy(AccountId=account)
        if policy['MinimumPasswordLength'] < 14:
            create_drift_event(
                control_id='AC-2',
                severity='critical',
                account_id=account
            )
```

#### 4. Database Row-Level Security (RLS) Monitoring
- Detects unauthorized data access patterns
- Monitors policy changes in Aurora PostgreSQL
- Alerts on RLS policy deactivation

#### 5. Infrastructure-as-Code (IaC) Drift
- Compares live infrastructure against Terraform state
- Identifies out-of-band changes
- Integrates with terraform plan/apply workflows

---

## Drift Detection Timeline

### Visualization

The **Compliance Drift Timeline** is a 90-day interactive chart that visualizes:
- **Green line**: Overall compliance score (baseline 90-100%)
- **Red markers**: Detected drift events
- **Tooltips**: Event details on hover

### Timeline Features

#### 1. Score Trending
- Daily compliance score calculation
- Rolling 7-day average smoothing
- Framework-specific scores (SOC 2, HIPAA, PCI, GDPR)

#### 2. Event Clustering
- Groups multiple violations on same day
- Shows count badge on marker
- Expandable detail view

#### 3. Historical Analysis
- Compare periods (week-over-week, month-over-month)
- Identify recurring patterns
- Seasonal trend detection (e.g., post-deployment spikes)

### Reading the Timeline

**Example Interpretation**:
```
Day 1-60:  Score stable at 95% → Good operational controls
Day 61:    Score drops to 89% → Drift event detected (red marker)
Day 62-63: Score remains at 89% → Violation unresolved
Day 64:    Score returns to 95% → Remediation complete
```

**Key Insights**:
- **Fast recovery** (Day 61 → Day 64 = 3 days): Good incident response
- **Score delta** (95% → 89% = 6 points): Moderate severity violation
- **No recurrence**: Effective root cause fix

---

## Drift Event Lifecycle

### Stage 1: Detection

**Trigger**: Compliance check fails (Config rule, Lambda scanner, manual report)

**Auto-Generated Fields**:
- `violation_id`: Unique identifier (e.g., `viol_abc123`)
- `detection_timestamp`: ISO 8601 timestamp
- `control_id`: Mapped control (e.g., `AC-2`, `AU-2`)
- `control_name`: Human-readable name
- `framework`: Associated framework (`soc2`, `hipaa`, `pci`, `gdpr`)
- `severity`: Auto-calculated based on control criticality and framework requirements
- `previous_state`: `compliant`
- `current_state`: `non-compliant`

### Stage 2: Root Cause Analysis

**Automated RCA**:
1. Query CloudTrail for relevant API calls (5 min before/after detection)
2. Identify user/role that made the change
3. Extract change details (old value → new value)
4. Check for change approval ticket (ServiceNow, Jira)
5. Generate root cause hypothesis

**Manual RCA** (if automated fails):
- Assigned engineer investigates
- Interviews involved parties
- Reviews documentation
- Documents findings in `root_cause` field

**Example Output**:
```json
{
  "root_cause": "Password policy weakened by admin@example.com via AWS Console on 2026-03-15 10:28:15 UTC. Change was unauthorized (no change ticket found in ServiceNow).",
  "evidence": {
    "cloudtrail_event_id": "evt_cloudtrail_123",
    "user_identity": "arn:aws:iam::123456789012:user/admin",
    "api_call": "UpdateAccountPasswordPolicy",
    "parameters": {
      "MinimumPasswordLength": 8
    }
  }
}
```

### Stage 3: Remediation Planning

**Remediation Steps** (ordered list):
1. **Immediate**: Revert to compliant configuration
2. **Short-term**: Implement compensating control
3. **Long-term**: Prevent recurrence through automation

**Example**:
```markdown
1. Restore password minimum length to 14 characters via AWS Console
2. Enable CloudWatch alarm for password policy changes
3. Implement Service Control Policy (SCP) to prevent policy weakening
4. Update IaC (Terraform) to codify password policy
5. Conduct security awareness training for admin team
```

**Assignment**:
- Auto-assign to control owner (from RACI matrix)
- Escalate to security team for critical severity
- Notify compliance officer for audit-impacting violations

### Stage 4: Remediation Execution

**Status Tracking**:
- `open`: Newly detected, awaiting assignment
- `acknowledged`: Assigned engineer has seen the violation
- `in_progress`: Remediation work underway
- `resolved`: Configuration restored to compliant state
- `verified`: Post-remediation testing complete

**Progress Updates**:
- Engineers add notes via API or dashboard
- Automated checks verify remediation (e.g., AWS Config re-evaluation)
- Stakeholders receive notifications (email, Slack, PagerDuty)

### Stage 5: Resolution & Documentation

**Required Fields**:
- `resolution_timestamp`: When compliance was restored
- `resolution_notes`: Summary of actions taken
- `verified_by`: Engineer who confirmed fix

**Post-Resolution Actions**:
1. Calculate Mean Time to Resolve (MTTR)
2. Update drift analytics dashboards
3. Archive evidence for audit trail
4. Schedule post-incident review (for critical/high severity)

---

## Root Cause Analysis

### RCA Framework

SecureBase uses the **5 Whys** technique:

**Example: Password Policy Drift**

1. **Why did the control drift?**  
   → Admin changed password policy in AWS Console

2. **Why did the admin make this change?**  
   → Developer complained that 14-char passwords were "too hard to remember"

3. **Why wasn't the change approved?**  
   → No change management process for security policies

4. **Why is there no change management process?**  
   → Security policies are not codified in Infrastructure-as-Code (IaC)

5. **Why are security policies not in IaC?**  
   → Legacy setup predates IaC adoption; migration backlog

**Root Cause**: Lack of policy codification and change control

**Preventive Measures**:
1. Migrate security policies to Terraform modules
2. Implement approval workflow for Terraform changes
3. Deploy Service Control Policy (SCP) as guardrail
4. Conduct IaC training for ops team

### Common Root Causes

| Root Cause | Frequency | Prevention Strategy |
|------------|-----------|---------------------|
| Manual console changes | 45% | Enforce IaC-only deployments |
| Misconfigured automation | 25% | Add validation gates to CI/CD |
| Expired credentials | 15% | Implement auto-rotation |
| Cloud provider service changes | 10% | Subscribe to AWS Security Bulletins |
| Insider threat / malicious activity | 5% | Enhanced monitoring, least privilege |

---

## Remediation Workflows

### Workflow 1: Immediate Revert (Critical Severity)

**Trigger**: Critical compliance violation detected

**Steps**:
1. **Alert** (within 1 minute):
   - PagerDuty incident created
   - Slack message to #security-critical channel
   - Email to compliance officer
2. **Investigate** (within 15 minutes):
   - On-call engineer triages
   - Reviews automated RCA
   - Confirms security impact
3. **Remediate** (within 1 hour):
   - Revert configuration change via AWS CLI/Console
   - Verify compliance restored (AWS Config re-check)
   - Document in incident ticket
4. **Follow-up** (within 24 hours):
   - Schedule post-incident review
   - Implement preventive controls
   - Update runbooks

**SLA**: Resolve within 1 hour

### Workflow 2: Planned Remediation (High Severity)

**Trigger**: High severity drift event with business impact

**Steps**:
1. **Assess** (within 4 hours):
   - Evaluate business risk
   - Determine if immediate revert is safe
   - Plan remediation approach
2. **Schedule** (within 1 business day):
   - Create change ticket
   - Schedule maintenance window if needed
   - Notify stakeholders
3. **Execute** (within 7 days):
   - Apply remediation steps
   - Verify compliance restored
   - Monitor for side effects
4. **Document** (within 7 days):
   - Update drift event with resolution
   - Archive evidence
   - Update compliance reports

**SLA**: Resolve within 7 days

### Workflow 3: Managed Remediation (Medium/Low Severity)

**Trigger**: Medium or low severity drift event

**Steps**:
1. **Triage** (within 1 business day):
   - Review automated RCA
   - Assign to appropriate team
   - Set priority and due date
2. **Plan** (within 5 business days):
   - Research remediation options
   - Evaluate automation opportunities
   - Document approach in ticket
3. **Remediate** (within 30 days):
   - Implement fix during next sprint
   - Test in staging environment first
   - Deploy to production
4. **Verify** (within 30 days):
   - Confirm compliance restored
   - Update monitoring thresholds
   - Close drift event

**SLA**: Resolve within 30 days

---

## Analytics & Metrics

### Mean Time to Resolve (MTTR)

**Definition**: Average time from drift detection to resolution

**Calculation**:
```python
mttr = sum(resolution_time - detection_time for all resolved events) / count(resolved events)
```

**Targets by Severity**:
- **Critical**: <4 hours
- **High**: <24 hours
- **Medium**: <7 days
- **Low**: <30 days

**Improvement Strategies**:
- Automate remediation for common drift patterns
- Pre-approved runbooks for standard fixes
- Dedicated on-call rotation for critical events
- Invest in preventive controls (SCPs, Config rules)

### Drift Frequency by Category

**Top 5 Categories** (example data):
1. **Access Control** (35%): MFA, password policies, privilege escalation
2. **Audit & Accountability** (25%): Log retention, CloudTrail configuration
3. **Configuration Management** (20%): Baseline drift, unapproved changes
4. **System & Communications Protection** (15%): Encryption, network boundaries
5. **Identification & Authentication** (5%): Authenticator management, key rotation

**Use Case**: Prioritize preventive controls for high-frequency categories

### Top Drifting Controls

**Example Table**:
| Rank | Control | Drift Count | Framework | Priority |
|------|---------|-------------|-----------|----------|
| 1 | AC-2: Account Management | 8 | SOC 2, HIPAA | Implement SCP |
| 2 | IA-5: Authenticator Management | 6 | PCI, GDPR | Auto-remediation Lambda |
| 3 | AU-2: Audit Events | 5 | SOC 2 | Terraform module hardening |
| 4 | SC-7: Boundary Protection | 4 | PCI | VPC template enforcement |
| 5 | CM-2: Baseline Configuration | 3 | HIPAA | Config rule + auto-remediation |

**Action**: Focus automation efforts on top 5 controls (80/20 rule)

---

## Prevention Strategies

### Strategy 1: Infrastructure as Code (IaC)

**Approach**: Codify all security policies in Terraform/CloudFormation

**Benefits**:
- Version control for compliance configurations
- Peer review via pull requests
- Automated testing in CI/CD pipeline
- Prevents console-based drift

**Example**:
```hcl
# terraform/security_policies.tf
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_uppercase_characters   = true
  require_lowercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
  max_password_age               = 90
  password_reuse_prevention      = 24
}
```

### Strategy 2: Service Control Policies (SCPs)

**Approach**: Enforce guardrails at AWS Organizations level

**Benefits**:
- Prevents non-compliant actions even from admins
- Centrally managed across all accounts
- No way to bypass (ultimate preventive control)

**Example**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": [
        "iam:UpdateAccountPasswordPolicy",
        "iam:DeleteAccountPasswordPolicy"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::123456789012:role/SecurityAdmin"
        }
      }
    }
  ]
}
```

### Strategy 3: AWS Config Auto-Remediation

**Approach**: Automatically fix non-compliant resources

**Benefits**:
- Sub-minute remediation
- Reduces manual toil
- Consistent remediation logic

**Example Config Rule + Remediation**:
```yaml
# AWS Config Rule
ConfigRule:
  Name: s3-bucket-public-read-prohibited
  Source:
    Owner: AWS
    SourceIdentifier: S3_BUCKET_PUBLIC_READ_PROHIBITED
  Scope:
    ComplianceResourceTypes:
      - AWS::S3::Bucket

# Remediation Action
RemediationConfiguration:
  ConfigRuleName: s3-bucket-public-read-prohibited
  TargetType: SSM_DOCUMENT
  TargetIdentifier: AWS-PublishSNSNotification
  Parameters:
    AutomationAssumeRole: arn:aws:iam::123456789012:role/ConfigRemediation
    TopicArn: arn:aws:sns:us-east-1:123456789012:config-remediation
```

### Strategy 4: Continuous Compliance Monitoring

**Tools**:
- **AWS Config**: Resource compliance tracking
- **AWS Security Hub**: Aggregated security findings
- **AWS Systems Manager**: Patch compliance
- **CloudWatch Alarms**: Real-time alerting
- **Lambda Scanners**: Custom compliance checks

**Monitoring Frequency**:
- Real-time: CloudWatch Events, Config rules
- Hourly: Lambda scanners for complex checks
- Daily: Batch aggregation for reporting
- Weekly: Compliance score trending

### Strategy 5: Change Management Integration

**Approach**: Require approval for high-risk changes

**Integration Points**:
1. **ServiceNow**: Create change ticket, approval workflow
2. **Jira**: Link drift event to engineering sprint
3. **Slack**: Notifications to stakeholders
4. **GitHub**: Pull request approval for IaC changes

**Example Workflow**:
```
Developer → PR for Terraform change → 
Security review → Approval → 
Terraform apply → AWS Config verification → 
No drift detected ✓
```

---

## Best Practices

### 1. Define Clear Ownership (RACI Matrix)

| Control Category | Responsible | Accountable | Consulted | Informed |
|------------------|-------------|-------------|-----------|----------|
| Access Control | Security Team | CISO | Ops Team | All Staff |
| Audit Logs | Ops Team | VP Engineering | Legal | Auditors |
| Encryption | Security Team | CISO | DevOps | Compliance Officer |
| Network Security | Network Team | CTO | Security | Business Units |

### 2. Establish SLAs by Severity

- **Critical**: 1-hour resolution, 24/7 on-call
- **High**: 24-hour resolution, business hours support
- **Medium**: 7-day resolution, sprint planning
- **Low**: 30-day resolution, backlog prioritization

### 3. Automate Where Possible

**Automation Candidates**:
- ✅ S3 bucket public access blocking
- ✅ Default encryption enablement
- ✅ Security group rule validation
- ✅ IAM password policy enforcement
- ⚠️ Manual: Complex policy changes requiring business approval

### 4. Regular Drift Reviews

**Weekly Team Meeting**:
- Review open drift events
- Discuss blockers
- Prioritize remediation backlog
- Celebrate MTTR improvements

**Monthly Executive Report**:
- Drift trend analysis
- Top drifting controls
- MTTR by severity
- Prevention strategy ROI

### 5. Continuous Improvement

**Quarterly Retrospective**:
- Review drift events from past 90 days
- Identify systemic issues
- Update preventive controls
- Refine detection logic

**Annual Audit Preparation**:
- Export drift history for auditors
- Document remediation evidence
- Demonstrate continuous compliance
- Highlight automation investments

---

## FAQ

### Q: How quickly are drift events detected?

**A**: Detection latency varies by mechanism:
- **AWS Config rules**: 1-5 minutes
- **CloudWatch Events**: Sub-second to 1 minute
- **Lambda scanners**: 5-60 minutes (depends on schedule)
- **Manual reports**: Variable (hours to days)

### Q: Can I customize drift detection rules?

**A**: Yes. You can:
1. Add custom AWS Config rules (Lambda-backed)
2. Deploy custom Lambda scanners
3. Integrate third-party tools (Tenable, Qualys, Wiz)
4. Define custom compliance frameworks

### Q: What happens if I can't remediate drift immediately?

**A**: Document the risk acceptance:
1. Create compensating control
2. Add exception in compliance tracking system
3. Set remediation deadline
4. Notify compliance officer and auditors
5. Track as known issue in audit reports

### Q: How do I prevent false positives?

**A**: Tune detection logic:
1. Review drift event history
2. Identify recurring false positives
3. Update Config rule logic or Lambda scanner
4. Add exceptions for approved deviations
5. Test in staging environment first

### Q: Can drift detection run across multiple AWS accounts?

**A**: Yes. SecureBase supports:
- AWS Organizations aggregation
- Cross-account Config Aggregator
- Multi-region monitoring
- Consolidated reporting

### Q: How long is drift history retained?

**A**: Retention policies:
- **DynamoDB Table**: 90 days (TTL enabled)
- **S3 Archive**: 7 years (compliance requirement)
- **CloudWatch Logs**: 1 year
- **Audit Exports**: Permanent (separate storage)

---

## Additional Resources

- **AWS Config Documentation**: https://docs.aws.amazon.com/config/
- **NIST SP 800-53 Controls**: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- **CIS Benchmarks**: https://www.cisecurity.org/cis-benchmarks/
- **SecureBase Knowledge Base**: https://docs.securebase.com

---

**Document Version**: 1.0  
**Last Updated**: March 28, 2026  
**Phase**: 5.2 - Tenant Dashboard
