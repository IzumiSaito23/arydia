const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const handlers={},classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),toggle(v,on){on?values.add(v):values.delete(v);},contains:v=>values.has(v)};};
const opened=[],buttons=Array.from({length:5},(_,index)=>({dataset:{},classList:classes(),closest(selector){return selector==='[data-scrub-open]'&&this.dataset.scrubOpen?this:null;},click(){const event={target:this,preventDefault(){this.blocked=true;},stopImmediatePropagation(){this.blocked=true;}};handlers.click(event);if(!event.blocked){buttons.forEach((b,i)=>b.classList.toggle('active',i===index));opened.push(index);}}}));
const nav={classList:classes(),style:{setProperty(){}},addEventListener(name,fn){handlers[name]=fn;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:700,bottom:780,width:500}),querySelectorAll(selector){return selector==='.nav-preview'?buttons.filter(b=>b.classList.contains('nav-preview')):buttons;}};
const document={getElementById:id=>id==='nav'?nav:null,addEventListener(){}};const source=fs.readFileSync(path.resolve(__dirname,'../dist/interactions77.js'),'utf8');assert(!source.includes('setTimeout'));vm.runInNewContext(source,{document,Date,Math});
function event(name,x,y=740,id=1){handlers[name]({button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}});}
buttons[0].classList.add('active');
event('pointerdown',450);event('pointermove',430);assert(nav.classList.contains('is-scrubbing'));event('pointermove',20);event('pointerup',20);assert.deepEqual(opened,[1],'a long sweep advances only one module');buttons[4].click();assert.deepEqual(opened,[1],'synthetic click blocked');
event('pointerdown',450);event('pointermove',20);event('pointerup',20);assert.deepEqual(opened,[1,2],'second gesture advances one more');
event('pointerdown',20);event('pointermove',450);event('pointerup',450);assert.deepEqual(opened,[1,2,1],'reverse direction returns one module');
event('pointerdown',50);event('pointerup',50);buttons[0].click();assert.deepEqual(opened,[1,2,1,0],'ordinary tap stays immediate');
event('pointerdown',20);event('pointermove',450);event('pointerup',450);assert.equal(opened.length,4,'edge resists without wrapping');
event('pointerdown',450);event('pointermove',430);event('pointerup',430);assert.equal(opened.length,4,'short gesture returns');
event('pointerdown',50);event('pointermove',51,760);event('pointerup',51,760);buttons[0].click();assert.equal(opened.length,4,'vertical motion does not switch');
event('pointerdown',450);event('pointermove',240);event('pointermove',240,640);event('pointerup',240,640);buttons[3].click();assert.equal(opened.length,4,'outside cancels');
event('pointerdown',450);event('pointermove',240);event('pointercancel',240);assert(!nav.classList.contains('is-scrubbing'));
event('pointerdown',450);event('pointerdown',240,740,2);event('pointerup',240,740,2);buttons[2].click();assert.equal(opened.length,4,'second pointer cancels');
console.log('PASS one adjacent module per swipe, repeated/long/reverse gestures, immediate taps, resisted edges and short/vertical/outside/multi-pointer cancellation.');
