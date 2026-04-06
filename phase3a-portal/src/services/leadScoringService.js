/**
 * Lead Scoring Service
 * Calculates a numeric score and grade for each captured lead based on
 * demographic data and behavioural signals stored in the session.
 */

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
]);

/**
 * Score a lead and return an enriched scoring object.
 *
 * @param {Object} leadData
 * @param {string}  leadData.email
 * @param {string}  [leadData.company]
 * @param {string}  [leadData.role]
 * @param {string}  [leadData.campaign]
 * @param {number}  [leadData.pagesViewed]
 * @param {number}  [leadData.timeOnSite]        seconds
 * @param {number}  [leadData.returnVisits]
 * @param {boolean} [leadData.viewedPricing]
 * @param {boolean} [leadData.exploredAPIDocs]
 * @param {boolean} [leadData.downloadedWhitepaper]
 * @param {boolean} [leadData.requestedDemo]
 * @param {boolean} [leadData.exitIntentCaptured]
 *
 * @returns {{ score: number, grade: string, priority: string }}
 */
export function calculateLeadScore(leadData = {}) {
  let score = 0;

  // ── Demographic scoring ───────────────────────────────────────────────────
  if (leadData.company) score += 10;

  const role = (leadData.role || '').toLowerCase();
  if (role.includes('cto') || role.includes('ceo') || role.includes('founder')) score += 20;
  if (role.includes('security') || role.includes('compliance') || role.includes('vp')) score += 10;

  if (leadData.email) {
    const domain = leadData.email.split('@')[1] || '';
    if (domain && !FREE_EMAIL_DOMAINS.has(domain.toLowerCase())) score += 15;
  }

  // ── Behavioural scoring ───────────────────────────────────────────────────
  if (leadData.viewedPricing)      score += 25;
  if (leadData.exploredAPIDocs)    score += 20;
  if ((leadData.pagesViewed  || 0) > 5)   score += 15;
  if ((leadData.timeOnSite   || 0) > 300)  score += 10;   // 5+ minutes
  if ((leadData.returnVisits || 0) > 1)    score += 20;

  // ── Campaign scoring ──────────────────────────────────────────────────────
  if ((leadData.campaign || '').startsWith('wave3_')) score += 30;

  // ── Urgency / intent signals ──────────────────────────────────────────────
  if (leadData.downloadedWhitepaper) score += 15;
  if (leadData.requestedDemo)        score += 40;
  if (leadData.exitIntentCaptured)   score +=  5;

  // ── Grade & priority ──────────────────────────────────────────────────────
  const grade = score >= 80 ? 'HOT'
    : score >= 50 ? 'WARM'
    : score >= 20 ? 'QUALIFIED'
    : 'NURTURE';

  const priority = score >= 80 ? 'Immediate follow-up required'
    : score >= 50 ? 'Follow up within 24 hours'
    : 'Add to nurture sequence';

  return { score, grade, priority };
}

/**
 * Read the session-level behavioural signals from localStorage so they
 * can be merged into the lead scoring payload automatically.
 *
 * @returns {Object}
 */
export function getSessionBehaviouralSignals() {
  try {
    const raw = localStorage.getItem('sb_session_signals');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Record a behavioural signal in the current session.
 * Safe to call multiple times — signals are merged, not replaced.
 *
 * @param {string}  key    e.g. 'viewedPricing', 'exploredAPIDocs'
 * @param {*}       value  Typically true or a number
 */
export function recordSignal(key, value = true) {
  try {
    const existing = getSessionBehaviouralSignals();
    localStorage.setItem('sb_session_signals', JSON.stringify({ ...existing, [key]: value }));
  } catch {
    // localStorage unavailable — silently ignore
  }
}
