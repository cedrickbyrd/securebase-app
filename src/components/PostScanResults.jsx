/**
 * PostScanResults — renders the post-scan UI overlays:
 *
 *  • <FindingsToast>     – Phase 3: bottom-right resolved-issues notification
 *  • <CTABanner>         – Phase 4: call-to-action card below the score cards
 *  • <ComparisonBanner>  – Phase 5: industry-average comparison nudge
 *  • <ScanCompleteCheck> – Phase 1: green checkmark overlay
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CTA_VARIANTS } from '../hooks/usePostScanFlow';

// ---------------------------------------------------------------------------
// Phase 1: scan-complete checkmark overlay
// ---------------------------------------------------------------------------

export function ScanCompleteCheck({ visible, scanTimeSeconds = 3.6 }) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
      <div className="animate-scale-in bg-white rounded-2xl shadow-2xl border border-green-200 px-10 py-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-9 h-9 text-green-600 animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-bold text-slate-900">Scan Complete</p>
        <p className="text-sm text-slate-500">Finished in {scanTimeSeconds}s</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3: findings toast
// ---------------------------------------------------------------------------

export function FindingsToast({ findings, onDismiss }) {
  if (!findings) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 w-80 animate-slide-up"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-green-200 overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-sm">
            🎉 {findings.resolved} issues auto-resolved!
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss findings"
            className="text-green-100 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Details */}
        <ul className="px-4 py-3 space-y-1.5">
          {findings.details.map((detail, idx) => (
            <li
              key={idx}
              className="text-xs text-slate-700 animate-fade-in"
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
            >
              {detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 4: CTA banner
// ---------------------------------------------------------------------------

export function CTABanner({ ctaVariant, onDismiss, onButtonClick }) {
  const navigate = useNavigate();
  const copy = CTA_VARIANTS[ctaVariant] ?? CTA_VARIANTS.a;

  const handleButton = (btn) => {
    onButtonClick && onButtonClick(btn.track);
    if (btn.href) {
      navigate(btn.href);
    }
    // 'generatePDF' action is handled by the parent component if needed
  };

  return (
    <div
      role="complementary"
      aria-label="Call to action"
      className="animate-fade-in mt-6 rounded-2xl border border-purple-200 bg-gradient-to-r from-[#667eea] to-[#764ba2] p-6 text-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-200 mb-1">
            Next Step
          </p>
          <h3 className="text-xl font-black mb-1">{copy.title}</h3>
          <p className="text-purple-100 text-sm mb-4">{copy.message}</p>

          <div className="flex flex-wrap gap-3">
            {copy.buttons.map((btn) => (
              <button
                key={btn.track}
                type="button"
                onClick={() => handleButton(btn)}
                className={
                  btn.style === 'primary'
                    ? 'px-5 py-2.5 bg-white text-purple-700 font-bold rounded-xl text-sm hover:bg-purple-50 transition-colors shadow-md animate-pulse-once'
                    : 'px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl text-sm border border-white/30 transition-colors'
                }
              >
                {btn.text}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss call to action"
          className="text-purple-200 hover:text-white transition-colors text-2xl leading-none mt-1 flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 5: industry comparison banner
// ---------------------------------------------------------------------------

export function ComparisonBanner({ yourScore, onDismiss }) {
  const industryAvg = 67;
  const delta = yourScore - industryAvg;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-6 z-50 w-72 animate-slide-up"
    >
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Industry Comparison
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss comparison"
            className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-2xl font-black text-green-400 mb-0.5">
          ↑ {delta}% above average
        </p>
        <p className="text-xs text-slate-400">
          Your score: <strong className="text-white">{yourScore}%</strong>
          &nbsp;·&nbsp;Industry avg: <strong className="text-slate-300">{industryAvg}%</strong>
        </p>

        <div className="mt-3 relative h-2 rounded-full bg-slate-700">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
            style={{ width: `${yourScore}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded-sm bg-amber-400 opacity-80"
            style={{ left: `${industryAvg}%` }}
            title={`Industry avg: ${industryAvg}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
