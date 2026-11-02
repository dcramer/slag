/**
 * WebGL2 compositor. Canvas2D paints the layers and the cel pass (cel-shader.ts) combines them:
 *
 *   scene  — the background: sky, skyline, scenery
 *   fg     — everything the player interacts with, on transparency
 *   light  — half-res light map; 0.5 = neutral, so lights can overbright
 *   glow   — additive emissive layer (fire, lasers, crystals, sparks)
 *
 * Two levels of bloom over the glow layer feed the pass's halos, and tell a beam from a spark.
 * Falls back to Canvas2D blending if WebGL2 isn't available, and while a lost context is away.
 */

import { reportError, reportEvent } from '../telemetry';
import { CEL_FS, CEL_SHADOW, celNoise, MIST_MAX, NOISE_SIZE } from './cel-shader';

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/** Bloom only from what is actually emissive: a white cloud shouldn't halo. */
const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uGlow;
void main(){ o = vec4(texture(uGlow, uv).rgb * 0.7, 1.0); }`;

const BLUR_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 c = texture(uTex, uv).rgb * 0.227027;
  c += texture(uTex, uv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, uv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, uv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, uv - uDir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

export interface PostParams {
  exposure: number;
  flash: number;
  tint: [number, number, number];
  lift: [number, number, number];
  /** Pixels per world unit of `fg`. */
  scale: number;
  /** Canvas px of the world's origin: the line's noise is pinned to the world, so it stays put as the camera moves. */
  originX: number;
  originY: number;
  /** The theme's ambient light, which the light bands sit relative to. */
  ambient: number;
  /** Mist: a small canvas whose alpha is how thick the air is, or null for clear air (render/weather.ts). */
  mist?: HTMLCanvasElement | null;
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export interface Compositor {
  readonly webgl: boolean;
  resize(w: number, h: number): void;
  render(scene: HTMLCanvasElement, fg: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams): void;
}

export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) {
    reportEvent('webgl2 unavailable');
    return new Fallback(canvas);
  }
  try {
    return new GLCompositor(canvas, gl);
  } catch (e) {
    console.warn('WebGL compositor failed, falling back', e);
    reportError(e, { where: 'compositor-init' });
    return new Fallback(overlay(canvas));
  }
}

/**
 * A canvas that has handed out a WebGL context never gives a 2D one, so a shader that won't build
 * needs a new canvas for the picture. The old one stays underneath: it holds focus and the cursor.
 */
function overlay(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  canvas.after(c);
  return c;
}

/**
 * The cel pass. A GPU can take its context away at any time (a driver reset, a phone backgrounding the
 * tab, too many contexts), and everything made on it goes too. Until the browser gives it back, the game
 * keeps drawing through a stand-in (`Fallback` on a canvas over this one). When it does, everything is
 * built again from source: programs, the noise, the mist and the bloom targets. Nothing else on the GPU
 * lasts from one frame to the next, so nothing else needs to come back.
 */
class GLCompositor implements Compositor {
  private progBright!: WebGLProgram;
  private progBlur!: WebGLProgram;
  private progCel!: WebGLProgram;
  private texScene!: WebGLTexture;
  private texFg!: WebGLTexture;
  private texLight!: WebGLTexture;
  private texGlow!: WebGLTexture;
  private texNoise!: WebGLTexture;
  private texMist!: WebGLTexture;
  private hasMist = false;
  private half: [Target, Target] | null = null;
  private quarter!: [Target, Target];
  private w = 2;
  private h = 2;
  private loc = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  /** Draws the frame while the context is lost, on its own canvas laid over this one. */
  private stand: { comp: Fallback; canvas: HTMLCanvasElement } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
  ) {
    this.build();
    canvas.addEventListener('webglcontextlost', (e) => {
      // Without this the browser never offers the context back.
      e.preventDefault();
      reportEvent('webgl context lost');
      this.standIn();
    });
    canvas.addEventListener('webglcontextrestored', () => this.restore());
  }

  get webgl(): boolean {
    return !this.stand;
  }

  /** Everything the pass needs on the GPU, from nothing: at start and after a restore. */
  private build() {
    const gl = this.gl;
    this.loc.clear();
    this.hasMist = false;
    this.half = null;
    const vs = this.shader(gl.VERTEX_SHADER, VS);
    this.progBright = this.program(vs, BRIGHT_FS);
    this.progBlur = this.program(vs, BLUR_FS);
    this.progCel = this.program(vs, CEL_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.progBright, this.progBlur, this.progCel]) {
      const a = gl.getAttribLocation(p, 'p');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    }
    this.texScene = this.tex();
    this.texFg = this.tex();
    this.texLight = this.tex();
    this.texGlow = this.tex();
    this.texNoise = this.tex();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, celNoise());
    this.texMist = this.tex();
    this.clearMist();
    this.targets();
  }

  private standIn() {
    if (this.stand) return;
    const canvas = overlay(this.canvas);
    const comp = new Fallback(canvas);
    comp.resize(this.w, this.h);
    this.stand = { comp, canvas };
  }

  private restore() {
    try {
      this.build();
    } catch (e) {
      // It came back unable to build the pass: the stand-in keeps drawing for the rest of the session.
      reportError(e, { where: 'compositor-restore' });
      return;
    }
    this.stand?.canvas.remove();
    this.stand = null;
    reportEvent('webgl context restored', 'info');
  }

  /** One clear texel, so a clear level pays for neither an upload nor a branch in the frame loop. */
  private clearMist() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texMist);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  private shader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  }

  private program(vs: WebGLShader, fs: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  private tex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = this.tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  private free(t: Target) {
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }

  resize(w: number, h: number) {
    this.stand?.comp.resize(w, h);
    if (w === this.w && h === this.h && this.half) return;
    this.w = w;
    this.h = h;
    this.targets();
  }

  /** Bloom targets at a quarter and an eighth of the picture. */
  private targets() {
    if (this.half) [...this.half, ...this.quarter].forEach((t) => this.free(t));
    const hw = Math.max(1, this.w >> 2);
    const hh = Math.max(1, this.h >> 2);
    this.half = [this.target(hw, hh), this.target(hw, hh)];
    this.quarter = [this.target(Math.max(1, hw >> 1), Math.max(1, hh >> 1)), this.target(Math.max(1, hw >> 1), Math.max(1, hh >> 1))];
  }

  private u(p: WebGLProgram, name: string) {
    let names = this.loc.get(p);
    if (!names) this.loc.set(p, (names = new Map()));
    if (!names.has(name)) names.set(name, this.gl.getUniformLocation(p, name));
    return names.get(name)!;
  }

  private upload(t: WebGLTexture, src: HTMLCanvasElement, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  private bindTex(t: WebGLTexture, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  private blur(src: Target, tmp: Target, passes: number) {
    const gl = this.gl;
    gl.useProgram(this.progBlur);
    gl.uniform1i(this.u(this.progBlur, 'uTex'), 0);
    for (let i = 0; i < passes; i++) {
      const s = 1 + i * 0.6;
      gl.bindFramebuffer(gl.FRAMEBUFFER, tmp.fb);
      gl.viewport(0, 0, tmp.w, tmp.h);
      this.bindTex(src.tex, 0);
      gl.uniform2f(this.u(this.progBlur, 'uDir'), s / src.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, src.fb);
      gl.viewport(0, 0, src.w, src.h);
      this.bindTex(tmp.tex, 0);
      gl.uniform2f(this.u(this.progBlur, 'uDir'), 0, s / src.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  render(scene: HTMLCanvasElement, fg: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams) {
    if (this.stand) return this.stand.comp.render(scene, fg, light, glow, p);
    const gl = this.gl;
    const half = this.half!;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Canvas pixels are premultiplied internally; ask for that so faint additive glow stays faint.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.upload(this.texScene, scene, 0);
    this.upload(this.texLight, light, 1);
    this.upload(this.texGlow, glow, 2);
    this.upload(this.texFg, fg, 5);
    if (p.mist) this.upload(this.texMist, p.mist, 6);
    else if (this.hasMist) {
      gl.activeTexture(gl.TEXTURE6);
      this.clearMist();
    }
    this.hasMist = !!p.mist;

    // Bright pass → half.
    gl.useProgram(this.progBright);
    gl.uniform1i(this.u(this.progBright, 'uGlow'), 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, half[0].fb);
    gl.viewport(0, 0, half[0].w, half[0].h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur(half[0], half[1], 2);

    // Downsample half → quarter by drawing through the blur program once, then blur wider.
    gl.useProgram(this.progBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quarter[0].fb);
    gl.viewport(0, 0, this.quarter[0].w, this.quarter[0].h);
    this.bindTex(half[0].tex, 0);
    gl.uniform1i(this.u(this.progBlur, 'uTex'), 0);
    gl.uniform2f(this.u(this.progBlur, 'uDir'), 1 / half[0].w, 1 / half[0].h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur(this.quarter[0], this.quarter[1], 3);

    // Final.
    const f = this.progCel;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(f);
    this.bindTex(this.texScene, 0);
    this.bindTex(this.texLight, 1);
    this.bindTex(this.texGlow, 2);
    this.bindTex(half[0].tex, 3);
    this.bindTex(this.quarter[0].tex, 4);
    this.bindTex(this.texMist, 6);
    gl.uniform1i(this.u(f, 'uScene'), 0);
    gl.uniform1i(this.u(f, 'uLight'), 1);
    gl.uniform1i(this.u(f, 'uGlow'), 2);
    gl.uniform1i(this.u(f, 'uBloomA'), 3);
    gl.uniform1i(this.u(f, 'uBloomB'), 4);
    gl.uniform1i(this.u(f, 'uFg'), 5);
    gl.uniform1i(this.u(f, 'uMist'), 6);
    gl.uniform1f(this.u(f, 'uExposure'), p.exposure);
    gl.uniform1f(this.u(f, 'uFlash'), p.flash);
    gl.uniform3f(this.u(f, 'uTint'), ...p.tint);
    gl.uniform3f(this.u(f, 'uLift'), ...p.lift);
    gl.uniform2f(this.u(f, 'uRes'), this.w, this.h);
    gl.uniform1f(this.u(f, 'uAmbient'), p.ambient);
    gl.uniform2f(this.u(f, 'uShadow'), (-CEL_SHADOW[0] * p.scale) / this.w, (CEL_SHADOW[1] * p.scale) / this.h);
    gl.uniform3f(this.u(f, 'uView'), p.scale, p.originX, p.originY);
    // Unit 7: 0-6 are the layers, the bloom and the mist.
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.texNoise);
    gl.uniform1i(this.u(f, 'uNoise'), 7);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

/** Plain Canvas2D blending for browsers without WebGL2. No bloom, bands or ink: those need per-pixel work. */
class Fallback implements Compositor {
  readonly webgl = false;
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }
  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
  render(scene: HTMLCanvasElement, fg: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams) {
    const c = this.ctx;
    const { width: w, height: h } = this.canvas;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(scene, 0, 0, w, h);
    c.drawImage(fg, 0, 0, w, h);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(light, 0, 0, w, h);
    c.globalCompositeOperation = 'color-dodge';
    c.globalAlpha = 0.25;
    c.drawImage(light, 0, 0, w, h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glow, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    if (p.mist) {
      c.globalAlpha = MIST_MAX;
      c.drawImage(p.mist, 0, 0, w, h);
      c.globalAlpha = 1;
    }
    if (p.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${p.flash})`;
      c.fillRect(0, 0, w, h);
    }
  }
}
