import React, { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle, Rocket, Lock, Eye, Zap, 
  GitBranch, Database, Users, Cloud, Terminal, 
  DollarSign, ShoppingCart, UserPlus, ArrowRight, Activity
} from 'lucide-react';
import ComplianceScreen from './components/compliance/ComplianceScreen';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isDeploying, setIsDeploying] = useState(false);

  // Stripe Checkout Logic
  const handleCheckout = async (priceId) => {
    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100">
      {/* Global Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {['overview', 'compliance', 'pricing'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-semibold capitalize transition-all ${
                  activeTab === tab ? 'text-blue-600' : 'text-slate-600 hover:text-blue-500'
                }`}
              >
                {tab}
              </button>
            ))}
            <button 
              onClick={() => setActiveTab('pricing')}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 transition flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <ShoppingCart className="w-4 h-4" />
              Purchase Now
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* TAB: OVERVIEW (Hero & Value Prop) */}
        {activeTab === 'overview' && (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="text-center pt-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-bold mb-8">
                <Activity className="w-3 h-3" /> v1.0 PRODUCTION READY
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8">
                Audit-Ready AWS <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  In Under 48 Hours
                </span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                Deploy a SOX2/SOC2 compliant Landing Zone without the complexity of Control Tower. 
                Built for Fintechs that need to pass audits yesterday.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => setActiveTab('pricing')}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xl shadow-blue-200"
                >
                  Start Your Pilot <ArrowRight className="w-5 h-5" />
                </button>
                <button className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition">
                  View Architecture
                </button>
              </div>
            </section>

            {/* Feature Grid */}
            <section className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Lock, title: "Zero Trust Auth", desc: "MFA enforced, zero long-lived credentials, and centralized Identity Center." },
                { icon: Terminal, title: "Pure Terraform", desc: "No proprietary lock-in. Full ownership of your infrastructure code from day one." },
                { icon: Activity, title: "Continuous Drift Detection", desc: "Real-time alerts for configuration changes that could impact your compliance." }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
                  <feature.icon className="text-blue-600 w-10 h-10 mb-6" />
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* TAB: COMPLIANCE (Live Signals) */}
        {activeTab === 'compliance' && (
          <div className="animate-in fade-in duration-500">
            <ComplianceScreen />
          </div>
        )}

        {/* TAB: PRICING (Stripe Loop) */}
        {activeTab === 'pricing' && (
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Predictable Pricing for Scale</h2>
              <p className="text-slate-600">Select the plan that fits your current compliance audit window.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 pt-8">
              {/* Pilot Tier */}
              <div className="relative bg-white border-2 border-blue-600 rounded-[2rem] p-10 shadow-2xl flex flex-col">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                  Early Adopter Pilot
                </div>
                <h3 className="text-2xl font-bold">White-Glove Pilot</h3>
                <div className="my-6">
                  <span className="text-6xl font-black">$4,000</span>
                  <span className="text-slate-400 font-bold">/mo</span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {['SOX2 + SOC2 Base Controls', 'White-Glove AWS Deployment', 'Quarterly Evidence Reports', 'CIS Benchmark Hardening'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <CheckCircle className="text-green-500 w-5 h-5" /> {item}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleCheckout('price_PILOT_4000')}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                >
                  Join the Pilot
                </button>
              </div>

              {/* Standard Tier */}
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-10 flex flex-col text-white">
                <h3 className="text-2xl font-bold">Fintech Standard</h3>
                <div className="my-6">
                  <span className="text-6xl font-black">$8,000</span>
                  <span className="text-slate-500 font-bold">/mo</span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {['Everything in Pilot', '24/7 Priority Incident Ops', 'Multi-Region Expansion', 'Unlimited Account Vending'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                      <CheckCircle className="text-blue-400 w-5 h-5" /> {item}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleCheckout('price_FINTECH_8000')}
                  className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-100 transition shadow-lg"
                >
                  Select Standard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-slate-200 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600 w-5 h-5" />
            <span className="font-bold text-slate-900">SecureBase by TxImhotep LLC</span>
          </div>
          <div className="text-sm text-slate-500 font-medium">
            © 2026 TxImhotep LLC. Built for the future of Fintech Compliance.
          </div>
        </div>
      </footer>
    </div>
  );
}
