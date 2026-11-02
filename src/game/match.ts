import { clamp, type Rect } from '../core/geom';
import { deriveSeed, Rng } from '../core/rng';
import { type CharacterDef, generateCharacter, TOYS, type Toy } from '../gen/character';
import { type Bridge, GRAVITY, type GravityClass, MAX_BRIDGES, type ProfileOverride, prove, settled } from '../gen/level';
import { buildLevel, type LevelRequest } from '../gen/level/pregen';
import { generateCrate, generateRoster, isBridgePart, type PropDef, type Role, rollSecret, rosterSize } from '../gen/props';
import { ageBlood, type BloodCell, cleanBlood, washBlood } from '../sim/blood';
import { DT, MAX_PLAYERS, TILE, VIEW_H, VIEW_W } from '../sim/constants';
import type { Level } from '../sim/level';
import {
  type BlastSpec,
  blastCells,
  blastEvent,
  blastSpec,
  detonate,
  detonateCharges,
  footprint,
  hangRow,
  linkPipes,
  lonePipe,
  type PlacedProp,
  type Ride,
  spotAt,
} from '../sim/props';
import { RunWorld } from '../sim/run';
import { type GameEvent, type InputFrame, NO_INPUT } from '../sim/types';
import type { ThemeId } from '../themes';
import { DEFAULT_RULES, type MatchRules } from './rules';
import { overview, viewToWorld, worldToView } from './view';
import { type RoundResult, scoreRound } from './scoring';

export type Phase = 'lobby' | 'pick' | 'place' | 'run' | 'score' | 'victory';

export interface Player {
  slot: number;
  device: string;
  character: CharacterDef;
  score: number;
  /** Rounds in a row without a point, for the underdog bonus. */
  scoreless: number;
  ready: boolean;
  /**
   * Cursor position. In the PICK phase it is in view coords (the crate cards
   * are screen-space UI); in the PLACE phase it is in WORLD px (clamped to
   * the level), converted through the deterministic overview mapping
   * (game/view.ts). Use `Match.cursorScreen` to draw it.
   */
  cursor: { x: number; y: number };
  /** Frames a direction has been held, up to the cursor's ramp. */
  cursorHeld: number;
  /** Index into the crate of the claimed prop, -1 if none. */
  claim: number;
  rot: number;
  placed: boolean;
  /**
   * Online: the owning peer is disconnected (host-issued action, see
   * src/net/actions.ts). Away players auto-pick, forfeit placement and pop at
   * the start of a race so nobody waits on them; cleared when they reconnect.
   */
  away?: boolean;
  /** Frame of this player's last input of any kind (a button down, the pointer moving). Idle rules count from it. */
  lastInput: number;
  /**
   * Idle long enough that nobody waits on them (see IDLE_FRAMES): like `away`, they auto-pick, skip placing
   * and give up a race. Any input clears it.
   */
  afk?: boolean;
  /** Rounds in a row that ended with this player AFK. Online, two of them move the player to the watchers. */
  afkRounds?: number;
  /** Online: going to watch. Plays out the round, then leaves the match as the race is scored. */
  leaving?: boolean;
}

/** No input for this long in pick, place or a race (counted from the phase's start): the phase stops waiting on you. */
export const IDLE_FRAMES = 30 * 60;
/** The lobby gives longer: people wait there for friends. */
export const LOBBY_IDLE_FRAMES = 60 * 60;
/** Rounds in a row ending with a player AFK before, online, their seat goes to whoever wants it. */
export const IDLE_ROUNDS = 2;

/** Any button down or a pointer that moved: the player is there. */
function present(inp: InputFrame | undefined): boolean {
  if (!inp) return false;
  if (inp.pointer) return true;
  for (const v of Object.values(inp)) if (v === true) return true;
  return false;
}

/** Degrees of hue between any two players' characters. Eight players still fit, with room to roll. */
const MIN_HUE_APART = 30;

/** What an away player's runner does: hold self-destruct from GO so the race can end. */
const AWAY_RUN_INPUT: InputFrame = Object.freeze({ ...NO_INPUT, altPressed: true, alt: true });

export interface CrateItem {
  def: PropDef;
  claimedBy: number;
  rect: Rect;
  /**
   * Secret Parts: the card shows only this role. Until it's claimed, `def` is
   * the crate's own draw for it, never shown; claiming rolls the real part
   * (Match.reveal) and writes it here.
   */
  secret?: Role;
}

/** Directional cursor speed, px/s: slow enough for one-tile taps, ramping while held so crossing the screen doesn't drag. */
const CURSOR_SPEED_MIN = 200;
const CURSOR_SPEED_MAX = 640;
const CURSOR_RAMP_FRAMES = 24;

const SCORE_FRAMES = 60 * 4;
/** New Level presses kept ready: more than anyone gets through before the worker catches up. */
const REROLLS_AHEAD = 3;

/** Level-profile knobs the rules force (gravity class). */
export function rulesProfile(rules: MatchRules): ProfileOverride {
  return { ...(rules.gravity === 'auto' ? {} : { gravity: GRAVITY[rules.gravity] }), ...(!rules.weather ? { weather: 'clear' as const } : {}) };
}

/**
 * The full match state machine: lobby → (pick → place → run → score)* → victory.
 * Deterministic given the seed and per-device input stream; owns no DOM.
 */
/**
 * Rounds this page has started with no proven way to the flag. Generation and `keepsWinnable` together promise
 * one, so any count is a broken guarantee, and the host reports it (src/game-client.ts). Diagnostics only, like
 * `lastGenInfo`: the sim never reads it, and it isn't match state.
 */
export const planMisses = { count: 0 };

export class Match {
  seed: number;
  level: Level;
  phase: Phase = 'lobby';
  phaseFrame = 0;
  frame = 0;
  round = 0;
  /** Rounds in a row nobody finished; a stuck match gets more help from the crate. */
  dryRounds = 0;
  players: Player[] = [];
  placed: PlacedProp[] = [];
  /** Blood on the level (sim/blood.ts). Survives rounds, like `placed`. A race adds to this same list. */
  blood: BloodCell[] = [];
  crate: CrateItem[] = [];
  run: RunWorld | null = null;
  result: RoundResult | null = null;
  /** Points each player had before the last round's awards (for score animation). */
  prevScores = new Map<number, number>();
  winners: number[] = [];
  private events: GameEvent[] = [];
  private nextUid = 1;
  private charRolls = 0;
  private pendingAdvance: number | undefined;

  /** When set, every generated level uses this theme (debug / future playlist option). */
  themeOverride: ThemeId | undefined;

  /**
   * Bridges that would finish the level as it stands, proven with the real
   * controller (gen/level/winnable.ts). Every placement keeps one, or is
   * refused, and every crate offers as many bridge cards as it has.
   */
  plan: Bridge[] = [];

  /** Match rules (time limits, target score…). Change only in the lobby. */
  rules: MatchRules = { ...DEFAULT_RULES };

  constructor(seed: number, theme?: ThemeId, rules?: MatchRules) {
    this.seed = seed >>> 0;
    this.themeOverride = theme;
    if (rules) this.rules = { ...rules };
    this.level = buildLevel(this.seed, theme, this.profileOverride());
    this.plan = this.solution();
  }

  /**
   * Level-profile knobs forced by the rules (gravity class, weather off). The
   * one place a rule reaches worldgen: `setRules` rebuilds the lobby's level
   * whenever this comes out different, so a new level-shaping rule only has to
   * be added in `rulesProfile`.
   */
  profileOverride(rules: MatchRules = this.rules): ProfileOverride {
    return { ...this.forceProfile, ...rulesProfile(rules) };
  }

  /** Debug/tools: force level-profile knobs (size, route, density…) for every generated level. */
  forceProfile: ProfileOverride = {};

  /** What the next few level changes could ask for, likeliest first, so they can be built ahead (gen/level/pregen.ts). */
  upcoming(): LevelRequest[] {
    const profile = this.profileOverride();
    const at = (seed: number, p = profile): LevelRequest => ({ seed, theme: this.themeOverride, profile: p });
    if (this.phase !== 'lobby') return [at(deriveSeed(this.seed, 'next-match'))];
    const rerolls = [deriveSeed(this.seed, 'reroll')];
    while (rerolls.length < REROLLS_AHEAD) rerolls.push(deriveSeed(rerolls[rerolls.length - 1], 'reroll'));
    // The Rules menu can ask for this seed again at any gravity.
    const gravities = (Object.keys(GRAVITY) as GravityClass[]).map((g) => at(this.seed, { ...this.forceProfile, gravity: GRAVITY[g] }));
    const here = JSON.stringify(profile);
    return [...rerolls.map((s) => at(s)), ...[at(this.seed, this.forceProfile), ...gravities].filter((r) => JSON.stringify(r.profile) !== here)];
  }

  /**
   * Replace the rules. In the lobby, a change to a rule the level is built
   * from regenerates it (same seed), so it's validated under the new rules.
   * The only way rules change: peers apply it on the same frame (net/actions.ts).
   */
  setRules(r: MatchRules) {
    const regen = this.phase === 'lobby' && JSON.stringify(this.profileOverride(r)) !== JSON.stringify(this.profileOverride());
    this.rules = { ...r };
    if (regen) this.newLevel(this.seed);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    if (this.run) e.push(...this.run.drainEvents());
    return e;
  }

  player(slot: number): Player | undefined {
    return this.players.find((p) => p.slot === slot);
  }

  step(inputs: Readonly<Record<string, InputFrame>>): void {
    for (const p of this.players) {
      if (!present(inputs[p.device])) continue;
      p.lastInput = this.frame;
      delete p.afk; // keep snapshots canonical
      delete p.afkRounds;
    }
    switch (this.phase) {
      case 'lobby':
        this.stepLobby(inputs);
        break;
      case 'pick':
        this.stepPick(inputs);
        break;
      case 'place':
        this.stepPlace(inputs);
        break;
      case 'run':
        this.stepRun(inputs);
        break;
      case 'score':
        this.stepScore(inputs);
        break;
      case 'victory':
        this.stepVictory(inputs);
        break;
    }
    this.frame++;
    this.phaseFrame++;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseFrame = 0;
    this.events.push({ type: 'phase', phase: p });
  }

  /** Frames without input in this phase: time before the phase began doesn't count against anyone. */
  idleFrames(p: Player): number {
    return Math.min(this.frame - p.lastInput, this.phaseFrame);
  }

  /** Nobody waits on this player: disconnected, or idle. */
  private gone(p: Player): boolean {
    return !!p.away || !!p.afk;
  }

  private input(p: Player, inputs: Readonly<Record<string, InputFrame>>): InputFrame {
    return inputs[p.device] ?? NO_INPUT;
  }

  // ---------------------------------------------------------------- lobby

  /**
   * A character nobody seated could be mistaken for. Rolls are counted, so every
   * peer lands on the same one. A full lobby can't always keep everyone
   * MIN_HUE_APART, so it keeps the roll furthest from anyone rather than the last,
   * preferring a toy nobody has; if every roll's toy is taken, it gets the next free one.
   */
  private rollCharacter(owner?: Player): CharacterDef {
    let best: CharacterDef | undefined;
    let any = this.rollOnce();
    for (let i = 0; i < 64; i++) {
      const c = i ? this.rollOnce() : any;
      if (this.looksFree(c, owner)) return c;
      if (this.nameTaken(c, owner)) continue;
      if (this.hueGap(c, owner) > this.hueGap(any, owner)) any = c;
      if (!this.toyTaken(c.toy, owner) && (!best || this.hueGap(c, owner) > this.hueGap(best, owner))) best = c;
    }
    if (best) return best;
    const free = TOYS.find((t) => !this.toyTaken(t, owner)) ?? any.toy;
    return { ...generateCharacter(any.seed, free), name: any.name };
  }

  private rollOnce(): CharacterDef {
    return generateCharacter(deriveSeed(this.seed, `char:${this.charRolls++}`));
  }

  /** Degrees to the nearest other player's color. */
  private hueGap(c: CharacterDef, owner?: Player): number {
    let gap = 180;
    for (const q of this.players) {
      if (q === owner) continue;
      const apart = Math.abs(q.character.hue - c.hue) % 360;
      gap = Math.min(gap, apart, 360 - apart);
    }
    return gap;
  }

  private nameTaken(c: CharacterDef, owner?: Player): boolean {
    return this.players.some((q) => q !== owner && q.character.name === c.name);
  }

  /** Eight players, eight different toys: the kind is half of telling them apart. */
  private toyTaken(toy: Toy, owner?: Player): boolean {
    return this.players.some((q) => q !== owner && q.character.toy === toy);
  }

  /** True if no other player already has this look: colors must read apart at a glance, toys and names must differ. */
  looksFree(c: CharacterDef, owner?: Player): boolean {
    return this.hueGap(c, owner) >= MIN_HUE_APART && !this.nameTaken(c, owner) && !this.toyTaken(c.toy, owner);
  }

  newLevel(seed: number, theme: ThemeId | undefined = this.themeOverride) {
    this.seed = seed >>> 0;
    this.themeOverride = theme;
    this.level = buildLevel(this.seed, theme, this.profileOverride());
    this.placed = [];
    this.plan = this.solution();
    this.blood = [];
  }

  /** The level's recorded solution, proven when it was generated: the plan a match starts from. */
  private solution(): Bridge[] {
    return (this.level.solution ?? []).map((b) => ({ ...b }));
  }

  private stepLobby(inputs: Readonly<Record<string, InputFrame>>) {
    for (const [device, inp] of Object.entries(inputs)) {
      const p = this.players.find((p) => p.device === device);
      if (!p) {
        if (inp.confirmPressed) this.join(device);
        continue;
      }
      if (inp.altPressed) {
        // A new look keeps the name: it's who you are, and online a reroll that also rolled a name flickered back to the saved one.
        p.character = { ...this.rollCharacter(p), name: p.character.name };
        p.ready = false;
      }
      if (inp.confirmPressed) p.ready = !p.ready;
      if (inp.downPressed) {
        this.newLevel(deriveSeed(this.seed, 'reroll'));
        for (const q of this.players) q.ready = false;
      }
    }
    for (const p of this.players) if (!p.ready && this.idleFrames(p) >= LOBBY_IDLE_FRAMES) p.afk = true;
    // Someone has to be here and ready; someone who isn't here doesn't hold the rest up.
    if (this.players.some((p) => p.ready && !p.afk) && this.players.every((p) => p.ready || p.afk)) this.startMatch();
  }

  /**
   * Add a player for `device` (no-op if full or already joined). Online
   * rejoins pass the player's previous `character` so they keep their look.
   */
  join(device: string, character?: CharacterDef): Player | undefined {
    if (this.players.length >= MAX_PLAYERS || this.players.some((p) => p.device === device)) return undefined;
    const used = new Set(this.players.map((p) => p.slot));
    // Mid-match, a slot someone left still owns parts and blood: a newcomer takes another while there is one.
    const owned = new Set([...this.placed.map((p) => p.owner), ...this.blood.map((c) => c.slot)]);
    let slot = 0;
    while (used.has(slot) || (owned.has(slot) && slot < MAX_PLAYERS)) slot++;
    if (slot >= MAX_PLAYERS) for (slot = 0; used.has(slot);) slot++;
    const p: Player = {
      slot,
      device,
      character: character ?? this.rollCharacter(),
      score: 0,
      scoreless: 0,
      ready: false,
      cursor: { x: 0, y: 0 },
      cursorHeld: 0,
      claim: -1,
      rot: 0,
      placed: false,
      lastInput: this.frame,
    };
    this.players.push(p);
    this.players.sort((a, b) => a.slot - b.slot);
    return p;
  }

  /** Remove `device`'s player (online: a peer left the lobby). Only valid in the lobby, where nothing references slots. */
  leave(device: string): Player | undefined {
    if (this.phase !== 'lobby') return undefined;
    const p = this.players.find((q) => q.device === device);
    if (p) this.players = this.players.filter((q) => q !== p);
    return p;
  }

  /** Leave the lobby and start round 1 (normally triggered by everyone readying up). */
  /**
   * Per-match randomness rolled by the host when a match starts (an input, so
   * online peers share it). Crate CONTENTS stay tied to the level seed; the
   * ORDER of the cards is shuffled with this so it differs every game.
   */
  nextSalt = 0;
  salt = 0;

  startMatch() {
    this.salt = this.nextSalt;
    this.round = 0;
    this.dryRounds = 0;
    this.placed = [];
    this.plan = this.solution();
    this.blood = [];
    this.result = null;
    this.winners = [];
    for (const p of this.players) {
      p.score = 0;
      p.scoreless = 0;
    }
    this.startRound();
  }

  // ---------------------------------------------------------------- pick

  private startRound() {
    // Chose to watch on the score screen: gone before the next crate, which is dealt for who's left.
    this.players = this.players.filter((p) => !p.leaving);
    if (!this.players.length) return this.toLobby();
    this.round++;
    this.run = null;
    const count = Math.max(3, this.players.length + 2);
    // Re-proven here, so bridges built from the plan shorten it. The crate offers every bridge it still has.
    const s = settled(this.level, this.placed);
    const plan = prove(s.level, s.placed, this.plan);
    if (plan) this.plan = plan;
    else planMisses.count++;
    const crate = generateCrate(this.seed, this.round, count, plan?.length ?? MAX_BRIDGES, this.dryRounds, !!lonePipe(this.placed));
    const defs = new Rng(deriveSeed(this.seed ^ this.salt, `crate-order:${this.round}`)).shuffle(crate);
    // Cards in rows of up to 5 (8 players → 10 cards → 2 rows).
    const perRow = Math.min(count, 5);
    const rows = Math.ceil(count / perRow);
    const cw = 112;
    const ch = rows > 1 ? 120 : 128;
    const gap = rows > 1 ? 10 : 12;
    const top = rows > 1 ? 96 : VIEW_H / 2 - ch / 2 + 20;
    this.crate = defs.map((def, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, count - row * perRow);
      const total = inRow * cw + (inRow - 1) * gap;
      const rect = { x: (VIEW_W - total) / 2 + (i % perRow) * (cw + gap), y: top + row * (ch + gap), w: cw, h: ch };
      // Secret Parts keeps the crate's mix of roles (its bridge, its hazard, its dry-round lean) and hides the parts.
      return this.rules.secretParts ? { def, claimedBy: -1, rect, secret: def.role } : { def, claimedBy: -1, rect };
    });
    this.players.forEach((p, i) => {
      p.claim = -1;
      p.placed = false;
      p.rot = 0;
      p.cursor = { x: VIEW_W * ((i + 1) / (this.players.length + 1)), y: VIEW_H - 40 };
    });
    this.setPhase('pick');
  }

  /** One frame of cursor movement. Public so the online view can run a guest's own cursor ahead of the host. */
  moveCursor(p: Player, inp: InputFrame) {
    const world = this.phase === 'place';
    const v = overview(this.level);
    const maxX = world ? this.level.w * TILE - 1 : VIEW_W - 1;
    const maxY = world ? this.level.h * TILE - 1 : VIEW_H - 1;
    if (inp.pointer) {
      p.cursorHeld = 0;
      const q = world ? viewToWorld(v, inp.pointer.x, inp.pointer.y) : inp.pointer;
      p.cursor.x = clamp(q.x, 0, maxX);
      p.cursor.y = clamp(q.y, 0, maxY);
      return;
    }
    const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    p.cursorHeld = dx || dy ? Math.min(p.cursorHeld + 1, CURSOR_RAMP_FRAMES) : 0;
    // Same on-screen speed whatever the zoom.
    const speed = (CURSOR_SPEED_MIN + ((CURSOR_SPEED_MAX - CURSOR_SPEED_MIN) * p.cursorHeld) / CURSOR_RAMP_FRAMES) / (world ? v.zoom : 1);
    p.cursor.x = clamp(p.cursor.x + dx * speed * DT, 0, maxX);
    p.cursor.y = clamp(p.cursor.y + dy * speed * DT, 0, maxY);
  }

  /** Where a player's cursor is on screen (view coords), whatever phase it's in. For the HUD. */
  cursorScreen(p: Player): { x: number; y: number } {
    return this.phase === 'place' ? worldToView(overview(this.level), p.cursor.x, p.cursor.y) : p.cursor;
  }

  /** Enter the place phase: cursors move from screen space into world space. */
  private enterPlace() {
    const v = overview(this.level);
    for (const p of this.players) {
      const q = viewToWorld(v, p.cursor.x, p.cursor.y);
      p.cursor = { x: clamp(q.x, 0, this.level.w * TILE - 1), y: clamp(q.y, 0, this.level.h * TILE - 1) };
    }
    this.setPhase('place');
  }

  crateItemAt(x: number, y: number): number {
    return this.crate.findIndex((c) => x >= c.rect.x && x < c.rect.x + c.rect.w && y >= c.rect.y && y < c.rect.y + c.rect.h);
  }

  private stepPick(inputs: Readonly<Record<string, InputFrame>>) {
    for (const p of this.players) {
      const inp = this.input(p, inputs);
      this.moveCursor(p, inp);
      if (p.claim < 0 && this.idleFrames(p) >= IDLE_FRAMES) p.afk = true;
      if (this.gone(p) && p.claim < 0 && this.phaseFrame > 10) {
        const i = this.crate.findIndex((c) => c.claimedBy < 0);
        if (i >= 0) this.claim(p, i);
      }
      if (p.claim < 0 && inp.confirmPressed && this.phaseFrame > 10) {
        const i = this.crateItemAt(p.cursor.x, p.cursor.y);
        if (i >= 0 && this.crate[i].claimedBy < 0) this.claim(p, i);
      }
    }
    if (this.rules.pickSeconds > 0 && this.phaseFrame >= this.rules.pickSeconds * 60) {
      // Time's up: hand out leftovers deterministically.
      const rng = new Rng(deriveSeed(this.seed, `autopick:${this.round}`));
      for (const p of this.players) {
        if (p.claim >= 0) continue;
        const free = this.crate.map((c, i) => (c.claimedBy < 0 ? i : -1)).filter((i) => i >= 0);
        if (free.length) this.claim(p, rng.pick(free));
      }
    }
    if (this.players.every((p) => p.claim >= 0)) {
      // Small beat so the last pick registers visually.
      this.pendingAdvance ??= this.phaseFrame + 25;
      if (this.phaseFrame >= this.pendingAdvance) {
        this.pendingAdvance = undefined;
        this.enterPlace();
      }
    }
  }

  private claim(p: Player, i: number) {
    const card = this.crate[i];
    if (card.secret) card.def = this.reveal(card, i, p);
    card.claimedBy = p.slot;
    p.claim = i;
    this.events.push({ type: 'claim', slot: p.slot });
  }

  /**
   * Secret Parts: what a role card turns out to be, rolled from the roster as
   * it's claimed. The stream takes the claimer and the frame, so the crate's
   * seed can't tell anyone in advance; every peer claims on the same frame, so
   * every peer rolls the same part. A card that stood in for one of the crate's
   * bridges stays the bridge while the plan needs one, so claiming every build
   * card still yields as many bridges as the plan has.
   */
  private reveal(card: CrateItem, i: number, p: Player): PropDef {
    if (this.plan.length > 0 && isBridgePart(card.def)) return card.def;
    const rng = new Rng(deriveSeed(this.seed ^ this.salt, `secret:${this.round}:${i}:${p.slot}:${this.frame}`));
    const roster = generateRoster(this.seed, rosterSize(this.crate.length));
    const taken = this.crate.filter((c) => c.claimedBy >= 0).flatMap((c) => c.def.part ?? []);
    return { ...rollSecret(rng, roster, card.secret!, this.dryRounds, taken, !!lonePipe(this.placed)), key: card.def.key };
  }

  /** Frames left in the current pick/place countdown (Infinity when untimed). */
  get phaseTimeLeft(): number {
    const secs = this.phase === 'pick' ? this.rules.pickSeconds : this.phase === 'place' ? this.rules.placeSeconds : 0;
    return secs > 0 ? Math.max(0, secs * 60 - this.phaseFrame) : Infinity;
  }

  /** Set a player's display name (an input action: deterministic, host-relayed online). */
  setName(slot: number, name: string) {
    const p = this.player(slot);
    if (p && name) p.character = { ...p.character, name };
  }

  /** Restore a player's saved look (a character seed), keeping their current name. */
  setLook(slot: number, seed: number) {
    const p = this.player(slot);
    if (p && p.character.seed !== seed) p.character = { ...generateCharacter(seed), name: p.character.name };
  }

  // ---------------------------------------------------------------- place

  /**
   * Where a player's held prop would land and what lands (`def`), centering its whole footprint on the cursor so a trimmed attachment
   * doesn't jump; whether it may (`ok`), and what it would ride (`ride`): movers keep moving while you place, so it's this frame's answer.
   */
  ghostOrigin(p: Player): { tx: number; ty: number; def: PropDef; ok: boolean; ride?: Ride } | null {
    if (p.claim < 0) return null;
    const def = this.crate[p.claim].def;
    const cells = footprint(def, p.rot);
    let w = 0;
    let h = 0;
    for (const [x, y] of cells) {
      w = Math.max(w, x + 1);
      h = Math.max(h, y + 1);
    }
    const tx = Math.floor(p.cursor.x / TILE - (w - 1) / 2);
    const y = Math.floor(p.cursor.y / TILE - (h - 1) / 2);
    const ty = def.mount === 'hang' ? hangRow(this.level, this.placed, def, tx, y) : y;
    const spot = spotAt(this.level, this.placed, def, p.rot, tx, ty, this.frame);
    return { ...spot, tx, ty };
  }

  canPlaceFor(p: Player): boolean {
    return !!this.ghostOrigin(p)?.ok;
  }

  private stepPlace(inputs: Readonly<Record<string, InputFrame>>) {
    for (const p of this.players) {
      if (!p.placed && this.idleFrames(p) >= IDLE_FRAMES) p.afk = true;
      if (p.placed || this.gone(p)) continue; // not a forfeit: back in time, they can still place
      const inp = this.input(p, inputs);
      this.moveCursor(p, inp);
      if (inp.altPressed) p.rot = (p.rot + 1) % 4;
      if (inp.confirmPressed && this.phaseFrame > 10) {
        const g = this.ghostOrigin(p);
        if (g?.ok) {
          const bomb = g.def.modules.find((m) => m.type === 'bomb');
          const pp: PlacedProp = { uid: this.nextUid, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot: p.rot, ...(g.ride && { ride: g.ride }) };
          if (!this.keepsWinnable(pp)) {
            this.events.push({ type: 'refuse', slot: p.slot, x: p.cursor.x, y: p.cursor.y });
            continue;
          }
          if (bomb && !bomb.delay) {
            this.blast(this.placed, blastSpec(bomb), g.tx, g.ty, p.rot);
          } else {
            this.nextUid++;
            this.placed.push(pp);
            this.events.push({ type: 'place', slot: p.slot, x: p.cursor.x, y: p.cursor.y });
          }
          linkPipes(this.placed);
          cleanBlood(this.blood, this.level, this.placed);
          p.placed = true;
        }
      }
    }
    if (this.rules.placeSeconds > 0 && this.phaseFrame >= this.rules.placeSeconds * 60) {
      for (const p of this.players) if (!p.placed) p.placed = true; // forfeited
    }
    if (this.players.every((p) => p.placed || this.gone(p))) {
      this.pendingAdvance ??= this.phaseFrame + 30;
      if (this.phaseFrame >= this.pendingAdvance) {
        this.pendingAdvance = undefined;
        this.startRun();
      }
    }
  }

  /**
   * Would the match stay winnable with `pp` placed (or set off, for a bomb)?
   * If so the plan moves to one that proves it (gen/level/winnable.ts); if not
   * the part is refused, so a placement can never strand the match.
   */
  private keepsWinnable(pp: PlacedProp): boolean {
    const bomb = pp.def.modules.find((m) => m.type === 'bomb');
    let level = this.level;
    let placed: PlacedProp[];
    if (bomb && bomb.type === 'bomb' && !bomb.delay) {
      level = { ...level, tiles: level.tiles.slice(), setPieces: level.setPieces.slice() };
      placed = detonate(level, [...this.placed], blastSpec(bomb), pp.tx, pp.ty, pp.rot, this.frame);
    } else placed = [...this.placed, pp];
    const s = settled(level, placed);
    const plan = prove(s.level, s.placed, this.plan, false);
    if (plan) this.plan = plan;
    return !!plan;
  }

  // ---------------------------------------------------------------- run

  /** Skip straight to the race with whatever is placed (used by pick/place flow and debug tools). */
  startRun() {
    this.detonateCharges();
    cleanBlood(this.blood, this.level, this.placed);
    this.run = new RunWorld(
      this.level,
      this.placed,
      this.players.map((p) => p.slot),
      this.rules.raceSeconds * 60,
      deriveSeed(this.seed ^ this.salt, `items:${this.round}`),
      this.blood,
      this.rules.bloodRounds > 0,
    );
    this.setPhase('run');
  }

  /** Delayed charges (time bombs) go off as the race starts, catching whatever was placed this round. A charge caught in an earlier blast is defused. */
  private detonateCharges() {
    this.placed = detonateCharges(this.level, this.placed, (spec, tx, ty, rot) => {
      washBlood(this.blood, blastCells(spec, tx, ty, rot));
      this.events.push(blastEvent(spec, tx, ty, rot));
    });
    linkPipes(this.placed);
  }

  /** A blast in either phase: `props` is what's standing when it goes off. */
  private blast(props: PlacedProp[], spec: BlastSpec, tx: number, ty: number, rot: number) {
    this.placed = detonate(this.level, props, spec, tx, ty, rot, this.frame);
    washBlood(this.blood, blastCells(spec, tx, ty, rot));
    this.events.push(blastEvent(spec, tx, ty, rot));
  }

  private stepRun(inputs: Readonly<Record<string, InputFrame>>) {
    const run = this.run!;
    for (const r of run.runners) {
      const p = this.player(r.slot);
      // Only someone still racing holds the round open: a finished or dead runner may watch as long as they like.
      if (p && r.alive && !r.finished && this.idleFrames(p) >= IDLE_FRAMES) p.afk = true;
    }
    run.step(this.players.map((p) => (this.gone(p) ? AWAY_RUN_INPUT : this.input(p, inputs))));
    if (run.endFrame >= 0 && run.frame - run.endFrame > 75) this.finishRound();
  }

  private finishRound() {
    const run = this.run!;
    ageBlood(this.blood, this.rules.bloodRounds);
    this.dryRounds = run.finishOrder.length ? 0 : this.dryRounds + 1;
    const result = scoreRound(
      this.players.map((p) => p.slot),
      run.finishOrder,
      run.kills,
      Object.fromEntries(this.players.map((p) => [p.slot, { score: p.score, scoreless: p.scoreless }])),
    );
    this.prevScores = new Map(this.players.map((p) => [p.slot, p.score]));
    for (const a of result.awards) {
      const p = this.player(a.slot);
      if (p) p.score += a.points;
    }
    for (const p of this.players) p.scoreless = result.awards.some((a) => a.slot === p.slot) ? 0 : p.scoreless + 1;
    this.result = result;
    for (const p of this.players) if (p.afk) p.afkRounds = (p.afkRounds ?? 0) + 1;
    // The round boundary: whoever chose to watch leaves now, having played the round out.
    this.players = this.players.filter((p) => !p.leaving);
    if (!this.players.length) return this.toLobby();
    this.setPhase('score');
  }

  /** Back to the lobby on a fresh level, scores cleared (after a victory, or when nobody is left playing). */
  private toLobby() {
    this.players = this.players.filter((p) => !p.leaving);
    this.newLevel(deriveSeed(this.seed, 'next-match'));
    this.run = null;
    this.result = null;
    for (const p of this.players) {
      p.ready = false;
      p.score = 0;
      p.scoreless = 0;
    }
    this.setPhase('lobby');
  }

  // ---------------------------------------------------------------- score / victory

  private stepScore(inputs: Readonly<Record<string, InputFrame>>) {
    const skip = this.phaseFrame > 90 && this.players.some((p) => this.input(p, inputs).confirmPressed);
    if (this.phaseFrame < SCORE_FRAMES && !skip) return;
    const best = Math.max(...this.players.map((p) => p.score));
    if (best >= this.rules.targetScore || this.round >= this.rules.maxRounds) {
      // Top score wins, ties are joint. At the limit with nobody on the board there is no winner, not a tie of everyone.
      this.winners = best > 0 ? this.players.filter((p) => p.score === best).map((p) => p.slot) : [];
      this.setPhase('victory');
    } else {
      this.startRound();
    }
  }

  private stepVictory(inputs: Readonly<Record<string, InputFrame>>) {
    if (this.phaseFrame > 120 && this.players.some((p) => this.input(p, inputs).confirmPressed)) this.toLobby();
  }
}
