/* Shell updates are activated only after an explicit user action. */
importScripts('./precache.js');
const SHELL='arydia-shell-'+self.ARYDIA_BUILD;
const AUDIO='arydia-audio-v1';
const base=new URL('./',self.location.href);
const shellURLs=new Set(self.ARYDIA_FILES.map(p=>new URL(p,base).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  try{
    // Batches avoid holding the entire artwork collection in memory at once.
    for(let i=0;i<self.ARYDIA_FILES.length;i+=5)await cache.addAll(self.ARYDIA_FILES.slice(i,i+5).map(p=>new Request(new URL(p,base),{cache:'reload'})));
  }catch(e){await caches.delete(SHELL);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('arydia-shell-')&&key!==SHELL)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
function byteRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(header||'');
  if(!match||(!match[1]&&!match[2])||size<=0)return null;
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
  else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{start,end}:null;
}
async function audioResponse(request){
  const cache=await caches.open(AUDIO),saved=await cache.match(request.url);
  if(!saved)return fetch(request);
  const range=request.headers.get('Range');
  if(!range)return saved;
  const blob=await saved.blob(),part=byteRange(range,blob.size);
  if(!part)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${blob.size}`}});
  const headers=new Headers(saved.headers);headers.delete('Content-Encoding');headers.set('Content-Type',blob.type||'audio/mpeg');headers.set('Accept-Ranges','bytes');headers.set('Content-Length',String(part.end-part.start+1));headers.set('Content-Range',`bytes ${part.start}-${part.end}/${blob.size}`);
  return new Response(blob.slice(part.start,part.end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
  const assetURL=new URL(event.request.url);if(assetURL.origin===base.origin&&(/\/(?:maps|cards)\//.test(assetURL.pathname))){event.respondWith((async()=>{const cache=await caches.open('arydia-art-v75');const saved=await cache.match(event.request);if(saved)return saved;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());return;}

  const r=event.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
  if(u.pathname.startsWith(base.pathname+'music/')){event.respondWith(audioResponse(r));return;}
  if(r.mode==='navigate'){
    event.respondWith((async()=>await(await caches.open(SHELL)).match(new URL('index.html',base).href)||fetch(r))());return;
  }
  u.search='';
  if(shellURLs.has(u.href))event.respondWith((async()=>await(await caches.open(SHELL)).match(u.href)||fetch(r))());
});
