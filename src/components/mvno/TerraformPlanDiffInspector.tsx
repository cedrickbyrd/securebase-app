import React, { useEffect, useState, useMemo } from 'react';
import {
  GitCompare,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { SovereignPerimeter } from '../../data/mvnoData';
import {
  fetchTerraformPlanDiff,
  TerraformDiffItem,
  TerraformDiffResponse
} from '../../services/mvnoApiService';

interface TerraformPlanDiffInspectorProps {
  activePerimeter: SovereignPerimeter;
}

type ActionFilter = 'all' | 'create' | 'update' | 'destroy';

export const TerraformPlanDiffInspector: React.FC<TerraformPlanDiffInspectorProps> = ({
  activePerimeter
}) => {
  const [planData, setPlanData] = useState<TerraformDiffResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scopeOnly, setScopeOnly] = useState<boolean>(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);

  const loadDiffs = async (filterByActiveScope: boolean) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTerraformPlanDiff(
        filterByActiveScope ? activePerimeter.id : undefined
      );
      setPlanData(data);
      if (data.diffs.length > 0) {
        setSelectedDiffId((prev) =>
          data.diffs.some((d) => d.id === prev) ? prev : data.diffs[0].id
        );
      } else {
        setSelectedDiffId(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch Terraform plan diff');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiffs(scopeOnly);
  }, [scopeOnly, activePerimeter.id]);

  const filteredDiffs = useMemo(() => {
    if (!planData) return [];
    if (actionFilter === 'all') return planData.diffs;
    return planData.diffs.filter((d) => d.action === actionFilter);
  }, [planData, actionFilter]);

  const selectedDiff: TerraformDiffItem | null = useMemo(() => {
    if (filteredDiffs.length === 0) return null;
    return filteredDiffs.find((d) => d.id === selectedDiffId) || filteredDiffs[0];
  }, [filteredDiffs, selectedDiffId]);

  return (
    <div className="space-y-6">
      {/* Header & Scope Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">
            Phase 1 to Phase 2 Terraform Plan Diff Inspector
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspects planned OpenTofu/Terraform resource transitions when graduating from Phase 1 Aggregator VPN to Phase 2 Sovereign Thick Core at Client #10.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono shrink-0">
          <button
            onClick={() => setScopeOnly(false)}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              !scopeOnly
                ? 'bg-slate-800 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Perimeters (3)
          </button>
          <button
            onClick={() => setScopeOnly(true)}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              scopeOnly
                ? 'bg-slate-800 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {activePerimeter.label} Only
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-mono text-rose-300 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button
            onClick={() => loadDiffs(scopeOnly)}
            className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-800/60 border border-rose-700 rounded-lg text-white cursor-pointer whitespace-nowrap"
          >
            Retry Plan Load
          </button>
        </div>
      )}

      {/* Plan Summary Strip */}
      {planData && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span className="text-slate-400 flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-cyan-400" />
              <span>{planData.sourceEnv} -&gt; {planData.targetEnv}</span>
            </span>
            <span className="text-emerald-400 font-semibold">
              +{planData.counts.create} to add
            </span>
            <span className="text-amber-400 font-semibold">
              ~{planData.counts.update} to change
            </span>
            <span className="text-rose-400 font-semibold">
              -{planData.counts.destroy} to destroy
            </span>
          </div>

          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{planData.regoGateStatus}</span>
          </div>
        </div>
      )}

      {/* Action Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        {(
          [
            { id: 'all', label: 'All Planned Changes' },
            { id: 'create', label: '+ Create (Phase 2 Core)' },
            { id: 'update', label: '~ Modify (Retained WORM)' },
            { id: 'destroy', label: '- Retire (Phase 1 VPN)' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActionFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              actionFilter === tab.id
                ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resource Diff Split View */}
      {isLoading ? (
        <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
          Computing OpenTofu / Terraform Phase 1 to Phase 2 plan delta...
        </div>
      ) : filteredDiffs.length === 0 ? (
        <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
          No planned changes match the current filter. Select &quot;All Planned Changes&quot; to inspect all resource transitions.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Resource Delta List */}
          <div className="lg:col-span-5 space-y-2.5">
            {filteredDiffs.map((item) => {
              const isSelected = selectedDiff?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedDiffId(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/80 border-cyan-500/60'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-cyan-400">{item.perimeter}</span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        item.action === 'create'
                          ? 'text-emerald-400'
                          : item.action === 'update'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {item.action === 'create' && <PlusCircle className="w-3 h-3" />}
                      {item.action === 'update' && <RefreshCw className="w-3 h-3" />}
                      {item.action === 'destroy' && <MinusCircle className="w-3 h-3" />}
                      <span>{item.action.toUpperCase()}</span>
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-white mt-1 truncate">
                    {item.resourceAddress}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {item.summary}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: HCL Plan Diff & OPA Gate Detail */}
          {selectedDiff && (
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-cyan-400">{selectedDiff.phaseContext}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{selectedDiff.regoPolicy} · {selectedDiff.regoStatus}</span>
                  </span>
                </div>
                <div className="text-sm font-mono font-bold text-white break-all">
                  {selectedDiff.resourceAddress}
                </div>
                <p className="text-xs text-slate-300">{selectedDiff.summary}</p>
              </div>

              <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto flex-1 space-y-0.5">
                {selectedDiff.hclDiff.map((line, idx) => {
                  const colorClass = line.startsWith('+')
                    ? 'text-emerald-300 bg-emerald-950/25'
                    : line.startsWith('-')
                    ? 'text-rose-300 bg-rose-950/25'
                    : line.startsWith('~')
                    ? 'text-amber-300 bg-amber-950/20'
                    : 'text-slate-300';
                  return (
                    <div key={idx} className={`px-2 py-0.5 rounded ${colorClass}`}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
