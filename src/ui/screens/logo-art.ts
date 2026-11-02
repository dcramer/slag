import { hash2 } from '../../core/rng';
import { type P, stroke } from '../../render/ink';

/**
 * The SLAG logo, inked the way the world is (docs/ART.md → World art): a hard offset shadow shape, a
 * solid ink mass that leans away from the light, molten fill cut into three hard cel bands, pen lines
 * that swell and lift round every edge (the counters too), drips hanging off the letters, and a
 * white-hot highlight stroke on each letter.
 *
 * The letters are Lilita One's own outlines (SIL OFL 1.1), so the logo needs no web font and lands
 * in the same 2.282em × 0.9em box the text used to take. Pure and deterministic: the SVG is built
 * once, and hosts server-render it, so it paints before any script.
 */

/** Glyph outlines in font units (1000/em), y down from the baseline, and each glyph's pen position. */
const GLYPHS = {
  S: {
    x: 0,
    d: 'M76 -244Q95 -229 141.5 -203Q188 -177 230.5 -177Q273 -177 273 -210Q273 -225 261 -236.5Q249 -248 217 -263Q185 -278 169 -286.5Q153 -295 126.5 -314.5Q100 -334 86 -355Q46 -412 46 -500Q46 -588 111.5 -648.5Q177 -709 283 -709Q355 -709 416 -693.5Q477 -678 479 -653Q479 -650 479 -647Q479 -612 457 -558.5Q435 -505 426 -499Q362 -532 311.5 -532Q261 -532 261 -496Q261 -474 298 -457Q306 -453 321 -446Q336 -439 355.5 -429.5Q375 -420 397.5 -405.5Q420 -391 446 -367Q499 -317 499 -235Q499 -128 440 -60Q381 8 258 10Q198 10 149.5 0Q101 -10 65 -39Q29 -68 29 -109Q29 -150 44 -190.5Q59 -231 76 -244Z',
  },
  L: {
    x: 541,
    d: 'M40 -59L40 -681Q40 -702 141.5 -702Q243 -702 243 -681L243 -191L397 -191Q415 -191 422 -144Q425 -121 425 -97Q425 -73 422 -48Q414 0 396 0L88 0Q66 0 53 -18Q40 -36 40 -59Z',
  },
  A: {
    x: 986,
    d: 'M520 2Q433 2 426 -26L393 -155L234 -155L205 -31Q199 0 109 0Q61 0 38 -5.5Q15 -11 15 -14L192 -691Q192 -699 329 -699Q466 -699 466 -691L639 -13Q639 -6 593 -2Q547 2 520 2ZM259 -282L364 -282L319 -489L313 -489L259 -282Z',
  },
  G: {
    x: 1651,
    d: 'M420 -209L422 -345Q422 -359 451 -363.5Q480 -368 499 -368L538 -365Q576 -359 576 -344L572 -31Q552 -17 491.5 -3.5Q431 10 353 10Q208 10 119 -84Q30 -178 30 -360Q30 -515 117 -612Q204 -709 358 -709Q428 -709 484.5 -695.5Q541 -682 562 -659Q563 -651 563 -629Q563 -607 548 -566.5Q533 -526 514 -506Q495 -486 486.5 -486Q478 -486 468.5 -493.5Q459 -501 431 -509.5Q403 -518 377 -518Q315 -518 276.5 -478Q238 -438 238 -354Q238 -270 277.5 -226.5Q317 -183 368.5 -183Q420 -183 420 -209Z',
  },
};
type Letter = keyof typeof GLYPHS;

/** Drips: the letter, where along it (font units), and how far below it they hang (px at full size). */
const DRIPS: [Letter, number, number][] = [
  ['S', 175, 24],
  ['L', 105, 14],
  ['L', 330, 32],
  ['A', 105, 18],
  ['A', 540, 28],
  ['G', 290, 12],
  ['G', 480, 22],
];

/** Everything is drawn in px at the logo's full size (150px): px per font unit, the baseline, the box. */
const K = 0.15;
const BASE = 120.2;
const BOX_W = 342.3;
const BOX_H = 135;

const INK = '#120b08';
const SHADOW = '#2b1109';
/** Light, middle and deep molten: the cel bands, top to bottom. */
const BANDS = ['#ffc83f', '#ff7a22', '#e0471a'];
const HIGHLIGHT = '#fff1b8';

const f = (n: number) => String(Math.round(n * 10) / 10);

/** A canvas stand-in that writes what the pen draws as SVG path data: relative steps in tenths of a px, which keeps it small. */
function recorder() {
  let d = '';
  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0;
  let last = '';
  const num = (n: number, after: string) => `${n < 0 || /[a-z]$/i.test(after) ? '' : ' '}${n}`;
  const to = (cmd: string, x: number, y: number) => {
    const ix = Math.round(x * 10);
    const iy = Math.round(y * 10);
    // Repeated line steps share one command letter.
    if (cmd !== last) d += cmd;
    d += num((ix - px) / 10, d);
    d += num((iy - py) / 10, d);
    px = ix;
    py = iy;
    last = cmd;
  };
  const g = {
    beginPath() {},
    moveTo: (x: number, y: number) => {
      to(d ? 'm' : 'M', x, y);
      sx = px;
      sy = py;
    },
    lineTo: (x: number, y: number) => to('l', x, y),
    // Closing returns the pen to where the shape started.
    closePath: () => {
      d += 'z';
      px = sx;
      py = sy;
      last = 'z';
    },
    fill() {},
  };
  return { g: g as unknown as CanvasRenderingContext2D, out: () => d };
}

interface Loop {
  pts: P[];
  /** A counter: inside another loop of its glyph. */
  hole: boolean;
  /** Clockwise on screen. */
  cw: boolean;
}

/** One glyph: its path data in logo px, and its contours as point loops, curves flattened every ~`step` px. */
function glyph(d: string, ox: number, step: number): { path: string; loops: Loop[] } {
  const toks = d.match(/[MLQZ]|-?[\d.]+/g)!;
  const loops: Loop[] = [];
  let path = '';
  let cur: P[] = [];
  let last: P = { x: 0, y: 0 };
  let i = 0;
  const pt = (): P => ({ x: ox + Number(toks[i++]) * K, y: BASE + Number(toks[i++]) * K });
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') {
      last = pt();
      cur = [last];
      path += `M${f(last.x)} ${f(last.y)}`;
    } else if (c === 'L' || c === 'Q') {
      const q = c === 'Q' ? pt() : null;
      const p = pt();
      const via = q ?? { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      const n = Math.max(1, Math.ceil((Math.hypot(via.x - last.x, via.y - last.y) + Math.hypot(p.x - via.x, p.y - via.y)) / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        cur.push({
          x: (1 - t) * (1 - t) * last.x + 2 * t * (1 - t) * via.x + t * t * p.x,
          y: (1 - t) * (1 - t) * last.y + 2 * t * (1 - t) * via.y + t * t * p.y,
        });
      }
      path += q ? `Q${f(q.x)} ${f(q.y)} ${f(p.x)} ${f(p.y)}` : `L${f(p.x)} ${f(p.y)}`;
      last = p;
    } else {
      path += 'Z';
      if (Math.hypot(cur[0].x - last.x, cur[0].y - last.y) < 0.01) cur.pop();
      let area = 0;
      for (let k = 0; k < cur.length; k++) {
        const a = cur[k];
        const b = cur[(k + 1) % cur.length];
        area += a.x * b.y - b.x * a.y;
      }
      loops.push({ pts: cur, hole: false, cw: area > 0 });
    }
  }
  for (const l of loops) l.hole = loops.some((o) => o !== l && inside(l.pts[0], o.pts));
  return { path, loops };
}

function inside(p: P, poly: readonly P[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The normal at each point of a loop that points away from the solid: out of a letter, into a counter. */
function normals(l: Loop): P[] {
  const n = l.pts.length;
  // Left of travel, (dy, -dx), is outside a loop that runs clockwise on screen.
  const sgn = (l.cw ? 1 : -1) * (l.hole ? -1 : 1);
  return l.pts.map((_, i) => {
    const a = l.pts[(i - 1 + n) % n];
    const b = l.pts[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (sgn * (b.y - a.y)) / d, y: (-sgn * (b.x - a.x)) / d };
  });
}

/** How directly a face looks toward the light (upper left): -1 straight at it, 1 straight away. */
const facing = (n: P) => n.x * 0.55 + n.y * 0.83;

/**
 * Pen strokes round a loop, `off` px out along its normal: runs of points that overlap a little and
 * sometimes lift off, each thin where it faces the light and heavy where it turns away.
 */
function penLoop(g: CanvasRenderingContext2D, l: Loop, seed: number, thin: number, heavy: number, off: number, lifts: number, wobble: number) {
  const ns = normals(l);
  const n = l.pts.length;
  let a = Math.floor(hash2(seed, 1) * n);
  const end = a + n;
  for (let k = 0; a < end; k++) {
    const b = Math.min(end, a + 12 + Math.floor(hash2(seed, k * 3 + 2) * 12));
    const run: P[] = [];
    let away = 0;
    for (let i = a; i <= b; i++) {
      const p = l.pts[i % n];
      const nn = ns[i % n];
      away += Math.max(0, 0.5 + 0.62 * facing(nn));
      run.push({ x: p.x + nn.x * off, y: p.y + nn.y * off });
    }
    const w = thin + (heavy - thin) * Math.min(1, (away / run.length) * 1.6);
    stroke(g, run, { w, seed: seed * 31 + k, taper: [0.18, 0.24], press: 0.4, wobble });
    a = b + (hash2(seed, k * 3 + 3) < lifts ? 1 : -1);
  }
}

/** A drip: its shape (a neck and a bulb) and the pen line down one side, round the bulb and up the other. */
function drip(ch: Letter, x: number, len: number, letter: Loop[], seed: number) {
  const gx = (GLYPHS[ch].x + x) * K;
  let bottom = 0;
  for (const l of letter) if (!l.hole) for (const p of l.pts) if (Math.abs(p.x - gx) < 3 && p.y > bottom) bottom = p.y;
  const w = 9.5;
  const r = w / 2 + 1.5;
  const top = bottom - 8;
  const cy = bottom + len - r;
  const phi = Math.acos(w / 2 / r);
  const neck = cy - r * Math.sin(phi);
  const d = `M${f(gx - w / 2)} ${f(top)}V${f(neck)}A${f(r)} ${f(r)} 0 1 0 ${f(gx + w / 2)} ${f(neck)}V${f(top)}Z`;
  const side: P[] = [];
  for (let k = 0; k <= 5; k++) side.push({ x: gx - w / 2, y: bottom + 1 + ((neck - bottom - 1) * k) / 5 });
  for (let k = 1; k < 12; k++) {
    const a = Math.PI + phi - ((Math.PI + 2 * phi) * k) / 12;
    side.push({ x: gx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  for (let k = 0; k <= 5; k++) side.push({ x: gx + w / 2, y: neck - ((neck - bottom - 1) * k) / 5 });
  const pen = recorder();
  stroke(pen.g, side, { w: 2.4, seed, taper: [0.1, 0.1], press: 0.5 });
  return { d, pen: pen.out(), origin: [gx, top] };
}

/** A hard cut across the logo with a hand's edge, a little lower toward the side away from the light. */
function cut(y0: number, amp: number, ph: number): string {
  let d = '';
  for (let x = -10; x <= 360; x += 10) d += `${x < 0 ? 'M' : 'L'}${x} ${f(y0 + amp * Math.sin(x / 23 + ph) + x * 0.02)}`;
  return `${d}L360 200L-10 200Z`;
}

let built = '';

/** The logo as one SVG, sized in em to the box the text used to take, so it scales with the font size. */
export function logoSVG(): string {
  if (built) return built;
  const glyphs = (Object.keys(GLYPHS) as Letter[]).map((ch) => ({ ch, ...glyph(GLYPHS[ch].d, GLYPHS[ch].x * K, 2.2) }));
  const letters = glyphs.map((g) => g.path).join('');
  const loops = glyphs.flatMap((g) => g.loops);

  const outer = recorder();
  const inner = recorder();
  loops.forEach((l, i) => {
    // The ink mass's outer edge, swelling and thinning; then the line where ink meets the fill.
    penLoop(outer.g, l, 11 + i, 0.6, 7, l.hole ? 3 : 6, 0.25, 0.35);
    penLoop(inner.g, l, 41 + i, 0.4, 3.4, 0, 0.35, 0.2);
  });

  // A highlight just inside each letter's lit top edge, along its longest run facing the light.
  const hi = recorder();
  loops.forEach((l, li) => {
    if (l.hole) return;
    const ns = normals(l);
    const n = l.pts.length;
    let best: P[] = [];
    let run: P[] = [];
    for (let i = 0; i < n * 2; i++) {
      const p = l.pts[i % n];
      const nn = ns[i % n];
      if (facing(nn) < -0.6 && p.y < BASE - 62 && run.length < n) {
        run.push({ x: p.x - nn.x * 6, y: p.y - nn.y * 6 });
        if (run.length > best.length) best = run;
      } else run = [];
    }
    if (best.length > 8) stroke(hi.g, best.slice(2, Math.min(best.length - 2, 26)), { w: 3, seed: 90 + li, taper: [0.3, 0.55], press: 0.3 });
  });

  const drips = DRIPS.map(([ch, x, len], i) => ({ ...drip(ch, x, len, glyphs.find((g) => g.ch === ch)!.loops, 70 + i), delay: `${(-i * 0.7).toFixed(1)}s` }));
  // Every copy of a drip (shadow, ink, fill) swings about the same point on the same clock.
  const dripG = (inner: string, dx = 0, dy = 0) =>
    drips
      .map(
        (d) =>
          `<g class="logo-drip" style="transform-origin:${f(d.origin[0] + dx)}px ${f(d.origin[1] + dy)}px;animation-delay:${d.delay}">${inner.replace(/\$d|\$pen/g, (m) => (m === '$d' ? d.d : d.pen))}</g>`,
      )
      .join('');

  built =
    `<svg class="logo-art" viewBox="0 0 ${BOX_W} ${BOX_H}" aria-hidden="true" focusable="false">` +
    `<defs><path id="slag-logo-l" d="${letters}"/><clipPath id="slag-logo-clip"><use href="#slag-logo-l"/></clipPath></defs>` +
    // The hard shadow shape, down and away from the light.
    `<g fill="${SHADOW}" stroke="${SHADOW}" stroke-linejoin="round"><use href="#slag-logo-l" transform="translate(5 9)" stroke-width="13"/>` +
    dripG('<path d="$d" transform="translate(5 9)" stroke-width="5"/>', 5, 9) +
    `</g>` +
    // The ink mass, heavier away from the light, and its pen edge.
    `<g fill="${INK}" stroke="${INK}" stroke-linejoin="round"><use href="#slag-logo-l" stroke-width="12"/><use href="#slag-logo-l" stroke-width="11" transform="translate(1.6 2.6)"/>` +
    dripG('<path d="$d" stroke-width="4.5"/>') +
    `</g><path fill="${INK}" d="${outer.out()}"/>` +
    // Molten fill in three cel bands, its pen line, and the highlights.
    `<g clip-path="url(#slag-logo-clip)"><rect x="-10" y="-10" width="370" height="200" fill="${BANDS[0]}"/>` +
    `<path fill="${BANDS[1]}" d="${cut(52, 2.2, 0.5)}"/><path fill="${BANDS[2]}" d="${cut(86, 2.6, 2.1)}"/></g>` +
    `<path fill="${INK}" d="${inner.out()}"/><path fill="${HIGHLIGHT}" d="${hi.out()}"/>` +
    // Drips over the letters' bottom edge, so they pour out of the letter rather than hang under a line.
    dripG(`<path fill="${BANDS[2]}" d="$d"/><path fill="${INK}" d="$pen"/>`) +
    `</svg>`;
  return built;
}
