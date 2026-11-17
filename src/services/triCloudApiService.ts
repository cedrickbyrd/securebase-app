export type CloudProviderId = 'AWS' | 'GCP' | 'AZURE';

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

export interface CloudSpendSlice {
  cloud: CloudProviderId;
  accountOrProject: string;
  wifIdentity: string;
  computeUsd: number;
  wormStorageUsd: number;
  kmsCryptoUsd: number;
  networkFailoverUsd: number;
  totalUsd: number;
  budgetCapUsd: number;
}

export interface TenantUnitEconomics {
  tenantId: string;
  tenantName: string;
  tier: 'Community FinTech' | 'Regional Bank Foundation' | 'Enterprise Healthcare';
  primaryCloud: CloudProviderId;
  scansExecuted: number;
  monthlyInfraCostUsd: number;
  monthlyRevenueUsd: number;
  costPerScanUsd: number;
  grossMarginPct: number;
}

export interface IdleResourceDriftAlert {
  alertId: string;
  cloud: CloudProviderId;
  resourceId: string;
  region: string;
  reason: string;
  monthlyWasteUsd: number;
  status: 'OPEN' | 'REMEDIATED';
  detectedAtUtc: string;
}

export interface MarketplaceMeteringRow {
  marketplace: 'AWS Marketplace' | 'GCP Marketplace' | 'Azure Marketplace';
  offerId: string;
  edpCommitmentUsd: number;
  meteredDrawdownUsd: number;
  unreconciledDeltaUsd: number;
  lastMeteredUtc: string;
  authProtocol: 'AWS_STS_OIDC' | 'GCP_WIF_594006980795' | 'AZURE_ENTRA_FEDERATED';
}

export interface TriCloudFinOpsReport {
  generatedAtUtc: string;
  totalMonthlySpendUsd: number;
  totalMonthlyRevenueUsd: number;
  blendedCostPerScanUsd: number;
  blendedGrossMarginPct: number;
  cloudSpend: CloudSpendSlice[];
  tenantUnitEconomics: TenantUnitEconomics[];
  idleDriftAlerts: IdleResourceDriftAlert[];
  marketplaceMetering: MarketplaceMeteringRow[];
}

export interface TriCloudArtifactsBundle {
  drFailoverTf: string;
  triCloudGovernanceRego: string;
  unifiedAuditSchemaJson: string;
  supabaseRlsSql: string;
  universalGuardrailsTf: string;
  preflightWorkflowYml: string;
}

export interface TriCloudStateResponse {
  sandbox: {
    activeDnsTarget: CloudProviderId;
    regions: FailoverEndpointHealth[];
    drProbeHistory: DrProbeEvent[];
    merkleBatches: MerkleBatchReceipt[];
    guardrailHistory: GuardrailCheckResult[];
    lastUpdatedUtc: string;
  };
  finops: TriCloudFinOpsReport;
  artifacts: TriCloudArtifactsBundle;
}

export async function fetchTriCloudState(): Promise<TriCloudStateResponse> {
  const res = await fetch('/api/tricloud/state');
  if (!res.ok) throw new Error('Failed to load Tri-Cloud Ops state');
  return res.json();
}

export async function triggerDrProbeViaApi(
  action: 'verify_rpo_rto' | 'simulate_aws_outage' | 'restore_aws_primary'
) {
  const res = await fetch('/api/tricloud/dr/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!res.ok) throw new Error('DR probe failed');
  return res.json();
}

export async function evaluateUnifiedGovernanceViaApi(tenantId: string, injectDrift: boolean) {
  const res = await fetch('/api/tricloud/gov/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, injectDrift })
  });
  if (!res.ok) throw new Error('Unified governance evaluation failed');
  return res.json();
}

export async function fetchFilteredFinOpsViaApi(cloud: CloudProviderId | 'ALL', tenant: string) {
  const res = await fetch(
    `/api/tricloud/finops?cloud=${encodeURIComponent(cloud)}&tenant=${encodeURIComponent(tenant)}`
  );
  if (!res.ok) throw new Error('FinOps query failed');
  return res.json() as Promise<{ finops: TriCloudFinOpsReport }>;
}

export async function remediateIdleDriftViaApi(alertId: string) {
  const res = await fetch('/api/tricloud/finops/drift-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId })
  });
  if (!res.ok) throw new Error('Failed to remediate idle drift');
  return res.json() as Promise<{ finops: TriCloudFinOpsReport }>;
}

export async function simulateGuardrailViaApi(input: {
  cloud: CloudProviderId;
  resourceName: string;
  usesStaticKey: boolean;
  publicAccess: boolean;
  cmekEnabled: boolean;
  tlsVersion: string;
}) {
  const res = await fetch('/api/tricloud/guardrails/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error('Guardrail simulation failed');
  return res.json();
}

export async function resetTriCloudViaApi() {
  const res = await fetch('/api/tricloud/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error('Tri-cloud reset failed');
  return res.json();
}
