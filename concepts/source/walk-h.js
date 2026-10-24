/* ---------- horizontal (side-to-side) page transitions for settings ---------- */
const rotSeek=window.seek;
window.seek=function(t){
  rotSeek(t);
  if(t<11.0)return;
  const set=document.getElementById('set'),WD=1440,lk=document.getElementById('lk');
  [HDR,BODY,...SI].forEach(e=>e.style.opacity=1);set.style.background='none';
  if(t<15.6){
    const p=(k,d=0.6)=>expo(clamp((t-11.0-k)/d));
    const e=p(0,0.65);HDR.style.transform=BODY.style.transform=`translateX(${-WD*e}px)`;
    set.style.opacity=1;
    SI.forEach((s,k)=>s.style.transform=`translateX(${WD*(1-e)+90*k*(1-e)}px)`);
    if(p(0)>0)lk.style.opacity=0;
  }else{
    const p=(k,d=0.6)=>expo(clamp((t-15.6-k)/d));
    const e=p(0,0.65);SI.forEach((s,k)=>s.style.transform=`translateX(${WD*e+(SI.length-1-k)*-70*e*(1-e)}px)`);
    set.style.opacity=e>0.999?0:1;
    HDR.style.transform=BODY.style.transform=`translateX(${-WD*(1-e)-90*(1-e)*e}px)`;
  }
};
seek(0);
