/**
 * leadScoringService.js
 *
 * Pure functions for calculating a behavioural lead score.
 * No side-effects, no PII stored — safe to import anywhere.
 *
 * HIPAA NOTE: This module never transmits or logs PII. Email domain
 * is inspected only to distinguish work vs. personal accounts (no email
 * address is retained or sent to any analytics endpoint).
 */

// ---------------------------------------------------------------------------
// Free e-mail domain list (abbreviated; extend as needed)
// ---------------------------------------------------------------------------

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'live.com', 'msn.com', 'me.com',
]);

/**
 * Returns true when the email belongs to a well-known free provider.
 * @param {string} email
 * @returns {boolean}
 */
function isFreeEmailDomain(email) {
  if (typeof email !== 'string' || !email.includes('@')) return true;
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return FREE_EMAIL_DOMAINS.has(domain);
}

// ---------------------------------------------------------------------------
// Plan tier helper
// ---------------------------------------------------------------------------

/** Maps plan names to numeric tiers for upgrade/downgrade calculations. */
export const PLAN_TIERS = { Starter: 1, Professional: 2, Enterprise: 3 };

/** Monthly list prices used for plan-change value delta. */
export const PLAN_PRICES = { Starter: 99, Professional: 299, Enterprise: 999 };

export function getPlanTier(planName) {
  return PLAN_TIERS[planName] || 0;
}

export function getPlanPrice(planName) {
  return PLAN_PRICES[planName] || 0;
}

// ---------------------------------------------------------------------------
// Lead scoring
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LeadData
 * @property {string}  [email]              - Visitor's email address.
 * @property {string}  [company]            - Company name.
 * @property {string}  [role]               - Self-reported role (ceo, cto, etc.).
 * @property {string}  [campaign]           - utm_campaign value.
 * @property {boolean} [viewedPricing]      - Whether the visitor viewed pricing.
 * @property {boolean} [exploredAPIDocs]    - Whether the visitor explored API docs.
 * @property {number}  [pagesViewed]        - Number of pages seen in session.
 * @property {number}  [timeOnSite]         - Seconds spent on site.
 * @property {number}  [returnVisits]       - How many times they've visited.
 * @property {boolean} [downloadedWhitepaper]
 * @property {boolean} [requestedDemo]
 * @property {boolean} [exitIntentCaptured] - Whether exit intent was triggered.
 */

/**
 * Calculate a 0–100+ lead score based on demographic and behavioural signals.
 *
 * @param {LeadData} leadData
 * @returns {{ score: number, grade: 'HOT'|'WARM'|'QUALIFIED'|'NURTURE', priority: string }}
 */
export function calculateLeadScore(leadData = {}) {
  let score = 0;

  // --- Demographic signals ---
  if (leadData.company) score += 10;

  const role = (leadData.role || '').toLowerCase();
  if (role.includes('cto') || role.includes('ceo') || role.includes('vp') || role.includes('founder')) {
    score += 20;
  } else if (role.includes('security') || role.includes('compliance')) {
    score += 15;
  }

  if (leadData.email && !isFreeEmailDomain(leadData.email)) {
    score += 15; // Work email → higher intent
  }

  // --- Behavioural signals ---
  if (leadData.viewedPricing)    score += 25;
  if (leadData.exploredAPIDocs)  score += 20;
  if ((leadData.pagesViewed || 0) > 5)  score += 15;
  if ((leadData.timeOnSite || 0) > 300) score += 10; // 5+ minutes
  if ((leadData.returnVisits || 0) > 1) score += 20;

  // --- Campaign signals ---
  if ((leadData.campaign || '').startsWith('wave3_')) score += 30;

  // --- Conversion signals ---
  if (leadData.downloadedWhitepaper)  score += 15;
  if (leadData.requestedDemo)         score += 40;
  if (leadData.exitIntentCaptured)    score += 5;

  const grade =
    score >= 80 ? 'HOT' :
    score >= 50 ? 'WARM' :
    score >= 20 ? 'QUALIFIED' : 'NURTURE';

  const priority =
    score >= 80 ? 'Immediate follow-up' :
    score >= 50 ? 'Follow up within 24h' :
    'Add to nurture sequence';

  return { score, grade, priority };
}
