/* Drag directly across navigation; content gestures leave scrollable tables and editing alone. */
(()=>{
 'use strict';
 const nav=document.getElementById('nav');let hold,active=false,blockUntil=0;
 const buttons=()=>[...nav.querySelectorAll('[data-action="navigate"]')];
 const clear=()=>{active=false;hold=null;nav?.classList.remove('is-scrubbing');nav?.querySelectorAll('.nav-preview').forEach(b=>b.classList.remove('nav-preview'));};
 const preview=x=>{const list=buttons(),bounds=nav.getBoundingClientRect(),dx=x-hold.x,step=dx<0?1:-1,target=hold.origin+step,cell=bounds.width/list.length,center=cell*(hold.origin+.5),progress=Math.min(1,Math.abs(dx)/(bounds.width*.6)),valid=target>=0&&target<list.length;hold.visual=center+cell*step*(valid?progress/(1+.35*progress):progress*.14);list.forEach((b,i)=>b.classList.toggle('nav-preview',i===(valid?target:hold.origin)));nav.style.setProperty('--scrub-x',hold.visual+'px');return valid?list[target]:null;};
 nav?.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(hold&&hold.id!==e.pointerId){blockUntil=Date.now()+500;clear();return;}clear();blockUntil=0;hold={id:e.pointerId,x:e.clientX,y:e.clientY,origin:Math.max(0,buttons().findIndex(b=>b.classList.contains('active')))};});
 nav?.addEventListener('pointermove',e=>{if(!hold||e.pointerId!==hold.id)return;const dx=Math.abs(e.clientX-hold.x),dy=Math.abs(e.clientY-hold.y);if(!active){if(dy>8&&dy>dx*1.35){blockUntil=Date.now()+500;return clear();}if(dx<8||dx<dy*1.35)return;active=true;nav.classList.add('is-scrubbing');nav.setPointerCapture(hold.id);}const bounds=nav.getBoundingClientRect();if(e.clientY<bounds.top-38||e.clientY>bounds.bottom+38){blockUntil=Date.now()+500;return clear();}e.preventDefault();preview(e.clientX);});
 nav?.addEventListener('pointerup',e=>{if(!active)return clear();const target=preview(e.clientX),commit=Math.abs(e.clientX-hold.x)>36,visual=hold.visual;blockUntil=Date.now()+500;clear();if(target&&commit){target.dataset.scrubOpen='yes';target.click();delete target.dataset.scrubOpen;const list=buttons(),index=list.findIndex(b=>b.classList.contains('active')),pill=list[index]?.querySelector?.('.nav-icon'),cell=nav.getBoundingClientRect().width/list.length;if(pill?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const offset=visual-cell*(index+.5);pill.animate([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:260,easing:'cubic-bezier(.18,.85,.25,1)'});}}e.preventDefault();});
 nav?.addEventListener('pointercancel',clear);
 nav?.addEventListener('click',e=>{if(Date.now()<blockUntil&&!e.target.closest('[data-scrub-open]')){e.preventDefault();e.stopImmediatePropagation();}},true);
 let reading;
 document.addEventListener('pointerdown',e=>{
  const target=e.target.closest('#character-record');if(!target||e.target.closest('input,textarea,select,button,a')||e.pointerType==='mouse'&&e.button!==0)return;
  reading={id:e.pointerId,x:e.clientX,y:e.clientY,target,source:e.target};
 },{passive:true});
 document.addEventListener('pointerup',e=>{
  if(!reading||reading.id!==e.pointerId)return;const current=reading;reading=null;const dx=e.clientX-current.x,dy=e.clientY-current.y;
  if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.7)return;
  const scroll=current.source.closest('.replica-scroll');if(scroll&&scroll.scrollWidth>scroll.clientWidth+2&&((dx<0&&scroll.scrollLeft+scroll.clientWidth<scroll.scrollWidth-2)||(dx>0&&scroll.scrollLeft>2)))return;
  const tabs=[...document.querySelectorAll('[data-action="subtab"]')],selected=tabs.findIndex(b=>b.getAttribute('aria-pressed')==='true');if(tabs.length!==2||selected<0)return;
  tabs[1-selected].click();const next=document.getElementById('character-record');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)next?.animate([{opacity:.72,transform:`translateX(${dx<0?12:-12}px)`},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'cubic-bezier(.2,0,0,1)'});
 },{passive:true});
 document.addEventListener('pointercancel',()=>reading=null,{passive:true});
})();
