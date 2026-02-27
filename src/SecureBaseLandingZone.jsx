import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight, Loader } from 'lucide-react';
import 'antd/dist/reset.css';
import ComplianceScreen from './components/compliance/ComplianceScreen';
import { supabase } from './lib/supabase';
import MFAEnrollment from './components/auth/MFAEnrollment'; // Import Step 3

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
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const factor = factors.totp[0]; 
      if (!factor) throw new Error("No MFA factor found. Please enroll first.");

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: code
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
      <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
        <Shield className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Security Check</h2>
      <p className="text-slate-500 text-sm mt-2 mb-6">Enter the 6-digit code from your authenticator app.</p>
      
      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          maxLength="6"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
          required
        />
        {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {loading ? <Loader className="w-5 h-5 animate-spin" /> : "Verify & Access Vault"}
        </button>
      </form>
    </div>
  );
};

// --- Main Component ---
export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    const fetchLatestAudit = async (token) => {
      setLoading(true);
      try {
        const response = await fetch('/.netlify/functions/get-audit-report', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error("Vault fetch failed");
        const data = await response.json();
        setReport(data);
      } catch (err) {
        console.error("SecureBase: Vault access error:", err);
      } finally {
        setLoading(false);
      }
    };

    const checkMFAAndFetch = async (session) => {
      // 1. Check if factors are enrolled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasMFA = factors?.totp && factors.totp.length > 0;

      if (!hasMFA) {
        setActiveTab('mfa-enroll');
        setLoading(false);
        return;
      }

      // 2. Check current assurance level
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        console.error("MFA Level Check Error:", error);
        return;
      }

      if (data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel) {
        setActiveTab('mfa-challenge');
        setLoading(false);
      } else {
        fetchLatestAudit(session.access_token);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        checkMFAAndFetch(session);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabChange('overview')}>
            <div className="bg-blue-600 p-2 rounded-lg"><Shield className="text-white w-6 h-6" /></div>
            <div>
              <div className="text-xl font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <button onClick={() => handleTabChange('overview')} className={`text-sm font-semibold ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-600'}`}>Overview</button>
            <button onClick={() => handleTabChange('compliance')} className={`text-sm font-semibold ${activeTab === 'compliance' ? 'text-blue-600' : 'text-slate-600'}`}>Compliance</button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase ml-4">Sign Out</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'overview' && (
          <div className="text-center pt-12">
            <h1 className="text-5xl md:text-7xl font-black mb-8">Audit-Ready AWS <br /><span className="text-blue-600">In Under 48 Hours</span></h1>
            <button onClick={() => handleTabChange('compliance')} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg mx-auto flex items-center gap-2">
              View Compliance Vault <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {activeTab === 'mfa-challenge' && (
          <MFAChallenge onVerifySuccess={() => setActiveTab('compliance')} />
        )}

        {activeTab === 'mfa-enroll' && (
          <MFAEnrollment onEnrollSuccess={() => setActiveTab('compliance')} />
        )}

        {activeTab === 'compliance' && (
          <ComplianceScreen report={report} loading={loading} />
        )}
      </main>
    </div>
  );
}
