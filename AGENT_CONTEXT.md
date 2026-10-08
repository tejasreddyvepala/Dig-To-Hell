# AGENT_CONTEXT — how the economy works in code

Technical companion to `Spec.md` (what the game should do) and `claude.md` (status). Keep this in sync with the code.

## Where balance lives
- **Numbers:** `src/config.ts` only — `UPGRADES` (baseCost, growth, maxLevel), `TOOLS`, `CREW`, `WORKSITES`, `PROJECTS` (base value, stage blocks), `TRACK_TIERS`, and `CFG` (`valueDiv/valueExp`, `crewCostGrowth`, `yard.*`, `build.*`, `intro.*`, `track.*`, `rest.*`).
- **Formulas:** `src/economy.ts` is the single source of production rates and payouts. UI (`panel.ts`), the live sim (`sim.ts`, `workers.ts`, `cart.ts`, `surface.ts`, `construction.ts`) and offline progress (`sim.ts offlineAdvance`) all call it. Do not re-derive a rate anywhere else.

## Price formulas
- Level upgrades: `upgCost = ceil(baseCost × growth^level)`; Track Strength: `TRACK_TIERS[tier+1].cost`.
- Digger: `ceil(cost × crewCostGrowth^owned)`; Excavator fixed (max 1, needs `worksite ≥ 1`); Work Chamber `WORKSITES[1].cost`; Yard `CFG.yard.cost`.

## Material value flow
- `Load = {qty, val, mix}`. `moveLoad` moves qty and a proportional share of val and mix (conserves both).
- Dig: `addTo(S.rubble, rubble, unitValue(depth))` with `unitValue = valueAt(d) = (1 + d/valueDiv)^valueExp`.
- Press (`surface.ts`): raw → temp load → `val *= blockQualityMult(S)` → goods. Block Quality applies only to blocks pressed after purchase.
- Truck and plot carry val unchanged. Construction (`construction.ts`) consumes blocks into a sink and accumulates `build.stageVal`, `build.projVal`, `build.projQty`.

## Payouts
- `stagePaymentFor(s, i, factor) = round(value × milestoneShare × stage.blocks / projectBlocks × factor × repeatFactor)` with `factor = stageVal / blocks used`.
- `projectValue(s) = round(value × projectValueFactor(s) × repeatFactor(s))`, `projectValueFactor = projVal / projQty` (falls back to plot material, then fresh rock, for estimates).
- `repeatFactor`: last project only, `max(repeatFloor, 1 − repeatDecay × repeats)` (temporary).
- Contractor (`surface.ts`): sample of `intro.sampleQty` at `yard.marketPrice × unit value`, then `advance = yard.cost − cash`.

## Construction capacity
- `builders(s) = build.baseBuilders + upg.crew`, `constructionRate = perBuilder × builders`.
- Truck: `truckCapacity / truckLoadRate / truckUnloadRate = base × (1 + truck.perCrew × upg.crew)`.
- Reveal: `construction.ts` sets `flags.crewSeen` when the plot holds ≥ `build.revealBacklog` during a stage; `panel.ts` sets `flags.crewAck` when the player is at BUILD; `nav.ts siteAttention` shows a yellow BUILD `!` in between. Builders drawn: `site.ts drawBuilders` (one per builder, up to 8).

## Crew production
- `crewBreaksPerSec(s, id, d)`: Diggers `dps × uptime / chunkHp(d)`; the Excavator `crew / swingSecs` (whole-chunk bites). `crewRubbleRate` / `crewMps` derive from it and are used by the panel and offline. Online, `workers.ts updateCrew` produces the same rates (shared power for diggers; whole-chunk bite for the machine).

## Save
- Key `digtohell_v6`, `saveVersion 6`, migrates from v5/v4/v3/v2 (`state.ts sanitize`). New in v6: `build.stageVal/projVal/projQty`, `upg.crew`, `flags.crewSeen/crewAck`.
- `revalue()` (pre-v6 saves): recompute every load's val from its material mix at representative depths (`REF_DEPTH`) with the v6 curve; give a house in progress `projQty` = blocks already built and `projVal` at the plot's average value. Quantities and cash are never changed. Old Block Quality levels clamp to the new max (10).

## Bottleneck signals
- Transport: dig-site pile grows (`S.rubble`). Track overload: `cart.ts trackOverloaded` (red MINE `!`). Processing: hopper fills, `cartBlocked` when full (red YARD `!`). Construction: plot backlog → Construction Crew reveal. Throughput helpers: `cartCapacity`, `cartSpeed`, `travelTime`, `processRate`, `rawCap`, `constructionRate`, `truckCapacity`.

## Testing
- Headless sims import the real modules with `npx tsx` (scratchpad `audit2.mts <policy> <secs> [idleAfter] [quiet]`; policies active/auto/infra). Material conservation check: compare dug vs held + contractor + built.

## Construction crew presentation (no economy effect)
- `src/sitecrew.ts`: `workTargets()` returns targets on the current stage's advancing edge (building space in worker units; mirrors `cabin()/home()` geometry in `site.ts` — update both together). `standFor()` picks ground vs plank height (`REACH_H`, `PLANK_STEP`) and a spot 0.42 u from the target. `updateSiteCrew(dt)` moves agents (walk on a level, climb only at `LADDER_X`), assigns/spreads targets, and fires hammer impacts (dust + sound) at `HAMMER_IMPACT`. `drawScaffold()` draws planks for levels in use + the ladder; `drawSiteCrew()` draws each agent (ladder pose via `ladder.ts`, targeted `hammer` pose via `rig.ts` `Pose.aim`).
- `src/ladder.ts`: rung-locked climbing shared with the Mine (`ladderFrame(h, top, look, s, rigScale)`).
- Number of agents = `builders(S)` (capped at 8 drawn).
