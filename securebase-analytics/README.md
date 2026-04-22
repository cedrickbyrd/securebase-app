# SecureBase Analytics Implementation Guide

## Sprint #1: Core Analytics & GA4 Dashboards

This package contains everything you need to implement comprehensive compliance-focused analytics for SecureBase.

---

## 📦 What's Included

### A) Analytics Implementation Files

```
src/
├── utils/
│   └── analytics.js          # Core tracking utility with all compliance events
├── hooks/
│   └── useAnalytics.js       # React hooks for easy component integration
└── components/
    ├── AuthProvider.jsx      # Auth context with user identification
    ├── PolicyScanner.jsx     # Example: Policy scanner with full tracking
    └── SREDashboard.jsx      # Example: SRE dashboard with engagement tracking
```

### B) GA4 Configuration

```
config/
└── GA4_DASHBOARD_CONFIG.md   # Complete GA4 setup guide with:
    - Custom events
    - User properties
    - Funnels & reports
    - Alerts & audiences
```

---

## 🚀 Quick Start (15 minutes)

### Step 1: Install the Analytics Utility

Copy the files to your project:

```bash
# Copy utils
cp src/utils/analytics.js YOUR_PROJECT/src/utils/

# Copy hooks
cp src/hooks/useAnalytics.js YOUR_PROJECT/src/hooks/

# Copy example components (optional - for reference)
cp src/components/* YOUR_PROJECT/src/components/examples/
```

### Step 2: Set Your GA4 Measurement ID

In your `public/index.html` or Next.js `_document.js`:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA4-XXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  
  window.GA4_MEASUREMENT_ID = 'GA4-XXXXXXX'; // Your actual ID
  gtag('config', window.GA4_MEASUREMENT_ID);
</script>
```

### Step 3: Wrap Your App with Analytics

Update your `App.jsx`:

```jsx
import { useEffect } from 'react';
import { SessionTracking } from './utils/analytics';

function App() {
  // Log session start
  useEffect(() => {
    SessionTracking.logSessionStart();
  }, []);
  
  return (
    // Your existing app
  );
}
```

### Step 4: Add User Identification

In your `AuthContext.jsx` or auth provider:

```jsx
import { useEffect } from 'react';
import { identifyUser } from './utils/analytics';

export const AuthProvider = ({ children }) => {
  const { user, aal } = useYourAuth();
  
  useEffect(() => {
    if (user && aal && aal !== 'none') {
      identifyUser(user.id, {
        role: user.role,
        tier: user.tier,
        frameworks: user.frameworks,
        orgSize: user.orgSize,
        industry: user.industry
      });
    }
  }, [user, aal]);
  
  // Rest of your auth provider
};
```

### Step 5: Start Tracking Events

In your components, import the events you need:

```jsx
import { ComplianceEvents } from '@/utils/analytics';

// Track a policy scan
const handleScan = async () => {
  ComplianceEvents.policyScanInitiated('SOC2', 'full');
  
  const results = await runScan();
  
  ComplianceEvents.policyScanCompleted('SOC2', {
    total: results.findings.length,
    critical: results.criticalCount,
    high: results.highCount,
    medium: results.mediumCount,
    low: results.lowCount,
    duration: results.scanTime,
    score: results.complianceScore
  });
};

// Track a report download
const handleDownload = (format) => {
  ComplianceEvents.reportDownloaded('compliance_summary', format);
  // Your download logic
};
```

---

## 📊 GA4 Dashboard Setup (30 minutes)

Follow the step-by-step guide in `config/GA4_DASHBOARD_CONFIG.md` to:

1. **Create custom events** (15 events covering full workflow)
2. **Configure user properties** (role, tier, frameworks, etc.)
3. **Build funnels** (Compliance workflow, Remediation, SRE alerts)
4. **Set up reports** (Performance, Adoption, Effectiveness)
5. **Create alerts** (Scan failures, download drops, critical alerts)

### Priority Order:

**Week 1 (High Impact):**
1. Enable bot filtering (fixes your 99.97% direct traffic issue)
2. Configure user properties (enables role-based segmentation)
3. Mark conversion events (policy_scan_completed, report_downloaded, etc.)

**Week 2 (Deep Insights):**
4. Build Compliance Workflow funnel
5. Create Feature Adoption by Role report
6. Set up Path Exploration

**Week 3 (Optimization):**
7. Configure custom metrics (scan completion rate, time-to-remediation)
8. Set up automated alerts
9. Create audiences for remarketing

---

## 🎯 Key Events Reference

### Must-Have Events (Implement First)

| Event | When to Track | Example |
|-------|--------------|---------|
| `policy_scan_initiated` | User starts scan | SOC2 full scan started |
| `policy_scan_completed` | Scan finishes | Scan found 47 findings |
| `report_downloaded` | User downloads | PDF report downloaded |
| `remediation_started` | Fix begins | Started fixing critical finding |
| `remediation_completed` | Fix done | Remediation successful |

### Nice-to-Have Events (Add Later)

| Event | When to Track | Value |
|-------|--------------|-------|
| `alert_viewed` | SRE alert opened | Understand alert engagement |
| `integration_connected` | New integration | Track platform adoption |
| `dashboard_search` | User searches | Understand intent |
| `filter_applied` | User filters data | Feature usage patterns |

---

## 💡 Usage Examples

### Example 1: Track Policy Scanner

```jsx
import { ComplianceEvents } from '@/utils/analytics';
import { usePerformanceTracking } from '@/hooks/useAnalytics';

const PolicyScanner = () => {
  const { startTimer, endTimer } = usePerformanceTracking();
  
  const handleScan = async (policyType, scope) => {
    const timerId = startTimer('policy_scan');
    
    try {
      ComplianceEvents.policyScanInitiated(policyType, scope);
      
      const results = await api.scan(policyType, scope);
      
      ComplianceEvents.policyScanCompleted(policyType, results);
      
      endTimer(timerId, { success: true });
    } catch (error) {
      ComplianceEvents.policyScanFailed(policyType, error.type, error.message);
      endTimer(timerId, { success: false });
    }
  };
  
  return (/* your component */);
};
```

### Example 2: Track Page Engagement

```jsx
import { usePageTracking, useSectionTracking } from '@/hooks/useAnalytics';

const ComplianceDashboard = () => {
  // Auto-track page view
  usePageTracking('Compliance Dashboard', { feature: 'compliance' });
  
  // Auto-track time spent in section
  const sectionRef = useSectionTracking('compliance_dashboard');
  
  return (
    <div ref={sectionRef}>
      {/* Your dashboard content */}
    </div>
  );
};
```

### Example 3: Track Search with Debouncing

```jsx
import { useDebouncedTracking } from '@/hooks/useAnalytics';
import { ComplianceEvents } from '@/utils/analytics';

const SearchBar = () => {
  const trackSearch = useDebouncedTracking(
    (query, count) => ComplianceEvents.dashboardSearchUsed(query, count),
    500 // Wait 500ms after user stops typing
  );
  
  const handleSearch = (query) => {
    const results = performSearch(query);
    trackSearch(query, results.length);
  };
  
  return (/* search input */);
};
```

### Example 4: Track Feature Discovery

```jsx
import { useFeatureTracking } from '@/hooks/useAnalytics';

const AdvancedFilters = () => {
  // Tracks only first-time usage per session
  const trackFilterUsage = useFeatureTracking('advanced_filters');
  
  const handleFilterOpen = () => {
    trackFilterUsage(); // Only fires once
    showFilters();
  };
  
  return (/* your component */);
};
```

---

## 🔍 Debugging & Validation

### Check if Events Are Firing

Open browser console and look for:

```
[Analytics] Event tracked: policy_scan_initiated {...}
[Analytics] User identified: user_123 {...}
[Analytics] Session started: {...}
```

### Verify in GA4 Realtime

1. Go to **GA4 → Reports → Realtime**
2. Open your app in another tab
3. Perform actions (scan, download, etc.)
4. See events appear in real-time

### Common Issues

**Events not showing up:**
- Check browser console for errors
- Verify GA4 Measurement ID is correct
- Check if ad blocker is interfering
- Confirm `gtag` is defined globally

**Bot traffic still high:**
- Enable bot filtering in GA4 (see config guide)
- Verify `isAnalyticsAvailable()` is working
- Check User-Agent filtering

**User properties not set:**
- Confirm `identifyUser()` is called after auth
- Check GA4 Custom Definitions are created
- Wait 24-48 hours for properties to populate

---

## 📈 Expected Outcomes

After implementing Sprint #1, you'll be able to:

### Week 1 Results:
- ✅ Accurate user counts (bot traffic filtered)
- ✅ True conversion rate (likely 2-3%, not 0.27%)
- ✅ Basic funnel visibility

### Week 2 Results:
- ✅ Role-based engagement analysis
- ✅ Feature adoption metrics
- ✅ Drop-off point identification

### Week 3 Results:
- ✅ Power user identification
- ✅ At-risk user detection
- ✅ Product-market fit validation

### Questions You Can Now Answer:

1. **"Why is SRE Dashboard engagement so high (15.67 views/user)?"**
   - Path exploration shows user journey
   - Section tracking shows time per feature
   - Metric views show what they're monitoring

2. **"Which compliance frameworks drive conversions?"**
   - Funnel by `policy_type`
   - Conversion rate by framework
   - Time-to-value analysis

3. **"Do auditors use the product differently than admins?"**
   - Feature adoption by role
   - Workflow completion rates
   - Time spent per section

4. **"What predicts upgrade from free to paid?"**
   - Cohort analysis
   - Feature usage correlation
   - Integration count analysis

---

## 🎨 Customization

### Add Your Own Events

Edit `src/utils/analytics.js`:

```javascript
export const ComplianceEvents = {
  // Add new event
  yourCustomEvent: (param1, param2) => {
    trackEvent('your_custom_event', {
      event_category: 'your_category',
      param1: param1,
      param2: param2
    });
  },
  
  // ... existing events
};
```

### Add Custom User Properties

Edit the `identifyUser()` call:

```javascript
identifyUser(user.id, {
  role: user.role,
  tier: user.tier,
  // Add your custom properties
  custom_property: user.customValue,
  another_property: user.anotherValue
});
```

Then create matching custom dimensions in GA4 (see config guide).

---

## 📚 File-by-File Documentation

### `src/utils/analytics.js`

**Core utility with:**
- Bot filtering
- 40+ compliance event trackers
- User identification
- Session tracking
- Conversion events

**Key functions:**
- `trackPageView()` - Manual page tracking
- `ComplianceEvents.*` - All compliance workflows
- `identifyUser()` - Set user properties
- `SessionTracking.*` - Session management
- `ConversionEvents.*` - Business metrics

### `src/hooks/useAnalytics.js`

**React hooks for:**
- Auto page tracking
- Section engagement timing
- Debounced event tracking
- First-time feature discovery
- Performance measurement
- Scroll depth tracking
- Form abandonment detection

**Key hooks:**
- `usePageTracking()` - Auto-track on mount
- `useSectionTracking()` - Time spent tracking
- `useDebouncedTracking()` - Throttled events
- `useFeatureTracking()` - One-time discovery
- `usePerformanceTracking()` - Operation timing

### `config/GA4_DASHBOARD_CONFIG.md`

**Complete GA4 setup guide with:**
- 15 custom events
- 9 user/event dimensions
- 3 core funnels
- 3 custom reports
- 5 custom metrics
- 8 automated alerts
- Bot filtering setup
- BigQuery integration (optional)

---

## 🚧 Sprint #2 Preview

In Sprint #2, we'll build:

**C) Real-Time Debugging Panel**
- Live event stream viewer
- User session replay
- Event validation checker
- Performance metrics dashboard

**D) Automated Alerts**
- Slack integration for critical events
- Email alerts for anomalies
- Custom threshold monitoring
- Incident response triggers

---

## ✅ Implementation Checklist

### Setup (15 min)
- [ ] Copy analytics files to project
- [ ] Add GA4 script to HTML
- [ ] Test in browser console

### Integration (30 min)
- [ ] Add to AuthProvider
- [ ] Track 3 core events (scan, report, remediation)
- [ ] Verify in GA4 Realtime

### GA4 Config (30 min)
- [ ] Create custom events
- [ ] Add user properties
- [ ] Enable bot filtering

### Testing (15 min)
- [ ] Perform full workflow in app
- [ ] Check GA4 Realtime
- [ ] Verify events in DebugView

### Validation (24-48 hours)
- [ ] Check event counts
- [ ] Verify user properties populate
- [ ] Review initial funnel data

---

## 🆘 Support & Troubleshooting

### Need Help?

1. **Check the examples** in `src/components/`
2. **Read the config guide** in `config/GA4_DASHBOARD_CONFIG.md`
3. **Review console logs** for `[Analytics]` messages
4. **Test in GA4 DebugView** (Admin → DebugView → Enable)

### Common Questions

**Q: Events aren't showing in reports?**
A: Wait 24-48 hours. Use Realtime view for immediate feedback.

**Q: User properties not populating?**
A: Check if custom dimensions are created in GA4 Admin.

**Q: Too many events firing?**
A: Use debouncing hooks for frequent actions.

**Q: Want to track more than what's here?**
A: Just add new functions to `ComplianceEvents` object.

---

## 📞 Next Steps

1. **Implement Sprint #1** (this package)
2. **Wait 7 days** for data collection
3. **Review initial insights** in GA4
4. **Request Sprint #2** (debugging panel & alerts)

Ready to get started? Begin with Step 1 of the Quick Start guide above! 🚀
