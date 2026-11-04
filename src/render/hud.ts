import type { Match } from '../game/match';
import type { InputSettings } from '../input/bindings';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { InputMode } from '../ui/prompts';
import { PAL, TYPE } from '../ui/style';
import { buttonText, type ButtonStyle, icon, type IconName, plate, stampButton } from './hud-kit';
import { VIEW_FRAME, type ViewFrame } from './frame';
import type { RC } from './kit';
import { footer } from './hud/footer';
import { FOOT_H, MAX_FOOT_SCALE, NO_GROUP, UI } from './hud/layout';
import { lobby } from './hud/lobby';
import { pick, place } from './hud/pick-place';
import { race } from './hud/race';
import { score, victory } from './hud/score';
import { arrival, joinCard, joinCta, seatBanner } from './hud/arrival';
import type { CharacterDef } from '../gen/character';

/**
 * Screen-space UI on its own canvas (logical 768×432, scaled), in the
 * foundry style described in docs/ART.md. Every phase gets a footer prompt
 * bar with glyphs for the active input family; the lobby is the only screen
 * with real clickable buttons (plus a few footer prompts).
 *
 * This class owns the canvas, the per-frame state and the drawing helpers
 * (text, buttons, scale groups). Each phase's painter is in ./hud/ and draws
 * through the public members here.
 */

export type HudAction =
  | 'join'
  | 'ready'
  | 'look'
  | 'name'
  | 'level'
  /** The lobby's level dialog: theme, seed and difficulty. */
  | 'levelMenu'
  | 'settings'
  | 'rules'
  | 'invite'
  | 'continue'
  | 'kick'
  /** The Join call to action: opens the join card. */
  | 'play'
  /** The join card's confirm: ask the host for the seat. */
  | 'seat'
  /** Close the join card, still watching. */
  | 'cancel'
  /** Watch instead of playing. */
  | 'watch'
  /** Back to the main menu (a room that failed). */
  | 'home'
  /** Stay on this page and play here, offline (a room that failed). */
  | 'offline'
  /** Kicked, and the ban ran out: try the room again. */
  | 'rejoin'
  /** Seat a bot this machine runs (lobby, the host or offline). */
  | 'bot'
  /** Unseat the bot playing as `device`. */
  | 'unbot'
  /** The next level for the bot playing as `device`. */
  | 'botLevel';

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
  /** Does this player device play on this screen? Absent: everyone does (local play). */
  isLocal?(device: string): boolean;
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
  /** The player carrying the host label. */
  hostSlot?: number;
  /** Players this peer may remove. */
  kickable?: number[];
  /** Player picked with the keyboard or gamepad. */
  kickSlot?: number;
  /** In no room's match, and can't join this one (another build): its local seats mean nothing, so none are drawn. */
  stranded?: boolean;
  /**
   * Where this peer stands. `seated`; `leaving`: seated, watching from the round boundary; `queued`: owed a
   * seat at the round boundary; `watching`.
   */
  seat?: 'seated' | 'leaving' | 'queued' | 'watching';
  /** Seats a Join could still win. */
  space?: number;
  /** The seats as they stand: a color per player, 'queued' for one owed, '' for a free one. */
  seats?: string[];
  /** Peers in the room without a seat, in join order. */
  watchers?: NetWatcher[];
  /** The joining screen: still connecting, or the room failed. Absent once in. */
  arrival?: NetArrival;
}

/** The join card: the character you'd play as, and how asking for the seat is going. */
export interface JoinCardInfo {
  character: CharacterDef;
  /** `edit`: looking and naming; `asking`: with the host; `won`: seated or owed a seat; `taken`: someone was quicker. */
  stage: 'edit' | 'asking' | 'won' | 'taken';
  /** Won a seat at once (lobby, between rounds) rather than at the round boundary. */
  now?: boolean;
}

export interface NetWatcher {
  peer: string;
  /** Empty for someone who never had a seat or a name. */
  name: string;
  self: boolean;
  afk: boolean;
  /** The host may remove it (lobby). */
  kickable: boolean;
}

export interface NetArrival {
  stage: 'connecting' | 'failed';
  /** What's happening, in a few words. */
  title: string;
  /** Peers in the room as far as we know (connecting). */
  here: number;
  /** Failed: playing here offline is possible. */
  offline?: boolean;
  /** Kicked: seconds until the room takes us back (0: now, with Rejoin). */
  rejoinIn?: number;
}

/** Screen-space UI on its own canvas (logical 768×432, scaled). */
export class Hud {
  private glow: HTMLCanvasElement = document.createElement('canvas');
  gctx = this.glow.getContext('2d')!;
  private wipe = 0;
  private lastPhase = '';
  private lastT = 0;
  private embers: { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }[] = [];
  private toastMsg = '';
  /** Draws deferred until after the footer (player cursors). */
  pending: (() => void)[] = [];
  private toastUntil = 0;
  private toastBad = false;

  /** Device labels/hints from the live key bindings (set by main). */
  devices: DeviceInfo = {
    deviceLabel: (d) => d,
    hints: () => ({ confirm: 'Confirm', alt: 'Alt', jump: 'Jump', down: 'Down' }),
  };
  /** Hide all UI (?ui=0): for screenshots / level review. */
  hidden = false;
  /** Where this frame wants the logo, in view px (null: no logo). See `logo`. */
  logoAt: { x: number; y: number; size: number } | null = null;
  /** Lobby/room code shown in the lobby (the URL is /r/<room>). */
  room = '';
  /** Device the mouse controls (gets name/settings buttons). */
  mouseDevice = 'kb1';
  /** This machine may seat a bot: the lobby's host (or offline), seated itself, with a seat free. */
  canAddBots = false;
  /** Is this device a bot this machine runs (its card gets Remove)? */
  ownsBot: (device: string) => boolean = () => false;
  /** Latest pointer position in view coords, for hover highlights. */
  pointer: { x: number; y: number } | null = null;
  /** Online lobby info (peers, status, invite link); set by the net layer when connected. */
  net?: NetInfo;
  /** Online pick: the card this peer clicked and the host hasn't ruled on yet. Not a claim. */
  pendingCard = -1;
  /** A watcher choosing Join: the card over the live match (set by game-client). */
  joinCard?: JoinCardInfo;
  /** Force the prompt glyph family (e.g. the touch layer sets 'touch'). Otherwise `lastInput` is used. */
  inputMode?: InputMode;
  /** Last input family the person used (tracked by game-client). */
  lastInput: InputMode = 'keyboard';
  /** Connected gamepads (for showing pad glyphs next to keys). */
  padCount = 0;
  /** Clickable regions from the last frame (lobby buttons). */
  private buttons: (HudButton & { art: { x: number; y: number; w: number; h: number } })[] = [];
  frame: ViewFrame = VIEW_FRAME;
  /** Phones: how far HUD groups grow about their anchors (1 elsewhere). */
  uiScale = 1;
  /** Phones: the smallest tap target, in view px (0 elsewhere). */
  tapMin = 0;
  /** World → view through the live camera: place cursors are in the world, and this screen may be zoomed in on it. */
  worldToView: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  /** The group being drawn, so buttons record where they land. */
  private group = NO_GROUP;
  /** This screen's crate zoom. Only the drawing grows: the sim's card rects and cursors stay in logical px, so peers agree. */
  cards = NO_GROUP;

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  clear(pw: number, ph: number) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, pw, ph);
    this.buttons = [];
  }

  /** Topmost clickable region at (x, y) in view coords. */
  hit(x: number, y: number): HudButton | null {
    const inside = (r: { x: number; y: number; w: number; h: number }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    // A phone grows small buttons' hit rects to a thumb, so neighbours overlap: a press on a button's own art is
    // that button's (the eye beside the dice on a lobby card), and only the space around the art goes to the topmost.
    for (let i = this.buttons.length - 1; i >= 0; i--) if (inside(this.buttons[i].art)) return this.buttons[i];
    for (let i = this.buttons.length - 1; i >= 0; i--) if (inside(this.buttons[i])) return this.buttons[i];
    return null;
  }

  /** A short notice under the top bar. `bad` is news the player didn't want (a lost link, a kick): no success check on it. */
  toast(msg: string, ms = 1800, bad = false) {
    this.toastMsg = msg;
    this.toastBad = bad;
    this.toastUntil = performance.now() + ms;
  }

  get mode(): InputMode {
    return this.inputMode ?? (this.mouseDevice.endsWith('touch') ? 'touch' : this.lastInput);
  }

  button(b: HudButton) {
    const { s, ox, oy } = this.group;
    const growW = Math.max(0, this.tapMin - b.w * s);
    const growH = Math.max(0, this.tapMin - b.h * s);
    const art = { x: ox + b.x * s, y: oy + b.y * s, w: b.w * s, h: b.h * s };
    const r = { ...b, x: art.x - growW / 2, y: art.y - growH / 2, w: art.w + growW, h: art.h + growH, art };
    this.buttons.push(r);
    return this.pointer !== null && this.pointer.x >= r.x && this.pointer.x < r.x + r.w && this.pointer.y >= r.y && this.pointer.y < r.y + r.h;
  }

  /** The smallest tap target in the logical px of the group being drawn (0 off phones). */
  get tap(): number {
    return this.tapMin / this.group.s;
  }

  /** Draw at view = o + logical × s on both layers, until the returned function is called. */
  begin(s: number, ox: number, oy: number): () => void {
    if (s === 1 && !ox && !oy) return () => {};
    const outer = this.group;
    for (const c of [this.ctx, this.gctx]) {
      c.save();
      c.translate(ox, oy);
      c.scale(s, s);
    }
    this.group = { s: outer.s * s, ox: outer.ox + outer.s * ox, oy: outer.oy + outer.s * oy };
    return () => {
      this.group = outer;
      this.ctx.restore();
      this.gctx.restore();
    };
  }

  /** `begin`, growing by `s` about the anchor (ax, ay). */
  grow(ax: number, ay: number, s: number): () => void {
    return this.begin(s, ax - ax * s, ay - ay * s);
  }

  get phone() {
    return this.uiScale > 1;
  }

  get footScale() {
    return this.mode === 'touch' ? Math.min(this.uiScale, MAX_FOOT_SCALE) : 1;
  }

  get footH() {
    return this.mode === 'touch' ? 30 * this.footScale : FOOT_H;
  }

  /** Space for the Settings button the touch overlay floats in the top-right corner. */
  get gearW() {
    return this.tapMin * 1.35;
  }

  /** A tap on this screen, in the logical px the crate's rects are in. */
  pickToLogical(p: { x: number; y: number }): { x: number; y: number } {
    const { s, ox, oy } = this.cards;
    return { x: (p.x - ox) / s, y: (p.y - oy) / s };
  }

  /** Stamped button with optional icon. */
  btn(b: HudButton, label: string, style: ButtonStyle = 'secondary', ico?: IconName, size: number = TYPE.body) {
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
  text(
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
  wash() {
    const f = this.frame;
    this.ctx.fillRect(f.x0, f.y0, f.w, f.h);
  }

  draw(match: Match, t: number, pw: number, ph: number) {
    // Prototype-backed, so the match's methods and every other field read through untouched.
    const m: Match = this.net?.stranded ? Object.assign(Object.create(match) as Match, { players: [] }) : match;
    this.buttons = [];
    this.logoAt = null;
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
        lobby(this, m, t, dt);
        break;
      case 'pick':
        pick(this, m, t);
        break;
      case 'place':
        place(this, m);
        break;
      case 'run':
        race(this, m, t);
        break;
      case 'score':
        score(this, m, t);
        break;
      case 'victory':
        victory(this, m, t);
        break;
    }
    seatBanner(this, m, t);
    footer(this, m);
    // Cursors stay on top of the footer so their labels are never covered.
    for (const f of this.pending) f();
    this.pending = [];
    // Watching: Join, in the corner, in every phase (in the lobby, at the end of the online panel).
    if (m.phase !== 'lobby' && this.net?.seat === 'watching' && !this.net.arrival && !this.joinCard) joinCta(this, m);
    // The join card and the joining screen go over everything: nothing under them is the peer's to touch.
    if (this.joinCard && !this.net?.arrival) {
      this.buttons = [];
      joinCard(this, m, this.joinCard, t);
    }
    if (this.net?.arrival) {
      this.buttons = [];
      arrival(this, m, t);
    }
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
    // The logo is DOM over this canvas: it can't be under the door, so it waits until the door has passed.
    if (this.wipe > 0) this.logoAt = null;
  }

  rc(): RC {
    return { s: this.ctx, bg: this.ctx, g: this.gctx, lights: null, t: 0, frame: 0 };
  }

  /**
   * Where the logo goes: centered on (x, y) at font size `size`, in the current group's logical px. The
   * logo itself is the main menu's, laid over this canvas by the game (src/ui/screens/logo.ts), so it
   * matches it exactly (glow included) and stays crisp at any render quality.
   */
  logo(x: number, y: number, size: number) {
    const g = this.group;
    this.logoAt = { x: g.ox + x * g.s, y: g.oy + y * g.s, size: size * g.s };
  }

  /** Rising embers from the bottom of the screen (lobby ambience). */
  stepEmbers(dt: number) {
    const g = this.gctx;
    if (this.embers.length < 46 && Math.random() < dt * 30) {
      const max = 2.5 + Math.random() * 3;
      this.embers.push({
        x: this.frame.x0 + Math.random() * this.frame.w,
        y: this.frame.y1 + 4,
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

  private drawToast() {
    if (!this.toastMsg) return;
    const left = this.toastUntil - performance.now();
    if (left <= 0) {
      this.toastMsg = '';
      return;
    }
    const c = this.ctx;
    const done = this.grow(VIEW_W / 2, this.frame.safeY0 + 52, this.uiScale);
    c.save();
    c.globalAlpha = Math.min(1, left / 250);
    c.font = `700 ${TYPE.label}px ${UI}`;
    const w = c.measureText(this.toastMsg).width + 34;
    const x = VIEW_W / 2 - w / 2;
    const tone = this.toastBad ? PAL.amber : PAL.toxic;
    plate(c, x, 52, w, 24, { rivets: false, stroke: tone });
    icon(c, this.toastBad ? 'alert' : 'check', x + 13, 64, 9, tone);
    this.text(this.toastMsg, x + 23, 64.5, TYPE.label, PAL.bone, 'left', UI, 700);
    c.restore();
    done();
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
