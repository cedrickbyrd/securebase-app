import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Loader, AlertCircle, Lock, FileText, Activity, ClipboardList } from 'lucide-react';
import { HIPAA_ASSESSMENT_ID } from '../config/live-config';
import { trackEvent, trackCTAClick } from '../utils/analytics';
import { getCheckoutFallback } from '../utils/checkoutFallback';

const SKU = 'hipaa_assessment';
const ASSESSMENT_PRICE = 1995;

const DELIVERABLES = [
  {
    icon: <Activity className="w-5 h-5 text-teal-400" />,
    label: 'Scored §164.308 (Administrative), §164.310 (Physical) & §164.312 (Technical) safeguards',
  },
  {
    icon: <Shield className="w-5 h-5 text-teal-400" />,
    label: 'PHI controls mapped across 67 AWS services with gap identification',
  },
  {
    icon: <ClipboardList className="w-5 h-5 text-teal-400" />,
    label: 'Findings report with remediation owners and days-open tracking',
  },
  {
    icon: <FileText className="w-5 h-5 text-teal-400" />,
    label: 'Auditor-ready HTML export for compliance evidence packages',
  },
  {
    icon: <Lock className="w-5 h-5 text-teal-400" />,
    label: 'BAA readiness checklist — know exactly what to prepare before signing',
  },
  {
    icon: <CheckCircle className="w-5 h-5 text-teal-400" />,
    label: 'Auto-enrolled in Healthcare tier ($7,500/mo pilot) — billing starts after 30 days, $1,995 credited to first invoice',
  },
];

const FAQS = [
  {
    q: 'What do I get for $1,995?',
    a: 'A scored HIPAA gap assessment covering §164.308, §164.310, and §164.312 safeguards across 67 AWS services. Deliverables include a findings report with remediation owners and days-open tracking, an auditor-ready HTML export, and a BAA readiness checklist. You are also automatically enrolled in the Healthcare tier subscription.',
  },
  {
    q: 'Does this constitute a BAA or legal advice?',
    a: 'No. This assessment identifies technical and operational gaps against the HIPAA Security Rule and prepares you for the BAA conversation. It is not a Business Associate Agreement, legal advice, or HIPAA certification. Consult qualified legal counsel before signing a BAA.',
  },
  {
    q: 'How does the Healthcare tier enrollment work?',
    a: 'After payment, you are automatically enrolled in the Healthcare tier at the $7,500/mo pilot rate. Your Healthcare subscription includes a 30-day free trial — no billing until after your assessment period is complete. Your $1,995 assessment fee is applied as a credit against your first Healthcare invoice, reducing your first month\'s charge.',
  },
  {
    q: 'Can I cancel the Healthcare subscription before billing starts?',
    a: 'Yes. You can cancel the Healthcare subscription at any time from the portal before the 30-day trial ends and you will not be charged. The $1,995 assessment fee for the one-time gap report is non-refundable.',
  },
  {
    q: 'How quickly will I receive results?',
    a: 'The assessment dashboard is available immediately after payment. Your scored findings, auditor export, and BAA checklist are generated from your live AWS environment — results reflect the current state of your account.',
  },
  {
    q: 'Does this cover my entire AWS footprint?',
    a: 'The assessment covers the 67 AWS services designated as HIPAA-eligible under the standard AWS BAA. Services outside that list are flagged separately as out-of-scope and require architectural review.',
  },
];

export default function HIPAAReadiness() {
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const handleStartAssessment = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackCTAClick('hipaa_assessment_start', 'hipaa_readiness');
    trackEvent('hipaa_assessment_checkout_initiated', { sku: SKU, price: ASSESSMENT_PRICE });

    try {
      const origin = window.location.origin;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: SKU,
          priceId: HIPAA_ASSESSMENT_ID,
          successUrl: `${origin}/setup?session_id={CHECKOUT_SESSION_ID}&product=hipaa_assessment`,
          cancelUrl: `${origin}/pilots/hipaa-readiness`,
          metadata: {
            pilot_sku: 'hipaa_assessment',
            provision_type: 'hipaa_readiness_assessment',
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const { checkout_url } = await res.json();
      if (!checkout_url) throw new Error('No checkout URL returned from server.');
      window.location.href = checkout_url;
    } catch (err) {
      console.error('HIPAA assessment checkout error:', err);
      const errorMessage = err?.message || String(err);
      const fallback = getCheckoutFallback(SKU, errorMessage);
      if (fallback) {
        navigate(fallback.contactSalesPath);
        return;
      }
      setCheckoutError(errorMessage || 'Something went wrong. Please try again.');
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 font-sans">
      {/* Nav */}
      <header className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-teal-500 to-green-600 p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-base font-bold text-white">SecureBase</div>
              <div className="text-[9px] uppercase tracking-widest text-teal-300 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <a
            href="mailto:sales@securebase.tximhotep.com"
            className="text-sm text-teal-300 hover:text-white transition-colors"
          >
            Questions? Email us
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/30">
            <span className="text-teal-400 text-xs font-bold uppercase tracking-widest">HIPAA Readiness</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Know your HIPAA gaps<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-green-400">
              before your auditor finds them.
            </span>
          </h1>
          <p className="text-lg text-teal-200 max-w-2xl mx-auto mb-8">
            Scored §164.308/310/312 safeguards, PHI controls across 67 AWS services, and an
            auditor-ready export — for{' '}
            <span className="text-white font-bold">$1,995</span> one-time.
          </p>
        </div>

        {/* CTA Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12 text-center max-w-lg mx-auto">
          <p className="text-white text-2xl font-black mb-1">$1,995</p>
          <p className="text-teal-300 text-sm mb-6">One-time payment · Healthcare tier enrollment included</p>

          {checkoutError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {checkoutError}
            </div>
          )}

          <button
            onClick={handleStartAssessment}
            disabled={checkoutLoading}
            className="w-full bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold py-4 rounded-xl text-base shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checkoutLoading ? (
              <>
                <Loader className="animate-spin w-5 h-5" />
                Redirecting to Stripe…
              </>
            ) : (
              'Start Assessment — $1,995 →'
            )}
          </button>

          <div className="mt-4 flex flex-col gap-1.5">
            {[
              'Secured by Stripe — PCI DSS Level 1',
              'Dashboard available immediately after payment',
              'Auto-enrolled in Healthcare tier ($7,500/mo pilot, 30-day free trial)',
              '$1,995 credited to your first Healthcare invoice',
            ].map((line) => (
              <div key={line} className="flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-xs text-teal-300">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deliverables */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white text-center mb-6">What you get</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {DELIVERABLES.map((d) => (
              <div
                key={d.label}
                className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <span className="mt-0.5 shrink-0">{d.icon}</span>
                <span className="text-teal-100 text-sm">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scope boundary */}
        <div className="bg-teal-900/30 border border-teal-400/20 rounded-xl p-6 mb-12">
          <h3 className="text-teal-200 font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Scope boundary
          </h3>
          <p className="text-teal-300 text-sm leading-relaxed">
            This assessment identifies technical and operational gaps against the HIPAA Security Rule.
            It is <strong className="text-white">not a Business Associate Agreement (BAA)</strong>,
            not legal advice, and does not constitute HIPAA certification or a guarantee of compliance.
            Consult qualified legal counsel before signing a BAA. For BAA drafting and enterprise
            HIPAA support, contact{' '}
            <a href="mailto:sales@securebase.tximhotep.com" className="underline text-teal-200 hover:text-white">
              sales@securebase.tximhotep.com
            </a>.
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-white text-center mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((item) => (
              <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-sm text-teal-200 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-teal-400 py-8 border-t border-white/10 mt-8">
        © {new Date().getFullYear()} TxImhotep LLC · SecureBase ·{' '}
        <a href="mailto:sales@securebase.tximhotep.com" className="underline hover:text-teal-200">
          sales@securebase.tximhotep.com
        </a>
      </footer>
    </div>
  );
}
