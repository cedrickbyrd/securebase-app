import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, Shield, Loader, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MFAEnrollment({ onEnrollSuccess }) {
  const [step, setStep] = useState('start'); // 'start' | 'scan' | 'verify'
  const [enrollData, setEnrollData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'SecureBase',
        friendlyName: 'SecureBase Auth'
      });
      if (enrollError) throw enrollError;
      setEnrollData(data);
      setStep('scan');
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
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
      if (challenge.error) throw challenge.error;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challenge.data.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;
      onEnrollSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(enrollData.totp.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-12 text-center">
      <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
        <Shield className="text-white w-6 h-6" />
      </div>

      {step === 'start' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Enable MFA</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            To access the SecureBase Compliance Vault, you must secure your account with a second factor. 
            We recommend using <strong>Authy</strong>.
          </p>
          <button 
            onClick={startEnrollment} 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : "Start Setup"}
          </button>
        </div>
      )}

      {step === 'scan' && (
        <div className="flex flex-col items-center space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Scan QR Code</h2>
          <div className="p-4
