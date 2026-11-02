import { css, type HSL } from '../core/color';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { GameEvent } from '../sim/types';
import type { Camera } from './camera';

/**
 * The parts of the look that live on the Canvas2D side (bands and ink are `cel-shader.ts`): the
 * foreground layer and the impact words on sim events. Purely cosmetic: reads events, never writes sim state.
 */

const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", Impact, system-ui, sans-serif';
const INK = '#120b08';
/** Logical height of the HUD's prompt bar, which words stay clear of. */
const FOOTER = 26;
/** Height of the player chips along the top. */
const TOP = 26;

/**
 * Transparent albedo layer for everything the player interacts with (terrain, props, runners).
 * Splitting it from the backdrop is what lets ink follow real silhouettes, leaves the background
 * un-inked, and works whatever the colors underneath. Scenery stays on the background, behind the terrain. Sizes itself from the scene canvas each frame.
 */
export class ForegroundLayer {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;

  /**
   * Call once the backdrop is painted. Folds its emissives (sun, moon, skyline windows) into the flat
   * background: "glow belongs to hot things only" (docs/ART.md), and the cel pass treats whatever is
   * left on the emissive layer as a hazard-grade shape with bloom and an ink casing.
   */
  begin(like: HTMLCanvasElement, s: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, ambient: number): CanvasRenderingContext2D {
    s.save();
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'lighter';
    s.drawImage(glow.canvas, 0, 0);
    // The pass dims a dark theme's backdrop, and emissives are the one part of it that shouldn't: that's a volcano's glow.
    if (ambient < 0.7) s.drawImage(glow.canvas, 0, 0);
    s.restore();
    glow.save();
    glow.setTransform(1, 0, 0, 1, 0, 0);
    glow.clearRect(0, 0, like.width, like.height);
    glow.restore();
    if (this.canvas.width !== like.width || this.canvas.height !== like.height) {
      this.canvas.width = like.width;
      this.canvas.height = like.height;
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, like.width, like.height);
    return this.ctx;
  }
}

interface Word {
  text: string;
  x: number;
  y: number;
  fill: HSL;
  burst: HSL;
  size: number;
  rot: number;
  life: number;
  max: number;
  seed: number;
}

interface Pick {
  text: string;
  fill: HSL;
  burst: HSL;
  size: number;
}

const YELLOW: HSL = { h: 50, s: 100, l: 58 };
const WHITE: HSL = { h: 45, s: 60, l: 96 };
const RED: HSL = { h: 4, s: 90, l: 52 };
const CYAN: HSL = { h: 190, s: 95, l: 55 };
const ORANGE: HSL = { h: 26, s: 100, l: 55 };

/** `?lettering=0` turns impact words off for this page, to judge the picture without them. */
export function letteringAllowed(search: string): boolean {
  return new URLSearchParams(search).get('lettering') !== '0';
}

const oneOf = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** The word (if any) a sim event shouts. Cosmetic randomness only. */
export function wordFor(e: GameEvent): Pick | null {
  switch (e.type) {
    case 'death':
      if (e.cause === 'fall') return { text: 'SPLOOSH!', fill: CYAN, burst: WHITE, size: 20 };
      if (e.cause === 'crush') return { text: 'SQUISH!', fill: RED, burst: YELLOW, size: 20 };
      if (e.cause === 'pop') return { text: 'POP!', fill: YELLOW, burst: RED, size: 20 };
      if (e.cause === 'timeout') return null;
      return { text: oneOf(['SPLAT!', 'KRAK!', 'POW!', 'THWACK!']), fill: YELLOW, burst: RED, size: 21 };
    case 'explosion':
      return { text: 'KA-BOOM!', fill: YELLOW, burst: ORANGE, size: 30 };
    case 'finish':
      return { text: e.place === 0 ? 'YESSS!' : 'MADE IT!', fill: WHITE, burst: YELLOW, size: 19 };
    case 'spring':
      return { text: 'BOING!', fill: YELLOW, burst: WHITE, size: 13 };
    case 'fire':
      return e.style === 'cannon' ? { text: 'BLAM!', fill: WHITE, burst: ORANGE, size: 14 } : null;
    case 'pop':
      if (e.ammo === 'plasma') return { text: 'ZZT!', fill: CYAN, burst: WHITE, size: 13 };
      if (e.ammo === 'cannonball') return { text: 'KRAK!', fill: YELLOW, burst: RED, size: 15 };
      return null;
    case 'crumble-break':
      return { text: 'CRUNCH!', fill: ORANGE, burst: WHITE, size: 14 };
    case 'item':
      if (e.what !== 'hit') return null;
      // A full bat hit reads out how far it would have gone.
      if (e.kind === 'homer') return { text: `${380 + Math.floor(Math.random() * 120)} FT`, fill: WHITE, burst: RED, size: 22 };
      if (e.kind === 'tremor') return { text: 'THOOM!', fill: ORANGE, burst: WHITE, size: 22 };
      if (e.kind === 'tax') return { text: 'AUDIT!', fill: RED, burst: WHITE, size: 20 };
      return null;
    case 'prop':
      if (e.kind === 'keg-fire') return { text: 'FOOMP!', fill: YELLOW, burst: ORANGE, size: 16 };
      if (e.kind === 'keg-backfire') return { text: 'KAFF!', fill: WHITE, burst: RED, size: 18 };
      if (e.kind === 'rope-snap') return { text: 'SNAP!', fill: YELLOW, burst: RED, size: 14 };
      return null;
    default:
      return null;
  }
}

/** Short-lived onomatopoeia: starburst + outlined lettering, popping in and out. */
export class Lettering {
  private words: Word[] = [];
  private cool = new Map<string, number>();
  private now = 0;

  /** Event position, if the event has one (crumble-break doesn't; the renderer supplies it). */
  event(e: GameEvent, at?: { x: number; y: number }) {
    const w = wordFor(e);
    const pos = at ?? ('x' in e ? { x: e.x, y: e.y } : null);
    if (!w || !pos) return;
    // Repeating hazards (cannons, springs) would wallpaper the screen; one shout per word per beat.
    const key = w.text;
    if ((this.cool.get(key) ?? -1) > this.now) return;
    this.cool.set(key, this.now + (w.size >= 19 ? 0.5 : 1.2));
    if (this.words.length >= 6) this.words.shift();
    this.words.push({
      ...w,
      x: pos.x,
      y: pos.y - 14,
      rot: (Math.random() - 0.5) * 0.35,
      life: 0.95,
      max: 0.95,
      seed: Math.random() * 1000,
    });
  }

  update(dt: number) {
    this.now += dt;
    this.words = this.words.filter((w) => (w.life -= dt) > 0);
  }

  /**
   * Drawn on the HUD canvas in logical view coordinates (768x432), so a word skips the print pass, stays
   * crisp and full-strength on any theme, and can be kept on screen whatever the camera is framing.
   */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, pw: number) {
    const f = cam.frame;
    const k = pw / f.w;
    for (const w of this.words) {
      const age = w.max - w.life;
      const pop = age < 0.09 ? 0.45 + (age / 0.09) * 0.85 : age < 0.16 ? 1.3 - ((age - 0.09) / 0.07) * 0.3 : 1;
      const z = pop * (w.life < 0.12 ? w.life / 0.12 : 1);
      if (z <= 0.01) continue;
      const p = cam.worldToView(w.x, w.y);
      const half = w.size * (0.75 + w.text.length * 0.32);
      const x = Math.max(half, Math.min(VIEW_W - half, p.x));
      const y = Math.max(TOP + w.size, Math.min(VIEW_H - FOOTER - w.size * 1.2, p.y));
      ctx.save();
      ctx.setTransform(k, 0, 0, k, -f.x0 * k, -f.y0 * k);
      ctx.translate(x, y);
      ctx.rotate(w.rot);
      ctx.scale(z, z);
      if (w.size >= 19) this.burst(ctx, w);
      this.letters(ctx, w);
      ctx.restore();
    }
  }

  /** Jagged balloon behind the big moments only, so small words never hide what's under them. */
  private burst(ctx: CanvasRenderingContext2D, w: Word) {
    const n = 11;
    const rx = w.size * (0.55 + w.text.length * 0.32);
    const ry = w.size * 1.15;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const jag = i % 2 ? 0.68 : 1 + 0.16 * Math.sin(w.seed + i * 1.7);
      ctx.lineTo(Math.cos(a) * rx * jag, Math.sin(a) * ry * jag);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.save();
    ctx.translate(0, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = css(w.burst);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  /** Same treatment as the home-screen logo: display face, heavy ink, a hard shadow straight down. */
  private letters(ctx: CanvasRenderingContext2D, w: Word) {
    ctx.font = `400 ${w.size}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = w.size * 0.3;
    ctx.strokeText(w.text, 0, w.size * 0.12);
    ctx.fillText(w.text, 0, w.size * 0.12);
    ctx.strokeText(w.text, 0, 0);
    ctx.fillStyle = css(w.fill);
    ctx.fillText(w.text, 0, 0);
  }
}
