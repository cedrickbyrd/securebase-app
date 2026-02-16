import React, { useState } from 'react';

// Stripe integration for payment (loaded dynamically when needed)
// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const TIERS = {
  standard: {
    name: 'Standard',
    price: 2000,
    pilotPrice: 1000,
    description: 'CIS Foundations compliant AWS Landing Zone',
    features: [
      'CIS AWS Foundations Benchmark',
      'Security Hub monitoring',
      'CloudTrail audit logging',
      'Config compliance tracking',
      '90-day log retention',
      'Email support',
    ],
  },
  fintech: {
    name: 'Fintech',
    price: 8000,
    pilotPrice: 4000,
    description: 'SOX2 + SOC2 Ready Infrastructure for Financial Services',
    features: [
      'SOX2 Section 404 controls',
      'SOC2 Type II (all 5 TSC)',
      'All Standard features',
      'GuardDuty threat detection',
      '1-year log retention',
      'Quarterly compliance reports',
      'Priority support',
    ],
  },
  healthcare: {
    name: 'Healthcare',
    price: 15000,
    pilotPrice: 7500,
    description: 'HIPAA-compliant AWS Landing Zone',
    features: [
      'HIPAA compliance framework',
      'All Fintech features',
      '7-year audit log retention',
      'Encrypted EBS volumes',
      'Monthly compliance reports',
      'Dedicated support engineer',
    ],
  },
  government: {
    name: 'Government',
    price: 25000,
    pilotPrice: 12500,
    description: 'FedRAMP-aligned infrastructure',
    features: [
      'FedRAMP Moderate controls',
      'All Healthcare features',
      'Advanced threat monitoring',
      'Incident response SLA',
      'Continuous compliance monitoring',
      '24/7 priority support',
    ],
  },
};

const Signup = () => {
  const [selectedTier, setSelectedTier] = useState('fintech');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    usePilot: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call backend to create checkout session
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: selectedTier,
          email: formData.email,
          name: formData.company,
          use_pilot_coupon: formData.usePilot,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting errors with specific messages
        if (response.status === 429) {
          const nextDate = data.next_signup_date;
          const errorMsg = nextDate 
            ? `This email was recently used. You can sign up again on ${nextDate}.`
            : data.error || 'Rate limit exceeded. Please try again later.';
          throw new Error(errorMsg);
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const tier = TIERS[selectedTier];
  const displayPrice = formData.usePilot ? tier.pilotPrice : tier.price;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              Start Your Free Trial
            </h1>
            <p className="text-xl text-gray-300">
              Deploy production-ready AWS infrastructure in 48 hours
            </p>
            <div className="mt-4 inline-block bg-yellow-400 text-gray-900 px-6 py-3 rounded-full font-bold">
              🎉 Pilot Program: 50% OFF for first 20 customers
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Tier Selection */}
            <div className="bg-white rounded-xl shadow-2xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Choose Your Tier
              </h2>

              <div className="space-y-4">
                {Object.entries(TIERS).map(([key, tierData]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTier(key)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedTier === key
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {tierData.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {tierData.description}
                        </p>
                      </div>
                      <div className="text-right">
                        {formData.usePilot && (
                          <div className="text-xs text-gray-500 line-through">
                            ${(tierData.price).toLocaleString()}/mo
                          </div>
                        )}
                        <div className="text-xl font-bold text-gray-900">
                          ${displayPrice === tierData.pilotPrice ? tierData.pilotPrice.toLocaleString() : tierData.price.toLocaleString()}/mo
                        </div>
                      </div>
                    </div>
                    
                    <ul className="mt-3 space-y-1">
                      {tierData.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-center">
                          <span className="text-green-600 mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              {/* Pilot Program Toggle */}
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="usePilot"
                    checked={formData.usePilot}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Apply Pilot Program discount (50% off for 6 months)
                  </span>
                </label>
              </div>
            </div>

            {/* Signup Form */}
            <div className="bg-white rounded-xl shadow-2xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Your Information
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                {/* Pricing Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Selected Tier:</span>
                    <span className="font-bold text-gray-900">{tier.name}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Monthly Price:</span>
                    <span className="font-bold text-gray-900">
                      ${displayPrice.toLocaleString()}
                    </span>
                  </div>
                  {formData.usePilot && (
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Pilot Savings:</span>
                      <span className="font-bold">
                        -${((tier.price - tier.pilotPrice) * 6).toLocaleString()} (over 6 months)
                      </span>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-900">
                        Trial Period:
                      </span>
                      <span className="font-bold text-blue-600">
                        30 days FREE
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Start Free Trial → Proceed to Payment`
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  No credit card required for trial. Cancel anytime during the 30-day trial period.
                </p>
              </form>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-8 text-gray-300">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>SOC2 Type II Certified</span>
              </div>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>AWS Partner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
