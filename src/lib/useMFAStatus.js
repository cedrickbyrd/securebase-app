import { useEffect, useState } from 'react';

/**
 * useMFAStatus
 * JWT-based auth state derived from sessionStorage/localStorage.
 * Supabase dependency removed — auth is handled by securebase-production-auth-v2 Lambda.
 */
export function useMFAStatus() {
  const [aal, setAal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function checkAuth() {
      try {
        const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sb_token');
        const userEmail = localStorage.getItem('userEmail');

        if (!token || !userEmail) {
          setAal('none');
        } else {
          // Decode JWT payload to check MFA status without a network call.
          // The Lambda stamps mfa_enabled in the token payload.
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setAal(payload?.mfa_enabled ? 'aal2' : 'aal1');
          } catch {
            setAal('aal1'); // malformed token — treat as password-only session
          }
        }
      } catch {
        setAal('none');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return { aal, isMFA: aal === 'aal2', isLoading };
}
