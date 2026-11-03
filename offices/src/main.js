// The page around the 3D office: the office switcher, the team, tasks and activity, and the all-offices sheet.

import { OFFICES, ORDER, GORK, officeFromAddress, officeHref } from './offices.js';
import { loadOffice, loadSummary, loadRequests, ownerOk, decide, loadGork, subscribe, cacheGet, cacheSet, agentView, officeState, STATE_WORD, ago, clock } from './data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '');

const id = officeFromAddress();
const cfg = id ? OFFICES[id] : null;

const S = { requests: [], office: null, summary: cacheGet('summary') || [], gork: cacheGet('gork') || null, conn: 'connecting', realtime: false, lastGood: null };
let office3d = null;
let renderedSig = {};

function setOnce(key, el, html) {
  if (renderedSig[key] === html) return;
  renderedSig[key] = html;
  el.innerHTML = html;
}

// ---------- the switcher

function dotClass(row) { return officeState(row); }

function renderSwitcher() {
  const byId = Object.fromEntries(S.summary.map((r) => [r.id, r]));
  const chips = ORDER.map((k) => {
    const o = OFFICES[k], st = dotClass(byId[k]), on = k === id;
    return `<a class="chip${on ? ' on' : ''}" href="${esc(officeHref(k))}" ${on ? 'aria-current="page"' : ''} aria-label="${esc(o.name)}: ${esc(STATE_WORD[st])}" title="${esc(o.domain)} · ${esc(STATE_WORD[st])}"><i class="dot ${st}"></i>${esc(o.label)}</a>`;
  });
  const g = S.gork;
  const gst = g?.live ? 'working' : 'idle';
  chips.push(`<a class="chip gork" href="https://${GORK.domain}/" aria-label="${esc(GORK.name)}: ${g?.live ? 'scanner running' : 'scanner stopped'}" title="${GORK.domain} · ${g?.live ? 'scanner running' : 'scanner stopped'}"><i class="dot ${gst}"></i>${GORK.label}</a>`);
  setOnce('sw', $('sw'), chips.join(''));
  const waiting = ORDER.filter((k) => dotClass(byId[k]) === 'waiting').length;
  $('allcount').textContent = waiting ? String(waiting) : '';
  $('allcount').hidden = !waiting;
}

// ---------- the office header and panels

function officeRow() { return S.summary.find((r) => r.id === id) || null; }

function renderHeader() {
  const row = officeRow();
  $('focus').textContent = row?.focus || cfg.blurb;
  $('focus').classList.toggle('set', !!row?.focus);
  const chat = safeUrl(row?.chat_url);
  const a = $('chat');
  a.href = chat || '#'; a.toggleAttribute('hidden', !chat);
  const note = $('nochat');
  note.hidden = !!chat;
}

// ---------- decisions: Approve and Decline, for the owner only

const PASS_KEY = 'xpo:owner';
function getPass() { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } }
function setPass(v) { try { if (v) localStorage.setItem(PASS_KEY, v); else localStorage.removeItem(PASS_KEY); } catch { /* private window: asked again next visit */ } }
let memPass = '';
const pass = () => memPass || getPass();
const pendingFor = (k) => S.requests.filter((r) => r.office === k);

function decisionButtons(r) {
  if (!pass()) return '<button class="btn owner" type="button" data-owner>Owner: unlock</button>';
  return `<button class="btn ok" type="button" data-req="${Number(r.id)}" data-do="approved">${esc(r.approve_label)}</button><button class="btn no" type="button" data-req="${Number(r.id)}" data-do="declined">${esc(r.decline_label)}</button>`;
}

function renderAsk() {
  const list = pendingFor(id), r = list[0];
  setOnce('ask', $('ask'), r ? `<b>${list.length > 1 ? `1 of ${list.length}: ` : ''}${esc(r.question)}</b><small>Real money, tokens, NFT purchases and wallet signing are only ever approved in the chat.</small>` : '');
  $('ask').hidden = !r;
  setOnce('askbtns', $('askbtns'), r ? decisionButtons(r) : '');
}

function askPasscode() {
  const d = $('unlock'); $('passerr').hidden = true; $('pass').value = ''; d.showModal(); $('pass').focus();
}

async function onDecision(e) {
  if (e.target.closest('[data-owner]')) { askPasscode(); return; }
  const b = e.target.closest('[data-req]');
  if (!b || b.disabled) return;
  b.parentElement.querySelectorAll('button').forEach((x) => { x.disabled = true; });
  try {
    await decide(pass(), Number(b.dataset.req), b.dataset.do);
    S.requests = S.requests.filter((r) => r.id !== Number(b.dataset.req));
    renderedSig.askbtns = null; renderedSig.allgrid = null;
    if (cfg) renderAsk(); renderAll(); refreshAll();
  } catch (err) {
    b.parentElement.querySelectorAll('button').forEach((x) => { x.disabled = false; });
    if (err.message === 'unauthorized') { memPass = ''; setPass(''); rerenderDecisions(); askPasscode(); $('passerr').textContent = 'That passcode no longer works. Enter the current one.'; $('passerr').hidden = false; }
    else alert('That didn\'t go through, so nothing was decided. Check your connection and try again.');
  }
}

function rerenderDecisions() { renderedSig.askbtns = null; renderedSig.allgrid = null; if (cfg) renderAsk(); renderAll(); }

async function onUnlock(e) {
  e.preventDefault();
  const v = $('pass').value.trim();
  if (!v) return;
  try {
    if (await ownerOk(v)) { memPass = v; setPass(v); $('unlock').close(); rerenderDecisions(); }
    else { $('passerr').textContent = 'That passcode isn\'t right.'; $('passerr').hidden = false; }
  } catch { $('passerr').textContent = 'Couldn\'t check it. Check your connection and try again.'; $('passerr').hidden = false; }
}

function renderConn() {
  const el = $('conn');
  if (S.conn === 'live') { el.className = 'conn live'; el.textContent = 'live'; el.title = 'Connected: changes appear the moment they are reported'; }
  else if (S.conn === 'polling') { el.className = 'conn poll'; el.textContent = 'updating every 5s'; el.title = 'Instant updates aren\'t connected right now, so the page is checking every 5 seconds'; }
  else if (S.conn === 'offline') { el.className = 'conn off'; el.textContent = S.lastGood ? `offline · saved ${clock(S.lastGood)}` : 'offline'; el.title = 'Can\'t reach the office data right now. Showing the last copy saved on this device.'; }
  else { el.className = 'conn'; el.textContent = 'connecting'; el.title = ''; }
}

function renderTeam(agents) {
  const html = agents.map((a) => {
    const heard = a.heard_at ? `heard ${ago(a.age)}` : 'no reports yet';
    const bar = a.view === 'working' && a.progress != null ? `<span class="bar"><b style="width:${Math.max(0, Math.min(100, a.progress))}%;background:${esc(a.color)}"></b></span>` : '';
    return `<button class="ag" data-agent="${esc(a.id)}" title="Show ${esc(a.name)} up close">
      <i class="sw" style="background:${esc(a.color)}"></i>
      <span class="ag-m">
        <span class="ag-l"><b>${esc(a.name)}</b><span class="st ${a.view}">${esc(STATE_WORD[a.view])}</span></span>
        <span class="ag-l sub"><em>${esc(a.role)}</em><small>${esc(heard)}</small></span>
        ${a.task ? `<span class="ag-t">${esc(a.task)}</span>` : ''}${bar}
      </span>
    </button>`;
  }).join('');
  setOnce('team', $('team'), html);
}

const TASK_ORDER = { blocked: 0, 'in-progress': 1, queued: 2, done: 3 };
const TASK_WORD = { blocked: 'blocked', 'in-progress': 'in progress', queued: 'queued', done: 'done' };

function renderTasks(tasks, agents) {
  const names = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => TASK_ORDER[a.status] - TASK_ORDER[b.status] || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => Date.parse(b.finished_at || b.updated_at) - Date.parse(a.finished_at || a.updated_at));
  const row = (t) => {
    const when = t.status === 'done' ? `done ${clock(t.finished_at)}` : t.started_at ? `since ${clock(t.started_at)}` : `added ${clock(t.created_at)}`;
    return `<div class="tk ${esc(t.status)}"><span class="tk-t">${esc(t.title)}</span>${t.note ? `<span class="tk-n">${esc(t.note)}</span>` : ''}<small>${esc(TASK_WORD[t.status])}${t.owner ? ` · ${esc(names[t.owner] || t.owner)}` : ''} · ${esc(when)}</small></div>`;
  };
  let html = '';
  if (!tasks.length) {
    const row0 = officeRow(), chat = safeUrl(row0?.chat_url);
    html = `<div class="empty"><b>No tasks yet</b><span>Send ${esc(cfg.name)} its first task in its chat and it shows up here.</span>${chat ? `<a class="btn" href="${esc(chat)}" target="_blank" rel="noopener">Open chat</a>` : ''}</div>`;
  } else {
    html = open.map(row).join('');
    if (!open.length) html += '<div class="none">Nothing open.</div>';
    if (done.length) html += `<details class="done-list"${open.length ? '' : ' open'}><summary>${done.length} done</summary>${done.slice(0, 30).map(row).join('')}</details>`;
  }
  // keep the done list open if it was open
  const wasOpen = $('tasks').querySelector('details')?.open;
  if (renderedSig.tasks !== html) {
    renderedSig.tasks = html;
    $('tasks').innerHTML = html;
    if (wasOpen) { const d = $('tasks').querySelector('details'); if (d) d.open = true; }
  }
  $('taskcount').textContent = tasks.length ? `${open.length} open` : '';
}

function renderLog(log, agents) {
  const col = Object.fromEntries(agents.map((a) => [a.id, a.color]));
  const html = log.length
    ? log.slice(0, 50).map((l) => `<div class="lg"><time>${esc(clock(l.at))}</time>${l.agent && col[l.agent] ? `<i style="background:${esc(col[l.agent])}"></i>` : ''}<span>${esc(l.msg)}</span></div>`).join('')
    : '<div class="none">Nothing logged yet. Every report lands here and stays.</div>';
  setOnce('log', $('log'), html);
}

function renderHud(agents, tasks) {
  const n = (v) => agents.filter((a) => a.view === v).length;
  const parts = [];
  if (n('waiting')) parts.push(`<span class="warn">${n('waiting')} waiting on you</span>`);
  if (n('working')) parts.push(`<span class="ok">${n('working')} working</span>`);
  if (n('quiet')) parts.push(`<span class="dimw">${n('quiet')} gone quiet</span>`);
  const open = tasks.filter((t) => t.status !== 'done').length;
  parts.push(`${open} open ${open === 1 ? 'task' : 'tasks'}`);
  setOnce('hud', $('hud'), parts.join(' · '));
}

function renderTicker(log) {
  const lines = log.slice(0, 12).map((l) => l.msg);
  const text = lines.length ? lines.join('   ◆   ') : 'no activity yet';
  const span = $('tick').firstElementChild;
  if (span.textContent !== text) span.textContent = text;
  span.classList.toggle('still', lines.length < 2);
}

function renderWall(agents, tasks, log) {
  if (!office3d) return;
  const n = (v) => agents.filter((a) => a.view === v).length;
  const active = tasks.filter((t) => t.status === 'in-progress').slice(0, 3);
  const queued = tasks.filter((t) => t.status === 'queued').length;
  const lines = [[cfg.name.toUpperCase(), cfg.accent]];
  lines.push([`${n('working')} WORKING · ${n('waiting')} WAITING ON YOU`, n('waiting') ? '#f59e0b' : n('working') ? '#22c55e' : '#999']);
  if (active.length) active.forEach((t) => lines.push([t.title, '#fff']));
  else lines.push([queued ? `${queued} queued` : 'waiting for the first task', '#aaa']);
  if (log[0]) lines.push([`last: ${clock(log[0].at)}`, '#777']);
  office3d.drawWall(lines);
}

let lastDone = null;
function renderOffice() {
  if (!S.office || !cfg) return;
  const agents = S.office.agents.map((a) => agentView(a));
  renderTeam(agents); renderTasks(S.office.tasks, agents); renderLog(S.office.log, agents);
  renderHud(agents, S.office.tasks); renderTicker(S.office.log);
  if (office3d) { office3d.setAgents(agents); renderWall(agents, S.office.tasks, S.office.log); }
  // a bot that just finished a task gets to smile about it
  const doneNow = S.office.tasks.filter((t) => t.status === 'done').map((t) => t.id);
  if (lastDone && office3d) S.office.tasks.filter((t) => t.status === 'done' && !lastDone.includes(t.id) && t.owner).forEach((t) => office3d.cheer(t.owner));
  lastDone = doneNow;
  const waiting = agents.filter((a) => a.view === 'waiting').length;
  document.title = `${waiting ? '● ' : ''}${cfg.name} · ${cfg.domain}`;
}

// ---------- all offices

function renderAll() {
  const byId = Object.fromEntries(S.summary.map((r) => [r.id, r]));
  const now = Date.now();
  const need = ORDER.filter((k) => officeState(byId[k], now) === 'waiting');
  $('allhead').textContent = need.length ? `${need.length} of 7 waiting on you: ${need.map((k) => OFFICES[k].label).join(', ')}` : 'Nothing is waiting on you';
  const cards = ORDER.map((k) => {
    const o = OFFICES[k], r = byId[k], st = officeState(r, now), chat = safeUrl(r?.chat_url);
    const counts = r ? [[r.tasks_active, 'active'], [r.tasks_queued, 'queued'], [r.tasks_blocked, 'blocked'], [r.tasks_done, 'done']] : [];
    const act = r?.last_activity ? ago(now - Date.parse(r.last_activity)) : 'no activity yet';
    return `<article class="card${k === id ? ' here' : ''}" style="--a:${o.accent}">
      <header><h3>${esc(o.name)}</h3><span class="st ${st}">${esc(STATE_WORD[st])}</span></header>
      <p class="card-f">${esc(r?.focus || o.blurb)}</p>
      <dl>${counts.map(([v, w]) => `<div><dt>${esc(w)}</dt><dd>${Number(v) || 0}</dd></div>`).join('')}</dl>
      ${pendingFor(k)[0] ? `<p class="card-q">${esc(pendingFor(k)[0].question)}</p>` : ''}
      <small>${esc(o.domain)} · ${esc(act)}</small>
      <div class="card-a">${pendingFor(k)[0] ? decisionButtons(pendingFor(k)[0]) : ''}<a class="btn pri" href="${esc(officeHref(k))}">Enter office</a>${chat ? `<a class="btn" href="${esc(chat)}" target="_blank" rel="noopener">Open chat</a>` : ''}</div>
    </article>`;
  });
  const g = S.gork;
  cards.push(`<article class="card" style="--a:#8b5cf6">
      <header><h3>${esc(GORK.name)}</h3><span class="st ${g?.live ? 'working' : 'idle'}">${g?.live ? 'scanner running' : 'scanner stopped'}</span></header>
      <p class="card-f">The EBT bot's own office and its trading terminal</p>
      <small>${GORK.domain} · ${GORK.terminal}</small>
      <div class="card-a"><a class="btn pri" href="https://${GORK.domain}/">Enter office</a><a class="btn" href="https://${GORK.terminal}/">Open terminal</a></div>
    </article>`);
  setOnce('allgrid', $('allgrid'), cards.join(''));
}

// ---------- data flow

async function refreshOffice() {
  if (!id) return;
  const fresh = await loadOffice(id);
  S.office = fresh; S.lastGood = new Date().toISOString();
  cacheSet(`office:${id}`, { ...fresh, savedAt: S.lastGood });
  renderOffice();
}
async function refreshSummary() {
  S.summary = await loadSummary();
  cacheSet('summary', S.summary);
  renderSwitcher(); if (cfg) renderHeader(); renderAll();
}
async function refreshRequests() {
  S.requests = await loadRequests();
  if (cfg) renderAsk();
  renderAll();
}
async function refreshGork() {
  try { S.gork = await loadGork(); cacheSet('gork', S.gork); renderSwitcher(); renderAll(); } catch { /* the switcher just keeps its last known state */ }
}
async function refreshAll() {
  try {
    await Promise.all([refreshOffice(), refreshSummary(), refreshRequests()]);
    S.conn = S.realtime ? 'live' : 'polling';
  } catch (e) {
    console.warn('office data unavailable', e);
    S.conn = 'offline';
  }
  renderConn();
}

let debounce = null;
function onRealtime() { clearTimeout(debounce); debounce = setTimeout(refreshAll, 150); }

let pollTimer = null;
function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => { if (!document.hidden) await refreshAll(); schedulePoll(); }, S.realtime ? 30e3 : 5e3);
}

// ---------- start

function boot() {
  document.documentElement.style.setProperty('--accent', cfg?.accent || '#e8e8ee');
  const m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (m) m.content = cfg ? cfg.name : 'Expire Offices';

  const dlg = $('all');
  $('askbtns').addEventListener('click', onDecision);
  $('allgrid').addEventListener('click', onDecision);
  $('unlockform').addEventListener('submit', onUnlock);
  $('unlockcancel').addEventListener('click', () => $('unlock').close());
  $('allbtn').addEventListener('click', () => { renderAll(); dlg.showModal(); });
  $('allclose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg && cfg) dlg.close(); });

  if (cfg) {
    document.title = `${cfg.name} · ${cfg.domain}`;
    $('oname').textContent = cfg.name;
    const dom = $('odomain'); dom.textContent = cfg.domain; dom.href = `https://${cfg.domain}/`;
    $('site').textContent = cfg.site[0]; $('site').href = cfg.site[1];
    renderHeader();
    const cached = cacheGet(`office:${id}`);
    if (cached) { S.office = cached; S.lastGood = cached.savedAt; }
    start3d();
    if (cached) renderOffice();
    $('team').addEventListener('click', (e) => {
      const b = e.target.closest('[data-agent]');
      if (b && office3d) { office3d.focus(b.dataset.agent); $('view').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    $('cls').addEventListener('click', () => office3d?.unfocus());
    addEventListener('keydown', (e) => { if (e.key === 'Escape') office3d?.unfocus(); });
  } else {
    // no office in the address (a preview URL): open straight on the overview
    document.title = 'Expire Offices';
    $('main').hidden = true;
    $('allclose').hidden = true;
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    renderAll(); dlg.showModal();
  }
  renderSwitcher(); renderConn();
  $('sw').querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  refreshAll(); refreshGork(); schedulePoll();
  setInterval(refreshGork, 30e3);
  setInterval(() => { if (!document.hidden) { renderOffice(); renderSwitcher(); renderAll(); } }, 30e3); // ages and quiet states move with the clock
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshAll(); refreshGork(); } });
  addEventListener('online', refreshAll);

  subscribe(id, onRealtime, (status) => {
    const was = S.realtime;
    S.realtime = status === 'SUBSCRIBED';
    if (S.conn !== 'offline') S.conn = S.realtime ? 'live' : 'polling';
    renderConn();
    if (S.realtime !== was) { schedulePoll(); if (S.realtime) refreshAll(); }
  });

  setupSound();
}

function start3d() {
  import('./scene.js').then(({ createOffice }) => {
    try {
      office3d = createOffice($('view'), $('ov'), id, cfg);
      office3d.onFocusChange((on) => { $('cls').hidden = !on; $('hint').hidden = on; });
      window.__office = office3d;
      renderOffice();
    } catch (e) {
      console.warn('3D unavailable', e);
      $('view').classList.add('no3d');
      $('no3d').hidden = false;
    }
  }).catch((e) => {
    console.warn('3D failed to load', e);
    $('view').classList.add('no3d');
    $('no3d').hidden = false;
  });
}

function setupSound() {
  const T = [['Across the Room', `https://${GORK.domain}/music/across-the-room.m4a`], ['Southbound Sky', `https://${GORK.domain}/music/southbound-sky.m4a`]];
  const btn = $('snd'), label = $('sndl');
  let on = false, i = 0;
  try { on = localStorage.getItem('xpo:sound') === '1'; } catch { /* no storage: sound stays off */ }
  const a = new Audio(); a.preload = 'none'; a.volume = .32; a.setAttribute('playsinline', '');
  const ui = (playing) => {
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    label.textContent = playing ? T[i][0] : 'Sound';
    btn.classList.toggle('on', playing);
  };
  const play = () => { a.src = T[i][1]; return a.play().then(() => ui(true)).catch(() => ui(false)); };
  a.onended = () => { i = (i + 1) % T.length; play(); };
  btn.addEventListener('click', () => {
    on = !(btn.getAttribute('aria-pressed') === 'true');
    try { localStorage.setItem('xpo:sound', on ? '1' : '0'); } catch { /* fine */ }
    if (on) play(); else { a.pause(); ui(false); }
  });
  // browsers only start sound after a tap, so a remembered "on" resumes on the first tap anywhere
  if (on) addEventListener('pointerdown', function first(e) { removeEventListener('pointerdown', first); if (!btn.contains(e.target)) play(); });
  ui(false);
}

boot();
