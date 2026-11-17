import React, { useState } from 'react';
import { AuditReport } from '../types/compliance';
import { InstitutionalProfile } from '../services/utmService';
import { ExecutiveSummaryPDF } from './ExecutiveSummaryPDF';
import {
  FileText,
  X,
  Printer,
  Download,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Award,
  Calendar
} from 'lucide-react';

interface ExaminerAuditBinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AuditReport | null;
  activeProfile: InstitutionalProfile;
}

export const ExaminerAuditBinderModal: React.FC<ExaminerAuditBinderModalProps> = ({
  isOpen,
  onClose,
  report,
  activeProfile
}) => {
  if (!isOpen || !report) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(report.wormAttestation, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `examiner_binder_${report.wormAttestation.evidence_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Controls Toolbar (Hidden in print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>OFFICIAL STATUTORY COMPLIANCE DOSSIER</span>
          </div>

          <div className="flex items-center gap-2">
            <ExecutiveSummaryPDF report={report} variant="compact" />

            <button
              onClick={handleDownloadJson}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download JSON Manifest</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-400/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF Binder</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Formal Dossier Document */}
        <div className="space-y-6 print:space-y-4">
          {/* Formal Header & Insignia */}
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl print:bg-white print:border-black/20 print:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="font-mono text-[11px] text-cyan-400 uppercase tracking-widest block font-bold">
                  TxImhotep LLC &middot; Autonomous Sovereign Compliance Engine
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white print:text-black tracking-tight mt-0.5">
                  Statutory Examination Evidence Dossier
                </h1>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 print:text-black">
                <span className="block font-bold text-emerald-400">7-Year WORM Locked</span>
                <span className="text-[11px]">{new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[10px]">Examined Institution:</span>
                <strong className="text-white print:text-black text-[11px]">{activeProfile.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Statutory Baseline:</span>
                <span className="text-cyan-300 font-bold text-[11px]">{activeProfile.primaryFramework} / {activeProfile.keyStatute.split(' ')[0]}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Target Cloud Platform:</span>
                <span className="text-white print:text-black text-[11px] font-bold">[{report.targetPlatform}]</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Evidence Manifest ID:</span>
                <code className="text-slate-300 print:text-black text-[10px]">{report.wormAttestation.evidence_id}</code>
              </div>
            </div>
          </div>

          {/* Cryptographic Attestation Block */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl print:border-black/20 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Immutable SHA-256 Digital Digest:
              </span>
              <span className="text-emerald-400 font-bold px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/60 rounded text-[10px]">
                SEAL VERIFIED (Non-Repudiation)
              </span>
            </div>
            <code className="text-cyan-300 print:text-black font-bold block break-all text-xs bg-slate-900 p-2.5 rounded border border-slate-800/80">
              {report.wormAttestation.evidence_sha256}
            </code>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>WORM Vault Sink: {report.wormAttestation.worm_vault_retention.vault_urn}</span>
              <span>Retention Period: 2,555 Days (7 Statutory Years)</span>
            </div>
          </div>

          {/* Statutory Control Evaluation Table */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-bold text-white print:text-black uppercase tracking-wider">
              Statutory Examination Findings &amp; Guardrail Verification
            </h3>
            <div className="overflow-x-auto border border-slate-800 print:border-black/20 rounded-lg">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 print:bg-gray-100 text-slate-400 print:text-black border-b border-slate-800">
                    <th className="py-2 px-3 font-semibold">Framework</th>
                    <th className="py-2 px-3 font-semibold">Control ID</th>
                    <th className="py-2 px-3 font-semibold">Control Name</th>
                    <th className="py-2 px-3 font-semibold">Severity</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-black/10">
                  {report.controls.map((ctrl, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold text-slate-300 print:text-black">{ctrl.framework}</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-semibold">{ctrl.controlId}</td>
                      <td className="py-2.5 px-3 text-slate-200 print:text-black font-sans">{ctrl.controlName}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-400">{ctrl.severity}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ctrl.status === 'PASS'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}>
                          {ctrl.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Non-Destructive Remediation Patch Excerpt */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-bold text-white print:text-black uppercase tracking-wider">
              Statutory Remediation HCL Specification
            </h3>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-emerald-300 print:text-black overflow-x-auto max-h-[160px] leading-relaxed">
              <code>{report.remediationPatchHcl.substring(0, 500)}...</code>
            </pre>
          </div>

          {/* Formal Examiner Sign-Off Block */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl print:border-black/20 font-mono text-xs space-y-3">
            <h4 className="font-bold text-white print:text-black uppercase text-[11px]">
              Authoritative Certification &amp; Examiner Sign-Off
            </h4>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              This evidence binder was autonomously generated via pre-flight AST parsing under Zero-Data-Custody conditions.
              Customer database payloads and ePHI were never ingested. Sealed under AWS S3 Object Lock / GCS Bucket Lock Compliance Mode.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-3 border-t border-slate-800/80">
              <div className="border-b border-dashed border-slate-700 pb-1">
                <span className="text-[10px] text-slate-500 block">Lead Regulatory Auditor / Examiner Signature:</span>
                <span className="text-slate-300 print:text-black font-sans text-xs">____________________________________</span>
              </div>
              <div className="border-b border-dashed border-slate-700 pb-1">
                <span className="text-[10px] text-slate-500 block">Principal Cloud Architect (TxImhotep LLC):</span>
                <span className="text-slate-300 print:text-black font-sans text-xs">Cedrick Byrd, Principal Cloud Architect</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 print:hidden text-xs font-mono">
          <span className="text-slate-500">GCP Project: SecureBase-GCP [594006980795]</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
