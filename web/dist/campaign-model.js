(function(root){
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
const codes={'事件':'EVT','人物':'NPC','互动':'POI','键钥':'KEY','敌人':'FOE','威胁':'THR','委托':'JOB','当日':'DAY','参考':'REF','旅行':'TRV','技能':'SKL','角色':'RACE','游荡':'ROG','法师':'MAG','游侠':'RNG','诗人':'BRD','牧师':'CLR','战士':'WAR'};
function identifier(raw){let s=String(raw||'').normalize('NFKC').replace(/[\s#]/g,'').toUpperCase().replace(/[－—–]/g,'-');for(const [name,code]of Object.entries(codes))s=s.replace(name,code);if(/^\d+[A-E]?$/.test(s))s='KEY-'+s;const m=/^([A-Z]+)-?(\d+)([A-E]?)$/.exec(s);return m?`${m[1]}-${m[1]==='EVT'&&m[2]==='000'?'000':Number(m[2])}${m[3]}`:s;}
const searchIndexes=new WeakMap();
const searchFold=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/\{[^}]*}/g,'').replace(/[\s\p{P}\p{S}]/gu,'');
const searchNumber=raw=>raw==='000'?'000':String(Number(raw));
function searchIdentity(card,digits,letter,code){return card.references.some(ref=>{const m=/^([A-Z]+)-(\d+)([A-E]?)$/.exec(identifier(ref));return m&&(!code||code===m[1])&&searchNumber(m[2])===searchNumber(digits)&&(!letter||m[3]===letter||(letter==='A'&&!m[3]&&!card.state));});}
function searchHint(query){const raw=String(query||'').normalize('NFKC').trim();return /^\d+[A-E]?$/i.test(raw)?'按完整编号匹配，不匹配正文中的数字。':searchFold(raw).length===1?'单字仅匹配名称与关键词；查找正文请输入两个字以上。':'';}
function searchCards(cards,meta,query,category=''){
 const raw=String(query||'').normalize('NFKC').trim(),allowed=card=>!category||card.category===category;if(!raw)return cards.filter(allowed);
 const numeric=/^(\d+)([A-E]?)$/i.exec(raw);if(numeric)return cards.filter(c=>allowed(c)&&searchIdentity(c,numeric[1],numeric[2].toUpperCase()));
 const typed=/^([A-Z]+)-(\d+)([A-E]?)$/.exec(identifier(raw));if(typed)return cards.filter(c=>allowed(c)&&searchIdentity(c,typed[2],typed[3],typed[1]));
 const categoryEntry=Object.entries(codes).find(([name,code])=>name===raw||code===raw.toUpperCase());if(categoryEntry)return cards.filter(c=>allowed(c)&&c.category===categoryEntry[0]);
 const terms=raw.split(/\s+/).map(searchFold).filter(Boolean);if(!terms.length)return [];const whole=terms.join(''),bodyAllowed=terms.every(term=>term.length>=2);
 let entries=searchIndexes.get(cards);if(!entries){entries=cards.map(card=>({card,names:[card.title,...card.faces.map(face=>face.title)].map(searchFold).filter(Boolean),keywords:(meta[card.key]?.keywords||[]).map(searchFold),body:searchFold(card.faces.map(face=>face.workbookText||'').join('\n'))}));searchIndexes.set(cards,entries);}
 return entries.filter(e=>allowed(e.card)).map(e=>{const fields=[...e.names,...e.keywords];let score;if(e.names.includes(whole))score=0;else if(e.keywords.includes(whole))score=1;else if(terms.every(term=>e.names.some(name=>name.includes(term))))score=2;else if(terms.every(term=>fields.some(field=>field.includes(term))))score=3;else if(bodyAllowed&&terms.every(term=>e.body.includes(term)||fields.some(field=>field.includes(term))))score=4;else return null;return {card:e.card,score};}).filter(Boolean).sort((a,b)=>a.score-b.score).map(e=>e.card);
}

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
function setNote(state,id,note,ownerId=null){const entry=bag(state,ownerId).cards.find(e=>e.id===id);if(!entry||typeof note!=='string'||note.length>20000)throw Error('备注格式无效');entry.note=note;entry.updatedAt=Date.now();}
function mapOptions(map){return {explorationMode:map.explorationMode||'guided',travelTokensEnabled:map.travelTokensEnabled!==false,travelTokens:[...(map.travelTokens||[true,true,true])],travelTo:map.travelTo||null};}
function mapSnapshot(map){return {party:map.party,selected:map.selected,explored:[...map.explored],replacements:{...(map.replacements||{})},showAll:map.showAll,...mapOptions(map)};}
function mapRemember(map){map.undoHistory=[...(map.undoHistory||[]),mapSnapshot(map)].slice(-30);}
function mapArrive(map,id){if(map.party===id&&map.explored.includes(id)&&!map.travelTo)return;mapRemember(map);map.party=id;map.selected=id;map.travelTo=null;if(!map.explored.includes(id))map.explored.push(id);}
function mapUndo(map){const previous=map.undoHistory?.pop();if(!previous)return false;Object.assign(map,mapOptions(previous),clone(previous));return true;}
function mapSettings(map,settings){if(!['guided','free'].includes(settings.explorationMode)||typeof settings.travelTokensEnabled!=='boolean'||typeof settings.showAll!=='boolean')throw Error('地图设置无效');if(settings.explorationMode===mapOptions(map).explorationMode&&settings.travelTokensEnabled===mapOptions(map).travelTokensEnabled&&settings.showAll===map.showAll)return;mapRemember(map);if(settings.explorationMode!==mapOptions(map).explorationMode)map.travelTo=null;Object.assign(map,{explorationMode:settings.explorationMode,travelTokensEnabled:settings.travelTokensEnabled,showAll:settings.showAll});}
function mapSetToken(map,index,ready){if(!Number.isInteger(index)||index<0||index>2||typeof ready!=='boolean')throw Error('旅行标记无效');const tokens=mapOptions(map).travelTokens;if(tokens[index]===ready)return;mapRemember(map);tokens[index]=ready;map.travelTokens=tokens;}
function mapRestoreProgress(map,party,explored,geometry){const ids=new Set(geometry.cells.map(c=>c.id));if(!ids.has(party)||!Array.isArray(explored)||explored.some(id=>!ids.has(id)))throw Error('请核对团队位置与已探索地点');const known=[...new Set([...explored,party])];mapRemember(map);Object.assign(map,{party,selected:party,explored:known,travelTo:null});if(geometry.cells.find(c=>c.id===party).area!=='basin')map.showAll=true;}
function mapTravelBlockReason(map,id,geometry,locations){const from=geometry.cells.find(c=>c.id===map.party),to=geometry.cells.find(c=>c.id===id);if(!from)return '请先放置团队';if(!to)return '请选择地图上的地点';if(from.id===to.id)return '团队位于此格';if(!from.neighbors.includes(id))return '请选择相邻六角地点';const dx=to.x-from.x,dy=to.y-from.y,direction=Math.abs(dx)<.04?(dy<0?'N':'S'):dx>0?(dy<0?'NE':'SE'):(dy<0?'NW':'SW');if(!locations.find(l=>l.id===from.id)?.terrain?.[direction])return '此方向没有旅行图标，无法通行';const options=mapOptions(map);if(options.travelTokensEnabled&&!map.explored.includes(id)&&options.travelTokens.some(ready=>!ready))return '旅行标记已耗尽，只能前往已探索地点';return null;}
function mapBeginTravel(map,id,geometry,locations){if(mapOptions(map).explorationMode!=='guided')throw Error('当前为自由探索');if(map.travelTo)throw Error('请先完成或取消当前旅行');const reason=mapTravelBlockReason(map,id,geometry,locations);if(reason)throw Error(reason);mapRemember(map);map.travelTo=id;map.selected=id;}
function mapCompleteTravel(map){if(!map.travelTo)throw Error('当前没有进行中的旅行');mapArrive(map,map.travelTo);}
function mapCancelTravel(map){if(!map.travelTo)return;mapRemember(map);map.travelTo=null;}
const replacementTargets={'501':'F1','504':'D5','509':'D3','513':'L3','517':'E2','522':'H3','528':'J2','534':'I5','537':'J3','545':'H2','561':'H1','574':'O4','592':'A1'};
function mapReplacementCode(input){const match=String(input).normalize('NFKC').trim().match(/^(?:(?:板块(?:编号)?\s*[-:：]?\s*)|DOS\s*-\s*)?([0-9]{1,3})$/i);if(!match)return null;const code=String(Number(match[1]));return replacementTargets[code]?code:null;}
function mapReplace(map,input,restore=false){if(map.travelTo)throw Error('请先完成当前旅行');const code=mapReplacementCode(input);if(!code)throw Error('该编号尚未收录，请核对实体板块');const id=replacementTargets[code];if((map.replacements||{})[id]===(restore?undefined:code))return false;mapRemember(map);map.replacements={...(map.replacements||{})};if(restore)delete map.replacements[id];else map.replacements[id]=code;return true;}
function mapReset(map){mapRemember(map);Object.assign(map,{party:null,selected:null,explored:[],replacements:{},travelTo:null,explorationMode:'guided',travelTokensEnabled:true,travelTokens:[true,true,true]});}
function mapSaves(state){if(!state.webMapSaves){state.webMapSaves={version:1,active:'main',items:[{id:'main',name:'地图存档 1',updatedAt:Date.now(),map:clone(state.webMap||{version:1,party:null,selected:null,explored:[],notes:{},showAll:false})}]};}return state.webMapSaves;}
function saveCurrentMap(state){const saves=mapSaves(state),item=saves.items.find(x=>x.id===saves.active);if(state.webMap){const data=JSON.stringify(state.webMap);if(JSON.stringify(item.map)!==data){item.map=clone(state.webMap);item.updatedAt=Date.now();}}return saves;}
function switchMapSave(state,id){const saves=saveCurrentMap(state),item=saves.items.find(x=>x.id===id);if(!item)throw Error('地图存档已不存在');validateMap(item.map);state.webMap=clone(item.map);saves.active=id;}
function createMapSave(state,name,copy=false){const saves=saveCurrentMap(state);if(saves.items.length>=50)throw Error('最多保存 50 份地图');const id=root.crypto?.randomUUID?.()||'map-'+Date.now()+'-'+Math.random().toString(36).slice(2);saves.items.push({id,name:String(name).trim().slice(0,40)||'地图存档 '+(saves.items.length+1),updatedAt:Date.now(),map:copy?clone(state.webMap||saves.items.find(x=>x.id===saves.active).map):{version:1,party:null,selected:null,explored:[],notes:{},showAll:false}});switchMapSave(state,id);}
function renameMapSave(state,id,name){const clean=String(name).trim().slice(0,40),item=mapSaves(state).items.find(x=>x.id===id);if(!clean||!item)throw Error('请填写存档名称');item.name=clean;}
function deleteMapSave(state,id){const saves=mapSaves(state);if(id===saves.active)throw Error('请先切换到另一份存档');saves.items=saves.items.filter(x=>x.id!==id);}
function validateMapSaves(value){if(!value||value.version!==1||!Array.isArray(value.items)||!value.items.length||value.items.length>50||new Set(value.items.map(x=>x.id)).size!==value.items.length||!value.items.some(x=>x.id===value.active))throw Error('地图存档列表无效');for(const item of value.items){if(typeof item.id!=='string'||item.id.length>80||typeof item.name!=='string'||!item.name.trim()||item.name.length>40||!Number.isSafeInteger(item.updatedAt))throw Error('地图存档名称无效');validateMap(item.map);}}
function carriedRacialSkill(c){return Number.isInteger(c?.carriedRacialSkill)&&c.carriedRacialSkill>=0&&c.carriedRacialSkill<=2?c.carriedRacialSkill:0;}
function setCarriedRacialSkill(c,value){if(!Number.isInteger(value)||value<0||value>2)throw Error('种族技能选择无效');c.carriedRacialSkill=value;}
function validateCarriedSkills(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>6)throw Error('携带技能记录无效');for(const [path,ids]of Object.entries(value)){if(!['inspiration','valor','light','shadow','arcana','wandering'].includes(path)||!Array.isArray(ids)||ids.length!==5||ids.some(id=>!Number.isInteger(id)||id!==0&&(id<4||id>17))||new Set(ids.filter(Boolean)).size!==ids.filter(Boolean).length)throw Error('携带技能记录无效');}}
function validateMapOptions(map,cell){if(map.replacements!==undefined&&(!map.replacements||typeof map.replacements!=='object'||Array.isArray(map.replacements)||Object.keys(map.replacements).length>13||Object.entries(map.replacements).some(([id,code])=>typeof code!=='string'||replacementTargets[code]!==id)))throw Error('更换板块记录无效');if(map.explorationMode!==undefined&&!['guided','free'].includes(map.explorationMode))throw Error('探索模式无效');if(map.travelTokensEnabled!==undefined&&typeof map.travelTokensEnabled!=='boolean')throw Error('旅行标记设置无效');if(map.travelTokens!==undefined&&(!Array.isArray(map.travelTokens)||map.travelTokens.length!==3||map.travelTokens.some(v=>typeof v!=='boolean')))throw Error('旅行标记无效');if(map.travelTo!==undefined&&map.travelTo!==null&&(!cell(map.travelTo)||!map.party||map.party===map.travelTo||map.explorationMode==='free'))throw Error('旅行目的地无效');}

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
function validateMap(map){const cell=id=>typeof id==='string'&&/^[A-R][1-5]$/.test(id);if(!map||map.version!==1||!(map.party===null||cell(map.party))||!(map.selected===null||cell(map.selected))||typeof map.showAll!=='boolean'||!Array.isArray(map.explored)||map.explored.length>90||new Set(map.explored).size!==map.explored.length||!map.explored.every(cell)||!map.notes||typeof map.notes!=='object'||Array.isArray(map.notes)||Object.entries(map.notes).some(([id,note])=>!(cell(id)||["map","map:high","map:ring"].includes(id))||typeof note!=='string'||note.length>10000))throw Error('地图记录格式无效');validateMapOptions(map,cell);if(map.undoHistory!==undefined){if(!Array.isArray(map.undoHistory)||map.undoHistory.length>30)throw Error('地图撤回记录无效');for(const previous of map.undoHistory){if(!previous||previous.undoHistory!==undefined)throw Error('地图撤回记录无效');validateMap({...previous,version:1,notes:{}});}}}
function preserveModernState(raw,validated){
 const result={...clone(raw),...validated};result.characters=validated.characters.map(c=>{const old=raw.characters.find(x=>x.id===c.id);if(old.carriedSkills!==undefined)validateCarriedSkills(old.carriedSkills);if(old.personalInventory!==undefined)validateBag(old.personalInventory);if(old.carriedRacialSkill!==undefined&&(!Number.isInteger(old.carriedRacialSkill)||old.carriedRacialSkill<0||old.carriedRacialSkill>2))throw Error("携带种族技能记录无效");return {...clone(old),...c,...(old.personalInventory?{personalInventory:clone(old.personalInventory)}:{})};});
 if(raw.teamInventory!==undefined){validateBag(raw.teamInventory);result.teamInventory=clone(raw.teamInventory);}if(raw.fishingJournal!==undefined){validateFishing(raw.fishingJournal);result.fishingJournal=clone(raw.fishingJournal);}
 if(raw.webMap!==undefined){validateMap(raw.webMap);result.webMap=clone(raw.webMap);}if(raw.webMapSaves!==undefined){validateMapSaves(raw.webMapSaves);result.webMapSaves=clone(raw.webMapSaves);}
 result.prefs={...clone(raw.prefs||{}),...validated.prefs};for(const key of ['databaseText','databaseTitles'])if(result.prefs[key]!==undefined&&typeof result.prefs[key]!=='boolean')throw Error('检索显示设置无效');for(const key of ['bookmarks','recent'])if(Array.isArray(raw[key])&&raw[key].length<=10000&&raw[key].every(v=>typeof v==='string'&&v.length<=80))result[key]=[...new Set(raw[key])];return result;
}
function lanMapUrl(raw){
 const text=String(raw||'').trim(),m=/^http:\/\/(localhost|(?:[0-9]{1,3}\.){3}[0-9]{1,3}):([0-9]{1,5})\/?$/i.exec(text);
 if(!m)throw Error('请粘贴 APP 房间里的完整浏览器加入地址，例如 http://192.168.1.8:12345/');
 const host=m[1].toLowerCase(),port=Number(m[2]),parts=host.split('.').map(Number);
 if(port<1||port>65535||host!=='localhost'&&(parts.some(n=>n>255)||!(parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===127||parts[0]===169&&parts[1]===254)))throw Error('请使用 APP 提供的局域网地址，并连接同一 Wi-Fi');
 return 'http://'+host+':'+port+'/';
}
function cardRelations(card,direction,core,startOnly=false){
 if(!card||!core?.relationships||!['before','after'].includes(direction))return [];
 const ids=new Set((card.references?.length?card.references:[card.key||card.number]).filter(Boolean).map(ref=>core.resolve(ref)?.id||identifier(ref)));
 return [...new Set([...ids].flatMap(id=>core.relationships(id,direction,startOnly)))];
}
function searchIndex(records,core,cards,meta,query){
 const raw=String(query||'').normalize('NFKC').trim(),numeric=/^(\d+)([A-E]?)$/i.exec(raw),typed=/^([A-Z]+)-(\d+)([A-E]?)$/.exec(identifier(raw));
 const excluded=new Set(['SKL','MAG','RNG','BRD','ROG','CLR','WAR','RACE','PATH','FOE']);
 const allowed=records.filter(r=>!excluded.has(r.id.split('-')[0]));
 if(numeric||typed){const digits=numeric?numeric[1]:typed[2],letter=(numeric?numeric[2]:typed[3]).toUpperCase(),code=numeric?null:typed[1];return allowed.filter(r=>searchIdentity({references:[r.id]},digits,letter,code)&& (letter||!/[B-E]$/.test(r.id)));}
 if(!raw)return allowed;const term=raw.toLowerCase(),norm=core.norm(raw),source=new Set(searchCards(cards,meta,raw).flatMap(c=>c.references).map(ref=>core.resolve(ref)?.id||core.norm(ref)));
 return allowed.filter(r=>core.norm(r.id).includes(norm)||String(r.zh||'').toLowerCase().includes(term)||source.has(r.id));
}
const M={validateCarriedSkills,mapSaves,saveCurrentMap,switchMapSave,createMapSave,renameMapSave,deleteMapSave,validateMapSaves,searchIndex,replacementTargets,mapReplacementCode,mapReplace,mapReset,carriedRacialSkill,setCarriedRacialSkill,cardRelations,lanMapUrl,clone,codes,identifier,searchCards,searchHint,bag,held,keywords,coins,addCoin,removeCoin,exact,add,archive,update,setNote,mapArrive,mapUndo,mapOptions,mapSettings,mapSetToken,mapRestoreProgress,mapTravelBlockReason,mapBeginTravel,mapCompleteTravel,mapCancelTravel,fishing,fishMark,fishingComplete,validateBag,validateFishing,validateMap,preserveModernState};
root.CampaignModel=M;if(root.Core){const original=root.Core.validate;root.Core.validate=raw=>preserveModernState(raw,original(raw));}
})(typeof window==='undefined'?globalThis:window);
