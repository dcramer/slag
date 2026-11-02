import { css, type HSL } from '../../../core/color';
import type { CharacterDef } from '../../../gen/character';
import { type Grip, KEG, kegAim, type ModuleOf } from '../../../sim/props';
import type { Runner, RunWorld } from '../../../sim/run';
import { drawCharacter } from '../../character';
import { glowDot, light, type RC } from '../../kit';
import { defineArt, gripOf } from '../common';

type Keg = ModuleOf<'keg'>;

const QUARTER = Math.PI / 4;
const INK = '#120b08';
const AMBER: HSL = { h: 36, s: 100, l: 59 };
const WHITE_HOT: HSL = { h: 48, s: 100, l: 86 };
/** Half the cask's length (px), hub to mouth. */
const MOUTH = 13;
/** Frames the cask kicks back after firing. */
const RECOIL = 9;

/** Smoothstep-eased angle (radians) of a tipping keg, or the stop it locked to once lit. */
function shownAngle(m: Keg, grip: Grip | undefined, frame: number, phase: number): number {
  if (grip && grip.fuse >= 0) return grip.aim * QUARTER;
  const { from, dir, turn } = kegAim(m, frame, phase);
  const u = turn * turn * (3 - 2 * turn);
  const delta = ((dir - from + 12) % 8) - 4;
  return (from + delta * u) * QUARTER;
}

/** Three chevrons marching out of the mouth: the way you'll go, readable at gameplay scale without a word. */
function aimChevrons(rc: RC, x: number, y: number, a: number, heat: number, alpha: number) {
  const s = rc.s;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const c = heat > 0 ? WHITE_HOT : AMBER;
  const march = (rc.frame / (heat > 0 ? 4 : 12)) % 1;
  for (let i = 0; i < 3; i++) {
    const r = MOUTH + 8 + (i + march) * 9;
    const px = x + dx * r;
    const py = y + dy * r;
    const fade = alpha * (1 - (i + march) / 4);
    for (const [style, width] of [
      [`rgba(18,11,8,${fade})`, 3.4],
      [css(c, 0, fade), 1.8],
    ] as const) {
      s.strokeStyle = style;
      s.lineWidth = width;
      s.lineCap = 'round';
      s.beginPath();
      s.moveTo(px - dx * 3.5 - dy * 4.5, py - dy * 3.5 + dx * 4.5);
      s.lineTo(px + dx * 1.5, py + dy * 1.5);
      s.lineTo(px - dx * 3.5 + dy * 4.5, py - dy * 3.5 - dx * 4.5);
      s.stroke();
    }
  }
}

/** The cask, in its own frame with +x out of the mouth. */
function cask(s: CanvasRenderingContext2D, wood: HSL, hoop: string, hoopDark: string) {
  s.beginPath();
  s.moveTo(-MOUTH, -8);
  s.quadraticCurveTo(0, -13.5, MOUTH, -8);
  s.lineTo(MOUTH, 8);
  s.quadraticCurveTo(0, 13.5, -MOUTH, 8);
  s.closePath();
  s.fillStyle = css(wood);
  s.fill();
  s.strokeStyle = INK;
  s.lineWidth = 1.3;
  s.stroke();
  s.lineWidth = 0.7;
  s.strokeStyle = css(wood, -14, 0.8);
  for (const k of [-5.5, -1.8, 1.8, 5.5]) {
    s.beginPath();
    s.moveTo(-MOUTH, k * 0.8);
    s.quadraticCurveTo(0, k * 1.35, MOUTH, k * 0.8);
    s.stroke();
  }
  s.fillStyle = css(wood, 12, 0.35);
  s.fillRect(-MOUTH + 3, -8.5, MOUTH * 2 - 6, 2);
  for (const hx of [-8, 8]) {
    s.fillStyle = hoopDark;
    s.fillRect(hx - 1.6, -11, 3.2, 22);
    s.fillStyle = hoop;
    s.fillRect(hx - 1, -10.6, 1.6, 21.2);
  }
  // The moonshine stencil every cartoon jug wears.
  s.strokeStyle = css(wood, 34);
  s.lineWidth = 1.2;
  s.lineCap = 'butt';
  for (const cx of [-3.6, 0, 3.6]) {
    s.beginPath();
    s.moveTo(cx - 1.4, -2.4);
    s.lineTo(cx + 1.4, 2.4);
    s.moveTo(cx + 1.4, -2.4);
    s.lineTo(cx - 1.4, 2.4);
    s.stroke();
  }
  // The mouth.
  s.fillStyle = INK;
  s.beginPath();
  s.ellipse(MOUTH, 0, 2.6, 8, 0, 0, Math.PI * 2);
  s.fill();
  s.strokeStyle = hoop;
  s.lineWidth = 1;
  s.stroke();
}

/**
 * A moonshine keg with a fuse out of its rear. The fuse burns down while
 * someone's inside, which is the only warning you get. Lit, the cask stops
 * dead on its aim, shakes and swells until it goes off.
 */
defineArt<'keg'>({
  type: 'keg',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const grip = gripOf(d);
    const lit = !!grip && grip.fuse >= 0;
    const a = shownAngle(m, grip, rc.frame, d.r.phase);
    const burnt = grip ? Math.min(1, grip.t / m.burn) : 0;
    const swell = lit ? 1 - Math.max(0, grip.fuse) / m.delay : 0;
    // The last third of the fuse shakes the cask too: that's the tell for a backfire.
    const shake = lit ? 0.9 : grip ? Math.max(0, burnt - 0.66) * 2.4 : 0;
    const x = m.at[0] + d.off[0] + (rc.frame & 1 ? shake : -shake);
    const y = m.at[1] + d.off[1] + (rc.frame & 2 ? shake : -shake);
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const kick = since < RECOIL ? (RECOIL - since) * 0.7 : 0;
    const settled = kegAim(m, rc.frame, d.r.phase).turn >= 1;
    aimChevrons(rc, m.at[0] + d.off[0], m.at[1] + d.off[1], a, swell, lit ? 1 : grip ? (settled ? 0.95 : 0.4) : settled ? 0.6 : 0.25);

    s.save();
    s.translate(x, y);
    s.rotate(a);
    s.translate(-kick, 0);
    s.scale(1 + swell * 0.14, 1 + swell * 0.2);
    // The fuse, shortest when it's nearly gone.
    const cord = 9 * (1 - burnt);
    s.lineCap = 'round';
    s.strokeStyle = INK;
    s.lineWidth = 2.2;
    s.beginPath();
    s.moveTo(-MOUTH, 0);
    s.quadraticCurveTo(-MOUTH - cord * 0.5, 3, -MOUTH - cord, 0);
    s.stroke();
    s.strokeStyle = '#d9c7a1';
    s.lineWidth = 1;
    s.stroke();
    cask(s, { h: d.style.woodHue, s: 50, l: 36 }, css(d.pal.light), css(d.pal.dark, -8));
    s.restore();

    if (grip) {
      const tx = x - Math.cos(a) * (MOUTH + cord + kick);
      const ty = y - Math.sin(a) * (MOUTH + cord + kick);
      glowDot(g, tx, ty, 6 + burnt * 4, AMBER, 0.9);
      if (rc.frame % 3 === 0) d.o.emit?.('spark', tx, ty, -Math.cos(a) * 40, -Math.sin(a) * 40, AMBER);
    }
    if (lit) {
      const mx = x + Math.cos(a) * MOUTH;
      const my = y + Math.sin(a) * MOUTH;
      glowDot(g, mx, my, 6 + swell * 7, WHITE_HOT, 0.25 + swell * 0.35);
      light(rc, mx, my, 30 + swell * 20, AMBER, 0.3 + swell * 0.4);
    }
  },
});

/** Grip distance (px) at which a runner reads as fully stuffed in. */
const SETTLED = KEG.zone * 0.5;

/** A stuffed runner: the top half of them poking out of the mouth, wherever it points. */
export function drawStuffed(rc: RC, run: RunWorld, r: Runner, c: CharacterDef): void {
  const g = r.attach.grip;
  const rp = g && run.resolved.find((x) => x.pp.uid === g.uid);
  const m = g && rp?.mods[g.mi];
  if (!g || !rp || m?.type !== 'keg') return;
  const a = shownAngle(m, g, rc.frame, rp.phase);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hx = m.at[0];
  const hy = m.at[1];
  const out = Math.min(1, Math.sqrt(g.x * g.x + g.y * g.y) / SETTLED);
  const cx = hx + g.x + dx * MOUTH * (1 - out);
  const cy = hy + g.y + dy * MOUTH * (1 - out);
  const s = rc.s;
  s.save();
  s.beginPath();
  // Everything behind the mouth's plane stays hidden inside the cask.
  const nx = hx + dx * MOUTH;
  const ny = hy + dy * MOUTH;
  s.moveTo(nx - dy * 40, ny + dx * 40);
  s.lineTo(nx + dy * 40, ny - dx * 40);
  s.lineTo(nx + dy * 40 + dx * 40, ny - dx * 40 + dy * 40);
  s.lineTo(nx - dy * 40 + dx * 40, ny + dx * 40 + dy * 40);
  s.closePath();
  s.clip();
  drawCharacter(rc, c, cx, cy + 8, { facing: dx < 0 ? -1 : 1, vx: 0, vy: 0, grounded: true, t: rc.t, scale: 0.9 });
  s.restore();
}
