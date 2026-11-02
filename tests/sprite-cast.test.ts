import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../src/gen/character';
import { SPRITE_KINDS } from '../src/render/cast/sprites';
import { drawFrame, hexHsl, paintOf, ringPoints } from '../src/render/cast/sprites/draw';
import { clipFor, frameAt, pick } from '../src/render/cast/sprites/play';
import { sprites as hedgehog } from '../src/render/cast/sprites/hedgehog/frames';
import { sprites as plumber } from '../src/render/cast/sprites/plumber/frames';
import type { SpriteClip, SpriteSet, VFrame } from '../src/render/cast/sprites/types';
import type { RunnerPose } from '../src/render/ink-figure';

/** Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds): their frames and how they're chosen. */

const SETS: SpriteSet[] = [plumber, hedgehog];

/** A 2D context that only records where paths go, in the frame's own space (transforms are ignored). */
function recorder() {
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => void pts.push([x, y]);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => {
      if (k === 'moveTo' || k === 'lineTo') return add;
      if (k === 'arc') return (x: number, y: number, r: number) => (add(x - r, y - r), add(x + r, y + r));
      if (k in t) return t[k as string];
      return () => {};
    },
    set: (t, k, v) => {
      t[k as string] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, pts };
}

/** The frames reaching furthest out, up and down: drawing those (pen and all) is what the box test needs. */
function extremes(fs: readonly VFrame[]): VFrame[] {
  const by = (score: (x: number, y: number) => number) => {
    let best = fs[0];
    let bs = -Infinity;
    for (const f of fs)
      for (const r of f.sil)
        for (const q of ringPoints(r)) {
          const v = score(q.x, q.y);
          if (v > bs) {
            bs = v;
            best = f;
          }
        }
    return best;
  };
  return [...new Set([by((x) => x), by((x) => -x), by((_, y) => -y), by((_, y) => y)])];
}

const pose = (p: Partial<RunnerPose>): RunnerPose => ({ facing: 1, vx: 0, vy: 0, grounded: true, t: 0, ...p });

describe('rendered kinds: frames', () => {
  it('cover every kind the loader lists, each clip in both facings, every outline a real shape', () => {
    expect(SETS.map((s) => s.kind).sort()).toEqual([...SPRITE_KINDS].sort());
    for (const s of SETS)
      for (const [name, c] of Object.entries(s.clips)) {
        expect(c.r.length, `${s.kind} ${name}`).toBeGreaterThan(0);
        expect(c.l.length, `${s.kind} ${name}`).toBe(c.r.length);
        for (const f of [...c.r, ...c.l]) {
          expect(f.sil.length, `${s.kind} ${name}`).toBeGreaterThan(0);
          for (const r of [...f.sil, ...f.parts.map((p) => p[1])]) {
            const pts = ringPoints(r);
            expect(pts.length, `${s.kind} ${name}`).toBeGreaterThanOrEqual(3);
            for (const q of pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
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
        for (const f of extremes([...c.r, ...c.l])) {
          const { ctx, pts } = recorder();
          drawFrame(ctx, f, paints, paints[0], '#000', 0.7, 1, 0);
          const ground = name !== 'air' && name !== 'wall';
          const sx = ground ? 1.04 : 1.12;
          const sy = ground ? 1.04 : 1.25;
          for (const [x, y] of pts) {
            expect(Math.abs(x) * sx, `${s.kind} ${name} width`).toBeLessThanOrEqual(17);
            expect(y * sy, `${s.kind} ${name} top`).toBeGreaterThanOrEqual(-32);
            // Feet stand on the floor: ink below it would sink a standing runner into the ground.
            if (ground) expect(y, `${s.kind} ${name} feet`).toBeLessThanOrEqual(1.1);
          }
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
