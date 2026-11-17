import React, { useState } from 'react';
import {
  ENTERPRISE_TIERS,
  STAKEHOLDER_PERSONAS,
  FINANCIAL_PRO_FORMA,
  MASTER_EXECUTION_PLAN,
  COMPETITIVE_MATRIX,
  EXECUTIVE_IP_SUMMARY,
  AWS_FLYWHEEL_CONFIG,
  TRI_CLOUD_TIERS,
  TRI_CLOUD_SPEC_DETAILS,
  EnterpriseTier,
  StakeholderPersona
} from '../data/salesStrategyData';
import {
  TrendingUp,
  X,
  DollarSign,
  ShieldCheck,
  Building,
  Users,
  Target,
  FileText,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Award,
  Layers,
  Sparkles,
  ChevronRight,
  Briefcase,
  Cloud,
  Radio
} from 'lucide-react';

interface GtmPlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GtmPlaybookModal: React.FC<GtmPlaybookModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'personas' | 'differentiation' | 'proforma' | 'roadmap' | 'tricloud'>('tiers');
  const [selectedTier, setSelectedTier] = useState<EnterpriseTier>(ENTERPRISE_TIERS[0]);
  const [selectedPersona, setSelectedPersona] = useState<StakeholderPersona>(STAKEHOLDER_PERSONAS[0]);
  const [pilotCount, setPilotCount] = useState<number>(3);

  if (!isOpen) return null;

  // AWS Flywheel Calculation
  const totalPilotCost = pilotCount * AWS_FLYWHEEL_CONFIG.pilotCost;
  const totalWarCredit = pilotCount * AWS_FLYWHEEL_CONFIG.warCredit;
  const totalNetGain = totalWarCredit - totalPilotCost;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header Section */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 mb-1">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>TXIMHOTEP LLC &middot; EXECUTIVE SALES STRATEGY &amp; GTM PLAYBOOK</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Enterprise Go-To-Market Playbook (2026–2029)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              ASC 350-40 Capitalized Software IP: <span className="text-cyan-300 font-mono font-semibold">{EXECUTIVE_IP_SUMMARY.asc350Valuation}</span> ({EXECUTIVE_IP_SUMMARY.engineeringHours}) &middot; AWS Opportunity: <span className="text-slate-200 font-mono">{EXECUTIVE_IP_SUMMARY.awsOpportunityId}</span>
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

        {/* Executive Capitalized IP & Commercial Summary Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Capitalized Software IP</span>
            <div className="text-lg font-bold text-cyan-300 tabular-nums">{EXECUTIVE_IP_SUMMARY.asc350Valuation}</div>
            <span className="text-[10px] text-slate-500">252 Eng Hours (ASC 350-40)</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">AWS Partner Listing</span>
            <div className="text-sm font-bold text-white truncate">{EXECUTIVE_IP_SUMMARY.awsMarketplaceProductId}</div>
            <span className="text-[10px] text-slate-500">Private Offer Enabled</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">AWS Flywheel Wedge</span>
            <div className="text-lg font-bold text-emerald-400">+$1,000 Net ROI</div>
            <span className="text-[10px] text-slate-500">$5k WAR Credit vs $4k Pilot</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block">Year 3 Pro-Forma</span>
            <div className="text-lg font-bold text-purple-400 tabular-nums">$528,000 ARR</div>
            <span className="text-[10px] text-slate-500">58.0% EBITDA Margin</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tiers'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Commercial Packaging (6 Tiers)</span>
          </button>

          <button
            onClick={() => setActiveTab('personas')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'personas'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Buying Committee (5 Personas)</span>
          </button>

          <button
            onClick={() => setActiveTab('differentiation')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'differentiation'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Competitive Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('proforma')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'proforma'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>3-Year Pro-Forma (2026–2029)</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'roadmap'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Master Execution Plan (Days 1–210)</span>
          </button>

          <button
            onClick={() => setActiveTab('tricloud')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tricloud'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tri-Cloud Parity (AWS + GCP + Azure)</span>
          </button>
        </div>

        {/* TAB 1: COMMERCIAL TIERS & AWS FLYWHEEL */}
        {activeTab === 'tiers' && (
          <div className="space-y-6">
            {/* AWS Flywheel Calculator Box */}
            <div className="p-5 bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 border border-cyan-800/60 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>AWS-SUBSIDIZED FLYWHEEL &middot; NET-POSITIVE PROCURMENT WEDGE</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    $4,000 Paid Pilot + $5,000 AWS WAR Credit = Net +$1,000 Client ROI
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-400">Simulate Deployments:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    {[1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() => setPilotCount(cnt)}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                          pilotCount === cnt
                            ? 'bg-cyan-400 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cnt} {cnt === 1 ? 'Org' : 'Orgs'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 text-[11px] block">Client Pilot Outlay (30-Day Sandbox)</span>
                  <span className="text-base font-bold text-rose-300 tabular-nums">-${totalPilotCost.toLocaleString()}</span>
                  <p className="text-[10px] text-slate-500 mt-1">AWS Marketplace Private Offer invoice</p>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 text-[11px] block">AWS WAR Promotional Funding Credit</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums">+${totalWarCredit.toLocaleString()}</span>
                  <p className="text-[10px] text-slate-500 mt-1">Direct billing credit to customer AWS account</p>
                </div>

                <div className="p-3 bg-slate-900/90 border border-cyan-800/80 rounded-lg bg-cyan-950/20">
                  <span className="text-cyan-400 text-[11px] block font-bold">Net Economic Gain to Prospect</span>
                  <span className="text-base font-bold text-cyan-300 tabular-nums">+${totalNetGain.toLocaleString()}</span>
                  <p className="text-[10px] text-cyan-400/80 mt-1">Instant CFO approval &middot; Zero net cost</p>
                </div>
              </div>
            </div>

            {/* 6 Commercial Tiers Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" />
                  <span>Enterprise Packaging &amp; Licensing Models</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Select tier for detailed breakdown</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ENTERPRISE_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      selectedTier.id === tier.id
                        ? 'bg-slate-850 border-cyan-400 shadow-lg shadow-cyan-950/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-white text-sm">{tier.name}</span>
                        {tier.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-emerald-400 font-bold text-base mb-1">
                        {tier.annualArr}
                      </div>
                      {tier.monthlyPricing && (
                        <div className="font-mono text-xs text-slate-400 mb-2">
                          {tier.monthlyPricing}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {tier.targetMarket}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-400">View Inclusions</span>
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Tier Detail Panel */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-cyan-400 text-[11px] font-bold block">TIER SPECIFICATION</span>
                    <h4 className="text-base font-bold text-white font-sans">{selectedTier.name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold text-base">{selectedTier.annualArr}</span>
                    <span className="text-slate-400 text-[11px] block">{selectedTier.targetMarket}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block mb-1">Statutory Regulatory Crosswalk Focus:</span>
                  <p className="text-slate-200 font-sans leading-relaxed text-xs">
                    {selectedTier.statutoryFocus}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block mb-2">Standard Technical Inclusions:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTier.keyInclusions.map((inc, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-300 font-sans text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BUYING COMMITTEE MATRIX */}
        {activeTab === 'personas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Buying Committee Value Propositions &amp; Decision Criteria</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tailored messaging, governance triggers, and technical proof points across the 5 primary buyer roles
                </p>
              </div>

              {/* Persona Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 font-mono text-xs">
                {STAKEHOLDER_PERSONAS.map((p) => (
                  <button
                    key={p.role}
                    onClick={() => setSelectedPersona(p)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      selectedPersona.role === p.role
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.role}
                  </button>
                ))}
              </div>
            </div>

            {/* Persona Deep-Dive Card */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center font-mono font-bold text-cyan-300 text-base">
                    {selectedPersona.role}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{selectedPersona.title}</h4>
                    <span className="text-xs text-cyan-400 font-mono">Primary Stakeholder &middot; Governance Gate</span>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400">
                  Role: <span className="text-slate-200 font-bold">{selectedPersona.role}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <span className="font-mono text-xs text-cyan-400 font-bold block">DECISION CRITERIA &amp; PRIORITIES</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {selectedPersona.decisionCriteria}
                  </p>
                </div>

                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <span className="font-mono text-xs text-emerald-400 font-bold block">VALUE PROPOSITION</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {selectedPersona.valueProposition}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs text-slate-400 font-bold block">VERIFIABLE TECHNICAL PROOF POINTS</span>
                <div className="space-y-2">
                  {selectedPersona.proofPoints.map((point, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs font-sans text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMPETITIVE MATRIX */}
        {activeTab === 'differentiation' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Competitive Architecture &amp; Moat Comparison</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                How SecureBase establishes defensibility against traditional read-only CSPM scanners and manual ticketing tools
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Evaluation Dimension</th>
                    <th className="py-3 px-4 font-semibold text-cyan-400">SecureBase Control Plane</th>
                    <th className="py-3 px-4 font-semibold text-slate-400">Traditional CSPM (Vanta, Drata)</th>
                    <th className="py-3 px-4 font-semibold text-slate-500">Manual GRC (ServiceNow, Archer)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {COMPETITIVE_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{row.dimension}</td>
                      <td className="py-3 px-4 text-cyan-300 bg-cyan-950/20 font-medium">{row.securebase}</td>
                      <td className="py-3 px-4 text-slate-400">{row.traditionalCspm}</td>
                      <td className="py-3 px-4 text-slate-500">{row.manualGrc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: 3-YEAR PRO-FORMA (2026–2029) */}
        {activeTab === 'proforma' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>3-Year Financial Pro-Forma &amp; Operating Projections (2026–2029)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pro-forma model reflecting capitalized software IP amortization, lean infrastructure OpEx, and healthy software gross margins
              </p>
            </div>

            {/* Financial Summary Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-semibold">P&amp;L Metric</th>
                    <th className="py-3 px-4 font-semibold text-right">Year 1 (2026–2027)</th>
                    <th className="py-3 px-4 font-semibold text-right">Year 2 (2027–2028)</th>
                    <th className="py-3 px-4 font-semibold text-right text-emerald-400">Year 3 (2028–2029)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  <tr className="hover:bg-slate-900/30">
                    <td className="py-2.5 px-4 font-medium text-slate-200">SaaS Subscription Revenue (ARR)</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">$120,000</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">$180,000</td>
                    <td className="py-2.5 px-4 text-right text-emerald-300 font-bold">$432,000</td>
                  </tr>
                  <tr className="hover:bg-slate-900/30">
                    <td className="py-2.5 px-4 font-medium text-slate-200">Advisory / Rapid Readiness Audits</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">$48,000</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">$60,000</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">$96,000</td>
                  </tr>
                  <tr className="bg-slate-900/50 font-bold border-y border-slate-700">
                    <td className="py-2.5 px-4 text-white">Total Gross Revenue</td>
                    <td className="py-2.5 px-4 text-right text-cyan-300">$168,000</td>
                    <td className="py-2.5 px-4 text-right text-cyan-300">$240,000</td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-bold">$528,000</td>
                  </tr>

                  {/* OpEx Breakdown */}
                  <tr className="hover:bg-slate-900/30 text-slate-400">
                    <td className="py-2 px-4 pl-8">Cloud Hosting &amp; WORM Vaults</td>
                    <td className="py-2 px-4 text-right">$14,400</td>
                    <td className="py-2 px-4 text-right">$24,000</td>
                    <td className="py-2 px-4 text-right">$48,000</td>
                  </tr>
                  <tr className="hover:bg-slate-900/30 text-slate-400">
                    <td className="py-2 px-4 pl-8">Sales, Marketing &amp; Sponsorships</td>
                    <td className="py-2 px-4 text-right">$6,000</td>
                    <td className="py-2 px-4 text-right">$15,000</td>
                    <td className="py-2 px-4 text-right">$30,000</td>
                  </tr>
                  <tr className="hover:bg-slate-900/30 text-slate-400">
                    <td className="py-2 px-4 pl-8">Admin, Legal &amp; Accounting</td>
                    <td className="py-2 px-4 text-right">$12,000</td>
                    <td className="py-2 px-4 text-right">$15,000</td>
                    <td className="py-2 px-4 text-right">$24,000</td>
                  </tr>
                  <tr className="hover:bg-slate-900/30 text-slate-400">
                    <td className="py-2 px-4 pl-8">Executive &amp; Eng Leadership</td>
                    <td className="py-2 px-4 text-right">$48,000</td>
                    <td className="py-2 px-4 text-right">$72,000</td>
                    <td className="py-2 px-4 text-right">$120,000</td>
                  </tr>

                  <tr className="bg-slate-900/50 font-bold border-y border-slate-700">
                    <td className="py-2.5 px-4 text-rose-300">Total Operating Expenses (OpEx)</td>
                    <td className="py-2.5 px-4 text-right text-rose-300">$80,400</td>
                    <td className="py-2.5 px-4 text-right text-rose-300">$126,000</td>
                    <td className="py-2.5 px-4 text-right text-rose-300 font-bold">$222,000</td>
                  </tr>

                  {/* Net EBITDA */}
                  <tr className="bg-emerald-950/30 font-bold text-sm border-t border-emerald-500/50">
                    <td className="py-3 px-4 text-emerald-300">Net Operating Income (EBITDA)</td>
                    <td className="py-3 px-4 text-right text-emerald-400">$87,600</td>
                    <td className="py-3 px-4 text-right text-emerald-400">$114,000</td>
                    <td className="py-3 px-4 text-right text-emerald-300 font-extrabold">$306,000</td>
                  </tr>
                  <tr className="bg-emerald-950/20 text-xs">
                    <td className="py-2 px-4 text-slate-400">EBITDA Margin</td>
                    <td className="py-2 px-4 text-right text-emerald-400">52.1%</td>
                    <td className="py-2 px-4 text-right text-emerald-400">47.5%</td>
                    <td className="py-2 px-4 text-right text-emerald-300 font-bold">58.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: MASTER EXECUTION PLAN */}
        {activeTab === 'roadmap' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>5-Phase Master Execution Plan (Days 1–210)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeted Texas banking lighthouse deployments, healthcare expansions, and federal GovCloud ingress
              </p>
            </div>

            <div className="space-y-4">
              {MASTER_EXECUTION_PLAN.map((phase, idx) => (
                <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[11px]">
                        {phase.phase} &middot; {phase.timeframe}
                      </span>
                      <h4 className="font-bold text-white font-sans text-sm">{phase.title}</h4>
                    </div>
                    <span className="text-slate-400 text-[11px] font-sans">
                      Key Account Focus: <strong className="text-white">{phase.focus}</strong>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {phase.milestones.map((m, mIdx) => (
                      <div key={mIdx} className="flex items-start gap-2 text-slate-300 font-sans text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: TRI-CLOUD PARITY & COMMITMENT DRAWDOWN (V3.0) */}
        {activeTab === 'tricloud' && (
          <div className="space-y-6">
            {/* Header Highlight Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-950 to-amber-950/60 border border-cyan-800/60 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white tracking-tight">Tri-Cloud Unified Architecture Matrix v3.0</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-semibold text-[11px]">
                  AWS EDP &middot; Google EDP &middot; Microsoft MACC
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                Pricing rails and statutory scopes are mathematically mirrored across AWS Marketplace, Google Cloud Marketplace, and Microsoft Azure Marketplace to enable instant enterprise procurement without net-new budget committee friction.
              </p>
            </div>

            {/* Tri-Cloud 4-Tier Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TRI_CLOUD_TIERS.map((tier) => (
                <div key={tier.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm font-sans">{tier.name}</span>
                    {tier.boardSafe && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                        &lt; $100k Board Approval Safe
                      </span>
                    )}
                  </div>

                  <div className="text-lg font-bold text-cyan-300 tabular-nums">
                    {tier.rateAndTerms}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Commitment Eligibility: <span className="text-emerald-400 font-semibold">{tier.commitmentBurnEligibility}</span>
                  </div>

                  <p className="text-slate-400 font-sans text-xs">{tier.regulatoryScope}</p>

                  <div className="pt-2 border-t border-slate-800 space-y-1 font-sans text-xs text-slate-300">
                    {tier.keyInclusions.slice(0, 3).map((inc, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Ingestion & Zero Data-Custody Summary Note */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block text-[11px]">Zero-Data-Custody Multi-Cloud Guarantee</span>
                <span className="text-white font-bold">Ephemeral STS Federation (15–60m TTL) &middot; Hardware-Locked 7-Year WORM Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-amber-300 text-[11px]">AWS S3 Object Lock</span>
                <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-blue-300 text-[11px]">GCS Locked WORM</span>
                <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-cyan-300 text-[11px]">Azure Immutable Blob</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400 flex items-center gap-2">
            <span>Executive Contact:</span>
            <span className="text-white font-semibold">{EXECUTIVE_IP_SUMMARY.founder}</span>
            <span>&middot;</span>
            <a href={`mailto:${EXECUTIVE_IP_SUMMARY.email}`} className="text-cyan-400 hover:underline">
              {EXECUTIVE_IP_SUMMARY.email}
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print Briefing</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
