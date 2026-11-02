import { deriveSeed } from '../../core/rng';
import { type CharacterDef, generateCharacter, TOYS } from '../../gen/character';
import { Rig } from '../character';
import { drawInkAccessory, drawInkRunner, ropeOf, type RunnerPose } from '../ink-character';
import { STRIDE } from '../ink-figure';

/**
 * The toy catalog for docs/CHARACTERS.md and `pnpm shot cast`: every kind on two seeds, a row of
 * poses, and the whole cast at play scale on dark and light ground, on a canvas over the page. Debug
 * only (`slagDebug.toys`).
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

const def = (i: number, salt: string, toy = TOYS[i % TOYS.length]): CharacterDef => generateCharacter(deriveSeed(0x5ca7, `${salt}:${i}`), toy);

/** Stride phase for a mid-run pose: every gait is well into its stride here, none at rest. */
const MID_RUN = 2.4 * STRIDE;

function runner(
  s: CanvasRenderingContext2D,
  c: CharacterDef,
  x: number,
  y: number,
  p: Partial<RunnerPose>,
  scale: number,
  facing: number,
  t: number,
  stride = 0,
) {
  // In world units at the origin, then scaled, so the rig's string or scarf hangs as it does in a race.
  // The runner's x sets its stride phase, so `stride` shifts it there and back.
  s.save();
  s.translate(x, y);
  s.scale(scale, scale);
  s.translate(-stride, 0);
  const rope = ropeOf(c);
  if (rope) {
    const rig = new Rig();
    for (let i = 0; i < 90; i++) rig.step(rope, -facing * 5, rope.kind === 'string' ? -3 : -10, 1 / 60, -(p.vx ?? 0) * 0.6 - facing * 8, -0.8);
    drawInkAccessory(s, c, rig);
  }
  if (rope) s.translate(stride, 0);
  drawInkRunner({ s, g: null }, c, rope ? 0 : stride, 0, { facing, vy: 0, grounded: true, t, ...p, vx: (p.vx ?? 0) * facing });
  s.restore();
}

/** Draws the catalog on a full-window canvas and returns it (call `.remove()` to clear). */
export function toyCatalog(t = 0.4): HTMLCanvasElement {
  const cols = 8;
  const rows = Math.ceil(TOYS.length / cols);
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
  s.textAlign = 'center';
  const label = (txt: string, x: number, y: number, size = 15, color = '#c9b8a3') => {
    s.font = `700 ${size}px Barlow, sans-serif`;
    s.fillStyle = color;
    s.fillText(txt, x, y);
  };
  label(`The foundry toys: ${TOYS.length} kinds, two seeds each`, W / 2, 30, 20, '#f6ead8');
  TOYS.forEach((name, i) => {
    const cx = 20 + (i % cols) * cell + cell / 2;
    const cy = 50 + Math.floor(i / cols) * 200;
    for (let j = 0; j < 2; j++)
      runner(s, def(i * 2 + j, 'cat', name), cx - 52 + j * 104, cy + 130, j ? { grounded: true, vx: 120 } : { grounded: true }, big, j ? 1 : -1, t);
    label(name, cx, cy + 165);
  });
  const py = 60 + rows * 200;
  label('Poses', 70, py + 20, 15, '#f6ead8');
  const pc = def(0, 'pose', 'robot');
  POSES.forEach(([name, p], i) => {
    const x = 160 + i * 230;
    runner(s, pc, x, py + 150, p, big, 1, t + (p.vx ? 0.13 : 0));
    label(name, x, py + 185);
  });
  // The whole cast at play scale (2.5 screen px per world px, as at 1080p), on dark and light ground.
  const qy = py + 210;
  label('Play scale', 70, qy + 20, 15, '#f6ead8');
  s.fillStyle = '#d9cbb2';
  s.fillRect(W / 2, qy, W / 2, 120);
  const step = (W / 2 - 60) / TOYS.length;
  TOYS.forEach((name, i) => {
    const c = def(i * 2, 'cat', name);
    runner(s, c, 60 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5, 1, t);
    runner(s, c, W / 2 + 30 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5, 1, t);
  });
  document.body.appendChild(cv);
  return cv;
}

/**
 * The silhouette test: every kind as a solid black shape, at rest and mid-run, at 1 px per world px (a
 * runner about 16 px tall) and at play scale (2.5×, as at 1080p), then mid-run in color on dark and light
 * ground. Each should be nameable from its shape alone, and no two should share one.
 */
export function toySilhouettes(t = 0.4): HTMLCanvasElement {
  const n = TOYS.length;
  const cell = 150;
  const W = n * cell + 40;
  const H = 860;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#e9dcc4';
  s.fillRect(0, 0, W, H);
  s.fillStyle = '#1a1210';
  s.fillRect(0, 700, W / 2, 160);
  s.textAlign = 'center';
  const label = (txt: string, x: number, y: number, size = 14, color = '#3d2e26') => {
    s.font = `700 ${size}px Barlow, sans-serif`;
    s.fillStyle = color;
    s.fillText(txt, x, y);
  };
  const scratch = document.createElement('canvas');
  scratch.width = cell;
  scratch.height = 130;
  const g = scratch.getContext('2d')!;
  /** One kind as a solid shape: drawn, then everything it covered filled black. */
  const solid = (c: CharacterDef, x: number, y: number, scale: number, p: Partial<RunnerPose>, stride: number) => {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cell, 130);
    runner(g, c, cell / 2, 112, p, scale, 1, t, stride);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, cell, 130);
    s.drawImage(scratch, x - cell / 2, y - 112);
  };
  const rows: [string, number, Partial<RunnerPose>, number, number][] = [
    ['At rest, 1 px per world px (about 16 px tall)', 70, { grounded: true }, 1, 0],
    ['Mid-run, 1 px per world px', 150, { grounded: true, vx: 260 }, 1, MID_RUN],
    ['At rest, play scale (2.5×, as at 1080p)', 300, { grounded: true }, 2.5, 0],
    ['Mid-run, play scale', 450, { grounded: true, vx: 260 }, 2.5, MID_RUN],
  ];
  label(`The silhouette test: ${n} kinds`, W / 2, 24, 20, '#120b08');
  for (const [name, y, pose, scale, stride] of rows) {
    label(name, 110, y - (scale > 1 ? 70 : 34), 13);
    TOYS.forEach((toy, i) => solid(def(i * 2, 'cat', toy), 20 + cell * (i + 0.5), y, scale, pose, stride));
  }
  TOYS.forEach((toy, i) => label(toy, 20 + cell * (i + 0.5), 476));
  // Mid-run, in color, on light ground and on dark.
  label('Mid-run, in color, play scale', 110, 520, 13);
  TOYS.forEach((toy, i) => runner(s, def(i * 2, 'cat', toy), 20 + cell * (i + 0.5), 640, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN));
  TOYS.forEach((toy, i) => {
    const x = (W / 2 / n) * (i + 0.5);
    runner(s, def(i * 2, 'cat', toy), x, 820, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN);
  });
  TOYS.forEach((toy, i) => runner(s, def(i * 2, 'cat', toy), W / 2 + (W / 2 / n) * (i + 0.5), 820, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN));
  document.body.appendChild(cv);
  return cv;
}

/** Milliseconds to draw one runner, averaged over `n` frames of 8 different toys running. */
export function toyBench(n = 200): number {
  const cv = document.createElement('canvas');
  cv.width = 800;
  cv.height = 200;
  const s = cv.getContext('2d')!;
  const cs = Array.from({ length: 8 }, (_, i) => def(i * 2, 'bench'));
  const time = () => {
    const t0 = performance.now();
    for (let f = 0; f < n; f++) {
      s.clearRect(0, 0, 800, 200);
      cs.forEach((c, i) => drawInkRunner({ s, g: null }, c, 50 + i * 90, 150, { facing: 1, vx: 120, vy: 0, grounded: true, t: f / 60, scale: 2.5 }));
    }
    return (performance.now() - t0) / (n * 8);
  };
  time();
  return time();
}
