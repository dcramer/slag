import 'client-only';
import { type CharacterDef, generateCharacter } from '../gen/character';
import { drawCharacter } from '../render/character';
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
  const guys: Guy[] = [0.12, 0.27, 0.43, 0.6, 0.77, 0.9].map((u, i) => ({ def: roll(), u, hop: 0, vy: 0, facing: u < 0.5 ? 1 : -1, next: 0.6 + i * 0.7 }));
  const sparks: Spark[] = [];
  // Heap silhouette: a few soft bumps, fixed per visit.
  const bumps = Array.from({ length: 7 }, (_, i) => ({ c: i / 6 + rand(-0.04, 0.04), w: rand(0.1, 0.18), h: rand(0.25, 0.55) }));
  const heapY = (u: number) => {
    let y = 0.18 + 0.32 * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05)));
    for (const b of bumps) y += b.h * 0.18 * Math.exp(-(((u - b.c) / b.w) ** 2));
    return H - Math.min(0.62, y) * H * 0.62;
  };

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
    const lx = W * 0.8;
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

    // Heap with glowing cracks.
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i <= 60; i++) ctx.lineTo((i / 60) * W, heapY(i / 60));
    ctx.lineTo(W, H);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, H * 0.5, 0, H);
    hg.addColorStop(0, '#3a2a22');
    hg.addColorStop(1, '#140c09');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAL.ink;
    ctx.stroke();
    // Molten pool where the pour lands.
    const pg = ctx.createRadialGradient(pourX, hitY + 4, 2, pourX, hitY + 4, 70 * (s / 4));
    pg.addColorStop(0, 'rgba(255,200,90,0.95)');
    pg.addColorStop(0.35, 'rgba(255,106,31,0.6)');
    pg.addColorStop(1, 'rgba(184,35,15,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(pourX, hitY + 4, 70 * (s / 4), 16 * (s / 4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = `rgba(255,${120 + Math.round(Math.sin(t * 2) * 30)},40,0.75)`;
    ctx.shadowColor = PAL.molten;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      const u = (i + 0.5) / 9;
      const x = u * W;
      const y = heapY(u) + 18 + (i % 3) * 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 * Math.sin(i * 3.1), y + 12);
      ctx.lineTo(x - 6 + 14 * Math.cos(i * 1.7), y + 26);
      ctx.stroke();
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

/** A tilted foundry ladle on a chain. */
function ladle(c: CanvasRenderingContext2D, x: number, y: number, k: number) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.strokeStyle = PAL.ink;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(14, -400);
  c.lineTo(14, -22);
  c.stroke();
  c.rotate(-0.5);
  c.lineJoin = 'round';
  c.fillStyle = '#4a3a31';
  c.beginPath();
  c.moveTo(-34, -20);
  c.lineTo(34, -20);
  c.lineTo(26, 28);
  c.quadraticCurveTo(0, 38, -26, 28);
  c.closePath();
  c.fill();
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = PAL.ink;
  c.fillRect(-38, -26, 76, 9);
  c.fillStyle = PAL.molten;
  c.fillRect(-32, -24, 64, 5);
  c.fillStyle = PAL.steel;
  for (const rx of [-20, 0, 20]) {
    c.beginPath();
    c.arc(rx, 4, 2.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
