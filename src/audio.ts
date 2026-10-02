// Web Audio synthesis. No assets. The context is created on the first user gesture (autoplay policy);
// until then every play call is a silent no-op.
import { AUDIO, type MaterialId } from './config';
import { rnd, rndr, rndri } from './util';

let ac: AudioContext | null = null;
let master: GainNode; // SFX bus (into the compressor)
let musicBus: GainNode; // music bus (music.ts plays into it; bypasses the SFX compressor)
let sfxLevel = 1, musicLevel = 1; // user settings 0..1 (mute = 0)
const listeners: ((ac: AudioContext, bus: GainNode) => void)[] = [];
let echoIn: GainNode;
let white: AudioBuffer;
let brown: AudioBuffer;
let voices = 0;

function makeNoise(brownian: boolean): AudioBuffer {
  const len = Math.floor(ac!.sampleRate * 1);
  const b = ac!.createBuffer(1, len, ac!.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brownian) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  try {
    if (!ac) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      ac = new Ctor();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ac.createGain();
      master.gain.value = AUDIO.master * sfxLevel;
      master.connect(comp).connect(ac.destination);
      musicBus = ac.createGain();
      musicBus.gain.value = musicLevel;
      musicBus.connect(ac.destination);
      for (const f of listeners) f(ac, musicBus);
      // cave echo bus: delay with low-passed feedback
      echoIn = ac.createGain();
      const delay = ac.createDelay(0.5);
      delay.delayTime.value = (AUDIO.cave.echoDelay[0] + AUDIO.cave.echoDelay[1]) / 2;
      const fb = ac.createGain(); fb.gain.value = AUDIO.cave.echoFeedback;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = AUDIO.cave.echoLp;
      const wet = ac.createGain(); wet.gain.value = AUDIO.cave.echoGain;
      echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
      white = makeNoise(false);
      brown = makeNoise(true);
    }
    if (ac.state === 'suspended') void ac.resume();
  } catch (e) {
    console.warn('Audio unavailable', e);
    ac = null;
  }
}

export const audioState = () => (ac ? ac.state : 'not-created');

/** Called once the AudioContext exists (music.ts builds its graph here). */
export function onAudioReady(f: (ac: AudioContext, bus: GainNode) => void) { listeners.push(f); if (ac) f(ac, musicBus); }

/** User volume settings (0..1; mute is 0). */
export function setVolumes(sfx: number, music: number) {
  sfxLevel = sfx; musicLevel = music;
  if (!ac) return;
  master.gain.setTargetAtTime(AUDIO.master * sfx, ac.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(music, ac.currentTime, 0.05);
}

const ready = () => !!ac && ac.state === 'running' && voices < AUDIO.maxVoices;
const jitter = () => 1 + rnd(-AUDIO.pitchJitter, AUDIO.pitchJitter);

/** Gain envelope node: attack then exponential-ish decay, auto voice accounting. */
function env(t: number, peak: number, attack: number, decay: number, out: AudioNode): GainNode {
  const g = ac!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(type: OscillatorType, f0: number, f1: number, t: number, peak: number, attack: number, decay: number, out: AudioNode = master) {
  const o = ac!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
  o.connect(env(t, peak, attack, decay, out));
  voices++;
  o.onended = () => voices--;
  o.start(t);
  o.stop(t + attack + decay + 0.02);
}

function noise(buf: AudioBuffer, filter: BiquadFilterType, freq: number, q: number, t: number, peak: number, attack: number, decay: number, out: AudioNode = master, sweepTo?: number) {
  const s = ac!.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = jitter();
  const f = ac!.createBiquadFilter();
  f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
  s.connect(f).connect(env(t, peak, attack, decay, out));
  voices++;
  s.onended = () => voices--;
  s.start(t, Math.random() * 0.5);
  s.stop(t + attack + decay + 0.02);
}

export function playSwing() {
  if (!ready()) return;
  const t = ac!.currentTime, A = AUDIO.swing;
  noise(white, 'bandpass', A.bp[0] * jitter(), 1.2, t, A.gain, A.secs * 0.55, A.secs * 0.45, master, A.bp[1]);
}

/** Impact for one strike. `vol` scales the whole hit (crew strikes are quieter). */
export function playHit(mat: MaterialId, vol = 1) {
  if (!ready()) return;
  const t = ac!.currentTime, j = jitter();
  if (mat === 'dirt') {
    const A = AUDIO.dirt, f = rndr(A.freq) * j;
    tone('triangle', f, f * 0.55, t, A.gain * vol, 0.003, A.decay);
    noise(brown, 'lowpass', A.noiseLp * j, 0.7, t, A.noiseGain * vol, 0.002, A.noiseSecs);
  } else if (mat === 'clay') {
    const A = AUDIO.clay, f = rndr(A.freq) * j;
    noise(brown, 'lowpass', A.lp * j, 0.9, t, A.gain * vol, A.attack, A.decay);
    tone('sine', f, f * 0.7, t, A.thumpGain * vol, A.attack, A.decay);
  } else {
    const A = AUDIO.stone, f = rndr(A.freq) * j;
    const out = mat === 'cave' ? splitEcho() : master;
    tone('triangle', f, f * 0.6, t, A.gain * vol, 0.002, A.decay, out);
    noise(white, 'highpass', A.hp * j, 0.8, t, A.noiseGain * vol, 0.001, A.noiseSecs, out);
  }
}

/** A node feeding both the dry master and the cave echo bus. */
function splitEcho(): AudioNode {
  const g = ac!.createGain();
  g.connect(master);
  g.connect(echoIn);
  return g;
}

export function playBreak(mat: MaterialId, vol = 1) {
  if (!ready()) return;
  const A = AUDIO.brk, t0 = ac!.currentTime, dur = rndr(A.secs), bp = A.bp[mat];
  const out = mat === 'cave' ? splitEcho() : master;
  if (mat === 'dirt' || mat === 'clay') {
    // soft crumble: filtered brown noise body
    noise(brown, 'lowpass', bp[1] * jitter(), 0.7, t0, A.gain * vol, 0.004, dur, out);
  }
  const n = rndri(A.bursts);
  for (let k = 0; k < n; k++) {
    const t = t0 + (k / n) * dur * 0.8 + rnd(0, 0.02);
    const amp = A.gain * vol * (1 - (k / n) * 0.6) * (mat === 'stone' || mat === 'cave' ? 0.9 : 0.55);
    noise(white, 'bandpass', rndr(bp), 1.4, t, amp, 0.002, rnd(0.025, 0.06), out);
  }
  tone('sine', 90 * jitter(), 45, t0, A.gain * vol * 0.8, 0.003, 0.12, out);
  tone('sine', A.thump * jitter(), A.thump * 0.6, t0, A.gain * vol * A.thumpGain, 0.004, A.thumpDecay, out); // weight
}

export function playCrit(mat: MaterialId) {
  if (!ready()) return;
  const A = AUDIO.crit, t = ac!.currentTime, j = jitter();
  const out = mat === 'cave' ? splitEcho() : master;
  tone('sine', A.low * j, A.low * 0.5, t, A.gain, 0.002, A.lowDecay, out);
  tone('square', rndr(A.crack) * j, 600, t, A.gain * 0.22, 0.001, A.crackDecay, out);
  noise(white, 'highpass', A.noiseHp * j, 0.7, t, A.gain * 0.65, 0.001, A.noiseSecs, out);
  tone('triangle', 320 * j, 160, t, A.gain * 0.45, 0.001, 0.05, out); // hard rock transient on top
}

export function playDebris(vol = 1) {
  if (!ready()) return;
  const A = AUDIO.debris, t0 = ac!.currentTime, n = rndri(A.ticks);
  for (let k = 0; k < n; k++) {
    const t = t0 + 0.06 + rnd(0, A.spread);
    const amp = A.gain * vol * (1 - k / (n + 1));
    const f = rndr(A.freq);
    tone('triangle', f, f * 0.8, t, amp, 0.001, rnd(0.012, 0.03));
  }
}

// ---- cart / transport ----
/** Departure/return rumble: low-passed rolling noise. */
export function playRoll(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.roll, t = ac!.currentTime;
  noise(brown, 'lowpass', A.lp * jitter(), 0.8, t, A.gain * vol, 0.08, A.secs);
  tone('triangle', 60 * jitter(), 48, t, A.gain * vol * 0.5, 0.05, A.secs * 0.8);
}

/** Rail clack: low knock + bright tick. */
export function playClack(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.clack, t = ac!.currentTime;
  tone('triangle', A.low * jitter(), A.low * 0.7, t, A.gain * vol, 0.001, 0.04);
  tone('square', rndr(A.tick), 900, t, A.gain * vol * 0.25, 0.001, 0.015);
}

/** Brake squeal on arrival: high sine with vibrato. */
export function playBrake(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.brake, t = ac!.currentTime, f = rndr(A.freq);
  const o = ac!.createOscillator(), lfo = ac!.createOscillator(), lg = ac!.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.85, t + A.secs);
  lfo.frequency.value = A.vibrato; lg.gain.value = f * 0.02;
  lfo.connect(lg).connect(o.frequency);
  o.connect(env(t, A.gain * vol, 0.02, A.secs, master));
  voices++; o.onended = () => voices--;
  o.start(t); lfo.start(t); o.stop(t + A.secs + 0.05); lfo.stop(t + A.secs + 0.05);
  tone('triangle', 70, 50, t, AUDIO.clack.gain * vol * 1.5, 0.002, 0.08); // bump
}

/** Unloading: a rock slide + scattered ticks. */
export function playDump(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.dump, t = ac!.currentTime;
  noise(brown, 'lowpass', A.lp * jitter(), 0.7, t, A.gain * vol, 0.06, A.secs);
  playDebris(vol);
}

/** A rubble piece landing in the cart while loading. */
export function playLoadTick(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.loadTick, t = ac!.currentTime + 0.3, f = rndr(A.freq);
  tone('triangle', f, f * 0.7, t, A.gain * vol, 0.001, 0.03);
}

// ---- surface / purchases / tools ----
function notes(freqs: readonly number[], gap: number, gain: number, type: OscillatorType = 'sine', len = 0.12) {
  if (!ready()) return;
  const t0 = ac!.currentTime;
  freqs.forEach((f, i) => tone(type, f, f * 1.01, t0 + i * gap, gain, 0.005, len));
}

/** Coin: two quick sine tones. Used for seller cash popups. */
export function playCoin(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.coin, t = ac!.currentTime, j = jitter();
  tone('sine', A.f0 * j, A.f0 * j, t, A.gain * vol, 0.003, A.secs * 0.5);
  tone('sine', A.f1 * j, A.f1 * j, t + A.secs * 0.45, A.gain * vol, 0.003, A.secs);
}

/** Discovery-style sting: the first sale, the first stall. */
export function playSting() { notes(AUDIO.sting.notes, AUDIO.sting.gap, AUDIO.sting.gain, 'triangle', 0.22); }
/** Three ascending tones for any purchase. */
export function playPurchase() { notes(AUDIO.purchase.notes, AUDIO.purchase.gap, AUDIO.purchase.gain, 'sine', 0.1); }

/** Hammer knock while the stall is being built. */
export function playKnock(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const t = ac!.currentTime, f = AUDIO.knock.freq * jitter();
  tone('triangle', f, f * 0.6, t, AUDIO.knock.gain * vol, 0.001, 0.07);
  noise(white, 'bandpass', 1800, 1.5, t, AUDIO.knock.gain * vol * 0.4, 0.001, 0.03);
}

/** Jackhammer BRRRT: rapid low impulses + filtered noise for `secs`. */
export function playJack(secs: number) {
  if (!ready()) return;
  const A = AUDIO.jack, t0 = ac!.currentTime;
  const n = Math.max(2, Math.round(secs * A.rate));
  for (let i = 0; i < n; i++) tone('square', rndr(A.pulse), 40, t0 + i / A.rate, A.gain * 0.5, 0.002, 0.03);
  noise(white, 'bandpass', 900 * jitter(), 0.9, t0, A.gain * 0.35, 0.01, secs);
}

/** Extra low weight under heavier tools' impacts (amount 0..1). */
export function playThud(amount: number) {
  if (!ready() || amount <= 0.01) return;
  const A = AUDIO.thud, t = ac!.currentTime, f = A.freq * jitter();
  tone('sine', f, f * 0.6, t, A.gain * amount, 0.003, A.decay);
}

// ---- V2-1: worksite expansion + construction ----
/** Foreman's whistle before a blast: three sharp pitches. */
export function playWhistle() {
  if (!ready()) return;
  const A = AUDIO.whistle, t = ac!.currentTime;
  A.f.forEach((f, i) => tone('sine', f, f * 1.02, t + i * A.secs * 0.55, A.gain, 0.01, A.secs * 0.5));
}

/** Short warning beep while the charges are set. */
export function playBeep() {
  if (!ready()) return;
  const t = ac!.currentTime;
  tone('square', 1320, 1320, t, 0.05, 0.002, 0.06);
}

/** The BOOM: deep sub drop + long rumble + debris. */
export function playBlast() {
  if (!ready()) return;
  const A = AUDIO.blast, t = ac!.currentTime;
  tone('sine', A.low * 2.2, A.low * 0.6, t, A.gain, 0.004, A.secs);
  noise(brown, 'lowpass', 420, 0.7, t, A.gain * 0.9, 0.01, A.secs * 1.3, master, 90);
  noise(white, 'lowpass', 2400, 0.7, t, A.gain * 0.35, 0.002, 0.35, master, 300);
  setTimeout(() => playDebris(1), 250);
  setTimeout(() => playDebris(0.7), 600);
}

/** Construction hammer tap. */
export function playHammer(vol = 1) {
  if (!ready() || vol <= 0.01) return;
  const A = AUDIO.hammer, t = ac!.currentTime, f = A.freq * jitter();
  tone('triangle', f, f * 0.7, t, A.gain * vol, 0.001, 0.05);
  noise(white, 'bandpass', 2600, 2, t, A.gain * vol * 0.3, 0.001, 0.02);
}

/** Big sale: cash register-ish sting (ascending + coins). */
export function playSold() {
  notes([392, 523, 659, 784, 1047], 0.09, 0.17, 'triangle', 0.25);
  setTimeout(() => playCoin(1), 380);
  setTimeout(() => playCoin(0.8), 520);
}
