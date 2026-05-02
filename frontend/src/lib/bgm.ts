/**
 * Persistent ambient BGM — module-singleton pattern.
 * Survives page navigations within the SPA.
 *
 * Audio: deep sub-drone (50Hz + 51Hz beating) + occasional soft ticks.
 * Volume kept low (master 0.25) so it sits behind speech/UI without dominating.
 */

type Listener = (state: { playing: boolean; muted: boolean }) => void;

class Bgm {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<Listener> = new Set();
  private _muted = false;
  private _playing = false;

  constructor() {
    if (typeof window !== "undefined") {
      this._muted = sessionStorage.getItem("girigo:bgmMuted") === "1";
    }
  }

  get state() {
    return { playing: this._playing, muted: this._muted };
  }

  subscribe(cb: Listener) {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    this.listeners.forEach((cb) => cb(this.state));
  }

  /** Start the BGM. Must be called on a user gesture (browser autoplay). */
  async start() {
    if (this._playing || this._muted) return;
    if (typeof window === "undefined") return;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    // Modern browsers create AudioContext in "suspended" state until user gesture.
    // resume() is no-op if already running. If still suspended after this, the
    // browser will enforce silence — which is the correct behavior pre-gesture.
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Will auto-resume on next user click anyway
      }
    }

    const master = ctx.createGain();
    master.gain.value = this._muted ? 0 : 0.25;
    master.connect(ctx.destination);
    this.master = master;

    // ── Reverb (subtle, gives space) ──
    const reverb = ctx.createConvolver();
    const sr = ctx.sampleRate;
    const irLen = sr * 3;
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3) * 0.4;
      }
    }
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    reverb.connect(wet).connect(master);

    // ── 1) Two detuned sub drones (subtle beating creates unease) ──
    [50, 51.3, 100.7].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.12 : 0.4;
      // Slow LFO for breathing motion
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lfoG.gain.value = 0.08;
      lfo.connect(lfoG).connect(g.gain);
      o.connect(g);
      g.connect(master);
      g.connect(reverb);
      o.start();
      lfo.start();
      this.nodes.push({ osc: o, gain: g });
      this.nodes.push({ osc: lfo, gain: lfoG });
    });

    // ── 2) Faint rising dread (very low volume, slow loop) ──
    const dread = ctx.createOscillator();
    const dreadG = ctx.createGain();
    dread.type = "sine";
    dread.frequency.value = 600;
    dreadG.gain.value = 0;
    dread.connect(dreadG).connect(reverb);
    dread.start();
    // Schedule slow swells every 18 seconds
    const scheduleSwell = () => {
      if (!this.ctx || !this._playing) return;
      const now = this.ctx.currentTime;
      const start = now + 1;
      dread.frequency.cancelScheduledValues(now);
      dread.frequency.setValueAtTime(450 + Math.random() * 120, start);
      dread.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 600, start + 6);
      dreadG.gain.cancelScheduledValues(now);
      dreadG.gain.setValueAtTime(0, start);
      dreadG.gain.linearRampToValueAtTime(0.03, start + 3);
      dreadG.gain.linearRampToValueAtTime(0, start + 6);
    };
    scheduleSwell();
    const swellInterval = setInterval(scheduleSwell, 18000);
    this.nodes.push({ osc: dread, gain: dreadG });

    // ── 3) Soft random ticks (clock-like, panned random L/R) ──
    this.tickInterval = setInterval(() => {
      if (!this.ctx || !this._playing) return;
      const c = this.ctx;
      const t = c.currentTime + 0.01;
      const buf = c.createBuffer(1, sr * 0.04, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 5000;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      const pan = c.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 1.6;
      src.connect(hp).connect(g).connect(pan).connect(master);
      src.start(t);
    }, 4000 + Math.random() * 2000);

    // Store reference on instance to clean up
    (this as unknown as { _swellInterval: ReturnType<typeof setInterval> })._swellInterval = swellInterval;

    this._playing = true;
    this.emit();
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    const sw = (this as unknown as { _swellInterval?: ReturnType<typeof setInterval> })._swellInterval;
    if (sw) clearInterval(sw);

    this.nodes.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {}
    });
    this.nodes = [];
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this._playing = false;
    this.emit();
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("girigo:bgmMuted", muted ? "1" : "0");
    }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.25, now + 0.4);
    }
    this.emit();
  }

  toggleMute() {
    this.setMuted(!this._muted);
  }
}

let _instance: Bgm | null = null;
export function getBgm(): Bgm {
  if (!_instance) _instance = new Bgm();
  return _instance;
}
