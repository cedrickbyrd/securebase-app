import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Play,
  FileCode2,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Terminal,
  FlaskConical,
  Braces
} from 'lucide-react';
import {
  HarnessStateResponse,
  HarnessFrameworkId,
  HARNESS_PRESETS,
  fetchHarnessState,
  evaluateTfPlanViaApi,
  verifyWormVaultViaApi,
  synthesizeRemediationPrViaApi,
  validateMcpPayloadViaApi,
  runRegoUnitTestsViaApi,
  resetHarnessViaApi
} from '../../services/harnessApiService';

type HarnessSubView = 'pipeline' | 'contracts' | 'rego' | 'ledger';

const FRAMEWORK_LABELS: Record<HarnessFrameworkId, string> = {
  FFIEC_AIO: 'FFIEC AIO (S3 Object Lock)',
  HIPAA_164_312: 'HIPAA 45 CFR 164.312 (CMEK & TLS 1.3)',
  NIST_800_53: 'NIST SP 800-53 (3600s WIF Cap)'
};

export const AgentHarnessWorkbench: React.FC = () => {
  const [subView, setSubView] = useState<HarnessSubView>('pipeline');
  const [state, setState] = useState<HarnessStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Pipeline state
  const [selectedPresetId, setSelectedPresetId] = useState<string>(HARNESS_PRESETS[0].id);
  const [sourceType, setSourceType] = useState<'terraform_plan_json' | 'aws_security_hub'>(
    HARNESS_PRESETS[0].sourceType
  );
  const [selectedFrameworks, setSelectedFrameworks] = useState<HarnessFrameworkId[]>(
    HARNESS_PRESETS[0].frameworks
  );
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify(HARNESS_PRESETS[0].payload, null, 2)
  );
  const [vaultUrn, setVaultUrn] = useState<string>('arn:aws:s3:::securebase-worm-evidence-us-east-1');
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);

  // Tier 2 human confirmation gate inputs
  const [approverEmail, setApproverEmail] = useState<string>('cedrick.byrd@tximhotep.com');
  const [confirmationNote, setConfirmationNote] = useState<string>(
    'Reviewed isolated HCL diff, zero downtime confirmed, approved for fix branch PR.'
  );
  const [humanConfirmed, setHumanConfirmed] = useState<boolean>(false);

  // MCP Contracts inspector state
  const [selectedToolName, setSelectedToolName] = useState<string>('evaluate_tf_plan');
  const [schemaTestInput, setSchemaTestInput] = useState<string>(
    JSON.stringify(
      {
        sourceType: 'terraform_plan_json',
        repository: 'cedrickbyrd/securebase-app',
        frameworks: ['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'],
        strictMode: true,
        payload: { planned_values: { root_module: { resources: [] } } }
      },
      null,
      2
    )
  );
  const [schemaCheckResult, setSchemaCheckResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);

  // Rego Library inspector state
  const [selectedPackId, setSelectedPackId] = useState<string>('ffiec_aio_object_lock');

  const refreshState = useCallback(async () => {
    try {
      const next = await fetchHarnessState();
      setState(next);
      if (next.sandbox.activeRun && next.sandbox.activeRun.findings.length > 0) {
        setSelectedFindingIds((prev) =>
          prev.length > 0 ? prev : next.sandbox.activeRun!.findings.map((f) => f.findingId)
        );
      }
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to reach /api/harness/state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const activeRun = state?.sandbox.activeRun || null;
  const synthesizedPrs = state?.sandbox.synthesizedPrs || [];
  const auditTrail = state?.sandbox.auditTrail || [];
  const contracts = state?.contracts;
  const regoLibrary = state?.regoLibrary || [];
  const lastTestResults = state?.sandbox.lastTestResults || [];

  const selectedContract = useMemo(
    () => contracts?.tools.find((t) => t.name === selectedToolName) || contracts?.tools[0] || null,
    [contracts, selectedToolName]
  );

  const selectedRegoPack = useMemo(
    () => regoLibrary.find((p) => p.id === selectedPackId) || regoLibrary[0] || null,
    [regoLibrary, selectedPackId]
  );

  const selectedFindings = useMemo(() => {
    if (!activeRun) return [];
    return activeRun.findings.filter((f) => selectedFindingIds.includes(f.findingId));
  }, [activeRun, selectedFindingIds]);

  const handleSelectPreset = (presetId: string) => {
    const preset = HARNESS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSourceType(preset.sourceType);
    setSelectedFrameworks(preset.frameworks);
    setPayloadText(JSON.stringify(preset.payload, null, 2));
    setBannerError(null);
    setBannerSuccess(null);
  };

  const toggleFramework = (fw: HarnessFrameworkId) => {
    setSelectedFrameworks((prev) => {
      if (prev.includes(fw)) {
        return prev.length > 1 ? prev.filter((item) => item !== fw) : prev;
      }
      return [...prev, fw];
    });
  };

  const toggleFindingSelection = (findingId: string) => {
    setSelectedFindingIds((prev) =>
      prev.includes(findingId) ? prev.filter((id) => id !== findingId) : [...prev, findingId]
    );
  };

  const handleRunTier1Evaluate = async () => {
    setIsBusy(true);
    setBannerError(null);
    setBannerSuccess(null);
    setHumanConfirmed(false);
    try {
      const parsedPayload = JSON.parse(payloadText);
      const res = await evaluateTfPlanViaApi({
        sourceType,
        repository: 'cedrickbyrd/securebase-app',
        frameworks: selectedFrameworks,
        strictMode: true,
        payload: parsedPayload
      });

      if (!res.ok) {
        setBannerError((res.schemaErrors || ['evaluate_tf_plan failed']).join(' | '));
      } else {
        setSelectedFindingIds((res.run?.findings || []).map((f: { findingId: string }) => f.findingId));
        setBannerSuccess(
          `Tier 1 evaluate_tf_plan completed (${res.output.violationCount} finding(s) grouped across ${selectedFrameworks.length} framework(s)). Next allowed tool: verify_worm_vault.`
        );
      }
      await refreshState();
    } catch (err) {
      setBannerError(err instanceof Error ? `Invalid JSON input: ${err.message}` : 'Tier 1 evaluation failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyWormVault = async () => {
    if (!activeRun) return;
    setIsBusy(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await verifyWormVaultViaApi({
        runId: activeRun.runId,
        vaultUrn,
        expectedPlanSha256: activeRun.planSha256,
        minimumRetentionDays: 2555
      });

      if (!res.ok) {
        setBannerError(res.gateError || (res.schemaErrors || ['WORM verification failed']).join(' | '));
      } else {
        setBannerSuccess(
          `WORM Vault COMPLIANCE Object Lock (2,555 days) verified. Evidence SHA-256: ${res.output.evidenceChainSha256.slice(0, 16)}...`
        );
      }
      await refreshState();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'verify_worm_vault failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSynthesizePr = async (forceUnapprovedTest = false) => {
    if (!activeRun) return;
    setIsBusy(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await synthesizeRemediationPrViaApi({
        runId: activeRun.runId,
        targetFindingIds: selectedFindingIds.length > 0 ? selectedFindingIds : ['none'],
        humanConfirmed: forceUnapprovedTest ? false : humanConfirmed,
        approverEmail,
        confirmationNote
      });

      if (!res.ok) {
        setBannerError(res.gateError || (res.schemaErrors || ['Tier 2 gate rejected request']).join(' | '));
      } else {
        setBannerSuccess(
          `Tier 2 PR ${res.output.prId} synthesized on branch '${res.output.branchName}' (Attestation ${res.output.attestationSha256.slice(0, 16)}...).`
        );
      }
      await refreshState();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Tier 2 PR synthesis failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoadContractSample = (withDrift: boolean) => {
    if (selectedToolName === 'evaluate_tf_plan') {
      setSchemaTestInput(
        JSON.stringify(
          withDrift
            ? {
                sourceType: 'invalid_source_type',
                unexpectedField: true,
                frameworks: []
              }
            : {
                sourceType: 'terraform_plan_json',
                repository: 'cedrickbyrd/securebase-app',
                frameworks: ['FFIEC_AIO', 'HIPAA_164_312'],
                strictMode: true,
                payload: { planned_values: { root_module: { resources: [] } } }
              },
          null,
          2
        )
      );
    } else if (selectedToolName === 'verify_worm_vault') {
      setSchemaTestInput(
        JSON.stringify(
          withDrift
            ? {
                runId: 'bad-id',
                vaultUrn: 'http://insecure-bucket',
                expectedPlanSha256: 'short-hash',
                minimumRetentionDays: 30
              }
            : {
                runId: activeRun?.runId || 'run-88ab1234',
                vaultUrn: 'arn:aws:s3:::securebase-worm-evidence-us-east-1',
                expectedPlanSha256: activeRun?.planSha256 || 'a'.repeat(64),
                minimumRetentionDays: 2555
              },
          null,
          2
        )
      );
    } else {
      setSchemaTestInput(
        JSON.stringify(
          withDrift
            ? {
                runId: 'invalid',
                targetFindingIds: [],
                humanConfirmed: false,
                approverEmail: 'not-an-email',
                confirmationNote: 'ok'
              }
            : {
                runId: activeRun?.runId || 'run-88ab1234',
                targetFindingIds: ['ffiec-s3-lock-worm_audit_vault'],
                humanConfirmed: true,
                approverEmail: 'cedrick.byrd@tximhotep.com',
                confirmationNote: 'Approved after blast-radius inspection.'
              },
          null,
          2
        )
      );
    }
    setSchemaCheckResult(null);
  };

  const handleValidateSchema = async () => {
    setIsBusy(true);
    try {
      const parsed = JSON.parse(schemaTestInput);
      const res = await validateMcpPayloadViaApi(selectedToolName, parsed);
      setSchemaCheckResult({ valid: res.valid, errors: res.errors || [] });
    } catch (err) {
      setSchemaCheckResult({
        valid: false,
        errors: [err instanceof Error ? `JSON syntax error: ${err.message}` : 'Invalid JSON']
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunRegoTests = async () => {
    setIsBusy(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const summary = await runRegoUnitTestsViaApi();
      setBannerSuccess(`Executed ${summary.passed}/${summary.total} OPA Rego v1 unit assertions successfully.`);
      await refreshState();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Rego unit test runner failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetHarness = async () => {
    setIsBusy(true);
    setBannerError(null);
    setBannerSuccess(null);
    setHumanConfirmed(false);
    setSelectedFindingIds([]);
    try {
      await resetHarnessViaApi();
      await refreshState();
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
        Loading SecureBase Engineer Agent Harness...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Two-Tier Governance Context */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-cyan-400 font-semibold">securebase-mcp</span>
            <span aria-hidden="true">/</span>
            <span>2026 MCP Specification</span>
            <span aria-hidden="true">/</span>
            <span>Repository: {contracts?.repository || 'cedrickbyrd/securebase-app'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Two-Tier Engineer Agent Harness &amp; Rego v1 Governance
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            Enforces deterministic Tier 1 read-only pre-flight evaluation and WORM vault anchoring prior to human-gated Tier 2 PR synthesis across FFIEC AIO, HIPAA 164.312, and NIST SP 800-53.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetHarness}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Harness Run</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs (Single-Line Controls) */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setSubView('pipeline')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            subView === 'pipeline'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>1. Pipeline &amp; Tier 2 Gate</span>
        </button>

        <button
          onClick={() => setSubView('contracts')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            subView === 'contracts'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Braces className="w-4 h-4" />
          <span>2. 2026 MCP Contracts (3)</span>
        </button>

        <button
          onClick={() => setSubView('rego')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            subView === 'rego'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>3. Rego v1 Policy Library ({regoLibrary.length})</span>
        </button>

        <button
          onClick={() => setSubView('ledger')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            subView === 'ledger'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          <span>4. Synthesized PR Ledger ({synthesizedPrs.length})</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {bannerError && (
        <div className="p-4 bg-rose-950/30 border border-rose-500/50 rounded-xl flex items-start gap-3 text-xs font-mono text-rose-300">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{bannerError}</span>
        </div>
      )}

      {bannerSuccess && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-start gap-3 text-xs font-mono text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {/* SUB-VIEW 1: DETERMINISTIC TWO-TIER PIPELINE & HUMAN GATE */}
      {subView === 'pipeline' && (
        <div className="space-y-6">
          {/* Deterministic Tool Order Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${activeRun ? 'bg-slate-900 border-emerald-500/50' : 'bg-slate-900 border-cyan-500/50'}`}>
              <div className="text-[11px] font-mono text-slate-400">Step 1 · Tier 1 Read-Only</div>
              <div className="text-sm font-bold text-white font-mono mt-1">evaluate_tf_plan</div>
              <div className={`text-xs font-mono mt-2 ${activeRun ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {activeRun ? `Evaluated (${activeRun.violationCount} findings)` : 'Ready for Pre-Flight JSON'}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                activeRun?.wormVerification.verified
                  ? 'bg-slate-900 border-emerald-500/50'
                  : activeRun
                  ? 'bg-slate-900 border-amber-500/50'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-400">Step 2 · Tier 1 WORM Lock</div>
              <div className="text-sm font-bold text-white font-mono mt-1">verify_worm_vault</div>
              <div
                className={`text-xs font-mono mt-2 ${
                  activeRun?.wormVerification.verified
                    ? 'text-emerald-400'
                    : activeRun
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {activeRun?.wormVerification.verified
                  ? 'COMPLIANCE Lock Verified (2,555d)'
                  : activeRun
                  ? 'Pending WORM Anchor'
                  : 'Blocked until Step 1'}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                activeRun?.tier2GateStatus === 'APPROVED_SYNTHESIZED'
                  ? 'bg-slate-900 border-emerald-500/50'
                  : activeRun?.tier2GateStatus === 'AWAITING_HUMAN_APPROVAL'
                  ? 'bg-slate-900 border-amber-500/50'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-400">Step 3 · Human Sign-Off</div>
              <div className="text-sm font-bold text-white font-mono mt-1">Tier 2 Approval Gate</div>
              <div className="text-xs font-mono mt-2 text-slate-300">
                {activeRun?.tier2GateStatus || 'LOCKED_NEEDS_EVAL'}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                activeRun?.tier2GateStatus === 'APPROVED_SYNTHESIZED'
                  ? 'bg-slate-900 border-emerald-500/50'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-400">Step 4 · Tier 2 Mutation</div>
              <div className="text-sm font-bold text-white font-mono mt-1">synthesize_remediation_pr</div>
              <div
                className={`text-xs font-mono mt-2 ${
                  activeRun?.tier2GateStatus === 'APPROVED_SYNTHESIZED' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {activeRun?.tier2GateStatus === 'APPROVED_SYNTHESIZED'
                  ? `Minted (${synthesizedPrs[0]?.branchName || 'fix/securebase'})`
                  : 'Requires Step 2 + Human Confirm'}
              </div>
            </div>
          </div>

          {/* Left: Tier 1 Plan / ASFF Input; Right: Grouped Violations + Tier 2 Gate */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tier 1 Input Panel */}
            <div className="lg:col-span-5 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-cyan-400">Tier 1 · Autonomous Read-Only</div>
                  <h2 className="text-base font-bold text-white mt-0.5">
                    Pre-Flight Plan / Security Hub Input
                  </h2>
                </div>
                <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400">Load Scenario Payload</label>
                <div className="flex flex-wrap gap-2">
                  {HARNESS_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedPresetId === preset.id
                          ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400">Frameworks Evaluated</label>
                <div className="flex flex-wrap gap-2">
                  {(['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'] as HarnessFrameworkId[]).map((fw) => {
                    const active = selectedFrameworks.includes(fw);
                    return (
                      <button
                        key={fw}
                        onClick={() => toggleFramework(fw)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-800 border-cyan-500/60 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {fw}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>{sourceType === 'terraform_plan_json' ? 'terraform show -json' : 'AWS Security Hub ASFF'}</span>
                  <span className="tabular-nums">{payloadText.split('\n').length} lines</span>
                </div>
                <textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  spellCheck={false}
                  rows={14}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleRunTier1Evaluate}
                disabled={isBusy}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold font-mono flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Tier 1: evaluate_tf_plan</span>
              </button>
            </div>

            {/* Right: Grouped Violations, WORM Lock, and Tier 2 Human Confirmation Gate */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1 Output: Grouped Rego v1 Violations */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">OPA Rego v1 Strict Evaluation</div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      Framework-Grouped Findings
                    </h3>
                  </div>
                  {activeRun && (
                    <div className="text-xs font-mono text-slate-400 tabular-nums">
                      Plan SHA-256: <span className="text-cyan-300">{activeRun.planSha256.slice(0, 16)}...</span>
                    </div>
                  )}
                </div>

                {!activeRun ? (
                  <div className="py-10 text-center text-xs font-mono text-slate-400">
                    Run <span className="text-cyan-300">evaluate_tf_plan</span> on the left to inspect Rego v1 findings and unlock WORM vault verification.
                  </div>
                ) : activeRun.findings.length === 0 ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center gap-3 text-xs font-mono text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Zero policy drift detected across {activeRun.frameworks.join(', ')}. Anchor evidence via verify_worm_vault below.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'] as HarnessFrameworkId[]).map((fw) => {
                      const items = activeRun.violationsByFramework[fw] || [];
                      if (items.length === 0) return null;
                      return (
                        <div key={fw} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-1">
                            <span className="font-semibold text-white">{FRAMEWORK_LABELS[fw]}</span>
                            <span className="text-rose-400 tabular-nums">{items.length} violation(s)</span>
                          </div>
                          {items.map((f) => {
                            const checked = selectedFindingIds.includes(f.findingId);
                            return (
                              <label
                                key={f.findingId}
                                className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-slate-950 border-cyan-500/50'
                                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleFindingSelection(f.findingId)}
                                    className="mt-1 accent-cyan-400"
                                  />
                                  <div className="flex-1 space-y-1 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                                      <span className="text-cyan-300 font-semibold">{f.resourceAddress}</span>
                                      <span className={f.severity === 'CRITICAL' ? 'text-rose-400 font-semibold' : 'text-amber-400 font-semibold'}>
                                        {f.severity} · {f.controlCitation}
                                      </span>
                                    </div>
                                    <div className="text-slate-200">{f.reason}</div>
                                    <div className="text-[11px] font-mono text-slate-400">
                                      Rule: {f.ruleHead} · Branch: {f.branchName}
                                    </div>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: verify_worm_vault */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">Step 2 · Mandatory Pre-Gate Lock</div>
                    <h3 className="text-sm font-bold text-white">verify_worm_vault (COMPLIANCE 2,555-Day Anchor)</h3>
                  </div>
                  <button
                    onClick={handleVerifyWormVault}
                    disabled={isBusy || !activeRun || activeRun.wormVerification.verified}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{activeRun?.wormVerification.verified ? 'WORM Verified' : 'Execute verify_worm_vault'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">S3 / GCS Object Lock Vault URN</label>
                    <input
                      type="text"
                      value={vaultUrn}
                      onChange={(e) => setVaultUrn(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Anchored Evidence Chain Digest</span>
                    <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 truncate tabular-nums">
                      {activeRun?.wormVerification.evidenceChainSha256 || 'Awaiting verify_worm_vault'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 & 4: Tier 2 Human-in-the-Loop Gate & PR Synthesis */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    {activeRun?.wormVerification.verified && selectedFindings.length > 0 ? (
                      <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-mono text-amber-400">Tier 2 · Human-in-the-Loop Mutation Gate</div>
                      <h3 className="text-base font-bold text-white">
                        Gated Remediation PR Synthesis (`synthesize_remediation_pr`)
                      </h3>
                    </div>
                  </div>

                  {activeRun && (
                    <button
                      onClick={() => handleSynthesizePr(true)}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Test Unapproved Guard
                    </button>
                  )}
                </div>

                {selectedFindings.length === 0 ? (
                  <div className="py-6 text-center text-xs font-mono text-slate-400">
                    {activeRun?.compliant
                      ? 'Baseline is compliant; no Tier 2 PR mutation required.'
                      : 'Select at least one Tier 1 finding and complete WORM verification to unlock the Tier 2 PR review card.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Blast Radius & Penalty Justification Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                        <span className="text-slate-400 block">Target Branch</span>
                        <span className="text-cyan-300 font-semibold break-all">{selectedFindings[0].branchName}</span>
                      </div>
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                        <span className="text-slate-400 block">Blast Radius</span>
                        <span className="text-white tabular-nums">
                          {selectedFindings.length} resource(s) · {selectedFindings.some((f) => f.blastRadius.recreationRisk === 'HIGH') ? 'HIGH' : 'NONE/LOW'} risk · Zero downtime
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                        <span className="text-slate-400 block">Penalty Justification</span>
                        <span className="text-amber-300">{selectedFindings[0].penaltyExposure}</span>
                      </div>
                    </div>

                    {/* Minimal Isolated HCL Diff Preview */}
                    <div>
                      <div className="text-xs font-mono text-slate-400 mb-1.5">
                        Isolated HCL Patch Preview ({selectedFindings.length} finding(s))
                      </div>
                      <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
                        {selectedFindings.map((s) => `# ${s.controlCitation}\n${s.hclPatch}`).join('\n\n')}
                      </pre>
                    </div>

                    {/* Explicit Human Confirmation Gate Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <label className="text-slate-400 block mb-1">Approver Identity</label>
                        <input
                          type="email"
                          value={approverEmail}
                          onChange={(e) => setApproverEmail(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Human Sign-Off Justification</label>
                        <input
                          type="text"
                          value={confirmationNote}
                          onChange={(e) => setConfirmationNote(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={humanConfirmed}
                        onChange={(e) => setHumanConfirmed(e.target.checked)}
                        className="mt-0.5 accent-cyan-400"
                      />
                      <span>
                        I confirm this Tier 2 HCL patch blast-radius assessment and authorize synthesizing branch{' '}
                        <code className="text-cyan-300 font-mono">{selectedFindings[0].branchName}</code>.
                      </span>
                    </label>

                    <button
                      onClick={() => handleSynthesizePr(false)}
                      disabled={isBusy || !activeRun?.wormVerification.verified || !humanConfirmed}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-40"
                    >
                      <GitPullRequest className="w-4 h-4" />
                      <span>Approve &amp; Synthesize Tier 2 PR</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: FORMALIZED 2026 MCP TOOL CONTRACTS */}
      {subView === 'contracts' && contracts && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
              <div className="text-slate-400">Deterministic Tool Order</div>
              <div className="text-cyan-300">
                {contracts.deterministicExecutionOrder.join(' -> ')}
              </div>
            </div>

            {contracts.tools.map((tool) => {
              const active = tool.name === selectedToolName;
              return (
                <button
                  key={tool.name}
                  onClick={() => {
                    setSelectedToolName(tool.name);
                    setSchemaCheckResult(null);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-900 border-cyan-500/60'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className={tool.tier === 'TIER_1_READ_ONLY' ? 'text-cyan-400' : 'text-amber-400'}>
                      {tool.tier}
                    </span>
                    <span className="text-slate-400">
                      {tool.requiresHumanApproval ? 'Human Gate' : 'Read-Only'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono mt-1">{tool.name}</div>
                  <p className="text-xs text-slate-400 mt-1">{tool.description}</p>
                </button>
              );
            })}
          </div>

          {selectedContract && (
            <div className="lg:col-span-8 space-y-6">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">{selectedContract.name}</h3>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">
                      dependsOn: {selectedContract.dependsOn.length > 0 ? selectedContract.dependsOn.join(', ') : 'none'}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">MCP Spec {contracts.mcpSpecVersion}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-mono text-slate-300 mb-1.5">Strict inputSchema (JSON Schema 2020-12)</div>
                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300 overflow-auto max-h-64">
                      {JSON.stringify(selectedContract.inputSchema, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-slate-300 mb-1.5">Strict outputSchema (JSON Schema 2020-12)</div>
                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-300 overflow-auto max-h-64">
                      {JSON.stringify(selectedContract.outputSchema, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Interactive Schema Drift Validation Tester */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Live inputSchema Drift Validator</h4>
                    <p className="text-xs text-slate-400">Test strict JSON Schema enforcement against malformed or unexpected keys.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadContractSample(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-300 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      Load Valid Sample
                    </button>
                    <button
                      onClick={() => handleLoadContractSample(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-rose-300 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      Inject Schema Drift
                    </button>
                  </div>
                </div>

                <textarea
                  value={schemaTestInput}
                  onChange={(e) => setSchemaTestInput(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200"
                />

                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={handleValidateSchema}
                    disabled={isBusy}
                    className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold font-mono whitespace-nowrap cursor-pointer"
                  >
                    Validate Payload Against inputSchema
                  </button>

                  {schemaCheckResult && (
                    <div
                      className={`text-xs font-mono flex items-center gap-2 ${
                        schemaCheckResult.valid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {schemaCheckResult.valid ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>SCHEMA VALID (0 violations)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{schemaCheckResult.errors.join(' | ')}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: MODULAR REGO v1 POLICY LIBRARY & UNIT TEST RUNNER */}
      {subView === 'rego' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Modular OPA Rego v1 Rule Packs &amp; Unit Tests</h3>
              <p className="text-xs text-slate-400">
                Uses <code className="text-cyan-300 font-mono">import rego.v1</code>, general references in rule heads (<code className="text-cyan-300 font-mono">violations["FRAMEWORK"]</code>), and companion <code className="text-cyan-300 font-mono">_test.rego</code> suites.
              </p>
            </div>
            <button
              onClick={handleRunRegoTests}
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold font-mono flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" />
              <span>Run Rego v1 Unit Tests</span>
            </button>
          </div>

          {lastTestResults.length > 0 && (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <th className="py-3 px-4">Framework</th>
                    <th className="py-3 px-4">Unit Test</th>
                    <th className="py-3 px-4">Assertion</th>
                    <th className="py-3 px-4 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {lastTestResults.map((tr) => (
                    <tr key={tr.testId}>
                      <td className="py-2.5 px-4 font-mono text-cyan-300">{tr.framework}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-200">{tr.testName}</td>
                      <td className={`py-2.5 px-4 font-mono ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tr.summary}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-400">
                        {tr.durationMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-2.5">
              {regoLibrary.map((pack) => {
                const active = pack.id === selectedPackId;
                return (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 border-cyan-500/60'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-mono text-cyan-400">{pack.framework}</div>
                    <div className="text-sm font-bold text-white mt-0.5">{pack.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{pack.controlCitation}</div>
                  </button>
                );
              })}
            </div>

            {selectedRegoPack && (
              <div className="lg:col-span-8 grid grid-cols-1 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-300 flex items-center gap-1.5">
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>{selectedRegoPack.policyPath}</span>
                    </span>
                    <span className="text-slate-400">import rego.v1</span>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-72">
                    {selectedRegoPack.policySource}
                  </pre>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>{selectedRegoPack.testPath}</span>
                    </span>
                    <span className="text-slate-400">Positive + Negative Assertions</span>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-64">
                    {selectedRegoPack.testSource}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: SYNTHESIZED PR LEDGER & TOOL AUDIT TRAIL */}
      {subView === 'ledger' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-base font-bold text-white">Approved Tier 2 PR Synthesis Ledger</h3>
            {synthesizedPrs.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-400">
                No Tier 2 remediation PRs synthesized yet. Complete Step 1, Step 2, and human approval in Pipeline &amp; Tier 2 Gate.
              </div>
            ) : (
              <div className="space-y-4">
                {synthesizedPrs.map((pr) => (
                  <div key={pr.prId} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-emerald-400 font-semibold">{pr.prId} · {pr.branchName}</span>
                      <span className="text-slate-400 tabular-nums">{pr.synthesizedAtUtc}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 block">Approved By</span>
                        <span className="text-white">{pr.approverEmail}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Blast Radius</span>
                        <span className="text-slate-200">{pr.blastRadius.summary}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Attestation SHA-256</span>
                        <span className="text-cyan-300 tabular-nums break-all">{pr.attestationSha256}</span>
                      </div>
                    </div>
                    <div className="text-xs text-amber-300">
                      <strong className="text-slate-300">Regulatory Justification:</strong> {pr.regulatoryJustification}
                    </div>
                    <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto">
                      {pr.hclPatch}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white">Deterministic Tool Order &amp; Gate Audit Log</h3>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Tool</th>
                    <th className="py-2.5 px-3">Decision</th>
                    <th className="py-2.5 px-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {auditTrail.slice(0, 15).map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {entry.timestampUtc}
                      </td>
                      <td className="py-2 px-3 font-mono text-cyan-300 whitespace-nowrap">{entry.toolName}</td>
                      <td
                        className={`py-2 px-3 font-mono whitespace-nowrap ${
                          entry.status === 'ALLOWED' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {entry.status}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
