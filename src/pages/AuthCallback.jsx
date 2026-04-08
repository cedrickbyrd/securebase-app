import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isLinkedInTraffic, buildAttributionMetadata } from '../utils/trackingUtils';
import { trackEvent } from '../utils/analytics';

const IS_DEV = import.meta.env.DEV;

/**
 * AuthCallback
 *
 * Handles the redirect back from Supabase after:
 *  - A magic-link email click, or
 *  - A LinkedIn (or other) OAuth provider authorisation.
 *
 * Supabase appends the session tokens as URL hash fragments (#access_token=…)
 * or query parameters (?code=…).  The Supabase JS client resolves the session
 * automatically when the page loads; we just need to wait for it and then
 * redirect the user to the appropriate next step.
 *
 * Flow:
 *   1. Page mounts → wait for Supabase to exchange tokens.
 *   2. On success → attach attribution metadata to the Supabase user profile.
 *   3. Redirect to /checkout with pilot pricing when eligible, otherwise /checkout.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      // Give Supabase a moment to exchange the code / hash for a session.
      // getSession() returns the session that was just established by the
      // token exchange triggered on page load.
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError) {
        if (IS_DEV) console.error('AuthCallback: session error', sessionError);
        setError('Authentication failed. Please try signing in again.');
        return;
      }

      if (!data?.session) {
        // Session not yet ready — listen for the auth state change event.
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;

          if (event === 'SIGNED_IN' && session) {
            listener.subscription.unsubscribe();
            handleAuthSuccess(session);
          } else if (event === 'SIGNED_OUT') {
            listener.subscription.unsubscribe();
            setError('Authentication failed. Please try signing in again.');
          }
        });
        return;
      }

      handleAuthSuccess(data.session);
    };

    const handleAuthSuccess = async (session) => {
      if (cancelled) return;

      trackEvent('Signup', 'AuthComplete', isLinkedInTraffic() ? 'linkedin' : 'organic');

      // Attach attribution metadata to the user profile (best-effort).
      try {
        const meta = buildAttributionMetadata();
        if (Object.values(meta).some(Boolean)) {
          await supabase.auth.updateUser({ data: meta });
        }
      } catch (metaErr) {
        // Non-fatal — attribution enrichment failure should not block the user.
        if (IS_DEV) console.warn('AuthCallback: failed to update user metadata', metaErr);
      }

      // Build checkout URL with appropriate plan
      const pilotEligible = isLinkedInTraffic();
      const pilotPriceId = import.meta.env.VITE_STRIPE_PILOT_PRICE_ID || 'price_pilot_monthly_2000';
      const checkoutPath = pilotEligible
        ? `/checkout?plan=pilot&planName=Pilot+Program&priceId=${encodeURIComponent(pilotPriceId)}`
        : '/checkout';

      navigate(checkoutPath, { replace: true });
    };

    resolveSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            onClick={() => navigate('/signup')}
            className="text-[#667eea] font-semibold hover:underline text-sm"
          >
            Back to sign-up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader className="animate-spin text-[#667eea] w-10 h-10 mx-auto mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
          Completing sign-in…
        </p>
      </div>
    </div>
  );
}
