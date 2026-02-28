import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MFAEnrollment({ onEnrollSuccess }) {
  const [step, setStep] = useState('start'); // start, qr, verify
  const [enrollData, setEnrollData] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startEnrollment = async () => {
  setLoading(true);
  setError(null);
  
  try {
    // Check if we actually have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session || sessionError) {
      throw new Error("No active session found. Please sign in again.");
    }

    // Now proceed with the enrollment (Self-healing included)
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const staleFactors = factors?.all?.filter(f => f.status === 'unverified') || [];
    for (const factor of staleFactors) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'SecureBase',
      friendlyName: 'Authy'
    });

    if (enrollError) throw enrollError;
    
    setEnrollData(data);
    setStep('qr');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
  
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: enrollData.totp.challenge_id,
        code
      });

      if (verifyError) throw verifyError;
      onEnrollSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-12 text-center">
      {step === 'start' && (
        <>
          <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Enable MFA</h2>
          <p className="text-slate-500 text-sm mt-2 mb-8">
            To access the SecureBase Compliance Vault, you must secure your account with a second factor. We recommend using **Authy**.
          </p>
          <button
            onClick={startEnrollment}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="animate-spin w-5 h-5" /> : "Start Setup"}
          </button>
        </>
      )}

      {step === 'qr' && enrollData && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Scan QR Code</h2>
          <p className="text-slate-500 text-sm mb-6">Open Authy and scan this code to link SecureBase.</p>
          
          <div className="bg-white p-4 inline-block border-2 border-slate-100 rounded-2xl mb-6">
           <<QRCodeSVG 
  value={enrollData.totp.qr_code} 
  size={200}
  level="L" // Change from "H" to "L" to fix 'Data too long'
  includeMargin={true}
/>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              maxLength="6"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none"
              required
            />
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold justify-center bg-red-50 p-2 rounded-lg">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex justify-center items-center gap-2"
            >
              {loading ? <Loader className="animate-spin w-5 h-5" /> : "Verify & Enable"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
