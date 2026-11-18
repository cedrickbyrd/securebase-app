import React, { useState, useEffect } from 'react';
import { ProviderToggle } from './ProviderToggle';
import { trackDemoEvent } from '../telemetry/demoBeacon';

const SAMPLE_COMPLIANCE_FALLBACK = {
  tenant: 'demo',
  overallScore: 98,
  timestamp: new Date().toISOString(),
  frameworks: {
    ffiec: { score: 98, passing: 42, total: 43 },
    soc2: { score: 100, passing: 64, total: 64 },
    hipaa: { score: 96, passing: 38, total: 40 }
  },
  controls: [
    {
      id: 'FFIEC-D-2-B',
      name: 'S3 Bucket Public Access Block & Object Lock Verification',
      framework: 'ffiec-cat',
      status: 'PENDING_S3_SYNC',
      severity: 'HIGH',
      category: 'Storage Security & WORM Compliance',
      summary: 'Terraform resource aws_s3_bucket.audit_vault lacks Object Lock retention.',
      remediation: ['Set enable_object_lock = true in module.audit_vault']
    }
  ]
};

const PROVIDER_CONFIG = {
  aws: {
    label: 'AWS Commercial & Gov',
    projectRef: 'aws-prod-account-8841',
    wormVaultUri: 's3://prod-audit-records-2026',
    lockMode: 'S3 Object Lock (COMPLIANCE · 7-Year Retention)',
    finding: {
      id: 'FFIEC-D-2-B',
      title: 'S3 Bucket Public Access Block & Object Lock Verification',
      severity: 'HIGH',
      resource: 'aws_s3_bucket.audit_vault',
      summary: 'Enforce 7-year immutable WORM retention policy and KMS CMK encryption.'
    }
  },
  gcp: {
    label: 'Google Cloud (GCP)',
    projectRef: 'securebase-gcp-dev (#594006980795)',
    wormVaultUri: 'gs://prod-audit-records-2026',
    lockMode: 'GCS Bucket Lock + CMEK Dual-Custody Attestation',
    finding: {
      id: 'SEC-GCP-001',
      title: 'GCS Audit Bucket Retention Lock & VPC Service Controls Perimeter',
      severity: 'HIGH',
      resource: 'google_storage_bucket.audit_records_2026',
      summary: 'Enforce locked retention policy and restrict cross-project telemetry egress via VPC-SC.'
    }
  }
};

export const Compliance = () => {
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('aws');
  const [remediatedIds, setRemediatedIds] = useState({});

  const urlParams = new URLSearchParams(window.location.search);
  const utmDomain = urlParams.get('utm_source') || urlParams.get('tenant') || 'enterprise-prospect';

  useEffect(() => {
    async function loadComplianceHistory() {
      const tenantParam = urlParams.get('tenant') || 'demo';
      const endpoint = `https://api.securebase.tximhotep.com/api/v1/compliance/history?tenant=${encodeURIComponent(tenantParam)}&framework=all&days=90`;

      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Compliance endpoint returned non-200 status`);
        }

        const data = await response.json();
        setComplianceData(data);
      } catch (error) {
        console.warn('[SecureBase] Network/CORS exception caught. Hydrating institutional fallback data:', error);
        setComplianceData(SAMPLE_COMPLIANCE_FALLBACK);
      } finally {
        setLoading(false);
      }
    }

    loadComplianceHistory();
  }, []);

  const activeProviderConfig = PROVIDER_CONFIG[provider];
  const isCurrentFindingRemediated = Boolean(remediatedIds[activeProviderConfig.finding.id]);
  const displayScore = isCurrentFindingRemediated ? 100 : (complianceData?.overallScore || 98);

  const handleSimulatedRemediation = () => {
    const findingId = activeProviderConfig.finding.id;
    setRemediatedIds((prev) => ({ ...prev, [findingId]: true }));
    trackDemoEvent('SIMULATED_REMEDIATION_TRIGGERED', {
      provider,
      domain: utmDomain,
      findingId,
      vaultUri: activeProviderConfig.wormVaultUri
    });
  };

  const handleMarketplaceClick = () => {
    trackDemoEvent('MARKETPLACE_CTA_CLICKED', {
      provider,
      domain: utmDomain,
      marketplace: 'gcp-marketplace',
      productSlug: 'tximhotep-public/securebase'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-emerald-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Posture Overview</h1>
          <p className="text-sm text-gray-500">
            Framework controls and shift-left audit vault status · <span className="font-mono">{activeProviderConfig.projectRef}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <ProviderToggle
            currentProvider={provider}
            onProviderChange={setProvider}
            domain={utmDomain}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Overall Score:</span>
            <span className="text-2xl font-bold text-emerald-600">{displayScore}%</span>
          </div>
        </div>
      </div>

      {/* Framework Posture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(complianceData?.frameworks || {}).map(([key, val]) => (
          <div key={key} className="bg-white p-4 rounded-lg border shadow-sm">
            <h3 className="font-semibold text-gray-800 uppercase">{key}</h3>
            <p className="text-2xl font-bold mt-2">{val.score}%</p>
          </div>
        ))}
      </div>

      {/* Active Provider WORM Vault & OPA Drift Remediation Panel */}
      <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
              Immutable WORM Evidence Vault ({activeProviderConfig.label})
            </span>
            <p className="text-lg font-mono font-semibold mt-1">{activeProviderConfig.wormVaultUri}</p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            {activeProviderConfig.lockMode}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                {activeProviderConfig.finding.id}
              </span>
              <span className="font-semibold text-sm">{activeProviderConfig.finding.title}</span>
            </div>
            <p className="text-xs text-slate-400">{activeProviderConfig.finding.summary}</p>
            <p className="text-xs font-mono text-slate-500">Resource: {activeProviderConfig.finding.resource}</p>
          </div>

          <button
            type="button"
            data-testid={`remediate-btn-${activeProviderConfig.finding.id}`}
            onClick={handleSimulatedRemediation}
            disabled={isCurrentFindingRemediated}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isCurrentFindingRemediated
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            {isCurrentFindingRemediated ? '✓ OPA Policy Enforced' : 'Simulate OPA Auto-Remediation'}
          </button>
        </div>
      </div>

      {/* Pre-Footer Enterprise Conversion Band */}
      <section className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-6 text-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
            Zero-Data-Custody Multi-Cloud Governance · {utmDomain}
          </span>
          <h2 className="text-xl font-bold">
            Deploy SecureBase Directly Into Your Cloud Billing Perimeter
          </h2>
          <p className="text-sm text-slate-300">
            Provision keyless OIDC/WIF compliance automation with 7-year WORM audit evidence directly through Google Cloud Marketplace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://console.cloud.google.com/marketplace/product/tximhotep-public/securebase"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleMarketplaceClick}
            className="px-5 py-2.5 rounded-lg bg-[#4285F4] hover:bg-blue-500 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            Deploy via Google Cloud Marketplace →
          </a>
        </div>
      </section>
    </div>
  );
};

export default Compliance;
