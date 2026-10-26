/* Hold and scrub navigation; content gestures leave scrollable tables and editing alone. */
(()=>{
 'use strict';
 const nav=document.getElementById('nav');let timer,hold,active=false,blockUntil=0;
 const clear=()=>{clearTimeout(timer);timer=null;active=false;hold=null;nav?.classList.remove('is-scrubbing');nav?.querySelectorAll('.nav-preview').forEach(b=>b.classList.remove('nav-preview'));};
 const preview=x=>{const buttons=[...nav.querySelectorAll('[data-action="navigate"]')],bounds=nav.getBoundingClientRect();if(!buttons.length)return;const index=Math.max(0,Math.min(buttons.length-1,Math.floor((x-bounds.left)/bounds.width*buttons.length)));buttons.forEach((b,i)=>b.classList.toggle('nav-preview',i===index));nav.style.setProperty('--scrub-x',Math.max(28,Math.min(bounds.width-28,x-bounds.left))+'px');return buttons[index];};
 nav?.addEventListener('pointerdown',e=>{if(e.button!==0)return;clear();hold={id:e.pointerId,x:e.clientX,y:e.clientY};timer=setTimeout(()=>{if(!hold)return;active=true;nav.classList.add('is-scrubbing');nav.setPointerCapture(hold.id);preview(hold.x);},450);});
 nav?.addEventListener('pointermove',e=>{if(!hold)return;if(!active){if(Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>8)clear();return;}e.preventDefault();preview(e.clientX);});
 nav?.addEventListener('pointerup',e=>{if(!active)return clear();const button=preview(e.clientX);blockUntil=Date.now()+500;clear();if(button){button.dataset.scrubOpen='yes';button.click();delete button.dataset.scrubOpen;}e.preventDefault();});
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
