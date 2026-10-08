import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:5179';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const flags = { dispatched: true, arrived: true, sold: true, storageSeen: true, annYard: true, annBuild: true, seenYard: true, seenBuild: true };
const base = (o) => ({ version: 6, projSchema: 2, trackSchema: 1, found: 8, clicks: 999, cash: 2.4e6, tool: 4, yard: true, tut: 6, last: Date.now(), flags, upg: { cartCap: 12, cartSpeed: 12, loading: 10, processSpeed: 12, rawStorage: 8, quality: 6, crew: 6, rail: 4, crewTools: 10, crewStamina: 6 }, stats: { earned: 5e6, processed: 5e5, delivered: 4e5, sold: 14 }, ...o });
const shots = [
  { name: 'mine_gold', save: base({ depth: 452, crew: { dig: 26, exc: 1, saw: 1, borer: 0 }, worksite: 2, chamberM: 400, crewGear: 4 }), site: 'mine', phase: 0.3 },
  { name: 'mine_opal', save: base({ depth: 712, crew: { dig: 40, exc: 1, saw: 1, borer: 1 }, worksite: 3, chamberM: 690, crewGear: 5 }), site: 'mine', phase: 0.3 },
  { name: 'hell', save: base({ depth: 985, crew: { dig: 45, exc: 1, saw: 1, borer: 1 }, worksite: 3, chamberM: 960, crewGear: 5 }), site: 'mine', phase: 0.3 },
  { name: 'mine_early', save: base({ depth: 70, cash: 900, tool: 2, crew: { dig: 6 }, worksite: 1, chamberM: 55, upg: { cartCap: 3, cartSpeed: 3, rail: 1 }, crewGear: 1 }), site: 'mine', phase: 0.3 },
  { name: 'yard', save: base({ depth: 452, crew: { dig: 26, exc: 1, saw: 1 }, worksite: 2, chamberM: 400 }), site: 'yard', phase: 0.56 },
  { name: 'build', save: base({ depth: 452, crew: { dig: 26, exc: 1, saw: 1 }, worksite: 2, chamberM: 400, build: { project: 7, stage: 3, active: true, used: 900, material: { qty: 600, val: 600 * 30, mix: { gold: 600 } }, done: false, stageVal: 0, projVal: 0, projQty: 0 } }), site: 'build', phase: 0.56 },
];
for (const s of shots) {
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 }); p.on('pageerror', (e) => console.log('ERR', s.name, e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CERR', s.name, m.text()); });
  await p.goto(URL + '/src/style.css');
  await p.evaluate((sv) => { localStorage.clear(); localStorage.setItem('digtohell_v6', sv); localStorage.setItem('dth_tour', '1'); localStorage.setItem('dth_ach', JSON.stringify({ got: {}, claimed: {}, seen: 999 })); }, JSON.stringify(s.save));
  await p.goto(URL + '/', { waitUntil: 'load' }); await sleep(1500);
  await p.addStyleTag({ content: '#panel,#corner,#nav,#toasts,#achPops,#hint,#modal,#siteHud,#tourOffer,#devPanel,#intro{display:none!important}' });
  await p.evaluate((ph, site) => { window.__dig.setPhase(ph); window.__dig.go(site); }, s.phase, s.site);
  await sleep(s.site === 'mine' ? 9000 : 6000);
  await p.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(1200);
  await p.screenshot({ path: `rel/${s.name}.png` });
  await p.close();
}
await b.close();
