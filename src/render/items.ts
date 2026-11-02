import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { DROP_BLINK, DROP_LIFE, type ItemKind, ROCKET, SHIELD, SWORD } from '../sim/items';
import type { Projectile, Runner, RunWorld } from '../sim/run';
import type { GameEvent } from '../sim/types';
import type { Fx } from './fx';
import { blob, line, type P, stroke } from './ink';
import { ball, boxPts, glint, INK, part, path, pen, poly, sprite, stamp, tick } from './ink-props';
import { circle, ellipse, glowDot, light, type RC } from './kit';

/**
 * Held-item art, inked as the genre staples they mock (docs/PARODY.md, Held items): icons (shared by
 * loose items, hands, the HUD, crates and the codex), runner overlays (the noodle swing, the bubble
 * wrap, the trial jetpack, daze stars), the fog-of-war cloud and event fx. Reads sim state only.
 */

/** Signature color per item (glows, rings, crate reveals). */
export const ITEM_HUE: Record<ItemKind, HSL> = {
  sword: { h: 42, s: 95, l: 60 },
  puck: { h: 205, s: 85, l: 60 },
  boomerang: { h: 18, s: 95, l: 58 },
  shield: { h: 185, s: 95, l: 62 },
  rocket: { h: 355, s: 85, l: 58 },
  smoke: { h: 275, s: 60, l: 62 },
};

const NOODLE: HSL = { h: 96, s: 72, l: 56 };

/** Master Noodle's hilt, point up: pommel, wrapped grip and a hero's crossguard. The blade is drawn live. */
const hilt = () =>
  sprite('it|hilt', -5, 2, 10, 9, (g) => {
    part(g, boxPts(-1.3, 4.6, 2.6, 4.6, 1, 3), { h: 25, s: 45, l: 30 }, 3, { depth: 0.4, thin: 0.35, thick: 0.8 });
    for (const y of [5.6, 6.8, 8]) tick(g, -1.2, y, 1.2, y + 0.5, 0.4, y, css({ h: 25, s: 40, l: 48 }));
    ball(g, 0, 9.6, 1.2, { h: 44, s: 80, l: 52 }, 4);
    part(g, poly(-4.4, 3, -3.4, 2.4, 3.4, 2.4, 4.4, 3, 3.4, 4.7, -3.4, 4.7), { h: 44, s: 80, l: 52 }, 5, { depth: 0.4, thin: 0.35, thick: 0.85 });
  });

/**
 * The noodle blade from (0, 2.6) up to about (0, -9.6), bent sideways by `bend` px at the tip: a fat foam
 * tube, its ridges ticked across, and the hole down its middle showing at the end.
 */
function noodle(s: CanvasRenderingContext2D, bend: number) {
  const pts: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push({ x: bend * t * t, y: 2.6 - t * 12.2 });
  }
  s.fillStyle = INK;
  stroke(s, pts, { w: 5.6, seed: 3, taper: [0, 0], press: 0 });
  s.fillStyle = css(NOODLE, -10, 1, 4);
  stroke(s, pts, { w: 4.2, seed: 3, taper: [0, 0], press: 0 });
  s.fillStyle = css(NOODLE);
  stroke(
    s,
    pts.map((p) => ({ x: p.x - 0.6, y: p.y })),
    { w: 2.6, seed: 4, taper: [0, 0], press: 0 },
  );
  s.fillStyle = css(NOODLE, -26);
  for (let i = 1; i < 8; i++) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    line(s, pts[i].x - nx * 1.9, pts[i].y - ny * 1.9, pts[i].x + nx * 1.9, pts[i].y + ny * 1.9, { w: 0.4, seed: i, taper: [0.2, 0.2], press: 0 });
  }
  const tip = pts[8];
  s.fillStyle = INK;
  s.beginPath();
  s.ellipse(tip.x, tip.y, 2.6, 1.3, Math.atan2(tip.x - pts[7].x, -(tip.y - pts[7].y)), 0, Math.PI * 2);
  s.fill();
  s.fillStyle = css(NOODLE, 12);
  s.beginPath();
  s.ellipse(tip.x, tip.y, 2.05, 0.9, Math.atan2(tip.x - pts[7].x, -(tip.y - pts[7].y)), 0, Math.PI * 2);
  s.fill();
  s.fillStyle = INK;
  s.beginPath();
  s.ellipse(tip.x, tip.y, 0.8, 0.4, Math.atan2(tip.x - pts[7].x, -(tip.y - pts[7].y)), 0, Math.PI * 2);
  s.fill();
}

function masterNoodle(s: CanvasRenderingContext2D, bend: number) {
  noodle(s, bend);
  stamp(s, hilt());
}

/** Evicted Shell: nobody's home. Two empty leg holes, and the notice taped on top. */
const shell = () =>
  sprite('it|shell', -7, -8, 14, 12, (g) => {
    const dome: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      dome.push({ x: Math.cos(a) * 5.8, y: 1.2 + Math.sin(a) * 5 });
    }
    const green: HSL = { h: 128, s: 50, l: 44 };
    part(g, dome, green, 3, { depth: 0.8, thin: 0.45, thick: 1.1 });
    g.save();
    path(g, dome);
    g.clip();
    const sc = css(green, -22);
    for (const [ax, ay, bx, by] of [
      [-2.2, -3.8, -3.2, 1.2],
      [2.2, -3.8, 3.2, 1.2],
      [-2.2, -3.8, 2.2, -3.8],
      [-4.4, -1.6, -2.9, -1.4],
      [4.4, -1.6, 2.9, -1.4],
    ])
      tick(g, ax, ay, bx, by, 0.45, ax * 3 + ay, sc);
    g.restore();
    part(g, boxPts(-6.3, 0.8, 12.6, 2.2, 1, 4), { h: 48, s: 55, l: 78 }, 4, { depth: 0.3, thin: 0.4, thick: 0.9 });
    for (const x of [-3.2, 3.2]) {
      g.fillStyle = INK;
      blob(g, x, 1.9, 1.05, 5 + x, 0.65, 0.1);
      g.fill();
    }
    // The eviction notice.
    g.save();
    g.translate(0.6, -4.2);
    g.rotate(-0.18);
    part(g, boxPts(-2.1, -1.6, 4.2, 3.2, 0.2, 6), { h: 45, s: 20, l: 95 }, 6, { depth: 0.2, thin: 0.25, thick: 0.5 });
    g.fillStyle = '#c62424';
    g.fillRect(-1.7, -1.2, 3.4, 0.7);
    for (const y of [0, 0.8]) tick(g, -1.5, y, 1.3, y, 0.25, y * 9, 'rgba(40,30,30,0.7)');
    g.fillStyle = 'rgba(255,236,170,0.75)';
    g.fillRect(-2.6, -2, 1.4, 0.8);
    g.fillRect(1.3, 1.1, 1.4, 0.8);
    g.restore();
  });

/** Stunnerang: a banana-shaped boomerang, point down the middle. */
export const stunnerang = () =>
  sprite('it|rang', -7, -5, 14, 9, (g) => {
    const top: P[] = [];
    const bot: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = -6 + t * 12;
      const arch = Math.sin(t * Math.PI);
      top.push({ x, y: 1.6 - arch * 4.6 });
      bot.unshift({ x, y: 1.6 - arch * 2.2 + (1 - arch) * 0.6 });
    }
    part(g, [...top, ...bot], { h: 40, s: 85, l: 56 }, 7, { depth: 0.5, thin: 0.45, thick: 1 });
    tick(g, -0.8, -2.7, 0.8, -2.7, 0.9, 8, '#d8402e');
    glint(g, poly(-4.4, 0, -2.6, -2.1, -0.4, -2.8), 'rgba(255,245,210,0.85)', 0.5);
  });

/** Bubble Wrap, folded into an icon: a square sheet of bubbles. */
const wrap = () =>
  sprite('it|wrap', -7, -7, 14, 14, (g) => {
    const sheet = boxPts(-5.6, -5.6, 11.2, 11.2, 0.6, 9);
    g.fillStyle = 'rgba(214,240,250,0.75)';
    path(g, sheet);
    g.fill();
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const x = -3.6 + i * 3.6;
        const y = -3.6 + j * 3.6;
        ball(g, x, y, 1.3, { h: 190, s: 45, l: 84 }, i * 3 + j, '#ffffff');
      }
    pen(g, sheet, 10, 0.35, 0.8, 3, 'rgba(30,60,80,0.9)');
  });

/** Free-Trial Jetpack: twin tanks on a back plate, nozzles under them, a TRIAL sticker slapped on one. */
const jetpack = () =>
  sprite('it|jet', -7, -8.5, 14, 17, (g) => {
    const red: HSL = { h: 356, s: 70, l: 50 };
    part(g, boxPts(-1.2, -5, 2.4, 9, 0.6, 10), { h: 210, s: 8, l: 40 }, 10, { depth: 0.3, thin: 0.35, thick: 0.7 });
    for (const x of [-3.4, 3.4]) {
      const tank = boxPts(x - 2.4, -6.8, 4.8, 11, 2.4, 11 + x);
      part(g, tank, red, 11 + x, { depth: 0.7, thin: 0.45, thick: 1 });
      glint(g, poly(x - 1.4, -4.6, x - 1.5, -1, x - 1.4, 2), 'rgba(255,215,210,0.9)', 0.55);
      part(g, poly(x - 1.3, 4.2, x + 1.3, 4.2, x + 1.9, 6.6, x - 1.9, 6.6), { h: 210, s: 8, l: 52 }, 12 + x, { depth: 0.3, thin: 0.3, thick: 0.7 });
    }
    g.save();
    g.translate(3.4, -0.6);
    g.rotate(-0.35);
    part(g, boxPts(-2.9, -1.2, 5.8, 2.4, 0.3, 13), { h: 50, s: 95, l: 58 }, 13, { depth: 0.2, thin: 0.3, thick: 0.55 });
    g.fillStyle = '#1b1410';
    g.font = 'bold 1.9px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TRIAL', 0, 0);
    g.restore();
  });

/** Fog of War, before it goes off: a round smoke bomb with a short fuse. */
const fogBomb = () =>
  sprite('it|fog', -6, -7, 12, 13, (g) => {
    ball(g, 0, 1, 4.6, { h: 268, s: 16, l: 30 }, 14);
    part(g, boxPts(-1.4, -4.6, 2.8, 1.8, 0.4, 15), { h: 210, s: 8, l: 50 }, 15, { depth: 0.2, thin: 0.3, thick: 0.6 });
    // A little map grid on it: it's the fog off a map.
    g.save();
    g.beginPath();
    g.arc(0, 1, 4.6, 0, Math.PI * 2);
    g.clip();
    for (let k = -4; k <= 4; k += 2) {
      tick(g, k, -4, k, 6, 0.3, k, 'rgba(200,190,255,0.35)');
      tick(g, -5, 1 + k, 5, 1 + k, 0.3, k + 9, 'rgba(200,190,255,0.35)');
    }
    g.restore();
    g.fillStyle = INK;
    stroke(g, poly(0.4, -4.6, 1.8, -6.2, 3.6, -6), { w: 1.4, seed: 16, taper: [0, 0.3], press: 0 });
    g.fillStyle = '#b08a5a';
    stroke(g, poly(0.4, -4.6, 1.8, -6.2, 3.6, -6), { w: 0.6, seed: 16, taper: [0, 0.3], press: 0 });
  });

type Icon = (s: CanvasRenderingContext2D, t: number) => void;

/** Icons are drawn around (0, 0) in a ~14 px box, facing +x. */
const ICONS: Record<ItemKind, Icon> = {
  sword(s) {
    s.save();
    s.rotate(0.6);
    s.translate(0, 1);
    s.scale(0.92, 0.92);
    masterNoodle(s, 0.8);
    s.restore();
  },
  puck(s) {
    stamp(s, shell());
  },
  boomerang(s) {
    stamp(s, stunnerang());
  },
  shield(s) {
    stamp(s, wrap());
  },
  rocket(s) {
    stamp(s, jetpack());
  },
  smoke(s, t) {
    stamp(s, fogBomb());
    s.fillStyle = Math.sin(t * 30) > 0 ? '#ffd36a' : '#ff7a2a';
    circle(s, 3.7, -6, 0.9);
  },
};

/** Draw an item icon centered at (x, y), scaled by k, mirrored when facing left. */
export function drawItemIcon(s: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number, k = 1, t = 0, facing = 1, rot = 0): void {
  s.save();
  s.translate(x, y);
  s.scale(k * (facing < 0 ? -1 : 1), k);
  if (rot) s.rotate(rot);
  ICONS[kind](s, t);
  s.restore();
}

/** Loose items: a bobbing icon on a glow halo, blinking before they fizzle. */
export function drawDrops(rc: RC, run: RunWorld): void {
  for (const d of run.items.drops) {
    const left = DROP_LIFE - (run.frame - d.born);
    if (left < DROP_BLINK && Math.floor(left / (left < 40 ? 3 : 6)) % 2 === 0) continue;
    const col = ITEM_HUE[d.kind];
    const y = d.y + (d.onGround ? Math.sin(rc.t * 4 + d.id) * 1.2 - 1.5 : 0);
    glowDot(rc.g, d.x, y, 13, col, 0.4);
    rc.s.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(rc.s, d.x, d.y + 5, 4.5, 1.2);
    drawItemIcon(rc.s, d.kind, d.x, y, 1, rc.t);
    // A twinkle, so items read as pick-ups and not scenery.
    const tw = (rc.t * 1.3 + d.id * 0.37) % 1;
    if (tw < 0.25) {
      const a = Math.sin((tw / 0.25) * Math.PI);
      rc.g.fillStyle = css(col, 30, a);
      const sx = d.x + 4;
      const sy = y - 5;
      line(rc.g, sx - 2.5 * a, sy, sx + 2.5 * a, sy, { w: 1, seed: 1, taper: [0.3, 0.3], press: 0 });
      line(rc.g, sx, sy - 2.5 * a, sx, sy + 2.5 * a, { w: 1, seed: 2, taper: [0.3, 0.3], press: 0 });
    }
    light(rc, d.x, y, 26, col, 0.25);
  }
}

function drawSword(rc: RC, r: Runner, cxp: number): void {
  const it = r.items;
  const b = r.body;
  const fc = b.facing;
  const s = rc.s;
  // Rests on the shoulder; a swing sweeps from behind the head down in front.
  const u = it.swing > 0 ? 1 - it.swing / SWORD.swing : -1;
  const ang = u < 0 ? 0.5 : -1.1 + Math.min(1, u * 1.6) * 3;
  // It's foam: it lags behind the swing, then flops back past straight and settles.
  const bend = u < 0 ? 0.8 : u < 0.62 ? -5 * Math.sin((u / 0.62) * Math.PI * 0.5) : 5 * Math.sin(((u - 0.62) / 0.38) * Math.PI * 2.5) * (1 - (u - 0.62) / 0.38);
  s.save();
  s.translate(cxp + fc * 3, b.y + 7);
  s.scale(fc, 1);
  s.rotate(ang);
  s.translate(0, -9);
  masterNoodle(s, bend);
  s.restore();
  if (it.swing >= SWORD.activeLo && it.swing <= SWORD.activeHi) {
    const g = rc.g;
    g.save();
    g.translate(cxp + fc * 3, b.y + 7);
    g.scale(fc, 1);
    g.strokeStyle = 'rgba(190,255,150,0.55)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 0, 15, -Math.PI / 2 - 1.1, -Math.PI / 2 + ang);
    g.stroke();
    g.restore();
  }
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.4 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** Stars that circle something dazed, or a Stunnerang in flight. */
export function dazeStars(g: CanvasRenderingContext2D, x: number, y: number, t: number, rx = 6, ry = 2) {
  g.fillStyle = 'rgba(255,230,120,0.9)';
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + (i * Math.PI * 2) / 3;
    star(g, x + Math.cos(a) * rx, y + Math.sin(a) * ry, 2);
  }
}

/**
 * Bubble Wrap round a runner: a sheet of bubbles. After a hit (`popped` 0..1 through the guard) its
 * cells pop one by one, each leaving a little burst.
 */
function bubbleWrap(rc: RC, x: number, cy: number, slot: number, popped: number) {
  const s = rc.s;
  const g = rc.g;
  const wob = Math.sin(rc.t * 6 + slot) * 0.6;
  const rx = 11 + wob;
  const ry = 11 - wob;
  if (popped <= 0) {
    s.fillStyle = 'rgba(200,236,248,0.16)';
    ellipse(s, x, cy, rx, ry);
  }
  s.save();
  s.beginPath();
  s.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
  s.clip();
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      const bx = x + i * 3.6 + (j % 2 ? 1.8 : 0);
      const by = cy + j * 3.4;
      if ((bx - x) ** 2 / (rx * rx) + (by - cy) ** 2 / (ry * ry) > 0.92) continue;
      const order = hash2(i, j, slot);
      if (order < popped) {
        // Popped: a flat ring and, just after, a burst.
        if (order > popped - 0.15) {
          g.fillStyle = 'rgba(255,255,255,0.9)';
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + order * 6;
            line(g, bx + Math.cos(a) * 1.2, by + Math.sin(a) * 1.2, bx + Math.cos(a) * 2.6, by + Math.sin(a) * 2.6, {
              w: 0.5,
              seed: k,
              taper: [0.1, 0.6],
              press: 0,
            });
          }
        }
        continue;
      }
      s.fillStyle = 'rgba(225,248,255,0.4)';
      circle(s, bx, by, 1.45);
      s.fillStyle = 'rgba(255,255,255,0.85)';
      circle(s, bx - 0.5, by - 0.55, 0.45);
    }
  s.restore();
  if (popped <= 0) {
    g.strokeStyle = 'rgba(160,236,255,0.6)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
    light(rc, x, cy, 30, ITEM_HUE.shield, 0.35);
  }
}

/** The trial jetpack's flame: one big flame that runs out in a puff, a price tag dangling under it. */
function trialFlame(rc: RC, fx: number, fy: number, k: number, fc: number) {
  const g = rc.g;
  const len = (6 + Math.sin(rc.t * 40) * 1.2) * k;
  glowDot(g, fx, fy + 2, 15, { h: 30, s: 100, l: 60 }, 0.9);
  g.fillStyle = 'rgba(255,240,200,0.9)';
  ellipse(g, fx, fy + len * 0.5, 2.1, len * 0.6);
  // The puff it ends in.
  const s = rc.s;
  const py = fy + len + 2.6;
  s.fillStyle = INK;
  for (const [ox, r] of [
    [-1.6, 1.7],
    [0.4, 2.1],
    [2, 1.5],
  ]) {
    s.beginPath();
    s.arc(fx + ox, py, r + 0.55, 0, Math.PI * 2);
    s.fill();
  }
  s.fillStyle = '#e9e4dc';
  for (const [ox, r] of [
    [-1.6, 1.7],
    [0.4, 2.1],
    [2, 1.5],
  ]) {
    s.beginPath();
    s.arc(fx + ox, py, r, 0, Math.PI * 2);
    s.fill();
  }
  // The price tag, on a string, swinging.
  const sw = Math.sin(rc.t * 9) * 1.4;
  const tx = fx + fc * 4 + sw;
  const ty = fy + 4.5;
  s.fillStyle = 'rgba(240,232,214,0.95)';
  line(s, fx + fc * 2.6, fy - 1.5, tx, ty - 1.2, { w: 0.4, seed: 3, taper: [0, 0], press: 0 });
  s.save();
  s.translate(tx, ty);
  s.rotate(sw * 0.15);
  s.fillStyle = INK;
  path(s, poly(-1.9, -1.6, 1.9, -1.6, 1.9, 1.8, -1.9, 1.8, -2.6, 0.1));
  s.fill();
  s.fillStyle = '#fbe9a6';
  path(s, poly(-1.4, -1.1, 1.4, -1.1, 1.4, 1.3, -1.4, 1.3, -1.9, 0.1));
  s.fill();
  s.fillStyle = '#9a1c14';
  s.fillRect(-0.9, -0.5, 1.9, 0.5);
  s.fillRect(-0.9, 0.3, 1.3, 0.4);
  s.restore();
  light(rc, fx, fy, 70, { h: 30, s: 100, l: 60 }, 1);
}

/** The held item and item effects on one live runner (drawn over the character). */
export function drawRunnerItems(rc: RC, r: Runner): void {
  const s = rc.s;
  const g = rc.g;
  const b = r.body;
  const it = r.items;
  const x = b.x + b.w / 2;
  const fc = b.facing;
  const h = it.held;
  if (h?.kind === 'sword' || it.swing > 0) drawSword(rc, r, x);
  else if (h?.kind === 'shield') bubbleWrap(rc, x, b.y + b.h / 2, r.slot, 0);
  else if (h?.kind === 'rocket' || it.thrust > 0) drawItemIcon(s, 'rocket', x - fc * 6, b.y + 8, 0.9, rc.t, fc);
  else if (h) drawItemIcon(s, h.kind, x + fc * 8, b.y + 8, 0.95, rc.t, fc);
  if (it.thrust > 0) trialFlame(rc, x - fc * 6, b.y + 15.5, 0.6 + (it.thrust / ROCKET.thrust) * 0.4, fc);
  if (it.guard > 0) bubbleWrap(rc, x, b.y + b.h / 2, r.slot, 1 - it.guard / SHIELD.guard + 0.05);
  if (it.daze > 0) dazeStars(g, x, b.y - 4, rc.t);
}

/**
 * Fog of War: the cloud is unexplored map. It's made of whole square tiles on a fixed world grid, so its
 * edge is the hard, blocky edge of a strategy map's fog; tiles fill in from the middle as it spreads and
 * clear from the edge as it lifts.
 */
export function drawClouds(rc: RC, run: RunWorld): void {
  const s = rc.s;
  const T = 5;
  for (const c of run.items.clouds) {
    const fadeIn = Math.min(1, (run.frame - c.born) / 12);
    const a = Math.min(fadeIn, (c.until - run.frame) / 40);
    if (a <= 0) continue;
    const R = c.r * (0.55 + 0.45 * fadeIn);
    const x0 = Math.floor((c.x - R - T) / T);
    const x1 = Math.ceil((c.x + R + T) / T);
    const y0 = Math.floor((c.y - R * 0.8 - T) / T);
    const y1 = Math.ceil((c.y + R * 0.8 + T) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const cx = (tx + 0.5) * T;
        const cy = (ty + 0.5) * T;
        const d = Math.hypot(cx - c.x, (cy - c.y) / 0.8) / R;
        // Each tile has its own threshold, so the edge is ragged by whole tiles.
        const edge = 0.78 + hash2(tx, ty, 41) * 0.3;
        if (d > edge * Math.min(1, a * 1.4 + 0.2)) continue;
        const shade = hash2(tx, ty, 43);
        s.fillStyle = `hsl(258 ${14 + shade * 6}% ${11 + shade * 5}%)`;
        s.fillRect(tx * T, ty * T, T + 0.05, T + 0.05);
        s.fillStyle = 'rgba(150,140,190,0.13)';
        s.fillRect(tx * T, ty * T, T, 0.35);
        s.fillRect(tx * T, ty * T, 0.35, T);
      }
  }
}

/** Held-item shots in flight (the projectile art registry points here; boomerangs are ordinary launcher art). */
export function drawItemShot(rc: RC, p: Projectile): void {
  if (p.ammo === 'smokebomb') return drawItemIcon(rc.s, 'smoke', p.x, p.y, 0.8, rc.t, 1, rc.t * 8);
  // The shell slides on its rim, spinning; its notice flutters on top.
  glowDot(rc.g, p.x, p.y, 10, ITEM_HUE.puck, 0.3);
  drawItemIcon(rc.s, 'puck', p.x, p.y, 0.85, rc.t, p.vx < 0 ? -1 : 1);
  rc.g.fillStyle = 'rgba(160,210,255,0.3)';
  line(rc.g, p.x, p.y + 1, p.x - p.vx * 0.05, p.y + 1, { w: 2, seed: 1, taper: [0.1, 0.9], press: 0 });
}

type ItemEvent = Extract<GameEvent, { type: 'item' }>;
const GOLD: HSL = { h: 48, s: 100, l: 70 };
const WHITE: HSL = { h: 0, s: 0, l: 100 };

/** Particles and shake per item moment. */
const ITEM_FX: Partial<Record<ItemEvent['what'], (fx: Fx, e: ItemEvent, col: HSL, shake: (k: number) => void) => void>> = {
  pop(fx, e, col, shake) {
    fx.add('ring', e.x, e.y, 0, 0, GOLD, 22, 0.35);
    fx.add('flash', e.x, e.y, 0, 0, col, 18, 0.2);
    fx.burst('confetti', e.x, e.y - 4, 12, 120, [col, GOLD, WHITE], 1.1, 0.8, 80);
    shake(2);
  },
  pickup(fx, e, col) {
    fx.add('ring', e.x, e.y, 0, 0, col, 14, 0.3);
    fx.burst('spark', e.x, e.y, 6, 80, [col], 0.8, 0.3);
  },
  block(fx, e, col, shake) {
    fx.add('ring', e.x, e.y, 0, 0, col, 30, 0.4);
    fx.add('flash', e.x, e.y, 0, 0, col, 26, 0.25);
    fx.burst('spark', e.x, e.y, 18, 200, [col, WHITE], 1.1, 0.5);
    shake(4);
  },
  smoke(fx, e, _col, shake) {
    const grey = [
      { h: 265, s: 10, l: 45 },
      { h: 265, s: 10, l: 35 },
    ];
    fx.burst('smoke', e.x, e.y, 14, 70, grey, 3.5, 1.4);
    fx.add('flash', e.x, e.y, 0, 0, { h: 280, s: 40, l: 70 }, 24, 0.2);
    shake(3);
  },
  hit(fx, e, _col, shake) {
    fx.add('flash', e.x, e.y, 0, 0, GOLD, 16, 0.18);
    fx.burst('spark', e.x, e.y, 12, 180, [GOLD, WHITE], 1, 0.35);
    shake(4);
  },
  catch(fx, e, col) {
    fx.add('ring', e.x, e.y, 0, 0, col, 10, 0.25);
  },
  use(fx, e, _col, shake) {
    if (e.kind !== 'rocket') return fx.burst('dust', e.x, e.y, 4, 40, [{ h: 0, s: 0, l: 85 }], 1, 0.3);
    fx.burst('smoke', e.x, e.y, 12, 60, [{ h: 0, s: 0, l: 60 }], 2.6, 1);
    fx.add('flash', e.x, e.y, 0, 0, { h: 30, s: 100, l: 60 }, 22, 0.2);
    shake(3);
  },
  fizzle(fx, e) {
    fx.burst('smoke', e.x, e.y, 5, 25, [{ h: 0, s: 0, l: 70 }], 1.6, 0.7);
  },
};

export function itemFx(fx: Fx, e: ItemEvent, shake: (k: number) => void): void {
  ITEM_FX[e.what]?.(fx, e, (ITEM_HUE as Record<string, HSL>)[e.kind] ?? GOLD, shake);
}
