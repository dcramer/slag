/**
 * The fair-play check (docs/ART.md → Fair play): "the art must not lie about the hitbox. Anything that looks
 * solid is solid." Every stage concept of every theme, and a plain level of each, is raced over a few seeds
 * and rendered with no runners; the play layer (`rc.s`, the foreground the cel pass inks) is read back, and
 * every opaque pixel on it has to lie within `EDGE_DRIFT` of something the sim touches with: a solid or
 * one-way tile, a prop solid, a hazard, a spring, a trigger or a blowing column. Thin things may hang
 * past (grass, vines, ink lines, a brace): what's left once every mark thinner than `THIN` is worn away is a lie, and each
 * piece of it is reported by the cells it covers.
 *
 * Backdrop art (`BACKDROP`, the skyline, the surroundings) paints on the background layer, where nothing
 * stands, so the play-layer read skips it. What it can still do is pass for wall: a landmark's shell seen
 * through a notch or slot in the landmark's walls, in the finished picture, mustn't come within `CAMO` of the
 * walls' colour (the Big Barn's red back wall in its red roof's notches read as more roof). Terrain decor is
 * left out unless `--decor` (it's held to "small" by its own rules). The pool along the bottom and the spawn
 * and goal markers are out of scope.
 *
 *   pnpm shot fairplay [--theme T] [--concept id,…|plain] [--count N] [--decor] [--strict] [--camo ΔE]
 *
 * Writes `fairplay-<theme>-<concept>-<seed>-<frame>.png` for each view with a lie (the play layer, the
 * allowed shapes in blue, what's past them in orange, the lie in magenta) and exits non-zero. `--camo 45`
 * prints every notch's measure, to see the margin.
 */
import { EDGE_DRIFT } from '../../src/render/ink';
import { CONCEPTS } from '../../src/gen/stage';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { writeFileSync } from 'node:fs';
import { open, opt, out, page, pet, seed, theme, flag } from './ctx';
import type { Scenarios } from './ctx';

/** Half the width of the thickest mark that still reads as thin (world px): a post, brace or ram's rod up to 4 px is fine. */
const THIN = 2;
/** A lie smaller than this many world px² (a 3×4 knob) is a rivet or a bolt head, not somewhere to stand. */
const MIN_AREA = 12;
/**
 * A landmark's shell, as seen through a notch or slot in its walls, closer than this (CIE76 ΔE on the finished
 * picture) to the walls' colour reads as wall. The barn's red back wall in its red roof's notches measured
 * 22–29; its raw boards measure 32 and up.
 */
const CAMO = 30;

/**
 * Landmarks whose shells measure under CAMO somewhere, waiting on an art pass: a shell of the building's own
 * material behind a gap in it (a brick facade through a slot in a brick wall, hull behind hull, cave rock behind
 * cave rock). Left out so a new one still fails; `--strict` puts them back. Empty this list, don't grow it.
 */
const PENDING_SHELLS = [
  'crystal-geode',
  'lava-tube',
  'flooded-gallery',
  'magma-tide',
  'lavafall-organ',
  'caldera',
  'boiler-house',
  'galleon',
  'starship',
  'ring-station',
  'mining-rig',
  'planetoid',
  'boss-bridge',
  'gatehouse',
  'throne-hall',
  'bell-tower',
  'haunted-wing',
  'grain-elevator',
];

/**
 * Module types (and looks) whose play-layer art is known to lie, waiting on the owner's call: each is a
 * set-piece machine that draws a body the sim never touches with, only what it fires, pours or swings.
 * docs/DESIGN.md keeps the moving parts of set pieces in front of the terrain (a windmill's sails), so they
 * can't simply go behind. Left out of the picture so anything new still fails; `--strict` puts them back.
 * Empty this list, don't grow it.
 */
const PENDING: [string, string?][] = [
  // Guns on ledges (castle cannons, muck spreaders, idols, ship guns, harpoons): nothing solid under the gun.
  ['cannon'],
  // Sails, wheel discs, spokes and hubs: only the platforms at the ends are solid.
  ['rotor'],
  // Spin bars, maces and hooks: only the heads hurt; the hub block and arm are air.
  ['swinger'],
  // Robot arms: only the head hurts.
  ['arm'],
  // Ladles: only the pour and the spill hurt; the bucket is air.
  ['ladle'],
  // Mine carts on rails, hanging signs: they hurt only while running or falling.
  ['cart'],
  ['sign'],
  // Antennas and fence posts: only the arc hurts.
  ['tesla'],
  // The lighthouse lamp: only its beam hurts.
  ['laser', 'lamp'],
  // Water drawn before it's let in: thin ice's pool, a tide, a spout's basin.
  ['thaw'],
  ['flood'],
  ['geyser'],
];

/** Sim frames into the race at which each level is read: movers at a few points of their cycles. */
const FRAMES = [2, 61, 137];

interface Lie {
  /** The set piece whose footprint is nearest. */
  near: string;
  cells: [number, number][];
  tiles?: string;
  box: { x: number; y: number; w: number; h: number };
  area: number;
}

interface ViewResult {
  lies: Lie[];
  png?: string;
}

/** Load a level of `th` with concept `id` (or plain) and race it, runners kept, to frame `f0`. */
async function race(s: string, th: ThemeId, id: string, decor: boolean) {
  await page.evaluate(
    ([sd, t, c, dec]) => {
      const d = (window as any).slagDebug;
      const r = d.renderer;
      // Decor is out of scope unless asked for: an empty placement leaves the bake without it.
      if (!dec && !r.terrain.__fairplay) {
        r.terrain.__fairplay = true;
        r.terrain.makeDecor = function () {
          this.decor = [];
          this.live = [];
        };
      }
      d.match.forceProfile = { ...d.match.forceProfile, concept: c };
      d.loadLevel(sd, t);
      // A concept that didn't fit falls back to plain, and a plain level's key has no concept in it: the
      // same seed's plain level next would be taken for a crater in it and patched. Bake each one whole.
      r.terrain.inkKey = '';
      r.terrain.bakeKey = '';
      d.race([]);
    },
    [s, th, id, decor] as const,
  );
}

/** Step the race to frame `f` and read every view of the level there. */
async function readAt(f: number, wantPng: boolean, strict: boolean): Promise<ViewResult[]> {
  return page.evaluate(
    ([frame, edge, thin, minArea, png, pending, camo, shells]) => {
      const d = (window as any).slagDebug;
      const m = d.match;
      const run = m.run;
      const r = d.renderer;
      const lv = m.level;
      const TILE = 16;
      const ww = lv.w * TILE;
      const wh = lv.h * TILE;
      // The shapes of the frame before and this one: the renderer can draw a mover a frame either side of what the sim built.
      const shapes: { solids: any[]; hazards: any[]; springs: any[]; triggers: any[]; winds: any[] }[] = [];
      const grab = () => {
        const o = run.out;
        shapes.push(
          JSON.parse(
            JSON.stringify({
              solids: run.solids.map((s: any) => ({ x: s.x, y: s.y, w: s.w, h: s.h })),
              hazards: o.hazards,
              springs: o.springs.map((s: any) => s.rect),
              triggers: o.triggers.map((t: any) => ({ r: t.r, c: t.circle })),
              // A column that's blowing (a geyser, a pour) is something you touch; one that's off isn't drawn.
              winds: o.winds.filter((w: any) => w.k > 0).map((w: any) => ({ x: w.x, y: w.y, w: w.w, h: w.h })),
            }),
          ),
        );
      };
      while (run.frame < frame - 1) m.step({});
      grab();
      m.step({});
      grab();
      // Nobody in it: runners aren't scenery, and nothing they shoot either, nor the puffs and sparks of what happened.
      const runners = run.runners;
      const shots = run.projectiles;
      const resolved = run.resolved;
      run.runners = [];
      run.projectiles = [];
      m.drainEvents();
      r.fx.n = 0;
      // Known lies waiting on a call (PENDING) are left out of the picture, their shapes still counted.
      const known = (mod: any) => pending.some(([type, look]: [string, string?]) => mod.type === type && (!look || mod.look === look));
      run.resolved = resolved.map((rp: any) =>
        rp.mods.some(known) ? { ...rp, mods: rp.mods.map((mod: any) => (known(mod) ? { ...mod, type: 'pending' } : mod)) } : rp,
      );
      const results: { lies: any[]; png?: string }[] = [];
      const vis0 = { w: 768, h: 432 };
      r.pin = { cx: ww / 2, cy: wh / 2, zoom: 1 };
      d.render(1000);
      const v = r.cam.visible();
      vis0.w = v.w;
      vis0.h = v.h;
      const nx = ww <= vis0.w + 1 ? 1 : Math.ceil((ww - 32) / (vis0.w - 32));
      const ny = wh <= vis0.h + 1 ? 1 : Math.ceil((wh - 32) / (vis0.h - 32));
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const cx = nx === 1 ? ww / 2 : vis0.w / 2 + ((ww - vis0.w) * ix) / (nx - 1);
          const cy = ny === 1 ? wh / 2 : vis0.h / 2 + ((wh - vis0.h) * iy) / (ny - 1);
          r.pin = { cx, cy, zoom: 1 };
          // The background without the landmark's shells (deco), to tell what they paint from the sky, the cave and the rest.
          let bare: Uint8ClampedArray | null = null;
          if (lv.landmark && !shells.includes(lv.landmark.concept)) {
            const keep = run.resolved;
            // Shells are deco: everything else stays, so a lava pool or a tower's mast isn't taken for one.
            run.resolved = keep.map((rp: any) => ({ ...rp, mods: rp.mods.map((mod: any) => (mod.type === 'deco' ? { ...mod, type: 'pending' } : mod)) }));
            r.fx.n = 0;
            d.render(1000);
            bare = r.scene.getContext('2d')!.getImageData(0, 0, r.scene.width, r.scene.height).data;
            run.resolved = keep;
          }
          r.fx.n = 0;
          d.render(1000);
          // What a player sees, read back before the frame is handed to the screen: the cel pass dims and
          // bands the backdrop, so albedo alone says nothing about whether a shell matches the walls.
          let shown: Uint8ClampedArray | null = null;
          if (bare) {
            const gl: HTMLCanvasElement = r.glCanvas;
            const cc = document.createElement('canvas');
            cc.width = r.foreground.canvas.width;
            cc.height = r.foreground.canvas.height;
            const cx2 = cc.getContext('2d')!;
            cx2.drawImage(gl, 0, 0, cc.width, cc.height);
            shown = cx2.getImageData(0, 0, cc.width, cc.height).data;
          }
          const fg: HTMLCanvasElement = r.foreground.canvas;
          const W = fg.width;
          const H = fg.height;
          const probe = new OffscreenCanvas(1, 1).getContext('2d')!;
          probe.setTransform(1, 0, 0, 1, 0, 0);
          r.cam.apply(probe, r.pw);
          const T = probe.getTransform();
          const k = T.a;
          // What may be drawn on: everything the sim touches with, grown by EDGE_DRIFT.
          const al = new OffscreenCanvas(W, H);
          const a = al.getContext('2d')!;
          a.setTransform(T);
          a.fillStyle = '#fff';
          a.strokeStyle = '#fff';
          a.lineCap = 'round';
          const e = edge;
          const box = (x: number, y: number, w: number, h: number) => a.fillRect(x - e, y - e, w + 2 * e, h + 2 * e);
          // Past the level's edges (the surroundings, the pool) is someone else's check.
          a.fillRect(-1e4, -1e4, 2e4 + ww, 1e4);
          a.fillRect(-1e4, -1e4, 1e4, 2e4 + wh);
          a.fillRect(ww, -1e4, 1e4, 2e4 + wh);
          a.fillRect(-1e4, wh - TILE, 2e4 + ww, 1e4);
          for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) if (lv.tiles[y * lv.w + x] !== 0) box(x * TILE, y * TILE, TILE, TILE);
          // The spawn portal and the goal flag are markers, not scenery.
          for (const p of [lv.spawn, lv.goal]) a.fillRect((p.tx - 1) * TILE, (p.ty - 3) * TILE, 3 * TILE, 4 * TILE);
          for (const sh of shapes) {
            for (const s of sh.solids) box(s.x, s.y, s.w, s.h);
            for (const s of sh.springs) box(s.x, s.y, s.w, s.h);
            for (const s of sh.winds) box(s.x, s.y, s.w, s.h);
            for (const t of sh.triggers) {
              box(t.r.x, t.r.y, t.r.w, t.r.h);
            }
            for (const h of sh.hazards) {
              if (h.kind === 'rect') box(h.r.x, h.r.y, h.r.w, h.r.h);
              else if (h.kind === 'circle') {
                a.beginPath();
                a.arc(h.x, h.y, h.r + e, 0, Math.PI * 2);
                a.fill();
              } else {
                a.lineWidth = 2 * (h.r + e);
                a.beginPath();
                a.moveTo(h.x1, h.y1);
                a.lineTo(h.x2, h.y2);
                a.stroke();
              }
            }
          }
          const fd = fg.getContext('2d')!.getImageData(0, 0, W, H).data;
          const ad = a.getImageData(0, 0, W, H).data;
          const n = W * H;
          const lies: any[] = [];
          // Camouflage: behind the terrain, a landmark's backdrop shell in an empty cell next to its walls must not
          // look like the walls. A back wall the colour of the roof reads as more roof (the barn's notches). Only
          // what the shell paints counts: the sky or a cave wall behind is the theme's, not the landmark's.
          const lm = lv.landmark;
          if (lm && bare && shown && !shells.includes(lm.concept)) {
            const sky = bare;
            const seen = shown;
            const sd = r.scene.getContext('2d')!.getImageData(0, 0, W, H).data;
            const lab = (d8: Uint8ClampedArray, o: number) => {
              const f = (c: number) => {
                c /= 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              };
              const R = f(d8[o]);
              const G = f(d8[o + 1]);
              const B = f(d8[o + 2]);
              const g3 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
              const X = g3((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
              const Y = g3(R * 0.2126 + G * 0.7152 + B * 0.0722);
              const Z = g3((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
              return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
            };
            // Mean colour over a cell's pixels that pass `use`, or null if too few do.
            const mean = (tx: number, ty: number, d8: Uint8ClampedArray, use: (i: number) => boolean) => {
              const p0 = T.transformPoint({ x: tx * TILE + 2, y: ty * TILE + 2 });
              const p1 = T.transformPoint({ x: tx * TILE + TILE - 2, y: ty * TILE + TILE - 2 });
              const acc = [0, 0, 0];
              let c = 0;
              let all = 0;
              for (let y = Math.max(0, p0.y | 0); y < Math.min(H, p1.y | 0); y++)
                for (let x = Math.max(0, p0.x | 0); x < Math.min(W, p1.x | 0); x++) {
                  const i = y * W + x;
                  all++;
                  if (!use(i)) continue;
                  const v = lab(d8, i * 4);
                  acc[0] += v[0];
                  acc[1] += v[1];
                  acc[2] += v[2];
                  c++;
                }
              return c > all * 0.6 && c > 0 ? acc.map((x) => x / c) : null;
            };
            const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= lv.w || y >= lv.h ? 0 : lv.tiles[y * lv.w + x]);
            const R0 = lm.rect;
            for (let y = R0.y; y < R0.y + R0.h; y++)
              for (let x = R0.x; x < R0.x + R0.w; x++) {
                if (tile(x, y) !== 0) continue;
                // Only cells walled on two sides or more: a notch, a slot, a corner, where a wall-coloured backdrop closes the gap.
                const walls = [
                  [x - 1, y],
                  [x + 1, y],
                  [x, y - 1],
                  [x, y + 1],
                ].filter(([wx, wy]) => tile(wx, wy) === 1);
                if (walls.length < 2) continue;
                // What shows of the shell: the play layer clear there, and the shell painted over the bare background.
                const shell = (i: number) =>
                  fd[i * 4 + 3] < 25 &&
                  Math.abs(sd[i * 4] - sky[i * 4]) + Math.abs(sd[i * 4 + 1] - sky[i * 4 + 1]) + Math.abs(sd[i * 4 + 2] - sky[i * 4 + 2]) > 24;
                const back = mean(x, y, seen, shell);
                if (!back) continue;
                let close = Infinity;
                for (const [wx, wy] of walls) {
                  const wall = mean(wx, wy, seen, (i) => fd[i * 4 + 3] >= 230);
                  if (wall) close = Math.min(close, Math.hypot(back[0] - wall[0], back[1] - wall[1], back[2] - wall[2]));
                }
                if (close < camo)
                  lies.push({
                    near: `${lm.concept} backdrop the colour of its ${lm.skin ?? 'terrain'} walls (ΔE ${close.toFixed(1)})`,
                    cells: [[x, y]],
                    box: { x: x * TILE, y: y * TILE, w: TILE, h: TILE },
                    area: TILE * TILE,
                  });
              }
          }
          // Distance (chamfer 3-4, in thirds of a px) from each lying pixel to the nearest honest one.
          const BIG = 1 << 29;
          const dist = new Int32Array(n);
          let any = false;
          for (let i = 0; i < n; i++) {
            const lie = fd[i * 4 + 3] >= 230 && ad[i * 4 + 3] < 128;
            dist[i] = lie ? BIG : 0;
            any ||= lie;
          }
          if (!any && !lies.length) {
            results.push({ lies: [] });
            continue;
          }
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              const i = y * W + x;
              if (!dist[i]) continue;
              let v2 = dist[i];
              if (x > 0) v2 = Math.min(v2, dist[i - 1] + 3);
              if (y > 0) {
                v2 = Math.min(v2, dist[i - W] + 3);
                if (x > 0) v2 = Math.min(v2, dist[i - W - 1] + 4);
                if (x < W - 1) v2 = Math.min(v2, dist[i - W + 1] + 4);
              } else v2 = Math.min(v2, 3);
              if (x === 0 || x === W - 1) v2 = Math.min(v2, 3);
              dist[i] = v2;
            }
          for (let y = H - 1; y >= 0; y--)
            for (let x = W - 1; x >= 0; x--) {
              const i = y * W + x;
              if (!dist[i]) continue;
              let v2 = dist[i];
              if (x < W - 1) v2 = Math.min(v2, dist[i + 1] + 3);
              if (y < H - 1) {
                v2 = Math.min(v2, dist[i + W] + 3);
                if (x < W - 1) v2 = Math.min(v2, dist[i + W + 1] + 4);
                if (x > 0) v2 = Math.min(v2, dist[i + W - 1] + 4);
              } else v2 = Math.min(v2, 3);
              dist[i] = v2;
            }
          // A core pixel is further than THIN from anything honest: the middle of a mark too thick to be decoration.
          const coreAt = thin * k * 3;
          const seen = new Uint8Array(n);
          const inv = T.inverse();
          const stack: number[] = [];
          for (let i0 = 0; i0 < n; i0++) {
            if (seen[i0] || dist[i0] <= coreAt) continue;
            let x0 = Infinity;
            let y0 = Infinity;
            let x1 = -Infinity;
            let y1 = -Infinity;
            let count = 0;
            stack.push(i0);
            seen[i0] = 1;
            while (stack.length) {
              const i = stack.pop()!;
              const x = i % W;
              const y = (i / W) | 0;
              count++;
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const xx = x + dx;
                  const yy = y + dy;
                  if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                  const j = yy * W + xx;
                  if (!seen[j] && dist[j] > coreAt) {
                    seen[j] = 1;
                    stack.push(j);
                  }
                }
            }
            const area = count / (k * k);
            if (area < minArea) continue;
            const p0 = inv.transformPoint({ x: x0, y: y0 });
            const p1 = inv.transformPoint({ x: x1 + 1, y: y1 + 1 });
            const cells: [number, number][] = [];
            for (let ty = Math.floor(p0.y / TILE); ty <= Math.floor((p1.y - 0.01) / TILE); ty++)
              for (let tx = Math.floor(p0.x / TILE); tx <= Math.floor((p1.x - 0.01) / TILE); tx++) cells.push([tx, ty]);
            // Whose it is: the set piece with a footprint cell nearest the lie's middle.
            const mx = (p0.x + p1.x) / 2 / TILE;
            const my = (p0.y + p1.y) / 2 / TILE;
            let near = '?';
            let bestD = Infinity;
            for (const rp of run.resolved) {
              const pp = rp.pp;
              for (const [fx, fy] of pp.def.footprint) {
                const dd = Math.hypot(pp.tx + fx + 0.5 - mx, pp.ty + fy + 0.5 - my);
                if (dd < bestD) {
                  bestD = dd;
                  near = `${pp.def.name}: ${rp.mods.map((mod: any) => mod.type + (mod.look ? `/${mod.look}` : '')).join(' ')}`;
                }
              }
            }
            lies.push({
              near,
              cells,
              // What the sim has there: '#' solid, '=' one-way, '.' air.
              tiles: cells.map(([tx, ty]) => '.#='[tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h ? 0 : lv.tiles[ty * lv.w + tx]] ?? '?').join(''),
              box: { x: +p0.x.toFixed(1), y: +p0.y.toFixed(1), w: +(p1.x - p0.x).toFixed(1), h: +(p1.y - p0.y).toFixed(1) },
              area: +area.toFixed(1),
            });
          }
          let url: string | undefined;
          if (lies.length && png) {
            // The evidence: the play layer over grey, allowed shapes tinted blue, past them orange, the lie magenta.
            const c = document.createElement('canvas');
            c.width = W;
            c.height = H;
            const g = c.getContext('2d')!;
            g.fillStyle = '#777';
            g.fillRect(0, 0, W, H);
            g.drawImage(fg, 0, 0);
            const img = g.getImageData(0, 0, W, H);
            const px = img.data;
            for (let i = 0; i < n; i++) {
              const o = i * 4;
              if (dist[i] > coreAt) {
                px[o] = 255;
                px[o + 1] = 0;
                px[o + 2] = 255;
              } else if (dist[i] > 0) {
                px[o] = 255;
                px[o + 1] = 150;
                px[o + 2] = 0;
              } else if (ad[o + 3] > 128 && fd[o + 3] < 30) {
                px[o + 2] = Math.min(255, px[o + 2] + 40);
              }
            }
            g.putImageData(img, 0, 0);
            g.strokeStyle = '#ff00ff';
            g.lineWidth = 3;
            for (const l of lies) {
              const q = T.transformPoint({ x: l.box.x, y: l.box.y });
              g.strokeRect(q.x - 6, q.y - 6, l.box.w * k + 12, l.box.h * k + 12);
            }
            url = c.toDataURL('image/png');
          }
          results.push({ lies, png: url });
        }
      }
      r.pin = null;
      run.resolved = resolved;
      run.runners = runners;
      run.projectiles = shots;
      return results;
    },
    [f, EDGE_DRIFT, THIN, MIN_AREA, wantPng, strict ? [] : PENDING, Number(opt('camo', String(CAMO))), strict ? [] : PENDING_SHELLS] as const,
  );
}

export const shots: Scenarios = {
  async fairplay() {
    const only = opt('concept')?.split(',');
    const count = Number(opt('count', '3'));
    const decor = flag('decor');
    const strict = flag('strict');
    const themes = theme ? [theme as ThemeId] : THEME_IDS;
    await open(`seed=${seed}&ui=0&lettering=0`);
    // tsx names functions through a helper that the page doesn't have.
    await page.evaluate('globalThis.__name = (f) => f');
    let bad = 0;
    let views = 0;
    for (const th of themes) {
      const all = [...CONCEPTS[th].map((c) => c.id), 'plain'];
      // In the order asked for: a level leaves render state for the next, and that's worth reading too.
      const ids = only ? only.filter((id) => all.includes(id)) : all;
      for (const id of ids) {
        for (let i = 0; i < count; i++) {
          const s = i ? `${seed}${i}` : `${seed}`;
          await race(s, th, id, decor);
          const got = await page.evaluate(() => (window as any).slagDebug.match.level.landmark?.concept ?? 'plain');
          const pieces: string[] = await page.evaluate(() => (window as any).slagDebug.match.level.setPieces.map((p: any) => p.def.name));
          for (const f of FRAMES) {
            const res = await readAt(f, true, strict);
            pet();
            res.forEach((v, vi) => {
              views++;
              if (!v.lies.length) return;
              bad++;
              const name = `fairplay-${th}-${got}-${s}-${f}${res.length > 1 ? `-${vi}` : ''}`;
              if (v.png) writeFileSync(`${out}/${name}.png`, Buffer.from(v.png.split(',')[1], 'base64'));
              console.log(`LIE ${th} ${got} seed ${s} frame ${f}${res.length > 1 ? ` view ${vi}` : ''} (${pieces.join(', ')}) → ${out}/${name}.png`);
              for (const l of v.lies)
                console.log(
                  `    [${l.near}] ${l.area} px² at x ${l.box.x} y ${l.box.y} (${l.box.w}×${l.box.h}) cells ${l.cells.map((c) => c.join(',')).join(' ')}${l.tiles ? ` [${l.tiles}]` : ''}`,
                );
            });
          }
        }
        console.log(`checked ${th} ${id} ×${count}`);
      }
    }
    console.log(`fairplay: ${views} views, ${bad} with a lie`);
    if (bad) process.exitCode = 1;
  },
};
