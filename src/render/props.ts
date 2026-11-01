import type { PropDef } from '../gen/props';
import { hsl } from '../gen/theme';
import { TILE } from '../sim/constants';
import type { Level } from '../sim/level';
import { fanZone, footprint, moverRect, propDir, sawCircle, travelAxis, type PlacedProp } from '../sim/props';
import { circle, roundRect } from './character';

export interface PropDrawState {
  broken?: boolean;
  /** 0..1 how close a crumble is to breaking. */
  shake?: number;
  /** Frames since the spring last fired. */
  sinceFire?: number;
}

/**
 * Draw a prop at tile origin (tx, ty). `frame` drives motion for
 * movers/saws and must match the sim frame during a run.
 */
export function drawProp(ctx: CanvasRenderingContext2D, level: Level | null, pp: PlacedProp, frame: number, st: PropDrawState = {}, showPaths = true): void {
  const d = pp.def;
  const ox = pp.tx * TILE;
  const oy = pp.ty * TILE;
  const cells = footprint(d, pp.rot);
  switch (d.kind) {
    case 'block': {
      const fill = d.material === 'ice' ? 'hsl(190 80% 80%)' : d.material === 'sticky' ? hsl(d.hue, 70, 45) : d.material === 'conveyor' ? '#2c2c34' : hsl(d.hue, 25, 55);
      const edge = d.material === 'ice' ? 'hsl(200 60% 55%)' : d.material === 'sticky' ? hsl(d.hue, 70, 28) : d.material === 'conveyor' ? '#111' : hsl(d.hue, 25, 32);
      for (const [cx, cy] of cells) {
        const x = ox + cx * TILE;
        const y = oy + cy * TILE;
        ctx.fillStyle = fill;
        roundRect(ctx, x + 0.5, y + 0.5, TILE - 1, TILE - 1, 3);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (d.material === 'ice') {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(x + 3, y + 3, 5, 2);
        } else if (d.material === 'conveyor') {
          const dir = Math.sign(pp.rot >= 2 ? -d.conveyor : d.conveyor);
          const off = ((frame * Math.abs(d.conveyor)) / 60) % 8;
          ctx.strokeStyle = '#f2c14e';
          ctx.lineWidth = 1.5;
          for (let i = -1; i < 3; i++) {
            const bx = x + ((i * 8 + dir * off + 16) % 16);
            ctx.beginPath();
            ctx.moveTo(bx - dir * 2, y + 3);
            ctx.lineTo(bx + dir * 1, y + 5.5);
            ctx.lineTo(bx - dir * 2, y + 8);
            ctx.stroke();
          }
        } else if (d.material === 'sticky') {
          ctx.fillStyle = hsl(d.hue, 80, 60);
          circle(ctx, x + 5, y + TILE - 1, 1.6);
          circle(ctx, x + 11, y + TILE, 1.2);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
        }
      }
      break;
    }
    case 'spikes': {
      for (const [cx, cy] of cells) {
        const x = ox + cx * TILE;
        const y = oy + cy * TILE;
        ctx.fillStyle = '#555a66';
        ctx.fillRect(x + 1, y + TILE - 4, TILE - 2, 3);
        ctx.fillStyle = '#c9ced8';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x + 1 + i * 4.7, y + TILE - 4);
          ctx.lineTo(x + 3.3 + i * 4.7, y + 2);
          ctx.lineTo(x + 5.7 + i * 4.7, y + TILE - 4);
          ctx.fill();
        }
        ctx.fillStyle = '#d33';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 2.6 + i * 4.7, y + 2, 1.4, 2);
      }
      break;
    }
    case 'crumble': {
      const jitter = st.shake ? Math.sin(frame * 2.3) * st.shake * 1.5 : 0;
      for (const [cx, cy] of cells) {
        const x = ox + cx * TILE + jitter;
        const y = oy + cy * TILE;
        if (st.broken) {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
          ctx.setLineDash([]);
          continue;
        }
        ctx.fillStyle = hsl(30, 45, 55);
        roundRect(ctx, x + 0.5, y + 0.5, TILE - 1, TILE - 1, 2);
        ctx.fill();
        ctx.strokeStyle = hsl(30, 45, 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 2);
        ctx.lineTo(x + 7, y + 7);
        ctx.lineTo(x + 5, y + 11);
        ctx.moveTo(x + 7, y + 7);
        ctx.lineTo(x + 12, y + 9);
        ctx.stroke();
      }
      break;
    }
    case 'mover': {
      const [ax, ay] = travelAxis(d.axis, pp.rot);
      if (showPaths) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.setLineDash([3, 3]);
        const px = ox + Math.min(0, ax) * d.range * TILE;
        const py = oy + Math.min(0, ay) * d.range * TILE;
        ctx.strokeRect(px + 0.5, py + 0.5, d.length * TILE + Math.abs(ax) * d.range * TILE - 1, TILE / 2 + Math.abs(ay) * d.range * TILE - 1);
        ctx.setLineDash([]);
      }
      const r = moverRect(pp, frame);
      ctx.fillStyle = hsl(d.hue, 50, 50);
      roundRect(ctx, r.x, r.y, r.w, r.h, 3);
      ctx.fill();
      ctx.strokeStyle = hsl(d.hue, 50, 25);
      ctx.stroke();
      ctx.fillStyle = hsl(d.hue, 50, 25);
      for (let i = 0; i < d.length; i++) circle(ctx, r.x + i * TILE + TILE / 2, r.y + r.h / 2, 1.2);
      break;
    }
    case 'saw': {
      const [ax, ay] = travelAxis(d.axis, pp.rot);
      if (showPaths && d.range) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ox + TILE / 2, oy + TILE / 2);
        ctx.lineTo(ox + TILE / 2 + ax * d.range * TILE, oy + TILE / 2 + ay * d.range * TILE);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const c = sawCircle(pp, frame);
      const R = d.radius * TILE;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(frame * 0.3);
      ctx.fillStyle = '#b9bec9';
      ctx.beginPath();
      const teeth = Math.max(8, Math.round(R * 1.2));
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 ? R * 0.78 : R;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6b7080';
      circle(ctx, 0, 0, R * 0.45);
      ctx.fillStyle = '#2a2d36';
      circle(ctx, 0, 0, R * 0.15);
      ctx.restore();
      break;
    }
    case 'spring': {
      const squash = st.sinceFire !== undefined && st.sinceFire < 8 ? 1 - st.sinceFire / 8 : 0;
      ctx.save();
      ctx.translate(ox + TILE / 2, oy + TILE / 2);
      ctx.rotate((pp.rot * Math.PI) / 2);
      ctx.fillStyle = '#444';
      ctx.fillRect(-6, 5, 12, 3);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      // Pad pops out right after firing.
      const ext = -2 - squash * 4;
      for (let i = 0; i <= 4; i++) ctx.lineTo(i % 2 ? 4 : -4, 5 - (i / 4) * (5 - ext));
      ctx.stroke();
      ctx.fillStyle = hsl(d.hue, 80, 55);
      roundRect(ctx, -7, ext - 3, 14, 3, 1.5);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'turret': {
      const [dx, dy] = propDir(d, pp.rot);
      const recoil = st.sinceFire !== undefined && st.sinceFire < 6 ? (6 - st.sinceFire) * 0.4 : 0;
      ctx.fillStyle = '#3b3f4a';
      roundRect(ctx, ox + 1, oy + 1, TILE - 2, TILE - 2, 3);
      ctx.fill();
      ctx.save();
      ctx.translate(ox + TILE / 2, oy + TILE / 2);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#222';
      ctx.fillRect(2 - recoil, -2.5, 8, 5);
      ctx.restore();
      ctx.fillStyle = hsl(d.hue, 85, 55);
      circle(ctx, ox + TILE / 2, oy + TILE / 2, 3);
      break;
    }
    case 'fan': {
      if (level) {
        const z = fanZone(level, pp);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        const [dx, dy] = propDir(d, pp.rot);
        const len = dx !== 0 ? z.w : z.h;
        for (let i = 0; i < 4; i++) {
          const t = ((frame * d.strength) / 20000 + i / 4) % 1;
          const along = t * len;
          const across = ((i * 5) % 12) + 2;
          ctx.beginPath();
          if (dx !== 0) {
            const x = dx > 0 ? z.x + along : z.x + z.w - along;
            ctx.moveTo(x, z.y + across);
            ctx.lineTo(x - dx * 5, z.y + across);
          } else {
            const y = dy > 0 ? z.y + along : z.y + z.h - along;
            ctx.moveTo(z.x + across, y);
            ctx.lineTo(z.x + across, y - dy * 5);
          }
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#4a4f5c';
      roundRect(ctx, ox + 1, oy + 1, TILE - 2, TILE - 2, 3);
      ctx.fill();
      ctx.save();
      ctx.translate(ox + TILE / 2, oy + TILE / 2);
      ctx.rotate(frame * 0.5);
      ctx.fillStyle = hsl(d.hue, 60, 70);
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.ellipse(3, 0, 3.5, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'bomb': {
      const cx = ox + TILE / 2;
      const cy = oy + TILE / 2;
      ctx.fillStyle = '#1c1c22';
      circle(ctx, cx, cy + 1, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      circle(ctx, cx - 2, cy - 1, 1.5);
      ctx.strokeStyle = '#a07040';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - 4);
      ctx.quadraticCurveTo(cx + 6, cy - 9, cx + 8, cy - 7);
      ctx.stroke();
      ctx.fillStyle = frame % 10 < 5 ? '#ffd23f' : '#ff6b35';
      circle(ctx, cx + 8, cy - 7, 1.6);
      break;
    }
  }
}

/** Draw a prop centered in a box (for crate cards). */
export function drawPropPreview(ctx: CanvasRenderingContext2D, def: PropDef, cx: number, cy: number, frame: number, maxSize = 48): void {
  const cells = footprint(def, 0);
  let w = 1;
  let h = 1;
  for (const [x, y] of cells) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  if (def.kind === 'mover') {
    w = def.length;
    h = 1;
  }
  if (def.kind === 'saw') w = h = Math.max(1, def.radius * 2);
  const scale = Math.min(2, maxSize / (Math.max(w, h) * TILE));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const pp: PlacedProp = { uid: 0, def: def.kind === 'saw' || def.kind === 'mover' ? { ...def, range: 0 } : def, owner: -1, tx: 0, ty: 0, rot: 0 };
  const offX = def.kind === 'saw' ? -TILE / 2 : (-w * TILE) / 2;
  const offY = def.kind === 'saw' ? -TILE / 2 : (-h * TILE) / 2;
  ctx.translate(offX, offY);
  drawProp(ctx, null, pp, frame, {}, false);
  ctx.restore();
}
