# Notification System Architecture

## Component Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard.jsx                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Header (Top Right)                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │         NotificationBell Component              │  │  │
│  │  │  ┌──────────┐                                   │  │  │
│  │  │  │ 🔔 Badge │ ← Unread count (3)                │  │  │
│  │  │  └────┬─────┘                                   │  │  │
│  │  │       │ Click                                   │  │  │
│  │  │       ▼                                         │  │  │
│  │  │  ┌─────────────────────────────────────┐       │  │  │
│  │  │  │   Notification Panel (Dropdown)     │       │  │  │
│  │  │  │  ┌──────────────────────────────┐  │       │  │  │
│  │  │  │  │ Header: "Notifications"      │  │       │  │  │
│  │  │  │  │ [Mark all read]  [X]         │  │       │  │  │
│  │  │  │  └──────────────────────────────┘  │       │  │  │
│  │  │  │  ┌──────────────────────────────┐  │       │  │  │
│  │  │  │  │ Filters: All | Security |    │  │       │  │  │
│  │  │  │  │ Billing | System | Compliance│  │       │  │  │
│  │  │  │  └──────────────────────────────┘  │       │  │  │
│  │  │  │  ┌──────────────────────────────┐  │       │  │  │
│  │  │  │  │ Notification List (Scroll)   │  │       │  │  │
│  │  │  │  │                              │  │       │  │  │
│  │  │  │  │ ┌──────────────────────────┐ │  │       │  │  │
│  │  │  │  │ │ [Icon] Title          [👁]│ │  │       │  │  │
│  │  │  │  │ │ Message...               │ │  │       │  │  │
│  │  │  │  │ │ 2 hours ago  View →      │ │  │       │  │  │
│  │  │  │  │ └──────────────────────────┘ │  │       │  │  │
│  │  │  │  │                              │  │       │  │  │
│  │  │  │  │ (More notifications...)      │  │       │  │  │
│  │  │  │  └──────────────────────────────┘  │       │  │  │
│  │  │  └─────────────────────────────────────┘       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         ToastContainer (Top Right Corner)            │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │ 🔴 Critical: Security Alert         [X]     │    │  │
│  │  │ Unusual API activity detected...            │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │ 🟠 Warning: Invoice Due             [X]     │    │  │
│  │  │ Invoice INV-2026-002 is due in 3 days       │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │ 🟠 Warning: API Key Expiring        [X]     │    │  │
│  │  │ Production API Key will expire in 7 days    │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │                   (Max 3 toasts)                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌────────────────────┐
│  mockApiService.js │
│                    │
│  Mock Data:        │
│  ├─ notif_001     │ ◄─── localStorage
│  ├─ notif_002     │      (readNotifications)
│  ├─ notif_003     │
│  ├─ notif_004     │
│  └─ notif_005     │
└──────┬─────────────┘
       │
       │ getNotifications()
       │
       ▼
┌────────────────────┐
│ NotificationBell   │
│                    │
│ State:             │
│ ├─ notifications   │
│ ├─ isOpen          │
│ └─ filter          │
└──────┬─────────────┘
       │
       │ onCriticalAlert()
       │ (critical + warning only)
       │
       ▼
┌────────────────────┐
│  ToastContainer    │
│                    │
│  toasts[] (max 3)  │
└────────────────────┘
```

## User Interaction Flows

### Flow 1: View Notifications
```
User Action          Component State              Visual Feedback
─────────────────────────────────────────────────────────────
1. Page loads    →  NotificationBell loads    →  Badge shows "3"
                    Toasts show (3)           →  3 toasts slide in

2. Click bell    →  isOpen = true             →  Panel slides down

3. View list     →  Display filtered items    →  Unread items highlighted

4. Click filter  →  filter = 'security'       →  Show only security items
```

### Flow 2: Mark as Read
```
User Action          Component State              localStorage
─────────────────────────────────────────────────────────────
1. Click 👁       →  notification.read = true  →  Save notif_001

2. Update UI      →  Badge count: 3 → 2        →  Persisted

3. Refresh page   →  Load from localStorage    →  Still shows read

4. Mark all read  →  All notifications.read    →  Save all IDs
                     Badge disappears
```

### Flow 3: Toast Auto-Dismiss
```
Time             Toast State              Visual
──────────────────────────────────────────────────
0s               Toast appears         →  Slide in from right

5s (warning)     Start fade out        →  Opacity: 1 → 0

10s (critical)   Start fade out        →  Opacity: 1 → 0

+0.3s            Remove from DOM       →  Slide out
```

## Component Hierarchy

```
Dashboard.jsx
└── NotificationBell.jsx
    ├── Bell Icon + Badge
    └── Notification Panel (Dropdown)
        ├── Header
        │   ├── Title
        │   ├── Mark All Button
        │   └── Close Button
        ├── Filter Tabs
        │   ├── All
        │   ├── Security
        │   ├── Billing
        │   ├── System
        │   └── Compliance
        └── Notification List
            └── NotificationItem (×5)
                ├── Icon
                ├── Title
                ├── Message
                ├── Timestamp
                ├── Action Link
                └── Mark Read Button

Dashboard.jsx
└── ToastContainer.jsx
    └── NotificationToast.jsx (×3 max)
        ├── Severity Icon
        ├── Title
        ├── Message
        └── Close Button
```

## Severity Color Matrix

| Severity | Color   | Hex     | Usage                          |
|----------|---------|---------|--------------------------------|
| Critical | Red     | #EF4444 | Security alerts, failures      |
| Warning  | Orange  | #F59E0B | Upcoming deadlines, cautions   |
| Info     | Blue    | #3B82F6 | General information            |
| Success  | Green   | #10B981 | Completed actions, confirmations|

## Icon Mapping

| Type       | Icon         | lucide-react Component |
|------------|--------------|------------------------|
| Security   | Shield       | Shield                 |
| Billing    | Credit Card  | CreditCard             |
| Compliance | Check Circle | CheckCircle            |
| System     | Settings     | Settings               |

## localStorage Schema

```javascript
// Key: 'readNotifications'
// Value: Array of notification IDs
[
  "notif_003",  // Read notifications
  "notif_004"
]

// On page load, these IDs are merged with mock data
// to restore read state
```

## Timing Specifications

| Action              | Duration | Notes                    |
|---------------------|----------|--------------------------|
| Toast (critical)    | 10s      | Auto-dismiss             |
| Toast (other)       | 5s       | Auto-dismiss             |
| Toast fade out      | 0.3s     | Animation                |
| Panel slide down    | 0.2s     | Animation                |
| Badge pulse         | 2s       | Loop (infinite)          |
| Click outside delay | 0ms      | Immediate                |

## Responsive Breakpoints

```css
/* Desktop (default) */
@media (min-width: 641px) {
  .dropdown {
    width: 380px;
    right: 0;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .dropdown {
    width: auto;
    right: 8px;
    left: 8px;
  }
  
  .filterTab {
    font-size: 13px;
    padding: 4px 8px;
  }
}
```

## State Management

```javascript
// NotificationBell Component State
const [notifications, setNotifications] = useState([]);  // All notifications
const [isOpen, setIsOpen] = useState(false);            // Panel visibility
const [filter, setFilter] = useState('all');            // Active filter

// Dashboard Component State  
const [toasts, setToasts] = useState([]);               // Active toasts

// Derived State (computed)
const unreadCount = notifications.filter(n => !n.read).length;
const filteredNotifications = filter === 'all' 
  ? notifications 
  : notifications.filter(n => n.type === filter);
```

## Performance Optimizations

1. **Event Listeners**: Only active when panel is open
2. **Click Outside**: Cleanup on component unmount
3. **Toast Limit**: Max 3 visible (prevents DOM bloat)
4. **CSS Animations**: Use transform/opacity (GPU-accelerated)
5. **LocalStorage**: Batched writes via API calls
6. **Filtering**: Client-side (no API calls)

## Accessibility Features

```jsx
// ARIA Labels
<button aria-label="Notifications (3 unread)">
<button aria-label="Mark as read">
<button aria-label="Close notifications">

// Keyboard Navigation
- Tab: Move between elements
- Enter/Space: Activate buttons
- Escape: Close panel (browser default)

// Screen Reader
- Semantic HTML (button, div, span)
- Heading hierarchy (h3, h4)
- Live regions for toasts
```

## Testing Coverage Map

```
NotificationBell.test.jsx (10 tests)
├── Rendering
│   ├── Bell icon
│   └── Unread badge
├── Interactions
│   ├── Open/close panel
│   ├── Filter notifications
│   ├── Mark as read
│   └── Mark all as read
├── Integration
│   ├── Toast triggers (critical)
│   └── Toast triggers (warning)
└── Accessibility
    └── Click outside to close

NotificationToast.test.jsx (9 tests)
├── Rendering
│   └── Toast display
├── Timing
│   ├── 10s critical
│   └── 5s other
├── Interactions
│   └── Manual close
├── Styling
│   ├── Critical severity
│   └── Warning severity
└── Container
    ├── Render
    ├── Max 3 limit
    └── onRemove callback
```

This architecture ensures a robust, accessible, and performant notification system for SecureBase customers.
