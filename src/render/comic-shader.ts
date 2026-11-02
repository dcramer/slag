/**
 * Final pass for the comic style. A screen filter alone can't do this: Sobel over the whole image
 * inks background clouds as hard as hazards, and black ink vanishes on night themes. So the renderer
 * hands this pass two albedo layers (see `ComicLayer`), and it treats them differently:
 *
 *   background  flat tones + dot screen, no ink, lifted out of black: it recedes, and ink always reads on it
 *   foreground  outline from real alpha (clean, whatever the colors), thin interior lines, cel light
 *   shadow      every foreground shape prints a hard offset dot shadow, the UI's "hard drop shadow" in print
 *   glow        flat hue steps and dot halos; hot shapes get an ink casing so a beam reads on a pale sky
 *
 * Dots on lit surfaces are locked to the world (`uCam`), so they ride with the terrain instead of
 * swimming as the camera moves. No ACES, aberration or animated grain: print colors are flat.
 */

/** Look knobs, baked into the shader source. Sizes are in 720p pixels unless noted. */
const K = {
  /** Silhouette ink: ring radius around foreground shapes. */
  ink: 2.1,
  /** Interior ink: radius of a tighter cross, and its edge ramp. Higher = fewer lines. */
  fine: 0.9,
  edge: [0.34, 0.62],
  /** Background flat tones, and the dot cell between them. */
  bgSteps: 6,
  bgCell: 6,
  /** How much of the light map falls on the background: it's what keeps a cave black behind lit rock. */
  bgLit: 0.9,
  /** How far background darks lift toward their own hue (0..1). */
  bgLift: 0.07,
  /** Background contrast kept (below 1 pulls it toward a mid tone). */
  bgContrast: 0.92,
  /** Foreground albedo tones. */
  fgSteps: 7,
  /** Cel light bands, the dot cell in world px, and the darkest a lit surface may print. */
  bands: 3,
  cell: 3.6,
  shade: 0.5,
  /** Halo dot cell, and how much bloom feeds it. */
  haloCell: 7,
  halo: 1.25,
  glowSteps: 4,
  /** Above this brightness an emissive prints as opaque flat color. */
  solid: 0.26,
  /** A glow pixel this bright, inside a large enough glow, gets an ink casing. */
  hot: 0.4,
  /** Bloom needed for that casing: bloom is blind to small things, so sparks and motes never get ink specks. */
  hotSize: 0.2,
  /** Dot density of the offset shadow, and how dark it prints. */
  shadow: 0.62,
  /** Exposure, dark lift (below 1 brightens mids) and saturation of the final image. */
  gain: 1.12,
  gamma: 0.86,
  sat: 1.18,
};

/** Offset of the printed shadow, in world px (same direction as the default terrain shadow). */
export const COMIC_SHADOW: [number, number] = [3.5, 5];

const f = (n: number) => n.toFixed(4);

export const COMIC_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uFg; uniform sampler2D uLight; uniform sampler2D uGlow;
uniform sampler2D uBloomA; uniform sampler2D uBloomB;
uniform float uExposure; uniform float uFlash;
uniform vec3 uTint; uniform vec3 uLift; uniform vec2 uRes;
uniform vec3 uCam; uniform vec2 uShadow;
// PAL.ink and PAL.bone (src/ui/style.ts): the game prints with the UI's own inks.
const vec3 INK = vec3(0.0706, 0.0431, 0.0314);
const vec3 PAPER = vec3(0.9647, 0.9176, 0.8471);
const vec2 RING[8] = vec2[8](vec2(-1, 1), vec2(0, 1.41), vec2(1, 1), vec2(-1.41, 0), vec2(1.41, 0), vec2(-1, -1), vec2(0, -1.41), vec2(1, -1));
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
// Round dots on a 45-degree screen; 'cover' = inked fraction of the cell (0..1).
float dots(vec2 p, float cell, float cover){
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p / cell;
  float d = length(fract(q) - 0.5);
  float r = sqrt(clamp(cover, 0.0, 1.0) / 3.14159) * 1.05;
  return 1.0 - smoothstep(r - 0.09, r + 0.09, d);
}
// Tone quantized into 'n' flat steps, with a dot screen carrying each step down into the next.
// Most of each step stays flat: dots only in its lower part, so the frame isn't dots everywhere.
float screen(float v, float n, vec2 p, float cell){
  float q = v * n;
  float lo = floor(q);
  return (lo + 1.0 - dots(p, cell, 1.0 - smoothstep(0.0, 0.42, q - lo))) / n;
}
void main(){
  vec2 frag = uv * uRes;
  float k = uRes.y / 720.0;
  // World position of this pixel: the camera's own transform, read off the canvas.
  vec2 world = (vec2(frag.x, uRes.y - frag.y) - uCam.xy) / uCam.z;
  vec3 L = texture(uLight, uv).rgb * 2.0 * uExposure;
  float ll = max(luma(L), 1e-3);
  vec3 tint = mix(vec3(1.0), L / ll, 0.6);

  // Background: its hue, printed in flat tones.
  vec3 b = texture(uScene, uv).rgb * mix(vec3(1.0), L, ${f(K.bgLit)});
  float by = max(luma(b), 1e-3);
  vec3 bh = b / by;
  bh /= max(1.0, max(bh.r, max(bh.g, bh.b)));
  float bt = screen(mix(0.5, by, ${f(K.bgContrast)}), ${f(K.bgSteps)}, frag, ${f(K.bgCell)} * k);
  bt = min(bt, by * 1.7 + 0.02); // Steps round up, so without this a black cave prints as a flat grey.
  vec3 c = clamp(bh * bt, 0.0, 1.0);
  c += sat(bh, 1.5) * ${f(K.bgLift)} * (1.0 - bt) * (1.0 - bt);

  // Hard printed shadow from every foreground shape.
  float shade = smoothstep(0.45, 0.6, texture(uFg, uv + uShadow).a);
  c = mix(c, c * 0.5, shade * dots(frag, 3.0 * k, ${f(K.shadow)}));

  // Foreground: premultiplied, so undo it to get flat color back.
  vec4 fg = texture(uFg, uv);
  float a = fg.a;
  if (a > 0.003) {
    vec3 alb = fg.rgb / a;
    float y = luma(alb);
    float yq = mix((floor(y * ${f(K.fgSteps)}) + 0.5) / ${f(K.fgSteps)}, y, 0.2);
    alb = clamp(yq + (alb - y) * 1.2, 0.0, 1.0);
    float band = screen(ll + 0.16, ${f(K.bands)}, world, ${f(K.cell)});
    c = mix(c, alb * tint * max(band, ${f(K.shade)}), a);
  }

  // Emissives and bloom: flat hue steps, dots between them, a white core when very hot.
  vec3 raw = texture(uGlow, uv).rgb;
  vec3 G = raw + (texture(uBloomA, uv).rgb * 0.4 + texture(uBloomB, uv).rgb * 0.5) * ${f(K.halo)};
  float gm = max(G.r, max(G.g, G.b));
  vec3 gh = G / max(gm, 1e-3);
  // Dots rise to the next step here (the opposite of screen()), so a halo fades out instead of ending in a hard disc.
  float gq = gm * ${f(K.glowSteps)};
  float glo = floor(gq);
  float gv = (glo + dots(frag + vec2(1.7), ${f(K.haloCell)} * k, smoothstep(0.1, 0.8, gq - glo))) / ${f(K.glowSteps)};
  vec3 hue = pow(gh, vec3(1.5));
  c += mix(hue, vec3(1.0), smoothstep(1.0, 1.6, gm) * 0.7) * gv;
  // Hot shapes print as opaque ink, not added light: added light goes white on a pale sky, and a white flame there is invisible.
  float rawL = luma(raw);
  c = mix(c, mix(hue, vec3(1.0), smoothstep(0.72, 0.98, rawL)), smoothstep(${f(K.solid)}, ${f(K.solid + 0.16)}, rawL));

  c = pow(clamp(c * ${f(K.gain)}, 0.0, 1.0), vec3(${f(K.gamma)}));
  c = sat(c, ${f(K.sat)}) * mix(vec3(1.0), uTint, 0.6) + uLift * 0.5;

  // Ink. Silhouette: alpha dilated over a ring. Interior: a tight cross, so lines stay thin inside small sprites.
  vec2 px = ${f(K.ink)} * k / uRes;
  float ring = 0.0;
  for (int i = 0; i < 8; i++) ring = max(ring, texture(uFg, uv + px * RING[i]).a);
  float line = smoothstep(0.4, 0.62, ring) * (1.0 - smoothstep(0.25, 0.7, a));
  vec2 fp = ${f(K.fine)} * k / uRes;
  vec3 ga = sqrt(texture(uFg, uv + fp).rgb) - sqrt(texture(uFg, uv - fp).rgb);
  vec3 gb = sqrt(texture(uFg, uv + vec2(fp.x, -fp.y)).rgb) - sqrt(texture(uFg, uv + vec2(-fp.x, fp.y)).rgb);
  float e = sqrt(dot(ga * ga + gb * gb, vec3(0.3, 0.5, 0.2)));
  line = max(line, smoothstep(${f(K.edge[0])}, ${f(K.edge[1])}, e) * smoothstep(0.6, 0.95, a));

  // Hot glow casing: ink around the whole shape of a beam or flame, so it still reads on a pale sky.
  float hot = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, luma(raw));
  vec2 gp = px * 1.15;
  float near = max(max(luma(texture(uGlow, uv + gp).rgb), luma(texture(uGlow, uv - gp).rgb)),
                   max(luma(texture(uGlow, uv + vec2(gp.x, -gp.y)).rgb), luma(texture(uGlow, uv + vec2(-gp.x, gp.y)).rgb)));
  float big = smoothstep(${f(K.hotSize)}, ${f(K.hotSize + 0.12)}, luma(texture(uBloomA, uv).rgb));
  float casing = smoothstep(${f(K.hot)}, ${f(K.hot + 0.18)}, near) * big;
  line = max(line * (1.0 - hot), casing * (1.0 - hot));
  c = mix(c, INK, line);

  c = mix(clamp(c, 0.0, 1.0), PAPER, uFlash);
  // Static paper tooth: the same speckle the UI plates carry.
  c *= 0.975 + 0.035 * hash(floor(frag / (1.5 * k)));
  o = vec4(c, 1.0);
}`;
