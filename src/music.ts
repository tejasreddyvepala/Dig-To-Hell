// MusicManager (Spec §16): one music state per site — MINE / YARD / CONSTRUCTION — crossfaded on navigation.
// All music is ORIGINAL and generated live with Web Audio (no copyrighted material, no downloads).
// Asset slots: put licensed/original files in public/music/ and name them in MUSIC_FILES (e.g. 'music/mine.ogg');
// a slot with a file plays that file (looped) instead of the procedural score for that state.
// Settings (music volume, SFX volume, mute) persist in localStorage 'dth_settings'.
import { AUDIO } from './config';
import type { Site } from './state';
import { onAudioReady, setVolumes } from './audio';

export const MUSIC_FILES: Record<Site, string | null> = { mine: null, yard: null, build: null };

// ---- settings ----
const KEY = 'dth_settings';
export const settings = { music: AUDIO.music.volume, sfx: AUDIO.music.sfx, mute: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
export function applySettings(save = true) {
  setVolumes(settings.mute ? 0 : settings.sfx, settings.mute ? 0 : settings.music);
  if (save) try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* session only */ }
}
applySettings(false);

// ---- graph ----
let ac: AudioContext | null = null;
const layer: Partial<Record<Site, GainNode>> = {};
let duckNode: GainNode;
let current: Site = 'mine';
let nextT = 0, step = 0, timer = 0;
const files: Partial<Record<Site, HTMLAudioElement>> = {};

onAudioReady((ctx, bus) => {
  ac = ctx;
  duckNode = ctx.createGain(); duckNode.connect(bus);
  for (const s of ['mine', 'yard', 'build'] as Site[]) {
    const g = ctx.createGain(); g.gain.value = s === current ? 1 : 0; g.connect(duckNode); layer[s] = g;
    const f = MUSIC_FILES[s];
    if (f) {
      const el = new Audio(f); el.loop = true; el.crossOrigin = 'anonymous';
      ctx.createMediaElementSource(el).connect(g); void el.play().catch(() => undefined); files[s] = el;
    }
  }
  nextT = ctx.currentTime + 0.1;
  timer = window.setInterval(schedule, 90);
});

/** Crossfade to a site's music. */
export function setMusicState(site: Site) {
  if (site === current) return;
  current = site;
  if (!ac) return;
  const t = ac.currentTime, x = AUDIO.music.crossfadeSecs;
  for (const s of ['mine', 'yard', 'build'] as Site[]) {
    const g = layer[s]!.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(s === site ? 1 : 0, t + x);
  }
}

/** Duck the music under a big moment (sale, blast). */
export function duckMusic() {
  if (!ac) return;
  const t = ac.currentTime, M = AUDIO.music, g = duckNode.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(M.duckTo, t + 0.08); g.linearRampToValueAtTime(1, t + M.duckSecs);
}

// ---- procedural score ----
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
function note(out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, peak: number, attack = 0.01, lp = 0) {
  const o = ac!.createOscillator(), g = ac!.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  if (lp) { const fl = ac!.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl).connect(g); } else o.connect(g);
  g.connect(out);
  o.start(t); o.stop(t + attack + dur + 0.05);
}
let noiseBuf: AudioBuffer | null = null;
function shaker(out: AudioNode, t: number, peak: number) {
  if (!noiseBuf) { noiseBuf = ac!.createBuffer(1, ac!.sampleRate * 0.2, ac!.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac!.createBufferSource(), f = ac!.createBiquadFilter(), g = ac!.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 0.1);
}

// deterministic per-step variation (the same loop never sounds mechanical, but nothing is random noise)
const hv = (n: number) => { const x = Math.sin(n * 91.345) * 43758.5453; return x - Math.floor(x); };

const SCORE: Record<Site, { bpm: number; play: (out: AudioNode, t: number, i: number, beat: number) => void }> = {
  // MINE: A minor drone, soft heartbeat pulse, distant bells (A minor pentatonic)
  mine: {
    bpm: 84,
    play(out, t, i, beat) {
      if (i % 32 === 0) { note(out, 'sine', midi(33), t, beat * 15, 0.11, 1.2, 400); note(out, 'sine', midi(40), t, beat * 15, 0.06, 1.5, 500); }
      if (i % 4 === 0) note(out, 'sine', midi(45), t, 0.25, i % 8 === 0 ? 0.07 : 0.04, 0.005, 300);
      const bells = [57, 60, 62, 64, 67, 69, 72];
      if (i % 2 === 0 && hv(i) < 0.18) note(out, 'sine', midi(bells[Math.floor(hv(i + 7) * bells.length)] + 12), t, 2.4, 0.035, 0.005);
    },
  },
  // YARD: warm C major pentatonic, pads (C Am F G) + plucks
  yard: {
    bpm: 72,
    play(out, t, i, beat) {
      const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
      const ch = chords[Math.floor(i / 16) % 4];
      if (i % 16 === 0) for (const n of ch) note(out, 'triangle', midi(n + 12), t, beat * 7.5, 0.035, 0.6, 1400);
      if (i % 8 === 0) note(out, 'sine', midi(ch[0]), t, beat * 1.8, 0.07, 0.02, 500);
      const pent = [60, 62, 64, 67, 69, 72, 74];
      if (i % 2 === 0 && hv(i * 1.3) < 0.32) note(out, 'triangle', midi(pent[Math.floor(hv(i + 3) * pent.length)] + 12), t, 0.35, 0.04, 0.004, 3000);
    },
  },
  // CONSTRUCTION: bright D major, arpeggio + bass + shaker, 96 bpm
  build: {
    bpm: 96,
    play(out, t, i, beat) {
      const roots = [50, 55, 57, 50];
      const r = roots[Math.floor(i / 16) % 4];
      const arp = [0, 4, 7, 12, 7, 4, 7, 11];
      note(out, 'triangle', midi(r + 12 + arp[i % 8]), t, 0.18, 0.032, 0.004, 2600);
      if (i % 8 === 0 || i % 8 === 6) note(out, 'sine', midi(r - 12), t, beat * 0.9, 0.09, 0.01, 400);
      if (i % 2 === 1) shaker(out, t, 0.022 + (i % 4 === 3 ? 0.012 : 0));
    },
  },
};

function schedule() {
  if (!ac || ac.state !== 'running') { if (ac) nextT = ac.currentTime + 0.1; return; }
  // all three scores keep their clocks; only audible layers get notes (cheap, and a crossfade blends both)
  const sc = SCORE[current], beat = 60 / sc.bpm, eighth = beat / 2;
  if (nextT < ac.currentTime - 0.5) nextT = ac.currentTime + 0.05;
  while (nextT < ac.currentTime + 0.3) {
    for (const s of ['mine', 'yard', 'build'] as Site[]) {
      if (files[s]) continue;
      const g = layer[s]!;
      if (s === current || g.gain.value > 0.02) SCORE[s].play(g, nextT, step, 60 / SCORE[s].bpm);
    }
    nextT += eighth;
    step++;
  }
}

export const musicDebug = () => ({ current, running: !!ac && ac.state === 'running', timer: !!timer });
