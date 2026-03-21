# Securebase CSS Contract

**Status:** Frozen as of 2026-02-06 08:06:57  
**Goal:** Stable, credible UI for security buyers. Optimize for clarity and speed, not novelty.

---

## Architecture (Non-Negotiable)

```
/styles
  ├─ tokens.css        # design tokens only (colors, spacing, fonts)
  ├─ base.css          # reset, typography, global defaults
  ├─ layout.css        # page-level layout primitives
  ├─ components.css    # reusable UI components
  └─ utilities.css     # small, atomic helpers
```

**Rule:** Each layer may depend on layers above it, never below.

---

## Naming Convention

### Components
```css
.sb-Component
.sb-Component__element
.sb-Component--modifier
```

**Examples:**
```css
.sb-EvidenceCard {}
.sb-EvidenceCard__header {}
.sb-EvidenceCard--warning {}
```

### Utilities (single responsibility)
```css
.u-flex
.u-gap-sm
.u-text-muted
```

**Hard rule:** Utilities never reference components. Components may use utilities.

---

## Design Tokens (FROZEN)

Defined in `tokens.css` only:

```css
:root {
  --sb-color-bg: #0b0f14;
  --sb-color-surface: #111827;
  --sb-color-accent: #3b82f6;
  --sb-color-danger: #ef4444;
  --sb-color-success: #10b981;
  --sb-color-warning: #f59e0b;
  --sb-color-text: #f9fafb;
  --sb-color-text-muted: #9ca3af;

  --sb-space-xs: 4px;
  --sb-space-sm: 8px;
  --sb-space-md: 16px;
  --sb-space-lg: 24px;
  --sb-space-xl: 32px;

  --sb-radius-sm: 6px;
  --sb-radius-md: 10px;

  --sb-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --sb-font-mono: "SF Mono", Monaco, monospace;
}
```

**Rule:** No hex colors, spacing values, or radii anywhere else in the codebase.

---

## What CSS Can Express

### ✅ Allowed
- Layout
- Spacing
- Typography
- Visual state (hover, active, warning, success)

### ❌ Forbidden
- Business logic
- Compliance meaning (belongs in copy & data)
- "Clever" interactions requiring explanation

---

## State Styling

### ✅ Allowed
```css
.is-loading
.is-error
.is-success
.is-disabled
.is-active
```

### ❌ Forbidden
```css
.is-soc2
.is-nist
.is-high-risk
```

**Why:** Compliance meaning comes from data labels, not styling.

---

## Responsiveness (Minimalist)

- **Desktop** (default, 1024px+)
- **Mobile** (single breakpoint, <768px)

No tablet-specific tuning. Security buyers demo on laptops.

---

## Inline Styles: BANNED

**Exceptions:**
- Dynamic width/height driven by JS
- Temporary prototype code (must be removed before demo)

**Rule:** If you see inline styles during sales work → delete or refactor immediately.

---

## 🚫 DO NOT TOUCH (Effective Immediately)

From 2026-02-06 forward, the following are **frozen**:

1. ❌ **Color palette** — If it's readable and contrast-safe, it's done
2. ❌ **Font choices** — Unless legal/licensing issue
3. ❌ **Spacing scale** — No "just one more size"
4. ❌ **Border radius** — Stability > playfulness
5. ❌ **Layout density** — Not optimizing for aesthetics, optimizing for trust

---

## ✅ ALLOWED TO CHANGE (Sales-Focused)

These drive belief and trust:

- ✅ Copy and messaging
- ✅ Data ordering
- ✅ Which components appear in demo
- ✅ Evidence clarity
- ✅ Report formatting
- ✅ Narrative flow

---

## Enforcement

- **Before committing CSS:** Ask "Does this make the product more trustworthy to a security buyer?"
- **If the answer is no:** Don't commit it.
- **If you're unsure:** It's avoidance. Move to content, evidence, or demo flow instead.

---

**This contract exists to protect velocity.**  
UI is now a container for belief. Belief comes from evidence, language, authority, and flow—not gradients.
