import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Radio,
  ShieldCheck,
  Lock,
  Layers,
  DollarSign,
  FolderTree,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Globe,
  Plus,
  ShieldAlert,
  FileText,
  Cpu
} from 'lucide-react';
import {
  MVNO_COMMERCIAL_STACK,
  MVNO_SOVEREIGN_PERIMETERS,
  MVNO_ARCHITECTURE_LAYERS,
  PHASE1_BRIDGE_COSTS,
  PHASE2_THICK_COSTS,
  SovereignScopeId,
  WormCdrRecord
} from '../data/mvnoData';
import { PcfOpaGeofenceSimulator } from './mvno/PcfOpaGeofenceSimulator';
import { TerraformPlanDiffInspector } from './mvno/TerraformPlanDiffInspector';
import { WorkspaceRepoViewer } from './mvno/WorkspaceRepoViewer';
import { EdgeComplianceSimulator } from './mvno/EdgeComplianceSimulator';
import {
  fetchMvnoHealth,
  fetchMvnoSandboxState,
  appendWormCdrViaApi,
  tamperWormCdrViaApi,
  verifyWormCdrViaApi,
  resetWormVaultViaApi,
  SimInventoryRecord,
  QuarantineAuditLog,
  ChainVerificationResult,
  EdgeEndpointRecord,
  EdgeWormBufferedRecord
} from '../services/mvnoApiService';

interface MvnoArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MvnoTab = 'topology' | 'geofence' | 'edge' | 'economics' | 'tf-diff' | 'worm' | 'scaffold';

export const MvnoArchitectureModal: React.FC<MvnoArchitectureModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<MvnoTab>('topology');
  const [activePerimeterId, setActivePerimeterId] = useState<SovereignScopeId>('securebase-us');
  const [selectedLayerId, setSelectedLayerId] = useState<string>(MVNO_ARCHITECTURE_LAYERS[0].id);

  // Runtime & Persistence status
  const [runtimeMode, setRuntimeMode] = useState<string>('express-corelink-bridge');
  const [simInventory, setSimInventory] = useState<SimInventoryRecord[]>([]);
  const [quarantineLogs, setQuarantineLogs] = useState<QuarantineAuditLog[]>([]);
  const [edgeEndpoints, setEdgeEndpoints] = useState<EdgeEndpointRecord[]>([]);
  const [edgeWormBuffer, setEdgeWormBuffer] = useState<EdgeWormBufferedRecord[]>([]);

  // Tab 3: Phase 1 vs Phase 2 CapEx/OpEx Calculator state
  const [enterpriseClients, setEnterpriseClients] = useState<number>(10);
  const [endpointsPerClient, setEndpointsPerClient] = useState<number>(100);
  const [endpointMonthlyPrice, setEndpointMonthlyPrice] = useState<number>(35);
  const [platformMonthlyFee, setPlatformMonthlyFee] = useState<number>(1500);
  const [scopeDeployment, setScopeDeployment] = useState<'single' | 'multi'>('multi');

  // Tab 5: WORM CDR SHA-256 Chain Verification Simulator state (persisted server-side)
  const [cdrRecords, setCdrRecords] = useState<WormCdrRecord[]>([]);
  const [chainVerification, setChainVerification] = useState<ChainVerificationResult>({
    checked: false,
    valid: true,
    brokenAtSeq: null,
    summary: 'Loading persisted WORM CDR chain...'
  });
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  const syncSandboxFromServer = useCallback(async () => {
    try {
      const [state, health] = await Promise.all([fetchMvnoSandboxState(), fetchMvnoHealth()]);
      setSimInventory(state.sims);
      setCdrRecords(state.wormChain);
      setQuarantineLogs(state.quarantineLogs);
      setChainVerification(state.chainVerification);
      setEdgeEndpoints(state.edgeEndpoints || []);
      setEdgeWormBuffer(state.edgeWormBuffer || []);
      setRuntimeMode(health.runtimeMode);
    } catch {
      // Non-fatal fallback state message if API is restarting
      setChainVerification({
        checked: false,
        valid: false,
        brokenAtSeq: null,
        summary: 'Unable to reach /api/mvno/state bridge.'
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      syncSandboxFromServer();
    }
  }, [isOpen, syncSandboxFromServer]);

  const activePerimeter = useMemo(
    () => MVNO_SOVEREIGN_PERIMETERS.find((p) => p.id === activePerimeterId) || MVNO_SOVEREIGN_PERIMETERS[0],
    [activePerimeterId]
  );

  const selectedLayer = useMemo(
    () => MVNO_ARCHITECTURE_LAYERS.find((l) => l.id === selectedLayerId) || MVNO_ARCHITECTURE_LAYERS[0],
    [selectedLayerId]
  );

  // Economics calculations
  const totalEndpoints = enterpriseClients * endpointsPerClient;
  const isPhase2Triggered = enterpriseClients >= 10;
  const monthlyMrr = totalEndpoints * endpointMonthlyPrice + enterpriseClients * platformMonthlyFee;
  const annualArr = monthlyMrr * 12;

  const phase1MonthlyOpEx = useMemo(() => {
    const fixed = 500 + 350 + 85;
    return fixed + totalEndpoints * 4.5;
  }, [totalEndpoints]);

  const phase2MonthlyOpEx = useMemo(() => {
    const baseOpEx = scopeDeployment === 'multi' ? 15500 : 5630;
    const incrementalScale = totalEndpoints > 1000 ? (totalEndpoints - 1000) * 1.25 : 0;
    return Math.round(baseOpEx + incrementalScale);
  }, [scopeDeployment, totalEndpoints]);

  const activeMonthlyOpEx = isPhase2Triggered ? phase2MonthlyOpEx : phase1MonthlyOpEx;
  const grossMarginPct = monthlyMrr > 0 ? Math.round(((monthlyMrr - activeMonthlyOpEx) / monthlyMrr) * 1000) / 10 : 0;
  const phase1BreakEvenEndpoints = Math.ceil((500 + 350 + 85) / Math.max(1, endpointMonthlyPrice - 4.5));

  // Persisted WORM CDR API handlers
  const handleAppendCdrRecord = async () => {
    const res = await appendWormCdrViaApi(activePerimeterId);
    setCdrRecords(res.wormChain);
    setChainVerification(res.chainVerification);
  };

  const handleSimulateTamper = async () => {
    const res = await tamperWormCdrViaApi();
    setCdrRecords(res.wormChain);
    setChainVerification(res.chainVerification);
  };

  const handleVerifyCdrChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await verifyWormCdrViaApi();
      setCdrRecords(res.wormChain);
      setChainVerification(res.chainVerification);
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleResetCleanVault = async () => {
    const fresh = await resetWormVaultViaApi();
    setSimInventory(fresh.sims);
    setCdrRecords(fresh.wormChain);
    setQuarantineLogs(fresh.quarantineLogs);
    setChainVerification(fresh.chainVerification);
    setEdgeEndpoints(fresh.edgeEndpoints || []);
    setEdgeWormBuffer(fresh.edgeWormBuffer || []);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold">securebase-mvno</span>
              <span aria-hidden="true">·</span>
              <span>free5GC R17+ &amp; eBPF UPF</span>
              <span aria-hidden="true">·</span>
              <span>FFIEC · HIPAA · DORA · MAS TRM</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">{runtimeMode}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Sovereign Virtual Mobile Packet Core &amp; Workspace Control Plane
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Full workspace scaffold and live CoreLink API bridge across securebase-us, securebase-euro, and securebase-asia perimeters, with persistent WORM CDR chains and Phase 1 to Phase 2 Terraform diffs.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
            aria-label="Close MVNO Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Sovereign Perimeters Selector Bar (All 3 Active by Default) */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Active Sovereign Perimeters (3/3):</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {MVNO_SOVEREIGN_PERIMETERS.map((perim) => {
              const isSelected = perim.id === activePerimeterId;
              return (
                <button
                  key={perim.id}
                  onClick={() => setActivePerimeterId(perim.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-300 border-cyan-500/60 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {perim.label} · {perim.regions.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs (Single-Line Controls) */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('topology')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'topology'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Core Topology</span>
          </button>

          <button
            onClick={() => setActiveTab('geofence')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'geofence'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>2. 15ms Geofence</span>
          </button>

          <button
            onClick={() => setActiveTab('edge')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'edge'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3. Edge (TPM/XDP)</span>
          </button>

          <button
            onClick={() => setActiveTab('economics')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'economics'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>4. Unit Economics</span>
          </button>

          <button
            onClick={() => setActiveTab('tf-diff')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'tf-diff'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>5. Terraform Diff</span>
          </button>

          <button
            onClick={() => setActiveTab('worm')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'worm'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>6. WORM CDR &amp; SIMs</span>
          </button>

          <button
            onClick={() => setActiveTab('scaffold')}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'scaffold'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>7. Workspace Repo &amp; ZIP</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: 4-LAYER ARCHITECTURE & SOVEREIGN TOPOLOGY */}
          {activeTab === 'topology' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MVNO_COMMERCIAL_STACK.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <div className="text-[11px] font-mono text-cyan-400 mt-0.5">{item.tagline}</div>
                    <p className="text-xs text-slate-400 mt-2">{item.role}</p>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">{activePerimeter.label} · {activePerimeter.regions}</div>
                    <h3 className="text-base font-bold text-white mt-0.5">Sovereign Enclave Networking &amp; WORM Binding</h3>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Zero Public IP Exposure</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block mb-1">Private APN Domain</span>
                    <span className="text-white break-all">{activePerimeter.apnDomain}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">RFC 6598 / 1918 Pool</span>
                    <span className="text-cyan-300 tabular-nums">{activePerimeter.cgnatPool}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Breakout Transport</span>
                    <span className="text-slate-200 font-sans text-xs">{activePerimeter.breakoutTransport}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">7-Yr WORM CDR Sink</span>
                    <span className="text-emerald-400 break-all">{activePerimeter.wormVaultUrn}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    <strong className="text-slate-200">Enforced Mandates:</strong> {activePerimeter.primaryFrameworks.join(' · ')}
                  </span>
                  <span className="font-mono tabular-nums text-slate-300">
                    Allowed TACs: {activePerimeter.allowedTacs.join(' · ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="text-xs font-mono text-slate-400 mb-2">
                    4 Deterministic Architecture Layers
                  </div>
                  {MVNO_ARCHITECTURE_LAYERS.map((layer) => {
                    const isActive = layer.id === selectedLayerId;
                    return (
                      <button
                        key={layer.id}
                        onClick={() => setSelectedLayerId(layer.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-800/80 border-cyan-500/60'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[11px] font-mono text-cyan-400">{layer.order}</div>
                        <div className="text-sm font-bold text-white mt-0.5">{layer.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{layer.subtitle}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-7 p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-5">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">{selectedLayer.order} Specification</div>
                    <h4 className="text-lg font-bold text-white mt-1">{selectedLayer.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{selectedLayer.subtitle}</p>
                  </div>

                  <div>
                    <div className="text-xs font-mono text-slate-300 mb-2">Core Implementation Components</div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {selectedLayer.stackComponents.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-mono text-slate-400 mb-1.5">Protocols &amp; Interfaces</div>
                      <div className="space-y-1 font-mono text-slate-200 tabular-nums">
                        {selectedLayer.protocolsAndPorts.map((p, idx) => (
                          <div key={idx}>{p}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-slate-400 mb-1.5">Statutory Alignment</div>
                      <div className="space-y-1 text-emerald-400">
                        {selectedLayer.complianceMapping.map((c, idx) => (
                          <div key={idx}>{c}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 text-xs">
                    <div className="font-mono text-slate-400 mb-1">Zero-Data-Custody Invariant</div>
                    <p className="text-slate-200">{selectedLayer.zeroCustodyGuarantee}</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                      <th className="py-3 px-4">Sovereign Scope</th>
                      <th className="py-3 px-4">Primary Cloud Regions</th>
                      <th className="py-3 px-4">Governing Mandates</th>
                      <th className="py-3 px-4 text-right">OPA SLA Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                    {MVNO_SOVEREIGN_PERIMETERS.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setActivePerimeterId(p.id)}
                        className={`cursor-pointer transition-colors ${
                          p.id === activePerimeterId ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-cyan-300">{p.label}</td>
                        <td className="py-3 px-4 font-mono text-slate-200">{p.regions}</td>
                        <td className="py-3 px-4 text-slate-300">{p.primaryFrameworks.join(' · ')}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right text-emerald-400">
                          {p.latencyTargetMs} ms (&lt; 15 ms)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PCF-TO-OPA 15MS GEOFENCE & QUARANTINE SIMULATOR */}
          {activeTab === 'geofence' && (
            <PcfOpaGeofenceSimulator
              activePerimeter={activePerimeter}
              onSelectPerimeter={setActivePerimeterId}
              quarantineLogs={quarantineLogs}
              onSandboxSynced={syncSandboxFromServer}
            />
          )}

          {/* TAB 3: EDGE COMPLIANCE (IOT SAFE, TPM PCR, EBPF XDP, MEC WORM CACHE) */}
          {activeTab === 'edge' && (
            <EdgeComplianceSimulator
              edgeEndpoints={edgeEndpoints}
              edgeWormBuffer={edgeWormBuffer}
              onSandboxSynced={syncSandboxFromServer}
            />
          )}

          {/* TAB 4: PHASE 1 VS PHASE 2 CAPEX/OPEX & UNIT ECONOMICS CALCULATOR */}
          {activeTab === 'economics' && (
            <div className="space-y-6">
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Interactive Capital Milestone &amp; Gross Margin Model
                    </h3>
                    <p className="text-xs text-slate-400">
                      Phase 1 validates demand (Clients 5-9) via wholesale MVNE Private APN before triggering Phase 2 Thick Core at Client #10.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono shrink-0">
                    <button
                      onClick={() => setScopeDeployment('single')}
                      className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        scopeDeployment === 'single'
                          ? 'bg-slate-800 text-cyan-300 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Single Scope (us)
                    </button>
                    <button
                      onClick={() => setScopeDeployment('multi')}
                      className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        scopeDeployment === 'multi'
                          ? 'bg-slate-800 text-cyan-300 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Multi-Scope (us+euro+asia)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs font-mono">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Enterprise Clients:</span>
                      <span className="text-cyan-400 font-bold tabular-nums">{enterpriseClients}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="25"
                      step="1"
                      value={enterpriseClients}
                      onChange={(e) => setEnterpriseClients(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      {isPhase2Triggered ? 'Phase 2 Triggered (>= 10 Clients)' : 'Phase 1 Wholesale Bridge (< 10 Clients)'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Endpoints / Client:</span>
                      <span className="text-cyan-400 font-bold tabular-nums">{endpointsPerClient}</span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="250"
                      step="25"
                      value={endpointsPerClient}
                      onChange={(e) => setEndpointsPerClient(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-400 block tabular-nums">
                      Total Active SIMs: {totalEndpoints.toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Endpoint Rate ($/mo):</span>
                      <span className="text-emerald-400 font-bold tabular-nums">${endpointMonthlyPrice}</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="55"
                      step="5"
                      value={endpointMonthlyPrice}
                      onChange={(e) => setEndpointMonthlyPrice(Number(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-400 block tabular-nums">
                      Phase 1 break-even: ~{phase1BreakEvenEndpoints} endpoints
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Compliance Fee ($/mo):</span>
                      <span className="text-emerald-400 font-bold tabular-nums">${platformMonthlyFee.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="3000"
                      step="250"
                      value={platformMonthlyFee}
                      onChange={(e) => setPlatformMonthlyFee(Number(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Per enterprise tenant platform fee
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 block">Monthly Recurring (MRR)</span>
                  <span className="text-xl font-bold text-white mt-1 block tabular-nums">
                    ${monthlyMrr.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-400 block mt-1 tabular-nums">
                    ${annualArr.toLocaleString()} ARR
                  </span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 block">Estimated Monthly OpEx</span>
                  <span className="text-xl font-bold text-amber-400 mt-1 block tabular-nums">
                    ${activeMonthlyOpEx.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {isPhase2Triggered
                      ? scopeDeployment === 'multi'
                        ? 'Phase 2 Multi-Scope (us+euro+asia)'
                        : 'Phase 2 Single Scope (us)'
                      : 'Phase 1 Wholesale MVNE'}
                  </span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 block">Projected Gross Margin</span>
                  <span
                    className={`text-xl font-bold mt-1 block tabular-nums ${
                      grossMarginPct >= 65 ? 'text-emerald-400' : grossMarginPct >= 40 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {grossMarginPct}%
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Before tiered data overages
                  </span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 block">Architecture Gate</span>
                  <span
                    className={`text-sm font-bold mt-1.5 block ${
                      isPhase2Triggered ? 'text-cyan-400' : 'text-amber-300'
                    }`}
                  >
                    {isPhase2Triggered ? 'PHASE 2: THICK CORE' : 'PHASE 1: MVNE BRIDGE'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1 tabular-nums">
                    {isPhase2Triggered ? 'Setup: ~$65K multi / $22K-$32K single' : 'Setup: $3,250-$5,750 one-time'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Phase 1: Light MVNO / Private APN Pilot</h4>
                      <span className="text-xs text-slate-400">Clients 5-9 · Est. 250 SIMs Baseline (Twilio / KORE / 1NCE)</span>
                    </div>
                    <span className="text-xs font-mono text-amber-400 font-bold tabular-nums">$2,060 / mo</span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono">
                        <th className="py-2.5 px-3">Cost Category</th>
                        <th className="py-2.5 px-3 text-right">Setup</th>
                        <th className="py-2.5 px-3 text-right">Monthly OpEx</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {PHASE1_BRIDGE_COSTS.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-200 font-medium">{row.category}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{row.notes}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-300 whitespace-nowrap">
                            {row.setupMin === row.setupMax
                              ? `$${row.setupMin.toLocaleString()}`
                              : `$${row.setupMin.toLocaleString()}-$${row.setupMax.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-white whitespace-nowrap">
                            ${row.monthlyOpEx.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-950 font-mono font-bold">
                        <td className="py-2.5 px-3 text-white">Phase 1 Subtotal</td>
                        <td className="py-2.5 px-3 text-right text-amber-300 tabular-nums">$3,250-$5,750</td>
                        <td className="py-2.5 px-3 text-right text-amber-300 tabular-nums">$2,060 / mo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Phase 2: Thick MVNO Cloud-Native Core</h4>
                      <span className="text-xs text-slate-400">Triggered at 10+ Clients · free5GC R17+ / eBPF UPF (Single Scope)</span>
                    </div>
                    <span className="text-xs font-mono text-cyan-400 font-bold tabular-nums">$5,630 / mo</span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono">
                        <th className="py-2.5 px-3">Cost Category</th>
                        <th className="py-2.5 px-3 text-right">CapEx Setup</th>
                        <th className="py-2.5 px-3 text-right">Monthly OpEx</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {PHASE2_THICK_COSTS.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-200 font-medium">{row.category}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{row.notes}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-300 whitespace-nowrap">
                            {row.setupMin === row.setupMax
                              ? `$${row.setupMin.toLocaleString()}`
                              : `$${row.setupMin.toLocaleString()}-$${row.setupMax.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-white whitespace-nowrap">
                            ${row.monthlyOpEx.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-950 font-mono font-bold">
                        <td className="py-2.5 px-3 text-white">Single Scope / Multi-Scope</td>
                        <td className="py-2.5 px-3 text-right text-cyan-300 tabular-nums">$22K-$32K / ~$65K</td>
                        <td className="py-2.5 px-3 text-right text-cyan-300 tabular-nums">$5,630 / ~$15.5K</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PHASE 1 -> PHASE 2 TERRAFORM PLAN DIFF INSPECTOR */}
          {activeTab === 'tf-diff' && (
            <TerraformPlanDiffInspector activePerimeter={activePerimeter} />
          )}

          {/* TAB 5: PERSISTED WORM CDR CHAIN & SIM POSTURE LEDGER */}
          {activeTab === 'worm' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Immutable CDR &amp; Telemetry Vaulting (Persisted Sandbox Chain)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Server-persisted session metadata (salted IMSI hash, TAC, timestamps, byte counters) sealed with SHA-256 chain digests for 7-year COMPLIANCE Object Lock.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleAppendCdrRecord}
                    className="px-3 py-2 text-xs font-mono text-slate-200 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Append Session CDR</span>
                  </button>
                  <button
                    onClick={handleSimulateTamper}
                    className="px-3 py-2 text-xs font-mono text-rose-300 hover:text-rose-200 bg-rose-950/40 border border-rose-800/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Simulate Tamper Drift</span>
                  </button>
                  <button
                    onClick={handleResetCleanVault}
                    className="px-3 py-2 text-xs font-mono text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Clean Vault</span>
                  </button>
                  <button
                    onClick={handleVerifyCdrChain}
                    disabled={isVerifyingChain}
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isVerifyingChain ? 'Verifying...' : 'Verify WORM Integrity Chain'}</span>
                  </button>
                </div>
              </div>

              {/* Verification Status Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
                  chainVerification.checked && !chainVerification.valid
                    ? 'bg-rose-950/40 border-rose-700/70 text-rose-300'
                    : chainVerification.checked && chainVerification.valid
                    ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-700/60 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {chainVerification.checked && !chainVerification.valid ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : chainVerification.checked && chainVerification.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span>{chainVerification.summary}</span>
                </div>
                <span className="text-slate-400 shrink-0">
                  Retention: COMPLIANCE (2,555 Days / 7 Yrs)
                </span>
              </div>

              {/* CDR Hash Chain Table */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="py-3 px-3">Seq</th>
                      <th className="py-3 px-3">Scope &amp; Record ID</th>
                      <th className="py-3 px-3">Salted IMSI Hash &amp; TAC</th>
                      <th className="py-3 px-3 text-right">UL / DL Bytes</th>
                      <th className="py-3 px-3">Verdict</th>
                      <th className="py-3 px-3">SHA-256 HMAC Digest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40 tabular-nums">
                    {cdrRecords.map((rec) => {
                      const isBroken = chainVerification.checked && chainVerification.brokenAtSeq === rec.seq;
                      return (
                        <tr key={rec.recordId} className={isBroken ? 'bg-rose-950/30' : ''}>
                          <td className="py-3 px-3 text-slate-300">#{rec.seq}</td>
                          <td className="py-3 px-3">
                            <div className="text-white font-semibold">{rec.recordId}</div>
                            <div className="text-[11px] text-cyan-400">{rec.perimeter}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-300">{rec.imsiHash.substring(0, 16)}...</div>
                            <div className="text-[11px] text-slate-400">{rec.tac}</div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className={rec.tampered ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                              {rec.uplinkBytes.toLocaleString()} B / {rec.downlinkBytes.toLocaleString()} B
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {rec.tunnelStartUtc.substring(11, 19)} - {rec.tunnelEndUtc.substring(11, 19)} UTC
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={
                                rec.verdict === 'COMPLIANT' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                              }
                            >
                              {rec.verdict}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className={isBroken ? 'text-rose-400 font-bold' : 'text-cyan-300'}>
                              {rec.hmacSha256.substring(0, 24)}...
                            </div>
                            <div className="text-[10px] text-slate-500">
                              prev: {rec.prevHash.substring(0, 12)}...
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Persisted SIM / eUICC Inventory Posture */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto">
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-200 font-semibold">
                    Persisted SIM / eUICC Endpoint Posture ({simInventory.length})
                  </span>
                  <span className="text-slate-400">Synchronized with CoreLink Geofence Triggers</span>
                </div>
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3">IMSI / VRF</th>
                      <th className="py-2.5 px-3">Perimeter</th>
                      <th className="py-2.5 px-3">Private APN</th>
                      <th className="py-2.5 px-3">Last TAC</th>
                      <th className="py-2.5 px-3">PDU Session State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40 tabular-nums">
                    {simInventory.map((sim) => (
                      <tr key={sim.imsi}>
                        <td className="py-2.5 px-3">
                          <div className="text-white font-semibold">{sim.imsi}</div>
                          <div className="text-[11px] text-slate-400">{sim.assignedVrf}</div>
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400">{sim.sovereignScope}</td>
                        <td className="py-2.5 px-3 text-slate-300">{sim.apn}</td>
                        <td className="py-2.5 px-3 text-slate-300">{sim.lastTac}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={
                              sim.pduState === 'ACTIVE'
                                ? 'text-emerald-400 font-semibold'
                                : sim.pduState === 'THROTTLED_64KBPS'
                                ? 'text-amber-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {sim.pduState}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: LIVE WORKSPACE REPOSITORY & ZIP EXPORT */}
          {activeTab === 'scaffold' && <WorkspaceRepoViewer />}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <span>
            TxImhotep LLC · securebase-mvno Workspace · Target Core: free5GC R17+ / eBPF UPF
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="/assets/aistudio/USPTO_Provisional_Patent_Application___TxImhotep_LLC-1_43ee34cf.pdf"
              download="USPTO_Provisional_Patent_Application_TxImhotep_LLC.pdf"
              className="px-3 py-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>USPTO Patent Spec (PDF)</span>
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Close Specification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
