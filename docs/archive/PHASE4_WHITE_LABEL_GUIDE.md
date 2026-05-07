# Phase 4: White-Label & Branding Guide

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Audience:** Administrators, Marketing Teams  

---

## Overview

SecureBase Phase 4 enables complete white-label customization, allowing you to deliver the platform under your own brand. This guide covers setup, customization, and deployment of branded experiences.

### What You Can Customize

- ✅ **Custom domains** (brand.example.com, portal.yourcompany.com)
- ✅ **Logo & branding** (header, favicon, login page)
- ✅ **Color scheme** (primary, secondary, accent colors)
- ✅ **Typography** (custom fonts, font sizes)
- ✅ **Email templates** (invoices, notifications, reports)
- ✅ **PDF exports** (branded invoices, reports)
- ✅ **Support portal** (custom help center theme)
- ✅ **Login page** (custom background, messaging)

### Time to Deploy
- **Basic branding:** 30 minutes
- **Custom domain:** 1 hour
- **Full customization:** 2-3 hours

---

## Quick Start

### Step 1: Access Branding Settings

1. Log in to SecureBase portal as Admin
2. Navigate to **Settings → Branding**
3. You'll see the Branding Dashboard

### Step 2: Upload Your Logo

```javascript
// Supported formats: PNG, SVG, JPEG
// Recommended size: 200x60px (transparent PNG)
// Max file size: 2MB

1. Click "Upload Logo"
2. Select your logo file
3. Preview shows on light/dark backgrounds
4. Click "Save Changes"
```

**Result:** Logo appears in portal header, emails, and PDF exports within 5 minutes.

### Step 3: Configure Colors

```javascript
Primary Color:    #1E40AF  // Main brand color
Secondary Color:  #64748B  // Supporting elements
Accent Color:     #10B981  // Call-to-action buttons
Success Color:    #22C55E  // Success messages
Error Color:      #EF4444  // Error states
```

**Preview:** Real-time preview shows all components with your colors.

### Step 4: Save & Deploy

```bash
# Changes deploy automatically to:
- Portal UI (< 1 minute)
- Email templates (< 5 minutes)
- PDF exports (< 5 minutes)
- API documentation (< 10 minutes)
```

---

## Custom Domain Setup

### Prerequisites

- Admin access to your DNS provider
- SSL certificate (or use AWS Certificate Manager)
- Estimated time: 60 minutes

### Step 1: Request Custom Domain

1. Go to **Settings → Branding → Custom Domain**
2. Enter your desired domain: `portal.yourcompany.com`
3. Click "Request Domain Setup"

SecureBase will:
- Create CloudFront distribution
- Generate SSL certificate (via ACM)
- Provide DNS records to configure

### Step 2: Configure DNS

**You'll receive DNS records to add:**

```dns
Type: CNAME
Name: portal.yourcompany.com
Value: d1234567890abc.cloudfront.net
TTL: 300

Type: CNAME (for SSL validation)
Name: _abc123.portal.yourcompany.com
Value: _xyz789.acm-validations.aws
TTL: 300
```

**Add these to your DNS provider:**
- Route 53: See [AWS Guide](https://docs.aws.amazon.com/Route53/)
- Cloudflare: Dashboard → DNS → Add Record
- GoDaddy: DNS Management → Add CNAME
- Namecheap: Domain List → Manage → Advanced DNS

### Step 3: Validation & Activation

```bash
# SecureBase monitors DNS propagation
# You'll receive email updates:

1. DNS records detected (5-15 min)
2. SSL certificate issued (15-30 min)
3. Domain activated (30-60 min total)

# Check status anytime at Settings → Branding → Custom Domain
```

### Step 4: Test Your Domain

```bash
# Once activated:
https://portal.yourcompany.com

# Should show:
- ✅ Your SecureBase portal
- ✅ Your logo and branding
- ✅ Valid SSL certificate (green padlock)
```

---

## Advanced Customization

### Custom Fonts

**Option 1: Google Fonts**
```javascript
// Settings → Branding → Typography
Font Family: "Inter"  // Google Fonts
// Auto-loaded from Google CDN
```

**Option 2: Custom Fonts**
```javascript
// Upload TTF/WOFF files
1. Settings → Branding → Upload Font
2. Select font files (Regular, Bold, Italic)
3. Font becomes available in Typography settings
```

### Email Template Customization

**Available Templates:**
- Welcome email
- Password reset
- Invoice notifications
- Support ticket updates
- Report delivery
- Team invitations

**Customization Options:**
```html
<!-- Each template supports: -->
- Custom header HTML
- Footer text & links
- From name (your company)
- Reply-to address
- Color scheme
- Logo placement
```

**Edit Templates:**
```bash
Settings → Branding → Email Templates
→ Select template
→ Edit HTML/text
→ Preview
→ Save & Test
```

### PDF Export Branding

**Customizable Elements:**
- Header logo
- Footer text
- Color scheme
- Font family
- Page watermark (optional)
- Company information block

**Example: Branded Invoice**
```python
# Auto-generated with your branding:
┌────────────────────────────────┐
│ [Your Logo]                    │
│ Your Company Name              │
│ Invoice #INV-2024-001          │
├────────────────────────────────┤
│ Billing details...             │
│ [Your brand colors]            │
└────────────────────────────────┘
```

### Login Page Customization

**Options:**
```javascript
Background Image: Upload custom image (1920x1080)
Background Color: Solid color or gradient
Welcome Message: "Welcome to [Your Company] Portal"
Help Text: Custom login instructions
Logo: Displayed above login form
```

**Preview:** Live preview before saving changes.

---

## White-Label Configuration File

### Export/Import Branding

**Export your configuration:**
```bash
# Download JSON configuration
Settings → Branding → Export Configuration
# File: branding-config.json
```

**Configuration Format:**
```json
{
  "company_name": "Your Company",
  "logo_url": "https://s3.../logo.png",
  "favicon_url": "https://s3.../favicon.ico",
  "colors": {
    "primary": "#1E40AF",
    "secondary": "#64748B",
    "accent": "#10B981"
  },
  "fonts": {
    "heading": "Inter",
    "body": "Inter"
  },
  "custom_domain": "portal.yourcompany.com",
  "email": {
    "from_name": "Your Company",
    "reply_to": "support@yourcompany.com",
    "footer": "© 2026 Your Company"
  }
}
```

**Import to another environment:**
```bash
# Useful for dev → staging → production
Settings → Branding → Import Configuration
→ Upload branding-config.json
→ Review changes
→ Apply
```

---

## Multi-Tenant Branding

**For Partners/Resellers:**

If you manage multiple customers, each can have unique branding:

```bash
Customer A: portal-a.yourcompany.com
Customer B: portal-b.yourcompany.com
Customer C: portal-c.yourcompany.com

# Each with distinct:
- Logo
- Colors
- Domain
- Email templates
```

**Setup:**
```bash
1. Admin panel → Customers
2. Select customer
3. Click "Manage Branding"
4. Configure as above
5. Each customer sees ONLY their branding
```

---

## SEO & Metadata

**Customize for search engines:**

```html
<!-- Settings → Branding → SEO -->
Page Title: "Your Company - Compliance Portal"
Meta Description: "Manage AWS compliance with [Your Company]"
Open Graph Image: Upload social share image
Favicon: Upload .ico file

<!-- Robots.txt control -->
Allow/Disallow search engine indexing
```

---

## Mobile App Branding (iOS/Android)

**White-label mobile apps via Capacitor:**

```bash
# Contact SecureBase to enable mobile branding
# Provide:
- App name: "Your Company Portal"
- Bundle ID: com.yourcompany.portal
- App icons (1024x1024)
- Splash screen
- App Store listing info

# We generate branded mobile apps
# Timeline: 2-3 weeks
```

---

## Troubleshooting

### Issue: Domain not working after 60 minutes

**Solution:**
```bash
1. Check DNS propagation: https://dnschecker.org
2. Verify CNAME records are correct
3. Check TTL (should be 300-3600 seconds)
4. Contact SecureBase support if still not working
```

### Issue: Logo appears pixelated

**Solution:**
```bash
1. Upload higher resolution (recommend 400x120px minimum)
2. Use PNG with transparency
3. Or use SVG for perfect scaling
```

### Issue: Colors not applying to all pages

**Solution:**
```bash
1. Clear browser cache (Ctrl+Shift+R)
2. Wait 5 minutes for CDN propagation
3. Check if color values are valid hex codes
```

### Issue: Email templates not updating

**Solution:**
```bash
1. Check email preview (Settings → Branding → Email Templates)
2. Send test email to yourself
3. Clear email template cache (contact support)
```

---

## Best Practices

### Brand Consistency
- ✅ Use same colors across all customizations
- ✅ Use same logo files (don't mix different versions)
- ✅ Match fonts to your main website
- ✅ Keep email templates professional

### Performance
- ✅ Optimize logo files (compress PNGs, use SVG)
- ✅ Use web-safe fonts or Google Fonts
- ✅ Keep custom CSS minimal
- ✅ Test on mobile devices

### Security
- ✅ Use HTTPS for custom domains
- ✅ Don't expose internal branding URLs
- ✅ Use AWS Certificate Manager for SSL
- ✅ Verify domain ownership before setup

### Accessibility
- ✅ Ensure color contrast meets WCAG AA (4.5:1)
- ✅ Test with screen readers
- ✅ Provide alt text for logos
- ✅ Use readable font sizes (14px minimum)

---

## Examples

### Example 1: Financial Services Firm

```javascript
Company: Acme Finance
Domain: portal.acmefinance.com
Colors:
  Primary: #003366 (Navy)
  Secondary: #C0C0C0 (Silver)
  Accent: #FFD700 (Gold)
Fonts: "Merriweather" (serif, professional)
Logo: Shield with "AF" monogram
```

**Result:** Professional, trustworthy appearance for financial clients.

### Example 2: Healthcare Provider

```javascript
Company: HealthCare Plus
Domain: secure.healthcareplus.com
Colors:
  Primary: #2E7D32 (Medical Green)
  Secondary: #1976D2 (Trust Blue)
  Accent: #F57C00 (Energy Orange)
Fonts: "Roboto" (clean, modern)
Logo: Heart + Plus icon
```

**Result:** Clean, caring, HIPAA-compliant interface.

### Example 3: Government Agency

```javascript
Company: State Compliance Bureau
Domain: compliance.state.gov
Colors:
  Primary: #1A365D (Government Blue)
  Secondary: #4A5568 (Neutral Gray)
  Accent: #2F855A (Official Green)
Fonts: "Public Sans" (accessible, official)
Logo: State seal
```

**Result:** Official, accessible, .gov compliant.

---

## Cost Considerations

### Custom Domain
- **SSL Certificate:** Free (AWS Certificate Manager)
- **CloudFront:** ~$10-20/month (depends on traffic)
- **DNS:** Your existing provider (typically < $5/month)

### Branding Assets
- **Logo/Asset Storage:** Free (included in S3)
- **CDN Delivery:** Included in CloudFront costs above

### Mobile Apps (Optional)
- **Development:** $5,000 one-time
- **App Store fees:** $99/year (Apple), $25 one-time (Google)

---

## Support & Resources

### Getting Help
- **Branding Questions:** branding@securebase.com
- **DNS Issues:** dns-support@securebase.com
- **Custom Development:** partners@securebase.com

### Resources
- **Color Picker:** https://coolors.co
- **Logo Design:** https://www.canva.com
- **Font Pairing:** https://fontpair.co
- **DNS Checker:** https://dnschecker.org

---

## Checklist

Before launching your white-label portal:

- [ ] Logo uploaded (PNG/SVG, optimized)
- [ ] Colors configured (primary, secondary, accent)
- [ ] Fonts selected (readable, accessible)
- [ ] Custom domain configured (DNS records added)
- [ ] SSL certificate validated (green padlock)
- [ ] Email templates customized (preview tested)
- [ ] PDF exports reviewed (invoice, reports)
- [ ] Mobile responsive (tested on phone/tablet)
- [ ] Accessibility checked (WCAG AA compliant)
- [ ] SEO metadata configured (title, description)
- [ ] Brand guidelines documented (for team)
- [ ] Test user onboarding (verify experience)

---

**White-Label Guide Version:** 1.0  
**Last Updated:** January 24, 2026  
**Status:** Production Ready ✅  

**Next:** See [PHASE4_BRANDING_CUSTOMIZATION.md](PHASE4_BRANDING_CUSTOMIZATION.md) for advanced tips.
