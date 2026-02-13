# DNS Setup Guide

Complete DNS configuration guide for **tximhotep.com** custom domain architecture with SecureBase multi-tier product structure.

---

## 📋 Overview

This guide covers DNS setup for:
- **Corporate domain**: `tximhotep.com`
- **Product subdomains**: `securebase.tximhotep.com` and related services
- **Active deployments**: Marketing site + Commercial demo
- **Placeholder records**: Government tier (not deployed yet)

---

## 🎯 DNS Records Summary

### Active Records (Deploy Now)

These records should be configured immediately to activate live services:

```dns
# Marketing Site (Apex Domain)
tximhotep.com                      ALIAS   securebase-app.netlify.app

# Product Landing (Redirect to Main Site)
securebase.tximhotep.com           CNAME   securebase-app.netlify.app

# Commercial Demo Portal (Active)
demo.securebase.tximhotep.com      CNAME   securebase-demo.netlify.app
```

### Placeholder Records (Future Deployment)

Document these records but **DO NOT deploy** until the services are ready:

```dns
# Commercial Customer Portal (Deploy when first customer signs)
portal.securebase.tximhotep.com    CNAME   securebase-portal.netlify.app

# Government Demo Portal (Deploy when gov tier launches)
demo-gov.securebase.tximhotep.com  CNAME   securebase-demo-gov.netlify.app

# Government Customer Portal (Deploy when gov tier launches)
portal-gov.securebase.tximhotep.com CNAME  securebase-portal-gov.netlify.app
```

---

## 🔧 Step-by-Step Setup

### Step 1: Configure Apex Domain (tximhotep.com)

**Important**: Apex domains require special handling. Most DNS providers support ALIAS or ANAME records.

#### Option A: ALIAS Record (Recommended)
If your DNS provider supports ALIAS records (AWS Route 53, DNSimple, DNS Made Easy):

```dns
Type:   ALIAS
Name:   @  (or leave blank for apex)
Target: securebase-app.netlify.app
TTL:    300 (5 minutes)
```

#### Option B: A Record with Netlify Load Balancer IP
If ALIAS is not supported, use Netlify's load balancer IP:

```dns
Type:   A
Name:   @  (or leave blank for apex)
Target: 75.2.60.5  (Netlify's Load Balancer IP - verify in Netlify dashboard)
TTL:    300
```

**Note**: Netlify may change IPs. ALIAS is preferred for automatic updates.

#### Option C: Redirect via WWW Subdomain
If neither option works:

```dns
# Redirect apex to www
Type:   A
Name:   @
Target: 75.2.60.5

# WWW subdomain
Type:   CNAME
Name:   www
Target: securebase-app.netlify.app

# Add URL redirect rule in domain registrar:
tximhotep.com → https://www.tximhotep.com (301 redirect)
```

---

### Step 2: Configure Product Landing Subdomain

```dns
Type:   CNAME
Name:   securebase
Target: securebase-app.netlify.app
TTL:    300
```

**Purpose**: Redirect `securebase.tximhotep.com` to main marketing site until dedicated product page is built (handled by Netlify redirect in `netlify.toml`).

---

### Step 3: Configure Commercial Demo Portal

```dns
Type:   CNAME
Name:   demo.securebase
Target: securebase-demo.netlify.app
TTL:    300
```

**Purpose**: Active demo portal for Fintech + Healthcare tiers.

---

### Step 4: Add Placeholder Records (Optional)

You can add these now or wait until services are deployed:

```dns
# Commercial Portal (Future)
Type:   CNAME
Name:   portal.securebase
Target: securebase-portal.netlify.app
TTL:    300

# Government Demo (Future)
Type:   CNAME
Name:   demo-gov.securebase
Target: securebase-demo-gov.netlify.app
TTL:    300

# Government Portal (Future)
Type:   CNAME
Name:   portal-gov.securebase
Target: securebase-portal-gov.netlify.app
TTL:    300
```

---

## 🌐 Netlify Custom Domain Configuration

After DNS records are configured, add custom domains in Netlify UI:

### Marketing Site (securebase-app)

1. Navigate to: **Netlify Dashboard** → **securebase-app** → **Domain Settings**
2. Click **Add custom domain**
3. Enter: `tximhotep.com`
4. Click **Verify DNS configuration**
5. Repeat for: `securebase.tximhotep.com`
6. Netlify will auto-provision SSL certificates (Let's Encrypt)

### Demo Portal (securebase-demo)

1. Navigate to: **Netlify Dashboard** → **securebase-demo** → **Domain Settings**
2. Click **Add custom domain**
3. Enter: `demo.securebase.tximhotep.com`
4. Click **Verify DNS configuration**
5. Netlify will auto-provision SSL certificate

---

## 🔐 SSL Certificate Provisioning

Netlify automatically provisions SSL certificates via Let's Encrypt:

1. **DNS Propagation**: Wait 1-24 hours for DNS to propagate globally
2. **Certificate Issuance**: Netlify requests certificate from Let's Encrypt
3. **Auto-Renewal**: Certificates renew automatically every 90 days

**Check SSL Status**:
```bash
# Verify SSL certificate
curl -I https://tximhotep.com

# Check certificate details
openssl s_client -connect tximhotep.com:443 -servername tximhotep.com
```

---

## 🧪 Testing & Verification

### Step 1: Check DNS Propagation

```bash
# Check apex domain
dig tximhotep.com

# Check subdomain
dig demo.securebase.tximhotep.com

# Check from multiple locations
dig @8.8.8.8 tximhotep.com  # Google DNS
dig @1.1.1.1 tximhotep.com  # Cloudflare DNS
```

**Expected Output**:
```
tximhotep.com.  300  IN  ALIAS  securebase-app.netlify.app
demo.securebase.tximhotep.com.  300  IN  CNAME  securebase-demo.netlify.app
```

### Step 2: Test HTTPS Access

```bash
# Marketing site
curl -I https://tximhotep.com

# Product landing (should redirect)
curl -I https://securebase.tximhotep.com

# Demo portal
curl -I https://demo.securebase.tximhotep.com
```

### Step 3: Verify Redirects

```bash
# Product landing redirect test
curl -L https://securebase.tximhotep.com | grep -i "securebase"
# Should return content from tximhotep.com
```

---

## 📧 Email DNS Records (MX/TXT)

See **EMAIL_SETUP.md** for complete email configuration.

Quick reference for Google Workspace:

```dns
# MX Records (Google Workspace)
Priority  Name  Target
1         @     ASPMX.L.GOOGLE.COM
5         @     ALT1.ASPMX.L.GOOGLE.COM
5         @     ALT2.ASPMX.L.GOOGLE.COM
10        @     ALT3.ASPMX.L.GOOGLE.COM
10        @     ALT4.ASPMX.L.GOOGLE.COM

# SPF Record (Prevent Spoofing)
Type:   TXT
Name:   @
Value:  "v=spf1 include:_spf.google.com ~all"

# DKIM Record (Email Signing)
Type:   TXT
Name:   google._domainkey
Value:  [provided by Google Workspace]

# DMARC Record (Email Security Policy)
Type:   TXT
Name:   _dmarc
Value:  "v=DMARC1; p=quarantine; rua=mailto:dmarc@tximhotep.com"
```

---

## 🛠️ Troubleshooting

### Issue: "Domain not verified" in Netlify

**Solution**:
1. Wait 5-10 minutes for DNS propagation
2. Use `dig` to verify DNS records are live
3. Click **Verify DNS configuration** again in Netlify
4. Check for typos in DNS records (trailing dots, incorrect targets)

### Issue: SSL Certificate Not Provisioning

**Solution**:
1. Ensure DNS is fully propagated (use `dig` from multiple locations)
2. Verify domain is added in Netlify UI
3. Wait up to 24 hours for Let's Encrypt verification
4. Check Netlify logs for certificate errors

### Issue: "ERR_NAME_NOT_RESOLVED"

**Solution**:
1. DNS not propagated yet (wait 1-24 hours)
2. Verify DNS records in your registrar's control panel
3. Flush local DNS cache:
   ```bash
   # macOS/Linux
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   ```

### Issue: Redirect Loop

**Solution**:
1. Check Netlify redirect rules in `netlify.toml`
2. Verify only one redirect rule targets the domain
3. Clear browser cache and test in incognito mode

### Issue: Mixed Content Warnings (HTTP/HTTPS)

**Solution**:
1. Ensure all resources load via HTTPS
2. Check `Content-Security-Policy` headers in `netlify.toml`
3. Update hardcoded HTTP URLs to HTTPS or protocol-relative URLs

---

## 📊 DNS Provider Examples

### AWS Route 53

```bash
# Create ALIAS record for apex domain
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "tximhotep.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "securebase-app.netlify.app",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'

# Create CNAME record for subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "demo.securebase.tximhotep.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "securebase-demo.netlify.app"}]
      }
    }]
  }'
```

### Cloudflare

1. Login to Cloudflare dashboard
2. Select **tximhotep.com** domain
3. Go to **DNS** tab
4. Add records:
   - Type: `CNAME`, Name: `@`, Target: `securebase-app.netlify.app`, Proxy: **OFF**
   - Type: `CNAME`, Name: `demo.securebase`, Target: `securebase-demo.netlify.app`, Proxy: **OFF**

**Important**: Disable Cloudflare proxy (orange cloud) to allow Netlify SSL to work.

### GoDaddy

1. Login to GoDaddy account
2. Go to **My Products** → **Domains** → **Manage DNS**
3. Add records:
   - Type: `CNAME`, Name: `@`, Points to: `securebase-app.netlify.app`, TTL: 1 Hour
   - Type: `CNAME`, Name: `demo.securebase`, Points to: `securebase-demo.netlify.app`, TTL: 1 Hour

**Note**: GoDaddy doesn't support ALIAS for apex domains. Use forwarding or switch to Cloudflare/Route 53.

---

## 🎯 Success Criteria

✅ **DNS configured**:
- `tximhotep.com` → Resolves to Netlify
- `demo.securebase.tximhotep.com` → Resolves to Netlify

✅ **Netlify domains added**:
- Custom domains added in Netlify UI
- SSL certificates provisioned

✅ **Sites accessible**:
- `https://tximhotep.com` → Loads marketing site
- `https://securebase.tximhotep.com` → Redirects to `tximhotep.com`
- `https://demo.securebase.tximhotep.com` → Loads demo portal

✅ **HTTPS working**:
- No SSL warnings
- Green padlock in browser
- Valid Let's Encrypt certificate

---

## 📅 DNS Migration Timeline

**Day 0 (Setup)**:
- Add DNS records in domain registrar
- Add custom domains in Netlify UI

**Day 0-1 (Propagation)**:
- DNS propagates globally (1-24 hours)
- SSL certificates provision automatically

**Day 1 (Validation)**:
- Test all URLs
- Verify redirects
- Check SSL certificates

**Day 2+ (Monitoring)**:
- Monitor DNS health
- Watch for certificate auto-renewal
- Update documentation with final URLs

---

## 🔗 Related Documentation

- **EMAIL_SETUP.md** - Email routing configuration
- **THREE_TIER_ARCHITECTURE.md** - Multi-tier product strategy
- **NETLIFY_DEPLOYMENT.md** - Netlify deployment guide
- **DEMO_QUICK_START.md** - Demo environment setup

---

## 📞 Support

**DNS Issues**:
- Check DNS provider documentation
- Verify records with `dig` command
- Wait 24 hours for full propagation

**Netlify Issues**:
- Netlify Support: https://www.netlify.com/support/
- Netlify Docs: https://docs.netlify.com/domains-https/custom-domains/

**Internal Support**:
- Team: team@tximhotep.com
- Technical: support@securebase.tximhotep.com
