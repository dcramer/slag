import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPRITES } from '../src/render/cast/sprites';
import { clipFor, frameAt, pick, sheetFor, tint } from '../src/render/cast/sprites/play';
import type { SpriteClip, SpriteSet, SpriteSheet } from '../src/render/cast/sprites/types';
import type { RunnerPose } from '../src/render/ink-figure';

/** Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds): their atlases and how frames are chosen. */

const sets = Object.values(SPRITES) as SpriteSet[];
const sheets = (s: SpriteSet) => [s.play, s.card].filter((x): x is SpriteSheet => !!x);

/** The PNG's own size, from its header. */
function pngSize(url: string): [number, number] {
  const b = readFileSync(fileURLToPath(url));
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const pose = (p: Partial<RunnerPose>): RunnerPose => ({ facing: 1, vx: 0, vy: 0, grounded: true, t: 0, ...p });

describe('rendered kinds: atlases', () => {
  it('have both facings of every clip, every frame inside its atlas, and atlases the size the table says', () => {
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets)
      for (const sh of sheets(s)) {
        expect(pngSize(sh.png)).toEqual([sh.w, sh.h]);
        expect(pngSize(sh.mask)).toEqual([sh.w, sh.h]);
        for (const [name, c] of Object.entries(sh.clips)) {
          expect(c.r.length, `${s.kind} ${name}`).toBeGreaterThan(0);
          expect(c.l.length, `${s.kind} ${name}`).toBe(c.r.length);
          for (const [x, y, w, h, ax, ay] of [...c.r, ...c.l]) {
            expect(x >= 0 && y >= 0 && x + w <= sh.w && y + h <= sh.h, `${s.kind} ${name}`).toBe(true);
            expect(Number.isFinite(ax) && Number.isFinite(ay)).toBe(true);
          }
        }
      }
  });

  it('stay inside the hand-drawn kinds’ box around the shared hitbox, squashed or stretched, feet on the floor', () => {
    // The drawer's squash and stretch reach sx 1.12 (a fall) and sy 1.25 (a rise); on the ground, 1.04.
    for (const s of sets)
      for (const sh of sheets(s))
        for (const [name, c] of Object.entries(sh.clips))
          for (const [, , w, h, ax, ay] of [...c.r, ...c.l]) {
            const k = 1 / sh.scale;
            const ground = name !== 'air' && name !== 'wall';
            const sx = ground ? 1.04 : 1.12;
            const sy = ground ? 1.04 : 1.25;
            expect(Math.max(ax, w - ax) * k * sx, `${s.kind} ${name} width`).toBeLessThanOrEqual(17);
            expect(-ay * k * sy, `${s.kind} ${name} top`).toBeGreaterThanOrEqual(-32);
            // Antialiased soles may reach a pixel under the floor line; ink below 1.1 world px would sink a runner.
            if (ground) expect((h - ay) * k, `${s.kind} ${name} feet`).toBeLessThanOrEqual(1.1);
          }
  });
});

describe('rendered kinds: frames', () => {
  const clip = (over: Partial<SpriteClip>): SpriteClip => ({
    loop: true,
    r: [
      [0, 0, 1, 1, 0, 0],
      [1, 0, 1, 1, 0, 0],
      [2, 0, 1, 1, 0, 0],
      [3, 0, 1, 1, 0, 0],
    ],
    l: [],
    ...over,
  });

  it('picks the clip from the pose the hand-drawn cast reads', () => {
    expect(clipFor(pose({}))).toBe('idle');
    expect(clipFor(pose({ vx: 100 }))).toBe('walk');
    expect(clipFor(pose({ vx: -215 }))).toBe('run');
    expect(clipFor(pose({ grounded: false, vy: -300 }))).toBe('air');
    expect(clipFor(pose({ grounded: false, vy: 60, wall: 1 }))).toBe('wall');
    expect(clipFor(pose({ celebrate: true, vx: 215 }))).toBe('cheer');
    expect(clipFor(pose({ dead: 0.1, grounded: false }))).toBe('death');
  });

  it('runs a stride clip by distance, a timed clip by time, and an air clip by vertical speed', () => {
    const stride = clip({ stride: 40 });
    expect([0, 10, 20, 30, 40, 50].map((x) => frameAt(stride, x, 0))).toEqual([0, 1, 2, 3, 0, 1]);
    // Running left counts the same distance.
    expect(frameAt(stride, -10, 0)).toBe(1);
    const timed = clip({ fps: 8 });
    expect([0, 0.125, 0.25, 0.375, 0.5].map((t) => frameAt(timed, 0, t))).toEqual([0, 1, 2, 3, 0]);
    const once = clip({ fps: 8, loop: false });
    expect(frameAt(once, 0, 10)).toBe(3);
    const air = clip({ vy: [-400, 400], loop: false });
    expect([-900, -400, 0, 400, 900].map((vy) => frameAt(air, 0, 0, vy))).toEqual([0, 0, 2, 3, 3]);
  });

  it('faces the wall it slides on, and uses the card sheet only when the figure is shown big', () => {
    const s = sets[0];
    const onWall = pick(s, pose({ grounded: false, vy: 80, wall: -1, facing: 1 }), 0, 3)!;
    const wall = s.play.clips.wall ?? s.play.clips.air;
    expect(wall.l).toContain(onWall.frame);
    expect(sheetFor(s, 'idle', 2.5)).toBe(s.play);
    if (s.card?.clips.idle) expect(sheetFor(s, 'idle', 10)).toBe(s.card);
    // A clip the card sheet lacks stays on the race sheet at any size.
    expect(sheetFor(s, 'run', 10)).toBe(s.play);
  });

  it('recolours a slot exactly: c + (B′ − B)·T', () => {
    // Two pixels: full paint at the lit tone (T = 1.1), and a pen pixel of the paint slot (T = 0.38).
    const rgba = new Uint8ClampedArray([110, 55, 22, 255, 40, 20, 10, 255]);
    const mask = new Uint8ClampedArray([220, 0, 0, 255, 76, 0, 0, 255]);
    tint(rgba, mask, { paint: '#644020' }, { paint: [0x64 + 20, 0x40, 0x20 - 10], player: [0, 0, 0] });
    expect([...rgba]).toEqual([132, 55, 11, 255, 48, 20, 6, 255]);
  });
});
