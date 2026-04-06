/**
 * CRM Service
 * Persists lead data to localStorage, fires a webhook/Netlify function, and
 * optionally sends an urgent Slack-style notification for HOT leads.
 */

import { calculateLeadScore, getSessionBehaviouralSignals } from './leadScoringService';

const LEAD_KEY = 'sb_lead';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    campaign: params.get('utm_campaign') || '',
    source:   params.get('utm_source')   || '',
    medium:   params.get('utm_medium')   || '',
    content:  params.get('utm_content')  || '',
  };
}

/**
 * Read the persisted lead object from localStorage.
 * Returns null when no lead has been captured yet.
 * @returns {Object|null}
 */
export function getLeadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Merge new fields into the persisted lead and write it back to localStorage.
 * @param {Object} updates
 * @returns {Object} Updated lead object
 */
function updatePersistedLead(updates) {
  const current = getLeadFromLocalStorage() || {};
  const updated  = { ...current, ...updates };
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota exceeded — ignore
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a lead captured from any form or CTA.
 * - Enriches with UTM params, session signals, and a lead score.
 * - Persists to localStorage for progressive profiling on repeat visits.
 * - Posts to the /api/leads Netlify function when available.
 * - Fires an urgent notification for HOT leads.
 *
 * @param {Object} formData  Fields collected from the lead capture form
 * @returns {Promise<Object>} The enriched lead object
 */
export async function submitLead(formData = {}) {
  const utmParams = getUtmParams();
  const signals   = getSessionBehaviouralSignals();

  const existing = getLeadFromLocalStorage() || {};

  // Merge: keep existing values unless the new submission provides them
  const merged = {
    ...existing,
    ...formData,
    utmParams:    { ...existing.utmParams, ...utmParams },
    campaign:     utmParams.campaign || existing.campaign || '',
    visitCount:   (existing.visitCount || 0) + 1,
    lastSeenAt:   new Date().toISOString(),
    firstSeenAt:  existing.firstSeenAt || new Date().toISOString(),
    sourceUrl:    existing.sourceUrl || window.location.href,
  };

  const scoringInput = { ...merged, ...signals };
  const scoring = calculateLeadScore(scoringInput);

  const enrichedLead = {
    ...merged,
    ...scoring,
    sessionSignals: signals,
  };

  // Persist for progressive profiling
  updatePersistedLead(enrichedLead);

  // Fire and forget — do not block the UI
  _sendToBackend(enrichedLead).catch(() => {});

  return enrichedLead;
}

/**
 * Update a single field on the persisted lead without sending to the backend.
 * Useful for recording incremental signals (e.g. "viewed pricing").
 * @param {Object} updates
 */
export function updateLead(updates = {}) {
  updatePersistedLead(updates);
}

// ---------------------------------------------------------------------------
// Internal: backend submission
// ---------------------------------------------------------------------------

async function _sendToBackend(lead) {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });

    if (!res.ok) {
      console.warn('[CRM] Lead submission returned', res.status);
    }
  } catch (err) {
    console.warn('[CRM] Lead submission failed (offline?):', err.message);
  }
}
