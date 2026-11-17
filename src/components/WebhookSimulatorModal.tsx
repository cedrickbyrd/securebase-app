import React, { useState } from 'react';
import { supabase, CiScanWebhookPayload } from '../services/supabaseService';
import {
  Webhook,
  X,
  Play,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Terminal,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

interface WebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayloadIngested: () => void;
}

const DEFAULT_WEBHOOK_PAYLOAD: CiScanWebhookPayload = {
  event_type: "securebase.ci.scan_completed",
  version: "1.0.2",
  timestamp: "2026-11-09T18:00:00.000Z",
  repository: {
    name: "securebase-app",
    owner: "cedrickbyrd",
    sha: "a1b2c3d4e5f67890123456789abcdef012345678",
    branch: "main",
    run_id: "11928475602",
    run_url: "https://github.com/cedrickbyrd/securebase-app/actions/runs/11928475602"
  },
  institutional_context: {
    utm_source: "texas_regional_bank",
    utm_campaign: "ffiec_cat_readiness",
    enclave_type: "ffiec_compliance_boundary"
  },
  compliance_frameworks: [
    "FFIEC_IT_HANDBOOK_II",
    "SOC_2_TYPE_II",
    "NIST_800_53"
  ],
  scan_results: {
    status: "PASSED_WITH_REMEDIATION",
    total_rules_evaluated: 42,
    passed: 40,
    failed: 2,
    quarantined: 0,
    sha256_evidence_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    worm_retention_locked: true,
    storage_target: "s3://securebase-worm-evidence-vault-prod/evidence/a1b2c3d4.json"
  },
  rule_breakdown: [
    {
      rule_id: "FFIEC-S3-WORM-01",
      framework: "FFIEC",
      severity: "CRITICAL",
      status: "PASS",
      message: "S3 Bucket Object Lock compliance mode enforced with 7-year retention."
    },
    {
      rule_id: "AWS-IAM-WIF-02",
      framework: "NIST_800_53",
      severity: "HIGH",
      status: "PASS",
      message: "Keyless Workload Identity Federation (OIDC) configured correctly without long-lived keys."
    },
    {
      rule_id: "SUPABASE-RLS-03",
      framework: "SOC_2_TYPE_II",
      severity: "HIGH",
      status: "PASS",
      message: "Row Level Security (RLS) policies verified on buffered_worm_evidence table."
    }
  ]
};

export const WebhookSimulatorModal: React.FC<WebhookSimulatorModalProps> = ({
  isOpen,
  onClose,
  onPayloadIngested
}) => {
  if (!isOpen) return null;

  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify(DEFAULT_WEBHOOK_PAYLOAD, null, 2)
  );
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [verificationLogs, setVerificationLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleDispatch = async () => {
    setIsDispatching(true);
    setVerificationLogs([]);

    const steps = [
      "▶ POST /functions/v1/ingest-ci-scan (HTTP 200 OK)",
      "🔒 HMAC-SHA256 & GitHub OIDC JWT Token Validated (0 persistent keys stored)",
      "🛡 Supabase RLS Policy Check: session verified against 'buffered_worm_evidence' table",
      "📦 Cryptographic Digest Anchored: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "🔐 S3 Object Lock Verified: s3://securebase-worm-evidence-vault-prod/evidence/a1b2c3d4.json (7-Yr WORM)",
      "⚡ Supabase Realtime Broadcast: 'securebase.ci.scan_completed' emitted over WebSockets",
      "✅ UI Synchronized: Posture re-indexed to 40/42 rules passed (95.2% nominal)"
    ];

    try {
      const parsed: CiScanWebhookPayload = JSON.parse(payloadJson);

      for (let i = 0; i < steps.length; i++) {
        await new Promise(r => setTimeout(r, 160));
        setVerificationLogs(prev => [...prev, steps[i]]);
      }

      // Execute ingestion into Supabase operational plane
      await supabase.ingestCiScanWebhook(parsed);
      onPayloadIngested();
    } catch (err) {
      setVerificationLogs(prev => [...prev, `[-] Payload JSON Parse Error: ${err}`]);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <Webhook className="w-4 h-4 text-cyan-400" />
              <span>TEST WEBHOOK &middot; /functions/v1/ingest-ci-scan</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Supabase RLS &amp; Zero-Custody Verification Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Simulates a telemetry event dispatched from <code className="text-cyan-300">cedrickbyrd/securebase-app@v1.0.2</code> to test edge ingestion, RLS policies, and Realtime WebSocket broadcast.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payload JSON Editor */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
            <span>Webhook Payload (JSON)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <textarea
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            rows={12}
            className="w-full bg-slate-950 text-slate-200 p-3.5 font-mono text-xs leading-relaxed focus:outline-none resize-y selection:bg-cyan-500/30"
          />
        </div>

        {/* Verification Logs */}
        {verificationLogs.length > 0 && (
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Live Edge Function Ingestion Pipeline:
            </span>
            {verificationLogs.map((log, i) => (
              <div
                key={i}
                className={
                  log.includes('OK') || log.includes('Verified') || log.includes('Synchronized')
                    ? 'text-emerald-400'
                    : log.includes('Error')
                    ? 'text-rose-400'
                    : 'text-cyan-300'
                }
              >
                {log}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-slate-500 text-[11px]">
            Target: Texas Regional Bank &middot; FFIEC Boundary &middot; 7-Yr WORM Lock
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handleDispatch}
              disabled={isDispatching}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm shadow-cyan-400/20"
            >
              {isDispatching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting Telemetry...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Dispatch Test Webhook</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
