import React, { useState, useMemo } from 'react';
import {
  TREASURY_POLICY_RULES,
  FINTECH_COMPARISON_MATRIX,
  DEFAULT_TREASURY_CONFIG
} from '../data/treasuryData';
import {
  ShieldCheck,
  TrendingUp,
  Zap,
  Building2,
  DollarSign,
  ArrowRightLeft,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Code2,
  Lock,
  Cpu,
  RefreshCw,
  FileText,
  Check,
  Copy,
  Terminal,
  Activity,
  CreditCard,
  BarChart3,
  Server,
  Cloud,
  Users,
  ShieldAlert,
  Sparkles,
  Minus,
  X
} from 'lucide-react';

interface TreasuryGuardrailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TreasuryGuardrailsModal: React.FC<TreasuryGuardrailsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'sweep' | 'configurator' | 'matrix' | 'fintech' | 'json'>('sweep');
  const [copiedJson, setCopiedJson] = useState(false);

  // Dynamic GuardRail States
  const [totalLiquidity, setTotalLiquidity] = useState<number>(DEFAULT_TREASURY_CONFIG.totalLiquidity);
  const [ddaTargetPeg, setDdaTargetPeg] = useState<number>(DEFAULT_TREASURY_CONFIG.ddaTargetPeg);
  const [cloudSpend, setCloudSpend] = useState<number>(DEFAULT_TREASURY_CONFIG.cloudSpend);
  const [payrollSpend, setPayrollSpend] = useState<number>(DEFAULT_TREASURY_CONFIG.payrollSpend);
  const [ecrRate] = useState<number>(DEFAULT_TREASURY_CONFIG.ecrRate);
  const [mmaYield] = useState<number>(DEFAULT_TREASURY_CONFIG.mmaYield);

  // Fee Structure States
  const [wireCount, setWireCount] = useState<number>(DEFAULT_TREASURY_CONFIG.wireCount);
  const [achBatchCount, setAchBatchCount] = useState<number>(DEFAULT_TREASURY_CONFIG.achBatchCount);
  const baseAccountFee = DEFAULT_TREASURY_CONFIG.baseAccountFee;
  const wireFee = DEFAULT_TREASURY_CONFIG.wireFee;
  const achBatchFee = DEFAULT_TREASURY_CONFIG.achBatchFee;
  const tokenFee = DEFAULT_TREASURY_CONFIG.tokenFee;

  // Derived Fee Calculations
  const estimatedMonthlyFees = useMemo(() => {
    return baseAccountFee + (wireCount * wireFee) + (achBatchCount * achBatchFee) + tokenFee;
  }, [baseAccountFee, wireCount, wireFee, achBatchCount, achBatchFee, tokenFee]);

  // Derived Liquidity & ECR Calculations
  const mmaBalance = useMemo(() => {
    const bal = totalLiquidity - ddaTargetPeg;
    return bal > 0 ? bal : 0;
  }, [totalLiquidity, ddaTargetPeg]);

  const monthlyEcrAllowance = useMemo(() => {
    return (ddaTargetPeg * (ecrRate / 100) * 30) / 365;
  }, [ddaTargetPeg, ecrRate]);

  const ecrCoverageRatio = useMemo(() => {
    if (estimatedMonthlyFees === 0) return 100;
    return Math.round((monthlyEcrAllowance / estimatedMonthlyFees) * 100);
  }, [monthlyEcrAllowance, estimatedMonthlyFees]);

  const netTreasuryFees = useMemo(() => {
    const net = estimatedMonthlyFees - monthlyEcrAllowance;
    return net > 0 ? net : 0;
  }, [estimatedMonthlyFees, monthlyEcrAllowance]);

  const annualInterest = useMemo(() => {
    return mmaBalance * (mmaYield / 100);
  }, [mmaBalance, mmaYield]);

  // Policy Rules Evaluation
  const rule1Pass = ddaTargetPeg >= 35000 && ecrCoverageRatio >= 100;
  const rule2Pass = mmaBalance >= DEFAULT_TREASURY_CONFIG.mmaFloor;
  const rule3Pass = cloudSpend <= DEFAULT_TREASURY_CONFIG.cloudSpendCap;
  const rule4Pass = payrollSpend <= DEFAULT_TREASURY_CONFIG.payrollSpendCap;

  const totalViolations = [rule1Pass, rule2Pass, rule3Pass, rule4Pass].filter((p) => !p).length;

  // JSON Policy Spec Engine Output
  const policyJsonSpec = useMemo(() => {
    return JSON.stringify(
      {
        $schema: 'https://tximhotep.io/schemas/v1.2.0/policy.json',
        engine: 'tximhotep-engine',
        version: '3.1.0',
        tenant: 'TxImhotep LLC',
        banking_partner: DEFAULT_TREASURY_CONFIG.bankingPartner,
        treasury_targets: {
          total_liquidity_usd: totalLiquidity,
          dda_peg_usd: ddaTargetPeg,
          mma_reserve_usd: mmaBalance,
          ecr_rate_pct: ecrRate,
          mma_yield_pct: mmaYield,
          estimated_monthly_fees_usd: estimatedMonthlyFees,
          monthly_ecr_allowance_usd: Number(monthlyEcrAllowance.toFixed(2)),
          net_out_of_pocket_fees_usd: Number(netTreasuryFees.toFixed(2))
        },
        guardrail_rules: [
          {
            id: 'POL-001',
            name: 'ECR Fee Neutrality Rule',
            scope: 'Treasury DDA',
            condition: 'dda_peg >= 35000 AND ecr_coverage_pct >= 100',
            status: rule1Pass ? 'PASS' : 'VIOLATION',
            action_on_breach: 'REBALANCE_DDA_FROM_MMA',
            enforcement_rail: 'TCB Analyzed Sweep Desk'
          },
          {
            id: 'POL-002',
            name: 'Minimum Yield Reserve Floor',
            scope: 'MMA Liquidity',
            condition: 'mma_balance >= 25000',
            status: rule2Pass ? 'PASS' : 'VIOLATION',
            action_on_breach: 'BLOCK_SWEEP_OUTFLOW',
            enforcement_rail: 'TCB Executive Money Market'
          },
          {
            id: 'POL-003',
            name: 'Cloud Sandbox & Dev Cap',
            scope: 'AWS/GCP/Azure/USPTO',
            condition: 'cloud_spend_monthly <= 3500',
            status: rule3Pass ? 'PASS' : 'VIOLATION',
            action_on_breach: 'REVOKE_IAM_PROVISIONING_TOKEN',
            enforcement_rail: 'Ramp API & AWS IAM Middleware'
          },
          {
            id: 'POL-004',
            name: 'Contractor Payroll Ceiling',
            scope: 'Payroll / ACH',
            condition: 'payroll_monthly <= 20000',
            status: rule4Pass ? 'PASS' : 'VIOLATION',
            action_on_breach: 'REQUIRE_DUAL_ADMIN_APPROVAL',
            enforcement_rail: 'TCB ACH Batch Rail & Mercury API'
          },
          {
            id: 'POL-005',
            name: 'Tax & Compliance Reserve Isolation',
            scope: 'Tax Sub-DDA',
            condition: 'tax_reserve_account.debits == 0',
            status: 'PASS',
            action_on_breach: 'REJECT_NON_TAX_WIRE',
            enforcement_rail: 'TCB Isolated Sub-DDA'
          },
          {
            id: 'POL-006',
            name: 'Emergency Liquidity Drawdown Gate',
            scope: 'Core Vault',
            condition: 'drawdown_request > 10000',
            status: 'PASS',
            action_on_breach: 'REQUIRE_BOARD_QUORUM',
            enforcement_rail: 'tximhotep-engine Core Vault'
          }
        ]
      },
      null,
      2
    );
  }, [
    totalLiquidity,
    ddaTargetPeg,
    mmaBalance,
    ecrRate,
    mmaYield,
    estimatedMonthlyFees,
    monthlyEcrAllowance,
    netTreasuryFees,
    rule1Pass,
    rule2Pass,
    rule3Pass,
    rule4Pass
  ]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(policyJsonSpec);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20 shrink-0">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  TxImhotep Treasury GuardRails Architecture
                </h2>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  tximhotep-engine v3.1
                </span>
                <span className="bg-slate-950 text-slate-300 border border-slate-800 text-xs px-2.5 py-0.5 rounded-full font-mono">
                  Texas Capital Bank (TCB)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automated ECR Fee Neutrality &middot; Executive MMA Sweep &middot; Spend Policy Guardrails
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time GuardRail Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Total Liquidity Pool</span>
            <div className="text-lg font-bold text-white tabular-nums">${totalLiquidity.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500">Unencumbered Capital</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">TCB DDA Target Peg</span>
            <div className="text-lg font-bold text-cyan-400 tabular-nums">${ddaTargetPeg.toLocaleString()}</div>
            <span className="text-[10px] text-cyan-500/80">Analyzed Operating DDA</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">ECR Coverage Ratio</span>
            <div className={`text-lg font-bold tabular-nums ${ecrCoverageRatio >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {ecrCoverageRatio}%
            </div>
            <span className="text-[10px] text-slate-500">${monthlyEcrAllowance.toFixed(2)} ECR vs ${estimatedMonthlyFees} Fees</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-0.5">
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Swept MMA Balance</span>
            <div className="text-lg font-bold text-emerald-400 tabular-nums">${mmaBalance.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-500/80">@{mmaYield}% APY (~${Math.round(annualInterest).toLocaleString()}/yr)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('sweep')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sweep'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>TCB ECR &amp; MMA Sweep Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('configurator')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'configurator'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>GuardRail Rules Configurator</span>
            {totalViolations > 0 && (
              <span className="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0.2 rounded-full border border-rose-500/40">
                {totalViolations}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Policy Enforcement Scope Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('fintech')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'fintech'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Mercury vs Ramp Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>JSON Policy Spec Viewer</span>
          </button>
        </div>

        {/* TAB 1: TCB ECR & MMA SWEEP ENGINE */}
        {activeTab === 'sweep' && (
          <div className="space-y-6">
            {/* Sweep Mechanics Flow Diagram */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>tximhotep-engine Automated ECR &amp; MMA Sweep Architecture</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    End-of-day treasury reconciliation balancing non-taxable ECR soft credits against taxable hard MMA cash yield
                  </p>
                </div>
                <span className="text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-3 py-1 rounded-lg">
                  Target Balance: ${ddaTargetPeg.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                {/* DDA Box */}
                <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-4 relative space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                      Operating Checking (DDA)
                    </span>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono">
                      Soft ECR Credit
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    ${ddaTargetPeg.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400">
                    Generates non-taxable earnings credit allowance to eliminate monthly bank fees.
                  </p>

                  <div className="space-y-1.5 border-t border-slate-800 pt-3 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>ECR Fee Credit:</span>
                      <span className="text-amber-400 font-bold">${monthlyEcrAllowance.toFixed(2)}/mo</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Bank Service Charges:</span>
                      <span className="text-slate-200">${estimatedMonthlyFees.toFixed(2)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Sweep Execution Center */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
                    <span>Surplus Sweep (DDA &rarr; MMA)</span>
                    <span className="text-emerald-400">&gt; ${ddaTargetPeg.toLocaleString()}</span>
                  </div>

                  <div className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex items-center justify-around">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Target Peg</div>
                      <div className="font-mono text-xs text-cyan-400 font-bold">${ddaTargetPeg.toLocaleString()}</div>
                    </div>
                    <ArrowRightLeft className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Step Multiple</div>
                      <div className="font-mono text-xs text-slate-300 font-bold">$1,000</div>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
                    <span>Deficit Pull (MMA &rarr; DDA)</span>
                    <span className="text-cyan-400">&lt; ${ddaTargetPeg.toLocaleString()}</span>
                  </div>
                </div>

                {/* MMA Box */}
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 relative space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                      Executive Money Market
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">
                      Hard Cash Yield
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    ${mmaBalance.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400">
                    Overnight high-yield liquidity vault earning compounding interest paid in cash.
                  </p>

                  <div className="space-y-1.5 border-t border-slate-800 pt-3 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Annual Cash Yield:</span>
                      <span className="text-emerald-400 font-bold">+${Math.round(annualInterest).toLocaleString()}/yr</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Interest Rate (APY):</span>
                      <span className="text-slate-200">{mmaYield.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fee Breakdown & Efficiency Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Fee Inputs */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>TCB Monthly Service Fee Simulation</span>
                </h4>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Outbound Domestic Wires ($15/wire): {wireCount}</span>
                      <span className="text-slate-200 font-bold">${wireCount * wireFee}.00</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={wireCount}
                      onChange={(e) => setWireCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>ACH Batch Origination ($10/batch): {achBatchCount}</span>
                      <span className="text-slate-200 font-bold">${achBatchCount * achBatchFee}.00</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={achBatchCount}
                      onChange={(e) => setAchBatchCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Fixed Base Account &amp; Token Fees:</span>
                    <span className="text-slate-200">${baseAccountFee + tokenFee}.00</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-semibold">
                    <span className="text-white">Estimated Monthly Service Fees:</span>
                    <span className="text-cyan-400 font-bold">${estimatedMonthlyFees.toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>

              {/* Efficiency Analysis */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4 font-mono text-xs">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Treasury Efficiency &amp; Optimization</span>
                </h4>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>ECR Soft Dollar Offset Ratio</span>
                      <span className="text-cyan-400 font-bold">{Math.min(100, ecrCoverageRatio)}% Offset</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, ecrCoverageRatio)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Capital Swept to Hard Interest</span>
                      <span className="text-emerald-400 font-bold">{totalLiquidity > 0 ? Math.round((mmaBalance / totalLiquidity) * 100) : 0}% Swept</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${totalLiquidity > 0 ? Math.round((mmaBalance / totalLiquidity) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-xl text-slate-300 font-sans text-xs space-y-1">
                    <div className="font-semibold text-cyan-400 flex items-center font-mono text-xs">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      tximhotep-engine Optimization Verdict
                    </div>
                    <p className="leading-relaxed">
                      Your <strong className="text-white font-mono">${ddaTargetPeg.toLocaleString()}</strong> target DDA peg generates <strong className="text-white font-mono">${monthlyEcrAllowance.toFixed(2)}</strong> in monthly ECR credits, neutralizing <strong className="text-emerald-400 font-mono">${estimatedMonthlyFees.toFixed(2)}</strong> in fees while sweeping <strong className="text-emerald-400 font-mono">${mmaBalance.toLocaleString()}</strong> into overnight high-yield reserves capturing <strong className="text-emerald-400 font-mono">+${Math.round(annualInterest).toLocaleString()}/yr</strong> in net cash interest.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GUARDRAIL RULES CONFIGURATOR */}
        {activeTab === 'configurator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls Column (Sliders) */}
            <div className="lg:col-span-6 space-y-5 bg-slate-950/80 border border-slate-800 rounded-xl p-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>tximhotep-engine Parameter Controls</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjust treasury allocations and operational caps to test live guardrail policies.
                </p>
              </div>

              <div className="space-y-4 pt-1 font-mono text-xs">
                {/* Total Liquidity Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-300">Total Treasury Capital Pool</label>
                    <span className="text-cyan-400 font-bold">${totalLiquidity.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="50000"
                    max="250000"
                    step="5000"
                    value={totalLiquidity}
                    onChange={(e) => setTotalLiquidity(Number(e.target.value))}
                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$50,000</span>
                    <span>$250,000</span>
                  </div>
                </div>

                {/* DDA Target Peg Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-300">TCB DDA Target Peg (ECR Base)</label>
                    <span className="text-cyan-400 font-bold">${ddaTargetPeg.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="15000"
                    max="60000"
                    step="2500"
                    value={ddaTargetPeg}
                    onChange={(e) => setDdaTargetPeg(Number(e.target.value))}
                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$15,000</span>
                    <span>Required Floor: $35,000</span>
                  </div>
                </div>

                {/* Cloud Spend Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-300">Monthly Cloud &amp; USPTO Spend</label>
                    <span className={`font-bold ${cloudSpend > DEFAULT_TREASURY_CONFIG.cloudSpendCap ? 'text-rose-400' : 'text-slate-200'}`}>
                      ${cloudSpend.toLocaleString()}/mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="8000"
                    step="200"
                    value={cloudSpend}
                    onChange={(e) => setCloudSpend(Number(e.target.value))}
                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$1,000</span>
                    <span>Policy Cap: $3,500</span>
                  </div>
                </div>

                {/* Contractor Payroll Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-300">Monthly Contractor Payroll &amp; Admin Cap</label>
                    <span className={`font-bold ${payrollSpend > DEFAULT_TREASURY_CONFIG.payrollSpendCap ? 'text-rose-400' : 'text-slate-200'}`}>
                      ${payrollSpend.toLocaleString()}/mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="35000"
                    step="1000"
                    value={payrollSpend}
                    onChange={(e) => setPayrollSpend(Number(e.target.value))}
                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$5,000</span>
                    <span>Policy Cap: $20,000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Rules Evaluation Column */}
            <div className="lg:col-span-6 space-y-3 font-mono text-xs">
              <h3 className="text-base font-bold text-white flex items-center justify-between font-sans">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Live Policy Rule Status Badges</span>
                </span>
                <span className="text-xs font-mono text-slate-400">tximhotep-engine runtime</span>
              </h3>

              {/* Rule 1 Badge */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                rule1Pass ? 'bg-slate-950/80 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    {rule1Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">POL-001</span>
                        <h4 className="text-xs font-semibold text-white font-sans">ECR Fee Neutrality Rule</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Requires DDA Balance &ge; $35,000 to maintain ECR allowance &ge; monthly bank fees.
                      </p>
                      <div className="mt-1 text-[11px] text-slate-300">
                        Current DDA: <span className="text-cyan-400 font-bold">${ddaTargetPeg.toLocaleString()}</span> &middot; ECR Coverage: <span className={ecrCoverageRatio >= 100 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{ecrCoverageRatio}%</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    rule1Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule1Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 2 Badge */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                rule2Pass ? 'bg-slate-950/80 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    {rule2Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">POL-002</span>
                        <h4 className="text-xs font-semibold text-white font-sans">Minimum Yield Reserve Floor</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Requires Executive MMA Balance &ge; $25,000; blocks outbound sweeps if below floor.
                      </p>
                      <div className="mt-1 text-[11px] text-slate-300">
                        Current MMA Reserve: <span className={rule2Pass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>${mmaBalance.toLocaleString()}</span> (Floor: $25,000)
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    rule2Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule2Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 3 Badge */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                rule3Pass ? 'bg-slate-950/80 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    {rule3Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">POL-003</span>
                        <h4 className="text-xs font-semibold text-white font-sans">Monthly Cloud Sandbox Ceiling</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Max $3,500/mo for AWS GovCloud / GCP / Azure development and USPTO patent automation.
                      </p>
                      <div className="mt-1 text-[11px] text-slate-300">
                        Configured Monthly Spend: <span className={rule3Pass ? 'text-cyan-400 font-bold' : 'text-rose-400 font-bold'}>${cloudSpend.toLocaleString()}</span> (Cap: $3,500)
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    rule3Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule3Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 4 Badge */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                rule4Pass ? 'bg-slate-950/80 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    {rule4Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">POL-004</span>
                        <h4 className="text-xs font-semibold text-white font-sans">Monthly Payroll &amp; Contractor Cap</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Max $20,000/mo for engineering and admin contractors.
                      </p>
                      <div className="mt-1 text-[11px] text-slate-300">
                        Configured Payroll Spend: <span className={rule4Pass ? 'text-cyan-400 font-bold' : 'text-rose-400 font-bold'}>${payrollSpend.toLocaleString()}</span> (Cap: $20,000)
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    rule4Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule4Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: POLICY MATRIX TABLE */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>tximhotep-engine Policy Enforcement Scope Matrix (POL-001 – POL-006)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full scope mapping of treasury policies across financial, cloud infrastructure, and administrative rails.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Policy ID</th>
                    <th className="py-3 px-4 font-semibold">GuardRail Scope</th>
                    <th className="py-3 px-4 font-semibold">Policy Expression</th>
                    <th className="py-3 px-4 font-semibold text-amber-400">Action on Breach</th>
                    <th className="py-3 px-4 font-semibold text-cyan-400">Enforcement Rail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {TREASURY_POLICY_RULES.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-4 font-bold text-cyan-400 whitespace-nowrap">{rule.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">{rule.scope}</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {rule.condition}
                        </code>
                      </td>
                      <td className="py-3.5 px-4 text-amber-300 bg-amber-950/10 font-medium">
                        {rule.actionOnBreach}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-cyan-400 whitespace-nowrap">
                        {rule.enforcementRail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: MERCURY VS RAMP EVALUATION */}
        {activeTab === 'fintech' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>Mercury vs Ramp: Architectural Evaluation Matrix</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparing fintech treasury platforms for TxImhotep LLC deployment
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="flex items-center text-cyan-300 font-semibold bg-cyan-950/70 border border-cyan-800 px-2.5 py-1 rounded-lg">
                  <Check className="w-3.5 h-3.5 mr-1" /> Mercury: Treasury Sweep Choice
                </span>
                <span className="flex items-center text-amber-300 font-semibold bg-amber-950/70 border border-amber-800 px-2.5 py-1 rounded-lg">
                  <Check className="w-3.5 h-3.5 mr-1" /> Ramp: Card Guardrail Choice
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Evaluation Criteria</th>
                    <th className="py-3 px-4 font-semibold text-cyan-400 w-1/3">Mercury (Neobank &amp; Treasury)</th>
                    <th className="py-3 px-4 font-semibold text-amber-400 w-1/3">Ramp (Spend &amp; Policy Control)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {FINTECH_COMPARISON_MATRIX.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="font-semibold">{item.criteria}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{item.subtext}</div>
                      </td>
                      <td className="py-3.5 px-4 bg-cyan-950/10">
                        <span className="font-semibold text-cyan-300 flex items-center gap-1">
                          {item.mercury.isAdvantage && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          {item.mercury.title}
                        </span>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.mercury.description}</p>
                      </td>
                      <td className="py-3.5 px-4 bg-amber-950/10">
                        <span className="font-semibold text-amber-300 flex items-center gap-1">
                          {item.ramp.isAdvantage && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          {item.ramp.title}
                        </span>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.ramp.description}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hybrid Architecture Recommendation */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>TxImhotep LLC Recommended Hybrid Architecture</span>
                </h4>
                <p className="text-xs text-slate-400 font-sans max-w-2xl leading-relaxed">
                  Deploy <strong className="text-cyan-400 font-mono">Texas Capital Bank (or Mercury)</strong> as the primary treasury vault for ECR fee neutralization and Executive MMA yield sweeps, paired with <strong className="text-amber-400 font-mono">Ramp</strong> for granular virtual card policy guardrails across software subscriptions and contractor disbursements.
                </p>
              </div>
              <span className="text-[11px] bg-cyan-950 border border-cyan-800 text-cyan-300 px-3 py-1 rounded-lg font-mono shrink-0">
                tximhotep-engine Verified
              </span>
            </div>
          </div>
        )}

        {/* TAB 5: JSON POLICY SPEC VIEWER */}
        {activeTab === 'json' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Programmatic JSON Policy Spec (`tximhotep-engine v3.1`)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exportable policy definition JSON for integration into CI/CD deployment pipelines, AWS Lambda enforcers, or Supabase triggers.
                </p>
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/80 text-xs font-mono font-semibold transition cursor-pointer"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy JSON Spec</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-cyan-300 leading-relaxed">
                {policyJsonSpec}
              </pre>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400 flex items-center gap-2">
            <span>Treasury Desk:</span>
            <span className="text-white font-semibold">Texas Capital Bank (TCB) Analyzed Sweep Desk</span>
            <span>&middot;</span>
            <span className="text-emerald-400 font-semibold font-mono">Dual-Control Guarded</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print Treasury Report</span>
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
