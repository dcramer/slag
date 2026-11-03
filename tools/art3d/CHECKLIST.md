# One kind: run sheet and done list

For a production agent taking one Roster entry (docs/CHARACTERS.md → Roster) to a kind the game draws. The how is in [README.md](README.md). Copy this list into your report and tick it.

## Run sheet

- [ ] **Worktree.** `pnpm install`. Read AGENTS.md, src/render/AGENTS.md, docs/ART.md → World art, your Roster entry and its "Rules for every kind", and `art/sprites/plumber/` as the worked example.
- [ ] **Tripo.** `node tools/tripo/tripo.ts balance` from terra. Note the balance; it goes in your report.
- [ ] **Brief.** `BRIEFS[kind]` in `style.ts` from the entry: `character` (traits, palette hex, the twist, the signature prop), `views`, `pose` (what must stay clear of the arms), `poses` (the gait's poses: idle, run, the jump with its anticipation and its peak, fall, wall slide, cheer, death). Its comment lists the nod with why each one stays, and the twist. Never a real name.
- [ ] **Concept** (free) → `art/sprites/<kind>/concept.png` and `concept.prompt.txt`.
- [ ] **Twist pass.** Not the original redrawn; every nod trait present; the joke visible. Redraw until both hold.
- [ ] **Pose sheet** (free) → `poses.png`, `pose.prompt.txt`.
- [ ] **Model sheet** (free) → `tpose.png`, `model.prompt.txt`. Proportions pushed (head about half, big hands and feet), flat colour, no ink.
- [ ] **Model** (40) → `pnpm sprites inspect`: profile, proportions, the nod as shapes. Redo the sheet, not the renderer, if the figure is wrong.
- [ ] **Rig** (20) and **presets** (0); prompt motions only when keying can't do it. **Export** → `model.glb`.
- [ ] **sprite.json:** roles and palette, the nod drawn bigger (regions, grow, scale, girth), the signature prop, swaps from the entry (2–4, each `slot` empty or the item, a `vary` index each), the face, the clips, the keys from the pose sheet, weight fixes.
- [ ] **Variety** (README → sprite.json → Variety): the entry's palette alts (2–3 colourways on one secondary region, every role of a colourway changing together), `idle2` and `cheer2`, the `gait` range, and the `wear` slot (clean, scuffed, scorched: three to five marks each, on the body, limbs and shoes).
- [ ] **Register:** add the kind to `LOADERS` in `src/render/cast/sprites/index.ts`.
- [ ] **Iterate** with `pnpm sprites keys` and `pnpm sprites <kind> --zoom 6` until every clip looks drawn by the cast's hand.
- [ ] **Shoot:** `pnpm shot sprites --kind <kind>` and `pnpm shot variety --kinds <kind>`. Look at all of it: `shots/sprites-<kind>.png`, the cast lineup, the run cycle, the six-rolls lobby, `shots/sprites-<kind>-variety.png`, `shots/art3d/<kind>-{frames,rolls,silhouettes}.png`.
- [ ] **Blind read:** give `shots/sprites-blind.png` (copy it out of the repo first) to two fresh agents with the prompt below. Nothing else in their brief.
- [ ] **Gate:** `git merge origin/main`, `pnpm check`, `pnpm build`. Commit to your branch; don't push.

## Done when

- [ ] At play scale, in colour, among the cast: a stranger would name the homage, and every nod trait in the entry is visible.
- [ ] On the lobby cards, the twist and the swaps are visible, and six rolls look like six characters of one kind.
- [ ] The variety sheet: twelve looks that all read as the same character by the same hand. Each colourway looks designed beside the others; the second idle and cheer read as that character's own; no hand covers the face; the wear reads as wear at 4× and as nothing louder than a mark at play scale.
- [ ] Blind read: both fresh readers name the homage, at least one at medium confidence or better. Say the readers' exact words in your report.
- [ ] No frame looks rendered: flat parts, the cast's pen, the cast's face, no stray slivers, lines that don't swim between frames.
- [ ] Every clip: idle, walk, run, air, wall, cheer, death, both facings. The jump shows its peak pose; the wall slide has life.
- [ ] `tests/sprite-cast.test.ts` passes: inside the shared box pen and all (every slot option, the boldest gait), at least 18 world px tall, rolls valid, the variety layers present and spread over the seeds, no wear mark on the face. A kind made before variety leaves `BEFORE_VARIETY` when it gets its layers.
- [ ] Draw cost from `shots/sprites-<kind>-bench.txt`: cached under 0.02 ms per runner.
- [ ] Frame data under 500 KB with the variety (`pnpm sprites` prints it).
- [ ] The report has the credits spent (balance before and after), the Tripo project id, the blind read, and the shot paths.

## The blind-read prompt

> You are helping test a video game's character art. Look at exactly one image: `<path>`. Do not open, list or search any other file or directory, and run no other commands. The image has numbered columns; each column is one small character as a solid black silhouette, standing, running and jumping, at the size it appears in a 2D platformer. Most are parodies of famous game characters; a few may be plain animals. For each number, name what it parodies, give your confidence (high, medium or low), and the shape features that told you. Write "unsure" where you can't tell; don't guess to fill a slot. Reply with one line per number only.

The answer key is `shots/sprites-blind-answers.txt`; never give it to a reader.
