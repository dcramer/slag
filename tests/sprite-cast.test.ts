import { describe, expect, it } from 'vitest';
import { generateCharacter, type Kind } from '../src/gen/character';
import { SPRITE_KINDS } from '../src/render/cast/sprites';
import { drawFrame, hexHsl, paintOf, ringPoints } from '../src/render/cast/sprites/draw';
import { clipFor, frameAt, pick, picks } from '../src/render/cast/sprites/play';
import { sprites as hedgehog } from '../src/render/cast/sprites/hedgehog/frames';
import { sprites as plumber } from '../src/render/cast/sprites/plumber/frames';
import type { SpriteClip, SpriteSet, VFrame } from '../src/render/cast/sprites/types';
import type { RunnerPose } from '../src/render/ink-figure';

/** Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds): their frames and how they're chosen. */

const SETS: SpriteSet[] = [plumber, hedgehog];

/** A 2D context that only records where paths go, in the frame's own space (transforms are ignored). */
function recorder() {
  // A plain object, not a Proxy: the box test draws hundreds of pen strokes through it.
  const pts: [number, number][] = [];
  const none = () => {};
  const ctx = {
    moveTo: (x: number, y: number) => void pts.push([x, y]),
    lineTo: (x: number, y: number) => void pts.push([x, y]),
    arc: (x: number, y: number, r: number) => void pts.push([x - r, y - r], [x + r, y + r]),
    beginPath: none,
    closePath: none,
    fill: none,
    stroke: none,
    save: none,
    restore: none,
    clip: none,
    translate: none,
    scale: none,
    rotate: none,
    fillStyle: '',
    strokeStyle: '',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, pts };
}

/** The frames reaching furthest out, up and down: drawing those (pen and all) is what the box test needs. */
function extremes(fs: readonly VFrame[]): VFrame[] {
  // Furthest right, left, up and down, over every outline: silhouette and parts (accessories sit outside it).
  const best: VFrame[] = [fs[0], fs[0], fs[0], fs[0]];
  const bs = [-Infinity, -Infinity, -Infinity, -Infinity];
  for (const f of fs)
    for (const r of [...f.sil, ...f.parts.map((p) => p[1])])
      for (const q of ringPoints(r))
        [q.x, -q.x, -q.y, q.y].forEach((v, i) => {
          if (v > bs[i]) {
            bs[i] = v;
            best[i] = f;
          }
        });
  return [...new Set(best)];
}

const pose = (p: Partial<RunnerPose>): RunnerPose => ({ facing: 1, vx: 0, vy: 0, grounded: true, t: 0, ...p });

describe('rendered kinds: frames', () => {
  it('cover every kind the loader lists, each clip in both facings, every outline a real shape', () => {
    expect(SETS.map((s) => s.kind).sort()).toEqual([...SPRITE_KINDS].sort());
    for (const s of SETS) expect(Object.keys(s.clips), s.kind).toEqual(expect.arrayContaining(['idle', 'walk', 'run', 'air', 'wall', 'cheer', 'death']));
    for (const s of SETS)
      for (const [name, c] of Object.entries(s.clips)) {
        expect(c.r.length, `${s.kind} ${name}`).toBeGreaterThan(0);
        expect(c.l.length, `${s.kind} ${name}`).toBe(c.r.length);
        for (const f of [...c.r, ...c.l]) {
          expect(f.sil.length, `${s.kind} ${name}`).toBeGreaterThan(0);
          for (const r of [...f.sil, ...f.parts.map((p) => p[1])]) {
            const pts = ringPoints(r);
            expect(pts.length, `${s.kind} ${name}`).toBeGreaterThanOrEqual(3);
            expect(pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
          }
          for (const [role] of f.parts) expect(s.roles[role], `${s.kind} ${name} role ${role}`).toBeDefined();
        }
      }
  });

  it('draw, pen and all, inside the hand-drawn kinds’ box around the shared hitbox, squashed or stretched, feet on the floor', () => {
    // The shared drawer's squash and stretch reach sx 1.12 and sy 1.25 in the air; on the ground, 1.04.
    for (const s of SETS) {
      const paints = s.roles.map((r) => paintOf(hexHsl(r.color)));

      for (const [name, c] of Object.entries(s.clips))
        for (const f of extremes([...c.r, ...c.l]))
          for (const o of [0, 1]) {
            const { ctx, pts } = recorder();
            drawFrame(
              ctx,
              f,
              paints,
              paints[0],
              '#000',
              0.7,
              1,
              0,
              undefined,
              // Bare, then every accessory on (each is inside the outline, so on is the widest).
              (s.slots ?? []).map((sl) => o * (sl.options - 1)),
            );
            const ground = name !== 'air' && name !== 'wall';
            const sx = ground ? 1.04 : 1.12;
            const sy = ground ? 1.04 : 1.25;
            let wide = 0;
            let top = 0;
            let low = -Infinity;
            for (const [x, y] of pts) {
              wide = Math.max(wide, Math.abs(x));
              top = Math.min(top, y);
              low = Math.max(low, y);
            }
            expect(wide * sx, `${s.kind} ${name} width`).toBeLessThanOrEqual(17);
            expect(top * sy, `${s.kind} ${name} top`).toBeGreaterThanOrEqual(-32);
            // Feet stand on the floor: ink below it would sink a standing runner into the ground.
            if (ground) expect(low, `${s.kind} ${name} feet`).toBeLessThanOrEqual(1.1);
          }
    }
  });

  it('are no smaller than the hand-drawn cast: at least 18 world px tall standing', () => {
    for (const s of SETS) {
      const f = s.clips.idle.r[0];
      let top = 0;
      for (const r of f.sil) for (const q of ringPoints(r)) top = Math.min(top, q.y);
      expect(-top, s.kind).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('rendered kinds: choosing frames', () => {
  const clip = (over: Partial<SpriteClip>): SpriteClip => {
    const f = { sil: [], parts: [] };
    return { loop: true, r: [f, f, f, f], l: [], ...over };
  };

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
    expect(frameAt(clip({ fps: 8, loop: false }), 0, 10)).toBe(3);
    const air = clip({ vy: [-400, 400], loop: false });
    expect([-900, -400, 0, 400, 900].map((vy) => frameAt(air, 0, 0, vy))).toEqual([0, 0, 2, 3, 3]);
  });

  it('faces the wall it slides on, and the way it runs otherwise', () => {
    for (const s of SETS) {
      expect(pick(s, pose({ grounded: false, vy: 80, wall: -1, facing: 1 }), 0)!.facing).toBe(-1);
      expect(pick(s, pose({ vx: -215, facing: -1 }), 0)!.facing).toBe(-1);
      expect(s.clips.run.l).toContain(pick(s, pose({ vx: -215, facing: -1 }), 10)!.frame);
    }
  });

  it('rolls accessories from the look seed: the same seed the same, and some seeds differ', () => {
    for (const s of SETS) {
      expect(s.slots?.length, s.kind).toBeGreaterThanOrEqual(2);
      const looks = [1, 2, 3, 4, 5, 6].map((seed) => picks(s, generateCharacter(seed, s.kind as Kind).vary));
      expect(looks[0]).toEqual(picks(s, generateCharacter(1, s.kind as Kind).vary));
      for (const l of looks) l.forEach((o, i) => expect(o).toBeLessThan(s.slots![i].options));
      expect(new Set(looks.map((l) => l.join())).size, s.kind).toBeGreaterThan(1);
      // Every option of every slot has its parts in the frames.
      const tags = new Set(Object.values(s.clips).flatMap((c) => c.r.flatMap((f) => f.parts.filter((p) => p.length === 4).map((p) => `${p[2]}:${p[3]}`))));
      s.slots!.forEach((sl, i) => {
        for (let o = 1; o < sl.options; o++) expect(tags.has(`${i}:${o}`), `${s.kind} slot ${i} option ${o}`).toBe(true);
      });
    }
  });

  it('recolours the kind’s own colour from the character, and keeps the roster’s elsewhere', () => {
    const c = generateCharacter(5, 'hedgehog');
    for (const s of SETS) {
      const slot = s.roles.findIndex((r) => r.slot === 'paint');
      expect(slot, s.kind).toBeGreaterThanOrEqual(0);
      expect(s.roles.filter((r) => !r.slot).every((r) => /^#[0-9a-f]{6}$/.test(r.color))).toBe(true);
    }
    expect(paintOf(c.paint).fill).not.toBe(paintOf(hexHsl(hedgehog.roles[hedgehog.roles.findIndex((r) => r.slot === 'paint')].color)).fill);
  });
});
