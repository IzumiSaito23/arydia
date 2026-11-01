/* The browser hosts the same battle runtime and portable record as the app. */
(()=>{'use strict';
 let opened=false,leaving=false;
 const host=()=>window.CampaignHost;
 function open(){if(host().page()==='combat95')return;history.pushState({...history.state,arydiaCombat95:true},'');opened=true;host().go('combat95');}
 function leave(){if(history.state?.arydiaCombat95)history.back();else{opened=false;host().go('map');}}
 function mount(page){
  if(page==='combat95')return;
  if(opened){opened=false;leaving=true;if(history.state?.arydiaCombat95)history.back();else leaving=false;}
  if(page!=='map'||document.querySelector('[data-combat95-open]'))return;
  const top=document.querySelector('.camp-map-top');if(!top)return;
  const button=document.createElement('button');button.type='button';button.className='btn small combat95-entry';button.dataset.combat95Open='';button.textContent='战斗';button.onclick=open;top.prepend(button);
 }
 function applyTheme(doc){const css=getComputedStyle(document.documentElement),root=doc.documentElement;for(const key of['paper','card','surface','ink','pine','sage','line','muted','accent']){const value=css.getPropertyValue('--'+key);if(value.trim())root.style.setProperty('--'+key,value);}root.style.colorScheme=document.documentElement.dataset.theme==='dark'?'dark':'light';}
 window.Combat95Web={open,mount,applyTheme,view:()=>'<section class="combat95-page"><iframe id="combat95-frame" title="战斗记录" src="combat95/index.html" sandbox="allow-scripts allow-same-origin"></iframe></section>',load:()=>host().loadCombat95(),save:raw=>{try{return host().saveCombat95(JSON.parse(raw));}catch(e){return e.message||'战斗记录未能保存';}},close:leave};
 window.addEventListener('popstate',()=>{if(leaving){leaving=false;return;}if(host()?.page()!=='combat95')return;const frame=document.getElementById('combat95-frame')?.contentWindow,doc=frame?.document,nested=!!frame?.CombatApp&&(!!doc.querySelector('#modal:not([hidden])')||doc.getElementById('field')?.hidden);if(nested){frame.CombatApp.back();history.pushState({...history.state,arydiaCombat95:true},'');return;}opened=false;host().go('map');});
})();
