import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import type { ItemKind } from '../../../sim/items/types';
import { type ModuleOf, mysteryState, standFill, standHolds, standNext } from '../../../sim/props';
import { boxPts, glint, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { drawItemIcon, itemShine, twinkle } from '../../items';
import { bulb, type RC } from '../../kit';
import { defineArt, type DrawCtx } from '../common';

type Stand = ModuleOf<'stand'>;

/**
 * The Prize Podium (docs/PARODY.md, weapon stand): the party brawler's weapon spawner as a game show's prize
 * plinth. A squat maroon podium with a gold lid and a row of marquee bulbs across its front, and on top, bobbing,
 * whatever it holds. Taken, the bulbs go dark and light again one by one, left to right, while the next prize's
 * silhouette over the lid fills with gold from the bottom; all four lit, it's there, and the bulbs chase.
 */

const T = TILE;
const PLUSH: HSL = { h: 350, s: 52, l: 38 };
const GOLD: HSL = { h: 44, s: 84, l: 56 };
const LAMP: HSL = { h: 46, s: 100, l: 58 };
const DARK: HSL = { h: 340, s: 30, l: 14 };
const HOT: HSL = { h: 52, s: 100, l: 84 };
/** Bulbs across the front, where they sit (px from the cell's top) and how big. */
const BULBS = 4;
const BULB_Y = 10.6;
const BULB_R = 1.35;
/** Px over the cell's top the prize floats. */
const PRIZE_Y = -4.5;
/** Frames a take's flash lasts. */
const FLASH = 18;

/** Half the box an item's silhouette is cut in, px. */
const GHOST = 11;
/** The silhouette's empty tone: a dark of the plush, so it reads as the prize's shadow, not as smoke. */
const SHADE: HSL = { h: 345, s: 35, l: 24 };

/** `kind`'s icon as one flat shape in `tone`, baked once per kind and tone. */
const silhouette = (kind: ItemKind, tone: HSL) =>
  sprite(`stand|ghost|${kind}|${tone.l}`, -GHOST, -GHOST, GHOST * 2, GHOST * 2, (g) => {
    g.save();
    drawItemIcon(g, kind, 0, 0, 1);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = css(tone);
    g.fillRect(-GHOST, -GHOST, GHOST * 2, GHOST * 2);
    g.restore();
  });

/** The podium, baked once: a tapered body, a band of lighter plush up its middle, a gold lid and a foot. */
const podium = () =>
  sprite('stand|podium', -2, 2, T + 4, T, (g) => {
    part(g, poly(1.8, T, 2.7, 6.2, T - 2.7, 6.2, T - 1.8, T), PLUSH, 5, { depth: 0.9, thin: 0.45, thick: 1.1 });
    // The lighter panel up its face, cut as a shape, with two marks on the plush either side of it.
    g.fillStyle = css(PLUSH, 9);
    path(g, poly(5.2, T - 0.8, 5.5, 7.4, T - 5.5, 7.4, T - 5.2, T - 0.8));
    g.fill();
    tick(g, 3.6, 12.6, 3.4, 15, 0.35, 6, css(PLUSH, -24));
    tick(g, T - 3.6, 12.6, T - 3.4, 15, 0.35, 7, css(PLUSH, -24));
    // The lid, wider than the body, and its sheen.
    part(g, boxPts(0.6, 3.8, T - 1.2, 2.8, 0.8, 8, 0.2), GOLD, 8, { depth: 0.5, thin: 0.4, thick: 1 });
    glint(g, poly(2.4, 4.5, 6.5, 4.3, 10.5, 4.5), 'rgba(255,250,224,0.9)', 0.55);
    // A gold foot where it meets the floor.
    part(g, boxPts(1.2, T - 1.7, T - 2.4, 1.7, 0.5, 9, 0.1), GOLD, 9, { depth: 0.3, thin: 0.35, thick: 0.8 });
  });

function drawStand(rc: RC, m: Stand, d: DrawCtx) {
  const s = rc.s;
  const f = rc.frame;
  const st = d.o.state;
  const seed = d.o.itemSeed;
  // Outside a race nothing is on it yet but its bulbs are lit: a crate card shows it with the first of its pool.
  const holds = seed === undefined ? (d.o.card ? m.pool[0] : null) : standHolds(m, st, d.mi, f, seed, d.r.pp.uid);
  const fill = seed === undefined ? 1 : standFill(m, st, d.mi, f);
  const popAt = mysteryState(st, d.mi).popAt;
  for (const [cx, cy] of m.cells) {
    const x = cx * T + d.off[0];
    const y = cy * T + d.off[1];
    stamp(s, podium(), x, y);
    // The bulbs: lit as far as it has filled, the next one blinking; full, a chase runs along them.
    const lit = fill >= 1 ? BULBS : Math.floor(fill * BULBS);
    const chase = Math.floor(f / 8) % BULBS;
    for (let i = 0; i < BULBS; i++) {
      const bx = x + 4 + (i * (T - 8)) / (BULBS - 1);
      const on = i < lit || (i === lit && fill < 1 && Math.floor(f / 10) % 2 === 0);
      bulb(s, bx, y + BULB_Y, BULB_R, on ? (fill >= 1 && i === chase ? HOT : LAMP) : DARK, 1);
    }
    if (!holds && seed !== undefined && fill < 1) {
      // The next prize on its way: its silhouette over the lid, dark, filling with gold from the bottom up as the
      // bulbs light, a crisp flat shape the pen inks like anything else.
      const next = standNext(m, st, d.mi, seed, d.r.pp.uid);
      const px = x + T / 2;
      const py = y + PRIZE_Y;
      stamp(s, silhouette(next, SHADE), px, py);
      const top = py + GHOST - fill * 2 * GHOST;
      s.save();
      s.beginPath();
      s.rect(px - GHOST, top, GHOST * 2, py + GHOST - top);
      s.clip();
      stamp(s, silhouette(next, GOLD), px, py);
      s.restore();
    }
    if (holds) {
      // The prize, bobbing over the lid in a slow-turning ring of shine, as a loose item does.
      const bob = Math.sin(rc.t * 3.2 + m.seed) * 1.1;
      const px = x + T / 2;
      const py = y + PRIZE_Y + bob;
      rc.bg.save();
      rc.bg.translate(px, py);
      rc.bg.rotate(rc.t * 0.8 + m.seed);
      stamp(rc.bg, itemShine(holds));
      rc.bg.restore();
      drawItemIcon(s, holds, px, py, 1, rc.t);
    }
    const since = f - popAt;
    if (since >= 0 && since < FLASH) {
      // Taken: a burst of gold stars off the lid.
      const u = since / FLASH;
      const col = css(GOLD, 24, 1 - u);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        const r = 3 + u * 10;
        twinkle(s, x + T / 2 + Math.cos(a) * r, y + 3 + Math.sin(a) * r, 1.6 * (1 - u) + 0.3, col);
      }
    }
  }
}

defineArt<'stand'>({ type: 'stand', layer: 1, draw: drawStand });
