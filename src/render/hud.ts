import { css, type HSL } from '../core/color';
import { seedToString } from '../core/rng';
import type { Match } from '../game/match';
import { POINTS } from '../game/scoring';
import type { Role } from '../gen/props';
import { deviceHints, deviceLabel } from '../input/input';
import { MAX_PLAYERS, RUN_COUNTDOWN, TARGET_SCORE, VIEW_H, VIEW_W } from '../sim/constants';
import { THEME_LABELS } from '../themes';
import { drawCharacter } from './character';
import { circle, glowDot, type RC, rrect } from './kit';
import { drawPreview } from './props';

const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
const UI = 'Rubik, "Segoe UI", system-ui, sans-serif';

const ROLE: Record<Role, { label: string; color: HSL }> = {
  build: { label: 'BUILD', color: { h: 140, s: 70, l: 50 } },
  hazard: { label: 'HAZARD', color: { h: 355, s: 85, l: 58 } },
  utility: { label: 'UTILITY', color: { h: 200, s: 85, l: 58 } },
  demolish: { label: 'DEMOLISH', color: { h: 30, s: 95, l: 55 } },
};

/** Screen-space UI on its own canvas (logical 768×432, scaled). */
export class Hud {
  private glow: HTMLCanvasElement = document.createElement('canvas');
  private gctx = this.glow.getContext('2d')!;
  private wipe = 0;
  private lastPhase = '';
  private lastT = 0;

  constructor(private ctx: CanvasRenderingContext2D) {}

  resize(w: number, h: number) {
    this.glow.width = w;
    this.glow.height = h;
  }

  private text(s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', font = UI, weight = 600, stroke = 0) {
    const c = this.ctx;
    c.font = `${weight} ${size}px ${font}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    if (stroke) {
      c.lineJoin = 'round';
      c.lineWidth = stroke;
      c.strokeStyle = 'rgba(8,6,14,0.9)';
      c.strokeText(s, x, y);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillText(s, x + 0.8, y + 1.2);
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  private panel(x: number, y: number, w: number, h: number, r = 10, border = 'rgba(255,255,255,0.12)', a = 0.72) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(30,28,44,${a})`);
    g.addColorStop(1, `rgba(12,11,20,${a + 0.1})`);
    c.fillStyle = g;
    rrect(c, x, y, w, h, r);
    c.fill();
    c.strokeStyle = border;
    c.lineWidth = 1.2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.07)';
    c.beginPath();
    c.moveTo(x + r, y + 1.5);
    c.lineTo(x + w - r, y + 1.5);
    c.stroke();
  }

  draw(m: Match, t: number, pw: number, ph: number) {
    const c = this.ctx;
    const k = pw / VIEW_W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pw, ph);
    this.gctx.setTransform(1, 0, 0, 1, 0, 0);
    this.gctx.clearRect(0, 0, pw, ph);
    c.setTransform(k, 0, 0, k, 0, 0);
    this.gctx.setTransform(k, 0, 0, k, 0, 0);
    if (m.phase !== this.lastPhase) {
      this.lastPhase = m.phase;
      this.wipe = 1;
    }
    switch (m.phase) {
      case 'lobby':
        this.lobby(m, t);
        break;
      case 'pick':
        this.pick(m, t);
        break;
      case 'place':
        this.place(m);
        break;
      case 'run':
        this.run(m, t);
        break;
      case 'score':
        this.score(m, t);
        break;
      case 'victory':
        this.victory(m, t);
        break;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(this.glow, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.setTransform(k, 0, 0, k, 0, 0);
    if (this.wipe > 0 && this.lastT) {
      // Diagonal shutter wipe on phase change.
      const p = 1 - this.wipe;
      c.fillStyle = '#0a0910';
      c.beginPath();
      const x = -200 + p * (VIEW_W + 400);
      c.moveTo(x, 0);
      c.lineTo(x + 140, 0);
      c.lineTo(x + 40, VIEW_H);
      c.lineTo(x - 100, VIEW_H);
      c.fill();
      c.fillStyle = 'rgba(255,140,40,0.9)';
      c.beginPath();
      c.moveTo(x + 140, 0);
      c.lineTo(x + 146, 0);
      c.lineTo(x + 46, VIEW_H);
      c.lineTo(x + 40, VIEW_H);
      c.fill();
      this.wipe -= (t - this.lastT) * 2.6;
    }
    this.lastT = t;
  }

  private rc(): RC {
    return { s: this.ctx, g: this.gctx, lights: null, t: 0, frame: 0 };
  }

  private logo(x: number, y: number, size: number, t: number) {
    const c = this.ctx;
    c.font = `400 ${size}px ${DISPLAY}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.16;
    c.strokeStyle = '#140a08';
    c.strokeText('SLAG', x, y);
    const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.35, '#ffb02e');
    g.addColorStop(0.7, '#ff5a1f');
    g.addColorStop(1, '#a8160f');
    c.fillStyle = g;
    c.fillText('SLAG', x, y);
    // Molten drips.
    const w = c.measureText('SLAG').width;
    for (let i = 0; i < 7; i++) {
      const dx = x - w / 2 + 10 + (i / 6) * (w - 20);
      const len = 6 + ((Math.sin(t * 0.9 + i * 2.3) + 1) / 2) * size * 0.18 + (i % 3) * 3;
      const dy = y + size * 0.33;
      c.fillStyle = '#c42412';
      rrect(c, dx - 2.2, dy - 4, 4.4, len, 2.2);
      c.fill();
      c.fillStyle = '#ff6a1f';
      circle(c, dx, dy + len - 3, 2.6);
    }
    glowDot(this.gctx, x, y, size * 1.2, { h: 25, s: 100, l: 55 }, 0.25 + Math.sin(t * 2) * 0.05, 0.3);
  }

  private lobby(m: Match, t: number) {
    const c = this.ctx;
    const vg = c.createLinearGradient(0, 0, 0, VIEW_H);
    vg.addColorStop(0, 'rgba(8,6,14,0.55)');
    vg.addColorStop(0.4, 'rgba(8,6,14,0.1)');
    vg.addColorStop(1, 'rgba(8,6,14,0.7)');
    c.fillStyle = vg;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.logo(VIEW_W / 2, 58, 64, t);
    this.text('build it · break it · beat it', VIEW_W / 2, 104, 10, '#f3d9c4', 'center', UI, 500);
    this.panel(VIEW_W / 2 - 170, 116, 340, 22, 11, 'rgba(255,170,90,0.35)');
    this.text(`${THEME_LABELS[m.level.theme.id].toUpperCase()} · ${m.level.theme.name}`, VIEW_W / 2 - 160, 127, 9, '#ffd9a8', 'left', UI, 700);
    this.text(`seed ${seedToString(m.seed)}`, VIEW_W / 2 + 160, 127, 8, '#bba', 'right', UI, 500);

    const bw = 152;
    const bh = 186;
    const gap = 16;
    const x0 = (VIEW_W - (MAX_PLAYERS * bw + (MAX_PLAYERS - 1) * gap)) / 2;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const x = x0 + i * (bw + gap);
      const y = 150;
      const p = m.players.find((p) => p.slot === i);
      const col = p ? p.character.body : { h: 0, s: 0, l: 40 };
      this.panel(x, y, bw, bh, 12, p?.ready ? css({ h: 120, s: 80, l: 55 }, 0, 0.9) : p ? css(col, 0, 0.5) : 'rgba(255,255,255,0.1)');
      if (!p) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        this.text('PRESS TO JOIN', x + bw / 2, y + bh / 2 - 10, 11, `rgba(255,255,255,${0.35 + pulse * 0.4})`, 'center', DISPLAY, 400);
        this.text('Space · Enter · Ⓐ', x + bw / 2, y + bh / 2 + 10, 8, '#777', 'center', UI, 500);
        continue;
      }
      // Spotlight.
      const sg = c.createRadialGradient(x + bw / 2, y + 80, 4, x + bw / 2, y + 80, 70);
      sg.addColorStop(0, css(col, 10, 0.45));
      sg.addColorStop(1, css(col, 0, 0));
      c.fillStyle = sg;
      c.fillRect(x, y, bw, bh);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(x + bw / 2, y + 116, 26, 5, 0, 0, Math.PI * 2);
      c.fill();
      drawCharacter({ s: c, g: this.gctx }, p.character, x + bw / 2, y + 116, {
        facing: Math.sin(t * 0.8 + i) > 0 ? 1 : -1,
        vx: 0,
        vy: 0,
        grounded: true,
        t,
        scale: 3.6,
        celebrate: p.ready,
      });
      this.text(p.character.name, x + bw / 2, y + 134, 15, '#fff', 'center', DISPLAY, 400, 3);
      this.text(deviceLabel(p.device), x + bw / 2, y + 150, 7.5, '#aaa', 'center', UI, 500);
      const h = deviceHints(p.device);
      const pillC = p.ready ? css({ h: 120, s: 70, l: 45 }) : 'rgba(255,255,255,0.1)';
      c.fillStyle = pillC;
      rrect(c, x + 22, y + 159, bw - 44, 15, 7.5);
      c.fill();
      this.text(p.ready ? 'READY!' : `${h.confirm} — ready up`, x + bw / 2, y + 166.5, 8.5, '#fff', 'center', UI, 700);
      this.text(`${h.alt}: new look`, x + bw / 2, y + 181, 7, '#888', 'center', UI, 500);
    }
    this.text(`S / ↓ new level   ·   first to ${TARGET_SCORE} wins`, VIEW_W / 2, 356, 9, '#ddd', 'center', UI, 600);
    this.text(
      `finish +${POINTS.finish} · first +${POINTS.first} · trap kill +${POINTS.trap} · if everyone finishes, nobody scores`,
      VIEW_W / 2,
      372,
      8,
      '#999',
      'center',
      UI,
      500,
    );
  }

  private cursor(x: number, y: number, col: HSL, label: string, t: number) {
    const c = this.ctx;
    glowDot(this.gctx, x + 3, y + 5, 14, col, 0.35 + Math.sin(t * 6) * 0.1);
    c.save();
    c.translate(x, y);
    c.fillStyle = css(col, 8);
    c.strokeStyle = '#0b0a12';
    c.lineWidth = 1.4;
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
    c.font = `700 8px ${UI}`;
    const w = c.measureText(label).width + 8;
    c.fillStyle = css(col, -10, 0.9);
    rrect(c, x + 12, y + 13, w, 11, 5.5);
    c.fill();
    this.text(label, x + 16, y + 18.8, 8, '#fff', 'left', UI, 700);
  }

  private pick(m: Match, t: number) {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,6,14,0.6)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.text(`ROUND ${m.round}`, VIEW_W / 2, 52, 30, '#fff', 'center', DISPLAY, 400, 5);
    this.text('pick your poison', VIEW_W / 2, 80, 10, '#f3c9a0', 'center', UI, 500);
    const rc = this.rc();
    rc.t = t;
    rc.frame = m.frame;
    m.crate.forEach((item, idx) => {
      const r = item.rect;
      const owner = item.claimedBy >= 0 ? m.player(item.claimedBy) : undefined;
      const hoverer = m.players.find((p) => p.claim < 0 && m.crateItemAt(p.cursor.x, p.cursor.y) === idx);
      const lift = hoverer && !owner ? -4 : 0;
      const y = r.y + lift;
      const role = ROLE[item.def.role];
      const border = owner ? css(owner.character.body, 0, 0.9) : hoverer ? css(hoverer.character.body, 10) : 'rgba(255,255,255,0.14)';
      if (hoverer && !owner) glowDot(this.gctx, r.x + r.w / 2, y + r.h / 2, r.w * 0.8, hoverer.character.body, 0.18);
      this.panel(r.x, y, r.w, r.h, 10, border, owner ? 0.5 : 0.85);
      // Spotlight behind the prop.
      const sg = c.createRadialGradient(r.x + r.w / 2, y + 36, 2, r.x + r.w / 2, y + 36, 46);
      sg.addColorStop(0, css(role.color, 0, 0.22));
      sg.addColorStop(1, css(role.color, 0, 0));
      c.fillStyle = sg;
      c.fillRect(r.x, y, r.w, r.h);
      c.globalAlpha = owner ? 0.35 : 1;
      this.gctx.globalAlpha = owner ? 0.35 : 1;
      drawPreview(rc, item.def, r.x + r.w / 2, y + 36, 52);
      c.globalAlpha = 1;
      this.gctx.globalAlpha = 1;
      c.fillStyle = css(role.color, -10, 0.9);
      rrect(c, r.x + 6, y + 6, 40, 10, 5);
      c.fill();
      this.text(role.label, r.x + 26, y + 11.2, 6, '#fff', 'center', UI, 800);
      wrap(this, item.def.name, r.x + r.w / 2, y + r.h - 25, r.w - 10, 8.5);
      this.text(item.def.maker, r.x + r.w / 2, y + r.h - 9, 6, '#8a8796', 'center', UI, 500);
      if (owner) {
        drawCharacter({ s: c, g: this.gctx }, owner.character, r.x + r.w - 16, y + 30, {
          facing: -1,
          vx: 0,
          vy: 0,
          grounded: true,
          t,
          scale: 1.6,
          celebrate: true,
        });
      }
    });
    for (const p of m.players) if (p.claim < 0) this.cursor(p.cursor.x, p.cursor.y, p.character.body, p.character.name, t);
  }

  private place(m: Match) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, 50);
    g.addColorStop(0, 'rgba(8,6,14,0.75)');
    g.addColorStop(1, 'rgba(8,6,14,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, 50);
    this.text(`ROUND ${m.round} — PLACE IT`, VIEW_W / 2, 16, 16, '#fff', 'center', DISPLAY, 400, 3);
    this.text('alt rotates · confirm places · spawn & flag zones are off-limits', VIEW_W / 2, 32, 7.5, '#ddd', 'center', UI, 500);
    for (const p of m.players) {
      if (p.placed) continue;
      const def = p.claim >= 0 ? m.crate[p.claim].def : null;
      this.cursor(p.cursor.x, p.cursor.y, p.character.body, def ? def.name : p.character.name, m.frame / 60);
    }
    const done = m.players.filter((p) => p.placed).length;
    if (done) this.text(`${done}/${m.players.length} placed`, VIEW_W - 10, VIEW_H - 12, 8, '#ddd', 'right', UI, 600);
  }

  private run(m: Match, t: number) {
    const run = m.run!;
    const c = this.ctx;
    if (run.frame < RUN_COUNTDOWN + 30) {
      const left = RUN_COUNTDOWN - run.frame;
      const label = left > 0 ? String(Math.ceil((left / RUN_COUNTDOWN) * 3)) : 'GO!';
      const sub = left > 0 ? ((left / RUN_COUNTDOWN) * 3) % 1 : (run.frame - RUN_COUNTDOWN) / 30;
      const sc = left > 0 ? 1 + sub * 0.6 : 1 + sub * 0.5;
      c.save();
      c.translate(VIEW_W / 2, VIEW_H / 2 - 30);
      c.scale(sc, sc);
      c.globalAlpha = left > 0 ? 1 : 1 - sub;
      this.text(label, 0, 0, 56, left > 0 ? '#fff' : '#9ef01a', 'center', DISPLAY, 400, 8);
      c.restore();
      glowDot(this.gctx, VIEW_W / 2, VIEW_H / 2 - 30, 90, left > 0 ? { h: 30, s: 100, l: 60 } : { h: 90, s: 100, l: 55 }, 0.3);
    }
    const secs = Math.ceil(run.timeLeft / 60);
    const urgent = secs <= 10;
    this.panel(VIEW_W / 2 - 28, 6, 56, 22, 11, urgent ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.15)');
    this.text(String(secs), VIEW_W / 2, 17.5, 15, urgent ? css({ h: 0, s: 100, l: 65 + Math.sin(t * 12) * 10 }) : '#fff', 'center', DISPLAY, 400);
    m.players.forEach((p, i) => {
      const r = run.runners.find((r) => r.slot === p.slot);
      const x = 8 + i * 96;
      const dead = r && !r.alive;
      const done = r?.finished;
      this.panel(x, 6, 90, 22, 11, done ? 'rgba(160,240,60,0.8)' : dead ? 'rgba(255,80,80,0.6)' : css(p.character.body, 0, 0.5), 0.6);
      c.globalAlpha = dead ? 0.4 : 1;
      drawCharacter({ s: c, g: null }, p.character, x + 12, 25, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 1.05, celebrate: done });
      c.globalAlpha = 1;
      this.text(p.character.name, x + 24, 13, 7.5, '#fff', 'left', UI, 700);
      const status = done
        ? `#${run.finishOrder.indexOf(p.slot) + 1} SAFE`
        : dead
          ? r!.killer >= 0 && r!.killer !== p.slot
            ? `got by ${m.player(r!.killer)?.character.name ?? '?'}`
            : 'splat'
          : `${p.score} pts`;
      this.text(status, x + 24, 22, 6.5, done ? '#b7f56a' : dead ? '#ff8a8a' : '#bbb', 'left', UI, 600);
    });
    this.text('alt: self-destruct', VIEW_W - 8, VIEW_H - 8, 6.5, 'rgba(255,255,255,0.45)', 'right', UI, 500);
  }

  private score(m: Match, t: number) {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,6,14,0.7)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    const res = m.result!;
    const title = res.verdict === 'too-easy' ? 'TOO EASY!' : res.verdict === 'too-hard' ? 'NOBODY MADE IT' : `ROUND ${m.round}`;
    const sub = res.verdict === 'too-easy' ? 'everyone finished — no points' : res.verdict === 'too-hard' ? 'no finishers, no points' : 'scores';
    this.text(title, VIEW_W / 2, 56, 32, res.verdict === 'normal' ? '#fff' : '#ffb347', 'center', DISPLAY, 400, 5);
    this.text(sub, VIEW_W / 2, 84, 9, '#ccc', 'center', UI, 500);
    const anim = Math.min(1, Math.max(0, (m.phaseFrame - 20) / 60));
    const barX = 220;
    const barW = 400;
    const rowH = 50;
    const y0 = 104;
    this.panel(130, y0 - 10, 540, m.players.length * rowH + 20, 14);
    // Finish line marker.
    c.fillStyle = 'rgba(255,210,63,0.5)';
    c.fillRect(barX + barW, y0, 2, m.players.length * rowH);
    this.text(`${TARGET_SCORE}`, barX + barW, y0 - 4, 7, '#ffd23f', 'center', UI, 700);
    m.players.forEach((p, i) => {
      const y = y0 + i * rowH;
      drawCharacter({ s: c, g: this.gctx }, p.character, 164, y + 34, {
        facing: 1,
        vx: 0,
        vy: 0,
        grounded: true,
        t,
        scale: 2.2,
        celebrate: res.finishers.includes(p.slot),
      });
      this.text(p.character.name, barX, y + 10, 11, '#fff', 'left', DISPLAY, 400);
      const prev = m.prevScores.get(p.slot) ?? 0;
      const shown = prev + (p.score - prev) * anim;
      c.fillStyle = 'rgba(255,255,255,0.07)';
      rrect(c, barX, y + 20, barW, 14, 7);
      c.fill();
      const wPrev = (barW * Math.min(prev, TARGET_SCORE)) / TARGET_SCORE;
      const wNow = (barW * Math.min(shown, TARGET_SCORE)) / TARGET_SCORE;
      if (wNow > 0) {
        const bg = c.createLinearGradient(0, y + 20, 0, y + 34);
        bg.addColorStop(0, css(p.character.body, 15));
        bg.addColorStop(1, css(p.character.body, -15));
        c.fillStyle = bg;
        rrect(c, barX, y + 20, Math.max(14, wNow), 14, 7);
        c.fill();
        if (wNow > wPrev + 1) {
          glowDot(this.gctx, barX + wNow, y + 27, 16, p.character.body, 0.6);
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(barX + wPrev, y + 21, wNow - wPrev, 3);
        }
      }
      this.text(String(Math.round(shown)), barX + barW + 22, y + 27, 13, '#fff', 'center', DISPLAY, 400);
      const awards = res.awards.filter((a) => a.slot === p.slot);
      let ax = barX;
      for (const a of awards) {
        const label = `+${a.points} ${a.reason}`;
        c.font = `700 7px ${UI}`;
        const w = c.measureText(label).width + 10;
        const col: HSL = a.reason === 'trap' ? { h: 355, s: 80, l: 55 } : a.reason === 'first' ? { h: 45, s: 100, l: 50 } : { h: 130, s: 65, l: 45 };
        c.fillStyle = css(col, 0, Math.min(1, anim * 2));
        rrect(c, ax, y + 37, w, 10, 5);
        c.fill();
        this.text(label, ax + w / 2, y + 42.3, 7, '#fff', 'center', UI, 700);
        ax += w + 4;
      }
    });
    if (m.phaseFrame > 90) this.text('confirm to continue', VIEW_W / 2, VIEW_H - 20, 8, `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.3})`, 'center', UI, 600);
  }

  private victory(m: Match, t: number) {
    const c = this.ctx;
    const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
    g.addColorStop(0, 'rgba(8,6,14,0.35)');
    g.addColorStop(1, 'rgba(8,6,14,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    const winners = m.winners.map((s) => m.player(s)!).filter(Boolean);
    // God-ray burst behind the winner.
    const gg = this.gctx;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + t * 0.3;
      gg.fillStyle = `rgba(255,210,90,${0.08 + 0.04 * Math.sin(t * 2 + i)})`;
      gg.beginPath();
      gg.moveTo(VIEW_W / 2, 250);
      gg.lineTo(VIEW_W / 2 + Math.cos(a - 0.08) * 500, 250 + Math.sin(a - 0.08) * 500);
      gg.lineTo(VIEW_W / 2 + Math.cos(a + 0.08) * 500, 250 + Math.sin(a + 0.08) * 500);
      gg.fill();
    }
    this.text(winners.length > 1 ? 'TIE!' : 'WINNER', VIEW_W / 2, 70, 44, '#ffd23f', 'center', DISPLAY, 400, 7);
    winners.forEach((p, i) => {
      const x = VIEW_W / 2 + (i - (winners.length - 1) / 2) * 140;
      glowDot(gg, x, 220, 90, p.character.body, 0.35);
      drawCharacter({ s: c, g: gg }, p.character, x, 270, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 7, celebrate: true });
      this.text(p.character.name, x, 300, 22, '#fff', 'center', DISPLAY, 400, 4);
      this.text(`${p.score} pts`, x, 322, 10, '#ffd9a8', 'center', UI, 700);
    });
    if (m.phaseFrame > 120)
      this.text('confirm to return to the lobby', VIEW_W / 2, VIEW_H - 24, 9, `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.3})`, 'center', UI, 600);
  }

  /** For wrap(). */
  measure(s: string, size: number) {
    this.ctx.font = `700 ${size}px ${UI}`;
    return this.ctx.measureText(s).width;
  }
  line(s: string, x: number, y: number, size: number) {
    this.text(s, x, y, size, '#fff', 'center', UI, 700);
  }
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
