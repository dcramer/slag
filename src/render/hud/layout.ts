import type { Match } from '../../game/match';
import { FONT } from '../../ui/style';

/** Fonts, phone scale limits and group transforms the HUD core and its phase painters share. */

export const DISPLAY = FONT.display;
export const UI = FONT.ui;

export const roundLabel = (m: Match) => `ROUND ${m.round}/${m.rules.maxRounds}`;

export const FOOT_H = 22;
/** Phones: the footer and page headings grow this much at most, or they eat the level. */
export const MAX_FOOT_SCALE = 1.35;
export const MAX_HEAD_SCALE = 1.3;
/** Phones: crate cards grow this much at most, room allowing. */
export const MAX_CARD_SCALE = 2;
/** Phones: lobby bays grow until they're this short, and race chips stop at this share of the height. */
export const MIN_BAY_H = 210;
/** Phones: bays in two or more rows grow until they're this short, room allowing: a thumb-sized name over a thumb-sized button row. */
export const MIN_SMALL_BAY_H = 130;
export const MAX_CHIPS_H = 130;
/** Width of the lobby's top bar on phones, end to end, at scale 1. */
export const PHONE_BAR_W = 520;

/** A group's transform: view = o + logical × s. */
export interface Group {
  s: number;
  ox: number;
  oy: number;
}
export const NO_GROUP: Group = { s: 1, ox: 0, oy: 0 };
