import React from 'react';
import { InstitutionalProfile, INSTITUTIONAL_PROFILES } from '../services/utmService';
import { Building2, Sparkles, SlidersHorizontal, BarChart3, ShieldCheck, ArrowRight, Cpu } from 'lucide-react';

interface UtmPersonalizationBannerProps {
  activeProfile: InstitutionalProfile;
  onSelectProfile: (profile: InstitutionalProfile) => void;
  onOpenPipelineModal: () => void;
  onOpenGtmModal?: () => void;
  onOpenTreasuryModal?: () => void;
}

export const UtmPersonalizationBanner: React.FC<UtmPersonalizationBannerProps> = ({
  activeProfile,
  onSelectProfile,
  onOpenPipelineModal,
  onOpenGtmModal,
  onOpenTreasuryModal
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Top Row: Welcome Message & Interactive Campaign Simulator Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-400">Institutional Perspective:</span>
              <span className="text-white font-bold">{activeProfile.name}</span>
              <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded font-semibold text-[10px]">
                {activeProfile.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-sans leading-relaxed">
              {activeProfile.welcomeMessage} &middot; <span className="text-cyan-300 font-mono text-[11px]">{activeProfile.keyStatute}</span>
            </p>
          </div>
        </div>

        {/* Interactive UTM Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            UTM Simulator:
          </span>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
            {INSTITUTIONAL_PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProfile(p)}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer text-[11px] ${
                  activeProfile.id === p.id
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.vertical}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Entry Wedge Callout ($3,500 / $5,000) & Commercial Pipeline Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Entry Wedge Program:</span>
          <strong className="text-white">3-Day Rapid Cloud Readiness Audit</strong>
          <span className="text-cyan-300 font-bold">($3,500 Single / $5,000 Multi-Cloud)</span>
          <span className="hidden md:inline text-slate-400">&middot; 100% credited toward annual subscription</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenTreasuryModal && (
            <button
              onClick={onOpenTreasuryModal}
              className="text-cyan-300 hover:text-cyan-200 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Treasury Guardrails</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {onOpenGtmModal && (
            <button
              onClick={onOpenGtmModal}
              className="text-emerald-400 hover:text-emerald-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>GTM Playbook</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={onOpenPipelineModal}
            className="text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Texas Pipeline</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
