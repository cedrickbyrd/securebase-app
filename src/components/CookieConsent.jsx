/**
 * @file CookieConsent.jsx
 * @description HIPAA-compliant cookie-consent banner for SecureBase marketing site.
 *
 * Renders a sticky bottom banner the first time a visitor lands on the site.
 * On acceptance the GA4 consent state is updated to 'granted' so that
 * initializeAnalytics() can begin sending events.
 *
 * On decline the state is set to 'denied' and analytics remain fully disabled.
 *
 * @see src/utils/analytics.js – getConsent / setConsent
 * @see CLAUDE.md – "Cookie Consent Banner (GDPR/CCPA Requirement)"
 */

import React, { useState, useEffect } from 'react';
import { setConsent, initializeAnalytics, SessionTracking } from '../utils/analytics';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // getConsent() is the single source of truth for consent state.
    // Show the banner only when the user hasn't made a choice yet.
    try {
      const hasChoice = localStorage.getItem('analytics_consent') !== null;
      if (!hasChoice) setVisible(true);
    } catch {
      // localStorage unavailable (private browsing with restrictions) — skip banner.
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    setConsent(true);
    // initializeAnalytics() is synchronous; logSessionStart() runs after setup completes.
    initializeAnalytics();
    SessionTracking.logSessionStart();
    setVisible(false);
  };

  const handleDecline = () => {
    setConsent(false);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-4 shadow-2xl border-t border-gray-700"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-300 max-w-2xl">
          We use analytics to improve your experience.{' '}
          <strong className="text-white">No personal health information is ever tracked.</strong>{' '}
          IP addresses are anonymised and advertising features are disabled.{' '}
          <a
            href="/trust"
            className="underline text-blue-300 hover:text-blue-200 transition-colors"
          >
            Privacy details
          </a>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm border border-gray-500 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-bold"
          >
            Accept Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
