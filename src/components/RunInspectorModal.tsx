import React from 'react';
import { CiScan, ComplianceFinding } from '../services/supabaseService';
import {
  GitPullRequest,
  X,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  Lock,
  Layers
} from 'lucide-react';

interface RunInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scan: CiScan | null;
  findings: ComplianceFinding[];
}

export const RunInspectorModal: React.FC<RunInspectorModalProps> = ({
  isOpen,
  onClose,
  scan,
  findings
}) => {
  if (!isOpen || !scan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>CI/CD RUN INSPECTOR &middot; SUPABASE POSTGREST TELEMETRY</span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{scan.repo_name}</span>
              <span className="text-slate-400 font-normal">#{scan.pr_number}</span>
            </h2>
            <div className="text-[11px] text-slate-400 mt-1">
              Deep-Link: <code className="text-cyan-300">https://demo.securebase.tximhotep.com/runs/{scan.id}</code>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Strip */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {scan.status === 'SUCCESS' ? (
              <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-[10px]">Pipeline Verdict:</span>
              <strong className={scan.status === 'SUCCESS' ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'}>
                {scan.status === 'SUCCESS' ? 'ALL STATUTORY CHECKS GREEN' : 'GATED MERGE BLOCKED'}
              </strong>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-400">
            <span>Execution Duration: <strong className="text-white">{scan.duration_ms}ms</strong></span>
            <span className="block mt-0.5">Commit: <code className="text-cyan-300">{scan.commit_sha}</code></span>
          </div>
        </div>

        {/* Dispatch Telemetry Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-500 block text-[10px]">Branch:</span>
            <span className="text-white font-bold truncate block">{scan.branch}</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-500 block text-[10px]">Platform:</span>
            <span className="text-cyan-300 font-bold">[{scan.target_platform}]</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-500 block text-[10px]">Total Findings:</span>
            <span className="text-amber-400 font-bold">{scan.findings_count}</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-500 block text-[10px]">Critical Blockers:</span>
            <span className="text-rose-400 font-bold">{scan.critical_count}</span>
          </div>
        </div>

        {/* SHA-256 Digest Box */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
          <span className="text-slate-400 text-[10px] block">Cryptographic Digest (HMAC-SHA256):</span>
          <code className="text-cyan-300 block break-all text-[11px]">
            {scan.evidence_sha256}
          </code>
        </div>

        {/* Findings List */}
        <div className="space-y-2">
          <span className="text-slate-400 text-[11px] block font-semibold">
            Ingested Compliance Findings ({findings.length}):
          </span>

          {findings.length > 0 ? (
            findings.map((f, i) => (
              <div
                key={i}
                className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-400 font-bold">
                    [{f.framework}] {f.control_id} &middot; {f.control_name}
                  </span>
                  <span className="text-rose-400 font-bold">{f.severity}</span>
                </div>
                <div className="text-slate-300 text-[10px]">
                  Resource: <code className="text-slate-100">{f.resource_block}</code>
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  {f.exploit_vector}
                </p>
              </div>
            ))
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-500">
              Zero findings recorded. All pre-flight compliance guardrails satisfied.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px]">
          <span className="text-slate-500">Supabase Edge Function: /functions/v1/ingest-ci-scan</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
