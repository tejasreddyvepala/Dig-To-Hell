// All tuning numbers live here. Never scatter magic numbers elsewhere.

export type RGB = [number, number, number];

export interface Layer { name: string; from: number; col: RGB; ore: string; hard: number; val: number }
export interface Tool { name: string; ic: string; pow: number; cost: number }
export type CrewId = 'dig' | 'cart' | 'exc' | 'bore' | 'mole';
export interface Crew { id: CrewId; name: string; ic: string; ds: string; rate: number; cost: number }
export type FindKind = 'coin' | 'car' | 'cart' | 'cave' | 'skull' | 'train' | 'temple' | 'crystal' | 'magma' | 'door' | 'eye';
export interface Find { d: number; name: string; kind: FindKind; side: 1 | -1 }

export const LAYERS: Layer[] = [
  { name: 'Topsoil', from: 0, col: [122, 84, 52], ore: '#d9b26a', hard: 1, val: 1 },
  { name: 'Clay', from: 25, col: [168, 96, 62], ore: '#e8d6a0', hard: 1.5, val: 3 },
  { name: 'Stone', from: 80, col: [112, 112, 118], ore: '#c9d2dc', hard: 2.5, val: 8 },
  { name: 'Caves', from: 200, col: [72, 74, 92], ore: '#8fd0ff', hard: 4, val: 20 },
  { name: 'Fossil beds', from: 400, col: [150, 132, 96], ore: '#f3ead2', hard: 6, val: 50 },
  { name: 'Deep rock', from: 800, col: [70, 58, 70], ore: '#c58cff', hard: 10, val: 130 },
  { name: 'Ancient ruins', from: 1500, col: [96, 104, 80], ore: '#ffd76a', hard: 16, val: 350 },
  { name: 'Crystal caverns', from: 2800, col: [44, 60, 96], ore: '#7ff7ff', hard: 25, val: 900 },
  { name: 'Magma', from: 5000, col: [110, 36, 24], ore: '#ffb02e', hard: 40, val: 2500 },
  { name: "Hell's crust", from: 9000, col: [70, 12, 18], ore: '#ff4040', hard: 65, val: 7000 },
  { name: 'Below hell', from: 15000, col: [20, 10, 30], ore: '#ffffff', hard: 110, val: 20000 },
];

export const TOOLS: Tool[] = [
  { name: 'Bare hands', ic: '✋', pow: 0.5, cost: 0 },
  { name: 'Shovel', ic: '🥄', pow: 1.5, cost: 15 },
  { name: 'Pickaxe', ic: '⛏️', pow: 4, cost: 150 },
  { name: 'Jackhammer', ic: '🔨', pow: 12, cost: 1500 },
  { name: 'Drill rig', ic: '🛠️', pow: 40, cost: 16000 },
  { name: 'Plasma bore', ic: '⚡', pow: 140, cost: 180000 },
  { name: 'Antimatter drill', ic: '🌀', pow: 520, cost: 2.2e6 },
];

export const CREW: Crew[] = [
  { id: 'dig', name: 'Digger', ic: '👷', ds: 'Swings a pick all day', rate: 0.3, cost: 40 },
  { id: 'cart', name: 'Mine cart', ic: '🛒', ds: 'Hauls dirt so diggers go faster', rate: 1.6, cost: 500 },
  { id: 'exc', name: 'Excavator', ic: '🚜', ds: 'A bucket the size of a car', rate: 9, cost: 6000 },
  { id: 'bore', name: 'Tunnel borer', ic: '🔩', ds: 'Chews through rock nonstop', rate: 50, cost: 80000 },
  { id: 'mole', name: 'Mole robot', ic: '🤖', ds: 'Never sleeps, never stops', rate: 300, cost: 1.1e6 },
];

export const FINDS: Find[] = [
  { d: 12, name: 'A rusty coin', kind: 'coin', side: 1 },
  { d: 45, name: 'A buried car', kind: 'car', side: -1 },
  { d: 150, name: 'An old mine cart', kind: 'cart', side: 1 },
  { d: 260, name: 'An echoing cave', kind: 'cave', side: -1 },
  { d: 450, name: 'A T. rex skull', kind: 'skull', side: 1 },
  { d: 900, name: 'A buried train', kind: 'train', side: -1 },
  { d: 1600, name: 'A lost temple', kind: 'temple', side: 1 },
  { d: 3000, name: 'A giant crystal', kind: 'crystal', side: -1 },
  { d: 5500, name: 'A sea of magma', kind: 'magma', side: 1 },
  { d: 9500, name: 'A door that knocks back', kind: 'door', side: -1 },
  { d: 15000, name: 'Whatever is below hell', kind: 'eye', side: 1 },
];

export const CFG = {
  saveKey: 'digtohell_v1',
  saveIntervalMs: 5000,

  // economy
  hardnessDepthDiv: 20, // hardness = (1 + d/div)^exp
  hardnessExp: 2,
  valueDepthDiv: 1000, // value = hardness * (1 + d/div); also scales click and crew income
  crewCostGrowth: 1.15,
  findMultBonus: 0.1, // +10% digging per find
  findBonus: { min: 60, incomeSecs: 90, clicks: 40 }, // cash = max(min, income*secs, click*clicks)
  crewUnlockFrac: 0.5, // crew row appears once cash >= cost*frac (or previous tier owned)

  // offline
  offlineCapSecs: 8 * 3600,
  offlineMinSecs: 30,
  offlineStepSecs: 1,

  // clicking
  luckyChance: 0.04,
  luckyMult: 10,

  // gold nugget
  nugget: {
    firstDelay: 12,
    respawnMin: 14,
    respawnMax: 26,
    life: 4,
    minClicks: 5,
    hitRadius: 28,
    drawRadius: 12,
    offsetX: 80, // spawns at face ± offsetX
    offsetYMin: 10,
    offsetYMax: 40,
    bonus: { min: 25, incomeSecs: 20, clicks: 25 },
  },

  // view
  ppm: 12, // pixels per meter
  faceYFrac: 0.64, // dig face sits at this fraction of canvas height
  shaftMaxW: 320,
  shaftWFrac: 0.42,
  scrollSpeed: 0.6,
  scrollExtraM: 40,
  scrollIdleSecs: 3,
  findTeaseM: 40, // show next find silhouette within this many meters
  maxDt: 0.1,
  panelRefreshSecs: 0.12,

  // juice
  shake: { normal: 2.5, lucky: 6, decayPerSec: 25 },
  swingDecayPerSec: 7.2,
  gravity: 500,
  maxParticles: 500,
  particleLife: [0.4, 0.9] as const,
  particleSize: [2, 5] as const,
  burst: {
    dig: { n: 9, speed: 150 },
    lucky: { n: 22, speed: 240 },
    luckyOre: { n: 14, speed: 220 },
    nugget: { n: 24, speed: 260 },
    find: { n: 40, speed: 300 },
    tool: { n: 30, speed: 260 },
  },
  text: { life: 1.2, rise: 40 },
  bannerSecs: 3,
};
