# Frontend Deployment Guide - Unified Authentication

**Date**: May 7, 2026  
**Status**: Lambda functions updated ✅

## Quick Deploy Commands

### Marketing Site (securebase.tximhotep.com)

```bash
# 1. Navigate to root directory
cd /Users/cedrickbyrd/projects/securebase-terraform/securebase-app

# 2. Create production environment file
cat > .env.production << 'EOF'
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_API_BASE_URL=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF

# 3. Build the application
npm run build

# 4. Deploy to Netlify
netlify deploy --prod --dir=dist
```

### Portal (demo.securebase.tximhotep.com)

```bash
# 1. Navigate to portal directory
cd phase3a-portal

# 2. Create production environment file  
cat > .env.production << 'EOF'
VITE_USE_UNIFIED_AUTH=true
VITE_API_ENDPOINT=https://api.securebase.tximhotep.com
VITE_DEMO_MODE=false
EOF

# 3. Build the application
npm run build

# 4. Deploy to Netlify
netlify deploy --prod --dir=dist --site=demo-securebase
```

## Testing Cross-Domain Authentication

### 1. Test Login with Cookies

```bash
# Test login endpoint
curl -X POST https://api.securebase.tximhotep.com/auth \
  -H "Content-Type: application/json" \
  -H "Origin: https://securebase.tximhotep.com" \
  -d '{"email":"demo@securebase.com","password":"demo123"}' \
  -c cookies.txt -v

# Look for Set-Cookie headers in the response
```

### 2. Test Session Validation

```bash
# Test session validation with cookies
curl -X GET https://api.securebase.tximhotep.com/validate \
  -H "Origin: https://demo.securebase.tximhotep.com" \
  -b cookies.txt -v
```

### 3. Browser Testing

1. Open Chrome DevTools (F12)
2. Navigate to https://securebase.tximhotep.com
3. Login with test credentials
4. Check Application > Cookies > https://securebase.tximhotep.com
5. Look for:
   - `securebase_session` cookie
   - Domain: `.tximhotep.com`
   - HttpOnly: ✓
   - Secure: ✓
   - SameSite: None

6. Open new tab to https://demo.securebase.tximhotep.com
7. Verify you're already logged in (session shared)

## API Gateway CORS Configuration

The Lambda functions are configured, but API Gateway CORS needs manual update:

1. Go to AWS Console > API Gateway
2. Find your SecureBase API
3. For each auth endpoint (`/auth`, `/validate`, etc.):
   - Click on the method (POST, GET)
   - Click "Method Response"
   - Add headers:
     - `Access-Control-Allow-Credentials`
     - `Access-Control-Expose-Headers`
   - Click "Integration Response"
   - Map headers:
     - `Access-Control-Allow-Credentials` → `'true'`
     - `Access-Control-Expose-Headers` → `'Set-Cookie,X-CSRF-Token'`

4. Deploy the API:
   - Actions > Deploy API
   - Select stage (dev/prod)
   - Deploy

## Rollback Instructions

If issues occur:

```bash
# 1. Disable unified auth in frontends
echo "VITE_USE_UNIFIED_AUTH=false" > .env.production

# 2. Rebuild and redeploy
npm run build && netlify deploy --prod

# 3. Lambda functions still accept bearer tokens (backward compatible)
```

## Success Criteria

- [ ] Login creates httpOnly cookies
- [ ] Cookies have correct domain (`.tximhotep.com`)
- [ ] Session persists across subdomains
- [ ] CSRF tokens are validated
- [ ] Old bearer token auth still works

## Current Status

✅ **Lambda Functions Updated**:
- `securebase-auth-v2` - Cookie support enabled
- `securebase-validate-session` - Cookie validation enabled
- CSRF secret configured
- Session duration: 24 hours

⏳ **Pending**:
- Frontend deployments
- API Gateway CORS configuration
- End-to-end testing