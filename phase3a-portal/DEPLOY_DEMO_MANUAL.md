# 🚀 Manual Demo Deployment (Skip Netlify CLI Issues)

## Quick Fix: Deploy via Netlify Dashboard

Since Netlify CLI is having temp directory issues, let's use the dashboard instead:

### Step 1: Build the Portal
```bash
cd phase3a-portal
npm run build
```

This creates a `dist/` folder with your built site.

### Step 2: Deploy via Netlify Dashboard

1. **Go to:** https://app.netlify.com
2. **Drag & Drop:**
   - Simply drag the `phase3a-portal/dist/` folder
   - Drop it onto the Netlify dashboard
   - It will auto-deploy

3. **Or use "Deploy manually":**
   - Click "Add new site" → "Deploy manually"
   - Drag `dist/` folder
   - Wait for deployment

4. **Add Custom Domain:**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter: `demo.securebase.tximhotep.com`
   - Follow prompts to configure

### Alternative: Fix Netlify CLI
```bash
# Reinstall Netlify CLI
npm uninstall -g netlify-cli
npm install -g netlify-cli@latest

# Clear npm cache
npm cache clean --force

# Try again
cd phase3a-portal
netlify deploy --dir=dist
```

### Or Use GitHub Integration (Best Long-Term)

1. **Push to GitHub:**
```bash
   git add -A
   git commit -m "Add demo environment"
   git push origin main
```

2. **Connect Netlify to GitHub:**
   - Netlify Dashboard → New site from Git
   - Connect to GitHub
   - Select `securebase-app` repo
   - Build command: `cd phase3a-portal && npm run build`
   - Publish directory: `phase3a-portal/dist`

3. **Auto-deploy on push:**
   - Every git push auto-deploys
   - Much easier than manual

### Step 3: Add Demo Customer to Database
```bash
# This part still works - create demo customer
cat > create-demo-customer.sql << 'SQL'
INSERT INTO customers (
  id, email, first_name, last_name, org_name, tier, status,
  subscription_status, onboarding_status, email_verified, created_at
) VALUES (
  'demo-user-001',
  'demo@securebase.tximhotep.com',
  'Demo', 'User', 'Acme Corporation', 'fintech', 'active',
  'trialing', 'completed', TRUE, NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email;

INSERT INTO onboarding_jobs (id, customer_id, overall_status, created_at, updated_at)
VALUES ('demo-job-001', 'demo-user-001', 'completed', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT '✅ Demo customer created' as result;
SQL

# Get password and run
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds/admin-password \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

PGPASSWORD=$DB_PASSWORD psql \
  -h securebase-phase2-dev.cluster-coti40osot2c.us-east-1.rds.amazonaws.com \
  -U adminuser \
  -d securebase \
  -f create-demo-customer.sql
```

### ✅ Simple Workflow

**Today (Quick & Dirty):**
1. `cd phase3a-portal && npm run build`
2. Drag `dist/` folder to Netlify dashboard
3. Add domain `demo.securebase.tximhotep.com`
4. Run SQL to create demo customer
5. Done! 🎉

**This Week (Proper Setup):**
1. Push repo to GitHub
2. Connect Netlify to GitHub
3. Auto-deploy on every push
4. Set up environment variables in Netlify

