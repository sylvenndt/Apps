/* 离线缓存：页面先给缓存（秒开），新版本在后台装好后由页面顶部提示条接管；
   其余同源文件缓存优先。顺便给页面加上跨源隔离头，让 AI 语音可以多核运算。
   录好的语音（audio/*.ogg）单独存在 fluent-audio-v1 里，App 更新时不会被清掉。 */
const CACHE = "daily-english-v35";
const V = "?v=35";
const AUDIO_CACHE = "fluent-audio-v1";
const CORE = ["./", "index.html", "styles.css" + V, "tts-bridge.js" + V, "data.js" + V, "emotion.js" + V, "words.js" + V, "vocab.js" + V, "linking.js" + V, "core.js" + V, "ai.js" + V, "replies_zh.js" + V, "neural.js" + V, "stt.js" + V, "pron.js" + V, "app.js" + V, "manifest.json", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", e => {
  // 绕过浏览器的网页缓存，保证装进来的是这一版的文件。
  // 逐个装、单个失败不影响整包（以前 addAll 一挂全挂，旧缓存就一直赖着不走）
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
  })());
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
      // 有缓存就直接给（打开是秒开的，不用先等网络）。
      // 新版本由 sw.js 自己的更新流程装好，装好后页面顶部会出现「点这里马上换上」。
      const hit = await cache.match("index.html") || await cache.match("./");
      if(hit) return isolate(hit);
      const r = await fetch(url.href.split("#")[0], { cache: "no-cache", credentials: "same-origin" });
      if(r.ok) cache.put("index.html", r.clone());
      return isolate(r);
    })());
    return;
  }

  // 录好的语音：缓存优先，单独存放
  if(/\/audio\/.+\.ogg$/.test(url.pathname)){
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const hit = await cache.match(url.href);
      if(hit) return hit;
      const r = await fetch(url.href);
      if(r.ok && r.status === 200) cache.put(url.href, r.clone());
      return r;
    })());
    return;
  }

  // 其他同源文件：缓存优先，没有再联网并存起来
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if(hit) return hit;
    const r = await fetch(req);
    if(r.ok && (url.search.includes("v=") || /\.(png|bin|json|wasm|mjs)$/.test(url.pathname))) cache.put(req, r.clone());
    return r;
  })());
});
