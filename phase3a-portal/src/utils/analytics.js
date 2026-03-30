/**
 * GA4 Analytics utility
 * Initializes Google Analytics 4 session tracking and captures UTM parameters.
 */

const GA_MEASUREMENT_ID = 'G-EEVD92DCS1';

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

/**
 * Parse UTM query parameters from the current URL.
 * @returns {Object} UTM parameters present in the URL
 */
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

/**
 * Initialize GA4 session tracking.
 * - Configures the GA4 property with the measurement ID.
 * - Forwards any UTM parameters present in the URL to GA4.
 * - Fires a `session_start` event so Realtime reports show active users immediately.
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
}
