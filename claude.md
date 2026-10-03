# Dig to Hell

## PROJECT
Browser idle/clicker mining game for CrazyGames and Poki. Solo dev (Tejas) building with AI assistance. **Design authority: `Spec.md`** (read it fully before any feature work). This file is the concise engineering status: architecture, current milestone, history, known issues, roadmap.

## CONCEPT
Start with one person, one pickaxe and a tiny hole; grow into a huge mine, a surface recycling complex, truck logistics and ever-larger construction projects — while digging toward strange deep-earth discoveries. Four fantasies: **DEPTH, INDUSTRY, CONSTRUCTION, DISCOVERY** (Spec §2).

## CURRENT GOAL (V2)
**Prove the first 5 minutes of DIG → RECYCLE → BUILD → SELL → EXPAND** with living workers, rest, site navigation, scalable characters, visible machinery and construction progression (Spec §18). *(Superseded goal: "build the 0–300 m slice ending at the Red Door". The Red Door is now a future depth milestone, roadmap V2-6.)*

## CORE LOOP
**DIG → RUBBLE → CART → RECYCLING YARD → BLOCKS → TRUCK → CONSTRUCTION SITE → STAGES → SELL PROPERTY → CASH → UPGRADE → DIG DEEPER** (Spec §3).
- Mining creates matter, industry transforms it, construction creates value.
- Cash comes ONLY from construction (stage milestone payments + property sale) and the one-time tutorial contractor seed (plus his no-soft-lock safety net). Never from digging, cart arrival, processing or truck departure.

## DESIGN RULES (non-negotiable)
- Prefer what the player can SEE happen over numbers; physical transformations over upgrade rows; decisions over passive income; bigger mines/machines over more tiny workers. Show the world transformed.
- Physical economy: material visibly travels pile → cart → hopper → auger → press → stack → truck → construction stack → building. Loads carry `{qty, val, mix}`; colours follow source geology.
- Every important upgrade visibly changes the world (Spec §7.4). Major transformations get cards; minor efficiency gets compact rows.
- Attention (Spec §5, `siteAttention()` only): RED `!` = an active problem reducing operation now (track overloaded, yard storage full); YELLOW `!` = opportunity/new content (site unlocked until visited, yard buildable, property ready); NOTHING for affordable upgrades or routine. Red hides yellows.
- Show the player there is more: all site tabs visible from the start (locked = dimmed + lock, tap = note + camera peek), inactive sites drawn as foreshadowing; unlocks are announced events.
- People route (left wall stairs/rest) and material route (right wall rail/cart) never overlap.
- Characters share one normalized rig; the player is ~1.1× a worker with only a contact shadow.
- Never let the player wait > ~45 s with nothing happening early; report dead zones honestly.
- **World first:** never make the UI explain what the world can show first. Growth creates physical bottlenecks the world shows (creaks, dust, slow carts) before the UI confirms them; the fix physically transforms the world (Spec §7.8–7.9).
- Every click must feel like impact. Interruptions (future) never punish failure. Cosmetic-only monetization later.

## TECH / ARCHITECTURE
- TypeScript + Vite, Canvas 2D world, DOM UI (panel, nav bar, settings, intro text). No React. All tuning in `src/config.ts`.
- Audio: synthesized SFX (Web Audio) + `music.ts` MusicManager (procedural original music per site; optional local asset slots `public/music/<state>.(ogg|mp3)`); volumes + mute persisted in `dth_settings`.
- Save: localStorage `digtohell_v5` every 5 s + unload/pagehide; versioned migration (v4/v3/v2 → v5); old key deleted only after the new save is written. Accordion state `dth_acc`.
- Modules (src/):
  - `config` tuning · `economy` pure formulas · `state` save schema/migration · `util` · `layout` work-floor positions relative to the centred shaft
  - `toast` notices that drop from a site tab (unlocks, locked-site notes, construction events)
  - `track` Track Strength purchase + reinforcement job · `trackfx` track strain feedback + first-overload story
  - `sim` strikes, finds, offline · `workers` crew behaviour: strikes, fatigue, rest paths, idles, arrival, `initSim`/`applyWorksite` · `miner` player strike scheduling · `cart` cart state machine · `surface` contractor, processing, truck route · `construction` projects/stages/sale · `expansion` Work Chamber blast sequence · `digface` chunk damage (width per worksite tier) · `geo` geology sampler + painter
  - `rig` CharacterRig (all people) · `characters` excavator + lamp beams · `render` mine (face, chamber, rest area, crew, cart, rails, HUD) · `yard` recycling yard + truck · `site` construction site + buildings + build-event FX · `landscape` sky/day-night · `draw` shared helpers · `fx` particles/popups/impulse · `juice` sim events → FX/audio · `audio` SFX + buses · `music` MusicManager + settings
  - `view` canvas, site camera (tweens, zoom/pan), geometry, `surfaceLayout()` · `nav` site bar + attention badges · `intro` introduction steps + overlay text + follow hints · `panel` contextual per-site panels · `main` wiring + loop only
- Dev-only hooks (`import.meta.env.DEV`): `window.__dig` (state incl. camera/workers, save, go(site), setSpeed(k) time-scale, tireAll, forceYard, setPhase, setCritChance, cartDepth…) and a debug panel (+$1,000, +50 rubble, +60 blocks on site). Stripped from production builds.
- Testing: puppeteer-core + system Chrome scripts in the session scratchpad (full-loop bot `v2flow.mjs <speed> <secs> <tag>`, targeted `v2target.mjs`, `v2perf.mjs`), headless pacing/conservation via `npx tsx` importing src modules. Seed localStorage from a same-origin non-game URL (e.g. `/src/style.css`) — reloading the game page saves on unload and overwrites injected saves.

## CURRENT ECONOMY (economy rebuild — details Spec §3.1, code map AGENT_CONTEXT.md)
- **Opening:** the contractor buys a 20-unit sample at market price (~$3/unit × block value) and pays a labelled CONTRACT ADVANCE up to the Recycling Yard's **$250**.
- **Block value travels with the material:** `V(d) = 1 + d/120` per unit dug (×3.5 at 300 m); the press stamps Block Quality (+8%/level, max 10, $400 ×1.8) onto blocks as they are made (never retroactive).
- **Construction pays for what it is built from:** stage = base × 50% × (stage blocks / project blocks) × that stage's avg block value; sale = base × the house's avg block value. Cabin base $1,200 (150 blocks), Two-Story $3,500 (460). Repeats of the Two-Story sell −10% each (floor 60%, temporary).
- **Construction Crew** ($400 ×1.7, 10 levels): +1 builder (1.25 blocks/s each; base 2 = 2.5/s), visible on site; truck runs +50%/level. Revealed when ≥ 120 blocks wait on the plot during a stage (yellow BUILD `!`).
- **Extraction:** Pickaxe → Iron $60 (×1.25 yield) → Heavy $450 @25 m (×1.6) → Jackhammer $2,500 @75 m (3 × 1.2 power, ×2). Digger $120 ×1.22 (1.2 power/s). Work Chamber $900. Excavator $4,000: a whole chunk every 1.6 s × 20 rubble (~750/min at any depth) — one formula (`crewBreaksPerSec`) for strikes, the panel and offline.
- **Transport:** cart 50 base; Cart Capacity $120 ×1.55, Cart Speed $90 ×1.55, Loading $50 ×1.5. Track Strength $250 / $1,200 / $5,000 (safe 70/140/260/450); overloaded trips −30%.
- **Yard:** processing 1.5/s base (+35%/level, $100 ×1.55); Raw Storage 120 (+50%/level, $150 ×1.6).
- Cash still comes only from the contractor opening and construction.

## BUILD ORDER
1. TS/Vite port — DONE · 2. Dig feel — DONE · 2.5. Click-loop polish — DONE
3A/3B. Rubble economy + physical cart — DONE · 3C. Surface economy + extraction ladder — DONE (superseded model) · 3C.5. World identity + Recycling Yard — DONE
**V2-1. Macro loop + navigation + Construction V1 + scalable characters + rest + Work Chamber — BUILT, awaiting human playtest**
V2-2. Fossil Excavation · V2-3. Active mining events (Critical Vein, Cave-In, Side Cave) · V2-4. Industrial progression (drill rig, Industrial Chamber, logistics) · V2-5. More construction projects + automation · V2-6. Deep mystery / Red Door · later: museum, second mine, prestige, leaderboards, SDK.
*(Superseded order: 3D navigation/unlimited depth, 4 animated finds, 5 upgrade arrivals, 6 interruptions, 8 Red Door. Navigation is now V2-1; unlimited depth + history browsing fold into later milestones.)*

## STATUS LOG
- Step 1 port `e4d758d` · Step 2 dig feel `fc51a70` · Step 2.5 polish `72800ed` · design update `6ea5c2b` · 3A+3B `b4a2c08` · 3C `ce168ca` · 3C.5 `4bfadeb` (hash commits `3c30846`, `1278c76`, `3cf1c7a`, `81d4023`) · reset confirm `2011020`
- V2 design consolidation `719166f`
- V2-1 implementation: `97fd236` · ladder/car visual fix `dcaab27` · truck redesign `1836a66`/`750afcb` · Track Strength + overload storyline `5c9d1c5` · retention + auto-construction `86a9dca` · toast/swipe fix `4136d95` · economy rebuild `943d59e`

### History in brief (details in git history and older Spec revisions)
- Steps 1–2.5: TS/Vite port; destructible dig face (per-material stages, cracks, crits with hit-stop/star/ring); impact hierarchy; synthesized SFX; face reads as one mass of earth; popup hierarchy.
- 3A/3B: digging produces rubble (no cash); one permanent cart with a pure state machine `BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN`; material conserved through every reload; travel time linear in depth.
- 3C: tool ladder (Pickaxe → Iron → Heavy → Jackhammer burst) and Digger hiring with rope-drop arrival; seller model (superseded).
- 3C.5: Recycling Yard (hopper → crusher → auger → press → blocks), trucks (golden-angle colours), material composition `mix`, deterministic painted geology (5 m cached segments), new characters + helmet lamps + depth darkness, IK excavator, per-level rail visuals, painted landscape with day/night, accordion panel, save v4. Perf regression under heavy CPU throttle noted.

## KNOWN ISSUES (after V2-1 + economy rebuild)
- Economy rebuild is a first pass: verified by typecheck/build, material conservation and save migration; one 15-min active-player sim; NOT yet tuned against the automation/infrastructure/idle player sims or a human playtest. Excavator ($4,000) was never bought by a cheapest-first bot in 15 min; 300 m is still reached by ~11–12 min of active play.
- Construction workers hammer one fixed spot regardless of what is being built (queued visual fix: work zones, ladders/scaffold, hammer hits the structure).
- Transport is still the most common bottleneck and is not flagged when the cart simply can't keep up (only track overload is flagged).
- Track reinforcement has no workers walking over (the job is shown by the sweeping rebuild, hammering and dust). Wood's STRAINED band (53–70) is rarely seen because the base cart is 50 and the first upgrade jumps to 73.
- 0:45 → 1:22 of a fresh game: the first truck brings ~18 of the 30 Foundation blocks; ~35 s of digging with no new decision.
- First visible rest happens late (~4:00) because the platform needs ≥ 22 m and workers work 60–120 s first.
- Throttled-CPU hitch: painting a new geology segment costs ~30 ms (≈130 ms at 4× CPU throttle) once per 5 m of digging (pre-existing from 3C.5).
- Truck (redrawn `1836a66` as a heavy cab-forward flatbed, 4.5 worker heights, tandem rear axles): one red company truck, always facing the building: forward to BUILD, reverses back to the yard. While unloading at the plot it hides the block stack behind it for a few seconds.
- Two-Story Home repeats after its sale (no Project #3 yet, by scope). Build site ground beyond the painted geology is a blended flat fill.
- Music is procedural and verified only as running (state switching, crossfade, no errors) — not judged by ear. Same for SFX.
- Finds (coin, buried car) are placeholder banners; depth is capped at 300 m in code.
- Offline progression design is still interim (crew dig + chain runs; stages never auto-start).

## CURRENT IMPLEMENTATION TASK
**None — V2-1 is complete and waiting for Tejas's playtest.** Next milestone after approval: **V2-2 Fossil Excavation** (Spec §11.1). Do not start it until the playtest feedback is in.

## HOW TO WORK WITH TEJAS
- Be opinionated; say when an idea is weak. Be critical in reports — passing tests ≠ fun.
- Make focused changes, run the game, check for console errors, verify behaviour (automated browser checks + screenshots) before saying done.
- Report per milestone in the requested sections; record measured timings and dead zones honestly.
- Stop for human playtest at the end of each milestone; never roll into the next one automatically.
- Commit each milestone separately; record hashes here. Keep Spec.md and claude.md complete enough that a new agent can continue with no conversation history.

## REJECTED IDEAS (don't revisit)
GETAWAY.IO, Draw the Getaway, Ghost Heist, Railfront, GRIDFALL, Rust to Glory. For this game: cash from clicking, purchasable/stackable minecarts, 300 m as the end, the Scrap Stall seller, trucks paying cash on departure, a central spiral staircase, a universal upgrade panel, a giant player with a dark rim silhouette (see Spec §30).

## FUTURE / NOT NOW
See Spec §11–§12 and §23: fossils (next), events, industrial chamber + drill rig + tunnel borer, more construction projects + Foreman automation, rest upgrades (break room, canteen), worker elevator, animals (rabbit first), museum, second mine, Red Door, prestige, leaderboards, SDK.
