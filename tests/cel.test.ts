import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lettering, letteringAllowed, wordFor } from '../src/render/cel';
import { CEL_FS, celNoise, NOISE_SIZE } from '../src/render/cel-shader';
import { createCompositor, type PostParams } from '../src/render/post';

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
  return { gl: new Proxy(gl, { get: (t, k) => (k in t ? t[k as string] : () => undefined) }), log };
}

/** A Canvas2D context that records which canvases it was asked to draw. */
function fake2D() {
  const drawn: unknown[] = [];
  return { ctx: { drawImage: (c: unknown) => void drawn.push(c), fillRect: () => {} }, drawn };
}

const params: PostParams = { exposure: 1, flash: 0, tint: [1, 1, 1], lift: [0, 0, 0], scale: 1, originX: 0, originY: 0, ambient: 0.8 };
const [scene, fg, light, glow] = ['scene', 'fg', 'light', 'glow'].map((name) => ({ name }) as unknown as HTMLCanvasElement);

describe('compositor', () => {
  it('ends every frame in the cel pass', () => {
    const { gl, log } = fakeGL();
    const canvas = { getContext: () => gl, addEventListener: () => {} };
    createCompositor(canvas as unknown as HTMLCanvasElement).render(scene, fg, light, glow, params);
    expect(log.draws.at(-1)).toBe(CEL_FS);
  });

  describe('without the cel pass', () => {
    afterEach(() => void vi.unstubAllGlobals());

    it('blends both albedo layers in Canvas2D when there is no WebGL2', () => {
      const { ctx, drawn } = fake2D();
      const canvas = { width: 8, height: 8, getContext: (k: string) => (k === '2d' ? ctx : null) };
      const comp = createCompositor(canvas as unknown as HTMLCanvasElement);
      comp.render(scene, fg, light, glow, params);
      expect(comp.webgl).toBe(false);
      expect(drawn.slice(0, 2)).toEqual([scene, fg]);
      expect(drawn).toContain(glow);
    });

    it('moves to a new canvas if the shaders fail, since the old one is stuck with its WebGL context', () => {
      const { ctx, drawn } = fake2D();
      const { gl } = fakeGL(true);
      const fresh = { style: {}, width: 8, height: 8, getContext: () => ctx };
      vi.stubGlobal('document', { createElement: () => fresh });
      vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
      const after = vi.fn();
      const canvas = { getContext: (k: string) => (k === 'webgl2' ? gl : null), addEventListener: () => {}, after };
      const comp = createCompositor(canvas as unknown as HTMLCanvasElement);
      comp.resize(640, 360);
      comp.render(scene, fg, light, glow, params);
      expect(comp.webgl).toBe(false);
      expect(after).toHaveBeenCalledWith(fresh);
      expect(fresh.width).toBe(640);
      expect(drawn.slice(0, 2)).toEqual([scene, fg]);
    });
  });
});

describe('impact words', () => {
  it('have a page switch', () => {
    expect(letteringAllowed('?seed=a')).toBe(true);
    expect(letteringAllowed('?seed=a&lettering=0')).toBe(false);
  });

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

describe('line noise', () => {
  it('tiles, so the wrap never shows as a seam in the line', () => {
    const n = celNoise();
    const S = NOISE_SIZE;
    const at = (x: number, y: number, c: number) => n[(y * S + x) * 4 + c];
    let worst = 0;
    for (let i = 0; i < S; i++) {
      for (let c = 0; c < 3; c++) {
        worst = Math.max(worst, Math.abs(at(i, 0, c) - at(i, S - 1, c)), Math.abs(at(0, i, c) - at(S - 1, i, c)));
      }
    }
    // Neighbours across the wrap differ no more than neighbours anywhere: a seam would jump far more.
    expect(worst).toBeLessThan(24);
  });

  it('covers a range wide enough to move the line', () => {
    const n = celNoise();
    for (const c of [0, 1, 2]) {
      const vals = Array.from({ length: NOISE_SIZE * NOISE_SIZE }, (_, i) => n[i * 4 + c]);
      expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(120);
    }
  });
});
