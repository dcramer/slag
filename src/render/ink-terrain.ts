import { css, type HSL, mixHsl, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { CapKind, PlatformKind, TerrainKind, TerrainLook, Theme } from '../gen/theme';
import { TILE } from '../sim/constants';
import type { Rect } from '../core/geom';
import { type Level, T_ONEWAY, tileAt, type TileRect } from '../sim/level';
import { blob, type EdgeP, line, looseLoop, type P, shadeOf, sn, stroke, type StrokeOpts, traceCorners, vn } from './ink';
import { INK_MATERIALS, type Tones } from './ink-material';
import { clearAround, flutter, pxRect, type RC, scratch } from './kit';

/**
 * Terrain as an ink drawing instead of a textured mask. Each layer is marks a hand would make: flat tones
 * cut as lumpy shapes, material marks, hatching that hangs off shadow edges, tapered contour strokes, and
 * a cap with its own drips and blades.
 *
 * All of it comes from the tile grid plus theme colors, so it fits any level size, recolors with the
 * theme, and survives bombs: every mark is keyed on world position, so only what a blast changed moves.
 */

export interface InkBake {
  mask: Path2D;
  loops: EdgeP[][];
}

/** World rect to paint. Layers skip what can't reach it; the clip does the rest. */
export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** True if a point, or anything drawn within `pad` of it, can land in the area. */
const near = (a: Area, x: number, y: number, pad: number) => x >= a.x0 - pad && x <= a.x1 + pad && y >= a.y0 - pad && y <= a.y1 + pad;

/** Tiles to visit for an area: marks drawn from a tile reach about two tiles out of it. */
function tilesIn(a: Area, level: Level) {
  return {
    tx0: Math.max(0, Math.floor(a.x0 / TILE) - 2),
    ty0: Math.max(0, Math.floor(a.y0 / TILE) - 2),
    tx1: Math.min(level.w - 1, Math.ceil(a.x1 / TILE) + 2),
    ty1: Math.min(level.h - 1, Math.ceil(a.y1 / TILE) + 2),
  };
}

/**
 * Tile rect a change needs redrawn, or null if nothing changed. `margin` is how far one tile's change
 * can reach: tones read four tiles of depth, and a contour stroke or mark adds about two more.
 */
export function dirtyTiles(was: Uint8Array, now: Uint8Array, w: number, h: number, margin = 6): TileRect | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (was[y * w + x] === now[y * w + x]) continue;
      // A plank is inked end to end, so losing a tile changes all of it.
      let a = x;
      let b = x;
      if (was[y * w + x] === T_ONEWAY) {
        while (a > 0 && was[y * w + a - 1] === T_ONEWAY) a--;
        while (b < w - 1 && was[y * w + b + 1] === T_ONEWAY) b++;
      }
      if (a < x0) x0 = a;
      if (b > x1) x1 = b;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  return { x: left, y: top, w: Math.min(w, x1 + margin + 1) - left, h: Math.min(h, y1 + margin + 1) - top };
}

/** Past the window the grid carries on as it was, so a region running out of it still closes. */
function windowSolid(level: Level, solid: (x: number, y: number) => boolean, r: TileRect) {
  return (x: number, y: number) => {
    const cx = Math.max(0, Math.min(level.w - 1, x + r.x));
    const cy = Math.max(0, Math.min(level.h - 1, y + r.y));
    return solid(Math.max(r.x, Math.min(r.x + r.w - 1, cx)), Math.max(r.y, Math.min(r.y + r.h - 1, cy)));
  };
}

/** Tiles of contour traced past a partial redraw: enough that what the window cuts off never reaches the area. */
const TRACE_PAD = 5;

/**
 * Shapes of the terrain in world px, for the whole level or just around `tiles`. Points are keyed to the
 * world, so tracing a window gives the same outline inside it as tracing the level does.
 */
export function inkContours(level: Level, seed: number, solid: (x: number, y: number) => boolean, tiles?: TileRect): InkBake {
  const x0 = tiles ? Math.max(0, tiles.x - TRACE_PAD) : 0;
  const y0 = tiles ? Math.max(0, tiles.y - TRACE_PAD) : 0;
  const x1 = tiles ? Math.min(level.w, tiles.x + tiles.w + TRACE_PAD) : level.w;
  const y1 = tiles ? Math.min(level.h, tiles.y + tiles.h + TRACE_PAD) : level.h;
  const r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const corners = traceCorners(windowSolid(level, solid, r), r.w, r.h);
  const shifted = corners.map((c) => c.map((p) => ({ x: p.x + x0, y: p.y + y0 })));
  const loops = shifted.map((c) => looseLoop(c, { tile: TILE, w: level.w, h: level.h, seed, edge: tiles ? r : undefined }));
  const mask = new Path2D();
  for (const l of loops) {
    l.forEach((p, i) => (i ? mask.lineTo(p.x, p.y) : mask.moveTo(p.x, p.y)));
    mask.closePath();
  }
  return { mask, loops };
}

/**
 * How a landmark skin looks when nothing else says: its tones, what runs along its tops, and its
 * jump-through boards. Kinds without an entry take the theme's own tones when the theme lays that
 * material (as its ground or its deep layer), and a plain stone otherwise.
 */
interface SkinLook {
  base: HSL;
  dark: HSL;
  light: HSL;
  cap: CapKind;
  capColor: HSL;
  platform?: PlatformKind;
}

const look = (base: HSL, cap: CapKind, capColor: HSL, platform?: PlatformKind, dark?: HSL, light?: HSL): SkinLook => ({
  base,
  dark: dark ?? { h: base.h + 6, s: base.s * 0.95, l: base.l * 0.55 },
  light: light ?? { h: base.h - 6, s: Math.min(100, base.s * 1.05), l: Math.min(85, base.l * 1.45) },
  cap,
  capColor,
  ...(platform ? { platform } : {}),
});

const SKIN_LOOKS: Partial<Record<TerrainKind, SkinLook>> = {
  planks: look({ h: 27, s: 38, l: 38 }, 'beam', { h: 24, s: 36, l: 30 }, 'wood'),
  // Barn red boards under a white-painted beam.
  barnboard: look({ h: 4, s: 52, l: 38 }, 'beam', { h: 40, s: 18, l: 84 }, 'wood', { h: 2, s: 50, l: 28 }, { h: 6, s: 50, l: 48 }),
  // Plaster between dark timbers: the dark tone is the timber, not a shadow of the plaster.
  timber: look({ h: 40, s: 24, l: 76 }, 'beam', { h: 20, s: 32, l: 24 }, 'wood', { h: 20, s: 34, l: 20 }, { h: 44, s: 30, l: 88 }),
  brick: look({ h: 9, s: 46, l: 40 }, 'ledge', { h: 30, s: 8, l: 62 }, 'stone'),
  metal: look({ h: 212, s: 10, l: 46 }, 'trim', { h: 212, s: 12, l: 40 }, 'grate'),
  rustplate: look({ h: 18, s: 38, l: 36 }, 'trim', { h: 16, s: 34, l: 30 }, 'grate'),
  hull: look({ h: 214, s: 10, l: 60 }, 'trim', { h: 214, s: 12, l: 50 }, 'grate'),
  stone: look({ h: 34, s: 9, l: 52 }, 'ledge', { h: 34, s: 8, l: 60 }, 'stone'),
  carved: look({ h: 38, s: 17, l: 55 }, 'ledge', { h: 38, s: 15, l: 62 }, 'stone'),
  concrete: look({ h: 30, s: 5, l: 58 }, 'ledge', { h: 30, s: 5, l: 66 }, 'grate'),
  ice: look({ h: 196, s: 46, l: 72 }, 'none', { h: 196, s: 40, l: 86 }),
  iceblock: look({ h: 198, s: 42, l: 74 }, 'none', { h: 198, s: 40, l: 88 }, undefined, { h: 205, s: 40, l: 46 }, { h: 192, s: 50, l: 90 }),
  crystal: look({ h: 284, s: 44, l: 52 }, 'none', { h: 284, s: 40, l: 70 }, undefined, { h: 270, s: 40, l: 22 }, { h: 296, s: 60, l: 80 }),
  bone: look({ h: 42, s: 30, l: 78 }, 'none', { h: 42, s: 26, l: 84 }, 'stone', { h: 34, s: 22, l: 40 }),
  // A pier's beach: the boardwalk over it keeps the theme's wood.
  sand: look({ h: 40, s: 44, l: 66 }, 'none', { h: 40, s: 40, l: 74 }),
  // Shipping containers: the material paints each box its own colour; these are the frames and the rails.
  container: look({ h: 14, s: 46, l: 38 }, 'trim', { h: 210, s: 8, l: 44 }, 'grate'),
  // Structural steel in red oxide primer: riveted plate for its solid parts, I-beams for its decks.
  girder: look({ h: 10, s: 42, l: 36 }, 'trim', { h: 12, s: 46, l: 40 }, 'girder'),
  // Space's planetoids and asteroids, where the level's own ground is a station's hull.
  regolith: look({ h: 30, s: 10, l: 46 }, 'gravel', { h: 30, s: 8, l: 56 }),
};

/** A landmark's skin: the box its tiles are drawn in, and the look they're drawn with. */
export interface Skin {
  rect: TileRect;
  T: TerrainLook;
}

const SKINS = new WeakMap<Level, { key: string; skin: Skin | null }>();

/** The level's landmark skin, or null: nothing to draw differently. Cached per level, theme and landmark. */
export function skinOf(level: Level): Skin | null {
  const lm = level.landmark;
  const th = level.theme;
  const key = lm?.skin ? `${lm.skin}:${lm.rect.x},${lm.rect.y},${lm.rect.w},${lm.rect.h}:${th.seed}:${th.id}` : '';
  const hit = SKINS.get(level);
  if (hit && hit.key === key) return hit.skin;
  const skin = lm?.skin ? { rect: lm.rect, T: skinTerrain(lm.skin, th) } : null;
  SKINS.set(level, { key, skin });
  return skin;
}

function skinTerrain(kind: TerrainKind, th: Theme): TerrainLook {
  const T = th.terrain;
  const own = T.kind === kind ? T : T.sub?.kind === kind ? T.sub : null;
  const s = SKIN_LOOKS[kind] ?? look({ h: 34, s: 9, l: 52 }, 'ledge', { h: 34, s: 8, l: 60 });
  // At night the built thing sits in the same dusk as the ground around it.
  const dim = (c: HSL) => (th.night ? { ...c, l: c.l * 0.78 } : c);
  return {
    ...T,
    kind,
    base: own?.base ?? dim(s.base),
    dark: own?.dark ?? dim(s.dark),
    light: own?.light ?? dim(s.light),
    cap: s.cap,
    capColor: dim(s.capColor),
    veins: false,
    sub: null,
    platform: s.platform ? { kind: s.platform, color: dim(s.capColor) } : T.platform,
  };
}

/** Is tile (x, y) inside the skin's box? */
export const inSkin = (s: Skin | null, x: number, y: number) => !!s && x >= s.rect.x && x < s.rect.x + s.rect.w && y >= s.rect.y && y < s.rect.y + s.rect.h;

/** The tile a contour point bounds, stepping in against its outward normal. */
const tileUnder = (p: EdgeP) => [Math.floor((p.x - p.nx * 2) / TILE), Math.floor((p.y - p.ny * 2) / TILE)] as const;

/** Is this contour point on the skin's tiles? */
export const edgeInSkin = (s: Skin | null, p: EdgeP) => !!s && inSkin(s, ...tileUnder(p));

/** A floor inside the landmark's box: ground whose top is the landmark's own room, where nothing of the theme's grows. */
const floorInSkin = (s: Skin, p: EdgeP) => {
  if (p.ny > -0.3) return false;
  const [x, y] = tileUnder(p);
  return inSkin(s, x, y - 1);
};

/**
 * The contour with every point hidden on one side of the skin's box: `keep` 'skin' hides the theme's
 * ground, 'ground' hides the skin (and the floors inside its box).
 */
export function skinLoops(s: Skin | null, loops: readonly EdgeP[][], keep: 'skin' | 'ground'): readonly EdgeP[][] {
  if (!s) return keep === 'ground' ? loops : [];
  const shown = keep === 'skin' ? (p: EdgeP) => edgeInSkin(s, p) : (p: EdgeP) => !edgeInSkin(s, p) && !floorInSkin(s, p);
  return loops.map((l) => l.map((p) => (p.hidden || shown(p) ? p : { ...p, hidden: true })));
}

/** Width in world px a skin's clip runs past its tiles into open air, so the loose contour never shows the ground's material there. */
const SKIN_BLEED = 4;

/**
 * The clip a skin is painted through over tiles x0..x1, y0..y1 (world px): every solid tile, run a little past
 * a side that faces air, stopping dead on the grid against any solid (the theme's ground, or the skin's own
 * tile, which is in the clip already). Tiles in a row that bleed alike up and down go in as one rect, so a
 * landmark solid down to the sea floor is a few rects a row: a clip of hundreds of overlapping per-tile rects
 * stalls Chrome's GPU rasterizer for good (a harbor lighthouse's rock froze the page's frames).
 */
export function skinClip(solid: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number): Rect[] {
  const bleed = (x: number, y: number) => (solid(x, y) ? 0 : SKIN_BLEED);
  const out: Rect[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue;
      const t = bleed(x, y - 1);
      const b = bleed(x, y + 1);
      let e = x;
      while (e + 1 <= x1 && solid(e + 1, y) && bleed(e + 1, y - 1) === t && bleed(e + 1, y + 1) === b) e++;
      const l = bleed(x - 1, y);
      const r = bleed(e + 1, y);
      out.push({ x: x * TILE - l, y: y * TILE - t, w: (e - x + 1) * TILE + l + r, h: TILE + t + b });
      x = e;
    }
  }
  return out;
}

/**
 * The skin over the ground's material on its tiles, cut on the tile grid where it meets the theme's own
 * ground (a seam a builder made) and run a little past its tiles into the air (the contour cuts that).
 */
function paintSkin(
  g: CanvasRenderingContext2D,
  level: Level,
  skin: Skin,
  paint: (t: Tones, kind: TerrainKind) => void,
  solid: (x: number, y: number) => boolean,
  area: Area,
) {
  const { rect } = skin;
  const span = tilesIn(area, level);
  const x0 = Math.max(rect.x, span.tx0);
  const x1 = Math.min(rect.x + rect.w - 1, span.tx1);
  const y0 = Math.max(rect.y, span.ty0);
  const y1 = Math.min(rect.y + rect.h - 1, span.ty1);
  if (x0 > x1 || y0 > y1) return;
  g.save();
  g.beginPath();
  for (const r of skinClip(solid, x0, x1, y0, y1)) g.rect(r.x, r.y, r.w, r.h);
  g.clip();
  paint(skin.T, skin.T.kind);
  g.restore();
  inkSeams(g, level, skin, solid, area);
}

/**
 * Where the built thing meets the ground: a footing course along its foot with rubble heaped against it,
 * a post where it's set into a bank, a lintel where rock runs over it. One roll per tile, keyed to the world.
 */
function inkSeams(g: CanvasRenderingContext2D, level: Level, skin: Skin, solid: (x: number, y: number) => boolean, area: Area) {
  const S = skin.T;
  const G = level.theme.terrain;
  const span = tilesIn(area, level);
  const ink = inkOf2(G);
  const footing = css(shift(S.dark, 6, -4));
  const footLit = css(shift(S.light, -4, -6));
  const rubble = [css(G.base), css(shift(G.base, -6, 2)), css(shift(G.light, -4, -4))];
  const ground = (x: number, y: number) => solid(x, y) && !inSkin(skin, x, y);
  const { rect } = skin;
  for (let y = Math.max(rect.y, span.ty0); y <= Math.min(rect.y + rect.h - 1, span.ty1); y++) {
    for (let x = Math.max(rect.x, span.tx0); x <= Math.min(rect.x + rect.w - 1, span.tx1); x++) {
      if (!solid(x, y)) continue;
      const wx = x * TILE;
      const wy = y * TILE;
      const sd = x * 4099 + y * 131;
      if (ground(x, y + 1)) {
        // The footing: a course of the skin's own dark, lit along its top, inked hard where it bears.
        const fy = wy + TILE;
        g.fillStyle = footing;
        g.fillRect(wx - 0.5, fy - 3.6, TILE + 1, 3.6);
        g.fillStyle = footLit;
        line(g, wx, fy - 3.4, wx + TILE, fy - 3.4, { w: 0.8, seed: sd, taper: [0.15, 0.2], press: 0 });
        g.fillStyle = ink;
        line(g, wx - 0.6, fy, wx + TILE + 0.6, fy + (hash2(x, y, 3) - 0.5) * 0.6, { w: 1.7, seed: sd + 1, taper: [0.06, 0.08], press: 0.55 });
        if (hash2(x, y, 4) > 0.45)
          line(g, wx + 4 + hash2(x, y, 5) * 8, fy - 3.6, wx + 4.4 + hash2(x, y, 5) * 8, fy, { w: 0.8, seed: sd + 2, taper: [0.1, 0.2] });
        // Ground heaped against the foot, so the two meet rather than butt.
        for (let i = 0; i < 2; i++) {
          if (hash2(x, y + i, 6) < 0.4) continue;
          const rx = wx + 2 + hash2(x, y + i, 7) * 12;
          const rr = 1.4 + hash2(x, y + i, 8) * 1.6;
          g.fillStyle = ink;
          blob(g, rx, fy + 0.3, rr + 0.5, sd + i, 0.6, 0.25);
          g.fill();
          g.fillStyle = rubble[Math.floor(hash2(x, y + i, 9) * rubble.length)];
          blob(g, rx, fy, rr, sd + i, 0.58, 0.25);
          g.fill();
        }
      }
      for (const dir of [-1, 1]) {
        if (!ground(x + dir, y)) continue;
        // Set into a bank: a post down the joint, inked on the ground's side.
        const sx = dir < 0 ? wx : wx + TILE;
        g.fillStyle = footing;
        g.fillRect(dir < 0 ? sx : sx - 3, wy - 0.5, 3, TILE + 1);
        g.fillStyle = ink;
        line(g, sx, wy - 0.4, sx + (hash2(x, y, 10) - 0.5) * 0.5, wy + TILE + 0.4, {
          w: dir < 0 ? 1.2 : 1.6,
          seed: sd + 3 + dir,
          taper: [0.08, 0.08],
          press: 0.5,
        });
      }
      if (ground(x, y - 1)) {
        // Rock running over it: a lintel under the rock.
        g.fillStyle = footing;
        g.fillRect(wx - 0.5, wy, TILE + 1, 3);
        g.fillStyle = ink;
        line(g, wx - 0.5, wy + 3, wx + TILE + 0.5, wy + 3, { w: 1.1, seed: sd + 5, taper: [0.1, 0.15], press: 0.4 });
        line(g, wx - 0.5, wy, wx + TILE + 0.5, wy, { w: 1.3, seed: sd + 6, taper: [0.08, 0.1], press: 0.5 });
      }
    }
  }
}

/** The terrain's material, a second one for deep tiles when the look has it, and a landmark's skin over its own tiles. */
export function inkMaterial(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, area: Area) {
  const T = th.terrain;
  const dist = airDistance(level, solid);
  const depth = (x: number, y: number) => (x < 0 || y < 0 || x >= level.w || y >= level.h ? 99 : dist[y * level.w + x]);
  const span = tilesIn(area, level);
  // Marks inside the ground sit lighter than its edge: they say what it's made of, the contour says where it stops.
  const ink = css(mixHsl(T.outline, T.dark, 0.62));
  const paint = (c: CanvasRenderingContext2D, t: Tones, kind: TerrainKind, inside: (x: number, y: number) => boolean) =>
    INK_MATERIALS[kind]!({ g: c, seed: seed + (t === T ? 0 : 1000), T: t, ink, span, area, inside, depth });
  paint(g, T, T.kind, solid);
  if (T.sub) inkSub(g, T.sub, span, area, solid, depth, paint, seed);
  const skin = skinOf(level);
  if (skin) paintSkin(g, level, skin, (t, kind) => paint(g, t, kind, (x, y) => solid(x, y) && inSkin(skin, x, y)), solid, area);
}

/** The deep tiles' second material, cut to blobs round each one so the change reads as a hand's, not the grid's. */
function inkSub(
  g: CanvasRenderingContext2D,
  sub: NonNullable<TerrainLook['sub']>,
  span: ReturnType<typeof tilesIn>,
  area: Area,
  solid: (x: number, y: number) => boolean,
  depth: (x: number, y: number) => number,
  paint: (c: CanvasRenderingContext2D, t: Tones, kind: TerrainKind, inside: (x: number, y: number) => boolean) => void,
  seed: number,
) {
  // By distance from air, not depth below the surface: a depth reaches all the way down a column, so one
  // crater would change tiles a redraw can't see. Distance stays local.
  const deep = (x: number, y: number) => solid(x, y) && depth(x, y) >= sub.depth;
  let any = false;
  for (let y = span.ty0; y <= span.ty1 && !any; y++) for (let x = span.tx0; x <= span.tx1 && !any; x++) any = deep(x, y);
  // Nothing deep here: and an empty path would cut nothing away, leaving the whole layer to paste over the first material.
  if (!any) return;
  const r = pxRect(g, area);
  if (!r.w || !r.h) return;
  const layer = scratch('ink-sub', g.canvas.width, g.canvas.height);
  const lg = layer.getContext('2d')!;
  lg.save();
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(r.x, r.y, r.w, r.h);
  lg.setTransform(g.getTransform());
  paint(lg, sub, sub.kind, deep);
  lg.globalCompositeOperation = 'destination-in';
  lg.fillStyle = '#000';
  lg.beginPath();
  const kept = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!deep(x, y)) continue;
      const cx = (x + 0.5) * TILE;
      const cy = (y + 0.5) * TILE;
      blob(lg, cx, cy, 13, x * 31 + y * 17 + seed, 1, 0.3, true);
      kept.x0 = Math.min(kept.x0, cx - 18);
      kept.y0 = Math.min(kept.y0, cy - 18);
      kept.x1 = Math.max(kept.x1, cx + 18);
      kept.y1 = Math.max(kept.y1, cy + 18);
    }
  }
  lg.fill();
  // The blobs overlap, so they can't cut by complement: clear what lies past all of them by hand.
  clearAround(lg, r, pxRect(lg, kept));
  lg.restore();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(layer, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  g.restore();
}

function inkOf(th: Theme): string {
  return inkOf2(th.terrain);
}

/** The ground's line: its outline pulled toward its own dark, so the edge reads as a darker ground and not one black. */
function inkOf2(T: TerrainLook): string {
  return css(mixHsl(T.outline, T.dark, 0.38));
}

/** Jagged: straight runs with hard turns, the way rock splits, and a fork partway along. */
function vein(g: CanvasRenderingContext2D, x: number, y: number, a0: number, n: number, seed: number, w: number) {
  const pts: P[] = [{ x, y }];
  let a = a0;
  for (let i = 0; i < n; i++) {
    a += (hash2(seed, i, 1) - 0.5) * 2.1;
    const last = pts[pts.length - 1];
    pts.push({ x: last.x + Math.cos(a) * 3.6, y: last.y + Math.sin(a) * 3.6 });
  }
  stroke(g, pts, { w, seed, taper: [0.12, 0.6], press: 0.5 });
  if (n > 8) {
    const m = pts[n >> 1];
    vein(g, m.x, m.y, a0 + (hash2(seed, 9, 2) > 0.5 ? 0.9 : -0.9), n >> 1, seed + 7, w * 0.7);
  }
}

/** Glowing cracks through the material, on the emissive layer. Same lattice as every other mark. */
export function inkVeins(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, area: Area) {
  const T = th.terrain;
  const span = tilesIn(area, level);
  const rate = T.kind === 'basalt' ? 0.2 : 0.05;
  // A built thing doesn't glow from inside: the veins are the theme's ground.
  const skin = skinOf(level);
  g.fillStyle = css(T.vein, 6);
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!solid(x, y) || inSkin(skin, x, y)) continue;
      const wx = x * TILE;
      const wy = y * TILE;
      if (hash2(wx, wy, seed + 90) > rate) continue;
      vein(g, wx + 8, wy + 8, hash2(wx, wy, seed + 91) * 6.28, 7 + Math.floor(hash2(wx, wy, seed + 92) * 8), wx * 3 + wy, 1.9);
    }
  }
  if (T.cap !== 'ash') return;
  // Embers in the ash.
  g.fillStyle = css(T.vein, 15, 0.8);
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!solid(x, y) || solid(x, y - 1) || y === 0 || inSkin(skin, x, y)) continue;
      for (let i = 0; i < 2; i++) {
        blob(g, x * TILE + hash2(x, y + i, seed + 94) * 15, y * TILE + hash2(y, x + i, seed + 95) * 2, 0.5, i, 1, 0.1);
        g.fill();
      }
    }
  }
}

/** Parallel strokes hanging off every edge that faces away from the light; they fade into the fill. A skin hatches in its own dark. */
export function inkHatch(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], th: Theme, seed: number, area: Area, skin: Skin | null = null) {
  const dx = -0.6;
  const dy = -0.8;
  const col = css(shift(th.terrain.dark, -8, 4));
  // A skin hatches in a shade of itself: a pale one (plaster, bone, ice) would drown under the ground's dark.
  const skinCol = skin ? css(mixHsl(skin.T.base, skin.T.dark, 0.55)) : col;
  const SP = 3.6;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      const sh = shadeOf(p.nx, p.ny);
      if (sh < 0.74 || p.hidden || !near(area, p.x, p.y, 32)) continue;
      // The lattice is fixed in the world, so a hatch line sits at the same place after any re-bake.
      const a = (p.x * 0.8 - p.y * 0.6) / SP;
      const b = (q.x * 0.8 - q.y * 0.6) / SP;
      if (Math.floor(a) === Math.floor(b)) continue;
      const k = Math.floor(Math.max(a, b));
      const skip = hash2(k, 11, seed);
      if (skip < 0.3) continue;
      const len = (5 + 15 * (sh - 0.74) * 3.2) * (0.55 + 0.75 * hash2(k, 12, seed)) * (0.7 + 0.6 * vn(p.x * 0.06, p.y * 0.06, seed + 40));
      g.fillStyle = edgeInSkin(skin, p) ? skinCol : col;
      const sx = p.x - p.nx * 0.5;
      const sy = p.y - p.ny * 0.5;
      line(g, sx, sy, sx + dx * len, sy + dy * len, { w: 0.95, seed: k, taper: [0.06, 0.85], wobble: 0.25 });
    }
  }
}

/** The contour itself: one pen, many strokes, lifting between them and leaning on the shadow side. */
export function inkEdges(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], th: Theme, seed: number, area: Area, weight = 1) {
  g.fillStyle = inkOf(th);
  for (const loop of loops) {
    const n = loop.length;
    if (n < 4) continue;
    // Start the walk at a break, or the first stroke would wrap the seam.
    const cell = (p: EdgeP) => {
      const jx = sn(p.x * 0.02, p.y * 0.02, seed + 50) * 0.3;
      return Math.floor(p.x / 42 + jx) * 4096 + Math.floor(p.y / 42 - jx);
    };
    let start = -1;
    for (let i = 0; i < n; i++) {
      if (cell(loop[i]) !== cell(loop[(i + n - 1) % n]) || loop[i].hidden !== loop[(i + n - 1) % n].hidden) {
        start = i;
        break;
      }
    }
    // Every run starts on the last point of the cell before it, the first one too: the loop starts wherever the
    // tracer found its first corner, which a crater across the level can move, so a run that lacked it there
    // would ink differently from the same run anywhere else in the loop.
    let run: EdgeP[] = start < 0 ? [] : [loop[(start + n - 1) % n]];
    start = Math.max(0, start);
    const flush = () => {
      if (run.length >= 3 && !run[0].hidden && run.some((p) => near(area, p.x, p.y, 8))) {
        const m = run[run.length >> 1];
        const sh = shadeOf(m.nx, m.ny);
        const ww = (0.7 + 1.35 * sh * sh) * weight;
        const sd = ((m.x * 3 + m.y * 5) | 0) + seed;
        // Shift off the fill by a hair: registration is never perfect by hand.
        const dx = sn(m.x * 0.03, m.y * 0.03, seed + 51) * 0.55;
        const dy = sn(m.y * 0.03, m.x * 0.03, seed + 52) * 0.45;
        const pts: P[] = run.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        // Lit edges lift off the page often; shadow edges mostly hold.
        if ((sh > 0.42 && vn(m.x * 0.04, m.y * 0.04, seed + 54) > 0.18) || vn(m.x * 0.05, m.y * 0.05, seed + 53) > 0.52)
          stroke(g, pts, { w: ww, seed: sd, taper: [0.1, 0.3], press: 0.5, wobble: 0.3 });
      }
      run = [];
    };
    for (let k = 0; k <= n; k++) {
      const p = loop[(start + k) % n];
      const q = loop[(start + k + n - 1) % n];
      if (k && (cell(p) !== cell(q) || p.hidden !== q.hidden)) {
        // Overrun the corner a little so strokes overlap instead of butting.
        run.push(p);
        flush();
        run.push(q);
      }
      run.push(p);
    }
    flush();
  }
}

/** Top-facing stretches of contour, so grass can follow what the outline really does. */
function topRuns(loops: readonly EdgeP[][]): EdgeP[][] {
  const runs: EdgeP[][] = [];
  for (const loop of loops) {
    const n = loop.length;
    let begin = -1;
    for (let i = 0; i < n; i++) {
      if (loop[i].ny >= -0.3 && loop[(i + 1) % n].ny < -0.3) {
        begin = (i + 1) % n;
        break;
      }
    }
    if (begin < 0) continue;
    let run: EdgeP[] = [];
    for (let k = 0; k <= n; k++) {
      const p = loop[(begin + k) % n];
      if (p.ny < -0.3 && !p.hidden) run.push(p);
      else if (run.length) {
        if (run.length >= 2) runs.push(run);
        run = [];
      }
    }
  }
  return runs;
}

/** What sits on top of the ground, drawn in its own hand along each run. */
export interface Cap {
  /** Live tufts sway on it. */
  tufts?: boolean;
  draw(c: CapCtx): void;
}

interface CapCtx {
  g: CanvasRenderingContext2D;
  runs: readonly EdgeP[][];
  T: TerrainLook;
  seed: number;
  area: Area;
}

/** A soft cap: a band hanging off the top edge with a scalloped underside. */
interface BandStyle {
  /** World px the band hangs down the wall, and how deep its drips go on top of that. */
  band: number;
  drip: number;
  /** Height of the fringe along the top, 0 for none. */
  fringe: number;
  /** The band's tones, darkest first, and its ink. */
  tones(c: HSL): [string, string, string, string];
  ink(c: HSL): string;
}

const leafy = (c: HSL): [string, string, string, string] => [css(c, -20, 1, 6), css(c, -5, 1, 4), css(c, 9), css(c, 24, 1, -4)];
const leafInk = (c: HSL) => css({ h: c.h + 25, s: Math.min(80, c.s + 15), l: 9 });
const dullInk = (c: HSL) => css({ h: c.h, s: Math.min(50, c.s), l: 9 });

const bandCap = (style: BandStyle, tufts = false): Cap => ({ tufts, draw: (c) => inkBand(c, style) });

/** A built cap: a straight member along the top, with seams and fixings. */
function hardCap(height: number, seam: number, fix: 'rivet' | 'nail' | 'none', over: number, stripe = false): Cap {
  return {
    draw: ({ g, runs, T, seed, area }) => {
      const body = css(T.capColor);
      const under = css(T.capColor, -16, 1, 4);
      const lit = css(T.capColor, 16, 1, -4);
      const ink = inkOf2(T);
      for (const run of runs) {
        if (!run.some((p) => near(area, p.x, p.y, 24))) continue;
        // Follow the run's own points: they sit on the world grid, so a crater at one end moves nothing at the other.
        const x0 = run[0].x - over;
        const x1 = run[run.length - 1].x + over;
        // Height along the run from its nearest point, never from its middle: a crater at one end moves the middle.
        const yAt = (x: number) => {
          let best = run[0];
          for (const p of run) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
          return best.y - 1.2;
        };
        const along = [{ x: x0, y: run[0].y }, ...run, { x: x1, y: run[run.length - 1].y }];
        const topE = along.map((p) => ({ x: p.x, y: p.y - 1.2 + sn(p.x * 0.04, p.y * 0.04, seed) * 0.25 }));
        const botE = along.map((p) => ({ x: p.x, y: p.y - 1.2 + height + sn(p.x * 0.06, p.y * 0.06, seed + 1) * 0.4 }));
        const band = (a: readonly P[], b: readonly P[], fill: string) => {
          g.fillStyle = fill;
          g.beginPath();
          a.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
          for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i].x, b[i].y);
          g.closePath();
          g.fill();
        };
        band(topE, botE, body);
        band(
          topE.map((q) => ({ x: q.x, y: q.y + height * 0.62 })),
          botE,
          under,
        );
        band(
          topE,
          topE.map((q) => ({ x: q.x, y: q.y + 1 })),
          lit,
        );
        if (stripe) {
          g.fillStyle = css(T.vein.s > 40 ? T.vein : { h: 48, s: 90, l: 55 });
          band(
            botE.map((q) => ({ x: q.x, y: q.y - 1.1 })),
            botE.map((q) => ({ x: q.x, y: q.y - 0.2 })),
            g.fillStyle as string,
          );
        }
        g.fillStyle = ink;
        for (let k = Math.ceil(x0 / seam); k * seam < x1 - 4; k++) {
          const sx = k * seam;
          const y = yAt(sx);
          if (!near(area, sx, y, 12)) continue;
          if (hash2(k, 5, seed) > 0.3) line(g, sx, y + 0.2, sx + (hash2(k, 6, seed) - 0.5), y + height, { w: 0.95, seed: k, taper: [0.1, 0.25] });
          if (fix === 'none') continue;
          blob(g, sx + 3, y + height * 0.45, fix === 'rivet' ? 0.75 : 0.5, k, 1, 0.14);
          g.fill();
          if (sx + seam - 3 > x1 - 2) continue;
          blob(g, sx + seam - 3, y + height * 0.45, fix === 'rivet' ? 0.75 : 0.5, k + 1, 1, 0.14);
          g.fill();
        }
        cellStrokes(g, botE, area, { w: 1.7, seed: seed + 3, taper: [0.06, 0.06], press: 0.5 });
        cellStrokes(g, topE, area, { w: 0.8, seed: seed + 4, taper: [0.1, 0.12], press: 0.6 });
        line(g, x0, yAt(x0), x0, yAt(x0) + height, { w: 1.1, seed: seed + 5, taper: [0.1, 0.1] });
        line(g, x1, yAt(x1), x1, yAt(x1) + height, { w: 1.5, seed: seed + 6, taper: [0.1, 0.1] });
      }
    },
  };
}

/** One long edge as a pen would ink it, lifting at fixed places: a stroke's pressure can't reach past a lift. */
function cellStrokes(g: CanvasRenderingContext2D, pts: readonly P[], area: Area, o: StrokeOpts) {
  let piece: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const c = Math.floor(pts[i].x / 34);
    piece.push(pts[i]);
    if (i === pts.length - 1 || Math.floor(pts[i + 1].x / 34) !== c) {
      if (piece.length >= 2 && piece.some((q) => near(area, q.x, q.y, 8))) stroke(g, piece, { ...o, seed: o.seed + c });
      piece = [pts[i]];
    }
  }
}

/** Loose stuff lying on the ground: gravel, and crystals pushing up through it. */
function pebbleCap(crystals: boolean): Cap {
  return {
    draw: ({ g, runs, T, seed, area }) => {
      const stone = css(T.light, -4, 1, -6);
      const shade = css(T.base, -2, 1, 2);
      const ink = inkOf2(T);
      for (const run of runs) {
        for (const p of run) {
          if (p.ny > -0.8 || !near(area, p.x, p.y, 10)) continue;
          const r = hash2(p.x | 0, 1, seed);
          if (crystals && r > 0.86) {
            const h = 3 + r * 5;
            const lean = (hash2(p.x | 0, 2, seed) - 0.5) * 2.4;
            g.fillStyle = ink;
            line(g, p.x, p.y + 0.8, p.x + lean, p.y - h - 0.7, { w: 4.4, seed: p.x | 0, taper: [0, 0.9], press: 0 });
            g.fillStyle = css(T.vein, 8);
            line(g, p.x, p.y + 0.5, p.x + lean, p.y - h, { w: 3, seed: p.x | 0, taper: [0, 0.9], press: 0 });
            g.fillStyle = css(T.vein, 30, 1, -6);
            line(g, p.x - 0.5, p.y, p.x + lean - 0.1, p.y - h * 0.8, { w: 0.9, seed: p.x | 0, taper: [0.05, 0.9], press: 0 });
          } else if (r < 0.62) {
            const rad = 0.8 + hash2(p.x | 0, 3, seed) * 1.1;
            g.fillStyle = ink;
            blob(g, p.x, p.y + 0.2, rad + 0.45, p.x | 0, 0.72, 0.2);
            g.fill();
            g.fillStyle = r < 0.3 ? stone : shade;
            blob(g, p.x, p.y, rad, p.x | 0, 0.7, 0.2);
            g.fill();
          }
        }
      }
    },
  };
}

export const INK_CAPS: Record<CapKind, Cap> = {
  grass: bandCap({ band: 4.3, drip: 3.4, fringe: 1, tones: leafy, ink: leafInk }, true),
  // Moss creeps: thinner on top, longer in the drip, and nothing stands up out of it.
  moss: bandCap({ band: 2.8, drip: 6.5, fringe: 0.55, tones: leafy, ink: leafInk }),
  rust: bandCap({ band: 1.5, drip: 8, fringe: 0, tones: leafy, ink: dullInk }),
  ash: bandCap({ band: 1.8, drip: 2.2, fringe: 0.3, tones: leafy, ink: dullInk }),
  ledge: hardCap(5.2, 34, 'none', 1),
  trim: hardCap(4.6, 26, 'rivet', 0, true),
  beam: hardCap(5.4, 48, 'nail', 0),
  gravel: pebbleCap(false),
  crystal: pebbleCap(true),
  none: { draw: () => {} },
};

/** A band along every top edge: scalloped underside, a highlight stroke, blades and ink. */
function inkBand({ g, runs, T, seed, area }: CapCtx, style: BandStyle) {
  const capColor = T.capColor;
  const [dark, mid, top, hi] = style.tones(capColor);
  const ink = style.ink(capColor);
  const under = (x: number, e: number) =>
    e * (style.band + 2.4 * vn(x * 0.13, 1.5, seed) + style.drip * Math.pow(Math.abs(Math.sin(x * 0.29 + 2.5 * sn(x * 0.06, 2, seed))), 2.2));
  for (const run of runs) {
    if (!run.some((p) => near(area, p.x, p.y, 24))) continue;
    const N = run.length;
    const L = (i: number) => Math.min(1, i / 2.5, (N - 1 - i) / 2.5);
    const bottom: P[] = [];
    const edge: P[] = [];
    for (let i = 0; i < N; i++) {
      const p = run[i];
      const e = 0.35 + 0.65 * L(i);
      edge.push({ x: p.x, y: p.y - 1.1 });
      bottom.push({ x: p.x, y: p.y + under(p.x, e) });
    }
    const band = (from: readonly P[], to: readonly P[], fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      from.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      for (let i = to.length - 1; i >= 0; i--) g.lineTo(to[i].x, to[i].y);
      g.closePath();
      g.fill();
    };
    band(edge, bottom, dark);
    const midLine = bottom.map((b, i) => ({ x: b.x, y: edge[i].y + (b.y - edge[i].y) * (0.62 + 0.12 * sn(b.x * 0.2, 3, seed)) }));
    band(edge, midLine, mid);
    const topLine = bottom.map((b, i) => ({ x: b.x, y: edge[i].y + (b.y - edge[i].y) * (0.27 + 0.1 * sn(b.x * 0.27, 4, seed)) }));
    band(edge, topLine, top);

    // Ink under the drips: thick in the troughs, gone across the peaks.
    g.fillStyle = ink;
    let piece: P[] = [];
    const cut = () => {
      if (piece.length >= 3 && piece.some((q) => near(area, q.x, q.y, 8)))
        stroke(g, piece, { w: 1.5, seed: ((piece[0].x * 3) | 0) + seed, taper: [0.2, 0.3], wobble: 0.15 });
      piece = [];
    };
    for (let i = 0; i < N; i++) {
      const b = bottom[i];
      // Lift at a fixed place every so often, or one stroke could run the whole ledge and a crater at
      // one end would change its pressure at the other.
      if (i && Math.floor(b.x / 34) !== Math.floor(bottom[i - 1].x / 34)) cut();
      if (vn(b.x * 0.09, 7, seed + 60) > 0.32) piece.push({ x: b.x, y: b.y + 0.25 });
      else cut();
    }
    cut();
    // Top line, thin and broken; the blades carry the silhouette.
    let topPiece: P[] = [];
    for (let i = 0; i < N; i++) {
      const c = Math.floor(edge[i].x / 34);
      topPiece.push(edge[i]);
      if (i === N - 1 || Math.floor(edge[i + 1].x / 34) !== c) {
        if (topPiece.length >= 3 && hash2(c, 3, seed) > 0.25) stroke(g, topPiece, { w: 0.95, seed: c + seed, taper: [0.25, 0.4] });
        topPiece = [edge[i]];
      }
    }

    // A fringe of short blades, so the top edge is never one clean line.
    for (let i = 1; i < N - 1; i++) {
      const p = edge[i];
      const h0 = hash2(p.x | 0, 7, seed);
      if (h0 < 0.3 || !style.fringe || !near(area, p.x, p.y, 8)) continue;
      const lean = (hash2(p.x | 0, 8, seed) - 0.5) * 1.2;
      const hh = (1.6 + hash2(p.x | 0, 9, seed) * 2.1) * style.fringe;
      blade(g, p.x, p.y + 1.2, lean, hh + 0.5, 2.4, ink);
      blade(g, p.x, p.y + 1.2, lean, hh, 1.5, h0 > 0.65 ? top : mid);
    }

    // Highlights.
    g.fillStyle = hi;
    for (let i = 1; i < N - 2; i++) {
      const p = edge[i];
      if (hash2(p.x | 0, 5, seed) < 0.72 || !near(area, p.x, p.y, 12)) continue;
      line(g, p.x, p.y + 1.6, p.x + 3 + hash2(p.x | 0, 6, seed) * 5, p.y + 1.9, { w: 1, seed: p.x | 0, taper: [0.2, 0.7] });
    }
  }
}

/** Downward-facing stretches of contour, for what hangs off a ceiling. */
function underRuns(loops: readonly EdgeP[][]): EdgeP[] {
  return loops.flat().filter((p) => p.ny > 0.9 && !p.hidden);
}

/** What grows down from a ceiling. Thin on purpose: this is the only thing allowed past the collision shape below, so it must read as decoration. */
type Hanger = (g: CanvasRenderingContext2D, x: number, y: number, h: number, T: TerrainLook, ink: string, seed: number) => void;

function spike(g: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, fill: string, ink: string, seed: number) {
  g.fillStyle = ink;
  line(g, x, y - 0.5, x, y + h + 0.7, { w: w + 1.1, seed, taper: [0, 0.95], press: 0 });
  g.fillStyle = fill;
  line(g, x, y - 0.5, x, y + h, { w, seed, taper: [0, 0.95], press: 0 });
}

const stalactite: Hanger = (g, x, y, h, T, ink, seed) => spike(g, x, y, Math.min(6, h), 2.6, css(T.base, -2), ink, seed);
const shard: Hanger = (g, x, y, h, T, ink, seed) => spike(g, x, y, Math.min(5, h), 2.4, css(T.vein, 6), ink, seed);
const mossDrip: Hanger = (g, x, y, h, T, ink, seed) => spike(g, x, y, h, 2.1, css(T.capColor, -8), ink, seed);
const root: Hanger = (g, x, y, h, T, _, seed) => {
  const pts: P[] = [];
  for (let i = 0; i <= 5; i++) pts.push({ x: x + sn(x * 0.2, i * 0.6, seed) * 1.6, y: y - 0.5 + (h * 1.2 * i) / 5 });
  g.fillStyle = css(T.dark, -6);
  stroke(g, pts, { w: 1.2, seed, taper: [0, 0.8], press: 0.2 });
};

function hangerOf(T: TerrainLook): Hanger | null {
  if (T.cap === 'crystal') return shard;
  if (T.cap === 'moss') return mossDrip;
  if (T.kind === 'cave' || T.kind === 'rock' || T.kind === 'basalt') return stalactite;
  if (T.kind === 'organic' || T.kind === 'dirt') return root;
  return null;
}

/** Ceilings: one roll per stretch of underside, so what hangs there doesn't move when the rock around it does. */
export function inkUnder(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], T: TerrainLook, seed: number, area: Area) {
  const hang = hangerOf(T);
  if (!hang) return;
  const ink = inkOf2(T);
  let last = NaN;
  for (const p of underRuns(loops)) {
    const cell = Math.floor(p.x / 9);
    if (cell === last || !near(area, p.x, p.y, 12)) continue;
    last = cell;
    const key = cell * 1009 + Math.round(p.y);
    if (hash2(key, 1, seed) > 0.3) continue;
    hang(g, cell * 9 + 2 + hash2(key, 2, seed) * 5, p.y, 3 + hash2(key, 3, seed) * 5, T, ink, key);
  }
}

/** The cap along every top edge of the terrain. */
export function inkCap(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], T: TerrainLook, seed: number, area: Area) {
  INK_CAPS[T.cap].draw({ g, runs: topRuns(loops), T, seed, area });
}

/** One live tuft: blades as filled, tapered leaves, held so they sway without re-rolling. */
export interface Tuft {
  x: number;
  y: number;
  blades: { lean: number; h: number; w: number; tone: number }[];
  tx: number;
  ty: number;
}

export function makeTufts(loops: readonly EdgeP[][], seed: number, keepClear: readonly P[] = []): Tuft[] {
  const tufts: Tuft[] = [];
  for (const run of topRuns(loops)) {
    let last = -1e9;
    for (const p of run) {
      // One roll per stretch of ground, so a tuft stays where it was when the run around it changes.
      const cell = Math.floor(p.x / 22);
      if (cell === last || p.ny > -0.8) continue;
      last = cell;
      if (hash2(cell, 9, seed) < 0.3) continue;
      if (keepClear.some((q) => Math.abs(q.x - p.x) < 11 && Math.abs(q.y - p.y) < 6)) continue;
      const n = 2 + Math.floor(hash2(p.x | 0, 10, seed) * 3);
      tufts.push({
        x: p.x,
        y: p.y + 0.5,
        tx: Math.floor(p.x / TILE),
        ty: Math.floor((p.y + 2) / TILE),
        blades: Array.from({ length: n }, (_, i) => ({
          lean: (i - (n - 1) / 2) * 0.32 + (hash2(p.x | 0, i, seed + 1) - 0.5) * 0.3,
          h: 3 + hash2(p.x | 0, i, seed + 2) * 4,
          w: 1.6 + hash2(p.x | 0, i, seed + 3) * 1,
          tone: i % 3,
        })),
      });
    }
  }
  return tufts;
}

/** Grass stands still in still air (`flutter`), and parts around anyone walking through it. */
export function drawTufts(
  rc: RC,
  s: CanvasRenderingContext2D,
  tufts: readonly Tuft[],
  level: Level,
  capColor: HSL,
  pushers: readonly P[],
  near: (x: number, y: number) => boolean = () => true,
) {
  if (!tufts.length) return;
  const tones = [css(capColor, -4, 1, 4), css(capColor, 10), css(capColor, -14, 1, 6)];
  const ink = css({ h: capColor.h + 25, s: Math.min(80, capColor.s + 15), l: 9 });
  for (const tf of tufts) {
    if (!near(tf.x, tf.y) || !tileAt(level, tf.tx, tf.ty) || tileAt(level, tf.tx, tf.ty) === T_ONEWAY) continue;
    let sway = flutter(rc, 2.1, tf.x * 0.15) * 0.3;
    for (const p of pushers) {
      const dx = tf.x - p.x;
      if (Math.abs(dx) < 10 && Math.abs(tf.y - p.y) < 12) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 10) * 0.9;
    }
    for (const b of tf.blades) blade(s, tf.x + b.lean * 4, tf.y, b.lean + sway, b.h + 0.8, b.w + 1.15, ink);
    for (const b of tf.blades) blade(s, tf.x + b.lean * 4, tf.y, b.lean + sway, b.h, b.w, tones[b.tone]);
  }
}

function blade(s: CanvasRenderingContext2D, x: number, y: number, lean: number, h: number, w: number, fill: string) {
  const tx = x + lean * h;
  const ty = y - h * (1 - Math.min(0.5, Math.abs(lean) * 0.4));
  const cx = x + lean * h * 0.25;
  const cy = y - h * 0.62;
  s.fillStyle = fill;
  s.beginPath();
  s.moveTo(x - w / 2, y);
  s.quadraticCurveTo(cx - w * 0.35, cy, tx, ty);
  s.quadraticCurveTo(cx + w * 0.35, cy, x + w / 2, y);
  s.closePath();
  s.fill();
}

interface Run {
  g: CanvasRenderingContext2D;
  x0: number;
  x1: number;
  y: number;
  /** Free-standing ends get a brace; ends set into a wall don't. */
  freeL: boolean;
  freeR: boolean;
  c: HSL;
  ink: string;
  seed: number;
  tx: number;
}

const H = 5.4;

function shape(g: CanvasRenderingContext2D, a: readonly P[], b: readonly P[], fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  a.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i].x, b[i].y);
  g.closePath();
  g.fill();
}

/** Top, middle and bottom edges of a run, each a little off true. */
function runEdges(r: Run, topA: number, botA: number) {
  const { x0, x1, y, seed } = r;
  const wob = (x: number, k: number, a: number) => sn(x * 0.09, y * 0.1 + k, seed + 70) * a;
  const topE: P[] = [];
  const botE: P[] = [];
  const midE: P[] = [];
  for (let x = x0; x <= x1 + 0.01; x += 2.5) {
    topE.push({ x, y: y + wob(x, 0, topA) });
    botE.push({ x, y: y + H + wob(x, 1, botA) });
    midE.push({ x, y: y + H * 0.62 + wob(x, 2, botA) });
  }
  return { topE, botE, midE, wob };
}

const INK_PLATFORMS: Record<PlatformKind, (r: Run) => void> = {
  wood(r) {
    const { g, x0, x1, y, c, ink, seed, tx } = r;
    const { topE, botE, midE, wob } = runEdges(r, 0.2, 0.55);
    // Braces first: the board overlaps them.
    if (r.freeL) brace(g, x0 + 4, y + H, 1, css(c, -10), ink, seed + tx);
    if (r.freeR) brace(g, x1 - 4, y + H, -1, css(c, -10), ink, seed + tx + 1);
    shape(g, topE, botE, css(c));
    shape(g, midE, botE, css(c, -15, 1, 4));
    shape(
      g,
      topE,
      topE.map((q) => ({ x: q.x, y: q.y + 1.15 })),
      css(c, 14),
    );
    g.fillStyle = css(c, -24, 1, 6);
    for (let x = x0 + 2; x < x1 - 3; x += 3) {
      const h0 = hash2(x | 0, y | 0, seed + 71);
      if (h0 < 0.62) continue;
      const gy = y + 1.8 + hash2(x | 0, 2, seed + 72) * 2.4;
      line(g, x, gy, x + 5 + h0 * 8, gy + (h0 - 0.8) * 2, { w: 0.65, seed: (x | 0) + seed, taper: [0.3, 0.6] });
    }
    g.fillStyle = ink;
    // Board ends and nails, irregular on purpose.
    for (let x = x0 + 12 + hash2(tx, y, seed) * 16; x < x1 - 8; x += 22 + hash2(x | 0, y, seed) * 24) {
      const lean = (hash2(x | 0, 1, seed) - 0.5) * 1.3;
      line(g, x, y + 0.2, x + lean, y + H - 0.1, { w: 1.1, seed: x | 0, taper: [0.1, 0.25] });
      blob(g, x - 2, y + 1.6 + hash2(x | 0, 2, seed), 0.5, x | 0, 1, 0.2);
      g.fill();
      blob(g, x + 2.2, y + 3 + hash2(x | 0, 3, seed), 0.5, (x | 0) + 1, 1, 0.2);
      g.fill();
    }
    stroke(g, botE, { w: 1.9, seed: tx + seed, taper: [0.03, 0.05], press: 0.55 });
    stroke(g, topE, { w: 0.85, seed: tx + seed + 1, taper: [0.1, 0.12], press: 0.6 });
    if (r.freeL) line(g, x0, y - 0.3, x0 + wob(x0, 3, 0.5), y + H + 0.3, { w: 1.5, seed: tx, taper: [0.1, 0.1] });
    if (r.freeR) line(g, x1, y - 0.3, x1 + wob(x1, 3, 0.5), y + H + 0.3, { w: 1.8, seed: tx + 1, taper: [0.1, 0.1] });
  },
  grate(r) {
    const { g, x0, x1, y, c, ink, seed, tx } = r;
    const { topE, botE } = runEdges(r, 0.12, 0.2);
    shape(g, topE, botE, css(c, -24, 1, 4));
    // Slats leaning one way, with the dark showing through: this one you can see is a grating.
    g.fillStyle = css(c, 6);
    for (let k = Math.ceil(x0 / 2.8); k * 2.8 < x1 - 1; k++) line(g, k * 2.8, y + 1.2, k * 2.8 + 1.6, y + H - 1, { w: 1, seed: k, taper: [0, 0], press: 0.1 });
    g.fillStyle = ink;
    stroke(g, botE, { w: 1.62, seed: tx + seed, taper: [0.03, 0.05], press: 0.4 });
    g.fillStyle = css(c, 12);
    stroke(g, topE, { w: 1.5, seed: tx + seed + 1, taper: [0.02, 0.02], press: 0.15 });
    g.fillStyle = ink;
    stroke(
      g,
      topE.map((q) => ({ x: q.x, y: q.y - 0.5 })),
      { w: 0.7, seed: tx + seed + 2, taper: [0.1, 0.1], press: 0.5 },
    );
    if (r.freeL) line(g, x0, y - 0.5, x0, y + H + 0.3, { w: 1.6, seed: tx, taper: [0.1, 0.1] });
    if (r.freeR) line(g, x1, y - 0.5, x1, y + H + 0.3, { w: 1.9, seed: tx + 1, taper: [0.1, 0.1] });
  },
  bamboo(r) {
    const { g, x0, x1, y, c, ink, seed } = r;
    for (const [dy, dl] of [
      [0, 6],
      [2.6, -6],
    ] as const) {
      const pts: P[] = [];
      for (let x = x0; x <= x1 + 0.01; x += 3) pts.push({ x, y: y + dy + 1.3 + sn(x * 0.08, dy, seed) * 0.25 });
      g.fillStyle = ink;
      stroke(g, pts, { w: 3.04, seed: seed + dy, taper: [0, 0], press: 0.05 });
      g.fillStyle = css(c, dl);
      stroke(g, pts, { w: 2.2, seed: seed + dy, taper: [0, 0], press: 0.05 });
      g.fillStyle = css(c, dl + 18);
      stroke(
        g,
        pts.map((q) => ({ x: q.x, y: q.y - 0.5 })),
        { w: 0.6, seed: seed + dy + 1, taper: [0.2, 0.3] },
      );
      // Nodes in the cane: never lined up from one pole to the next.
      g.fillStyle = ink;
      for (let k = Math.ceil(x0 / 13); k * 13 < x1 - 2; k++) {
        const nx = k * 13 + hash2(k, dy, seed) * 8;
        if (nx < x1 - 1) line(g, nx, y + dy, nx + 0.3, y + dy + 2.6, { w: 0.9, seed: k, taper: [0.1, 0.1] });
      }
    }
    // Lashings.
    g.fillStyle = css({ h: 35, s: 40, l: 42 });
    for (let k = Math.ceil(x0 / 28); k * 28 < x1 - 2; k++) {
      const lx = k * 28 + 4;
      if (lx < x1 - 2) line(g, lx, y - 0.6, lx + 0.8, y + H, { w: 2, seed: k, taper: [0.05, 0.05], press: 0.1 });
    }
  },
  stone(r) {
    const { g, x0, x1, y, c, ink, seed, tx } = r;
    const { topE, botE, midE } = runEdges(r, 0.15, 0.7);
    shape(g, topE, botE, css(c));
    shape(g, midE, botE, css(c, -8, 1, 2));
    shape(
      g,
      topE,
      topE.map((q) => ({ x: q.x, y: q.y + 1 })),
      css(c, 12),
    );
    g.fillStyle = ink;
    for (let k = Math.ceil(x0 / 21); k * 21 < x1 - 5; k++) {
      if (hash2(k, 1, seed) < 0.3) continue;
      const sx = k * 21 + hash2(k, 2, seed) * 8;
      line(g, sx, y + 0.2, sx + 1.5 - hash2(k, 3, seed) * 3, y + H, { w: 1, seed: k, taper: [0.1, 0.4] });
    }
    stroke(g, botE, { w: 1.9, seed: tx + seed, taper: [0.03, 0.05], press: 0.55 });
    stroke(g, topE, { w: 0.85, seed: tx + seed + 1, taper: [0.1, 0.12], press: 0.6 });
  },
  girder(r) {
    // An I-beam side on: a lit top flange, a shadowed bottom one, the web between them shot through with
    // lightening holes, and rivets along the top. Holes and rivets sit on a world lattice, never on the run.
    const { g, x0, x1, y, c, ink, seed, tx } = r;
    const { topE, botE } = runEdges(r, 0.06, 0.1);
    shape(g, topE, botE, css(c, -16));
    shape(
      g,
      topE,
      topE.map((q) => ({ x: q.x, y: q.y + 1.5 })),
      css(c, 8),
    );
    shape(
      g,
      botE.map((q) => ({ x: q.x, y: q.y - 1.3 })),
      botE,
      css(c, -6),
    );
    // One lightening hole a tile, a dark of the web with its lower lip catching the light, not an ink punch.
    for (let k = Math.ceil((x0 + 3 - 8) / 16); k * 16 + 8 < x1 - 3; k++) {
      const hx = k * 16 + 8;
      g.fillStyle = css(c, -30);
      blob(g, hx, y + H * 0.52, 1.25, k + seed, 1.15, 0.12);
      g.fill();
      g.fillStyle = css(c, 4);
      blob(g, hx + 0.2, y + H * 0.52 + 0.75, 0.6, k + seed + 1, 0.5, 0.1);
      g.fill();
    }
    // Rivets along the top flange, a couple a tile, some missing.
    g.fillStyle = css(c, -24);
    for (let k = Math.ceil((x0 + 1) / 8); k * 8 < x1 - 1; k++) {
      if (hash2(k, 3, seed) < 0.35) continue;
      blob(g, k * 8 + 4, y + 0.8, 0.38, k, 1, 0.1);
      g.fill();
    }
    g.fillStyle = ink;
    stroke(g, botE, { w: 1.5, seed: tx + seed, taper: [0.03, 0.05], press: 0.45 });
    stroke(g, topE, { w: 0.8, seed: tx + seed + 1, taper: [0.1, 0.12], press: 0.5 });
    if (r.freeL) line(g, x0, y - 0.3, x0, y + H + 0.3, { w: 1.3, seed: tx, taper: [0.1, 0.1] });
    if (r.freeR) line(g, x1, y - 0.3, x1, y + H + 0.3, { w: 1.6, seed: tx + 1, taper: [0.1, 0.1] });
  },
};

/** Jump-through platforms, drawn as whole runs rather than a tile stamp. */
export function inkPlatforms(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, area: Area) {
  const P = th.terrain.platform;
  const ink = inkOf(th);
  // A landmark's boards are its own: a grating in a steel tower, planks in a manor.
  const skin = skinOf(level);
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      if (tileAt(level, tx, ty) !== T_ONEWAY || tileAt(level, tx - 1, ty) === T_ONEWAY) continue;
      let end = tx;
      while (tileAt(level, end + 1, ty) === T_ONEWAY) end++;
      const x0 = tx * TILE - (solid(tx - 1, ty) ? 2 : 0.5);
      const x1 = (end + 1) * TILE + (solid(end + 1, ty) ? 2 : 0.5);
      const y = ty * TILE;
      if (x1 + 8 < area.x0 || x0 - 8 > area.x1 || y + 14 < area.y0 || y - 2 > area.y1) continue;
      const own = inSkin(skin, tx, ty) ? skin!.T.platform : P;
      INK_PLATFORMS[own.kind]({ g, x0, x1, y, freeL: !solid(tx - 1, ty), freeR: !solid(end + 1, ty), c: own.color, ink, seed, tx });
    }
  }
}

function brace(g: CanvasRenderingContext2D, x: number, y: number, dir: number, fill: string, ink: string, seed: number) {
  g.fillStyle = ink;
  line(g, x, y - 1, x + dir * 6, y + 5, { w: 3.5, seed, taper: [0, 0.12], press: 0.15 });
  g.fillStyle = fill;
  line(g, x, y - 1, x + dir * 6, y + 5, { w: 1.9, seed: seed + 1, taper: [0, 0.12], press: 0.15 });
}

function airDistance(level: Level, solid: (x: number, y: number) => boolean): Int16Array {
  const { w, h } = level;
  const d = new Int16Array(w * h).fill(9999);
  const q: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) {
        d[y * w + x] = 0;
        q.push(y * w + x);
      }
    }
  }
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    const x = c % w;
    const y = (c - x) / w;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] > d[c] + 1) {
        d[j] = d[c] + 1;
        q.push(j);
      }
    }
  }
  return d;
}
