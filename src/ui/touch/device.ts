import type { Insets } from '../../input/touch';

/**
 * Device capability helpers for phones/tablets: render quality tiers,
 * adaptive resolution, safe-area insets and touch detection. Presentation
 * only; nothing here may reach the sim.
 *
 * Knobs (see docs/MOBILE.md):
 * - `?q=low|mid|high` URL param or `localStorage['slag.quality']` pins a tier
 *   (and disables adaptive downgrades).
 * - Auto: desktop → high (unchanged); touch/small screens → mid, or low on
 *   ≤4 cores / ≤3 GB RAM. Mobile tiers also step down at runtime when frames
 *   run slow (FrameBudget).
 */

export type QualityTier = 'high' | 'mid' | 'low';

/**
 * Per tier: `maxW` caps the internal render width (all three scene canvases,
 * the WebGL target and the HUD scale with it; bloom buffers are ¼ / ⅛ of it)
 * and `dprCap` caps devicePixelRatio before that.
 */
export const QUALITY: Record<QualityTier, { maxW: number; dprCap: number }> = {
  high: { maxW: 1920, dprCap: 4 },
  mid: { maxW: 1280, dprCap: 2 },
  low: { maxW: 896, dprCap: 1.5 },
};

export const TIERS: readonly QualityTier[] = ['high', 'mid', 'low'];

export interface DeviceHints {
  coarse: boolean;
  shortSide: number;
  cores?: number;
  memoryGB?: number;
}

/** Pure tier choice from device hints (unit tested). */
export function pickTier(d: DeviceHints): QualityTier {
  const mobile = d.coarse || d.shortSide < 500;
  if (!mobile) return 'high';
  if ((d.cores !== undefined && d.cores <= 4) || (d.memoryGB !== undefined && d.memoryGB <= 3)) return 'low';
  return 'mid';
}

/** True on touch-first devices (phones, tablets): show touch controls from the start. */
export function isTouchFirst(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia?.('(pointer: coarse)').matches;
}

/** Tier for this device, plus whether runtime downgrades are allowed. */
export function detectQuality(): { tier: QualityTier; adaptive: boolean } {
  const pinned = pinnedTier();
  if (pinned) return { tier: pinned, adaptive: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const tier = pickTier({
    coarse: isTouchFirst(),
    shortSide: Math.min(screen.width, screen.height),
    cores: nav.hardwareConcurrency || undefined,
    memoryGB: nav.deviceMemory,
  });
  // Automation (screenshots) must stay deterministic: no runtime downgrades under webdriver.
  return { tier, adaptive: tier !== 'high' && !nav.webdriver };
}

const QUALITY_KEY = 'slag.quality';
const asTier = (v: string | null) => ((TIERS as readonly string[]).includes(v ?? '') ? (v as QualityTier) : null);

function pinnedTier(): QualityTier | null {
  return asTier(new URLSearchParams(location.search).get('q')) ?? savedQuality();
}

/** The tier picked in Settings, or null for automatic. */
export function savedQuality(): QualityTier | null {
  try {
    return asTier(localStorage.getItem(QUALITY_KEY));
  } catch {
    return null;
  }
}

/** Remember a Settings pick (null = automatic). */
export function saveQuality(tier: QualityTier | null): void {
  try {
    if (tier) localStorage.setItem(QUALITY_KEY, tier);
    else localStorage.removeItem(QUALITY_KEY);
  } catch {
    // Not persisted; still applies this session.
  }
}

/**
 * Watches real frame intervals and says when to drop a tier: a sustained
 * average under ~45 fps (2 s) triggers one step down, then a cooldown.
 * Never steps back up, so it can't oscillate. Long gaps (tab hidden,
 * debugger, paused loop) are ignored.
 */
export class FrameBudget {
  private ema = 1000 / 60;
  private slow = 0;
  private cooldown = 0;
  constructor(
    private budgetMs = 22,
    private sustainFrames = 120,
  ) {}

  /** Feed one frame interval; true = step down a tier now. */
  push(dtMs: number): boolean {
    if (!(dtMs > 0) || dtMs > 250) return false;
    this.ema += (dtMs - this.ema) * 0.08;
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    this.slow = this.ema > this.budgetMs ? this.slow + 1 : 0;
    if (this.slow < this.sustainFrames) return false;
    this.slow = 0;
    this.cooldown = 180;
    this.ema = 1000 / 60;
    return true;
  }
}

let probe: HTMLDivElement | null = null;

/** Current CSS safe-area insets (notch / home indicator), read through a hidden probe element. */
export function safeInsets(): Insets {
  if (typeof document === 'undefined' || !document.body) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v: string) => Number.parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}
