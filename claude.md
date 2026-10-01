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
- Surface (depth 0): painted landscape with day/night, headframe, and the Recycling Yard (hopper, crusher, auger, press, block stack, road + loading bay, delivery trucks).
- Shaft: rails along the wall, the cart in transit (position derived from its actual journey), depth markers, geology, finds, structures.
- Dig site: destructible face (8 logical chunks rendered as one mass), miners, rubble pile, loading point with the cart.
- **Persistent shaft history approach:** do not save transient detail (cracks, particles). Reconstruct deterministically from `worldSeed + segment index` (geology, wall features) plus saved milestone state (finds found, structures built, rail tier). This keeps saves tiny at any depth. (Deterministic geology lands in Phase 3D.)

## CURRENT TECH
- TypeScript + Vite, HTML5 Canvas 2D, no React for the game, minimal dependencies.
- All sound synthesized with Web Audio (Spec §15), created on first gesture, pitch-randomized impacts. No audio files, no music yet.
- Save to localStorage every 5 s and on unload/pagehide, try/catch, versioned schema with migration.
- All tuning numbers in `src/config.ts`. Never scatter magic numbers.
- 60 FPS on mid-range laptops; mobile (touch to dig, panel stacks below the canvas under 760 px).
- Modules: `config` (tuning), `economy` (pure formulas), `state` (save schema/load/save/migration), `sim` (strikes, crew, finds, offline), `cart` (transport state machine), `surface` (contractor, processing, truck state machine — the only cash source), `digface` (chunk damage state), `geo` (geology sampler + painter), `miner` (player swing scheduling), `juice` (sim results → FX + audio), `fx` (particles/popups/camera impulse), `audio`, `view` (canvas, camera zoom/pan, geometry, yard layout), `render` (world/dig site/cart/rails/HUD), `characters` (people, lamps, excavator), `yard` (surface plant + trucks), `landscape` (sky/day-night/scenery), `draw` (shared helpers), `panel` (DOM accordion), `main` (wiring + loop only).
- Dev-only hooks (`import.meta.env.DEV`): `window.__dig` for tests and a small debug panel (add cash/rubble, clear stock). Stripped from production builds.
- `dig-to-hell.html` is the original single-file prototype (reference only).

## CURRENT ECONOMY
- **Resource:** `rubble` (data-driven `RESOURCES` table). Every quantity is a Load `{qty, val, mix}` — units, accumulated value, and material composition (units per source material). Value per unit = `baseValue × valueAt(depth)`, `valueAt(d) = (1 + d/valueDiv)^valueExp`. Composition travels pile → cart → hopper → blocks and drives every rubble/block colour.
- **Extraction:** chunk breaks add `rubblePerBreak` to the dig-site pile (×2 on a crit break) and advance depth by the material's `metersPerBreak`. Chunk HP = `stages × hpPerStage` per material; pickaxe = 1 power ≈ one visible stage per hit. Excess damage carries into the fresh chunk.
- **Transport:** one permanent cart. `capacity`, `loadRate`, `cartSpeed`, `railMult` from upgrade levels; `travelTime(d) = baseTravel + d / (cartSpeed × railMult)`.
- **Surface (Recycling Yard, Phase 3C.5):** the cart unloads into RAW (capped by Raw Storage; when full the cart waits holding its load). The yard's crusher + auger + press turn raw into FINISHED BLOCKS at `processRate`. A delivery truck arrives when ≥ 15 blocks are stacked, loads up to 60, and **pays `load value × contractPrice` when it departs** — the only normal cash source (`surface.ts`). Before the yard exists, a contractor buys raw loads (first-load tutorial + no-soft-lock safety net).
- *(Superseded Phase 3C model: Scrap Buyer + Scrap Stall seller converting surface stock straight into a cash drip.)*
- **Extraction purchases:** tool ladder (Pickaxe → Iron → Heavy → Jackhammer) and Digger hiring.
- **Upgrades** cost cash with geometric growth per level; accordion groups EXTRACTION / TRANSPORT / PROCESSING / FINDS revealed progressively.
- *(Superseded: hardness `(1 + d/20)^2`, value per meter paid per click, Mine Cart as a repeatedly purchased crew unit, find cash bonuses.)*

## CURRENT BUILD ORDER
1. TS/Vite port — DONE
2. Dig feel / destructible face — DONE
2.5. Readability / core-loop polish — DONE
3A. Rubble economy — digging produces rubble, no cash from hits, visible bottom pile, save migration
3B. Physical cart loop — one permanent cart, loading, real travel through the shaft, unloading, return, transport upgrades
3C. Surface economy + restored extraction ladder — DONE (seller model later superseded by 3C.5)
3C.5. World identity + surface factory — DONE (Recycling Yard, trucks, material composition, painted geology, characters/excavator/lamps, landscape + day/night, accordion UI, per-level rails)
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
- Design update (physical economy, unbounded depth): `6ea5c2b`
- Phase 3A + 3B (rubble economy + physical cart loop): `b4a2c08`
- Phase 3C (surface economy + restored extraction ladder): `ce168ca`
- Phase 3C.5 (world identity + surface factory): `4bfadeb`

### Phase 3A + 3B — rubble economy + physical cart loop
- **Files:** new `src/cart.ts`; changed `config.ts`, `state.ts`, `economy.ts`, `sim.ts`, `juice.ts`, `audio.ts`, `render.ts`, `view.ts`, `panel.ts`, `main.ts`, `miner.ts`, `index.html`, `style.css`.
- **Cash removed from digging:** hits, breaks, crits, crew strikes and finds generate no cash. Breaks add `rubble.perBreak` (2) units to the dig-site pile (×2 on a crit break). Popups show `+N rubble / ▼ m` on player breaks only; crew show no text. Pieces arc from the break into the pile.
- **Rubble pile:** procedural mound + deterministic rocks sized by `rubble.qty / pileVisualMax (80)`, overflowing spill above 100%. Not hard-capped (no material is ever destroyed).
- **Cart:** one permanent cart (the old purchasable "Mine cart" crew unit is removed). Rides vertical rails on the left shaft wall on a cable from a surface headframe. Body visual tiers at Cart Capacity levels 0/2/5/9 (rusty → reinforced → metal → industrial); rail tiers at Rail Quality 0/2/4/7 (rough wood → reinforced → metal → heavy industrial). Fill shown as a rock heap rising over the rim; `n/cap` label while loading; tap/click the cart to send it early.
- **Cart state machine** (`cart.ts`, pure, leftover-time stepping so large offline steps stay exact):
  `BOTTOM_EMPTY → LOADING → READY (0.6 s) → TRAVELLING_UP → SURFACE_ARRIVAL (0.5 s, brake/bump) → UNLOADING (1.6 s, tips and dumps) → TRAVELLING_DOWN → LOADING | BOTTOM_EMPTY`.
  Position: up = `from + (−lift − from)·smoothstep(t/dur)`; down aims at the live face. Material moves only via `moveLoad` (qty + value), so it can never duplicate or vanish.
- **Formulas (config.cart):** capacity = `40·(1 + 0.4·L)`; loadRate = `2·(1 + 0.35·L)` units/s; speed = `6·(1 + 0.2·L)·railMult` m/s; railMult = `1 + 0.15·L`; `travelTime(d) = 2.5 + (d + 2.4)/speed`. Upgrade cost = `base·growth^L` (cap 60×1.55, speed 80×1.6, load 50×1.5, rail 150×1.75).
- **Surface:** headframe + pulley over the shaft opening; unloaded rubble accumulates in `surfaceStock`, shown as a stockpile beside the opening. No buyer yet — no income (intentional until 3C).
- **Panel:** EXTRACTION always; TRANSPORT revealed after the first dispatch (with live cart status); SURFACE revealed after the first arrival. Dev-only debug buttons (+$1,000, +50 rubble, clear stock) are the only way to test upgrades until 3C.
- **Save v3 schema:** `{version:3, cash, depth, tool, crew{dig,exc}, found, last, clicks, rubble{qty,val}, cart{state,t,dur,from,load{qty,val}}, surface{qty,val}, upg{cartCap,cartSpeed,loadSpeed,rail}, flags{dispatched,arrived}}`. v2 saves migrate (progress kept, old cart-crew dropped, cart starts empty at the bottom); the v2 key is deleted only after a v3 save is written. v1 still discarded.
- **Offline (interim):** elapsed time (capped 8 h) runs the real chain in 1 s steps — analytic crew digging feeds the pile, the actual cart state machine hauls it — and crew digging stops 1 cm short of the next find. Gaps ≤ 30 s just let the cart catch up.
- **Camera:** wheel scroll no longer snaps back automatically; clicking the canvas while scrolled returns to the dig site. Cart position also shown on the depth gauge (yellow square).
- **Tuning:** `pileVisualMax 80`, `minerStartX 140`, crew slots moved right (`dig [212, 182, 96]`) because the left of the face is now the loading area.

### Measurements (Phase 3A/3B, headless Chrome)
- First cycle at ~4 clicks/s (real browser): rubble visible at 1.7 s; cart 25% at 6 s; full/READY at 21 s; departs 21.9 s (depth 11.5 m, trip 4.8 s); arrives 26.6 s; back at the bottom 34 s; pile ≥ 60 units by 34 s (loading speed is the first visible bottleneck).
- One-way travel (no upgrades): 20 m 6.2 s, 50 m 11.2 s, 100 m 19.6 s, 200 m 36.2 s, 300 m 52.9 s. With Cart Speed 5 + Rail 4: 3.7 / 5.2 / 7.8 / 13.0 / 18.2 s.
- Depth pacing unchanged: 12 m ≈ 27 s, 20 m ≈ 43 s (4 clicks/s).
- Save/reload in every cart state (LOADING, READY, TRAVELLING_UP, SURFACE_ARRIVAL, UNLOADING, TRAVELLING_DOWN): material totals conserved exactly across three consecutive reloads.
- Frame work at the 700-particle cap (8 diggers, all crits, cart running): p99 2.7 ms desktop, 10.5 ms at 4× CPU throttle, 13.3 ms at 6×. Isolated spikes (up to ~150 ms at 6×) still unexplained (suspected GC).

### Phase 3C — surface economy + restored extraction progression: `ce168ca`
- **Why:** the 3A/3B playtest dead-ended (surface stock with no buyer), extraction progression was effectively absent (only "Pickaxe. Something heavier arrives deeper down."), and four transport cards dominated the panel. This pass adds the missing economy layer without undoing the physical economy.
- **Files:** new `src/surface.ts`; changed `config.ts`, `state.ts`, `economy.ts`, `cart.ts`, `sim.ts`, `miner.ts`, `juice.ts`, `audio.ts`, `render.ts`, `view.ts`, `panel.ts`, `main.ts`, `index.html`, `style.css`.
- **Bootstrap:** Scrap Buyer + truck waits at the surface; on the first delivery he buys the whole stockpile (30 units/s, visible drain, pieces hop to him, HUD cash counts up), big "+$X / SOLD N RUBBLE" popup + sting, then "I won't stay here all day. Build a stall." → Build Scrap Stall $80 (only purchase offered until built). Safety net: while there is no stall and cash < $80, the buyer keeps buying (no soft-lock).
- **Scrap Stall:** 1.6 s construction (posts, counter, roof, sign, hammer knocks), seller steps in, buyer drives off. Seller drains stock at `sellRate`; cash popups aggregated (≤ 1 per 0.9 s) with a coin sound at the stall. Visual tiers for Sell Speed / Sell Value / Storage (see Spec §7).
- **Storage:** 120 units base (+50%/level). Cart UNLOADING only advances while rubble actually moves; when storage is full it waits holding the load (`cartBlocked()`), STORAGE FULL shown on the pile and cart.
- **Tools:** Pickaxe 1 → Iron 1.5 ($75) → Heavy 2.25 ($260, 25 m) → Jackhammer 4×1.4 burst ($1,800, 75 m). Each tier changes the head/handle drawn, debris intensity (`fx`), and adds a low `playThud`; the jackhammer queues 4 impacts 45 ms apart per click with a BRRRT.
- **Diggers:** $80 ×1.28, dps 0.6, available from the start of the stall era (no depth gate). New visible diggers rappel in (`crewArriveSecs` 1.2: rope, slide, dust, lamp on); `syncWorkers` now keeps existing workers' phases. Max 3 visible; extras in the "+N crew" row.
- **Layout mirrored:** transport (rails, cart, loading pile, headframe) is on the RIGHT wall; miners on the left/centre; surface stockpile, chute, buyer/stall right of the shaft opening (a deck bridges the opening on narrow screens). Both piles show their count on the pile.
- **Panel:** cards for the next action (next tool, Hire Digger, Build Scrap Stall); compact rows for transport and surface upgrades; group headers with live summaries; progressive reveal (Sell Value after 120 sold, Storage at 50% stock). HUD cash counts up.
- **Navigation (minimal, not 3D):** a contextual prompt button — "▲ Follow the cart to the surface" (first trip), "▲ Surface: the buyer is waiting", "▼ Back to the dig site" — with a smooth camera glide; while scrolled away the view holds still in absolute depth.
- **Geology polish (temporary, not 3D):** strata edges bulge with hashed lumps; fingers of the previous material reach a few metres below a material change. Undamaged face chunks switch to the new material when the geology changes.
- **Save:** still v3, additive fields with defaults: `stall`, `flags.sold`, `flags.storageSeen`, `stats {earned, sold}`, `upg.sellSpeed/sellValue/storage`. 3A/3B saves with a dead stockpile get the buyer; v2 saves keep their cash.
- **Tuning changes:** loadRate 2 → 3.5/s; cart capacity 40 → 50 (+45%/level); cart speed 6 → 8 m/s (+25%/level); crew cost growth 1.15 → 1.28; transport upgrade costs lowered (see Spec §10).

### Measurements (Phase 3C)
- Headless bot, 4 clicks/s, buys the cheapest affordable option every ~3 s: first break 0.5 s · depart 15.8 s · arrival 19.5 s · first cash 21.6 s · first sale $164 · stall 24.2 s · first tool 51.4 s · first digger 75.7 s · @1:00 depth 29 m, earned $285, pile 50, surface 20 · @3:00 depth 106 m, earned $2,202, pile 369, surface 65, Iron Pickaxe, 4 diggers, cart cap 2 / speed 2 / load 4, sell speed 3 / value 1.
- 3 clicks/s: first sale $169 at ~28 s, stall 33 s, first tool 60 s, earned $2,015 by 3:00.
- Real browser bot (~6 clicks/s incl. clicking the real panel and the nav prompt): depart 15.7 s · arrival 20.9 s · first cash 22.9 s ($175) · stall 27.2 s · first tool 52.4 s · first digger 87.4 s · @3:00 depth 169 m, earned $1,663.
- Purchase choices: after the stall, the player typically sees 5–9 options with 2–5 affordable but cash for one; longest gap without an affordable purchase ≈ 24 s.
- Frame work at the 700-particle cap (8 diggers, crits, cart, seller): p99 2.8 ms desktop, 10.4 ms at 4× CPU throttle.
- Verified: digging/crew/cart never add cash; material conserved through storage-full waits and reloads mid-sale; seller runs with the camera underground; crew dig with the camera at the surface; v2 and 3B saves migrate.

### Recommended next task (after 3C)
Human playtest of 3C — done; it led to Phase 3C.5 below.

### Phase 3C.5 — world identity + surface factory: `4bfadeb`
- **Why:** the 3C playtest found the world still looked like a prototype: a broken-looking excavator, inconsistent scale, a tiny "Scrap Stall" (and "scrap" made no sense for dirt), a toy truck, a narrow shaft with useless side geology, layer-cake strata, face/wall/rubble colours that didn't match, random cracks and premature red, rails that only changed at a few levels, no helmet lights, an empty surface and an overlong panel.
- **Surface economy superseded:** the Phase 3C seller model (Scrap Buyer + Scrap Stall cash drip) is replaced by the **Recycling Yard**: cart → hopper (RAW) → crusher + auger → hydraulic press → FINISHED BLOCKS → delivery truck → **cash only when a loaded truck departs**. A contractor (pickup "CONTRACTOR") buys the first load and is the no-soft-lock safety net until the yard ($80) is built. Trucks: arrive when ≥ 15 blocks, capacity 60, reverse in from the right to a loading bay, blocks arc onto the bed, drive off; colour `hsl((n × 137.508) mod 360, 42–54%, 44%)` per delivery index.
- **New modules:** `geo.ts` (deterministic geology sampler + cached 5 m segment painter), `characters.ts` (people, lamps, articulated excavator), `yard.ts` (headframe, yard, road, truck, contractor), `landscape.ts` (sky, day/night, mountains, trees, clouds, birds, night grade), `draw.ts` (shared pile/label/bubble helpers). `surface.ts` rewritten (contractor, processor, truck state machine).
- **Composition + scale:** shaft ≈ 60% of the canvas (max 680 px), centred at 45% so the yard fits; face logical width 220 → 260; player scale 1.3, crew 1.05; camera zoom/pan: close at the dig site, pans + fits the whole yard and truck bay at the surface (smooth, input inverted through the zoom). Effects scale with the work area (`fxScaleRef`).
- **Material consistency:** one sampler (`materialAt` logical / `materialAtXY` visual) feeds walls, face, debris and rubble. Loads carry `mix` (units per material); pile, cart fill, hopper, blocks and truck load are coloured by it. Undamaged face chunks follow the geology when it changes.
- **Geology:** painted per 5 m segment (value noise, large boundary waves + small noise, lenses/pockets near boundaries, wandering strata and streaks, embedded rocks, faint fissures), cached (LRU 90), ≤1 build/frame + 3-segment prefetch, blit clipped to the visible span. Shaft interior = same rock in shadow. Face cracks clipped above 62% of the face band (no damage cracks in untouched ground). Premature red cracks/flecks near 292 m removed.
- **Characters:** ~4.7-head stylised miners (boots, bent knees, belt, gloves, face, hard hat + lamp); player orange/red with hi-vis stripes; crew muted blue/green; contractor/yard hand with caps. Every visible worker has a lamp beam (player strongest); the shaft gets darker with depth (max 42% at ~260 m) so lamps matter. Excavator rebuilt: tracks, slewing body, cab (~1.15 worker heights), boom/stick/bucket solved with two-link IK so every joint stays attached and the bucket tip lands on the impact point; post-bite body rock; works from a timber mat on the left.
- **Rails:** every Rail Quality level changes something (thickness, brightness, sleeper spacing 1.15 → 0.45 m, cable thickness; bolts Lv1, brackets Lv3, cross bracing Lv4, side braces Lv5, shaft lamps Lv6+ getting closer, hazard paint Lv9, guard rail Lv12) on top of the 4 material tiers.
- **Surface environment:** 10-minute cosmetic day/night (dawn, day, sunset, night) with sun/moon arcs, stars, two parallax mountain ridgelines, distant tree line + framing tree clusters, layered painted clouds lit by time of day, an occasional distant flock; at night a cool grade with yard/headframe lamps and truck headlights glowing on top.
- **UI:** accordion sections EXTRACTION / TRANSPORT / PROCESSING / FINDS with live summaries (`PROCESSING  Raw 54/120 · Blocks 10 · Truck loading`), auto-open + flash when first revealed, one-at-a-time on mobile, state persisted in localStorage (`dth_acc`). Bigger cash, section titles and next-action names.
- **Save v4:** Loads `{qty, val, mix}`; `raw`, `goods`, `truck {state, t, dur, load, n, paid, bed}`, `yard`, `upg.processSpeed/contractValue/rawStorage`, `stats {earned, delivered, processed}`. v3 → v4 maps surface → raw, stall → yard, sellSpeed/sellValue/storage → processSpeed/contractValue/rawStorage, infers mix from depth; v2 still migrates. A departing truck's load is removed at departure (paid once); `bed` is visual only.
- **Tuning:** processRate 2.0/s (+35%/lvl), price ×3 (+25%/lvl), raw storage 120 (+50%/lvl), yard $80, truck pickup 15 / capacity 60 / load 16 per s, cart surfaceLift 7 m, headframe 16 m.

### Measurements (Phase 3C.5)
- Headless bot, 4 clicks/s: cart departs ~18 s · contractor sale $169 at ~26 s · yard built ~27–33 s · first truck paid ~64 s · trucks every 10–23 s · earned ~$1,600–1,800 by 3:00 · depth ~100 m at 3:00. Typical choice snapshot after the yard: 4–7 of 7–8 options affordable with cash for one; mid-game (2:00+) cash sometimes covers several options at once.
- Real-browser bot (~6 clicks/s, real panel + nav prompt): first sale $176 at 25 s · yard 28 s · first truck arrives 59 s / paid 64 s · 7 trucks by 3:00 · **0 cash increases outside a truck departure after the yard** · v3 save migrates with cash, yard, upgrades and material exactly conserved · reloads in every truck state conserve material and never pay twice · processing + trucks keep running with the camera underground.
- Frame work at the 700-particle cap (8 diggers + excavator, all crits, yard running): p99 ≈ 5–6 ms desktop; 26–49 ms at 4× CPU throttle and 25–65 ms at 6× (headless software rendering; noisy). This is a regression from 3C (≈10 ms at 4×) — more gradients (lamps), characters and the geology blit.

### Recommended next task
Human playtest of 3C.5. Then Phase 3D (navigation + unlimited depth). A real-GPU performance profile of the lamps/characters/geology at low-end settings should come before adding more visuals.

## KNOWN ISSUES
- Performance regressed under heavy CPU throttling in 3C.5 (see measurements); desktop is fine. Candidate costs: per-worker radial-gradient lamps, character geometry, particle polygons, large geology blits. Profile on a real low-end GPU before optimising blindly.
- First truck only pays ~30 s after the yard is built (the contractor bought the first load, so the yard waits for the second cart). The wait is filled by the build animation and first processing, but it is a soft dead zone.
- Transport still dominates (dig-site pile grows to several hundred by 3:00); mid-game cash can cover several upgrades at once (opportunity cost loosens after ~2:00).
- Hits land ~72 ms after the click (windup + downswing) to keep animation and sim in sync.
- Mobile: the surface yard fits but is small; the accordion opens one section at a time (the most recently revealed).
- Cracks are clipped per chunk, so a crack can stop at an invisible chunk boundary.
- Finds still use the placeholder modal (pauses digging) until Phase 4. Depth is still capped at 300 m until Phase 3D.
- Contractor speech uses a real-time `setTimeout` (cosmetic). Surface popups are world-space and can appear at the edge of the dig-site view when shallow.
- Sounds verified only as error-free, not by ear.
- Offline progression design is unresolved (interim: real chain simulation incl. processing + trucks, stops before the next find).

## CURRENT IMPLEMENTATION TASK
Phase 3C.5 is DONE — awaiting human playtest. Next (only after approval): Phase 3D (free navigation + unlimited depth + persistent history). Still out of scope: find cinematics, interruptions, Red Door, multiple carts, elevators, conveyors, truck upgrades, leaderboards, prestige, new resources, music.

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
