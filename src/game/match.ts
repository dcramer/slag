import { clamp, type Rect } from '../core/geom';
import { deriveSeed, Rng } from '../core/rng';
import { type CharacterDef, generateCharacter } from '../gen/character';
import { GRAVITY, generateLevel, partsNeeded, type ProfileOverride } from '../gen/level';
import { generateCrate, type PropDef } from '../gen/props';
import { ageBlood, type BloodCell, cleanBlood, washBlood } from '../sim/blood';
import { DT, MAX_PLAYERS, TILE, VIEW_H, VIEW_W } from '../sim/constants';
import type { Level } from '../sim/level';
import { type BlastSpec, blastCells, blastEvent, blastSpec, canPlace, detonate, footprint, hangRow, landedDef, type PlacedProp } from '../sim/props';
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
}

/** What an away player's runner does: self-destruct at GO so the race can end. */
const AWAY_RUN_INPUT: InputFrame = Object.freeze({ ...NO_INPUT, altPressed: true });

export interface CrateItem {
  def: PropDef;
  claimedBy: number;
  rect: Rect;
}

/** Directional cursor speed, px/s: slow enough for one-tile taps, ramping while held so crossing the screen doesn't drag. */
const CURSOR_SPEED_MIN = 200;
const CURSOR_SPEED_MAX = 640;
const CURSOR_RAMP_FRAMES = 24;

const SCORE_FRAMES = 60 * 4;

/**
 * The full match state machine: lobby → (pick → place → run → score)* → victory.
 * Deterministic given the seed and per-device input stream; owns no DOM.
 */
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

  /** Match rules (time limits, target score…). Change only in the lobby. */
  rules: MatchRules = { ...DEFAULT_RULES };

  constructor(seed: number, theme?: ThemeId) {
    this.seed = seed >>> 0;
    this.themeOverride = theme;
    this.level = generateLevel(this.seed, theme, this.profileOverride());
  }

  /** Level-profile knobs forced by the rules (gravity class). */
  profileOverride(): ProfileOverride {
    const g = this.rules?.gravity ?? 'auto';
    return { ...this.forceProfile, ...(g === 'auto' ? {} : { gravity: GRAVITY[g] }) };
  }

  /** Debug/tools: force level-profile knobs (size, route, density…) for every generated level. */
  forceProfile: ProfileOverride = {};

  /**
   * Replace the rules. In the lobby, a gravity change regenerates the level
   * (same seed) so it's built and validated for the new gravity.
   */
  setRules(r: MatchRules) {
    const regen = this.phase === 'lobby' && r.gravity !== this.rules.gravity;
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

  private input(p: Player, inputs: Readonly<Record<string, InputFrame>>): InputFrame {
    return inputs[p.device] ?? NO_INPUT;
  }

  // ---------------------------------------------------------------- lobby

  private rollCharacter(): CharacterDef {
    return generateCharacter(deriveSeed(this.seed, `char:${this.charRolls++}`));
  }

  newLevel(seed: number, theme: ThemeId | undefined = this.themeOverride) {
    this.seed = seed >>> 0;
    this.themeOverride = theme;
    this.level = generateLevel(this.seed, theme, this.profileOverride());
    this.placed = [];
    this.blood = [];
  }

  private stepLobby(inputs: Readonly<Record<string, InputFrame>>) {
    for (const [device, inp] of Object.entries(inputs)) {
      const p = this.players.find((p) => p.device === device);
      if (!p) {
        if (inp.confirmPressed) this.join(device);
        continue;
      }
      if (inp.altPressed) {
        p.character = this.rollCharacter();
        p.ready = false;
      }
      if (inp.confirmPressed) p.ready = !p.ready;
      if (inp.downPressed) {
        this.newLevel(deriveSeed(this.seed, 'reroll'));
        for (const q of this.players) q.ready = false;
      }
    }
    if (this.players.length > 0 && this.players.every((p) => p.ready)) this.startMatch();
  }

  /**
   * Add a player for `device` (no-op if full or already joined). Online
   * rejoins pass the player's previous `character` so they keep their look.
   */
  join(device: string, character?: CharacterDef): Player | undefined {
    if (this.players.length >= MAX_PLAYERS || this.players.some((p) => p.device === device)) return undefined;
    const used = new Set(this.players.map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
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
    this.round++;
    this.run = null;
    const count = Math.max(3, this.players.length + 2);
    const crate = generateCrate(this.seed, this.round, count, partsNeeded(this.level, this.placed), this.dryRounds);
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
      return { def, claimedBy: -1, rect: { x: (VIEW_W - total) / 2 + (i % perRow) * (cw + gap), y: top + row * (ch + gap), w: cw, h: ch } };
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
      if (p.away && p.claim < 0 && this.phaseFrame > 10) {
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
    this.crate[i].claimedBy = p.slot;
    p.claim = i;
    this.events.push({ type: 'claim', slot: p.slot });
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

  /** Where a player's held prop would land and what lands (`def`), centering its whole footprint on the cursor so a trimmed attachment doesn't jump. */
  ghostOrigin(p: Player): { tx: number; ty: number; def: PropDef } | null {
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
    return { def: landedDef(this.level, this.placed, def, p.rot, tx, ty), tx, ty };
  }

  canPlaceFor(p: Player): boolean {
    const g = this.ghostOrigin(p);
    return !!g && canPlace(this.level, this.placed, g.def, p.rot, g.tx, g.ty);
  }

  private stepPlace(inputs: Readonly<Record<string, InputFrame>>) {
    for (const p of this.players) {
      if (p.away) p.placed = true; // disconnected: forfeit
      if (p.placed) continue;
      const inp = this.input(p, inputs);
      this.moveCursor(p, inp);
      if (inp.altPressed) p.rot = (p.rot + 1) % 4;
      if (inp.confirmPressed && this.phaseFrame > 10) {
        const g = this.ghostOrigin(p);
        if (g && canPlace(this.level, this.placed, g.def, p.rot, g.tx, g.ty)) {
          const bomb = g.def.modules.find((m) => m.type === 'bomb');
          if (bomb && !bomb.delay) {
            this.blast(this.placed, blastSpec(bomb), g.tx, g.ty, p.rot);
          } else {
            this.placed.push({ uid: this.nextUid++, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot: p.rot });
            this.events.push({ type: 'place', slot: p.slot, x: p.cursor.x, y: p.cursor.y });
          }
          cleanBlood(this.blood, this.level, this.placed);
          p.placed = true;
        }
      }
    }
    if (this.rules.placeSeconds > 0 && this.phaseFrame >= this.rules.placeSeconds * 60) {
      for (const p of this.players) if (!p.placed) p.placed = true; // forfeited
    }
    if (this.players.every((p) => p.placed)) {
      this.pendingAdvance ??= this.phaseFrame + 30;
      if (this.phaseFrame >= this.pendingAdvance) {
        this.pendingAdvance = undefined;
        this.startRun();
      }
    }
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
    );
    this.setPhase('run');
  }

  /** Delayed charges (time bombs) go off as the race starts, catching whatever was placed this round. A charge caught in an earlier blast is defused. */
  private detonateCharges() {
    for (const c of this.placed.filter((p) => p.def.modules.some((m) => m.type === 'bomb' && m.delay))) {
      if (!this.placed.includes(c)) continue;
      const m = c.def.modules.find((x) => x.type === 'bomb')!;
      if (m.type !== 'bomb') continue;
      this.blast(
        this.placed.filter((p) => p !== c),
        blastSpec(m),
        c.tx,
        c.ty,
        c.rot,
      );
    }
  }

  /** A blast in either phase: `props` is what's standing when it goes off. */
  private blast(props: PlacedProp[], spec: BlastSpec, tx: number, ty: number, rot: number) {
    this.placed = detonate(this.level, props, spec, tx, ty, rot);
    washBlood(this.blood, blastCells(spec, tx, ty, rot));
    this.events.push(blastEvent(spec, tx, ty, rot));
  }

  private stepRun(inputs: Readonly<Record<string, InputFrame>>) {
    const run = this.run!;
    run.step(this.players.map((p) => (p.away ? AWAY_RUN_INPUT : this.input(p, inputs))));
    if (run.endFrame >= 0 && run.frame - run.endFrame > 75) this.finishRound();
  }

  private finishRound() {
    const run = this.run!;
    ageBlood(this.blood);
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
    this.setPhase('score');
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
    if (this.phaseFrame > 120 && this.players.some((p) => this.input(p, inputs).confirmPressed)) {
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
  }
}
