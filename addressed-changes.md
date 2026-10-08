# Dig to Hell — Addressed Changes (permanent record)

Items moved here from `change.md` once verified in the running game. Do not redesign these without a new, specific reason.

## [2026-10-05 / visual convergence pass] Mine vs reference change list — completed items
- Original problem: mine presentation ~45% match to the Visual Reference Sheet (dark flat walls, slab dig face, sparse timber/lamps, orange FX, weak depth themes).
- Resolution: see item list below (rock palette/value, panel boulders, stony dig face, lamp density/halos/floor lamps, timber details, cart/labels, FX palette, chamber bays, surface tweaks, interlocking depth themes). Files: src/bedrock.ts, src/rockwall.ts, src/render.ts, src/minelight.ts, src/juice.ts, src/draw.ts, src/art.ts, src/landscape.ts, src/yard.ts, src/rig.ts, src/fx.ts.
- Verification: typecheck + build; captures in playtest-captures/mine-architecture/changelist_*.png (40 m floor, depth strip 30/100/180/270 m, chamber after digging 56 m deeper + reload, 400 px mobile); Yard/Build regression frames; frame time 4.1 ms median at 60 fps; no console errors.

### A. Wall rock — value & colour (1–30)
- 1. Raise wall `mid` base value ~25% (reference walls are mid-brown, not near-black).
- 2. Raise wall `shadow` value ~15%; keep `crev` near-black.
- 3. Make `crev` slightly warm (reddish black), not neutral black.
- 4. Reduce the back-row `dimPal` darkening from 0.55 to ~0.75.
- 5. Reduce outer-row (u > 90) darkening from 0.45 to ~0.6.
- 6. Add a subtle warm "ambient bounce" tint to all wall rocks (+5% red) so unlit rock still reads brown.
- 7. Lower the depth-darkness overlay over wall bands (`drawWallDepthRamp`) by ~30%.
- 8. Global mine darkness `DARK` 0.7 → ~0.6, but only over the wall bands (keep shaft centre dark).
- 9. Per-boulder value jitter ±8% so neighbours separate without seams.
- 10. Saturate lit stone slightly (reference amber is richer orange-brown).
- 11. Add a 2-tone top highlight (thin warm band) on the upper edge of every main-column boulder, not only lit ones.
- 12. Reduce grey tint in stone layer; reference "rock" layer is warm grey-brown, not cool grey.
- 13. Clay layer rocks: push redder (reference clay tile is red-orange).
- 14. Ensure the earth texture behind outer rows doesn't show through (fill rock mass band fully).
- 15. Rock mass band colour from `back` → one step lighter for readability.
- 16. Check rocks in tiles (unlit cache) vs lit redraw: no visible value pop where a rock enters a lamp's reach.
- 17. Fade the lit-redraw in by distance instead of the hard `nearLight` threshold.
- 18. Remove any remaining cool/blue cast in deep layers below 200 m.
- 19. Unify the floor-bed palette with the wall palette at the same depth.
- 20. Rubble pile chunks use the same mid values as the wall (currently darker).
- 21. Face chunks' `face` colour: darken top lip less (reference top is lighter, stony).
- 22. Add very subtle per-panel hue variation (some panels warmer, some cooler) by depth hash.
- 23. Remove the leftover texture speckle on wall band where it reads as noise.
- 24. Contact shadow alpha 0.62 → 0.5 (rocks currently sit in heavy black halos).
- 25. Contact shadow offset smaller (0.05w/0.1h → 0.03/0.07).
- 26. Add soft dark gradient where wall meets the open shaft (inner cut) — confirm it's visible but narrow.
- 27. Painterly sheen strength up a little on unlit rocks (0.1 → 0.14).
- 28. AO gradient on boulder bottoms: 0.5 → 0.4.
- 29. Make 1 in ~6 boulders a lighter "hero" tone so walls have focal stones.
- 30. Recapture and compare greyscale value histograms with reference crop; target similar median.

### B. Wall rock — shape & composition (31–65)
- 31. Main-column boulders: increase size another ~20% (reference ~1 worker-height tall).
- 32. Reduce main-column count per panel (fewer, bigger).
- 33. Ensure each panel has 1 "anchor" boulder ≥1.5× the others.
- 34. Small filler stones: reduce count from 6 → 3–4 per panel.
- 35. Fillers only in gaps between boulders, never on top of a boulder face.
- 37. Stack boulders with visible "resting" contact (upper stone overlaps lower by ~15%).
- 38. Alternate boulder horizontal offset so the column zig-zags slightly.
- 39. Shaft-facing silhouette: allow 1 boulder per panel to protrude 10–15 px into shaft.
- 40. Never let protruding boulders overlap ladder/rail/cart lanes (check left 42–60, right 200–260 logical).
- 41. Panel variants: expand 8 → 10 for less repetition.
- 42. Add one variant with a large crack running through two boulders.
- 43. Add one variant with a dark recess/cavity between boulders.
- 45. Mirror variants left/right properly (currently only lean flips).
- 46. Make right wall panels differ from left at same depth (different hash already — verify visually).
- 47. Smooth panel seams every 8 m (no visible horizontal break line).
- 48. Outer rows: bigger and rounder but lower contrast (they are background).
- 49. Outer rows: fewer internal cracks.
- 50. Remove plane "facet" visibility on outer rows (flat shaded is fine there).
- 51. Main column: 3–4 planes only (rounder read than 5–6).
- 52. Cracks: max 1 per boulder, only on anchor/hero boulders.
- 53. Remove the white-ish rim accents on very small stones.
- 54. Rock silhouettes: no concave notches (reference stones are convex).
- 55. Avoid perfectly horizontal boulder bottoms (tilt 2–5°).
- 56. Boulder aspect: mostly wider than tall (1.2–1.6:1).
- 57. Near shaft opening (0–9 m), panels start with medium stones growing to full size — check transition isn't abrupt at 9 m.
- 58. Panels inside the Work Chamber depth range: hidden — verify no half-boulders cut off at the clip line; add a ledge stone at the cut.
- 59. At the chamber top/bottom clip, place 1–2 boulders that straddle the line to hide it.
- 60. Below the floor: wall rock reveal limit — make the cut irregular (not a straight horizontal clip).
- 61. Wall tiles: increase OUT_W only if screen still shows earth at max zoom-out; verify at 1920 wide.
- 62. Verify wall coverage at narrow mobile width (400 px).
- 63. Check that the "Something is down here" find tease text sits over rock legibly (add dark backing).
- 64. Buried car find: embed it into the wall rock (rocks overlap its edges).
- 65. Coin find marker: place inside a rock crevice, not floating.

### C. Back wall / shaft centre (66–85)
- 66. Back wall stones: slightly bigger and fewer (current mid-size grid can read as cobblestone).
- 67. Back wall value: barely visible away from lamps (keep), but visible as warm stone within lamp pools.
- 68. Back wall: add 2–3 long horizontal strata lines per 30 m (reference has layered back rock).
- 69. Back wall darker toward the top of the screen (depth recession).
- 70. Centre of shaft: keep empty — no rocks crossing the middle 40%.
- 71. Add faint vertical "drill/pick marks" texture on back wall near the floor.
- 72. Back wall stones behind the rest platform: lit by rest lamp.
- 73. Back wall behind work lamp: strongest reveal.
- 75. Back wall in chamber: same stones, warmer.
- 76. Interior clip edge (`drawInnerCut`) — make it softer (wider, lower alpha).
- 77. Shaft-top dark mouth gradient: shorten so the first metres show the back wall.
- 78. Back wall below 200 m: slightly cooler/greyer for depth feel.
- 79. Back wall drawn with lit < 0.5 skips sheen — confirm it still reads round enough.
- 80. Add very subtle dust motes in lamp pools (≤10 particles, slow).
- 81. Add drip/water stain streaks on back wall at random depths (2 per 50 m).
- 82. Make back wall continuous across the Work Chamber (wider).
- 83. No back wall above ground (verify at 0–2 m).
- 84. Back wall must not cover the depth labels.
- 85. Recapture centre-shaft crop; it should read "dark rock", not "black hole".

### D. Lighting & lamps (86–125)
- 86. Increase structural lamp light radius ~25% (reference pools are wider).
- 87. Increase lamp halo size (visible glow circle around bulb, reference has strong halos).
- 88. Lamp bulbs: warmer yellow core, orange outer ring.
- 89. Add more lamps: aim for one every ~6 m alternating walls (reference density), still structural.
- 90. Every lamp hangs from timber with a visible chain/cable + cap.
- 91. Lamps on posts: bracket arm visible.
- 92. Light should warm timber within radius strongly (beams glow orange near lamps).
- 93. Platform decks near lamps: lit top surface band.
- 94. Active floor: add 2 more floor-level work lamps (reference has lamps near miners at floor).
- 95. Floor work light pool wider, covering cart and pile.
- 96. Rest lamp: larger warm pool, cozy.
- 97. Rest lamp fixture: hanging lantern instead of bare bulb.
- 98. Reduce darkness between lamps on walls only (centre stays dark).
- 99. Lamp flicker: very subtle intensity wobble (±3%, slow).
- 100. Light pools slightly elliptical (wider than tall) to hug walls.
- 102. Ensure no lamp above ground (keep the 10 m / 4 m rules).
- 104. Daylight shaft: soft sunbeam wedge from the opening down to ~12 m.
- 105. Sunbeam fades out with depth and at night.
- 106. Night: surface darker; mine lamps unchanged.
- 107. Headlamps: keep weak; add tiny bright dot on helmet lamp.
- 108. Headlamp patch on the face where pick lands: warm, small.
- 109. Impact flash lights nearby rock for 0.1 s.
- 110. Work Chamber bay lamps: larger pools, warmer.
- 111. Chamber lamps hang from cap beams with chains.
- 112. Lamp light should not tint UI text (labels).
- 113. Remove remaining orange "wedge" artefacts from back-wall planes facing lamps.
- 114. Lamp light falloff curve: smoother (no visible ring edge).
- 115. Light pool colour: amber (#ffb35a-ish), not yellow-white.
- 116. Darkness mask resolution 0.5 → 0.75 if edges look blocky on hi-dpi.
- 117. Lamp halo additive only around bulb (no big circle).
- 118. Excavator light: match lamp colour.
- 119. Depth-darkness should increase gradually per 100 m (reference: "descent gets darker").
- 120. Below 250 m, lamps slightly redder.
- 125. Recapture lit-wall crop; compare to reference lit-wall area.

### E. Timber framing & platforms (126–170)
- 127. Left side: posts at wall + ladder side, connecting levels vertically (reference has continuous posts).
- 128. Right side: same posts beside the transport lane.
- 129. Every work ledge gets a deck with plank lines and thickness.
- 130. Deck planks: visible gaps between boards.
- 131. Deck front edge: lighter top line.
- 132. Under each deck: diagonal brace into wall rock.
- 133. Railings on decks: top rail + 2 posts, simple.
- 134. Posts meet rock with a foot block + contact shadow.
- 135. Beam ends sink into rock (dark pocket).
- 136. Timber colour: warmer/brighter orange-brown (reference timber is bright).
- 137. Timber outlines: dark brown outline 1 px (reference has crisp outlines on wood).
- 138. Wood grain: 1–2 lines per beam, subtle.
- 139. Bolts/nails at joints (2 dots).
- 140. Avoid long beams across the shaft centre (keep centre open).
- 141. Transport guide post: add cross ties every level (lighter).
- 142. Ladder: rails thicker, rung spacing consistent, ladder top meets a deck.
- 144. Ladder base on deck/floor with small foot block.
- 145. Rest platform: wooden plank deck, posts down to floor, railing on open side.
- 146. Rest platform sign: framed wooden board "REST 0/3" with nails.
- 147. Rest platform: bench with backrest.
- 148. Rest platform: water barrel + small crate (reference has props).
- 149. Stairs: stringers thicker, treads with outline.
- 150. Stair handrail: thicker wood.
- 151. Collar at surface: heavier cribbing frame, two posts each side.
- 152. Headframe: thicker legs, yellow-painted crossbars (reference headframe is warm wood + machine).
- 153. Headframe wheel: bigger, with spokes.
- 154. Cable from wheel to cart visible and taut.
- 155. Shaft-side timber lining near surface (first 6 m): vertical boards behind ladder.
- 156. Work Chamber: cap beams across bays with posts both sides (reference chamber frame).
- 158. Work Chamber: lamps on cap beams.
- 159. Wood lit by lamps: warm; unlit: dark brown (not black).
- 160. Remove floating wood bits (verify every beam has support).
- 161. Lamp-carrying wall caps: bigger blocks.
- 163. Upper levels (older) slightly more weathered (darker wood).
- 164. Deep levels (>150 m) use steel-banded timber.
- 166. Platforms never overlap the cart lane.
- 167. Platforms never overlap the ladder rungs.
- 168. Timber z-order: in front of wall rock, behind workers.
- 169. Timber gets contact shadows on rock behind.
- 170. Recapture section shot; shaft should read "framed mine", rock still dominant at edges.

### F. Active dig face (171–215)
- 171. Face top edge: bumpy, stony silhouette (reference irregular rocky top).
- 172. Embed small/medium stones along the face top edge (partly buried).
- 173. Face body: stony texture (pebbles/cobbles) instead of smooth soil gradient.
- 174. Face colour follows geology but lighter than walls (it's freshly exposed).
- 175. Face top lip highlight warm.
- 176. Face lower part fades into floor bed rocks (no hard horizontal edge).
- 177. Damage state 1 (intact): stones + soil, no cracks.
- 178. State 2: thin cracks radiating from impact.
- 179. State 3: larger cracks, chunk outlines visible.
- 180. State 4: chunks separated with dark gaps, pieces tilt.
- 181. Crack colour: dark brown, not black.
- 183. Break moment: chunk drops 2–3 px before vanishing.
- 184. After break, new surface briefly lighter (fresh rock), fades in 1 s.
- 185. Rubble lying on top of the face near workers (small stones).
- 186. Face chunk seams: hide straight vertical seams (offset with stones).
- 187. Remove grey slab look in stone layer (warm it).
- 188. Face width matches shaft; edges tucked under wall rock.
- 192. Face texture world-anchored (doesn't slide while camera eases).
- 193. Damage cracks fade before the bottom of the face band.
- 194. Impact point: small dark dent.
- 195. Crit hit: bigger crack star + brief warm flash.
- 196. Excavator bites: larger chunk removal visual.
- 198. Face top edge must still match click targets (no gameplay change).
- 199. Workers' feet stand on the face top (adjust visual surface y by ≤2 px if needed, not gameplay).
- 200. Floor bed under face: fewer, larger stones, darker.
- 201. Remove the semi-transparent grey band under the face (reads as fog).
- 202. Floor bed transitions into black only far below (below screen bottom).
- 203. Fresh face below the floor visible ~1 face-height only.
- 204. Half-buried floor stones: 2–3 visible, not in worker spots.
- 205. Chips on floor: brown, not orange.
- 206. Face material label hidden (no text on face).
- 213. Face "something down here" tease: subtle glint in face.
- 214. Face dark crater gradient: reduce opacity.
- 215. Recapture face crop vs reference "active dig face variations" panel.

### G. Digging effects (216–240)
- 216. Impact spark: short bright yellow star, 4–6 rays.
- 217. Sparks: orange-yellow, fall with gravity, fade in 0.3 s.
- 218. Rock fragments: angular brown chips (not orange circles).
- 219. Fragment colour from geology, slightly lighter.
- 220. Fragment count 2–6 per hit.
- 221. Fragments bounce once on floor.
- 222. Dust cloud: warm beige, soft, expands and fades (0.6 s).
- 223. Dust only near impact (no full-screen haze).
- 224. Crit: extra dust ring + bigger sparks.
- 225. Break: burst of 8–10 fragments + dust.
- 226. Rubble pile grows with visible chunk landing.
- 227. Rubble pile chunks: angular, brown, varied size.
- 228. Pile base shadow.
- 229. Pile count label: dark pill backing.
- 230. Fragments drawn before darkness layer (already) — verify colour not orange.
- 234. Cart loading: small rock clatter particles.
- 236. Track strain: small sparks at wheels (existing) — warm colour.
- 237. Blast (chamber): big warm flash then dust fill, then settle.
- 239. Particle cap to protect perf.
- 240. Recapture effects frame vs reference effects panel.

### H. Cart & rails (241–260)
- 241. Cart: grey metal body (reference cart is steel grey).
- 242. Cart: darker rim, rivets.
- 243. Cart: heaped rubble visibly above rim when full.
- 244. Cart: bigger (~1.2×) visually, same gameplay rect.
- 245. Cart wheels: dark with hubcap highlight.
- 246. Cart contact shadow on floor.
- 247. Cart sits on visible rail piece at floor.
- 248. Floor rails: two rails + sleepers at the loading spot.
- 249. Vertical rail: thinner, darker, less dominant (currently lattice is busy).
- 250. Rail lattice/brace: simplify to every 3 m.
- 252. Cart count label "4/50": dark backing pill.
- 254. Cable from headframe visible the whole way.
- 255. Cart lamp? (no — keep simple).
- 256. Track tier visuals: wood → steel looks distinct.
- 257. Overloaded cart: rocks spill over edge.
- 258. Cart at surface tips into hopper with rocks falling.
- 259. Cart z-order in front of wall rock.
- 260. Recapture cart crop.

### I. Workers & characters (261–290)
- 262. Orange hi-vis vests more saturated with white stripes.
- 264. Helmet: yellow with a lamp disc.
- 265. Helmet lamp: small glowing dot.
- 266. Faces: simple, readable eyes.
- 267. Pickaxe: grey head, wooden handle, clearer silhouette.
- 268. Swing arc trail: subtle (currently white arcs are strong).
- 269. Worker contact shadows.
- 271. Resting workers sit on bench properly.
- 272. Climbing workers: hands on rungs.
- 273. Worker colour variety: shirt colours from a warm palette.
- 274. Player distinguished by brighter vest (keep 1.1×).
- 275. Workers lit by lamps (warm tint near lamps).
- 277. Contractor at surface: reference-style cap + vest.
- 281. Worker feet not sinking into face.
- 283. Tired worker: small sweat drop icon.
- 285. Helmet colour variants (yellow, white, orange).
- 287. Gloves visible.
- 288. Excavator: yellow body, matches reference machinery colour.
- 289. Excavator outline + shadow.
- 290. Recapture worker crop.

### J. Surface & opening (291–315)
- 291. Surface sky: more saturated blue gradient.
- 292. Mountains: bluer far range + greener near range (reference).
- 294. Grass line: brighter green with tufts.
- 295. Soil under grass: warmer brown strip.
- 296. Headframe: wooden A-frame + wheel, warm.
- 297. Recycling building: yellow frame, sign "RECYCLING" readable.
- 298. Conveyor from hopper: dark belt with rollers.
- 299. Hopper: grey metal.
- 300. Machinery: yellow-orange accents.
- 301. Shaft opening: wooden collar planks both sides.
- 302. Opening edge: soil lip with small stones.
- 303. No big boulders on surface (keep).
- 305. Sun position consistent with light direction (upper-left).
- 306. Clouds: softer, fewer.
- 307. Surface fence near yard.
- 308. Day/night tint subtle.
- 309. Opening first 3 m daylight-lit soil walls.
- 310. Transition 3–12 m: daylight fades to lamp light.
- 311. Surface ground across shaft: no dark seam.
- 312. Contractor's truck scale consistent.
- 313. Yard visible on the right at mine view top.
- 314. Logo/title area not covered by UI (n/a in game) — skip.
- 315. Recapture surface frame vs reference top strip.

### K. Depth progression themes (316–335)
- 316. Surface soil (0–10 m): brown with roots and pebbles.
- 317. Clay band: red-orange rock panels.
- 318. Rock band: warm grey-brown boulders.
- 324. Theme transitions: 3–5 m mixed zone with pockets of both.
- 325. Theme palette table in one place (config) — visual only.
- 326. Each theme overrides: rock pal, face texture, fragment colour, dust colour.
- 327. Themes only where current MATERIALS exist; others stubbed for future.
- 328. Gauge (right side depth bar) colours match themes.
- 329. Theme banner text on entering new layer (existing) — warm styling.
- 330. Deeper = darker baseline per theme.
- 331. Rubble colour follows theme.
- 332. Blocks at yard keep colour of source theme (existing mix) — verify.
- 334. Decor never on the active face (only walls).
- 335. Recapture one frame per theme for a strip like reference "depth progression".

### L. Work Chamber (336–348)
- 336. Chamber walls: same panel rock, wider.
- 337. Chamber ceiling: rock with cap beams under it.
- 338. Chamber lit warmer (it's a work space).
- 339. Chamber floor: rock ledges with plank decks on bays.
- 341. Chamber: one crate + barrel prop.
- 343. Below chamber: shaft continues at normal width (already).
- 344. Work pocket at floor: reads as low wide cut, not a dark box (lighten its fill).
- 345. Work pocket ceiling: rock edge with stones.
- 346. Chamber visible when scrolling — verify at several depths.
- 347. Chamber lamps on chains.
- 348. Recapture chamber vs reference "work chamber example".

### M. UI inside the mine & readability (349–360)
- 349. Depth labels on right: light text with dark shadow, readable on rock.
- 350. Depth tick marks: small, consistent.
- 351. REST sign styled as wooden board (see 146).
- 352. Pile/cart counters: rounded dark pill, white text.
- 353. Find tease text: dark backing, not over bright lamp.
- 354. Find banners: don't overlap the nav bar.
- 355. "Found" banner fades fully (currently faint ghost text lingers).
- 356. Right gauge: thinner, themed colours, current-depth marker clearer.
- 357. Music button contrast on dark mine.
- 358. Nav bar readable over sky and rock.
- 359. Toasts don't cover the work floor.
- 360. Final: full-mine screenshot side-by-side with reference; re-score Section 1 table.

## [2026-10-05 / improvement loop] P1 — [UX] Construction toasts overlap each other
- Original problem: at ~270 m three toasts ("Landscaping complete +$345", "Two-Story Home complete", "Foundation started") draw on top of each other under the nav bar; text is unreadable.
- Resolution: Toasts are stacked by their real rendered height (6 px gap) instead of a fixed 54 px step; at most 3 live at once (the oldest is dropped).
- Files: src/toast.ts
- Verification: Running game: 4 toasts fired in a row → 3 shown at y 67–134, 140–181, 187–240 (no overlap); oldest removed.

## [2026-10-05 / improvement loop] P1 — [UX] Stalled construction gives no direction
- Original problem: Build shows "Building Foundation… 18/30 • waiting for the next delivery" with 11 blocks at the yard (truck leaves at 15) and nothing dug. No badge/hint points the player back to the mine.
- Resolution: When the plot runs dry the Build panel now names the real bottleneck: blocks on the way / truck loading / press making blocks (n/15) / rubble on its way up / 'dig more at the MINE — the truck leaves with 15 blocks (n at the yard)'.
- Files: src/panel.ts (supplyNote)
- Verification: Running game, seeded stall states: no rubble → 'dig more at the MINE — the truck leaves with 15 blocks (11 at the yard)'; raw in hopper → 'the press is making blocks (13/15 for the next truck)'.

## [2026-10-05 / improvement loop] P2 — [VISUAL] Pile/cart counter labels drawn under workers
- Original problem: pile number "1074"/"20281" is partially hidden behind a worker's head.
- Resolution: The rubble-pile counter is drawn after the crew AND the player, so it is never hidden behind a worker.
- Files: src/render.ts
- Verification: Running game, 21-crew save at 273 m: '5253' pill drawn over the player's head, fully readable (loop/deep2c.png).

## [2026-10-05 / improvement loop] P2 — [UX] "+18 more crew working" floating text
- Original problem: with many diggers a white text "+18 more crew working" floats over the rest area; reads as debug text.
- Resolution: The overflow-crew count is now a small wooden board above the rest nook ('+18 crew on shift'), not floating white text.
- Files: src/render.ts (drawReserve)
- Verification: Running game, 21-crew save: board visible above the rest platform (loop/deep1.png).

## [2026-10-05 / improvement loop] P2 — [VISUAL] "0 blocks on site" label hidden behind builders at BUILD
- Original problem: the blocks-on-site label overlaps the builders and is cut off ("blocks on sit").
- Resolution: The plot's block count is one pill ('N blocks on site'), drawn after the builders so they never cover it; the mine's find tease is now only shown when its find is on screen (it no longer appears on the BUILD view).
- Files: src/site.ts (drawStackLabel), src/render.ts (tease visibility)
- Verification: Running game: BUILD with 9 blocks delivered → '2 blocks on site' pill above the plot, builders beside it, fully readable (loop/site_c.png).

## [2026-10-05 / improvement loop] P2 — [VISUAL] Dig face crack "spiders" read as black scribbles
- Original problem: radial/branching cracks are near-black, thick, and stack into spider shapes over the warm face.
- Resolution: Face cracks use the bedrock crevice colour (dark warm brown at 80%) instead of near-black ink, are 25% thinner, and get only a faint warm lit edge (no white highlight).
- Files: src/render.ts (drawCracks)
- Verification: Running game at 40 m and 150 m with crew digging: cracks read as fractures in the warm stone, no black scribbles (loop/crack_c.png).

## [2026-10-05 / improvement loop] P2 — [WORLD LOGIC] Player stands inside the Excavator
- Original problem: in the Work Chamber with the Excavator (p5 at 300 m) the player character is drawn over/inside the excavator's body and boom.
- Resolution: When choosing where to stand for a strike, the player avoids the Excavator's footprint (its actual position ± 52×scale): first by taking the other side of the hit point, and if both sides are under the machine, by standing just outside its nearest edge facing the hit. Strike/chunk logic unchanged (presentation of the stand position only).
- Files: src/miner.ts
- Verification: Running game, Work Chamber + Excavator at x=112: direct strikes at x 120/150/170/190 → stand 184/184/192/211 (all outside 42–182); capture shows the player beside the bucket, not inside the machine (loop/exc_c.png).

## [2026-10-05 / improvement loop] P2 — [WORLD LOGIC] Delivery truck parks over the builders and the plot
- Original problem: at BUILD the red truck stops on top of the builders (builders appear inside the cab) and in front of the plot.
- Resolution: The plot's working layer (block stack, scaffold, builders, block-count pill) is drawn after the delivery truck, so the truck never hides the builders or the stack while it unloads. Park position unchanged (bed still lines up with the stack).
- Files: src/site.ts (drawSiteFront), src/render.ts
- Verification: Running game, truck forced to UNLOADING at BUILD: builders stand in front of the cab, stack + '16 blocks on site' visible (loop/truck_c.png).

## [2026-10-05 / improvement loop] P1 — [VISUAL] Miners swing like stiff puppets (user request: "bending like real life, hitting like real life, more life")
- Original problem: the pick swing only rotated the arm + pick around a fixed shoulder; legs, hips and torso barely moved (lean ≤ 0.1 rad), crew swung on the player's 72 ms snap timing.
- Resolution: whole-body swing driven by the pick angle — wind-up arches the back and lifts the weight onto the back foot; the strike hinges the torso forward at the hips (up to ~0.6 rad), the knees bend into a crouch (hips drop ~3.4 units), the head nods toward the target; both arms are 2-link IK on a two-handed grip that slides up the handle; legs are IK with feet planted. The pick head still lands exactly on the original impact point (no gameplay change). Crew get a human rhythm (0.42 s wind-up, 0.11 s strike, 0.35 s rise) ending on the same strike frame; the player keeps the fast responsive wind-up but now holds the impact for a beat and rises back over 0.26 s. Breathing at rest.
- Files: src/rig.ts (armIK, legIK, pickaxe, 'swing' pose), src/render.ts (crewAngle), src/miner.ts (swingAngle follow-through), src/config.ts (recoverMs 260, presentation only).
- Verification: pose sheet across angles (playtest-captures/mine-architecture/swing_pose_sheet.png) — head lands on the impact marker at a=1.05; in-game 40 m with 4 crew (swing_in_game.png); click test 10 m in 8 s, frame p95 3.6 ms; typecheck + build clean.

## [2026-10-05 / improvement loop] P2 — [REFERENCE GAP] Characters don't match the Miner character reference sheet
- Original problem: miners wore plain blue/green shirts and dark trousers, small grey-yellow helmets, no outlines; the player was a red shirt; roles didn't share one look.
- Resolution: one shared work outfit from the Miner reference for player, miners, builders and yard hand — khaki shirt with rolled sleeves (bare forearms), orange hi-vis vest with shoulder-open front, two reflective bands and a chest pocket, blue jeans with dark knee pads, chunky brown boots with soles, brown work gloves, tool-belt pouches, yellow hard hat (bigger dome + brim, ridge, shine) with a glowing helmet lamp, beards on most miners (player has a full beard), heads 14% bigger for chunky proportions, torso shaded (back side darker, lit front edge), dark ink outline (~1.6 screen px) on every body part. Contractor keeps his cap/jacket but gets jeans + boots. Builders keep white/yellow hats. Poses/animation unchanged (the new whole-body swing carries over).
- Files: src/rig.ts (Look: kneePads/rolled, palettes, lookFor, seg/inked outlines, boot/knee/glove, torso, head/helmet, OL per LOD).
- Verification: character sheet (playtest-captures/mine-architecture/character_sheet.png), mine at 40 m with crew (characters_in_game.png), BUILD crew (characters_build.png); typecheck + build; no console errors.

## [2026-10-05 / improvement loop] Character look backlog — 50 todos vs the Miner reference sheet
- Original problem: characters 'okayish' vs the Miner reference: ball heads, dot eyes, flat torso, plain limbs, no animation life details.
- Resolution (all 50, src/rig.ts + fatigue hookup in src/render.ts):
  - C1. Head: squarer jaw + rounder cranium (face reads as a tough worker, not a ball)
  - C2. Eyes: white + dark pupil, larger, placed under the brim
  - C3. Eyebrows: thick, slightly angled (focused look)
  - C4. Nose: bigger, rounded, with a shadow under it
  - C5. Mouth: short dark line (set mouth), visible through stubble
  - C6. Ear: inner shade + outline
  - C7. Face shading: shadow on the back half of the face (light from the lamp/front)
  - C8. Beard: jagged textured edge, darker than hair, follows the jaw
  - C9. Sideburns: hair strip from helmet to beard
  - C10. Hair at the nape under the helmet
  - C11. Helmet: chin strap
  - C12. Helmet: brim casts a shadow band on the forehead
  - C13. Helmet: lamp band/strap around the dome
  - C14. Helmet: scuffs and dirt specks
  - C15. Helmet: lit rim highlight along the dome
  - C16. Shoulders: broader, rounded shoulder caps
  - C17. Vest: shoulder straps visibly over the shirt
  - C18. Vest: front zip/seam line + darker side panel
  - C19. Shirt: collar flaps at the neck
  - C20. Vest: dirt smudges near the hem
  - C21. Neck: thicker, with shadow under the jaw
  - C22. Torso: slight barrel chest shape
  - C23. Belt: bigger buckle with highlight
  - C24. Tool belt: hammer handle hanging from the side pouch
  - C25. Radio/clip on the vest (small detail)
  - C26. Rolled sleeve: khaki cuff band at the elbow
  - C27. Forearms: thicker toward the wrist
  - C28. Gloves: bigger with a cuff
  - C29. Gloves: thumb shape
  - C30. Arms: lower side darker (shading)
  - C31. Jeans: inner shading + darker seam on the shin
  - C32. Jeans: hem cuff over the boot
  - C33. Knee pads: strap + highlight
  - C34. Boots: toe cap highlight + laces/tongue
  - C35. Legs: thicker thighs
  - C36. Stance: feet a little wider apart when standing/swinging
  - C37. Idle: chest breathing (subtle torso scale)
  - C38. Walk: head bob + stronger arm swing + forward lean
  - C39. Swing: impact recoil (body shudder on the impact beat)
  - C40. Swing: per-worker amplitude/tempo variety
  - C41. Tired workers: slumped shoulders + head down when fatigue is low
  - C42. Blink: eyes close briefly now and then
  - C43. Rim light: warm edge on the back of the body
  - C44. Contact shadow: bigger and softer under the boots
  - C45. Grime: dirt specks on face and jeans
  - C46. Variety: some miners without beards, moustaches, stubble levels, grey hair on older ones
  - C47. Variety: helmet stickers/colour shade per worker
  - C48. LOD medium: keep vest stripes + helmet lamp visible
  - C49. LOD silhouette: helmet + vest colours instead of a grey blob
  - C50. Sheet check: compare a character sheet against the Miner reference after every batch
- Fixed along the way: shade() returned black for rgb() inputs (black specks on back-side boots/gloves); helmet raised 1.5 units so the eyes show under the brim.
- Verification: character sheet (playtest-captures/mine-architecture/character_sheet_v2.png), in game at 40 m (characters_in_game_v2.png); typecheck + build; click-dig frame p95 3.6 ms; no console errors.

## [2026-10-05 / improvement loop] Characters: defined 2D bodies (user: torso weird, no fingers, shoes out of pants, doll-like round limbs)
- Original problem: limbs were round-capped thick strokes (doll/pill look), hands were circles, boots were drawn over the pant legs, the torso was one blob with the vest painted on top.
- Resolution: `limb()` draws every arm/leg as one tapered, outlined shape through its joints (deltoid → elbow → forearm swell → wrist; hip → thigh → knee → shin → hem), no pill caps. `hand()` = glove cuff, palm, thumb and four fingers — curled into a fist when gripping the pick/hammer (oriented along the handle), relaxed and slightly bent otherwise. `legChain()` draws the boot FIRST and the jeans over it with a hem fold, so the boot comes out of the pants; new boot profile (shaft, instep, toe cap, laces, heel, sole). Torso rebuilt: shirt with back curve, shoulder line, chest, belly and tapered waist; the vest is a separate garment with armholes (shirt shoulders show), shoulder straps, V-neck with collar points + placket, side panel shading, reflective bands, zip, pocket, radio; belt with loops, buckle and jeans waistband. Knee pads became small leather pads (no more black "wheels"). Hammer pose uses the same arm/hand.
- Files: src/rig.ts.
- Verification: character sheet (playtest-captures/mine-architecture/character_sheet_v3.png), in game at 40 m (characters_in_game_v3.png); typecheck + build; no console errors.

## [2026-10-05 / improvement loop] Characters: anatomy, volume, lighting and micro-movement (20-point request)
- Resolution (src/rig.ts):
  - Proportions: shoulder −27→−29.2, hip −17→−18.4 (longer torso), thigh/shin 8.8/7.6→9.4/8.4 (longer legs), broader shoulders, head no longer scaled up (~12% smaller relative to the body). The pick's impact geometry keeps its own pivot (PICK_SH = −27) so hits land exactly where they did.
  - Torso volume: shirt + vest shaded by the mine light direction (lit front/top, deep back-side shadow, darker belly underside, chest highlight, warm headlamp spill on the front shoulder).
  - Waist/hip: a separate jeans pelvis block below the belt, wider than the waist; vest gathers at the waist with folds.
  - Limbs: every arm/leg segment gets a lit band on the lamp-facing side and a shadow band on the far side (cylinders).
  - Elbows: a bony joint on the outside of the bend + sleeve wrinkles on the inside; upper arm and forearm are separate angled shapes.
  - Hands: bigger gloves — flared cuff, palm, separate thumb, grouped finger block with creases (fist when gripping).
  - Legs: weight-bearing stance (one straight leg under the hip, the other relaxed with a bent knee; weight drifts slowly); thigh and shin are separate shapes; leather knee pad with cap highlight; folds behind the knee, at the thigh and where the jeans stack on the boot.
  - Boots: big rounded toe box, visible sole with a lit top edge, separate heel block, laces; strong two-layer contact shadow under each planted boot.
  - Face: brow-ridge shadow, cheekbone light, nose shadow, warm lamp spill on the cheek; beard with a light-to-dark gradient and strand highlights.
  - Headlamp: small hot core + a short controlled cone + spill on the brim (no glowing orb over the face).
  - Materials: soft cloth folds; leather pouches with sharp highlights; buckle + hammer head with hard specular glints; belt loops, pocket flap and a vest hem notch break the outline.
  - Micro-movement: breathing chest, slow weight shift, slight arm sway, head bob and an occasional glance.
- Verification: character sheet (playtest-captures/mine-architecture/character_sheet_v4.png), in game at 40 m (characters_in_game_v4.png); typecheck + build; click-dig frame p95 3.4 ms.

## [2026-10-05 / improvement loop] Recycling Yard rebuilt toward the Yard reference image
- Original problem: the yard was a small strip of simple shapes (grey hopper, a drum, a screw auger, a thin press) crammed into ~2 worker-widths; no sense of heavy industry.
- Resolution (src/yard.ts drawYard + helpers obox/signBoard/beamTo/conveyor/heap/lampPost/hazardBarrier; src/view.ts layout + yard camera; src/config.ts zoom.yardMax):
  - Tall steel tower behind the hopper (cross-bracing, two railed platforms, zig-zag stairs, operator cabin with a lit window, lamps) with the control-panel operator on the upper platform (panel lights blink while the line runs).
  - Wide riveted, rust-streaked hopper on a yellow frame, mouth at the cart's dump height (gameplay-fixed); rock heap rises with the raw stock; RECYCLING sign board above with the live raw count / capacity (red "RAW FULL" when full); overflow bunker at storage tier 2.
  - Inclined conveyor (moving cleats, yellow rollers, rocks riding it while processing) up into a yellow/grey CRUSHER (sign shows Lv = processing level): flywheel spins, the machine shakes, gravel falls out with dust and a warm glow while running.
  - Second inclined belt up to a tall yellow PRESS (sign shows Lv = block quality): columns + crown, hazard-striped base, hydraulic cylinder with a chrome ram that stamps on every press THUMP, mould glowing orange-hot after each stamp, block slides to the pallets; railed operator platform with a second worker.
  - Pallet stacks (two pallets, strapping) = blocks waiting for the truck, with the live count; timber shed with roof behind the line, spare block stacks, lamp posts, hazard barriers.
  - Layout spread out (press 3.25u, stack 4.55u, bay 5.35u right of the shaft; the cart dump point unchanged); the yard camera frames the line tightly (zoom up to 1.5) so it fills the screen.
- Verification: yard at day/dusk + truck loading at the bay (playtest-captures/mine-architecture/yard_day.png, yard_dusk.png, yard_truck_loading.png); BUILD view unchanged; typecheck + build; no console errors. Frame cost A/B with/without the yard drawing identical (12.1 vs 12.7 ms — laptop throttled on battery during this measurement; earlier mains-power runs were 2.6–4 ms).

## [2026-10-06 / improvement loop] Building ladder: Hut → White House, site + yard drama, zoom-out framing
- Original problem: only two building types (Cabin, Two-Story Home, then endless repeats); the BUILD and YARD scenes were static; the user prefers the game slightly zoomed out.
- Resolution:
  - src/config.ts: 9-project ladder with per-project footprint (w, h) and stages; zoom dig 0.9 / surfaceMax 0.95 / yardMax 1.3 / buildMax 1.15. src/state.ts: `projSchema` migration (old Cabin 0→1, old Home 1→3).
  - src/buildings.ts (new): one data-driven renderer — per-stage kinds (foundation, studs/steel frame, floor-by-floor walls in log/plank/siding/brick/stucco/marble/curtain glass, gable/hip/flat/thatch roofs, door + windows installed one by one with shutters/balconies and warm lit windows at night, porch, chimneys with smoke, portico columns + pediment, White House wings + balustrade + waving flag, office "DIG CO." sign, landscaping with trees, barn and hay bales, fountain); blueprint mode; `bldTargets()` gives builders the advancing edge of every stage kind.
  - src/site.ts: generic drawBuilding; FOR SALE sign moved right of the building (crew no longer hides it); hazy town skyline of every sold project type (offscreen-cached); tower crane from the Apartment Block on (lattice mast, jib, counterweight, cab, blinking light, trolley carries strapped pallets of the plot's blocks from the stack to the current work spot); light towers from the One-Story House on with night floodlight cones. src/sitecrew.ts: generic targets/width, `craneTarget()`, idle crew in one loose row.
  - src/view.ts: lot width = max(7.2, w + 5.2)u; the BUILD camera also fits project height + 3u headroom (zooms out for tall projects).
  - src/yard.ts: brick smokestack through the shed roof with a procedural smoke plume (thicker while running) and blinking light; steam burst + spark fan on each press stamp; lamp posts throw cones and warm ground pools after dusk.
- Verification: each project captured at several stages, day and night (playtest-captures/buildings/finished_projects.png, crane_floodlights_town.png); yard day/night (yard_smoke_steam_lamps.png); fresh-save bot 8× for 900 game-s (fresh_run_p6.png): first sale 161 s (was 395 s), Work Chamber 297 s, Excavator 776 s, reached project #5 Farmhouse; frame median 6.7 ms / p95 8.2 ms; typecheck clean, no console errors besides the optional music asset 404.

## [2026-10-06 / improvement loop] Awe backdrop, yard framing at 100%, big scalable panel, upgrade-driven yard machinery
- Original problem (Tejas, screenshot at 100% browser zoom on a 1470-px screen): the yard filled the whole screen zoomed in with the truck cut off; flat two-tone hills for a backdrop; small upgrade rows with too much text on every site; upgrades did not change the yard's look.
- Resolution:
  - src/landscape.ts: new painted backdrop for every surface view, matched to the Yard reference picture — 5 time-of-day palettes (dawn/day/golden/dusk/night, smooth-blended), 3-stop sky, big sun glow with soft rays at golden hour, three jagged snow-capped mountain ranges (sunlit flank + shade flank split by a crease, rock gullies, lit/shaded snow caps), mist bands between layers, three pine forests (far hazy → near dark) with warm rim light on the sun side, palette-coloured clouds, more stars + moon glow. All procedural, deterministic, parallax; sized to the SCREEN (H / zoom) so zoom never blows it up. The day cycle now starts at late afternoon (startPhase 0.44) so a session opens toward golden hour.
  - Camera: the yard view frames the whole parked truck (right edge bayX + 5.1u) and yardMax is 1.0, so at 100% zoom the yard no longer fills the screen.
  - Panel (src/panel.ts, src/style.css, index.html): width clamp(300px, 25vw, 440px) and a base font clamp(14px, 0.5vw + 8.5px, 18px), so everything is in em and scales with the screen. Every purchase is a chunky button: round icon badge, name, level badge, "now → next" effect line, big yellow price pill, a fill bar showing cash progress toward the price, and a gold border + glow when affordable. Long paragraphs replaced with short stat chips (Logistics, Build, Track); shorter names (Jackhammer, Iron Rail); the crew explanation text removed.
  - Yard machinery follows upgrades (src/yard.ts yardBack/yardFront): Raw Storage = 1–3 silos that grow taller with every level, with a live fill gauge + feed duct; Processing Speed = 1–4 electric motors with spinning fans on the crusher, a dust-collector cyclone from Lv 5, a forklift shuttling blocks to the bay from Lv 4; Block Quality = a QC beacon that flashes green on each stamp (Lv 1), an overhead gantry crane carrying blocks to the pallets (Lv 3), gold premium trim on the press (Lv 6).
- Verification: 1280×720, 1470×800 (DPR 2) and 1920×1080 screenshots of all three sites (playtest-captures/backdrop-ui/); yard at upgrades 0 vs 9/7/9; surface frame cost 3.0 ms median / max 4.8 ms at DPR 2 (surfperf); fresh-save 8× bot run for 480 game-s: same milestones as before, frame median 4.5 ms, one 183 ms spike that did not reproduce in the focused measurement; typecheck clean; no console errors besides the optional music 404.

## [2026-10-06 / improvement loop] Achievements (50), corner buttons, jewel site tabs, realistic spruces + mountains
- Request: move the sound button to the other side; add an achievements button beside it opening a page; 50 achievements with good animations; colourful MINE/YARD/BUILD tabs with symbols; more realistic trees and mountains.
- Resolution:
  - src/achievements.ts (new): 50 goals in 8 categories (Depth, Hands, Crew, Haulage, Industry, Construction, Wealth, Discovery), each with progress; stored in `dth_ach` (survives Start over); checked with the panel refresh; on first boot a save's already-met goals unlock silently. Unlock = banner dropping under the tabs (gold medal spins in, light sweep, 14 sparks, sting sound, click opens the page), queued one at a time; the 🏆 button bumps and shows a red count of unseen unlocks.
  - Trophy page: blurred backdrop, sheet springs in, conic progress ring + "N / 50", category filter pills, cards stagger in; unlocked = gold medal, category-coloured glow + slow shine, date; locked = dark medal + lock + progress bar with numbers; NEW tags; Esc/✕/backdrop close.
  - index.html/style.css: ♪ and 🏆 now sit top-left (#corner), settings popover opens on the left. Site tabs: inline SVG icons (pickaxe, factory, tower crane) in a glossy badge, each tab its own colour (ember / steel blue / green); active = gradient pill, glow, icon pop + periodic shine; hover lift + icon tilt; icon-only on phones.
  - src/landscape.ts: spruces with per-tree tier count, width, lean and ragged branch tips; near layers get trunks, a shaded left half and a warm sunlit right edge; forest/hill bodies graded light-to-dark. Mountains: bright sunlit ridge rim from each peak, snow couloirs streaking down the gullies below each cap.
- Verification: banner, page, yard golden/day captures (playtest-captures/backdrop-ui/ach_*.png); localStorage dth_ach written; surface frame cost 3.5–3.9 ms median, max 6.8 ms at DPR 2; typecheck + build clean; no console errors.

## [2026-10-06 / improvement loop] UI rebuilt in the Visual Reference Sheet's language; trophy case redesign; BUILD project cards; natural snow
- Feedback: the previous MINE/YARD/BUILD pills and the achievements looked bad — use the earlier style or the reference sheet's buttons; keep improving the game on my own judgement.
- Resolution:
  - Site tabs = the reference nav bar: navy gradient tiles with a steel border, full-colour SVG icons (orange-handled steel pickaxe, green recycle arrows, tan building block), white Bungee labels; active tile = bright glossy blue with a pale-blue border and glow; red/yellow "!" badges with a white ring; locked tabs greyed.
  - Top-left utility bar = the reference's Settings/Achievements: icon-over-label tiles (gear "Sound", gold trophy "Trophies") on one dark plate; the trophy bounces + shows a red count on unlock.
  - Side panel moved onto the same navy palette (panel, cards, affordable glow) so the whole UI is one family.
  - Achievements: trophy case with a category sidebar (icon, name, done/total; active = the blue tab style), rows with bronze/silver/gold shield medals by difficulty within each category (locked = dark slate shield), blue progress bars with numbers, ✓ + date when unlocked, NEW tag and blue ring for unseen, header with a conic progress ring and gold/silver/bronze counts. Unlock banner restyled to match (navy plate, blue or gold glowing border by tier, shield medal pops in with sparks, light sweep).
  - New BUILD cards (reference "Current Project" / "Next Project (Preview)"): src/sitehud.ts — current project name, % bar, blocks on site + stage; next project card with a painted thumbnail of the next building (drawn by buildings.ts into a small canvas) and its value. Shown only at BUILD.
  - Mountains: snowline jaggedness and couloirs reduced (they read as icicles), less snow cover, so peaks show rock under natural caps.
- Verification: captures in playtest-captures/ui-reference/ (banner, trophy case, BUILD cards, opening, mountains day/golden); typecheck + build clean; no console errors.

## [2026-10-06 / improvement loop] The mine goes to 1,000 m: 14 layers, gems, bigger worksites, new machines + tools, Gates of Hell, ~60-min pacing, money fixes
- Request: extend to 1,000 m with ~1 hour to reach Hell; more mine space + workers as we go deeper (camera pulls back); the expanded mine must carry forward; yard grows gradually; fix money logic; gold/silver/ruby/diamond/rainbow layers, diamond blades, more machines; bug: construction showed a completed house as the next one.
- Resolution:
  - Bug: the hazy "town" of sold buildings stood full-size right beside the project board and read as the next project. Now small, hazier, on low hills well away from the lot and board (src/site.ts drawTown).
  - Layers (src/config.ts MATERIALS): 14 layers to 1,000 m, each with a behaviour/sound family (`fam`), value multiplier, gem colours, darkness ambience and lava glow for Magma/Hellstone; `unitValue` includes the layer multiplier; layer banner uses each layer's description. Visuals: precious layers wear their full hue (bedrock palettes), faceted gems on wall boulders, twinkling gems in the dig face, gem specks + lava veins in the painted geology, gem shards and coloured sparkles in break debris, world-anchored gem glints that twinkle in the dark (minelight.drawLayerMagic), red heat glow + embers in the final stretch, per-layer darkness colour.
  - "▼ NEXT LAYER in N m" pill at the bottom of the mine view (always one goal ahead).
  - Machines (CREW.machine): Excavator, Diamond Saw Rig (spinning diamond blade, sparks), Deep Drill Rig (lattice mast + auger, as on the reference sheet) — drawn in characters.ts; generic machine logic in workers/economy/miner/minelight/expansion; one panel card per machine.
  - Worksites: Great Hall (580 wide, 8 visible crew, $15k, 10 diggers) and Deep Cavern (760 wide, 11 crew, $150k, 22 diggers) with machine stations; the work room now follows the active floor (layout.chamberM = camera depth), so the expanded mine is carried forward; the mine camera can zoom out to 0.4 so bigger rooms visibly grow the view.
  - Tools: Diamond Drill ($30k @270 m) and Hellforge Breaker ($350k @700 m). Track: Mag-Rail ($60k, safe 900, ×2.2) and Hellfire Rail ($600k, safe 1,800, ×3) with their own rail styles.
  - Money: the dig-site pile is capped at 3 cart loads (min 240) and the excess is backfilled, so a huge pile of old cheap rubble can no longer average away the value of deep precious rubble (and the pile no longer grows to 20k); the pile count turns red when full (transport is the bottleneck).
  - Yard grows gradually: silos every 5 Raw Storage levels, motors every 4 Processing levels, forklift at 6, cyclone at 9, gantry crane at Quality 4, gold trim at 8; visual tier thresholds widened.
  - Ending: the Gates of Hell arch glows up through the floor from 940 m; at 1,000 m its doors blaze open, a banner + modal celebrate, digging stops (construction continues). 50 achievements re-cut for the deep game (Silver Lining, Gold Rush, Diamonds Are Forever, Over the Rainbow, Feel the Heat, Dig to Hell, Cutting Edge, Drill Baby Drill, Diamond Hands, Forged in Fire, Great Hall…).
- Verification: fresh-save pacing bot (playtest-captures/deep-mine/L4.log, 16× game speed, ~1 click/s, cheapest-first buyer): Yard 1.2 min, Work Chamber 6.1, Excavator 11.9, Great Hall 15.1, 300 m 18.9, Saw 24.2, 500 m 29.9, Deep Cavern 30.6, Drill Rig 38.6, White House sold 38.6, 800 m 47.7, 900 m 54.2, **1,000 m 61.5 min**; no console errors. Layer captures (layers_sheet.png), Great Hall + Deep Cavern (W2/W3.png), Gates of Hell (L4_end.png). Typecheck + build clean.

## [2026-10-06 / improvement loop] Everything left on the list + full playtest
- Added: three late projects (Skyscraper $90k with spire, Stadium $160k with canopy + floodlight masts, Obsidian Palace $300k: black marble, gold trim, colonnade, wings, red banner flag) so late money has a goal; six deep finds with their own drawings (dinosaur skull 165 m, crystal geode 360, gold nugget 440, lost miner's chest 565, stone idol 675, horned skull 905), each with a banner note and a display lamp; second scaffold ladder at the right end of wide buildings (builders pick the nearer ladder); red MINE ! when the rubble pile has been full for 20 s and a transport upgrade is affordable (+ "PILE FULL" in the Transport header); distinct Diamond Drill (steel-blue body, spinning spiral diamond bit, sparkle) and Hellforge Breaker (black body, glowing vents, red-hot point, flames); yard office, diesel tank and spare pallets behind the truck bay; Help (how-to modal) and Save (manual save + toast) tiles in the top-left bar; navy section title strips with icons in the side panel; Spec.md §25 "The Deep Mine" (layers, rooms, machines, tools, track, pile, finds, projects, yard, achievements).
- Playtest (fresh save, pacing bot 16×, playtest-captures/full-run/P1.log + milestone screenshots P1_sheet0/1.png): 100 m 9.5 min, Excavator 12.4, Great Hall 15.7, 300 m 19.1, Saw Rig 25.2, 500 m 29.5, Deep Cavern 31.3, Drill Rig 39.5, White House sold 39.5, Hellforge 44.4, 800 m 46.1, **1,000 m 58.2 min**, Skyscraper → Stadium → Obsidian Palace under construction at 55–65 min; no console errors.
- Fixed from the playtest:
  - Achievement banners collided with construction toasts and find banners under the tabs → moved to the bottom-left, slide in from below.
  - Deep-mine frame cost (12 ms median): gem glints recomputed the geology and built gradients every frame → glints are cached per world cell (pure function), halos are plain circles, density 24% → 16% → 8 ms median / p95 9 ms at 720 m with all machines.
  - Deep finds sat outside the wide room (off-screen) and were hidden by the darkness/walls → placed in the room's side-bay back wall, drawn behind the crew with their own display lamp.
  - Offline progress stalled when a save was deeper than a not-yet-discovered find (new finds added under existing saves) → finds above the floor are caught up before simulating (2 h away at 500 m: +64 m, +$139k, message shown).
  - The tower crane stayed up after a building was finished (it also hid the Skyscraper's spire) → the crane comes down when the building is done; Obsidian Palace flag got a gold canton.
- Verification: typecheck + build; R1 regression (15 game-min): frame median 5.1 ms, p99 16.4, none > 50 ms; no console errors.

## [2026-10-06 / improvement loop] Closed backlog items: unbounded rubble pile (P1) and late-game frame spikes (P2)
- P1 rubble pile grew to 20k with transport never solved → the pile now holds 3 cart loads (excess backfilled), turns red when full, and MINE shows a red ! after 20 s full when a transport upgrade is affordable; Mag-Rail / Hellfire Rail give deep transport somewhere to go.
- P2 frame spikes → deep mine 8 ms median / p95 9 ms after the glint cache; regression run p99 16 ms, no frames over 50 ms (the earlier 183 ms / 5 s maxima were the bot's own screenshots).

## [2026-10-06 / improvement loop] Worker upgrades: Crew Tools + Crew Stamina
- Request: "we need worker upgrades for faster work."
- Resolution: two new upgrades in MINE › Extraction (group 'workers', src/config.ts UPGRADES + CFG.workers):
  - Crew Tools ($250 ×1.6, 20 levels): +12% digger power per level and a slightly quicker swing (+2.5% tempo/level, power per strike adjusted so output stays exact). The crew's picks visibly upgrade at levels 3 / 7 / 12: steel → iron → heavy → diamond (big cyan heads). Shows after the first digger.
  - Crew Stamina ($400 ×1.75, 10 levels): +15% work time before a break and −6% rest time per level; the analytic uptime used by the economy/offline goes 85% → 97%. Shows from 3 diggers. Machines are unaffected (they never rest).
  - economy.ts: crewToolMult, crewUptime; workers.ts shifts/rests/tempo; render crewPick(); panel rows with "now → next" (×power, % on shift).
- Rebalance: with the upgrades the pacing bot reached 1,000 m at 49 min, so deep layers (Silver → Hellstone) got +25% rock HP and −18% depth per break → 1,000 m at 58.7 min (playtest-captures/full-run/W3.log); the bot buys Crew Tools to ~Lv 15 and Stamina to 10 over the hour.
- Verification: in-game crew with diamond picks (wt_crew.png), panel rows (wt_panel.png); deep-mine frame cost 7.9–8.4 ms median, p95 < 10 ms, max < 20 ms at 300/650/920 m with 40 crew + 3 machines; typecheck + build; no console errors.

## [2026-10-06 / improvement loop] Money play: cart fix, uniform upgrade threshold, Economy page, claimable achievement rewards
- Request: cart upgrades are ignored and the cart is slow; a uniform threshold where all money things correlate (all links at a level before any goes further); a graph where the money pieces sit together and connect; achievements must pay cash with a claim button on square cards and progress when unfinished; no dates.
- Resolution:
  - Cart (src/cart.ts, config): it used to wait at the bottom until FULL, so whenever digging was slower than the cart, it sat idle — and every Cart Capacity level made it wait longer (why cart upgrades felt useless). Now, once the yard exists, a part-full cart leaves after 3 s with nothing more to load (≥ 25% or 30 units). Cart speed base 8 → 10 m/s, +25% → +35% per level.
  - Uniform threshold (economy.ts CHAIN/chainGate, CFG.chainSlack = 2): Crew Tools, Crew Stamina, Cart Capacity, Cart Speed, Loading, Processing, Raw Storage, Block Quality, Construction Crew are one chain; no unlocked link may be more than 2 levels above the weakest unlocked, unfinished link. Held rows are dashed and say "🔒 first: <link> Lv N" (panel + Economy page + Construction Crew card).
  - Economy page (src/econpage.ts, 📈 Economy tile top-left; also the "Bottleneck: … $/min ›" line under the cash): Dig → Haul → Yard → Truck → Build → $ with each link's live throughput from the game's own formulas (`flowRates`: cart round trip incl. overload, truck trip, crew, processing, builders), bars on one shared scale, the slowest link pulsing red as BOTTLENECK, every link's upgrades purchasable right there, $ per block × flow = $/min, Operation Level (weakest link), measured income and a 15-minute income graph.
  - Achievements (src/achievements.ts): every achievement pays cash (≈ one minute of income at the moment a typical player gets it, ×1.5 for gold; $160 → ~$1.3M), claimed once ever. Trophy case is now square cards: medal, name, goal; locked = progress bar + numbers + reward preview; unlocked = glowing CLAIM $X button (coin sound + flying "+$X"); claimed = ✓ Claimed. Claim-all in the header; the trophy badge counts unclaimed rewards; unlock banner says "Reward $X · tap to claim". Dates removed.
- Verification: Economy page and trophy cards (playtest-captures/economy/eco_page.png, ach_page.png); pacing bot with the threshold + claims (M1.log): 100 m 7.7 min, Great Hall 14.6, 300 m 16.9, Deep Cavern 32.8, **1,000 m 56.0 min**; chain levels stay level (Cart Capacity/Speed/Loading/Processing/Raw Storage all 21 and Crew Tools 19 at the end); no console errors; typecheck + build.

## [2026-10-06 / improvement loop] Economy page simplified into a game-style pipeline; bottleneck line + Save removed; top bars no longer overlap
- Feedback: liked the bottleneck chart but wants it simpler and more game-like; remove the bottleneck line by the money; remove Save (the game saves itself); the top bars overlapped.
- Resolution: the Economy page is now five round stations (Dig, Haul, Yard, Truck, Build) joined by animated pipes (flow speed follows throughput) into a 💰 Money station showing $/min and $ per block. The slowest station is enlarged, glows red, wobbles, wears a "TOO SLOW!" ribbon and offers one big UPGRADE button (its best affordable upgrade); every other station has one small button (or "🔒 <link> first"). Removed: the explanation paragraph, upgrade lists, measured-income text and the income graph; one line of tip remains. The side-panel bottleneck line under the cash and the Save tile are gone. The tab bar keeps clear of the left tile bar (`left: max(50%, 520px)`; on phones the tiles drop below the tabs).
- Verification: playtest-captures/economy/eco_pipeline.png; 1280×720 top bar check (no overlap); typecheck + build; no console errors.

## [2026-10-06 / improvement loop] Extra miners work on the shaft ledges; "Recruit a Miner"; calmer layers
- Feedback: no "+N crew on shift" sign — put the extra miners in the mine (top layers, on bridges, fixing/repairing/mining); a catchier name than "Hire Digger"; the layers were too glittery.
- Resolution:
  - The sign is gone. rockwall.drawTimberSets records the visible work ledges and transport landings (layout.LEDGES); render.drawLedgeCrew places the miners beyond the floor crew on them, nearest the floor first (2 per ledge, 1 per landing): chipping at the wall with their (Crew Tools) pick, hammering the wall bracket / the rail's guide post, or inspecting with a lamp; their headlamps punch small pools in the darkness (layout.LEDGE_CREW → minelight).
  - "Hire Digger" → "Recruit a Miner" / "Recruit Miner #N" ("one more pick swinging, all day"); popup "Miner recruited!"; crew name Miner; locks and achievements say miners.
  - Glitter cut hard: wall glints 16% → 6% of cells, dimmer, star glints only at the twinkle peak, no halos; dig face 5 → 2 gems with rare twinkles; ~half the boulders carry one smaller stone; geology specks −55%; break sparkles 6 → 3 and gem shards 30% → 15%; Hell embers 40 → 18.
- Verification: depth sheet with big crews (playtest-captures/full-run/Q_sheet.png, ledge close-up q3l.png); deep scene 8.6 ms median alone; fresh-save playtest P2 (P2.log, P2_sheet.png): 1,000 m at 56.4 min, no console errors; typecheck + build.

## [2026-10-06 / improvement loop] Bridge frame through the whole mine, miners spread on it, layer-coloured walls
- Request (reference image: a mine packed with bridges and workers): a bridge-type structure all through the mine with workers on it, workers on the sides, a random number per level, the same material on the sides.
- Resolution:
  - rockwall.drawTimberSets: every other timber level (~16 m) a plank BRIDGE spans the shaft from the left wall to the transport post (the cart's column stays clear): deck with plank gaps and a stringer, steel bands below 150 m, railing posts + hand rail, braces into both walls, frame posts down from the bridge above with cross braces in alternate bays; a lantern hangs under each deck (minelight). drawRoomCatwalk: in the Great Hall / Deep Cavern a high catwalk crosses the room on two legs.
  - render.drawLedgeCrew: extra miners (up to 16 drawn; the rest are out of sight) go to bridges (random 0–4 per bridge, stable per level), ledges (1–2), landings (0–1) and the room catwalk (2–4), spread along the deck clear of the ladder: chipping at the wall at the ends, carrying a plank back and forth, hammering deck/railing/posts, or inspecting with a lamp; their headlamps light a little rock. Drawn after the room and before the darkness.
  - Side walls (bedrock palettes) now take their layer's material colour fully (clay red, stone grey, cave blue-grey, the precious layers' hues), not a warm-washed brown.
- Verification: playtest-captures/full-run/bridges_180m.png, bridges_640m.png; typecheck + build; no console errors. Perf: an in-page A/B (30 vs 5 crew) put the ledge crew at ~10–15% of a frame; the drawn crew is capped at 16. NOTE: two of the user's own Chrome processes were at ~100% CPU during this session, so the timings and the R2 bot run (fewer bot iterations → later purchases) are inflated by that load; re-measure on an idle machine.

## [2026-10-07 / user playtest] Played as a user: stalled money chain, miner spam, long dead zones, bad opening — fixed
- Method: a "human" bot (human.mjs) that clicks at a person's pace (~3/s of game time), follows the red/yellow badges, buys the first highlighted button on the panel it is looking at, claims trophies and sells; later a variant that follows the new NEXT BEST card. Logs every purchase and the wait since the previous one (playtest-captures/user-playtest/).
- Found (H3: top-of-panel player, 70 game-min):
  1. Miner spam starves the operation: "Recruit Miner" is always on top and always affordable, so a typical player keeps hiring (40 miners) while Cart / Processing / Storage / Quality sat at Lv 2–5 all game — the chain threshold silently held them and nothing pointed at the real bottleneck. Only 8 sales in 70 min.
  2. Late-game dead zones: 4–10 minutes between purchases (saving for $100k+ miners while cheap, high-value upgrades sat unbought).
  3. Opening: the first cart waited for a full 50 units → 2–3 min of digging before the first decision at a normal click rate (much longer for a slow clicker); the contractor's $250 Yard advance could be spent on Reinforced Wood Track first (also $250).
  4. The Economy page knew the bottleneck, but nothing on the panel used it.
  5. (Card v1, H5) recommending only the slowest station's cheapest item sent players to miners while machines/expansion/tools were the real answer, and to a $600k rail while a cheap chain blocker held everything.
- Fixes:
  - Room for miners per worksite (Narrow Shaft 6, Work Chamber 14, Great Hall 26, Deep Cavern 45): "🔒 mine is full (14/14): expand the worksite" — miners can't be spammed past the room; expansion becomes the natural next goal.
  - NEXT BEST UPGRADE card at the top of every panel: of everything buyable (chain upgrades, a miner, each machine, the next track, the next worksite valued by what it unlocks) it applies each purchase to the state, re-runs the same flow formulas, undoes it, and picks the most income per dollar; a chain-held upgrade is offered through its blocker ("Raw Storage (unlocks Cart Capacity)"); a far-off target falls back to the best affordable one. Gold + pulsing when affordable (one tap), progress bar while saving.
  - BOTTLENECK tag + glow on the panel rows that speed up the slowest station.
  - The first cart leaves with the contractor's 20-unit sample after 3 s with nothing more to load (no full-50 wait); the track can't be bought before the Yard exists.
- Result (H8, card follower, 30 game-min): Yard 1.1 min, first sale 3.0 min, 8 sales by 27.5 min (was 58 min), 148 purchases, longest wait between purchases 65 s (was 4–10 min), 594 m and ~$1M earned by 30 min; no console errors.
- Open: a card-follower may now reach 1,000 m well before 60 min (only the first 30 min verified — long runs kept being killed by machine load: two of the user's own Chrome processes at ~100% CPU); the memory/leak check could not complete for the same reason (all screens respond in < 25 ms; no hang found).

## [2026-10-07] Upper crew at fixed posts; electrics on every bridge; upper crew maintain, never mine
- Bug: extra miners were assigned to whichever ledges were on screen, so scrolling up made miners "spawn" wherever the camera was. Now the posts are fixed in the world: the room catwalk first, then the bridges counted from the floor upward (0–4 per bridge, stable per level); scrolling shows the same people in the same places (playtest-captures/full-run/fixed_crew_scroll.png).
- Upper crew no longer swing picks at the walls: they carry timbers, hammer posts / brace decks / fix cable hangers, or inspect with their lamps (keeping the mine stable).
- Electrics on every bridge (rockwall.electrics): a black power cable and a red signal line sagging between hangers under the deck, a junction box on the left post, and on every third bridge a generator (amber) or fuse cabinet (green) with a blinking status light, deeper ones with a transformer drum (bridge_electrics.png).
- Verification: scroll test at 300 m with 30 crew; typecheck + build; no console errors.

## [2026-10-07] Bottleneck rows breathe red
- Bottleneck upgrades now pulse with a soft red glow (2.4 s "breath": border + outer and inner glow, no strobing), a slow light sweep every ~5 s, and a "⚠ BOTTLENECK" pill that brightens in time; the Economy tile gets a pulsing red dot and glowing icon while a bottleneck upgrade is affordable. Reduced-motion users get the static red border/pill. (playtest-captures/economy/bottleneck_pulse.png)

## [2026-10-07] Guided tutorial (skippable, replayable)
- src/tour.ts: 13-step spotlight tour — dims the screen, highlights one thing at a time with a gold ring, and explains it in a bubble (Back / Next / "Skip tutorial ✕", step counter; keyboard ← → Enter Esc). Steps: welcome · dig · digging speed · money · Next Best card · miners & tools · the cart · Recycling Yard · build & sell · bottlenecks (Economy) · the 2-level rule · trophies pay cash · where to replay it. It switches sites as needed and skips steps for things not unlocked yet.
- Offered once, 2.5 s after the Recycling Yard is built (the whole UI exists): "New here? Take the 1-minute tour" with Start tour / Skip. Seen/skipped is remembered (`dth_tour`).
- Take it any time: the new ★ Guide tile in the top-left bar, or "▶ Take the guided tour" in Help.
- The left tile bar is wider now, so the site tabs keep more clearance (labels hide under 1,200 px).
- Verification: offer + every step captured (playtest-captures/tutorial/); 1280 px top bar check; typecheck + build; no console errors.

## [2026-10-07] Excavator redrawn as a real hydraulic excavator
- characters.drawExcavator (same IK and dig timing): tracked undercarriage with sprocket, idler, rollers and grousered shoes; slewing ring; rounded counterweight with the maker's stripe; engine house with radiator louvres, handrail, exhaust stack (with a puff), beacon and DIG CO decal; framed cab with tinted glass, glare, wiper, roof guard, operator and a work light; a curved ("banana") boom with lit/shaded edges, boom cylinder, stick cylinder and bucket cylinder (yellow barrels + chrome rods), hydraulic hoses, dog-bone linkage, pins; a shaded bucket with wear plate and four teeth. Everything outlined and lit from the upper-left. (playtest-captures/full-run/excavator_v2.png)

## [2026-10-07] Crew Gear ladder, visible crew tool upgrades, "+N" rubble over each miner
- Crew Gear (config CREW_GEAR, save field `crewGear`, big card under Recruit Miner, also in NEXT BEST): Steel Picks → Iron Picks $300 → Heavy Picks $2k @25 m → Crew Jackhammers $12k @75 m → Crew Diamond Drills $90k @270 m → Crew Hellforge Breakers $700k @700 m. Each tier puts the player's matching tool model in every miner's hands (jackhammer tiers switch the crew to the jackhammer pose) and multiplies miner power (×1.15 … ×2) and rubble per break (×1.25 … ×3); a banner announces it. economy: gearOf / crewYield used by strikes, rates and offline.
- Crew Tools levels now show on the tool: picks grow with each level and turn gold (Lv 7) then diamond-blue (Lv 12); powered tools keep their size.
- Every time a miner's strike breaks a chunk, a small "+N" rises over their head (N = rubble per break: +2 steel, +4 jackhammers, +5 diamond drills…; white → gold → blue as it grows).
- Verification: tiers 0 / 3 / 4 in game (playtest-captures/full-run/crew_gear_tiers.png, crew_gear_panel.png); typecheck + build; no console errors. Pacing NOT re-measured: crew output can now grow up to ~6× from gear, so the 60-minute target needs a re-run on an idle machine.

## [2026-10-07] Crew Gear in NEXT BEST + Economy; better "best value" scoring
- Crew Gear was already a NEXT BEST candidate but never won: the score only counted income right now, so with the Yard as the bottleneck every digging purchase scored 0. Value is now income + 35% of the growth of the whole operation (geometric mean of the five stations' throughput), so an upgrade to the next bottleneck counts too. Crew Gear is also a button on the Economy page's Dig station. Duplicate entries for one blocker ("Crew Tools (unlocks …)") are merged.
- Check (dev `window.__best`): Crew Gear ranks 3rd–4th by value in the test saves (Iron Picks, Heavy Picks, Crew Jackhammers) behind the current bottleneck fix, and is offered when it's the best buy.

## [2026-10-07] The ending checked: quarrying after 1,000 m, gate behind the crew, dev jump
- Bug: at 1,000 m the crew stopped producing rubble (crewBreaksPerSec returned 0), so the whole chain starved — no more blocks, no more income — while the ending says "your construction empire keeps building"; the panel also tagged the dig upgrades (even a MAX one) as BOTTLENECK. Now the crew keep quarrying Hellstone at the bottom (rubble, no depth; online and offline), the speed box reads "🔥 QUARRYING HELLSTONE · 1,000 m", and MAX rows never get the tag.
- The Gates of Hell now stand on the floor in the back wall behind the crew (carved basalt frame with stone courses, a pulsing red outline, studded iron doors with a glowing seam while closed, blazing fire when open), lit by their own light through the darkness from 940 m.
- Dev-only debug button "Jump to 990 m (see the ending)".
- Captures: playtest-captures/hell/ (946 m, 986 m, 1,000 m, the ending message).

## [2026-10-07] "+N" over machines; DEV menu in the top bar
- Excavator, Diamond Saw Rig and Deep Drill Rig show their rubble per bite over the machine (+20 / +32 / +56, larger and orange); all "+N" numbers are now drawn above the mine darkness with a dark outline, fully opaque for 0.6 s (playtest-captures/full-run/machine_pops.png).
- The dev controls were only in the dev build (`npm run dev`) at the very bottom of the side panel. Now a DEV / Test tile in the top-left bar (dev builds only, stripped from production) opens: money (+$1K…+$1M), jump to any layer or 990 m (the ending), game speed ×1/×4/×16, skip the opening, next worksite room, +5 miners, all machines, next crew gear, +rubble / +blocks / clear raw, time of day, and resets for the tour offer and achievements (dev_menu.png). The old bottom-of-panel debug block is removed.

## [2026-10-07] Dev menu reachable in any build
- The game was being played on `vite preview` (port 4173 = the production build), where the dev-only menu is stripped. The DEV / Test tile now also appears with `?dev` in the URL or after Shift + D (toggles, remembered in `dth_dev`; "Hide dev menu" button too). Speed and time-of-day controls get their hooks from main.ts, so they work in production builds. Verified on localhost:4173: hidden by default, shown after Shift + D, +$1M works, `?dev` works; no console errors.

## [2026-10-07] The finale: lava, skeletons, the eruption and the end-of-game card
- From 960 m: lava falls pour down both shaft walls into glowing splash pools, and skeletons with ember eyes drag themselves across the floor and ledges (finale.drawHellLife).
- At 1,000 m the gates swing open, then (finale.ts) the ground quakes (shake + rumbles, "THE GROUND IS SHAKING…"), lava bursts from the floor ("HELL BREAKS LOOSE"), and a lava flood rises up the whole shaft over ~11 s with the camera riding it (glowing crust, drifting dark plates, popping bubbles, heat glow, embers), pours over the surface and keeps rising over the headframe, yard and town while fires burn and smoke blackens the sky ("THE MINE IS GONE"), then the screen fades to black. Input is blocked during the sequence. Saves already at 1,000 m set it off with their next strike.
- Summary card "GAME COMPLETE": finished in (active play time, new save field stats.playSecs; NEW BEST! vs `dth_best`), money earned, buildings sold (and the last one), blocks delivered, crew + machines, worksite, finds, trophies, depth; "Start a new mine" resets the save (trophies and the best time persist). flags.finished prevents a second run.
- Fixed while testing: "Blocks delivered" was reset to 0 on every load for v6 saves (state.ts kept it only for v5).
- Captures: playtest-captures/finale/ (bottom, gates, quake, burst, rise ×3, surface ×2, card). Verified end to end in the dev build; no console errors.

## [2026-10-07] Skeletons removed; bones in the rock instead
- The crawling skeletons are gone. Near the bottom (from 940 m) old, stained bones (femurs, rib arcs, half-buried skulls, vertebrae) lie in the rock: in the walls past the room's edges and as a bone bed in the floor rock under the work floor. Small, dim, still, world-anchored; none in the open room or over the crew/machines. The lava falls also moved out of the room onto the rock walls. (playtest-captures/finale/bones_in_rock.png)

## [2026-10-07] Hell layer scene (first pass toward the final-layer concept art)
- src/hellscene.ts, fades in from 930 m:
  - Back (behind the crew): lavafalls down the back rock, a red heat haze, giant fossils (a rib cage on the left, a T-rex skull with neck vertebrae and a glowing eye socket on the right).
  - Front (emissive, after the darkness): a basalt cliff under the work floor (toned blocks, joints, glowing cracks) with lava spilling over its edge, and a lava sea below with flowing light lines, cooling crust plates, basalt islands with molten rims, stalagmite spikes and faint steam.
  - Lava light sources (minelight) light the floor area and the fossils.
- Capture: playtest-captures/hell/hell_layer_v2.png.
- Gaps vs the concept art: the fossils are mostly hidden behind the room's bridge frame and the darkness (the concept puts them in open side caverns); no foreground basalt boulders or jagged cave ceiling; the lavafalls are thin and uniform. Next step: open the side walls into caverns at the Hell layer so the fossils and lavafalls stand in full view, and push the contrast (darker basalt silhouettes against brighter lava).

## [2026-10-07] Real lava: procedural animated lava for the Hell layer and the finale
- Feedback: the Hell layer looked bad (flat orange fills); make it look like real lava, more animated and polished.
- src/lava.ts (new): an animated procedural lava texture — a tileable 4-octave value-noise field, sampled with time-drifting domain warping (the surface churns and flows instead of sliding), turned into temperature (dark crust plates over most of the surface, thin white-hot ridged veins between them, slow breathing hot spots, a hotter churn at the surface), mapped through a black-body colour ramp, rendered at 1/6 resolution and scaled up smoothly, plus a bloom pass. Pools flow sideways; falls stretch the noise and race downward with cooler edges. Textures refresh at 20–30 fps and are cached in between.
- hellscene.ts rebuilt on it: the lava sea (wavy surface with a bright meniscus, bubbles that swell and pop into droplets, cooled basalt rocks bobbing with molten rings, basalt spires), lavafalls that flare as they fall with a hot lip, splash ripples and spray droplets on ballistic arcs, a columnar basalt cliff with pulsing molten seams down the joints and lava drips, embers, and wide lavafalls + lava-lit giant fossils in the back. The finale flood uses the same texture (churning faster).
- Perf: Hell drawing 9.7 → 3.3 ms median (measured inside the page; the machine was too loaded for whole-frame numbers).
- Captures: playtest-captures/hell/lava_v3_closeup.png, lava_v3_full.png, lava_v3_flood.png.

## [2026-10-07] The ending, as specified: gate opens → lava rises 50 m/s → flows over the land → sets solid → game over
- finale.ts rewritten: GATE (4.5 s: the two studded doors swing inward, narrowing and darkening as they turn, revealing a wall of churning lava; light rumble) → POUR (4 s: lava pours through the gate and runs out across the floor from the gate to both walls) → RISE at exactly 50 m/s up the mine's interior (the room at the bottom, the shaft above it; ~20 s from 1,000 m; camera rides just above the surface; bright surface line, heat glow, embers) → FLOW (lava spills out of the shaft and runs over the ground both ways with lumpy lobes, bright fronts and fire where it touches grass and trees, smoke in the sky) → COOL (it sets into black rock in the shaft and on the land, a few cracks still glowing) → fade to black → the GAME COMPLETE card. No quake/burst stage any more. Toasts are silenced during the ending.
- render.drawHellGate: doors driven by finale.gateOpen(); the lava behind them is the procedural lava texture.
- Captures: playtest-captures/finale/f2_*.png and f2_sheet.png (gate half open, open, pour, rise ×2, flow ×2, cooled, card). Verified end to end; no console errors.

## [2026-10-07] Lava visibly pours in through the opened gate
- Feedback: the gates opened but the lava didn't flow in (the pour was a 3 m sheet growing from the centre, lost against the red Hellstone floor).
- Now: a thick torrent of lava (the falling-lava texture) flares out of the doorway down into the pool, with a hot glow at the mouth and spray where it crashes in; the tongue runs out across the floor to both walls with bright rolling fronts and droplets, and deepens to ~9 m over a longer 6.5 s pour; the torrent keeps pouring until the rising lava covers the doorway. (playtest-captures/finale/gate_pour_sheet.png)

## [2026-10-07] Bug: after one ending, the dev jump showed open gates but no lava
- Cause: a save that had finished the game keeps flags.finished = true; the dev jump to 990 m kept it, so at 1,000 m the gates drew open (finished ⇒ open) but startFinale refused to run. A reload during the end card also left a "finished" game playable with nothing happening.
- Fix: dev jumps clear `finished` (and a new "Replay the ending now" dev button jumps straight to 1,000 m); a finished save shows the GAME COMPLETE card again on load (no new best time recorded twice); a save at 1,000 m that hasn't run the ending (reloaded mid-ending) starts it 2.5 s after loading.
- Verified on the production build (localhost:4173) with the user's path: finished save → card on load → Shift+D → DEV → 990 m → dig to 1,000 m (30 s) → gate opens, lava pours through it and floods the floor (dev_path_pour.png) → end card; no console errors.

## [2026-10-07] Release-fix phase (from the RELEASE_READINESS.md audit)
Every item is logged with its verification in RELEASE_READINESS.md; evidence is in playtest-captures/release-fix/.
- Build: `vite.config.ts` `base: './'` (sub-folder hosting); fonts bundled (no external requests); SVG favicon; inline loading screen; version shown in game; public build has no dev menu (tester build: `npm run build:test`).
- Saves: backup and rolling copy, no silent wipe; machine counts clamped.
- Background tabs: hidden time is simulated on return; audio is silenced while hidden or during an ad.
- Portal: `platform.ts` adapter (loading, gameplay start/stop, happyTime, ad pause); `analytics.ts` event bus (no-op).
- Layout: corner bar collapses to a ☰ Menu when narrow; no overlap at 800×600, 1024×600 or on mobile; fullscreen button.
- Browsers: Firefox 132 and WebKit 18.2 verified (Playwright); roundRect polyfill; -webkit-backdrop-filter.
- First session: one bottleneck tag (the NEXT BEST purchase); batched trophy banners; tour offer after the first sale as a small corner chip; track strain only after the first sale.
- Clarity: 'Your pickaxe / Your crew' headings, 'Crew gear: …' labels, one-decimal gear yields, '(unlocks …)' moved to the subtitle, finished rows collapse, full pile shows 'N · FULL' and '−N backfilled'.
- Performance: geology painted in time-budgeted slices (worst 55–62 ms → 14–17 ms).
- Economy: big construction stages pay progress instalments; pacing slowed (43 → 51.0 min for an optimal bot).
- Art: Hell fossils in lit side caverns; yard zooms in on wide screens; intro text on a dark plate.
- Release kit: release/ (covers, icon, screenshots, STORE_LISTING.md).

## [2026-10-07] Truck in front of the brick pile · strong "ready to sell" guidance
- The construction plot's block stack is drawn before the truck (the road is in front of the plot); builders, crane and the block count stay in front of the parked truck.
- A finished property gets a gold call-out under the BUILD tab on every site (one click: fly to BUILD and sell), a gold BUILD tab, a NEXT BEST "Sell the …" card, a bobbing READY TO SELL arrow over the roof, and a pulsing SELL button; bottleneck tags pause until it's sold. (playtest-captures/release-fix/sale_guidance.png)

## [2026-10-07] Loading screen + silent ending (pre-submission)
- Loading screen = the key art for at least 2.5 s with a filling bar; the world is frozen underneath (the intro waits). Blurred fill on portrait screens.
- When the Gates of Hell open, the world simulation stops (no strikes, rail clacks or hammering under the lava or behind the end card; clicks ignored) and the music fades out.
- Upload zip rebuilt: release/upload/dig-to-hell-v1.0.0.zip (715 KB).
