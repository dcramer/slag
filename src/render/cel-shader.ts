/**
 * Final pass for the cel style. Everything here is a hard decision, not a gradient: base colors
 * are flat, and the renderer's real light map is cut into a few bands, so a torch throws a clean
 * shape instead of a soft pool. It needs two albedo layers (see `CelLayer`), treated differently:
 *
 *   background  smooth and dimmed, like a painted backdrop: it stays quiet, and the world carries the light
 *   foreground  flat tones from albedo, light bands on top, thin ink from real alpha
 *   shadow      every foreground shape casts a hard offset shadow on the background
 *   glow        hot shapes print as opaque flat color with a thin ink casing, so a beam reads on any sky;
 *               faint glow stays soft, because a hard edge on it reads as a glass disc or a solid box
 *
 * Bands sit relative to the theme's ambient light (`uAmbient`): the light map only ever adds to
 * ambient, so fixed thresholds would leave a bright theme all one band and a dark one all shadow.
 */

/** Look knobs, baked into the shader source. Widths are in 720p pixels and scale with resolution. */
const K = {
  /** Silhouette ink width around foreground shapes. */
  ink: 1.15,
  /** Interior ink: radius of a tight cross, its edge ramp (higher = fewer lines), and its strength. */
  fine: 0.7,
  edge: [0.4, 0.72],
  fineInk: 0.8,
  /** Brightness ratio between neighboring flat tones. Relative, not absolute: a fixed step would be a huge jump on dark colors. */
  tone: 1.34,
  /** Light bands: where each starts (light relative to ambient), and how much brighter it prints. */
  lit: [1.28, 1.95],
  litGain: [0.3, 0.62],
  /** How strongly the light's own color shows on a lit band. */
  tint: 0.75,
  /** Backdrop brightness and saturation: the sky stays its hue, just below the playfield. */
  bgExposure: 0.72,
  bgSat: 1.08,
  /** How much a sun, moon or cloud top escapes that dimming (0..1). */
  bgHigh: 0.55,
  /** How much of the bands fall on the backdrop at zero ambient. They fade out as ambient rises: a prop's light on a day sky is just a stray disc. */
  bgBands: 1.1,
  /** Foreground brightness: the world carries the light. */
  fgExposure: 1.14,
  /** Darkness of the hard shadow on the backdrop (1 = none). */
  shadow: 0.62,
  /** Soft halo strength around emissives. */
  halo: 0.55,
  /** Above this brightness an emissive prints as opaque flat color. */
  solid: 0.17,
  /** A glow pixel this bright, inside a large enough glow, gets an ink casing. */
  hot: 0.4,
  /** Bloom needed for that casing: bloom is blind to small things, so sparks and motes never get ink specks. */
  hotSize: 0.2,
  /** Overall exposure, saturation and edge falloff of the final image. */
  gain: 1.0,
  sat: 1.08,
  vignette: 0.28,
};

/** Offset of the hard shadow, in world px (same direction as the classic terrain shadow). */
export const CEL_SHADOW: [number, number] = [2.5, 3.5];

const f = (n: number) => n.toFixed(4);

export const CEL_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uFg; uniform sampler2D uLight; uniform sampler2D uGlow;
uniform sampler2D uBloomA; uniform sampler2D uBloomB;
uniform float uExposure; uniform float uFlash; uniform float uAmbient;
uniform vec3 uTint; uniform vec3 uLift; uniform vec2 uRes; uniform vec2 uShadow;
// PAL.ink and PAL.bone (src/ui/style.ts): the game draws with the UI's own inks.
const vec3 INK = vec3(0.0706, 0.0431, 0.0314);
const vec3 BONE = vec3(0.9647, 0.9176, 0.8471);
const vec2 RING[8] = vec2[8](vec2(-1, 1), vec2(0, 1.41), vec2(1, 1), vec2(-1.41, 0), vec2(1.41, 0), vec2(-1, -1), vec2(0, -1.41), vec2(1, -1));
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

  // Light bands, from the real light map.
  vec3 L = texture(uLight, uv).rgb * 2.0 * uExposure;
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
  vec3 c = texture(uScene, uv).rgb;
  c *= mix(base * ${f(K.bgExposure)}, 1.0, smoothstep(0.6, 0.95, luma(c)) * ${f(K.bgHigh)}) * mix(1.0, band, bgLit) * mix(vec3(1.0), tint, bgLit);
  c = sat(c, ${f(K.bgSat)});

  // Hard shadow from every foreground shape.
  c *= mix(1.0, ${f(K.shadow)}, smoothstep(0.45, 0.6, texture(uFg, uv + uShadow).a));

  // Foreground: premultiplied, so undo it to get the flat color back.
  vec4 fg = texture(uFg, uv);
  float a = fg.a;
  if (a > 0.003) {
    vec3 alb = fg.rgb / a;
    float y = max(luma(alb), 0.02);
    alb *= pow(${f(K.tone)}, hard(log(y) / ${f(Math.log(K.tone))}, 1.0)) / y;
    c = mix(c, clamp(alb, 0.0, 1.0) * tint * base * band * ${f(K.fgExposure)}, a);
  }

  // Emissives: a soft halo, then hot shapes as opaque color, white only at the very core.
  vec3 raw = texture(uGlow, uv).rgb;
  vec3 bloom = texture(uBloomA, uv).rgb;
  vec3 G = raw + bloom * 0.4 + texture(uBloomB, uv).rgb * 0.5;
  float gm = max(G.r, max(G.g, G.b));
  vec3 hue = pow(G / max(gm, 1e-3), vec3(1.5));
  c += hue * gm * ${f(K.halo)};
  float rawL = luma(raw);
  c = mix(c, mix(hue, vec3(1.0), smoothstep(0.72, 0.98, rawL)), smoothstep(${f(K.solid)}, ${f(K.solid + 0.16)}, rawL));

  c = sat(clamp(c * ${f(K.gain)}, 0.0, 1.0), ${f(K.sat)}) * mix(vec3(1.0), uTint, 0.6) + uLift * 0.5;
  c *= 1.0 - smoothstep(0.16, 0.75, dot(d, d)) * ${f(K.vignette)};

  // Ink. Silhouette: alpha dilated over a ring. Interior: a tight cross, so lines stay thin inside small sprites.
  vec2 px = ${f(K.ink)} * k / uRes;
  float ring = 0.0;
  for (int i = 0; i < 8; i++) ring = max(ring, texture(uFg, uv + px * RING[i]).a);
  float line = smoothstep(0.4, 0.62, ring) * (1.0 - smoothstep(0.25, 0.7, a));
  vec2 fp = ${f(K.fine)} * k / uRes;
  vec3 ga = sqrt(texture(uFg, uv + fp).rgb) - sqrt(texture(uFg, uv - fp).rgb);
  vec3 gb = sqrt(texture(uFg, uv + vec2(fp.x, -fp.y)).rgb) - sqrt(texture(uFg, uv + vec2(-fp.x, fp.y)).rgb);
  float e = sqrt(dot(ga * ga + gb * gb, vec3(0.3, 0.5, 0.2)));
  line = max(line, smoothstep(${f(K.edge[0])}, ${f(K.edge[1])}, e) * smoothstep(0.6, 0.95, a) * ${f(K.fineInk)});

  // Hot glow casing: ink around the whole shape of a beam or flame.
  float hot = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, rawL);
  vec2 gp = px * 1.15;
  float near = max(max(luma(texture(uGlow, uv + gp).rgb), luma(texture(uGlow, uv - gp).rgb)),
                   max(luma(texture(uGlow, uv + vec2(gp.x, -gp.y)).rgb), luma(texture(uGlow, uv + vec2(-gp.x, gp.y)).rgb)));
  float big = smoothstep(${f(K.hotSize)}, ${f(K.hotSize + 0.12)}, luma(bloom));
  float casing = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, near) * big;
  c = mix(c, INK, max(line, casing) * (1.0 - hot));

  o = vec4(mix(clamp(c, 0.0, 1.0), BONE, uFlash), 1.0);
}`;
