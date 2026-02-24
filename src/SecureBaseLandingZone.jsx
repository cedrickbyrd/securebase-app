import React, { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle, Lock, ArrowRight, 
  Loader, ShieldCheck, Mail
} from 'lucide-react';
import 'antd/dist/reset.css';
import ComplianceScreen from './components/compliance/ComplianceScreen';
import MFAChallenge from './components/MFAChallenge';
import { useMFAStatus } from './lib/useMFAStatus';
import { supabase } from './lib/supabase';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ id: null, name: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { isMFA, isLoading: authLoading } = useMFAStatus();

  const handleTabChange = (tab) => {
    if (tab === 'compliance' && !isMFA) {
      setActiveTab('mfa-gate');
    } else {
      setActiveTab(tab);
    }
    setShowReview(false);
  };

  useEffect(() => {
    const fetchLatestAudit = async () => {
      setLoading(true);
      try {
        // Calling the server-side proxy instead of S3 directly
        const response = await fetch('/.netlify/functions/get-audit-report');
        if (!response.ok) throw new Error("Vault fetch failed");
        const data = await response.json();
        setReport(data);
      } catch (err) {
        console.error("Vault access error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (isMFA) {
      fetchLatestAudit();
    } else {
      setLoading(false);
    }
  }, [isMFA]);
  
  const handleCheckout = async () => {
    if (!userEmail || !userEmail.includes('@')) {
      setCheckoutError("Valid work email required.");
      return;
    }
    setIsCheckingOut(true);
    try {
      const response = await fetch('/.netlify/functions/securebase-checkout-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_email: userEmail.trim(),
          price_id: selectedPlan.id,
          plan_name: selectedPlan.name 
        }),
      });
      const data = await response.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

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
            {['overview', 'compliance', 'pricing'].map((tab) => (
              <button key={tab} onClick={() => handleTabChange(tab)}
                className={`text-sm font-semibold capitalize ${activeTab === tab ? 'text-blue-600' : 'text-slate-600'}`}>
                {tab}
              </button>
            ))}
            <button 
              onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
              className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase ml-4"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'overview' && (
          <div className="text-center pt-12">
            <h1 className="text-5xl md:text-7xl font-black mb-8">Audit-Ready AWS <br /><span className="text-blue-600">In Under 48 Hours</span></h1>
            <button onClick={() => handleTabChange('pricing')} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg mx-auto flex items-center gap-2">
              Start Your Pilot <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {activeTab === 'mfa-gate' && <MFAChallenge onSuccess={() => setActiveTab('compliance')} />}
        
        {activeTab === 'compliance' && isMFA && <ComplianceScreen report={report} loading={loading} />}

        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto">
            {!showReview ? (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white border-2 border-blue-600 rounded-3xl p-8 shadow-xl">
                  <h3 className="text-2xl font-bold mb-4">White-Glove Pilot</h3>
                  <div className="text-5xl font-black mb-6">$4,000</div>
                  <button onClick={() => { setSelectedPlan({id: 'price_1SrgoR5bg6XXXrmNXe0tTgki', name: 'White-Glove Pilot'}); setShowReview(true); }}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">Join Pilot</button>
                </div>
                <div className="bg-slate-900 text-white rounded-3xl p-8">
                  <h3 className="text-2xl font-bold mb-4">Fintech Standard</h3>
                  <div className="text-5xl font-black mb-6">$8,000</div>
                  <button onClick={() => { setSelectedPlan({id: 'price_1SrgqW5bg6XXXrmNzkk8O5E5', name: 'Fintech Standard'}); setShowReview(true); }}
                    className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold">Select Standard</button>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-10 shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">Review Pilot Onboarding</h2>
                <div className="space-y-6">
                  {checkoutError && <div className="text-red-500 text-sm font-bold">{checkoutError}</div>}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-2">Work Email</label>
                    <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 rounded-xl" placeholder="cedrick@tximhotep.com" />
                  </div>
                  <button onClick={handleCheckout} disabled={isCheckingOut}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex justify-center items-center gap-2">
                    {isCheckingOut ? <Loader className="animate-spin"/> : 'Secure Checkout'}
                  </button>
                  <button onClick={() => setShowReview(false)} className="w-full text-slate-400 text-sm">Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
