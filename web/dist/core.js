(function(root){
'use strict';
const D=root.DATA;
const clone=x=>JSON.parse(JSON.stringify(x));
const race=id=>D.races.find(x=>x.id===id);
const path=id=>D.paths.find(x=>x.id===id);
const norm=s=>{let t=String(s||'').normalize('NFKC').trim().toUpperCase().replace(/[－—–]/g,'-').replace(/\s+/g,'');const aliases={...Object.fromEntries(Object.entries(D.categories).map(([k,v])=>[v,k])),...D.searchAliases};for(const [name,id]of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length))t=t.split(name).join(id);return t.replace(new RegExp('^('+Object.keys(D.categories).join('|')+')-?'),'$1-').replace(/(\d)-([A-Z])$/,'$1$2');};
const normalizedIds=new Map(D.records.map(r=>[r.id,norm(r.id)]));
const recordIndex=new Map(D.records.map(r=>[normalizedIds.get(r.id),r]));
const resolve=id=>{const q=norm(id);return recordIndex.get(q)||recordIndex.get(q.replace(/(\d)A$/,'$1'));};
const display=id=>String(id).replace(/DOS-T(?=\d)/gi,'板块-称号').replace(/AT LEAST (\d+) SQUILLS/g,'至少 $1 枚梓昆币').replace(/START:\s*/g,'起点：').replace(/\b([A-Z]+)-/g,(m,p)=>(D.categories[p]||p)+'-');
function defaults(){return {version:1,characters:[],active:null,bookmarks:[],squills:[],notes:'',prefs:{stage:1,cap:4,titles:false,locations:false,before:false,after:false,startOnly:true},recent:[]};}
function create(name,r,p,portrait){
 if(!race(r)||!path(p)||!name.trim())throw Error('请填写角色名字并选择种族与道途');
 return {id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),name:name.trim().slice(0,40),title:'',rank:'',race:r,path:p,portrait:portrait===1?1:0,xp:0,kae:0,growth:[],current:race(r).stats.map(x=>x[0]),skills:{4:{learned:true,mastered:true,equipped:true},5:{learned:true,mastered:true,equipped:true}},equipment:'',notes:'',log:[]};
}
function derived(c){let max=race(c.race).stats.map(x=>x[0]),attrs=[...race(c.race).attrs];c.growth.forEach((g,i)=>{max[g.core]=race(c.race).stats[g.core][i+1];attrs[g.attr]=Math.min(i+2,10);});return {level:c.growth.length,max,attrs,cost:D.xp[c.growth.length]||0};}
function sheet(c){
 if(c.sheet)return c.sheet;
 const r=race(c.race),levels=Array(11).fill(false),marks=Array.from({length:9},()=>Array(11).fill(false));levels[0]=true;
 for(let row=0;row<9;row++)marks[row][0]=row<3||r.attrs[row-3]===1;
 (c.growth||[]).forEach((g,i)=>{levels[i+1]=true;marks[g.core][i+1]=true;marks[g.attr+3][i+1]=true;});
 return c.sheet={levels,marks};
}
function cardDerived(c){const s=sheet(c),r=race(c.race);let level=0,max=r.stats.map(v=>v[0]),attrs=[...r.attrs];s.levels.forEach((v,i)=>{if(v)level=i;});s.marks.forEach((row,j)=>row.forEach((v,i)=>{if(!v||i===0)return;if(j<3)max[j]=Math.max(max[j],r.stats[j][i]);else attrs[j-3]=Math.max(attrs[j-3],Math.min(i+1,10));}));return {level,max,attrs,cost:D.xp[level]||0};}
function toggleMark(c,row,col){
 if(!Number.isInteger(col)||col<1||col>10||!Number.isInteger(row)||row< -1||row>8)throw Error('无效的勾选位置');
 const s=sheet(c),level=cardDerived(c).level;
 if(row===-1){
  if(!s.levels[col]&&col!==level+1)throw Error("请按顺序提升等级，下一等级为 "+(level+1));
  if(s.levels[col]&&col!==level)throw Error("请先取消更高等级");
  if(s.levels[col]){const next=s.levels.reduce((n,on,i)=>on&&i!==col?i:n,0);if(next<level){const marked=s.marks.reduce((n,r)=>Math.max(n,r.reduce((m,on,i)=>on?i:m,0)),0);if(marked>next)throw Error('请先取消第'+marked+'级列的属性勾选，再降低角色等级');}}
  s.levels[col]=!s.levels[col];
 }else {const on=!s.marks[row][col];if(on){if(col>level)throw Error('需要达到'+col+'级才能提升此属性（当前'+level+'级）');const start=row<3?0:3,end=row<3?3:9;for(let i=start;i<end;i++)s.marks[i][col]=false;}s.marks[row][col]=on;}
 const max=cardDerived(c).max;c.current=c.current.map((v,i)=>Math.min(v,max[i]));return c;
}
function prerequisites(c,id){return (root.SKILL_EDGES[c.path]||[]).filter(e=>e[1]===Number(id)).map(e=>e[0]);}
function toggleSkill(c,id,key){
 if(!path(c.path).skills.some(s=>s.id===id)||!['learned','mastered','equipped'].includes(key))throw Error('无效的技能位置');
 const s=c.skills[id]||{learned:false,mastered:false,equipped:false},on=!s[key];
 if(key==='equipped'&&on&&Object.values(c.skills).filter(v=>v.equipped).length>=5)throw Error('最多装备5个道途技能，请先取消一个装备勾选');
 const missing=prerequisites(c,id).filter(n=>!c.skills[n]?.learned);
 if(on&&missing.length)throw Error('先决技能：'+missing.map(n=>path(c.path).prefix+'-'+n).join(', '));
 const dependent=(root.SKILL_EDGES[c.path]||[]).filter(e=>e[0]===id&&c.skills[e[1]]?.learned).map(e=>e[1]);
 if(key==='learned'&&!on&&dependent.length)throw Error('请先取消后续技能：'+dependent.map(n=>path(c.path).prefix+'-'+n).join(', '));
 s[key]=on;if(key==='learned'&&!on){s.mastered=false;s.equipped=false;}else if(on)s.learned=true;
 c.skills[id]=s;return c;
}
function canLearn(c,id){const s=path(c.path).skills.find(x=>x.id===Number(id));return s&&!c.skills[id]?.learned&&prerequisites(c,id).every(x=>c.skills[x]?.learned);}
function switchPath(c,next){
 if(!path(next))throw Error('请选择有效道途');if(c.path===next)return c;
 sheet(c);const old=path(c.path),records=c.pathRecords||(c.pathRecords={});
 records[c.path]={skills:clone(c.skills),growth:clone(c.growth),rank:c.rank||''};
 const saved=records[next]||{skills:create(c.name,c.race,next,c.portrait).skills,growth:[],rank:''};
 if(c.name===race(c.race).name+' · '+old.name)c.name=race(c.race).name+' · '+path(next).name;
 c.path=next;c.skills=clone(saved.skills);c.growth=clone(saved.growth);c.rank=saved.rank||'';return c;
}
function validatePathRecord(record,pid){
 if(!record||!Array.isArray(record.growth)||record.growth.length>10||!record.skills||typeof record.skills!=='object')throw Error('道途存档无效');
 const out={skills:{},growth:[],rank:record.rank||''},unlocked=new Set([4,5]);
 if(typeof out.rank!=='string'||out.rank.length>20000)throw Error('道途头衔无效');
 for(const g of record.growth){const sk=path(pid).skills.find(s=>s.id===g?.skill);if(!g||!Number.isInteger(g.core)||g.core<0||g.core>2||!Number.isInteger(g.attr)||g.attr<0||g.attr>5||!sk||sk.id<6||unlocked.has(sk.id)||!sk.requires.every(id=>unlocked.has(id)))throw Error('道途成长存档无效');unlocked.add(sk.id);out.growth.push({core:g.core,attr:g.attr,skill:g.skill});}
 for(const sk of path(pid).skills){const v=record.skills[sk.id];if(!v)continue;if(!['learned','mastered','equipped'].every(k=>typeof v[k]==='boolean')||((v.mastered||v.equipped)&&!v.learned))throw Error('道途技能存档无效');out.skills[sk.id]={learned:v.learned,mastered:v.mastered,equipped:v.equipped};}
 if(Object.values(out.skills).filter(s=>s.equipped).length>5)throw Error('道途装备存档无效');return out;
}
function undoLevel(c){const level=c.growth.length;if(!level)throw Error('没有可撤销的升级');if(c.xp+D.xp[level-1]>999999)throw Error('退回经验后会超过记录上限，请先调整经验');const g=c.growth.pop();c.xp+=D.xp[level-1];delete c.skills[g.skill];const max=derived(c).max;c.current=c.current.map((n,i)=>Math.min(n,max[i]));c.log.unshift({date:new Date().toISOString(),text:'撤销 '+level+' 级成长，退回 '+D.xp[level-1]+' 经验'});return c;}
function levelUp(c,{core,attr,skill,cap}){
 const info=derived(c);if(info.level>=10)throw Error('已经达到10级');if(info.level>=cap)throw Error('已达到当前公会等级上限，请在设置中按游戏进度调整');
 if(c.xp<info.cost)throw Error('经验不足，还需要 '+(info.cost-c.xp)+' 点');
 if(!Number.isInteger(core)||core<0||core>2||!Number.isInteger(attr)||attr<0||attr>5)throw Error('请选择核心属性和基础属性');
 if(!canLearn(c,skill))throw Error('请选择尚未习得、且已满足全部前置的技能');
 c.xp-=info.cost;c.growth.push({core,attr,skill:Number(skill)});c.current=derived(c).max;
 c.skills[skill]={learned:true,mastered:false,equipped:Object.values(c.skills).filter(s=>s.equipped).length<5};
 c.log.unshift({date:new Date().toISOString(),text:'升至 '+c.growth.length+' 级，消耗 '+info.cost+' 经验'});return c;
}
function search(q,{stage=3,category='',bookmarks=null}={}){
 const n=norm(q),plain=String(q).trim().toLowerCase();const found=resolve(q);
 const results=D.records.filter(r=>(!category||r.id.startsWith(category+'-'))&&(!bookmarks||bookmarks.includes(r.id))&&(!plain||normalizedIds.get(r.id).includes(n)||display(r.id).replace(/\s/g,'').includes(plain.replace(/\s/g,''))||r.zh.toLowerCase().includes(plain)||r.en.toLowerCase().includes(plain)||(r.titleAliases||[]).some(t=>t.toLowerCase().includes(plain))||r.id===found?.id));
 return results.sort((a,b)=>(b.id===found?.id?1:0)-(a.id===found?.id?1:0));
}
function relationships(id,dir,startOnly=false){
 let entries=dir==='before'?D.links.filter(x=>x.to===id).map(x=>x.from):D.links.filter(x=>x.from===id).map(x=>x.to);
 if(dir==='before'&&startOnly&&/^(SQL|TBL)-/.test(id))entries=entries.filter(x=>x.startsWith('START:'));
 return [...new Set(entries)];
}
function validate(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.characters)||raw.characters.length>40)throw Error('这不是有效的阿瑞迪亚旅伴备份');
 const s=defaults();
 const num=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
 const str=(v,max)=>typeof v==='string'&&v.length<=max;
 const ids=new Set();
 for(const c of raw.characters){
  if(!c||!str(c.id,80)||!c.id||ids.has(c.id)||!str(c.name,40)||!c.name.trim()||!race(c.race)||!path(c.path)||!Array.isArray(c.growth)||c.growth.length>10||!num(c.xp,999999)||!num(c.kae,999999))throw Error('备份中的角色信息无效');
  ids.add(c.id);const n=create(c.name,c.race,c.path,c.portrait);n.id=c.id;n.xp=c.xp;n.kae=c.kae;
  n.growth=c.growth.map(g=>{if(!g||!num(g.core,2)||!num(g.attr,5)||!num(g.skill,17)||g.skill<6)throw Error('成长记录无效');return {core:g.core,attr:g.attr,skill:g.skill};});
  const unlocked=new Set([4,5]);for(const g of n.growth){const sk=path(c.path).skills.find(k=>k.id===g.skill);if(unlocked.has(g.skill)||!sk.requires.every(id=>unlocked.has(id)))throw Error('成长技能前置无效');unlocked.add(g.skill);}
  n.skills={};for(const sk of path(c.path).skills){let v=c.skills?.[sk.id];if(!v)continue;if(typeof v.learned!=='boolean'||typeof v.mastered!=='boolean'||typeof v.equipped!=='boolean'||(v.mastered||v.equipped)&&!v.learned)throw Error('技能状态无效');n.skills[sk.id]={learned:v.learned,mastered:v.mastered,equipped:v.equipped};}
  if((!c.sheet&&[...unlocked].some(id=>!n.skills[id]?.learned))||Object.values(n.skills).filter(x=>x.equipped).length>5)throw Error('已习得技能或装备数量无效');
  if(c.sheet){
   const s=c.sheet;if(!Array.isArray(s.levels)||s.levels.length!==11||!s.levels.every(v=>typeof v==='boolean')||!s.levels[0]||!Array.isArray(s.marks)||s.marks.length!==9||!s.marks.every(row=>Array.isArray(row)&&row.length===11&&row.every(v=>typeof v==='boolean')))throw Error('勾选表格式无效');
   const initial=sheet(n);if(s.marks.some((row,i)=>row[0]!==initial.marks[i][0]))throw Error('种族初始勾选不匹配');
   for(let col=1;col<11;col++)if(s.marks.slice(0,3).filter(row=>row[col]).length>1||s.marks.slice(3).filter(row=>row[col]).length>1)throw Error('每级只能勾选一项核心属性和一项基础属性');
   n.sheet=clone(s);
  }
  const max=c.sheet?cardDerived(n).max:derived(n).max;if(!Array.isArray(c.current)||c.current.length!==3||!c.current.every((v,i)=>num(v,max[i])))throw Error('角色当前状态超出上限');n.current=[...c.current];
  for(const key of ['title','rank','equipment','notes']){if(c[key]!==undefined&&!str(c[key],20000))throw Error('文字字段过长或格式无效');n[key]=c[key]||'';}
  if(c.pathRecords!==undefined){if(!c.pathRecords||typeof c.pathRecords!=='object'||Array.isArray(c.pathRecords)||Object.keys(c.pathRecords).length>6)throw Error('道途存档无效');n.pathRecords={};for(const [pid,record] of Object.entries(c.pathRecords)){if(!path(pid))throw Error('未知道途存档');n.pathRecords[pid]=validatePathRecord(record,pid);}}
  n.log=Array.isArray(c.log)?c.log.slice(0,100).filter(x=>x&&str(x.date,40)&&str(x.text,200)).map(x=>({date:x.date,text:x.text})):[];s.characters.push(n);
 }
 s.active=ids.has(raw.active)?raw.active:s.characters[0]?.id||null;
 for(const key of ['bookmarks','recent']){if(!Array.isArray(raw[key])||raw[key].some(x=>!str(x,80)))throw Error('索引记录无效');s[key]=[...new Set(raw[key])].filter(x=>resolve(x)).slice(0,key==='recent'?15:1000);}
 if(!Array.isArray(raw.squills)||raw.squills.some(x=>!num(x,35)||x<1))throw Error('梓昆币记录无效');s.squills=[...new Set(raw.squills)];
 if(!str(raw.notes,50000))throw Error('旅程笔记无效');s.notes=raw.notes;
 if(raw.prefs){for(const key of ['titles','locations','before','after','startOnly'])if(typeof raw.prefs[key]==='boolean')s.prefs[key]=raw.prefs[key];if(num(raw.prefs.stage,3)&&raw.prefs.stage>0)s.prefs.stage=raw.prefs.stage;if(num(raw.prefs.cap,10)&&raw.prefs.cap>0)s.prefs.cap=raw.prefs.cap;}
 if(raw.battle!==undefined){if(!root.LegacyRecords)throw Error('旧版存档读取组件未加载');s.battle=root.LegacyRecords.validate(raw.battle);}
 return s;
}
root.Core={prerequisites,clone,race,path,norm,resolve,display,defaults,create,derived,canLearn,levelUp,undoLevel,search,relationships,validate,sheet,cardDerived,toggleMark,toggleSkill,switchPath};
})(typeof window==='undefined'?globalThis:window);
