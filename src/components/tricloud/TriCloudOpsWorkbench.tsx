import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  ShieldCheck,
  DollarSign,
  Lock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Check,
  Terminal,
  Server
} from 'lucide-react';
import {
  TriCloudStateResponse,
  CloudProviderId,
  fetchTriCloudState,
  triggerDrProbeViaApi,
  evaluateUnifiedGovernanceViaApi,
  simulateGuardrailViaApi,
  resetTriCloudViaApi
} from '../../services/triCloudApiService';
import { TriCloudFinOpsPanel } from './TriCloudFinOpsPanel';

type StepTab = 'step4-dr' | 'step5-gov' | 'step6-finops' | 'step7-guardrails';

const CLI_VERIFICATION_CHECKS = [
  {
    id: 'cli-wif',
    label: 'Verify Keyless OIDC/WIF Exchange (Zero Static Keys)',
    cmd: 'gcloud iam workload-identity-pools describe securebase-pool --location=global --project=securebase-gcp-dev'
  },
  {
    id: 'cli-dr',
    label: 'Verify Route 53 Active-Passive Health Checks & RPO/RTO Targets',
    cmd: 'aws route53 list-health-checks --query "HealthChecks[].{Id:Id,FQDN:HealthCheckConfig.FullyQualifiedDomainName}"'
  },
  {
    id: 'cli-opa',
    label: 'Evaluate Unified Tri-Cloud Rego v1 Bundle',
    cmd: 'opa eval -d policies/rego/tri_cloud_governance.rego -i schemas/unified-tricloud-audit.json "data.securebase.tricloud.governance.violations"'
  },
  {
    id: 'cli-worm',
    label: 'Confirm S3 Object Lock COMPLIANCE (2,555-Day Retention)',
    cmd: 'aws s3api get-object-lock-configuration --bucket securebase-worm-evidence-us-east-1'
  },
  {
    id: 'cli-guardrails',
    label: 'Validate Universal Guardrails Terraform Plan Pre-Flight',
    cmd: 'cd infra/tricloud && tofu init -backend=false && tofu validate && tofu plan -out=tfplan.bin'
  }
];

export const TriCloudOpsWorkbench: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepTab>('step4-dr');
  const [state, setState] = useState<TriCloudStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Step 5 inputs
  const [govTenantId, setGovTenantId] = useState<string>('cnb-waxahachie');

  // Step 7 guardrail simulator state
  const [guardrailCloud, setGuardrailCloud] = useState<CloudProviderId>('AWS');
  const [guardrailResource, setGuardrailResource] = useState<string>('ephi_audit_bucket_01');
  const [usesStaticKey, setUsesStaticKey] = useState<boolean>(false);
  const [publicAccess, setPublicAccess] = useState<boolean>(false);
  const [cmekEnabled, setCmekEnabled] = useState<boolean>(true);
  const [tlsVersion, setTlsVersion] = useState<string>('1.3');
  const [checkedCliIds, setCheckedCliIds] = useState<string[]>(['cli-wif']);
  const [step7ArtifactTab, setStep7ArtifactTab] = useState<'guardrails' | 'workflow'>('guardrails');

  const refreshState = useCallback(async () => {
    try {
      const data = await fetchTriCloudState();
      setState(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDrAction = async (
    action: 'verify_rpo_rto' | 'simulate_aws_outage' | 'restore_aws_primary'
  ) => {
    setIsBusy(true);
    try {
      await triggerDrProbeViaApi(action);
      await refreshState();
    } finally {
      setIsBusy(false);
    }
  };

  const handleGovEvaluate = async (injectDrift: boolean) => {
    setIsBusy(true);
    try {
      await evaluateUnifiedGovernanceViaApi(govTenantId, injectDrift);
      await refreshState();
    } finally {
      setIsBusy(false);
    }
  };

  const handleGuardrailSimulate = async (forceViolationPreset?: boolean) => {
    setIsBusy(true);
    try {
      const payload = forceViolationPreset
        ? {
            cloud: guardrailCloud,
            resourceName: guardrailResource,
            usesStaticKey: true,
            publicAccess: true,
            cmekEnabled: false,
            tlsVersion: '1.2'
          }
        : {
            cloud: guardrailCloud,
            resourceName: guardrailResource,
            usesStaticKey,
            publicAccess,
            cmekEnabled,
            tlsVersion
          };
      if (forceViolationPreset) {
        setUsesStaticKey(true);
        setPublicAccess(true);
        setCmekEnabled(false);
        setTlsVersion('1.2');
      }
      await simulateGuardrailViaApi(payload);
      await refreshState();
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    setIsBusy(true);
    try {
      await resetTriCloudViaApi();
      await refreshState();
    } finally {
      setIsBusy(false);
    }
  };

  const toggleCliCheck = (id: string) => {
    setCheckedCliIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (isLoading || !state) {
    return (
      <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
        Loading SecureBase Tri-Cloud Steps 4 through 7 Operations...
      </div>
    );
  }

  const { sandbox, finops, artifacts } = state;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-cyan-400 font-semibold">Steps 4-7 Closure Package</span>
            <span aria-hidden="true">/</span>
            <span>AWS us-east-1 · GCP securebase-gcp-dev (594006980795) · Azure eastus</span>
            <span aria-hidden="true">/</span>
            <span className="text-emerald-400">WIF / OIDC Keyless Only</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Tri-Cloud Failover, Governance, FinOps &amp; Universal Guardrails
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            Execute cross-cloud DNS failover probes, SHA-256 Merkle batch attestation against tri_cloud_governance.rego, WIF-normalized FinOps unit economics, and synchronized AWS/GCP/Azure preventative guardrails.
          </p>
        </div>

        <button
          onClick={handleReset}
          disabled={isBusy}
          className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Tri-Cloud Sandbox</span>
        </button>
      </div>

      {/* Step Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveStep('step4-dr')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeStep === 'step4-dr'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Step 4: DR &amp; Failover</span>
        </button>

        <button
          onClick={() => setActiveStep('step5-gov')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeStep === 'step5-gov'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Step 5: Unified Governance &amp; Merkle</span>
        </button>

        <button
          onClick={() => setActiveStep('step6-finops')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeStep === 'step6-finops'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Step 6: FinOps &amp; Metering</span>
        </button>

        <button
          onClick={() => setActiveStep('step7-guardrails')}
          className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeStep === 'step7-guardrails'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Step 7: Universal Guardrails &amp; CLI</span>
        </button>
      </div>

      {/* STEP 4: CROSS-CLOUD FAILOVER & DR */}
      {activeStep === 'step4-dr' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                Route 53 Active-Passive Control Plane · demo.securebase.tximhotep.com
              </div>
              <div className="text-base font-bold text-white">
                Current Active Ingress: {sandbox.activeDnsTarget}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <button
                onClick={() => handleDrAction('verify_rpo_rto')}
                disabled={isBusy}
                className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Run RPO/RTO Probe</span>
              </button>
              <button
                onClick={() => handleDrAction('simulate_aws_outage')}
                disabled={isBusy || sandbox.activeDnsTarget === 'GCP'}
                className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-rose-500/50 text-rose-300 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Simulate AWS Outage (Failover to GCP)
              </button>
              <button
                onClick={() => handleDrAction('restore_aws_primary')}
                disabled={isBusy || sandbox.activeDnsTarget === 'AWS'}
                className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Restore AWS Primary
              </button>
            </div>
          </div>

          {/* 3-Cloud Endpoint Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sandbox.regions.map((reg) => {
              const isFailed = reg.status === 'DEGRADED';
              const isFailoverActive = reg.status === 'ACTIVE_FAILOVER';
              return (
                <div
                  key={reg.cloud}
                  className={`p-5 rounded-xl border space-y-3 ${
                    isFailed
                      ? 'bg-rose-950/20 border-rose-500/50'
                      : isFailoverActive
                      ? 'bg-emerald-950/20 border-emerald-500/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-semibold">{reg.cloud} · {reg.role}</span>
                    <span
                      className={
                        isFailed
                          ? 'text-rose-400 font-semibold'
                          : isFailoverActive
                          ? 'text-emerald-400 font-semibold'
                          : 'text-emerald-400'
                      }
                    >
                      {reg.status}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{reg.region}</div>
                  <div className="text-[11px] font-mono text-slate-400 break-all">{reg.endpointUrl}</div>
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-400 block">Latency</span>
                      <span className="text-white">{reg.latencyMs} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">RPO Lag</span>
                      <span className="text-cyan-300">{reg.rpoLagSeconds}s</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">RTO</span>
                      <span className="text-emerald-400">{reg.rtoSeconds}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Probe Log + dr-failover.tf Viewer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-white">EventBridge &amp; Cloud Scheduler DR Probe Log</h3>
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {sandbox.drProbeHistory.map((p) => (
                  <div key={p.probeId} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-cyan-300">{p.trigger}</span>
                      <span className="text-slate-400 tabular-nums">{p.timestampUtc}</span>
                    </div>
                    <div className="text-slate-200">{p.summary}</div>
                    <div className="font-mono text-[11px] text-emerald-400 tabular-nums">
                      Target: {p.activeDnsTarget} · RPO {p.rpoSeconds}s · RTO {p.rtoSeconds}s · Supabase: {p.supabaseReplicationStatus}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-cyan-300 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span>infra/tricloud/dr-failover.tf</span>
                </div>
                <button
                  onClick={() => copyText('dr-tf', artifacts.drFailoverTf)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'dr-tf' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'dr-tf' ? 'Copied' : 'Copy HCL'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-80">
                {artifacts.drFailoverTf}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: CENTRALIZED TRI-CLOUD GOVERNANCE & MERKLE WORM */}
      {activeStep === 'step5-gov' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                AWS CloudTrail/Config · GCP Cloud Audit/SCC · Azure Activity/Defender
              </div>
              <h3 className="text-base font-bold text-white">
                Normalized Tri-Cloud Rego v1 Evaluation &amp; SHA-256 Merkle Batch Sealing
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <input
                type="text"
                value={govTenantId}
                onChange={(e) => setGovTenantId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 w-40"
                aria-label="Tenant ID"
              />
              <button
                onClick={() => handleGovEvaluate(false)}
                disabled={isBusy}
                className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Seal Compliant Merkle Batch
              </button>
              <button
                onClick={() => handleGovEvaluate(true)}
                disabled={isBusy}
                className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-rose-500/50 text-rose-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inject Multi-Cloud Drift Event
              </button>
            </div>
          </div>

          {/* Sealed Merkle Batch Ledger */}
          <div className="space-y-4">
            {sandbox.merkleBatches.map((batch) => (
              <div key={batch.batchId} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    {batch.postureStatus === 'COMPLIANT' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="text-white font-bold">{batch.batchId}</span>
                    <span className="text-slate-400">Tenant: {batch.tenantId}</span>
                  </div>
                  <span className={batch.postureStatus === 'COMPLIANT' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {batch.postureStatus} · S3 COMPLIANCE Lock ({batch.retentionDays}d) · Supabase RLS Synced
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block mb-1">Computed SHA-256 Merkle Root ({batch.leafHashes.length} leaves)</span>
                    <span className="text-cyan-300 break-all tabular-nums">{batch.merkleRootSha256}</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block mb-1">S3 Object Lock WORM Receipt URN</span>
                    <span className="text-emerald-400 break-all">{batch.wormVaultUrn}</span>
                  </div>
                </div>

                {batch.violations.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {batch.violations.map((v) => (
                      <div key={v.findingId} className="p-3 bg-rose-950/20 border border-rose-500/40 rounded-lg text-xs">
                        <div className="flex justify-between font-mono text-rose-300">
                          <span>{v.cloud} · {v.framework} · {v.control}</span>
                          <span>{v.severity}</span>
                        </div>
                        <div className="text-slate-200 mt-1">{v.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* tri_cloud_governance.rego + supabase-rls-posture.sql */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-300">policies/rego/tri_cloud_governance.rego</span>
                <button
                  onClick={() => copyText('rego-gov', artifacts.triCloudGovernanceRego)}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copiedKey === 'rego-gov' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-72">
                {artifacts.triCloudGovernanceRego}
              </pre>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-300">infra/tricloud/supabase-rls-posture.sql</span>
                <button
                  onClick={() => copyText('rls-sql', artifacts.supabaseRlsSql)}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copiedKey === 'rls-sql' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-72">
                {artifacts.supabaseRlsSql}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: MULTI-CLOUD FINOPS & MARKETPLACE METERING */}
      {activeStep === 'step6-finops' && (
        <TriCloudFinOpsPanel initialFinOps={finops} />
      )}

      {/* STEP 7: UNIVERSAL SECURITY GUARDRAILS & CLI VERIFICATION */}
      {activeStep === 'step7-guardrails' && (
        <div className="space-y-6">
          {/* Interactive Guardrail Evaluator */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Universal Guardrail Policy Enforcement Simulator
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluates AWS Organizations SCP, GCP Org Policies (securebase-gcp-dev), and Azure Policy Initiatives prior to deployment.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => handleGuardrailSimulate(false)}
                  disabled={isBusy}
                  className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold whitespace-nowrap cursor-pointer"
                >
                  Evaluate Guardrails
                </button>
                <button
                  onClick={() => handleGuardrailSimulate(true)}
                  disabled={isBusy}
                  className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-rose-500/50 text-rose-300 whitespace-nowrap cursor-pointer"
                >
                  Test Non-Compliant Drift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Target Cloud</label>
                <select
                  value={guardrailCloud}
                  onChange={(e) => setGuardrailCloud(e.target.value as CloudProviderId)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                >
                  <option value="AWS">AWS (SCP)</option>
                  <option value="GCP">GCP (Org Policy)</option>
                  <option value="AZURE">Azure (Policy Init)</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-slate-400 block mb-1">Resource Identifier</label>
                <input
                  type="text"
                  value={guardrailResource}
                  onChange={(e) => setGuardrailResource(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">TLS Version</label>
                <select
                  value={tlsVersion}
                  onChange={(e) => setTlsVersion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                >
                  <option value="1.3">TLS 1.3 (Compliant)</option>
                  <option value="1.2">TLS 1.2 (Blocked)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 pt-5 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmekEnabled}
                  onChange={(e) => setCmekEnabled(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>CMEK Enabled</span>
              </label>

              <div className="flex flex-col gap-1 pt-2">
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usesStaticKey}
                    onChange={(e) => setUsesStaticKey(e.target.checked)}
                    className="accent-rose-400"
                  />
                  <span>Static Key</span>
                </label>
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publicAccess}
                    onChange={(e) => setPublicAccess(e.target.checked)}
                    className="accent-rose-400"
                  />
                  <span>Public Bucket</span>
                </label>
              </div>
            </div>

            {sandbox.guardrailHistory.length > 0 && (
              <div className="space-y-2 pt-2">
                {sandbox.guardrailHistory.slice(0, 4).map((g) => (
                  <div
                    key={g.checkId}
                    className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      g.decision === 'DENIED_BY_GUARDRAIL'
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold">{g.decision}</span> · {g.summary}
                      {g.violatedPolicies.length > 0 && (
                        <div className="font-mono text-[11px] text-rose-300 mt-0.5">
                          Blocked rules: {g.violatedPolicies.join(' | ')}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      {g.timestampUtc}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* universal-guardrails.tf & GitHub Actions Pre-Flight Gate */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => setStep7ArtifactTab('guardrails')}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                    step7ArtifactTab === 'guardrails'
                      ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  infra/tricloud/universal-guardrails.tf
                </button>
                <button
                  onClick={() => setStep7ArtifactTab('workflow')}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                    step7ArtifactTab === 'workflow'
                      ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  .github/workflows/securebase-preflight-gate.yml
                </button>
              </div>
              <button
                onClick={() =>
                  copyText(
                    'step7-src',
                    step7ArtifactTab === 'guardrails'
                      ? artifacts.universalGuardrailsTf
                      : artifacts.preflightWorkflowYml
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'step7-src' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'step7-src' ? 'Copied' : 'Copy Artifact'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-auto max-h-80">
              {step7ArtifactTab === 'guardrails'
                ? artifacts.universalGuardrailsTf
                : artifacts.preflightWorkflowYml}
            </pre>
          </div>

          {/* Executable CLI Verification Checklist */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Steps 4-7 CLI Verification Checklist</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 tabular-nums">
                {checkedCliIds.length}/{CLI_VERIFICATION_CHECKS.length} verified
              </span>
            </div>

            <div className="space-y-2.5">
              {CLI_VERIFICATION_CHECKS.map((item) => {
                const checked = checkedCliIds.includes(item.id);
                return (
                  <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCliCheck(item.id)}
                          className="accent-emerald-400"
                        />
                        <span>{item.label}</span>
                      </label>
                      <button
                        onClick={() => copyText(item.id, item.cmd)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer shrink-0"
                      >
                        {copiedKey === item.id ? 'Copied' : 'Copy CLI'}
                      </button>
                    </div>
                    <code className="block text-[11px] font-mono text-cyan-300 break-all">{item.cmd}</code>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
