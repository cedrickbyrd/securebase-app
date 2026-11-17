import React from 'react';
import { ComplianceDrift } from './tenant/ComplianceDrift';
import { X, TrendingUp, ShieldCheck } from 'lucide-react';

interface ComplianceDriftModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
}

export const ComplianceDriftModal: React.FC<ComplianceDriftModalProps> = ({
  isOpen,
  onClose,
  tenantId = 'cnb-waxahachie'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 mb-1">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>TXIMHOTEP LLC &middot; TENANT COMPLIANCE DRIFT ANALYTICS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              90-Day Regulatory Drift Timeline &amp; MTTR Analytics
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Automated drift detection, root cause breakdown, non-destructive HCL patches, and SHA-256 evidence digests
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

        {/* Embedded Tenant Component */}
        <ComplianceDrift tenantId={tenantId} />

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Shift-Left PR Gate Enforced &middot; WORM Immutable Retention</span>
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
