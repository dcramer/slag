import 'client-only';
import { type CharacterDef, generateCharacter } from '../gen/character';
import { hash2 } from '../core/rng';
import { drawCharacter } from '../render/character';
import { blob, line, type P, shadeOf, sn, stroke } from '../render/ink';
import { PAL } from './style';

/**
 * Main-menu stage: a crowd of freshly generated characters loitering on a
 * slag heap while a foundry ladle pours molten metal behind them. Purely
 * cosmetic (Math.random is fine here). Tap a character to reroll it.
 * Returns a cleanup function.
 */

interface Guy {
  def: CharacterDef;
  /** Position along the heap, 0..1. */
  u: number;
  hop: number;
  vy: number;
  facing: number;
  next: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function mountStage(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  const seed0 = Math.floor(Math.random() * 1e9);
  let rolls = 0;
  const roll = () => generateCharacter((seed0 + rolls++ * 7919) >>> 0);
  const guys: Guy[] = [0.14, 0.27, 0.4, 0.53, 0.66, 0.79].map((u, i) => ({ def: roll(), u, hop: 0, vy: 0, facing: u < 0.5 ? 1 : -1, next: 0.6 + i * 0.7 }));
  const sparks: Spark[] = [];
  // Heap silhouette: a few soft bumps, fixed per visit.
  const bumps = Array.from({ length: 7 }, (_, i) => ({ c: i / 6 + rand(-0.04, 0.04), w: rand(0.1, 0.18), h: rand(0.25, 0.55) }));
  const heapY = (u: number) => {
    // A mound that tapers to nothing at both edges, with a few lumps on top.
    const mound = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
    let y = 0.5 * Math.pow(mound, 0.6);
    for (const b of bumps) y += b.h * 0.18 * Math.exp(-(((u - b.c) / b.w) ** 2)) * mound;
    return H - Math.min(0.62, y) * H * 0.62;
  };

  const heap = document.createElement('canvas');
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const onDown = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = scale();
    for (const g of guys) {
      const gx = g.u * W;
      const gy = heapY(g.u) - g.hop;
      if (Math.abs(x - gx) < 10 * s && y < gy + 4 && y > gy - 20 * s) {
        g.def = roll();
        g.vy = 260;
        for (let i = 0; i < 14; i++) sparks.push({ x: gx, y: gy - 8 * s, vx: rand(-90, 90), vy: rand(-160, -40), life: rand(0.4, 0.8) });
      }
    }
  };
  canvas.addEventListener('pointerdown', onDown);

  const scale = () => Math.max(2.2, Math.min(4.6, H / 95));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = scale();

    // Ladle pouring from the top right.
    const lx = W * 0.93;
    const ly = H * 0.12;
    const pourX = lx - 30 * (s / 4);
    const hitY = heapY(pourX / W);
    const sw = 6 * (s / 4) + Math.sin(t * 9) * 0.8;
    const sg = ctx.createLinearGradient(0, ly, 0, hitY);
    sg.addColorStop(0, PAL.whiteHot);
    sg.addColorStop(0.5, PAL.amber);
    sg.addColorStop(1, PAL.molten);
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,30,0.9)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(pourX - sw / 2, ly + 10);
    ctx.quadraticCurveTo(pourX - sw / 2 - 3, (ly + hitY) / 2, pourX - sw / 2 + Math.sin(t * 5) * 1.5, hitY);
    ctx.lineTo(pourX + sw / 2 + Math.sin(t * 5) * 1.5, hitY);
    ctx.quadraticCurveTo(pourX + sw / 2 - 3, (ly + hitY) / 2, pourX + sw / 2, ly + 10);
    ctx.fill();
    ctx.restore();
    ladle(ctx, lx, ly, s / 4);
    if (!reduced && Math.random() < dt * 40)
      sparks.push({ x: pourX + rand(-4, 4), y: hitY - 2, vx: rand(-120, 120), vy: rand(-220, -60), life: rand(0.3, 0.9) });

    // The heap, inked once per size, and its glowing cracks.
    if (heap.width !== canvas.width || heap.height !== canvas.height) paintHeap(heap, W, H, dpr, s, heapY);
    ctx.drawImage(heap, 0, 0, W, H);
    // Molten pool where the pour lands.
    const pg = ctx.createRadialGradient(pourX, hitY + 4, 2, pourX, hitY + 4, 70 * (s / 4));
    pg.addColorStop(0, 'rgba(255,200,90,0.95)');
    pg.addColorStop(0.35, 'rgba(255,106,31,0.6)');
    pg.addColorStop(1, 'rgba(184,35,15,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(pourX, hitY + 4, 70 * (s / 4), 16 * (s / 4), 0, 0, Math.PI * 2);
    ctx.fill();
    // Cracks are hot, so they glow: each one a pen stroke that swells in the middle and tapers out.
    ctx.save();
    ctx.fillStyle = `rgba(255,${120 + Math.round(Math.sin(t * 2) * 30)},40,0.8)`;
    ctx.shadowColor = PAL.molten;
    ctx.shadowBlur = 10;
    for (let i = 0; i < 9; i++) {
      const u = (i + 0.5) / 9;
      const x = u * W;
      const y = heapY(u) + 18 + (i % 3) * 14;
      const crack = [
        { x, y },
        { x: x + 10 * Math.sin(i * 3.1), y: y + 12 },
        { x: x - 6 + 14 * Math.cos(i * 1.7), y: y + 26 },
      ];
      stroke(ctx, crack, { w: 2.6, seed: 40 + i, taper: [0.3, 0.45], wobble: 0.5 });
    }
    ctx.restore();

    // The crowd.
    for (const g of guys) {
      g.next -= dt;
      if (g.next <= 0 && !reduced) {
        g.vy = rand(160, 320);
        g.next = rand(1.2, 4);
        if (Math.random() < 0.4) g.facing *= -1;
      }
      g.vy -= 900 * dt;
      g.hop = Math.max(0, g.hop + g.vy * dt);
      if (g.hop === 0) g.vy = 0;
      const x = g.u * W;
      const y = heapY(g.u);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * s * Math.max(0.5, 1 - g.hop / 120), 1.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter({ s: ctx, g: null }, g.def, x, y - g.hop, {
        facing: g.facing,
        vx: 0,
        vy: g.hop > 0 ? -g.vy : 0,
        grounded: g.hop === 0,
        t: t + g.u * 10,
        scale: s,
        celebrate: g.hop > 0,
      });
    }

    // Sparks.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      p.life -= dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.fillStyle = `rgba(255,${150 + Math.round(Math.random() * 80)},60,${Math.max(0, Math.min(1, p.life * 2))})`;
      ctx.fillRect(p.x - 1, p.y - 1, 2.2, 2.2);
    }
    ctx.restore();
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
  };
}

/** The heap's flat tones: the slag, its lit top, and the hatching. */
const HEAP = { base: '#2e221c', light: '#3d2e26', hatch: '#231914' };

/**
 * The slag heap, inked like the world's terrain (docs/ART.md → World art): flat tones cut with a hand's
 * edge, hatching hanging off the side away from the light, and a contour of separate pen strokes that
 * lifts in places. It's static, so it's drawn once per size into `layer`, then faded out at the bottom
 * so the canvas has no visible edge.
 */
function paintHeap(layer: HTMLCanvasElement, W: number, H: number, dpr: number, s: number, heapY: (u: number) => number) {
  layer.width = Math.round(W * dpr);
  layer.height = Math.round(H * dpr);
  const g = layer.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const N = 96;
  const top: (P & { nx: number; ny: number })[] = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * W;
    const dx = W / N;
    const dy = heapY((i + 1) / N) - heapY((i - 1) / N);
    const d = Math.hypot(2 * dx, dy);
    top.push({ x, y: heapY(i / N), nx: dy / d, ny: (-2 * dx) / d });
  }
  // The body, then its lit top: a band cut along the contour, thick where it faces the light, gone where it turns away.
  g.fillStyle = HEAP.base;
  g.beginPath();
  g.moveTo(0, H);
  for (const p of top) g.lineTo(p.x, p.y);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.fillStyle = HEAP.light;
  g.beginPath();
  top.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  for (let i = N; i >= 0; i--) {
    const p = top[i];
    const k = Math.max(0, s * (2.6 + 1.4 * sn(i * 0.21, 1.3, 5)) * (1 - shadeOf(p.nx, p.ny) * 3.2));
    g.lineTo(p.x - p.nx * k, p.y - p.ny * k);
  }
  g.closePath();
  g.fill();

  // Hatching off the slope that faces away from the light.
  g.fillStyle = HEAP.hatch;
  for (let i = 2; i < N - 1; i += 2) {
    const p = top[i];
    const sh = shadeOf(p.nx, p.ny);
    if (sh < 0.12 || hash2(i, 3, 17) < 0.25) continue;
    const len = s * (4 + 10 * sh) * (0.6 + 0.6 * hash2(i, 4, 17));
    const sx = p.x - p.nx * s;
    const sy = p.y - p.ny * s;
    line(g, sx, sy, sx - 0.45 * len, sy + 0.9 * len, { w: 0.55 * s, seed: i, taper: [0.02, 0.85], wobble: 0.3 });
  }

  // The contour: overlapping strokes with an occasional lift, thin toward the light, heavy away from it.
  g.fillStyle = PAL.ink;
  for (let a = 0, k = 0; a < N; k++) {
    const b = Math.min(N, a + 9 + Math.floor(hash2(k, 1, 23) * 10));
    const run = top.slice(a, b + 1);
    const sh = run.reduce((m, p) => m + shadeOf(p.nx, p.ny), 0) / run.length;
    stroke(g, run, { w: s * (0.85 + 2.2 * sh), seed: 31 + k, taper: [0.12, 0.18], press: 0.35, wobble: 0.25 * s });
    if (b >= N) break;
    a = b - (hash2(k, 2, 23) < 0.3 ? -1 : 1);
  }

  // Fade into the page at the bottom.
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, H * 0.72, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

/** The ladle's flat tones: iron, its lit side, its shadow shape. */
const LADLE = { base: '#4a3a31', light: '#5f4b3f', shade: '#33281f' };

/** A tilted foundry ladle on a chain, inked: flat tones, one hard shadow shape, a pen contour. */
function ladle(c: CanvasRenderingContext2D, x: number, y: number, k: number) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = PAL.ink;
  line(c, 14, -400, 14, -24, { w: 4.5, seed: 3, taper: [0, 0.05], press: 0.3, wobble: 0.6 });
  c.rotate(-0.5);
  const body: P[] = [
    { x: -34, y: -20 },
    { x: 34, y: -20 },
    { x: 26, y: 28 },
  ];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    body.push({ x: 26 - 52 * t, y: 28 + 20 * t * (1 - t) });
  }
  body.push({ x: -26, y: 28 });
  const path = (pts: readonly P[]) => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
  };
  c.fillStyle = LADLE.base;
  path(body);
  c.fill();
  // The side away from the light, cut as one hard shape.
  c.fillStyle = LADLE.shade;
  path([
    { x: 10, y: -20 },
    { x: 34, y: -20 },
    { x: 26, y: 28 },
    { x: 4, y: 33 },
    { x: 14, y: 6 },
  ]);
  c.fill();
  c.fillStyle = LADLE.light;
  path([
    { x: -30, y: -16 },
    { x: -22, y: -16 },
    { x: -18, y: 20 },
    { x: -24, y: 25 },
  ]);
  c.fill();
  c.fillStyle = PAL.ink;
  stroke(c, [...body.slice(1), body[0]], { w: 4, seed: 5, taper: [0.08, 0.1], press: 0.4, wobble: 0.5 });
  line(c, -35, -18, -27, 27, { w: 2.2, seed: 6, taper: [0.2, 0.3] });
  // The rim, with the melt showing over it.
  path([
    { x: -38, y: -27 },
    { x: 38, y: -26 },
    { x: 38, y: -17 },
    { x: -38, y: -17 },
  ]);
  c.fill();
  c.fillStyle = PAL.molten;
  path([
    { x: -32, y: -24.5 },
    { x: 32, y: -24 },
    { x: 31, y: -19.5 },
    { x: -32, y: -19.5 },
  ]);
  c.fill();
  c.fillStyle = PAL.steel;
  for (const rx of [-20, 0, 20]) {
    blob(c, rx, 4, 2.4, rx + 50, 1, 0.2);
    c.fill();
  }
  c.restore();
}
