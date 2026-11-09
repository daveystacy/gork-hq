/* Expire HQ · Paper Desk v1
 * PAPER ONLY · NO LIVE ORDERS · NO SPEND
 * - Market data: DexScreener PUBLIC read-only HTTP API (GET only). No keys, no wallet, no RPC, no signing, no swap APIs.
 * - Fills: simulated against the live pool snapshot (constant-product price impact + DEX fee + network fee + latency drift).
 * - Book persists in localStorage "expireHQ.paper.v1".
 */
(function(){"use strict";
const KEY="expireHQ.paper.v1", PCACHE="expireHQ.paper.prices.v1";
const API="https://api.dexscreener.com";
const WSOL="So11111111111111111111111111111111111111112";
const DEFAULT_WATCH=[
  {a:"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",s:"BONK"},
  {a:"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",s:"JUP"},
  {a:"EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",s:"WIF"},
  {a:"7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",s:"POPCAT"}
];
const FEE_DEX=0.0025;           // 0.25% pool fee
const FEE_NET_SOL=0.000005+0.0001; // base fee + priority tip (simulated)
const DRIFT=0.0015;             // ±0.15% latency drift between quote and "landing"
const REFRESH_MS=3000, SCOUT_MS=15000; // live: prices ~3s, scout ~15s
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ct=()=>new Date().toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
const fmtUsd=v=>v==null||!isFinite(v)?"—":v>=1e6?"$"+(v/1e6).toFixed(2)+"M":v>=1e3?"$"+(v/1e3).toFixed(1)+"k":v>=1?"$"+v.toFixed(2):"$"+(+v).toPrecision(3);
const fmtSol=v=>(v==null||!isFinite(v))?"—":(Math.abs(v)>=100?v.toFixed(1):Math.abs(v)>=1?v.toFixed(3):v.toFixed(4))+" ◎";
const pct=v=>v==null||!isFinite(v)?"—":(v>0?"+":"")+v.toFixed(2)+"%";
const cls=v=>v>0?"up":v<0?"dn":"";

function freshBook(cash){return {v:1,startCash:cash,cash:cash,pos:{},fills:[],realized:0,
  cfg:{minScore:70,auto:false,maxPosPct:20,sl:15,tp:30,slipTol:2,size:0.5,minLiq:50000,dailyLossPct:10},
  watch:DEFAULT_WATCH.slice(),created:Date.now(),halted:false}}
function load(){try{const b=JSON.parse(localStorage.getItem(KEY)||"null");if(b&&b.v===1){b.cfg=Object.assign(freshBook(5).cfg,b.cfg||{});b.watch=b.watch&&b.watch.length?b.watch:DEFAULT_WATCH.slice();return b}}catch(e){}return freshBook(5)}
let B=load();
const save=()=>localStorage.setItem(KEY,JSON.stringify(B));
let P={};          // address -> market snapshot
let SOLUSD=null, feed="booting", lastAt=0, SCOUTED=[];
try{const c=JSON.parse(localStorage.getItem(PCACHE)||"null");if(c){P=c.P||{};SOLUSD=c.SOLUSD||null;lastAt=c.at||0}}catch(e){}
const PIPE={scout:{s:"idle",m:"waiting for first sweep",n:0},filter:{s:"idle",m:"—",n:0},analyst:{s:"idle",m:"—",n:0},exec:{s:"idle",m:"paper only",n:0},risk:{s:"ok",m:"limits armed",n:0}};
const hooks={onFill:null,isKilled:()=>false,onChange:null};
let root=null, timer=null, scoutTimer=null, SRES="", LASTQ="";

/* ---------- read-only public data ---------- */
async function getJSON(url){const r=await fetch(url,{method:"GET",cache:"no-store",credentials:"omit"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function bestPairs(pairs){const by={};(pairs||[]).forEach(p=>{if(!p||p.chainId!=="solana")return;const a=p.baseToken&&p.baseToken.address;if(!a)return;const l=(p.liquidity&&p.liquidity.usd)||0;if(!by[a]||l>((by[a].liquidity&&by[a].liquidity.usd)||0))by[a]=p});return by}
function snap(p){const liq=(p.liquidity&&p.liquidity.usd)||0,pu=+p.priceUsd||0;const q=p.quoteToken&&p.quoteToken.symbol;
  return {a:p.baseToken.address,s:p.baseToken.symbol,n:p.baseToken.name,usd:pu,native:q==="SOL"?+p.priceNative:null,liq,
   vol:(p.volume&&p.volume.h24)||0,ch:p.priceChange||{},tx:(p.txns&&p.txns.h1)||{},dex:p.dexId,url:p.url,pair:p.pairAddress,created:p.pairCreatedAt||0,fdv:p.fdv||p.marketCap||0,t:Date.now(),sim:false}}
async function fetchTokens(addrs){const out={};for(let i=0;i<addrs.length;i+=30){const j=await getJSON(API+"/tokens/v1/solana/"+addrs.slice(i,i+30).join(","));Object.assign(out,bestPairs(j))}return out}
async function refresh(){
  const addrs=[WSOL].concat(B.watch.map(w=>w.a),Object.keys(B.pos)).filter((v,i,a)=>a.indexOf(v)===i);
  try{
    const by=await fetchTokens(addrs);
    if(by[WSOL])SOLUSD=+by[WSOL].priceUsd;
    Object.values(by).forEach(p=>{if(p.baseToken.address!==WSOL)P[p.baseToken.address]=snap(p)});
    feed="live";lastAt=Date.now();
    localStorage.setItem(PCACHE,JSON.stringify({P,SOLUSD,at:lastAt}));
  }catch(e){
    feed="offline";simWalk();
  }
  pipeline();riskSweep();render();
}
function simWalk(){ /* offline: keep the book usable with a labeled random walk around last cached prices */
  if(!SOLUSD)SOLUSD=150;
  B.watch.forEach(w=>{let p=P[w.a];if(!p){p=P[w.a]={a:w.a,s:w.s,n:w.s,usd:0.01,native:0.01/SOLUSD,liq:250000,vol:100000,ch:{},tx:{},t:Date.now()}}
    const k=1+(Math.random()-.5)*0.01;p.usd*=k;if(p.native)p.native*=k;p.sim=true;p.t=Date.now()});
}
async function scout(){
  if(hooks.isKilled()){PIPE.scout={s:"halt",m:"kill switch tripped — scout frozen",n:0};render();return}
  PIPE.scout.s="run";PIPE.scout.m="sweeping DexScreener boosts + new profiles (public, read-only)";render();
  try{
    const [boosts,profiles]=await Promise.all([getJSON(API+"/token-boosts/latest/v1").catch(()=>[]),getJSON(API+"/token-profiles/latest/v1").catch(()=>[])]);
    const addrs=[].concat(boosts||[],profiles||[]).filter(x=>x&&x.chainId==="solana").map(x=>x.tokenAddress).filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,30);
    const by=addrs.length?await fetchTokens(addrs):{};
    SCOUTED=Object.values(by).map(snap);
    PIPE.scout={s:"ok",m:`${addrs.length} Solana tokens surfaced · ${ct()} CT`,n:addrs.length};
  }catch(e){PIPE.scout={s:"warn",m:"public feed unreachable — offline, watchlist only",n:0}}
  pipeline();render();
}

/* ---------- agent pipeline (paper) ---------- */
function score(p){ if(!p)return 0;
  const liqS=Math.min(1,Math.log10(Math.max(p.liq,1))/7)*30;              // depth
  const volS=Math.min(1,(p.vol/Math.max(p.liq,1))/3)*20;                   // turnover
  const m=(+p.ch.h1||0),m5=(+p.ch.m5||0);const momS=Math.max(0,Math.min(25,12.5+m*1.2+m5*2));
  const b=+p.tx.buys||0,s=+p.tx.sells||0;const flowS=(b+s)?(b/(b+s))*20:10;
  const ageH=p.created?(Date.now()-p.created)/36e5:999;const ageS=ageH<1?0:ageH<24?3:5;
  return Math.round(liqS+volS+momS+flowS+ageS);
}
function filt(p){const c=B.cfg;if(!p)return "no data";if(p.liq<c.minLiq)return "liq < "+fmtUsd(c.minLiq);if((+p.ch.h24||0)<-60)return "−60% day";if(p.created&&Date.now()-p.created<36e5)return "< 1h old";return ""}
function candidates(){const pool={};B.watch.forEach(w=>{if(P[w.a])pool[w.a]=P[w.a]});SCOUTED.forEach(p=>{pool[p.a]=p});return Object.values(pool)}
function pipeline(){
  const all=candidates();const pass=all.filter(p=>!filt(p));
  PIPE.filter={s:pass.length?"ok":"idle",m:`${pass.length}/${all.length} pass (liq ≥ ${fmtUsd(B.cfg.minLiq)}, age ≥ 1h)`,n:pass.length};
  const scored=pass.map(p=>({p,sc:score(p)})).sort((a,b)=>b.sc-a.sc);
  const hot=scored.filter(x=>x.sc>=B.cfg.minScore);
  PIPE.analyst={s:hot.length?"ok":"idle",m:hot.length?`${hot.length} ≥ ${B.cfg.minScore}: `+hot.slice(0,3).map(x=>x.p.s+" "+x.sc).join(", "):`none ≥ ${B.cfg.minScore} (top ${scored[0]?scored[0].p.s+" "+scored[0].sc:"—"})`,n:hot.length,list:scored.slice(0,8)};
  if(hooks.isKilled()||B.halted){PIPE.exec={s:"halt",m:B.halted?"risk halt — daily loss limit hit":"kill switch tripped — no paper fills",n:PIPE.exec.n};return}
  if(!B.cfg.auto){PIPE.exec={s:"idle",m:"manual · auto-paper OFF",n:PIPE.exec.n};return}
  if(feed!=="live"){PIPE.exec={s:"warn",m:"auto-paper waits for live public prices",n:PIPE.exec.n};return}
  let did=0;hot.slice(0,2).forEach(x=>{if(B.pos[x.p.a])return;const r=fill("buy",x.p.a,B.cfg.size,"auto · analyst "+x.sc);if(r.ok)did++});
  PIPE.exec={s:did?"run":"ok",m:did?`auto-paper bought ${did}`:"auto-paper armed · nothing new",n:PIPE.exec.n+did};
}
function equity(){let v=B.cfg?B.cash:0;Object.values(B.pos).forEach(x=>{v+=x.qty*markSol(x.a)});return v}
function markSol(a){const p=P[a];if(!p)return 0;return p.native!=null?p.native:(SOLUSD?p.usd/SOLUSD:0)}
function riskSweep(){
  const c=B.cfg;let hits=[];
  Object.values(B.pos).forEach(x=>{const m=markSol(x.a);if(!m)return;const ch=(m/x.avg-1)*100;
    if(ch<=-c.sl)hits.push([x.a,"stop-loss "+ch.toFixed(1)+"%"]);else if(ch>=c.tp)hits.push([x.a,"take-profit +"+ch.toFixed(1)+"%"])});
  if(!hooks.isKilled())hits.forEach(h=>fill("sell",h[0],null,"risk · "+h[1]));
  const dd=(equity()/B.startCash-1)*100;
  if(dd<=-c.dailyLossPct&&!B.halted){B.halted=true;save()}
  PIPE.risk={s:B.halted?"halt":hits.length?"warn":"ok",m:B.halted?`HALT · drawdown ${dd.toFixed(1)}% ≤ −${c.dailyLossPct}%`:`SL −${c.sl}% · TP +${c.tp}% · max pos ${c.maxPosPct}% · dd ${dd.toFixed(1)}%`,n:hits.length};
}

/* ---------- simulated fills ---------- */
function quote(side,a,sizeSol,qty){
  const p=P[a];if(!p)return {ok:false,why:"no price yet"};
  const mid=markSol(a);if(!mid)return {ok:false,why:"no SOL price"};
  const poolSol=SOLUSD?(p.liq/2)/SOLUSD:0;if(!poolSol)return {ok:false,why:"no liquidity data"};
  const notional=side==="buy"?sizeSol:qty*mid;
  const impact=notional/(poolSol+notional);
  return {ok:true,mid,impact,poolSol,notional,fee:notional*FEE_DEX+FEE_NET_SOL,sim:!!p.sim};
}
function fill(side,a,sizeSol,why){
  const c=B.cfg,p=P[a];
  if(hooks.isKilled())return {ok:false,why:"kill switch tripped"};
  if(B.halted&&side==="buy")return {ok:false,why:"risk halt active"};
  let qty=null;
  if(side==="sell"){const x=B.pos[a];if(!x)return {ok:false,why:"no position"};qty=x.qty}
  else{sizeSol=+sizeSol;if(!(sizeSol>0))return {ok:false,why:"size must be > 0"};
    if(sizeSol+FEE_NET_SOL>B.cash)return {ok:false,why:"not enough paper SOL"};
    const cur=B.pos[a]?B.pos[a].qty*markSol(a):0;if((cur+sizeSol)/Math.max(equity(),1e-9)*100>c.maxPosPct+1e-9)return {ok:false,why:`max position ${c.maxPosPct}% of equity`};
    if(p&&p.liq<c.minLiq)return {ok:false,why:"liquidity below filter"}}
  const q=quote(side,a,sizeSol,qty);if(!q.ok)return q;
  const drift=(Math.random()*2-1)*DRIFT;
  const slip=q.impact+Math.max(0,drift);           // adverse move vs mid
  if(slip*100>c.slipTol)return {ok:false,why:`slippage ${(slip*100).toFixed(2)}% > tolerance ${c.slipTol}% (would revert)`};
  let px,f;
  if(side==="buy"){px=q.mid*(1+q.impact+drift);const spend=sizeSol-sizeSol*FEE_DEX;const got=spend/px;
    B.cash-=sizeSol+FEE_NET_SOL;
    const x=B.pos[a]||{a,s:p.s,qty:0,avg:0,cost:0,opened:Date.now()};x.cost+=sizeSol+FEE_NET_SOL;x.qty+=got;x.avg=x.cost/x.qty;B.pos[a]=x;
    f={t:Date.now(),side,a,s:p.s,sol:sizeSol,qty:got,px,mid:q.mid,slip:(px/q.mid-1)*1e4,fee:sizeSol*FEE_DEX+FEE_NET_SOL,why,sim:q.sim};
  }else{px=q.mid*(1-q.impact-drift);const gross=qty*px;const net=gross-gross*FEE_DEX-FEE_NET_SOL;
    const x=B.pos[a];const pnl=net-x.cost;B.realized+=pnl;B.cash+=net;delete B.pos[a];
    f={t:Date.now(),side,a,s:p.s,sol:net,qty,px,mid:q.mid,slip:(1-px/q.mid)*1e4,fee:gross*FEE_DEX+FEE_NET_SOL,pnl,why,sim:q.sim};
  }
  B.fills.unshift(f);if(B.fills.length>200)B.fills.length=200;save();
  if(hooks.onFill)try{hooks.onFill(f)}catch(e){}
  render();return {ok:true,f};
}

/* ---------- UI ---------- */
function stat(k,v,c){return `<div class="pd-stat"><span>${k}</span><b class="${c||""}">${v}</b></div>`}
function render(){
  if(hooks.onChange)try{hooks.onChange(summary())}catch(e){}
  if(!root||!root.isConnected)return;
  const eq=equity(),upnl=Object.values(B.pos).reduce((s,x)=>s+(x.qty*markSol(x.a)-x.cost),0),tot=eq-B.startCash;
  const killed=hooks.isKilled();
  const age=lastAt?Math.round((Date.now()-lastAt)/1000):null;
  const el=$("#pd-body",root);if(!el)return;
  const focus=document.activeElement&&root.contains(document.activeElement)?document.activeElement.id:null;
  const sym=$("#pd-tok",root)?$("#pd-tok",root).value:null, sz=$("#pd-size",root)?$("#pd-size",root).value:null;
  const watchRows=B.watch.map(w=>{const p=P[w.a];const sc=p?score(p):0;const fl=p?filt(p):"no data";
    return `<tr><td><b>${esc(p?p.s:w.s)}</b>${p&&p.sim?' <em class="pd-sim">SIM</em>':""}</td><td>${p?fmtUsd(p.usd):"—"}</td><td class="${cls(p&&+p.ch.m5)}">${p?pct(+p.ch.m5):"—"}</td><td class="${cls(p&&+p.ch.h1)}">${p?pct(+p.ch.h1):"—"}</td><td class="${cls(p&&+p.ch.h24)}">${p?pct(+p.ch.h24):"—"}</td><td>${p?fmtUsd(p.liq):"—"}</td><td>${p?fmtUsd(p.vol):"—"}</td><td><span class="pd-score ${sc>=B.cfg.minScore?"hot":""}" title="${esc(fl||"passes filter")}">${p?sc:"—"}</span></td>
    <td class="pd-acts"><button class="btn go" data-pd="buy" data-a="${w.a}">Paper buy</button>${B.pos[w.a]?`<button class="btn no" data-pd="sell" data-a="${w.a}">Sell</button>`:""}<button class="btn ghost" data-pd="unwatch" data-a="${w.a}" title="remove">×</button></td></tr>`}).join("");
  const scoutRows=(PIPE.analyst.list||[]).filter(x=>!B.watch.some(w=>w.a===x.p.a)).slice(0,5).map(x=>`<tr><td><b>${esc(x.p.s)}</b> <small>${esc((x.p.n||"").slice(0,18))}</small></td><td>${fmtUsd(x.p.usd)}</td><td class="${cls(+x.p.ch.h1)}">${pct(+x.p.ch.h1)}</td><td>${fmtUsd(x.p.liq)}</td><td><span class="pd-score ${x.sc>=B.cfg.minScore?"hot":""}">${x.sc}</span></td><td><button class="btn ghost" data-pd="watch" data-a="${x.p.a}" data-s="${esc(x.p.s)}">+ watch</button></td></tr>`).join("");
  const posRows=Object.values(B.pos).map(x=>{const m=markSol(x.a),val=x.qty*m,pl=val-x.cost,plp=x.cost?pl/x.cost*100:0;
    return `<tr><td><b>${esc(x.s)}</b></td><td>${x.qty.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>${fmtSol(x.cost)}</td><td>${fmtSol(val)}</td><td class="${cls(pl)}">${fmtSol(pl)} · ${pct(plp)}</td><td><button class="btn no" data-pd="sell" data-a="${x.a}">Close</button></td></tr>`}).join("")||`<tr><td colspan="6" class="pd-empty">flat — no paper positions</td></tr>`;
  const fillRows=B.fills.slice(0,14).map(f=>`<tr><td>${new Date(f.t).toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour12:false})}</td><td class="${f.side==="buy"?"up":"dn"}">${f.side.toUpperCase()}</td><td>${esc(f.s)}${f.sim?' <em class="pd-sim">SIM</em>':""}</td><td>${fmtSol(f.sol)}</td><td>${(f.slip).toFixed(0)} bps</td><td>${fmtSol(f.fee)}</td><td class="${cls(f.pnl)}">${f.pnl!=null?fmtSol(f.pnl):""}</td><td><small>${esc(f.why||"")}</small></td></tr>`).join("")||`<tr><td colspan="8" class="pd-empty">no paper fills yet</td></tr>`;
  const st={idle:"·",ok:"●",run:"◉",warn:"▲",halt:"■"};
  const pipe=[["scout","SCOUT","#2dff7a"],["filter","FILTER","#3b82ff"],["analyst","ANALYST","#ff9a1f"],["exec","EXECUTOR · PAPER","#a24bff"],["risk","RISK","#ff3b4e"]].map(([k,l,c])=>`<div class="pd-node s-${PIPE[k].s}" style="--c:${c}"><div class="pd-nh"><span class="pd-ns">${st[PIPE[k].s]||"·"}</span>${l}<b>${PIPE[k].n||""}</b></div><div class="pd-nm">${esc(PIPE[k].m)}</div></div>`).join('<i class="pd-arrow">→</i>');
  const tokOpts=B.watch.map(w=>`<option value="${w.a}">${esc(P[w.a]?P[w.a].s:w.s)}</option>`).join("");
  el.innerHTML=`
  <div class="pd-stats">
    ${stat("PAPER CASH",fmtSol(B.cash))}${stat("EQUITY",fmtSol(eq))}${stat("EQUITY USD",SOLUSD?fmtUsd(eq*SOLUSD):"—")}
    ${stat("TOTAL P&L",fmtSol(tot)+" · "+pct(tot/B.startCash*100),cls(tot))}${stat("UNREALIZED",fmtSol(upnl),cls(upnl))}${stat("REALIZED",fmtSol(B.realized),cls(B.realized))}
    ${stat("SOL/USD",SOLUSD?"$"+SOLUSD.toFixed(2):"—")}${stat("FEED",feed==="live"?`LIVE · ${age}s`:feed==="offline"?"OFFLINE · SIM WALK":"…",feed==="live"?"up":"dn")}
  </div>
  <div class="pd-pipe">${pipe}</div>
  <div class="pd-grid">
    <section class="pd-card pd-watch"><h5>WATCHLIST · public DexScreener pairs <span><input id="pd-q" placeholder="search token (read-only)" value="${esc(LASTQ)}"><button class="btn ghost" data-pd="search">Find</button></span></h5>
      <table><thead><tr><th>Token</th><th>Price</th><th>5m</th><th>1h</th><th>24h</th><th>Liq</th><th>Vol 24h</th><th>Score</th><th></th></tr></thead><tbody>${watchRows}</tbody></table>
      <div id="pd-sres">${SRES}</div>
      ${scoutRows?`<h5 style="margin-top:10px">SCOUT FINDS · not on watchlist</h5><table><tbody>${scoutRows}</tbody></table>`:""}
    </section>
    <section class="pd-card pd-ticket"><h5>ORDER TICKET · PAPER</h5>
      <label>Token<select id="pd-tok">${tokOpts}</select></label>
      <label>Size (◎ SOL)<input id="pd-size" type="number" min="0.01" step="0.05" value="${B.cfg.size}"></label>
      <div id="pd-est" class="pd-est"></div>
      <div class="pd-row"><button class="btn go" data-pd="tbuy">PAPER BUY</button><button class="btn no" data-pd="tsell">PAPER SELL ALL</button></div>
      <h5 style="margin-top:12px">RISK + AGENT CONFIG</h5>
      <div class="pd-cfg">
        <label>min score<input data-cfg="minScore" type="number" value="${B.cfg.minScore}"></label>
        <label>slip tol %<input data-cfg="slipTol" type="number" step="0.1" value="${B.cfg.slipTol}"></label>
        <label>max pos %<input data-cfg="maxPosPct" type="number" value="${B.cfg.maxPosPct}"></label>
        <label>stop %<input data-cfg="sl" type="number" value="${B.cfg.sl}"></label>
        <label>take %<input data-cfg="tp" type="number" value="${B.cfg.tp}"></label>
        <label>min liq $<input data-cfg="minLiq" type="number" step="1000" value="${B.cfg.minLiq}"></label>
        <label>day loss %<input data-cfg="dailyLossPct" type="number" value="${B.cfg.dailyLossPct}"></label>
        <label>auto size ◎<input data-cfg="size" type="number" step="0.05" value="${B.cfg.size}"></label>
      </div>
      <label class="pd-tog"><input type="checkbox" id="pd-auto" ${B.cfg.auto?"checked":""}> auto-paper (executor fills analyst picks ≥ min score — simulated)</label>
      <div class="pd-row"><input id="pd-start" type="number" step="0.5" min="0.1" value="${B.startCash}" style="width:70px"><button class="btn ghost" data-pd="reset">Reset book (◎)</button>${B.halted?'<button class="btn go" data-pd="unhalt">Clear risk halt</button>':""}</div>
      ${killed?'<div class="pd-killed">KILL SWITCH TRIPPED · paper executor frozen</div>':""}
    </section>
    <section class="pd-card"><h5>POSITIONS · PAPER</h5><table><thead><tr><th>Token</th><th>Qty</th><th>Cost</th><th>Value</th><th>P&L</th><th></th></tr></thead><tbody>${posRows}</tbody></table></section>
    <section class="pd-card"><h5>FILLS · SIMULATED (CT)</h5><table><thead><tr><th>Time</th><th>Side</th><th>Token</th><th>◎</th><th>Slip</th><th>Fee</th><th>P&L</th><th>Why</th></tr></thead><tbody>${fillRows}</tbody></table></section>
  </div>`;
  if(sym&&$("#pd-tok",root))$("#pd-tok",root).value=sym;
  if(sz&&$("#pd-size",root))$("#pd-size",root).value=sz;
  if(focus&&$("#"+focus,root))$("#"+focus,root).focus();
  est();
}
function est(){const e=$("#pd-est",root);if(!e)return;const a=$("#pd-tok",root).value,s=+$("#pd-size",root).value;const q=quote("buy",a,s);
  if(!q.ok){e.innerHTML=`<span class="dn">${esc(q.why)}</span>`;return}
  const px=q.mid*(1+q.impact),got=(s*(1-FEE_DEX))/px;
  e.innerHTML=`mid ${q.mid.toPrecision(4)} ◎ · impact <b class="${q.impact*100>B.cfg.slipTol?"dn":""}">${(q.impact*100).toFixed(3)}%</b> · fee ${fmtSol(q.fee)}<br>est. receive ≈ ${got.toLocaleString(undefined,{maximumFractionDigits:2})} ${esc(P[a].s)} · pool ≈ ${q.poolSol.toFixed(0)} ◎ per side${q.sim?' · <em class="pd-sim">SIM PRICE</em>':""}`}
function msg(t,bad){const m=document.getElementById("toast");if(!m)return;m.textContent=t;m.className="toast show"+(bad?" red":"");clearTimeout(m._h);m._h=setTimeout(()=>m.className="toast",2600)}
async function search(q){const box=$("#pd-sres",root);if(!q){return}LASTQ=q;box.innerHTML='<div class="pd-empty">searching public pairs…</div>';
  try{const j=await getJSON(API+"/latest/dex/search?q="+encodeURIComponent(q));const by=bestPairs(j.pairs);const list=Object.values(by).map(snap).sort((a,b)=>b.liq-a.liq).slice(0,6);
    list.forEach(p=>{P[p.a]=p});
    SRES=list.length?`<table><tbody>${list.map(p=>`<tr><td><b>${esc(p.s)}</b> <small>${esc(p.n.slice(0,20))}</small></td><td>${fmtUsd(p.usd)}</td><td>${fmtUsd(p.liq)}</td><td><span class="pd-score">${score(p)}</span></td><td><button class="btn ghost" data-pd="watch" data-a="${p.a}" data-s="${esc(p.s)}">+ watch</button></td></tr>`).join("")}</tbody></table>`:'<div class="pd-empty">no Solana pairs</div>';box.innerHTML=SRES;
  }catch(e){SRES='<div class="pd-empty dn">search unavailable offline</div>';box.innerHTML=SRES}}
function onClick(e){const b=e.target.closest("[data-pd]");if(!b||!root.contains(b))return;const k=b.dataset.pd,a=b.dataset.a;let r;
  if(k==="buy"){r=fill("buy",a,B.cfg.size,"manual")}
  else if(k==="sell"){r=fill("sell",a,null,"manual")}
  else if(k==="tbuy"){r=fill("buy",$("#pd-tok",root).value,+$("#pd-size",root).value,"ticket")}
  else if(k==="tsell"){r=fill("sell",$("#pd-tok",root).value,null,"ticket")}
  else if(k==="watch"){SRES="";if(!B.watch.some(w=>w.a===a))B.watch.push({a,s:b.dataset.s});save();refresh();return}
  else if(k==="unwatch"){if(B.pos[a]){msg("Close the paper position first",true);return}B.watch=B.watch.filter(w=>w.a!==a);save();render();return}
  else if(k==="search"){search($("#pd-q",root).value.trim());return}
  else if(k==="reset"){const c=Math.max(0.1,+$("#pd-start",root).value||5);if(!confirm(`Reset the paper book to ${c} SOL? (local only)`))return;const w=B.watch,cfg=B.cfg;B=freshBook(c);B.watch=w;B.cfg=cfg;save();msg(`Paper book reset · ${c} ◎`);render();return}
  else if(k==="unhalt"){B.halted=false;B.startCash=equity();save();riskSweep();render();return}
  if(r){if(r.ok)msg(`PAPER ${r.f.side.toUpperCase()} ${r.f.s} · ${fmtSol(r.f.sol)} · slip ${r.f.slip.toFixed(0)} bps — simulated, nothing sent`);else msg("Paper order rejected · "+r.why,true)}
}
function onInput(e){const t=e.target;if(!root.contains(t))return;
  if(t.dataset.cfg){const v=+t.value;if(isFinite(v)){B.cfg[t.dataset.cfg]=v;save();pipeline();riskSweep()}}
  if(t.id==="pd-auto"){B.cfg.auto=t.checked;save();pipeline();render()}
  if(t.id==="pd-tok"||t.id==="pd-size")est();
  if(t.id==="pd-q"&&e.key==="Enter")search(t.value.trim());
}
function summary(){const eq=equity();return {eq,cash:B.cash,pnl:eq-B.startCash,pnlPct:(eq/B.startCash-1)*100,pos:Object.keys(B.pos).length,fills:B.fills.length,solusd:SOLUSD,feed,lastAt,age:lastAt?Math.round((Date.now()-lastAt)/1000):null,pipe:PIPE,last:B.fills[0]||null}}
function mount(el){root=el;el.innerHTML=`<div class="pd-banner">PAPER ONLY · NO LIVE ORDERS · NO SPEND <small>public DexScreener data (GET, read-only) · simulated fills · no wallet, keys, RPC, or swap API</small></div><div id="pd-body"></div>`;
  if(!el._wired){el.addEventListener("click",onClick);el.addEventListener("change",onInput);el.addEventListener("input",e=>{if(e.target.id==="pd-tok"||e.target.id==="pd-size")est()});el.addEventListener("keydown",onInput);el._wired=1}
  render();
}
function start(){if(window.SCANNERS_PAUSED!==false){feed="paused";PIPE.scout={s:"halt",m:"Paused",n:0};PIPE.exec={s:"halt",m:"Paused · no paper fills",n:PIPE.exec.n};render();return}if(timer)return;refresh();scout();timer=setInterval(refresh,REFRESH_MS);scoutTimer=setInterval(scout,SCOUT_MS)}
window.PaperDesk={mount,start,refresh,summary,hooks,fill,quote,score,_book:()=>B};
})();
