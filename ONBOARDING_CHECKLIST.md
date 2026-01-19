# SecureBase PaaS - Customer Onboarding Checklist

## Customer: ACME Finance Inc

| Field | Value |
|-------|-------|
| Company Name | ACME Finance Inc |
| Tier | Fintech |
| Framework | SOC2 Type II |
| AWS Account ID | 222233334444 |
| Contact Email | john@acmefinance.com |
| Onboard Date | 2026-01-19 |
| Contract Signed | ✅ Yes |
| Payment Method | ✅ Credit Card (ending in 4242) |

---

## Pre-Deployment Checklist

### Infrastructure Validation
- [ ] Customer config in `client.auto.tfvars` is valid HCL
- [ ] AWS Account ID is unique (not already in use)
- [ ] Email format is valid
- [ ] Terraform validates without errors
- [ ] Plan shows expected OU creation + account creation

### Compliance Validation
- [ ] Framework (SOC2) is supported
- [ ] Tier (Fintech) has appropriate guardrails
- [ ] Tags are complete and correct
- [ ] Contact information captured

### Billing Validation
- [ ] Tier pricing confirmed ($8,000/month base)
- [ ] Payment method on file
- [ ] Billing email configured
- [ ] Invoice template ready

---

## Deployment Phase (7-10 minutes)

### Execution
```bash
# Step 1: Validate
terraform validate

# Step 2: Plan
terraform plan -out=tfplan

# Step 3: Review plan for:
#   - Customers-Fintech OU creation (if first fintech customer)
#   - acme account creation
#   - Policy attachments
#   - No unexpected deletions

# Step 4: Deploy
terraform apply tfplan

# Step 5: Verify in AWS Console
#   - Check Organizations → OUs
#   - Verify acme account in Customers-Fintech OU
#   - Verify policies attached
```

### Success Criteria
- [ ] No terraform errors
- [ ] AWS account created (ID: 222233334444)
- [ ] Account placed in Customers-Fintech OU
- [ ] Security policies attached
- [ ] CloudTrail logging enabled
- [ ] AWS Config recording enabled

---

## Post-Deployment Onboarding (Day 1)

### Phase 1: Access Setup (15 minutes)

**For SecureBase Team:**
- [ ] Create IAM Identity Center user for john@acmefinance.com
- [ ] Assign user to ACME Finance account
- [ ] Set temporary password
- [ ] Generate SSO login URL

**Email to Customer:**
```
Subject: SecureBase Account Ready - Action Required

Hi John,

Your ACME Finance AWS account is now provisioned and ready!

Account Details:
  AWS Account ID: 222233334444
  Organization: ACME Finance Fintech
  Tier: Fintech (SOC2)
  Status: Active

Next Steps:
  1. Log in: [SSO_LOGIN_URL]
  2. Set permanent password
  3. Configure MFA
  4. Review dashboard

Questions? Reply to this email or contact support@securebase.com

Best regards,
SecureBase Team
```

Success Criteria:
- [ ] User created in IAM Identity Center
- [ ] SSO login works
- [ ] User can access AWS account console
- [ ] User can see dashboard

---

### Phase 2: Dashboard & Configuration (20 minutes)

**Customer Self-Service:**
- [ ] User logs in to SecureBase tenant dashboard
- [ ] Reviews account details
- [ ] Checks compliance score (baseline)
- [ ] Views billing & usage

**For SecureBase Team:**
- [ ] Verify CloudTrail is logging to central account
- [ ] Confirm AWS Config is recording
- [ ] Run initial compliance scan
- [ ] Generate baseline SOC2 report

Success Criteria:
- [ ] Dashboard loads without errors
- [ ] Compliance score visible (likely ~70-80% baseline)
- [ ] CloudTrail logs flowing to central account
- [ ] AWS Config findings visible

---

### Phase 3: Initial Compliance Assessment (10 minutes)

**Automated:**
- [ ] Run SOC2 baseline assessment
- [ ] Generate compliance report PDF
- [ ] Identify policy violations
- [ ] Create remediation checklist

**Manual Review:**
- [ ] Review top 3-5 policy violations
- [ ] Determine if auto-remediation is appropriate
- [ ] Document any known exemptions

**Report Contents:**
```
SOC2 Type II Assessment - ACME Finance

Date: 2026-01-19
Framework: SOC2 Type II
Compliance Score: 76%

Controls Passing: 38/50
Controls Failing: 12/50

Critical Issues (Fix Immediately):
  1. CloudTrail not configured with immutable logging
  2. S3 bucket encryption not enforced
  3. MFA not enabled for all users

Medium Issues (Fix This Week):
  4. VPC Flow Logs not enabled
  5. CloudWatch alarms not configured

Low Issues (Fix This Month):
  6-12. Various monitoring gaps

Remediation Guide: [LINK]
Next Assessment: 2026-01-26 (automatic)
```

Success Criteria:
- [ ] Baseline report generated
- [ ] Customer can download report
- [ ] Top issues clearly documented
- [ ] Remediation path provided

---

### Phase 4: Billing & Contract (10 minutes)

**For SecureBase Team:**
- [ ] Verify billing contact email
- [ ] Set up recurring monthly invoice
- [ ] Configure automatic payment
- [ ] Add to customer list

**Customer Communication:**
```
Subject: SecureBase Billing Setup Confirmed

Hi John,

Your SecureBase billing is now configured:

Billing Details:
  Company: ACME Finance Inc
  Tier: Fintech
  Base Monthly Cost: $8,000.00
  Billing Cycle: Monthly (1st of month)
  Invoice Email: john@acmefinance.com

First Invoice: February 1, 2026
  • Base tier: $8,000.00
  • Usage charges: [calculated after month]
  • Total: [amount]

Payment Method: Credit Card ending in 4242
Billing Portal: https://billing.securebase.com

You can update your payment method or billing contact anytime.

Thanks for choosing SecureBase!
```

Success Criteria:
- [ ] Billing email confirmed with customer
- [ ] Payment method validated
- [ ] First invoice scheduled
- [ ] Customer in billing system

---

### Phase 5: Kickoff Meeting (30 minutes)

**Meeting Agenda:**
1. Welcome & overview (5 min)
2. Dashboard walkthrough (10 min)
3. Compliance roadmap (10 min)
4. Support process (5 min)

**Topics to Cover:**
- [ ] How to access account 24/7
- [ ] Where to find compliance reports
- [ ] How to report issues
- [ ] Support SLA (24hr response, Fintech tier)
- [ ] Escalation path for critical issues
- [ ] Quarterly business reviews scheduled

**Success Criteria:**
- [ ] Meeting completed
- [ ] Customer comfortable with platform
- [ ] Escalation contacts shared
- [ ] Next QBR scheduled

---

## Post-Deployment Monitoring (Days 2-7)

### Daily Checks
- [ ] Customer's account is provisioning correctly
- [ ] No policy violations requiring immediate action
- [ ] CloudTrail logging continuously
- [ ] No cost surprises

### Mid-Week Check (Day 3)
- [ ] Schedule compliance automation training
- [ ] Review initial usage metrics
- [ ] Check for any support tickets
- [ ] Prepare week 1 compliance report

### Week 1 Wrap-Up (Day 7)
- [ ] Generate week 1 usage report
- [ ] Run compliance scan (#2)
- [ ] Document any issues encountered
- [ ] Schedule 30-day follow-up

---

## Potential Issues & Troubleshooting

### Issue 1: Account Creation Fails
**Error Message:**
```
Error: creating AWS Organizations Account: ValidationException: 
You've exceeded the maximum number of AWS accounts in your organization.
```

**Solution:**
1. Contact AWS support to increase org limits
2. Alternatively, defer customer to next month
3. Meanwhile, prepare their configuration

**Prevention:**
- Monitor org account count
- Request limit increase proactively

---

### Issue 2: CloudTrail Not Logging
**Symptom:** CloudTrail shows "Stopped" status

**Solution:**
1. Verify S3 bucket policy on central logging bucket
2. Check S3 bucket exists and is accessible
3. Verify KMS key permissions (if encrypted)
4. Re-enable CloudTrail

**Prevention:**
- Test with dummy account before customer deployment
- Verify S3 bucket policy syntax

---

### Issue 3: Policy Attachment Fails
**Error Message:**
```
Error: creating Organizations Policy Attachment: 
ValidationException: The policy does not conform to the required syntax.
```

**Solution:**
1. Review policy JSON syntax
2. Ensure policy is valid JSON
3. Check for unsupported policy conditions
4. Test policy on different OU first

**Prevention:**
- Validate all SCPs before deployment
- Use AWS Policy Validator tool

---

### Issue 4: Customer Can't Access Account
**Symptom:** SSO login fails or account shows "inactive"

**Solution:**
1. Verify user exists in IAM Identity Center
2. Check permission set is assigned
3. Verify account is in enabled state
4. Check MFA is configured correctly

**Prevention:**
- Test SSO setup with internal user first
- Verify IAM Identity Center is enabled in org

---

### Issue 5: Compliance Score Too Low
**Symptom:** Baseline compliance score is < 50%

**Solution:**
1. This is normal for baseline (expect 50-70%)
2. Auto-remediation may fix 50% automatically
3. Provide customer with remediation guide
4. Schedule follow-up scan in 1 week

**Prevention:**
- Set correct expectations in sales process
- Emphasize continuous improvement

---

## Success Metrics

### Deployment Success
- ✅ Terraform deploy completes without errors
- ✅ AWS account created in correct OU
- ✅ Security policies attached
- ✅ Logging enabled

### Customer Success (Week 1)
- ✅ Customer can log in via SSO
- ✅ Customer receives compliance report
- ✅ Customer understands dashboard
- ✅ No critical support issues

### Business Success (Month 1)
- ✅ $8,000 payment received
- ✅ No customer escalations
- ✅ Compliance score improving
- ✅ Customer satisfied (NPS survey)

---

## Lessons Learned (After First 3 Customers)

After onboarding ACME Finance and 2-3 additional customers, document:

- [ ] Most common issues encountered
- [ ] Time spent on each phase
- [ ] Automation opportunities
- [ ] Process improvements
- [ ] Training gaps identified
- [ ] Documentation gaps

---

## Next Steps

1. **Before Deployment:**
   - Run SIMULATE_ONBOARDING.sh to validate config
   - Review plan output for any issues
   - Create customer communication templates

2. **During Deployment:**
   - Monitor terraform apply in real-time
   - Verify AWS resources created
   - Check logs for any warnings

3. **After Deployment:**
   - Complete phases 1-5 within 24 hours
   - Schedule kickoff meeting
   - Begin week 1 monitoring

---

## Quick Reference

**Key Contacts:**
- Customer: john@acmefinance.com
- SecureBase: support@securebase.com
- AWS Account: 222233334444
- Terraform: landing-zone/environments/dev/

**Important Files:**
- Customer Config: client.auto.tfvars
- Terraform Plan: tfplan
- Compliance Report: [dashboard URL]
- Billing: [billing portal URL]

**Timeline:**
- Deployment: 7-10 minutes
- Onboarding: ~1 hour (all phases)
- Training: Continuous
- Review: Monthly QBR

---

**Document Version:** v0.1
**Last Updated:** 2026-01-19
**Next Review:** After first 3 customers deployed
