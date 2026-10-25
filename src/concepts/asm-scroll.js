/* ---------- scrolling previews, std summaries, ASM per ISA — driven by seek(t) ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const clamp=x=>Math.max(0,Math.min(1,x)),expo=p=>p>=1?1:1-Math.pow(2,-10*p),inC=p=>p*p*p,lerp=(a,b,p)=>a+(b-a)*p;
const SRC=R`Response Server::handle(const Request& req) {
    auto headers = «c:parse_headers|parse_headers»(req.raw);
    if (headers.empty())
        return Response::bad_request();
    auto handler = «c:route|route»(req.path, routes_);
    Response res = handler(req, headers);
    «c:apply_cors|apply_cors»(res, allowed_origins_);
    if («c:keep_alive|keep_alive»(req))
        res.headers.set("Connection", "keep-alive");
    «c:compress|compress»(res, req.accept_encoding);
    std::«c:sort|sort»(res.cookies.begin(), res.cookies.end());
    «c:send_response|send_response»(socket_, res);
    metrics_.«c:record|record»(req.path, res.status);
    return res;
}

int Server::sum_sorted(std::vector<int>& v, int extra) {
    v.«c:push_back|push_back»(extra);
    std::«c:sortB|sort»(v.begin(), v.end());
    int total = 0;
    for (int x : v) total += x;
    return total;
}`;
const stdc=(id,title,loc,sig,rows)=>card(id,loc,sig,{id,title,badge:'<span class="badge" style="color:#7f9e82">std · summary</span>',c:{nog:true},extra:`<div class="rows" style="padding:2px 0 8px">${rows.map(r=>`<div class="row" style="font:300 12.5px var(--ui);color:#7b8279;padding:2px 12px">${r}</div>`).join('')}</div>`});
const A=[card('parse_headers','http/headers.cpp:12',C_PARSE.replace(/«[^|»]*\|([^»]*)»/g,'$1'),{c:{start:12,params:['raw']}}),
  card('route','router.cpp:31',C_ROUTE,{c:{start:31,params:['path','routes']}}),
  card('apply_cors','http/cors.cpp:8',R`void apply_cors(Response& r, const Origins& o) {
    if (o.empty()) return;
    r.headers.set("Access-Control-Allow-Origin", o.front());
}`,{c:{start:8,params:['r','o']}}),
  card('keep_alive','http/headers.cpp:40',R`bool keep_alive(const Request& req) {
    auto c = req.headers.get("Connection");
    return c ? iequals(*c, "keep-alive")
             : req.version >= Http11;
}`,{c:{start:40,params:['req']}}),
  card('compress','http/gzip.cpp:15',R`void compress(Response& r, sv accept) {
    if (r.body.size() < 1024 || !accepts_gzip(accept))
        return;
    r.body = gzip(r.body);
    r.headers.set("Content-Encoding", "gzip");
}`,{c:{start:15,params:['r','accept']}}),
  stdc('sort','std::sort','<algorithm>',R`template <class RandomIt>
void sort(RandomIt first, RandomIt last);`,['here: sort&lt;Cookie*&gt; · libc++','introsort + insertion sort · O(n log n)','<span style="color:#7fa3a3">__algorithm/sort.h · 960 lines · open read-only ›</span>']),
  card('send_response','net/io.cpp:58',C_SEND,{c:{start:58,params:['s','r']}}),
  card('record','metrics.cpp:22',R`void Metrics::record(sv path, int status) {
    auto& c = counters_[path];
    ++c.requests;
    if (status >= 500) ++c.errors;
}`,{title:'Metrics::record',c:{start:22,params:['path','status']}})];
const B=[stdc('push_back','std::vector::push_back','<vector>',R`void push_back(const T& value);`,['here: vector&lt;int&gt;::push_back · libc++','amortised O(1) · grows ×2 when full','<span style="color:#7fa3a3">__vector/vector.h · open read-only ›</span>']),
  stdc('sortB','std::sort','<algorithm>',R`template <class RandomIt>
void sort(RandomIt first, RandomIt last);`,['here: sort&lt;int*&gt; · libc++','introsort + insertion sort · O(n log n)','<span style="color:#7fa3a3">__algorithm/sort.h · 960 lines · open read-only ›</span>'])];
const GC={55:'#5f665f',56:'#ad9b6f',57:'#7f9e82',58:'#a8929e',59:'#739696',60:'#ab9070'};
const ARM=[['sum_sorted(std::vector<int>&, int):','lab'],['stp  x29, x30, [sp, #-32]!',55],['stp  x20, x19, [sp, #16]',55],['mov  x19, x0',55],
  ['inlined · std::vector<int>::push_back · fast path · 5 instructions',56,'inl'],['ldp  x8, x9, [x0, #8]        ; end, capacity',56,'ch'],['cmp  x8, x9',56,'ch'],['b.eq .LBB0_4                 ; full → grow',56,'ch'],['str  w1, [x8], #4            ; *end++ = extra',56,'ch'],['str  x8, [x19, #8]',56,'ch'],
  ['.LBB0_1:','lab'],['ldp  x0, x1, [x19]           ; begin, end',57],['bl   |std::sort → __sort<int*>|libc++ · out of line · 1.4 KB',57,'call'],['ldp  x8, x9, [x19]',59],['mov  w0, #0                  ; total = 0',58],['cmp  x8, x9',59],['b.eq .LBB0_3',59],
  ['.LBB0_2:','lab'],['ldr  w10, [x8], #4',59],['add  w0, w0, w10             ; total += x',59],['cmp  x8, x9',59],['b.ne .LBB0_2',59,'mca'],
  ['.LBB0_3:','lab'],['ldp  x20, x19, [sp, #16]',60],['ldp  x29, x30, [sp], #32',60],['ret',60],['.LBB0_4:','lab'],['bl   |vector<int> · grow on push_back|out of line',56,'call'],['b    .LBB0_1',56]];
const X86=[['sum_sorted(std::vector<int>&, int):','lab'],['push rbx',55],['mov  rbx, rdi',55],
  ['inlined · std::vector<int>::push_back · fast path · 6 instructions',56,'inl'],['mov  rax, qword ptr [rdi + 8]',56,'ch'],['cmp  rax, qword ptr [rdi + 16]',56,'ch'],['je   .LBB0_4',56,'ch'],['mov  dword ptr [rax], esi',56,'ch'],['add  rax, 4',56,'ch'],['mov  qword ptr [rbx + 8], rax',56,'ch'],
  ['.LBB0_1:','lab'],['mov  rdi, qword ptr [rbx]',57],['mov  rsi, qword ptr [rbx + 8]',57],['call |std::sort → __sort<int*>|libc++ · out of line · 1.6 KB',57,'call'],['mov  rcx, qword ptr [rbx]',59],['mov  rdx, qword ptr [rbx + 8]',59],['xor  eax, eax                ; total = 0',58],['cmp  rcx, rdx',59],['je   .LBB0_3',59],
  ['.LBB0_2:','lab'],['add  eax, dword ptr [rcx]    ; total += x',59],['add  rcx, 4',59],['cmp  rcx, rdx',59],['jne  .LBB0_2',59,'mca'],
  ['.LBB0_3:','lab'],['pop  rbx',60],['ret',60],['.LBB0_4:','lab'],['call |vector<int> · grow on push_back|out of line',56,'call'],['jmp  .LBB0_1',56]];
const RH=21;
function asmRows(set,cls){return set.map(([t,ln,k])=>{const lab=ln==='lab',col=lab?'transparent':GC[ln];let body;
  if(lab)body=`<span class="f">${esc(t)}</span>`;
  else if(k==='inl')body=`<span class="arrow" style="display:inline-block;width:14px;color:#ad9b6f">▸</span><span style="font:300 12.5px var(--ui);color:#b3a885">${esc(t)}</span>`;
  else if(k==='call'){const [m,n,c]=t.split('|');body=`${hlAsm('        '+m).trim()} <span style="color:#d1c49f">${esc(n)}</span> <span style="font:300 11.5px var(--ui);color:#5f665f;margin-left:8px">${esc(c)}</span> <span style="font:300 11.5px var(--ui);color:#7fa3a3;margin-left:10px">open ›</span>`;}
  else body=hlAsm('        '+t).replace(/^\s+/,'')+(k==='mca'?`<span style="font:300 11.5px var(--ui);color:#7d6f50;margin-left:14px">≈ 1.0 cycles / iteration · llvm-mca</span>`:'');
  return `<div class="ar ${cls}" data-k="${k||''}" data-ln="${lab?'':ln}" style="position:absolute;left:0;right:0;height:${RH}px;display:flex;align-items:center;white-space:pre;font:12.5px var(--mono);color:#9ea39b;padding-left:${lab?14:k==='ch'?44:28}px;box-shadow:inset 3px 0 ${col};${k==='inl'?'background:rgba(173,155,111,.06);':''}"><span>${body}</span></div>`;}).join('');}

const html=`<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
 <div class="hdr">${PV('server.cpp',['headers.cpp'],'Server::handle')}<span class="right"><span id="pos">44:30</span><span>clangd ready</span><span>no problems</span></span></div>
 <div style="flex:1;display:flex;min-height:0">
  <div class="pane" id="codep" style="width:560px;flex:none">${code(SRC,{start:39,active:44,params:['req','v','extra']})}</div>
  <div id="pva" style="flex:1;position:relative;overflow:hidden;background:var(--prev)">
    <div class="ph" style="position:absolute;left:0;right:0;top:0;z-index:3"><span id="phl">calls · 8</span><span class="grow"></span><span class="chip" id="chc">calls</span><span class="chip">callers</span><span class="chip" id="cha">asm</span><span id="isa" class="chip" style="margin-left:8px;opacity:0">arm64 ▾</span><span id="opt" class="chip" style="opacity:0">-O1 · libc++</span></div>
    <div id="v1" style="position:absolute;top:36px;left:0;width:470px;bottom:0;overflow:hidden"><div id="c1" class="cards">${A.map(x=>`<div class="it">${x}</div>`).join('')}</div><div id="c1b" class="cards" style="position:absolute;top:0;left:0;right:0">${B.map(x=>`<div class="it">${x}</div>`).join('')}</div></div>
    <div id="v2" style="position:absolute;top:36px;left:470px;right:0;bottom:0;font:300 13px var(--ui);color:#2f332f;text-align:center;padding-top:40px">click into a card<br>to go deeper</div>
    <div id="asm" style="position:absolute;top:44px;left:12px;right:12px;bottom:0">${asmRows(ARM,'arm')}${asmRows(X86,'x86')}</div>
  </div>
  <div class="pane files" style="width:190px;flex:none">${tree(TREE_MAIN)}</div>
 </div><svg id="lk" style="position:absolute;left:0;top:0;pointer-events:none;z-index:6;overflow:visible" width="1440" height="900"></svg>
 <div id="cap" style="position:absolute;left:40px;bottom:34px;max-width:470px;line-height:1.45;z-index:30;font:300 17px var(--ui);color:#7b8279"></div></div>`;
document.getElementById('root').innerHTML=html;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const v1=$('#v1'),c1=$('#c1'),c1b=$('#c1b'),itA=[...c1.children],itB=[...c1b.children];
const colour={};let ci=0;$$('#c1 [data-card], #c1b [data-card]').forEach(c=>{const id=c.dataset.card;colour[id]=PAL[ci++%PAL.length];c.querySelector('.sw').style.background=colour[id];});
const off=id=>document.querySelector(`#c1 [data-card="${id}"]`).parentElement.offsetTop;
const VH=v1.clientHeight,MAXS=c1.scrollHeight-VH;
const S1=Math.min(MAXS,off('keep_alive')-8),SREC=Math.min(MAXS,off('record')-8),SSORT=Math.min(MAXS,off('sort')-8);
const curEl=Object.assign(document.createElement('span'),{className:'cur'}),ln=n=>$(`#codep .ln[data-n="${n}"]`);
function cursorAt(n){$$('#codep .ln.act').forEach(l=>l.classList.remove('act'));ln(n).classList.add('act');ln(n).querySelector('.t').appendChild(curEl);$('#pos').textContent=`${n}:${ln(n).textContent.length-String(n).length+1}`;}
const armR=$$('.ar.arm'),x86R=$$('.ar.x86');
function layoutRows(rows,e,xo){let y=0;rows.forEach((r,i)=>{const ch=r.dataset.k==='ch';r.style.top=y+'px';
  if(ch){const j=i-rows.findIndex(q=>q.dataset.k==='inl')-1;const p=clamp((e*1.6)-j*0.12);r._eo=p;r._ex=(1-expo(p))*30;y+=RH*e;}
  else{r._eo=1;r._ex=0;y+=RH;}
  if(r.dataset.k==='inl')r.querySelector('.arrow').textContent=e>0.5?'▾':'▸';});}
function feather(rows,p,dir,base){rows.forEach((r,i)=>{const q=clamp((p-i*0.018)/0.4);const e=dir<0?inC(q):expo(q);
  r.style.transformOrigin='left center';const deg=dir<0?-70*e:70*(1-e);r.style.transform=`translateX(${r._ex||0}px) perspective(900px) rotateY(${deg}deg) translateX(${dir<0?-20*e:40*(1-e)}px)`;r.style.opacity=(dir<0?1-e:Math.min(1,q*1.6))*(r._eo??1);});}
function setItems(items,fn){items.forEach((it,k)=>fn(it,k));}
const it=(el,x,o,rot=0)=>{el.style.transformOrigin='left center';el.style.transform=`translateX(${x}px)`+(rot?` perspective(900px) rotateY(${rot}deg)`:'');el.style.opacity=o;};
function lines(pairs){const svg=$('#lk'),wr=$('.win').getBoundingClientRect(),vr=v1.getBoundingClientRect();let out='';
  pairs.forEach(([a,t,col,clip])=>{if(!a||!t)return;const rg=document.createRange();rg.selectNodeContents(a.closest('.t'));const tr=rg.getBoundingClientRect();const ar=a.getBoundingClientRect();
    const xe=$('#codep').getBoundingClientRect().right-wr.left,y1=ar.top+ar.height/2-wr.top,x1=Math.min(Math.max(ar.right-wr.left+2,tr.right-wr.left+8),xe);
    const b=t.getBoundingClientRect();let x2=b.left-wr.left,y2=b.top+Math.min(b.height,26)/2-wr.top,edge=0;
    if(clip){if(y2<vr.top-wr.top+10){y2=vr.top-wr.top+10;edge=-1;}else if(y2>vr.bottom-wr.top-10){y2=vr.bottom-wr.top-10;edge=1;}}
    const k=Math.max(26,(x2-xe)*.55);
    out+=`<path d="M${x1} ${y1} L${xe} ${y1}" stroke="${col}" stroke-width="1.2" stroke-dasharray="2 4" opacity=".5" fill="none"/><circle cx="${x1}" cy="${y1}" r="2.4" fill="${col}"/>`;
    out+=`<path d="M${xe} ${y1} C${xe+k} ${y1} ${x2-k} ${y2} ${x2} ${y2}" stroke="${col}" stroke-width="1.5" opacity="${edge?.55:.8}" fill="none" ${edge?'stroke-dasharray="5 4"':''}/>`;
    if(edge){const name=t.closest('[data-card]').querySelector('.nm').textContent;out+=`<path d="M${x2+4} ${y2+edge*5} l5 ${-edge*7} l5 ${edge*7}" stroke="${col}" fill="none" stroke-width="1.4"/><text x="${x2+16}" y="${y2+4}" fill="${col}" font-size="11.5" font-weight="300" font-family="Selawik,-apple-system">${edge<0?'↑':'↓'} ${name}</text>`;}
    else out+=`<circle cx="${x2}" cy="${y2}" r="3" fill="${col}"/>`;});
  svg.innerHTML=out;}
const CAPS=[[0,3.6,'more calls than fit — each preview column scrolls; lines follow, off-screen cards point to the edge'],[3.6,6.8,'move onto a call — its card glides into view · std functions show as summaries'],
  [6.8,9.4,'asm — the compiled code for this machine’s ISA, arm64 here'],[9.4,11.3,'inlined std code folds into one row — open it when you need it'],[11.3,99,'switch ISA to compare · arm64 ⇄ x86-64']];
function caption(t){const c=CAPS.find(([a,b])=>t>=a&&t<b),el=$('#cap');el.textContent=c[2];el.style.opacity=Math.min(clamp((t-c[0])/0.35),clamp((c[1]-t)/0.3));el.style.transform=`translateX(${(1-expo(clamp((t-c[0])/0.6)))*40}px)`;}
function scrollAt(t){if(t<1.0)return 0;if(t<2.6)return S1*expo(clamp((t-1.0)/0.9));if(t<3.75)return S1;if(t<4.6)return lerp(S1,SREC,expo(clamp((t-3.75)/0.7)));if(t<5.55)return SREC;return lerp(SREC,SSORT,expo(clamp((t-5.55)/0.7)));}
window.TOTAL=14.0;
window.seek=function(t){
  caption(t);
  cursorAt(t<3.6?44:t<5.45?51:t<6.8?49:57);
  $$('#codep .ln').forEach(l=>{const n=+l.dataset.n;l.classList.remove('g2','g3','g4','g5','g6');});
  const asmOn=t>=8.0;
  $('#phl').textContent=t<6.8?'calls · 8':t<8.0?'calls · 2':'asm';
  ['#chc','#cha'].forEach(s=>$(s).classList.remove('on'));$(asmOn?'#cha':'#chc').classList.add('on');
  const press=t>7.85&&t<8.15;$('#cha').style.background=press?'rgba(255,255,255,.06)':'';
  $('#isa').style.opacity=$('#opt').style.opacity=clamp((t-8.2)/0.3);
  const isaPress=t>11.25&&t<11.55;$('#isa').style.color=isaPress?'#c9b98f':'';$('#isa').textContent=t<11.5?'arm64 ▾':'x86-64 ▾';
  // set A: scrolling cards
  c1.style.transform=`translateY(${-scrollAt(t)}px)`;
  const hi=(id,a,b)=>{const c=document.querySelector(`#c1 [data-card="${id}"]`);c.style.background=t>a&&t<b?'#202220':'';c.style.boxShadow=t>a&&t<b?'inset 2px 0 '+colour[id]:'';};
  hi('record',4.35,5.5);hi('sort',6.1,6.8);
  if(t<6.8){setItems(itA,e=>it(e,0,1));setItems(itB,e=>it(e,0,0));}
  else{setItems(itA,(e,k)=>{const p=inC(clamp((t-6.8-0.03*k)/0.25));it(e,-26*p,1-p,-72*p);});
    setItems(itB,(e,k)=>{const p=clamp((t-6.95-0.06*k)/0.55),q=expo(p);const outp=asmOn?inC(clamp((t-8.0-0.04*k)/0.25)):0;it(e,170*(1-q)-26*outp,Math.min(1,p*1.7)*(1-outp),-72*outp);});}
  $('#v2').style.opacity=asmOn?1-clamp((t-8.0)/0.2):1;
  // asm
  const e=expo(clamp((t-9.6)/0.6));
  if(t<8.0){armR.concat(x86R).forEach(r=>r.style.opacity=0);}
  else{layoutRows(armR,e,{});layoutRows(x86R,e,{});
    if(t<11.5)feather(armR,clamp((t-8.05)/0.9),1);else feather(armR,clamp((t-11.5)/0.6),-1);
    if(t<11.62)x86R.forEach(r=>r.style.opacity=0);else feather(x86R,clamp((t-11.62)/0.9),1);
}
  if(asmOn&&t>8.4){[[56,'g2'],[57,'g3'],[58,'g4'],[59,'g5'],[60,'g6']].forEach(([n,c])=>ln(n).classList.add(c));}
  // lines
  const anc=id=>document.querySelector(`#codep .call[data-call="${id}"]`);
  let pairs=[],alpha=1;
  if(t<6.8){pairs=['parse_headers','route','apply_cors','keep_alive','compress','sort','send_response','record'].map(id=>[anc(id),document.querySelector(`#c1 [data-card="${id}"] .card-h`),colour[id],1]);alpha=t>6.7?clamp((6.8-t)/0.1):1;}
  else if(t>7.55&&t<8.0){pairs=['push_back','sortB'].map(id=>[anc(id),document.querySelector(`#c1b [data-card="${id}"] .card-h`),colour[id],1]);alpha=Math.min(clamp((t-7.55)/0.2),clamp((8.0-t)/0.08));}
  else if(t>8.9){const rows=t<11.5?armR:x86R;const first=n=>rows.find(r=>r.dataset.ln==String(n)&&r.dataset.k!=='ch');
    pairs=[56,57,58,59,60].map(n=>[ln(n).querySelector('.t').lastElementChild||ln(n).querySelector('.t'),first(n),GC[n],0]);
    alpha=t<11.5?Math.min(clamp((t-8.9)/0.2),clamp((11.45-t)/0.1)):clamp((t-12.4)/0.2);
    if(t>9.55&&t<10.3)alpha=0;}
  else alpha=0;
  lines(pairs);$('#lk').style.opacity=alpha;
};
seek(0);
