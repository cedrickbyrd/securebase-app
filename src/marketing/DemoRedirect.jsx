/**
 * DemoRedirect.jsx
 *
 * The /demo route.  Shows a LeadCapture gate, then redirects the visitor to
 * demo.securebase.tximhotep.com with all UTM params appended so demo traffic
 * stays attributed in GA4 even though it crosses to a different subdomain.
 *
 * Without this, every link to demo.securebase.tximhotep.com loses the UTM
 * attribution at the subdomain boundary.
 */

import React, { useState } from 'react';
import LeadCapture from './LeadCapture';
import { buildUtmPassthrough, detectVertical, getSessionAttribution } from './utmCapture';
import { getStoredAttribution } from '../utils/trackingUtils';

const DEMO_BASE = 'https://demo.securebase.tximhotep.com';

function getDemoUrl() {
  const qs = buildUtmPassthrough();
  return `${DEMO_BASE}${qs}`;
}

function getTierAndCampaign() {
  const vertical = detectVertical();
  const tier = vertical === 'banking' ? 'banking' : vertical === 'healthcare' ? 'healthcare' : 'unknown';
  const attribution = getSessionAttribution() || getStoredAttribution() || {};
  const campaign = attribution.utm_campaign || '';
  return { tier, campaign };
}

export default function DemoRedirect() {
  const [submitted, setSubmitted] = useState(false);
  const { tier, campaign } = getTierAndCampaign();

  function handleLeadSubmit() {
    setSubmitted(true);
    // Small delay so the user sees a brief confirmation before leaving.
    setTimeout(() => {
      window.location.href = getDemoUrl();
    }, 800);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl font-bold mb-2">Opening demo…</div>
          <div className="text-blue-300 text-sm">Redirecting to demo.securebase.tximhotep.com</div>
        </div>
      </div>
    );
  }

  return (
    <LeadCapture
      onSubmit={handleLeadSubmit}
      tier={tier}
      campaign={campaign}
    />
  );
}
