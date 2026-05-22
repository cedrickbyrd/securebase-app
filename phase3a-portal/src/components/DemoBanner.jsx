import React from 'react';
import { AlertCircle } from 'lucide-react';
import { trackEvent, trackCTAClick } from '../utils/analytics';
import { isDemoMode } from '../utils/demoData';

const PRICING_URL = 'https://securebase.tximhotep.com/pricing';

const DemoBanner = () => {
  // Show banner in any demo mode: VITE_DEMO_MODE, VITE_USE_MOCK_API, demo_mode localStorage, or ?demo=true
  if (!isDemoMode() && import.meta.env.VITE_USE_MOCK_API !== 'true') return null;

  const bookDemoUrl = import.meta.env.VITE_DEMO_CTA_BOOK_DEMO_URL || 'https://securebase.tximhotep.com/contact';

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
          <a
            href={bookDemoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackCTAClick('book_demo', 'demo_banner')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-400 transition"
          >
            Book Live Demo
          </a>
        </div>
      </div>
    </div>
  );
};

export default DemoBanner;
