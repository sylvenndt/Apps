"use strict";
const APP_VERSION = 18; // 跟 index.html 的 ?v= 和 sw.js 的版本一起改
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => { a = [...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* ---------- 本地存储 ---------- */
const store = {
  _c: new Map(),
  get(k, d){
    if(this._c.has(k)){ const v = this._c.get(k); return v === undefined ? d : v; }
    let v;
    try{ const raw = localStorage.getItem("fluent:" + k); v = raw === null ? undefined : JSON.parse(raw); }catch(_){ v = undefined; }
    this._c.set(k, v);
    return v === undefined ? d : v;
  },
  ver: 0,
  set(k, v){ this._c.set(k, v); this.ver++; try{ localStorage.setItem("fluent:" + k, JSON.stringify(v)); }catch(_){} },
  keys(){ try{ return Object.keys(localStorage).filter(k => k.startsWith("fluent:")).map(k => k.slice(7)); }catch(_){ return []; } }
};
// 其他标签页改了数据时，丢掉缓存
window.addEventListener("storage", e => { if(e.key && e.key.startsWith("fluent:")) store._c.delete(e.key.slice(7)); });

const Settings = {
  defaults: { speed: 0.9, voice: "", reactSec: 8, engine: "neural", cast: "scene", accent: "both", voice1: "af_heart", voice2: "am_michael", apiKey: "", model: "claude-sonnet-5-5", srEngine: "auto", sttModel: "tiny", keepAudio: true, reviewMode: "listen", focus: [], newPerDay: 10, newWordsPerDay: 15, mix: { scenes: true, vocab: true, pattern: true }, startLevel: "B1" },
  get(k){ const s = store.get("settings", {}); return k in s ? s[k] : this.defaults[k]; },
  set(k, v){ const s = store.get("settings", {}); s[k] = v; store.set("settings", s); }
};

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const endOfToday = () => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); };
const startOfDay = (offset = 0) => { const d = new Date(); d.setHours(4,0,0,0); d.setDate(d.getDate() + offset); return d.getTime(); };

/* ---------- 每日记录 ---------- */
const Log = {
  all(){ return store.get("log", {}); },
  today(){ return this.all()[dayKey()] || {review:0, listen:0, speak:0, link:0}; },
  add(kind, n = 1){
    const all = this.all(), k = dayKey();
    all[k] = all[k] || {review:0, listen:0, speak:0, link:0};
    all[k][kind] = (all[k][kind] || 0) + n;
    store.set("log", all);
  },
  activeDays(){ return Object.values(this.all()).filter(d => d.review || d.listen || d.speak || d.link).length; },
  streak(){
    const all = this.all();
    const active = k => { const d = all[k]; return d && (d.review || d.listen || d.speak || d.link); };
    const d = new Date();
    if(!active(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while(active(dayKey(d))){ n++; d.setDate(d.getDate() - 1); }
    return n;
  }
};

/* ---------- 句子卡片 + 间隔重复 ---------- */
const Cards = {
  user(){ return store.get("userCards", []); },
  addUser(en, zh, src){
    en = (en || "").trim(); if(!en) return null;
    const list = this.user();
    const hit = list.find(c => c.en.toLowerCase() === en.toLowerCase());
    if(hit) return hit;
    const card = { id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), en, zh: zh || "", src: src || "" };
    list.push(card); store.set("userCards", list);
    SRS.schedule(card.id, Date.now());
    return card;
  },
  removeUser(id){
    store.set("userCards", this.user().filter(c => c.id !== id));
    const s = SRS.all(); delete s[id]; store.set("srs", s);
  },
  get(id){
    if(!id) return null;
    const lib = ITEM_BY_ID[id];
    if(lib) return lib;
    if(typeof EXTRA_CARDS !== "undefined" && EXTRA_CARDS[id]) return EXTRA_CARDS[id];
    const u = this.user().find(x => x.id === id);
    return u ? { ...u, chunks: [u.en], reply: "", scene: "mine" } : null;
  }
};

const SRS = {
  all(){ return store.get("srs", {}); },
  schedule(id, due){
    const s = this.all();
    if(!s[id]) s[id] = { ivl: 0, ease: 2.5, reps: 0, lapses: 0, due };
    else s[id].due = Math.min(s[id].due, due);
    store.set("srs", s);
  },
  newIntroducedToday(){ const n = store.get("newToday", {}); return n.day === dayKey() ? (n.count || 0) : 0; },
  newWordsToday(){ const n = store.get("newToday", {}); return n.day === dayKey() ? (n.words || 0) : 0; },
  markNew(id){
    const n = store.get("newToday", {}), today = n.day === dayKey();
    const rec = { day: dayKey(), count: today ? (n.count || 0) : 0, words: today ? (n.words || 0) : 0 };
    if(/^[vw]-/.test(id)) rec.words++; else rec.count++;
    store.set("newToday", rec);
  },
  dueIds(){
    const s = this.all(), end = endOfToday();
    return Object.entries(s).filter(([id, c]) => c.due <= end && Cards.get(id)).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
  },
  newIds(limit){
    const s = this.all();
    const room = Math.max(0, limit - this.newIntroducedToday());
    const wordRoom = Math.max(0, Settings.get("newWordsPerDay") - this.newWordsToday());
    const mix = Settings.get("mix"), lv = LEVELS.indexOf(Settings.get("startLevel"));
    const sources = [];
    if(mix.scenes !== false){
      const out = [], focus = Settings.get("focus").filter(k => SCENE_BY_KEY[k] && !SCENE_BY_KEY[k].virtual);
      const rounds = list => {
        const maxLen = Math.max(...list.map(x => x.items.length));
        for(let i = 0; i < maxLen && out.length < room; i++)
          for(const sc of list){
            const id = `${sc.key}-${i}`;
            if(i < sc.items.length && !s[id] && !out.includes(id)) out.push(id);
            if(out.length >= room) break;
          }
      };
      if(focus.length) rounds(focus.map(k => SCENE_BY_KEY[k]));
      if(out.length < room) rounds(SCENES.filter(sc => !sc.pack));
      sources.push(out);
    }
    const byLevel = list => LEVELS.slice(Math.max(0, lv)).concat(LEVELS.slice(0, Math.max(0, lv))).flatMap(L => list.filter(x => x.level === L));
    if(mix.pattern !== false) sources.push(byLevel(PATTERN_CARDS).filter(c => !s[c.id]).slice(0, room).map(c => c.id));
    const out = [];
    for(let i = 0; out.length < room && sources.some(x => i < x.length); i++)
      for(const src of sources){ if(i < src.length && out.length < room) out.push(src[i]); }
    if(mix.vocab !== false && wordRoom){
      const order = LEVELS.slice(Math.max(0, lv)).concat(LEVELS.slice(0, Math.max(0, lv)));
      const words = [];
      for(const L of order){ for(const w of ALL_WORDS){ if(w.l === L && !s[w.id]){ words.push(w.id); if(words.length >= wordRoom) break; } } if(words.length >= wordRoom) break; }
      // 单词和句子交错排列，避免连续一长串单词
      const merged = []; let a = 0, b = 0;
      while(a < out.length || b < words.length){ if(a < out.length) merged.push(out[a++]); if(b < words.length) merged.push(words[b++]); if(b < words.length) merged.push(words[b++]); }
      return merged;
    }
    return out;
  },
  forecast(days){
    const s = this.all(), out = new Array(days).fill(0);
    Object.values(s).forEach(c => {
      for(let d = 1; d <= days; d++){ if(c.due > startOfDay(d - 1) && c.due <= startOfDay(d)){ out[d - 1]++; break; } }
    });
    return out;
  },
  sceneProgress(key){
    const s = this.all(), sc = SCENE_BY_KEY[key];
    return sc.items.filter((_, i) => s[`${key}-${i}`] && s[`${key}-${i}`].reps > 0).length;
  },
  learnedCount(){ return Object.values(this.all()).filter(c => c.reps > 0).length; },
  /* grade: 0 没听懂 1 有点难 2 听懂了 3 太简单 */
  preview(id, grade){
    const c = this.all()[id] || { ivl: 0, ease: 2.5, reps: 0 };
    if(grade === 0) return 0;
    if(grade === 1) return Math.max(1, Math.round(c.ivl * 1.2));
    if(grade === 2) return c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(c.ivl + 1, Math.round(c.ivl * c.ease));
    return c.reps === 0 ? 3 : Math.max(c.ivl + 2, Math.round(c.ivl * c.ease * 1.3));
  },
  grade(id, grade){
    const s = this.all();
    const isNew = !s[id];
    const c = s[id] || { ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: 0 };
    const ivl = this.preview(id, grade);
    if(grade === 0){ c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.reps = 0; c.ivl = 0; c.due = Date.now() + 60 * 1000; }
    else {
      if(grade === 1) c.ease = Math.max(1.3, c.ease - 0.15);
      if(grade === 3) c.ease = c.ease + 0.15;
      c.reps++; c.ivl = ivl; c.due = startOfDay(ivl);
    }
    s[id] = c; store.set("srs", s);
    if(isNew) this.markNew(id);
  }
};

/* ---------- 朗读（美音） ---------- */
/* 性能统计：用来在「我的」里显示真实耗时 */
const Perf = {
  boot: 0, data: { sys: [], ai: [], clip: [], tap: [] },
  add(k, ms){ const a = this.data[k]; a.push(ms); if(a.length > 20) a.shift(); },
  avg(k){ const a = this.data[k]; return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; }
};
const TTS_OK = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IN_APP_BROWSER = /MicroMessenger|QQ\/|Weibo|DingTalk|Lark|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
const Speech = {
  voices: [], all: [], token: 0, unlocked: false, loaded: false, scene: null,
  stats: { started: 0, failed: 0, lastError: "" }, warned: false,
  score(v){
    let s = 0;
    if(/natural|neural|online/i.test(v.name)) s += 50;
    if(/premium/i.test(v.name)) s += 45;
    if(/enhanced|优化/i.test(v.name)) s += 35;
    if(/aria|jenny|guy|ava|zoe|evan|allison|samantha|nicky|tom|susan|joelle|nathan/i.test(v.name)) s += 15;
    if(/google/i.test(v.name)) s += 20;
    if(/^en[-_]US/i.test(v.lang)) s += 10;
    if(v.localService === true) s += 25; // 本地语音不用联网，开口更快
    if(/novelty|bells|bubbles|bad news|good news|boing|cellos|whisper|zarvox|trinoids|wobble|organ|jester|superstar|albert|fred|junior|ralph|kathy|bahh|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i.test(v.name)) s -= 100;
    return s;
  },
  load(){
    if(!TTS_OK) return;
    let all = [];
    try{ all = speechSynthesis.getVoices() || []; }catch(_){}
    this.all = all;
    if(all.length) this.loaded = true;
    let us = all.filter(v => /^en[-_]US/i.test(v.lang));
    if(!us.length) us = all.filter(v => /^en/i.test(v.lang));
    this.voices = us.sort((a, b) => this.score(b) - this.score(a));
    document.dispatchEvent(new Event("fluent-voices"));
  },
  voice(){ return this.voices.find(v => v.name === Settings.get("voice")) || this.voices[0] || null; },
  /* iOS 和部分安卓要求第一次朗读必须发生在用户点击的那一刻：首次触摸时先“解锁” */
  unlock(){
    if(this.unlocked || !TTS_OK) return;
    this.unlocked = true;
    try{ const u = new SpeechSynthesisUtterance(" "); u.volume = 0; u.lang = "en-US"; speechSynthesis.speak(u); }catch(_){}
  },
  fail(reason){
    this.stats.failed++; this.stats.lastError = reason;
    if(!this.warned){ this.warned = true; document.dispatchEvent(new Event("fluent-ttsfail")); if(typeof toast === "function") toast("没有声音？去「我的」→「声音检查」看看原因"); }
  },
  /* 朗读必须同步发出（不能放进定时器），否则会被浏览器当成“非用户操作”拦截 */
  /* 引擎报错时依次换别的发音人再试，最后不指定发音人；成功的发音人会被记住 */
  candidates(alt){
    const pref = this.voice();
    let list = [...this.voices];
    const good = Settings.get("goodVoice");
    list.sort((a, b) => (b.name === good) - (a.name === good) || (b === pref) - (a === pref) || (b.localService === true) - (a.localService === true));
    if(alt && list.length > 1) list = [list[1], list[0], ...list.slice(2)];
    return [...list, null];
  },
  say(text, rate, alt){
    // AI 真人语音可用时优先用它，出错再退回系统语音
    const t = String(text || "").trim();
    if(t && typeof Neural !== "undefined" && Neural.covers(t, alt)){
      const my = ++this.token;
      try{ if(TTS_OK) speechSynthesis.cancel(); }catch(_){}
      return Neural.say(t, rate || Settings.get("speed"), alt, my).catch(() => my === this.token ? this._say(t, rate, alt, 0) : false);
    }
    if(typeof Neural !== "undefined") Neural.stopPlayback();
    return this._say(text, rate, alt, 0);
  },
  _say(text, rate, alt, attempt){
    const my = attempt ? this.token : ++this.token;
    rate = rate || Settings.get("speed");
    text = String(text || "").trim();
    const words = text.split(/\s+/).length;
    const est = (words * 0.45 / rate + 1.2) * 1000;
    if(!TTS_OK || !text){ if(!TTS_OK) this.fail("unsupported"); return sleep(text ? est : 100).then(() => my === this.token); }
    if(!this.voices.length) this.load();
    return new Promise(resolve => {
      let done = false, started = false;
      const t0 = Date.now();
      const finish = () => { if(!done){ done = true; resolve(my === this.token); } };
      try{
        const synth = window.speechSynthesis;
        if(synth.speaking || synth.pending) synth.cancel();
        if(synth.paused) synth.resume();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        const cands = this.candidates(alt);
        const v = cands[Math.min(attempt, cands.length - 1)];
        if(v){ u.voice = v; u.lang = String(v.lang || "en-US").replace("_", "-"); }
        u.rate = rate; u.volume = 1;
        u.onstart = () => { started = true; this.stats.started++; Perf.add("sys", Date.now() - t0); this.stats.lastError = ""; if(attempt) Settings.set("goodVoice", v ? v.name : ""); };
        u.onend = () => {
          // 有的手机没有英文语音时会“瞬间结束”而不出声
          if(!started && Date.now() - t0 < 250 && words > 1 && my === this.token) this.fail("instant-end");
          finish();
        };
        let retried = false;
        u.onerror = e => {
          const er = e && e.error;
          // 有的手机指定发音人会出错，换成只指定语言、让系统自己选再试一次
          if(!retried && !started && (er === "synthesis-failed" || er === "voice-unavailable" || er === "language-unavailable") && my === this.token){
            retried = true;
            try{
              const u2 = new SpeechSynthesisUtterance(text); u2.lang = "en-US"; u2.rate = rate;
              u2.onstart = u.onstart; u2.onend = u.onend;
              u2.onerror = e2 => { const r2 = e2 && e2.error; if(r2 && r2 !== "interrupted" && r2 !== "canceled" && my === this.token) this.fail(r2); finish(); };
              this._keep = u2; synth.cancel(); synth.speak(u2); return;
            }catch(_){}
          }
          if(er === "not-allowed"){ this.stats.lastError = er; if(typeof toast === "function" && my === this.token) toast("点一下播放按钮就能听到"); }
          else if(er && er !== "interrupted" && er !== "canceled" && my === this.token){
            const n = this.candidates(alt).length;
            if(!started && attempt + 1 < n && !done){ done = true; this.stats.lastError = er; this._say(text, rate, alt, attempt + 1).then(resolve); return; }
            this.fail(er);
          }
          finish();
        };
        this._keep = u; // 防止被垃圾回收导致 onend 不触发（Chrome 的老问题）
        synth.speak(u);
        // 个别浏览器在 cancel 之后第一次 speak 会被吞掉：没开始就再补发一次
        setTimeout(() => { if(!started && !done && my === this.token && !synth.speaking && !synth.pending){ try{ synth.speak(u); }catch(_){} } }, 700);
        setTimeout(() => { if(!started && !done && my === this.token) this.fail("nostart"); }, 4000);
        setTimeout(finish, est + 3000);
      }catch(e){ this.fail(e.message || "error"); finish(); }
    });
  },
  stop(){ this.token++; try{ if(TTS_OK) speechSynthesis.cancel(); }catch(_){} if(typeof Neural !== "undefined") Neural.stopPlayback(); },
  async chunks(list, rate){
    const my = this.token + 1;
    for(let i = 0; i < list.length; i++){
      const ok = await this.say(list[i], rate);
      if(!ok || this.token !== my + i) return;
      await sleep(650);
      if(this.token !== my + i) return;
    }
  }
};
if(TTS_OK){
  Speech.load();
  try{ speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", () => Speech.load()) : (speechSynthesis.onvoiceschanged = () => Speech.load()); }catch(_){ speechSynthesis.onvoiceschanged = () => Speech.load(); }
  // 有的安卓不会触发 voiceschanged，过一会儿再读一次
  [300, 1000, 2500].forEach(t => setTimeout(() => { if(!Speech.voices.length) Speech.load(); }, t));
}
["pointerdown", "touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, () => { Speech.unlock(); if(typeof Neural !== "undefined") Neural.unlock(); }, { once: true, capture: true }));

/* ---------- 语音识别 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRecognizer = null;
/* 浏览器自带的语音识别；页面里统一调用 stt.js 的 startListening，它会决定用哪种识别 */
function startSystemListening({ onText, target } = {}){
  if(!SR) return { stop(){}, done: Promise.resolve({ error: "unsupported", text: "" }) };
  let r, finals = [], confs = [], err = null, interim = "";
  const done = new Promise(resolve => {
    try{ r = new SR(); }catch(e){ resolve({ error: "unsupported", text: "" }); return; }
    r.lang = "en-US"; r.continuous = !IS_ANDROID; r.interimResults = true; r.maxAlternatives = 3;
    r.onresult = e => {
      finals = []; confs = []; interim = "";
      for(let i = 0; i < e.results.length; i++){
        const res = e.results[i];
        if(res.isFinal){
          let best = res[0];
          if(target){
            let bs = -1;
            for(let k = 0; k < res.length; k++){ const sc = lcsLen(normalize(target), normalize(res[k].transcript)); if(sc > bs){ bs = sc; best = res[k]; } }
          }
          finals.push(best.transcript.trim());
          if(best.confidence > 0) confs.push(best.confidence);
        } else interim += res[0].transcript;
      }
      onText && onText((finals.join(" ") + " " + interim).trim());
    };
    r.onerror = e => { err = e.error; };
    r.onend = () => {
      // 安卓上偶尔每个结果都包含前面的内容，只保留最长的那一条
      if(finals.length > 1 && finals.every((f, k) => k === 0 || f.toLowerCase().startsWith(finals[k - 1].toLowerCase()))) finals = [finals[finals.length - 1]];
      const text = finals.join(" ").trim() || interim.trim();
      resolve({ text, confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0, error: text ? null : err });
    };
    try{ r.start(); }catch(e){ resolve({ error: "start-failed", text: "" }); }
    activeRecognizer = r;
  });
  return { stop(){ try{ r && r.stop(); }catch(_){} }, done: Promise.race([done, new Promise(res => setTimeout(() => res({ text: interim, error: "timeout" }), 60000))]) };
}
function srErrorText(e){
  if(typeof SR_ERR_MORE !== "undefined" && SR_ERR_MORE[e]) return SR_ERR_MORE[e];
  return ({
    unsupported: "这个浏览器不支持语音识别，也不能录音。请用 Safari 或 Chrome 打开。",
    network: "手机自带的语音识别连不上服务器（安卓要能连上 Google）。可以在「我的 → 跟读识别」改用手机上识别。",
    "not-allowed": "没有麦克风权限。" + (typeof MIC_FIX !== "undefined" ? MIC_FIX : "请在浏览器设置里允许麦克风。"),
    "service-not-allowed": "这台手机不允许网页用自带的语音识别（iPhone 要打开 Siri 和听写）。可以在「我的 → 跟读识别」改用手机上识别。",
    "audio-capture": "麦克风被占用了，或者没拿到麦克风权限。",
    "no-speech": "没听到声音，靠近麦克风再试一次。",
    "language-not-supported": "手机的语音识别不支持英语，需要安装 Google 语音服务。",
    "start-failed": "语音识别没能启动，稍等一下再点一次。",
    timeout: "识别超时了，再试一次。"
  })[e] || "没听清，再试一次。";
}

/* ---------- 小提示条 ---------- */
let toastTimer = null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
}
