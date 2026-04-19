/**
 * Redirect shim — forwards portal users to the canonical marketing-site checkout.
 *
 * The one true checkout lives at https://securebase.tximhotep.com/checkout
 * (src/components/Checkout.jsx on the marketing site). This component exists
 * only to preserve any bookmarked or in-app navigations to the portal's
 * /checkout route; it immediately redirects with plan context intact.
 *
 * Exception: in demo mode the user is redirected internally to /contact-sales
 * instead, keeping demo traffic off the live Stripe checkout.
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { PRICING_TIERS } from '../config/live-config';
import { isDemoMode } from '../utils/demoData';

const MARKETING_CHECKOUT = 'https://securebase.tximhotep.com/checkout';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Prefer location.state (set by Pricing.jsx navigate) then fall back to query params
  const locationState = location.state || {};
  const plan = locationState.tier || searchParams.get('plan') || 'standard';
  const priceId = locationState.priceId || searchParams.get('priceId') || '';
  // Resolve planName for the redirect URL. The marketing site reads it from
  // the query string, so we derive it here when navigation came via
  // location.state (Pricing.jsx navigate) rather than an explicit query param.
  const planName =
    searchParams.get('planName') || PRICING_TIERS[plan]?.name || plan;

  useEffect(() => {
    if (isDemoMode()) {
      // Demo environment — stay within the portal and avoid live Stripe
      navigate('/contact-sales', { replace: true });
      return;
    }

    // Build the redirect URL with context preserved
    const params = new URLSearchParams();
    if (plan) params.set('plan', plan);
    if (priceId) params.set('priceId', priceId);
    if (planName) params.set('planName', planName);

    const target = `${MARKETING_CHECKOUT}?${params.toString()}`;
    // Use replace() so the portal /checkout shim is not stored in browser
    // history — navigating back would only trigger the redirect again.
    window.location.replace(target);
  }, [navigate, plan, priceId, planName]);

  // Minimal loading screen shown while the redirect is in flight
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 rounded-2xl shadow-lg">
          <Shield className="text-white w-8 h-8" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#667eea] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-semibold text-sm">Redirecting to checkout…</p>
        </div>
      </div>
    </div>
  );
}
