(function(){"use strict";
/* ---- data: status.json is loaded when served; this copy is the fallback for file:// ---- */
const FALLBACK={"title": "Expire Grok Bot HQ", "mode": "PAPER / DRAFT ONLY", "desks": [{"id": "trade", "floor": "10F", "row": 1, "name": "Trading Platform", "gork": "GORK-TRADE", "cls": "TRADE", "color": "#a24bff", "glow": "#c58bff", "role": "Paper Solana desk · real public prices, simulated fills", "state": "working", "summary": "Paper desk live on DexScreener public data. Simulated fills only — no wallet, no live orders.", "file": "pnl-paper.md", "prompt": "paper-trade the SOL desk.\nreal prices, simulated fills.\nnever place a live order.", "work": ["paper-trading SOL pairs", "scoring watchlist", "logging paper PnL"], "logs": ["GORK-TRADE online · Trading Platform"]}, {"id": "shop", "floor": "9F", "row": 2, "name": "Shop", "gork": "GORK-SHOP", "cls": "SHOP", "color": "#ff9a1f", "glow": "#ffc067", "role": "merch + storefront drafts", "state": "waiting", "summary": "Storefront layout + 6 product drafts ready. Nothing listed, nothing charged.", "file": "shop-draft.md", "prompt": "draft the storefront.\nno listings live. no checkout.", "work": ["drafting product cards", "pricing grid (draft)"], "logs": ["GORK-SHOP online · Shop", "waiting on davey: Approve shop draft layout (no listing, no checkout)"], "ask": "Approve shop draft layout (no listing, no checkout)"}, {"id": "nft", "floor": "8F", "row": 3, "name": "NFT Marketplace", "gork": "GORK-NFT", "cls": "NFT", "color": "#ff4fd8", "glow": "#ff9be9", "role": "10k collection · marketplace drafts", "state": "waiting", "summary": "10k trait weights + marketplace page draft. Nothing minted, nothing listed.", "file": "nft-marketplace.md", "prompt": "draft the marketplace page.\nnever mint. never list.", "work": ["weighting traits", "drafting collection page"], "logs": ["GORK-NFT online · NFT Marketplace", "waiting on davey: Approve NFT marketplace page draft"], "ask": "Approve NFT marketplace page draft"}, {"id": "game", "floor": "7F", "row": 4, "name": "Game", "gork": "GORK-GAME", "cls": "GAME", "color": "#2dff7a", "glow": "#8dffb8", "role": "game loop + art references", "state": "working", "summary": "Building the game design doc and art reference board. Local only.", "file": "game-design.md", "prompt": "draft the game loop.\nlocal prototype only.", "work": ["writing game loop", "sorting art references", "balancing XP curve"], "logs": ["GORK-GAME online · Game"]}, {"id": "coin", "floor": "6F", "row": 5, "name": "Coin", "gork": "GORK-COIN", "cls": "COIN", "color": "#ffd23f", "glow": "#ffe68a", "role": "token page + honest claims", "state": "ready", "summary": "Coin explainer + never-claim list drafted. No launch, no contract.", "file": "coin-brief.md", "prompt": "explain the coin honestly.\nnever-claim list.\nno contract, no launch.", "work": ["checking never-claim list"], "logs": ["GORK-COIN online · Coin"]}, {"id": "mint", "floor": "5F", "row": 6, "name": "Mint Page", "gork": "GORK-MINT", "cls": "MINT", "color": "#19e6ff", "glow": "#8af3ff", "role": "mint landing · DRAFT ONLY", "state": "waiting", "summary": "Mint page preview has DRAFT ONLY banner; Connect/Mint buttons are fake. No deploy.", "file": "mint-page.md", "prompt": "mint page preview only.\nfake connect. no deploy. no spend.", "work": ["tightening mint copy"], "logs": ["GORK-MINT online · Mint Page", "waiting on davey: Approve mint page copy (stays draft, no deploy)"], "ask": "Approve mint page copy (stays draft, no deploy)"}, {"id": "casino", "floor": "4F", "row": 7, "name": "Casino", "gork": "GORK-CASINO", "cls": "CASINO", "color": "#ff2e88", "glow": "#ff86bb", "role": "casino concept · compliance first", "state": "held", "summary": "Concept on hold pending legal/compliance review. Nothing built that takes money.", "file": "casino-concept.md", "prompt": "concept doc only.\ncompliance checklist first.\nno real-money flows.", "work": ["compliance checklist"], "logs": ["GORK-CASINO online · Casino"]}, {"id": "book", "floor": "3F", "row": 8, "name": "Betting Sports Book", "gork": "GORK-BOOK", "cls": "BOOK", "color": "#3b82ff", "glow": "#7fb0ff", "role": "sportsbook concept · odds UI mock", "state": "ready", "summary": "Odds board UI mock drafted with fake lines. No wagers, no payments.", "file": "sportsbook-mock.md", "prompt": "odds UI mock only.\nfake lines. no wagers.", "work": ["mocking odds board"], "logs": ["GORK-BOOK online · Betting Sports Book"]}, {"id": "betapp", "floor": "2F", "row": 9, "name": "Sports Betting App", "gork": "GORK-BETAPP", "cls": "BETAPP", "color": "#ff3b4e", "glow": "#2dff7a", "role": "BetExpire phone app · installable PWA · practice credits only", "state": "ready", "summary": "BetExpire turned into a phone-installable app (manifest, icons, splash, offline shell). Local server on :8796 — no deploy, play credits only, no real-money wagers.", "file": "Desktop/BetExpire-PWA/README.md", "prompt": "package BetExpire as a home-screen app.\nlocal only. practice credits.\nno deploy. no real-money wagers.", "work": ["packaging BetExpire PWA", "app icon + splash", "offline shell (sw.js)"], "logs": ["GORK-BETAPP online · Sports Betting App", "BetExpire PWA ready at Desktop/BetExpire-PWA · :8796"]}, {"id": "scan", "floor": "1F", "row": 10, "name": "Terminal Trading Scanner", "gork": "GORK-SCAN", "cls": "SCAN", "color": "#dfe6ff", "glow": "#ffffff", "role": "terminal scanner · Scout→Filter→Analyst", "state": "working", "summary": "Scanner sweeps public DexScreener boosts/profiles and feeds the paper desk. Read-only.", "file": "scanner.md", "prompt": "sweep public pairs.\nfilter, score, hand to paper desk.\nread-only.", "work": ["sweeping DexScreener boosts", "filtering liquidity", "scoring candidates"], "logs": ["GORK-SCAN online · Terminal Trading Scanner"]}]};
const KEY="expireHQ.v2";
const $=id=>document.getElementById(id);
let DATA=null,D=[],sel=null;
let local=JSON.parse(localStorage.getItem(KEY)||"{}");
local.desks=local.desks||{};
local.killed=!!local.killed;
local.xp=Number.isFinite(+local.xp)?Math.max(0,+local.xp)|0:0;
local.ach=Array.isArray(local.ach)?local.ach:[];
local.stats=local.stats&&typeof local.stats==="object"?local.stats:{approves:0,holds:0,clears:0};
local.undo=Array.isArray(local.undo)?local.undo:[];
const AKEY="expireHQ.approvals.v1";
const save=()=>{const raw=JSON.stringify(local);localStorage.setItem(KEY,raw);try{onExternalHQChange._sig=raw}catch(e){}try{syncApprovalsStore()}catch(e){}};
/* ---- XP / levels / achievements (illustrative, localStorage only) ---- */
const XP_APPROVE=50,XP_HOLD=15,XP_PER_LEVEL=100;
const ACH=[
  {id:"first_approve",icon:"✓",name:"First Approve",desc:"+50 XP on your first Approve"},
  {id:"five_approves",icon:"5️⃣",name:"Five Approves",desc:"Approve 5 local decisions"},
  {id:"cleared_queue",icon:"🧹",name:"Cleared Queue",desc:"Clear every waiting card"},
  {id:"night_shift",icon:"🌙",name:"Night Shift",desc:"Act between 22:00–06:00 CT"},
  {id:"first_hold",icon:"⏸",name:"On Hold",desc:"Hold a desk for later"},
  {id:"ten_approves",icon:"👑",name:"Desk Boss",desc:"Approve 10 local decisions"},
  {id:"first_paper",icon:"◎",name:"First Paper Fill",desc:"Simulated fill on the Paper Desk"},
  {id:"green_close",icon:"📈",name:"Green Close",desc:"Close a paper position in profit"}
];
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
function levelOf(xp){return Math.floor(xp/XP_PER_LEVEL)+1}
function xpIntoLevel(xp){return xp%XP_PER_LEVEL}
function renderXP(){
  const xp=local.xp|0,lv=levelOf(xp),into=xpIntoLevel(xp),pct=Math.min(100,Math.round(into/XP_PER_LEVEL*100));
  const a=$("xplvl"),b=$("xplvl2"),c=$("xppoints"),d=$("xpbar");
  if(a)a.textContent=lv;if(b)b.textContent=lv;if(c)c.textContent=xp;if(d)d.style.width=pct+"%";
  const hud=$("xphud");if(hud)hud.style.setProperty("--ring",pct+"%");
  const rk=$("xprank");if(rk)rk.textContent=["INTERN","DESK LEAD","FLOOR BOSS","TOWER CHIEF","TOWER LEAD"][Math.min(4,Math.floor((lv-1)/2))];
  const strip=$("achstrip");if(!strip)return;
  const unlocked=new Set(local.ach);
  strip.innerHTML=ACH.map(x=>{
    const on=unlocked.has(x.id);
    return `<span class="ach${on?" on":""}" title="${esc(x.name)} — ${esc(x.desc)}${on?" · unlocked":" · locked"}">${x.icon}</span>`;
  }).join("");
  const u=$("undo");if(u)u.disabled=!local.undo.length;
}
function toastXP(m,kind){const t=$("toast");t.textContent=m;t.className="toast show"+(kind==="red"?" red":kind==="ach"?" ach":kind==="xp"?" xp":"");clearTimeout(t._h);t._h=setTimeout(()=>t.className="toast",RM?0:2800)}
function unlockAch(id){
  if(local.ach.includes(id))return false;
  local.ach.push(id);save();
  const a=ACH.find(x=>x.id===id);
  if(a)toastXP(`Achievement · ${a.name}`, "ach");
  return true;
}
function isNightCT(){
  try{
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",hour:"numeric",hour12:false}).formatToParts(new Date());
    const h=+parts.find(p=>p.type==="hour").value;return h>=22||h<6;
  }catch(e){const h=new Date().getHours();return h>=22||h<6}
}
function grantXP(pts,reason,opts){
  if(!pts)return;
  opts=opts||{};
  const before=local.xp|0,lv0=levelOf(before);
  local.xp=Math.max(0,before+pts);save();
  const lv1=levelOf(local.xp);
  if(!opts.silent){
    const delay=opts.delay||0;
    const show=()=>toastXP(`${pts>0?"+":""}${pts} XP · ${reason}`,"xp");
    if(delay&&!RM)setTimeout(show,delay);else show();
  }
  if(lv1>lv0)setTimeout(()=>toastXP(`Level up · LVL ${lv1}`,"ach"),RM?0:(opts.delay||0)+900);
  renderXP();
}
function checkAchAfter(action){
  if(action==="approve"){
    if(local.stats.approves>=1)unlockAch("first_approve");
    if(local.stats.approves>=5)unlockAch("five_approves");
    if(local.stats.approves>=10)unlockAch("ten_approves");
    const waiting=D.filter(d=>st(d)==="waiting").length;
    if(waiting===0){local.stats.clears=(local.stats.clears|0)+1;unlockAch("cleared_queue")}
  }
  if(action==="hold"||action==="pause"){if(local.stats.holds>=1)unlockAch("first_hold")}
  if(isNightCT())unlockAch("night_shift");
  save();renderXP();
}
function pushUndo(entry){local.undo.push(entry);if(local.undo.length>20)local.undo.shift();save()}
function undoLast(){
  const e=local.undo.pop();if(!e){toastXP("Nothing to undo","red");renderXP();return}
  if(e.prevDesk===undefined||e.prevDesk===null)delete local.desks[e.id];
  else local.desks[e.id]=e.prevDesk;
  if(e.xp){local.xp=Math.max(0,(local.xp|0)-e.xp)}
  if(e.stat==="approves")local.stats.approves=Math.max(0,(local.stats.approves|0)-1);
  if(e.stat==="holds")local.stats.holds=Math.max(0,(local.stats.holds|0)-1);
  // achievements stay unlocked (no re-lock on undo) — XP points reverse only
  save();
  const d=D.find(x=>x.id===e.id);
  log(e.id,`undo · reversed ${e.action} (−${e.xp||0} XP)`,"r");
  toastXP(`Undo ${e.action}${d?" · "+d.name:""} (−${e.xp||0} XP)`,"red");
  renderAll();renderXP();
}
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date().toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
const LOGS={},PROG={};
let PS=null;const spark=[];

function isOwner(d){return !!(d&&(d.human||d.owner||d.id==="davey"))}
function st(d){if(isOwner(d))return "owner";const o=local.desks[d.id];if(o&&o.state){if(o.state==="working"&&o.until&&Date.now()>o.until){o.state="ready";delete o.until;save();log(d.id,"run finished — draft ready, nothing sent","g")}return o.state}return d.state}
function log(id,msg,c){(LOGS[id]=LOGS[id]||[]).push({t:now(),m:msg,c:c||""});if(LOGS[id].length>60)LOGS[id].shift()}
const BOTS=()=>D.filter(d=>!isOwner(d));
const DESKS=()=>D.filter(d=>!isOwner(d)&&!d.isTask);

/* ---- gork-style Expirites: hooded 3D-look figures (CSS), owner-approved color map ---- */
/* XBOT is filled from status.json desks at boot (gork, cls, color, glow) */
const XBOT={_:{gid:"GORK",cls:"GORK",role:"",color:"#dfe6ff",glow:"#ffffff",verb:"working",icon:"◆"}};
const SVG_IC={
  trade:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18V9"/><path d="M6 7V5"/><path d="M12 18V8"/><path d="M12 6V4"/><path d="M18 18V11"/><path d="M18 9V7"/><rect x="4.2" y="9" width="3.6" height="6" rx=".6"/><rect x="10.2" y="8" width="3.6" height="7" rx=".6"/><rect x="16.2" y="11" width="3.6" height="4" rx=".6"/></svg>',
  shop:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 11H7L6 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/><path d="M9 12h.01M15 12h.01"/></svg>',
  nft:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 8.5l3.5 2v3L12 15.5 8.5 13.5v-3L12 8.5z"/></svg>',
  game:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 13h-2m1-1v2"/><circle cx="15.5" cy="12" r=".8"/><circle cx="17.5" cy="14" r=".8"/></svg>',
  coin:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M12 9v6M10.5 10.5c.4-.5 1-.8 1.5-.8s1.2.3 1.5.8M10.5 13.5c.4.5 1 .8 1.5.8s1.2-.3 1.5-.8"/></svg>',
  mint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l3-8h4l3 8"/><path d="M8.5 14h7"/><path d="M12 3v2M6 6l1.2 1.2M18 6l-1.2 1.2"/><path d="M9 18h6l-1 3H10l-1-3z"/></svg>',
  casino:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c-2.8 3.2-5 5.6-5 8a5 5 0 0 0 10 0c0-2.4-2.2-4.8-5-8z"/><path d="M12 12v7"/><circle cx="9" cy="10.5" r=".7" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r=".7" fill="currentColor" stroke="none"/></svg>',
  book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5c0-.8.7-1.5 1.5-1.5H18l2 3.5-2 3.5H5.5A1.5 1.5 0 0 1 4 12.5v-4z"/><path d="M18 7v10.5a1 1 0 0 1-1 1H7"/><path d="M8.5 10.5h5"/></svg>',
  betapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M10 5.5h4"/><circle cx="12" cy="17.5" r="1"/></svg>',
  scan:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"/><path d="M6.2 6.2l1.8 1.8M16 16l1.8 1.8M17.8 6.2L16 8M8 16l-1.8 1.8"/></svg>',
  davey:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l2.5 2L12 5l4.5 6L19 9l-1 10H6L5 9z"/><path d="M9 19h6"/></svg>',
  task:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h11v14H8z"/><path d="M5 8h3M5 12h3M5 16h3"/><path d="M11 10h5M11 14h5"/></svg>'
};
const ICONS={trade:"◎",shop:"🛍",nft:"◈",game:"🎮",coin:"🪙",mint:"✦",casino:"♠",book:"🎫",betapp:"📱",scan:"⌕",davey:"♛",task:"▣"};
function stationIcon(id,own,isTask){
  const key=own?"davey":(isTask?"task":id);
  return SVG_IC[key]||SVG_IC.task||"◆";
}
function loadXBOT(desks){desks.forEach(d=>{if(d.human||d.owner)return;XBOT[d.id]={gid:d.gork||("GORK-"+d.id.toUpperCase()),cls:d.cls||d.id.toUpperCase(),role:d.role,color:d.color||"#dfe6ff",glow:d.glow||d.color||"#fff",verb:(d.work&&d.work[0])||"working",icon:ICONS[d.id]||"◆"}})}
const EBTAGENT=XBOT; /* legacy alias */
function xbotHTML(botId,s,name,mini,gid){
  const A=XBOT[botId]||XBOT._;
  return `<div class="xb silver${mini?" mini":""}" style="--c:${A.color};--cg:${A.glow}" title="${esc(gid||A.gid)} · ${esc(name)} · Silver Expirite">
    <div class="xb-ring"></div><div class="xb-shadow"></div>
    <div class="xb-walk"><div class="xb-fig">
      <div class="xb-leg l"></div><div class="xb-leg r"></div>
      <div class="xb-hoodie"><i class="xb-mark"></i><i class="xb-pocket"></i></div>
      <div class="xb-arm l"></div><div class="xb-arm r"></div>
      <div class="xb-chrome"><i class="xb-shine"></i><i class="xb-eye l"></i><i class="xb-eye r"></i></div>
      <div class="xb-hood-rim"></div>
    </div></div>
    <div class="xb-tag"><b>${esc(gid||A.gid)}</b><span>${esc(name)}</span></div>
  </div>`;
}
function botHTML(d,s){
  const botId=d.isTask?d.bot:d.id, A=XBOT[botId]||XBOT._;
  let bub="";
  if(s==="waiting")bub=`<div class="bubble wait">waiting on you…</div>`;
  else if(s==="working"){const w=(d.work||[d.task||A.verb]);bub=`<div class="bubble work" data-wk="${d.id}">${esc(w[0])}<span class="pb"><i style="--p:${PROG[d.id]||20}%"></i></span></div>`}
  else if(s==="ready")bub=`<div class="bubble ok">✓ draft ready</div>`;
  else if(s==="held")bub=`<div class="bubble ok" style="color:#aab;border-color:#667">on hold</div>`;
  const nm=d.isTask?"TASK · "+(XBOT[d.bot]||XBOT._).cls:A.cls;
  return `<div class="botslot">${bub}${xbotHTML(botId,s,nm,false,d.isTask?d.gid:null)}</div>`;
}
const WK=(l)=>`<div class="wk" style="left:${l}"><div class="mon"></div><div class="lamp"></div><div class="top"></div><i class="leg a"></i><i class="leg b"></i></div>`;
const CHAIR=(l)=>`<div class="chair" style="left:${l}"><div class="bk"></div><div class="seat"></div><div class="post"></div><div class="ft"></div></div>`;
function furniture(d){
  if(d.isTask){return `<div class="screen doc" style="left:14%;width:56px"></div><div class="taskboard" style="left:30%"><b>TASK</b>${esc(d.name)}<small>${esc(d.created?new Date(d.created).toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"2-digit",minute:"2-digit",hour12:false})+" CT":"")}</small></div>`+CHAIR("50%")+WK("53%")+`<div class="planter" style="left:88%"></div>`}
  if(d.id==="trade"){return `<div class="tradewall" id="tradewall" style="left:12%"><div class="tw-h">PAPER DESK · SOL</div><div class="tw-v" id="tw-v">—</div><div class="tw-s" id="tw-s">booting public feed…</div><canvas id="tw-spark" width="120" height="22"></canvas></div><div class="screen chart" style="left:36%;width:48px"></div>`+CHAIR("47%")+WK("50%")+`<div class="rack" style="left:74%"></div><div class="planter" style="left:88%"></div><div class="planter" style="left:4%"></div>`}
  if(d.id==="scan"){return `<div class="screen globe" style="left:14%"></div><div class="screen doc" style="left:28%;width:48px"></div><div class="rack" style="left:72%"></div><div class="rack" style="left:78%"></div>`+CHAIR("47%")+WK("50%")+`<div class="planter" style="left:88%"></div><div class="planter" style="left:4%"></div>`}
  const wall={
    shop:`<div class="screen" style="left:14%;background:repeating-linear-gradient(90deg,#1a0f05 0 14px,#ff9a1f33 14px 16px)"></div><div class="screen doc" style="left:28%;width:48px"></div>`,
    nft:`<div class="nftwall" id="nftwall" style="left:10%"><div class="nl-h">NFT LIVE · ME</div><div class="nl-row">booting…</div></div>`,
    game:`<div class="screen arcade" style="left:14%;width:72px"></div><div class="screen chart" style="left:30%;width:44px"></div>`,
    coin:`<div class="coinsign" style="left:16%">◎</div><div class="screen doc" style="left:28%;width:48px"></div>`,
    mint:`<div class="screen mintbox" style="left:14%;width:74px">DRAFT ONLY</div>`,
    casino:`<div class="screen slots" style="left:14%;width:70px">7 7 7</div><div class="screen doc" style="left:30%;width:44px"></div>`,
    book:`<div class="screen odds" style="left:14%;width:80px"></div>`,
    betapp:`<div class="phonemock" style="left:14%"><i></i><b>BET</b></div><div class="phonemock alt" style="left:22%"><i></i><b>+2.5</b></div><div class="screen odds" style="left:31%;width:44px"></div>`
  }[d.id]||`<div class="screen doc" style="left:16%"></div>`;
  return wall+CHAIR("47%")+WK("50%")+`<div class="cab" style="left:73%"></div><div class="planter" style="left:84%"></div><div class="planter" style="left:4%"></div>`;
}
function roomHTML(d){
  const s=st(d),own=isOwner(d);
  const label=d.isTask?`${d.floor} · TASK`:`${d.floor} · ${d.name.toUpperCase()}`;
  return `<div class="room s-${s}${d.isTask?" task":""}" data-id="${d.id}" style="--ac:${(XBOT[d.isTask?d.bot:d.id]||{color:"#ffd59a"}).color}"><div class="wall"></div><div class="sidew l"></div><div class="sidew r"></div><div class="neon"></div><div class="ceil"></div><div class="flr"></div><div class="base"></div>
  ${furniture(d)+botHTML(d,s)}
  <div class="glass"><i class="sweep"></i></div>
  <div class="tag"><span class="fln">${esc(label)}</span><span class="rl">${esc(d.isTask?(d.gid+" · → "+((D.find(x=>x.id===d.bot)||{}).name||d.bot)):(XBOT[d.id]?XBOT[d.id].gid+" · ":"")+d.role)}</span></div>
  <div class="rstate"><span class="dot d-${s}"></span><span class="st ${s}">${s.toUpperCase()}</span></div></div>`;
}
function renderBuilding(){
  /* ONE TOWER: a single vertical stack, exactly one floor plate per level. The penthouse level is gone. */
  const levels=D.filter(d=>!isOwner(d)).slice().sort((a,b)=>(+a.row)-(+b.row));
  let h=`<div class="crown"><div class="beacon"></div><div class="mast"></div><div class="mech"></div><div class="parapet"></div></div>`;
  levels.forEach((d)=>{
    h+=`<div class="tlvl" data-row="${d.row}" data-id="${d.id}">${roomHTML(d)}<div class="core"><span>${esc(d.floor)}</span></div><div class="side"></div></div>`;
    h+=`<div class="slab"></div>`;
  });
  h+=`<div class="plinth">EXPIRE · HQ <small>${BOTS().filter(x=>!x.isTask).length} DESKS · ${TASKS.length} TASK FLOORS</small></div><div class="ground"><i class="beam l"></i><i class="beam r"></i></div>`;
  $("building").innerHTML=h;
  if(sel)document.querySelectorAll(".tlvl").forEach(f=>f.classList.toggle("dim",f.dataset.id!==sel));
}
function counts(){const c={working:0,waiting:0,ready:0,held:0,empty:0};BOTS().forEach(d=>{const s=st(d);c[s]=(c[s]|0)+1});return c}
function renderTop(){const c=counts();
  $("metrics").innerHTML=`<span><i class="dot d-working"></i><b>${c.working}</b> working</span><span><i class="dot d-waiting"></i><b>${c.waiting}</b> waiting</span><span><i class="dot d-ready"></i><b>${c.ready}</b> ready</span><span><b>${DESKS().length}</b> Gorks · <b>${TASKS.length}</b> task floors · <b>${D.length}</b> levels</span>`;
  $("rcount").textContent=`${D.length} levels · ${DESKS().length+TASKS.length} Gorks`;
}
function renderRoster(){
  $("roster").innerHTML=D.filter(d=>!isOwner(d)).slice().sort((a,b)=>(+a.row)-(+b.row)).map(d=>{
    const s=st(d),own=isOwner(d),A=!own?(XBOT[d.isTask?d.bot:d.id]||null):null;
    const c=own?"#ffd59a":(A&&A.color)||"#3ee88a";
    const ic=`<span class="ric" aria-hidden="true">${stationIcon(d.id,own,!!d.isTask)}</span>`;
    return `<button type="button" class="ritem${sel===d.id?" sel":""}${own?" owner":""}" data-id="${d.id}" style="--c:${c}" title="${esc(d.name)} · ${own?"owner":s}"><span class="fl">${esc(d.floor)}</span>${ic}<span class="nm">${d.isTask?'<small class="tk">TASK</small> ':""}${esc(d.name)}${own?' <small style="color:#ffd59a;font:700 9px/1 var(--mono)">OWNER</small>':""}</span><span class="st ${own?"owner":s}">${own?"owner":s}</span></button>`;
  }).join("");
}
function actions(d,s){
  if(isOwner(d))return "";
  const tx=d.isTask?`<button class="btn ghost" data-act="done" data-id="${d.id}" title="close task floor">✓ Done</button><button class="btn ghost" data-act="remove" data-id="${d.id}" title="remove floor">✕</button>`:"";
  if(d.isTask&&!["waiting","held","working"].includes(s))return tx;
  if(s==="waiting")return `<button class="btn go" data-act="approve" data-id="${d.id}">Approve</button><button class="btn no" data-act="hold" data-id="${d.id}">Hold</button>`+tx;
  if(s==="held")return `<button class="btn go" data-act="approve" data-id="${d.id}">Approve</button><button class="btn ghost" data-act="unhold" data-id="${d.id}">Back to queue</button>`+tx;
  if(s==="working")return `<button class="btn go flick" data-act="peek" data-id="${d.id}">Watch</button><button class="btn no flick" data-act="pause" data-id="${d.id}">Pause</button>`+tx;
  return "";
}
function syncApprovalsStore(){
  try{
    const items=BOTS().filter(d=>["waiting","held"].includes(st(d))).map(d=>{
      const A=XBOT[d.isTask?d.bot:d.id]||XBOT._;
      return {id:d.id,floor:d.floor,name:d.name,ask:d.ask||d.summary||"",state:st(d),gork:d.gork||d.gid||A.gid||"",color:A.color||"#2bff88",isTask:!!d.isTask,role:d.role||"",updated:Date.now()};
    });
    localStorage.setItem(AKEY,JSON.stringify({updated:Date.now(),source:"hq",items}));
  }catch(e){}
}
function hydrateLocalFromStorage(){
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||"{}");
    local.desks=raw.desks||{};
    local.killed=!!raw.killed;
    local.xp=Number.isFinite(+raw.xp)?Math.max(0,+raw.xp)|0:local.xp;
    local.ach=Array.isArray(raw.ach)?raw.ach:local.ach;
    local.stats=raw.stats&&typeof raw.stats==="object"?raw.stats:local.stats;
    local.undo=Array.isArray(raw.undo)?raw.undo:local.undo;
  }catch(e){}
}
function onExternalHQChange(){hydrateLocalFromStorage();try{TASKS=JSON.parse(localStorage.getItem("expireHQ.tasks.v1")||"[]");if(!Array.isArray(TASKS))TASKS=[]}catch(e){}rebuild();applyKill();renderAll();renderXP()}
addEventListener("storage",e=>{if(e.key===KEY||e.key===AKEY||e.key==="expireHQ.tasks.v1")onExternalHQChange()});
setInterval(()=>{try{const raw=localStorage.getItem(KEY)||"";if(raw&&raw!==onExternalHQChange._sig){const cur=JSON.stringify(local);if(raw!==cur){onExternalHQChange._sig=raw;onExternalHQChange()}else onExternalHQChange._sig=raw}}catch(e){}},2000);

function renderQueue(){
  const q=BOTS().filter(d=>["waiting","held"].includes(st(d)));
  $("qcount").textContent=q.filter(d=>st(d)==="waiting").length+" open";
  $("queue").innerHTML=q.length?q.map(d=>{const s=st(d);return `<div class="qcard ${s==="held"?"held":""}"><h4>${esc(d.floor)} · ${esc(d.name)}<em>${s==="held"?"ON HOLD":"NEEDS YOU"}</em></h4><p>${esc(d.ask||d.summary)}</p><div class="acts">${actions(d,s)}</div></div>`}).join("")
    :`<div class="empty-q">Nothing waiting on you. Bots are on it.</div>`;
}
function forgeCard(){const hq=D.find(d=>d.forge);if(!hq)return "";const f=hq.forge,hs=st(hq);
  return `<div class="fcard ${hs==="working"?"working":""}" data-id="${hq.id}" style="cursor:pointer"><div class="h"><span>⚡ PROMPT FORGE · ${esc(hq.floor)} GROK BOT</span><span class="badge ${hs}">${hs==="working"?"RUNNING":hs.toUpperCase()}</span></div><pre>&gt; ${esc(f.prompt)}</pre><div class="logs" style="margin-top:6px;padding:5px 8px">${(f.logs||[]).map(m=>`<div>${esc(m)}</div>`).join("")}</div></div>`}
function renderRight(){
  if(!sel){
    const rank={working:0,waiting:1,held:2,ready:3};
    $("rtitle").innerHTML="⚡ Prompt Forge";$("rsub").textContent="whole tower · "+BOTS().length+" bot briefs";
    $("rbody").innerHTML=forgeCard()+BOTS().filter(d=>st(d)!=="empty").sort((a,b)=>(rank[st(a)]??4)-(rank[st(b)]??4)).map(d=>{const s=st(d),last=(LOGS[d.id]||[]).slice(-1)[0];
      return `<div class="fcard ${s}" data-id="${d.id}" style="cursor:pointer"><div class="h"><span>→ ${esc(d.floor)} ${esc(d.name.toUpperCase())}</span><span class="badge ${s}">${s==="working"?"RUNNING":s==="waiting"?"NEEDS YOU":s.toUpperCase()}</span></div><pre>&gt; ${esc(d.prompt||d.summary)}</pre>${last?`<div class="logs" style="margin-top:6px;padding:5px 8px"><div><span class="t">${last.t}</span> ${esc(last.m)}</div></div>`:""}${d.file?`<span class="file">📄 ${esc(d.file)}</span>`:""}</div>`}).join("")
      +`<div class="fcard"><pre style="color:var(--mut)">Activity here is a local visualization. No agents are called, nothing is sent.</pre></div>`;
    return;
  }
  const d=D.find(x=>x.id===sel),s=st(d),own=isOwner(d);
  $("rtitle").innerHTML=`<i class="dot d-${s}"></i>${esc(d.floor)} · ${esc(d.name)}`;$("rsub").textContent=s;
  const paperBox=(d.id==="trade"||d.id==="scan")?paperCard():"";
  const nftBox=d.id==="nft"?nftCard():"";
  const taskBox=d.isTask?`<div class="fcard ${s}"><div class="h"><span>TASK FLOOR</span><span class="badge ${s}">${s.toUpperCase()}</span></div><pre>gork ${esc(d.gid)} · station → ${esc((D.find(x=>x.id===d.bot)||{}).name||d.bot)}\ncreated ${esc(new Date(d.created).toLocaleString("en-US",{timeZone:"America/Chicago"}))} CT\ndraft-only · nothing sends</pre></div>`:"";
  const ownerBox="";
  $("rbody").innerHTML=`<div class="det"><h2>${esc(d.name)}</h2><div class="role">${esc(d.role)}</div>
   <div class="sum">${esc(d.summary)}${d.file?`<br><span class="file">📄 ${esc(d.file)}</span>`:""}</div>
   ${ownerBox}${paperBox}${nftBox}${taskBox}
   ${d.prompt?`<div class="fcard ${s}"><div class="h"><span>PROMPT</span><span class="badge ${s}">${s.toUpperCase()}</span></div><pre>&gt; ${esc(d.prompt)}</pre></div>`:""}
   ${d.forge?forgeCard():""}
   <div class="acts ${s==="working"?"flick":""}" style="display:flex;gap:6px;margin:10px 0">${actions(d,s)}</div>
   <div class="sec" style="padding:4px 0 6px">LOG (CT)</div>
   <div class="logs" id="dlogs">${(LOGS[d.id]||[]).map(l=>`<div><span class="t">${l.t}</span> <span class="${l.c}">${esc(l.m)}</span></div>`).join("")||'<div class="t">no activity</div>'}</div></div>`;
  const L=$("dlogs");if(L)L.scrollTop=L.scrollHeight;
}
function renderAll(){renderTop();renderRoster();renderQueue();try{syncApprovalsStore()}catch(e){}renderBuilding();if(PS)paperUpdate(PS);if(window.NftLive&&NftLive.paint)NftLive.paint();renderRight();renderXP();const sd=sel&&D.find(d=>d.id===sel);$("crumb").innerHTML=sd?`HQ / <b>${esc(sd.floor)} · ${esc(sd.name)}</b>`:`HQ / <b>ONE TOWER · ${D.length} LEVELS</b>${TASKS.length?` · ${TASKS.length} task floor${TASKS.length>1?"s":""}`:""} · click a floor to zoom`;requestAnimationFrame(fitView)}

/* ---- zoom: whole tower vs one level ---- */
const BW=600;
function fitView(){
  const W=$("wrap").clientWidth,H=$("wrap").clientHeight,b=$("building"),bh=b.scrollHeight;
  if(!sel){const s=Math.min((W-16)/BW,(H-20)/bh,1.45);b.style.transform=`translate(${BW/2-BW/2*s}px,${Math.max(16,(H-bh*s)/2)}px) scale(${s})`;return}
  const lv=b.querySelector(`.tlvl[data-id="${sel}"]`);if(!lv)return;const top=lv.offsetTop,fh=lv.offsetHeight,cx=lv.offsetLeft+lv.offsetWidth/2;
  const s=Math.min(W*.94/lv.offsetWidth,H*.6/fh,2.4);
  b.style.transform=`translate(${BW/2-cx*s}px,${H/2-(top+fh/2)*s}px) scale(${s})`;
}
function select(id){sel=id;try{history.replaceState(null,"",id?"#"+id:location.pathname)}catch(e){}renderAll()}

/* ---- local-only actions ---- */
function toast(m,red){const t=$("toast");t.textContent=m;t.className="toast show"+(red?" red":"");clearTimeout(t._h);t._h=setTimeout(()=>t.className="toast"+(red?" red":""),2600)}
function act(a,id){const d=D.find(x=>x.id===id);if(!d)return;
  const prevDesk=local.desks[id]?JSON.parse(JSON.stringify(local.desks[id])):null;
  if(a==="approve"){
    local.desks[id]={state:"working",until:Date.now()+20000};PROG[id]=8;
    local.stats.approves=(local.stats.approves|0)+1;
    pushUndo({id,action:"approve",prevDesk,xp:XP_APPROVE,stat:"approves",t:Date.now()});
    log(id,"approved by davey (local) — drafting, still nothing sends · +"+XP_APPROVE+" XP","g");
    toast(`✓ Approved ${d.name} · +${XP_APPROVE} XP — local only, nothing sent`);
    grantXP(XP_APPROVE,"Approve · "+d.name,{silent:true});checkAchAfter("approve");
  }
  else if(a==="hold"){
    local.desks[id]={state:"held"};
    local.stats.holds=(local.stats.holds|0)+1;
    pushUndo({id,action:"hold",prevDesk,xp:XP_HOLD,stat:"holds",t:Date.now()});
    log(id,"held by davey (local) · +"+XP_HOLD+" XP","r");toast(`Held ${d.name} · +${XP_HOLD} XP`,true);
    grantXP(XP_HOLD,"Hold · "+d.name,{silent:true});checkAchAfter("hold");
  }
  else if(a==="unhold"){delete local.desks[id];log(id,"back in queue");}
  else if(a==="pause"){
    local.desks[id]={state:"held"};
    local.stats.holds=(local.stats.holds|0)+1;
    pushUndo({id,action:"pause",prevDesk,xp:XP_HOLD,stat:"holds",t:Date.now()});
    log(id,"paused by davey (local) · +"+XP_HOLD+" XP","r");toast(`Paused ${d.name} · +${XP_HOLD} XP`,true);
    grantXP(XP_HOLD,"Pause · "+d.name,{silent:true});checkAchAfter("pause");
  }
  else if(a==="peek"){select(id);return}
  else if(a==="done"||a==="remove"){
    TASKS=TASKS.filter(t=>t.id!==id);saveTasks();delete local.desks[id];
    if(a==="done"){grantXP(XP_TASK_DONE,"Task done · "+d.name);toast(`✓ Task floor closed · ${d.name} · +${XP_TASK_DONE} XP`)}else toast(`Removed task floor · ${d.name}`,true);
    log(d.bot||"trade",(a==="done"?"task done: ":"task removed: ")+d.name,a==="done"?"g":"r");
    if(sel===id)sel=null;rebuild();save();renderAll();return}
  save();renderAll();renderXP();
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");if(b){e.stopPropagation();act(b.dataset.act,b.dataset.id);return}
  const r=e.target.closest(".ritem,.fcard[data-id]");if(r){select(r.dataset.id===sel?null:r.dataset.id);return}
  const room=e.target.closest(".tlvl");if(room){select(room.dataset.id===sel?null:room.dataset.id);return}
});
$("whole").onclick=()=>select(null);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("paperdesk").hidden)openPaper(false);else if(!$("taskform").hidden)$("taskform").hidden=true;else select(null)}});
$("undo").onclick=()=>undoLast();
$("reset").onclick=()=>{local={desks:{},killed:false,xp:0,stats:{approves:0,holds:0,clears:0},ach:[],undo:[]};save();document.body.classList.remove("killed");$("kill").classList.remove("on");toast("Local state reset (incl. XP)");renderAll();renderXP()};
function applyKill(){document.body.classList.toggle("killed",local.killed);$("kill").classList.toggle("on",local.killed);$("killtxt").textContent=local.killed?"kill switch · TRIPPED · bots frozen (local)":"kill switch · armed · local"}
$("kill").onclick=()=>{local.killed=!local.killed;save();applyKill();toast(local.killed?"Kill switch tripped — all bots frozen (local)":"Kill switch re-armed",local.killed)};
addEventListener("resize",fitView);

/* ---- simulated activity: progress bars, logs, packets up the elevator shaft ---- */
function tick(){
  $("clock").innerHTML=now()+"<small>CT</small>";
  const tk=$("ticker");if(tk&&PS){const age=PS.age!=null?PS.age:(PS.lastAt?Math.round((Date.now()-PS.lastAt)/1000):null);const feedLbl=PS.feed==="live"?`LIVE · ${age!=null?age+"s":"…"}`:(PS.feed||"…").toUpperCase();tk.innerHTML=`<span>◎ SOL <b>$${PS.solusd?PS.solusd.toFixed(2):"—"}</b></span><span>PAPER EQ <b class="${PS.pnl>=0?"up":"dn"}">${PS.eq.toFixed(2)} ◎</b></span><span>FEED <b class="${PS.feed==="live"?"up":"dn"}">${feedLbl}</b></span>${window.NftLive&&NftLive.summary?`<span id="tk-nft"></span>`:""}`;const ns=$("tk-nft");if(ns&&window.NftLive){const n=NftLive.summary();const na=n.age;ns.innerHTML=`NFT <b class="${n.feed==="live"?"up":"dn"}">${n.feed==="live"?`LIVE · ${na}s`:(n.feed||"…").toUpperCase()}</b>`}}
}
setInterval(tick,1000);tick();
let n=0;
setInterval(()=>{if(local.killed)return;n++;let changed=false;
  D.forEach(d=>{const s=st(d);if(local.desks[d.id]&&local.desks[d.id].state==="ready"&&s==="ready"&&!local.desks[d.id].toasted){local.desks[d.id].toasted=1;save();toast(`${d.name}: draft ready — not sent`);changed=true}
    if(s!=="working")return;PROG[d.id]=((PROG[d.id]||10)+7+Math.random()*9)%100;
    const bub=document.querySelector(`[data-wk="${d.id}"]`);if(bub){const w=d.work||[d.task||"working"];bub.firstChild.textContent=w[n%w.length];bub.querySelector("i").style.setProperty("--p",PROG[d.id]+"%")}
    if(n%3===0){const w=d.work||(d.logs||[]);if(w.length)log(d.id,w[(n/3|0)%w.length])}
    packet(d.id)});
  if(changed||D.some(d=>local.desks[d.id]&&local.desks[d.id].until&&Date.now()>local.desks[d.id].until))renderAll();
  else{renderTop();if(sel)renderRight();else if(n%3===0)renderRight()}
},1500);
function packet(id){const b=$("building"),lv=b.querySelector(`.tlvl[data-id="${id}"]`);if(!lv)return;const room=lv.querySelector(".room"),core=lv.querySelector(".core");
  const roof=b.querySelector(".crown");
  const p=document.createElement("div");p.className="pkt";const rx=lv.offsetLeft+room.offsetLeft+room.offsetWidth*.55,ry=lv.offsetTop+room.offsetHeight*.6;
  const tx=roof?roof.offsetLeft+roof.offsetWidth*.62:lv.offsetLeft+core.offsetLeft+18,ty=roof?roof.offsetTop+6:12;
  p.style.left=rx+"px";p.style.top=ry+"px";p.style.setProperty("--dx",(tx-rx)+"px");p.style.setProperty("--dy",(ty-ry)+"px");b.appendChild(p);setTimeout(()=>p.remove(),2000)}

/* ---- task floors sit above the ten desks, under the roof ---- */
const TKEY="expireHQ.tasks.v1",XP_TASK_NEW=10,XP_TASK_DONE=25,XP_PAPER_FILL=5,MAX_TASKS=12;
let TASKS=[];try{TASKS=JSON.parse(localStorage.getItem(TKEY)||"[]");if(!Array.isArray(TASKS))TASKS=[]}catch(e){TASKS=[]}
const saveTasks=()=>localStorage.setItem(TKEY,JSON.stringify(TASKS));
let BASE=[];
function rebuild(){
  const rest=BASE.filter(d=>!isOwner(d)).sort((a,b)=>(+a.row)-(+b.row));
  const tasks=TASKS.slice().sort((a,b)=>b.created-a.created).map(t=>Object.assign({isTask:true,role:"task floor",work:[t.name,"drafting (local)","holding every send"],prompt:"task: "+t.name+"\ngork: "+t.gid+" · station: "+t.bot+"\ndraft only. never send.",summary:t.note||(t.gid+" spun up for this task under "+((XBOT[t.bot]||XBOT._).cls)+" — draft only, nothing sends."),ask:t.name},t));
  const stack=tasks.concat(rest);
  const n=stack.length;
  stack.forEach((d,i)=>{d.row=i;d.floor=(n-i)+"F"});
  D=stack;
}
function addTask(name,bot,state,note){
  name=String(name||"").trim().slice(0,60);if(!name)return null;
  if(TASKS.length>=MAX_TASKS){toast(`Task floor limit (${MAX_TASKS}) — close one first`,true);return null}
  const seq=(+localStorage.getItem("expireHQ.tasks.seq")||0)+1;localStorage.setItem("expireHQ.tasks.seq",seq);
  const t={id:"task-"+Date.now().toString(36),gid:"GORK-T"+String(seq).padStart(2,"0"),name,bot:XBOT[bot]?bot:"trade",state:state==="working"?"working":"waiting",created:Date.now(),note:note||""};
  TASKS.push(t);saveTasks();rebuild();
  log(t.id,t.gid+" spawned · floor added · station "+t.bot);log(t.bot,"new task floor: "+name+" → "+t.gid,"g");
  if(t.state==="working"){local.desks[t.id]={state:"working",until:Date.now()+30000};PROG[t.id]=5;save()}
  grantXP(XP_TASK_NEW,"New task floor");renderAll();
  setTimeout(()=>{const lv=document.querySelector(`.tlvl[data-id="${t.id}"]`);if(lv){lv.classList.add("fresh");setTimeout(()=>lv.classList.remove("fresh"),2400)}},60);
  return t;
}
window.HQ={addTask,tasks:()=>TASKS.slice(),act,syncApprovals:syncApprovalsStore,approvalsKey:AKEY};
function openTaskForm(){const f=$("taskform");f.hidden=!f.hidden;if(!f.hidden){$("tf-bot").innerHTML=DESKS().map(d=>`<option value="${d.id}">${esc(d.floor)} · ${esc(d.name)} — ${XBOT[d.id]?XBOT[d.id].gid:""}</option>`).join("");$("tf-name").focus()}}
$("newtask").onclick=openTaskForm;
$("tf-cancel").onclick=()=>{$("taskform").hidden=true};
$("taskform").onsubmit=e=>{e.preventDefault();const t=addTask($("tf-name").value,$("tf-bot").value,$("tf-state").value);if(t){$("tf-name").value="";$("taskform").hidden=true;toast(`＋ Task floor ${t.name} → ${(D.find(x=>x.id===t.bot)||{}).name} · +${XP_TASK_NEW} XP`)}};

/* ---- paper desk wiring (PAPER ONLY) ---- */
function paperCard(){const p=PS;const age=p&&(p.age!=null?p.age:(p.lastAt?Math.round((Date.now()-p.lastAt)/1000):null));const fl=p?(p.feed==="live"?`LIVE · ${age}s`:p.feed.toUpperCase()):"BOOT";return `<div class="fcard working"><div class="h"><span>◎ PAPER DESK</span><span class="badge ${p&&p.feed==="live"?"working":"waiting"}">${fl}</span></div>
 <pre>${p?`equity ${p.eq.toFixed(3)} ◎ · P&L ${(p.pnl>=0?"+":"")+p.pnl.toFixed(3)} ◎ (${p.pnlPct.toFixed(2)}%)\n${p.pos} open · ${p.fills} paper fills · SOL $${p.solusd?p.solusd.toFixed(2):"—"}\nexec: ${p.pipe.exec.m}`:"booting public feed…"}</pre>
 <div class="pd-mini">PAPER ONLY · NO LIVE ORDERS · NO SPEND</div><div class="acts" style="margin-top:8px"><button class="btn go" data-open-paper="1">Open Paper Desk</button></div></div>`}
function paperUpdate(p){PS=p;
  if(p.solusd){spark.push(p.eq);if(spark.length>60)spark.shift()}
  const v=$("tw-v"),s2=$("tw-s"),c=$("tw-spark");
  if(v)v.innerHTML=`${p.eq.toFixed(2)} ◎ <span class="${p.pnl>=0?"up":"dn"}">${p.pnl>=0?"+":""}${p.pnlPct.toFixed(2)}%</span>`;
  if(s2){const age=p.age!=null?p.age:(p.lastAt?Math.round((Date.now()-p.lastAt)/1000):null);s2.textContent=`SOL $${p.solusd?p.solusd.toFixed(2):"—"} · ${p.feed==="live"?`LIVE · ${age}s`:p.feed} · ${p.pos} pos`};
  if(c&&spark.length>1){const g=c.getContext("2d"),mn=Math.min(...spark),mx=Math.max(...spark),r=(mx-mn)||1;g.clearRect(0,0,c.width,c.height);g.strokeStyle=p.pnl>=0?"#2bff88":"#ff3b4e";g.lineWidth=1.5;g.beginPath();spark.forEach((y,i)=>{const X=i/(spark.length-1)*c.width,Y=c.height-2-(y-mn)/r*(c.height-4);i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke()}
  const pdc=$("pdcount");if(pdc)pdc.textContent=p.fills?p.fills+" fills":"";
}
function openPaper(on){const o=$("paperdesk");const show=on===undefined?o.hidden:on;o.hidden=!show;$("paperbtn").classList.toggle("on",show);if(show){PaperDesk.mount($("pd-root"))}}
if(window.PaperDesk){
  PaperDesk.hooks.isKilled=()=>!!local.killed;
  PaperDesk.hooks.onChange=paperUpdate;
  PaperDesk.hooks.onFill=f=>{log("trade",`PAPER ${f.side} ${f.s} · ${f.sol.toFixed(3)} ◎ · slip ${f.slip.toFixed(0)} bps (simulated)`,f.side==="buy"?"g":"r");
    local.stats.paper=(local.stats.paper|0)+1;grantXP(XP_PAPER_FILL,"Paper fill",{silent:true});
    if(local.stats.paper>=1)unlockAch("first_paper");if(f.pnl>0)unlockAch("green_close");save();if(sel==="trade"||sel==="scan")renderRight()};
  PaperDesk.start();
}else{$("paperbtn").disabled=true;$("paperbtn").title="paper-desk.js missing"}
$("paperbtn").onclick=()=>openPaper();
$("pd-close").onclick=()=>openPaper(false);
document.addEventListener("click",e=>{if(e.target.closest("[data-open-paper]")){e.stopPropagation();openPaper(true)}},true);

/* ---- parallax (no blur) ---- */
if(!RM){const c=document.querySelector(".center");c.addEventListener("mousemove",e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;document.documentElement.style.setProperty("--px",x.toFixed(3));document.documentElement.style.setProperty("--py",y.toFixed(3))});c.addEventListener("mouseleave",()=>{document.documentElement.style.setProperty("--px",0);document.documentElement.style.setProperty("--py",0)})}

/* ---- NFT live (GORK-NFT · Magic Eden read-only) ---- */
let NS=null;
function nftCard(){const n=NS||(window.NftLive&&NftLive.summary());if(!n)return `<div class="fcard waiting"><div class="h"><span>◈ NFT LIVE</span><span class="badge waiting">BOOT</span></div><pre>Magic Eden public stats via local proxy…</pre><div class="pd-mini">READ ONLY · NO BUY / LIST / MINT</div></div>`;
  const rows=(n.watch||[]).map(w=>`${w.name||w.sym}: floor ${w.floor!=null?w.floor.toFixed(2)+" ◎":"—"} · ${w.listed||0} listed · 7d ${w.vol7d!=null?w.vol7d.toFixed(0)+" ◎":"—"}`).join("\n");
  return `<div class="fcard working"><div class="h"><span>◈ NFT LIVE · ME</span><span class="badge ${n.feed==="live"?"working":"waiting"}">${n.feed==="live"?`LIVE · ${n.age}s`:(n.feed||"…").toUpperCase()}</span></div>
 <pre>${rows||"loading collections…"}</pre>
 <div class="pd-mini">READ ONLY · NO BUY / LIST / MINT · refresh ~12s</div></div>`}
if(window.HQ)HQ.onNftLive=n=>{NS=n;if(sel==="nft")renderRight()};
if(window.NftLive){NftLive.start()}

/* ---- boot ---- */
function withoutPenthouse(data){if(data&&Array.isArray(data.desks))data.desks=data.desks.filter(d=>d&&!(d.human||d.owner||d.id==="davey"||String(d.floor||"").toUpperCase()==="PH"));return data}
function boot(data){data=withoutPenthouse(data||{});DATA=data;BASE=data.desks||[];loadXBOT(BASE);rebuild();const h=location.hash.slice(1);if(h&&h!=="davey"&&D.some(d=>d.id===h))sel=h;D.forEach(d=>(d.logs||[]).forEach(m=>log(d.id,m)));applyKill();renderAll();renderXP();if(/[?&]paper=1/.test(location.search))openPaper(true)}
fetch("status.json",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then(j=>boot(j&&j.desks?j:FALLBACK)).catch(()=>boot(FALLBACK));
})();
