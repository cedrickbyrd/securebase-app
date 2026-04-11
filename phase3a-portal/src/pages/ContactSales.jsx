import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, Loader, BarChart2 } from 'lucide-react';
import { submitLead } from '../services/crmService';

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
};

const DEFAULT_MESSAGING = {
  heading: 'Schedule Your Enterprise Demo',
  subheading: "Tell us about your compliance needs and we'll tailor a pilot program for you.",
};

const LEAD_PREVIEW_URL = '/api/lead-preview-auth';
const DEMO_CUSTOMER_ID = 'a0000000-0000-0000-0000-000000000001';
const REDIRECT_DELAY_MS = 4000;

export default function ContactSales({ setAuth }) {
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
    employees: '',
    timeline: '',
    message: '',
  });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_MS / 1000);
  const countdownRef = useRef(null);

  // Auto-redirect countdown after success
  useEffect(() => {
    if (status !== 'success') return;
    setCountdown(REDIRECT_DELAY_MS / 1000);
    const intervalId = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalId);
          navigate('/sre-dashboard');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    countdownRef.current = intervalId;
    return () => clearInterval(intervalId);
  }, [status, navigate]);

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');

    try {
      await submitLead({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        role: formData.framework,
        message: formData.message,
        trigger: 'contact_sales',
        viewedPricing: true,
      });
    } catch (err) {
      console.error('[CONTACT_SALES] lead submission error:', err);
      // Non-blocking: continue to issue preview even if lead save fails
    }

    // Request a limited-time JWT cookie for immediate SRE Dashboard access
    try {
      const previewRes = await fetch(LEAD_PREVIEW_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      if (!previewRes.ok) {
        console.warn('[CONTACT_SALES] lead-preview-auth returned status:', previewRes.status);
      }
    } catch (err) {
      // Non-blocking: cookie is best-effort; demo_mode localStorage is the
      // primary auth signal for the SPA.
      console.warn('[CONTACT_SALES] lead-preview-auth request failed (non-blocking):', err?.message);
    }

    // Seed demo session so the SPA's isAuthenticated guard passes
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('demo_user', JSON.stringify({
      email: formData.email,
      customerId: DEMO_CUSTOMER_ID,
      orgName: formData.company || 'Your Organization',
    }));
    if (typeof setAuth === 'function') {
      setAuth(true);
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
                Our team will reach out within one business day. Your limited-time SRE Dashboard
                preview is ready — no login needed.
              </p>
              <button
                onClick={() => {
                  clearInterval(countdownRef.current);
                  navigate('/sre-dashboard');
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-[#667eea] hover:from-purple-500 hover:to-[#5a6fd6] text-white font-bold py-3 px-8 rounded-lg transition mb-4 shadow-lg"
              >
                <BarChart2 className="w-5 h-5" />
                Launch SRE Dashboard
              </button>
              <p className="text-blue-400 text-xs mb-5">
                Redirecting automatically in {countdown}s…
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
            <>
              <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8 mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">{messaging.heading}</h1>
                <p className="text-blue-200 text-sm mb-8">{messaging.subheading}</p>

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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                        Company Size
                      </label>
                      <select
                        name="employees"
                        value={formData.employees}
                        onChange={handleChange}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                      >
                        <option value="" className="bg-gray-900 text-white">Select…</option>
                        <option value="1-50" className="bg-gray-900 text-white">1–50 employees</option>
                        <option value="51-200" className="bg-gray-900 text-white">51–200 employees</option>
                        <option value="201-1000" className="bg-gray-900 text-white">201–1,000 employees</option>
                        <option value="1000+" className="bg-gray-900 text-white">1,000+ employees</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                        Timeline
                      </label>
                      <select
                        name="timeline"
                        value={formData.timeline}
                        onChange={handleChange}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
                      >
                        <option value="" className="bg-gray-900 text-white">Select…</option>
                        <option value="immediate" className="bg-gray-900 text-white">Immediate (0–30 days)</option>
                        <option value="quarter" className="bg-gray-900 text-white">This quarter (1–3 months)</option>
                        <option value="planning" className="bg-gray-900 text-white">Planning phase (3+ months)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                      Compliance Requirements (optional)
                    </label>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="Tell us about your compliance timeline, team size, or any questions…"
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:ring-2 focus:ring-[#667eea] focus:outline-none transition resize-none"
                    />
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
                      'Request Enterprise Demo'
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

              {/* What to Expect */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4">What to Expect:</h3>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    30-minute consultation with a compliance expert
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    Custom demo of your compliance framework
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    Tailored proposal with implementation timeline
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    Pricing aligned to your organization size
                  </li>
                  {tierParam === 'healthcare' && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      Signed Business Associate Agreement (BAA) provided immediately upon demo completion
                    </li>
                  )}
                  {tierParam === 'government' && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      Authority to Operate (ATO) roadmap and FedRAMP documentation support
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

