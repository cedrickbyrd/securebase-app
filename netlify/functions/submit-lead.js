/**
 * Netlify Function: submit-lead
 * Receives an enriched lead payload from the frontend, validates it, and
 * fans it out to:
 *   1. A webhook URL (e.g. Zapier → Google Sheets / HubSpot)
 *   2. Logs it for debugging
 *
 * Environment variables (set in Netlify UI or netlify.toml):
 *   LEAD_NOTIFICATION_WEBHOOK_URL  — Zapier / Make webhook URL
 *   ALLOWED_ORIGIN                 — CORS origin (default: demo.securebase.tximhotep.com)
 */

'use strict';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
if (!ALLOWED_ORIGIN) {
  console.warn('[submit-lead] ALLOWED_ORIGIN env var is not set — CORS will block all origins');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN || '',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let lead;
  try {
    lead = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  // ── Validate required field ─────────────────────────────────────────────
  const email = (lead.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 422,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Valid email is required' }),
    };
  }

  // ── Strip any fields that should not leave the server ──────────────────
  // (phone is intentionally kept — sales needs it)
  const safePayload = {
    email,
    company:        lead.company        || '',
    role:           lead.role           || '',
    phone:          lead.phone          || '',
    score:          lead.score          || 0,
    grade:          lead.grade          || 'NURTURE',
    priority:       lead.priority       || '',
    trigger:        lead.trigger        || '',
    campaign:       lead.campaign       || '',
    utmParams:      lead.utmParams      || {},
    visitCount:     lead.visitCount     || 1,
    sourceUrl:      lead.sourceUrl      || '',
    firstSeenAt:    lead.firstSeenAt    || new Date().toISOString(),
    lastSeenAt:     lead.lastSeenAt     || new Date().toISOString(),
    sessionSignals: lead.sessionSignals || {},
    submittedAt:    new Date().toISOString(),
  };

  // ── Fan-out: webhook ────────────────────────────────────────────────────
  const webhookUrl = process.env.LEAD_NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 5000); // 5 s timeout
      const res = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(safePayload),
        signal:  controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        console.warn('[submit-lead] Webhook returned', res.status);
      }
    } catch (err) {
      // Log but don't fail the request — lead is already logged above
      console.error('[submit-lead] Webhook error:', err.message);
    }
  }

  // ── Log for debugging ───────────────────────────────────────────────────
  console.log(
    `[submit-lead] ${safePayload.grade} lead captured — ${email}` +
    (safePayload.company ? ` (${safePayload.company})` : '') +
    ` score=${safePayload.score}`
  );

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, grade: safePayload.grade }),
  };
};
