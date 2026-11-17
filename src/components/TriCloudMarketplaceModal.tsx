import React, { useState } from 'react';
import {
  TRI_CLOUD_TIERS,
  TRI_CLOUD_INGESTION_MATRIX,
  TRI_CLOUD_FEDERATION_MATRIX,
  TRI_CLOUD_SPEC_DETAILS,
  TriCloudTier
} from '../data/salesStrategyData';
import {
  Layers,
  CheckCircle2,
  X,
  TrendingUp,
  ShieldCheck,
  Zap,
  Lock,
  Radio,
  RefreshCw,
  Copy,
  Check,
  FileText,
  DollarSign,
  Database,
  Key,
  Sliders,
  Cloud,
  Server,
  Globe,
  ArrowRight,
  ShieldAlert,
  Terminal
} from 'lucide-react';

interface TriCloudMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TriCloudMarketplaceModal: React.FC<TriCloudMarketplaceModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'ingestion' | 'federation' | 'terraform'>('tiers');
  const [selectedTier, setSelectedTier] = useState<TriCloudTier>(TRI_CLOUD_TIERS[1]); // Default to Regional Banking Foundation
  const [activeSimulatorCloud, setActiveSimulatorCloud] = useState<'AWS' | 'GCP' | 'Azure'>('AWS');
  const [isSimulatingEvent, setIsSimulatingEvent] = useState<boolean>(false);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);
  const [activeCommitmentType, setActiveCommitmentType] = useState<'AWS' | 'GCP' | 'Azure'>('AWS');
  const [commitmentAmount, setCommitmentAmount] = useState<number>(500000);
  const [copiedHcl, setCopiedHcl] = useState<boolean>(false);
  const [isExchangingToken, setIsExchangingToken] = useState<boolean>(false);
  const [exchangedTokenInfo, setExchangedTokenInfo] = useState<{
    cloud: string;
    tokenType: string;
    ttl: string;
    identity: string;
    scopes: string;
  } | null>(null);

  if (!isOpen) return null;

  // Drawdown calculations
  const annualCost = selectedTier.annualValue;
  const drawdownPct = Math.min(100, Math.round((annualCost / commitmentAmount) * 1000) / 10);
  const remainingCommitment = Math.max(0, commitmentAmount - annualCost);

  // Simulated Webhook Dispatch across AWS, GCP, Azure
  const handleSimulateWebhook = (cloud: 'AWS' | 'GCP' | 'Azure') => {
    setActiveSimulatorCloud(cloud);
    setIsSimulatingEvent(true);

    if (cloud === 'AWS') {
      setSimulatedLogs([
        `[00:00.002] 📦 Amazon SNS Notification Ingested via SQS Queue (marketplace-entitlements-queue)`,
        `[00:00.007] 🔑 SigV4 Cryptographic Handshake Verified: x-amz-date, Authorization=AWS4-HMAC-SHA256`,
        `[00:00.012] 🔒 Redis Idempotency Gate: SETNX aws_evt_${Date.now()} TTL=86400s -> LOCK_ACQUIRED`,
        `[00:00.019] ⚡ Sub-45ms Ack Profile: SQS message acknowledged & deleted from queue (latency: 18.6ms)`
      ]);
    } else if (cloud === 'GCP') {
      setSimulatedLogs([
        `[00:00.002] 🌐 Google Cloud Pub/Sub Push Received: POST /webhooks/gcp-marketplace/entitlements`,
        `[00:00.006] 🔑 Verifying Google OIDC JWT Bearer token: issuer=accounts.google.com, audience=${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}`,
        `[00:00.012] ✓ JWT Signature valid: sub=service-594006980795@gcp-sa-marketplace.iam.gserviceaccount.com`,
        `[00:00.017] 🔒 Redis Idempotency Gate: SETNX gcp_evt_${Date.now()} TTL=86400s -> LOCK_ACQUIRED`,
        `[00:00.023] ⚡ Sub-45ms Ack Profile: HTTP 200 OK sent to Pub/Sub (latency: 22.8ms)`
      ]);
    } else {
      setSimulatedLogs([
        `[00:00.003] 🔷 Microsoft Azure Marketplace Operations API v2 Webhook Ingested: POST /webhooks/azure/saas`,
        `[00:00.008] 🔑 Microsoft Entra ID Bearer JWT Handshake Verified (Tenant: 72f988bf-86f1-41af-91ab-2d7cd011db47)`,
        `[00:00.014] 🔒 Redis Idempotency Gate: SETNX azure_evt_${Date.now()} TTL=86400s -> LOCK_ACQUIRED`,
        `[00:00.021] ⚡ Sub-45ms Ack Profile: HTTP 200 Accepted sent to Azure Marketplace (latency: 20.4ms)`
      ]);
    }

    setTimeout(() => {
      let activationDetails = '';
      let storageEnforcement = '';
      if (cloud === 'AWS') {
        activationDetails = 'AWS ResolveCustomer called; SNS subscription token verified for tenant cnb-waxahachie';
        storageEnforcement = 'Enforced FFIEC baseline; initialized Amazon S3 Object Lock (7-Year WORM Compliance Mode)';
      } else if (cloud === 'GCP') {
        activationDetails = 'providers.entitlements.approve executed against Google Procurement API';
        storageEnforcement = 'Enforced FFIEC baseline; provisioned GCS Bucket Retention Policy (7-Year Hardware-Locked WORM)';
      } else {
        activationDetails = 'Resolve Token exchanged & /subscriptions/{id}/activate executed against Azure SaaS API';
        storageEnforcement = 'Enforced FFIEC baseline; locked Azure Blob Immutable Storage (Legal/Time-Based Hold)';
      }

      setSimulatedLogs((prev) => [
        ...prev,
        `[00:00.048] 🚀 Async Background Daemon: Dispatching tenant provisioning pipeline for ${selectedTier.name}`,
        `[00:00.076] 📋 Entitlement Activation: ${activationDetails}`,
        `[00:00.108] 🛡️ Tri-Cloud Storage Enforcement: ${storageEnforcement}`,
        `[00:00.134] 📊 Usage Metering Engine: Hooked to ${cloud === 'AWS' ? 'BatchMeterUsage' : cloud === 'GCP' ? 'services.report' : 'POST /api/usageEvents'}`,
        `[00:00.158] ⏰ Daily Split-Brain Cron: Registered at ${cloud === 'AWS' ? '01:30 UTC' : cloud === 'GCP' ? '02:00 UTC' : '02:30 UTC'} for automated reconciliation`,
        `[00:00.179] ✅ Zero-Data-Custody trust established. Monitored workloads bound without static secrets.`
      ]);
      setIsSimulatingEvent(false);
    }, 450);
  };

  // Simulate STS Exchange across Clouds
  const handleExchangeSts = (cloud: 'AWS' | 'GCP' | 'Azure') => {
    setIsExchangingToken(true);
    setTimeout(() => {
      if (cloud === 'AWS') {
        setExchangedTokenInfo({
          cloud: 'Amazon Web Services (AWS)',
          tokenType: 'AWS STS AssumeRoleWithWebIdentity (Temporary Credentials)',
          ttl: '3600 seconds (1 Hour)',
          identity: 'arn:aws:sts::123456789012:assumed-role/SecureBaseAuditorRole/cnb-waxahachie',
          scopes: 'arn:aws:iam::aws:policy/SecurityAudit (Zero S3 GetObject / Zero KMS Decrypt)'
        });
      } else if (cloud === 'GCP') {
        setExchangedTokenInfo({
          cloud: 'Google Cloud Platform (GCP)',
          tokenType: 'Google STS generateAccessToken (OAuth 2.0 Bearer)',
          ttl: '1800 seconds (30 Minutes)',
          identity: `principalSet://iam.googleapis.com/${TRI_CLOUD_SPEC_DETAILS.gcpProject}/attribute.tenant_id/cnb-waxahachie`,
          scopes: 'roles/cloudasset.viewer, roles/securitycenter.adminViewer, roles/monitoring.viewer'
        });
      } else {
        setExchangedTokenInfo({
          cloud: 'Microsoft Azure',
          tokenType: 'Microsoft Entra ID OAuth 2.0 Client Assertion (Federated Identity)',
          ttl: '3600 seconds (1 Hour)',
          identity: 'api://securebase-auditor-sp (Subject: tenant:cnb-waxahachie)',
          scopes: 'Reader, Security Reader (Microsoft Defender for Cloud, Zero Blob Data Reader)'
        });
      }
      setIsExchangingToken(false);
    }, 500);
  };

  const multiCloudTerraform = `# ==============================================================================
# SecureBase Sovereign Tri-Cloud Workload Identity Federation (WIF)
# Platform: Tri-Cloud Unified Marketplace Specification v3.0 (Nov 10, 2026)
# Scope: AWS, Google Cloud & Microsoft Azure
# Philosophy: Zero-Data-Custody & Zero-Static-Secrets across all 3 clouds
# ==============================================================================

# --- 1. AWS INFRASTRUCTURE (IAM OIDC FEDERATION) ---
resource "aws_iam_openid_connect_provider" "securebase_oidc" {
  url             = "${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["9e99a48a9960b14926cc7f3b02e22da2b0ab7280"]
}

resource "aws_iam_role" "securebase_auditor" {
  name = "SecureBaseAuditorRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.securebase_oidc.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}:aud" = "sts.amazonaws.com"
          "${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}:sub" = "tenant:cnb-waxahachie"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "security_audit" {
  role       = aws_iam_role.securebase_auditor.name
  policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}

# --- 2. GOOGLE CLOUD INFRASTRUCTURE (WIF POOL & STS) ---
resource "google_iam_workload_identity_pool" "securebase_pool" {
  workload_identity_pool_id = "securebase-pool"
  display_name              = "SecureBase Sovereign Compliance Pool"
}

resource "google_iam_workload_identity_pool_provider" "securebase_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.securebase_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "securebase-oidc"
  attribute_mapping = {
    "google.subject"      = "assertion.sub"
    "attribute.tenant_id" = "assertion.tenant_id"
  }
  oidc {
    issuer_uri = "${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}"
  }
}

resource "google_project_iam_member" "cloudasset_viewer" {
  project = "securebase-gcp-dev"
  role    = "roles/cloudasset.viewer"
  member  = "serviceAccount:securebase-auditor@securebase-gcp-dev.iam.gserviceaccount.com"
}

# --- 3. MICROSOFT AZURE INFRASTRUCTURE (ENTRA ID FEDERATED CREDENTIALS) ---
resource "azuread_application" "securebase_app" {
  display_name = "SecureBase Zero-Data-Custody Auditor"
}

resource "azuread_application_federated_identity_credential" "securebase_fed" {
  application_object_id = azuread_application.securebase_app.object_id
  name                  = "securebase-oidc-federation"
  description           = "Entra ID federated trust with SecureBase OIDC issuer"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "${TRI_CLOUD_SPEC_DETAILS.oidcIssuer}"
  subject               = "tenant:cnb-waxahachie"
}

resource "azurerm_role_assignment" "reader" {
  scope                = "/subscriptions/00000000-0000-0000-0000-000000000000"
  role_definition_name = "Reader"
  principal_id         = azuread_application.securebase_app.id
}
`;

  const handleCopyHcl = async () => {
    await navigator.clipboard.writeText(multiCloudTerraform);
    setCopiedHcl(true);
    setTimeout(() => setCopiedHcl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 mb-1">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>TXIMHOTEP LLC &middot; MULTI-CLOUD ARCHITECTURE SPEC (TRI-CLOUD SPECIFICATION V3.0)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>SecureBase Tri-Cloud Marketplace Integration Matrix</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono font-medium">
                Complete Architectural Baseline
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Parity Scope: <span className="text-amber-300 font-semibold">AWS Marketplace</span> &middot; <span className="text-blue-300 font-semibold">Google Cloud Marketplace</span> &middot; <span className="text-cyan-300 font-semibold">Microsoft Azure Marketplace</span> &middot; Date: <span className="text-slate-300 font-mono">{TRI_CLOUD_SPEC_DETAILS.date}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Cloud Parity Highlights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-amber-900/40 rounded-xl space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                AWS Marketplace
              </span>
              <span className="text-[10px] text-slate-500">prod-p7z4iqf7gg6dk</span>
            </div>
            <div className="text-xs text-slate-300 pt-1">
              AWS EDP Drawdown &middot; SigV4 SNS/SQS &middot; IAM OIDC Federation &middot; S3 Object Lock 7-Yr WORM
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-blue-900/40 rounded-xl space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                Google Cloud Marketplace
              </span>
              <span className="text-[10px] text-slate-500">#594006980795</span>
            </div>
            <div className="text-xs text-slate-300 pt-1">
              Google EDP Burn &middot; Pub/Sub Sub-45ms Ack &middot; Workload Identity Pool (WIF) &middot; GCS Locked WORM
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-cyan-900/40 rounded-xl space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                Microsoft Azure Marketplace
              </span>
              <span className="text-[10px] text-slate-500">MACC Drawdown</span>
            </div>
            <div className="text-xs text-slate-300 pt-1">
              Microsoft MACC Burn &middot; Entra ID Bearer JWT &middot; Federated Identity Credential &middot; Immutable Blob
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tiers'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>1. Commercial Tier Parity &amp; Commitment Drawdown</span>
          </button>

          <button
            onClick={() => setActiveTab('ingestion')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ingestion'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>2. Ingestion &amp; Webhook Lifecycle Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('federation')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'federation'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>3. Zero-Data-Custody Federation (Side-by-Side)</span>
          </button>

          <button
            onClick={() => setActiveTab('terraform')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'terraform'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. Tri-Cloud Terraform Module</span>
          </button>
        </div>

        {/* TAB 1: Commercial Tier Parity & Commitment Drawdown */}
        {activeTab === 'tiers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {TRI_CLOUD_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedTier.id === tier.id
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span className="text-[10px] font-mono text-slate-400 ml-1">Tri-Cloud</span>
                      </div>
                      {tier.boardSafe && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          &lt; $100k Safe
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm tracking-tight">{tier.name}</h3>
                    <div className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
                      {tier.rateAndTerms}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Commitment: <span className="text-emerald-400 font-semibold">{tier.commitmentBurnEligibility}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{tier.regulatoryScope}</p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span>3-Cloud Parity</span>
                    <span className="text-cyan-400">Select &rarr;</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Multi-Cloud Drawdown Simulator */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-cyan-400 mb-0.5">TIER PARITY &amp; ENTERPRISE COMMITMENT BURN SIMULATOR</div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedTier.name}</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">(${selectedTier.annualValue.toLocaleString()} / year)</span>
                  </h4>
                </div>

                {/* Cloud Commitment Type Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
                  {(['AWS', 'GCP', 'Azure'] as const).map((cloud) => (
                    <button
                      key={cloud}
                      onClick={() => setActiveCommitmentType(cloud)}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        activeCommitmentType === cloud
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cloud === 'AWS' ? 'AWS EDP' : cloud === 'GCP' ? 'Google EDP' : 'Microsoft MACC'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
                {/* Features & Key Inclusions */}
                <div className="space-y-2">
                  <span className="text-slate-400">Standardized Statutory Inclusions:</span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {selectedTier.keyInclusions.map((inc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Interactive Slider */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      {activeCommitmentType === 'AWS' ? 'AWS EDP' : activeCommitmentType === 'GCP' ? 'Google EDP' : 'Microsoft MACC'} Drawdown Calculator
                    </span>
                    <span className="text-emerald-400 font-bold">100% Eligible</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Enterprise Cloud Annual Commitment:</span>
                      <span className="text-white font-bold tabular-nums">${commitmentAmount.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={100000}
                      max={2000000}
                      step={50000}
                      value={commitmentAmount}
                      onChange={(e) => setCommitmentAmount(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>$100k (Community Bank)</span>
                      <span>$500k (Regional Bank)</span>
                      <span>$2M (Large Enterprise)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">SecureBase Annual Burn</span>
                      <span className="text-sm font-bold text-cyan-300 tabular-nums">${annualCost.toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Commitment Drawn Down</span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">{drawdownPct}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Procuring through {activeCommitmentType === 'AWS' ? 'AWS Marketplace Private Offer' : activeCommitmentType === 'GCP' ? 'Google Cloud Marketplace Private Offer' : 'Microsoft Azure Marketplace'} draws down against pre-allocated commitment dollars without exhausting department budget.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Ingestion & Webhook Lifecycle Matrix (Side-by-Side) */}
        {activeTab === 'ingestion' && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 font-mono text-xs">
                <div>
                  <div className="text-cyan-400 mb-0.5">SECTION 2: INGESTION, EVENT LIFECYCLE &amp; WEBHOOK ARCHITECTURE</div>
                  <h4 className="text-base font-bold text-white">Tri-Cloud Side-by-Side Comparison Matrix</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Response Profile:</span>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-bold">
                    Sub-45ms Ack Across All 3 Clouds
                  </span>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">Marketplace Dimension</th>
                      <th className="py-2.5 px-3 w-1/4 text-amber-400">AWS Marketplace</th>
                      <th className="py-2.5 px-3 w-1/4 text-blue-400">Google Cloud Marketplace</th>
                      <th className="py-2.5 px-3 w-1/4 text-cyan-400">Microsoft Azure Marketplace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950 text-slate-300">
                    {TRI_CLOUD_INGESTION_MATRIX.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white bg-slate-900/30">
                          {row.dimension}
                        </td>
                        <td className="py-2.5 px-3 text-amber-200/90">{row.aws}</td>
                        <td className="py-2.5 px-3 text-blue-200/90">{row.gcp}</td>
                        <td className="py-2.5 px-3 text-cyan-200/90">{row.azure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interactive Webhook Simulator */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white">Interactive Tri-Cloud Webhook Dispatch Simulator</span>
                  </div>

                  {/* Cloud Selector for Simulator */}
                  <div className="flex items-center gap-2">
                    {(['AWS', 'GCP', 'Azure'] as const).map((cloud) => (
                      <button
                        key={cloud}
                        onClick={() => handleSimulateWebhook(cloud)}
                        disabled={isSimulatingEvent}
                        className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                          activeSimulatorCloud === cloud && isSimulatingEvent
                            ? 'bg-cyan-400 text-slate-950 border-cyan-400 animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        Simulate {cloud} Webhook
                      </button>
                    ))}
                  </div>
                </div>

                {/* Console Logs */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] max-h-[220px] overflow-y-auto space-y-1">
                  {simulatedLogs.length > 0 ? (
                    simulatedLogs.map((log, i) => (
                      <div
                        key={i}
                        className={
                          log.includes('Sub-45ms')
                            ? 'text-emerald-400 font-semibold'
                            : log.includes('Verified') || log.includes('valid')
                            ? 'text-cyan-300 font-semibold'
                            : log.includes('Enforcement') || log.includes('Storage')
                            ? 'text-purple-300'
                            : 'text-slate-300'
                        }
                      >
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 py-8 text-center">
                      Click any of the "Simulate [Cloud] Webhook" buttons above to trigger live signature authentication, Redis idempotency gating, and sub-45ms entitlement processing.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Zero-Data-Custody Federation (Side-by-Side) */}
        {activeTab === 'federation' && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 font-mono text-xs">
                <div>
                  <div className="text-cyan-400 mb-0.5">SECTION 3: ZERO-DATA-CUSTODY FEDERATION &amp; EPHEMERAL TELEMETRY</div>
                  <h4 className="text-base font-bold text-white">Tri-Cloud Security Attribute Comparison</h4>
                </div>
                <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-bold">
                  Zero Static Secrets &middot; Zero Data-Plane Ingress
                </span>
              </div>

              {/* Side-by-Side Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">Security Attribute</th>
                      <th className="py-2.5 px-3 w-1/4 text-amber-400">AWS Infrastructure</th>
                      <th className="py-2.5 px-3 w-1/4 text-blue-400">Google Cloud Infrastructure</th>
                      <th className="py-2.5 px-3 w-1/4 text-cyan-400">Microsoft Azure Infrastructure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950 text-slate-300">
                    {TRI_CLOUD_FEDERATION_MATRIX.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white bg-slate-900/30">
                          {row.dimension}
                        </td>
                        <td className="py-2.5 px-3 text-amber-200/90">{row.aws}</td>
                        <td className="py-2.5 px-3 text-blue-200/90">{row.gcp}</td>
                        <td className="py-2.5 px-3 text-cyan-200/90">{row.azure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ephemeral STS Simulator */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-cyan-400" />
                    Interactive Ephemeral STS Credential Exchange
                  </span>

                  <div className="flex items-center gap-2">
                    {(['AWS', 'GCP', 'Azure'] as const).map((cloud) => (
                      <button
                        key={cloud}
                        onClick={() => handleExchangeSts(cloud)}
                        disabled={isExchangingToken}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Exchange {cloud} STS
                      </button>
                    ))}
                  </div>
                </div>

                {exchangedTokenInfo && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 text-[11px] animate-fadeIn">
                    <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Ephemeral Session Established for {exchangedTokenInfo.cloud} (TTL: {exchangedTokenInfo.ttl})
                    </div>
                    <div className="text-slate-400">
                      Token Exchange Type: <code className="text-cyan-300">{exchangedTokenInfo.tokenType}</code>
                    </div>
                    <div className="text-slate-400">
                      Federated Identity: <code className="text-slate-200">{exchangedTokenInfo.identity}</code>
                    </div>
                    <div className="text-slate-400">
                      Metadata Scopes: <code className="text-purple-300">{exchangedTokenInfo.scopes}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Tri-Cloud Terraform Module */}
        {activeTab === 'terraform' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">terraform/tri_cloud_federation.tf (AWS + GCP + Azure)</span>
              <button
                onClick={handleCopyHcl}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors cursor-pointer"
              >
                {copiedHcl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied HCL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Multi-Cloud Terraform HCL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto text-[11px] text-cyan-300/90 leading-relaxed max-h-[360px]">
              <code>{multiCloudTerraform}</code>
            </pre>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Tri-Cloud Unified Parity v3.0 &middot; AWS EDP, Google EDP &amp; Microsoft MACC Eligible</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
