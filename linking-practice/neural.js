"use strict";
/* AI 真人语音：开源 Kokoro-82M（Apache-2.0）。
   ① 句库里的句子和单词已经提前用 Kokoro 在电脑上生成好，放在本站 audio/ 目录（Clips），点了直接播放，不用等。
   ② 没录过的句子（AI 教练的回复、自己输入的句子）才在手机上现场生成：声音文件放在本站 voices/ 目录；
      主模型（约 90MB）第一次使用时从 Hugging Face 下载，失败则走 hf-mirror.com 镜像。 */
const KOKORO_VOICES = [
  { id: "af_heart",   name: "Heart",    accent: "us", gender: "f", desc: "温暖亲切，像好朋友聊天" },
  { id: "af_bella",   name: "Bella",    accent: "us", gender: "f", desc: "活泼有感染力，像咖啡店店员、派对上的朋友" },
  { id: "af_sarah",   name: "Sarah",    accent: "us", gender: "f", desc: "干练利落，像职场同事、客服" },
  { id: "af_nicole",  name: "Nicole",   accent: "us", gender: "f", desc: "轻柔低语，像约会时说悄悄话" },
  { id: "af_kore",    name: "Kore",     accent: "us", gender: "f", desc: "沉稳清晰，像医生、前台" },
  { id: "af_aoede",   name: "Aoede",    accent: "us", gender: "f", desc: "成熟知性，像老师、主持人" },
  { id: "af_nova",    name: "Nova",     accent: "us", gender: "f", desc: "明亮标准，像新闻主播" },
  { id: "af_sky",     name: "Sky",      accent: "us", gender: "f", desc: "年轻随性，像大学生" },
  { id: "am_michael", name: "Michael",  accent: "us", gender: "m", desc: "成熟稳重，像经理、医生" },
  { id: "am_fenrir",  name: "Fenrir",   accent: "us", gender: "m", desc: "低沉有力，像健身教练、保安" },
  { id: "am_puck",    name: "Puck",     accent: "us", gender: "m", desc: "轻快俏皮，像朋友、酒保" },
  { id: "am_echo",    name: "Echo",     accent: "us", gender: "m", desc: "普通邻家，像路人、司机" },
  { id: "am_eric",    name: "Eric",     accent: "us", gender: "m", desc: "商务正式，像销售、客户" },
  { id: "af_alloy",   name: "Alloy",    accent: "us", gender: "f", desc: "中性干脆，像租车柜台、IT 同事", fresh: true },
  { id: "af_jessica", name: "Jessica",  accent: "us", gender: "f", desc: "开朗爱笑，像大学同学", fresh: true },
  { id: "af_river",   name: "River",    accent: "us", gender: "f", desc: "清爽年轻，像刚毕业的求职者", fresh: true },
  { id: "am_liam",    name: "Liam",     accent: "us", gender: "m", desc: "阳光少年感，像大学室友", fresh: true },
  { id: "am_onyx",    name: "Onyx",     accent: "us", gender: "m", desc: "低沉浑厚，像面试官、球迷大叔", fresh: true },
  { id: "am_santa",   name: "Santa",    accent: "us", gender: "m", desc: "慈祥爽朗的老爷爷，节日场景限定", fresh: true, special: true },
  { id: "bf_emma",    name: "Emma",     accent: "gb", gender: "f", desc: "优雅温和，像空乘、酒店前台" },
  { id: "bf_isabella",name: "Isabella", accent: "gb", gender: "f", desc: "年轻干脆，像伦敦的上班族" },
  { id: "bm_george",  name: "George",   accent: "gb", gender: "m", desc: "绅士沉稳，像教授、管家" },
  { id: "bm_fable",   name: "Fable",    accent: "gb", gender: "m", desc: "很有故事感，像导游、讲解员" },
  { id: "bm_lewis",   name: "Lewis",    accent: "gb", gender: "m", desc: "年轻爽朗，像英国朋友" },
  { id: "bf_alice",   name: "Alice",    accent: "gb", gender: "f", desc: "温柔知性，像英国闺蜜", fresh: true },
  { id: "bf_lily",    name: "Lily",     accent: "gb", gender: "f", desc: "甜美清亮，像伦敦女生", fresh: true },
  { id: "bm_daniel",  name: "Daniel",   accent: "gb", gender: "m", desc: "斯文稳重，像英国的技术支持", fresh: true }
];
const KV = Object.fromEntries(KOKORO_VOICES.map(v => [v.id, v]));
/* 场景配音：[说这句话的人, 回应的人] */
const CAST = {
  cafe: ["af_bella", "am_puck"], dining: ["am_michael", "af_sarah"], shop: ["af_sarah", "af_bella"], grocery: ["am_echo", "af_sky"],
  health: ["af_kore", "am_michael"], home: ["am_echo", "af_heart"], gym: ["am_fenrir", "af_sky"], travel: ["bf_emma", "am_eric"],
  fly: ["bf_emma", "am_michael"], ride: ["am_echo", "af_heart"], talk: ["af_heart", "am_puck"], chat: ["am_puck", "af_heart"],
  bar: ["am_puck", "af_bella"], party: ["af_sky", "bm_lewis"], react: ["af_heart", "am_puck"], plans: ["am_puck", "af_sky"],
  date: ["af_nicole", "am_michael"], work: ["af_sarah", "am_eric"], phone: ["af_kore", "am_eric"], fix: ["am_eric", "af_sarah"],
  bank: ["af_aoede", "am_michael"], vocab: ["af_nova", "am_michael"], pattern: ["af_aoede", "bm_george"], structure: ["bm_george", "af_aoede"],
  interview: ["af_river", "am_onyx"], campus: ["am_liam", "af_jessica"], drive: ["af_alloy", "am_fenrir"], help: ["af_jessica", "am_michael"],
  tech: ["bm_daniel", "af_alloy"], holiday: ["bf_lily", "am_santa"], sports: ["am_onyx", "am_puck"], feelings: ["af_heart", "bf_alice"]
};
const CAST_POOLS = {
  "s-": [["am_puck", "af_heart"], ["af_bella", "bm_lewis"], ["af_sky", "am_echo"], ["bf_isabella", "am_puck"], ["am_eric", "af_sarah"]],
  "d-": [["af_nicole", "am_michael"], ["am_puck", "af_bella"], ["af_heart", "am_fenrir"], ["bm_lewis", "af_sky"], ["af_bella", "bm_george"]],
  "x-": [["af_bella", "af_sarah"], ["am_echo", "af_sky"], ["bf_isabella", "af_heart"]],
  "t-": [["af_heart", "bm_lewis"], ["am_puck", "af_sky"], ["af_aoede", "am_echo"], ["bf_emma", "am_puck"]]
};
const hashStr = s => { let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

const Voices = {
  pool(){
    const a = Settings.get("accent");
    const p = KOKORO_VOICES.filter(v => !v.special && (a === "both" || v.accent === a));
    return p.length ? p : KOKORO_VOICES;
  },
  /* 口音被过滤掉时，换成同性别的另一个声音 */
  fit(id, salt){
    const pool = this.pool(), me = KV[id];
    if(pool.some(v => v.id === id)) return id;
    if(me && me.special){ const a = Settings.get("accent"); if(a === "both" || me.accent === a) return id; }
    const g = (KV[id] || {}).gender || "f";
    const same = pool.filter(v => v.gender === g);
    const list = same.length ? same : pool;
    return list[hashStr(id + salt) % list.length].id;
  },
  pick(scene, alt, text){
    const mode = Settings.get("cast");
    const pool = this.pool();
    if(mode === "fixed") return this.fit(alt ? Settings.get("voice2") : Settings.get("voice1"), "x");
    if(mode === "random"){ const i = hashStr(text || "") % pool.length; return pool[(i + (alt ? 1 + (hashStr(scene || "") % (pool.length - 1 || 1)) : 0)) % pool.length].id; }
    let pair = CAST[scene];
    if(!pair && scene){ const pre = Object.keys(CAST_POOLS).find(p => scene.startsWith(p)); if(pre){ const list = CAST_POOLS[pre]; pair = list[hashStr(scene) % list.length]; } }
    if(!pair) pair = [Settings.get("voice1"), Settings.get("voice2")];
    return this.fit(alt ? pair[1] : pair[0], scene || "");
  }
};

/* ---------- 录好的语音 ---------- */
const AUDIO_V = "?v=3";
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i = 0, ch; i < str.length; i++){ ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
const normText = t => String(t || "").trim().replace(/\s+/g, " ");
const AUDIO_CACHE = "fluent-audio-v1";
const Clips = {
  idx: null, rev: {}, revTag: "", base: "audio/", count: 0, bytes: 0, loading: null, mem: new Map(), ok: null, dl: null,
  supported(){
    if(this.ok === null){ try{ this.ok = !!new Audio().canPlayType('audio/ogg; codecs="opus"'); }catch(_){ this.ok = false; } }
    return this.ok;
  },
  load(){
    if(this.idx || this.loading || !this.supported() || typeof fetch === "undefined") return this.loading;
    this.loading = fetch("audio/index.json" + AUDIO_V).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
      const idx = {}; let n = 0;
      for(const v in j.voices){ const set = new Set(j.voices[v] ? j.voices[v].split(" ") : []); idx[v] = set; n += set.size; }
      const rev = {}; for(const v in (j.rev || {})) rev[v] = new Set(j.rev[v].split(" "));
      this.idx = idx; this.rev = rev; this.revTag = j.revTag || "1"; this.base = j.base || "audio/"; this.count = n; this.bytes = j.bytes || 0;
      document.dispatchEvent(new Event("fluent-neural"));
      if(store.get("clipsPruned") !== AUDIO_V){ const go = () => this.prune(); if("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 8000 }); else setTimeout(go, 5000); }
    }).catch(() => { this.loading = null; });
    return this.loading;
  },
  /* 找录好的版本：先找指定的人；不要求严格时，也可以用口音允许的其他人（优先同性别） */
  find(text, voice, strict){
    if(!this.idx) return null;
    const k = cyrb53(normText(text));
    const has = v => this.idx[v] && this.idx[v].has(k);
    if(has(voice)) return voice;
    if(strict) return null;
    const g = (KV[voice] || {}).gender;
    let other = null;
    for(const v of Voices.pool()){ if(has(v.id)){ if(v.gender === g) return v.id; other = other || v.id; } }
    return other;
  },
  /* 重新录过（加了情绪）的句子地址带 ?e=，手机上旧的录音缓存就不会再被用到 */
  keyUrl(voice, k){ return this.base + voice + "/" + k + ".ogg" + (this.rev[voice] && this.rev[voice].has(k) ? "?e=" + this.revTag : ""); },
  url(voice, text){ return this.keyUrl(voice, cyrb53(normText(text))); },
  allUrls(){ const urls = []; for(const v in this.idx) this.idx[v].forEach(k => urls.push(new URL(this.keyUrl(v, k), location.href).href)); return urls; },
  /* 清掉手机里已经过时的旧录音 */
  async prune(){
    if(!this.idx) return;
    try{
      const c = await caches.open(AUDIO_CACHE), ok = new Set(this.allUrls());
      for(const r of await c.keys()) if(!ok.has(r.url)) await c.delete(r);
      store.set("clipsPruned", AUDIO_V); store.set("clipsAll", false);
    }catch(_){}
  },
  async blob(voice, text){
    const url = this.url(voice, text);
    const m = this.mem.get(url); if(m) return m;
    const r = await fetch(url);
    if(!r.ok) throw new Error("录音文件 " + r.status);
    const b = await r.blob();
    this.mem.set(url, b); if(this.mem.size > 200) this.mem.delete(this.mem.keys().next().value);
    return b;
  },
  /* 把全部录音存到手机：以后每句都秒播，不联网也能用 */
  async saved(){
    if(!this.idx) return 0;
    try{ const c = await caches.open(AUDIO_CACHE), ok = new Set(this.allUrls()); return (await c.keys()).filter(r => ok.has(r.url)).length; }catch(_){ return 0; }
  },
  async downloadAll(){
    if(this.dl || !this.idx) return;
    const urls = this.allUrls();
    const st = this.dl = { total: urls.length, done: 0, failed: 0, stop: false };
    let cache = null; try{ cache = await caches.open(AUDIO_CACHE); }catch(_){}
    const have = new Set(); if(cache){ try{ (await cache.keys()).forEach(r => have.add(r.url)); }catch(_){} }
    const todo = urls.filter(u => !have.has(u)); st.done = urls.length - todo.length;
    let i = 0, last = 0;
    const tick = () => { if(Date.now() - last > 400){ last = Date.now(); document.dispatchEvent(new Event("fluent-neural")); } };
    const worker = async () => {
      while(i < todo.length && !st.stop){
        const u = todo[i++];
        try{ const r = await fetch(u); if(r.ok){ if(cache && !navigator.serviceWorker?.controller) await cache.put(u, r.clone()); await r.arrayBuffer(); st.done++; } else st.failed++; }
        catch(_){ st.failed++; }
        tick();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.dl = null; store.set("clipsAll", st.done >= st.total); document.dispatchEvent(new Event("fluent-neural"));
    return st;
  }
};

const KOKORO_URLS = [
  "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js",
  "https://unpkg.com/kokoro-js@1.2.1/dist/kokoro.web.js"
];
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";

function encodeWav(pcm, sr){
  const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for(let i = 0; i < n; i++){ const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: "audio/wav" });
}

function workerSource(voiceBase, urls){
  return `
const VOICE_BASE = ${JSON.stringify(voiceBase)};
const URLS = ${JSON.stringify(urls)};
const HF = "https://huggingface.co/", MIRROR = "https://hf-mirror.com/";
let useMirror = false;
const realFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input && input.url) || String(input);
  const m = url.match(/Kokoro-82M-v1\\.0-ONNX\\/resolve\\/main\\/voices\\/([a-z_]+)\\.bin/);
  if(m) return realFetch(VOICE_BASE + m[1] + ".bin", init);
  if(url.startsWith(HF)){
    if(!useMirror){ try{ const r = await realFetch(url, init); if(r.ok) return r; }catch(e){} useMirror = true; }
    return realFetch(MIRROR + url.slice(HF.length), init);
  }
  return realFetch(input, init);
};
let tts = null;
async function load(){
  let mod = null, lastErr = null;
  for(const u of URLS){ try{ mod = await import(u); break; }catch(e){ lastErr = e; } }
  if(!mod) throw new Error("无法加载语音程序：" + (lastErr && lastErr.message || lastErr));
  tts = await mod.KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8", device: "wasm",
    progress_callback: p => self.postMessage({ type: "progress", p: { status: p.status, file: p.file, loaded: p.loaded, total: p.total } })
  });
  self.postMessage({ type: "ready", mirror: useMirror });
}
self.onmessage = async e => {
  const d = e.data;
  if(d.type === "load"){ try{ await load(); }catch(err){ self.postMessage({ type: "error", error: String(err && err.message || err) }); } return; }
  if(d.type === "gen"){
    try{
      const audio = await tts.generate(d.text, { voice: d.voice, speed: 1 });
      const pcm = audio.audio instanceof Float32Array ? audio.audio : new Float32Array(audio.audio);
      self.postMessage({ type: "audio", id: d.id, pcm, sr: audio.sampling_rate || 24000 }, [pcm.buffer]);
    }catch(err){ self.postMessage({ type: "audio", id: d.id, error: String(err && err.message || err) }); }
  }
};`;
}

const Neural = {
  state: "off", progress: 0, error: "", worker: null, files: {}, jobs: new Map(), queue: [], busy: null, mem: new Map(), seq: 0,
  el: null, playing: null, cache: null,
  active(){ return Settings.get("engine") === "neural" && this.state === "ready"; },
  wanted(){ return Settings.get("engine") === "neural"; },
  /* 这句话能不能用 AI 声音读（录好的，或者手机上的模型已经就绪）；同步判断，读不了就马上用系统语音 */
  covers(text, alt){
    if(!this.wanted()) return false;
    const t = normText(text); if(!t) return false;
    const voice = Voices.pick(Speech.scene, alt, t);
    if(Clips.find(t, voice, false)) return true;
    if(this.state === "ready" || this.mem.has(this.key(voice, t))) return true;
    if(this.state === "off" && store.get("neuralReady")) this.load(); // 需要现场生成时才启动模型，平时不占手机算力
    return false;
  },
  emit(){ document.dispatchEvent(new Event("fluent-neural")); },
  urls(){ const o = store.get("kokoroUrl", null); return o ? [o] : KOKORO_URLS; },
  load(){
    if(this.worker || this.state === "loading") return;
    if(typeof Worker === "undefined"){ this.state = "error"; this.error = "这个浏览器不支持后台运行语音模型"; this.emit(); return; }
    this.state = "loading"; this.progress = 0; this.error = ""; this.files = {}; this.emit();
    try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(_){}
    try{
      const src = workerSource(new URL("voices/", location.href).href, this.urls());
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })), { type: "module" });
    }catch(e){ this.state = "error"; this.error = "语音模型启动失败：" + e.message; this.emit(); return; }
    let lastEmit = 0;
    this.worker.onmessage = e => {
      const d = e.data;
      if(d.type === "progress"){
        const p = d.p;
        if(p.file && p.total){ this.files[p.file] = [p.loaded || 0, p.total]; }
        const arr = Object.values(this.files), tot = arr.reduce((a, x) => a + x[1], 0), got = arr.reduce((a, x) => a + x[0], 0);
        this.progress = tot ? got / tot : 0;
        if(Date.now() - lastEmit > 300){ lastEmit = Date.now(); this.emit(); }
      } else if(d.type === "ready"){
        this.state = "ready"; this.progress = 1; store.set("neuralReady", true); this.emit(); this.pump();
        // 预热：先生成一句短的，让第一次真正现场生成更快
        this.audio("Okay.", Voices.pick("talk", false, "Okay."), false).catch(() => {});
      } else if(d.type === "error"){
        this.state = "error"; this.error = d.error; this.worker.terminate(); this.worker = null; this.emit();
        this.jobs.forEach(j => j.reject(new Error(d.error))); this.jobs.clear(); this.queue = []; this.busy = null;
      } else if(d.type === "audio"){
        const job = this.jobs.get(d.id); this.jobs.delete(d.id); this.busy = null;
        if(job){
          if(d.error) job.reject(new Error(d.error));
          else { Perf.add("ai", Date.now() - job.t0); const blob = encodeWav(d.pcm, d.sr); this.remember(job.key, blob); job.resolve(blob); }
        }
        this.pump();
      }
    };
    this.worker.onerror = e => { this.state = "error"; this.error = "语音模型出错：" + (e.message || "未知错误"); this.emit(); };
    this.worker.postMessage({ type: "load" });
  },
  key(voice, text){ return `https://tts.local/${voice}/${encodeURIComponent(text)}`; },
  async openCache(){ if(this.cache === null){ try{ this.cache = await caches.open("fluent-voice-v1"); }catch(_){ this.cache = false; } } return this.cache; },
  remember(key, blob){
    this.mem.set(key, blob);
    if(this.mem.size > 300) this.mem.delete(this.mem.keys().next().value);
    this.openCache().then(c => { if(c) c.put(key, new Response(blob, { headers: { "content-type": "audio/wav" } })).catch(() => {}); });
  },
  async lookup(key){
    if(this.mem.has(key)) return this.mem.get(key);
    const c = await this.openCache();
    if(c){ try{ const r = await c.match(key); if(r){ const b = await r.blob(); this.mem.set(key, b); return b; } }catch(_){} }
    return null;
  },
  async audio(text, voice, urgent){
    const key = this.key(voice, text);
    const hit = await this.lookup(key);
    if(hit) return hit;
    const pending = [...this.jobs.values(), ...this.queue].find(j => j.key === key);
    if(pending){ if(urgent){ const i = this.queue.indexOf(pending); if(i > 0){ this.queue.splice(i, 1); this.queue.unshift(pending); } } return pending.promise; }
    const job = { id: ++this.seq, key, text, voice };
    job.promise = new Promise((res, rej) => { job.resolve = res; job.reject = rej; });
    if(urgent) this.queue.unshift(job); else this.queue.push(job);
    if(this.queue.length > 40) this.queue.length = 40;
    this.pump();
    return job.promise;
  },
  pump(){
    if(this.busy || this.state !== "ready" || !this.queue.length) return;
    const job = this.queue.shift(); this.busy = job; this.jobs.set(job.id, job); job.t0 = Date.now();
    this.worker.postMessage({ type: "gen", id: job.id, text: job.text, voice: job.voice });
  },
  prefetch(text, scene, alt){
    if(!this.wanted() || !text) return;
    const t = normText(text), voice = Voices.pick(scene, alt, t);
    const rec = Clips.find(t, voice, Settings.get("cast") === "fixed");
    if(rec){ Clips.blob(rec, t).catch(() => {}); return; }
    if(this.state === "ready") this.audio(t, voice, false).catch(() => {});
  },
  player(){
    if(!this.el){ this.el = new Audio(); this.el.preload = "auto"; }
    return this.el;
  },
  unlock(){ const el = this.player(); try{ el.src = SILENT_WAV; const p = el.play(); if(p && p.catch) p.catch(() => {}); }catch(_){} },
  stopPlayback(){ if(this.el){ try{ this.el.pause(); }catch(_){} } if(this.playing){ const r = this.playing; this.playing = null; r(false); } },
  play(blob, rate, onstart){
    this.stopPlayback();
    const el = this.player();
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      let done = false;
      const finish = ok => { if(done) return; done = true; el.onended = el.onerror = null; this.playing = null; setTimeout(() => URL.revokeObjectURL(url), 1000); resolve(ok); };
      this.playing = finish;
      el.onended = () => finish(true);
      el.onerror = () => finish(true);
      el.onplaying = () => { el.onplaying = null; onstart && onstart(); };
      el.src = url;
      el.playbackRate = rate || 1;
      try{ el.preservesPitch = true; el.webkitPreservesPitch = true; }catch(_){}
      const p = el.play();
      if(p && p.catch) p.catch(() => finish(true));
    });
  },
  async say(text, rate, alt, my){
    const t0 = Date.now(), t = normText(text);
    const voice = Voices.pick(Speech.scene, alt, t);
    const fixed = Settings.get("cast") === "fixed", instant = Settings.get("aiInstant") !== false;
    let blob = null, kind = "clip";
    // 1. 录好的（同一个人）  2. 手机上生成过的  3. 录好的（换个同性别的人）  4. 现场生成  5. 固定发音人时，退而求其次用录好的
    const fromClip = async v => {
      const p = Clips.blob(v, t);
      return instant ? Promise.race([p, sleep(1500).then(() => null)]).catch(() => null) : p.catch(() => null);
    };
    let rec = Clips.find(t, voice, true), tried = null; // 网络太慢没取到时不再换人重试，直接用后面的办法
    if(rec){ tried = rec; blob = await fromClip(rec); }
    if(!blob) blob = this.mem.get(this.key(voice, t)) || null;
    if(!blob && !fixed && !tried && (rec = Clips.find(t, voice, false))){ tried = rec; blob = await fromClip(rec); }
    if(!blob && this.state === "ready"){
      kind = "ai";
      const p = this.audio(t, voice, true);
      if(instant){
        blob = await Promise.race([p, sleep(450).then(() => null)]);
        if(!blob && !fixed) throw new Error("not-ready"); // 先用系统语音读，生成好的下次直接用
      } else blob = await p;
    }
    if(!blob && fixed && !tried && (rec = Clips.find(t, voice, false))){ kind = "clip"; blob = await fromClip(rec); }
    if(!blob) throw new Error("not-ready");
    if(my !== Speech.token) return false;
    const ok = await this.play(blob, rate, () => Perf.add(kind === "clip" ? "clip" : "ai", Date.now() - t0));
    return ok && my === Speech.token;
  },
  warm(list){
    if(!this.wanted()) return;
    const run = () => list.slice(0, 30).forEach(([t, sc, alt]) => this.prefetch(t, sc, alt));
    if("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
  },
  async clearCache(){ this.mem.clear(); try{ await caches.delete("fluent-voice-v1"); }catch(_){} this.cache = null; }
};
Clips.load();
