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

## How to work with me
- Be opinionated. Tell me when an idea is weak.
- Make focused changes, run the game, check for console errors, verify behavior before saying done.
- After each milestone report: DONE (what works), ISSUES (what's imperfect), NEXT (highest-value next change).
- Keep explanations short.

## Rejected ideas (don't revisit)
GETAWAY.IO, Draw the Getaway, Ghost Heist, Railfront, GRIDFALL (prototyped, wasn't fun), Rust to Glory. All earlier concepts, superseded by this one.

## Later (not now)
Prestige as "Expeditions" through the Red Door with Relics as meta currency, a museum of finds, more depth beyond 300 m, CrazyGames SDK integration (check current official docs when we get there).