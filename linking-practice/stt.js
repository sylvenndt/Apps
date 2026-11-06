"use strict";
/* 跟读识别：两种引擎
   ① 系统识别（浏览器自带的 SpeechRecognition）：安卓 Chrome 要连得上 Google，iPhone 要开 Siri，
      添加到主屏幕的 iPhone App 里经常用不了。
   ② 手机上识别：App 自己用麦克风录音，再用开源 Whisper 模型（transformers.js）在手机上转成文字。
      不联网、不依赖 Google 或 Siri，任何能录音的浏览器都能用；模型第一次使用时下载一次。
   「自动」模式下，系统识别用不了时会自动改用手机上识别。 */
const IS_STANDALONE = (() => { try{ return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(_){ return false; } })();
const STT_MODELS = {
  tiny: { id: "Xenova/whisper-tiny.en", mb: 41, name: "快速", desc: "约 41MB，识别快，适合跟读打分" },
  base: { id: "Xenova/whisper-base.en", mb: 77, name: "更准", desc: "约 77MB，口音重时更准，识别慢一点" }
};
const TRANSFORMERS_URLS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.web.min.js",
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.web.js",
  "https://unpkg.com/@huggingface/transformers@3.8.1/dist/transformers.web.min.js"
];

/* ---------- 麦克风 ---------- */
function micErr(e){
  const n = e && (e.name || e.message) || "";
  if(/NotAllowed|Permission|denied|Security/i.test(n)) return location.protocol === "https:" || location.hostname === "localhost" ? "mic-denied" : "mic-insecure";
  if(/NotFound|DevicesNotFound|Overconstrained/i.test(n)) return "mic-none";
  if(/NotReadable|TrackStart|Abort/i.test(n)) return "mic-busy";
  return "mic-failed";
}
const Mic = {
  state: "unknown", // granted | denied | prompt | unknown
  supported(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  async query(){
    try{
      const p = await navigator.permissions.query({ name: "microphone" });
      this.state = p.state; p.onchange = () => { this.state = p.state; document.dispatchEvent(new Event("fluent-mic")); };
    }catch(_){}
    return this.state;
  },
  /* 主动申请麦克风权限：系统会弹出「允许使用麦克风」 */
  async ensure(){
    if(!this.supported()) return { ok: false, error: IN_APP_BROWSER ? "mic-inapp" : "mic-unsupported" };
    if(this.state === "granted" && this._okThisSession) return { ok: true };
    try{
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      this.state = "granted"; this._okThisSession = true; store.set("micOk", true);
      document.dispatchEvent(new Event("fluent-mic"));
      return { ok: true };
    }catch(e){
      let err = micErr(e);
      if(err === "mic-failed" && await this.query() === "denied") err = "mic-denied";
      if(err === "mic-denied") this.state = "denied";
      document.dispatchEvent(new Event("fluent-mic"));
      return { ok: false, error: err };
    }
  },
  /* 必须在点击的同一时刻调用（iPhone 只允许这时启动音频） */
  context(){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{ const c = new AC(); try{ c.resume(); }catch(_){} return c; }catch(_){ return null; }
  },
  /* 录音：说完停顿一会儿自动结束。返回 16kHz 的声音（给识别用）和 WAV（回放用） */
  record({ ctx, maxMs = 15000, silenceMs = 1300, waitMs = 8000, onLevel } = {}){
    let stopNow = null, stream = null;
    const done = (async () => {
      if(!this.supported()) return { error: IN_APP_BROWSER ? "mic-inapp" : "mic-unsupported" };
      try{
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        this.state = "granted"; this._okThisSession = true; store.set("micOk", true);
      }catch(e){
        let err = micErr(e);
        if(err === "mic-failed" && await this.query() === "denied") err = "mic-denied";
        if(err === "mic-denied") this.state = "denied";
        try{ ctx && ctx.close(); }catch(_){}
        return { error: err };
      }
      if(!ctx) ctx = this.context();
      if(!ctx){ stream.getTracks().forEach(t => t.stop()); return { error: "mic-unsupported" }; }
      try{ await ctx.resume(); }catch(_){}
      const sr = ctx.sampleRate, chunks = [];
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain(); mute.gain.value = 0;
      let noise = [], thr = 0.012, speech = false, loud = 0, lastLoud = 0, peak = 0;
      const t0 = performance.now();
      return await new Promise(resolve => {
        let finished = false;
        const finish = reason => {
          if(finished) return; finished = true;
          try{ proc.disconnect(); src.disconnect(); mute.disconnect(); }catch(_){}
          stream.getTracks().forEach(t => t.stop());
          resolve({ chunks, sr, speech, peak, reason });
        };
        stopNow = () => finish("user");
        // 有的手机音频没启动起来，onaudioprocess 一直不来：再推一下，还不行就结束
        const dog = setInterval(() => {
          if(finished){ clearInterval(dog); return; }
          const el = performance.now() - t0;
          if(!chunks.length && el > 1200) try{ ctx.resume(); }catch(_){}
          if(!chunks.length && el > 4000){ clearInterval(dog); finish("stalled"); }
          else if(el > maxMs + 1500){ clearInterval(dog); finish("max"); }
        }, 400);
        proc.onaudioprocess = e => {
          const d = e.inputBuffer.getChannelData(0);
          try{ e.outputBuffer.getChannelData(0).fill(0); }catch(_){}
          if(finished) return;
          chunks.push(new Float32Array(d));
          let s = 0; for(let i = 0; i < d.length; i++) s += d[i] * d[i];
          const rms = Math.sqrt(s / d.length), now = performance.now(), el = now - t0;
          if(rms > peak) peak = rms;
          // 先听 0.3 秒环境噪音，定一个说话的门槛
          if(el < 350){ noise.push(rms); return; }
          // 取最安静的一小段当噪音；就算一开口就说话，门槛也不会定得太高
          if(noise.length){ thr = Math.min(0.04, Math.max(0.01, Math.min(...noise) * 3)); noise = []; }
          if(rms > thr){ loud++; lastLoud = now; if(loud >= 2) speech = true; } else loud = 0;
          onLevel && onLevel(Math.min(1, rms / (thr * 4)), speech);
          if(speech && now - lastLoud > silenceMs) finish("silence");
          else if(!speech && el > waitMs) finish("no-speech");
          else if(el > maxMs) finish("max");
        };
        src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      }).then(async r => {
        if(!r.chunks.length){ try{ await ctx.close(); }catch(_){} return { error: r.reason === "user" ? "aborted" : "mic-stalled" }; }
        const out = await pack(r.chunks, r.sr, r.speech);
        try{ await ctx.close(); }catch(_){}
        return { ...out, speech: r.speech, peak: r.peak, reason: r.reason };
      });
    })();
    return { stop(){ if(stopNow) stopNow(); else { try{ stream && stream.getTracks().forEach(t => t.stop()); }catch(_){} } }, done };
  }
};
/* 拼接、去掉前后的静音、转成 16kHz */
async function pack(chunks, sr, speech){
  let n = 0; chunks.forEach(c => n += c.length);
  const all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  // 去头尾静音（留 0.25 秒）
  const win = Math.round(sr * 0.02); let mx = 0;
  for(let i = 0; i < n; i++){ const a = Math.abs(all[i]); if(a > mx) mx = a; }
  const gate = Math.max(0.01, mx * 0.08);
  let s = 0, e = n;
  for(let i = 0; i < n; i += win){ let m = 0; for(let j = i; j < Math.min(n, i + win); j++) m = Math.max(m, Math.abs(all[j])); if(m > gate){ s = i; break; } }
  for(let i = n - win; i > 0; i -= win){ let m = 0; for(let j = i; j < Math.min(n, i + win); j++) m = Math.max(m, Math.abs(all[j])); if(m > gate){ e = i + win; break; } }
  const pad = Math.round(sr * 0.25);
  const cut = speech ? all.subarray(Math.max(0, s - pad), Math.min(n, e + pad)) : all;
  const pcm = await resample(cut, sr, 16000);
  // 音量拉到合适的大小，识别和回放都更清楚
  let p = 0; for(let i = 0; i < pcm.length; i++) p = Math.max(p, Math.abs(pcm[i]));
  if(p > 0.001 && p < 0.7){ const g = Math.min(0.7 / p, 8); for(let i = 0; i < pcm.length; i++) pcm[i] *= g; }
  return { pcm, wav: typeof encodeWav === "function" ? encodeWav(pcm, 16000) : null, seconds: pcm.length / 16000 };
}
async function resample(x, from, to){
  if(from === to) return new Float32Array(x);
  const len = Math.max(1, Math.round(x.length * to / from));
  try{
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new OAC(1, len, to);
    const b = oc.createBuffer(1, x.length, from); b.getChannelData(0).set(x);
    const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
    const r = await oc.startRendering();
    return new Float32Array(r.getChannelData(0));
  }catch(_){
    // 退而求其次：先平均再抽样
    const out = new Float32Array(len), k = from / to;
    for(let i = 0; i < len; i++){ const a = Math.floor(i * k), b = Math.min(x.length, Math.floor((i + 1) * k)); let s = 0; for(let j = a; j < b; j++) s += x[j]; out[i] = b > a ? s / (b - a) : x[a] || 0; }
    return out;
  }
}

/* ---------- 手机上的 Whisper 识别 ---------- */
function sttWorkerSource(urls){
  return `
const URLS = ${JSON.stringify(urls)};
const HF = "https://huggingface.co/", MIRROR = "https://hf-mirror.com/";
let useMirror = false;
const realFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input && input.url) || String(input);
  if(url.startsWith(HF)){
    if(!useMirror){ try{ const r = await realFetch(url, init); if(r.ok) return r; }catch(e){} useMirror = true; }
    return realFetch(MIRROR + url.slice(HF.length), init);
  }
  return realFetch(input, init);
};
let asr = null;
async function load(model){
  let mod = null, lastErr = null;
  let from = "";
  for(const u of URLS){ try{ mod = await import(u); from = u; break; }catch(e){ lastErr = e; } }
  if(!mod) throw new Error("无法加载识别程序：" + (lastErr && lastErr.message || lastErr));
  mod.env.allowLocalModels = false;
  // 运行库文件跟识别程序从同一个地方下载
  try{ mod.env.backends.onnx.wasm.wasmPaths = from.slice(0, from.lastIndexOf("/") + 1); }catch(e){}
  asr = await mod.pipeline("automatic-speech-recognition", model, {
    dtype: "q8", device: "wasm",
    progress_callback: p => self.postMessage({ type: "progress", p: { status: p.status, file: p.file, loaded: p.loaded, total: p.total } })
  });
  self.postMessage({ type: "ready", mirror: useMirror });
}
self.onmessage = async e => {
  const d = e.data;
  if(d.type === "load"){ try{ await load(d.model); }catch(err){ self.postMessage({ type: "error", error: String(err && err.message || err) }); } return; }
  if(d.type === "run"){
    try{ const out = await asr(d.pcm); self.postMessage({ type: "text", id: d.id, text: String(out && out.text || "").trim() }); }
    catch(err){ self.postMessage({ type: "text", id: d.id, error: String(err && err.message || err) }); }
  }
};`;
}
const Whisper = {
  state: "off", progress: 0, error: "", worker: null, files: {}, jobs: new Map(), seq: 0, waiters: [], loaded: null,
  model(){ return STT_MODELS[Settings.get("sttModel")] || STT_MODELS.tiny; },
  downloaded(){ return store.get("sttReady") === this.model().id; },
  emit(){ document.dispatchEvent(new Event("fluent-stt")); },
  reset(){ try{ this.worker && this.worker.terminate(); }catch(_){} this.worker = null; this.state = "off"; this.loaded = null; this.emit(); },
  load(){
    if(this.state === "loading" || (this.state === "ready" && this.loaded === this.model().id)) return;
    if(this.worker) this.reset();
    if(typeof Worker === "undefined"){ this.state = "error"; this.error = "这个浏览器不支持后台运行识别模型"; this.emit(); return; }
    const model = this.model().id;
    this.state = "loading"; this.progress = 0; this.error = ""; this.files = {}; this.emit();
    try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(_){}
    try{ this.worker = new Worker(URL.createObjectURL(new Blob([sttWorkerSource(TRANSFORMERS_URLS)], { type: "text/javascript" })), { type: "module" }); }
    catch(e){ this.fail("识别模型启动失败：" + e.message); return; }
    let last = 0;
    this.worker.onmessage = e => {
      const d = e.data;
      if(d.type === "progress"){
        const p = d.p; if(p.file && p.total) this.files[p.file] = [p.loaded || 0, p.total];
        const arr = Object.values(this.files), tot = arr.reduce((a, x) => a + x[1], 0), got = arr.reduce((a, x) => a + x[0], 0);
        this.progress = tot ? got / tot : 0;
        if(Date.now() - last > 300){ last = Date.now(); this.emit(); }
      } else if(d.type === "ready"){
        this.state = "ready"; this.loaded = model; this.progress = 1; store.set("sttReady", model); this.emit();
        this.waiters.splice(0).forEach(w => w.res());
      } else if(d.type === "error") this.fail(d.error);
      else if(d.type === "text"){
        const j = this.jobs.get(d.id); this.jobs.delete(d.id);
        if(j){ if(d.error) j.rej(new Error(d.error)); else j.res(d.text); }
      }
    };
    this.worker.onerror = e => this.fail("识别模型出错：" + (e.message || "未知错误"));
    this.worker.postMessage({ type: "load", model });
  },
  fail(msg){
    this.state = "error"; this.error = msg; try{ this.worker && this.worker.terminate(); }catch(_){} this.worker = null; this.emit();
    this.waiters.splice(0).forEach(w => w.rej(new Error(msg)));
    this.jobs.forEach(j => j.rej(new Error(msg))); this.jobs.clear();
  },
  ready(){
    if(this.state === "ready" && this.loaded === this.model().id) return Promise.resolve();
    return new Promise((res, rej) => { this.waiters.push({ res, rej }); this.load(); });
  },
  async transcribe(pcm){
    await this.ready();
    const id = ++this.seq;
    return new Promise((res, rej) => { this.jobs.set(id, { res, rej }); this.worker.postMessage({ type: "run", id, pcm }, [pcm.buffer]); });
  }
};
/* Whisper 遇到噪音会输出 [BLANK_AUDIO]、(music) 之类，去掉 */
const cleanStt = t => String(t || "").replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();

/* ---------- 选引擎 ---------- */
const Listener = {
  fails: 0,
  engine(){
    const s = Settings.get("srEngine");
    if(s === "local") return Mic.supported() ? "local" : (SR ? "system" : "none");
    if(s === "system") return SR ? "system" : (Mic.supported() ? "local" : "none");
    if(!SR) return Mic.supported() ? "local" : "none";
    if(!Mic.supported()) return "system";
    if(IS_IOS && IS_STANDALONE) return "local"; // 主屏幕上的 iPhone App 里系统识别经常不工作
    if(store.get("srBroken")) return "local";
    return "system";
  },
  available(){ return this.engine() !== "none"; },
  /* 系统识别没认出任何字，说明它在这台手机上多半用不了（比如国行安卓没有 Google 语音服务），自动模式下改用手机上识别。
     安卓失败一次就换，其他手机失败两次才换 */
  systemFailed(err, micOk){
    if(Settings.get("srEngine") !== "auto" || !Mic.supported()) return false;
    const hard = ["network", "service-not-allowed", "language-not-supported", "start-failed", "bad-grammar"].includes(err) || (err === "not-allowed" && micOk);
    this.fails = hard ? 99 : this.fails + 1;
    if(this.fails >= (IS_ANDROID ? 1 : 2)){ store.set("srBroken", true); this.fails = 0; return true; }
    return false;
  }
};

function systemListen(opts){
  let inner = null, cancelled = false;
  const done = (async () => {
    let micOk = Mic.state === "granted" && Mic._okThisSession;
    if(!micOk && Mic.supported()){
      const m = await Mic.ensure();
      if(!m.ok) return { text: "", error: m.error };
      micOk = true;
    }
    if(cancelled) return { text: "", error: "aborted" };
    inner = startSystemListening(opts);
    const r = await inner.done;
    if(r.text){ Listener.fails = 0; return r; }
    if(cancelled && r.error === "aborted") return r;
    if(Listener.systemFailed(r.error, micOk)) return { text: "", error: "switched", detail: r.error };
    if(!r.error || r.error === "no-speech") return { ...r, error: "sys-no-speech" };
    return r;
  })();
  return { stop(){ cancelled = true; inner && inner.stop(); }, done };
}

function localListen(opts){
  const status = m => { const f = opts.onStatus || opts.onText; f && f(m); };
  // 第一次用要下载模型，先问一下
  if(Whisper.state !== "ready" && !Whisper.downloaded() && Whisper.state !== "loading"){
    const m = Whisper.model();
    const ok = window.confirm(`跟读识别要先下载一个语音识别模型（约 ${m.mb}MB，只下载一次，建议连 Wi-Fi）。\n\n下载后直接在手机上识别，不用联网，也不依赖 Google 或 Siri。现在下载吗？`);
    if(!ok) return { stop(){}, done: Promise.resolve({ text: "", error: "local-declined" }) };
  }
  if(Whisper.state !== "ready" && Whisper.state !== "loading") Whisper.load(); // 边录边下载
  const ctx = Mic.context(); // 要在点击的这一刻创建
  let speaking = false;
  status("正在听…说完停一下会自动结束");
  const rec = Mic.record({ ctx, maxMs: opts.maxMs || 15000, silenceMs: opts.silenceMs || 1300, onLevel: (lv, sp) => { if(sp && !speaking){ speaking = true; status("听到了，继续说…"); } } });
  const done = (async () => {
    const r = await rec.done;
    if(r.error) return { text: "", error: r.error };
    if(!r.speech || r.seconds < 0.3) return { text: "", error: "no-speech", audio: r.wav };
    const prog = () => { if(Whisper.state === "loading") status(`正在下载识别模型 ${Math.round(Whisper.progress * 100)}%…（只需一次）`); };
    document.addEventListener("fluent-stt", prog); prog();
    if(Whisper.state === "ready") status("识别中…");
    try{
      const text = cleanStt(await Whisper.transcribe(r.pcm));
      return { text, confidence: 0, error: text ? null : "no-speech", audio: r.wav, local: true };
    }catch(e){ return { text: "", error: "local-failed", detail: e.message, audio: r.wav }; }
    finally{ document.removeEventListener("fluent-stt", prog); }
  })();
  return { stop(){ rec.stop(); }, done };
}

/* 所有页面的「说」都走这里 */
function startListening(opts = {}){
  const eng = Listener.engine();
  if(eng === "none") return { stop(){}, done: Promise.resolve({ text: "", error: IN_APP_BROWSER ? "mic-inapp" : "unsupported" }) };
  return eng === "local" ? localListen(opts) : systemListen(opts);
}

const MIC_FIX = IS_IOS
  ? "iPhone：打开「设置」→「Safari 浏览器」→「麦克风」，选「允许」或「询问」，再回到 App 点一次。用的是主屏幕上的 App 的话，下次弹出「允许使用麦克风」时点「允许」。"
  : "安卓：在 Chrome 里点地址栏左边的图标 →「权限」→「麦克风」→ 允许；用的是主屏幕上的 App 的话，长按图标 →「应用信息」→「权限」→「麦克风」→ 允许。";
const SR_ERR_MORE = {
  "mic-denied": "麦克风权限被拒绝了。" + MIC_FIX,
  "mic-insecure": "要用 https 网址打开才能用麦克风。",
  "mic-none": "没找到麦克风。",
  "mic-busy": "麦克风被别的 App 占用了（比如在通话或录音），关掉再试。",
  "mic-failed": "麦克风没能打开，再点一次试试。",
  "mic-stalled": "麦克风打开了，但没收到声音。再点一次试试；还不行就把 App 关掉重新打开。",
  "mic-unsupported": "这个浏览器不能录音，请用 Safari 或 Chrome 打开。",
  "mic-inapp": "App 的内置浏览器不能用麦克风，请复制网址到 Safari 或 Chrome 打开。",
  switched: "手机自带的语音识别在这台手机上用不了（国行安卓一般没有 Google 语音服务），已经改用手机上识别。再点一次跟读就行，第一次会先下载识别模型。",
  "sys-no-speech": "没听到声音，靠近麦克风再试一次。如果一直这样，再试一次时会自动改用手机上识别。",
  "local-declined": "没下载识别模型。可以在「我的 → 跟读识别」里随时下载。",
  "local-failed": "手机上识别失败了，再试一次。如果一直失败，到「我的 → 跟读识别」看看模型状态。"
};
