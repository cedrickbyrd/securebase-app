import React, { useState } from 'react';
import { supabase, verifyMFA } from '../lib/supabase';
import { ShieldCheck, Loader, AlertCircle } from 'lucide-react';

export default function MFAChallenge({ onSuccess }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Get the list of factors (TOTP, etc.)
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      // 2. Find the active TOTP factor
      const totpFactor = factors.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

      if (!totpFactor) {
        setError("No verified MFA found. Please set up MFA in your profile settings.");
        setLoading(false);
        return;
      }

      // 3. Challenge and Verify
      const result = await verifyMFA(totpFactor.id, code);
      
      if (result.success) {
        onSuccess(); // This triggers the tab switch back to 'compliance'
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl max-w-md mx-auto animate-in fade-in zoom-in-95">
      <div className="flex flex-col items-center text-center gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-full">
          <ShieldCheck className="text-blue-600 w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black">Identity Verification</h2>
          <p className="text-slate-500 text-sm">Accessing the Compliance Vault requires Multi-Factor Authentication.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 text-center">
            Enter 6-Digit Authenticator Code
          </label>
          <input
            type="text"
            maxLength="6"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000 000"
            className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none transition"
            required
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader className="animate-spin" /> : 'Verify and Unlock Vault'}
        </button>
      </form>
    </div>
  );
}
