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

/**
 * The design stage (docs/CHARACTERS.md → Decisions 9): the character drawn once, designed to read as a 24 px
 * sprite, before any sheet. Picked on the zapmouse style test (`shots/styletest/`), where a design at game
 * size read at play scale and every traced model sheet turned to noise.
 */
export const DESIGN =
  'A single original cartoon character for a tiny 2D platformer sprite, drawn once, large, full body, in a three-quarter view facing right, its arms and legs a little clear of its body, ' +
  'on a plain flat white background, no ground, no text, no labels, no frames, no other figures. ' +
  'Design it to read as a 24-pixel-tall game sprite: one silhouette idea, about three big shapes, the signature prop, the eyes, and almost nothing else. ' +
  'At most four flat colours plus the line colour; no shape smaller than a tenth of its height; no fingers, no small accessories, no fine detail, no texture. ' +
  'Style: a thin hand-inked line in a dark of each colour, flat bright colour with one hard-edged cel shadow shape on the side away from the light (light from the upper left), no gradients, no glow.';

/**
 * The lore's grunge (Decisions 9) as an edit of the finished design, given as the reference: worn shape,
 * never dirt, a rough line or dull colour. Asked for in the design prompt itself the damage is dropped
 * (the image model draws the character or the changes, rarely both); as an edit it lands and the design holds.
 */
export const WORN =
  'The same character exactly as in the reference image: the same pose, design, proportions, colours, line and flat white background. Change only this, and make each change big and obvious:';
const WORN_END = 'Nothing else changes, no dirt, no texture.';

/**
 * A kind's brief. The flat route reads only `design` and `worn`; `character`, `views`, `pose` and `poses`
 * are the retired 3D route's (concept, pose and model sheets: 3D.md), and a kind made flat needs none.
 */
export interface Brief {
  /** Who it is: shape, face, colours, clothes, the signature part. Traits only. */
  character?: string;
  /** The views across the concept sheet. */
  views?: string;
  /** What the T-pose sheet must keep clear for rigging, beyond the shared pose words. */
  pose?: string;
  /** The poses across the pose sheet, in order. */
  poses?: string;
  /** The proportions, when not a figure's (`CHUNKY`): a limbless kind has no head, hands or feet to push. */
  build?: string;
  /** The design stage's character: the nod and the twist as the few big shapes a 24 px sprite keeps. */
  design?: string;
  /** Its two or three worn tells, each a change to the outline or a big flat shape, for the wear edit. */
  worn?: string;
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
    // Designed at game size: the cap and bill, the nose, the mustache, red over blue, and the plunger slung
    // low (its cup behind the shoulder, under the cap: Decisions), as big shapes only.
    design:
      'The character: a short, stout plumber, about half of him a huge round head: a soft red cap (#c9473f) with a big bill sticking straight out front, a huge round nose, a thick dark-brown mustache (#4d3426) under it, two big black oval eyes. ' +
      'Blue bib overalls (#3f62b4) over a red shirt (#c9473f), big tan work gloves, big dark-brown boots (#4d3426). ' +
      'The joke: a huge rubber sink plunger slung low across his back like a greatsword, its big dark-red rubber cup (#8e2f2a) behind one shoulder, below the cap, and its copper handle (#c27a45) sticking out past the other hip.',
    worn: 'a pair of big round dark welding goggles is strapped round the cap, pushed up on its crown; the cap bill is cracked and bent down at one corner; one overall strap is broken and tied in a big knot; a big square patch is sewn on one knee; the plunger handle is bent in the middle and wrapped with grey tape.',
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
    // Designed at game size: the quills swept back, the big red shoes, the peach muzzle and belly, the eyes,
    // and the scrapyard twist as big shapes (soot-black quill tips, the hazard neckerchief, steel toecaps).
    design:
      'The character: a small, stubby blue hedgehog (#2f5bd0) built like a chunky wind-up toy: a big round head on a round barrel body as wide as the head, short thick legs. ' +
      'Four thick quills swept straight back from the head, their tips soot-black. A peach muzzle and belly (#f0c99c). His two eyes are apart, each its own round white with a green iris, with blue fur between them and heavy blue brows over them; a cocky grin. ' +
      'Huge red high-top sneakers (#d8382f) with grey steel toecaps, a yellow-and-black hazard-striped neckerchief (#e8c24a) knotted at the throat, brown fingerless gloves.',
    worn: 'one quill is snapped off short and its stump wrapped in grey tape; the sole of the front sneaker is coming loose and flaps open at the toe; the neckerchief is torn ragged at one end; one tooth is chipped.',
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
    // Designed at game size: the long cap flopping back, the pointed ear, the flared tunic, the round shield on
    // the back, and the twist as big shapes (a woolly sock for the cap, a dustbin lid, a fireplace poker).
    design:
      'The character: a slim young elf hero in a green tunic (#3f7a34) flared at the hem over a brown belt, brown boots and gloves (#6b4a35), blond hair (#e6c25a), one long pointed ear sticking out, big eyes. ' +
      'His cap is a long green woolly sock flopping back from his head like a tail. ' +
      'On his back, a round dented grey dustbin lid (#a8adb4) as his shield, its handle showing; in one hand, a dark iron fireplace poker (#4a4a52) as his sword.',
    worn: 'the toe of the sock cap is darned with a big lighter-green patch; the dustbin lid has a deep dent and a rusty hole; the poker is bent near the tip; the tunic hem is torn into two ragged points.',
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
    // Designed at game size: the nod (ears, bolt tail, cheeks, yellow) and the twist kept as big shapes only.
    design:
      'The character: a chubby yellow electric mouse (#f2c62a), a cheap bootleg toy: one big round head fused into a pear-shaped body, round red cheeks (#e0473b), two small black dot eyes and a tiny mouth, stubby arms, short legs with big round feet. ' +
      'Its two long pointed ears are black-tipped (#2a1f1a) and sewn on unevenly, one higher and longer than the other. ' +
      'Behind it, a big zigzag lightning-bolt tail cut from a sheet of dull grey tin (#c4c8ce), held on at the root by one big hex bolt. ' +
      'A black power cord (#2a2a30) is knotted round its middle as a belt, a big cream plug (#d9d4c8) dangling from the knot.',
    worn: 'the shorter ear is bent over halfway along and wrapped in a wide band of grey tape; the top of the head has a clear dent on one side; the tin tail is bent and dented.',
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
    // Designed at game size: the ball, the big oval feet, the stubby arms, the tall oval eyes and the blush,
    // and the twist as big shapes (the moulding seam round its middle, the squeaker valve on its back).
    design:
      'The character: a round pink puffball (#f2a0bc), a near-perfect ball for a body with no neck or legs, two stubby round arms, two big red oval feet (#c9473f), two tall black oval eyes with a white shine at the top, pink blush under them, a small smile. ' +
      'It is a cheap vinyl squeeze toy: a clear moulding seam runs right round its middle, and a white squeaker valve (#f4efe6) pokes out high on its back, the one bump on the ball.',
    worn: 'a big cross of grey tape patches a puncture on its side; the toe of the front foot is scuffed flat and pale; the squeaker valve is bent over to one side; one stubby arm has a bite mark nibbled out of it.',
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
    // Designed at game size: the circle and its wedge mouth, and the twist as big shapes (a bite out of the back
    // of the circle, the checked napkin tucked under the mouth). The smallest kind, the only one without limbs.
    design:
      'The character: a round yellow ball (#f6d02a) with no arms or legs, a big wedge-shaped mouth cut into its front, open, dark inside (#2a1f1a), one small black eye above the mouth. ' +
      'Someone got to him first: a neat round bite is missing from the back of his circle. A white napkin (#fbf6ee) with a bold red check (#c9473f) is tucked under the mouth like a bib.',
    worn: 'a long crack across the top of the ball is patched with a strip of grey tape; a chip is knocked out of the lip of the mouth; the napkin is stained and torn at one corner.',
    views:
      'a side profile facing right with the mouth wide open, the same profile with the mouth snapped shut, a back view showing the round bite, and a three-quarter view facing right',
    pose: 'No limbs to keep clear: one round ball.',
    poses:
      'sitting still at rest with the mouth half open; bouncing along mid-hop with the mouth wide open; squashed flat on landing with the mouth snapped shut; spinning in mid-air rotated halfway round, motion lines round it; at the top of a jump stretched a little tall with the mouth gaping; pressed against a wall on its right, biting into it as it slides down, crumbs falling; cheering, hopping high with the mouth wide open laughing; dying, the mouth opening wider and wider until the ball folds away to nothing, only the napkin left fluttering',
    build:
      'Proportions for a tiny game sprite: one bold simple round shape that still reads at 20 pixels tall, no limbs at all. A chunky toy, never realistic.',
  },
  impostor: {
    // The nod, each part of the read at race size: the bean on two stubby legs (the whole silhouette, and no
    // arms: arms make it a mascot), the wide pale visor standing proud of the front (the face; without it,
    // a jelly bean), and the pack on its back (it breaks the outline behind and is half the read in profile).
    // Ours, and the joke: a crew issued from the scrapyard. The pack is a red jerrycan with a yellow-capped
    // spout, strapped on; the visor's crack is taped over; a dent in its side was knocked out with a hammer.
    // The silhouette leads, because the first round failed the blind read as "a squarish blob": a can as tall
    // as the bean, with its top level with the crown, made one box of the two, and a visor drawn inside the
    // front outline left no bump. So: side on, the visor bulging out past the front, and the can a slim slab
    // hung low on the back with a notch of background between it and the bean, its top well under the crown.
    design:
      'The character, seen from the side in profile facing right: a little spacesuit crewmate, one tall smooth rounded bean (#5aa84a) with a high round dome on top, much taller than wide, standing on two short stubby legs with a clear gap between them; no head, neck or arms apart from the bean. ' +
      'On the front, a big pale-blue visor (#a9dbe8), a rounded capsule that bulges far out past the front of the bean like a snout, a third of the bean wide, with one white glint (#ffffff): the visor is its whole face, no eyes, no mouth. ' +
      'On its back, its backpack is a slim red jerrycan fuel can (#c9473f), a flat upright slab half as wide as the bean, hung low and held a hand width out from the bean on one thin tan strap (#d9c79a): its top is well below the top of the dome, and a wide gap of white background runs down between the can and the bean, above and below the strap. A short yellow spout (#e8c24a) points straight back from the top of the can.',
    worn: 'a crack across the visor is taped over with one strip of tan tape near its back end; a big round hammered dent is knocked into the side of the bean below the visor, a flat lighter patch; the jerrycan is dented in on its side and its spout bent down; one stubby leg is a little shorter than the other. The dome on top stays round.',
  },
  hunter: {
    // The nod, each part of the read at race size: the two huge round shoulder pads (the silhouette: nobody
    // else in the cast is wider at the top than anywhere else), the tall long-legged build, the helmet with
    // its visor band (the face: no face shows), and the arm cannon held out front (what the hunter does; the
    // ball tuck on a long fall says the rest). Tall, broad-shouldered and long-legged where the robot boy is
    // small, big-booted and has ear discs; no cap or nose to rhyme with the plumber.
    // Ours, and the joke: a power suit welded together in the scrapyard. The cannon is a length of
    // drainpipe, the shoulder pads are two banded fishing buoys, the torso a cut-down water heater tank.
    // The first design (2026-11-03) failed the blind read: the buoys sat level with the helmet and the dent
    // lobed its crown, so shoulders and head read as one lobed cap (a mushroom, an afro), and the cannon
    // across the chest was lost in the body. So the buoys hang low and wide at the ends of a shoulder plate,
    // the helmet rises clear above them (level with it they read as mouse ears), and the cannon is long,
    // straight and level, clear of the body. The pick came back in a grey suit and was recoloured orange in
    // an edit (art/sprites/hunter/recolour.prompt.txt) before the wear edit, and after it both boots were
    // made grey (boots.prompt.txt): the poses kept drawing two grey boots, and one orange one flickered.
    // The second design passed one blind reader and lost the other to the robot boy (2026-11-04): a round
    // helmet over a cannon on short legs and big boots is the robot boy's own silhouette. So the third is
    // tall and long-legged, the legs half its height and no big boots (those are the robot boy's), the buoys
    // bigger than the helmet, and the visor a wide band across the helmet's front. That one's cannon, carried
    // across the waist, barely left the outline and the buoys and helmet read as one lobed head ("Rayman-
    // like"), so the cannon is the forearm held straight out from the shoulder and the legs are thick. The
    // pick came back rusty and was recoloured (art/sprites/hunter/recolour.prompt.txt). Drawn colours only part
    // the roles: the suit, its buoys and its cannon all wear the player's colour in tones (Decisions 4), and
    // the visor is a dark glass.
    design:
      'The character: a tall, long-legged armored bounty hunter in a power suit welded together from scrapyard junk, no face showing, standing tall and upright, about five helmets tall. ' +
      'Its near arm is stretched straight out forward from the shoulder at chest height, and over its whole forearm, like a sleeve, is a long thick straight grey drainpipe (#8e9298) as an arm cannon, level, its open round end dark inside, reaching far out to the right of the body, as long as the body is wide, none of it across the chest, no hand holding it. ' +
      'Its shoulder pads are two huge round fishing buoys, red (#c9473f) with one white band (#f4efe6) each, each bigger than the helmet, the widest part of the figure by far, ' +
      'mounted far apart at the ends of a wide shoulder plate, their tops level with the helmet’s chin. ' +
      'Between them, high and clear above them, a small orange helmet (#d9661f), a little taller than wide, with a wide dark smoky-glass visor (#34404a) as a band right across its front. ' +
      'The torso is a cut-down orange water heater tank over a narrow dark-grey waist (#4a4a52). ' +
      'Long armoured orange legs, as long as the rest of the figure, broad in the thigh and the shin, with big round dark-grey knee pads, ending in small pointed orange feet: no big boots.',
    worn: 'a wide band of grey tape is wrapped round the drainpipe cannon near its root; the orange chest plate has a big dent in its side and a square riveted orange patch plate; the drainpipe’s open end is dented into a slight oval. The helmet and the buoys keep their smooth round outlines.',
  },
  robot: {
    // The nod, each part of the read at race size: the round helmet with its round ear discs (the head nobody
    // else in the cast has, and the face showing in its opening); the two blues, a dark helmet, gloves and
    // boots and a light suit (the robot from across a room: here the player's colour and a light tone of it);
    // the big boots on a small body (the proportions, a kid's); the arm cannon held out (what he does).
    // Small and round-headed where the hunter is big, wide at the shoulders and visored; a smooth round
    // helmet where the speedster's quills sweep back.
    // Ours, and the joke: a robot boy from the parts bin. The cannon is a ribbed tin can slid over his forearm
    // like a sleeve, and one boot was repainted a shade off.
    // Five rounds of blind reads (2026-11-04) named him at low or low-medium at best: a narrow rounded blob on
    // little legs, the can at the end of his arm "something blocky" held out, a battery filling the notch
    // behind. So the sixth round draws the outline the original is known by: a wide stance on huge flared
    // boots, a small body, a ridge down the helmet and both ear discs standing proud, and the forearm itself a
    // thick cylinder, no hand, held out level. The battery went: it filled his back. The face is pale and
    // ringed in a dark rim, so on an orange or a yellow helmet it stays a shape of its own.
    design:
      'The character: a small chunky robot boy in a wide action stance, his short legs planted far apart in an upside-down V with a big gap of white background between them, on huge flared blue boots (#2a5fc4), wide at the top like buckets, a third of his height. ' +
      'His front arm is held straight out level at shoulder height, and from the elbow on his forearm is the cannon: a thick smooth round cylinder twice as wide as his arm, no hand, an old dark-blue painted tin can (#1d4594) with ribbed rims slid over the forearm like a sleeve, its open end a dark round muzzle, reaching well out to the right past his helmet. ' +
      'On his head a big round blue helmet (#2a5fc4), much wider than his body, with a low raised ridge running down its middle from the crown to the brow, and two big round ear discs standing far out from its sides like headphones, sticking out past its outline. ' +
      'The face opening is ringed with a thick dark grey rim (#3a3a42) and shows a pale face (#f6e6d6) with two big eyes. ' +
      'A tiny light-blue body (#7fc4f0) with short thin arms and legs; a blue mitten (#2a5fc4) on the free hand.',
    worn: 'a big round dent is knocked into the side of the helmet, behind the ridge; the tin-can cannon is dented in at its middle and its muzzle rim crumpled; the far boot has been repainted a lighter blue and is a little bigger than the near one. The face, the eyes, the ridge and the ear discs stay as they are.',
  },
  engineer: {
    // The nod, each part of the read at race size: the kit, carried low and clear of the body (the read in
    // silhouette, so it leads the brief): a hard rectangular toolbox hanging from one hand (a box with square
    // corners, which no other kind carries) and one huge wrench held low in the other, its open jaw out in
    // front; the dome hard hat with a rim all round and the goggles on it (the head shape and the trade: a dome
    // with a rim both sides, where the plumber's cap has a bill out front only); the tall, broad, square build
    // with a small head for it and the square jaw (the gruff builder, and never the plumber's big head on a
    // stout body); the work shirt over khakis (the colour block).
    // Ours, and the joke: a backyard engineer. The hard hat is a battered bowl of a helmet, the goggles are
    // swimming goggles, the wrench one giant spanner, the toolbox a dented tin one.
    // Blind reads (2026-11-03 and 11-04): carried up by his shoulder, the spanner's jaw read as ears or as spikes
    // off the hat; a wide brim on a short man read as the plumber's rival; short and stocky with the kit low,
    // he was named only at low confidence, and an audit paired him with the plumber at play scale. So he is
    // drawn tall, with the hat a dome and the toolbox a crisp box (art/sprites/engineer/design.prompt.txt).
    design:
      'The character: a tall, broad, square-built handyman, long-legged, a big square slab of a chest on long sturdy legs, his head small for his body, head and hat a quarter of his height. ' +
      'His kit is carried low, clear of his body. In his hand on the left of the picture a big hard rectangular metal toolbox (#3f7f5a), a crisp box longer than it is tall with straight edges, square corners and a flat lid, hanging by a small handle beside his knee, clear of his leg. In his gloved hand on the right of the picture one giant grey spanner (#8e8a84) held low, slanting forward and down, its single big open C jaw out in front of his knees. Nothing beside or above his head. ' +
      'On his head a round yellow hard hat (#e9b730): a tall smooth dome with a narrow rim sticking out evenly all the way round, front, sides and back, no bill, no peak; a dark goggle strap (#3a4246) round the dome as a band. ' +
      'A square clean-shaven jaw, peach skin (#efc9a4), two small black eyes. A red work shirt (#b8433c), khaki trousers (#8c7a58), tan work gloves (#a8794a), chunky brown boots.',
    worn: "a big dent is knocked into the side of the hard hat's dome, its rim still running all round; one top corner of the toolbox is crumpled in, its straight edges and square corners otherwise kept; the spanner's handle is bent a little; the hole in the trouser knee is gone, the trousers whole.",
  },
  goose: {
    // The nod, each part of the read at race size: the S of a neck (a goose, not a duck or a chicken), white
    // with an orange beak and feet (the farmyard goose), and the honk with its wings flung up (the
    // troublemaker, which is the whole character).
    // Ours, and the joke: a site goose. A stolen yellow hi-vis vest worn back to front over its body, and
    // something nicked always clamped in its beak: a steel spanner in the design.
    design:
      'The character: a mischievous white goose holding a big stolen steel spanner (#9aa0a8) crosswise in its orange beak, the spanner as long as its head. ' +
      'A long S-shaped neck, a plump white body (#f3f0ea) shaped like a teardrop, a short pointed tail tipped up behind, two orange webbed feet on short orange legs, an orange beak (#d9894a), one small black eye. ' +
      'Over its body it wears a stolen yellow hi-vis safety vest (#e8d23a), put on back to front, with two wide pale grey reflective stripes (#c9ccd2) round it; its white folded wing pokes out of the armhole.',
    worn: 'the hem of the hi-vis vest is torn into two ragged points and one shoulder strap hangs loose; the tip of the folded wing has a big notch of feathers missing; the tail is bent over to one side; the spanner is bent in the middle.',
  },
  sneak: {
    // The nod, each part of the read at race size: the cardboard box with legs (the joke everyone knows him
    // by, and the whole silhouette: the only box with legs in the cast, square-cornered where the crewmate's
    // bean is round, and no head or arms showing where the miner is a cube head on a body with arms); the
    // bandana's long tails streaming out of the box (the soldier inside, at 20 px, and what breaks the box's
    // outline behind); his eyes peering out of a slot in it (somebody is in there); the low, crouched sneak on
    // two short legs (the stealth read in motion).
    // Ours, and the joke: the box is badly made for the job. Patched with packing tape, its printed arrow
    // pointing down, the hand-hole torn ragged, and a striped tea towel for a bandana.
    // Side on, a crisp rectangle with a level bottom edge and a clear gap between the legs: the first design,
    // in three-quarter view with its top corner crushed and its flaps flared, failed the blind read as "a
    // shaggy, hunched" ape (2026-11-04), its slanted top and torn corner rounding the box into a blob and its
    // flaps a skirt over the legs. So the wear keeps the box's outline square.
    design:
      'The character, seen from the side in profile facing right: a soldier hiding inside a big plain brown cardboard box (#c49a62) worn upside down over his whole head and body, down to his knees. The box is the whole figure: a crisp upright rectangle with straight edges and sharp square corners, a little taller than it is wide, its bottom edge straight and level, no flaps showing. ' +
      'Below it only his two short legs show, in a grey-blue sneaking suit (#4d5a66), apart in a low crouching step with a clear gap of white background between them, in big dark boots (#2a2a30). No arms and no head show outside the box. ' +
      'High on the box, near its front edge, a wide rough eye slot is cut, and through it his tan skin (#d9b08c) and two small black eyes peer out. ' +
      'From a round hand-hole high on the back half of the box, the two long tails of his bandana stream straight back behind it, as long as the box is wide: dark navy cloth (#3a4a5c), two broad white stripes (#f4efe6) across each near its tip, like a tea towel.',
    worn: 'a round hand-hole is torn ragged high on the back half of the box, and out of it the two long tails of his bandana stream straight back behind the box, each as long as the box is wide: dark navy cloth (#3a4a5c) with two broad white stripes across each near its tip, like a tea towel, one tail frayed at its end; two big crossed strips of pale packing tape (#e6d6a6) are stuck over a split in the lower back corner of the box; a big printed arrow on the back half of the box, below the hand-hole, points down, in a darker brown. The box keeps its crisp straight edges and square corners, and the eye slot and the eyes stay as they are.',
  },
  cuptoon: {
    // The nod, each part of the read at race size: the mug for a head with its loop handle (the one head
    // nobody else in the cast has, and the whole silhouette: a squat cylinder wider than the body under it);
    // the straw standing up out of it (it breaks the top of the outline, where every other kind is round or
    // capped); the black rubber-hose limbs, big white gloves and big round shoes (the 1930s cartoon read,
    // which is half the joke); the high-waisted shorts (the toon costume, and the costume block in the
    // player's colour).
    // Ours, and the joke: a camping mug, not fine china. White enamel with a thick rim, a chip knocked out of
    // the rim at the back, a paper straw gone soggy and flopped over, and a tea-bag's string hung over the rim
    // with its paper tag dangling by the handle.
    design:
      'The character: a small 1930s rubber-hose cartoon toon whose whole head is a big white enamel camping mug (#f4efe6), a squat round cylinder wider than it is tall and wider than the body under it, ' +
      'with a thick blue enamel rim (#3a5a8c) round its top and one big round loop handle sticking out from the back of the mug; its open top is tipped toward us a little so dark brown tea (#8a5a3a) shows inside the rim. ' +
      'Standing straight up out of the tea, a tall red-and-white striped paper straw (#d8382f), as tall as the mug. ' +
      'On the front of the mug, two big black pie-cut cartoon eyes and a small round red nose, a wide happy smile. ' +
      'Under the mug a tiny body: big baggy high-waisted red shorts (#c9473f), thin black rubber-hose arms and legs that bend in smooth curves with no elbows or knees, ' +
      'big puffy white cartoon gloves (#fbf6ee) and big round brown cartoon shoes (#6b4a35).',
    worn: 'a big chip is broken out of the blue rim at the back of the mug, a jagged notch in its outline, and a black chip of enamel is knocked off the side of the mug just under the handle; the paper straw has gone soggy and flops over at the top in a big droop; a tea-bag string hangs over the back of the rim with a big yellow paper tag (#e8c24a) dangling from it beside the handle; the sole of one shoe has come loose and flaps open at the toe. The front of the mug and the face stay clean.',
  },
  jelly: {
    // The nod, each part of the read at race size: the green dome (the whole silhouette, and the only see-through
    // body in the cast: drawn flat, a pale lime); the three red nuclei inside it (they make it this parasite,
    // not a jellyfish); the four fangs hooked under the rim (the menace, and the only thing breaking the dome's
    // underside); no face and no limbs (it is a creature that floats, never one that walks).
    // Ours, and the joke: a lime jelly dessert that got ideas. The dome is turned out of a fluted jelly mould,
    // the nuclei are three glacé cherries set in it, the fangs are sugared almonds, and a paper doily is stuck
    // to its underside, its lace edge peeking out under the rim.
    // The fangs are the parasite's mandibles: evenly along the rim the silhouette read as a ghost's hem (blind
    // read, 2026-11-03), long curling hooks as an octopus and short hooks at the rim's edge as an ape's arms
    // (2026-11-04); two big ones under the middle curving in to a pincer, and a small one each side, it reads. The
    // shipped design is the worn one edited three times (art/sprites/jelly/fangs.prompt.txt, cherries.prompt.txt so
    // the cherries stand apart and trace as three, then mandibles.prompt.txt on mandibles-ref.png, the design with
    // its hooks whitened out), then touched by hand (tools/art3d/flat/kinds/jelly.ts → clips).
    design:
      'The character: a wobbly lime-green jelly dessert (#9ee38a) turned out of a fluted mould, a tall rounded dome with soft wide ribs down its sides, floating in the air. It has no face, no eyes, no mouth, no arms and no legs. ' +
      'Inside it, seen through the jelly, three big round glossy red glacé cherries (#c9473f) set in a triangle, each as wide as a quarter of the dome. ' +
      'A pale mint-white rim (#d8f2c8) flaring out round the bottom of the dome like a bell. Under it, four curved ivory sugared-almond fangs (#efe6d2), set in from the edge of the rim: two big ones, thick at the root and sharply pointed, half as long as the dome is tall, hang from under the middle and curve in until their tips almost cross, like a pincer; a smaller one each side curves in the same way. ' +
      'A white paper doily (#fbf6ee) with a scalloped lace edge is stuck flat to its underside.',
    worn: 'the dome has slumped a little to one side as if melting, and one fat drip of jelly runs down its side and hangs below the rim; a big round spoonful is scooped out of the top of the dome at the back, a clear dent in its outline; one fang is snapped off short; the doily is torn and one ragged flap of it hangs down.',
  },
  miner: {
    // The nod, each part of the read at race size: the cube head as wide as the body (the only square head in
    // games anyone knows, and the whole silhouette); every part a box with unbending limbs (the shape language,
    // not a costume: no curve anywhere, which no other kind has); the shirt over darker trousers (the outfit's
    // colour block, the shirt in the player's colour and the trousers a dark of it); the pickaxe (what he
    // does, and it breaks the outline above the shoulder). Arms and a head on a body, never one box on legs:
    // that's the sneaking soldier.
    // Ours, and the joke: a wooden toy knock-off. He's carved from wooden blocks, bare wood for skin, the
    // paint chipped at the corners, a dowel peg at each joint, and his pickaxe is a painted wooden toy.
    design:
      'The character: a stiff little toy man made entirely of wooden blocks, every part a box with flat faces and hard square corners, no curves anywhere. ' +
      'He grips a big chunky toy pickaxe in his front hand, its long square wooden handle (#8a5c34) slanting up past his shoulder and its blocky grey head (#8e9298) a flat wide pointed T clear above his shoulder, beside his head. ' +
      'A huge cube head, as wide as his body and a third of his height, seen at three-quarters so two of its square faces show: a flat face of bare pale wood (#c9946a), two square eyes, each a white square with a blue-violet square pupil, and a flat cap of square-cut dark-brown hair (#4a3020) over the top and back of the cube. ' +
      'A rectangular box torso in a painted cyan T-shirt (#3fb0b0), straight square box arms with cyan sleeves and bare-wood block hands, two straight square box legs in dark-blue trousers (#2c3a80), flat grey block shoes (#6b6b72). ' +
      'A round wooden dowel peg shows at each shoulder.',
    worn: "one top back corner of the cube head is broken off, a big square notch out of its outline; the cyan paint has flaked off the bottom corner of the shirt, a big patch of bare pale wood showing there; the pickaxe's wooden handle is cracked and bound with a thick wad of grey tape; one point of the pickaxe head is snapped off short.",
  },
  merc: {
    // The nod, each part of the read at race size: the blade bigger than he is (the read: no one else in the
    // cast carries one, and it leads the brief), always in his hand, never on his back (the plumber's plunger
    // owns the back); the crown of big blond spikes pointing up (the head shape, sharper and taller than the
    // speedster's swept quills); the one big shoulder piece over a slim, dark-cut outfit (the brooding
    // mercenary, not a knight or a hero in a tunic).
    // Ours, and the joke: the legendary blade is a giant serrated bread knife with a riveted wooden handle and
    // a rounded tip, no guard; the shoulder piece is a car hubcap; the spikes are singed at the tips.
    // The palette is neutral (Decisions 4): the top in the player's colour, the trousers a dark of it; hair,
    // skin, steel, wood and leather stay their own.
    design:
      'The character: a slim, brooding young swordsman gripping a giant serrated bread knife as tall as he is: one broad, flat, straight steel blade (#c9ccd2) as wide as his head, a row of big saw teeth along its front edge, a rounded tip, no guard, on a chunky wooden handle (#7a5232) with two rivets. ' +
      'He holds it by the handle in one hand down at his side, the blade standing upright beside him with its tip resting on the ground. ' +
      'On his head a huge crown of big spiky blond hair (#f0d470), five thick spikes pointing up and back, the tallest part of him. Peach skin (#f0cfa8), two big eyes, a stern mouth. ' +
      'A sleeveless knit top (#4a5ab0), baggy trousers in a much darker shade of the same blue (#283266), two brown belts (#6b4a35) crossed at the hip, heavy brown boots. On one shoulder a single big round shoulder piece: a grey car hubcap (#9aa0a8).',
    worn: 'the tip of every hair spike is singed black; the hubcap has a big dent knocked into it and a crack across it; two teeth are snapped out of the middle of the knife edge, leaving a big notch; one trouser leg is torn off ragged at the shin.',
  },
  ape: {
    // The nod, each part of the read at race size: the hunched gorilla shape with arms longer than its legs
    // and huge shoulders over a small low head (the brute, from across the screen, and the line between him
    // and the upright, shelled turtle king); the necktie on the bare chest (the one thing that makes it this
    // ape and not any ape); the pale face and muzzle jutting forward (the cartoon face).
    // Ours, and the joke: a foundry barrel-hauler on his lunch break. The tie is a clip-on worn crooked on a
    // bare chest, his knuckles are wrapped in grey duct tape, and a banana is tucked behind one ear like a pencil.
    // The palette is neutral (Decisions 4): the fur in the player's colour, the tie a dark of it; face, chest,
    // tape and clip stay their own. Drawn here in the roster's browns and red so the roles trace apart.
    design:
      'The character: a big hunched cartoon gorilla, a brute: huge round shoulders and a barrel chest, very long thick arms, longer than its short bowed legs, hanging down so its two huge fists rest on their knuckles on the ground beside its feet. ' +
      'A small head set low and forward between the shoulders, a heavy brow, a big protruding muzzle. ' +
      'Brown fur (#7a4e2c) all over; a pale tan (#e2b98a) face, muzzle and bare chest. ' +
      'On the bare chest a red clip-on necktie (#d03a30), short and wide, worn crooked, with a grey clip (#c9ccd2). ' +
      'Both huge fists wrapped in grey duct tape (#9aa0a8). A yellow banana (#f2d04a) tucked behind one ear like a pencil. Two small black eyes under the brow.',
    worn: 'the necktie hangs crooked, twisted to one side, its tip torn off ragged; on the front fist the grey tape has come loose and one long strip of it hangs down; the banana is bent in the middle and half peeled, one flap of peel hanging down behind the ear.',
  },
  dino: {
    // The nod, each part of the read at race size: the big round snout well out in front (the profile, and
    // the first shape anyone names), the eyes high on top of the head (the face from the side), the saddle on
    // its back (a mount waiting for a hero, without the hero), the short tail and big boots on an upright
    // body (a dinosaur that walks like a person), and green with a white belly (drawn green so the map keeps
    // the parts apart; the body is the player's colour, the spikes and boots tones of it: Decisions 4).
    // Ours, and the joke: a hand-me-down mount. The saddle is a black bicycle seat strapped on with a belt,
    // its chrome stem sticking out behind; the boots are rubber wellies; it carries its own spotted egg about
    // in a carrier bag.
    // The tail is long and the seat low (blind read, 2026-11-04): with a short tail and the seat up behind the head,
    // the head and snout read as a cap and its bill. The shipped design reached that in an edit of the worn one
    // (art/sprites/dino/design.prompt.txt); the brief asks for it outright.
    design:
      "The character: a cheerful upright green dinosaur with a black bicycle seat (#3a3a3e) strapped low and flat on the middle of its back as a saddle by a brown belt (#6b4a35) round its belly, the seat's chrome stem (#c9ccd2) poking out down and back under it. " +
      'A huge round bulbous snout sticking well out in front of its face, as big as the rest of its head; two big eyes set high on top of the head; a big round white belly and white cheeks (#f6f2e8); green skin (#4cbf4a); three round orange spikes (#e8853a) down the back of its head; a long thick tail sticking straight out behind it level with its hips. ' +
      'Big red rubber wellington boots (#d8442f) to the knee, short thick arms. In one hand it carries a pale grey plastic carrier bag (#c9c6bd) with a big white egg with green spots poking out of the top.',
    worn: 'the bicycle seat sits crooked, its cover torn open at the back in a big ragged flap; its chrome stem is bent; one of the head spikes is snapped off short; the top of one wellington boot is folded down; the carrier bag has a big torn hole in its side.',
  },
  king: {
    // The nod, each part of the read at race size, as two big shapes side on: the turtle shell seen as a shell
    // (a smooth dome on his back with its rim standing out as a lip and only three big spikes on top: spikes all
    // round read as a hedgehog or a porcupine twice), and the big horned head with a heavy open jaw and fangs,
    // the horns and the mane swept back (the king, and not a foot soldier or the ape); then the plated belly and
    // the wide, low brute's stance (the boss in a cast of heroes, upright against the ape's hunch).
    // Ours, and the joke: a knock-off boss who never got his castle. A patch plate is bolted on his shell and a
    // paper party crown sits between his horns. The soot puff from his nostrils stays out: anything dark under
    // the face reads as a mouth at play size.
    // Drawn side on: in the shared three-quarter view the head sat inside one round mass with the shell, and two
    // quick readers named that silhouette low or not at all; side on, the snout and its open jaw stand out in front
    // and both named it at medium (art/sprites/king/design.prompt.txt).
    design:
      'The character: a hulking turtle king seen side on in profile, facing right, wide, heavy and low. Two big shapes carry him. ' +
      'On his back: a huge smooth half-dome turtle shell (#3f8a3a) from his shoulders down to his hips, bulging far out behind him, its thick cream rim (#efe2c0) standing out round its edge like a lip, and only three big cream cone spikes standing up along its top. ' +
      "Out front, on a thick neck: a huge head reaching forward, its long blunt snout far out in front of his belly, his heavy jaw wide open in a roar like a crocodile's, a wide wedge of a gap between the jaws with four big white fangs; heavy brows; two long cream horns sweeping up and back; a smooth red-orange mane (#d9502e) swept back behind them. " +
      'Yellow-orange skin (#e8b23c), a pale cream banded belly plate (#e9d29a), huge thick arms with plain dark cuffs (#4a4a50), thick legs planted wide apart, big clawed feet, a thick tail. A small pale-blue paper crown (#9cc8e8) between his horns.',
    // The crown came in an edit before this one, in a pale blue the drawing uses nowhere else (a light tone of the
    // player's colour in the game); the wear stays off the head and the dome's outline but for one bent spike.
    worn: "a big square grey riveted patch plate (#9aa0a8) is bolted flat onto the middle of the green shell; a big chunk is broken out of the shell's cream rim near the bottom; the pale-blue paper crown sits crooked, one of its points torn and folded down; one of the shell's spikes is bent over sideways.",
  },
  dragon: {
    // The nod, each part of the read at race size: small and low on four short legs, side on (the horse is tall
    // with a long neck, the dino upright); the horns swept straight back off the head (the head's outline, and
    // back, never up like the king's); stubby wings standing up off the back (a dragon, not a lizard); the pale
    // belly and the ridge of small spines (the purple dragon's markings, in neutral bone); the tail's arrowhead
    // tip (the tip everyone draws him with).
    // Ours, and the joke: the wings are umbrella cloth on bent spokes, and he carries his own light, a firefly
    // in a jam jar tied to his tail.
    // The palette is neutral (Decisions 4): the scales in the player's colour, the wing cloth a light of it; the
    // belly, horns, spines and tip bone; the jar glass.
    design:
      'The character: a small cute cartoon baby dragon standing low on all four short stubby legs, seen from its side, facing right, its whole outline unmistakably a little dragon, long and low with no neck. ' +
      'Its big round head has a short blunt snout and one big eye, and two long pale bone horns (#ecdcb8) sweep straight back off the top of its head, flat and backward, longer than the head. ' +
      'Two small stubby wings stand up off its shoulders, each made of umbrella cloth (#c4a2ea) stretched over three bent thin black metal spokes, the cloth scalloped between the spoke tips. ' +
      'A row of small pale bone triangle spines runs along the top of its back. A pale bone belly (#ecdcb8). ' +
      'A long thin tail curves out behind and ends in a big flat pale bone arrowhead tip; a small glass jam jar with a firefly glowing pale inside hangs from the tail on a string. ' +
      'The head, body, legs and tail are all one purple (#8a5cc0).',
    worn: "one wing's cloth is torn, a big flap of it hanging loose, and one of its spokes is bent and poking out past the cloth; a big square patch of grey cloth (#9a9c98) is sewn on the other wing with big stitches; the arrowhead tail tip is bent sideways and wrapped with a strip of grey tape.",
  },
  horse: {
    // The nod, each part of the read at race size, and each a shape only a horse has in outline: four long legs
    // under a long barrel body (upright on two legs, ten blind readers took it for a fox or the bandicoot); a long
    // neck rising steeply from the chest with the mane standing up along it as a crest; a long boxy head with a
    // blunt muzzle as deep at the nose as at the eyes, never a fox's point; a long tail of straight hair hanging
    // to the heels, never a brush; flat-bottomed hooves wider than the legs; the goofy buck-toothed grin (its
    // personality, in colour).
    // Ours, and the joke: it is a cheap horse costume, put in by the wear edit (a zip along its belly, a knitted
    // scarf wound round its throat because it has lost its voice, a patch on one knee).
    // The palette is neutral (Decisions 4): the coat in the player's colour, the scarf a dark of it; the
    // muzzle, mane, tail, hooves and zip stay their own.
    design:
      'The character: a goofy cartoon horse standing on all four legs, seen from its side, facing right, its whole outline unmistakably a horse. ' +
      'A long thick neck rises steeply up and forward from its chest, and a short stiff dark brown mane (#4a3428) stands straight up along the whole top of the neck in one neat smooth crest, like a brush, from between the ears down to the shoulders. ' +
      'On top of the neck its long boxy horse head points forward and down: a long blunt rectangular muzzle, as deep at the nose as at the eyes and never tapering, ending square in a big pale cream nose (#e6cfae) with a big round nostril and big flat buck teeth in a goofy grin; one big round eye high on the head; two small pointed ears. ' +
      'Its body is a long round barrel (#c8743a) on four long straight legs, each leg ending in a big flat-bottomed dark brown hoof, wider than the leg. ' +
      'A long tail of straight dark brown hair falls from the top of its rump straight down to its heels, narrow at the root and wider at the end. ' +
      'The head, neck, body and legs are all one colour.',
    worn: 'it is a cheap horse costume: a thick knitted red scarf (#c9473f) is wound round the top of its neck just under the head, one short end hanging down its chest; a big silver zip runs straight down the front of its chest from under the scarf to between its front legs, stuck open at the bottom, its two sides parted in a V; a big square patch of grey cloth is sewn on the knee of one front leg with big stitches.',
  },
  rapper: {
    // The nod, each part of the read at race size: the tall knit beanie standing straight up off the head, a thumb
    // with a round top and a snug band (the head's outline; with a brim, or leaning back to a point, it read as a
    // wizard's hat); the long floppy ear hanging behind the head (a dog, and not the zapmouse, whose ears stand up);
    // the round nose on a snout low on the face (level with the band, it read as a cap's bill: the plumber); the
    // flat card body with a sliver of edge down the back (the paper look the original is known for); the mic held out
    // in front (the rapper). Side on: in the three-quarter view the beanie, head, ears and mic were one tall pill in
    // silhouette. The baggy tee and shorts and big trainers are the colour block, on a chubby body, so the cuptoon's
    // tight hose-limbed toon doesn't rhyme.
    // Ours, and the joke: he's a cardboard shop standee come loose (the card's edge, a fold crease across his middle, a
    // torn bite out of the card at his shorts). The karaoke mic's coiled cord went: hanging below his arm, it read as
    // a monkey's curly tail.
    // The palette is neutral (Decisions 4): the beanie and the tee in the player's colour, the shorts a dark of it;
    // the fur cream, the nose brown, the trainers grey, the mic black, the card's edge plain cardboard.
    // The design was reached in edits (art/sprites/rapper/design.prompt.txt); this is it as one brief, for a redraw.
    design:
      'The character: a chubby cartoon puppy who is a flat cardboard cut-out, seen side on in profile, facing right. ' +
      'His signature: a very tall knitted beanie (#e8922e) standing straight up on his head like a thumb, round on top, never pointed, with a snug thick ribbed band only a little wider than his head and no brim. ' +
      "He holds a chunky black cordless microphone out in front of him at arm's length, clear of his face. " +
      'A big round head of pale cream fur (#f1dfb8) under the band, a snout low on his face ending in a big round dark brown nose (#4a3428), two eyes, one long floppy dog ear hanging down behind his head past his chin. ' +
      'A short round body in a baggy orange tee (#e8922e), baggy dark brown-orange shorts (#9a4f1e), short cream legs, huge chunky grey trainers (#9aa0a8) with thick pale soles. ' +
      'Down the back edge of his outline a narrow strip of plain brown cardboard edge (#b8946a) shows, the thickness of the cut-out.',
    worn: "he is a cardboard shop standee come loose: a crisp fold crease runs straight across his middle at the waist, the card kinked a little there; a torn bite is missing from the card at the edge of his shorts, showing the rough brown card inside. The beanie's shape and the ear don't change.",
  },
  limbless: {
    // The nod, each part of the read at race size: the gaps where the arms and legs should be (the read in
    // silhouette, so it leads the brief: nobody else in the cast is in pieces), the big white gloves and big shoes
    // floating clear of the body with background all round them (what makes the gaps a hero and not a ball), the
    // spiky tuft of hair standing straight up off the crown (the one bump on the head's outline, and the
    // puffball has none), and the big nose out front (it parts the head from the dot-eater's and the puffball's
    // plain rounds).
    // Ours, and the joke: a knock-off. The gloves are yellow washing-up gloves bleached white with their cuffs
    // rolled, one shoe is a size bigger than the other, and a big safety pin holds the neckerchief.
    // The palette is neutral (Decisions 4): the top in the player's colour and the shoes a tone of it; the gloves,
    // skin, hair and neckerchief neutrals. The shoes and neckerchief are drawn in hues of their own (gold, red) so
    // the role map tells them from the top; the game paints them in the kind's roles.
    design:
      'The character: a cartoon hero with no arms and no legs at all, made of separate floating pieces with wide empty white space between every piece. ' +
      'In the middle a big round head and under it a small round body, the two joined: nothing else is attached to him. ' +
      'Two huge white rubber gloves (#eeeae2) float in the air on either side of his body at chest height, well away from it, each glove with a wide gap of white background all round it, no arm, no wrist, nothing joining it to the body. ' +
      'Two huge chunky golden shoes (#e9b52f) float under him, well below the body, each with a gap of white background all round it, no legs, no ankles, nothing joining them to the body. ' +
      'On the very top of his head a tall spiky tuft of brown hair (#8a5a34) stands straight up in three big spikes. A huge round nose (#f0c8a0) sticks far out of the front of his face, two big oval eyes above it, peach skin (#f0c8a0). ' +
      'The body is a small round purple hooded top (#7b3fa6) with a big round pale ring on the chest, and a red neckerchief (#c9473f) tied round where his neck would be, between head and body.',
    worn: 'the gloves are washing-up gloves, each with its long cuff rolled down in a thick ring at the wrist; the far shoe is much bigger than the near one, a size too big, its toe curled up; a big silver safety pin is stuck through the front of the neckerchief; one spike of the hair tuft is bent over at its tip. Every glove and shoe still floats free of the body with white space all round it.',
  },
  hopper: {
    // The nod, each part of the read at race size and each a shape in outline: the long tube snout sticking
    // straight out front, wider at its open end (the read: nobody else in the cast has a horn for a nose, and it
    // parts him from the puffball's plain ball); the round ball with no arms on two short legs with big feet
    // (the arcade hopper, not a creature with hands); the big eyes on top (the face, looking down the snout);
    // the hop, both feet together (the clips, never a walk).
    // Ours, and the joke: the snout is a paper party blower, striped and creased, that unrolls when he cheers,
    // and he hops in a pair of worn-out old trainers.
    // The palette is neutral (Decisions 4): the ball in the player's colour, the snout a light tone of it; the
    // trainers a worn canvas grey.
    design:
      'The character: a round orange ball (#e8742a) with no arms at all, seen from its side facing right. ' +
      'Out of the front of the ball, from its middle, a long straight tube snout sticks straight out level to the right, as long as the ball is wide, a narrow cylinder that flares wider at its round open end like a trumpet, the open end dark inside (#3a2418); the snout is a paler orange (#f4a868). ' +
      'Two big round white eyes with black pupils sit high on top of the ball, looking forward. ' +
      'Under the ball two short thick orange legs, close together, end in two big chunky old canvas trainers (#d4d0c6) with thick grey soles (#8e8a84), the feet much bigger than the legs. ' +
      'The snout is a paper party blower: two pale bands are wrapped round it.',
    worn: 'the toe of the front trainer is split open and its sole flaps loose; the snout has a big crease kinked into it halfway along, so it bends a little but still points straight out; a round tuft of fur sticks up out of the back of the ball. The eyes stay as they are.',
  },
};

function brief(kind: string): Brief {
  const b = BRIEFS[kind];
  if (!b) throw new Error(`no brief for ${kind}: add one to BRIEFS in tools/art3d/style.ts (traits only, never the original's name)`);
  return b;
}

/** The 3D route's sheets need the whole brief. */
function sheets(kind: string): Required<Pick<Brief, 'character' | 'views' | 'pose' | 'poses'>> & Brief {
  const b = brief(kind);
  if (!b.character || !b.views || !b.pose || !b.poses)
    throw new Error(`${kind}'s brief has no 3D sheets (character, views, pose, poses): the 3D route is retired (tools/art3d/3D.md); make it flat (README.md).`);
  return { ...b, character: b.character, views: b.views, pose: b.pose, poses: b.poses };
}

function designed(kind: string): Required<Pick<Brief, 'design' | 'worn'>> {
  const b = brief(kind);
  if (!b.design || !b.worn)
    throw new Error(`${kind} has no design stage yet: add \`design\` and \`worn\` to its brief in tools/art3d/style.ts (docs/CHARACTERS.md → Decisions 9)`);
  return { design: b.design, worn: b.worn };
}

/** The design stage's prompt: the character once, at game size, with no reference image. */
export const designPrompt = (kind: string): string => [DESIGN, designed(kind).design].join(' ');

/** The wear edit's prompt: the picked design (given as the reference), battered by its worn tells. */
export const wornPrompt = (kind: string): string => [WORN, designed(kind).worn, WORN_END].join(' ');

/** The concept sheet's prompt: the design in the game's own ink style. */
export function conceptPrompt(kind: string): string {
  const b = sheets(kind);
  return [STYLE, b.build ?? CHUNKY, b.character, `Layout: one row of full-body views of the same character side by side: ${b.views}.`].join(' ');
}

/** The pose sheet's prompt: the approved concept (the reference) through every pose the game plays. */
export function posePrompt(kind: string): string {
  const b = sheets(kind);
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
  const b = sheets(kind);
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
  const prompts: Record<string, (k: string) => string> = {
    design: designPrompt,
    worn: wornPrompt,
    concept: conceptPrompt,
    pose: posePrompt,
    model: modelPrompt,
  };
  console.log((prompts[stage] ?? conceptPrompt)(kind));
}
