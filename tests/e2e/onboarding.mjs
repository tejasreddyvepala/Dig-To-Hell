// First-minute onboarding test (v1.1 M1). Plays a FRESH save of the production build in a real browser, on desktop and
// phone viewports, through: boot → start (Space / tap the rock / START button) → fill the cart → follow the cart →
// build the Recycling Yard. Records real-time timings, the on-screen objective text, screenshots and console errors.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/e2e/onboarding.mjs [outDir]
// Env: BASE_URL (default http://localhost:4173/), CHROMIUM_PATH (optional browser binary).
// Needs the `playwright` package resolvable from here or via NODE_PATH (not a project dependency).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { console.error('playwright not found: install it or set NODE_PATH'); process.exit(2); }
const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const OUT = process.argv[2] || 'onboarding-out';
fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: 'desktop', vp: { width: 1280, height: 720 }, mobile: false, start: 'space' },
  { name: 'desktop-btn', vp: { width: 1280, height: 720 }, mobile: false, start: 'button' },
  { name: 'phone-portrait', vp: { width: 390, height: 844 }, mobile: true, start: 'tap' },
  { name: 'phone-landscape', vp: { width: 844, height: 390 }, mobile: true, start: 'button' },
  { name: 'small-desktop', vp: { width: 800, height: 600 }, mobile: false, start: 'tap' },
];

async function run(browser, c) {
  const ctx = await browser.newContext({ viewport: c.vp, isMobile: c.mobile, hasTouch: c.mobile, deviceScaleFactor: c.mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [], log = [];
  await page.goto(new URL('favicon.ico', BASE).href).catch(() => undefined); // same origin, not the game: clear storage
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  const at = () => +((Date.now() - t0) / 1000).toFixed(2);
  const mark = (k, extra = '') => log.push(`${at().toFixed(2).padStart(6)}s ${k}${extra ? ' ' + extra : ''}`);
  await page.goto(BASE);
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 });
  const tBoot = at(); mark('boot gone');
  await page.waitForFunction(() => { const b = document.getElementById('introBtn'); return b && !b.hidden && b.offsetParent; }, null, { timeout: 15000 });
  const tStart = at(); mark('START visible', JSON.stringify(await page.evaluate(() => document.getElementById('introText').innerText)));
  await page.screenshot({ path: path.join(OUT, `${c.name}-1-start.png`) });

  // where the strike target is: the pulsing ring sits on the shaft centre just below the dig surface
  const canvas = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const rock = { x: canvas.x + canvas.w * 0.5, y: canvas.y + canvas.h * 0.74 };
  const strike = async () => {
    if (c.start === 'space' || c.name.startsWith('desktop')) await page.keyboard.press('Space');
    else if (c.mobile) await page.touchscreen.tap(rock.x, rock.y);
    else await page.mouse.click(rock.x, rock.y);
  };
  const depth = () => page.evaluate(() => document.getElementById('depth').textContent);
  const d0 = await depth();
  if (c.start === 'button') await page.click('#introBtn');
  else if (c.start === 'space') await page.keyboard.press('Space');
  else if (c.mobile) await page.touchscreen.tap(rock.x, rock.y);
  else await page.mouse.click(rock.x, rock.y);
  mark(`START via ${c.start}`);
  await page.waitForTimeout(700);
  const firstStrike = await page.evaluate(() => ({ introHidden: document.getElementById('intro').hidden || !document.getElementById('introBtn').offsetParent }));
  const struck = await page.waitForFunction((d) => document.getElementById('depth').textContent !== d || document.querySelector('#hint.goal'), d0, { timeout: 4000 }).then(() => true).catch(() => false);
  mark('first strike registered', `${struck} intro dismissed ${firstStrike.introHidden}`);
  await page.screenshot({ path: path.join(OUT, `${c.name}-2-first-strike.png`) });

  // dig until the cart is ready or gone, reading the objective
  let lastHint = '', shotMid = false, ready = false;
  for (let i = 0; i < 400; i++) {
    const h = await page.evaluate(() => { const e = document.getElementById('hint'); return e.hidden ? '' : e.textContent + (e.classList.contains('goal') ? ' [goal]' : ''); });
    if (h !== lastHint) { mark('hint', JSON.stringify(h)); lastHint = h; }
    if (!shotMid && /FILL THE CART\s+1\d\/50/.test(h)) { shotMid = true; await page.screenshot({ path: path.join(OUT, `${c.name}-3-objective.png`) }); }
    if (/CART READY/.test(h) && !ready) { ready = true; await page.screenshot({ path: path.join(OUT, `${c.name}-4-cart-ready.png`) }); await page.waitForTimeout(3500); continue; } // stop digging: the cart leaves on its own
    if (/FOLLOW THE CART/.test(h)) break;
    if (!ready) await strike();
    await page.waitForTimeout(ready ? 250 : 180);
  }
  const tFollow = at(); mark('follow the cart');
  await page.screenshot({ path: path.join(OUT, `${c.name}-5-follow.png`) });
  // follow it to the yard and build the Recycling Yard when the contractor's advance arrives
  await page.click('#nav .site[data-site="yard"]');
  await page.waitForFunction(() => { const b = document.getElementById('buildYard'); return b && !b.disabled && !b.hidden; }, null, { timeout: 60000 });
  const tYardAff = at(); mark('yard affordable');
  await page.screenshot({ path: path.join(OUT, `${c.name}-6-yard.png`) });
  await page.click('#buildYard');
  await page.waitForTimeout(1500);
  const tYard = at(); mark('yard built');
  const res = { name: c.name, start: c.start, boot: tBoot, startVisible: tStart, struck, follow: tFollow, yardAffordable: tYardAff, yard: tYard, sawObjective: shotMid, sawReady: ready, errors };
  fs.writeFileSync(path.join(OUT, `${c.name}.log`), log.join('\n') + '\n');
  await ctx.close();
  return res;
}

const browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
for (const c of CASES) results.push(await run(browser, c).catch((e) => ({ name: c.name, failed: String(e) }))); // one at a time: timings aren't skewed by CPU sharing
await browser.close();
let fail = 0;
for (const r of results) {
  const ok = !r.failed && r.struck && r.startVisible <= 2.5 && r.sawObjective && r.errors.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
}
process.exit(fail ? 1 : 0);
