import { parseSeed } from '../../core/rng';
import { DIFFICULTY_CHOICES, difficultyLabel, type MatchRules } from '../../game/rules';
import type { InputManager } from '../../input/input';
import { icon } from '../../render/hud-kit';
import { THEME_IDS, THEME_LABELS, type ThemeId } from '../../themes';
import { CanvasMenu } from '../kit/menu';
import { domTextEntry, memoryTextEntry, type TextEntry } from '../kit/text-entry';
import type { Ui } from '../kit/ui';
import type { MenuAction } from '../settings-nav';
import { FONT, PAL } from '../style';

/** What the dialog reads from the lobby, live (online a change comes back from the host a few frames later), and how it asks for one. */
export interface LevelPick {
  seed: () => number;
  /** The chosen theme, or null when the seed picks it. */
  theme: () => ThemeId | null;
  rules: () => MatchRules;
  /** The level's name, as the lobby shows it, and the theme it's in (the seed's own when none is chosen). */
  name: () => string;
  shownTheme: () => ThemeId;
  /** A picture of the level as it plays (Renderer.still), or null before there is one. */
  picture: () => HTMLCanvasElement | null;
  setLevel: (seed: number, theme: ThemeId | null) => void;
  setRules: (r: MatchRules) => void;
}

/** A seed as players type it: base 36, which `parseSeed` reads back (every 32-bit seed fits in seven characters). */
export const seedCode = (seed: number): string => (seed >>> 0).toString(36);

const rollSeed = () => (Math.random() * 4294967296) >>> 0;

/**
 * The lobby's level: a picture of it as it plays, turned through the themes (and the seed's own) with the
 * arrows, its seed, and the match's difficulty. Theme and seed each have a dice; difficulty is a choice, and
 * the grab bag lets every level roll its own. A change rebuilds the level at once, and the picture with it.
 */
export class LevelMenu extends CanvasMenu {
  private pick: LevelPick | null = null;
  private entry: TextEntry | null = null;
  /** The seed the field last showed: a new level from elsewhere (a dice, New Level) replaces what's in it. */
  private shown = -1;

  constructor(input: Pick<InputManager, 'captured' | 'capturePads'>) {
    super(input, 'level');
  }

  open(pick: LevelPick) {
    this.close();
    this.pick = pick;
    this.entry =
      typeof document === 'undefined'
        ? memoryTextEntry()
        : domTextEntry({
            maxLength: 24,
            label: 'Seed',
            onKey: (e) => this.fieldKey(e),
            onFocus: () => this.ui.select('seed'),
          });
    this.shown = -1;
    this.ui.resetScroll('panel');
    this.mount();
    this.ui.selected = null;
    this.ui.selectSoon((id) => id.startsWith('theme:'));
  }

  protected override closed() {
    this.entry?.dispose();
    this.entry = null;
  }

  act(a: MenuAction) {
    if (a === 'back') this.done();
  }

  private fieldKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter') this.typed();
    else if (e.key === 'Escape') this.done();
    else if (e.key === 'ArrowDown') this.send('down');
    else if (e.key === 'Tab') this.ui.cycle(e.shiftKey);
    else return false;
    return true;
  }

  /** The seed in the field, if it's been changed: a number or a word, read as a URL's `?seed=` is. */
  private typed() {
    const p = this.pick;
    const v = this.entry?.value.trim();
    if (!p || !v) return;
    const seed = parseSeed(v);
    if (seed !== p.seed()) p.setLevel(seed, p.theme());
  }

  private done() {
    this.typed();
    this.close();
  }

  private dice(ui: Ui, id: string, x: number, y: number, s: number, label: string, roll: () => void) {
    ui.button(id, { x, y, w: s, h: s }, '', roll, { label });
    icon(ui.c, 'dice', x + s / 2, y + (s - 3) / 2, Math.min(11, s * 0.4), PAL.bone);
  }

  /** A tall button with a chevron: the theme before (-1) or after (1) this one. */
  private arrow(ui: Ui, id: string, r: { x: number; y: number; w: number; h: number }, d: -1 | 1, label: string, press: () => void) {
    ui.button(id, r, '', press, { label, step: (k) => (k === d ? press() : undefined) });
    const c = ui.c;
    const cx = r.x + r.w / 2;
    const cy = r.y + (r.h - 3) / 2;
    const k = Math.min(9, r.w * 0.22);
    c.save();
    c.strokeStyle = PAL.bone;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(cx - (d * k) / 2, cy - k);
    c.lineTo(cx + (d * k) / 2, cy);
    c.lineTo(cx - (d * k) / 2, cy + k);
    c.stroke();
    c.restore();
  }

  draw(ui: Ui) {
    const p = this.pick;
    const entry = this.entry;
    if (!p || !entry) return;
    const seed = p.seed();
    if (seed !== this.shown) {
      entry.value = seedCode(seed);
      this.shown = seed;
    }
    const theme = p.theme();
    const rules = p.rules();
    const { inner } = ui.sheet(560, 680);
    let y = inner.y;
    if (ui.H >= 330) {
      ui.text('LEVEL', inner.x, y + 12, 22, PAL.amber, 'left', 400, FONT.display);
      y += 30;
    }
    const h = Math.max(ui.tap, 26);
    const gap = 6;
    const footY = inner.y + inner.h - Math.max(ui.tap, 28);
    const view = { x: inner.x, y, w: inner.w, h: footY - 8 - y };
    // The themes in a ring: the seed's own (Any), then each.
    const ring: (ThemeId | null)[] = [null, ...THEME_IDS];
    const turn = (d: -1 | 1) => p.setLevel(p.seed(), ring[(ring.indexOf(theme) + d + ring.length) % ring.length]);
    ui.scroll('panel', view, () => {
      // Room for the picture's frame above it.
      let at = view.y + 4;
      // The level as it plays, the card's width.
      const pw = Math.round(view.w - 4);
      const px = view.x + 2;
      // The picture takes what the rows under it leave, so the card fits a small window without scrolling:
      // a short window crops it top and bottom rather than narrowing it.
      const below = 4 + 12 + (14 + Math.max(ui.tap, 32) + 10) + (14 + h + 8) + 4;
      const ph = Math.round(Math.max(64, Math.min((pw * 9) / 16, view.h - below)));
      const c = ui.c;
      c.fillStyle = PAL.ink;
      c.fillRect(px - 3, at - 3, pw + 6, ph + 6);
      const pic = p.picture();
      if (pic && pic.width && pic.height) {
        const sh = Math.min(pic.height, (pic.width * ph) / pw);
        const sw = (sh * pw) / ph;
        c.drawImage(pic, (pic.width - sw) / 2, (pic.height - sh) / 2, sw, sh, px, at, pw, ph);
      }
      // What it is, on a band across the picture's foot, as the codex's cards have it.
      const band = Math.min(44, Math.max(30, ph * 0.22));
      c.fillStyle = 'rgba(18,10,7,0.78)';
      c.fillRect(px, at + ph - band, pw, band);
      const tag = (theme ? THEME_LABELS[theme] : `Any · ${THEME_LABELS[p.shownTheme()]}`).toUpperCase();
      const big = band >= 38;
      ui.text(tag, px + 12, at + ph - band + (big ? 11 : 9), big ? 9 : 8, theme ? PAL.amber : PAL.ash, 'left', 800);
      const ds = Math.max(ui.tap, band - 8);
      ui.text(
        ui.fit(p.name(), pw - 36 - ds, big ? 16 : 13, 400, FONT.display),
        px + 12,
        at + ph - (big ? 11 : 8),
        big ? 16 : 13,
        PAL.bone,
        'left',
        400,
        FONT.display,
      );
      c.strokeStyle = theme ? PAL.amber : PAL.ash;
      c.lineWidth = 2;
      c.strokeRect(px - 2, at - 2, pw + 4, ph + 4);
      // The arrows on its edges, over the picture above the band; the theme's dice at the band's end.
      const aw = Math.max(ui.tap, 34);
      const ah = Math.min(ph - band - 12, Math.max(ui.tap, 72));
      const ay = at + (ph - band - ah) / 2;
      this.arrow(ui, 'theme:prev', { x: px + 6, y: ay, w: aw, h: ah }, -1, 'The theme before', () => turn(-1));
      this.arrow(ui, 'theme:next', { x: px + pw - 6 - aw, y: ay, w: aw, h: ah }, 1, 'The theme after', () => turn(1));
      this.dice(ui, 'theme:dice', px + pw - 6 - ds, at + ph - band + (band - ds) / 2, ds, 'A random theme', () => {
        const others = THEME_IDS.filter((t) => t !== theme);
        p.setLevel(p.seed(), others[Math.floor(Math.random() * others.length)]);
      });
      at += ph + 12;

      // Seed: typed (Enter, or closing), or rolled.
      const head = (title: string) => ui.text(title, view.x, at + 6, 8, PAL.ash, 'left', 800);
      head('SEED');
      const fh = Math.max(ui.tap, 32);
      ui.field('seed', { x: view.x, y: at + 14, w: view.w - fh - gap, h: fh }, 'Seed', entry, seedCode(seed), () => this.typed());
      this.dice(ui, 'seed:dice', view.x + view.w - fh, at + 14, fh, 'A new seed', () => p.setLevel(rollSeed(), p.theme()));
      at += 14 + fh + 10;

      // Difficulty: a rule of the match, every level of it.
      head('DIFFICULTY');
      const n = DIFFICULTY_CHOICES.length;
      const dw = (view.w - gap * (n - 1)) / n;
      DIFFICULTY_CHOICES.forEach((d, i) => {
        const on = rules.difficulty === d;
        ui.button(
          `difficulty:${d}`,
          { x: view.x + i * (dw + gap), y: at + 14, w: dw, h },
          difficultyLabel(d),
          () => p.setRules({ ...p.rules(), difficulty: d }),
          {
            style: on ? 'ready' : 'secondary',
            on,
            label: `Difficulty: ${difficultyLabel(d)}`,
          },
        );
      });
      at += 14 + h + 8;
      return at;
    });
    const bw = ui.buttonWidth('Done', { style: 'primary' }) + 12;
    ui.button('f:done', { x: inner.x + inner.w - bw, y: footY, w: bw, h: Math.max(ui.tap, 28) }, 'Done', () => this.done(), { style: 'primary' });
  }
}
