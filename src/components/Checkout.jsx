import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, ArrowRight, Loader, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const PLAN_DETAILS = {
  Starter: {
    price: '$49/mo',
    description: '1 AWS Landing Zone · Basic Compliance Pack · Email Support',
    gradient: 'from-slate-600 to-slate-800',
  },
  Professional: {
    price: '$199/mo',
    description: '5 AWS Landing Zones · Full SOC 2 · Priority Support',
    gradient: 'from-[#667eea] to-[#764ba2]',
  },
};

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const planName = searchParams.get('plan') || 'Professional';
  const priceId = searchParams.get('priceId') || '';

  const plan = PLAN_DETAILS[planName] || PLAN_DETAILS.Professional;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Show success state if redirected back after Stripe
  useEffect(() => {
    if (searchParams.get('session_id')) {
      setSuccess(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const origin = window.location.origin;
      const response = await fetch('/.netlify/functions/securebase-checkout-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          successUrl: `${origin}/checkout?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(planName)}`,
          cancelUrl: `${origin}/pricing`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout. Please try again.');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">You're in!</h1>
          <p className="text-slate-500 text-sm mb-8">
            Your <span className="font-bold text-slate-700">{planName}</span> subscription is active.
            Our team will reach out within 24 hours to begin your AWS onboarding.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
          >
            Sign In to Your Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
            aria-label="SecureBase home"
          >
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold text-slate-900">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Secured by Stripe
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12 items-start">
        {/* Plan Summary */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            You're signing up for
          </p>
          <div className={`bg-gradient-to-br ${plan.gradient} rounded-2xl p-6 text-white mb-6 shadow-lg`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black">{planName}</span>
            </div>
            <p className="text-3xl font-black mb-1">{plan.price}</p>
            <p className="text-white/75 text-sm">{plan.description}</p>
          </div>

          <ul className="space-y-3 text-sm text-slate-600">
            {[
              '48-hour AWS onboarding',
              'No contracts — cancel anytime',
              'SOC 2 monitoring from day one',
              'Encrypted audit trail included',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Checkout Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-black text-slate-900 mb-1">Complete your order</h2>
          <p className="text-slate-500 text-sm mb-6">
            You'll be redirected to Stripe's secure payment page.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="checkout-email"
                className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1 block mb-1"
              >
                Work Email
              </label>
              <input
                id="checkout-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900 text-sm"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3.5 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              By continuing you agree to our{' '}
              <a href="#" className="underline hover:text-[#667eea]">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="underline hover:text-[#667eea]">Privacy Policy</a>.
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            Payments processed securely by Stripe
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
