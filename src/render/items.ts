import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { DROP_BLINK, DROP_LIFE, type ItemKind, ROCKET, SWORD } from '../sim/items';
import type { Projectile, Runner, RunWorld } from '../sim/run';
import type { GameEvent } from '../sim/types';
import type { Fx } from './fx';
import { circle, ellipse, glowDot, light, type RC, rrect, sphereFill } from './kit';
import { drawBoomerang } from './props/common';

/**
 * Held-item art: icons (shared by loose items, hands, the HUD, crates and the
 * codex), runner overlays (held item, sword swing, shield bubble, rocket
 * flame, daze stars), smoke clouds and event fx. Reads sim state only.
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

type Icon = (s: CanvasRenderingContext2D, t: number) => void;

/** A chunky foam blade, point up, around (0, 0). */
function foamSword(s: CanvasRenderingContext2D) {
  s.fillStyle = '#5a3a24';
  rrect(s, -1.3, 4.5, 2.6, 5, 1);
  s.fill();
  s.fillStyle = '#e8402f';
  rrect(s, -3.8, 3, 7.6, 2.2, 1);
  s.fill();
  const gr = s.createLinearGradient(-3, 0, 3, 0);
  gr.addColorStop(0, '#ffe08a');
  gr.addColorStop(1, '#f0a02e');
  s.fillStyle = gr;
  rrect(s, -2.6, -9, 5.2, 12.2, [2.6, 2.6, 0.6, 0.6]);
  s.fill();
  s.strokeStyle = 'rgba(70,35,10,0.8)';
  s.lineWidth = 0.7;
  s.stroke();
  s.fillStyle = 'rgba(255,255,255,0.55)';
  rrect(s, -1.6, -7.5, 1.1, 9, 0.5);
  s.fill();
}

/** Icons are drawn around (0, 0) in a ~14 px box, facing +x. */
const ICONS: Record<ItemKind, Icon> = {
  sword(s) {
    s.save();
    s.rotate(0.6);
    foamSword(s);
    s.restore();
  },
  puck(s) {
    s.fillStyle = '#1f2330';
    rrect(s, -5.5, -1.5, 11, 4, 2);
    s.fill();
    s.fillStyle = '#3a8fd9';
    s.fillRect(-5.5, 0, 11, 1.2);
    s.fillStyle = '#3b4252';
    ellipse(s, 0, -1.5, 5.5, 2);
    s.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(s, -1.5, -2, 2.2, 0.7);
  },
  boomerang(s) {
    drawBoomerang(s, 0, 0, Math.PI / 2, 6);
  },
  shield(s, t) {
    const r = 5.5 + Math.sin(t * 5) * 0.3;
    const gr = s.createRadialGradient(-1.8, -1.8, 0.5, 0, 0, r);
    gr.addColorStop(0, 'rgba(230,255,255,0.95)');
    gr.addColorStop(0.5, 'rgba(90,220,235,0.6)');
    gr.addColorStop(1, 'rgba(30,140,190,0.85)');
    s.fillStyle = gr;
    circle(s, 0, 0, r);
    s.strokeStyle = 'rgba(210,255,255,0.9)';
    s.lineWidth = 0.8;
    s.beginPath();
    s.arc(0, 0, r - 0.4, 0, Math.PI * 2);
    s.stroke();
    s.fillStyle = '#fff';
    ellipse(s, -2, -2.3, 1.4, 0.8, -0.6);
  },
  rocket(s) {
    s.save();
    s.rotate(-Math.PI / 2);
    s.fillStyle = '#9aa3b2';
    s.beginPath();
    s.moveTo(-4, -4.5);
    s.lineTo(-6.5, -6);
    s.lineTo(-6.5, 6);
    s.lineTo(-4, 4.5);
    s.fill();
    const gr = s.createLinearGradient(0, -3, 0, 3);
    gr.addColorStop(0, '#ff8a7a');
    gr.addColorStop(1, '#a3192a');
    s.fillStyle = gr;
    rrect(s, -5, -2.8, 8, 5.6, 1.2);
    s.fill();
    s.fillStyle = '#e8ecf2';
    s.beginPath();
    s.moveTo(3, -2.8);
    s.quadraticCurveTo(7, 0, 3, 2.8);
    s.fill();
    s.fillStyle = '#2b3140';
    s.fillRect(-6.2, -1.6, 1.4, 3.2);
    s.restore();
  },
  smoke(s, t) {
    s.fillStyle = sphereFill(s, 0, 1, 4.6, { h: 270, s: 18, l: 34 }, 30, 15);
    circle(s, 0, 1, 4.6);
    s.strokeStyle = '#c9b8ff';
    s.lineWidth = 0.9;
    s.beginPath();
    s.arc(0, 1, 2, 0.4, Math.PI * 1.6);
    s.stroke();
    s.strokeStyle = '#6d6252';
    s.lineWidth = 1;
    s.beginPath();
    s.moveTo(1.5, -3);
    s.quadraticCurveTo(3, -5.5, 4.5, -5);
    s.stroke();
    s.fillStyle = Math.sin(t * 30) > 0 ? '#ffd36a' : '#ff7a2a';
    circle(s, 4.6, -5.2, 0.9);
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
      rc.g.strokeStyle = css(col, 30, a);
      rc.g.lineWidth = 1;
      const sx = d.x + 4;
      const sy = y - 5;
      rc.g.beginPath();
      rc.g.moveTo(sx - 2.5 * a, sy);
      rc.g.lineTo(sx + 2.5 * a, sy);
      rc.g.moveTo(sx, sy - 2.5 * a);
      rc.g.lineTo(sx, sy + 2.5 * a);
      rc.g.stroke();
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
  s.save();
  s.translate(cxp + fc * 3, b.y + 7);
  s.scale(fc, 1);
  s.rotate(ang);
  s.translate(0, -9);
  foamSword(s);
  s.restore();
  if (it.swing >= SWORD.activeLo && it.swing <= SWORD.activeHi) {
    const g = rc.g;
    g.save();
    g.translate(cxp + fc * 3, b.y + 7);
    g.scale(fc, 1);
    g.strokeStyle = 'rgba(255,225,150,0.6)';
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
  else if (h?.kind === 'shield') {
    const wob = Math.sin(rc.t * 6 + r.slot) * 0.6;
    const cy = b.y + b.h / 2;
    s.fillStyle = 'rgba(120,230,240,0.16)';
    ellipse(s, x, cy, 11 + wob, 11 - wob);
    g.strokeStyle = 'rgba(140,240,255,0.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x, cy, 11 + wob, 11 - wob, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(230,255,255,0.6)';
    ellipse(g, x - 4.5, cy - 6, 2.4, 1.1, -0.6);
    light(rc, x, cy, 30, ITEM_HUE.shield, 0.35);
  } else if (h?.kind === 'rocket' || it.thrust > 0) drawItemIcon(s, 'rocket', x - fc * 6, b.y + 7, 1, rc.t);
  else if (h) drawItemIcon(s, h.kind, x + fc * 8, b.y + 8, 0.95, rc.t, fc);
  if (it.thrust > 0) {
    const fy = b.y + 17;
    const fx = x - fc * 6;
    const k = 0.6 + (it.thrust / ROCKET.thrust) * 0.4;
    glowDot(g, fx, fy, 15, { h: 30, s: 100, l: 60 }, 0.9);
    g.fillStyle = 'rgba(255,240,200,0.9)';
    ellipse(g, fx, fy + 2, 2, (5 + Math.random() * 3) * k);
    light(rc, fx, fy, 70, { h: 30, s: 100, l: 60 }, 1);
  }
  if (it.guard > 0 && Math.floor(it.guard / 3) % 2 === 0) {
    g.strokeStyle = 'rgba(160,250,255,0.6)';
    g.setLineDash([2, 3]);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, b.y + b.h / 2, 12, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  if (it.daze > 0) {
    g.fillStyle = 'rgba(255,230,120,0.9)';
    for (let i = 0; i < 3; i++) {
      const a = rc.t * 6 + (i * Math.PI * 2) / 3;
      star(g, x + Math.cos(a) * 6, b.y - 4 + Math.sin(a) * 2, 2);
    }
  }
}

/** Smoke clouds: dense, slowly churning puffs that hide what's inside (drawn over runners). */
export function drawClouds(rc: RC, run: RunWorld): void {
  const s = rc.s;
  for (const c of run.items.clouds) {
    const fadeIn = Math.min(1, (run.frame - c.born) / 12);
    const a = Math.min(fadeIn, (c.until - run.frame) / 40);
    const grow = 0.55 + 0.45 * fadeIn;
    for (let i = 0; i < 14; i++) {
      const ang = hash2(i, c.born, 7) * Math.PI * 2 + rc.t * (0.25 + hash2(i, 3, c.born) * 0.3) * (i % 2 ? 1 : -1);
      const d = c.r * grow * (0.15 + hash2(i, 11, c.born) * 0.6);
      const px = c.x + Math.cos(ang) * d;
      const py = c.y + Math.sin(ang) * d * 0.75;
      const pr = c.r * grow * (0.3 + hash2(i, 5, c.born) * 0.25);
      const l = 20 + hash2(i, 9, c.born) * 14;
      const gr = s.createRadialGradient(px, py - pr * 0.3, pr * 0.1, px, py, pr);
      gr.addColorStop(0, `hsla(265,12%,${l + 12}%,${0.92 * a})`);
      gr.addColorStop(0.7, `hsla(265,10%,${l}%,${0.85 * a})`);
      gr.addColorStop(1, `hsla(265,10%,${l - 5}%,0)`);
      s.fillStyle = gr;
      circle(s, px, py, pr);
    }
  }
}

/** Held-item shots in flight (the projectile art registry points here; boomerangs are ordinary launcher art). */
export function drawItemShot(rc: RC, p: Projectile): void {
  if (p.ammo === 'smokebomb') return drawItemIcon(rc.s, 'smoke', p.x, p.y, 0.8, rc.t, 1, rc.t * 8);
  glowDot(rc.g, p.x, p.y, 10, ITEM_HUE.puck, 0.35);
  drawItemIcon(rc.s, 'puck', p.x, p.y, 0.8, rc.t);
  rc.g.strokeStyle = 'rgba(160,210,255,0.3)';
  rc.g.lineWidth = 2;
  rc.g.beginPath();
  rc.g.moveTo(p.x, p.y + 1);
  rc.g.lineTo(p.x - p.vx * 0.05, p.y + 1);
  rc.g.stroke();
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
