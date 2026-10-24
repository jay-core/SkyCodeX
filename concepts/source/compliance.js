/* ---------- flow · do-178c · aadl · stills — driven by seek(t) ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const clamp=x=>Math.max(0,Math.min(1,x)),expo=p=>p>=1?1:1-Math.pow(2,-10*p),inC=p=>p*p*p,lerp=(a,b,p)=>a+(b-a)*p;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const scene=(id,hdr,right,body)=>`<div id="${id}" class="scn" style="position:absolute;inset:0;background:#171817;display:flex;flex-direction:column"><div class="hdr">${hdr}<span class="right" id="${id}-st">${right}</span></div><div style="flex:1;position:relative;min-height:0">${body}</div></div>`;

/* ---- flow data ---- */
const n=(name,c=[],o={})=>({name,c,...o}),L=(lab,c)=>({loop:lab,c}),P='#ad9b6f';
const LANES=[{title:'main · tinyhttp',x:40,y:92,colW:188,root:n('main',[n('Config::load',[L('×16 · known keys',[n('read_env')])]),n('Server::start',[L('until !running_',[n('Socket::accept'),n('Server::handle',[n('parse_headers',[L('×n · header lines',[n('split'),n('trim')])]),n('Response::bad_request',[],{cond:'if headers.empty()'}),n('route',[L('×n · routes',[n('match_path')])]),n('handler',[],{ind:'⇢ 3 targets'}),n('send_response',[L('until all bytes sent',[n('write_all')])])])])]),n('Server::stop')])},
  {title:'thread · metrics flusher',x:1000,y:92,colW:120,root:n('Metrics::run',[L('every 1 s · until stop',[n('Metrics::flush',[n('write_file')]),n('sleep_for')])])},
  {title:'signal · SIGINT',x:1000,y:300,colW:120,root:n('on_sigint',[n('Server::stop',[],{ref:true})])}];
const RH=26,nodes=[],loops=[],edges=[];
function lay(lane){let row=0;const walk=(nd,d,parent)=>{
  if(nd.loop){const y0=lane.y+row*RH;const me={kind:'loop',lab:nd.loop,x:lane.x+d*lane.colW,y:y0,d,parent};nodes.push(me);row++;if(parent)edges.push([parent,me]);const first=nodes.length;
    nd.c.forEach(ch=>walk(ch,d,null));const kids=nodes.slice(first).filter(k=>k.d===d);loops.push({x:me.x-12,y0:y0+4,y1:kids.length?kids[kids.length-1].y:y0,me});kids.forEach(k=>k.inLoop=me);return me;}
  const me={kind:'fn',name:nd.name,x:lane.x+d*lane.colW,y:lane.y+row*RH,d,cond:nd.cond,ind:nd.ind,ref:nd.ref,root:d===0,path:['main','Server::start','Server::handle','parse_headers'].includes(nd.name)&&lane.title.startsWith('main')};
  nodes.push(me);row++;if(parent)edges.push([parent,me,nd.cond]);nd.c.forEach(ch=>walk(ch,d+1,me));return me;};
  walk(lane.root,0,null);}
LANES.forEach(lay);
const UNREACHED=[['tools/bench.cpp','belongs to target bench'],['legacy/cgi.cpp','no callers'],['Router::dump','only called from tests'],['plugins.cpp · load_plugin','called through a pointer we couldn’t resolve']];
const flowBody=`${LANES.map(l=>`<div style="position:absolute;left:${l.x}px;top:${l.y-30}px;font:300 13px var(--ui);color:#454b45">${l.title}</div>`).join('')}
  ${nodes.map((d,i)=>d.kind==='loop'?`<div class="fn lp" data-i="${i}" style="position:absolute;left:${d.x}px;top:${d.y-10}px;font:300 13px var(--ui);color:#5f8a8a;white-space:nowrap"><span class="lpi">↻</span> <span class="lpl">${d.lab}</span></div>`
   :`<div class="fn" data-i="${i}" style="position:absolute;left:${d.x}px;top:${d.y-10}px;white-space:nowrap;font:${d.root?'300 17px var(--ui)':'13px var(--mono)'};line-height:20px"><span class="nm">${d.ref?'→ ':''}${d.name}${d.ref?' ↑':''}</span>${d.cond?`<span style="font:300 12px var(--ui);color:#5f665f;margin-left:10px">${d.cond}</span>`:''}${d.ind?`<span style="font:300 12px var(--ui);color:#7a6f8a;margin-left:10px">${d.ind}</span>`:''}</div>`).join('')}
  <div id="shelf" style="position:absolute;left:1000px;top:420px;width:400px"><div style="font:300 13px var(--ui);color:#454b45;margin-bottom:10px">not reached from any entry point</div>
   ${UNREACHED.map(([f,why])=>`<div class="ur" style="margin-bottom:9px"><div style="font:12.5px var(--mono);color:#7b8279">${f}</div><div style="font:300 12px var(--ui);color:#454b45">${why}</div></div>`).join('')}</div>
  <div id="here" style="position:absolute;left:1000px;top:640px;font:300 13px/1.6 var(--ui);color:#ad9b6f;opacity:0">you are here<br><span style="font:12.5px var(--mono);color:#c9b98f">main › Server::start › Server::handle › parse_headers</span></div>
  <svg id="fsvg" width="1440" height="844" style="position:absolute;left:0;top:0;overflow:visible"></svg>`;

/* ---- do-178c ---- */
const COV=R`bool Router::allowed(const Request& r, const Rule& rule) {
    if («id:dec|rule.enabled && (r.is_admin || rule.public_access)»)
        return true;
    if (r.method == Method::Options)
        return true;
    return false;
}`;
const covMap={30:1,31:1,32:1,33:1,34:0,35:1,36:1};
const covGut={};Object.entries(covMap).forEach(([l,c])=>covGut[l]=`<i class="cv" style="position:absolute;left:4px;top:3px;width:4px;height:14px;background:${c?'#5f8a6a':'#a8685e'}"></i>`);
const mc=[['T1','1','1','–','true','router_test.cpp:12'],['T2','0','–','–','false','router_test.cpp:20'],['T3','1','0','0','false','router_test.cpp:27'],['T4','1','0','1','true','missing']];
const doBody=`<div style="position:absolute;left:30px;top:6px;display:flex;gap:22px;font:300 15px var(--ui)"><span style="color:#a3a8a0">coverage</span><span style="color:#3a3f3a">trace</span><span style="color:#3a3f3a">coupling</span></div>
 <div style="position:absolute;left:30px;top:44px;width:760px">${code(COV,{start:30,active:31,params:['r','rule'],gut:covGut})}
  <div style="font:300 13px var(--ui);color:#4f564f;margin:18px 0 8px">MC/DC · line 31 · conditions A = rule.enabled, B = r.is_admin, C = rule.public_access</div>
  <div style="display:grid;grid-template-columns:50px 44px 44px 44px 70px 1fr;font:13px/1.9 var(--mono);color:#8b9189">${['test','A','B','C','result','from'].map(h=>`<span style="font:300 12px var(--ui);color:#454b45">${h}</span>`).join('')}
   ${mc.map((r,i)=>r.map((c,j)=>`<span class="mrow r${i}" style="${i===3?'color:#c9a26a;':''}${j===5?'font:300 12.5px var(--ui);'+(i===3?'':'color:#5f7f7f;'):''}">${c}</span>`).join('')).join('')}</div>
  <div class="mrow r4" style="margin-top:10px;font:300 14px/1.6 var(--ui);color:#c9a26a;background:#1f1d17;padding:10px 14px">C has no independence pair yet. Add a test with <span style="font-family:var(--mono)">A = 1, B = 0, C = 1</span> → expected <span style="font-family:var(--mono)">true</span>; with T3 it shows C alone changes the outcome.</div></div>
 <div style="position:absolute;left:830px;top:44px;right:30px">
  <div style="font:300 13px var(--ui);color:#4f564f;margin-bottom:8px">router.cpp · coverage</div>
  ${[['statement','92 %','#7f9e82'],['decision','88 %','#7f9e82'],['MC/DC','2 of 3 conditions','#c9a26a']].map(([a,b,c])=>`<div class="tr0" style="display:flex;font:300 15px/2 var(--ui)"><span style="color:#8b9189">${a}</span><span style="margin-left:auto;color:${c}">${b}</span></div>`).join('')}
  <div style="font:300 12px var(--ui);color:#3f453f;margin:2px 0 22px">level A needs all three at 100 %</div>
  <div style="font:300 13px var(--ui);color:#4f564f;margin-bottom:8px">traceability</div>
  ${[['HLR-104','reject non-admin writes','Router::allowed :31','3 tests','#7f9e82'],['HLR-105','allow CORS preflight','Router::allowed :33','no test','#c9a26a'],['—','no requirement','Router::dump','untraced','#a8685e']].map(([id,d,f,tst,c])=>`<div class="tr1" style="padding:8px 0;border-top:1px solid #222422"><div style="display:flex;font:300 14px var(--ui)"><span style="color:#a3a8a0;width:84px">${id}</span><span style="color:#7b8279">${d}</span><span style="margin-left:auto;color:${c}">${tst}</span></div><div style="font:12px var(--mono);color:#5f7f7f;margin-left:84px">${f}</div></div>`).join('')}</div>`;

/* ---- aadl ---- */
const AADL=`package tinyhttp_arch
public
  process tinyhttp
    features
      requests : in event data port Request;
  end tinyhttp;

  process implementation tinyhttp.impl
    subcomponents
      server  : thread server_loop;
      metrics : thread metrics_flush;
      store   : data metrics_store;
    connections
      c1 : port requests -> server.req;
      c2 : data access store -> metrics.store;
  end tinyhttp.impl;

  thread metrics_flush
    properties
      Dispatch_Protocol => Periodic;
      Period => 1000 ms;
      Source_Name => "Metrics::flush";
  end metrics_flush;
end tinyhttp_arch;`;
const AK=new Set('package public process end features in out event data port implementation subcomponents connections thread properties access'.split(' '));
const hlA=s=>s.replace(/"[^"]*"|\b\d+\b|[A-Za-z_][\w.]*|=>|->|[^\w"]+/g,t=>t.startsWith('"')?sp('s',t):/^\d/.test(t)?sp('n',t):AK.has(t)?sp('k',t):/^[A-Z]\w*$/.test(t)&&t.includes('_')?sp('y',t):(t==='=>'||t==='->')?sp('cm',t):esc(t));
const aadlText=`<div style="font:12.5px/20px var(--mono);color:#9ea39b;white-space:pre">${AADL.split('\n').map((l,i)=>`<div class="al" style="display:flex"><span style="width:40px;text-align:right;padding-right:14px;color:#373b37">${i+1}</span><span>${hlA(l)||' '}</span></div>`).join('')}</div>`;
const box=(id,x,y,w,h,title,sub,link,o={})=>`<div id="${id}" class="ab" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:${o.data?'1px dashed':'1.5px solid'} ${o.col||'#4f564f'};padding:8px 10px"><div style="font:300 15px var(--ui);color:#a3a8a0">${title}</div><div style="font:300 12px var(--ui);color:#5f665f">${sub}</div><div style="font:11.5px var(--mono);color:#5f7f7f;margin-top:4px">${link}</div></div>`;
const aadlBody=`<div style="position:absolute;left:30px;top:8px;width:600px">${aadlText}</div>
 <div style="position:absolute;left:660px;top:8px;right:30px;bottom:0">
  <div id="proc" class="ab" style="position:absolute;left:30px;top:20px;width:690px;height:470px;border:1.5px solid #3a3f3a"><div style="font:300 18px var(--ui);color:#8b9189;padding:8px 12px">process tinyhttp.impl</div></div>
  <div class="ab" id="portp" style="position:absolute;left:20px;top:120px;width:0;height:0;border-left:14px solid #739696;border-top:9px solid transparent;border-bottom:9px solid transparent"></div><div class="ab" id="portl" style="position:absolute;left:-60px;top:146px;font:300 12.5px var(--ui);color:#739696">requests</div>
  ${box('th1',120,90,230,86,'thread server_loop','sporadic · per request','↔ Server::start  server.cpp:30')}
  ${box('th2',420,90,250,86,'thread metrics_flush','periodic · 1000 ms','↔ Metrics::flush  metrics.cpp:44')}
  ${box('dt1',270,290,220,74,'data metrics_store','shared · guarded by mutex','↔ Metrics::counters_',{data:true})}
  <svg id="asvg" width="760" height="520" style="position:absolute;left:0;top:0;overflow:visible"></svg>
  <div id="warn" style="position:absolute;left:30px;top:520px;width:690px;background:#1f1d17;padding:12px 16px;font:300 14px/1.6 var(--ui);color:#c9a26a">Model and code disagree: <span style="font-family:var(--mono)">Period => 1000 ms</span>, but <span style="font-family:var(--mono)">Metrics::run</span> sleeps <span style="font-family:var(--mono)">2 s</span> (metrics.cpp:51). Update the model or the code.</div>
  <div id="draft" style="position:absolute;left:30px;top:640px;font:300 12.5px var(--ui);color:#3f453f">draft generated from the code · review before use · open in OSATE ›</div></div>`;

const stills=[['../terminal-press/t3-memory.png'],['../terminal-press/t4-misra.png']];
document.getElementById('root').innerHTML=`<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none;background:#171817">
 ${scene('s1',PV('flow',['atlas','book','server.cpp']),'scanning…',flowBody)}
 ${scene('s2',PV('do-178c',['misra','memory','flow']),'router.cpp · tests from ctest run #8',doBody)}
 ${scene('s3',PV('aadl',['do-178c','misra','flow']),'draft from code · review needed',aadlBody)}
 ${stills.map(([s],i)=>`<img class="scn" id="s${4+i}" src="${s}" style="position:absolute;inset:0;width:100%;height:100%">`).join('')}
 <div id="s6" class="scn" style="position:absolute;inset:0;background:#171817;display:grid;place-content:center;text-align:center"><div style="font:300 84px var(--ui);color:#a3a8a0;letter-spacing:-.02em">lithograph</div><div style="font:300 18px var(--ui);color:#5f665f;margin-top:6px">portable · offline · C and C++</div></div>
 <div id="opening" style="position:absolute;inset:0;background:#171817;display:grid;place-content:center;font:300 40px var(--ui);color:#8b9189">opening tinyhttp/</div>
 <div id="grad" style="position:absolute;left:0;right:0;bottom:0;height:140px;background:linear-gradient(rgba(23,24,23,0),rgba(23,24,23,.94));z-index:50"></div>
 <div id="cap" style="position:absolute;left:40px;bottom:30px;max-width:900px;z-index:60;font:300 17px var(--ui);color:#7b8279"></div></div>`;

/* ---- precompute flow geometry ---- */
const FN=$$('#s1 .fn'),W0=$('#fsvg').getBoundingClientRect();
nodes.forEach((d,i)=>{const r=FN[i].getBoundingClientRect();d.r=r.right-W0.left;d.l=r.left-W0.left;d.cy=r.top+r.height/2-W0.top;});
const order=nodes.map((d,i)=>i);
const edgeD=edges.map(([p,c])=>{const x1=p.l+Math.min(p.r-p.l,(p.root?60:0)+ (p.r-p.l))+8,y1=p.cy,x2=c.l-8,y2=c.cy;const sx=p.l+12,sy=p.cy+9;
  return `M${sx} ${sy} L${sx} ${y2-6} Q${sx} ${y2} ${sx+6} ${y2} L${x2} ${y2}`;});
const loopD=loops.map(lp=>{const k=nodes.filter(d=>d.inLoop===lp.me);const yb=k.length?k[k.length-1].cy:lp.me.cy;return `M${lp.x+6} ${lp.me.cy+8} L${lp.x} ${lp.me.cy+8} L${lp.x} ${yb+6} L${lp.x+6} ${yb+6}`;});

function flowAt(t){
  const st=$('#s1-st');const idx=Math.round(lerp(0,42,clamp((t-2.0)/3.0)));
  st.textContent=t<2?'scanning…':t<5?`indexing ${idx} / 42 files`:t<6.4?'loop counts…':'ready · 3 entry points · 4 unreached';
  const here=clamp((t-8.2)/0.5);
  let svg='';
  nodes.forEach((d,i)=>{const el=FN[i];const rough=clamp((t-0.7-i*0.03)/0.4),prec=clamp((t-2.0-i*0.1)/0.45);
    el.style.opacity=rough*(0.35+0.65*prec)*(here&&!d.path&&d.kind==='fn'?1-0.45*here:1);
    const nm=el.querySelector('.nm');if(nm){const base=d.root?'#a3a8a0':'#ad9b6f';nm.style.color=d.path&&here?'#e2cf9c':prec>0.5?base:'#5f665f';}
    if(d.kind==='loop'){const lab=el.querySelector('.lpl');lab.style.opacity=t<5.0+i*0.02?0.25:clamp((t-5.0-i*0.02)/0.3)*0.75+0.25;if(t<5.0)lab.textContent='…';else lab.textContent=d.lab;}
    el.style.transform=`translateX(${(1-expo(rough))*12}px)`;});
  edges.forEach(([p,c,cond],k)=>{const ci=nodes.indexOf(c);const rough=clamp((t-0.75-ci*0.03)/0.4),prec=clamp((t-2.05-ci*0.1)/0.45);const onPath=p.path&&c.path&&here;
    svg+=`<path d="${edgeD[k]}" fill="none" stroke="${onPath?'#c9b98f':prec>0.5?'#4a524a':'#343834'}" stroke-width="${onPath?1.6:1.1}" stroke-dasharray="${cond||prec<0.5?'3 4':'0'}" opacity="${rough}"/>`;});
  loops.forEach((lp,k)=>{const o=clamp((t-4.2-k*0.12)/0.4);svg+=`<path d="${loopD[k]}" fill="none" stroke="#4e7070" stroke-width="1.3" opacity="${o}"/>`;});
  $('#fsvg').innerHTML=svg;
  $$('#shelf, #shelf .ur').forEach((e,k)=>{const p=clamp((t-6.5-k*0.12)/0.5);e.style.opacity=k?p:Math.min(1,p*2);e.style.transform=`translateX(${(1-expo(p))*40}px)`;});
  $('#here').style.opacity=here;
}
function doAt(t){const u=t-12;
  $$('#s2 .cv').forEach((e,k)=>{e.style.opacity=clamp((u-0.9-k*0.09)/0.25);});
  for(let i=0;i<5;i++)$$(`#s2 .r${i}`).forEach(e=>{const p=clamp((u-2.0-i*0.35)/0.4);e.style.opacity=p;});
  const pulse=u>4.0?0.6+0.4*Math.cos((u-4.0)*5):1;$$('#s2 .r3').forEach(e=>e.style.opacity=clamp((u-3.05)/0.4)*pulse);
  $$('#s2 .tr0').forEach((e,k)=>e.style.opacity=clamp((u-1.2-k*0.15)/0.4));
  $$('#s2 .tr1').forEach((e,k)=>{const p=clamp((u-4.6-k*0.25)/0.5);e.style.opacity=p;e.style.transform=`translateX(${(1-expo(p))*40}px)`;});}
function aadlAt(t){const u=t-19.5;
  $$('#s3 .al').forEach((e,k)=>e.style.opacity=clamp((u-0.6-k*0.06)/0.3));
  const bx=[['proc',1.4],['portp',2.0],['portl',2.0],['th1',2.2],['th2',2.45],['dt1',2.7]];
  bx.forEach(([id,s])=>{const p=clamp((u-s)/0.45),e=$('#'+id);e.style.opacity=p;e.style.transform=`scale(${0.97+0.03*expo(p)})`;});
  const A=$('#s3').getBoundingClientRect(),sv=$('#asvg').getBoundingClientRect();const R=id=>{const r=$('#'+id).getBoundingClientRect();return {l:r.left-sv.left,r:r.right-sv.left,t:r.top-sv.top,b:r.bottom-sv.top,cx:(r.left+r.right)/2-sv.left,cy:(r.top+r.bottom)/2-sv.top};};
  const p1=clamp((u-3.1)/0.6),p2=clamp((u-3.5)/0.6),p3=clamp((u-3.8)/0.6);const th1=R('th1'),th2=R('th2'),dt=R('dt1'),pp=R('portp');
  const line=(d,len,p,col,dash)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="${dash?'5 4':len}" stroke-dashoffset="${dash?0:len*(1-expo(p))}" opacity="${dash?p:1}"/>`;
  $('#asvg').innerHTML=line(`M${pp.r} ${pp.cy} L${th1.l} ${pp.cy}`,140,p1,'#739696')+line(`M${dt.cx-40} ${dt.t} L${th1.cx} ${th1.b}`,200,p2,'#7f9e82',true)+line(`M${dt.cx+40} ${dt.t} L${th2.cx} ${th2.b}`,200,p3,'#7f9e82',true)
    +`<text x="${(pp.r+th1.l)/2-10}" y="${pp.cy-8}" fill="#739696" font-size="12" font-weight="300" font-family="Selawik" opacity="${p1}">c1</text>`;
  const w=clamp((u-4.6)/0.5);$('#warn').style.opacity=w;$('#warn').style.transform=`translateX(${(1-expo(w))*40}px)`;$('#draft').style.opacity=clamp((u-5.2)/0.4);
  const t2=clamp((u-4.6)/0.4);$('#th2').style.borderColor=t2>0?`rgba(201,162,106,${t2})`:'#4f564f';}

const SCN=[['s1',0,12],['s2',12,19.5],['s3',19.5,27],['s4',27,30],['s5',30,33],['s6',33,36]];
const CAPS=[[0.6,4.2,'flow — opens with the folder: a rough tree in a second, then it firms up as indexing runs'],[4.2,8.1,'loops show how often they run — ×16, ×n, until a condition · conditions dashed, indirect calls marked'],[8.1,12,'you are here: the path from main to your cursor · code no entry point reaches, listed with the likely reason'],
  [12,15.8,'do-178c — statement, decision and MC/DC coverage, right in the code'],[15.8,19.5,'a missing MC/DC pair comes with the test that would close it · requirements traced to code and tests'],
  [19.5,23.2,'aadl — a draft architecture model generated from the code, linked back to it'],[23.2,27,'model and code are checked against each other'],
  [27,30,'memory — RAM and flash budgets, largest first, with the cause of any overflow'],[30,33,'misra — precise findings, long before certification'],[33,40,'']];
window.TOTAL=36;
function turn(el,deg,op){el.style.transformOrigin='left center';el.style.transform=`perspective(1600px) rotateY(${deg}deg)`;el.style.opacity=op;}
window.seek=function(t){
  const op=$('#opening');op.style.opacity=t<0.4?1:1-clamp((t-0.4)/0.3);
  SCN.forEach(([id,a,b],k)=>{const el=$('#'+id);
    if(t>=a&&t<b){const p=k?clamp((t-a-0.12)/0.6):1;turn(el,70*(1-expo(p)),Math.min(1,p*1.5));el.style.zIndex=2;}
    else if(t>=b&&t<b+0.36){const p=inC(clamp((t-b)/0.34));turn(el,-70*p,1-p);el.style.zIndex=1;}
    else{el.style.opacity=0;}});
  if(t<12.4)flowAt(t);if(t>=11.9&&t<19.9)doAt(Math.max(t,12));if(t>=19.4&&t<27.4)aadlAt(Math.max(t,19.5));
  const c=CAPS.find(([a,b])=>t>=a&&t<b)||[0,0,''],cap=$('#cap');cap.textContent=c[2];cap.style.opacity=Math.min(clamp((t-c[0]-0.15)/0.35),clamp((c[1]-t)/0.3));cap.style.transform=`translateX(${(1-expo(clamp((t-c[0]-0.15)/0.6)))*40}px)`;
  $('#grad').style.opacity=t<33?1:0;
};
seek(0);
