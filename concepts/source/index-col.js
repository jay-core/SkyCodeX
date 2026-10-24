/* ---------- concept: thin call index between the code and the preview cards ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const SRC=R`Response Server::handle(const Request& req) {
    auto headers = «c:i0|parse_headers»(req.raw);
    if (headers.empty())
        return Response::bad_request();
    auto handler = «c:i1|route»(req.path, routes_);
    Response res = handler(req, headers);
    «c:i2|apply_cors»(res, allowed_origins_);
    if («c:i3|keep_alive»(req))
        res.headers.set("Connection", "keep-alive");
    «c:i4|compress»(res, req.accept_encoding);«cur|»
    «c:i5|send_response»(socket_, res);
    metrics_.«c:i6|record»(req.path, res.status);
    socket_.«c:i7|close»();
    return res;
}`;
const NAMES=['parse_headers','route','apply_cors','keep_alive','compress','send_response','record','close'];
const VISIBLE=new Set([2,3,4,5]);   // the column is scrolled so cards 3–6 are in view
const COL=['#ad9b6f','#7f9e82','#a8929e','#739696','#ab9070','#b8766b','#8f9aa8','#9aa86f'];
const CARDS={2:[`apply_cors`,'http/cors.cpp:8',R`void apply_cors(Response& r, const Origins& o) {
    if (o.empty()) return;
    r.headers.set("Access-Control-Allow-Origin", o.front());
}`,8],3:[`keep_alive`,'http/headers.cpp:40',R`bool keep_alive(const Request& req) {
    auto c = req.headers.get("Connection");
    return c ? iequals(*c, "keep-alive")
             : req.version >= Http11;
}`,40],4:[`compress`,'http/gzip.cpp:15',R`void compress(Response& r, sv accept) {
    if (r.body.size() < 1024 || !accepts_gzip(accept))
        return;
    r.body = gzip(r.body);
    r.headers.set("Content-Encoding", "gzip");
}`,15],5:[`send_response`,'net/io.cpp:58',R`void send_response(Socket& s, const Response& r) {
    auto bytes = r.serialize();
    write_all(s, bytes.data(), bytes.size());
}`,58]};
const idx=NAMES.map((n,i)=>{const vis=VISIBLE.has(i),above=i<2,lit=i===4;
  return `<div class="ix" id="ix${i}" style="position:relative;display:flex;align-items:center;justify-content:flex-end;gap:8px;height:30px;padding:0 6px 0 12px;${lit?'background:#222320;box-shadow:inset -2px 0 '+COL[i]+';':''}">
    <span style="position:absolute;left:12px;font:11px var(--mono);color:#3f453f">${i+1}</span>
    <span class="nm" style="font:12px var(--mono);color:${lit?'#c3c8c0':vis?'#9ea39b':'#5f665f'};white-space:nowrap">${n}</span>
    <i class="dot" style="width:5px;height:5px;border-radius:50%;background:${COL[i]};flex:none;opacity:${vis?1:.55}"></i>
    <span style="width:10px;flex:none;font:300 12px var(--ui);color:${COL[i]};opacity:.85">${vis?'':above?'↑':'↓'}</span></div>`;}).join('');
const cards=[2,3,4,5].map(i=>{const [n,loc,src,start]=CARDS[i];const lit=i===4;
  return `<div class="card${lit?' focus':''}" id="cd${i}" style="${lit?'box-shadow:inset 2px 0 '+COL[i]+';background:#222320':''}"><div class="card-h"><span class="sw" style="background:${COL[i]}"></span><span class="nm"${lit?' style="color:#c3c8c0"':''}>${n}</span><span class="loc">${loc}</span></div>${code(src,{start,params:['r','o','req','accept','s']})}</div>`;}).join('');
document.getElementById('root').innerHTML=`<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
 <div class="hdr">${PV('server.cpp',['headers.cpp'],'Server::handle')}<span class="right" style="margin-right:112px"><span>33:31</span><span>clangd ready</span></span></div>
 <div style="flex:1;display:flex;min-height:0;position:relative" id="body">
  <div class="pane" style="width:520px;flex:none" id="codep">${code(SRC,{start:24,active:33,params:['req'],dim:[24,38]})}</div>
  <div id="index" style="width:196px;flex:none;background:#131413;position:relative">
    <div class="ph" style="font-size:13px">calls · 8</div>
    <div style="position:absolute;top:36px;left:0;right:0">${idx}</div>
    <div style="position:absolute;left:12px;right:10px;bottom:52px;font:300 11.5px/1.5 var(--ui);color:#3f453f">click a name to scroll<br>its card into view</div>
  </div>
  <div class="pane prev" style="flex:1;align-self:stretch;position:relative" id="pva">
    <div class="ph"><span style="font-size:18px;color:var(--bright);text-transform:none">Server::handle</span><span class="grow"></span><span style="font-size:12px;color:#3f453f">cards 3–6 of 8</span></div>
    <div id="cards" style="position:absolute;top:36px;left:0;right:0;bottom:40px;overflow:hidden"><div class="cards" style="padding-left:40px;padding-top:6px">${cards}</div></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:40px;display:flex;align-items:center;gap:24px;padding:0 22px;font:300 13.5px var(--ui);color:#4f564f"><span style="opacity:.35">‹ source</span><span style="font-size:12.5px;color:#3a3f3a">levels 1–2</span><span style="flex:1"></span><span>shift preview ›</span></div>
  </div>
  <div class="pane files" style="width:190px;flex:none">${tree(TREE_MAIN.replace('server.cpp|act|mod','server.cpp|act'))}</div>
  <svg id="lk" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible" width="1440" height="900"></svg>
 </div>
 <div class="term" style="height:30px;border:0"><div class="tt"><span class="on">zsh</span><span>+</span><span class="grow"></span><span>hide terminal</span><span style="font-size:16px">···</span></div></div></div>`;
// connectors: call site → its name in the index → its card (when the card is in view)
const B=document.getElementById('body').getBoundingClientRect(), rel=(r)=>({l:r.left-B.left,r:r.right-B.left,t:r.top-B.top,b:r.bottom-B.top,cy:(r.top+r.bottom)/2-B.top});
const codeR=rel(document.getElementById('codep').getBoundingClientRect()), idxR=rel(document.getElementById('index').getBoundingClientRect());
let svg='';
NAMES.forEach((n,i)=>{
  const call=document.querySelector(`[data-call="i${i}"]`), item=document.getElementById('ix'+i);
  const c=rel(call.getBoundingClientRect()), it=rel(item.getBoundingClientRect());
  const rg=document.createRange(); rg.selectNodeContents(call.closest('.t')); const te=rel(rg.getBoundingClientRect());
  call.style.textDecoration=`underline ${COL[i]} 1.5px`; call.style.textUnderlineOffset='4px';
  const nm=rel(item.querySelector('.nm').getBoundingClientRect()), dot=rel(item.querySelector('.dot').getBoundingClientRect());
  const x1=Math.max(c.r+4,te.r+12), xe=codeR.r-6, x2=nm.l-12, y1=c.cy, y2=it.cy, k=Math.max(22,(x2-xe)*.5);
  svg+=`<path d="M${x1} ${y1} L${xe} ${y1}" stroke="${COL[i]}" stroke-width="0.8" stroke-dasharray="1.5 4" opacity=".45" fill="none"/><circle cx="${x1}" cy="${y1}" r="1.8" fill="${COL[i]}"/>`;
  svg+=`<path d="M${xe} ${y1} C${xe+k} ${y1} ${x2-k} ${y2} ${x2} ${y2}" stroke="${COL[i]}" stroke-width="0.9" opacity=".7" fill="none"/><circle cx="${x2}" cy="${y2}" r="1.6" fill="${COL[i]}" opacity=".8"/>`;
  if (VISIBLE.has(i)) {
    // the line ends on the card's own colour dot, so the eye lands on the right card at once
    const sw=rel(document.querySelector(`#cd${i} .card-h .sw`).getBoundingClientRect());
    const a=dot.r+22, b=sw.l-1, yb=sw.cy, kk=Math.max(22,(b-a)*.5);
    svg+=`<path d="M${a} ${y2} C${a+kk} ${y2} ${b-kk} ${yb} ${b} ${yb}" stroke="${COL[i]}" stroke-width="1" opacity=".75" fill="none"/>`;
  }
});
document.getElementById('lk').innerHTML=svg;
