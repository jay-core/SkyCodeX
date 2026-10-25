/* ---------- final preview: walkthrough, then a turnstile tour of every view ---------- */
const walkSeek=window.seek;
const SC=[['../../docs/concepts/final/b02-atlas.png','atlas — the whole codebase as a map'],['../../docs/concepts/final/b03-book.png','book mode — read a project start to finish'],
  ['../../docs/concepts/final/b06-board.png','investigation board — paste a crash, get its stack'],['../../docs/concepts/terminal-press/t1-terminal.png','terminal — every command a block'],
  ['../../docs/concepts/terminal-press/t2-build.png','build — every compile, calm and clear'],['../../docs/concepts/terminal-press/t3-memory.png','memory — RAM and flash budgets, largest first'],
  ['../../docs/concepts/terminal-press/t4-misra.png','misra — precise findings, long before certification']];
const T0=18.6,D=3.2,TEND=T0+SC.length*D;
W.insertAdjacentHTML('beforeend',`<div id="mont" style="position:absolute;inset:0;z-index:40;pointer-events:none">${SC.map(([src],i)=>`<img class="mi" src="${src}" style="position:absolute;inset:0;width:100%;height:100%;opacity:0">`).join('')}
  <div id="endc" style="position:absolute;inset:0;background:#171817;display:grid;place-content:center;text-align:center;opacity:0"><div style="font:300 84px var(--ui);color:#a3a8a0;letter-spacing:-.02em">lithograph</div><div style="font:300 18px var(--ui);color:#5f665f;margin-top:6px">portable · offline · C and C++</div></div>
  <div id="mgrad" style="position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(rgba(23,24,23,0),rgba(23,24,23,.94));opacity:0"></div></div>`);
document.getElementById('cap').style.zIndex=60;
const MI=[...document.querySelectorAll('.mi')],ENDC=document.getElementById('endc');
function turn(el,deg,op,scale=1){el.style.transformOrigin='left center';el.style.transform=`perspective(1600px) rotateY(${deg}deg) scale(${scale})`;el.style.opacity=op;}
window.TOTAL=TEND+2.8;
window.seek=function(t){
  if(t<T0){walkSeek(t);MI.forEach(m=>m.style.opacity=0);ENDC.style.opacity=0;document.getElementById('mgrad').style.opacity=0;return;}
  walkSeek(T0-0.01);
  const cap=document.getElementById('cap'),grad=document.getElementById('mgrad');
  const k=Math.min(SC.length,Math.floor((t-T0)/D)),tau=t-T0-k*D;
  // outgoing: editor for the first scene, previous image otherwise
  const outE=inC(clamp(tau/0.34)),inE=expo(clamp((tau-0.16)/0.6));
  if(k===0){pageT(HDR,-70*outE,1);pageT(BODY,-70*inC(clamp((tau-0.04)/0.34)),1);}
  MI.forEach((m,i)=>{
    if(i===k){turn(m,70*(1-inE),Math.min(1,inE*1.5),1+0.025*clamp(tau/D));}
    else if(i===k-1){turn(m,-70*outE,1-outE,1.025);}
    else m.style.opacity=0;});
  if(k===SC.length){turn(ENDC,70*(1-inE),Math.min(1,inE*1.5));}else ENDC.style.opacity=0;
  const txt=k<SC.length?SC[k][1]:'';cap.textContent=txt;
  const f=k<SC.length?Math.min(clamp((tau-0.35)/0.35),clamp((D-tau)/0.3)):0;
  cap.style.opacity=f;cap.style.transform=`translateX(${(1-expo(clamp((tau-0.35)/0.6)))*40}px)`;grad.style.opacity=k<SC.length?1:0;
};
seek(0);
