import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, Star } from 'lucide-react';
import { trackPricingCTA } from '../utils/analytics';

const SALES_EMAIL = 'sales@securebase.tximhotep.com';

const PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'CIS-hardened AWS Landing Zone',
    price: 499,
    priceId: 'price_standard_monthly',
    badge: null,
    features: [
      'CIS Benchmark Level 1 & 2',
      'AWS Organizations + SCPs',
      'IAM Identity Center (SSO)',
      'Centralized CloudTrail logging',
      'GuardDuty & Security Hub',
      'Multi-account OU structure',
      'Break-glass emergency access',
      'Email support (48h SLA)',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    id: 'fintech',
    name: 'Fintech / Healthcare',
    tagline: 'SOC 2 Type II + HIPAA-ready',
    price: 1499,
    priceId: 'price_fintech_monthly',
    badge: 'Most Popular',
    features: [
      'Everything in Standard',
      'SOC 2 Type II controls (209)',
      'HIPAA technical safeguards',
      'Texas DOB compliance (7 TAC §33)',
      'Fintech examiner portal',
      'Row-Level Security (RLS) in Aurora',
      'Compliance PDF reports',
      'Slack + email support (4h SLA)',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise / FedRAMP',
    tagline: 'FedRAMP Moderate + NIST RMF',
    price: 3999,
    priceId: 'price_enterprise_monthly',
    badge: null,
    features: [
      'Everything in Fintech',
      'FedRAMP Moderate baseline',
      'NIST 800-53 Rev 5 controls',
      'Dedicated AWS GovCloud option',
      'Custom SCP guardrails',
      'White-label portal',
      'Multi-region deployment',
      'Dedicated SRE + phone support',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];

const FAQ = [
  {
    q: 'How quickly can I be audit-ready?',
    a: 'Most customers are audit-ready in under 48 hours after onboarding. Our Terraform deploys a pre-hardened Landing Zone that satisfies CIS, SOC 2, and HIPAA controls out of the box.',
  },
  {
    q: 'Do I need an existing AWS Organization?',
    a: 'No. SecureBase provisions a new AWS Organization from scratch, including all OUs, accounts, and SCPs. If you have an existing org, we can import it.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Fintech and Enterprise plans include a 14-day free trial. No credit card required to start.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'All plans are month-to-month with no lock-in. Cancel from the portal at any time.',
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  const handleSelectPlan = (plan) => {
    trackPricingCTA(plan.id);
    if (plan.id === 'enterprise') {
      window.location.href = `mailto:${SALES_EMAIL}?subject=Enterprise%20Inquiry`;
      return;
    }
    navigate(`/checkout?plan=${plan.id}&priceId=${plan.priceId}&planName=${encodeURIComponent(plan.name)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3"
          >
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-slate-600 hover:text-[#667eea] transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black mb-4">
            Audit-Ready AWS{' '}
            <span className="bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
              In Under 48 Hours
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Production-grade AWS Landing Zone with SOC 2, HIPAA, and FedRAMP controls.
            Deploy once. Stay compliant forever.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shadow-2xl scale-105'
                  : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1.5 rounded-full shadow">
                    <Star className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h2>
                <p className={`text-sm ${plan.highlight ? 'text-purple-200' : 'text-slate-500'}`}>
                  {plan.tagline}
                </p>
              </div>

              <div className="mb-8">
                <span className={`text-5xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  ${plan.price.toLocaleString()}
                </span>
                <span className={`text-sm ml-1 ${plan.highlight ? 'text-purple-200' : 'text-slate-500'}`}>
                  /month
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        plan.highlight ? 'text-purple-200' : 'text-[#667eea]'
                      }`}
                    />
                    <span className={`text-sm ${plan.highlight ? 'text-purple-100' : 'text-slate-600'}`}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  plan.highlight
                    ? 'bg-white text-[#667eea] hover:bg-purple-50'
                    : 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white hover:shadow-lg hover:scale-105'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
                <p className="text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="text-center mt-16">
          <p className="text-sm text-slate-500 mb-4">Trusted compliance frameworks</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['CIS Benchmark', 'SOC 2 Type II', 'HIPAA', 'NIST 800-53', 'FedRAMP Moderate', 'Texas 7 TAC §33'].map(
              (badge) => (
                <span
                  key={badge}
                  className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200"
                >
                  {badge}
                </span>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
