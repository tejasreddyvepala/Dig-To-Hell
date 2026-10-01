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

// ---- resources (data-driven; V1 has exactly one) ----
export type ResourceId = 'rubble';
export interface Resource { id: ResourceId; name: string; baseValue: number; color: RGB; rarity: 'common' | 'uncommon' | 'rare' }
export const RESOURCES: Record<ResourceId, Resource> = {
  rubble: { id: 'rubble', name: 'Rubble', baseValue: 1, color: [128, 96, 66], rarity: 'common' },
};

// ---- level upgrades (the cart and the stall are permanent; these improve them) ----
export type UpgradeId = 'cartCap' | 'cartSpeed' | 'loadSpeed' | 'rail' | 'sellSpeed' | 'sellValue' | 'storage';
export type UpgradeGroup = 'transport' | 'surface';
export interface Upgrade { id: UpgradeId; group: UpgradeGroup; name: string; ic: string; baseCost: number; growth: number; maxLevel: number }
export const UPGRADES: Upgrade[] = [
  { id: 'cartCap', group: 'transport', name: 'Cart Capacity', ic: '🛒', baseCost: 80, growth: 1.6, maxLevel: 30 },
  { id: 'cartSpeed', group: 'transport', name: 'Cart Speed', ic: '💨', baseCost: 100, growth: 1.6, maxLevel: 30 },
  { id: 'loadSpeed', group: 'transport', name: 'Loading Speed', ic: '🪣', baseCost: 50, growth: 1.55, maxLevel: 30 },
  { id: 'rail', group: 'transport', name: 'Rail Quality', ic: '🛤️', baseCost: 200, growth: 1.8, maxLevel: 20 },
  { id: 'sellSpeed', group: 'surface', name: 'Sell Speed', ic: '⏩', baseCost: 75, growth: 1.6, maxLevel: 30 },
  { id: 'sellValue', group: 'surface', name: 'Sell Value', ic: '💲', baseCost: 140, growth: 1.75, maxLevel: 30 },
  { id: 'storage', group: 'surface', name: 'Storage', ic: '📦', baseCost: 110, growth: 1.65, maxLevel: 30 },
];

// ---- player tools: a short early ladder, then the Jackhammer changes how digging works ----
export type ToolKind = 'pick' | 'jack';
export interface Tool {
  name: string; ic: string; kind: ToolKind;
  pow: number; // dig power per impact (pickaxe = 1 = one dirt stage)
  burst: number; // impacts per click (jackhammer rattles several)
  cost: number; unlockDepth: number;
  head: string; headScale: number; handle: string; // look in hand
  fx: number; // chip/debris intensity multiplier
  thud: number; // extra low-end weight in the impact sound (0..1)
}
export const TOOLS: Tool[] = [
  { name: 'Pickaxe', ic: '⛏️', kind: 'pick', pow: 1, burst: 1, cost: 0, unlockDepth: 0, head: '#aab3bd', headScale: 1, handle: '#8a5a2b', fx: 1, thud: 0 },
  { name: 'Iron Pickaxe', ic: '⛏️', kind: 'pick', pow: 1.5, burst: 1, cost: 75, unlockDepth: 0, head: '#6f7882', headScale: 1.18, handle: '#6b4423', fx: 1.25, thud: 0.35 },
  { name: 'Heavy Pickaxe', ic: '⚒️', kind: 'pick', pow: 2.25, burst: 1, cost: 260, unlockDepth: 25, head: '#4a5058', headScale: 1.5, handle: '#4e3320', fx: 1.5, thud: 0.8 },
  { name: 'Jackhammer', ic: '🔨', kind: 'jack', pow: 1.4, burst: 4, cost: 1800, unlockDepth: 75, head: '#ffcf3a', headScale: 1, handle: '#3b3f45', fx: 1.3, thud: 0.5 },
];

// ---- crew ----
export type CrewId = 'dig' | 'exc';
export interface Crew {
  id: CrewId; name: string; ic: string; ds: string; cost: number; unlockDepth: number;
  dps: number; // raw dig power per second per unit
  swingSecs: number; // visible strike cadence per worker
}
export const CREW: Crew[] = [
  { id: 'dig', name: 'Digger', ic: '👷', ds: 'Rappels in and digs all day', cost: 80, unlockDepth: 0, dps: 0.6, swingSecs: 1.1 },
  { id: 'exc', name: 'Excavator', ic: '🚜', ds: 'A bucket the size of a car', cost: 30000, unlockDepth: 235, dps: 14, swingSecs: 1.8 },
];

// Finds kept from the prototype that fall inside the slice. Animated reveals are Step 3.
export type FindKind = 'coin' | 'car';
export interface Find { d: number; name: string; kind: FindKind; side: 1 | -1 }
export const FINDS: Find[] = [
  { d: 12, name: 'A rusty coin', kind: 'coin', side: 1 },
  { d: 45, name: 'A buried car', kind: 'car', side: -1 },
];

export const CFG = {
  saveKey: 'digtohell_v3',
  saveVersion: 3,
  migrateFrom: { key: 'digtohell_v2', version: 2 }, // v2 (cash-from-digging) saves migrate: progress kept, cart starts empty at the bottom
  legacySaveKeys: ['digtohell_v1'], // deliberately discarded: old 15,000 m economy
  saveIntervalMs: 5000,

  // ---- economy ----
  valueDiv: 40, // material value per unit V(d) = (1 + d/div)^exp (realised only when sold, Phase 3C)
  valueExp: 1.3,
  crewCostGrowth: 1.28,
  findMultBonus: 0.1, // +10% digging per find (finds give no cash)
  overflowCarry: 0.99, // fraction of a stage that excess damage may carry into the fresh chunk
  critChance: 0.07,
  critStages: 2, // crit advances the crack this many stages

  // ---- rubble (extraction output) ----
  rubble: {
    perBreak: 2, // units added to the dig-site pile per chunk break
    critBreakMult: 2, // a crit that breaks a chunk yields this many times the rubble
    pileVisualMax: 80, // units at which the pile reads as "overflowing"
    arcsPerBreak: 3, // pieces that visibly fly from the broken chunk into the pile
  },

  // ---- cart (one permanent cart; transport) ----
  cart: {
    capacity: { base: 50, perLevel: 0.45 }, // units = base × (1 + perLevel × L)
    loadRate: { base: 3.5, perLevel: 0.35 }, // units/s pile -> cart
    speed: { base: 8, perLevel: 0.25 }, // m/s along the shaft
    railPerLevel: 0.15, // travel speed multiplier per Rail Quality level
    railTiers: [0, 2, 4, 7], // Rail Quality levels where the track visibly upgrades
    bodyTiers: [0, 2, 5, 9], // Cart Capacity levels where the cart body visibly upgrades
    baseTravel: 2.5, // secs added to every trip (start/stop)
    readySecs: 0.6, // full cart pause before departure
    arriveSecs: 0.5, // brake + bump at the surface
    unloadSecs: 1.6, // tip and dump
    surfaceLiftM: 2.4, // the cart parks this far above ground in the headframe
    railX: 211, // logical face x of the rail (right wall: transport side)
    cartX: 198, // logical x of the cart centre
    pileX: 156, // logical x of the rubble pile centre (between the miners and the cart)
    loadArcSecs: 0.16, // a piece arcs from pile to cart this often while loading
    clackEveryM: 2.5, // rail clack spacing
    soundRangeScreens: 1.5, // off-screen cart sounds fade to silence over this many screen heights
  },
  // ---- surface: stockpile, tutorial scrap buyer, scrap stall (the only cash source) ----
  surface: {
    stockOffsetPx: 46, // stockpile centre, px right of the shaft opening (clamped on screen)
    stallOffsetPx: 128, // stall / buyer, px right of the shaft opening
    storage: { base: 120, perLevel: 0.5 }, // units the surface can hold; a full surface makes the cart wait
    storageTiers: [0, 2, 4], // loose pile -> bin -> fenced yard
    sellRate: { base: 1.7, perLevel: 0.35 }, // units/s the seller processes
    price: { base: 3, perLevel: 0.25 }, // $ per unit of material value
    sellSpeedTiers: [0, 3, 6], // seller gets a sorting tray, then a helper bench
    sellValueTiers: [0, 2, 4, 6], // crude sign -> price board -> scale -> proper stall
    stallCost: 80,
    stallBuildSecs: 1.6,
    buyerRate: 30, // units/s the tutorial buyer takes the first load
    cashPopupSecs: 0.9, // seller cash is aggregated into one popup at most this often
    revealSellValueAt: 120, // units sold before Sell Value shows
    revealStorageFrac: 0.5, // stock fraction of capacity that reveals Storage
  },

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
    pulseSecs: 0.12, // local impact highlight at the hit point
    pulseRadius: 13,
    revealSecs: 0.45, // fresh material tint fade after a break
    breakDip: 9, // logical px crater left by a break (bowl-shaped, settles back)
    dipSettle: 5, // 1/s
    craterDepth: 22, // logical px of dark inner earth that craters reveal
    dentPx: 4.5, // clay deformation per stage
    redFleckDepth: 292,
  },

  // ---- player miner ----
  miner: {
    windupMs: 42, // raise
    downswingMs: 30, // accelerated strike; impact lands at windup + downswing
    recoverMs: 120,
    moveSpeed: 26, // 1/s lerp toward target chunk
    reach: 19, // logical px from miner's feet to where the pick tip lands
    queueMax: 8, // pending strikes before extra clicks are dropped (jackhammer bursts queue several)
    chainGapMs: 55, // min gap between queued impacts when clicking very fast
    keyboardSpread: 70, // keyboard dig picks a chunk within this logical px of the miner
  },
  crewVisibleMax: 3, // animated diggers on the face; the rest still dig at full DPS, shown as a helmet row
  crewVisibleWithExc: 2, // the excavator takes one digger's space
  crewSlots: { dig: [20, 56, 118], exc: [24] } as Record<CrewId, number[]>, // right side is the loading area
  crewSlotsWithExc: [70, 118],
  minerStartX: 86,
  crewArriveSecs: 1.2, // rope drop -> slide down -> land -> lamp on -> dig
  jackBurstGapMs: 45, // jackhammer impacts within one click
  reserveHelmetsMax: 8,
  playerScale: 1.12, // player miner is drawn larger + rim + lamp beam so it reads first
  crewScale: 0.85,
  crewFxScale: 0.6, // crew impact intensity relative to the player's (chips, dust, pulse)
  excavatorReach: 34,

  // ---- camera / juice hierarchy ----
  impulse: { hit: 0.3, break: 1.4, crit: 2.1, spring: 340, damping: 26 },
  hitStopMs: 42, // crit freeze
  cameraFollow: 9, // 1/s ease of the view toward true depth (breaks visibly extend the shaft)
  gravity: 900,
  maxParticles: 700,
  text: {
    max: 6, rise: 46,
    brk: { size: 16, life: 0.85, alpha: 0.95 }, // one combined "+N rubble / ▼ m" label (no cash: digging never pays)
    crit: { size: 26, life: 1.1, alpha: 1 },
  },
  critFx: { starSecs: 0.1, starSize: 30, ringSecs: 0.22, ringSize: 64, debrisMult: 2 },
  bannerSecs: 3,

  // ---- view ----
  ppm: 12, // pixels per meter
  faceYFrac: 0.71, // working face sits at ~71% of the viewport during active digging
  shaftMaxW: 400,
  shaftWFrac: 0.46,
  shaftMinW: 260, // narrow screens: shaft takes at least this (bounded by shaftNarrowFrac)
  shaftNarrowFrac: 0.84,
  light: { fadeSpan: 0.75, shaftDark: 0.45, radius: 0.75, glow: 0.14 }, // shaft vignette + warm work light
  scrollSpeed: 0.6,
  scrollAboveM: 14, // how far above ground the camera may scroll (sky + headframe)
  surfaceGroundFrac: 0.6, // when viewing the surface, the ground sits at this fraction of the screen height
  cameraGlide: 5, // 1/s ease when the camera is sent somewhere
  findTeaseM: 40,
  maxDt: 0.1,
  panelRefreshSecs: 0.12,
};

// ---- audio (Web Audio synthesis parameters) ----
export const AUDIO = {
  master: 0.55,
  pitchJitter: 0.05, // ±5% on repeated impacts
  maxVoices: 40,
  crewVolume: 0.2, // crew strikes are clearly subordinate to the player's
  swing: { secs: 0.12, hp: 1800, bp: [2400, 5200] as Range, gain: 0.09 },
  dirt: { freq: [90, 130] as Range, decay: 0.07, noiseLp: 900, noiseSecs: 0.06, gain: 0.75, noiseGain: 0.45 },
  clay: { freq: [70, 100] as Range, lp: 420, attack: 0.012, decay: 0.1, gain: 0.85, thumpGain: 0.4 },
  stone: { freq: [180, 350] as Range, decay: 0.045, hp: 3200, noiseSecs: 0.04, gain: 0.5, noiseGain: 0.4 },
  cave: { echoDelay: [0.08, 0.12] as Range, echoGain: 0.28, echoFeedback: 0.3, echoLp: 1600 },
  brk: {
    secs: [0.2, 0.35] as Range, bursts: [4, 7] as Range, gain: 0.55, thump: 55, thumpGain: 1.1, thumpDecay: 0.2,
    bp: { dirt: [200, 900], clay: [120, 500], stone: [800, 4000], cave: [500, 3000] } as Record<MaterialId, Range>,
  },
  crit: { low: 70, lowDecay: 0.18, crack: [1200, 2500] as Range, crackDecay: 0.05, noiseHp: 1500, noiseSecs: 0.09, gain: 0.9 },
  debris: { ticks: [3, 6] as Range, freq: [150, 600] as Range, spread: 0.35, gain: 0.12 },
  // cart / transport
  roll: { secs: 0.7, lp: 380, gain: 0.32 }, // departure rumble
  clack: { low: 95, tick: [1100, 1900] as Range, gain: 0.16 },
  brake: { freq: [1500, 2600] as Range, secs: 0.32, vibrato: 28, gain: 0.07 },
  dump: { secs: 0.55, lp: 1200, gain: 0.4 },
  loadTick: { freq: [180, 420] as Range, gain: 0.07 },
  // surface / purchases
  coin: { f0: 880, f1: 1320, secs: 0.12, gain: 0.14 },
  sting: { notes: [523, 659, 784, 1047], gap: 0.08, gain: 0.16 },
  purchase: { notes: [440, 660, 880], gap: 0.06, gain: 0.12 },
  knock: { freq: 140, gain: 0.3 },
  jack: { pulse: [55, 70] as Range, rate: 20, gain: 0.32 },
  thud: { freq: 58, decay: 0.16, gain: 0.7 },
};
