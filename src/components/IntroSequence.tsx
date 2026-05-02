"use client";

import { useEffect, useRef, useState } from "react";

const TOTAL_DURATION = 8500; // ms

// Cryptic system messages that appear & dissolve
const PHASES: { t: number; text: string; sub?: string }[] = [
  { t: 800, text: "SYNC...", sub: "음성 분석기 동기화 중" },
  { t: 2400, text: "···", sub: "행동 패턴 데이터 로드" },
  { t: 4200, text: "들립니까", sub: "수신 신호 양호" },
  { t: 6000, text: "확실합니까", sub: "" },
  { t: 7400, text: "그러면 — 시작합시다", sub: "" },
];

export default function IntroSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"gate" | "playing">("gate");
  const [skipping, setSkipping] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const begin = async () => {
    if (phase !== "gate") return;
    setPhase("playing");
    playAudio();

    PHASES.forEach((p, i) => {
      timersRef.current.push(setTimeout(() => setActiveIdx(i), p.t));
    });

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

    // ── Routing: master → destination, with parallel reverb send ──
    const master = ctx.createGain();
    master.gain.value = 0.95;
    master.connect(ctx.destination);

    // Long, dark reverb impulse (~6s)
    const reverb = ctx.createConvolver();
    const irLen = sr * 6;
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        // exponential decay with mild low-pass character
        const decay = Math.pow(1 - i / irLen, 3);
        d[i] = (Math.random() * 2 - 1) * decay * 0.7;
      }
    }
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);

    // ── 1. SUB DRONE — three detuned low oscillators + slow LFO ──
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
      // Subtle volume LFO for living feel
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

    // ── 2. BREATH — filtered noise pulses on a slow rhythm ──
    const breathTimes = [0.6, 2.4, 4.2, 5.8, 7.0];
    breathTimes.forEach((bt, idx) => {
      const buf = ctx.createBuffer(1, sr * 1.4, sr);
      const data = buf.getChannelData(0);
      // pink-ish noise
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

    // ── 3. WHISPER — formant-shaped noise bursts (creepy "voice") ──
    const whisperTimes = [1.4, 3.1, 5.0, 6.8];
    whisperTimes.forEach((wt, idx) => {
      const buf = ctx.createBuffer(1, sr * 0.55, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      // Two parallel formants to suggest a vowel
      const formant1 = ctx.createBiquadFilter();
      formant1.type = "bandpass";
      formant1.frequency.value = idx % 2 === 0 ? 700 : 600;
      formant1.Q.value = 8;
      const formant2 = ctx.createBiquadFilter();
      formant2.type = "bandpass";
      formant2.frequency.value = idx % 2 === 0 ? 1240 : 1800;
      formant2.Q.value = 6;
      const sum = ctx.createGain();
      sum.gain.value = 0.6;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0 + wt);
      env.gain.linearRampToValueAtTime(0.13, t0 + wt + 0.08);
      env.gain.linearRampToValueAtTime(0.13, t0 + wt + 0.35);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + wt + 0.55);
      // Pan whispers L/R for spatial creep
      const pan = ctx.createStereoPanner();
      pan.pan.value = idx % 2 === 0 ? -0.7 : 0.7;
      src.connect(formant1).connect(sum);
      src.connect(formant2).connect(sum);
      sum.connect(env).connect(pan);
      pan.connect(reverb);
      pan.connect(master);
      src.start(t0 + wt);
    });

    // ── 4. CLOCK TICK — high transient every 0.55s ──
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

    // ── 5. RISING DREAD — high sine slowly climbing ──
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

    // ── 6. CRYSTAL PINGS — random high notes with long decay ──
    const pings = [
      { t: 2.1, f: 1860 },
      { t: 3.4, f: 2480 },
      { t: 4.7, f: 1710 },
      { t: 5.6, f: 2960 },
      { t: 6.5, f: 1390 },
    ];
    pings.forEach((p) => {
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

    // ── 7. REVERSE SWELL — building toward the end ──
    const swellBuf = ctx.createBuffer(1, sr * 1.8, sr);
    const sd = swellBuf.getChannelData(0);
    for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (i / sd.length);
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

    // ── 8. FINAL HIT — deep punctuation at the end ──
    const hit = ctx.createOscillator();
    const hitG = ctx.createGain();
    hit.type = "sine";
    hit.frequency.setValueAtTime(160, t0 + 7.6);
    hit.frequency.exponentialRampToValueAtTime(28, t0 + 8.4);
    hitG.gain.setValueAtTime(0, t0 + 7.6);
    hitG.gain.linearRampToValueAtTime(0.85, t0 + 7.65);
    hitG.gain.exponentialRampToValueAtTime(0.001, t0 + 8.4);
    hit.connect(hitG);
    hitG.connect(master);
    hitG.connect(reverb);
    hit.start(t0 + 7.6);
    hit.stop(t0 + 8.5);
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
      {/* Static noise */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-screen tv-noise" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-radial-vignette" />

      {/* REC dot top-right (always visible) */}
      <div className="absolute top-6 right-6 flex items-center gap-2 font-mono text-[10px] text-blood-300 tracking-[0.4em]">
        <span className="w-2 h-2 rounded-full bg-blood-500 rec-pulse" />
        <span>REC</span>
      </div>

      {/* Bottom-left timestamp ticker */}
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
          {/* Horizontal scanline that flickers in */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[60vw] max-w-[480px] h-[1px] bg-blood-500 horiz-line" />

          {/* Phase text — fades in / out */}
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

          {/* Bottom skip hint */}
          <div className="absolute -bottom-24 left-0 right-0 text-center font-mono text-[10px] text-bone-500 tracking-[0.4em] opacity-50">
            click to skip
          </div>
        </div>
      )}
    </div>
  );
}
