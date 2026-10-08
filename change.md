# CURRENT STATUS

Active issues: 57
P0: 0
P1: 0
P2: 5
P3: 52

Current focus: P2 — [VISUAL] More life in characters (impact recoil, tempo personality, fatigue)

Reference convergence estimate: 65% (judged on the rendered mine, not the checklist)
Gameplay quality estimate: 64%

Current weakest area: late-game transport pressure (P1, needs a design decision) and the open reference gaps — crew only on the floor level, characters without outlines.

Last full playthrough: 2026-10-06, fresh save, pacing bot 16× for 70 game-min → 1,000 m at 58.2 min, Palace under construction at 65 min, no errors (playtest-captures/full-run/). Previous: 2026-10-05 #2, fresh save, bot 8× for 40 game-min → Yard 223 s, first sale 395 s, Work Chamber 472 s, Excavator 739 s, 300 m. Toast stacking, crew sign, pile label verified in play. (loop/p5_*)

Workflow: one issue at a time → fix → verify in the running game → move to `addressed-changes.md`.

---

## P2 — [PACING] Solo pickaxe can dig to 183 m without engaging the loop
Observed: never building the Yard, the player digs to 183 m in ~15 min; rubble pile 1,342; all finds found.
Expected: depth progress should pull the player into the loop sooner (design question).
Verification: [ ] Not fixed — design decision

## P2 — [REFERENCE GAP] Only the floor level has workers; reference shows crew on 2–3 levels
(needs design decision — workers on upper platforms are new presentation states.)
Verification: [ ] Not fixed

## P2 — [VISUAL] More life in characters (follow-up to the new swing)
Observed: swing now bends/hinges; still missing (vs Miner reference poses: walk/run lean, carry rubble, push cart): impact recoil/shudder through the arms, per-worker tempo personality, walking weight shift, tired workers slowing their swing, idle fidgets between swings.
Proposed fix: add one at a time, verify with the pose sheet + in-game capture.
Verification: [ ] Not fixed


## P3 — [PACING] (was 300 m cap) now 1,000 m; pile capped — re-check end-state feel after a human playthrough
Observed: at 300 m extraction shows "0.0 rubble/s" and the pile shows 25,481; cart still overloaded.
Expected: (design) the end-state should read as a deliberate pause ("deeper arrives later"), not a stalled machine.
Verification: [ ] Not fixed — design decision

## P2 — [ECONOMY] New project ladder values are untuned
Observed: Farmhouse → White House ($6k–$45k, 720–3,800 blocks) were set by feel; one 8× bot run only reached the Farmhouse in 15 min.
Expected: each project lands at a sensible pace against extraction/transport growth. **Design decision → tune with Tejas after playtest.**
Verification: [ ] Not fixed

## P3 — [BUG?] Bot playthrough early dig rate dropped (3.5 m at 60 s vs 10.8 m before)
Observed: p5 bot run; direct real-time click test is fast (9.8 m in 8 s, frame p95 4 ms) and the 8× sim runs at exactly 8×. Laptop on battery during the run. Likely harness noise.
Verification: [ ] Re-run on mains power

---

## Carried over from the convergence change list (still open)
### B. Wall rock — shape & composition (31–65)
- P3 [REFERENCE GAP] 36. Boulder silhouettes: slightly flatter tops (stacked stones sit flat-ish on each other).
- P3 [REFERENCE GAP] 44. Add one variant with a lamp-bracket-friendly flat stone (for future lamp mounts).

### C. Back wall / shaft centre (66–85)
- P3 [REFERENCE GAP] 74. Remove the faint rectangular edges where back-wall clusters overlap the interior clip.

### D. Lighting & lamps (86–125)
- P3 [REFERENCE GAP] 101. Warm light spill onto rock edges ("rim light") within 1.5× radius.
- P3 [REFERENCE GAP] 103. First lamp at ~10 m: make it a distinct "first lamp" with a little bracket and warm glow.
- P3 [REFERENCE GAP] 121. Light reveals ladder rungs near lamps; ladder darker between lamps (fix ladder evenly bright issue).
- P3 [REFERENCE GAP] 122. Rail/track glints near lamps.
- P3 [REFERENCE GAP] 123. Cart metal glints near work lamp.
- P3 [REFERENCE GAP] 124. Worker helmets catch light (small highlight) near lamps.

### E. Timber framing & platforms (126–170)
- P3 [REFERENCE GAP] 126. Add a full timber "level frame" every ~12 m: two posts + cap beam spanning the shaft side bays (not the centre).
- P3 [REFERENCE GAP] 143. Ladder segments switch sides at each level (reference shows ladders between levels) — visual only, existing route kept.
- P3 [REFERENCE GAP] 157. Work Chamber: a raised work platform on one side with ladder.
- P3 [REFERENCE GAP] 162. Spacing between levels varies slightly (11–13 m).
- P3 [REFERENCE GAP] 165. Deep levels (>250 m) use metal I-beams on transport side.

### F. Active dig face (171–215)
- P3 [REFERENCE GAP] 182. Cracks follow stone boundaries where possible.
- P3 [REFERENCE GAP] 189. Add small dirt clods between stones in shallow depths.
- P3 [REFERENCE GAP] 190. Clay depths: smoother, redder face with fewer stones.
- P3 [REFERENCE GAP] 191. Stone depths: blockier stones.
- P3 [REFERENCE GAP] 197. Face rendering cost: cache per material + chunk state.
- P3 [REFERENCE GAP] 207. When a new material layer starts, face shows a mixed transition band.
- P3 [REFERENCE GAP] 208. Iron vein depths: thin glowing orange vein lines in face.
- P3 [REFERENCE GAP] 209. Crystal depths: blue crystal glints in face.
- P3 [REFERENCE GAP] 210. Fossil depths: bone fragment shapes in face (decor only).
- P3 [REFERENCE GAP] 211. Limestone: pale blocky face.
- P3 [REFERENCE GAP] 212. Sandstone: horizontal layered stripes.

### G. Digging effects (216–240)
- P3 [REFERENCE GAP] 231. No fragments flying above the shaft top.
- P3 [REFERENCE GAP] 232. Headlamp-lit dust (dust glows where headlamp hits).
- P3 [REFERENCE GAP] 233. Excavator: bigger dust plume.
- P3 [REFERENCE GAP] 235. Cart departure: tiny dust puff.
- P3 [REFERENCE GAP] 238. Effects respect reduced-motion setting if any.

### H. Cart & rails (241–260)
- P3 [REFERENCE GAP] 251. Rail near lamps glints.
- P3 [REFERENCE GAP] 253. Cart while travelling up: slight sway.

### I. Workers & characters (261–290)
- P3 [REFERENCE GAP] 261. Miners ~10% larger visually (reference miners are bigger relative to shaft).
- P3 [REFERENCE GAP] 263. Bolder dark outline on characters (1–1.5 px).
- P3 [REFERENCE GAP] 270. Workers on platforms: some idle poses at upper levels (visual only, existing rest platform first).
- P3 [REFERENCE GAP] 276. Workers in dark areas still readable (rim light).
- P3 [REFERENCE GAP] 278. Surface workers near recycling: reference shows a worker at the hopper.
- P3 [REFERENCE GAP] 279. Worker idle animation: small breathing bob.
- P3 [REFERENCE GAP] 280. Workers never overlap ladder visually when not climbing.
- P3 [REFERENCE GAP] 282. Worker spacing: avoid 3 miners in one clump (presentation offsets only).
- P3 [REFERENCE GAP] 284. Worker walking dust puffs.
- P3 [REFERENCE GAP] 286. Boots darker.

### J. Surface & opening (291–315)
- P3 [REFERENCE GAP] 293. More pine trees on the left.
- P3 [REFERENCE GAP] 304. Surface shadows under machinery.

### K. Depth progression themes (316–335)
- P3 [REFERENCE GAP] 319. Iron vein band: dark rock with glowing orange cracks.
- P3 [REFERENCE GAP] 320. Limestone band: pale cream blocky boulders.
- P3 [REFERENCE GAP] 321. Sandstone band: layered ochre stripes on boulders.
- P3 [REFERENCE GAP] 322. Crystal band: blue crystal clusters in wall gaps (decor).
- P3 [REFERENCE GAP] 323. Fossil band: bone shapes embedded in wall (decor).
- P3 [REFERENCE GAP] 333. Theme decor density low (1 decor per 10 m).

### L. Work Chamber (336–348)
- P3 [REFERENCE GAP] 340. Chamber: ladder from bay floor to upper deck.
- P3 [REFERENCE GAP] 342. Chamber entry/exit: walls taper smoothly (no hard step).
