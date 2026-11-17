import { SovereignScopeId, WormCdrRecord } from '../data/mvnoData';

export interface SimInventoryRecord {
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

export interface ChainVerificationResult {
  checked: boolean;
  valid: boolean;
  brokenAtSeq: number | null;
  summary: string;
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

export interface MvnoSandboxStateResponse {
  sims: SimInventoryRecord[];
  wormChain: WormCdrRecord[];
  quarantineLogs: QuarantineAuditLog[];
  edgeEndpoints: EdgeEndpointRecord[];
  edgeWormBuffer: EdgeWormBufferedRecord[];
  lastUpdatedUtc: string;
  chainVerification: ChainVerificationResult;
}

export interface GeofenceEvaluateResponse {
  decision: 'ALLOW' | 'PCF_QOS_THROTTLE' | 'SMF_PDU_SESSION_RELEASE';
  pduState: 'ACTIVE' | 'THROTTLED_64KBPS' | 'RELEASED_QUARANTINED';
  regoRule: string;
  rationale: string;
  actionTaken: string;
  teid: string;
  latency: {
    n7HookMs: number;
    opaEvalMs: number;
    smfActionMs: number;
    totalMs: number;
  };
  evaluatedAt: string;
  runtimeEngine: 'go-corelink+express-bridge' | 'express-corelink-bridge';
  goCorelinkProxied: boolean;
  wormRecord: WormCdrRecord;
  logEntry: QuarantineAuditLog;
  chainVerification: ChainVerificationResult;
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

export interface TerraformDiffResponse {
  sourceEnv: string;
  targetEnv: string;
  counts: {
    create: number;
    update: number;
    destroy: number;
  };
  regoGateStatus: string;
  diffs: TerraformDiffItem[];
}

export interface WorkspaceRepoFile {
  path: string;
  name: string;
  category: 'workflow' | 'docs' | 'terraform' | 'core' | 'service' | 'rego' | 'script' | 'schema';
  language: string;
  sizeBytes: number;
  summary: string;
  code: string;
}

export interface MvnoHealthResponse {
  status: string;
  service: string;
  runtimeMode: 'go-corelink+express-bridge' | 'express-corelink-bridge';
  goCorelinkPort8085Online: boolean;
  persistence: {
    engine: string;
    simCount: number;
    wormRecordCount: number;
    quarantineLogCount: number;
    lastUpdatedUtc: string;
  };
}

export async function fetchMvnoHealth(): Promise<MvnoHealthResponse> {
  const res = await fetch('/api/mvno/health');
  if (!res.ok) throw new Error('Failed to probe CoreLink bridge health');
  return res.json();
}

export async function fetchMvnoSandboxState(): Promise<MvnoSandboxStateResponse> {
  const res = await fetch('/api/mvno/state');
  if (!res.ok) throw new Error('Failed to load MVNO sandbox state');
  return res.json();
}

export async function evaluateGeofenceViaApi(payload: {
  perimeter: SovereignScopeId;
  eventType: 'N7_PDU_SESSION_ESTABLISH' | 'N15_TOWER_HANDOVER' | 'N7_IMEI_HARDWARE_SWAP';
  imsiHash?: string;
  imeiSv: string;
  sourceTac: string;
  targetTac: string;
  apn?: string;
  forcedDrift?: boolean;
}): Promise<GeofenceEvaluateResponse> {
  const res = await fetch('/api/mvno/evaluate-geofence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('CoreLink policy evaluation request failed');
  return res.json();
}

export async function appendWormCdrViaApi(perimeter: SovereignScopeId): Promise<{
  wormChain: WormCdrRecord[];
  chainVerification: ChainVerificationResult;
}> {
  const res = await fetch('/api/mvno/worm-chain/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ perimeter })
  });
  if (!res.ok) throw new Error('Failed to append WORM CDR block');
  return res.json();
}

export async function tamperWormCdrViaApi(): Promise<{
  wormChain: WormCdrRecord[];
  chainVerification: ChainVerificationResult;
}> {
  const res = await fetch('/api/mvno/worm-chain/tamper', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to simulate WORM tamper');
  return res.json();
}

export async function verifyWormCdrViaApi(): Promise<{
  wormChain: WormCdrRecord[];
  chainVerification: ChainVerificationResult;
}> {
  const res = await fetch('/api/mvno/worm-chain/verify', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to verify WORM integrity chain');
  return res.json();
}

export async function resetWormVaultViaApi(): Promise<MvnoSandboxStateResponse> {
  const res = await fetch('/api/mvno/worm-chain/reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset WORM vault');
  return res.json();
}

export async function fetchTerraformPlanDiff(scope?: SovereignScopeId): Promise<TerraformDiffResponse> {
  const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  const res = await fetch(`/api/mvno/terraform-diff${qs}`);
  if (!res.ok) throw new Error('Failed to load Terraform plan diff');
  return res.json();
}

export async function fetchWorkspaceRepoTree(): Promise<{
  root: string;
  fileCount: number;
  files: WorkspaceRepoFile[];
}> {
  const res = await fetch('/api/mvno/repo-tree');
  if (!res.ok) throw new Error('Failed to read workspace repository tree');
  return res.json();
}

export async function downloadWorkspaceRepoZip(): Promise<void> {
  const res = await fetch('/api/mvno/export-bundle');
  if (!res.ok) throw new Error('Failed to generate securebase-mvno.zip archive');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'securebase-mvno.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function attestEdgeEndpointViaApi(
  endpointId: string,
  mode: 'verify' | 'drift-pcr' | 'drift-iotsafe' | 'restore'
): Promise<{
  endpoint: EdgeEndpointRecord;
  compliant: boolean;
  regoRule: string;
  summary: string;
  syncedWormRecord: WormCdrRecord | null;
  bufferedRecord: EdgeWormBufferedRecord | null;
  edgeWormBuffer: EdgeWormBufferedRecord[];
  chainVerification: ChainVerificationResult;
}> {
  const res = await fetch('/api/mvno/edge/attest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointId, mode })
  });
  if (!res.ok) throw new Error('Edge attestation API request failed');
  return res.json();
}

export async function toggleEdgeBackhaulViaApi(endpointId: string): Promise<{
  endpoint: EdgeEndpointRecord;
  edgeEndpoints: EdgeEndpointRecord[];
  edgeWormBuffer: EdgeWormBufferedRecord[];
}> {
  const res = await fetch('/api/mvno/edge/toggle-backhaul', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointId })
  });
  if (!res.ok) throw new Error('Edge backhaul toggle failed');
  return res.json();
}

export async function bufferOfflineEdgeEventViaApi(
  endpointId: string,
  eventReason?: string
): Promise<{
  bufferedRecord: EdgeWormBufferedRecord;
  edgeWormBuffer: EdgeWormBufferedRecord[];
}> {
  const res = await fetch('/api/mvno/edge/buffer-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointId, eventReason })
  });
  if (!res.ok) throw new Error('Edge offline WORM buffering failed');
  return res.json();
}

export async function syncEdgeBufferViaApi(endpointId?: string): Promise<{
  syncedCount: number;
  syncedRecords: WormCdrRecord[];
  edgeEndpoints: EdgeEndpointRecord[];
  edgeWormBuffer: EdgeWormBufferedRecord[];
  wormChain: WormCdrRecord[];
  chainVerification: ChainVerificationResult;
}> {
  const res = await fetch('/api/mvno/edge/sync-buffer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointId })
  });
  if (!res.ok) throw new Error('Edge WORM buffer Merkle sync failed');
  return res.json();
}
