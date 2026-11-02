/**
 * The prompts a kind's 3D model is made from (tools/art3d/README.md, step 1). Three stages, as a studio
 * would run them:
 *
 * - **Concept**: a model sheet in the game's own style, to judge the design. `STYLE` is the traced
 *   spike's paragraph (docs/ART.md's "World art: ink" and docs/CHARACTERS.md's "clean, light,
 *   hand-drawn" in a generator's words), kept word for word so the two pipelines draw the same cast.
 * - **Pose sheet**: the concept through every pose the game plays, the reference the renderer's keyed
 *   poses are set from where motion generation can't make them.
 * - **Model sheet**: the same design as a figure for image-to-3D: one figure, front on, in a T-pose,
 *   flat matte colour with no ink and no painted shading, on plain grey. Ink and shading are the
 *   renderer's job; a line or a shadow painted into the texture would bake into the model as a smudge.
 *
 * A brief describes traits only. It never names the character or the game it pays homage to: each kind
 * is our own design (docs/DESIGN.md → Parody, docs/CHARACTERS.md → Roster). Each brief's comment lists
 * the nod (what the read needs) and the twist (what's ours, and the joke).
 */

export const STYLE =
  'Character model sheet for a 2D platformer video game, an original cartoon character design. ' +
  'Style: clean, light, hand-drawn line art with a thin hand-inked pen line that swells and tapers a little, in a dark warm brown rather than pure black. ' +
  'Flat cel colour: every area is one flat calm colour with one hard-edged darker cel shadow shape on the side away from the light, light from the upper left. ' +
  'No gradients, no texture, no soft shading, no glow, no rim light, no painterly rendering. ' +
  'Simple chunky readable shapes that still read when tiny. ' +
  'Plain flat white background, even light, no ground shadows, no text, no labels, no frames.';

/**
 * Proportions for a figure that reads at about 20 world px (docs/CHARACTERS.md → Roster): pushed hard, the
 * way small-sprite characters are, so the head, hands and feet carry the read.
 */
export const CHUNKY =
  'Proportions pushed hard for a tiny game sprite: the head is half of the total height, the hands are big mitts and the feet big chunky boots, the arms and legs short and thick, the body a small round barrel. A chunky toy, never a realistic figure.';

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
  /** The poses across the pose sheet, in order. */
  poses: string;
  /** In place of `CHUNKY`, for a body that has no head, arms or legs to push (a ball, a dome). */
  proportions?: string;
}

export const BRIEFS: Record<string, Brief> = {
  plumber: {
    // The nod, each part of the read at race size: the red cap with its bill sticking out (the first thing
    // the silhouette shows), the big round nose breaking the profile, the thick dark mustache, blue bib
    // overalls over a red shirt (the colour block everyone knows), and a stout big-headed build.
    // Ours, and the joke: a foundry plumber whose plunger is absurdly big, strapped across his back like a
    // greatsword with its cup above his head; welding goggles on the cap, a riveted brass badge with a
    // wrench, steel hex bolts for buttons, big leather gauntlets and steel-toe boots.
    character:
      'Character: a short, stout foundry plumber with a huge round head, an egg-shaped round belly and short legs. ' +
      'A big round red nose that breaks his profile, a thick bushy dark-brown mustache under it, two big black oval eyes with a white glint, bushy brows, dark-brown hair at the sides. ' +
      'A soft red cap (#c9473f) with its bill sticking out front, a round riveted brass badge on the front stamped with a tiny wrench (no letter), and a pair of round dark welding goggles strapped around the crown of the cap, pushed up. ' +
      'Blue bib overalls (#3f62b4) fastened with two big steel hex bolts instead of buttons, a square patch on one knee, over a red shirt (#c9473f) with the sleeves rolled up. ' +
      'Huge tan leather work gauntlets with wide cuffs, huge brown steel-toe work boots with grey steel toecaps. ' +
      'The joke: an absurdly oversized rubber sink plunger, as long as he is tall, strapped diagonally across his back like a greatsword, its big dark rubber cup sticking up high above his head behind one shoulder and its copper-pipe handle poking out below the other hip. Cheerful, jaunty and proud of his plunger.',
    views: 'a front view, a side profile facing right, a back view showing the plunger strapped on, and a three-quarter view facing right',
    pose: 'The plunger stays strapped on his back, its cup high above his right shoulder, clear of the arms and head.',
    poses:
      'standing idle with his chest puffed out; mid-run stride leaning forward with arms pumping and one knee high; crouched low before a jump, knees bent, arms swung back; jumping up with one fist punched high overhead and the other arm down, legs tucked; falling with both arms flailing up and legs reaching down; sliding down a wall on his right with one gauntlet flat against it and both boots braced; cheering with both fists in the air; knocked flat on his back with stars circling',
  },
  hedgehog: {
    // The nod, each part of the read at race size: long cobalt quills swept straight back (the whole
    // silhouette), big red sneakers (the second thing anyone names), a peach muzzle and belly, green eyes
    // and a cocky grin; the run leaning hard forward and the jump curled into a spinning ball.
    // Ours, and the joke: a stubby scrapyard speedster who runs so fast his quill tips are scorched black;
    // two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth, a
    // hazard-striped neckerchief, leather fingerless gloves, and red work high-tops with steel toecaps.
    character:
      'Character: a small, stubby, round blue hedgehog with a very big round head, a small round body and short stubby legs, like a chunky toy. ' +
      'Cobalt-blue quills (#2f5bd0) in four thick spikes swept straight back from the head, their tips scorched soot-black, and two short spikes on the back. ' +
      'A peach muzzle and belly (#f0c99c), two separate big round eyes with green irises and a white glint under heavy dark-blue brows, a small black nose, a cocky one-sided grin with one chipped tooth. ' +
      'A snug neckerchief of yellow-and-black hazard-striped cloth knotted at his throat. ' +
      'Big brown fingerless leather gloves. Huge red high-top work sneakers (#d8382f) with grey steel toecaps and a hazard-yellow strap across each. Confident and fast.',
    views: 'a front view, a side profile facing right, a back view showing the swept quills, and a three-quarter view facing right',
    pose: 'The quills sweep straight back from the head, clear of the shoulders and arms. The neckerchief is snug at the throat, nowhere near the arms.',
    poses:
      'standing idle with one foot tapping; mid-run leaning hard forward with legs a blur; crouched low before a jump; curled into a tight spinning ball in mid-air, quills outward, no limbs showing; falling with arms out and legs reaching down; sliding down a wall on his right with one glove flat against it and both sneakers braced; cheering with one fist up; knocked flat on his back with stars circling',
  },
  puffball: {
    // The nod, each part of the read at race size: the ball (the whole body: no head, neck or legs apart
    // from it), the big red oval feet (they make it a creature and part it from the dot-eater's wedge),
    // the tall oval eyes with a shine at the top (the face), the blush (the sweetness).
    // Ours, and the joke: a cheap vinyl squeeze toy off a bargain shelf. A moulding seam runs right round
    // its middle, a white squeaker valve pokes out of its back (the one bump on the ball's outline that
    // the original hasn't got), and a mould number is stamped under one foot.
    proportions:
      'Proportions for a tiny game sprite: the whole character is one near-perfect ball, about as wide as it is tall, with no separate head, no neck and no legs. Its feet are big, about half as wide as the ball each; its arms are short stubby nubs. A chunky squeezable toy, never a realistic creature.',
    character:
      'Character: a small round puffball creature, a near-perfect soft pink ball (#f2a0b8). ' +
      'Two big oval red feet (#c9473f) under the ball like fat flattened jelly beans, wider than they are tall, the front one poking out ahead of the ball. ' +
      'Two short stubby round arms, little rounded nubs low on its sides. ' +
      'On the front of the ball: two tall narrow oval black eyes (#2a1f1a) side by side, each with a white oval shine at its top; two soft rosy blush ovals just under and outside the eyes; a tiny happy mouth between them. ' +
      'The joke: it is a cheap vinyl squeeze toy. A raised moulding seam ridge runs right round its middle like an equator, plainly visible across its front, sides and back, the two halves a hair out of line. ' +
      "A white plastic squeaker valve (#f4efe6), a short stubby nozzle with a round cap, sticks straight out of the middle of its back and breaks the ball's round outline in the side view. " +
      'A mould number is stamped on the sole of one foot. Soft matte vinyl, cheerful and squishy.',
    views: 'a front view, a side profile facing right, a back view showing the squeaker valve and the seam, and a three-quarter view facing right',
    pose: 'The arms are short nubs held straight out to the sides, clear of the ball. The squeaker valve sticks straight out of its back.',
    poses:
      'standing idle on both feet, arms down; mid-run toddling forward with one big foot stepping out ahead and the arms swinging; squashed low before a jump, the ball flattened over its feet; puffed up perfectly round in mid-air with cheeks full, arms flapping out and feet dangling; falling with arms up and feet reaching down; sliding down a wall on its right, pressed flat against it with one nub arm and both feet braced; cheering with both arms up and eyes squeezed shut in a happy grin; knocked flat on its back with stars circling',
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
  return [STYLE, b.proportions ?? CHUNKY, b.character, `Layout: one row of full-body views of the same character side by side: ${b.views}.`].join(' ');
}

/** The pose sheet's prompt: the approved concept (the reference) through every pose the game plays. */
export function posePrompt(kind: string): string {
  const b = brief(kind);
  // Led by the layout: with the concept as the reference, a prompt that opens on "model sheet" gets the
  // model sheet back.
  return [
    `An animation pose sheet for a 2D platformer video game: eight full-body action poses of one cartoon character, in two rows of four, every pose facing right, each with clear space around it: ${b.poses}.`,
    'The character is exactly the one in the reference image, same design, proportions and colours; no turnaround, no separate parts.',
    STYLE.replace('Character model sheet for a 2D platformer video game, an original cartoon character design. ', ''),
    b.proportions ?? CHUNKY,
    b.character,
  ].join(' ');
}

/** The model sheet's prompt: the approved concept (given as the reference) as one T-posed figure to model. */
export function modelPrompt(kind: string): string {
  const b = brief(kind);
  return [
    SCULPT,
    b.proportions ?? CHUNKY,
    'The same character as the reference sheet, with exactly its design, proportions and colours.',
    b.character,
    'Front view, standing in a T-pose: both arms straight out to the sides at shoulder height, hands open, fingers together, legs straight and a little apart, feet flat.',
    b.pose,
  ].join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [stage, kind] = process.argv.slice(2);
  console.log(stage === 'model' ? modelPrompt(kind) : stage === 'pose' ? posePrompt(kind) : conceptPrompt(kind));
}
