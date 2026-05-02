// Browser-native Web Speech API wrapper.
// TTS: speechSynthesis with Korean voice, lower pitch + slower rate for unsettling tone.
// STT: webkit-prefixed SpeechRecognition (Chrome/Edge/Safari support; falls back gracefully).

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Fallback timer
    setTimeout(() => {
      if (cachedVoices.length === 0) {
        cachedVoices = window.speechSynthesis.getVoices();
      }
      resolve(cachedVoices);
    }, 1500);
  });
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  // Prefer male Korean voice, then any Korean, then any voice
  const ko = voices.filter((v) => /^ko/i.test(v.lang));
  if (ko.length === 0) return voices[0];
  // Try common male Korean voice names across platforms
  const malePatterns = [/male/i, /InJoon/i, /Junseo/i, /Minsu/i, /Yeongjae/i, /Daniel/i];
  for (const pat of malePatterns) {
    const found = ko.find((v) => pat.test(v.name));
    if (found) return found;
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
  // Cancel any pending speech
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = "ko-KR";
  u.rate = opts?.rate ?? 0.88;
  u.pitch = opts?.pitch ?? 0.78;
  u.volume = opts?.volume ?? 1.0;
  if (opts?.onEnd) {
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
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

// ─── Speech Recognition (STT) ─────────────────────────────────

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
};

interface SpeechRecognitionEvent extends Event {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

export function isRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognizer(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
    | { new (): SR }
    | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = false;
  r.interimResults = true;
  r.lang = "ko-KR";
  return r;
}
