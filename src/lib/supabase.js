import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * verifyMFA
 * @param {string} factorId - The ID returned from the enrollment step
 * @param {string} code - The 6-digit code from the user's authenticator app
 */
const verifyMFA = async (factorId, code) => {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId,
    code: code
  });

  if (error) {
    // If the code is expired or wrong, this will trigger
    console.error("MFA Verification Failed:", error.message);
    return { success: false, error };
  }

  // Success! The user's session is now upgraded to AAL2 (Level 2)
  console.log("MFA Active:", data);
  return { success: true, data };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
