# DIG TO HELL — Design Spec

Authoritative design document. Supersedes the original "0–300 m vertical slice" spec (direct cash from clicking, purchasable minecarts, 300 m as the end of the game). All tuning numbers live in `src/config.ts`; numbers in this document describe intent and current defaults.

---

## 1. Product North Star

DIG TO HELL is a browser idle/clicker mining game (CrazyGames / Poki) where the player builds an increasingly absurd industrial operation inside **one continuous vertical shaft**.

The fantasy:

ONE MINER → SMALL HOLE → RUBBLE CART → SURFACE SELLER → CREW → RAILS → MACHINERY → PROCESSING → INDUSTRIAL MINE → EXTREME DEPTH → STRANGE DISCOVERIES

Two hooks:
- **Curiosity:** "What's down there?" (discoveries, geology, mysteries).
- **Mechanical:** "Can I make this entire mine run better?" (visible bottlenecks in a physical production chain).

The shaft itself is the player's machine:

| Zone | Role |
|---|---|
| Bottom (dig site) | Extraction |
| Shaft | Transport + infrastructure + history |
| Surface | Storage + processing + selling + construction |

The player can move through this vertical machine and watch every part operate.

---

## 2. Core Gameplay Loop

Old loop (superseded): CLICK → CASH → UPGRADE.

New loop:

**DIG → MATERIAL → LOAD → TRANSPORT → UNLOAD → SELL → CASH → UPGRADE**

- Cash has a physical origin: it appears only when something is sold at the surface.
- Digging feedback is impact, cracks, debris, depth and material — never money.
- Cash feedback happens at the seller, where the sale physically occurs.

---

## 3. World Structure

- One continuous vertical world from the sky/surface down to the current dig face. Depth is **unbounded**.
- **Surface (depth 0):** sky, ground, shaft opening, headframe, rail end, unloading point, stockpile, seller (later: storage, processing, buildings).
- **Shaft:** rails, the cart in transit, depth markers, geology, finds, milestone structures, machines.
- **Dig site:** the destructible face, miners, rubble pile, loading point.
- Previously visited depths remain recognizable: geology, rails, finds, structures and milestones are reconstructed deterministically (§9, §16). Transient detail (individual cracks, particles) is not preserved.
- Over time the shaft should read as **"I BUILT THIS."**

---

## 4. Economy / Resource Flow

### Resource flow V1
One generic material: **RUBBLE**. Resource definitions are data-driven (`RESOURCES` in config: `id`, `displayName`, `baseValue`, visual treatment, rarity, source depth/material) so ores can be added later. Do not add ores yet.

```
dig face chunk breaks      → rubbleWaiting += rubblePerBreak   (value per unit = baseValue × valueAt(depth))
cart at bottom, loading    → rubbleWaiting → cartLoad          (loadRate units/s, up to capacity)
cart full (or sent)        → cart travels up the shaft
cart reaches surface       → cartLoad → surfaceStock           (unload)
seller active (Phase 3C)   → surfaceStock → cash               (sellRate units/s × sellValue)
```

Quantities carry their accumulated value (`{qty, val}`), so material dug deeper is worth more when it is eventually sold.

**Selling is the only normal cash-generation path.** Hits, breaks, crits, crew strikes and finds do not create cash. (Finds may grant bonuses; see §12.)

### Three visible bottlenecks
| Bottleneck | What the player sees |
|---|---|
| Extraction | Empty cart waiting at the bottom |
| Transport | Rubble pile growing at the bottom; cart always travelling |
| Selling (3C) | Stockpile growing at the surface; full storage, cart waiting to unload |

The upgrade decision should usually come from watching the world, not reading numbers.

---

## 5. Extraction

- The player clicks/taps the face; the miner swings; the strike resolves on the impact frame (§14).
- Each broken chunk advances depth by the material's `metersPerBreak` and adds rubble to the pile at the dig site.
- Crits advance the crack two stages; a crit that breaks a chunk yields ×2 rubble.
- **Crew (Diggers)** strike chunks on their own timers and produce rubble the same way. Hiring one is a visible event: a rope drops, the digger slides down, lands in a dust puff, the helmet lamp clicks on, and they start swinging. Max 3 animated diggers on the face; the rest dig at full rate and are shown as a "+N crew" helmet row. Cost escalates ×1.28 per hire.
- **Excavator** (later extraction machinery, 235 m) strikes a large area periodically.
- **Tool ladder** (Phase 3C; each tier changes the tool in hand, the impact sound and the debris):

| Tool | Power / click | Unlock | Look / feel |
|---|---|---|---|
| Pickaxe | 1 | start | light gray head |
| Iron Pickaxe | 1.5 | $75 | larger dark head, more chips, extra low thud |
| Heavy Pickaxe | 2.25 | $260, 25 m | big block head, heavy THUNK, bigger break |
| Jackhammer | 4 × 1.4 burst | $1,800, 75 m | each click rattles 4 rapid impacts, BRRRT |

  Hits per dirt chunk: 3 → 2 → ~1.3 → <1 click. Clicking stays meaningful because every tier still needs clicks.
- *(History: Phases 3A/3B temporarily left extraction progression inaccessible — no income existed and only the tool name was shown. Phase 3C restores the tool ladder and Digger hiring as real early purchases.)*

### Rubble pile
- `rubbleWaiting` is shown as a procedural pile next to the loading point, sized by quantity (few stones → small → medium → large → overflowing at ~100%+ of the pile's visual capacity).
- Deterministic shapes; no per-unit physics objects. Transient debris from impacts is separate.
- On a break, a few pieces visibly arc from the face into the pile; loading arcs pieces from the pile into the cart.
- The pile is not hard-capped in V1 (no material is ever silently destroyed). A huge pile is the transport signal.

---

## 6. Transport

### The cart
- Exactly **one** cart in the initial game. It is permanent infrastructure, never a repeated purchase.
- When the cart leaves the dig site it is gone from the bottom; its world position always derives from its actual journey progress, so it can be seen anywhere along the shaft.

### State machine
```
BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN → (BOTTOM_EMPTY | LOADING)
```
- **LOADING:** rubble transfers at `loadRate` until capacity.
- **READY:** short dwell, then automatic dispatch when full.
- **Manual send:** clicking/tapping the cart while it holds anything sends it early. Manual dispatch is never required; idle play works.
- **TRAVELLING_UP / DOWN:** travel time depends on distance and speed:
  `travelTime(d) = baseTravel + d / (cartSpeed × railMult)` (smoothstep position profile).
  Shallow trips are quick (~4 s at 10 m); at 200–300 m a round trip is over a minute until upgraded. Linear in depth — no exponential misery; future transport tech (second cart, elevator/hoist, express rail) solves deep transport.
- **SURFACE_ARRIVAL:** brake + bump.
- **UNLOADING:** the cart tips and dumps into `surfaceStock`. (3C: if surface storage is full, the cart waits — the waiting cart is the signal.)

### Transport upgrades (level-based, cash)
| Upgrade | Effect | Visual |
|---|---|---|
| Cart Capacity | more units per trip | cart body tiers: rusty hand cart → reinforced → metal → heavy industrial |
| Cart Speed | faster travel | — |
| Loading Speed | faster pile → cart transfer | loading arcs speed up |
| Rail Quality | travel speed multiplier | rails: rough wood → reinforced wood → metal rail → heavy industrial |

Not yet: second cart, elevators/hoists, conveyors.

### Rails
Rails run the full height of the shaft along the wall; the cart rides them, hanging from a cable to a headframe at the surface. Rails remain visible when scrolling old depths and reflect the current Rail Quality tier.

---

## 7. Surface / Selling (Phase 3C)

V1 surface (deliberately primitive, built to be transformed): sky, ground, shaft opening, headframe, rail end, unloading point, rubble stockpile, seller location.

### Bootstrap: first-cartload Scrap Buyer (implemented, Phase 3C)
1. Player digs; rubble accumulates; the cart fills and leaves. A "▲ Follow the cart to the surface" prompt glides the camera up.
2. A Scrap Buyer (flat cap, rusty "BUYING SCRAP" truck) waits beside the stockpile. When the first load has been dumped he says "That's useful stuff." and buys it: the stockpile visibly drains, pieces hop to him, cash counts up in the HUD.
3. A big surface popup: **+$X / SOLD N RUBBLE** with a discovery sting (~$165–175 at 4 clicks/s).
4. "I won't stay here all day. Build a stall." → **BUILD SCRAP STALL $80**. Until the stall exists it is the only purchase offered, and the buyer keeps buying if the player somehow can't afford it (no soft-lock).
5. Building it: boards and posts go up with hammer knocks, counter, roof, sign "SCRAP", then the seller steps in; the buyer says "Good luck down there." and drives off.

### Seller
- Physically appears (the Scrap Stall + a seller behind the counter). Has `sellRate` (1.7 units/s base, +35%/level) and price (×3 per unit of material value, +25%/level).
- Visual tiers: Sell Speed 3 → sorting tray, 6 → helper; Sell Value 2 → price board "SCRAP $", 4 → weigh station, 6 → striped awning; Storage 2 → wooden bin, 4 → fenced yard. The seller's arms work faster with Sell Speed.
- Consumes `surfaceStock` over time; cash increases only as units are sold. Never converts the whole pile instantly.
- Player sees: cart unloads → pile grows → seller works → pile shrinks → money appears.
- Cash popups appear at the seller, aggregated into readable batches at higher throughput (+$12, +$34, +$81 — not hundreds of +$1).

### Surface upgrades
Sell Speed (revealed with the stall), Sell Value (after 120 units sold), Storage (once stock reaches 50% of capacity). Storage starts at 120 units (+50%/level); when full, the cart pauses mid-dump holding the rest of its load and shows STORAGE FULL — nothing is ever destroyed.

### Future surface systems (documented only, not tasks)
Sorting table, crusher, weigh station, warehouse, market stall, processing plant, specialty buyers, rare-material processing. The surface can eventually become an industrial complex.

---

## 8. Navigation / Continuous Shaft (Phase 3D)

- Persistent controls: **▲ SURFACE** (smooth camera to depth 0) and **▼ DIG SITE** (smooth camera to the working face). No hard cuts.
- Manual exploration: mouse wheel / trackpad on desktop; touch drag on mobile.
- The simulation never pauses because the camera moved.
- Nav buttons carry attention states (label/badge): ▲ CART ARRIVED, ▲ STORAGE FULL, ▼ RUBBLE FULL, ▼ FIND!
- Optional: follow-cart camera.
- Current build (3B): wheel scroll only, cart position shown on the depth gauge.

---

## 9. Procedural Geology (Phase 3D)

Logical depth ranges stay clean; visual boundaries must not look like a layer cake.
- Transitions: uneven boundaries, fingers of the old material, pockets, embedded stones, streaks, inclusions, gradual mixing over several meters.
- **Deterministic:** generated from `worldSeed + segment index` (segments of ~5–10 m). Returning to 82 m shows the same wall. Nothing per-pebble is saved; nothing random is regenerated per frame.
- A segment derives: material blend, edge shape, wall variation, embedded rocks, minor features.

Material ranges (logical): Dirt 0–75 m, Clay 75–155 m, Stone 155–250 m, Cave Rock 250–300 m, then procedural deep rock (§17).

---

## 10. Upgrades

Philosophy (kept and broadened): **no invisible number-only upgrade when a physical change is reasonable.** Upgrades add, enlarge, improve, speed up animation, change machinery, architecture, character behavior or the physical flow of resources. Not every +5% needs unique art — use visual tiers at meaningful thresholds.

Panel groups, revealed progressively (no walls of disabled buttons):

| Group | Upgrades | Revealed |
|---|---|---|
| EXTRACTION | Tool (next tier card), Hire Digger (card), (Excavator, future machinery) | purchasable once the Scrap Stall exists |
| TRANSPORT | Cart Capacity, Cart Speed, Loading Speed, Rail Quality (compact rows) | after the first cart dispatch |
| SURFACE | Build Scrap Stall (card) → Sell Speed, Sell Value, Storage (compact rows) | after the first load reaches the surface |

Panel rule: big cards only for the next meaningful action (next tool, hire digger, build stall); systems the player already understands are compact one-line rows (`Cart Speed  Lv 1 · 10 m/s  $160`). Each group header shows a live summary (crew + rubble/s; cart state + pile; stock/capacity + sell rate).

Current costs (Phase 3C, base × growth^level): Digger $80 ×1.28 · Cart Capacity $80 ×1.6 · Cart Speed $100 ×1.6 · Loading Speed $50 ×1.55 · Rail Quality $200 ×1.8 · Sell Speed $75 ×1.6 · Sell Value $140 ×1.75 · Storage $110 ×1.65 · Scrap Stall $80 (once).

Arrival animations (Phase 5, kept from the original spec): Digger rope-drop (1.2 s), Jackhammer crate (1.4 s), Foreman lift + whistle (1.7 s), Excavator lowered on a platform (1.9 s); abbreviated 0.5–0.8 s arrivals for repeat purchases. (The old "Minecart rolls in" purchase arrival is obsolete — the cart is permanent; cart/rail tier changes get small upgrade animations instead.)

---

## 11. Revised 0–300 m Onboarding Beat Sheet

Measured first minutes (Phase 3C, headless bot at 4 clicks/s buying the cheapest affordable option every ~3 s): first break 0.5 s · cart departs 16 s · arrives 20 s · first cash 22 s (~$165) · stall built 24 s · first tool 51 s · first digger 76 s · earned $285 by 1:00, $956 by 2:00, $2,200 by 3:00 · depth 29 m at 1:00, 106 m at 3:00. Between purchases the player usually has 2–5 affordable options but cash for one.

Exact seconds are set by playtesting. Rule: **no long dead zones** — something meaningfully changes, unlocks, arrives or becomes actionable every ~15–45 s during onboarding.

| ~Depth / time | Beat |
|---|---|
| 0 m, 0:00 | One miner, pickaxe, dirt. First click cracks dirt (THOK, debris). |
| first seconds | First break: pieces arc into a small rubble pile next to the empty cart. |
| ~0:15–0:30 | Cart visibly fills while the pile grows; cart dispatches (auto when full, or player taps it). TRANSPORT group appears. |
| first trip | Cart rattles up the shaft; player is invited to follow it to the surface. |
| first arrival | Tutorial junk buyer buys the first load → first cash. "WE NEED SOMEONE UP HERE." → Build Seller. SURFACE group appears. |
| next minutes | Player discovers the three systems (extraction / transport / surface) through visible bottlenecks; first transport and surface upgrades. |
| ~12 m | FIND: Rusty Coin (+10% digging). |
| ~20 m | Digger unlock (rope-drop arrival). |
| ~30 m | Gold Vein interruption (first, scripted). |
| ~45 m | FIND: Buried Car. |
| ~75 m | Clay transition (irregular, duller impacts, banner). |
| ~90 m | Cave-In interruption. |
| ~105 m | Jackhammer unlock (crate arrival). |
| ~120 m | FIND: Dinosaur Skull (+15% crew speed). |
| ~140 m | Critical Pocket interruption. |
| ~155 m | Stone transition (major breakthrough). |
| ~175 m | Foreman unlock. |
| ~195 m | FIND: Sealed Elevator. |
| ~215 m | Gas Pocket interruption. |
| ~235 m | Excavator unlock. |
| ~250 m | Cave Rock transition (cavern opens, echo). |
| ~265 m | FIND: Underground House. |
| ~280 m | Rich Vein interruption. |
| ~292 m | Warning: black stone, workers slow, low rumble. |
| ~300 m | THE RED DOOR discovered. Cinematic. Control returns; digging continues. |

Transport pressure should grow noticeably from ~150 m (long trips), and selling/storage pressure should alternate with it, so the player's attention moves between the three zones.

---

## 12. Finds / Discoveries

Discoveries provide curiosity, story and mystery. They are milestones inside an ongoing game, **not** the primary economy. They surprise, sometimes grant bonuses (never direct cash in the normal loop), and remain visible in the shaft history. Never skipped silently by offline progress.

Reveal cinematics (Phase 4):

**12 m — Rusty Coin.** 0.0 s pick hits something: metallic TING. 0.2 s tiny gold glint in the dirt. 0.5 s worker stops and looks. 0.8 s three quick brush/scrape animations expose the coin. 1.4 s coin spins toward the camera/HUD. 1.8 s RUSTY COIN FOUND. Reward: +10% permanent digging. Teaches finds.

**45 m — Buried Car.** First only a curved piece of metal. Workers uncover roof → windshield → an entire crushed rusty compact car sideways in the earth. Headlight flickers. BEEP! Worker jumps backward. Reward: a bonus (e.g., the car is hauled up as a valuable scrap load; it must physically reach the surface rather than paying instantly).

**120 m — Dinosaur Skull.** Pick exposes white bone. Workers stop, brush dirt. Camera subtly pulls back as the skull keeps getting bigger. The jaw falls open: CLACK. One miner jumps inside the mouth for half a second before being pulled back. Reward: +15% crew speed. The tiny comedy matters.

**195 m — Sealed Elevator.** A perfectly straight metal edge. More digging reveals elevator doors, 195 m underground. Old floor indicator: ↓. Bell: DING. Doors attempt to open 2 cm. Blackness. They slam shut. Reward: bonus + added to a Mysteries collection. Do not explain it.

**265 m — Underground House.** Pick breaks through wallpaper, not rock. Workers uncover window, wall, lamp, table: a tiny furnished room buried in the earth. Nobody inside. Lamp: click — turns on. One worker slowly backs away. Reward: bonus + +10% Find Chance.

**~300 m — THE RED DOOR (milestone, not an ending).** From ~292 m the cave rock becomes almost black. At ~298 m the pick strikes: GONG instead of rock. Workers stop. The player breaks the surrounding stone and something enormous emerges: a red metal/stone door embedded in/adjacent to the shaft — symbols, chains, no handle. Cash UI subtly dims. Silence. KNOCK. (2 s) KNOCK. (1 s) KNOCK. Red dust falls; a hairline of red light appears underneath. Text: **300 m** … **SOMETHING IS BELOW.** Then control returns and the player keeps digging past it. The door stays **closed**, unexplained, and visible when scrolling back. The intended feeling is "WHAT THE HELL IS THIS?", not "GAME OVER." Future content may interact with it.

---

## 13. Interruptions (Phase 6)

| Event | Trigger | Duration | Player does | Reward |
|---|---|---|---|---|
| Gold Vein | after 25 m; first guaranteed at 30 m | 8 s | rapidly click exposed gold nodes | a burst of high-value material into the rubble pile (must still be hauled and sold) |
| Cave-In | after 70 m; not within 45 s of another event | 10–15 s | break 5–8 fallen rocks | bonus material + 20 s crew frenzy |
| Critical Pocket | after 120 m | 10 s | time clicks when the fracture pulses bright | huge dig damage + bonus material |
| Gas Pocket | after 180 m | 8 s | click 3 flashing vents before the gauge fills | success = 30 s ×2 production; failure = no bonus, no punishment |
| Rich Vein | ~280 m | 15 s | smash sequence with escalating particles | large bonus material |

Rules: interruptions never punish failure; no random interruption within 20 s of a find or layer transition; random event cooldown 45–90 s after the scripted introductions. Rewards flow through the physical economy (material), not instant cash.

---

## 14. Dig Face

Implemented (Steps 2 / 2.5). The face is 8 logical damage regions presented as one continuous mass of earth; damage is localized; cracks are the primary damage indicator.

- **Dirt (3 stages):** indentation + 1–2 hairline cracks → 3–5 branching cracks → chunk detaches. Break: 5–8 irregular chunks, 10–18 dust, 3–6 grains; brown/tan; bounce once; fade ~0.8 s.
- **Clay (4 stages):** compression/deformation (the lip dents) ×2 → thick dark crack → slab tears loose. Break: 3–5 larger sticky chunks, little bounce. Burnt orange/red-brown. Lower, duller sound.
- **Stone (4 stages):** white impact mark → sharp radial crack → fracture network → violent break. 6–12 angular fragments, gray dust, occasional sparks, harder ricochet.
- **Cave Rock (5 stages):** dark bluish-gray; cracks expose darkness/faint glow behind the wall. Break: 8–14 fragments, pebbles, dust; debris falls into unseen space; subtle echo. From 292 m particles gain dark-red flecks.
- **Impact hierarchy:** normal hit (local pulse, chips, tiny impulse) < chunk break (fracture, debris, dust, low thump, small impulse, crater reveal) < crit (35–50 ms hit-stop, bright short star, radial shock ring, crack +2 stages, ~2× debris, ~2 px impulse, harder sound). Crits are recognizable without text.
- **Popups:** never cash at the pickaxe. Break: `+N rubble` with depth gained (`▼ 0.35 m`) underneath; crit break: larger. Crew strikes show no text.
- Breaks send a few pieces arcing into the rubble pile so production is visibly connected to the pile.

---

## 15. Audio

All sound synthesized with Web Audio; context created on first user gesture; ±3–7% pitch randomization on repeated impacts. No music yet.

| Sound | Synthesis |
|---|---|
| Dirt hit | 90–130 Hz sine/triangle thump, ~60 ms + short brown-noise burst |
| Clay hit | 70–100 Hz low-pass noise, ~100 ms, soft attack |
| Stone hit | 180–350 Hz short triangle transient + high-pass noise crack |
| Cave hit | stone hit + quiet 80–120 ms delayed echo |
| Crit | 1.2–2.5 kHz transient + noise crack + 70 Hz impact |
| Dirt break | filtered brown noise, 250–350 ms |
| Stone break | 4–7 randomized short noise/transient bursts over ~300 ms |
| Falling debris | randomized 150–600 Hz ticks, decreasing amplitude |
| Pick swing | high-pass noise whoosh, ~120 ms |
| Cart roll / depart | low-passed rolling noise rumble |
| Rail clack | short low transient + 1–2 kHz tick, spaced by distance travelled |
| Cart brake | ~1–3 kHz squeal with vibrato |
| Cart unload | rock-slide noise + debris ticks |
| Coin | two sine tones ~880 → 1320 Hz, ~120 ms |
| Cash popup | sine sweep ~600 → 950 Hz, 70 ms |
| Purchase | three ascending tones ~440/660/880 Hz |
| Find sting | ~523 → 659 → 784 → 1047 Hz, staggered ~80 ms |
| Jackhammer | repeated 55–70 Hz impulses at ~16–22 Hz + filtered noise |
| Excavator engine / slam | saw/triangle 55–80 Hz with slow modulation / 45–65 Hz sine drop + noise |
| Foreman whistle | sine ~1.8 → 2.5 → 2.0 kHz, ~350 ms |
| Gold vein start | bright arpeggio ~700–1400 Hz |
| Cave-in warning | 50–80 Hz rumble + scattered ticks |
| Gas hiss | band-pass noise 2–6 kHz |
| Layer breakthrough | 50 Hz rumble → crack → rising tonal sting |
| Elevator ding | sine ~900 Hz + ~1800 Hz harmonic, 350 ms |
| Car horn | paired square/saw ~400/500 Hz, two short bursts |
| Door impact / knock | ~45 Hz sine + low-pass noise, 0.8–1.2 s / 60–90 Hz transient + long cave echo |
| Mystery ambience | sparse 35–60 Hz sine pulses, extremely quiet |

Sounds from off-screen sources (e.g., the cart far up the shaft) are attenuated by camera distance.

---

## 16. Persistence / Save / Offline

- localStorage, saved every 5 s and on unload/pagehide; all access wrapped in try/catch; versioned schema with explicit migration (old versions either migrate or are deliberately discarded).
- Saved: cash, depth, tool, crew, finds, clicks, rubble pile, cart (state, time in state, state duration, departure depth, load), surface stock, upgrade levels, Scrap Stall built, onboarding flags (dispatched, arrived, sold, storageSeen), lifetime stats (earned, sold).
- Not saved: dig-face cracks, particles, popups. The world is reconstructed deterministically (§9).
- **Offline (interim, unresolved design):** elapsed time (capped) is simulated conservatively through the real production chain — crew digging feeds the pile, the actual cart state machine moves it — and crew digging stops just short of the next find so discoveries are never skipped silently. A proper offline design (summary screen, caps per system, seller behavior) is still to be decided.

---

## 17. Beyond 300 m

300 m is a major milestone, not `MAX_DEPTH`. The simulation and rendering must not assume a terminal depth (Phase 3D removes the current 300 m cap).
- Procedural deep rock after Cave Rock (no hand-authored named layers).
- **Hardness:** chunk HP per stage scales gently past 300 m: `hpPerStage(d) = caveHp × (1 + (d − 300)/hardDiv)^hardExp` with `hardExp` ≈ 1.2–1.4 (tunable; avoid runaway exponentials).
- **Value:** `valueAt(d) = (1 + d/valueDiv)^valueExp` continues (polynomial).
- **Transport:** travel time stays linear in depth; deep transport is solved by upgrades and future technology.
- Upgrades become increasingly necessary, but progress never stops.

---

## 18. Future Leaderboards (documentation only)

Possible categories: deepest depth (primary), fastest milestone times, highest production, event records. Depth must stay simulation-authoritative (never faked for animation). No networking/backend yet.

---

## 19. Performance / Technical Constraints

- TypeScript + Vite, HTML5 Canvas 2D, no React for the game, minimal dependencies.
- 60 FPS on mid-range laptops during several workers + break + crit FX + cart travel; works on mobile (touch, panel stacks below the canvas under 760 px).
- Particle counts capped; no unbounded DOM creation; no per-unit physics objects for resources.
- Modular separation: config, economy, simulation, dig-face state, cart/transport sim, rendering, FX, audio, panel, main wiring.
- Deterministic world reconstruction keeps save files small at any depth.

---

## 20. Explicitly Out of Scope For the Current Phase (3C done, awaiting playtest)

Find cinematics, interruptions, Red Door, multiple carts, elevators, conveyors, leaderboards, prestige, new resources, processing plant, museum, music. Full navigation (persistent Surface/Dig Site controls, touch drag) and deterministic geology are Phase 3D; 3C only adds a contextual nav prompt and cheap strata irregularity.
