/**
 * Match rules ("level settings"). Part of the deterministic match config:
 * online, the host's rules are authoritative. Persisted locally as the
 * host's preferences. 0 seconds = no time limit.
 *
 * More variations will land here (crate size, scoring tweaks, modifiers…).
 */
export interface MatchRules {
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
  /** Rounds a puddle lasts, counting the one it was spilled in. 0 = no blood at all. */
  bloodRounds: number;
}

export type GravityRule = 'auto' | 'low' | 'normal' | 'high';

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
  targetScore: NORMAL.targetScore,
  maxRounds: NORMAL.maxRounds,
  pickSeconds: 15,
  placeSeconds: 15,
  raceSeconds: 0,
  gravity: 'auto',
  weather: true,
  bloodRounds: 2,
};

export type TimerRule = 'pickSeconds' | 'placeSeconds' | 'raceSeconds';

/** Allowed values for each timer (used by the rules menu). */
export const RULE_CHOICES: Record<TimerRule, number[]> = {
  pickSeconds: [0, 10, 15, 20, 30],
  placeSeconds: [0, 15, 20, 30, 45],
  raceSeconds: [0, 30, 45, 60, 90],
};

export const GRAVITY_CHOICES: readonly GravityRule[] = ['auto', 'low', 'normal', 'high'];

export const BLOOD_CHOICES: readonly number[] = [0, 1, 2, 3];

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

const KEY = 'slag.rules.v1';

export function loadRules(): MatchRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<MatchRules>;
      const { targetScore, maxRounds } = nearestLength(saved.targetScore ?? NORMAL.targetScore);
      return { ...DEFAULT_RULES, ...saved, targetScore, maxRounds };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_RULES };
}

export function saveRules(r: MatchRules) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}
