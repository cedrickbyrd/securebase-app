# RBAC Permission Matrix Reference Card

**SecureBase Phase 4 - Team Collaboration & RBAC**  
**Version:** 1.0  
**Last Updated:** January 26, 2026

---

## Quick Reference: Role Permissions

### Permission Matrix

| Resource/Action | Admin | Manager | Analyst | Viewer |
|----------------|-------|---------|---------|--------|
| **User Management** |
| Create Users (Any Role) | ✅ | ❌ | ❌ | ❌ |
| Create Users (Manager/Below) | ✅ | ✅ | ❌ | ❌ |
| View Users | ✅ | ✅ | ✅ | ✅ |
| Edit Users | ✅ | ✅ | ❌ | ❌ |
| Delete Users | ✅ | ✅ | ❌ | ❌ |
| Change User Roles | ✅ | ⚠️ Limited | ❌ | ❌ |
| Reset Passwords | ✅ | ✅ | ❌ | ❌ |
| Unlock Accounts | ✅ | ✅ | ❌ | ❌ |
| **Account Settings** |
| View Settings | ✅ | ✅ | ✅ | ✅ |
| Modify Settings | ✅ | ⚠️ Limited | ❌ | ❌ |
| Billing Information | ✅ | ❌ | ❌ | ❌ |
| API Keys (Create) | ✅ | ✅ | ❌ | ❌ |
| API Keys (View Own) | ✅ | ✅ | ✅ | ✅ |
| API Keys (Revoke) | ✅ | ✅ | ⚠️ Own Only | ❌ |
| **Compliance & Security** |
| View Compliance Reports | ✅ | ✅ | ✅ | ✅ |
| Download Reports | ✅ | ✅ | ✅ | ✅ |
| Acknowledge Findings | ✅ | ✅ | ✅ | ❌ |
| Configure Compliance | ✅ | ⚠️ Limited | ❌ | ❌ |
| **Support & Tickets** |
| Create Tickets | ✅ | ✅ | ✅ | ✅ |
| View Tickets | ✅ | ✅ | ✅ | ✅ |
| Update Tickets | ✅ | ✅ | ✅ | ❌ |
| Close Tickets | ✅ | ✅ | ❌ | ❌ |
| **Billing & Invoices** |
| View Invoices | ✅ | ✅ | ⚠️ Limited | ⚠️ Limited |
| Download Invoices | ✅ | ✅ | ❌ | ❌ |
| Modify Payment Method | ✅ | ❌ | ❌ | ❌ |
| **Analytics & Reports** |
| View Dashboards | ✅ | ✅ | ✅ | ✅ |
| Create Custom Reports | ✅ | ✅ | ✅ | ❌ |
| Schedule Reports | ✅ | ✅ | ❌ | ❌ |
| Export Data | ✅ | ✅ | ✅ | ❌ |
| **Activity & Audit Logs** |
| View Activity Feed | ✅ | ✅ | ✅ | ✅ |
| Export Audit Logs | ✅ | ✅ | ❌ | ❌ |
| Filter by User | ✅ | ✅ | ⚠️ Own Only | ⚠️ Own Only |

**Legend:**
- ✅ Full Access
- ❌ No Access
- ⚠️ Limited Access (see details below)

---

## Role Definitions

### 🔴 Admin (Full Control)

**Use Cases:**
- Account owners
- CTO/CISO roles
- Primary administrators

**Permissions:**
- **ALL** operations across ALL resources
- Create/delete users of any role (including admins)
- Modify billing and account settings
- Access all audit logs and compliance data
- Configure security policies

**Security:**
- MFA strongly recommended
- Maximum 2-3 admins per account
- All actions logged with high priority

**Restrictions:**
- Cannot delete themselves (requires another admin)
- Cannot downgrade their own role

---

### 🟡 Manager (Team Lead)

**Use Cases:**
- Team leads
- Engineering managers
- Security team members

**Permissions:**
- Create/edit/delete users (Manager, Analyst, Viewer roles only)
- Manage team members' access
- View and download reports
- Create API keys
- Configure limited settings
- Close support tickets

**Limitations:**
- ❌ Cannot create/modify Admin users
- ❌ Cannot modify billing information
- ❌ Cannot delete the account
- ⚠️ Can only promote users up to Manager role

**Security:**
- MFA recommended
- Typical: 5-10 managers per account

---

### 🟢 Analyst (Read-Write)

**Use Cases:**
- Security analysts
- Compliance officers
- DevOps engineers

**Permissions:**
- View all compliance and security data
- Create and update support tickets
- Create custom reports and dashboards
- Acknowledge compliance findings
- View activity feed (all users)
- Create API keys (for automation)

**Limitations:**
- ❌ Cannot create/edit/delete users
- ❌ Cannot modify account settings
- ❌ Cannot close support tickets
- ❌ Cannot schedule reports
- ⚠️ Can only revoke their own API keys

**Security:**
- MFA optional but recommended
- Typical: 10-50 analysts per account

---

### 🔵 Viewer (Read-Only)

**Use Cases:**
- Auditors
- Executive stakeholders
- External consultants (temporary access)

**Permissions:**
- View dashboards and metrics
- View compliance reports
- View support tickets
- View own profile
- Create support tickets (read-only to others)

**Limitations:**
- ❌ Cannot create/edit anything
- ❌ Cannot download reports
- ❌ Cannot create API keys
- ❌ Cannot export data
- ⚠️ View-only access to activity feed (own actions only)

**Security:**
- MFA optional
- Typical: 20+ viewers per account
- Best for temporary/audit access

---

## Special Permissions & Edge Cases

### Manager Role Limitations

Managers **cannot**:
1. Create or modify Admin users
2. Promote users to Admin
3. Change their own role to Admin
4. Modify billing settings
5. Delete the customer account

Managers **can**:
- Create users up to Manager role
- Edit existing Managers, Analysts, Viewers
- Reset passwords for non-admin users
- Unlock accounts (all roles)

### Self-Service Capabilities

**All users can:**
- View their own profile
- Change their own password
- Set up/disable their own MFA
- View their own activity history
- Create support tickets
- View their own API keys

**All users cannot:**
- Change their own role
- Delete their own account
- View other users' API keys
- Modify other users' MFA settings

---

## Resource-Level Permissions

### API Keys

| Operation | Admin | Manager | Analyst | Viewer |
|-----------|-------|---------|---------|--------|
| Create (Own) | ✅ | ✅ | ✅ | ❌ |
| Create (Others) | ✅ | ✅ | ❌ | ❌ |
| View (Own) | ✅ | ✅ | ✅ | ✅ |
| View (Others) | ✅ | ✅ | ❌ | ❌ |
| Revoke (Own) | ✅ | ✅ | ✅ | ❌ |
| Revoke (Others) | ✅ | ✅ | ❌ | ❌ |
| Rotate (Own) | ✅ | ✅ | ✅ | ❌ |

### Support Tickets

| Operation | Admin | Manager | Analyst | Viewer |
|-----------|-------|---------|---------|--------|
| Create | ✅ | ✅ | ✅ | ✅ |
| View (Own) | ✅ | ✅ | ✅ | ✅ |
| View (All) | ✅ | ✅ | ✅ | ✅ |
| Update (Own) | ✅ | ✅ | ✅ | ❌ |
| Update (All) | ✅ | ✅ | ✅ | ❌ |
| Close (Own) | ✅ | ✅ | ❌ | ❌ |
| Close (All) | ✅ | ✅ | ❌ | ❌ |

### Activity Logs

| Operation | Admin | Manager | Analyst | Viewer |
|-----------|-------|---------|---------|--------|
| View (All Users) | ✅ | ✅ | ✅ | ❌ |
| View (Own Only) | ✅ | ✅ | ✅ | ✅ |
| Export Logs | ✅ | ✅ | ❌ | ❌ |
| Filter by User | ✅ | ✅ | ✅ | ❌ |
| Filter by Resource | ✅ | ✅ | ✅ | ❌ |

---

## Permission Checking Examples

### Frontend Permission Check
```javascript
import { hasPermission, getUserRole } from './services/teamService';

// Check if current user can create users
const canCreateUsers = hasPermission('users', 'create');

// Check role-specific access
const role = getUserRole();
if (role === 'admin' || role === 'manager') {
  // Show user management UI
}
```

### Backend Permission Check (Lambda)
```python
def check_permission(user_role, action, target_role=None):
    """
    Check if user_role can perform action on target_role.
    
    Examples:
      check_permission('admin', 'create_user', 'admin')  -> True
      check_permission('manager', 'create_user', 'admin') -> False
      check_permission('analyst', 'view_users') -> True
    """
    permissions = {
        'admin': ['*'],  # All permissions
        'manager': ['create_user', 'edit_user', 'delete_user', 'view_users'],
        'analyst': ['view_users'],
        'viewer': ['view_users']
    }
    
    if user_role == 'admin':
        return True
    
    if action in permissions.get(user_role, []):
        # Managers cannot create/modify admins
        if user_role == 'manager' and target_role == 'admin':
            return False
        return True
    
    return False
```

---

## Common Scenarios

### Scenario 1: Onboarding a New Team Member

**Who can do it:** Admin or Manager

**Steps:**
1. Admin/Manager creates user with appropriate role
2. User receives email with temporary password
3. User logs in and changes password
4. User sets up MFA (optional but recommended)
5. Admin/Manager verifies user can access resources

**Permissions Applied:**
- New Analyst: Can view data, create tickets, run reports
- New Manager: Can do all of above + manage users

### Scenario 2: Promoting a User

**Who can do it:** Admin only (for promotion to Admin), Manager (for Manager/below)

**Steps:**
1. Admin/Manager navigates to Team Management
2. Selects user to promote
3. Changes role to new level
4. Permissions automatically updated
5. User receives email notification

**Permission Changes:**
- Analyst → Manager: Gains user management
- Manager → Admin: Gains billing + all permissions

### Scenario 3: Offboarding a User

**Who can do it:** Admin or Manager

**Steps:**
1. Admin/Manager suspends user account
2. All active sessions terminated
3. API keys automatically revoked
4. After 30 days: Soft delete (data retained for audit)
5. After 7 years: Hard delete (compliance requirement)

**Audit Trail:**
- All actions logged in activity_feed
- Cannot be deleted (immutable)
- Available for compliance audits

---

## Best Practices

### Role Assignment
1. **Principle of Least Privilege**: Assign the minimum role needed
2. **Admin Limit**: Keep admins to 2-3 trusted individuals
3. **Regular Reviews**: Audit user roles quarterly
4. **Temporary Access**: Use Viewer role for short-term access

### Security
1. **MFA for Admins**: Mandatory (enforce in policy)
2. **MFA for Managers**: Strongly recommended
3. **Password Rotation**: Every 90 days
4. **Session Timeout**: 24 hours max
5. **Review Logs**: Weekly audit of admin actions

### Compliance
1. **Separation of Duties**: Different users for different roles
2. **Audit Trail**: 100% action logging (automatic)
3. **Data Retention**: 7 years minimum (SOC 2, HIPAA)
4. **Access Reviews**: Quarterly certification

---

## Quick Decision Tree

```
Need to add a team member?
├─ Will they manage other users?
│  ├─ YES → Admin or Manager
│  │  ├─ Need to create admins? → Admin
│  │  └─ No → Manager
│  └─ NO → Continue
├─ Will they modify data/settings?
│  ├─ YES → Analyst
│  └─ NO → Continue
└─ Read-only access only?
   └─ YES → Viewer
```

---

## Contact & Support

**Questions about permissions?**
- Email: support@securebase.aws
- Documentation: docs.securebase.aws/rbac
- Security Team: security@securebase.aws

**For role changes:**
- Contact your account Admin
- Or submit ticket via portal

---

**Permission Matrix Reference Card**  
**Version:** 1.0  
**Last Updated:** January 26, 2026  
**SecureBase Team Collaboration & RBAC**
