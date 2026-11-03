/**
 * A flat kind's frames (docs/CHARACTERS.md → Rendered kinds → Flat kinds), from its game-size design and a
 * drawing of it in each pose: `pnpm exec tsx tools/art3d/flat/build.ts zapmouse`. Each drawing becomes a
 * role map (`rolemap.py`, at one body size for every pose), traced by the real tracer into the drawing's
 * own shapes, with its long interior lines. The cast's face kit takes over from the drawing's eyes and
 * mouth, which are specks at play size; the kind's variety (a colourway, an accessory, worn and scorched
 * wear, alternate idle and cheer, a gait) is laid on as data and marks here, so every pose wears it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { trace } from '../page/trace';
import type { Settings } from '../settings';
import { FLAT_KINDS, type FlatClip, posePrompt } from './kinds';

const [first, second, third] = process.argv.slice(2);
// `build.ts pose KIND NAME`: the prompt for one pose drawing (Tripo `image … --ref design.png`).
if (first === 'pose') {
  const p = FLAT_KINDS[second]?.poses[third];
  if (!p) throw new Error(`No pose "${third}" for "${second}": poses are listed per kind in tools/art3d/flat/kinds.ts.`);
  console.log(posePrompt(p.pose, p.far));
  process.exit(0);
}
const kind = first ?? 'zapmouse';
const spec = FLAT_KINDS[kind];
if (!spec) throw new Error(`No flat kind "${kind}". Flat kinds are listed in tools/art3d/flat/kinds.ts: ${Object.keys(FLAT_KINDS).join(', ')}.`);
const art = resolve('art/sprites', kind);
const cache = resolve('.cache/flat', kind);
mkdirSync(cache, { recursive: true });

interface RoleMap {
  W: number;
  H: number;
  R: number;
  roles: string[];
  role: number[];
  height: number;
  lines: { role: number; pts: number[] }[];
}

type Pt = [number, number];
interface Shape {
  role: number;
  ring: number[];
  option?: [number, number];
}
interface Frame {
  sil: number[][];
  parts: Shape[];
  lines: { role: number; pts: number[] }[];
  eyes: Pt[];
}

const area = (r: number[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return Math.abs(a) / 2;
};
const mid = (r: number[]): Pt => {
  let x = 0;
  let y = 0;
  for (let i = 0; i < r.length; i += 2) {
    x += r[i];
    y += r[i + 1];
  }
  return [x / (r.length / 2), y / (r.length / 2)];
};
const inside = (x: number, y: number, r: number[]) => {
  let odd = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2)
    if (r[i + 1] > y !== r[j + 1] > y && x < ((r[j] - r[i]) * (y - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) odd = !odd;
  return odd;
};
const shift = (r: number[], dx: number, dy: number) => r.map((v, i) => v + (i % 2 ? dy : dx));

/** A wobbly blob, `n` points about (x, y): a scuff, a scorch or a strip's end. */
function blob(x: number, y: number, rx: number, ry: number, seed: number, n = 7): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + 0.25 * Math.abs(Math.sin(seed * 12.9 + i * 2.3));
    out.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
  }
  return out;
}

/** A strip of tape, `len` long and `w` wide, centred on (x, y) at angle `a`. */
function strip(x: number, y: number, len: number, w: number, a: number): number[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-len / 2, -w / 2],
    [len / 2, (-w / 2) * 0.8],
    [len / 2, (w / 2) * 0.8],
    [-len / 2, w / 2],
  ].flatMap(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
}

/** The smallest part of a role worth its own shape (world px²): a cheek or a plug survives, a speck of line doesn't. */
const MIN: Record<string, number | undefined> = { dark: 0.12, cheek: 0.3, plug: 0.35 };

/** One pose drawing, traced into a facing-right frame with its feet at the origin. */
function frameOf(name: string, clip: FlatClip): Frame {
  const png = name === 'idle' ? resolve(art, 'design.png') : resolve(art, 'flat', `${name}.png`);
  const json = resolve(cache, `${name}.json`);
  execFileSync('python3', ['-I', resolve('tools/art3d/flat/rolemap.py'), png, json, resolve(cache, `${name}.png`), `a${spec.body}`, '9', '12'], {
    stdio: 'pipe',
  });
  const m = JSON.parse(readFileSync(json, 'utf8')) as RoleMap;
  // Only what the tracer reads: no depth steps (a drawing is flat), and each role's smallest part.
  const settings: Pick<Settings, 'step' | 'trace' | 'roles'> = {
    step: 1e9,
    trace: { res: m.R, min: 0.8, eps: 0.22, smooth: 2 },
    // The tracer reads only `min` (and `into`, `glint`, `band`, `free`, none of them here); colours are the kind's.
    roles: Object.fromEntries(m.roles.map((n) => [n, { color: '', swatches: [], min: MIN[n] }])),
  };
  const t = trace(Int16Array.from(m.role), new Float32Array(m.W * m.H), m.W, m.H, m.R, settings as Settings, m.roles);
  const roleOf = (n: string) => spec.roles.findIndex((r) => r.name === n);
  // Roles by name from the map's order into the kind's.
  let parts: Shape[] = t.parts.map((p) => ({ role: roleOf(m.roles[p.role]), ring: p.ring }));
  const dark = roleOf('dark');
  // The eyes: the two small dark specks side by side, nearest level, near (left, facing right) first.
  const specks = parts.filter((p) => p.role === dark && area(p.ring) >= 0.06 && area(p.ring) < 0.7);
  let eyes: Pt[] = [];
  let best = -1;
  for (const a of specks)
    for (const b of specks) {
      const [pa, pb] = [mid(a.ring), mid(b.ring)];
      const dx = pb[0] - pa[0];
      if (dx < 2 || dx > 5.5 || Math.abs(pb[1] - pa[1]) > 1.2) continue;
      const score = area(a.ring) + area(b.ring) - Math.abs(pb[1] - pa[1]) * 0.2;
      if (score > best) {
        best = score;
        eyes = [pa, pb];
      }
    }
  if (clip.eyes === false) eyes = [];
  // The face's specks go (eyes, nose, a drawn mouth and its tongue): the kit draws eyes and mouth there.
  if (eyes.length) {
    const [x0, x1] = [eyes[0][0] - 2.5, eyes[1][0] + 2.5];
    const [y0, y1] = [Math.min(eyes[0][1], eyes[1][1]) - 1.5, Math.max(eyes[0][1], eyes[1][1]) + 3.6];
    parts = parts.filter((p) => {
      const [x, y] = mid(p.ring);
      const face = x > x0 && x < x1 && y > y0 && y < y1;
      return !(face && ((p.role === dark && area(p.ring) < 1.2) || (p.role === roleOf('cheek') && area(p.ring) < 0.35)));
    });
  } else if (clip.eyes === false)
    // Shut eyes and an open mouth are specks too: the face's place is all the kit needs, and it has none.
    parts = parts.filter((p) => !(p.role === dark && area(p.ring) < 0.4));
  // A black cord under the cheeks reads as a frowning mouth: the cord is the cord's colour, the ear tips stay black.
  const belt = eyes.length ? Math.max(eyes[0][1], eyes[1][1]) + 2.5 : -10;
  for (const p of parts)
    if (p.role === dark && (clip.eyes === false ? area(p.ring) > 0.4 && mid(p.ring)[0] > -4 : mid(p.ring)[1] > belt)) p.role = roleOf('cord');
  // Back to front by role.
  parts.sort((a, b) => a.role - b.role);
  const f: Frame = { sil: t.sil, parts, lines: m.lines.map((l) => ({ role: roleOf(m.roles[l.role]), pts: l.pts })), eyes };
  // The soles on the floor, the pen and its boil just under it; a lying figure centred on itself.
  let low = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const r of f.sil)
    for (let i = 0; i < r.length; i += 2) {
      low = Math.max(low, r[i + 1] + 0.15);
      left = Math.min(left, r[i]);
      right = Math.max(right, r[i]);
    }
  const dx = clip.centre === 'box' ? -(left + right) / 2 : 0;
  return move(f, dx, -low);
}

function move(f: Frame, dx: number, dy: number): Frame {
  return {
    sil: f.sil.map((r) => shift(r, dx, dy)),
    parts: f.parts.map((p) => ({ ...p, ring: shift(p.ring, dx, dy) })),
    lines: f.lines.map((l) => ({ ...l, pts: shift(l.pts, dx, dy) })),
    eyes: f.eyes.map(([x, y]) => [x + dx, y + dy]),
  };
}

/**
 * The kind's marks on one frame: its accessory, and the scuffs and scorches of its wear, set on the body's
 * bare fur at spots that hold their place in the body's box from pose to pose, clear of the face.
 */
function dress(f: Frame, seed: number): Frame {
  const fur = spec.roles.findIndex((r) => r.name === 'fur');
  // The fur in every piece (a belt or an arm splits it), and what's painted over it.
  const body = f.parts.filter((p) => p.role === fur);
  if (!body.length) return f;
  const over = f.parts.filter((p) => p.role > fur);
  const xs = body.flatMap((p) => p.ring.filter((_, i) => i % 2 === 0));
  const ys = body.flatMap((p) => p.ring.filter((_, i) => i % 2 === 1));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const onFur = (x: number, y: number) => body.some((p) => inside(x, y, p.ring)) && !over.some((p) => inside(x, y, p.ring));
  // Below the mouth and the cheeks: a pale patch there reads as a snout.
  const chin = f.eyes.length ? Math.max(...f.eyes.map(([, ey]) => ey)) + 4.5 : -Infinity;
  const clearOfFace = (x: number, y: number, r: number) => y - r > chin && f.eyes.every(([ex, ey]) => Math.hypot(x - ex, y - ey) > 0.875 + 1 + r + 0.2);
  /** A spot `r` across inside the body at (u, v) of its box, or the nearest that is. */
  const spot = (u: number, v: number, r: number): Pt | null => {
    for (let k = 0; k < 80; k++) {
      const a = k * 2.4;
      const d = k * 0.12;
      const x = x0 + (x1 - x0) * u + Math.cos(a) * d;
      const y = y0 + (y1 - y0) * v + Math.sin(a) * d;
      const round = onFur(x, y) && [0, 1, 2, 3, 4, 5].every((i) => onFur(x + Math.cos(i) * r * 1.3, y + Math.sin(i) * r * 1.3));
      if (round && clearOfFace(x, y, r)) return [x, y];
    }
    return null;
  };
  const role = (n: string) => spec.roles.findIndex((r) => r.name === n);
  const extra: Shape[] = [];
  const wear = spec.slots.findIndex((s) => s.name === 'wear');
  // Scuffed: rubbed pale patches; scorched: a burn and a scuff.
  for (const [o, marks] of [
    [
      1,
      [
        ['scuff', 0.32, 0.8, 1.1],
        ['scuff2', 0.68, 0.7, 0.8],
      ],
    ],
    [
      2,
      [
        ['scorch', 0.38, 0.78, 1.4],
        ['scuff2', 0.7, 0.72, 0.75],
      ],
    ],
  ] as const)
    marks.forEach(([n, u, v, r], i) => {
      const at = spot(u, v, r);
      if (at) extra.push({ role: role(n), ring: blob(at[0], at[1], r, r * 0.8, seed + o * 7 + i), option: [wear, o] });
      else console.log(`  no room for ${n} (wear ${o})`);
    });
  // The accessory: a cross of tape on the head, above the near eye.
  const tape = spec.slots.findIndex((s) => s.name === 'tape');
  if (f.eyes.length) {
    const [ex, ey] = f.eyes[0];
    const [hx, hy] = [ex - 0.4, ey - 3.1];
    for (const a of [0.55, -0.55]) extra.push({ role: role('tape'), ring: strip(hx, hy, 2.9, 0.85, a), option: [tape, 1] });
  }
  return { ...f, parts: [...f.parts, ...extra] };
}

const enc = (r: number[]) => {
  const a = new Int16Array(r.map((v) => Math.round(v * 8)));
  return Buffer.from(a.buffer).toString('base64');
};
const mirror = (r: number[]) => {
  const o: number[] = [];
  for (let i = r.length - 2; i >= 0; i -= 2) o.push(-r[i], r[i + 1]);
  return o;
};
/** Open lines keep their order when mirrored: only the x flips. */
const flipLine = (r: number[]) => r.map((v, i) => (i % 2 ? v : -v));

function vframe(f: Frame, flip: boolean) {
  const ring = (r: number[]) => enc(flip ? mirror(r) : r);
  const out: Record<string, unknown> = {
    sil: f.sil.map(ring),
    parts: f.parts.map((p) => (p.option ? [p.role, ring(p.ring), ...p.option] : [p.role, ring(p.ring)])),
    lines: f.lines.map((l) => [l.role, enc(flip ? flipLine(l.pts) : l.pts)]),
  };
  if (f.eyes.length) {
    const [a, b] = f.eyes;
    const x = (v: number) => (flip ? -v : v);
    out.eyes = [Math.round(x(a[0]) * 8), Math.round(a[1] * 8), 7, Math.round(x(b[0]) * 8), Math.round(b[1] * 8), 6];
    // The head the eyes ride, turned with the line between them.
    const tilt = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    out.head = [Math.round(x((a[0] + b[0]) / 2) * 8), Math.round(((a[1] + b[1]) / 2 - 1) * 8), 64, Math.round(flip ? -tilt : tilt)];
  }
  return out;
}

const traced = new Map<string, Frame>();
const clips: Record<string, unknown> = {};
let n = 0;
for (const [name, clip] of Object.entries(spec.clips)) {
  const fs = clip.frames.map((fr) => {
    let f = traced.get(fr);
    if (!f) {
      f = dress(frameOf(fr, clip), n++);
      traced.set(fr, f);
      console.log(fr, 'parts', f.parts.length, 'lines', f.lines.length, 'eyes', f.eyes.length);
    }
    return f;
  });
  const { frames: _, eyes: __, centre: ___, ...timing } = clip;
  clips[name] = { ...timing, r: fs.map((f) => vframe(f, false)), l: fs.map((f) => vframe(f, true)) };
}
const idle = traced.get(spec.clips.idle.frames[0])!;
const top = Math.min(...idle.sil.flatMap((r) => r.filter((_, i) => i % 2 === 1)));
const set = {
  kind,
  height: Math.round(-top * 10) / 10,
  flat: true,
  roles: spec.roles.map(({ name: _, ...r }) => r),
  slots: spec.slots,
  face: spec.face,
  gait: spec.gait,
  clips,
};
const out = resolve('src/render/cast/sprites', kind, 'frames.ts');
writeFileSync(
  out,
  `// Generated by tools/art3d/flat/build.ts from art/sprites/${kind}/design.png and flat/: do not edit.\nimport type { SpriteSet } from '../types';\n\nexport const sprites: SpriteSet = ${JSON.stringify(set)} as SpriteSet;\n`,
);
execFileSync('pnpm', ['exec', 'oxfmt', out], { stdio: 'inherit' });
console.log(out);
