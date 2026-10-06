import React, { useState } from 'react';
import { GatedRemediationModal } from './GatedRemediationModal';
import { StickyDomainEvaluatorBar, EdgeScanResult } from './StickyDomainEvaluatorBar';

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
  }
}

interface DriftFinding {
  id: string;
  domain: string;
  citation: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'FAIL' | 'REMEDIATED';
  description: string;
  remediationCode: string;
  isGated: boolean;
}

const DEFAULT_FINDINGS: DriftFinding[] = [
  {
    id: 'DRIFT-001',
    domain: 'Audit & Non-Repudiation',
    citation: 'FFIEC InfoSec §II.C | NIST AU-9',
    severity: 'CRITICAL',
    status: 'FAIL',
    description: 'Central logging S3 bucket lacks Object Lock in COMPLIANCE mode (7-year WORM).',
    remediationCode: 'resource "aws_s3_bucket_object_lock_configuration" "vault" {\n  rule {\n    default_retention {\n      mode = "COMPLIANCE"\n      years = 7\n    }\n  }\n}',
    isGated: false // Free wow moment
  },
  {
    id: 'DRIFT-002',
    domain: 'Infrastructure Drift Control',
    citation: 'FFIEC AIO §II.E | Operations',
    severity: 'HIGH',
    status: 'FAIL',
    description: 'Out-of-band console modification detected on core subnet ACLs bypassing Terraform.',
    remediationCode: 'securebase-mcp detect_state_drift --reconcile-to-head',
    isGated: true // Gated
  },
  {
    id: 'DRIFT-003',
    domain: 'Cryptographic Protection',
    citation: 'FFIEC InfoSec §II.B | GLBA Safeguards',
    severity: 'MEDIUM',
    status: 'FAIL',
    description: 'Secondary analytics storage bucket is using default SSE-S3 rather than KMS CMEK.',
    remediationCode: 'apply_cme_key --kms-arn arn:aws:kms:us-east-1:110261042500:key/sb-vault',
    isGated: true // Gated
  }
];

export const EvaluationSimulator: React.FC = () => {
  const [findings, setFindings] = useState<DriftFinding[]>(DEFAULT_FINDINGS);
  const [remediatingId, setRemediatingId] = useState<string | null>(null);
  const [activeCodeId, setActiveCodeId] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pendingFindingId, setPendingFindingId] = useState<string | null>(null);
  const [targetDomain, setTargetDomain] = useState<string>('regionalbank.com');
  const [edgeResult, setEdgeResult] = useState<EdgeScanResult | null>(null);

  const handleSimulateClick = (finding: DriftFinding) => {
    if (finding.isGated && !isUnlocked) {
      setPendingFindingId(finding.id);
      setIsModalOpen(true);
      return;
    }

    executeRemediation(finding.id);
  };

  const executeRemediation = (id: string) => {
    setRemediatingId(id);
    setTimeout(() => {
      setFindings((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'REMEDIATED' } : f))
      );
      setActiveCodeId(id);
      setRemediatingId(null);
    }, 600);
  };

  const handleModalSuccess = (_email: string) => {
    setIsUnlocked(true);
    setIsModalOpen(false);
    if (pendingFindingId) {
      executeRemediation(pendingFindingId);
      setPendingFindingId(null);
    }
  };

  const handleScanComplete = (result: EdgeScanResult) => {
    setTargetDomain(result.domain);
    setEdgeResult(result);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 pb-28 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight">FFIEC Cloud Safeguards Drift Simulator</h3>
            {edgeResult && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-400">
                Audited: {targetDomain}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {edgeResult
              ? `Live edge perimeter results for ${targetDomain} crosswalked with in-tenant FFIEC baseline.`
              : 'Simulated regional bank archetype ($1B–$15B Assets | Texas DOB / FDIC continuous exam profile).'}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300 w-fit">
          In-Tenant Read-Only (Zero NPI)
        </span>
      </div>

      {/* Live Edge Perimeter Results Card */}
      {edgeResult && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-800/80 bg-slate-900/90 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              Live Boundary Inspection: <span className="font-mono text-emerald-400">{edgeResult.domain}</span>
            </span>
            <span className="text-xs font-mono text-slate-300">
              Perimeter Rating: <strong className="text-emerald-400">{edgeResult.score}/100</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">TLS Cipher</div>
              <div className="font-semibold text-emerald-400 mt-0.5">✓ {edgeResult.tlsVersion} Enforced</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">HSTS Header</div>
              <div className="font-semibold text-emerald-400 mt-0.5">✓ Max-Age Active</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">DMARC / SPF</div>
              <div className="font-semibold text-emerald-400 mt-0.5">✓ Aligned</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">DNSSEC</div>
              <div className="font-semibold text-amber-400 mt-0.5">⚠ Advisory (AIO §II.B)</div>
            </div>
          </div>
        </div>
      )}

      {/* Findings Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/80 text-slate-300 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Finding & Domain</th>
              <th className="py-3 px-4">Regulatory Citation</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {findings.map((finding) => (
              <tr key={finding.id} className="hover:bg-slate-800/40 transition">
                <td className="py-3.5 px-4 font-medium">
                  <div className="text-slate-200">{finding.domain}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{finding.description}</div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{finding.citation}</td>
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      finding.severity === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : finding.severity === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {finding.severity}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  {finding.status === 'REMEDIATED' ? (
                    <span className="inline-flex items-center text-emerald-400 font-semibold text-xs gap-1">
                      ✓ Remediated
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold text-xs">Action Required</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {finding.status === 'FAIL' ? (
                    <button
                      onClick={() => handleSimulateClick(finding)}
                      disabled={remediatingId === finding.id}
                      className={`px-3 py-1.5 rounded font-medium text-xs transition disabled:opacity-50 cursor-pointer ${
                        finding.isGated && !isUnlocked
                          ? 'bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5 ml-auto'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {finding.isGated && !isUnlocked && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      {remediatingId === finding.id ? 'Fixing...' : finding.isGated && !isUnlocked ? 'Unlock Fix' : 'Simulate Fix'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveCodeId(activeCodeId === finding.id ? null : finding.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-mono cursor-pointer"
                    >
                      {activeCodeId === finding.id ? 'Hide HCL' : 'View HCL'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Code Snippet Drawer for Remediated Findings */}
      {activeCodeId && (
        <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-xs text-emerald-300">
          <div className="text-slate-400 text-[11px] mb-1.5 flex items-center justify-between">
            <span>Automated In-Tenant Remediation Patch:</span>
            <span className="text-slate-500 font-sans">securebase-mcp verified</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap">
            {findings.find((f) => f.id === activeCodeId)?.remediationCode}
          </pre>
        </div>
      )}

      {/* Post-CAT FFIEC Sample Report Download Banner */}
      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/90 p-5 shadow-xl">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            Need a board-ready artifact to share with your audit committee?
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Download our post-CAT FFIEC reference evaluation report (PDF) with examiner crosswalks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/reports/SecureBase_FFIEC_Executive_Sample.pdf"
            download="SecureBase_FFIEC_Executive_Sample.pdf"
            onClick={() => {
              if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'sample_report_download', {
                  framework: 'FFIEC_Generic_Archetype',
                });
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Sample Audit Packet (PDF)
          </a>
        </div>
      </div>

      {/* Gated Lead Capture Modal with Dynamic Domain */}
      <GatedRemediationModal
        domain={targetDomain}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Sticky Bottom Edge Audit Scanner */}
      <StickyDomainEvaluatorBar onScanComplete={handleScanComplete} />
    </div>
  );
};

export default EvaluationSimulator;
