import { hash2 } from '../core/rng';

/**
 * The final pass. Everything here is a hard decision, not a gradient: base colors
 * are flat, and the renderer's real light map is cut into a few bands, so a torch throws a clean
 * shape instead of a soft pool. It needs two albedo layers (see `ForegroundLayer`), treated differently:
 *
 *   background  smooth and dimmed, like a painted backdrop: it stays quiet, and the world carries the light
 *   foreground  flat tones from albedo, light bands on top, thin ink from real alpha
 *   shadow      every foreground shape casts a hard offset shadow on the background
 *   glow        hot shapes print as opaque flat color with a thin ink casing, so a beam reads on any sky;
 *               faint glow stays soft, because a hard edge on it reads as a glass disc or a solid box
 *   mist        last, over everything: flat bands of air, so a shape past the edge is gone, not just dim
 *
 * Bands sit relative to the theme's ambient light (`uAmbient`): the light map only ever adds to
 * ambient, so fixed thresholds would leave a bright theme all one band and a dark one all shadow.
 */

/** Look knobs, baked into the shader source. Widths are in 720p pixels and scale with resolution. */
const K = {
  /** Silhouette ink width around foreground shapes, before lean and pressure. */
  ink: 0.36,
  /** Interior ink: radius of a tight cross, its edge ramp (higher = fewer lines), and its strength. */
  fine: 0.6,
  edge: [0.5, 0.86],
  fineInk: 0.5,
  /** Brightness ratio between neighboring flat tones. Relative, not absolute: a fixed step would be a huge jump on dark colors. */
  tone: 1.28,
  /** Light bands: where each starts (light relative to ambient), and how much brighter it prints. */
  lit: [1.28, 1.95],
  litGain: [0.3, 0.62],
  /** How strongly the light's own color shows on a lit band. */
  tint: 0.75,
  /** Backdrop brightness and saturation: the sky stays its hue, just below the playfield. */
  bgExposure: 0.72,
  bgSat: 0.9,
  /** How much a sun, moon or cloud top escapes that dimming (0..1). */
  bgHigh: 0.55,
  /** How much of the bands fall on the backdrop at zero ambient. They fade out as ambient rises: a prop's light on a day sky is just a stray disc. */
  bgBands: 1.1,
  /** Foreground brightness: the world carries the light. */
  fgExposure: 1.14,
  /**
   * How a rendered figure dims with the theme's ambient (its power): less than the world (0.6), so a runner
   * reads in a dark mine with no light band across it, the way its own key light used to make it.
   */
  figAmbient: 0.3,
  /** Chroma (max - min channel) above which a foreground color is calmed, and how much of the excess survives. */
  chromaKnee: 0.5,
  chromaSlope: 0.5,
  /** Darkness of the hard shadow on the backdrop (1 = none). */
  shadow: 0.8,
  /** Soft halo strength around emissives, and how much of each bloom level feeds it (quarter res, eighth res). */
  halo: 0.4,
  bloom: [0.3, 0.3],
  /** Above this brightness an emissive prints as opaque flat color. */
  solid: 0.17,
  /** A glow pixel this bright, inside a large enough glow, gets an ink casing. */
  hot: 0.4,
  /** Bloom needed for that casing: bloom is blind to small things, so sparks and motes never get ink specks. */
  hotSize: 0.2,
  /** Overall exposure, saturation and edge falloff of the final image. */
  gain: 1.0,
  sat: 0.92,
  vignette: 0.2,
  /** Hand wobble over the whole foreground: world px of drift, and world px per noise cell. */
  warp: 0.7,
  warpCell: 17,
  /** How much the silhouette leans onto the shadow side (0..1), how far pressure wanders, and how far a line takes the color of what it outlines. */
  lean: 0.45,
  press: 0.5,
  lineTint: 1,
  /** How dark a line is against what it outlines (0 = the fill itself, 1 = all ink), and its opacity. */
  lineDark: 0.62,
  lineAlpha: 0.85,
};

/** Thickest mist: a touch short of solid, so the deep bands read as air and not as a wall. */
export const MIST_MAX = 0.94;

/** Offset of the hard shadow, in world px. */
export const CEL_SHADOW: [number, number] = [2, 2.8];

const f = (n: number) => n.toFixed(4);

/**
 * Glow brightness (max channel) where bloom starts and where it's full. Below the knee an emissive lights
 * only its own pixels: a lamp's faint tail or a telegraph wash stays put, and only hot cores (fire, lasers,
 * sparks, molten slag) spread a halo.
 */
export const BLOOM_KNEE: [string, string] = [f(0.35), f(0.75)];

/** Texels per side of the line's noise, and noise cells across them. */
export const NOISE_SIZE = 256;
const NOISE_CELLS = 16;

/**
 * The line's wobble (rg) and pressure (b), baked into one tiling texture. Five value noises per pixel in
 * the shader cost a phone real time; one fetch gives the same line on every device, so low quality needs
 * no cheaper look. Periodic so it can repeat, and its period is far longer than anything you could spot.
 */
export function celNoise(): Uint8Array {
  const S = NOISE_SIZE;
  const out = new Uint8Array(S * S * 4);
  const value = (u: number, v: number, cells: number, salt: number) => {
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => hash2(i % cells, j % cells, salt);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const low = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return top + (low - top) * sy;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const i = (y * S + x) * 4;
      // A broad drift plus a finer tremor, as one hand makes both.
      out[i] = ((value(u, v, NOISE_CELLS, 11) + 0.5 * value(u, v, NOISE_CELLS * 3, 12)) / 1.5) * 255;
      out[i + 1] = ((value(u, v, NOISE_CELLS, 13) + 0.5 * value(u, v, NOISE_CELLS * 3, 14)) / 1.5) * 255;
      out[i + 2] = value(u, v, 20, 15) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

export const CEL_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uFg; uniform sampler2D uLight; uniform sampler2D uGlow;
uniform sampler2D uBloomA; uniform sampler2D uBloomB; uniform sampler2D uMist;
uniform float uExposure; uniform float uFlash; uniform float uAmbient;
uniform vec3 uTint; uniform vec3 uLift; uniform vec2 uRes; uniform vec2 uShadow;
uniform vec3 uView; uniform sampler2D uNoise;
// PAL.ink and PAL.bone (src/ui/style.ts): the game draws with the UI's own inks.
const vec3 INK = vec3(0.0706, 0.0431, 0.0314);
const vec3 BONE = vec3(0.9647, 0.9176, 0.8471);
const vec2 RING[8] = vec2[8](vec2(-1, 1), vec2(0, 1.41), vec2(1, 1), vec2(-1.41, 0), vec2(1.41, 0), vec2(-1, -1), vec2(0, -1.41), vec2(1, -1));
// The layers go up as the canvases hold them, top row first (no flip on upload, post.ts): read one at the
// GL-space point p through T(p). The bloom targets are drawn in GL space and are read at p itself.
vec2 T(vec2 p){ return vec2(p.x, 1.0 - p.y); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
// 'v' snapped to 'n' flat steps. Only the edge between two steps is antialiased, so it stays one crisp line.
float hard(float v, float n){
  float q = v * n;
  float w = min(fwidth(q) * 0.75 + 0.01, 0.5);
  return (floor(q) + smoothstep(0.5 - w, 0.5 + w, fract(q))) / n;
}
void main(){
  vec2 d = uv - 0.5;
  float k = uRes.y / 720.0;
  // World position of this pixel. Line noise is pinned here, so it stays put while the camera moves.
  vec2 wpos = (vec2(uv.x, 1.0 - uv.y) * uRes - uView.yz) / max(uView.x, 0.001);
  vec3 hand = texture(uNoise, wpos / ${f(K.warpCell * NOISE_CELLS)}).rgb;
  vec2 warp = (hand.rg - 0.5) * 3.0;
  vec2 fuv = uv + warp * ${f(K.warp)} * uView.x / uRes;

  // Light bands, from the real light map. Its alpha marks the rendered figures (Renderer.markFigures), and
  // the upload premultiplied the light by it.
  vec4 lm = texture(uLight, T(uv));
  vec3 L = lm.rgb / max(lm.a, 0.05) * 2.0 * uExposure;
  float fig = clamp((1.0 - texture(uLight, T(fuv)).a) * 2.0, 0.0, 1.0);
  float ll = max(luma(L), 1e-3);
  float rel = ll / max(uAmbient, 0.05);
  float aa = fwidth(rel) * 0.75 + 0.004;
  float b1 = smoothstep(${f(K.lit[0])} - aa, ${f(K.lit[0])} + aa, rel);
  float b2 = smoothstep(${f(K.lit[1])} - aa, ${f(K.lit[1])} + aa, rel);
  float band = 1.0 + ${f(K.litGain[0])} * b1 + ${f(K.litGain[1] - K.litGain[0])} * b2;
  vec3 tint = mix(vec3(1.0), L / ll, b1 * ${f(K.tint)});
  float base = pow(uAmbient, 0.6) * 1.05;

  // Backdrop: smooth, dimmed, and only partly banded.
  float bgLit = min(1.0, ${f(K.bgBands)} * (1.0 - uAmbient));
  vec3 c = texture(uScene, T(uv)).rgb;
  c *= mix(base * ${f(K.bgExposure)}, 1.0, smoothstep(0.6, 0.95, luma(c)) * ${f(K.bgHigh)}) * mix(1.0, band, bgLit) * mix(vec3(1.0), tint, bgLit);
  c = sat(c, ${f(K.bgSat)});

  // Hard shadow from every foreground shape.
  c *= mix(1.0, ${f(K.shadow)}, smoothstep(0.45, 0.6, texture(uFg, T(fuv + uShadow)).a));

  // Foreground: premultiplied, so undo it to get the flat color back.
  vec4 fg = texture(uFg, T(fuv));
  float a = fg.a;
  if (a > 0.003) {
    vec3 alb = fg.rgb / a;
    float y = max(luma(alb), 0.02);
    alb *= pow(${f(K.tone)}, hard(log(y) / ${f(Math.log(K.tone))}, 1.0)) / y;
    // Calm loud color: chroma past the knee is compressed, so nothing reads neon and runners still lead.
    float ch = max(alb.r, max(alb.g, alb.b)) - min(alb.r, min(alb.g, alb.b));
    float keep = ch > ${f(K.chromaKnee)} ? (${f(K.chromaKnee)} + (ch - ${f(K.chromaKnee)}) * ${f(K.chromaSlope)}) / ch : 1.0;
    alb = mix(vec3(luma(alb)), alb, keep);
    // A figure keeps its own flat colours: no light band or light tint across it, and evenly lit.
    float lit = mix(base * band, pow(uAmbient, ${f(K.figAmbient)}) * 1.05, fig);
    c = mix(c, clamp(alb, 0.0, 1.0) * mix(tint, vec3(1.0), fig) * lit * ${f(K.fgExposure)}, a);
  }

  // Emissives: a soft halo, then hot shapes as opaque color, white only at the very core.
  vec3 raw = texture(uGlow, T(uv)).rgb;
  vec4 bloom = texture(uBloomA, uv);
  vec3 G = raw + bloom.rgb * ${f(K.bloom[0])} + texture(uBloomB, uv).rgb * ${f(K.bloom[1])};
  float gm = max(G.r, max(G.g, G.b));
  vec3 hue = pow(G / max(gm, 1e-3), vec3(1.5));
  c += hue * gm * ${f(K.halo)};
  float rawL = luma(raw);
  c = mix(c, mix(hue, vec3(1.0), smoothstep(0.72, 0.98, rawL)), smoothstep(${f(K.solid)}, ${f(K.solid + 0.16)}, rawL));

  c = sat(clamp(c * ${f(K.gain)}, 0.0, 1.0), ${f(K.sat)}) * mix(vec3(1.0), uTint, 0.6) + uLift * 0.5;
  c *= 1.0 - smoothstep(0.16, 0.75, dot(d, d)) * ${f(K.vignette)};

  // Ink. Silhouette: alpha dilated over a ring. Interior: a tight cross, so lines stay thin inside small sprites.
  // Pressure wanders along the line, and the pen leans on the side away from the light.
  float press = 1.0 + (hand.b - 0.5) * 2.0 * ${f(K.press)};
  vec2 px = ${f(K.ink)} * press * k / uRes;
  float ring = 0.0;
  vec3 near = vec3(0.0);
  float nearA = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 dir = RING[i];
    float lean = 1.0 + ${f(K.lean)} * dot(normalize(dir), vec2(-0.55, 0.83)) * 1.4;
    vec4 t = texture(uFg, T(fuv + px * dir * lean));
    ring = max(ring, t.a);
    near += t.rgb;
    nearA += t.a;
  }
  float line = smoothstep(0.4, 0.62, ring) * (1.0 - smoothstep(0.25, 0.7, a));
  vec2 fp = ${f(K.fine)} * k / uRes;
  vec3 ga = sqrt(texture(uFg, T(fuv + fp)).rgb) - sqrt(texture(uFg, T(fuv - fp)).rgb);
  vec3 gb = sqrt(texture(uFg, T(fuv + vec2(fp.x, -fp.y))).rgb) - sqrt(texture(uFg, T(fuv + vec2(-fp.x, fp.y))).rgb);
  float e = sqrt(dot(ga * ga + gb * gb, vec3(0.3, 0.5, 0.2)));
  line = max(line, smoothstep(${f(K.edge[0])}, ${f(K.edge[1])}, e) * smoothstep(0.6, 0.95, a) * ${f(K.fineInk)} * (0.45 + 0.55 * press));
  // Tinted line: a dark version of what it outlines, not one black.
  vec3 tinted = min(mix(sat(near / max(nearA, 0.01), 0.8), INK, ${f(K.lineDark)}), vec3(0.36));
  vec3 lineCol = mix(INK, tinted, ${f(K.lineTint)});

  // Hot glow casing: ink around the whole shape of a beam or flame.
  float hot = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, rawL);
  vec2 gp = px * 1.15;
  float nearGlow = max(max(luma(texture(uGlow, T(uv + gp)).rgb), luma(texture(uGlow, T(uv - gp)).rgb)),
                   max(luma(texture(uGlow, T(uv + vec2(gp.x, -gp.y))).rgb), luma(texture(uGlow, T(uv + vec2(-gp.x, gp.y))).rgb)));
  float big = smoothstep(${f(K.hotSize)}, ${f(K.hotSize + 0.12)}, bloom.a);
  float casing = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, nearGlow) * big;
  c = mix(c, lineCol, line * (1.0 - hot) * ${f(K.lineAlpha)});
  c = mix(c, INK, casing * (1.0 - hot));

  // Mist: the small canvas's alpha, cut into flat bands.
  vec4 mist = texture(uMist, T(uv));
  if (mist.a > 0.003) c = mix(c, mist.rgb / mist.a, hard(mist.a, 3.0) * ${f(MIST_MAX)});

  o = vec4(mix(clamp(c, 0.0, 1.0), BONE, uFlash), 1.0);
}`;
