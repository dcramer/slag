import 'client-only';
import { type CharacterDef, generateCharacter } from '../gen/character';
import { drawCharacter } from '../render/character';
import { buildScene, drawSplash, drawStream, paintCrane, paintHeap, type Scene } from './home-scene';

/**
 * Main-menu stage: a crowd of freshly generated characters loitering on a
 * slag heap while a crucible on a crane pours molten metal beside them
 * (./home-scene.ts draws the foundry). Purely cosmetic (Math.random is fine
 * here). Tap a character to reroll it. Returns a cleanup function.
 */

interface Guy {
  def: CharacterDef;
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
  const guys: Guy[] = Array.from({ length: 6 }, (_, i) => ({ def: roll(), hop: 0, vy: 0, facing: i < 3 ? 1 : -1, next: 0.6 + i * 0.7 }));
  const sparks: Spark[] = [];

  // What holds still is painted once per size: the heap, and the crane over the top of the pour.
  let scene: Scene | null = null;
  const crane = document.createElement('canvas');
  const heap = document.createElement('canvas');
  const layer = (c: HTMLCanvasElement, paint: (g: CanvasRenderingContext2D, S: Scene) => void, S: Scene) => {
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, S);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    scene = buildScene(W, H, seed0);
    layer(crane, paintCrane, scene);
    layer(heap, paintHeap, scene);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const onDown = (e: PointerEvent) => {
    if (!scene) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = scene.s;
    guys.forEach((g, i) => {
      const gx = scene!.runX[i];
      const gy = scene!.foot(gx) - g.hop;
      if (Math.abs(x - gx) < 10 * s && y < gy + 4 && y > gy - 20 * s) {
        g.def = roll();
        g.vy = 260;
        for (let k = 0; k < 14; k++) sparks.push({ x: gx, y: gy - 8 * s, vx: rand(-90, 90), vy: rand(-160, -40), life: rand(0.4, 0.8) });
      }
    });
  };
  canvas.addEventListener('pointerdown', onDown);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const S = scene;
    if (!S) return;
    const t = now / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = S.s;

    ctx.drawImage(heap, 0, 0, W, H);
    drawStream(ctx, S, t, reduced);
    ctx.drawImage(crane, 0, 0, W, H);
    drawSplash(ctx, S, t, reduced);
    if (!reduced && Math.random() < dt * 30)
      sparks.push({ x: S.impact.x + rand(-4, 4), y: S.impact.y - 2, vx: rand(-110, 110), vy: rand(-200, -60), life: rand(0.3, 0.8) });

    // The crowd.
    guys.forEach((g, i) => {
      g.next -= dt;
      if (g.next <= 0 && !reduced) {
        g.vy = rand(160, 320);
        g.next = rand(1.2, 4);
        if (Math.random() < 0.4) g.facing *= -1;
      }
      g.vy -= 900 * dt;
      g.hop = Math.max(0, g.hop + g.vy * dt);
      if (g.hop === 0) g.vy = 0;
      const x = S.runX[i];
      const y = S.foot(x);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * s * Math.max(0.5, 1 - g.hop / 120), 1.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter({ s: ctx, g: null }, g.def, x, y - g.hop, {
        facing: g.facing,
        vx: 0,
        vy: g.hop > 0 ? -g.vy : 0,
        grounded: g.hop === 0,
        t: t + i * 1.3,
        scale: s,
        celebrate: g.hop > 0,
      });
    });

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
