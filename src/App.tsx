/**
 * SecureBase - Sovereign Cloud Compliance & Autonomous Remediation Engine
 * Developed by TxImhotep LLC
 * Repository: cedrickbyrd/securebase-app
 * Portal: demo.securebase.tximhotep.com
 * GCP Project: SecureBase-GCP [594006980795]
 */

import React, { useState, useEffect } from 'react';
import { BENCHMARK_SCENARIOS } from './data/benchmarkScenarios';
import { AuditReport, BenchmarkScenario } from './types/compliance';
import { scanInfrastructureCode } from './utils/astScanner';
import { Header } from './components/Header';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { StatutoryControlTable } from './components/StatutoryControlTable';
import { RootCauseAnalysis } from './components/RootCauseAnalysis';
import { RemediationPatch } from './components/RemediationPatch';
import { WormAttestation } from './components/WormAttestation';
import { ZeroDataCustodyView } from './components/ZeroDataCustodyView';
import { ControlMatrixViewer } from './components/ControlMatrixViewer';
import { EvidenceLedger } from './components/EvidenceLedger';
import { DriftPlayground } from './components/DriftPlayground';
import { GitHubActionCallout } from './components/GitHubActionCallout';
import { FrameworkToggleBar } from './components/FrameworkToggleBar';
import { UtmPersonalizationBanner } from './components/UtmPersonalizationBanner';
import { CommercialPipelineModal } from './components/CommercialPipelineModal';
import { ExaminerAuditBinderModal } from './components/ExaminerAuditBinderModal';
import { RunInspectorModal } from './components/RunInspectorModal';
import { WebhookSimulatorModal } from './components/WebhookSimulatorModal';
import { GtmPlaybookModal } from './components/GtmPlaybookModal';
import { TreasuryGuardrailsModal } from './components/TreasuryGuardrailsModal';
import { ComplianceDriftModal } from './components/ComplianceDriftModal';
import { TriCloudMarketplaceModal } from './components/TriCloudMarketplaceModal';
import { GcpMarketplaceModal } from './components/GcpMarketplaceModal';
import { CarrierGradeInfrastructureModal } from './components/CarrierGradeInfrastructureModal';
import { MvnoArchitectureModal } from './components/MvnoArchitectureModal';
import { AgentHarnessWorkbench } from './components/harness/AgentHarnessWorkbench';
import { TriCloudOpsWorkbench } from './components/tricloud/TriCloudOpsWorkbench';
import { ExecutiveSummaryPDF } from './components/ExecutiveSummaryPDF';
import { detectInstitutionalProfile, InstitutionalProfile } from './services/utmService';
import { supabase, CiScan } from './services/supabaseService';
import {
  ShieldCheck,
  Play,
  RotateCcw,
  Code2,
  FileText,
  CheckCircle2,
  Terminal,
  Zap,
  Printer,
  Award,
  Webhook,
  ExternalLink,
  TrendingUp,
  LineChart,
  Sparkles,
  Cpu,
  Layers,
  Cloud,
  Radio
} from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'workbench' | 'playground' | 'harness' | 'tricloud' | 'matrices' | 'evidence' | 'zero-custody'>('workbench');
  const [selectedScenario, setSelectedScenario] = useState<BenchmarkScenario>(BENCHMARK_SCENARIOS[0]);
  const [code, setCode] = useState<string>(BENCHMARK_SCENARIOS[0].initialCode);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [frameworkFocus, setFrameworkFocus] = useState<'FFIEC' | 'HIPAA' | 'NIST80053'>('FFIEC');

  // Commercial & IP Modal States
  const [activeProfile, setActiveProfile] = useState<InstitutionalProfile>(detectInstitutionalProfile());
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState<boolean>(false);
  const [isGtmModalOpen, setIsGtmModalOpen] = useState<boolean>(false);
  const [isTreasuryModalOpen, setIsTreasuryModalOpen] = useState<boolean>(false);
  const [isDriftModalOpen, setIsDriftModalOpen] = useState<boolean>(false);
  const [isTriCloudModalOpen, setIsTriCloudModalOpen] = useState<boolean>(false);
  const [isGcpModalOpen, setIsGcpModalOpen] = useState<boolean>(false);
  const [isBinderModalOpen, setIsBinderModalOpen] = useState<boolean>(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState<boolean>(false);
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState<boolean>(false);
  const [isMvnoModalOpen, setIsMvnoModalOpen] = useState<boolean>(false);
  const [inspectedScan, setInspectedScan] = useState<CiScan | null>(null);

  const [realtimeNotification, setRealtimeNotification] = useState<{
    id: string;
    prNumber: number;
    branch: string;
    status: 'SUCCESS' | 'VIOLATIONS_DETECTED' | 'CRITICAL_BLOCK';
    timestamp: string;
    findingsCount: number;
  } | null>(null);

  // Run initial scan on mount for the default banking scenario
  useEffect(() => {
    let mounted = true;
    const runInitialScan = async () => {
      setIsScanning(true);
      try {
        const initialReport = await scanInfrastructureCode(BENCHMARK_SCENARIOS[0].initialCode, BENCHMARK_SCENARIOS[0].name);
        if (mounted) {
          setReport(initialReport);
        }
      } catch (err) {
        console.error('Initial scan error', err);
      } finally {
        if (mounted) setIsScanning(false);
      }
    };
    runInitialScan();
    return () => {
      mounted = false;
    };
  }, []);

  // Supabase Realtime Subscription: listens to 'ci_scans' table for new records
  // and updates the UI instantly, replacing mock static results
  useEffect(() => {
    const unsubscribe = supabase.subscribeToRealtime((payload) => {
      if (payload.table === 'ci_scans' && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        const scan = payload.record as import('./services/supabaseService').CiScan;
        const scanFindings = supabase.getFindings(scan.id);

        // Convert scan and findings into a live AuditReport replacing static data
        const updatedReport: AuditReport = {
          id: scan.id,
          createdAt: scan.created_at,
          targetPlatform: scan.target_platform,
          evaluationStatus: scan.status === 'SUCCESS'
            ? 'COMPLIANT'
            : scan.status === 'CRITICAL_BLOCK'
            ? 'CRITICAL_FAILURE'
            : 'DRIFT_DETECTED',
          assessedScope: scanFindings.length > 0
            ? Array.from(new Set(scanFindings.map(f => f.resource_block)))
            : [`provider.${scan.target_platform.toLowerCase()}`, `${scan.repo_name}#${scan.pr_number}`],
          controls: scanFindings.map(f => ({
            framework: f.framework,
            controlId: f.control_id,
            controlName: f.control_name,
            severity: f.severity,
            status: f.status,
            findingDetails: f.exploit_vector,
            remediationAction: 'Apply non-destructive HCL patch',
            affectedAttributes: [f.attribute_path]
          })),
          rootCauses: scanFindings.map((f, idx) => ({
            resourceType: f.resource_block.split('.')[0] || 'resource',
            resourceName: f.resource_block.split('.')[1] || f.resource_block,
            lineNumbers: `Finding #${idx + 1}`,
            blockAttribute: f.attribute_path,
            currentValue: 'Non-compliant configuration drift',
            expectedValue: 'Statutory compliance baseline',
            technicalExploitVector: f.exploit_vector,
            statutoryImpact: `Statutory non-compliance with ${f.framework} ${f.control_id} (${f.control_name})`
          })),
          remediationPatchHcl: scanFindings[0]?.remediation_hcl || `# SecureBase Remediation for ${scan.repo_name} (PR #${scan.pr_number})\n# All statutory controls nominal`,
          remediationAnnotations: [
            {
              type: 'WORM_LOCK',
              title: 'WORM Vault Compliance Anchor',
              description: `Vaulted in ${scan.worm_vault_urn}`,
              hclSnippet: `retention_mode = "COMPLIANCE"`
            }
          ],
          wormAttestation: {
            evidence_id: `sb-ev-${scan.id}`,
            timestamp_utc: scan.created_at,
            vendor: 'TxImhotep LLC',
            engine: 'SecureBase Shift-Left v1.0.2',
            gcp_project: 'SecureBase-GCP [594006980795]',
            repository: 'cedrickbyrd/securebase-app',
            portal: 'demo.securebase.tximhotep.com',
            target_platform: scan.target_platform,
            evaluation_status: scan.status === 'SUCCESS'
              ? 'COMPLIANT'
              : scan.status === 'CRITICAL_BLOCK'
              ? 'CRITICAL_FAILURE'
              : 'DRIFT_DETECTED',
            framework_evaluation: {
              [frameworkFocus]: {
                passed_controls: scan.status === 'SUCCESS' ? 5 : 0,
                failed_controls: scan.critical_count,
                drift_controls: scan.findings_count - scan.critical_count,
                status: scan.status === 'SUCCESS' ? 'COMPLIANT' : 'NON_COMPLIANT'
              }
            },
            assessed_scope: scanFindings.map(f => f.resource_block),
            remediation_status: scan.status === 'SUCCESS' ? 'NO_REMEDIATION_NEEDED' : 'PATCH_SYNTHESIZED',
            evidence_sha256: scan.evidence_sha256,
            worm_vault_retention: {
              retention_mode: 'COMPLIANCE',
              retention_period_days: 2555,
              vault_type: scan.target_platform === 'AWS' ? 'AWS_S3_OBJECT_LOCK' : 'GCS_BUCKET_LOCK',
              vault_urn: scan.worm_vault_urn,
              lock_immutable: true
            }
          },
          originalCode: code,
          scenarioName: `${scan.repo_name} (PR #${scan.pr_number})`
        };

        // Instantly update the UI state with live Realtime broadcast
        setReport(updatedReport);
        setRealtimeNotification({
          id: scan.id,
          prNumber: scan.pr_number,
          branch: scan.branch,
          status: scan.status,
          timestamp: new Date().toLocaleTimeString(),
          findingsCount: scan.findings_count
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [frameworkFocus, code]);

  const handleSelectScenario = async (scenario: BenchmarkScenario) => {
    setSelectedScenario(scenario);
    setCode(scenario.initialCode);
    const nextFw = scenario.domain.includes('Banking')
      ? 'FFIEC'
      : scenario.domain.includes('Healthcare')
      ? 'HIPAA'
      : 'NIST80053';
    setFrameworkFocus(nextFw);
    supabase.setFrameworkFocus(nextFw);

    setIsScanning(true);
    try {
      const res = await scanInfrastructureCode(scenario.initialCode, scenario.name);
      // Insert into Supabase operational plane to trigger Realtime broadcast to ci_scans
      await supabase.insertScanWithFindings(
        {
          repo_name: 'acme-corp/cloud-infrastructure',
          pr_number: scenario.domain.includes('Banking') ? 57 : scenario.domain.includes('Healthcare') ? 42 : 19,
          branch: scenario.id,
          commit_sha: res.id.substring(res.id.length - 7),
          status: res.evaluationStatus === 'COMPLIANT'
            ? 'SUCCESS'
            : res.evaluationStatus === 'CRITICAL_FAILURE'
            ? 'CRITICAL_BLOCK'
            : 'VIOLATIONS_DETECTED',
          target_platform: res.targetPlatform,
          frameworks_evaluated: ['FFIEC', 'HIPAA', 'NIST80053'],
          findings_count: res.controls.filter(c => c.status !== 'PASS').length,
          critical_count: res.controls.filter(c => c.severity === 'CRITICAL' && c.status !== 'PASS').length,
          duration_ms: 1350,
          evidence_sha256: res.wormAttestation.evidence_sha256,
          worm_vault_urn: res.wormAttestation.worm_vault_retention.vault_urn
        },
        res.controls.filter(c => c.status !== 'PASS').map(c => ({
          framework: c.framework,
          control_id: c.controlId,
          control_name: c.controlName,
          severity: c.severity,
          status: c.status,
          resource_block: c.affectedAttributes[0] || 'resource.declaration',
          attribute_path: c.affectedAttributes[0] || 'attribute',
          exploit_vector: c.findingDetails,
          remediation_hcl: res.remediationPatchHcl
        }))
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunScan = async () => {
    if (activeView !== 'workbench') {
      setActiveView('workbench');
    }
    setIsScanning(true);
    try {
      const res = await scanInfrastructureCode(code, selectedScenario.name);
      // Trigger Supabase Realtime broadcast by inserting into ci_scans table
      await supabase.insertScanWithFindings(
        {
          repo_name: 'acme-corp/cloud-infrastructure',
          pr_number: Math.floor(Math.random() * 80) + 20,
          branch: 'main',
          commit_sha: res.id.substring(res.id.length - 7),
          status: res.evaluationStatus === 'COMPLIANT'
            ? 'SUCCESS'
            : res.evaluationStatus === 'CRITICAL_FAILURE'
            ? 'CRITICAL_BLOCK'
            : 'VIOLATIONS_DETECTED',
          target_platform: res.targetPlatform,
          frameworks_evaluated: ['FFIEC', 'HIPAA', 'NIST80053'],
          findings_count: res.controls.filter(c => c.status !== 'PASS').length,
          critical_count: res.controls.filter(c => c.severity === 'CRITICAL' && c.status !== 'PASS').length,
          duration_ms: 1280,
          evidence_sha256: res.wormAttestation.evidence_sha256,
          worm_vault_urn: res.wormAttestation.worm_vault_retention.vault_urn
        },
        res.controls.filter(c => c.status !== 'PASS').map(c => ({
          framework: c.framework,
          control_id: c.controlId,
          control_name: c.controlName,
          severity: c.severity,
          status: c.status,
          resource_block: c.affectedAttributes[0] || 'resource.declaration',
          attribute_path: c.affectedAttributes[0] || 'attribute',
          exploit_vector: c.findingDetails,
          remediation_hcl: res.remediationPatchHcl
        }))
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleResetToBaseline = () => {
    setCode(selectedScenario.initialCode);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* 3-Zone Top Bar Contract */}
      <Header
        activeView={activeView}
        onSelectView={setActiveView}
        onRunScan={handleRunScan}
        isScanning={isScanning}
        onOpenCarrierHeritage={() => setIsCarrierModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Supabase Realtime Live Ingestion Toast / Alert */}
        {realtimeNotification && (
          <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-emerald-300 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-white">Supabase Realtime Stream:</span>
              <span>
                New record in <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">ci_scans</code> (PR #{realtimeNotification.prNumber} &middot; {realtimeNotification.branch})
              </span>
              <span className="hidden md:inline text-slate-400">&middot;</span>
              <span className="hidden md:inline text-emerald-400 font-semibold">
                Replaced static results ({realtimeNotification.findingsCount} findings)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
              <span className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-cyan-400">
                Postgres WebSockets Active
              </span>
              <span>{realtimeNotification.timestamp}</span>
            </div>
          </div>
        )}

        {/* Universal Top-of-Funnel PLG Banner */}
        <GitHubActionCallout />

        {/* Dynamic UTM Institutional Personalization Banner & Campaign Simulator */}
        <UtmPersonalizationBanner
          activeProfile={activeProfile}
          onSelectProfile={(p) => {
            setActiveProfile(p);
            setFrameworkFocus(p.primaryFramework);
            supabase.setFrameworkFocus(p.primaryFramework);
          }}
          onOpenPipelineModal={() => setIsPipelineModalOpen(true)}
          onOpenGtmModal={() => setIsGtmModalOpen(true)}
          onOpenTreasuryModal={() => setIsTreasuryModalOpen(true)}
        />

        {/* Universal Framework Toggle & Live Posture Index */}
        <FrameworkToggleBar
          activeFramework={frameworkFocus}
          onFrameworkChange={(fw) => {
            setFrameworkFocus(fw);
            supabase.setFrameworkFocus(fw);
          }}
        />

        {/* Institutional Examiner Export & Deep-Link PR Inspector Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Award className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Institutional Governance Actions:</span>
            <span className="text-white font-semibold">{activeProfile.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsMvnoModalOpen(true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-cyan-500/70 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer font-semibold whitespace-nowrap shrink-0"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>securebase-mvno Core &amp; Cost Model</span>
            </button>
            <button
              onClick={() => setIsCarrierModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-950/90 via-slate-950 to-blue-950/90 hover:from-cyan-900 hover:to-blue-900 border border-cyan-400/80 text-cyan-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ring-1 ring-cyan-400/30 font-bold"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>25-Yr Carrier Infrastructure Lineage (AT&amp;T &middot; SATCOM)</span>
            </button>
            <button
              onClick={() => setIsTriCloudModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-950/80 via-slate-950 to-amber-950/80 hover:from-blue-900/80 hover:to-amber-900/80 border border-cyan-500/60 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ring-1 ring-cyan-500/20 font-bold"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tri-Cloud Marketplace Matrix (v3.0)</span>
            </button>
            <button
              onClick={() => setIsGcpModalOpen(true)}
              className="px-3 py-1.5 bg-blue-950/70 hover:bg-blue-900/80 border border-blue-700/80 text-blue-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span>GCP Marketplace GTM (v2.3)</span>
            </button>
            <button
              onClick={() => setIsTreasuryModalOpen(true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-cyan-800/80 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Internal Treasury Guardrails (tximhotep-engine v3.1)</span>
            </button>
            <button
              onClick={() => setIsDriftModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/80 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LineChart className="w-3.5 h-3.5 text-cyan-400" />
              <span>90-Day Drift Timeline &amp; MTTR (CNB Waxahachie)</span>
            </button>
            <button
              onClick={() => setIsGtmModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/80 text-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sales Strategy &amp; GTM Playbook (2026–2029)</span>
            </button>
            <ExecutiveSummaryPDF report={report} variant="compact" />
            <button
              onClick={() => setIsBinderModalOpen(true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-cyan-800/70 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Generate Examiner Audit Binder (FDIC / OCR)</span>
            </button>
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/80 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Webhook className="w-3.5 h-3.5 text-cyan-400" />
              <span>Test Ingestion Webhook (/functions/v1/ingest-ci-scan)</span>
            </button>
            <button
              onClick={() => setInspectedScan(supabase.getScans()[0] || null)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>Inspect Deep-Linked PR Run (/runs/:id)</span>
            </button>
          </div>
        </div>

        {activeView === 'zero-custody' && <ZeroDataCustodyView />}
        {activeView === 'matrices' && <ControlMatrixViewer />}
        {activeView === 'evidence' && (
          <EvidenceLedger currentAttestation={report?.wormAttestation} />
        )}
        {activeView === 'playground' && <DriftPlayground />}
        {activeView === 'harness' && <AgentHarnessWorkbench />}
        {activeView === 'tricloud' && <TriCloudOpsWorkbench />}

        {activeView === 'workbench' && (
          <div className="space-y-6">
            {/* Workbench Top: Scenario Selection & IaC Editor */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>PRE-FLIGHT IAC AST PARSER &middot; ZERO DATA CUSTODY</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Sovereign Cloud Compliance Workbench
                  </h1>
                </div>

                {/* Scenario Selector Segmented Control */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                  {BENCHMARK_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => handleSelectScenario(sc)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedScenario.id === sc.id
                          ? 'bg-slate-800 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sc.domain.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Scenario Metadata Card */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-mono mb-1">
                    <span className="font-bold text-white text-sm">
                      {selectedScenario.name}
                    </span>
                    <span className="text-slate-400">&middot;</span>
                    <span className="text-cyan-400 font-semibold">
                      Platform: [{selectedScenario.platform}]
                    </span>
                  </div>
                  <p className="text-slate-300 font-sans leading-relaxed">
                    {selectedScenario.description}
                  </p>
                  <p className="text-rose-400 font-mono text-[11px] mt-1">
                    Target Violation: {selectedScenario.highlightedViolation}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetToBaseline}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="Reset IaC to original benchmark configuration"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Baseline</span>
                  </button>

                  <button
                    onClick={handleRunScan}
                    disabled={isScanning}
                    className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Evaluate AST</span>
                  </button>
                </div>
              </div>

              {/* Code Editor Area */}
              <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-200 font-semibold">main.tf / main.tofu</span>
                    <span className="text-slate-500">&middot;</span>
                    <span className="text-slate-400">Pre-flight IaC AST Input</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Zero customer payloads ingested &middot; In-memory parsing only
                  </span>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="w-full bg-slate-950 text-slate-100 p-4 font-mono text-xs leading-relaxed focus:outline-none resize-y selection:bg-cyan-500/30"
                  placeholder="# Paste OpenTofu / Terraform HCL code here..."
                />
              </div>
            </div>

            {/* Execution Workflow & Strict Output Navigation */}
            {report && (
              <div className="space-y-6">
                {/* Navigation Tabs for the 5 Output Stages */}
                <div className="flex items-center justify-between gap-4 p-2 bg-slate-900/80 border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 px-3 py-1 font-semibold whitespace-nowrap">
                      Execution Stages:
                    </span>
                    <button
                      onClick={() => setActiveStageTab('all')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === 'all'
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All 5 Stages
                    </button>
                    <button
                      onClick={() => setActiveStageTab('1')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === '1'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      1. Executive Summary
                    </button>
                    <button
                      onClick={() => setActiveStageTab('2')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === '2'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      2. Control Mapping Table
                    </button>
                    <button
                      onClick={() => setActiveStageTab('3')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === '3'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3. Root Cause Analysis
                    </button>
                    <button
                      onClick={() => setActiveStageTab('4')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === '4'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      4. Remediation Patch
                    </button>
                    <button
                      onClick={() => setActiveStageTab('5')}
                      className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeStageTab === '5'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      5. Cryptographic Attestation
                    </button>
                  </div>

                  <div className="hidden lg:flex items-center gap-2 text-slate-400 text-[11px] pr-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Evidence Digest: {report.wormAttestation.evidence_sha256.substring(0, 12)}...</span>
                  </div>
                </div>

                {/* Strict Output Sequence: All 5 Mandatory Stages */}
                <div className="space-y-6">
                  {/* STAGE 1: EXECUTIVE AUDIT SUMMARY */}
                  {(activeStageTab === 'all' || activeStageTab === '1') && (
                    <ExecutiveSummary report={report} />
                  )}

                  {/* STAGE 2: STATUTORY CONTROL MAPPING TABLE */}
                  {(activeStageTab === 'all' || activeStageTab === '2') && (
                    <StatutoryControlTable controls={report.controls} />
                  )}

                  {/* STAGE 3: ROOT CAUSE & RISK VECTOR ANALYSIS */}
                  {(activeStageTab === 'all' || activeStageTab === '3') && (
                    <RootCauseAnalysis findings={report.rootCauses} />
                  )}

                  {/* STAGE 4: NON-DESTRUCTIVE REMEDIATION PATCH */}
                  {(activeStageTab === 'all' || activeStageTab === '4') && (
                    <RemediationPatch
                      remediationHcl={report.remediationPatchHcl}
                      annotations={report.remediationAnnotations}
                      targetPlatform={report.targetPlatform}
                    />
                  )}

                  {/* STAGE 5: CRYPTOGRAPHIC WORM EVIDENCE ATTESTATION */}
                  {(activeStageTab === 'all' || activeStageTab === '5') && (
                    <WormAttestation attestation={report.wormAttestation} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Commercial Pipeline Tracker Modal (Texas Banks Outreach) */}
        <CommercialPipelineModal
          isOpen={isPipelineModalOpen}
          onClose={() => setIsPipelineModalOpen(false)}
        />

        {/* Enterprise Sales Strategy & GTM Playbook Modal (2026-2029) */}
        <GtmPlaybookModal
          isOpen={isGtmModalOpen}
          onClose={() => setIsGtmModalOpen(false)}
        />

        {/* Internal Treasury Guardrails & Sweep Engine Modal (tximhotep-engine v3.1) */}
        <TreasuryGuardrailsModal
          isOpen={isTreasuryModalOpen}
          onClose={() => setIsTreasuryModalOpen(false)}
        />

        {/* 90-Day Regulatory Drift Timeline & MTTR Analytics Modal (CNB Waxahachie) */}
        <ComplianceDriftModal
          isOpen={isDriftModalOpen}
          onClose={() => setIsDriftModalOpen(false)}
          tenantId="cnb-waxahachie"
        />

        {/* Tri-Cloud Marketplace Integration Matrix Modal (Specification v3.0) */}
        <TriCloudMarketplaceModal
          isOpen={isTriCloudModalOpen}
          onClose={() => setIsTriCloudModalOpen(false)}
        />

        {/* GCP Marketplace Integration Modal (Rev v2.3 - Google EDP Burn) */}
        <GcpMarketplaceModal
          isOpen={isGcpModalOpen}
          onClose={() => setIsGcpModalOpen(false)}
        />

        {/* Carrier-Grade Infrastructure & Systems Engineering Provenance (25-Yr Lineage) */}
        <CarrierGradeInfrastructureModal
          isOpen={isCarrierModalOpen}
          onClose={() => setIsCarrierModalOpen(false)}
        />

        {/* Sovereign Virtual Mobile Packet Core & Unit Economics (securebase-mvno) */}
        <MvnoArchitectureModal
          isOpen={isMvnoModalOpen}
          onClose={() => setIsMvnoModalOpen(false)}
        />

        {/* Formal Examiner Audit Binder Modal (FDIC / OCR / OCC PDF Export) */}
        <ExaminerAuditBinderModal
          isOpen={isBinderModalOpen}
          onClose={() => setIsBinderModalOpen(false)}
          report={report}
          activeProfile={activeProfile}
        />

        {/* Deep-Linked CI/CD Run Inspector Modal (/runs/:id) */}
        <RunInspectorModal
          isOpen={!!inspectedScan}
          onClose={() => setInspectedScan(null)}
          scan={inspectedScan}
          findings={inspectedScan ? supabase.getFindings(inspectedScan.id) : []}
        />

        {/* Supabase Ingestion Webhook Test Console (/functions/v1/ingest-ci-scan) */}
        <WebhookSimulatorModal
          isOpen={isWebhookModalOpen}
          onClose={() => setIsWebhookModalOpen(false)}
          onPayloadIngested={() => {
            // Activate Texas Regional Bank profile on test webhook ingestion
            const texasProfile = detectInstitutionalProfile();
            setActiveProfile(texasProfile);
            setFrameworkFocus('FFIEC');
            setIsWebhookModalOpen(false);
          }}
        />
      </main>

      {/* Sovereign Engine Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-6 text-xs text-slate-400 font-mono">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">SecureBase</span>
            <span>&middot;</span>
            <span>Developed by TxImhotep LLC</span>
            <span>&middot;</span>
            <span className="text-slate-400">Tri-Cloud Specification v3.0</span>
          </div>

          <div className="flex items-center flex-wrap gap-4 text-[11px] text-slate-400">
            <span>AWS: <code className="text-amber-400">prod-p7z4iqf7gg6dk</code> (EDP)</span>
            <span>&middot;</span>
            <span>GCP: <code className="text-blue-400">securebase-gcp-dev</code> (EDP)</span>
            <span>&middot;</span>
            <span>Azure: <code className="text-cyan-400">MACC Eligible</code></span>
            <span>&middot;</span>
            <span>Repo: cedrickbyrd/securebase-app</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
