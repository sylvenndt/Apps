/* 离线缓存：版本化的文件直接用缓存（秒开），页面本身联网最多等 2.5 秒，
   超时就先用缓存版本。顺便给页面加上跨源隔离头，让 AI 语音可以多核运算。 */
const CACHE = "daily-english-v11";
const V = "?v=11";
const CORE = ["./", "index.html", "styles.css" + V, "data.js" + V, "words.js" + V, "vocab.js" + V, "linking.js" + V, "core.js" + V, "replies_zh.js" + V, "neural.js" + V, "app.js" + V, "manifest.json", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("daily-english-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function isolate(resp){
  if(!resp || resp.type === "opaque") return resp;
  const h = new Headers(resp.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "credentialless");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}
function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(req.mode === "navigate"){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then(r => { if(r.ok) cache.put("index.html", r.clone()); return r; });
      try{ return isolate(await Promise.race([net, timeout(2500)])); }
      catch(_){
        const hit = await cache.match("index.html") || await cache.match("./");
        if(hit) return isolate(hit);
        return isolate(await net);
      }
    })());
    return;
  }

  // 其他同源文件：缓存优先，没有再联网并存起来
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if(hit) return hit;
    const r = await fetch(req);
    if(r.ok && (url.search.includes("v=") || /\.(png|bin|json)$/.test(url.pathname))) cache.put(req, r.clone());
    return r;
  })());
});
