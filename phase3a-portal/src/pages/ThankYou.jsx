import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trackPurchase } from '../utils/analytics';

const STEPS = [
  { icon: '💳', label: 'Payment received' },
  { icon: '🚀', label: 'Provisioning your AWS environment' },
  { icon: '🔑', label: 'Generating your sovereign key' },
  { icon: '📧', label: 'Sending your login link' },
];

const ThankYou = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = params.get('session_id');
    const plan = params.get('plan') || 'unknown';
    const rawValue = parseFloat(params.get('value'));
    const value = isNaN(rawValue) ? 0 : rawValue;
    if (sessionId) {
      trackPurchase(sessionId, plan, value);
    }
  }, [params]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-4xl font-bold text-white mb-3">You&apos;re in.</h1>
        <p className="text-lg text-blue-100 mb-8">
          Your SecureBase environment is being provisioned.
          Your login link and sovereign key will arrive by email in a few minutes.
        </p>

        {/* Provisioning steps */}
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 mb-8 text-left space-y-3">
          {STEPS.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="text-xl">{step.icon}</span>
              <span className="text-white text-sm font-medium">{step.label}</span>
              <span className="ml-auto text-green-300 text-xs font-semibold">✓</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('/login')}
          className="w-full bg-white text-[#667eea] font-bold py-3 px-8 rounded-xl text-base shadow-lg hover:bg-blue-50 transition mb-4"
        >
          Go to Login
        </button>

        <p className="text-blue-200 text-xs">
          Didn&apos;t receive an email?{' '}
          <a
            href="https://calendly.com/cedrickjbyrd/white-glove-pilot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-300 hover:text-yellow-200 underline font-semibold"
          >
            Schedule a call
          </a>{' '}
          and we&apos;ll set you up manually.
        </p>
      </div>
    </div>
  );
};

export default ThankYou;
