import React, { useState } from 'react';
import {
  GCP_MARKETPLACE_TIERS,
  GCP_SPECIFICATION_DETAILS,
  GcpMarketplaceTier
} from '../data/salesStrategyData';
import {
  Cloud,
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
  Sliders
} from 'lucide-react';

interface GcpMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GcpMarketplaceModal: React.FC<GcpMarketplaceModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'pubsub' | 'wif' | 'metering' | 'terraform'>('tiers');
  const [selectedTier, setSelectedTier] = useState<GcpMarketplaceTier>(GCP_MARKETPLACE_TIERS[1]);
  const [edpCommitment, setEdpCommitment] = useState<number>(500000);
  const [isSimulatingEvent, setIsSimulatingEvent] = useState<boolean>(false);
  const [simulatedEventLogs, setSimulatedEventLogs] = useState<string[]>([]);
  const [selectedPubSubPlan, setSelectedPubSubPlan] = useState<string>('securebase-banking-foundation');
  const [stsTokenGenerated, setStsTokenGenerated] = useState<boolean>(false);
  const [isGeneratingSts, setIsGeneratingSts] = useState<boolean>(false);
  const [copiedHcl, setCopiedHcl] = useState<boolean>(false);

  if (!isOpen) return null;

  const annualCost = selectedTier.sku === 'securebase-assessment-wedge'
    ? 3500
    : selectedTier.sku === 'securebase-banking-foundation'
    ? 96000
    : 180000;
  const edpDrawdownPct = Math.min(100, Math.round((annualCost / edpCommitment) * 1000) / 10);

  const handleSimulatePubSub = () => {
    setIsSimulatingEvent(true);
    setSimulatedEventLogs([
      `[00:00.002] 🌐 Google Cloud Pub/Sub Push: POST /webhooks/gcp-marketplace/entitlements`,
      `[00:00.006] 🔑 Verifying Google OIDC JWT Bearer token: issuer=accounts.google.com`,
      `[00:00.012] ✓ JWT Signature valid: sub=service-594006980795@gcp-sa-marketplace.iam.gserviceaccount.com`,
      `[00:00.018] 🔒 Redis Idempotency Gate: SETNX event_gcp_${Date.now()} TTL=86400s -> LOCK_ACQUIRED`,
      `[00:00.024] ⚡ Sub-45ms Ack Profile: HTTP 200 OK sent to Pub/Sub (latency: 24.1ms)`
    ]);

    setTimeout(() => {
      let planAction = '';
      let enforcement = '';
      if (selectedPubSubPlan === 'securebase-banking-foundation') {
        planAction = 'Auto-approve via providers.entitlements.approve';
        enforcement = 'Enforces FFIEC AIO & GLBA 501B baseline; configures GCS 7-year hardware-locked WORM bucket';
      } else if (selectedPubSubPlan === 'securebase-healthcare-enterprise') {
        planAction = 'Auto-approve via providers.entitlements.approve';
        enforcement = 'Activates HIPAA § 164.312 safeguards, Cloud KMS CMEK envelope encryption, and 6-year retention';
      } else if (selectedPubSubPlan === 'securebase-sovereign-enterprise') {
        planAction = 'Custom private offer activation dispatched';
        enforcement = 'Initializes multi-cloud federation across AWS, GCP, and Azure; binds customer Rego policy modules';
      } else {
        planAction = 'System alert logged to ledger; state set to SUSPENDED';
        enforcement = 'Revokes OIDC trust, freezes background compliance scans; preserves immutable 7-year WORM audit evidence';
      }

      setSimulatedEventLogs((prev) => [
        ...prev,
        `[00:00.052] 🚀 Async Background Worker: Ingesting Entitlement Event [${selectedPubSubPlan}]`,
        `[00:00.078] 📋 Procurement API Action: ${planAction}`,
        `[00:00.114] 🛡️ SecureBase Enforcement: ${enforcement}`,
        `[00:00.142] 🔗 Supabase Operational Ledger: Recorded state transition in public.tenant_entitlements`,
        `[00:00.160] ✅ Entitlement lifecycle event fully processed and bound to WIF pool.`
      ]);
      setIsSimulatingEvent(false);
    }, 400);
  };

  const handleExchangeStsToken = () => {
    setIsGeneratingSts(true);
    setTimeout(() => {
      setStsTokenGenerated(true);
      setIsGeneratingSts(false);
    }, 500);
  };

  const terraformHclCode = `# SecureBase Workload Identity Federation (WIF) & Least-Privilege Setup
# Platform: GCP Marketplace Integration (Rev v2.3)
# Project: ${GCP_SPECIFICATION_DETAILS.projectId} (#${GCP_SPECIFICATION_DETAILS.projectNumber})
# Zero-Data-Custody: Eliminates static service account keys (credentials.json)

# 1. Customer Workload Identity Pool
resource "google_iam_workload_identity_pool" "securebase_pool" {
  workload_identity_pool_id = "securebase-pool"
  display_name              = "SecureBase Sovereign Compliance Pool"
  description               = "Zero-static-secret OIDC federation for SecureBase audit engine"
  disabled                  = false
}

# 2. SecureBase OIDC Provider Binding
resource "google_iam_workload_identity_pool_provider" "securebase_oidc" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.securebase_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "securebase-oidc"
  display_name                       = "SecureBase TxImhotep OIDC Provider"
  
  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.tenant_id"        = "assertion.tenant_id"
    "attribute.repository"       = "assertion.repository"
    "attribute.enclave_type"     = "assertion.enclave_type"
  }

  oidc {
    issuer_uri = "${GCP_SPECIFICATION_DETAILS.oidcIssuer}"
    allowed_audiences = [
      "https://iam.googleapis.com/${GCP_SPECIFICATION_DETAILS.wifPool}"
    ]
  }

  attribute_condition = "assertion.tenant_id != ''"
}

# 3. Least-Privilege Read-Only Service Account (Zero Data-Plane Access)
resource "google_service_account" "securebase_auditor" {
  account_id   = "securebase-auditor-sa"
  display_name = "SecureBase Metadata Auditor (Read-Only)"
  description  = "Strictly restricted to metadata discovery. Customer data plane access is PROHIBITED."
}

# 4. Mandatory Least-Privilege Metadata Scopes (FFIEC & HIPAA Certified)
resource "google_project_iam_member" "cloudasset_viewer" {
  project = "${GCP_SPECIFICATION_DETAILS.projectId}"
  role    = "roles/cloudasset.viewer"
  member  = "serviceAccount:\${google_service_account.securebase_auditor.email}"
}

resource "google_project_iam_member" "scc_viewer" {
  project = "${GCP_SPECIFICATION_DETAILS.projectId}"
  role    = "roles/securitycenter.adminViewer"
  member  = "serviceAccount:\${google_service_account.securebase_auditor.email}"
}

resource "google_project_iam_member" "monitoring_viewer" {
  project = "${GCP_SPECIFICATION_DETAILS.projectId}"
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:\${google_service_account.securebase_auditor.email}"
}

# 5. STS Impersonation Binding for Verified Tenant Only
resource "google_service_account_iam_member" "wif_impersonation" {
  service_account_id = google_service_account.securebase_auditor.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/\${google_iam_workload_identity_pool.securebase_pool.name}/attribute.tenant_id/cnb-waxahachie"
}`;

  const handleCopyHcl = async () => {
    await navigator.clipboard.writeText(terraformHclCode);
    setCopiedHcl(true);
    setTimeout(() => setCopiedHcl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header Section */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 mb-1">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>TXIMHOTEP LLC &middot; ARCHITECTURE SPEC REV {GCP_SPECIFICATION_DETAILS.revision}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>SecureBase GCP Marketplace Integration</span>
              <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded font-mono font-medium">
                Google Cloud Partner Advantage
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Platform: <span className="text-cyan-300 font-mono font-semibold">SecureBase</span> &middot; Project ID: <span className="text-slate-200 font-mono font-semibold">{GCP_SPECIFICATION_DETAILS.projectId} (#{GCP_SPECIFICATION_DETAILS.projectNumber})</span> &middot; Date: <span className="text-slate-300 font-mono">{GCP_SPECIFICATION_DETAILS.date}</span>
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

        {/* Executive Highlights Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Procurement Channel</span>
            <div className="text-sm font-bold text-cyan-300">GCP Marketplace</div>
            <span className="text-[10px] text-slate-500">Private Offer / EDP Burn</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Regional Bank Parity</span>
            <div className="text-sm font-bold text-emerald-400">$8,000 / mo ($96k/yr)</div>
            <span className="text-[10px] text-emerald-400/90">&lt; $100k Board Approval Safe</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Credential Architecture</span>
            <div className="text-sm font-bold text-purple-400">Zero Static Secrets</div>
            <span className="text-[10px] text-slate-500">Workload Identity (WIF)</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Webhook SLA Profile</span>
            <div className="text-sm font-bold text-amber-400">Sub-45ms Ack</div>
            <span className="text-[10px] text-slate-500">Pub/Sub + Redis Gate</span>
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
            <span>1. Commercial Tiers &amp; EDP Burn</span>
          </button>

          <button
            onClick={() => setActiveTab('pubsub')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pubsub'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>2. Pub/Sub Ingestion &amp; Routing</span>
          </button>

          <button
            onClick={() => setActiveTab('wif')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'wif'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>3. Workload Identity (WIF)</span>
          </button>

          <button
            onClick={() => setActiveTab('metering')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'metering'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>4. Metering &amp; Reconciliation</span>
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
            <span>5. Terraform HCL Config</span>
          </button>
        </div>

        {/* TAB 1: Commercial Tiers & Google EDP Burn Calculator */}
        {activeTab === 'tiers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {GCP_MARKETPLACE_TIERS.map((tier) => (
                <div
                  key={tier.sku}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedTier.sku === tier.sku
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {tier.billingMode}
                      </span>
                      {tier.boardThresholdSafe && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          &lt; $100k Safe
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm tracking-tight">{tier.name}</h3>
                    <div className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
                      {tier.pricePoint}
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{tier.operationalScope}</p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span>SKU: {tier.sku}</span>
                    <span className="text-cyan-400">Select &rarr;</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Tier Deep-Dive & EDP Drawdown Calculator */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-cyan-400 mb-0.5">SELECTED GCP MARKETPLACE OFFER</div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedTier.name}</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">({selectedTier.annualEquivalent})</span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Procurement API:</span>
                  <code className="text-xs font-mono px-2 py-1 bg-slate-900 border border-slate-800 rounded text-purple-300">
                    {selectedTier.procurementAction}
                  </code>
                </div>
              </div>

              {/* Scope & Features List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-400">Operational Inclusions &amp; Safeguards:</span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedTier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Google Cloud Enterprise Discount Program (EDP) Burn Simulator */}
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Google EDP Commitment Burn Simulator
                    </span>
                    <span className="text-[11px] text-emerald-400">100% Drawdown Eligible</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Customer Annual Google EDP Commit:</span>
                      <span className="text-white font-bold tabular-nums">${edpCommitment.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={100000}
                      max={2000000}
                      step={50000}
                      value={edpCommitment}
                      onChange={(e) => setEdpCommitment(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>$100k (Community Bank)</span>
                      <span>$500k (Regional Bank)</span>
                      <span>$2M (Large Healthcare)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">SecureBase Annual Burn</span>
                      <span className="text-sm font-bold text-cyan-300 tabular-nums">${annualCost.toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">EDP Drawdown Share</span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">{edpDrawdownPct}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    By purchasing via GCP Marketplace Private Offer, 100% of the invoice counts toward the customer's Google Cloud commitment, eliminating new net-budget procurement cycles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Pub/Sub Event Ingestion & Webhook Router Simulator */}
        {activeTab === 'pubsub' && (
          <div className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-cyan-400 mb-0.5">SECTION 2: EVENT INGESTION &amp; PLAN-AWARE ROUTING</div>
                  <h4 className="text-base font-bold text-white">Google Cloud Pub/Sub Webhook Processor</h4>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-400">Response SLA:</span>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-bold">
                    Sub-45ms Ack
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Event Dispatch Controls */}
                <div className="lg:col-span-5 space-y-3 font-mono text-xs">
                  <label className="text-slate-300 font-semibold block">Select Entitlement Transition Event:</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'securebase-banking-foundation', label: 'securebase-banking-foundation (Auto-approve)' },
                      { id: 'securebase-healthcare-enterprise', label: 'securebase-healthcare-enterprise (Auto-approve)' },
                      { id: 'securebase-sovereign-enterprise', label: 'securebase-sovereign-enterprise (Private Offer)' },
                      { id: 'ENTITLEMENT_SUSPENDED', label: 'ENTITLEMENT_SUSPENDED / CANCELLED (Revoke WIF)' }
                    ].map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPubSubPlan(plan.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          selectedPubSubPlan === plan.id
                            ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {plan.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleSimulatePubSub}
                      disabled={isSimulatingEvent}
                      className="w-full py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-cyan-400/20 disabled:opacity-50"
                    >
                      {isSimulatingEvent ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Ingestion Event...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-current" />
                          <span>Simulate Pub/Sub Push Webhook</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Architecture Badges */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>OIDC JWT Authentication (Google Issuer)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Database className="w-3.5 h-3.5 text-purple-400" />
                      <span>Redis Idempotency Gating (TTL: 86,400s)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>7-Year Immutable WORM Ledger Binding</span>
                    </div>
                  </div>
                </div>

                {/* Console Log Window */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-hidden flex flex-col justify-between">
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                    <div className="text-[11px] text-slate-500 pb-1 border-b border-slate-800/80 flex items-center justify-between">
                      <span>CONSOLE: /webhooks/gcp-marketplace/entitlements</span>
                      <span className="text-emerald-400">LISTENING</span>
                    </div>
                    {simulatedEventLogs.length > 0 ? (
                      simulatedEventLogs.map((log, i) => (
                        <div
                          key={i}
                          className={
                            log.includes('Sub-45ms')
                              ? 'text-emerald-400 font-semibold'
                              : log.includes('Procurement')
                              ? 'text-cyan-300 font-semibold'
                              : log.includes('Enforcement')
                              ? 'text-purple-300'
                              : 'text-slate-300'
                          }
                        >
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 py-12 text-center">
                        Select an entitlement transition above and click "Simulate Pub/Sub Push Webhook" to execute the sub-45ms ingress cycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Workload Identity Federation (WIF) & Ephemeral STS */}
        {activeTab === 'wif' && (
          <div className="space-y-5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs text-cyan-400 mb-0.5">SECTION 3: ACCOUNT PROVISIONING &amp; WIF</div>
                  <h4 className="text-base font-bold text-white">Zero-Data-Custody, Zero-Static-Secret Pipeline</h4>
                </div>
                <span className="px-2 py-1 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                  No credentials.json Allowed
                </span>
              </div>

              {/* 4-Step Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold">STEP 1: OIDC ISSUER</span>
                  <div className="text-xs font-bold text-white truncate">api.securebase.tximhotep.com</div>
                  <p className="text-[11px] text-slate-400">Cryptographic JWT assertions signed with RSA-256 for tenant identity.</p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold">STEP 2: WIF POOL BINDING</span>
                  <div className="text-xs font-bold text-white truncate">securebase-pool</div>
                  <p className="text-[11px] text-slate-400">Pool binds OIDC claims directly to read-only auditor principal.</p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold">STEP 3: STS TOKEN EXCHANGE</span>
                  <div className="text-xs font-bold text-white truncate">sts.googleapis.com/v1/token</div>
                  <p className="text-[11px] text-slate-400">Exchanges assertion for short-lived OAuth token (15–60 min TTL).</p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold">STEP 4: LEAST-PRIVILEGE METADATA</span>
                  <div className="text-xs font-bold text-emerald-400 truncate">Metadata Discovery Only</div>
                  <p className="text-[11px] text-slate-400">cloudasset.viewer &middot; Zero customer data-plane ingress.</p>
                </div>
              </div>

              {/* Interactive Token Exchange Simulator */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-cyan-400" />
                    Interactive Google STS Token Exchange Simulator
                  </span>
                  <button
                    onClick={handleExchangeStsToken}
                    disabled={isGeneratingSts}
                    className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingSts ? 'Exchanging Claims via STS...' : 'Exchange Ephemeral STS Token'}
                  </button>
                </div>

                {stsTokenGenerated && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] space-y-1.5 animate-fadeIn">
                    <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      STS Token Successfully Exchanged (Ephemeral TTL: 1800s / 30 Minutes)
                    </div>
                    <div className="text-slate-400">
                      Federated Identity: <code className="text-slate-200">principalSet://iam.googleapis.com/{GCP_SPECIFICATION_DETAILS.wifPool}/attribute.tenant_id/cnb-waxahachie</code>
                    </div>
                    <div className="text-slate-400">
                      Token Type: <code className="text-cyan-300">urn:ietf:params:oauth:token-type:access_token</code> &middot; Scopes: <code className="text-purple-300">roles/cloudasset.viewer, roles/securitycenter.adminViewer</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Billing Metering & Reconciliation Daemon */}
        {activeTab === 'metering' && (
          <div className="space-y-5 font-mono text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <div className="text-cyan-400 mb-0.5">SECTION 4: BILLING METERING &amp; ENTITLEMENT RECONCILIATION</div>
                <h4 className="text-base font-bold text-white">Google Service Control API &amp; Daily Reconciliation</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span>Hourly Service Control API Metering</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Consumption metrics for monitored GCP projects beyond the contracted baseline report hourly via Google <code className="text-slate-200 bg-slate-950 px-1 py-0.5 rounded">services.report</code>.
                  </p>
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service:</span>
                      <span className="text-slate-300">{GCP_SPECIFICATION_DETAILS.serviceControlService}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Metric:</span>
                      <span className="text-cyan-300">securebase/monitored_workload_hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cadence:</span>
                      <span className="text-emerald-400">Hourly Batch (3600s)</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <RefreshCw className="w-4 h-4 text-purple-400" />
                    <span>Reconciliation Daemon (02:00 UTC Daily)</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    A daily cron runs at 02:00 UTC querying <code className="text-slate-200 bg-slate-950 px-1 py-0.5 rounded">/v1/providers/tximhotep-public/entitlements</code>. Discrepancies between Google records and Supabase tenant state trigger automated reconciliation.
                  </p>
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Audit Daemon:</span>
                      <span className="text-slate-300">securebase-reconcile-cron</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">State Gating:</span>
                      <span className="text-emerald-400">ACTIVE &middot; Synced with Supabase</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Audit Trail:</span>
                      <span className="text-cyan-300">Immutable 7-Yr WORM Log</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Terraform / OpenTofu Architecture Code */}
        {activeTab === 'terraform' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">terraform/gcp_marketplace_wif.tf</span>
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
                    <span>Copy Terraform HCL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto text-[11px] text-cyan-300/90 leading-relaxed max-h-[360px]">
              <code>{terraformHclCode}</code>
            </pre>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Google Cloud Marketplace Ready &middot; Under $100k Regional Bank Safe</span>
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
