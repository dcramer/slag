import { deriveSeed } from '../../core/rng';
import { CAST_KINDS, type CastMode } from '../../gen/cast';
import { type CharacterDef, generateCharacter } from '../../gen/character';
import { Rig } from '../character';
import { drawInkAccessory, drawInkRunner, type RunnerPose } from '../ink-character';
import { castDef, castMode, pinCast, setCastMode } from '.';

/**
 * The prototype catalog for docs/CHARACTERS.md: every kind of one direction twice (two seeds), a row of
 * poses, and the whole set at play scale, on a canvas over the page. Debug only (`slagDebug.cast`).
 */

const POSES: [string, Partial<RunnerPose>][] = [
  ['idle', { grounded: true }],
  ['walk', { grounded: true, vx: 100 }],
  ['run', { grounded: true, vx: 260 }],
  ['jump', { grounded: false, vy: -320 }],
  ['fall', { grounded: false, vy: 420 }],
  ['wall', { grounded: false, vy: 60, wall: 1 }],
  ['cheer', { grounded: true, celebrate: true }],
];

function def(i: number, salt: string): CharacterDef {
  return generateCharacter(deriveSeed(0x5ca7, `${salt}:${i}`));
}

/** Draws the catalog for `mode` on a full-window canvas and returns it (call `.remove()` to clear). */
export function castCatalog(mode: CastMode, t = 0.4): HTMLCanvasElement {
  const prev = castMode();
  setCastMode(mode);
  const kinds = CAST_KINDS[mode];
  const cols = 8;
  const rows = Math.ceil(kinds.length / cols);
  const cell = 230;
  const big = 5.4;
  const W = cols * cell + 40;
  const H = 80 + rows * 200 + 360;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#1a1210';
  s.fillRect(0, 0, W, H);
  s.font = '15px Barlow, sans-serif';
  s.textAlign = 'center';
  const label = (txt: string, x: number, y: number, size = 15, color = '#c9b8a3') => {
    s.font = `700 ${size}px Barlow, sans-serif`;
    s.fillStyle = color;
    s.fillText(txt, x, y);
  };
  const run = (c: CharacterDef, x: number, y: number, p: Partial<RunnerPose>, scale: number, facing = 1) => {
    // In world units at the origin, then scaled, so the rig's tail hangs as it does in a race.
    s.save();
    s.translate(x, y);
    s.scale(scale, scale);
    const cc = castDef(c);
    if (cc.accessory !== 'none') {
      const rig = new Rig();
      const ay = cc.accessory === 'tail' ? -4 : cc.accessory === 'cape' ? -12 : -10;
      for (let i = 0; i < 90; i++) rig.step(cc, -facing * 4, ay, 1 / 60, -(p.vx ?? 0) * facing * 0.6 - facing * 8, -0.8);
      drawInkAccessory(s, cc, rig);
    }
    drawInkRunner({ s, g: null }, cc, 0, 0, { facing, vy: 0, grounded: true, t, ...p, vx: (p.vx ?? 0) * facing });
    s.restore();
  };
  label(
    `${mode.toUpperCase()}: ${{ a: 'Creature prints', b: 'Species cast', c: 'Foundry toys' }[mode]} (${kinds.length} kinds, two seeds each)`,
    W / 2,
    30,
    20,
    '#f6ead8',
  );
  // Every kind, two seeds: the second shows the variation inside a kind.
  kinds.forEach((name, i) => {
    const cx = 20 + (i % cols) * cell + cell / 2;
    const cy = 50 + Math.floor(i / cols) * 200;
    for (let j = 0; j < 2; j++) {
      const c = def(i * 2 + j, mode);
      pinCast(mode, c.seed, i);
      run(c, cx - 52 + j * 104, cy + 130, j ? { grounded: true, vx: 120 } : { grounded: true }, big, j ? 1 : -1);
    }
    label(name, cx, cy + 165);
  });
  // Poses, on one character.
  const py = 60 + rows * 200;
  label('Poses', 70, py + 20, 15, '#f6ead8');
  const pc = def(0, mode);
  POSES.forEach(([name, p], i) => {
    const x = 160 + i * 230;
    run(pc, x, py + 150, { ...p, t: t + (p.vx ? 0.13 : 0) }, big, 1);
    label(name, x, py + 185);
  });
  // The whole set at play scale (2.5 screen px per world px, as at 1080p), on dark and light ground.
  const qy = py + 210;
  label('Play scale', 70, qy + 20, 15, '#f6ead8');
  s.fillStyle = '#d9cbb2';
  s.fillRect(W / 2, qy, W / 2, 120);
  kinds.forEach((_, i) => {
    const c = def(i * 2, mode);
    const step = (W / 2 - 60) / kinds.length;
    run(c, 60 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5);
    run(c, W / 2 + 30 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5);
  });
  document.body.appendChild(cv);
  setCastMode(prev);
  return cv;
}

/**
 * Milliseconds to draw one runner, averaged over `n` frames of 8 runners, for today's drawer and for
 * `mode`'s. Only the relative number means anything.
 */
export function castBench(mode: CastMode, n = 200): { base: number; proto: number } {
  const cv = document.createElement('canvas');
  cv.width = 800;
  cv.height = 200;
  const s = cv.getContext('2d')!;
  const cs = Array.from({ length: 8 }, (_, i) => def(i, 'bench'));
  const prev = castMode();
  const time = (m: CastMode | null) => {
    setCastMode(m);
    const t0 = performance.now();
    for (let f = 0; f < n; f++) {
      s.clearRect(0, 0, 800, 200);
      cs.forEach((c, i) => drawInkRunner({ s, g: null }, c, 50 + i * 90, 150, { facing: 1, vx: 120, vy: 0, grounded: true, t: f / 60, scale: 2.5 }));
    }
    return (performance.now() - t0) / (n * 8);
  };
  time(mode);
  const base = time(null);
  const proto = time(mode);
  setCastMode(prev);
  return { base, proto };
}
