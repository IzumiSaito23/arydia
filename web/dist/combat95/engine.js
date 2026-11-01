(function(g){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),dirs=[[0,1,'北'],[-1,1,'东北'],[-1,0,'东'],[-1,-1,'东南'],[0,-1,'南'],[1,-1,'西南'],[1,0,'西'],[1,1,'西北']];
function blankAttack(){return{id:'a'+Date.now().toString(36),name:'我的攻击',entry:0,aimed:false,nodes:[{parent:-1,dx:0,dy:0,tier:0,piercing:false}]};}
function instance(template,index=1){return{id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),template:template.key,index,marks:template.nodes.map(n=>n.armor||n.kind==='armor'?1:0)};}
function vector(t,a,b){return{x:(b.x-a.x)*t.width,y:(b.y-a.y)*t.height};}
function onRay(t,a,b,dx,dy){const v=vector(t,a,b),length=Math.hypot(dx,dy),projection=(v.x*dx+v.y*dy)/length,cross=Math.abs(v.x*dy-v.y*dx)/length;return projection>3&&cross<Math.max(6,(b.r||.03)*t.width*.45)?projection:0;}
function entries(t,f,w){if(t.manualOnly||t.reference)return [];const[dx,dy]=dirs[w.entry];return t.nodes.map((p,i)=>i).filter(i=>f.marks[i]!==2&&(w.aimed||!t.nodes.some((p,j)=>j!==i&&f.marks[j]!==2&&onRay(t,t.nodes[i],p,-dx,-dy)>0)));}
function preview(t,f,w,tier,entry){
 const result={marks:[...f.marks],paths:[],wounds:0,armor:0,weak:[],criticals:[],valid:false,defeated:false};if(tier<0||!entries(t,f,w).includes(entry))return result;result.valid=true;
 const hits=[],crossed=new Set();const hurt=(index,piercing)=>{if(result.marks[index]===2)return;if(result.marks[index]===1){result.armor++;result.marks[index]=0;if(!piercing)return;}result.marks[index]=2;result.wounds++;if(t.nodes[index].weak||t.nodes[index].kind==='weak')result.weak.push(index);};
 const ray=(start,dx,dy,step)=>{const length=Math.hypot(dx,dy),options=t.nodes.map((p,i)=>({i,d:result.marks[i]!==2?onRay(t,start,p,dx,dy):0})).filter(x=>x.d>0).sort((a,b)=>a.d-b.d),chosen=options[0];const end=chosen?t.nodes[chosen.i]:{x:start.x+dx/length*.35,y:start.y+dy/length*.35*t.width/t.height};result.paths.push({from:start,to:end,step});const max=chosen?.d||Infinity;(t.criticals||[]).forEach((c,i)=>{const distance=onRay(t,start,c,dx,dy);if(distance&&distance<max)crossed.add(i);});return chosen?.i;};
 w.nodes.forEach((node,i)=>{if(node.tier>tier){hits.push(undefined);return;}let hit;if(i===0){const[dx,dy]=dirs[w.entry],p=t.nodes[entry];if(w.aimed){hit=entry;result.paths.push({from:p,to:p,step:i});}else hit=ray({x:p.x-dx*2,y:p.y-dy*2*t.width/t.height},dx,dy,i);}else{const from=hits[node.parent];if(from!==undefined)hit=ray(t.nodes[from],node.dx,node.dy,i);}hits.push(hit);if(hit!==undefined)hurt(hit,node.piercing);});
 crossed.forEach(i=>{result.criticals.push(i);for(const n of t.criticals[i].targets)hurt(n,false);});result.defeated=result.marks.every(n=>n===2);if(result.defeated)result.weak=[];return result;
}
function validate(s,catalog,withUndo=true){
 const need=ok=>{if(!ok)throw Error('战斗记录格式无效');},ident=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
 need(s&&s.version===1&&Array.isArray(s.foes)&&s.foes.length<=24&&Array.isArray(s.attacks)&&s.attacks.length>0&&s.attacks.length<=60);
 const ids=new Set();for(const f of s.foes){const t=catalog.find(t=>t.key===f.template);need(t&&ident(f.id)&&!ids.has(f.id)&&Number.isInteger(f.index)&&f.index>=0&&f.index<=99&&Array.isArray(f.marks)&&f.marks.length===t.nodes.length&&f.marks.every((m,i)=>[0,1,2].includes(m)&&(m!==1||t.nodes[i].armor||t.nodes[i].kind==='armor')));ids.add(f.id);}
 const attacks=new Set();for(const w of s.attacks){need(ident(w.id)&&!attacks.has(w.id)&&typeof w.name==='string'&&w.name.trim().length>0&&w.name.length<=40&&Number.isInteger(w.entry)&&w.entry>=0&&w.entry<=7&&typeof w.aimed==='boolean'&&Array.isArray(w.nodes)&&w.nodes.length>0&&w.nodes.length<=20);attacks.add(w.id);w.nodes.forEach((n,i)=>{need(Number.isInteger(n.parent)&&(i===0?n.parent===-1:n.parent>=0&&n.parent<i)&&Number.isInteger(n.tier)&&n.tier>=0&&n.tier<=2&&typeof n.piercing==='boolean'&&Number.isInteger(n.dx)&&Number.isInteger(n.dy)&&Math.abs(n.dx)<=1&&Math.abs(n.dy)<=1&&(i===0?(n.dx===0&&n.dy===0&&n.tier===0):(n.dx!==0||n.dy!==0)&&n.tier>=w.nodes[n.parent].tier));});}
 need(Number.isInteger(s.selected)&&s.selected>=0&&s.selected<Math.max(1,s.foes.length)&&attacks.has(s.attack)&&Number.isInteger(s.tier)&&s.tier>=0&&s.tier<=2);
 if(withUndo){need(s.undo===undefined||Array.isArray(s.undo)&&s.undo.length<=30);for(const prior of s.undo||[]){need(!Object.prototype.hasOwnProperty.call(prior,'undo'));validate(prior,catalog,false);}need(JSON.stringify(s).length<=1048576);}
 return clone(s);
}
function base(s){const o=clone(s);delete o.undo;return o;}
function defaults(){const a=blankAttack();a.name='直线攻击';return{version:1,foes:[],attacks:[a],selected:0,attack:a.id,tier:0,undo:[]};}
g.Combat95={clone,dirs,blankAttack,instance,entries,preview,validate,defaults,base};
})(typeof window!=='undefined'?window:globalThis);
