import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { SNAP_ARM, SNAP_COOL, SNAP_SPIKE, SNAP_UP, snapperPhase } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { boxPts, dot, INK, part, path, sprite, stamp } from '../../ink-props';
import { bulb, type MetalPalette } from '../../kit';
import { defineArt } from '../common';

/** The plate, baked in the cell's frame with -y as the face normal: riveted, with a slot per spike. */
function plate(pal: MetalPalette) {
  return sprite(`sn|${pal.base.h},${pal.base.l}`, -9, -12, 18, 6, (g) => {
    // Dark iron, so it reads apart from whatever it's bolted to, with a lit lip along its top.
    const iron: HSL = { h: pal.base.h, s: Math.min(pal.base.s, 22), l: 30 };
    const body = boxPts(-8, -11, 16, 3.2, 0.8, 3, 0.1);
    part(g, body, iron, 3, { depth: 0.6, thin: 0.5, thick: 1.3, shade: -10 });
    g.fillStyle = css(iron, 22);
    line(g, -7.2, -10.7, 7.2, -10.7, { w: 0.5, seed: 4, taper: [0.1, 0.1], press: 0.1 });
    // A slot per spike, with the tip's glint deep inside it.
    for (let i = 0; i < 4; i++) {
      g.fillStyle = INK;
      path(g, boxPts(-7.2 + i * 4, -10.4, 2.4, 1.3, 0.4, 5 + i, 0));
      g.fill();
      g.fillStyle = '#9aa0ac';
      g.fillRect(-6.3 + i * 4, -9.6, 0.6, 0.4);
    }
    for (const x of [-7.3, 7.3]) dot(g, x, -9, 0.5, x, css(pal.light));
  });
}

const STREAMERS = ['#ff4f8b', '#ffd23a', '#3ad1ff', '#7be36a'];

/**
 * Pop-up spike plate, a surprise party (docs/PARODY.md, snapper). Tips peek and rattle while arming, shoot
 * out to SNAP_SPIKE px while up (exactly the sim's lethal strip) with party streamers curling out of the
 * slots, and sink back during cooldown.
 */
defineArt<'snapper'>({
  type: 'snapper',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const ph = snapperPhase(m, d.o.state, d.mi, rc.frame);
    let ext = 0;
    if (ph.seg === SNAP_ARM) ext = 1.5 + (Math.floor(rc.frame / 2) % 2) * 1.2;
    else if (ph.seg === SNAP_UP) ext = SNAP_SPIKE * Math.min(1, ph.u * 6);
    else if (ph.seg === SNAP_COOL) ext = SNAP_SPIKE * (1 - Math.min(1, ph.u * 2.5)) * 0.8;
    // Which half of a spike is lit: the one facing up-left, whichever way the face turns.
    const ca = Math.cos(m.angle + Math.PI / 2);
    for (const [cx, cy] of m.cells) {
      s.save();
      s.translate((cx + 0.5) * TILE + d.off[0], (cy + 0.5) * TILE + d.off[1]);
      s.rotate(m.angle + Math.PI / 2);
      const top = -TILE / 2;
      if (ext > 0) {
        if (ph.seg === SNAP_UP) {
          // Streamers burst out between the spikes and curl.
          const u = Math.min(1, ph.u * 4);
          for (let i = 0; i < 3; i++) {
            const bx = -4 + i * 4;
            const pts: P[] = [];
            for (let k = 0; k <= 8; k++) {
              const t = k / 8;
              pts.push({ x: bx + Math.sin(t * 7 + i * 2 + rc.t * 6) * 1.6 * t, y: top - t * (SNAP_SPIKE + 3) * u });
            }
            s.fillStyle = STREAMERS[(i + cx + cy) % STREAMERS.length];
            stroke(s, pts, { w: 1.1, seed: i, taper: [0.05, 0.2], press: 0.1 });
          }
        }
        for (let i = 0; i < 4; i++) {
          const bx = -6 + i * 4;
          const tip = { x: bx, y: top - ext };
          const l = { x: bx - 1.7, y: top };
          const r = { x: bx + 1.7, y: top };
          const mid = { x: bx, y: top };
          s.fillStyle = INK;
          path(s, [
            { x: l.x - 0.5, y: l.y },
            { x: tip.x, y: tip.y - 0.7 },
            { x: r.x + 0.5, y: r.y },
          ]);
          s.fill();
          s.fillStyle = ca >= 0 ? '#eef1f6' : '#8a909c';
          path(s, [l, tip, mid]);
          s.fill();
          s.fillStyle = ca >= 0 ? '#8a909c' : '#eef1f6';
          path(s, [mid, tip, r]);
          s.fill();
        }
      }
      stamp(s, plate(d.pal));
      s.restore();
      if (ph.seg === SNAP_ARM) {
        const [nx, ny] = [Math.cos(m.angle), Math.sin(m.angle)];
        bulb(g, (cx + 0.5 + nx * 0.5) * TILE + d.off[0], (cy + 0.5 + ny * 0.5) * TILE + d.off[1], 1.8, { h: 10, s: 100, l: 55 }, 0.5 + ph.u * 0.5);
      }
    }
  },
});
