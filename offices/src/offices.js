// The seven offices. One page serves them all; the address decides which office you are in.
// Teams, tasks and activity live in Supabase (see sql/). This file only holds what never changes.

export const SB = 'https://szpczmrvthxkdaxqzlqk.supabase.co';
export const PK = 'sb_publishable_yEG-pRaQg9BZg4DM9ibxCg_JLuX0hLy'; // public, read-only by design (same key gork.expire.org uses)

export const OFFICES = {
  gamey: {
    label: 'Game', name: 'Game Office', domain: 'gamey.expire.org', accent: '#38bdf8',
    blurb: 'expireverse, the ECA campus and every game mode',
    site: ['Open Play', 'https://expire.org/index.html#app=hub'],
  },
  tradey: {
    label: 'Trade', name: 'Trade Office', domain: 'tradey.expire.org', accent: '#f5c542',
    blurb: 'expiretrade: markets, Launchpad, Social and Live',
    site: ['Open expiretrade', 'https://expire.org/index.html#app=trade'],
  },
  arty: {
    label: 'NFT', name: 'NFT Office', domain: 'arty.expire.org', accent: '#a78bfa',
    blurb: 'The NFT marketplace: collections, items and live data',
    site: ['Open marketplace', 'https://expire.org/index.html#nfts'],
  },
  betty: {
    label: 'Casino', name: 'Casino Office', domain: 'betty.expire.org', accent: '#fb7185',
    blurb: 'betexpire: tables, slots and sports on practice SOL',
    site: ['Open betexpire', 'https://expire.org/index.html#app=casino'],
  },
  story: {
    label: 'Shop', name: 'Shop Office', domain: 'story.expire.org', accent: '#e8e8ee',
    blurb: 'The EXPIRE apparel store and the 2027 collection',
    site: ['Open shop', 'https://shop.expire.org'],
  },
  minty: {
    label: 'Mint', name: 'Mint Office', domain: 'minty.expire.org', accent: '#34d399',
    blurb: 'The new NFT collections and their gamified mint pages',
    site: ['Open expiremints', 'https://expire.org/expiremints/'],
  },
  lobby: {
    label: 'Lobby', name: 'Lobby Office', domain: 'lobby.expire.org', accent: '#fb923c',
    blurb: 'The 3D lobby: Expire Bank, portals and poker tables',
    site: ['Open lobby', 'https://expire.org/lobby.html'],
  },
};

export const ORDER = ['gamey', 'tradey', 'arty', 'betty', 'story', 'minty', 'lobby'];

// the trading bot's office already exists on its own page; it sits in the switcher so one tab reaches everything
export const GORK = { label: 'GORK', name: 'Expire Trading Bot', domain: 'gork.expire.org', terminal: 'terminal.expire.org' };

// an agent that says it is working but has not reported for this long is shown as quiet, not as working
export const QUIET_MS = 20 * 60e3;

export function officeFromAddress(loc = location) {
  const asked = new URLSearchParams(loc.search).get('office');
  if (asked && OFFICES[asked]) return asked;
  const sub = loc.hostname.split('.')[0];
  return OFFICES[sub] ? sub : null;
}

export function officeHref(id, loc = location) {
  const onLiveDomain = /(^|\.)expire\.org$/.test(loc.hostname);
  return onLiveDomain ? `https://${OFFICES[id].domain}/` : `?office=${id}`;
}
