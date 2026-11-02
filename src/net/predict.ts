import { Match } from '../game/match';
import { RunWorld } from '../sim/run';

/**
 * Cheap in-memory copies for client-side prediction during races. A guest
 * renders `display`: the confirmed match copied and then stepped ahead with
 * its own not-yet-confirmed inputs (and everyone else's last known buttons),
 * so its own runner responds immediately instead of a round trip later.
 * Every time new confirmed frames arrive the copy is rebuilt from the
 * confirmed state (i.e. rollback + re-simulate).
 *
 * Only race state is deep-copied; the level, placed props and crate are
 * shared because nothing mutates them mid-race (bombs go off in the place
 * phase or at the start of the race, and prediction stops at phase changes). Object identity of `display` and of its RunWorld is kept
 * stable within a race because audio/render trackers key on it.
 */

interface RunInternals {
  events: unknown[];
  solids: unknown[];
  out: Record<string, unknown[]>;
  world: { solids: unknown[] };
}

export class Predictor {
  readonly display: Match = Object.create(Match.prototype) as Match;
  private runFor: RunWorld | null = null;
  private run: RunWorld | null = null;

  /** Make `display` an exact, independent copy of `src` (race state deep-copied). */
  copy(src: Match): Match {
    const d = this.display as unknown as Record<string, unknown>;
    Object.assign(d, src);
    dropOwnFunctions(d); // a profiler's wrappers close over the live match: stepping them would step it
    d.events = [];
    this.display.players = src.players.map((p) => ({ ...p, cursor: { ...p.cursor } }));
    this.display.prevScores = new Map(src.prevScores);
    this.display.winners = [...src.winners];
    this.display.run = src.run ? this.copyRun(src.run) : null;
    return this.display;
  }

  /** Mirror without deep copies (display is not going to be stepped). */
  mirror(src: Match): Match {
    Object.assign(this.display, src);
    return this.display;
  }

  private copyRun(src: RunWorld): RunWorld {
    if (this.runFor !== src || !this.run) {
      this.runFor = src;
      this.run = Object.create(RunWorld.prototype) as RunWorld;
    }
    const d = this.run;
    Object.assign(d, src);
    dropOwnFunctions(d as unknown as Record<string, unknown>);
    const di = d as unknown as RunInternals;
    const si = src as unknown as RunInternals;
    const solids: unknown[] = [];
    di.solids = solids;
    // Rebuilt from scratch every frame, so empty lists are a faithful copy of whatever props contribute.
    di.out = Object.fromEntries(Object.keys(si.out).map((k) => [k, k === 'solids' ? solids : []]));
    di.world = { ...si.world, solids }; // Everything but the solids is the level's: gravity and footing have to carry over.
    di.events = [];
    // Deep: a stepped copy must never reach confirmed state, and race state keeps growing nested fields.
    d.runners = structuredClone(src.runners);
    d.projectiles = structuredClone(src.projectiles);
    d.finishOrder = [...src.finishOrder];
    d.kills = src.kills.map((k) => ({ ...k }));
    d.propState = structuredClone(src.propState);
    d.items = structuredClone(src.items);
    return d;
  }
}

function dropOwnFunctions(o: Record<string, unknown>) {
  for (const k of Object.keys(o)) if (typeof o[k] === 'function') delete o[k];
}
