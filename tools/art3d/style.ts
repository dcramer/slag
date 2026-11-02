/**
 * The prompts a kind's 3D model is made from (tools/art3d/README.md, step 1). Two stages, as a studio
 * would run them:
 *
 * - **Concept**: a model sheet in the game's own style, to judge the design. `STYLE` is the traced
 *   spike's paragraph (docs/ART.md's "World art: ink" and docs/CHARACTERS.md's "clean, light,
 *   hand-drawn" in a generator's words), kept word for word so the two pipelines draw the same cast.
 * - **Model sheet**: the same design as a figure for image-to-3D: one figure, front on, in a T-pose,
 *   flat matte colour with no ink and no painted shading, on plain grey. Ink and shading are the
 *   renderer's job; a line or a shadow painted into the texture would bake into the model as a smudge.
 *
 * A brief describes traits only. It never names the character or the game it pays homage to: each kind
 * is our own design (docs/DESIGN.md → Parody, docs/CHARACTERS.md → Roster).
 */

export const STYLE =
  'Character model sheet for a 2D platformer video game, an original cartoon character design. ' +
  'Style: clean, light, hand-drawn line art with a thin hand-inked pen line that swells and tapers a little, in a dark warm brown rather than pure black. ' +
  'Flat cel colour: every area is one flat calm colour with one hard-edged darker cel shadow shape on the side away from the light, light from the upper left. ' +
  'No gradients, no texture, no soft shading, no glow, no rim light, no painterly rendering. ' +
  'Simple chunky readable shapes that still read when tiny. ' +
  'Plain flat white background, even light, no ground shadows, no text, no labels, no frames.';

/** The model sheet's treatment: a sculpt to model from, not a drawing. */
export const SCULPT =
  'A clean full-body 3D character model of an original cartoon character for a stylised platformer game, like a smooth painted vinyl toy figure. ' +
  'Chunky simple sculpted forms with clear separations between parts, every part one flat matte colour, no outlines, no painted shadows, no texture, no gloss. ' +
  'Lit flat and even from the front. One figure only, the whole body in frame from cap to shoes, centred. Plain light grey background, no ground shadow, no text.';

export interface Brief {
  /** Who it is: shape, face, colours, clothes, the signature part. Traits only. */
  character: string;
  /** The views across the concept sheet. */
  views: string;
  /** What the T-pose sheet must keep clear for rigging, beyond the shared pose words. */
  pose: string;
}

export const BRIEFS: Record<string, Brief> = {
  plumber: {
    // The nod: the red cap with a bill, the big round nose, the thick mustache, blue bib overalls, a stout
    // big-headed build. Ours: a foundry hand, not a plumber from a castle. Welding goggles round the cap,
    // a riveted brass badge with a wrench, steel hex bolts for buttons, leather gauntlets for the white
    // gloves, soot-capped steel-toe boots, and the plunger strapped on his back like a sword.
    character:
      'Character: a short, stout foundry plumber with a big head (almost half his height), an egg-shaped round belly and short legs. ' +
      'A big round nose that breaks his profile, a thick bushy dark-brown mustache under it, small black oval eyes, bushy brows, dark-brown hair at the sides. ' +
      'A soft red cap (#c9473f) with its bill sticking out front, a round riveted brass badge on the front stamped with a tiny wrench (no letter), and a pair of round dark welding goggles strapped around the crown of the cap, pushed up. ' +
      'Blue bib overalls (#3f62b4) fastened with two big steel hex bolts instead of buttons, a square patch on one knee, over a red shirt (#c9473f) with the sleeves rolled up. ' +
      'Big tan leather work gauntlets with wide cuffs instead of gloves, chunky brown steel-toe work boots with dark grey steel toecaps. ' +
      'A rubber sink plunger with a copper-pipe handle is strapped diagonally across his back with a leather strap, its dark red rubber cup sticking up behind one shoulder. Cheerful and jaunty.',
    views: 'a front view, a side profile facing right, a back view showing the plunger strapped on, and a running pose facing right with arms pumping',
    pose: 'The plunger stays strapped on his back, its cup above his right shoulder, clear of the arms and head.',
  },
  hedgehog: {
    // The nod: a cobalt hedgehog with long quills swept straight back, a peach muzzle and belly, green eyes,
    // a cocky grin, big red sneakers. Ours: a stubby scrapyard speedster. Chunky round proportions, two
    // separate eyes under heavy brows, soot-black scorched quill tips, a frayed hazard-striped scarf
    // streaming behind, fingerless leather gloves for the white ones, and red work high-tops with steel
    // toecaps and a hazard-yellow strap.
    character:
      'Character: a small, stubby, round blue hedgehog with a very big round head (half his height), a small round body and short stubby legs, like a chunky toy. ' +
      'Cobalt-blue quills (#2f5bd0) in four thick spikes swept straight back from the head, their tips scorched soot-black, and two short spikes on the back. ' +
      'A peach muzzle and belly (#f0c99c), two separate round eyes with green irises under heavy dark-blue brows, a small black nose, a cocky one-sided grin with one chipped tooth. ' +
      'A short frayed scarf of yellow-and-black hazard-striped cloth knotted at his neck, its two ends streaming straight back. ' +
      'Brown fingerless leather gloves. Big red high-top work sneakers (#d8382f) with grey steel toecaps and a hazard-yellow strap across each. Confident and fast.',
    views: 'a front view, a side profile facing right, a back view showing the swept quills, and a running pose facing right leaning hard forward',
    pose: 'The quills sweep straight back from the head, clear of the shoulders and arms.',
  },
};

function brief(kind: string): Brief {
  const b = BRIEFS[kind];
  if (!b) throw new Error(`no brief for ${kind}: add one to BRIEFS in tools/art3d/style.ts (traits only, never the original's name)`);
  return b;
}

/** The concept sheet's prompt: the design in the game's own ink style. */
export function conceptPrompt(kind: string): string {
  const b = brief(kind);
  return [STYLE, b.character, `Layout: one row of full-body views of the same character side by side: ${b.views}.`].join(' ');
}

/** The model sheet's prompt: the approved concept (given as the reference) as one T-posed figure to model. */
export function modelPrompt(kind: string): string {
  const b = brief(kind);
  return [
    SCULPT,
    'The same character as the reference sheet, with exactly its design, proportions and colours.',
    b.character,
    'Front view, standing in a T-pose: both arms straight out to the sides at shoulder height, hands open, fingers together, legs straight and a little apart, feet flat.',
    b.pose,
  ].join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [stage, kind] = process.argv.slice(2);
  console.log(stage === 'model' ? modelPrompt(kind) : conceptPrompt(kind));
}
