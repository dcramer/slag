import { describe, expect, it } from 'vitest';
import { Lettering, wordFor } from '../src/render/cel';
import { CEL_FS } from '../src/render/cel-shader';
import { type Compositor, createCompositor, type PostParams } from '../src/render/post';
import {
  DEFAULT_STYLE,
  initialStyle,
  isRenderStyle,
  type KV,
  letteringAllowed,
  loadRenderSettings,
  RENDER_KEY,
  saveRenderSettings,
  STYLE_IDS,
  STYLES,
} from '../src/render/style';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('render style setting', () => {
  it('defaults, persists and sanitizes', () => {
    const s = mem();
    expect(loadRenderSettings(s).style).toBe(DEFAULT_STYLE);
    saveRenderSettings({ style: 'cel' }, s);
    expect(JSON.parse(s.m.get(RENDER_KEY)!)).toEqual({ style: 'cel' });
    expect(loadRenderSettings(s).style).toBe('cel');
    s.setItem(RENDER_KEY, '{"style":"vaporwave"}');
    expect(loadRenderSettings(s).style).toBe(DEFAULT_STYLE);
    s.setItem(RENDER_KEY, 'not json');
    expect(loadRenderSettings(s).style).toBe(DEFAULT_STYLE);
    expect(loadRenderSettings(null).style).toBe(DEFAULT_STYLE);
  });

  it('URL ?style= overrides the saved setting', () => {
    const s = mem();
    saveRenderSettings({ style: 'classic' }, s);
    expect(initialStyle('?seed=a', s)).toBe('classic');
    expect(initialStyle('?style=cel', s)).toBe('cel');
    expect(initialStyle('?style=bogus', mem())).toBe(DEFAULT_STYLE);
    expect(initialStyle('?style=classic', mem())).toBe('classic');
  });

  it('every registered style can be picked', () => {
    expect(isRenderStyle(DEFAULT_STYLE)).toBe(true);
    for (const id of STYLE_IDS) {
      expect(isRenderStyle(id)).toBe(true);
      expect(STYLES[id].label).not.toBe('');
    }
  });

  it('impact words have a page switch', () => {
    expect(letteringAllowed('?style=cel')).toBe(true);
    expect(letteringAllowed('?style=cel&lettering=0')).toBe(false);
  });
});

/** Just enough WebGL2 to run the compositor, recording which fragment shader each draw used. */
function fakeGL(failCel = false) {
  const log: { draws: string[]; compiled: string[] } = { draws: [], compiled: [] };
  const sources = new Map<object, string>();
  const attached = new Map<object, string>();
  let current = '';
  const gl: Record<string, unknown> = {
    createShader: () => ({}),
    shaderSource: (s: object, src: string) => void sources.set(s, src),
    compileShader: (s: object) => void log.compiled.push(sources.get(s)!),
    getShaderParameter: (s: object) => !(failCel && sources.get(s) === CEL_FS),
    getShaderInfoLog: () => 'nope',
    createProgram: () => ({}),
    attachShader: (p: object, s: object) => {
      if (sources.get(s)!.includes('out vec4 o')) attached.set(p, sources.get(s)!);
    },
    getProgramParameter: () => true,
    useProgram: (p: object) => void (current = attached.get(p)!),
    drawArrays: () => void log.draws.push(current),
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    createFramebuffer: () => ({}),
  };
  const proxy = new Proxy(gl, { get: (t, k) => (k in t ? t[k as string] : () => undefined) });
  const canvas = { getContext: () => proxy, addEventListener: () => {} };
  return { comp: createCompositor(canvas as unknown as HTMLCanvasElement), log };
}

const params: PostParams = { time: 1, aberration: 0, exposure: 1, flash: 0, tint: [1, 1, 1], lift: [0, 0, 0] };
const layer = {} as HTMLCanvasElement;
const celParams: PostParams = { ...params, cel: { fg: layer, scale: 1, ambient: 0.8 } };
const final = (c: Compositor, log: { draws: string[] }, p: PostParams) => {
  c.render(layer, layer, layer, p);
  return log.draws.at(-1);
};

describe('compositor style switch', () => {
  it('leaves the classic path alone until a cel style is asked for', () => {
    const { comp, log } = fakeGL();
    expect(final(comp, log, params)).toContain('aces');
    expect(log.compiled).not.toContain(CEL_FS);
  });

  it('toggles to the cel pass and back', () => {
    const { comp, log } = fakeGL();
    expect(final(comp, log, celParams)).toBe(CEL_FS);
    expect(final(comp, log, params)).toContain('aces');
    expect(final(comp, log, celParams)).toBe(CEL_FS);
  });

  it('keeps the classic look if the cel pass fails to build', () => {
    const { comp, log } = fakeGL(true);
    expect(final(comp, log, celParams)).toContain('aces');
  });
});

describe('impact words', () => {
  it('shouts on big moments and stays quiet on bookkeeping events', () => {
    expect(wordFor({ type: 'explosion', x: 0, y: 0, r: 3 })?.text).toBe('KA-BOOM!');
    expect(wordFor({ type: 'death', slot: 0, x: 0, y: 0, cause: 'fall', vx: 0, vy: 0 })?.text).toBe('SPLOOSH!');
    expect(wordFor({ type: 'death', slot: 0, x: 0, y: 0, cause: 'hazard', vx: 0, vy: 0 })).not.toBeNull();
    expect(wordFor({ type: 'claim', slot: 0 })).toBeNull();
    expect(wordFor({ type: 'phase', phase: 'run' })).toBeNull();
  });

  it('never wallpapers the screen when a hazard repeats', () => {
    const l = new Lettering();
    for (let i = 0; i < 40; i++) {
      l.event({ type: 'spring', x: 0, y: 0 });
      l.update(1 / 60);
    }
    expect((l as unknown as { words: unknown[] }).words).toHaveLength(1);
  });
});
