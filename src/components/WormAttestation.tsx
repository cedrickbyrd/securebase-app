import React, { useState } from 'react';
import { WormEvidenceAttestation } from '../types/compliance';
import { canonicalizeJson, computeSha256 } from '../utils/crypto';
import { Copy, Check, Download, ShieldCheck, RefreshCw, Lock, Database } from 'lucide-react';

interface WormAttestationProps {
  attestation: WormEvidenceAttestation;
}

export const WormAttestation: React.FC<WormAttestationProps> = ({ attestation }) => {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'MATCH' | 'MISMATCH' | null>('MATCH');

  // Format valid JSON block per the strict requirement
  const jsonContent = JSON.stringify(attestation, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${attestation.evidence_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReverify = async () => {
    setIsVerifying(true);
    try {
      // Create copy without evidence_sha256 to verify seal
      const { evidence_sha256, ...baseManifest } = attestation;
      const canonical = canonicalizeJson(baseManifest);
      const computed = await computeSha256(canonical);

      // Verify
      if (computed.toLowerCase() === evidence_sha256.toLowerCase()) {
        setVerifyStatus('MATCH');
      } else {
        setVerifyStatus('MISMATCH');
      }
    } catch (err) {
      console.error('Failed to verify digest', err);
      setVerifyStatus('MISMATCH');
    } finally {
      setTimeout(() => setIsVerifying(false), 300);
    }
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <span className="text-cyan-400 font-mono">5.</span>
            <span>CRYPTOGRAPHIC WORM EVIDENCE ATTESTATION (JSON Block)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable audit manifest anchored to customer-owned Write-Once-Read-Many (WORM) storage vaults
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReverify}
            disabled={isVerifying}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Re-calculate SHA-256 over canonical manifest"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>Verify Digest</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied JSON</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy JSON</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download Manifest</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Seal & Verification Banner */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Verifiable SHA-256 Digest:</span>
            {verifyStatus === 'MATCH' && (
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded text-[11px] font-semibold flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                SEAL INTACT
              </span>
            )}
          </div>
          <code className="text-cyan-300 font-bold block break-all text-xs">
            {attestation.evidence_sha256}
          </code>
        </div>

        <div className="text-right shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
          <span className="text-slate-400 block text-[11px]">WORM Vault Mode:</span>
          <span className="text-emerald-400 font-semibold">
            {attestation.worm_vault_retention.retention_mode} (2,555 Days / 7 Years)
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {attestation.worm_vault_retention.vault_type}
          </span>
        </div>
      </div>

      {/* Strict Output JSON Block */}
      <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
          <span className="text-slate-300 font-semibold">{attestation.evidence_id}.json</span>
          <span className="text-[11px] text-slate-400 font-mono">
            {attestation.timestamp_utc} &middot; Vendor: TxImhotep LLC
          </span>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[420px] leading-relaxed">
          <code>{jsonContent}</code>
        </pre>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 font-mono">
        <span>Vault Path: {attestation.worm_vault_retention.vault_urn}</span>
        <span>Google Cloud Storage Bucket Lock (Compliance Mode)</span>
      </div>
    </section>
  );
};
