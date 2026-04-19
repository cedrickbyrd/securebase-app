/**
 * jwtService — Frontend JWT helper for demo authentication
 *
 * The JWT itself is stored in an HttpOnly cookie set by the Netlify
 * `demo-auth` function — it is never accessible from JavaScript.
 *
 * This module only manages:
 *   - Calling the demo-auth endpoint to obtain/clear the cookie
 *   - Storing non-sensitive session state (role, access level) in
 *     sessionStorage so components can gate UI without reading the token
 *
 * HIPAA note: no PII (email, name, org) is stored by this service.
 * Non-sensitive identifiers (role, access) are kept in sessionStorage
 * which is scoped to the current tab and cleared on close.
 */

const DEMO_AUTH_URL  = '/api/demo-auth';
const SESSION_KEY    = 'sb_jwt_session';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function setSession(role, access) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, access }));
  } catch {
    // sessionStorage unavailable — degrade gracefully
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request a demo JWT cookie from the server.
 * On success the server sets an HttpOnly cookie; this function stores only
 * the non-sensitive role metadata in sessionStorage.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, role: string, access: string}>}
 * @throws {Error} when credentials are rejected or the network fails
 */
export async function loginDemo(email, password) {
  const response = await fetch(DEMO_AUTH_URL, {
    method:      'POST',
    credentials: 'include', // include cookies in the request/response
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.error
      ? `Demo login failed (HTTP ${response.status}): ${data.error}`
      : `Demo login failed with status ${response.status}. Please verify credentials or contact support.`;
    const err = new Error(message);
    // Structured flag lets callers distinguish HTTP-level server errors from
    // lower-level network/fetch failures without relying on message parsing.
    err.isServerError = true;
    err.statusCode = response.status;
    throw err;
  }

  // Store only non-secret session metadata (role, access level)
  setSession(data.role, data.access);
  return data;
}

/**
 * Clear the HttpOnly JWT cookie and local session state.
 *
 * @returns {Promise<void>}
 */
export async function logoutDemo() {
  try {
    await fetch(`${DEMO_AUTH_URL}?action=logout`, {
      method:      'POST',
      credentials: 'include',
    });
  } catch (err) {
    // Best-effort — always clear local state regardless.
    // Log so deployment issues are visible in the browser console.
    console.warn('[jwtService] logout request failed (non-blocking):', err?.message);
  }
  clearSession();
}

/**
 * Returns the current session metadata (role, access) from sessionStorage,
 * or null if no active demo session exists.
 *
 * @returns {{ role: string, access: string } | null}
 */
export function getDemoSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if there is an active demo session in the current tab.
 * Does NOT verify the HttpOnly cookie — use a server-side endpoint for that.
 *
 * @returns {boolean}
 */
export function hasDemoSession() {
  return getDemoSession() !== null;
}
