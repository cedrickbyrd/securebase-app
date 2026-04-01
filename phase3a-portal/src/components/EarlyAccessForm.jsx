import React, { useState } from 'react';

export default function EarlyAccessForm() {
  const [formData, setFormData] = useState({
    email: '',
    company: '',
    message: ''
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    try {
      // Call the Netlify function
      const response = await fetch('/.netlify/functions/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setStatus('success');
        // Redirect to thank you page
        window.location.href = '/thank-you';
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="early-access-form">
      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
      </div>

      <div className="form-group">
        <label htmlFor="company">Company *</label>
        <input
          type="text"
          id="company"
          required
          value={formData.company}
          onChange={(e) => setFormData({...formData, company: e.target.value})}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          rows="4"
          value={formData.message}
          onChange={(e) => setFormData({...formData, message: e.target.value})}
        />
      </div>

      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Request Early Access'}
      </button>

      {status === 'error' && (
        <p className="error">Failed to send. Please try again.</p>
      )}
    </form>
  );
}
