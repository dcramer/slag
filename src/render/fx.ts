import { css, type HSL } from '../core/color';
import { TILE } from '../sim/constants';
import { type Level, tileAt } from '../sim/level';
import { circle, glowDot, light, type RC } from './kit';

export type PKind = 'spark' | 'ember' | 'smoke' | 'dust' | 'gib' | 'confetti' | 'debris' | 'ring' | 'splash' | 'flash';

interface P {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: HSL;
  rot: number;
  vr: number;
  bounced: number;
}

/** Cosmetic particles. Gibs bounce off terrain and paint splats via `onSplat`. */
export class Fx {
  private ps: P[] = [];
  onSplat: ((x: number, y: number, r: number, c: HSL) => void) | null = null;

  add(kind: PKind, x: number, y: number, vx: number, vy: number, color: HSL = { h: 0, s: 0, l: 90 }, size = 1, life = 1) {
    if (this.ps.length > 1800) this.ps.shift();
    this.ps.push({ kind, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, bounced: 0 });
  }

  burst(kind: PKind, x: number, y: number, n: number, speed: number, colors: HSL[], size = 1, life = 0.8, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.75);
      this.add(
        kind,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - up * Math.random(),
        colors[i % colors.length],
        size * (0.6 + Math.random() * 0.8),
        life * (0.6 + Math.random() * 0.8),
      );
    }
  }

  update(dt: number, level: Level) {
    this.ps = this.ps.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      const solid = (x: number, y: number) => !!tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) && y >= 0;
      switch (p.kind) {
        case 'spark':
          p.vy += 500 * dt;
          p.vx *= 0.98;
          break;
        case 'ember':
          p.vy -= 30 * dt;
          p.vx *= 0.97;
          p.vy *= 0.97;
          break;
        case 'smoke':
          p.vy -= 20 * dt;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.size += dt * 6;
          break;
        case 'dust':
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.vy -= 8 * dt;
          p.size += dt * 4;
          break;
        case 'gib':
        case 'debris':
        case 'confetti':
        case 'splash': {
          p.vy += (p.kind === 'confetti' ? 120 : 600) * dt;
          if (p.kind === 'confetti') {
            p.vx *= 0.985;
            p.vx += Math.sin(p.life * 8 + p.rot) * 30 * dt;
          }
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          if (p.kind === 'gib' || p.kind === 'debris') {
            if (solid(nx, ny)) {
              if (p.kind === 'gib' && p.bounced < 2 && this.onSplat) this.onSplat(nx, ny, 1.5 + p.size * 1.2, p.color);
              if (solid(nx, p.y)) p.vx *= -0.4;
              if (solid(p.x, ny)) p.vy *= -0.35;
              p.vx *= 0.7;
              p.bounced++;
              p.vr *= 0.5;
              return true;
            }
          }
          p.rot += p.vr * dt;
          if (p.y > level.h * TILE + 20) return false;
          break;
        }
        default:
          break;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return true;
    });
  }

  /** `soft` takes smoke and dust; the comic style passes its un-inked layer, or stacked puffs ink into solid-looking discs. */
  draw(rc: RC, soft: CanvasRenderingContext2D = rc.s) {
    const s = rc.s;
    const g = rc.g;
    for (const p of this.ps) {
      const a = Math.min(1, (p.life / p.max) * 1.5);
      switch (p.kind) {
        case 'spark': {
          g.strokeStyle = css(p.color, 20, a);
          g.lineWidth = p.size;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
          g.stroke();
          break;
        }
        case 'ember':
          g.fillStyle = css(p.color, 15, a);
          circle(g, p.x, p.y, p.size * 0.9);
          break;
        case 'smoke':
          soft.fillStyle = `rgba(60,58,66,${0.28 * a})`;
          circle(soft, p.x, p.y, p.size * 2);
          break;
        case 'dust':
          soft.fillStyle = css(p.color, 0, 0.45 * a);
          circle(soft, p.x, p.y, p.size * 1.5);
          break;
        case 'gib':
          s.save();
          s.translate(p.x, p.y);
          s.rotate(p.rot);
          s.fillStyle = css(p.color);
          s.beginPath();
          s.roundRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4, p.size * 0.6);
          s.fill();
          s.fillStyle = css(p.color, 20, 0.8);
          s.fillRect(-p.size * 0.6, -p.size * 0.5, p.size * 0.6, p.size * 0.4);
          s.restore();
          break;
        case 'debris':
          s.save();
          s.translate(p.x, p.y);
          s.rotate(p.rot);
          s.fillStyle = css(p.color, 0, a);
          s.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          s.restore();
          break;
        case 'confetti':
          s.save();
          s.translate(p.x, p.y);
          s.rotate(p.rot);
          s.fillStyle = css(p.color, 0, a);
          s.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8 * Math.abs(Math.cos(p.life * 9)));
          s.restore();
          break;
        case 'splash':
          g.fillStyle = css(p.color, 10, a * 0.9);
          circle(g, p.x, p.y, p.size);
          break;
        case 'ring': {
          const k = 1 - p.life / p.max;
          g.strokeStyle = css(p.color, 20, (1 - k) * 0.8);
          g.lineWidth = 3 * (1 - k) + 0.5;
          g.beginPath();
          g.arc(p.x, p.y, p.size * (0.2 + k * 0.8), 0, Math.PI * 2);
          g.stroke();
          break;
        }
        case 'flash':
          glowDot(g, p.x, p.y, p.size * (1 + (1 - p.life / p.max)), p.color, a);
          light(rc, p.x, p.y, p.size * 3, p.color, a * 1.5);
          break;
      }
    }
  }
}
