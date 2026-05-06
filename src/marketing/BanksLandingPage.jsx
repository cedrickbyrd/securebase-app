/**
 * BanksLandingPage.jsx
 *
 * FFIEC / OCC / FDIC vertical landing page for banking and credit-union visitors
 * arriving via LinkedIn utm_campaign=*ffiec* or utm_source=tba/ibat/aba.
 *
 * Speaks the language of community bank CISOs:
 *  - FFIEC IT Handbook section mapping (8 of 9 passing)
 *  - OCC / FDIC examiner evidence language
 *  - AWS controls auto-mapped (CloudTrail, Config, GuardDuty)
 *  - CTA → Contact Sales with topic=ffiec&briefing=true pre-filled
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, FileText, Lock, Activity } from 'lucide-react';
import { trackDemoRequest } from '../utils/analytics';

const DEMO_URL = 'https://demo.securebase.tximhotep.com';
const SALES_EMAIL = 'sales@securebase.tximhotep.com';

const FFIEC_SECTIONS = [
  { label: 'Audit',                   passing: true  },
  { label: 'Business Continuity',     passing: true  },
  { label: 'Development & Acquisition', passing: true },
  { label: 'Information Security',    passing: true  },
  { label: 'Management',              passing: true  },
  { label: 'Operations',              passing: true  },
  { label: 'Outsourcing Technology',  passing: true  },
  { label: 'Retail Payment Systems',  passing: true  },
  { label: 'Wholesale Payment Systems', passing: false },
];

const AWS_CONTROLS = [
  { service: 'CloudTrail',    description: 'Immutable audit log — satisfies FFIEC Audit controls' },
  { service: 'Config',        description: 'Continuous config compliance — satisfies Change Mgmt' },
  { service: 'GuardDuty',     description: 'Threat detection — satisfies IS controls' },
  { service: 'Security Hub',  description: 'Centralised findings — satisfies Operations controls' },
  { service: 'IAM IC (SSO)',  description: 'Least-privilege access — satisfies Access Mgmt controls' },
];

export default function BanksLandingPage() {
  const navigate = useNavigate();

  function handleRequestBriefing() {
    trackDemoRequest('banking');
    navigate('/contact-sales?tier=enterprise&topic=ffiec&briefing=true');
  }

  function handleViewDemo() {
    trackDemoRequest('banking');
    window.open(`${DEMO_URL}?utm_source=banks_landing&utm_medium=cta&utm_campaign=ffiec_demo`, '_blank', 'noopener');
  }

  const passing = FFIEC_SECTIONS.filter((s) => s.passing).length;
  const total   = FFIEC_SECTIONS.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-white">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <a
            href={`mailto:${SALES_EMAIL}`}
            className="text-sm text-blue-300 hover:text-white transition hidden sm:block"
          >
            {SALES_EMAIL}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
          <FileText className="w-4 h-4" />
          FFIEC IT Handbook · OCC · FDIC
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
          Walk into your next exam with{' '}
          <span className="text-yellow-300">{passing}/{total} sections passing</span>
          <br />
          before the examiner arrives.
        </h1>
        <p className="text-xl text-blue-200 max-w-2xl mx-auto mb-10">
          SecureBase auto-maps your AWS environment to the FFIEC IT Handbook.
          CloudTrail, Config, GuardDuty, and Security Hub become examiner evidence — automatically.
          No spreadsheets. No manual evidence collection.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleRequestBriefing}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition shadow-lg"
          >
            Request FFIEC Regulatory Briefing
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleViewDemo}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition"
          >
            See the live dashboard →
          </button>
        </div>
        <p className="text-xs text-blue-400 mt-4">
          Response within 24 hours · Includes SOC 2 Type II report + architecture brief
        </p>
      </section>

      {/* FFIEC Dashboard Screenshot Block */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-bold text-lg">FFIEC IT Handbook Control Mapping</h2>
              <p className="text-blue-300 text-sm">Auto-mapped from your AWS infrastructure · Updated continuously</p>
            </div>
            <div className="bg-green-400/10 border border-green-400/30 text-green-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              {passing}/{total} Passing
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FFIEC_SECTIONS.map((section) => (
              <div
                key={section.label}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  section.passing
                    ? 'bg-green-400/10 text-green-300 border border-green-400/20'
                    : 'bg-red-400/10 text-red-300 border border-red-400/20'
                }`}
              >
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${section.passing ? 'text-green-400' : 'text-red-400'}`} />
                {section.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AWS Control Mapping */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Your AWS controls already satisfy FFIEC requirements
        </h2>
        <p className="text-blue-300 text-center mb-8 text-sm">
          SecureBase reads your existing AWS services and maps them to examiner controls.
          Nothing new to deploy for the evidence.
        </p>
        <div className="space-y-3">
          {AWS_CONTROLS.map((ctrl) => (
            <div
              key={ctrl.service}
              className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl px-5 py-4"
            >
              <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-semibold">{ctrl.service}</span>
                <span className="text-blue-300 text-sm ml-2">—</span>
                <span className="text-blue-300 text-sm ml-1">{ctrl.description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white/5 border border-yellow-400/20 rounded-2xl p-8 text-center">
          <Activity className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
          <blockquote className="text-white text-lg font-medium italic mb-3">
            "We walked into our OCC exam with a SecureBase evidence package. The examiner
            asked how we had all 8 sections mapped — we showed them the dashboard live."
          </blockquote>
          <p className="text-blue-300 text-sm">— CISO, Texas Regional Bank</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Your next exam is closer than you think.
        </h2>
        <p className="text-blue-200 mb-6">
          30-day deployment. Full FFIEC IT Handbook mapping. Evidence package included.
        </p>
        <button
          onClick={handleRequestBriefing}
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 px-10 rounded-xl inline-flex items-center gap-2 transition shadow-lg"
        >
          Request FFIEC Regulatory Briefing
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-blue-400 mt-3">
          Includes SOC 2 Type II report + architecture brief · No commitment required
        </p>
      </section>
    </div>
  );
}
