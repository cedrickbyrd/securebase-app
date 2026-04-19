import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Clock, Loader, AlertCircle, Lock, FileText, Zap } from 'lucide-react';
import { PILOT_COMPLIANCE_ID } from '../config/live-config';
import { trackEvent, trackCTAClick } from '../utils/analytics';

const SKU = 'pilot_compliance';
const PILOT_PRICE = 495;
const SLOT_POLL_INTERVAL_MS = 30_000;

const DELIVERABLES = [
  { icon: <FileText className="w-5 h-5 text-green-400" />, label: 'Terraform modules for a SOC 2–ready AWS Landing Zone' },
  { icon: <CheckCircle className="w-5 h-5 text-green-400" />, label: 'Compliance Matrix PDF mapping controls to code' },
  { icon: <Zap className="w-5 h-5 text-green-400" />, label: 'Deploy in 60 minutes — not 60 days' },
  { icon: <Lock className="w-5 h-5 text-green-400" />, label: 'CloudTrail, Config, Security Hub — pre-wired' },
  { icon: <Shield className="w-5 h-5 text-green-400" />, label: 'CIS AWS Foundations Benchmark applied by default' },
];

const FAQS = [
  {
    q: 'What exactly do I get for $495?',
    a: 'A production-ready zip containing Terraform modules that deploy a SOC 2–aligned AWS Landing Zone, plus a Compliance Matrix PDF that maps each control to the specific code. You can deploy in under 60 minutes.',
  },
  {
    q: 'Does this include audit representation or a SOC 2 certificate?',
    a: 'No. This pilot provides the infrastructure code and compliance mapping. Professional audit representation is available as an enterprise upgrade — reach out to sales@securebase.tximhotep.com.',
  },
  {
    q: 'What AWS services does the Landing Zone configure?',
    a: 'CloudTrail (multi-region), AWS Config, Security Hub (CIS Benchmark), GuardDuty, IAM best practices, S3 Object Lock for audit logs, and encrypted EBS volumes.',
  },
  {
    q: 'Can I run this in my existing AWS account?',
    a: 'Yes. The Terraform modules target a single AWS account and do not require AWS Organizations. You get an isolated, compliance-first baseline that you can extend.',
  },
];

function SlotBadge({ slotsRemaining, loading, error }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-sm">
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
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-sm font-semibold">
      <Clock className="w-3.5 h-3.5" />
      {slotsRemaining} spot{slotsRemaining !== 1 ? 's' : ''} remaining
    </span>
  );
}

export default function ComplianceJumpstart() {
  const navigate = useNavigate();
  const [slotsRemaining, setSlotsRemaining] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

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

  const handleStartPilot = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackCTAClick('pilot_start', 'compliance_jumpstart');
    trackEvent('pilot_checkout_initiated', { sku: SKU, price: PILOT_PRICE });

    try {
      const origin = window.location.origin;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: SKU,
          priceId: PILOT_COMPLIANCE_ID,
          successUrl: `${origin}/setup?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/pilots/compliance-jumpstart`,
          metadata: {
            pilot_sku: 'pilot_compliance',
            provision_type: 'landing_zone_soc2',
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
      console.error('Pilot checkout error:', err);
      setCheckoutError(err.message || 'Something went wrong. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const soldOut = slotsRemaining === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 font-sans">
      {/* Nav */}
      <header className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-base font-bold text-white">SecureBase</div>
              <div className="text-[9px] uppercase tracking-widest text-blue-300 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <a
            href="mailto:sales@securebase.tximhotep.com"
            className="text-sm text-blue-300 hover:text-white transition-colors"
          >
            Questions? Email us
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/30">
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Limited Pilot</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Stop guessing at SOC&nbsp;2.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
              Deploy a compliant AWS Landing Zone in 60 minutes.
            </span>
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-8">
            Get production-ready Terraform modules and a Compliance Matrix PDF for&nbsp;
            <span className="text-white font-bold">$495</span> — one-time, no subscription.
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
          <p className="text-white text-2xl font-black mb-1">$495</p>
          <p className="text-blue-300 text-sm mb-6">One-time payment • Instant delivery</p>

          {checkoutError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {checkoutError}
            </div>
          )}

          <button
            onClick={handleStartPilot}
            disabled={checkoutLoading || soldOut}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold py-4 rounded-xl text-base shadow-lg hover:shadow-yellow-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checkoutLoading ? (
              <>
                <Loader className="animate-spin w-5 h-5" />
                Redirecting to Stripe…
              </>
            ) : soldOut ? (
              'Join Waitlist →'
            ) : (
              'Start Pilot — $495 →'
            )}
          </button>

          <div className="mt-4 flex flex-col gap-1.5">
            {[
              'Secured by Stripe — PCI DSS Level 1',
              'Instant access after payment',
              'No subscription required',
            ].map((line) => (
              <div key={line} className="flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-blue-300">{line}</span>
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
                <span className="text-blue-100 text-sm">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scope boundary */}
        <div className="bg-blue-900/30 border border-blue-400/20 rounded-xl p-6 mb-12">
          <h3 className="text-blue-200 font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Scope boundary
          </h3>
          <p className="text-blue-300 text-sm leading-relaxed">
            This pilot provides the <strong className="text-white">infrastructure code and compliance mapping</strong> only.
            Professional audit representation, BAA drafting, and SOC 2 certification support are available as an
            enterprise upgrade — contact{' '}
            <a href="mailto:sales@securebase.tximhotep.com" className="underline text-blue-200 hover:text-white">
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
                <p className="text-sm text-blue-200 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-blue-400 py-8 border-t border-white/10 mt-8">
        © {new Date().getFullYear()} TxImhotep LLC · SecureBase ·{' '}
        <a href="mailto:sales@securebase.tximhotep.com" className="underline hover:text-blue-200">
          sales@securebase.tximhotep.com
        </a>
      </footer>
    </div>
  );
}
