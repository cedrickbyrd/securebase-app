import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, Star } from 'lucide-react';
import { trackPricingCTA, trackViewPromotion, trackPilotCTAClick } from '../utils/analytics';
import { mockComplianceData } from '../mock-api';

const PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'CIS-hardened AWS Landing Zone',
    price: 499,
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
    cta: 'Contact Sales →',
    highlight: false,
  },
];

const PILOT_DEADLINE = new Date('2026-06-30T23:59:59');
const PILOT_SPOTS_REMAINING = 8;

const LOCATION_BADGES = ['Dallas', 'Austin', 'Houston'];

const COMPARISON_ROWS = [
  {
    label: 'Controls Automated',
    standard: '50+',
    fintech: '209+',
    enterprise: '325+',
  },
  {
    label: 'Scan Frequency',
    standard: 'Daily',
    fintech: 'Continuous',
    enterprise: 'Continuous',
  },
  {
    label: 'Support Level',
    standard: 'Email',
    fintech: 'Slack + Email',
    enterprise: 'Dedicated SRE',
  },
  {
    label: 'SLA',
    standard: '48h',
    fintech: '4h',
    enterprise: '1h',
  },
  {
    label: 'Compliance PDF Reports',
    standard: false,
    fintech: true,
    enterprise: true,
  },
  {
    label: 'Custom SCP Guardrails',
    standard: false,
    fintech: false,
    enterprise: true,
  },
  {
    label: 'White-label Portal',
    standard: false,
    fintech: false,
    enterprise: true,
  },
];

function getDaysUntil(targetDate) {
  const now = new Date();
  const diff = targetDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

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
  const [complianceData, setComplianceData] = useState(null);
  const [daysRemaining, setDaysRemaining] = useState(getDaysUntil(PILOT_DEADLINE));
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    // Simulate async fetch from mock API
    const timer = setTimeout(() => {
      setComplianceData(mockComplianceData);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Track when a user views the pilot promotion banner (GA4 view_promotion).
    trackViewPromotion('pilot_q2_2026', 'Q2 2026 Pilot Program');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDaysRemaining(getDaysUntil(PILOT_DEADLINE));
    }, 24 * 60 * 60 * 1000); // recalculate once per day; value only changes daily
    return () => clearInterval(interval);
  }, []);

  const handleSelectPlan = (plan) => {
    trackPricingCTA(plan.id);
    if (plan.id === 'enterprise') {
      navigate('/contact-sales?tier=enterprise&source=pricing');
      return;
    }
    navigate(`/checkout?plan=${plan.id}&planName=${encodeURIComponent(plan.name)}`);
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
        <div className="relative text-center mb-16">
          {/* Compliance Score Badge */}
          {complianceData && (
            <div className="absolute top-0 right-0 flex justify-end">
              <div className="relative inline-block">
                <button
                  type="button"
                  aria-label={`Overall compliance score: ${complianceData.overall}%. SOC 2: ${complianceData.frameworks.soc2}%, HIPAA: ${complianceData.frameworks.hipaa}%, FedRAMP: ${complianceData.frameworks.fedramp}%`}
                  aria-describedby="compliance-tooltip"
                  aria-expanded={tooltipVisible}
                  onMouseEnter={() => setTooltipVisible(true)}
                  onMouseLeave={() => setTooltipVisible(false)}
                  onFocus={() => setTooltipVisible(true)}
                  onBlur={() => setTooltipVisible(false)}
                  className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full cursor-default"
                >
                  <span aria-hidden="true" className="text-green-600">✓</span>
                  {complianceData.overall}% Compliant
                </button>
                {tooltipVisible && (
                  <div
                    id="compliance-tooltip"
                    role="tooltip"
                    className="absolute right-0 top-full mt-2 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-10 shadow-lg"
                  >
                    SOC 2: {complianceData.frameworks.soc2}% | HIPAA: {complianceData.frameworks.hipaa}% | FedRAMP: {complianceData.frameworks.fedramp}%
                    <div aria-hidden="true" className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-800 rotate-45" />
                  </div>
                )}
              </div>
            </div>
          )}

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

        {/* Urgency Banner */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="target">🎯</span>
            <div>
              <p className="font-bold text-blue-900">
                {PILOT_SPOTS_REMAINING} pilot spots remaining for Q2 2026
              </p>
              <p className="text-sm text-blue-700">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} until June 30, 2026 deadline
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              trackPilotCTAClick('urgency_banner');
              navigate(`/checkout?plan=pilot_compliance&planName=Compliance+Jumpstart`);
            }}
            className="shrink-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
          >
            Get the $495 Pilot →
            <ArrowRight className="w-4 h-4" />
          </button>
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

        {/* Social Proof Section */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Trusted by 12+ fintech startups
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {LOCATION_BADGES.map((city) => (
              <span
                key={city}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-full border border-slate-200"
              >
                📍 {city}
              </span>
            ))}
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-20 overflow-x-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-slate-900">Feature Comparison</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-slate-500 w-1/4" />
                {PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    className={`py-3 px-4 text-center font-bold ${
                      plan.highlight
                        ? 'text-[#667eea]'
                        : 'text-slate-900'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {plan.name}
                      {plan.badge && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3" />
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, idx) => (
                <tr
                  key={row.label}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                >
                  <td className="py-3 px-4 font-medium text-slate-700 border-t border-slate-100">
                    {row.label}
                  </td>
                  {PLANS.map((plan) => {
                    const val = row[plan.id];
                    return (
                      <td
                        key={plan.id}
                        className={`py-3 px-4 text-center border-t border-slate-100 ${
                          plan.highlight ? 'shadow-lg bg-purple-50' : ''
                        }`}
                      >
                        {typeof val === 'boolean' ? (
                          val ? (
                            <span className="text-green-600 font-bold text-base">✓</span>
                          ) : (
                            <span className="text-slate-300 font-bold text-base">✗</span>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
