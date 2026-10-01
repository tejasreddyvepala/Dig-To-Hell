// All tuning numbers live here. Never scatter magic numbers elsewhere.

export type RGB = [number, number, number];
export type Range = readonly [number, number];
export type MaterialId = 'dirt' | 'clay' | 'stone' | 'cave';

export interface DebrisSpec {
  frags: Range; // count of solid fragments on break
  fragSize: Range; // fragment radius (logical px)
  dust: Range; // soft dust puffs
  grains: Range; // tiny grains / pebbles
  speed: Range; // fragment launch speed (px/s)
  spin: number; // max rad/s
  bounce: number; // restitution on first floor contact (0 = sticky)
  life: number; // seconds before fade completes
  sparkChance: number; // chance per break of 1+ sparks
  fallThrough: boolean; // fragments fall past the floor (cave: "into unseen space")
}

export interface Material {
  id: MaterialId;
  name: string;
  from: number; // starting depth (m)
  stages: number; // visible damage stages; a chunk breaks after `stages` stages
  hpPerStage: number; // dig power needed per stage (pickaxe = 1 power → one stage per hit)
  metersPerBreak: number; // depth gained each time a chunk of this material breaks
  wall: RGB; // shaft wall + surrounding ground
  face: RGB; // dig-face chunk base
  crack: string; // crack line colour
  dust: string; // dust puff colour
  chip: RGB; // debris fragment base colour
  debris: DebrisSpec;
  hitChips: Range; // small chips thrown on every hit
}

export const MAX_DEPTH = 300;

export const MATERIALS: Material[] = [
  {
    id: 'dirt', name: 'Dirt', from: 0, stages: 3, hpPerStage: 1, metersPerBreak: 0.35,
    wall: [118, 82, 52], face: [138, 96, 60], crack: 'rgba(40,24,12,.85)', dust: 'rgba(196,160,112,', chip: [128, 88, 54],
    debris: { frags: [5, 8], fragSize: [3, 7], dust: [10, 18], grains: [3, 6], speed: [90, 220], spin: 9, bounce: 0.35, life: 0.8, sparkChance: 0, fallThrough: false },
    hitChips: [2, 4],
  },
  {
    id: 'clay', name: 'Clay', from: 75, stages: 4, hpPerStage: 1.2, metersPerBreak: 0.26,
    wall: [150, 74, 44], face: [172, 86, 50], crack: 'rgba(60,18,8,.9)', dust: 'rgba(200,120,80,', chip: [160, 78, 44],
    debris: { frags: [3, 5], fragSize: [7, 12], dust: [6, 10], grains: [3, 5], speed: [60, 150], spin: 4, bounce: 0.08, life: 0.95, sparkChance: 0, fallThrough: false },
    hitChips: [1, 2],
  },
  {
    id: 'stone', name: 'Stone', from: 155, stages: 4, hpPerStage: 1.6, metersPerBreak: 0.22,
    wall: [104, 106, 112], face: [128, 130, 138], crack: 'rgba(28,30,36,.9)', dust: 'rgba(190,192,200,', chip: [120, 122, 130],
    debris: { frags: [6, 12], fragSize: [3, 8], dust: [8, 14], grains: [3, 6], speed: [160, 340], spin: 14, bounce: 0.6, life: 0.8, sparkChance: 0.45, fallThrough: false },
    hitChips: [2, 4],
  },
  {
    id: 'cave', name: 'Cave Rock', from: 250, stages: 5, hpPerStage: 2.2, metersPerBreak: 0.2,
    wall: [56, 62, 80], face: [70, 78, 100], crack: 'rgba(6,6,14,.95)', dust: 'rgba(120,130,160,', chip: [66, 74, 96],
    debris: { frags: [8, 14], fragSize: [3, 8], dust: [10, 16], grains: [5, 9], speed: [140, 300], spin: 12, bounce: 0.5, life: 1.1, sparkChance: 0.25, fallThrough: true },
    hitChips: [2, 4],
  },
];

// ---- tools & crew (0–300 m slice only) ----
export interface Tool { name: string; ic: string; pow: number; cost: number; unlockDepth: number }
export const TOOLS: Tool[] = [
  { name: 'Pickaxe', ic: '⛏️', pow: 1, cost: 0, unlockDepth: 0 },
  { name: 'Jackhammer', ic: '🔨', pow: 3, cost: 2500, unlockDepth: 105 },
];

export type CrewId = 'dig' | 'cart' | 'exc';
export interface Crew {
  id: CrewId; name: string; ic: string; ds: string; cost: number; unlockDepth: number;
  dps: number; // raw dig power per second per unit (0 for carts)
  boost: number; // fractional boost to all crew digging per unit (carts)
  swingSecs: number; // visible strike cadence per worker
}
export const CREW: Crew[] = [
  { id: 'dig', name: 'Digger', ic: '👷', ds: 'Swings a pick all day', cost: 240, unlockDepth: 20, dps: 0.4, boost: 0, swingSecs: 1.1 },
  { id: 'cart', name: 'Mine cart', ic: '🛒', ds: 'Hauls rubble so diggers go faster', cost: 900, unlockDepth: 60, dps: 0, boost: 0.25, swingSecs: 0 },
  { id: 'exc', name: 'Excavator', ic: '🚜', ds: 'A bucket the size of a car', cost: 30000, unlockDepth: 235, dps: 14, boost: 0, swingSecs: 1.8 },
];

// Finds kept from the prototype that fall inside the slice. Animated reveals are Step 3.
export type FindKind = 'coin' | 'car';
export interface Find { d: number; name: string; kind: FindKind; side: 1 | -1 }
export const FINDS: Find[] = [
  { d: 12, name: 'A rusty coin', kind: 'coin', side: 1 },
  { d: 45, name: 'A buried car', kind: 'car', side: -1 },
];

export const CFG = {
  saveKey: 'digtohell_v2',
  saveVersion: 2,
  legacySaveKeys: ['digtohell_v1'], // deliberately discarded: old 15,000 m economy
  saveIntervalMs: 5000,

  // ---- economy ----
  valueDiv: 40, // value V(d) = (1 + d/div)^exp; scales all cash
  valueExp: 1.3,
  cashPerPower: 1, // $ per point of dig power at V = 1 ("+$1" on the first click)
  breakCash: 2, // extra $ (× V) when a chunk breaks
  crewCostGrowth: 1.15,
  findMultBonus: 0.1, // +10% digging per find
  findBonus: { min: 60, incomeSecs: 90, clicks: 40 }, // cash = max(min, income*secs, clickCash*clicks)
  overflowCarry: 0.99, // fraction of a stage that excess damage may carry into the fresh chunk
  critChance: 0.07,
  critStages: 2, // crit advances the crack this many stages
  critCashMult: 5,

  // ---- offline ----
  offlineCapSecs: 8 * 3600,
  offlineMinSecs: 30,
  offlineStepSecs: 1,

  // ---- dig face ----
  face: {
    chunks: 8,
    logicalW: 220, // face geometry is authored at this width and scaled to the shaft
    height: 40, // logical px from surface to chunk bottom
    edgeJitter: 4, // irregular top edge / seams
    seamJitter: 0.12, // fraction of chunk width seams may wander
    hitYMin: 3, hitYMax: 12, // where on the chunk the pick lands (logical px below surface)
    flinchPx: 2.2, // per-hit local push
    flinchDecay: 22, // 1/s spring damping
    flashSecs: 0.07,
    tintJitter: 0.07, // per-chunk brightness variation so chunks read as separate pieces
    revealSecs: 0.35, // fresh material tint fade after a break
    dentPx: 3.2, // clay deformation per stage
    redFleckDepth: 292,
  },

  // ---- player miner ----
  miner: {
    windupMs: 42, // raise
    downswingMs: 30, // accelerated strike; impact lands at windup + downswing
    recoverMs: 120,
    moveSpeed: 26, // 1/s lerp toward target chunk
    reach: 19, // logical px from miner's feet to where the pick tip lands
    queueMax: 3, // pending strikes before extra clicks are dropped
    chainGapMs: 55, // min gap between queued impacts when clicking very fast
    keyboardSpread: 70, // keyboard dig picks a chunk within this logical px of the miner
  },
  crewVisibleMax: 5,
  crewScale: 0.88, // crew figures are drawn slightly smaller than the player's miner
  excavatorReach: 34,
  crewSlots: { dig: [24, 52, 136, 80, 108], cart: [], exc: [196] } as Record<CrewId, number[]>,

  // ---- camera / juice hierarchy ----
  impulse: { hit: 0.6, break: 1.4, crit: 2.2, spring: 340, damping: 26 },
  hitStopMs: 42, // crit freeze
  cameraFollow: 9, // 1/s ease of the view toward true depth (breaks visibly extend the shaft)
  gravity: 900,
  maxParticles: 700,
  text: { life: 0.9, rise: 46, hitSize: 15, breakSize: 19, critSize: 30, max: 10 },
  critFx: { starSecs: 0.16, starSize: 34, ringSecs: 0.24, ringSize: 70, debrisMult: 2 },
  bannerSecs: 3,

  // ---- view ----
  ppm: 12, // pixels per meter
  faceYFrac: 0.62,
  shaftMaxW: 320,
  shaftWFrac: 0.42,
  shaftMinW: 260, // narrow screens: shaft takes at least this (bounded by shaftNarrowFrac)
  shaftNarrowFrac: 0.84,
  scrollSpeed: 0.6,
  scrollExtraM: 40,
  scrollIdleSecs: 3,
  findTeaseM: 40,
  maxDt: 0.1,
  panelRefreshSecs: 0.12,
};

// ---- audio (Web Audio synthesis parameters) ----
export const AUDIO = {
  master: 0.55,
  pitchJitter: 0.05, // ±5% on repeated impacts
  maxVoices: 40,
  crewVolume: 0.28, // crew strikes are quieter than the player's
  swing: { secs: 0.12, hp: 1800, bp: [2400, 5200] as Range, gain: 0.09 },
  dirt: { freq: [90, 130] as Range, decay: 0.07, noiseLp: 900, noiseSecs: 0.06, gain: 0.75, noiseGain: 0.45 },
  clay: { freq: [70, 100] as Range, lp: 420, attack: 0.012, decay: 0.1, gain: 0.85, thumpGain: 0.4 },
  stone: { freq: [180, 350] as Range, decay: 0.045, hp: 3200, noiseSecs: 0.04, gain: 0.5, noiseGain: 0.4 },
  cave: { echoDelay: [0.08, 0.12] as Range, echoGain: 0.28, echoFeedback: 0.3, echoLp: 1600 },
  brk: {
    secs: [0.2, 0.35] as Range, bursts: [4, 7] as Range, gain: 0.55,
    bp: { dirt: [200, 900], clay: [120, 500], stone: [800, 4000], cave: [500, 3000] } as Record<MaterialId, Range>,
  },
  crit: { low: 70, lowDecay: 0.18, crack: [1200, 2500] as Range, crackDecay: 0.05, noiseHp: 1500, noiseSecs: 0.09, gain: 0.9 },
  debris: { ticks: [3, 6] as Range, freq: [150, 600] as Range, spread: 0.35, gain: 0.12 },
};
