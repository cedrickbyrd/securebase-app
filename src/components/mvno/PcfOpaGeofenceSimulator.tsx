import React, { useState, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  MapPin,
  Lock,
  AlertCircle
} from 'lucide-react';
import {
  MVNO_GEOFENCE_EVENTS,
  SovereignPerimeter,
  SovereignScopeId,
  GeofenceSimEvent
} from '../../data/mvnoData';
import { FIRE_TELEMETRY_EVENT } from '../../services/telemetryService';
import {
  evaluateGeofenceViaApi,
  QuarantineAuditLog
} from '../../services/mvnoApiService';

interface PcfOpaGeofenceSimulatorProps {
  activePerimeter: SovereignPerimeter;
  onSelectPerimeter: (id: SovereignScopeId) => void;
  quarantineLogs: QuarantineAuditLog[];
  onSandboxSynced: () => Promise<void> | void;
}

interface LatencyBreakdown {
  n7HookMs: number;
  opaEvalMs: number;
  smfActionMs: number;
  totalMs: number;
}

interface SimExecutionResult {
  mode: 'nominal' | 'policy-drift' | 'throttle';
  event: GeofenceSimEvent;
  latency: LatencyBreakdown;
  teid: string;
  pduState: 'ACTIVE' | 'THROTTLED_64KBPS' | 'RELEASED_QUARANTINED';
  evaluatedAt: string;
  telemetryId: string;
  runtimeEngine: string;
  wormRecordId: string;
}

export const PcfOpaGeofenceSimulator: React.FC<PcfOpaGeofenceSimulatorProps> = ({
  activePerimeter,
  onSelectPerimeter,
  quarantineLogs,
  onSandboxSynced
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(MVNO_GEOFENCE_EVENTS[0].id);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [activeTacIndex, setActiveTacIndex] = useState<number>(0);
  const [simResult, setSimResult] = useState<SimExecutionResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => MVNO_GEOFENCE_EVENTS.find((e) => e.id === selectedEventId) || MVNO_GEOFENCE_EVENTS[0],
    [selectedEventId]
  );

  const isDriftState = simResult?.mode === 'policy-drift';
  const isThrottledState = simResult?.mode === 'throttle';

  const towerPositions = useMemo(() => {
    const slots = [
      { x: 145, y: 110 },
      { x: 265, y: 195 },
      { x: 350, y: 105 }
    ];
    return activePerimeter.allowedTacs.map((tac, idx) => ({
      tac,
      x: slots[idx % slots.length].x,
      y: slots[idx % slots.length].y
    }));
  }, [activePerimeter.allowedTacs]);

  const currentOriginTower = towerPositions[activeTacIndex % towerPositions.length] || towerPositions[0];
  const externalBreachNode = {
    x: 605,
    y: 148,
    tac: 'TAC-0x9F88 (Unverified-Border)'
  };

  const executeSimulation = async (evt: GeofenceSimEvent, forcedDrift = false) => {
    setIsEvaluating(true);
    setApiError(null);
    onSelectPerimeter(evt.perimeter);

    try {
      const [apiRes, telemetry] = await Promise.all([
        evaluateGeofenceViaApi({
          perimeter: evt.perimeter,
          eventType: evt.eventType,
          imsiHash: evt.imsiHash,
          imeiSv: evt.imeiSv,
          sourceTac: evt.sourceTac,
          targetTac: evt.targetTac,
          apn: evt.apn,
          forcedDrift
        }),
        FIRE_TELEMETRY_EVENT({
          eventType: forcedDrift || evt.expectedDecision !== 'ALLOW' ? 'VIOLATION_BLOCKED' : 'SCAN_COMPLETED',
          repository: 'cedrickbyrd/securebase-mvno',
          commitSha: forcedDrift ? 'policy-drift-n15' : 'free5gc-r17',
          branch: evt.perimeter,
          targetPlatform: 'Multi-Cloud',
          frameworks: ['FFIEC', 'HIPAA', 'DORA', 'MAS_TRM'],
          findingsCount: forcedDrift || evt.expectedDecision !== 'ALLOW' ? 1 : 0,
          criticalCount: forcedDrift || evt.expectedDecision === 'SMF_PDU_SESSION_RELEASE' ? 1 : 0
        })
      ]);

      const mode: SimExecutionResult['mode'] =
        apiRes.decision === 'SMF_PDU_SESSION_RELEASE'
          ? 'policy-drift'
          : apiRes.decision === 'PCF_QOS_THROTTLE'
          ? 'throttle'
          : 'nominal';

      setSimResult({
        mode,
        event: {
          ...evt,
          expectedDecision: apiRes.decision,
          regoRuleTriggered: apiRes.regoRule,
          rationale: apiRes.rationale,
          actionTaken: apiRes.actionTaken
        },
        latency: apiRes.latency,
        teid: apiRes.teid,
        pduState: apiRes.pduState,
        evaluatedAt: apiRes.evaluatedAt,
        telemetryId: telemetry.eventId,
        runtimeEngine: apiRes.runtimeEngine,
        wormRecordId: apiRes.wormRecord.recordId
      });

      await onSandboxSynced();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'CoreLink API evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleInjectPolicyDrift = () => {
    const driftEvent: GeofenceSimEvent = {
      id: 'evt-injected-policy-drift',
      label: `Policy-Drift Injected: ${activePerimeter.label} Border Breach (N15)`,
      perimeter: activePerimeter.id,
      eventType: 'N15_TOWER_HANDOVER',
      imsiHash: '9f84c2e10a44b912e301d8f9c2a17701',
      imeiSv: '356938035643809',
      sourceTac: currentOriginTower.tac,
      targetTac: 'TAC-0x9F88 (Unverified-External-Border)',
      apn: activePerimeter.apnDomain,
      expectedDecision: 'SMF_PDU_SESSION_RELEASE',
      evalLatencyMs: 11.4,
      regoRuleTriggered: 'mvno.geofence.deny_policy_drift_tac',
      rationale: `Injected 'policy-drift' handover moved UE from ${currentOriginTower.tac} outside ${activePerimeter.label} geofence into unverified TAC-0x9F88.`,
      actionTaken: 'PCF issued N7/N15 abort -> SMF executed PFCP Session Deletion (PDU Session Release) & revoked GTP-U TEID 0x004A9F12.'
    };
    setSelectedEventId('evt-us-breach');
    executeSimulation(driftEvent, true);
  };

  const handleReset = () => {
    setSimResult(null);
    setApiError(null);
    setActiveTacIndex(0);
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">
            PCF-to-OPA 15 ms Geofence Trigger &amp; TAC Boundary Map
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Intercepts 3GPP N7/N15 handovers inside {activePerimeter.label}, evaluates Tracking Area Code (TAC) geofences via CoreLink/OPA API in &lt; 15 ms, and persists WORM CDR blocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-mono text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>

          <button
            onClick={() => executeSimulation(selectedEvent, false)}
            disabled={isEvaluating}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isEvaluating ? 'Evaluating...' : 'Simulate Selected Event'}</span>
          </button>

          <button
            onClick={handleInjectPolicyDrift}
            disabled={isEvaluating}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Inject &apos;policy-drift&apos; Event</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Interactive TAC Geofence Map Visualization */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-200">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>TAC Boundary Map: {activePerimeter.label} ({activePerimeter.regions})</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="text-cyan-300">PDU State: {simResult ? simResult.pduState : 'ACTIVE (STANDBY)'}</span>
            <span className={isDriftState ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
              {isDriftState ? 'BREACH: SMF RELEASED' : 'GEOFENCE NOMINAL'}
            </span>
          </div>
        </div>

        <div className="p-4">
          <svg
            viewBox="0 0 720 280"
            className="w-full h-auto rounded-lg bg-slate-900/70 border border-slate-800/80"
            role="img"
            aria-label="TAC Geofence Boundary Map Visualization"
          >
            <defs>
              <pattern id="tacGrid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(51,65,85,0.28)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="720" height="280" fill="url(#tacGrid)" />

            <polygon
              points="45,35 425,28 455,142 415,248 52,242"
              fill={isDriftState ? 'rgba(6,182,212,0.04)' : 'rgba(6,182,212,0.08)'}
              stroke="#06b6d4"
              strokeWidth="1.75"
              strokeDasharray="6 4"
            />
            <text x="62" y="54" fill="#22d3ee" fontSize="11" fontFamily="monospace" fontWeight="bold">
              AUTHORIZED GEOFENCE ({activePerimeter.label.toUpperCase()})
            </text>
            <text x="62" y="69" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              CMEK + Private APN: {activePerimeter.apnDomain}
            </text>

            <rect
              x="490"
              y="34"
              width="205"
              height="212"
              rx="10"
              fill={isDriftState ? 'rgba(225,29,72,0.12)' : 'rgba(225,29,72,0.04)'}
              stroke={isDriftState ? '#f43f5e' : 'rgba(244,63,94,0.45)'}
              strokeWidth={isDriftState ? '2' : '1.25'}
              strokeDasharray="4 4"
            />
            <text x="506" y="54" fill="#fb7185" fontSize="11" fontFamily="monospace" fontWeight="bold">
              UNVERIFIED EXTERNAL ZONE
            </text>
            <text x="506" y="69" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              Denied by mvno_geofence_tac.rego
            </text>

            <rect x="74" y="182" width="142" height="44" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
            <text x="84" y="201" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">
              eBPF UPF / N6 BREAKOUT
            </text>
            <text x="84" y="216" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">
              100.64.12.44 -&gt; PSC/TGW
            </text>

            <line
              x1={currentOriginTower.x}
              y1={currentOriginTower.y}
              x2="145"
              y2="182"
              stroke={isDriftState ? '#475569' : '#10b981'}
              strokeWidth="2"
              strokeDasharray={isDriftState ? '4 4' : undefined}
            />

            {towerPositions.map((tower, idx) => {
              const isOrigin = idx === activeTacIndex;
              return (
                <g
                  key={tower.tac}
                  onClick={() => setActiveTacIndex(idx)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={tower.x}
                    cy={tower.y}
                    r={isOrigin ? 24 : 18}
                    fill={isOrigin ? 'rgba(6,182,212,0.16)' : 'rgba(15,23,42,0.7)'}
                    stroke={isOrigin ? '#22d3ee' : '#334155'}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={tower.x}
                    cy={tower.y}
                    r="5"
                    fill={isOrigin ? '#22d3ee' : '#64748b'}
                  />
                  <text
                    x={tower.x}
                    y={tower.y - 26}
                    textAnchor="middle"
                    fill={isOrigin ? '#e2e8f0' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {tower.tac}
                  </text>
                </g>
              );
            })}

            <circle
              cx={externalBreachNode.x}
              cy={externalBreachNode.y}
              r={isDriftState ? 28 : 20}
              fill={isDriftState ? 'rgba(244,63,94,0.2)' : 'rgba(15,23,42,0.75)'}
              stroke={isDriftState ? '#f43f5e' : '#881337'}
              strokeWidth="1.75"
            />
            <circle cx={externalBreachNode.x} cy={externalBreachNode.y} r="6" fill="#f43f5e" />
            <text
              x={externalBreachNode.x}
              y={externalBreachNode.y + 38}
              textAnchor="middle"
              fill="#fda4af"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {externalBreachNode.tac}
            </text>

            {isDriftState && (
              <g>
                <line
                  x1={currentOriginTower.x}
                  y1={currentOriginTower.y}
                  x2={externalBreachNode.x}
                  y2={externalBreachNode.y}
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />
                <circle cx="455" cy="142" r="8" fill="#f43f5e" stroke="#0f172a" strokeWidth="2" />
                <text x="455" y="126" textAnchor="middle" fill="#fda4af" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  N15 CROSSING DETECTED
                </text>
                <rect x="526" y="88" width="158" height="32" rx="6" fill="#4c0519" stroke="#f43f5e" strokeWidth="1.25" />
                <text x="605" y="102" textAnchor="middle" fill="#fecdd3" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                  SMF SESSION RELEASED
                </text>
                <text x="605" y="114" textAnchor="middle" fill="#fda4af" fontSize="9" fontFamily="monospace">
                  TEID 0x004A9F12 REVOKED
                </text>
              </g>
            )}

            {!isDriftState && (
              <g>
                <rect
                  x={currentOriginTower.x - 62}
                  y={currentOriginTower.y + 24}
                  width="124"
                  height="28"
                  rx="5"
                  fill="#0f172a"
                  stroke={isThrottledState ? '#f59e0b' : '#22d3ee'}
                  strokeWidth="1.25"
                />
                <text
                  x={currentOriginTower.x}
                  y={currentOriginTower.y + 37}
                  textAnchor="middle"
                  fill={isThrottledState ? '#fbbf24' : '#e2e8f0'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {isThrottledState ? 'UE THROTTLED (64 kbps)' : 'UE ATTACHED (NOMINAL)'}
                </text>
                <text
                  x={currentOriginTower.x}
                  y={currentOriginTower.y + 47}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  TEID 0x004A9F12
                </text>
              </g>
            )}
          </svg>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span>Tip: Click any authorized TAC tower inside the boundary to change origin sector, or inject &apos;policy-drift&apos; to simulate N15 border breach.</span>
            <span>Origin Sector: {currentOriginTower.tac}</span>
          </div>
        </div>
      </div>

      {/* 15ms PCF-to-OPA Execution Timeline & Event Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2.5">
          <div className="text-xs font-mono text-slate-400 mb-1">
            Preset 3GPP N7/N15 &amp; CoreLink Events
          </div>
          {MVNO_GEOFENCE_EVENTS.map((evt) => {
            const isSelected = evt.id === selectedEventId && simResult?.mode !== 'policy-drift';
            return (
              <button
                key={evt.id}
                onClick={() => setSelectedEventId(evt.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/80 border-cyan-500/60'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-cyan-400">{evt.perimeter}</span>
                  <span
                    className={
                      evt.expectedDecision === 'ALLOW'
                        ? 'text-emerald-400'
                        : evt.expectedDecision === 'PCF_QOS_THROTTLE'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }
                  >
                    {evt.expectedDecision}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white mt-1">{evt.label}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                  {evt.sourceTac} -&gt; {evt.targetTac}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7 p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-mono text-slate-400">Active Policy Evaluation Target</span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {simResult ? simResult.event.label : selectedEvent.label}
              </h4>
            </div>
            <span className="text-xs font-mono text-cyan-300 tabular-nums">
              SLA Ceiling: 15.0 ms
            </span>
          </div>

          {!simResult ? (
            <div className="p-6 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
              <Radio className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                Awaiting 3GPP N7/N15 Trigger
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click &quot;Inject &apos;policy-drift&apos; Event&quot; to call the CoreLink API bridge, execute an automated SMF PDU Session Release in under 15 ms, and append a WORM CDR record.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {simResult.pduState === 'ACTIVE' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : simResult.pduState === 'THROTTLED_64KBPS' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span
                    className={`text-sm font-mono font-bold ${
                      simResult.pduState === 'ACTIVE'
                        ? 'text-emerald-400'
                        : simResult.pduState === 'THROTTLED_64KBPS'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {simResult.event.expectedDecision} · PDU {simResult.pduState}
                  </span>
                </div>

                <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold">
                  Total: {simResult.latency.totalMs} ms (&lt; 15.0 ms SLA)
                </span>
              </div>

              <div className="space-y-2">
                <div className="h-2.5 w-full bg-slate-900 border border-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(simResult.latency.n7HookMs / 15) * 100}%` }}
                    className="bg-cyan-400 h-full"
                    title={`PCF N7/N15 Intercept: ${simResult.latency.n7HookMs} ms`}
                  />
                  <div
                    style={{ width: `${(simResult.latency.opaEvalMs / 15) * 100}%` }}
                    className="bg-blue-500 h-full"
                    title={`OPA Rego Eval: ${simResult.latency.opaEvalMs} ms`}
                  />
                  <div
                    style={{ width: `${(simResult.latency.smfActionMs / 15) * 100}%` }}
                    className={isDriftState ? 'bg-rose-500 h-full' : 'bg-emerald-400 h-full'}
                    title={`SMF PFCP Action: ${simResult.latency.smfActionMs} ms`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-slate-300">
                  <div>1. N7/N15 Hook: {simResult.latency.n7HookMs} ms</div>
                  <div>2. OPA Rego Eval: {simResult.latency.opaEvalMs} ms</div>
                  <div className="text-right">3. SMF Action: {simResult.latency.smfActionMs} ms</div>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-xs">
                <div className="font-mono text-cyan-300">
                  Rego Rule: {simResult.event.regoRuleTriggered} · Engine: {simResult.runtimeEngine}
                </div>
                <p className="text-slate-300">{simResult.event.rationale}</p>
                <div className="pt-2 border-t border-slate-800 font-mono text-white">
                  {simResult.event.actionTaken}
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  WORM Persisted ({simResult.wormRecordId} · {simResult.telemetryId})
                </span>
                <span className="tabular-nums">{simResult.evaluatedAt}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Persisted Quarantine & Evaluation Audit Log */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-200 font-semibold">
            Persisted CoreLink Quarantine &amp; Evaluation Log ({quarantineLogs.length})
          </span>
          <span className="text-slate-400">Stored server-side in sandbox datastore</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Perimeter</th>
                <th className="py-2.5 px-3">Target TAC</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3">WORM Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40 tabular-nums">
              {quarantineLogs.slice(0, 6).map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-3 text-slate-300">{log.timestampUtc.replace('T', ' ').slice(0, 19)}</td>
                  <td className="py-2.5 px-3 text-cyan-400">{log.perimeter}</td>
                  <td className="py-2.5 px-3 text-slate-300">{log.targetTac}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={
                        log.decision === 'ALLOW'
                          ? 'text-emerald-400 font-semibold'
                          : log.decision === 'PCF_QOS_THROTTLE'
                          ? 'text-amber-400 font-semibold'
                          : 'text-rose-400 font-semibold'
                      }
                    >
                      {log.decision}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">{log.totalLatencyMs} ms</td>
                  <td className="py-2.5 px-3 text-cyan-300">{log.wormRecordId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
