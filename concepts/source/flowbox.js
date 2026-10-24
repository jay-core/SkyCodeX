/* ---------- flow as boxes and arrows: hover lists, click opens preview ---------- */
const PV=(on,offs=[],fn='')=>`<span class="pv"><span class="on">${on}</span>${fn?`<span class="fn">${fn}</span>`:''}${offs.map(o=>`<span class="off">${o}</span>`).join('')}</span>`;
const clamp=x=>Math.max(0,Math.min(1,x)),expo=p=>p>=1?1:1-Math.pow(2,-10*p),inC=p=>p*p*p,lerp=(a,b,p)=>a+(b-a)*p;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const BX=[['main','main.cpp',40,300,[['1','main'],['','print_usage']],'entry'],
  ['config','config.cpp',290,120,[['2','Config::load'],['3','read_env'],['','Config::save']]],
  ['server','server.cpp',290,330,[['4','Server::start'],['6','Server::handle'],['14','Server::stop'],['','Server::reload'],['','Server::~Server']]],
  ['io','net/io.cpp',560,110,[['5','Socket::accept'],['12','send_response'],['13','write_all'],['','Socket::set_nodelay']]],
  ['headers','http/headers.cpp',560,300,[['7','parse_headers'],['','parse_cookie'],['','keep_alive']]],
  ['router','router.cpp',560,480,[['10','route'],['11','match_path'],['','Router::dump']]],
  ['strings','util/strings.cpp',790,300,[['8','split'],['9','trim'],['','to_lower'],['','join']]],
  ['metrics','metrics.cpp',290,610,[['t1','Metrics::run'],['t2','Metrics::flush'],['t3','write_file']],'thread'],
  ['cgi','legacy/cgi.cpp',560,690,[['','cgi_main'],['','cgi_env']],'dead'],['bench','tools/bench.cpp',760,690,[['','bench_main']],'dead']];
const BW=176,BH=66;
const AR=[['main','config','2',1],['main','server','4 · 14',2],['server','io','5 · 12',3],['server','headers','7',4],['headers','strings','8 · 9',5],['server','router','10',6],['server','metrics','spawns thread',7,'v']];
const box=([id,f,x,y,fs,kind])=>{const run=fs.filter(r=>r[0]).length;return `<div class="bx" id="b-${id}" style="position:absolute;left:${x}px;top:${y}px;width:${BW}px;height:${BH}px;border:1.5px solid ${kind==='dead'?'#2a2d2a':'#3f453f'};background:#1a1b1a;padding:9px 12px">
  ${kind==='entry'?'<div style="position:absolute;left:-30px;top:22px;font:300 12px var(--ui);color:#ad9b6f">start ▸</div>':''}${kind==='thread'?'<div style="position:absolute;left:0;top:-20px;font:300 12px var(--ui);color:#7a6f8a">thread</div>':''}
  <div style="font:300 16px var(--ui);color:${kind==='dead'?'#4a4f4a':'#a3a8a0'}">${f}</div><div style="font:300 12px var(--ui);color:#4f564f;margin-top:2px">${fs.length} functions · ${kind==='dead'?'none run':run+' run'}</div></div>`;};
const pop=([id,f,x,y,fs])=>`<div class="hp" id="h-${id}" style="position:absolute;left:${x}px;top:${y+BH+8}px;min-width:${BW+40}px;background:#222422;box-shadow:0 18px 40px rgba(0,0,0,.55);padding:8px 0;z-index:8;opacity:0">
  ${fs.map(([nm,fn])=>`<div style="display:flex;gap:12px;padding:3px 14px;font:13px var(--mono)"><span style="width:22px;text-align:right;color:${nm?'#c9b98f':'transparent'}">${nm||'·'}</span><span style="color:${nm?'#a3a8a0':'#4a4f4a'}">${fn}</span></div>`).join('')}</div>`;
const SV=R`void Server::start() {
    socket_.listen(port_);
    std::thread(&Metrics::run, &metrics_).detach();
    while (running_) {
        auto conn = socket_.accept();
        handle(conn);
    }
}`;
const SH=R`Response Server::handle(const Request& req) {
    auto headers = parse_headers(req.raw);
    if (headers.empty())
        return Response::bad_request();
    auto handler = route(req.path, routes_);
    Response res = handler(req, headers);
    send_response(socket_, res);
    return res;
}`;
const SS=R`void Server::stop() {
    running_ = false;
    socket_.close();
}`;
const numCard=(n,name,loc,src,start,params)=>`<div class="pc">${card(name,loc,src,{title:`<span style="font:13px var(--mono);color:#c9b98f;margin-right:10px">${n}</span>${name}`,c:{start,params}})}</div>`;
const preview=`<div style="padding:14px 20px 0"><div class="pc" style="font:300 30px var(--ui);color:#a3a8a0">server.cpp</div><div class="pc" style="font:300 13px var(--ui);color:#4f564f;margin:2px 0 14px">3 of 5 functions run in this flow · in execution order</div></div>
  <div class="cards" style="padding-left:20px">${numCard('4','Server::start','server.cpp:30',SV,30,[])}${numCard('6','Server::handle','server.cpp:39',SH,39,['req'])}${numCard('14','Server::stop','server.cpp:61',SS,61,[])}
  <div class="pc" style="font:300 13px/1.9 var(--ui);color:#3f453f;padding:2px 4px">Server::reload — not run in this flow<br>Server::~Server — not run in this flow</div></div>`;
document.getElementById('root').innerHTML=`<div class="win" style="position:absolute;inset:0;border-radius:0;box-shadow:none">
 <div class="hdr">${PV('flow',['atlas','book','server.cpp'])}<span class="right"><span>tinyhttp · 2 entry points · 2 files not reached</span></span></div>
 <div style="flex:1;display:flex;min-height:0">
  <div id="cv" style="width:990px;position:relative;flex:none">
   <svg id="asv" width="990" height="844" style="position:absolute;left:0;top:0;overflow:visible"></svg>
   ${BX.map(box).join('')}
   <div id="nr" style="position:absolute;left:560px;top:662px;font:300 13px var(--ui);color:#3f453f">not reached from any entry point</div>
   <div id="lp" style="position:absolute;left:290px;top:404px;font:300 12.5px var(--ui);color:#5f8a8a">↻ 5–13 repeat until !running_</div>
   ${BX.map(pop).join('')}
  </div>
  <div id="pp" style="flex:1;position:relative;background:var(--prev);overflow:hidden"><div id="ph0" style="position:absolute;inset:0;display:grid;place-items:center;font:300 14px var(--ui);color:#2f332f">click a box to see what’s inside</div><div id="ppc" style="position:absolute;inset:0">${preview}</div></div>
 </div>
 <svg id="ptr" width="22" height="30" viewBox="0 0 22 30" style="position:absolute;z-index:40;left:0;top:0"><path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 16 L20 16 Z" fill="#e8ebe4" stroke="#171817" stroke-width="1.5"/></svg>
 <div id="cap" style="position:absolute;left:40px;bottom:30px;z-index:30;font:300 17px var(--ui);color:#7b8279"></div></div>`;
const colour={};$$('#ppc [data-card]').forEach((c,i)=>{c.querySelector('.sw').style.background=PAL[i];});
const B=id=>{const e=$('#b-'+id),c=$('#cv').getBoundingClientRect(),r=e.getBoundingClientRect();return {l:r.left-c.left,r:r.right-c.left,t:r.top-c.top,b:r.bottom-c.top,cx:(r.left+r.right)/2-c.left,cy:(r.top+r.bottom)/2-c.top};};
const NS='http://www.w3.org/2000/svg',asv=$('#asv');
const arrows=AR.map(([a,b,lab,ord,v])=>{const A=B(a),Z=B(b);let d,x2,y2,ang;
  if(v){d=`M${A.cx} ${A.b} C${A.cx} ${A.b+60} ${Z.cx} ${Z.t-60} ${Z.cx} ${Z.t-2}`;x2=Z.cx;y2=Z.t-2;ang=90;}
  else{const x1=A.r,y1=A.cy;x2=Z.l-2;y2=Z.cy;const k=Math.max(30,(x2-x1)*.5);d=`M${x1} ${y1} C${x1+k} ${y1} ${x2-k} ${y2} ${x2} ${y2}`;ang=0;}
  const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke-width','1.5');if(v)p.setAttribute('stroke-dasharray','5 4');asv.appendChild(p);
  const L=p.getTotalLength(),mid=p.getPointAtLength(L/2);
  const head=document.createElementNS(NS,'path');head.setAttribute('d','M0 0 L-9 -5 L-9 5 Z');head.setAttribute('transform',`translate(${x2} ${y2}) rotate(${ang})`);asv.appendChild(head);
  const g=document.createElement('div');g.className='al';g.textContent=lab;g.style.cssText=`position:absolute;left:${mid.x}px;top:${mid.y}px;transform:translate(-50%,-50%);background:#171817;padding:1px 7px;font:${v?'300 12px var(--ui)':'12.5px var(--mono)'};color:#c9b98f;white-space:nowrap;z-index:3`;$('#cv').appendChild(g);
  return {a,b,p,head,g,L,ord,v};});
const PT=[[1060,820,0],[1060,820,4.5],[640,330,5.3],[640,330,6.6],[370,362,7.2],[370,362,8.55],[370,362,99]];
function ptrAt(t){let i=0;while(i<PT.length-2&&t>PT[i+1][2])i++;const [x0,y0,t0]=PT[i],[x1,y1,t1]=PT[i+1];const p=expo(clamp((t-t0)/Math.max(0.01,(t1-t0))));
  const x=lerp(x0,x1,p),y=lerp(y0,y1,p)+56;const cl=t>8.55&&t<8.75;$('#ptr').style.transform=`translate(${x}px,${y}px) scale(${cl?0.86:1})`;$('#ptr').style.opacity=t<4.4?0:clamp((t-4.4)/0.3);}
const CAPS=[[0.3,4.6,'flow as boxes and arrows — the numbers give the order things run in'],[4.6,8.5,'hover a box: its functions, numbered in execution order · no number means it doesn’t run in this flow'],[8.5,99,'click: the box’s contents open in the preview pane, in the same order']];
window.TOTAL=12.5;
window.seek=function(t){
  const hov=t>=5.3&&t<6.6?'headers':t>=7.2&&t<8.6?'server':null,sel=t>=8.6?'server':null;
  BX.forEach(([id],k)=>{const e=$('#b-'+id),p=clamp((t-0.2-k*0.09)/0.45);e.style.opacity=p;e.style.transform=`translateY(${(1-expo(p))*16}px)`;
    const lit=(hov===id||sel===id);e.style.borderColor=lit?'#ad9b6f':'';e.style.background=lit?'#1f201d':'';});
  arrows.forEach(ar=>{const s=1.3+ar.ord*0.38,p=expo(clamp((t-s)/0.45));const touches=!hov&&!sel?1:(ar.a===(hov||sel)||ar.b===(hov||sel))?1:0.25;
    const col=touches===1&&(hov||sel)?'#ad9b6f':'#5f665f';
    ar.p.setAttribute('stroke',col);ar.p.setAttribute('stroke-dashoffset',ar.v?0:ar.L*(1-p));if(!ar.v)ar.p.setAttribute('stroke-dasharray',ar.L);ar.p.style.opacity=(ar.v?p:1)*touches;
    ar.head.setAttribute('fill',col);ar.head.style.opacity=clamp((p-0.85)/0.15)*touches;ar.g.style.opacity=clamp((t-s-0.25)/0.3)*touches;});
  $('#nr').style.opacity=clamp((t-3.9)/0.4);$('#lp').style.opacity=clamp((t-4.1)/0.4);
  BX.forEach(([id])=>{const h=$('#h-'+id),on=hov===id;const p=on?clamp((t-(id==='headers'?5.35:7.25))/0.3):0;h.style.opacity=expo(p);h.style.transform=`translateY(${(1-expo(p))*10}px)`;});
  ptrAt(t);
  $('#ph0').style.opacity=t<8.6?1:1-clamp((t-8.6)/0.2);
  $$('#ppc .pc').forEach((e,k)=>{const p=clamp((t-8.7-k*0.08)/0.55);e.style.opacity=Math.min(1,p*1.6);e.style.transformOrigin='left center';e.style.transform=`perspective(900px) rotateY(${70*(1-expo(p))}deg)`;});
  const c=CAPS.find(([a,b])=>t>=a&&t<b)||[0,0,''],cap=$('#cap');cap.textContent=c[2];cap.style.opacity=Math.min(clamp((t-c[0])/0.35),clamp((c[1]-t)/0.3));cap.style.transform=`translateX(${(1-expo(clamp((t-c[0])/0.6)))*40}px)`;
};
seek(0);
