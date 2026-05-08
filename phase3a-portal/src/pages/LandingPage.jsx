import React from 'react';
import EarlyAccessForm from '../components/EarlyAccessForm';

const valueProps = [
  {
    icon: '🌐',
    title: 'Unified Governance Visibility',
    description: 'Transform fragmented security telemetry into a single executive view of institutional risk, control maturity, and remediation priorities.',
  },
  {
    icon: '📊',
    title: 'Board-Ready Risk Intelligence',
    description: 'Surface strategic exposure across privacy, access governance, compliance posture, vendor risk, and operational resilience in language leadership can act on immediately.',
  },
  {
    icon: '🛡️',
    title: 'Defensible Audit Accountability',
    description: 'Support executive attestation with immutable evidence, time-bound governance snapshots, and historical risk posture reconstruction.',
  },
];

const exposureDomains = [
  'Data Sovereignty & Privacy Risk',
  'Access Governance & Privileged Identity Exposure',
  'Regulatory Compliance Posture',
  'Vendor & Third-Party Risk',
  'Operational Resilience & Control Integrity',
];

const executiveSignals = [
  {
    title: 'Enterprise Risk Heatmap',
    description: 'Give board leadership immediate visibility into concentration risk, liability hotspots, and business units requiring remediation prioritization.',
  },
  {
    title: 'Race to Green Indicators',
    description: 'Visualize SOC 2, HIPAA, PCI DSS, SOX, and FedRAMP readiness through trajectory, confidence, and remediation velocity — not raw evidence overload.',
  },
  {
    title: 'Strategic Risk Overview',
    description: 'Reconstruct historical posture, validate audit defensibility, and preserve executive-grade governance narratives for regulators and external auditors.',
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #312e81 100%)' }}>
      {/* Hero */}
      <header className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-12">
        <div className="inline-block bg-white/10 backdrop-blur text-white text-xs font-semibold px-4 py-1 rounded-full mb-6 border border-white/20">
          Executive Command Center · Governance Intelligence for Institutional Leadership
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4 max-w-5xl">
          SecureBase: Unified Governance<br />
          <span className="text-cyan-300">for Executive Risk Management</span>
        </h1>
        <p className="text-xl text-slate-200 max-w-3xl mb-8">
          SecureBase transforms fragmented operational telemetry into clear, defensible governance insight for boards,
          CFOs, CISOs, risk committees, regulators, and external auditors.
        </p>

        {/* Demo invitation strip — low-commitment path before the signup ask */}
        <a
          href="https://demo.securebase.tximhotep.com/login"
          aria-label="View live executive risk dashboard demo — no signup required"
          className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/30 text-white rounded-xl px-6 py-3 mb-8 transition max-w-2xl w-full justify-center"
        >
          <span className="text-2xl">🖥️</span>
          <span className="text-sm text-left">
            <span className="font-semibold">See the Executive Risk Command Center</span>
            {' '}— board-ready exposure intelligence across compliance, identity, privacy, and operational resilience.
          </span>
          <span className="ml-auto font-bold text-cyan-300 whitespace-nowrap">Explore the Demo →</span>
        </a>

        <div className="flex gap-4 justify-center flex-wrap">
          <a href="#request-access" className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold py-3 px-8 rounded-lg text-lg shadow-lg transition">
            Request Executive Access
          </a>
          <a href="/pricing" className="bg-slate-900/70 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg transition border border-cyan-300/40">
            View Platform Options
          </a>
        </div>
      </header>

      {/* Value Props */}
      <section className="px-6 py-12">
        <h2 className="text-center text-2xl font-bold text-white mb-10">Why Executive Teams Choose SecureBase</h2>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {valueProps.map((prop) => (
            <div
              key={prop.title}
              className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20 text-center"
            >
              <div className="text-4xl mb-3">{prop.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{prop.title}</h3>
              <p className="text-slate-200 text-sm">{prop.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Risk Domains */}
      <section className="px-6 py-8">
        <div className="max-w-6xl mx-auto bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-3">Strategic Exposure Domains</h2>
          <p className="text-slate-200 text-center max-w-3xl mx-auto mb-8">
            SecureBase organizes risk intelligence around the governance questions leadership actually needs answered — not low-context logs or isolated alerts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exposureDomains.map((domain) => (
              <div key={domain} className="rounded-xl border border-cyan-300/20 bg-slate-950/20 px-5 py-4 text-slate-100 font-medium">
                {domain}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Executive Signals */}
      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-white mb-10">Board-Ready Visualization Layer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {executiveSignals.map((signal) => (
              <div key={signal.title} className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-3">{signal.title}</h3>
                <p className="text-slate-200 text-sm leading-6">{signal.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Capture */}
      <section id="request-access" className="px-6 py-16 flex flex-col items-center">
        <div className="w-full max-w-lg bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Request Executive Access</h2>
          <p className="text-slate-200 text-center text-sm mb-8">
            Join institutions using SecureBase to strengthen regulatory defensibility, governance clarity, and executive accountability.
          </p>
          <EarlyAccessForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center">
        <p className="text-slate-300 text-sm mb-3">
          Prefer to speak with leadership directly?{' '}
          <a
            href="https://calendly.com/securebase/white-glove-pilot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:text-cyan-200 underline font-semibold"
          >
            Schedule an Executive Briefing
          </a>
        </p>
        <p className="text-slate-400 text-xs">© {new Date().getFullYear()} TxImhotep LLC · SecureBase</p>
      </footer>
    </div>
  );
};

export default LandingPage;
