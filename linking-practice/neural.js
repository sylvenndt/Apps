"use strict";
/* AI 真人语音：开源 Kokoro-82M（Apache-2.0），在手机上本地生成，不用联网调用接口。
   声音文件放在本站 voices/ 目录；主模型（约 90MB）第一次使用时从 Hugging Face 下载，失败则走 hf-mirror.com 镜像。 */
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
  { id: "bf_emma",    name: "Emma",     accent: "gb", gender: "f", desc: "优雅温和，像空乘、酒店前台" },
  { id: "bf_isabella",name: "Isabella", accent: "gb", gender: "f", desc: "年轻干脆，像伦敦的上班族" },
  { id: "bm_george",  name: "George",   accent: "gb", gender: "m", desc: "绅士沉稳，像教授、管家" },
  { id: "bm_fable",   name: "Fable",    accent: "gb", gender: "m", desc: "很有故事感，像导游、讲解员" },
  { id: "bm_lewis",   name: "Lewis",    accent: "gb", gender: "m", desc: "年轻爽朗，像英国朋友" }
];
const KV = Object.fromEntries(KOKORO_VOICES.map(v => [v.id, v]));
/* 场景配音：[说这句话的人, 回应的人] */
const CAST = {
  cafe: ["af_bella", "am_puck"], dining: ["am_michael", "af_sarah"], shop: ["af_sarah", "af_bella"], grocery: ["am_echo", "af_sky"],
  health: ["af_kore", "am_michael"], home: ["am_echo", "af_heart"], gym: ["am_fenrir", "af_sky"], travel: ["bf_emma", "am_eric"],
  fly: ["bf_emma", "am_michael"], ride: ["am_echo", "af_heart"], talk: ["af_heart", "am_puck"], chat: ["am_puck", "af_heart"],
  bar: ["am_puck", "af_bella"], party: ["af_sky", "bm_lewis"], react: ["af_heart", "am_puck"], plans: ["am_puck", "af_sky"],
  date: ["af_nicole", "am_michael"], work: ["af_sarah", "am_eric"], phone: ["af_kore", "am_eric"], fix: ["am_eric", "af_sarah"],
  bank: ["af_aoede", "am_michael"], vocab: ["af_nova", "am_michael"], pattern: ["af_aoede", "bm_george"], structure: ["bm_george", "af_aoede"]
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
    const p = KOKORO_VOICES.filter(v => a === "both" || v.accent === a);
    return p.length ? p : KOKORO_VOICES;
  },
  /* 口音被过滤掉时，换成同性别的另一个声音 */
  fit(id, salt){
    const pool = this.pool();
    if(pool.some(v => v.id === id)) return id;
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
        // 预热：先生成一句短的，让第一次真正播放更快
        this.audio("Hi.", Voices.pick("talk", false, "Hi."), false).catch(() => {});
        if(typeof warmToday === "function") warmToday();
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
    if(!this.active() || !text) return;
    this.audio(String(text).trim(), Voices.pick(scene, alt, text), false).catch(() => {});
  },
  player(){
    if(!this.el){ this.el = new Audio(); this.el.preload = "auto"; }
    return this.el;
  },
  unlock(){ const el = this.player(); try{ el.src = SILENT_WAV; const p = el.play(); if(p && p.catch) p.catch(() => {}); }catch(_){} },
  stopPlayback(){ if(this.el){ try{ this.el.pause(); }catch(_){} } if(this.playing){ const r = this.playing; this.playing = null; r(false); } },
  play(blob, rate){
    this.stopPlayback();
    const el = this.player();
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      let done = false;
      const finish = ok => { if(done) return; done = true; el.onended = el.onerror = null; this.playing = null; setTimeout(() => URL.revokeObjectURL(url), 1000); resolve(ok); };
      this.playing = finish;
      el.onended = () => finish(true);
      el.onerror = () => finish(true);
      el.src = url;
      el.playbackRate = rate || 1;
      try{ el.preservesPitch = true; el.webkitPreservesPitch = true; }catch(_){}
      const p = el.play();
      if(p && p.catch) p.catch(() => finish(true));
    });
  },
  async say(text, rate, alt, my){
    const voice = Voices.pick(Speech.scene, alt, text);
    const key = this.key(voice, text);
    let blob = this.mem.get(key) || null;
    if(!blob){
      const p = this.audio(text, voice, true);
      if(Settings.get("aiInstant") !== false){
        blob = await Promise.race([p, sleep(450).then(() => null)]);
        if(!blob) throw new Error("not-ready"); // 先用系统语音读，生成好的下次直接用
      } else blob = await p;
    }
    if(my !== Speech.token) return false;
    const ok = await this.play(blob, rate);
    return ok && my === Speech.token;
  },
  warm(list){
    if(!this.active()) return;
    const run = () => list.slice(0, 30).forEach(([t, sc, alt]) => this.prefetch(t, sc, alt));
    if("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
  },
  async clearCache(){ this.mem.clear(); try{ await caches.delete("fluent-voice-v1"); }catch(_){} this.cache = null; }
};
