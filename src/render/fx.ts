import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import { type Level, tileAt } from '../sim/level';
import { light, type RC } from './kit';

export type PKind = 'spark' | 'ember' | 'smoke' | 'dust' | 'gib' | 'confetti' | 'debris' | 'ring' | 'splash' | 'flash' | 'part';

/** What a character bursts into when it dies: shards of it, and a robot's or a plumber's own bits. */
export const PARTS = ['gear', 'spring', 'key', 'shard', 'bolt', 'wheel', 'coin'] as const;
export type Part = (typeof PARTS)[number];

/**
 * Cosmetic particles, inked like a comic's effects (docs/ART.md, World art): every one is a hard-edged
 * shape in two flat tones, and none of them fades through alpha. Things shrink away instead, the way a
 * drawn puff or spark gets smaller from panel to panel.
 *
 * - Smoke and dust are scalloped puffs on the background layer: a rim, a shadow tone and a lit tone
 *   pulled up-left, each pass over every puff at once so overlapping puffs merge into one cut-out cloud.
 *   On the foreground they'd get the cel pass's ink as scrub, and they could hide a hazard.
 * - Sparks are tapered pen strokes along their flight; embers are spinning flecks; both are hot, so emissive.
 * - A "ring" is a burst of pen speed lines flying outward; a "flash" is a jagged starburst with a hot core.
 * - Gibs, debris, confetti and splashes are hand-cut chunks, paper bits and drops on the foreground.
 * - Parts are what a character breaks into: shards, and a few kinds' own bits (gears, springs, bolts, coins).
 *
 * Particles live in a pool and are reused: a death or explosion spawns dozens, and eight players spawn them every second.
 */

const MAX = 1800;

interface P {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: HSL;
  rot: number;
  vr: number;
  bounced: number;
  /** Which hand-cut outline from the kind's table. */
  shape: number;
  /** Flat tones, worked out once at spawn so drawing allocates no strings: lit, shade, and a rim or core. */
  c0: string;
  c1: string;
  c2: string;
}

/** Unit outlines as flat [x, y, ...], cut once. Keyed by the module, so every chunk of shape 3 is the same chunk. */
function shapes(count: number, verts: number, radius: (i: number, k: number, a: number) => number, jitter = 0): Float64Array[] {
  const out: Float64Array[] = [];
  for (let k = 0; k < count; k++) {
    const sh = new Float64Array(verts * 2);
    for (let i = 0; i < verts; i++) {
      const a = ((i + (hash2(i, k, 71) - 0.5) * jitter) / verts) * Math.PI * 2;
      const r = radius(i, k, a);
      sh[i * 2] = Math.cos(a) * r;
      sh[i * 2 + 1] = Math.sin(a) * r;
    }
    out.push(sh);
  }
  return out;
}

/** Rock and flesh chunks: five to seven corners, no two alike. */
const CHUNKS = Array.from({ length: 8 }, (_, k) => shapes(1, 5 + (k % 3), (i) => 0.62 + 0.45 * hash2(i, k, 72), 0.55)[0]);
/** A toy's parts, as unit outlines; the spring is drawn as a zigzag instead. */
const PART_SHAPES: Record<Exclude<Part, 'spring' | 'shard'>, Float64Array> = {
  gear: shapes(1, 16, (i) => (i % 2 ? 0.72 : 1))[0],
  key: Float64Array.from([-1, -0.5, -0.4, -0.55, -0.3, -0.15, 1, -0.15, 1, 0.4, 0.72, 0.4, 0.72, 0.15, -0.3, 0.15, -0.4, 0.55, -1, 0.5]),
  bolt: shapes(1, 6, () => 0.8)[0],
  wheel: shapes(1, 10, () => 1)[0],
  coin: shapes(1, 10, () => 0.9)[0],
};

/** Smoke puffs: a scalloped cloud, its bumps at different sizes. */
const PUFFS = shapes(6, 24, (i, k, a) => 0.8 + 0.22 * Math.abs(Math.sin(a * 2.5 + k * 1.3)) * (0.75 + 0.5 * hash2(Math.floor(i / 5), k, 73)));
/** Comic starbursts: long and short points, unevenly spaced. */
const STARS = shapes(4, 18, (i, k) => (i % 2 ? 0.48 + 0.1 * hash2(i, k, 74) : 0.8 + 0.25 * hash2(i, k, 75)), 0.35);
/** Per-spoke length and angle jitter for speed-line bursts. */
const SPOKES = Array.from({ length: 64 }, (_, i) => hash2(i, 0, 76));

function fillShape(g: CanvasRenderingContext2D, sh: Float64Array, x: number, y: number, r: number, rot: number) {
  const c = Math.cos(rot) * r;
  const s = Math.sin(rot) * r;
  g.beginPath();
  g.moveTo(x + sh[0] * c - sh[1] * s, y + sh[0] * s + sh[1] * c);
  for (let i = 2; i < sh.length; i += 2) g.lineTo(x + sh[i] * c - sh[i + 1] * s, y + sh[i] * s + sh[i + 1] * c);
  g.closePath();
  g.fill();
}

/** A thin quad from (ax, ay) to (bx, by), widest `w` at `at` along it: one pen dash. */
function dash(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, at: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy) || 1;
  const nx = (-dy / d) * w;
  const ny = (dx / d) * w;
  const mx = ax + dx * at;
  const my = ay + dy * at;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(mx + nx, my + ny);
  g.lineTo(bx, by);
  g.lineTo(mx - nx, my - ny);
  g.closePath();
  g.fill();
}

const solid = (level: Level, x: number, y: number) => y >= 0 && !!tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
const isPuff = (k: PKind) => k === 'smoke' || k === 'dust';

/** How big a puff is now: it pops up fast, holds, then shrinks away over the last of its life. */
function puffR(p: P): number {
  const age = p.max - p.life;
  const grow = Math.min(1, 0.45 + (age / (p.max * 0.15)) * 0.55);
  const fade = Math.min(1, p.life / p.max / 0.45);
  return p.size * (p.kind === 'smoke' ? 1.45 : 1.2) * grow * fade;
}

/** Spawn-time tones per kind. */
function paint(p: P) {
  const c = p.color;
  switch (p.kind) {
    case 'smoke':
    case 'dust':
      p.c0 = css(c, 7);
      p.c1 = css(c, -11, 1, -4);
      // The rim is a dark of the puff itself, as the cel pass inks the world: the background gets no ink of its own.
      p.c2 = css(c, -Math.min(c.l * 0.62, 40), 1, 6);
      break;
    case 'spark':
      p.c0 = css(c, 22);
      break;
    case 'ember':
      p.c0 = css(c, 14);
      break;
    case 'flash':
      p.c0 = css(c, 2, 1, 10);
      p.c1 = css(c, 30, 1, -15);
      p.c2 = css(c, 10 - c.l, 1, -20);
      break;
    case 'ring':
      p.c0 = css(c, 6);
      break;
    case 'splash':
      p.c0 = css(c);
      p.c1 = css(c, 26, 1, -10);
      break;
    default:
      p.c0 = css(c);
      p.c1 = css(c, -17, 1, 5);
  }
}

/** Cosmetic particles. Gibs bounce off terrain. */
export class Fx {
  private pool: P[] = [];
  private n = 0;
  private evict = 0;

  add(kind: PKind, x: number, y: number, vx: number, vy: number, color: HSL = { h: 0, s: 0, l: 90 }, size = 1, life = 1): P {
    let p: P;
    if (this.n < this.pool.length) p = this.pool[this.n++];
    else if (this.n < MAX) {
      p = { kind, x, y, vx, vy, life, max: life, size, color, rot: 0, vr: 0, bounced: 0, shape: 0, c0: '', c1: '', c2: '' };
      this.pool.push(p);
      this.n++;
    } else {
      // Full: overwrite in turn rather than drop the new one, so a fresh explosion always shows.
      p = this.pool[this.evict];
      this.evict = (this.evict + 1) % MAX;
    }
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.rot = Math.random() * 6.28;
    p.vr = (Math.random() - 0.5) * (isPuff(kind) ? 1 : 20);
    p.bounced = 0;
    p.shape = Math.floor(Math.random() * 64);
    paint(p);
    return p;
  }

  burst(kind: PKind, x: number, y: number, n: number, speed: number, colors: HSL[], size = 1, life = 0.8, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.75);
      this.add(
        kind,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - up * Math.random(),
        colors[i % colors.length],
        size * (0.6 + Math.random() * 0.8),
        life * (0.6 + Math.random() * 0.8),
      );
    }
  }

  update(dt: number, level: Level) {
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0 || !this.move(p, dt, level)) {
        // Swap the dead one past the end: the pool keeps it for the next spawn.
        const last = this.pool[--this.n];
        this.pool[this.n] = p;
        this.pool[i] = last;
        i--;
      }
    }
  }

  /** One step of a particle's flight. False when it's gone (fallen out of the world). */
  private move(p: P, dt: number, level: Level): boolean {
    switch (p.kind) {
      case 'spark':
        p.vy += 500 * dt;
        p.vx *= 0.98;
        break;
      case 'ember':
        p.vy -= 30 * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.rot += p.vr * dt;
        break;
      case 'smoke':
        p.vy -= 20 * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.size += dt * 6;
        p.rot += p.vr * dt;
        break;
      case 'dust':
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.vy -= 8 * dt;
        p.size += dt * 4;
        break;
      case 'gib':
      case 'part':
      case 'debris':
      case 'confetti':
      case 'splash': {
        p.vy += (p.kind === 'confetti' ? 120 : 600) * dt;
        if (p.kind === 'confetti') {
          p.vx *= 0.985;
          p.vx += Math.sin(p.life * 8 + p.rot) * 30 * dt;
        }
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        if ((p.kind === 'gib' || p.kind === 'debris' || p.kind === 'part') && solid(level, nx, ny)) {
          if (solid(level, nx, p.y)) p.vx *= -0.4;
          if (solid(level, p.x, ny)) p.vy *= -0.35;
          p.vx *= 0.7;
          p.bounced++;
          p.vr *= 0.5;
          return true;
        }
        p.rot += p.vr * dt;
        if (p.y > level.h * TILE + 20) return false;
        break;
      }
      default:
        break;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return true;
  }

  draw(rc: RC) {
    this.drawPuffs(rc.bg);
    const s = rc.s;
    const g = rc.g;
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark': {
          // A pen flick along the flight: fat at the head, trailing to a point.
          const w = p.size * 0.8 * Math.sqrt(k);
          const tx = p.x - p.vx * 0.03;
          const ty = p.y - p.vy * 0.03;
          g.fillStyle = p.c0;
          dash(g, p.x + (p.x - tx) * 0.12, p.y + (p.y - ty) * 0.12, tx, ty, w, 0.12);
          break;
        }
        case 'ember': {
          const r = p.size * 1.15 * Math.sqrt(k);
          const c = Math.cos(p.rot);
          const sn = Math.sin(p.rot);
          g.fillStyle = p.c0;
          dash(g, p.x - c * r, p.y - sn * r, p.x + c * r, p.y + sn * r, r * 0.55, 0.5);
          break;
        }
        case 'gib':
          this.chunk(s, p, p.size * 1.25 * Math.min(1, p.life / 0.3));
          break;
        case 'part':
          this.drawPart(s, p, p.size * Math.min(1, p.life / 0.3));
          break;
        case 'debris':
          this.chunk(s, p, p.size * 1.15 * Math.min(1, p.life / 0.3));
          break;
        case 'confetti': {
          // A paper bit flipping: its face and its back are two tones, and edge-on it's a sliver.
          const flip = Math.cos(p.life * 9 + p.shape);
          const hw = p.size * Math.min(1, p.life / 0.3);
          const hh = Math.max(0.12, Math.abs(flip)) * p.size * 0.45 * Math.min(1, p.life / 0.3);
          const c = Math.cos(p.rot);
          const sn = Math.sin(p.rot);
          s.fillStyle = flip > 0 ? p.c0 : p.c1;
          s.beginPath();
          s.moveTo(p.x - c * hw + sn * hh, p.y - sn * hw - c * hh);
          s.lineTo(p.x + c * hw + sn * hh, p.y + sn * hw - c * hh);
          s.lineTo(p.x + c * hw - sn * hh, p.y + sn * hw + c * hh);
          s.lineTo(p.x - c * hw - sn * hh, p.y - sn * hw + c * hh);
          s.closePath();
          s.fill();
          break;
        }
        case 'splash': {
          // A drop: round at the front, drawn out to a point behind, with one hard glint.
          const r = p.size * Math.min(1, k * 2.2);
          if (r < 0.2) break;
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const dx = p.vx / sp;
          const dy = p.vy / sp;
          const len = r + Math.min(r * 2.4, sp * 0.016);
          s.fillStyle = p.c0;
          s.beginPath();
          s.moveTo(p.x - dx * len, p.y - dy * len);
          for (let j = 0; j <= 6; j++) {
            const a = -Math.PI / 2 + (j / 6) * Math.PI;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            s.lineTo(p.x + (dx * ca - dy * sa) * r, p.y + (dy * ca + dx * sa) * r);
          }
          s.closePath();
          s.fill();
          if (r > 0.9) {
            s.fillStyle = p.c1;
            s.fillRect(p.x - r * 0.5, p.y - r * 0.55, r * 0.45, r * 0.4);
          }
          break;
        }
        case 'ring':
          this.speedLines(s, p, 1 - k);
          break;
        case 'flash': {
          // Pops to full, then shrinks away: a hard starburst, never a soft bloom.
          const age = 1 - k;
          const env = age < 0.25 ? 0.55 + (age / 0.25) * 0.45 : k / 0.75;
          const r = p.size * 0.85 * env;
          const sh = STARS[p.shape & 3];
          // The brawler's hit spark: the hot star sits on an ink star a size up, so the burst has a hard
          // inked edge on any backdrop (the emissive layer adds onto it, so the ink shows only round the rim).
          s.fillStyle = p.c2;
          fillShape(s, sh, p.x, p.y, r * 1.16 + 0.6, p.rot);
          g.fillStyle = p.c0;
          fillShape(g, sh, p.x, p.y, r, p.rot);
          g.fillStyle = p.c1;
          fillShape(g, sh, p.x, p.y, r * 0.5, p.rot + 0.3);
          light(rc, p.x, p.y, p.size * 3, p.color, Math.min(1.5, k * 2.25));
          break;
        }
        default:
          // Dust and smoke are puffs, drawn on the background first (drawPuffs).
          break;
      }
    }
  }

  /** A chunk in two tones: the whole cut in shade, its lit face pulled up-left whichever way it has turned. */
  /** One of a toy's broken bits flying: its shape in two flat tones, a dark hub on the round ones. */
  private drawPart(s: CanvasRenderingContext2D, p: P, r: number) {
    if (r < 0.2) return;
    const kind = PARTS[p.shape % PARTS.length];
    if (kind === 'shard') return this.chunk(s, p, r);
    if (kind === 'spring') {
      const c = Math.cos(p.rot) * r;
      const sn = Math.sin(p.rot) * r;
      s.fillStyle = p.c1;
      for (let i = 0; i < 5; i++) {
        const a = -1 + i * 0.4;
        const b = a + 0.4;
        const ya = i % 2 ? 0.5 : -0.5;
        dash(s, p.x + a * c - ya * sn, p.y + a * sn + ya * c, p.x + b * c + ya * sn, p.y + b * sn - ya * c, r * 0.22, 0.5);
      }
      return;
    }
    const sh = PART_SHAPES[kind];
    // A coin flips edge-on as it spins.
    const squash = kind === 'coin' ? Math.max(0.2, Math.abs(Math.cos(p.life * 12))) : 1;
    s.save();
    s.translate(p.x, p.y);
    s.scale(1, squash);
    s.fillStyle = p.c1;
    fillShape(s, sh, 0, 0, r, p.rot);
    s.fillStyle = p.c0;
    fillShape(s, sh, -r * 0.14, -r * 0.16, r * 0.8, p.rot);
    if (kind === 'gear' || kind === 'wheel') {
      s.fillStyle = p.c1;
      s.beginPath();
      s.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      s.fill();
    }
    s.restore();
  }

  /** A toy's part flung from (x, y): `part` picks the outline, so it doesn't come from the random shape roll. */
  part(part: Part, x: number, y: number, speed: number, color: HSL, size: number, life: number) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.35 + Math.random() * 0.65);
    const p = this.add(
      'part',
      x,
      y,
      Math.cos(a) * sp,
      Math.sin(a) * sp - 120 * Math.random(),
      color,
      size * (0.8 + Math.random() * 0.4),
      life * (0.7 + Math.random() * 0.6),
    );
    p.shape = PARTS.indexOf(part) + PARTS.length * Math.floor(Math.random() * 8);
  }

  private chunk(s: CanvasRenderingContext2D, p: P, r: number) {
    if (r < 0.2) return;
    const sh = CHUNKS[p.shape & 7];
    s.fillStyle = p.c1;
    fillShape(s, sh, p.x, p.y, r, p.rot);
    s.fillStyle = p.c0;
    fillShape(s, sh, p.x - r * 0.2, p.y - r * 0.24, r * 0.7, p.rot);
  }

  /** A burst of pen speed lines flung out from the middle, `u` 0..1 through its life. */
  private speedLines(s: CanvasRenderingContext2D, p: P, u: number) {
    const e = 1 - (1 - u) * (1 - u);
    const R = p.size;
    const n = R > 30 ? 13 : R > 16 ? 10 : 8;
    const w = (0.55 + R * 0.022) * (1 - u * 0.65);
    s.fillStyle = p.c0;
    for (let i = 0; i < n; i++) {
      const j = SPOKES[(p.shape + i) & 63];
      const a = p.rot + ((i + (j - 0.5) * 0.5) / n) * Math.PI * 2;
      const r0 = R * (0.3 + 0.7 * e) * (0.85 + 0.3 * j);
      const r1 = r0 + (R * 0.42 * (1 - e) + 1.5) * (0.6 + 0.6 * SPOKES[(p.shape + i + 17) & 63]);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      dash(s, p.x + c * r0, p.y + sn * r0, p.x + c * r1, p.y + sn * r1, w, 0.62);
    }
  }

  /** Every puff in three passes (rim, shade, lit), so overlapping puffs read as one cut-out cloud. */
  private drawPuffs(bg: CanvasRenderingContext2D) {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.n; i++) {
        const p = this.pool[i];
        if (!isPuff(p.kind)) continue;
        const r = puffR(p);
        if (r < 0.3) continue;
        const sh = PUFFS[p.shape % 6];
        if (pass === 0) {
          bg.fillStyle = p.c2;
          fillShape(bg, sh, p.x, p.y, r + 0.55 + r * 0.06, p.rot);
        } else if (pass === 1) {
          bg.fillStyle = p.c1;
          fillShape(bg, sh, p.x, p.y, r, p.rot);
        } else {
          bg.fillStyle = p.c0;
          fillShape(bg, sh, p.x - r * 0.17, p.y - r * 0.21, r * 0.78, p.rot);
        }
      }
    }
  }
}
