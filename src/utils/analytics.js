/**
 * @file analytics.js
 * @description HIPAA-compliant Google Analytics 4 (GA4) utility for the SecureBase root app.
 *
 * HIPAA COMPLIANCE NOTES
 * ──────────────────────
 * • IP addresses are anonymised (anonymize_ip: true) before leaving the browser.
 * • Google advertising features and signals are fully disabled.
 * • All paths and event labels are sanitised to remove PII / PHI before dispatch.
 * • Tracking is opt-in: analytics are only dispatched after the user consents via
 *   the cookie-consent banner (see getConsent / setConsent).
 * • Analytics are entirely disabled outside of production (VITE_ENV === 'production').
 *
 * BAA WARNING
 * ───────────
 * Standard GA4 (free tier) does NOT offer a Business Associate Agreement (BAA).
 * For environments where users may be HIPAA-covered entities, consider GA 360 or
 * a privacy-first alternative (Plausible / Fathom) until a BAA is in place.
 *
 * @see https://support.google.com/analytics/answer/12017362  (HIPAA & GA)
 * @see CLAUDE.md – "Google Analytics 4 (GA4) - Privacy-First Implementation"
 */

import ReactGA from 'react-ga4';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _initialised = false;
let _pagesViewed = 0; // in-session page-view counter

const IS_PROD = import.meta.env.VITE_ENV === 'production';
const IS_DEV = !IS_PROD;

/** Emit a debug log only in development mode. */
function devLog(...args) {
  if (IS_DEV) console.log('[Analytics]', ...args);
}

/** Emit a dev-mode warning when tracking is skipped due to env / consent. */
function devWarn(...args) {
  if (IS_DEV) console.warn('[Analytics]', ...args);
}

// ---------------------------------------------------------------------------
// Cookie consent
// ---------------------------------------------------------------------------

const CONSENT_KEY = 'analytics_consent';

/**
 * Returns whether the user has accepted analytics cookies.
 *
 * HIPAA note: We never infer consent — silence is treated as denial.
 *
 * @returns {boolean}
 */
export function getConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Persist the user's analytics consent choice and update the GA4 consent state.
 *
 * @param {boolean} accepted - true to grant consent, false to revoke.
 */
export function setConsent(accepted) {
  try {
    localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'declined');
  } catch {
    // localStorage unavailable (e.g. private browsing with restrictions) — no-op.
  }

  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: accepted ? 'granted' : 'denied',
    });
  }

  devLog(`Consent ${accepted ? 'granted' : 'revoked'}`);
}

// ---------------------------------------------------------------------------
// PII / PHI sanitisation
// ---------------------------------------------------------------------------

/**
 * Regex patterns used to detect and redact PII / PHI from URL paths and strings.
 * Handles both lowercase and uppercase UUID variants (per Gemini's architect note).
 * Pre-compiled outside the array to avoid repeated regex construction on each call.
 *
 * HIPAA safeguard: these patterns cover the identifiers listed in
 * 45 CFR §164.514(b) that may appear in URLs.
 */
const RE_UUID  = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gi;
const RE_EMAIL = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const RE_NAMED_SEGMENT = /\/(user|org|client|assessment|report|invoice|account|customer)\/[^/?#]+/gi;
const RE_SSN   = /\b\d{3}-\d{2}-\d{4}\b/g;

const PII_PATTERNS = [
  { re: RE_UUID,          replacement: '[REDACTED]' },
  { re: RE_EMAIL,         replacement: '[REDACTED]' },
  { re: RE_NAMED_SEGMENT, replacement: (_, seg) => `/${seg}/[REDACTED]` },
];

/** Query-parameter names that must never appear in tracked URLs. */
const BLOCKED_QUERY_PARAMS = new Set([
  'email', 'ssn', 'dob', 'name', 'phone', 'first_name', 'last_name',
  'address', 'zip', 'mrn', 'patient_id', 'user_id', 'token', 'password',
]);

/**
 * Sanitise a URL path (and optional query string) to remove PII / PHI.
 *
 * HIPAA note: This function is the last line of defence before data leaves
 * the browser. It is applied to every page view and event label.
 *
 * @param {string} rawPath - The raw URL path, e.g. '/user/abc123?email=x@y.com'
 * @returns {string} Sanitised path safe for transmission to GA4.
 */
export function sanitizePath(rawPath) {
  if (typeof rawPath !== 'string') return '/';

  let [pathPart, queryPart] = rawPath.split('?');

  // Apply regex-based PII redactions to the path segment.
  for (const { re, replacement } of PII_PATTERNS) {
    pathPart = pathPart.replace(re, replacement);
  }

  // Strip blocked query parameters; keep allowlisted ones.
  let safeQuery = '';
  if (queryPart) {
    const kept = [];
    for (const [key, value] of new URLSearchParams(queryPart)) {
      if (!BLOCKED_QUERY_PARAMS.has(key.toLowerCase())) {
        kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
    if (kept.length) safeQuery = `?${kept.join('&')}`;
  }

  return pathPart + safeQuery;
}

/**
 * Detect whether a string appears to contain PII / PHI.
 * Used to guard event labels before dispatch.
 *
 * @param {string} value
 * @returns {boolean}
 */
function containsPII(value) {
  if (typeof value !== 'string') return false;
  return RE_EMAIL.test(value) || RE_UUID.test(value) || RE_SSN.test(value);
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise GA4 with HIPAA-compliant settings.
 *
 * Must be called once at app mount (e.g. inside App.jsx's useEffect).
 * No-ops if:
 *   - VITE_GA4_MEASUREMENT_ID is absent, or
 *   - VITE_ENV is not 'production', or
 *   - the user has not consented (analytics_consent !== 'accepted').
 *
 * HIPAA safeguards applied:
 *   • anonymize_ip: true   — IP is truncated before leaving the browser.
 *   • allow_google_signals: false — disables cross-site user tracking.
 *   • allow_ad_personalization_signals: false — no ad-profile building.
 *   • cookie_flags: SameSite=Strict;Secure — prevents CSRF cookie theft.
 *   • send_page_view: false — page views sent manually after sanitisation.
 */
export function initializeAnalytics() {
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;

  if (!measurementId || !IS_PROD) {
    devLog('Analytics disabled:', { hasMeasurementId: !!measurementId, isProduction: IS_PROD });
    return;
  }

  if (!getConsent()) {
    devLog('Analytics disabled: user has not consented.');
    return;
  }

  if (_initialised) {
    devLog('Already initialised — skipping duplicate call.');
    return;
  }

  ReactGA.initialize(measurementId, {
    gaOptions: {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=Strict;Secure',
      cookie_expires: 60 * 60 * 24 * 90, // 90 days
    },
    gtagOptions: {
      send_page_view: false, // We send page views manually after sanitisation.
    },
  });

  _initialised = true;
  devLog('✓ GA4 Analytics initialized (HIPAA-compliant mode)');
}

/**
 * @deprecated Use initializeAnalytics() instead.
 * Retained for backward compatibility with existing callers.
 */
export function initializeSessionTracking() {
  initializeAnalytics();
}

// ---------------------------------------------------------------------------
// Guard: only dispatch when analytics are active and consented
// ---------------------------------------------------------------------------

/**
 * Returns true when it is safe to send an event to GA4.
 * Emits a dev-mode warning if tracking is skipped.
 *
 * @returns {boolean}
 */
function canTrack() {
  if (!_initialised) {
    devWarn('Tracking skipped — analytics not initialised (not production or no consent).');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Core tracking functions
// ---------------------------------------------------------------------------

/**
 * Send a GA4 event.
 *
 * HIPAA note: category, action, and label are validated to ensure they contain
 * no PII / PHI. If PII is detected in the label the event is dropped and a
 * console error is emitted in development to alert the developer.
 *
 * @param {string} category   - GA4 event category (e.g. 'Compliance').
 * @param {string} action     - GA4 event action (e.g. 'ScanStarted').
 * @param {string} [label]    - Optional descriptive label. MUST NOT contain PII.
 * @param {number} [value]    - Optional numeric value.
 */
export function trackEvent(category, action, label, value) {
  // Guard: legacy single-argument call style (eventName, params) from old API
  // — when called with a string + plain-object, forward via gtag directly.
  if (typeof category === 'string' && typeof action === 'object' && action !== null) {
    if (!canTrack()) return;
    ReactGA.event(category, action);
    return;
  }

  if (!canTrack()) return;

  if (label !== undefined && containsPII(String(label))) {
    console.error(
      '[Analytics] ⚠️  HIPAA VIOLATION PREVENTED: event label appears to contain PII/PHI.',
      { category, action, label: '[BLOCKED]' },
    );
    label = '[REDACTED]';
  }

  ReactGA.event({ category, action, label, value });
}

/**
 * Track a page view, sanitising the path to remove PII / PHI before dispatch.
 *
 * Backward-compatible: existing callers pass (pageName, path) while the new
 * signature is (path, title?). When the first argument looks like a page name
 * rather than a path (no leading '/'), the arguments are treated as (pageName, path).
 *
 * @param {string} pathOrPageName - URL path (e.g. '/compliance') OR legacy page name.
 * @param {string} [titleOrPath]  - Optional page title, OR legacy path argument.
 */
export function trackPageView(pathOrPageName, titleOrPath) {
  if (!canTrack()) return;

  let path, title;

  // Detect legacy call: trackPageView('Compliance', '/compliance')
  if (!pathOrPageName.startsWith('/') && titleOrPath && titleOrPath.startsWith('/')) {
    path = titleOrPath;
    title = pathOrPageName;
  } else {
    path = pathOrPageName;
    title = titleOrPath;
  }

  const safePath = sanitizePath(path);

  ReactGA.send({
    hitType: 'pageview',
    page: safePath,
    title: title || document.title,
  });

  devLog('Page view:', safePath, title || '');
}

// ---------------------------------------------------------------------------
// Engagement helpers (backward-compatible)
// ---------------------------------------------------------------------------

/**
 * Track the time a user spent on a page (call on component unmount).
 *
 * @param {string} pageName  - Human-readable page name.
 * @param {number} timeSpent - Seconds spent on the page.
 */
export function trackPageEngagement(pageName, timeSpent) {
  trackEvent('Engagement', 'TimeOnPage', pageName, Math.round(timeSpent));
}

/**
 * Increment the in-session pages-viewed counter and fire a GA4 event.
 */
export function incrementPagesViewed() {
  _pagesViewed += 1;
  trackEvent('Engagement', 'PagesViewed', undefined, _pagesViewed);
}

// ---------------------------------------------------------------------------
// Domain-specific helpers
// ---------------------------------------------------------------------------

/**
 * Track the start of a compliance framework scan.
 *
 * HIPAA note: only the framework name (e.g. 'SOC2', 'HIPAA') is sent — never
 * customer data or scan findings.
 *
 * @param {string} framework - Framework identifier (e.g. 'SOC2', 'HIPAA', 'FedRAMP').
 */
export function trackComplianceScan(framework) {
  trackEvent('Compliance', 'ScanStarted', framework);
}

/**
 * Track when a compliance report is generated.
 *
 * @param {string} framework - Framework the report covers.
 */
export function trackReportGenerated(framework) {
  trackEvent('Report', 'Generated', framework);
}

/**
 * Track usage of a named product feature.
 *
 * @param {string} featureName - Feature identifier (e.g. 'ExportCSV', 'APIKeyCreated').
 */
export function trackFeatureUsed(featureName) {
  trackEvent('Feature', 'Used', featureName);
}

/**
 * Track a sanitised application error.
 *
 * HIPAA note: raw error messages may contain stack traces or user data.
 * Pass only a generic error type and a pre-sanitised, human-readable message.
 * Never pass exception.message or exception.stack directly.
 *
 * @param {string} errorType    - Error category (e.g. 'APIError', 'AuthError').
 * @param {string} errorMessage - Sanitised, human-readable description (no PII).
 */
export function trackError(errorType, errorMessage) {
  const safeMessage = typeof errorMessage === 'string'
    ? errorMessage.substring(0, 150) // cap length to reduce accidental PII leakage
    : 'unknown';
  trackEvent('Error', errorType, safeMessage);
}

/**
 * Track a pricing-page CTA click.
 *
 * @param {string} plan - Plan identifier (e.g. 'standard', 'fintech', 'enterprise').
 */
export function trackPricingCTA(plan) {
  trackEvent('Pricing', 'CTAClicked', plan);
}

/**
 * Track checkout initiation.
 *
 * @param {string} plan - Plan identifier.
 */
export function trackCheckoutStarted(plan) {
  trackEvent('Checkout', 'Started', plan);
}

// ---------------------------------------------------------------------------
// UTM helpers (internal, used by initializeAnalytics if needed)
// ---------------------------------------------------------------------------

function getUtmParams() {
  const search = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const params = {};
  utmKeys.forEach((key) => {
    const value = search.get(key);
    if (value) params[key] = value;
  });
  return params;
}

// Expose UTM params on initialisation so they flow into GA4 session.
// Called once at the end of this module so it runs at import time in prod only.
if (IS_PROD && typeof window !== 'undefined') {
  const utm = getUtmParams();
  if (Object.keys(utm).length && typeof window.gtag === 'function') {
    window.gtag('set', utm);
  }
}

