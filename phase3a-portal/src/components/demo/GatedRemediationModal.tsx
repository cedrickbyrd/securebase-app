import React, { useState } from 'react';

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
  }
}

interface GatedRemediationModalProps {
  domain: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

const CONSUMER_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'zoho.com'
];

export const GatedRemediationModal: React.FC<GatedRemediationModalProps> = ({
  domain,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailParts = email.trim().toLowerCase().split('@');
    if (emailParts.length !== 2) {
      setError('Please provide a valid corporate email address.');
      return;
    }

    const emailDomain = emailParts[1];
    if (CONSUMER_EMAIL_DOMAINS.includes(emailDomain)) {
      setError('Please provide your corporate banking or enterprise email address.');
      return;
    }

    setIsSubmitting(true);

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'lead_captured', {
        email: email.trim(),
        institution_domain: domain,
        action: 'UNLOCK_REMEDIATION_BLUEPRINT'
      });
    }

    try {
      await fetch('/api/demo/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          targetDomain: domain,
          action: 'UNLOCK_REMEDIATION_BLUEPRINT',
          timestamp: new Date().toISOString()
        })
      });
    } catch {
      // Fail open to maximize lead conversion and user experience
    } finally {
      setIsSubmitting(false);
      onSuccess(email.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm"
        >
          ✕
        </button>

        <div className="w-12 h-12 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight">
          Unlock In-Tenant Remediation Blueprint
        </h3>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
          Access the complete FFIEC/FDIC Audit Attestation crosswalks, automated Terraform HCL guardrails, and <code className="text-emerald-400">securebase-mcp</code> pre-flight policies for your environment.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jason McCain"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Corporate Banking / Enterprise Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`name@${domain}`}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {error && <p className="text-rose-400 text-xs font-mono">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-600/20 text-sm disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Unlocking Blueprint...' : 'Unlock Remediation & Policy Code →'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-4">
          100% In-Tenant Read-Only. Zero NPI egress. Delivered directly to your corporate inbox.
        </p>
      </div>
    </div>
  );
};

export default GatedRemediationModal;
