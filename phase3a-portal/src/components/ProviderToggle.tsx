import React from 'react';
import { trackDemoEvent } from '../telemetry/demoBeacon';

export type CloudProvider = 'aws' | 'gcp';

interface ProviderToggleProps {
  currentProvider: CloudProvider;
  onProviderChange: (provider: CloudProvider) => void;
  domain?: string;
}

export const ProviderToggle: React.FC<ProviderToggleProps> = ({
  currentProvider,
  onProviderChange,
  domain = 'anonymous'
}) => {
  const handleSelect = (provider: CloudProvider) => {
    if (provider === currentProvider) return;
    
    onProviderChange(provider);
    trackDemoEvent('PROVIDER_SWITCHED', {
      provider,
      domain,
      switchedFrom: currentProvider
    });
  };

  return (
    <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 backdrop-blur-sm">
      <span className="text-xs font-mono text-slate-400 px-2 uppercase tracking-wider">
        Control Plane:
      </span>

      <button
        type="button"
        data-testid="provider-pill-aws"
        data-active={currentProvider === 'aws'}
        onClick={() => handleSelect('aws')}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 flex items-center space-x-1.5 ${
          currentProvider === 'aws'
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#FF9900]" />
        <span>AWS Commercial & Gov</span>
      </button>

      <button
        type="button"
        data-testid="provider-pill-gcp"
        data-active={currentProvider === 'gcp'}
        onClick={() => handleSelect('gcp')}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 flex items-center space-x-1.5 ${
          currentProvider === 'gcp'
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
        <span>Google Cloud (GCP)</span>
      </button>
    </div>
  );
};
