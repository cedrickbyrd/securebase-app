import React, { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle, Lock, ShoppingCart, ArrowRight, 
  Activity, AlertCircle, Loader, Check, X, Terminal, 
  FileText, Rocket, ShieldCheck
} from 'lucide-react';
import 'antd/dist/reset.css';
import ComplianceScreen from './components/compliance/ComplianceScreen';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ id: null, name: "" });

  // Sync with Stripe success/cancel
useEffect(() => {
    const fetchLatestAudit = async () => {
      const [report, setReport] = useState(null);
      const [loading, setLoading] = useState(true);
      const client = new S3Client({
        region: "us-east-1",
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY, 
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_KEY,
        },
      });

      try {
        // 1. List all folders in the evidence/ directory
        const listCommand = new ListObjectsV2Command({
          Bucket: "securebase-evidence-tx-imhotep",
          Prefix: "evidence/",
        });

        const listResponse = await client.send(listCommand);
        
        // 2. Find the object with the most recent LastModified date
        if (listResponse.Contents) {
          const latestJson = listResponse.Contents
            .filter(obj => obj.Key.endsWith('.json'))
            .sort((a, b) => b.LastModified - a.LastModified)[0];

          if (latestJson) {
            // 3. Fetch the actual content of that specific latest JSON
            const getCommand = new GetObjectCommand({
              Bucket: "securebase-evidence-tx-imhotep",
              Key: latestJson.Key,
            });

            const response = await client.send(getCommand);
            const str = await response.Body.transformToString();
            setReport(JSON.parse(str));
          }
        }
      } catch (err) {
        console.error("Vault access error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestAudit();
  }, []);
  
  const handleCheckout = async () => {
    if (!userEmail || !userEmail.includes('@')) {
      setCheckoutError("Valid work email required for AWS provisioning.");
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);
    
    try {
      const response = await fetch('/.netlify/functions/securebase-checkout-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_email: userEmail.trim(),
          price_id: selectedPlan.id,
          plan_name: selectedPlan.name // Added for Stripe metadata
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Checkout session failed');
      
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setCheckoutError(err.message);
      setIsCheckingOut(false);
    }
  };

  const initiateCheckout = (id, name) => {
    setSelectedPlan({ id, name });
    setShowReview(true);
    // Scroll to the review card
    document.getElementById('pricing-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 font-sans">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setActiveTab('overview'); setShowReview(false);}}>
            <div className="bg-blue-600 p-2 rounded-lg"><Shield className="text-white w-6 h-6" /></div>
            <div>
              <div className="text-xl font-bold tracking-tight">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {['overview', 'compliance', 'pricing'].map((tab) => (
              <button key={tab} onClick={() => {setActiveTab(tab); setShowReview(false);}}
                className={`text-sm font-semibold capitalize ${activeTab === tab ? 'text-blue-600' : 'text-slate-600 hover:text-blue-500'}`}>
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12" id="pricing-anchor">
        {activeTab === 'overview' && (
          <div className="text-center pt-12 animate-in fade-in duration-700">
            <h1 className="text-5xl md:text-7xl font-black mb-8">Audit-Ready AWS <br /><span className="text-blue-600">In Under 48 Hours</span></h1>
            <button onClick={() => setActiveTab('pricing')} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto">
              Start Your Pilot <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {activeTab === 'compliance' && <ComplianceScreen />}

        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto space-y-12">
            {!showReview ? (
              <div className="grid md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95">
                {/* Pilot Card */}
                <div className="bg-white border-2 border-blue-600 rounded-3xl p-8 shadow-xl flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">White-Glove Pilot</h3>
                  <div className="text-5xl font-black mb-6">$4,000<span className="text-lg text-slate-400">/mo</span></div>
                  <ul className="space-y-3 mb-8 flex-grow">
                    <li className="flex items-center gap-2 text-sm"><CheckCircle className="text-green-500 w-4 h-4"/> SOX2 + SOC2 Landing Zone</li>
                    <li className="flex items-center gap-2 text-sm"><CheckCircle className="text-green-500 w-4 h-4"/> 48hr Full AWS Deployment</li>
                  </ul>
                  <button onClick={() => initiateCheckout('price_1SrgoR5bg6XXXrmNXe0tTgki', 'White-Glove Pilot')}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
                    Join the Pilot
                  </button>
                </div>
                {/* Standard Card */}
                <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">Fintech Standard</h3>
                  <div className="text-5xl font-black mb-6">$8,000<span className="text-lg text-slate-500">/mo</span></div>
                  <p className="text-slate-400 text-sm mb-8">Scale-ready infrastructure with 24/7 incident response.</p>
                  <button onClick={() => initiateCheckout('price_1SrgqW5bg6XXXrmNzkk8O5E5', 'Fintech Standard')}
                    className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition">
                    Select Standard
                  </button>
                </div>
              </div>
            ) : (
              /* THE CONFIDENCE STEP: REVIEW CARD */
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-10 shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-blue-100 p-3 rounded-full"><ShieldCheck className="text-blue-600 w-8 h-8"/></div>
                  <div>
                    <h2 className="text-2xl font-bold">Review Your Pilot Onboarding</h2>
                    <p className="text-slate-500">Confirm your details to proceed to secure checkout.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Work Email (Required for AWS setup)</label>
                      <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="cedrick@tximhotep.com" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-600 outline-none transition" />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm font-bold"><span>Selected Plan:</span><span>{selectedPlan.name}</span></div>
                      <div className="flex justify-between text-sm text-slate-500"><span>Setup Fee:</span><span>Included</span></div>
                      <div className="flex justify-between text-lg font-black pt-2 border-t border-slate-200"><span>Total Due Now:</span><span className="text-blue-600">{selectedPlan.id.includes('goR5') ? '$4,000' : '$8,000'}</span></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm">Included in your Pilot:</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex gap-2"><Check className="text-green-500 w-4 h-4"/> Provisioning of multi-account AWS Landing Zone</li>
                      <li className="flex gap-2"><Check className="text-green-500 w-4 h-4"/> Full SOX2/SOC2 compliance control mapping</li>
                      <li className="flex gap-2"><Check className="text-green-500 w-4 h-4"/> Dedicated Slack support for 48hr deployment</li>
                    </ul>
                    <button onClick={handleCheckout} disabled={isCheckingOut || !userEmail.includes('@')}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                      {isCheckingOut ? <Loader className="animate-spin"/> : 'Secure Checkout via Stripe'}
                    </button>
                    <button onClick={() => setShowReview(false)} className="w-full text-slate-400 text-sm hover:text-slate-600">Back to plans</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'success' && (
          <div className="text-center py-20 animate-in zoom-in-95">
            <div className="bg-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="text-white w-10 h-10"/></div>
            <h2 className="text-4xl font-black mb-4">You're in the Pilot!</h2>
            <p className="text-slate-600 mb-8">Onboarding email sent to {userEmail}.</p>
            <button onClick={() => setActiveTab('overview')} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold">Return Home</button>
          </div>
        )}
      </main>
    </div>
  );
}
