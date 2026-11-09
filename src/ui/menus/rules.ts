import {
  BLOOD_CHOICES,
  GRAVITY_CHOICES,
  gravityLabel,
  MATCH_LENGTHS,
  type MatchRules,
  PART_VARIETIES,
  RULE_CHOICES,
  type TimerRule,
  varietyLabel,
} from '../../game/rules';
import { MODES } from '../../game/modes';
import type { InputManager } from '../../input/input';
import { CanvasMenu } from '../kit/menu';
import type { Ui } from '../kit/ui';
import type { MenuAction } from '../settings-nav';
import { FONT, PAL } from '../style';

const RULE_LABELS: Record<TimerRule, string> = {
  pickSeconds: 'Pick Timer',
  placeSeconds: 'Place Timer',
  raceSeconds: 'Race Timer',
};

interface Choice {
  label: string;
  on: boolean;
  apply: () => void;
}

interface Group {
  id: string;
  title: string;
  choices: Choice[];
}

/**
 * Match rules. Timers, length, Parts and Secret Parts apply from the next match; gravity and weather rebuild the lobby level
 * at once. Online (`listed`), the lobby's own row: Public or Private, which takes it off the lobby list at once.
 */
export class RulesMenu extends CanvasMenu {
  private draft: MatchRules | null = null;
  private onChange: (r: MatchRules) => void = () => {};
  private listed = false;

  constructor(input: Pick<InputManager, 'captured' | 'capturePads'>) {
    super(input, 'rules');
  }

  open(rules: MatchRules, onChange: (r: MatchRules) => void, opts: { listed?: boolean } = {}) {
    this.draft = { ...rules };
    this.onChange = onChange;
    this.listed = !!opts.listed;
    this.ui.resetScroll('panel');
    this.mount();
    this.ui.selected = null;
    this.ui.selectSoon((id) => id.startsWith('p:'));
  }

  act(a: MenuAction) {
    if (a === 'back') this.close();
  }

  /** The groups, in rows: two short ones side by side where they fit, so the card fits a 720p window. */
  private rows(d: MatchRules): Group[][] {
    const set = (apply: () => void) => () => {
      apply();
      this.onChange({ ...d });
    };
    const group = (id: string, title: string, choices: Choice[]): Group => ({ id, title, choices: choices.map((c) => ({ ...c, apply: set(c.apply) })) });
    const length = group(
      'length',
      'Match Length',
      MATCH_LENGTHS.map((l) => ({
        label: l.label,
        on: d.targetScore === l.targetScore && d.maxRounds === l.maxRounds,
        apply: () => {
          d.targetScore = l.targetScore;
          d.maxRounds = l.maxRounds;
        },
      })),
    );
    // Online the lobby's own setting shares the first row, so the card is no taller.
    const lobby = this.listed
      ? group(
          'lobby',
          'Lobby',
          [false, true].map((v) => ({ label: v ? 'Private' : 'Public', on: d.private === v, apply: () => (d.private = v) })),
        )
      : null;
    const timers = (Object.keys(RULE_CHOICES) as TimerRule[]).map((k) =>
      group(
        k,
        RULE_LABELS[k],
        RULE_CHOICES[k].map((v) => ({ label: v === 0 ? 'Off' : `${v}s`, on: d[k] === v, apply: () => (d[k] = v) })),
      ),
    );
    const blood = group(
      'blood',
      'Blood Rounds',
      BLOOD_CHOICES.map((v) => ({ label: v === 0 ? 'Off' : `${v}`, on: d.bloodRounds === v, apply: () => (d.bloodRounds = v) })),
    );
    const world = [
      group(
        'gravity',
        'Gravity',
        GRAVITY_CHOICES.map((v) => ({ label: gravityLabel(v), on: d.gravity === v, apply: () => (d.gravity = v) })),
      ),
      group(
        'weather',
        'Weather',
        [true, false].map((v) => ({ label: v ? 'On' : 'Off', on: d.weather === v, apply: () => (d.weather = v) })),
      ),
    ];
    // A mode that builds nothing has no pick or place to time and no parts to deal (`ModeDef.crate`).
    if (!MODES[d.mode].crate) return [lobby ? [length, lobby] : [length], [timers[2], blood], world];
    return [
      lobby ? [length, lobby] : [length],
      // Pick and place share a row, so Parts fits on the card with no scrolling at 720p; the race and blood another.
      [timers[0], timers[1]],
      [timers[2], blood],
      world,
      [
        group(
          'parts',
          'Parts',
          PART_VARIETIES.map((v) => ({ label: varietyLabel(v), on: d.parts === v, apply: () => (d.parts = v) })),
        ),
        group(
          'secret',
          'Secret Parts',
          [false, true].map((v) => ({ label: v ? 'On' : 'Off', on: d.secretParts === v, apply: () => (d.secretParts = v) })),
        ),
      ],
    ];
  }

  draw(ui: Ui) {
    const d = this.draft;
    if (!d) return;
    const { inner } = ui.sheet(520, 430);
    let y = inner.y;
    if (ui.H >= 330) {
      ui.text('MATCH RULES', inner.x, y + 12, 22, PAL.amber, 'left', 400, FONT.display);
      y += 30;
    }
    const h = Math.max(ui.tap, 26);
    const footY = inner.y + inner.h - Math.max(ui.tap, 28);
    const view = { x: inner.x, y, w: inner.w, h: footY - 8 - y };
    const rows = this.rows(d).flatMap((row) => (inner.w >= 440 ? [row] : row.map((g) => [g])));
    ui.scroll('panel', view, () => {
      let at = view.y;
      for (const row of rows) {
        const gw = (view.w - 20 * (row.length - 1)) / row.length;
        row.forEach((g, i) => {
          const x = view.x + i * (gw + 20);
          ui.text(g.title.toUpperCase(), x, at + 6, 8, PAL.ash, 'left', 800);
          const n = g.choices.length;
          const cw = (gw - 6 * (n - 1)) / n;
          g.choices.forEach((c, k) => {
            ui.button(`p:${g.id}:${k}`, { x: x + k * (cw + 6), y: at + 14, w: cw, h }, c.label, c.apply, {
              style: c.on ? 'ready' : 'secondary',
              on: c.on,
              label: `${g.title}: ${c.label}`,
            });
          });
        });
        at += 14 + h + 8;
      }
      return at;
    });
    const dw = ui.buttonWidth('Done', { style: 'primary' }) + 12;
    ui.button('f:done', { x: inner.x + inner.w - dw, y: footY, w: dw, h: Math.max(ui.tap, 28) }, 'Done', () => this.close(), { style: 'primary' });
  }
}
