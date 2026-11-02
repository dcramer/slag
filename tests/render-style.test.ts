import { describe, expect, it } from 'vitest';
import { Lettering, wordFor } from '../src/render/comic';
import { COMIC_FS } from '../src/render/comic-shader';
import { type Compositor, createCompositor, type PostParams } from '../src/render/post';
import { initialStyle, type KV, loadRenderSettings, RENDER_KEY, saveRenderSettings } from '../src/render/style';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('render style setting', () => {
  it('defaults, persists and sanitizes', () => {
    const s = mem();
    expect(loadRenderSettings(s).style).toBe('default');
    saveRenderSettings({ style: 'comic' }, s);
    expect(JSON.parse(s.m.get(RENDER_KEY)!)).toEqual({ style: 'comic' });
    expect(loadRenderSettings(s).style).toBe('comic');
    s.setItem(RENDER_KEY, '{"style":"vaporwave"}');
    expect(loadRenderSettings(s).style).toBe('default');
    s.setItem(RENDER_KEY, 'not json');
    expect(loadRenderSettings(s).style).toBe('default');
    expect(loadRenderSettings(null).style).toBe('default');
  });

  it('URL ?style= overrides the saved setting', () => {
    const s = mem();
    saveRenderSettings({ style: 'comic' }, s);
    expect(initialStyle('?seed=a', s)).toBe('comic');
    expect(initialStyle('?style=default', s)).toBe('default');
    expect(initialStyle('?style=bogus', mem())).toBe('default');
    expect(initialStyle('?style=comic', mem())).toBe('comic');
  });
});

/** Just enough WebGL2 to run the compositor, recording which fragment shader each draw used. */
function fakeGL(failComic = false) {
  const log: { draws: string[]; compiled: string[] } = { draws: [], compiled: [] };
  const sources = new Map<object, string>();
  const attached = new Map<object, string>();
  let current = '';
  const gl: Record<string, unknown> = {
    createShader: () => ({}),
    shaderSource: (s: object, src: string) => void sources.set(s, src),
    compileShader: (s: object) => void log.compiled.push(sources.get(s)!),
    getShaderParameter: (s: object) => !(failComic && sources.get(s) === COMIC_FS),
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
  const canvas = { getContext: () => proxy };
  return { comp: createCompositor(canvas as unknown as HTMLCanvasElement), log };
}

const params: PostParams = { time: 1, aberration: 0, exposure: 1, flash: 0, tint: [1, 1, 1], lift: [0, 0, 0] };
const layer = {} as HTMLCanvasElement;
const comicParams: PostParams = { ...params, comic: { fg: layer, cam: [0, 0, 1] } };
const final = (c: Compositor, log: { draws: string[] }, p: PostParams) => {
  c.render(layer, layer, layer, p);
  return log.draws.at(-1);
};

describe('compositor style switch', () => {
  it('leaves the default path alone until the comic style is asked for', () => {
    const { comp, log } = fakeGL();
    expect(final(comp, log, params)).toContain('aces');
    expect(log.compiled).not.toContain(COMIC_FS);
  });

  it('toggles to the print pass and back', () => {
    const { comp, log } = fakeGL();
    expect(final(comp, log, comicParams)).toBe(COMIC_FS);
    expect(final(comp, log, params)).toContain('aces');
    expect(final(comp, log, comicParams)).toBe(COMIC_FS);
  });

  it('keeps the default look if the print pass fails to build', () => {
    const { comp, log } = fakeGL(true);
    expect(final(comp, log, comicParams)).toContain('aces');
  });
});

describe('comic lettering', () => {
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
