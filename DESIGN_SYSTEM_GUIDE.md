# SecureBase Design System Quick Reference

## CSS Custom Properties Usage

### Colors

#### Primary (Navy Blue)
```css
color: var(--color-primary-600);      /* Main brand color */
background: var(--color-primary-50);   /* Light background */
border-color: var(--color-primary-200); /* Subtle border */
```

#### Status Colors
```css
/* Success */
color: var(--color-success-600);
background: var(--color-success-50);

/* Warning */
color: var(--color-warning-600);
background: var(--color-warning-50);

/* Error */
color: var(--color-error-600);
background: var(--color-error-50);
```

### Typography
```css
font-family: var(--font-family-base);
font-size: var(--font-size-base);      /* 16px */
font-size: var(--font-size-2xl);       /* 24px */
font-weight: var(--font-weight-semibold); /* 600 */
line-height: var(--line-height-normal);   /* 1.5 */
```

### Spacing
```css
padding: var(--spacing-4);    /* 16px */
margin: var(--spacing-6);     /* 24px */
gap: var(--spacing-3);        /* 12px */
```

### Visual Effects
```css
border-radius: var(--radius-base);     /* 8px */
box-shadow: var(--shadow-md);          /* Subtle elevation */
transition: all var(--transition-base); /* 200ms ease-in-out */
```

## CSS Modules Pattern

### Component Structure
```
ComponentName.jsx          - React component
ComponentName.module.css   - Scoped styles
```

### Usage Example
```jsx
// ComponentName.jsx
import styles from './ComponentName.module.css';

export const ComponentName = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Title</h1>
      <button className={styles.primaryButton}>
        Click Me
      </button>
    </div>
  );
};
```

```css
/* ComponentName.module.css */
.container {
  padding: var(--spacing-6);
  background: var(--bg-primary);
}

.title {
  font-size: var(--font-size-2xl);
  color: var(--text-primary);
}

.primaryButton {
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--color-primary-600);
  color: var(--text-inverse);
  border-radius: var(--radius-base);
  transition: background var(--transition-base);
}

.primaryButton:hover {
  background: var(--color-primary-700);
}
```

### Combining Classes
```jsx
// Multiple classes
<div className={`${styles.card} ${styles.active}`}>

// Conditional classes
<div className={`${styles.badge} ${
  status === 'success' ? styles.success : styles.error
}`}>
```

## Common Patterns

### Card Component
```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-base);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-base);
}
```

### Button Component
```css
.button {
  padding: var(--spacing-2) var(--spacing-4);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
  cursor: pointer;
}

.buttonPrimary {
  background: var(--color-primary-600);
  color: var(--text-inverse);
}

.buttonPrimary:hover {
  background: var(--color-primary-700);
}
```

### Status Badge
```css
.badge {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.badgeSuccess {
  background: var(--color-success-100);
  color: var(--color-success-800);
}

.badgeWarning {
  background: var(--color-warning-100);
  color: var(--color-warning-800);
}
```

### Progress Bar
```css
.progressBar {
  width: 100%;
  height: 8px;
  background: var(--color-neutral-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-success-600);
  transition: width var(--transition-base);
}
```

### Loading Spinner
```css
.spinner {
  width: 48px;
  height: 48px;
  border: 2px solid var(--border-light);
  border-top-color: var(--color-primary-600);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Responsive Design

### Breakpoints
```css
/* Mobile-first approach */

/* Default: Mobile (< 640px) */
.grid {
  grid-template-columns: 1fr;
}

/* Tablet (≥ 640px) */
@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (≥ 768px) */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## Accessibility

### Focus States
```css
/* Already handled in global.css */
*:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

### Color Contrast
All color combinations in the design system meet WCAG AA standards:
- Primary text on white: ✓
- Secondary text on white: ✓
- Status colors on light backgrounds: ✓

### Screen Reader Only
```css
/* Use the .sr-only utility class from global.css */
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Migration Checklist

Converting a component from Tailwind to CSS Modules:

1. ✅ Create `ComponentName.module.css`
2. ✅ Import styles: `import styles from './ComponentName.module.css'`
3. ✅ Replace Tailwind classes with CSS Module classes
4. ✅ Use CSS custom properties for colors, spacing, etc.
5. ✅ Add responsive breakpoints as needed
6. ✅ Test on mobile, tablet, and desktop
7. ✅ Verify accessibility (focus states, contrast)
8. ✅ Remove unused Tailwind classes

## Example: Compliance Component

See `phase3a-portal/src/components/Compliance.module.css` for a complete example with:
- 91 CSS classes
- Responsive grid layouts
- Status-based color coding
- Hover states
- Expandable sections
- Loading states
- Empty states
- Professional card designs
