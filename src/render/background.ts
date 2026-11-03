import { css, type HSL, hsl3, mixHsl, shift, toRgb } from '../core/color';
import { hash2, Rng } from '../core/rng';
import type { LiquidKind, SkyLayer, Theme } from '../gen/theme';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { Camera } from './camera';
import type { ViewFrame } from './frame';
import { blob, line, type P, sn, stroke } from './ink';
import { circle, ellipse, flame, flutter, glowDot, light, type RC, wipe } from './kit';
import { along, backward, fillPts, inkOf, penPath } from './skyline-ink';
import { type Feature, ridgeOf, SKYLINES } from './skylines';

/**
 * Sky, horizon, celestial body, light shafts, clouds, parallax skylines
 * (baked once per theme, with emissive windows/lava and a handful of animated
 * features), the liquid pool at the bottom, and ambient particles.
 *
 * The backdrop is inked like the play layer, only quieter (docs/ART.md, World art): the sky is flat
 * bands cut along a hand's line, the sun a flat disc in hard rings, clouds cut cel shapes with a light
 * pen along their tops, and every skyline a flat silhouette with its pen getting lighter with distance.
 * Nothing back here is soft: depth comes from haze, line weight and fewer marks, never blur.
 *
 * Everything fills the window, not just the play view: layers are baked to
 * the window's shape (so they never stretch) and rebaked if it changes.
 *
 * Perf: everything heavy is baked into canvases when the theme changes; per
 * frame we draw ~10 images plus a few dozen small animated shapes.
 */

const PAD = 0.18; // extra width baked on each side for parallax travel

/** A baked bitmap: the top-left `w`×`h` px of a pooled canvas, which may be bigger from an earlier bake. */
interface Surface {
  c: HTMLCanvasElement;
  w: number;
  h: number;
}

/**
 * The canvases the backdrop keeps between bakes, grown and never shrunk. A level load paints over the last
 * level's bitmaps instead of allocating a window's worth of fresh ones: that allocation, and collecting the
 * old ones, was the first-frame stall on every load.
 */
class CanvasPool {
  private cs: HTMLCanvasElement[] = [];
  private n = 0;
  reset() {
    this.n = 0;
  }
  /** A cleared surface of `w`×`h` px, with a context scaled by `k` (logical px in). */
  take(w: number, h: number, k: number): [Surface, CanvasRenderingContext2D] {
    const c = (this.cs[this.n++] ??= document.createElement('canvas'));
    return [{ c, w, h }, prepare(c, w, h, k)];
  }
}

/** Grow `c` to hold `w`×`h` px if it can't, clear all of it with `wipe` (a blur reads past the used rect), and scale it by `k`. */
function prepare(c: HTMLCanvasElement, w: number, h: number, k: number): CanvasRenderingContext2D {
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  const g = c.getContext('2d')!;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  wipe(g);
  g.setTransform(k, 0, 0, k, 0, 0);
  return g;
}

interface BakedLayer {
  c: Surface;
  glow: Surface | null;
  depth: number;
  haze: number;
  feats: Feature[];
}

interface Baked {
  key: string;
  /** Sky bands, horizon and light shafts, covering the window and a margin round it. */
  sky: { c: Surface; x: number; y: number; w: number; h: number };
  /** Sun, moon or planet, centred; `e` is what of it glows. */
  orb: { c: Surface; e: Surface | null; half: number } | null;
  layers: BakedLayer[];
  clouds: { c: Surface; x: number; y: number; speed: number; w: number; h: number; depth: number }[];
  stars: { x: number; y: number; r: number; tw: number }[];
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  seed: number;
}

/** Reused point lists for the pool's per-frame pen strokes. */
const foam: P[] = [];
const crest: P[] = [];

/** World px under a glowing liquid's bottom edge that its heat reaches. */
const HOT_DEPTH = 70;
/** How much of what's under the surface shows through each liquid. */
const SEEN_THROUGH: Record<LiquidKind, number> = { water: 0.5, sea: 0.5, swamp: 0.35, tar: 0.35, lava: 0.3, slag: 0.3, acid: 0.4, void: 0.4, street: 0.5 };

export class Backdrop {
  private baked: Baked | null = null;
  private motes: Mote[] = [];
  private pool = new CanvasPool();

  private ensure(th: Theme, kb: number, f: ViewFrame) {
    const key = `${th.seed}:${th.id}:${th.name}:${kb.toFixed(2)}:${f.w.toFixed(0)}x${f.h.toFixed(0)}`;
    if (this.baked?.key === key) return;
    const rng = new Rng(th.seed ^ 0xbac);
    const W = f.w * (1 + PAD * 2);
    // Layers run on down past the play view on a tall window, ground and all.
    const H = Math.max(VIEW_H, f.y1);
    this.pool.reset();
    const sky = bakeSky(this.pool, th, f, kb);
    const orb = bakeOrb(this.pool, th, kb);
    const layers = th.layers.map((L) => bakeLayer(this.pool, L, th, W, H, kb));
    const clouds = Array.from({ length: th.clouds }, () => {
      const wide = th.cloudStyle !== 'puffy';
      const y = rng.range(Math.min(6, f.y0 + 6), VIEW_H * 0.42);
      // Big and bright up high; the lower a cloud sits, the more it's behind the play band, so the smaller
      // and fainter it gets, sinking toward the sky's own color.
      const low = Math.max(0, Math.min(1, (y - VIEW_H * 0.1) / (VIEW_H * 0.24)));
      const w = (wide ? rng.range(160, 320) : rng.range(70, 170)) * (1 - 0.45 * low);
      const h = w * (wide ? rng.range(0.12, 0.22) : rng.range(0.42, 0.56));
      return {
        c: bakeCloud(this.pool, rng, w, h, th, kb, low * 0.5),
        x: rng.range(f.x0 - 100, f.x1),
        y,
        speed: rng.range(2, 8),
        w,
        h,
        depth: rng.range(0.03, 0.14),
      };
    });
    // A wider or taller window gets more sky, at the same density of stars.
    const starCount = Math.round((th.stars * f.w * (VIEW_H * 0.65 - f.y0)) / (VIEW_W * VIEW_H * 0.65));
    const stars = Array.from({ length: starCount }, () => ({
      x: rng.range(f.x0, f.x1),
      y: rng.range(f.y0, VIEW_H * 0.65),
      r: rng.range(0.4, 1.4),
      tw: rng.range(0.5, 3),
    }));
    this.baked = { key, sky, orb, layers, clouds, stars };
    this.motes = [];
  }

  /** Background in screen space (camera only drives parallax). */
  draw(rc: RC, th: Theme, cam: Camera, kb: number) {
    const f = cam.frame;
    this.ensure(th, kb, f);
    const b = this.baked!;
    const s = rc.s;
    const t = rc.t;
    // Parallax from the camera's offset within the level. Classic levels keep
    // the original travel; big levels compress it so the baked layers (PAD
    // wide each side) never run out. Vertical offsets are measured from the
    // bottom-most camera position, so climbing a tall level sinks the skyline.
    const MAX_D = 0.4;
    const halfX = Math.max(1, cam.ww / 2 - VIEW_W / (2 * 1.45));
    const kx = Math.min(1, (VIEW_W * PAD * 0.9) / (MAX_D * halfX));
    const refY = cam.wh - VIEW_H / 2;
    const spanY = Math.max(1, refY - VIEW_H / (2 * 1.45));
    const ky = Math.min(1, (VIEW_H * 0.45) / (MAX_D * 0.6 * spanY));
    const px = (depth: number) => -(cam.x - cam.ww / 2) * depth * kx;
    const py = (depth: number) => -(cam.y - refY) * depth * 0.6 * ky;

    const sk = b.sky;
    s.drawImage(sk.c.c, 0, 0, sk.c.w, sk.c.h, sk.x, sk.y, sk.w, sk.h);

    for (const st of b.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * st.tw + st.x));
      rc.g.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      rc.g.fillRect(st.x + px(0.02), st.y + py(0.02), st.r, st.r);
    }

    this.drawCelestial(rc, th, b.orb, px(0.04), py(0.04));

    for (const cl of b.clouds) {
      const span = f.w + cl.w * 2;
      const x = f.x0 + ((((cl.x - f.x0 + t * cl.speed + px(cl.depth)) % span) + span) % span) - cl.w;
      s.drawImage(cl.c.c, 0, 0, cl.c.w, cl.c.h, x, cl.y + py(cl.depth), cl.w, cl.h);
    }

    b.layers.forEach((L, i) => {
      const x = f.x0 - f.w * PAD + px(L.depth);
      const y = py(L.depth);
      const lw = f.w * (1 + PAD * 2);
      const lh = Math.max(VIEW_H, f.y1);
      s.drawImage(L.c.c, 0, 0, L.c.w, L.c.h, x, y, lw, lh);
      if (L.glow) {
        rc.g.globalAlpha = (0.85 + 0.15 * Math.sin(t * 0.7 + i)) * Math.max(0.25, 1 - L.haze * 1.3);
        rc.g.drawImage(L.glow.c, 0, 0, L.glow.w, L.glow.h, x, y, lw, lh);
        rc.g.globalAlpha = 1;
      }
      for (const ft of L.feats) drawFeature(rc, ft, x, y, L.haze, th, f);
    });
  }

  private drawCelestial(rc: RC, th: Theme, orb: Baked['orb'], ox: number, oy: number) {
    const c = th.celestial;
    if (c.kind === 'none' || !orb) return;
    const x = c.x * VIEW_W + ox;
    const y = c.y * VIEW_H + oy;
    const d = orb.half * 2;
    rc.s.drawImage(orb.c.c, 0, 0, orb.c.w, orb.c.h, x - orb.half, y - orb.half, d, d);
    if (orb.e) rc.g.drawImage(orb.e.c, 0, 0, orb.e.w, orb.e.h, x - orb.half, y - orb.half, d, d);
    light(rc, x, y, 260, c.glow, c.kind === 'sun' ? 0.45 : 0.25);
  }

  /**
   * Liquid pool along the bottom of the world (drawn in world space, behind the
   * terrain, which stands in it). `ww`×`wh` is the world size; only the visible stretch (`view`)
   * is drawn. The pool isn't the world's: it carries on `margin` px past either
   * edge with the surroundings, and deepens below the world to the window's edge.
   * `sunken` paints what's under the surface: it shows through the liquid, so
   * the pool stays one surface across the window and all of that is plainly under it.
   *
   * Returns the dry side of the surface, just above its bright line. The surface
   * sits above the world's bottom while ground runs on down to it, so ground
   * drawn after the pool clips to this: a column standing in the pool goes under
   * at the same line as the open pool around it, and below that it's the sunken
   * pass, seen through, like everything else in there.
   */
  drawLiquid(
    rc: RC,
    th: Theme,
    ww: number,
    wh: number,
    view: { x: number; y: number; w: number; h: number },
    margin = 0,
    sunken?: (c: CanvasRenderingContext2D) => void,
  ): Path2D {
    const L = th.liquid;
    const s = rc.s;
    const g = rc.g;
    const t = rc.t;
    const kind = L.kind;
    const xa = Math.floor((view.x - 20) / 6) * 6;
    const xb = view.x + view.w + 20;
    // Scattered details run over the pool's whole length, not just the world's.
    const reach = ww + margin * 2;
    const spots = Math.ceil(reach / VIEW_W);
    const below = Math.max(wh + 20, view.y + view.h + 40);
    const y0 = wh - (kind === 'sea' ? 11 : 9);
    const amp = kind === 'sea' ? 1.8 : kind === 'swamp' || kind === 'tar' ? 0.5 : kind === 'street' ? 0 : 1;
    const wave = (x: number) => y0 + (Math.sin(x * 0.045 + t * 1.6) * 1.6 + Math.sin(x * 0.11 - t * 2.4) * 0.9 + Math.sin(x * 0.023 + t * 0.6) * 1.2) * amp;
    const path = new Path2D();
    path.moveTo(xa, below);
    for (let x = xa; x <= xb + 6; x += 6) path.lineTo(x, wave(x));
    path.lineTo(xb + 6, below);
    path.closePath();
    // Half the surface line's width above the wave, so ground stops where the line starts and the line runs on unbroken in front of it.
    const dry = new Path2D();
    dry.moveTo(xa, -1e5);
    for (let x = xa; x <= xb + 6; x += 6) dry.lineTo(x, wave(x) - 0.7);
    dry.lineTo(xb + 6, -1e5);
    dry.closePath();
    // A flat band between two edges over the drawn stretch: every tone of the pool is one of these.
    const band = (top: (x: number) => number, bot: (x: number) => number) => {
      const p = new Path2D();
      p.moveTo(xa, top(xa));
      for (let x = xa + 6; x <= xb + 6; x += 6) p.lineTo(x, top(x));
      for (let x = xb + 6; x >= xa; x -= 6) p.lineTo(x, bot(x));
      p.closePath();
      return p;
    };
    // Only fire glows: lava and slag. The void is the top of a planet's air and the street is lit by its
    // cars, so each keeps a faint light of its own; water and acid never glow.
    const fire = kind === 'lava' || kind === 'slag';
    const glows = L.emissive && kind !== 'acid';
    // Heat haze over the pool: two flat steps with a hand's edge, breathing, never a falloff.
    if (glows) {
      const a = (fire ? 0.17 : kind === 'street' ? 0.14 : 0.1) + Math.sin(t * 1.3) * 0.03;
      g.fillStyle = css(L.glow, 0, a * 0.45);
      g.fill(band((x) => y0 - 56 + sn(x * 0.02, 1.7, 7) * 7, wave));
      g.fillStyle = css(L.glow, 0, a);
      g.fill(band((x) => y0 - 22 + sn(x * 0.03, 4.1, 7) * 4, wave));
    }
    // The body, then a lighter skin along the top: two flat tones.
    s.fillStyle = css(L.color, kind === 'tar' ? 0 : -6);
    s.fill(path);
    s.fillStyle = css(L.color, kind === 'tar' ? 6 : 9);
    s.fill(band(wave, (x) => wave(x) + 3 + sn(x * 0.07, 2.3, 5) * 0.9));
    if (sunken) {
      s.save();
      s.clip(path);
      s.globalAlpha = SEEN_THROUGH[kind];
      sunken(s);
      s.restore();
    }
    // A liquid's heat stays near its surface: glow prints as opaque color, and a whole window of it hides everything under it.
    const hotEnd = Math.min(below, wh + HOT_DEPTH);
    if (below > wh + 20) {
      // Below the world the pool falls away into its own depth, in three flat steps.
      for (const [d, dl, a] of [
        [0, -24, 0.3],
        [24, -36, 0.6],
        [64, -52, 0.92],
      ] as const) {
        if (wh + d >= below) break;
        s.fillStyle = css(L.color, dl, a);
        s.fill(
          band(
            (x) => wh + d + sn(x * 0.03, d * 0.1 + 1, 3) * 2,
            () => below,
          ),
        );
      }
      // A street is lit by its cars, not from below.
      if (glows && kind !== 'street') {
        g.fillStyle = css(L.glow, 0, fire ? 0.32 : 0.18);
        g.fill(
          band(
            () => wh - 10,
            (x) => wh + HOT_DEPTH * 0.4 + sn(x * 0.03, 6.6, 3) * 3,
          ),
        );
        g.fillStyle = css(L.glow, -15, fire ? 0.14 : 0.08);
        g.fill(
          band(
            (x) => wh + HOT_DEPTH * 0.4 + sn(x * 0.03, 6.6, 3) * 3,
            () => hotEnd,
          ),
        );
      }
    }
    switch (kind) {
      case 'slag':
      case 'lava':
      case 'acid':
      case 'void': {
        if (glows) {
          // The heat on the surface: a flat body of light with a bright skin on it.
          g.fillStyle = css(L.color, -12, kind === 'lava' ? 0.55 : 0.42);
          g.fill(path);
          g.fillStyle = css(L.color, 16, kind === 'lava' ? 0.9 : 0.75);
          g.fill(band(wave, (x) => wave(x) + 3 + sn(x * 0.07, 2.3, 5) * 0.9));
        }
        // Crust patches drifting on the surface.
        s.fillStyle = css(L.color, kind === 'acid' ? -18 : -30, 0.55);
        for (let i = 0; i < 14 * spots; i++) {
          const cx = ((i * 97.3 + t * (6 + (i % 3) * 3)) % (reach + 60)) - 30 - margin;
          ellipse(s, cx, wave(cx) + 4.5, 9 + (i % 4) * 4, 1.6);
        }
        if (kind === 'acid' || kind === 'lava') {
          for (let i = 0; i < 8 * spots; i++) {
            const p = (t * 0.7 + i * 0.37) % 1;
            const bx = ((i * 131.7 + Math.floor(t * 0.7 + i * 0.37) * 53) % reach) - margin;
            (kind === 'lava' ? g : s).fillStyle = css(L.glow, 15, 0.6 * (1 - p));
            circle(kind === 'lava' ? g : s, bx, wave(bx) + 2 - p * 3, 0.8 + p * 1.6);
          }
        }
        if (glows)
          for (let x = 32 + Math.floor((view.x - 100) / 72) * 72; x < view.x + view.w + 100; x += 72)
            light(rc, x, y0 + 4, 90, L.glow, 0.5 + Math.sin(t * 2 + x) * 0.08);
        break;
      }
      case 'street': {
        // A street far below: dark void with streaking car lights, each a hard head and a fainter tail.
        for (let i = 0; i < 10 * spots; i++) {
          const dir = i % 2 ? 1 : -1;
          const sp = 60 + (i % 3) * 25;
          const cx = ((((i * 173 + t * sp * dir) % (reach + 80)) + reach + 80) % (reach + 80)) - 40 - margin;
          const cy = wh - 3 + (i % 2) * 1.5;
          const col = dir > 0 ? hsl3(45, 90, 75) : hsl3(0, 100, 55);
          g.fillStyle = css(col, 0, 0.25);
          g.fillRect(Math.min(cx - dir * 8, cx - dir * 22), cy, 14, 1.2);
          g.fillStyle = css(col, 10, 0.8);
          g.fillRect(Math.min(cx, cx - dir * 8), cy, 8, 1.2);
        }
        for (let x = 40 - margin; x < ww + margin; x += 110) if (x > view.x - 100 && x < view.x + view.w + 100) light(rc, x, wh, 90, L.glow, 0.5);
        break;
      }
      case 'water':
      case 'sea':
      case 'swamp': {
        // Reflections: drifting glints, each a hard sliver, never a soft dot.
        for (let i = 0; i < 16 * spots; i++) {
          const gx = ((((i * 61.7 + t * (kind === 'sea' ? 14 : 5) * (i % 2 ? 1 : -1)) % (reach + 40)) + reach + 40) % (reach + 40)) - 20 - margin;
          const gy = wave(gx) + 4 + (i % 3) * 2;
          const a = 0.3 + 0.3 * Math.sin(t * 2 + i);
          if (a < 0.08) continue;
          const len = 4 + (i % 4) * 2;
          s.fillStyle = css(L.glow, 10, a * (kind === 'swamp' ? 0.4 : 1));
          s.beginPath();
          s.moveTo(gx, gy);
          s.lineTo(gx + len * 0.2, gy - 0.5);
          s.lineTo(gx + len, gy);
          s.lineTo(gx + len * 0.8, gy + 0.5);
          s.closePath();
          s.fill();
        }
        if (kind === 'swamp') {
          const rr = new Rng(th.seed ^ 0x1e1);
          for (let i = 0; i < 9 * spots; i++) {
            const lx = rr.range(-margin, ww + margin);
            const ly = wave(lx) + 1;
            s.fillStyle = css(hsl3(105, 45, 30), 0, 0.95);
            s.beginPath();
            s.ellipse(lx, ly, rr.range(3, 5), 1.2, 0, 0.3, Math.PI * 2);
            s.lineTo(lx, ly);
            s.fill();
            if (rr.chance(0.3)) {
              s.fillStyle = css(hsl3(330, 70, 75));
              circle(s, lx + 1, ly - 0.8, 0.9);
            }
          }
        }
        if (kind === 'sea') {
          // Foam on the crests: short pen strokes riding the swell.
          s.fillStyle = 'rgba(240,250,255,0.8)';
          for (let x = Math.floor(xa / 6) * 6; x <= xb; x += 6) {
            if (Math.sin(x * 0.045 + t * 1.6) <= 0.55 || Math.sin((x - 6) * 0.045 + t * 1.6) > 0.55) continue;
            foam.length = 0;
            for (let k = 0; k <= 5; k++) foam.push({ x: x + k * 2.4, y: wave(x + k * 2.4) + 0.4 });
            stroke(s, foam, { w: 1.1, seed: x, taper: [0.2, 0.5], press: 0.3 });
          }
        }
        break;
      }
      case 'tar': {
        // Bubbles: flat rings that thin as they rise and pop.
        for (let i = 0; i < 6 * spots; i++) {
          const p = (t * 0.25 + i * 0.29) % 1;
          const bx = ((i * 151.3 + Math.floor(t * 0.25 + i * 0.29) * 71) % reach) - margin;
          const r = 1 + p * 3;
          s.fillStyle = `rgba(150,140,170,${0.5 * (1 - p)})`;
          s.beginPath();
          s.arc(bx, wave(bx) + 1, r, Math.PI, 0);
          s.arc(bx, wave(bx) + 1, Math.max(0, r - 0.6), 0, Math.PI, true);
          s.fill();
        }
        break;
      }
    }
    if (sunken && glows) {
      // What's under the surface dims the heat in front of it, or the glow prints right over it.
      g.save();
      g.clip(path);
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = Math.min(1, SEEN_THROUGH[kind] * 2);
      sunken(g);
      g.restore();
    }
    if (kind !== 'street') {
      // The surface line: one unbroken band cut by hand along the wave, from half its width above the
      // wave (where ground drawn after the pool stops, see `dry`) to a little under it, so nothing shows
      // between the ground's foot and the pool. Fire's line glows.
      const line = band(
        (x) => wave(x) - 0.7,
        (x) => wave(x) + 0.75 + 0.45 * (0.5 + 0.5 * sn(x * 0.09, 8.8, 5)),
      );
      // The glow color itself, lifted: mixing hues across the wheel turns a blue sea under a gold sky green.
      s.fillStyle = css(L.glow, 6, 1, -12);
      s.fill(line);
      if (glows) {
        g.fillStyle = css(L.glow, 15, 0.9);
        g.fill(line);
      }
      // The pen under it, many strokes keyed to the world so they ride the swell without sliding along it.
      s.fillStyle = inkOf(L.color, glows ? 0.55 : 0.45);
      for (let x0 = Math.floor(xa / 40) * 40; x0 < xb; x0 += 40) {
        const len = 14 + 20 * hash2(x0, 3, 11);
        if (hash2(x0, 7, 11) < 0.2) continue;
        crest.length = 0;
        for (let x = x0 + 3; x <= x0 + 3 + len; x += 3) crest.push({ x, y: wave(x) + 1.6 });
        stroke(s, crest, { w: 0.9, seed: x0, taper: [0.2, 0.35], press: 0.35 });
      }
    }
    return dry;
  }

  /** Ambient particles (cosmetic, non-deterministic). On the background layer: with ink they read as stray projectiles. */
  drawMotes(rc: RC, th: Theme, dt: number, view: { x: number; y: number; w: number; h: number }) {
    const kind = th.ambient;
    // Motes live in world space around the visible rect; zoomed-out views get proportionally more (capped).
    // Nothing here falls or blows: what comes down the screen is weather (./weather.ts), and that always does something.
    const area = Math.max(1, Math.min(2.5, (view.w * view.h) / (VIEW_W * VIEW_H)));
    const target = Math.round((kind === 'dust' ? 50 : 60) * area);
    const vx0 = view.x;
    const vy0 = view.y;
    while (this.motes.length < target) {
      const fromBottom = kind === 'embers' || kind === 'bubbles';
      this.motes.push({
        x: vx0 + Math.random() * (view.w + 60) - 30,
        y: vy0 + (fromBottom ? view.h + Math.random() * 20 : Math.random() * view.h),
        vx: (Math.random() - 0.5) * 10,
        vy: kind === 'embers' ? -(15 + Math.random() * 30) : kind === 'bubbles' ? -(8 + Math.random() * 10) : (Math.random() - 0.5) * 6,
        life: 4 + Math.random() * 10,
        seed: Math.random() * 100,
      });
    }
    const t = rc.t;
    const col: HSL =
      kind === 'embers'
        ? th.liquid.emissive
          ? th.liquid.glow
          : th.lamp
        : kind === 'fireflies'
          ? hsl3(70, 100, 65)
          : kind === 'spores'
            ? shift(th.accent, 10)
            : kind === 'pollen'
              ? hsl3(50, 90, 75)
              : th.fog;
    this.motes = this.motes.filter((m) => {
      m.life -= dt;
      m.x += (m.vx + Math.sin(t * 0.8 + m.seed) * 8) * dt;
      m.y += m.vy * dt;
      if (m.life <= 0 || m.y < vy0 - 10 || m.y > vy0 + view.h + 25 || m.x < vx0 - 40 || m.x > vx0 + view.w + 40) return false;
      const fade = Math.min(1, m.life);
      switch (kind) {
        case 'embers': {
          const a = fade * (0.6 + 0.4 * Math.sin(t * 9 + m.seed));
          rc.g.fillStyle = css(col, 15, a);
          rc.g.fillRect(m.x, m.y, 1.4, 1.4);
          break;
        }
        case 'fireflies': {
          const a = fade * Math.max(0, Math.sin(t * 1.7 + m.seed));
          glowDot(rc.g, m.x, m.y, 4, col, a * 0.8);
          if (a > 0.6) light(rc, m.x, m.y, 26, col, a * 0.4);
          break;
        }
        case 'pollen':
          rc.g.fillStyle = css(col, 0, 0.5 * fade * (0.5 + 0.5 * Math.sin(t * 2 + m.seed)));
          circle(rc.g, m.x, m.y, 0.8);
          break;
        case 'spores':
          rc.g.fillStyle = css(col, 0, 0.45 * fade);
          circle(rc.g, m.x, m.y, 1);
          break;
        case 'dust':
          rc.bg.fillStyle = css(mixHsl(th.fog, hsl3(45, 60, 95), 0.6), 0, 0.3 * fade);
          rc.bg.fillRect(m.x, m.y, 1, 1);
          break;
        case 'bubbles':
          rc.bg.strokeStyle = `rgba(220,255,255,${0.5 * fade})`;
          rc.bg.lineWidth = 0.6;
          rc.bg.beginPath();
          rc.bg.arc(m.x, m.y, 1.4 + (m.seed % 1.5), 0, Math.PI * 2);
          rc.bg.stroke();
          break;
      }
      return true;
    });
  }
}

/** Animated skyline feature, drawn at the layer's current parallax offset. */
function drawFeature(rc: RC, f: Feature, ox: number, oy: number, haze: number, th: Theme, frame: ViewFrame) {
  const x = ox + f.x;
  const y = oy + f.y;
  if (x < frame.x0 - 60 || x > frame.x1 + 60) return;
  const s = rc.s;
  const g = rc.g;
  const t = rc.t + f.phase;
  const fade = 1 - haze * 0.6;
  switch (f.kind) {
    case 'smoke':
    case 'steam': {
      // Flat puffs in two tones, the lit one cut up-left: smoke has a shape here, not a falloff.
      const smoke = f.kind === 'smoke';
      const n = smoke ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const p = (t * (smoke ? 0.12 : 0.3) + i / n) % 1;
        const r = (2 + p * 10) * f.s * (smoke ? 1.6 : 0.8);
        const a = (smoke ? 0.5 : 0.34) * (1 - p) * Math.min(1, p * 8) * fade;
        const px = x + p * 26 * f.s + Math.sin(p * 4 + f.phase) * 3;
        const py = y - p * 60 * f.s - 2;
        s.fillStyle = css(f.color, -8 - p * 10, a);
        circle(s, px, py, r);
        s.fillStyle = css(f.color, 4 - p * 10, a);
        circle(s, px - r * 0.18, py - r * 0.22, r * 0.72);
      }
      break;
    }
    case 'windmill': {
      // Four lattice sails on inked spars, quiet as the layer they stand in.
      const a0 = t * 0.9;
      const ink = css(mixHsl(shift(f.color, -52), th.fog, haze * 0.8));
      const sail = css(mixHsl(f.color, th.fog, haze * 0.5));
      const bar = css(mixHsl(shift(f.color, -18), th.fog, haze * 0.6));
      const pen = 0.75 * (1 - haze * 0.4);
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const ex = x + ca * f.s;
        const ey = y + sa * f.s;
        const ix = x + ca * f.s * 0.24;
        const iy = y + sa * f.s * 0.24;
        const nx = -sa * f.s * 0.2;
        const ny = ca * f.s * 0.2;
        s.fillStyle = sail;
        s.beginPath();
        s.moveTo(ix, iy);
        s.lineTo(ex, ey);
        s.lineTo(ex + nx, ey + ny);
        s.lineTo(ix + nx * 0.8, iy + ny * 0.8);
        s.fill();
        // One crossbar, then the sail's outer edge and the spar in pen.
        s.fillStyle = bar;
        line(s, (ix + ex) / 2, (iy + ey) / 2, (ix + ex) / 2 + nx * 0.9, (iy + ey) / 2 + ny * 0.9, { w: pen * 0.6, seed: i + 7, taper: [0.1, 0.3], press: 0.1 });
        s.fillStyle = ink;
        line(s, ex + nx, ey + ny, ix + nx * 0.8, iy + ny * 0.8, { w: pen * 0.65, seed: i + 3, taper: [0.2, 0.4], press: 0.3 });
        line(s, x, y, ex, ey, { w: pen, seed: i + 1, taper: [0.05, 0.35], press: 0.25 });
      }
      s.fillStyle = ink;
      circle(s, x, y, 1.5);
      break;
    }
    case 'beam': {
      // Lighthouse: a slow sweep, cut as a flat wedge with a fainter tip; brightest pointing at the viewer.
      const a = t * 0.9;
      const face = Math.cos(a);
      const len = VIEW_W * 0.75;
      const spread = 0.07;
      const dir = Math.sin(a) >= 0 ? 1 : -1;
      const reach = Math.abs(Math.sin(a));
      const strength = (th.night ? 0.22 : 0.1) * (0.35 + 0.65 * reach) * fade;
      for (let k = 0; k < 2; k++) {
        const ex = x + dir * len * reach * (k ? 1 : 0.5);
        const sp = len * spread * reach * (k ? 1 : 0.5);
        g.fillStyle = css(f.color, 15, strength * (k ? 0.5 : 1));
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(ex, y - sp);
        g.lineTo(ex, y + sp * 0.8);
        g.fill();
      }
      glowDot(g, x, y, 8 + Math.max(0, face) * 18, f.color, (0.5 + Math.max(0, face) * 0.5) * fade);
      break;
    }
    case 'blink': {
      const on = (t * 0.7) % 1 < 0.25 ? 1 : 0.15;
      glowDot(g, x, y, 5, f.color, on * fade);
      break;
    }
    case 'flicker': {
      const fl = Math.sin(t * 23) > 0.97 || t % 9 < 0.1 ? 0.3 : 0.85 + Math.sin(t * 7) * 0.08;
      const w = f.w ?? 3;
      const h = f.h ?? 3;
      g.fillStyle = css(f.color, 12, fl * fade);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      glowDot(g, x, y, Math.max(w, h) * 1.1 + 6, f.color, 0.18 * fl * fade);
      break;
    }
    case 'torch': {
      const fl = 0.8 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
      flame(g, x, y, 1.6 * fl, 4 * fl, f.color, t);
      glowDot(g, x, y - 1, 14 * fl, f.color, 0.35 * fade);
      break;
    }
    case 'flare': {
      const fl = 0.8 + Math.sin(t * 11) * 0.15;
      flame(g, x, y, 2.4 * fl, 9 * fl, f.color, t);
      glowDot(g, x, y - 3, 22 * fl, f.color, 0.4 * fade);
      break;
    }
    case 'plume': {
      // Volcanic ash column: flat puffs lit from underneath by the crater, over a pulsing vent.
      const lava = th.liquid.glow;
      for (let i = 0; i < 10; i++) {
        const p = (t * 0.035 + i / 10) % 1;
        const r = (6 + p * 34) * f.s;
        const a = 0.7 * (1 - p) * Math.min(1, p * 6);
        const px = x + p * 70 * f.s + Math.sin(p * 5 + i) * 6;
        const py = y - p * 150 * f.s - 4;
        s.fillStyle = css(mixHsl(f.color, lava, Math.max(0, 0.85 - p * 1.2)), 8 - p * 6, a);
        circle(s, px, py, r);
        s.fillStyle = css(f.color, -2 - p * 6, a);
        circle(s, px - r * 0.08, py - r * 0.24, r * 0.84);
      }
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.3);
      glowDot(g, x, y + 2, 34 * f.s, th.liquid.glow, 0.4 * pulse * fade);
      break;
    }
    case 'flag': {
      s.fillStyle = css(f.color, 6);
      s.beginPath();
      s.moveTo(x, y);
      for (let i = 0; i <= 4; i++) s.lineTo(x + i * 2 * f.s, y + flutter(rc, 5, -i) * (i / 4));
      for (let i = 4; i >= 0; i--) s.lineTo(x + i * 2 * f.s, y + 3 * f.s + flutter(rc, 5, -i) * (i / 4));
      s.fill();
      break;
    }
    case 'glint': {
      // Glitter path on water under the sun/moon.
      const h = f.h ?? 80;
      for (let i = 0; i < 26; i++) {
        const k = hash2(i, 7, 3);
        const yy = y + 2 + k * k * h;
        const spread = 6 + (yy - y) * 0.35;
        const xx = x + (hash2(i, Math.floor(t * 2 + i), 9) - 0.5) * spread * 2;
        const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 3 + i * 1.7))) * 0.7 * f.s;
        g.fillStyle = css(f.color, 15, a);
        g.fillRect(xx, yy, 3 + k * 8, 0.8);
      }
      break;
    }
  }
}

function bakeLayer(pool: CanvasPool, L: SkyLayer, th: Theme, W: number, H: number, kb: number): BakedLayer {
  const def = SKYLINES[L.kind];
  const pw = Math.ceil(W * kb);
  const ph = Math.ceil(H * kb);
  const [c, g] = pool.take(pw, ph, kb);
  let glowC: Surface | null = null;
  let e: CanvasRenderingContext2D | null = null;
  if (def.glow) [glowC, e] = pool.take(pw, ph, kb);
  // The silhouette keeps its place in the view however tall the layer is; only what's under it runs on.
  const feats: Feature[] = [];
  def.bake({ g, e, L, th, W, H, rng: new Rng(L.seed), feats, ridge: ridgeOf(L) });
  // Atmospheric perspective: one flat veil of fog over all the layer drew, its ink included. Depth reads
  // from that and the lighter pen, never from blur: a soft backdrop is a different picture from the front.
  if (L.haze > 0) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = css(th.fog, 0, Math.min(1, L.haze * 0.92));
    g.fillRect(0, 0, pw, ph);
    g.restore();
  }
  return { c, glow: glowC, depth: L.depth, haze: L.haze, feats };
}

/** sRGB mix along the sky's three stops, as the old gradient ran: `u` 0 at the window's top, 1 at its bottom. */
function skyAt(th: Theme, u: number): string {
  const k = Math.max(0, Math.min(1, u));
  const [a, b, t] = k < 0.55 ? [th.skyTop, th.skyMid, k / 0.55] : [th.skyMid, th.skyBottom, (k - 0.55) / 0.45];
  const ra = toRgb(a);
  const rb = toRgb(b);
  const ch = (i: number) => Math.round((ra[i] + (rb[i] - ra[i]) * t) * 255);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** How many flat bands the sky is cut into. */
const SKY_BANDS = 6;

/**
 * The sky as cel tones: flat bands with a hand's edge between them, each the color its stretch of the
 * old gradient had, the horizon's light as two more bands, and light shafts as flat wedges. Baked
 * once; a frame draws it as one image.
 */
function bakeSky(pool: CanvasPool, th: Theme, f: ViewFrame, kb: number): Baked['sky'] {
  const x = f.x0 - 40;
  const y = f.y0 - 40;
  const w = f.w + 80;
  const h = f.h + 80;
  // Nothing in here is finer than a band edge: it bakes coarser than the layers.
  const k = Math.min(kb, 1.5);
  const [c, g] = pool.take(Math.ceil(w * k), Math.ceil(h * k), k);
  g.translate(-x, -y);
  const seed = th.seed & 0xffff;
  const xa = x - 4;
  const xb = x + w + 4;
  const under = (pts: P[], col: string) => fillPts(g, [...pts, { x: xb, y: y + h + 4 }, { x: xa, y: y + h + 4 }], col);
  g.fillStyle = skyAt(th, 0.5 / SKY_BANDS);
  g.fillRect(x, y, w, h);
  for (let b = 1; b < SKY_BANDS; b++) {
    const yb = f.y0 + (f.h * b) / SKY_BANDS;
    under(
      along(xa, xb, 8, (xx) => yb + sn(xx * 0.005, b * 2.3, seed) * 6 + sn(xx * 0.021, b * 5.1, seed) * 1.6),
      skyAt(th, (b + 0.5) / SKY_BANDS),
    );
  }
  if (th.horizon.strength > 0) {
    const hy = th.horizon.y * VIEW_H;
    const str = th.horizon.strength;
    under(
      along(xa, xb, 8, (xx) => hy - VIEW_H * 0.2 + sn(xx * 0.004, 7.7, seed) * 7),
      css(th.horizon.color, 0, str * 0.2),
    );
    // The brightest stripe sits on the horizon itself, cut above and below.
    const top = along(xa, xb, 8, (xx) => hy - VIEW_H * 0.075 + sn(xx * 0.006, 9.1, seed) * 4 + sn(xx * 0.03, 2.2, seed) * 1.2);
    const bot = backward(along(xa, xb, 8, (xx) => hy + VIEW_H * 0.11 + sn(xx * 0.005, 4.4, seed) * 5));
    fillPts(g, [...top, ...bot], css(th.horizon.color, 0, str * 0.26));
  }
  if (th.rays) {
    // Light shafts: flat wedges in two steps, fixed in place. Light, so they add.
    const cel = th.celestial;
    const none = cel.kind === 'none';
    const rx = none ? VIEW_W * (0.3 + (th.seed % 40) / 100) : cel.x * VIEW_W;
    const ry = none ? -40 : cel.y * VIEW_H;
    const col = none ? th.lamp : cel.glow;
    const al = th.night ? 0.045 : 0.06;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i - 2) * (none ? 0.16 : 0.3) + (hash2(i, 5, th.seed) - 0.5) * 0.14 + (rx - VIEW_W / 2) * -0.0009;
      const wd = 0.03 + hash2(i, 3, th.seed) * 0.045;
      for (let s = 0; s < 2; s++) {
        const len = VIEW_H * (s ? 1.6 : 0.75);
        g.fillStyle = css(col, 10, al * (s ? 0.6 : 1));
        g.beginPath();
        g.moveTo(rx, ry);
        g.lineTo(rx + Math.cos(a - wd) * len, ry + Math.sin(a - wd) * len);
        g.lineTo(rx + Math.cos(a + wd) * len, ry + Math.sin(a + wd) * len);
        g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
  return { c, x, y, w, h };
}

/** Points round a circle cut by hand. */
function orbPts(r: number, seed: number, lump = 0.025): P[] {
  const n = Math.max(24, Math.round(r * 3));
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 + lump * sn(Math.cos(a) * 1.3 + seed * 0.37, Math.sin(a) * 1.3, seed));
    pts.push({ x: Math.cos(a) * k, y: Math.sin(a) * k });
  }
  return pts;
}

/**
 * The sun, moon or planet: a flat disc with its lit face cut toward the upper left, in hard flat rings
 * of its own light. Only an eclipse's corona glows, because only it is fire against the dark.
 */
function bakeOrb(pool: CanvasPool, th: Theme, kb: number): Baked['orb'] {
  const c = th.celestial;
  if (c.kind === 'none') return null;
  const r = c.r;
  const half = Math.ceil(r * (c.kind === 'eclipse' ? 3.4 : c.kind === 'sun' ? 2.6 : 1.9)) + 2;
  const k = Math.min(4, kb * 1.5);
  const [surf, g] = pool.take(Math.ceil(half * 2 * k), Math.ceil(half * 2 * k), k);
  g.translate(half, half);
  const seed = (th.seed & 0xfff) + 1;
  const disc = orbPts(r, seed);
  const litFace = (lit: HSL, shade: HSL) => {
    fillPts(g, disc, css(shade));
    g.save();
    g.beginPath();
    disc.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.clip();
    fillPts(
      g,
      disc.map((p) => ({ x: p.x * 0.92 - r * 0.13, y: p.y * 0.92 - r * 0.16 })),
      css(lit),
    );
    g.restore();
  };
  let e: Surface | null = null;
  switch (c.kind) {
    case 'sun': {
      const day = th.mood === 'day';
      fillPts(g, orbPts(r * 2.45, seed + 1, 0.02), css(c.glow, 8, day ? 0.12 : 0.16));
      fillPts(g, orbPts(r * 1.6, seed + 2, 0.025), css(c.glow, 12, day ? 0.2 : 0.24));
      litFace(shift(c.color, 14), shift(c.color, 2));
      // A warm pen round its shaded side only: the lit side has no edge to draw.
      penPath(g, disc, true, { w: 0.9, col: css(c.glow, -16, 0.55), seed, run: r * 1.1, lift: 0.4, facing: 1, inside: { x: 0, y: 0 } });
      break;
    }
    case 'moon': {
      fillPts(g, orbPts(r * 1.55, seed + 1, 0.02), css(c.glow, 4, 0.1));
      litFace(c.color, shift(c.color, -14));
      const rng = new Rng(th.seed ^ 0x300);
      for (let i = 0; i < 6; i++) {
        const a = rng.range(0, 6.28);
        const d = rng.range(0, r * 0.7);
        const cr = rng.range(r * 0.08, r * 0.22);
        g.fillStyle = css(c.color, -16, 0.7);
        blob(g, Math.cos(a) * d, Math.sin(a) * d, cr, seed + i, 1, 0.12);
        g.fill();
      }
      // The night side, cut hard.
      g.fillStyle = 'rgba(0,0,10,0.32)';
      g.beginPath();
      g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      g.ellipse(0, 0, r * 0.45, r, 0, Math.PI / 2, -Math.PI / 2, true);
      g.fill();
      penPath(g, disc, true, { w: 0.8, col: inkOf(c.color, 0.5), seed, run: r * 1.3, lift: 0.35, facing: 1, inside: { x: 0, y: 0 } });
      break;
    }
    case 'planet': {
      fillPts(g, orbPts(r * 1.35, seed + 1, 0.02), css(c.glow, 0, 0.12));
      litFace(c.color, shift(c.color, -14));
      penPath(g, disc, true, { w: 0.8, col: inkOf(c.color, 0.45), seed, run: r * 1.3, lift: 0.3, facing: 1, inside: { x: 0, y: 0 } });
      break;
    }
    case 'eclipse': {
      // The corona is fire: flat tongues round the disc on the glow layer, cut, never a falloff.
      const [es, eg] = pool.take(Math.ceil(half * 2 * k), Math.ceil(half * 2 * k), k);
      eg.translate(half, half);
      const rings: [number, number, number, number][] = [
        [3.1, 11, 0.3, 0],
        [2.0, 17, 0.55, 8],
        [1.32, 23, 0.95, 18],
      ];
      for (const [reach, n, a, dl] of rings) {
        const pts: P[] = [];
        for (let i = 0; i < n * 2; i++) {
          const ang = (i / (n * 2)) * Math.PI * 2;
          const tip = i % 2 === 0;
          const rr = r * (tip ? 1 + (reach - 1) * (0.55 + 0.45 * hash2(i, n, seed)) : 1 + (reach - 1) * 0.28);
          pts.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr });
        }
        fillPts(eg, pts, css(c.glow, dl, a));
      }
      eg.globalCompositeOperation = 'destination-out';
      fillPts(eg, disc, '#000');
      eg.globalCompositeOperation = 'source-over';
      e = es;
      fillPts(g, disc, '#050508');
      break;
    }
  }
  return { c: surf, e, half };
}

/**
 * A cloud as a cel shape: puffy ones are a crest of puffs on a flat base, wispy and ash ones long
 * lenses stacked. Each is its shadow tone with the lit body cut up-left over it, and a light pen
 * along the crest that lifts often; the base gets only a few strokes.
 */
function bakeCloud(pool: CanvasPool, rng: Rng, w: number, h: number, th: Theme, kb: number, fade = 0): Surface {
  const [c, g] = pool.take(Math.ceil(w * kb), Math.ceil(h * kb), kb);
  // `fade` sinks the whole cloud toward the sky it sits in.
  const base = mixHsl(th.cloudColor, th.skyMid, fade);
  // The underside takes the sky's own color, warmed by the horizon.
  const under = mixHsl(base, mixHsl(th.skyMid, th.horizon.color, 0.4), 0.35);
  const seed = rng.int(1, 1e6);
  const ink = css(hsl3(under.h, Math.min(60, under.s + 12), under.l * 0.45), 0, 0.85);
  if (th.cloudStyle === 'puffy') {
    const n = rng.int(4, 7);
    const baseY = h * 0.88;
    const puffs: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      // Biggest and highest in the middle: a crown, not a loaf.
      const mid = 1 - Math.abs(u - 0.5) * 1.15;
      const px = w * (0.15 + 0.7 * u) + rng.range(-3, 3);
      const r = Math.min(h * (0.16 + 0.3 * mid) * rng.range(0.85, 1.2) + 2, px - 1.5, w - 1.5 - px);
      puffs.push({ x: px, y: Math.max(r + 1.2, baseY - r * rng.range(0.2, 0.55) - h * 0.2 * mid * rng.range(0.3, 1)), r });
    }
    const top = (x: number) => {
      let y = baseY;
      for (const p of puffs) {
        const dx = x - p.x;
        if (Math.abs(dx) < p.r) y = Math.min(y, p.y - Math.sqrt(p.r * p.r - dx * dx));
      }
      return y;
    };
    const xa = Math.min(...puffs.map((p) => p.x - p.r)) + 0.5;
    const xb = Math.max(...puffs.map((p) => p.x + p.r)) - 0.5;
    const crest = along(xa, xb, 1.5, top);
    const shape = [...crest, { x: xb, y: baseY }, { x: xa, y: baseY }];
    fillPts(g, shape, css(under, -9));
    g.save();
    g.beginPath();
    shape.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.clip();
    // The lit body: each puff again, smaller and pulled up-left, so the shade under them is scalloped.
    g.fillStyle = css(base, 4);
    g.beginPath();
    for (const p of puffs) {
      g.moveTo(p.x - p.r * 0.12 + p.r * 0.8, p.y - p.r * 0.22);
      g.arc(p.x - p.r * 0.12, p.y - p.r * 0.22, p.r * 0.8, 0, Math.PI * 2);
    }
    g.fill();
    g.restore();
    penPath(g, crest, false, { w: 0.8, col: ink, seed, run: 20, lift: 0.3 });
    penPath(
      g,
      along(xa + 5, xb - 5, 3, () => baseY - 0.4),
      false,
      { w: 0.55, col: ink, seed: seed + 5, run: 9, lift: 0.8, facing: 0 },
    );
    return c;
  }
  // Wispy and ash: long lenses, flat-bellied, lumpier when it's ash.
  const ash = th.cloudStyle === 'ash';
  const n = ash ? rng.int(3, 5) : rng.int(2, 4);
  const lump = ash ? 0.3 : 0.1;
  for (let i = 0; i < n; i++) {
    const a = w * rng.range(0.02, 0.32);
    const b = w * rng.range(0.68, 0.98);
    const cy = h * rng.range(0.45, 0.7);
    const tk = Math.min(h * rng.range(0.22, 0.42), (cy - 1) / (1 + lump), (h - 1 - cy) / 0.35);
    const sw = (x: number) => Math.sin((Math.PI * (x - a)) / (b - a));
    const topF = (x: number) => cy - tk * Math.pow(Math.max(0, sw(x)), 0.7) * (1 + lump * sn(x * 0.08, i * 3.3, seed));
    const crest = along(a, b, 2, topF);
    const belly = backward(along(a, b, 2, (x) => cy + tk * 0.35 * sw(x)));
    fillPts(g, [...crest, ...belly], css(under, ash ? -3 : -2, 0.94));
    const la = a + (b - a) * 0.05;
    const lb = b - (b - a) * 0.14;
    const lit = along(la, lb, 2, (x) => topF(x) - 0.2);
    const litLow = backward(along(la, lb, 2, (x) => cy - tk * 0.15 * sw(x) + sn(x * 0.05, i, seed) * tk * 0.12));
    fillPts(g, [...lit, ...litLow], css(base, ash ? 2 : 5, 0.96));
    penPath(g, crest, false, { w: 0.65, col: ink, seed: seed + i * 13, run: 28, lift: 0.4 });
  }
  return c;
}
