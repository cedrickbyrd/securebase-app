import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 1. Initialize the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
