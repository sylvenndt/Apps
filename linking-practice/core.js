"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => { a = [...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* ---------- 本地存储 ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem("fluent:" + k); return v === null ? d : JSON.parse(v); }catch(_){ return d; } },
  set(k, v){ try{ localStorage.setItem("fluent:" + k, JSON.stringify(v)); }catch(_){} },
  keys(){ try{ return Object.keys(localStorage).filter(k => k.startsWith("fluent:")).map(k => k.slice(7)); }catch(_){ return []; } }
};

const Settings = {
  defaults: { speed: 0.9, voice: "", newPerDay: 8, reactSec: 8, apiKey: "", model: "claude-sonnet-5-5", keepAudio: true },
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
    const lib = ALL_ITEMS.find(x => x.id === id);
    if(lib) return lib;
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
  newIntroducedToday(){ const n = store.get("newToday", {}); return n.day === dayKey() ? n.count : 0; },
  markNew(){ const c = this.newIntroducedToday() + 1; store.set("newToday", { day: dayKey(), count: c }); },
  dueIds(){
    const s = this.all(), end = endOfToday();
    return Object.entries(s).filter(([id, c]) => c.due <= end && Cards.get(id)).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
  },
  newIds(limit){
    const s = this.all(), out = [];
    const room = Math.max(0, limit - this.newIntroducedToday());
    if(!room) return out;
    const maxLen = Math.max(...SCENES.map(x => x.items.length));
    for(let i = 0; i < maxLen && out.length < room; i++)
      for(const sc of SCENES){
        const id = `${sc.key}-${i}`;
        if(i < sc.items.length && !s[id]) out.push(id);
        if(out.length >= room) break;
      }
    return out;
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
    if(isNew) this.markNew();
  }
};

/* ---------- 朗读（美音） ---------- */
const Speech = {
  voices: [],
  token: 0,
  score(v){
    let s = 0;
    if(/natural|neural|online/i.test(v.name)) s += 50;
    if(/premium/i.test(v.name)) s += 45;
    if(/enhanced|优化/i.test(v.name)) s += 35;
    if(/aria|jenny|guy|ava|zoe|evan|allison|samantha|nicky|tom|susan|joelle|nathan/i.test(v.name)) s += 15;
    if(/google/i.test(v.name)) s += 20;
    if(/novelty|bells|bubbles|bad news|good news|boing|cellos|whisper|zarvox|trinoids|wobble|organ|jester|superstar|albert|fred|junior|ralph|kathy|bahh/i.test(v.name)) s -= 100;
    return s;
  },
  load(){
    if(!("speechSynthesis" in window)) return;
    const all = speechSynthesis.getVoices();
    let us = all.filter(v => /^en[-_]US/i.test(v.lang));
    if(!us.length) us = all.filter(v => /^en/i.test(v.lang));
    this.voices = us.sort((a, b) => this.score(b) - this.score(a));
    document.dispatchEvent(new Event("voiceschanged"));
  },
  voice(){ return this.voices.find(v => v.name === Settings.get("voice")) || this.voices[0] || null; },
  say(text, rate){
    const my = ++this.token;
    rate = rate || Settings.get("speed");
    const words = String(text).split(/\s+/).length;
    const est = (words * 0.42 / rate + 1.5) * 1000;
    if(!("speechSynthesis" in window)) return sleep(400);
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if(!done){ done = true; resolve(my === this.token); } };
      try{
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        const v = this.voice(); if(v) u.voice = v;
        u.rate = rate;
        u.onend = finish; u.onerror = finish;
        setTimeout(() => { if(my === this.token) speechSynthesis.speak(u); else finish(); }, 60);
        setTimeout(finish, est + 2500);
      }catch(_){ finish(); }
    });
  },
  stop(){ this.token++; try{ speechSynthesis.cancel(); }catch(_){} },
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
if("speechSynthesis" in window){ Speech.load(); speechSynthesis.onvoiceschanged = () => Speech.load(); }

/* ---------- 语音识别 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function startListening({ onText, target } = {}){
  if(!SR) return { stop(){}, done: Promise.resolve({ error: "unsupported", text: "" }) };
  let r, finals = [], confs = [], err = null, interim = "";
  const done = new Promise(resolve => {
    try{ r = new SR(); }catch(e){ resolve({ error: "unsupported", text: "" }); return; }
    r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
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
      const text = finals.join(" ").trim() || interim.trim();
      resolve({ text, confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0, error: text ? null : err });
    };
    try{ r.start(); }catch(e){ resolve({ error: "start-failed", text: "" }); }
  });
  return { stop(){ try{ r && r.stop(); }catch(_){} }, done: Promise.race([done, new Promise(res => setTimeout(() => res({ text: interim, error: "timeout" }), 60000))]) };
}
function srErrorText(e){
  return ({
    unsupported: "这个浏览器不支持语音识别，可以用输入法自带的语音输入。",
    network: "语音识别需要联网，现在连不上识别服务。",
    "not-allowed": "没有麦克风权限，请在浏览器设置里允许。",
    "service-not-allowed": "浏览器不允许语音识别。",
    "audio-capture": "麦克风被占用了。",
    "no-speech": "没听到声音，靠近麦克风再试一次。"
  })[e] || "没听清，再试一次。";
}

/* ---------- 小提示条 ---------- */
let toastTimer = null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
}
