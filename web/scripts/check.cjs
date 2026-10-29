const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes("connect-src 'self'"));assert(html.includes('webapp.js'));assert(html.includes('app38.css'));
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g))assert(fs.existsSync(path.join(root,ref)),ref);
for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.css'))){for(const [,ref] of fs.readFileSync(path.join(root,name),'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){if(!ref.startsWith('data:'))assert(fs.existsSync(path.join(root,ref)),`${name}: ${ref}`);}}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'standalone');for(const icon of manifest.icons)assert(fs.existsSync(path.join(root,icon.src)));
const dataCtx={window:{},console};dataCtx.window=dataCtx;vm.createContext(dataCtx);
for(const file of ['data.js','legacy-records.js','skill-rules.js','core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),dataCtx);
const C=dataCtx.Core,backup=C.defaults();assert.deepEqual(C.validate(JSON.parse(JSON.stringify(backup))),backup);
console.log('PASS syntax, referenced assets, PWA manifest, existing backup schema');
for(const r of dataCtx.DATA.records.filter(r=>r.titleAliases))for(const title of r.titleAliases)assert(C.search(title,{stage:1}).some(x=>x.id===r.id));
assert.equal(C.search('',{stage:1}).length,C.search('',{stage:3}).length);
assert(!C.search('').some(r=>/^(SKL|MAG|RNG|BRD|ROG|CLR|WAR)-/.test(r.id)));
const character=C.create('Test',dataCtx.DATA.races[0].id,dataCtx.DATA.paths[0].id,0);
assert.throws(()=>C.toggleMark(character,-1,5));C.toggleMark(character,-1,1);assert.throws(()=>C.toggleMark(character,0,5));
console.log('PASS old title aliases, complete search, excluded categories and sequential growth');
for(const p of dataCtx.DATA.paths){
 const c=C.create('Skills',dataCtx.DATA.races[0].id,p.id,0);
 c.skills={};
 for(const [from,to] of dataCtx.SKILL_EDGES[p.id]){
  c.skills={};assert.throws(()=>C.toggleSkill(c,to,'learned'));
  for(const n of C.prerequisites(c,to))c.skills[n]={learned:true,mastered:false,equipped:false};
  C.toggleSkill(c,to,'learned');assert(c.skills[to].learned);
  assert.throws(()=>C.toggleSkill(c,from,'learned'));
 }
}
console.log('PASS every prerequisite edge in all six paths and dependent unlearning guards');

// Exercise the real worker using native Fetch API objects and a browser-like cache store.
const stores=new Map(),handlers={};let networkCalls=0,offline=false,activationRequests=0;
function cacheStore(name){if(!stores.has(name))stores.set(name,new Map());const items=stores.get(name);return {match:async key=>items.get(typeof key==='string'?key:key.url)?.clone(),put:async(key,res)=>{items.set(typeof key==='string'?key:key.url,res.clone());},addAll:async list=>{for(const request of list)items.set(request.url,new Response('cached '+request.url));}};}
const ctx={URL,Request,Response,Headers,Blob,Set,console,importScripts:()=>{},self:{location:{href:'https://example.test/app/sw.js'},ARYDIA_BUILD:'test',ARYDIA_FILES:['index.html','app.js','art/lazy.png','music/optional.mp3'],clients:{claim:async()=>{}},skipWaiting:()=>{activationRequests++;},addEventListener:(type,fn)=>handlers[type]=fn},caches:{open:async name=>cacheStore(name),keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},fetch:async req=>{networkCalls++;if(offline)throw Error('offline');return new Response('network');}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);
function lifecycle(name){let p;handlers[name]({waitUntil:x=>p=x});return p;}
function response(req){let p;handlers.fetch({request:req,respondWith:x=>p=x});return p;}
(async()=>{
 await lifecycle('install');assert.equal(activationRequests,1);assert(!stores.get('arydia-shell-test').has('https://example.test/app/art/lazy.png'));assert(!stores.get('arydia-shell-test').has('https://example.test/app/music/optional.mp3'));await ctx.caches.open('other-app-cache');await ctx.caches.open('arydia-shell-old');await lifecycle('activate');
 assert(stores.has('other-app-cache'));assert(!stores.has('arydia-shell-old'));
 offline=true;
 const shell=await response({method:'GET',url:'https://example.test/app/?home',mode:'navigate'});assert((await shell.text()).includes('index.html'));assert.equal(networkCalls,0);
 const script=await response(new Request('https://example.test/app/app.js?v=1'));assert((await script.text()).includes('app.js'));assert.equal(networkCalls,0);
 const audio=await ctx.caches.open('arydia-audio-v1');await audio.put('https://example.test/app/music/1.mp3',new Response('0123456789',{headers:{'Content-Type':'audio/mpeg'}}));
 for(const [range,status,body,contentRange] of [['bytes=2-5',206,'2345','bytes 2-5/10'],['bytes=7-',206,'789','bytes 7-9/10'],['bytes=-3',206,'789','bytes 7-9/10'],['bytes=8-99',206,'89','bytes 8-9/10'],['bytes=10-',416,'','bytes */10'],['bytes=5-2',416,'','bytes */10'],['bytes=-0',416,'','bytes */10']]){
  const r=await response(new Request('https://example.test/app/music/1.mp3',{headers:{Range:range}}));assert.equal(r.status,status,range);assert.equal(await r.text(),body,range);assert.equal(r.headers.get('Content-Range'),contentRange,range);
 }
 const full=await response(new Request('https://example.test/app/music/1.mp3'));assert.equal(full.status,200);assert.equal(await full.text(),'0123456789');assert.equal(networkCalls,0);
 await assert.rejects(response(new Request('https://example.test/app/music/missing.mp3')));
 console.log('PASS offline shell, cached assets, full audio, seven Safari byte-range cases, cache isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
