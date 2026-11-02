import type { ThemeId } from '../../../themes';
import type { DrawCtx } from '../common';
import { CASTLE } from './castle';
import { type Cannon, type Deco, type Rotor, themeOf, type ThemeSkins } from './common';
import { FACTORY } from './factory';
import { FARM } from './farm';
import { GLACIER } from './glacier';
import { HARBOR } from './harbor';
import { JUNGLE } from './jungle';
import { MINE } from './mine';
import { ROOFTOPS } from './rooftops';
import { SPACE } from './space';
import { VOLCANO } from './volcano';

export { type CannonPose, type CannonSkin, type DecoSkin, type RotorSkin, themeOf, type ThemeSkins } from './common';

/**
 * Theme skins for set pieces, one file per theme (./<theme>.ts). A theme reaches some pieces through looks
 * other themes own (glacier's chairlift is a `gondola`), and a stage concept's landmark is drawn in its
 * theme's own way: a skin gives that art, chosen by the level's theme (docs/PARODY.md, Set pieces). Each is
 * inked with the shared pen and drawn on the exact shapes the sim moves, so what you see is what you stand on.
 */
export const SKINS: Record<ThemeId, ThemeSkins> = {
  farm: FARM,
  factory: FACTORY,
  castle: CASTLE,
  jungle: JUNGLE,
  volcano: VOLCANO,
  harbor: HARBOR,
  mine: MINE,
  rooftops: ROOFTOPS,
  glacier: GLACIER,
  space: SPACE,
};

export function rotorSkin(m: Rotor, d: DrawCtx) {
  const t = themeOf(d);
  return t ? SKINS[t].rotor?.[m.look] : undefined;
}

export function cannonSkin(m: Cannon, d: DrawCtx) {
  const t = themeOf(d);
  return t ? SKINS[t].cannon?.[m.look] : undefined;
}

/** Scenery dressing a theme draws its own way, by deco kind. */
export function decoSkin(m: Deco, d: DrawCtx) {
  const t = themeOf(d);
  return t ? SKINS[t].deco?.[m.kind] : undefined;
}
