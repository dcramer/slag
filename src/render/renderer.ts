import { css, type HSL, shift, toRgb } from '../core/color';
import { clamp } from '../core/geom';
import type { Match } from '../game/match';
import { overview, raceFloor } from '../game/view';
import { TILE, VIEW_H, VIEW_W } from '../sim/constants';
import { type Level, tileAt } from '../sim/level';
import { canPlace, footprint, resolveProp } from '../sim/props';
import type { RunWorld } from '../sim/run';
import type { GameEvent } from '../sim/types';
import { Backdrop } from './background';
import { Camera } from './camera';
import { drawAccessory, drawAfterimage, drawCharacter, Rig } from './character';
import { CelLayer, Lettering } from './cel';
import { Fx } from './fx';
import { VIEW_FRAME, type ViewFrame, viewFrame } from './frame';
import { Hud } from './hud';
import { drawClouds, drawDrops, drawRunnerItems, itemFx } from './items';
import { circle, glowDot, type Light, light, type RC } from './kit';
import { type Compositor, createCompositor } from './post';
import { drawBackdrop, drawBlastPreview, drawForeground, drawProjectile, drawResolved, drawRunnerStatus, drawStuffed, type Emit, propEventFx } from './props';
import { Surround } from './surround';
import { initialStyle, letteringAllowed, type RenderStyle, saveRenderSettings, STYLES } from './style';
import { TerrainPainter } from './terrain';
// Mobile: quality tiers / adaptive resolution / safe-area insets (owned by the touch module).
import { detectQuality, FrameBudget, QUALITY, type QualityTier, safeInsets, TIERS } from '../ui/touch/device';

/** Terrain bake budget (px per baked canvas): a classic level at 1920 px wide is ~4.3 M. */
const MAX_BAKE_PX = 6_000_000;
const RUNNER_KEY: HSL = { h: 40, s: 30, l: 90 };

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
 * Orchestrates a frame: Canvas2D paints albedo/emissive/light layers in
 * world space through a smoothed camera, the WebGL compositor lights and
 * post-processes them, and a separate 2D canvas carries the HUD.
 */
export class Renderer {
  private scene = document.createElement('canvas');
  private glow = document.createElement('canvas');
  private lightC = document.createElement('canvas');
  private sctx = this.scene.getContext('2d')!;
  private gctx = this.glow.getContext('2d')!;
  private lctx = this.lightC.getContext('2d')!;
  private comp: Compositor;
  readonly hud: Hud;
  private cam = new Camera();
  private backdrop = new Backdrop();
  private terrain = new TerrainPainter();
  private surround = new Surround();
  private fx = new Fx();
  private rigs = new Map<number, Rig>();
  private pw = 2;
  private ph = 2;
  private frameBox: ViewFrame = VIEW_FRAME;
  /** Invisible box over the play view: the 0..VIEW_W×0..VIEW_H area that pointers map through. */
  readonly viewBox = document.createElement('div');
  private last = 0;
  private aberr = 0;
  private flash = 0;
  private lobbyDrift = 0;
  /** Render quality tier: caps internal resolution (MAX_W) and DPR. See src/ui/touch/device.ts. */
  quality: QualityTier;
  private adaptive: boolean;
  private budget = new FrameBudget();
  private style: RenderStyle = initialStyle(typeof location !== 'undefined' ? location.search : '');
  private letters = new Lettering();
  private celLayer: CelLayer | null = null;
  /** Impact words for this page, on top of what the style asks for (`?lettering=0`). */
  lettering = letteringAllowed(typeof location !== 'undefined' ? location.search : '');

  constructor(
    private glCanvas: HTMLCanvasElement,
    private hudCanvas: HTMLCanvasElement,
  ) {
    this.comp = createCompositor(glCanvas);
    this.hud = new Hud(hudCanvas.getContext('2d')!);
    this.viewBox.dataset.slagView = '';
    this.viewBox.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    glCanvas.parentElement?.append(this.viewBox);
    this.fx.onSplat = (x, y, r, c) => this.terrain.splat(x, y, r, c);
    ({ tier: this.quality, adaptive: this.adaptive } = detectQuality());
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Mobile: rotation can report stale sizes on the first resize; settle once more after it.
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
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

  /** Current look. */
  getStyle(): RenderStyle {
    return this.style;
  }

  /** Switch the look at runtime; persisted to `slag.render.v1` unless `persist` is false. */
  setStyle(style: RenderStyle, persist = true) {
    this.style = style;
    if (persist) saveRenderSettings({ style });
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
    const kb = Math.min(4, sk * 1.45, Math.sqrt(MAX_BAKE_PX / (ww * wh)));
    this.terrain.cel = this.celPass;
    this.surround.cel = this.celPass;
    this.terrain.ensure(level, kb);
    // The surroundings reach as far as the most zoomed-out view of this level can see.
    const floor = raceFloor(level);
    const reachX = Math.max(0, frameBox.w / floor - ww) / 2;
    const reachY = Math.max(0, frameBox.h / floor - wh);
    this.surround.ensure(level, reachX, reachY, Math.min(kb, Math.sqrt(MAX_BAKE_PX / ((ww + reachX * 2) * (wh + reachY)))));
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
    const rc: RC = { s, g, lights, t, frame };

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
    // Cel: the rest of the world goes on its own transparent layer (see CelLayer); `s` stays the background.
    if (this.celPass) {
      rc.s = (this.celLayer ??= new CelLayer()).begin(this.scene, s, g, level.theme.ambientLight);
      this.cam.apply(rc.s, this.pw);
    }
    this.terrain.drawShadow(rc);
    this.terrain.draw(rc);
    const pushers = m.run ? m.run.runners.filter((r) => r.alive).map((r) => ({ x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h })) : [];
    this.terrain.drawLive(rc, level, pushers, s);
    this.drawMarkers(rc, level);

    const grips = run?.runners.flatMap((r) => r.attach.grip ?? []);
    for (const r of resolved) {
      drawForeground(rc, r, {
        level,
        state: run?.propState.get(r.pp.uid),
        broken: run ? run.isBroken(r.pp.uid) : false,
        showPath: m.phase !== 'run',
        emit: run ? emit : undefined,
        grips,
        placed: m.placed,
      });
    }

    if (m.phase === 'place') this.drawGhosts(rc, m);
    if (m.phase === 'lobby' || m.phase === 'pick' || m.phase === 'place') this.drawIdlers(rc, m, dt);

    if (run) {
      for (const p of run.projectiles) drawProjectile(rc, p, emit);
      this.drawSafeZone(rc, level, run);
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
          drawStuffed(rc, run, r, pl.character);
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
        );
        if (!r.finished && run.isSafe(r)) this.drawShield(rc, level, r.body.x + r.body.w / 2, r.body.y + r.body.h, r.slot);
        drawRunnerStatus(rc, r.body, r.status, r.attach.soot - run.frame);
        drawRunnerItems(rc, r);
      }
      drawClouds(rc, run);
    }
    this.fx.draw(rc, s);
    this.backdrop.drawLiquid(rc, level.theme, ww, wh, this.cam.visible(), this.surround.margin);
    const world = rc.s;
    rc.s = s; // Cel: ambient motes stay un-inked, or they read as stray projectiles.
    this.backdrop.drawMotes(rc, level.theme, dt, this.cam.visible());
    g.globalCompositeOperation = 'source-over';

    // --- light map
    this.paintLights(level, lights);

    // --- composite
    this.aberr *= Math.exp(-dt * 5);
    this.flash *= Math.exp(-dt * 9);
    this.comp.render(this.scene, this.lightC, this.glow, {
      time: t,
      aberration: this.aberr,
      exposure: level.theme.grade.exposure,
      flash: this.flash,
      tint: level.theme.grade.tint,
      lift: level.theme.grade.lift,
      cel: this.celPass ? { fg: this.celLayer!.canvas, scale: world.getTransform().a, ambient: level.theme.ambientLight } : undefined,
    });
    if (!this.hud.hidden) this.hud.draw(m, t, this.pw, this.ph);
    else this.hud.clear(this.pw, this.ph);
    if (this.wordsOn) this.letters.draw(this.hudCanvas.getContext('2d')!, this.cam, this.pw);
  }

  /** The cel pass needs WebGL2; without it the style keeps only its impact words. */
  private get celPass() {
    return STYLES[this.style].cel && this.comp.webgl;
  }

  private get wordsOn() {
    return STYLES[this.style].lettering && this.lettering;
  }

  /**
   * Race: follow the live runners (zooming out to keep them all in, down to
   * a readability floor). Lobby: slow drift over the level. Pick/place: snap
   * to the deterministic whole-level overview the match uses for cursors.
   */
  private updateCamera(m: Match, dt: number) {
    const lv = m.level;
    const ww = lv.w * TILE;
    const wh = lv.h * TILE;
    const ov = overview(lv);
    if (m.phase === 'pick' || m.phase === 'place') {
      this.cam.setBounds(ww, wh, ov.zoom);
      this.cam.snap(ov);
      this.cam.update(dt, false);
      return;
    }
    this.cam.setBounds(ww, wh, raceFloor(lv));
    if (m.phase === 'run' && m.run) {
      const pts = m.run.runners.filter((r) => r.alive && !r.finished).map((r) => ({ x: r.body.x + r.body.w / 2, y: r.body.y }));
      if (pts.length) this.cam.frameAll(pts, 1.45, 120);
      else this.cam.wide();
    } else if (m.phase === 'lobby') {
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
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = `rgb(${Math.round(255 * amb * (0.65 + ar * 0.35))} ${Math.round(255 * amb * (0.65 + ag * 0.35))} ${Math.round(255 * amb * (0.65 + ab * 0.35))})`;
    l.fillRect(0, 0, this.lightC.width, this.lightC.height);
    // Sky light falls from above: brighten the upper part a little.
    const sky = l.createLinearGradient(0, 0, 0, this.lightC.height);
    sky.addColorStop(0, `rgba(255,255,255,${0.1 * th.ambientLight})`);
    sky.addColorStop(1, 'rgba(255,255,255,0)');
    l.globalCompositeOperation = 'lighter';
    l.fillStyle = sky;
    l.fillRect(0, 0, this.lightC.width, this.lightC.height);
    this.cam.apply(l, this.lightC.width);
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
  }

  private drawMarkers(rc: RC, level: Level) {
    const s = rc.s;
    const g = rc.g;
    const t = rc.t;
    const th = level.theme;
    // Spawn portal.
    const sx = level.spawn.tx * TILE + TILE / 2;
    const sy = (level.spawn.ty + 1) * TILE;
    const pc: HSL = shift(th.accent, 0, 0, 40);
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = css(pc, 10, 0.5 - i * 0.12);
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(sx, sy - 1, 16 - i * 3, 3.5 - i * 0.6, 0, (t * (2 + i)) % (Math.PI * 2), ((t * (2 + i)) % (Math.PI * 2)) + Math.PI * 1.4);
      g.stroke();
    }
    const beam = g.createLinearGradient(0, sy - 40, 0, sy);
    beam.addColorStop(0, css(pc, 0, 0));
    beam.addColorStop(1, css(pc, 10, 0.25));
    g.fillStyle = beam;
    g.fillRect(sx - 14, sy - 40, 28, 40);
    light(rc, sx, sy - 8, 70, pc, 0.6);

    // Goal beacon: flag + light column.
    const gx = level.goal.tx * TILE + TILE / 2;
    const gy = (level.goal.ty + 1) * TILE;
    const ac = th.accent;
    const col = g.createLinearGradient(0, 0, 0, gy);
    col.addColorStop(0, css(ac, 10, 0));
    col.addColorStop(1, css(ac, 10, 0.32 + Math.sin(t * 3) * 0.06));
    g.fillStyle = col;
    g.fillRect(gx - 9, 0, 18, gy);
    g.fillStyle = css(ac, 30, 0.35);
    g.fillRect(gx - 2, 0, 4, gy);
    s.fillStyle = '#d8dce4';
    s.fillRect(gx - 1, gy - 28, 2, 28);
    s.fillStyle = '#ffd23f';
    circle(s, gx, gy - 29, 1.8);
    const fg = s.createLinearGradient(gx, 0, gx + 16, 0);
    fg.addColorStop(0, css(ac, -5));
    fg.addColorStop(1, css(ac, 15));
    s.fillStyle = fg;
    s.beginPath();
    s.moveTo(gx + 1, gy - 28);
    for (let i = 0; i <= 7; i++) s.lineTo(gx + 1 + i * 2.2, gy - 28 + Math.sin(t * 6 - i * 0.8) * 1.4 * (i / 7));
    s.lineTo(gx + 16, gy - 19 + Math.sin(t * 6 - 5.6) * 1.4);
    for (let i = 7; i >= 0; i--) s.lineTo(gx + 1 + i * 2.2, gy - 19 + Math.sin(t * 6 - i * 0.8) * 1.4 * (i / 7));
    s.closePath();
    s.fill();
    glowDot(g, gx + 6, gy - 22, 22, ac, 0.3);
    light(rc, gx, gy - 20, 120, ac, 0.9);
  }

  /** Faint shimmer over the spawn safe zone during a race (runners touching it are immune to props). */
  private drawSafeZone(rc: RC, level: Level, run: RunWorld) {
    const z = run.safeZone;
    if (!z) return;
    const g = rc.g;
    const pc: HSL = shift(level.theme.accent, 0, 0, 40);
    // Only the air above the spawn floor; the rect also covers the floor row.
    const bottom = Math.min(z.y + z.h, (level.spawn.ty + 1) * TILE);
    const h = bottom - z.y;
    if (h <= 0) return;
    const a = 0.07 + Math.sin(rc.t * 2.2) * 0.02;
    const gr = g.createLinearGradient(0, z.y, 0, bottom);
    gr.addColorStop(0, css(pc, 10, 0));
    gr.addColorStop(1, css(pc, 10, a));
    g.fillStyle = gr;
    g.fillRect(z.x, z.y, z.w, h);
    // Shimmering edge where protection ends.
    const ex = z.x + z.w - 0.5;
    const eg = g.createLinearGradient(0, z.y, 0, bottom);
    eg.addColorStop(0, css(pc, 20, 0));
    eg.addColorStop(1, css(pc, 20, a * 3));
    g.strokeStyle = eg;
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

  private drawGhosts(rc: RC, m: Match) {
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
      if (!gh) continue;
      const ok = canPlace(m.level, m.placed, gh.def, p.rot, gh.tx, gh.ty);
      const col = ok ? p.character.body : { h: 0, s: 90, l: 55 };
      s.globalAlpha = 0.85;
      rc.g.globalAlpha = 0.85;
      drawResolved(rc, resolveProp({ uid: 900 + p.slot, def: gh.def, owner: p.slot, tx: gh.tx, ty: gh.ty, rot: p.rot }), { level: m.level, showPath: true });
      s.globalAlpha = 1;
      rc.g.globalAlpha = 1;
      const bomb = gh.def.modules.find((x) => x.type === 'bomb');
      if (bomb && bomb.type === 'bomb') drawBlastPreview(rc, m.level, m.placed, bomb, gh.tx, gh.ty, p.rot);
      rc.g.strokeStyle = css(col, 10, 0.75);
      rc.g.lineWidth = 1;
      for (const [x, y] of footprint(gh.def, p.rot)) rc.g.strokeRect((gh.tx + x) * TILE + 0.5, (gh.ty + y) * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }

  /** Outside the race, players' characters idle on the spawn pad so the world feels inhabited. */
  private drawIdlers(rc: RC, m: Match, dt: number) {
    const lv = m.level;
    const n = m.players.length;
    m.players.forEach((p, i) => {
      const x = lv.spawn.tx * TILE + TILE / 2 + (i - (n - 1) / 2) * 9;
      const y = (lv.spawn.ty + 1) * TILE;
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
    for (const p of rig.trail) drawAfterimage(this.sctx, c, p.x, p.y, p.a);
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

    const anchorX = x - facing * 4;
    const anchorY = c.accessory === 'tail' ? y - 4 : c.accessory === 'cape' ? y - 12 : y - 10;
    rig.step(c, anchorX, anchorY, dt, -vx * 0.6);
    drawAccessory(rc, c, rig);
    drawCharacter(rc, c, x, y, { facing, vx, vy, grounded, t: rc.t, celebrate });
    light(rc, x, y - 8, 38, c.body, 0.3);
    // Cel: a key light so a runner in shade still reads, not so much that it loses its hue.
    if (STYLES[this.style].cel) light(rc, x, y - 8, 20, RUNNER_KEY, 0.28);
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
            this.fx.burst('smoke', e.x, pool - 12, 8, 30, [{ h: 0, s: 0, l: 50 }], 3, 1.4);
          } else {
            this.fx.burst('gib', e.x, e.y, 14, 220, [body, c?.accent ?? body, shift(body, -15), c?.belly ?? body], 1.8, 2.2, 120);
            this.fx.burst('spark', e.x, e.y, 18, 260, [{ h: 45, s: 100, l: 70 }, body], 1.2, 0.5);
            this.fx.add('ring', e.x, e.y, 0, 0, body, 40, 0.45);
            this.fx.add('flash', e.x, e.y, 0, 0, shift(body, 20), 26, 0.25);
            this.terrain.splat(e.x, e.y + 6, 4, body);
          }
          this.cam.shake = Math.max(this.cam.shake, 6);
          this.aberr = 0.012;
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
          if (e.ammo === 'cannonball') {
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
          } else this.fx.burst('smoke', e.x, e.y, 2, 20, [{ h: 0, s: 0, l: 60 }], 1.2, 0.5);
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
          this.aberr = 0.02;
          this.flash = 0.25;
          break;
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
