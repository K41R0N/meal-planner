import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const dist=path.resolve('dist');
async function walk(dir){
  const entries=await fs.readdir(dir,{withFileTypes:true});
  const nested=await Promise.all(entries.map(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):path.join(dir,entry.name)));
  return nested.flat();
}
const paths=(await walk(dist)).filter(file=>!file.endsWith('/sw.js')&&!file.endsWith('.map'));
const files=paths.map(file=>'/'+path.relative(dist,file).split(path.sep).join('/')).sort();
const digest=createHash('sha256');
for(const file of paths.sort())digest.update(await fs.readFile(file));
const version='mealbook-'+digest.digest('hex').slice(0,14);
const worker=`const CACHE=${JSON.stringify(version)};\nconst FILES=${JSON.stringify(['/',...files])};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mealbook-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(new URL(request.url).pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(request);if(cached)return cached;return fetch(request);}));
});\n`;
await fs.writeFile(path.join(dist,'sw.js'),worker);
console.log(`Offline app cache ${version}: ${files.length} local assets. Personal data stays in IndexedDB, not the cache.`);
