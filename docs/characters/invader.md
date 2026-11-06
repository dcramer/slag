# The pixel crab from space

A kind of the cast: [CHARACTERS.md](../CHARACTERS.md) has the rules every kind follows.

- **Kind:** `invader` · **Name:** Space Evader
- **A stranger should say:** "the space invader, the pixel crab from the arcade."
- **Silhouette:** wider than tall, cut from square pixels with stepped edges: two antennae up from the top corners, a short arm out of each side bent up like a raised claw, a row of stubby legs under it that spread and pinch in turn. No neck, no head apart from the body.
- **Traits:** the stepped pixel edge all round; the two antennae; the raised side claws; two square eye holes; the two-step shuffle.
- **Palette:** costume (the player's, `#9a7ad8` on the sheets): the whole crab, its cel shadow folded in. The tape over the fallen tile `#a4a8ac`; the eye holes are holes, the level showing through them, dark on the dark themes and the lobby cards.
- **Color slot:** costume: the body.
- **Palette alts:** the tape in grey duct tape `#a4a8ac`, brown packing tape `#c49a5a` or masking tape `#e4d6ae`.
- **Gait:** the arcade's two-step: the legs out, then in, the whole body jumping one pixel sideways on each beat; it never walks smoothly.
- **Idles and cheers:** the idle from the design; the legs pinched in, claws up. Both claws thrust high with the pincers open, legs tucked in a hop; a squat dance, claws snapping.
- **Gait range:** a bounce of 0.3–0.8 px on each step, no lean: it stays square to the grid.
- **Wear:** in the drawing, the taped tile and the bent antenna; scuffed is a pale streak low on the body, scorched a dark one (tones of the costume).
- **The nod:** the pixel crab outline (the read: nobody else in the cast is made of square steps); the two antennae and the side claws.
- **Our twist:** one pixel has fallen out of its back and is taped back on, crooked, and one antenna is bent over at the tip.
- **Swaps:** a plaster low on the body, clear of the eyes (`plaster`). Which tile is taped and a second bent antenna would change the outline, so they're the drawing's, the same on every look.
- **Rig:** drawn flat (2026-11-05, `art/sprites/invader/design.prompt.txt`), seen flat from the front, 19 px tall, 12 images. The design came back as asked, a pixel crab of our own (six legs, U-shaped pincers raised), so the twist is the wear edit: the tile taped back on crooked between the antennae and the bent tip. The eye holes are cut through the frame (`art/sprites/invader/holes.py`, `map.holes`, the kit's `cutout` eye acting round them), and nothing rounds the steps (`smooth: 0`). The wall slide is the jump drawing, claws up and legs hanging: drawn clinging side on, its eyes stacked one over the other. The two-step's sideways pixel hop has no place in the frames yet (a clip has no per-frame x offset); the beat is the legs spreading and pinching and the step's bounce. Design read, the two drafts black at 22 px beside six cast designs, two fresh readers: "Space Invaders crab invader, high confidence. Wide pixel body, two antennae, raised pincer arms, two eye holes and short splayed legs" and "crab invader from Space Invaders, high. Antennae on top, raised claw arms, eye holes, segmented legs." The blind sheet, two fresh readers:
  - **Round 1** (what ships): "the pixel space alien; high; blocky pixel shape with antennae and claw arms" and "pixel alien (Space Invaders) - high - blocky pixel crab with claws up and stubby legs". Neither paired it with anyone.
  - **Sizes:** the jump is drawn at 0.8 (the falling drawing's claws flung out wide) and the knockout at 0.85, inside the shared box.
- **Concept prompt:** A cartoon space crab built from big square pixels with stepped edges, flat and wider than tall, two antennae sticking up from its top corners with one bent over at the tip, a short stepped arm out of each side bent upward like a raised claw, a row of stubby square legs underneath, two square eye holes in its face, one pixel on its back fallen out and taped back on crooked with grey tape, standing in three-quarter view.
