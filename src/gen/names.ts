import type { Rng } from '../core/rng';

const ONSETS = [
  'b',
  'bl',
  'br',
  'd',
  'dr',
  'f',
  'g',
  'gl',
  'gr',
  'k',
  'kl',
  'kr',
  'm',
  'n',
  'p',
  'pl',
  'qu',
  'r',
  's',
  'sk',
  'sn',
  'sp',
  'st',
  't',
  'tw',
  'v',
  'vr',
  'w',
  'z',
  'zh',
];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'oo', 'ee', 'ai', 'au', 'y'];
const CODAS = ['', '', '', 'b', 'k', 'l', 'm', 'n', 'p', 'rk', 'sh', 'x', 'z', 'g', 'mp', 'nk'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pronounceable nonsense word, e.g. "Zhoomp", "Kraibo". */
export function word(rng: Rng, minSyl = 1, maxSyl = 3): string {
  const n = rng.int(minSyl, maxSyl);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += rng.pick(ONSETS) + rng.pick(VOWELS);
    if (i === n - 1 || rng.chance(0.25)) out += rng.pick(CODAS);
  }
  return cap(out);
}

const MAKER_SUFFIX = ['Industries', '& Sons', 'Co.', 'Labs', 'Works', 'Bros.', 'Ltd.', 'Salvage', 'Outlet'];

export function makerName(rng: Rng): string {
  return `${word(rng, 1, 2)} ${rng.pick(MAKER_SUFFIX)}`;
}
