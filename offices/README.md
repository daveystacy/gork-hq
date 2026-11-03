# Expire offices

One live 3D office per project, all from this folder, all reachable from one tab.

| Office | Address | Lead |
| --- | --- | --- |
| Game Office | gamey.expire.org | Gamey |
| Trade Office | tradey.expire.org | Tradey |
| NFT Office | arty.expire.org | Arty |
| Casino Office | betty.expire.org | Betty |
| Shop Office | story.expire.org | Story |
| Mint Office | minty.expire.org | Minty |
| Lobby Office | lobby.expire.org | Lobby |

The trading bot's office, gork.expire.org, is the page at the root of this repo (GitHub Pages). It shares the switcher.

## How it works

- `public/` is what Vercel serves (project `expire-offices`, root directory `offices/public`, no build step on Vercel). The address decides which office the page shows. `?office=gamey` does the same on a preview URL; no office in the address opens the all-offices view.
- `src/` is the source: `offices.js` (the list), `data.js` (reads and the honest-state rules), `scene.js` (the room and the Expirites), `themes.js` (each office's set piece), `main.js` (the panels).
- State lives in Supabase project `expire`, tables `offices`, `office_agents`, `office_tasks`, `office_log` (schema in `sql/`). Anyone can read; the public API can't write.
- Changes appear through Supabase Realtime, with polling as the fallback, and the page says which one it is on.

## What the office will and won't show

- Only real reports. Nothing on the floor is simulated; idle bots wander because they are idle.
- An agent that says it is working but hasn't reported for 20 minutes shows as **gone quiet**, with how long it has been silent. It is never shown as working on old information.
- **Waiting on you** turns amber on the floor, in the switcher, in All offices and in the tab title.
- Decor carries no prices, balances or mint counts. The only numbers in an office are real ones.
- No secrets, wallet addresses or personal details in reports: the offices are public pages.

## Reporting (from a Claude chat with the Supabase connector)

Run these with `execute_sql` on project `szpczmrvthxkdaxqzlqk`. They aren't exposed to the public API, so no token is needed.

```sql
select office_report('gamey','world','working','Blocking out the ECA dorms',35);   -- office, agent, state, task, percent or null
select office_report('gamey','gamey','waiting_user','Which dorm layout do you want?'); -- needs the owner
select office_report('gamey','world','idle');                                       -- finished, clears the task

select office_task_add('gamey','Block out the ECA dorms','world','in-progress');    -- returns the task id
select office_task_set(12,'done','Merged PR #91');                                  -- queued | in-progress | blocked | done

select office_log_add('gamey','Preview: https://…','world','deploy');               -- kinds: note state task deploy commit chat
select office_focus('gamey','ECA dorms, first floor');                              -- the headline under the office name
```

States: `idle`, `working`, `meeting`, `waiting_user`. Every `office_report` counts as proof of life, so repeat it while working (at least every 10 minutes).

## Reporting (from anything else)

Scripts and other AIs use `office_api` over HTTP with a token (see `office.py`). The token's SHA-256 lives in `office_secret`; set one with:

```sql
insert into office_secret (id, token_sha256) values (1, encode(sha256(convert_to('<token>','UTF8')),'hex'))
on conflict (id) do update set token_sha256 = excluded.token_sha256;
```

## Working on it

```
cd offices
npm ci
node build.mjs            # writes public/ (commit it: Vercel serves it as is)
node test/run.mjs shots   # real browser against fixture data; screenshots go in shots/
```

Pushes to `main` that touch `offices/public` deploy all seven offices at once. Status commits to gork's `status.json` don't.
