// Everything the page knows comes from here: real rows in Supabase, nothing simulated.
// Realtime pushes a change as soon as it lands; polling covers the moments realtime can't connect;
// the last good copy is kept on the device so the page opens instantly and says how old it is when offline.

import { SB, PK, QUIET_MS } from './offices.js';

async function rest(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: PK }, cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function loadOffice(id) {
  const [agents, tasks, log] = await Promise.all([
    rest(`office_agents?office=eq.${id}&select=*&order=seat`),
    rest(`office_tasks?office=eq.${id}&select=*&order=updated_at.desc&limit=80`),
    rest(`office_log?office=eq.${id}&select=*&order=at.desc,id.desc&limit=60`),
  ]);
  return { agents, tasks, log };
}

export const loadSummary = () => rest('office_summary?select=*');

export async function loadGork() {
  const rows = await rest('ebt_bg_state?id=eq.main&select=running,last_tick');
  const row = rows[0];
  if (!row) return { live: false, running: false };
  const fresh = row.last_tick && Date.now() - Date.parse(row.last_tick) < 90e3;
  return { running: !!row.running, live: !!(row.running && fresh) };
}

export async function subscribe(office, onChange, onStatus) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SB, PK, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const ch = sb.channel(`offices-${office || 'all'}`);
    const on = (table, filter) => ch.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (p) => onChange(table, p));
    on('offices');
    on('office_agents');
    on('office_tasks', office ? `office=eq.${office}` : undefined);
    on('office_log', office ? `office=eq.${office}` : undefined);
    ch.subscribe((status) => onStatus(status));
  } catch (e) {
    console.warn('realtime unavailable', e);
    onStatus('FAILED');
  }
}

// ---- device copy (a convenience: the page works without it)

export function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem(`xpo:${key}`)); } catch { return null; }
}
export function cacheSet(key, value) {
  try { localStorage.setItem(`xpo:${key}`, JSON.stringify(value)); } catch { /* private window or full storage */ }
}

// ---- honest state: what an agent's last report actually supports

export function agentView(a, now = Date.now()) {
  const heard = a.heard_at ? Date.parse(a.heard_at) : 0;
  const age = heard ? now - heard : Infinity;
  let view = 'idle';
  if (a.state === 'working') view = age > QUIET_MS ? 'quiet' : 'working';
  else if (a.state === 'waiting_user') view = 'waiting';
  else if (a.state === 'meeting') view = age > QUIET_MS ? 'idle' : 'meeting';
  return { ...a, view, age };
}

export function officeState(s, now = Date.now()) {
  if (!s) return 'idle';
  if (s.waiting > 0) return 'waiting';
  if (s.working > 0) {
    const heard = s.working_heard_at ? Date.parse(s.working_heard_at) : 0;
    return heard && now - heard <= QUIET_MS ? 'working' : 'quiet';
  }
  return 'idle';
}

export const STATE_WORD = { working: 'working', waiting: 'waiting on you', quiet: 'gone quiet', meeting: 'in a meeting', idle: 'idle' };

export function ago(ms) {
  if (!isFinite(ms)) return 'never';
  const m = Math.max(0, Math.round(ms / 60e3));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clock(t) {
  if (!t) return '';
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString([], today ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
