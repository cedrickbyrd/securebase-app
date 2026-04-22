# SecureBase Analytics - Quick Reference

## 🎯 Most Common Events

```javascript
import { ComplianceEvents } from '@/utils/analytics';

// Policy Scanning
ComplianceEvents.policyScanInitiated('SOC2', 'full');
ComplianceEvents.policyScanCompleted('SOC2', { total: 47, critical: 3, high: 8 });

// Reports
ComplianceEvents.reportDownloaded('compliance_summary', 'pdf');

// Remediation
ComplianceEvents.remediationStarted('finding_123', 'critical', 'manual');
ComplianceEvents.remediationCompleted('finding_123', 'automated', 15);

// SRE Dashboard
ComplianceEvents.alertViewed('alert_456', 'security', 'critical');
ComplianceEvents.infrastructureFiltered('region', 'us-west-2', 150);

// Search
ComplianceEvents.dashboardSearchUsed('s3 bucket', 23);
```

## 🪝 Most Useful Hooks

```javascript
import { 
  usePageTracking,
  useSectionTracking,
  useDebouncedTracking,
  useFeatureTracking 
} from '@/hooks/useAnalytics';

// Auto-track page view
usePageTracking('Dashboard');

// Track section engagement time
const ref = useSectionTracking('sre_dashboard');
return <div ref={ref}>...</div>;

// Debounced search tracking
const trackSearch = useDebouncedTracking(
  (q, count) => ComplianceEvents.dashboardSearchUsed(q, count),
  500
);

// Track first-time feature usage
const trackFilter = useFeatureTracking('advanced_filters');
```

## 🔧 User Identification

```javascript
import { identifyUser } from '@/utils/analytics';

// In your AuthProvider
useEffect(() => {
  if (user) {
    identifyUser(user.id, {
      role: 'admin',
      tier: 'team',
      frameworks: ['SOC2', 'HIPAA']
    });
  }
}, [user]);
```

## 📊 GA4 Quick Checks

**Realtime View:**
GA4 → Reports → Realtime

**DebugView:**
GA4 → Admin → DebugView

**Custom Events:**
GA4 → Admin → Events

**Funnels:**
GA4 → Explore → Funnel exploration

## 🐛 Debugging

```javascript
// Check if analytics is working
import { isAnalyticsAvailable } from '@/utils/analytics';
console.log('Analytics ready:', isAnalyticsAvailable());

// Watch console for tracking logs
// Should see: [Analytics] Event tracked: ...
```

## 📋 Event Categories

| Category | Events |
|----------|--------|
| Compliance | policy_scan_*, report_* |
| Remediation | remediation_* |
| SRE | alert_*, metric_viewed |
| Engagement | search, filter_applied, section_engagement |
| Integration | integration_connected, api_key_generated |

## ⚡ Performance Tips

1. Use debouncing for frequent events (search, scroll)
2. Use feature tracking for one-time discovery
3. Track errors in try-catch blocks
4. Don't track in development mode
5. Filter bot traffic

## 🎨 Custom Events

```javascript
// In src/utils/analytics.js
export const ComplianceEvents = {
  yourNewEvent: (param) => {
    trackEvent('your_event_name', {
      event_category: 'category',
      your_param: param
    });
  }
};
```

## 📈 Key Metrics to Watch

- **Scan Completion Rate**: scans_completed / scans_initiated
- **Report Download Rate**: reports_downloaded / scans_completed
- **Remediation Success**: remediations_completed / remediations_started
- **Alert Response Time**: alert_acknowledged_time - alert_viewed_time
- **Feature Adoption**: unique_users_per_feature / total_users

## 🚦 Traffic Light System

🟢 **Green (Good):**
- Scan completion rate > 90%
- Report download rate > 40%
- Alert response time < 5 min

🟡 **Yellow (Warning):**
- Scan completion rate 70-90%
- Report download rate 20-40%
- Alert response time 5-15 min

🔴 **Red (Action Needed):**
- Scan completion rate < 70%
- Report download rate < 20%
- Alert response time > 15 min

## 🔗 Useful Links

- [Full Documentation](./README.md)
- [GA4 Configuration Guide](./config/GA4_DASHBOARD_CONFIG.md)
- [Example Components](./src/components/)
- [Google Analytics Help](https://support.google.com/analytics)
