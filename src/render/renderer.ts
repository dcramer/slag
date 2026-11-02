import { css, type HSL, shift, toRgb } from '../core/color';
import { clamp } from '../core/geom';
import type { Match, Player } from '../game/match';
import { overview, raceFloor } from '../game/view';
import { TILE, VIEW_H, VIEW_W } from '../sim/constants';
import { floorY, type Level, tileAt } from '../sim/level';
import type { Solid } from '../sim/physics';
import { type Beam, footprint, motionOffset, previewProps, type Resolved, resolveProp } from '../sim/props';
import type { RunWorld } from '../sim/run';
import type { GameEvent } from '../sim/types';
import { Backdrop } from './background';
import { drawBlood } from './blood';
import { Camera } from './camera';
import { PhoneCam, phoneView } from './camera-follow';
import { Rig } from './character';
import { drawInkAccessory, drawInkAfterimage, drawInkRunner, partsOf, ropeAnchor, ropeOf } from './ink-character';
import { ForegroundLayer, Lettering, letteringAllowed } from './cel';
import { Fx, type Part } from './fx';
import { frameReach, VIEW_FRAME, type ViewFrame, viewFrame } from './frame';
import { Hud } from './hud';
import { drawClouds, drawDrops, drawRunnerItems, itemFx } from './items';
import { drawPocketBlocks, drawShells, drawShellShadows } from './items-extra';
import { circle, flutter, type Light, light, type RC } from './kit';
import { type Compositor, createCompositor } from './post';
import {
  drawBackdrop,
  drawBlastPreview,
  drawForeground,
  drawProjectile,
  drawResolved,
  drawHeld,
  drawRideCue,
  drawRunnerStatus,
  type Emit,
  propEventFx,
} from './props';
import { LightOccluder } from './occlude';
import { Surround } from './surround';
import { TerrainPainter } from './terrain';
import { skyGust, WeatherLayer } from './weather';
// Mobile: quality tiers / adaptive resolution / safe-area insets (owned by the touch module).
import { detectQuality, FrameBudget, isTouchFirst, QUALITY, type QualityTier, safeInsets, TIERS } from '../ui/touch/device';

/** Terrain bake budget (px per baked canvas): a classic level at 1920 px wide is ~4.3 M. */
const MAX_BAKE_PX = 6_000_000;
/** Rows above the world's bottom that a pool reaches, its heat haze included: where scenery cuts it (Surround.cutPool). */
const POOL_ROWS = 6;
/** Phone HUD: enough scale for 1.25 CSS px per HUD px, within this limit. */
const HUD_CSS_PER_PX = 1.25;
const MAX_HUD_SCALE = 1.8;
/** Smallest touch target, in CSS px. */
const TAP_CSS = 44;
/** The colors of the parts a character breaks into (a robot's gears, a plumber's coins), when they fly. */
const PART_COLOR: Record<Exclude<Part, 'shard'>, HSL> = {
  gear: { h: 40, s: 42, l: 50 },
  spring: { h: 30, s: 4, l: 64 },
  key: { h: 30, s: 4, l: 58 },
  bolt: { h: 20, s: 8, l: 40 },
  wheel: { h: 20, s: 8, l: 34 },
  coin: { h: 45, s: 70, l: 55 },
};

const RUNNER_KEY: HSL = { h: 40, s: 30, l: 90 };

/** The prop a player is about to place, as it would stand under their cursor. */
function ghostProp(m: Match, p: Player): Resolved | null {
  const gh = m.phase === 'place' && !p.placed ? m.ghostOrigin(p) : null;
  return gh && resolveProp({ uid: 900 + p.slot, def: gh.def, owner: p.slot, tx: gh.tx, ty: gh.ty, rot: p.rot, ...(gh.ride && { ride: gh.ride }) });
}

// Speed trail. Vertical speed counts for less: a jump's launch is fast, but a walking hop isn't speed.
const TRAIL_RISE = 0.5;
/** px/s where the trail starts (past a walk, so a flat-out run shows a short echo) and where it peaks. */
const TRAIL_MIN_SPEED = 140;
const TRAIL_FULL_SPEED = 300;
/** Peak opacity of one sample, how far apart samples sit (px), and seconds to fade out. */
const TRAIL_ALPHA = 0.28;
const TRAIL_GAP = 7;
const TRAIL_LIFE = 0.2;

/**
 * Orchestrates a frame: Canvas2D paints background, foreground, emissive and
 * light layers in world space through a smoothed camera, the WebGL compositor
 * runs them through the cel pass, and a separate 2D canvas carries the HUD.
 */
export class Renderer {
  private scene = document.createElement('canvas');
  private glow = document.createElement('canvas');
  /** Milliseconds a frame may spend inking a new level. Infinity bakes it whole at once (stepped screenshots, perf). */
  bakeBudgetMs = 5;
  private lightC = document.createElement('canvas');
  private occluder = new LightOccluder();
  private sctx = this.scene.getContext('2d')!;
  private gctx = this.glow.getContext('2d')!;
  private lctx = this.lightC.getContext('2d')!;
  private comp: Compositor;
  readonly hud: Hud;
  private cam = new Camera();
  /** Phones: the close race camera and hand-moved pick/place view (off elsewhere). See camera-follow.ts. */
  readonly phone = new PhoneCam(this.cam);
  private backdrop = new Backdrop();
  private terrain = new TerrainPainter();
  private surround = new Surround();
  /** Per slot, the ghost the match last turned down (it would have left no way to the flag): it stays red until it moves. */
  private refused = new Map<number, string>();
  private fx = new Fx();
  private weather = new WeatherLayer();
  private rigs = new Map<number, Rig>();
  private pw = 2;
  private ph = 2;
  private frameBox: ViewFrame = VIEW_FRAME;
  /** Invisible box over the play view: the 0..VIEW_W×0..VIEW_H area that pointers map through. */
  readonly viewBox = document.createElement('div');
  private last = 0;
  private flash = 0;
  private lobbyDrift = 0;
  /** Render quality tier: caps internal resolution (MAX_W) and DPR. See src/ui/touch/device.ts. */
  quality: QualityTier;
  private adaptive: boolean;
  private budget = new FrameBudget();
  private letters = new Lettering();
  private foreground = new ForegroundLayer();
  private wordsOn = letteringAllowed(typeof location !== 'undefined' ? location.search : '');
  private life = new AbortController();

  constructor(
    private glCanvas: HTMLCanvasElement,
    private hudCanvas: HTMLCanvasElement,
  ) {
    this.comp = createCompositor(glCanvas);
    this.hud = new Hud(hudCanvas.getContext('2d')!);
    this.hud.worldToView = (x, y) => this.cam.worldToView(x, y);
    this.viewBox.dataset.slagView = '';
    this.viewBox.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    glCanvas.parentElement?.append(this.viewBox);
    ({ tier: this.quality, adaptive: this.adaptive } = detectQuality());
    this.resize();
    const on = { signal: this.life.signal };
    window.addEventListener('resize', () => this.resize(), on);
    // Mobile: rotation can report stale sizes on the first resize; settle once more after it.
    window.addEventListener('orientationchange', () => setTimeout(() => !this.life.signal.aborted && this.resize(), 250), on);
  }

  /** Let go of the window and the GPU: the game is leaving this page (the canvases go with its container). */
  dispose() {
    this.life.abort();
    this.comp.dispose?.();
    this.viewBox.remove();
  }

  /** Which compositor and quality tier this device ended up on, for error reports. */
  get renderStyle(): string {
    return `${this.comp.webgl ? 'webgl2' : 'canvas2d'}:${this.quality}`;
  }

  /** Change the render quality tier (e.g. from settings) and re-allocate buffers. */
  setQuality(q: QualityTier) {
    this.quality = q;
    this.resize();
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const q = QUALITY[this.quality];
    const dpr = Math.min(q.dprCap, window.devicePixelRatio || 1);
    // Canvases fill the window; the play view keeps its aspect and scale inside it, clear of the
    // notch and status bar. Layers fill the rest (frame.ts). The bottom home-indicator strip may
    // overlap the picture; touch controls keep clear of it.
    const f = viewFrame(vw, vh, safeInsets());
    this.frameBox = f;
    this.cam.setFrame(f);
    this.hud.setFrame(f);
    for (const c of [this.glCanvas, this.hudCanvas]) {
      c.style.position = 'absolute';
      c.style.left = '0';
      c.style.top = '0';
      c.style.width = `${vw}px`;
      c.style.height = `${vh}px`;
    }
    Object.assign(this.viewBox.style, { left: `${f.left}px`, top: `${f.top}px`, width: `${f.width}px`, height: `${f.height}px` });
    // The quality cap is per play-view width; the same pixel density carries over the whole window.
    this.pw = Math.max(2, Math.round(Math.min((q.maxW * f.w) / VIEW_W, vw * dpr)));
    this.ph = Math.round((this.pw * vh) / vw);
    for (const c of [this.scene, this.glow, this.glCanvas, this.hudCanvas]) {
      c.width = this.pw;
      c.height = this.ph;
    }
    this.lightC.width = Math.max(2, this.pw >> 1);
    this.lightC.height = Math.max(2, this.ph >> 1);
    this.comp.resize(this.pw, this.ph);
    this.hud.resize(this.pw, this.ph);
    const cssPerView = f.width / VIEW_W;
    const { enabled, zoom } = phoneView(location.search, Math.min(vw, vh), isTouchFirst(), cssPerView);
    this.phone.enabled = enabled;
    this.phone.zoom = zoom;
    this.hud.uiScale = enabled ? Math.max(1, Math.min(MAX_HUD_SCALE, HUD_CSS_PER_PX / cssPerView)) : 1;
    this.hud.tapMin = enabled ? TAP_CSS / cssPerView : 0;
  }

  /** Called after every frame with `logoBox()`: the game lays the DOM logo there (src/ui/screens/logo.ts). */
  placeLogo: ((box: { x: number; y: number; size: number } | null) => void) | null = null;

  /** Where the HUD put the logo this frame, in CSS px of the window, or null when it shows none. */
  logoBox(): { x: number; y: number; size: number } | null {
    const b = this.hud.logoAt;
    if (!b || this.hud.hidden) return null;
    const f = this.frameBox;
    const k = f.width / VIEW_W;
    return { x: f.left + b.x * k, y: f.top + b.y * k, size: b.size * k };
  }

  /** A view-px pointer as the match reads it this phase: through this device's card zoom in pick and its camera in place. */
  pointerToMatch(phase: string, p: { x: number; y: number }): { x: number; y: number } {
    if (phase === 'pick') return this.hud.pickToLogical(p);
    return phase === 'place' ? this.phone.toBoard(p) : p;
  }

  /** Paint one frame. `events` are this frame's drained sim events (shared with audio). */
  render(m: Match, now: number, events: readonly GameEvent[] = []) {
    const t = now / 1000;
    // Mobile: adaptive resolution. Sustained slow frames drop one quality tier (never back up).
    if (this.adaptive && this.last && this.budget.push((t - this.last) * 1000)) {
      const i = TIERS.indexOf(this.quality);
      if (i < TIERS.length - 1) this.setQuality(TIERS[i + 1]);
      else this.adaptive = false;
    }
    const dt = Math.min(0.05, this.last ? t - this.last : 1 / 60);
    this.last = t;
    const level = m.level;
    const ww = level.w * TILE;
    const wh = level.h * TILE;
    // Bake resolution: enough for the race zoom, capped by a pixel budget so huge levels stay cheap.
    const frameBox = this.frameBox;
    const sk = this.pw / frameBox.w;
    const kb = Math.min(4, sk * Math.max(1.45, this.phone.enabled ? this.phone.zoom : 0), Math.sqrt(MAX_BAKE_PX / (ww * wh)));
    // A new level is inked a chunk at a time, nearest the camera first, so loading one never stalls a frame.
    const focus = { x: this.cam.x, y: this.cam.y };
    this.terrain.ensure(level, kb, undefined, this.bakeBudgetMs, { x: focus.x / TILE, y: focus.y / TILE });
    // The surroundings reach as far as the most zoomed-out view of this level can see.
    const reach = frameReach(frameBox, ww, wh, raceFloor(level));
    // The level first: until it's done, the surroundings wait their turn.
    this.surround.ensure(
      level,
      reach,
      Math.min(kb, Math.sqrt(MAX_BAKE_PX / ((ww + reach.x * 2) * (wh + reach.up + reach.down)))),
      this.terrain.baking ? 0 : this.bakeBudgetMs,
      focus,
    );
    const emit: Emit = (kind, x, y, vx, vy, color) =>
      this.fx.add(
        kind,
        x,
        y,
        vx,
        vy,
        color ?? { h: 40, s: 100, l: 70 },
        kind === 'spark' ? 1 : kind === 'smoke' ? 2 : 1.2,
        kind === 'smoke' ? 1.2 : kind === 'spark' ? 0.35 : 0.8,
      );
    this.consume(m, events);
    this.fx.update(dt, level);
    this.letters.update(dt);
    this.updateCamera(m, dt);

    const s = this.sctx;
    const g = this.gctx;
    const lights: Light[] = [];
    const frame = m.run && m.phase === 'run' ? m.run.frame : m.frame;
    const rc: RC = { s, bg: s, g, lights, t, frame, gust: skyGust(m) };

    // --- background (screen space, parallax from camera)
    const ox = -frameBox.x0 * sk;
    const oy = -frameBox.y0 * sk;
    s.setTransform(sk, 0, 0, sk, ox, oy);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.pw, this.ph);
    g.globalCompositeOperation = 'lighter';
    g.setTransform(sk, 0, 0, sk, ox, oy);
    // Zoom the backdrop a little with the camera so parallax feels physical.
    const bz = 1 + Math.max(0, this.cam.zoom - 1) * 0.35;
    for (const c of [s, g]) {
      c.translate(VIEW_W / 2, VIEW_H / 2);
      c.scale(bz, bz);
      c.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    this.backdrop.draw(rc, level.theme, this.cam, Math.min(2.5, sk * 1.2));

    // --- world
    this.cam.apply(s, this.pw);
    this.cam.apply(g, this.pw);
    this.surround.draw(rc);
    const run = m.phase === 'run' ? m.run : null;
    // Set pieces are part of the level: show them in every phase (lobby, pick, place), not just races.
    const resolved = run ? run.resolved : [...level.setPieces, ...m.placed].map(resolveProp);
    // Scenery goes down first so the terrain stands in front of it and shadows it.
    for (const r of resolved) drawBackdrop(rc, r, { level });
    // The rest of the world goes on its own transparent layer (see ForegroundLayer); `s` stays the background.
    rc.s = this.foreground.begin(this.scene, s, g, level.theme.ambientLight);
    this.cam.apply(rc.s, this.pw);
    // Liquids sit behind the terrain (docs/DESIGN.md, render layers): it stands in the pool, and its bake cuts the pool's glow.
    const dry = this.backdrop.drawLiquid(rc, level.theme, ww, wh, this.cam.visible(), this.surround.margin, (c) => this.surround.drawSunken(c, level));
    for (const c of [rc.s, g]) this.surround.cutPool(c, level, POOL_ROWS, dry);
    // Ground stands in the pool down to the world's bottom, but the surface is above that: what's under it is the pool's sunken pass.
    for (const c of [rc.s, g]) {
      c.save();
      c.clip(dry);
    }
    this.terrain.draw(rc);
    rc.s.restore();
    g.restore();
    const pushers = m.run ? m.run.runners.filter((r) => r.alive).map((r) => ({ x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h, vy: r.body.vy })) : [];
    this.terrain.drawLive(rc, level, pushers);
    this.drawMarkers(rc, level);
    drawBlood(rc, m, frame);

    const grips = run?.runners.flatMap((r) => r.attach.grip ?? []);
    // A race's beams are the ones the sim hurts with. Before one, ghosts join in: a block you're holding cuts the flame it would stop.
    const ghosts = run ? [] : m.players.flatMap((p) => ghostProp(m, p) ?? []);
    const still = run ? null : previewProps(level, [...resolved, ...ghosts], frame);
    const beams = still ? still.beams : run!.beams;
    // Weather lies on what's built in every phase, but not on a ghost: that's only where a part would go.
    const solids = still ? still.solids.filter((x) => !ghosts.some((gh) => gh.pp.uid === x.propUid)) : run!.solids;
    for (const r of resolved) {
      drawForeground(rc, r, {
        level,
        state: run?.propState.get(r.pp.uid),
        broken: run ? run.isBroken(r.pp.uid) : false,
        showPath: m.phase !== 'run',
        emit: run ? emit : undefined,
        grips,
        placed: m.placed,
        beams,
        solids,
        runners: pushers,
      });
    }

    if (m.phase === 'place') this.drawGhosts(rc, m, beams, still?.solids ?? []);
    if (m.phase === 'lobby' || m.phase === 'pick' || m.phase === 'place') this.drawIdlers(rc, m, dt);

    if (run) {
      for (const p of run.projectiles) drawProjectile(rc, p, emit);
      this.drawSafeZone(rc, level, run);
      drawPocketBlocks(rc, run);
      drawShellShadows(rc, run);
      drawDrops(rc, run);
      // All trails first: in a pack, nobody's trail may paint over another runner.
      for (const r of run.runners) {
        const pl = m.player(r.slot);
        if (r.alive && pl) this.drawTrail(pl.character, r.slot, r.body.x + r.body.w / 2, r.body.y + r.body.h, r.body.vx, r.body.vy, dt);
      }
      for (const r of run.runners) {
        if (!r.alive) continue;
        const pl = m.player(r.slot);
        if (!pl) continue;
        if (r.attach.grip?.sealed) {
          drawHeld(rc, run, r, pl.character);
          drawRunnerStatus(rc, r.body, r.status);
          continue;
        }
        this.drawRunner(
          rc,
          level,
          pl.character,
          r.slot,
          r.body.x + r.body.w / 2,
          r.body.y + r.body.h,
          r.body.vx,
          r.body.vy,
          r.body.onGround,
          r.body.facing,
          r.finished,
          dt,
          r.body.wallDir,
        );
        if (!r.finished && run.isSafe(r)) this.drawShield(rc, level, r.body.x + r.body.w / 2, r.body.y + r.body.h, r.slot);
        drawRunnerStatus(rc, r.body, r.status, r.attach.soot - run.frame);
        drawRunnerItems(rc, r);
      }
      drawClouds(rc, run);
      drawShells(rc, run);
    }
    this.fx.draw(rc);
    this.backdrop.drawMotes(rc, level.theme, dt, this.cam.visible());
    this.weather.draw(rc, m, this.cam.visible(), this.fx, solids);
    g.globalCompositeOperation = 'source-over';

    // --- light map
    this.paintLights(level, lights);

    // --- composite
    this.flash *= Math.exp(-dt * 9);
    this.comp.render(this.scene, this.foreground.canvas, this.lightC, this.glow, {
      exposure: level.theme.grade.exposure * this.weather.exposure(level),
      mist: this.weather.mist(m, this.cam, this.pw, this.ph, t),
      flash: this.flash,
      tint: level.theme.grade.tint,
      lift: level.theme.grade.lift,
      scale: rc.s.getTransform().a,
      originX: rc.s.getTransform().e,
      originY: rc.s.getTransform().f,
      ambient: level.theme.ambientLight,
    });
    if (!this.hud.hidden) this.hud.draw(m, t, this.pw, this.ph);
    else this.hud.clear(this.pw, this.ph);
    if (this.wordsOn) this.letters.draw(this.hudCanvas.getContext('2d')!, this.cam, this.pw);
    this.placeLogo?.(this.logoBox());
  }

  /**
   * Race: follow the live runners (zooming out to keep them all in, down to
   * a readability floor). Lobby: slow drift over the level. Pick/place: snap
   * to the deterministic whole-level overview the match uses for cursors, or
   * to where this phone's fingers moved it.
   */
  private updateCamera(m: Match, dt: number) {
    const lv = m.level;
    const ww = lv.w * TILE;
    const wh = lv.h * TILE;
    const ov = overview(lv);
    if (m.phase === 'pick' || m.phase === 'place') {
      this.cam.setBounds(ww, wh, ov.zoom);
      this.cam.snap(this.phone.board(m, dt));
      this.cam.update(dt, false);
      return;
    }
    this.cam.setBounds(ww, wh, raceFloor(lv));
    if (m.phase === 'run' && m.run) {
      this.phone.frameRace(m, dt);
      return;
    }
    if (m.phase === 'lobby') {
      // Slow cinematic drift over the level preview (wider sweep on big levels).
      this.lobbyDrift += dt;
      const a = this.lobbyDrift * 0.12;
      const ax = Math.max(200, ww / 2 - 240);
      const ay = Math.max(60, wh / 2 - 160);
      this.cam.focus([{ x: ww / 2 + Math.cos(a) * ax, y: wh / 2 + Math.sin(a * 1.3) * ay }], 1.18, 160);
    } else this.cam.wide();
    this.cam.update(dt);
  }

  /** World → view coords (0..VIEW_W × 0..VIEW_H in the play view) through the current camera; for HUD overlays drawn in screen space. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return this.cam.worldToView(x, y);
  }

  private paintLights(level: Level, lights: Light[]) {
    const l = this.lctx;
    const th = level.theme;
    const [ar, ag, ab] = toRgb(th.ambientTint);
    const amb = th.ambientLight * 0.5;
    const rgb = [ar, ag, ab].map((c) => Math.round(255 * amb * (0.65 + c * 0.35))) as [number, number, number];
    const ambient = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = ambient;
    l.fillRect(0, 0, this.lightC.width, this.lightC.height);
    this.cam.apply(l, this.lightC.width);
    l.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const a = Math.min(1, L.intensity) * 0.55;
      if (a <= 0.01) continue;
      const gr = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      gr.addColorStop(0, css(L.color, 5, a));
      gr.addColorStop(0.4, css(L.color, 0, a * 0.45));
      gr.addColorStop(1, css(L.color, 0, 0));
      l.fillStyle = gr;
      l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    l.globalCompositeOperation = 'source-over';
    this.occluder.draw(l, level, rgb);
    // Sky light falls from above: brighten the upper part a little, rock and air alike.
    l.setTransform(1, 0, 0, 1, 0, 0);
    const sky = l.createLinearGradient(0, 0, 0, this.lightC.height);
    sky.addColorStop(0, `rgba(255,255,255,${0.1 * th.ambientLight})`);
    sky.addColorStop(1, 'rgba(255,255,255,0)');
    l.globalCompositeOperation = 'lighter';
    l.fillStyle = sky;
    l.fillRect(0, 0, this.lightC.width, this.lightC.height);
    l.globalCompositeOperation = 'source-over';
  }

  private drawMarkers(rc: RC, level: Level) {
    const s = rc.s;
    const g = rc.g;
    const t = rc.t;
    const th = level.theme;
    // Spawn portal.
    const sx = level.spawn.tx * TILE + TILE / 2;
    const sy = floorY(level.spawn);
    const pc: HSL = shift(th.accent, 0, 0, 40);
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = css(pc, 10, 0.5 - i * 0.12);
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(sx, sy - 1, 16 - i * 3, 3.5 - i * 0.6, 0, (t * (2 + i)) % (Math.PI * 2), ((t * (2 + i)) % (Math.PI * 2)) + Math.PI * 1.4);
      g.stroke();
    }
    // The beam: two flat steps, not a fade, so the runners standing in it keep their own colors.
    g.fillStyle = css(pc, 10, 0.07);
    g.fillRect(sx - 12, sy - 34, 24, 34);
    g.fillStyle = css(pc, 10, 0.07);
    g.fillRect(sx - 12, sy - 14, 24, 14);

    // Goal beacon: flag + light column.
    const gx = level.goal.tx * TILE + TILE / 2;
    const gy = floorY(level.goal);
    const ac = th.accent;
    // A flat column with a brighter core: it reads across the level without a soft fade.
    g.fillStyle = css(ac, 10, 0.1 + Math.sin(t * 3) * 0.03);
    g.fillRect(gx - 8, 0, 16, gy);
    g.fillStyle = css(ac, 30, 0.3);
    g.fillRect(gx - 2, 0, 4, gy);
    s.fillStyle = '#d8dce4';
    s.fillRect(gx - 1, gy - 28, 2, 28);
    s.fillStyle = '#ffd23f';
    circle(s, gx, gy - 29, 1.8);
    s.fillStyle = css(ac, 5);
    s.beginPath();
    s.moveTo(gx + 1, gy - 28);
    // It hangs in still air, and only flies in a wind that's really blowing.
    const fly = Math.abs(rc.gust ?? 0);
    const flap = (i: number) => (flutter(rc, 6, -i * 0.8) * 1.4 + (1 - fly) * 7) * (i / 7);
    for (let i = 0; i <= 7; i++) s.lineTo(gx + 1 + i * 2.2, gy - 28 + flap(i));
    s.lineTo(gx + 16, gy - 19 + flap(7));
    for (let i = 7; i >= 0; i--) s.lineTo(gx + 1 + i * 2.2, gy - 19 + flap(i));
    s.closePath();
    s.fill();
    light(rc, gx, gy - 20, 90, ac, 0.7);
  }

  /** Faint shimmer over the spawn safe zone during a race (runners touching it are immune to props). */
  private drawSafeZone(rc: RC, level: Level, run: RunWorld) {
    const z = run.safeZone;
    if (!z) return;
    const g = rc.g;
    const pc: HSL = shift(level.theme.accent, 0, 0, 40);
    // Only the air above the spawn floor; the rect also covers the floor row.
    const bottom = Math.min(z.y + z.h, floorY(level.spawn));
    const h = bottom - z.y;
    if (h <= 0) return;
    const a = 0.07 + Math.sin(rc.t * 2.2) * 0.02;
    g.fillStyle = css(pc, 10, a * 0.5);
    g.fillRect(z.x, z.y, z.w, h);
    // Shimmering edge where protection ends.
    const ex = z.x + z.w - 0.5;
    g.strokeStyle = css(pc, 20, a * 2);
    g.lineWidth = 1;
    g.setLineDash([2, 4]);
    g.lineDashOffset = -rc.t * 8;
    g.beginPath();
    g.moveTo(ex, z.y);
    g.lineTo(ex, bottom);
    g.stroke();
    g.setLineDash([]);
    g.lineDashOffset = 0;
  }

  /** Faint bubble around a runner protected by the spawn zone. */
  private drawShield(rc: RC, level: Level, x: number, y: number, slot: number) {
    const g = rc.g;
    const pc: HSL = shift(level.theme.accent, 0, 0, 40);
    const p = rc.t * 3 + slot * 1.7;
    g.strokeStyle = css(pc, 20, 0.22 + Math.sin(p) * 0.08);
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, y - 8, 10, 11.5, 0, p % (Math.PI * 2), (p % (Math.PI * 2)) + Math.PI * 1.6);
    g.stroke();
  }

  private drawGhosts(rc: RC, m: Match, beams: readonly Beam[], solids: readonly Solid[]) {
    const s = rc.s;
    // Off-limits zones.
    s.save();
    for (const r of m.level.protectedRects) {
      s.fillStyle = 'rgba(255,50,50,0.08)';
      s.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
      s.strokeStyle = 'rgba(255,80,80,0.35)';
      s.setLineDash([3, 3]);
      s.strokeRect(r.x * TILE + 0.5, r.y * TILE + 0.5, r.w * TILE - 1, r.h * TILE - 1);
    }
    s.setLineDash([]);
    s.restore();
    for (const p of m.players) {
      if (p.placed) continue;
      const gh = m.ghostOrigin(p);
      const ghost = ghostProp(m, p);
      if (!gh || !ghost) continue;
      const ok = gh.ok && this.refused.get(p.slot) !== ghostKey(m, p, gh);
      const col = ok ? p.character.body : { h: 0, s: 90, l: 55 };
      s.globalAlpha = 0.85;
      rc.g.globalAlpha = 0.85;
      drawResolved(rc, ghost, { level: m.level, showPath: true, beams, solids, placed: m.placed });
      s.globalAlpha = 1;
      rc.g.globalAlpha = 1;
      const bomb = gh.def.modules.find((x) => x.type === 'bomb');
      if (bomb && bomb.type === 'bomb') drawBlastPreview(rc, m.level, m.placed, bomb, gh.tx, gh.ty, p.rot);
      // A part that will ride a mover shows the loop it'll travel and the link it hangs on.
      drawRideCue(rc, ghost, solids, col);
      // The footprint as one outline round its tiles: exact enough to line up by, and it doesn't rule a grid over the part. A rider's is where it rides.
      const cells = footprint(gh.def, p.rot);
      const [ox, oy] = motionOffset(ghost, rc.frame);
      const set = new Set(cells.map(([x, y]) => `${x},${y}`));
      rc.g.strokeStyle = css(col, 10, 0.8);
      rc.g.lineWidth = 1.2;
      rc.g.beginPath();
      for (const [x, y] of cells) {
        const x0 = (gh.tx + x) * TILE + ox + 0.5;
        const y0 = (gh.ty + y) * TILE + oy + 0.5;
        const x1 = x0 + TILE - 1;
        const y1 = y0 + TILE - 1;
        const side = (open: boolean, ax: number, ay: number, bx: number, by: number) => {
          if (!open) return;
          rc.g.moveTo(ax, ay);
          rc.g.lineTo(bx, by);
        };
        side(!set.has(`${x},${y - 1}`), x0, y0, x1, y0);
        side(!set.has(`${x + 1},${y}`), x1, y0, x1, y1);
        side(!set.has(`${x},${y + 1}`), x0, y1, x1, y1);
        side(!set.has(`${x - 1},${y}`), x0, y0, x0, y1);
      }
      rc.g.stroke();
    }
  }

  /** Outside the race, players' characters idle on the spawn pad so the world feels inhabited. */
  private drawIdlers(rc: RC, m: Match, dt: number) {
    const lv = m.level;
    const n = m.players.length;
    m.players.forEach((p, i) => {
      const x = lv.spawn.tx * TILE + TILE / 2 + (i - (n - 1) / 2) * 9;
      const y = floorY(lv.spawn);
      this.drawRunner(rc, lv, p.character, p.slot, x, y, 0, 0, true, Math.sin(rc.t * 0.5 + i) > 0 ? 1 : -1, p.ready, dt);
    });
  }

  /** Fades in with speed, so a walk leaves nothing and the trail only shows when a runner is really moving. */
  private drawTrail(c: Match['players'][number]['character'], slot: number, x: number, y: number, vx: number, vy: number, dt: number) {
    const rig = this.rigs.get(slot);
    if (!rig) return;
    const k = clamp((Math.hypot(vx, vy * TRAIL_RISE) - TRAIL_MIN_SPEED) / (TRAIL_FULL_SPEED - TRAIL_MIN_SPEED), 0, 1);
    const tail = rig.trail.at(-1);
    if (k > 0 && (!tail || Math.hypot(x - tail.x, y - tail.y) >= TRAIL_GAP)) rig.trail.push({ x, y, a: k * TRAIL_ALPHA });
    rig.trail = rig.trail.filter((p) => (p.a -= (dt * TRAIL_ALPHA) / TRAIL_LIFE) > 0);
    // On the background layer: an afterimage is a flat ghost, and shouldn't get ink of its own.
    for (const p of rig.trail) drawInkAfterimage(this.sctx, c, p.x, p.y, p.a);
  }

  private drawRunner(
    rc: RC,
    level: Level,
    c: Match['players'][number]['character'],
    slot: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    grounded: boolean,
    facing: number,
    celebrate: boolean,
    dt: number,
    wall = 0,
  ) {
    let rig = this.rigs.get(slot);
    if (!rig || rig.rope.length === 0 || Math.hypot(rig.rope[0].x - x, rig.rope[0].y - y) > 60) {
      rig = new Rig();
      this.rigs.set(slot, rig);
    }
    // Landing / jump dust and fast-motion trail.
    if (grounded && !rig.wasGrounded && rig.lastVy > 180) this.fx.burst('dust', x, y, 8, 50, [shift(level.theme.terrain.light, 10)], 1.6, 0.6);
    if (!grounded && rig.wasGrounded && vy < -100) this.fx.burst('dust', x, y, 5, 35, [shift(level.theme.terrain.light, 10)], 1.2, 0.5);
    if (grounded && Math.abs(vx) > 100 && Math.random() < 0.25)
      this.fx.add('dust', x - Math.sign(vx) * 4, y - 1, -vx * 0.15, -10, shift(level.theme.terrain.light, 10), 1, 0.4);
    rig.wasGrounded = grounded;
    rig.lastVy = vy;

    // Contact shadow on whatever is below.
    const tx = Math.floor(x / TILE);
    let gy = -1;
    for (let ty = Math.floor((y - 1) / TILE); ty < level.h && ty < Math.floor(y / TILE) + 8; ty++) {
      if (tileAt(level, tx, ty)) {
        gy = ty * TILE;
        break;
      }
    }
    if (gy >= 0) {
      const d = Math.max(0, gy - y);
      const a = Math.max(0, 0.4 - d / 200);
      rc.s.fillStyle = `rgba(0,0,0,${a})`;
      rc.s.beginPath();
      rc.s.ellipse(x, gy, 7 - Math.min(4, d / 25), 1.8, 0, 0, Math.PI * 2);
      rc.s.fill();
    }

    const rope = ropeOf(c);
    if (rope) {
      // A pull string trails from the chassis, a scarf from the neck. A little air always pulls it off
      // behind, so standing still it trails instead of hanging like a pole.
      const at = ropeAnchor(c, facing);
      rig.step(rope, x + at.x, y + at.y, dt, -vx * 0.6 - facing * 8 + (rc.gust ?? 0) * 60, gy >= 0 ? gy - 0.8 : Infinity);
      drawInkAccessory(rc.s, c, rig);
    }
    drawInkRunner(rc, c, x, y, { facing, vx, vy, grounded, t: rc.t, celebrate, wall });
    // A small neutral key light so a runner in shade still reads. Not in its own color, and no bigger than
    // it needs to cover the body: a colored pool tints the pack into one hue and paints a halo behind it.
    light(rc, x, y - 9, 26, RUNNER_KEY, 0.4);
  }

  private propCenter(m: Match, uid: number): { x: number; y: number } | undefined {
    const cells = m.run?.resolved.find((x) => x.pp.uid === uid)?.mods.flatMap((mod) => (mod.type === 'body' ? mod.cells : []));
    if (!cells?.length) return undefined;
    const x = cells.reduce((a, [cx]) => a + cx, 0) / cells.length;
    const y = Math.min(...cells.map(([, cy]) => cy));
    return { x: (x + 0.5) * TILE, y: y * TILE };
  }

  private consume(m: Match, events: readonly GameEvent[]) {
    const th = m.level.theme;
    for (const e of events) {
      if (this.wordsOn) this.letters.event(e, e.type === 'crumble-break' ? this.propCenter(m, e.uid) : undefined);
      switch (e.type) {
        case 'death': {
          const c = m.player(e.slot)?.character;
          const body = c?.body ?? { h: 0, s: 0, l: 80 };
          if (e.cause === 'fall') {
            const pool = m.level.h * TILE;
            this.fx.burst('splash', e.x, Math.min(e.y, pool - 10), 26, 180, [th.liquid.glow, th.liquid.color], 2, 0.9, 120);
            this.fx.burst('smoke', e.x, Math.min(e.y, pool - 12), 8, 30, [{ h: 0, s: 0, l: 50 }], 3, 1.4);
          } else {
            // The character comes apart: its own parts, if it has any, and shards of its colors and the player's.
            const parts = c ? partsOf(c) : ['shard' as const];
            for (let i = 0; i < 14; i++) {
              const part = i < 6 ? parts[i % parts.length] : 'shard';
              const col = part === 'shard' ? (i % 2 ? body : (c?.paint ?? body)) : PART_COLOR[part];
              this.fx.part(part, e.x, e.y, 230, col, part === 'shard' ? 2 : 3, 2.2);
            }
            this.fx.burst('spark', e.x, e.y, 18, 260, [{ h: 45, s: 100, l: 70 }, body], 1.2, 0.5);
            this.fx.add('ring', e.x, e.y, 0, 0, body, 40, 0.45);
            this.fx.add('flash', e.x, e.y, 0, 0, shift(body, 20), 26, 0.25);
          }
          this.cam.shake = Math.max(this.cam.shake, 6);
          this.flash = Math.max(this.flash, 0.08);
          break;
        }
        case 'finish': {
          const c = m.player(e.slot)?.character;
          this.fx.burst(
            'confetti',
            e.x,
            e.y,
            50,
            240,
            [{ h: 45, s: 100, l: 60 }, { h: 190, s: 90, l: 55 }, { h: 330, s: 90, l: 60 }, { h: 100, s: 90, l: 55 }, c?.body ?? th.accent],
            1.6,
            2.4,
            220,
          );
          this.fx.add('ring', e.x, e.y, 0, 0, th.accent, 60, 0.6);
          this.fx.add('flash', e.x, e.y, 0, 0, th.accent, 40, 0.35);
          break;
        }
        case 'spring':
          this.fx.add('ring', e.x, e.y, 0, 0, { h: 50, s: 100, l: 70 }, 18, 0.3);
          this.fx.burst('dust', e.x, e.y, 6, 60, [{ h: 0, s: 0, l: 85 }], 1.2, 0.4);
          break;
        case 'pop':
          if (e.ammo === 'snowball') {
            // A snowball bursts into powder and clods.
            this.fx.burst('dust', e.x, e.y, 10, 90, [{ h: 205, s: 22, l: 94 }], 1.8, 0.7);
            this.fx.burst('debris', e.x, e.y, 6, 120, [{ h: 205, s: 20, l: 90 }], 1.2, 0.8, 80);
          } else if (e.ammo === 'cannonball') {
            this.fx.burst('debris', e.x, e.y, 10, 160, [th.terrain.base, th.terrain.dark], 1.4, 1.2, 80);
            this.fx.burst('smoke', e.x, e.y, 6, 40, [{ h: 0, s: 0, l: 50 }], 3, 1);
            this.fx.add('flash', e.x, e.y, 0, 0, { h: 35, s: 100, l: 60 }, 20, 0.2);
            this.cam.shake = Math.max(this.cam.shake, 3);
          } else if (e.ammo === 'fireball' || e.ammo === 'plasma') {
            const col = e.ammo === 'fireball' ? { h: 30, s: 100, l: 60 } : { h: 190, s: 100, l: 60 };
            this.fx.burst('ember', e.x, e.y, 14, 120, [col], 1.4, 0.6);
            this.fx.add('flash', e.x, e.y, 0, 0, col, 18, 0.2);
          } else this.fx.burst('spark', e.x, e.y, 8, 140, [{ h: 45, s: 60, l: 80 }], 1, 0.3);
          break;
        case 'fire':
          if (e.style === 'cannon') {
            this.fx.burst('smoke', e.x, e.y, 8, 50, [{ h: 0, s: 0, l: 55 }], 2.6, 1.1);
            this.cam.shake = Math.max(this.cam.shake, 1.5);
          } else if (e.style === 'cornice') this.fx.burst('smoke', e.x, e.y, 5, 30, [{ h: 205, s: 22, l: 94 }], 1.6, 0.6);
          else this.fx.burst('smoke', e.x, e.y, 2, 20, [{ h: 0, s: 0, l: 60 }], 1.2, 0.5);
          break;
        case 'crumble-break': {
          const r = m.run?.resolved.find((x) => x.pp.uid === e.uid);
          if (r) {
            for (const mod of r.mods) {
              if (mod.type !== 'body') continue;
              for (const [cx, cy] of mod.cells)
                this.fx.burst(
                  'debris',
                  (cx + 0.5) * TILE,
                  (cy + 0.5) * TILE,
                  6,
                  80,
                  [
                    { h: 32, s: 42, l: 54 },
                    { h: 30, s: 40, l: 35 },
                  ],
                  1.6,
                  1.2,
                );
            }
          }
          break;
        }
        case 'explosion':
          this.fx.burst('debris', e.x, e.y, 40, 300, [th.terrain.base, th.terrain.dark, th.terrain.light], 2, 1.6, 150);
          this.fx.burst(
            'ember',
            e.x,
            e.y,
            30,
            220,
            [
              { h: 30, s: 100, l: 60 },
              { h: 50, s: 100, l: 70 },
            ],
            1.5,
            0.8,
          );
          this.fx.burst('smoke', e.x, e.y, 16, 80, [{ h: 0, s: 0, l: 40 }], 4, 1.6);
          this.fx.add('ring', e.x, e.y, 0, 0, { h: 35, s: 100, l: 65 }, e.r * 1.6, 0.5);
          this.fx.add('flash', e.x, e.y, 0, 0, { h: 35, s: 100, l: 65 }, e.r, 0.4);
          this.cam.shake = 14;
          this.flash = 0.25;
          break;
        case 'refuse': {
          const p = m.player(e.slot);
          const gh = p && m.ghostOrigin(p);
          if (p && gh) this.refused.set(p.slot, ghostKey(m, p, gh));
          this.fx.add('ring', e.x, e.y, 0, 0, { h: 0, s: 90, l: 55 }, 24, 0.35);
          break;
        }
        case 'place': {
          const c = m.player(e.slot)?.character.body ?? th.accent;
          this.fx.add('ring', e.x, e.y, 0, 0, c, 30, 0.4);
          this.fx.burst('dust', e.x, e.y, 10, 70, [{ h: 0, s: 0, l: 85 }], 1.4, 0.5);
          this.cam.shake = Math.max(this.cam.shake, 2);
          break;
        }
        case 'item':
          itemFx(this.fx, e, (k) => (this.cam.shake = Math.max(this.cam.shake, k)));
          break;
        case 'prop':
          propEventFx(this.fx, e, (k) => (this.cam.shake = Math.max(this.cam.shake, k)));
          break;
        default:
          break;
      }
    }
  }
}

/** What a ghost is: part, turn and spot, and what else stands (a refusal can lift once something else goes in). */
function ghostKey(m: Match, p: Match['players'][number], gh: { def: { key: string }; tx: number; ty: number }): string {
  return `${gh.def.key}:${p.rot}:${gh.tx}:${gh.ty}:${m.placed.length}:${m.level.version}`;
}
