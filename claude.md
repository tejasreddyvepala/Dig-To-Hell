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
- Red `!` only for meaningful attention; yellow dot for optional affordable upgrades; nothing for routine (Spec §5).
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
  - `track` Track Strength purchase + reinforcement job · `trackfx` track strain feedback + first-overload story
  - `sim` strikes, finds, offline · `workers` crew behaviour: strikes, fatigue, rest paths, idles, arrival, `initSim`/`applyWorksite` · `miner` player strike scheduling · `cart` cart state machine · `surface` contractor, processing, truck route · `construction` projects/stages/sale · `expansion` Work Chamber blast sequence · `digface` chunk damage (width per worksite tier) · `geo` geology sampler + painter
  - `rig` CharacterRig (all people) · `characters` excavator + lamp beams · `render` mine (face, chamber, rest area, crew, cart, rails, HUD) · `yard` recycling yard + truck · `site` construction site + buildings + build-event FX · `landscape` sky/day-night · `draw` shared helpers · `fx` particles/popups/impulse · `juice` sim events → FX/audio · `audio` SFX + buses · `music` MusicManager + settings
  - `view` canvas, site camera (tweens, zoom/pan), geometry, `surfaceLayout()` · `nav` site bar + attention badges · `intro` introduction steps + overlay text + follow hints · `panel` contextual per-site panels · `main` wiring + loop only
- Dev-only hooks (`import.meta.env.DEV`): `window.__dig` (state incl. camera/workers, save, go(site), setSpeed(k) time-scale, tireAll, forceYard, setPhase, setCritChance, cartDepth…) and a debug panel (+$1,000, +50 rubble, +60 blocks on site). Stripped from production builds.
- Testing: puppeteer-core + system Chrome scripts in the session scratchpad (full-loop bot `v2flow.mjs <speed> <secs> <tag>`, targeted `v2target.mjs`, `v2perf.mjs`), headless pacing/conservation via `npx tsx` importing src modules. Seed localStorage from a same-origin non-game URL (e.g. `/src/style.css`) — reloading the game page saves on unload and overwrites injected saves.

## CURRENT ECONOMY (as built in V2-1)
- Extraction: a break gives 2 rubble × tool yield (Pickaxe ×1 · Iron ×1.5 · Heavy ×2.5 · Jackhammer ×3.5), ×2 on crit; diggers 0.6 dps each ($80, ×1.28 per hire); Excavator ($900, needs the Work Chamber, one) bites a whole chunk for ×6 rubble.
- Transport: one cart, 50 capacity base; travel = 2.5 s + (depth + 7 m) / speed. Track Strength tiers (safe load / speed / cost): Wood 70 ×1.0 · Reinforced Wood 140 ×1.15 $150 · Iron 260 ×1.3 $700 · Steel 450 ×1.5 $2,500; an overloaded trip up (cart load > safe load) is −30% speed. First overload = Cart Capacity Lv 1 (73) on Wood.
- Yard ($80): raw 120 cap → 2/s processing → blocks; truck (60 per trip, leaves at ≥ 15) drives to the plot in 4 s.
- Construction: Tiny Cabin $900 (30/30/40/30/20 blocks), Two-Story Home $4,200 (60/70/80/80/70/60/40); builders use 3 blocks/s; each stage pays 8% of the value; the sale pays the value (× Block Quality bonus +25%/level). The tutorial contractor pays ≈$95 seed money once.
- Work Chamber $450 (needs 2 diggers).

## BUILD ORDER
1. TS/Vite port — DONE · 2. Dig feel — DONE · 2.5. Click-loop polish — DONE
3A/3B. Rubble economy + physical cart — DONE · 3C. Surface economy + extraction ladder — DONE (superseded model) · 3C.5. World identity + Recycling Yard — DONE
**V2-1. Macro loop + navigation + Construction V1 + scalable characters + rest + Work Chamber — BUILT, awaiting human playtest**
V2-2. Fossil Excavation · V2-3. Active mining events (Critical Vein, Cave-In, Side Cave) · V2-4. Industrial progression (drill rig, Industrial Chamber, logistics) · V2-5. More construction projects + automation · V2-6. Deep mystery / Red Door · later: museum, second mine, prestige, leaderboards, SDK.
*(Superseded order: 3D navigation/unlimited depth, 4 animated finds, 5 upgrade arrivals, 6 interruptions, 8 Red Door. Navigation is now V2-1; unlimited depth + history browsing fold into later milestones.)*

## STATUS LOG
- Step 1 port `e4d758d` · Step 2 dig feel `fc51a70` · Step 2.5 polish `72800ed` · design update `6ea5c2b` · 3A+3B `b4a2c08` · 3C `ce168ca` · 3C.5 `4bfadeb` (hash commits `3c30846`, `1278c76`, `3cf1c7a`, `81d4023`) · reset confirm `2011020`
- V2 design consolidation `719166f`
- V2-1 implementation: `97fd236` · ladder/car visual fix `dcaab27` · truck redesign `1836a66`/`750afcb` · Track Strength + overload storyline `TRACK_HASH`

### History in brief (details in git history and older Spec revisions)
- Steps 1–2.5: TS/Vite port; destructible dig face (per-material stages, cracks, crits with hit-stop/star/ring); impact hierarchy; synthesized SFX; face reads as one mass of earth; popup hierarchy.
- 3A/3B: digging produces rubble (no cash); one permanent cart with a pure state machine `BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN`; material conserved through every reload; travel time linear in depth.
- 3C: tool ladder (Pickaxe → Iron → Heavy → Jackhammer burst) and Digger hiring with rope-drop arrival; seller model (superseded).
- 3C.5: Recycling Yard (hopper → crusher → auger → press → blocks), trucks (golden-angle colours), material composition `mix`, deterministic painted geology (5 m cached segments), new characters + helmet lamps + depth darkness, IK excavator, per-level rail visuals, painted landscape with day/night, accordion panel, save v4. Perf regression under heavy CPU throttle noted.

## KNOWN ISSUES (after V2-1)
- Transport is the silent bottleneck from ~3:00: with 4–6 diggers the dig-site pile reaches 300–550 by 5:00 unless the player buys cart upgrades. The cart-can't-keep-up pressure is still unflagged (track overload now is flagged, Spec §7.8).
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
