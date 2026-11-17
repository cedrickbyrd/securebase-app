import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  aggregateTriCloudFinOps,
  CloudProviderId,
  TriCloudFinOpsReport
} from './finopsAggregator.ts';

export interface FailoverEndpointHealth {
  cloud: CloudProviderId;
  region: string;
  role: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  endpointUrl: string;
  status: 'HEALTHY' | 'DEGRADED' | 'ACTIVE_FAILOVER';
  latencyMs: number;
  rpoLagSeconds: number;
  rtoSeconds: number;
  lastProbedUtc: string;
}

export interface DrProbeEvent {
  probeId: string;
  timestampUtc: string;
  trigger: 'SCHEDULED_CLOUD_SCHEDULER' | 'EVENTBRIDGE_PROBE' | 'SIMULATED_OUTAGE' | 'PRIMARY_RESTORE';
  activeDnsTarget: string;
  rpoSeconds: number;
  rtoSeconds: number;
  supabaseReplicationStatus: 'SYNCED' | 'PROMOTED_STANDBY';
  summary: string;
}

export interface UnifiedAuditEvent {
  eventId: string;
  cloud: CloudProviderId;
  sourceCollector: 'AWS_CLOUDTRAIL_CONFIG' | 'GCP_CLOUD_AUDIT_SCC' | 'AZURE_ACTIVITY_DEFENDER';
  accountOrProject: string;
  actorIdentity: string;
  authMethod: 'OIDC_WIF' | 'FEDERATED_STS' | 'STATIC_KEY' | 'CLIENT_SECRET';
  action: string;
  resourceType: string;
  resourceId: string;
  encryptionCmek: boolean;
  publicExposure: boolean;
  tlsVersion: string;
  objectLockMode?: 'COMPLIANCE' | 'GOVERNANCE' | 'NONE';
  retentionDays?: number;
  eventSha256: string;
}

export interface GovernanceViolation {
  findingId: string;
  cloud: CloudProviderId;
  framework: 'FFIEC_AIO' | 'HIPAA_164_312' | 'SOC2_TYPE_II' | 'NIST_800_53';
  control: string;
  resourceId: string;
  severity: 'CRITICAL' | 'HIGH';
  reason: string;
}

export interface MerkleBatchReceipt {
  batchId: string;
  tenantId: string;
  collectedAtUtc: string;
  leafHashes: string[];
  merkleRootSha256: string;
  wormVaultUrn: string;
  retentionMode: 'COMPLIANCE';
  retentionDays: number;
  supabaseRlsSynced: boolean;
  postureStatus: 'COMPLIANT' | 'DRIFT_DETECTED';
  violations: GovernanceViolation[];
}

export interface GuardrailCheckResult {
  checkId: string;
  timestampUtc: string;
  cloud: CloudProviderId;
  guardrailMechanism: string;
  resourceName: string;
  decision: 'DENIED_BY_GUARDRAIL' | 'ALLOWED';
  violatedPolicies: string[];
  summary: string;
}

export interface TriCloudArtifactsBundle {
  drFailoverTf: string;
  triCloudGovernanceRego: string;
  unifiedAuditSchemaJson: string;
  supabaseRlsSql: string;
  universalGuardrailsTf: string;
  preflightWorkflowYml: string;
}

export interface TriCloudSandboxState {
  activeDnsTarget: CloudProviderId;
  regions: FailoverEndpointHealth[];
  drProbeHistory: DrProbeEvent[];
  merkleBatches: MerkleBatchReceipt[];
  driftOverrides: Record<string, 'OPEN' | 'REMEDIATED'>;
  guardrailHistory: GuardrailCheckResult[];
  lastUpdatedUtc: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'tricloud-sandbox.json');

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return sha256Hex('EMPTY_BATCH');
  let level = [...leafHashes];
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      nextLevel.push(sha256Hex(`${left}:${right}`));
    }
    level = nextLevel;
  }
  return level[0];
}

let mutationQueue: Promise<unknown> = Promise.resolve();

async function withTriCloudMutation<T>(fn: (state: TriCloudSandboxState) => Promise<T> | T): Promise<T> {
  const run = mutationQueue.then(async () => {
    const state = await readTriCloudSandboxState();
    const out = await fn(state);
    state.lastUpdatedUtc = new Date().toISOString();
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmp, STORE_FILE);
    return out;
  });
  mutationQueue = run.catch(() => undefined);
  return run;
}

export function buildBaselineEvents(withDrift: boolean): UnifiedAuditEvent[] {
  const base: Array<Omit<UnifiedAuditEvent, 'eventSha256'>> = [
    {
      eventId: 'evt-aws-ct-001',
      cloud: 'AWS',
      sourceCollector: 'AWS_CLOUDTRAIL_CONFIG',
      accountOrProject: 'prod-p7z4iqf7gg6dk',
      actorIdentity: 'arn:aws:sts::594006980795:assumed-role/SecureBaseOidc/gh-run',
      authMethod: withDrift ? 'STATIC_KEY' : 'OIDC_WIF',
      action: 's3:PutObjectLockConfiguration',
      resourceType: 'WORM_EVIDENCE_VAULT',
      resourceId: 'arn:aws:s3:::securebase-worm-evidence-us-east-1',
      encryptionCmek: true,
      publicExposure: false,
      tlsVersion: '1.3',
      objectLockMode: withDrift ? 'GOVERNANCE' : 'COMPLIANCE',
      retentionDays: 2555
    },
    {
      eventId: 'evt-gcp-ca-002',
      cloud: 'GCP',
      sourceCollector: 'GCP_CLOUD_AUDIT_SCC',
      accountOrProject: 'securebase-gcp-dev (594006980795)',
      actorIdentity: 'securebase-ingestor@securebase-gcp-dev.iam.gserviceaccount.com',
      authMethod: 'OIDC_WIF',
      action: 'storage.buckets.update',
      resourceType: 'CLOUD_STORAGE_BUCKET',
      resourceId: 'gs://securebase-ephi-us-central1',
      encryptionCmek: !withDrift,
      publicExposure: withDrift,
      tlsVersion: '1.3'
    },
    {
      eventId: 'evt-az-act-003',
      cloud: 'AZURE',
      sourceCollector: 'AZURE_ACTIVITY_DEFENDER',
      accountOrProject: 'sub-tximhotep-eastus',
      actorIdentity: 'mi-securebase-guardrails-eastus',
      authMethod: 'FEDERATED_STS',
      action: 'Microsoft.Network/frontDoors/securityPolicies/write',
      resourceType: 'AZURE_FRONT_DOOR',
      resourceId: 'securebase-eastus.azurefd.net',
      encryptionCmek: true,
      publicExposure: false,
      tlsVersion: withDrift ? '1.2' : '1.3'
    }
  ];

  return base.map((item) => ({
    ...item,
    eventSha256: sha256Hex(JSON.stringify(item))
  }));
}

export function evaluateTriCloudGovernanceEvents(events: UnifiedAuditEvent[]): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  for (const evt of events) {
    if (evt.authMethod === 'STATIC_KEY' || evt.authMethod === 'CLIENT_SECRET') {
      violations.push({
        findingId: `tricloud-auth-${evt.eventId}`,
        cloud: evt.cloud,
        framework: 'NIST_800_53',
        control: 'NIST SP 800-53 IA-5 / Zero Static Credentials',
        resourceId: evt.resourceId,
        severity: 'CRITICAL',
        reason: `[${evt.cloud}] Non-OIDC static auth '${evt.authMethod}' detected on '${evt.actorIdentity}'; WIF/OIDC required.`
      });
    }
    if (!evt.encryptionCmek) {
      violations.push({
        findingId: `tricloud-cmek-${evt.eventId}`,
        cloud: evt.cloud,
        framework: 'HIPAA_164_312',
        control: 'HIPAA 45 CFR 164.312(a)(2)(iv) (CMEK Encryption)',
        resourceId: evt.resourceId,
        severity: 'CRITICAL',
        reason: `[${evt.cloud}] Resource '${evt.resourceId}' missing customer-managed KMS/KeyVault CMEK.`
      });
    }
    if (evt.tlsVersion !== '1.3') {
      violations.push({
        findingId: `tricloud-tls-${evt.eventId}`,
        cloud: evt.cloud,
        framework: 'HIPAA_164_312',
        control: 'HIPAA 45 CFR 164.312(e)(1) (TLS 1.3 In-Transit)',
        resourceId: evt.resourceId,
        severity: 'HIGH',
        reason: `[${evt.cloud}] Endpoint '${evt.resourceId}' negotiated TLS '${evt.tlsVersion}'; TLS 1.3 is mandatory.`
      });
    }
    if (evt.publicExposure) {
      violations.push({
        findingId: `tricloud-public-${evt.eventId}`,
        cloud: evt.cloud,
        framework: 'SOC2_TYPE_II',
        control: 'SOC 2 CC6.1 / CC6.6 Logical Boundary Isolation',
        resourceId: evt.resourceId,
        severity: 'CRITICAL',
        reason: `[${evt.cloud}] Public storage or ingress exposure enabled on '${evt.resourceId}'.`
      });
    }
    if (evt.resourceType === 'WORM_EVIDENCE_VAULT' && evt.objectLockMode !== 'COMPLIANCE') {
      violations.push({
        findingId: `tricloud-worm-${evt.eventId}`,
        cloud: evt.cloud,
        framework: 'FFIEC_AIO',
        control: 'FFIEC AIO II.C / 7-Year COMPLIANCE WORM Lock',
        resourceId: evt.resourceId,
        severity: 'CRITICAL',
        reason: `[${evt.cloud}] WORM vault '${evt.resourceId}' lock mode is '${evt.objectLockMode || 'NONE'}'; must be COMPLIANCE.`
      });
    }
  }
  return violations;
}

function buildInitialState(): TriCloudSandboxState {
  const now = new Date().toISOString();
  const initialEvents = buildBaselineEvents(false);
  const leafHashes = initialEvents.map((e) => e.eventSha256);
  const merkleRootSha256 = computeMerkleRoot(leafHashes);

  return {
    activeDnsTarget: 'AWS',
    regions: [
      {
        cloud: 'AWS',
        region: 'us-east-1',
        role: 'PRIMARY',
        endpointUrl: 'https://us-east-1-edge.securebase.tximhotep.com/functions/v1/ingest-ci-scan',
        status: 'HEALTHY',
        latencyMs: 14,
        rpoLagSeconds: 0,
        rtoSeconds: 0,
        lastProbedUtc: now
      },
      {
        cloud: 'GCP',
        region: 'us-central1 (securebase-gcp-dev)',
        role: 'SECONDARY',
        endpointUrl: 'https://34.120.88.14/functions/v1/ingest-ci-scan',
        status: 'HEALTHY',
        latencyMs: 21,
        rpoLagSeconds: 4,
        rtoSeconds: 28,
        lastProbedUtc: now
      },
      {
        cloud: 'AZURE',
        region: 'eastus',
        role: 'TERTIARY',
        endpointUrl: 'https://securebase-eastus.azurefd.net/functions/v1/ingest-ci-scan',
        status: 'HEALTHY',
        latencyMs: 26,
        rpoLagSeconds: 6,
        rtoSeconds: 35,
        lastProbedUtc: now
      }
    ],
    drProbeHistory: [
      {
        probeId: 'probe-init-001',
        timestampUtc: now,
        trigger: 'EVENTBRIDGE_PROBE',
        activeDnsTarget: 'AWS (us-east-1)',
        rpoSeconds: 4,
        rtoSeconds: 28,
        supabaseReplicationStatus: 'SYNCED',
        summary: 'Scheduled RPO/RTO probe verified Route 53 primary active, Postgres WAL lag 4s (<= 60s SLA).'
      }
    ],
    merkleBatches: [
      {
        batchId: 'batch-tricloud-0001',
        tenantId: 'cnb-waxahachie',
        collectedAtUtc: now,
        leafHashes,
        merkleRootSha256,
        wormVaultUrn: 'arn:aws:s3:::securebase-worm-evidence-us-east-1',
        retentionMode: 'COMPLIANCE',
        retentionDays: 2555,
        supabaseRlsSynced: true,
        postureStatus: 'COMPLIANT',
        violations: []
      }
    ],
    driftOverrides: {},
    guardrailHistory: [],
    lastUpdatedUtc: now
  };
}

export async function readTriCloudSandboxState(): Promise<TriCloudSandboxState> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    return JSON.parse(raw) as TriCloudSandboxState;
  } catch {
    const initial = buildInitialState();
    await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

export async function resetTriCloudSandboxState(): Promise<TriCloudSandboxState> {
  return withTriCloudMutation((state) => {
    const fresh = buildInitialState();
    state.activeDnsTarget = fresh.activeDnsTarget;
    state.regions = fresh.regions;
    state.drProbeHistory = fresh.drProbeHistory;
    state.merkleBatches = fresh.merkleBatches;
    state.driftOverrides = {};
    state.guardrailHistory = [];
    return state;
  });
}

export async function loadTriCloudArtifactsBundle(): Promise<TriCloudArtifactsBundle> {
  const root = process.cwd();
  const [
    drFailoverTf,
    triCloudGovernanceRego,
    unifiedAuditSchemaJson,
    supabaseRlsSql,
    universalGuardrailsTf,
    preflightWorkflowYml
  ] = await Promise.all([
    fs.readFile(path.join(root, 'infra', 'tricloud', 'dr-failover.tf'), 'utf-8'),
    fs.readFile(path.join(root, 'policies', 'rego', 'tri_cloud_governance.rego'), 'utf-8'),
    fs.readFile(path.join(root, 'schemas', 'unified-tricloud-audit.json'), 'utf-8'),
    fs.readFile(path.join(root, 'infra', 'tricloud', 'supabase-rls-posture.sql'), 'utf-8'),
    fs.readFile(path.join(root, 'infra', 'tricloud', 'universal-guardrails.tf'), 'utf-8'),
    fs.readFile(path.join(root, '.github', 'workflows', 'securebase-preflight-gate.yml'), 'utf-8')
  ]);
  return {
    drFailoverTf,
    triCloudGovernanceRego,
    unifiedAuditSchemaJson,
    supabaseRlsSql,
    universalGuardrailsTf,
    preflightWorkflowYml
  };
}

export async function triggerDrFailoverProbe(
  action: 'verify_rpo_rto' | 'simulate_aws_outage' | 'restore_aws_primary'
): Promise<TriCloudSandboxState> {
  return withTriCloudMutation((state) => {
    const now = new Date().toISOString();
    const aws = state.regions.find((r) => r.cloud === 'AWS')!;
    const gcp = state.regions.find((r) => r.cloud === 'GCP')!;
    const azure = state.regions.find((r) => r.cloud === 'AZURE')!;

    if (action === 'simulate_aws_outage') {
      aws.status = 'DEGRADED';
      aws.latencyMs = 4200;
      gcp.status = 'ACTIVE_FAILOVER';
      gcp.latencyMs = 19;
      azure.status = 'HEALTHY';
      state.activeDnsTarget = 'GCP';
      state.drProbeHistory.unshift({
        probeId: `probe-${Date.now().toString(36)}`,
        timestampUtc: now,
        trigger: 'SIMULATED_OUTAGE',
        activeDnsTarget: 'GCP (us-central1 / securebase-gcp-dev)',
        rpoSeconds: 4,
        rtoSeconds: 28,
        supabaseReplicationStatus: 'PROMOTED_STANDBY',
        summary: 'Route 53 health check failed 2x on us-east-1; automated DNS failover promoted GCP us-central1 in 28s with 4s RPO.'
      });
    } else if (action === 'restore_aws_primary') {
      aws.status = 'HEALTHY';
      aws.latencyMs = 14;
      gcp.status = 'HEALTHY';
      azure.status = 'HEALTHY';
      state.activeDnsTarget = 'AWS';
      state.drProbeHistory.unshift({
        probeId: `probe-${Date.now().toString(36)}`,
        timestampUtc: now,
        trigger: 'PRIMARY_RESTORE',
        activeDnsTarget: 'AWS (us-east-1)',
        rpoSeconds: 2,
        rtoSeconds: 22,
        supabaseReplicationStatus: 'SYNCED',
        summary: 'AWS us-east-1 ALB passed HTTPS probes; Route 53 primary restored and Supabase WAL replication resynced.'
      });
    } else {
      aws.lastProbedUtc = now;
      gcp.lastProbedUtc = now;
      azure.lastProbedUtc = now;
      state.drProbeHistory.unshift({
        probeId: `probe-${Date.now().toString(36)}`,
        timestampUtc: now,
        trigger: 'SCHEDULED_CLOUD_SCHEDULER',
        activeDnsTarget: state.activeDnsTarget === 'GCP' ? 'GCP (us-central1 / securebase-gcp-dev)' : 'AWS (us-east-1)',
        rpoSeconds: 3,
        rtoSeconds: 26,
        supabaseReplicationStatus: state.activeDnsTarget === 'GCP' ? 'PROMOTED_STANDBY' : 'SYNCED',
        summary: 'Cloud Scheduler + EventBridge DR probe verified RPO 3s (<= 60s target) and RTO 26s (<= 120s target).'
      });
    }

    return state;
  });
}

export async function runUnifiedGovernanceBatch(
  tenantId: string,
  injectDrift: boolean
): Promise<MerkleBatchReceipt> {
  return withTriCloudMutation((state) => {
    const now = new Date().toISOString();
    const events = buildBaselineEvents(injectDrift);
    const leafHashes = events.map((e) => e.eventSha256);
    const merkleRootSha256 = computeMerkleRoot(leafHashes);
    const violations = evaluateTriCloudGovernanceEvents(events);

    const receipt: MerkleBatchReceipt = {
      batchId: `batch-tricloud-${Date.now().toString(36)}`,
      tenantId: tenantId || 'cnb-waxahachie',
      collectedAtUtc: now,
      leafHashes,
      merkleRootSha256,
      wormVaultUrn: 'arn:aws:s3:::securebase-worm-evidence-us-east-1',
      retentionMode: 'COMPLIANCE',
      retentionDays: 2555,
      supabaseRlsSynced: true,
      postureStatus: violations.length === 0 ? 'COMPLIANT' : 'DRIFT_DETECTED',
      violations
    };

    state.merkleBatches.unshift(receipt);
    return receipt;
  });
}

export async function getFinOpsDashboardData(
  cloudFilter?: CloudProviderId | 'ALL',
  tenantFilter?: string
): Promise<TriCloudFinOpsReport> {
  const state = await readTriCloudSandboxState();
  return aggregateTriCloudFinOps(state.driftOverrides, cloudFilter, tenantFilter);
}

export async function remediateIdleDrift(alertId: string): Promise<TriCloudFinOpsReport> {
  const state = await withTriCloudMutation((s) => {
    s.driftOverrides[alertId] = 'REMEDIATED';
    return s;
  });
  return aggregateTriCloudFinOps(state.driftOverrides);
}

export async function simulateGuardrailCheck(input: {
  cloud: CloudProviderId;
  resourceName: string;
  usesStaticKey: boolean;
  publicAccess: boolean;
  cmekEnabled: boolean;
  tlsVersion: string;
}): Promise<GuardrailCheckResult> {
  return withTriCloudMutation((state) => {
    const violated: string[] = [];
    const mechMap: Record<CloudProviderId, string> = {
      AWS: 'AWS Organizations SCP (SecureBase-Universal-ZeroTrust-SCP)',
      GCP: 'GCP Org Policy Constraints (securebase-gcp-dev)',
      AZURE: 'Azure Policy Initiative (securebase-universal-guardrails)'
    };

    if (input.usesStaticKey) violated.push('Zero Static Credentials (OIDC/WIF Mandatory)');
    if (input.publicAccess) violated.push('Deny Public Storage / Ingress Exposure');
    if (!input.cmekEnabled) violated.push('Require Customer-Managed Encryption Key (CMEK)');
    if (input.tlsVersion !== '1.3') violated.push(`Deny Legacy TLS (${input.tlsVersion} < 1.3)`);

    const result: GuardrailCheckResult = {
      checkId: `grd-${Date.now().toString(36)}`,
      timestampUtc: new Date().toISOString(),
      cloud: input.cloud,
      guardrailMechanism: mechMap[input.cloud],
      resourceName: input.resourceName || 'securebase_resource_candidate',
      decision: violated.length > 0 ? 'DENIED_BY_GUARDRAIL' : 'ALLOWED',
      violatedPolicies: violated,
      summary:
        violated.length > 0
          ? `${mechMap[input.cloud]} blocked deployment (${violated.length} violation(s)).`
          : `${mechMap[input.cloud]} permitted deployment (all zero-trust invariants satisfied).`
    };

    state.guardrailHistory.unshift(result);
    return result;
  });
}
