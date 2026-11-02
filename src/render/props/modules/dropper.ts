import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { DROP_FALL, DROP_REST, DROP_WARN, dirOf, dropperPose, dropperRect, dropperTravel } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { boxPts, dot, INK, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { beamOf, defineArt } from '../common';
import { bevel } from '../machine';

/**
 * Proximity crusher: a heavy carved stone block. Idle it hangs over its lane (faint chevrons show the
 * lane it watches); spotting someone, the arrow rune cut in its face glows red, grit trickles off it and
 * it shakes for the whole telegraph; then it slams with speed streaks. Drawn from the same pose the sim
 * builds its solid from. It's an object, never a character: no face (docs/ART.md, Objects, not characters).
 */

/**
 * The block, baked: a dressed stone with chiselled bevels round a raised face, so it reads as a carved
 * mass and not a tile; a rim of stone teeth, a chipped corner, cracks, and a sunk panel in the middle
 * that the rune is cut into live (it points the way the block slams).
 */
function block(w: number, h: number, stone: HSL) {
  return sprite(`dr|${w}|${h}|${stone.h | 0}`, -2, -2, w + 4, h + 4, (g) => {
    const body = boxPts(0, 0, w, h, 2.6, 5, 0.2);
    tone(g, body, stone, { depth: 1, shade: -14 });
    const k = Math.min(w, h) / TILE;
    const b = 2.7 * k;
    const cx = w / 2;
    const cy = h / 2;
    const pw = 4.6 * k;
    g.save();
    path(g, body);
    g.clip();
    bevel(g, 0, 0, w, h, b, stone);
    // A rim of stone teeth round the face: the crushing block's spiked edge, cut inside its own
    // outline so the hitbox stays the block. Each tooth is lit on the side facing the light.
    const teeth = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, lit: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.round(len / (4.2 * k)));
      const ux = (bx - ax) / n;
      const uy = (by - ay) / n;
      for (let i = 0; i < n; i++) {
        const x0 = ax + ux * i;
        const y0 = ay + uy * i;
        const tip = { x: x0 + ux / 2 + nx * b * 0.9, y: y0 + uy / 2 + ny * b * 0.9 };
        const mid = { x: x0 + ux / 2, y: y0 + uy / 2 };
        g.fillStyle = css(stone, lit + 8);
        path(g, [{ x: x0, y: y0 }, tip, mid]);
        g.fill();
        g.fillStyle = css(stone, lit - 14, 1, 4);
        path(g, [mid, tip, { x: x0 + ux, y: y0 + uy }]);
        g.fill();
        g.fillStyle = INK;
        stroke(g, [{ x: x0, y: y0 }, tip, { x: x0 + ux, y: y0 + uy }], { w: 0.4 * k + 0.15, seed: i + nx * 3 + ny * 7, taper: [0.1, 0.1], press: 0.2 });
      }
    };
    teeth(b, b, w - b, b, 0, -1, 10);
    teeth(w - b, h - b, b, h - b, 0, 1, -14);
    teeth(b, h - b, b, b, -1, 0, 4);
    teeth(w - b, b, w - b, h - b, 1, 0, -8);
    // A chipped corner, top right.
    g.fillStyle = css(stone, -26, 1, 6);
    path(g, poly(w - 4.2 * k, -1, w + 1, -1, w + 1, 3.6 * k, w - 1.4 * k, 1.4 * k));
    g.fill();
    for (let i = 0; i < 4; i++) {
      const tx = b + 1 + hash2(i, 1, w) * (w - b * 2 - 2);
      const ty = b + 1 + hash2(i, 2, h) * (h - b * 2 - 2);
      if (Math.abs(tx - cx) < pw + 1.5 && Math.abs(ty - cy) < pw + 1.5) continue;
      tick(g, tx, ty, tx + 1.4, ty + 0.7, 0.45, i, css(stone, -22, 1, 4));
    }
    // Cracks: a forked one in from the lower left, a short one off the chipped corner.
    g.fillStyle = css(stone, -34, 1, 6);
    const fork = { x: b + 2.4 * k, y: h - b - 2.4 * k };
    stroke(g, [{ x: b * 0.5, y: h - b * 1.3 }, fork, { x: b + 3.8 * k, y: h - b - 2.8 * k }], { w: 0.5 * k + 0.2, seed: 21, taper: [0.1, 0.6], press: 0.2 });
    stroke(g, [fork, { x: b + 2 * k, y: h - b - 4.2 * k }], { w: 0.35 * k + 0.15, seed: 22, taper: [0.1, 0.7], press: 0.2 });
    stroke(g, poly(w - 2.4 * k, 2.2 * k, w - 3.8 * k, 3.8 * k, w - 3.9 * k, 5.2 * k), { w: 0.4 * k + 0.15, seed: 23, taper: [0.1, 0.7], press: 0.2 });
    g.restore();
    pen(g, body, 5, 0.6, 1.7);
    // The sunk panel: in shade under its top and left walls, lit along its lower right lip.
    const panel = boxPts(cx - pw, cy - pw, pw * 2, pw * 2, 1.1 * k, 9, 0.12);
    g.fillStyle = css(stone, -24, 1, 4);
    path(g, panel);
    g.fill();
    g.save();
    path(g, panel);
    g.clip();
    g.fillStyle = css(stone, -7);
    path(g, boxPts(cx - pw + 1.1 * k, cy - pw + 1.1 * k, pw * 2, pw * 2, 1.1 * k, 9, 0.12));
    g.fill();
    g.restore();
    g.fillStyle = css(stone, 20);
    stroke(g, poly(cx - pw + 0.8, cy + pw, cx + pw, cy + pw, cx + pw, cy - pw + 0.8), { w: 0.45 * k + 0.2, seed: 11, taper: [0.3, 0.3], press: 0.2 });
    g.fillStyle = INK;
    stroke(g, poly(cx - pw, cy + pw - 0.6, cx - pw, cy - pw, cx + pw - 0.6, cy - pw), { w: 0.5 * k + 0.25, seed: 12, taper: [0.2, 0.2], press: 0.3 });
  });
}

/** The rune cut in the panel: a chevron pointing the way it slams. A dark groove at rest, red-hot when it's coming. */
function rune(s: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, k: number, hot: HSL | null, stone: HSL) {
  const r = 2.8 * k;
  const at = (a: number, b: number): P => ({ x: cx + dx * a + dy * b, y: cy + dy * a + dx * b });
  const pts = [at(-r * 0.45, -r), at(r * 0.65, 0), at(-r * 0.45, r)];
  // The groove's lit lower lip, then the cut, then what glows in it.
  s.fillStyle = css(stone, 18);
  stroke(
    s,
    pts.map((p) => ({ x: p.x + 0.4 * k, y: p.y + 0.45 * k })),
    { w: 1 * k, seed: 3, taper: [0.1, 0.1], press: 0 },
  );
  s.fillStyle = INK;
  stroke(s, pts, { w: 1.25 * k, seed: 4, taper: [0.1, 0.1], press: 0 });
  if (hot) {
    s.fillStyle = css(hot, 12);
    stroke(s, pts, { w: 0.7 * k, seed: 6, taper: [0.15, 0.15], press: 0 });
  }
}

defineArt<'dropper'>({
  type: 'dropper',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const p = dropperPose(d.o.state, d.mi, rc.frame);
    const [dx, dy] = dirOf(m.angle);
    const base = dropperRect(m, d.off[0], d.off[1]);
    const warn = p.state === DROP_WARN;
    const shake = warn ? (hash2(rc.frame, d.mi, d.r.pp.uid) - 0.5) * 2.4 : 0;
    const x = base.x + dx * p.d + shake;
    const y = base.y + dy * p.d;
    const { w, h } = base;
    const stone: HSL = { h: d.style.hue, s: 10, l: 46 };
    const coming = warn || p.state === DROP_FALL;
    const hot: HSL = coming ? { h: 0, s: 100, l: 58 } : { h: 50, s: 90, l: 62 };
    // Lane chevrons (where it will land).
    if (p.state !== DROP_FALL && p.state !== DROP_REST) {
      const travel = beamOf(d.o, d.r, d.mi)?.len ?? dropperTravel(d.o.level, m);
      g.strokeStyle = css(hot, 0, warn ? 0.5 : 0.12);
      g.lineWidth = 1;
      for (let k = TILE * 0.8; k < travel; k += TILE) {
        const cx = base.x + base.w / 2 + dx * (k + (dx > 0 ? base.w / 2 : dx < 0 ? -base.w / 2 : 0));
        const cy = base.y + base.h / 2 + dy * (k + (dy > 0 ? base.h / 2 : dy < 0 ? -base.h / 2 : 0));
        g.beginPath();
        g.moveTo(cx - dy * 4 - dx * 2, cy - dx * 4 - dy * 2);
        g.lineTo(cx + dx * 2, cy + dy * 2);
        g.lineTo(cx + dy * 4 - dx * 2, cy + dx * 4 - dy * 2);
        g.stroke();
      }
    }
    if (p.state === DROP_FALL) {
      s.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 1; i < 4; i++) {
        const lx = x + (w * i) / 4;
        const ly = y + (h * i) / 4;
        if (dy !== 0) line(s, lx, y - dy * 4, lx, y - dy * 14, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
        else line(s, x - dx * 4, ly, x - dx * 14, ly, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
      }
    }
    stamp(s, block(w, h, stone), x, y);
    // Studs on the slamming face: that's the side that hurts.
    const n = Math.max(2, Math.round((dy !== 0 ? w : h) / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const fx = dy !== 0 ? x + w * t : dx > 0 ? x + w - 1.6 : x + 1.6;
      const fy = dy !== 0 ? (dy > 0 ? y + h - 1.6 : y + 1.6) : y + h * t;
      dot(s, fx, fy, 1.05, i, css(d.pal.light));
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const k = Math.min(w, h) / TILE;
    rune(s, cx, cy, dx, dy, k, coming ? hot : null, stone);
    if (coming) {
      glowDot(g, cx, cy, 9 * k, hot, 0.4);
      light(rc, cx, cy, 40, hot, 0.5);
    }
    // Grit shaken loose off its underside while it shudders: the creak you can see.
    if (warn && d.o.emit && Math.random() < 0.4) d.o.emit('debris', x + 2 + Math.random() * (w - 4), y + h, (Math.random() - 0.5) * 20, 10, stone);
  },
});
