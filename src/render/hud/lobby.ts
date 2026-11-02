import { css } from '../../core/color';
import type { Match, Player } from '../../game/match';
import { MAX_PLAYERS, VIEW_H, VIEW_W } from '../../sim/constants';
import { THEME_LABELS } from '../../themes';
import { drawGlyph, type Glyph } from '../../ui/glyphs';
import { PAL, TYPE } from '../../ui/style';
import { drawInkRunner } from '../ink-character';
import { bay, icon, plate, tag } from '../hud-kit';
import { blob } from '../ink';
import { glowDot } from '../kit';
import type { Hud, NetInfo } from '../hud';
import { DISPLAY, UI, FOOT_H, MAX_FOOT_SCALE, MIN_BAY_H, PHONE_BAR_W } from './layout';

/** The lobby: top bar, player bays and the online panel. */

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
  const barS = phone ? Math.min(hud.uiScale, safeW / PHONE_BAR_W) : 1;
  let done = hud.begin(barS, phone ? win.safeX0 + 8 - 14 * barS : 0, 0);
  hud.logo(64, 30, 38);
  const me = m.players.find((p) => p.device === hud.mouseDevice);
  const lv = m.level.theme;
  const themeLabel = THEME_LABELS[lv.id].toUpperCase();
  const lx = 140;
  const lw = phone ? 300 : 360;
  plate(c, lx, 13, lw, 30, { rivets: false });
  c.font = `800 ${TYPE.caption}px ${UI}`;
  const tw = tag(c, themeLabel, lx + 8, 28, PAL.hazard, PAL.ink, TYPE.caption);
  hud.text(lv.name, lx + 16 + tw, 28.5, 14, PAL.bone, 'left', DISPLAY, 400);
  if (m.players.length) {
    const device = me?.device ?? m.players[0].device;
    if (phone) hud.btn({ x: lx + lw - 38, y: 16, w: 32, h: 25, action: 'level', device }, '', 'ghost', 'refresh');
    else hud.btn({ x: lx + lw - 92, y: 17, w: 86, h: 23, action: 'level', device }, 'New Level', 'ghost', 'refresh');
  }
  done();
  done = hud.begin(barS, phone ? win.safeX1 - 8 - (VIEW_W - 12) * barS : 0, 0);
  if (phone) {
    hud.btn({ x: VIEW_W - 12 - 74, y: 13, w: 34, h: 30, action: 'rules' }, '', 'secondary', 'flag');
    hud.btn({ x: VIEW_W - 12 - 34, y: 13, w: 34, h: 30, action: 'settings' }, '', 'secondary', 'gear');
  } else {
    hud.btn({ x: VIEW_W - 196, y: 15, w: 84, h: 26, action: 'rules' }, 'Rules', 'secondary', 'flag');
    hud.btn({ x: VIEW_W - 104, y: 15, w: 92, h: 26, action: 'settings' }, 'Settings', 'secondary', 'gear');
  }
  done();

  // Player bays: joined players + open slots (min 4 shown, 4 per row). Phones show fewer, so each can be bigger.
  const shown = Math.min(MAX_PLAYERS, Math.max(phone ? 2 : 4, m.players.length + 1));
  const rows = shown > 4 ? 2 : 1;
  const cols = phone ? Math.min(4, shown) : 4;
  const gap = 10;
  const bw = 174;
  const netS = phone ? Math.min(hud.uiScale, MAX_FOOT_SCALE) : 1;
  const top = phone ? 46 * barS + 6 : 60;
  const bottom = phone ? win.y1 - hud.footH - (hud.net ? 36 * netS + 6 : 8) : VIEW_H - FOOT_H - (hud.net ? 46 : 12);
  const gridW = cols * bw + (cols - 1) * gap;
  const gs = phone ? Math.max(1, Math.min(hud.uiScale, safeW / gridW, (bottom - top - gap * (rows - 1)) / rows / (rows === 1 ? MIN_BAY_H : MIN_BAY_H / 2))) : 1;
  const bh = Math.min(rows === 1 ? 250 : 999, ((bottom - top) / gs - gap * (rows - 1)) / rows);
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
      hud.text('OPEN', x + bw / 2, y + bh / 2 - (hover ? 8 : 4), rows === 1 ? 26 : 22, hover ? PAL.amber : PAL.dim, 'center', DISPLAY, 400);
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
    done = hud.begin(netS, win.safeX0 + 8, win.y1 - hud.footH - 36 * netS);
    netPanel(hud, hud.net, 0, 0, safeW / netS);
    done();
  } else if (hud.net) netPanel(hud, hud.net, x0, VIEW_H - FOOT_H - 40, gridW);
}

function playerCard(hud: Hud, p: Player, i: number, x: number, y: number, w: number, h: number, t: number) {
  const c = hud.ctx;
  const col = p.character.body;
  const big = h > 200;
  const mine = p.device === hud.mouseDevice;
  const picked = hud.net?.kickSlot === p.slot;
  plate(c, x, y, w, h, { edge: css(col, 5), stroke: picked ? PAL.danger : p.ready ? PAL.toxic : undefined, seed: p.slot });
  // Header: player number, the host's tag or a remote player's ping, and the device.
  const peer = hud.net?.peers.find((q) => q.name === p.character.name);
  if (hud.net?.hostSlot === p.slot) tag(c, 'HOST', x + w / 2, y + 17.5, PAL.amber, PAL.ink, TYPE.caption, 'center');
  else if (peer && !peer.local && !peer.isHost && peer.pingMs !== undefined) ping(hud, peer.pingMs, x + w / 2, y + 17.5);
  hud.text(`P${p.slot + 1}`, x + 10, y + 17, 15, css(col, 22), 'left', DISPLAY, 400, 3);
  const pad = p.device.startsWith('pad');
  const label = hud.devices.deviceLabel(p.device);
  c.font = `600 ${TYPE.caption}px ${UI}`;
  const lw = c.measureText(label).width;
  hud.text(label, x + w - 10, y + 17.5, TYPE.caption, PAL.ash, 'right', UI, 600);
  if (p.device.endsWith('touch')) drawGlyph(c, { kind: 'touch' }, x + w - 24 - lw, y + 17.5, 11);
  else icon(c, pad ? 'gamepad' : 'keyboard', x + w - 18 - lw, y + 17.5, 9, PAL.ash);
  // Character on a slag pedestal.
  const cx = x + w / 2;
  const feet = y + (big ? h * 0.6 : h * 0.56);
  // A slag pedestal, cut by hand.
  const pr = big ? 34 : 26;
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
    scale: big ? 4.1 : h > 150 ? 2.95 : 2.5,
    celebrate: p.ready,
  });
  // Name (click to rename for the mouse player).
  const ny = feet + (big ? 22 : 17);
  const nsize = big ? 17 : 14;
  c.font = `400 ${nsize}px ${DISPLAY}`;
  const nw = c.measureText(p.character.name).width;
  const nh = hud.mode === 'touch' ? 26 : nsize + 4;
  const nameHover = mine && hud.button({ x: cx - nw / 2 - 14, y: ny - nh / 2, w: nw + 28, h: nh, action: 'name', device: p.device });
  hud.text(p.character.name, cx, ny, nsize, nameHover ? PAL.amber : PAL.bone, 'center', DISPLAY, 400, 3.5);
  if (mine) icon(c, 'pencil', cx + nw / 2 + 8, ny, 8, nameHover ? PAL.amber : PAL.dim);
  // Status row.
  const tall = hud.phone ? 8 : 0;
  const by = y + h - (big ? 34 : 28) - tall;
  const bh = (big ? 25 : 22) + tall;
  if (mine) {
    hud.btn(
      { x: x + 10, y: by, w: w - 50, h: bh, action: 'ready', device: p.device },
      p.ready ? 'Ready!' : 'Ready Up',
      p.ready ? 'ready' : 'primary',
      p.ready ? 'check' : undefined,
      TYPE.label,
    );
    hud.btn({ x: x + w - 36, y: by, w: 26, h: bh, action: 'look', device: p.device }, '', 'secondary', 'dice');
  } else if (p.ready) {
    tag(c, 'READY', cx, by + bh / 2 - 1, PAL.toxic, PAL.ink, TYPE.label, 'center');
  } else hud.text('Not Ready', cx, by + bh / 2 - 1, TYPE.body, PAL.dim, 'center', UI, 600);
  if (hud.net?.kickable?.includes(p.slot))
    hud.btn({ x: x + w - 54, y: by, w: 44, h: bh, action: 'kick', device: p.device }, 'Kick', picked ? 'primary' : 'ghost', undefined, TYPE.label);
}

function netPanel(hud: Hud, net: NetInfo, x: number, y: number, w: number) {
  const c = hud.ctx;
  const h = 30;
  plate(c, x, y, w, h, { rivets: false });
  const tw = tag(c, net.offline ? 'OFFLINE' : 'ONLINE', x + 8, y + h / 2, net.offline ? PAL.dim : PAL.toxic, PAL.ink, TYPE.caption);
  // Who's here is on the cards (each remote player's ping in its header), so this is only the room itself.
  hud.text(net.status, x + 16 + tw, y + h / 2, TYPE.body, PAL.ash, 'left', UI, 600);
  if (net.inviteUrl) hud.btn({ x: x + w - 130, y: y + 4, w: 124, h: 23, action: 'invite' }, 'Copy Invite Link', 'primary', 'copy');
}

/** A remote player's link: three bars colored by quality, and the round trip in ms. */
function ping(hud: Hud, ms: number, cx: number, cy: number) {
  const c = hud.ctx;
  const q = ms < 80 ? 3 : ms < 160 ? 2 : 1;
  const colr = q === 3 ? PAL.toxic : q === 2 ? PAL.amber : PAL.danger;
  const label = `${Math.round(ms)}`;
  c.font = `600 ${TYPE.caption}px ${UI}`;
  const x = cx - (11 + c.measureText(label).width) / 2;
  for (let b = 0; b < 3; b++) {
    const bh = (b + 1) * 2.4;
    c.fillStyle = PAL.ink;
    c.fillRect(x + b * 3 - 0.5, cy + 3 - bh - 0.5, 3, bh + 1.5);
    c.fillStyle = b < q ? colr : 'rgba(255,255,255,0.15)';
    c.fillRect(x + b * 3, cy + 3 - bh, 2, bh);
  }
  hud.text(label, x + 11, cy + 0.5, TYPE.caption, PAL.ash, 'left', UI, 600);
}
