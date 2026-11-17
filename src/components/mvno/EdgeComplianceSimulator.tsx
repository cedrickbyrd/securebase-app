import React, { useState, useMemo } from 'react';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  HardDriveDownload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Lock
} from 'lucide-react';
import {
  EdgeEndpointRecord,
  EdgeWormBufferedRecord,
  attestEdgeEndpointViaApi,
  toggleEdgeBackhaulViaApi,
  bufferOfflineEdgeEventViaApi,
  syncEdgeBufferViaApi
} from '../../services/mvnoApiService';
import { FIRE_TELEMETRY_EVENT } from '../../services/telemetryService';

interface EdgeComplianceSimulatorProps {
  edgeEndpoints: EdgeEndpointRecord[];
  edgeWormBuffer: EdgeWormBufferedRecord[];
  onSandboxSynced: () => Promise<void> | void;
}

export const EdgeComplianceSimulator: React.FC<EdgeComplianceSimulatorProps> = ({
  edgeEndpoints,
  edgeWormBuffer,
  onSandboxSynced
}) => {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(
    edgeEndpoints[0]?.id || 'edge-atm-cnb-ffiec'
  );
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [lastOutcome, setLastOutcome] = useState<{
    compliant: boolean;
    regoRule: string;
    summary: string;
    timestampUtc: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeEndpoint = useMemo(
    () => edgeEndpoints.find((e) => e.id === selectedEndpointId) || edgeEndpoints[0],
    [edgeEndpoints, selectedEndpointId]
  );

  const pendingForEndpoint = useMemo(
    () => edgeWormBuffer.filter((b) => b.endpointId === activeEndpoint?.id),
    [edgeWormBuffer, activeEndpoint?.id]
  );

  if (!activeEndpoint) {
    return (
      <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
        Loading edge hardware attestation profiles...
      </div>
    );
  }

  const pcr0Matches = activeEndpoint.reportedPcr0 === activeEndpoint.expectedPcr0;
  const pcr7Matches = activeEndpoint.reportedPcr7 === activeEndpoint.expectedPcr7;
  const isQuarantined = activeEndpoint.xdpAction === 'XDP_DROP';

  const runAttestation = async (mode: 'verify' | 'drift-pcr' | 'drift-iotsafe' | 'restore') => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const [res] = await Promise.all([
        attestEdgeEndpointViaApi(activeEndpoint.id, mode),
        FIRE_TELEMETRY_EVENT({
          eventType: mode === 'drift-pcr' || mode === 'drift-iotsafe' ? 'VIOLATION_BLOCKED' : 'SCAN_COMPLETED',
          repository: 'cedrickbyrd/securebase-mvno',
          commitSha: mode,
          branch: activeEndpoint.perimeter,
          targetPlatform: 'Multi-Cloud',
          frameworks: ['FFIEC', 'HIPAA', 'NIST_800_53'],
          findingsCount: mode === 'drift-pcr' || mode === 'drift-iotsafe' ? 1 : 0,
          criticalCount: mode === 'drift-pcr' || mode === 'drift-iotsafe' ? 1 : 0
        })
      ]);

      setLastOutcome({
        compliant: res.compliant,
        regoRule: res.regoRule,
        summary: res.summary,
        timestampUtc: res.endpoint.lastAttestedUtc
      });
      await onSandboxSynced();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Edge attestation failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleBackhaul = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      await toggleEdgeBackhaulViaApi(activeEndpoint.id);
      await onSandboxSynced();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to toggle backhaul state');
    } finally {
      setIsBusy(false);
    }
  };

  const handleBufferOfflineEvent = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const res = await bufferOfflineEdgeEventViaApi(
        activeEndpoint.id,
        `OFFLINE_PCR_ATTESTATION (${activeEndpoint.mecEnclaveId})`
      );
      setLastOutcome({
        compliant: true,
        regoRule: 'mec.worm.local_spool_append',
        summary: `Backhaul offline: sealed ${res.bufferedRecord.recordId} locally in MEC WORM ring buffer (PENDING_SYNC).`,
        timestampUtc: res.bufferedRecord.capturedAtUtc
      });
      await onSandboxSynced();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to buffer offline edge WORM event');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncEdgeBuffer = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const res = await syncEdgeBufferViaApi(activeEndpoint.id);
      setLastOutcome({
        compliant: res.chainVerification.valid,
        regoRule: 'mec.worm.merkle_reconcile',
        summary: `Reconciled ${res.syncedCount} buffered edge record(s) into regional 7-year WORM ledger. ${res.chainVerification.summary}`,
        timestampUtc: new Date().toISOString()
      });
      await onSandboxSynced();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reconcile edge WORM buffer');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Profile Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">
            Compliance to the Edge: TPM 2.0 / GSMA IoT SAFE + eBPF XDP + MEC UL CL
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Enforces policy-before-packet kernel quarantine and offline-resilient SHA-256 Merkle WORM attestation at regulated branch and clinical endpoints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono shrink-0">
          {edgeEndpoints.map((ep) => {
            const isSelected = ep.id === activeEndpoint.id;
            return (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpointId(ep.id)}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ep.profileType === 'BRANCH_ATM_FFIEC'
                  ? 'Branch ATM Router (FFIEC)'
                  : 'Clinical Telemetry (HIPAA)'}
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* End-to-End Edge-to-Cloud Enforcement Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="text-slate-400 flex items-center justify-between">
            <span>1. Edge Silicon RoT</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className={`font-bold ${pcr0Matches && pcr7Matches && activeEndpoint.iotSafeValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pcr0Matches && pcr7Matches && activeEndpoint.iotSafeValid ? 'ATTESTED (PCR + IoT SAFE)' : 'HARDWARE DRIFT DETECTED'}
          </div>
          <div className="text-[11px] text-slate-400 truncate">{activeEndpoint.iotSafeCertThumbprint}</div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="text-slate-400 flex items-center justify-between">
            <span>2. Kernel eBPF XDP Hook</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className={`font-bold ${isQuarantined ? 'text-rose-400' : 'text-emerald-400'}`}>
            {activeEndpoint.xdpAction} ({activeEndpoint.privateIp})
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            Pass: {activeEndpoint.passedPackets.toLocaleString()} · Drop: {activeEndpoint.droppedPackets.toLocaleString()}
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="text-slate-400 flex items-center justify-between">
            <span>3. 5G SA UPF UL CL (MEC)</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className={`font-bold ${isQuarantined ? 'text-rose-400' : 'text-cyan-300'}`}>
            {activeEndpoint.ulclState}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {activeEndpoint.mecEnclaveId} · N6 Blocked
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="text-slate-400 flex items-center justify-between">
            <span>4. Backhaul &amp; WORM Spool</span>
            {activeEndpoint.backhaulOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
          <div className={`font-bold ${activeEndpoint.backhaulOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {activeEndpoint.backhaulOnline ? 'BACKHAUL ONLINE (DIRECT WORM)' : 'OFFLINE: LOCAL MEC SPOOL'}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            Pending Buffer: {pendingForEndpoint.length} record(s)
          </div>
        </div>
      </div>

      {/* Action Control Strip */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAttestation('verify')}
            disabled={isBusy}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Edge Attestation</span>
          </button>

          <button
            onClick={() => runAttestation('drift-pcr')}
            disabled={isBusy}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Inject TPM PCR7 Drift (XDP_DROP)</span>
          </button>

          <button
            onClick={() => runAttestation('drift-iotsafe')}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-mono text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/60 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Invalidate IoT SAFE Sig</span>
          </button>

          <button
            onClick={() => runAttestation('restore')}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-mono text-slate-200 hover:text-white bg-slate-900 border border-slate-800 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Clean Firmware</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleBackhaul}
            disabled={isBusy}
            className="px-3 py-2 text-xs font-mono text-slate-200 hover:text-white bg-slate-900 border border-slate-800 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {activeEndpoint.backhaulOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate WAN Outage</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restore WAN Link</span>
              </>
            )}
          </button>

          {!activeEndpoint.backhaulOnline && (
            <button
              onClick={handleBufferOfflineEvent}
              disabled={isBusy}
              className="px-3 py-2 text-xs font-mono text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/60 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Buffer Offline Event</span>
            </button>
          )}

          {pendingForEndpoint.length > 0 && (
            <button
              onClick={handleSyncEdgeBuffer}
              disabled={isBusy}
              className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Edge Buffer to Cloud WORM ({pendingForEndpoint.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Outcome Banner */}
      {lastOutcome && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            lastOutcome.compliant
              ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-700/70 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {lastOutcome.compliant ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">{lastOutcome.regoRule}</div>
              <div className="text-slate-200 font-sans mt-0.5">{lastOutcome.summary}</div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
            {lastOutcome.timestampUtc}
          </span>
        </div>
      )}

      {/* Hardware Attestation Detail & Disconnected Edge Spool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: TPM 2.0 & GSMA IoT SAFE Measurement Ledger */}
        <div className="lg:col-span-6 p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="text-xs font-mono text-cyan-400">{activeEndpoint.framework}</div>
              <h4 className="text-sm font-bold text-white mt-0.5">{activeEndpoint.name}</h4>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">IMSI: {activeEndpoint.imsi}</span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>TPM 2.0 PCR0 (UEFI / Bootloader)</span>
                <span className={pcr0Matches ? 'text-emerald-400' : 'text-rose-400'}>
                  {pcr0Matches ? 'MATCH' : 'MISMATCH'}
                </span>
              </div>
              <div className="text-slate-300 break-all bg-slate-900/70 px-3 py-2 rounded-lg border border-slate-800/80 tabular-nums">
                {activeEndpoint.reportedPcr0}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>TPM 2.0 PCR7 (Secure Boot / Kernel Policy)</span>
                <span className={pcr7Matches ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {pcr7Matches ? 'MATCH' : 'DRIFT DETECTED'}
                </span>
              </div>
              <div
                className={`break-all px-3 py-2 rounded-lg border tabular-nums ${
                  pcr7Matches
                    ? 'text-slate-300 bg-slate-900/70 border-slate-800/80'
                    : 'text-rose-300 bg-rose-950/30 border-rose-800/70'
                }`}
              >
                {activeEndpoint.reportedPcr7}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <span className="text-slate-400 block mb-0.5">GSMA IoT SAFE Applet</span>
                <span className={activeEndpoint.iotSafeValid ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {activeEndpoint.iotSafeValid ? 'VALID SIGNATURE' : 'REVOKED / INVALID'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Private APN Namespace</span>
                <span className="text-cyan-300 truncate block">{activeEndpoint.apn}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Disconnected Edge WORM Merkle Spool */}
        <div className="lg:col-span-6 border border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-950">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Local MEC Disconnected WORM Spool ({pendingForEndpoint.length})</span>
            </span>
            <span className="text-slate-400">Reconciles to 7-yr WORM on WAN restore</span>
          </div>

          {pendingForEndpoint.length === 0 ? (
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-2 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div className="text-slate-200 font-semibold">Edge WORM Buffer Clean (0 Pending)</div>
              <p className="text-slate-400 max-w-sm">
                All local attestation receipts are synchronized into the primary regional WORM vault. Click &quot;Simulate WAN Outage&quot; to test disconnected edge Merkle buffering.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3">Record</th>
                    <th className="py-2.5 px-3">Event Reason</th>
                    <th className="py-2.5 px-3">Local Merkle Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {pendingForEndpoint.map((rec) => (
                    <tr key={rec.recordId}>
                      <td className="py-2.5 px-3">
                        <div className="text-amber-300 font-semibold">{rec.recordId}</div>
                        <div className="text-[10px] text-slate-400">{rec.syncStatus}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{rec.eventReason}</td>
                      <td className="py-2.5 px-3 text-cyan-300">
                        <div>{rec.hmacSha256.substring(0, 20)}...</div>
                        <div className="text-[10px] text-slate-500">prev: {rec.prevHash.substring(0, 12)}...</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
