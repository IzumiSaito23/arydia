(function(g){'use strict';
const Old=g.Combat95,C=Old.clone;
const need=x=>{if(!x)throw Error('战斗记录格式无效，原记录已保留');};
const hasWound=n=>n.hasWound!==false&&!n.armorOnly;
const hittable=(n,m)=>m===1||m===3||m===0&&hasWound(n);
const cleanMarks=(t,marks)=>marks.map((m,i)=>!hasWound(t.nodes[i])&&m===2?0:m);
const weakPoint=n=>n.weak||n.kind==='weak';
const boneFaces={'FOE-59':'FOE-59-26-49','FOE-60':'FOE-60-26-53','FOE-61':'FOE-61-26-57'};
const healing={'FOE-22':1,'FOE-24':2,'FOE-73':3};
const ice='FOE-11', lizard='FOE-167', wolf='FOE-177', storm='FOE-179', water='FOE-185', spirit='FOE-194';
const allWounded=(t,marks)=>t.nodes.some(hasWound)&&t.nodes.every((n,i)=>!hasWound(n)||marks[i]===2);
const boneState=f=>f.effects?.phase==='bones'||f.effects?.phase==='bonesDestroyed';
const iceState=f=>f.effects?.phase==='iceArmor'||f.effects?.phase==='iceWounds';
const inactive=f=>boneState(f)||iceState(f);
const eligibleHealing=(t,f)=>t.nodes.map((n,i)=>f.marks[i]===2&&!weakPoint(n)?i:-1).filter(i=>i>=0);

function validateEffects(t,value){
 if(value===undefined)return;
 need(value&&typeof value==='object'&&!Array.isArray(value)&&!t.reference&&(!t.scene||t.cardId===ice));
 for(const [key,v] of Object.entries(value)){
  if(key==='phase'){
   need((boneFaces[t.cardId]&&['bones','bonesDestroyed'].includes(v))||
    (t.cardId===wolf&&v==='revived')||(t.cardId===ice&&['iceArmor','iceWounds'].includes(v)));
  }else{
   const allow=key==='leaf'&&t.cardId===lizard?3:key==='regen'&&t.cardId==='FOE-42'?t.nodes.length:
    key==='heal'&&(healing[t.cardId]||t.cardId==='FOE-42')?t.nodes.length:
    key==='storm'&&t.cardId===storm?9999:undefined;
   need(allow!==undefined&&Number.isInteger(v)&&v>=0&&v<=allow);
  }
 }
}
function normalizeAttack(w){for(let i=1;i<w.nodes.length;i++)w.nodes[i].tier=Math.max(w.nodes[i].tier,w.nodes[w.nodes[i].parent].tier);return w;}
function setTier(w,index,tier){if(!index)return false;const before=w.nodes.map(n=>n.tier),n=w.nodes[index];n.tier=Math.max(w.nodes[n.parent].tier,Math.min(2,Math.max(0,tier)));normalizeAttack(w);return w.nodes.some((n,i)=>n.tier!==before[i]);}
function depths(w){const d=[];w.nodes.forEach((n,i)=>d.push(i?d[n.parent]+1:0));return d;}
function validate(raw,catalog){
 need(raw&&[1,2,3].includes(raw.version));const source=C(raw),v=source.version;
 const base=Old.validate({...source,version:Math.min(v,2),undo:[]},catalog);
 for(const f of base.foes){
  const t=catalog.find(t=>t.key===f.template),original=source.foes.find(x=>x.id===f.id);
  validateEffects(t,f.effects);
  f.marks=cleanMarks(t,f.marks);let past=original.history;
  if(v<3){past=[];let last=null;for(const snapshot of source.undo||[]){const prior=Old.validate({...snapshot,undo:[]},catalog).foes.find(x=>x.id===f.id);if(prior&&JSON.stringify(prior.marks)!==JSON.stringify(last)){past.push(prior.marks);last=prior.marks;}}if(past.length&&JSON.stringify(past.at(-1))===JSON.stringify(f.marks))past.pop();}
  need(past===undefined||Array.isArray(past)&&past.length<=30);
  f.history=(past||[]).map(entry=>{
   const legacy=Array.isArray(entry);
   const marks=legacy?entry:entry?.marks;
   need(Array.isArray(marks)&&marks.length===t.nodes.length);
   if(!legacy){
    need(entry&&typeof entry==='object');
    validateEffects(t,entry.effects);
   }
   const fixture={...base,foes:[{...f,history:undefined,marks}],selected:0,undo:[]};
   const normalized=cleanMarks(t,Old.validate(fixture,catalog).foes[0].marks);
   return legacy?normalized:{marks:normalized,effects:entry.effects};
  });
 }
 base.attacks.forEach(normalizeAttack);base.version=3;base.undo=[];need(JSON.stringify(base).length<=800000);return base;
}
function defaults(){return{...Old.defaults(),version:3};}
const signature=f=>JSON.stringify([f.marks,f.effects]);
function record(f,marks,effects=f.effects){
 if(signature(f)===signature({marks,effects}))return false;
 const previous=f.effects||effects?{marks:[...f.marks],effects:f.effects}:[...f.marks];
 f.history=[...(f.history||[]),previous].slice(-30);
 f.marks=[...marks];
 if(effects)f.effects={...effects};else delete f.effects;
 return true;
}
function undo(f){
 if(!f.history?.length)return false;
 const entry=f.history.pop();
 f.marks=Array.isArray(entry)?entry:entry.marks;
 if(entry.effects)f.effects=entry.effects;else delete f.effects;
 return true;
}
function defeated(t,f){
 if(boneState(f))return f.effects.phase==='bonesDestroyed';
 return !iceState(f)&&!t.reference&&!t.manualOnly&&allWounded(t,f.marks);
}
function cardFace(catalog,t,f){return boneState(f)?catalog.find(face=>face.key===boneFaces[t.cardId])||t:t;}
function canRespawn(t,f){
 return t.cardId===water&&!t.scene&&!t.reference&&(allWounded(t,f.marks)||
  t.nodes.filter(weakPoint).length===2&&t.nodes.every((n,i)=>!weakPoint(n)||f.marks[i]===2));
}
function restoreWound(t,f,index){
 if(inactive(f)||f.marks[index]!==2||!hasWound(t.nodes[index]))return false;
 const effects=f.effects;
 if(effects?.regen||effects?.heal&&!eligibleHealing(t,f).includes(index))return false;
 const marks=[...f.marks];marks[index]=0;
 return record(f,marks,effects?.heal?{...effects,heal:effects.heal-1}:effects);
}
function configureRegeneration(t,f,threat){
 const count=f.effects?.regen;
 if(!count||t.cardId!=='FOE-42'||!Number.isInteger(threat)||threat<0||threat>999)return false;
 // Each triggered weak point raises threat before its regeneration resolves.
 const amount=count*threat+count*(count+1)/2;
 return record(f,f.marks,{...f.effects,regen:0,heal:Math.min(eligibleHealing(t,f).length,(f.effects.heal||0)+amount)});
}
function settleCardAction(t,f,action,value){
 if(action==='markBones'&&boneFaces[t.cardId]&&!inactive(f)&&allWounded(t,f.marks))
  return record(f,f.marks.map(m=>m===2?0:m),{...f.effects,phase:'bones'});
 if(action==='rise'&&f.effects?.phase==='bones')return record(f,f.marks,{});
 if(action==='destroyBones'&&f.effects?.phase==='bones')return record(f,f.marks,{...f.effects,phase:'bonesDestroyed'});
 if(action==='respawn'&&canRespawn(t,f))return record(f,t.nodes.map(Old.initialMark));
 if(action==='endHealing'&&f.effects?.heal)return record(f,f.marks,{...f.effects,heal:0});
 if(action==='endHealing'&&f.effects?.regen)return record(f,f.marks,{...f.effects,regen:0});
 if(action==='regenerate')return configureRegeneration(t,f,value);
 if(action==='setLeaf'&&t.cardId===lizard&&Number.isInteger(value)&&value>=0&&value<=3)return record(f,f.marks,{...f.effects,leaf:value});
 if(t.cardId===storm&&!defeated(t,f)){
  const count=f.effects?.storm||0;
  if(action==='charge'&&[1,2,3,5].includes(value)&&count+value<=9999)return record(f,f.marks,{...f.effects,storm:count+value});
  if(action==='discharge'&&count>=5)return record(f,f.marks,{...f.effects,storm:0});
 }
 return false;
}
function woundCount(t,f){return t.nodes.filter((n,i)=>hasWound(n)&&f.marks[i]===2).length;}
function cycleMark(n,m){const v=hasWound(n)?[0,2,...(Old.armorLevel(n)?[1]:[]),...(Old.armorLevel(n)===2?[3]:[])]:[0,...(Old.armorLevel(n)?[1]:[]),...(Old.armorLevel(n)===2?[3]:[])];return v[(v.indexOf(m)+1)%v.length];}
function resultFor(t,f){return{marks:cleanMarks(t,f.marks),effects:f.effects,events:[],paths:[],wounds:0,armor:0,weak:[],criticals:[],blocked:[],valid:false,defeated:false};}
function preventDamage(t,f,r,points,ignoreSpirit=false){
 if(t.reference||inactive(f)||f.effects?.heal||f.effects?.regen)return true;
 if(t.cardId===spirit&&!ignoreSpirit&&points>0){
  r.message='灵体免疫伤害';
  return true;
 }
 if(t.cardId==='FOE-61'&&points===1){
  r.message='盾牌挡住了 1 点伤害的攻击轨迹';
  return true;
 }
 if(f.effects?.leaf>0&&points>0){
  r.effects={...f.effects,leaf:f.effects.leaf-1};
  r.message='叶盾抵消本次伤害，剩余 '+r.effects.leaf+' 次';
  r.valid=true;
  return true;
 }
 return false;
}
function iceOutcome(t,marks){
 if(!marks.some(m=>m===1||m===3))return 'iceArmor';
 if(allWounded(t,marks))return 'iceWounds';
}
function damage(t,r,index,piercing,step,depth,critical=false){
 const n=t.nodes[index],before=r.marks[index];if(!hittable(n,before))return null;
 const layers=before===3?2:before===1?1:0,hardened=before===3;let after=before,removed=0;
 // KEY-502: hardened blocks descendants; piercing removes only this layer.
 // Critical bonus damage is evaluated after the whole attack pattern.
 if(hardened){after=1;removed=1;}else if(before===1){removed=1;after=piercing&&hasWound(n)?2:0;}else if(hasWound(n))after=2;
 if(after===before)return null;r.marks[index]=after;r.armor+=removed;
 if(after===2){r.wounds++;if(n.weak||n.kind==='weak')r.weak.push(index);}
 const e={index,before,after,layers,removed,step,depth,critical,piercing:!!piercing,blocked:hardened};r.events.push(e);if(hardened&&!critical)r.blocked.push(step);return e;
}
function finish(t,r){
 r.valid=r.events.length>0;
 if(!r.valid)return r;
 if(t.cardId===ice){
  // The ice encounter ends as soon as either of its objectives is met.
  const marks=[...r.marks];
  for(const event of [...r.events].reverse())marks[event.index]=event.before;
  const end=r.events.findIndex(event=>{
   marks[event.index]=event.after;
   const phase=iceOutcome(t,marks);
   if(!phase)return false;
   r.effects={...r.effects,phase};
   return true;
  });
  if(end>=0){
   r.events=r.events.slice(0,end+1);
   r.marks=marks;
   r.wounds=r.events.filter(e=>e.after===2).length;
   r.armor=r.events.reduce((n,e)=>n+e.removed,0);
   r.criticals=[];r.weak=[];
   r.message='冰封之中已结算';
  }
  return r;
 }
 const down=allWounded(t,r.marks)&&!t.manualOnly;
 r.weak=down?[]:[...new Set(r.weak)];
 if(down&&boneFaces[t.cardId]){
  r.marks=r.marks.map(m=>m===2?0:m);
  r.effects={...r.effects,phase:'bones'};
  r.message='已倒下，翻到骸骨堆';
 }else if(down&&t.cardId===wolf&&r.effects?.phase!=='revived'){
  r.marks=r.marks.map(m=>m===2?0:m);
  r.effects={...r.effects,phase:'revived'};
  r.message='不灭生效，移除伤口并获得 1 个力量标记';
 }else if(r.weak.length){
  const eligible=eligibleHealing(t,r).length;
  if(eligible&&t.cardId==='FOE-42')r.effects={...r.effects,regen:r.weak.length};
  if(eligible&&healing[t.cardId])r.effects={...r.effects,heal:Math.min(eligible,r.weak.length*healing[t.cardId])};
  if(t.cardId===storm){
   const count=Math.min(9999,(r.effects?.storm||0)+2*r.weak.length);
   r.effects={...r.effects,storm:count};
   r.message='弱点效果 · 风暴计数 '+count;
  }
  if(t.cardId===water&&canRespawn(t,r))r.message='两个弱点已受伤 · 若有有效缚灵球，可确认重生';
 }
 if(down&&canRespawn(t,r))r.message='水元素已倒下 · 若有有效缚灵球，可确认重生';
 if(down&&t.cardId===spirit)r.message='传说裹纱鬼已击败 · 抽取事件-204';
 r.defeated=defeated(t,r);
 return r;
}
function vector(t,a,b){return{x:(b.x-a.x)*t.width,y:(b.y-a.y)*t.height};}
function onRay(t,a,b,dx,dy){const v=vector(t,a,b),length=Math.hypot(dx,dy),projection=(v.x*dx+v.y*dy)/length,cross=Math.abs(v.x*dy-v.y*dx)/length;return projection>3&&cross<Math.max(6,(b.r||.03)*t.width*.45)?projection:0;}
function entries(t,f,w){if(t.manualOnly&&t.cardId!==ice||t.reference||inactive(f))return[];const[dx,dy]=Old.dirs[w.entry];return t.nodes.map((_,i)=>i).filter(i=>hittable(t.nodes[i],f.marks[i])&&(w.aimed||!t.nodes.some((n,j)=>i!==j&&hittable(n,f.marks[j])&&onRay(t,t.nodes[i],n,-dx,-dy)>0)));}
function rayEnd(t,p,dx,dy){const x=p.x*t.width,y=p.y*t.height,limits=[];if(dx)limits.push(((dx>0?t.width:0)-x)/dx);if(dy)limits.push(((dy>0?t.height:0)-y)/dy);const d=Math.max(0,Math.min(...limits.filter(n=>n>=0)));return{x:(x+dx*d)/t.width,y:(y+dy*d)/t.height};}
function preview(t,f,w,tier,entry,ignoreSpirit=false){
 const r=resultFor(t,f);if(tier<0||!entries(t,f,w).includes(entry))return r;const hits=[],stops=[],crossed=new Set(),levels=depths(w);
 if(preventDamage(t,f,r,w.nodes.filter(n=>n.tier<=tier).length,ignoreSpirit))return r;
 function ray(start,dx,dy,step){
  const candidates=t.nodes.map((n,i)=>({i,d:hittable(n,r.marks[i])?onRay(t,start,n,dx,dy):0})).filter(p=>p.d>0).sort((a,b)=>a.d-b.d),chosen=candidates[0],end=chosen?t.nodes[chosen.i]:rayEnd(t,start,dx,dy);
  r.paths.push({from:start,to:end,step,depth:levels[step]});const max=chosen?.d??Math.hypot((end.x-start.x)*t.width,(end.y-start.y)*t.height);
  (t.criticals||[]).forEach((c,i)=>{const d=onRay(t,start,c,dx,dy);if(d&&d<max)crossed.add(i);});return chosen?.i;
 }
 w.nodes.forEach((n,i)=>{if(n.tier>tier||i&&stops[n.parent]){hits[i]=undefined;stops[i]=true;return;}let hit;
  if(!i){const[dx,dy]=Old.dirs[w.entry],p=t.nodes[entry];if(w.aimed){hit=entry;r.paths.push({from:p,to:p,step:i,depth:0});}else hit=ray({x:p.x-dx*2,y:p.y-dy*2*t.width/t.height},dx,dy,i);}
  else if(hits[n.parent]!==undefined)hit=ray(t.nodes[hits[n.parent]],n.dx,n.dy,i);
  hits[i]=hit;const e=hit!==undefined?damage(t,r,hit,n.piercing,i,levels[i]):null;stops[i]=hit===undefined||!!e?.blocked;
 });let bonusDepth=Math.max(0,...levels)+1;
 crossed.forEach(i=>{r.criticals.push(i);for(const target of t.criticals[i].targets)damage(t,r,target,false,w.nodes.length+i,bonusDepth,true);bonusDepth++;});return finish(t,r);
}
function freePreview(t,f,indices,piercing=false,strokes){
 const r=resultFor(t,f),seen=new Set(),blocked=new Set(),levels=new Map(),crossed=new Set(),paths=strokes?.length?strokes.map(s=>s.hits||s):[indices];
 const points=new Set(paths.flat().filter(i=>Number.isInteger(i)&&t.nodes[i]&&hittable(t.nodes[i],f.marks[i])));
 if(preventDamage(t,f,r,points.size))return r;
 for(const line of paths){let previous=null,depth=0;for(const i of line){
  if(!Number.isInteger(i)||!t.nodes[i]||!hittable(t.nodes[i],f.marks[i]))continue;
  if(previous!==null){const a=t.nodes[previous],b=t.nodes[i];r.paths.push({from:a,to:b,depth,step:r.events.length});if(!t.manualOnly&&!t.reference)(t.criticals||[]).forEach((c,j)=>{const v=vector(t,a,b),length=Math.hypot(v.x,v.y),offset=vector(t,a,c),along=length?(offset.x*v.x+offset.y*v.y)/length:0,cross=length?Math.abs(offset.x*v.y-offset.y*v.x)/length:Infinity;if(along>3&&along<length-3&&cross<Math.max(5,(c.r||.02)*t.width*.6))crossed.add(j);});}
  if(!seen.has(i)){const e=damage(t,r,i,piercing,r.events.length,depth);seen.add(i);levels.set(i,depth);if(e?.blocked)blocked.add(i);}if(blocked.has(i))break;previous=i;depth=(levels.get(i)??depth)+1;
 }}let bonusDepth=Math.max(0,...levels.values())+1;crossed.forEach(i=>{r.criticals.push(i);for(const target of t.criticals[i].targets)damage(t,r,target,false,r.events.length,bonusDepth,true);bonusDepth++;});return finish(t,r);
}
// A swipe is a polyline in card coordinates, not a preselected attack pattern.
function circleEntry(a,b,c,r){
 const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y,aa=dx*dx+dy*dy;
 if(ox*ox+oy*oy<=r*r)return 0;if(aa<1e-12)return null;
 const bb=2*(ox*dx+oy*dy),cc=ox*ox+oy*oy-r*r,disc=bb*bb-4*aa*cc;
 if(disc<0)return null;const u=(-bb-Math.sqrt(disc))/(2*aa);return u>=0&&u<=1?u:null;
}
function slicePreview(t,f,points,extraRadius=0,cache=null,ignoreSpirit=false){
 const r=resultFor(t,f);r.criticalPaths=[];if(!points?.length)return r;
 const c=cache||{},signature=f.marks.join(',');
 if(c.template!==t||c.radius!==extraRadius||c.signature!==signature||c.count>points.length){
  Object.assign(c,{template:t,radius:extraRadius,signature,count:0,distance:0,checks:0,encounters:[],first:new Set(),objects:[...t.nodes.map((n,index)=>({kind:'point',index,x:(n.drawX??n.x)*t.width,y:(n.drawY??n.y)*t.height,r:n.r*t.width*1.1+extraRadius})),...(t.manualOnly||t.reference?[]:(t.criticals||[]).map((v,index)=>({kind:'critical',index,x:v.x*t.width,y:v.y*t.height,r:(v.r||.02)*t.width*1.12+extraRadius*.4})))]});
 }
 function segment(a,b){
  const from={x:a.x*t.width,y:a.y*t.height},to={x:b.x*t.width,y:b.y*t.height},length=Math.hypot(to.x-from.x,to.y-from.y);
  if(length>0&&c.distance===0)for(const hit of c.encounters)if(hit.distance===0)hit.angle=Math.atan2(to.y-from.y,to.x-from.x);
  for(const o of c.objects){const key=o.kind+o.index;if(c.first.has(key)||o.kind==='point'&&!hittable(t.nodes[o.index],f.marks[o.index]))continue;c.checks++;const u=circleEntry(from,to,o,o.r);if(u===null)continue;c.first.add(key);c.encounters.push({...o,distance:c.distance+u*length,angle:length?Math.atan2(to.y-from.y,to.x-from.x):-Math.PI/4});}
  c.distance+=length;
 }
 if(c.count===0)segment(points[0],points[0]);
 for(let k=Math.max(1,c.count);k<points.length;k++)segment(points[k-1],points[k]);
 c.count=points.length;const encounters=c.encounters;
 encounters.sort((a,b)=>a.distance-b.distance||(a.kind==='point'?-1:1));
 const pointsHit=encounters.filter(hit=>hit.kind==='point').length;
 const attemptedDamage=pointsHit||Number(encounters.length>0&&f.effects?.leaf>0);
 if(preventDamage(t,f,r,attemptedDamage,ignoreSpirit))return r;
 let depth=0,previous=null,stop=Infinity;const criticals=[];
 for(const hit of encounters){
  if(hit.distance>stop+.01)break;if(hit.kind==='critical'){criticals.push(hit.index);continue;}
  const n=t.nodes[hit.index];if(previous!==null)r.paths.push({from:t.nodes[previous],to:n,step:depth,depth});
  const e=damage(t,r,hit.index,false,depth,depth);if(e){e.angle=hit.angle;e.distance=hit.distance;depth++;previous=hit.index;if(e.blocked)stop=hit.distance;}
 }
 for(const index of criticals){const c=t.criticals[index];r.criticals.push(index);for(const target of c.targets){const e=damage(t,r,target,false,r.events.length,depth,true);if(e){e.angle=Math.atan2((t.nodes[target].y-c.y)*t.height,(t.nodes[target].x-c.x)*t.width);r.criticalPaths.push({from:c,to:t.nodes[target],index:target});}}depth++;}
 return finish(t,r);
}

function timeline(events,gap=160){const last=new Map();return events.map(e=>{let at=(e.depth??e.step??0)*gap;if(last.has(e.index))at=Math.max(at,last.get(e.index)+gap);last.set(e.index,at);return{event:e,at};});}
function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,z=x*x+y*y,k=z?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/z)):0;return Math.hypot(p.x-a.x-k*x,p.y-a.y-k*y);}
g.Combat97={...Old,validate,defaults,record,undo,defeated,woundCount,freePreview,preview,slicePreview,circleEntry,entries,hasWound,hittable,cycleMark,normalizeAttack,setTier,depths,timeline,segmentDistance,signature,cardFace,canRespawn,inactive,eligibleHealing,restoreWound,settleCardAction,instance:(t,index)=>({...Old.instance(t,index),history:[],...(t.cardId===lizard?{effects:{leaf:3}}:{})})};
})(typeof window!=='undefined'?window:globalThis);
