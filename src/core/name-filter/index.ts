/**
 * Player names against published lists of slurs and obscenities (`words.ts`, credited in public/ASSETS.md).
 * Pure and dependency-free, so the signaling API runs the same check as the game, and every peer of a room
 * gives the same answer for a name that is part of the match.
 *
 * A name is normalised before it is matched: compatibility forms and accents go (NFKD), Cyrillic and Greek
 * lookalikes read as the Latin letters they imitate, digits and symbols read as the letters they stand in
 * for, and zero-width characters vanish. A run of one letter matches the same letter run at least as long
 * in a listed word, so stretching a word doesn't hide it, and neither does spacing it out letter by letter.
 *
 * Slurs match anywhere in the name with every separator dropped. Everything else matches only a whole
 * word, so a town, a mushroom or a novelist with a listed word inside its name stays allowed.
 */
import { DSOJEVIC_EN, LDNOOBW_EN, type ListedWord } from './words';

/** LDNOOBW entries (by index) left out: they would refuse initials and the `xX…Xx` of gamer tags, not words. */
const LDNOOBW_SKIP = new Set([325, 396]);
/** dsojevic entries left out: an honorific that is also a common given name, and a mild word the game's own blood rounds earn. */
const DSOJEVIC_SKIP = new Set([48, 203]);
/** The dsojevic `lgbtq` entries that are slurs. The tag also covers words people use for themselves, and those stay allowed. */
const LGBTQ_SLURS = new Set([34, 68, 85, 150, 159, 160, 161, 246, 248, 285, 316, 353, 394]);
/** Slurs held to whole words after all: as bare letters they sit inside ordinary names and gamer tags. */
const WHOLE_WORD_SLURS = new Set([125, 303, 330]);

/**
 * How a dsojevic entry is used: matched anywhere, as a whole word, or not at all. Anywhere is for the strongest racial,
 * religious and anti-gay slurs and the strongest general profanity, and never for an entry whose authors list ordinary
 * words it hides in (its `exceptions`).
 */
function dsojevicUse(w: ListedWord, i: number): 'anywhere' | 'word' | null {
  if (DSOJEVIC_SKIP.has(i)) return null;
  const tag = (t: string) => w.tags.includes(t);
  if (tag('lgbtq') && !LGBTQ_SLURS.has(i)) return null;
  if (tag('religious') && w.severity < 3) return null;
  const slur = tag('racial') || tag('religious') || tag('lgbtq') ? w.severity >= 3 : tag('general') && w.severity === 4;
  return slur && !w.exceptions && !WHOLE_WORD_SLURS.has(i) ? 'anywhere' : 'word';
}

/** Lookalike letters from other scripts, by the Latin letter they pass for. Upper case only where it differs from lower. */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  а: 'a',
  в: 'b',
  г: 'r',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  п: 'n',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  ь: 'b',
  ѕ: 's',
  і: 'i',
  ј: 'j',
  ӏ: 'l',
  Ӏ: 'l',
  ԁ: 'd',
  ԛ: 'q',
  ԝ: 'w',
  һ: 'h',
  ү: 'y',
  ѵ: 'v',
  // Greek
  α: 'a',
  β: 'b',
  γ: 'y',
  ε: 'e',
  η: 'n',
  ι: 'i',
  κ: 'k',
  μ: 'u',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ω: 'w',
  ϲ: 'c',
  Η: 'h',
  Ζ: 'z',
  Μ: 'm',
  Ν: 'n',
  Υ: 'y',
  // Latin letters NFKD leaves whole
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  ħ: 'h',
  ŧ: 't',
  ı: 'i',
  ɩ: 'i',
  ɡ: 'g',
};

/** Digits and symbols standing in for letters. `1`, `!` and `|` could be an i or an l, so they stay `1`, which patterns read as either. */
const LEET: Record<string, string> = {
  '4': 'a',
  '@': 'a',
  '8': 'b',
  '3': 'e',
  '€': 'e',
  '6': 'g',
  '9': 'g',
  '!': '1',
  '|': '1',
  '¡': '1',
  '0': 'o',
  '5': 's',
  $: 's',
  '7': 't',
  '+': 't',
};

/** One normalised character: `c` in [a-z0-9]; `letter` false when it was written as a digit or symbol. */
interface Glyph {
  c: string;
  letter: boolean;
}

const SKIPPED = /[\p{M}\p{C}]/u;
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;
const KEPT = /^[a-z0-9]$/;

/** A hostile string can't make the check slow: a name worth keeping is far shorter. */
const MAX_SCAN = 256;

/**
 * The words of a string, normalised. Anything that normalises to no letter or digit separates words, and so does a
 * lower-to-upper case change (`BigWord`). Runs of one-character words join up, so `f.o.o` and `f o o` read as `foo`.
 */
function words(s: string): Glyph[][] {
  const out: Glyph[][] = [];
  let cur: Glyph[] = [];
  let lower = false;
  const cut = () => {
    if (cur.length) out.push(cur);
    cur = [];
  };
  for (const ch of s.slice(0, MAX_SCAN).normalize('NFKD')) {
    if (SKIPPED.test(ch)) continue; // accents and zero-width characters vanish without splitting a word
    if (lower && UPPER.test(ch)) cut();
    lower = LOWER.test(ch);
    const low = ch.toLowerCase();
    const mapped = CONFUSABLES[ch] ?? CONFUSABLES[low] ?? low;
    let kept = false;
    for (const m of mapped) {
      const c = LEET[m] ?? m;
      if (!KEPT.test(c)) continue;
      cur.push({ c, letter: c === m && m >= 'a' && m <= 'z' });
      kept = true;
    }
    if (!kept) cut();
  }
  cut();
  const merged: Glyph[][] = [];
  let spelled = false; // the last merged word is single characters joined up
  for (const w of out) {
    if (w.length === 1 && spelled) merged[merged.length - 1].push(w[0]);
    else merged.push(w);
    spelled = w.length === 1;
  }
  return merged;
}

const text = (w: Glyph[]) => w.map((g) => g.c).join('');

/** Pattern classes: an i or an l also matches the `1` that `1`, `!` and `|` become. */
const CLASS: Record<string, string> = { i: '[i1]', l: '[l1]', '1': '[1il]' };

/** A normalised word as a pattern: each run of a letter matches that letter at least as many times. */
function runs(s: string): string {
  let out = '';
  for (let i = 0; i < s.length;) {
    let j = i;
    while (s[j] === s[i]) j++;
    const k = CLASS[s[i]] ?? s[i];
    out += j - i === 1 ? `${k}+` : `${k}{${j - i},}`;
    i = j;
  }
  return out;
}

interface Patterns {
  /** Over the name with every separator dropped. */
  anywhere: RegExp;
  /** Over the name's words joined by single spaces: an entry's words, separated or run together. */
  word: RegExp;
  /** Entries with no letter or digit to normalise (an emoji), looked for as they are. */
  raw: string[];
  /** Every entry in use, as its list spells it. */
  entries: ListedEntry[];
}

export interface ListedEntry {
  text: string;
  anywhere: boolean;
}

let compiled: Patterns | undefined;

/** Built on first use: every caller in a session shares one pair of patterns. */
function patterns(): Patterns {
  if (compiled) return compiled;
  const anywhere = new Set<string>();
  const word = new Set<string>();
  const raw: string[] = [];
  const entries: ListedEntry[] = [];
  const add = (entry: string, use: 'anywhere' | 'word') => {
    entries.push({ text: entry, anywhere: use === 'anywhere' });
    const ws = words(entry.replaceAll('*', '')); // dsojevic's `x*` is "one or more x", which every run already allows
    if (!ws.length) {
      raw.push(entry);
      return;
    }
    if (use === 'anywhere') anywhere.add(runs(ws.map(text).join('')));
    else word.add(ws.map((w) => runs(text(w))).join(' ?'));
  };
  LDNOOBW_EN.forEach((e, i) => {
    if (!LDNOOBW_SKIP.has(i)) add(e, 'word');
  });
  DSOJEVIC_EN.forEach((w, i) => {
    const use = dsojevicUse(w, i);
    if (use) for (const m of w.match.split('|')) add(m, use);
  });
  compiled = {
    anywhere: new RegExp([...anywhere].join('|')),
    word: new RegExp(`(?:^| )(?:${[...word].join('|')})(?= |$)`),
    raw,
    entries,
  };
  return compiled;
}

/** The entries the filter uses and how each matches, so tests build their cases from the lists instead of spelling words out. */
export function listedEntries(): readonly ListedEntry[] {
  return patterns().entries;
}

/**
 * True if `name` holds a listed word: refuse it at entry, and show the player's generated name instead when it
 * comes from anyone else. Same answer for the same string on every machine.
 */
export function nameBlocked(name: string): boolean {
  const p = patterns();
  if (p.raw.some((r) => name.includes(r))) return true;
  const ws = words(name);
  if (!ws.length) return false;
  if (p.anywhere.test(ws.map(text).join(''))) return true;
  if (p.word.test(ws.map(text).join(' '))) return true;
  // Digits and symbols at a word's ends are often decoration (`word99`, `word!`), not letters.
  const trimmed = ws.map((w) => {
    let a = 0;
    let b = w.length;
    while (a < b && !w[a].letter) a++;
    while (b > a && !w[b - 1].letter) b--;
    return text(w.slice(a, b));
  });
  return p.word.test(trimmed.filter(Boolean).join(' '));
}
