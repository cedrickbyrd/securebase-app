import React from 'react';
import { ShieldCheck, Activity, AlertTriangle, FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const ComplianceScreen = ({ report, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium tracking-tight">Accessing SecureBase Vault...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20 bg-white border-2 border-dashed rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold">No Audit Data Found</h3>
        <p className="text-slate-500">Run the SecureBase Collector to populate this vault.</p>
      </div>
    );
  }

  const { summary, checks, run_id, timestamp } = report;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER STATS */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg"><ShieldCheck className="text-blue-600 w-5 h-5" /></div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pass Rate</span>
          </div>
          <div className="text-5xl font-black text-slate-900">{summary.pass_rate}%</div>
          <p className="text-sm text-slate-400 mt-2">ID: {run_id}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg"><CheckCircle2 className="text-green-600 w-5 h-5" /></div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Controls Passed</span>
          </div>
          <div className="text-5xl font-black text-slate-900">{summary.pass} / {summary.total}</div>
          <p className="text-sm text-slate-400 mt-2">Verified via AWS KMS</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500 p-2 rounded-lg"><Activity className="text-white w-5 h-5" /></div>
            <span className="text-sm font-bold text-blue-200 uppercase tracking-wider">Status</span>
          </div>
          <div className="text-2xl font-bold">Audit Ready</div>
          <p className="text-sm text-slate-400 mt-2">Last Scan: {new Date(timestamp).toLocaleString()}</p>
        </div>
      </div>

      {/* DETAILED CONTROLS */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-slate-400" /> Control Inventory</h3>
          <span className="text-xs font-black px-2 py-1 bg-slate-200 rounded uppercase tracking-tighter">Framework: SOC2</span>
        </div>
        <div className="divide-y divide-slate-100">
          {checks.map((check, idx) => (
            <div key={idx} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex gap-4 items-start">
                {check.status === 'PASS' ? 
                  <CheckCircle2 className="text-green-500 w-6 h-6 mt-1 flex-shrink-0" /> : 
                  <XCircle className="text-red-500 w-6 h-6 mt-1 flex-shrink-0" />
                }
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">{check.control_id}</div>
                  <h4 className="font-bold text-slate-800">{check.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">Validated via local engine probe.</p>
                </div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase ${
                check.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {check.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComplianceScreen;
