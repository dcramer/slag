/**
 * Match rules ("level settings"). Part of the deterministic match config:
 * online, the host's rules are authoritative. Persisted locally as the
 * host's preferences (src/ui/rule-prefs.ts). 0 seconds = no time limit.
 *
 * More variations will land here (crate size, scoring tweaks, modifiers…).
 */
import { DEFAULT_VARIETY, type PartVariety } from '../gen/props';
import type { Difficulty } from '../sim/level';
import { MODE_IDS, MODES, type ModeId } from './modes';

export { PART_VARIETIES, type PartVariety } from '../gen/props';
export interface MatchRules {
  /** The playstyle (game/modes.ts): what a round is played for. Changing it in the lobby regenerates the level. */
  mode: ModeId;
  targetScore: number;
  /**
   * Last round of the match. Scoreless rounds don't move anyone toward
   * targetScore, so this is what guarantees a match ends: there is no "off".
   */
  maxRounds: number;
  /** Pick phase limit; stragglers get a random leftover. */
  pickSeconds: number;
  /** Place phase limit; unplaced props are forfeited. */
  placeSeconds: number;
  /** Race limit; anyone still running is eliminated. */
  raceSeconds: number;
  /**
   * World gravity: 'auto' lets each level's profile roll it (mostly normal,
   * sometimes low or high); otherwise every level uses that class
   * (gen/level/profile.ts GRAVITY). Changing it in the lobby regenerates the level.
   */
  gravity: GravityRule;
  /** Off makes every level clear. Changing it in the lobby regenerates the level. */
  weather: boolean;
  /**
   * Level difficulty: 'varies' lets each level roll its own (a fifth gentle, half medium, the rest hard,
   * gen/level/difficulty.ts); otherwise every level is that one. Changing it in the lobby regenerates the level.
   */
  difficulty: DifficultyRule;
  /** Rounds a puddle lasts, counting the one it was spilled in. 0 = no blood at all. */
  bloodRounds: number;
  /**
   * Secret Parts: the crate offers role cards (Build, Hazard…) instead of
   * parts, and a claim rolls the part from the match roster (Match.claim).
   */
  secretParts: boolean;
  /** How many different parts the match's crates deal from (rosterSize in gen/props.ts). */
  parts: PartVariety;
  /**
   * Online: kept off the public lobby list, so only an invite link or the code gets anyone in. Lobbies are public
   * by default, and every new lobby starts public: this is never saved with the host's preferences.
   */
  private: boolean;
}

export type GravityRule = 'auto' | 'low' | 'normal' | 'high';

export type DifficultyRule = 'varies' | Difficulty;

/**
 * The lobby's one match length setting. Each entry pairs a target with a
 * limit, so a length is written straight into MatchRules as plain numbers and
 * the sim and HUD never need to know lengths exist.
 */
export interface MatchLength {
  label: string;
  targetScore: number;
  maxRounds: number;
}

export const MATCH_LENGTHS: readonly MatchLength[] = [
  { label: 'Short', targetScore: 30, maxRounds: 10 },
  { label: 'Normal', targetScore: 50, maxRounds: 15 },
  { label: 'Long', targetScore: 80, maxRounds: 25 },
];

const NORMAL = MATCH_LENGTHS[1];

export const DEFAULT_RULES: MatchRules = {
  mode: 'race',
  targetScore: NORMAL.targetScore,
  maxRounds: NORMAL.maxRounds,
  pickSeconds: 15,
  placeSeconds: 15,
  raceSeconds: 0,
  gravity: 'auto',
  weather: true,
  difficulty: 'varies',
  bloodRounds: 2,
  secretParts: false,
  parts: DEFAULT_VARIETY,
  private: false,
};

export type TimerRule = 'pickSeconds' | 'placeSeconds' | 'raceSeconds';

/** Allowed values for each timer (used by the rules menu). */
export const RULE_CHOICES: Record<TimerRule, number[]> = {
  pickSeconds: [0, 10, 15, 20, 30],
  placeSeconds: [0, 15, 20, 30, 45],
  raceSeconds: [0, 30, 45, 60, 90],
};

/**
 * The points that win a match under `r` and its last round: the length's, times the mode's (`ModeDef.length`), so a
 * mode with no pick or place between rounds runs about as long as a race. A longer one's points stay on fives.
 */
export function matchGoal(r: MatchRules): { targetScore: number; maxRounds: number } {
  const k = MODES[r.mode].length;
  if (!k) return { targetScore: r.targetScore, maxRounds: r.maxRounds };
  return { targetScore: Math.round((r.targetScore * k) / 5) * 5, maxRounds: Math.round(r.maxRounds * k) };
}

export const GRAVITY_CHOICES: readonly GravityRule[] = ['auto', 'low', 'normal', 'high'];

export const BLOOD_CHOICES: readonly number[] = [0, 1, 2, 3];

export const DIFFICULTY_CHOICES: readonly DifficultyRule[] = ['varies', 'gentle', 'medium', 'hard'];

const DIFFICULTY_LABELS: Record<DifficultyRule, string> = { varies: 'Grab Bag', gentle: 'Sunday Stroll', medium: 'Fair Fight', hard: 'Pain Train' };

/** Button text for a difficulty choice (menus). */
export const difficultyLabel = (v: DifficultyRule): string => DIFFICULTY_LABELS[v];

const VARIETY_LABELS: Record<PartVariety, string> = { few: 'Few', some: 'Some', many: 'Many', all: 'All' };

/** Button text for a Parts choice (menus). */
export const varietyLabel = (v: PartVariety): string => VARIETY_LABELS[v];

/** Button text for a gravity choice (menus). */
export function gravityLabel(v: GravityRule): string {
  return v === 'auto' ? 'Auto' : v === 'low' ? 'Low' : v === 'high' ? 'High' : 'Normal';
}

/**
 * The length closest to a points target; ties and junk land on Normal. Points
 * alone decide because they were the setting players actually chose: an old
 * save's maxRounds is usually just the old default of 40.
 */
export function nearestLength(targetScore: number): MatchLength {
  return MATCH_LENGTHS.reduce((best, l) => (Math.abs(l.targetScore - targetScore) < Math.abs(best.targetScore - targetScore) ? l : best), NORMAL);
}

/**
 * Rules from a host's saved preferences (src/ui/rule-prefs.ts): only the rules this build has (an old save's Bouts per
 * Pick is gone), the length snapped to one on offer, a mode from another build played as a race, and Private off,
 * since every lobby starts public.
 */
export function restoreRules(saved: Partial<MatchRules>): MatchRules {
  const { targetScore, maxRounds } = nearestLength(saved.targetScore ?? NORMAL.targetScore);
  const mode = saved.mode && MODE_IDS.includes(saved.mode) ? saved.mode : DEFAULT_RULES.mode;
  const known = Object.fromEntries(Object.entries(saved).filter(([k]) => k in DEFAULT_RULES));
  return { ...DEFAULT_RULES, ...known, mode, targetScore, maxRounds, private: false };
}
