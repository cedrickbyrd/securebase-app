import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader, CheckCircle, ArrowLeft } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { trackCheckoutStarted } from '../utils/analytics';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const PLAN_LABELS = {
  standard: 'Standard',
  fintech: 'Fintech / Healthcare',
  enterprise: 'Enterprise / FedRAMP',
};

const PLAN_PRICES = {
  standard: 499,
  fintech: 1499,
  enterprise: 3999,
};

function CheckoutForm({ plan, email, setEmail, error, setError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      // 1. Request the Session from your Netlify Function
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.id,
          planName: plan.name,
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const { sessionId } = await response.json();

      // 2. Redirect to Stripe's hosted checkout page
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        setError(result.error.message);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Checkout Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="checkout-email"
          className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
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
        disabled={isProcessing || !stripe}
        className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader className="animate-spin w-5 h-5" />
            Redirecting to Stripe…
          </>
        ) : (
          <>
            Continue to Payment
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </>
        )}
      </button>
    </form>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const planKey = searchParams.get('plan') || 'standard';
  const priceId = searchParams.get('priceId') || '';
  const planName = searchParams.get('planName') || PLAN_LABELS[planKey] || planKey;

  const plan = { id: priceId, name: planName };

  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    trackCheckoutStarted(planKey);
  }, [planKey]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3"
          >
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#667eea] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Plan summary */}
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs uppercase tracking-widest font-bold mb-1">Selected Plan</p>
                <p className="text-xl font-bold">{PLAN_LABELS[planKey] || planName}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">
                  ${PLAN_PRICES[planKey]?.toLocaleString() ?? '—'}
                </p>
                <p className="text-purple-200 text-xs">/month</p>
              </div>
            </div>
          </div>

          {/* Checkout form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Start your subscription</h1>
            <p className="text-slate-500 text-sm mb-6">
              Enter your work email. You will be redirected to Stripe to complete payment securely.
            </p>

            <Elements stripe={stripePromise}>
              <CheckoutForm
                plan={plan}
                email={email}
                setEmail={setEmail}
                error={error}
                setError={setError}
              />
            </Elements>

            {/* Trust signals */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex flex-col gap-2">
                {[
                  'Secured by Stripe — PCI DSS Level 1',
                  '14-day free trial, cancel anytime',
                  'SOC 2 Type II certified infrastructure',
                ].map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-slate-500">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
