import React from 'react';
import { supabase } from '../services/supabaseService';
import { Shield, Landmark, HeartPulse, Building2, CheckCircle2, AlertOctagon } from 'lucide-react';

interface FrameworkToggleBarProps {
  activeFramework: 'FFIEC' | 'HIPAA' | 'NIST80053';
  onFrameworkChange: (fw: 'FFIEC' | 'HIPAA' | 'NIST80053') => void;
}

export const FrameworkToggleBar: React.FC<FrameworkToggleBarProps> = ({
  activeFramework,
  onFrameworkChange
}) => {
  const posture = supabase.calculatePostureScore(activeFramework);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Selector Zone */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-xs font-mono text-slate-400 font-semibold whitespace-nowrap">
          Statutory Framework Focus:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
          <button
            onClick={() => onFrameworkChange('FFIEC')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeFramework === 'FFIEC'
                ? 'bg-slate-800 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-cyan-400" />
            <span>Texas Banking (FFIEC / FDIC)</span>
          </button>

          <button
            onClick={() => onFrameworkChange('HIPAA')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeFramework === 'HIPAA'
                ? 'bg-slate-800 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
            <span>Healthcare (HIPAA §164.312)</span>
          </button>

          <button
            onClick={() => onFrameworkChange('NIST80053')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeFramework === 'NIST80053'
                ? 'bg-slate-800 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Defense (FedRAMP / NIST 800-53)</span>
          </button>
        </div>
      </div>

      {/* Posture Scoreboard Card */}
      <div className="flex items-center gap-4 font-mono text-xs border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 shrink-0">
        <div>
          <span className="text-slate-400 block text-[11px]">Posture Score:</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-lg font-bold tabular-nums ${
                posture.score >= 80
                  ? 'text-emerald-400'
                  : posture.score >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {posture.score}/100
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              (Live Index)
            </span>
          </div>
        </div>

        <div>
          <span className="text-slate-400 block text-[11px]">Statutory Status:</span>
          <span
            className={`font-bold text-xs uppercase ${
              posture.status === 'COMPLIANT'
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            [{posture.status}]
          </span>
        </div>
      </div>
    </div>
  );
};
