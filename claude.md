# Dig to Hell

Browser idle/clicker game for CrazyGames and Poki. Solo dev (Tejas) building with AI assistance.

## Concept
You dig a vertical mine shaft by clicking. Hire crew who keep digging while you're away. Going deeper reveals increasingly absurd buried finds. The core hook is curiosity: "What's down there?"

## Current goal
Build the 0–300 m vertical slice exactly as described in SPEC.md (beat sheet, finds, dig face, interruptions, upgrade arrivals, sounds). NOTHING beyond 300 m exists yet. The slice ends at THE RED DOOR (knock, knock, knock). Target: an 8–10 minute first run with a new beat every 15–40 seconds.

## Design rules (non-negotiable)
- No upgrade exists only as a number. Every purchase must visibly enter the shaft (worker rappels in, cart rolls in, crate drops).
- Every click must feel like impact: WHACK, CRACK, REWARD. Destructible dig face with crack stages per material.
- Never let the player wait more than ~45 s with nothing new happening.
- No random interruption within 20 s of a find or layer change.
- The shaft is a permanent physical history: finds, machines, rails and lights stay embedded in the walls and can be scrolled back up to. This is our moat vs Mr. Mine; protect it.
- Screen shake hierarchy: normal hit almost none, rock break small, upgrade medium, find cinematic.
- Interruptions never punish failure; they only reward success.
- Cosmetic-only monetization later. No pay-to-win, no energy systems.

## Tech
- TypeScript + Vite, HTML5 Canvas 2D. No React for the game. Minimal dependencies.
- All sound synthesized with Web Audio (see SPEC.md section 6). No audio files yet. Randomize pitch ±3–7% on repeated impacts.
- Save to localStorage every 5 s and on unload; wrap in try/catch. Offline crew progress capped at 8 hours.
- All tuning numbers live in one config file (src/config.ts). Never scatter magic numbers.
- Must hit 60 FPS on mid-range laptops and work on mobile (touch to dig, panel stacks below the canvas under 760px).
- Existing prototype: dig-to-hell.html (single file). Port its logic, then rebuild visuals to the spec.

## Economy (from the prototype, tune to match the SPEC pacing)
- Hardness at depth d: (1 + d/20)^2. Value per meter: hardness × (1 + d/1000).
- Crew costs scale ×1.15 per purchase. Each find gives +10% digging (or the bonus listed in SPEC.md).
- Pacing targets come from the SPEC beat sheet. If they conflict with the formulas, change the formulas.

## Build order (stop and let me playtest after each)
1. Port the prototype to TypeScript + Vite with config file. Same behavior.
2. Destructible dig face + impact juice + Web Audio hit/break sounds. (Most important: if clicking isn't satisfying alone, stop and fix it.)
3. Finds as animated reveal events, in beat-sheet order.
4. Upgrade arrival animations + evolving shaft (rails, lights, supports).
5. Interruptions (Gold Vein, Cave-In, Critical Pocket, Gas Pocket).
6. Layer transitions, ambience, the Red Door ending.

## Status log
- Step 1 (port to TS + Vite): `e4d758d`
- Step 2 (destructible face, juice, Web Audio, economy retune): `fc51a70`
- Step 2.5 (polish the click loop): `72800ed`

### Step 2.5 — what changed
- Face reads as one mass of earth: no chunk outlines, a shared face-space gradient that fades into the surrounding ground, shared seam tops (continuous lit lip), dark inner earth revealed only by craters. Breaks leave a bowl-shaped crater + soft dark reveal that settles. Whole-chunk flash/flinch/squash removed (they exposed the tile grid) and replaced with a local impact pulse at the hit point.
- Popup hierarchy: hit = small/faint/short; break = one combined `+$X / ▼ m` label; crit = large gold with pop. Crew cash aggregated into one faint popup every 3 s. Max 6 popups on screen.
- Crew: max 3 animated diggers (2 when an excavator is present); extras dig at full DPS and show as a helmet row "+N crew". Randomized phases/periods, no lockstep. Crew FX ~60% of player's, crew audio 0.2 volume.
- Player miner: 1.12× scale, brighter helmet, lamp beam, dark rim. Pick reach scales with size so the tip lands on the hit point on the impact frame.
- Camera: face at 71% of viewport, shaft wider (max 400 px), shaft darkens upward, warm work light pools on the face. Continuous shaft kept.
- Audio: heavier 55 Hz thump on breaks, extra hard transient on crits.
- Files: config.ts, digface.ts, render.ts, sim.ts, miner.ts, fx.ts, juice.ts, audio.ts, main.ts, panel.ts.
- Tuning changes (config.ts): faceYFrac 0.62→0.71, shaftMaxW 320→400, shaftWFrac 0.42→0.46, crewVisibleMax 5→3, crewScale 0.88→0.85, playerScale 1.12, crewFxScale 0.6, AUDIO.crewVolume 0.28→0.2, impulse.hit 0.6→0.3, impulse.crit 2.2→2.1, critFx.starSecs 0.16→0.1, dentPx 3.2→4.5. Economy untouched.

### Measurements (Step 2.5, headless Chrome on the dev machine)
- Pacing at 4 clicks/s, real-time browser bot: 12 m 27.5 s, 20 m 46.4 s, 45 m 86.4 s (unchanged from Step 2). Headless sim: 300 m ≈ 6:15.
- Frame work at the 700-particle cap (8 diggers, every hit a crit): p99 2.6 ms desktop, 8.6 ms at 4× CPU throttle, 16.1 ms at 6×. Isolated single-frame spikes up to ~100 ms seen under throttling (suspected GC, not investigated).

### Compromises / known visual problems
- Hits land ~72 ms after the click (windup + downswing) to keep animation and sim in sync.
- Shaft above the face is still mostly empty dark space; it is meant to fill with finds/equipment history in later steps.
- Mobile: figures and face are small (stage is only 56% of the screen height); "Something is down here…" find tease is off-screen on narrow widths.
- Excavator can overlap the player miner when the player digs on the right side.
- Cracks are clipped per chunk, so a crack can stop at an invisible chunk boundary.
- Finds still use the placeholder modal (pauses digging). Offline progress can skip most of the slice (4 diggers × 1 h ≈ 244 m) — needs a cap at the next find/layer before Step 3 ships.
- Sounds verified only as error-free, not by ear.

### Recommended next step
Step 3: turn the 12 m Rusty Coin and 45 m Buried Car into real animated discoveries (and cap offline progress at the next find).

## How to work with me
- Be opinionated. Tell me when an idea is weak.
- Make focused changes, run the game, check for console errors, verify behavior before saying done.
- After each milestone report: DONE (what works), ISSUES (what's imperfect), NEXT (highest-value next change).
- Keep explanations short.

## Rejected ideas (don't revisit)
GETAWAY.IO, Draw the Getaway, Ghost Heist, Railfront, GRIDFALL (prototyped, wasn't fun), Rust to Glory. All earlier concepts, superseded by this one.

## Later (not now)
Prestige as "Expeditions" through the Red Door with Relics as meta currency, a museum of finds, more depth beyond 300 m, CrazyGames SDK integration (check current official docs when we get there).