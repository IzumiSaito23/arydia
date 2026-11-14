(function(g){'use strict';
const Old=g.Combat95,C=Old.clone;
const need=x=>{if(!x)throw Error('战斗记录格式无效，原记录已保留');};
const hasWound=n=>n.hasWound!==false&&!n.armorOnly;
const hittable=(n,m)=>m===1||m===3||m===0&&hasWound(n);
const cleanMarks=(t,marks)=>marks.map((m,i)=>!hasWound(t.nodes[i])&&m===2?0:m);
function normalizeAttack(w){for(let i=1;i<w.nodes.length;i++)w.nodes[i].tier=Math.max(w.nodes[i].tier,w.nodes[w.nodes[i].parent].tier);return w;}
function setTier(w,index,tier){if(!index)return false;const before=w.nodes.map(n=>n.tier),n=w.nodes[index];n.tier=Math.max(w.nodes[n.parent].tier,Math.min(2,Math.max(0,tier)));normalizeAttack(w);return w.nodes.some((n,i)=>n.tier!==before[i]);}
function depths(w){const d=[];w.nodes.forEach((n,i)=>d.push(i?d[n.parent]+1:0));return d;}
function validate(raw,catalog){
 need(raw&&[1,2,3].includes(raw.version));const source=C(raw),v=source.version;
 const base=Old.validate({...source,version:Math.min(v,2),undo:[]},catalog);
 for(const f of base.foes){
  const t=catalog.find(t=>t.key===f.template),original=source.foes.find(x=>x.id===f.id);
  f.marks=cleanMarks(t,f.marks);let past=original.history;
  if(v<3){past=[];let last=null;for(const snapshot of source.undo||[]){const prior=Old.validate({...snapshot,undo:[]},catalog).foes.find(x=>x.id===f.id);if(prior&&JSON.stringify(prior.marks)!==JSON.stringify(last)){past.push(prior.marks);last=prior.marks;}}if(past.length&&JSON.stringify(past.at(-1))===JSON.stringify(f.marks))past.pop();}
  need(past===undefined||Array.isArray(past)&&past.length<=30);
  f.history=(past||[]).map(marks=>{need(Array.isArray(marks)&&marks.length===t.nodes.length);const fixture={...base,foes:[{...f,history:undefined,marks}],selected:0,undo:[]};return cleanMarks(t,Old.validate(fixture,catalog).foes[0].marks);});
 }
 base.attacks.forEach(normalizeAttack);base.version=3;base.undo=[];need(JSON.stringify(base).length<=800000);return base;
}
function defaults(){return{...Old.defaults(),version:3};}
function record(f,marks){if(JSON.stringify(f.marks)===JSON.stringify(marks))return false;f.history=[...(f.history||[]),[...f.marks]].slice(-30);f.marks=[...marks];return true;}
function undo(f){if(!f.history?.length)return false;f.marks=f.history.pop();return true;}
function defeated(t,f){return !t.reference&&!t.manualOnly&&t.nodes.some(hasWound)&&t.nodes.every((n,i)=>!hasWound(n)||f.marks[i]===2);}
function woundCount(t,f){return t.nodes.filter((n,i)=>hasWound(n)&&f.marks[i]===2).length;}
function cycleMark(n,m){const v=hasWound(n)?[0,2,...(Old.armorLevel(n)?[1]:[]),...(Old.armorLevel(n)===2?[3]:[])]:[0,...(Old.armorLevel(n)?[1]:[]),...(Old.armorLevel(n)===2?[3]:[])];return v[(v.indexOf(m)+1)%v.length];}
function resultFor(t,f){return{marks:cleanMarks(t,f.marks),events:[],paths:[],wounds:0,armor:0,weak:[],criticals:[],blocked:[],valid:false,defeated:false};}
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
function finish(t,r){r.valid=r.events.length>0;r.defeated=defeated(t,{marks:r.marks});r.weak=r.defeated?[]:[...new Set(r.weak)];return r;}
function vector(t,a,b){return{x:(b.x-a.x)*t.width,y:(b.y-a.y)*t.height};}
function onRay(t,a,b,dx,dy){const v=vector(t,a,b),length=Math.hypot(dx,dy),projection=(v.x*dx+v.y*dy)/length,cross=Math.abs(v.x*dy-v.y*dx)/length;return projection>3&&cross<Math.max(6,(b.r||.03)*t.width*.45)?projection:0;}
function entries(t,f,w){if(t.manualOnly||t.reference)return[];const[dx,dy]=Old.dirs[w.entry];return t.nodes.map((_,i)=>i).filter(i=>hittable(t.nodes[i],f.marks[i])&&(w.aimed||!t.nodes.some((n,j)=>i!==j&&hittable(n,f.marks[j])&&onRay(t,t.nodes[i],n,-dx,-dy)>0)));}
function rayEnd(t,p,dx,dy){const x=p.x*t.width,y=p.y*t.height,limits=[];if(dx)limits.push(((dx>0?t.width:0)-x)/dx);if(dy)limits.push(((dy>0?t.height:0)-y)/dy);const d=Math.max(0,Math.min(...limits.filter(n=>n>=0)));return{x:(x+dx*d)/t.width,y:(y+dy*d)/t.height};}
function preview(t,f,w,tier,entry){
 const r=resultFor(t,f);if(tier<0||!entries(t,f,w).includes(entry))return r;const hits=[],stops=[],crossed=new Set(),levels=depths(w);
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
function slicePreview(t,f,points,extraRadius=0,cache=null){
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
g.Combat97={...Old,validate,defaults,record,undo,defeated,woundCount,freePreview,preview,slicePreview,circleEntry,entries,hasWound,hittable,cycleMark,normalizeAttack,setTier,depths,timeline,segmentDistance,instance:(t,index)=>({...Old.instance(t,index),history:[]})};
})(typeof window!=='undefined'?window:globalThis);
