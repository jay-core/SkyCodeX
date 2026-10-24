/* ---------- round 2: Lithograph ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const ST=(pos='45:42',p='no problems')=>`<span>${pos}</span><span>clangd ready</span><span>${p}</span>`;
const H=(t,extra='')=>`${t}${extra}`;
const lumX=h=>{const c=h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const crX=(a,b)=>{const x=lumX(a),y=lumX(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(1);};
const FILES=TREE_MAIN;
function strings(root,pairs){const w=root.querySelector('.win');const svg=w.querySelector('svg.links');const wr=w.getBoundingClientRect();let out=svg.innerHTML;
  pairs.forEach(([a,b,col,label,dash])=>{const A=document.getElementById(a).getBoundingClientRect(),B=document.getElementById(b).getBoundingClientRect();
    let x1=A.right-wr.left,y1=A.top+A.height/2-wr.top,x2=B.left-wr.left,y2=B.top+B.height/2-wr.top;
    if(x2<x1){x1=A.left+A.width/2-wr.left;y1=A.bottom-wr.top;x2=B.left+B.width/2-wr.left;y2=B.top-wr.top;const k=Math.max(30,(y2-y1)*.5);
      out+=`<path d="M${x1} ${y1} C${x1} ${y1+k} ${x2} ${y2-k} ${x2} ${y2}" stroke="${col}" stroke-width="1.3" fill="none" opacity=".7" ${dash?'stroke-dasharray="4 4"':''}/>`;}
    else{const k=Math.max(40,(x2-x1)*.5);out+=`<path d="M${x1} ${y1} C${x1+k} ${y1} ${x2-k} ${y2} ${x2} ${y2}" stroke="${col}" stroke-width="1.3" fill="none" opacity=".7" ${dash?'stroke-dasharray="4 4"':''}/>`;}
    out+=`<circle cx="${x2}" cy="${y2}" r="2.6" fill="${col}"/>`;
    if(label)out+=`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-7}" fill="${col}" font-size="11.5" font-weight="300" font-family="-apple-system" text-anchor="middle">${label}</text>`;});
  svg.innerHTML=out;}

const G={};

G['b01-look']=()=>{
  const BG='#171817';const toks=[['text','#9ea39b'],['keywords','#739696'],['functions','#ad9b6f'],['types','#7f9e82'],['variables','#a8929e'],['parameters','#b0857a'],['strings','#ab9070'],['comments','#5f665f']];
  const band=`<div style="position:absolute;right:22px;bottom:18px;z-index:9;background:#1b1c1b;padding:12px 16px 10px;font:300 12px var(--ui);color:#6d746c">
    <div class="metro-h" style="margin-bottom:8px">contrast against #171817</div>
    <div style="display:grid;grid-template-columns:repeat(4,auto);gap:5px 18px">${toks.map(([n,c])=>`<span style="color:${c}">${n} <span style="color:#454b45">${crX(c,BG)}</span></span>`).join('')}</div></div>`;
  return frame('01','lithograph — the new look','Charcoal, borderless, low contrast. Type is the only chrome.',
   win({crumb:PV('server.cpp',['headers.cpp','router.cpp'],'Server::handle')+'<span class="pin" style="margin-left:14px">1</span>',right:ST()+'<span class="pin">2</span>',cols:'1.15fr 1fr 1fr 190px',termH:118,
    panes:[pane('',code(MAIN.replace('«pin:2|»',''),{start:30,active:45,params:['req']})),
      pane('prev',mainCards(true),'calls<span class="pin">3</span>'),
      pane('prev',cards(card('split','util/strings.cpp:8',C_SPLIT,{c:{start:8,params:['s','delim']}}),card('trim','util/strings.cpp:27',C_TRIM.replace('«cur|»','').replace(/«c:is_space\|is_space»/g,'is_space'),{c:{start:27,params:['s']}})),'inside parse_headers'),
      pane('files',tree(FILES),'tinyhttp')],
    term:`<div class="tt"><span class="on">zsh</span><span>problems</span></div><div style="padding:0 10px">${code(R`~/code/tinyhttp ❯ ./build/tinyhttp --port 8080
listening on :8080
~/code/tinyhttp ❯ «cur|»`,{lang:'term',nog:true})}</div>`,over:band+'<span class="pin" style="position:absolute;right:400px;bottom:60px;z-index:10">4</span>'}),
  [[1,'<b>Pivot header</b> — open files as big light type; the current one is bright, others fade. Swipe or ⌃Tab.'],
   [2,'<b>No title bar, no buttons.</b> Close / minimise / maximise appear as faint glyphs only when the pointer touches the top-right corner; native keys always work.'],
   [3,'<b>Borderless</b> — panes and cards are separated only by 1–2 % tone steps. Square corners.'],
   [4,'<b>Low, even contrast</b> — every syntax colour sits in one narrow band so nothing shouts; comments recede.']]);};

G['b02-atlas']=()=>{
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const DIRS=[['storage',['btree.cpp','wal.cpp','arena.cpp','pager.cpp','compaction.cpp','sstable.cpp','bloom.cpp','cache.cpp','manifest.cpp','iterator.cpp','txn.cpp','checksum.cpp']],
    ['net',['server.cpp','session.cpp','io.cpp','tls.cpp','socket.cpp','http.cpp','proto.cpp','poller.cpp']],['query',['parser.cpp','planner.cpp','exec.cpp','lexer.cpp','optimizer.cpp','expr.cpp','catalog.cpp']],
    ['replication',['raft.cpp','log.cpp','snapshot.cpp','membership.cpp','transport.cpp']],['util',['strings.cpp','hash.cpp','time.cpp','status.cpp','thread_pool.cpp','flags.cpp']],
    ['third_party',['zstd','fmt','abseil']],['tests',['storage','net','query','fuzz','replication']],['tools',['kvctl.cpp','bench.cpp','dump.cpp']]];
  const READ=new Set(['net/server.cpp','net/session.cpp','net/io.cpp','query/parser.cpp','storage/wal.cpp','util/strings.cpp','util/status.cpp','net/socket.cpp']);
  const HIT=new Set(['net/io.cpp','storage/wal.cpp','net/tls.cpp','replication/transport.cpp']);
  const dirs=DIRS.map(([d,fs])=>({d,fs:fs.map(f=>({f,v:d==='third_party'?18000+rnd()*22000:d==='tests'?4000+rnd()*7000:900+rnd()*8000})).sort((a,b)=>b.v-a.v)})).map(x=>({...x,v:x.fs.reduce((a,b)=>a+b.v,0)})).sort((a,b)=>b.v-a.v);
  function squarify(items,x,y,w,h){const out=[];const total=items.reduce((a,b)=>a+b.v,0);let rest=items.map(i=>({...i,a:i.v*w*h/total}));
    while(rest.length){const short=Math.min(w,h);let row=[rest[0]],i=1;
      const worst=r=>{const s=r.reduce((a,b)=>a+b.a,0);const mx=Math.max(...r.map(b=>b.a)),mn=Math.min(...r.map(b=>b.a));return Math.max(short*short*mx/(s*s),s*s/(short*short*mn));};
      while(i<rest.length&&worst([...row,rest[i]])<=worst(row)){row.push(rest[i]);i++;}
      const s=row.reduce((a,b)=>a+b.a,0);
      if(w>=h){const rw=s/h;let yy=y;row.forEach(r=>{const rh=r.a/rw;out.push({...r,x,y:yy,w:rw,h:rh});yy+=rh;});x+=rw;w-=rw;}
      else{const rh=s/w;let xx=x;row.forEach(r=>{const rw=r.a/rh;out.push({...r,x:xx,y,w:rw,h:rh});xx+=rw;});y+=rh;h-=rh;}
      rest=rest.slice(row.length);}return out;}
  const MW=1060,MH=560;let html='';const centers={};
  squarify(dirs,0,0,MW,MH).forEach(D=>{const G2=3;
    html+=`<div style="position:absolute;left:${D.x+G2}px;top:${D.y+G2}px;width:${D.w-2*G2}px;height:${D.h-2*G2}px;background:#131413"></div>`;
    html+=`<div style="position:absolute;left:${D.x+10}px;top:${D.y+6}px;font:300 ${Math.min(26,Math.max(13,D.w/12))}px var(--ui);color:#4a504a;z-index:2">${D.d}</div>`;
    const top=Math.min(30,D.h*.25);
    squarify(D.fs,D.x+6,D.y+top+4,D.w-12,D.h-top-10).forEach(F=>{const key=D.d+'/'+F.f;const rd=READ.has(key),hit=HIT.has(key),here=key==='net/server.cpp';
      centers[key]=[F.x+F.w/2,F.y+F.h/2];
      const bg=rd?'#262826':'repeating-linear-gradient(135deg,#191a19 0 2px,#171817 2px 6px)';
      html+=`<div style="position:absolute;left:${F.x+2}px;top:${F.y+2}px;width:${F.w-4}px;height:${F.h-4}px;background:${bg};${hit?'box-shadow:inset 0 0 0 1.5px #8c7d5a;':''}overflow:hidden;font:300 11px var(--ui);color:${rd?'#8b9189':'#3d423d'};padding:5px 6px;white-space:nowrap">${F.w>64&&F.h>22?F.f:''}${here?'<div style="position:absolute;right:6px;bottom:5px;font:400 10px var(--ui);color:#a3a8a0">●</div>':''}</div>`;});});
  const trace=['net/server.cpp','net/session.cpp','query/parser.cpp','query/exec.cpp','storage/btree.cpp','storage/wal.cpp'];
  const pts=trace.map(k=>centers[k]);
  const svg=`<svg width="${MW}" height="${MH}" style="position:absolute;left:0;top:0;z-index:3;overflow:visible"><path d="M${pts.map(p=>p.join(' ')).join(' L')}" stroke="#739696" stroke-width="1.6" fill="none" stroke-dasharray="1 0" opacity=".8"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#171817" stroke="#739696" stroke-width="1.3"/><text x="${p[0]}" y="${p[1]+3.5}" fill="#9ec0c0" font-size="10" text-anchor="middle" font-family="-apple-system">${i+1}</text>`).join('')}</svg>`;
  const map=`<div style="position:relative;width:${MW}px;height:${MH}px;margin:4px 0 0 18px">${html}${svg}</div>`;
  const side=`<div style="padding:6px 18px;font:300 13px/1.9 var(--ui);color:#6d746c">
    <div class="big300" style="font-size:38px">418k</div><div style="margin-top:-6px">lines · 2,914 files</div>
    <div class="big300" style="font-size:38px;margin-top:14px">11%</div><div style="margin-top:-6px">read by you<span class="pin">2</span></div>
    <div class="metro-h" style="margin-top:22px">zoom<span class="pin">1</span></div>
    ${['repository','directories','files','functions','code'].map((z,i)=>`<div style="color:${i===2?'#a3a8a0':'#3f453f'};font-size:${i===2?16:14}px">${z}</div>`).join('')}
    <div class="metro-h" style="margin-top:22px">overlays</div>
    <div style="color:#9ec0c0">— request path<span class="pin">3</span></div><div style="color:#ad9b6f">▢ search: write_all<span class="pin">4</span></div><div>▨ unread</div><div>■ churn (git)</div><div>■ test coverage</div></div>`;
  return frame('02','atlas — the whole codebase as a map','Zoom out past the files. Directories are regions, files are blocks sized by lines; zoom in and blocks turn into code.',
   win({crumb:PV('atlas',['server.cpp','headers.cpp']),right:'<span>⌘/Ctrl ⇧ M</span>',cols:'1fr 230px',panes:[pane('',map,''),pane('files',side,'')]}),
  [[1,'<b>Semantic zoom</b> — ⌘/Ctrl-scroll: repo → directories → files → function outlines → real code, one continuous zoom.'],
   [2,'<b>Fog of war</b> — files you haven’t read are hatched; read ones are solid. You always see what you don’t know yet.'],
   [3,'<b>Paths drawn on the map</b> — pick any call chain (here: a request from server to disk) and see it cross the codebase.'],
   [4,'<b>Overlays</b> — search hits, git churn, test coverage or analyzer findings painted onto the same map.']]);};

G['b03-book']=()=>{
  const toc=[['1','entry point','main.cpp',1],['2','configuration','config.cpp',1],['3','accepting connections','net/server.cpp',.6],['4','one request, end to end','net/session.cpp',0],['5','parsing queries','query/parser.cpp',0],['6','planning & execution','query/exec.cpp',0],['7','the storage engine','storage/btree.cpp',0],['8','durability: the WAL','storage/wal.cpp',0],['9','replication','replication/raft.cpp',0],['','appendix — utilities','util/ · 14 functions',0]];
  const left=`<div style="padding:4px 22px;font:300 13.5px/1.35 var(--ui)"><div class="metro-h" style="margin-bottom:12px">contents<span class="pin">1</span></div>${toc.map(([n,t,f,p])=>`<div style="margin-bottom:11px;color:${p===.6?'#a3a8a0':p?'#5f665f':'#3f453f'}"><span style="display:inline-block;width:18px;color:#3f453f">${n}</span>${t}${p===.6?`<div style="margin:5px 0 0 18px;height:2px;background:#262826"><div style="width:60%;height:2px;background:#739696"></div></div>`:''}<div style="margin-left:18px;font-size:11px;color:#353a35">${f}${p===1?' · read':''}</div></div>`).join('')}</div>`;
  const P1=R`void Server::start() {
    socket_.listen(port_);
    while (running_) {
        auto conn = socket_.accept();
        «c:x|handle»(conn);
    }
}`;
  const P2=R`void Server::handle(Connection conn) {
    Session s(std::move(conn), store_);
    while (s.alive())
        s.serve_one();
}`;
  const mid=`<div style="max-width:640px;margin:0 auto;padding:10px 0 0">
    <div style="font:300 12px var(--ui);color:#454b45;letter-spacing:.04em">chapter 3</div>
    <div class="big300" style="font-size:40px;margin:2px 0 4px">accepting connections</div>
    <div style="font:300 13px/1.6 var(--ui);color:#5f665f;margin-bottom:18px">Reading order follows the call graph from <span style="color:#ad9b6f">main()</span>. Helpers called from many places move to the appendix so the story isn’t interrupted.<span class="pin">2</span></div>
    <div style="font:300 11.5px var(--ui);color:#3f453f;margin:0 0 4px">net/server.cpp · 30–36 <span style="color:#5f8a6a;margin-left:10px">✓ read 2 min ago</span><span class="pin">3</span></div>
    <div style="opacity:.55">${code(P1,{start:30})}</div>
    <div style="font:300 11.5px var(--ui);color:#3f453f;margin:16px 0 4px">net/server.cpp · 52–56 &nbsp;— called from line 34</div>
    ${code(P2.replace('s.serve_one();','s.serve_one();«cur|»'),{start:52,active:55,params:['conn']})}
    <div style="font:300 13px/1.6 var(--ui);color:#5f665f;margin:14px 0 0;border-left:2px solid #2a2d2a;padding-left:12px">Your margin note: <span style="color:#8b9189">“one Session per connection — no pooling yet?”</span><span class="pin">4</span></div>
    <div style="font:300 11.5px var(--ui);color:#3f453f;margin:18px 0 4px">next → net/session.cpp · Session::serve_one</div></div>`;
  const right=`<div style="padding:4px 18px;font:300 13px/1.7 var(--ui);color:#5f665f"><div class="big300" style="font-size:38px">34%</div><div style="margin-top:-6px">of the main path read</div>
    <div class="big300" style="font-size:38px;margin-top:16px">2 h 10</div><div style="margin-top:-6px">left at your pace<span class="pin">5</span></div>
    <div class="metro-h" style="margin-top:24px">mode</div><div style="color:#a3a8a0">continuous</div><div>one function per page</div><div>skim (signatures)</div></div>`;
  return frame('03','book mode — read a codebase start to finish','Lithograph turns the call graph into chapters, so you can read a project in order, like a book.',
   win({crumb:PV('book',['atlas','server.cpp']),right:'<span>space / ⇧space to page</span>',cols:'270px 1fr 220px',panes:[pane('files',left,''),pane('',mid,''),pane('files',right,'')]}),
  [[1,'<b>Chapters from structure</b> — derived from the call graph, edited freely and saved as a plain file you can share.'],
   [2,'<b>Story order</b> — main path first, shared helpers in an appendix, tests and third-party code left out.'],
   [3,'<b>Read tracking</b> — a function counts as read after it sat in view long enough. Read code dims slightly.'],
   [4,'<b>Margin notes</b> live beside the text, not inside the source.'],
   [5,'<b>Progress and pace</b> measured from your own reading speed. Space pages, like a reader.']]);};

G['b04-signal']=()=>{
  const S=R`Status Store::put(sv key, sv value) {
    TRACE_SPAN("store.put");
    if (key.empty()) {
        LOG_WARN("empty key");
        return Status::invalid("empty key");
    }
    assert(value.size() < kMaxValue);
    auto lock = std::scoped_lock(mu_);
    metrics_.puts.inc();
    auto slot = index_.find_or_insert(key);
    if (!slot) {
        LOG_ERROR("index full");
        return Status::full();
    }
    slot->value = arena_.copy(value);
    wal_.append(Op::Put, key, value);
    return Status::ok();
}`;
  const noise={41:'noise',42:'noise',43:'noise',44:'noise',45:'noise',46:'noise',48:'noise',50:'noise',51:'noise',52:'noise',53:'noise'};
  const tag=`<div style="font:300 12px/1.8 var(--ui);color:#5f665f;padding:10px 22px 0">dimmed: <span style="color:#8b9189">tracing · logging · asserts · metrics · early-exit error branches</span><span class="pin">2</span></div>`;
  const mk=(on)=>win({crumb:PV('store.cpp',[],'Store::put'),right:on?'<span style="color:#9ec0c0">signal on</span><span class="kbd">⌥/Alt S</span>':'<span>signal off</span>',cols:'1fr',panes:[pane('',code(S,{start:40,params:['key','value'],lcls:on?noise:{}})+(on?tag:''),'')]});
  return frame('04','signal mode — see the happy path','One key fades the noise. What’s left is what the function actually does.',
   `<div class="col" style="flex:1"><div class="label">as written</div><div style="display:flex;flex:1">${mk(false)}</div></div><div class="col" style="flex:1"><div class="label">signal mode<span class="pin">1</span></div><div style="display:flex;flex:1">${mk(true)}</div></div>`,
  [[1,'<b>Six lines remain</b> out of eighteen: lock, find slot, copy, log to WAL, return.'],
   [2,'<b>What counts as noise</b> is a list in settings.toml (macro names, patterns, “return on error” shapes).'],
   [3,'<b>Works everywhere</b> — main pane, preview cards, book mode. Dimmed lines stay editable.'],
   [0,'Implementable with clangd’s semantic tokens plus simple shape rules; no AI involved.']]);};

G['b05-thread']=()=>{
  const N=[['main',60,40,'v'],['Config::load',210,88,'v'],['Server::start',210,40,'v'],['Server::handle',400,40,'v'],['parse_headers',600,24,'v'],['split',790,24,'d'],['trim',790,56,'d'],['route',600,88,'v'],['match_path',790,88,'c']];
  const P=n=>N.find(x=>x[0]===n);
  const E=[['main','Server::start'],['main','Config::load'],['Server::start','Server::handle'],['Server::handle','parse_headers'],['parse_headers','split'],['parse_headers','trim'],['Server::handle','route'],['route','match_path']];
  const svg=`<svg width="1000" height="100" style="display:block">${E.map(([a,b])=>{const A=P(a),B=P(b);const cur=['main','Server::start','Server::handle','route','match_path'].includes(b);return `<path d="M${A[1]} ${A[2]} C${(A[1]+B[1])/2} ${A[2]} ${(A[1]+B[1])/2} ${B[2]} ${B[1]} ${B[2]}" stroke="${cur?'#ad9b6f':'#343834'}" stroke-width="${cur?1.6:1.2}" fill="none"/>`;}).join('')}
    ${N.map(([n,x,y,t])=>`<circle cx="${x}" cy="${y}" r="${t==='c'?6:4}" fill="${t==='c'?'#ad9b6f':t==='d'?'#2a2d2a':'#5f665f'}" ${t==='c'?'stroke="#171817" stroke-width="2"':''}/><text x="${x-4}" y="${y-9}" font-size="12" font-weight="300" font-family="-apple-system" fill="${t==='c'?'#c9b98f':t==='d'?'#3f453f':'#7b8279'}">${n}</text>`).join('')}</svg>`;
  const strip=`<div style="position:absolute;left:0;right:0;top:58px;z-index:7;display:flex;align-items:center;padding:4px 22px 10px;gap:40px;background:var(--bg)">${svg}<div style="font:300 12.5px/1.9 var(--ui);color:#5f665f"><div><span class="kbd">⌥/Alt [</span> <span class="kbd">]</span> back · forward along the thread</div><div><span class="kbd">⌥/Alt T</span> show the whole thread</div><div style="color:#9ec0c0">save as tour → <span style="color:#5f665f">tours/request-path.toml</span><span class="pin">3</span></div></div></div>`;
  return frame('05','ariadne’s thread — you can’t get lost','Every jump you make is kept as a branching thread. Go back, try another branch, nothing is forgotten.',
   win({crumb:PV('router.cpp',['server.cpp','headers.cpp'],'match_path'),right:ST('88:14'),cols:'1.15fr 1fr 190px',
    over:strip.replace('</svg>','</svg><span class="pin" style="margin-left:-30px">1</span>'),
    panes:[pane('','<div style="height:112px"></div>'+code(R`bool match_path(sv pattern, sv path) {
    auto p = split(pattern, "/");
    auto q = split(path, "/");
    if (p.size() != q.size()) return false;«cur|»
    for (size_t i = 0; i < p.size(); ++i)
        if (p[i] != "*" && p[i] != q[i]) return false;
    return true;
}`,{start:88,active:91,params:['pattern','path']}),''),
      pane('prev','<div style="height:112px"></div>'+cards(card('split','util/strings.cpp:8',C_SPLIT,{c:{start:8,params:['s','delim']}})),''),pane('files','<div style="height:112px"></div>'+tree(FILES.replace('server.cpp|act|mod','server.cpp').replace('router.cpp|dot=#7f9e82','router.cpp|act')),'')]}),
  [[1,'<b>The thread</b> — bright: the path to where you are. Faint: branches you explored and left. Click any knot to jump back.'],
   [2,'<b>Branches never overwrite</b> each other, unlike a back button.'],
   [3,'<b>Tours</b> — save a thread with notes; a teammate opens it and walks the same path, knot by knot.'],
   [0,'Stored per project in data/state; survives restarts.']]);};

G['b06-board']=()=>{
  const asan=`<div id="asan" style="position:absolute;left:24px;top:30px;width:330px;background:#1b1c1b;padding:12px 14px;font:11px/1.6 var(--mono);color:#7b8279;white-space:pre">${esc(`==4127==ERROR: AddressSanitizer:
  heap-use-after-free on 0x60b0001a8
READ of size 8 by thread T3
  #0 Session::touch()   session.cpp:9
  #1 Server::find_session  server.cpp:30
  #2 Server::handle     server.cpp:41
freed by thread T1 here:
  #0 operator delete
  #1 Server::evict      server.cpp:88`)}<div style="font:300 11.5px var(--ui);color:#9ec0c0;margin-top:8px;white-space:normal">pasted · turned into the cards on the right<span class="pin">1</span></div></div>`;
  const pc=(id,x,y,w,name,loc,src,o={})=>`<div id="${id}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px">${card(name,loc,src,{c:o})}</div>`;
  const sticky=`<div id="note1" style="position:absolute;left:1000px;top:330px;width:250px;background:#24231d;padding:12px 14px;font:300 13px/1.5 var(--ui);color:#b3a885">evict() runs on the timer thread, find_session() on worker threads — no lock around sessions_?<div style="font-size:11px;color:#6b6450;margin-top:8px">note · 14:20<span class="pin">3</span></div></div>`;
  const board=`<div style="position:absolute;inset:0;background-image:radial-gradient(#222422 1px,transparent 1px);background-size:24px 24px">${asan}${sticky}
    ${pc('f0',430,24,300,'#0 Session::touch','session.cpp:9',R`Session* Session::touch() {
    last_seen_ = Clock::now();
    return this;
}`,{start:8})}
    ${pc('f1',430,170,330,'#1 Server::find_session','server.cpp:20',R`for (auto& e : sessions_)
    if (e.id == id) { s = &e; break; }
return s->touch();`,{start:22,lcls:{24:'hitl'}})}
    ${pc('f2',430,310,300,'#2 Server::handle','server.cpp:41',R`auto* s = find_session(req.sid);`,{start:41,params:['req']})}
    ${pc('fr',840,60,360,'freed by · Server::evict','server.cpp:88',R`void Server::evict(Clock::time_point now) {
    std::erase_if(sessions_, [&](auto& e) {
        return now - e.last_seen_ > ttl_;
    });
}`,{start:86,lcls:{87:'hitl'},params:['now']})}
    <div style="position:absolute;left:24px;bottom:22px;font:300 12.5px var(--ui);color:#454b45">drag to arrange · cards are live code · board saved as boards/uaf-sessions.toml<span class="pin">4</span></div></div>`;
  const post=root=>strings(root,[['asan','f0','#5f665f',''],['f0','f1','#739696','called by'],['f1','f2','#739696','called by'],['f1','fr','#b8766b','same object, freed 2 ms earlier',true],['fr','note1','#ab9070','']]);
  return {post,html:frame('06','investigation board — debug like a detective','Pin live code, draw strings between suspects, paste a crash and get its stack laid out for you.',
   win({crumb:PV('board',['server.cpp','session.cpp'],'uaf in sessions'),right:'<span>⌘/Ctrl ⇧ B pin current function</span>',cols:'1fr',panes:[pane('',board,'')]}),
  [[1,'<b>Paste a crash</b> — sanitizer reports, lldb/gdb backtraces, compiler errors. Every frame becomes a live card.'],
   [2,'<b>Strings</b> — draw links between suspects and label them. Cards stay real, editable code.'],
   [3,'<b>Sticky notes</b> for hypotheses, right next to the code they’re about.'],
   [4,'<b>Boards are files</b> — save, reopen, hand to a teammate.']])};};

G['b07-var']=()=>{
  const S=R`size_t Uploader::send_all(std::span<const Chunk> chunks) {
    size_t «occw|budget» = limits_.max_bytes;
    size_t sent = 0;
    for (const auto& c : chunks) {
        if (c.size() > «occ|budget») {
            «occw|budget» = refill(«occ|budget»);
            if («occ|budget» == 0) break;
        }
        sent += write_chunk(c);
        «occw|budget» -= c.size();
        adjust_for_latency(«occw|budget»);«cur|»
        log_sent(sent, «occ|budget»);
    }
    return sent;
}`;
  const M={21:'w',24:'r',25:'wr',26:'r',29:'w',30:'m',31:'r'};
  const mark=k=>k==='w'?'<span style="color:#ad9b6f">●</span>':k==='r'?'<span style="color:#739696">○</span>':k==='wr'?'<span style="color:#ad9b6f">●</span><span style="color:#739696">○</span>':'<span style="color:#b8766b">◐</span>';
  const gut={};Object.entries(M).forEach(([n,k])=>gut[n]=`<span style="position:absolute;left:-26px;width:24px;text-align:center;font-size:11px">${mark(k)}</span>`);
  const story=`<div style="padding:4px 22px;font:300 13px/1.55 var(--ui);color:#6d746c">
    <div class="big300" style="font-size:34px">budget</div><div style="margin:-4px 0 16px">size_t · local · 7 uses<span class="pin">2</span></div>
    ${[['21','●','set','limits_.max_bytes','#ad9b6f'],['24','○','read','compare to chunk size','#739696'],['25','●','set','refill(budget)','#ad9b6f'],['26','○','read','== 0 → stop','#739696'],['29','●','set','−= c.size()','#ad9b6f'],['30','◐','may change','adjust_for_latency(size_t& b)','#b8766b'],['31','○','read','logged','#739696']].map(([l,s,k,t,c])=>`<div style="display:grid;grid-template-columns:30px 18px 84px 1fr;padding:3px 0"><span style="color:#3f453f">${l}</span><span style="color:${c}">${s}</span><span style="color:${c}">${k}</span><span style="font-family:var(--mono);font-size:11.5px;color:#8b9189">${esc(t)}</span></div>`).join('')}
    <div style="margin-top:16px;padding:10px 12px;background:#1f1a18;color:#b38f86">Line 30 passes <span style="font-family:var(--mono)">budget</span> by non-const reference — it can change there without an <span style="font-family:var(--mono)">=</span> in sight.<span class="pin">3</span></div></div>`;
  return frame('07','value story — every write and read of a variable','Put the cursor on a variable: the gutter shows where it’s set (●), read (○) and where it might change behind your back (◐).',
   win({crumb:PV('uploader.cpp',[],'Uploader::send_all'),right:ST('30:36'),cols:'1.3fr 1fr',
    panes:[pane('',`<div style="padding-left:26px">${code(S,{start:20,active:30,params:['chunks'],gut})}</div><div style="padding:0 22px"><span class="pin">1</span></div>`,''),pane('files',story,'')]}),
  [[1,'<b>Gutter marks</b> — set, read, set-and-read, or possibly changed via a reference / pointer.'],
   [2,'<b>Story panel</b> lists each use in order with what happens there; click to jump.'],
   [3,'<b>Hidden writes flagged</b> — non-const reference and pointer arguments are the usual surprise.'],
   [0,'Built on clangd’s read / write highlights plus the called function’s parameter types.']]);};

G['b08-git']=()=>{
  const S=R`Response Server::handle(const Request& req) {
    auto headers = parse_headers(req.raw);
    if (headers.empty()) {
        return Response::bad_request();
    }
    auto handler = route(req.path, routes_);
    Response res = handler(req, headers);
    if (keep_alive(req))
        res.headers.set("Connection", "keep-alive");
    send_response(socket_, res);
    return res;
}`;
  const age={39:'#1a1b1a',40:'#171817',41:'#1d1e1c',42:'#1d1e1c',43:'#1d1e1c',44:'#171817',45:'#171817',46:'#201f1b',47:'#201f1b',48:'#171817',49:'#171817',50:'#171817'};
  const inbox=`<div style="padding:4px 20px;font:300 13px/1.5 var(--ui);color:#6d746c"><div class="big300" style="font-size:34px">4</div><div style="margin:-4px 0 14px">changed since you read them<span class="pin">1</span></div>
    ${[['Server::handle','2 commits · read 12 Oct',1],['parse_headers','1 commit · read 9 Oct',0],['Session::serve_one','3 commits · read 2 Oct',0],['Store::put','1 commit · read 30 Sep',0]].map(([n,m,on])=>`<div style="padding:7px 0 7px 10px;${on?'box-shadow:inset 2px 0 #739696;color:#a3a8a0':''}"><div style="font-family:var(--mono);font-size:12px;color:${on?'#ad9b6f':'#7b8279'}">${n}</div><div style="font-size:11.5px;color:#454b45">${m}</div></div>`).join('')}
    <div class="metro-h" style="margin-top:18px">hold ⌥/Alt G</div><div style="font-size:12px">lines tinted by age — warmer is newer<span class="pin">3</span></div></div>`;
  return frame('08','unread changes & why a line exists','Lithograph remembers what you’ve read, so it can tell you what changed since — like unread mail, for code.',
   win({crumb:PV('server.cpp',['headers.cpp'],'Server::handle'),right:ST('46:22'),cols:'1.5fr 300px',
    panes:[pane('',`<style>${Object.entries(age).map(([n,c])=>`.agev .ln[data-n="${n}"]{background:${c}}`).join('')}</style><div class="agev">${code(S,{start:39,active:46,params:['req'],lcls:{41:'chg',42:'chg',43:'chg',46:'chg',47:'chg'},
       eol:{46:`<span class="eol" style="color:#5f665f;font-style:normal">a1f3c · “keep-alive for HTTP/1.1 clients” · R. Okafor · 3 days ago</span><span class="pin">2</span>`}})}</div>`,''),pane('files',inbox,'')]}),
  [[1,'<b>Unread-changes inbox</b> — functions you read before that changed after. Open one to see just the diff since your visit.'],
   [2,'<b>Why is this here?</b> — rest on a line and its commit message appears at the end, quietly.'],
   [3,'<b>Age tint</b> — hold a key to see which lines are old and which are fresh.'],
   [0,'Uses plain git on disk; works offline, no account needed.']]);};

G['b09-notepad']=()=>{
  const note=`<div style="max-width:660px;margin:0 auto;padding:24px 0 0;font:14px/1.85 var(--mono);color:#9ea39b">
    <div style="font:300 34px var(--ui);color:#a3a8a0;margin-bottom:6px">sessions vanish under load</div>
    <div style="color:#454b45;font:300 12px var(--ui);margin-bottom:20px">notes/2026-10-24.md · saved</div>
    <div>Repro: 200 clients, ttl 5 s. Crash in <span id="sym" style="border-bottom:1px dotted #739696;color:#9ec0c0">Session::touch</span> after ~40 s.<span class="pin">2</span></div>
    <div style="margin-top:10px">Suspects:</div>
    <div>— <span style="border-bottom:1px dotted #739696;color:#9ec0c0">Server::evict</span> erases while workers hold pointers</div>
    <div>— ttl_ compared in ms vs s?  <span style="color:#5f665f">(checked: fine)</span></div>
    <div style="margin:14px 0 6px;color:#454b45;font:300 12px var(--ui)">![[Server::evict]] — live excerpt, updates when the code does<span class="pin">3</span></div>
    <div style="background:#1b1c1b;padding:4px 0">${code(R`void Server::evict(Clock::time_point now) {
    std::erase_if(sessions_, [&](auto& e) {
        return now - e.last_seen_ > ttl_;
    });
}`,{start:86,params:['now']})}</div>
    <div style="margin-top:14px;background:rgba(255,255,255,.022)">Next: guard sessions_ with a shared_mutex, rerun with TSan.<span class="cur"></span></div>
    <div style="color:#2f332f;margin-top:4px">← typewriter scrolling keeps this line at eye height<span class="pin">4</span></div></div>`;
  return frame('09','notepad — a quiet page that knows your code','No project open? Lithograph is a plain, fast notepad. With a project, notes link to real symbols.',
   win({crumb:PV('notes',['server.cpp','board']),right:'<span>⌘/Ctrl ⇧ N quick note from anywhere</span><span class="pin">1</span>',cols:'1fr',panes:[pane('',note,'')],
     over:`<div class="pop" style="left:960px;top:120px;width:380px;padding:0">${card('touch','session.cpp:8',R`Session* Session::touch() {
    last_seen_ = Clock::now();
    return this;
}`,{title:'Session::touch',c:{start:8}})}</div>`}),
  [[1,'<b>Notepad first</b> — opens instantly on any .txt or .md, centred column, nothing else on screen.'],
   [2,'<b>Symbol-aware</b> — type a function name and it links itself; hover for the live definition.'],
   [3,'<b>Live excerpts</b> — embed a function; it updates when the code changes.'],
   [4,'<b>Typewriter scrolling</b> — the line you write stays at eye height; the rest of the page moves.']]);};

G['b10-zoom']=()=>{
  const L0=R`void Server::start() {
    socket_.listen(port_);
    while (running_) {
        auto conn = socket_.accept();
        handle(conn);
    }
}

Response Server::handle(const Request& req) {
    auto headers = parse_headers(req.raw);
    if (headers.empty()) {
        return Response::bad_request();
    }
    auto handler = route(req.path, routes_);
    Response res = handler(req, headers);
    send_response(socket_, res);
    return res;
}

void Server::evict(Clock::time_point now) {
    std::erase_if(sessions_, [&](auto& e) {
        return now - e.last_seen_ > ttl_;
    });
}`;
  const fns=[['Server::Server','uint16_t port',1,[]],['Server::start','',7,['listen','accept','handle']],['Server::handle','const Request& req',10,['parse_headers','route','send_response']],['Server::evict','time_point now',5,['erase_if']],['Server::stop','',4,['close']],['Server::~Server','',3,['close']]];
  const L1=`<div style="padding:8px 18px;font:12.5px/1.6 var(--mono)">${fns.map(([n,a,l,c])=>`<div style="margin-bottom:14px"><div><span class="f">${n}</span><span class="dm">(${esc(a)})</span> <span style="font:300 11px var(--ui);color:#3f453f">${l} lines</span></div>${c.length?`<div style="color:#5f665f;padding-left:18px">→ ${c.map(x=>`<span style="color:#8a7d5c">${x}</span>`).join(', ')}</div>`:''}</div>`).join('')}</div>`;
  const L2=`<div style="padding:8px 18px;font:300 13px/1.5 var(--ui)">${[['server.cpp',[24,10,7,5,4,3,1]],['session.cpp',[18,12,9,6]],['router.cpp',[14,8,6]],['io.cpp',[11,9,4,4]]].map(([f,b])=>`<div style="margin-bottom:14px"><div style="color:${f==='server.cpp'?'#a3a8a0':'#5f665f'}">${f}</div><div style="display:flex;gap:3px;margin-top:5px;align-items:flex-end;height:26px">${b.map(x=>`<i style="display:block;width:14px;height:${x+2}px;background:${f==='server.cpp'?'#4e5a4e':'#2a2d2a'}"></i>`).join('')}</div></div>`).join('')}</div>`;
  const col=(t,inner,pin)=>`<div class="col" style="flex:1"><div class="label">${t}<span class="pin">${pin}</span></div><div style="display:flex;flex:1">${win({crumb:PV('server.cpp'),right:'',cols:'1fr',panes:[pane('',inner,'')]})}</div></div>`;
  return frame('10','structural zoom — scroll out of the code, not the font','⌘/Ctrl-scroll steps out a level of structure. The text never gets smaller; the detail does.',
   col('level 0 · code',code(L0,{start:30,params:['req','now']}),1)+col('level 1 · what each function does',L1,2)+col('level 2 · files and their functions',L2,3),
  [[1,'<b>Code</b> — normal editing.'],[2,'<b>Bodies fold</b> into signature, length and the calls they make — a whole file fits on screen.'],
   [3,'<b>Files</b> with a bar per function sized by length; one more step out lands in the atlas.'],[0,'Built on clangd’s folding ranges and document symbols; zoom centres on the pointer.']]);};

G['b11-scale']=()=>{
  const fz=`<div class="pop" style="left:50%;top:70px;transform:translateX(-50%);width:640px;padding:0">
    <div style="padding:14px 18px;font:300 22px var(--ui);color:#a3a8a0">srvhnd<span class="cur" style="height:22px;vertical-align:-4px"></span><span style="float:right;font:300 12px var(--ui);color:#454b45;margin-top:8px">61,240 symbols · 2,914 files · 9 ms<span class="pin">1</span></span></div>
    ${[['Server::handle','src/net/server.cpp:39','<b>S</b>e<b>rv</b>er::<b>h</b>a<b>nd</b>le'],['ServiceHandle','src/replication/transport.hpp:12','<b>S</b>e<b>rv</b>ice<b>H</b>a<b>nd</b>le'],['ServerHandshake','src/net/tls.cpp:140','<b>S</b>e<b>rv</b>er<b>H</b>a<b>nd</b>shake'],['server_handler_test','tests/net/server_test.cpp:8','<b>s</b>e<b>rv</b>er_<b>h</b>a<b>nd</b>ler_test']].map(([n,p,h],i)=>`<div style="display:flex;padding:8px 18px;${i?'':'background:rgba(255,255,255,.035)'};font:13px var(--mono);color:#8b9189"><span style="color:#7b8279">${h.replace(/<b>/g,'<b style="color:#c9b98f;font-weight:400">')}</span><span style="margin-left:auto;font:300 11.5px var(--ui);color:#454b45">${p}</span></div>`).join('')}
    <div style="padding:12px 18px;font:300 12.5px/1.8 var(--ui);color:#5f665f;background:#1b1c1b">query: <span style="font-family:var(--mono);color:#9ec0c0">calls:write_all in:src/net -tests</span> → 6 functions<span class="pin">2</span></div></div>`;
  const slices=`<div style="padding:0 14px 8px;font:300 13px var(--ui);display:flex;gap:12px"><span style="color:#a3a8a0">net + http</span><span style="color:#3f453f">all</span><span style="color:#3f453f">storage</span><span class="pin">3</span></div>`;
  const tr=tree(R`
kvstore/|open
  src/|open
    net/|open
      server.cpp|act
      session.cpp
      io.cpp
    http/
    storage/|dim
    query/|dim
    replication/|dim
  third_party/|dim
  tests/|dim`);
  return frame('11','built for big codebases','Instant search across everything, saved slices of a monorepo, an index that survives restarts.',
   win({crumb:PV('server.cpp',['session.cpp'],'Server::handle'),right:'<span>indexing 74 %</span><span class="pin">4</span>',cols:'1.15fr 1fr 220px',
    over:fz+'<div style="position:absolute;left:0;top:0;height:2px;width:74%;background:#4e6a6a;z-index:9"></div>',
    panes:[pane('',`<div style="opacity:.35">${code(MAIN.replace('«pin:2|»',''),{start:30,params:['req']})}</div>`,''),pane('prev','',''),pane('files',slices+tr,'')]}),
  [[1,'<b>⌘/Ctrl P</b> — fuzzy find over files and symbols together, ranked by where you work most.'],
   [2,'<b>Query bar</b> — structural search: calls:, called-by:, in:, type:, writes: … combined freely.'],
   [3,'<b>Slices</b> — save a view of just the directories you care about; the rest dims and stays out of search.'],
   [4,'<b>Index on disk</b> in data/, built in the background (a 2-px line is the only progress UI). Huge files open read-only and stream.']]);};
