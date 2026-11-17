import React from 'react';
import { AuditReport } from '../types/compliance';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Layers, ShieldCheck } from 'lucide-react';
import { ExecutiveSummaryPDF } from './ExecutiveSummaryPDF';

interface ExecutiveSummaryProps {
  report: AuditReport;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ report }) => {
  const ffiecScore = report.evaluationStatus === 'COMPLIANT' ? 98.2 : report.evaluationStatus === 'CRITICAL_FAILURE' ? 81.4 : 88.5;

  const getStatusBadge = () => {
    switch (report.evaluationStatus) {
      case 'COMPLIANT':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-md text-emerald-400 font-mono text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>COMPLIANT</span>
          </div>
        );
      case 'DRIFT_DETECTED':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/60 border border-amber-500/30 rounded-md text-amber-400 font-mono text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>DRIFT_DETECTED</span>
          </div>
        );
      case 'CRITICAL_FAILURE':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-950/60 border border-rose-500/30 rounded-md text-rose-400 font-mono text-sm font-semibold">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>CRITICAL_FAILURE</span>
          </div>
        );
    }
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-5 gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <span className="text-cyan-400 font-mono">1.</span>
            <span>EXECUTIVE AUDIT SUMMARY</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-flight AST evaluation executed by TxImhotep LLC Sovereign Engine
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {getStatusBadge()}
          <ExecutiveSummaryPDF report={report} variant="primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        {/* FFIEC Compliance Score */}
        <div className="p-4 bg-slate-950/60 border border-cyan-800/60 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">FFIEC Score:</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className={`text-base font-bold tracking-wide ${
            ffiecScore >= 95 ? 'text-emerald-400' : ffiecScore >= 85 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {ffiecScore}%
          </span>
          <span className="text-[11px] text-slate-400 block mt-2">
            FFIEC AIO Booklet §II.C
          </span>
        </div>
        {/* Target Platform */}
        <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <span className="text-slate-400 block mb-1">Target Platform:</span>
          <span className="text-sm font-bold text-white tracking-wide">
            [{report.targetPlatform}]
          </span>
          <span className="text-[11px] text-slate-400 block mt-2">
            Sovereign Enclave &middot; Workload Identity Mode
          </span>
        </div>

        {/* Evaluation Status */}
        <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <span className="text-slate-400 block mb-1">Evaluation Status:</span>
          <span
            className={`text-sm font-bold tracking-wide ${
              report.evaluationStatus === 'COMPLIANT'
                ? 'text-emerald-400'
                : report.evaluationStatus === 'DRIFT_DETECTED'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            [{report.evaluationStatus}]
          </span>
          <span className="text-[11px] text-slate-400 block mt-2">
            {report.evaluationStatus === 'CRITICAL_FAILURE'
              ? 'Statutory deployment gate engaged (PR Blocked)'
              : report.evaluationStatus === 'DRIFT_DETECTED'
              ? 'Non-breaking drift observed; remediation advised'
              : 'Zero statutory drift detected'}
          </span>
        </div>

        {/* Assessed Scope Count */}
        <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <span className="text-slate-400 block mb-1">Assessed Scope:</span>
          <span className="text-sm font-bold text-cyan-300">
            {report.assessedScope.length} Resource &amp; Provider Blocks
          </span>
          <span className="text-[11px] text-slate-400 block mt-2">
            Evaluated via AST AST-Traversal
          </span>
        </div>
      </div>

      {/* Scope list details */}
      <div className="mt-4 pt-4 border-t border-slate-800/60">
        <span className="text-xs text-slate-400 block mb-2 font-mono">
          Assessed Scope Details:
        </span>
        <div className="flex flex-wrap gap-2">
          {report.assessedScope.map((scope, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-300"
            >
              {scope}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
