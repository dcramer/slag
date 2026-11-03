import { css, type HSL, shift } from '../../../core/color';
import type { CharacterDef } from '../../../gen/character';
import { TILE } from '../../../sim/constants';
import { flingBack, type Grip, KEG, kegAim, type ModuleOf } from '../../../sim/props';
import type { Runner, RunWorld } from '../../../sim/run';
import { drawInkRunner } from '../../ink-character';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { bar, dot, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { type DrawCtx, defineArt, defineHeld, gripOf } from '../common';

type Keg = ModuleOf<'keg'>;

const QUARTER = Math.PI / 4;
const AMBER: HSL = { h: 36, s: 100, l: 59 };
const WHITE_HOT: HSL = { h: 48, s: 100, l: 86 };
/** Half the cask's length (px), hub to mouth. */
const MOUTH = 13;
/** Frames the cask kicks back after firing. */
const RECOIL = 9;

/** Smoothstep-eased angle (radians) of a tipping keg, or the stop it locked to once lit. */
function shownAngle(m: Keg, grip: Grip | undefined, frame: number, phase: number): number {
  if (grip && grip.fuse >= 0) return grip.aim * QUARTER;
  const { from, dir, turn } = kegAim(m, frame, phase);
  const u = turn * turn * (3 - 2 * turn);
  const delta = ((dir - from + 12) % 8) - 4;
  return (from + delta * u) * QUARTER;
}

const fuse: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];
const chev: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/** Three chevrons marching out of the mouth: the way you'll go, readable at gameplay scale without a word. */
function aimChevrons(rc: RC, x: number, y: number, a: number, heat: number, alpha: number) {
  const s = rc.s;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const c = heat > 0 ? WHITE_HOT : AMBER;
  const march = (rc.frame / (heat > 0 ? 4 : 12)) % 1;
  for (let i = 0; i < 3; i++) {
    const r = MOUTH + 8 + (i + march) * 9;
    const px = x + dx * r;
    const py = y + dy * r;
    const fade = alpha * (1 - (i + march) / 4);
    // A cut chevron: two arms meeting in a point, as a filled shape.
    const set = (k: number, u: number, v: number) => {
      chev[k].x = px + dx * u - dy * v;
      chev[k].y = py + dy * u + dx * v;
    };
    for (const [grow, style] of [
      [1.1, inkFor(c, fade)],
      [0, css(c, 0, fade)],
    ] as const) {
      set(0, -4 - grow, -5 - grow);
      set(1, 2 + grow * 1.4, 0);
      set(2, -4 - grow, 5 + grow);
      set(3, -6.4 + grow * 0.2, 5 + grow);
      set(4, -0.6 + grow * 0.2, 0);
      set(5, -6.4 + grow * 0.2, -5 - grow);
      s.fillStyle = style;
      path(s, chev);
      s.fill();
    }
  }
}

/** The cask, baked in its own frame with +x out of the mouth and its lit side up. */
function cask(wood: HSL, pal: MetalPalette) {
  return sprite(`keg|${wood.h | 0}|${pal.base.h},${pal.base.l}`, -MOUTH - 3, -14, MOUTH * 2 + 7, 28, (g) => {
    const top: P[] = [];
    const bot: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = -MOUTH + t * MOUTH * 2;
      const bulge = 8.6 + 3.2 * Math.sin(Math.PI * t);
      top.push({ x, y: -bulge });
      bot.unshift({ x, y: bulge });
    }
    const body = [...top, ...bot];
    tone(g, body, wood, { depth: 2, shade: -18 });
    g.save();
    path(g, body);
    g.clip();
    // A lit band down the top staves, and the stave seams following the bulge, lifted here and there.
    g.fillStyle = css(wood, 12, 1, -4);
    const band: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      band.push({ x: -MOUTH + t * MOUTH * 2, y: -(8.6 + 3.2 * Math.sin(Math.PI * t)) * 0.62 });
    }
    for (let i = 12; i >= 0; i--) {
      const t = i / 12;
      band.push({ x: -MOUTH + t * MOUTH * 2, y: -(8.6 + 3.2 * Math.sin(Math.PI * t)) * 0.36 });
    }
    path(g, band);
    g.fill();
    g.fillStyle = css(wood, -26, 1, 6);
    for (const k of [-0.68, -0.25, 0.2, 0.62]) {
      for (const [t0, t1] of [
        [0.02, 0.3],
        [0.36, 0.62],
        [0.7, 0.98],
      ]) {
        const seg: P[] = [];
        for (let i = 0; i <= 5; i++) {
          const t = t0 + ((t1 - t0) * i) / 5;
          seg.push({ x: -MOUTH + t * MOUTH * 2, y: k * (8.6 + 3.2 * Math.sin(Math.PI * t)) });
        }
        stroke(g, seg, { w: 0.6, seed: k * 10 + t0 * 7, taper: [0.25, 0.3], press: 0.3 });
      }
    }
    // Grain ticks and a knot.
    for (let i = 0; i < 5; i++) tick(g, -9 + i * 4.2, 3 + (i % 2) * 2.4, -7 + i * 4.2, 3.3 + (i % 2) * 2.4, 0.35, i, css(wood, -22));
    g.fillStyle = css(wood, -24);
    blob(g, 6, 5.6, 0.9, 3, 0.6, 0.2);
    g.fill();
    // The moonshine stencil every cartoon jug wears, in chalky paint.
    g.fillStyle = 'rgba(250,236,200,0.9)';
    for (const cx of [-3.8, 0, 3.8]) {
      line(g, cx - 1.5, -2.4, cx + 1.5, 2.4, { w: 1.1, seed: cx, taper: [0.1, 0.1], press: 0.3 });
      line(g, cx + 1.5, -2.4, cx - 1.5, 2.4, { w: 1.1, seed: cx + 1, taper: [0.1, 0.1], press: 0.3 });
    }
    g.restore();
    // Iron hoops, bent round the staves, riveted.
    for (const t of [0.13, 0.87]) {
      const hx = -MOUTH + t * MOUTH * 2;
      const hh = 8.6 + 3.2 * Math.sin(Math.PI * t) + 0.9;
      const hoop = poly(hx - 1.7, -hh, hx + 1.7, -hh, hx + 2.1, 0, hx + 1.7, hh, hx - 1.7, hh, hx - 1.3, 0);
      part(g, hoop, pal.base, t * 100, { depth: 0.6, shade: -24, thin: 0.4, thick: 1 });
      g.fillStyle = css(pal.light, 4);
      line(g, hx - 0.8, -hh + 1, hx - 0.5, -2, { w: 0.6, seed: t, taper: [0.2, 0.4], press: 0 });
      for (const ry of [-hh + 2.4, hh - 2.4]) dot(g, hx + 0.2, ry, 0.5, ry, css(pal.spec), inkFor(pal.base));
    }
    pen(g, body, 5, 0.6, 1.9, 4, inkFor(wood));
    // The mouth: an iron-rimmed bore, dark, its lower wall catching the light.
    const rim = ovalPts(MOUTH + 0.2, 0, 3.2, 9, 8, 0.02, 18);
    part(g, rim, pal.base, 9, { depth: 0.5, shade: -20, thin: 0.5, thick: 1.2 });
    const bore = ovalPts(MOUTH + 0.5, 0.3, 1.9, 7.2, 10, 0.03, 16);
    g.fillStyle = css(wood, -30, 1, 4);
    path(g, bore);
    g.fill();
    g.fillStyle = css(wood, -10);
    path(g, ovalPts(MOUTH + 1.1, 3.2, 0.9, 3.4, 11, 0.03, 10));
    g.fill();
    // The rear head, just showing.
    g.fillStyle = css(wood, -20);
    stroke(g, poly(-MOUTH - 0.6, -7.4, -MOUTH - 1.4, 0, -MOUTH - 0.6, 7.4), { w: 1.3, seed: 12, taper: [0.2, 0.2], press: 0.2 });
  });
}

const RUBBER: HSL = { h: 6, s: 62, l: 42 };
/** The fuse's cord. */
const FUSE: HSL = { h: 41, s: 45, l: 74 };
const LEATHER: HSL = { h: 26, s: 45, l: 34 };
/** How much bigger than its bake the fork is drawn. */
const FORK = 1.3;
/** The fork's tips in its bake, from the middle of its 2×2 box. */
const TIPS: readonly [number, number][] = [
  [-7, -9],
  [7, -9],
];

/** The forked stick, baked: a Y cut from one branch, its stem planted at the bottom of the box. */
function fork(wood: HSL) {
  return sprite(`fling|${wood.h | 0}`, -11, -13, 22, 29, (g) => {
    const stem = poly(-1.9, 15.6, -1.5, 2.4, -7.9, -8.2, -5.9, -9.6, 0, -0.6, 5.9, -9.6, 7.9, -8.2, 1.5, 2.4, 1.9, 15.6);
    part(g, stem, wood, 4, { depth: 0.8, shade: -18, thin: 0.5, thick: 1.4 });
    // Bark knots and the grip's tape wrap.
    for (const y of [6, 8, 10]) tick(g, -1.8, y, 1.8, y + 0.6, 0.5, y, css(wood, 26));
    g.fillStyle = css(wood, -20);
    blob(g, -0.6, 12.4, 0.7, 2, 0.7, 0.2);
    g.fill();
    // The band's knots round each tip.
    for (const [x, y] of TIPS) dot(g, x, y + 0.6, 1.1, x, css(RUBBER, 10), inkFor(RUBBER));
  });
}

const band: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/**
 * Y-Fling (docs/PARODY.md, fling): a forked stick and a rubber band with a leather pouch. Whoever
 * sits in it pulls the pouch back, and the band stretches thinner the further it goes; chevrons out
 * of the pouch show where it will send them, brighter the harder the pull. Snapped, the band hangs in
 * two pieces from the tips until it's grown back.
 */
function drawFling(rc: RC, m: Keg, d: DrawCtx) {
  const s = rc.s;
  const ax = m.at[0] + d.off[0];
  const ay = m.at[1] + d.off[1];
  const grip = gripOf(d);
  const snapped = !!d.o.level && rc.frame < flingBack(d.o.state, d.mi);
  // Drawn a size up from its bake, grown from the foot of its box so the stem stays planted.
  s.save();
  s.translate(ax, ay + TILE);
  s.scale(FORK, FORK);
  stamp(s, fork({ h: d.style.woodHue, s: 46, l: 40 }), 0, -TILE);
  s.restore();
  const tips = TIPS.map(([x, y]) => [x * FORK, TILE + (y - TILE) * FORK] as const);
  if (snapped) {
    for (const [tx, ty] of tips) {
      const sway = Math.sin(rc.t * 3 + tx) * 0.8;
      band[0].x = ax + tx;
      band[0].y = ay + ty;
      band[1].x = ax + tx * 0.9 + sway;
      band[1].y = ay + ty + 3;
      band[2].x = ax + tx * 0.75 + sway * 1.6;
      band[2].y = ay + ty + 6;
      s.fillStyle = css(RUBBER);
      stroke(s, band, { w: 1.2, seed: tx, taper: [0.1, 0.7], press: 0 });
    }
    return;
  }
  const full = Math.max(1, m.charge ?? 1);
  const pull = grip ? Math.min(1, grip.s / full) : 0;
  const px = ax + (grip ? grip.x : 0);
  const py = grip ? ay + grip.y + 3 : ay - 7;
  if (grip) aimChevrons(rc, px, py, grip.aim * QUARTER, pull > 0.99 ? 1 : 0, 0.35 + pull * 0.65);
  for (const [tx, ty] of tips) {
    band[0].x = ax + tx;
    band[0].y = ay + ty;
    band[1].x = (ax + tx + px) / 2;
    band[1].y = (ay + ty + py) / 2 + (1 - pull) * 1.5;
    band[2].x = px + Math.sign(tx) * 2.2;
    band[2].y = py;
    bar(s, band, 1.2 - pull * 0.5, shift(RUBBER, 6), tx + 1, { rim: 0.5 - pull * 0.15, taper: [0, 0], press: 0 });
  }
  const pouch = ovalPts(px, py + 0.6, 3.6, 2, 6, 0.06, 12);
  part(s, pouch, LEATHER, 6, { depth: 0.4, shade: -12, thin: 0.4, thick: 0.9 });
}

/**
 * A moonshine keg with a fuse out of its rear. The fuse burns down while
 * someone's inside, which is the only warning you get. Lit, the cask stops
 * dead on its aim, shakes and swells until it goes off.
 */
defineArt<'keg'>({
  type: 'keg',
  layer: 2,
  draw(rc, m, d) {
    if (m.aim === 'player') return drawFling(rc, m, d);
    const s = rc.s;
    const g = rc.g;
    const grip = gripOf(d);
    const lit = !!grip && grip.fuse >= 0;
    const a = shownAngle(m, grip, rc.frame, d.r.phase);
    const burnt = grip ? Math.min(1, grip.t / m.burn) : 0;
    const swell = lit ? 1 - Math.max(0, grip.fuse) / m.delay : 0;
    // The last third of the fuse shakes the cask too: that's the tell for a backfire.
    const shake = lit ? 0.9 : grip ? Math.max(0, burnt - 0.66) * 2.4 : 0;
    const x = m.at[0] + d.off[0] + (rc.frame & 1 ? shake : -shake);
    const y = m.at[1] + d.off[1] + (rc.frame & 2 ? shake : -shake);
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const kick = since < RECOIL ? (RECOIL - since) * 0.7 : 0;
    const settled = kegAim(m, rc.frame, d.r.phase).turn >= 1;
    aimChevrons(rc, m.at[0] + d.off[0], m.at[1] + d.off[1], a, swell, lit ? 1 : grip ? (settled ? 0.95 : 0.4) : settled ? 0.6 : 0.25);

    s.save();
    s.translate(x, y);
    s.rotate(a);
    s.translate(-kick, 0);
    s.scale(1 + swell * 0.14, 1 + swell * 0.2);
    // Keep the lit staves up whichever way it points.
    if (Math.cos(a) < -1e-6) s.scale(1, -1);
    // The fuse, shortest when it's nearly gone.
    const cord = 9 * (1 - burnt);
    if (cord > 0.3) {
      const f = fuse;
      f[0].x = -MOUTH - 0.5;
      f[0].y = 0;
      f[1].x = -MOUTH - cord * 0.5;
      f[1].y = 2.6;
      f[2].x = -MOUTH - cord;
      f[2].y = 0;
      bar(s, f, 1, FUSE, 2, { rim: 0.5, taper: [0, 0.3], press: 0 });
    }
    stamp(s, cask({ h: d.style.woodHue, s: 50, l: 38 }, d.pal));
    s.restore();

    if (grip) {
      const tx = x - Math.cos(a) * (MOUTH + cord + kick);
      const ty = y - Math.sin(a) * (MOUTH + cord + kick);
      glowDot(g, tx, ty, 6 + burnt * 4, AMBER, 0.9);
      if (rc.frame % 3 === 0) d.o.emit?.('spark', tx, ty, -Math.cos(a) * 40, -Math.sin(a) * 40, AMBER);
    }
    if (lit) {
      const mx = x + Math.cos(a) * MOUTH;
      const my = y + Math.sin(a) * MOUTH;
      glowDot(g, mx, my, 6 + swell * 7, WHITE_HOT, 0.25 + swell * 0.35);
      light(rc, mx, my, 30 + swell * 20, AMBER, 0.3 + swell * 0.4);
    }
  },
});

/** Grip distance (px) at which a runner reads as fully stuffed in. */
const SETTLED = KEG.zone * 0.5;

/** A stuffed runner: the top half of them poking out of the mouth, wherever it points. */
function drawStuffed(rc: RC, run: RunWorld, r: Runner, c: CharacterDef): void {
  const g = r.attach.grip;
  const rp = g && run.resolved.find((x) => x.pp.uid === g.uid);
  const m = g && rp?.mods[g.mi];
  if (!g || !rp || m?.type !== 'keg') return;
  const a = shownAngle(m, g, rc.frame, rp.phase);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hx = m.at[0];
  const hy = m.at[1];
  const out = Math.min(1, Math.sqrt(g.x * g.x + g.y * g.y) / SETTLED);
  const cx = hx + g.x + dx * MOUTH * (1 - out);
  const cy = hy + g.y + dy * MOUTH * (1 - out);
  const s = rc.s;
  s.save();
  s.beginPath();
  // Everything behind the mouth's plane stays hidden inside the cask.
  const nx = hx + dx * MOUTH;
  const ny = hy + dy * MOUTH;
  s.moveTo(nx - dy * 40, ny + dx * 40);
  s.lineTo(nx + dy * 40, ny - dx * 40);
  s.lineTo(nx + dy * 40 + dx * 40, ny - dx * 40 + dy * 40);
  s.lineTo(nx - dy * 40 + dx * 40, ny + dx * 40 + dy * 40);
  s.closePath();
  s.clip();
  drawInkRunner(rc, c, cx, cy + 8, { facing: dx < 0 ? -1 : 1, vx: 0, vy: 0, grounded: true, t: rc.t, scale: 0.9 });
  s.restore();
}

defineHeld('keg', drawStuffed);
