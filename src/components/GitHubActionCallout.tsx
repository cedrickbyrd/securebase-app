import React, { useState } from 'react';
import { GitPullRequest, Copy, Check, ExternalLink, Terminal, ShieldAlert, Award, ArrowUpRight } from 'lucide-react';

export const GitHubActionCallout: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const workflowYaml = `# .github/workflows/securebase-compliance.yml
name: SecureBase Sovereign Shift-Left Governance

on:
  pull_request:
    branches: [ main, production ]
    paths:
      - '**.tf'
      - '**.tofu'

jobs:
  validate-compliance:
    name: Pre-Flight Statutory AST Audit
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # Keyless OIDC token exchange (Zero static secrets)
      contents: read
      pull-requests: write # Posts statutory evaluation summary to PR

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run SecureBase Action
        uses: cedrickbyrd/securebase-app@v1.0.2
        with:
          # Zero static credentials: Uses AWS STS AssumeRoleWithWebIdentity or Google WIF
          role-to-assume: 'arn:aws:iam::123456789012:role/SecureBaseAuditorRole'
          role-session-name: 'SecureBaseShiftLeftAudit'
          session-duration-seconds: 1800 # Ephemeral token <= 3600s
          # Statutory frameworks: FFIEC AIO Booklet, HIPAA, NIST SP 800-53 Rev. 5
          frameworks: 'ffiec_aio,hipaa,nist80053'
          block_on_critical: true
          # Zero runtime data plane access: Read-only metadata discovery
          portal_url: 'https://demo.securebase.tximhotep.com'
`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(workflowYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* High-Visibility Banner */}
      <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-800/60 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <GitPullRequest className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="font-bold text-white uppercase tracking-wider">
                Shift-Left with SecureBase
              </span>
              <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded font-bold text-[10px]">
                FREE DEVELOPER TIER
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans leading-relaxed">
              Enforce FFIEC, HIPAA §164.312, and NIST SP 800-53 guardrails directly in your Pull Requests. Blocks statutory drift before <code className="text-cyan-300 font-mono">terraform apply</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>View Workflow YAML</span>
          </button>

          <a
            href="https://github.com/marketplace/actions/securebase-compliance-guardrails"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-400/20"
          >
            <span>Add to GitHub</span>
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>
        </div>
      </div>

      {/* Modal / Quickstart Code Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Add SecureBase GitHub Action
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Add this workflow to your repository under <code className="text-cyan-300 font-mono">.github/workflows/securebase.yml</code>. It connects securely to our Supabase telemetry pipeline using keyless GitHub OIDC.
            </p>

            <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>securebase-compliance.yml</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[300px] leading-relaxed">
                <code>{workflowYaml}</code>
              </pre>
            </div>

            {/* AWS Marketplace Co-Sell Box */}
            <div className="p-4 bg-slate-950 border border-amber-900/40 rounded-xl font-mono text-xs space-y-1">
              <div className="flex items-center justify-between text-amber-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  AWS Marketplace Private Offer Pilot
                </span>
                <span>$4,000 / Sandbox Pilot</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Product ID: <code className="text-slate-200">prod-p7z4iqf7gg6dk</code> &middot; Qualifies for AWS Well-Architected Review (WAR) funding credits, delivering <strong className="text-emerald-400">Net +$1,000 credit</strong> for qualified enterprise workloads.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
