import { hash2, seedToString } from '../core/rng';
import { Match } from '../game/match';
import { POINTS } from '../game/scoring';
import type { Theme } from '../gen/theme';
import { deviceHints, deviceLabel } from '../input/input';
import { MAX_PLAYERS, RUN_COUNTDOWN, TARGET_SCORE, TILE, VIEW_H, VIEW_W } from '../sim/constants';
import { tileAt, type Level } from '../sim/level';
import { footprint } from '../sim/props';
import type { GameEvent } from '../sim/types';
import { drawCharacter, roundRect } from './character';
import { drawProp, drawPropPreview } from './props';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  g: number;
}

const FONT = '600 {s}px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const font = (s: number) => FONT.replace('{s}', String(s));

/** Canvas2D renderer. Reads match state; owns only cosmetic state (particles, caches). */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;
  private ox = 0;
  private oy = 0;
  private tileCache: { canvas: HTMLCanvasElement; key: string } | null = null;
  private particles: Particle[] = [];
  private shake = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ox = (w - VIEW_W * this.scale) / 2;
    this.oy = (h - VIEW_H * this.scale) / 2;
    this.tileCache = null;
  }

  render(m: Match, now: number) {
    const ctx = this.ctx;
    const t = now / 1000;
    this.consume(m, m.drainEvents());

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.scale * this.dpr;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake *= 0.85;
    if (this.shake < 0.2) this.shake = 0;
    ctx.setTransform(k, 0, 0, k, (this.ox + sx) * this.dpr, (this.oy + sy) * this.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    const level = m.level;
    this.drawBackground(level.theme, t);
    this.drawTiles(level);
    this.drawMarkers(level, t);

    const run = m.run;
    const pf = run ? run.frame : m.frame;
    for (const pp of m.placed) {
      const st = run?.propState.get(pp.uid);
      drawProp(ctx, level, pp, pf, {
        broken: run ? run.isBroken(pp.uid) : false,
        shake: st && st.triggerFrame >= 0 && pp.def.kind === 'crumble' ? (pf - st.triggerFrame) / pp.def.breakFrames : 0,
        sinceFire: st ? pf - st.lastFire : undefined,
      }, m.phase !== 'run');
    }

    if (run && m.phase === 'run') {
      for (const p of run.projectiles) {
        ctx.fillStyle = '#ffde59';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,120,40,0.5)';
        ctx.beginPath();
        ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const r of run.runners) {
        if (!r.alive) continue;
        const pl = m.player(r.slot);
        if (!pl) continue;
        const b = r.body;
        drawCharacter(ctx, pl.character, b.x + b.w / 2, b.y + b.h, { facing: b.facing, vx: b.vx, vy: b.vy, grounded: b.onGround, t, celebrate: r.finished });
      }
    }

    this.drawParticles();

    switch (m.phase) {
      case 'lobby':
        this.drawLobby(m, t);
        break;
      case 'pick':
        this.drawPick(m, t);
        break;
      case 'place':
        this.drawPlace(m, t);
        break;
      case 'run':
        this.drawRunHud(m);
        break;
      case 'score':
        this.drawScore(m, t);
        break;
      case 'victory':
        this.drawVictory(m, t);
        break;
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- fx

  private consume(m: Match, events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'death': {
          const c = m.player(e.slot)?.character;
          this.burst(e.x, e.y, 22, [c?.body ?? '#fff', c?.bodyDark ?? '#888', '#fff'], 160, 2.5);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'finish':
          this.burst(e.x, e.y, 30, ['#ffd23f', '#3ec1d3', '#ff3d7f', '#9ef01a'], 200, 2, -200);
          break;
        case 'spring':
          this.burst(e.x, e.y, 6, ['#fff'], 60, 1.5);
          break;
        case 'pop':
          this.burst(e.x, e.y, 5, ['#ffde59', '#ff7a2f'], 70, 1.5);
          break;
        case 'explosion':
          this.burst(e.x, e.y, 60, ['#ffd23f', '#ff6b35', '#555', '#222'], 260, 3);
          this.shake = 10;
          break;
        case 'place':
          this.burst(e.x, e.y, 10, ['#fff'], 80, 1.5);
          break;
        default:
          break;
      }
    }
  }

  private burst(x: number, y: number, n: number, colors: string[], speed: number, size: number, vyBias = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.6;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + vyBias * Math.random(), life, max: life, color: colors[i % colors.length], size: size * (0.5 + Math.random()), g: 500 });
    }
  }

  private drawParticles() {
    const ctx = this.ctx;
    const dt = 1 / 60;
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- world

  private drawBackground(th: Theme, t: number) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (th.stars) {
      for (let i = 0; i < 70; i++) {
        const x = hash2(i, 1, th.hue | 0) * VIEW_W;
        const y = hash2(i, 2, th.hue | 0) * VIEW_H * 0.6;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash2(i, 3)) + i));
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    }
    th.layers.forEach((L, li) => {
      ctx.fillStyle = li === 0 ? th.far : th.near;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      const step = th.skyline === 'spires' ? 12 : 6;
      for (let x = 0; x <= VIEW_W + step; x += step) {
        const u = x / VIEW_W;
        let h = L.base;
        L.freqs.forEach((f, i) => (h += Math.sin(u * f * Math.PI * 2 + L.phases[i]) * L.amp * (1 / (i + 1))));
        if (th.skyline === 'spires') h -= (x / step) % 2 ? 0 : L.amp * 0.8 * hash2(x, li);
        if (th.skyline === 'mesas') h = Math.round(h * 12) / 12;
        if (th.skyline === 'blobs') h += Math.abs(Math.sin(u * 40 + li)) * -0.03;
        ctx.lineTo(x, h * VIEW_H);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
    });
  }

  private drawTiles(level: Level) {
    const k = this.scale * this.dpr;
    const key = `${level.seed}:${level.version}:${k}`;
    if (!this.tileCache || this.tileCache.key !== key) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(VIEW_W * k);
      c.height = Math.ceil(VIEW_H * k);
      const g = c.getContext('2d')!;
      g.scale(k, k);
      paintTiles(g, level);
      this.tileCache = { canvas: c, key };
    }
    this.ctx.drawImage(this.tileCache.canvas, 0, 0, VIEW_W, VIEW_H);
  }

  private drawMarkers(level: Level, t: number) {
    const ctx = this.ctx;
    // Spawn pad.
    const sx = level.spawn.tx * TILE + TILE / 2;
    const sy = (level.spawn.ty + 1) * TILE;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(sx - 14, sy - 2, 28, 2);
    // Goal flag.
    const gx = level.goal.tx * TILE + TILE / 2;
    const gy = (level.goal.ty + 1) * TILE;
    ctx.fillStyle = '#ddd';
    ctx.fillRect(gx - 1, gy - 26, 2, 26);
    ctx.fillStyle = level.theme.accent;
    ctx.beginPath();
    ctx.moveTo(gx + 1, gy - 26);
    for (let i = 0; i <= 6; i++) ctx.lineTo(gx + 1 + i * 2.2, gy - 26 + Math.sin(t * 6 + i * 0.8) * 1.2);
    ctx.lineTo(gx + 14, gy - 17 + Math.sin(t * 6 + 5) * 1.2);
    for (let i = 6; i >= 0; i--) ctx.lineTo(gx + 1 + i * 2.2, gy - 17 + Math.sin(t * 6 + i * 0.8) * 1.2);
    ctx.closePath();
    ctx.fill();
  }

  // ------------------------------------------------------------- overlays

  private text(s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', shadow = true) {
    const ctx = this.ctx;
    ctx.font = font(size);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(s, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  private dim(a = 0.55) {
    this.ctx.fillStyle = `rgba(8,8,14,${a})`;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private banner(title: string, sub?: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,8,14,0.7)';
    ctx.fillRect(0, 8, VIEW_W, sub ? 40 : 28);
    this.text(title, VIEW_W / 2, 22, 14);
    if (sub) this.text(sub, VIEW_W / 2, 39, 9, '#bbb');
  }

  private drawLobby(m: Match, t: number) {
    const ctx = this.ctx;
    this.dim(0.45);
    this.text('SLAG', VIEW_W / 2, 52, 44, m.level.theme.accent);
    this.text('build it. break it. beat it.', VIEW_W / 2, 84, 10, '#ccc');
    this.text(`${m.level.theme.name}  ·  ${m.level.style}  ·  seed ${seedToString(m.seed)}`, VIEW_W / 2, 104, 9, '#aaa');

    const bw = 150;
    const bh = 170;
    const gap = 18;
    const x0 = (VIEW_W - (MAX_PLAYERS * bw + (MAX_PLAYERS - 1) * gap)) / 2;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const x = x0 + i * (bw + gap);
      const y = 124;
      const p = m.players.find((p) => p.slot === i);
      ctx.fillStyle = 'rgba(20,20,30,0.8)';
      roundRect(ctx, x, y, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = p?.ready ? '#9ef01a' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!p) {
        this.text('press to join', x + bw / 2, y + bh / 2 - 8, 9, '#888');
        this.text('SPACE · ENTER · Ⓐ', x + bw / 2, y + bh / 2 + 8, 9, '#666');
        continue;
      }
      const c = p.character;
      drawCharacter(ctx, c, x + bw / 2, y + 92, { facing: Math.sin(t + i) > 0 ? 1 : -1, vx: 0, vy: 0, grounded: true, t, scale: 3.2 });
      this.text(c.name, x + bw / 2, y + 112, 12, '#fff');
      this.text(deviceLabel(p.device), x + bw / 2, y + 128, 8, '#999');
      const h = deviceHints(p.device);
      this.text(p.ready ? 'READY!' : `${h.confirm}: ready`, x + bw / 2, y + 146, 9, p.ready ? '#9ef01a' : '#ccc');
      this.text(`${h.alt}: new look`, x + bw / 2, y + 159, 8, '#888');
    }
    this.text('S / ↓ : new level   ·   first to ' + TARGET_SCORE + ' wins', VIEW_W / 2, 316, 9, '#aaa');
    this.text(`finish +${POINTS.finish} · first +${POINTS.first} · trap kill +${POINTS.trap} · everyone finishes = no points`, VIEW_W / 2, 332, 8, '#888');
  }

  private drawCursor(x: number, y: number, color: string, label: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(3.5, 9);
    ctx.lineTo(6, 14);
    ctx.lineTo(8, 13);
    ctx.lineTo(5.5, 8);
    ctx.lineTo(10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    this.text(label, x + 12, y + 16, 8, color, 'left');
  }

  private drawPick(m: Match, t: number) {
    const ctx = this.ctx;
    this.dim(0.6);
    this.banner(`ROUND ${m.round} — PICK A PROP`, 'move your cursor onto a prop and confirm');
    for (const item of m.crate) {
      const r = item.rect;
      const owner = item.claimedBy >= 0 ? m.player(item.claimedBy) : undefined;
      const hovered = m.players.some((p) => p.claim < 0 && m.crateItemAt(p.cursor.x, p.cursor.y) === m.crate.indexOf(item));
      ctx.fillStyle = owner ? 'rgba(40,40,50,0.6)' : hovered ? 'rgba(60,60,80,0.95)' : 'rgba(30,30,42,0.95)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = owner ? owner.character.body : hovered ? '#fff' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = owner ? 0.4 : 1;
      drawPropPreview(ctx, item.def, r.x + r.w / 2, r.y + 34, m.frame, 44);
      ctx.globalAlpha = 1;
      wrapText(this, item.def.name, r.x + r.w / 2, r.y + r.h - 24, r.w - 8, 8, '#fff');
      this.text(item.def.maker, r.x + r.w / 2, r.y + r.h - 8, 6, '#888', 'center', false);
      if (owner) drawCharacter(ctx, owner.character, r.x + r.w - 14, r.y + 22, { facing: -1, vx: 0, vy: 0, grounded: true, t, scale: 1.3 });
    }
    for (const p of m.players) if (p.claim < 0) this.drawCursor(p.cursor.x, p.cursor.y, p.character.body, p.character.name);
  }

  private drawPlace(m: Match, t: number) {
    const ctx = this.ctx;
    this.banner(`ROUND ${m.round} — PLACE IT`, 'rotate with alt · confirm to place · spawn & goal zones are off-limits');
    // Protected zones.
    ctx.fillStyle = 'rgba(255,60,60,0.10)';
    for (const r of m.level.protectedRects) ctx.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
    for (const p of m.players) {
      if (p.placed) continue;
      const g = m.ghostOrigin(p);
      if (!g) continue;
      const ok = m.canPlaceFor(p);
      ctx.globalAlpha = 0.75;
      drawProp(ctx, m.level, { uid: 999 + p.slot, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot: p.rot }, m.frame, {}, true);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? p.character.body : '#ff4040';
      ctx.lineWidth = 1.5;
      if (g.def.kind === 'bomb') {
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc((g.tx + 0.5) * TILE, (g.ty + 0.5) * TILE, g.def.radius * TILE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const [x, y] of footprint(g.def, p.rot)) ctx.strokeRect((g.tx + x) * TILE + 0.5, (g.ty + y) * TILE + 0.5, TILE - 1, TILE - 1);
      this.drawCursor(p.cursor.x, p.cursor.y, p.character.body, p.character.name);
    }
    const waiting = m.players.filter((p) => p.placed).length;
    if (waiting) this.text(`${waiting}/${m.players.length} placed`, VIEW_W - 8, VIEW_H - 10, 8, '#ccc', 'right');
    void t;
  }

  private drawRunHud(m: Match) {
    const run = m.run!;
    if (run.frame < RUN_COUNTDOWN) {
      const n = Math.ceil(((RUN_COUNTDOWN - run.frame) / RUN_COUNTDOWN) * 3);
      this.text(String(n), VIEW_W / 2, VIEW_H / 2 - 40, 40, '#fff');
    } else if (run.frame < RUN_COUNTDOWN + 30) {
      this.text('GO!', VIEW_W / 2, VIEW_H / 2 - 40, 40, '#9ef01a');
    }
    const secs = Math.ceil(run.timeLeft / 60);
    this.text(String(secs), VIEW_W / 2, 16, 14, secs <= 10 ? '#ff5050' : '#fff');
    // Mini status per player.
    m.players.forEach((p, i) => {
      const r = run.runners.find((r) => r.slot === p.slot);
      const x = 12 + i * 92;
      drawCharacter(this.ctx, p.character, x + 8, 30, { facing: 1, vx: 0, vy: 0, grounded: true, t: 0, scale: 1.1 });
      const status = !r ? '' : r.finished ? `#${run.finishOrder.indexOf(p.slot) + 1}` : r.alive ? '' : '✕';
      this.text(`${p.character.name} ${status}`, x + 20, 22, 8, r && !r.alive ? '#ff6b6b' : r?.finished ? '#9ef01a' : '#fff', 'left');
    });
    this.text(`alt: give up`, VIEW_W - 8, VIEW_H - 10, 7, 'rgba(255,255,255,0.5)', 'right');
  }

  private drawScore(m: Match, t: number) {
    const ctx = this.ctx;
    this.dim(0.65);
    const res = m.result!;
    const title = res.verdict === 'too-easy' ? 'TOO EASY! nobody scores' : res.verdict === 'too-hard' ? 'NOBODY MADE IT' : `ROUND ${m.round}`;
    this.text(title, VIEW_W / 2, 70, 20, res.verdict === 'normal' ? '#fff' : '#ffb347');
    const anim = Math.min(1, Math.max(0, (m.phaseFrame - 20) / 60));
    const barX = 200;
    const barW = 440;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX + barW, 100, 1.5, m.players.length * 44);
    m.players.forEach((p, i) => {
      const y = 110 + i * 44;
      drawCharacter(ctx, p.character, 150, y + 16, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 2, celebrate: res.finishers.includes(p.slot) });
      this.text(p.character.name, 172, y + 4, 9, '#fff', 'left');
      const prev = m.prevScores.get(p.slot) ?? 0;
      const shown = prev + (p.score - prev) * anim;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(barX, y + 10, barW, 14);
      ctx.fillStyle = p.character.bodyDark;
      ctx.fillRect(barX, y + 10, (barW * Math.min(prev, TARGET_SCORE)) / TARGET_SCORE, 14);
      ctx.fillStyle = p.character.body;
      ctx.fillRect(barX + (barW * Math.min(prev, TARGET_SCORE)) / TARGET_SCORE, y + 10, (barW * Math.max(0, Math.min(shown, TARGET_SCORE) - prev)) / TARGET_SCORE, 14);
      this.text(String(Math.round(shown)), barX + barW + 16, y + 17, 10, '#fff', 'left');
      const awards = res.awards.filter((a) => a.slot === p.slot);
      const label = awards.map((a) => `+${a.points} ${a.reason}`).join('  ');
      if (label) this.text(label, barX + 4, y + 32, 7, '#ffd23f', 'left', false);
    });
    this.text('confirm to continue', VIEW_W / 2, VIEW_H - 24, 8, '#888');
  }

  private drawVictory(m: Match, t: number) {
    this.dim(0.7);
    const winners = m.winners.map((s) => m.player(s)!).filter(Boolean);
    this.text(winners.length > 1 ? 'TIE!' : 'WINNER', VIEW_W / 2, 80, 22, '#ffd23f');
    winners.forEach((p, i) => {
      const x = VIEW_W / 2 + (i - (winners.length - 1) / 2) * 120;
      drawCharacter(this.ctx, p.character, x, 250, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 6, celebrate: true });
      this.text(p.character.name, x, 280, 14, '#fff');
    });
    if (m.phaseFrame % 20 === 0) this.burst(Math.random() * VIEW_W, -10, 12, ['#ffd23f', '#3ec1d3', '#ff3d7f', '#9ef01a'], 80, 2.5, 100);
    if (m.phaseFrame > 120) this.text('confirm to return to lobby', VIEW_W / 2, VIEW_H - 30, 9, '#aaa');
  }

  /** Used by wrapText. */
  drawText(s: string, x: number, y: number, size: number, color: string) {
    this.text(s, x, y, size, color);
  }

  get context() {
    return this.ctx;
  }
}

function wrapText(r: Renderer, s: string, cx: number, y: number, maxW: number, size: number, color: string) {
  const ctx = r.context;
  ctx.font = font(size);
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  lines.push(cur);
  const shown = lines.slice(0, 2);
  shown.forEach((l, i) => r.drawText(l, cx, y + (i - (shown.length - 1) / 2) * (size + 2), size, color));
}

/** Static terrain, painted once per level version. */
function paintTiles(g: CanvasRenderingContext2D, level: Level) {
  const th = level.theme;
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      if (!tileAt(level, tx, ty)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      g.fillStyle = th.ground;
      g.fillRect(x, y, TILE, TILE);
      const n = hash2(tx, ty, level.seed);
      g.fillStyle = th.groundDark;
      g.globalAlpha = 0.5;
      g.fillRect(x + ((n * 97) % 12) + 1, y + ((n * 53) % 10) + 4, 2, 2);
      g.fillRect(x + ((n * 31) % 12) + 2, y + ((n * 71) % 9) + 5, 1.5, 1.5);
      g.globalAlpha = 1;
      const open = (dx: number, dy: number) => !tileAt(level, tx + dx, ty + dy) && tx + dx >= 0 && tx + dx < level.w;
      g.fillStyle = th.groundDark;
      if (open(0, 1)) g.fillRect(x, y + TILE - 2, TILE, 2);
      if (open(-1, 0)) g.fillRect(x, y, 1.5, TILE);
      if (open(1, 0)) g.fillRect(x + TILE - 1.5, y, 1.5, TILE);
      if (ty > 0 && open(0, -1)) {
        g.fillStyle = th.groundTop;
        g.fillRect(x, y, TILE, 3);
        // Tufts.
        for (let i = 0; i < 3; i++) {
          if (hash2(tx * 3 + i, ty, 7) > 0.55) g.fillRect(x + 2 + i * 5, y - 1.5, 1.5, 2);
        }
      }
    }
  }
}

