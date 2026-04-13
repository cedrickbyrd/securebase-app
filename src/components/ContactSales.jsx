import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, Loader } from 'lucide-react';

const SALES_EMAIL = 'sales@securebase.tximhotep.com';

const FRAMEWORK_OPTIONS = [
  { value: 'soc2', label: 'SOC 2 (Fintech / SaaS)' },
  { value: 'hipaa', label: 'HIPAA (Healthcare)' },
  { value: 'fedramp', label: 'FedRAMP (Government)' },
  { value: 'cis', label: 'CIS Foundations (General)' },
];

const TIER_TO_FRAMEWORK = {
  healthcare: 'hipaa',
  government: 'fedramp',
  fintech: 'soc2',
  standard: 'cis',
  enterprise: 'fedramp',
};

const TIER_MESSAGING = {
  healthcare: {
    heading: 'Schedule Your Healthcare Demo',
    subheading: "Let's discuss your HIPAA compliance requirements, BAA needs, and PHI protection strategy.",
  },
  government: {
    heading: 'Schedule Your Government Demo',
    subheading: "Let's discuss FedRAMP alignment, Authority to Operate (ATO) support, and FIPS 140-2 requirements.",
  },
  enterprise: {
    heading: 'Schedule Your Enterprise Demo',
    subheading: "Let's discuss FedRAMP Moderate, NIST 800-53, and your dedicated AWS GovCloud options.",
  },
};

const DEFAULT_MESSAGING = {
  heading: 'Contact Sales',
  subheading: "Tell us about your compliance needs and we'll tailor a solution for you.",
};

export default function ContactSales() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tierParam = searchParams.get('tier') || '';
  const messaging = TIER_MESSAGING[tierParam] || DEFAULT_MESSAGING;
  const defaultFramework = TIER_TO_FRAMEWORK[tierParam] || 'soc2';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    framework: defaultFramework,
  });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          role: formData.framework,
          trigger: 'contact_sales',
          tier: tierParam || 'enterprise',
          source: searchParams.get('source') || 'pricing',
          viewedPricing: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
    } catch (_err) {
      // Non-blocking: fall back to mailto if API fails
      const subject = encodeURIComponent(`${tierParam || 'Enterprise'} Inquiry — ${formData.company}`);
      const body = encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\nFramework: ${formData.framework}`
      );
      window.open(`mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`);
    }

    setStatus('success');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-white">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">TxImhotep LLC</div>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          {status === 'success' ? (
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-10 text-center">
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Request Received!</h2>
              <p className="text-blue-200 mb-6">
                Our team will reach out within one business day to schedule your demo.
              </p>
              <a
                href="https://calendly.com/securebase/white-glove-pilot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-lg transition"
              >
                📅 Book a Call Now
              </a>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
              <h1 className="text-3xl font-bold text-white mb-2">{messaging.heading}</h1>
              <p className="text-blue-200 text-sm mb-6">{messaging.subheading}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Jane Smith"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="jane@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    placeholder="Acme Corp"
                    value={formData.company}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                    Compliance Framework
                  </label>
                  <select
                    name="framework"
                    value={formData.framework}
                    onChange={handleChange}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                  >
                    {FRAMEWORK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader className="animate-spin w-5 h-5" />
                      Sending…
                    </>
                  ) : (
                    'Request Demo'
                  )}
                </button>

                <p className="text-xs text-blue-400 text-center">
                  Response within 24 hours · Custom pricing available
                </p>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <p className="text-blue-300 text-xs">
                  Prefer to self-schedule?{' '}
                  <a
                    href="https://calendly.com/securebase/white-glove-pilot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-200 underline font-semibold"
                  >
                    Book a time on Calendly
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
