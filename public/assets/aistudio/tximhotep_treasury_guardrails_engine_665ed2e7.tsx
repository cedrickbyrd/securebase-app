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
  Minus,
  Sparkles,
  Activity,
  CreditCard,
  Database,
  BarChart3,
  Server
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Interactive Guardrail & Treasury State
  const [totalTreasury, setTotalTreasury] = useState(115000);
  const [targetDda, setTargetDda] = useState(35000);
  const [ecrRate, setEcrRate] = useState(2.50); // % ECR
  const [mmaYield, setMmaYield] = useState(4.65); // % APY
  
  // Operational Spend & Fee Inputs
  const [monthlySoftware, setMonthlySoftware] = useState(12500);
  const [monthlyPayroll, setMonthlyPayroll] = useState(18000);
  const [wireCount, setWireCount] = useState(4);
  const [achBatchCount, setAchBatchCount] = useState(4);
  const [baseAccountFee] = useState(25);
  const [wireFee] = useState(15);
  const [achBatchFee] = useState(10);
  const [tokenFee] = useState(10);

  // Dynamic Calculated Fees
  const estimatedMonthlyFees = useMemo(() => {
    return baseAccountFee + (wireCount * wireFee) + (achBatchCount * achBatchFee) + tokenFee;
  }, [baseAccountFee, wireCount, wireFee, achBatchCount, achBatchFee, tokenFee]);

  // Real-time ECR Sweep Calculations
  const calculatedEcrAllowance = useMemo(() => {
    return (targetDda * (ecrRate / 100) * 30) / 365;
  }, [targetDda, ecrRate]);

  const netTreasuryFees = useMemo(() => {
    const net = estimatedMonthlyFees - calculatedEcrAllowance;
    return net > 0 ? net : 0;
  }, [estimatedMonthlyFees, calculatedEcrAllowance]);

  const sweptToMma = useMemo(() => {
    const remaining = totalTreasury - targetDda;
    return remaining > 0 ? remaining : 0;
  }, [totalTreasury, targetDda]);

  const annualMmaInterest = useMemo(() => {
    return sweptToMma * (mmaYield / 100);
  }, [sweptToMma, mmaYield]);

  // Guardrail Policy Caps
  const maxSoftwareLimit = 20000;
  const maxPayrollLimit = 25000;
  const minReserveBuffer = 25000;

  // Policy Compliance Violations
  const softwareViolation = monthlySoftware > maxSoftwareLimit;
  const payrollViolation = monthlyPayroll > maxPayrollLimit;
  const reserveViolation = sweptToMma < minReserveBuffer;
  const ecrFullyCovered = calculatedEcrAllowance >= estimatedMonthlyFees;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Enterprise Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  TxImhotep Treasury & GuardRails Engine
                </span>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  tximhotep-engine v3.1
                </span>
              </div>
              <p className="text-xs text-slate-400">Texas Capital Bank Analyzed Sweep & Corporate Policy Engine</p>
            </div>
          </div>

          {/* Quick Stats Ticker */}
          <div className="hidden lg:flex items-center space-x-6 bg-slate-900/90 px-4 py-1.5 rounded-full border border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">TCB ECR Rate:</span>
              <span className="font-mono text-cyan-400 font-semibold">{ecrRate.toFixed(2)}%</span>
            </div>
            <div className="h-3 w-px bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Executive MMA:</span>
              <span className="font-mono text-emerald-400 font-semibold">{mmaYield.toFixed(2)}% APY</span>
            </div>
            <div className="h-3 w-px bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Posture:</span>
              <span className="text-slate-200 font-medium">Dual-Control Guarded</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-4 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>TCB ECR & MMA Sweep Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Policy Guardrails Simulator</span>
            {(softwareViolation || payrollViolation || reserveViolation) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
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
            <span>Mercury vs Ramp Architectural Evaluation</span>
          </button>
        </div>

        {/* TAB 1: TCB SWEEP & ECR SIMULATOR */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <Building2 className="w-16 h-16 text-cyan-400" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">TCB Target DDA Peg</p>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold font-mono text-white">${targetDda.toLocaleString()}</span>
                  <span className="ml-2 text-xs text-slate-400">Analyzed DDA</span>
                </div>
                <div className="mt-3 flex items-center text-xs text-cyan-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  <span>Above $2,500 Base Fee Floor</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <ArrowRightLeft className="w-16 h-16 text-emerald-400" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Swept MMA Balance</p>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold font-mono text-emerald-400">${sweptToMma.toLocaleString()}</span>
                  <span className="ml-2 text-xs text-emerald-500/80 font-medium">@ {mmaYield}% APY</span>
                </div>
                <div className="mt-3 flex items-center text-xs text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  <span>+${Math.round(annualMmaInterest).toLocaleString()}/yr Net Cash Yield</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <Zap className="w-16 h-16 text-amber-400" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Monthly ECR Fee Offset</p>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold font-mono text-amber-400">${calculatedEcrAllowance.toFixed(2)}</span>
                  <span className="ml-2 text-xs text-slate-400">Allowance</span>
                </div>
                <div className="mt-3 flex items-center text-xs text-slate-400">
                  <span>Fees: ${estimatedMonthlyFees.toFixed(2)}/mo</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                  <ShieldCheck className="w-16 h-16 text-cyan-400" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Banking Cost</p>
                <div className="mt-2 flex items-baseline">
                  <span className={`text-2xl font-bold font-mono ${netTreasuryFees === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${netTreasuryFees.toFixed(2)}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">Out-of-Pocket</span>
                </div>
                <div className="mt-3 flex items-center text-xs">
                  {netTreasuryFees === 0 ? (
                    <span className="text-emerald-400 flex items-center font-medium">
                      <Check className="w-3.5 h-3.5 mr-1" /> 100% ECR Offset Target Met
                    </span>
                  ) : (
                    <span className="text-amber-400">Partial Credit Offset</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sweep Mechanics Flow Diagram */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>tximhotep-engine Automated ECR & MMA Sweep Rules</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">End-of-day treasury reconciliation between non-taxable ECR credits & taxable hard yield</p>
                </div>
                <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full font-mono">
                  Target Balance: ${targetDda.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* DDA Box */}
                <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Analyzed Operating DDA</span>
                    <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono">Soft ECR Credit</span>
                  </div>
                  <div className="text-3xl font-bold font-mono text-white mb-2">
                    ${targetDda.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Generates non-taxable earnings credit allowance to eliminate monthly bank fees.</p>
                  
                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>ECR Fee Credit:</span>
                      <span className="text-amber-400 font-mono font-medium">${calculatedEcrAllowance.toFixed(2)}/mo</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Bank Service Charges:</span>
                      <span className="text-slate-200 font-mono">${estimatedMonthlyFees.toFixed(2)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Sweep Execution Center */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
                  <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Surplus Sweep (DDA &rarr; MMA)</span>
                    <span className="text-emerald-400 font-mono">&gt; ${targetDda.toLocaleString()}</span>
                  </div>

                  <div className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-around my-2">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Target Peg</div>
                      <div className="font-mono text-sm text-cyan-400 font-semibold">${targetDda.toLocaleString()}</div>
                    </div>
                    <ArrowRightLeft className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Step Multiple</div>
                      <div className="font-mono text-sm text-slate-300 font-semibold">$1,000</div>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Deficit Pull (MMA &rarr; DDA)</span>
                    <span className="text-cyan-400 font-mono">&lt; ${targetDda.toLocaleString()}</span>
                  </div>
                </div>

                {/* MMA Box */}
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Executive Money Market</span>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">Hard Cash Yield</span>
                  </div>
                  <div className="text-3xl font-bold font-mono text-emerald-400 mb-2">
                    ${sweptToMma.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Overnight high-yield liquidity vault earning compounding interest paid in cash.</p>
                  
                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Annual Cash Yield:</span>
                      <span className="text-emerald-400 font-mono font-medium">${Math.round(annualMmaInterest).toLocaleString()}/yr</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Interest Rate (APY):</span>
                      <span className="text-slate-200 font-mono">{mmaYield.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Fee Breakdown Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>TCB Monthly Service Fee Inputs</span>
                </h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Outbound Wires ($15/wire): {wireCount} wires</span>
                      <span className="font-mono text-slate-200">${wireCount * wireFee}.00</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={wireCount}
                      onChange={(e) => setWireCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>ACH Batch Origination ($10/batch): {achBatchCount} batches</span>
                      <span className="font-mono text-slate-200">${achBatchCount * achBatchFee}.00</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={achBatchCount}
                      onChange={(e) => setAchBatchCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Fixed Base Account & Token Fees:</span>
                    <span className="font-mono text-slate-200">${baseAccountFee + tokenFee}.00</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-sm font-semibold">
                    <span className="text-white">Total Gross Treasury Service Fees:</span>
                    <span className="font-mono text-cyan-400">${estimatedMonthlyFees.toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Treasury Efficiency Analysis</span>
                </h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>ECR Soft Dollar Offset Ratio</span>
                      <span className="font-mono text-cyan-400">{Math.min(100, Math.round((calculatedEcrAllowance / estimatedMonthlyFees) * 100))}% Offset</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (calculatedEcrAllowance / estimatedMonthlyFees) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Capital Earning Hard Interest</span>
                      <span className="font-mono text-emerald-400">{Math.round((sweptToMma / totalTreasury) * 100)}% Swept</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((sweptToMma / totalTreasury) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-xl mt-4 text-slate-300 space-y-1">
                    <div className="font-semibold text-cyan-400 flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      tximhotep-engine Recommendation
                    </div>
                    <p>
                      Your ${targetDda.toLocaleString()} target DDA generates <strong className="text-white">${calculatedEcrAllowance.toFixed(2)}</strong> in ECR credits, completely neutralizing your ${estimatedMonthlyFees.toFixed(2)} in monthly bank service fees while capturing <strong className="text-emerald-400">${Math.round(annualMmaInterest).toLocaleString()}/yr</strong> in net cash yield.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SPENDING POLICY GUARDRAILS SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-cyan-400" />
                    <span>tximhotep-engine Policy Guardrails Simulator</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Stress-test corporate spend caps against entity treasury reserves</p>
                </div>

                <div className="mt-4 md:mt-0 flex items-center space-x-3">
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${
                    (softwareViolation || payrollViolation || reserveViolation)
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {(softwareViolation || payrollViolation || reserveViolation) ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Policy Violation Triggered</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>All Policy Rules Compliant</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                {/* Left Side: Sliders */}
                <div className="space-y-6">
                  {/* Total Treasury Pool */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-300">Total Corporate Treasury Pool</label>
                      <span className="font-mono text-sm text-cyan-400 font-bold">${totalTreasury.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="60000"
                      max="300000"
                      step="5000"
                      value={totalTreasury}
                      onChange={(e) => setTotalTreasury(Number(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>$60,000</span>
                      <span>$300,000</span>
                    </div>
                  </div>

                  {/* Monthly Software Spend */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                        <span>Multi-Cloud Sandbox & SaaS Spend</span>
                        {softwareViolation && <span className="text-rose-400 text-[10px] bg-rose-500/10 border border-rose-500/30 px-1.5 rounded">Cap Exceeded</span>}
                      </label>
                      <span className={`font-mono text-sm font-bold ${softwareViolation ? 'text-rose-400' : 'text-slate-200'}`}>
                        ${monthlySoftware.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="35000"
                      step="500"
                      value={monthlySoftware}
                      onChange={(e) => setMonthlySoftware(Number(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>$2,000</span>
                      <span>Policy Limit: ${maxSoftwareLimit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Monthly Payroll & Contractor Spend */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                        <span>Contractor Payroll & Operations</span>
                        {payrollViolation && <span className="text-rose-400 text-[10px] bg-rose-500/10 border border-rose-500/30 px-1.5 rounded">Cap Exceeded</span>}
                      </label>
                      <span className={`font-mono text-sm font-bold ${payrollViolation ? 'text-rose-400' : 'text-slate-200'}`}>
                        ${monthlyPayroll.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5000"
                      max="45000"
                      step="1000"
                      value={monthlyPayroll}
                      onChange={(e) => setMonthlyPayroll(Number(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>$5,000</span>
                      <span>Policy Limit: ${maxPayrollLimit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Target DDA Peg */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-300">TCB Operating Target DDA Peg</label>
                      <span className="font-mono text-sm text-cyan-400 font-bold">${targetDda.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="10000"
                      max="75000"
                      step="2500"
                      value={targetDda}
                      onChange={(e) => setTargetDda(Number(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>$10,000</span>
                      <span>$75,000</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Compliance Badges & Status */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">tximhotep-engine Policy Badges</h4>

                  {/* ECR Fee Neutrality Rule */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    ecrFullyCovered 
                      ? 'bg-emerald-950/20 border-emerald-500/40' 
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {ecrFullyCovered ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white">Rule 01: ECR Fee Break-Even Met</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">DDA balance generates sufficient credit to neutralize bank fees.</div>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold ${ecrFullyCovered ? 'text-emerald-400' : 'text-amber-400'}`}>
                        ${calculatedEcrAllowance.toFixed(0)} / ${estimatedMonthlyFees.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Cloud Sandbox Cap */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    softwareViolation 
                      ? 'bg-rose-950/20 border-rose-500/40' 
                      : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {softwareViolation ? (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white">Rule 02: Multi-Cloud Sandbox Cap</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Max SaaS/Cloud spend cap: ${maxSoftwareLimit.toLocaleString()}/mo</div>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold ${softwareViolation ? 'text-rose-400' : 'text-slate-300'}`}>
                        ${monthlySoftware.toLocaleString()}
                      </span>
                    </div>
                    {softwareViolation && (
                      <div className="mt-3 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                        <strong>Policy Action:</strong> Virtual card limits locked. Dual-control approval required for increase.
                      </div>
                    )}
                  </div>

                  {/* Contractor Payroll Ceiling */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    payrollViolation 
                      ? 'bg-rose-950/20 border-rose-500/40' 
                      : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {payrollViolation ? (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white">Rule 03: Contractor Payroll Ceiling</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Max allowed payroll ceiling: ${maxPayrollLimit.toLocaleString()}/mo</div>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold ${payrollViolation ? 'text-rose-400' : 'text-slate-300'}`}>
                        ${monthlyPayroll.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Executive MMA Reserve Threshold */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    reserveViolation 
                      ? 'bg-rose-950/20 border-rose-500/40' 
                      : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {reserveViolation ? (
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white">Rule 04: Yield Preservation Threshold (&gt;$25k)</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Minimum swept MMA liquidity buffer: ${minReserveBuffer.toLocaleString()}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold ${reserveViolation ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${sweptToMma.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MERCURY VS RAMP ARCHITECTURAL EVALUATION */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <span>Mercury vs Ramp: Architectural Evaluation Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Comparing fintech treasury platforms for TxImhotep LLC deployment</p>
                </div>

                <div className="mt-4 md:mt-0 flex items-center space-x-3 text-xs">
                  <span className="flex items-center text-cyan-400 font-semibold bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5 mr-1" /> Mercury: Treasury Sweep Choice
                  </span>
                  <span className="flex items-center text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5 mr-1" /> Ramp: Card & Policy Guardrail Choice
                  </span>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Evaluation Criteria</th>
                      <th className="py-3 px-4 font-semibold text-cyan-400 w-1/3">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4" />
                          <span>Mercury (Neobank & Treasury)</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 font-semibold text-amber-400 w-1/3">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4" />
                          <span>Ramp (Spend & Policy Control)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Core Architectural Domain</div>
                        <div className="text-[11px] text-slate-400">Primary focus</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="font-semibold text-white">Treasury & Bank Liquidity</span>
                        <p className="text-[11px] text-slate-400 mt-1">Multi-vault checking, high-yield sweeps, and FDIC extended insurance.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="font-semibold text-white">Corporate Card & Expense Control</span>
                        <p className="text-[11px] text-slate-400 mt-1">Granular card limits, automated receipt matching, vendor locking.</p>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Treasury Yield & Sweeps</div>
                        <div className="text-[11px] text-slate-400">Yield generation</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Check className="w-4 h-4 mr-1" /> Automated Treasury Yield (5.0%+)
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Direct sweep into Vanguard/BlackRock money market funds with $5M FDIC sweeps.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="inline-flex items-center text-slate-400">
                          <Minus className="w-4 h-4 mr-1 text-amber-500" /> 1.5% Card Cashback Rebate
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Rebate-focused on card spend rather than primary treasury liquidity sweeps.</p>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Spend Policy Guardrails</div>
                        <div className="text-[11px] text-slate-400">Card & vendor limits</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="text-slate-300">Standard User & Debit Caps</span>
                        <p className="text-[11px] text-slate-400 mt-1">Basic monthly limit parameters on issued debit cards.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Check className="w-4 h-4 mr-1" /> Granular Vendor-Level Lock
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Single-vendor virtual cards with exact spending caps and automatic blocking.</p>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Programmatic APIs</div>
                        <div className="text-[11px] text-slate-400">Developer integrations</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Code2 className="w-4 h-4 mr-1" /> First-Class REST Treasury API
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Programmatic ACH/wire origination, sub-account creation, transaction webhooks.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="text-slate-300">ERP & Accounting APIs</span>
                        <p className="text-[11px] text-slate-400 mt-1">Deep integration with NetSuite, QuickBooks, and Workday for expense coding.</p>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Dual-Control Authorizations</div>
                        <div className="text-[11px] text-slate-400">Governance & security</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="text-slate-300">Multi-Admin Wire Approvals</span>
                        <p className="text-[11px] text-slate-400 mt-1">Enforces dual sign-off on outgoing wire transactions exceeding thresholds.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Check className="w-4 h-4 mr-1" /> Multi-Level Approval Chains
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Manager & CFO approval routing based on department, amount, or merchant category.</p>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="font-semibold">Multi-Cloud / Terraform Integration</div>
                        <div className="text-[11px] text-slate-400">DevOps infrastructure synergy</div>
                      </td>
                      <td className="py-4 px-4 bg-cyan-950/10">
                        <span className="text-cyan-400 font-mono">Custom Provider via Token API</span>
                        <p className="text-[11px] text-slate-400 mt-1">Automates treasury sub-account creation during environment provisioning.</p>
                      </td>
                      <td className="py-4 px-4 bg-amber-950/10">
                        <span className="text-amber-400 font-mono">SCIM / Okta Provisioning</span>
                        <p className="text-[11px] text-slate-400 mt-1">Auto-issues developer sandbox virtual cards alongside cloud IAM credentials.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Hybrid Recommendation Card */}
              <div className="mt-8 p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>TxImhotep LLC Recommended Hybrid Architecture</span>
                    </h4>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      Deploy <strong className="text-cyan-400">Texas Capital Bank (or Mercury)</strong> as the primary treasury vault for ECR fee neutralization and Executive MMA yield sweeps, paired with <strong className="text-amber-400">Ramp</strong> for granular virtual card policy guardrails across software subscriptions and contractor disbursements.
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <span className="text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-xl font-mono">
                      tximhotep-engine Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}