import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader, CheckCircle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  captureUtmParams,
  isLinkedInTraffic,
  getRemainingPilotSpots,
} from '../utils/trackingUtils';
import { trackEvent } from '../utils/analytics';

const IS_DEV = import.meta.env.DEV;

const TRUST_BADGES = [
  'SOC 2 Type II certified infrastructure',
  'No credit card required for trial',
  '7-day free trial, cancel anytime',
];

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Attribution / pilot state
  const [linkedIn, setLinkedIn] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState(10);

  useEffect(() => {
    // Capture UTM params on landing (first-touch attribution).
    captureUtmParams();
    const fromLinkedIn = isLinkedInTraffic();
    setLinkedIn(fromLinkedIn);
    setSpotsLeft(getRemainingPilotSpots());

    trackEvent('Signup', 'PageView', fromLinkedIn ? 'linkedin' : 'organic');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Magic link ────────────────────────────────────────────────────────────

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (otpError) throw otpError;

      setMagicLinkSent(true);
      trackEvent('Signup', 'MagicLinkSent', linkedIn ? 'linkedin' : 'organic');
    } catch (err) {
      if (IS_DEV) console.error('Magic link error:', err);
      setError(err.message || 'Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── LinkedIn OAuth ────────────────────────────────────────────────────────

  const handleLinkedInOAuth = async () => {
    setError(null);
    setOauthLoading(true);

    try {
      const origin = window.location.origin;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${origin}/auth/callback`,
          scopes: 'openid email profile',
        },
      });

      if (oauthError) throw oauthError;

      trackEvent('Signup', 'LinkedInOAuthStarted', 'oauth');
      // Supabase redirects the browser — no further action needed.
    } catch (err) {
      if (IS_DEV) console.error('LinkedIn OAuth error:', err);
      setError(err.message || 'LinkedIn sign-in failed. Please try again.');
      setOauthLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                TxImhotep LLC
              </div>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4">

          {/* LinkedIn pilot discount banner */}
          {linkedIn && (
            <div className="bg-gradient-to-r from-[#0A66C2] to-[#0077B5] rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 shrink-0 mt-0.5 text-yellow-300" />
                <div>
                  <p className="font-bold text-base">Welcome, LinkedIn Member!</p>
                  <p className="text-blue-100 text-sm mt-0.5">
                    Your <span className="font-bold text-white">50% Pilot Discount</span> is active —
                    $2,000/month instead of $4,000.
                  </p>
                  <p className="text-blue-100 text-xs mt-2 font-semibold">
                    ⚡ Only <span className="text-white">{spotsLeft} of 10</span> pilot spots remaining
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sign-up card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              {linkedIn ? 'Claim your pilot spot' : 'Get started for free'}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              {linkedIn
                ? 'One click to reserve your discounted pilot seat.'
                : 'No password required — we'll send you a magic link.'}
            </p>

            {/* Success state: magic link sent */}
            {magicLinkSent ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-bold text-slate-900 text-lg">Check your inbox!</p>
                <p className="text-slate-500 text-sm mt-1">
                  We sent a magic link to <span className="font-semibold">{email}</span>.
                  Click it to complete your sign-up — no password needed.
                </p>
                <p className="text-slate-400 text-xs mt-4">
                  Didn't receive it?{' '}
                  <button
                    onClick={() => setMagicLinkSent(false)}
                    className="text-[#667eea] font-semibold hover:underline"
                  >
                    Resend
                  </button>
                </p>
              </div>
            ) : (
              <>
                {/* LinkedIn OAuth button */}
                <button
                  type="button"
                  onClick={handleLinkedInOAuth}
                  disabled={oauthLoading}
                  className="w-full flex items-center justify-center gap-3 bg-[#0A66C2] hover:bg-[#0077B5] text-white py-3 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-4"
                >
                  {oauthLoading ? (
                    <Loader className="animate-spin w-5 h-5" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  )}
                  {oauthLoading ? 'Redirecting…' : 'Continue with LinkedIn'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-semibold uppercase">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Magic link form */}
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                    >
                      Work Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                    />
                  </div>

                  {error && (
                    <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-100 p-3 rounded-lg">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin w-5 h-5" />
                        Sending link…
                      </>
                    ) : (
                      'Send Magic Link'
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Trust signals */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              {TRUST_BADGES.map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-xs text-slate-500">{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Already have an account */}
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-[#667eea] font-semibold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
