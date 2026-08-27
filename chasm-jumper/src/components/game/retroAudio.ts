// Tiny Web Audio engine for chiptune-style 80s sound effects + background music.
// No external assets, no API keys. Square/triangle/noise oscillators only.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let currentTheme: "adventure" | "victory" = "adventure";

export function initAudio() {
  if (ctx) return;
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(masterGain);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.6;
  sfxGain.connect(masterGain);
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.3,
  bend?: number,
) {
  if (!ctx || !sfxGain) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (bend !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, bend), t + duration);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noiseBurst(duration: number, volume = 0.3) {
  if (!ctx || !sfxGain) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(g);
  g.connect(sfxGain);
  src.start(t);
}

type Sfx =
  | "jump" | "jumpHi" | "fall" | "win" | "blip" | "blipHi" | "chime"
  | "boing" | "rocket" | "grapple" | "pickup";

export function playSfx(name: Sfx) {
  if (!ctx) return;
  switch (name) {
    case "jump": tone(440, 0.12, "square", 0.3, 880); break;
    case "jumpHi": tone(660, 0.18, "square", 0.35, 1320); break;
    case "fall": tone(300, 0.6, "sawtooth", 0.35, 60); break;
    case "win":
      tone(523, 0.12, "square", 0.35);
      setTimeout(() => tone(659, 0.12, "square", 0.35), 130);
      setTimeout(() => tone(784, 0.12, "square", 0.35), 260);
      setTimeout(() => tone(1047, 0.4, "square", 0.4), 390);
      break;
    case "blip": tone(220, 0.05, "square", 0.18); break;
    case "blipHi": tone(523, 0.05, "square", 0.18); break;
    case "chime": tone(880, 0.08, "triangle", 0.25); break;
    case "boing": tone(220, 0.25, "sine", 0.4, 880); break;
    case "rocket":
      noiseBurst(0.45, 0.35);
      tone(180, 0.45, "sawtooth", 0.25, 90);
      break;
    case "grapple": tone(660, 0.18, "triangle", 0.3, 220); break;
    case "pickup":
      tone(784, 0.08, "square", 0.3);
      setTimeout(() => tone(1047, 0.12, "square", 0.3), 80);
      break;
  }
}

// --- Background music: simple looped chiptune ---

// Notes in Hz. Adventure theme in A minor pentatonic. Victory in C major.
const ADVENTURE_LEAD = [
  440, 523, 659, 523, 587, 523, 440, 392,
  440, 523, 659, 784, 880, 784, 659, 523,
  494, 587, 740, 587, 659, 587, 494, 440,
  440, 523, 659, 523, 587, 494, 440, 330,
];
const ADVENTURE_BASS = [
  110, 110, 110, 110, 110, 110, 110, 110,
  110, 110, 110, 110, 146, 146, 146, 146,
  98, 98, 98, 98, 98, 98, 98, 98,
  110, 110, 110, 110, 82, 82, 82, 82,
];
const VICTORY_LEAD = [
  523, 659, 784, 1047, 784, 1047, 1319, 1047,
  587, 740, 880, 1175, 880, 1175, 1480, 1175,
];
const VICTORY_BASS = [
  131, 131, 131, 131, 196, 196, 196, 196,
  147, 147, 147, 147, 220, 220, 220, 220,
];

const STEP_MS = 180;

function playMusicNote(freq: number, type: OscillatorType, gainTarget: GainNode, vol: number, dur: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(gainTarget);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function startMusic() {
  if (!ctx || !musicGain) return;
  if (musicTimer !== null) return;
  musicStep = 0;
  const tick = () => {
    if (!musicGain) return;
    const lead = currentTheme === "victory" ? VICTORY_LEAD : ADVENTURE_LEAD;
    const bass = currentTheme === "victory" ? VICTORY_BASS : ADVENTURE_BASS;
    const i = musicStep % lead.length;
    const bi = musicStep % bass.length;
    playMusicNote(lead[i], "square", musicGain, 0.18, 0.18);
    if (musicStep % 2 === 0) {
      playMusicNote(bass[bi], "triangle", musicGain, 0.28, 0.32);
    }
    musicStep++;
  };
  tick();
  musicTimer = window.setInterval(tick, STEP_MS);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function setMusicTheme(theme: "adventure" | "victory") {
  currentTheme = theme;
  musicStep = 0;
}