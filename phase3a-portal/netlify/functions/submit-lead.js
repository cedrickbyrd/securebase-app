/**
 * Netlify Function: submit-lead
 * Saves leads to Supabase database, then optionally notifies via webhook
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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

  // ── Validate email ──────────────────────────────────────────────────────
  const email = (lead.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 422,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Valid email is required' }),
    };
  }

  // ── Build safe payload ──────────────────────────────────────────────────
  const safePayload = {
    email,
    company: lead.company || '',
    role: lead.role || '',
    phone: lead.phone || '',
    campaign: lead.campaign || '',
    source: lead.source || '',
    medium: lead.medium || '',
    content: lead.content || '',
    trigger: lead.trigger || '',
    score: lead.score || 0,
    grade: lead.grade || 'NURTURE',
    priority: lead.priority || '',
    utm_params: lead.utmParams || {},
    session_signals: lead.sessionSignals || {},
    source_url: lead.sourceUrl || '',
    first_seen_at: lead.firstSeenAt || new Date().toISOString(),
    last_seen_at: lead.lastSeenAt || new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  };

  let leadId = null;

  // ── Save to Supabase ────────────────────────────────────────────────────
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data, error } = await supabase
        .from('leads')
        .upsert(
          {
            email: safePayload.email,
            company: safePayload.company,
            campaign: safePayload.campaign,
            source: safePayload.source,
            medium: safePayload.medium,
            content: safePayload.content,
            trigger: safePayload.trigger,
            score: safePayload.score,
            grade: safePayload.grade,
            priority: safePayload.priority,
            utm_params: safePayload.utm_params,
            session_signals: safePayload.session_signals,
            source_url: safePayload.source_url,
            last_seen_at: safePayload.last_seen_at,
          },
          {
            onConflict: 'email',
            ignoreDuplicates: false,
          }
        )
        .select('id')
        .single();

      if (error) {
        console.error('[submit-lead] Supabase error:', error.message);
      } else {
        leadId = data?.id;
        console.log(`[submit-lead] ✅ Saved to database: ${email} (${leadId})`);
      }
    } catch (err) {
      console.error('[submit-lead] Supabase exception:', err.message);
    }
  } else {
    console.warn('[submit-lead] ⚠️  Supabase not configured - lead not persisted');
  }

  // ── Optional webhook notification ───────────────────────────────────────
  const webhookUrl = process.env.LEAD_NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...safePayload, leadId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err) {
      console.error('[submit-lead] Webhook error:', err.message);
    }
  }

  // ── Log for debugging (no PII) ──────────────────────────────────────────
  console.log(
    `[submit-lead] ${safePayload.grade} lead` +
    (safePayload.company ? ` from ${safePayload.company}` : '') +
    ` score=${safePayload.score}` +
    (leadId ? ` id=${leadId}` : ' (not saved)')
  );

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, grade: safePayload.grade, leadId }),
  };
};
EOF    EOF 
