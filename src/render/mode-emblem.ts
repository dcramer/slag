import type { ModeId } from '../game/modes';
import { PAL } from '../ui/style';

/**
 * Each playstyle mode's emblem (game/modes.ts), drawn flat in the UI's own palette for the lobby's Mode plate and
 * the Mode card: what the mode is about at a glance, with no words. A new mode adds its emblem here.
 */
type Ctx = CanvasRenderingContext2D;

/** Draw within a box `s` px tall centred on (cx, cy). */
type Emblem = (c: Ctx, cx: number, cy: number, s: number) => void;

/** Race: the chequered flag at the end of the course, on its pole over a stretch of ground. */
const race: Emblem = (c, cx, cy, s) => {
  const u = s / 10;
  c.fillStyle = PAL.ash;
  c.fillRect(cx - 3 * u, cy - 4.6 * u, 0.7 * u, 9.2 * u);
  const fx = cx - 2.3 * u;
  const fy = cy - 4.6 * u;
  const cw = 1.8 * u;
  // The flag's ink edge: a square of ink under the checks, a little bigger.
  const rim = Math.max(1, u * 0.35);
  c.fillStyle = PAL.ink;
  c.fillRect(fx - rim, fy - rim, 3 * cw + 2 * rim, 3 * cw + 2 * rim);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      c.fillStyle = (row + col) % 2 ? PAL.ink : PAL.bone;
      c.fillRect(fx + col * cw, fy + row * cw, cw, cw);
    }
  c.fillStyle = PAL.steel;
  c.fillRect(cx - 5 * u, cy + 4.4 * u, 10 * u, 0.9 * u);
};

/** Rising Slag: a walled shaft, two ledges going up it, and molten slag climbing out of the bottom. */
const slag: Emblem = (c, cx, cy, s) => {
  const u = s / 10;
  c.fillStyle = PAL.steel;
  c.fillRect(cx - 4.6 * u, cy - 5 * u, 1.1 * u, 10 * u);
  c.fillRect(cx + 3.5 * u, cy - 5 * u, 1.1 * u, 10 * u);
  c.fillStyle = PAL.ash;
  c.fillRect(cx - 3.5 * u, cy - 2.6 * u, 3.6 * u, 0.8 * u);
  c.fillRect(cx - 0.2 * u, cy + 0.6 * u, 3.7 * u, 0.8 * u);
  // The slag: a wavy crest in the light band over the molten body.
  const top = cy + 2.5 * u;
  const wave = (y: number) => {
    c.beginPath();
    c.moveTo(cx - 3.5 * u, cy + 5 * u);
    for (let i = 0; i <= 8; i++) c.lineTo(cx - 3.5 * u + i * 0.875 * u, y + (i % 2 ? -0.45 : 0.45) * u);
    c.lineTo(cx + 3.5 * u, cy + 5 * u);
    c.closePath();
    c.fill();
  };
  c.fillStyle = PAL.amber;
  wave(top);
  c.fillStyle = PAL.molten;
  wave(top + 0.9 * u);
  c.fillStyle = PAL.ember;
  c.fillRect(cx - 3.5 * u, cy + 4.1 * u, 7 * u, 0.9 * u);
  // An ember coming off it.
  c.fillStyle = PAL.whiteHot;
  c.fillRect(cx + 1.6 * u, cy - 0.6 * u, 0.6 * u, 0.6 * u);
};

/** Brawl: a saw blade spinning at the edge of a ledge, and a burst where someone was knocked into it. */
const brawl: Emblem = (c, cx, cy, s) => {
  const u = s / 10;
  // The ledge.
  c.fillStyle = PAL.steel;
  c.fillRect(cx - 5 * u, cy + 3.6 * u, 10 * u, 0.9 * u);
  // The saw: a toothed disc, its hub, standing on the ledge.
  const sx = cx + 1.8 * u;
  const sy = cy + 0.4 * u;
  const teeth = 10;
  c.fillStyle = PAL.ash;
  c.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = (i % 2 ? 2.4 : 3.2) * u;
    if (i === 0) c.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    else c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.fillStyle = PAL.steel;
  c.beginPath();
  c.arc(sx, sy, 0.9 * u, 0, Math.PI * 2);
  c.fill();
  // The burst on its near side, and the streaks of whoever flew into it.
  const bx = cx - 1.6 * u;
  const by = cy - 0.6 * u;
  c.fillStyle = PAL.amber;
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = (i % 2 ? 0.8 : 2) * u;
    if (i === 0) c.moveTo(bx + Math.cos(a) * r, by + Math.sin(a) * r);
    else c.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.fillStyle = PAL.whiteHot;
  c.fillRect(bx - 0.4 * u, by - 0.4 * u, 0.8 * u, 0.8 * u);
  c.fillStyle = PAL.molten;
  c.fillRect(cx - 5 * u, cy - 1.6 * u, 1.8 * u, 0.5 * u);
  c.fillRect(cx - 4.6 * u, cy - 0.2 * u, 1.4 * u, 0.5 * u);
};

export const MODE_EMBLEMS: Record<ModeId, Emblem> = { race, slag, brawl };

/** Draw `mode`'s emblem `s` px tall, centred on (cx, cy). */
export function modeEmblem(c: Ctx, mode: ModeId, cx: number, cy: number, s: number) {
  c.save();
  MODE_EMBLEMS[mode](c, cx, cy, s);
  c.restore();
}
