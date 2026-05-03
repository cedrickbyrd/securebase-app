import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Clock, Loader, AlertCircle, Lock, FileText, Zap } from 'lucide-react';
import { HIPAA_ASSESSMENT_ID } from '../config/live-config';
import { trackEvent, trackCTAClick } from '../utils/analytics';

const SKU = 'hipaa_assessment';
const PILOT_PRICE = 0; // TBD — display "Price TBD", not $0
const SLOT_POLL_INTERVAL_MS = 30_000;

const DELIVERABLES = [
  { icon: <CheckCircle className="w-5 h-5 text-green-400" />, label: 'HIPAA Eligible AWS Services checklist (67 services mapped)' },
  { icon: <FileText className="w-5 h-5 text-green-400" />, label: 'PHI data flow diagram template for your architecture' },
  { icon: <Zap className="w-5 h-5 text-green-400" />, label: 'Gap report: current state vs. HIPAA Security Rule requirements' },
  { icon: <Lock className="w-5 h-5 text-green-400" />, label: 'BAA readiness checklist — what you need before signing' },
  { icon: <Shield className="w-5 h-5 text-green-400" />, label: '7-year retention policy Terraform scaffold' },
  { icon: <CheckCircle className="w-5 h-5 text-green-400" />, label: 'Assessment credit toward Healthcare tier subscription' },
];

const FAQS = [
  {
    q: 'What exactly do I get?',
    a: 'A gap report comparing your current AWS environment against the HIPAA Security Rule, a PHI data flow diagram template, a BAA readiness checklist, a 7-year retention Terraform scaffold, and a credit toward the Healthcare tier subscription.',
  },
  {
    q: 'Does this include a BAA?',
    a: 'No. This assessment identifies gaps and prepares you for the BAA conversation. A BAA is required for full Healthcare tier access and is included when you upgrade.',
  },
  {
    q: 'What AWS services are covered?',
    a: 'All 67 HIPAA-eligible AWS services: S3, RDS, Lambda, KMS, CloudTrail, Macie, GuardDuty, Config, Security Hub, and more.',
  },
  {
    q: 'Can I run this in my existing AWS account?',
    a: 'Yes. No AWS Organizations required. The assessment targets your existing account and flags gaps relative to HIPAA requirements.',
  },
  {
    q: "What's the difference between this and the Healthcare tier?",
    a: 'This assessment tells you where you stand. The Healthcare tier ($12K/mo) deploys the full HIPAA-compliant Landing Zone, includes a signed BAA, PHI encryption automation, 7-year audit retention, and dedicated support.',
  },
];

function SlotBadge({ slotsRemaining, loading, error }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-sm">
        <Loader className="w-3.5 h-3.5 animate-spin" />
        Checking availability…
      </span>
    );
  }
  if (error || slotsRemaining === null) {
    return null;
  }
  if (slotsRemaining === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 text-sm font-semibold">
        <AlertCircle className="w-3.5 h-3.5" />
        Sold out — join waitlist
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-400/10 border border-teal-400/30 text-teal-300 text-sm font-semibold">
      <Clock className="w-3.5 h-3.5" />
      {slotsRemaining} spot{slotsRemaining !== 1 ? 's' : ''} remaining
    </span>
  );
}

export default function HIPAAReadiness() {
  const navigate = useNavigate();
  const [slotsRemaining, setSlotsRemaining] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  // Price is TBD — checkout is disabled; waitlist CTA is shown instead
  const priceTBD = !HIPAA_ASSESSMENT_ID;

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`/pilot/availability?sku=${SKU}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSlotsRemaining(data.slots_remaining ?? null);
      setSlotsError(false);
    } catch {
      setSlotsError(true);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, SLOT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSlots]);

  const handleStartAssessment = async () => {
    if (checkoutLoading || priceTBD) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackCTAClick('pilot_start', 'hipaa_readiness');
    trackEvent('pilot_checkout_initiated', { sku: SKU, price: PILOT_PRICE });

    try {
      const origin = window.location.origin;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: SKU,
          priceId: HIPAA_ASSESSMENT_ID,
          successUrl: `${origin}/setup?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/pilots/hipaa-readiness`,
          metadata: {
            pilot_sku: SKU,
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
      setCheckoutError(err.message || 'Something went wrong. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const soldOut = slotsRemaining === 0;

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
            <span className="text-teal-400 text-xs font-bold uppercase tracking-widest">Healthcare Entry Point</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Know your HIPAA posture before you need a BAA.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-green-400">
              One-time assessment. No subscription.
            </span>
          </h1>
          <p className="text-lg text-teal-200 max-w-2xl mx-auto mb-8">
            Get a gap report, PHI data flow template, and BAA readiness checklist — one-time, no subscription.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SlotBadge
              slotsRemaining={slotsRemaining}
              loading={slotsLoading}
              error={slotsError}
            />
          </div>
        </div>

        {/* CTA Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12 text-center max-w-lg mx-auto">
          {priceTBD ? (
            <>
              <p className="text-white text-2xl font-black mb-1">Price TBD</p>
              <p className="text-teal-300 text-sm mb-6">One-time payment • Coming soon</p>
            </>
          ) : (
            <>
              <p className="text-white text-2xl font-black mb-1">${PILOT_PRICE.toLocaleString()}</p>
              <p className="text-teal-300 text-sm mb-6">One-time payment • Instant delivery</p>
            </>
          )}

          {checkoutError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {checkoutError}
            </div>
          )}

          {priceTBD ? (
            <div className="space-y-3">
              <p className="text-teal-200 text-sm">
                Price coming soon — join the waitlist to be notified when this assessment launches.
              </p>
              <a
                href="mailto:sales@securebase.tximhotep.com?subject=HIPAA Assessment Waitlist"
                className="w-full bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold py-4 rounded-xl text-base shadow-lg hover:shadow-teal-500/25 transition-all flex items-center justify-center gap-2"
              >
                Join Waitlist →
              </a>
            </div>
          ) : (
            <button
              onClick={handleStartAssessment}
              disabled={checkoutLoading || soldOut}
              className="w-full bg-gradient-to-r from-teal-400 to-green-500 text-gray-900 font-bold py-4 rounded-xl text-base shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {checkoutLoading ? (
                <>
                  <Loader className="animate-spin w-5 h-5" />
                  Redirecting to Stripe…
                </>
              ) : soldOut ? (
                'Join Waitlist →'
              ) : (
                'Start Assessment →'
              )}
            </button>
          )}

          <div className="mt-4 flex flex-col gap-1.5">
            {[
              'No BAA required for this assessment',
              'No subscription required',
              'Credit applied toward Healthcare tier upgrade',
            ].map((line) => (
              <div key={line} className="flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-teal-300">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scope boundary — must be prominent */}
        <div className="bg-amber-900/30 border border-amber-400/40 rounded-xl p-6 mb-12">
          <h3 className="text-amber-200 font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Important scope boundary
          </h3>
          <p className="text-amber-300 text-sm leading-relaxed">
            This assessment does <strong className="text-white">not</strong> constitute a BAA, legal advice, or HIPAA
            certification. It identifies infrastructure gaps and prepares your team for the BAA conversation. A signed
            BAA is <strong className="text-white">required</strong> before handling PHI in production.
          </p>
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
