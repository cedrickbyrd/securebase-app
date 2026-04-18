import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { trackPurchase } from '../utils/analytics';
import { Shield, CheckCircle, Mail } from 'lucide-react';

export default function ThankYou() {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-3 rounded-xl shadow-md">
            <Shield className="text-white w-8 h-8" />
          </div>
        </div>
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">You're in.</h1>
        <p className="text-slate-500 mb-6">
          Your SecureBase environment is being provisioned. Check your email —
          your login link and sovereign key will arrive within a few minutes.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
          <Mail className="w-4 h-4" />
          <span>Check your inbox to access your dashboard</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}
