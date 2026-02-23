import React from 'react';
import ComplianceHealth from '../components/ui/ComplianceHealth';
import EventFeed from '../components/ui/EventFeed';
import ArtifactVault from '../components/ui/ArtifactVault';
import OnboardingBridge from '../components/ui/OnboardingBridge';

const DemoDashboard = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Top Navigation / Brand */}
      <nav className="p-6 border-b border-slate-900 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-black">SB</div>
            <span className="font-bold tracking-tight text-xl">SecureBase <span className="text-emerald-500 text-sm font-mono ml-1">DEMO</span></span>
          </div>
          <div className="hidden md:block text-[10px] font-mono text-slate-500">
            ENV: SANDBOX_MODE // AUTH: ACME_FINTECH_PILOT
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: The "Pulse" and "Activity" */}
          <div className="lg:col-span-4 space-y-6">
            <ComplianceHealth targetScore={94} />
            <EventFeed />
          </div>

          {/* Right Column: The "Proof" and "Action" */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ArtifactVault />
              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col justify-center">
                <h4 className="text-emerald-400 font-bold mb-2 uppercase text-xs tracking-widest">Pilot Opportunity</h4>
                <p className="text-slate-400 text-sm mb-4 italic">
                  "SecureBase automated our entire evidence vault in the first 24 hours."
                </p>
                <div className="text-[10px] text-slate-500">— Potential Pilot #01</div>
              </div>
            </div>
            
            {/* The Closer */}
            <OnboardingBridge />
          </div>
        </div>
      </main>

      <footer className="mt-20 p-10 border-t border-slate-900 text-center text-slate-600 text-xs">
        &copy; 2026 TxImhotep LLC. Built by Cedrick Byrd. All rights reserved.
      </footer>
    </div>
  );
};

export default DemoDashboard;
