// Effets sonores discrets, synthétisés en WebAudio (aucun fichier à
// charger). Désactivables depuis le menu ; le choix est gardé sur ce
// téléphone. Sans effet tant que le navigateur n'a pas eu de geste
// utilisateur (règle d'autoplay) ou si WebAudio est absent.

export type Sound = "impact" | "tap" | "buzz" | "vote" | "drink" | "culsec";

const KEY = "cs-sound";
const VOLUME = 0.22;

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

export function soundEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // stockage indisponible (navigation privée) : réglage pour la session
  }
  listeners.forEach((l) => l());
  if (on) playSound("tap");
}

export function onSoundChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// iOS ne joue de son qu'après un geste : on réveille le contexte au
// premier toucher.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

function tone(
  ac: AudioContext,
  at: number,
  { freq, to, dur, type = "sine", gain = 1 }: { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number }
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(VOLUME * gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function noise(ac: AudioContext, at: number, dur: number, gain = 1, lowpass = 1800) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = lowpass;
  const g = ac.createGain();
  g.gain.value = VOLUME * gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(at);
}

export function playSound(kind: Sound): void {
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.005;
  switch (kind) {
    case "impact": // « tchok » de flèche + vibration de la corde
      noise(ac, t, 0.07, 1.4, 2500);
      tone(ac, t, { freq: 180, to: 70, dur: 0.12, type: "triangle", gain: 1.1 });
      tone(ac, t + 0.02, { freq: 520, to: 470, dur: 0.25, type: "sine", gain: 0.25 });
      break;
    case "tap":
      tone(ac, t, { freq: 880, to: 1200, dur: 0.06, type: "triangle", gain: 0.6 });
      break;
    case "buzz": // faux départ
      tone(ac, t, { freq: 140, dur: 0.28, type: "sawtooth", gain: 0.45 });
      tone(ac, t, { freq: 147, dur: 0.28, type: "square", gain: 0.25 });
      break;
    case "vote": // résultat du vote : petit carillon
      tone(ac, t, { freq: 660, dur: 0.18, type: "sine", gain: 0.8 });
      tone(ac, t + 0.09, { freq: 880, dur: 0.22, type: "sine", gain: 0.7 });
      tone(ac, t + 0.18, { freq: 1320, dur: 0.3, type: "sine", gain: 0.5 });
      break;
    case "drink": // glouglou
      for (let i = 0; i < 3; i++) tone(ac, t + i * 0.09, { freq: 320 + i * 40, to: 160, dur: 0.08, type: "sine", gain: 0.7 });
      break;
    case "culsec": // fanfare
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(ac, t + i * 0.12, { freq: f, dur: i === 3 ? 0.5 : 0.14, type: "triangle", gain: 0.8 })
      );
      break;
  }
}
