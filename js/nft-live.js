/* Expire HQ · NFT Live (GORK-NFT)
 * READ ONLY · Magic Eden public stats via local /proxy/me/ · NO buy/list/mint
 */
(function(){"use strict";
const REFRESH_MS=12000;
const WATCH=[
  {sym:"mad_lads",name:"Mad Lads"},
  {sym:"okay_bears",name:"Okay Bears"},
  {sym:"famous_fox_federation",name:"Famous Fox"},
  {sym:"tensorians",name:"Tensorians"}
];
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lamports=v=>v==null||!isFinite(+v)?null:+v/1e9;
const fmtSol=v=>v==null||!isFinite(v)?"—":(Math.abs(v)>=100?v.toFixed(1):Math.abs(v)>=1?v.toFixed(2):v.toFixed(3))+" ◎";
const fmtUsdish=v=>v==null||!isFinite(v)?"—":v>=1e6?(v/1e6).toFixed(2)+"M":v>=1e3?(v/1e3).toFixed(1)+"k":v.toFixed(0);
let DATA={}, lastAt=0, feed="boot", timer=null, strip=null;

async function getJSON(url){
  const r=await fetch(url,{method:"GET",cache:"no-store",credentials:"omit"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}
async function fetchOne(sym){
  const stats=await getJSON("/proxy/me/collections/"+encodeURIComponent(sym)+"/stats");
  let sales=[];
  try{
    const acts=await getJSON("/proxy/me/collections/"+encodeURIComponent(sym)+"/activities?offset=0&limit=8");
    sales=(acts||[]).filter(a=>a&&(a.type==="buy"||a.type==="sale"||a.type==="acceptBid")).slice(0,4)
      .map(a=>({price:+a.price||0,t:(a.blockTime||0)*1000,type:a.type}));
    if(!sales.length){ // show recent lists as activity fallback
      sales=(acts||[]).filter(a=>a&&a.price!=null).slice(0,3).map(a=>({price:+a.price||0,t:(a.blockTime||0)*1000,type:a.type||"act"}));
    }
  }catch(e){}
  return {
    sym, floor:lamports(stats.floorPrice), listed:+stats.listedCount||0,
    avg24:lamports(stats.avgPrice24hr), vol7d:lamports(stats.volume7d),
    sales, raw:stats, t:Date.now()
  };
}
async function refresh(){
  try{
    const out={};
    // sequential to stay gentle on ME rate limit (180/min)
    for(const w of WATCH){
      try{out[w.sym]=await fetchOne(w.sym)}catch(e){out[w.sym]=DATA[w.sym]||{sym:w.sym,err:String(e.message||e),t:Date.now()}}
    }
    DATA=out;feed="live";lastAt=Date.now();
  }catch(e){feed="offline"}
  paint();
  if(window.HQ&&HQ.onNftLive)try{HQ.onNftLive(summary())}catch(e){}
}
function age(){return lastAt?Math.round((Date.now()-lastAt)/1000):null}
function summary(){return {feed,lastAt,age:age(),watch:WATCH.map(w=>({...w,...(DATA[w.sym]||{})}))}}
function row(w){
  const d=DATA[w.sym];
  if(!d)return `<div class="nl-row"><b>${esc(w.name)}</b><span>…</span></div>`;
  if(d.err)return `<div class="nl-row"><b>${esc(w.name)}</b><span class="dn">err</span></div>`;
  const sale=d.sales&&d.sales[0]?` · last ${fmtSol(d.sales[0].price)}` : "";
  return `<div class="nl-row" title="listed ${d.listed} · avg24 ${fmtSol(d.avg24)} · vol7d ${fmtSol(d.vol7d)}${sale}">
    <b>${esc(w.name)}</b>
    <span class="nl-fl">${fmtSol(d.floor)}</span>
    <span class="nl-ls">${d.listed} listed</span>
    <span class="nl-v7">${fmtSol(d.vol7d)} 7d</span>
  </div>`;
}
function paint(){
  const wall=$("#nftwall");
  if(wall){
    const a=age();
    wall.innerHTML=`<div class="nl-h">NFT LIVE · ME <em class="${feed==="live"?"up":"dn"}">${feed==="live"?`LIVE · ${a}s`:(feed||"…").toUpperCase()}</em></div>`
      +WATCH.map(row).join("")
      +`<div class="nl-foot">READ ONLY · no buy/list/mint</div>`;
  }
  if(strip){
    const a=age();
    strip.innerHTML=`<span class="nl-badge ${feed==="live"?"on":""}">${feed==="live"?`LIVE · ${a}s`:"NFT OFF"}</span>`
      +WATCH.map(w=>{const d=DATA[w.sym];return `<span><b>${esc(w.name)}</b> ${d&&d.floor!=null?fmtSol(d.floor):"—"}</span>`}).join("");
  }
}
function mountStrip(el){strip=el;paint()}
function start(){if(timer)return;refresh();timer=setInterval(refresh,REFRESH_MS);setInterval(()=>{if(feed==="live")paint()},1000)}
window.NftLive={start,refresh,summary,mountStrip,paint,WATCH,REFRESH_MS};
})();
