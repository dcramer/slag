import type { RC } from '../render/kit';
import { drawHostCells, drawProjectile, drawResolved } from '../render/props';
import { TILE } from '../sim/constants';
import { AMMO, type Ammo, footprint, type PropDef, resolveProp } from '../sim/props';
import { PART_INFO, summarize } from './describe';
import { PROJECTILE_NOTES, partGroups } from './parts';

/**
 * /codex — the catalog of potential components: every part (blocks,
 * heads, launchers, emitters, motion, finishes) and every projectile, drawn
 * live with the same art as the game. These are global, not per-seed; the
 * crate assembles them into props with procedurally rolled numbers.
 */

const CSS = `
:root{color-scheme:dark}
body{margin:0;background:radial-gradient(1200px 600px at 20% -10%,#2a1a18,transparent),#0b0a10;color:#e9e6f2;font:500 14px Rubik,system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:14px 22px;background:rgba(11,10,16,.85);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,160,60,.2)}
header h1{font:400 34px "Lilita One",system-ui;margin:0 12px 0 0;background:linear-gradient(#fff3b0,#ffb02e 40%,#ff5a1f 75%,#a8160f);-webkit-background-clip:text;background-clip:text;color:transparent}
header a{color:#ffb46a;text-decoration:none;font-weight:700}
nav{display:flex;flex-wrap:wrap;gap:6px}
nav a{padding:5px 10px;border-radius:99px;background:#1c1928;border:1px solid rgba(255,255,255,.08);font-size:12px}
.ctl{display:flex;gap:8px;align-items:center;margin-left:auto}
.ctl input,.ctl select{background:#14121d;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 8px;font:600 13px Rubik}
button{font:700 13px Rubik;color:#fff;background:linear-gradient(#ff9a2e,#e2561c);border:0;border-radius:9px;padding:7px 12px;cursor:pointer}
button.ghost{background:#2c2840}
main{padding:10px 22px 60px}
section{margin:28px 0}
section>h2{font:400 26px "Lilita One";margin:0 0 4px;color:#ffd9a8}
section>p{margin:0 0 14px;color:#a39cb8;max-width:900px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.card{position:relative;background:linear-gradient(#1e1b2c,#13111c);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s}
.card:hover{transform:translateY(-3px);border-color:rgba(255,170,90,.6)}
.stage{position:relative;height:150px;background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.06),transparent 70%)}
.stage canvas{position:absolute;inset:0;width:100%;height:100%}
.stage canvas.glow{mix-blend-mode:plus-lighter}
.meta{padding:8px 10px 10px}
.name{font:700 14px Rubik;color:#fff}
.maker{font-size:11px;color:#8a8499;margin-bottom:6px}
.stat{font-size:11px;color:#c9c3d9;line-height:1.45}
.tag{position:absolute;top:8px;left:8px;font:800 10px Rubik;letter-spacing:1px;padding:2px 7px;border-radius:99px;color:#fff;z-index:2}
.tag.build{background:#2f9e4f}.tag.hazard{background:#d4334a}.tag.utility{background:#2c86c9}.tag.demolish{background:#e07a1f}
.arch{margin:18px 0 8px;font:700 13px Rubik;text-transform:uppercase;letter-spacing:1.5px;color:#9a93ad}
.parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.part{background:#16141f;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px 14px}
.part b{font:400 18px "Lilita One";color:#ffb46a}
.part code{color:#7fd1ff}
.modal{position:fixed;inset:0;background:rgba(5,4,9,.8);display:flex;align-items:center;justify-content:center;z-index:20}
.modal .box{background:linear-gradient(#1e1b2c,#100e17);border:1px solid rgba(255,170,90,.35);border-radius:18px;padding:18px;width:min(900px,94vw);max-height:92vh;overflow:auto;display:grid;grid-template-columns:1.2fr 1fr;gap:18px}
.modal .stage{height:380px;border-radius:12px;background:radial-gradient(circle at 50% 50%,#262236,#0e0c14)}
.modal pre{font:12px/1.4 ui-monospace,Menlo,monospace;background:#0b0a10;border-radius:10px;padding:10px;max-height:300px;overflow:auto;color:#cfc8e3}
@media (max-width:700px){.modal .box{grid-template-columns:1fr}}
`;

interface Live {
  base: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  draw(rc: RC, w: number, h: number): void;
  visible: boolean;
}

const lives = new Set<Live>();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const live = (e.target as HTMLElement & { _live?: Live })._live;
    if (live) live.visible = e.isIntersecting;
  }
});

function stage(draw: Live['draw'], cls = 'stage'): HTMLDivElement {
  const div = document.createElement('div');
  div.className = cls;
  const base = document.createElement('canvas');
  const glow = document.createElement('canvas');
  glow.className = 'glow';
  div.append(base, glow);
  const live: Live = { base, glow, draw, visible: false };
  (div as HTMLDivElement & { _live?: Live })._live = live;
  lives.add(live);
  observer.observe(div);
  return div;
}

/** Fit a prop (including arm reach / motion range) into a w×h stage. */
function drawProp(rc: RC, def: PropDef, rot: number, w: number, h: number) {
  const fp = footprint(def, rot);
  let fw = 1;
  let fh = 1;
  for (const [x, y] of fp) {
    fw = Math.max(fw, x + 1);
    fh = Math.max(fh, y + 1);
  }
  let reach = 0;
  for (const m of def.modules) {
    if (m.type === 'swinger') reach = Math.max(reach, m.arm + m.radius);
    if (m.type === 'piston') reach = Math.max(reach, m.reach * 0.6 + 0.5);
    if (m.type === 'flame') reach = Math.max(reach, m.length * 0.45);
    if (m.type === 'fan') reach = Math.max(reach, Math.min(m.length, 3) * 0.5);
    if (m.type === 'laser') reach = Math.max(reach, 1);
  }
  const mo = def.motion;
  const travel = mo.type === 'rail' ? mo.range : mo.type === 'loop' ? mo.radius * 2 : 0;
  const ext = Math.max(fw + reach * 2 + travel, fh + reach * 2 + travel, 2.5);
  const k = Math.min(3.2, (Math.min(w, h) * 0.86) / (ext * TILE));
  // Center the motion path, not the start position.
  const da = (rot * Math.PI) / 2;
  const [mx, my] =
    mo.type === 'rail' ? [(-Math.cos(mo.angle + da) * mo.range) / 2, (-Math.sin(mo.angle + da) * mo.range) / 2] : mo.type === 'loop' ? [mo.radius, 0] : [0, 0];
  for (const ctx of [rc.s, rc.g]) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(k, k);
    ctx.translate((-fw / 2 + mx) * TILE, (-fh / 2 + my) * TILE);
  }
  if (def.mount === 'face') drawHostCells(rc, fp);
  drawResolved(rc, resolveProp({ uid: 7, def, owner: -1, tx: 0, ty: 0, rot }), { level: null, showPath: true });
  rc.s.restore();
  rc.g.restore();
}

function openModal(def: PropDef) {
  let rot = 0;
  const modal = document.createElement('div');
  modal.className = 'modal';
  const box = document.createElement('div');
  box.className = 'box';
  const left = document.createElement('div');
  left.append(stage((rc, w, h) => drawProp(rc, def, rot, w, h), 'stage'));
  const rotBtn = document.createElement('button');
  rotBtn.textContent = '⟳ rotate';
  rotBtn.onclick = () => {
    rot = (rot + 1) % 4;
  };
  const close = document.createElement('button');
  close.className = 'ghost';
  close.textContent = 'close';
  close.onclick = () => modal.remove();
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
  row.append(rotBtn, close);
  left.append(row);
  const right = document.createElement('div');
  right.innerHTML = `<h2 style="font:400 28px 'Lilita One';margin:0;color:#ffd9a8"></h2><div class="maker"></div>${summarize(def)
    .map((s) => `<div class="stat">• ${s}</div>`)
    .join('')}<p class="stat" style="margin-top:10px;color:#a39cb8"></p><pre></pre>`;
  right.querySelector('h2')!.textContent = def.name;
  right.querySelector('.maker')!.textContent = `${def.archetype} · ${def.maker} · footprint ${def.footprint.length} cell(s)`;
  right.querySelector('p')!.textContent = [...new Set(def.modules.map((m) => m.type))].map((t) => `${PART_INFO[t].title}: ${PART_INFO[t].blurb}`).join('\n\n');
  right.querySelector('pre')!.textContent = JSON.stringify(def, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v), 2);
  box.append(left, right);
  modal.append(box);
  modal.onclick = (e) => e.target === modal && modal.remove();
  document.body.append(modal);
}

function render() {
  const root = document.getElementById('codex')!;
  for (const l of lives) lives.delete(l);
  observer.disconnect();
  root.innerHTML = '';
  const header = document.createElement('header');
  header.innerHTML = `<h1>SLAG CODEX</h1><a href="/">← play</a><nav>${['parts', 'projectiles'].map((s) => `<a href="#${s}">${s}</a>`).join('')}</nav>`;
  root.append(header);
  const main = document.createElement('main');
  root.append(main);

  // Parts: every building block on its own.
  const parts = document.createElement('section');
  parts.id = 'parts';
  parts.innerHTML = `<h2>Parts</h2><p>The building blocks. Every prop in the crate is assembled from these, with its numbers (size, timing, speed, reach…) rolled procedurally.</p>`;
  for (const g of partGroups()) {
    const h = document.createElement('div');
    h.className = 'arch';
    h.textContent = g.title;
    const blurb = document.createElement('p');
    blurb.className = 'stat';
    blurb.style.cssText = 'margin:-4px 0 10px;color:#a39cb8';
    blurb.textContent = g.blurb;
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(170px,1fr))';
    for (const e of g.entries) {
      const card = document.createElement('div');
      card.className = 'card';
      card.append(stage((rc, w, h2) => drawProp(rc, e.def, 0, w, h2)));
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div class="name"></div><div class="stat"></div>`;
      meta.querySelector('.name')!.textContent = e.title;
      meta.querySelector('.stat')!.textContent = e.note;
      card.append(meta);
      card.onclick = () => openModal(e.def);
      grid.append(card);
    }
    parts.append(h, blurb, grid);
  }
  main.append(parts);

  // Projectiles, in flight.
  const proj = document.createElement('section');
  proj.id = 'projectiles';
  proj.innerHTML = `<h2>Projectiles</h2><p>What launchers shoot.</p>`;
  const pgrid = document.createElement('div');
  pgrid.className = 'grid';
  pgrid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(170px,1fr))';
  for (const [ammo, spec] of Object.entries(AMMO) as [Ammo, (typeof AMMO)[Ammo]][]) {
    const card = document.createElement('div');
    card.className = 'card';
    card.append(
      stage((rc, w, h2) => {
        // Loop a shot across the card using the real projectile art.
        const T = 1.6;
        const u = (rc.t % T) / T;
        const k = 2.2;
        const vx = 180;
        const x = -20 + u * (w / k + 40);
        const lob = spec.gravity > 200;
        const vy = lob ? -120 + 260 * u : 0;
        const y = h2 / k / 2 + (lob ? -40 * Math.sin(u * Math.PI) : 0) + (spec.wobble ? Math.sin(rc.t * 15) * 3 : 0);
        for (const ctx of [rc.s, rc.g]) {
          ctx.save();
          ctx.scale(k, k);
        }
        drawProjectile(rc, { x, y, vx, vy, owner: 0, born: 0, ammo });
        rc.s.restore();
        rc.g.restore();
      }),
    );
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="name">${ammo}</div><div class="stat"></div>`;
    meta.querySelector('.stat')!.textContent = `${PROJECTILE_NOTES[ammo]} radius ${spec.radius}px${spec.gravity ? ` · gravity ${spec.gravity}` : ''}`;
    card.append(meta);
    pgrid.append(card);
  }
  proj.append(pgrid);
  main.append(proj);
}

function frame(now: number) {
  const t = now / 1000;
  const frameNo = Math.floor(now / (1000 / 60));
  for (const l of lives) {
    if (!l.visible || !l.base.isConnected) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = l.base.clientWidth;
    const h = l.base.clientHeight;
    if (l.base.width !== Math.round(w * dpr)) {
      for (const c of [l.base, l.glow]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
    }
    const s = l.base.getContext('2d')!;
    const g = l.glow.getContext('2d')!;
    for (const c of [s, g]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, l.base.width, l.base.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    l.draw({ s, g, lights: null, t, frame: frameNo }, w, h);
  }
  requestAnimationFrame(frame);
}

let mounted = false;

/** Mount the codex into its container (called by the /codex route). */
export function mountCodex(): void {
  if (mounted) return;
  mounted = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
  render();
  requestAnimationFrame(frame);
}
