import React from 'react';
import { ShieldCheck, Play } from 'lucide-react';

interface HeaderProps {
  activeView: 'workbench' | 'playground' | 'harness' | 'tricloud' | 'matrices' | 'evidence' | 'zero-custody';
  onSelectView: (view: 'workbench' | 'playground' | 'harness' | 'tricloud' | 'matrices' | 'evidence' | 'zero-custody') => void;
  onRunScan: () => void;
  isScanning: boolean;
  onOpenCarrierHeritage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onSelectView,
  onRunScan,
  isScanning,
  onOpenCarrierHeritage
}) => {
  return (
    <header className="flex items-center justify-between gap-6 px-6 py-3.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Brand title, single line display wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a 
          href="#workbench"
          onClick={(e) => { e.preventDefault(); onSelectView('workbench'); }}
          className="text-lg font-bold tracking-tight text-white flex items-center gap-2 whitespace-nowrap shrink-0 hover:text-cyan-400 transition-colors"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm shadow-cyan-500/20 text-slate-950 font-black">
            <ShieldCheck className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <span>SecureBase</span>
        </a>
        <span className="hidden xl:inline text-xs text-slate-400 font-mono border-l border-slate-800 pl-3 whitespace-nowrap shrink-0">
          TxImhotep LLC
        </span>
        {onOpenCarrierHeritage && (
          <button
            onClick={onOpenCarrierHeritage}
            className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-800/60 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="25-Year Infrastructure Engineering Provenance (18 Years AT&T Carrier Scale + SATCOM Systems + DC Microgrids)"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>25-Yr Carrier Heritage</span>
          </button>
        )}
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="hidden md:flex items-center gap-4 text-[13px] font-medium text-slate-400 overflow-x-auto">
        <button
          onClick={() => onSelectView('workbench')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'workbench'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Workbench
        </button>
        <button
          onClick={() => onSelectView('playground')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'playground'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Drift Playground
        </button>
        <button
          onClick={() => onSelectView('harness')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'harness'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Agent Harness
        </button>
        <button
          onClick={() => onSelectView('tricloud')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'tricloud'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Tri-Cloud Ops
        </button>
        <button
          onClick={() => onSelectView('matrices')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'matrices'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Matrices
        </button>
        <button
          onClick={() => onSelectView('evidence')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'evidence'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          WORM Vault
        </button>
        <button
          onClick={() => onSelectView('zero-custody')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 relative cursor-pointer ${
            activeView === 'zero-custody'
              ? 'text-cyan-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Zero Custody
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onRunScan}
          disabled={isScanning}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 transition-colors rounded-lg shadow-sm shadow-cyan-400/20 whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
        >
          {isScanning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Evaluating AST...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Evaluate Pre-Flight IaC</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
