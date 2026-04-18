/**
 * GA4 Analytics utility
 * Initializes Google Analytics 4 session tracking and captures UTM parameters.
 * Provides per-page and per-feature tracking helpers for the SecureBase portal.
 */

const GA_MEASUREMENT_ID = 'G-EEVD92DCS1';

// In-session page-view counter (resets on hard reload).
let _pagesViewed = 0;

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Send a GA4 event via the gtag function if it is available.
 * @param {string} eventName
 * @param {Object} params
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getUtmParams() {
  const search = new URLSearchParams(window.location.search);
  const utmKeys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ];
  const params = {};
  utmKeys.forEach((key) => {
    const value = search.get(key);
    if (value) params[key] = value;
  });
  return params;
}

// ---------------------------------------------------------------------------
// Session initialisation
// ---------------------------------------------------------------------------

/**
 * Initialize GA4 session tracking.
 * - Configures the GA4 property with the measurement ID.
 * - Forwards any UTM parameters present in the URL to GA4.
 * - Fires a `session_start` event so Realtime reports show active users immediately.
 * - Auto-detects Wave 3 outreach campaigns and fires `wave3_outreach_visit`.
 *
 * Call this once on application mount (e.g. inside a root-level useEffect).
 */
export function initializeSessionTracking() {
  if (typeof window.gtag !== 'function') {
    return;
  }

  const utmParams = getUtmParams();

  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
    ...utmParams,
  });

  trackEvent('session_start', {
    ...utmParams,
  });

  const campaign = utmParams.utm_campaign || '';
  if (campaign.startsWith('wave3_')) {
    trackWave3Outreach(utmParams);
  }
}

// ---------------------------------------------------------------------------
// Page tracking
// ---------------------------------------------------------------------------

/**
 * Track a virtual page view.
 * @param {string} pageName  Human-readable page name (e.g. 'Dashboard')
 * @param {string} path      URL path (e.g. '/dashboard')
 */
export function trackPageView(pageName, path) {
  trackEvent('page_view', {
    page_title: pageName,
    page_location: window.location.href,
    page_path: path,
  });
}

/**
 * Track time a user spent on a page (call on component unmount).
 * @param {string} pageName   Human-readable page name
 * @param {number} timeSpent  Seconds spent on the page
 */
export function trackPageEngagement(pageName, timeSpent) {
  trackEvent('page_engagement', {
    page_name: pageName,
    time_spent_seconds: timeSpent,
  });
}

/**
 * Increment the in-session pages-viewed counter and fire an event.
 * Useful for measuring depth-of-engagement across a demo session.
 */
export function incrementPagesViewed() {
  _pagesViewed += 1;
  trackEvent('pages_viewed', { pages_viewed_count: _pagesViewed });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Track a successful demo login.
 */
export function trackDemoLogin() {
  trackEvent('demo_login', {
    method: 'demo_credentials',
  });
}

// ---------------------------------------------------------------------------
// High-value feature events
// ---------------------------------------------------------------------------

/**
 * Track a compliance framework being viewed.
 * @param {string} framework  e.g. 'SOC2', 'HIPAA', 'FedRAMP', 'CIS'
 */
export function trackComplianceView(framework) {
  trackEvent('compliance_view', { framework });
}

/**
 * Track when the Invoices page is viewed (billing / pricing interest signal).
 * Also fires `wave3_high_value_action` for Wave 3 prospects.
 */
export function trackInvoiceView() {
  trackEvent('invoice_view');
  trackWave3HighValueAction('viewed_pricing');
}

/**
 * Track when the API Keys page is viewed (technical evaluation signal).
 * Also fires `wave3_high_value_action` for Wave 3 prospects.
 */
export function trackAPIDocsView() {
  trackEvent('api_docs_view');
  trackWave3HighValueAction('explored_api_docs');
}

/**
 * Track cost-forecasting tool interactions.
 * @param {string} action  e.g. 'view', 'adjust_slider', 'calculate'
 */
export function trackCostForecastingInteraction(action) {
  trackEvent('cost_forecasting_interaction', { action });
}

/**
 * Track SRE Dashboard views (technical operations interest signal).
 */
export function trackSREDashboardView() {
  trackEvent('sre_dashboard_view');
}

/**
 * Track which customer sample card a prospect clicks on.
 * @param {string} customerType  e.g. 'Healthcare', 'FinTech', 'Government'
 */
export function trackCustomerSampleView(customerType) {
  trackEvent('customer_sample_view', { customer_type: customerType });
}

// ---------------------------------------------------------------------------
// Wave 3 outreach tracking
// ---------------------------------------------------------------------------

/**
 * Sanitize a UTM parameter value to prevent accidental PII leakage through
 * manipulated campaign URLs.  Keeps only alphanumeric characters, hyphens,
 * underscores, and dots; truncates to 100 characters.
 * @param {string} value
 * @returns {string}
 */
function sanitizeUtmValue(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9\-_.]/g, '').slice(0, 100);
}

/**
 * Persistent Wave 3 session state (stored in sessionStorage so it survives
 * in-app navigation but resets on new browser sessions).
 */
function getWave3Session() {
  try {
    const raw = sessionStorage.getItem('wave3_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the Wave 3 target company for the current session (e.g. "column",
 * "mercury", "lithic"), or `null` when the visitor did not arrive via a
 * Wave 3 campaign.  Safe to call from UI components.
 *
 * @returns {string|null}
 */
export function getWave3Target() {
  const session = getWave3Session();
  return session ? session.target : null;
}

function setWave3Session(data) {
  try {
    sessionStorage.setItem('wave3_session', JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — degrade gracefully
  }
}

/**
 * Fire the `wave3_outreach_visit` event when a user arrives from a Wave 3
 * campaign and persist session context for downstream events.
 *
 * Called automatically by `initializeSessionTracking()` when
 * `utm_campaign` starts with "wave3_".
 *
 * @param {Object} utmParams  Raw UTM parameters from `getUtmParams()`
 */
export function trackWave3Outreach(utmParams) {
  const campaign = sanitizeUtmValue(utmParams.utm_campaign || '');
  const target = campaign.replace(/^wave3_/, '');
  const sessionData = {
    campaign,
    target,
    source: sanitizeUtmValue(utmParams.utm_source || ''),
    content: sanitizeUtmValue(utmParams.utm_content || ''),
    medium: sanitizeUtmValue(utmParams.utm_medium || ''),
  };

  setWave3Session(sessionData);

  trackEvent('wave3_outreach_visit', {
    ...sessionData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire the `wave3_high_value_action` event for a Wave 3 prospect.
 * No-ops silently when the current session is not a Wave 3 session.
 *
 * @param {string} action  e.g. 'viewed_pricing', 'explored_api_docs',
 *                         'downloaded_whitepaper', 'watched_demo_video'
 */
export function trackWave3HighValueAction(action) {
  const session = getWave3Session();
  if (!session) return;

  trackEvent('wave3_high_value_action', {
    campaign: session.campaign,
    target: session.target,
    action,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire the `wave3_outreach_conversion` event when a Wave 3 prospect
 * completes signup.  This function no-ops silently for non-Wave-3 sessions.
 *
 * Call this **after** a successful signup API response (account created),
 * before redirecting the user:
 * ```js
 * import { trackWave3Conversion } from '@/utils/analytics';
 *
 * const handleSignup = async (data) => {
 *   await submitSignup(data);   // account created
 *   trackWave3Conversion();     // attribute conversion
 *   navigate('/dashboard');
 * };
 * ```
 */
export function trackWave3Conversion() {
  const session = getWave3Session();
  if (!session) return;

  trackEvent('wave3_outreach_conversion', {
    campaign: session.campaign,
    target: session.target,
    content: session.content,
    conversion_type: 'signup',
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Signup attribution
// ---------------------------------------------------------------------------

/**
 * Capture UTM parameters and referrer on the /signup page and send a
 * `signup_page_view` event to GA4 for sales attribution.
 *
 * Call this once on component mount inside the signup page/form.
 */
export const trackSignupView = () => {
  const params = new URLSearchParams(window.location.search);
  const utmData = {
    campaign: params.get('utm_campaign') || 'direct',
    source: params.get('utm_source') || 'direct',
    medium: params.get('utm_medium') || 'none',
    content: params.get('utm_content') || 'none',
    referrer: document.referrer || 'direct',
  };

  if (window.gtag) {
    window.gtag('event', 'signup_page_view', {
      ...utmData,
      page_path: window.location.pathname,
    });
    console.log('[GA4] ✅ Signup Attribution Captured:', utmData);
  }
};

// ---------------------------------------------------------------------------
// Generic interaction helpers
// ---------------------------------------------------------------------------

/**
 * Track a CTA button click.
 * @param {string} ctaType   e.g. 'start_trial', 'book_demo'
 * @param {string} location  Where the button appears, e.g. 'header', 'demo_banner'
 */
export function trackCTAClick(ctaType, location) {
  trackEvent('cta_click', { cta_type: ctaType, location });
}

/**
 * Track interaction with a specific portal feature.
 * @param {string} featureName  e.g. 'Invoice_Download', 'API_Key_Rotation'
 * @param {string} action       e.g. 'click', 'expand'
 */
export function trackFeatureInteraction(featureName, action) {
  trackEvent('feature_interaction', { feature_name: featureName, action });
}

/**
 * Track an interaction with a HIPAA-specific route.
 *
 * Healthcare interactions are the highest-value lead signal. Fires the custom
 * `hipaa_interaction` event that should trigger an immediate alert to the
 * sales team (see Analytics Baseline — HIPAA Route Tracking).
 *
 * HIPAA note: `route` must be a path only — never include customer identifiers
 * or query parameters containing PII.
 *
 * @param {string} route  - Path of the HIPAA route, e.g. '/compliance/hipaa'
 * @param {string} action - Interaction type: 'view'|'download'|'generate'|'sign'|'signup'
 */
export function trackHIPAARoute(route, action) {
  // Strip query parameters to prevent accidental PII leakage.
  const safePath = typeof route === 'string' ? route.split('?')[0] : 'unknown';
  trackEvent('hipaa_interaction', {
    route:      safePath,
    action:     action ?? 'view',
    tier:       'healthcare',
    high_value: true,
  });
}

// ---------------------------------------------------------------------------
// Lead capture analytics
// HIPAA NOTE: these events must NEVER include email, name, phone, or any PII.
// ---------------------------------------------------------------------------

/**
 * Fire when a lead capture form is successfully submitted.
 * @param {string} trigger  Context where the form appeared, e.g. 'exit_intent',
 *                          'api_sandbox', 'assessment', 'wave3_invoice'.
 */
export function trackLeadCapture(trigger) {
  const wave3Target = getWave3Target();
  trackEvent('lead_captured', {
    trigger,
    ...(wave3Target ? { wave3_target: wave3Target } : {}),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire when the exit-intent modal is displayed.
 */
export function trackExitIntentShown() {
  trackEvent('exit_intent_shown', { timestamp: new Date().toISOString() });
}

/**
 * Fire when the exit-intent modal is dismissed without submitting.
 */
export function trackExitIntentDismissed() {
  trackEvent('exit_intent_dismissed');
}

/**
 * Fire when a visitor clicks the Developer Sandbox CTA on the API Keys page.
 */
export function trackSandboxCTAClick() {
  trackEvent('sandbox_cta_click', { page: 'api_keys' });
}

/**
 * Fire when a visitor clicks the Audit Readiness Assessment CTA.
 */
export function trackAssessmentCTAClick() {
  trackEvent('assessment_cta_click', { page: 'compliance' });
}

// ---------------------------------------------------------------------------
// Signup conversion tracking
// ---------------------------------------------------------------------------

/**
 * Fire when a user successfully completes the signup form (account created).
 * Uses GA4's recommended `sign_up` event so it can be marked as a conversion
 * in the GA4 admin without any additional configuration.
 *
 * Also fires a `signup_form_submitted` custom event for richer segmentation.
 *
 * HIPAA NOTE: Do NOT pass email, name, or any PII in these parameters.
 *
 * @param {Object} [params]
 * @param {string} [params.industry]       e.g. 'healthcare', 'fintech'
 * @param {string} [params.orgSize]        e.g. '11-50', '51-200'
 * @param {string} [params.guardrailsLevel] e.g. 'standard', 'enhanced', 'sovereign'
 */
export function trackSignupConversion({ industry, orgSize, guardrailsLevel } = {}) {
  const utmParams = getUtmParams();

  // GA4 recommended event — appears in Conversions reports automatically
  // once marked as a conversion in GA4 Admin.
  trackEvent('sign_up', {
    method: 'email',
    ...(industry && { industry }),
    ...(orgSize && { org_size: orgSize }),
    ...(guardrailsLevel && { guardrails_level: guardrailsLevel }),
    ...utmParams,
  });

  // Custom event for richer funnel analysis in Explore reports.
  trackEvent('signup_form_submitted', {
    ...(industry && { industry }),
    ...(orgSize && { org_size: orgSize }),
    ...(guardrailsLevel && { guardrails_level: guardrailsLevel }),
    ...utmParams,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire when a user initiates the Stripe checkout flow (tier selected, form
 * validated, redirecting to Stripe).  Uses GA4's recommended `begin_checkout`
 * e-commerce event so it integrates with the purchase funnel automatically.
 *
 * HIPAA NOTE: Do NOT pass email or company name here.
 *
 * @param {Object} params
 * @param {string} params.tier           e.g. 'standard', 'fintech', 'healthcare', 'government'
 * @param {number} params.value          Monthly price in USD (e.g. 2000)
 * @param {boolean} params.pilot         Whether the pilot discount was applied
 * @param {string} [params.method]       'one_click' | 'form' — checkout path taken
 */
export function trackCheckoutStarted({ tier, value, pilot = false, method = 'form' } = {}) {
  const utmParams = getUtmParams();

  trackEvent('begin_checkout', {
    currency: 'USD',
    value,
    items: [{ item_id: tier, item_name: `SecureBase ${tier}` }],
    pilot_discount: pilot,
    checkout_method: method,
    ...utmParams,
  });
}

/**
 * Fire when a prospect clicks a pricing CTA to express sales interest.
 * Replaces `begin_checkout` for demo/prospect flows so we capture buying
 * intent without requiring a credit card.  This event feeds the
 * "contact_sales_intent" conversion goal in GA4.
 *
 * HIPAA NOTE: Do NOT pass email, company name, or any PII here.
 *
 * @param {Object} params
 * @param {string} params.tier      e.g. 'standard', 'fintech', 'healthcare', 'government'
 * @param {number} [params.value]   Approximate monthly value in USD
 * @param {string} [params.source]  Where the CTA appeared, e.g. 'pricing_page', 'demo_banner'
 */
export function trackContactSalesIntent({ tier, value, source = 'pricing_page' } = {}) {
  const utmParams = getUtmParams();

  trackEvent('contact_sales_intent', {
    tier,
    ...(value !== undefined && { value, currency: 'USD' }),
    source,
    ...utmParams,
  });
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

/**
 * Fire a GA4 `purchase` event once after a successful Stripe checkout.
 * Called from ThankYou.jsx using the session_id from the success URL.
 *
 * HIPAA NOTE: Do NOT pass email or any PII here — session_id is an opaque
 * Stripe identifier that is safe to include as a transaction reference.
 *
 * @param {string} sessionId  Stripe Checkout Session ID
 * @param {string} plan       Plan key, e.g. 'standard', 'fintech'
 * @param {number} value      Monthly value in USD
 */
export function trackPurchase(sessionId, plan, value) {
  if (!sessionId || !plan) return;
  const safeValue = typeof value === 'number' && value > 0 ? value : 0;
  trackEvent('purchase', {
    transaction_id: sessionId,
    currency: 'USD',
    value: safeValue,
    items: [{ item_id: plan, item_name: `SecureBase ${plan}` }],
  });
}
