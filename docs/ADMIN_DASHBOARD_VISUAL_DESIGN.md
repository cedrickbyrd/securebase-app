# Phase 5.1 Visual Design Documentation

**Executive/Admin Dashboard UI Design**  
**Date:** January 29, 2026  
**Version:** 1.0

---

## Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  SECUREBASE - Executive Dashboard                    [24h ▼] [●ON] [↻] │
│  Platform-wide health and performance metrics                          │
│  Last updated: 9:45:23 PM                                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👥 CUSTOMER OVERVIEW                                                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐            │
│  │ 👥 147   │ ✓ 142    │ ✗ 5      │ $ 58.4K  │ ↗ +12.5% │            │
│  │ Total    │ Active   │ Churned  │ MRR      │ Growth   │            │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘            │
│                                                                         │
│  📊 API PERFORMANCE                                                    │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐             │
│  │ 2.8M   │ 45ms   │ 285ms  │ 820ms  │ 0.18%  │ 99.82% │             │
│  │ Reqs   │ P50    │ P95    │ P99    │ Errors │ Success│             │
│  └────────┴────────┴────────┴────────┴────────┴────────┘             │
│                                                                         │
│  🖥️ INFRASTRUCTURE HEALTH                                             │
│  ┌────────┬────────┬────────┬────────┬────────┐                      │
│  │ ⚡ 487  │ ⚠️ 15   │ ✓ 0    │ 🗄️ 42   │ 📊 78.5%│                      │
│  │ Cold   │ Errors │ Throttle│ Aurora │ Cache  │                      │
│  │ Starts │        │        │ Conns  │ Hit    │                      │
│  └────────┴────────┴────────┴────────┴────────┘                      │
│                                                                         │
│  🛡️ SECURITY & COMPLIANCE                                             │
│  ┌────────┬────────┬────────┬────────┐                               │
│  │ ✓ 0    │ ⚠️ 3    │ ⚠️ 1    │ 97.2%  │                               │
│  │ Critical│ Violate │ Open   │ Compli │                               │
│  │ Alerts │        │ Incidents│ ance  │                               │
│  └────────┴────────┴────────┴────────┘                               │
│                                                                         │
│  💰 COST ANALYTICS                                                     │
│  ┌────────────┬────────────┬──────────────────────┐                  │
│  │ $ 8.42K    │ $ 12.63K   │ TOP COST DRIVERS:    │                  │
│  │ Current    │ Projected  │ 🔵 Aurora    $2,840  │                  │
│  │ Month      │ Month-End  │ 🟡 Lambda    $1,920  │                  │
│  │            │            │ 🟢 DynamoDB  $1,540  │                  │
│  └────────────┴────────────┴──────────────────────┘                  │
│                                                                         │
│  🕐 RECENT DEPLOYMENTS                                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ ✓ API Gateway v2.4.1    production  alice@... 1 hour ago     │    │
│  │ ✓ Lambda: report v1.8.0 production  bob@...   2 hours ago    │    │
│  │ ✓ Frontend v3.2.0       production  carol@... 3 hours ago    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ⚡ SYSTEM HEALTH                                                      │
│  ┌───────────┬───────────┬───────────┬───────────┐                   │
│  │ ✓ API GW  │ ✓ Lambda  │ ✓ DynamoDB│ ✓ Aurora  │                   │
│  │ 99.98%    │ 99.95%    │ 99.99%    │ 99.97%    │                   │
│  ├───────────┼───────────┼───────────┼───────────┤                   │
│  │ ✓ CloudFr │ ✓ S3      │ ⚠️ Cache  │ ✓ SQS     │                   │
│  │ 100.0%    │ 99.99%    │ 98.50%    │ 99.96%    │                   │
│  └───────────┴───────────┴───────────┴───────────┘                   │
│                                                                         │
│  🌍 REGIONAL HEALTH                                                    │
│  ┌─────────────────────────┬─────────────────────────┐               │
│  │ ✓ us-east-1 (Primary)   │ ✓ us-west-2 (Standby)   │               │
│  │   8 services / 45ms     │   8 services / 52ms     │               │
│  └─────────────────────────┴─────────────────────────┘               │
│                                                                         │
│  ⚠️ ACTIVE INCIDENTS                                                  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 🟡 INC-001 [MEDIUM] Investigating                            │    │
│  │    ElastiCache intermittent connection timeouts              │    │
│  │    Affected: ElastiCache, API Gateway                        │    │
│  │    Started: 1 hour ago                                       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ────────────────────────────────────────────────────────────────    │
│  📊 OVERALL SYSTEM HEALTH: 87.5% Availability                         │
│  7 of 8 services operational                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Color Scheme

### Status Colors
- **🟢 Green** (`bg-green-100`, `text-green-600`): Operational, healthy, success
- **🟡 Yellow** (`bg-yellow-100`, `text-yellow-600`): Warning, degraded, approaching threshold
- **🔴 Red** (`bg-red-100`, `text-red-600`): Critical, down, failed, exceeds threshold
- **🔵 Blue** (`bg-blue-100`, `text-blue-600`): Neutral, informational
- **🟣 Purple** (`bg-purple-100`, `text-purple-600`): Financial metrics

### Metric Card Design
```
┌─────────────────────────┐
│ [Icon]        [Trend ↗] │
│                         │
│ Metric Name             │
│ 99.95                   │  ← Large, bold number
│ 2.3% increase           │  ← Subtitle/context
└─────────────────────────┘
```

### Icons (Lucide React)
- 👥 Users - Customer metrics
- 📊 BarChart3 - API requests
- ⚡ Zap - Latency, Lambda
- 🗄️ Database - Aurora, DynamoDB
- 🛡️ Shield - Security, compliance
- 💰 DollarSign - Costs, revenue
- 🕐 Clock - Deployments, time
- ⚠️ AlertTriangle - Warnings, incidents
- ✓ CheckCircle - Success, operational
- ✗ XCircle - Failed, degraded
- 📈 TrendingUp - Growth, trends
- ⚡ Activity - General activity

---

## Responsive Breakpoints

### Desktop (≥768px)
- Sidebar navigation (64px wide)
- Multi-column grid layouts
- All metrics visible
- Full dashboard width

### Tablet (≥640px, <768px)
- Collapsed navigation (hamburger menu)
- 2-column grid for metric cards
- Stacked sections

### Mobile (<640px)
- Hamburger menu
- Single column layout
- Scrollable cards
- Touch-optimized controls

---

## Interactive Elements

### Time Range Selector
```
┌──────────────────┐
│ Last 24 Hours  ▼ │
├──────────────────┤
│ Last Hour        │
│ Last 24 Hours  ✓ │  ← Currently selected
│ Last 7 Days      │
│ Last 30 Days     │
└──────────────────┘
```

### Auto-Refresh Toggle
```
ON State:  [Auto-refresh ON]  ← Green background
OFF State: [Auto-refresh OFF] ← Gray background
```

### Refresh Button
```
[↻ Refresh]
Loading:  [⟳ Refresh] ← Spinning icon
```

---

## Loading States

### Skeleton Loaders
```
┌─────────────────────────┐
│ [███]        [████]     │  ← Animated pulse
│                         │
│ ████████                │
│ ██████████████          │
│ ████████                │
└─────────────────────────┘
```

### Progress Indicators
```
Service Uptime Progress Bar:
████████████████████░░ 99.98%
└─ Green fill (>99.9%)

████████████░░░░░░░░░ 98.50%
└─ Yellow fill (98-99.9%)

█████░░░░░░░░░░░░░░░░ 95.20%
└─ Red fill (<98%)
```

---

## Threshold Indicators

### API Latency
- **P50 <100ms**: 🟢 Green (optimal)
- **P50 100-200ms**: 🟡 Yellow (acceptable)
- **P50 >200ms**: 🔴 Red (slow)

- **P95 <500ms**: 🟢 Green
- **P95 500-1000ms**: 🟡 Yellow
- **P95 >1000ms**: 🔴 Red

- **P99 <1000ms**: 🟢 Green
- **P99 >1000ms**: 🟡 Yellow

### Error Rates
- **<1%**: 🟢 Green (healthy)
- **1-5%**: 🟡 Yellow (warning)
- **>5%**: 🔴 Red (critical)

### Infrastructure
- **Lambda Cold Starts <100/hr**: 🟢 Green
- **Lambda Errors <10/hr**: 🟢 Green
- **DynamoDB Throttles = 0**: 🟢 Green (any >0 = 🔴 Red)
- **Cache Hit Rate ≥70%**: 🟢 Green

### Security
- **Critical Alerts = 0**: 🟢 Green (any >0 = 🔴 Red)
- **Compliance Score ≥95%**: 🟢 Green
- **Compliance Score 90-95%**: 🟡 Yellow
- **Compliance Score <90%**: 🔴 Red

---

## Deployment Status Colors

```
✓ Success    : Green badge
✗ Failed     : Red badge
⟳ In Progress: Blue badge, spinning icon
↩ Rolled Back: Yellow badge
```

---

## Incident Severity Badges

```
🔴 CRITICAL : Red border, red background
🟠 HIGH     : Orange border, orange background
🟡 MEDIUM   : Yellow border, yellow background
🔵 LOW      : Blue border, blue background
```

---

## Typography

### Headers
- **Dashboard Title**: `text-3xl font-bold text-gray-900`
- **Section Titles**: `text-xl font-semibold text-gray-800`
- **Subsection**: `text-lg font-medium text-gray-700`

### Metrics
- **Metric Value**: `text-2xl font-bold text-gray-900`
- **Metric Label**: `text-sm font-medium text-gray-600`
- **Subtitle**: `text-xs text-gray-500`

### Content
- **Body Text**: `text-sm text-gray-700`
- **Timestamps**: `text-xs text-gray-500`
- **Badges**: `text-xs font-medium`

---

## Accessibility

### ARIA Labels
- All icons have descriptive labels
- Time range selector has role="combobox"
- Buttons have descriptive text
- Loading states announced

### Keyboard Navigation
- Tab through all interactive elements
- Enter to activate buttons/selects
- Escape to close dropdowns

### Color Contrast
- All text meets WCAG AA standards
- Color not the only indicator (icons + text)

---

## Animation

### Auto-Refresh Indicator
- Spinning icon during data fetch
- Subtle fade-in on data update

### Loading Skeletons
- Pulse animation (`animate-pulse`)
- Smooth transition to content

### Hover States
- Metric cards: subtle shadow increase
- Buttons: background color change
- Navigation: background highlight

---

## Mobile Optimizations

### Touch Targets
- Minimum 44×44px touch targets
- Adequate spacing between elements

### Gestures
- Swipe to open/close mobile menu
- Pull to refresh (future enhancement)

### Layout
- Single column on mobile
- Horizontal scrolling for wide tables
- Collapsible sections

---

## Browser Support

### Fully Supported
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Graceful Degradation
- Older browsers: Basic functionality
- No auto-refresh: Manual refresh only
- Limited CSS grid: Flexbox fallback

---

## Future Enhancements (Phase 5.2+)

### Planned Features
- [ ] Dark mode toggle
- [ ] Customizable dashboard layouts
- [ ] CSV/PDF export buttons
- [ ] Chart visualizations (recharts)
- [ ] Drill-down modals
- [ ] Comparison view (vs. previous period)
- [ ] Alert threshold configuration
- [ ] Favorite metrics pinning
- [ ] Email report scheduling

---

## Design System Integration

All components use SecureBase design system:
- **Tailwind CSS 4.1.18** for styling
- **Lucide React** for icons
- **Custom color palette** matching brand
- **Consistent spacing** (4px grid)
- **Reusable components** (MetricCard, DeploymentRow)

---

## Visual Examples

### Empty State
```
┌────────────────────────────────────┐
│                                    │
│           [📊]                     │
│                                    │
│   No deployments found             │
│   Deployments will appear here     │
│                                    │
└────────────────────────────────────┘
```

### Error State
```
┌────────────────────────────────────┐
│  ⚠️ Unable to load metrics         │
│  Showing cached data               │
│  [Retry]                           │
└────────────────────────────────────┘
```

---

**Design Status:** ✅ Complete  
**Implementation:** ✅ Complete  
**Responsive:** ✅ Mobile-optimized  
**Accessible:** ✅ WCAG AA compliant
