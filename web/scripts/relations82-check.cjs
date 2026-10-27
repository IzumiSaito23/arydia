const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),handlers={},values=new Map(),nodes=new Map();let modal,state;
const ctx={console,Date,Math,Set,Map,setTimeout,clearTimeout,URL,crypto:require('node:crypto').webcrypto};ctx.window=ctx;
ctx.document={addEventListener(type,fn){handlers[type]=fn;},getElementById(id){if(!nodes.has(id))nodes.set(id,{addEventListener(){},checked:false});return nodes.get(id);},querySelectorAll(){return[];},body:{classList:{add(){},remove(){}}}};
ctx.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
ctx.fetch=async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))});vm.createContext(ctx);
for(const name of ['data.js','legacy-records.js','skill-rules.js','core.js','campaign-model.js','campaign.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx);
state=ctx.Core.defaults();const H={state:()=>state,page:()=> 'search',active:()=>null,render(){},refs:text=>`<ref>${text}</ref>`,toast:message=>{throw Error(message);},modal:(id,title,body,actions,memo)=>{modal={id,title,body,actions,memo};},mutate(fn){fn(state);return true;},close(){},supportButtons(){return'';},go(){}};
function click(action,data={}){const button={dataset:{camp:action,...data},disabled:false};handlers.click({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});}
(async()=>{
 ctx.Campaign.connect(H);await new Promise(resolve=>setImmediate(resolve));
 const cards=JSON.parse(fs.readFileSync(path.join(root,'catalog/card-database.json'))).cards,M=ctx.CampaignModel,C=ctx.Core;
 const poi=M.exact(cards,'EVT-1')[0];assert(poi);const before=C.relationships('EVT-1','before',true),after=C.relationships('EVT-1','after');assert(before.length&&after.length);
 assert.deepEqual([...M.cardRelations(poi,'before',C,true)],[...before]);assert.deepEqual([...M.cardRelations(poi,'after',C)],[...after]);
 assert(ctx.Campaign.openReference('EVT-1'));assert.equal(modal.id,'campaignCard');assert(!modal.body.includes('前置关联')&&!modal.body.includes('后续关联'),'source card reader is separate from index relations');
 click('tab',{kind:'face',index:'1'});assert.equal(modal.id,'campaignCard');
 assert.equal(ctx.Campaign.openReference('HEX-E2'),false,'map/noncatalog links use legacy metadata detail route');
 state.prefs.before=true;state.prefs.after=true;ctx.Campaign.openReference('KEY-98');assert(!modal.body.includes('data-camp="revealRelations"'));
 const alias={references:['KEY-98','KEY-98A']};assert.deepEqual([...M.cardRelations(alias,'before',C)],[...C.relationships('KEY-98','before')],'A aliases do not duplicate edges');
 click('tab',{kind:'search',index:'1'});click('searchPrefs');assert(modal.body.includes('camp-show-titles')&&modal.body.includes('camp-show-text'));assert(!modal.body.includes('camp-show-before'),'DB settings independent of index settings');
 ctx.document.getElementById('camp-show-titles').checked=false;ctx.document.getElementById('camp-show-text').checked=false;click('saveSearchPrefs');assert.equal(state.prefs.before,true);assert.equal(state.prefs.after,true);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');assert(app.includes("page==='search'&&detail?detailPage()"));assert(app.includes('查看卡牌正文'));assert(app.includes('H')||app.includes('openIndex(id)'));assert(app.includes('refs,supportButtons'));
 console.log('PASS source-index relations, A alias de-duplication, independent DB/index settings, separate card reader, catalog jumps/noncatalog fallback and index detail routing');console.log(JSON.stringify({example:'EVT-1',before,after}));
})().catch(error=>{console.error(error);process.exitCode=1;});
