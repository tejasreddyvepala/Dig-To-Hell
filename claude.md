# Dig to Hell

## PROJECT
Browser idle/clicker mining game for CrazyGames and Poki. Solo dev (Tejas) building with AI assistance. Design authority: `Spec.md` (read it before any feature work).

## CONCEPT
The player digs one continuous vertical shaft and builds an increasingly absurd industrial operation inside it: one miner → rubble cart → surface seller → crew → rails → machinery → processing → industrial mine → extreme depth → strange discoveries.

## CURRENT NORTH STAR
- Curiosity hook: "What's down there?" (discoveries, geology, mysteries).
- Mechanical hook: "Can I make this entire mine run better?" (a visible physical production chain with bottlenecks).
- The shaft is the player's machine: **bottom = extraction, shaft = transport + infrastructure + history, surface = storage + processing + selling + construction.**

## CORE LOOP
**DIG → MATERIAL → LOAD → TRANSPORT → UNLOAD → SELL → CASH → UPGRADE**
- Cash has a physical origin: it appears only when material is sold at the surface.
- Digging produces rubble (impact, cracks, debris, depth, material) — never cash.
- *(Superseded: CLICK → CASH → UPGRADE. Do not reintroduce cash from hits, breaks, crits, crew or finds.)*

## DESIGN RULES (non-negotiable)
- **Physical economy:** resources visibly move through the world. No numbers teleporting between counters.
- **Visible bottlenecks:** extraction (empty cart waiting), transport (rubble pile growing at the bottom), selling (surface stockpile growing). The player should see the bottleneck before reading it.
- **No invisible number-only upgrades when a physical change is reasonable.** Use visual tiers at meaningful thresholds (cart body, rails, seller, storage, tool).
- **Continuous vertical world:** surface → old shaft → discoveries/machines/geology → dig site, all scrollable. Previously visited depths remain recognizable.
- **Depth is unbounded.** 300 m is a milestone (The Red Door), not an ending and not MAX_DEPTH.
- **Discoveries provide curiosity,** not the primary economy. They surprise, may grant bonuses, stay visible in the shaft, and are never skipped silently (including offline).
- Every click must feel like impact: WHACK, CRACK, then material. Destructible face with per-material crack stages.
- Never let the player wait more than ~45 s with nothing new happening during onboarding.
- No random interruption within 20 s of a find or layer change. Interruptions never punish failure.
- Screen shake hierarchy: normal hit almost none, break small, crit a little more, upgrade medium, find cinematic.
- Cosmetic-only monetization later. No pay-to-win, no energy systems.

## WORLD STRUCTURE
- Surface (depth 0): sky, ground, shaft opening, headframe, rail end, unloading point, stockpile; seller and buildings come in Phase 3C.
- Shaft: rails along the wall, the cart in transit (position derived from its actual journey), depth markers, geology, finds, structures.
- Dig site: destructible face (8 logical chunks rendered as one mass), miners, rubble pile, loading point with the cart.
- **Persistent shaft history approach:** do not save transient detail (cracks, particles). Reconstruct deterministically from `worldSeed + segment index` (geology, wall features) plus saved milestone state (finds found, structures built, rail tier). This keeps saves tiny at any depth. (Deterministic geology lands in Phase 3D.)

## CURRENT TECH
- TypeScript + Vite, HTML5 Canvas 2D, no React for the game, minimal dependencies.
- All sound synthesized with Web Audio (Spec §15), created on first gesture, pitch-randomized impacts. No audio files, no music yet.
- Save to localStorage every 5 s and on unload/pagehide, try/catch, versioned schema with migration.
- All tuning numbers in `src/config.ts`. Never scatter magic numbers.
- 60 FPS on mid-range laptops; mobile (touch to dig, panel stacks below the canvas under 760 px).
- Modules: `config` (tuning), `economy` (pure formulas), `state` (save schema/load/save), `sim` (strikes, crew, finds, offline), `cart` (transport state machine, pure), `digface` (chunk damage state), `miner` (player swing scheduling), `juice` (sim results → FX + audio), `fx` (particles/popups/camera impulse), `audio`, `view` (canvas/camera/geometry), `render` (all drawing), `panel` (DOM upgrades), `main` (wiring + loop only).
- Dev-only hooks (`import.meta.env.DEV`): `window.__dig` for tests and a small debug panel (add cash/rubble, clear stock). Stripped from production builds.
- `dig-to-hell.html` is the original single-file prototype (reference only).

## CURRENT ECONOMY
- **Resource:** `rubble` (data-driven `RESOURCES` table). Quantities carry accumulated value `{qty, val}`; value per unit = `baseValue × valueAt(depth)`, `valueAt(d) = (1 + d/valueDiv)^valueExp`.
- **Extraction:** chunk breaks add `rubblePerBreak` to the dig-site pile (×2 on a crit break) and advance depth by the material's `metersPerBreak`. Chunk HP = `stages × hpPerStage` per material; pickaxe = 1 power ≈ one visible stage per hit. Excess damage carries into the fresh chunk.
- **Transport:** one permanent cart. `capacity`, `loadRate`, `cartSpeed`, `railMult` from upgrade levels; `travelTime(d) = baseTravel + d / (cartSpeed × railMult)`.
- **Surface:** unloaded rubble accumulates in `surfaceStock`. Selling (the only cash source) arrives in Phase 3C — until then no income exists except the dev-only debug button.
- **Upgrades** cost cash with geometric growth per level; groups EXTRACTION / TRANSPORT / SURFACE revealed progressively.
- *(Superseded: hardness `(1 + d/20)^2`, value per meter paid per click, Mine Cart as a repeatedly purchased crew unit, find cash bonuses.)*

## CURRENT BUILD ORDER
1. TS/Vite port — DONE
2. Dig feel / destructible face — DONE
2.5. Readability / core-loop polish — DONE
3A. Rubble economy — digging produces rubble, no cash from hits, visible bottom pile, save migration
3B. Physical cart loop — one permanent cart, loading, real travel through the shaft, unloading, return, transport upgrades
3C. Surface economy — surface scene, tutorial first-load buyer, seller, sell speed/value/storage, visible stock
3D. Navigation + world — Surface / Dig Site controls, smooth camera, manual scroll (wheel + touch), deterministic irregular geology, persistent rails/history rendering, unlimited depth
→ HUMAN PLAYTEST
4. Animated Finds
5. Upgrade arrival / evolution animations
6. Interruptions
7. More environment / layer polish
8. Red Door milestone
9. Extended progression / balance
10. Leaderboards / SDK / etc. (much later)

*(Superseded build order: 3 = finds, 4 = upgrade arrivals, 5 = interruptions, 6 = layer transitions + Red Door ending.)*

## STATUS LOG
- Step 1 (port to TS + Vite): `e4d758d`
- Step 2 (destructible face, juice, Web Audio, economy retune): `fc51a70`
- Step 2.5 (polish the click loop): `72800ed` (hash recorded in `3c30846`)
- Design update (physical economy, unbounded depth): see git log for "Design update" commit
- Phase 3A + 3B: see the Phase 3A/3B section below

### Step 2 — summary
Destructible face (8 chunks, per-material stages), miner swing scheduling with impact-frame resolution, crew strikes, impact hierarchy with crit hit-stop/star/ring, synthesized audio, economy retuned to ~12 m at 25 s / 45 m at 85 s (4 clicks/s), save v2.

### Step 2.5 — what changed
- Face reads as one mass of earth: no chunk outlines, a shared face-space gradient that fades into the surrounding ground, shared seam tops (continuous lit lip), dark inner earth revealed only by craters. Breaks leave a bowl-shaped crater + soft dark reveal that settles. Whole-chunk flash/flinch/squash removed (they exposed the tile grid) and replaced with a local impact pulse at the hit point.
- Popup hierarchy: hit = small/faint/short; break = one combined label; crit = large gold with pop. Max 6 popups on screen. *(Cash in these popups is superseded by Phase 3A.)*
- Crew: max 3 animated diggers (2 when an excavator is present); extras dig at full DPS and show as a helmet row "+N crew". Randomized phases/periods. Crew FX ~60% of player's, crew audio 0.2 volume.
- Player miner: 1.12× scale, brighter helmet, lamp beam, dark rim. Pick reach scales with size so the tip lands on the hit point on the impact frame.
- Camera: face at 71% of viewport, shaft wider (max 400 px), shaft darkens upward, warm work light on the face.
- Audio: heavier 55 Hz thump on breaks, extra hard transient on crits.
- Tuning changes: faceYFrac 0.62→0.71, shaftMaxW 320→400, shaftWFrac 0.42→0.46, crewVisibleMax 5→3, crewScale 0.88→0.85, playerScale 1.12, crewFxScale 0.6, AUDIO.crewVolume 0.28→0.2, impulse.hit 0.6→0.3, impulse.crit 2.2→2.1, critFx.starSecs 0.16→0.1, dentPx 3.2→4.5.
- Measurements: 12 m 27.5 s, 20 m 46.4 s, 45 m 86.4 s at 4 clicks/s; frame work p99 2.6 ms desktop / 8.6 ms at 4× CPU throttle at the 700-particle cap.

## KNOWN ISSUES
- Hits land ~72 ms after the click (windup + downswing) to keep animation and sim in sync.
- Mobile: figures and face are small (stage is only 56% of the screen height); the find tease can be off-screen on narrow widths; no touch scrolling yet (3D).
- Excavator can overlap the player miner when the player digs on the right side.
- Cracks are clipped per chunk, so a crack can stop at an invisible chunk boundary.
- Finds still use the placeholder modal (pauses digging) until Phase 4.
- Depth is still capped at 300 m in code until Phase 3D.
- Geology is still a clean layer cake until Phase 3D.
- Sounds verified only as error-free, not by ear.
- Offline progression design is unresolved (interim: conservative chain simulation, stops before the next find).

## CURRENT IMPLEMENTATION TASK
Phase 3A + 3B (see build order). Out of scope: seller, tutorial buyer, surface buildings, find cinematics, interruptions, Red Door, multiple carts, elevators, leaderboards, prestige, new resources, music, nav buttons, procedural geology. `surfaceStock` simply accumulates; no money is generated from it yet (intentional).

## HOW TO WORK WITH TEJAS
- Be opinionated. Say when an idea is weak.
- Make focused changes, run the game, check for console errors, verify behavior (automated browser checks + screenshots) before saying done.
- After each milestone report: DONE (what works), ISSUES (what's imperfect), NEXT (highest-value next change). Keep explanations short.
- Stop for human playtest at the end of each phase; never roll into the next phase automatically.
- Commit each phase separately; record hashes here.

## REJECTED IDEAS (don't revisit)
GETAWAY.IO, Draw the Getaway, Ghost Heist, Railfront, GRIDFALL (prototyped, wasn't fun), Rust to Glory. Also rejected for this game: cash from clicking, purchasable/stackable minecarts, 300 m as the end of the game.

## FUTURE / NOT NOW
- Surface systems: sorting table, crusher, weigh station, warehouse, market stall, processing plant, specialty buyers, rare-material processing.
- Transport tech: second cart, elevator/hoist, conveyors, express rail.
- Additional resources/ores with rarity and processing.
- Red Door interactions; prestige (possibly "Expeditions" with Relics) — design TBD.
- Leaderboards (deepest depth first), CrazyGames/Poki SDK (check current official docs when we get there).
- A museum/collection of finds and mysteries.
