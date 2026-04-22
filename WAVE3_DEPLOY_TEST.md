# Wave 3 GA4 Tracking - Deployment & Testing Guide

**Status:** ✅ Code committed (commit: 120decd)  
**Next Step:** Push to production and test

---

## 🚀 Deploy to Production

### Option 1: Push to GitHub (Recommended)
```bash
cd /path/to/securebase-app
git push origin main
```

This will trigger your CI/CD pipeline (if configured) or deploy via Netlify/Vercel automatically.

### Option 2: Manual Deploy
If you're using Netlify CLI:
```bash
cd phase3a-portal
npm run build
netlify deploy --prod
```

If you're using Vercel:
```bash
cd phase3a-portal
vercel --prod
```

---

## 🧪 Test Wave 3 Tracking (Do This Immediately After Deploy)

### Test 1: Verify Basic Tracking
**Open in incognito/private browser:**
```
https://demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_test&utm_content=self_verification
```

**Expected Result:**
- Check browser console: Should see `[GA4] ✅ Wave 3 Outreach Tracked`
- Go to GA4 > Realtime: Should see `wave3_outreach_visit` event within 30 seconds

### Test 2: High-Value Action Tracking
**While still on demo site with wave3_test URL:**
1. Navigate to Invoice/Pricing page
2. Check console: Should see `wave3_high_value_action` 
3. Navigate to API docs
4. Check console: Should see another `wave3_high_value_action`

**In GA4 Realtime:**
- Events should show: `wave3_high_value_action`
- Event parameters: `action: viewed_pricing` or `action: explored_api_docs`

### Test 3: Campaign-Specific URLs
**Test each campaign URL in separate incognito windows:**

**Column:**
```
https://demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_column&utm_content=founders_email
```

**Mercury:**
```
https://demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_mercury&utm_content=eng_team
```

**Lithic:**
```
https://demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_lithic&utm_content=hello_team
```

**Expected in GA4:**
- Each should fire `wave3_outreach_visit`
- Event parameter `target` should be: `column`, `mercury`, or `lithic`

---

## 📊 Monitor in GA4

### Immediate (First 24 Hours)
**Go to: GA4 > Realtime**
- Watch for incoming `wave3_outreach_visit` events
- Check which `target` (company) visits first
- Monitor page navigation after arrival

### Daily (Week 1)
**Go to: GA4 > Reports > Engagement > Events**
1. Scroll to find `wave3_outreach_visit`
2. Click the event name
3. View breakdown by `target` parameter

**Create Custom Report:**
1. GA4 > Explore > Free Form
2. Dimensions: Event name, Target (custom parameter), utm_campaign
3. Metrics: Event count, Users, Engaged sessions
4. Filter: Event name contains "wave3"

### Weekly Analysis
**Funnel Report:**
1. GA4 > Explore > Funnel Exploration
2. Steps:
   - `wave3_outreach_visit` (arrival)
   - `page_view` (engagement)
   - `wave3_high_value_action` (buying signal)
   - `wave3_outreach_conversion` (signup)
3. Breakdown by: `target` (to compare Column vs Mercury vs Lithic)

---

## ✅ Testing Checklist

- [ ] **Code deployed** to production
- [ ] **Test URL visited** in incognito browser
- [ ] **Console log** shows Wave 3 tracking message
- [ ] **GA4 Realtime** shows `wave3_outreach_visit` event
- [ ] **Invoice page** triggers `wave3_high_value_action`
- [ ] **API docs** triggers `wave3_high_value_action`
- [ ] **All three campaigns** tested (Column, Mercury, Lithic)
- [ ] **Event parameters** show correct `target` and `campaign` values

---

## 🎯 What Success Looks Like

### Within 24-48 Hours
- [ ] At least one Wave 3 event from Column/Mercury/Lithic
- [ ] Session starts showing UTM parameters in GA4
- [ ] Realtime report showing live prospect visits

### Within 1 Week
- [ ] Multiple visits from at least one target company
- [ ] High-value actions (pricing/API views) recorded
- [ ] Clear engagement pattern emerging (which features they explore)

### Within 2 Weeks
- [ ] Conversion event (signup) from at least one campaign
- [ ] Comparative data: which campaign performs best
- [ ] Follow-up triggers identified (visited but didn't convert)

---

## 🔧 Troubleshooting

### "I don't see wave3_outreach_visit in GA4"
**Possible causes:**
1. Code not deployed yet → Push to production
2. Testing on production URL without UTM params → Use full campaign URL
3. GA4 processing delay → Wait 30-60 seconds, refresh Realtime

**Fix:**
```bash
# Verify deployment
curl https://demo.securebase.tximhotep.com/ | grep "wave3"
# Should return nothing if analytics.js is minified, but deployment should work
```

### "Console shows error: gtag is not a function"
**Cause:** GA4 script not loaded yet  
**Fix:** Wait for page load, or check that GA4 tag is in `<head>`

### "Events show in Realtime but not in Reports"
**Cause:** GA4 reports have 24-48 hour delay  
**Expected:** This is normal, use Realtime for immediate feedback

---

## 📧 Campaign URLs Reference

Save these for easy access:

**Column (founders@column.com):**
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_column&utm_content=founders_email
```

**Mercury (eng@mercury.com):**
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_mercury&utm_content=eng_team
```

**Lithic (hello@lithic.com):**
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_lithic&utm_content=hello_team
```

---

## 🚨 Alert Setup (Optional but Recommended)

**Get notified when prospects visit:**

1. **GA4 > Admin > Custom Alerts**
2. **Create Alert:**
   - Name: "Wave 3 Prospect Visit"
   - Condition: Event name = `wave3_outreach_visit`
   - Threshold: > 0
   - Frequency: As it happens (or daily digest)
   - Email: cedrickbyrd@gmail.com

3. **Create Alert for High-Value Actions:**
   - Name: "Wave 3 Pricing Interest"
   - Condition: Event name = `wave3_high_value_action` AND action = `viewed_pricing`
   - Email immediately

---

**Next Actions:**
1. ✅ **Push code:** `git push origin main`
2. ✅ **Test immediately** with self-verification URL
3. ✅ **Monitor GA4 Realtime** for incoming events
4. ✅ **Check email** for responses from Column/Mercury/Lithic

**Deployed by:** Cedrick J. Byrd  
**Date:** April 6, 2026  
**Commit:** 120decd
