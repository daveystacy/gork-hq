# Expire Trading Bot
Live 3D office of the Expire bot team (gork.expire.org). Update with `./update.py` (pushes to Supabase realtime + commits status.json).

`index.html` is the Gork House tower. The penthouse floor is gone, and the roof sits on the top desk. The paper office stays at `office.html`. Scanners stay paused.

## Scanners paused

`js/scanners.js` sets `window.SCANNERS_PAUSED` to true. While that stays true, `office.html` does not run either trading scanner:

- **GORK-SCAN** — terminal scout. No DexScreener sweep, no scout step, no logo pulls.
- **GORK-TRADE** — paper desk. No price refresh, no paper fills, no EBT book poll.

Set the flag to false to resume. The paper book, wallets, keys, and seeds stay put.

The server tick is Supabase pg_cron job `ebt-bg-tick`, which calls the `ebt-bg` edge function. That job is already inactive. Leave it inactive. The live loop in the same function only steps while `ebt_live_state.armed` is true.
