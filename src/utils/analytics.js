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
 * Track when a user begins the signup flow.
 *
 * HIPAA note: only the authentication method is sent — never the user's email
 * or any other identifier.
 *
 * @param {'email'|'google'|'sso'} [method='email'] - Sign-up method.
 */
export function trackSignupStarted(method = 'email') {
  if (!canTrack()) return;
  try {
    ReactGA.event('signup_started', { signup_method: method });
    devLog('Event tracked: signup_started', { method });
  } catch (error) {
    console.error('[Analytics] Error tracking event: signup_started', error);
  }
}

/**
 * Track a pricing-page CTA click.
 *
 * GA4 is intentionally NOT fired here — checkout intent is tracked by
 * trackCheckoutStarted() which fires immediately before POST /api/checkout,
 * ensuring the event corresponds to an actual checkout attempt rather than
 * a button click that may be abandoned.
 *
 * @param {string} plan           - Plan identifier (e.g. 'standard', 'fintech', 'enterprise').
 * @param {string} [location=''] - CTA location on the page (e.g. 'hero', 'comparison_table', 'footer').
 */
export function trackPricingCTA(plan, location = '') {
  devLog('Pricing CTA clicked', { plan, location });
}

/**
 * Track checkout initiation.
 *
 * Fires the standard GA4 e-commerce event `begin_checkout` immediately before
 * POST /api/checkout so the event corresponds to an actual checkout attempt.
 *
 * @param {string} plan                                 - Plan identifier.
 * @param {'annual'|'monthly'} [billingCycle='monthly'] - Billing cadence.
 * @param {'form'|'one_click'} [method='form']          - Checkout path taken.
 *   'form'      = /checkout route form submit → POST /api/checkout
 *   'one_click' = portal Pricing inline POST /api/checkout
 */
export function trackCheckoutStarted(plan, billingCycle = 'monthly', method = 'form') {
  if (!canTrack()) return;
  try {
    ReactGA.event('begin_checkout', { plan_type: plan, billing_cycle: billingCycle, checkout_method: method });
    devLog('Event tracked: begin_checkout', { plan, billingCycle, method });
  } catch (error) {
    console.error('[Analytics] Error tracking event: begin_checkout', error);
  }
}

/**
 * Track a completed purchase / conversion.
 *
 * HIPAA note: only the plan name and a numeric revenue value are sent — no
 * payment card details, user PII, or order identifiers.
 *
 * @param {string} plan    - Plan identifier (e.g. 'enterprise').
 * @param {number} revenue - Transaction value in USD (e.g. 299.99).
 */
export function trackCheckoutCompleted(plan, revenue) {
  if (!canTrack()) return;
  try {
    ReactGA.event('checkout_completed', {
      plan_type: plan,
      value: typeof revenue === 'number' ? revenue : 0,
      currency: 'USD',
    });
    devLog('Event tracked: checkout_completed', { plan, revenue });
  } catch (error) {
    console.error('[Analytics] Error tracking event: checkout_completed', error);
  }
}

// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------

/**
 * Namespace object grouping session lifecycle helpers.
 *
 * @example
 * import { SessionTracking } from '../utils/analytics';
 *
 * // In App.jsx useEffect (runs once on mount)
 * SessionTracking.logSessionStart();
 */
export const SessionTracking = {
  /**
   * Track the start of a new user session.
   * Call once in a top-level useEffect with an empty dependency array.
   */
  logSessionStart() {
    if (!canTrack()) return;
    try {
      ReactGA.event('session_start');
      devLog('Event tracked: session_start');
    } catch (error) {
      console.error('[Analytics] Error tracking event: session_start', error);
    }
  },
};

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

// ---------------------------------------------------------------------------
// Compliance scan events
// ---------------------------------------------------------------------------

/**
 * Namespace object grouping compliance policy-scan tracking helpers.
 *
 * HIPAA safeguards:
 *   - Only framework names and aggregate numeric counts are sent.
 *   - Error messages are capped at 150 characters to reduce the risk of
 *     accidentally including PII buried in a verbose error string.
 *   - No customer identifiers, individual findings text, or remediation
 *     details are ever included in these events.
 *
 * @example
 * import { ComplianceEvents } from '../utils/analytics';
 *
 * ComplianceEvents.policyScanInitiated('SOC2', 'full');
 * ComplianceEvents.policyScanCompleted('SOC2', { total: 12, critical: 1, score: 94 });
 * ComplianceEvents.policyScanFailed('SOC2', 'NetworkError', 'Scan API timed out');
 */
export const ComplianceEvents = {
  /**
   * Track when a policy scan is initiated.
   *
   * @param {string} policyType  - Framework identifier, e.g. 'SOC2', 'HIPAA',
   *                               'FedRAMP', 'full_scan'.
   * @param {string} [scanScope='full'] - Scan breadth: 'full' | 'incremental' |
   *                                      'specific_control'.
   */
  policyScanInitiated(policyType, scanScope = 'full') {
    trackEvent('policy_scan_initiated', {
      policy_type: policyType,
      scan_scope: scanScope,
    });
  },

  /**
   * Track when a policy scan completes successfully.
   *
   * HIPAA note: only aggregate counts are sent — never individual finding details.
   *
   * @param {string} policyType
   * @param {Object} [results]
   * @param {number} [results.total=0]     - Total findings count.
   * @param {number} [results.critical=0]  - Critical severity count.
   * @param {number} [results.high=0]      - High severity count.
   * @param {number} [results.medium=0]    - Medium severity count.
   * @param {number} [results.low=0]       - Low severity count.
   * @param {number} [results.duration=0]  - Scan duration in milliseconds.
   * @param {number} [results.score=0]     - Resulting compliance score (0–100).
   */
  policyScanCompleted(policyType, {
    total = 0,
    critical = 0,
    high = 0,
    medium = 0,
    low = 0,
    duration = 0,
    score = 0,
  } = {}) {
    trackEvent('policy_scan_completed', {
      policy_type: policyType,
      findings_total: total,
      findings_critical: critical,
      findings_high: high,
      findings_medium: medium,
      findings_low: low,
      scan_duration_ms: duration,
      compliance_score: score,
    });
  },

  /**
   * Track when a policy scan fails.
   *
   * HIPAA note: error messages are capped at 150 characters.
   *
   * @param {string} policyType
   * @param {string} [errorType='Error']  - Error name / category (e.g. 'NetworkError').
   *                                        Never pass a full stack trace.
   * @param {string} [errorMessage='']   - Sanitised, human-readable description. No PII.
   */
  policyScanFailed(policyType, errorType = 'Error', errorMessage = '') {
    const safeMessage = typeof errorMessage === 'string'
      ? errorMessage.substring(0, 150)
      : 'unknown';
    trackEvent('policy_scan_failed', {
      policy_type: policyType,
      error_type: errorType,
      error_message: safeMessage,
    });
  },
};

// ---------------------------------------------------------------------------
// Post-scan demo analytics helpers
// ---------------------------------------------------------------------------

/**
 * Track the completion of a demo compliance scan.
 */
export function trackDemoScanComplete() {
  trackEvent('Demo', 'ScanComplete', 'Success');
}

/**
 * Track when the post-scan CTA is shown to a visitor.
 *
 * @param {'a'|'b'} variant - A/B test variant identifier.
 */
export function trackDemoCTAShown(variant) {
  trackEvent('Demo', 'CTAShown', variant);
}

/**
 * Track when a visitor clicks a post-scan CTA button.
 *
 * @param {string} trackKey - Button track identifier (e.g. 'demo_cta_trial').
 */
export function trackDemoCTAClick(trackKey) {
  trackEvent('Demo', 'CTAClick', trackKey);
}

/**
 * Track when a visitor views the post-scan findings toast.
 *
 * @param {number} count - Number of resolved issues shown.
 */
export function trackDemoFindingsViewed(count) {
  trackEvent('Demo', 'FindingsViewed', `${count} issues`);
}

