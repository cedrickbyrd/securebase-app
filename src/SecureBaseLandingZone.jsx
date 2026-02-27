import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight, Loader } from 'lucide-react';
import 'antd/dist/reset.css';
import ComplianceScreen from './components/compliance/ComplianceScreen';
import { supabase } from './lib/supabase';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Unified Tab Handler (No MFA Gate for now)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // 2. Data Fetcher (Runs on load, ignores MFA status)
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

    // Listen for the initial session and any changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        fetchLatestAudit(session.access_token);
      } else {
        setLoading(false);
        // Optional: Redirect to login if session is null
        console.warn("SecureBase: No active session found.");
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

        {/* 3. The Render Fix: Removed isMFA requirement */}
        {activeTab === 'compliance' && (
          <ComplianceScreen report={report} loading={loading} />
        )}
      </main>
    </div>
  );
}            

