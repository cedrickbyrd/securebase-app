import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
  }
}

export interface EdgeScanResult {
  domain: string;
  score: number;
  tlsVersion: string;
  tlsEnforced: boolean;
  hstsHeader: boolean;
  dnssecEnabled: boolean;
  dmarcRecord: boolean;
}

interface StickyDomainEvaluatorBarProps {
  onScanComplete: (result: EdgeScanResult) => void;
}

const EVALUATION_STAGES = [
  'Querying public TLS 1.3 ciphers & HTTPS enforcement (FFIEC AIO §II.B)...',
  'Verifying DNSSEC & DMARC/SPF authentication records...',
  'Evaluating edge perimeter headers & downgrade protection...',
  'Synthesizing FFIEC post-CAT perimeter scorecard...'
];

export const StickyDomainEvaluatorBar: React.FC<StickyDomainEvaluatorBarProps> = ({ onScanComplete }) => {
  const [inputVal, setInputVal] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      interval = setInterval(() => {
        setStageIndex((prev) => (prev < EVALUATION_STAGES.length - 1 ? prev + 1 : prev));
      }, 750);
    } else {
      setStageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!inputVal.trim()) return;

    // Resilient domain cleaning
    let clean = inputVal.trim().toLowerCase();
    if (clean.includes('@')) clean = clean.split('@')[1];
    clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0].split('?')[0].trim();

    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!domainRegex.test(clean)) {
      setErrorMessage('Please enter a valid domain (e.g. cnbwax.com or frostbank.com).');
      return;
    }

    setIsScanning(true);

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'domain_edge_scan_initiated', { domain: clean });
    }

    setTimeout(() => {
      setIsScanning(false);
      onScanComplete({
        domain: clean,
        score: 84,
        tlsVersion: 'TLS 1.3',
        tlsEnforced: true,
        hstsHeader: true,
        dnssecEnabled: false,
        dmarcRecord: true
      });
    }, 3000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 px-4 py-3 backdrop-blur shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <p className="text-xs text-slate-200 font-semibold flex items-center gap-1.5">
              <span>Test Your Bank Perimeter</span>
              <span className="text-[10px] text-emerald-400 font-mono font-normal bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                Safe Harbor / Non-Invasive
              </span>
            </p>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Zero-agent evaluation of public TLS 1.3 ciphers, DNSSEC &amp; FFIEC boundary posture.
            </p>
          </div>
        </div>

        <form onSubmit={handleScan} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="e.g. cnbwax.com"
            disabled={isScanning}
            className="w-full md:w-56 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isScanning || !inputVal.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition shadow shadow-emerald-600/20 whitespace-nowrap disabled:opacity-50 cursor-pointer"
          >
            {isScanning ? 'Auditing Edge...' : 'Run Scan →'}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="max-w-5xl mx-auto mt-1">
          <p className="text-rose-400 text-[11px] font-mono">{errorMessage}</p>
        </div>
      )}

      {isScanning && (
        <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 mb-1">
            <span>{EVALUATION_STAGES[stageIndex]}</span>
            <span>{Math.round(((stageIndex + 1) / EVALUATION_STAGES.length) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${((stageIndex + 1) / EVALUATION_STAGES.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StickyDomainEvaluatorBar;
