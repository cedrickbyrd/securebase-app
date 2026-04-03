import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, ArrowRight, Zap, Building2, Star } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '49',
    description: 'Perfect for small teams and startups.',
    features: [
      '1 AWS Landing Zone',
      'Basic Compliance Pack',
      'Email Support',
      'Single Tenant',
    ],
    cta: 'Get Started',
    mostPopular: false,
    icon: Zap,
    priceId: 'price_starter',
    gradient: 'from-slate-600 to-slate-800',
    accentColor: 'text-slate-600',
    ringColor: 'ring-slate-200',
  },
  {
    name: 'Professional',
    price: '199',
    description: 'Advanced features for growing companies.',
    features: [
      '5 AWS Landing Zones',
      'Full SOC 2 Framework',
      'Priority Support',
      'Multi-Tenant Orchestration',
    ],
    cta: 'Go Pro',
    mostPopular: true,
    icon: Star,
    priceId: 'price_professional',
    gradient: 'from-[#667eea] to-[#764ba2]',
    accentColor: 'text-[#667eea]',
    ringColor: 'ring-[#667eea]',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Large-scale infrastructure management.',
    features: [
      'Unlimited Landing Zones',
      'FedRAMP/HIPAA Ready',
      'Dedicated Architect',
      'Custom Modules',
    ],
    cta: 'Contact Sales',
    mostPopular: false,
    icon: Building2,
    priceId: null,
    gradient: 'from-slate-800 to-slate-900',
    accentColor: 'text-slate-800',
    ringColor: 'ring-slate-300',
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  const handleCTA = (plan) => {
    if (plan.name === 'Enterprise') {
      window.location.href = 'mailto:sales@securebase.io?subject=Enterprise Inquiry';
      return;
    }
    navigate(`/checkout?plan=${encodeURIComponent(plan.name)}&priceId=${plan.priceId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
            aria-label="SecureBase home"
          >
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </button>

          <nav className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="text-sm font-semibold text-slate-600 hover:text-[#667eea] transition-colors"
            >
              Overview
            </button>
            <button
              className="text-sm font-semibold text-[#667eea]"
              aria-current="page"
            >
              Pricing
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all"
            >
              Sign In
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center pt-20 pb-12 px-6">
        <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 text-[#667eea] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
          <Shield className="w-3.5 h-3.5" />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-5xl md:text-6xl font-black mb-6">
          Audit-Ready AWS,{' '}
          <span className="bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
            Any Scale
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Start free and scale as you grow. Every plan includes SOC 2 monitoring,
          real-time security alerts, and 48-hour onboarding.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col bg-white rounded-2xl shadow-sm border transition-all hover:shadow-xl hover:-translate-y-1 ${
                  plan.mostPopular
                    ? 'ring-2 ring-[#667eea] shadow-lg scale-105'
                    : 'border-slate-200'
                }`}
              >
                {plan.mostPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-xs font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <div className={`bg-gradient-to-br ${plan.gradient} p-6 rounded-t-2xl`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Icon className="text-white w-5 h-5" />
                    </div>
                    <h2 className="text-white text-xl font-black">{plan.name}</h2>
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    {plan.price === 'Custom' ? (
                      <span className="text-white text-4xl font-black">Custom</span>
                    ) : (
                      <>
                        <span className="text-white/70 text-xl font-bold self-start mt-1">$</span>
                        <span className="text-white text-5xl font-black">{plan.price}</span>
                        <span className="text-white/70 text-sm font-medium self-end mb-1">/mo</span>
                      </>
                    )}
                  </div>
                  <p className="text-white/80 text-sm">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="p-6 flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-50 flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-sm text-slate-700 font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCTA(plan)}
                    className={`w-full py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      plan.mostPopular
                        ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white hover:shadow-lg hover:scale-[1.02]'
                        : 'bg-slate-900 text-white hover:bg-slate-700'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Strip */}
        <div className="mt-16 text-center">
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-6">
            Trusted by compliance-first teams
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm font-medium">
            {['SOC 2 Type II', 'HIPAA Ready', 'FedRAMP Path', 'PCI-DSS', 'ISO 27001'].map((badge) => (
              <div key={badge} className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#667eea]" />
                {badge}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Teaser */}
        <div className="mt-16 bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-black mb-2">Have questions?</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-lg mx-auto">
            Our team can walk you through onboarding, compliance requirements, and custom
            deployment options for your stack.
          </p>
          <a
            href="mailto:sales@securebase.io"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#667eea] text-[#667eea] rounded-xl font-bold text-sm hover:bg-purple-50 transition-colors"
          >
            Talk to an Expert
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
