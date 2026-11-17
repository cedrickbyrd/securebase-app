import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

export type SovereignScopeId = 'securebase-us' | 'securebase-euro' | 'securebase-asia';

export interface PersistedSimRecord {
  imsi: string;
  imsiHash: string;
  eid: string;
  imeiSv: string;
  apn: string;
  tenantId: string;
  assignedVrf: string;
  sovereignScope: SovereignScopeId;
  pduState: 'ACTIVE' | 'THROTTLED_64KBPS' | 'RELEASED_QUARANTINED';
  lastTac: string;
  updatedAtUtc: string;
}

export interface PersistedWormCdrRecord {
  seq: number;
  recordId: string;
  perimeter: SovereignScopeId;
  imsiHash: string;
  tac: string;
  tunnelStartUtc: string;
  tunnelEndUtc: string;
  uplinkBytes: number;
  downlinkBytes: number;
  verdict: 'COMPLIANT' | 'QUARANTINED';
  prevHash: string;
  hmacSha256: string;
  tampered?: boolean;
}

export interface QuarantineAuditLog {
  id: string;
  timestampUtc: string;
  perimeter: SovereignScopeId;
  eventType: string;
  imsiHash: string;
  sourceTac: string;
  targetTac: string;
  decision: 'ALLOW' | 'PCF_QOS_THROTTLE' | 'SMF_PDU_SESSION_RELEASE';
  regoRule: string;
  totalLatencyMs: number;
  n7HookMs: number;
  opaEvalMs: number;
  smfActionMs: number;
  teid: string;
  wormRecordId: string;
  runtimeEngine: 'go-corelink+express-bridge' | 'express-corelink-bridge';
}

export interface EdgeEndpointRecord {
  id: string;
  name: string;
  profileType: 'BRANCH_ATM_FFIEC' | 'CLINICAL_TELEMETRY_HIPAA';
  framework: string;
  perimeter: SovereignScopeId;
  imsi: string;
  iccid: string;
  privateIp: string;
  apn: string;
  mecEnclaveId: string;
  backhaulOnline: boolean;
  xdpAction: 'XDP_PASS' | 'XDP_DROP';
  ulclState: 'MEC_LOCAL_STEER' | 'PFCP_FAR_DROP';
  expectedPcr0: string;
  expectedPcr7: string;
  reportedPcr0: string;
  reportedPcr7: string;
  iotSafeValid: boolean;
  iotSafeCertThumbprint: string;
  passedPackets: number;
  droppedPackets: number;
  lastAttestedUtc: string;
}

export interface EdgeWormBufferedRecord {
  seq: number;
  recordId: string;
  endpointId: string;
  perimeter: SovereignScopeId;
  eventReason: string;
  prevHash: string;
  hmacSha256: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCED_TO_WORM';
  capturedAtUtc: string;
}

export interface MvnoSandboxState {
  sims: PersistedSimRecord[];
  wormChain: PersistedWormCdrRecord[];
  quarantineLogs: QuarantineAuditLog[];
  edgeEndpoints: EdgeEndpointRecord[];
  edgeWormBuffer: EdgeWormBufferedRecord[];
  lastUpdatedUtc: string;
}

export interface TerraformDiffItem {
  id: string;
  resourceAddress: string;
  resourceType: string;
  perimeter: SovereignScopeId;
  action: 'create' | 'update' | 'destroy';
  phaseContext: string;
  regoPolicy: string;
  regoStatus: 'PASS';
  summary: string;
  hclDiff: string[];
}

export interface WorkspaceRepoFile {
  path: string;
  name: string;
  category: 'workflow' | 'docs' | 'terraform' | 'core' | 'service' | 'rego' | 'script' | 'schema';
  language: 'rego' | 'hcl' | 'yaml' | 'typescript' | 'go' | 'json' | 'bash' | 'python' | 'markdown' | 'c' | 'text';
  sizeBytes: number;
  summary: string;
  code: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'mvno-sandbox.json');
const REPO_ROOT = path.resolve(process.cwd(), 'securebase-mvno');

const ALLOWED_TACS: Record<SovereignScopeId, Set<string>> = {
  'securebase-us': new Set(['TAC-0x1A2B', 'TAC-0x1A2C', 'TAC-0x4E10']),
  'securebase-euro': new Set(['TAC-0x2F01', 'TAC-0x2F09']),
  'securebase-asia': new Set(['TAC-0x3C11', 'TAC-0x3C44'])
};

let writeQueue: Promise<unknown> = Promise.resolve();

function serializeCdrForHash(rec: Omit<PersistedWormCdrRecord, 'hmacSha256' | 'tampered'>): string {
  return [
    rec.seq,
    rec.recordId,
    rec.perimeter,
    rec.imsiHash,
    rec.tac,
    rec.tunnelStartUtc,
    rec.tunnelEndUtc,
    rec.uplinkBytes,
    rec.downlinkBytes,
    rec.verdict,
    rec.prevHash
  ].join('|');
}

export function computeSha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function buildInitialState(): MvnoSandboxState {
  const now = '2026-11-14T08:30:00.000Z';
  const seedCdrs: Omit<PersistedWormCdrRecord, 'hmacSha256'>[] = [
    {
      seq: 1,
      recordId: 'cdr-us-000101',
      perimeter: 'securebase-us',
      imsiHash: '9f84c2e10a44b912e301d8f9c2a17701',
      tac: 'TAC-0x1A2B (Dallas-FW)',
      tunnelStartUtc: '2026-11-13T09:00:00.120Z',
      tunnelEndUtc: '2026-11-13T09:15:00.120Z',
      uplinkBytes: 412890,
      downlinkBytes: 1284500,
      verdict: 'COMPLIANT',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
    },
    {
      seq: 2,
      recordId: 'cdr-us-000102',
      perimeter: 'securebase-us',
      imsiHash: '4d19a08c99b1e74501aa2c77190fe3b2',
      tac: 'TAC-0x9F88 (Unverified-Border)',
      tunnelStartUtc: '2026-11-13T09:16:04.405Z',
      tunnelEndUtc: '2026-11-13T09:16:04.416Z',
      uplinkBytes: 1280,
      downlinkBytes: 0,
      verdict: 'QUARANTINED',
      prevHash: ''
    },
    {
      seq: 3,
      recordId: 'cdr-euro-000103',
      perimeter: 'securebase-euro',
      imsiHash: '7b21e880f102aa94c7120e4490d8ab11',
      tac: 'TAC-0x2F01 (Frankfurt-Main)',
      tunnelStartUtc: '2026-11-13T09:20:11.000Z',
      tunnelEndUtc: '2026-11-13T09:35:11.000Z',
      uplinkBytes: 892100,
      downlinkBytes: 2450110,
      verdict: 'COMPLIANT',
      prevHash: ''
    }
  ];

  const wormChain: PersistedWormCdrRecord[] = [];
  for (let i = 0; i < seedCdrs.length; i++) {
    const base = seedCdrs[i];
    const prevHash = i === 0 ? base.prevHash : wormChain[i - 1].hmacSha256;
    const entry = { ...base, prevHash };
    wormChain.push({
      ...entry,
      hmacSha256: computeSha256Hex(serializeCdrForHash(entry)),
      tampered: false
    });
  }

  const sims: PersistedSimRecord[] = [
    {
      imsi: '310260000000001',
      imsiHash: '9f84c2e10a44b912e301d8f9c2a17701',
      eid: '89049032000000000000000000000001',
      imeiSv: '356938035643809',
      apn: 'apn.cnb-waxahachie.us.securebase.internal',
      tenantId: 'pilot-citizens-national-bank-ffiec-2026',
      assignedVrf: 'vrf-pilot-citizens-national-bank-ffiec-2026',
      sovereignScope: 'securebase-us',
      pduState: 'ACTIVE',
      lastTac: 'TAC-0x1A2C (Waxahachie-TX)',
      updatedAtUtc: now
    },
    {
      imsi: '262010000000042',
      imsiHash: '7b21e880f102aa94c7120e4490d8ab11',
      eid: '89049032000000000000000000000042',
      imeiSv: '35449210883104-01',
      apn: 'apn.eurobank-de.euro.securebase.internal',
      tenantId: 'eurobank-frankfurt-dora-2026',
      assignedVrf: 'vrf-eurobank-frankfurt-dora-2026',
      sovereignScope: 'securebase-euro',
      pduState: 'ACTIVE',
      lastTac: 'TAC-0x2F01 (Frankfurt-Main)',
      updatedAtUtc: now
    },
    {
      imsi: '525010000000088',
      imsiHash: '2c90ff1288a1c3041099bb71d0e888b3',
      eid: '89049032000000000000000000000088',
      imeiSv: '35449210883104-02',
      apn: 'apn.sg-treasury.asia.securebase.internal',
      tenantId: 'sg-treasury-mas-trm-2026',
      assignedVrf: 'vrf-sg-treasury-mas-trm-2026',
      sovereignScope: 'securebase-asia',
      pduState: 'ACTIVE',
      lastTac: 'TAC-0x3C11 (Singapore-CBD)',
      updatedAtUtc: now
    }
  ];

  const quarantineLogs: QuarantineAuditLog[] = [
    {
      id: 'qlog-seed-001',
      timestampUtc: '2026-11-13T09:16:04.416Z',
      perimeter: 'securebase-us',
      eventType: 'N15_TOWER_HANDOVER',
      imsiHash: '4d19a08c99b1e74501aa2c77190fe3b2',
      sourceTac: 'TAC-0x1A2B (Dallas-FW)',
      targetTac: 'TAC-0x9F88 (Unverified-Border)',
      decision: 'SMF_PDU_SESSION_RELEASE',
      regoRule: 'mvno.geofence.deny_unapproved_tac',
      totalLatencyMs: 11.4,
      n7HookMs: 1.8,
      opaEvalMs: 7.4,
      smfActionMs: 2.2,
      teid: '0x004A9F12',
      wormRecordId: 'cdr-us-000102',
      runtimeEngine: 'express-corelink-bridge'
    }
  ];

  const edgeEndpoints: EdgeEndpointRecord[] = [
    {
      id: 'edge-atm-cnb-ffiec',
      name: 'Branch ATM & Cellular Failover Router (Waxahachie, TX)',
      profileType: 'BRANCH_ATM_FFIEC',
      framework: 'FFIEC AIO / NIST SP 800-53 SC-7',
      perimeter: 'securebase-us',
      imsi: '310260000000001',
      iccid: '8901260000000000012',
      privateIp: '100.64.12.44',
      apn: 'apn.cnb-waxahachie.us.securebase.internal',
      mecEnclaveId: 'mec-us-tx-waxahachie-01',
      backhaulOnline: true,
      xdpAction: 'XDP_PASS',
      ulclState: 'MEC_LOCAL_STEER',
      expectedPcr0: 'a1c9f083b410e92c5d87114a39e8c02b77d419aa02f87143b109c445d2a9e011',
      expectedPcr7: '4e882b1c9904f7a3d12c65e018b39a40fe221098bc443d11a76c9082b4e19002',
      reportedPcr0: 'a1c9f083b410e92c5d87114a39e8c02b77d419aa02f87143b109c445d2a9e011',
      reportedPcr7: '4e882b1c9904f7a3d12c65e018b39a40fe221098bc443d11a76c9082b4e19002',
      iotSafeValid: true,
      iotSafeCertThumbprint: 'gsma:iotsafe:e8a1:44c9:901b:f302',
      passedPackets: 184290,
      droppedPackets: 0,
      lastAttestedUtc: now
    },
    {
      id: 'edge-icu-telemetry-hipaa',
      name: 'Clinical Telemetry Terminal at Hospital Edge (ICU Hub)',
      profileType: 'CLINICAL_TELEMETRY_HIPAA',
      framework: 'HIPAA 164.312(d) & (e)(1)',
      perimeter: 'securebase-us',
      imsi: '310260000000099',
      iccid: '8901260000000000099',
      privateIp: '100.64.18.21',
      apn: 'apn.med-telemetry.us.securebase.internal',
      mecEnclaveId: 'mec-us-hospital-icu-02',
      backhaulOnline: true,
      xdpAction: 'XDP_PASS',
      ulclState: 'MEC_LOCAL_STEER',
      expectedPcr0: '7b44e19a00c3812d99a145f7b02c88e13a90d411c2b7e504f189a0c33e71209a',
      expectedPcr7: 'c910b44e7721a8d50f3c91a4b2e68017d335c908a1f4b22e80d5c1139a4e7781',
      reportedPcr0: '7b44e19a00c3812d99a145f7b02c88e13a90d411c2b7e504f189a0c33e71209a',
      reportedPcr7: 'c910b44e7721a8d50f3c91a4b2e68017d335c908a1f4b22e80d5c1139a4e7781',
      iotSafeValid: true,
      iotSafeCertThumbprint: 'gsma:iotsafe:72f0:19aa:334d:c810',
      passedPackets: 92415,
      droppedPackets: 0,
      lastAttestedUtc: now
    }
  ];

  return {
    sims,
    wormChain,
    quarantineLogs,
    edgeEndpoints,
    edgeWormBuffer: [],
    lastUpdatedUtc: now
  };
}

async function ensureStoreFile(): Promise<MvnoSandboxState> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MvnoSandboxState>;
    const defaults = buildInitialState();
    const hydrated: MvnoSandboxState = {
      sims: parsed.sims ?? defaults.sims,
      wormChain: parsed.wormChain ?? defaults.wormChain,
      quarantineLogs: parsed.quarantineLogs ?? defaults.quarantineLogs,
      edgeEndpoints: parsed.edgeEndpoints?.length ? parsed.edgeEndpoints : defaults.edgeEndpoints,
      edgeWormBuffer: parsed.edgeWormBuffer ?? [],
      lastUpdatedUtc: parsed.lastUpdatedUtc ?? defaults.lastUpdatedUtc
    };
    if (!parsed.edgeEndpoints?.length) {
      await fs.writeFile(STORE_PATH, JSON.stringify(hydrated, null, 2), 'utf8');
    }
    return hydrated;
  } catch {
    const initial = buildInitialState();
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

export function withStoreMutation<T>(mutator: (state: MvnoSandboxState) => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(async () => {
    const state = await ensureStoreFile();
    const result = await mutator(state);
    state.lastUpdatedUtc = new Date().toISOString();
    const tmpPath = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmpPath, STORE_PATH);
    return result;
  });
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function readSandboxState(): Promise<MvnoSandboxState> {
  return ensureStoreFile();
}

export async function resetSandboxState(): Promise<MvnoSandboxState> {
  return withStoreMutation(() => {
    // Replace store file contents by mutating fields on returned state
    const fresh = buildInitialState();
    return fresh;
  }).then(async (fresh) => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  });
}

export function verifyWormChainRecords(records: PersistedWormCdrRecord[]): {
  checked: boolean;
  valid: boolean;
  brokenAtSeq: number | null;
  summary: string;
} {
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (i > 0 && rec.prevHash !== records[i - 1].hmacSha256) {
      return {
        checked: true,
        valid: false,
        brokenAtSeq: rec.seq,
        summary: `CHAIN LINK VIOLATION at Seq #${rec.seq}: prevHash mismatch against Seq #${records[i - 1].seq}.`
      };
    }
    const recomputed = computeSha256Hex(serializeCdrForHash(rec));
    if (recomputed !== rec.hmacSha256) {
      return {
        checked: true,
        valid: false,
        brokenAtSeq: rec.seq,
        summary: `CHAIN INTEGRITY VIOLATION at Seq #${rec.seq}: Computed SHA-256 does not match WORM Object Lock signature.`
      };
    }
  }
  return {
    checked: true,
    valid: true,
    brokenAtSeq: null,
    summary: `100% CRYPTOGRAPHIC VERIFIED: All ${records.length} CDR blocks match 2,555-day WORM chain.`
  };
}

export async function probeGoCorelinkDaemon(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 250);
    const res = await fetch('http://127.0.0.1:8085/health', { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export interface GeofenceEvalInput {
  perimeter: SovereignScopeId;
  eventType: 'N7_PDU_SESSION_ESTABLISH' | 'N15_TOWER_HANDOVER' | 'N7_IMEI_HARDWARE_SWAP';
  imsiHash?: string;
  imeiSv: string;
  sourceTac: string;
  targetTac: string;
  apn?: string;
  forcedDrift?: boolean;
}

export async function evaluateGeofenceAndPersist(input: GeofenceEvalInput) {
  const start = performance.now();
  const scope: SovereignScopeId = ALLOWED_TACS[input.perimeter] ? input.perimeter : 'securebase-us';
  const tacPrefix = (input.targetTac || '').split(' ')[0];
  const tacAllowed = ALLOWED_TACS[scope].has(tacPrefix);
  const imeiMismatch = input.imeiSv.toUpperCase().includes('MISMATCH') || input.eventType === 'N7_IMEI_HARDWARE_SWAP';

  let goCorelinkProxied = false;
  let goResponseAction: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 250);
    const goRes = await fetch('http://127.0.0.1:8085/v1/mcp/authorize-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imsi: '310260000000001',
        imei: input.imeiSv,
        imei_sv_verified: !imeiMismatch,
        apn: input.apn || `apn.tenant.${scope}.securebase.internal`,
        sovereign_scope: scope,
        target_tac: input.targetTac,
        target_tenant_id: 'pilot-citizens-national-bank-ffiec-2026',
        target_vpc_id: 'vpc-0a1b2c3d4e5f',
        source_mcc_mnc: '310-260'
      })
    });
    clearTimeout(timer);
    if (goRes.ok) {
      const goJson = (await goRes.json()) as { action?: string };
      goCorelinkProxied = true;
      goResponseAction = goJson.action || null;
    }
  } catch {
    // Fallback cleanly to deterministic in-process CoreLink Rego engine
  }

  let decision: 'ALLOW' | 'PCF_QOS_THROTTLE' | 'SMF_PDU_SESSION_RELEASE' = 'ALLOW';
  let regoRule = 'mvno.geofence.allow_verified_tac';
  let rationale = `Target ${input.targetTac} verified inside ${scope} geofence with attested eUICC IMEI-SV.`;
  let actionTaken = 'SMF preserved RFC 6598 CGNAT PrivateLink tunnel (QoS 5QI=5).';
  let pduState: PersistedSimRecord['pduState'] = 'ACTIVE';

  if (input.forcedDrift || !tacAllowed || goResponseAction === 'SMF_PDU_SESSION_RELEASE') {
    decision = 'SMF_PDU_SESSION_RELEASE';
    regoRule = input.forcedDrift
      ? 'mvno.geofence.deny_policy_drift_tac'
      : 'mvno.geofence.deny_unapproved_tac';
    rationale = `Handover target ${input.targetTac} violates mvno_geofence_tac.rego sovereign perimeter allowlist for ${scope}.`;
    actionTaken = 'PCF issued N7/N15 abort -> SMF executed PFCP Session Deletion (PDU Session Release) & revoked UPF GTP-U TEID 0x004A9F12.';
    pduState = 'RELEASED_QUARANTINED';
  } else if (imeiMismatch || goResponseAction === 'PCF_QOS_THROTTLE') {
    decision = 'PCF_QOS_THROTTLE';
    regoRule = 'mvno.geofence.throttle_imei_drift';
    rationale = `SIM profile attached with unrecognized IMEI-SV baseband revision inside ${scope}.`;
    actionTaken = 'UDM/PCF applied dynamic 64 kbps quarantine QoS slice & wrote audit block to WORM sink.';
    pduState = 'THROTTLED_64KBPS';
  }

  const runtimeMs = Math.max(0.4, Number((performance.now() - start).toFixed(1)));
  const n7HookMs = decision === 'SMF_PDU_SESSION_RELEASE' ? 1.8 : 1.5;
  const opaEvalMs = Number(Math.min(8.5, Math.max(5.8, 6.4 + runtimeMs * 0.25)).toFixed(1));
  const smfActionMs = decision === 'SMF_PDU_SESSION_RELEASE' ? 2.2 : 1.9;
  const totalMs = Number((n7HookMs + opaEvalMs + smfActionMs).toFixed(1));
  const runtimeEngine: QuarantineAuditLog['runtimeEngine'] = goCorelinkProxied
    ? 'go-corelink+express-bridge'
    : 'express-corelink-bridge';
  const teid = '0x004A9F12';

  return withStoreMutation((state) => {
    const nowIso = new Date().toISOString();
    const startIso = new Date(Date.now() - 45000).toISOString();
    const prevRecord = state.wormChain[state.wormChain.length - 1];
    const nextSeq = prevRecord ? prevRecord.seq + 1 : 1;
    const prevHash = prevRecord
      ? prevRecord.hmacSha256
      : '0000000000000000000000000000000000000000000000000000000000000000';
    const recordId = `cdr-${scope.replace('securebase-', '')}-${String(100 + nextSeq).padStart(6, '0')}`;
    const resolvedImsiHash = input.imsiHash || '9f84c2e10a44b912e301d8f9c2a17701';

    const cdrBase: Omit<PersistedWormCdrRecord, 'hmacSha256'> = {
      seq: nextSeq,
      recordId,
      perimeter: scope,
      imsiHash: resolvedImsiHash,
      tac: input.targetTac,
      tunnelStartUtc: startIso,
      tunnelEndUtc: nowIso,
      uplinkBytes: decision === 'ALLOW' ? 318400 : 1420,
      downlinkBytes: decision === 'ALLOW' ? 1024800 : 0,
      verdict: decision === 'ALLOW' ? 'COMPLIANT' : 'QUARANTINED',
      prevHash
    };

    const newCdr: PersistedWormCdrRecord = {
      ...cdrBase,
      hmacSha256: computeSha256Hex(serializeCdrForHash(cdrBase)),
      tampered: false
    };
    state.wormChain.push(newCdr);

    const targetSim = state.sims.find((s) => s.sovereignScope === scope) || state.sims[0];
    if (targetSim) {
      targetSim.pduState = pduState;
      targetSim.lastTac = input.targetTac;
      targetSim.updatedAtUtc = nowIso;
    }

    const logEntry: QuarantineAuditLog = {
      id: `qlog-${Date.now()}`,
      timestampUtc: nowIso,
      perimeter: scope,
      eventType: input.eventType,
      imsiHash: resolvedImsiHash,
      sourceTac: input.sourceTac,
      targetTac: input.targetTac,
      decision,
      regoRule,
      totalLatencyMs: totalMs,
      n7HookMs,
      opaEvalMs,
      smfActionMs,
      teid,
      wormRecordId: recordId,
      runtimeEngine
    };
    state.quarantineLogs.unshift(logEntry);
    if (state.quarantineLogs.length > 25) {
      state.quarantineLogs = state.quarantineLogs.slice(0, 25);
    }

    return {
      decision,
      pduState,
      regoRule,
      rationale,
      actionTaken,
      teid,
      latency: { n7HookMs, opaEvalMs, smfActionMs, totalMs },
      evaluatedAt: nowIso,
      runtimeEngine,
      goCorelinkProxied,
      wormRecord: newCdr,
      logEntry,
      chainVerification: verifyWormChainRecords(state.wormChain)
    };
  });
}

export async function attestEdgeEndpoint(
  endpointId: string,
  mode: 'verify' | 'drift-pcr' | 'drift-iotsafe' | 'restore'
) {
  return withStoreMutation((state) => {
    const endpoint =
      state.edgeEndpoints.find((e) => e.id === endpointId) || state.edgeEndpoints[0];
    const nowIso = new Date().toISOString();

    if (mode === 'restore' || mode === 'verify') {
      endpoint.reportedPcr0 = endpoint.expectedPcr0;
      endpoint.reportedPcr7 = endpoint.expectedPcr7;
      endpoint.iotSafeValid = true;
      endpoint.xdpAction = 'XDP_PASS';
      endpoint.ulclState = 'MEC_LOCAL_STEER';
      endpoint.passedPackets += 1280;
    } else if (mode === 'drift-pcr') {
      endpoint.reportedPcr7 = 'deadbeef9904f7a3d12c65e018b39a40fe221098bc443d11a76c9082b4e1bad7';
      endpoint.xdpAction = 'XDP_DROP';
      endpoint.ulclState = 'PFCP_FAR_DROP';
      endpoint.droppedPackets += 412;
    } else if (mode === 'drift-iotsafe') {
      endpoint.iotSafeValid = false;
      endpoint.xdpAction = 'XDP_DROP';
      endpoint.ulclState = 'PFCP_FAR_DROP';
      endpoint.droppedPackets += 256;
    }
    endpoint.lastAttestedUtc = nowIso;

    const compliant =
      endpoint.iotSafeValid &&
      endpoint.reportedPcr0 === endpoint.expectedPcr0 &&
      endpoint.reportedPcr7 === endpoint.expectedPcr7;
    const eventReason = compliant
      ? `EDGE_ATTEST_PASS (${endpoint.mecEnclaveId})`
      : mode === 'drift-iotsafe'
      ? 'EDGE_IOTSAFE_SIG_INVALID -> XDP_DROP + PFCP_DELETE'
      : 'EDGE_TPM_PCR7_DRIFT -> XDP_DROP + PFCP_DELETE';

    let syncedWormRecord: PersistedWormCdrRecord | null = null;
    let bufferedRecord: EdgeWormBufferedRecord | null = null;

    if (endpoint.backhaulOnline) {
      const prev = state.wormChain[state.wormChain.length - 1];
      const nextSeq = prev ? prev.seq + 1 : 1;
      const prevHash = prev ? prev.hmacSha256 : '0'.repeat(64);
      const recordId = `cdr-edge-${String(100 + nextSeq).padStart(6, '0')}`;
      const imsiHash = computeSha256Hex(endpoint.imsi).slice(0, 32);

      const cdrBase: Omit<PersistedWormCdrRecord, 'hmacSha256'> = {
        seq: nextSeq,
        recordId,
        perimeter: endpoint.perimeter,
        imsiHash,
        tac: `${endpoint.mecEnclaveId} (${endpoint.privateIp})`,
        tunnelStartUtc: new Date(Date.now() - 15000).toISOString(),
        tunnelEndUtc: nowIso,
        uplinkBytes: compliant ? 94200 : 0,
        downlinkBytes: compliant ? 310400 : 0,
        verdict: compliant ? 'COMPLIANT' : 'QUARANTINED',
        prevHash
      };

      syncedWormRecord = {
        ...cdrBase,
        hmacSha256: computeSha256Hex(serializeCdrForHash(cdrBase)),
        tampered: false
      };
      state.wormChain.push(syncedWormRecord);
    } else {
      const lastBuf = state.edgeWormBuffer[state.edgeWormBuffer.length - 1];
      const lastCloud = state.wormChain[state.wormChain.length - 1];
      const prevHash = lastBuf
        ? lastBuf.hmacSha256
        : lastCloud
        ? lastCloud.hmacSha256
        : '0'.repeat(64);
      const nextSeq = (lastBuf ? lastBuf.seq : 0) + 1;
      const recordId = `edge-buf-${String(nextSeq).padStart(4, '0')}`;
      const hmacSha256 = computeSha256Hex(`${nextSeq}|${recordId}|${endpoint.id}|${eventReason}|${prevHash}`);

      bufferedRecord = {
        seq: nextSeq,
        recordId,
        endpointId: endpoint.id,
        perimeter: endpoint.perimeter,
        eventReason,
        prevHash,
        hmacSha256,
        syncStatus: 'PENDING_SYNC',
        capturedAtUtc: nowIso
      };
      state.edgeWormBuffer.push(bufferedRecord);
    }

    const matchingSim = state.sims.find((s) => s.imsi === endpoint.imsi);
    if (matchingSim) {
      matchingSim.pduState = compliant ? 'ACTIVE' : 'RELEASED_QUARANTINED';
      matchingSim.updatedAtUtc = nowIso;
    }

    return {
      endpoint: { ...endpoint },
      compliant,
      regoRule: compliant
        ? 'mvno.edge.decision (XDP_PASS_AND_MEC_STEER)'
        : mode === 'drift-iotsafe'
        ? 'mvno.edge.deny_invalid_iotsafe_sig'
        : 'mvno.edge.deny_tpm_pcr7_drift',
      summary: compliant
        ? `Hardware attestation passed for ${endpoint.name}. eBPF XDP_PASS active on ${endpoint.privateIp} -> ${endpoint.mecEnclaveId}.`
        : `Hardware drift detected on ${endpoint.name}. UE IP ${endpoint.privateIp} evicted via XDP_DROP prior to sk_buff allocation; PFCP FAR=DROP sent.`,
      syncedWormRecord,
      bufferedRecord,
      edgeWormBuffer: state.edgeWormBuffer,
      chainVerification: verifyWormChainRecords(state.wormChain)
    };
  });
}

export async function toggleEdgeBackhaul(endpointId: string) {
  return withStoreMutation((state) => {
    const endpoint =
      state.edgeEndpoints.find((e) => e.id === endpointId) || state.edgeEndpoints[0];
    endpoint.backhaulOnline = !endpoint.backhaulOnline;
    endpoint.lastAttestedUtc = new Date().toISOString();
    return {
      endpoint: { ...endpoint },
      edgeEndpoints: state.edgeEndpoints,
      edgeWormBuffer: state.edgeWormBuffer
    };
  });
}

export async function bufferOfflineEdgeEvent(endpointId: string, eventReason?: string) {
  return withStoreMutation((state) => {
    const endpoint =
      state.edgeEndpoints.find((e) => e.id === endpointId) || state.edgeEndpoints[0];
    const nowIso = new Date().toISOString();
    const lastBuf = state.edgeWormBuffer[state.edgeWormBuffer.length - 1];
    const lastCloud = state.wormChain[state.wormChain.length - 1];
    const prevHash = lastBuf
      ? lastBuf.hmacSha256
      : lastCloud
      ? lastCloud.hmacSha256
      : '0'.repeat(64);
    const nextSeq = (lastBuf ? lastBuf.seq : 0) + 1;
    const recordId = `edge-buf-${String(nextSeq).padStart(4, '0')}`;
    const reason = eventReason || `PERIODIC_PCR_HEARTBEAT_OFFLINE (${endpoint.mecEnclaveId})`;
    const hmacSha256 = computeSha256Hex(`${nextSeq}|${recordId}|${endpoint.id}|${reason}|${prevHash}`);

    const entry: EdgeWormBufferedRecord = {
      seq: nextSeq,
      recordId,
      endpointId: endpoint.id,
      perimeter: endpoint.perimeter,
      eventReason: reason,
      prevHash,
      hmacSha256,
      syncStatus: 'PENDING_SYNC',
      capturedAtUtc: nowIso
    };
    state.edgeWormBuffer.push(entry);
    return {
      bufferedRecord: entry,
      edgeWormBuffer: state.edgeWormBuffer
    };
  });
}

export async function syncEdgeBufferToWorm(endpointId?: string) {
  return withStoreMutation((state) => {
    const pending = state.edgeWormBuffer.filter(
      (b) => b.syncStatus === 'PENDING_SYNC' && (!endpointId || b.endpointId === endpointId)
    );
    const syncedRecords: PersistedWormCdrRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of pending) {
      const endpoint = state.edgeEndpoints.find((e) => e.id === item.endpointId);
      if (endpoint) {
        endpoint.backhaulOnline = true;
      }
      const prev = state.wormChain[state.wormChain.length - 1];
      const nextSeq = prev ? prev.seq + 1 : 1;
      const prevHash = prev ? prev.hmacSha256 : '0'.repeat(64);
      const recordId = `cdr-sync-${String(100 + nextSeq).padStart(6, '0')}`;
      const imsiHash = computeSha256Hex(endpoint?.imsi || item.endpointId).slice(0, 32);
      const isQuarantined = item.eventReason.includes('XDP_DROP') || item.eventReason.includes('DRIFT');

      const base: Omit<PersistedWormCdrRecord, 'hmacSha256'> = {
        seq: nextSeq,
        recordId,
        perimeter: item.perimeter,
        imsiHash,
        tac: `${endpoint?.mecEnclaveId || item.endpointId} (Edge Sync)`,
        tunnelStartUtc: item.capturedAtUtc,
        tunnelEndUtc: nowIso,
        uplinkBytes: isQuarantined ? 0 : 48600,
        downlinkBytes: isQuarantined ? 0 : 142800,
        verdict: isQuarantined ? 'QUARANTINED' : 'COMPLIANT',
        prevHash
      };
      const sealed: PersistedWormCdrRecord = {
        ...base,
        hmacSha256: computeSha256Hex(serializeCdrForHash(base)),
        tampered: false
      };
      state.wormChain.push(sealed);
      syncedRecords.push(sealed);
      item.syncStatus = 'SYNCED_TO_WORM';
    }

    // Clear reconciled entries from pending spool once committed to regional WORM ledger
    state.edgeWormBuffer = state.edgeWormBuffer.filter((b) => b.syncStatus === 'PENDING_SYNC');

    return {
      syncedCount: syncedRecords.length,
      syncedRecords,
      edgeEndpoints: state.edgeEndpoints,
      edgeWormBuffer: state.edgeWormBuffer,
      wormChain: state.wormChain,
      chainVerification: verifyWormChainRecords(state.wormChain)
    };
  });
}

export function getTerraformPlanDiffs(scope?: SovereignScopeId): TerraformDiffItem[] {
  const allDiffs: TerraformDiffItem[] = [
    {
      id: 'tf-us-vpn-retire',
      resourceAddress: 'google_compute_vpn_tunnel.mvne_ipsec_tunnel_a',
      resourceType: 'google_compute_vpn_tunnel',
      perimeter: 'securebase-us',
      action: 'destroy',
      phaseContext: 'Phase 1 Aggregator Bridge -> Retired at Client #10 Core Cutover',
      regoPolicy: 'mvno.network.zero_public_ip',
      regoStatus: 'PASS',
      summary: 'Retires wholesale MVNE third-party IPsec aggregator tunnel once sovereign free5GC UPF N3/N6 breakout activates.',
      hclDiff: [
        '- resource "google_compute_vpn_tunnel" "mvne_ipsec_tunnel_a" {',
        '-   name               = "mvne-private-apn-tunnel-a"',
        '-   ike_version        = 2',
        '-   shared_secret      = (sensitive value)',
        '- }'
      ]
    },
    {
      id: 'tf-us-gke-core',
      resourceAddress: 'module.sovereign_core_us.google_container_cluster.mvno_core',
      resourceType: 'google_container_cluster',
      perimeter: 'securebase-us',
      action: 'create',
      phaseContext: 'Phase 2 Thick MVNO Control Plane (free5GC R17+ SBA)',
      regoPolicy: 'mvno.network.zero_public_ip',
      regoStatus: 'PASS',
      summary: 'Provisions private-endpoint GKE cluster in us-central1 with Workload Identity Federation and Cloud HSM etcd CMEK.',
      hclDiff: [
        '+ resource "google_container_cluster" "mvno_core" {',
        '+   name                    = "securebase-mvno-us"',
        '+   location                = "us-central1"',
        '+   enable_private_nodes    = true',
        '+   enable_private_endpoint = true',
        '+   database_encryption     = { state = "ENCRYPTED", key_name = var.us_cmek_key_id }',
        '+ }'
      ]
    },
    {
      id: 'tf-us-upf-pool',
      resourceAddress: 'module.sovereign_core_us.google_container_node_pool.upf_ebpf_nodes',
      resourceType: 'google_container_node_pool',
      perimeter: 'securebase-us',
      action: 'create',
      phaseContext: 'Phase 2 eBPF / gtp5g High-Throughput User Plane',
      regoPolicy: 'mvno.geofence.allow_verified_tac',
      regoStatus: 'PASS',
      summary: 'Adds 2x HA compute-optimized shielded nodes (c2d-standard-8, Secure Boot) running Linux gtp5g eBPF XDP forwarding.',
      hclDiff: [
        '+ resource "google_container_node_pool" "upf_ebpf_nodes" {',
        '+   name                        = "upf-gtp5g-dataplane"',
        '+   node_count                  = 2',
        '+   machine_type                = "c2d-standard-8"',
        '+   enable_secure_boot          = true',
        '+   enable_integrity_monitoring = true',
        '+ }'
      ]
    },
    {
      id: 'tf-us-psc-breakout',
      resourceAddress: 'module.tenant_psc_breakout.google_compute_service_attachment.apn_psc_breakout',
      resourceType: 'google_compute_service_attachment',
      perimeter: 'securebase-us',
      action: 'create',
      phaseContext: 'Phase 2 Tenant VPC PrivateLink / PSC Direct Breakout',
      regoPolicy: 'mvno.network.zero_public_ip',
      regoStatus: 'PASS',
      summary: 'Binds apn.cnb-waxahachie.us.securebase.internal (100.64.12.0/24) directly to customer VPC with zero public internet egress.',
      hclDiff: [
        '+ resource "google_compute_service_attachment" "apn_psc_breakout" {',
        '+   name                  = "psc-apn-cnb-waxahachie"',
        '+   connection_preference = "ACCEPT_MANUAL"',
        '+   nat_subnets           = ["100.64.12.0/24"]',
        '+   allow_internet_egress = false',
        '+ }'
      ]
    },
    {
      id: 'tf-us-worm-vault',
      resourceAddress: 'module.worm_vault_us.google_storage_bucket.worm_cdr_vault',
      resourceType: 'google_storage_bucket',
      perimeter: 'securebase-us',
      action: 'update',
      phaseContext: 'Continuous 7-Year Evidentiary Continuity Across Cutover',
      regoPolicy: 'mvno.worm.enforce_7yr_lock',
      regoStatus: 'PASS',
      summary: 'Retains existing Phase 1 2,555-day WORM bucket in-place and adds Phase 2 eBPF UPF service-account append IAM binding.',
      hclDiff: [
        '~ resource "google_storage_bucket" "worm_cdr_vault" {',
        '    name                     = "securebase-worm-cdr-us"',
        '    retention_policy.locked  = true (220752000s / 7 years)',
        '~   append_principals        = ["sa:cdr-shipper@phase1"] -> ["sa:cdr-shipper@phase1", "sa:upf-ebpf@mvno-us"]',
        '  }'
      ]
    },
    {
      id: 'tf-euro-core',
      resourceAddress: 'module.sovereign_core_euro.google_container_cluster.mvno_core',
      resourceType: 'google_container_cluster',
      perimeter: 'securebase-euro',
      action: 'create',
      phaseContext: 'Phase 2 EU DORA & GDPR Locked Enclave (Frankfurt)',
      regoPolicy: 'mvno.network.zero_public_ip',
      regoStatus: 'PASS',
      summary: 'Deploys isolated free5GC SBA cluster in europe-west3 with EU-resident HSM keys and zero cross-border telemetry.',
      hclDiff: [
        '+ resource "google_container_cluster" "mvno_core" {',
        '+   name                = "securebase-mvno-euro"',
        '+   location            = "europe-west3"',
        '+   cgnat_pool          = "100.72.0.0/16"',
        '+   worm_bucket         = "securebase-worm-cdr-euro"',
        '+ }'
      ]
    },
    {
      id: 'tf-asia-core',
      resourceAddress: 'module.sovereign_core_asia.google_container_cluster.mvno_core',
      resourceType: 'google_container_cluster',
      perimeter: 'securebase-asia',
      action: 'create',
      phaseContext: 'Phase 2 APAC MAS TRM Enclave (Singapore)',
      regoPolicy: 'mvno.worm.enforce_7yr_lock',
      regoStatus: 'PASS',
      summary: 'Deploys APAC packet core in asia-southeast1 with MAS TRM 7-year WORM lock and Private Service Connect breakout.',
      hclDiff: [
        '+ resource "google_container_cluster" "mvno_core" {',
        '+   name                = "securebase-mvno-asia"',
        '+   location            = "asia-southeast1"',
        '+   cgnat_pool          = "100.80.0.0/16"',
        '+   worm_bucket         = "securebase-worm-cdr-asia"',
        '+ }'
      ]
    }
  ];

  return scope ? allDiffs.filter((d) => d.perimeter === scope) : allDiffs;
}

function classifyRepoFile(relPath: string): {
  category: WorkspaceRepoFile['category'];
  language: WorkspaceRepoFile['language'];
  summary: string;
} {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.startsWith('.github/')) {
    return {
      category: 'workflow',
      language: 'yaml',
      summary: 'GitHub Actions shift-left OIDC compliance gate validating IaC, schemas, and Rego policies.'
    };
  }
  if (normalized.startsWith('policies/')) {
    return {
      category: 'rego',
      language: 'rego',
      summary: 'OPA Rego v1 policy gate enforcing sub-15 ms TAC geofencing, zero public IP, or 7-year WORM lock.'
    };
  }
  if (normalized.startsWith('infra/')) {
    return {
      category: 'terraform',
      language: 'hcl',
      summary: 'OpenTofu/Terraform module or Phase 1/2 environment definition for sovereign MVNO infrastructure.'
    };
  }
  if (normalized.startsWith('packet-core/') || normalized === 'docker-compose.yml') {
    const lang: WorkspaceRepoFile['language'] = normalized.endsWith('.c') ? 'c' : 'yaml';
    return {
      category: 'core',
      language: lang,
      summary: normalized.endsWith('.c')
        ? 'Kernel-space eBPF XDP cellular packet quarantine filter (XDP_PASS / XDP_DROP).'
        : 'Cloud-native free5GC R17+ / eBPF UPF / MEC UL CL packet-core manifest.'
    };
  }
  if (normalized.startsWith('schemas/')) {
    return {
      category: 'schema',
      language: 'json',
      summary: 'JSON Schema 2020-12 contract enforcing SIM identity attestation or Merkle WORM manifest structure.'
    };
  }
  if (normalized.startsWith('scripts/')) {
    return {
      category: 'script',
      language: normalized.endsWith('.py') ? 'python' : 'bash',
      summary: 'Operational verification script for policy-drift quarantine simulation or examiner WORM ledger audits.'
    };
  }
  if (normalized.startsWith('docs/') || normalized === 'README.md') {
    return {
      category: 'docs',
      language: 'markdown',
      summary: 'Architecture specification or statutory compliance control matrix (FFIEC, HIPAA, DORA, MAS TRM).'
    };
  }
  if (normalized.startsWith('services/')) {
    const lang: WorkspaceRepoFile['language'] = normalized.endsWith('.go')
      ? 'go'
      : normalized.endsWith('.ts')
      ? 'typescript'
      : 'text';
    return {
      category: 'service',
      language: lang,
      summary: 'CoreLink MCP microservice, PCF-to-OPA interceptor, WORM CDR shipper, or SIM lifecycle controller.'
    };
  }
  return {
    category: 'core',
    language: 'text',
    summary: 'Repository build or configuration file for securebase-mvno.'
  };
}

async function collectFilesRecursive(dir: string, baseDir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'bin' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursive(full, baseDir, out);
    } else {
      out.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

export async function readWorkspaceRepoTree(): Promise<WorkspaceRepoFile[]> {
  try {
    await fs.access(REPO_ROOT);
  } catch {
    return [];
  }
  const relPaths = (await collectFilesRecursive(REPO_ROOT, REPO_ROOT)).sort();
  const files: WorkspaceRepoFile[] = [];

  for (const rel of relPaths) {
    const abs = path.join(REPO_ROOT, rel);
    const code = await fs.readFile(abs, 'utf8');
    const meta = classifyRepoFile(rel);
    files.push({
      path: rel,
      name: path.basename(rel),
      category: meta.category,
      language: meta.language,
      sizeBytes: Buffer.byteLength(code, 'utf8'),
      summary: meta.summary,
      code
    });
  }
  return files;
}

export async function buildWorkspaceRepoZip(): Promise<Buffer> {
  const files = await readWorkspaceRepoTree();
  const zip = new JSZip();
  const rootFolder = zip.folder('securebase-mvno');

  for (const f of files) {
    const isExecutable = f.path.endsWith('.sh') || f.path.endsWith('.py');
    rootFolder?.file(f.path, f.code, {
      unixPermissions: isExecutable ? '755' : '644'
    });
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
