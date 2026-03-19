# SecureBase Demo — Golden Sales Path Guide

> **Last Updated:** March 2026 | **Status:** ✅ Live | **Version:** 2.0

This guide covers both the **always-on shared demo** (no setup needed) and the
**Golden Sales Path** — a self-service workflow that provisions a fully
interactive, data-rich demo environment in minutes.

---

## Quick Reference

| Path | Setup Time | Best For |
|------|-----------|----------|
| [Shared Demo URL](#shared-demo-link) | 0 min | Early-stage exploration, email campaigns |
| [Golden Sales Path](#golden-sales-path-self-serve) | ~5 min | Live calls, evaluations, custom walkthroughs |

---

## Shared Demo Link

**Live Demo:** http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

*(Bookmark this link!)*

### What's Inside

- ✅ Auto-login (no credentials needed)
- ✅ Real portal UI
- ✅ 5 sample customers across all tiers
- ✅ $363K+ in sample invoices
- ✅ Compliance dashboards
- ✅ Read-only (safe for prospects to click around)

### When to Use

**✅ Perfect for:**
- **"Can I see it first?" requests** — share the link immediately
- **Early-stage leads** — let them explore before booking a call
- **Technical evaluators** — hands-on experience without setup
- **Conference booth visitors** — QR code to demo
- **Email campaigns** — include as "Try Demo" CTA

**❌ Not ideal for:**
- Live sales calls that need real-time interaction
- Enterprise deals needing a tailored walkthrough
- Post-trial support conversations

---

## Golden Sales Path (Self-Serve)

The Golden Sales Path gives a sales rep a **fully provisioned, interactive
demo environment** — complete with a pre-loaded dataset, assigned RBAC roles,
and demo API keys — without requiring engineering support.

### Infrastructure Overview

```
AWS Organization (management account)
└── Customers-Sales OU            ← dedicated to demo environments
    └── securebase-demo-sales     ← shared demo AWS account
        ├── Golden dataset        ← loaded by onboard-demo-sales.sh
        ├── SalesManagerDemo      ← IAM Identity Center permission set
        └── SalesRepDemo          ← IAM Identity Center permission set
```

The Terraform resources for this infrastructure live in:
- `landing-zone/main.tf` — `aws_organizations_organizational_unit.customer_sales`
  and `aws_organizations_account.demo_sales`
- `landing-zone/modules/org/main.tf` — `aws_organizations_organizational_unit.sales`

---

### Prerequisites (One-Time Setup)

Perform these steps once. After that, any rep can self-serve.

1. **Apply Terraform** (run as platform engineer from the env directory):

   ```bash
   cd landing-zone/environments/dev
   terraform init
   terraform apply
   ```

   This creates:
   - The `Customers-Sales` OU under your AWS Organization root
   - The `securebase-demo-sales` AWS account (`demo.sales@securebase.tximhotep.com`)

2. **Enable IAM Identity Center** in the AWS Console (if not already active).

3. **Add sales reps** as users in IAM Identity Center so they can be assigned
   to the demo account.

---

### Step-by-Step: Provision a New Demo Session

Run the onboarding script from the repository root:

```bash
./scripts/onboard-demo-sales.sh \
  --rep-name  "Jane Smith" \
  --rep-email jane@acme.com \
  --demo-tag  jane-acme-$(date +%Y%m%d)
```

**What the script does automatically:**

| Step | Action |
|------|--------|
| 1 | Verifies AWS credentials and locates the Sales OU + demo account |
| 2 | Generates and applies the golden dataset SQL (5 customers, invoices, metrics, API keys) |
| 3 | Creates `SalesManagerDemo` / `SalesRepDemo` permission sets if they don't exist |
| 4 | Assigns the rep's IAM Identity Center user to the demo account |
| 5 | Prints a full summary (portal URL, credentials, teardown instructions) |

**Dry run (shows all steps without making any changes):**

```bash
./scripts/onboard-demo-sales.sh --rep-name "Jane Smith" --rep-email jane@acme.com --dry-run
```

---

### Golden Dataset — What's Loaded

#### Sample Customers (5)

| Name | Tier | Framework | Monthly Spend |
|------|------|-----------|--------------|
| HealthCorp Medical Systems | Healthcare | HIPAA | $15,000 |
| FinTechAI Analytics | Fintech | SOC 2 | $8,000 |
| GovContractor Defense Solutions | Gov-Federal | FedRAMP | $25,000 |
| StartupMVP Inc | Standard | CIS | $2,000 |
| SaaSPlatform Cloud Services | Fintech | SOC 2 | $8,000 |

**Total demo revenue: ~$58K/month**

#### Pre-Loaded Items

- 5 invoices (one per customer, prior month, status: paid)
- 5 usage-metric rows (current month)
- 3 demo API keys (HealthCorp, FinTech, GovContractor)

All rows are tagged `DemoTag: <session-tag>` so teardown is scoped and safe.

---

### RBAC Roles

| Role | Permission Set | Session Duration | Access |
|------|---------------|-----------------|--------|
| Sales Manager | `SalesManagerDemo` | 8 hours | Full read across all demo customers |
| Sales Rep | `SalesRepDemo` | 4 hours | Standard read (invoices, metrics) |

Both roles are **read-only** — prospects and reps cannot modify data.

---

### Teardown (Clean Up After a Demo)

Run teardown with the same demo tag you used at creation:

```bash
./scripts/onboard-demo-sales.sh \
  --teardown \
  --demo-tag  jane-acme-20260313 \
  --rep-email jane@acme.com
```

The script:
1. Deletes all database rows tagged with that demo tag
2. Removes the rep's IAM Identity Center assignment from the demo account

The `Customers-Sales` OU and `securebase-demo-sales` account are **not
deleted** — they are shared infrastructure. Only per-session data is removed.

---

### Manual Teardown (if script is unavailable)

Connect to the Aurora cluster and run:

```sql
DELETE FROM usage_metrics WHERE customer_id IN
  (SELECT id FROM customers WHERE tags->>'DemoTag' = 'jane-acme-20260313');
DELETE FROM api_keys  WHERE tags->>'DemoTag' = 'jane-acme-20260313';
DELETE FROM invoices  WHERE tags->>'DemoTag' = 'jane-acme-20260313';
DELETE FROM customers WHERE tags->>'DemoTag' = 'jane-acme-20260313';
```

Then remove the IAM Identity Center account assignment via the AWS Console.

---

## Email Templates

### Quick Share (Copy-Paste)

```
🖥️ Try SecureBase Demo (no signup required):
http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

• Pre-populated with 5 sample customers
• Full portal functionality (read-only)
• Explore at your own pace

Ready to deploy your own? Start free trial: https://securebase.tximhotep.com/signup
```

### Invite to Live Demo Session

```
Subject: Personalized SecureBase Demo — Ready for You

Hi [Name],

I've set up a live demo environment tailored for your evaluation.

🎯 Portal: https://portal-demo.securebase.tximhotep.com
📧 Login:  [their email]

What's inside:
✓ 5 sample customers across Healthcare, Fintech, and Government tiers
✓ Real-time dashboard with cost and compliance metrics
✓ Invoice management, API key rotation, and audit trail
✓ Your account is already provisioned — no setup needed

The environment is yours for the next [X] hours.

Questions? Reply here or book a call: [Calendly link]

[Your name]
```

### Follow-Up After Demo

```
Hi [Name],

I saw you explored the demo — what did you think?

A few things I'd love to know:
1. Which features stood out most?
2. Questions about how it maps to [their use case]?
3. Ready for a free trial with your own AWS account?

Happy to hop on a call: [Calendly link]

[Your name]
```

---

## Demo Talking Points

**Opening:**
> "I've pre-loaded a live environment with five sample customers — healthcare,
> fintech, government, and standard. Everything you see is real data flowing
> through the actual portal. Let me walk you through it."

**On the read-only limitation:**
> "Today's session is scoped to read access — you can explore every screen
> without worrying about changing anything. When you're ready to go hands-on
> with your own infrastructure, the free trial gives you full control."

**Transitioning to trial:**
> "The demo shows you the portal. The free trial deploys SecureBase into your
> own AWS account in under ten minutes — so you see your organization, your
> accounts, your compliance posture."

---

## Conversion Playbook

| Stage | Action |
|-------|--------|
| Before demo | Send shared demo link in email / LinkedIn |
| During call | Use Golden Sales Path for interactive walkthrough |
| After 24 h | Send follow-up email (template above) |
| 3-day follow-up | Offer free trial link |
| 7-day follow-up | Share relevant case study or pricing |

**Target:** 30–50% of demo visitors should book a call or start a trial.

---

## Portal Pages Available in the Demo

| Page | Contents |
|------|----------|
| ✅ Dashboard | Metrics cards, cost trend, compliance score |
| ✅ Invoices | 30+ sample invoices with PDF download CTA |
| ✅ Cost Forecasting | 12-month projection, tier breakdown |
| ✅ API Keys | 3 sample keys with rotation controls |
| ✅ Compliance | 4 frameworks (HIPAA, SOC 2, FedRAMP, CIS) |
| ✅ Webhooks | 3 configured endpoints |
| ✅ Support Tickets | 3 sample tickets |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Script reports "Sales OU not found" | Run `terraform apply` from `landing-zone/environments/dev/` first |
| Script reports "Demo account not found" | Same as above — Terraform provisions the account |
| Golden dataset not loading | Set `DB_CONNECTION_STRING` env var or apply the SQL manually |
| IAM Identity Center user not found | Add the user in the IAM Identity Center console, then re-run |
| Demo not loading in browser | Prospect may be on a VPN that blocks S3; try the portal URL instead |

---

## TODO (Future Enhancements)

- [ ] **One-click web UI** — a simple form on `https://demo.securebase.tximhotep.com/new`
  where a sales rep enters their name and email, clicks "Create Demo", and
  receives a portal link — no CLI required.
  *(Planned in Phase 6; tracked in [issue tracker])*
- [ ] Slack bot integration — `/securebase-demo @jane` provisions a session
  and posts the portal URL in-channel.
- [ ] Automatic session expiry (TTL-based teardown via EventBridge cron).

---

## Resources

| Resource | Link |
|----------|------|
| Onboarding script | `scripts/onboard-demo-sales.sh` |
| Terraform Sales OU | `landing-zone/main.tf` (aws_organizations_organizational_unit.customer_sales) |
| Demo backend module | `landing-zone/modules/demo-backend/` |
| Portal source | `phase3a-portal/` |
| Pricing sheet | `PRICING.md` |
| FAQ | `FAQ.md` |
| Platform docs | `docs/PAAS_ARCHITECTURE.md` |

**Contacts:**
- Demo technical issues: dev-team@securebase.tximhotep.com
- Sales questions: sales@securebase.tximhotep.com
- Slack: #sales-enablement


## 🎯 Demo URL

**Live Demo:** http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

*(Bookmark this link!)*

---

## 📖 What Is It?

A fully functional, pre-populated version of the SecureBase Customer Portal that prospects can explore **without signing up**.

**Key Features:**
- ✅ Auto-login (no credentials needed)
- ✅ Real portal UI
- ✅ 5 sample customers across all tiers
- ✅ $363K+ in sample invoices
- ✅ Compliance dashboards
- ✅ Read-only (safe for prospects to click around)

---

## 💬 When to Use

### ✅ Perfect For:
- **"Can I see it first?" requests** - Share the link immediately
- **Early-stage leads** - Let them explore before booking a call
- **Technical evaluators** - Hands-on experience without setup
- **Conference booth visitors** - QR code to demo
- **Email campaigns** - Include as "Try Demo" CTA
- **Social proof** - "See for yourself" messaging

### ❌ Not Ideal For:
- **Custom deployments** - Book a personalized demo instead
- **Enterprise deals** - They need to see their specific use case
- **Post-trial support** - Demo doesn't show real customer data

---

## 📧 How to Share

### Quick Share (Copy-Paste)

```
🖥️ Try SecureBase Demo (no signup required):
http://securebase-phase3a-demo.s3-website-us-east-1.amazonaws.com

• Pre-populated with 5 sample customers
• Full portal functionality (read-only)
• Explore at your own pace

Ready to deploy your own? Start free trial: https://securebase.tximhotep.com/signup
```

### Email Template

**Subject:** See SecureBase in Action - Live Demo

```
Hi [Name],

Want to see how SecureBase works before committing?

🎯 Try our live demo (no signup required):
[DEMO LINK]

What's inside:
✓ Dashboard with real-time metrics
✓ Invoice management (30+ sample invoices)
✓ Compliance tracking (HIPAA, SOC 2, FedRAMP, CIS)
✓ API key management
✓ Cost forecasting

The demo is pre-populated with 5 sample customers so you can explore everything.

Questions? Let me know!

[Your name]

P.S. Ready to deploy? Start your free trial: https://securebase.tximhotep.com/signup
```

### Follow-Up Template

**After they visit the demo:**

```
Hi [Name],

I saw you checked out our demo! What did you think?

A few questions:
1. Which features stood out to you?
2. Any questions about how it would work for [their company]?
3. Want to see how it handles [their specific use case]?

Would love to chat - [Calendly link]

[Your name]
```

---

## 🎨 What They'll See

### Sample Customers (5 total)

1. **HealthCorp Medical Systems** - Healthcare tier ($15K/mo)
2. **FinTechAI Analytics** - Fintech tier ($8K/mo)
3. **StartupMVP Inc** - Standard tier ($2K/mo)
4. **GovContractor Defense Solutions** - Government tier ($25K/mo)
5. **SaaSPlatform Cloud Services** - Fintech tier ($8K/mo)

### Key Metrics Shown

- **Total Revenue:** $58,240/month
- **Compliance Score:** 92%
- **API Requests:** 3.45M this month
- **Uptime:** 99.87%
- **Active Alerts:** 3

### Available Pages

✅ Dashboard  
✅ Invoices (30+ samples)  
✅ Cost Forecasting  
✅ API Keys (3 shown)  
✅ Compliance (4 frameworks)  
✅ Webhooks (3 configured)  
✅ Support Tickets (3 examples)  

---

## ⚙️ Demo Limitations

**What prospects can't do:**
- ❌ Create new invoices
- ❌ Edit existing data
- ❌ Generate real API keys
- ❌ Download actual PDFs
- ❌ Make payments

**Why?** Read-only mode prevents any writes. Friendly toast message appears: *"This is a demo - changes are not saved"*

**Data Reset:** All demo data resets every 24 hours.

---

## 🎯 Call-to-Actions in Demo

The demo includes prominent CTAs:

1. **Demo Banner** (top of page)
   - "Start Free Trial" button
   - "Book Live Demo" button

2. **Footer CTAs** (every page)
   - "Start Free Trial"

**Where they go:**
- Start Free Trial → https://securebase.tximhotep.com/signup
- Book Demo → https://securebase.tximhotep.com/contact

---

## 📊 Conversion Playbook

### Before Demo
- Share link in emails, LinkedIn messages
- Include in proposal decks
- Add to email signatures

### During Demo Visit
- Track time spent (if analytics enabled)
- Note which pages they viewed
- See if they clicked CTAs

### After Demo Visit
**Within 24 hours:**
1. Send follow-up email (template above)
2. Ask what they thought
3. Offer personalized demo call
4. Share relevant case study/pricing

**Follow-up questions to ask:**
- "What did you explore in the demo?"
- "Did it match what you're looking for?"
- "Want to see how it handles [specific need]?"
- "Ready to start your free trial?"

---

## 🚀 Demo vs. Free Trial

| Feature | Demo | Free Trial |
|---------|------|------------|
| Signup Required | ❌ No | ✅ Yes |
| Real Infrastructure | ❌ Sample data | ✅ Your AWS account |
| Editable | ❌ Read-only | ✅ Full control |
| Time Limit | ♾️ Unlimited | ⏰ 30 days |
| Best For | Early exploration | Serious evaluation |

**Progression:**
1. Demo → Explore without commitment
2. Book Call → Personalized walkthrough
3. Free Trial → Hands-on with real infrastructure
4. Purchase → Production deployment

---

## 🎤 Talking Points

**When sharing the demo:**

> "We have a live demo you can try right now - no signup required. It's pre-populated with sample data so you can see exactly how the portal works. Takes 5 minutes to explore."

**If they ask about limitations:**

> "It's read-only, so you can click around safely without changing anything. Think of it like a showroom car - you can sit in it, test the features, but you can't drive it off the lot. That's what the free trial is for."

**Transition to trial:**

> "The demo gives you a feel for the UI. When you're ready to see it work with YOUR infrastructure, start the free trial. We'll deploy everything in your AWS account in under 10 minutes."

---

## ❓ Common Questions

**Q: Is this the real product?**  
A: Yes! Same code, same UI. Just pre-populated with sample data.

**Q: Can I test API integrations?**  
A: Demo is read-only. For API testing, start the free trial.

**Q: Will my data be saved?**  
A: No, demo is read-only. All data resets every 24 hours.

**Q: Can I customize it?**  
A: Not in demo mode. Free trial gives you full customization.

**Q: How long can I use it?**  
A: Unlimited! Demo never expires.

---

## 🐛 Troubleshooting

**Demo not loading?**
- Check if prospect is on VPN (some block AWS S3)
- Try different browser
- Clear cache and reload
- Share staging URL as backup

**Features not working?**
- Expected - it's read-only mode
- Explain that's by design
- Offer free trial for full functionality

**Looks different from screenshots?**
- Demo updates regularly
- Latest product version
- Reach out if concerned

---

## 📈 Metrics to Track

**Key metrics:**
1. **Traffic** - How many prospects visit demo?
2. **Engagement** - Average time spent in demo
3. **Conversion** - Demo → Trial signup rate
4. **Drop-off** - Which page do they leave from?

**Goal:** 30-50% of demo visitors should book a call or start trial.

---

## 📞 Need Help?

**Demo technical issues:** dev-team@securebase.tximhotep.com  
**Sales questions:** sales@securebase.tximhotep.com  
**Updated demo link?** Check Slack #sales channel  

**More Resources:**
- Full documentation: `phase3a-portal/DEMO_ENVIRONMENT.md`
- Pricing sheet: `PRICING.md`
- FAQ: `FAQ.md`

---

**Last Updated:** January 30, 2026  
**Demo Version:** 1.0  
**Status:** ✅ Live and Ready to Share
