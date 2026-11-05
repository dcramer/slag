import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { moduleArt } from '../../src/render/props/common';
import '../../src/render/props/modules';
import { RUN_COUNTDOWN } from '../../src/sim/constants';
import type { Level } from '../../src/sim/level';
import { type Contrib, moduleSim, newPropState, type PlacedProp, resolveProp, traceRays, type Module } from '../../src/sim/props';
import { TELLS, tellFaults, windowFaults } from '../../src/gen/setpieces';

/**
 * The conformance suite's shared machinery (tests/conformance/*.test.ts): every registered entry of every
 * generated kind, held to its declared contract on a fixed small set of seeds, sizes and gravities. A new
 * landmark, decor piece, hazard or part is covered the moment it's registered.
 *
 * Each rule of each entry is one test. A known violation that can't be fixed in the change that found it
 * goes in WAIVERS with the reason, and its test shows as a todo until the entry is fixed; delete the line
 * then. Never waive a new entry: fix it.
 */

/** `<kind>/<theme>/<id>/<rule>` → why it's waived, and what fixes it. */
export const WAIVERS: Record<string, string> = {
  'hazard/castle/chandrop/unique':
    'the volcano lava tube drops cooling rock from its ceiling with the same dropper module, so the chandelier is no longer the only hazard of its kind once the suite raises a lava tube with drips. Fix (owner call): give the drips a mechanism of their own, or take the chandelier off the list of castle hazards.',
  'landmark/castle/gatehouse/varies':
    'a classic gatehouse rolls few dials (gate thickness, two tower heights the box clips, width), so seeds 1 and 2 land on the same layout once the seed streams shift. Fix: give it more to vary, a portcullis count or murder holes in its layout.',
  'landmark/mine/trestle-line/varies':
    'a classic trestle line rolls few dials, so seeds 1 and 2 land on the same layout once the seed streams shift. Fix: give it more to vary.',
  'landmark/harbor/tidal-pier/varies':
    'a classic tidal pier rolls few dials, so seeds 2 and 3 build the same pier once open side edges shifted which attempts are kept. Fix: give it more to vary, a pile count or a second deck height.',
  'landmark/mine/crystal-geode/varies':
    'a classic geode varies mostly in its rock, so seeds 2 and 3 differ only in tiles once open side edges shifted which attempts are kept. Fix: let the seed move its crystals or its way in, not just the rock round them.',
  'landmark/jungle/canopy-village/varies':
    'a classic village has room for two trees three columns apart and no rotten planks, so it makes about five small rolls and seeds 2 and 3 land on the same ones (24 layouts in 30 seeds). Fix: give the classic village more to vary, a wider spread of trees or a third one.',
};

/** One rule of one entry: fails listing every fault it finds, or a todo while it's waived. */
export function rule(key: string, name: string, faults: () => string[]): void {
  const why = WAIVERS[key];
  if (why) {
    it.todo(`${name} — waived: ${why}`);
    return;
  }
  it(name, () => {
    const found = faults();
    expect(found, `${key}:\n  ${found.join('\n  ')}`).toEqual([]);
  });
}

/** Computed on first use, then shared by every test that asks. */
export function once<T>(make: () => T): () => T {
  let v: { t: T } | null = null;
  return () => (v ??= { t: make() }).t;
}

const ART_DIR = join(__dirname, '../../src/render/props/modules');
const artSources = once(() => readdirSync(ART_DIR).map((f) => readFileSync(join(ART_DIR, f), 'utf8')));

/** Modules of `pp` with no art registered (src/render/props/modules). */
export function artFaults(pp: PlacedProp): string[] {
  return [...new Set(pp.def.modules.map((m) => m.type))].filter((t) => moduleArt(t).length === 0).map((t) => `${pp.def.name}: no art for ${t}`);
}

/**
 * The hazard half of a set piece's contract, simulated over a cycle: everything that hurts declares how
 * it telegraphs (TELLS) and warns long enough, what reaches through space is drawn from the sim's reach
 * (its art reads `beamOf`, so the beam stops where it stops hurting), and nothing is lethal every frame
 * unless it never moves.
 */
export function hazardFaults(level: Level, pp: PlacedProp): string[] {
  const out = tellFaults(pp.def.modules).map((f) => `${pp.def.name}: ${f}`);
  const r = resolveProp(pp);
  const state = newPropState();
  const hurts = new Set<string>();
  const beams = new Set<string>();
  for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 600; f += 4) {
    const c: Contrib = { solids: [], hazards: [], springs: [], winds: [], beams: [] };
    const ctx = (rp: typeof r, mi: number) => ({
      level,
      frame: f,
      r: rp,
      off: [0, 0] as [number, number],
      prev: [0, 0] as [number, number],
      state,
      mi,
      live: true,
    });
    r.mods.forEach((m: Module, mi) => {
      const n = c.hazards.length;
      moduleSim(m.type).build?.(m, ctx(r, mi), c);
      if (c.hazards.length > n) hurts.add(m.type);
    });
    traceRays([r], ctx, c);
    for (const b of c.beams ?? []) beams.add(r.mods[b.mi].type);
  }
  for (const t of hurts) if (!(t in TELLS)) out.push(`${pp.def.name}: ${t} hurts but has no tell in TELLS (src/gen/setpieces/contract.ts)`);
  for (const t of beams)
    if (!artSources().some((src) => src.includes(`type: '${t}'`) && src.includes('beamOf(')))
      out.push(`${pp.def.name}: ${t} reaches through space but its art doesn't draw from beamOf`);
  out.push(...windowFaults(level, pp));
  return out;
}
