import { css } from '../../core/color';
import type { Match } from '../../game/match';
import { MAX_PLAYERS, VIEW_W } from '../../sim/constants';
import { drawGlyph, type Glyph, glyphWidth } from '../../ui/glyphs';
import type { PromptAction } from '../../ui/prompts';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { blob } from '../ink';
import { glowDot } from '../kit';
import { icon, plate, stampButton, tag } from '../hud-kit';
import type { Hud, HudAction, JoinCardInfo, NetArrival } from '../hud';
import { promptGlyphs } from './footer';
import { DISPLAY, UI } from './layout';

/**
 * Joining a room and taking a seat in it, as the game's own screens: the room code while the link comes
 * up (or the room's failure), the Join call to action a watcher always has in the corner, the join card
 * it opens over the live match, and the corner banner that says where a peer without a seat stands.
 */

/** The room code while the link comes up, or what went wrong and the way out. Over everything. */
export function arrival(hud: Hud, m: Match, t: number) {
  const a = hud.net!.arrival!;
  const c = hud.ctx;
  const f = hud.frame;
  c.fillStyle = 'rgba(14,8,6,0.9)';
  hud.wash();
  hud.stepEmbers(1 / 60);
  const failed = a.stage === 'failed';
  const countdown = a.rejoinIn !== undefined;
  const w = 320;
  const h = failed ? (countdown ? 116 : 96) : 118;
  const cy = (f.safeY0 + f.y1) / 2;
  const done = hud.grow(VIEW_W / 2, cy, Math.min(hud.uiScale, (f.w - 24) / (w + 20), (f.h - 16) / 290));
  hud.logo(VIEW_W / 2, cy - 104, 34);
  const x = VIEW_W / 2 - w / 2;
  const y = cy - 70;
  plate(c, x, y, w, h, { stroke: failed ? PAL.amber : undefined, seed: 7 });
  hud.text('LOBBY', VIEW_W / 2, y + 18, TYPE.caption, PAL.dim, 'center', UI, 800);
  hud.text(hud.room, VIEW_W / 2, y + 40, 26, PAL.amber, 'center', DISPLAY, 400, 4);
  if (failed) {
    c.font = `700 ${TYPE.head}px ${UI}`;
    const tw = c.measureText(a.title).width;
    icon(c, 'alert', VIEW_W / 2 - tw / 2 - 4, y + 72, 12, PAL.amber);
    hud.text(a.title, VIEW_W / 2 + 9, y + 72.5, TYPE.head, PAL.bone, 'center', UI, 700);
    if (countdown && a.rejoinIn! > 0) {
      const s = a.rejoinIn!;
      hud.text(`You can rejoin in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, VIEW_W / 2, y + 96, TYPE.label, PAL.ash, 'center', UI, 700);
    }
  } else {
    hud.text(a.title, VIEW_W / 2, y + 68, TYPE.head, PAL.bone, 'center', UI, 700);
    // A molten bead running along a slot: something is happening, with no promise of when.
    c.fillStyle = PAL.ink;
    c.fillRect(VIEW_W / 2 - 71, y + 83, 142, 7);
    c.fillStyle = PAL.soot;
    c.fillRect(VIEW_W / 2 - 70, y + 84, 140, 5);
    const p = (t * 0.6) % 1;
    c.fillStyle = PAL.molten;
    c.fillRect(VIEW_W / 2 - 70 + p * 120, y + 84, 20, 5);
    glowDot(hud.gctx, VIEW_W / 2 - 60 + p * 120, y + 86, 14, { h: 22, s: 100, l: 55 }, 0.5, 0.3);
    peers(hud, m, a, y + h - 13);
  }
  const by = y + h + 12;
  if (countdown && a.rejoinIn === 0) {
    hud.btn({ x: VIEW_W / 2 - 128, y: by, w: 124, h: 28, action: 'rejoin' }, 'Rejoin', 'primary', undefined, TYPE.label);
    hud.btn({ x: VIEW_W / 2 + 4, y: by, w: 124, h: 28, action: 'home' }, 'Main Menu', 'secondary', undefined, TYPE.label);
  } else if (failed && a.offline) {
    hud.btn({ x: VIEW_W / 2 - 128, y: by, w: 124, h: 28, action: 'offline' }, 'Play Offline', 'primary', undefined, TYPE.label);
    hud.btn({ x: VIEW_W / 2 + 4, y: by, w: 124, h: 28, action: 'home' }, 'Main Menu', 'secondary', undefined, TYPE.label);
  } else hud.btn({ x: VIEW_W / 2 - 62, y: by, w: 124, h: 28, action: 'home' }, 'Main Menu', failed ? 'primary' : 'ghost', undefined, TYPE.label);
  done();
}

/** Who's here, as presence knows it: a token per peer, in a player's color once the room's state is in. */
function peers(hud: Hud, m: Match, a: NetArrival, cy: number) {
  const c = hud.ctx;
  const n = Math.min(a.here, 12);
  const x0 = VIEW_W / 2 - ((n - 1) * 12) / 2;
  for (let i = 0; i < n; i++) {
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(x0 + i * 12, cy, 4.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = i < m.players.length ? css(m.players[i].character.body) : PAL.ash;
    c.beginPath();
    c.arc(x0 + i * 12, cy, 3, 0, Math.PI * 2);
    c.fill();
  }
}

/** A stamped button with its input glyphs before the label; `action` undefined draws it disabled. */
function promptButton(
  hud: Hud,
  m: Match,
  b: { x: number; y: number; w: number; h: number },
  action: HudAction | undefined,
  label: string,
  prompt: PromptAction | null,
  style: 'primary' | 'secondary' | 'ghost',
  size: number = TYPE.label,
) {
  const c = hud.ctx;
  let sink = 0;
  if (action) {
    const hover = hud.button({ ...b, action });
    sink = stampButton(c, b.x, b.y, b.w, b.h - 3, style, hover);
  } else plate(c, b.x, b.y, b.w, b.h - 3, { rivets: false });
  const glyphs: Glyph[] = action && prompt ? promptGlyphs(hud, m, prompt) : [];
  const gh = Math.min(13, b.h * 0.45);
  c.font = `800 ${size}px ${UI}`;
  const lw = c.measureText(label).width;
  let gw = 0;
  for (const g of glyphs) gw += glyphWidth(c, g, gh) + 3;
  let gx = b.x + (b.w - (gw + lw + (gw ? 3 : 0))) / 2;
  const mid = b.y + (b.h - 3) / 2 + sink;
  for (const g of glyphs) gx += drawGlyph(c, g, gx, mid, gh) + 3;
  if (gw) gx += 3;
  const ink = !action ? PAL.dim : style === 'primary' ? PAL.ink : PAL.bone;
  hud.text(label, gx, mid + 0.5, size, ink, 'left', UI, 800, 0, true);
}

/**
 * Join, in the bottom corner in every phase: a watcher can always see whether there's a seat, and take it.
 * With none free it reads Match Full and does nothing, until one frees.
 */
export function joinCta(hud: Hud, m: Match) {
  const f = hud.frame;
  const w = 118;
  const h = 30;
  const done = hud.grow(f.safeX1 - 10, f.y1 - hud.footH - 6, hud.uiScale);
  joinButton(hud, m, { x: f.safeX1 - 10 - w, y: f.y1 - hud.footH - 6 - h, w, h }, TYPE.head - 2);
  done();
}

/** The Join button itself, wherever it sits: the corner mid-match, the online panel's end in the lobby. */
export function joinButton(hud: Hud, m: Match, b: { x: number; y: number; w: number; h: number }, size: number) {
  const open = (hud.net?.space ?? 0) > 0;
  promptButton(hud, m, b, open ? 'play' : undefined, open ? 'Join' : 'Match Full', 'confirm', 'primary', size);
}

/**
 * The join card: the toy you'd play as, shown big on a lobby card, with the dice and your name to change
 * first, the seats as they stand, and the confirm. The match runs on behind it; then it says how it went.
 */
export function joinCard(hud: Hud, m: Match, card: JoinCardInfo, t: number) {
  const c = hud.ctx;
  const f = hud.frame;
  c.fillStyle = 'rgba(14,8,6,0.55)';
  hud.wash();
  const w = 210;
  const h = 268;
  const cy = (f.safeY0 + f.y1) / 2;
  const done = hud.grow(VIEW_W / 2, cy, Math.min(hud.uiScale, (f.h - 12) / (h + 50)));
  const x = VIEW_W / 2 - w / 2;
  const y = cy - h / 2 - 16;
  const ch = card.character;
  plate(c, x, y, w, h, { edge: css(ch.body, 5), stroke: card.stage === 'won' ? PAL.toxic : card.stage === 'taken' ? PAL.amber : undefined, seed: 3 });
  hud.text('JOIN', x + 12, y + 17, TYPE.label, PAL.amber, 'left', DISPLAY, 400, 3);
  // The seats, live: a player's color each, a dot for one already won, and the free ones empty.
  const seats = hud.net?.seats ?? [];
  const px = x + w - 12 - (MAX_PLAYERS - 1) * 9;
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const s = seats[i] ?? '';
    const sx = px + i * 9;
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(sx, y + 17, 3.8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = s === 'queued' ? PAL.amber : s || PAL.soot;
    c.beginPath();
    c.arc(sx, y + 17, s === 'queued' ? 1.4 : 2.7, 0, Math.PI * 2);
    c.fill();
  }
  // The toy, big, on a slag pedestal, as the lobby shows it.
  const cx = x + w / 2;
  const feet = y + 150;
  c.fillStyle = PAL.ink;
  blob(c, cx + 0.5, feet + 3, 34, 41, 7 / 34, 0.05);
  c.fill();
  c.fillStyle = '#3a2a22';
  blob(c, cx - 0.5, feet + 1.2, 31.5, 42, 5.5 / 31.5, 0.05);
  c.fill();
  glowDot(hud.gctx, cx, feet + 3, 34, { h: 22, s: 100, l: 50 }, 0.35, 0.2);
  drawInkRunner({ s: c, g: hud.gctx }, ch, cx, feet, {
    facing: Math.sin(t * 0.8) > 0 ? 1 : -1,
    vx: 0,
    vy: 0,
    grounded: true,
    t,
    scale: 4.1,
    celebrate: card.stage === 'won',
  });
  const editing = card.stage === 'edit';
  // The name, to change before going in.
  const ny = feet + 24;
  c.font = `400 17px ${DISPLAY}`;
  const nw = c.measureText(ch.name).width;
  const nh = hud.mode === 'touch' ? 26 : 21;
  const nameHover = editing && hud.button({ x: cx - nw / 2 - 14, y: ny - nh / 2, w: nw + 28, h: nh, action: 'name' });
  hud.text(ch.name, cx, ny, 17, nameHover ? PAL.amber : PAL.bone, 'center', DISPLAY, 400, 3.5);
  if (editing) icon(c, 'pencil', cx + nw / 2 + 8, ny, 8, nameHover ? PAL.amber : PAL.dim);
  const by = y + h - 40;
  const space = hud.net?.space ?? 0;
  const open = space > 0;
  if (card.stage !== 'won')
    hud.text(open ? `${space} ${space === 1 ? 'Seat' : 'Seats'} Open` : 'Match Full', cx, ny + 30, TYPE.label, open ? PAL.ash : PAL.amber, 'center', UI, 700);
  if (editing) {
    promptButton(hud, m, { x: x + 10, y: by, w: w - 50, h: 30 }, open ? 'seat' : undefined, open ? 'Join' : 'Match Full', 'confirm', 'primary', TYPE.head - 2);
    hud.btn({ x: x + w - 36, y: by, w: 26, h: 30, action: 'look' }, '', 'secondary', 'dice');
  } else if (card.stage === 'asking') {
    promptButton(hud, m, { x: x + 10, y: by, w: w - 20, h: 30 }, undefined, 'Joining…', null, 'primary', TYPE.head - 2);
  } else if (card.stage === 'won') {
    tag(c, card.now ? "YOU'RE IN" : "YOU'RE IN NEXT ROUND", cx, by + 13, PAL.toxic, PAL.ink, TYPE.label + 1, 'center');
  } else tag(c, 'TAKEN', cx, by + 13, PAL.amber, PAL.ink, TYPE.label + 1, 'center');
  // Under the card: the way back, and the keys for what the card holds.
  if (editing) {
    const items: [PromptAction, string, HudAction][] = [
      ['use', 'New Look', 'look'],
      ['down', 'Rename', 'name'],
      ['alt', 'Cancel', 'cancel'],
    ];
    keyRow(hud, m, items, cx, y + h + 14);
  }
  done();
}

/** Prompts in a row, centered on cx, each clickable. */
function keyRow(hud: Hud, m: Match, items: [PromptAction, string, HudAction][], cx: number, cy: number) {
  const c = hud.ctx;
  const gh = 12;
  const size = TYPE.label;
  const parts = items.map(([p, label, action]) => {
    const glyphs = hud.mode === 'touch' ? [] : promptGlyphs(hud, m, p);
    c.font = `700 ${size}px ${UI}`;
    let gw = 0;
    for (const g of glyphs) gw += glyphWidth(c, g, gh) + 3;
    return { glyphs, label, action, w: gw + c.measureText(label).width + (gw ? 3 : 0) };
  });
  const gap = 24;
  let x = cx - (parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1)) / 2;
  for (const p of parts) {
    const hover = hud.button({ x: x - 4, y: cy - 10, w: p.w + 8, h: 20, action: p.action });
    let gx = x;
    for (const g of p.glyphs) gx += drawGlyph(c, g, gx, cy, gh) + 3;
    if (p.glyphs.length) gx += 3;
    hud.text(p.label, gx, cy + 0.5, size, hover ? PAL.amber : PAL.ash, 'left', UI, 700);
    x += p.w + gap;
  }
}

/**
 * Where a peer without a seat stands, in the top corner while it watches the match: watching, owed a
 * seat next round, or (seated) watching from the next round.
 */
export function seatBanner(hud: Hud, m: Match, t: number) {
  const seat = hud.net?.seat;
  if (m.phase === 'lobby' || !seat || seat === 'seated' || hud.net?.arrival) return;
  const c = hud.ctx;
  const f = hud.frame;
  const queued = seat === 'queued';
  const label = queued ? "You're In Next Round" : seat === 'leaving' ? 'Watching Next Round' : 'Watching';
  const right = f.safeX1 - 8 - (hud.mode === 'touch' ? hud.gearW : 0);
  const done = hud.grow(right, f.safeY0 + 8, hud.uiScale);
  c.font = `700 ${TYPE.label}px ${UI}`;
  const w = c.measureText(label).width + 34;
  const x = right - w;
  const y = f.safeY0 + 8;
  const tone = queued ? PAL.toxic : PAL.ash;
  plate(c, x, y, w, 24, { rivets: false, stroke: queued ? PAL.toxic : undefined });
  if (queued) icon(c, 'check', x + 13, y + 12, 9, tone);
  else {
    c.save();
    c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2);
    icon(c, 'eye', x + 13, y + 12, 10, tone);
    c.restore();
  }
  hud.text(label, x + 24, y + 12.5, TYPE.label, PAL.bone, 'left', UI, 700);
  done();
}
