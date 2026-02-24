import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 1. Initialize the client first
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * verifyMFA
 * This upgrades the session from aal1 to aal2
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

  console.log("MFA Active:", data);
  return { success: true, data };
};

/**
 * unenrollMFA
 * Useful for the "Disable MFA" button in settings
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
