import { css, type HSL } from '../../core/color';
import type { Match } from '../../game/match';
import { VIEW_H, VIEW_W } from '../../sim/constants';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { hazardTape, plate, standings, tag, track } from '../hud-kit';
import { glowDot } from '../kit';
import type { Hud } from '../hud';
import { DISPLAY, UI, roundLabel } from './layout';

/** Round score and the match winner. */

const AWARD: Record<string, { label: string; color: HSL }> = {
  finish: { label: 'Finish', color: { h: 95, s: 60, l: 40 } },
  first: { label: 'First', color: { h: 42, s: 95, l: 48 } },
  trap: { label: 'Trap', color: { h: 358, s: 75, l: 50 } },
  underdog: { label: 'Underdog', color: { h: 200, s: 70, l: 42 } },
};

export function score(hud: Hud, m: Match, t: number) {
  const c = hud.ctx;
  c.fillStyle = 'rgba(18,10,7,0.72)';
  hud.wash();
  const res = m.result!;
  const TARGET = m.rules.targetScore;
  const normal = res.verdict === 'normal';
  const title = res.verdict === 'too-easy' ? 'TOO EASY!' : res.verdict === 'too-hard' ? 'NOBODY MADE IT' : roundLabel(m);
  hud.text(title, VIEW_W / 2, 50, TYPE.title, normal ? PAL.bone : PAL.amber, 'center', DISPLAY, 400, 6);
  // Scoreless rounds are the ones that run a match into the limit, so they keep the count too.
  if (!normal) hud.text(roundLabel(m), 14, 16, 14, PAL.amber, 'left', DISPLAY, 400, 3);
  const anim = Math.min(1, Math.max(0, (m.phaseFrame - 20) / 60));
  const barX = 236;
  const barW = 380;
  // Compact rows when more than 4 players so 8 fit on screen.
  const compact = m.players.length > 4;
  const rowH = compact ? 35 : 50;
  const L = compact
    ? { feet: 30, scale: 1.38, name: 8, nameSize: 11, bar: 15, barH: 9, award: 28, awardH: 11, band: -1 }
    : { feet: 37, scale: 1.95, name: 10, nameSize: 13, bar: 20, barH: 12, award: 38, awardH: 12, band: -6 };
  const y0 = compact ? 98 : 104;
  const panelH = m.players.length * rowH + 22;
  const f = hud.frame;
  const panelS = hud.phone ? Math.max(1, Math.min(hud.uiScale, (f.safeX1 - f.safeX0 - 16) / 520, (f.y1 - hud.footH - 8 - (y0 - 12)) / panelH)) : 1;
  // The panel's centre is x = 400; the window's is the anchor, or it would grow off one side.
  const done = hud.begin(panelS, hud.phone ? (f.safeX0 + f.safeX1) / 2 - 400 * panelS : 0, (y0 - 12) * (1 - panelS));
  plate(c, 140, y0 - 12, 520, panelH);
  // Finish line marker.
  hazardTape(c, barX + barW, y0 - 2, 4, m.players.length * rowH, 0.9);
  hud.text(`${TARGET}`, barX + barW + 2, y0 - 7, TYPE.caption, PAL.hazard, 'center', UI, 800);
  // Rows start in the old standings and slide to the new ones as the bars fill.
  const before = standings(m.players, (p) => m.prevScores.get(p.slot) ?? 0);
  const after = standings(m.players, (p) => p.score);
  const slide = anim * anim * (3 - 2 * anim);
  const top = Math.max(...m.players.map((p) => p.score));
  // Bottom row first, so a climbing row passes over the ones it overtakes.
  for (let rank = after.length - 1; rank >= 0; rank--) {
    const p = after[rank];
    const from = before.indexOf(p);
    const y = y0 + (from + (rank - from) * slide) * rowH;
    const leader = m.players.length > 1 && top > 0 && p.score === top;
    // A row being overtaken dims mid-slide, or a straight swap is two rows printed on top of each other.
    c.globalAlpha = rank > from ? 1 - 0.75 * Math.sin(slide * Math.PI) : 1;
    if (leader) {
      c.fillStyle = 'rgba(255,176,46,0.13)';
      c.fillRect(148, y + L.band, 504, rowH - 6);
      c.fillStyle = PAL.amber;
      c.fillRect(148, y + L.band, 3, rowH - 6);
    }
    drawInkRunner({ s: c, g: hud.gctx }, p.character, 182, y + L.feet, {
      facing: 1,
      vx: 0,
      vy: 0,
      grounded: true,
      t,
      scale: L.scale,
      celebrate: res.finishers.includes(p.slot),
    });
    hud.text(p.character.name, barX, y + L.name, L.nameSize, leader ? PAL.amber : PAL.bone, 'left', DISPLAY, 400);
    const prev = m.prevScores.get(p.slot) ?? 0;
    const shown = prev + (p.score - prev) * anim;
    const wPrev = (barW * Math.min(prev, TARGET)) / TARGET;
    const wNow = (barW * Math.min(shown, TARGET)) / TARGET;
    // Two flat tones of the player's color, the lit one over the top half; the gain this round in a lighter cut.
    track(c, barX, y + L.bar, barW, L.barH, (g) => {
      if (wNow <= 0) return;
      const bw = Math.max(4, wNow);
      g.fillStyle = css(p.character.body, -12);
      g.fillRect(0, 0, bw, L.barH);
      g.fillStyle = css(p.character.body, 8);
      g.fillRect(0, 0, bw - 1.5, L.barH * 0.55);
      if (wNow > wPrev + 1) {
        g.fillStyle = 'rgba(255,245,225,0.35)';
        g.fillRect(wPrev, 1.5, wNow - wPrev, 2.5);
      }
    });
    if (wNow > wPrev + 1) glowDot(hud.gctx, barX + wNow, y + L.bar + L.barH / 2, 16, p.character.body, 0.6);
    hud.text(String(Math.round(shown)), barX + barW + 24, y + L.bar + L.barH / 2, compact ? 13 : 16, leader ? PAL.amber : PAL.bone, 'center', DISPLAY, 400);
    const awards = res.awards.filter((a) => a.slot === p.slot);
    c.font = `400 ${L.nameSize}px ${DISPLAY}`;
    let ax = barX + c.measureText(p.character.name).width + 8;
    for (const a of awards) {
      const info = AWARD[a.reason] ?? { label: a.reason, color: { h: 0, s: 0, l: 50 } };
      c.save();
      c.globalAlpha *= Math.min(1, anim * 2);
      ax += tag(c, `+${a.points} ${info.label}`, ax, y + L.name, css(info.color), '#fff', TYPE.caption) + 4;
      c.restore();
    }
  }
  c.globalAlpha = 1;
  done();
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
