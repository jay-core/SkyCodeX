/* ---------- preview shift: deterministic animation, driven by seek(t) ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const ST=(pos='45:42',p='no problems')=>`<span>${pos}</span><span>clangd ready</span><span>${p}</span>`;
const COLW=372, TRAIL_H=46;
const cv=(s,map)=>Object.entries(map).reduce((a,[k,v])=>a.split(k).join(v),s);
const L1C=[
  card('parse_headers','http/headers.cpp:12',cv(C_PARSE,{'«c:split|':'«c:L2-split|','«c:trim|':'«c:L2-trim|'}),{id:'L1-parse_headers',focus:true,c:{start:12,params:['raw'],active:18}}),
  card('route','router.cpp:31',C_ROUTE,{id:'L1-route',c:{start:31,params:['path','routes']}}),
  card('send_response','net/io.cpp:58',C_SEND,{id:'L1-send_response',c:{start:58,params:['s','r']}})];
const L2C=[card('split','util/strings.cpp:8',C_SPLIT,{id:'L2-split',c:{start:8,params:['s','delim']}}),
  card('trim','util/strings.cpp:27',cv(C_TRIM,{'«c:is_space|':'«c:L3-is_space|'}),{id:'L2-trim',focus:true,c:{start:27,params:['s'],active:31}})];
const L3C=[card('is_space','util/chars.hpp:5',R`constexpr bool is_space(char c) noexcept {
    return «c:L4-ascii_class|ascii_class»(c) & kSpace;«cur|»
}`,{id:'L3-is_space',focus:true,c:{start:5,params:['c'],active:6}}),`<div class="cnote" style="color:#3f453f;padding:4px 2px">2 std calls hidden — remove_prefix, remove_suffix</div>`];
const L4C=[card('ascii_class','util/chars.hpp:12',R`constexpr uint8_t ascii_class(char c) noexcept {
    auto u = static_cast<unsigned char>(c);
    return u < 128 ? «c:L5-class_table|class_table»()[u] : 0;«cur|»
}`,{id:'L4-ascii_class',focus:true,c:{start:12,params:['c'],active:14}})];
const L5C=[card('class_table','util/chars.hpp:20',R`constexpr const Table& class_table() noexcept {
    static constexpr Table t = {
        /* 0x00 */ 0, 0, 0, 0, 0, 0, 0, 0,
        /* 0x08 */ 0, S, S, S, S, S, 0, 0,
        /* 0x20 */ S, P, P, P, P, P, P, P,
        /* 0x30 */ D, D, D, D, D, D, D, D,
    };
    return t;
}`,{id:'L5-class_table',c:{start:20}}),`<div class="cnote" style="color:#3f453f;padding:4px 2px">end of chain — no further calls</div>`];
const COLS=[L1C,L2C,L3C,L4C,L5C];
const TRAIL=['Server::handle','parse_headers','trim','is_space','ascii_class'];

const html=`<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
  <div class="hdr">${PV('server.cpp',['headers.cpp','strings.cpp'],'Server::handle')}<span class="right">${ST()}</span></div>
  <div style="flex:1;display:flex;min-height:0">
    <div class="pane" style="width:500px;flex:none" id="codep">${code(cv(MAIN.replace('«pin:2|»',''),{'«c:parse_headers|':'«c:L1-parse_headers|','«c:route|':'«c:L1-route|','«c:send_response|':'«c:L1-send_response|'}),{start:30,active:45,params:['req']})}</div>
    <div id="pva" style="flex:1;position:relative;overflow:hidden;background:var(--prev)">
      <div id="trail" style="position:absolute;left:0;top:0;height:${TRAIL_H}px;right:0">${TRAIL.map((t,i)=>`<span class="tr" data-i="${i}" style="position:absolute;top:10px;left:${22+i*COLW}px;font:300 21px var(--ui);white-space:nowrap">${t}</span>`).join('')}</div>
      ${COLS.map((items,i)=>`<div class="colm" data-i="${i}" style="position:absolute;top:${TRAIL_H}px;left:12px;width:${COLW}px;bottom:46px">${items.map(x=>`<div class="it" style="margin:0 10px 10px 10px">${x}</div>`).join('')}</div>`).join('')}
      <div id="bar" style="position:absolute;left:0;right:0;bottom:0;height:46px;display:flex;align-items:center;gap:26px;padding:0 22px;font:300 14px var(--ui);color:#4f564f;background:var(--prev)">
        <span id="bsrc">‹ source</span><span id="blvl" style="font-size:12.5px;color:#3a3f3a">levels 1–2 of 5</span><span style="flex:1"></span><span id="bshift">shift preview ›</span></div>
    </div>
    <div class="pane files" style="width:190px;flex:none">${tree(TREE_MAIN)}</div>
  </div><svg id="lk" style="position:absolute;left:0;top:0;pointer-events:none;z-index:6;overflow:visible" width="1440" height="900"></svg></div>`;
document.getElementById('root').innerHTML=html;

const cols=[...document.querySelectorAll('.colm')].map(c=>[...c.children]);
const trs=[...document.querySelectorAll('.tr')];
const clamp=x=>Math.max(0,Math.min(1,x));
const expo=p=>p>=1?1:1-Math.pow(2,-10*p);
const inC=p=>p*p*p;
const mix=(a,b,p)=>{const A=a.match(/\w\w/g).map(h=>parseInt(h,16)),B=b.match(/\w\w/g).map(h=>parseInt(h,16));return '#'+A.map((x,i)=>Math.round(x+(B[i]-x)*p).toString(16).padStart(2,'0')).join('');};
// colours per card, by order in its column
const colour={};cols.forEach(items=>{let k=0;items.forEach(it=>{const c=it.querySelector('[data-card]');if(!c)return;colour[c.dataset.card]=PAL[k++%PAL.length];c.querySelector('.sw').style.background=colour[c.dataset.card];});});

function setItem(it,x,o,rot=0){it.style.transformOrigin='left center';it.style.transform=`translateX(${x}px)`+(rot?` perspective(900px) rotateY(${rot}deg)`:'');it.style.opacity=o;}
function layoutStatic(v){cols.forEach((items,i)=>{const s=i-v;items.forEach(it=>setItem(it,s*COLW,(s===0||s===1)?1:0));});}
function trailAt(off,v){trs.forEach((t,i)=>{t.style.transform=`translateX(${-off}px)`;const inWin=i===Math.round(v)||i===Math.round(v)+1;t.style.color=inWin?'#a3a8a0':'#2f332f';});}
function trailBlend(off,a,b,p){trs.forEach((t,i)=>{t.style.transform=`translateX(${-off}px)`;const wa=(i===a||i===a+1)?1:0,wb=(i===b||i===b+1)?1:0;t.style.color=mix('#2f332f','#a3a8a0',wa+(wb-wa)*p);});}

function drawLinks2(v,alpha){
  const svg=document.getElementById('lk');if(alpha<=0){svg.innerHTML='';return;}
  document.querySelectorAll('.call').forEach(c=>{c.style.textDecoration='none';});
  const wr=document.querySelector('.win').getBoundingClientRect();let out='';
  const srcs=v===0?[...document.querySelectorAll('#codep .call')]:[];
  cols[v].forEach(it=>it.querySelectorAll('.card.focus .call').forEach(c=>srcs.push(c)));
  srcs.forEach(el=>{const id=el.dataset.call;const t=document.querySelector(`[data-card="${id}"]`);if(!t)return;const col=colour[id];
    const a=el.getBoundingClientRect(),hold=el.closest('.colm')||el.closest('.pane');const pr=hold.getBoundingClientRect();
    const rg=document.createRange();rg.selectNodeContents(el.closest('.t'));const tr=rg.getBoundingClientRect();
    const b=t.querySelector('.card-h').getBoundingClientRect();
    const xe=Math.min(pr.right,document.getElementById('pva').getBoundingClientRect().right)-wr.left-(el.closest('.colm')?14:0);
    const y1=a.top+a.height/2-wr.top,x1=Math.min(Math.max(a.right-wr.left+2,tr.right-wr.left+8),xe),x2=b.left-wr.left,y2=b.top+b.height/2-wr.top;
    el.style.textDecoration=`underline ${col}`;el.style.textUnderlineOffset='4px';
    const k=Math.max(26,(x2-xe)*.55);
    if(xe-x1>2)out+=`<path d="M${x1} ${y1} L${xe} ${y1}" stroke="${col}" stroke-width="1.2" stroke-dasharray="2 4" opacity=".5" fill="none"/><circle cx="${x1}" cy="${y1}" r="2.4" fill="${col}"/>`;
    out+=`<path d="M${xe} ${y1} C${xe+k} ${y1} ${x2-k} ${y2} ${x2} ${y2}" stroke="${col}" stroke-width="1.5" opacity=".8" fill="none"/><circle cx="${x2}" cy="${y2}" r="3" fill="${col}"/>`;});
  svg.innerHTML=out;svg.style.opacity=alpha;}

// timeline
const SHIFT=0.85,BACK=0.95;
const EV=[{t:1.0,k:'f',v:0},{t:2.75,k:'f',v:1},{t:4.5,k:'f',v:2},{t:6.4,k:'b',v:3}];
window.TOTAL=8.3;
function press(id,t,t0){const p=t-(t0-0.14);const on=p>=0&&p<0.32;const el=document.getElementById(id);el.style.color=on?'#c9b98f':'';el.style.background=on?'rgba(255,255,255,.045)':'';el.style.padding='6px 10px';el.style.margin='0 -10px';}
window.seek=function(t){
  let v=0,act=null;
  for(const e of EV){if(t>=e.t+(e.k==='f'?SHIFT:BACK))v=e.k==='f'?e.v+1:0;else if(t>=e.t){act=e;break;}else break;}
  press('bshift',t,EV.find(e=>e.k==='f'&&t<e.t+0.3&&t>e.t-0.2)?.t??-9);
  press('bsrc',t,EV[3].t);
  const lv=act?(act.k==='f'?(t-act.t>SHIFT*0.5?act.v+1:act.v):(t-act.t>BACK*0.5?0:act.v)):v;
  document.getElementById('blvl').textContent=`levels ${lv+1}–${lv+2} of 5`;
  document.getElementById('bshift').style.opacity=lv>=3?.35:1;
  document.getElementById('bsrc').style.opacity=lv===0?.35:1;
  if(!act){layoutStatic(v);trailAt(v*COLW,v);drawLinks2(v,1);return;}
  const tau=t-act.t,a=act.v;
  if(act.k==='f'){
    cols.forEach((items,i)=>{const s=i-a;items.forEach((it,k)=>{
      if(s===0){const p=clamp((tau-0.03*k)/0.22),e=inC(p);setItem(it,-30*e,Math.max(0,1-p*1.4),-80*e);}
      else if(s===1){const e=expo(clamp((tau-0.17-0.035*k)/0.55));setItem(it,COLW*(1-e),1);}
      else if(s===2){const p=clamp((tau-0.27-0.05*k)/0.55),e=expo(p);setItem(it,COLW+170*(1-e),Math.min(1,p*1.7));}
      else setItem(it,0,0);});});
    const pt=expo(clamp((tau-0.04)/0.75));trailBlend((a+pt)*COLW,a,a+1,pt);
    if(tau<0.12)drawLinks2(a,1-tau/0.12);else if(tau>0.74){layoutStatic(a+1);drawLinks2(a+1,clamp((tau-0.74)/0.11));
      cols.forEach((items,i)=>{const s=i-a;items.forEach((it,k)=>{if(s===2){const p=clamp((tau-0.27-0.05*k)/0.55),e=expo(p);setItem(it,COLW+170*(1-e),Math.min(1,p*1.7));}});});}
    else drawLinks2(a,0);
  }else{
    cols.forEach((items,i)=>{const s=i-a;const n=i;items.forEach((it,k)=>{
      if(s===0||s===1){const e=inC(clamp((tau-0.03*k-0.03*s)/0.28));setItem(it,s*COLW+90*e,1-e);}
      else if(n===0||n===1){const p=clamp((tau-0.22-0.045*k-0.07*n)/0.6),e=expo(p);setItem(it,n*COLW-170*(1-e),Math.min(1,p*1.7));}
      else setItem(it,0,0);});});
    const pt=expo(clamp((tau-0.1)/0.75));trailBlend(a*COLW*(1-pt),a,0,pt);
    if(tau<0.1)drawLinks2(a,1-tau/0.1);else if(tau>0.8){drawLinks2(0,clamp((tau-0.8)/0.15));}else drawLinks2(0,0);
  }
};
seek(0);
