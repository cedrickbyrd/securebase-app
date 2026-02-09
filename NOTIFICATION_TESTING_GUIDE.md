# Visual Testing Guide - Notification System

## Manual Testing Checklist

### 1. Bell Icon & Badge
- [ ] Bell icon appears in Dashboard header (top right)
- [ ] Unread count badge displays "3" (notif_001, notif_002, notif_005 are unread)
- [ ] Badge is red circle with white text
- [ ] Badge has subtle pulse animation
- [ ] Hover effect on bell button (light gray background)

### 2. Notification Panel
#### Opening/Closing
- [ ] Click bell opens dropdown panel
- [ ] Panel appears below bell, right-aligned
- [ ] Panel width is ~380px
- [ ] Panel has white background, rounded corners, shadow
- [ ] Click bell again closes panel
- [ ] Click outside panel closes it
- [ ] Click X button closes panel

#### Header
- [ ] "Notifications" title on left
- [ ] "Mark all as read" button on right (only when unread > 0)
- [ ] X close button on far right

#### Filter Tabs
- [ ] Five tabs: All, Security, Billing, System, Compliance
- [ ] "All" tab active by default (blue background)
- [ ] Clicking tab filters notifications
- [ ] Active tab has blue background, white text
- [ ] Inactive tabs have gray text

#### Notification List
- [ ] Scrollable if content exceeds max-height (500px)
- [ ] Each notification shows:
  - Type-specific icon (colored circle)
  - Title (bold)
  - Message (2 lines max, ellipsis if longer)
  - Relative timestamp ("X days ago")
  - "View Details →" link (if actionUrl exists)
- [ ] Unread notifications have light blue background
- [ ] Read notifications have white background
- [ ] Colored left border based on severity
- [ ] Hover effect (light gray background)

### 3. Notification Icons
- [ ] Security: Shield icon (blue circle)
- [ ] Billing: CreditCard icon (green circle)
- [ ] System: Settings icon (gray circle)
- [ ] Compliance: CheckCircle icon (purple circle)

### 4. Severity Colors (Left Border)
- [ ] Critical: Red (#EF4444)
- [ ] Warning: Orange (#F59E0B)
- [ ] Info: Blue (#3B82F6)
- [ ] Success: Green (#10B981)

### 5. Mark as Read
#### Individual
- [ ] Unread notifications show eye icon button
- [ ] Clicking eye marks notification as read
- [ ] Notification background changes from blue to white
- [ ] Eye button disappears
- [ ] Unread count badge decreases
- [ ] Read state persists on page refresh

#### Mark All
- [ ] "Mark all as read" button visible when unread > 0
- [ ] Clicking marks all notifications as read
- [ ] All blue backgrounds turn white
- [ ] Badge disappears
- [ ] Button disappears after clicking

### 6. Filtering
- [ ] Click "Security" - shows notif_001, notif_005
- [ ] Click "Billing" - shows notif_002
- [ ] Click "Compliance" - shows notif_003
- [ ] Click "System" - shows notif_004
- [ ] Click "All" - shows all 5 notifications
- [ ] Empty state shows bell icon and "No notifications" text

### 7. Toast Notifications
#### On Page Load
- [ ] Toast appears for notif_001 (critical, security)
- [ ] Toast appears for notif_002 (warning, billing)
- [ ] Toast appears for notif_005 (warning, security)
- [ ] Toasts stack vertically (max 3 visible)
- [ ] Toasts appear in top-right corner

#### Toast Appearance
- [ ] White background with shadow
- [ ] Colored left border (severity-specific)
- [ ] Icon in colored circle (severity-specific)
- [ ] Title (bold)
- [ ] Message
- [ ] X close button
- [ ] Slide-in animation from right

#### Toast Colors
- [ ] Critical: Red border, red icon background, AlertCircle icon
- [ ] Warning: Orange border, yellow icon background, AlertTriangle icon
- [ ] Info: Blue border, blue icon background, Info icon
- [ ] Success: Green border, green icon background, CheckCircle icon

#### Toast Auto-Dismiss
- [ ] Critical toast auto-dismisses after 10 seconds
- [ ] Warning toast auto-dismisses after 5 seconds
- [ ] Toast fades out before disappearing
- [ ] Manual close button works instantly

### 8. localStorage Persistence
- [ ] Mark some notifications as read
- [ ] Refresh page
- [ ] Previously read notifications still marked as read
- [ ] Unread count persists
- [ ] Open browser DevTools > Application > Local Storage
- [ ] Verify "readNotifications" key exists with array of IDs

### 9. Responsive Design (Mobile < 640px)
- [ ] Panel becomes full-width minus 8px margins
- [ ] Filter tabs scroll horizontally
- [ ] Font sizes reduced slightly
- [ ] Padding reduced
- [ ] Still functional on small screens

### 10. Accessibility
#### Keyboard Navigation
- [ ] Tab to bell button
- [ ] Enter/Space opens panel
- [ ] Tab through filter buttons
- [ ] Tab through notifications
- [ ] Tab to mark as read buttons
- [ ] Tab to close button
- [ ] Escape closes panel (browser default)

#### Screen Reader
- [ ] Bell button announces "Notifications (X unread)"
- [ ] Mark as read button announces "Mark as read"
- [ ] Close button announces "Close notifications"
- [ ] Toast close announces "Close notification"

### 11. Click Actions
- [ ] Clicking notification marks it as read
- [ ] Clicking notification with actionUrl navigates to URL
- [ ] Clicking "View Details →" link navigates
- [ ] Notification click closes panel after navigation

### 12. Edge Cases
- [ ] All notifications read - no badge, no "mark all" button
- [ ] No notifications - empty state in panel
- [ ] Very long notification message - truncates with ellipsis
- [ ] Notification without actionUrl - no action link shown
- [ ] Count > 99 - badge shows "99+"

## Test Data Summary

### Notifications (5 total, 3 unread)
1. **notif_001** - Security Alert (critical, unread) ⚠️ Toast
2. **notif_002** - Invoice Due (warning, unread) ⚠️ Toast
3. **notif_003** - Compliance Assessment (info, read)
4. **notif_004** - Backup Completed (success, read)
5. **notif_005** - API Key Expiring (warning, unread) ⚠️ Toast

### Expected Initial State
- Unread count badge: **3**
- Toasts on load: **3** (notif_001, notif_002, notif_005)
- Read notifications: 2 (notif_003, notif_004)

## Screenshots to Capture

1. **Dashboard with notification bell** (unread badge visible)
2. **Notification panel open** (all notifications)
3. **Security filter** (filtered view)
4. **Unread notification** (blue background, eye button)
5. **Read notification** (white background, no button)
6. **Toast notifications** (3 stacked in top-right)
7. **Critical toast** (red styling)
8. **Warning toast** (orange styling)
9. **Mobile view** (full-width panel)
10. **Empty state** (all filters, no results)

## Browser Testing Matrix

| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|--------|--------|
| Chrome | Latest | ☐ | ☐ | |
| Firefox | Latest | ☐ | | |
| Safari | Latest | ☐ | ☐ | |
| Edge | Latest | ☐ | | |

## Performance Checks

- [ ] Panel opens/closes smoothly (< 100ms)
- [ ] Filtering is instant (< 50ms)
- [ ] No layout shift on page load
- [ ] Toast animations smooth (60fps)
- [ ] No memory leaks (check DevTools)
- [ ] No console errors

## Accessibility Checks

- [ ] WAVE browser extension (0 errors)
- [ ] Lighthouse accessibility score > 95
- [ ] Color contrast ratio > 4.5:1 (WCAG AA)
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader announces all content correctly

## Notes

- Use Chrome DevTools device toolbar for mobile testing
- Use localStorage.clear() to reset read state
- Use React DevTools to inspect component state
- Check Network tab for API calls (should be mock, no network)
