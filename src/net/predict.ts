import { Match } from '../game/match';
import type { PropState } from '../sim/props';
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
 * shared because nothing mutates them during a run (bombs only go off in
 * the place phase). Object identity of `display` and of its RunWorld is kept
 * stable within a race because audio/render trackers key on it.
 */

interface RunInternals {
  events: unknown[];
  solids: unknown[];
  out: { solids: unknown[]; hazards: unknown[]; springs: unknown[]; winds: unknown[] };
  world: { tileAt: unknown; solids: unknown[] };
}

export class Predictor {
  readonly display: Match = Object.create(Match.prototype) as Match;
  private runFor: RunWorld | null = null;
  private run: RunWorld | null = null;

  /** Make `display` an exact, independent copy of `src` (race state deep-copied). */
  copy(src: Match): Match {
    const d = this.display as unknown as Record<string, unknown>;
    Object.assign(d, src);
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
    const di = d as unknown as RunInternals;
    const si = src as unknown as RunInternals;
    const solids: unknown[] = [];
    di.solids = solids;
    di.out = { solids, hazards: [], springs: [], winds: [] };
    di.world = { tileAt: si.world.tileAt, solids };
    di.events = [];
    d.runners = src.runners.map((r) => ({ ...r, body: { ...r.body } }));
    d.projectiles = src.projectiles.map((p) => ({ ...p }));
    d.finishOrder = [...src.finishOrder];
    d.kills = src.kills.map((k) => ({ ...k }));
    const ps = new Map<number, PropState>();
    for (const [uid, st] of src.propState) ps.set(uid, { ...st, aim: new Map(st.aim), vars: new Map(st.vars) });
    d.propState = ps;
    return d;
  }
}
