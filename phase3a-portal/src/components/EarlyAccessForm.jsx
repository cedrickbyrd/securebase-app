import React, { useState } from 'react';

const EarlyAccessForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ email: '', company: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const encode = (data) =>
    Object.keys(data)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join('&');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'early-access', ...formData }),
      });
      setSubmitted(true);
      window.location.href = '/thank-you';
    } catch (err) {
      setError('Something went wrong. Please try again or email us directly.');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🎉</div>
        <h3 className="text-2xl font-bold text-white mb-2">You&apos;re on the list!</h3>
        <p className="text-blue-200">We&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        name="early-access"
        method="POST"
        data-netlify="true"
        netlify-honeypot="bot-field"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {/* Required hidden inputs for Netlify */}
        <input type="hidden" name="form-name" value="early-access" />
        <p className="hidden">
          <label>Don&apos;t fill this out if you&apos;re human: <input name="bot-field" /></label>
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-semibold text-white">
            Work Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="you@company.com"
            className="border border-blue-300 bg-white/10 text-white placeholder-blue-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="company" className="text-sm font-semibold text-white">
            Company
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            placeholder="Acme Corp"
            className="border border-blue-300 bg-white/10 text-white placeholder-blue-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="message" className="text-sm font-semibold text-white">
            How can we help?
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            value={formData.message}
            onChange={handleChange}
            placeholder="I need SOC 2 compliance for my fintech startup..."
            className="border border-blue-300 bg-white/10 text-white placeholder-blue-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-2 shadow-lg"
        >
          {isSubmitting ? 'Sending...' : '🚀 Request Early Access'}
        </button>

        <p className="text-blue-200 text-xs text-center">
          No spam. We&apos;ll reach out within 24 hours.
        </p>
      </form>
    </div>
  );
};

export default EarlyAccessForm;
