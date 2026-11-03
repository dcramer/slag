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
  /** The proportions, when not a figure's (`CHUNKY`): a limbless kind has no head, hands or feet to push. */
  build?: string;
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
  elf: {
    // The nod, each part of the read at race size: the long green cap flopping back behind the head like a
    // tail (the silhouette people draw), the long pointed ear sticking out sideways (an elf, not a gnome),
    // the green tunic flared at the hem with a brown belt (the colour and the hero's cut), a blond fringe,
    // and something to fight with on his back (a hero, not a shepherd).
    // Ours, and the joke: a hero kitted out from the bins. The cap is a long green woolly sock with a darned
    // toe, the round shield a dented dustbin lid with its handle, the sword a sooty fireplace poker.
    // The twist and the nod lead: the image generator drops what comes late in a long prompt (the lid and
    // the poker vanished when they came last).
    character:
      'Character: a slim young elf hero, never stout. A blond fringe (#e6c25a), long pointed ears, blue eyes. ' +
      'His cap: a very long floppy green woolly sock (#3f7a34), its long foot flopping straight back behind his head and drooping to his shoulders, a light green darn (#5a9a4a) on its toe. ' +
      'A green tunic (#3f7a34) flared at the hem, a wide brown belt, cream sleeves and leggings, brown gloves and boots (#6b4a35). ' +
      'On his back as a shield, a dented round steel dustbin lid (#a8adb4) with its handle; a black iron fireplace poker (#4a4a52) with a hooked tip in place of a sword, its loop handle over his shoulder. No sword, no bow.',
    views: 'a front view, a side profile facing right, a back view showing the dustbin lid and poker on his back, and a three-quarter view facing right',
    pose: 'The sock cap flops straight back and down behind his head to the nape, clear of the arms. The dustbin lid sits flat on his back and the poker lies behind it, both clear of the arms and head.',
    poses:
      'standing idle, alert, one hand on his belt; mid-run striding out long with arms swinging and the sock cap streaming behind; crouched low before a jump, knees bent, arms swung back; a forward somersault in mid-air, tucked into a ball, the sock cap trailing; falling with arms up and legs reaching down; sliding down a wall on his right with one glove flat against it and both boots braced; cheering with the poker raised high overhead; knocked flat on his back with stars circling',
  },
  zapmouse: {
    // The nod, each part of the read at race size: two long pointed ears tipped black (the outline, at any
    // size), the zigzag bolt of a tail breaking the outline behind (the one shape no other mouse has), round
    // red cheeks (the face at 20 px), and the yellow (what everyone remembers first); chubby and round,
    // standing on two legs at rest and scampering on all fours.
    // Ours, and the joke: a scrapyard knock-off wired up by hand. The bolt is cut from sheet tin and riveted
    // on at the root, a frayed power cord is knotted round its middle like a belt with the plug dangling,
    // and the tip of one ear is kinked and taped.
    // The image models draw the nod or the twist, rarely both: the concept was the nod drawn first, then
    // edited to add the tin tail and the cord (art/sprites/zapmouse/concept.prompt.txt). The model leaves
    // the tail and the plug off; sprite.json builds them as props, so their size is a setting.
    character:
      'Character: a hand-made scrapyard toy mouse, wired together from junk. ' +
      'Behind it, a big flat zigzag tail like a jagged bolt, as tall as its whole body, cut from dull grey sheet tin (#c4c8ce) with sharp corners, bolted to its rump with three dark rivets and sticking up and back: the biggest shape in its outline. ' +
      'Round its middle, a frayed black electrical power cord (#2a2a30) knotted like a belt, a cream two-pin plug (#d9d4c8) dangling from the knot at its hip. ' +
      'The mouse itself is small, chubby and round, soft yellow fur (#f2c62a) all over, an animal and not a costume: a pear-shaped body, a big round head almost as wide as the body, short stubby arms with little round paws, short legs with big oval furry feet. ' +
      'Two very long pointed ears standing straight up from the top of the head, each as tall as the head, their top third black (#2a1f1a); the tip of one ear is kinked a little and wrapped in a strip of grey tape. ' +
      'Big round bright-red cheek circles (#e0473b), small round black eyes with a white glint, a tiny dark nose, a small open smile. Two thick brown stripes (#6b4a35) across the upper back only. Cheeky, quick and crackling with mischief.',
    views: 'a front view, a side profile facing right, a back view showing the brown stripes and the riveted tin tail, and a three-quarter view facing right',
    pose: 'The ears stand straight up, clear of the arms. Leave the tin tail and the plug off this figure: no tail at all, a smooth round rump. The cord belt sits snug round the waist, nowhere near the hands.',
    poses:
      'standing idle upright on its hind legs, paws tucked in front of its chest; scampering at full speed on all fours, body low and stretched long, ears streaming straight back, tail out behind; crouched low on all fours before a jump; leaping up with its body stretched long, forepaws reaching high, ears up; falling with all four paws splayed out and ears flung up; clinging to a wall on its right with all four paws, sliding down, ears back; cheering upright on its hind legs with both paws thrown up; knocked flat on its back with its paws in the air and stars circling',
  },
  puffball: {
    // The nod, each part of the read at race size: the ball (the whole body: no head, neck or legs apart
    // from it), the big red oval feet (they make it a creature and part it from the dot-eater's wedge),
    // the tall oval eyes with a shine at the top (the face), the blush (the sweetness).
    // Ours, and the joke: a cheap vinyl squeeze toy off a bargain shelf. A moulding seam runs right round
    // its middle, a white squeaker valve pokes out of its back (the one bump on the ball's outline that
    // the original hasn't got), and a mould number is stamped under one foot.
    build:
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
  chomper: {
    // The nod, each part of the read at race size: the circle with a wedge cut out of its front (the most
    // recognised shape in games, and it needs nothing else); pure yellow (half the read); the chomp (a mouth,
    // not a pie chart, only when it moves). One small eye above the mouth makes it a creature.
    // Ours, and the joke: the eater got eaten. A neat round bite, scalloped by teeth, is missing from the
    // back of the circle; a red-and-white checked napkin is tucked under the mouth like a bib.
    character:
      'Character: a perfect round ball creature, pure warm yellow (#f6d02a) with a darker yellow cel shadow (#cba214); no arms, no legs, no feet, no hands, no nose, no ears. ' +
      'A big wedge-shaped mouth cut into the front of the ball like a slice taken out of a pie, its point at the centre of the ball, wide open, dark brown inside (#2a1f1a). ' +
      'One small round black eye (#14121a) with a white glint, above the mouth toward the front. ' +
      'The joke: someone got to him first. A neat round bite is missing from the top of the back of the ball, its edge scalloped by three tooth marks, the bitten edge a deeper yellow (#e8b81c). ' +
      'A small red-and-white checked napkin (#fbf6ee with #c9473f checks) is tucked into his lower lip and hangs down over the front of the ball like a bib. Greedy, cheerful and always hungry.',
    views:
      'a side profile facing right with the mouth wide open, the same profile with the mouth snapped shut, a back view showing the round bite, and a three-quarter view facing right',
    pose: 'No limbs to keep clear: one round ball.',
    poses:
      'sitting still at rest with the mouth half open; bouncing along mid-hop with the mouth wide open; squashed flat on landing with the mouth snapped shut; spinning in mid-air rotated halfway round, motion lines round it; at the top of a jump stretched a little tall with the mouth gaping; pressed against a wall on its right, biting into it as it slides down, crumbs falling; cheering, hopping high with the mouth wide open laughing; dying, the mouth opening wider and wider until the ball folds away to nothing, only the napkin left fluttering',
    build:
      'Proportions for a tiny game sprite: one bold simple round shape that still reads at 20 pixels tall, no limbs at all. A chunky toy, never realistic.',
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
  return [STYLE, b.build ?? CHUNKY, b.character, `Layout: one row of full-body views of the same character side by side: ${b.views}.`].join(' ');
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
    b.build ?? CHUNKY,
    b.character,
  ].join(' ');
}

/** The model sheet's prompt: the approved concept (given as the reference) as one T-posed figure to model. */
export function modelPrompt(kind: string): string {
  const b = brief(kind);
  return [
    SCULPT,
    b.build ?? CHUNKY,
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
