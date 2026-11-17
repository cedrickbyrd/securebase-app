import React from 'react';
import { RootCauseFinding } from '../types/compliance';
import { AlertCircle, Code, ShieldX, ArrowRight } from 'lucide-react';

interface RootCauseAnalysisProps {
  findings: RootCauseFinding[];
}

export const RootCauseAnalysis: React.FC<RootCauseAnalysisProps> = ({ findings }) => {
  if (findings.length === 0) {
    return (
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2 pb-4 border-b border-slate-800 mb-5">
          <span className="text-cyan-400 font-mono">3.</span>
          <span>ROOT CAUSE &amp; RISK VECTOR ANALYSIS</span>
        </h2>
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm font-mono">
          Zero root-cause statutory risk vectors detected. All analyzed resource blocks comply with sovereign security baselines.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="pb-4 border-b border-slate-800 mb-5">
        <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
          <span className="text-cyan-400 font-mono">3.</span>
          <span>ROOT CAUSE &amp; RISK VECTOR ANALYSIS</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Deep AST code-level inspection identifying precise block coordinates, vulnerable attributes, and exploit mechanics
        </p>
      </div>

      <div className="space-y-4">
        {findings.map((finding, idx) => (
          <div
            key={idx}
            className="p-5 bg-slate-950/70 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
          >
            {/* Header: Resource Block Identification */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2 py-0.5 bg-rose-950/80 text-rose-300 border border-rose-800/50 rounded font-semibold">
                  FINDING #{idx + 1}
                </span>
                <span className="text-white font-bold">
                  {finding.resourceType}.{finding.resourceName}
                </span>
                <span className="text-slate-400">({finding.lineNumbers})</span>
              </div>
              <div className="font-mono text-xs text-cyan-400 font-semibold">
                Attribute: <code className="text-cyan-300">{finding.blockAttribute}</code>
              </div>
            </div>

            {/* Differential: Current Value vs Expected Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 font-mono text-xs">
              <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded">
                <span className="text-rose-400 font-semibold block mb-1">Current Misconfiguration:</span>
                <code className="text-rose-200 block break-all">{finding.currentValue}</code>
              </div>
              <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 rounded">
                <span className="text-emerald-400 font-semibold block mb-1">Expected Statutory Baseline:</span>
                <code className="text-emerald-200 block break-all">{finding.expectedValue}</code>
              </div>
            </div>

            {/* Technical Exploit Vector */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-300 block mb-1">Technical Exploit Vector:</span>
                <p className="text-slate-400 leading-relaxed bg-slate-900/80 p-3 rounded border border-slate-800/60 font-sans">
                  {finding.technicalExploitVector}
                </p>
              </div>

              <div>
                <span className="font-semibold text-amber-400/90 block mb-1">Statutory Impact:</span>
                <p className="text-slate-400 font-mono text-[11px]">
                  {finding.statutoryImpact}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
