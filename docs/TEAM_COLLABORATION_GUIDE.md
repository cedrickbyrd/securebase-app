# SecureBase Team Collaboration Guide

**Version:** 1.0  
**For:** Customer Administrators & Team Managers  
**Last Updated:** January 24, 2026  

---

## Welcome to Team Collaboration

SecureBase now supports **team collaboration** with role-based access control, allowing you to safely share your SecureBase account with up to 100+ team members while maintaining strict security boundaries.

### What's New?

- ✅ **Multi-user support** - Add team members with different access levels
- ✅ **Role-based permissions** - 4 roles: Admin, Manager, Analyst, Viewer
- ✅ **Multi-factor authentication (MFA)** - Optional 2FA for enhanced security
- ✅ **Activity tracking** - See what your team is doing
- ✅ **Session management** - Control active sessions across devices

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding Roles](#understanding-roles)
3. [Adding Team Members](#adding-team-members)
4. [Managing Users](#managing-users)
5. [Security Best Practices](#security-best-practices)
6. [Activity Monitoring](#activity-monitoring)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Quick Start

### Step 1: Access Team Management

1. Log in to your SecureBase portal
2. Click **"Team"** in the navigation menu
3. You'll see your current team members

### Step 2: Add Your First Team Member

1. Click **"Add User"** button (top right)
2. Fill in the details:
   - **Email** - Their work email address
   - **Full Name** - Their full name
   - **Role** - Choose appropriate access level
   - **Job Title** - Optional, helps with organization
   - **Department** - Optional

3. Click **"Add User"**
4. They'll receive an email with:
   - Temporary password
   - Link to activate account
   - Instructions to set up MFA (optional)

### Step 3: They Log In

1. User receives email invitation
2. Clicks link to portal
3. Logs in with email + temporary password
4. **Must change password** on first login
5. Optional: Set up MFA for extra security

**That's it!** Your team member now has access based on their assigned role.

---

## Understanding Roles

SecureBase offers 4 predefined roles. Choose the right role based on what the person needs to do.

### 🔴 Admin (Full Access)

**Who should be Admin:**
- Account owner
- Chief Technology Officer
- Security team lead
- IT administrators

**What they can do:**
- ✅ Everything Managers can do, PLUS:
- ✅ Add/remove team members (any role)
- ✅ Change user roles and permissions
- ✅ Delete users
- ✅ Modify account settings
- ✅ Manage billing information
- ✅ View all audit logs

**Security:**
- 🔒 MFA strongly recommended
- 🔒 Max 3 failed login attempts before lockout
- 🔒 All actions logged and monitored

**Best Practice:** Limit to 2-3 people maximum.

---

### 🔵 Manager (Manage Resources)

**Who should be Manager:**
- Engineering managers
- DevOps leads
- Project managers
- Team leads

**What they can do:**
- ✅ Add team members (Analyst, Viewer roles only)
- ✅ Manage API keys
- ✅ Create and manage reports
- ✅ View and pay invoices
- ✅ Create support tickets
- ✅ View usage metrics
- ✅ View audit logs

**Cannot do:**
- ❌ Create Admin users
- ❌ Delete users
- ❌ Change account settings
- ❌ Modify billing email

**Best Practice:** Use for team leads who need operational control.

---

### 🟢 Analyst (Read + Reports)

**Who should be Analyst:**
- Security analysts
- Compliance officers
- Financial analysts
- Business intelligence team

**What they can do:**
- ✅ View all dashboards
- ✅ View usage metrics
- ✅ Generate custom reports
- ✅ Export data (PDF, CSV, Excel)
- ✅ View invoices
- ✅ Create support tickets
- ✅ View compliance reports

**Cannot do:**
- ❌ Add or remove users
- ❌ Manage API keys
- ❌ Modify any resources
- ❌ Pay invoices

**Best Practice:** Use for team members who need to analyze data but not change anything.

---

### ⚪ Viewer (Read-Only)

**Who should be Viewer:**
- Executives (for dashboards)
- Finance team (for invoices)
- External auditors (temporary access)
- Contractors (limited engagement)

**What they can do:**
- ✅ View dashboards
- ✅ View invoices
- ✅ View usage metrics
- ✅ View existing reports

**Cannot do:**
- ❌ Create or modify anything
- ❌ Generate new reports
- ❌ Export data
- ❌ Create support tickets

**Best Practice:** Use for stakeholders who just need visibility.

---

## Adding Team Members

### Prerequisites

- You must be an **Admin** or **Manager**
- Managers can only add Analysts and Viewers
- Each email must be unique within your account

### Step-by-Step Guide

1. **Navigate to Team Management**
   ```
   Portal → Team → Add User
   ```

2. **Fill in User Details**
   - **Email*** (required) - Must be valid and unique
   - **Full Name*** (required) - First and last name
   - **Role*** (required) - Choose from dropdown
   - **Job Title** (optional) - E.g., "Senior Engineer"
   - **Department** (optional) - E.g., "Engineering"
   - **Phone** (optional) - For MFA recovery

3. **Click "Add User"**

4. **User Receives Email**
   ```
   Subject: Welcome to SecureBase

   Your account has been created!

   Email: user@example.com
   Temporary Password: random-secure-password

   Click here to log in: https://portal.securebase.aws

   For security, you MUST change your password on first login.
   This temporary password expires in 24 hours.
   ```

5. **User Activates Account**
   - Logs in with temporary password
   - Changes password immediately
   - Sets up MFA (optional but recommended)

### Bulk Import (Coming Soon)

For adding 10+ users at once, we'll soon support CSV upload:

```csv
email,full_name,role,job_title,department
john@example.com,John Doe,analyst,Senior Analyst,Finance
jane@example.com,Jane Smith,viewer,CFO,Executive
```

---

## Managing Users

### Viewing Team Members

**Filter Options:**
- **By Role** - Show only Admins, Managers, etc.
- **By Status** - Active, Inactive, Suspended
- **Search** - By name or email

**User List Shows:**
- Name and email
- Current role
- Status (active/inactive/suspended)
- MFA enabled (✓ or ✗)
- Last login date

### Editing User Information

1. Click **pencil icon** next to user
2. Update allowed fields:
   - Full name
   - Job title
   - Department
   - Phone number
3. Click **"Save Changes"**

**Note:** Email cannot be changed. Create new user instead.

### Changing User Roles

**Who Can Change Roles:**
- ✅ Admins can change anyone's role
- ❌ Managers cannot change roles

**How to Change:**
1. Click user's edit button
2. Select new role from dropdown
3. Confirm the change
4. User is notified via email

**What Happens:**
- Old permissions removed immediately
- New permissions granted automatically
- User may need to log out/in to see changes
- Action is logged in audit trail

### Suspending Users

**When to Suspend:**
- Employee on leave
- Security concern
- Contract ended (but may return)

**How to Suspend:**
1. Click user's edit button
2. Change status to "Suspended"
3. Confirm

**What Happens:**
- All active sessions terminated immediately
- User cannot log in
- Data remains intact
- Can be reactivated anytime

### Removing Users

**When to Remove:**
- Employee permanently left company
- No longer needs access
- Security incident

**How to Remove:**
1. Click **trash icon** next to user
2. Confirm deletion
3. User is soft-deleted (status → inactive)

**What Happens:**
- All sessions terminated
- Account set to inactive
- User cannot log in
- Data preserved for audit trail
- Can be reactivated by admin if needed

**Note:** Users are never hard-deleted for compliance reasons.

---

## Security Best Practices

### Password Requirements

SecureBase enforces strong passwords:

- ✅ Minimum 12 characters
- ✅ Must include uppercase letter
- ✅ Must include lowercase letter
- ✅ Must include number
- ✅ Must include special character
- ✅ Cannot reuse last 5 passwords
- ✅ Expires every 90 days (optional)

### Multi-Factor Authentication (MFA)

**Highly Recommended for:**
- All Admins
- All Managers
- Users handling sensitive data

**How to Enable MFA:**

1. User logs in
2. Goes to Profile → Security
3. Clicks "Enable MFA"
4. Scans QR code with authenticator app
5. Enters verification code
6. Saves backup codes (important!)

**Supported Apps:**
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- LastPass Authenticator

**MFA Login Flow:**
```
1. Enter email + password
2. If MFA enabled:
   → Enter 6-digit code from app
   → Code is valid for 90 seconds
3. Logged in successfully
```

### Session Management

**Session Details:**
- **Duration**: 24 hours
- **Max Concurrent Sessions**: 5 per user
- **Auto Logout**: After 4 hours inactivity

**Managing Sessions:**
1. Go to Profile → Active Sessions
2. See all active sessions:
   - Device/Browser
   - IP address
   - Last activity
   - Location (approximate)
3. Click "Logout" on suspicious sessions

### Account Lockout Protection

**Automatic Lockout:**
- 5 failed login attempts → 30 minute lockout
- Admins: 3 failed attempts → 30 minute lockout

**If Locked Out:**
1. Wait 30 minutes (automatic unlock), OR
2. Contact your admin to unlock manually, OR
3. Use "Forgot Password" to reset

### Password Reset

**User-Initiated:**
1. Click "Forgot Password" on login page
2. Enter email address
3. Receive reset link via email
4. Click link (valid 1 hour)
5. Set new password

**Admin-Initiated:**
1. Go to Team Management
2. Click key icon next to user
3. Confirm password reset
4. User receives email with temporary password

---

## Activity Monitoring

### Viewing Activity Feed

**Access:**
```
Portal → Activity
```

**What You See:**
- Who did what
- When it happened
- What changed
- IP address and location

**Example Activities:**
```
[2026-01-24 10:30 AM] John Doe logged in from 192.168.1.100
[2026-01-24 10:35 AM] Jane Smith created API key "Production Key"
[2026-01-24 11:00 AM] Admin changed John Doe's role from Analyst to Manager
[2026-01-24 11:15 AM] Jane Smith generated Cost Report (December 2025)
[2026-01-24 11:20 AM] John Doe viewed Invoice #INV-2026-001
```

### Filtering Activity

**Filter By:**
- **User** - See one person's activity
- **Activity Type** - Logins, changes, etc.
- **Date Range** - Last 24h, 7d, 30d, or custom
- **Resource** - Users, Invoices, API Keys, etc.

**Export Activity:**
- Click "Export" button
- Choose format: CSV, PDF, or Excel
- Download for your records

### Activity Types

| Category | Examples |
|----------|----------|
| **Authentication** | Login, logout, MFA verified |
| **User Management** | User created, role changed, user suspended |
| **Resource Access** | Invoice viewed, report generated |
| **API Operations** | API key created, API key rotated |
| **Permissions** | Permission granted, permission revoked |

### Audit Compliance

All activity is logged for **7 years** to meet compliance requirements:
- SOC 2 Type II
- HIPAA
- FedRAMP

**Audit Reports Available:**
- User activity summary (monthly)
- Failed login attempts
- Permission changes
- Resource access logs

---

## Troubleshooting

### User Can't Log In

**Symptom:** "Invalid email or password" error

**Solutions:**
1. ✅ Verify email is correct (case-sensitive)
2. ✅ Check if password is correct
3. ✅ Try "Forgot Password" to reset
4. ✅ Check if account is active (not suspended)
5. ✅ Contact admin to unlock if locked out

---

### User Doesn't Receive Invite Email

**Symptom:** No email after adding user

**Solutions:**
1. ✅ Check spam/junk folder
2. ✅ Verify email address was typed correctly
3. ✅ Wait up to 5 minutes for delivery
4. ✅ Ask admin to resend invite
5. ✅ Contact SecureBase support if still missing

---

### MFA Code Doesn't Work

**Symptom:** "Invalid code" error when logging in

**Solutions:**
1. ✅ Check device time is correct (critical for TOTP)
2. ✅ Wait for new code (refreshes every 30 seconds)
3. ✅ Try entering previous/next code in sequence
4. ✅ Use backup code if you saved them
5. ✅ Contact admin to reset MFA

---

### Session Expired Unexpectedly

**Symptom:** Logged out while actively using

**Solutions:**
1. ✅ Normal after 24 hours - just log back in
2. ✅ Check if admin terminated your session
3. ✅ Verify you're not exceeding 5 concurrent sessions
4. ✅ Clear browser cache and cookies
5. ✅ Try different browser

---

### Permission Denied Errors

**Symptom:** "You don't have permission" messages

**Solutions:**
1. ✅ Verify your role allows this action (see role matrix)
2. ✅ Ask admin if you need different role
3. ✅ Log out and back in (permissions may have changed)
4. ✅ Check if you're trying to access another customer's data

---

## FAQ

### How many users can we have?

**100+ users per customer account.** No hard limit, but contact us if you need more than 100.

### How much does each user cost?

**Free.** Team collaboration is included in your SecureBase subscription at no additional cost.

### Can we have multiple admins?

**Yes**, but we recommend limiting to 2-3 admins for security. Too many admins increases risk.

### Can users belong to multiple customers?

**No**. Each user account is tied to one customer. If someone needs access to multiple customers, create separate accounts with different emails (use `+` tags: `user+customer1@example.com`).

### What happens to a user's data when we remove them?

**Nothing is deleted.** User is set to inactive status, but all their activity logs and created resources remain for audit trail. They just can't log in anymore.

### Can we customize roles?

**Not yet.** Currently we offer 4 fixed roles (Admin, Manager, Analyst, Viewer). Custom roles are planned for Phase 5.

### Can we set up Single Sign-On (SSO)?

**Coming soon.** SSO with SAML 2.0 (Okta, Azure AD, Google Workspace) is planned for Phase 5.

### How do we handle employee turnover?

**Best Practice:**
1. Suspend user immediately when they leave
2. Review their recent activity
3. Rotate any API keys they had access to
4. After 30 days, permanently remove user
5. Document in your security procedures

### Can users change their own passwords?

**Yes.** Users can change passwords anytime from Profile → Security. System enforces password policy and prevents reuse of last 5 passwords.

### What if we lose our only admin?

**Contact SecureBase support immediately.** We have a secure recovery process that involves:
1. Identity verification
2. Multi-step authentication
3. Approval from your executive team
4. Creation of new admin account

### How do we audit user activity?

Go to **Activity** page to see full audit trail:
- Filter by user to see their actions
- Filter by resource to see who accessed it
- Export to CSV/PDF for compliance
- Logs retained for 7 years

### Can we restrict users to specific AWS accounts?

**Not yet.** Currently role permissions are at the customer level. Granular per-account permissions are planned for Phase 5.

### What's the difference between Inactive and Suspended?

- **Inactive**: User was removed/deleted, cannot reactivate themselves
- **Suspended**: Temporary restriction, admin can reactivate anytime

Both prevent login, but suspended implies "may come back."

---

## Getting Help

### Support Channels

**Email:** support@securebase.aws  
**Response Time:** <4 hours (business hours)

**For Urgent Issues:**
- Account lockout
- Security incidents
- Payment problems

**Call:** 1-800-SECURE-BASE  
**Available:** 24/7 for critical issues

### Documentation

- **User Guide** (this document)
- **API Reference**: [docs.securebase.aws/api](https://docs.securebase.aws/api)
- **Security Guide**: [docs.securebase.aws/security](https://docs.securebase.aws/security)
- **Video Tutorials**: [youtube.com/securebase](https://youtube.com/securebase)

### Training

**Free Webinars:**
- Team Onboarding - Every Tuesday 2pm ET
- Security Best Practices - Every Thursday 2pm ET

**Register:** [securebase.aws/training](https://securebase.aws/training)

---

## Appendix

### Role Permission Matrix

| Capability | Admin | Manager | Analyst | Viewer |
|------------|:-----:|:-------:|:-------:|:------:|
| **Dashboard** |
| View main dashboard | ✅ | ✅ | ✅ | ✅ |
| View compliance dashboard | ✅ | ✅ | ✅ | ❌ |
| **Invoices** |
| View invoices | ✅ | ✅ | ✅ | ✅ |
| Pay invoices | ✅ | ✅ | ❌ | ❌ |
| Download invoices | ✅ | ✅ | ✅ | ❌ |
| **Metrics** |
| View usage metrics | ✅ | ✅ | ✅ | ✅ |
| View cost analytics | ✅ | ✅ | ✅ | ❌ |
| **Reports** |
| View existing reports | ✅ | ✅ | ✅ | ✅ |
| Generate new reports | ✅ | ✅ | ✅ | ❌ |
| Schedule reports | ✅ | ✅ | ✅ | ❌ |
| Export data | ✅ | ✅ | ✅ | ❌ |
| **API Keys** |
| View API keys | ✅ | ✅ | ❌ | ❌ |
| Create API keys | ✅ | ✅ | ❌ | ❌ |
| Rotate API keys | ✅ | ✅ | ❌ | ❌ |
| Delete API keys | ✅ | ✅ | ❌ | ❌ |
| **Support** |
| View support tickets | ✅ | ✅ | ✅ | ❌ |
| Create support tickets | ✅ | ✅ | ✅ | ❌ |
| **Team Management** |
| View team members | ✅ | ✅ | ❌ | ❌ |
| Add users (any role) | ✅ | ❌ | ❌ | ❌ |
| Add users (Analyst/Viewer) | ✅ | ✅ | ❌ | ❌ |
| Edit users | ✅ | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ | ❌ |
| Remove users | ✅ | ❌ | ❌ | ❌ |
| Reset passwords | ✅ | ✅ | ❌ | ❌ |
| **Activity** |
| View activity feed | ✅ | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ✅ | ✅ | ❌ |
| Export activity | ✅ | ✅ | ✅ | ❌ |
| **Settings** |
| View settings | ✅ | ❌ | ❌ | ❌ |
| Modify settings | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |

---

**Happy Collaborating! 🎉**

If you have questions not covered here, reach out to support@securebase.aws.

---

**Document End**  
**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Maintained by:** SecureBase Customer Success Team
