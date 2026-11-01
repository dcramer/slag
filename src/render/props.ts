import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import type { Cell, Vec } from '../core/geom';
import { AMMO, type Module, type PropDef, type PropStyle } from '../gen/props';
import { TILE } from '../sim/constants';
import { tileAt, type Level } from '../sim/level';
import {
  dirOf,
  fanZone,
  flameCycle,
  laserAngle,
  laserCycle,
  launcherAngle,
  motionOffset,
  pistonHead,
  pistonState,
  rayToWall,
  resolveProp,
  swingHeads,
  teslaCycle,
  type PlacedProp,
  type Resolved,
} from '../sim/props';
import type { Projectile, PropState } from '../sim/run';
import { circle, ellipse, glowDot, hazardStripes, light, lightning, metalFill, METALS, rivet, rrect, sphereFill, type MetalPalette, type RC } from './kit';
import { flame } from './terrain';

export type Emit = (kind: 'spark' | 'smoke' | 'ember' | 'debris', x: number, y: number, vx: number, vy: number, color?: HSL) => void;

export interface PropDrawOpts {
  level: Level | null;
  state?: PropState;
  broken?: boolean;
  showPath?: boolean;
  emit?: Emit;
}

type M<T extends Module['type']> = Extract<Module, { type: T }>;

/** Draw a resolved, placed prop at the rc's frame. */
export function drawResolved(rc: RC, r: Resolved, o: PropDrawOpts): void {
  const f = rc.frame;
  const off = motionOffset(r, f);
  const st = r.pp.def.style;
  const pal = METALS[st.metal];
  if (o.showPath) drawPath(rc, r);
  // Emitter effects and moving parts sit on top of bodies.
  for (const m of r.mods) if (m.type === 'piston') drawPistonShaft(rc, m, r, off, pal);
  for (const m of r.mods) if (m.type === 'body') drawBody(rc, m, st, pal, off, r, o);
  for (const m of r.mods) if (m.type === 'spikes') drawSpikes(rc, m, off, pal);
  for (const m of r.mods) {
    switch (m.type) {
      case 'swinger':
        drawSwinger(rc, m, r, off, pal, st, o);
        break;
      case 'launcher':
        drawLauncher(rc, m, r, off, pal, st, o);
        break;
      case 'flame':
        drawFlame(rc, m, r, off, pal, st, o);
        break;
      case 'laser':
        drawLaser(rc, m, r, off, pal, st, o);
        break;
      case 'tesla':
        drawTesla(rc, m, r, off, pal, st, o);
        break;
      case 'piston':
        drawPistonHead(rc, m, r, off, pal);
        break;
      case 'spring':
        drawSpring(rc, m, off, st, o);
        break;
      case 'fan':
        drawFan(rc, m, off, pal, st, o);
        break;
      case 'bomb':
        drawBomb(rc, r.pp.tx * TILE + TILE / 2, r.pp.ty * TILE + TILE / 2, m.radius);
        break;
      default:
        break;
    }
  }
}

export function drawPlaced(rc: RC, pp: PlacedProp, o: PropDrawOpts) {
  drawResolved(rc, resolveProp(pp), o);
}

/** Card preview: draw a def centered at (cx, cy) scaled to fit `size`. */
export function drawPreview(rc: RC, def: PropDef, cx: number, cy: number, size: number) {
  let w = 1;
  let h = 1;
  for (const [x, y] of def.footprint) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  let reachX = 0;
  let reachY = 0;
  for (const m of def.modules) {
    if (m.type === 'swinger') {
      reachX = Math.max(reachX, m.arm + m.radius);
      reachY = Math.max(reachY, m.arm + m.radius);
    }
    if (m.type === 'piston') reachY = Math.max(reachY, m.reach * 0.6 + 1);
    if (m.type === 'flame') reachY = Math.max(reachY, m.length * 0.7);
  }
  const ext = Math.max(w + reachX * 2, h + reachY * 2, 2);
  const k = Math.min(2.4, size / (ext * TILE));
  const s = rc.s;
  const g = rc.g;
  for (const ctx of [s, g]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate((-w * TILE) / 2, (-h * TILE) / 2);
  }
  const preview: PropDef = { ...def, motion: { type: 'none' } };
  drawResolved(rc, resolveProp({ uid: 7, def: preview, owner: -1, tx: 0, ty: 0, rot: 0 }), { level: null });
  s.restore();
  g.restore();
}

// ------------------------------------------------------------------ paths

function drawPath(rc: RC, r: Resolved) {
  const m = r.motion;
  if (m.type === 'none') return;
  const s = rc.s;
  const cells = r.mods.flatMap((x) => (x.type === 'body' ? x.cells : []));
  let cx: number;
  let cy: number;
  if (cells.length) {
    cx = (cells.reduce((a, c) => a + c[0], 0) / cells.length + 0.5) * TILE;
    cy = (cells.reduce((a, c) => a + c[1], 0) / cells.length + 0.5) * TILE;
  } else {
    const sw = r.mods.find((x) => x.type === 'swinger') as M<'swinger'> | undefined;
    cx = sw ? sw.hub[0] : (r.pp.tx + 0.5) * TILE;
    cy = sw ? sw.hub[1] : (r.pp.ty + 0.5) * TILE;
  }
  s.save();
  s.strokeStyle = 'rgba(20,20,28,0.55)';
  s.lineWidth = 3;
  s.lineCap = 'round';
  if (m.type === 'rail') {
    const [dx, dy] = dirOf(m.angle);
    s.beginPath();
    s.moveTo(cx, cy);
    s.lineTo(cx + dx * m.range, cy + dy * m.range);
    s.stroke();
    s.strokeStyle = 'rgba(200,200,215,0.45)';
    s.lineWidth = 1;
    s.setLineDash([2, 3]);
    s.stroke();
    s.setLineDash([]);
    s.fillStyle = 'rgba(40,40,50,0.9)';
    circle(s, cx, cy, 2.5);
    circle(s, cx + dx * m.range, cy + dy * m.range, 2.5);
  } else {
    s.beginPath();
    s.arc(cx - m.radius, cy, m.radius, 0, Math.PI * 2);
    s.stroke();
    s.strokeStyle = 'rgba(200,200,215,0.4)';
    s.lineWidth = 1;
    s.setLineDash([2, 3]);
    s.stroke();
    s.setLineDash([]);
  }
  s.restore();
}

// ------------------------------------------------------------------ bodies

function cornerRadii(set: Set<string>, x: number, y: number, R: number): number[] {
  const has = (dx: number, dy: number) => set.has(`${x + dx},${y + dy}`);
  const u = !has(0, -1);
  const d = !has(0, 1);
  const l = !has(-1, 0);
  const r = !has(1, 0);
  return [u && l ? R : 0, u && r ? R : 0, d && r ? R : 0, d && l ? R : 0];
}

function bodyPath(cells: Cell[], off: Vec, R: number, inset = 0): Path2D {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const p = new Path2D();
  for (const [x, y] of cells) p.roundRect(x * TILE + off[0] + inset, y * TILE + off[1] + inset, TILE - inset * 2, TILE - inset * 2, cornerRadii(set, x, y, R));
  return p;
}

function bbox(cells: Cell[], off: Vec) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return { x: x0 * TILE + off[0], y: y0 * TILE + off[1], w: (x1 - x0) * TILE, h: (y1 - y0) * TILE };
}

function drawBody(rc: RC, m: M<'body'>, st: PropStyle, pal: MetalPalette, off: Vec, r: Resolved, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const t = rc.t;
  const f = rc.frame;
  const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));
  let shake = 0;
  if (m.material === 'crumble') {
    if (o.broken) {
      s.save();
      s.strokeStyle = 'rgba(255,255,255,0.18)';
      s.setLineDash([2, 3]);
      s.stroke(bodyPath(m.cells, off, 3, 1.5));
      s.restore();
      return;
    }
    const trig = o.state && o.state.triggerFrame >= 0 ? (f - o.state.triggerFrame) / Math.max(1, m.breakFrames) : 0;
    shake = trig ? Math.sin(f * 2.7) * trig * 1.6 : 0;
    if (trig && o.emit && Math.random() < 0.3) {
      const c = m.cells[Math.floor(Math.random() * m.cells.length)];
      o.emit('debris', (c[0] + Math.random()) * TILE + off[0], (c[1] + 1) * TILE + off[1], (Math.random() - 0.5) * 20, 10, { h: 32, s: 45, l: 50 });
    }
  }
  const O: Vec = [off[0] + shake, off[1]];
  const path = bodyPath(m.cells, O, 4);
  const bb = bbox(m.cells, O);
  // Contact shadow.
  s.fillStyle = 'rgba(0,0,0,0.25)';
  s.save();
  s.translate(1.5, 2.5);
  s.fill(path);
  s.restore();

  const outline = (c: string, w = 2.4) => {
    s.lineJoin = 'round';
    s.strokeStyle = c;
    s.lineWidth = w;
    s.stroke(path);
  };

  switch (m.material) {
    case 'metal': {
      outline(css(pal.dark, -8));
      s.fillStyle = metalFill(s, pal, bb.x, bb.y, bb.w, bb.h);
      s.fill(path);
      s.save();
      s.clip(path);
      // Panel seams + bevels.
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.fillStyle = css(pal.light, 0, 0.35);
        s.fillRect(px + 1, py + 1, TILE - 2, 1);
        s.fillStyle = css(pal.dark, 0, 0.5);
        s.fillRect(px + 1, py + TILE - 2, TILE - 2, 1);
        if (st.trim === 'rivets' || st.trim === 'gems') {
          rivet(s, px + 3, py + 3, pal);
          rivet(s, px + TILE - 3, py + 3, pal);
          rivet(s, px + 3, py + TILE - 3, pal);
          rivet(s, px + TILE - 3, py + TILE - 3, pal);
        }
        if (st.trim === 'stripes' && !set.has(`${x},${y - 1}`)) hazardStripes(s, px, py + 1, TILE, 3.5);
      }
      s.restore();
      if (st.trim === 'gems' || st.trim === 'runes') {
        const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
        const pulse = 0.7 + 0.3 * Math.sin(t * 3 + r.pp.uid);
        for (const [x, y] of m.cells) {
          const cx = (x + 0.5) * TILE + O[0];
          const cy = (y + 0.5) * TILE + O[1];
          if (st.trim === 'gems') {
            s.fillStyle = css(glowC, -25);
            s.beginPath();
            s.moveTo(cx, cy - 3.5);
            s.lineTo(cx + 3, cy);
            s.lineTo(cx, cy + 3.5);
            s.lineTo(cx - 3, cy);
            s.fill();
            g.fillStyle = css(glowC, 10, 0.8 * pulse);
            g.beginPath();
            g.moveTo(cx, cy - 3);
            g.lineTo(cx + 2.4, cy);
            g.lineTo(cx, cy + 3);
            g.lineTo(cx - 2.4, cy);
            g.fill();
          } else {
            g.strokeStyle = css(glowC, 10, 0.75 * pulse);
            g.lineWidth = 1;
            g.beginPath();
            const k = hash2(x, y, r.pp.uid);
            g.moveTo(cx - 3, cy - 3);
            g.lineTo(cx + (k > 0.5 ? 3 : 0), cy);
            g.lineTo(cx - 3, cy + 3);
            g.moveTo(cx + 2, cy - 3.5);
            g.lineTo(cx + 2, cy + 3.5);
            g.stroke();
          }
          glowDot(g, cx, cy, 8, glowC, 0.25 * pulse);
        }
        const c = bb;
        light(rc, c.x + c.w / 2, c.y + c.h / 2, 45, glowC, 0.4 * pulse);
      }
      break;
    }
    case 'stone': {
      const base: HSL = { h: st.hue, s: 12, l: 48 };
      outline(css(base, -30));
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 14));
      gr.addColorStop(1, css(base, -14));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      for (const [x, y] of m.cells) {
        for (let i = 0; i < 6; i++) {
          const k = hash2(x * 7 + i, y * 13, r.pp.uid);
          s.fillStyle = css(base, k > 0.5 ? 10 : -12, 0.6);
          circle(s, x * TILE + O[0] + 2 + hash2(i, x, y) * 12, y * TILE + O[1] + 2 + hash2(y, i, x) * 12, 0.6 + k);
        }
        if (!set.has(`${x},${y - 1}`)) {
          s.fillStyle = css(base, 22, 0.6);
          s.fillRect(x * TILE + O[0], y * TILE + O[1], TILE, 2);
        }
      }
      s.restore();
      break;
    }
    case 'wood': {
      const base: HSL = { h: st.woodHue, s: 45, l: 38 };
      outline(css(base, -24));
      s.fillStyle = css(base);
      s.fill(path);
      s.save();
      s.clip(path);
      for (let y = bb.y; y < bb.y + bb.h; y += 5.33) {
        const gr = s.createLinearGradient(0, y, 0, y + 5.33);
        gr.addColorStop(0, css(base, 10));
        gr.addColorStop(0.7, css(base, 0));
        gr.addColorStop(1, css(base, -15));
        s.fillStyle = gr;
        s.fillRect(bb.x, y, bb.w, 5.33);
        s.strokeStyle = css(base, -10, 0.5);
        s.lineWidth = 0.5;
        s.beginPath();
        for (let x = bb.x; x <= bb.x + bb.w; x += 3) s.lineTo(x, y + 2.6 + Math.sin(x * 0.4 + y) * 0.8);
        s.stroke();
      }
      s.fillStyle = css(pal.dark);
      for (const [x, y] of m.cells) {
        circle(s, x * TILE + O[0] + 3, y * TILE + O[1] + 3, 0.8);
        circle(s, x * TILE + O[0] + 13, y * TILE + O[1] + 13, 0.8);
      }
      s.restore();
      break;
    }
    case 'ice': {
      const base: HSL = { h: 195, s: 80, l: 78 };
      outline(css(base, -30, 0.9), 2);
      const gr = s.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
      gr.addColorStop(0, css(base, 15, 0.95));
      gr.addColorStop(1, css(base, -15, 0.85));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      s.strokeStyle = 'rgba(255,255,255,0.55)';
      s.lineWidth = 0.8;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.beginPath();
        s.moveTo(px + 2, py + 12);
        s.lineTo(px + 7, py + 6);
        s.lineTo(px + 14, py + 9);
        s.stroke();
      }
      const sweep = ((t * 40 + r.pp.uid * 30) % (bb.w + 60)) - 30;
      g.save();
      g.clip(path);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(bb.x + sweep, bb.y);
      g.lineTo(bb.x + sweep + 6, bb.y);
      g.lineTo(bb.x + sweep - 6, bb.y + bb.h);
      g.lineTo(bb.x + sweep - 12, bb.y + bb.h);
      g.fill();
      g.restore();
      s.restore();
      break;
    }
    case 'conveyor': {
      outline('#0b0b0f');
      s.fillStyle = '#26262e';
      s.fill(path);
      s.save();
      s.clip(path);
      const dir = Math.sign(r.pp.rot >= 2 ? -m.conveyor : m.conveyor) || 1;
      const offx = ((f * Math.abs(m.conveyor)) / 60) % 8;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        if (!set.has(`${x},${y - 1}`)) {
          for (let i = -1; i < 3; i++) {
            const bx = px + ((((i * 8 + dir * offx) % 16) + 16) % 16);
            s.fillStyle = '#3a3a44';
            s.fillRect(bx, py, 2, 3);
            g.strokeStyle = 'rgba(255,190,60,0.85)';
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(bx - dir * 2 + 1, py + 5);
            g.lineTo(bx + dir * 1 + 1, py + 7.5);
            g.lineTo(bx - dir * 2 + 1, py + 10);
            g.stroke();
          }
        }
        // Rollers.
        const rx = px + TILE / 2;
        const ry = py + TILE - 4;
        s.fillStyle = sphereFill(s, rx, ry, 3, { h: 220, s: 8, l: 55 });
        circle(s, rx, ry, 3);
        s.strokeStyle = '#111';
        s.lineWidth = 0.8;
        const a = (f * m.conveyor) / 180;
        s.beginPath();
        s.moveTo(rx + Math.cos(a) * 2.5, ry + Math.sin(a) * 2.5);
        s.lineTo(rx - Math.cos(a) * 2.5, ry - Math.sin(a) * 2.5);
        s.stroke();
      }
      s.restore();
      break;
    }
    case 'goo':
    case 'jelly': {
      const jelly = m.material === 'jelly';
      const base: HSL = jelly ? { h: (st.hue + 300) % 360, s: 85, l: 62 } : { h: st.hue, s: 75, l: 42 };
      const wob = (x: number, y: number) => Math.sin(t * (jelly ? 6 : 2) + x * 0.6 + y) * (jelly ? 0.9 : 0.5);
      const wpath = new Path2D();
      for (const [x, y] of m.cells) wpath.roundRect(x * TILE + O[0] - wob(x, y) * 0.5, y * TILE + O[1] + wob(y, x), TILE + wob(x, y), TILE - wob(y, x), cornerRadii(set, x, y, 6));
      s.lineJoin = 'round';
      s.strokeStyle = css(base, -28, 0.9);
      s.lineWidth = 2.4;
      s.stroke(wpath);
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 18, jelly ? 0.85 : 1));
      gr.addColorStop(1, css(base, -10, jelly ? 0.8 : 1));
      s.fillStyle = gr;
      s.fill(wpath);
      g.globalAlpha = jelly ? 0.35 : 0.2;
      g.fillStyle = css(base, 10);
      g.fill(wpath);
      g.globalAlpha = 1;
      s.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y] of m.cells) {
        if (!set.has(`${x},${y - 1}`)) ellipse(s, x * TILE + O[0] + 5, y * TILE + O[1] + 3.5, 3, 1.2);
        if (jelly) {
          s.fillStyle = 'rgba(255,255,255,0.3)';
          circle(s, x * TILE + O[0] + 10 + Math.sin(t + x) * 2, y * TILE + O[1] + 10 + Math.cos(t * 1.3 + y) * 2, 1.4);
          s.fillStyle = 'rgba(255,255,255,0.55)';
        } else if (!set.has(`${x},${y + 1}`)) {
          const dp = (t * 0.5 + hash2(x, y, 3)) % 1;
          s.fillStyle = css(base, 0);
          ellipse(s, x * TILE + O[0] + 4 + hash2(x, y, 9) * 8, (y + 1) * TILE + O[1] + dp * 4, 1.4, 1 + dp * 2.5);
          s.fillStyle = 'rgba(255,255,255,0.55)';
        }
      }
      break;
    }
    case 'crumble': {
      const base: HSL = { h: 32, s: 42, l: 54 };
      outline(css(base, -30));
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 10));
      gr.addColorStop(1, css(base, -12));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      s.strokeStyle = css(base, -32);
      s.lineWidth = 0.9;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.beginPath();
        s.moveTo(px + 3, py);
        s.lineTo(px + 7, py + 6);
        s.lineTo(px + 5, py + 11);
        s.lineTo(px + 8, py + TILE);
        s.moveTo(px + 7, py + 6);
        s.lineTo(px + TILE, py + 8);
        s.stroke();
        s.fillStyle = css(base, 18, 0.7);
        s.fillRect(px + 1, py + 1, TILE - 2, 1.5);
      }
      s.restore();
      break;
    }
  }
}

function drawSpikes(rc: RC, m: M<'spikes'>, off: Vec, pal: MetalPalette) {
  const s = rc.s;
  for (const [x, y] of m.cells) {
    s.save();
    s.translate((x + 0.5) * TILE + off[0], (y + 0.5) * TILE + off[1]);
    s.rotate(m.angle);
    // Local frame: spikes protrude toward +x from the face at x = 8.
    s.fillStyle = css(pal.dark, -5);
    s.fillRect(7, -7, 2, 14);
    for (let i = 0; i < 3; i++) {
      const y0 = -7 + i * 4.67;
      const gr = s.createLinearGradient(8, y0, 8, y0 + 4.67);
      gr.addColorStop(0, '#f2f4f8');
      gr.addColorStop(0.5, '#b6bcc8');
      gr.addColorStop(1, '#5d6370');
      s.fillStyle = gr;
      s.beginPath();
      s.moveTo(8.5, y0 + 0.2);
      s.lineTo(15.5, y0 + 2.33);
      s.lineTo(8.5, y0 + 4.47);
      s.fill();
      s.fillStyle = 'rgba(160,20,30,0.85)';
      s.beginPath();
      s.moveTo(13.2, y0 + 1.6);
      s.lineTo(15.5, y0 + 2.33);
      s.lineTo(13.2, y0 + 3.1);
      s.fill();
    }
    s.restore();
  }
}

// ------------------------------------------------------------------ swingers

function drawSwinger(rc: RC, m: M<'swinger'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const f = rc.frame;
  const heads = swingHeads(m, f, r.phase, off);
  const hx = m.hub[0] + off[0];
  const hy = m.hub[1] + off[1];
  for (const h of heads) {
    if (m.arm <= 0) continue;
    if (m.link === 'chain') {
      const n = Math.max(3, Math.floor(m.arm / 4));
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.5) / n;
        const x = hx + (h.x - hx) * t0;
        const y = hy + (h.y - hy) * t0;
        s.save();
        s.translate(x, y);
        s.rotate(h.a + (i % 2 ? Math.PI / 2 : 0));
        s.strokeStyle = css(pal.dark);
        s.lineWidth = 1.6;
        s.beginPath();
        s.ellipse(0, 0, 2.6, i % 2 ? 1.2 : 1.6, 0, 0, Math.PI * 2);
        s.stroke();
        s.strokeStyle = css(pal.light);
        s.lineWidth = 0.7;
        s.stroke();
        s.restore();
      }
    } else {
      s.lineCap = 'round';
      s.strokeStyle = css(pal.dark, -10);
      s.lineWidth = 4.2;
      s.beginPath();
      s.moveTo(hx, hy);
      s.lineTo(h.x, h.y);
      s.stroke();
      s.strokeStyle = css(pal.base);
      s.lineWidth = 2.4;
      s.stroke();
      s.strokeStyle = css(pal.spec, 0, 0.7);
      s.lineWidth = 0.8;
      s.beginPath();
      s.moveTo(hx, hy - 0.6);
      s.lineTo(h.x, h.y - 0.6);
      s.stroke();
    }
  }
  // Hub.
  s.fillStyle = sphereFill(s, hx, hy, 4.5, pal.base);
  circle(s, hx, hy, 4.5);
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  s.fillStyle = css(pal.dark);
  circle(s, hx, hy, 1.4);

  for (const h of heads) {
    if (m.head === 'saw') drawSaw(rc, h.x, h.y, m.radius, f * 0.45 * m.dir + r.pp.uid, pal, st, o);
    else if (m.head === 'mace') drawMace(rc, h.x, h.y, m.radius, f * 0.03 * m.dir, pal);
    else drawAxe(rc, h.x, h.y, m.radius, h.a, pal);
  }
}

function drawSaw(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  // Motion blur ring.
  s.fillStyle = css(pal.light, 0, 0.25);
  circle(s, 0, 0, R + 0.6);
  s.rotate(rot);
  const teeth = Math.max(10, Math.round(R * 1.1));
  s.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.55) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    s.lineTo(Math.cos(a0) * R * 0.8, Math.sin(a0) * R * 0.8);
    s.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    s.lineTo(Math.cos(a2) * R * 0.8, Math.sin(a2) * R * 0.8);
  }
  s.closePath();
  const gr = s.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  gr.addColorStop(0, '#f4f6fa');
  gr.addColorStop(0.6, '#a9afbb');
  gr.addColorStop(1, '#5b616d');
  s.fillStyle = gr;
  s.fill();
  s.strokeStyle = '#3a3e48';
  s.lineWidth = 0.8;
  s.stroke();
  // Inner disc & lightening holes.
  s.fillStyle = metalFill(s, pal, -R * 0.55, -R * 0.55, R * 1.1, R * 1.1, rot);
  circle(s, 0, 0, R * 0.55);
  s.fillStyle = 'rgba(15,15,20,0.75)';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    circle(s, Math.cos(a) * R * 0.33, Math.sin(a) * R * 0.33, R * 0.11);
  }
  s.fillStyle = css(pal.dark);
  circle(s, 0, 0, R * 0.14);
  if (st.trim === 'stripes') {
    s.strokeStyle = 'rgba(250,200,40,0.9)';
    s.lineWidth = 1.2;
    s.beginPath();
    s.arc(0, 0, R * 0.62, 0, Math.PI * 2);
    s.stroke();
  }
  s.restore();
  // Sparks when the blade grinds terrain.
  if (o.emit && o.level) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * (R + 1);
      const py = y + Math.sin(a) * (R + 1);
      if (tileAt(o.level, Math.floor(px / TILE), Math.floor(py / TILE)) && Math.random() < 0.5) {
        const ta = a + Math.PI / 2;
        o.emit('spark', px, py, Math.cos(ta) * 160 + (Math.random() - 0.5) * 60, Math.sin(ta) * 160 - 40, { h: 40, s: 100, l: 65 });
        light(rc, px, py, 30, { h: 35, s: 100, l: 60 }, 0.6);
      }
    }
  }
}

function drawMace(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  s.rotate(rot);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.fillStyle = i % 2 ? '#c9ced8' : '#9aa1ad';
    s.beginPath();
    s.moveTo(Math.cos(a - 0.22) * R * 0.75, Math.sin(a - 0.22) * R * 0.75);
    s.lineTo(Math.cos(a) * R * 1.32, Math.sin(a) * R * 1.32);
    s.lineTo(Math.cos(a + 0.22) * R * 0.75, Math.sin(a + 0.22) * R * 0.75);
    s.fill();
  }
  s.restore();
  s.fillStyle = sphereFill(s, x, y, R * 0.85, pal.dark.l < 15 ? pal.base : { ...pal.dark, l: pal.dark.l + 10 }, 35, 15);
  circle(s, x, y, R * 0.85);
  s.strokeStyle = 'rgba(0,0,0,0.5)';
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(s, x - R * 0.3, y - R * 0.35, R * 0.22, R * 0.14, -0.6);
}

function drawAxe(rc: RC, x: number, y: number, R: number, a: number, pal: MetalPalette) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  s.rotate(a);
  // Local: arm points +x; blade is a crescent across the arm end.
  const gr = s.createLinearGradient(-R * 0.3, 0, R * 0.9, 0);
  gr.addColorStop(0, css(pal.dark));
  gr.addColorStop(0.5, '#b8bec9');
  gr.addColorStop(0.85, '#eef1f6');
  gr.addColorStop(1, '#ffffff');
  s.fillStyle = gr;
  s.beginPath();
  s.moveTo(-R * 0.2, -R * 0.35);
  s.quadraticCurveTo(R * 0.4, -R * 1.3, R * 0.95, -R * 1.05);
  s.quadraticCurveTo(R * 1.35, 0, R * 0.95, R * 1.05);
  s.quadraticCurveTo(R * 0.4, R * 1.3, -R * 0.2, R * 0.35);
  s.closePath();
  s.fill();
  s.strokeStyle = '#3b3f49';
  s.lineWidth = 0.9;
  s.stroke();
  s.strokeStyle = 'rgba(255,255,255,0.9)';
  s.lineWidth = 0.7;
  s.beginPath();
  s.moveTo(R * 0.95, -R * 1.0);
  s.quadraticCurveTo(R * 1.3, 0, R * 0.95, R * 1.0);
  s.stroke();
  s.fillStyle = css(pal.dark);
  rrect(s, -R * 0.35, -R * 0.4, R * 0.5, R * 0.8, 1.5);
  s.fill();
  s.restore();
}

// ------------------------------------------------------------------ launchers

function drawLauncher(rc: RC, m: M<'launcher'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const mi = r.mods.indexOf(m);
  const angle = m.aim === 'track' ? (o.state?.aim.get(mi) ?? m.angle) : launcherAngle(m, f, r.phase);
  const since = o.state ? f - o.state.lastFire : 999;
  const reload = Math.min(1, since / Math.max(1, m.interval * 0.6));
  const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
  const wood: HSL = { h: st.woodHue, s: 45, l: 38 };
  const recoil = since < 8 ? (8 - since) * 0.5 : 0;

  if (m.aim === 'track' && o.state) {
    // Targeting laser sight.
    const len = o.level ? rayToWall(o.level, x, y, angle, 600, 8) : 60;
    g.strokeStyle = 'rgba(255,40,40,0.35)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
    g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    g.stroke();
    glowDot(g, x + Math.cos(angle) * len, y + Math.sin(angle) * len, 4, { h: 0, s: 100, l: 55 }, 0.8);
  }

  s.save();
  s.translate(x, y);
  switch (m.style) {
    case 'crossbow':
    case 'ballista': {
      const big = m.style === 'ballista' ? 1.35 : 1;
      s.rotate(angle);
      s.translate(-recoil, 0);
      // Stock.
      s.fillStyle = m.style === 'ballista' ? metalFill(s, pal, -7, -2, 16, 4) : css(wood);
      rrect(s, -7 * big, -1.8 * big, 16 * big, 3.6 * big, 1.2);
      s.fill();
      s.strokeStyle = css(wood, -22);
      s.lineWidth = 0.8;
      s.stroke();
      // Limbs.
      const pull = reload < 1 ? 1 - reload : 0;
      const nock = -2 * big - (1 - pull) * 4 * big;
      s.strokeStyle = m.style === 'ballista' ? css(pal.dark) : css(wood, -10);
      s.lineWidth = 2 * big;
      s.lineCap = 'round';
      s.beginPath();
      s.moveTo(4 * big, -9 * big);
      s.quadraticCurveTo(9 * big, 0, 4 * big, 9 * big);
      s.stroke();
      s.strokeStyle = css(pal.light);
      s.lineWidth = 0.6;
      s.stroke();
      // String.
      s.strokeStyle = 'rgba(235,230,215,0.9)';
      s.lineWidth = 0.6;
      s.beginPath();
      s.moveTo(4 * big, -9 * big);
      s.lineTo(nock, 0);
      s.lineTo(4 * big, 9 * big);
      s.stroke();
      // Loaded bolt.
      if (reload > 0.35) drawBoltShape(s, nock + 1, 0, 12 * big, m.ammo === 'arrow');
      s.fillStyle = css(pal.dark);
      circle(s, 0, 0, 1.6 * big);
      break;
    }
    case 'cannon': {
      // Trunnion base doesn't rotate.
      s.fillStyle = css(pal.dark);
      rrect(s, -6, -1, 12, 7, 2);
      s.fill();
      s.rotate(angle);
      s.translate(-recoil, 0);
      s.fillStyle = metalFill(s, pal, -4, -4.5, 16, 9);
      rrect(s, -4, -4.5, 16, 9, 3);
      s.fill();
      s.strokeStyle = css(pal.dark, -10);
      s.lineWidth = 0.9;
      s.stroke();
      s.fillStyle = css(pal.dark);
      s.fillRect(3, -4.8, 1.6, 9.6);
      s.fillRect(9.5, -5.2, 2.5, 10.4);
      s.fillStyle = '#0c0c10';
      ellipse(s, 12, 0, 1.2, 3.4);
      s.fillStyle = sphereFill(s, -4, 0, 4, pal.base);
      circle(s, -4, 0, 4);
      break;
    }
    case 'totem': {
      // Face carved into the mount; a charging orb hovers at the muzzle.
      s.fillStyle = css(wood, -18);
      rrect(s, -6.5, -7, 13, 3, 1);
      s.fill();
      s.fillStyle = '#120c08';
      s.fillRect(-4.5, -2.5, 3, 2);
      s.fillRect(1.5, -2.5, 3, 2);
      g.fillStyle = css(glowC, 15, 0.4 + reload * 0.6);
      g.save();
      g.translate(x, y);
      g.fillRect(-4.5, -2.5, 3, 2);
      g.fillRect(1.5, -2.5, 3, 2);
      g.restore();
      s.fillStyle = '#120c08';
      rrect(s, -3, 2, 6, 3, 1);
      s.fill();
      const ox = Math.cos(angle) * 11;
      const oy = Math.sin(angle) * 11;
      const orb = 1 + reload * 2.4 + Math.sin(rc.t * 12) * 0.3;
      glowDot(g, x + ox, y + oy, orb * 4, glowC, 0.8 * reload);
      g.fillStyle = css(glowC, 30, reload);
      circle(g, x + ox, y + oy, orb);
      light(rc, x + ox, y + oy, 50, glowC, 0.3 + reload * 0.5);
      break;
    }
    case 'turret': {
      s.fillStyle = sphereFill(s, 0, 0, 6.5, pal.base);
      s.beginPath();
      s.arc(0, 0, 6.5, 0, Math.PI * 2);
      s.fill();
      s.strokeStyle = css(pal.dark);
      s.lineWidth = 0.9;
      s.stroke();
      s.rotate(angle);
      s.translate(-recoil * 0.6, 0);
      for (const dy of [-2, 2]) {
        s.fillStyle = metalFill(s, pal, 2, dy - 1.2, 9, 2.4);
        s.fillRect(3, dy - 1.1, 9, 2.2);
      }
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.fillStyle = css(glowC, 10, 0.85);
      circle(g, 1.5, 0, 2);
      g.restore();
      light(rc, x, y, 30, glowC, 0.35);
      break;
    }
    case 'thrower': {
      s.rotate(rc.t * 0.5);
      drawStar(s, 0, 0, 5.5, pal, 1);
      s.rotate(-rc.t * 0.5);
      s.rotate(angle);
      s.fillStyle = css(pal.dark);
      s.fillRect(6, -2.5, 3, 5);
      if (reload > 0.4) {
        s.translate(11, 0);
        s.rotate(rc.t * 18);
        drawStar(s, 0, 0, 3.2, pal, 0);
      }
      break;
    }
  }
  s.restore();
  if (since < 5) {
    const mx = x + Math.cos(angle) * 13;
    const my = y + Math.sin(angle) * 13;
    const fc: HSL = m.style === 'totem' || m.style === 'turret' ? glowC : { h: 40, s: 100, l: 65 };
    glowDot(g, mx, my, 14 - since * 2, fc, 0.9);
    light(rc, mx, my, 80, fc, 1 - since / 5);
  }
}

function drawStar(s: CanvasRenderingContext2D, x: number, y: number, R: number, pal: MetalPalette, base: number) {
  if (R <= 0) return;
  s.fillStyle = base ? css(pal.dark) : '#d7dbe3';
  s.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? R * 0.4 : R;
    s.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  s.closePath();
  s.fill();
  s.fillStyle = base ? css(pal.light) : '#7c818c';
  circle(s, x, y, R * 0.25);
}

function drawBoltShape(s: CanvasRenderingContext2D, x: number, y: number, len: number, arrow: boolean) {
  s.strokeStyle = arrow ? '#8a6a3c' : '#5f646e';
  s.lineWidth = 1.1;
  s.beginPath();
  s.moveTo(x, y);
  s.lineTo(x + len, y);
  s.stroke();
  s.fillStyle = '#d9dde5';
  s.beginPath();
  s.moveTo(x + len + 2.5, y);
  s.lineTo(x + len - 0.5, y - 1.6);
  s.lineTo(x + len - 0.5, y + 1.6);
  s.fill();
  s.fillStyle = arrow ? '#e8e2d0' : '#c8312f';
  s.beginPath();
  s.moveTo(x, y);
  s.lineTo(x + 3, y - 1.8);
  s.lineTo(x + 3, y);
  s.moveTo(x, y);
  s.lineTo(x + 3, y + 1.8);
  s.lineTo(x + 3, y);
  s.fill();
}

// ------------------------------------------------------------------ emitters

function nozzle(s: CanvasRenderingContext2D, x: number, y: number, angle: number, pal: MetalPalette, w = 5, l = 9) {
  s.save();
  s.translate(x, y);
  s.rotate(angle);
  s.fillStyle = metalFill(s, pal, 0, -w / 2, l, w);
  rrect(s, 1, -w / 2, l, w, 1.2);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = css(pal.dark);
  s.fillRect(l - 1, -w / 2 - 0.8, 2, w + 1.6);
  s.restore();
}

function drawFlame(rc: RC, m: M<'flame'>, r: Resolved, off: Vec, pal: MetalPalette, _st: PropStyle, o: PropDrawOpts) {
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const [dx, dy] = dirOf(m.angle);
  nozzle(rc.s, x, y, m.angle, pal, 7, 9);
  const c = flameCycle(m, f, r.phase);
  const fire: HSL = { h: 28, s: 100, l: 55 };
  const nx = x + dx * 10;
  const ny = y + dy * 10;
  if (c.seg === 1) {
    // Pilot light + sputter.
    const p = c.t / c.len;
    glowDot(rc.g, nx, ny, 5 + p * 5, { h: 210, s: 100, l: 60 }, 0.8);
    if (o.emit && Math.random() < 0.35) o.emit('smoke', nx, ny, dx * 20 + (Math.random() - 0.5) * 10, dy * 20 - 10);
    if (o.emit && Math.random() < p) o.emit('ember', nx, ny, dx * 80 + (Math.random() - 0.5) * 40, dy * 80 + (Math.random() - 0.5) * 40, fire);
    light(rc, nx, ny, 30, { h: 210, s: 100, l: 60 }, 0.4);
  } else if (c.seg === 2) {
    const len = o.level ? rayToWall(o.level, x, y, m.angle, m.length + TILE / 2, 8) : m.length + TILE / 2;
    const g = rc.g;
    const ramp = Math.min(1, c.t / 6) * Math.min(1, (c.len - c.t) / 6);
    const n = Math.ceil(len / 4);
    const px = -dy;
    const py = dx;
    for (let i = 0; i < n; i++) {
      const tt = i / n;
      const d = 10 + (len - 10) * tt * ramp;
      const jitter = Math.sin(rc.t * 30 + i * 1.7) * (1 + tt * 3);
      const fx = x + dx * d + px * jitter;
      const fy = y + dy * d + py * jitter;
      const rad = (3 + tt * 7) * ramp;
      const col: HSL = { h: 50 - tt * 40, s: 100, l: 70 - tt * 25 };
      glowDot(g, fx, fy, rad * 1.8, col, 0.55 * (1 - tt * 0.5), 0.35);
    }
    g.strokeStyle = 'rgba(255,255,230,0.85)';
    g.lineWidth = 2.5 * ramp;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(nx, ny);
    g.lineTo(x + dx * (10 + (len - 10) * 0.45 * ramp), y + dy * (10 + (len - 10) * 0.45 * ramp));
    g.stroke();
    for (let d = 10; d < len; d += 28) light(rc, x + dx * d, y + dy * d, 70, fire, 0.9 * ramp);
    if (o.emit && Math.random() < 0.8) o.emit('ember', x + dx * len * 0.8, y + dy * len * 0.8, dx * 60 + (Math.random() - 0.5) * 60, dy * 60 - 30, fire);
    if (o.emit && Math.random() < 0.3) o.emit('smoke', x + dx * len, y + dy * len, dx * 30, dy * 30 - 20);
  }
}

function drawLaser(rc: RC, m: M<'laser'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const a = laserAngle(m, f, r.phase);
  const c = laserCycle(m, f, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 58 };
  const s = rc.s;
  const g = rc.g;
  // Emitter: rotating lens housing.
  s.save();
  s.translate(x, y);
  s.rotate(a);
  s.fillStyle = metalFill(s, pal, -3, -4.5, 12, 9);
  rrect(s, -3, -4.5, 12, 9, 2.5);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = css(pal.dark);
  s.fillRect(7.5, -3.5, 2.5, 7);
  s.restore();
  const lx = x + Math.cos(a) * 9;
  const ly = y + Math.sin(a) * 9;
  const charge = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.1;
  glowDot(g, lx, ly, 3 + charge * 6, col, 0.6 + charge * 0.4);
  const len = o.level ? rayToWall(o.level, x, y, a, 1200, 9) : 40;
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  if (c.seg === 1) {
    if (Math.floor(f / 3) % 2 === 0 || charge > 0.7) {
      g.strokeStyle = css(col, 10, 0.25 + charge * 0.4);
      g.lineWidth = 0.6 + charge * 0.6;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
    }
    if (o.emit && Math.random() < charge) {
      const ra = Math.random() * Math.PI * 2;
      o.emit('spark', lx + Math.cos(ra) * 10, ly + Math.sin(ra) * 10, -Math.cos(ra) * 60, -Math.sin(ra) * 60, col);
    }
    light(rc, lx, ly, 30 + charge * 40, col, 0.5 * charge);
  } else if (c.seg === 2) {
    const ramp = Math.min(1, c.t / 4) * Math.min(1, (c.len - c.t) / 5);
    const w = (1 + Math.sin(rc.t * 50) * 0.15) * ramp;
    for (const [lw, al, dl] of [
      [10, 0.25, 0],
      [5, 0.55, 10],
      [2, 1, 40],
    ] as const) {
      g.strokeStyle = css(col, dl, al);
      g.lineWidth = lw * w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(ex, ey);
      g.stroke();
    }
    glowDot(g, ex, ey, 10 * w, col, 0.9);
    for (let d = 0; d < len; d += 70) light(rc, x + Math.cos(a) * d, y + Math.sin(a) * d, 60, col, 0.8 * ramp);
    light(rc, ex, ey, 70, col, 1.1 * ramp);
    if (o.emit) for (let i = 0; i < 2; i++) o.emit('spark', ex, ey, -Math.cos(a) * 80 + (Math.random() - 0.5) * 160, -Math.sin(a) * 80 + (Math.random() - 0.5) * 160 - 40, col);
  }
}

function drawTesla(rc: RC, m: M<'tesla'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const c = teslaCycle(m, rc.frame, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 65 };
  const tops: [number, number][] = [];
  for (const p of [m.a, m.b]) {
    const x = p[0] + off[0];
    const y = p[1] + off[1];
    // Coil stack.
    for (let i = 0; i < 4; i++) {
      const cy = y + 5 - i * 3.2;
      const w = 6 - i * 0.8;
      s.fillStyle = sphereFill(s, x, cy, w, METALS.copper.base, 25, 20);
      ellipse(s, x, cy, w, 1.8);
      s.strokeStyle = css(METALS.copper.dark);
      s.lineWidth = 0.6;
      s.stroke();
    }
    s.fillStyle = sphereFill(s, x, y - 9, 3.4, pal.base, 35, 20);
    circle(s, x, y - 9, 3.4);
    tops.push([x, y - 9]);
    const idle = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.15;
    glowDot(g, x, y - 9, 5 + idle * 7, col, 0.3 + idle * 0.6);
    if (Math.random() < 0.1 + idle * 0.5) {
      g.strokeStyle = css(col, 20, 0.7);
      g.lineWidth = 0.7;
      const ra = Math.random() * Math.PI * 2;
      lightning(g, x, y - 9, x + Math.cos(ra) * 7, y - 9 + Math.sin(ra) * 7, 3, 4);
      g.stroke();
    }
  }
  const [a, b] = tops;
  if (c.seg === 1 && Math.random() < c.t / c.len) {
    g.strokeStyle = css(col, 20, 0.35);
    g.lineWidth = 0.8;
    lightning(g, a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * 10, 6, 5);
    g.stroke();
  }
  if (c.seg === 2) {
    const ax = m.a[0] + off[0];
    const ay = m.a[1] + off[1];
    const bx = m.b[0] + off[0];
    const by = m.b[1] + off[1];
    for (let k = 0; k < 3; k++) {
      lightning(g, ax, ay - 2, bx, by - 2, 7, 12);
      g.strokeStyle = css(col, 0, 0.4);
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = css(col, 30, 0.95);
      g.lineWidth = 1.2;
      g.stroke();
    }
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    light(rc, mx, my, Math.hypot(bx - ax, by - ay) * 0.8 + 40, col, 1.1);
    if (o.emit && Math.random() < 0.5) o.emit('spark', mx, my, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, col);
  }
}

function drawPistonShaft(rc: RC, m: M<'piston'>, r: Resolved, off: Vec, pal: MetalPalette) {
  const st = pistonState(m, rc.frame, r.phase);
  const head = pistonHead(m, st.ext, off);
  const [dx, dy] = dirOf(m.angle);
  const s = rc.s;
  const fx = m.at[0] + off[0] + dx * TILE * 0.5;
  const fy = m.at[1] + off[1] + dy * TILE * 0.5;
  const hx = head.x + head.w / 2;
  const hy = head.y + head.h / 2;
  const w = 4;
  s.save();
  s.translate(fx, fy);
  s.rotate(m.angle);
  const len = Math.hypot(hx - fx, hy - fy);
  s.fillStyle = metalFill(s, METALS.steel, 0, -w / 2, len, w, Math.PI / 2);
  s.fillRect(0, -w / 2, len, w);
  s.fillStyle = 'rgba(255,255,255,0.35)';
  s.fillRect(0, -w / 2 + 0.6, len, 0.8);
  s.restore();
  void pal;
}

function drawPistonHead(rc: RC, m: M<'piston'>, r: Resolved, off: Vec, pal: MetalPalette) {
  const st = pistonState(m, rc.frame, r.phase);
  const head = pistonHead(m, st.ext, off);
  const s = rc.s;
  const [dx, dy] = dirOf(m.angle);
  if (st.slamming) {
    s.fillStyle = 'rgba(255,255,255,0.12)';
    s.fillRect(head.x - dx * 10, head.y - dy * 10, head.w + Math.abs(dx) * 10, head.h + Math.abs(dy) * 10);
  }
  s.fillStyle = metalFill(s, pal, head.x, head.y, head.w, head.h, dx !== 0 ? Math.PI / 2 : 0);
  rrect(s, head.x, head.y, head.w, head.h, 1.5);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  // Teeth on the striking face.
  s.fillStyle = '#c3c8d2';
  const n = Math.max(2, Math.round(Math.max(head.w, head.h) / 4));
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.5) / n;
    s.beginPath();
    if (dy !== 0) {
      const bx = head.x + head.w * t0;
      const by = dy > 0 ? head.y + head.h : head.y;
      s.moveTo(bx - 1.8, by);
      s.lineTo(bx, by + dy * 3);
      s.lineTo(bx + 1.8, by);
    } else {
      const by = head.y + head.h * t0;
      const bx = dx > 0 ? head.x + head.w : head.x;
      s.moveTo(bx, by - 1.8);
      s.lineTo(bx + dx * 3, by);
      s.lineTo(bx, by + 1.8);
    }
    s.fill();
  }
  hazardStripes(s, dy !== 0 ? head.x + 1 : head.x + head.w / 2 - 1.5, dy !== 0 ? head.y + head.h / 2 - 1.5 : head.y + 1, dy !== 0 ? head.w - 2 : 3, dy !== 0 ? 3 : head.h - 2, 0.8);
}

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  s.save();
  s.translate(m.at[0] + off[0], m.at[1] + off[1]);
  s.rotate(m.angle + Math.PI / 2); // local "up" = -y
  s.fillStyle = metalFill(s, METALS.steel, -7, 5, 14, 3);
  rrect(s, -7, 5, 14, 3, 1);
  s.fill();
  const top = -1 - pop * 6;
  s.strokeStyle = '#3c414c';
  s.lineWidth = 2.2;
  s.beginPath();
  for (let i = 0; i <= 6; i++) s.lineTo(i % 2 ? 4.5 : -4.5, 5 - (i / 6) * (5 - top));
  s.stroke();
  s.strokeStyle = '#d9dee6';
  s.lineWidth = 1;
  s.stroke();
  const pad: HSL = { h: st.hue, s: 85, l: 55 };
  const gr = s.createLinearGradient(0, top - 3, 0, top);
  gr.addColorStop(0, css(pad, 20));
  gr.addColorStop(1, css(pad, -15));
  s.fillStyle = gr;
  rrect(s, -7.5, top - 3.5, 15, 3.5, 1.7);
  s.fill();
  s.restore();
  if (pop > 0) glowDot(rc.g, m.at[0] + off[0], m.at[1] + off[1], 14, pad, pop * 0.5);
}

function drawFan(rc: RC, m: M<'fan'>, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  if (o.level) {
    const z = fanZone(o.level, m, off);
    const [dx, dy] = dirOf(m.angle);
    const len = dx !== 0 ? z.w : z.h;
    const g = rc.g;
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const p = (rc.t * (m.strength / 900) + i / 7) % 1;
      const along = p * len;
      const across = 3 + ((i * 7) % 11);
      const fade = Math.sin(p * Math.PI);
      g.strokeStyle = `rgba(220,240,255,${0.28 * fade})`;
      g.lineWidth = 1;
      g.beginPath();
      if (dx !== 0) {
        const lx = dx > 0 ? z.x + along : z.x + z.w - along;
        const ly = z.y + across + Math.sin(p * 9 + i) * 1.5;
        g.moveTo(lx, ly);
        g.lineTo(lx - dx * 7, ly);
      } else {
        const ly = dy > 0 ? z.y + along : z.y + z.h - along;
        const lx = z.x + across + Math.sin(p * 9 + i) * 1.5;
        g.moveTo(lx, ly);
        g.lineTo(lx, ly - dy * 7);
      }
      g.stroke();
    }
  }
  s.save();
  s.translate(x, y);
  s.fillStyle = 'rgba(10,10,14,0.85)';
  circle(s, 0, 0, 6.4);
  s.rotate(rc.t * (m.strength / 80));
  for (let i = 0; i < 4; i++) {
    s.rotate(Math.PI / 2);
    s.fillStyle = css({ h: st.hue, s: 50, l: 70 }, 0, 0.85);
    s.beginPath();
    s.ellipse(3.2, 0, 3.2, 1.5, 0.35, 0, Math.PI * 2);
    s.fill();
  }
  s.restore();
  s.strokeStyle = css(pal.light, 0, 0.6);
  s.lineWidth = 0.6;
  for (let i = -2; i <= 2; i++) {
    s.beginPath();
    s.moveTo(x - 6.2, y + i * 2.5);
    s.lineTo(x + 6.2, y + i * 2.5);
    s.stroke();
  }
  s.fillStyle = sphereFill(s, x, y, 1.6, pal.base);
  circle(s, x, y, 1.6);
}

function drawBomb(rc: RC, x: number, y: number, radius: number) {
  const s = rc.s;
  s.fillStyle = sphereFill(s, x, y + 1, 6.5, { h: 230, s: 15, l: 18 }, 35, 10);
  circle(s, x, y + 1, 6.5);
  s.fillStyle = '#444a55';
  s.fillRect(x + 1.5, y - 6.5, 3.5, 3);
  s.strokeStyle = '#a07040';
  s.lineWidth = 1.2;
  s.beginPath();
  s.moveTo(x + 3.2, y - 6);
  s.quadraticCurveTo(x + 6, y - 11, x + 8.5, y - 8.5);
  s.stroke();
  const fl = 0.7 + Math.sin(rc.t * 30) * 0.3;
  glowDot(rc.g, x + 8.5, y - 8.5, 5 * fl, { h: 40, s: 100, l: 60 }, 1);
  void radius;
}

// ------------------------------------------------------------------ projectiles

export function drawProjectile(rc: RC, p: Projectile, emit?: Emit) {
  const s = rc.s;
  const g = rc.g;
  const spec = AMMO[p.ammo];
  const a = Math.atan2(p.vy, p.vx);
  switch (p.ammo) {
    case 'bolt':
    case 'arrow':
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      drawBoltShape(s, -10, 0, 10, p.ammo === 'arrow');
      s.restore();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      g.stroke();
      break;
    case 'cannonball':
      s.fillStyle = sphereFill(s, p.x, p.y, spec.radius, { h: 230, s: 10, l: 22 }, 40, 10);
      circle(s, p.x, p.y, spec.radius);
      if (emit && Math.random() < 0.5) emit('smoke', p.x, p.y, -p.vx * 0.1, -p.vy * 0.1);
      break;
    case 'fireball': {
      const col: HSL = { h: 25, s: 100, l: 58 };
      glowDot(g, p.x, p.y, 12, col, 0.7);
      g.fillStyle = 'rgba(255,250,220,0.95)';
      circle(g, p.x, p.y, 2.5);
      flame(g, p.x - p.vx * 0.02, p.y - p.vy * 0.02, 3, 7, col, rc.t);
      light(rc, p.x, p.y, 60, col, 0.9);
      if (emit && Math.random() < 0.6) emit('ember', p.x, p.y, -p.vx * 0.2 + (Math.random() - 0.5) * 30, -p.vy * 0.2 - 20, col);
      break;
    }
    case 'plasma': {
      const col: HSL = { h: 190, s: 100, l: 60 };
      g.strokeStyle = css(col, 0, 0.5);
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      g.stroke();
      glowDot(g, p.x, p.y, 8, col, 0.9);
      g.fillStyle = '#fff';
      circle(g, p.x, p.y, 1.8);
      light(rc, p.x, p.y, 45, col, 0.7);
      break;
    }
    case 'shuriken':
      s.save();
      s.translate(p.x, p.y);
      s.rotate(rc.t * 25);
      drawStar(s, 0, 0, 4.5, METALS.steel, 0);
      s.restore();
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, 4, 0, Math.PI * 2);
      g.stroke();
      break;
  }
}
