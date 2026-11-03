// Loads every office in a real browser against fixture data (Supabase is mocked, so this runs anywhere) and checks
// what the owner relies on: no errors, no sideways scroll, reports appear without a reload, and an agent
// that stops reporting is never shown as working.
//   node test/run.mjs [screenshot-folder]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PUB = path.join(here, '..', 'public');
const shots = process.argv[2] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const require = createRequire(process.env.PW_ROOT || '/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
}).listen(0);
await new Promise((r) => srv.once('listening', r));
const BASE = `http://localhost:${srv.address().port}/`;

const OFFICES = ['gamey', 'tradey', 'arty', 'betty', 'story', 'minty', 'lobby'];
const NAMES = { gamey: 'Game Office', tradey: 'Trade Office', arty: 'NFT Office', betty: 'Casino Office', story: 'Shop Office', minty: 'Mint Office', lobby: 'Lobby Office' };
const iso = (minsAgo = 0) => new Date(Date.now() - minsAgo * 60e3).toISOString();
const team = (o) => [
  ['a0', 'World', 'campus, maps and levels', '#ff9a1f'], ['a1', 'Characters', 'models and rigs', '#3b82ff'], [o, o[0].toUpperCase() + o.slice(1), 'office lead', '#dfe6ff'],
  ['a3', 'Gameplay', 'modes and controls', '#2dff7a'], ['a4', 'Playtest', 'browser tests', '#a24bff'], ['a5', 'Assist', 'helps wherever it is needed', '#e8e8ee'],
].map(([id, name, role, color], seat) => ({ office: o, id, name, role, color, seat, state: 'idle', task: '', progress: null, since: iso(60), heard_at: null }));

function blankWorld() {
  const w = { agents: {}, tasks: {}, log: {} };
  for (const o of OFFICES) { w.agents[o] = team(o); w.tasks[o] = []; w.log[o] = []; }
  return w;
}
function summary(w) {
  return OFFICES.map((o) => {
    const ag = w.agents[o], t = w.tasks[o], working = ag.filter((a) => a.state === 'working');
    return {
      id: o, name: NAMES[o], domain: `${o}.expire.org`, chat_url: `https://claude.ai/code/session_test${o}`, chat_online_at: iso(1), focus: w.focus?.[o] || '',
      working: working.length, waiting: ag.filter((a) => a.state === 'waiting_user').length,
      heard_at: iso(1), working_heard_at: working.length ? working.map((a) => a.heard_at).sort().at(-1) : null,
      tasks_active: t.filter((x) => x.status === 'in-progress').length, tasks_queued: t.filter((x) => x.status === 'queued').length,
      tasks_blocked: t.filter((x) => x.status === 'blocked').length, tasks_done: t.filter((x) => x.status === 'done').length,
      last_activity: w.log[o][0]?.at || null,
    };
  });
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'pass' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };

async function openOffice(ctx, office, world) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|WebSocket/.test(m.text())) errors.push(m.text()); });
  await page.route(/supabase\.co\/rest\/v1\/(.*)/, (r) => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), o = (u.searchParams.get('office') || '').replace('eq.', '');
    let json = [];
    if (table === 'office_owner_check') { json = JSON.parse(r.request().postData()).p_pass === 'right-pass'; return r.fulfill({ json, headers: { 'access-control-allow-origin': '*' } }); }
    if (table === 'office_answer') {
      const b = JSON.parse(r.request().postData());
      if (b.p_pass !== 'right-pass') return r.fulfill({ status: 403, json: { code: '42501', message: 'unauthorized' } });
      const q = (world.requests || []).find((x) => x.id === b.p_id && x.status === 'pending');
      if (!q) return r.fulfill({ status: 400, json: { code: 'P0002', message: 'closed' } });
      Object.assign(q, { status: 'answered', answer: b.p_answer, answered_at: iso(0) });
      return r.fulfill({ json: { ok: true } });
    }
    if (table === 'office_requests') json = (world.requests || []).filter((x) => x.status === 'pending' || !x.seen_at);
    else if (table === 'office_agents') json = world.agents[o] || [];
    else if (table === 'office_tasks') json = world.tasks[o] || [];
    else if (table === 'office_log') json = world.log[o] || [];
    else if (table === 'office_summary') json = summary(world);
    else if (table === 'ebt_bg_state') json = [{ running: true, last_tick: iso(0) }];
    r.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route(/gork\.expire\.org|realtime/, (r) => r.abort());
  await page.goto(`${BASE}?office=${office}`);
  return { page, errors };
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

// 1. every office, freshly set up: real name, three.js running, no errors, no sideways scroll
for (const o of process.env.QUICK ? ['minty', 'betty'] : OFFICES) {
  const world = blankWorld();
  for (const [ctx, label] of [[desktop, 'desktop'], [phone, 'phone']]) {
    const { page, errors } = await openOffice(ctx, o, world);
    await page.waitForFunction(() => window.__office && document.querySelectorAll('.ag').length === 6, null, { timeout: 45000 });
    await page.waitForTimeout(label === 'desktop' ? 2500 : 1500);
    const title = await page.title();
    check(title.includes(NAMES[o]), `${o} ${label}: title says ${NAMES[o]}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, `${o} ${label}: no sideways scroll (${over}px)`);
    const canvas = await page.evaluate(() => !!document.querySelector('#view canvas'));
    check(canvas, `${o} ${label}: 3D office drew`);
    const empty = await page.locator('#tasks .empty').count();
    check(empty === 1, `${o} ${label}: empty task list explains itself`);
    check(errors.length === 0, `${o} ${label}: no page errors ${errors.slice(0, 2).join(' | ')}`);
    if (shots) await page.screenshot({ path: path.join(shots, `${o}-${label}.png`) });
    await page.close();
  }
}

// 2. reports appear without a reload, and survive one
{
  const world = blankWorld();
  const { page, errors } = await openOffice(desktop, 'gamey', world);
  await page.waitForFunction(() => window.__office && document.querySelectorAll('.ag').length === 6, null, { timeout: 45000 });
  const a0 = world.agents.gamey[0];
  Object.assign(a0, { state: 'working', task: 'Blocking out the ECA dorms', progress: 35, heard_at: iso(0) });
  world.tasks.gamey.push({ id: 1, office: 'gamey', title: 'Block out the ECA dorms', owner: 'a0', status: 'in-progress', note: '', created_at: iso(1), started_at: iso(1), finished_at: null, updated_at: iso(0) });
  world.log.gamey.unshift({ id: 1, office: 'gamey', at: iso(0), agent: 'a0', kind: 'state', msg: 'World → working: Blocking out the ECA dorms' });
  await page.waitForFunction(() => document.querySelector('#team')?.textContent.includes('Blocking out the ECA dorms'), null, { timeout: 45000 });
  check(true, 'a new report shows in the team panel without a reload');
  await page.waitForFunction(() => [...document.querySelectorAll('.bb')].some((b) => b.textContent.includes('Blocking out') && b.style.display !== 'none'), null, { timeout: 120000 });
  check(true, 'the bot walks to its desk and its bubble shows the task');
  check((await page.locator('#tasks .tk.in-progress').count()) === 1, 'the task shows as in progress');
  check((await page.locator('#log .lg').count()) === 1, 'the activity log has the line');
  check((await page.locator('#hud .ok').textContent()).includes('1 working'), 'the HUD counts 1 working');
  if (shots) { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(shots, 'gamey-working.png') }); }

  // waiting on the owner: amber everywhere, including the switcher and the tab title
  Object.assign(world.agents.gamey[2], { state: 'waiting_user', task: 'Which dorm layout do you want?', heard_at: iso(0) });
  await page.waitForFunction(() => document.title.startsWith('●'), null, { timeout: 45000 });
  check(true, 'waiting on you marks the tab title');
  check((await page.locator('.chip.on .dot.waiting').count()) === 1, 'waiting on you marks the switcher');

  // gone quiet: an agent that claims to be working but stopped reporting must not be shown as working
  a0.heard_at = iso(45);
  await page.waitForFunction(() => document.querySelector('#team .st.quiet'), null, { timeout: 45000 });
  check(true, 'an agent silent for 45 minutes shows as gone quiet, not working');
  await page.waitForFunction(() => [...document.querySelectorAll('.bb')].some((b) => /no report for/.test(b.textContent)), null, { timeout: 45000 });
  check(true, 'its bubble says how long it has been silent');
  if (shots) await page.screenshot({ path: path.join(shots, 'gamey-quiet.png') });

  // reload: state comes back (from the data, and instantly from the device copy)
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#team')?.textContent.includes('Which dorm layout'), null, { timeout: 30000 });
  check(true, 'state survives a reload');

  // offline: says so and keeps showing the saved copy
  await page.route(/supabase\.co\/rest\/v1\/(.*)/, (r) => r.abort());
  await page.waitForFunction(() => document.querySelector('#conn')?.classList.contains('off'), null, { timeout: 45000 });
  check(/saved/.test(await page.locator('#conn').textContent()), 'offline says offline and when the copy was saved');
  check((await page.locator('#team').textContent()).includes('Which dorm layout'), 'offline keeps showing the saved team');
  check(errors.length === 0, `no page errors in the live flow ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

// 3. all offices sheet opens from anywhere, and is the landing view with no office in the address
{
  const world = blankWorld();
  Object.assign(world.agents.tradey[2], { state: 'waiting_user', task: 'Ready for your first task', heard_at: iso(0) });
  Object.assign(world.agents.minty[1], { state: 'working', task: 'ExpireBings mint page', progress: 60, heard_at: iso(1) });
  world.tasks.minty.push({ id: 2, office: 'minty', title: 'ExpireBings mint page', owner: 'a1', status: 'in-progress', note: '', created_at: iso(10), started_at: iso(9), finished_at: null, updated_at: iso(1) });
  const { page } = await openOffice(desktop, 'gamey', world);
  await page.waitForFunction(() => window.__office && document.querySelectorAll('.ag').length === 6, null, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('#sw .dot.waiting'), null, { timeout: 30000 });
  await page.click('#allbtn');
  await page.waitForFunction(() => document.querySelectorAll('#allgrid .card').length === 8);
  check(true, 'all offices shows 7 offices + GORK');
  check((await page.locator('#allhead').textContent()).includes('Trade'), 'all offices names who is waiting on you');
  if (shots) await page.screenshot({ path: path.join(shots, 'all-offices.png') });
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.getElementById('all').open), 'Esc closes it');
  await page.close();

  const p2 = await desktop.newPage();
  await p2.route(/supabase\.co\/rest\/v1\/(.*)/, (r) => r.fulfill({ json: /office_summary/.test(r.request().url()) ? summary(world) : [], headers: { 'access-control-allow-origin': '*' } }));
  await p2.route(/gork\.expire\.org|realtime/, (r) => r.abort());
  await p2.goto(BASE);
  await p2.waitForFunction(() => document.getElementById('all').open && document.querySelectorAll('#allgrid .card').length === 8);
  check(true, 'no office in the address lands on the overview');
  await p2.close();
}

// 4. a chat's question becomes buttons next to Open chat; the passcode is asked once, then a click answers
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const world = blankWorld();
  world.agents.minty[2].state = 'waiting_user';
  world.requests = [
    { id: 1, office: 'minty', agent: 'minty', question: 'Merge the mint page PR to expire.org?', options: ['Approve', 'Decline'], status: 'pending', created_at: iso(1) },
    { id: 2, office: 'minty', agent: 'minty', question: 'Which hero image?', options: ['Dark', 'Light', 'Hold off'], status: 'pending', created_at: iso(0) },
  ];
  const { page, errors } = await openOffice(ctx, 'minty', world);
  await page.waitForSelector('#askbtns [data-ans="Approve"]', { timeout: 45000 });
  check(await page.evaluate(() => { const a = document.querySelector('#askbtns [data-ans="Approve"]').getBoundingClientRect(), c = document.getElementById('chat').getBoundingClientRect(); return Math.abs(a.top - c.top) < 4 && a.right <= c.left; }), 'Approve sits right next to Open chat');
  check((await page.locator('#askq').textContent()).includes('Merge the mint page PR') && (await page.locator('#askq').textContent()).includes('1 of 2'), 'the question shows with how many are waiting');
  if (shots) await page.screenshot({ path: path.join(shots, 'ask-desktop.png') });
  await page.click('#askbtns [data-ans="Approve"]');
  await page.waitForSelector('#pass[open]');
  await page.fill('#passin', 'wrong'); await page.click('#passgo');
  await page.waitForFunction(() => document.getElementById('passerr').textContent.includes("didn't match"));
  check(world.requests[0].status === 'pending', 'a wrong passcode answers nothing');
  await page.fill('#passin', 'right-pass'); await page.click('#passgo');
  await page.waitForFunction(() => document.getElementById('askq').textContent.includes('Which hero image'));
  check(world.requests[0].answer === 'Approve', 'the right passcode sends the answer that was clicked');
  check((await page.locator('#askbtns .btn').count()) === 3, 'the next question brings its own choices');
  await page.click('#askbtns [data-ans="Dark"]');
  await page.waitForFunction(() => document.getElementById('askq').textContent.includes("hasn't picked this up"));
  check(world.requests[1].answer === 'Dark' && !(await page.locator('#pass[open]').count()), 'the second click needs no passcode');
  check((await page.locator('#askbtns .btn').count()) === 0, 'buttons leave once answered, and the office says the chat has not picked it up');
  world.requests.forEach((r) => { r.seen_at = iso(0); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('hud')?.textContent !== 'loading…', null, { timeout: 45000 });
  await page.waitForTimeout(800);
  check(await page.locator('#askq').isHidden(), 'once the chat picks it up the note clears');
  check(errors.length === 0, `no page errors on the answer flow ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
  const p2 = await phone.newPage();
  const w2 = blankWorld();
  w2.requests = [{ id: 3, office: 'minty', agent: 'minty', question: 'Merge the mint page PR to expire.org? It changes the home page hero and the mint button on every collection.', options: ['Approve', 'Decline'], status: 'pending', created_at: iso(0) }];
  await p2.close();
  const { page: ph } = await openOffice(phone, 'minty', w2);
  await ph.waitForSelector('#askbtns [data-ans="Approve"]', { timeout: 45000 });
  await ph.waitForTimeout(800);
  check((await ph.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'phone: buttons cause no sideways scroll');
  if (shots) await ph.screenshot({ path: path.join(shots, 'ask-phone.png') });
  await ph.close();
  // the all-offices sheet answers too
  const { page: pa } = await openOffice(ctx, 'gamey', w2);
  await pa.click('#allbtn');
  await pa.waitForSelector('.card [data-ans="Approve"]', { timeout: 15000 });
  check(true, 'the all-offices sheet shows the buttons');
  if (shots) await pa.screenshot({ path: path.join(shots, 'ask-all.png') });
  await pa.close();
  await ctx.close();
}

await browser.close();
srv.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
