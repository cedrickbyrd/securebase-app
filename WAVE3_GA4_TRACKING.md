# Wave 3 Outreach - GA4 Tracking Implementation

**Date:** April 6, 2026  
**Campaign:** Wave 3 Email Outreach (Column, Mercury, Lithic)  
**Updated:** `/phase3a-portal/src/utils/analytics.js`

---

## 🎯 Events Added

### 1. **wave3_outreach_visit**
**Fires:** Automatically when user arrives from `wave3_*` campaign  
**Trigger:** On session initialization  
**Parameters:**
- `campaign` - Full campaign name (e.g., "wave3_column")
- `target` - Company name (e.g., "column", "mercury", "lithic")
- `source` - Traffic source (e.g., "email")
- `content` - Content identifier (e.g., "founders_email", "eng_team", "hello_team")
- `medium` - Marketing medium (e.g., "outreach")
- `timestamp` - ISO timestamp

**Example:**
```javascript
// User clicks: demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_column&utm_content=founders_email
// Event fires automatically: wave3_outreach_visit
{
  campaign: "wave3_column",
  target: "column",
  source: "email",
  content: "founders_email",
  medium: "outreach",
  timestamp: "2026-04-06T14:30:00Z"
}
```

---

### 2. **wave3_high_value_action**
**Fires:** When Wave 3 prospect performs high-intent actions  
**Trigger:** Automatic on Invoice/API views, or manual call  
**Parameters:**
- `campaign` - Campaign name
- `target` - Company name
- `action` - Action type
- `timestamp` - ISO timestamp

**Auto-Tracked Actions:**
- `viewed_pricing` - When Invoice page loaded
- `explored_api_docs` - When API Keys page loaded

**Manual Tracking:**
```javascript
import { trackWave3HighValueAction } from './utils/analytics';

// In your component
trackWave3HighValueAction('downloaded_whitepaper');
trackWave3HighValueAction('watched_demo_video');
trackWave3HighValueAction('requested_custom_demo');
```

---

### 3. **wave3_outreach_conversion**
**Fires:** When Wave 3 prospect completes signup  
**Trigger:** Manual call on signup submission  
**Parameters:**
- `campaign` - Campaign name
- `target` - Company name
- `content` - Content identifier
- `conversion_type` - "signup"
- `timestamp` - ISO timestamp

**Implementation:**
```javascript
import { trackWave3Conversion } from './utils/analytics';

// In SignupForm.jsx - on successful submission
const handleSignupSubmit = async (formData) => {
  // ... submit logic
  trackWave3Conversion();
};
```

---

## 📊 Campaign Tracking URLs

### Column
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_column&utm_content=founders_email
```

### Mercury
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_mercury&utm_content=eng_team
```

### Lithic
```
demo.securebase.tximhotep.com/?utm_source=email&utm_medium=outreach&utm_campaign=wave3_lithic&utm_content=hello_team
```

---

## 🔍 GA4 Analysis Queries

### Track Campaign Performance
**Navigate to:** GA4 > Reports > Engagement > Events  
**Filter by:** `wave3_outreach_visit`  
**Dimensions:** `target`, `content`  
**Metrics:** Event count, User count

### Identify High-Value Prospects
**Navigate to:** GA4 > Explore > Free Form  
**Event:** `wave3_high_value_action`  
**Breakdown by:** `target` → `action`  
**Look for:** Multiple high-value actions from same user

### Measure Conversion Rate
**Navigate to:** GA4 > Explore > Funnel Exploration  
**Steps:**
1. `wave3_outreach_visit` (arrival)
2. `page_view` (engagement)
3. `wave3_high_value_action` (intent)
4. `wave3_outreach_conversion` (signup)

---

## 📈 Key Metrics to Monitor

### Immediate (24-48 hours)
- [ ] **Traffic:** Which campaign drives visits first?
- [ ] **Engagement:** Pages viewed per campaign
- [ ] **Time on site:** Average session duration by target

### Short-term (3-7 days)
- [ ] **High-value actions:** Which company explores pricing/API?
- [ ] **Feature interest:** Compliance frameworks viewed by each
- [ ] **Drop-off points:** Where do prospects exit?

### Medium-term (1-2 weeks)
- [ ] **Conversions:** Which campaign drives signups?
- [ ] **ROI per target:** Cost per acquisition by company
- [ ] **Follow-up triggers:** Who visited but didn't convert?

---

## 🚀 Next Steps

### Immediate Implementation
1. **Deploy updated analytics.js** to production
2. **Test tracking** with personal demo visit using Wave 3 URLs
3. **Verify events** in GA4 Realtime report

### Week 1 Optimization
1. **Monitor dashboard** daily for incoming traffic
2. **Identify warm leads** (multiple page views, high-value actions)
3. **Personalize follow-ups** based on feature exploration

### Week 2 Analysis
1. **Compare campaigns** - Which target is most engaged?
2. **Refine messaging** - Adjust based on what resonates
3. **Plan Wave 4** - Target similar profiles to top performers

---

## 🔧 Technical Implementation

### Files Modified
- `/phase3a-portal/src/utils/analytics.js`

### Functions Added
- `trackWave3Outreach(utmParams)` - Auto-fires on session init
- `trackWave3HighValueAction(action)` - Track intent signals
- `trackWave3Conversion()` - Track signup conversions

### Enhanced Functions
- `initializeSessionTracking()` - Now detects Wave 3 campaigns
- `trackInvoiceView()` - Auto-tracks as high-value action
- `trackAPIDocsView()` - Auto-tracks as high-value action

---

## 📝 Example Usage in Components

### Automatic Tracking (No Code Changes Needed)
- Session start → `wave3_outreach_visit` fires automatically
- Invoice page → `wave3_high_value_action('viewed_pricing')` fires
- API docs → `wave3_high_value_action('explored_api_docs')` fires

### Manual Tracking (Add Where Needed)
```javascript
import { trackWave3HighValueAction, trackWave3Conversion } from '@/utils/analytics';

// On custom high-value interaction
const handleWhitepaperDownload = () => {
  trackWave3HighValueAction('downloaded_whitepaper');
  // ... download logic
};

// On signup submission
const handleSignup = async (data) => {
  await submitSignup(data);
  trackWave3Conversion();
};
```

---

## ✅ Testing Checklist

- [ ] Visit demo with Wave 3 URL
- [ ] Verify `wave3_outreach_visit` in GA4 Realtime
- [ ] Visit Invoice page, check `wave3_high_value_action`
- [ ] Visit API docs, check `wave3_high_value_action`
- [ ] Submit signup, verify `wave3_outreach_conversion`

---

**Implemented by:** Cedrick J. Byrd  
**Repository:** cedrickbyrd/securebase-app  
**GA4 Property:** G-EEVD92DCS1
