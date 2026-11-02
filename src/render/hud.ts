import { css, type HSL } from '../core/color';
import { propTag } from '../codex/describe';
import type { Match, Player } from '../game/match';
import type { Role } from '../gen/props';
import { type InputSettings, type KeyProfile, keyboardDevices } from '../input/bindings';
import { MAX_PLAYERS, RUN_COUNTDOWN, VIEW_H, VIEW_W } from '../sim/constants';
import { THEME_LABELS } from '../themes';
import { drawGlyph, type Glyph, glyphWidth } from '../ui/glyphs';
import { glyphsFor, type InputMode, type PromptAction, promptModes } from '../ui/prompts';
import { FONT, PAL, TYPE } from '../ui/style';
import { ITEMS } from '../sim/items';
import { drawCharacter } from './character';
import { bay, buttonText, type ButtonStyle, hazardTape, icon, type IconName, plate, stampButton, standings, tag } from './hud-kit';
import { VIEW_FRAME, type ViewFrame } from './frame';
import { drawItemIcon } from './items';
import { circle, glowDot, type RC, rrect } from './kit';
import { drawPreview } from './props';

/**
 * Screen-space UI on its own canvas (logical 768×432, scaled), in the
 * foundry style described in docs/ART.md. Every phase gets a footer prompt
 * bar with glyphs for the active input family; the lobby is the only screen
 * with real clickable buttons (plus a few footer prompts).
 */

const DISPLAY = FONT.display;
const UI = FONT.ui;

const roundLabel = (m: Match) => `ROUND ${m.round}/${m.rules.maxRounds}`;

export type HudAction = 'join' | 'ready' | 'look' | 'name' | 'level' | 'settings' | 'rules' | 'invite' | 'continue';

export interface HudButton {
  x: number;
  y: number;
  w: number;
  h: number;
  action: HudAction;
  device?: string;
}

export interface DeviceInfo {
  deviceLabel(device: string): string;
  hints(device: string): { confirm: string; alt: string; jump: string; down: string };
  /** Live key bindings (InputManager has this), so prompts show remapped keys as keycaps. */
  settings?: InputSettings;
}

/** A connected peer in an online lobby (provided by the net layer). */
export interface NetPeer {
  name: string;
  isHost: boolean;
  pingMs?: number;
  local: boolean;
}

/** Online-lobby status for the HUD. Absent = local play. */
export interface NetInfo {
  peers: NetPeer[];
  status: string;
  inviteUrl?: string;
  /** The room is unreachable and play is local. */
  offline?: boolean;
}

interface FooterItem {
  action: PromptAction;
  label: string;
  /** Touch: the on-screen button this action lives on (its label, e.g. 'PLACE'). */
  touchButton?: string;
  /** Only shown in touch mode. */
  touchOnly?: boolean;
  hud?: HudAction;
  device?: string;
  mouse?: boolean;
}

const ROLE: Record<Role, { label: string; color: HSL }> = {
  build: { label: 'BUILD', color: { h: 95, s: 60, l: 48 } },
  hazard: { label: 'HAZARD', color: { h: 358, s: 78, l: 54 } },
  utility: { label: 'UTILITY', color: { h: 198, s: 75, l: 52 } },
  demolish: { label: 'DEMOLISH', color: { h: 28, s: 95, l: 52 } },
};

const AWARD: Record<string, { label: string; color: HSL }> = {
  finish: { label: 'Finish', color: { h: 95, s: 60, l: 40 } },
  first: { label: 'First', color: { h: 42, s: 95, l: 48 } },
  trap: { label: 'Trap', color: { h: 358, s: 75, l: 50 } },
};

const FOOT_H = 22;

/** Screen-space UI on its own canvas (logical 768×432, scaled). */
export class Hud {
  private glow: HTMLCanvasElement = document.createElement('canvas');
  private gctx = this.glow.getContext('2d')!;
  private wipe = 0;
  private lastPhase = '';
  private lastT = 0;
  private embers: { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }[] = [];
  private toastMsg = '';
  /** Draws deferred until after the footer (player cursors). */
  private pending: (() => void)[] = [];
  private toastUntil = 0;

  /** Device labels/hints from the live key bindings (set by main). */
  devices: DeviceInfo = {
    deviceLabel: (d) => d,
    hints: () => ({ confirm: 'Confirm', alt: 'Alt', jump: 'Jump', down: 'Down' }),
  };
  /** Hide all UI (?ui=0): for screenshots / level review. */
  hidden = false;
  /** Lobby/room code shown in the lobby (the URL is /r/<room>). */
  room = '';
  /** Device the mouse controls (gets name/settings buttons). */
  mouseDevice = 'kb1';
  /** Latest pointer position in view coords, for hover highlights. */
  pointer: { x: number; y: number } | null = null;
  /** Online lobby info (peers, status, invite link); set by the net layer when connected. */
  net?: NetInfo;
  /** Online pick: the card this peer clicked and the host hasn't ruled on yet. Not a claim. */
  pendingCard = -1;
  /** Force the prompt glyph family (e.g. the touch layer sets 'touch'). Otherwise `lastInput` is used. */
  inputMode?: InputMode;
  /** Last input family the person used (tracked by game-client). */
  lastInput: InputMode = 'keyboard';
  /** Connected gamepads (for showing pad glyphs next to keys). */
  padCount = 0;
  /** Clickable regions from the last frame (lobby buttons). */
  private buttons: HudButton[] = [];
  private frame: ViewFrame = VIEW_FRAME;

  constructor(private ctx: CanvasRenderingContext2D) {}

  clear(pw: number, ph: number) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, pw, ph);
    this.buttons = [];
  }

  /** Topmost clickable region at (x, y) in view coords. */
  hit(x: number, y: number): HudButton | null {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
  }

  /** Show a short confirmation message (e.g. "Invite Link Copied"). */
  toast(msg: string, ms = 1800) {
    this.toastMsg = msg;
    this.toastUntil = performance.now() + ms;
  }

  private get mode(): InputMode {
    return this.inputMode ?? (this.mouseDevice.endsWith('touch') ? 'touch' : this.lastInput);
  }

  private button(b: HudButton) {
    this.buttons.push(b);
    return this.pointer !== null && this.pointer.x >= b.x && this.pointer.x < b.x + b.w && this.pointer.y >= b.y && this.pointer.y < b.y + b.h;
  }

  /** Stamped button with optional icon. */
  private btn(b: HudButton, label: string, style: ButtonStyle = 'secondary', ico?: IconName, size: number = TYPE.body) {
    const hover = this.button(b);
    const c = this.ctx;
    const sink = stampButton(c, b.x, b.y, b.w, b.h - 3, style, hover);
    const ink = buttonText(style);
    const cy = b.y + (b.h - 3) / 2 + sink;
    if (!label && ico) {
      icon(c, ico, b.x + b.w / 2, cy, Math.min(11, b.h * 0.55), ink);
      return;
    }
    c.font = `700 ${size}px ${UI}`;
    const tw = c.measureText(label).width;
    const iw = ico ? size + 3 : 0;
    const x0 = b.x + (b.w - tw - iw) / 2;
    if (ico) icon(c, ico, x0 + size / 2, cy, size, ink);
    this.text(label, x0 + iw, cy + 0.5, size, ink, 'left', UI, 700, 0, true);
  }

  resize(w: number, h: number) {
    this.glow.width = w;
    this.glow.height = h;
  }

  /** Text with a hard 1px ink shadow (or a thick ink outline when `stroke` > 0). */
  private text(
    s: string,
    x: number,
    y: number,
    size: number,
    color: string = PAL.bone,
    align: CanvasTextAlign = 'center',
    font: string = UI,
    weight = 600,
    stroke = 0,
    flat = false,
  ) {
    const c = this.ctx;
    c.font = `${weight} ${size}px ${font}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    if (stroke) {
      c.lineJoin = 'round';
      c.lineWidth = stroke;
      c.strokeStyle = PAL.ink;
      c.strokeText(s, x, y);
    } else if (!flat) {
      c.fillStyle = 'rgba(10,5,3,0.85)';
      c.fillText(s, x, y + 1);
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  /** The window, in view coords: the HUD lays out in the play view, and full-screen washes fill this. */
  setFrame(f: ViewFrame) {
    this.frame = f;
  }

  /** Wash the whole window, not just the play view, with the current fill. */
  private wash() {
    const f = this.frame;
    this.ctx.fillRect(f.x0, f.y0, f.w, f.h);
  }

  draw(m: Match, t: number, pw: number, ph: number) {
    this.buttons = [];
    const c = this.ctx;
    const f = this.frame;
    const k = pw / f.w;
    const ox = -f.x0 * k;
    const oy = -f.y0 * k;
    const dt = this.lastT ? Math.min(0.1, t - this.lastT) : 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pw, ph);
    this.gctx.setTransform(1, 0, 0, 1, 0, 0);
    this.gctx.clearRect(0, 0, pw, ph);
    c.setTransform(k, 0, 0, k, ox, oy);
    this.gctx.setTransform(k, 0, 0, k, ox, oy);
    if (m.phase !== this.lastPhase) {
      // No shutter on the very first frame (page load), only on phase changes.
      if (this.lastPhase) this.wipe = 1;
      this.lastPhase = m.phase;
    }
    switch (m.phase) {
      case 'lobby':
        this.lobby(m, t, dt);
        break;
      case 'pick':
        this.pick(m, t);
        break;
      case 'place':
        this.place(m);
        break;
      case 'run':
        this.run(m, t);
        break;
      case 'score':
        this.score(m, t);
        break;
      case 'victory':
        this.victory(m, t);
        break;
    }
    this.footer(m);
    // Cursors stay on top of the footer so their labels are never covered.
    for (const f of this.pending) f();
    this.pending = [];
    this.drawToast();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(this.glow, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.setTransform(k, 0, 0, k, ox, oy);
    if (this.wipe > 0 && this.lastT) {
      // Diagonal shutter wipe on phase change: an iron door with a molten edge.
      const p = 1 - this.wipe;
      c.fillStyle = PAL.soot;
      c.beginPath();
      // The door sweeps the whole window, keeping its slant (100 px over VIEW_H) at any height.
      const lean = (100 * f.h) / VIEW_H;
      const x = f.x0 - 200 - lean + p * (f.w + 400 + lean);
      c.moveTo(x, f.y0);
      c.lineTo(x + lean + 40, f.y0);
      c.lineTo(x + 40, f.y1);
      c.lineTo(x - lean, f.y1);
      c.fill();
      c.fillStyle = PAL.molten;
      c.beginPath();
      c.moveTo(x + lean + 40, f.y0);
      c.lineTo(x + lean + 46, f.y0);
      c.lineTo(x + 46, f.y1);
      c.lineTo(x + 40, f.y1);
      c.fill();
      this.wipe -= (t - this.lastT) * 2.6;
    }
    this.lastT = t;
  }

  private rc(): RC {
    return { s: this.ctx, g: this.gctx, lights: null, t: 0, frame: 0 };
  }

  private logo(x: number, y: number, size: number, t: number) {
    const c = this.ctx;
    c.font = `400 ${size}px ${DISPLAY}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.18;
    c.strokeStyle = PAL.ink;
    c.strokeText('SLAG', x, y);
    const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, PAL.whiteHot);
    g.addColorStop(0.35, PAL.amber);
    g.addColorStop(0.7, PAL.molten);
    g.addColorStop(1, PAL.ember);
    c.fillStyle = g;
    c.fillText('SLAG', x, y);
    // Molten drips.
    const w = c.measureText('SLAG').width;
    const k = size / 64;
    for (let i = 0; i < 6; i++) {
      const dx = x - w / 2 + 8 * k + (i / 5) * (w - 16 * k);
      const len = (6 + ((Math.sin(t * 0.9 + i * 2.3) + 1) / 2) * 10 + (i % 3) * 3) * k;
      const dy = y + size * 0.3;
      c.fillStyle = PAL.ember;
      rrect(c, dx - 2.2 * k, dy - 4 * k, 4.4 * k, len, 2.2 * k);
      c.fill();
      c.fillStyle = PAL.molten;
      circle(c, dx, dy + len - 3 * k, 2.6 * k);
    }
    glowDot(this.gctx, x, y, size * 1.2, { h: 25, s: 100, l: 55 }, 0.22 + Math.sin(t * 2) * 0.04, 0.3);
  }

  /** Rising embers from the bottom of the screen (lobby ambience). */
  private stepEmbers(dt: number) {
    const g = this.gctx;
    if (this.embers.length < 46 && Math.random() < dt * 30) {
      const max = 2.5 + Math.random() * 3;
      this.embers.push({
        x: Math.random() * VIEW_W,
        y: VIEW_H + 4,
        vx: (Math.random() - 0.5) * 14,
        vy: -18 - Math.random() * 30,
        life: max,
        max,
        r: 0.6 + Math.random() * 1.2,
      });
    }
    for (const e of this.embers) {
      e.life -= dt;
      e.x += (e.vx + Math.sin(e.life * 3 + e.r * 9) * 8) * dt;
      e.y += e.vy * dt;
      const a = Math.min(1, e.life / e.max) * 0.9;
      g.fillStyle = `rgba(255,${140 + Math.round(a * 80)},60,${a})`;
      g.beginPath();
      g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      g.fill();
    }
    this.embers = this.embers.filter((e) => e.life > 0);
  }

  // ------------------------------------------------------------------ lobby

  private lobby(m: Match, t: number, dt: number) {
    const c = this.ctx;
    const vg = c.createLinearGradient(0, 0, 0, VIEW_H);
    vg.addColorStop(0, 'rgba(18,10,7,0.78)');
    vg.addColorStop(0.3, 'rgba(18,10,7,0.35)');
    vg.addColorStop(0.75, 'rgba(18,10,7,0.45)');
    vg.addColorStop(1, 'rgba(40,12,4,0.85)');
    c.fillStyle = vg;
    this.wash();
    glowDot(this.gctx, VIEW_W / 2, VIEW_H + 60, 330, { h: 18, s: 100, l: 45 }, 0.22, 0.2);
    this.stepEmbers(dt);

    // Top bar: logo · level plate · menu buttons.
    this.logo(64, 30, 38, t);
    const me = m.players.find((p) => p.device === this.mouseDevice);
    const lv = m.level.theme;
    const themeLabel = THEME_LABELS[lv.id].toUpperCase();
    const lx = 140;
    const lw = 360;
    plate(c, lx, 13, lw, 30, { rivets: false });
    c.font = `800 ${TYPE.caption}px ${UI}`;
    const tw = tag(c, themeLabel, lx + 8, 28, PAL.hazard, PAL.ink, TYPE.caption);
    this.text(lv.name, lx + 16 + tw, 28.5, 14, PAL.bone, 'left', DISPLAY, 400);
    if (m.players.length)
      this.btn({ x: lx + lw - 92, y: 17, w: 86, h: 23, action: 'level', device: me?.device ?? m.players[0].device }, 'New Level', 'ghost', 'refresh');
    this.btn({ x: VIEW_W - 196, y: 15, w: 84, h: 26, action: 'rules' }, 'Rules', 'secondary', 'flag');
    this.btn({ x: VIEW_W - 104, y: 15, w: 92, h: 26, action: 'settings' }, 'Settings', 'secondary', 'gear');

    // Player bays: joined players + open slots (min 4 shown, 4 per row).
    const shown = Math.min(MAX_PLAYERS, Math.max(4, m.players.length + 1));
    const rows = shown > 4 ? 2 : 1;
    const cols = 4;
    const gap = 10;
    const bw = 174;
    const top = 60;
    const bottom = VIEW_H - FOOT_H - (this.net ? 46 : 12);
    const bh = Math.min(rows === 1 ? 250 : 999, (bottom - top - gap * (rows - 1)) / rows);
    const y0 = top + (bottom - top - (rows * bh + (rows - 1) * gap)) / 2;
    const x0 = (VIEW_W - (cols * bw + (cols - 1) * gap)) / 2;
    const joinable = !me;
    for (let i = 0; i < shown; i++) {
      const x = x0 + (i % cols) * (bw + gap);
      const y = y0 + Math.floor(i / cols) * (bh + gap);
      const p = m.players[i];
      if (p) this.playerCard(p, i, x, y, bw, bh, t);
      else {
        // No hover under a finger: the first open bay advertises the tap instead.
        const hover =
          (joinable && this.button({ x, y, w: bw, h: bh, action: 'join', device: this.mouseDevice })) ||
          (joinable && this.mode === 'touch' && i === m.players.length);
        bay(c, x, y, bw, bh, hover, t);
        this.text('OPEN', x + bw / 2, y + bh / 2 - (hover ? 8 : 4), rows === 1 ? 26 : 22, hover ? PAL.amber : PAL.dim, 'center', DISPLAY, 400);
        if (hover) {
          const gx = x + bw / 2 - 18;
          const glyph: Glyph = this.mode === 'touch' ? { kind: 'touch' } : { kind: 'mouse', button: 'left' };
          drawGlyph(c, glyph, gx, y + bh / 2 + 16, 13);
          this.text('Join', gx + 15, y + bh / 2 + 16.5, TYPE.label, PAL.bone, 'left', UI, 700);
        }
      }
    }
    if (this.net) this.netPanel(this.net, x0, VIEW_H - FOOT_H - 40, cols * bw + (cols - 1) * gap);
  }

  private playerCard(p: Player, i: number, x: number, y: number, w: number, h: number, t: number) {
    const c = this.ctx;
    const col = p.character.body;
    const big = h > 200;
    const mine = p.device === this.mouseDevice;
    plate(c, x, y, w, h, { edge: css(col, 5), stroke: p.ready ? PAL.toxic : undefined });
    // Header: player number + device.
    this.text(`P${p.slot + 1}`, x + 10, y + 17, 15, css(col, 22), 'left', DISPLAY, 400, 3);
    const pad = p.device.startsWith('pad');
    const label = this.devices.deviceLabel(p.device);
    c.font = `600 ${TYPE.caption}px ${UI}`;
    const lw = c.measureText(label).width;
    this.text(label, x + w - 10, y + 17.5, TYPE.caption, PAL.ash, 'right', UI, 600);
    if (p.device === 'touch') drawGlyph(c, { kind: 'touch' }, x + w - 24 - lw, y + 17.5, 11);
    else icon(c, pad ? 'gamepad' : 'keyboard', x + w - 18 - lw, y + 17.5, 9, PAL.ash);
    // Character on a slag pedestal.
    const cx = x + w / 2;
    const feet = y + (big ? h * 0.6 : h * 0.56);
    const sg = c.createRadialGradient(cx, feet - 24, 4, cx, feet - 24, big ? 70 : 50);
    sg.addColorStop(0, css(col, 5, 0.32));
    sg.addColorStop(1, css(col, 0, 0));
    c.fillStyle = sg;
    c.fillRect(x + 2, y + 26, w - 4, feet - y - 20);
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.ellipse(cx, feet + 3, big ? 34 : 26, big ? 7 : 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3a2a22';
    c.beginPath();
    c.ellipse(cx, feet + 1.5, big ? 32 : 24, big ? 5.5 : 4, 0, 0, Math.PI * 2);
    c.fill();
    glowDot(this.gctx, cx, feet + 3, big ? 34 : 24, { h: 22, s: 100, l: 50 }, 0.35, 0.2);
    drawCharacter({ s: c, g: this.gctx }, p.character, cx, feet, {
      facing: Math.sin(t * 0.8 + i) > 0 ? 1 : -1,
      vx: 0,
      vy: 0,
      grounded: true,
      t,
      scale: big ? 4.4 : h > 150 ? 3.2 : 2.7,
      celebrate: p.ready,
    });
    // Name (click to rename for the mouse player).
    const ny = feet + (big ? 22 : 17);
    const nsize = big ? 17 : 14;
    c.font = `400 ${nsize}px ${DISPLAY}`;
    const nw = c.measureText(p.character.name).width;
    const nh = this.mode === 'touch' ? 26 : nsize + 4;
    const nameHover = mine && this.button({ x: cx - nw / 2 - 14, y: ny - nh / 2, w: nw + 28, h: nh, action: 'name', device: p.device });
    this.text(p.character.name, cx, ny, nsize, nameHover ? PAL.amber : PAL.bone, 'center', DISPLAY, 400, 3.5);
    if (mine) icon(c, 'pencil', cx + nw / 2 + 8, ny, 8, nameHover ? PAL.amber : PAL.dim);
    // Status row.
    const by = y + h - (big ? 34 : 28);
    const bh = big ? 25 : 22;
    if (mine) {
      this.btn(
        { x: x + 10, y: by, w: w - 50, h: bh, action: 'ready', device: p.device },
        p.ready ? 'Ready!' : 'Ready Up',
        p.ready ? 'ready' : 'primary',
        p.ready ? 'check' : undefined,
        TYPE.label,
      );
      this.btn({ x: x + w - 36, y: by, w: 26, h: bh, action: 'look', device: p.device }, '', 'secondary', 'dice');
    } else if (p.ready) {
      tag(c, 'READY', cx, by + bh / 2 - 1, PAL.toxic, PAL.ink, TYPE.label, 'center');
    } else this.text('Not Ready', cx, by + bh / 2 - 1, TYPE.body, PAL.dim, 'center', UI, 600);
  }

  private netPanel(net: NetInfo, x: number, y: number, w: number) {
    const c = this.ctx;
    const h = 30;
    plate(c, x, y, w, h, { rivets: false });
    const tw = tag(c, net.offline ? 'OFFLINE' : 'ONLINE', x + 8, y + h / 2, net.offline ? PAL.dim : PAL.toxic, PAL.ink, TYPE.caption);
    let px = x + 16 + tw;
    this.text(net.status, px, y + h / 2, TYPE.body, PAL.ash, 'left', UI, 600);
    c.font = `600 ${TYPE.body}px ${UI}`;
    px += c.measureText(net.status).width + 14;
    const right = net.inviteUrl ? x + w - 136 : x + w - 8;
    for (const peer of net.peers) {
      const name = peer.local ? `${peer.name} (You)` : peer.name;
      c.font = `700 ${TYPE.body}px ${UI}`;
      const nw = c.measureText(name).width;
      const cw = nw + (peer.isHost ? 14 : 0) + (peer.pingMs !== undefined ? 34 : 0) + 14;
      if (px + cw > right) break;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      rrect(c, px, y + 6, cw, h - 12, 3);
      c.fill();
      let cx = px + 7;
      if (peer.isHost) {
        icon(c, 'crown', cx + 4, y + h / 2, 9, PAL.amber);
        cx += 14;
      }
      this.text(name, cx, y + h / 2 + 0.5, TYPE.body, PAL.bone, 'left', UI, 700);
      cx += nw + 5;
      if (peer.pingMs !== undefined) {
        const q = peer.pingMs < 80 ? 3 : peer.pingMs < 160 ? 2 : 1;
        const colr = q === 3 ? PAL.toxic : q === 2 ? PAL.amber : PAL.danger;
        for (let b = 0; b < 3; b++) {
          c.fillStyle = b < q ? colr : 'rgba(255,255,255,0.15)';
          c.fillRect(cx + b * 3, y + h / 2 + 3 - (b + 1) * 2.4, 2, (b + 1) * 2.4);
        }
        this.text(`${Math.round(peer.pingMs)}`, cx + 11, y + h / 2 + 0.5, TYPE.caption, PAL.ash, 'left', UI, 600);
      }
      px += cw + 6;
    }
    if (net.inviteUrl) this.btn({ x: x + w - 130, y: y + 4, w: 124, h: 23, action: 'invite' }, 'Copy Invite Link', 'primary', 'copy');
  }

  private cursor(x: number, y: number, col: HSL, label: string, t: number) {
    const c = this.ctx;
    glowDot(this.gctx, x + 3, y + 5, 14, col, 0.35 + Math.sin(t * 6) * 0.1);
    c.save();
    c.translate(x, y);
    c.fillStyle = css(col, 8);
    c.strokeStyle = PAL.ink;
    c.lineWidth = 1.6;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 14);
    c.lineTo(4, 10.5);
    c.lineTo(7, 16);
    c.lineTo(9.5, 15);
    c.lineTo(6.5, 9.5);
    c.lineTo(11.5, 9.5);
    c.closePath();
    c.stroke();
    c.fill();
    c.restore();
    c.font = `700 ${TYPE.caption}px ${UI}`;
    const w = c.measureText(label).width + 10;
    c.fillStyle = PAL.ink;
    rrect(c, x + 11, y + 12, w + 2, 14, 3);
    c.fill();
    c.fillStyle = css(col, -12);
    rrect(c, x + 12, y + 13, w, 12, 2);
    c.fill();
    this.text(label, x + 17, y + 19.3, TYPE.caption, '#fff', 'left', UI, 700);
  }

  /** Big phase heading with a sub line. */
  private heading(title: string, sub: string, y: number, size: number = TYPE.title) {
    this.text(title, VIEW_W / 2, y, size, PAL.bone, 'center', DISPLAY, 400, size * 0.2);
    if (sub) this.text(sub, VIEW_W / 2, y + size * 0.5 + 10, TYPE.label, PAL.ash, 'center', UI, 600);
  }

  // ------------------------------------------------------------------ pick / place

  private pick(m: Match, t: number) {
    const c = this.ctx;
    c.fillStyle = 'rgba(18,10,7,0.68)';
    this.wash();
    const twoRows = m.crate.length > 5;
    this.heading(roundLabel(m), 'Choose a Part', twoRows ? 30 : 52, twoRows ? 24 : TYPE.title);
    this.phaseTimer(m, t, VIEW_W / 2 + 120, twoRows ? 34 : 56);
    const rc = this.rc();
    rc.t = t;
    rc.frame = m.frame;
    m.crate.forEach((item, idx) => {
      if (item.claimedBy >= 0) return;
      const r = item.rect;
      const hoverer = m.players.find((p) => p.claim < 0 && m.crateItemAt(p.cursor.x, p.cursor.y) === idx);
      const lift = hoverer ? -4 : 0;
      const y = r.y + lift;
      const role = ROLE[item.def.role];
      if (hoverer) glowDot(this.gctx, r.x + r.w / 2, y + r.h / 2, r.w * 0.8, hoverer.character.body, 0.16);
      plate(c, r.x, y, r.w, r.h, {
        edge: css(role.color),
        stroke: idx === this.pendingCard ? PAL.bone : hoverer ? css(hoverer.character.body, 15) : undefined,
        drop: lift ? 6 : 3,
      });
      const sg = c.createRadialGradient(r.x + r.w / 2, y + 44, 2, r.x + r.w / 2, y + 44, 46);
      sg.addColorStop(0, css(role.color, 0, 0.22));
      sg.addColorStop(1, css(role.color, 0, 0));
      c.fillStyle = sg;
      c.fillRect(r.x + 1, y + 5, r.w - 2, r.h - 6);
      drawPreview(rc, item.def, r.x + r.w / 2, y + 44, 50);
      tag(c, role.label, r.x + 7, y + 15, css(role.color), PAL.ink, TYPE.caption);
      const stamp = propTag(item.def);
      if (stamp) tag(c, stamp, r.x + 7, y + 30, PAL.bone, PAL.ink, TYPE.caption);
      wrap(this, item.def.name, r.x + r.w / 2, y + r.h - 28, r.w - 12, TYPE.body);
      this.text(item.def.maker, r.x + r.w / 2, y + r.h - 11, TYPE.caption, PAL.dim, 'center', UI, 600);
    });
    for (const p of m.players) if (p.claim < 0) this.pending.push(() => this.cursor(p.cursor.x, p.cursor.y, p.character.body, p.character.name, t));
  }

  private place(m: Match) {
    const c = this.ctx;
    // The header runs along the top of the window, whatever its shape.
    const { x0, y0, w, safeX0, safeY0, safeX1 } = this.frame;
    const g = c.createLinearGradient(0, y0, 0, safeY0 + 54);
    g.addColorStop(0, 'rgba(18,10,7,0.82)');
    g.addColorStop(1, 'rgba(18,10,7,0)');
    c.fillStyle = g;
    c.fillRect(x0, y0, w, safeY0 + 54 - y0);
    this.text(roundLabel(m), safeX0 + 14, safeY0 + 16, 14, PAL.amber, 'left', DISPLAY, 400, 3);
    this.text('PLACE YOUR PART', VIEW_W / 2, safeY0 + 17, TYPE.head + 2, PAL.bone, 'center', DISPLAY, 400, 4);
    this.phaseTimer(m, m.frame / 60, safeX1 - 24, safeY0 + 20);
    for (const p of m.players) {
      if (p.placed) continue;
      const def = p.claim >= 0 ? m.crate[p.claim].def : null;
      this.pending.push(() => this.cursor(p.cursor.x, p.cursor.y, p.character.body, def ? def.name : p.character.name, m.frame / 60));
    }
  }

  /** Countdown ring for timed pick/place phases. */
  private phaseTimer(m: Match, t: number, x: number, y: number) {
    const left = m.phaseTimeLeft;
    if (!Number.isFinite(left)) return;
    const total = (m.phase === 'pick' ? m.rules.pickSeconds : m.rules.placeSeconds) * 60;
    const c = this.ctx;
    const urgent = left < 5 * 60;
    c.fillStyle = PAL.ink;
    circle(c, x, y, 16);
    c.fillStyle = PAL.iron;
    circle(c, x, y, 14.5);
    c.strokeStyle = urgent ? css({ h: 4, s: 100, l: 58 + Math.sin(t * 12) * 10 }) : PAL.amber;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * left) / total);
    c.stroke();
    this.text(String(Math.ceil(left / 60)), x, y + 0.5, 12, urgent ? PAL.danger : PAL.bone, 'center', DISPLAY, 400);
  }

  // ------------------------------------------------------------------ race

  private run(m: Match, t: number) {
    const run = m.run!;
    const c = this.ctx;
    if (run.frame < RUN_COUNTDOWN + 30) {
      const left = RUN_COUNTDOWN - run.frame;
      const label = left > 0 ? String(Math.ceil((left / RUN_COUNTDOWN) * 3)) : 'GO!';
      const sub = left > 0 ? ((left / RUN_COUNTDOWN) * 3) % 1 : (run.frame - RUN_COUNTDOWN) / 30;
      const sc = left > 0 ? 1 + sub * 0.6 : 1 + sub * 0.5;
      c.save();
      c.translate(VIEW_W / 2, VIEW_H / 2 - 30);
      c.scale(sc, sc);
      c.globalAlpha = left > 0 ? 1 : 1 - sub;
      this.text(label, 0, 0, TYPE.hero, left > 0 ? PAL.bone : PAL.toxic, 'center', DISPLAY, 400, 9);
      c.restore();
      glowDot(this.gctx, VIEW_W / 2, VIEW_H / 2 - 30, 90, left > 0 ? { h: 30, s: 100, l: 60 } : { h: 90, s: 100, l: 55 }, 0.3);
    }
    if (Number.isFinite(run.timeLeft)) {
      const secs = Math.ceil(run.timeLeft / 60);
      const urgent = secs <= 10;
      plate(c, VIEW_W / 2 - 28, this.frame.safeY0 + 6, 56, 24, { rivets: false, stroke: urgent ? PAL.danger : undefined });
      this.text(
        String(secs),
        VIEW_W / 2,
        this.frame.safeY0 + 18.5,
        TYPE.head,
        urgent ? css({ h: 4, s: 100, l: 62 + Math.sin(t * 12) * 10 }) : PAL.bone,
        'center',
        DISPLAY,
        400,
      );
    }
    // Scores can't change during a race, so these chips hold still until the next round.
    standings(m.players, (p) => p.score).forEach((p, i) => {
      const r = run.runners.find((r) => r.slot === p.slot);
      // Up to 4 chips per row so 8 players fit left of the timer.
      const x = this.frame.safeX0 + 8 + (i % 4) * 87;
      const y = this.frame.safeY0 + 6 + Math.floor(i / 4) * 29;
      const dead = r && !r.alive;
      const done = r?.finished;
      plate(c, x, y, 84, 25, { rivets: false, drop: 2, stroke: done ? PAL.toxic : dead ? PAL.danger : undefined, alpha: 0.92 });
      c.fillStyle = css(p.character.body);
      c.fillRect(x, y, 3, 25);
      c.save();
      c.globalAlpha = dead ? 0.4 : 1;
      drawCharacter({ s: c, g: null }, p.character, x + 14, y + 21, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 1.05, celebrate: done });
      c.restore();
      this.text(p.character.name, x + 26, y + 8.5, TYPE.caption + 0.5, PAL.bone, 'left', UI, 700);
      const status = done
        ? `#${run.finishOrder.indexOf(p.slot) + 1} Safe`
        : dead
          ? r.killer >= 0 && r.killer !== p.slot
            ? `Got by ${m.player(r.killer)?.character.name ?? '?'}`
            : 'Splat'
          : `${p.score} Pts`;
      this.text(status, x + 26, y + 18, TYPE.caption, done ? PAL.toxic : dead ? '#ff8a7a' : PAL.ash, 'left', UI, 600);
      const held = r?.items.held;
      if (held) {
        // On the status line: names fill the row above.
        drawItemIcon(c, held.kind, x + 75, y + 17, 0.7, t);
        if (held.uses > 1) this.text(`×${held.uses}`, x + 67, y + 18, TYPE.caption, PAL.bone, 'right', UI, 800);
      }
    });
  }

  // ------------------------------------------------------------------ score / victory

  private score(m: Match, t: number) {
    const c = this.ctx;
    c.fillStyle = 'rgba(18,10,7,0.72)';
    this.wash();
    const res = m.result!;
    const TARGET = m.rules.targetScore;
    const normal = res.verdict === 'normal';
    const title = res.verdict === 'too-easy' ? 'TOO EASY!' : res.verdict === 'too-hard' ? 'NOBODY MADE IT' : roundLabel(m);
    this.text(title, VIEW_W / 2, 50, TYPE.title, normal ? PAL.bone : PAL.amber, 'center', DISPLAY, 400, 6);
    // Scoreless rounds are the ones that run a match into the limit, so they keep the count too.
    if (!normal) this.text(roundLabel(m), 14, 16, 14, PAL.amber, 'left', DISPLAY, 400, 3);
    const anim = Math.min(1, Math.max(0, (m.phaseFrame - 20) / 60));
    const barX = 236;
    const barW = 380;
    // Compact rows when more than 4 players so 8 fit on screen.
    const compact = m.players.length > 4;
    const rowH = compact ? 35 : 50;
    const L = compact
      ? { feet: 30, scale: 1.55, name: 8, nameSize: 11, bar: 15, barH: 9, award: 28, awardH: 11, band: -1 }
      : { feet: 36, scale: 2.2, name: 10, nameSize: 13, bar: 20, barH: 12, award: 38, awardH: 12, band: -6 };
    const y0 = compact ? 98 : 104;
    plate(c, 140, y0 - 12, 520, m.players.length * rowH + 22);
    // Finish line marker.
    hazardTape(c, barX + barW, y0 - 2, 4, m.players.length * rowH, 0.9);
    this.text(`${TARGET}`, barX + barW + 2, y0 - 7, TYPE.caption, PAL.hazard, 'center', UI, 800);
    // Rows start in the old standings and slide to the new ones as the bars fill.
    const before = standings(m.players, (p) => m.prevScores.get(p.slot) ?? 0);
    const after = standings(m.players, (p) => p.score);
    const slide = anim * anim * (3 - 2 * anim);
    const top = Math.max(...m.players.map((p) => p.score));
    // Bottom row first, so a climbing row passes over the ones it overtakes.
    for (let rank = after.length - 1; rank >= 0; rank--) {
      const p = after[rank];
      const from = before.indexOf(p);
      const y = y0 + (from + (rank - from) * slide) * rowH;
      const leader = m.players.length > 1 && top > 0 && p.score === top;
      // A row being overtaken dims mid-slide, or a straight swap is two rows printed on top of each other.
      c.globalAlpha = rank > from ? 1 - 0.75 * Math.sin(slide * Math.PI) : 1;
      if (leader) {
        c.fillStyle = 'rgba(255,176,46,0.13)';
        c.fillRect(148, y + L.band, 504, rowH - 6);
        c.fillStyle = PAL.amber;
        c.fillRect(148, y + L.band, 3, rowH - 6);
      }
      drawCharacter({ s: c, g: this.gctx }, p.character, 182, y + L.feet, {
        facing: 1,
        vx: 0,
        vy: 0,
        grounded: true,
        t,
        scale: L.scale,
        celebrate: res.finishers.includes(p.slot),
      });
      this.text(p.character.name, barX, y + L.name, L.nameSize, leader ? PAL.amber : PAL.bone, 'left', DISPLAY, 400);
      const prev = m.prevScores.get(p.slot) ?? 0;
      const shown = prev + (p.score - prev) * anim;
      c.fillStyle = PAL.ink;
      rrect(c, barX - 1, y + L.bar - 1, barW + 2, L.barH + 2, 3);
      c.fill();
      c.fillStyle = PAL.soot;
      rrect(c, barX, y + L.bar, barW, L.barH, 2);
      c.fill();
      const wPrev = (barW * Math.min(prev, TARGET)) / TARGET;
      const wNow = (barW * Math.min(shown, TARGET)) / TARGET;
      if (wNow > 0) {
        const bg = c.createLinearGradient(0, y + L.bar, 0, y + L.bar + L.barH);
        bg.addColorStop(0, css(p.character.body, 15));
        bg.addColorStop(1, css(p.character.body, -15));
        c.fillStyle = bg;
        rrect(c, barX, y + L.bar, Math.max(4, wNow), L.barH, 2);
        c.fill();
        if (wNow > wPrev + 1) {
          glowDot(this.gctx, barX + wNow, y + L.bar + L.barH / 2, 16, p.character.body, 0.6);
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(barX + wPrev, y + L.bar + 1, wNow - wPrev, 3);
        }
      }
      this.text(String(Math.round(shown)), barX + barW + 24, y + L.bar + L.barH / 2, compact ? 13 : 16, leader ? PAL.amber : PAL.bone, 'center', DISPLAY, 400);
      const awards = res.awards.filter((a) => a.slot === p.slot);
      c.font = `400 ${L.nameSize}px ${DISPLAY}`;
      let ax = barX + c.measureText(p.character.name).width + 8;
      for (const a of awards) {
        const info = AWARD[a.reason] ?? { label: a.reason, color: { h: 0, s: 0, l: 50 } };
        c.save();
        c.globalAlpha *= Math.min(1, anim * 2);
        ax += tag(c, `+${a.points} ${info.label}`, ax, y + L.name, css(info.color), '#fff', TYPE.caption) + 4;
        c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  private victory(m: Match, t: number) {
    const c = this.ctx;
    const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
    g.addColorStop(0, 'rgba(18,10,7,0.35)');
    g.addColorStop(1, 'rgba(18,10,7,0.88)');
    c.fillStyle = g;
    this.wash();
    const winners = m.winners.map((s) => m.player(s)!).filter(Boolean);
    if (!winners.length) {
      // The round limit hit with nobody on the board: no podium to light.
      this.text('NO WINNER', VIEW_W / 2, VIEW_H / 2 - 20, 46, PAL.amber, 'center', DISPLAY, 400, 8);
      return;
    }
    // God-ray burst behind the winner.
    const gg = this.gctx;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + t * 0.3;
      gg.fillStyle = `rgba(255,190,80,${0.08 + 0.04 * Math.sin(t * 2 + i)})`;
      gg.beginPath();
      gg.moveTo(VIEW_W / 2, 250);
      gg.lineTo(VIEW_W / 2 + Math.cos(a - 0.08) * 500, 250 + Math.sin(a - 0.08) * 500);
      gg.lineTo(VIEW_W / 2 + Math.cos(a + 0.08) * 500, 250 + Math.sin(a + 0.08) * 500);
      gg.fill();
    }
    this.text(winners.length > 1 ? 'TIE!' : 'WINNER', VIEW_W / 2, 66, 46, PAL.amber, 'center', DISPLAY, 400, 8);
    // A low-scoring match can tie at the round limit, up to 8 ways: shrink the podium so everyone fits.
    const gap = Math.min(150, (VIEW_W - 64) / winners.length);
    const k = gap / 150;
    winners.forEach((p, i) => {
      const x = VIEW_W / 2 + (i - (winners.length - 1) / 2) * gap;
      glowDot(gg, x, 220, 90 * k, p.character.body, 0.35);
      drawCharacter({ s: c, g: gg }, p.character, x, 270, { facing: 1, vx: 0, vy: 0, grounded: true, t, scale: 7 * k, celebrate: true });
      this.text(p.character.name, x, 300, 24 * k, PAL.bone, 'center', DISPLAY, 400, 5 * k);
      this.text(`${p.score} Points`, x, 323, TYPE.label, PAL.amber, 'center', UI, 700);
    });
  }

  // ------------------------------------------------------------------ footer prompts

  /** Keyboard profile prompts are drawn from (the mouse player's keyboard). */
  private profile(): KeyProfile | undefined {
    const s = this.devices.settings;
    if (!s) return undefined;
    const kbs = keyboardDevices(s);
    return (kbs.find((d) => d.device === this.mouseDevice) ?? kbs[0])?.profile;
  }

  /** The Use prompt for the held item of the pointer's player, else of the first local holder. */
  private usePrompt(m: Match): FooterItem[] | null {
    const mine = m.players.find((p) => p.device === this.mouseDevice)?.slot;
    const holders = m.run?.runners.filter((r) => r.alive && !r.finished && r.items.held) ?? [];
    const held = (holders.find((r) => r.slot === mine) ?? holders[0])?.items.held;
    return held ? [{ action: 'use', label: ITEMS[held.kind].verb }] : null;
  }

  /** Footer prompts and the left-hand context label for this phase. */
  private footerItems(m: Match): { items: FooterItem[]; left: string; alpha: number; bar: boolean } {
    const touch = this.mode === 'touch';
    switch (m.phase) {
      case 'lobby': {
        const primary = this.mode === 'gamepad' ? m.players.find((p) => /(^|:)pad/.test(p.device)) : m.players.find((p) => p.device === this.mouseDevice);
        const items: FooterItem[] = [];
        if (!primary) items.push({ action: 'confirm', label: 'Join', hud: 'join', device: this.mouseDevice });
        else {
          items.push({ action: 'confirm', label: primary.ready ? 'Not Ready' : 'Ready Up', hud: 'ready', device: primary.device });
          items.push({ action: 'alt', label: 'New Look', hud: 'look', device: primary.device });
          items.push({ action: 'down', label: 'New Level', hud: 'level', device: primary.device });
        }
        if (!touch) items.push({ action: 'menu', label: 'Settings', hud: 'settings' });
        const ready = m.players.filter((p) => p.ready).length;
        const left = m.players.length ? `${ready}/${m.players.length} Ready` : '';
        return { items, left, alpha: 1, bar: true };
      }
      case 'pick': {
        const picked = m.players.filter((p) => p.claim >= 0).length;
        return { items: [{ action: 'confirm', label: 'Pick', mouse: true }], left: `${picked}/${m.players.length} Picked`, alpha: 1, bar: true };
      }
      case 'place': {
        const placed = m.players.filter((p) => p.placed).length;
        // Fade out of the way when a cursor is down near the footer.
        const near = m.players.some((p) => !p.placed && p.cursor.y > VIEW_H - FOOT_H - 26);
        return {
          items: [
            { action: 'confirm', label: 'Drag to Aim', touchOnly: true },
            { action: 'alt', label: 'Rotate', mouse: true, touchButton: '⟳' },
            { action: 'confirm', label: 'Place', mouse: true, touchButton: 'PLACE' },
          ],
          left: `${placed}/${m.players.length} Placed`,
          alpha: near ? 0.25 : 1,
          bar: true,
        };
      }
      case 'run': {
        if (touch) return { items: [], left: '', alpha: 0, bar: false };
        const use = this.usePrompt(m);
        const f = m.run?.frame ?? 0;
        const full = RUN_COUNTDOWN + 180;
        // Full controls during the countdown, then only the escape hatch, quietly.
        if (f < full + 40) {
          const a = f < full ? 1 : 1 - (f - full) / 40;
          return {
            items: [{ action: 'jump', label: 'Jump' }, { action: 'run', label: 'Run' }, ...(use ?? []), { action: 'alt', label: 'Self-Destruct' }],
            left: '',
            alpha: Math.max(0.55, a),
            bar: a > 0.6,
          };
        }
        return { items: [...(use ?? []), { action: 'alt', label: 'Self-Destruct' }], left: '', alpha: use ? 0.9 : 0.55, bar: false };
      }
      case 'score':
        return {
          items: m.phaseFrame > 90 ? [{ action: 'confirm', label: 'Continue', hud: 'continue', device: this.mouseDevice }] : [],
          left: '',
          alpha: 1,
          bar: true,
        };
      case 'victory':
        return {
          items: m.phaseFrame > 120 ? [{ action: 'confirm', label: 'Back to Lobby', hud: 'continue', device: this.mouseDevice }] : [],
          left: '',
          alpha: 1,
          bar: true,
        };
    }
  }

  private footer(m: Match) {
    const { items, left, alpha, bar } = this.footerItems(m);
    const c = this.ctx;
    const touch = this.mode === 'touch';
    const fh = touch ? 30 : FOOT_H;
    const gh = touch ? 16 : 12;
    const size = touch ? TYPE.label + 1 : TYPE.body + 0.5;
    const win = this.frame;
    const y = win.y1 - fh;
    const cy = y + fh / 2 + 1;
    const present = {
      keyboard: true,
      gamepad: this.padCount > 0 || m.players.some((p) => p.device.startsWith('pad')),
    };
    const modes = promptModes(this.mode, present);
    const ctx = { profile: this.profile(), modes, mouse: false };
    c.save();
    c.globalAlpha = alpha;
    if (bar && (items.length || left)) {
      c.fillStyle = 'rgba(16,9,6,0.88)';
      c.fillRect(win.x0, y, win.w, fh);
      hazardTape(c, win.x0, y - 2, win.w, 2, 0.8);
      c.fillStyle = PAL.ink;
      c.fillRect(win.x0, y, win.w, 1);
    }
    if (left) this.text(left, win.safeX0 + 14, cy, size, PAL.ash, 'left', UI, 700);
    if (m.phase === 'lobby' && this.room) {
      const code = this.room;
      c.font = `400 ${size + 3}px ${DISPLAY}`;
      const x = win.safeX0 + (left ? 110 : 14);
      this.text('LOBBY', x, cy, TYPE.caption, PAL.dim, 'left', UI, 800);
      this.text(code, x + 34, cy + 0.5, size + 3, PAL.amber, 'left', DISPLAY, 400);
    }
    // Right-aligned prompts, laid out right to left.
    let x = win.safeX1 - 14;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.touchOnly && !touch) continue;
      const glyphs = glyphsFor(it.action, {
        ...ctx,
        mouse: !!it.mouse && modes[0] === 'keyboard',
        touchButtons: it.touchButton ? { [it.action]: it.touchButton } : undefined,
      });
      if (!glyphs.length) continue;
      c.font = `700 ${size}px ${UI}`;
      const lw = c.measureText(it.label).width;
      let gw = 0;
      for (const g of glyphs) gw += glyphWidth(c, g, gh) + 3;
      const w = gw + 3 + lw;
      const x0 = x - w;
      let hover = false;
      if (it.hud && alpha > 0.5) hover = this.button({ x: x0 - 5, y, w: w + 10, h: fh, action: it.hud, device: it.device });
      if (hover) {
        c.fillStyle = 'rgba(255,140,40,0.18)';
        c.fillRect(x0 - 5, y + 2, w + 10, fh - 3);
      }
      let gx = x0;
      for (const g of glyphs) gx += drawGlyph(c, g, gx, cy - 0.5, gh) + 3;
      this.text(it.label, gx + 3, cy, size, hover ? PAL.amber : PAL.bone, 'left', UI, 700);
      x = x0 - (touch ? 22 : 16);
    }
    c.restore();
  }

  private drawToast() {
    if (!this.toastMsg) return;
    const left = this.toastUntil - performance.now();
    if (left <= 0) {
      this.toastMsg = '';
      return;
    }
    const c = this.ctx;
    c.save();
    c.globalAlpha = Math.min(1, left / 250);
    c.font = `700 ${TYPE.label}px ${UI}`;
    const w = c.measureText(this.toastMsg).width + 34;
    const x = VIEW_W / 2 - w / 2;
    plate(c, x, 52, w, 24, { rivets: false, stroke: PAL.toxic });
    icon(c, 'check', x + 13, 64, 9, PAL.toxic);
    this.text(this.toastMsg, x + 23, 64.5, TYPE.label, PAL.bone, 'left', UI, 700);
    c.restore();
  }

  /** For wrap(). */
  measure(s: string, size: number) {
    this.ctx.font = `700 ${size}px ${UI}`;
    return this.ctx.measureText(s).width;
  }
  line(s: string, x: number, y: number, size: number) {
    this.text(s, x, y, size, PAL.bone, 'center', UI, 700);
  }
}

function wrap(h: Hud, s: string, cx: number, y: number, maxW: number, size: number) {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (h.measure(next, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  lines.push(cur);
  const shown = lines.slice(0, 2);
  shown.forEach((l, i) => h.line(l, cx, y + (i - (shown.length - 1) / 2) * (size + 2), size));
}
