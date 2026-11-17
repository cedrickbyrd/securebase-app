import React from 'react';
import { TEXAS_PIPELINE_DATA } from '../services/utmService';
import {
  BarChart3,
  X,
  Building,
  DollarSign,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  Layers,
  Award
} from 'lucide-react';

interface CommercialPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommercialPipelineModal: React.FC<CommercialPipelineModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const data = TEXAS_PIPELINE_DATA;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 mb-1">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>TXIMHOTEP LLC &middot; COMMERCIAL MOTION &amp; PIPELINE TRACKER</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Texas Banks &amp; Healthcare Outreach Tracker
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target institutional pipeline, 3-Day Rapid Audit wedge program, and GA4 attribution metrics
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[11px]">Total Institutional Targets</span>
            <div className="text-xl font-bold text-white">{data.totalTargets}</div>
            <span className="text-[10px] text-slate-500">13 Tier 1 &middot; 11 Tier 2 &middot; 4 CUs</span>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[11px]">Target CARR Run Rate</span>
            <div className="text-xl font-bold text-emerald-400">{data.targetCarr}</div>
            <span className="text-[10px] text-slate-500">Target MRR: {data.targetMrr}</span>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[11px]">Average Contract Value</span>
            <div className="text-xl font-bold text-cyan-300">{data.averageMonthlyContract}/mo</div>
            <span className="text-[10px] text-slate-500">Range: {data.contractRange}</span>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[11px]">6-Month Target Wins</span>
            <div className="text-xl font-bold text-purple-400">{data.sixMonthTargetAccounts} Accounts</div>
            <span className="text-[10px] text-slate-500">12 Closed Institutional Pilots</span>
          </div>
        </div>

        {/* Entry Wedge Card */}
        <div className="p-5 bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 border border-cyan-800/50 rounded-xl space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              {data.entryWedge.programName}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-cyan-300 font-bold">Single Cloud: {data.entryWedge.singleCloudPrice}</span>
              <span className="text-slate-500">&middot;</span>
              <span className="text-emerald-300 font-bold">Multi-Cloud: {data.entryWedge.multiCloudPrice}</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Delivers an authoritative 3-day pre-flight IaC gap analysis and formal FDIC/OCC readiness binder.
            <strong className="text-emerald-400 font-semibold font-mono ml-1">
              {data.entryWedge.incentive}.
            </strong>
          </p>
        </div>

        {/* Pipeline Status & Channel Mix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          {/* Status Breakdown */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider">
              Pipeline Status Breakdown (28 Accounts)
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                <span className="text-slate-300">In Active Pipeline</span>
                <span className="font-bold text-cyan-400">{data.pipelineStatus.inPipeline} Accounts</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                <span className="text-slate-300">Initial Contact Made</span>
                <span className="font-bold text-purple-400">{data.pipelineStatus.contacted} Accounts</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                <span className="text-slate-300">Prospective Qualified</span>
                <span className="font-bold text-emerald-400">{data.pipelineStatus.prospective} Accounts</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                <span className="text-slate-400">Target Accounts Remaining</span>
                <span className="font-bold text-slate-400">{data.pipelineStatus.notContacted} Accounts</span>
              </div>
            </div>
          </div>

          {/* GA4 Attribution & Geographies */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider">
              GA4 Attribution &amp; Regional Traffic
            </h3>
            <div className="space-y-2 text-slate-300">
              <div className="p-2 bg-slate-900 rounded">
                <span className="text-slate-400 block text-[10px]">Active Engagement:</span>
                <span className="text-emerald-400 font-semibold">{data.ga4Attribution.activeUsersOnCompliance}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded">
                <span className="text-slate-400 block text-[10px]">Attributed Sessions:</span>
                <span className="text-slate-200">{data.ga4Attribution.verifiedEmailAttribution}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded">
                <span className="text-slate-400 block text-[10px]">Active Regional Markets:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {data.ga4Attribution.activeGeographies.map((geo, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-cyan-300">
                      {geo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-mono">
          <span className="text-slate-500">Active UTM Standard: Canonical v2.1 Enforced</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
