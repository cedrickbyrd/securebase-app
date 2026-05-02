/**
 * @file trackingUtils.js
 * @description UTM harvesting and attribution engine for SecureBase zero-friction signup.
 *
 * Features:
 * - Captures UTM parameters from the URL on landing
 * - Persists attribution in localStorage with a 30-day TTL
 * - Detects LinkedIn traffic for automatic pilot discount eligibility
 * - Sanitises all data before storage (no PII/PHI)
 *
 * HIPAA / Privacy notes:
 * - Only UTM params (source, medium, campaign, content, term) are stored.
 * - No email addresses, user IDs, or other PII are captured here.
 * - Data is stored in localStorage only (first-party, no third-party beacons).
 */

const STORAGE_KEY = 'sb_attribution';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * Capture UTM parameters from the current URL and persist them to localStorage.
 * Only overwrites a stored attribution when fresh UTM params are present in the URL,
 * preserving the first-touch attribution model.
 *
 * @returns {object} The captured (or previously stored) attribution object.
 */
export function captureUtmParams() {
  const search = new URLSearchParams(window.location.search);
  const fresh = {};

  UTM_KEYS.forEach((key) => {
    const value = search.get(key);
    if (value) fresh[key] = value.slice(0, 200); // cap length to avoid oversized storage
  });

  if (Object.keys(fresh).length > 0) {
    const payload = {
      ...fresh,
      captured_at: Date.now(),
      landing_path: window.location.pathname,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage unavailable (private browsing quota exceeded) — no-op.
    }
    return payload;
  }

  return getStoredAttribution();
}

/**
 * Read the stored attribution object from localStorage.
 * Returns null if no attribution is stored or if it has expired.
 *
 * @returns {object|null}
 */
export function getStoredAttribution() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data.captured_at) return null;

    const age = Date.now() - data.captured_at;
    if (age > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Clear the stored attribution. Call after a successful purchase to avoid
 * re-applying the discount on a subsequent visit.
 */
export function clearAttribution() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

/**
 * Determine whether the current (or stored) attribution indicates a LinkedIn visitor.
 * LinkedIn traffic is identified by utm_source === 'linkedin' (case-insensitive).
 *
 * @returns {boolean}
 */
export function isLinkedInTraffic() {
  const attribution = getStoredAttribution() || {};
  const source = (attribution.utm_source || '').toLowerCase();
  return source === 'linkedin';
}

/**
 * Per-tier pilot pricing (50% discount) for the Q2 2026 pilot programme.
 * Source of truth: scripts/check-pilot-conversions.js PRICING_TIERS.
 *
 * monthlyPrice — what the customer pays with the pilot discount applied.
 * fullPrice    — the undiscounted/list price for this tier.
 */
export const PILOT_PRICING = {
  standard:   { monthlyPrice: 1000,  fullPrice: 2000,  discountPercent: 50 },
  fintech:    { monthlyPrice: 4000,  fullPrice: 8000,  discountPercent: 50 },
  healthcare: { monthlyPrice: 7500,  fullPrice: 15000, discountPercent: 50 },
  government: { monthlyPrice: 12500, fullPrice: 25000, discountPercent: 50 },
};

/**
 * Return the pilot pricing config when the visitor is eligible (LinkedIn source).
 * Returns null if the visitor is not eligible for the pilot discount.
 *
 * @param {string|null} [tier] - Optional tier key. When provided, returns tier-specific
 *   pilot pricing. When omitted, returns the legacy standard-tier pricing object.
 * @returns {{ monthlyPrice: number, fullPrice: number, discountPercent: number, label?: string }|null}
 */
export function getPilotPricing(tier = null) {
  if (!isLinkedInTraffic()) return null;
  if (tier && PILOT_PRICING[tier]) return PILOT_PRICING[tier];
  // Legacy fallback for callers that don't pass a tier — uses standard-tier values.
  return { ...PILOT_PRICING.standard, label: 'Pilot Program' };
}

/**
 * Return the number of remaining pilot spots.
 * In a real system this would be fetched from the backend. For now it reads
 * a localStorage key (set by the backend after each signup) and falls back to
 * the default maximum defined in the environment.
 *
 * @returns {number}
 */
export function getRemainingPilotSpots() {
  const MAX_SPOTS = Number(import.meta.env.VITE_PILOT_MAX_SPOTS) || 10;
  try {
    const taken = Number(localStorage.getItem('sb_pilot_spots_taken')) || 0;
    return Math.max(0, MAX_SPOTS - taken);
  } catch {
    return MAX_SPOTS;
  }
}

/**
 * Build a metadata object suitable for attaching to a Supabase user or Stripe
 * subscription. Contains only non-PII attribution data.
 *
 * @returns {object}
 */
export function buildAttributionMetadata() {
  const attribution = getStoredAttribution() || {};
  const utmFields = Object.fromEntries(
    [...UTM_KEYS, 'landing_path'].map((key) => [key, attribution[key] || null])
  );
  return {
    ...utmFields,
    pilot_eligible: isLinkedInTraffic(),
  };
}
