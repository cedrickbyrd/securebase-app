# Notification System User Guide

**Version:** 1.0  
**Last Updated:** 2026-01-26  
**Component:** Phase 4 Component 3 - Notifications & Alerting System

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Notification Center](#notification-center)
4. [Managing Preferences](#managing-preferences)
5. [Notification Types](#notification-types)
6. [Delivery Channels](#delivery-channels)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The SecureBase Notification System keeps you informed about important events across your AWS infrastructure, including security alerts, billing updates, compliance findings, and system changes.

### Key Features

- **Multi-Channel Delivery**: Receive notifications via Email, SMS, Webhook, and In-app
- **Real-Time Alerts**: Critical security events delivered in <5 seconds
- **Customizable Preferences**: Control what, when, and how you receive notifications
- **Priority-Based Routing**: Critical alerts bypass quiet hours
- **Complete Audit Trail**: 90-day notification history

---

## Getting Started

### Accessing the Notification Center

1. Log in to your SecureBase portal
2. Click the **bell icon** in the top navigation bar
3. View recent notifications in the dropdown panel

### First-Time Setup

1. Navigate to **Settings** → **Notifications**
2. Configure your contact information:
   - **Email**: Verify your email address
   - **SMS**: Add and verify your phone number (+1 format)
   - **Webhook**: Configure endpoint URL (optional)
3. Choose which notifications you want to receive
4. Click **Save Preferences**

---

## Notification Center

### Bell Icon & Badge

- **Blue bell**: Notification center (click to open)
- **Red badge**: Unread notification count
- **Auto-refresh**: Updates every 30 seconds

### Dropdown Panel

The dropdown panel shows your 10 most recent notifications:

#### Notification Elements

- **Icon**: Indicates notification type
  - 🛡️ Shield: Security Alert
  - 💵 Dollar: Billing
  - ✓ Check: Compliance
  - ℹ️ Info: System/Informational
- **Title**: Brief summary of the event
- **Body**: Detailed message
- **Timestamp**: Relative time ("5 minutes ago")
- **Priority Indicator**: Color-coded (red=critical, orange=high, blue=medium, gray=low)

#### Actions

- **Click notification**: Mark as read and view details
- **Mark all as read**: Clear all unread notifications
- **View all**: Navigate to full notification history page

### Notification History

Access full history at **Notifications** page:

- Filter by type (Security, Billing, Compliance, System)
- Filter by status (Read/Unread)
- Search by keyword
- Export to CSV (last 90 days)

---

## Managing Preferences

Navigate to **Settings** → **Notifications** to customize your preferences.

### Event Types & Channels Matrix

Configure each event type independently across all channels:

| Event Type | Email | SMS | Webhook | In-App |
|------------|-------|-----|---------|--------|
| **Security Alerts** | ✓ | ✓ | - | ✓ |
| **Billing** | ✓ | - | - | ✓ |
| **Compliance** | ✓ | - | - | ✓ |
| **System** | - | - | - | ✓ |
| **Informational** | - | - | - | ✓ |

*Recommended default configuration shown above*

### Channel Configuration

#### Email
- **Verification Required**: Click verification link sent to your email
- **Delivery Time**: Typically <30 seconds
- **Format**: HTML with plain text fallback
- **Unsubscribe**: Link included in every email

#### SMS
- **Phone Number**: +1 (US) format required
- **Verification Required**: Enter code sent via SMS
- **Character Limit**: Messages truncated to 160 characters
- **Opt-Out**: Reply STOP to any SMS
- **Cost**: Check with your mobile carrier

#### Webhook
- **URL Format**: HTTPS required
- **Authentication**: HMAC-SHA256 signature in `X-Webhook-Signature` header
- **Timeout**: 5 seconds
- **Retries**: 3 attempts with exponential backoff
- **Payload**: JSON with notification details

#### In-App
- **Always Enabled**: Cannot be disabled
- **Retention**: 90 days (auto-deleted after TTL)
- **Real-Time**: 30-second polling interval

### Testing Notifications

Before saving, test each channel:

1. Click **Test** button next to each channel
2. Verify delivery (check email inbox, phone, webhook logs)
3. Adjust preferences if needed
4. Click **Save Preferences**

---

## Notification Types

### Security Alerts (Priority: Critical/High)

**What triggers them:**
- GuardDuty findings (unauthorized access, malware)
- Failed login attempts (>5 in 10 minutes)
- IAM policy changes
- Security Hub compliance failures

**Recommended channels:** Email + SMS + In-app

**Example:**
```
🛡️ CRITICAL: Unauthorized API Call Detected
An unauthorized API call to DeleteBucket was blocked from IP 192.168.1.1
View Details → Security Hub
```

### Billing (Priority: High/Medium)

**What triggers them:**
- Invoice generated
- Payment failed
- Usage threshold exceeded (80%, 90%, 100%)
- Cost anomaly detected

**Recommended channels:** Email + In-app

**Example:**
```
💵 HIGH: Invoice Generated - $1,234.56
Your January 2026 invoice is ready. Payment due: Feb 15, 2026
View Invoice → Billing Dashboard
```

### Compliance (Priority: High/Medium)

**What triggers them:**
- AWS Config rule violations
- Audit findings
- Certificate expiration (30/14/7 days)
- Backup failures

**Recommended channels:** Email + In-app

**Example:**
```
✓ HIGH: Config Rule Violation
s3-bucket-public-read-prohibited: Non-compliant (3 resources)
Remediate Now → Compliance Dashboard
```

### System (Priority: Medium/Low)

**What triggers them:**
- Deployment completed
- Maintenance window scheduled
- Service health updates

**Recommended channels:** In-app only

**Example:**
```
ℹ️ MEDIUM: Deployment Complete
Phase 4 Component 3 deployed successfully to production
View Logs → Deployments
```

### Informational (Priority: Low)

**What triggers them:**
- New feature announcements
- Best practice tips
- Monthly reports

**Recommended channels:** In-app only

**Example:**
```
ℹ️ LOW: New Feature Available
Try our new Cost Forecasting dashboard
Explore Now → Analytics
```

---

## Delivery Channels

### Email Delivery

**From:** notifications@securebase.io  
**Subject Line:** Includes priority and summary

**HTML Format:**
- Responsive design (mobile-friendly)
- Color-coded priority indicators
- Action buttons (View Details, Remediate)
- Unsubscribe link (footer)

**Delivery SLA:**
- Critical: <5 seconds
- High: <30 seconds
- Medium/Low: <5 minutes

### SMS Delivery

**From Number:** Short code (varies by region)

**Format:**
```
[CRITICAL] SecureBase Alert:
Unauthorized access detected from IP 192.168.1.1
Details: https://app.securebase.io/alerts/123
```

**Character Limit:** 160 characters (message truncated with "...")

**Delivery SLA:** <10 seconds for all priorities

### Webhook Delivery

**HTTP Method:** POST  
**Content-Type:** application/json

**Payload Example:**
```json
{
  "id": "notif-123456789",
  "type": "security_alert",
  "priority": "critical",
  "title": "Unauthorized Access Detected",
  "body": "Failed login attempt from IP 192.168.1.1",
  "timestamp": "2026-01-26T18:00:00Z",
  "metadata": {
    "ip_address": "192.168.1.1",
    "event_source": "GuardDuty"
  }
}
```

**Signature Verification:**
```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    computed = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
```

**Retry Logic:**
- Retry 1: Immediate
- Retry 2: 2 seconds later
- Retry 3: 4 seconds later
- After 3 failures: Message moved to DLQ (check logs)

---

## Best Practices

### Notification Fatigue Prevention

1. **Be Selective**: Enable only notifications you'll act on
2. **Use Filters**: Disable informational notifications
3. **Leverage Batching**: Group similar alerts (future feature)
4. **Set Quiet Hours**: Mute non-critical alerts overnight (future feature)

### Security Considerations

1. **Verify Sources**: Emails from `notifications@securebase.io` only
2. **Beware of Phishing**: Never click suspicious links
3. **Webhook Security**: Always validate HMAC signatures
4. **SMS Spoofing**: Verify sender number matches documentation

### Recommended Configurations

#### **For Security Teams**
```
Security Alerts: Email + SMS + In-app
Compliance: Email + In-app
Billing: In-app only
System: In-app only
Informational: Disabled
```

#### **For Finance Teams**
```
Billing: Email + In-app
Security Alerts: In-app only
Compliance: In-app only
System: Disabled
Informational: Disabled
```

#### **For Operations Teams**
```
System: Email + In-app
Security Alerts: In-app only
Compliance: In-app only
Billing: In-app only
Informational: Disabled
```

---

## Troubleshooting

### Not Receiving Notifications

**Email:**
1. Check spam/junk folder
2. Verify email address in Settings
3. Ensure email is verified (check for verification email)
4. Whitelist `notifications@securebase.io`

**SMS:**
1. Verify phone number format (+1XXXXXXXXXX)
2. Check SMS verification status
3. Ensure sufficient carrier signal
4. Reply START if previously opted out

**Webhook:**
1. Verify HTTPS endpoint is accessible
2. Check webhook logs for errors
3. Ensure endpoint responds with 200 OK within 5 seconds
4. Validate HMAC signature implementation

**In-App:**
1. Refresh browser (Ctrl+R / Cmd+R)
2. Clear browser cache
3. Check internet connection
4. Try different browser

### Missing Notifications

1. Check notification history (may be marked as read)
2. Verify preferences for that event type
3. Check DLQ for failed deliveries (contact support)

### Duplicate Notifications

- Normal for multi-channel (e.g., Email + SMS for same event)
- If true duplicates, contact support with notification IDs

---

## Getting Help

- **Documentation**: [NOTIFICATION_API.md](./NOTIFICATION_API.md)
- **Technical Issues**: [NOTIFICATION_TROUBLESHOOTING.md](./NOTIFICATION_TROUBLESHOOTING.md)
- **Support**: support@securebase.io
- **Emergency**: security@securebase.io (security alerts only)

---

**Last Updated:** 2026-01-26  
**Version:** 1.0  
**Component:** Phase 4 Component 3 - Notifications & Alerting System
