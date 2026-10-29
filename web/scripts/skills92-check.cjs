const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),repo=path.resolve(__dirname,'../..'),modal={classList:{add(){}},querySelectorAll(){return[]},querySelector(){return null}};
const ctx={console,crypto:crypto.webcrypto,document:{addEventListener(){},querySelector(){return modal},querySelectorAll(){return[]}},addEventListener(){}};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['data.js','legacy-records.js','skill-rules.js','core.js','campaign-model.js','skills92-data.js','skills92.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const S=ctx.Skills92,D=S.data,C=ctx.Core,plain=o=>JSON.parse(JSON.stringify(o));let current,html='';
S.connect({active:()=>current,C,modal:(kind,title,body)=>{html=body},close(){},mutate(fn){fn();return true}});
let count=0,tracks=0,tables=0,diagrams=0,music=0,questions=0;
for(const [p,entries]of Object.entries(D.tiles)){
 current=C.create('Web skill check','human',p,0);const before=JSON.stringify(current.skills);
 for(const [id,t]of Object.entries(entries)){
  assert.equal(t.id,+id);assert(t.face.sections.length);const e=S.effect(t);assert(!/undefined|\{[a-z_]+\}/.test(e),p+'-'+id+' unresolved token');
  S.open(+id);assert(html.includes('技能效果'));assert(html.includes('详细说明'));assert(html.includes('常见问答'));assert(html.includes('data-s92-categories'));assert(!/undefined/.test(html));
  assert(S.detail(p,+id).length>30);const qs=S.questions(p,+id);questions+=qs.length;for(const q of qs){assert(q.q);assert(q.a);}
  assert(S.node(current,ctx.DATA.paths.find(x=>x.id===p),{id:+id,name:t.name}).includes('s92-tree-paint'));
  for(const track of t.face.tracks||[]){const rendered=S.track(track);assert.equal((rendered.match(/data-tier=/g)||[]).length,track.nodes.length);assert.equal((rendered.match(/data-piercing="true"/g)||[]).length,track.nodes.filter(n=>n.piercing).length);tracks++;}
  for(const table of t.face.tables||[]){const rendered=S.table(table);assert.equal((rendered.match(/s92-result-row/g)||[]).length,table.rows.length);assert(!rendered.includes('flex:1'));tables++;}
  if(t.face.diagram){assert(S.grid(t.face.diagram).includes('viewBox'));diagrams++;}if(t.face.musicGrid){const rendered=S.music(t.face.musicGrid);assert.equal((rendered.match(/fill="#231f20"/g)||[]).length,t.face.musicGrid.notes.length);assert(rendered.includes('stroke="#231f20"'));music++;}count++;
 }
 assert.equal(JSON.stringify(current.skills),before,'reading must preserve learning/mastery');
}
assert.equal((S.effect(D.tiles.valor[11]).match(/class="s92-thresholds"/g)||[]).length,1,'shared damage legend only once');
assert.equal(count,84);assert.equal(tables,9);assert.equal(diagrams,26);assert.equal(music,6);
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'skill-source92.json'))),fixture=source.damageFixtures;for(const f of fixture){const actual=D.tiles[f.path][f.id].face.tracks[f.index];for(const [key,value]of Object.entries(f.expected))assert.deepEqual(plain(actual[key]),value,`${f.path}-${f.id} ${key}`);}
const proof=source;for(const [key,hash]of Object.entries(proof.originalMaterials)){const bytes=Buffer.from(D.material[key].split(',')[1],'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,key);}
const state=C.defaults();current=C.create('Existing character','human','inspiration',0);state.characters.push(current);state.active=current.id;current.carriedSkills={inspiration:[4,5,0,0,0],valor:[9,0,0,0,0]};const saved=JSON.stringify(current.skills);const restored=C.validate(plain(state));assert.deepEqual(plain(restored.characters[0].carriedSkills),plain(current.carriedSkills));assert.equal(JSON.stringify(restored.characters[0].skills),saved);
for(const bad of [{inspiration:[4,4,0,0,0]},{inspiration:[1,0,0,0,0]},{inspiration:[4,0]},{unknown:[4,0,0,0,0]}]){const value=plain(state);value.characters[0].carriedSkills=bad;assert.throws(()=>C.validate(value));}
delete current.carriedSkills;assert.doesNotThrow(()=>C.validate(plain(state)));
console.log(`PASS ${count} skills: full effects/details, ${questions} FAQs, ${tracks} damage figures, ${fixture.length} independent source fixtures, ${diagrams} grids, ${music} music diagrams, ${tables} compact tables, 22 original bitmap hashes, legacy records and carried-slot backup validation`);
