/**
 * ExitIntentModal
 *
 * Detects when a user's cursor leaves the top of the viewport (heading towards
 * the address bar / tab bar) and presents a last-chance lead capture offer.
 *
 * Guards:
 *   - Only shown once per browser session (sessionStorage key 'sb_exit_shown').
 *   - Skipped when the visitor has already submitted a lead (localStorage).
 *   - Respects prefers-reduced-motion via CSS (no JS-level suppression needed).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import LeadCaptureForm from './LeadCaptureForm';
import { trackExitIntentShown, trackExitIntentDismissed, trackWave3HighValueAction } from '../utils/analytics';
import { getStoredLead } from '../services/crmService';

const SESSION_KEY = 'sb_exit_shown';

export default function ExitIntentModal() {
  const [visible, setVisible] = useState(false);

  const handleMouseLeave = useCallback(
    (e) => {
      // Only trigger when cursor exits strictly above the viewport top.
      // relatedTarget === null means the cursor left the browser window entirely.
      // clientY < 0 ensures we only respond to upward exits (towards address bar).
      if (e.relatedTarget !== null || e.clientY >= 0) return;

      const alreadyShown = sessionStorage.getItem(SESSION_KEY);
      const alreadyConverted = !!getStoredLead()?.email;

      if (alreadyShown || alreadyConverted) return;

      sessionStorage.setItem(SESSION_KEY, '1');
      setVisible(true);
      trackExitIntentShown();

      // If this is a Wave 3 session, record it as a high-value action too
      try {
        trackWave3HighValueAction('exit_intent_triggered');
      } catch {
        // trackWave3HighValueAction silently no-ops for non-Wave-3 sessions
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [handleMouseLeave]);

  const handleDismiss = () => {
    setVisible(false);
    trackExitIntentDismissed();
  };

  const handleSuccess = () => {
    // Keep modal visible briefly so the success state is seen, then close
    setTimeout(() => setVisible(false), 2500);
  };

  if (!visible) return null;

  return (
    // Backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Before you go — free resource offer"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      {/* Modal card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Illustration / icon */}
        <div className="text-center mb-6">
          <span className="text-5xl" role="img" aria-label="document">📋</span>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mt-2">
            Wait — before you go
          </p>
        </div>

        <LeadCaptureForm
          trigger="exit_intent"
          onSuccess={handleSuccess}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}
