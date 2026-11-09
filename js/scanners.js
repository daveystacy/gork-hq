/* Kill switch for the two trading scanners.
   Default is paused. Resume by setting this to false and redeploying.
   Nothing here deletes books, wallets, keys, or seeds.

   1. GORK-SCAN — Terminal Trading Scanner.
      Live house (expire.org/Gork, repo daveystacy/expire): paper-desk.js
      scout(), every 15s, started by PaperDesk.start() in js/hq.js.
      This office mirrors that scout and must not pull DexScreener while paused.
   2. GORK-TRADE — Trading Platform paper desk.
      Live house: paper-desk.js refresh(), every 3s, same start().
      Server twin: Supabase edge function ebt-bg paperLoop, woken by
      pg_cron job ebt-bg-tick. That job is already inactive. The live
      loop in the same function only steps while ebt_live_state.armed
      is true (it is not). */
window.SCANNERS_PAUSED = true;
