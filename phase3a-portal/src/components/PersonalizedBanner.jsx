/**
 * PersonalizedBanner
 *
 * Displays a company-specific top-of-page banner when a visitor arrives
 * via a Wave 3 outreach campaign (utm_campaign=wave3_column|mercury|lithic).
 *
 * Renders nothing for non-Wave-3 sessions.
 */

import React, { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { getWave3Target, trackWave3HighValueAction } from '../utils/analytics';

// ---------------------------------------------------------------------------
// Company-specific configuration
// ---------------------------------------------------------------------------

const WAVE3_CONFIGS = {
  column: {
    badge: '🎯 Exclusive for Column Partners',
    headline: 'Banking infrastructure needs compliance infrastructure',
    urgency: 'First 10 customers get 50% off Year 1',
    cta: 'Schedule Partnership Discussion →',
    ctaUrl: 'https://calendly.com/securebase/column-partnership',
    gradientFrom: 'from-purple-700',
    gradientTo: 'to-purple-500',
    badgeBg: 'bg-purple-900/40',
  },
  mercury: {
    badge: '🚀 For Series B+ Fintech Teams',
    headline: 'Automate compliance for Series B+ fintech platforms',
    urgency: 'Free compliance architecture review',
    cta: 'Schedule Technical Walkthrough →',
    ctaUrl: 'https://calendly.com/securebase/mercury-walkthrough',
    gradientFrom: 'from-blue-700',
    gradientTo: 'to-cyan-500',
    badgeBg: 'bg-blue-900/40',
  },
  lithic: {
    badge: '🤝 Partnership Ecosystem Invite',
    headline: 'Card issuing platforms need audit-ready compliance',
    urgency: 'Co-marketing opportunities available',
    cta: 'Explore Partnership Opportunities →',
    ctaUrl: 'https://calendly.com/securebase/lithic-partnership',
    gradientFrom: 'from-emerald-700',
    gradientTo: 'to-teal-500',
    badgeBg: 'bg-emerald-900/40',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PersonalizedBanner() {
  // Read synchronously from sessionStorage on initial render — no effect needed.
  const [target] = useState(() => getWave3Target());
  const [dismissed, setDismissed] = useState(false);

  if (!target || dismissed) return null;

  const config = WAVE3_CONFIGS[target];
  // Silently hide banner for unknown/future wave3 targets
  if (!config) return null;

  const handleCtaClick = () => {
    trackWave3HighValueAction('clicked_personalized_banner_cta');
    window.open(config.ctaUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} text-white py-3 px-4 shadow-lg`}
      role="banner"
      aria-label={`Personalized offer for ${target} visitors`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        {/* Left: badge + headline + urgency */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${config.badgeBg} mb-1`}
            >
              {config.badge}
            </span>
            <p className="font-semibold text-sm leading-snug">{config.headline}</p>
            <p className="text-xs opacity-80 mt-0.5">{config.urgency}</p>
          </div>
        </div>

        {/* Right: CTA + dismiss */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleCtaClick}
            className="bg-white/20 hover:bg-white/30 transition border border-white/40 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"
          >
            {config.cta}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="opacity-60 hover:opacity-100 transition p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
