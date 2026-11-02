/**
 * A strict, recording fake of the WebAudio API subset slag uses, for tests
 * in Node (no WebAudio). It enforces the rules real browsers enforce at
 * runtime — exponential ramps can't touch 0, sources start once and must
 * start before stopping, params must stay finite — so tests catch bugs that
 * would otherwise only throw in a browser. Not used by the game itself.
 */

export class FakeParam {
  value: number;
  events = 0;
  constructor(
    private ctx: FakeAudioContext,
    v = 0,
  ) {
    this.value = v;
  }
  private check(v: number, t: number) {
    if (!Number.isFinite(v)) throw new RangeError(`non-finite param value ${v}`);
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`bad time ${t}`);
    this.ctx.paramWrites++;
    this.events++;
    this.ctx.maxParam = Math.max(this.ctx.maxParam, Math.abs(v));
  }
  setValueAtTime(v: number, t: number) {
    this.check(v, t);
    if (t <= this.ctx.currentTime) this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.check(v, t);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.check(v, t);
    if (v <= 0) throw new RangeError('exponentialRampToValueAtTime target must be > 0');
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) {
    this.check(v, t);
    if (!(tc > 0)) throw new RangeError('timeConstant must be > 0');
    return this;
  }
  cancelScheduledValues(t: number) {
    if (!Number.isFinite(t)) throw new RangeError('bad cancel time');
    return this;
  }
}

class FakeNode {
  outputs = new Set<unknown>();
  constructor(readonly context: FakeAudioContext) {
    context.nodes++;
  }
  connect<T>(d: T): T {
    if (!d) throw new TypeError('connect to nothing');
    this.outputs.add(d);
    return d;
  }
  disconnect() {
    this.outputs.clear();
  }
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  startAt = -1;
  stopAt = Infinity;
  ended = false;
  constructor(ctx: FakeAudioContext) {
    super(ctx);
    ctx.sources.add(this);
  }
  start(t = 0) {
    if (this.startAt >= 0) throw new Error('InvalidStateError: start called twice');
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`bad start ${t}`);
    this.startAt = t;
  }
  stop(t = 0) {
    if (this.startAt < 0) throw new Error('InvalidStateError: stop before start');
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`bad stop ${t}`);
    this.stopAt = Math.max(t, this.startAt);
  }
}

class FakeOsc extends FakeSource {
  type = 'sine';
  frequency: FakeParam;
  detune: FakeParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx);
    this.frequency = new FakeParam(ctx, 440);
    this.detune = new FakeParam(ctx, 0);
  }
  setPeriodicWave(_w: unknown) {}
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  playbackRate: FakeParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx);
    this.playbackRate = new FakeParam(ctx, 1);
  }
}

class FakeBuffer {
  private data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(i: number) {
    return this.data[i];
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'running' | 'suspended' = 'running';
  nodes = 0;
  paramWrites = 0;
  maxParam = 0;
  sources = new Set<FakeSource>();
  destination: FakeNode;

  constructor() {
    this.destination = new FakeNode(this);
  }

  private param(v = 0) {
    return new FakeParam(this, v);
  }

  createGain() {
    return Object.assign(new FakeNode(this), { gain: this.param(1) });
  }
  createOscillator() {
    return new FakeOsc(this);
  }
  createBufferSource() {
    return new FakeBufferSource(this);
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this), { type: 'lowpass', frequency: this.param(350), Q: this.param(1), gain: this.param(0) });
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(this), { pan: this.param(0) });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(this), {
      threshold: this.param(-24),
      knee: this.param(30),
      ratio: this.param(12),
      attack: this.param(0.003),
      release: this.param(0.25),
    });
  }
  createConvolver() {
    return Object.assign(new FakeNode(this), { buffer: null as unknown });
  }
  createDelay() {
    return Object.assign(new FakeNode(this), { delayTime: this.param(0) });
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this), { curve: null as unknown, oversample: 'none' });
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    if (real.length !== imag.length) throw new Error('periodic wave length mismatch');
    return {};
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  /** Sources started but not yet stopped at the current time. */
  get playing(): number {
    let n = 0;
    for (const s of this.sources) if (!s.ended && s.startAt >= 0) n++;
    return n;
  }

  /** Advance time, firing `onended` for sources that stopped. */
  advance(dt: number) {
    this.currentTime += dt;
    for (const s of this.sources) {
      if (!s.ended && s.startAt >= 0 && s.stopAt <= this.currentTime) {
        s.ended = true;
        this.sources.delete(s);
        s.onended?.();
      }
    }
  }

  /** As the BaseAudioContext the audio code expects. */
  asContext(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
}
