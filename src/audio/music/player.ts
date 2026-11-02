import type { Mixer } from '../mixer';
import { mtof } from '../synth';
import type { NoteEv, Song } from './compose';
import { INSTRUMENTS, type InstId } from './instruments';
import type { Layer } from './styles';
import { degreeToMidi } from './theory';

/**
 * Sequencer + director.
 *
 * `SongPlayer` schedules one Song with the classic lookahead pattern: each
 * rendered frame it schedules every step whose start time falls within the
 * next LOOKAHEAD seconds of AudioContext time, so timing is sample-accurate
 * no matter how jittery requestAnimationFrame is. Each layer (pad, bass,
 * harmony, lead, drums, perc) has its own gain, so intensity changes are
 * smooth crossfades rather than cuts.
 *
 * `MusicDirector` owns the current song, crossfades to a new one when the
 * level changes, maps match phases to layer mixes, and plays stingers
 * (round start, victory fanfare) in the song's key and instruments.
 */

export const LOOKAHEAD = 0.2;
export const LAYERS: readonly Layer[] = ['pad', 'bass', 'harmony', 'lead', 'drums', 'perc'];
export type Mix = Record<Layer, number>;

export const MIXES = {
  silent: { pad: 0, bass: 0, harmony: 0, lead: 0, drums: 0, perc: 0 },
  countdown: { pad: 1, bass: 0.6, harmony: 0.35, lead: 0, drums: 0, perc: 0.25 },
  calm: { pad: 1, bass: 0.7, harmony: 0.8, lead: 0.5, drums: 0, perc: 0.45 },
  build: { pad: 1, bass: 0.9, harmony: 1, lead: 0.6, drums: 0.35, perc: 0.8 },
  score: { pad: 1, bass: 0.85, harmony: 0.9, lead: 0.35, drums: 0.5, perc: 0.7 },
  drive: { pad: 1, bass: 1, harmony: 1, lead: 1, drums: 1, perc: 1 },
} satisfies Record<string, Mix>;
export type MixName = keyof typeof MIXES;

const LAYER_PRIO: Record<Layer, number> = { drums: 2, bass: 2, lead: 2, harmony: 1, pad: 1, perc: 0 };
const LAYER_REVERB: Record<Layer, number> = { pad: 0.5, lead: 0.35, harmony: 0.3, drums: 0.12, perc: 0.35, bass: 0.04 };

export class SongPlayer {
  readonly bus: GainNode;
  private layers = {} as Record<Layer, GainNode>;
  private trackIn: GainNode[] = [];
  private byStep: { ti: number; n: NoteEv }[][];
  private step = 0;
  private nextTime: number;
  readonly stepDur: number;
  private total: number;
  private mix: Mix = { ...MIXES.silent };
  private stopAt = Infinity;
  /** Notes scheduled (tests / diagnostics). */
  scheduled = 0;

  constructor(
    readonly song: Song,
    private mixer: Mixer,
    start: number,
    fadeIn: number,
  ) {
    const ctx = mixer.ctx;
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0, start);
    this.bus.gain.linearRampToValueAtTime(1, start + Math.max(0.01, fadeIn));
    this.bus.connect(mixer.duck);
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.bus);
      const send = ctx.createGain();
      send.gain.value = LAYER_REVERB[l];
      g.connect(send).connect(mixer.reverbIn);
      this.layers[l] = g;
    }
    for (const tr of song.tracks) {
      const g = ctx.createGain();
      const p = ctx.createStereoPanner();
      p.pan.value = tr.pan;
      g.connect(p).connect(this.layers[tr.layer]);
      this.trackIn.push(g);
    }
    this.stepDur = 60 / song.bpm / song.stepsPerBeat;
    this.total = song.bars * song.stepsPerBar;
    this.byStep = Array.from({ length: this.total }, () => []);
    song.tracks.forEach((tr, ti) => {
      for (const n of tr.notes) this.byStep[n.step % this.total].push({ ti, n });
    });
    this.nextTime = start + 0.05;
  }

  setMix(m: Mix, tc = 0.4): void {
    const t = this.mixer.ctx.currentTime;
    for (const l of LAYERS) {
      this.layers[l].gain.setTargetAtTime(m[l], t, tc);
    }
    this.mix = { ...m };
  }

  /** Swung start time of a step. */
  private when(s: number, base: number): number {
    if (this.song.stepsPerBeat !== 4 || s % 2 === 0) return base;
    return base + this.song.swing * this.stepDur;
  }

  /** Schedule every step starting before `until`. */
  pump(now: number, until = now + LOOKAHEAD): void {
    if (this.nextTime < now - 0.05) {
      // Fell behind (tab hidden, long frame): skip ahead instead of bursting notes.
      const k = Math.ceil((now - this.nextTime) / this.stepDur);
      this.step += k;
      this.nextTime += k * this.stepDur;
    }
    while (this.nextTime < until && this.nextTime < this.stopAt) {
      const s = this.step % this.total;
      const t = this.when(s, this.nextTime);
      for (const { ti, n } of this.byStep[s]) {
        const tr = this.song.tracks[ti];
        if (this.mix[tr.layer] < 0.02) continue; // muted layer: save the CPU
        const v = this.mixer.voice({ bus: 'music', prio: LAYER_PRIO[tr.layer], gain: tr.gain * n.vel, dest: this.trackIn[ti] }, t);
        if (!v) continue;
        INSTRUMENTS[tr.inst](v, t, mtof(n.midi), n.len * this.stepDur);
        this.scheduled++;
      }
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  /** Jump back to bar 1 at time `t` (the race's GO drop). */
  restart(t: number): void {
    this.step = 0;
    this.nextTime = Math.max(t, this.mixer.ctx.currentTime);
  }

  /** Fade out and stop scheduling. */
  stop(fade: number): void {
    const t = this.mixer.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + fade);
    this.stopAt = t + fade;
  }

  /** Release the graph (after the tail has rung out). */
  dispose(): void {
    this.bus.disconnect();
  }

  get done(): boolean {
    return this.mixer.ctx.currentTime > this.stopAt + 3;
  }
}

export class MusicDirector {
  current: SongPlayer | null = null;
  private fading: SongPlayer[] = [];
  private mixName: MixName = 'calm';
  private stingBus: GainNode;

  constructor(private mixer: Mixer) {
    this.stingBus = mixer.ctx.createGain();
    this.stingBus.connect(mixer.duck);
    const send = mixer.ctx.createGain();
    send.gain.value = 0.3;
    this.stingBus.connect(send).connect(mixer.reverbIn);
  }

  get song(): Song | null {
    return this.current?.song ?? null;
  }

  /** Crossfade to a new song. */
  setSong(song: Song, fade = 1.6): void {
    const now = this.mixer.ctx.currentTime;
    if (this.current) {
      this.current.stop(fade);
      this.fading.push(this.current);
    }
    this.current = new SongPlayer(song, this.mixer, now, fade);
    this.current.setMix(MIXES[this.mixName], 0.05);
    this.mixer.setSpace(...song.space);
  }

  setMix(name: MixName, tc = 0.4): void {
    if (name === this.mixName) return;
    this.mixName = name;
    this.current?.setMix(MIXES[name], tc);
  }

  get mix(): MixName {
    return this.mixName;
  }

  pump(now: number): void {
    this.current?.pump(now);
    for (const f of this.fading) f.pump(now);
    this.fading = this.fading.filter((f) => {
      if (f.done) f.dispose();
      return !f.done;
    });
  }

  restart(): void {
    this.current?.restart(this.mixer.ctx.currentTime + 0.02);
  }

  /** MIDI note for a scale degree of the current song (octave 0 ≈ the 4th–5th octave). */
  note(deg: number, octave = 0): number {
    const s = this.song;
    return s ? degreeToMidi(s.root + 24 + 12 * octave, s.mode, deg) : degreeToMidi(60 + 12 * octave, 'ionian', deg);
  }

  private play(inst: InstId, midi: number, t: number, dur: number, gain: number, prio = 3): void {
    const v = this.mixer.voice({ bus: 'music', prio, gain, dest: this.stingBus }, t);
    if (v) INSTRUMENTS[inst](v, t, mtof(midi), dur);
  }

  /** Short in-key motif when a round starts. */
  roundSting(): void {
    const s = this.song;
    if (!s) return;
    const t = this.mixer.ctx.currentTime + 0.05;
    const beat = 60 / s.bpm;
    const step = beat / 2;
    const lead = s.lead;
    const lg = leadGain(s);
    [0, 2, 4].forEach((d, i) => this.play(lead, this.note(d, 0), t + i * step * 0.5, step * 0.45, lg));
    this.play(lead, this.note(7, 0), t + 1.5 * step, beat, lg);
    for (const d of [0, 2, 4]) this.play(s.harmony, this.note(d, -1), t + 1.5 * step, beat * 1.5, harmonyGain(s) * 0.8, 2);
  }

  /** Victory fanfare: triplet pickup, held high tonic over a major chord, drum roll + crash. */
  fanfare(): void {
    const s = this.song;
    const now = this.mixer.ctx.currentTime;
    this.current?.setMix(MIXES.silent, 0.15);
    if (!s) return;
    const t = now + 0.15;
    const beat = Math.min(0.5, 60 / s.bpm);
    const lead = s.lead;
    const lg = leadGain(s) * 1.2;
    const trip = beat / 3;
    [4, 4, 4].forEach((d, i) => this.play(lead, this.note(d, -1), t + i * trip, trip * 0.8, lg));
    this.play(lead, this.note(0, 0), t + beat, beat * 0.9, lg);
    this.play(lead, this.note(4, -1), t + beat * 2, beat * 0.45, lg);
    this.play(lead, this.note(0, 0), t + beat * 2.5, beat * 0.45, lg);
    // Land on the major third, whatever the mode.
    this.play(lead, this.note(0, 0) + 4, t + beat * 3, beat * 3, lg);
    // Major chord (picardy third in minor keys) under the held note.
    const tonic = this.note(0, -1);
    for (const iv of [0, 4, 7, 12]) this.play(s.harmony, tonic + iv, t + beat * 3, beat * 3, harmonyGain(s) * 0.9, 2);
    this.play('sub', tonic - 24, t + beat * 3, beat * 3, 0.3, 2);
    for (let i = 0; i < 8; i++) this.play('snare', 60, t + beat * 2 + (i * beat) / 8, 0.1, 0.06 + i * 0.012, 2);
    this.play('kick', 60, t + beat * 3, 0.3, 0.4, 3);
    this.play('crash', 60, t + beat * 3, 1, 0.12, 3);
  }

  /** Bring the song back after a stinger. */
  resume(mix: MixName, tc = 1.2): void {
    this.mixName = mix;
    this.current?.setMix(MIXES[mix], tc);
  }
}

const leadGain = (s: Song) => s.tracks.find((t) => t.layer === 'lead')?.gain ?? 0.1;
const harmonyGain = (s: Song) => s.tracks.find((t) => t.name === 'harmony')?.gain ?? 0.08;
