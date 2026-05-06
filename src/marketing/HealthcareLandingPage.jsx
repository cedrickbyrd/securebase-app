/**
 * HealthcareLandingPage.jsx
 *
 * HIPAA / OCR vertical landing page for healthcare visitors arriving via
 * LinkedIn utm_campaign=*hipaa* or utm_campaign=*health*.
 *
 * Speaks the language of healthcare CISOs, CTOs and compliance officers:
 *  - Live HIPAA score (87%)
 *  - CFR section auto-mapping: §164.308 / §164.310 / §164.312
 *  - One-click Auditor Evidence Package
 *  - CTA → Contact Sales with tier=healthcare pre-filled
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, Download, Lock, Activity, FileText } from 'lucide-react';
import { trackDemoRequest } from '../utils/analytics';

const DEMO_URL = 'https://demo.securebase.tximhotep.com';
const SALES_EMAIL = 'sales@securebase.tximhotep.com';
const HIPAA_SCORE = 87;

const CFR_SECTIONS = [
  {
    section: '§164.308',
    title: 'Administrative Safeguards',
    controls: ['Security Officer designation', 'Workforce training', 'Access management', 'Contingency plan'],
    passing: true,
  },
  {
    section: '§164.310',
    title: 'Physical Safeguards',
    controls: ['Facility access controls', 'Workstation security', 'Device & media controls'],
    passing: true,
  },
  {
    section: '§164.312',
    title: 'Technical Safeguards',
    controls: ['Access controls', 'Audit controls', 'Integrity controls', 'Transmission security'],
    passing: true,
  },
];

const EVIDENCE_ITEMS = [
  'Risk Analysis & Risk Management documentation',
  'Access control audit log (last 90 days)',
  'Encryption-at-rest certification (AES-256)',
  'Encryption-in-transit report (TLS 1.3)',
  'Business Associate Agreement (BAA) register',
  'Workforce training completion records',
  'Incident response plan + test results',
];

export default function HealthcareLandingPage() {
  const navigate = useNavigate();

  function handleRequestDemo() {
    trackDemoRequest('healthcare');
    navigate('/contact-sales?tier=healthcare');
  }

  function handleViewDemo() {
    trackDemoRequest('healthcare');
    window.open(`${DEMO_URL}?utm_source=healthcare_landing&utm_medium=cta&utm_campaign=hipaa_demo`, '_blank', 'noopener,noreferrer');
  }

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
        <div className="inline-flex items-center gap-2 bg-blue-400/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
          <FileText className="w-4 h-4" />
          HIPAA · OCR · 45 CFR Part 164
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
          OCR audit in 30 days?
          <br />
          <span className="text-blue-300">One click generates your evidence package.</span>
        </h1>
        <p className="text-xl text-blue-200 max-w-2xl mx-auto mb-8">
          SecureBase continuously maps your AWS infrastructure to §164.308, §164.310,
          and §164.312. Current HIPAA compliance score:{' '}
          <span className="text-white font-bold">{HIPAA_SCORE}%</span>.
          Export the Auditor Evidence Package — formatted exactly the way OCR investigators ask for it.
        </p>

        {/* Score badge */}
        <div className="inline-flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl px-10 py-6 mb-8">
          <div className="text-6xl font-extrabold text-white mb-1">{HIPAA_SCORE}%</div>
          <div className="text-blue-300 text-sm uppercase tracking-widest font-bold">Current HIPAA Score</div>
          <div className="w-full bg-white/10 rounded-full h-2 mt-3 max-w-xs">
            <div
              className="bg-blue-400 h-2 rounded-full transition-all"
              style={{ width: `${HIPAA_SCORE}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleRequestDemo}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition shadow-lg"
          >
            Request HIPAA Demo
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
          $7,500/mo pilot · 30-day deployment · BAA available
        </p>
      </section>

      {/* CFR Section Mapping */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Auto-mapped to every CFR section OCR investigators reference
        </h2>
        <p className="text-blue-300 text-center mb-8 text-sm">
          Every control is continuously monitored. No manual evidence collection. No spreadsheets.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CFR_SECTIONS.map((sec) => (
            <div
              key={sec.section}
              className="bg-white/5 border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-blue-300 text-xs font-bold uppercase tracking-widest">{sec.section}</span>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-3">{sec.title}</h3>
              <ul className="space-y-1">
                {sec.controls.map((ctrl) => (
                  <li key={ctrl} className="flex items-start gap-2 text-blue-200 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    {ctrl}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Auditor Evidence Package */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white/5 border border-blue-400/20 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-5">
            <Download className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-white font-bold text-lg">Auditor Evidence Package</h2>
              <p className="text-blue-300 text-sm">One-click export · OCR-ready format</p>
            </div>
          </div>
          <p className="text-blue-200 text-sm mb-5">
            When OCR investigators arrive, they ask for a specific set of documents.
            SecureBase generates all of them automatically, formatted to the standard auditors
            recognise:
          </p>
          <ul className="space-y-2">
            {EVIDENCE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-blue-200 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={handleViewDemo}
            className="mt-6 bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center gap-2 transition text-sm"
          >
            <Download className="w-4 h-4" />
            See a sample export →
          </button>
        </div>
      </section>

      {/* Social Proof */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white/5 border border-blue-400/20 rounded-2xl p-8 text-center">
          <Activity className="w-8 h-8 text-blue-400 mx-auto mb-4" />
          <blockquote className="text-white text-lg font-medium italic mb-3">
            "Our previous HIPAA risk assessment took 6 weeks and a consultant.
            With SecureBase the evidence package was ready in an afternoon.
            The OCR investigator said it was the most complete submission they'd seen."
          </blockquote>
          <p className="text-blue-300 text-sm">— CTO, Dallas-area Healthcare System</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Your next OCR audit doesn't have to be a fire drill.
        </h2>
        <p className="text-blue-200 mb-6">
          $7,500/mo pilot · 30-day deployment · BAA available on request
        </p>
        <button
          onClick={handleRequestDemo}
          className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 px-10 rounded-xl inline-flex items-center gap-2 transition shadow-lg"
        >
          Request HIPAA Demo
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-blue-400 mt-3">
          Response within 24 hours · No commitment required
        </p>
      </section>
    </div>
  );
}
