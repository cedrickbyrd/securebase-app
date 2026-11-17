export type CloudProviderId = 'AWS' | 'GCP' | 'AZURE';

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

export function aggregateTriCloudFinOps(
  driftOverrides: Record<string, 'OPEN' | 'REMEDIATED'> = {},
  cloudFilter?: CloudProviderId | 'ALL',
  tenantFilter?: string
): TriCloudFinOpsReport {
  const allCloudSpend: CloudSpendSlice[] = [
    {
      cloud: 'AWS',
      accountOrProject: 'prod-p7z4iqf7gg6dk (us-east-1)',
      wifIdentity: 'arn:aws:iam::594006980795:role/SecureBaseFinOpsOidc',
      computeUsd: 1840,
      wormStorageUsd: 620,
      kmsCryptoUsd: 215,
      networkFailoverUsd: 390,
      totalUsd: 3065,
      budgetCapUsd: 4000
    },
    {
      cloud: 'GCP',
      accountOrProject: 'securebase-gcp-dev (594006980795)',
      wifIdentity: 'finops-reader@securebase-gcp-dev.iam.gserviceaccount.com',
      computeUsd: 1120,
      wormStorageUsd: 340,
      kmsCryptoUsd: 145,
      networkFailoverUsd: 210,
      totalUsd: 1815,
      budgetCapUsd: 2500
    },
    {
      cloud: 'AZURE',
      accountOrProject: 'sub-tximhotep-eastus (MACC)',
      wifIdentity: 'mi-securebase-finops-eastus (Federated)',
      computeUsd: 890,
      wormStorageUsd: 280,
      kmsCryptoUsd: 110,
      networkFailoverUsd: 185,
      totalUsd: 1465,
      budgetCapUsd: 2200
    }
  ];

  const allTenants: TenantUnitEconomics[] = [
    {
      tenantId: 'cnb-waxahachie',
      tenantName: 'Citizens National Bank of Texas',
      tier: 'Regional Bank Foundation',
      primaryCloud: 'AWS',
      scansExecuted: 18420,
      monthlyInfraCostUsd: 2140,
      monthlyRevenueUsd: 12500,
      costPerScanUsd: 0.12,
      grossMarginPct: 82.9
    },
    {
      tenantId: 'texas-regional-health',
      tenantName: 'Baylor Edge Clinical Consortium',
      tier: 'Enterprise Healthcare',
      primaryCloud: 'GCP',
      scansExecuted: 14250,
      monthlyInfraCostUsd: 1790,
      monthlyRevenueUsd: 15000,
      costPerScanUsd: 0.13,
      grossMarginPct: 88.1
    },
    {
      tenantId: 'meridian-fed-fin',
      tenantName: 'Meridian Treasury Services',
      tier: 'Community FinTech',
      primaryCloud: 'AZURE',
      scansExecuted: 8940,
      monthlyInfraCostUsd: 1120,
      monthlyRevenueUsd: 6500,
      costPerScanUsd: 0.13,
      grossMarginPct: 82.8
    }
  ];

  const rawAlerts: IdleResourceDriftAlert[] = [
    {
      alertId: 'drift-aws-nat-idle-01',
      cloud: 'AWS',
      resourceId: 'nat-09f8a221c (us-east-1b standby)',
      region: 'us-east-1',
      reason: 'Zero packet throughput for 14 days outside active DR drill window',
      monthlyWasteUsd: 165,
      status: driftOverrides['drift-aws-nat-idle-01'] || 'OPEN',
      detectedAtUtc: '2026-11-16T22:10:00Z'
    },
    {
      alertId: 'drift-gcp-unattached-pd-02',
      cloud: 'GCP',
      resourceId: 'disk-ci-runner-cache-04 (securebase-gcp-dev)',
      region: 'us-central1',
      reason: 'Unattached SSD persistent volume left by ephemeral runner timeout',
      monthlyWasteUsd: 92,
      status: driftOverrides['drift-gcp-unattached-pd-02'] || 'OPEN',
      detectedAtUtc: '2026-11-17T03:45:00Z'
    },
    {
      alertId: 'drift-azure-pip-unused-03',
      cloud: 'AZURE',
      resourceId: 'pip-dr-staging-eastus',
      region: 'eastus',
      reason: 'Unassociated Standard Static IP allocated outside Traffic Manager pool',
      monthlyWasteUsd: 48,
      status: driftOverrides['drift-azure-pip-unused-03'] || 'OPEN',
      detectedAtUtc: '2026-11-17T06:12:00Z'
    }
  ];

  const marketplaceMetering: MarketplaceMeteringRow[] = [
    {
      marketplace: 'AWS Marketplace',
      offerId: 'prod-p7z4iqf7gg6dk',
      edpCommitmentUsd: 500000,
      meteredDrawdownUsd: 150000,
      unreconciledDeltaUsd: 0,
      lastMeteredUtc: '2026-11-17T08:00:00Z',
      authProtocol: 'AWS_STS_OIDC'
    },
    {
      marketplace: 'GCP Marketplace',
      offerId: 'securebase-gcp-dev / 594006980795',
      edpCommitmentUsd: 350000,
      meteredDrawdownUsd: 180000,
      unreconciledDeltaUsd: 0,
      lastMeteredUtc: '2026-11-17T08:00:00Z',
      authProtocol: 'GCP_WIF_594006980795'
    },
    {
      marketplace: 'Azure Marketplace',
      offerId: 'tximhotep-securebase-macc-v3',
      edpCommitmentUsd: 250000,
      meteredDrawdownUsd: 78000,
      unreconciledDeltaUsd: 0,
      lastMeteredUtc: '2026-11-17T08:00:00Z',
      authProtocol: 'AZURE_ENTRA_FEDERATED'
    }
  ];

  const cloudSpend =
    cloudFilter && cloudFilter !== 'ALL'
      ? allCloudSpend.filter((c) => c.cloud === cloudFilter)
      : allCloudSpend;

  const tenantUnitEconomics = allTenants.filter((t) => {
    if (cloudFilter && cloudFilter !== 'ALL' && t.primaryCloud !== cloudFilter) return false;
    if (tenantFilter && tenantFilter !== 'ALL' && t.tenantId !== tenantFilter) return false;
    return true;
  });

  const idleDriftAlerts =
    cloudFilter && cloudFilter !== 'ALL'
      ? rawAlerts.filter((a) => a.cloud === cloudFilter)
      : rawAlerts;

  const totalMonthlySpendUsd = cloudSpend.reduce((sum, c) => sum + c.totalUsd, 0);
  const totalMonthlyRevenueUsd = tenantUnitEconomics.reduce((sum, t) => sum + t.monthlyRevenueUsd, 0);
  const totalScans = tenantUnitEconomics.reduce((sum, t) => sum + t.scansExecuted, 0);
  const totalTenantCost = tenantUnitEconomics.reduce((sum, t) => sum + t.monthlyInfraCostUsd, 0);

  return {
    generatedAtUtc: new Date().toISOString(),
    totalMonthlySpendUsd,
    totalMonthlyRevenueUsd,
    blendedCostPerScanUsd: totalScans > 0 ? Math.round((totalTenantCost / totalScans) * 1000) / 1000 : 0,
    blendedGrossMarginPct:
      totalMonthlyRevenueUsd > 0
        ? Math.round(((totalMonthlyRevenueUsd - totalTenantCost) / totalMonthlyRevenueUsd) * 1000) / 10
        : 0,
    cloudSpend,
    tenantUnitEconomics,
    idleDriftAlerts,
    marketplaceMetering
  };
}
