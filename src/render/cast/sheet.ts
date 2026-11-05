import { deriveSeed } from '../../core/rng';
import { CAST, type CharacterDef, generateCharacter, type Kind, PLAYER_COLORS, withColor } from '../../gen/character';
import { Rig } from '../character';
import { drawInkAccessory, drawInkRunner, ropeAnchor, ropeOf, type RunnerPose } from '../ink-character';
import { STRIDE } from '../ink-figure';
import { rosterLook, spritesOf, varietyFor } from './sprites';
import { pick, roll, VARIETY } from './sprites/play';

/**
 * The cast catalog for docs/CHARACTERS.md and `pnpm shot cast`: every kind on two seeds, a row of
 * poses, and the whole cast at play scale on dark and light ground, on a canvas over the page. Debug
 * only (`slagDebug.cast`).
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

const def = (i: number, salt: string, kind = CAST[i % CAST.length]): CharacterDef => generateCharacter(deriveSeed(0x5ca7, `${salt}:${i}`), kind);

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
  // In world units at the origin, then scaled, so the rig's tail hangs as it does in a race. The runner's
  // x sets its stride phase, so `stride` shifts it there and back.
  s.save();
  s.translate(x, y);
  s.scale(scale, scale);
  s.translate(-stride, 0);
  const rope = ropeOf(c);
  if (rope) {
    const rig = new Rig();
    const at = ropeAnchor(c, facing);
    for (let i = 0; i < 90; i++) rig.step(rope, at.x + stride, at.y, 1 / 60, -(p.vx ?? 0) * 0.6 - facing * 8, -0.8);
    drawInkAccessory(s, c, rig);
  }
  drawInkRunner({ s, g: null }, c, stride, 0, { facing, vy: 0, grounded: true, t, ...p, vx: (p.vx ?? 0) * facing });
  s.restore();
}

/** Draws the catalog on a full-window canvas and returns it (call `.remove()` to clear). */
export function castCatalog(t = 0.4): HTMLCanvasElement {
  const cols = 8;
  const rows = Math.ceil(CAST.length / cols);
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
  label(`The cast: ${CAST.length} kinds, two seeds each`, W / 2, 30, 20, '#f6ead8');
  CAST.forEach((name, i) => {
    const cx = 20 + (i % cols) * cell + cell / 2;
    const cy = 50 + Math.floor(i / cols) * 200;
    for (let j = 0; j < 2; j++)
      runner(s, def(i * 2 + j, 'cat', name), cx - 52 + j * 104, cy + 130, j ? { grounded: true, vx: 120 } : { grounded: true }, big, j ? 1 : -1, t);
    label(name, cx, cy + 165);
  });
  const py = 60 + rows * 200;
  label('Poses', 70, py + 20, 15, '#f6ead8');
  const pc = def(0, 'pose', 'plumber');
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
  const step = (W / 2 - 60) / CAST.length;
  CAST.forEach((name, i) => {
    const c = def(i * 2, 'cat', name);
    runner(s, c, 60 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5, 1, t);
    runner(s, c, W / 2 + 30 + step * (i + 0.5), qy + 80, { grounded: true }, 2.5, 1, t);
  });
  document.body.appendChild(cv);
  return cv;
}

/**
 * The player palette on the cast (`pnpm shot cast --only colors`): every kind in every swatch, big, then at
 * play scale on four grounds standing for the themes (dark rock, pale dirt, sky, snow) and the HUD's iron.
 * Every swatch has to read as that kind's costume on all of them, and no two swatches as one.
 */
export function castColors(t = 0.4): HTMLCanvasElement {
  const n = PLAYER_COLORS.length;
  const cell = 92;
  const rowH = 96;
  const W = 140 + n * cell;
  const grounds = ['#1e1814', '#cdb99a', '#8fb7d6', '#eef2f4', '#2b201b'];
  const stripH = 72;
  const H = 50 + CAST.length * rowH + 30 + grounds.length * stripH * 2;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#1a1210';
  s.fillRect(0, 0, W, H);
  s.font = '700 14px Barlow, sans-serif';
  s.textAlign = 'center';
  PLAYER_COLORS.forEach((c, i) => {
    s.fillStyle = `hsl(${c.h} ${c.s}% ${c.l}%)`;
    s.fillRect(140 + i * cell + 26, 12, cell - 52, 22);
  });
  CAST.forEach((kind, r) => {
    const y = 50 + r * rowH;
    s.fillStyle = '#c9b8a3';
    s.textAlign = 'left';
    s.fillText(kind, 12, y + rowH / 2);
    const base = def(r, 'colors', kind);
    PLAYER_COLORS.forEach((_, i) => runner(s, withColor(base, i), 140 + i * cell + cell / 2, y + rowH - 12, { grounded: true }, 3.6, 1, t));
  });
  // Play scale: the whole palette on one kind per strip, two strips per ground.
  const y0 = 50 + CAST.length * rowH + 30;
  grounds.forEach((g, gi) => {
    for (let k = 0; k < 2; k++) {
      const y = y0 + (gi * 2 + k) * stripH;
      s.fillStyle = g;
      s.fillRect(0, y, W, stripH);
      const per = Math.ceil(CAST.length / 2);
      for (let j = 0; j < per * 2; j++) {
        const kind = CAST[(k * per + (j % per)) % CAST.length];
        const i = j % n;
        runner(s, withColor(def(j, 'strip', kind), i), 30 + j * ((W - 60) / (per * 2)), y + stripH - 8, { grounded: true }, 2.5, 1, t);
      }
    }
  });
  document.body.appendChild(cv);
  return cv;
}

/**
 * The silhouette test: every kind as a solid black shape, at rest and mid-run, at 1 px per world px (a
 * runner about 16 px tall) and at play scale (2.5×, as at 1080p), then mid-run in color on dark and light
 * ground. Each should be nameable from its shape alone, and no two should share one.
 */
export function castSilhouettes(t = 0.4): HTMLCanvasElement {
  const n = CAST.length;
  const cell = Math.min(150, Math.floor(1880 / n));
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
    CAST.forEach((kind, i) => solid(def(i * 2, 'cat', kind), 20 + cell * (i + 0.5), y, scale, pose, stride));
  }
  CAST.forEach((kind, i) => label(kind, 20 + cell * (i + 0.5), 476));
  // Mid-run, in color, on light ground and on dark.
  label('Mid-run, in color, play scale', 110, 520, 13);
  CAST.forEach((kind, i) => runner(s, def(i * 2, 'cat', kind), 20 + cell * (i + 0.5), 640, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN));
  CAST.forEach((kind, i) => {
    const x = (W / 2 / n) * (i + 0.5);
    runner(s, def(i * 2, 'cat', kind), x, 820, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN);
  });
  CAST.forEach((kind, i) => runner(s, def(i * 2, 'cat', kind), W / 2 + (W / 2 / n) * (i + 0.5), 820, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN));
  document.body.appendChild(cv);
  return cv;
}

/** What each kind should be taken for, for the "is it the homage?" sheet: the answer a stranger should give. */
const READS_AS: Record<Kind, string> = {
  plumber: 'the mustached plumber',
  hedgehog: 'the blue speedster',
  elf: 'the green-tunic elf hero',
  hunter: 'the armored bounty hunter',
  zapmouse: 'the yellow electric mouse',
  impostor: 'the impostor crewmate',
  puffball: 'the pink puffball',
  jelly: 'the jellyfish parasite',
  goose: 'the goose up to no good',
  engineer: "the team shooter's engineer",
  chomper: 'the round dot-eater',
  miner: 'the voxel miner',
  ape: 'the necktie ape',
  merc: 'the spiky-haired mercenary',
  king: 'the spiked turtle king',
  dino: 'the green saddled dino',
  robot: 'the blue robot boy',
  sneak: 'the sneaking soldier',
  cuptoon: 'the cup-headed toon',
  horse: "the barnyard party game's horse",
  rapper: 'the rapping paper puppy',
  limbless: 'the limbless hero',
  worm: 'the worm in the super suit',
  dragon: 'the little purple dragon',
  hopper: 'the snouted cube hopper',
  warrior: 'the round Slavic warrior',
  slayer: 'the white-haired monster slayer',
};

/**
 * The "is it the homage?" sheet: every kind close up, mid-run, beside a one-line "this is ___" caption,
 * with its play-scale read next to it, in the kind's roster colour. Judge each against the caption; the
 * puffball is the bar.
 */
export function castRecognise(t = 0.4): HTMLCanvasElement {
  const cols = 4;
  const rows = Math.ceil(CAST.length / cols);
  const cw = 470;
  // Tall enough for the rendered kinds, whose ears and quills stand a head above the hand-drawn ones.
  const ch = 260;
  const W = cols * cw + 20;
  const H = rows * ch + 60;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#e9dcc4';
  s.fillRect(0, 0, W, H);
  s.font = '700 22px Barlow, sans-serif';
  s.fillStyle = '#120b08';
  s.textAlign = 'center';
  s.fillText('Is it the homage?', W / 2, 34);
  CAST.forEach((kind, i) => {
    const x = 10 + (i % cols) * cw;
    const y = 50 + Math.floor(i / cols) * ch;
    s.fillStyle = '#d9cbb2';
    s.fillRect(x + 4, y, cw - 8, ch - 10);
    const c = rosterLook(def(i * 2, 'cat', kind));
    runner(s, c, x + 130, y + 200, { grounded: true }, 6, 1, t);
    runner(s, c, x + 300, y + 200, { grounded: true, vx: 260 }, 6, 1, t, MID_RUN);
    runner(s, c, x + 420, y + 200, { grounded: true }, 2.5, 1, t);
    s.font = '700 17px Barlow, sans-serif';
    s.fillStyle = '#120b08';
    s.textAlign = 'left';
    s.fillText(`This is ${READS_AS[kind]}.`, x + 16, y + 26);
  });
  document.body.appendChild(cv);
  return cv;
}

/** Draw cost per runner, 8 at play scale, in ms: the cast as drawn, or only `kinds` (rendered ones from their frames). */
export function castBench(n = 200, kinds?: Kind[]): number {
  const cv = document.createElement('canvas');
  cv.width = 800;
  cv.height = 200;
  const s = cv.getContext('2d')!;
  const cs = Array.from({ length: 8 }, (_, i) => def(i * 2, 'bench', kinds ? kinds[i % kinds.length] : undefined));
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

/**
 * The blind read: every kind as a solid shape at play scale (2.5 px per world px, as at 1080p), standing,
 * mid-run and mid-jump, in a shuffled order with numbers and no names. Hand it to someone who hasn't seen
 * the cast and ask what each one parodies: the answer has to come from the silhouette alone.
 */
export function castBlind(t = 0.4): HTMLCanvasElement {
  // A fixed shuffle, so the sheet is the same every time and the order gives nothing away.
  const order = CAST.map((k, i) => [k, (i * 5 + 3) % CAST.length] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
  // Each cell is as wide as a runner reaches (40 world px at 2.5): narrower, a prop held out front (the worm's
  // pistol, the rapper's mic) was cut off and never part of the read. The kinds wrap onto as many bands as
  // keep a band under 1440 px.
  const cell = 100;
  const cols = Math.min(order.length, Math.floor(1420 / cell));
  const band = 340;
  const W = cols * cell + 20;
  const H = Math.ceil(order.length / cols) * band + 20;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#e9dcc4';
  s.fillRect(0, 0, W, H);
  const scratch = document.createElement('canvas');
  scratch.width = cell;
  scratch.height = 110;
  const g = scratch.getContext('2d')!;
  const poses: [number, Partial<RunnerPose>, number][] = [
    [100, { grounded: true }, 0],
    [210, { grounded: true, vx: 260 }, MID_RUN],
    [320, { grounded: false, vy: -300, vx: 120 }, 0],
  ];
  order.forEach((kind, i) => {
    const x = 10 + cell * ((i % cols) + 0.5);
    const y0 = Math.floor(i / cols) * band;
    s.font = '700 16px Barlow, sans-serif';
    s.fillStyle = '#3d2e26';
    s.textAlign = 'center';
    s.fillText(String(i + 1), x, y0 + 22);
    for (const [y, p, stride] of poses) {
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, cell, 110);
      runner(g, def(i * 3, 'blind', kind), cell / 2, 92, p, 2.5, 1, t, stride);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#000';
      g.fillRect(0, 0, cell, 110);
      s.drawImage(scratch, x - cell / 2, y0 + y - 92);
    }
  });
  document.body.appendChild(cv);
  return cv;
}

/** The blind sheet's order, for checking the answers: number → kind. */
export const blindOrder = (): string[] =>
  CAST.map((k, i) => [k, (i * 5 + 3) % CAST.length] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);

/**
 * One rendered kind's curated variety (docs/CHARACTERS.md → Variety), drawn in game: twelve looks in
 * twelve player colours, each standing in the idle it plays, cheering its cheer and mid-run with its own
 * gait, labelled with what it rolled; then all twelve at play scale on light and dark ground. With
 * as rendered, once the kind's frames have loaded. Every column must read as the same character by the
 * same hand.
 */
export function castVariety(kind: Kind, t = 0.4): HTMLCanvasElement {
  const looks = Array.from({ length: 12 }, (_, i) => def(i, 'variety', kind));
  const cell = 150;
  const big = 4.4;
  const W = looks.length * cell + 40;
  const H = 860;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#e9dcc4';
  s.fillRect(0, 0, W, H);
  s.fillStyle = '#1a1210';
  s.fillRect(W / 2, 700, W / 2, 160);
  s.textAlign = 'center';
  const label = (txt: string, x: number, y: number, size = 13, color = '#3d2e26') => {
    s.font = `700 ${size}px Barlow, sans-serif`;
    s.fillStyle = color;
    s.fillText(txt, x, y);
  };
  label(`${kind}: twelve looks, each in its own idle, cheer and gait`, W / 2, 26, 18);
  looks.forEach((c, i) => {
    const x = 20 + cell * (i + 0.5);
    runner(s, c, x, 190, { grounded: true }, big, 1, t);
    runner(s, c, x, 370, { grounded: true, celebrate: true }, big, 1, t);
    runner(s, c, x, 550, { grounded: true, vx: 260 }, big, 1, t, MID_RUN);
    const set = spritesOf(c);
    if (!set) return;
    const v = varietyFor(set, c);
    const palette = set.roles.find((r) => r.alts && r.vary === VARIETY.palette);
    const wear = set.slots?.findIndex((sl) => sl.name === 'wear') ?? -1;
    label(`${v.clips.idle ?? 'idle'} · ${v.clips.cheer ?? 'cheer'}`, x, 590);
    label(
      `palette ${palette ? roll(c.vary[VARIETY.palette], palette.alts!.length + 1) : '-'} · ${['clean', 'scuffed', 'scorched'][v.pick[wear]] ?? '-'}`,
      x,
      608,
    );
    label(`bounce ${v.bounce.toFixed(2)} · lean ${v.lean.toFixed(3)}`, x, 626);
  });
  // Play scale (2.5 screen px per world px, as at 1080p): standing on light ground, running on dark.
  const step = (W / 2 - 40) / looks.length;
  looks.forEach((c, i) => {
    runner(s, c, 20 + step * (i + 0.5), 800, { grounded: true }, 2.5, 1, t);
    runner(s, c, W / 2 + 20 + step * (i + 0.5), 800, { grounded: true, vx: 260 }, 2.5, 1, t, MID_RUN + i * 9);
  });
  document.body.appendChild(cv);
  return cv;
}

/** The moods the face kit acts, as the poses that show them: `blink` is the idle caught mid-blink. */
const FACE_POSES: [string, Partial<RunnerPose>][] = [
  ['idle', { grounded: true }],
  ['blink', { grounded: true }],
  ['walk', { grounded: true, vx: 100 }],
  ['run', { grounded: true, vx: 260 }],
  ['up', { grounded: false, vy: -320 }],
  ['fall', { grounded: false, vy: 420 }],
  ['wall', { grounded: false, vy: 60, wall: 1 }],
  ['cheer', { grounded: true, celebrate: true }],
  ['dead', { grounded: true, dead: 1.2 }],
];

/**
 * Every drawn kind's face through the moods (`pnpm shot cast --only faces`): its head close up in each, then
 * at play scale (2.5 screen px per world px) standing and mid-run, blown up px for px, so the eye is judged
 * as a player sees it. Each has to read as the kind's own there and act in every mood.
 */
export function castFaces(t = 0.4): HTMLCanvasElement {
  const kinds = CAST.filter((k) => spritesOf(def(0, 'face', k))?.face);
  const zoom = 10;
  const cw = 160;
  const ch = 120;
  const play = 3;
  const W = 110 + (FACE_POSES.length + 2) * cw;
  const H = 40 + kinds.length * ch;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W}px;height:${H}px`;
  const s = cv.getContext('2d')!;
  s.fillStyle = '#e9dcc4';
  s.fillRect(0, 0, W, H);
  const label = (txt: string, x: number, y: number) => {
    s.font = '700 14px Barlow, sans-serif';
    s.fillStyle = '#3d2e26';
    s.textAlign = 'center';
    s.fillText(txt, x, y);
  };
  FACE_POSES.forEach(([name], j) => label(name, 110 + cw * (j + 0.5), 26));
  label('play, standing', 110 + cw * (FACE_POSES.length + 0.5), 26);
  label('play, running', 110 + cw * (FACE_POSES.length + 1.5), 26);
  const scratch = document.createElement('canvas');
  scratch.width = Math.ceil(cw / play);
  scratch.height = Math.ceil(ch / play);
  const g = scratch.getContext('2d')!;
  kinds.forEach((kind, i) => {
    const c = rosterLook(def(i, 'face', kind));
    const set = spritesOf(c)!;
    const y0 = 40 + i * ch;
    label(kind, 55, y0 + ch / 2);
    // This character's blink (`drawFace`): when the idle's sine peaks.
    const seed = c.seed & 0xffff;
    const period = (Math.PI * 2) / 1.3;
    const blinkT = ((((Math.PI / 2 - seed * 7) / 1.3) % period) + period) % period;
    // Centred on the eyes, or on the head's height where the pose shows none.
    const centre = (p: Partial<RunnerPose>, tt: number, stride = 0) => {
      const eyes = pick(set, { facing: 1, vx: 0, vy: 0, grounded: true, t: tt, ...p }, stride, varietyFor(set, c))?.frame.eyes;
      return eyes?.length ? [(eyes[0] + eyes[eyes.length - 3]) / 16, (eyes[1] + eyes[eyes.length - 2]) / 16] : [0, -12];
    };
    FACE_POSES.forEach(([name, p], j) => {
      const x0 = 110 + j * cw;
      const tt = name === 'blink' ? blinkT : t;
      const [ex, ey] = centre(p, tt);
      s.save();
      s.beginPath();
      s.rect(x0 + 2, y0 + 2, cw - 4, ch - 4);
      s.clip();
      s.fillStyle = j % 2 ? '#d9cbb2' : '#e2d4bc';
      s.fillRect(x0, y0, cw, ch);
      runner(s, c, x0 + cw / 2 - ex * zoom, y0 + ch / 2 - ey * zoom, p, zoom, 1, tt);
      s.restore();
    });
    ([{ grounded: true }, { grounded: true, vx: 260 }] as Partial<RunnerPose>[]).forEach((p, j) => {
      g.fillStyle = '#d9cbb2';
      g.fillRect(0, 0, scratch.width, scratch.height);
      const [ex, ey] = centre(p, t, p.vx ? MID_RUN : 0);
      runner(g, c, scratch.width / 2 - ex * 2.5, scratch.height / 2 - ey * 2.5, p, 2.5, 1, t, p.vx ? MID_RUN : 0);
      s.imageSmoothingEnabled = false;
      s.drawImage(scratch, 110 + (FACE_POSES.length + j) * cw, y0, scratch.width * play, scratch.height * play);
      s.imageSmoothingEnabled = true;
    });
  });
  document.body.appendChild(cv);
  return cv;
}
