// Web Audio synthesis. No assets. The context is created on the first user gesture (autoplay policy);
// until then every play call is a silent no-op.
import { AUDIO, type MaterialId } from './config';
import { rnd, rndr, rndri } from './util';

let ac: AudioContext | null = null;
let master: GainNode;
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
      master.gain.value = AUDIO.master;
      master.connect(comp).connect(ac.destination);
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
