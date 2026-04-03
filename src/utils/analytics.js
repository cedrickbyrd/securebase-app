/**
 * GA4 Analytics utility for the SecureBase root app.
 * Mirrors the portal analytics.js pattern. Tracks page views,
 * engagement time, and UTM parameters via gtag when available.
 */

const GA_MEASUREMENT_ID = 'G-EEVD92DCS1';

// In-session page-view counter (resets on hard reload).
let _pagesViewed = 0;

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

/**
 * Initialize GA4 session tracking. Call once on app mount.
 */
export function initializeSessionTracking() {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  const utmParams = getUtmParams();
  if (Object.keys(utmParams).length > 0) {
    window.gtag('set', utmParams);
  }
  trackEvent('session_start');
}

/**
 * Track a page view.
 * @param {string} pageName  Human-readable page name
 * @param {string} path      URL path (e.g. '/compliance')
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
 */
export function incrementPagesViewed() {
  _pagesViewed += 1;
  trackEvent('pages_viewed', { pages_viewed_count: _pagesViewed });
}

/**
 * Track a pricing page CTA click.
 * @param {string} plan  Plan name (e.g. 'fintech')
 */
export function trackPricingCTA(plan) {
  trackEvent('pricing_cta_click', { plan });
}

/**
 * Track a checkout initiated event.
 * @param {string} plan  Plan name
 */
export function trackCheckoutStarted(plan) {
  trackEvent('checkout_started', { plan });
}
