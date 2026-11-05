import { describe, expect, it } from 'vitest';
import { generateCharacter, CAST } from '../src/gen/character';
import { drawInkRunner, type RunnerPose } from '../src/render/ink-character';
import { CAST_ART } from '../src/render/cast';
import type { D } from '../src/render/cast/kit';
import { inked, lookOf, type Mood } from '../src/render/ink-figure';

/** A 2D context that only records where paths go, in the character's own space (transforms are ignored). */
function recorder() {
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => void pts.push([x, y]);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => {
      if (k === 'moveTo' || k === 'lineTo') return add;
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

const POSES: Record<string, RunnerPose> = {
  idle: { facing: 1, vx: 0, vy: 0, grounded: true, t: 1 },
  run: { facing: -1, vx: -215, vy: 0, grounded: true, t: 1.3 },
  rise: { facing: 1, vx: 100, vy: -300, grounded: false, t: 2 },
  fall: { facing: 1, vx: 0, vy: 400, grounded: false, t: 2.2 },
  wall: { facing: -1, vx: 0, vy: 60, grounded: false, t: 3, wall: 1 },
  cheer: { facing: 1, vx: 0, vy: 0, grounded: true, t: 4, celebrate: true },
};

describe('inked runner', () => {
  // Every runner shares one 10x14 hitbox: the drawing may be bigger, but not so big that one toy hides
  // another or reads as a different size of player.
  it('draws every toy, seed and pose within a fixed box around the hitbox', () => {
    for (let seed = 1; seed <= 64; seed++) {
      const c = generateCharacter(seed, CAST[seed % CAST.length]);
      for (const [name, pose] of Object.entries(POSES)) {
        const { ctx, pts } = recorder();
        drawInkRunner({ s: ctx, g: null }, c, 0, 0, pose);
        expect(pts.length, name).toBeGreaterThan(40);
        for (const [x, y] of pts) {
          expect(Math.abs(x), `${c.kind} ${seed} ${name}`).toBeLessThanOrEqual(17);
          expect(y, `${c.kind} ${seed} ${name}`).toBeGreaterThanOrEqual(-32);
          // Feet stand on the floor: ink below it would sink a standing runner into the ground.
          if (pose.grounded) expect(y, `${c.kind} ${seed} ${name}`).toBeLessThanOrEqual(1.1);
        }
      }
    }
  });

  it('has art for every toy', () => {
    for (const t of CAST) expect(CAST_ART[t], t).toBeDefined();
  });

  it('draws the same runner the same way every time', () => {
    const c = generateCharacter(77);
    const a = recorder();
    const b = recorder();
    drawInkRunner({ s: a.ctx, g: null }, c, 0, 0, POSES.run);
    drawInkRunner({ s: b.ctx, g: null }, generateCharacter(77), 0, 0, POSES.run);
    expect(a.pts).toEqual(b.pts);
  });

  it('gives every character of a kind its kind’s face: two seeds, the same eyes and mouth in every mood', () => {
    const moods = ['walk', 'run', 'up', 'fall', 'wall', 'cheer'] as const;
    const faceOf = (seed: number, kind: (typeof CAST)[number], m: Mood) => {
      const c = generateCharacter(seed, kind);
      const art = CAST_ART[kind];
      const W = 14 * art.size[0];
      const H = 15 * art.size[1];
      const by = -art.lift;
      const p: RunnerPose = { facing: 1, vx: 0, vy: 0, grounded: true, t: 1 };
      const { ctx, pts } = recorder();
      // Everything but the character is held still, the pen's seed included: only the face's design may show.
      const d: D = {
        s: ctx,
        g: null,
        c,
        lk: lookOf(c, art.fill !== 'paint'),
        W,
        H,
        by,
        top: by - H,
        f: 1,
        m,
        p,
        t: 1,
        wob: 0,
        k: 0.7,
        v: c.vary,
        ph: 0,
        wx: 0,
        wy: 0,
        sc: 1,
        sd: 5,
        bx: () => 0,
        gait: {},
        boot: ['#000', '#000'],
        detail: false,
        pose: 'rest',
      };
      art.paintFace(d);
      return pts;
    };
    for (const kind of CAST)
      for (const m of moods) {
        const a = faceOf(11, kind, m);
        expect(faceOf(90210, kind, m), `${kind} ${m}`).toEqual(a);
      }
  });
});

describe('the ink mass round an outline', () => {
  /** Where `inked` pushes each point of `pts`: the first path it draws is the mass, one point per point. */
  const massOf = (pts: { x: number; y: number }[]) => {
    const { ctx, pts: out } = recorder();
    inked(ctx, pts, '#fff', '#000', 0.6, 1.2);
    return out.slice(0, pts.length).map(([x, y], i) => ({ x: x - pts[i].x, y: y - pts[i].y }));
  };

  it('grows a wedge cut to the middle across its edges, not along them', () => {
    // A dot-eater: a circle with a mouth cut to its centre, the jaws sampled as densely as the arc.
    const at = (a: number, r: number) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    const pts = [
      ...Array.from({ length: 8 }, (_, i) => at(0.6, (8 * (i + 1)) / 8)),
      ...Array.from({ length: 39 }, (_, i) => at(0.6 + ((Math.PI * 2 - 1.2) * (i + 1)) / 40, 8)),
      ...Array.from({ length: 8 }, (_, i) => at(-0.6, (8 * (8 - i)) / 8)),
      { x: 0, y: 0 },
    ];
    const off = massOf(pts);
    for (const [i, a] of [
      [3, 0.6],
      [5, 0.6],
      [pts.length - 5, -0.6],
      [pts.length - 7, -0.6],
    ] as const) {
      // Along the jaw, and its normal out into the mouth.
      const [tx, ty] = [Math.cos(a), Math.sin(a)];
      const [nx, ny] = a > 0 ? [ty, -tx] : [-ty, tx];
      const o = off[i];
      expect(o.x * nx + o.y * ny, `jaw point ${i} grows into the mouth`).toBeGreaterThan(0.4);
      expect(Math.abs(o.x * tx + o.y * ty), `jaw point ${i} doesn't slide along the jaw`).toBeLessThan(0.25);
    }
  });

  it('grows a round outline straight out from its middle', () => {
    const pts = Array.from({ length: 24 }, (_, i) => ({ x: Math.cos((i / 24) * Math.PI * 2) * 6, y: Math.sin((i / 24) * Math.PI * 2) * 4 }));
    massOf(pts).forEach((o, i) => {
      const r = Math.hypot(pts[i].x, pts[i].y);
      expect(Math.abs(o.x * (pts[i].y / r) - o.y * (pts[i].x / r)), `point ${i}`).toBeLessThan(1e-9);
    });
  });
});
