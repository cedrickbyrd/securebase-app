import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { trackPurchase } from '../utils/analytics';
import { Shield, CheckCircle, Mail } from 'lucide-react';

const ONE_TIME_PLANS = new Set(['pilot_compliance', 'hipaa_assessment']);

export default function ThankYou() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plan = params.get('plan') || 'unknown';
  const isOneTime = ONE_TIME_PLANS.has(plan);

  const oneTimeBodyByPlan = {
    pilot_compliance: 'Your Compliance Jumpstart assessment has been received. Our team will reach out within 1 business day to kick off your SOC 2 gap analysis.',
    hipaa_assessment: "Your HIPAA Readiness Assessment has been confirmed. Our team will reach out within 1 business day to begin your technical safeguard audit. You've also been enrolled in the Healthcare tier — $1,995 will be credited to your first invoice.",
  };

  const heading = isOneTime ? 'Purchase confirmed.' : "You're in.";
  const body = isOneTime
    ? (oneTimeBodyByPlan[plan] || 'Your purchase has been confirmed. Our team will be in touch shortly.')
    : 'Your SecureBase environment is being provisioned. Check your email — your login link and sovereign key will arrive within a few minutes.';
  const emailLine = isOneTime
    ? 'Check your inbox for your purchase confirmation'
    : 'Check your inbox to access your dashboard';
  const ctaLabel = isOneTime ? 'Back to Home' : 'Go to Login';
  const ctaPath = isOneTime ? '/' : '/login';

  useEffect(() => {
    const sessionId = params.get('session_id');
    const rawValue = parseFloat(params.get('value'));
    const value = isNaN(rawValue) ? 0 : rawValue;
    if (sessionId) {
      trackPurchase(sessionId, plan, value);
    }
  }, [params, plan]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-3 rounded-xl shadow-md">
            <Shield className="text-white w-8 h-8" />
          </div>
        </div>
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{heading}</h1>
        <p className="text-slate-500 mb-6">{body}</p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
          <Mail className="w-4 h-4" />
          <span>{emailLine}</span>
        </div>
        <button
          onClick={() => navigate(ctaPath)}
          className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
