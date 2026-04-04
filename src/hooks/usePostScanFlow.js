/**
 * usePostScanFlow — orchestrates the 5-phase post-scan experience.
 *
 * Phase 1: Scan Complete   (0–2 s)   — checkmark + confetti
 * Phase 2: Results Reveal  (2–5 s)   — animated score count-up
 * Phase 3: Findings Alert  (5–8 s)   — resolved-issues toast
 * Phase 4: CTA             (8–10 s)  — call-to-action banner/modal
 * Phase 5: Engagement      (ongoing) — comparison banner after idle
 */

import { useState, useRef, useCallback } from 'react';
import {
  trackDemoScanComplete,
  trackDemoFindingsViewed,
  trackDemoCTAShown,
  trackDemoCTAClick,
} from '../utils/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Animates a numeric value from `start` to `end` over `duration` ms,
 * calling `onTick(current)` on every animation frame.
 */
function animateValue(start, end, duration, onTick) {
  const startTime = performance.now();

  const tick = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    onTick(Math.round(start + (end - start) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/**
 * Lightweight canvas confetti burst — no external dependency.
 * Fires coloured particles from the centre of the viewport.
 */
function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
  const particles = Array.from({ length: 100 }, () => ({
    x: canvas.width * 0.5,
    y: canvas.height * 0.55,
    vx: (Math.random() - 0.5) * 18,
    vy: -(Math.random() * 14 + 4),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 7 + 4,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    gravity: 0.4 + Math.random() * 0.2,
    life: 1,
    decay: 0.012 + Math.random() * 0.01,
  }));

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach((p) => {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      p.life -= p.decay;

      if (p.life > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    });

    if (alive) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(draw);
}

// ---------------------------------------------------------------------------
// A/B variant selection (deterministic per session)
// ---------------------------------------------------------------------------

function pickCTAVariant() {
  try {
    const stored = sessionStorage.getItem('_sb_cta_variant');
    if (stored === 'a' || stored === 'b') return stored;
    const chosen = Math.random() < 0.5 ? 'a' : 'b';
    sessionStorage.setItem('_sb_cta_variant', chosen);
    return chosen;
  } catch {
    return 'a';
  }
}

// ---------------------------------------------------------------------------
// CTA copy for each variant
// ---------------------------------------------------------------------------

export const CTA_VARIANTS = {
  a: {
    title: 'Ready for Your Real Infrastructure?',
    message: 'Get the same compliance automation for your AWS account.',
    buttons: [
      { text: 'Start 30-Day Free Trial', style: 'primary', href: '/checkout', track: 'demo_cta_trial' },
      { text: 'Talk to Sales', style: 'secondary', href: '/pricing', track: 'demo_cta_sales' },
    ],
  },
  b: {
    title: 'Want This Score For Your Company?',
    message: '94% compliance in under 48 hours.',
    buttons: [
      { text: 'See Pricing →', style: 'primary', href: '/pricing', track: 'demo_cta_pricing' },
      { text: 'Download Sample Report', style: 'secondary', action: 'generatePDF', track: 'demo_cta_pdf' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Resolved findings shown in the Phase 3 toast
// ---------------------------------------------------------------------------

export const RESOLVED_FINDINGS = [
  '✓ GuardDuty enabled in us-west-2',
  '✓ MFA enforced for all users',
  '✓ S3 buckets encrypted',
  '✓ CloudTrail logging verified',
  '✓ Security groups hardened',
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param {object} [options]
 * @param {number} [options.initialScore=73] - Score before the scan.
 * @param {number} [options.finalScore=94]   - Score after the scan.
 */
export function usePostScanFlow({ initialScore = 73, finalScore = 94 } = {}) {
  const [phase, setPhase] = useState('idle');
  const [score, setScore] = useState(initialScore);
  const [findings, setFindings] = useState(null);
  const [showCTA, setShowCTA] = useState(false);
  const [ctaVariant] = useState(pickCTAVariant);
  const [showComparison, setShowComparison] = useState(false);
  const runningRef = useRef(false);
  const idleTimerRef = useRef(null);

  const runPostScanFlow = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    // Reset
    setPhase('idle');
    setScore(initialScore);
    setFindings(null);
    setShowCTA(false);
    setShowComparison(false);
    clearTimeout(idleTimerRef.current);

    // --- Phase 1: Scan Complete ---
    setPhase('complete');
    trackDemoScanComplete();

    if (finalScore > initialScore) {
      fireConfetti();
    }

    await sleep(2000);

    // --- Phase 2: Results Reveal ---
    setPhase('reveal');
    animateValue(initialScore, finalScore, 1500, setScore);

    await sleep(3000);

    // --- Phase 3: Findings Alert ---
    setPhase('findings');
    setFindings({
      resolved: RESOLVED_FINDINGS.length,
      newIssues: 0,
      details: RESOLVED_FINDINGS,
    });
    trackDemoFindingsViewed(RESOLVED_FINDINGS.length);

    await sleep(5000);

    // --- Phase 4: CTA ---
    setPhase('cta');
    setShowCTA(true);
    trackDemoCTAShown(ctaVariant);

    // --- Phase 5: Engagement loop — comparison banner after 30 s idle ---
    idleTimerRef.current = setTimeout(() => {
      setShowComparison(true);
    }, 30_000);

    runningRef.current = false;
  }, [initialScore, finalScore, ctaVariant]);

  const dismissFindings = useCallback(() => setFindings(null), []);
  const dismissCTA = useCallback(() => setShowCTA(false), []);
  const dismissComparison = useCallback(() => setShowComparison(false), []);

  return {
    phase,
    score,
    findings,
    showCTA,
    ctaVariant,
    showComparison,
    finalScore,
    runPostScanFlow,
    dismissFindings,
    dismissCTA,
    dismissComparison,
    trackCTAClick: trackDemoCTAClick,
  };
}
