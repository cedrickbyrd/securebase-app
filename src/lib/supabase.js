/**
 * @file supabase.js
 * @description Supabase client and MFA helpers for the root app.
 *
 * RETIREMENT NOTICE
 * -----------------
 * Supabase auth is slated for retirement in favour of the AWS API Gateway
 * auth stack already in production:
 *
 *   POST /api/login   → https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod/auth/login
 *   POST /api/signup  → https://api.securebase.tximhotep.com/signup
 *
 * Migration checklist (do NOT remove Supabase until all items are done):
 *   [ ] Replace Login.jsx Supabase signInWithPassword → POST /api/login (JWT cookie)
 *   [ ] Replace Signup.jsx Supabase signUp → POST /api/signup
 *   [ ] Replace useMFAStatus.js Supabase session check → validate JWT from cookie/sessionStorage
 *   [ ] Replace useAuth.js profiles query → /api/profile endpoint
 *   [ ] Replace AuthCallback.jsx OAuth handler → not needed with API-key auth
 *   [ ] Remove MFAChallenge.jsx / MFAEnroll.jsx Supabase MFA → handled server-side
 *   [ ] Remove VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars
 *   [ ] Remove @supabase/supabase-js from package.json
 *
 * The phase3a-portal already uses API-key + JWT auth exclusively (no Supabase).
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    '[SecureBase] Missing Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or deployment config.';
  if (import.meta.env.DEV) {
    throw new Error(msg);
  } else {
    console.error(msg);
  }
}

// 1. Initialize the client
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

// 2. EXPOSE TO WINDOW: This fixes your console "ReferenceError"
if (typeof window !== 'undefined') {
    window.supabase = supabase;
}

/**
 * verifyMFA - Upgrades session from aal1 to aal2
 */
export const verifyMFA = async (factorId, code) => {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId,
    code: code
  });

  if (error) {
    console.error("MFA Verification Failed:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

/**
 * unenrollMFA - Reset for the "Disable MFA" button
 */
export const unenrollMFA = async (factorId) => {
  const { data, error } = await supabase.auth.mfa.unenroll({
    factorId: factorId
  });

  if (error) {
    console.error("MFA Unenrollment Failed:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
