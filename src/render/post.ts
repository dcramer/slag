/**
 * WebGL2 compositor. Canvas2D paints three layers; this combines them:
 *
 *   scene  — albedo (everything solid), multiplied by the light map
 *   light  — half-res light map; 0.5 = neutral, so lights can overbright
 *   glow   — additive emissive layer (fire, lasers, crystals, sparks)
 *
 * then adds two-level bloom, ACES tonemapping, a color grade, vignette,
 * chromatic aberration and film grain. Falls back to Canvas2D blending if
 * WebGL2 isn't available.
 */

import { reportError, reportEvent } from '../telemetry';

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const LIT = `
uniform sampler2D uScene; uniform sampler2D uLight; uniform sampler2D uGlow;
vec3 lit(vec2 uv){
  vec3 s = texture(uScene, uv).rgb;
  vec3 l = texture(uLight, uv).rgb * 2.0;
  return s * l + texture(uGlow, uv).rgb;
}`;

const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
${LIT}
uniform float uThreshold;
void main(){
  vec3 c = lit(uv);
  float l = max(c.r, max(c.g, c.b));
  vec3 g = texture(uGlow, uv).rgb;
  o = vec4(c * smoothstep(uThreshold, uThreshold + 0.45, l) * 0.6 + g * 0.7, 1.0);
}`;

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

const FINAL_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uLight; uniform sampler2D uGlow;
uniform sampler2D uBloomA; uniform sampler2D uBloomB;
uniform float uTime; uniform float uAberr; uniform float uExposure; uniform float uFlash;
uniform vec3 uTint; uniform vec3 uLift; uniform vec2 uRes;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * (0.0025 + uAberr) * (0.4 + r2 * 3.0);
  vec3 l = texture(uLight, uv).rgb * 2.0;
  vec3 s = vec3(texture(uScene, uv + off).r, texture(uScene, uv).g, texture(uScene, uv - off).b);
  vec3 g = vec3(texture(uGlow, uv + off).r, texture(uGlow, uv).g, texture(uGlow, uv - off).b);
  vec3 c = s * l + g;
  c += texture(uBloomA, uv).rgb * 0.4 + texture(uBloomB, uv).rgb * 0.5;
  c *= uExposure;
  c = aces(c * 1.05);
  c = clamp((c - 0.5) * 1.08 + 0.5, 0.0, 1.0);
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(luma), c, 1.12);
  c = c * uTint + uLift;
  c = mix(c, vec3(1.0), uFlash);
  c *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.55;
  c += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * 0.035;
  o = vec4(pow(max(c, 0.0), vec3(0.98)), 1.0);
}`;

export interface PostParams {
  time: number;
  aberration: number;
  exposure: number;
  flash: number;
  tint: [number, number, number];
  lift: [number, number, number];
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
  render(scene: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams): void;
}

export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) {
    reportEvent('webgl2 unavailable');
    return new Fallback(canvas);
  }
  canvas.addEventListener('webglcontextlost', () => reportEvent('webgl context lost'));
  try {
    return new GLCompositor(gl);
  } catch (e) {
    console.warn('WebGL compositor failed, falling back', e);
    reportError(e, { where: 'compositor-init' });
    return new Fallback(canvas);
  }
}

class GLCompositor implements Compositor {
  readonly webgl = true;
  private progBright: WebGLProgram;
  private progBlur: WebGLProgram;
  private progFinal: WebGLProgram;
  private texScene: WebGLTexture;
  private texLight: WebGLTexture;
  private texGlow: WebGLTexture;
  private half!: [Target, Target];
  private quarter!: [Target, Target];
  private w = 1;
  private h = 1;
  private loc = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: WebGL2RenderingContext) {
    const vs = this.shader(gl.VERTEX_SHADER, VS);
    this.progBright = this.program(vs, BRIGHT_FS);
    this.progBlur = this.program(vs, BLUR_FS);
    this.progFinal = this.program(vs, FINAL_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.progBright, this.progBlur, this.progFinal]) {
      const a = gl.getAttribLocation(p, 'p');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    }
    this.texScene = this.tex();
    this.texLight = this.tex();
    this.texGlow = this.tex();
    this.resize(2, 2);
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
    if (w === this.w && h === this.h && this.half) return;
    this.w = w;
    this.h = h;
    if (this.half) [...this.half, ...this.quarter].forEach((t) => this.free(t));
    const hw = Math.max(1, w >> 2);
    const hh = Math.max(1, h >> 2);
    this.half = [this.target(hw, hh), this.target(hw, hh)];
    this.quarter = [this.target(Math.max(1, hw >> 1), Math.max(1, hh >> 1)), this.target(Math.max(1, hw >> 1), Math.max(1, hh >> 1))];
  }

  private u(p: WebGLProgram, name: string) {
    const key = `${this.progName(p)}:${name}`;
    if (!this.loc.has(key)) this.loc.set(key, this.gl.getUniformLocation(p, name));
    return this.loc.get(key)!;
  }

  private progName(p: WebGLProgram) {
    return p === this.progBright ? 'b' : p === this.progBlur ? 'z' : 'f';
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

  render(scene: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Canvas pixels are premultiplied internally; ask for that so faint additive glow stays faint.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.upload(this.texScene, scene, 0);
    this.upload(this.texLight, light, 1);
    this.upload(this.texGlow, glow, 2);

    // Bright pass → half.
    gl.useProgram(this.progBright);
    gl.uniform1i(this.u(this.progBright, 'uScene'), 0);
    gl.uniform1i(this.u(this.progBright, 'uLight'), 1);
    gl.uniform1i(this.u(this.progBright, 'uGlow'), 2);
    gl.uniform1f(this.u(this.progBright, 'uThreshold'), 0.92);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.half[0].fb);
    gl.viewport(0, 0, this.half[0].w, this.half[0].h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur(this.half[0], this.half[1], 2);

    // Downsample half → quarter by drawing through the blur program once, then blur wider.
    gl.useProgram(this.progBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quarter[0].fb);
    gl.viewport(0, 0, this.quarter[0].w, this.quarter[0].h);
    this.bindTex(this.half[0].tex, 0);
    gl.uniform1i(this.u(this.progBlur, 'uTex'), 0);
    gl.uniform2f(this.u(this.progBlur, 'uDir'), 1 / this.half[0].w, 1 / this.half[0].h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur(this.quarter[0], this.quarter[1], 3);

    // Final.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.progFinal);
    this.bindTex(this.texScene, 0);
    this.bindTex(this.texLight, 1);
    this.bindTex(this.texGlow, 2);
    this.bindTex(this.half[0].tex, 3);
    this.bindTex(this.quarter[0].tex, 4);
    const f = this.progFinal;
    gl.uniform1i(this.u(f, 'uScene'), 0);
    gl.uniform1i(this.u(f, 'uLight'), 1);
    gl.uniform1i(this.u(f, 'uGlow'), 2);
    gl.uniform1i(this.u(f, 'uBloomA'), 3);
    gl.uniform1i(this.u(f, 'uBloomB'), 4);
    gl.uniform1f(this.u(f, 'uTime'), p.time);
    gl.uniform1f(this.u(f, 'uAberr'), p.aberration);
    gl.uniform1f(this.u(f, 'uExposure'), p.exposure);
    gl.uniform1f(this.u(f, 'uFlash'), p.flash);
    gl.uniform3f(this.u(f, 'uTint'), ...p.tint);
    gl.uniform3f(this.u(f, 'uLift'), ...p.lift);
    gl.uniform2f(this.u(f, 'uRes'), this.w, this.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

/** Plain Canvas2D blending for browsers without WebGL2. No bloom/tonemap. */
class Fallback implements Compositor {
  readonly webgl = false;
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }
  resize() {}
  render(scene: HTMLCanvasElement, light: HTMLCanvasElement, glow: HTMLCanvasElement, p: PostParams) {
    const c = this.ctx;
    const { width: w, height: h } = this.canvas;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(scene, 0, 0, w, h);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(light, 0, 0, w, h);
    c.globalCompositeOperation = 'color-dodge';
    c.globalAlpha = 0.25;
    c.drawImage(light, 0, 0, w, h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glow, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    if (p.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${p.flash})`;
      c.fillRect(0, 0, w, h);
    }
  }
}
