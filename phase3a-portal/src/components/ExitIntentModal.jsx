/**
 * ExitIntentModal
 * Detects when the user's cursor moves above the viewport (typical tab-close
 * gesture) and presents a last-chance lead-capture offer.
 *
 * Shows at most once per browser session.
 */

import React, { useState, useEffect, useCallback } from 'react';
import LeadCaptureForm from './LeadCaptureForm';
import { trackWave3HighValueAction, trackCTAClick } from '../utils/analytics';

const SESSION_KEY = 'sb_exit_intent_shown';
const EXIT_THRESHOLD = 10; // pixels from top of viewport

export default function ExitIntentModal() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => !!sessionStorage.getItem(SESSION_KEY)
  );

  const handleMouseOut = useCallback(
    (e) => {
      // Only trigger when cursor exits through the top of the viewport
      if (e.clientY < EXIT_THRESHOLD && !dismissed) {
        setVisible(true);
        setDismissed(true);
        sessionStorage.setItem(SESSION_KEY, '1');
        trackWave3HighValueAction('exit_intent_triggered');
      }
    },
    [dismissed]
  );

  useEffect(() => {
    if (dismissed) return;
    document.addEventListener('mouseout', handleMouseOut);
    return () => document.removeEventListener('mouseout', handleMouseOut);
  }, [dismissed, handleMouseOut]);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    trackCTAClick('exit_intent_dismiss', 'exit_intent_modal');
  };

  const handleSuccess = () => {
    setTimeout(() => setVisible(false), 2500);
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Before you go">
      <div style={styles.modal}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={styles.closeBtn}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Content */}
        <div style={styles.icon}>📘</div>
        <h2 style={styles.heading}>Wait! Before you go…</h2>
        <p style={styles.subheading}>
          Get our <strong>"SOC 2 in 90 Days"</strong> implementation guide — free.
        </p>
        <p style={styles.copy}>
          Practical steps, control mappings, and audit-readiness templates used by
          500+ regulated companies.
        </p>

        <LeadCaptureForm trigger="exit_intent" onSuccess={handleSuccess} />

        <p style={styles.privacy}>
          No spam. Unsubscribe any time.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modal: {
    position: 'relative',
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    maxWidth: '460px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: '#6b7280',
    lineHeight: 1,
    padding: '0.25rem 0.5rem',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.5rem',
  },
  subheading: {
    fontSize: '1rem',
    color: '#374151',
    margin: '0 0 0.5rem',
  },
  copy: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '0 0 1.25rem',
    lineHeight: 1.5,
  },
  privacy: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.75rem',
  },
};
