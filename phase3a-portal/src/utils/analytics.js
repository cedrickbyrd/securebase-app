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
  const campaign = utmParams.utm_campaign || '';
  const target = campaign.replace(/^wave3_/, '');
  const sessionData = {
    campaign,
    target,
    source: utmParams.utm_source || '',
    content: utmParams.utm_content || '',
    medium: utmParams.utm_medium || '',
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
 * completes signup.
 *
 * Call this in your signup form on successful submission:
 * ```js
 * import { trackWave3Conversion } from '@/utils/analytics';
 * trackWave3Conversion();
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
