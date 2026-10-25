/* ---------- terminal + press view (clean, full window) ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const PR='<span style="color:#5f7f7f">~/code/tinyhttp</span> <span style="color:#6f8f74">❯</span>';
const M=t=>`<span style="font-family:var(--mono)">${t}</span>`;
const dot=c=>`<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:12px;vertical-align:1px"></i>`;
const OK='#6f8f74',BAD='#a8685e',RUN='#ad9b6f';
function block(cmd,out,st,dur,o={}){return `<div style="padding:8px 18px 10px;${o.sel?'background:rgba(255,255,255,.025);':''}">
  <div style="display:flex;align-items:center;font:12.5px/1.7 var(--mono);color:#a3a8a0">${dot(st)}${PR}&nbsp;${esc(cmd)}<span style="margin-left:auto;font:300 12px var(--ui);color:#454b45">${dur}</span></div>
  <div style="padding-left:19px;font:12px/1.65 var(--mono);color:#7b8279;white-space:pre">${out.join('\n')}</div>${o.extra||''}</div>`;}
const link=t=>`<span style="color:#7fa3a3;text-decoration:underline;text-underline-offset:3px">${t}</span>`;
const tabs=(on,list)=>`<div style="display:flex;gap:20px;padding:12px 18px 6px;font:300 15px var(--ui)">${list.map(x=>`<span style="color:${x===on?'#a3a8a0':'#3a3f3a'}">${x}</span>`).join('')}<span style="color:#3a3f3a">+</span></div>`;
const H={};
H['t1-terminal']=()=>{
  const left=tabs('zsh',['zsh','build','tests'])+
   block('git status -sb',['## main...origin/main',' M src/server.cpp'],OK,'0.04 s')+
   block('cmake --preset debug',['-- Configuring done (1.2s)','-- Generating done (0.1s)','-- Build files have been written to: build/debug'],OK,'1.8 s')+
   block('ninja -C build/debug',['[38/42] Building CXX object src/CMakeFiles/server.dir/server.cpp.o','<span style="color:#a8685e">FAILED:</span> src/CMakeFiles/server.dir/server.cpp.o',`${link('src/server.cpp:46:33')}: <span style="color:#a8685e">error:</span> use of undeclared identifier 'headrs'`,'1 error generated.','ninja: build stopped: subcommand failed.'],BAD,'4.2 s',{sel:true,extra:`<div style="padding:8px 0 0 19px;font:300 13px var(--ui);color:#7fa3a3">open in build view ›</div>`})+
   `<div style="padding:8px 18px;font:12.5px var(--mono);color:#a3a8a0">${dot('#2f332f')}${PR}&nbsp;<span class="cur"></span></div>`;
  const rows=[['headers.parses_basic','Passed','0.01'],['headers.trims_values','Passed','0.01'],['router.exact_match','Passed','0.02'],['router.wildcard','***Failed','0.03'],['server.roundtrip','Passed','0.41']];
  const right=tabs('tests',['zsh','build','tests'])+
   `<div style="margin:0 0 6px;padding:8px 18px;background:#191a19;box-shadow:0 8px 16px rgba(0,0,0,.25);font:12.5px var(--mono);color:#a3a8a0;display:flex;align-items:center">${dot(RUN)}${PR}&nbsp;ctest --test-dir build/debug --output-on-failure<span style="margin-left:auto;font:300 12px var(--ui);color:#7d6f50">running · 3.1 s</span></div>`+
   `<div style="padding:4px 18px 0 37px;font:12px/1.75 var(--mono);color:#7b8279;white-space:pre">Test project /Users/dev/code/tinyhttp/build/debug
${rows.map(([n,r,t],i)=>`    Start ${i+1}: ${n}\n${i+1}/6 Test #${i+1}: ${n.padEnd(24,' ')} <span style="color:${r==='Passed'?OK:BAD}">${r==='Passed'?'✓ passed':'✕ failed'}</span>  ${t} sec`).join('\n')}
    Start 6: server.keep_alive
<span style="color:#a8685e">router_test.cpp</span>:${link('41')}: Expected equality of these values:
  match_path("/api/*", "/api/v1/users")
    Which is: false
  true</div>`;
  return `<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
   <div class="hdr">${PV('terminal',['server.cpp','build'])}<span class="right"><span>2 sessions</span><span>zsh · ctest</span></span></div>
   <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;min-height:0;background:#131413">
     <div style="min-width:0;overflow:hidden">${left}</div><div style="min-width:0;overflow:hidden;background:#141514">${right}</div></div>
   <div style="height:34px;display:flex;align-items:center;gap:26px;padding:0 18px;background:#131413;font:300 12.5px var(--ui);color:#3f453f"><span>⌘/Ctrl ↑ ↓ jump between commands</span><span>⌘/Ctrl ⇧ C copy output</span><span>⌘/Ctrl F search output</span></div></div>`;};

H['t2-build']=()=>{
  let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const files=['main','server','session','io','socket','tls','http','proto','poller','parser','lexer','planner','exec','expr','catalog','btree','wal','arena','pager','sstable','bloom','cache','manifest','iterator','txn','raft','log','snapshot','strings','hash','time','status','pool','flags','router','headers','chars','config','cli','bench','dump','checksum'];
  const SC=205,lanes=Array.from({length:8},()=>[]);let fi=0;
  lanes.forEach((L,li)=>{let x=0;while(x<4.0&&fi<files.length){const d=files[fi]==='headers'?1.9:files[fi]==='cache'?1.3:0.25+rnd()*0.6;L.push([files[fi],x,d]);x+=d+0.03;fi++;}});
  const bar=([n,x,d])=>{const c=n==='server'||n==='cache'?['#4a302c','#b8766b']:n==='headers'?['#3d382a','#ad9b6f']:['#232823','#6d746c'];
    return `<div style="position:absolute;left:${x*SC}px;width:${Math.max(2,d*SC-3)}px;top:0;bottom:0;background:${c[0]};font:300 10.5px var(--ui);color:${c[1]};padding:3px 6px;white-space:nowrap;overflow:hidden">${d*SC>46?n+'.cpp':''}</div>`;};
  const timeline=`<div style="position:relative;height:${8*20}px;width:${4.3*SC}px">${lanes.map((L,i)=>`<div style="position:absolute;left:0;right:0;top:${i*20}px;height:17px">${L.map(bar).join('')}</div>`).join('')}</div>
    <div style="position:relative;height:18px;width:${4.3*SC}px;font:300 11px var(--ui);color:#3a3f3a">${[0,1,2,3,4].map(s=>`<span style="position:absolute;left:${s*SC}px">${s} s</span>`).join('')}</div>`;
  const big=(v,l,c='#a3a8a0')=>`<div style="margin-bottom:12px"><div style="font:300 38px/1 var(--ui);color:${c};letter-spacing:-.02em">${v}</div><div style="font:300 12.5px var(--ui);color:#4f564f;margin-top:3px">${l}</div></div>`;
  const ecard=(kind,loc,msg,src,o={})=>`<div style="background:#1b1c1b;padding:12px 16px 10px;margin-bottom:10px;${o.dim?'opacity:.45':''}">
     <div style="display:flex;align-items:baseline;gap:12px;font:300 13px var(--ui)"><span style="color:${kind==='error'?'#b8766b':'#ab9070'}">${kind}</span>${o.isnew?'<span style="color:#ad9b6f;font-size:11.5px">new</span>':''}<span style="color:#7fa3a3">${loc}</span>${o.act?`<span style="margin-left:auto;color:#a3a8a0;border:1px solid #3a3f3a;padding:2px 10px">${o.act}</span>`:''}</div>
     <div style="font:300 15px/1.5 var(--ui);color:#a3a8a0;margin:4px 0 6px">${msg}</div>${src?`<div style="background:#171817">${code(src,o.c||{})}</div>`:''}${o.extra||''}</div>`;
  const errs=ecard('error','src/server.cpp:46',"use of undeclared identifier <span style=\"font-family:var(--mono);color:#b8766b\">headrs</span> — did you mean <span style=\"font-family:var(--mono)\">headers</span>?",R`auto handler = route(req.path, routes_);
Response res = handler(req, «e|headrs»);`,{act:'apply fix  ⌘/Ctrl .',c:{start:44,params:['req']}})+
   `<div style="font:300 13px var(--ui);color:#454b45;margin:-2px 0 12px 16px">2 more errors in server.cpp, probably caused by this one — hidden · show</div>`+
   ecard('error','src/cache.cpp:88',"no matching member function for call to <span style=\"font-family:var(--mono)\">emplace</span>",R`entries_.emplace(key, ttl_seconds);`,{c:{start:88},extra:`<div style="font:300 12.5px/1.8 var(--ui);color:#5f665f;margin-top:8px">on ${M('<span style="color:#7f9e82">std::map</span>&lt;<span style="color:#7f9e82">std::string</span>, <span style="color:#7f9e82">std::string</span>&gt;')} &nbsp;<span style="color:#3f453f">full type · 412 characters</span><br>› candidate ${M('emplace(Args&amp;&amp;…)')} needs a value constructible from ${M('int')}<br><span style="color:#3f453f">3 notes from system headers hidden</span></div>`})+
   ecard('warning','src/router.cpp:37','comparison of integers of different signs',R`for (int i = 0; «w|i < parts.size()»; ++i)`,{isnew:true,c:{start:37}});
  const slow=[['headers.cpp','1.9 s','+0.8 s','new include &lt;regex&gt;'],['cache.cpp','1.3 s','+0.1 s','std::map instantiations'],['wal.cpp','0.9 s','−0.2 s',''],['btree.cpp','0.8 s','±0','']];
  const side=`${big('4.2 s','total · 8 jobs')}${big('40 / 42','files compiled')}${big('2','errors','#b8766b')}${big('+2.1 KB','tinyhttp vs last build')}
    <div style="font:300 15px var(--ui);color:#4f564f;margin:20px 0 8px">slowest</div>
    ${slow.map(([f,t,d,why])=>`<div style="font:300 13px/1.45 var(--ui);margin-bottom:8px"><div style="display:flex;color:#8b9189"><span>${f}</span><span style="margin-left:auto">${t}</span><span style="width:56px;text-align:right;color:${d.startsWith('+0.8')?'#ad9b6f':'#454b45'}">${d}</span></div>${why?`<div style="color:#454b45;font-size:12px">${why}</div>`:''}</div>`).join('')}
    <div style="font:300 15px var(--ui);color:#4f564f;margin:18px 0 8px">since last build</div>
    <div style="font:300 13px/1.9 var(--ui);color:#7b8279"><div><span style="color:#ad9b6f">+ 2</span> new warnings</div><div><span style="color:#6f8f74">✓ 1</span> error fixed · router.cpp</div><div><span style="color:#454b45">= 4</span> warnings unchanged</div></div>`;
  return `<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
   <div class="hdr">${PV('build',['memory','misra','terminal'])}<span class="right"><span>ninja · build/debug</span><span>build #14</span></span></div>
   <div style="flex:1;display:grid;grid-template-columns:1fr 300px;min-height:0">
     <div style="padding:6px 26px 0;min-width:0;overflow:hidden">
       <div style="font:300 15px var(--ui);color:#4f564f;margin-bottom:8px">timeline</div>${timeline}
       <div style="font:300 15px var(--ui);color:#4f564f;margin:16px 0 8px">problems</div>${errs}</div>
     <div style="padding:6px 26px;background:#151615;overflow:hidden">${side}</div></div>
   <div style="height:54px;display:flex;align-items:center;gap:22px;padding:0 26px;background:#131413">
     <span style="font:300 15px var(--ui);color:#a3a8a0">build</span><span style="font:300 15px var(--ui);color:#3a3f3a">raw</span>
     <span style="font:12.5px var(--mono);color:#a3a8a0;margin-left:16px">${PR}&nbsp;ninja -C build/debug<span class="cur"></span></span>
     <span style="margin-left:auto;font:300 12.5px var(--ui);color:#3f453f">⌘/Ctrl R re-run · ⌥/Alt \` raw output</span></div></div>`;};

const sec=t=>`<div style="font:300 15px var(--ui);color:#4f564f;margin:0 0 10px">${t}</div>`;
function region(name,used,budget,cap,parts,o={}){const pct=used/budget,over=pct>1;const W=780,sc=W/Math.max(cap,used);
  const col=over?'#b8766b':pct>.9?'#ad9b6f':'#7f9e82';
  return `<div style="margin-bottom:22px"><div style="display:flex;align-items:baseline;gap:14px"><span style="font:300 22px var(--ui);color:#a3a8a0">${name}</span>
    <span style="font:300 14px var(--ui);color:${col}">${used.toFixed(1)} KB of ${budget} KB budget · ${Math.round(pct*100)} %${over?` · over by ${(used-budget).toFixed(1)} KB`:''}</span><span style="margin-left:auto;font:300 12px var(--ui);color:#3f453f">region ${cap} KB</span></div>
    <div style="position:relative;height:16px;margin-top:8px;width:${W}px;background:#1d1f1d">${(()=>{let x=0;return parts.map(([n,v,c])=>{const h=`<div style="position:absolute;left:${x*sc}px;width:${v*sc-1}px;top:0;bottom:0;background:${c}"></div>`;x+=v;return h;}).join('');})()}
      <div style="position:absolute;left:${budget*sc}px;top:-5px;bottom:-5px;width:2px;background:${over?'#b8766b':'#8b9189'}"></div></div>
    <div style="display:flex;gap:18px;margin-top:6px;font:300 12px var(--ui);color:#5f665f">${parts.map(([n,v,c])=>`<span><i style="display:inline-block;width:8px;height:8px;background:${c};margin-right:6px"></i>${n} ${v} KB</span>`).join('')}</div></div>`;}
H['t3-memory']=()=>{
  const rows=[['rx_ring','static uint8_t[32768]','32.0','uart.c:14',''],['sample_buf','static int16_t[8192]','16.0','adc.c:9',''],['log_buffer','static char[8192]','8.0','log.c:22','new'],['heap reserve','linker · _Min_Heap_Size','8.0','stm32f4.ld:41',''],['fs_cache','static struct Block[24]','6.0','fs.c:30','+1.5'],['net_task stack','RTOS task stack · .bss','4.0','tasks.c:12',''],['main stack','linker · _Min_Stack_Size','4.0','stm32f4.ld:42',''],['.data (rest)','212 objects','5.2','',''],['.bss (rest)','480 objects','18.2','','']];
  const mx=32;
  const list=`<div style="display:flex;gap:18px;font:300 15px var(--ui);margin-bottom:10px"><span style="color:#a3a8a0">ram</span><span style="color:#3a3f3a">flash</span><span style="color:#3a3f3a">ccm</span><span style="margin-left:auto;font-size:12.5px;color:#3f453f">largest first</span></div>`+
    rows.map(([n,k,v,f,d])=>`<div style="display:grid;grid-template-columns:150px 1fr 70px 110px;align-items:center;gap:12px;padding:6px 0;${d==='new'?'background:rgba(184,118,107,.08);margin:0 -10px;padding:6px 10px;':''}">
      <span style="font:12.5px var(--mono);color:${d==='new'?'#c9928a':'#a3a8a0'}">${n}</span>
      <span style="position:relative;height:14px"><i style="position:absolute;left:0;top:3px;height:8px;width:${parseFloat(v)/mx*100}%;background:${d==='new'?'#7a4a43':'#3a4a40'}"></i><span style="position:absolute;left:0;top:-14px;font:300 11px var(--ui);color:#3f453f;white-space:nowrap">${k}</span></span>
      <span style="font:300 13px var(--ui);color:#8b9189;text-align:right">${v} KB${d?`<div style="font-size:11px;color:${d==='new'?'#b8766b':'#ad9b6f'}">${d==='new'?'new':d+' KB'}</div>`:''}</span>
      <span style="font:300 12px var(--ui);color:#5f7f7f">${f}</span></div>`).join('');
  const alert=`<div style="background:#1f1a18;padding:12px 16px;margin-bottom:22px;font:300 14px/1.55 var(--ui);color:#c9a49c"><b style="font-weight:400;color:#d4ada5">RAM budget exceeded by 5.4 KB.</b> The largest change is <span style="font-family:var(--mono)">log_buffer</span> — 8.0 KB, new in <span style="color:#7fa3a3">log.c:22</span>. Moving it to CCM RAM (52 KB free) brings RAM to 97 %; shrinking it to 2 KB brings RAM to 99 %.</div>`;
  const stack=[['main','3.1','4.0'],['net_task','3.9','4.0'],['USART1 IRQ','0.4','+ on top'],['sensor_task','1.2','2.0']];
  const side=`${sec('stack · worst case')}${stack.map(([n,u,b])=>`<div style="display:flex;font:300 13.5px/2 var(--ui);color:#8b9189"><span style="font-family:var(--mono);font-size:12.5px">${n}</span><span style="margin-left:auto;color:${n==='net_task'?'#ad9b6f':'#8b9189'}">${u} / ${b} KB</span></div>`).join('')}
    <div style="font:300 12.5px/1.6 var(--ui);color:#5f665f;margin:6px 0 22px">deepest: net_task → http_reply → json_write → fmt_float<br><span style="color:#ad9b6f">1 unbounded</span> — recursion in parse_json (json.c:61)</div>
    ${sec('heap · dynamic allocation')}<div style="font:300 13.5px/1.9 var(--ui);color:#8b9189"><div>3 sites · no-heap mode <span style="color:#a3a8a0">on</span></div><div style="font:12px var(--mono);color:#b8766b">malloc  json.c:88</div><div style="font:12px var(--mono);color:#b8766b">malloc  fs.c:142</div><div style="font:12px var(--mono);color:#b8766b">realloc json.c:97</div></div>
    <div style="font:300 12.5px var(--ui);color:#3f453f;margin-top:22px">release · arm-none-eabi-gcc 13.2<br>from sensor-node.elf + linker map</div>`;
  return `<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
   <div class="hdr">${PV('memory',['build','misra','terminal'])}<span class="right"><span style="color:#b8766b">RAM 106 %</span><span>flash 89 %</span><span>stm32f4 · release</span></span></div>
   <div style="flex:1;display:grid;grid-template-columns:1fr 320px;min-height:0">
     <div style="padding:8px 30px;overflow:hidden">${alert}
       ${region('ram',101.4,96,128,[['.data',5.2,'#5a6f73'],['.bss',84.2,'#4e6a5a'],['heap',8,'#6e6448'],['main stack',4,'#5c5068']])}
       ${region('flash',341.2,384,512,[['.text',298,'#4e6a5a'],['.rodata',38,'#5a6f73'],['.data image',5.2,'#5c5068']])}
       ${list}</div>
     <div style="padding:8px 26px;background:#151615;overflow:hidden">${side}</div></div></div>`;};
H['t4-misra']=()=>{
  const card=(rule,cat,sum,msg,src,o={})=>`<div style="background:#1b1c1b;padding:12px 16px 10px;margin-bottom:10px">
    <div style="display:flex;align-items:baseline;gap:12px;font:300 13px var(--ui)"><span style="color:#a3a8a0;font-size:14px">${rule}</span><span style="color:${cat==='mandatory'?'#b8766b':cat==='required'?'#ad9b6f':'#739696'}">${cat}</span><span style="color:#5f665f">${sum}</span><span style="margin-left:auto;color:#7fa3a3">${o.loc}</span></div>
    <div style="font:300 15px/1.5 var(--ui);color:#a3a8a0;margin:5px 0 6px">${msg}</div><div style="background:#171817">${code(src,o.c||{})}</div>
    <div style="display:flex;gap:18px;margin-top:8px;font:300 12.5px var(--ui)">${o.fix?`<span style="color:#a3a8a0;border:1px solid #3a3f3a;padding:2px 10px">${o.fix}</span>`:''}<span style="color:#4f564f;padding:3px 0">deviate…</span></div></div>`;
  const list=card('Rule 9.1','mandatory','no reads before initialisation','<span style="font-family:var(--mono)">crc</span> is read before it is set — on the first loop pass (line 31), and at the return (line 32) when <span style="font-family:var(--mono)">len == 0</span>.',R`uint16_t crc;
for (size_t i = 0; i < len; ++i) { crc = crc16_step(«e|crc», buf[i]); }
return «e|crc»;`,{loc:'crc.c:31',fix:'initialise: uint16_t crc = 0xFFFFu;',c:{start:30}})+
   card('Rule 10.4','required','same essential type category in arithmetic and comparisons','<span style="font-family:var(--mono)">count</span> is essentially unsigned, <span style="font-family:var(--mono)">-1</span> is essentially signed — mixed categories in one comparison.',R`if («w|count > -1») {`,{loc:'uart.c:58',fix:'write count > 0u',c:{start:58}})+
   card('Rule 21.3','required','no stdlib dynamic memory','<span style="font-family:var(--mono)">malloc</span> allocates from the heap; this project runs in no-heap mode. Use the static pool <span style="font-family:var(--mono)">json_pool</span> (json.c:12).',R`node = «w|malloc»(sizeof(JsonNode));`,{loc:'json.c:88',c:{start:88}})+
   card('Rule 17.7','required','use the value a function returns','The status returned by <span style="font-family:var(--mono)">hal_write</span> is discarded; a failed write would go unnoticed.',R`«w|hal_write(port, frame, n)»;`,{loc:'uart.c:71',fix:'check it, or cast to (void) with a reason',c:{start:71}});
  const sum=`${sec('this file set')}<div style="font:300 38px/1 var(--ui);color:#a3a8a0">27</div><div style="font:300 12.5px var(--ui);color:#4f564f;margin:3px 0 16px">findings in 14 files</div>
    ${[['mandatory','2','#b8766b'],['required','19','#ad9b6f'],['advisory','6','#739696']].map(([c,n,col])=>`<div style="display:flex;font:300 14px/2 var(--ui)"><span style="color:${col}">${c}</span><span style="margin-left:auto;color:#a3a8a0">${n}</span></div>`).join('')}
    <div style="font:300 15px var(--ui);color:#4f564f;margin:22px 0 8px">most frequent</div>
    ${[['10.4','7'],['17.7','4'],['15.5','4'],['21.3','3']].map(([r,n])=>`<div style="display:flex;font:300 13.5px/1.9 var(--ui);color:#8b9189"><span>Rule ${r}</span><span style="margin-left:auto">${n}</span></div>`).join('')}
    <div style="font:300 15px var(--ui);color:#4f564f;margin:22px 0 8px">deviations</div><div style="font:300 13.5px/1.7 var(--ui);color:#8b9189">2 recorded · deviations.toml</div>
    <div style="margin-top:22px;font:300 13px var(--ui);color:#a3a8a0;border:1px solid #3a3f3a;padding:5px 12px;display:inline-block">export compliance report</div>
    <div style="font:300 12px/1.6 var(--ui);color:#3f453f;margin-top:16px">MISRA C:2023 · headlines from your licensed copy<br>fast feedback — not a qualified tool</div>`;
  return `<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
   <div class="hdr">${PV('misra',['build','memory','terminal'])}<span class="right"><span>2 mandatory · 19 required · 6 advisory</span></span></div>
   <div style="flex:1;display:grid;grid-template-columns:1fr 300px;min-height:0">
     <div style="padding:8px 30px;overflow:hidden"><div style="display:flex;gap:20px;font:300 15px var(--ui);margin-bottom:12px"><span style="color:#a3a8a0">by severity</span><span style="color:#3a3f3a">by rule</span><span style="color:#3a3f3a">by file</span></div>${list}</div>
     <div style="padding:8px 26px;background:#151615;overflow:hidden">${sum}</div></div></div>`;};

const id=new URLSearchParams(location.search).get('f')||'t2-press';
document.getElementById('root').innerHTML=H[id]();
