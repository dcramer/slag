import 'client-only';
import { connectedPads } from '../input/input';
import type { Nav, Unmount } from '../router';
import { HOME } from '../routes';
import { glyphSVG } from '../ui/glyphs';
import { forgeHTML, promptHTML, scaledLogoHTML } from '../ui/screens/markup';
import { KEY_ACTIONS, type MenuAction, MenuPadReader, navTarget, readMenuPad } from '../ui/settings-nav';
import { glowDot, type RC } from '../render/kit';
import { drawItemIcon, ITEM_HUE } from '../render/items';
import { drawHostCells, drawProjectile, drawResolved } from '../render/props';
import type { ItemKind } from '../sim/items';
import { TILE } from '../sim/constants';
import { AMMO, type Ammo, footprint, makeProjectile, type PropDef, resolveProp } from '../sim/props';
import { castDrawer, castEntries } from './cast';
import { CODEX_CSS } from './css';
import { PART_INFO, summarize } from './describe';
import type { MapPainter } from './map-view';
import type { MapSection } from './maps';
import { PROJECTILE_NOTES, partGroups } from './parts';
import type { MapJob } from './shots';

/**
 * /codex — the catalog of potential components: every part (blocks,
 * heads, launchers, emitters, motion, finishes), item and projectile, drawn
 * live with the same art as the game. These are global, not per-seed; the
 * crate assembles them into props with procedurally rolled numbers. After
 * the parts, the maps (./maps.ts): every theme, its landmarks and its own
 * hazards, pictured by the game's renderer as cards scroll into view. Between
 * them, the cast (./cast.ts): every kind of runner, by its sound-alike name.
 *
 * It's a game screen like the main menu: the same backdrop and logo, one
 * selected card at a time (arrows, d-pad or stick; mouse hover), Enter or Ⓐ
 * to look closer, Q/E or LB/RB between sections, Esc or Ⓑ to back out.
 * Labels and one-line jokes only (docs/DESIGN.md → Discovery).
 */

/** `close` is the close-up's stage rather than a card's. */
type Draw = (rc: RC, w: number, h: number, rot: number, close: boolean) => void;

interface Entry {
  title: string;
  note: string;
  /** The section's title, for the close-up's tag. */
  group: string;
  draw: Draw;
  /** The numbers, for the close-up. */
  spec: string[];
  /** The part type's own joke, when it isn't already said. */
  quip: string | null;
  /** Placeable parts turn; items and shots don't. */
  turns: boolean;
  /** A map's picture, drawn by the renderer instead of `draw`. */
  map?: MapJob;
}

/** The codex's parts, each a heading in the index. */
type Part = 'Parts' | 'Cast' | 'Maps';

interface Section {
  id: string;
  title: string;
  blurb: string;
  entries: Entry[];
  part: Part;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Parody names are kept lower-case in the data; cards show them as names. */
const titleCase = (s: string) => s.replace(/(^|[\s/-])(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

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
    if (m.type === 'magnet') reach = Math.max(reach, m.radius - 0.5);
    if (m.type === 'dropper') reach = Math.max(reach, m.reach * 0.5);
    if (m.type === 'keg') reach = Math.max(reach, 1.5);
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

/** A held item, big, bobbing over its glow. */
function drawItemCard(rc: RC, kind: ItemKind, w: number, h: number) {
  const k = Math.min(4, Math.min(w, h) / 34);
  const y = h / 2 + Math.sin(rc.t * 2.5) * 3;
  glowDot(rc.g, w / 2, y, 16 * k, ITEM_HUE[kind], 0.5);
  drawItemIcon(rc.s, kind, w / 2, y, k, rc.t);
}

/** A shot looping across the stage, with the real projectile art. */
function drawShot(rc: RC, ammo: Ammo, w: number, h: number) {
  const spec = AMMO[ammo];
  const T = 1.6;
  const u = (rc.t % T) / T;
  const k = Math.max(2.2, Math.min(w, h) / 70);
  const x = -20 + u * (w / k + 40);
  const lob = spec.gravity > 200;
  const vy = lob ? -120 + 260 * u : 0;
  const y = h / k / 2 + (lob ? -40 * Math.sin(u * Math.PI) : 0) + (spec.wobble ? Math.sin(rc.t * 15) * 3 : 0);
  for (const ctx of [rc.s, rc.g]) {
    ctx.save();
    ctx.scale(k, k);
  }
  drawProjectile(rc, { ...makeProjectile({ x, y, vx: 180, vy, owner: 0, ammo }, rc.frame - Math.floor(u * 60), 0), n: ammo === 'glider' ? 0 : 3 });
  rc.s.restore();
  rc.g.restore();
}

/** The parts' sections: every part group, then the projectiles. */
function catalog(): Section[] {
  const sections: Section[] = partGroups().map((g) => ({
    id: g.id,
    part: 'Parts',
    title: titleCase(g.title),
    blurb: g.blurb,
    entries: g.entries.map((e): Entry => {
      const main = e.def.modules.find((m) => m.type !== 'body') ?? e.def.modules[0];
      const quip = main ? PART_INFO[main.type].blurb : null;
      const item = e.item;
      return {
        title: titleCase(e.title),
        note: e.note,
        group: titleCase(g.title),
        draw: item ? (rc, w, h) => drawItemCard(rc, item, w, h) : (rc, w, h, rot) => drawProp(rc, e.def, rot, w, h),
        spec: summarize(e.def),
        quip: quip && quip !== g.blurb && !quip.startsWith(e.note) ? quip : null,
        turns: !item,
      };
    }),
  }));
  sections.push({
    id: 'projectiles',
    part: 'Parts',
    title: 'Projectiles',
    blurb: 'Incoming.',
    entries: (Object.keys(AMMO) as Ammo[]).map((ammo) => {
      const [label, joke] = PROJECTILE_NOTES[ammo];
      const spec = AMMO[ammo];
      return {
        title: titleCase(label),
        note: joke,
        group: 'Projectiles',
        draw: (rc, w, h) => drawShot(rc, ammo, w, h),
        spec: [`radius ${spec.radius}px${spec.gravity ? ` · gravity ${spec.gravity}` : ''}`],
        quip: null,
        turns: false,
      };
    }),
  });
  return sections;
}

/** The cast: every kind, standing on its card, running through its moves up close. */
function castCatalog(): Section[] {
  return [
    {
      id: 'cast',
      part: 'Cast',
      title: 'Runners',
      blurb: 'Same hitbox. Different hats.',
      entries: castEntries().map((e): Entry => {
        const draw = castDrawer(e);
        return { title: e.title, note: e.note, group: 'Runners', draw: (rc, w, h, _rot, close) => draw(rc, w, h, close), spec: [], quip: null, turns: false };
      }),
    },
  ];
}

/** The maps' sections (./maps.ts), as the catalog shows them: pictures instead of live parts, nothing turns. */
function mapCatalog(list: readonly MapSection[]): Section[] {
  return list.map((m) => ({
    id: m.id,
    part: 'Maps',
    title: m.title,
    blurb: m.blurb,
    entries: m.entries.map((e) => ({ title: e.title, note: e.note, spec: e.spec, quip: e.quip, group: m.title, draw: () => {}, turns: false, map: e.job })),
  }));
}

/** One half's heading in the index and its chips: parts one under another; the maps, short theme names, two to a row. */
function indexHTML(part: Part, sections: readonly Section[]): string {
  const chips = sections.map(
    (s) => `<button type="button" data-sec="${s.id}"><span class="t">${esc(s.title)}</span><span class="n">${s.entries.length}</span></button>`,
  );
  return `<span class="cx-part">${part}</span><div class="cx-chips" data-part="${part}">${chips.join('')}</div>`;
}

/** Sections and their cards, the first card numbered `i`. */
function sectionsHTML(sections: readonly Section[], i: number): string {
  return sections
    .map(
      (s) =>
        `<section class="cx-sec" id="${s.id}" data-part="${s.part}"><header class="cx-head"><h2>${esc(s.title)}</h2><span class="n">${s.entries.length}</span><p>${esc(s.blurb)}</p></header>` +
        `<div class="cx-grid">${s.entries
          .map(
            (e) =>
              `<button type="button" class="cx-card" data-i="${i++}" data-active="false"${e.map ? ` data-map="${e.map.kind}"` : ''}><span class="cx-well"></span>` +
              `<span class="cx-plate"><span class="t">${esc(e.title)}</span><span class="s">${esc(e.note)}</span><span class="chev"></span></span></button>`,
          )
          .join('')}</div></section>`,
    )
    .join('');
}

/** The screen's frame: side, an empty index and catalog (`mountCodex` fills them), the close-up and the footer. */
function codexHTML(): string {
  const key = (label: string) => `<span class="slag-glyph">${glyphSVG({ kind: 'key', label }, 22)}</span>`;
  return (
    `<div class="codex" data-screen="codex">${forgeHTML()}` +
    `<aside class="cx-side"><div class="cx-brand"><button type="button" class="cx-back" data-act="back" aria-label="Main Menu"></button>${scaledLogoHTML()}<h1 class="cx-title">CODEX</h1></div>` +
    `<nav class="cx-index" aria-label="Sections"></nav></aside>` +
    `<main class="cx-main"></main>` +
    `<div class="cx-modal" role="dialog" aria-modal="true" aria-labelledby="cx-name" hidden><div class="cx-sheet">` +
    `<div class="cx-stage"><span class="cx-well"></span><button type="button" class="cx-nav prev" data-act="prev" aria-label="Previous"></button><button type="button" class="cx-nav next" data-act="next" aria-label="Next"></button></div>` +
    `<div class="cx-info"><span class="cx-tag"></span><h2 id="cx-name"></h2><p class="cx-joke"></p><ul class="cx-spec"></ul><p class="cx-quip"></p>` +
    `<div class="cx-actions"><button type="button" class="cx-btn" data-act="rotate">${key('R')}Rotate</button><button type="button" class="cx-btn primary" data-act="close">${key('Esc')}Close</button></div></div>` +
    `</div></div>` +
    `<footer class="footbar cx-foot"><span class="meta">Codex</span><div class="prompts"></div></footer></div>`
  );
}

/** The footer: what the arrows, Enter, the section keys and Esc do here, or in the close-up. */
function footerHTML(open: boolean, turns: boolean, pad: boolean): string {
  const p = (keys: string[], buttons: Parameters<typeof promptHTML>[1], label: string, act?: string) => promptHTML(keys, pad ? buttons : null, label, act);
  if (open) return p(['←', '→'], ['DPAD'], 'Browse') + (turns ? p(['R'], ['X'], 'Rotate', 'rotate') : '') + p(['Esc'], ['B'], 'Close', 'close');
  return (
    p(['↑', '↓', '←', '→'], ['DPAD'], 'Select') +
    p(['Enter'], ['A'], 'Look Closer') +
    p(['Q', 'E'], ['LB', 'RB'], 'Section') +
    p(['Esc'], ['B'], 'Back', 'back')
  );
}

interface Live {
  base: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  draw(rc: RC, w: number, h: number): void;
  visible: boolean;
}

/**
 * The codex screen: mounts into `root` and runs until the returned function is called. Esc or Ⓑ
 * closes an open part, then goes back to the main menu.
 */
export function mountCodex(root: HTMLElement, nav: Nav): Unmount {
  const st = document.createElement('style');
  st.textContent = CODEX_CSS;
  document.head.append(st);
  // Filled by `add`: the parts now, the maps once their registries load.
  const sections: Section[] = [];
  const entries: Entry[] = [];
  const firstOf: number[] = [];
  const cards: HTMLButtonElement[] = [];
  const secEls: HTMLElement[] = [];
  const indexBtns: HTMLButtonElement[] = [];
  const sectionOf = (i: number) => {
    let si = 0;
    while (si + 1 < firstOf.length && firstOf[si + 1] <= i) si++;
    return si;
  };

  const wrap = document.createElement('div');
  wrap.innerHTML = codexHTML();
  const el = wrap.firstElementChild as HTMLElement;
  root.append(el);
  const $ = (sel: string) => el.querySelector<HTMLElement>(sel)!;
  const side = $('.cx-side');
  const index = $('.cx-index');
  const main = $('.cx-main');
  const foot = $('.cx-foot');
  const prompts = $('.cx-foot .prompts');
  const modal = $('.cx-modal');
  const rotBtn = $('[data-act=rotate]');
  const phone = matchMedia('(max-width: 860px)');

  const life = new AbortController();
  // Live stages: each card draws its part every frame while it's on screen.
  const lives: Live[] = [];
  const observer = new IntersectionObserver((list) => {
    for (const e of list) {
      const live = lives[Number((e.target as HTMLElement).dataset.live)];
      if (live) live.visible = e.isIntersecting;
    }
  });
  const stage = (well: HTMLElement, draw: Live['draw']): Live => {
    const base = document.createElement('canvas');
    const glow = document.createElement('canvas');
    glow.className = 'glow';
    well.append(base, glow);
    const live: Live = { base, glow, draw, visible: false };
    well.dataset.live = String(lives.length);
    lives.push(live);
    observer.observe(well);
    return live;
  };
  // Maps: the renderer, its level generator and a worker load the first time a map card comes near the screen.
  let maps: MapPainter | null = null;
  let mapsLoading: Promise<MapPainter> | null = null;
  const painter = () =>
    (mapsLoading ??= import('./map-view').then((m) => {
      if (life.signal.aborted) throw new Error('codex closed');
      return (maps = new m.MapPainter());
    }));
  // A map card gets one still, painted the first time it's in view.
  const painted = new Set<number>();
  const mapObserver = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        const i = Number((e.target as HTMLElement).dataset.card);
        const job = entries[i].map!;
        if (!e.isIntersecting) {
          maps?.unwant(job);
          continue;
        }
        if (painted.has(i)) continue;
        painted.add(i);
        const canvas = e.target.querySelector('canvas')!;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        void painter()
          .then((p) => p.paint(job, canvas))
          .then((ok) => (e.target as HTMLElement).classList.toggle('drawn', ok))
          .catch(() => painted.delete(i));
      }
    },
    { rootMargin: '200px 0px' },
  );
  let open = -1;
  let rot = 0;
  const closeUp = stage($('.cx-stage .cx-well'), (rc, w, h) => {
    if (open < 0) return;
    const job = entries[open].map;
    if (!job) entries[open].draw(rc, w, h, rot, true);
    else if (maps) maps.frame(job, rc.s, w, h);
    else void painter();
  });

  let pad = connectedPads().length > 0;
  const paintFooter = () => (prompts.innerHTML = footerHTML(open >= 0, open >= 0 && entries[open].turns, pad));

  /** How much of the window the sticky header and the footer cover. */
  const insets = () => ({ top: phone.matches ? side.offsetHeight : 0, bottom: foot.offsetHeight });
  const reveal = (card: HTMLElement) => {
    const r = card.getBoundingClientRect();
    const { top, bottom } = insets();
    const room = 18;
    if (r.top < top + room) window.scrollBy({ top: r.top - top - room });
    else if (r.bottom > innerHeight - bottom - room) window.scrollBy({ top: r.bottom - (innerHeight - bottom - room) });
  };

  let active = 0;
  const setActive = (i: number, how: { focus?: boolean; scroll?: boolean } = {}) => {
    cards[active].dataset.active = 'false';
    active = i;
    cards[i].dataset.active = 'true';
    if (how.focus) cards[i].focus({ preventScroll: true });
    if (how.scroll) reveal(cards[i]);
  };

  const move = (dir: 'up' | 'down' | 'left' | 'right') => {
    let to: number | null;
    if (dir === 'left' || dir === 'right') to = Math.max(0, Math.min(cards.length - 1, active + (dir === 'left' ? -1 : 1)));
    else
      to = navTarget(
        cards.map((c) => c.getBoundingClientRect()),
        active,
        dir,
      );
    if (to !== null && to !== active) setActive(to, { focus: true, scroll: true });
  };

  const toSection = (si: number) => {
    const s = secEls[si];
    const { top } = insets();
    window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - top - 20 });
    setActive(firstOf[si], { focus: true });
  };

  // The section on screen lights up in the index.
  let shownSec = -1;
  const spy = () => {
    const { top } = insets();
    let si = 0;
    for (let i = 0; i < secEls.length; i++) if (secEls[i].getBoundingClientRect().top <= top + innerHeight * 0.3) si = i;
    if (si === shownSec) return;
    shownSec = si;
    indexBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === si)));
    // On a phone the index is a strip: keep the lit chip in it.
    const b = indexBtns[si];
    if (phone.matches) {
      if (b.offsetLeft < index.scrollLeft || b.offsetLeft + b.offsetWidth > index.scrollLeft + index.clientWidth)
        index.scrollTo({ left: b.offsetLeft - 14, behavior: 'smooth' });
      return;
    }
    // On a short window the side column scrolls: keep the lit chip in it too, and the logo while the first section is up.
    const r = b.getBoundingClientRect();
    const box = side.getBoundingClientRect();
    if (si === 0) side.scrollTo({ top: 0, behavior: 'smooth' });
    else if (r.top < box.top || r.bottom > box.bottom) side.scrollBy({ top: r.top - box.top - box.height / 2, behavior: 'smooth' });
  };

  const showPart = (i: number) => {
    open = i;
    rot = 0;
    const e = entries[i];
    $('.cx-tag').textContent = e.group;
    $('#cx-name').textContent = e.title;
    $('.cx-joke').textContent = e.note;
    const spec = $('.cx-spec');
    spec.replaceChildren(
      ...e.spec.map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }),
    );
    spec.hidden = e.spec.length === 0;
    const quip = $('.cx-quip');
    quip.textContent = e.quip ?? '';
    quip.hidden = !e.quip;
    rotBtn.hidden = !e.turns;
    modal.dataset.kind = e.map ? 'map' : 'part';
    if (active !== i) setActive(i, { scroll: true });
    paintFooter();
  };
  const openPart = (i: number) => {
    showPart(i);
    modal.hidden = false;
    closeUp.visible = true;
    $('[data-act=close]').focus({ preventScroll: true });
  };
  const closePart = () => {
    open = -1;
    modal.hidden = true;
    closeUp.visible = false;
    cards[active].focus({ preventScroll: true });
    paintFooter();
  };
  const browse = (d: number) => showPart((open + d + entries.length) % entries.length);
  const back = () => (open >= 0 ? closePart() : nav.go(HOME));

  const act = (a: string | undefined) => {
    if (a === 'back' || a === 'close') back();
    else if (a === 'rotate' && open >= 0 && entries[open].turns) rot = (rot + 1) % 4;
    else if (a === 'prev') browse(-1);
    else if (a === 'next') browse(1);
  };

  const on = { signal: life.signal };

  /** Put a half of the catalog on the page: its index heading and chips, its sections and cards, all wired up. */
  const add = (part: Part, more: readonly Section[]) => {
    const start = entries.length;
    const firstSec = sections.length;
    for (const s of more) {
      firstOf.push(entries.length);
      sections.push(s);
      entries.push(...s.entries);
    }
    index.insertAdjacentHTML('beforeend', indexHTML(part, more));
    main.insertAdjacentHTML('beforeend', sectionsHTML(more, start));
    cards.push(...[...main.querySelectorAll<HTMLButtonElement>('.cx-card')].slice(start));
    secEls.push(...[...main.querySelectorAll<HTMLElement>('.cx-sec')].slice(firstSec));
    indexBtns.push(...[...index.querySelectorAll<HTMLButtonElement>('button')].slice(firstSec));
    for (let i = start; i < cards.length; i++) {
      const c = cards[i];
      c.addEventListener('mouseenter', () => setActive(i), on);
      c.addEventListener('focus', () => i !== active && setActive(i), on);
      c.addEventListener('click', () => openPart(i), on);
      const well = c.querySelector<HTMLElement>('.cx-well')!;
      if (!entries[i].map) {
        stage(well, (rc, w, h) => entries[i].draw(rc, w, h, 0, false));
        continue;
      }
      well.append(document.createElement('canvas'));
      well.dataset.card = String(i);
      mapObserver.observe(well);
    }
    for (let si = firstSec; si < indexBtns.length; si++) indexBtns[si].addEventListener('click', () => toSection(si), on);
    shownSec = -1;
    spy();
  };
  add('Parts', catalog());
  add('Cast', castCatalog());
  setActive(0);
  // The maps read the level generator's registries: they load after the parts are up, so opening the codex stays quick.
  void import('./maps').then((m) => !life.signal.aborted && add('Maps', mapCatalog(m.mapSections())));

  el.addEventListener('click', (e) => act((e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act), on);
  modal.addEventListener('click', (e) => e.target === modal && closePart(), on);

  const menuAction = (a: MenuAction) => {
    if (open >= 0) {
      if (a === 'left' || a === 'prevTab') browse(-1);
      else if (a === 'right' || a === 'nextTab') browse(1);
      else if (a === 'back') back();
      return;
    }
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') move(a);
    else if (a === 'prevTab' || a === 'nextTab') toSection(Math.max(0, Math.min(sections.length - 1, sectionOf(active) + (a === 'prevTab' ? -1 : 1))));
    else if (a === 'confirm') openPart(active);
    else if (a === 'back') back();
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        back();
        return;
      }
      if (open >= 0 && e.code === 'KeyR') {
        act('rotate');
        return;
      }
      const a = KEY_ACTIONS[e.code];
      if (a) {
        e.preventDefault();
        menuAction(a);
        return;
      }
      // Enter on a focused button is that button's own click; with nothing focused it opens the selected part.
      if (e.key === 'Enter' && open < 0 && !(document.activeElement instanceof HTMLButtonElement && el.contains(document.activeElement))) {
        e.preventDefault();
        openPart(active);
      }
    },
    on,
  );
  window.addEventListener('scroll', () => spy(), { passive: true, signal: life.signal });
  spy();
  paintFooter();

  // Gamepads: the menu reader for directions, Ⓐ, Ⓑ and the bumpers; Ⓧ turns the part up close.
  const reader = new MenuPadReader(readMenuPad(connectedPads()));
  let xHeld = true;
  const frame = (now: number) => {
    const pads = connectedPads();
    if (pads.length > 0 !== pad) {
      pad = pads.length > 0;
      paintFooter();
    }
    for (const a of reader.step(readMenuPad(pads), now)) menuAction(a);
    const x = pads.some((p) => p.buttons.at(2)?.pressed);
    if (x && !xHeld) act('rotate');
    xHeld = x;
    const t = now / 1000;
    const frameNo = Math.floor(now / (1000 / 60));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const l of lives) {
      // Up close, only the close-up draws: the cards are under the scrim.
      if (!l.visible || open >= 0 !== (l === closeUp)) continue;
      const w = l.base.clientWidth;
      const h = l.base.clientHeight;
      if (!w || !h) continue;
      if (l.base.width !== Math.round(w * dpr) || l.base.height !== Math.round(h * dpr)) {
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
      l.draw({ s, bg: s, g, lights: null, t, frame: frameNo }, w, h);
    }
  };
  let raf = requestAnimationFrame(function loop(now) {
    raf = requestAnimationFrame(loop);
    frame(now);
  });

  return () => {
    life.abort();
    cancelAnimationFrame(raf);
    observer.disconnect();
    mapObserver.disconnect();
    maps?.dispose();
    el.remove();
    st.remove();
  };
}
