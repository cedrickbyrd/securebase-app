import React, { useState } from 'react';
import { STATUTORY_CONTROLS } from '../data/statutoryControls';
import { StatutoryControl, StatutoryFramework } from '../types/compliance';
import { Search, Shield, BookOpen, ExternalLink } from 'lucide-react';

export const ControlMatrixViewer: React.FC = () => {
  const [selectedFramework, setSelectedFramework] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedControl, setSelectedControl] = useState<StatutoryControl | null>(STATUTORY_CONTROLS[0]);

  const filteredControls = STATUTORY_CONTROLS.filter(c => {
    const matchesFw = selectedFramework === 'ALL' || c.framework === selectedFramework;
    const matchesSearch =
      c.controlId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.controlName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFw && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span>REGULATORY CONTROL MATRICES</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authoritative statutory references mapped to AST pre-flight evaluation and autonomous HCL remediation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs font-mono">
              {['ALL', 'FFIEC', 'SOC2', 'HIPAA', 'NIST80053'].map(fw => (
                <button
                  key={fw}
                  onClick={() => setSelectedFramework(fw)}
                  className={`px-3 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                    selectedFramework === fw
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {fw}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Control ID, statute name, or keyword (e.g. CMEK, WORM, TLS, 0.0.0.0/0)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid: Master list on left, detail view on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Master List */}
        <div className="lg:col-span-5 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filteredControls.map((ctrl) => (
            <div
              key={`${ctrl.framework}-${ctrl.controlId}`}
              onClick={() => setSelectedControl(ctrl)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedControl?.controlId === ctrl.controlId && selectedControl.framework === ctrl.framework
                  ? 'bg-slate-800/90 border-cyan-500/60 shadow-md'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {ctrl.framework} &middot; {ctrl.controlId}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {ctrl.category}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 leading-snug">
                {ctrl.controlName}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                {ctrl.description}
              </p>
            </div>
          ))}

          {filteredControls.length === 0 && (
            <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl text-slate-500 font-mono text-xs">
              No controls matching query "{searchQuery}"
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-7">
          {selectedControl ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5 sticky top-20">
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between font-mono text-xs text-slate-400 mb-1">
                  <span>{selectedControl.framework} &middot; {selectedControl.category}</span>
                  <span className="text-cyan-400 font-bold">{selectedControl.controlId}</span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {selectedControl.controlName}
                </h2>
              </div>

              <div>
                <span className="text-xs font-mono text-slate-400 block mb-1">
                  Statutory Reference:
                </span>
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded font-mono text-xs text-slate-300">
                  {selectedControl.statutoryReference}
                </div>
              </div>

              <div>
                <span className="text-xs font-mono text-slate-400 block mb-1">
                  Statutory Mandate &amp; Examination Criterion:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded border border-slate-800/60 font-sans">
                  {selectedControl.description}
                </p>
              </div>

              <div>
                <span className="text-xs font-mono text-cyan-400 block mb-1">
                  SecureBase Autonomous Remediation Guidance:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed bg-cyan-950/20 p-3.5 rounded border border-cyan-900/30 font-sans">
                  {selectedControl.remediationAdvice}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Evaluated via Abstract Syntax Tree (AST)</span>
                <span>TxImhotep LLC Sovereign Baseline</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl text-slate-500 font-mono text-xs">
              Select a control to view detailed statutory parameters
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
