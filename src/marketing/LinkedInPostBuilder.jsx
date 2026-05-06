/**
 * LinkedInPostBuilder.jsx
 *
 * Internal tool available at /admin/linkedin (admin-only route).
 *
 * Lets you:
 *   1. Pick a campaign type (FFIEC/Banking or HIPAA/Healthcare)
 *   2. Auto-generate the full UTM link
 *   3. Preview the formatted LinkedIn post text ready to copy
 *   4. Copy link or post text to clipboard with one click
 *
 * No API calls — entirely client-side.  This is a productivity tool for
 * drafting posts, not a publishing integration.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Copy, CheckCircle, ExternalLink } from 'lucide-react';

const DEMO_BASE = 'https://demo.securebase.tximhotep.com';
const SALES_EMAIL = 'sales@securebase.tximhotep.com';

const CAMPAIGNS = [
  {
    id: 'ffiec_bank_post1',
    label: 'Banking — FFIEC (Post #1)',
    vertical: 'banking',
    utmSource: 'linkedin',
    utmMedium: 'organic',
    description: 'Primary FFIEC post targeting Texas bank CISOs',
  },
  {
    id: 'ffiec_bank_post2',
    label: 'Banking — FFIEC (Post #2)',
    vertical: 'banking',
    utmSource: 'linkedin',
    utmMedium: 'organic',
    description: 'Follow-up post for exam season urgency',
  },
  {
    id: 'hipaa_health_post1',
    label: 'Healthcare — HIPAA (Post #1)',
    vertical: 'healthcare',
    utmSource: 'linkedin',
    utmMedium: 'organic',
    description: 'Primary HIPAA post targeting healthcare CTOs/CISOs',
  },
  {
    id: 'hipaa_health_post2',
    label: 'Healthcare — HIPAA (Post #2)',
    vertical: 'healthcare',
    utmSource: 'linkedin',
    utmMedium: 'organic',
    description: 'Evidence Package focus post',
  },
];

const POST_TEMPLATES = {
  ffiec_bank_post1: `Regional bank CISOs: what does your OCC examiner actually see when they pull your IT Handbook evidence?

Most shops hand over a spreadsheet and hope for the best.

SecureBase shows them a live dashboard — 8 of 9 IT Handbook sections passing, each control auto-mapped from your existing AWS stack: CloudTrail, Config, GuardDuty, Security Hub. No spreadsheet. No scramble. The evidence is already there.

We built this specifically for Texas community and regional banks. Deployment takes 30 days.

If you're on the OCC/FDIC exam calendar this year — I'd like to show you the 15-minute version.

👉 {LINK}
📧 ${SALES_EMAIL}`,

  ffiec_bank_post2: `Exam season for Texas regional banks is here.

The banks walking in prepared are the ones that stopped collecting evidence manually and started mapping it automatically from AWS.

CloudTrail = audit log evidence. Config = change management evidence. GuardDuty = threat detection evidence. It's already in your account — SecureBase just maps it to the FFIEC IT Handbook.

8 of 9 sections. Dashboard. One export. Examiner-ready.

30 days to deploy. Happy to show you the live version.

👉 {LINK}
📧 ${SALES_EMAIL}`,

  hipaa_health_post1: `One question for healthcare CISOs and CTOs:

If OCR knocked on your door tomorrow, how long would it take to produce your §164.308 administrative safeguards evidence?

Most organizations I talk to say "days." Some say "weeks."

SecureBase produces it in one click. Live dashboard, current score 87%, auto-mapped to the specific CFR sections OCR investigators reference: §164.308 (administrative), §164.310 (physical), §164.312 (technical). The export is formatted the way auditors ask for it — we call it the Auditor Evidence Package.

Pilot is $7,500/mo. Includes full AWS infrastructure deployment + compliance dashboard + one-click evidence export. 30-day setup.

👉 {LINK}
📧 ${SALES_EMAIL}`,

  hipaa_health_post2: `The hardest part of a HIPAA OCR investigation isn't the investigation.

It's finding the evidence.

Risk analysis? Somewhere in a folder from 2022. Access control audit logs? Ask IT — they'll get back to you. Encryption certification? We use AWS but I'm not sure where to find that.

SecureBase generates the entire Auditor Evidence Package in one click. Every document OCR asks for, pre-formatted, from your live AWS environment.

Current HIPAA score: 87%. Evidence export: < 10 seconds.

If you're preparing for an audit or just tired of the spreadsheet version — let's talk.

👉 {LINK}
📧 ${SALES_EMAIL}`,
};

function buildLink(campaign) {
  const params = new URLSearchParams({
    utm_source:   campaign.utmSource,
    utm_medium:   campaign.utmMedium,
    utm_campaign: campaign.id,
    utm_content:  `${campaign.vertical}_ciso_tag`,
  });
  const landingPath = campaign.vertical === 'banking' ? '/banks' : '/healthcare';
  return `${DEMO_BASE}${landingPath}?${params.toString()}`;
}

export default function LinkedInPostBuilder() {
  const navigate   = useNavigate();
  const [selected, setSelected] = useState(CAMPAIGNS[0].id);
  const [copied,   setCopied]   = useState(null); // 'link' | 'post' | null

  const campaign = useMemo(
    () => CAMPAIGNS.find((c) => c.id === selected),
    [selected],
  );

  const link = useMemo(() => buildLink(campaign), [campaign]);

  const postText = useMemo(
    () => (POST_TEMPLATES[selected] || '').replace('{LINK}', link),
    [selected, link],
  );

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 font-sans text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white">SecureBase</div>
            <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">LinkedIn Post Builder</div>
          </div>
        </button>
        <span className="text-xs text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
          Internal Tool
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Campaign selector */}
        <section>
          <h2 className="text-xs uppercase tracking-widest font-bold text-blue-300 mb-3">Campaign</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPAIGNS.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`text-left px-4 py-3 rounded-xl border transition ${
                  selected === c.id
                    ? 'bg-white/10 border-[#667eea] text-white'
                    : 'bg-white/5 border-white/10 text-blue-200 hover:border-white/30'
                }`}
              >
                <div className="font-semibold text-sm">{c.label}</div>
                <div className="text-xs text-blue-400 mt-0.5">{c.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Generated UTM link */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-widest font-bold text-blue-300">UTM Link</h2>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(link, 'link')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                {copied === 'link' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'link' ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview
              </a>
            </div>
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-blue-200 font-mono break-all">
            {link}
          </div>
        </section>

        {/* Post preview */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-widest font-bold text-blue-300">Post Text</h2>
            <button
              onClick={() => copyToClipboard(postText, 'post')}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              {copied === 'post' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'post' ? 'Copied!' : 'Copy post'}
            </button>
          </div>
          <pre className="bg-gray-900 border border-white/10 rounded-xl px-5 py-4 text-sm text-blue-100 whitespace-pre-wrap font-sans leading-relaxed">
            {postText}
          </pre>
        </section>

        {/* UTM breakdown */}
        <section>
          <h2 className="text-xs uppercase tracking-widest font-bold text-blue-300 mb-3">UTM Breakdown</h2>
          <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden text-sm">
            {[
              ['utm_source',   campaign.utmSource],
              ['utm_medium',   campaign.utmMedium],
              ['utm_campaign', campaign.id],
              ['utm_content',  `${campaign.vertical}_ciso_tag`],
            ].map(([key, val]) => (
              <div key={key} className="flex border-b border-white/5 last:border-0">
                <div className="w-36 px-4 py-2.5 text-blue-400 font-mono text-xs border-r border-white/5 flex-shrink-0">{key}</div>
                <div className="px-4 py-2.5 text-white font-mono text-xs">{val}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-500 mt-2">
            trackingUtils.js will capture these on landing and classify as{' '}
            <code className="bg-gray-800 px-1 rounded">{campaign.vertical === 'banking' ? 'isBankingDomainTraffic()' : 'isLinkedInTraffic()'}</code>
          </p>
        </section>

      </main>
    </div>
  );
}
