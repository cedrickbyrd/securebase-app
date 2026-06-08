import React from 'react';
import { AlertCircle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { isDemoMode } from '../utils/demoData';

const PRICING_URL = 'https://securebase.tximhotep.com/pricing';

const DemoBanner = () => {
  // isDemoMode() covers VITE_DEMO_MODE, localStorage demo_mode, and ?demo=true.
  // Also show when VITE_USE_MOCK_API=true (mock-API dev mode), which isDemoMode() does not cover.
  if (!isDemoMode() && import.meta.env.VITE_USE_MOCK_API !== 'true') return null;

  const handlePricingClick = () => {
    trackEvent('demo_to_pricing_cta_click', { source_page: window.location.pathname });
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              🎯 This is a demo environment with sample data
            </p>
            <p className="text-xs text-blue-100">
              All data resets every 24 hours. No real customer information shown.
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <a
            href={PRICING_URL}
            onClick={handlePricingClick}
            className="gradient-bg text-white border-2 border-white px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition shadow-md"
          >
            Ready to deploy? See pricing →
          </a>
        </div>
      </div>
    </div>
  );
};

export default DemoBanner;
