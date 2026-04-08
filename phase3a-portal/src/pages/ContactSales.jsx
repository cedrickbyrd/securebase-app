import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Loader } from 'lucide-react';
import { submitLead } from '../services/crmService';

const FRAMEWORK_OPTIONS = [
  { value: 'soc2', label: 'SOC 2 (Fintech / SaaS)' },
  { value: 'hipaa', label: 'HIPAA (Healthcare)' },
  { value: 'fedramp', label: 'FedRAMP (Government)' },
  { value: 'cis', label: 'CIS Foundations (General)' },
];

export default function ContactSales() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    framework: 'soc2',
    message: '',
  });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

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
      setStatus('success');
    } catch (err) {
      console.error('[CONTACT_SALES] submission error:', err);
      setErrorMsg('Something went wrong. Please email sales@securebase.tximhotep.com directly.');
      setStatus('error');
    }
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
                Our team will reach out within one business day. In the meantime, explore the demo.
              </p>
              <a
                href="https://calendly.com/securebase/white-glove-pilot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-lg transition mb-4"
              >
                📅 Book a Call Now
              </a>
              <div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-blue-300 hover:text-white text-sm underline transition"
                >
                  Or continue exploring the demo →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
              <h1 className="text-3xl font-bold text-white mb-2">Talk to Sales</h1>
              <p className="text-blue-200 text-sm mb-8">
                Tell us about your compliance needs and we'll tailor a pilot program for you.
              </p>

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

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                    Message (optional)
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

                {status === 'error' && (
                  <p className="text-red-400 text-sm bg-red-900/30 border border-red-500/30 p-3 rounded-lg">
                    {errorMsg}
                  </p>
                )}

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
                    'Request a Demo Call'
                  )}
                </button>
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
