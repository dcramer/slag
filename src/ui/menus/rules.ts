import { BLOOD_CHOICES, GRAVITY_CHOICES, gravityLabel, MATCH_LENGTHS, type MatchRules, RULE_CHOICES, type TimerRule } from '../../game/rules';
import { el, Overlay } from './overlay';

const RULE_LABELS: Record<TimerRule, string> = {
  pickSeconds: 'Pick Timer',
  placeSeconds: 'Place Timer',
  raceSeconds: 'Race Timer',
};

/**
 * Match rules. Timers, length and Secret Parts apply from the next match; gravity and weather rebuild the lobby level
 * at once. Online (`listed`), the lobby's own row: Public or Private, which takes it off the lobby list at once.
 */
export class RulesMenu extends Overlay {
  open(rules: MatchRules, onChange: (r: MatchRules) => void, opts: { listed?: boolean } = {}) {
    const draft = { ...rules };
    const card = el('div', { className: 'slag-card slag-sheet' }, el('h2', { textContent: 'Match Rules' }));
    const addRow = (title: string, choices: { label: string; on: boolean; apply: () => void }[], into: HTMLElement = card) => {
      const chips = el('div', { className: 'slag-chips' });
      for (const c of choices) {
        const b = el('button', { className: `slag-btn ${c.on ? 'on' : ''}`, type: 'button', textContent: c.label });
        b.onclick = () => {
          c.apply();
          onChange({ ...draft });
          for (const sib of chips.querySelectorAll('button')) sib.classList.toggle('on', sib === b);
        };
        chips.append(b);
      }
      into.append(el('h3', { textContent: title }), chips);
    };
    // Two short rows side by side, so the card fits a 720p window without scrolling.
    const pair = () => {
      const row = el('div', { className: 'slag-pair' });
      const cols = [el('div'), el('div')];
      row.append(...cols);
      card.append(row);
      return cols;
    };
    // Online the lobby's own setting shares the first row, so the card is no taller.
    const [length, lobby] = opts.listed ? pair() : [card, null];
    addRow(
      'Match Length',
      MATCH_LENGTHS.map((l) => ({
        label: l.label,
        on: draft.targetScore === l.targetScore && draft.maxRounds === l.maxRounds,
        apply: () => {
          draft.targetScore = l.targetScore;
          draft.maxRounds = l.maxRounds;
        },
      })),
      length,
    );
    if (lobby)
      addRow(
        'Lobby',
        [false, true].map((v) => ({ label: v ? 'Private' : 'Public', on: draft.private === v, apply: () => (draft.private = v) })),
        lobby,
      );
    for (const k of Object.keys(RULE_CHOICES) as TimerRule[]) {
      addRow(
        RULE_LABELS[k],
        RULE_CHOICES[k].map((v) => ({ label: v === 0 ? 'Off' : `${v}s`, on: draft[k] === v, apply: () => (draft[k] = v) })),
      );
    }
    const [left, right] = pair();
    addRow(
      'Gravity',
      GRAVITY_CHOICES.map((v) => ({ label: gravityLabel(v), on: draft.gravity === v, apply: () => (draft.gravity = v) })),
      left,
    );
    addRow(
      'Weather',
      [true, false].map((v) => ({ label: v ? 'On' : 'Off', on: draft.weather === v, apply: () => (draft.weather = v) })),
      right,
    );
    const [blood, secret] = pair();
    addRow(
      'Blood Rounds',
      BLOOD_CHOICES.map((v) => ({ label: v === 0 ? 'Off' : `${v}`, on: draft.bloodRounds === v, apply: () => (draft.bloodRounds = v) })),
      blood,
    );
    addRow(
      'Secret Parts',
      [false, true].map((v) => ({ label: v ? 'On' : 'Off', on: draft.secretParts === v, apply: () => (draft.secretParts = v) })),
      secret,
    );
    const done = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Done' });
    done.onclick = () => this.close();
    card.append(el('div', { className: 'slag-actions' }, done));
    this.mount(card);
  }
}
