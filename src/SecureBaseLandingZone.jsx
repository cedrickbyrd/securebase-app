import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight, Loader, Lock, ShieldCheck } from 'lucide-react';
import 'antd/dist/reset.css';
import ComplianceScreen from './components/compliance/ComplianceScreen';
import MFAEnrollment from './components/auth/MFAEnrollment';
import AdminLink from './components/navigation/AdminLink'; 
import { supabase } from './lib/supabase';

// --- Step 1: Login Component ---
const AuthLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-12">
      <div className="bg-slate-100 text-slate-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6">
        <Lock className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold mb-2 text-center text-slate-900">Sign in to SecureBase</h2>
      <p className="text-slate-500 text-sm text-center mb-8">Access the Compliance Vault and Audit Reports</p>
      
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Work Email</label>
          <input 
            type="email" placeholder="name@company.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required 
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Password</label>
          <input 
            type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required 
          />
        </div>
        {error && <p className="text-red-500 text-xs font-semibold bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-2">
          {loading ? <Loader className="animate-spin w-5 h-5" /> : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

// --- Step 2: MFA Challenge Component ---
const MFAChallenge = ({ onVerifySuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0]; 
      if (!factor) throw new Error("MFA Factor missing.");

      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code
      });

      if (verifyError) throw verifyError;
      onVerifySuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-12 text-center">
      <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded
