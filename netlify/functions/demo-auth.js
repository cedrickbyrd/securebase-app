/**
 * demo-auth — Netlify serverless function
 *
 * Issues a short-lived, HttpOnly JWT cookie for demo-environment visitors.
 * The token identifies the session as a "prospect" with "demo" access so the
 * SRE Dashboard shows mock data rather than live production metrics.
 *
 * POST /api/demo-auth  → validate demo credentials, set HttpOnly cookie
 * POST /api/demo-auth?action=logout  → clear the cookie
 *
 * JWT payload:
 *   { user_id, role: "prospect", access: "demo", tenant_id }
 *
 * Security notes:
 *   - Token is stored only in an HttpOnly, Secure, SameSite=Lax cookie.
 *   - The token value is NEVER returned in the response body.
 *   - JWT_SECRET must be set as a Netlify environment variable in production.
 *   - No PII is logged — only role, access level, and timestamp.
 */

'use strict';

const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN  || 'https://demo.securebase.tximhotep.com';
const TOKEN_TTL_SECS  = 60 * 60; // 1 hour

// Fail fast if the JWT signing secret is missing rather than fall back to a
// known weak default.  Set JWT_SECRET as a Netlify environment variable.
// A development fallback is accepted only when NODE_ENV is explicitly "development".
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[demo-auth] WARNING: JWT_SECRET not set — using insecure development default. Do NOT use in production.');
  } else {
    throw new Error('JWT_SECRET environment variable is required. Set it in Netlify environment variables.');
  }
}
const SIGNING_SECRET = JWT_SECRET || 'demo-dev-secret-REPLACE-IN-PRODUCTION';

// Demo credentials are loaded from environment variables so they can be
// rotated without a code change.  The defaults below match the values
// shown in Login.jsx for local development convenience only.
const DEMO_EMAIL    = process.env.DEMO_EMAIL    || 'demo@securebase.tximhotep.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'SecureBaseDemo2026!';

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

  // ------------------------------------------------------------------
  // Logout: clear the cookie
  // ------------------------------------------------------------------
  const action = (event.queryStringParameters || {}).action;
  if (action === 'logout') {
    console.log(JSON.stringify({
      event: 'jwt_logout',
      timestamp: new Date().toISOString(),
    }));
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Set-Cookie': 'demo_jwt=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      },
      body: JSON.stringify({ success: true }),
    };
  }

  // ------------------------------------------------------------------
  // Login: validate credentials and issue JWT cookie
  // ------------------------------------------------------------------
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

  const { email, password } = body;

  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    // Audit log — no PII, no credentials
    console.log(JSON.stringify({
      event: 'jwt_auth_failed',
      timestamp: new Date().toISOString(),
    }));
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid credentials' }),
    };
  }

  // Build minimal payload — no PII
  const payload = {
    user_id:   'demo-prospect',
    role:      'prospect',
    access:    'demo',
    tenant_id: 'demo-tenant',
  };

  const token = jwt.sign(payload, SIGNING_SECRET, {
    expiresIn: TOKEN_TTL_SECS,
    issuer:    'securebase-demo',
    audience:  'securebase-portal',
  });

  // Audit log — token value is intentionally omitted
  console.log(JSON.stringify({
    event:     'jwt_issued',
    role:      payload.role,
    access:    payload.access,
    tenant_id: payload.tenant_id,
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
    // Never return the token in the body — only role metadata
    body: JSON.stringify({
      success: true,
      role:    payload.role,
      access:  payload.access,
    }),
  };
};
