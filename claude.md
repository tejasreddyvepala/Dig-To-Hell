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
- Every click must feel like impact. Interruptions (future) never punish failure. Cosmetic-only monetization later.

## TECH / ARCHITECTURE
- TypeScript + Vite, Canvas 2D world, DOM UI (panel, nav bar, settings, intro text). No React. All tuning in `src/config.ts`.
- Audio: synthesized SFX (Web Audio) + `music.ts` MusicManager (procedural original music per site; optional local asset slots `public/music/<state>.(ogg|mp3)`); volumes + mute persisted in `dth_settings`.
- Save: localStorage `digtohell_v5` every 5 s + unload/pagehide; versioned migration (v4/v3/v2 → v5); old key deleted only after the new save is written. Accordion state `dth_acc`.
- Modules (src/):
  - `config` tuning · `economy` pure formulas · `state` save schema/migration · `util`
  - `sim` strikes, crew strikes, finds, offline · `cart` cart state machine · `surface` contractor, processing, truck route state machine · `construction` projects/stages/sale sim · `workers` crew presentation state: fatigue, rest routes, idles · `digface` chunk damage (dynamic width per worksite tier) · `geo` geology sampler + painter
  - `rig` normalized character renderer (CharacterRig) · `characters` machines (excavator) + lamps · `render` mine/world/rails/cart/HUD · `yard` recycling yard + truck · `site` construction site + buildings · `landscape` sky/day-night/scenery · `draw` shared helpers · `fx` particles/popups/impulse · `juice` sim events → FX/audio · `audio` SFX · `music` MusicManager
  - `view` canvas, camera (site framing, zoom/pan, transitions), geometry · `nav` site navigation bar + attention badges · `intro` first-time introduction state machine + text overlay · `panel` contextual per-site panels · `main` wiring + loop only
- Dev-only hooks (`import.meta.env.DEV`): `window.__dig` (state, save, setPhase, glide/site, setCritChance, cartDepth…) and a debug panel. Stripped from production builds.

## CURRENT ECONOMY (as built — see the V2-1 section for numbers)
- Extraction: chunk breaks add rubble × tool yield; crew strikes; Excavator bites whole chunks (needs Work Chamber).
- Transport: one permanent cart (capacity / speed / loading / rail quality).
- Yard: raw (Raw Storage cap) → processing → finished blocks; the delivery truck parks at the yard bay, loads blocks, drives to the construction site, unloads into the site stack, returns.
- Construction: the player starts each stage when enough blocks are on site; builders consume blocks; stage completion pays a milestone; the finished property is sold for the main payout; the plot clears and the next (bigger) project appears.

## BUILD ORDER
1. TS/Vite port — DONE · 2. Dig feel — DONE · 2.5. Click-loop polish — DONE
3A/3B. Rubble economy + physical cart — DONE · 3C. Surface economy + extraction ladder — DONE (superseded model) · 3C.5. World identity + Recycling Yard — DONE
**V2-1. Macro loop + navigation + Construction V1 + scalable characters + rest + Work Chamber — CURRENT**
V2-2. Fossil Excavation · V2-3. Active mining events (Critical Vein, Cave-In, Side Cave) · V2-4. Industrial progression (drill rig, Industrial Chamber, logistics) · V2-5. More construction projects + automation · V2-6. Deep mystery / Red Door · later: museum, second mine, prestige, leaderboards, SDK.
*(Superseded order: 3D navigation/unlimited depth, 4 animated finds, 5 upgrade arrivals, 6 interruptions, 8 Red Door. Navigation is now V2-1; unlimited depth + history browsing fold into later milestones.)*

## STATUS LOG
- Step 1 port `e4d758d` · Step 2 dig feel `fc51a70` · Step 2.5 polish `72800ed` · design update `6ea5c2b` · 3A+3B `b4a2c08` · 3C `ce168ca` · 3C.5 `4bfadeb` (hash commits `3c30846`, `1278c76`, `3cf1c7a`, `81d4023`) · reset confirm `2011020`
- V2 design consolidation (this Spec/claude rewrite): see git log "V2 design"
- V2-1 implementation: `V21_HASH`

### History in brief (details in git history and older Spec revisions)
- Steps 1–2.5: TS/Vite port; destructible dig face (per-material stages, cracks, crits with hit-stop/star/ring); impact hierarchy; synthesized SFX; face reads as one mass of earth; popup hierarchy.
- 3A/3B: digging produces rubble (no cash); one permanent cart with a pure state machine `BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN`; material conserved through every reload; travel time linear in depth.
- 3C: tool ladder (Pickaxe → Iron → Heavy → Jackhammer burst) and Digger hiring with rope-drop arrival; seller model (superseded).
- 3C.5: Recycling Yard (hopper → crusher → auger → press → blocks), trucks (golden-angle colours), material composition `mix`, deterministic painted geology (5 m cached segments), new characters + helmet lamps + depth darkness, IK excavator, per-level rail visuals, painted landscape with day/night, accordion panel, save v4. Perf regression under heavy CPU throttle noted.

## KNOWN ISSUES (carried into V2-1; update after implementation)
- Throttled-CPU performance regressed in 3C.5 (desktop fine).
- Transport dominated the 3C.5 economy (dig-site pile grew to hundreds by 3:00).
- Hits land ~72 ms after the click (windup + downswing) to keep animation and sim in sync.
- Finds still use the placeholder modal until discoveries are rebuilt; depth capped at 300 m in code.
- Sounds verified only as error-free, not by ear. Offline progression design unresolved.

## CURRENT IMPLEMENTATION TASK
**V2-1** (Spec §23): A navigation (MINE/YARD/BUILD + transitions) · B contextual panels · C first-time introduction · D Construction V1 (Cabin → sell → Two-Story Home playable) · E economy routing (truck → construction; cash from stages/sale) · F tool yield · G CharacterRig (player, miner, construction worker; player scale ~1.1×, no giant shadow; variation) · H idle personality (idle, wipe sweat, adjust helmet, drink, look around) · I worker rest V1 (fatigue, left-wall switchback stairs, rest platform) · J Worksite Expansion V1 (Narrow Shaft → Work Chamber with blast sequence) · K Excavator requires Work Chamber, rescaled, big output · L recycling visibility · M MusicManager + settings · N real attention triggers. **Do not implement fossils, events, Red Door, prestige, more projects, multiple lots/carts, elevators, Industrial Chamber.** Stop for human playtest after V2-1.

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
