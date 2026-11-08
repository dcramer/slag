import { css } from '../../core/color';
import type { Match } from '../../game/match';
import { POP_HOLD, RUN_COUNTDOWN, TILE, VIEW_H, VIEW_W } from '../../sim/constants';
import { feetUp, popCountdown } from '../../sim/run';
import { screenEdges } from '../../sim/screen';
import { MODES } from '../../game/modes';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { discPts, icon, inkShape, plate, standings } from '../hud-kit';
import { drawItemIcon } from '../items';
import { glowDot } from '../kit';
import type { Hud } from '../hud';
import { DISPLAY, UI, MAX_CHIPS_H } from './layout';

/** The race: countdown, race timer and the standings chips. */

export function race(hud: Hud, m: Match, t: number) {
  const run = m.run!;
  const c = hud.ctx;
  screenEdge(hud, m, t);
  popRings(hud, m, t);
  if (run.frame < RUN_COUNTDOWN + 30) {
    const left = RUN_COUNTDOWN - run.frame;
    const label = left > 0 ? String(Math.ceil((left / RUN_COUNTDOWN) * 3)) : 'GO!';
    const sub = left > 0 ? ((left / RUN_COUNTDOWN) * 3) % 1 : (run.frame - RUN_COUNTDOWN) / 30;
    const sc = left > 0 ? 1 + sub * 0.6 : 1 + sub * 0.5;
    c.save();
    c.translate(VIEW_W / 2, VIEW_H / 2 - 30);
    c.scale(sc, sc);
    c.globalAlpha = left > 0 ? 1 : 1 - sub;
    hud.text(label, 0, 0, TYPE.hero, left > 0 ? PAL.bone : PAL.toxic, 'center', DISPLAY, 400, 9);
    c.restore();
    glowDot(hud.gctx, VIEW_W / 2, VIEW_H / 2 - 30, 90, left > 0 ? { h: 30, s: 100, l: 60 } : { h: 90, s: 100, l: 55 }, 0.3);
  }
  let done = hud.grow(VIEW_W / 2, hud.frame.safeY0, hud.uiScale);
  const timed = Number.isFinite(run.timeLeft);
  if (timed) {
    const secs = Math.ceil(run.timeLeft / 60);
    const urgent = secs <= 10;
    plate(c, VIEW_W / 2 - 28, hud.frame.safeY0 + 6, 56, 24, { rivets: false, stroke: urgent ? PAL.danger : undefined });
    hud.text(
      String(secs),
      VIEW_W / 2,
      hud.frame.safeY0 + 18.5,
      TYPE.head,
      urgent ? css({ h: 4, s: 100, l: 62 + Math.sin(t * 12) * 10 }) : PAL.bone,
      'center',
      DISPLAY,
      400,
    );
  }
  boutPips(c, m, hud.frame.safeY0 + (timed ? 34 : 6));
  done();
  const chips = chipGrid(hud, m.players.length);
  done = hud.grow(hud.frame.safeX0, hud.frame.safeY0, chips.s);
  // Scores can't change during a race, so these chips hold still until the next round.
  standings(m.players, (p) => p.score).forEach((p, i) => {
    const r = run.runners.find((r) => r.slot === p.slot);
    // Up to 4 chips per row so 8 players fit left of the timer.
    const x = hud.frame.safeX0 + 8 + (i % chips.cols) * 87;
    const y = hud.frame.safeY0 + 6 + Math.floor(i / chips.cols) * 29;
    const dead = r && !r.alive;
    const done = r?.finished;
    plate(c, x, y, 84, 25, {
      rivets: false,
      drop: 2,
      side: css(p.character.body),
      stroke: done ? PAL.toxic : dead ? PAL.danger : undefined,
      alpha: 0.92,
      seed: p.slot,
    });
    c.save();
    c.globalAlpha = dead ? 0.4 : 1;
    drawInkRunner({ s: c, g: null }, p.character, x + 14, y + 21, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 1.05, celebrate: done });
    c.restore();
    // The name and the status line hold generated names: each fits what the icons right of it leave.
    hud.fitText(p.character.name, x + 26, y + 8.5, (p.away ? 70 : 81) - 26, TYPE.caption + 0.5, TYPE.caption, PAL.bone, UI, 700);
    const held = r?.items.held;
    const status = done
      ? `#${run.finishOrder.indexOf(p.slot) + 1} Safe`
      : dead
        ? r.killer >= 0 && r.killer !== p.slot
          ? `Got by ${m.player(r.killer)?.character.name ?? '?'}`
          : 'Splat'
        : p.afk
          ? 'AFK'
          : `${p.score} Pts`;
    const statusEnd = !held ? 81 : held.uses > 1 ? 57 : 69;
    hud.fitText(status, x + 26, y + 18, statusEnd - 26, TYPE.caption, TYPE.caption, done ? PAL.toxic : dead ? '#ff8a7a' : PAL.ash, UI, 600);
    // Gone (no link to its peer): the same on every screen, from the host's sequenced `away`.
    if (p.away) icon(c, 'unplugged', x + 76, y + 8, 9, PAL.danger);
    if (held) {
      // On the status line: names fill the row above.
      drawItemIcon(c, held.kind, x + 75, y + 17, 0.7, t);
      if (held.uses > 1) hud.text(`×${held.uses}`, x + 67, y + 18, TYPE.caption, PAL.bone, 'right', UI, 800);
    }
  });
  done();
  popCountdowns(hud, m);
}

/**
 * Which bout on this placement the race is, when there's more than one: a pip per bout under the timer, the ones
 * fought ash, this one amber, the ones to come soot.
 */
function boutPips(c: CanvasRenderingContext2D, m: Match, y: number) {
  const n = m.rules.bouts;
  if (n < 2) return;
  const gap = 9;
  const w = n * gap + 6;
  plate(c, VIEW_W / 2 - w / 2, y, w, 11, { rivets: false, alpha: 0.92, seed: 71 });
  for (let i = 0; i < n; i++) {
    const fill = i + 1 < m.bout ? PAL.ash : i + 1 === m.bout ? PAL.amber : PAL.soot;
    inkShape(c, discPts(VIEW_W / 2 + (i - (n - 1) / 2) * gap, y + 5.5, i + 1 === m.bout ? 2.9 : 2.4, 73 + i), fill, 79 + i, 0.8);
  }
}

/**
 * This screen's own self-destruct charges as a big 3, 2, 1 in the middle, so a hold you didn't mean can't go
 * unseen. Remote players' charges only get the ring. Couch players charging at once stand side by side, smaller,
 * each on a burst rimmed in their color, their name under it.
 */
function popCountdowns(hud: Hud, m: Match) {
  const local = (d: string) => hud.devices.isLocal?.(d) ?? true;
  const charging = m.run!.runners.filter((r) => r.alive && !r.finished && r.pop > 0 && local(m.player(r.slot)?.device ?? ''));
  if (!charging.length) return;
  const c = hud.ctx;
  const many = charging.length > 1;
  const size = many ? 40 : 64;
  const gap = Math.min(size * 1.9, (VIEW_W - 120) / charging.length);
  const cy = VIEW_H / 2 - 30;
  const done = hud.grow(VIEW_W / 2, cy, Math.min(hud.uiScale, 1.4));
  charging.forEach((r, i) => {
    const p = m.player(r.slot)!;
    const { secs, since } = popCountdown(r.pop);
    // Punch in: slam down from big over a few frames, dip under size, settle.
    const e = Math.min(1, since / 6);
    const z = since < 6 ? 1 + 1.3 * (1 - e) ** 2 : since < 12 ? 1 - 0.07 * Math.sin(((since - 6) / 6) * Math.PI) : 1;
    const x = VIEW_W / 2 + (i - (charging.length - 1) / 2) * gap;
    c.save();
    c.translate(x, cy);
    c.rotate((secs % 2 ? -1 : 1) * 0.06);
    c.scale(z, z);
    c.globalAlpha = Math.min(1, (since + 1) / 3);
    countBurst(c, size, css(p.character.body), secs);
    countDigit(c, String(secs), size);
    c.restore();
    if (many) hud.text(p.character.name, x, cy + size * 0.95, TYPE.label, PAL.bone, 'center', UI, 800, 3);
  });
  done();
}

/** Jagged ink balloon behind a countdown number, rimmed in the player's color. */
function countBurst(c: CanvasRenderingContext2D, size: number, rim: string, seed: number) {
  const n = 11;
  const r = size * 0.78;
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const jag = i % 2 ? 0.74 : 1 + 0.12 * Math.sin(seed * 2.3 + i * 1.7);
    c.lineTo(Math.cos(a) * r * jag, Math.sin(a) * r * jag);
  }
  c.closePath();
  c.lineJoin = 'round';
  c.fillStyle = PAL.ink;
  c.save();
  c.translate(0, size * 0.06);
  c.fill();
  c.restore();
  c.fillStyle = 'rgba(18,11,8,0.82)';
  c.fill();
  c.lineWidth = Math.max(2, size * 0.05);
  c.strokeStyle = rim;
  c.stroke();
}

/** The impact-word lettering: display face, heavy ink pen, a hard shadow straight down, molten fill. */
function countDigit(c: CanvasRenderingContext2D, s: string, size: number) {
  c.font = `400 ${size}px ${DISPLAY}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = PAL.ink;
  c.fillStyle = PAL.ink;
  c.lineWidth = size * 0.28;
  const y = size * 0.06;
  c.strokeText(s, 0, y + size * 0.1);
  c.fillText(s, 0, y + size * 0.1);
  c.strokeText(s, 0, y);
  c.fillStyle = PAL.molten;
  c.fillText(s, 0, y);
}

/** Rows over the screen's bottom edge a runner's head starts to warm it: about a slip off a ledge. */
const EDGE_NEAR = 3;

/**
 * The view y under the race's top-left name tags and the clock (whichever reaches lower), at this screen's scale:
 * the leader's screen starts under it (render/camera-follow.ts `screenPose`), so a leader held at its top is never
 * under a tag.
 */
export function raceTagsBottom(hud: Hud, players: number, timed: boolean): number {
  const chips = chipGrid(hud, players);
  const rows = Math.ceil(players / chips.cols);
  const tags = (6 + (rows - 1) * 29 + 25 + 4) * chips.s;
  return hud.frame.safeY0 + Math.max(tags, timed ? 34 * hud.uiScale : 0);
}

/**
 * The leader's screen (sim/screen.ts) shows its edges for what they are. Over its top is the name tags' row, drawn
 * shut like the footer's bar with a plain edge: the tags' backing, nothing that holds anyone. Its bottom is a kill line: it glows hot under whoever comes near it, and
 * whoever has dropped under it gets a chevron in their color, pointing back up, ringed by their grace running out,
 * clear of the footer's prompts. Read from the sim, so every peer sees the same.
 */
function screenEdge(hud: Hud, m: Match, t: number) {
  const run = m.run!;
  const s = MODES[m.rules.mode].run.screen;
  if (!s || !run.screen) return;
  const c = hud.ctx;
  const f = hud.frame;
  const { top, bottom } = screenEdges(s, run.screen);
  const ty = hud.worldToView(0, top).y;
  if (ty > f.y0) {
    c.fillStyle = 'rgba(16,9,6,0.88)';
    c.fillRect(f.x0, f.y0, f.w, ty - f.y0);
    c.fillStyle = PAL.ink;
    c.fillRect(f.x0, ty - 1, f.w, 1);
  }
  const ey = hud.worldToView(0, bottom).y;
  const k = hud.worldToView(1, bottom).x - hud.worldToView(0, bottom).x;
  const marks: { x: number; p: NonNullable<ReturnType<Match['player']>>; left: number }[] = [];
  run.runners.forEach((r, i) => {
    if (!r.alive || r.finished) return;
    const p = m.player(r.slot);
    if (!p) return;
    const over = (bottom - (feetUp(m.level, r) - r.body.h)) / TILE;
    const under = run.screen!.under[i];
    const heat = under > 0 ? 1 : Math.max(0, 1 - over / EDGE_NEAR);
    if (heat <= 0) return;
    const x = hud.worldToView(r.body.x + r.body.w / 2, bottom).x;
    // The edge heats under them: a glow on the HUD itself (not the additive glow layer, which would wash out the
    // chevron drawn over it), and a bar of the edge.
    glowDot(c, x, ey, (36 + 26 * heat) * Math.max(0.8, k), { h: 8, s: 100, l: 50 }, 0.3 + 0.4 * heat, 0.15);
    const bar = c.createLinearGradient(x - 46, 0, x + 46, 0);
    bar.addColorStop(0, 'rgba(255,74,61,0)');
    bar.addColorStop(0.5, `rgba(255,74,61,${(0.35 + 0.55 * heat).toFixed(3)})`);
    bar.addColorStop(1, 'rgba(255,74,61,0)');
    c.fillStyle = bar;
    c.fillRect(x - 46, ey - 3, 92, 3);
    if (under > 0) marks.push({ x, p, left: Math.max(0, 1 - under / s.grace) });
  });
  // Every glow first, then the marks over them: one runner's heat never covers another's chevron.
  const y = Math.min(ey, f.y1 - hud.footH) - 22;
  for (const { x, p, left } of marks) {
    const blink = left < 0.4 && Math.sin(t * (18 + 30 * (0.4 - left))) > 0;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // A soot disc behind it, so a red or orange player's chevron reads against the red glow.
    c.fillStyle = 'rgba(18,11,8,0.82)';
    c.beginPath();
    c.arc(x, y, 15.5, 0, Math.PI * 2);
    c.fill();
    // The grace, running out: bone, flashing red at the end.
    c.strokeStyle = blink ? PAL.danger : PAL.bone;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(x, y, 13.5, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    c.stroke();
    // A chevron up in their color: get back on.
    c.beginPath();
    c.moveTo(x - 7, y + 4);
    c.lineTo(x, y - 4);
    c.lineTo(x + 7, y + 4);
    c.strokeStyle = css(p.character.body);
    c.lineWidth = 4;
    c.stroke();
    c.restore();
  }
}

/**
 * Self-destruct charges: a ring around each charging runner that fills over POP_HOLD, read from the sim so every
 * peer sees the same one. On the HUD canvas so terrain never hides it and the cel pass never inks it.
 */
function popRings(hud: Hud, m: Match, t: number) {
  const c = hud.ctx;
  for (const r of m.run!.runners) {
    if (!r.alive || r.finished || r.pop <= 0) continue;
    const p = Math.min(1, r.pop / POP_HOLD);
    const wx = r.body.x + r.body.w / 2;
    const wy = r.body.y + r.body.h / 2;
    const v = hud.worldToView(wx, wy);
    const k = hud.worldToView(wx + 1, wy).x - v.x;
    // The last stretch shudders, so a hold you didn't mean is hard to miss.
    const shake = p > 0.6 ? (p - 0.6) * 4 * Math.sin(t * 70) : 0;
    const x = v.x + shake;
    const R = (r.body.h * 0.5 + 10) * k;
    const lw = Math.max(2.5, 2 * k);
    const a0 = -Math.PI / 2;
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(18,11,8,0.75)';
    c.lineWidth = lw + 2.5;
    c.beginPath();
    c.arc(x, v.y, R, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = p > 0.8 && Math.sin(t * 40) > 0 ? PAL.whiteHot : PAL.molten;
    c.lineWidth = lw;
    c.beginPath();
    c.arc(x, v.y, R, a0, a0 + p * Math.PI * 2);
    c.stroke();
    c.restore();
  }
}

/** How race chips wrap: whichever layout lets them grow most without reaching the timer or taking over the screen. */
function chipGrid(hud: Hud, n: number): { cols: number; s: number } {
  if (!hud.phone) return { cols: 4, s: 1 };
  const room = VIEW_W / 2 - 28 * hud.uiScale - hud.frame.safeX0 - 8;
  let best = { cols: 4, s: 0 };
  for (let cols = Math.min(4, n); cols >= 1; cols--) {
    const s = Math.min(hud.uiScale, room / (cols * 87), MAX_CHIPS_H / (Math.ceil(n / cols) * 29));
    if (s > best.s) best = { cols, s };
  }
  return best;
}
