/**
 * submit-lead.js — Netlify serverless function
 *
 * Receives POST /api/leads with lead data and:
 *   1. Validates the required `email` field.
 *   2. POSTs to LEAD_NOTIFICATION_WEBHOOK_URL (Zapier / Make / n8n / custom)
 *      if the environment variable is configured.
 *   3. Returns 200 JSON with {success: true}.
 *
 * Environment variables (set in Netlify dashboard):
 *   LEAD_NOTIFICATION_WEBHOOK_URL  — Generic webhook (Zapier/Make/n8n)
 *   LEAD_SALES_EMAIL               — Recipient email for hot-lead alerts (optional)
 *   ALLOWED_ORIGIN                 — CORS origin (defaults to demo domain)
 *
 * HIPAA NOTE: Raw email is only forwarded to the configured webhook and is
 * never logged to stdout/stderr (Netlify log aggregation). Only non-PII
 * metadata (score, grade, campaign, trigger, timestamp) is logged.
 *
 * SECURITY:
 *   - Input is strictly validated and sanitised before forwarding.
 *   - Only POST and OPTIONS are accepted.
 *   - CORS is locked to ALLOWED_ORIGIN.
 */

'use strict';

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';

// Regex to validate e-mail format. Requires at least one character before @,
// a domain with standard characters, and a TLD of 2+ letters.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Fields we allow through to the webhook. All others are stripped.
const ALLOWED_FIELDS = [
  'email', 'company', 'role', 'trigger', 'campaign', 'source',
  'medium', 'content', 'score', 'grade', 'priority',
  'pageUrl', 'submittedAt',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  };
}

/**
 * Sanitise a string value: trim and cap length to prevent abuse.
 * @param {*}      value
 * @param {number} [maxLen=200]
 * @returns {string}
 */
function sanitiseString(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

exports.handler = async (event) => {
  const origin = ALLOWED_ORIGIN;

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let raw;
  try {
    raw = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' }, origin);
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const email = sanitiseString(raw.email || '', 254);
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse(400, { error: 'A valid email address is required' }, origin);
  }

  // ── Build allowlisted payload ─────────────────────────────────────────────
  const payload = {};
  for (const field of ALLOWED_FIELDS) {
    if (raw[field] !== undefined) {
      payload[field] = typeof raw[field] === 'string'
        ? sanitiseString(raw[field])
        : raw[field]; // numbers / booleans pass through as-is
    }
  }
  payload.email = email; // Use the validated/sanitised email

  // ── Non-PII metadata for server logs ─────────────────────────────────────
  // HIPAA: Log only non-identifiable fields so Netlify logs contain no PII.
  console.log('[submit-lead] received:', JSON.stringify({
    score: payload.score,
    grade: payload.grade,
    campaign: payload.campaign,
    trigger: payload.trigger,
    submittedAt: payload.submittedAt,
  }));

  // ── Webhook notification (fire-and-forget with 3 s timeout) ─────────────
  const webhookUrl = process.env.LEAD_NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        source_system: 'securebase-demo',
        environment: process.env.CONTEXT || 'production',
      }),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) console.warn('[submit-lead] webhook returned non-OK:', res.status);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error('[submit-lead] webhook error:', err.message);
      });
    // Do NOT await — return immediately so the user gets a fast response
  }

  return jsonResponse(200, { success: true }, origin);
};
