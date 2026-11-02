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
}

export type GravityRule = 'auto' | 'low' | 'normal' | 'high';

export const DEFAULT_RULES: MatchRules = { targetScore: 50, maxRounds: 40, pickSeconds: 15, placeSeconds: 0, raceSeconds: 0, gravity: 'auto' };

/** Allowed values for each rule (used by the rules menu). */
export const RULE_CHOICES: { [K in keyof MatchRules]: MatchRules[K][] } = {
  targetScore: [20, 30, 50, 80, 120],
  maxRounds: [10, 20, 30, 40, 60],
  pickSeconds: [0, 10, 15, 20, 30],
  placeSeconds: [0, 15, 20, 30, 45],
  raceSeconds: [0, 30, 45, 60, 90],
  gravity: ['auto', 'low', 'normal', 'high'],
};

/** Button text for a rule value (menus). */
export function ruleValueLabel(k: keyof MatchRules, v: MatchRules[keyof MatchRules]): string {
  if (k === 'gravity') return v === 'auto' ? 'Auto' : v === 'low' ? 'Low' : v === 'high' ? 'High' : 'Normal';
  if (k === 'targetScore' || k === 'maxRounds') return String(v);
  return v === 0 ? 'Off' : `${v}s`;
}

const KEY = 'slag.rules.v1';

export function loadRules(): MatchRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_RULES, ...(JSON.parse(raw) as Partial<MatchRules>) };
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
