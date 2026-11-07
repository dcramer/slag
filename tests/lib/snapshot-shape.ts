/**
 * The wire shape of a match snapshot: every nested path a snapshot carries and the kind of value at it,
 * read off real snapshots of a small fixed match in every mode rather than off the source. `pnpm land`
 * bumps SNAP_VERSION when the committed shape (src/net/snapshot-shape.json) changes, which catches a
 * field added deep inside run state (a runner's items, a prop's state, a level profile knob) that a
 * diff of src/net/snapshot.ts never shows.
 *
 * Paths: `run.runners[].items.hits` (`[]` an array's elements, `{}` a Map's or id-keyed object's values,
 * `{key}` a Map's keys). A part's definition is one shape wherever it sits (the crate, the level), under
 * `PropDef`. Kinds: number, string, boolean, bytes (a Uint8Array), object, array, map, dict, or null when
 * a path was never seen holding anything else; several kinds join with `|`. Only what's in the snapshots
 * counts, so the samples put everything they can into play, and on their own terms rather than the
 * level's: every mode, a few rolls of every part archetype dropped at fixed spots, every held item used,
 * and every phase from pick to score.
 */

import { Rng } from '../../src/core/rng';
import { Match } from '../../src/game/match';
import { MODE_IDS } from '../../src/game/modes';
import { DEFAULT_RULES, withMode } from '../../src/game/rules';
import { ARCHETYPE_WEIGHTS, generateProp } from '../../src/gen/props';
import { snapshotMatch } from '../../src/net/snapshot';
import { RUN_COUNTDOWN } from '../../src/sim/constants';
import { giveItem, ITEM_KINDS, spawnItem } from '../../src/sim/items';
import { linkPipes } from '../../src/sim/props';
import { type InputFrame, NO_INPUT } from '../../src/sim/types';

/** Path → kind, sorted by path: the committed form. */
export type SnapShape = Record<string, string>;

const SEED = 4242;
const DEVICES = ['a:kb1', 'b:kb1', 'b:pad0'];
/** Rolls of each archetype on the level: optional parameters show up in some rolls and not others. */
const ROLLS = 2;
/** Subtrees that share a type, walked under one name so a crate's luck of the draw can't move the shape. */
const ALIASES: [RegExp, string][] = [[/^(crate\[\]|placed\[\])\.def$/, 'PropDef']];

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Add the shape of one wire value (a snapshot after `toWire`, as JSON carries it) under `path`. */
function walk(v: unknown, path: string, into: Map<string, Set<string>>): void {
  for (const [re, name] of ALIASES) if (re.test(path)) path = name;
  const add = (kind: string) => {
    let s = into.get(path);
    if (!s) into.set(path, (s = new Set()));
    s.add(kind);
  };
  if (v === null || v === undefined) return add('null');
  if (typeof v !== 'object') return add(typeof v);
  if (Array.isArray(v)) {
    add('array');
    for (const x of v) walk(x, `${path}[]`, into);
    return;
  }
  const o = v as Record<string, unknown>;
  // toWire's tags (src/net/snapshot.ts): an exotic number, a Map, a typed array.
  if ('$n' in o) return add('number');
  if ('$u8' in o) return add('bytes');
  if ('$m' in o) {
    add('map');
    for (const [k, x] of o.$m as [unknown, unknown][]) {
      walk(k, `${path}{key}`, into);
      walk(x, `${path}{}`, into);
    }
    return;
  }
  const keys = Object.keys(o);
  // An object keyed by ids or slots is a dictionary: its keys are data, not shape.
  if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
    add('dict');
    for (const k of keys) walk(o[k], `${path}{}`, into);
    return;
  }
  add('object');
  for (const k of keys) walk(o[k], path ? `${path}.${k}` : k, into);
}

/** Sorted paths and kinds. A path seen as null and as something else is that something: being optional is data too. */
function flatten(into: Map<string, Set<string>>): SnapShape {
  const out: SnapShape = {};
  for (const path of [...into.keys()].sort()) {
    const kinds = [...into.get(path)!];
    const real = kinds.filter((k) => k !== 'null');
    out[path] = (real.length ? real : kinds).sort().join('|');
  }
  return out;
}

/** Cursors wander and click through pick and place; runners run (one the other way) and hop. */
function inputs(m: Match, f: number, use = false): Record<string, InputFrame> {
  return Object.fromEntries(
    DEVICES.map((d, i) => {
      if (m.phase === 'pick' || m.phase === 'place') {
        const x = 100 + ((f * (3 + i)) % 560);
        return [d, press({ pointer: { x, y: 120 + ((f * 7) % 200) }, confirmPressed: f % 29 === i * 5, right: f % 50 < 10 })];
      }
      if (m.phase === 'run') {
        const jump = (f + i * 7) % 30;
        return [d, press({ right: i !== 2, left: i === 2, run: true, jump: jump < 14, jumpPressed: jump === 0, usePressed: use })];
      }
      return [d, press({ confirmPressed: f % 50 === 0 })];
    }),
  );
}

/**
 * The snapshots the shape is read from, one match per mode on a fixed seed: the pick screen, a part in
 * hand, then a race with every archetype on the level and every held item in hands, used, and loose,
 * sampled as it plays out, and the score screen after it. Parts are dropped at fixed spots without asking
 * `canPlace`: the shape needs their state on the wire, not a fair level, and a generator change that moves
 * terrain mustn't change which parts get in.
 */
function samples(): unknown[] {
  const out: unknown[] = [];
  const keep = (m: Match) => out.push(JSON.parse(JSON.stringify(snapshotMatch(m))));
  for (const mode of MODE_IDS) {
    const m = new Match(SEED, undefined, { ...withMode(DEFAULT_RULES, mode), pickSeconds: 1, placeSeconds: 1, raceSeconds: 3 });
    for (const d of DEVICES) m.join(d);
    m.players[2].bot = 'hard';
    m.startMatch();
    let f = 0;
    for (; f < 20; f++) m.step(inputs(m, f));
    keep(m);
    for (; f < 600 && m.phase === 'pick'; f++) m.step(inputs(m, f));
    for (let k = 0; k < 10; k++, f++) m.step(inputs(m, f));
    keep(m);
    let n = 0;
    for (let roll = 0; roll < ROLLS; roll++)
      ARCHETYPE_WEIGHTS.forEach(([kind], i) => {
        const def = generateProp(new Rng(SEED + roll * 101 + i), kind, `shape-${roll}-${i}`);
        const tx = 10 + ((n * 7) % (m.level.w - 20));
        const ty = 2 + ((n * 5) % (m.level.h - 6));
        m.placed.push({ uid: 9000 + n++, def, owner: m.players[n % DEVICES.length].slot, tx, ty, rot: 0 });
      });
    linkPipes(m.placed);
    m.startRun();
    const run = m.run!;
    // Past the countdown: nobody can move or use anything in it.
    m.step(inputs(m, f++));
    run.frame = RUN_COUNTDOWN;
    ITEM_KINDS.forEach((kind, i) => spawnItem(run, { kind, x: 120 + i * 24, y: 120, vx: 30, vy: 0 } as Parameters<typeof spawnItem>[1]));
    // Every 12 frames each runner is handed the next item and uses it; snapshots land between uses.
    for (let k = 0; k < 12 * ITEM_KINDS.length; k++, f++) {
      if (k % 12 === 0) run.runners.forEach((r, i) => giveItem(r, ITEM_KINDS[(k / 12 + i * 5) % ITEM_KINDS.length]));
      m.step(inputs(m, f, k % 12 === 1));
      if (k % 12 === 6) keep(m);
    }
    // Time the race out (a brawl's runs a minute) and skip the pause after it, for the score screen.
    (run as { timeLimit: number }).timeLimit = 1;
    m.step(inputs(m, f++));
    run.endFrame -= 100;
    m.step(inputs(m, f++));
    keep(m);
  }
  return out;
}

/** The live wire shape, over every sample. */
export function snapshotShape(): SnapShape {
  const into = new Map<string, Set<string>>();
  for (const s of samples()) walk(s, '', into);
  return flatten(into);
}

/** Where the committed shape lives, beside SNAP_VERSION; `pnpm land` watches it. */
export const SHAPE_FILE = 'src/net/snapshot-shape.json';

/** The committed file's text for a shape: one path per line, so a diff names what changed. */
export function shapeText(s: SnapShape): string {
  return JSON.stringify(s, null, 2) + '\n';
}

/** Paths whose kind differs, or that only one side has, as `+ path: kind` / `- path: kind` lines. */
export function shapeDiff(was: SnapShape, now: SnapShape): string[] {
  const out: string[] = [];
  for (const p of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (was[p] === now[p]) continue;
    if (p in was) out.push(`- ${p}: ${was[p]}`);
    if (p in now) out.push(`+ ${p}: ${now[p]}`);
  }
  return out;
}
