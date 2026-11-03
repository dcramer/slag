/**
 * Builds the music's recorded instruments: picks notes from CC0 / public-domain sample libraries,
 * trims and peak-normalizes them, encodes small mono MP3s into public/samples/<set>/, and writes the
 * runtime map (src/audio/music/sample-map.ts) and the credits table in public/ASSETS.md.
 *
 *   pnpm samples            fetch what's missing (cached in .cache/samples), rebuild everything
 *   pnpm samples --only harmonica,violin
 *
 * Needs ffmpeg with libmp3lame. GITHUB_TOKEN raises the API limit if you rebuild often.
 * Every source is pinned to the commit it was built from (printed into ASSETS.md); a set's notes
 * are chosen from its `match` within `range`, at most `every` semitones apart, so the runtime
 * never repitches a sample more than half that.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { argReader } from './lib/server';

const REPOS = {
  vcsl: { repo: 'sgossner/VCSL', name: 'Versilian Community Sample Library (Versilian Studios)', license: 'CC0 1.0' },
  vsco: { repo: 'sgossner/VSCO-2-CE', name: 'Versilian Studios Chamber Orchestra 2, Community Edition', license: 'CC0 1.0' },
  accordion: { repo: 'freepats/button-accordion-HN', name: 'FreePats Button Accordion HN', license: 'CC0 1.0' },
  ukulele: { repo: 'freepats/ukulele1', name: 'FreePats Ukulele', license: 'CC0 1.0' },
  eclean: { repo: 'freepats/electric-guitar-FSBS-clean', name: 'FreePats Electric Guitar FSBS (clean)', license: 'CC0 1.0' },
  edist: { repo: 'freepats/electric-guitar-FSBS-dist1', name: 'FreePats Electric Guitar FSBS (distorted 1)', license: 'CC0 1.0' },
  steel: { repo: 'sfzinstruments/jlearman.SteelDrum', name: 'jlearman Steel Drum (sfzinstruments)', license: 'The Unlicense (public domain)' },
} as const;
type RepoId = keyof typeof REPOS;

interface SetDef {
  repo: RepoId;
  /** Path inside the repo. Pitched sets name the note in group `n` (C#4, Db4); unpitched sets keep their first `hits` matches. */
  match: RegExp;
  /** Seconds kept from the onset (the runtime fades a note out at its end). */
  seconds: number;
  range?: [number, number];
  every?: number;
  hits?: number;
  /** Octave correction for the file names, where measuring can't settle it (a struck tube's pitch is heard, not present; a contrabass's fundamental is too low to find). */
  octave?: number;
  /** Overtones too far from harmonic to measure a recording's detuning. */
  inharmonic?: boolean;
  /** What it stands in for, for the credits. */
  about: string;
}

const N = '(?<n>[A-G][#b]?-?\\d)';
const re = (s: string) => new RegExp(s.replace('{n}', N));

export const SETS: Record<string, SetDef> = {
  harmonica: {
    repo: 'vcsl',
    match: re('Harmonica-Hohner-Special20-C/Sustains/Normal/Hohner-Special20_Normal_{n}\\.wav$'),
    range: [52, 88],
    every: 5,
    seconds: 2.5,
    about: 'harmonica',
  },
  recorder: {
    repo: 'vcsl',
    match: re('Baroque Soprano Recorder/Sustain/SopRecorder_Sus_{n}_rr1_Main\\.wav$'),
    range: [60, 96],
    every: 5,
    seconds: 2.5,
    about: 'tin whistle',
  },
  altrecorder: {
    repo: 'vcsl',
    match: re('Baroque Alto Recorder/Sustain/AltRecorder_Sus_{n}_rr1_Main\\.wav$'),
    range: [55, 86],
    every: 5,
    seconds: 2.5,
    about: 'recorder',
  },
  ocarina: { repo: 'vcsl', match: re('Ocarina, Typical/Sustains/Sus/StdOcarina_Sus_{n}\\.wav$'), range: [57, 86], every: 5, seconds: 2.5, about: 'ocarina' },
  harpsichord: {
    repo: 'vcsl',
    match: re('Harpsichord, English/Sustains/Normal/ZuckermannKitHarpsi_Normal_Sus_{n}_rr1\\.wav$'),
    range: [36, 84],
    every: 5,
    seconds: 2,
    about: 'harpsichord',
  },
  organ: { repo: 'vcsl', match: re('Pipe Organ/Loud/Rode_Man3Open_{n}\\.wav$'), range: [41, 84], every: 4, seconds: 2.5, about: 'pipe organ' },
  organpedal: { repo: 'vcsl', match: re('Pipe Organ/Loud Pedal/Rode_Pedal_{n}\\.wav$'), range: [24, 55], every: 4, seconds: 2.5, about: 'organ pedals' },
  strumstick: {
    repo: 'vcsl',
    match: re('Strumstick/Finger/Strumstick_Finger_Str\\d_Main_{n}_vl2_rr1\\.wav$'),
    range: [50, 86],
    every: 5,
    seconds: 1.6,
    about: 'banjo (no CC0 banjo exists; the strumstick is a twangy fretted dulcimer)',
  },
  folkharp: { repo: 'vcsl', match: re('Folk Harp/EWHarp_Normal_{n}_v2_RR1\\.wav$'), range: [43, 86], every: 5, seconds: 2, about: 'lute and harp' },
  marimba: {
    repo: 'vcsl',
    match: re('Struck Idiophones/Marimba/Marimba_hit_Outrigger_{n}_med_01\\.wav$'),
    range: [45, 90],
    every: 7,
    seconds: 1.5,
    about: 'marimba',
  },
  kalimba: {
    repo: 'vcsl',
    match: re('Kalimba, Kenya/Mbira6_Normal_MainSpirit_{n}_k\\d+_vl3_rr2\\.wav$'),
    range: [50, 90],
    every: 5,
    seconds: 1.8,
    about: 'kalimba',
  },
  glock: {
    repo: 'vcsl',
    match: re('Struck Idiophones/Glockenspiel/glock_medium_{n}_01\\.wav$'),
    range: [67, 108],
    every: 7,
    seconds: 2,
    about: 'celesta and music box',
  },
  vibes: { repo: 'vcsl', match: re('Vibraphone/Hard Mallets/Vibes_hard_{n}_v2_rr1_Main\\.wav$'), range: [53, 89], every: 5, seconds: 2.5, about: 'bells' },
  chimes: {
    repo: 'vcsl',
    match: re('Tubular Bells 1/chimes_{n}_f+_rr\\d\\.wav$'),
    range: [60, 79],
    every: 5,
    seconds: 3,
    octave: 12,
    inharmonic: true,
    about: 'tubular bells',
  },
  fmpiano: { repo: 'vcsl', match: re('TX81Z/FM Piano/FMPiano_{n}_vl2\\.wav$'), range: [36, 96], every: 12, seconds: 2, about: 'electric piano' },
  sax: {
    repo: 'vcsl',
    match: re('Tenor Saxophone/Vibrato/BrettTenor_Vib_Main_{n}_var\\d\\.wav$'),
    range: [44, 80],
    every: 5,
    seconds: 2.5,
    about: 'tenor saxophone',
  },
  violin: { repo: 'vsco', match: re('Solo Violin/Arco Vib/LLVln_ArcoVib_{n}_f\\.wav$'), range: [55, 96], every: 5, seconds: 2, about: 'fiddle' },
  contrabass: {
    repo: 'vsco',
    match: re('Solo Contrabass/Pizz/BKCtbss_Pizz_{n}_v[13]_rr1\\.wav$'),
    range: [28, 62],
    every: 5,
    seconds: 1.4,
    octave: 12,
    about: 'upright and plucked bass',
  },
  cello: { repo: 'vsco', match: re('Cello Section/susvib/susvib_{n}_v3_1\\.wav$'), range: [36, 72], every: 5, seconds: 3, about: 'low strings' },
  horn: { repo: 'vsco', match: re('F Horn/sus/MOHorn_sus_{n}_v[12]_1\\.wav$'), range: [41, 77], every: 5, seconds: 2.5, about: 'brass' },
  tuba: { repo: 'vsco', match: re('Tuba/stac/Tuba3_stac_{n}_v2_rr1_Sum\\.wav$'), range: [24, 55], every: 5, seconds: 1, about: 'tuba' },
  flute: { repo: 'vsco', match: re('Woodwinds/Flute/susvib/LDFlute_susvib_{n}_v1_1\\.wav$'), range: [60, 96], every: 5, seconds: 2.5, about: 'flute' },
  accordion: { repo: 'accordion', match: re('^Button Accordion HN {n}\\.flac$'), range: [55, 91], every: 5, seconds: 2.5, about: 'accordion' },
  ukulele: { repo: 'ukulele', match: re('^samples/{n}\\.flac$'), range: [60, 84], every: 4, seconds: 1.5, about: 'strummed guitar' },
  eguitar: { repo: 'eclean', match: re('^samples/bridge/{n}_s\\d_01\\.flac$'), range: [40, 87], every: 5, seconds: 2, about: 'twangy electric guitar' },
  dguitar: { repo: 'edist', match: re('^samples/bridge/{n}_s\\d_01\\.flac$'), range: [36, 72], every: 5, seconds: 1.5, about: 'overdriven power chords' },
  steeldrum: {
    repo: 'steel',
    match: re('^flac/SteelDrum_\\d+_+{n}_4\\.flac$'),
    range: [60, 83],
    every: 4,
    seconds: 1.5,
    inharmonic: true,
    about: 'steel drum',
  },
  framedrum: { repo: 'vcsl', match: /Frame Drum\/HDrumL_Hit_v3_rr\d_Sum\.wav$/, hits: 2, seconds: 0.6, about: 'bodhrán' },
  conga: { repo: 'vcsl', match: /Conga\/Conga_HitN_v2_rr\d_Sum\.wav$/, hits: 2, seconds: 0.6, about: 'conga' },
  bongo: { repo: 'vcsl', match: /Bongos\/BongoH_Hit1_v2_rr\d_Mid\.wav$/, hits: 2, seconds: 0.4, about: 'bongo' },
  tambourine: { repo: 'vcsl', match: /Tambourine 1\/Tamb1_Hit_v2_rr1_Mid\.wav$/, hits: 1, seconds: 0.5, about: 'tambourine' },
  anvil: { repo: 'vcsl', match: /Anvil\/Anvil_Hit[12]_v2_rr1_Mid\.wav$/, hits: 2, seconds: 1.2, about: 'anvil' },
  shaker: { repo: 'vcsl', match: /Shaker, Small\/Mid_ShakerDouble_(Down|Up)_rr1\.wav$/, hits: 2, seconds: 0.3, about: 'shaker' },
  clap: { repo: 'vcsl', match: /Claps\/Clap_rr[12]\.wav$/, hits: 2, seconds: 0.4, about: 'claps' },
  bassdrum: { repo: 'vcsl', match: /Bass Drum 1\/BDrumNew_hit_v5_rr[12]_Sum\.wav$/, hits: 2, seconds: 0.9, about: 'bass drum and taiko' },
  snare: { repo: 'vcsl', match: /Snare Drum, Modern 1\/Snare2_HitSN_v5_rr[12]_Mid\.wav$/, hits: 2, seconds: 0.5, about: 'snare' },
  sidestick: { repo: 'vcsl', match: /Snare Drum, Rope Tension\/RopeSnare_sidestick_Main_vl2_rr[12]\.wav$/, hits: 2, seconds: 0.3, about: 'rim' },
  hihat: { repo: 'vcsl', match: /Hi-Hat Cymbal\/HiHat_HitC_v2_rr[12]_Mid\.wav$/, hits: 2, seconds: 0.3, about: 'hi-hat' },
  tom: { repo: 'vcsl', match: /Tom 1\/Stick\/TomH_HitS_v3_rr[12]_Mid\.wav$/, hits: 2, seconds: 0.8, about: 'tom' },
  brakedrum: { repo: 'vcsl', match: /Brake Drum\/BrakeDrum1_Hammer_v2_rr1_Mid\.wav$/, hits: 1, seconds: 1, about: 'pickaxe clank' },
  slitdrum: { repo: 'vcsl', match: /Slit Drum\/LogDrum(Lo|Hi)_MedM_v2_rr1_Sum\.wav$/, hits: 2, seconds: 0.8, about: 'talking drum' },
  sleigh: { repo: 'vcsl', match: /Sleigh Bells\/Sleighbells_Hit_rr[12]_Mid\.wav$/, hits: 2, seconds: 0.8, about: 'sleigh bells' },
};

const CACHE = '.cache/samples';
const OUT = 'public/samples';
const MAP = 'src/audio/music/sample-map.ts';
const RATE = 32000;
const { opt } = argReader(process.argv.slice(2));
const only = opt('only')?.split(',');

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note)!;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com/${path}`, { headers });
  if (!r.ok) throw new Error(`GitHub ${path}: ${r.status}`);
  return (await r.json()) as T;
}

/** The commit a repo is built from, and every file path in it. */
async function listing(id: RepoId): Promise<{ sha: string; paths: string[] }> {
  const { repo } = REPOS[id];
  const { sha } = await gh<{ sha: string }>(`repos/${repo}/commits/HEAD`);
  const tree = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(`repos/${repo}/git/trees/${sha}?recursive=1`);
  if (tree.truncated) throw new Error(`${repo}: tree listing truncated`);
  return { sha, paths: tree.tree.filter((t) => t.type === 'blob').map((t) => t.path) };
}

/** Every recorded note of a set by the MIDI note its file name gives, one file each. */
function named(paths: string[], def: SetDef): Map<number, string> {
  const byMidi = new Map<number, string>();
  for (const p of paths) {
    const n = def.match.exec(p)?.groups?.n;
    if (n && !byMidi.has(midiOf(n))) byMidi.set(midiOf(n), p);
  }
  return byMidi;
}

/** Notes at most `every` apart across `range` (real pitches), from what the library recorded. */
function pickNotes(byMidi: Map<number, string>, def: SetDef): { midi: number; path: string }[] {
  const have = [...byMidi.keys()].sort((a, b) => a - b);
  const [lo, hi] = def.range!;
  const half = Math.floor(def.every! / 2);
  const out: number[] = [];
  // Each kept note covers itself ± half; keep the highest one that still reaches the first uncovered note.
  for (let cover = lo; cover <= hi;) {
    const last = out.at(-1) ?? -Infinity;
    let pick: number | undefined;
    for (const m of have) if (m > last && m <= cover + half) pick = m;
    pick ??= have.find((m) => m > last);
    if (pick === undefined) break;
    out.push(pick);
    cover = pick + half + 1;
  }
  return out.map((midi) => ({ midi, path: byMidi.get(midi)! }));
}

/**
 * A recording's pitch as a fractional MIDI note, by normalized autocorrelation over the first 0.4 s
 * after its onset; null when it has no clear pitch. File names can't be trusted for the octave:
 * libraries number octaves differently (VSCO's and some of VCSL's "A4" sound at A5).
 */
function detectMidi(file: string): number | null {
  const sr = 22050;
  const raw = execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB', '-f', 'f32le', '-'],
    {
      maxBuffer: 1 << 28,
    },
  );
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const minLag = Math.floor(sr / 2500);
  const maxLag = Math.floor(sr / 25);
  const s0 = Math.floor(0.03 * sr);
  const n = Math.min(x.length - s0 - maxLag, Math.floor(0.4 * sr));
  if (n < 0.08 * sr) return null;
  const rs: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let a = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = s0; i < s0 + n; i++) {
      a += x[i] * x[i + lag];
      e1 += x[i] * x[i];
      e2 += x[i + lag] * x[i + lag];
    }
    rs.push(a / Math.sqrt(e1 * e2 + 1e-12));
  }
  const best = Math.max(...rs);
  if (best < 0.8) return null;
  // The shortest period that correlates nearly as well as the best: the fundamental, not a multiple of it.
  const k = rs.findIndex((v, i) => v > best * 0.92 && v >= (rs[i - 1] ?? -1) && v >= (rs[i + 1] ?? -1));
  // Parabolic interpolation between lags for sub-sample accuracy.
  const [a, b, c] = [rs[k - 1] ?? rs[k], rs[k], rs[k + 1] ?? rs[k]];
  const lag = k + minLag + (a - c) / (2 * (a - 2 * b + c) || 1);
  return 69 + 12 * Math.log2(sr / lag / 440);
}

/** The octave correction for a set's file names: the shift most of a spread of its recordings agree on. */
async function octaveShift(id: string, def: SetDef, sha: string, byMidi: Map<number, string>): Promise<number> {
  const notes = [...byMidi.keys()].sort((a, b) => a - b);
  const probe = [0.2, 0.4, 0.6, 0.8].map((f) => notes[Math.floor(f * (notes.length - 1))]);
  const votes = new Map<number, number>();
  for (const m of new Set(probe)) {
    const d = detectMidi(await fetchTo(def.repo, sha, byMidi.get(m)!));
    if (d === null) continue;
    const shift = Math.round((d - m) / 12) * 12;
    votes.set(shift, (votes.get(shift) ?? 0) + 1);
  }
  const [shift, count] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  if (count < 2) throw new Error(`${id}: can't confirm the octave of its file names (${JSON.stringify([...votes])})`);
  return shift;
}

async function fetchTo(id: RepoId, sha: string, path: string): Promise<string> {
  const file = join(CACHE, REPOS[id].repo, sha, path);
  if (existsSync(file)) return file;
  const url = `https://raw.githubusercontent.com/${REPOS[id].repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

/** Onset-trimmed, faded, peak-normalized (−1 dBFS) mono MP3. */
function encode(src: string, dst: string, seconds: number): void {
  const fade = Math.min(0.25, seconds * 0.2);
  const shape = `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.003,atrim=end=${seconds},afade=t=out:st=${(seconds - fade).toFixed(3)}:d=${fade.toFixed(3)}`;
  const log = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "$1" -ac 1 -af "$2,volumedetect" -f null - 2>&1`, 'sh', src, shape], { encoding: 'utf8' });
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? 0);
  mkdirSync(dirname(dst), { recursive: true });
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    src,
    '-ac',
    '1',
    '-ar',
    String(RATE),
    '-af',
    `${shape},volume=${(-1 - peak).toFixed(2)}dB`,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '64k',
    dst,
  ]);
}

async function main() {
  const listings = new Map<RepoId, { sha: string; paths: string[] }>();
  const map: Record<string, { notes?: number[]; cents?: number[]; hits?: number }> = {};
  const used = new Set<RepoId>();
  for (const [id, def] of Object.entries(SETS)) {
    if (!listings.has(def.repo)) listings.set(def.repo, await listing(def.repo));
    const { sha, paths } = listings.get(def.repo)!;
    used.add(def.repo);
    let picks: { midi: number; path: string }[];
    if (def.hits) {
      picks = paths
        .filter((p) => def.match.test(p))
        .sort()
        .slice(0, def.hits)
        .map((path, i) => ({ midi: i, path }));
      if (picks.length < def.hits) throw new Error(`${id}: ${picks.length} files match ${def.match}`);
      map[id] = { hits: picks.length };
    } else {
      const byName = named(paths, def);
      if (!byName.size) throw new Error(`${id}: no files match ${def.match}`);
      const shift = def.octave ?? (await octaveShift(id, def, sha, byName));
      picks = pickNotes(new Map([...byName].map(([m, p]) => [m + shift, p])), def);
      // Each note's own tuning, so a slightly sharp recording (or a kalimba in its own temperament) plays in tune.
      const cents: number[] = [];
      for (const p of picks) {
        const d = def.inharmonic ? null : detectMidi(await fetchTo(def.repo, sha, p.path));
        cents.push(d !== null && Math.abs(d - p.midi) < 0.45 ? Math.round((d - p.midi) * 100) : 0);
      }
      map[id] = { notes: picks.map((p) => p.midi), cents };
    }
    if (only && !only.includes(id)) continue;
    rmSync(join(OUT, id), { recursive: true, force: true });
    for (const p of picks) encode(await fetchTo(def.repo, sha, p.path), join(OUT, id, `${p.midi}.mp3`), def.seconds);
    console.log(`${id.padEnd(12)} ${def.hits ? `${picks.length} hits` : picks.map((p) => p.midi).join(' ')}`);
  }

  const body = Object.entries(map)
    .map(([id, v]) => `  ${id}: ${v.notes ? `{ notes: [${v.notes.join(', ')}], cents: [${v.cents!.join(', ')}] }` : `{ hits: ${v.hits} }`},`)
    .join('\n');
  writeFileSync(
    MAP,
    `// Generated by \`pnpm samples\` (tools/samples.ts). Do not edit: change SETS there and rebuild.\n\n/** Recorded instruments in public/samples/<set>/: the MIDI notes sampled and how far each recording sits from it, or how many unpitched hits. */\nexport const SAMPLE_SETS = {\n${body}\n} as const;\n\nexport type SampleSetId = keyof typeof SAMPLE_SETS;\n`,
  );

  const rows = [...used]
    .map((r) => {
      const sets = Object.entries(SETS).filter(([, d]) => d.repo === r);
      return `| ${REPOS[r].name}, commit \`${listings.get(r)!.sha.slice(0, 7)}\` | ${sets.map(([id, d]) => `${id} (${d.about})`).join(', ')} | https://github.com/${REPOS[r].repo} | ${REPOS[r].license} |`;
    })
    .join('\n');
  const assets = readFileSync('public/ASSETS.md', 'utf8');
  const section = `## Music samples\n\nThe music's recorded instruments in \`public/samples/\`, built by \`pnpm samples\` (\`tools/samples.ts\`, which lists every source file): a few notes per instrument, trimmed, peak-normalized and encoded as mono MP3. Synth parts stay synthesized, and every instrument falls back to its synth patch until its samples load.\n\n| Library | Sets | Source | License |\n|---|---|---|---|\n${rows}\n`;
  const start = assets.indexOf('## Music samples');
  const next = start < 0 ? -1 : assets.indexOf('\n## ', start + 1);
  writeFileSync(
    'public/ASSETS.md',
    start < 0 ? `${assets.trimEnd()}\n\n${section}` : assets.slice(0, start) + section + (next < 0 ? '' : assets.slice(next + 1)),
  );
}

void main();
