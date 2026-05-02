"use client";

import { useEffect, useRef, useState } from "react";
import { getBgm } from "@/lib/bgm";

const TOTAL_DURATION = 9500; // ms

const PHASES: { t: number; text: string; sub?: string }[] = [
  { t: 600, text: "···", sub: "수신 중" },
  { t: 1800, text: "들립니까", sub: "" },
  { t: 3400, text: "거기 누구 있습니까", sub: "" },
  { t: 5000, text: "확실합니까", sub: "" },
  { t: 6800, text: "거짓은 — 침묵 속에서 자랍니다", sub: "" },
  { t: 8400, text: "시작합시다", sub: "표창원" },
];

type Props = {
  onDone: () => void;
};

export default function IntroSequence({ onDone }: Props) {
  const [phase, setPhase] = useState<"gate" | "playing">("gate");
  const [skipping, setSkipping] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const begin = async () => {
    if (phase !== "gate") return;
    setPhase("playing");
    playAudio();
    // CRITICAL: kick off BGM in the SAME user-gesture stack.
    // If we wait until intro ends (8s+), browsers lose gesture context and block audio.
    // BGM will quietly run under the intro then become audible after.
    try {
      await getBgm().start();
    } catch {}
    PHASES.forEach((p, i) =>
      timersRef.current.push(setTimeout(() => setActiveIdx(i), p.t))
    );
    timersRef.current.push(setTimeout(finish, TOTAL_DURATION));
  };

  const finish = () => {
    setSkipping(true);
    setTimeout(() => {
      ctxRef.current?.close().catch(() => {});
      sessionStorage.setItem("girigo:introSeen", "1");
      onDone();
    }, 900);
  };

  const skip = () => {
    if (phase !== "playing" || skipping) return;
    timersRef.current.forEach((t) => clearTimeout(t));
    finish();
  };

  function playAudio() {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    ctxRef.current = ctx;
    const sr = ctx.sampleRate;
    const t0 = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.95;
    master.connect(ctx.destination);

    // Long dark reverb (~6s)
    const reverb = ctx.createConvolver();
    const irLen = sr * 6;
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3) * 0.7;
      }
    }
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);

    // Sub drone — three detuned low oscillators
    const droneBus = ctx.createGain();
    droneBus.gain.setValueAtTime(0, t0);
    droneBus.gain.linearRampToValueAtTime(0.65, t0 + 1.2);
    droneBus.gain.linearRampToValueAtTime(0.7, t0 + 6);
    droneBus.gain.linearRampToValueAtTime(0, t0 + 8.4);
    droneBus.connect(master);
    droneBus.connect(reverb);

    [41, 43.1, 82.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.type = i === 2 ? "triangle" : "sine";
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.22 : 0.55;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.12 + i * 0.04;
      lfoG.gain.value = 0.08;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start(t0);
      lfo.stop(t0 + 8.5);
      o.connect(g).connect(droneBus);
      o.start(t0);
      o.stop(t0 + 8.5);
    });

    // Breath pulses
    const breathTimes = [0.6, 2.4, 4.2, 5.8, 7.0];
    breathTimes.forEach((bt, idx) => {
      const buf = ctx.createBuffer(1, sr * 1.4, sr);
      const data = buf.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        prev = prev * 0.92 + w * 0.08;
        data[i] = prev;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = idx % 2 === 0 ? 480 : 720;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + bt);
      g.gain.linearRampToValueAtTime(0.18, t0 + bt + 0.45);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + bt + 1.3);
      src.connect(bp).connect(g);
      g.connect(master);
      g.connect(reverb);
      src.start(t0 + bt);
    });

    // ── Heartbeat that accelerates as intro progresses (existential dread) ──
    const heartTimes: number[] = [];
    let hbT = 0.4;
    while (hbT < 8.5) {
      heartTimes.push(hbT);
      // Start slow (every 1.0s), accelerate to 0.35s by the end
      const progress = hbT / 8.5;
      const interval = 1.0 - 0.65 * progress;
      hbT += interval;
    }
    heartTimes.forEach((t) => {
      // Two-thump heartbeat (lub-dub)
      [0, 0.12].forEach((off, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(85, t0 + t + off);
        o.frequency.exponentialRampToValueAtTime(35, t0 + t + off + 0.13);
        g.gain.setValueAtTime(0, t0 + t + off);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.55 : 0.35, t0 + t + off + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + off + 0.18);
        o.connect(g).connect(master);
        o.start(t0 + t + off);
        o.stop(t0 + t + off + 0.25);
      });
    });

    // Whispers (formant-shaped noise)
    const whisperTimes = [1.4, 3.1, 5.0, 6.8];
    whisperTimes.forEach((wt, idx) => {
      const buf = ctx.createBuffer(1, sr * 0.55, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f1 = ctx.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.value = idx % 2 === 0 ? 700 : 600;
      f1.Q.value = 8;
      const f2 = ctx.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.value = idx % 2 === 0 ? 1240 : 1800;
      f2.Q.value = 6;
      const sum = ctx.createGain();
      sum.gain.value = 0.6;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0 + wt);
      env.gain.linearRampToValueAtTime(0.13, t0 + wt + 0.08);
      env.gain.linearRampToValueAtTime(0.13, t0 + wt + 0.35);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + wt + 0.55);
      const pan = ctx.createStereoPanner();
      pan.pan.value = idx % 2 === 0 ? -0.7 : 0.7;
      src.connect(f1).connect(sum);
      src.connect(f2).connect(sum);
      sum.connect(env).connect(pan);
      pan.connect(reverb);
      pan.connect(master);
      src.start(t0 + wt);
    });

    // Clock ticks
    for (let i = 0; i < 14; i++) {
      const tt = 1.0 + i * 0.55;
      if (tt > 7.5) break;
      const buf = ctx.createBuffer(1, sr * 0.05, sr);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 4500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + tt);
      g.gain.linearRampToValueAtTime(i % 2 === 0 ? 0.13 : 0.09, t0 + tt + 0.001);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + tt + 0.04);
      const pan = ctx.createStereoPanner();
      pan.pan.value = i % 2 === 0 ? -0.4 : 0.4;
      src.connect(hp).connect(g).connect(pan).connect(master);
      src.start(t0 + tt);
    }

    // Rising dread
    const dread = ctx.createOscillator();
    const dreadG = ctx.createGain();
    dread.type = "sine";
    dread.frequency.setValueAtTime(420, t0 + 3);
    dread.frequency.exponentialRampToValueAtTime(2600, t0 + 7.5);
    dreadG.gain.setValueAtTime(0, t0 + 3);
    dreadG.gain.linearRampToValueAtTime(0.04, t0 + 4.5);
    dreadG.gain.linearRampToValueAtTime(0.09, t0 + 7.3);
    dreadG.gain.linearRampToValueAtTime(0, t0 + 7.8);
    dread.connect(dreadG).connect(reverb);
    dreadG.connect(master);
    dread.start(t0 + 3);
    dread.stop(t0 + 7.9);

    // Crystal pings
    [
      { t: 2.1, f: 1860 },
      { t: 3.4, f: 2480 },
      { t: 4.7, f: 1710 },
      { t: 5.6, f: 2960 },
      { t: 6.5, f: 1390 },
    ].forEach((p) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = p.f;
      g.gain.setValueAtTime(0, t0 + p.t);
      g.gain.linearRampToValueAtTime(0.07, t0 + p.t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + p.t + 1.6);
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 1.6;
      o.connect(g).connect(pan);
      pan.connect(reverb);
      pan.connect(master);
      o.start(t0 + p.t);
      o.stop(t0 + p.t + 1.7);
    });

    // Reverse swell + final boom
    const swellBuf = ctx.createBuffer(1, sr * 1.8, sr);
    const sd = swellBuf.getChannelData(0);
    for (let i = 0; i < sd.length; i++)
      sd[i] = (Math.random() * 2 - 1) * (i / sd.length);
    const swell = ctx.createBufferSource();
    swell.buffer = swellBuf;
    const swellF = ctx.createBiquadFilter();
    swellF.type = "lowpass";
    swellF.frequency.setValueAtTime(400, t0 + 6);
    swellF.frequency.exponentialRampToValueAtTime(4000, t0 + 7.6);
    const swellG = ctx.createGain();
    swellG.gain.setValueAtTime(0, t0 + 6);
    swellG.gain.linearRampToValueAtTime(0.5, t0 + 7.6);
    swellG.gain.linearRampToValueAtTime(0, t0 + 8);
    swell.connect(swellF).connect(swellG);
    swellG.connect(reverb);
    swellG.connect(master);
    swell.start(t0 + 6);

    const hit = ctx.createOscillator();
    const hitG = ctx.createGain();
    hit.type = "sine";
    hit.frequency.setValueAtTime(140, t0 + 7.6);
    hit.frequency.exponentialRampToValueAtTime(28, t0 + 8.4);
    hitG.gain.setValueAtTime(0, t0 + 7.6);
    hitG.gain.linearRampToValueAtTime(0.85, t0 + 7.65);
    hitG.gain.exponentialRampToValueAtTime(0.001, t0 + 8.4);
    hit.connect(hitG);
    hitG.connect(master);
    hitG.connect(reverb);
    hit.start(t0 + 7.6);
    hit.stop(t0 + 8.5);

    // ── Distorted scream / wail (saw + formant + slow pitch slide) at climax ──
    const scream = ctx.createOscillator();
    const screamFilter = ctx.createBiquadFilter();
    const screamGain = ctx.createGain();
    scream.type = "sawtooth";
    // Pitch slides like a wail — high to low
    scream.frequency.setValueAtTime(880, t0 + 6.4);
    scream.frequency.exponentialRampToValueAtTime(220, t0 + 8.4);
    screamFilter.type = "bandpass";
    screamFilter.frequency.value = 1200;
    screamFilter.Q.value = 12;
    screamGain.gain.setValueAtTime(0, t0 + 6.4);
    screamGain.gain.linearRampToValueAtTime(0.06, t0 + 6.8);
    screamGain.gain.linearRampToValueAtTime(0.18, t0 + 7.6);
    screamGain.gain.linearRampToValueAtTime(0, t0 + 8.4);
    // Add a tremolo for distress
    const tremolo = ctx.createOscillator();
    const tremoloG = ctx.createGain();
    tremolo.frequency.value = 7;
    tremoloG.gain.value = 0.5;
    tremolo.connect(tremoloG).connect(screamGain.gain);
    tremolo.start(t0 + 6.4);
    tremolo.stop(t0 + 8.5);
    const screamPan = ctx.createStereoPanner();
    screamPan.pan.setValueAtTime(-0.5, t0 + 6.4);
    screamPan.pan.linearRampToValueAtTime(0.5, t0 + 8.4);
    scream.connect(screamFilter).connect(screamGain).connect(screamPan);
    screamPan.connect(reverb);
    screamPan.connect(master);
    scream.start(t0 + 6.4);
    scream.stop(t0 + 8.5);

    // ── Final climax: triple boom (scary "thud thud THUD") ──
    [
      { t: 7.6, freq: 140, gain: 0.65 },
      { t: 8.2, freq: 110, gain: 0.75 },
      { t: 8.9, freq: 90, gain: 0.95 },  // The biggest one — right when "시작합시다" appears
    ].forEach(({ t, freq, gain }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0 + t);
      o.frequency.exponentialRampToValueAtTime(20, t0 + t + 0.9);
      g.gain.setValueAtTime(0, t0 + t);
      g.gain.linearRampToValueAtTime(gain, t0 + t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + 1.0);
      o.connect(g).connect(master);
      g.connect(reverb);
      o.start(t0 + t);
      o.stop(t0 + t + 1.05);
    });
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-pointer transition-opacity duration-700 ${
        skipping ? "opacity-0" : "opacity-100"
      }`}
      onClick={phase === "gate" ? begin : skip}
    >
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-screen tv-noise" />
      <div className="absolute inset-0 pointer-events-none bg-radial-vignette" />

      <div className="absolute top-6 right-6 flex items-center gap-2 font-mono text-[10px] text-blood-300 tracking-[0.4em]">
        <span className="w-2 h-2 rounded-full bg-blood-500 rec-pulse" />
        <span>REC</span>
      </div>

      <div className="absolute bottom-6 left-6 font-mono text-[10px] text-bone-500 tracking-widest">
        SYS::girigo · CHANNEL_07 · ENCRYPTED
      </div>

      {phase === "gate" ? (
        <div className="text-center select-none">
          <div className="font-mono text-[10px] text-blood-300 tracking-[0.5em] mb-10 text-flicker">
            ▌ 헤드폰 착용을 권장합니다 ▐
          </div>
          <div className="font-serif text-bone-200 text-2xl mb-12 italic opacity-70 leading-relaxed">
            준비되었습니까
            <br />
            <span className="text-base text-bone-300">진실을 마주할 준비</span>
          </div>
          <div className="inline-flex items-center gap-3 font-mono text-[11px] text-bone-300 tracking-[0.4em] uppercase pulse-ring px-8 py-3 border border-blood-700">
            <span className="w-2 h-2 rounded-full bg-blood-500 animate-pulse" />
            <span>Press anywhere to enter</span>
          </div>
          <div className="mt-12 font-mono text-[10px] text-bone-500 tracking-[0.4em] opacity-50">
            ※ 일부 브라우저는 자동재생을 차단합니다
          </div>
        </div>
      ) : (
        <div className="text-center select-none relative">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[60vw] max-w-[480px] h-[1px] bg-blood-500 horiz-line" />
          <div className="min-h-[120px] flex flex-col items-center justify-center">
            {PHASES.map((p, i) => (
              <div
                key={i}
                className={`absolute transition-opacity duration-1000 text-center ${
                  i === activeIdx ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="font-serif text-bone-100 text-4xl md:text-5xl text-glow tracking-wider mb-3">
                  {p.text}
                </div>
                {p.sub && (
                  <div className="font-mono text-[10px] text-blood-300 tracking-[0.5em] uppercase">
                    {p.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="absolute -bottom-24 left-0 right-0 text-center font-mono text-[10px] text-bone-500 tracking-[0.4em] opacity-50">
            click to skip
          </div>
        </div>
      )}
    </div>
  );
}
