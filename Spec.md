# DIG TO HELL — Game Design Specification (V2)

This is the **authoritative** design document. It supersedes every earlier spec (the original "0–300 m vertical slice ending at the Red Door", the Phase 3C seller model, and the Phase 3C.5 "truck departure pays cash" model). Superseded decisions are listed in §30 so nobody reintroduces them. Implementation status lives in `claude.md`; tuning numbers live in `src/config.ts` (numbers here describe intent and current defaults).

Design priorities, in order, when two options compete:
1. Something the player can **see happen** beats another number.
2. A **physical transformation** beats another upgrade row.
3. A **new meaningful decision** beats more passive income.
4. A **larger mine with better machinery** beats 20 more tiny workers.
5. **Show the world transformed** instead of telling the player they progressed.

---

## 1. Core Fantasy

The game begins with **one person, one pickaxe, one tiny hole, almost nothing.** Eventually the player owns a huge mine, dozens–hundreds of workers, rest infrastructure, industrial excavation chambers, excavators, drill rigs, transport systems, a surface recycling complex, truck logistics, construction operations, fossil excavation teams, massive construction projects and extremely strange deep-earth discoveries.

Emotional escalation (the heart of the game):
"I started by hitting dirt myself." → "I hired a couple of people." → "We need a bigger mine." → "We need machines." → "We're producing serious material." → "We can build things with this." → "I'm running an industrial operation." → "What the hell did we just find down there?"

Platform: browser idle/clicker for CrazyGames and Poki. Cosmetic-only monetization later; no pay-to-win, no energy systems.

---

## 2. Four Progression Fantasies

| Fantasy | Question | Systems |
|---|---|---|
| DEPTH | "What is below me?" | digging, geology, layers, the deep mystery (Red Door…) |
| INDUSTRY | "How large can my operation become?" | workers, tools, machines, worksite tiers, transport, processing, rest infrastructure |
| CONSTRUCTION | "What can I build with everything I'm extracting?" | projects on a plot, ever-larger buildings, sale payouts |
| DISCOVERY | "What will I find next?" | fossils, caves, buried objects, strange structures |

They reinforce each other: depth produces material and discoveries; industry scales material; construction turns material into money; money buys industry.

---

## 3. Master Economy (the macro-loop)

```
DIG → RAW MATERIAL (rubble) → LOAD CART → TRANSPORT TO SURFACE → RECYCLING / PROCESSING
    → BUILDING MATERIAL (blocks) → LOAD TRUCK → DELIVER TO CONSTRUCTION SITE → CONSTRUCT PROJECT
    → COMPLETE / SELL PROPERTY → CASH → UPGRADE OPERATION → DIG DEEPER
```

- **Mining creates matter. Industry transforms matter. Construction creates value.**
- Digging never generates cash. Cart arrival never generates cash. Processing never generates cash. Truck departure never generates cash.
- **Main cash:** selling a completed property. **Secondary construction cash:** small milestone payments when a construction stage completes (the client pays per milestone, ~8–10% of the property value each).
- **Tutorial seed money:** the contractor buys the very first raw load once (and keeps buying only while the player cannot afford the Recycling Yard — a no-soft-lock safety net).
- **Future secondary cash:** fossil sales to collectors, special discoveries, bonus contracts. Never normal mining.
- Every quantity of material is a **Load** `{qty, val, mix}`: units, accumulated value, and material composition (units per source material). Composition travels pile → cart → hopper → blocks → truck → construction stack and drives every colour on the way.

### Visible bottlenecks
| Bottleneck | What the player sees |
|---|---|
| Extraction | empty cart waiting at the bottom; idle trucks |
| Transport | rubble pile growing at the dig site; cart always travelling |
| Processing | hopper full (RAW FULL); cart waiting at the top to unload |
| Construction | material stack empty at the plot; builders idle; or a big stack waiting for the player to start the next stage |

---

## 4. Locations

Three primary sites, all parts of one continuous world:

| Site | Where | Role |
|---|---|---|
| **MINE** | the shaft + dig site (vertical) | extraction, workers, rest, worksite, transport |
| **YARD** | surface beside the headframe | Recycling Yard: hopper → crusher → auger → press → block stack, truck depot |
| **BUILD** | surface, further along the road | the construction plot, material stack, builders, the building |

Future locations (documented only): Fossil Lab / Museum, Second Mine, Deep Facility, Research Site.

---

## 5. Navigation

A permanent, game-like navigation bar: **[MINE] [YARD] [BUILD]** — as built in V2-1 it sits **top-centre over the game view** on desktop and mobile (the bottom of the mobile screen belongs to the panel), with keyboard shortcuts 1/2/3. Each button: short label, active state (filled yellow), attention badge. Buttons appear as the tutorial unlocks them (MINE → YARD at the first cart departure → BUILD when the first truck heads to the site) with a short pop animation. One "follow" hint pill under the bar (FOLLOW THE CART / FOLLOW THE TRUCK / BLOCKS ARRIVED / MORE BLOCKS NEEDED: DIG) points at the site that matters during the introduction.

### Attention indicators
- **Red `!`** = "GO HERE. SOMETHING IS HAPPENING." Only for meaningful attention:
  - MINE: worksite expansion ready and affordable; the whole chain is idle because nothing is being dug (no crew yet, nothing in the pipeline); fossil discovered (future), cave-in (future), major discovery.
  - YARD: raw storage full and the cart blocked (production stopped), Recycling Yard ready to build (tutorial), major machinery unlock.
  - BUILD: enough material to start the next stage, building complete / ready to sell, new project to choose, the first truck arriving (tutorial).
- **Yellow dot** = an optional upgrade is affordable there. Subtle, no pulsing.
- **No badge** = routine operation. Never red-badge a routine affordable +5% upgrade. Badges are not shown on the site you are viewing.

### Transitions
Short camera moves (≈0.3–0.8 s), no loading screens: **vertical** travel for Mine ↔ Yard (up/down the shaft), **horizontal** road pan for Yard ↔ Build. Repeated quick navigation uses the shorter duration. Mouse wheel / trackpad still scrolls the shaft at the Mine (history browsing); touch drag later.

---

## 6. First-Time Introduction (no modals, no checklists — teach through the world)

1. **Land.** Calm landscape (mountains, trees, clouds, birds), almost no infrastructure. The player stands beside a tiny staked patch of ground. Text: **YOU BOUGHT THIS LAND FOR $1.** … *Someone said there's something valuable underneath it.* … **START DIGGING** (the patch glows; nothing else competes).
2. **First dig.** WHACK, crack, material breaks loose, visible rubble, a small **+N RUBBLE** (never cash). After several breaks: **RUBBLE ISN'T MONEY.** … **GET IT TO THE SURFACE.**
3. **Cart.** The headframe goes up, rails drop, the cart is lowered. It fills from the pile and starts up. **YARD `!`** appears: **FOLLOW THE CART.**
4. **Yard.** The cart dumps raw rubble beside the headframe. A contractor drives up and inspects it: *"Raw rubble isn't worth much."* … *"But processed material is."* He buys **only enough of it for seed money** (≈ the yard's cost + a little, `CFG.intro.seedCash`) — the rest stays on the ground so the brand-new yard has something to press immediately → **BUILD RECYCLING YARD**. (Safety net: while the player cannot afford the yard he keeps buying, so there is no soft-lock.)
5. **Recycling.** Hopper, crusher, auger and press go up. Raw rubble visibly enters; the first finished block slides out: *"Now this is useful."* The delivery truck loads blocks. **BUILD `!`**: **FOLLOW THE TRUCK.**
6. **Construction.** An empty plot. The truck drives in and unloads blocks. **BUILD SOMETHING.** → start the Tiny Cabin.

After ~60–120 s the player understands **DIG → RECYCLE → BUILD → SELL → EXPAND**. Existing saves skip the parts they have already done (a migrated save with a yard starts at step 6). No blocking modals anywhere in the introduction; even the legacy "finds" (coin, buried car) are non-blocking banners until discoveries are rebuilt in V2-2. While the chain is starved (blocks needed, nothing being dug) the hint says **MORE BLOCKS NEEDED: DIG ▼** and MINE gets the red `!`.

---

## 7. Mine

### 7.1 Shaft layout (people route and material route never overlap)
- **LEFT wall:** worker access (ladder → wooden switchback stairs → reinforced stairs → metal stair tower → worker elevator) and rest infrastructure. No central spiral staircase.
- **CENTRE:** the player, miners, the active work area. Heavy machines occupy designated floor positions.
- **RIGHT wall:** the cart rail, hoist cable, rubble pile and loading point.

### 7.2 Dig face (implemented; keep)
The face is N logical damage regions presented as one continuous mass of earth; damage is localized; cracks are the primary damage indicator.
- **Dirt (3 stages):** indentation + 1–2 hairline cracks → 3–5 branching cracks → chunk detaches. 5–8 irregular chunks, 10–18 dust, 3–6 grains; brown/tan; bounce once; fade ~0.8 s.
- **Clay (4 stages):** compression/deformation (the lip dents) ×2 → thick dark crack → slab tears loose. 3–5 larger sticky chunks, little bounce. Burnt orange/red-brown; lower, duller sound.
- **Stone (4 stages):** white impact mark → sharp radial crack → fracture network → violent break. 6–12 angular fragments, gray dust, occasional sparks, harder ricochet.
- **Cave Rock (5 stages):** dark bluish-gray; cracks expose darkness behind the wall. 8–14 fragments, pebbles, dust; debris falls into unseen space; subtle echo.
- **Impact hierarchy:** hit (local pulse, chips, tiny impulse) < break (fracture, debris, dust, low thump, small impulse, crater reveal) < crit (35–50 ms hit-stop, short star, shock ring, crack +2 stages, ~2× debris, ~2 px impulse, harder sound). Crits read without text.
- **Popups:** never cash at the pickaxe. Break: `+N RUBBLE` with depth gained (`▼ 0.35 m`); crew strikes show no text.
- Damage cracks belong only to the working face (never in untouched ground). No premature red effects; red returns with the Red Door.
- Lighting: deeper = darker (up to ~42%); helmet lamps (player strongest) and machine/worksite lamps carve out the work area. The mine should become beautiful at depth because of accumulated warm lights.

### 7.3 Equipment changes output
A bigger tool or machine means **more damage + more material + a larger visual break + a larger sound + a larger debris response.** Never the same tiny `+2 RUBBLE` after an upgrade.

| Tier | Damage / click | Rubble per break | Notes |
|---|---|---|---|
| Pickaxe | 1 | ×1 (2) | small chunks |
| Iron Pickaxe | 1.5 | ×1.5 (3) | more material |
| Heavy Pickaxe | 2.25 | ×2.5 (5) | larger chunks, heavy THUNK |
| Jackhammer | 4 × 1.4 burst | ×3.5 (7) | BRRRT burst, obvious DPS jump |
| Excavator (machine) | a whole chunk per bite | ≈12 per bucket | needs Work Chamber |
| Drill Rig (future) | huge | huge | needs larger chamber |
| Tunnel Borer (future) | industrial | industrial | needs Industrial Chamber |

### 7.4 Physical upgrade tiers (minor levels inside major tiers)
Major progression is equipment, not "Lv 9". Numerical sub-levels exist, but every few levels the player unlocks **a new thing**:
- Transport: Old Mine Cart → Reinforced Cart → Powered Cart → Ore Wagon → Motorized Hauler.
- Track Strength (§7.8): Wood Track → Reinforced Wood Track → Iron Rail → Steel Rail → (later) Industrial Track → Powered Rail. Each tier is a physical rebuild with a safe load, not a speed level.
- Loading: Hand Loading → Chute → Mechanical Loader → Powered Hopper → Industrial Loader.
- Processing: Basic Crusher → Rock Crusher → Rotary Crusher → Twin Crusher → Industrial Pulverizer.

**Upgrade visual rule:** a purchase must visibly change/add/enlarge equipment, change an animation, speed or output, change the environment, add infrastructure, or automate a task. If looking at the world right after buying shows no difference, the upgrade is weak.

### 7.5 Worksite expansion (major progression)
Too many workers cannot share a tiny hole and machines cannot magically fit — the mine physically expands.
- **Tier 1 — Narrow Shaft:** player, 1–3 visible miners, small rubble pile, basic cart.
- **Tier 2 — Work Chamber:** unlocked when the crew grows (≥ 2 diggers) or heavy equipment becomes relevant. **EXPAND WORKSITE**: whistle → workers stop and move clear → charges placed → **BOOM** (shake, flash, big dust cloud, side walls break outward) → debris clears → timber supports install → camera smoothly zooms out → a wider chamber; workers spread out. A **major reward**.
- **Tier 3 — Industrial Chamber (future):** many workers, excavator + drill rig + loader, larger transport, rest infrastructure.
- **Space rule:** heavy equipment requires a chamber tier (Excavator → Work Chamber). The UI shows the requirement ("EXCAVATOR — Requires Work Chamber") to create anticipation.
- **Machine scaling:** never stack 12 identical excavators; scale through larger machines, wider chambers, more stations, new machine classes.

### 7.6 Excavator
Clearly larger than a person (shared world scale): tracks, base, upper body, cab with operator, boom, stick, bucket on real articulated pivots (no detached arms, no floating bucket). Works from a timber mat on a designated chamber floor position, never overlapping miners or the cart. The bucket removes a bucket-sized bite: much more rubble than a miner.

### 7.7 Future drilling
Pneumatic Drill Operator → Drill Rig → Industrial Drill → Tunnel Borer, each requiring progressively larger worksite infrastructure.

### 7.8 Track Strength and the overload storyline (built)
Increased mining eventually puts too much weight through the transport system; the world shows it, the player fixes it.
- **Tiers** (`TRACK_TIERS` in `config.ts`; `S.upg.rail` = tier index): Wood Track (safe load 70, speed ×1.0) · Reinforced Wood Track (140, ×1.15, $150) · Iron Rail (260, ×1.3, $700) · Steel Rail (450, ×1.5, $2,500). Later: Industrial Track, Powered Rail.
- **loadRatio = cart load / safe load** of the ACTUAL cart (never time or depth): SAFE < 0.75 ≤ STRAINED ≤ 1.0 < OVERLOADED (`CFG.track.strainedAt`).
- **Balance:** the starting cart (50) runs SAFE on Wood (71%), so the opening is healthy. The first Cart Capacity upgrade (73) overloads Wood — a bigger cart is not pure upside (the capacity row warns *full load may exceed track strength*, but never blocks). Reinforced Wood stays safe/strained until Cart Capacity Lv 5 (163); Iron until Lv 10 (275): each track buys a real period of relief. More diggers/tools/the Excavator fill carts faster, so full (heavy) trips become the norm.
- **SAFE:** normal speed, stable track, no warning, no dust.
- **STRAINED** (while the loaded cart climbs): rails bow ~1 px around the cart, rare wood creaks (every 2.5–5 s), the odd wheel squeak, a speck of dust. "Hmm, that cart is getting heavy."
- **OVERLOADED** (while it climbs): rails bow ~3 px and vibrate around the cart, sleepers rattle, joint brackets shake, the cart rattles and tilts, frequent creaks (0.9–2 s) and squeal (1.5–3 s), dust (~4/s) and pebbles (~1.5/s) shaken off the wall near the cart, a tiny camera jolt each joint crossed (`CFG.track.joltEveryM` 3 m, `jolt` 0.35 — less than a pick hit; scaled down on narrow screens). All effects are local to the cart and fade out when it is off screen. The cart is visibly heaped above the rim.
- **Consequence:** an overloaded trip up travels −30% slower (`CFG.track.overloadPenalty`). Nothing breaks, nothing is lost, no countdown, no fake danger (cave-ins are V2-3).
- **First overload ever** (saved flag `flags.trackStory`, plays only if the player is watching the Mine): creak → dust → creak + squeal → a short shake + pebbles → non-blocking lines **⚠ TRACK STRAIN** / *"These wooden rails weren't built for loads this heavy."* / *"Reinforce the track before transport gets worse."* → the TRANSPORT accordion opens and the track card pulses.
- **Attention:** MINE red `!` only while the track is genuinely overloaded (`trackOverloaded()`: the cart carries more than the safe load, or the last trip was overloaded and a full cart still would be). Not because an upgrade is affordable.
- **UI** (Transport): Track name · Safe load · Current cart; when overloaded: **⚠ OVERLOADED 73 / 70 · transport −30%** and a **REINFORCE TRACK** card (next tier, safe load, speed gain, cost).
- **Upgrade = a physical job (~2.6 s, `CFG.track.upgradeSecs`):** the cart waits; the new tier replaces the old one section by section from the dig face upward (old sections shake loose above the work line, hammering, dust, a REINFORCING TRACK tag), a final metal clunk, **TRACK REINFORCED**. A cart already climbing then continues at the new speed (`retimeUpTrip`).
- **Payoff:** dust and creaks stop, the track no longer bows, the cart stops rattling, the red `!` clears, the same load climbs faster (measured: 73-load trip 12.0 s on overloaded Wood → 7.6 s on Reinforced Wood; a safe 40-load trip on Wood took 8.4 s).
- **Visual tiers:** Wood = thin rough rails, sparse thin sleepers, small wooden brackets; Reinforced Wood = thick rails, dense thick sleepers with steel plates + bolts, diagonal timber bracing, an upright; Iron = metal rails with highlight, bolted sleepers, iron brackets, steel bracing; Steel = heavy bright rails, steel sleepers, yellow brackets, guard rail, hazard paint, wall lamps.
- **Save:** `upg.rail` is the tier; `trackSchema: 1` marks the new meaning (older saves map Rail Quality levels once: Lv ≥ 7 → Steel, ≥ 4 → Iron, ≥ 1 → Reinforced); `flags.trackStory`. The "last trip overloaded" memory is not saved, so a reload never shows a false overload.
- **Code:** `config.ts` (`TRACK_TIERS`, `CFG.track`) · `economy.ts` (`trackDef`, `trackSafe`, `trackStress`) · `cart.ts` (penalty at departure, `cartTrackStress`, `trackOverloaded`, `retimeUpTrip`) · `track.ts` (purchase + reinforcement job) · `trackfx.ts` (world feedback, first-overload story, rebuild FX) · `render.ts` (`drawRails`/`drawTrackTier`, cart heap/rattle) · `panel.ts` (track block) · `nav.ts` (red `!`) · `audio.ts` (`playCreak`, `playSqueak`, `playClunk`).

### 7.9 The bottleneck principle (reuse this pattern)
**GROWTH → PHYSICAL BOTTLENECK → THE WORLD SHOWS THE PROBLEM → THE PLAYER NOTICES → THE PLAYER BUYS A SOLUTION → THE WORLD PHYSICALLY IMPROVES.**
Track strain is the first instance. Future pressures to build the same way, interconnected: more rubble → the cart can't keep up; heavier cart → the track struggles (built); more workers → the chamber is overcrowded; more raw material → the hopper overflows; more blocks → truck logistics struggle; heavier machinery → the chamber is too small; more construction → the delivery network falls behind.
**Rule: do not make the UI explain something the world can show first.** The UI confirms what the world already communicated.

---

## 8. Workers

### 8.1 Scalable character system
One reusable **character rig** (`CharacterRig`): position, scale, facing, animation state, role, palette, body variant, equipment, held item, helmet lamp, expression/state. All characters derive from **normalized proportions** (height = 1.0; head, torso, upper arm, forearm, thigh, shin, boot are fractions of it); world scale converts to pixels. No hard-coded pixel anatomy in render code.

Art direction: stylized, readable, friendly, slightly exaggerated 2D game characters ~4.5–5 heads tall — clear head shape, nose/face, hair/facial hair variants, neck, torso volume, arms with thickness, gloves, shaped legs, boots, clothing layers, helmet, belt/tools. Not stick figures, not realistic anatomy, not chibi.

Deterministic variation per worker seed: skin tone, shirt, vest, pants tone, helmet, hair, facial hair, body width, height ±~4%. Cohesive industrial palettes, no clown colours.

Roles share the rig and change clothes/helmet/equipment/idles: PLAYER, MINER, FOREMAN, CONSTRUCTION WORKER, FOSSIL SPECIALIST, DRIVER, MACHINE OPERATOR, future ENGINEER/SCIENTIST.

**Player:** ~1.05–1.15× a worker, distinguished by clothing (orange/red, hi-vis), helmet, the strongest lamp, animation and position — never by giant scale. Only a small soft contact shadow under the feet.

### 8.2 Animation
Reusable states: idle, walk, work, carry, rest (sit), climb, celebrate, inspect, surprised. Role actions: miner swing, jackhammer, brush fossil, operate machine, construction hammering. Procedural Canvas animation (no sprite sheets yet).

**Personality (rare, never spammed):** wipe sweat, adjust helmet, stretch, drink water, look around/up, talk to a neighbour, sit, check tool, look at watch; builders point at plans; miners examine an unusual rock. Rare comedy: high-fives, jumping back from the cart, a knocked-crooked helmet, the excavator operator drinking coffee.

### 8.3 Helmet lights
Every underground worker has a lamp that follows facing (soft gradients). Player strongest, workers weaker. Ambient light falls with depth; worksite infrastructure adds lamps.

### 8.4 Fatigue and rest (lightweight, never micromanagement)
States: WORKING → (tired) TO_REST → RESTING → RETURNING (→ ASSIGNED_SPECIAL later). Work ≈60–120 s, then finish the current action, walk to the left-wall stairs, climb to the rest platform, sit/drink ≈10–20 s, climb down, resume. Phases are **staggered** so the mine never stops; a tired worker keeps working if every seat is taken. The player has no fatigue. Fatigue exists to create movement, life, rest infrastructure, storytelling and upgrade choices — not to annoy. No hunger, bathrooms, disease, complex morale, sleep schedules or health.

**Rest Platform** (first rest infrastructure): a wooden platform on the left wall above the work floor with a bench, water cooler, warm lamp and railing; label `REST 2/3`. As built: it is built into the wall once the shaft is ≥ 22 m deep (`CFG.rest.minDepth`; before that nobody tires); an access ladder on the left wall always connects the surface to the platform (or the floor while the shaft is shallow) and new hires climb down it. Future: larger platform, better benches, water station, break room, canteen, underground rest station (capacity, recovery speed, travel efficiency).

### 8.5 Population scaling / LOD
- 1–8 workers: full individual characters.
- 9–20: foreground workers full detail, background workers simplified.
- 20+: small groups, distant silhouettes, active stations, summary counts.
- Never "+97 crew" as the only visual evidence — the world implies scale.
- Character LOD by on-screen size: near = full; medium = no face details/gloves/belt; far = simple silhouette.

---

## 9. Recycling Yard
INPUT HOPPER → CRUSHER → AUGER → PRESS / FORMING → FINISHED BUILDING MATERIAL (blocks).
- The cart parks over the hopper in the headframe and tips straight in; large chunks tumble in and settle. The hopper has a **visible fill level** (cut-away window) and raw count.
- The crusher visibly consumes material (pieces drop from the hopper throat into the drums); the auger visibly carries smaller pieces; the press: anticipation → THUMP → dust → a block slides out; the finished stack visibly grows. Dust during crushing/pressing in the source colour.
- Upgrades: Processing Speed (Basic → Rock → Rotary → Twin Crusher → Industrial Pulverizer tiers), Block Quality (value of the material the blocks carry into construction), Raw Storage (hopper → bigger hopper → overflow bunker).
- **The delivery truck lives at the yard:** it parks at the loading bay, loads blocks when enough are stacked, drives forward along the road to the construction site, unloads, and **reverses** back to the bay. It is **one company truck: always red, always facing the construction site** (front toward BUILD, back toward the mine) — it never turns around or flips. Heavy cab-forward flatbed: length ≈4.5 worker heights, cab ≈1.6, wheels ≈0.62 across, one front axle + tandem rear axles; cargo is the actual blocks, stacked. Exhaust puffs on start/stop.

---

## 10. Construction

### 10.1 One plot, reused, ever-bigger projects
- **Project 1 — Tiny Cabin** (5 stages, ~150 blocks).
- **Project 2 — Two-Story Home** (7 stages, ~480 blocks).
- Future escalation: Small House, Family Home, Luxury Home, Apartment, Office, Hotel, Tower, Skyscraper, Stadium, Castle, Resort, Bridge, Grand Civic Building, Monumental Palace, Mega Skyscraper, Arcology, Launch Tower, absurd mega-projects; possibly recognizable landmark-inspired projects. **Every completed project should make the next one feel more ambitious.**

### 10.2 Physical construction (the structure is the progress bar)
Visual stages over 0–100%: empty lot → site preparation → foundation → floor/frame → walls → second level / roof structure → windows/roof → details → finished landscaping and lights. A percentage may supplement, never replace, the picture.

### 10.3 Material delivery and consumption
The truck arrives and unloads; the plot's **material stack grows**; builders carry blocks from the stack to the building; **the stack shrinks while the building grows**. Readable with no UI.

### 10.4 Stages (early: the player starts them; later: automation)
Each stage needs a block amount on site. When enough material is stacked, **BUILD `!`** and the panel offers **START: FOUNDATION** (etc.). Builders then consume material at the build rate; on completion the client pays a **milestone payment** (~8–10% of the property value). Later a **Foreman** auto-starts stages (automation as progression).

### 10.5 Completion and sale
Workers stop; small celebration; camera frames the building; **BUILDING COMPLETE — PROPERTY VALUE $X**; big **SELL PROPERTY** action (residential). On sale: cash payout, a SOLD sign, a short hold → dissolve/cleanup → an empty, upgraded plot. The next project appears immediately and is visibly **bigger**.

---

## 11. Discoveries (future, documented)

### 11.1 Fossils (signature system; next milestone V2-2)
Not decorative loot, not an instant reward — a temporary excavation project.
- **Discovery:** CLINK; bone appears; workers stop near it; **MINE `!`**; *FOSSIL DISCOVERED*; only a small portion visible.
- **SEND EXCAVATION TEAM $X:** a specialist, brush tools, temporary lamps, a small fossil work platform; then **ASSIGN WORKERS** (e.g. MINING 8 / FOSSIL 2). Workers on the fossil stop contributing mining DPS — a real tradeoff.
- **Excavation:** 0–20% small bones; 20–40% ribs/spine; 40–60% larger body; 60–80% skull; 80–100% clean full skeleton. Brushes, small picks, careful digging, subtle dust; never jackhammering a fossil.
- **Scale:** some fossils are BIG (a dinosaur skeleton spanning a large section of wall; the camera pulls out: "Whoa."). Later: mammoth, large dinosaur, giant marine reptile, unknown enormous skeleton. Do not overuse.
- **Reward:** SELL TO COLLECTOR (high value). Future: SEND TO MUSEUM (permanent bonuses/reputation).
- **History:** the site remains; if sold, an outline / excavation cavity / plaque remains.

### 11.2 Named discoveries (retained cinematics; later milestones)
- **12 m — Rusty Coin.** TING; gold glint; worker stops; three brush strokes; coin spins toward the camera; RUSTY COIN FOUND (+10% digging).
- **45 m — Buried Car.** A curved piece of metal; roof → windshield → a crushed rusty compact car; headlight flickers; BEEP!; worker jumps back.
- **120 m — Dinosaur Skull** (now part of the fossil system).
- **195 m — Sealed Elevator.** A straight metal edge; elevator doors underground; floor indicator ↓; DING; doors open 2 cm onto blackness and slam shut. Never explained.
- **265 m — Underground House.** Wallpaper instead of rock; window, wall, lamp, table — a furnished room in the earth; the lamp clicks on; a worker slowly backs away.
- **~300 m — THE RED DOOR (milestone, not an ending).** From ~292 m the rock turns almost black; GONG; workers stop; an enormous red door with symbols and chains, no handle; silence; KNOCK … KNOCK … KNOCK; red dust; a hairline of red light; **300 m … SOMETHING IS BELOW.** Control returns; digging continues; the door stays closed and visible in the shaft history. Feeling: "WHAT THE HELL IS THIS?", never "GAME OVER". (Roadmap V2-6.)

### 11.3 Shaft history
The mine remains a physical timeline: excavation sites, plaques, embedded discoveries, rail improvements, rest platforms, lights and machines stay where they were. The player can scroll/navigate through it. Transient detail (cracks, particles) is reconstructed, not saved: geology is deterministic per `worldSeed + segment`.

---

## 12. Active Events (future; goal: something meaningfully different every ~20–45 s in early active play)
| Event | Summary | Rule |
|---|---|---|
| Critical Vein | ~10 s high-value seam; hit highlighted weak points for huge material bursts | no punishment for poor play |
| Cave-In | rocks block part of the worksite/rail; clear them fast for bonus material / a temporary frenzy | auto-resolves after a short delay; never destroys progress |
| Gas Pocket | vent flashing cracks before a gauge fills | success = production boost; failure = no bonus |
| Side Cave | digging exposes a side chamber; EXPLORE → crystals, old equipment, bones, water, a chest, strange machinery, unknown structures | curiosity |
| Buried Object | named discoveries (§11.2) | — |
| Fossil | §11.1 | — |
| Worksite Expansion / Construction Milestone | already player moments | — |
Rewards flow through the physical economy. No random event within 20 s of a find or layer change; cooldown 45–90 s.

---

## 13. Geology (implemented; keep)
One deterministic sampler (`materialAt` logical / `materialAtXY` visual) drives walls, face, debris and rubble. Logical ranges: Dirt 0–75 m, Clay 75–155 m, Stone 155–250 m, Cave Rock 250–300 m, then procedural deep rock. Visual boundaries are irregular: large waves + small noise, lenses/pockets near boundaries, wandering strata, streaks, embedded rocks, faint fissures; painted per 5 m segment and cached. No universal mud-coloured rubble; no giant black damage cracks outside the dig face; no unexplained red.

### Beyond 300 m
Depth is unbounded; 300 m is a milestone. Procedural deep rock; `hpPerStage(d) = caveHp × (1 + (d − 300)/hardDiv)^hardExp` with `hardExp` ≈ 1.2–1.4; value `(1 + d/valueDiv)^valueExp` continues; transport time stays linear in depth.

---

## 14. Rubble Visibility (material journey)
Mine: chunks visibly accumulate in the pile. Cart: the load visibly rises. Yard: the hopper visibly fills, the crusher visibly drains it, the auger visibly carries pieces, the press produces blocks, the stack grows. Truck: cargo visibly loads. Construction: the delivered stack grows; the building grows while the stack shrinks. The player can watch material travel through the whole economy.

---

## 15. Surface Atmosphere
Peaceful counterpoint to the industrial, mysterious mine: mountains, trees, layered painted clouds, birds, cosmetic day/night (~10 min), stars, moon, warm industrial lights at night (yard, mine entrance, construction work lights, vehicle headlights). **No production multiplier tied to day/night.**

**Animals** only if they look good at rendered resolution (no crude blobs). Priority: a rabbit near vegetation (pauses, ears move, hops, looks around, leaves). Later: birds landing, butterflies, fireflies, distant deer. No clicking, no reward — pure life.

---

## 16. Audio

### 16.1 Music (MusicManager)
Separate music volume, SFX volume and mute, persisted. States with crossfades: **Surface/Yard** calm, warm, optimistic; **Mine** mysterious, rhythmic, subdued; **Construction** productive, slightly energetic; **Fossil** quiet, curious (future); **Major discovery** ducks the music and plays a sting. Comfortable for long idle sessions. Only legally safe material: original procedural (Web Audio) music and/or local, approved, royalty-free files in documented asset slots (`public/music/<state>.ogg|mp3`). Never copyrighted tracks.

### 16.2 SFX (synthesized; ±3–7% pitch randomization on repeated impacts)
| Sound | Synthesis |
|---|---|
| Dirt hit | 90–130 Hz sine/triangle thump ~60 ms + short brown-noise burst |
| Clay hit | 70–100 Hz low-pass noise ~100 ms, soft attack |
| Stone hit | 180–350 Hz short triangle transient + high-pass noise crack |
| Cave hit | stone hit + quiet 80–120 ms delayed echo |
| Crit | 1.2–2.5 kHz transient + noise crack + 70 Hz impact |
| Break | filtered brown noise 250–350 ms / 4–7 short bursts over ~300 ms |
| Falling debris | randomized 150–600 Hz ticks, decreasing amplitude |
| Pick swing | high-pass noise whoosh ~120 ms |
| Cart roll, rail clack, brake, unload | rumble; low knock + 1–2 kHz tick; 1–3 kHz squeal; rock slide |
| Coin / cash / purchase / sting | 880→1320 Hz pair; 600→950 Hz sweep; 440/660/880; 523→659→784→1047 |
| Jackhammer | 55–70 Hz impulses at ~16–22 Hz + filtered noise |
| Excavator engine / slam | saw/triangle 55–80 Hz with slow modulation / 45–65 Hz drop + noise |
| Whistle | sine ~1.8 → 2.5 → 2.0 kHz ~350 ms |
| Blast (worksite expansion) | 40 Hz drop + broad noise + debris tail |
| Construction hammer | short wooden knocks |
| Event sounds (future) | gold-vein arpeggio, cave-in rumble, gas hiss, layer breakthrough, elevator ding, car horn, door impact/knock, mystery ambience |
Off-screen sources are attenuated by camera distance.

---

## 17. UI Philosophy
- Stop looking like enterprise software. **Location navigation is primary.**
- **Contextual panels:** MINE (Extraction, Workers, Worksite, Transport, Discoveries) · YARD (Processing, Storage, Loading, Logistics) · BUILD (Current Project, Materials, Stage, Sell). Never show every upgrade in the game at once. Accordions inside a site where needed.
- **Major vs minor:** major transformations (new tool, new machine, new chamber, new rest facility, new project, start stage, sell) get big cards and animations; minor efficiency (+capacity, +speed, +value) are compact rows.
- **World first:** never make the UI explain something the world can show first (§7.9); the UI confirms.
- **Attention without annoyance:** red `!` important, yellow dot optional, no badge routine. Do not constantly pulse everything.
- **Automation as progression:** what starts as a chore later becomes automated (Foreman auto-starts construction stages; an Archaeology Team handles common fossils; a dispatcher manages transport), while new, larger problems appear.

---

## 18. First Five Minutes (target)
| ~Time | Beat |
|---|---|
| 0:00 | beautiful quiet land |
| 0:05 | start digging |
| 0:20 | material and the cart become relevant |
| 0:30–0:50 | first surface delivery |
| 0:45–1:15 | Recycling Yard introduced |
| 1:00–1:30 | first processed building material |
| 1:15–1:45 | truck heads to Construction |
| 1:30–2:00 | first construction begins |
| ~2:00 | worker / tool choice |
| ~2:30 | visible rest behaviour / workforce activity |
| ~3:00 | first construction substantially changed |
| ~3:30 | worksite expansion becomes relevant |
| ~4:00 | larger extraction operation |
| ~4:30–5:00 | first property completion, or close enough that the player strongly wants to finish |
**The player should never spend a minute just watching numbers.** Any interval > 20 s with no decision, interaction, meaningful visual change, event, milestone or completing short-term goal is a **dead zone**; > 45 s is a serious problem.

**Measured in V2-1** (real-time browser bot on a fresh save: ~4 clicks/s, follows every red `!`, buys majors first then the cheapest item; a human reading the intro lines adds ~5–10 s up front):

| Beat | Target | Measured |
|---|---|---|
| first dig | 0:05 | 0:02 |
| cart introduced ("GET IT TO THE SURFACE") | 0:20 | 0:03 (after 8 rubble) |
| first cart departs / YARD unlocks | 0:30–0:50 | 0:21 |
| contractor seed money | — | 0:32 |
| Recycling Yard built + first block | 0:45–1:30 | 0:35 |
| BUILD unlocks / first truck to the site | 1:15–1:45 | 0:41 |
| first delivery on the plot | — | 0:45 |
| construction begins (Foundation) | 1:30–2:00 | 1:22 |
| first worker hired | ~2:00 | 1:32 |
| first property complete / sold → Project #2 | 4:30–5:00 | 2:45 / 2:50 |
| Work Chamber available / purchased | ~3:30 | 2:52 / 3:00 |
| first worker rests | ~2:30 | 4:05 (the rest platform needs ≥ 22 m and 60–120 s of work) |
| @1:00 | | 17 m, $15, no crew, Pickaxe, 18 blocks on the plot |
| @3:00 | | 69 m, $437, 2 diggers, Iron Pickaxe, Work Chamber, Project #2 starting |
| @5:00 | | 123 m, $6, 6 diggers, Iron Pickaxe, Work Chamber, Two-Story Home stage 3/7 |

The loop is proven faster than the target (first sale at ~2:50 instead of ~4:30). The weakest stretch is 0:45 → 1:22: the first truck brings only ~18 blocks, the Foundation needs 30, and the player digs while the cart makes another trip (active clicking, but no new decision for ~35 s).

---

## 19. Long-Term Game Shape
Eventually the player zooms/navigates between a peaceful landscape, an industrial recycling yard, a construction skyline, a massive mine shaft, rest stations, machines, fossil sites, deep caves and mystery structures. **The world itself is the progression screen.**

---

## 20. Persistence / Save / Offline
- localStorage, saved every 5 s and on unload/pagehide; try/catch; versioned schema; explicit migration that never duplicates material or cash and deletes the old key only after the new save is written.
- Saved: cash, depth, tool, crew, finds, rubble, cart, raw, finished blocks, truck, upgrade levels, yard built, worksite tier, construction (project, stage, stage progress, site material, properties sold), tutorial progress, navigation unlocks, current site, stats. Music/SFX preferences are a separate settings key.
- Not saved: animation phases, particles, cracks, worker fatigue phases (regenerated staggered on load).
- **Offline (interim, unresolved):** elapsed time (capped) runs the real chain conservatively: crew digging → cart → yard → truck → construction stock. Construction stages do not auto-start offline (the player starts them; future Foreman automates). Crew digging stops just short of the next discovery so discoveries are never skipped.

---

## 21. Performance / Technical Constraints
- TypeScript + Vite, HTML5 Canvas 2D world, DOM UI, minimal dependencies. 60 FPS target on mid-range laptops; works on mobile.
- Only the active location is drawn at full detail; off-screen sites simulate cheaply (pure sim modules) and are culled from rendering.
- Character LOD (§8.5); capped particles; reuse procedural geometry; cached geology.
- Modular separation: config, economy, state, sim, cart, surface/yard, construction, workers, digface, geo, characters (rig), render, fx, audio, music, panel, nav, main (wiring only).

---

## 22. Future Leaderboards (documentation only)
Deepest depth (primary), fastest milestone times, highest production, event records, possibly largest project. Depth stays simulation-authoritative.

---

## 23. Roadmap
| Milestone | Scope |
|---|---|
| **V2-1 (built; awaiting playtest)** | macro loop (truck → construction → sale), navigation + attention, contextual panels, introduction, Construction V1 (Cabin + Two-Story Home), tool yield, character rig + personality idles, worker rest V1 (stairs + rest platform), Worksite Expansion V1 (Narrow Shaft → Work Chamber), Excavator space rule + rescale, recycling visibility, MusicManager |
| V2-2 | Fossil Excavation (discovery, MINE !, excavation team, worker assignment, gradual reveal, big dinosaur, cinematic, sell to collector, persistent site) |
| V2-3 | Active mining events: Critical Vein, Cave-In, Side Cave |
| V2-4 | Industrial progression: drill rig, Industrial Chamber, better logistics, named equipment tiers |
| V2-5 | More construction projects + automation (Foreman, more lots) |
| V2-6 | Deep mystery progression / the Red Door |
| later | museum, second mine, research, prestige (possibly "Expeditions"), leaderboards, CrazyGames/Poki SDK |

---

## 24. V2-1 As Built (implementation notes for the next agent)
- **Sites + camera** (`view.ts`, `nav.ts`): `view.site` + `S.site`; `goSite()` starts an eased tween (0.75 s, 0.35 s if repeated within 2.5 s) from the current camera to the site's live target. MINE target fits the work floor (zooms out and centres for the Work Chamber); YARD frames headframe → truck bay; BUILD frames the plot (zoom up to 1.3). Wheel scroll ("explore") only at the Mine. Canvas clicks only dig at the Mine.
- **Attention** (`nav.ts`): `attention(site)` (red) and `optionalAffordable(site)` (yellow, in `panel.ts`); badges hidden for the current site; `chainStarved()` = yard built, no crew, nothing anywhere in the pipeline.
- **Introduction** (`intro.ts`): `S.tut` 0 LAND · 1 DIG · 2 CART (the cart sim only runs from here) · 3 YARD · 4 RECYCLE · 5 BUILD · 6 DONE. Text lines are a DOM overlay; one follow-hint pill.
- **Construction** (`construction.ts` sim, `site.ts` art): plot along the road right of the yard (`surfaceLayout().plotX0..plotX1`); material stack (left), builders (carry + hammer rigs), building drawn per stage progress (`cabin()` / `home()`), blueprint outline before the first stage, FOR SALE sign, SOLD → sink/dozer cleanup (`CFG.build.soldHoldSecs`, `clearSecs`). After the Two-Story Home is sold it repeats (no Project #3 in V2-1).
- **Truck route** (`surface.ts` sim, `juice.truckPose()`): PARKED → LOADING (≥ 15 blocks) → TO_SITE → UNLOADING (blocks move onto `S.build.material`) → RETURNING (drawn mirrored, cab first) → PARKED. Drawn in front of the plot (`drawTruckLayer`).
- **Workers** (`workers.ts`): per-worker fatigue/rest/idle state machine; paths along the left wall (ladder → stairs → platform); power is shared by whoever is working so resting never changes the analytic rate (`CFG.rest.uptime` is used offline). Visible crew capped per tier (3 / 5); the rest dig unseen ("+N more crew working").
- **Worksite expansion** (`expansion.ts`): purchase saves `S.worksite` immediately; sequence WHISTLE 1.1 s → CLEAR 1.6 s → CHARGES 1.6 s → BOOM (`applyWorksite()` rebuilds the face 260 → 420 wide, 8 → 13 chunks) → SETTLE 2.6 s (supports rise, crew walk to new slots). Input blocked during CLEAR..early SETTLE. Layout positions on the work floor are relative to the centred 260-unit shaft (`layout.ts`: `shaftOff()`, `railX()`, `cartX()`, `pileX()`).
- **Excavator**: `crewAvailable()` requires `worksite ≥ needsTier` (1) and `max` 1; drawn at `CFG.excavatorScale` 1.35 on its own station (`excX` 112, bucket bites at x ≈ 200; diggers at 262/352/392 never overlap it).
- **CharacterRig** (`rig.ts`): `drawRig(x, y, scale, dir, look, pose)`; `lookFor(role, seed)`; poses stand/walk/climb/sit/swing/jack/wipe/helmet/drink/look/hammer/carry/cheer/gesture; LOD < 14 px silhouette, < 30 px medium. Player 1.15 vs crew 1.05 (≈ 1.1×).
- **Music** (`music.ts`): three procedural scores (mine A-minor drone + pulse + bells 84 bpm; yard C pentatonic pads + plucks 72 bpm; build D major arpeggio + bass + shaker 96 bpm) on per-site gain layers, 2.5 s crossfade, duck on big moments; `MUSIC_FILES` asset slots; settings popover (♪ button) persisted in `dth_settings`. Audio buses: SFX (compressor) and music.
- **Save v5** (`state.ts`): adds `site`, `tut`, `worksite`, `build {project, stage, active, used, material, done}`, `stats.sold`; truck states remapped from v4 (old DEPARTING → PARKED; its bed had already been paid for).

---

## 30. Superseded Decisions (do not reintroduce)
- Cash from clicking / breaks / crew / finds (original prototype).
- Purchasable, stackable minecarts (pre-3A).
- 300 m / the Red Door as the end of the game (original slice).
- Scrap Buyer + Scrap Stall seller turning surface stock into a cash drip (Phase 3C).
- **Truck departure paying cash** as the main income (Phase 3C.5) — trucks now deliver blocks to Construction; cash comes from milestones and sales.
- Per-delivery truck colours (golden-angle hues) and a truck that turns around: there is one red truck that always faces the building.
- One universal upgrade panel showing everything (pre-V2) — panels are contextual per site.
- Player drawn ~1.25× a worker with a dark "rim" silhouette behind them (3C.5) — player is ~1.1× with only a contact shadow.
- Central spiral staircase (rejected): worker access runs along the left wall.
- "+N crew" as the only evidence of a large workforce.
- The contractor buying the entire first load (V2 draft): he now buys only the seed money so the yard has material to press immediately.
- Blocking "find" modals (pre-V2): finds are non-blocking banners until V2-2 rebuilds discoveries.
