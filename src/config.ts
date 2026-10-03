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
export type UpgradeId = 'cartCap' | 'cartSpeed' | 'loadSpeed' | 'rail' | 'processSpeed' | 'contractValue' | 'rawStorage' | 'crew';
export type UpgradeGroup = 'transport' | 'processing' | 'construction';
export interface Upgrade { id: UpgradeId; group: UpgradeGroup; name: string; ic: string; baseCost: number; growth: number; maxLevel: number }
export const UPGRADES: Upgrade[] = [
  // ECONOMY (Spec §3.1): every price is ceil(baseCost × growth^level); levels and costs live ONLY here.
  { id: 'cartCap', group: 'transport', name: 'Cart Capacity', ic: '🛒', baseCost: 120, growth: 1.55, maxLevel: 30 },
  { id: 'cartSpeed', group: 'transport', name: 'Cart Speed', ic: '💨', baseCost: 90, growth: 1.55, maxLevel: 30 },
  { id: 'loadSpeed', group: 'transport', name: 'Loading Speed', ic: '🪣', baseCost: 50, growth: 1.5, maxLevel: 30 },
  { id: 'rail', group: 'transport', name: 'Track Strength', ic: '🛤️', baseCost: 0, growth: 1, maxLevel: 3 }, // level = track tier (TRACK_TIERS); cost per tier lives there
  { id: 'processSpeed', group: 'processing', name: 'Processing Speed', ic: '⚙️', baseCost: 100, growth: 1.55, maxLevel: 30 },
  { id: 'contractValue', group: 'processing', name: 'Block Quality', ic: '💎', baseCost: 400, growth: 1.8, maxLevel: 10 }, // +value per block PRESSED from now on (never retroactive)
  { id: 'rawStorage', group: 'processing', name: 'Raw Storage', ic: '📦', baseCost: 150, growth: 1.6, maxLevel: 30 },
  { id: 'crew', group: 'construction', name: 'Construction Crew', ic: '👷', baseCost: 400, growth: 1.7, maxLevel: 10 }, // +1 builder each (also bigger truck runs)
];

// ---- track strength: each tier is a physical track with a SAFE LOAD (Spec §7.8) ----
// loadRatio = cart load / safe load: SAFE < strainedAt <= STRAINED <= 1 < OVERLOADED (slower trips, world shows strain).
// Tuned so the starting cart (50) runs safe on Wood (71%) and the FIRST Cart Capacity upgrade (73) overloads it;
// each new tier gives several cart-capacity levels of relief before it strains again.
export interface TrackTier { name: string; safe: number; speed: number; cost: number }
export const TRACK_TIERS: TrackTier[] = [
  { name: 'Wood Track', safe: 70, speed: 1, cost: 0 },
  { name: 'Reinforced Wood Track', safe: 140, speed: 1.15, cost: 250 }, // relief until Cart Capacity Lv 5 (163)
  { name: 'Iron Rail', safe: 260, speed: 1.3, cost: 1200 }, // ... until Lv 10 (275)
  { name: 'Steel Rail', safe: 450, speed: 1.5, cost: 5000 },
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
  yield: number; // rubble per break multiplier: bigger tools visibly produce more material
}
export const TOOLS: Tool[] = [
  { name: 'Pickaxe', ic: '⛏️', kind: 'pick', pow: 1, burst: 1, cost: 0, unlockDepth: 0, head: '#aab3bd', headScale: 1, handle: '#8a5a2b', fx: 1, thud: 0, yield: 1 },
  { name: 'Iron Pickaxe', ic: '⛏️', kind: 'pick', pow: 1.5, burst: 1, cost: 60, unlockDepth: 0, head: '#6f7882', headScale: 1.18, handle: '#6b4423', fx: 1.25, thud: 0.35, yield: 1.25 },
  { name: 'Heavy Pickaxe', ic: '⚒️', kind: 'pick', pow: 2.25, burst: 1, cost: 450, unlockDepth: 25, head: '#4a5058', headScale: 1.5, handle: '#4e3320', fx: 1.5, thud: 0.8, yield: 1.6 },
  { name: 'Jackhammer', ic: '🔨', kind: 'jack', pow: 1.2, burst: 3, cost: 2500, unlockDepth: 75, head: '#ffcf3a', headScale: 1, handle: '#3b3f45', fx: 1.3, thud: 0.5, yield: 2 },
];

// ---- crew ----
export type CrewId = 'dig' | 'exc';
export interface Crew {
  id: CrewId; name: string; ic: string; ds: string; cost: number; unlockDepth: number;
  dps: number; // raw dig power per second per unit (analytic; the excavator bites whole chunks)
  swingSecs: number; // visible strike cadence per worker
  yield: number; // rubble per break multiplier
  needsTier: number; // minimum worksite tier (machines need room)
  max: number; // how many can be owned (machines scale by class, not by stacking copies)
}
export const CREW: Crew[] = [
  { id: 'dig', name: 'Digger', ic: '👷', ds: 'Keeps digging while you do anything else', cost: 120, unlockDepth: 0, dps: 1.2, swingSecs: 1.1, yield: 1, needsTier: 0, max: 999 },
  // the Excavator bites a whole chunk every swingSecs whatever the rock: rubble/s = perBreak × yield / swingSecs (crewRubbleRate)
  { id: 'exc', name: 'Excavator', ic: '🚜', ds: 'Takes a whole chunk per bucket', cost: 4000, unlockDepth: 0, dps: 0, swingSecs: 1.6, yield: 10, needsTier: 1, max: 1 },
];

// ---- worksite tiers (the mine physically expands; face-logical units, x = 0 at the left wall) ----
export interface Worksite {
  name: string;
  width: number; // logical width of the work floor (the shaft itself is CFG.face.logicalW wide, centred)
  chunks: number; // dig-face damage regions
  ceiling: number; // chamber height above the floor (0 = open shaft)
  visible: number; // animated crew on the floor (the rest dig at full rate, shown on the stairs/platform)
  slots: number[]; // crew floor positions
  slotsWithExc: number[]; // crew positions when the excavator is present
  excX: number; // excavator station
  playerX: number; // where the player starts
  cost: number;
  unlockCrew: number; // owned diggers that make the expansion available
}
export const WORKSITES: Worksite[] = [
  { name: 'Narrow Shaft', width: 260, chunks: 8, ceiling: 0, visible: 3, slots: [76, 112, 148], slotsWithExc: [], excX: 0, playerX: 104, cost: 0, unlockCrew: 0 },
  { name: 'Work Chamber', width: 420, chunks: 13, ceiling: 150, visible: 5, slots: [150, 196, 352, 392, 116], slotsWithExc: [262, 352, 392], excX: 112, playerX: 240, cost: 900, unlockCrew: 2 },
];

// ---- construction projects (one plot, reused; each project is bigger than the last) ----
export interface BuildStage { name: string; blocks: number }
export interface Project { id: 'cabin' | 'home'; name: string; value: number; stages: BuildStage[] }
export const PROJECTS: Project[] = [
  { id: 'cabin', name: 'Tiny Cabin', value: 1200, stages: [ // value = sale price at block value ×1.0
    { name: 'Foundation', blocks: 30 }, { name: 'Frame', blocks: 30 }, { name: 'Walls', blocks: 40 }, { name: 'Roof', blocks: 30 }, { name: 'Finishing', blocks: 20 },
  ] },
  { id: 'home', name: 'Two-Story Home', value: 3500, stages: [
    { name: 'Foundation', blocks: 60 }, { name: 'Ground Floor', blocks: 70 }, { name: 'Upper Floor', blocks: 80 }, { name: 'Walls & Siding', blocks: 80 },
    { name: 'Roof', blocks: 70 }, { name: 'Windows & Doors', blocks: 60 }, { name: 'Landscaping', blocks: 40 },
  ] },
];

// Finds kept from the prototype that fall inside the slice. Animated reveals are Step 3.
export type FindKind = 'coin' | 'car';
export interface Find { d: number; name: string; kind: FindKind; side: 1 | -1 }
export const FINDS: Find[] = [
  { d: 12, name: 'A rusty coin', kind: 'coin', side: 1 },
  { d: 45, name: 'A buried car', kind: 'car', side: 1 }, // right of the shaft: the left wall holds the ladder/stairs
];

export const CFG = {
  saveKey: 'digtohell_v6',
  saveVersion: 6,
  // older saves migrate (progress, cash and material kept): v4 = Phase 3C.5 (truck paid cash), v3 = 3A–3C, v2 = cash-from-digging
  migrateFrom: [{ key: 'digtohell_v5', version: 5 }, { key: 'digtohell_v4', version: 4 }, { key: 'digtohell_v3', version: 3 }, { key: 'digtohell_v2', version: 2 }],
  legacySaveKeys: ['digtohell_v1'], // deliberately discarded: old 15,000 m economy
  saveIntervalMs: 5000,

  // ---- economy ----
  valueDiv: 120, // BLOCK VALUE of material dug at depth d: V(d) = (1 + d/div)^exp → ×1.17 @20 m, ×1.83 @100 m, ×3.5 @300 m
  valueExp: 1,
  crewCostGrowth: 1.22,
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
    bodyTiers: [0, 2, 5, 9], // Cart Capacity levels where the cart body visibly upgrades
    baseTravel: 2.5, // secs added to every trip (start/stop)
    readySecs: 0.6, // full cart pause before departure
    arriveSecs: 0.5, // brake + bump at the surface
    unloadSecs: 1.6, // tip and dump
    surfaceLiftM: 7, // the cart parks this far above ground in the headframe, over the hopper mouth
    headframeM: 16, // headframe pulley height above ground (~2.5 worker heights)
    railX: 249, // logical face x of the rail (right wall: transport side)
    cartX: 234, // logical x of the cart centre
    pileX: 186, // logical x of the rubble pile centre (between the miners and the cart)
    loadArcSecs: 0.16, // a piece arcs from pile to cart this often while loading
    clackEveryM: 2.5, // rail clack spacing
    soundRangeScreens: 1.5, // off-screen cart sounds fade to silence over this many screen heights
  },
  // ---- surface: the Recycling Yard (the only cash source is a loaded truck leaving) ----
  // Phase 3C's Scrap Buyer / Scrap Stall seller model is superseded by this production chain:
  // raw material -> hopper -> crusher + auger -> press -> finished blocks -> delivery truck -> cash.
  yard: {
    workerUnit: 30, // logical px of a person's height at the surface (× face scale) — all yard scale derives from it
    cost: 250, // the first real industrial installation (contract advance tops the player up to this)
    buildSecs: 2.6,
    rawStorage: { base: 120, perLevel: 0.5 }, // raw units the hopper/yard holds; when full the cart waits
    processRate: { base: 1.5, perLevel: 0.35 }, // raw units/s turned into finished blocks
    marketPrice: 3, // $ the contractor pays per unit of raw material value (his small sample purchase)
    qualityPerLevel: 0.08, // Block Quality: +8% value on every block PRESSED after the purchase
    pressBatch: 4, // units per press cycle (visual cadence; a block appears each THUMP)
    contractorRate: 30, // units/s the contractor (tutorial buyer) takes before the yard exists
    // the delivery truck lives at the yard: PARKED -> LOADING -> TO_SITE -> UNLOADING (at the plot) -> RETURNING -> PARKED
    // capacity / loadRate / unloadRate are the BASE crew's values; each Construction Crew level adds truckPerCrew of them
    truck: { capacity: 60, pickupMin: 15, arriveSecs: 3.6, driveSecs: 4, loadRate: 16, unloadRate: 20, minLoadSecs: 1.8, waitSecs: 4, perCrew: 0.5 },
    processTiers: [0, 3, 6], // faster parts, then a second crusher drum, then a bigger press
    valueTiers: [0, 2, 4, 6], // painted sign -> contract board -> weigh station -> company livery
    storageTiers: [0, 2, 4], // hopper -> bigger hopper -> overflow bunker
    revealValueAt: 120, // units delivered before Contract Value shows
    revealStorageFrac: 0.5, // raw fraction of capacity that reveals Raw Storage
    stackVisualMax: 120, // finished units at which the output stack reads as full
  },

  // ---- construction ----
  build: {
    perBuilder: 1.25, // blocks/s each builder lays; builders = baseBuilders + Construction Crew level
    baseBuilders: 2,
    revealBacklog: 120, // blocks waiting on the plot while a stage is underway (a real backlog, not one truckload) → CONSTRUCTION CREW is revealed
    autoStartSecs: 1.2, // a stage starts by itself this long after its blocks are on the plot (anywhere, any site, offline too)
    milestoneShare: 0.5, // all stage payments together = this × property value; each stage gets its block share
    repeatDecay: 0.1, // TEMPORARY until more projects exist: each repeat of the same project sells for 10% less…
    repeatFloor: 0.6, // …never below 60%
    soldHoldSecs: 2.4, // SOLD sign hold before the plot clears
    clearSecs: 2.2, // bulldozer cleanup
    plotOffsetU: 4.6, // plot centre, in surface worker units right of the yard's truck bay end
    stackVisualMax: 120,
  },

  // ---- workers: lightweight fatigue + rest platform ----
  rest: {
    work: [60, 120] as const, // secs of work before a worker gets tired (staggered)
    rest: [10, 18] as const, // secs on the bench
    seats: 3,
    uptime: 0.85, // analytic share of time crew dig (offline / hidden crew)
    walk: 34, climb: 22, // logical px/s
    stairFootX: 58, landingX: 12, landingY: -44, platformY: -88, platformW: 62, seatX: [12, 28, 44],
    minDepth: 22, // m: the rest platform is built into the wall once the shaft is this deep (before that nobody tires)
    ladderX: 42, // the access ladder on the left wall (surface <-> platform/floor)
    idleEvery: [24, 60] as const, // secs between personality idles per worker
    idleSecs: [2.2, 3.2] as const,
  },

  // ---- first-time introduction ----
  intro: {
    lineSecs: 2.6, // each opening line
    rubbleToCart: 8, // rubble dug before "RUBBLE ISN'T MONEY"
    contractorTalkSecs: 3.2, // contractor inspects the first load before buying it
    sampleQty: 20, // the contractor buys a small SAMPLE of the first load at market price…
    // …then pays a CONTRACT ADVANCE that tops the player up to the Recycling Yard's cost (bootstrap, not rubble value)
  },

  // ---- track strain (see TRACK_TIERS) ----
  track: {
    strainedAt: 0.75, // loadRatio where the world starts creaking
    overloadPenalty: 0.3, // overloaded trips: -30% travel speed (no damage, no material loss)
    upgradeSecs: 2.6, // physical reinforcement sequence (the cart waits)
    joltEveryM: 3, // overloaded cart: a tiny camera jolt per joint crossed
    jolt: 0.35, // impulse size (a normal hit is 0.3)
  },

  // ---- navigation ----
  nav: { transitSecs: 0.75, quickSecs: 0.35, quickWithinSecs: 2.5 },

  // ---- offline ----
  offlineCapSecs: 8 * 3600,
  offlineMinSecs: 30,
  offlineStepSecs: 1,

  // ---- dig face ----
  face: {
    chunks: 8,
    logicalW: 260, // face geometry is authored at this width and scaled to the shaft
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
    crackDepthFrac: 0.62, // cracks are clipped above this fraction of the face band (no cracks in untouched ground)
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
  crewArriveSecs: 1.6, // new hire climbs down the stairs from above, lamp on, starts digging
  jackBurstGapMs: 45, // jackhammer impacts within one click
  reserveHelmetsMax: 8,
  playerScale: 1.15, // ~1.1× a worker: the player reads by clothing, lamp and position, never by giant scale
  crewScale: 1.05,
  excavatorScale: 1.35, // machines share world scale: clearly bigger than a person
  crewFxScale: 0.6, // crew impact intensity relative to the player's (chips, dust, pulse)
  excavatorReach: 88, // logical px from the excavator's centre to where the bucket bites

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

  // ---- surface day/night (cosmetic only) ----
  daynight: { cycleSecs: 600, startPhase: 0.1 },

  // ---- geology painter (deterministic; cached 5 m segments) ----
  geo: { segmentM: 5, res: 0.5, halfWidthM: 110, maxBuildsPerFrame: 1, prefetch: 3, cacheSegments: 90 },

  // ---- view ----
  ppm: 12, // pixels per meter
  faceYFrac: 0.71, // working face sits at ~71% of the viewport during active digging
  shaftMaxW: 680,
  shaftWFrac: 0.6, // the working shaft dominates the game canvas
  shaftMinW: 260, // narrow screens: shaft takes at least this (bounded by shaftNarrowFrac)
  shaftNarrowFrac: 0.84,
  shaftCenterFrac: 0.45, // shaft sits slightly left so the Recycling Yard fits on the right at the surface
  zoom: { dig: 1, surfaceMax: 1, buildMax: 1.3, surfaceMin: 0.45, ease: 3.5 }, // camera scale: close at the dig site; the surface pans + fits the yard
  fxScaleRef: 1.8, // face scale the particle sizes were authored at (effects grow with the work area)
  light: { fadeSpan: 0.75, shaftDark: 0.45, radius: 0.75, glow: 0.14, maxDark: 0.42, darkAtM: 260 }, // shaft vignette, work light, depth darkness
  scrollSpeed: 0.6,
  scrollAboveM: 14, // how far above ground the camera may scroll (sky + headframe)
  surfaceGroundFrac: 0.72, // when viewing the surface, the ground sits at this fraction of the screen height
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
  whistle: { f: [1800, 2500, 2000] as const, secs: 0.4, gain: 0.12 },
  blast: { low: 40, secs: 1.4, gain: 0.95 },
  hammer: { freq: 420, gain: 0.18 },
  // music (original procedural Web Audio music; optional local files in public/music/<state>.ogg|mp3)
  music: { volume: 0.35, sfx: 0.85, crossfadeSecs: 2.5, duckSecs: 2.2, duckTo: 0.25 },
};
