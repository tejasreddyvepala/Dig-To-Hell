import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--allow-file-access-from-files'] });
const out = process.argv[2];
const list = [['cover_1920x1080', 'land', 1920, 1080], ['cover_1280x720', 'land', 1280, 720], ['cover_portrait_800x1200', 'port', 800, 1200], ['cover_square_800x800', 'square', 800, 800], ['icon_512x512', 'icon', 512, 512]];
for (const [n, k, w, h] of list) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h });
  await p.goto(`file://${process.cwd()}/cover.html?k=${k}&w=${w}&h=${h}`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}/${n}.png`, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}
await b.close();
