import { describe, expect, it } from 'vitest';
import { loadVolumes, masterGain, sanitizeVolumes, saveVolumes } from '../src/audio/volumes';
import { defaultSettings } from '../src/input/bindings';
import { type Glyph, glyphSVG } from '../src/ui/glyphs';
import { capLabel, glyphsFor, promptModes } from '../src/ui/prompts';

describe('button prompts', () => {
  const profile = defaultSettings().single;

  it('labels keycaps compactly', () => {
    expect(capLabel('KeyR')).toBe('R');
    expect(capLabel('ShiftLeft')).toBe('Shift');
    expect(capLabel('ShiftRight')).toBe('R-Shift');
    expect(capLabel('Escape')).toBe('Esc');
    expect(capLabel('ArrowDown')).toBe('↓');
  });

  it('follows the live bindings, so remaps show up in prompts', () => {
    expect(glyphsFor('alt', { profile, modes: ['keyboard'] })).toEqual([{ kind: 'key', label: 'R' }]);
    const remapped = { ...profile, alt: ['KeyT'] };
    expect(glyphsFor('alt', { profile: remapped, modes: ['keyboard'] })).toEqual([{ kind: 'key', label: 'T' }]);
  });

  it('shows keyboard, mouse, pad and touch glyphs per mode', () => {
    expect(glyphsFor('confirm', { profile, modes: ['keyboard', 'gamepad'], mouse: true })).toEqual([
      { kind: 'key', label: 'Enter' },
      { kind: 'mouse', button: 'left' },
      { kind: 'pad', button: 'A' },
    ]);
    expect(glyphsFor('run', { profile, modes: ['gamepad'] })).toEqual([{ kind: 'pad', button: 'X' }]);
    expect(glyphsFor('menu', { profile, modes: ['gamepad'] })).toEqual([]);
    expect(glyphsFor('confirm', { modes: ['touch'] })).toEqual([{ kind: 'touch' }]);
  });

  it('orders glyph families by the active input', () => {
    expect(promptModes('keyboard', { keyboard: true, gamepad: false })).toEqual(['keyboard']);
    expect(promptModes('gamepad', { keyboard: true, gamepad: true })).toEqual(['gamepad', 'keyboard']);
    expect(promptModes('touch', { keyboard: true, gamepad: true })).toEqual(['touch']);
  });

  it('renders every glyph as standalone SVG', () => {
    const all: Glyph[] = [
      { kind: 'key', label: 'Space' },
      { kind: 'key', label: '<' },
      ...(['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'DPAD', 'DDOWN', 'MENU'] as const).map((button): Glyph => ({ kind: 'pad', button })),
      ...(['left', 'right', 'wheel', 'move'] as const).map((button): Glyph => ({ kind: 'mouse', button })),
      { kind: 'touch' },
    ];
    for (const g of all) {
      const s = glyphSVG(g);
      expect(s.startsWith('<svg')).toBe(true);
      expect(s.endsWith('</svg>')).toBe(true);
      expect(s).not.toContain('NaN');
    }
    expect(glyphSVG({ kind: 'key', label: '<' })).toContain('&lt;');
  });
});

describe('mute', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('silences the master bus but keeps slider positions, and persists', () => {
    const s = store();
    const v = sanitizeVolumes({ master: 0.5, music: 0.4, sfx: 0.3, muted: true });
    expect(masterGain(v)).toBe(0);
    saveVolumes(v, s);
    expect(loadVolumes(s)).toEqual({ master: 0.5, music: 0.4, sfx: 0.3, muted: true });
    expect(masterGain(sanitizeVolumes({ ...v, muted: false }))).toBeCloseTo(0.25);
    expect('muted' in sanitizeVolumes({ master: 1, muted: 'yes' })).toBe(false);
  });
});
