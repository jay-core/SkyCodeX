/* ---------- walkthrough: wraps the shift page with intro, settings and captions ---------- */
const shiftSeek=window.seek;
const W=document.querySelector('.win'),HDR=W.querySelector('.hdr'),BODY=HDR.nextElementSibling;
const GEAR=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3.4"/>${[...Array(8)].map((_,i)=>`<line x1="12" y1="2.6" x2="12" y2="6.2" transform="rotate(${i*45} 12 12)" stroke-width="3" stroke-linecap="butt"/>`).join('')}<circle cx="12" cy="12" r="6.6"/></svg>`;
HDR.querySelector('.right').insertAdjacentHTML('beforeend',`<span id="gear" style="display:grid;place-items:center;width:24px;height:24px;border:1px solid #3a3f3a;color:#7b8279;margin:-5px 0 0 4px">${GEAR}</span>`);
document.getElementById('pva').insertAdjacentHTML('beforeend',`<div id="empty" style="position:absolute;inset:0 0 46px 0;display:grid;place-items:center;font:300 15px var(--ui);color:#3a3f3a">outside any function — nothing to preview</div>`);
const slider=(id,lab,val,lo,hi)=>`<div style="margin:0 0 26px"><div style="display:flex;font:300 15px var(--ui);color:#8b9189"><span>${lab}</span><span id="${id}v" style="margin-left:auto;color:#a3a8a0">${val}</span></div>
  <div style="position:relative;height:26px;margin-top:6px"><div style="position:absolute;top:12px;left:0;right:0;height:2px;background:#2c2f2c"></div><div id="${id}f" style="position:absolute;top:12px;left:0;height:2px;background:#739696"></div><div id="${id}t" style="position:absolute;top:2px;width:10px;height:22px;background:#a3a8a0;margin-left:-5px"></div></div>
  <div style="display:flex;font:300 11.5px var(--ui);color:#3a3f3a"><span>${lo}</span><span style="margin-left:auto">${hi}</span></div></div>`;
const toggle=(id,lab,sub)=>`<div style="display:flex;align-items:center;margin:0 0 22px"><div><div style="font:300 15px var(--ui);color:#8b9189">${lab}</div><div style="font:300 12px var(--ui);color:#454b45">${sub}</div></div>
  <div id="${id}" style="margin-left:auto;position:relative;width:52px;height:22px;border:2px solid #4f564f"><div class="tf" style="position:absolute;left:2px;top:2px;bottom:2px;width:0;background:#4e6a6a"></div><div class="tk" style="position:absolute;top:-2px;width:12px;height:22px;background:#a3a8a0;left:-2px"></div></div></div>`;
const pick=(lab,val)=>`<div style="margin:0 0 22px"><div style="font:300 15px var(--ui);color:#8b9189;margin-bottom:6px">${lab}</div><div style="border:2px solid #3a3f3a;padding:6px 10px;font:300 16px var(--ui);color:#a3a8a0">${val}</div></div>`;
W.insertAdjacentHTML('beforeend',`<div id="set" style="position:absolute;inset:0;background:#171817;z-index:20;padding:26px 44px;opacity:0;pointer-events:none">
  <div class="si" style="font:600 11px var(--ui);letter-spacing:.14em;color:#4f564f">LITHOGRAPH</div>
  <div class="si" style="display:flex;align-items:baseline;gap:30px;margin:4px 0 30px;white-space:nowrap"><span style="font:300 52px var(--ui);color:#a3a8a0;letter-spacing:-.02em">appearance</span>${['editor','preview','clangd','keys','files'].map(x=>`<span style="font:300 52px var(--ui);color:#2b2e2b;letter-spacing:-.02em">${x}</span>`).join('')}</div>
  <div style="display:grid;grid-template-columns:330px 330px 1fr;gap:56px">
    <div class="si">${pick('code font','ARX F1')}${slider('fs','code size','12.5','8','24')}${slider('lh','line height','1.6','1.2','2.2')}${pick('interface font','Selawik')}</div>
    <div class="si">${pick('theme','charcoal')}${slider('ct','contrast','6.9 : 1','soft','crisp')}${toggle('ew','evening warmth','warmer, dimmer after sunset')}${toggle('fd','focus dimming','fade code outside the function')}</div>
    <div class="si"><div style="font:300 15px var(--ui);color:#4f564f;margin-bottom:8px">preview</div><div id="spv" style="background:#151615;padding:6px 0">${code(MAIN.split('\n').slice(9,19).join('\n').replace(/«[^|»]*\|([^»]*)»/g,'$1'),{start:39,params:['req'],active:45})}</div>
      <div style="font:300 12.5px var(--ui);color:#3f453f;margin-top:14px">every change here is written to <span style="color:#7b8279">data/settings.toml</span><span id="saved" style="margin-left:10px;color:#5f8a6a;opacity:0">saved</span></div></div>
  </div></div>
  <div id="cap" style="position:absolute;left:40px;bottom:34px;z-index:30;font:300 17px var(--ui);color:#7b8279"></div>`);
const SI=[...document.querySelectorAll('#set .si')];
const curEl=document.querySelector('#codep .cur'),ln=n=>document.querySelector(`#codep .ln[data-n="${n}"]`);
function cursorAt(n){ln(37).classList.toggle('act',n===37);ln(45).classList.toggle('act',n===45);ln(n).querySelector('.t').appendChild(curEl);}
function setSlider(id,p,txt){document.getElementById(id+'t').style.left=(p*100)+'%';document.getElementById(id+'f').style.width=(p*100)+'%';document.getElementById(id+'v').textContent=txt;}
function setToggle(id,p){const e=document.getElementById(id);e.querySelector('.tk').style.left=(-2+p*40)+'px';e.querySelector('.tf').style.width=(p*44)+'px';}
function codeSize(px){document.querySelectorAll('#codep .code').forEach(c=>{c.style.fontSize=px+'px';c.style.lineHeight=(px*1.6)+'px';});}
const CAPS=[[0,3,'move into a function — its calls appear'],[3,10.6,'shift preview — a full level per press'],[10.6,16.4,'settings — one square, every option'],[16.4,99,'applied live · saved to data/settings.toml']];
function caption(t){const c=CAPS.find(([a,b])=>t>=a&&t<b);const el=document.getElementById('cap');el.textContent=c[2];const f=Math.min(clamp((t-c[0])/0.35),clamp((c[1]-t)/0.35));el.style.opacity=f;el.style.transform=`translateX(${(1-expo(clamp((t-c[0])/0.6)))*40}px)`;}
function pageT(el,e,dir){el.style.transformOrigin='left center';el.style.transform=`perspective(1400px) rotateY(${dir*e}deg)`;el.style.opacity=1-Math.min(1,Math.abs(e)/60);}
window.TOTAL=18.6;
window.seek=function(t){
  caption(t);
  const set=document.getElementById('set');
  const fsP=t<12.3?0:expo(clamp((t-12.3)/1.0))*0.991, fs=12.5+1.5*Math.min(1,fsP/0.991);
  setSlider('fs',(fs-8)/16,fs.toFixed(1));setSlider('lh',.4/1,'1.6');
  const ctP=expo(clamp((t-14.3)/0.8));const ctv=6.9-0.7*ctP;setSlider('ct',0.62-0.12*ctP,ctv.toFixed(1)+' : 1');
  setToggle('ew',expo(clamp((t-13.7)/0.3)));setToggle('fd',1);
  document.querySelectorAll('#spv .code').forEach(c=>{c.style.fontSize=fs+'px';c.style.lineHeight=(fs*1.6)+'px';});
  document.getElementById('saved').style.opacity=(t>13.4&&t<14.0)||(t>14.0&&t<14.6)||(t>15.1&&t<15.6)?1:0;
  const gp=t>10.62&&t<10.95;const g=document.getElementById('gear');g.style.background=gp?'#2a2d2a':'';g.style.color=gp?'#c9b98f':'#7b8279';g.style.borderColor=gp?'#7d6f50':'#3a3f3a';
  codeSize(t>=15.6?14:12.5);
  if(t<3){
    shiftSeek(0.4);cursorAt(t<1.2?37:45);
    const items=cols.flat();
    if(t<1.2){cols.forEach(c=>c.forEach(it=>setItem(it,0,0)));trs.forEach(x=>x.style.opacity=0);document.getElementById('lk').style.opacity=0;document.getElementById('empty').style.opacity=1;}
    else{const tau=t-1.2;document.getElementById('empty').style.opacity=1-clamp(tau/0.15);
      [0,1].forEach(i=>cols[i].forEach((it,k)=>{const p=clamp((tau-0.06*k-0.12*i)/0.6),e=expo(p);setItem(it,i*COLW+170*(1-e),Math.min(1,p*1.7));}));
      trs.forEach(x=>x.style.opacity=clamp(tau/0.4));
      const la=clamp((tau-0.75)/0.2);if(la>0){drawLinks2(0,la);}else document.getElementById('lk').style.opacity=0;}
    pageT(BODY,0,1);pageT(HDR,0,1);set.style.opacity=0;return;}
  document.getElementById('empty').style.opacity=0;trs.forEach(x=>x.style.opacity=1);cursorAt(45);
  if(t<10.6){shiftSeek(t-2.6);pageT(BODY,0,1);pageT(HDR,0,1);set.style.opacity=0;return;}
  shiftSeek(8.0);
  if(t<11.0){pageT(BODY,0,1);pageT(HDR,0,1);set.style.opacity=0;return;}
  if(t<15.6){ // editor out, settings in
    const eo=inC(clamp((t-11.0)/0.28));pageT(HDR,-70*eo,1);pageT(BODY,-70*inC(clamp((t-11.04)/0.28)),1);
    if(eo>0)document.getElementById('lk').style.opacity=0;
    set.style.opacity=1;SI.forEach((s,k)=>{const p=clamp((t-11.22-0.06*k)/0.55),e=expo(p);s.style.transformOrigin='left center';s.style.transform=`perspective(1400px) rotateY(${70*(1-e)}deg) translateX(${60*(1-e)}px)`;s.style.opacity=Math.min(1,p*1.6);});
    return;}
  // settings out, editor back in
  SI.forEach((s,k)=>{const p=clamp((t-15.6-0.04*k)/0.26),e=inC(p);s.style.transform=`perspective(1400px) rotateY(${-75*e}deg)`;s.style.opacity=1-Math.min(1,p*1.3);});
  set.style.opacity=t>16.0?0:1;
  const bi=p=>expo(clamp(p));pageT(HDR,70*(1-bi((t-15.85)/0.55)),1);pageT(BODY,70*(1-bi((t-15.92)/0.55)),1);
  const la=clamp((t-16.45)/0.2);drawLinks2(0,la);
};
seek(0);
