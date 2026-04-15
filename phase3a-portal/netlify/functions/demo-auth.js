/**
 * demo-auth — Netlify serverless function
 *
 * Validates demo credentials and returns a short-lived JWT together with a
 * customer object in the JSON response body.  This allows the validate-demo
 * workflow and portal clients to consume the token directly without parsing
 * a Set-Cookie header.
 *
 * Five built-in demo accounts are supported — they mirror the credentials
 * defined in landing-zone/modules/demo-backend/lambda/auth.py so that both
 * the Netlify function and the AWS Lambda behave consistently.
 *
 * POST /api/demo-auth
 *   Body: { action: "login", email, password }
 *   Returns: { token, customer: { id, name, email, tier, isEnterprise }, expires_in }
 *
 * POST /api/demo-auth?action=logout
 *   Returns: { success: true }
 *
 * OPTIONS /api/demo-auth → CORS preflight
 *
 * JWT signing:
 *   RS256 — when RSA_PRIVATE_KEY env var holds a PEM-encoded RSA private key
 *   HS256 — fallback when only JWT_SECRET is available (acceptable for demo)
 *
 * Environment variables:
 *   JWT_SECRET      — HMAC signing secret; required when RSA_PRIVATE_KEY is absent
 *   RSA_PRIVATE_KEY — PEM-encoded RSA private key for RS256 signing (optional)
 *   ALLOWED_ORIGIN  — CORS allowed origin (default: https://demo.securebase.tximhotep.com)
 */

'use strict';

const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';
const TOKEN_TTL_SECS = 24 * 60 * 60; // 24 hours

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':     'Content-Type,Authorization',
  'Access-Control-Allow-Methods':     'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

// ---------------------------------------------------------------------------
// Demo credentials — safe for demo environment
// Mirrors landing-zone/modules/demo-backend/lambda/auth.py DEMO_CREDENTIALS
// ---------------------------------------------------------------------------

const DEMO_CREDENTIALS = {
  'admin@healthcorp.example.com': {
    password:     'demo-healthcare-2026',
    customerId:   'demo-customer-001',
    name:         'HealthCorp Medical Systems',
    tier:         'healthcare',
    isEnterprise: true,
  },
  'admin@fintechai.example.com': {
    password:     'demo-fintech-2026',
    customerId:   'demo-customer-002',
    name:         'FinTechAI Analytics',
    tier:         'fintech',
    isEnterprise: true,
  },
  'admin@startupmvp.example.com': {
    password:     'demo-standard-2026',
    customerId:   'demo-customer-003',
    name:         'StartupMVP Inc',
    tier:         'standard',
    isEnterprise: false,
  },
  'admin@govcontractor.example.com': {
    password:     'demo-government-2026',
    customerId:   'demo-customer-004',
    name:         'GovContractor Defense Solutions',
    tier:         'government',
    isEnterprise: true,
  },
  'admin@saasplatform.example.com': {
    password:     'demo-fintech2-2026',
    customerId:   'demo-customer-005',
    name:         'SaaSPlatform Cloud Services',
    tier:         'fintech',
    isEnterprise: true,
  },
};

// ---------------------------------------------------------------------------
// JWT signing helpers
// ---------------------------------------------------------------------------

/**
 * Resolve signing key and algorithm.
 * Prefers RS256 with RSA_PRIVATE_KEY; falls back to HS256 with JWT_SECRET.
 * Throws if neither is configured (outside development mode).
 */
function getSigningConfig() {
  const rsaKey = process.env.RSA_PRIVATE_KEY;
  if (rsaKey) {
    return { key: rsaKey, algorithm: 'RS256' };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[demo-auth] WARNING: JWT_SECRET not set — using insecure development default. Do NOT use in production.',
      );
      return { key: 'demo-dev-secret-REPLACE-IN-PRODUCTION', algorithm: 'HS256' };
    }
    throw new Error('JWT_SECRET environment variable is required.');
  }

  return { key: secret, algorithm: 'HS256' };
}

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

  // Logout — stateless; clear cookie as a courtesy
  const queryAction = (event.queryStringParameters || {}).action;
  if (queryAction === 'logout') {
    console.log(JSON.stringify({ event: 'jwt_logout', timestamp: new Date().toISOString() }));
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

  // Parse request body
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

  // Accept action in body (validate-demo.yml sends {action:"login",...})
  const bodyAction = body.action || 'login';
  if (bodyAction !== 'login') {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unsupported action' }),
    };
  }

  const email    = (body.email    || '').trim().toLowerCase();
  const password =  body.password || '';

  // Validate credentials — no PII in logs
  const creds = DEMO_CREDENTIALS[email];
  if (!creds || creds.password !== password) {
    console.log(JSON.stringify({ event: 'jwt_auth_failed', timestamp: new Date().toISOString() }));
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid credentials' }),
    };
  }

  // Resolve signing key (RS256 preferred, HS256 fallback)
  let signingConfig;
  try {
    signingConfig = getSigningConfig();
  } catch (err) {
    console.error('[demo-auth] Signing configuration error:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    sub:           email,
    customer_id:   creds.customerId,
    customer_name: creds.name,
    tier:          creds.tier,
    isEnterprise:  creds.isEnterprise,
    iat:           now,
    exp:           now + TOKEN_TTL_SECS,
  };

  let token;
  try {
    token = jwt.sign(jwtPayload, signingConfig.key, {
      algorithm: signingConfig.algorithm,
      issuer:    'securebase-demo',
      audience:  'securebase-portal',
    });
  } catch (err) {
    console.error('[demo-auth] Token signing failed:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }

  // Audit log — token value intentionally omitted
  console.log(JSON.stringify({
    event:        'jwt_issued',
    algorithm:    signingConfig.algorithm,
    tier:         creds.tier,
    isEnterprise: creds.isEnterprise,
    ttl_secs:     TOKEN_TTL_SECS,
    timestamp:    new Date().toISOString(),
  }));

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      customer: {
        id:           creds.customerId,
        name:         creds.name,
        email,
        tier:         creds.tier,
        isEnterprise: creds.isEnterprise,
      },
      expires_in: TOKEN_TTL_SECS,
    }),
  };
};
