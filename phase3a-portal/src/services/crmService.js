/**
 * crmService.js
 *
 * Handles lead capture submission:
 *   1. Persists lead data locally (localStorage) for progressive profiling.
 *   2. POSTs to the Netlify function `/api/leads` for backend notification.
 *
 * HIPAA NOTE: Email and company data are stored in localStorage only — they
 * are never sent to GA4 or any analytics endpoint. The server-side function
 * is responsible for secure handling and notification delivery.
 */

import { calculateLeadScore } from './leadScoringService';

const LEAD_STORAGE_KEY = 'sb_lead';
const LEAD_SUBMIT_ENDPOINT = '/api/leads';

// ---------------------------------------------------------------------------
// Local persistence helpers
// ---------------------------------------------------------------------------

/**
 * Returns the stored lead object from localStorage, or null.
 * @returns {Object|null}
 */
export function getStoredLead() {
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Merges new fields into the stored lead and persists.
 * Existing fields are preserved (progressive profiling).
 * @param {Object} fields
 * @returns {Object} merged lead
 */
function saveLeadLocally(fields) {
  const existing = getStoredLead() || {};
  const merged = { ...existing, ...fields, updatedAt: new Date().toISOString() };
  if (!merged.firstSeenAt) merged.firstSeenAt = new Date().toISOString();
  merged.returnVisits = (existing.returnVisits || 0) + (existing.email ? 0 : 1);
  try {
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable — degrade gracefully
  }
  return merged;
}

// ---------------------------------------------------------------------------
// UTM helpers (duplicated here to avoid circular import with analytics.js)
// ---------------------------------------------------------------------------

function getUtmParams() {
  const search = new URLSearchParams(window.location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const params = {};
  keys.forEach((k) => {
    const v = search.get(k);
    if (v) params[k] = v;
  });
  return params;
}

// ---------------------------------------------------------------------------
// Main submission
// ---------------------------------------------------------------------------

/**
 * Submit a lead:
 *   - Merges with any previously stored lead data (progressive profiling).
 *   - Calculates lead score.
 *   - Persists enriched lead to localStorage.
 *   - POSTs to the Netlify function for backend notification.
 *
 * @param {Object} fields  Fields collected from the form (email, company, role, trigger, …).
 * @returns {Promise<Object>} Enriched lead object (including score + grade).
 */
export async function submitLead(fields) {
  const utmParams = getUtmParams();
  const stored = getStoredLead() || {};

  // Merge new fields with stored state
  const mergedFields = { ...stored, ...fields };

  // Enrich with session context
  const enrichedLead = {
    ...mergedFields,
    campaign: utmParams.utm_campaign || stored.campaign || '',
    source: utmParams.utm_source || stored.source || 'direct',
    medium: utmParams.utm_medium || stored.medium || 'none',
    content: utmParams.utm_content || stored.content || '',
    pageUrl: window.location.pathname,
    submittedAt: new Date().toISOString(),
  };

  // Score the lead
  const { score, grade, priority } = calculateLeadScore({
    email: enrichedLead.email,
    company: enrichedLead.company,
    role: enrichedLead.role,
    campaign: enrichedLead.campaign,
    viewedPricing: enrichedLead.viewedPricing,
    exploredAPIDocs: enrichedLead.exploredAPIDocs,
    pagesViewed: enrichedLead.pagesViewed,
    timeOnSite: enrichedLead.timeOnSite,
    returnVisits: enrichedLead.returnVisits,
    exitIntentCaptured: fields.trigger === 'exit_intent',
  });

  const finalLead = { ...enrichedLead, score, grade, priority };

  // Persist locally
  saveLeadLocally(finalLead);

  // Submit to backend (non-blocking failure — UX should not suffer)
  try {
    const response = await fetch(LEAD_SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalLead),
    });

    if (!response.ok) {
      console.warn('[CRM] Lead submission returned non-OK status:', response.status);
    }
  } catch (err) {
    // Network error — lead is already saved locally, so no data is lost
    console.warn('[CRM] Lead submission failed (network):', err.message);
  }

  return finalLead;
}
