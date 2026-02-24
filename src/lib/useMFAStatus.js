import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useMFAStatus() {
  const [aal, setAal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkMFA() {
      const { data: { session } } = await supabase.auth.getSession();
      
      // aal1 = password only, aal2 = MFA verified
      const level = session?.user?.app_metadata?.aal || 'aal1';
      setAal(level);
      setIsLoading(false);
    }

    checkMFA();

    // Listen for auth changes (like if they just finished verifying MFA)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAal(session.user.app_metadata?.aal || 'aal1');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { aal, isMFA: aal === 'aal2', isLoading };
}
