import { describe, expect, it } from 'vitest';
import { generateCharacter, type Kind } from '../src/gen/character';
import { coloursOf, LOADERS, shadowOf, SPRITE_KINDS } from '../src/render/cast/sprites';
import { drawFrame, hexHsl, paintOf, ringPoints } from '../src/render/cast/sprites/draw';
import { type ClipName, clipFor, frameAt, GAIT_MAX, gaitAt, pick, picks, VARIETY, varietyOf, variantsOf } from '../src/render/cast/sprites/play';
import type { SpriteClip, SpriteSet, VFrame } from '../src/render/cast/sprites/types';
import type { RunnerPose } from '../src/render/ink-figure';

/** Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds): their frames and how they're chosen. */

// Every registered kind, loaded as the game loads it: a new kind needs no change here.
const SETS: SpriteSet[] = await Promise.all(SPRITE_KINDS.map(async (k) => (await LOADERS[k]!()).sprites));

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

      const most = Math.max(2, ...(s.slots ?? []).map((sl) => sl.options));
      for (const [name, c] of Object.entries(s.clips))
        for (const f of extremes([...c.r, ...c.l]))
          for (let o = 0; o < most; o++) {
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
              // Bare, then each option of every slot on: every accessory, every wear.
              (s.slots ?? []).map((sl) => Math.min(o, sl.options - 1)),
            );
            const ground = name !== 'air' && name !== 'wall';
            const sx = ground ? 1.04 : 1.12;
            const sy = ground ? 1.04 : 1.25;
            // The boldest gait any character may roll: its lean skews the top forward, its bounce lifts it.
            const gait = gaitAt(s, { pick: [], clips: {}, bounce: GAIT_MAX.bounce, lean: GAIT_MAX.lean }, name as ClipName, (s.clips[name].stride ?? 0) / 4);
            let wide = 0;
            let top = 0;
            let low = -Infinity;
            for (const [x, y] of pts) {
              wide = Math.max(wide, Math.abs(x) + gait.lean * Math.max(0, -y));
              top = Math.min(top, y + gait.dy);
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

  it('wears the player’s colour on its costume, like a fighting game’s alternate costume, and keeps the roster’s elsewhere', () => {
    for (const s of SETS) {
      expect(
        s.roles.some((r) => r.slot === 'player'),
        s.kind,
      ).toBe(true);
      expect(s.roles.filter((r) => !r.slot).every((r) => /^#[0-9a-f]{6}$/.test(r.color))).toBe(true);
    }
    // Two players of one kind wear two colours.
    const [a, b] = [generateCharacter(5, 'hedgehog'), generateCharacter(6, 'hedgehog')];
    expect(paintOf(a.body).fill).not.toBe(paintOf(b.body).fill);
  });
});

describe('rendered kinds: curated variety (docs/CHARACTERS.md → Variety)', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

  it('every kind has the three layers: a palette of 2–3 colourways, two idles and two cheers, a gait, and clean, scuffed and scorched wear', () => {
    for (const s of SETS) {
      const palette = s.roles.filter((r) => r.alts && r.vary === VARIETY.palette);
      expect(palette.length, `${s.kind} palette`).toBeGreaterThan(0);
      // Roles on one roll change together, so each colourway is whole.
      expect(new Set(palette.map((r) => r.alts!.length)).size, `${s.kind} colourways`).toBe(1);
      expect(palette[0].alts!.length, s.kind).toBeGreaterThanOrEqual(1);
      expect(palette[0].alts!.length, s.kind).toBeLessThanOrEqual(2);
      // Never the costume: the player's colour stays the player's.
      expect(palette.every((r) => !r.slot)).toBe(true);
      expect(variantsOf(s, 'idle'), s.kind).toEqual(['idle', 'idle2']);
      expect(variantsOf(s, 'cheer'), s.kind).toEqual(['cheer', 'cheer2']);
      expect(s.gait, s.kind).toBeDefined();
      for (const b of [s.gait!.bounce, s.gait!.lean]) expect(b[0]).toBeLessThanOrEqual(b[1]);
      expect(s.gait!.bounce[1]).toBeLessThanOrEqual(GAIT_MAX.bounce);
      expect(s.gait!.lean[1]).toBeLessThanOrEqual(GAIT_MAX.lean);
      const wear = s.slots?.find((sl) => sl.name === 'wear');
      expect(wear, s.kind).toMatchObject({ vary: VARIETY.wear, options: 3 });
    }
  });

  it('picks each character’s variety from its seed: the same seed the same, and the seeds spread over every variant', () => {
    for (const s of SETS) {
      const looks = seeds.map((seed) => varietyOf(s, generateCharacter(seed, s.kind as Kind).vary));
      expect(looks).toEqual(seeds.map((seed) => varietyOf(s, generateCharacter(seed, s.kind as Kind).vary)));
      expect(new Set(looks.map((v) => v.clips.idle)), s.kind).toEqual(new Set(['idle', 'idle2']));
      expect(new Set(looks.map((v) => v.clips.cheer)), s.kind).toEqual(new Set(['cheer', 'cheer2']));
      const wear = s.slots!.findIndex((sl) => sl.name === 'wear');
      expect(new Set(looks.map((v) => v.pick[wear])).size, s.kind).toBe(3);
      expect(new Set(looks.map((v) => v.bounce)).size, s.kind).toBeGreaterThan(1);
      for (const v of looks) {
        expect(v.bounce).toBeGreaterThanOrEqual(s.gait!.bounce[0]);
        expect(v.lean).toBeLessThanOrEqual(s.gait!.lean[1]);
      }
      // Colours come from the seed too, and the palette shows more than one colourway across them.
      const role = s.roles.findIndex((r) => r.alts && r.vary === VARIETY.palette);
      const worn = seeds.map((seed) => coloursOf(s, generateCharacter(seed, s.kind as Kind))[role]);
      expect(worn).toEqual(seeds.map((seed) => coloursOf(s, generateCharacter(seed, s.kind as Kind))[role]));
      expect(new Set(worn.map((c) => JSON.stringify(c))).size, s.kind).toBeGreaterThan(1);
    }
  });

  it('plays the character’s own idle and cheer', () => {
    for (const s of SETS)
      for (const seed of seeds) {
        const v = varietyOf(s, generateCharacter(seed, s.kind as Kind).vary);
        expect(s.clips[v.clips.idle!].r).toContain(pick(s, pose({}), 0, v)!.frame);
        expect(s.clips[v.clips.cheer!].r).toContain(pick(s, pose({ celebrate: true }), 0, v)!.frame);
      }
  });

  it('wears its marks on the body, never on the face', () => {
    for (const s of SETS) {
      const wear = s.slots!.findIndex((sl) => sl.name === 'wear');
      // Upright clips: a body lying crumpled in death puts its limbs anywhere, and its face is shut.
      for (const [name, c] of Object.entries(s.clips).filter(([n]) => n !== 'death'))
        for (const f of [...c.r, ...c.l]) {
          if (!f.eyes) continue;
          for (const p of f.parts) {
            if (p.length !== 4 || p[2] !== wear) continue;
            for (const q of ringPoints(p[1]))
              for (let e = 0; e + 2 < f.eyes.length; e += 3)
                expect(Math.hypot(q.x - f.eyes[e] / 8, q.y - f.eyes[e + 1] / 8), `${s.kind} ${name}: wear role ${p[0]} on an eye`).toBeGreaterThan(
                  f.eyes[e + 2] / 8 + 1,
                );
          }
        }
    }
  });

  it('keeps the shoes, gloves and wear in their own colours: only the costume takes the player’s', () => {
    for (const s of SETS) {
      const a = generateCharacter(3, s.kind as Kind);
      const b = { ...a, body: { h: (a.body.h + 180) % 360, s: a.body.s, l: a.body.l } };
      const [ca, cb] = [coloursOf(s, a), coloursOf(s, b)];
      s.roles.forEach((r, i) => {
        const fromPlayer = r.slot === 'player' || (r.on !== undefined && s.roles[r.on].slot === 'player');
        if (!fromPlayer) expect(ca[i], `${s.kind} role ${i}`).toEqual(cb[i]);
      });
    }
    // The hard shadow over the figure darkens without a hue: a pink player's white soles stay white.
    for (const h of [330, 190, 140]) {
      const [r, g, bl] = shadowOf({ h, s: 70, l: 55 }).match(/\d+/g)!.map(Number);
      expect(Math.max(r, g, bl) - Math.min(r, g, bl), `hue ${h}`).toBeLessThanOrEqual(12);
    }
  });
});

describe('characters: vary', () => {
  it('keeps the first six rolls (and the kind and hue) every seed had, with the variety rolls past them', () => {
    const before: [number, string, number, number[]][] = [
      [1, 'jelly', 225.74661861173809, [0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635, 0.425796952098608, 0.9948229456786066]],
      [
        7,
        'chicken',
        4.213711135089397,
        [0.5214452685322613, 0.4055216880515218, 0.4662326325196773, 0.23992518591694534, 0.5533256039489061, 0.729822089895606],
      ],
      [
        0x5ca7,
        'elf',
        59.1072775516659,
        [0.038265814539045095, 0.13181803026236594, 0.6073709435295314, 0.8663577474653721, 0.023078895173966885, 0.08451413083821535],
      ],
      [
        123456789,
        'fox',
        92.80466778203845,
        [0.30307188746519387, 0.7470660470426083, 0.7787336520850658, 0.2845096290111542, 0.016536934999749064, 0.1614646923262626],
      ],
    ];
    for (const [seed, kind, hue, vary] of before) {
      const c = generateCharacter(seed);
      expect([c.kind, c.hue, c.vary.slice(0, 6)]).toEqual([kind, hue, vary]);
      expect(c.vary.length).toBeGreaterThan(VARIETY.wear);
      expect(c.vary.every((v) => v >= 0 && v < 1)).toBe(true);
    }
  });
});
