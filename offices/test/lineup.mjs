// Poses the five robots in a row, front and back, on the same blue as the owner's reference photos,
// to compare them side by side.   node test/lineup.mjs <folder>
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PUB = path.join(here, '..', 'public');
const out = process.argv[2] || '.';
const require = createRequire(process.env.PW_ROOT || '/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
await new Promise((r) => srv.once('listening', r));
const BASE = `http://localhost:${srv.address().port}/`;
const team = ['liquid', 'smoke', 'chrome', 'glitch', 'box'].map((id, seat) => ({ office: 'gamey', id, name: id, role: '', color: '#888888', seat, state: 'idle', task: '', progress: null, since: new Date().toISOString(), heard_at: null }));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_|WebSocket/.test(m.text())) console.log('ERR', m.text().slice(0, 400)); });
await page.route(/supabase\.co\/rest\/v1\/(.*)/, (r) => {
  const t = new URL(r.request().url()).pathname.split('/').pop();
  r.fulfill({ json: t === 'office_agents' ? team : [], headers: { 'access-control-allow-origin': '*' } });
});
await page.route(/gork\.expire\.org|realtime/, (r) => r.abort());
await page.goto(`${BASE}?office=gamey`);
await page.waitForFunction(() => window.__office && document.querySelectorAll('.ag').length === 6, null, { timeout: 60000 });

const stage = (rot, zoom, y, x0 = 0) => page.evaluate(({ rot, zoom, y, x0 }) => {
  const { debug } = window.__office;
  debug.freeze = true; debug.ctl.enabled = false; debug.ctl.autoRotate = false;
  debug.scene.background = new (debug.scene.children[0].color.constructor)('#6d8cb0');
  document.getElementById('ov').style.display = 'none';
  const ids = ['liquid', 'smoke', 'chrome', 'glitch', 'box'];
  ids.forEach((id, i) => { const b = debug.bots[id]; b.G.position.set((i - 2) * 2.1 + 0, 0, 8.6); b.G.rotation.y = rot; });
  debug.cam.position.set(x0, y, 40); debug.cam.up.set(0, 1, 0); debug.cam.zoom = zoom; debug.cam.updateProjectionMatrix(); debug.cam.lookAt(x0, y, 8);
}, { rot, zoom, y, x0 });

await stage(0, 2.05, 2.0);
await page.waitForTimeout(6000);
const box = await page.locator('#view').evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const shot = (name) => page.screenshot({ path: path.join(out, name), clip: box, timeout: 90000, animations: 'allow' });
await shot('lineup-front.png');
await stage(Math.PI, 2.05, 2.0);
await page.waitForTimeout(3500);
await shot('lineup-back.png');
await stage(.7, 6.2, 2.9, -2.1);
await page.waitForTimeout(3500);
await shot('lineup-heads-left.png');
await stage(.7, 6.2, 2.9, 2.1);
await page.waitForTimeout(3500);
await shot('lineup-heads-right.png');
await browser.close(); srv.close();
