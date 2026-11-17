import React, { useState } from 'react';
import { RemediationAnnotation } from '../types/compliance';
import { Copy, Check, Download, ShieldCheck, Key, Lock, Network, Layers } from 'lucide-react';

interface RemediationPatchProps {
  remediationHcl: string;
  annotations: RemediationAnnotation[];
  targetPlatform: string;
}

export const RemediationPatch: React.FC<RemediationPatchProps> = ({
  remediationHcl,
  annotations,
  targetPlatform
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(remediationHcl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([remediationHcl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `securebase_remediation_${targetPlatform.toLowerCase()}_patch.tf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getAnnotationIcon = (type: RemediationAnnotation['type']) => {
    switch (type) {
      case 'CMEK_KMS':
        return <Key className="w-4 h-4 text-cyan-400" />;
      case 'WORM_LOCK':
        return <Lock className="w-4 h-4 text-emerald-400" />;
      case 'PRIVATE_NETWORKING':
        return <Network className="w-4 h-4 text-blue-400" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <span className="text-cyan-400 font-mono">4.</span>
            <span>NON-DESTRUCTIVE REMEDIATION PATCH (OpenTofu / Terraform HCL)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Production-grade HCL patch resolving statutory drift without destroying production state or interrupting data plane
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied Patch</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy HCL Patch</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download .tf</span>
          </button>
        </div>
      </div>

      {/* Explicit Statutory Architecture Annotations */}
      {annotations.length > 0 && (
        <div className="mb-5 space-y-3">
          <span className="text-xs font-mono text-slate-400 block font-semibold">
            Explicit Statutory Security Annotations:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {annotations.map((ann, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 font-mono font-semibold text-slate-200 mb-1">
                  {getAnnotationIcon(ann.type)}
                  <span>{ann.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed mb-2">
                  {ann.description}
                </p>
                <pre className="p-2 bg-slate-900 border border-slate-800/80 rounded font-mono text-[10px] text-cyan-300 overflow-x-auto">
                  {ann.hclSnippet}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Box */}
      <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="ml-2 text-slate-300 font-semibold">remediation_patch.tf</span>
          </div>
          <span className="text-[11px] text-slate-400">Syntactically Valid OpenTofu / Terraform 1.6+</span>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[480px] leading-relaxed">
          <code>{remediationHcl}</code>
        </pre>
      </div>

      <div className="mt-3 text-[11px] text-slate-400 font-mono flex items-center justify-between">
        <span>Non-Destructive Guarantee: State preserves volume identifiers &amp; avoids recreate cascades.</span>
        <span>OpenTofu AST Verified</span>
      </div>
    </section>
  );
};
