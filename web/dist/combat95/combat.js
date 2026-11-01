(()=>{'use strict';const B=Combat95,D=COMBAT_DATA,$=id=>document.getElementById(id),E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,loadError=null,history=[],page='field',result=null,entry=null,manual=false,position=0,velocity=0,target=0,frame=0,last=0,drag=null,draft=null,node=0,nodeTier=0,builderHistory=[],builderDrag=null,trayStamp="",builderCamera=null,builderCameraTarget=null,builderCameraFrame=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;let shelfOpen=false,shelfProgress=0,shelfTween=0,fxToken=0,fxTimers=[],fxAnimations=[],fxBusy=false,visualMarks=null,fxFrame=0,fxScenes=[];
try{const raw=window.AndroidCombat?window.AndroidCombat.load():localStorage.getItem('arydia-combat95');state=raw?B.validate(JSON.parse(raw),D.templates):B.defaults();}catch(e){loadError=e;state=B.defaults();}history=state.undo||[];position=target=state.selected||0;
const spriteCache=new Map();function warmSprite(src){if(!spriteCache.has(src)){const im=new Image();im.src=src;spriteCache.set(src,im.decode().catch(()=>{}));}return spriteCache.get(src);}['fx/printed-points.webp','fx/wound.png'].forEach(warmSprite);
const current=()=>state.foes[state.selected],template=f=>D.templates.find(t=>t.key===f.template),attack=()=>state.attacks.find(w=>w.id===state.attack)||state.attacks[0];
function save(){if(loadError)throw Error('原战斗记录未能读取，已保留原始数据');const s=B.validate(state,D.templates),json=JSON.stringify(s);if(window.AndroidCombat){const message=window.AndroidCombat.save(json);if(message)throw Error(message);}else localStorage.setItem('arydia-combat95',json);}
function transaction(fn){const before=B.base(state),oldHistory=state.undo||[];try{fn();state.undo=[...oldHistory,before].slice(-30);while(JSON.stringify(state).length>640000&&state.undo.length)state.undo.shift();save();history=state.undo;$('undo').disabled=!history.length;}catch(e){state={...before,undo:oldHistory};history=oldHistory;toast(e.message);return false;}return true;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('on'),2300);}
function show(next){
 if(next==='models'){enemyEntry();return;}
 cancelEffects();if(page==='editor'&&next!=='editor')draft=null;
 if(builderCameraFrame){cancelAnimationFrame(builderCameraFrame);builderCameraFrame=0;}
 page=next;for(const p of ['field','models','attacks','editor'])$(p).hidden=p!==next;
 document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.page===(next==='editor'?'attacks':next)));$('tabs').hidden=false;
 if(next==='attacks')attacks();if(next==='field')requestAnimationFrame(()=>{layout();paint();});
}
function enemyEntry(){
 modal('添加敌人','<p>输入实体卡上的敌人编号，未加入前不显示名字和卡面。</p><form class="enemy-entry" id="numeric-entry"><input id="numeric-code" aria-label="敌人编号" inputmode="numeric" autocomplete="off" placeholder="敌人编号，例如 115"><button class="primary">查找</button></form><div id="enemy-suggestions" class="enemy-suggestions"></div><p id="numeric-error"></p>');
 const query=$('numeric-code');query.oninput=()=>{
  const value=query.value.trim().replace(/^敌人\s*[-－]?\s*/,'');
  const rows=value&&/^\d+$/.test(value)?D.enemies.filter(e=>e.id===String(+value)):[];
  $('enemy-suggestions').innerHTML=rows.map(e=>`<button data-enemy="${E(e.id)}">敌人-${E(e.id)}${e.quantity?`<small>${e.quantity} 个${e.size?' · '+E(e.size):''}</small>`:''}</button>`).join('');$('numeric-error').textContent='';
 };
 $('numeric-entry').onsubmit=e=>{e.preventDefault();findEnemy(query.value,'numeric-error');};
 setTimeout(()=>query.isConnected&&query.focus(),170);
}
function findEnemy(value,errorId){const code=value.trim().replace(/^敌人\s*[-－]?\s*/,'');const enemy=/^\d+$/.test(code)&&D.enemies.find(e=>e.id===String(+code));if(enemy){chooseEnemy(enemy.id);return true;}$(errorId).textContent='请输入卡面上已收录的敌人编号。';return false;}
function modal(title,html){$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal').hidden=false;}
function close(){$('modal').hidden=true;$('modal-body').innerHTML='';}
function models(){const query=$('model-search').value.trim().replace(/^(敌人|FOE)[\s-]*/i,'').toUpperCase(),code=/^\d+$/.test(query)?String(+query):query;$('model-grid').innerHTML=D.enemies.filter(e=>!code||e.id===code).map(e=>`<button class="model-option" data-enemy="${E(e.id)}"><b>敌人-${E(e.id)}</b>${e.quantity?`<span>${e.quantity} 个${e.size?' · '+E(e.size):''}</span>`:''}</button>`).join('');}
function chooseEnemy(id){
 const code='FOE-'+id,ts=D.templates.filter(t=>t.cardId===code),hasPrimary=ts.some(t=>!t.scene&&!t.reference);
 const choices=ts.length>1?`<div class="card-choices">${ts.map((t,i)=>`<label><input type="checkbox" data-template="${E(t.key)}" ${(!t.scene&&!t.reference||!hasPrimary&&i===0)?'checked':''}><span>${E(t.sceneLabel||(t.reference?'参考卡面':t.variant+'号 · '+t.name))}</span></label>`).join('')}</div>`:'';
 modal(`敌人-${id}`,`<p>按实体敌人卡选择本场的目标，分别保留损伤记录。</p>${choices}<button class="primary" id="join">加入战场</button><p id="join-error" class="error"></p>`);
 $('join').onclick=()=>{
  if(!ts.length){$('join-error').textContent='这张卡尚未完成核对，暂不加入。';return;}
  const picked=ts.length===1?ts:ts.filter(t=>[...document.querySelectorAll('[data-template]:checked')].some(e=>e.dataset.template===t.key));
  if(!picked.length){$('join-error').textContent='请至少选择一张卡面。';return;}
  const incoming=picked.filter(t=>!state.foes.some(f=>f.template===t.key));
  if(state.foes.length+incoming.length>24){$('join-error').textContent='战场最多记录24个目标';return;}
  const first=state.foes.findIndex(f=>f.template===picked[0].key);
  if(!incoming.length){close();show('field');select(first);toast('已在战场中，保留原有记录');return;}
  if(transaction(()=>{const start=state.foes.length;for(const t of incoming)state.foes.push(B.instance(t,t.variant));state.selected=first>=0?first:start;})){close();position=target=state.selected;renderCards();show('field');}
 };
}

function cardLettering(t){
 if(!t.textOverlay)return '';
 const v=t.textOverlay,W=t.width,H=t.height,wide=W>H,cs=v.classes||[],note=v.note;
 const code=v.noCode?'':wide?`<text transform="translate(${W*.054} ${H*.156}) rotate(-90)" font-size="28" dominant-baseline="central">${E(v.cardId)}</text>`:`<text x="${W*.85}" y="${H*.059}" font-size="28">${E(v.cardId)}</text>`;
 const type='<g fill="white" font-family="serif" font-weight="600" stroke="#101914" stroke-width=".7" paint-order="stroke" text-anchor="middle">';
 const main=v.noFooter?'':`${type}<text x="${W*.535}" y="${H*.952}" font-size="40">${E(v.name)}</text>${cs.map((c,i)=>`<text x="${W*(wide?.89:.88)}" y="${H*(cs.length===1?.95:i===0?(wide?.855:.89):.95)}" font-size="28">${E(c)}</text>`).join('')}${code}</g>`;
 const header=v.header?`${type}<text x="${W*.355}" y="${H*.061}" font-size="34">${E(v.name)}</text>${code}</g>`:'';
 const words=line=>E(line).replace(/◎|♥|×|敏捷/g,word=>`<tspan fill="${word==='♥'||word==='×'?'#b62d38':'#50764e'}" font-weight="700">${word}</tspan>`);
 const body=note?`<g fill="${E(note.color||'#492f28')}" font-family="serif" font-size="${note.size||24}" text-anchor="${note.anchor==='start'?'start':'middle'}">${note.lines.map((line,i)=>`<text x="${W*note.x}" y="${H*(note.y+i*note.lineHeight)}">${words(line)}</text>`).join('')}</g>`:'';
 const labels=(v.labels||[]).map(l=>`<text x="${W*l.x}" y="${H*l.y}" font-family="serif" font-size="${l.size||26}" fill="${E(l.color||'#241f18')}" text-anchor="${l.anchor==='start'?'start':'middle'}">${words(l.text)}</text>`).join('');
 return `<svg class="card-lettering" viewBox="0 0 ${W} ${H}" aria-hidden="true">${main}${header}${body}${labels}</svg>`;
}

function renderCards(){
 cancelEffects();const list=$('cards');list.innerHTML=state.foes.map((f,i)=>{const t=template(f);return `<div class="foe-card" data-foe="${i}" style="aspect-ratio:${t.width}/${t.height}"><img src="${E(t.image)}" alt="${E(t.name)} · ${f.index}号血量图" draggable="false" decoding="async" ${t.imageRotation?`style="position:absolute;left:50%;top:50%;width:${t.height/t.width*100}%;height:${t.width/t.height*100}%;transform:translate(-50%,-50%) rotate(90deg)"`:''}>${cardLettering(t)}<svg class="overlay" viewBox="0 0 ${t.width} ${t.height}" data-overlay="${i}"></svg><canvas class="hit-fx" aria-hidden="true"></canvas></div>`;}).join('');
 list.querySelectorAll('img').forEach(img=>Promise.all([img.decode(),template(state.foes[+img.parentElement.dataset.foe]).repair?warmSprite(template(state.foes[+img.parentElement.dataset.foe]).repair.file):Promise.resolve()]).then(()=>{if(img.isConnected)img.parentElement.classList.add('is-ready');}).catch(()=>{if(img.isConnected)img.parentElement.classList.add('load-error');}));
 $('empty').hidden=state.foes.length>0;document.querySelector('.stage-tools').hidden=!state.foes.length;
 $('controls').style.visibility=state.foes.length||history.length?'visible':'hidden';layout();paint();
}
function layout(){
 const width=$('stage').clientWidth,height=$('stage').clientHeight,step=width*.97;
 document.querySelectorAll('.foe-card').forEach((card,i)=>{const t=template(state.foes[i]),baseWidth=Math.min(width*.955,Math.max(60,height-43)*t.width/t.height),baseHeight=baseWidth*t.height/t.width,d=i-position,scale=1-Math.min(Math.abs(d),1)*.09;
  card.style.width=baseWidth+'px';card.style.height=baseHeight+'px';card.style.transform=`translate(calc(-50% + ${d*step}px),calc(-50% + 10px)) perspective(1200px) rotateY(${-Math.max(-1,Math.min(1,d))*11}deg) scale(${scale})`;
  card.style.opacity=String(Math.max(0,1-Math.abs(d)*.35));card.style.zIndex=String(100-Math.round(Math.abs(d)*10));card.style.visibility=Math.abs(d)>1.8?'hidden':'visible';
 });
 const lift=Math.min(156,height*.28)*shelfProgress,scale=1-Math.min(.25,156/Math.max(1,height))*shelfProgress;
 $('cards').style.transform=`translateY(${-lift*.49}px) rotateX(${(1-shelfProgress)*3.5}deg) scale(${scale})`;
}
function animate(time){if(!frame)return;const dt=Math.min(.026,(time-last)/1000||.016);last=time;if(!drag){velocity+=(target-position)*260*dt;velocity*=Math.exp(-29*dt);position+=velocity*dt;if(Math.abs(target-position)<.0008&&Math.abs(velocity)<.006){position=target;velocity=0;layout();frame=0;return;}}layout();frame=requestAnimationFrame(animate);}
function spring(){if(reducedMotion){position=target;layout();return;}if(!frame){last=performance.now();frame=requestAnimationFrame(animate);}}
function toggleShelf(open=!shelfOpen){
 shelfOpen=!!open;$('controls').classList.toggle('is-expanded',shelfOpen);$('dock-toggle').setAttribute('aria-expanded',shelfOpen);$('weapon-tray').inert=!shelfOpen;
 cancelAnimationFrame(shelfTween);const from=shelfProgress,to=shelfOpen?1:0,start=performance.now(),duration=reducedMotion?0:shelfOpen?330:470;
 const tick=time=>{const p=duration?Math.min(1,(time-start)/duration):1,curve=1-Math.pow(1-p,3);shelfProgress=from+(to-from)*curve;layout();if(p<1)shelfTween=requestAnimationFrame(tick);else shelfTween=0;};shelfTween=requestAnimationFrame(tick);
}
function select(index){cancelEffects();index=Math.max(0,Math.min(state.foes.length-1,index));state.selected=index;target=index;entry=null;result=null;try{save();}catch(e){toast(e.message);}spring();paint();}
function repairedPoint(t,n,m,index,uid){
 const tile=t.repair?.tiles[index];if(!tile)return '';
 const x=tile.cx,y=tile.cy,inner=tile.inner,kx=tile.width/tile.pixelWidth,ky=tile.height/tile.pixelHeight,id='under_'+uid+'_'+t.key+'_'+index;
 const weak=n.weak||n.kind==='weak',keep=m===0&&B.initialMark(n)<=1,hole=id+'_inner';
 const holeMask=keep?`<mask id="${hole}" maskUnits="userSpaceOnUse" x="${tile.left}" y="${tile.top}" width="${tile.width}" height="${tile.height}"><rect x="${tile.left}" y="${tile.top}" width="${tile.width}" height="${tile.height}" fill="white"/><circle cx="${x}" cy="${y}" r="${inner}" fill="black"/></mask>`:'';
 let s=`<defs>${holeMask}<clipPath id="${id}"><rect x="${tile.left}" y="${tile.top}" width="${tile.width}" height="${tile.height}"/></clipPath></defs><g clip-path="url(#${id})" ${keep?`mask="url(#${hole})"`:""}><image href="${E(t.repair.file)}" x="${tile.left-tile.ax*kx}" y="${tile.top-tile.ay*ky}" width="${t.repair.width*kx}" height="${t.repair.height*ky}"/></g>`;
 if(m===2)return s+`<image class="wound-scar wound-texture" href="fx/wound.png" x="${x-inner*1.75}" y="${y-inner*1.75}" width="${inner*3.50}" height="${inner*3.50}" transform="rotate(${(index%3-1)*7} ${x} ${y})"/>`;
 if(keep)return s+(m===1?`<g mask="url(#${hole})">${printedPoint('blue',x,y,inner,uid+'_'+t.key+'_'+index)}</g>`:'');
 if(m===1){s+=printedPoint('blue',x,y,inner,uid+'_'+t.key+'_'+index);if(weak)s+=printedPoint('weak',x,y,inner*.96,uid+'_'+t.key+'_'+index+'_weak');}
 else s+=printedPoint(weak?'weak':'plain',x,y,inner,uid+'_'+t.key+'_'+index);return s;
}
function printedPoint(kind,x,y,inner,key){
 const atlas=D.printedPoints,p=atlas.entries[kind],k=inner/p.inner,id='printed_'+key+'_'+kind,left=x-p.cx*k,top=y-p.cy*k;
 return `<defs><clipPath id="${id}"><rect x="${left}" y="${top}" width="${p.width*k}" height="${p.height*k}"/></clipPath></defs><g clip-path="url(#${id})"><image href="${E(atlas.file)}" x="${left-p.x*k}" y="${top-p.y*k}" width="${atlas.width*k}" height="${atlas.height*k}"/></g>`;
}
function marker(t,n,m,uid){
 if(m===B.initialMark(n)&&!n.legacyArmor)return '';
 const index=t.nodes.indexOf(n);if(t.repair)return repairedPoint(t,n,m,index,uid);
 // Unfinished cards remain visibly unfinished; never cover them with another
 // card's background. Publication is gated on all active faces being repaired.
 if(m!==2)return '';
 const x=(n.drawX??n.x)*t.width,y=(n.drawY??n.y)*t.height,r=n.r*t.width;
 return `<image class="wound-scar" href="fx/wound.png" x="${x-r*1.6}" y="${y-r*1.6}" width="${r*3.2}" height="${r*3.2}"/>`;
}
function tierPattern(w,tier){const indices=new Map();const nodes=w.nodes.filter((n,i)=>{if(n.tier>tier||i&&!indices.has(n.parent))return false;indices.set(i,indices.size);return true;}).map((n,i)=>({...n,parent:i?indices.get(n.parent):-1}));return {...w,nodes};}
function patternView(w){const ps=positions(w),[dx,dy]=B.dirs[w.entry];if(!w.aimed){const z=Math.hypot(dx,dy)||1;ps.push({x:-dx/z*76,y:-dy/z*76});}const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),x=Math.min(...xs)-36,y=Math.min(...ys)-36;return `${x} ${y} ${Math.max(...xs)-x+36} ${Math.max(...ys)-y+36}`;}
function weaponTray(){
 const stamp=JSON.stringify([state.attacks,state.attack,state.tier]);if(stamp===trayStamp)return;trayStamp=stamp;
 const tray=$('weapon-tray'),scroll=tray.scrollLeft;
 tray.innerHTML=state.attacks.map(w=>{const tiers=[...new Set(w.nodes.map(n=>n.tier))].sort();return `<article class="weapon-card ${w.id===state.attack?'is-active':''} ${tiers.length===1?'is-single':''}"><b class="weapon-title">${E(w.name)}</b><div class="weapon-patterns">${tiers.map(tier=>{const pattern=tierPattern(w,tier);return `<button class="weapon-pattern" data-forecast-attack="${E(w.id)}" data-forecast-tier="${tier}" aria-label="使用${E(w.name)}的${['白色','灰色','深色'][tier]}图案" aria-pressed="${w.id===state.attack&&state.tier===tier}"><span class="damage-dot ${['white','gray','dark'][tier]}"></span><svg viewBox="${patternView(pattern)}" aria-hidden="true">${diagram(pattern)}</svg></button>`;}).join('')}</div></article>`;}).join('')+'<button class="weapon-new" data-new-attack aria-label="自定义攻击轨迹"><span>＋</span>自定义</button>';
 tray.scrollLeft=scroll;
}
function paint(){
 const f=current(),w=attack();$('count').textContent=state.foes.length?`${state.selected+1} / ${state.foes.length} · 管理`:'添加敌人';$('direction').textContent=w.aimed?'瞄准':`从${B.dirs[w.entry][2]}进入`;
 const tCurrent=f?template(f):null;$('manual').disabled=!!tCurrent?.reference;
 $('confirm').disabled=!result?.valid||fxBusy;$('forecast').hidden=!result?.valid;$('combat').classList.toggle('has-forecast',!!result?.valid);
 $('result').textContent=result?.valid?`${result.wounds} 处受伤${result.armor?' · '+result.armor+' 层破盾':''}${result.defeated?' · 击败':result.weak.length?' · '+result.weak.length+' 处弱点':''}`:'';
 $('dock-toggle').innerHTML=`<svg viewBox="${patternView(tierPattern(w,state.tier))}" aria-hidden="true">${diagram(tierPattern(w,state.tier))}</svg><span>${E(w.name)}</span><span class="chevron" aria-hidden="true">⌃</span>`;
 weaponTray();
 document.querySelectorAll('[data-overlay]').forEach(svg=>{
  const index=+svg.dataset.overlay,foe=state.foes[index],t=template(foe),active=index===state.selected,shown=visualMarks?.id===foe.id?visualMarks.marks:foe.marks,proposal=active&&result?.valid?result:null,allowed=active&&!manual&&!fxBusy&&!t.manualOnly&&!t.reference?B.entries(t,foe,w):[];
  let markup=t.nodes.map((n,j)=>marker(t,n,shown[j],foe.id)).join('');
  if(proposal)markup+=t.nodes.map((n,j)=>proposal.marks[j]!==foe.marks[j]?`<circle class="preview-impact ${foe.marks[j]===3?'gold':foe.marks[j]===1?'shield':''}" cx="${(n.drawX??n.x)*t.width}" cy="${(n.drawY??n.y)*t.height}" r="${n.r*t.width*1.45}"/>`:'').join('');
  if(active)markup+=t.nodes.map((n,j)=>`${allowed.includes(j)?`<circle class="hp-entry" cx="${(n.drawX??n.x)*t.width}" cy="${(n.drawY??n.y)*t.height}" r="${n.r*t.width*1.17}"/>`:''}<circle class="hp-target" data-hp="${j}" fill="transparent" cx="${(n.drawX??n.x)*t.width}" cy="${(n.drawY??n.y)*t.height}" r="${Math.max(n.r*t.width*1.45,25)}"/>`).join('');
  svg.innerHTML=markup;
 });
}
function hit(index){
 if(fxBusy)cancelEffects();const f=current(),t=template(f);if(t.reference)return;
 if(t.manualOnly||manual){const before=[...f.marks],after=B.cycleMark(t.nodes[index],f.marks[index]);if(transaction(()=>{f.marks[index]=after;}))runAttack([{index,before:before[index],after,step:0}],before);return;}
 entry=index;result=B.preview(t,f,attack(),state.tier,index);paint();
}
function pointFromEvent(e){
 const svg=document.querySelector(`[data-overlay="${state.selected}"]`);if(!svg||!svg.parentElement.classList.contains('is-ready'))return null;
 const transform=svg.getScreenCTM();if(!transform)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(transform.inverse()),t=template(current()),scale=svg.getBoundingClientRect().width/t.width;
 const nearest=t.nodes.map((n,j)=>({j,d:Math.hypot((n.drawX??n.x)*t.width-p.x,(n.drawY??n.y)*t.height-p.y)*scale})).sort((a,b)=>a.d-b.d)[0];return nearest&&nearest.d<Math.max(21,Math.min(29,$('stage').clientWidth*.062))?nearest.j:null;
}
$('stage').addEventListener('pointerdown',e=>{
 if(!e.isPrimary||!state.foes.length||e.target.closest('button,input,form'))return;if(fxBusy){cancelEffects();paint();}
 const hp=pointFromEvent(e);drag={x:e.clientX,y:e.clientY,time:e.timeStamp,from:position,lastX:e.clientX,v:0,kind:hp!==null&&!manual&&!template(current()).manualOnly?'aim':null};
 if(drag.kind==='aim')hit(hp);$('stage').setPointerCapture(e.pointerId);
});
$('stage').addEventListener('pointermove',e=>{
 if(fxBusy)return;if(!drag){if(e.pointerType==='mouse'&&!manual&&state.foes.length&&!template(current()).manualOnly&&!template(current()).reference){const hp=pointFromEvent(e);if(hp!==null&&hp!==entry)hit(hp);}return;}
 if(drag.kind==='aim'){const hp=pointFromEvent(e);if(hp!==null&&hp!==entry)hit(hp);return;}
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.kind&&Math.max(Math.abs(dx),Math.abs(dy))>7)drag.kind=Math.abs(dx)>Math.abs(dy)*1.15?'horizontal':'vertical';if(drag.kind!=='horizontal')return;
 let next=drag.from-Math.max(-.93,Math.min(.93,dx/($('stage').clientWidth*.97)));if(next<0)next=-Math.log1p(-next)*.2;else if(next>state.foes.length-1)next=state.foes.length-1+Math.log1p(next-state.foes.length+1)*.2;
 position=next;drag.v=(e.clientX-drag.lastX)/Math.max(1,e.timeStamp-drag.time);drag.lastX=e.clientX;drag.time=e.timeStamp;layout();
});
function release(e,cancel=false){if(!drag)return;const d=drag;drag=null;if(d.kind==='horizontal'){const delta=position-d.from,fast=Math.abs(d.v)>.42;select(cancel?state.selected:state.selected+(Math.abs(delta)>.18||fast?(delta>0?1:-1):0));}else if(!cancel&&!d.kind){const index=pointFromEvent(e);if(index!==null)hit(index);}else{target=state.selected;spring();}}
$('stage').addEventListener('pointerup',e=>release(e));$('stage').addEventListener('pointercancel',e=>release(e,true));
const armorFragmentCache=new Map();
function originalArmorFragment(card,t,n,event){
 const key=t.key+'_'+event.index+'_'+event.before;
 if(armorFragmentCache.has(key))return armorFragmentCache.get(key);
 const image=card.querySelector('img');if(!image?.complete||!image.naturalWidth)return null;
 const r=t.repair?.tiles[event.index]?.inner||n.r*t.width*.9,x=(n.drawX??n.x)*t.width,y=(n.drawY??n.y)*t.height;
 const piece=document.createElement('canvas');piece.width=piece.height=160;const ctx=piece.getContext('2d',{willReadFrequently:true}),scale=160/(r*3.4);
 ctx.translate(80,80);ctx.scale(scale,scale);ctx.translate(-x,-y);
 if(t.imageRotation){ctx.translate(t.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0,t.height,t.width);}else ctx.drawImage(image,0,0,t.width,t.height);
 const pixels=ctx.getImageData(0,0,160,160),a=pixels.data,colorMask=new Uint8Array(25600),seen=new Uint8Array(25600),kept=new Uint8Array(25600),queue=new Int32Array(25600);
 for(let i=0;i<25600;i++){
  const red=a[i*4],green=a[i*4+1],blue=a[i*4+2];
  colorMask[i]=event.before===3?+(red>155&&green>120&&green>red*.73&&red>blue*1.25&&green>blue*1.2):+(blue>red*1.16&&green>red*1.10&&blue>70&&blue>green*.78);
 }
 // Printed armor is bounded by its dark rim. Reject surrounding fur, cape,
 // or water-illustration components that continue through the crop boundary.
 for(let start=0;start<25600;start++)if(colorMask[start]&&!seen[start]){
  let end=1,head=0,edge=false,sx=0,sy=0;queue[0]=start;seen[start]=1;
  while(head<end){const i=queue[head++],x=i%160,y=Math.floor(i/160);sx+=x;sy+=y;if(!x||!y||x===159||y===159)edge=true;
   for(const next of [x?i-1:-1,x<159?i+1:-1,y?i-160:-1,y<159?i+160:-1])if(next>=0&&colorMask[next]&&!seen[next]){seen[next]=1;queue[end++]=next;}
  }
  if(!edge&&end>=6&&Math.hypot(sx/end-80,sy/end-80)<160/3.4*1.6)for(let k=0;k<end;k++){const i=queue[k];if(Math.hypot(i%160-80,Math.floor(i/160)-80)<160/3.4*1.65)kept[i]=1;}
 }
 for(let i=0;i<25600;i++)if(!kept[i])a[i*4+3]=0;
 ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(pixels,0,0);
 if(armorFragmentCache.size>=64)armorFragmentCache.delete(armorFragmentCache.keys().next().value);
 armorFragmentCache.set(key,piece);return piece;
}

function cancelEffects(){
 fxToken++;fxTimers.forEach(clearTimeout);fxTimers=[];fxAnimations.forEach(a=>a.cancel());fxAnimations=[];cancelAnimationFrame(fxFrame);fxFrame=0;fxScenes=[];fxBusy=false;visualMarks=null;
 document.querySelectorAll('canvas.hit-fx').forEach(c=>c.getContext('2d').clearRect(0,0,c.width,c.height));
}
function later(fn,delay){const token=fxToken;fxTimers.push(setTimeout(()=>{if(token===fxToken)fn();},delay));}
function playStrike(event){
 const f=current();if(!f||reducedMotion)return;const t=template(f),n=t.nodes[event.index],card=document.querySelector(`.foe-card[data-foe="${state.selected}"]`),canvas=card?.querySelector('canvas.hit-fx');if(!canvas)return;
 const ratio=Math.min(2,devicePixelRatio||1),cw=Math.round(card.clientWidth*ratio),ch=Math.round(card.clientHeight*ratio);if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 fxScenes.push({start:performance.now(),event,x:(n.drawX??n.x)*t.width,y:(n.drawY??n.y)*t.height,r:(t.repair?.tiles[event.index]?.inner||n.r*t.width*.9)*(event.before===3||event.before===1?1.48:1),canvas,t,ratio,piece:event.before===3||event.before===1?originalArmorFragment(card,t,n,event):null});
 if(!fxFrame)fxFrame=requestAnimationFrame(paintEffects);
}
function paintEffects(time){
 fxScenes=fxScenes.filter(s=>time-s.start<650);const canvases=new Set(fxScenes.map(s=>s.canvas));
 document.querySelectorAll('canvas.hit-fx').forEach(canvas=>{const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);});
 for(const s of fxScenes){
  const age=time-s.start,c=s.canvas.getContext('2d'),e=s.event,r=s.r,shield=e.before===3||e.before===1,healing=e.before===2&&e.after!==2,color=e.before===3?'#ffd659':shield?'#91e9ff':'#ffb274';
  c.save();c.setTransform(s.canvas.width/s.t.width,0,0,s.canvas.height/s.t.height,0,0);c.translate(s.x,s.y);
  // A short, local light contact; it never flashes or displaces the whole card.
  if(age<180){const life=age/180,flash=c.createRadialGradient(0,0,0,0,0,r*(1.3+life));flash.addColorStop(0,healing?'#e3ffe8':'#fff8de');flash.addColorStop(.22,healing?'#b4efcd':color);flash.addColorStop(1,'#ffffff00');c.globalAlpha=Math.sin(life*Math.PI)*.65;c.globalCompositeOperation='lighter';c.fillStyle=flash;c.beginPath();c.arc(0,0,r*(1.3+life),0,Math.PI*2);c.fill();c.globalAlpha=1;}
  if(healing){
   const p=Math.min(1,age/480);c.globalCompositeOperation='screen';c.globalAlpha=(1-p)*.7;c.strokeStyle='#b7eac4';c.lineWidth=r*.09;c.beginPath();c.arc(0,0,r*(.7+p*1.6),0,Math.PI*2);c.stroke();c.restore();continue;
  }
  if(shield){
   const p=Math.min(1,age/520),ease=1-Math.pow(1-p,2),inner=r/1.48;
   c.globalCompositeOperation='source-over';
   // Fracture the actual printed armor colors/textures rather than emit
   // unrelated geometric confetti. Yellow sheds independently of cyan.
   if(s.piece)for(let i=0;i<8;i++){
    const a0=i*Math.PI/4-.02,a1=(i+1)*Math.PI/4+.02,angle=(a0+a1)/2,d=inner*ease*(1.25+(i%3)*.4);
    c.save();c.translate(Math.cos(angle)*d,Math.sin(angle)*d+ease*ease*inner*.5);c.rotate((i%2?1:-1)*ease*.65);c.globalAlpha=Math.pow(1-p,1.35);
    c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a0)*inner*2.5,Math.sin(a0)*inner*2.5);c.lineTo(Math.cos(a1)*inner*2.5,Math.sin(a1)*inner*2.5);c.closePath();c.clip();c.drawImage(s.piece,-inner*1.7,-inner*1.7,inner*3.4,inner*3.4);c.restore();
   }
   if(age<118){c.globalAlpha=Math.sin(age/118*Math.PI)*.85;c.strokeStyle='#fff6d9';c.lineWidth=inner*.035;c.beginPath();c.moveTo(-inner*.6,-inner*.9);c.lineTo(inner*.12,-inner*.25);c.lineTo(-inner*.15,inner*.12);c.lineTo(inner*.62,inner*.86);c.stroke();c.globalAlpha=1;}
   if(age<260){const p=age/260;c.globalCompositeOperation='screen';c.globalAlpha=(1-p)*.8;c.lineWidth=r*.07;c.strokeStyle=color;for(let i=0;i<6;i++){c.beginPath();c.arc(0,0,r*(.95+p*.65),i*Math.PI/3+p*.3,i*Math.PI/3+.55+p*.3);c.stroke();}c.globalAlpha=1;}
  }
  if(age<330){
   const head=Math.min(1,(age+5)/160),tail=Math.max(0,head-.58),fade=age<155?1:Math.max(0,1-(age-155)/175),angle=((e.index%3)-1)*.24;
   c.save();c.rotate(angle);c.globalCompositeOperation='lighter';
   const curve=t=>({x:(t-.5)*r*5.8,y:r*(-2*(1-t)*(1-t)-.6*(1-t)*t+2*t*t)});
   for(const pass of [{width:.33,blur:10,color},{width:.115,blur:3,color:'#fff6d8'},{width:.034,blur:0,color:'#ffffff'}]){
    c.strokeStyle=pass.color;c.shadowColor=pass.color;c.shadowBlur=pass.blur*s.ratio;c.lineCap='round';
    for(let i=1;i<=22;i++){const a=curve(tail+(head-tail)*(i-1)/22),b=curve(tail+(head-tail)*i/22),k=i/22;c.globalAlpha=fade*Math.pow(k,.8);c.lineWidth=r*pass.width*(.25+Math.sin(k*Math.PI)*.75);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   }
   c.restore();
  }
  const p=Math.min(1,age/430);c.globalCompositeOperation='lighter';c.globalAlpha=Math.pow(1-p,2);c.strokeStyle=shield?color:'#ffd5a8';c.lineWidth=r*.045;
  for(let i=0;i<8;i++){const a=i*2.399+e.index*.31,travel=r*(.4+p*(2.6+(i%3))),x=Math.cos(a)*travel,y=Math.sin(a)*travel+p*p*r*.7;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(a)*r*.35,y-Math.sin(a)*r*.35);c.stroke();}
  c.restore();
 }
 fxFrame=fxScenes.length?requestAnimationFrame(paintEffects):0;
}
function runAttack(events,before){
 cancelEffects();const f=current();if(!f)return;fxBusy=true;visualMarks={id:f.id,marks:[...before]};paint();const gap=reducedMotion?0:Math.max(45,Math.min(150,1350/Math.max(1,events.length)));
 if(!reducedMotion)window.AndroidCombat?.feedback?.('attack');
 events.forEach((event,i)=>{later(()=>playStrike(event),i*gap);later(()=>{if(visualMarks){visualMarks.marks[event.index]=event.after;paint();}},i*gap+(reducedMotion?0:118));});
 later(()=>{visualMarks=null;fxBusy=false;paint();},Math.max(0,(events.length-1)*gap)+(reducedMotion?0:660));
}
function positions(w){const out=[{x:0,y:0}];for(const n of w.nodes.slice(1)){const p=out[n.parent];out.push({x:p.x+n.dx*66,y:p.y+n.dy*66});}return out;}
function shape(p,r=27){return [[0,-1],[.28,-.71],[.70,-.71],[.70,-.29],[1,0],[.70,.29],[.70,.71],[.28,.71],[0,1],[-.28,.71],[-.70,.71],[-.70,.29],[-1,0],[-.70,-.29],[-.70,-.71],[-.28,-.71]].map(([x,y])=>`${p.x+x*r},${p.y+y*r}`).join(' ');}
// Geometry reused from SkillTiles.kt / skills92.js: the following mark's spike
// is extended. There is no independent connecting line or rectangular joint.
const printedContour=[[0,-1],[.28,-.71],[.70,-.71],[.70,-.29],[1,0],[.70,.29],[.70,.71],[.28,.71],[0,1],[-.28,.71],[-.70,.71],[-.70,.29],[-1,0],[-.70,-.29],[-.70,-.71],[-.28,-.71]];
const printedTiers=['#ffffff','#bcbdc0','#58595b'];
function printedGeometry(w,ps,r=27){
 const tails=w.nodes.map(()=>({}));
 function extend(i,dx,dy,len){const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;let best=0,score=-Infinity;for(let k=0;k<16;k+=2){const p=printedContour[k],v=(p[0]*ux+p[1]*uy)/Math.hypot(...p);if(v>score){best=k;score=v;}}tails[i][best]=[ux*len,uy*len];}
 w.nodes.forEach((n,i)=>{if(!i)return;const dx=ps[n.parent].x-ps[i].x,dy=ps[n.parent].y-ps[i].y;extend(i,dx,dy,Math.max(r,Math.hypot(dx,dy)-r*.75));});
 let arrow='';if(!w.aimed){const [dx,dy]=B.dirs[w.entry],ux=-dx/(Math.hypot(dx,dy)||1),uy=-dy/(Math.hypot(dx,dy)||1),single=w.nodes.length===1,near=r*(single?1.50:1.37),far=r*(single?2.70:2.47),notch=r*(single?2.57:2.35),half=r*(single?.77:.70);extend(0,-dx,-dy,r*2.05);arrow=`M${ps[0].x+ux*near} ${ps[0].y+uy*near}L${ps[0].x+ux*far-uy*half} ${ps[0].y+uy*far+ux*half}L${ps[0].x+ux*notch} ${ps[0].y+uy*notch}L${ps[0].x+ux*far+uy*half} ${ps[0].y+uy*far-ux*half}Z`;}
 const marks=w.nodes.map((n,i)=>printedContour.map((p,k)=>{const q=tails[i][k]||[p[0]*r,p[1]*r];return (k?'L':'M')+q[0]+' '+q[1];}).join('')+'Z');return{marks,arrow,tails};
}
function printedPiercing(r=27){const o=r*8.4615/6.254,i=r*6.325/6.254,c=r*.713/6.254;return `<path fill="#72bbea" fill-rule="evenodd" d="M${-c} ${-o}L${c} ${-o}L${o} ${-c}L${o} ${c}L${c} ${o}L${-c} ${o}L${-o} ${c}L${-o} ${-c}ZM0 ${-i}L${i} 0L0 ${i}L${-i} 0Z"/>`;}
function diagram(w){const ps=positions(w),geo=printedGeometry(w,ps);let out='';w.nodes.forEach((n,i)=>{if(n.piercing)out+=`<g transform="translate(${ps[i].x} ${ps[i].y})">${printedPiercing()}</g>`;});
 for(let i=w.nodes.length-1;i>=0;i--)out+=`<path transform="translate(${ps[i].x} ${ps[i].y})" d="${geo.marks[i]}" fill="${printedTiers[w.nodes[i].tier]}" stroke="#44454b" stroke-width="2.7" stroke-linejoin="round"/>`;
 if(w.aimed)out+=`<image href="fx/grid-enemy.svg" x="${ps[0].x-17.55}" y="${ps[0].y-17.55}" width="35.1" height="35.1"/>`;else out+=`<path d="${geo.arrow}" fill="#231f20"/>`;return out;
}
function startNodeBirth(el){
 const start=performance.now();el.setAttribute('transform','scale(.65)');el.setAttribute('opacity','0');
 const tick=time=>{if(!draft||page!=='editor'||!el.isConnected)return;const p=Math.min(1,(time-start)/180),scale=p<.7?.65+.385*(1-Math.pow(1-p/.7,3)):1+.035*Math.pow(1-(p-.7)/.3,2);el.setAttribute('transform',`scale(${scale})`);el.setAttribute('opacity',Math.min(1,p*2));if(p<1)requestAnimationFrame(tick);else{el.removeAttribute('transform');el.removeAttribute('opacity');}};requestAnimationFrame(tick);
}

function attacks(){$('attack-list').innerHTML=state.attacks.map(w=>`<div class="attack-option"><button class="icon" data-use="${E(w.id)}" aria-label="使用${E(w.name)}"><svg viewBox="-125 -105 250 210">${diagram(w)}</svg></button><div><b>${E(w.name)}</b><small>${w.nodes.length} 击 · ${w.aimed?'瞄准攻击':'定向攻击'}</small></div><button class="edit" data-edit="${E(w.id)}">编辑</button></div>`).join('');}
function edit(w){draft=B.clone(w);node=0;nodeTier=0;builderHistory=[];builderCamera=null;builderCameraTarget=null;$('builder').replaceChildren();show('editor');$('attack-name').value=draft.name;drawBuilder();}

function setBuilderCamera(){if(!builderCamera)return;const grid=$('grid-viewport');if(grid){grid.setAttribute('x',builderCamera.x);grid.setAttribute('y',builderCamera.y);grid.setAttribute('width',builderCamera.size);grid.setAttribute('height',builderCamera.size);}$('builder').setAttribute('viewBox',`${builderCamera.x} ${builderCamera.y} ${builderCamera.size} ${builderCamera.size}`);}
function fitBuilderCamera(ps){
 const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const size=Math.max(780,maxX-minX+180,maxY-minY+180);
 if(!builderCamera){builderCamera={x:(minX+maxX-size)/2,y:(minY+maxY-size)/2,size};setBuilderCamera();return;}
 if(builderDrag)return;
 const c=builderCameraTarget||builderCamera;
 if(minX>c.x+48&&maxX<c.x+c.size-48&&minY>c.y+48&&maxY<c.y+c.size-48)return;
 builderCameraTarget={x:(minX+maxX-size)/2,y:(minY+maxY-size)/2,size};
 if(builderCameraFrame)return;
 let last=performance.now();
 const tick=time=>{if(!draft||!builderCameraTarget){builderCameraFrame=0;return;}const dt=Math.min(.04,(time-last)/1000);last=time;const k=1-Math.exp(-14*dt),to=builderCameraTarget;for(const key of ['x','y','size'])builderCamera[key]+=(to[key]-builderCamera[key])*k;setBuilderCamera();if(Math.max(...['x','y','size'].map(key=>Math.abs(to[key]-builderCamera[key])))<.05){builderCamera={...to};builderCameraTarget=null;setBuilderCamera();builderCameraFrame=0;return;}builderCameraFrame=requestAnimationFrame(tick);};builderCameraFrame=requestAnimationFrame(tick);
}
function drawBuilder(){
 const svg=$('builder'),ns='http://www.w3.org/2000/svg',ps=positions(draft),geo=printedGeometry(draft,ps);fitBuilderCamera([...ps,{x:ps[node].x-100,y:ps[node].y-100},{x:ps[node].x+100,y:ps[node].y+100}]);
 if(!svg.querySelector('#graph-nodes'))svg.innerHTML='<defs><radialGradient id="grid-fade-gradient"><stop offset="0" stop-color="white"/><stop offset=".5" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient><mask id="grid-fade" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill="url(#grid-fade-gradient)"/></mask><radialGradient id="grid-shade"><stop offset="0" stop-color="var(--ink)" stop-opacity=".008"/><stop offset=".82" stop-color="var(--ink)" stop-opacity=".026"/><stop offset="1" stop-color="var(--ink)" stop-opacity=".04"/></radialGradient><pattern id="builder-grid" x="-33" y="-33" width="66" height="66" patternUnits="userSpaceOnUse"><circle cx="33" cy="33" r="26" fill="url(#grid-shade)"/></pattern></defs><rect id="grid-viewport" x="-390" y="-390" width="780" height="780" fill="url(#builder-grid)" mask="url(#grid-fade)"/><g id="graph-candidates"></g><g id="graph-nodes"></g><path id="builder-entrance" fill="#231f20" data-entry-handle=""/><path id="graph-ghost" class="editor-ghost-mark" visibility="hidden"/>';
 const nodes=$('graph-nodes'),candidates=$('graph-candidates');[...nodes.children].filter(e=>+e.dataset.step>=draft.nodes.length).forEach(e=>e.remove());
 const ordered=[],births=[];for(let i=draft.nodes.length-1;i>=0;i--){const n=draft.nodes[i],p=ps[i];let el=nodes.querySelector(`[data-step="${i}"]`),fresh=!el;
  if(!el){el=document.createElementNS(ns,'g');el.dataset.step=i;}el.setAttribute('class','attack-node'+(i===node?' is-selected':''));el.setAttribute('transform',`translate(${p.x} ${p.y})`);
  el.innerHTML=`<g class="node-birth">${n.piercing?printedPiercing():''}<path class="attack-step printed-mark" d="${geo.marks[i]}" fill="${printedTiers[n.tier]}"/>${i===0&&draft.aimed?'<image href="fx/grid-enemy.svg" x="-17.55" y="-17.55" width="35.1" height="35.1"/>':''}<circle class="node-hit" r="31" fill="transparent" pointer-events="all"/></g>`;
  ordered.push(el);if(fresh&&!reducedMotion)births.push(el.querySelector('.node-birth'));
 }nodes.append(...ordered);births.forEach(startNodeBirth);
 const entrance=$('builder-entrance');entrance.setAttribute('d',geo.arrow);entrance.style.visibility=draft.aimed?'hidden':'visible';
 if(candidates.children.length!==8)candidates.innerHTML=B.dirs.map((_,i)=>`<g class="builder-candidate" data-direction="${i}"><circle class="candidate-hit" r="32" fill="transparent"/><circle class="candidate-ring" r="25"/></g>`).join('');
 [...candidates.children].forEach((g,i)=>{const [x,y]=B.dirs[i],occupied=ps.some(p=>p.x===ps[node].x+x*66&&p.y===ps[node].y+y*66);g.setAttribute('transform',`translate(${ps[node].x+x*66} ${ps[node].y+y*66})`);g.style.visibility=occupied?'hidden':'visible';});
 $('piercing').setAttribute('aria-pressed',draft.nodes[node].piercing);$('aimed').setAttribute('aria-pressed',draft.aimed);$('aimed').textContent=draft.aimed?'瞄准攻击':'定向攻击';$('delete-node').disabled=node===0;$('builder-undo').disabled=!builderHistory.length;document.querySelectorAll('[data-node-tier]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.nodeTier===draft.nodes[node].tier));
}
function builderPoint(e){const matrix=$('builder').getScreenCTM();return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
function appendNode(dx,dy){if(!dx&&!dy)return;if(draft.nodes.length>=20){toast('每个轨迹最多20击');return;}const p=positions(draft)[node],duplicate=positions(draft).some(q=>q.x===p.x+dx*66&&q.y===p.y+dy*66);if(duplicate){toast('此位置已有节点，请选择其他方向');return;}builderHistory.push(B.clone(draft));draft.nodes.push({parent:node,dx,dy,tier:Math.max(nodeTier,draft.nodes[node].tier),piercing:false});node=draft.nodes.length-1;drawBuilder();}
$('builder').addEventListener('pointerdown',e=>{
 if(!e.isPrimary||!draft)return;const p=builderPoint(e),candidate=e.target.closest('[data-direction]'),step=e.target.closest('[data-step]'),ps=positions(draft);
 if(e.target.closest('[data-entry-handle]')){builderHistory.push(B.clone(draft));builderDrag={entry:true,from:ps[0]};}
 else if(candidate){const [dx,dy]=B.dirs[+candidate.dataset.direction];builderDrag={from:ps[node],dx,dy,moved:false,candidate:true};}
 else if(step){node=+step.dataset.step;nodeTier=draft.nodes[node].tier;drawBuilder();builderDrag={from:ps[node],dx:0,dy:0,moved:false};}
 else{builderDrag={pan:true,clientX:e.clientX,clientY:e.clientY,camera:{...builderCamera}};builderCameraTarget=null;cancelAnimationFrame(builderCameraFrame);builderCameraFrame=0;}
 $('builder').setPointerCapture(e.pointerId);e.preventDefault();
});
$('builder').addEventListener('pointermove',e=>{
 if(!builderDrag||!draft)return;if(builderDrag.pan){const rect=$('builder').getBoundingClientRect(),scale=builderDrag.camera.size/Math.min(rect.width,rect.height);builderCamera={...builderDrag.camera,x:builderDrag.camera.x-(e.clientX-builderDrag.clientX)*scale,y:builderDrag.camera.y-(e.clientY-builderDrag.clientY)*scale};setBuilderCamera();return;}
 const p=builderPoint(e),dx=p.x-builderDrag.from.x,dy=p.y-builderDrag.from.y;if(builderDrag.entry){const angle=Math.round(Math.atan2(-dy,-dx)/(Math.PI/4))*Math.PI/4,ux=Math.round(Math.cos(angle)),uy=Math.round(Math.sin(angle));draft.entry=B.dirs.findIndex(d=>d[0]===ux&&d[1]===uy);draft.aimed=false;drawBuilder();return;}if(Math.hypot(dx,dy)<19)return;builderDrag.moved=true;const angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;builderDrag.dx=Math.round(Math.cos(angle));builderDrag.dy=Math.round(Math.sin(angle));
 const a=builderDrag.from,ghost=$('graph-ghost');ghost.setAttribute('visibility','visible');const target={x:a.x+builderDrag.dx*66,y:a.y+builderDrag.dy*66},preview={nodes:[{parent:-1,tier:0},{parent:0,tier:nodeTier}],aimed:true,entry:0},geometry=printedGeometry(preview,[a,target]);ghost.setAttribute('d',geometry.marks[1]);ghost.setAttribute('transform',`translate(${target.x} ${target.y})`);ghost.setAttribute('fill',printedTiers[nodeTier]);
 document.querySelectorAll('.builder-candidate').forEach(g=>{const d=B.dirs[+g.dataset.direction];g.classList.toggle('is-hover',d[0]===builderDrag.dx&&d[1]===builderDrag.dy);});
});
function releaseBuilder(cancel=false){if(!builderDrag)return;const d=builderDrag;builderDrag=null;if(!cancel&&!d.pan&&!d.entry&&(d.moved||d.candidate))appendNode(d.dx,d.dy);const ghost=$('graph-ghost');if(ghost)ghost.setAttribute('visibility','hidden');document.querySelectorAll('.builder-candidate').forEach(g=>g.classList.remove('is-hover'));if(draft&&!d.pan)drawBuilder();}
$('builder').addEventListener('pointerup',()=>releaseBuilder());$('builder').addEventListener('pointercancel',()=>releaseBuilder(true));
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.forecastAttack){toggleShelf(false);state.attack=b.dataset.forecastAttack;state.tier=+b.dataset.forecastTier;entry=result=null;try{save();}catch(error){toast(error.message);}paint();}if(b.hasAttribute('data-new-attack'))edit(B.blankAttack());if(b.dataset.page)show(b.dataset.page);if(b.dataset.enemy)chooseEnemy(b.dataset.enemy);if(b.dataset.tier){state.tier=+b.dataset.tier;document.querySelectorAll('[data-tier]').forEach(p=>p.setAttribute('aria-pressed',p===b));if(entry!==null)result=B.preview(template(current()),current(),attack(),state.tier,entry);save();paint();}if(b.dataset.use){state.attack=b.dataset.use;save();entry=result=null;show('field');paint();}if(b.dataset.edit)edit(state.attacks.find(w=>w.id===b.dataset.edit));if(b.dataset.nodeTier){const value=+b.dataset.nodeTier;if(node===0&&value!==0){toast('起点属于第一档，请先拖出下一击');return;}builderHistory.push(B.clone(draft));draft.nodes[node].tier=value;nodeTier=value;drawBuilder();}});
$('model-search').oninput=models;$('add').onclick=()=>show('models');$('close-modal').onclick=close;document.querySelector('.scrim').onclick=close;$('back').onclick=()=>{if(!$('modal').hidden)close();else if(page==='editor')show('attacks');else if(page!=='field')show('field');else window.AndroidCombat?.close();};
$('manual').onclick=()=>{manual=!manual;$('manual').setAttribute('aria-pressed',manual);entry=result=null;paint();};$('confirm').onclick=()=>{if(!result?.valid)return;const proposal=result;if(transaction(()=>{current().marks=[...proposal.marks];})){result=entry=null;paint();toast(proposal.defeated?'全部生命点已受伤':proposal.weak.length?'请结算原卡的弱点效果':'已记录本次攻击');}};
$('undo').onclick=()=>{if(!history.length)return;const old=state,remaining=history.slice(0,-1);state={...history[history.length-1],undo:remaining};try{save();}catch(e){state=old;toast(e.message);return;}history=remaining;result=entry=null;position=target=state.selected;$('undo').disabled=!history.length;renderCards();};
$('direction').onclick=()=>{const w=attack(),order=[7,0,1,6,-1,2,5,4,3];modal('攻击进入方向',`<div class="direction-grid">${order.map(i=>i<0?`<button id="aim-mode" data-on="${w.aimed}">瞄准</button>`:`<button data-dir="${i}" data-on="${!w.aimed&&w.entry===i}">${['↓','↙','←','↖','↑','↗','→','↘'][i]}<br>${B.dirs[i][2]}</button>`).join('')}</div>`);document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>{w.entry=+b.dataset.dir;w.aimed=false;entry=result=null;save();close();paint();});$('aim-mode').onclick=()=>{w.aimed=true;entry=result=null;save();close();paint();};};
$('new-attack').onclick=()=>edit(B.blankAttack());$('cancel-editor').onclick=()=>show('attacks');$('builder-undo').onclick=()=>{if(builderHistory.length){draft=builderHistory.pop();node=Math.min(node,draft.nodes.length-1);drawBuilder();}};$('piercing').onclick=()=>{builderHistory.push(B.clone(draft));draft.nodes[node].piercing=!draft.nodes[node].piercing;drawBuilder();};$('aimed').onclick=()=>{builderHistory.push(B.clone(draft));draft.aimed=!draft.aimed;drawBuilder();};
$('delete-node').onclick=()=>{if(!node)return;builderHistory.push(B.clone(draft));const removed=new Set([node]);draft.nodes.forEach((n,i)=>{if(removed.has(n.parent))removed.add(i);});const indices=new Map();draft.nodes=draft.nodes.filter((n,i)=>{if(removed.has(i))return false;indices.set(i,indices.size);return true;});draft.nodes.forEach((n,i)=>{if(i)n.parent=indices.get(n.parent);});node=0;drawBuilder();};
$('save-attack').onclick=()=>{draft.name=$('attack-name').value.trim()||'我的攻击';const copy=B.clone(draft);if(transaction(()=>{const i=state.attacks.findIndex(w=>w.id===copy.id);if(i<0)state.attacks.push(copy);else state.attacks[i]=copy;state.attack=copy.id;})){toast('攻击轨迹已保存');draft=null;show('attacks');}};
function overview(){
 modal('战场总览',state.foes.map((f,i)=>{const t=template(f);return `<div class="roster-row"><button class="selection" data-focus="${i}"><b>${E(t.name)}${t.reference||t.scene?'':' · '+f.index}</b><span>${t.reference?'说明卡面':t.manualOnly?'场景记录':f.marks.filter(m=>m===2).length+' / '+f.marks.length}</span></button><button class="roster-remove" data-remove="${i}" aria-label="移出${E(t.name)}">移出</button>${t.notice?`<p class="roster-notice">${E(t.notice)}</p>`:''}</div>`;}).join('')+(state.foes.length?'<button id="clear-field">结束本场战斗</button>':'<p>尚未加入敌人</p>'));
 document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{select(+b.dataset.focus);close();});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const i=+b.dataset.remove;if(transaction(()=>{state.foes.splice(i,1);state.selected=Math.max(0,Math.min(state.selected,state.foes.length-1));})){position=target=state.selected;entry=result=null;renderCards();overview();toast('已移出，可撤销恢复');}});
 if($('clear-field'))$('clear-field').onclick=()=>{modal('结束本场战斗','<p>清空本场敌人与损伤记录，保留已保存的攻击轨迹。可用撤销恢复。</p><div class="roster-actions"><button id="keep-field">继续战斗</button><button id="confirm-clear" class="primary">结束本场</button></div>');$('keep-field').onclick=overview;$('confirm-clear').onclick=()=>{if(transaction(()=>{state.foes=[];state.selected=0;})){position=target=0;entry=result=null;renderCards();close();toast('本场已结束，可撤销恢复');}};};
}
$('overview').onclick=overview;
document.querySelectorAll('[data-node-tier]').forEach(b=>{const tier=+b.dataset.nodeTier;b.innerHTML=`<svg viewBox="-34 -34 68 68" width="26" height="26" aria-hidden="true"><polygon points="${shape({x:0,y:0},27)}" fill="${['#fff','#c6c7c9','#64666a'][tier]}" stroke="#44444a" stroke-width="3"/></svg>`;});
$('dock-toggle').onclick=()=>toggleShelf();$('weapon-tray').inert=true;
$('empty-entry').onsubmit=e=>{e.preventDefault();findEnemy($('empty-code').value,'entry-error');};$('add').onclick=enemyEntry;
$('confirm').onclick=()=>{if(!result?.valid||fxBusy)return;const proposal=result,before=[...current().marks];if(transaction(()=>{current().marks=[...proposal.marks];})){result=entry=null;runAttack(proposal.events||[],before);if(proposal.defeated)later(()=>toast('全部生命点已受伤'),700);else if(proposal.weak.length)later(()=>toast('请结算原卡的弱点效果'),620);}};
const undoBase=$('undo').onclick;$('undo').onclick=()=>{cancelEffects();undoBase();};
$('back').onclick=()=>{cancelEffects();if(!$('modal').hidden){close();return;}if(page==='editor'){show('attacks');return;}if(page!=='field'){show('field');return;}window.AndroidCombat?.close();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelEffects();if(frame){cancelAnimationFrame(frame);frame=0;}cancelAnimationFrame(shelfTween);shelfTween=0;shelfProgress=shelfOpen?1:0;position=target=state.selected;layout();paint();}});
window.addEventListener('pagehide',cancelEffects);
new ResizeObserver(()=>requestAnimationFrame(layout)).observe($('stage'));window.addEventListener('resize',layout);window.CombatApp={snapshot:()=>B.clone(state),templates:D.templates,back:()=>{const nested=!$('modal').hidden||page!=='field';$('back').click();return nested;}};renderCards();$('undo').disabled=!history.length;if(loadError)modal('战斗记录暂时无法读取','<p>原始记录已保留，当前不会覆盖它。请先使用软件的存档备份功能保留数据。</p>');
})();
