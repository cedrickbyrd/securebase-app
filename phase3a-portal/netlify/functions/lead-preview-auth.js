/**
 * lead-preview-auth — Netlify serverless function
 *
 * Issues a short-lived, HttpOnly JWT cookie immediately after a prospect
 * submits the Contact Sales form.  The token grants "lead-preview" / "demo"
 * access so the recipient can explore the SRE Dashboard with mock data.
 *
 * POST /api/lead-preview-auth  → validate email, set HttpOnly cookie
 *
 * JWT payload:
 *   { role: "lead-preview", access: "demo", tenant_id: "demo-tenant" }
 *
 * Security notes:
 *   - Token is stored only in an HttpOnly, Secure, SameSite=Lax cookie.
 *   - The token value is NEVER returned in the response body.
 *   - JWT_SECRET must be set as a Netlify environment variable.
 *   - No PII is logged — only role, access level, and timestamp.
 *   - TTL is intentionally short (2 hours) to limit exposure.
 */

'use strict';

const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';
const TOKEN_TTL_SECS = 2 * 60 * 60; // 2 hours

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[lead-preview-auth] WARNING: JWT_SECRET not set — using insecure development default.');
  } else {
    throw new Error('JWT_SECRET environment variable is required.');
  }
}
const SIGNING_SECRET = JWT_SECRET || 'demo-dev-secret-REPLACE-IN-PRODUCTION';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':     'Content-Type',
  'Access-Control-Allow-Methods':     'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  // CORS pre-flight
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

  // Validate email from request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 422,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Valid email is required' }),
    };
  }

  // Build minimal payload — no PII
  const payload = {
    role:      'lead-preview',
    access:    'demo',
    tenant_id: 'demo-tenant',
  };

  const token = jwt.sign(payload, SIGNING_SECRET, {
    expiresIn: TOKEN_TTL_SECS,
    issuer:    'securebase-demo',
    audience:  'securebase-portal',
  });

  // Audit log — token value and email intentionally omitted
  console.log(JSON.stringify({
    event:     'lead_preview_jwt_issued',
    role:      payload.role,
    access:    payload.access,
    ttl_secs:  TOKEN_TTL_SECS,
    timestamp: new Date().toISOString(),
  }));

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      // HttpOnly prevents JavaScript from reading the cookie (XSS protection).
      // Secure ensures it is only sent over HTTPS.
      // SameSite=Lax allows first-party navigations from external links.
      'Set-Cookie': `demo_jwt=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TOKEN_TTL_SECS}`,
    },
    body: JSON.stringify({
      success: true,
      role:    payload.role,
      access:  payload.access,
    }),
  };
};
