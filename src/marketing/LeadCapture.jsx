/**
 * LeadCapture.jsx
 *
 * Email gate that sits on the /demo route (see DemoRedirect.jsx).
 * Collects name + work email, POSTs to /api/leads, then redirects the visitor
 * to demo.securebase.tximhotep.com with UTM params preserved.
 *
 * This turns anonymous demo traffic into named leads in the CRM without
 * requiring the visitor to create an account.
 *
 * Lead payload matches the existing /api/leads schema used by ContactSales.jsx.
 *
 * Props:
 *   onSubmit(email, name) — called after successful API response; parent
 *   (DemoRedirect.jsx) handles the actual redirect.
 *   tier — e.g. 'healthcare', 'banking'; used for the GA4 event.
 *   campaign — utm_campaign value for attribution tagging.
 */

import React, { useState } from 'react';
import { Shield, ArrowRight, Loader } from 'lucide-react';
import { trackLeadGateSubmit } from '../utils/analytics';

const SALES_EMAIL = 'sales@securebase.tximhotep.com';

export default function LeadCapture({ onSubmit, tier = 'unknown', campaign = '' }) {
  const [form, setForm]     = useState({ name: '', email: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | error

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          email:       form.email,
          company:     '',              // not collected at gate — low friction
          framework:   tier === 'banking' ? 'ffiec' : tier,
          trigger:     'demo_gate',
          tier,
          source:      'demo_gate',
          viewedPricing: false,
        }),
      });
    } catch (err) {
      // Non-blocking: if the API call fails we still let the visitor through
      // to the demo — losing a lead record is better than blocking the demo.
      if (import.meta.env.DEV) {
        console.error('[LeadCapture] /api/leads request failed:', err);
      }
    }

    trackLeadGateSubmit(tier, campaign);
    setStatus('idle');
    onSubmit(form.email, form.name);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">SecureBase</div>
            <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">TxImhotep LLC</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access the live demo</h1>
        <p className="text-blue-200 text-sm mb-6">
          Enter your work email and we'll send you the demo credentials plus a follow-up
          from our team.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              placeholder="Jane Smith"
              value={form.name}
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
              placeholder="jane@yourbank.com"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:ring-2 focus:ring-[#667eea] focus:outline-none transition"
            />
          </div>

          {status === 'error' && (
            <p className="text-red-300 text-xs">Something went wrong — please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <Loader className="animate-spin w-5 h-5" />
            ) : (
              <>
                Access Demo
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-blue-400 text-center mt-4">
          No spam. One follow-up from our team within 24 hours.
          Questions? <a href={`mailto:${SALES_EMAIL}`} className="underline hover:text-blue-300">{SALES_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
