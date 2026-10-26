(function(root){
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
const codes={'事件':'EVT','人物':'NPC','互动':'POI','键钥':'KEY','敌人':'FOE','威胁':'THR','委托':'JOB','当日':'DAY','参考':'REF','旅行':'TRV','技能':'SKL','角色':'RACE','游荡':'ROG','法师':'MAG','游侠':'RNG','诗人':'BRD','牧师':'CLR','战士':'WAR'};
function identifier(raw){let s=String(raw||'').normalize('NFKC').replace(/[\s#]/g,'').toUpperCase().replace(/[－—–]/g,'-');for(const [name,code]of Object.entries(codes))s=s.replace(name,code);if(/^\d+[A-E]?$/.test(s))s='KEY-'+s;const m=/^([A-Z]+)-?(\d+)([A-E]?)$/.exec(s);return m?`${m[1]}-${Number(m[2])}${m[3]}`:s;}
function bag(state,ownerId=null,create=false){let holder=state,key='teamInventory';if(ownerId){holder=state.characters.find(c=>c.id===ownerId);if(!holder)throw Error('该角色已不存在');key='personalInventory';}if(!holder[key]&&create)holder[key]={version:1,cards:[],...(ownerId?{squills:[]}:{} )};return holder[key]||{version:1,cards:[]};}
const held=(state,ownerId)=>bag(state,ownerId).cards.filter(c=>c.status==='held');
const keywords=entry=>entry.customKeywords||entry.keywords||[];
function coins(state,ownerId=null){return ownerId?(bag(state,ownerId).squills||[]):state.squills;}
function setCoins(state,ownerId,values){const target=ownerId?bag(state,ownerId,true):state;target.squills=[...new Set(values)].sort((a,b)=>a-b);}
function addCoin(state,n,ownerId=null){if(!Number.isInteger(n)||n<1||n>35)throw Error('币编号应为1–35');setCoins(state,ownerId,[...coins(state,ownerId),n]);}
function removeCoin(state,n,ownerId=null){setCoins(state,ownerId,coins(state,ownerId).filter(x=>x!==n));held(state,ownerId).filter(e=>e.squillNumber===n).forEach(e=>{e.status='archived';e.updatedAt=Date.now();e.reason='移出梓昆币';});}
function exact(cards,raw,ownerId=null){const id=identifier(raw);return cards.filter(c=>(!ownerId||c.category==='键钥')&&c.references.some(r=>identifier(r)===id));}
function add(state,card,catalog,ownerId=null,manualCoin=0){
 if(ownerId&&card.category!=='键钥')throw Error('个人背包用于记录当前角色的剧情键钥卡');
 const record=bag(state,ownerId,true),previous=record.cards.find(e=>e.cardKey===card.key);if(previous?.status==='held')return false;
 const meta=catalog[card.key]||{},coin=meta.isSquill?(meta.squillNumber||manualCoin):0;if(meta.isSquill&&(!Number.isInteger(coin)||coin<1||coin>35))throw Error('请填写实体卡上的梓昆币编号');
 const now=Date.now(),family=card.category+':'+card.number;held(state,ownerId).filter(e=>e.family===family||(coin&&e.squillNumber===coin)).forEach(e=>{e.status='archived';e.reason='更新持有卡面';e.updatedAt=now;});
 const entry=previous||{id:root.crypto?.randomUUID?.()||'card-'+now+'-'+Math.random().toString(36).slice(2),acquiredAt:now,note:''};
 Object.assign(entry,{cardKey:card.key,reference:card.references.find(r=>card.state&&r.endsWith(card.state))||card.references[0]||'',family,display:card.display,title:card.title||'',keywords:clone(meta.keywords||[]),graphicKeyword:!!meta.graphicKeyword,squillNumber:coin,status:'held',updatedAt:now,reason:''});
 if(!previous)record.cards.push(entry);if(coin)addCoin(state,coin,ownerId);return true;
}
function archive(state,id,ownerId=null){const entry=held(state,ownerId).find(e=>e.id===id);if(!entry)return;entry.status='archived';entry.reason='移出背包';entry.updatedAt=Date.now();if(entry.squillNumber&&!held(state,ownerId).some(e=>e.squillNumber===entry.squillNumber))setCoins(state,ownerId,coins(state,ownerId).filter(n=>n!==entry.squillNumber));}
function update(state,id,changes,ownerId=null){const entry=bag(state,ownerId).cards.find(e=>e.id===id);if(!entry)throw Error('记录已不存在');const words=(changes.keywords||[]).map(x=>x.trim()).filter(Boolean);if(words.length>50||words.some(x=>x.length>500)||String(changes.note||'').length>20000||!Number.isInteger(changes.marks)||changes.marks<0||changes.marks>999)throw Error('请核对关键词、备注和标记数');Object.assign(entry,{customKeywords:[...new Set(words)],note:changes.note||'',marks:changes.marks,updatedAt:Date.now()});}
function fishing(state,create=false){if(!state.fishingJournal&&create)state.fishingJournal={version:1,fish:[],boards:[],notes:''};return state.fishingJournal||{version:1,fish:[],boards:[],notes:''};}
function fishMark(state,key,n,on){if(!['fish','boards'].includes(key)||!Number.isInteger(n)||n<1||n>(key==='fish'?32:3))throw Error('勾选编号无效');const journal=fishing(state,true);journal[key]=[...new Set(on?[...journal[key],n]:journal[key].filter(x=>x!==n))].sort((a,b)=>a-b);}
const fishingComplete=state=>fishing(state).fish.length===32&&fishing(state).boards.length===3;
function validateBag(value){
 if(!value||value.version!==1||!Array.isArray(value.cards)||value.cards.length>5000)throw Error('背包存档无效');const ids=new Set(),families=new Set(),keys=new Set();
 for(const e of value.cards){for(const [key,max]of Object.entries({id:80,cardKey:120,reference:80,family:160,display:160,title:300,note:20000,reason:300}))if(typeof e[key]!=='string'||e[key].length>max)throw Error('背包文字格式无效');
  if(!e.id||ids.has(e.id)||!['held','archived'].includes(e.status)||typeof e.graphicKeyword!=='boolean'||!Number.isInteger(e.squillNumber)||e.squillNumber<0||e.squillNumber>35)throw Error('背包记录无效');ids.add(e.id);
  for(const key of ['keywords','customKeywords'])if(e[key]!==undefined&&(!Array.isArray(e[key])||e[key].length>50||e[key].some(w=>typeof w!=='string'||w.length>500)))throw Error('关键词格式无效');
  if(e.marks!==undefined&&(!Number.isInteger(e.marks)||e.marks<0||e.marks>999))throw Error('标记数无效');
  for(const key of ['acquiredAt','updatedAt'])if(!Number.isSafeInteger(e[key])||e[key]<=0)throw Error('背包记录时间无效');
  if(e.status==='held'){if(keys.has(e.cardKey)||families.has(e.family))throw Error('同一卡牌不能同时持有多个状态');keys.add(e.cardKey);families.add(e.family);}
 }
 if(value.squills!==undefined&&(!Array.isArray(value.squills)||value.squills.length>35||value.squills.some(n=>!Number.isInteger(n)||n<1||n>35)))throw Error('个人背包币编号无效');
}
function validateFishing(log){if(!log||log.version!==1||typeof log.notes!=='string'||log.notes.length>10000)throw Error('垂钓日志格式无效');for(const [key,max]of [['fish',32],['boards',3]])if(!Array.isArray(log[key])||log[key].length>max||new Set(log[key]).size!==log[key].length||log[key].some(n=>!Number.isInteger(n)||n<1||n>max))throw Error('垂钓日志编号无效');}
function validateMap(map){const cell=id=>typeof id==='string'&&/^[A-R][1-5]$/.test(id);if(!map||map.version!==1||!(map.party===null||cell(map.party))||!cell(map.selected)||typeof map.showAll!=='boolean'||!Array.isArray(map.explored)||map.explored.length>90||new Set(map.explored).size!==map.explored.length||!map.explored.every(cell)||!map.notes||typeof map.notes!=='object'||Array.isArray(map.notes)||Object.entries(map.notes).some(([id,note])=>!cell(id)||typeof note!=='string'||note.length>10000))throw Error('地图记录格式无效');}
function preserveModernState(raw,validated){
 const result={...clone(raw),...validated};result.characters=validated.characters.map(c=>{const old=raw.characters.find(x=>x.id===c.id);if(old.personalInventory!==undefined)validateBag(old.personalInventory);return {...clone(old),...c,...(old.personalInventory?{personalInventory:clone(old.personalInventory)}:{})};});
 if(raw.teamInventory!==undefined){validateBag(raw.teamInventory);result.teamInventory=clone(raw.teamInventory);}if(raw.fishingJournal!==undefined){validateFishing(raw.fishingJournal);result.fishingJournal=clone(raw.fishingJournal);}
 if(raw.webMap!==undefined){validateMap(raw.webMap);result.webMap=clone(raw.webMap);}
 result.prefs={...clone(raw.prefs||{}),...validated.prefs};for(const key of ['databaseText','databaseTitles'])if(result.prefs[key]!==undefined&&typeof result.prefs[key]!=='boolean')throw Error('检索显示设置无效');for(const key of ['bookmarks','recent'])if(Array.isArray(raw[key])&&raw[key].length<=10000&&raw[key].every(v=>typeof v==='string'&&v.length<=80))result[key]=[...new Set(raw[key])];return result;
}
const M={clone,codes,identifier,bag,held,keywords,coins,addCoin,removeCoin,exact,add,archive,update,fishing,fishMark,fishingComplete,validateBag,validateFishing,validateMap,preserveModernState};
root.CampaignModel=M;if(root.Core){const original=root.Core.validate;root.Core.validate=raw=>preserveModernState(raw,original(raw));}
})(typeof window==='undefined'?globalThis:window);
