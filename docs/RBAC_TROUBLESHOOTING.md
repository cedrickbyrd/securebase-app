# RBAC Troubleshooting Guide

**SecureBase Phase 4 - Team Collaboration & RBAC**  
**Version:** 1.0  
**Last Updated:** January 26, 2026

---

## Common Issues and Solutions

### Authentication Issues

#### Issue: "Unauthorized: Missing authentication context"

**Symptoms:**
- API returns 401 error
- Message: "Unauthorized: Missing authentication context"

**Causes:**
1. Missing Authorization header
2. Invalid session token
3. Expired session token
4. Token from different environment

**Solutions:**

```bash
# 1. Verify token is being sent
curl -v https://api.securebase.aws/users \
  -H "Authorization: Bearer $TOKEN"

# Look for Authorization header in request

# 2. Check token expiration
# Decode JWT (use jwt.io or command line)
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .

# Check 'exp' field (Unix timestamp)

# 3. Get fresh token
curl -X POST https://api.securebase.aws/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**Prevention:**
- Implement token refresh before expiration
- Store tokens securely
- Handle 401 errors with automatic re-authentication

---

#### Issue: Account Locked After Failed Login Attempts

**Symptoms:**
- HTTP 423 (Locked) response
- Message: "Account locked due to too many failed login attempts"
- Cannot log in even with correct password

**Causes:**
- 5 or more failed login attempts within short time period
- Account automatically locked for 30 minutes

**Solutions:**

**Option 1: Wait 30 minutes**
- Account automatically unlocks after lockout period

**Option 2: Admin unlocks account**
```bash
# Admin runs:
curl -X POST https://api.securebase.aws/users/{user_id}/unlock \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Option 3: Contact support**
- Email: support@securebase.aws
- Include: User email, approximate time of lockout

**Prevention:**
- Use password manager to avoid typos
- Enable MFA for additional security
- Set up lockout notifications

---

#### Issue: MFA Code Not Working

**Symptoms:**
- MFA verification returns 401
- Message: "Invalid MFA code"
- Correct code from authenticator app

**Causes:**
1. Clock drift on phone/server
2. Using old code
3. Wrong time zone
4. Backup codes instead of TOTP

**Solutions:**

```bash
# 1. Check time synchronization
# On phone: Settings → Date & Time → Automatic

# 2. Wait for new code
# TOTP codes change every 30 seconds

# 3. Try backup codes
# Use one of the 10 backup codes from MFA setup

# 4. Reset MFA (Admin only)
curl -X DELETE https://api.securebase.aws/users/{user_id}/mfa \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# User must set up MFA again
```

**Prevention:**
- Keep phone time synced automatically
- Save backup codes in secure location
- Test MFA immediately after setup

---

### Permission Issues

#### Issue: "Forbidden: Insufficient permissions"

**Symptoms:**
- HTTP 403 error
- Message: "Insufficient permissions"
- API call fails despite being authenticated

**Causes:**
1. Wrong role for operation
2. Trying to modify higher-privilege user
3. Operation not allowed for role

**Solutions:**

**Check your current role:**
```bash
curl https://api.securebase.aws/auth/session \
  -H "Authorization: Bearer $TOKEN"

# Check "role" field in response
```

**Permission matrix:**
| Operation | Admin | Manager | Analyst | Viewer |
|-----------|-------|---------|---------|--------|
| Create Users | ✅ All | ⚠️ Limited | ❌ | ❌ |
| Edit Users | ✅ All | ⚠️ Non-Admin | ❌ | ❌ |
| View Users | ✅ | ✅ | ✅ | ✅ |

**Request role upgrade:**
- Contact your account admin
- Explain business need
- Follow principle of least privilege

**Prevention:**
- Check permissions before attempting operations
- Use permission checking in UI
- Request appropriate role during onboarding

---

#### Issue: Manager Cannot Create Admin Users

**Symptoms:**
- HTTP 403 when creating user with role "admin"
- Message: "Managers cannot create admin users"

**Causes:**
- **By design**: Managers cannot create or modify admin users
- Security control to prevent privilege escalation

**Solutions:**

**Option 1: Request Admin assistance**
```bash
# Contact an Admin to create the admin user
```

**Option 2: Create lower-privilege user**
```bash
# Manager can create manager/analyst/viewer
curl -X POST https://api.securebase.aws/users \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "New User",
    "role": "manager"  # or analyst/viewer
  }'
```

**Prevention:**
- Plan admin user creation with existing admins
- Limit admin roles to 2-3 people
- Use manager role for most team leads

---

### User Management Issues

#### Issue: Cannot Delete Own Account

**Symptoms:**
- HTTP 403 when trying to delete self
- Message: "Cannot delete your own account"

**Causes:**
- **By design**: Users cannot delete themselves
- Prevents accidental account lockout

**Solutions:**

**Request another admin to delete:**
```bash
# Another admin runs:
curl -X DELETE https://api.securebase.aws/users/{your_user_id} \
  -H "Authorization: Bearer $OTHER_ADMIN_TOKEN"
```

**Or suspend instead of delete:**
```bash
# Admin can suspend account
curl -X PUT https://api.securebase.aws/users/{user_id}/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

**Prevention:**
- N/A - this is a security feature

---

#### Issue: Email Already Exists

**Symptoms:**
- HTTP 409 when creating user
- Message: "User with this email already exists"

**Causes:**
1. Email is already registered
2. Previously deleted user with same email
3. Email belongs to user in different customer account

**Solutions:**

**Check existing users:**
```bash
curl "https://api.securebase.aws/users?search=email@example.com" \
  -H "Authorization: Bearer $TOKEN"
```

**If user was deleted:**
```bash
# Contact support to hard-delete user
# Or use different email address
```

**Prevention:**
- Check user list before creating
- Use naming convention (e.g., firstname.lastname@company.com)
- Maintain user roster outside system

---

### Session Management Issues

#### Issue: Session Expires Too Quickly

**Symptoms:**
- Logged out after short period
- Session token expires unexpectedly

**Causes:**
- Default session duration is 24 hours
- No activity extends session
- Token not being refreshed

**Solutions:**

**Use refresh tokens:**
```javascript
// Frontend code
async function refreshSession() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  const data = await response.json();
  localStorage.setItem('session_token', data.session_token);
}

// Call before token expires
setInterval(refreshSession, 23 * 60 * 60 * 1000); // 23 hours
```

**Prevention:**
- Implement automatic token refresh
- Handle 401 errors gracefully
- Re-authenticate when needed

---

#### Issue: Multiple Sessions Not Working

**Symptoms:**
- Logging in on one device logs out another
- Cannot maintain sessions on multiple browsers

**Causes:**
- **Not an issue**: Multiple sessions are supported
- Old session tokens not being reused

**Solutions:**

**Each login creates new session:**
- Login on each device separately
- Each gets its own session token
- All sessions valid until expiration

**Check active sessions:**
```bash
# Admin can view all user sessions
curl "https://api.securebase.aws/users/{user_id}/sessions" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Prevention:**
- Save session tokens per device
- Don't share tokens between devices

---

### Activity Feed Issues

#### Issue: Cannot See Other Users' Activities (Viewer Role)

**Symptoms:**
- Activity feed only shows own actions
- Cannot see team activity

**Causes:**
- **By design**: Viewers can only see own activities
- Privacy and security control

**Solutions:**

**Request role upgrade:**
- Analyst role can see all activities
- Contact admin to upgrade role

**Or request specific report:**
- Ask admin/analyst to export activity report

**Prevention:**
- Assign appropriate role during onboarding
- Use analyst role for team monitoring

---

#### Issue: Activity Logs Missing

**Symptoms:**
- Expected activities not in feed
- Gaps in audit trail

**Causes:**
1. Time range filter too narrow
2. Permission filtering (viewer role)
3. Actual bug (rare)

**Solutions:**

**Check filters:**
```bash
# Remove all filters to see everything
curl "https://api.securebase.aws/activity" \
  -H "Authorization: Bearer $TOKEN"

# Check specific time range
curl "https://api.securebase.aws/activity?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify role permissions:**
- Admin/Manager/Analyst: See all activities
- Viewer: Only own activities

**If truly missing:**
- Contact support@securebase.aws
- Provide: Approximate time, user, action type
- All activities are logged (immutable)

**Prevention:**
- Use broad date ranges when searching
- Understand role-based filtering

---

## Database Issues

#### Issue: Database Connection Timeout

**Symptoms:**
- API returns 500 error
- Message: "Database connection timeout"
- Slow response times

**Causes:**
1. RDS Proxy exhausted connections
2. Long-running queries
3. Database under heavy load

**Solutions:**

**Check RDS Proxy:**
```bash
# AWS Console → RDS → Proxies
# Monitor connection usage

# Increase max connections if needed
aws rds modify-db-proxy \
  --db-proxy-name securebase-proxy \
  --max-connections-percent 90
```

**Check for long queries:**
```sql
-- Connect to Aurora
SELECT pid, usename, state, query, query_start
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '1 minute';

-- Kill long-running queries if needed
SELECT pg_terminate_backend(pid);
```

**Prevention:**
- Monitor connection pool usage
- Set query timeouts
- Optimize slow queries

---

#### Issue: Row-Level Security (RLS) Not Isolating Data

**Symptoms:**
- User sees data from other customers
- Data leakage between tenants

**Causes:**
- RLS context not set correctly
- Bug in RLS policy
- Lambda not setting customer_id

**Solutions:**

**Verify RLS is enabled:**
```sql
-- Check RLS on users table
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'users';
-- rowsecurity should be true
```

**Check RLS context:**
```python
# In Lambda function
conn = get_db_connection()
cursor = conn.cursor()

# MUST set RLS context
cursor.execute(
    "SET app.current_customer_id = %s",
    (customer_id,)
)
```

**Test isolation:**
```sql
-- Set context as customer 1
SET app.current_customer_id = 'cust-1';
SELECT * FROM users;
-- Should only see customer 1 users

-- Set context as customer 2
SET app.current_customer_id = 'cust-2';
SELECT * FROM users;
-- Should only see customer 2 users
```

**If RLS broken:**
- **CRITICAL SECURITY ISSUE**
- Immediately contact security@securebase.aws
- Disable affected API endpoints
- Investigate root cause

**Prevention:**
- Test RLS thoroughly before production
- Include RLS checks in integration tests
- Regular security audits

---

## Performance Issues

#### Issue: Slow User List Loading

**Symptoms:**
- `/users` endpoint takes >5 seconds
- Portal UI freezes on Team Management page

**Causes:**
1. No pagination (loading all users)
2. Missing database indexes
3. Too many users

**Solutions:**

**Use pagination:**
```bash
# Load 50 users at a time
curl "https://api.securebase.aws/users?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Check indexes:**
```sql
-- Verify indexes exist
\d+ users

-- Should see indexes on:
-- customer_id, email, role, status
```

**Frontend optimization:**
```javascript
// Load users incrementally
async function loadUsers(offset = 0) {
  const response = await fetch(
    `/users?limit=50&offset=${offset}`
  );
  const data = await response.json();
  return data.users;
}

// Implement virtual scrolling for large lists
```

**Prevention:**
- Always use pagination for lists
- Implement search/filter early
- Monitor query performance

---

#### Issue: Login Takes >3 Seconds

**Symptoms:**
- Login endpoint very slow
- Poor user experience

**Causes:**
1. bcrypt work factor too high
2. Database query optimization needed
3. Network latency

**Solutions:**

**Check bcrypt rounds:**
```python
# Current: 12 rounds (recommended)
# If >12, reduce to 12
bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
```

**Optimize database query:**
```sql
-- Ensure index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Query plan
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'user@example.com';
```

**Use RDS Proxy connection pooling:**
- Reduces connection overhead
- Already configured

**Prevention:**
- Set bcrypt rounds to 12
- Monitor login latency
- Use connection pooling

---

## Security Issues

#### Issue: Suspected Unauthorized Access

**Symptoms:**
- Activity logs show unexpected actions
- User reports they didn't perform action
- Suspicious IP addresses

**Solutions:**

**Immediate actions:**
1. Reset user password
2. Revoke all API keys
3. Terminate all sessions
4. Enable MFA

```bash
# Admin runs:
# 1. Reset password
curl -X POST https://api.securebase.aws/users/{user_id}/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Suspend account temporarily
curl -X PUT https://api.securebase.aws/users/{user_id}/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

**Investigation:**
```bash
# Get all activity for user
curl "https://api.securebase.aws/activity?user_id={user_id}" \
  -H "Authorization: Bearer $TOKEN"

# Check IP addresses and timestamps
# Look for:
# - Logins from unusual locations
# - Activity at unusual times
# - Rapid actions (bot-like)
```

**Reporting:**
- Email: security@securebase.aws
- Include: User email, suspicious activity timeframe
- Export activity logs

**Prevention:**
- **Enable MFA for all users**
- Use strong passwords (12+ chars)
- Regular security awareness training
- Monitor activity logs weekly

---

## Deployment Issues

#### Issue: Lambda Function Not Found

**Symptoms:**
- 404 error on API calls
- API Gateway cannot invoke Lambda

**Causes:**
1. Lambda not deployed
2. Wrong Lambda ARN in API Gateway
3. Wrong region

**Solutions:**

**Check Lambda exists:**
```bash
aws lambda list-functions --region us-east-1 | grep user-management
```

**Deploy Lambda:**
```bash
cd phase2-backend/functions
./package-lambda.sh

aws lambda update-function-code \
  --function-name securebase-user-management \
  --zip-file fileb://deploy/user_management.zip \
  --region us-east-1
```

**Verify API Gateway integration:**
```bash
aws apigatewayv2 get-integrations \
  --api-id {api_id} \
  --region us-east-1
```

**Prevention:**
- Use Terraform for consistent deployments
- Test in staging before production
- Document deployment process

---

## Getting Help

### Before Contacting Support

1. **Check logs:**
   - CloudWatch Logs (Lambda)
   - Activity Feed (user actions)
   - Browser console (frontend errors)

2. **Verify basics:**
   - Authentication working
   - Correct permissions
   - Network connectivity

3. **Try common solutions:**
   - Refresh session token
   - Clear browser cache
   - Check API status page

### Contact Information

**General Support:**
- Email: support@securebase.aws
- Portal: Create support ticket
- Response: 24 hours

**Security Issues:**
- Email: security@securebase.aws
- Response: 4 hours
- Critical: Call +1-555-SECURE-1

**API/Technical:**
- Email: api-support@securebase.aws
- Documentation: docs.securebase.aws
- GitHub Issues: github.com/cedrickbyrd/securebase-app/issues

### Information to Provide

When contacting support, include:

1. **Environment:** Production, Staging, Dev
2. **Error message:** Exact text
3. **Timestamp:** When issue occurred (with timezone)
4. **Steps to reproduce:** What you were doing
5. **User/account:** User ID, email, customer ID
6. **Expected vs actual:** What should happen, what happened
7. **Logs:** CloudWatch logs, browser console, API responses

---

## Appendix: Diagnostic Commands

### Check User Status
```bash
curl https://api.securebase.aws/users/{user_id} \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Check Session Status
```bash
curl https://api.securebase.aws/auth/session \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### View Recent Activity
```bash
curl "https://api.securebase.aws/activity?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Test Database Connection
```bash
psql -h $RDS_HOST -U securebase_app -d securebase -c "SELECT 1;"
```

### Check RLS Context
```sql
SHOW app.current_customer_id;
```

---

**RBAC Troubleshooting Guide**  
**Version:** 1.0  
**Last Updated:** January 26, 2026  
**SecureBase Phase 4 - Team Collaboration & RBAC**
