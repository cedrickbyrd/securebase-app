import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';

const DemoBanner = () => {
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const showBanner = import.meta.env.VITE_SHOW_DEMO_BANNER === 'true';
  
  if (!demoMode || !showBanner) return null;

  const trialUrl = import.meta.env.VITE_DEMO_CTA_TRIAL_URL || 'https://portal.securebase.io/signup';
  const bookDemoUrl = import.meta.env.VITE_DEMO_CTA_BOOK_DEMO_URL || 'https://calendly.com/securebase/demo';

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
        
        <div className="flex gap-3 flex-wrap">
          <a
            href={trialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition flex items-center gap-2"
          >
            Start Free Trial
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={bookDemoUrl}
            target="_blank"
            rel="noopener noreferrer"
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
