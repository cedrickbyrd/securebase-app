import React, { useState } from 'react';
import { ControlEvaluationResult, StatutoryFramework } from '../types/compliance';
import { Copy, Check, Filter } from 'lucide-react';

interface StatutoryControlTableProps {
  controls: ControlEvaluationResult[];
}

export const StatutoryControlTable: React.FC<StatutoryControlTableProps> = ({ controls }) => {
  const [selectedFramework, setSelectedFramework] = useState<string>('ALL');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const filteredControls = selectedFramework === 'ALL'
    ? controls
    : controls.filter(c => c.framework === selectedFramework);

  // Generates exact markdown table string according to the strict prompt specification
  const generateMarkdownTable = () => {
    let md = '| Framework | Control ID | Control Name | Severity | Status |\n';
    md += '| :--- | :--- | :--- | :--- | :--- |\n';
    filteredControls.forEach(c => {
      md += `| ${c.framework} | ${c.controlId} | ${c.controlName} | ${c.severity} | ${c.status} |\n`;
    });
    return md;
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownTable();
    await navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="text-rose-400 font-mono font-bold">CRITICAL</span>;
      case 'HIGH':
        return <span className="text-amber-400 font-mono font-semibold">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-yellow-300 font-mono">MEDIUM</span>;
      default:
        return <span className="text-slate-400 font-mono">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            FAIL
          </span>
        );
      case 'DRIFT':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            DRIFT
          </span>
        );
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            PASS
          </span>
        );
      default:
        return <span className="font-mono text-slate-400">{status}</span>;
    }
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <span className="text-cyan-400 font-mono">2.</span>
            <span>STATUTORY CONTROL MAPPING TABLE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-referenced statutory matrix across FFIEC, SOC 2 Type II, HIPAA Security Rule, and NIST SP 800-53 Rev. 5
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Framework interactive segmented filter button */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs font-mono">
            {['ALL', 'FFIEC', 'SOC2', 'HIPAA', 'NIST80053'].map(fw => (
              <button
                key={fw}
                onClick={() => setSelectedFramework(fw)}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedFramework === fw
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {fw}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Copy as Markdown Table"
          >
            {copiedMarkdown ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* High-density Statutory Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
              <th className="py-2.5 px-4 font-semibold">Framework</th>
              <th className="py-2.5 px-4 font-semibold">Control ID</th>
              <th className="py-2.5 px-4 font-semibold">Control Name</th>
              <th className="py-2.5 px-4 font-semibold">Severity</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {filteredControls.map((control, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-300">
                  {control.framework}
                </td>
                <td className="py-3 px-4 text-cyan-400 font-bold">
                  {control.controlId}
                </td>
                <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                  <div>{control.controlName}</div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                    {control.findingDetails}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {getSeverityBadge(control.severity)}
                </td>
                <td className="py-3 px-4">
                  {getStatusBadge(control.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>Showing {filteredControls.length} of {controls.length} evaluated statutory controls</span>
        <span>Zero-Data-Custody AST Verification Active</span>
      </div>
    </section>
  );
};
