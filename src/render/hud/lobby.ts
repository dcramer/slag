import { css } from '../../core/color';
import { isBotDevice } from '../../brain/device';
import { botLevelLabel, type Match, type Player } from '../../game/match';
import { MAX_PLAYERS, VIEW_H, VIEW_W } from '../../sim/constants';
import { THEME_LABELS } from '../../themes';
import { drawGlyph, type Glyph } from '../../ui/glyphs';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { bay, icon, plate, swatchDot, tag } from '../hud-kit';
import { blob } from '../ink';
import { glowDot } from '../kit';
import type { Hud, NetInfo, NetWatcher } from '../hud';
import { joinButton } from './arrival';
import { DISPLAY, UI, FOOT_H, MAX_FOOT_SCALE, MIN_BAY_H, MIN_SMALL_BAY_H, PHONE_BAR_W } from './layout';

/** The lobby: top bar, player bays and the online panel. */

/** A lobby character's height per unit of scale, ears and hats included: what a bay must leave above its feet. */
const CHAR_H = 19;
/** A bay's width at scale 1, and the space between bays. */
const BAY_W = 174;
const BAY_GAP = 10;
/** Room panel height under the bays on phones, before its scale. */
const PHONE_NET_H = 36;

export function lobby(hud: Hud, m: Match, t: number, dt: number) {
  const c = hud.ctx;
  const vg = c.createLinearGradient(0, hud.frame.y0, 0, hud.frame.y1);
  vg.addColorStop(0, 'rgba(18,10,7,0.78)');
  vg.addColorStop(0.3, 'rgba(18,10,7,0.35)');
  vg.addColorStop(0.75, 'rgba(18,10,7,0.45)');
  vg.addColorStop(1, 'rgba(40,12,4,0.85)');
  c.fillStyle = vg;
  hud.wash();
  glowDot(hud.gctx, VIEW_W / 2, hud.frame.y1 + 60, 330, { h: 18, s: 100, l: 45 }, 0.22, 0.2);
  hud.stepEmbers(dt);

  // Top bar: logo · level plate · menu buttons. On phones its ends hug the window and the buttons are icons.
  const win = hud.frame;
  const phone = hud.phone;
  const safeW = win.safeX1 - win.safeX0 - 16;
  const bar = phone ? phoneBar(hud, safeW) : { s: 1, lw: 360, step: 92 };
  const barS = bar.s;
  const tap = hud.tapMin;
  let done = hud.begin(barS, phone ? win.safeX0 + 8 - 14 * barS : 0, 0);
  hud.logo(64, 30, 38);
  const me = m.players.find((p) => p.device === hud.mouseDevice);
  const lv = m.level.theme;
  const themeLabel = THEME_LABELS[lv.id].toUpperCase();
  const lx = 140;
  const lw = bar.lw;
  const refreshW = m.players.length ? (phone ? 40 : 94) : 0;
  // On a phone New Level's icon grows to a thumb's width: the plate's own area stops short of where it grows to.
  const reach = phone && m.players.length ? Math.max(0, (hud.tap - 32) / 2) + 2 : 0;
  // The plate opens the level's dialog (theme, seed, difficulty); New Level beside it rolls a new one.
  const over = hud.button({ x: lx, y: 13, w: lw - refreshW - reach, h: 30, action: 'levelMenu' });
  plate(c, lx, 13, lw, 30, { rivets: false, ...(over ? { stroke: PAL.amber } : {}) });
  c.font = `800 ${TYPE.caption}px ${UI}`;
  const tw = tag(c, themeLabel, lx + 8, 28, PAL.hazard, PAL.ink, TYPE.caption);
  // The name stops short of the refresh button: smaller type first, then cut.
  const nameW = lw - 24 - tw - refreshW;
  fitText(hud, lv.name, lx + 16 + tw, 28.5, nameW, 14, 10, PAL.bone, DISPLAY, 400);
  if (m.players.length) {
    const device = me?.device ?? m.players[0].device;
    if (phone) hud.btn({ x: lx + lw - 38, y: 16, w: 32, h: 25, action: 'level', device }, '', 'ghost', 'refresh');
    else hud.btn({ x: lx + lw - 92, y: 17, w: 86, h: 23, action: 'level', device }, 'New Level', 'ghost', 'refresh');
  }
  done();
  done = hud.begin(barS, phone ? win.safeX1 - 8 - (VIEW_W - 12) * barS : 0, 0);
  if (phone) {
    hud.btn({ x: VIEW_W - 12 - 34 - bar.step, y: 13, w: 34, h: 30, action: 'rules' }, '', 'secondary', 'flag');
    hud.btn({ x: VIEW_W - 12 - 34, y: 13, w: 34, h: 30, action: 'settings' }, '', 'secondary', 'gear');
  } else {
    hud.btn({ x: VIEW_W - 196, y: 15, w: 84, h: 26, action: 'rules' }, 'Rules', 'secondary', 'flag');
    hud.btn({ x: VIEW_W - 104, y: 15, w: 92, h: 26, action: 'settings' }, 'Settings', 'secondary', 'gear');
  }
  done();

  // Player bays: joined players + open slots. Desktop shows at least 4, 4 to a row; phones at least 2, in whichever
  // grid lets the bays grow most. Everything a thumb can press stays inside its own bay.
  const netS = phone ? Math.min(hud.uiScale, MAX_FOOT_SCALE) : 1;
  const netY = phone ? win.y1 - hud.footH - PHONE_NET_H * netS : VIEW_H - FOOT_H - 40;
  // Phones keep the bays clear of the top bar's and the room panel's thumb-sized hit areas.
  const top = phone ? Math.max(46 * barS + 6, 28 * barS + tap / 2 + 4) : 60;
  const bottom = phone ? (hud.net ? Math.min(netY - 6, netY + 15 * netS - tap / 2 - 4) : win.y1 - hud.footH - 8) : VIEW_H - FOOT_H - (hud.net ? 46 : 12);
  const want = Math.max(phone ? 2 : 4, m.players.length + 1);
  const g = phone ? phoneGrid(Math.min(MAX_PLAYERS, want), safeW, bottom - top, hud.uiScale) : deskGrid(Math.min(MAX_PLAYERS, want));
  const { cols, rows, s: gs } = g;
  const shown = Math.min(MAX_PLAYERS, want, cols * rows);
  const gap = BAY_GAP;
  const bw = BAY_W;
  const gridW = cols * bw + (cols - 1) * gap;
  const bh = Math.min(250, ((bottom - top) / gs - gap * (rows - 1)) / rows);
  const gridH = rows * bh + (rows - 1) * gap;
  const y0 = phone ? 0 : top + (bottom - top - gridH) / 2;
  const x0 = (VIEW_W - gridW) / 2;
  const joinable = !me && !hud.net?.stranded;
  done = hud.begin(gs, phone ? (win.safeX0 + win.safeX1) / 2 - (VIEW_W / 2) * gs : 0, phone ? (top + bottom) / 2 - (gridH / 2) * gs : 0);
  for (let i = 0; i < shown; i++) {
    const x = x0 + (i % cols) * (bw + gap);
    const y = y0 + Math.floor(i / cols) * (bh + gap);
    const p = m.players[i];
    if (p) playerCard(hud, p, i, x, y, bw, bh, t);
    else {
      // No hover under a finger: the first open bay advertises the tap instead.
      const hover =
        (joinable && hud.button({ x, y, w: bw, h: bh, action: 'join', device: hud.mouseDevice })) ||
        (joinable && hud.mode === 'touch' && i === m.players.length);
      bay(c, x, y, bw, bh, hover, t);
      // The first open bay can take a bot instead of a person. Its hit area, a thumb tall on a phone, stays inside the bay.
      if (hud.canAddBots && i === m.players.length) {
        const reach = Math.max(24, hud.tap);
        const mid = Math.min(y + bh - (bh > 200 ? 28 : 20), y + bh - 2 - reach / 2);
        hud.btn({ x: x + bw / 2 - 44, y: mid - 12, w: 88, h: 24, action: 'bot' }, 'Add Bot', 'ghost', undefined, TYPE.label);
      }
      hud.text('OPEN', x + bw / 2, y + bh / 2 - (hover ? 8 : 4), bh > 200 ? 26 : 22, hover ? PAL.amber : PAL.dim, 'center', DISPLAY, 400);
      if (hover) {
        const gx = x + bw / 2 - 18;
        const glyph: Glyph = hud.mode === 'touch' ? { kind: 'touch' } : { kind: 'mouse', button: 'left' };
        drawGlyph(c, glyph, gx, y + bh / 2 + 16, 13);
        hud.text('Join', gx + 15, y + bh / 2 + 16.5, TYPE.label, PAL.bone, 'left', UI, 700);
      }
    }
  }
  done();
  if (hud.net && phone) {
    done = hud.begin(netS, win.safeX0 + 8, netY);
    // The touch overlay's fullscreen button floats in the bottom-right corner: the panel stops short of it.
    netPanel(hud, m, hud.net, 0, 0, (safeW - (hud.mode === 'touch' ? hud.gearW : 0)) / netS);
    done();
  } else if (hud.net) netPanel(hud, m, hud.net, x0, netY, gridW);
}

/**
 * The phone top bar's scale, plate width and the step between its two icon buttons. Each button's hit area is a
 * thumb wide even where the icon isn't, so on a narrow window the bar shrinks and the plate gives up width until
 * no two hit areas touch.
 */
function phoneBar(hud: Hud, safeW: number): { s: number; lw: number; step: number } {
  const tap = hud.tapMin;
  const win = hud.frame;
  let best = { s: 1, lw: 300, step: 40 };
  for (let s = Math.min(hud.uiScale, safeW / PHONE_BAR_W); s > 0.5; s -= 0.02) {
    const step = Math.max(40, (Math.max(34 * s, tap) + 2) / s);
    const left = win.safeX0 + 8 - 14 * s;
    const right = win.safeX1 - 8 - (VIEW_W - 12) * s;
    // Rules' hit area's left edge, and the widest plate whose refresh button stays clear of it.
    const rules = right + (VIEW_W - 12 - 17 - step) * s - Math.max(17 * s, tap / 2);
    const lw = Math.min(300, (rules - 2 - Math.max(16 * s, tap / 2) - left) / s - 140 + 22);
    best = { s, lw, step };
    if (lw >= 240) break;
  }
  return best;
}

interface Grid {
  cols: number;
  rows: number;
  s: number;
}

/** Desktop: four to a row. */
function deskGrid(n: number): Grid {
  return { cols: 4, rows: n > 4 ? 2 : 1, s: 1 };
}

/**
 * Phones: the grid that lets `n` bays grow most in the space given (view px), fewer rows on a tie. One row of
 * bays is tall enough for the big card; more rows need the small card's thumb-sized name and button row.
 */
function phoneGrid(n: number, w: number, h: number, maxS: number): Grid {
  let best: Grid | null = null;
  for (let cols = Math.min(4, n); cols >= 1; cols--) {
    const rows = Math.ceil(n / cols);
    const minH = rows === 1 ? MIN_BAY_H : MIN_SMALL_BAY_H;
    const s = Math.min(maxS, w / (cols * BAY_W + (cols - 1) * BAY_GAP), h / (rows * minH + (rows - 1) * BAY_GAP));
    if (!best || s > best.s * 1.01 || (s > best.s * 0.99 && rows < best.rows)) best = { cols, rows, s };
  }
  return { ...best!, s: Math.max(1, best!.s) };
}

/** Text that fits `maxW`: smaller type down to `min`, then cut with an ellipsis. */
function fitText(hud: Hud, s: string, x: number, y: number, maxW: number, size: number, min: number, color: string, font: string, weight: number) {
  const c = hud.ctx;
  c.font = `${weight} ${size}px ${font}`;
  const w = c.measureText(s).width;
  let k = size;
  if (w > maxW) k = Math.max(min, Math.floor(size * (maxW / w) * 2) / 2);
  c.font = `${weight} ${k}px ${font}`;
  let out = s;
  while (out.length > 1 && c.measureText(out).width > maxW) out = out.slice(0, -2) + '…';
  hud.text(out, x, y, k, color, 'left', font, weight);
}

/**
 * A seated player's bay, laid out from the bottom up: the status row (your buttons, or someone's status and a Kick),
 * then the name, then the character in whatever height is left. On a phone every button's hit area is a thumb, and
 * the name's is the whole bay above the row, so a short bay still fits both without one swallowing the other.
 */
function playerCard(hud: Hud, p: Player, i: number, x: number, y: number, w: number, h: number, t: number) {
  const c = hud.ctx;
  const col = p.character.body;
  const big = h > 200;
  const phone = hud.phone;
  const tap = hud.tap;
  const mine = p.device === hud.mouseDevice;
  // Any seat on this screen can be renamed from its card: a pad's own way in is its Run button (see the footer).
  const editable = hud.devices.isLocal?.(p.device) ?? true;
  const picked = hud.net?.kickSlot === p.slot;
  plate(c, x, y, w, h, { edge: css(col, 5), stroke: picked ? PAL.danger : p.ready ? PAL.toxic : undefined, seed: p.slot });
  // Status row, held inside the bay with its hit area.
  const bh = (big ? 25 : 22) + (phone ? 8 : 0);
  const reach = Math.max(bh, tap);
  const mid = Math.min(y + h - (big ? 34 : 28) - (phone ? 8 : 0) + bh / 2, y + h - 2 - reach / 2);
  const by = mid - bh / 2;
  const rowTop = mid - reach / 2;

  // Name, with the swatch and pencil on a seat played here. Its type shrinks to fit the bay before anything overlaps.
  const extra = editable ? 30 : 0;
  let nsize = big ? 17 : 14;
  c.font = `400 ${nsize}px ${DISPLAY}`;
  let nw = c.measureText(p.character.name).width;
  if (nw + extra > w - 20) {
    nsize = Math.max(10, (nsize * (w - 20 - extra)) / nw);
    c.font = `400 ${nsize}px ${DISPLAY}`;
    nw = c.measureText(p.character.name).width;
  }
  const cx = x + w / 2;
  const feetWant = y + (big ? h * 0.6 : h * 0.56);
  const ny = Math.min(feetWant + (big ? 22 : 17), rowTop - nsize * 0.6 - (phone ? 2 : 3));
  const feet = Math.min(feetWant, ny - (big ? 22 : 15));
  // A phone's name target is the bay above the row, a thumb tall at least (it reaches up past the bay's top if it must).
  const nameRect = phone
    ? { x: x + 4, y: Math.min(y + 2, rowTop - 1 - tap), w: w - 8, h: Math.max(rowTop - 1 - (y + 2), tap) }
    : { x: cx - nw / 2 - 20, y: ny - (nsize + 4) / 2, w: nw + 34, h: nsize + 4 };
  const nameHover = editable && hud.button({ ...nameRect, action: 'name', device: p.device });

  // Character on a slag pedestal, as big as the space between the header and the name allows. A squeezed bay gives
  // it the header's middle too: the host's tag or the ping moves beside the player number.
  const want = big ? 4.1 : h > 150 ? 2.95 : 2.5;
  const squeezed = (feet - (y + 22)) / CHAR_H < want;
  const scale = Math.max(1.4, Math.min(want, (feet - (y + (squeezed ? 5 : 22))) / CHAR_H));
  const pr = big ? 34 : 26 * Math.min(1, scale / 2.5);
  c.fillStyle = PAL.ink;
  blob(c, cx + 0.5, feet + 3, pr, p.slot + 11, (big ? 7 : 5) / pr, 0.05);
  c.fill();
  c.fillStyle = '#3a2a22';
  blob(c, cx - 0.5, feet + 1.2, pr - 2.5, p.slot + 12, (big ? 5.5 : 4) / (pr - 2.5), 0.05);
  c.fill();
  glowDot(hud.gctx, cx, feet + 3, big ? 34 : 24, { h: 22, s: 100, l: 50 }, 0.35, 0.2);
  drawInkRunner({ s: c, g: hud.gctx }, p.character, cx, feet, {
    facing: Math.sin(t * 0.8 + i) > 0 ? 1 : -1,
    vx: 0,
    vy: 0,
    grounded: true,
    t,
    scale,
    celebrate: p.ready,
  });
  // Header, over the character: player number, the host's tag or a remote player's ping, and the device.
  const peer = hud.net?.peers.find((q) => q.name === p.character.name);
  c.font = `400 15px ${DISPLAY}`;
  const hx = squeezed ? x + 16 + c.measureText(`P${p.slot + 1}`).width : x + w / 2;
  const align = squeezed ? 'left' : 'center';
  if (hud.net?.hostSlot === p.slot) tag(c, 'HOST', hx, y + 17.5, PAL.amber, PAL.ink, TYPE.caption, align);
  else if (p.away) icon(c, 'unplugged', hx + (squeezed ? 6 : 0), y + 17.5, 10, PAL.danger);
  else if (peer && !peer.local && !peer.isHost && peer.pingMs !== undefined) ping(hud, peer.pingMs, hx, y + 17.5, align);
  hud.text(`P${p.slot + 1}`, x + 10, y + 17, 15, css(col, 22), 'left', DISPLAY, 400, 3);
  const pad = p.device.includes('pad');
  const label = hud.devices.deviceLabel(p.device);
  c.font = `600 ${TYPE.caption}px ${UI}`;
  const lw = c.measureText(label).width;
  hud.text(label, x + w - 10, y + 17.5, TYPE.caption, PAL.ash, 'right', UI, 600);
  if (p.device.endsWith('touch')) drawGlyph(c, { kind: 'touch' }, x + w - 24 - lw, y + 17.5, 11);
  else if (!isBotDevice(p.device)) icon(c, pad ? 'gamepad' : 'keyboard', x + w - 18 - lw, y + 17.5, 9, PAL.ash);
  hud.text(p.character.name, cx, ny, nsize, nameHover ? PAL.amber : PAL.bone, 'center', DISPLAY, 400, 3.5);
  if (editable) {
    icon(c, 'pencil', cx + nw / 2 + 8, ny, 8, nameHover ? PAL.amber : PAL.dim);
    swatchDot(c, cx - nw / 2 - 9, ny, big ? 4.6 : 4, css(col), nameHover);
  }

  // The row. Small buttons sit at the right end, each as far from the next as their hit areas need.
  const sw = phone ? 30 : 26;
  const reachW = Math.max(sw, tap);
  const slot = (k: number) => x + w - Math.max(10 + sw / 2, 2 + reachW / 2) - k * Math.max(sw + 4, reachW + 1);
  const leftOf = (k: number) => slot(k) - Math.max(sw / 2 + 4, reachW / 2 + 1);
  if (mine) {
    // Online, your own bay can give up its seat to watch: beside the dice, never in the way of Ready. A bay too
    // narrow for both leaves Watch to the Settings menu, which always has it.
    let watch = !!hud.net && !hud.net.offline;
    if (watch && phone && leftOf(1) - (x + 10) < 76) watch = false;
    const readyW = leftOf(watch ? 1 : 0) - (x + 10);
    hud.btn(
      { x: x + 10, y: by, w: readyW, h: bh, action: 'ready', device: p.device },
      p.ready ? 'Ready!' : 'Ready Up',
      p.ready ? 'ready' : 'primary',
      p.ready ? 'check' : undefined,
      TYPE.label,
    );
    if (watch) hud.btn({ x: slot(1) - sw / 2, y: by, w: sw, h: bh, action: 'watch', device: p.device }, '', 'secondary', 'eye');
    hud.btn({ x: slot(0) - sw / 2, y: by, w: sw, h: bh, action: 'look', device: p.device }, '', 'secondary', 'dice');
    return;
  }
  if (hud.ownsBot(p.device)) {
    // A bot you run: its level (a click for the next) and Remove at the right end. It readies itself, and its edge says so.
    const rw = 60;
    const rx = x + w - Math.max(10 + rw / 2, 2 + Math.max(rw, tap) / 2);
    const levelW = rx - Math.max(rw, tap) / 2 - 4 - (x + 10);
    hud.btn({ x: x + 10, y: by, w: levelW, h: bh, action: 'botLevel', device: p.device }, botLevelLabel(p.bot ?? 'normal'), 'secondary', undefined, TYPE.label);
    hud.btn({ x: rx - rw / 2, y: by, w: rw, h: bh, action: 'unbot', device: p.device }, 'Remove', 'ghost', undefined, TYPE.label);
    return;
  }
  // Someone else's: their status, and the host's Kick at the right end.
  const kickable = !!hud.net?.kickable?.includes(p.slot);
  const kw = 44;
  const kx = x + w - Math.max(10 + kw / 2, 2 + Math.max(kw, tap) / 2);
  const sx = kickable ? (x + 10 + kx - Math.max(kw, tap) / 2) / 2 : cx;
  if (p.afk) tag(c, 'AFK', sx, mid - 1, PAL.steel, PAL.bone, TYPE.label, 'center');
  else if (p.ready) tag(c, 'READY', sx, mid - 1, PAL.toxic, PAL.ink, TYPE.label, 'center');
  else hud.text('Not Ready', sx, mid - 1, TYPE.body, PAL.dim, 'center', UI, 600);
  if (kickable) hud.btn({ x: kx - kw / 2, y: by, w: kw, h: bh, action: 'kick', device: p.device }, 'Kick', picked ? 'primary' : 'ghost', undefined, TYPE.label);
}

function netPanel(hud: Hud, m: Match, net: NetInfo, x: number, y: number, w: number) {
  const c = hud.ctx;
  const h = 30;
  plate(c, x, y, w, h, { rivets: false });
  const tw = tag(c, net.offline ? 'OFFLINE' : 'ONLINE', x + 8, y + h / 2, net.offline ? PAL.dim : PAL.toxic, PAL.ink, TYPE.caption);
  // Who's playing is on the cards (each remote player's ping in its header), so this is the room itself and who's watching.
  hud.text(net.status, x + 16 + tw, y + h / 2, TYPE.body, PAL.ash, 'left', UI, 600);
  c.font = `600 ${TYPE.body}px ${UI}`;
  const sx = x + 28 + tw + c.measureText(net.status).width;
  // Watching: Join takes the panel's end, the invite moves over.
  const join = net.seat === 'watching' && !net.arrival;
  const ix = x + w - 130 - (join ? 104 : 0);
  const ex = net.inviteUrl ? ix - 8 : x + w - (join ? 112 : 8);
  if (net.inviteUrl) hud.btn({ x: ix, y: y + 4, w: 124, h: 23, action: 'invite' }, 'Copy Invite Link', join ? 'secondary' : 'primary', 'copy');
  if (join) joinButton(hud, m, { x: x + w - 102, y: y + 3, w: 96, h: 26 }, TYPE.label + 1);
  watcherChips(hud, net.watchers ?? [], sx, ex, y + h / 2);
}

/** Who's watching: an eye and a name each, left to right in join order, with "+N" for whoever doesn't fit. */
function watcherChips(hud: Hud, list: NetWatcher[], x0: number, x1: number, cy: number) {
  const c = hud.ctx;
  let x = x0;
  for (let i = 0; i < list.length; i++) {
    const wv = list[i];
    const name = wv.name;
    c.font = `700 ${TYPE.caption}px ${UI}`;
    const nw = name ? c.measureText(name).width + 4 : 0;
    const aw = wv.afk ? c.measureText('AFK').width + 8 : 0;
    const kw = wv.kickable ? 16 : 0;
    const w = 18 + nw + aw + kw;
    const rest = list.length - i - 1;
    if (x + w > x1 - (rest ? 22 : 0)) {
      hud.text(`+${list.length - i}`, x + 2, cy, TYPE.caption, PAL.ash, 'left', UI, 800);
      return;
    }
    plate(c, x, cy - 9, w, 18, { rivets: false, stroke: wv.self ? PAL.amber : undefined, seed: 30 + i });
    icon(c, 'eye', x + 9, cy, 8, wv.self ? PAL.amber : PAL.ash);
    if (name) hud.text(name, x + 16, cy + 0.5, TYPE.caption, PAL.bone, 'left', UI, 700);
    if (wv.afk) tag(c, 'AFK', x + 16 + nw, cy, PAL.steel, PAL.bone, TYPE.caption);
    if (wv.kickable) {
      const kx = x + w - 15;
      const hot = hud.button({ x: kx, y: cy - 8, w: 14, h: 16, action: 'kick', device: `${wv.peer}:watch` });
      hud.text('×', kx + 7, cy, TYPE.label, hot ? PAL.danger : PAL.dim, 'center', UI, 800);
    }
    x += w + 5;
  }
}

/** A remote player's link: three bars colored by quality, and the round trip in ms, centered on `x` or starting there. */
function ping(hud: Hud, ms: number, x0: number, cy: number, align: 'center' | 'left' = 'center') {
  const c = hud.ctx;
  const q = ms < 80 ? 3 : ms < 160 ? 2 : 1;
  const colr = q === 3 ? PAL.toxic : q === 2 ? PAL.amber : PAL.danger;
  const label = `${Math.round(ms)}`;
  c.font = `600 ${TYPE.caption}px ${UI}`;
  const x = align === 'left' ? x0 : x0 - (11 + c.measureText(label).width) / 2;
  for (let b = 0; b < 3; b++) {
    const bh = (b + 1) * 2.4;
    c.fillStyle = PAL.ink;
    c.fillRect(x + b * 3 - 0.5, cy + 3 - bh - 0.5, 3, bh + 1.5);
    c.fillStyle = b < q ? colr : 'rgba(255,255,255,0.15)';
    c.fillRect(x + b * 3, cy + 3 - bh, 2, bh);
  }
  hud.text(label, x + 11, cy + 0.5, TYPE.caption, PAL.ash, 'left', UI, 600);
}
