# Email Setup Guide

Complete email routing strategy for **tximhotep.com** corporate domain and **SecureBase** product emails, including Google Workspace configuration and tier-aware routing.

---

## 📋 Overview

This guide covers:
- **Corporate emails**: Team, careers, press (`@tximhotep.com`)
- **SecureBase product emails**: Sales, support, billing (`@securebase.tximhotep.com`)
- **Tier-aware routing**: Commercial vs. Government support
- **Email security**: SPF, DKIM, DMARC configuration

---

## 📧 Email Architecture

### Corporate Emails (Active)

```
team@tximhotep.com       → General inquiries, partnership requests
careers@tximhotep.com    → Hiring, recruiting, job applications
press@tximhotep.com      → Media inquiries, press releases
legal@tximhotep.com      → Legal notices, compliance inquiries
```

### SecureBase Product Emails (Active)

```
sales@securebase.tximhotep.com     → Sales inquiries (Fintech + Healthcare)
support@securebase.tximhotep.com   → Product support (tier-aware routing)
demo@securebase.tximhotep.com      → Demo requests, trial signups
billing@securebase.tximhotep.com   → Invoices, payment issues
security@securebase.tximhotep.com  → Security reports, vulnerability disclosures
```

### Government Tier Emails (Placeholder - Future)

```
sales-gov@securebase.tximhotep.com     → Government sales (RFP, enterprise deals)
support-gov@securebase.tximhotep.com   → Government support (cleared personnel only)
```

**Status**: DNS records configured but **not active** until government tier launches.

---

## 🔧 Google Workspace Setup

### Step 1: Domain Verification

1. **Login to Google Workspace Admin Console**:
   - URL: https://admin.google.com
   - Navigate to: **Account** → **Domains** → **Manage Domains**

2. **Add Primary Domain**:
   - Click **Add a domain**
   - Enter: `tximhotep.com`
   - Select: **Primary domain**

3. **Verify Ownership**:
   - Method: Add TXT record to DNS
   - Example:
     ```dns
     Type:   TXT
     Name:   @  (or leave blank)
     Value:  google-site-verification=ABC123XYZ...
     TTL:    300
     ```
   - Wait 5-10 minutes, then click **Verify**

### Step 2: Add Domain Alias

1. **Add SecureBase Subdomain**:
   - Navigate to: **Account** → **Domains** → **Manage Domains**
   - Click **Add a domain**
   - Enter: `securebase.tximhotep.com`
   - Select: **Alias domain** (shares user directory with `tximhotep.com`)

2. **Verify Ownership**:
   - Add another TXT record for subdomain verification
   - Click **Verify**

---

## 🌐 DNS Records for Email

### MX Records (Google Workspace)

Add these records to your DNS provider:

```dns
Priority  Type  Name  Target                    TTL
1         MX    @     ASPMX.L.GOOGLE.COM        3600
5         MX    @     ALT1.ASPMX.L.GOOGLE.COM   3600
5         MX    @     ALT2.ASPMX.L.GOOGLE.COM   3600
10        MX    @     ALT3.ASPMX.L.GOOGLE.COM   3600
10        MX    @     ALT4.ASPMX.L.GOOGLE.COM   3600
```

**Note**: Google Workspace uses the same MX records for both `tximhotep.com` and `securebase.tximhotep.com`.

---

### SPF Record (Sender Policy Framework)

Prevent email spoofing by authorizing Google to send emails on your behalf:

```dns
Type:   TXT
Name:   @  (for tximhotep.com)
Value:  "v=spf1 include:_spf.google.com ~all"
TTL:    3600
```

**For subdomain** (`securebase.tximhotep.com`):
```dns
Type:   TXT
Name:   securebase
Value:  "v=spf1 include:_spf.google.com ~all"
TTL:    3600
```

**Explanation**:
- `v=spf1` - SPF version 1
- `include:_spf.google.com` - Authorize Google Workspace servers
- `~all` - Soft fail for unauthorized servers (use `-all` for strict enforcement)

---

### DKIM Record (Email Signing)

Cryptographically sign outgoing emails to prevent tampering:

1. **Generate DKIM Key in Google Workspace**:
   - Navigate to: **Apps** → **Google Workspace** → **Gmail** → **Authenticate Email**
   - Click **Generate New Record**
   - Copy the DKIM TXT record

2. **Add to DNS**:
   ```dns
   Type:   TXT
   Name:   google._domainkey
   Value:  "v=DKIM1; k=rsa; p=MIIBIjANBg..."  (long RSA public key)
   TTL:    3600
   ```

3. **Start Authentication**:
   - Return to Google Workspace admin console
   - Click **Start Authentication**

---

### DMARC Record (Email Security Policy)

Define how to handle emails that fail SPF/DKIM checks:

```dns
Type:   TXT
Name:   _dmarc
Value:  "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@tximhotep.com; ruf=mailto:dmarc-failures@tximhotep.com; pct=100"
TTL:    3600
```

**Policy Options**:
- `p=none` - Monitor only (no action) - **Start here**
- `p=quarantine` - Send suspicious emails to spam
- `p=reject` - Reject unauthorized emails - **Production setting**

**Aggregate Reports** (`rua`):
- Receives daily summary reports of email authentication results
- Create `dmarc-reports@tximhotep.com` alias or use third-party service (e.g., Postmark, Valimail)

---

## 👥 User and Alias Setup

### Step 1: Create User Accounts

Create Google Workspace accounts for team members:

```
john@tximhotep.com       → John Doe (Founder/CEO)
jane@tximhotep.com       → Jane Smith (CTO)
support@tximhotep.com    → Support Team (shared mailbox)
```

### Step 2: Create Email Aliases

Aliases forward to existing user accounts:

#### Corporate Aliases
```
team@tximhotep.com       → john@tximhotep.com
careers@tximhotep.com    → john@tximhotep.com
press@tximhotep.com      → john@tximhotep.com
legal@tximhotep.com      → john@tximhotep.com
```

#### SecureBase Product Aliases
```
sales@securebase.tximhotep.com     → john@tximhotep.com
support@securebase.tximhotep.com   → support@tximhotep.com (shared mailbox)
demo@securebase.tximhotep.com      → john@tximhotep.com
billing@securebase.tximhotep.com   → jane@tximhotep.com
security@securebase.tximhotep.com  → jane@tximhotep.com
```

**Setup in Google Workspace**:
1. Navigate to: **Directory** → **Users**
2. Click on user (e.g., `john@tximhotep.com`)
3. Go to **User Information** → **Email Aliases**
4. Add alias: `sales@securebase.tximhotep.com`

---

## 🎫 Support Ticket Routing (Tier-Aware)

### Option 1: Google Groups (Simple)

Create tier-specific Google Groups:

```
support-commercial@securebase.tximhotep.com  → Commercial tier (Fintech + Healthcare)
support-government@securebase.tximhotep.com  → Government tier (cleared personnel)
```

**Setup**:
1. Navigate to: **Directory** → **Groups**
2. Create group: `support-commercial@securebase.tximhotep.com`
3. Add members: `jane@tximhotep.com`, `support@tximhotep.com`
4. Set alias: `support@securebase.tximhotep.com` → `support-commercial@securebase.tximhotep.com`

### Option 2: Zendesk Integration (Advanced)

Route emails to Zendesk for ticket management:

1. **Create Zendesk Support Address**:
   - Subdomain: `securebase.zendesk.com`
   - Email: `support@securebase.tximhotep.com`

2. **Forward Email to Zendesk**:
   - In Google Workspace, forward `support@securebase.tximhotep.com` to:
     - `support+tier-commercial@securebase.zendesk.com` (Commercial)
     - `support+tier-government@securebase.zendesk.com` (Government)

3. **Tier Detection in Zendesk**:
   - Use **triggers** to tag tickets based on sender domain
   - Route to tier-specific support teams

### Option 3: AWS SES + Lambda (Custom)

Build custom email routing logic:

1. **Receive Email via SES**:
   - Configure MX records to point to AWS SES
   - Example: `inbound-smtp.us-east-1.amazonaws.com`

2. **Lambda Function**:
   - Parse incoming email
   - Look up customer tier in Aurora database
   - Route to appropriate support queue (SNS, SQS, Zendesk API)

---

## 🔐 Email Security Best Practices

### Enable 2FA for All Accounts

1. Navigate to: **Security** → **2-Step Verification**
2. Enforce for all users
3. Provide backup codes

### Configure Advanced Protection

1. Navigate to: **Security** → **Advanced Protection Program**
2. Enroll high-risk accounts (CEO, CTO)
3. Require security keys

### Enable Suspicious Activity Alerts

1. Navigate to: **Security** → **Alert Center**
2. Enable alerts for:
   - Suspicious logins
   - Unusual account activity
   - Phishing attempts
   - Leaked credentials

### Set Up Email Encryption

1. Navigate to: **Apps** → **Google Workspace** → **Gmail** → **Compliance**
2. Enable **S/MIME encryption** for sensitive emails
3. Require encryption for external recipients (optional)

---

## 🧪 Testing & Validation

### Step 1: Send Test Email

```bash
# Send email from personal account to test alias
echo "Test email" | mail -s "Test Subject" support@securebase.tximhotep.com
```

### Step 2: Check SPF/DKIM/DMARC

Use online tools to verify email authentication:

- **MXToolbox**: https://mxtoolbox.com/SuperTool.aspx
- **Google Admin Toolbox**: https://toolbox.googleapps.com/apps/checkmx/
- **DMARC Analyzer**: https://www.dmarcanalyzer.com/

**Expected Results**:
- ✅ SPF: PASS
- ✅ DKIM: PASS
- ✅ DMARC: PASS

### Step 3: Test Email Delivery

1. Send email from `support@securebase.tximhotep.com` to external email (Gmail, Outlook)
2. Check that email:
   - Arrives in inbox (not spam)
   - Shows "Signed by: tximhotep.com" badge
   - Passes authentication checks

---

## 📊 Email Deliverability Monitoring

### Monitor DMARC Reports

1. **Receive Reports**: Check `dmarc-reports@tximhotep.com` daily
2. **Analyze Failures**: Identify unauthorized senders
3. **Adjust Policy**: Move from `p=none` → `p=quarantine` → `p=reject`

**Example DMARC Report**:
```xml
<record>
  <source_ip>209.85.220.41</source_ip>
  <count>100</count>
  <policy_evaluated>
    <disposition>none</disposition>
    <dkim>pass</dkim>
    <spf>pass</spf>
  </policy_evaluated>
</record>
```

### Monitor Spam Complaints

1. Navigate to: **Reports** → **Email Logs**
2. Check for bounces and complaints
3. Remove flagged recipients from mailing lists

---

## 🚀 Alternative Email Solutions

### AWS SES (Cost-Effective)

**Pros**:
- Low cost ($0.10 per 1,000 emails)
- Integrated with Lambda for custom routing
- High deliverability

**Cons**:
- No mailbox hosting (send-only or forward to Gmail)
- Manual setup required

**Setup**:
1. Verify `securebase.tximhotep.com` in AWS SES
2. Configure DKIM/SPF records
3. Set up email forwarding to Google Workspace or ticketing system

### Microsoft 365 (Alternative to Google)

**Pros**:
- Integrated with Microsoft Teams
- Advanced security features
- Office 365 suite included

**Cons**:
- Higher cost than Google Workspace
- Different admin interface

**MX Records** (Microsoft 365):
```dns
Priority  Target
0         securebase-tximhotep-com.mail.protection.outlook.com
```

---

## 🛠️ Troubleshooting

### Issue: Emails Marked as Spam

**Solution**:
1. Verify SPF/DKIM/DMARC are configured correctly
2. Check domain reputation: https://www.senderscore.org/
3. Warm up email sending (start with low volume, gradually increase)
4. Avoid spam trigger words in subject/body

### Issue: Emails Not Receiving

**Solution**:
1. Verify MX records:
   ```bash
   dig MX tximhotep.com
   dig MX securebase.tximhotep.com
   ```
2. Check Google Workspace email routing settings
3. Verify recipient address exists in Google Workspace
4. Check spam folder and email filters

### Issue: DKIM Signature Failures

**Solution**:
1. Verify DKIM TXT record in DNS:
   ```bash
   dig TXT google._domainkey.tximhotep.com
   ```
2. Ensure record matches Google Workspace admin console
3. Wait 24-48 hours for DNS propagation
4. Re-generate DKIM key if record is corrupted

### Issue: Alias Not Working

**Solution**:
1. Verify alias is added in Google Workspace: **Directory** → **Users** → **Email Aliases**
2. Check that alias domain (`securebase.tximhotep.com`) is verified
3. Wait 5-10 minutes for alias to propagate
4. Send test email to alias

---

## 📅 Deployment Timeline

**Day 0 (Setup)**:
- Add MX, SPF, DKIM, DMARC records to DNS
- Create Google Workspace accounts
- Set up email aliases

**Day 1 (Verification)**:
- Verify domain ownership in Google Workspace
- Test email sending/receiving
- Check SPF/DKIM/DMARC validation

**Day 7 (Monitoring)**:
- Review DMARC reports
- Adjust spam filter settings
- Monitor deliverability rates

**Day 30+ (Optimization)**:
- Tighten DMARC policy (`p=quarantine` → `p=reject`)
- Set up advanced routing (Zendesk, AWS SES)
- Enable tier-aware support routing

---

## 🎯 Success Criteria

✅ **DNS configured**:
- MX records pointing to Google Workspace
- SPF, DKIM, DMARC records added

✅ **Accounts created**:
- User accounts for team members
- Aliases for corporate and product emails

✅ **Email working**:
- Can send/receive emails from all aliases
- Emails pass SPF/DKIM/DMARC checks
- No spam folder issues

✅ **Security enabled**:
- 2FA enforced for all accounts
- Advanced Protection enabled for executives
- Suspicious activity alerts configured

---

## 🔗 Related Documentation

- **DNS_SETUP.md** - DNS configuration guide
- **THREE_TIER_ARCHITECTURE.md** - Multi-tier product strategy
- **DEMO_QUICK_START.md** - Demo environment setup

---

## 📞 Support

**Google Workspace Issues**:
- Support: https://support.google.com/a/
- Admin Console: https://admin.google.com

**DNS/Email Issues**:
- MXToolbox: https://mxtoolbox.com/
- DMARC Analyzer: https://www.dmarcanalyzer.com/

**Internal Support**:
- Team: team@tximhotep.com
- Technical: support@securebase.tximhotep.com
