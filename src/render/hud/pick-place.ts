import { css, type HSL } from '../../core/color';
import { propTag } from '../../codex/describe';
import type { Match } from '../../game/match';
import type { Role } from '../../gen/props';
import { VIEW_W } from '../../sim/constants';
import { PAL, TYPE } from '../../ui/style';
import { plate, tag } from '../hud-kit';
import { circle, glowDot, rrect } from '../kit';
import { blob, line, stroke } from '../ink';
import { drawPreview } from '../props';
import type { Hud } from '../hud';
import { type Group, DISPLAY, UI, roundLabel, MAX_HEAD_SCALE, MAX_CARD_SCALE, NO_GROUP } from './layout';

/** Pick and place: the crate of cards, the place header, phase timers and player cursors. */

const ROLE: Record<Role, { label: string; color: HSL }> = {
  build: { label: 'BUILD', color: { h: 95, s: 60, l: 48 } },
  hazard: { label: 'HAZARD', color: { h: 358, s: 78, l: 54 } },
  utility: { label: 'UTILITY', color: { h: 198, s: 75, l: 52 } },
  demolish: { label: 'DEMOLISH', color: { h: 28, s: 95, l: 52 } },
};

/**
 * A Secret Parts role card: an inked panel in the role's color with a pen-drawn
 * question mark, and the role label. Nothing about the part, because the part
 * isn't rolled until someone claims the card.
 */
function secretCard(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, role: { label: string; color: HSL }, seed: number) {
  const px = x + 9;
  const py = y + 13;
  const pw = w - 18;
  const ph = h - 42;
  c.save();
  c.fillStyle = css(role.color, -32, 1, -20);
  rrect(c, px, py, pw, ph, 3);
  c.fill();
  c.clip();
  // Hatching, heaviest toward the bottom right (away from the light).
  c.fillStyle = css(role.color, -40, 1, -25);
  for (let i = -ph; i < pw; i += 7) {
    const ax = px + i;
    line(c, ax + ph * 0.35, py + ph * 0.35, ax + ph, py + ph, { w: 1.6, seed: seed * 31 + i, wobble: 0.4, taper: [0.5, 0.1] });
  }
  c.restore();
  c.fillStyle = PAL.ink;
  const ink = { w: 1.8, wobble: 0.3, taper: [0.15, 0.2] as [number, number] };
  line(c, px - 0.5, py, px + pw * 0.7, py, { ...ink, seed: seed + 1, w: 1.2 });
  line(c, px, py + 2, px, py + ph * 0.8, { ...ink, seed: seed + 2, w: 1.2 });
  line(c, px + pw, py + ph * 0.15, px + pw, py + ph, { ...ink, seed: seed + 3 });
  line(c, px + pw * 0.2, py + ph, px + pw + 0.5, py + ph, { ...ink, seed: seed + 4 });
  // The question mark: a hook over the top, a stem, a dot.
  const cx = x + w / 2;
  const cy = py + ph / 2;
  const hook: { x: number; y: number }[] = [];
  for (let a = -160; a <= 70; a += 10) {
    const t = (a * Math.PI) / 180;
    hook.push({ x: cx + Math.cos(t) * 12, y: cy - 13 + Math.sin(t) * 12 });
  }
  hook.push({ x: cx + 1, y: cy + 3 }, { x: cx, y: cy + 7 }, { x: cx, y: cy + 10 });
  const mark = (dx: number, dy: number, wide: number, fill: string) => {
    c.fillStyle = fill;
    stroke(
      c,
      hook.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      { w: wide, seed: seed * 7 + 5, wobble: 0.5, taper: [0.12, 0.08], press: 0.3 },
    );
    blob(c, cx + dx, cy + 19 + dy, wide * 0.55, seed + 9);
    c.fill();
  };
  mark(1, 2, 10, PAL.ink);
  mark(0, 0, 10, PAL.ink);
  mark(0, 0, 6.5, css(role.color, 14));
  tag(c, role.label, cx, y + h - 14, css(role.color), PAL.ink, TYPE.label, 'center');
}

function wrap(h: Hud, s: string, cx: number, y: number, maxW: number, size: number) {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (h.measure(next, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  lines.push(cur);
  const shown = lines.slice(0, 2);
  shown.forEach((l, i) => h.line(l, cx, y + (i - (shown.length - 1) / 2) * (size + 2), size));
}

function cursor(hud: Hud, x: number, y: number, col: HSL, label: string, t: number) {
  const c = hud.ctx;
  glowDot(hud.gctx, x + 3, y + 5, 14, col, 0.35 + Math.sin(t * 6) * 0.1);
  c.save();
  c.translate(x, y);
  c.fillStyle = css(col, 8);
  c.strokeStyle = PAL.ink;
  c.lineWidth = 1.6;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 14);
  c.lineTo(4, 10.5);
  c.lineTo(7, 16);
  c.lineTo(9.5, 15);
  c.lineTo(6.5, 9.5);
  c.lineTo(11.5, 9.5);
  c.closePath();
  c.stroke();
  c.fill();
  c.restore();
  c.font = `700 ${TYPE.caption}px ${UI}`;
  const w = c.measureText(label).width + 10;
  c.fillStyle = PAL.ink;
  rrect(c, x + 11, y + 12, w + 2, 14, 3);
  c.fill();
  c.fillStyle = css(col, -12);
  rrect(c, x + 12, y + 13, w, 12, 2);
  c.fill();
  hud.text(label, x + 17, y + 19.3, TYPE.caption, '#fff', 'left', UI, 700);
}

/** Big phase heading with a sub line. */
function heading(hud: Hud, title: string, sub: string, y: number, size: number = TYPE.title) {
  hud.text(title, VIEW_W / 2, y, size, PAL.bone, 'center', DISPLAY, 400, size * 0.2);
  if (sub) hud.text(sub, VIEW_W / 2, y + size * 0.5 + 10, TYPE.label, PAL.ash, 'center', UI, 600);
}

export function pick(hud: Hud, m: Match, t: number) {
  const c = hud.ctx;
  c.fillStyle = 'rgba(18,10,7,0.68)';
  hud.wash();
  const twoRows = m.crate.length > 5 || hud.phone;
  const headS = Math.min(hud.uiScale, MAX_HEAD_SCALE);
  let done = hud.grow(VIEW_W / 2, 0, headS);
  heading(hud, roundLabel(m), 'Choose a Part', twoRows ? 30 : 52, twoRows ? 24 : TYPE.title);
  phaseTimer(hud, m, t, VIEW_W / 2 + 120, twoRows ? 34 : 56);
  done();
  const rc = hud.rc();
  rc.t = t;
  rc.frame = m.frame;
  hud.cards = hud.phone ? crateZoom(hud, m, 62 * headS) : NO_GROUP;
  done = hud.begin(hud.cards.s, hud.cards.ox, hud.cards.oy);
  m.crate.forEach((item, idx) => {
    if (item.claimedBy >= 0) return;
    const r = item.rect;
    const hoverer = m.players.find((p) => p.claim < 0 && m.crateItemAt(p.cursor.x, p.cursor.y) === idx);
    const lift = hoverer ? -4 : 0;
    const y = r.y + lift;
    const role = ROLE[item.secret ?? item.def.role];
    if (hoverer) glowDot(hud.gctx, r.x + r.w / 2, y + r.h / 2, r.w * 0.8, hoverer.character.body, 0.16);
    plate(c, r.x, y, r.w, r.h, {
      edge: css(role.color),
      stroke: idx === hud.pendingCard ? PAL.bone : hoverer ? css(hoverer.character.body, 15) : undefined,
      drop: lift ? 6 : 3,
    });
    if (item.secret) {
      secretCard(c, r.x, y, r.w, r.h, role, idx);
      return;
    }
    const sg = c.createRadialGradient(r.x + r.w / 2, y + 44, 2, r.x + r.w / 2, y + 44, 46);
    sg.addColorStop(0, css(role.color, 0, 0.22));
    sg.addColorStop(1, css(role.color, 0, 0));
    c.fillStyle = sg;
    c.fillRect(r.x + 1, y + 5, r.w - 2, r.h - 6);
    // The picture gets the card between its tags and its name.
    drawPreview(rc, item.def, r.x + r.w / 2, y + 49, r.w - 14, r.h - 62);
    tag(c, role.label, r.x + 7, y + 15, css(role.color), PAL.ink, TYPE.caption);
    const stamp = propTag(item.def);
    if (stamp) tag(c, stamp, r.x + 7, y + 30, PAL.bone, PAL.ink, TYPE.caption);
    wrap(hud, item.def.name, r.x + r.w / 2, y + r.h - 28, r.w - 12, TYPE.body);
    hud.text(item.def.maker, r.x + r.w / 2, y + r.h - 11, TYPE.caption, PAL.dim, 'center', UI, 600);
  });
  done();
  const { s, ox, oy } = hud.cards;
  for (const p of m.players) {
    if (p.claim < 0) hud.pending.push(() => scaledCursor(hud, ox + p.cursor.x * s, oy + p.cursor.y * s, p.character.body, p.character.name, t));
  }
}

/** How big the crate can draw between the heading and the footer. */
function crateZoom(hud: Hud, m: Match, top: number): Group {
  const f = hud.frame;
  const rects = m.crate.map((c) => c.rect);
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const left = f.safeX0 + 8;
  const right = f.safeX1 - 8;
  const bottom = f.y1 - hud.footH - 6;
  const s = Math.max(1, Math.min(MAX_CARD_SCALE, (right - left) / (x1 - x0), (bottom - top) / (y1 - y0)));
  return { s, ox: (left + right - s * (x0 + x1)) / 2, oy: (top + bottom - s * (y0 + y1)) / 2 };
}

function scaledCursor(hud: Hud, x: number, y: number, col: HSL, label: string, t: number) {
  const done = hud.grow(x, y, hud.uiScale);
  cursor(hud, x, y, col, label, t);
  done();
}

export function place(hud: Hud, m: Match) {
  const c = hud.ctx;
  // The header runs along the top of the window, whatever its shape.
  const { x0, y0, w, safeX0, safeY0, safeX1 } = hud.frame;
  const headS = Math.min(hud.uiScale, MAX_HEAD_SCALE);
  const g = c.createLinearGradient(0, y0, 0, safeY0 + 54 * headS);
  g.addColorStop(0, 'rgba(18,10,7,0.82)');
  g.addColorStop(1, 'rgba(18,10,7,0)');
  c.fillStyle = g;
  c.fillRect(x0, y0, w, safeY0 + 54 * headS - y0);
  let done = hud.grow(safeX0 + 14, safeY0, headS);
  hud.text(roundLabel(m), safeX0 + 14, safeY0 + 16, 14, PAL.amber, 'left', DISPLAY, 400, 3);
  done();
  done = hud.grow(VIEW_W / 2, safeY0, headS);
  hud.text('PLACE YOUR PART', VIEW_W / 2, safeY0 + 17, TYPE.head + 2, PAL.bone, 'center', DISPLAY, 400, 4);
  done();
  done = hud.grow(safeX1 - hud.gearW, safeY0, headS);
  phaseTimer(hud, m, m.frame / 60, safeX1 - hud.gearW - 24, safeY0 + 20);
  done();
  for (const p of m.players) {
    if (p.placed) continue;
    const def = p.claim >= 0 ? m.crate[p.claim].def : null;
    // Cursors are in the world: the camera says where that is on this screen, whatever its zoom.
    hud.pending.push(() => {
      const v = hud.worldToView(p.cursor.x, p.cursor.y);
      scaledCursor(hud, v.x, v.y, p.character.body, def ? def.name : p.character.name, m.frame / 60);
    });
  }
}

/** Countdown ring for timed pick/place phases. */
function phaseTimer(hud: Hud, m: Match, t: number, x: number, y: number) {
  const left = m.phaseTimeLeft;
  if (!Number.isFinite(left)) return;
  const total = (m.phase === 'pick' ? m.rules.pickSeconds : m.rules.placeSeconds) * 60;
  const c = hud.ctx;
  const urgent = left < 5 * 60;
  c.fillStyle = PAL.ink;
  circle(c, x, y, 16);
  c.fillStyle = PAL.iron;
  circle(c, x, y, 14.5);
  c.strokeStyle = urgent ? css({ h: 4, s: 100, l: 58 + Math.sin(t * 12) * 10 }) : PAL.amber;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * left) / total);
  c.stroke();
  hud.text(String(Math.ceil(left / 60)), x, y + 0.5, 12, urgent ? PAL.danger : PAL.bone, 'center', DISPLAY, 400);
}
