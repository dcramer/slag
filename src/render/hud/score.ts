import { css, type HSL } from '../../core/color';
import type { Match } from '../../game/match';
import type { Award } from '../../game/scoring';
import { VIEW_H, VIEW_W } from '../../sim/constants';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { line, type P } from '../ink';
import { brick, discPts, finishLine, icon, inkShape, plate, shade, standings, tag, track } from '../hud-kit';
import { glowDot } from '../kit';
import type { Hud } from '../hud';
import { DISPLAY, UI, roundLabel } from './layout';

/**
 * Round score and the match winner.
 *
 * The score board is a race: every row is a lane, points are blocks laid down it, and a chequered line
 * with the flag on it is the target score, shared by every lane. Last round's total is one block in the
 * player's color; this round's awards drop in after it one reason at a time, each a block in its
 * reason's color with its points stamped on it, while the rows slide to their new ranks.
 */

type Reason = Award['reason'];

/** Each reason's block: bright fills, so its stamp is ink (docs/ART.md), and a lighter cut where the light hits. */
const award = (label: string, fill: string) => ({ label, fill, lit: shade(fill, 0.35) });
type Look = ReturnType<typeof award>;
const AWARD: Record<Reason, Look> = {
  finish: award('FINISH', PAL.toxic),
  first: award('FIRST', PAL.amber),
  trap: award('TRAP', PAL.danger),
  underdog: award('UNDERDOG', '#4fa9e3'),
  survive: award('SURVIVED', PAL.molten),
  knockout: award('KNOCKOUT', PAL.whiteHot),
};
/** The order blocks drop in, every lane together, a beat per reason anyone earned. */
const ORDER: readonly Reason[] = ['finish', 'knockout', 'survive', 'first', 'trap', 'underdog'];
/** Frames into the screen the first blocks drop, between one reason's blocks and the next, and a fall. */
const FILL_AT = 22;
const BEAT = 16;
const DROP = 10;
/** Frames a short block's reason tag stays up after it lands. */
const TAG_HOLD = 34;

/** Row sizes: roomy for a duel, tight enough for eight. Board-local logical px. */
interface Tier {
  rowH: number;
  scale: number;
  feet: number;
  name: number;
  nameY: number;
  laneY: number;
  laneH: number;
  num: number;
  stamp: number;
}
const ROOMY: Tier = { rowH: 58, scale: 2.2, feet: 46, name: 15, nameY: 12, laneY: 24, laneH: 20, num: 24, stamp: TYPE.body };
const NORMAL: Tier = { rowH: 48, scale: 1.9, feet: 38, name: 13, nameY: 10, laneY: 19, laneH: 17, num: 20, stamp: TYPE.caption };
const COMPACT: Tier = { rowH: 34, scale: 1.35, feet: 28, name: 11, nameY: 7, laneY: 13, laneH: 15, num: 16, stamp: TYPE.caption };

const BOARD_W = 500;
/** Above the first lane: the title's tab hangs into it, and the flag flies there. */
const PAD_TOP = 30;
const PAD_BOT = 10;
const RUNNER_X = 34;
const LANE_X = 66;
/** The finish line's left edge, its width, and the totals' column past it. */
const LINE_X = BOARD_W - 70;
const LINE_W = 7;
const TOTAL_X = BOARD_W - 30;
const LANE_W = LINE_X - LANE_X;
/** The title's tab, straddling the board's top edge. */
const TAB_H = 36;

const ease = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export function score(hud: Hud, m: Match, t: number) {
  const c = hud.ctx;
  c.fillStyle = 'rgba(18,10,7,0.72)';
  hud.wash();
  const res = m.result!;
  const target = m.rules.targetScore;
  const normal = res.verdict === 'normal';
  const n = m.players.length;
  const L = n <= 2 ? ROOMY : n <= 4 ? NORMAL : COMPACT;
  const boardH = PAD_TOP + n * L.rowH + PAD_BOT;
  // Scoreless rounds are the ones that run a match into the limit, so they keep the count over the verdict.
  const over = normal ? 0 : 18;
  const unitH = over + TAB_H / 2 + boardH;

  // The title and the board are one unit, centred in the room above the footer; phones grow it.
  const f = hud.frame;
  const top = f.safeY0 + 6;
  const bottom = f.y1 - hud.footH - 6;
  const s = hud.phone ? Math.max(1, Math.min(hud.uiScale, (f.safeX1 - f.safeX0 - 16) / BOARD_W, (bottom - top) / unitH)) : 1;
  const cx = (f.safeX0 + f.safeX1) / 2;
  const done = hud.begin(s, cx - (BOARD_W / 2) * s, Math.max(top, (top + bottom) / 2 - (unitH / 2) * s));

  const by = over + TAB_H / 2;
  plate(c, 0, by, BOARD_W, boardH, { seed: 41 });

  // This round's blocks, merged per reason, and the beat each reason drops on.
  const beats = ORDER.filter((r) => res.awards.some((a) => a.reason === r));
  const end = beats.length ? FILL_AT + (beats.length - 1) * BEAT + DROP : 0;
  const ff = m.phaseFrame;
  const slide = end ? ease(clamp01((ff - FILL_AT) / (end + 12 - FILL_AT))) : 1;
  const k = (LANE_W - 4) / target;
  const laneTop = by + PAD_TOP;

  // The finish line runs the height of every lane, and the flag flies over it.
  if (n) finishLine(c, LINE_X, laneTop + L.laneY - 3, LINE_W, (n - 1) * L.rowH + L.laneH + 6);
  flag(hud, LINE_X + LINE_W / 2, by + 5, laneTop + L.laneY - 3, target, t);

  const before = standings(m.players, (p) => m.prevScores.get(p.slot) ?? 0);
  const after = standings(m.players, (p) => p.score);
  const best = Math.max(...m.players.map((p) => p.score));
  // Bottom row first, so a climbing row passes over the ones it overtakes.
  for (let rank = after.length - 1; rank >= 0; rank--) {
    const p = after[rank];
    const from = before.indexOf(p);
    const y = laneTop + (from + (rank - from) * slide) * L.rowH;
    const leader = n > 1 && best > 0 && p.score === best;
    // A row being overtaken dims mid-slide, or a straight swap is two rows printed on top of each other.
    c.globalAlpha = rank > from ? 1 - 0.75 * Math.sin(slide * Math.PI) : 1;
    if (leader) {
      c.fillStyle = PAL.amber;
      c.fillRect(5, y + 3, 3, L.rowH - 6);
    }
    drawInkRunner({ s: c, g: hud.gctx }, p.character, RUNNER_X, y + L.feet, {
      facing: 1,
      vx: 0,
      vy: 0,
      grounded: true,
      t,
      scale: L.scale,
      celebrate: res.finishers.includes(p.slot),
    });
    hud.text(p.character.name, LANE_X, y + L.nameY, L.name, leader ? PAL.amber : PAL.bone, 'left', DISPLAY, 400);
    c.font = `400 ${L.name}px ${DISPLAY}`;
    const nameEnd = LANE_X + c.measureText(p.character.name).width;
    if (leader) icon(c, 'crown', nameEnd + L.name * 0.6, y + L.nameY - 0.5, L.name * 0.75, PAL.amber);
    // Gone: unplugged, after the name (and the crown).
    if (p.away) icon(c, 'unplugged', nameEnd + L.name * (leader ? 1.7 : 0.7), y + L.nameY - 0.5, L.name * 0.8, PAL.danger);
    const prev = m.prevScores.get(p.slot) ?? 0;
    const landed = lane(hud, p.character.body, prev, res.awards, p.slot, beats, y + L.laneY, L, k, ff);
    const flash = landed.at >= 0 && ff - landed.at < 8;
    const color = flash ? PAL.whiteHot : leader ? PAL.amber : PAL.bone;
    hud.text(String(prev + landed.points), TOTAL_X, y + L.laneY + L.laneH / 2, L.num, color, 'center', DISPLAY, 400, 3);
  }
  c.globalAlpha = 1;

  // The title on a tab bolted over the board's top edge, so the two read as one sign.
  const title = res.verdict === 'too-easy' ? 'TOO EASY!' : res.verdict === 'too-hard' ? 'NOBODY MADE IT' : roundLabel(m);
  c.font = `400 ${TYPE.title}px ${DISPLAY}`;
  const tabW = Math.ceil(c.measureText(title).width / 8) * 8 + 40;
  plate(c, (BOARD_W - tabW) / 2, over, tabW, TAB_H, { fill: PAL.ironHi, seed: 43 });
  hud.text(title, BOARD_W / 2, over + TAB_H / 2 + 1, TYPE.title, normal ? PAL.bone : PAL.amber, 'center', DISPLAY, 400, 5);
  if (!normal) hud.text(roundLabel(m), BOARD_W / 2, 7, TYPE.label, PAL.ash, 'center', DISPLAY, 400, 3);
  done();
}

/**
 * One lane: last round's total as a block in the player's color, then this round's blocks dropping in on
 * their reason's beat, all stopping at the finish line. Returns the points landed so far and the frame
 * the latest one landed (-1 if none yet), so the total ticks up as each lands.
 */
function lane(
  hud: Hud,
  body: HSL,
  prev: number,
  awards: readonly Award[],
  slot: number,
  beats: readonly Reason[],
  y: number,
  L: Tier,
  k: number,
  ff: number,
): { points: number; at: number } {
  const c = hud.ctx;
  track(c, LANE_X, y, LANE_W, L.laneH, (g) => {
    // Distance marks every 10 points, under the blocks: what's left to run shows as marks.
    g.fillStyle = 'rgba(155,138,120,0.4)';
    for (let i = 10; i * k < LANE_W - 6; i += 10) g.fillRect(2 + i * k - 0.5, L.laneH - 5, 1, 3);
  });
  const bh = L.laneH - 5;
  const by = y + 2;
  const x1 = LANE_X + LANE_W - 2;
  let x = LANE_X + 2;
  const cut = (w: number) => Math.max(0, Math.min(w, x1 - x));
  const w0 = cut(Math.round(prev * k * 2) / 2);
  if (w0 >= 3) brick(c, x, by, w0 - 1, bh, css(body, -6), css(body, 10));
  x += w0;
  let points = 0;
  let at = -1;
  for (const r of beats) {
    const pts = awards.reduce((sum, a) => sum + (a.slot === slot && a.reason === r ? a.points : 0), 0);
    if (!pts) continue;
    const start = FILL_AT + beats.indexOf(r) * BEAT;
    const u = (ff - start) / DROP;
    if (u < 0) break;
    if (u >= 1) {
      points += pts;
      at = start + DROP;
    }
    const w = cut(Math.round(pts * k * 2) / 2);
    if (w >= 2) block(c, AWARD[r], pts, x, by, w - 1, bh, u, L.stamp);
    x += w;
  }
  return { points, at };
}

/** An award's block: it falls into the lane like a dropped brick, hops once as it lands, and carries its stamp. */
function block(c: CanvasRenderingContext2D, a: Look, pts: number, x: number, y: number, w: number, h: number, u: number, size: number) {
  const fall = u < 1 ? -14 * (1 - u * u) : -1.5 * Math.sin(Math.PI * clamp01((u - 1) * 1.6));
  c.save();
  c.globalAlpha *= clamp01(u * 3);
  brick(c, x, y + fall, w, h, a.fill, a.lit);
  c.font = `800 ${size}px ${UI}`;
  const full = `+${pts} ${a.label}`;
  const label = c.measureText(full).width + 6 <= w ? full : c.measureText(`+${pts}`).width + 4 <= w ? `+${pts}` : '';
  if (label) {
    c.fillStyle = PAL.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + fall + h / 2 + 0.5);
  }
  // A block too short for its reason shows it on a tag that pops up off it as it lands, then keeps the points alone.
  const age = (u - 1) * DROP;
  if (label !== full && age >= 0 && age < TAG_HOLD) {
    c.globalAlpha = clamp01((TAG_HOLD - age) / 10);
    tag(c, full, x + w / 2, y - 5 - 3 * clamp01(age / 4), a.fill, PAL.ink, size, 'center');
  }
  c.restore();
}

/** The flag on the finish line: an inked pole from the line up into the board's top, the target on the cloth. */
function flag(hud: Hud, x: number, top: number, foot: number, target: number, t: number) {
  const c = hud.ctx;
  const fw = 30;
  const fh = 17;
  const fy = top + 3;
  // The cloth ripples along its length, still at the pole.
  const wave = (u: number) => 1.7 * Math.sin(u * 4.2 - t * 5) * u;
  const pts: P[] = [];
  for (let i = 0; i <= 6; i++) pts.push({ x: x + 1.5 + (fw * i) / 6, y: fy + wave(i / 6) });
  for (let i = 6; i >= 0; i--) pts.push({ x: x + 1.5 + (fw * i) / 6, y: fy + fh + wave(i / 6) });
  inkShape(c, pts, PAL.amber, 71);
  // The pole: an ink stroke with a lit steel core, a knob on top.
  c.fillStyle = PAL.ink;
  line(c, x, top, x, foot, { w: 2.52, seed: 73, taper: [0.01, 0.02], press: 0.15 });
  c.fillStyle = PAL.ash;
  line(c, x - 0.3, top + 1, x - 0.3, foot - 1, { w: 1.2, seed: 79, taper: [0.1, 0.1], press: 0.2 });
  inkShape(c, discPts(x, top - 1, 2.6, 83), PAL.amber, 83, 1);
  hud.text(String(target), x + 1.5 + fw / 2, fy + fh / 2 + wave(0.5) + 0.5, 13, PAL.ink, 'center', DISPLAY, 400, 0, true);
}

export function victory(hud: Hud, m: Match, t: number) {
  const c = hud.ctx;
  const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
  g.addColorStop(0, 'rgba(18,10,7,0.35)');
  g.addColorStop(1, 'rgba(18,10,7,0.88)');
  c.fillStyle = g;
  hud.wash();
  const winners = m.winners.map((s) => m.player(s)!).filter(Boolean);
  if (!winners.length) {
    // The round limit hit with nobody on the board: no podium to light.
    hud.text('NO WINNER', VIEW_W / 2, VIEW_H / 2 - 20, 46, PAL.amber, 'center', DISPLAY, 400, 8);
    return;
  }
  // God-ray burst behind the winner.
  const gg = hud.gctx;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + t * 0.3;
    gg.fillStyle = `rgba(255,190,80,${0.08 + 0.04 * Math.sin(t * 2 + i)})`;
    gg.beginPath();
    gg.moveTo(VIEW_W / 2, 250);
    gg.lineTo(VIEW_W / 2 + Math.cos(a - 0.08) * 500, 250 + Math.sin(a - 0.08) * 500);
    gg.lineTo(VIEW_W / 2 + Math.cos(a + 0.08) * 500, 250 + Math.sin(a + 0.08) * 500);
    gg.fill();
  }
  hud.text(winners.length > 1 ? 'TIE!' : 'WINNER', VIEW_W / 2, 66, 46, PAL.amber, 'center', DISPLAY, 400, 8);
  // A low-scoring match can tie at the round limit, up to 8 ways: shrink the podium so everyone fits.
  const gap = Math.min(150, (VIEW_W - 64) / winners.length);
  const k = gap / 150;
  winners.forEach((p, i) => {
    const x = VIEW_W / 2 + (i - (winners.length - 1) / 2) * gap;
    glowDot(gg, x, 220, 90 * k, p.character.body, 0.35);
    drawInkRunner({ s: c, g: gg }, p.character, x, 270, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 7 * k, celebrate: true });
    hud.text(p.character.name, x, 300, 24 * k, PAL.bone, 'center', DISPLAY, 400, 5 * k);
    hud.text(`${p.score} Points`, x, 323, TYPE.label, PAL.amber, 'center', UI, 700);
  });
}
