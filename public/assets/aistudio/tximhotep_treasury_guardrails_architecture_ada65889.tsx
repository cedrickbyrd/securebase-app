import React, { useState, useMemo } from 'react';
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
  Database,
  BarChart3,
  Server,
  Cloud,
  Users,
  ShieldAlert
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('configurator');
  const [copiedJson, setCopiedJson] = useState(false);

  // Dynamic GuardRail States
  const [totalLiquidity, setTotalLiquidity] = useState(108000);
  const [ddaTargetPeg, setDdaTargetPeg] = useState(35000);
  const [cloudSpend, setCloudSpend] = useState(2800);
  const [payrollSpend, setPayrollSpend] = useState(16500);
  const [ecrRate] = useState(2.50);
  const [mmaYield] = useState(4.65);
  const [monthlyBankFees] = useState(145);

  // Derived Calculations
  const mmaBalance = useMemo(() => {
    const bal = totalLiquidity - ddaTargetPeg;
    return bal > 0 ? bal : 0;
  }, [totalLiquidity, ddaTargetPeg]);

  const monthlyEcrAllowance = useMemo(() => {
    return (ddaTargetPeg * (ecrRate / 100) * 30) / 365;
  }, [ddaTargetPeg, ecrRate]);

  const ecrCoverageRatio = useMemo(() => {
    if (monthlyBankFees === 0) return 100;
    return Math.round((monthlyEcrAllowance / monthlyBankFees) * 100);
  }, [monthlyEcrAllowance, monthlyBankFees]);

  const annualInterest = useMemo(() => {
    return mmaBalance * (mmaYield / 100);
  }, [mmaBalance, mmaYield]);

  // Policy Rules Evaluation
  const rule1Pass = ddaTargetPeg >= 35000 && ecrCoverageRatio >= 100;
  const rule2Pass = mmaBalance >= 25000;
  const rule3Pass = cloudSpend <= 3500;
  const rule4Pass = payrollSpend <= 20000;

  const totalViolations = [rule1Pass, rule2Pass, rule3Pass, rule4Pass].filter(p => !p).length;

  // JSON Policy Spec Engine Output
  const policyJsonSpec = useMemo(() => {
    return JSON.stringify(
      {
        $schema: "https://tximhotep.io/schemas/v1.2.0/policy.json",
        engine: "tximhotep-engine",
        version: "1.2.0",
        tenant: "TxImhotep LLC",
        banking_partner: "Texas Capital Bank (TCB)",
        treasury_targets: {
          total_liquidity_usd: totalLiquidity,
          dda_peg_usd: ddaTargetPeg,
          mma_reserve_usd: mmaBalance,
          ecr_rate_pct: ecrRate,
          mma_yield_pct: mmaYield
        },
        guardrail_rules: [
          {
            id: "POL-001",
            name: "ECR Fee Neutrality Rule",
            scope: "Treasury DDA",
            condition: "dda_peg >= 35000 AND ecr_coverage_pct >= 100",
            status: rule1Pass ? "PASS" : "VIOLATION",
            action_on_breach: "REBALANCE_DDA_FROM_MMA"
          },
          {
            id: "POL-002",
            name: "Minimum Yield Reserve Floor",
            scope: "MMA Liquidity",
            condition: "mma_balance >= 25000",
            status: rule2Pass ? "PASS" : "VIOLATION",
            action_on_breach: "BLOCK_SWEEP_OUTFLOW"
          },
          {
            id: "POL-003",
            name: "Cloud Sandbox & Dev Cap",
            scope: "AWS/GCP/Azure",
            condition: "cloud_spend_monthly <= 3500",
            status: rule3Pass ? "PASS" : "VIOLATION",
            action_on_breach: "REVOKE_IAM_PROVISIONING_TOKEN"
          },
          {
            id: "POL-004",
            name: "Contractor Payroll Ceiling",
            scope: "Payroll / ACH",
            condition: "payroll_monthly <= 20000",
            status: rule4Pass ? "PASS" : "VIOLATION",
            action_on_breach: "REQUIRE_DUAL_ADMIN_APPROVAL"
          }
        ]
      },
      null,
      2
    );
  }, [totalLiquidity, ddaTargetPeg, mmaBalance, ecrRate, mmaYield, rule1Pass, rule2Pass, rule3Pass, rule4Pass]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(policyJsonSpec);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Executive Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  TxImhotep Treasury GuardRails Architecture
                </h1>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  tximhotep-engine v1.2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Enterprise Policy Enforcement Engine for TxImhotep LLC</p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="hidden lg:flex items-center space-x-4 bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">Policy Enforcer:</span>
              <span className="text-emerald-400 font-semibold font-mono">ACTIVE</span>
            </div>
            <div className="h-3 w-px bg-slate-800"></div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-slate-400">Sweep Engine:</span>
              <span className="text-cyan-400 font-semibold font-mono">ONLINE</span>
            </div>
            <div className="h-3 w-px bg-slate-800"></div>
            <div className="flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Partner:</span>
              <span className="text-slate-200 font-medium">Texas Capital Bank (TCB)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Real-time GuardRail Metrics Bar */}
      <section className="border-b border-slate-800/60 bg-slate-900/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Treasury Liquidity</p>
              <p className="text-xl font-bold font-mono text-white mt-1">${totalLiquidity.toLocaleString()}</p>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">Unencumbered Entity Capital</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">TCB DDA Target Peg</p>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-1">${ddaTargetPeg.toLocaleString()}</p>
              <div className="mt-1 text-[10px] text-cyan-500/80 font-mono">Analyzed Checking DDA</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">ECR Coverage Ratio</p>
              <p className={`text-xl font-bold font-mono mt-1 ${ecrCoverageRatio >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ecrCoverageRatio}%
              </p>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">${monthlyEcrAllowance.toFixed(2)} ECR vs ${monthlyBankFees} Fees</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">MMA Yield Balance</p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">${mmaBalance.toLocaleString()}</p>
              <div className="mt-1 text-[10px] text-emerald-500/80 font-mono">@ {mmaYield}% APY (~${Math.round(annualInterest).toLocaleString()}/yr)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('configurator')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'configurator'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>GuardRail Rules Configurator</span>
            {totalViolations > 0 && (
              <span className="bg-rose-500/20 text-rose-400 text-xs px-2 py-0.5 rounded-full border border-rose-500/40 font-mono font-bold">
                {totalViolations} Violation{totalViolations > 1 ? 's' : ''}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Policy Enforcement Scope Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'json'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>JSON Policy Spec Viewer</span>
          </button>
        </div>

        {/* TAB 1: GUARDRAIL RULES CONFIGURATOR */}
        {activeTab === 'configurator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Controls Column (Sliders) */}
            <div className="lg:col-span-6 space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <span>tximhotep-engine Parameter Controls</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Adjust treasury allocations & monthly operational spend to test live guardrail policies.</p>
              </div>

              <div className="space-y-5 pt-2">
                {/* Total Liquidity Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Total Treasury Capital Pool</label>
                    <span className="font-mono text-sm text-cyan-400 font-bold">${totalLiquidity.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="50000"
                    max="250000"
                    step="5000"
                    value={totalLiquidity}
                    onChange={(e) => setTotalLiquidity(Number(e.target.value))}
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>$50,000</span>
                    <span>$250,000</span>
                  </div>
                </div>

                {/* DDA Target Peg Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">TCB DDA Target Peg (ECR Base)</label>
                    <span className="font-mono text-sm text-cyan-400 font-bold">${ddaTargetPeg.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="15000"
                    max="60000"
                    step="2500"
                    value={ddaTargetPeg}
                    onChange={(e) => setDdaTargetPeg(Number(e.target.value))}
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>$15,000</span>
                    <span>Required Min: $35,000</span>
                  </div>
                </div>

                {/* Cloud Sandbox Spend Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Monthly Cloud Infrastructure & USPTO Spend</label>
                    <span className={`font-mono text-sm font-bold ${cloudSpend > 3500 ? 'text-rose-400' : 'text-slate-200'}`}>
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
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>$1,000</span>
                    <span>Policy Cap: $3,500</span>
                  </div>
                </div>

                {/* Payroll & Contractor Spend Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Monthly Contractor Payroll & Admin Cap</label>
                    <span className={`font-mono text-sm font-bold ${payrollSpend > 20000 ? 'text-rose-400' : 'text-slate-200'}`}>
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
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>$5,000</span>
                    <span>Policy Cap: $20,000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Rules Evaluation Column */}
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span>Live Policy Rule Status Badges</span>
                </span>
                <span className="text-xs font-mono text-slate-400">tximhotep-engine runtime</span>
              </h2>

              {/* Rule 1 Badge Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                rule1Pass 
                  ? 'bg-slate-900/60 border-emerald-500/40' 
                  : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {rule1Pass ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-slate-400">POL-001</span>
                        <h3 className="text-sm font-semibold text-white">ECR Fee Neutrality Rule</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Requires DDA Balance &ge; $35,000 to maintain ECR allowance &ge; monthly bank fees.</p>
                      <div className="mt-2 text-[11px] font-mono text-slate-300">
                        Current DDA: <span className="text-cyan-400">${ddaTargetPeg.toLocaleString()}</span> | ECR Coverage: <span className={ecrCoverageRatio >= 100 ? 'text-emerald-400' : 'text-rose-400'}>{ecrCoverageRatio}%</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                    rule1Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule1Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 2 Badge Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                rule2Pass 
                  ? 'bg-slate-900/60 border-emerald-500/40' 
                  : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {rule2Pass ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-slate-400">POL-002</span>
                        <h3 className="text-sm font-semibold text-white">Minimum Yield Reserve Floor</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Requires Executive MMA Balance &ge; $25,000; alerts if liquidity sweep drops below floor.</p>
                      <div className="mt-2 text-[11px] font-mono text-slate-300">
                        Current MMA Reserve: <span className={rule2Pass ? 'text-emerald-400' : 'text-rose-400'}>${mmaBalance.toLocaleString()}</span> (Floor: $25,000)
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                    rule2Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule2Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 3 Badge Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                rule3Pass 
                  ? 'bg-slate-900/60 border-emerald-500/40' 
                  : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {rule3Pass ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-slate-400">POL-003</span>
                        <h3 className="text-sm font-semibold text-white">Monthly Cloud Sandbox Ceiling</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Max $3,500/mo for AWS GovCloud / GCP / Azure development and USPTO patent automation.</p>
                      <div className="mt-2 text-[11px] font-mono text-slate-300">
                        Configured Monthly Spend: <span className={rule3Pass ? 'text-cyan-400' : 'text-rose-400'}>${cloudSpend.toLocaleString()}</span> (Cap: $3,500)
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                    rule3Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule3Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>

              {/* Rule 4 Badge Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                rule4Pass 
                  ? 'bg-slate-900/60 border-emerald-500/40' 
                  : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {rule4Pass ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-slate-400">POL-004</span>
                        <h3 className="text-sm font-semibold text-white">Monthly Payroll & Contractor Cap</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Max $20,000/mo for engineering and admin contractors.</p>
                      <div className="mt-2 text-[11px] font-mono text-slate-300">
                        Configured Payroll Spend: <span className={rule4Pass ? 'text-cyan-400' : 'text-rose-400'}>${payrollSpend.toLocaleString()}</span> (Cap: $20,000)
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                    rule4Pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {rule4Pass ? 'PASS' : 'VIOLATION'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: POLICY MATRIX TABLE */}
        {activeTab === 'matrix' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>tximhotep-engine Policy Enforcement Scope Matrix</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Full scope mapping of guardrail policy IDs across financial, cloud infrastructure, and administrative rails.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4 font-semibold">Policy ID</th>
                    <th className="py-3.5 px-4 font-semibold">GuardRail Scope</th>
                    <th className="py-3.5 px-4 font-semibold">Policy Condition / Expression</th>
                    <th className="py-3.5 px-4 font-semibold text-amber-400">Action on Breach</th>
                    <th className="py-3.5 px-4 font-semibold text-cyan-400">Enforcement Rail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-001</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Treasury Yield & Fee Neutrality</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>dda_peg &gt;= 35000 AND ecr_coverage &gt;= 100%</code>
                    </td>
                    <td className="py-4 px-4 text-amber-300 bg-amber-950/10 font-medium">
                      Auto Sweep Rebalance from MMA to DDA
                    </td>
                    <td className="py-4 px-4 font-semibold text-cyan-400">
                      TCB Analyzed Sweep Desk
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-002</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Minimum MMA Reserve Floor</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>mma_balance &gt;= 25000</code>
                    </td>
                    <td className="py-4 px-4 text-amber-300 bg-amber-950/10 font-medium">
                      Block Outbound Capital Disbursements
                    </td>
                    <td className="py-4 px-4 font-semibold text-emerald-400">
                      TCB Executive Money Market
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-003</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Cloud & USPTO Patent Sandbox</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>cloud_spend_monthly &lt;= 3500</code>
                    </td>
                    <td className="py-4 px-4 text-rose-400 bg-rose-950/10 font-medium">
                      Revoke IAM Provisioning & Lock Virtual Cards
                    </td>
                    <td className="py-4 px-4 font-semibold text-indigo-400">
                      Ramp API & AWS IAM Middleware
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-004</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Contractor Payroll & Admin Cap</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>payroll_monthly &lt;= 20000</code>
                    </td>
                    <td className="py-4 px-4 text-amber-300 bg-amber-950/10 font-medium">
                      Trigger Dual-Admin Hard Approval Gate
                    </td>
                    <td className="py-4 px-4 font-semibold text-purple-400">
                      TCB ACH Batch Rail & Mercury API
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-005</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Tax & Compliance Reserve Isolation</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>tax_reserve_account.debits == 0</code>
                    </td>
                    <td className="py-4 px-4 text-rose-400 bg-rose-950/10 font-medium">
                      Reject Non-Tax Authority Wire Requests
                    </td>
                    <td className="py-4 px-4 font-semibold text-rose-400">
                      TCB Isolated Sub-DDA
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-cyan-400">POL-006</td>
                    <td className="py-4 px-4 font-semibold text-white flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Emergency Liquidity Drawdown Gate</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      <code>drawdown_request &gt; 10000</code>
                    </td>
                    <td className="py-4 px-4 text-amber-300 bg-amber-950/10 font-medium">
                      Require Multi-Factor Board Quorum Sign-off
                    </td>
                    <td className="py-4 px-4 font-semibold text-amber-400">
                      tximhotep-engine Core Vault
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: JSON POLICY SPEC VIEWER */}
        {activeTab === 'json' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>Programmatic JSON Policy Spec (`tximhotep-engine`)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Exportable policy definition JSON for integration into CI/CD deployment pipelines or AWS Lambda enforcers.</p>
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-mono font-semibold transition"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
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
      </main>
    </div>
  );
}