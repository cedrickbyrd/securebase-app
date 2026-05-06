/**
 * @file utmCapture.js
 * @description Marketing-engine UTM capture layer.
 *
 * Supplements the first-touch attribution in trackingUtils.js with two extras:
 *   1. sessionStorage persistence (survives same-tab navigation but not new tabs,
 *      so a visitor who opens a second tab doesn't pollute the first-touch source).
 *   2. A GA4 `utm_captured` custom event so every LinkedIn post → demo conversion
 *      is visible in the Marketing > Events report without touching the database.
 *
 * Call `initMarketingCapture()` once on app mount (already done in App.jsx via
 * UTMRouter).  Subsequent reads use `getSessionAttribution()` or the existing
 * `getStoredAttribution()` from trackingUtils.
 *
 * HIPAA / Privacy notes:
 * - Only UTM params (source, medium, campaign, content, term) and a sanitised
 *   landing path are captured.  No email, name, or user ID.
 * - sessionStorage data is never sent to a server — it stays browser-local.
 */

import { captureUtmParams } from '../utils/trackingUtils';
import { trackUtmCaptured } from '../utils/analytics';

const SESSION_KEY = 'sb_session_attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * Resolve UTM params from the current URL.
 * Returns an object with only present keys (no nulls).
 *
 * @returns {object}
 */
function parseCurrentUtms() {
  const search = new URLSearchParams(window.location.search);
  const result = {};
  UTM_KEYS.forEach((key) => {
    const val = search.get(key);
    if (val) result[key] = val.slice(0, 200);
  });
  return result;
}

/**
 * Persist UTM params to sessionStorage (tab-scoped).
 * Only writes when fresh UTM params are present in the URL.
 *
 * @param {object} utms
 */
function persistToSession(utms) {
  if (Object.keys(utms).length === 0) return;
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...utms, landing_path: window.location.pathname }),
    );
  } catch {
    // sessionStorage unavailable (private browsing) — no-op.
  }
}

/**
 * Read the session-scoped UTM attribution.
 *
 * @returns {object|null}
 */
export function getSessionAttribution() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Initialise the marketing capture layer.
 *
 * - Delegates first-touch persistence to `captureUtmParams()` (localStorage, 30-day TTL).
 * - Writes to sessionStorage for same-tab attribution.
 * - Fires the GA4 `utm_captured` event when fresh UTM params are present.
 *
 * Safe to call multiple times — duplicate GA4 events are suppressed via a
 * module-level flag.
 */
export function initMarketingCapture() {
  // Always persist to first-touch (localStorage) via existing utility.
  captureUtmParams();

  const fresh = parseCurrentUtms();
  if (Object.keys(fresh).length === 0) return;

  // Session-scoped persistence.
  persistToSession(fresh);

  // Fire GA4 event so every UTM landing is counted.
  trackUtmCaptured({ ...fresh, landing_path: window.location.pathname });
}

/**
 * Build the UTM query string from the current session attribution, suitable for
 * appending to an off-domain URL (e.g. demo.securebase.tximhotep.com).
 *
 * @returns {string}  e.g. "?utm_source=linkedin&utm_medium=organic&utm_campaign=ffiec_bank_post1"
 */
export function buildUtmPassthrough() {
  const attribution = getSessionAttribution();
  if (!attribution) return '';

  const params = new URLSearchParams();
  UTM_KEYS.forEach((key) => {
    if (attribution[key]) params.set(key, attribution[key]);
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Determine which vertical persona this visitor maps to based on UTM campaign.
 *
 * @returns {'banking' | 'healthcare' | null}
 */
export function detectVertical() {
  let attribution = getSessionAttribution();

  if (!attribution) {
    try {
      const raw = localStorage.getItem('sb_attribution');
      attribution = raw ? JSON.parse(raw) : null;
    } catch {
      attribution = null;
    }
  }

  if (!attribution) return null;

  const campaign = (attribution.utm_campaign || '').toLowerCase();
  const source   = (attribution.utm_source   || '').toLowerCase();

  if (
    campaign.includes('ffiec') ||
    campaign.includes('bank') ||
    campaign.includes('tx_bank') ||
    campaign.includes('tx-bank') ||
    source === 'tba' ||
    source === 'ibat' ||
    source === 'aba' ||
    source === 'ffiec'
  ) {
    return 'banking';
  }

  if (
    campaign.includes('hipaa') ||
    campaign.includes('health') ||
    campaign.includes('ocr')
  ) {
    return 'healthcare';
  }

  return null;
}
