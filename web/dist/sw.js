/* Install a coherent core first; artwork and music are cached when requested. */
importScripts('./precache.js');
const SHELL='arydia-shell-'+self.ARYDIA_BUILD;
const AUDIO='arydia-audio-v1';
const base=new URL('./',self.location.href);
const shellURLs=new Set(self.ARYDIA_FILES.map(p=>new URL(p,base).href));
const coreFiles=self.ARYDIA_FILES.filter(p=>/\.(?:html|js|css|json|webmanifest)$/.test(p));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  try{
    for(let i=0;i<coreFiles.length;i+=5)await cache.addAll(coreFiles.slice(i,i+5).map(p=>new Request(new URL(p,base),{cache:'reload'})));
  }catch(e){await caches.delete(SHELL);throw e;}
  // Existing pages stay open. Their next navigation uses the complete new core.
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('arydia-shell-')&&key!==SHELL)await caches.delete(key);
  await self.clients.claim();
  for(const client of await self.clients.matchAll?.({type:'window'})||[])client.postMessage({type:'ARYDIA_BUILD',build:self.ARYDIA_BUILD});
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='GET_BUILD')event.source?.postMessage({type:'ARYDIA_BUILD',build:self.ARYDIA_BUILD});});
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
  const r=event.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
  if(u.pathname.startsWith(base.pathname+'music/')){event.respondWith(audioResponse(r));return;}
  if(r.mode==='navigate'){
    event.respondWith((async()=>await(await caches.open(SHELL)).match(new URL('index.html',base).href)||fetch(r))());return;
  }
  u.search='';
  if(shellURLs.has(u.href))event.respondWith((async()=>{const cache=await caches.open(SHELL),saved=await cache.match(u.href);if(saved)return saved;const response=await fetch(new Request(r,{cache:'no-cache'}));if(response.ok)await cache.put(u.href,response.clone());return response;})());
});
