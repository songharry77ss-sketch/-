// Browser-native Web Speech API (ko-KR), same as v1 but cleaner.

let cached: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const cur = window.speechSynthesis.getVoices();
    if (cur.length) {
      cached = cur;
      resolve(cur);
      return;
    }
    const handler = () => {
      cached = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cached);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      if (!cached.length) cached = window.speechSynthesis.getVoices();
      resolve(cached);
    }, 1500);
  });
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const ko = voices.filter((v) => /^ko/i.test(v.lang));
  if (!ko.length) return voices[0];
  const malePats = [/male/i, /InJoon/i, /Junseo/i, /Minsu/i, /Yeongjae/i];
  for (const p of malePats) {
    const m = ko.find((v) => p.test(v.name));
    if (m) return m;
  }
  return ko[0];
}

export async function speakKorean(
  text: string,
  opts?: { rate?: number; pitch?: number; volume?: number; onEnd?: () => void }
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts?.onEnd?.();
    return;
  }
  const voices = await loadVoices();
  const voice = pickKoreanVoice(voices);
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = "ko-KR";
  u.rate = opts?.rate ?? 0.85;
  u.pitch = opts?.pitch ?? 0.7;
  u.volume = opts?.volume ?? 1;
  if (opts?.onEnd) {
    u.onend = opts.onEnd;
    u.onerror = opts.onEnd;
  }
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

export function isRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = false;
  r.interimResults = true;
  r.lang = "ko-KR";
  return r;
}
