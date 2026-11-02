import { css } from '../../core/color';
import type { Match } from '../../game/match';
import { POP_HOLD, RUN_COUNTDOWN, VIEW_H, VIEW_W } from '../../sim/constants';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { icon, plate, standings } from '../hud-kit';
import { drawItemIcon } from '../items';
import { glowDot } from '../kit';
import type { Hud } from '../hud';
import { DISPLAY, UI, MAX_CHIPS_H } from './layout';

/** The race: countdown, race timer and the standings chips. */

export function race(hud: Hud, m: Match, t: number) {
  const run = m.run!;
  const c = hud.ctx;
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
  if (Number.isFinite(run.timeLeft)) {
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
    hud.text(p.character.name, x + 26, y + 8.5, TYPE.caption + 0.5, PAL.bone, 'left', UI, 700);
    const status = done
      ? `#${run.finishOrder.indexOf(p.slot) + 1} Safe`
      : dead
        ? r.killer >= 0 && r.killer !== p.slot
          ? `Got by ${m.player(r.killer)?.character.name ?? '?'}`
          : 'Splat'
        : p.afk
          ? 'AFK'
          : `${p.score} Pts`;
    hud.text(status, x + 26, y + 18, TYPE.caption, done ? PAL.toxic : dead ? '#ff8a7a' : PAL.ash, 'left', UI, 600);
    // Gone (no link to its peer): the same on every screen, from the host's sequenced `away`.
    if (p.away) icon(c, 'unplugged', x + 76, y + 8, 9, PAL.danger);
    const held = r?.items.held;
    if (held) {
      // On the status line: names fill the row above.
      drawItemIcon(c, held.kind, x + 75, y + 17, 0.7, t);
      if (held.uses > 1) hud.text(`×${held.uses}`, x + 67, y + 18, TYPE.caption, PAL.bone, 'right', UI, 800);
    }
  });
  done();
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
