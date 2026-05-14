import { useEffect, useState } from 'react';

/**
 * useMFAStatus
 * Replaces the former Supabase-based AAL check.
 * Reads the JWT stored in localStorage by Login.jsx and derives
 * authentication state from it — no Supabase dependency.
 */
export function useMFAStatus() {
  const [aal, setAal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function checkAuth() {
      try {
        const token = localStorage.getItem('sb_token');
        const user = JSON.parse(localStorage.getItem('sb_user') || 'null');

        if (!token || !user) {
          setAal('none');
        } else {
          // If MFA was verified the Lambda returns mfa_enabled: true on the user object.
          // We treat mfa_enabled as aal2, password-only as aal1.
          setAal(user.mfa_enabled ? 'aal2' : 'aal1');
        }
      } catch {
        setAal('none');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();

    // Re-check on storage events (e.g. logout in another tab)
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return { aal, isMFA: aal === 'aal2', isLoading };
}
