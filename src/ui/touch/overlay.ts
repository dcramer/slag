import { type Insets, type TouchInput, type TouchLayout, touchLayout } from '../../input/touch';
import { FONT, PAL } from '../style';
import { safeInsets } from './device';

/**
 * On-screen touch controls (DOM). Purely visual: the geometry comes from the
 * same `touchLayout()` that TouchInput hit-tests with, and the visual layer
 * is `pointer-events:none`, so touches fall through to the game and the
 * HUD's own lobby buttons keep working. Only a few real DOM buttons (menu,
 * fullscreen, the portrait prompt) take pointer events; they carry
 * `data-slag-ui` so TouchInput ignores them.
 *
 * Also hardens the page against mobile browser gestures over the game:
 * scroll/rubber-band, pinch and double-tap zoom, text selection, long-press
 * callouts and the tap highlight.
 */

const CSS = `
.slag-touch{position:fixed;inset:0;pointer-events:none;z-index:5;user-select:none;-webkit-user-select:none;font:700 13px ${FONT.ui};color:#fff;touch-action:none}
.slag-touch.hidden{display:none}
.slag-touch .c{position:absolute;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-direction:column;letter-spacing:.06em;transition:transform .06s,background-color .1s,opacity .2s}
.slag-touch .btn{background:rgba(18,11,8,.55);border:2px solid rgba(255,255,255,.32);box-shadow:0 2px 10px rgba(0,0,0,.35);text-shadow:0 1px 2px rgba(0,0,0,.7)}
.slag-touch .btn.on{background:rgba(255,150,50,.45);border-color:#ffc27a;transform:scale(.94)}
.slag-touch .primary{font:400 20px ${FONT.display};letter-spacing:.08em}
.slag-touch .primary.place{background:rgba(40,140,70,.6);border-color:rgba(140,255,170,.7)}
.slag-touch .primary.place.bad{background:rgba(120,40,40,.4);border-color:rgba(255,120,120,.55);opacity:.75}
.slag-touch .secondary{font-size:12px}
.slag-touch .secondary .ico{font-size:18px;line-height:1}
.slag-touch .ring{position:absolute;inset:-5px;border-radius:50%;pointer-events:none}
.slag-touch .base{border:2px solid rgba(255,255,255,.22);background:radial-gradient(circle,rgba(255,255,255,.06) 0,rgba(255,255,255,.06) 69%,rgba(255,190,110,.10) 70%,rgba(255,190,110,.10) 100%)}
.slag-touch .base.idle{opacity:.45}
.slag-touch .runring{position:absolute;inset:15%;border-radius:50%;border:1px dashed rgba(255,255,255,.22)}
.slag-touch .knob.idle{opacity:.3}
.slag-touch .knob{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),rgba(255,255,255,.18));border:2px solid rgba(255,255,255,.5);box-shadow:0 2px 8px rgba(0,0,0,.4)}
.slag-touch .knob.run{border-color:#ffb02e;box-shadow:0 0 14px rgba(255,160,40,.7)}
.slag-touch .ui{pointer-events:auto;color:#fff;touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent;font-size:18px}
.slag-touch .ui:active{background:rgba(255,150,50,.45)}
.slag-rotate{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:${PAL.ink};color:${PAL.bone};font:600 15px ${FONT.ui};text-align:center;padding:24px;box-sizing:border-box;touch-action:none}
.slag-rotate.hidden{display:none}
.slag-rotate .ph{width:46px;height:78px;border:4px solid ${PAL.amber};border-radius:10px;animation:slagrot 2.2s ease-in-out infinite}
@keyframes slagrot{0%,20%{transform:rotate(0)}50%,80%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
.slag-rotate h2{font:400 30px ${FONT.display};color:${PAL.amber};margin:0}
.slag-rotate button{font:700 15px ${FONT.ui};min-height:44px;color:${PAL.ash};background:none;border:2px solid ${PAL.steel};border-radius:5px;padding:8px 16px;touch-action:manipulation}
`;

export interface OverlayState {
  /** Place phase: can the touch player's ghost be placed where it is? */
  canPlace?: boolean;
  /** Race: what the USE button does right now (the held item's verb); omitted when empty-handed. */
  use?: string;
}

export class TouchOverlay {
  private root = div('slag-touch hidden');
  private base = div('c base');
  private knob = div('c knob');
  private primary = div('c btn primary');
  private secondary = div('c btn secondary');
  private useBtn = div('c btn secondary');
  private ring = div('ring');
  private menu = button('c btn ui', '⚙\uFE0E', 'Settings');
  private full = button('c btn ui', '⛶', 'Fullscreen');
  private rotate = div('slag-rotate hidden');
  private portraitOk = false;
  private layout: TouchLayout = touchLayout(1, 1);
  private key = '';

  constructor(
    private touch: TouchInput,
    container: HTMLElement,
    onMenu: () => void,
  ) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    hardenGestures(container);

    this.base.append(div('runring'));
    // setProperty: Safari before 15.4 only knows the prefixed name, and the DOM's alias for it is deprecated.
    for (const name of ['mask', '-webkit-mask']) this.ring.style.setProperty(name, 'radial-gradient(circle, transparent 62%, #000 64%)');
    this.secondary.append(this.ring);
    this.root.append(this.base, this.knob, this.secondary, this.useBtn, this.primary, this.menu, this.full);
    this.menu.addEventListener('click', onMenu);
    this.full.addEventListener('click', () => void goFullscreen());

    const later = button('', 'Play in Portrait', 'Play in portrait');
    later.addEventListener('click', () => {
      this.portraitOk = true;
      this.rotate.classList.add('hidden');
    });
    const ph = div('ph');
    const h2 = document.createElement('h2');
    h2.textContent = 'Turn It Sideways';
    this.rotate.append(ph, h2, later);
    this.rotate.dataset.slagUi = '';
    document.body.append(this.root, this.rotate);
    touch.vibrate = (ms) => navigator.vibrate?.(ms);
  }

  /** Re-layout (cheap; only rebuilds geometry when the viewport or insets change). */
  private relayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ins: Insets = safeInsets();
    const key = `${w}x${h}:${ins.top},${ins.right},${ins.bottom},${ins.left}`;
    if (key === this.key) return;
    this.key = key;
    this.layout = touchLayout(w, h, ins);
    this.touch.layout = this.layout;
    const L = this.layout;
    place(this.primary, L.primary);
    place(this.secondary, L.secondary);
    place(this.useBtn, L.use);
    place(this.menu, L.menu);
    // Bottom right: the phone lobby's top bar runs into the corners, and its footer has this end free.
    place(this.full, { x: L.menu.x, y: h - ins.bottom - 6 - L.menu.r, r: L.menu.r });
    place(this.base, { x: L.stickHome.x, y: L.stickHome.y, r: L.stickR });
  }

  /** Call once per rendered frame. */
  update(s: OverlayState = {}) {
    this.relayout();
    const t = this.touch;
    const portrait = t.active && window.innerHeight > window.innerWidth * 1.05 && Math.min(window.innerWidth, window.innerHeight) < 600;
    this.rotate.classList.toggle('hidden', !portrait || this.portraitOk);
    this.root.classList.toggle('hidden', !t.active);
    if (!t.active) return;
    const m = t.mode;
    const race = m === 'race';
    const placeMode = m === 'place';
    show(this.base, race);
    show(this.primary, race || placeMode);
    show(this.secondary, race || placeMode);
    show(this.useBtn, race && !!s.use);
    show(this.menu, m !== 'lobby'); // the lobby HUD has its own settings button
    show(this.full, m === 'lobby' && document.fullscreenEnabled && !document.fullscreenElement);
    if (race) {
      const L = this.layout;
      const st = t.stick();
      if (st) {
        place(this.base, { x: st.ax, y: st.ay, r: L.stickR });
        const dx = st.x - st.ax;
        const dy = st.y - st.ay;
        const d = Math.hypot(dx, dy);
        const k = d > L.stickR ? L.stickR / d : 1;
        place(this.knob, { x: st.ax + dx * k, y: st.ay + dy * k, r: L.stickR * 0.42 });
        this.knob.classList.toggle('run', st.run);
      } else {
        place(this.base, { x: L.stickHome.x, y: L.stickHome.y, r: L.stickR });
        place(this.knob, { x: L.stickHome.x, y: L.stickHome.y, r: L.stickR * 0.42 });
        this.knob.classList.remove('run');
      }
      this.base.classList.toggle('idle', !st);
      this.knob.classList.toggle('idle', !st); // the runner often starts right under it
      setLabel(this.primary, 'JUMP');
      this.primary.classList.remove('place', 'bad');
      this.primary.classList.toggle('on', t.holding('jump'));
      setLabel(this.secondary, '💥', 'HOLD');
      const p = t.altProgress();
      this.secondary.classList.toggle('on', p > 0);
      this.ring.style.background = p > 0 ? `conic-gradient(#ff5a1f ${p * 360}deg, transparent 0)` : 'none';
      if (s.use) setLabel(this.useBtn, s.use.toUpperCase());
      this.useBtn.classList.toggle('on', t.holding('use'));
    }
    show(this.knob, race);
    if (placeMode) {
      setLabel(this.primary, 'PLACE');
      this.primary.classList.add('place');
      this.primary.classList.toggle('bad', s.canPlace === false);
      this.primary.classList.toggle('on', t.holding('place'));
      setLabel(this.secondary, '⟳', 'ROTATE');
      this.secondary.classList.toggle('on', t.holding('rotate'));
      this.ring.style.background = 'none';
    }
  }
}

function div(cls: string) {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

function button(cls: string, text: string, label: string) {
  const b = document.createElement('button');
  b.className = cls;
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.dataset.slagUi = '';
  return b;
}

const labels = new WeakMap<HTMLElement, string>();
function setLabel(el: HTMLElement, main: string, sub?: string) {
  const key = `${main}|${sub ?? ''}`;
  if (labels.get(el) === key) return;
  labels.set(el, key);
  const ring = el.querySelector('.ring');
  el.textContent = '';
  if (sub) {
    const i = document.createElement('span');
    i.className = 'ico';
    i.textContent = main;
    const s = document.createElement('span');
    s.textContent = sub;
    el.append(i, s);
  } else el.append(main);
  if (ring) el.append(ring);
}

function place(el: HTMLElement, c: { x: number; y: number; r: number }) {
  el.style.left = `${c.x - c.r}px`;
  el.style.top = `${c.y - c.r}px`;
  el.style.width = el.style.height = `${c.r * 2}px`;
}

function show(el: HTMLElement, on: boolean) {
  el.style.display = on ? '' : 'none';
}

/** Fullscreen + landscape lock where the browser allows it (Android Chrome; not iPhone Safari). */
async function goFullscreen() {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    // Not supported / denied: harmless.
  }
}

/** Stop the browser from treating play as page gestures over the game container. */
function hardenGestures(container: HTMLElement) {
  const s = container.style as CSSStyleDeclaration & { webkitTouchCallout?: string; webkitTapHighlightColor?: string };
  s.touchAction = 'none';
  s.userSelect = 'none';
  s.setProperty('-webkit-user-select', 'none'); // iOS Safari has only the prefixed one
  s.webkitTouchCallout = 'none';
  s.webkitTapHighlightColor = 'transparent';
  for (const el of [document.documentElement, document.body]) el.style.overscrollBehavior = 'none';
  // Older iOS ignores touch-action for double-tap zoom / loupe; cancel the native gesture on the game itself.
  const stop = (e: Event) => e.cancelable && e.preventDefault();
  container.addEventListener('touchstart', stop, { passive: false });
  container.addEventListener('touchmove', stop, { passive: false });
  container.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop);
  document.addEventListener('dblclick', stop);
}
