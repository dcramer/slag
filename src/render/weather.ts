import { css, type HSL, mixHsl, shift } from '../core/color';
import type { Rect } from '../core/geom';
import { hash2, Rng } from '../core/rng';
import type { Match } from '../game/match';
import type { Theme } from '../gen/theme';
import { RUN_COUNTDOWN, TILE } from '../sim/constants';
import { GROUND_PLAIN, groundAt } from '../sim/ground';
import { type Level, levelKey, tileAt } from '../sim/level';
import { DEFAULT_SURFACE, type Solid } from '../sim/physics';
import { footing, gustPush, gustShown, type WeatherKind } from '../sim/weather';
import type { Camera } from './camera';
import type { Fx } from './fx';
import { blob, line, type P, sn, stroke } from './ink';
import type { RC } from './kit';

/**
 * What weather looks like. Reads the level's weather and the sim's own gust
 * clock (sim/weather.ts), so the streaks that warn of a gust are the ones the
 * sim is about to blow.
 *
 * Falling things are a field rather than particles: a streak's place is
 * arithmetic on its index and the time, so nothing is allocated or kept, and
 * the cost is one path per frame however long the race runs. They go on the
 * background layer (thin things turn to ink on `rc.s`). What lies on the
 * ground is baked into the terrain by `coat`.
 *
 * Mist is one small canvas of how thick the air is. The cel pass cuts it into
 * flat bands over everything, ink and glow included. Every live runner gets
 * the same hole wherever they are on whoever's screen, so all peers see the
 * same picture and nobody sees further than anyone else.
 */

interface WeatherArt {
  /** Paint this frame's air, in world space on `rc.bg`. */
  draw?(a: Air): void;
  /** Bake what lies on one exposed top of terrain, `x`..`x + TILE` wide with its top at `y`. */
  coat?(g: CanvasRenderingContext2D, x: number, y: number, rng: Rng): void;
  /** The same on a prop's solid this frame: it's as slick as the ground, so it has to look it. */
  lay?(s: CanvasRenderingContext2D, r: Rect): void;
  /** Colors kicked up by feet running on this footing. */
  kick?: HSL;
  /** Exposure multiplier: the world under this sky. */
  exposure?: number;
  /** Flat wash over the sky and scenery, so a sunny backdrop doesn't argue with what's falling. */
  overcast?: string;
}

interface Air {
  rc: RC;
  view: { x: number; y: number; w: number; h: number };
  level: Level;
  /** The sky's frame: see skyFrame. */
  frame: number;
  /** Exposed tops of terrain as x, y pairs (world px, tile centers). */
  tops: readonly number[];
}

/** Falling things repeat over this many px, wider than any level's view. */
const FIELD = 1600;
const wrap = (v: number) => v - FIELD * Math.floor(v / FIELD);
/** Low-discrepancy scatter: evenly spread at any count, so a rising share adds streaks instead of moving them. */
const scatter = (i: number, g: number) => ((i * g) % 1) * FIELD;
const SX = 0.6180339887;
const SY = 0.7548776662;

/** Position of field point `i` drifting at (vx, vy), inside the view. False when it's off screen. */
function inView(out: { x: number; y: number }, i: number, t: number, vx: number, vy: number, v: Air['view']): boolean {
  out.x = v.x + wrap(scatter(i, SX) + vx * t - v.x);
  out.y = v.y + wrap(scatter(i, SY) + vy * t - v.y);
  return out.x < v.x + v.w && out.y < v.y + v.h;
}

const pt = { x: 0, y: 0 };

/** Air moving past: dashes on the gust's own heading, more of them as it nears. Every sixth curls over, comic-book wind. */
const WIND_DASHES = 760;
const WIND_SPEED = 640;

function drawWind({ rc, view, level, frame }: Air) {
  const w = level.weather!;
  const share = Math.abs(gustShown(w, frame));
  if (share === 0) return; // Still air shows nothing: a dash on screen means a gust.
  const push = gustPush(w, frame);
  const n = Math.floor(WIND_DASHES * share);
  const c = rc.bg;
  c.strokeStyle = 'rgba(244,248,252,0.82)';
  c.lineWidth = 1.3 + push * 0.5;
  c.lineCap = 'round';
  c.beginPath();
  const speed = (WIND_SPEED + push * 220) * w.dir;
  for (let i = 0; i < n; i++) {
    if (!inView(pt, i, rc.t, speed * (0.7 + (i % 4) * 0.1), 0, view)) continue;
    const len = (24 + (i % 5) * 11) * w.dir * (0.7 + 0.5 * push);
    const y = pt.y + Math.sin(rc.t * 3 + i) * 1.5;
    c.moveTo(pt.x, y);
    c.lineTo(pt.x + len, y);
    if (i % 6 === 0) c.arc(pt.x + len, y - 4, 4, Math.PI / 2, w.dir > 0 ? -Math.PI / 2 : Math.PI * 1.5, w.dir > 0);
  }
  c.stroke();
  // Grit off the ground, so the gust has a body at gameplay scale and not just lines.
  c.fillStyle = css(level.theme.terrain.capColor, 12, 0.95);
  for (let i = 0; i < n >> 2; i++) {
    if (!inView(pt, i + WIND_DASHES, rc.t, speed * 0.55, 18, view)) continue;
    c.fillRect(pt.x, pt.y, 3, 1.8);
  }
  c.lineCap = 'butt';
}

const RAIN = 720;
const SPLASHES = 26;

function drawRain({ rc, view, tops }: Air) {
  const c = rc.bg;
  c.strokeStyle = 'rgba(206,224,248,0.6)';
  c.lineWidth = 0.9;
  c.beginPath();
  for (let i = 0; i < RAIN; i++) {
    const fast = 1 + (i % 3) * 0.14;
    if (!inView(pt, i, rc.t, -78 * fast, 560 * fast, view)) continue;
    c.moveTo(pt.x, pt.y);
    c.lineTo(pt.x - 2.6, pt.y + 17);
  }
  c.stroke();
  const n = tops.length >> 1;
  if (!n) return;
  // Crowns where drops land: the ground itself says it's wet.
  c.strokeStyle = 'rgba(222,236,252,0.75)';
  c.beginPath();
  const spots = Math.ceil((SPLASHES * n) / 60);
  for (let i = 0; i < spots; i++) {
    const q = rc.t * 2.6 + i * 0.37;
    const id = Math.floor(q);
    const age = q - id;
    const k = (Math.imul(id + 1, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
    const at = k % n;
    const x = tops[at * 2] + (k % 13) - 6;
    const y = tops[at * 2 + 1];
    if (x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h) continue;
    const r = 1.5 + age * 3;
    c.moveTo(x - r, y - age * 2);
    c.lineTo(x - r * 0.4, y);
    c.moveTo(x + r, y - age * 2);
    c.lineTo(x + r * 0.4, y);
  }
  c.stroke();
}

const SNOW = 520;

function drawSnow({ rc, view }: Air) {
  const c = rc.bg;
  c.fillStyle = 'rgba(250,252,255,0.94)';
  c.beginPath();
  for (let i = 0; i < SNOW; i++) {
    if (!inView(pt, i, rc.t, -10, 26 + (i % 5) * 6, view)) continue;
    const s = 1.1 + (i % 3) * 0.55;
    c.rect(pt.x + Math.sin(rc.t * 0.9 + i) * 7, pt.y, s, s);
  }
  c.fill();
}

/** Snow lies in a drift with a lumpy underside, inked where it hangs over the edge. */
function coatSnow(g: CanvasRenderingContext2D, x: number, y: number, rng: Rng) {
  const lip: P[] = [];
  const top: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const px = x + (TILE * i) / 6;
    top.push({ x: px, y: y - 1.2 - Math.abs(sn(px * 0.21, y, 3)) * 0.7 });
    lip.push({ x: px, y: y + 3 + rng.range(0, 2.4) + Math.abs(sn(px * 0.3, y, 4)) * 1.4 });
  }
  const shape = (a: readonly P[], b: readonly P[], fill: string, dy = 0) => {
    g.fillStyle = fill;
    g.beginPath();
    a.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i].x, b[i].y + dy);
    g.closePath();
    g.fill();
  };
  shape(top, lip, '#b4c4dc', 1.2);
  shape(top, lip, '#f2f6fb');
  g.fillStyle = '#4f5f80';
  stroke(
    g,
    lip.map((q) => ({ x: q.x, y: q.y + 1.3 })),
    { w: 0.9, seed: (x + y) | 0, taper: [0.2, 0.2], press: 0.5 },
  );
}

/** Wet ground: a dark sheen, highlights in broken dashes, and the odd puddle with an inked rim. */
function coatRain(g: CanvasRenderingContext2D, x: number, y: number, rng: Rng) {
  g.fillStyle = 'rgba(14,24,48,0.34)';
  g.fillRect(x, y, TILE, 3);
  g.fillStyle = 'rgba(206,230,255,0.95)';
  for (let px = x + rng.range(0, 4); px < x + TILE - 3; px += rng.range(4.5, 7.5)) {
    line(g, px, y + 0.7, Math.min(x + TILE - 1, px + rng.range(2.5, 5.5)), y + 0.6, { w: 1.2, seed: px | 0, taper: [0.25, 0.35], press: 0.3 });
  }
  if (rng.chance(0.35)) {
    const cx = x + 8;
    g.fillStyle = '#1f2c48';
    blob(g, cx, y + 1.2, 6.9, x | 0, 0.24, 0.1);
    g.fill();
    g.fillStyle = 'rgba(112,156,218,0.95)';
    blob(g, cx, y + 1, 6.2, x | 0, 0.2, 0.1);
    g.fill();
    g.fillStyle = 'rgba(232,244,255,1)';
    line(g, cx - 4, y + 0.6, cx - 0.5, y + 0.5, { w: 0.9, seed: x | 0, taper: [0.2, 0.4] });
  }
}

function laySnow(s: CanvasRenderingContext2D, r: Rect) {
  s.fillStyle = '#f2f6fb';
  s.fillRect(r.x, r.y - 1, r.w, 3.2);
}

function layRain(s: CanvasRenderingContext2D, r: Rect) {
  s.fillStyle = 'rgba(206,230,255,0.95)';
  for (let px = r.x + 2; px < r.x + r.w - 3; px += 6) s.fillRect(px, r.y, 3, 1.4);
}

export const WEATHER_ART: Record<WeatherKind, WeatherArt> = {
  clear: {},
  wind: { draw: drawWind, exposure: 0.97 },
  mist: { exposure: 0.94 },
  rain: { draw: drawRain, coat: coatRain, lay: layRain, kick: { h: 208, s: 60, l: 84 }, exposure: 0.84, overcast: 'rgba(52,62,84,0.46)' },
  snow: { draw: drawSnow, coat: coatSnow, lay: laySnow, kick: { h: 210, s: 30, l: 96 }, exposure: 0.92, overcast: 'rgba(196,206,222,0.34)' },
};

const artOf = (level: Level): WeatherArt => WEATHER_ART[level.weather?.kind ?? 'clear'];

/** The frame the sky is on: a race's own, or the match's clock before one, so a windy level shows its gusts while you pick and place. */
const skyFrame = (m: Match) => (m.phase === 'run' && m.run ? m.run.frame : m.frame);

/** How hard the wind shows this frame (`RC.gust`). */
export const skyGust = (m: Match): number => gustShown(m.level.weather, skyFrame(m));

/**
 * Bake weather onto the terrain's exposed tops, or just those in `area` (world px). Each cell rolls from
 * its own position, never from a walk across the level: a blast redraws only what it touched, so a coat
 * that depended on every cell before it would come out different on each side of the redraw.
 */
export function coatTerrain(g: CanvasRenderingContext2D, level: Level, area?: { x0: number; y0: number; x1: number; y1: number }): void {
  const coat = artOf(level).coat;
  if (!coat) return;
  for (const [x, y] of topCells(level)) {
    if (area && ((x + 1) * TILE < area.x0 - 8 || x * TILE > area.x1 + 8 || (y + 1) * TILE < area.y0 - 8 || y * TILE > area.y1 + 8)) continue;
    g.save();
    coat(g, x * TILE, y * TILE, new Rng(Math.floor(hash2(x, y, level.seed ^ 0x5eed) * 0x7fffffff)));
    g.restore();
  }
}

/** Cells holding ground with open air above: where weather lands. A level's own ground (glacier ice) keeps its own footing, so nothing lands on it. */
function topCells(level: Level): [number, number][] {
  const out: [number, number][] = [];
  for (let ty = 1; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++)
      if (tileAt(level, tx, ty) !== 0 && tileAt(level, tx, ty - 1) === 0 && groundAt(level, tx, ty) === GROUND_PLAIN) out.push([tx, ty]);
  }
  return out;
}

/** World px of clear air around every runner: the mist's edge. */
const SIGHT = 13 * TILE;
/** A smaller hole over the flag: the goal stays findable, the way there doesn't. */
const FLAG_SIGHT = 5 * TILE;
/** Thickness of the air outside a race: enough to see it's there, thin enough to build in. */
const VEIL = 0.3;
/** How much finer the mist's canvas is than the picture: the cel pass cuts the edges, so it can be small. */
const MIST_SHIFT = 3;
/** Lobes on a hole's edge, drifting, so sight ends in a bank of cloud and not a lens. */
const LOBES = 5;
const LOBE_REACH = 0.5;
const LOBE_SIZE = 0.56;

export class WeatherLayer {
  private mistC = document.createElement('canvas');
  private mctx = this.mistC.getContext('2d')!;
  private puff = makePuff();
  private topsKey = '';
  private tops: number[] = [];

  /** Exposure multiplier for this level's sky. */
  exposure(level: Level): number {
    return artOf(level).exposure ?? 1;
  }

  /**
   * Paint falling weather and spray from running feet. Call in the world pass. `solids` are this
   * frame's parts and set pieces, the race's or a preview's: they're as wet in pick and place as in the race.
   */
  draw(rc: RC, m: Match, view: Air['view'], fx: Fx, solids: readonly Solid[]) {
    const level = m.level;
    const art = artOf(level);
    const run = m.phase === 'run' ? m.run : null;
    if (art.overcast) {
      rc.bg.fillStyle = art.overcast;
      rc.bg.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    }
    art.draw?.({ rc, view, level, frame: skyFrame(m), tops: this.topsOf(level) });
    if (art.lay) this.layOn(rc, level, solids, art.lay);
    if (!run || !art.kick) return;
    for (const r of run.runners) {
      const b = r.body;
      if (r.alive && b.onGround && Math.abs(b.vx) > 70 && Math.random() < 0.4) {
        fx.add('dust', b.x + b.w / 2, b.y + b.h - 1, -b.vx * 0.2 + (Math.random() - 0.5) * 30, -30 - Math.random() * 50, art.kick, 1.2, 0.35);
      }
    }
  }

  /**
   * Weather on the exposed tops of this frame's solids, as on the terrain's. Plain footing only: a
   * coat, belt or jelly keeps its own look (it's slicker all the same), and blood lies on top. A top
   * with a cell of the same part or terrain on it is inside a block, not on it.
   */
  private layOn(rc: RC, level: Level, solids: readonly Solid[], lay: NonNullable<WeatherArt['lay']>) {
    // A race's solids come wet (sim `wetSolids`); a preview's are still dry, and plain footing is plain either way.
    const plain = footing(level);
    const under = this.under;
    under.clear();
    for (const s of solids) if (!s.film) under.add(`${s.x}:${s.y + s.h}`);
    for (const s of solids) {
      if ((s.surface !== plain && s.surface !== DEFAULT_SURFACE) || s.film || under.has(`${s.x}:${s.y}`)) continue;
      if (tileAt(level, Math.floor((s.x + s.w / 2) / TILE), Math.floor((s.y - 1) / TILE))) continue;
      lay(rc.s, s);
    }
  }

  private under = new Set<string>();

  private topsOf(level: Level): number[] {
    const key = `${levelKey(level)}:${level.version}`;
    if (key !== this.topsKey) {
      this.topsKey = key;
      this.tops = topCells(level).flatMap(([x, y]) => [(x + 0.5) * TILE, y * TILE]);
    }
    return this.tops;
  }

  /**
   * This frame's mist as a small canvas whose alpha is how thick the air is,
   * or null when there's none. Render only: it can't reach the sim.
   */
  mist(m: Match, cam: Camera, pw: number, ph: number, t: number): HTMLCanvasElement | null {
    const level = m.level;
    if (level.weather?.kind !== 'mist') return null;
    const c = this.mistC;
    const g = this.mctx;
    const w = Math.max(2, pw >> MIST_SHIFT);
    const h = Math.max(2, ph >> MIST_SHIFT);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const run = m.phase === 'run' ? m.run : null;
    // It closes in over the countdown: you see it coming, and you've seen the level.
    const thick = run ? VEIL + (1 - VEIL) * Math.min(1, run.frame / RUN_COUNTDOWN) : VEIL;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = css(mistColor(level.theme), 0, thick);
    g.fillRect(0, 0, w, h);
    if (!run) return c;
    cam.apply(g, w);
    g.globalCompositeOperation = 'destination-out';
    this.hole((level.goal.tx + 0.5) * TILE, (level.goal.ty - 1) * TILE, FLAG_SIGHT, t);
    for (const r of run.runners) if (r.alive && !r.finished) this.hole(r.body.x + r.body.w / 2, r.body.y + r.body.h / 2, SIGHT, t);
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /** Clear the air around (x, y). The same for everyone: it's a function of position and the clock. */
  private hole(x: number, y: number, r: number, t: number) {
    const g = this.mctx;
    const core = r * (1 - LOBE_SIZE * 0.6);
    g.drawImage(this.puff, x - core, y - core, core * 2, core * 2);
    for (let i = 0; i < LOBES; i++) {
      const a = (i / LOBES) * Math.PI * 2 + t * (i % 2 ? 0.11 : -0.07);
      const d = r * LOBE_REACH * (1 + Math.sin(t * 0.5 + i * 2.1) * 0.12);
      const s = r * LOBE_SIZE;
      g.drawImage(this.puff, x + Math.cos(a) * d - s, y + Math.sin(a) * d - s, s * 2, s * 2);
    }
  }
}

/** Fog in the sky's own light, so a dark level's mist doesn't glow. */
function mistColor(th: Theme): HSL {
  return shift(mixHsl(th.fog, { h: 210, s: 12, l: 90 }, 0.5), (th.ambientLight - 0.9) * 60);
}

/** One soft disc, drawn once: holes stamp it instead of building gradients every frame. */
function makePuff(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}
