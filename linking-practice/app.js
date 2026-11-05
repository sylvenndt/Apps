"use strict";
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12.1-7.4a1 1 0 0 0 0-1.7L8.52 3.75A1 1 0 0 0 7 4.6z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
const LINE = { review: "var(--blue)", listen: "var(--orange)", speak: "var(--green)", link: "var(--purple)", me: "var(--ink)" };

function bulletHTML(sceneKey, lg){
  const s = SCENE_BY_KEY[sceneKey];
  if(!s) return `<span class="bullet${lg ? " lg" : ""}" style="--c:var(--ink)">★</span>`;
  return `<span class="bullet${lg ? " lg" : ""}${s.dark ? " dk" : ""}" style="--c:${s.color}">${esc(s.mark)}</span>`;
}

/* 英文句子：意群分隔 + 连读标记 */
function renderEn(chunks){
  const toks = tokenize(chunks.join(" "));
  const byI = new Map(detectLinks(toks).map(l => [l.i, l]));
  const bounds = new Set(); let c = 0;
  chunks.forEach((ch, k) => { c += tokenize(ch).length; if(k < chunks.length - 1) bounds.add(c - 1); });
  let html = "";
  toks.forEach((t, i) => {
    html += `<span class="w">${esc(t.raw)}</span>`;
    if(i < toks.length - 1){
      const l = byI.get(i);
      html += l ? `<span class="lk c-${l.cls}" title="${esc(l.kind)}">‿</span>` : bounds.has(i) ? `<span class="sep"></span>` : " ";
    }
  });
  return html;
}

/* 播放按钮：说话时有波纹 */
async function playWith(btn, text, rate, alt){
  $$(".play.speaking").forEach(b => b.classList.remove("speaking"));
  btn && btn.classList.add("speaking");
  const ok = await Speech.say(text, rate, alt);
  btn && btn.classList.remove("speaking");
  return ok;
}

let activeListen = null;
function stopActiveListen(){ if(activeListen){ activeListen.stop(); activeListen = null; } }

const Views = {};

/* ================= 今日 ================= */
function topicOfDay(){
  const days = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return days % TOPICS.length;
}
Views.today = {
  show(){
    const d = new Date();
    const due = SRS.dueIds().length, nw = SRS.newIds(Settings.get("newPerDay")).length;
    const lg = Log.today(), t = TOPICS[topicOfDay()];
    const stops = [
      { key: "review", t: "复习", s: due + nw ? `${due} 句到期，${nw} 句新句` : (lg.review ? `今天复习了 ${lg.review} 次` : "暂时没有要复习的"), done: due + nw === 0, href: "#review", cta: "开始" },
      { key: "listen", t: "听力直通", s: lg.listen ? `完成了 ${lg.listen} 组` : "10 题，听完马上选，不翻译", done: lg.listen > 0, href: "#listen", cta: lg.listen ? "再来" : "开始" },
      { key: "speak", t: "口语", s: lg.speak ? `练了 ${lg.speak} 句` : `今日话题：${t.title}`, done: lg.speak > 0, href: "#speak", act: "today-topic", cta: lg.speak ? "再练" : "开始" },
      { key: "link", t: "连读跟读", s: lg.link ? `跟读了 ${lg.link} 次` : "读一句，检查连读和停顿", done: lg.link > 0, href: "#link", cta: lg.link ? "再练" : "开始" }
    ];
    const streak = Log.streak();
    $("#v-today").innerHTML = `
      <div class="top">
        <div><p class="muted">${d.getMonth() + 1}月${d.getDate()}日 星期${"日一二三四五六"[d.getDay()]}</p><h1>今天的路线</h1></div>
        <div class="streak"><b>${streak}</b><span>连续天数</span></div>
      </div>
      <div class="route">
        ${stops.map(s => `
          <div class="stop${s.done ? " done" : ""}" style="--c:${LINE[s.key]}">
            <span class="seg"></span><span class="dot"></span>
            <div><div class="t">${s.t}</div><div class="s">${esc(s.s)}</div></div>
            ${s.done && s.key === "review" ? `<span class="small ok">完成</span>` :
              `<a class="btn sm ${s.done ? "ghost" : "line"}" style="--c:${LINE[s.key]}" href="${s.href}" ${s.act ? `data-act="${s.act}"` : ""}>${s.cta}</a>`}
          </div>`).join("")}
      </div>
      <div class="stats">
        <div class="stat"><b>${SRS.learnedCount()}</b><span>学过的句子</span></div>
        <div class="stat"><b>${Log.activeDays()}</b><span>练习天数</span></div>
        <div class="stat"><b>${ALL_ITEMS.length + Cards.user().length}</b><span>句库总数</span></div>
      </div>
      <a class="lib-link" href="#library">
        <div class="grow"><div class="t">句库</div><div class="small muted">${ALL_ITEMS.length} 句，${SCENES.length} 个场景，可以挑重点场景先学</div></div>
        <span class="small muted">明天复习 ${SRS.forecast(1)[0]} 句</span>
      </a>
      <p class="small muted" style="margin-top:18px">每天按顺序走完这四站：先复习巩固，再练听力反应，然后开口表达，最后打磨发音。</p>`;
  }
};

/* ================= 复习 ================= */
const Review = { queue: null, day: null, idx: 0, done: 0, revealed: false, said: null };
const REVIEW_MODES = [["listen", "听音理解"], ["speak", "看中文说英文"], ["mix", "混合"]];
function reviewType(id){
  const card = Cards.get(id), mode = Settings.get("reviewMode");
  if(!card || !card.zh) return "listen";
  if(mode === "mix"){ let h = 0; for(const ch of id + dayKey()) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 2 ? "speak" : "listen"; }
  return mode;
}
Views.review = {
  show(){
    if(!Review.queue || Review.day !== dayKey() || Review.idx >= Review.queue.length){
      Review.queue = [...SRS.dueIds(), ...SRS.newIds(Settings.get("newPerDay"))];
      Review.day = dayKey(); Review.idx = 0; Review.done = 0;
    }
    this.render();
  },
  header(left){
    return `
      <div class="row between" style="margin-bottom:12px">
        <div class="row"><a class="icon-btn" href="#today" aria-label="返回">${ICON.back}</a><h2 style="margin:0">复习</h2></div>
        ${left !== undefined ? `<span class="small muted">还剩 ${left} 句</span>` : ""}
      </div>
      <div class="chips" id="rv-modes">${REVIEW_MODES.map(([k, n]) => `<button class="chip${Settings.get("reviewMode") === k ? " on" : ""}" data-m="${k}">${n}</button>`).join("")}</div>`;
  },
  bindModes(){
    $$("#rv-modes .chip").forEach(b => b.onclick = () => { Settings.set("reviewMode", b.dataset.m); this.render(); });
  },
  render(){
    const v = $("#v-review");
    Speech.stop(); stopActiveListen();
    const id = Review.queue[Review.idx];
    const card = id && Cards.get(id);
    if(!card){
      const fc = SRS.forecast(7);
      v.innerHTML = `${this.header()}
        <div class="empty">
          <div class="big">今天的复习完成了</div>
          <p class="muted">${Review.done ? `这一轮复习了 ${Review.done} 次。` : ""}明天有 ${fc[0]} 句到期，未来 7 天共 ${fc.reduce((a, b) => a + b, 0)} 句。</p>
          <div class="stack" style="margin-top:22px">
            <a class="btn line block" style="--c:var(--orange)" href="#listen" data-act="hf-learned">用随身听再磨一遍耳朵</a>
            <a class="btn ghost block" href="#library">去句库挑更多句子</a>
          </div>
        </div>`;
      this.bindModes();
      return;
    }
    Review.revealed = false; Review.said = null;
    const type = reviewType(id);
    const isNew = !SRS.all()[id];
    const sc = SCENE_BY_KEY[card.scene];
    const front = type === "listen" ? `
        <button class="play" id="rv-play" style="--c:var(--blue)" aria-label="播放">${ICON.play}</button>
        <p class="small muted" style="text-align:center" id="rv-tip">只听，别翻译。试着直接想到画面，或者想好怎么回应。</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px" id="rv-tools">
          <button class="chip" id="rv-slow">慢速</button>
          <button class="chip" id="rv-chunks">按意群播放</button>
          <button class="chip" id="rv-reveal">显示英文</button>
        </div>` : `
        <p class="zh-big">${esc(card.zh)}</p>
        <p class="small muted" style="text-align:center" id="rv-tip">用英语把这句说出来。想不起来就先说个大概。</p>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="mic lg" id="rv-say" style="--c:var(--blue)" aria-label="开始说">${ICON.mic}</button></div>
        <p id="rv-said" style="text-align:center;font-weight:600;min-height:24px;margin-top:10px"></p>
        <div class="row" style="justify-content:center"><button class="chip" id="rv-reveal">看答案</button></div>`;
    v.innerHTML = `${this.header(Review.queue.length - Review.idx)}
      <div class="panel" style="margin-top:14px">
        <div class="row">${bulletHTML(card.scene)}<span class="small muted">${sc ? esc(sc.name) : "我的句子"}${isNew ? "，新句" : ""}</span></div>
        ${front}
        <div id="rv-text" hidden style="margin-top:18px">
          ${type === "speak" ? `<div class="row" style="margin-bottom:10px"><button class="play sm" id="rv-play" style="--c:var(--blue)" aria-label="播放">${ICON.play}</button><button class="chip" id="rv-slow">慢速</button><button class="chip" id="rv-chunks">按意群</button></div>` : ""}
          <div class="en">${renderEn(card.chunks)}</div>
          ${type === "listen" ? `<p class="zh blur" id="rv-zh" style="margin-top:6px" title="点一下显示中文">${esc(card.zh || "（没有中文）")}</p>` : `<p class="small" id="rv-cmp" style="margin-top:6px"></p>`}
          ${card.reply ? `<div class="row" style="margin-top:14px;align-items:flex-start">
            <button class="play sm" id="rv-reply" style="--c:var(--ink)" aria-label="播放回应">${ICON.play}</button>
            <div><div class="small muted">对方可能这样回</div><div style="font-weight:600">${esc(card.reply)}</div></div></div>` : ""}
          ${type === "listen" ? `<div class="row" style="margin-top:14px">
            <button class="btn soft sm" id="rv-shadow">${ICON.mic}<span>跟读</span></button>
            <span class="small muted grow" id="rv-shadow-res"></span></div>` : ""}
        </div>
      </div>
      <div id="rv-grades" style="margin-top:16px" hidden>
        <p class="small muted" style="margin-bottom:8px">${type === "listen" ? "刚才只听的时候，你听懂了吗？" : "你刚才说得出来吗？"}</p>
        <div class="grades">
          ${(type === "listen" ? ["没听懂", "有点难", "听懂了", "太简单"] : ["说不出", "说得磕绊", "说对了", "张口就来"]).map((g, k) => {
            const days = SRS.preview(id, k);
            return `<button class="grade g${k}" data-g="${k}"><b>${g}</b><span>${days ? days + " 天后" : "马上再来"}</span></button>`;
          }).join("")}
        </div>
      </div>`;
    this.bindModes();
    const play = () => $("#rv-play");
    const bindAudio = () => {
      $("#rv-play").onclick = () => playWith(play(), card.en);
      $("#rv-slow").onclick = () => playWith(play(), card.en, Math.max(0.5, Settings.get("speed") - 0.3));
      $("#rv-chunks").onclick = async () => { play().classList.add("speaking"); await Speech.chunks(card.chunks, Math.max(0.6, Settings.get("speed") - 0.1)); play() && play().classList.remove("speaking"); };
    };
    bindAudio();
    $("#rv-reveal").onclick = () => this.reveal(card, type);
    const zh = $("#rv-zh"); if(zh) zh.onclick = e => e.currentTarget.classList.toggle("show");
    const rp = $("#rv-reply"); if(rp) rp.onclick = () => playWith(rp, card.reply, null, true);
    const sh = $("#rv-shadow"); if(sh) sh.onclick = () => this.shadow(card);
    const say = $("#rv-say"); if(say) say.onclick = () => this.sayIt(card);
    $$("#rv-grades .grade").forEach(b => b.onclick = () => this.grade(id, +b.dataset.g));
    if(type === "listen") setTimeout(() => { if(location.hash === "#review" && $("#rv-play") === play()) playWith(play(), card.en); }, 250);
  },
  reveal(card, type){
    stopActiveListen();
    Review.revealed = true;
    $("#rv-text").hidden = false; $("#rv-grades").hidden = false;
    $("#rv-reveal").remove(); $("#rv-tip").hidden = true;
    if(type === "speak"){
      const cmp = $("#rv-cmp");
      if(Review.said){
        const tgt = normalize(card.en), got = normalize(Review.said);
        const pct = Math.round(100 * lcsLen(tgt, got) / Math.max(tgt.length, got.length, 1));
        cmp.innerHTML = `和答案的重合度 <b class="${pct >= 80 ? "ok" : pct >= 50 ? "mid" : "no"}">${pct}%</b>。意思对、说法不同也没关系，记住地道的版本。`;
      } else cmp.innerHTML = `<span class="muted">先听两遍，再跟着说一遍。</span>`;
      playWith($("#rv-play"), card.en);
    }
  },
  async sayIt(card){
    const btn = $("#rv-say"), out = $("#rv-said");
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    btn.classList.add("on"); btn.innerHTML = ICON.stop;
    out.textContent = "请说…";
    activeListen = startListening({ target: card.en, onText: t => out.textContent = t });
    const r = await activeListen.done; activeListen = null;
    if(!$("#rv-say")) return;
    btn.classList.remove("on"); btn.innerHTML = ICON.mic;
    if(!r.text){ out.textContent = srErrorText(r.error); return; }
    Review.said = r.text; out.textContent = "“" + r.text + "”";
    if(!Review.revealed) this.reveal(card, "speak");
  },
  async shadow(card){
    const btn = $("#rv-shadow"), res = $("#rv-shadow-res");
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    btn.innerHTML = `${ICON.stop}<span>说完点这里</span>`;
    res.textContent = "请跟读…";
    activeListen = startListening({ target: card.en, onText: t => res.textContent = t });
    const r = await activeListen.done; activeListen = null;
    if(!$("#rv-shadow")) return;
    btn.innerHTML = `${ICON.mic}<span>跟读</span>`;
    if(!r.text){ res.textContent = srErrorText(r.error); return; }
    const tgt = normalize(card.en), got = normalize(r.text);
    const pct = Math.round(100 * lcsLen(tgt, got) / Math.max(tgt.length, got.length, 1));
    res.innerHTML = `<b class="${pct >= 85 ? "ok" : pct >= 60 ? "mid" : "no"}">${pct}%</b> 听到：“${esc(r.text)}”`;
  },
  grade(id, g){
    SRS.grade(id, g);
    Log.add("review");
    Review.done++;
    if(g === 0) Review.queue.splice(Math.min(Review.queue.length, Review.idx + 4), 0, id);
    Review.idx++;
    this.render();
  }
};

/* ================= 句库 ================= */
const Lib = { open: null };
Views.library = {
  show(){
    const focus = Settings.get("focus");
    const s = SRS.all();
    $("#v-library").innerHTML = `
      <div class="row" style="margin-bottom:14px"><a class="icon-btn" href="#today" aria-label="返回">${ICON.back}</a><h2 style="margin:0">句库</h2></div>
      <p class="muted" style="margin-bottom:6px">${ALL_ITEMS.length} 句美国人日常口语，分 ${SCENES.length} 个场景。点 ☆ 设为重点场景，每天的新句会优先从重点场景里出。</p>
      ${CATS.map(c => `
        <h3>${esc(c.name)}</h3>
        <div class="panel" style="padding:2px 16px">
          ${c.scenes.map(k => {
            const sc = SCENE_BY_KEY[k], prog = SRS.sceneProgress(k), on = focus.includes(k);
            return `
            <div class="scene-row">
              <button class="scene-head" data-open="${k}">${bulletHTML(k)}
                <div class="grow"><div class="t">${esc(sc.name)}</div><div class="small muted">${esc(sc.en)}，已学 ${prog}/${sc.items.length}</div></div>
                <span class="bar"><i style="width:${prog / sc.items.length * 100}%;background:${sc.color}"></i></span>
              </button>
              <button class="star${on ? " on" : ""}" data-focus="${k}" aria-label="设为重点">${on ? "★" : "☆"}</button>
            </div>
            ${Lib.open === k ? `<div class="scene-items">
              ${ALL_ITEMS.filter(x => x.scene === k).map(it => `
                <div class="li">
                  <button class="play sm" data-p="${it.id}" style="--c:${sc.color}" aria-label="播放">${ICON.play}</button>
                  <div class="grow"><div style="font-weight:600">${esc(it.en)}</div><div class="small muted">${esc(it.zh)}</div></div>
                  ${s[it.id] ? `<span class="small muted">复习中</span>` : `<button class="chip" data-add="${it.id}">学这句</button>`}
                </div>`).join("")}
              <div class="row" style="gap:8px;padding:10px 0 14px">
                <button class="btn sm line" style="--c:${sc.color}" data-addall="${k}">整个场景加入今天的复习</button>
                <a class="btn sm ghost" href="#listen" data-act="listen-scene" data-scene="${k}">练这个场景的听力</a>
              </div>
            </div>` : ""}`;
          }).join("")}
        </div>`).join("")}`;
    $$("#v-library [data-open]").forEach(b => b.onclick = () => { Lib.open = Lib.open === b.dataset.open ? null : b.dataset.open; const y = window.scrollY; this.show(); window.scrollTo(0, y); });
    $$("#v-library [data-focus]").forEach(b => b.onclick = () => {
      const k = b.dataset.focus; let f = Settings.get("focus").filter(x => x !== k);
      if(!Settings.get("focus").includes(k)) f.push(k);
      Settings.set("focus", f); Review.queue = null; const y = window.scrollY; this.show(); window.scrollTo(0, y);
      toast(f.includes(k) ? "已设为重点场景" : "已取消重点");
    });
    $$("#v-library [data-p]").forEach(b => b.onclick = () => playWith(b, Cards.get(b.dataset.p).en));
    $$("#v-library [data-add]").forEach(b => b.onclick = () => { SRS.schedule(b.dataset.add, Date.now()); Review.queue = null; b.outerHTML = `<span class="small muted">复习中</span>`; toast("已加入今天的复习"); });
    $$("#v-library [data-addall]").forEach(b => b.onclick = () => {
      const k = b.dataset.addall; ALL_ITEMS.filter(x => x.scene === k).forEach(x => { if(!SRS.all()[x.id]) SRS.schedule(x.id, Date.now()); });
      Review.queue = null; toast("已加入今天的复习"); const y = window.scrollY; this.show(); window.scrollTo(0, y);
    });
  }
};

/* ================= 听力直通 ================= */
const Listen = { state: "setup", scene: "all", qs: [], i: 0, results: [], timer: null, t0: 0, answered: false,
  hf: { list: [], i: 0, playing: false, token: 0, reps: 2, reply: true, showText: true, lock: null } };

function listenPool(sel){
  if(sel === "learned") return Object.keys(SRS.all()).map(id => Cards.get(id)).filter(Boolean);
  if(sel.startsWith("cat:")){ const c = CATS.find(x => "cat:" + x.key === sel); return ALL_ITEMS.filter(x => c && c.scenes.includes(x.scene)); }
  if(sel === "all") return ALL_ITEMS;
  return ALL_ITEMS.filter(x => x.scene === sel);
}
function poolLabel(sel){
  if(sel === "all") return "全部场景";
  if(sel === "learned") return "我学过的";
  if(sel.startsWith("cat:")) return (CATS.find(x => "cat:" + x.key === sel) || {}).name || "";
  return (SCENE_BY_KEY[sel] || {}).name || "";
}

/* 把句子里的一个小词换掉，做成“听准细节”的干扰项 */
function detailVariants(en){
  const toks = en.split(" "), cands = new Map();
  toks.forEach((t, i) => {
    const m = t.match(/^([^A-Za-z'’]*)([A-Za-z'’]+)([^A-Za-z'’]*)$/); if(!m) return;
    const low = m[2].toLowerCase().replace(/’/g, "'");
    const g = CONFUSE.find(g => g.includes(low)); if(!g) return;
    g.filter(x => x !== low).forEach(alt => {
      let w = alt;
      if(alt.startsWith("i'")) w = "I" + alt.slice(1);
      else if(/^[A-Z]/.test(m[2])) w = alt[0].toUpperCase() + alt.slice(1);
      if(alt === "a" && toks[i + 1] && /^[aeiou]/i.test(toks[i + 1])) w = /^[A-Z]/.test(m[2]) ? "An" : "an";
      const t2 = [...toks]; t2[i] = m[1] + w + m[3];
      const s = t2.join(" ");
      if(s !== en) cands.set(s, i);
    });
  });
  const picks = shuffle([...cands.keys()]).slice(0, 3);
  return picks.length >= 2 ? picks : null;
}

Views.listen = {
  show(){
    if(Listen.state === "q") this.renderQ();
    else if(Listen.state === "done") this.renderDone();
    else if(Listen.state === "hf") this.renderHF();
    else this.renderSetup();
  },
  renderSetup(){
    Listen.state = "setup";
    const rs = Settings.get("reactSec"), sel = Listen.scene;
    const learnedN = Object.keys(SRS.all()).length;
    $("#v-listen").innerHTML = `
      <h1>听力直通</h1>
      <p class="muted" style="margin:8px 0 18px">只放声音，选项全是英文，听完马上选。没有时间翻译，大脑只能直接抓意思。还会专门考你连读里最容易漏掉的小词。</p>
      <h3>练哪些场景</h3>
      <div class="chips" id="ls-cats">
        <button class="chip${sel === "all" ? " on" : ""}" data-s="all">全部</button>
        ${CATS.map(c => `<button class="chip${sel === "cat:" + c.key ? " on" : ""}" data-s="cat:${c.key}">${esc(c.name)}</button>`).join("")}
        ${learnedN ? `<button class="chip${sel === "learned" ? " on" : ""}" data-s="learned">我学过的（${learnedN}）</button>` : ""}
      </div>
      <div class="chips" id="ls-scenes" style="margin-top:8px">
        ${SCENES.map(s => `<button class="chip${sel === s.key ? " on" : ""}" data-s="${s.key}"><i class="mini-bullet" style="--c:${s.color}"></i>${esc(s.name)}</button>`).join("")}
      </div>
      <h3>反应时间</h3>
      <div class="chips" id="ls-react">
        ${[[12, "宽松 12 秒"], [8, "标准 8 秒"], [5, "挑战 5 秒"]].map(([s, l]) => `<button class="chip${rs === s ? " on" : ""}" data-r="${s}">${l}</button>`).join("")}
      </div>
      <h3>语速</h3>
      <div class="speed"><input type="range" id="ls-speed" min="0.5" max="1.4" step="0.05" value="${Settings.get("speed")}" aria-label="语速"><b id="ls-speed-v">${Settings.get("speed").toFixed(2)}×</b></div>
      <p class="small muted" style="margin-top:4px">想适应美国人的正常语速，熟练后调到 1× 以上。</p>
      <button class="btn line block" style="--c:var(--orange);margin-top:22px;padding:15px" id="ls-start">开始 10 题</button>
      <button class="hf-card" id="ls-hf">
        <div class="grow"><div class="t">随身听</div><div class="small muted">自动连播所选场景的对话，一句一句磨耳朵。适合通勤、做家务时听。</div></div>
        <span class="play sm" style="--c:var(--ink)">${ICON.play}</span>
      </button>
      <p class="small muted" style="margin-top:12px">题型有三种：听完选怎么回应、听准句子里的小词、判断在哪个场景。答错或超时的句子会自动加入复习。</p>`;
    $$("#ls-cats .chip, #ls-scenes .chip").forEach(b => b.onclick = () => { Listen.scene = b.dataset.s; $$("#ls-cats .chip, #ls-scenes .chip").forEach(x => x.classList.toggle("on", x === b)); });
    $$("#ls-react .chip").forEach(b => b.onclick = () => { Settings.set("reactSec", +b.dataset.r); $$("#ls-react .chip").forEach(x => x.classList.toggle("on", x === b)); });
    $("#ls-speed").oninput = e => { Settings.set("speed", +e.target.value); $("#ls-speed-v").textContent = (+e.target.value).toFixed(2) + "×"; };
    $("#ls-start").onclick = () => this.start();
    $("#ls-hf").onclick = () => this.startHF();
  },
  start(){
    const pool = listenPool(Listen.scene);
    if(!pool.length){ toast("这里还没有句子"); return; }
    const multi = new Set(pool.map(x => x.scene)).size > 1;
    const picks = shuffle(pool).slice(0, 10);
    Listen.qs = picks.map(it => {
      const types = [];
      if(it.reply) types.push(["reply", 45]);
      const dv = detailVariants(it.en);
      if(dv) types.push(["detail", 35]);
      if(multi && SCENE_BY_KEY[it.scene]) types.push(["scene", 20]);
      if(!types.length) return null;
      let r = Math.random() * types.reduce((a, t) => a + t[1], 0), type = types[0][0];
      for(const [t, w] of types){ if((r -= w) <= 0){ type = t; break; } }
      if(type === "reply"){
        const others = shuffle(ALL_ITEMS.filter(x => x.scene !== it.scene)).slice(0, 3).map(x => x.reply);
        return { it, type, opts: shuffle([it.reply, ...others]), ans: it.reply };
      }
      if(type === "detail") return { it, type, opts: shuffle([it.en, ...dv]), ans: it.en };
      const others = shuffle(SCENES.filter(s => s.key !== it.scene)).slice(0, 3).map(s => s.en);
      return { it, type, opts: shuffle([SCENE_BY_KEY[it.scene].en, ...others]), ans: SCENE_BY_KEY[it.scene].en };
    }).filter(Boolean);
    if(!Listen.qs.length){ toast("这些句子还出不了题，换个场景试试"); return; }
    Listen.i = 0; Listen.results = []; Listen.state = "q";
    this.renderQ();
  },
  renderQ(){
    const q = Listen.qs[Listen.i];
    if(!q){ this.finish(); return; }
    Listen.answered = false; Listen.t0 = 0;
    clearInterval(Listen.timer);
    const prompt = { reply: "对方这样说，你会怎么回？", detail: "你听到的是哪一句？注意小词", scene: "这句话最可能在哪里听到？" }[q.type];
    $("#v-listen").innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="ls-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${Listen.i + 1} / ${Listen.qs.length}</span>
      </div>
      <div class="progress" style="margin-top:14px">${Listen.qs.map((_, k) => `<i class="${k < Listen.results.length ? (Listen.results[k].ok ? "ok" : "no") : k === Listen.i ? "cur" : ""}"></i>`).join("")}</div>
      <p style="text-align:center;font-weight:700">${prompt}</p>
      <button class="play" id="ls-play" style="--c:var(--orange)" aria-label="播放">${ICON.play}</button>
      <div class="timer"><i id="ls-timer"></i></div>
      <div class="opts${q.type === "detail" ? " detail" : ""}" id="ls-opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div>
      <div id="ls-fb" style="margin-top:16px"></div>`;
    $("#ls-quit").onclick = () => { clearInterval(Listen.timer); Speech.stop(); this.renderSetup(); };
    const play = $("#ls-play");
    play.onclick = () => playWith(play, q.it.en);
    $$("#ls-opts .opt").forEach(b => b.onclick = () => this.answer(+b.dataset.k));
    (async () => {
      await sleep(300);
      const ok = await playWith(play, q.it.en);
      if(ok && !Listen.answered && Listen.state === "q" && Listen.qs[Listen.i] === q) this.startTimer();
    })();
  },
  startTimer(){
    const total = Settings.get("reactSec") * 1000 * (Listen.qs[Listen.i].type === "detail" ? 1.4 : 1), bar = $("#ls-timer");
    Listen.t0 = performance.now();
    clearInterval(Listen.timer);
    Listen.timer = setInterval(() => {
      const p = (performance.now() - Listen.t0) / total;
      if(bar) bar.style.transform = `scaleX(${Math.max(0, 1 - p)})`;
      if(p >= 1){ clearInterval(Listen.timer); if(!Listen.answered) this.answer(-1); }
    }, 50);
  },
  answer(k){
    if(Listen.answered) return;
    Listen.answered = true;
    clearInterval(Listen.timer);
    const q = Listen.qs[Listen.i];
    const rt = Listen.t0 ? (performance.now() - Listen.t0) / 1000 : 0;
    const ok = k >= 0 && q.opts[k] === q.ans;
    Listen.results.push({ ok, rt: k >= 0 ? rt : null, id: q.it.id });
    if(!ok) SRS.schedule(q.it.id, Date.now());
    $$("#ls-opts .opt").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.ans) b.classList.add("ok"); else if(j === k) b.classList.add("no"); });
    const head = k < 0 ? `<b class="no">超时了</b>，听到就要马上反应` : ok ? `<b class="ok">对</b>${Listen.t0 ? `，用时 ${rt.toFixed(1)} 秒` : ""}` : `<b class="no">不对</b>，这句已加入复习`;
    let diff = "";
    if(q.type === "detail" && k >= 0 && !ok){
      const a = q.ans.split(" "), b = q.opts[k].split(" "); const i = a.findIndex((w, j) => w !== b[j]);
      if(i >= 0) diff = `<p class="small" style="margin-top:6px">原句是 <b class="ok">${esc(a[i])}</b>，你选的是 <b class="no">${esc(b[i])}</b>。连读时这种小词最容易被吞掉，多听几遍慢速。</p>`;
    }
    $("#ls-fb").innerHTML = `
      <p>${head}</p>${diff}
      <div class="panel" style="margin-top:10px">
        <div class="en" style="font-size:20px">${renderEn(q.it.chunks)}</div>
        <p class="zh blur" id="ls-zh" style="margin-top:4px">${esc(q.it.zh)}</p>
        ${q.type !== "reply" && q.it.reply ? `<p class="small muted" style="margin-top:8px">对方可能回：<b style="color:var(--ink)">${esc(q.it.reply)}</b></p>` : ""}
        <div class="row" style="margin-top:12px;gap:8px">
          <button class="chip" id="ls-again">再听</button><button class="chip" id="ls-slow">慢速</button>
          <button class="chip" id="ls-save">加入复习</button>
        </div>
      </div>
      <button class="btn block" style="margin-top:14px;padding:14px" id="ls-next">${Listen.i + 1 < Listen.qs.length ? "下一题" : "看结果"}</button>`;
    const play = $("#ls-play");
    $("#ls-zh").onclick = e => e.currentTarget.classList.toggle("show");
    $("#ls-again").onclick = () => playWith(play, q.it.en);
    $("#ls-slow").onclick = () => playWith(play, q.it.en, Math.max(0.5, Settings.get("speed") - 0.3));
    $("#ls-save").onclick = e => { SRS.schedule(q.it.id, Date.now()); Review.queue = null; e.currentTarget.textContent = "已加入"; e.currentTarget.disabled = true; };
    if(!ok){ const s = $("#ls-save"); s.textContent = "已加入"; s.disabled = true; Review.queue = null; }
    $("#ls-next").onclick = () => { Speech.stop(); Listen.i++; this.renderQ(); };
  },
  finish(){
    Listen.state = "done";
    Log.add("listen");
    this.renderDone();
  },
  renderDone(){
    const r = Listen.results, okN = r.filter(x => x.ok).length;
    const rts = r.filter(x => x.ok && x.rt).map(x => x.rt);
    const avg = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    $("#v-listen").innerHTML = `
      <h1>这组完成了</h1>
      <div class="scores" style="margin:20px 0">
        <div class="stat"><b class="${okN >= r.length * 0.8 ? "ok" : okN >= r.length * 0.6 ? "mid" : "no"}">${okN}/${r.length}</b><span>答对</span></div>
        <div class="stat"><b>${avg ? avg.toFixed(1) + "s" : "—"}</b><span>平均反应</span></div>
        <div class="stat"><b>${r.length - okN}</b><span>加入复习</span></div>
      </div>
      <p class="muted">${okN === r.length ? (avg && avg < 3 ? "又快又准。下一组试试「挑战 5 秒」，或者把语速调快。" : "全对了！下一组试着更快作答。") : "答错的句子已经放进复习，明天会再遇到它们。"}</p>
      <div class="stack" style="margin-top:22px">
        <button class="btn line block" style="--c:var(--orange);padding:14px" id="ls-more">再来一组</button>
        <button class="btn ghost block" id="ls-setup">换个场景</button>
      </div>`;
    $("#ls-more").onclick = () => this.start();
    $("#ls-setup").onclick = () => this.renderSetup();
  },

  /* ---------- 随身听 ---------- */
  async startHF(){
    const list = shuffle(listenPool(Listen.scene));
    if(!list.length){ toast("这里还没有句子"); return; }
    Object.assign(Listen.hf, { list, i: 0, playing: true });
    Listen.state = "hf";
    try{ if(navigator.wakeLock) Listen.hf.lock = await navigator.wakeLock.request("screen"); }catch(_){}
    this.renderHF();
    this.loopHF();
  },
  stopHF(){
    Listen.hf.playing = false; Listen.hf.token++; Speech.stop();
    try{ Listen.hf.lock && Listen.hf.lock.release(); }catch(_){}
    Listen.hf.lock = null;
  },
  renderHF(){
    const h = Listen.hf, it = h.list[h.i];
    if(!it){ this.renderSetup(); return; }
    $("#v-listen").innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="hf-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${esc(poolLabel(Listen.scene))}，${h.i + 1} / ${h.list.length}</span>
      </div>
      <div class="hf-stage">
        <div class="row" style="justify-content:center">${bulletHTML(it.scene, true)}</div>
        <div class="en hf-en${h.showText ? "" : " blur"}" id="hf-en">${renderEn(it.chunks)}</div>
        <p class="zh blur" id="hf-zh">${esc(it.zh || "")}</p>
        ${h.reply && it.reply ? `<p class="hf-reply${h.showText ? "" : " blur"}">${esc(it.reply)}</p>` : ""}
      </div>
      <div class="row" style="justify-content:center;gap:18px">
        <button class="icon-btn" id="hf-prev" aria-label="上一句"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
        <button class="play" id="hf-toggle" style="--c:var(--orange);margin:0" aria-label="${h.playing ? "暂停" : "播放"}">${h.playing ? '<svg viewBox="0 0 24 24" fill="currentColor" style="margin:0"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : ICON.play}</button>
        <button class="icon-btn" id="hf-next" aria-label="下一句"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>
      </div>
      <div class="chips" style="justify-content:center;margin-top:20px;flex-wrap:wrap">
        ${[1, 2, 3].map(n => `<button class="chip${h.reps === n ? " on" : ""}" data-reps="${n}">每句 ${n} 遍</button>`).join("")}
      </div>
      <div class="chips" style="justify-content:center;margin-top:8px;flex-wrap:wrap">
        <button class="chip${h.reply ? " on" : ""}" id="hf-reply">带上回应</button>
        <button class="chip${h.showText ? " on" : ""}" id="hf-text">显示英文</button>
      </div>
      <p class="small muted" style="text-align:center;margin-top:16px">锁屏后浏览器可能会停止朗读，听的时候保持屏幕亮着。</p>`;
    $("#hf-quit").onclick = () => { this.stopHF(); this.renderSetup(); };
    $("#hf-toggle").onclick = () => { if(h.playing){ this.stopHF(); this.renderHF(); } else { h.playing = true; this.renderHF(); this.loopHF(); } };
    $("#hf-prev").onclick = () => this.jumpHF(-1);
    $("#hf-next").onclick = () => this.jumpHF(1);
    $$("[data-reps]").forEach(b => b.onclick = () => { h.reps = +b.dataset.reps; $$("[data-reps]").forEach(x => x.classList.toggle("on", x === b)); });
    $("#hf-reply").onclick = () => { h.reply = !h.reply; this.renderHF(); };
    $("#hf-text").onclick = () => { h.showText = !h.showText; this.renderHF(); };
    $("#hf-zh").onclick = e => e.currentTarget.classList.toggle("show");
    $("#hf-en").onclick = e => e.currentTarget.classList.remove("blur");
  },
  jumpHF(d){
    const h = Listen.hf; const was = h.playing;
    this.stopHF();
    h.i = (h.i + d + h.list.length) % h.list.length;
    h.playing = was; this.renderHF();
    if(was) this.loopHF();
  },
  async loopHF(){
    const h = Listen.hf, my = ++h.token;
    const alive = () => my === h.token && h.playing && Listen.state === "hf" && location.hash === "#listen";
    while(alive()){
      const it = h.list[h.i];
      for(let r = 0; r < h.reps; r++){
        const btn = $("#hf-toggle");
        if(!(await playWith(null, it.en)) || !alive()) return;
        await sleep(900); if(!alive()) return;
      }
      if(h.reply && it.reply){
        if(!(await Speech.say(it.reply, null, true)) || !alive()) return;
        await sleep(900); if(!alive()) return;
      }
      await sleep(900); if(!alive()) return;
      h.i = (h.i + 1) % h.list.length;
      if(h.i === 0) Log.add("listen");
      this.renderHF();
    }
  }
};

/* ================= 口语 ================= */
const Speak = { topic: null, custom: null, turns: [], busy: false };
const COACH_SYSTEM = `You are a friendly American English speaking coach for a native Chinese speaker.
You receive JSON with: "scenario" (Chinese description of the situation the learner is role-playing), "partner" (who the learner is talking to), "conversation" (earlier turns: "me" = the learner's lines already corrected, "them" = the partner's lines), and "learner_said" (what the learner just said; it may come from speech recognition, contain recognition errors, be partly or fully in Chinese, or be awkward/Chinglish).
Do this:
1. Work out what the learner meant.
2. Rewrite it as what an American would naturally say out loud in this exact situation: everyday spoken American English with contractions, common chunks and phrasal verbs, and the right level of politeness. Keep their meaning; only add small natural touches.
3. Give a more casual variant (how you'd say it to a friend); if the context is already casual, give a different natural phrasing.
4. Explain the most useful changes in Simplified Chinese. Focus on why the new version sounds natural (word choice, set phrases, tone), not grammar jargon. Skip trivial edits. If the learner used Chinese, quote that Chinese in "from".
5. Continue the role-play: write the partner's next line (1–2 short, natural sentences) so the learner can reply.
Reply with ONLY a JSON object, no markdown fences:
{"natural": string, "casual": string, "score": integer 1-5 (how natural the learner's original was), "feedback": string (1-2 sentences in Simplified Chinese, honest and encouraging), "changes": [{"from": string, "to": string, "why": string}] (max 4), "chunks": [{"en": string, "zh": string}] (max 3 reusable phrases from the natural version), "reply": string, "reply_zh": string}`;

function currentTopic(){ return Speak.custom || TOPICS[Speak.topic]; }

async function callCoach(said){
  const t = currentTopic();
  const payload = {
    scenario: t.brief, partner: t.them || "the other person",
    conversation: Speak.turns.map(x => ({ who: x.who, text: x.who === "me" ? x.natural : x.text })),
    learner_said: said
  };
  let resp;
  try{
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": Settings.get("apiKey"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: Settings.get("model"), max_tokens: 1500, system: COACH_SYSTEM, messages: [{ role: "user", content: JSON.stringify(payload) }] })
    });
  }catch(e){ throw new Error("连不上 Anthropic 的服务器。检查一下网络（在中国大陆需要能访问外网）。"); }
  if(!resp.ok){
    let msg = ""; try{ msg = (await resp.json()).error.message; }catch(_){}
    if(resp.status === 401) throw new Error("API 密钥不对。去「我的」里检查一下。");
    if(resp.status === 429 || resp.status === 529) throw new Error("服务繁忙或额度用完了，过一会儿再试。");
    if(resp.status === 400 && /credit/i.test(msg)) throw new Error("API 账户余额不足，需要先充值。");
    throw new Error(`请求失败（${resp.status}）${msg ? "：" + msg : ""}`);
  }
  const data = await resp.json();
  const text = (data.content || []).map(c => c.text || "").join("");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  try{ return JSON.parse(text.slice(a, b + 1)); }catch(_){ throw new Error("返回的内容没法解析，再试一次。"); }
}

function coachPrompt(said){
  const t = currentTopic();
  const hist = Speak.turns.map(x => x.who === "me" ? `我：${x.natural}` : `对方：${x.text}`).join("\n");
  return `我在练美式英语口语，请当我的口语教练。\n场景：${t.brief}\n${hist ? "之前的对话：\n" + hist + "\n" : ""}我刚才说的是：「${said}」\n\n请：\n1. 改成美国人在这个场景里会自然说出口的地道口语；\n2. 再给一个更随意的说法；\n3. 用中文解释最关键的几处改动，为什么这样更地道；\n4. 扮演对方，用一两句话自然地回应我，让我接着练。`;
}

Views.speak = {
  show(){ if(Speak.topic !== null || Speak.custom) this.renderSession(); else this.renderList(); },
  renderList(){
    const td = topicOfDay(), t = TOPICS[td];
    $("#v-speak").innerHTML = `
      <h1>口语</h1>
      <p class="muted" style="margin:8px 0 18px">选一个场景，用英语说出来。说不出来的地方可以夹中文，AI 会帮你改成美国人日常的说法，再陪你接着聊下去。</p>
      <button class="today-topic" data-t="${td}">
        <div class="k">今日话题</div><div class="t">${esc(t.title)}</div><div class="d">${esc(t.brief)}</div>
      </button>
      <h3>自己出题</h3>
      <div class="row"><input type="text" id="sp-custom" placeholder="比如：跟邻居说他家狗太吵了" aria-label="自定义场景"><button class="btn sm" id="sp-custom-go">开始</button></div>
      <h3>全部话题</h3>
      <div class="panel" style="padding:4px 16px">
        ${TOPICS.map((x, k) => `<button class="topic" data-t="${k}">${bulletHTML(x.scene)}<div class="grow"><div class="t">${esc(x.title)}</div><div class="d">${esc(x.brief)}</div></div></button>`).join("")}
      </div>`;
    $$("#v-speak [data-t]").forEach(b => b.onclick = () => this.open(+b.dataset.t));
    $("#sp-custom-go").onclick = () => {
      const s = $("#sp-custom").value.trim(); if(!s){ $("#sp-custom").focus(); return; }
      Speak.custom = { scene: null, title: "自定义场景", them: "the other person", brief: s, hints: [] };
      Speak.topic = null; Speak.turns = []; this.renderSession();
    };
  },
  open(k){ Speak.topic = k; Speak.custom = null; Speak.turns = []; this.renderSession(); window.scrollTo(0, 0); },
  renderSession(){
    const t = currentTopic();
    const hasKey = !!Settings.get("apiKey");
    $("#v-speak").innerHTML = `
      <div class="row" style="margin-bottom:14px"><button class="icon-btn" id="sp-back" aria-label="返回话题">${ICON.back}</button>${bulletHTML(t.scene)}<h2 style="margin:0">${esc(t.title)}</h2></div>
      <p class="brief">${esc(t.brief)}</p>
      ${t.hints && t.hints.length ? `<div class="chips" style="margin-top:12px">${t.hints.map(h => `<button class="chip" data-say="${esc(h)}">${esc(h)}</button>`).join("")}</div>` : ""}
      <div class="thread" id="sp-thread"></div>
      <div class="composer">
        <div class="row" style="align-items:flex-end">
          <textarea id="sp-input" rows="2" placeholder="${Speak.turns.length ? "接着回应对方…" : "你先开口，用英语说出来…"}"></textarea>
          <button class="mic" id="sp-mic" aria-label="语音输入">${ICON.mic}</button>
        </div>
        <button class="btn line block" style="--c:var(--green);margin-top:10px;padding:13px" id="sp-send">${hasKey ? "改成地道说法" : "复制，去 Claude 批改"}</button>
        ${hasKey ? "" : `<p class="small muted" style="margin-top:8px">在「我的」里填上 Anthropic API 密钥，就能直接在这里批改，并且接着对话。</p>`}
        <p class="err" id="sp-err" hidden></p>
      </div>`;
    $("#sp-back").onclick = () => { stopActiveListen(); Speak.topic = null; Speak.custom = null; Speak.turns = []; this.renderList(); };
    $$("#v-speak [data-say]").forEach(b => b.onclick = () => Speech.say(b.dataset.say));
    $("#sp-mic").onclick = () => this.toggleMic();
    $("#sp-send").onclick = () => this.send();
    this.renderThread();
  },
  renderThread(){
    const th = $("#sp-thread");
    th.innerHTML = Speak.turns.map((x, k) => {
      if(x.who === "them") return `
        <div class="bub them">
          <div class="who">${esc(currentTopic().them || "对方")}</div>
          <div class="row" style="align-items:flex-start"><button class="play sm" data-play="${k}" style="--c:var(--ink)" aria-label="播放">${ICON.play}</button>
          <div class="grow"><div class="say">${esc(x.text)}</div>${x.zh ? `<div class="zh blur small" data-blur>${esc(x.zh)}</div>` : ""}</div></div>
        </div>`;
      if(x.who === "pending") return `<div class="bub me"><div class="who">正在改写<span class="dots"></span></div><div class="orig" style="text-decoration:none">${esc(x.said)}</div></div>`;
      const r = x.r;
      return `
        <div class="bub me">
          <div class="who">你说的</div>
          <div class="orig">${esc(x.said)}</div>
          <div class="who" style="margin-top:10px">地道说法</div>
          <div class="row" style="align-items:flex-start"><button class="play sm" data-play="${k}" style="--c:var(--green)" aria-label="播放">${ICON.play}</button><div class="say grow">${esc(r.natural)}</div></div>
          ${r.casual ? `<div class="who" style="margin-top:10px">更随意一点</div><div class="row" style="align-items:flex-start"><button class="play sm" data-play-casual="${k}" style="--c:var(--ink)" aria-label="播放">${ICON.play}</button><div class="grow" style="font-weight:600">${esc(r.casual)}</div></div>` : ""}
          ${r.feedback ? `<p class="small" style="margin-top:10px">${"●".repeat(Math.max(0, Math.min(5, r.score || 0)))}<span class="muted">${"●".repeat(5 - Math.max(0, Math.min(5, r.score || 0)))}</span> ${esc(r.feedback)}</p>` : ""}
          ${(r.changes || []).length ? `<div style="margin-top:8px">${r.changes.map(c => `<div class="change"><div class="ft"><s>${esc(c.from)}</s> → <b>${esc(c.to)}</b></div><div class="small muted">${esc(c.why)}</div></div>`).join("")}</div>` : ""}
          <div class="row wrap" style="margin-top:10px;gap:8px">
            <button class="chip" data-save="${k}">${x.saved ? "已加入复习" : "整句加入复习"}</button>
            ${(r.chunks || []).map((c, j) => `<button class="chip" data-chunk="${k}-${j}" title="${esc(c.zh)}">+ ${esc(c.en)}</button>`).join("")}
          </div>
        </div>`;
    }).join("");
    $$("[data-play]", th).forEach(b => b.onclick = () => { const x = Speak.turns[+b.dataset.play]; playWith(b, x.who === "me" ? x.r.natural : x.text); });
    $$("[data-play-casual]", th).forEach(b => b.onclick = () => playWith(b, Speak.turns[+b.dataset.playCasual].r.casual));
    $$("[data-blur]", th).forEach(b => b.onclick = () => b.classList.toggle("show"));
    $$("[data-save]", th).forEach(b => b.onclick = () => {
      const x = Speak.turns[+b.dataset.save]; Cards.addUser(x.r.natural, x.saidZh || "", currentTopic().title); x.saved = true;
      b.textContent = "已加入复习"; toast("已加入复习，今天就能复习到");
    });
    $$("[data-chunk]", th).forEach(b => b.onclick = () => {
      const [k, j] = b.dataset.chunk.split("-").map(Number); const c = Speak.turns[k].r.chunks[j];
      Cards.addUser(c.en, c.zh, currentTopic().title); b.disabled = true; b.textContent = "✓ " + c.en; toast("短语已加入复习");
    });
  },
  async toggleMic(){
    const mic = $("#sp-mic"), input = $("#sp-input");
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    const base = input.value.trim();
    mic.classList.add("on"); mic.innerHTML = ICON.stop;
    activeListen = startListening({ onText: t => input.value = (base ? base + " " : "") + t });
    const r = await activeListen.done; activeListen = null;
    mic.classList.remove("on"); mic.innerHTML = ICON.mic;
    if(!r.text && r.error && r.error !== "aborted") { toast(srErrorText(r.error)); }
  },
  async send(){
    stopActiveListen();
    const input = $("#sp-input"), said = input.value.trim(), err = $("#sp-err");
    err.hidden = true;
    if(!said){ input.focus(); toast("先说一句或打一句"); return; }
    if(!Settings.get("apiKey")){
      const text = coachPrompt(said);
      try{ await navigator.clipboard.writeText(text); toast("已复制，打开 Claude 粘贴就行"); }
      catch(_){ err.hidden = false; err.style.color = "var(--muted)"; err.innerHTML = `复制失败，请手动复制：<textarea style="margin-top:6px" rows="6">${esc(text)}</textarea>`; }
      Log.add("speak");
      return;
    }
    if(Speak.busy) return;
    Speak.busy = true;
    const btn = $("#sp-send"); btn.disabled = true;
    Speak.turns.push({ who: "pending", said });
    this.renderThread(); input.value = "";
    try{
      const r = await callCoach(said);
      Speak.turns.pop();
      Speak.turns.push({ who: "me", said, r, natural: r.natural });
      if(r.reply) Speak.turns.push({ who: "them", text: r.reply, zh: r.reply_zh });
      Log.add("speak");
      this.renderThread();
      const bubs = $$("#sp-thread .bub"); bubs[bubs.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
      await playWith($(`[data-play="${Speak.turns.length - (r.reply ? 2 : 1)}"]`), r.natural);
      if(r.reply && location.hash === "#speak"){ await sleep(400); await playWith($(`[data-play="${Speak.turns.length - 1}"]`), r.reply); }
    }catch(e){
      Speak.turns.pop(); this.renderThread();
      input.value = said; err.hidden = false; err.style.color = ""; err.textContent = e.message;
    }finally{
      Speak.busy = false; const b = $("#sp-send"); if(b) b.disabled = false;
      const inp = $("#sp-input"); if(inp) inp.placeholder = "接着回应对方…";
    }
  }
};

/* ---------- 口语：话题列表 + 开口反应 ---------- */
Object.assign(Speak, { cat: "all", reflex: null });

Object.assign(Views.speak, {
  show(){
    if(Speak.reflex) this.renderReflex();
    else if(Speak.topic !== null || Speak.custom) this.renderSession();
    else this.renderList();
  },
  renderList(){
    const td = topicOfDay(), t = TOPICS[td];
    const list = TOPICS.map((x, k) => [x, k]).filter(([x]) => Speak.cat === "all" || x.cat === Speak.cat);
    $("#v-speak").innerHTML = `
      <h1>口语</h1>
      <p class="muted" style="margin:8px 0 18px">选一个场景，用英语说出来。说不出来的地方可以夹中文，AI 会改成美国人日常的说法，再陪你接着聊下去。</p>
      <button class="today-topic" data-t="${td}">
        <div class="k">今日话题</div><div class="t">${esc(t.title)}</div><div class="d">${esc(t.brief)}</div>
      </button>
      <button class="hf-card" id="sp-reflex" style="margin-top:12px">
        <div class="grow"><div class="t">开口反应</div><div class="small muted">听对方说一句，马上用英语回。练的是不经过中文、张口就来。</div></div>
        <span class="mic" style="--c:var(--green);width:44px;height:44px">${ICON.mic}</span>
      </button>
      <h3>自己出题</h3>
      <div class="row"><input type="text" id="sp-custom" placeholder="比如：跟邻居说他家狗太吵了" aria-label="自定义场景"><button class="btn sm" id="sp-custom-go">开始</button></div>
      <h3>全部话题 <span class="small muted">${TOPICS.length} 个</span></h3>
      <div class="chips" id="sp-cats">
        <button class="chip${Speak.cat === "all" ? " on" : ""}" data-c="all">全部</button>
        ${CATS.map(c => `<button class="chip${Speak.cat === c.key ? " on" : ""}" data-c="${c.key}">${esc(c.name)}</button>`).join("")}
      </div>
      <div class="panel" style="padding:4px 16px;margin-top:10px">
        ${list.map(([x, k]) => `<button class="topic" data-t="${k}">${bulletHTML(x.scene)}<div class="grow"><div class="t">${esc(x.title)}</div><div class="d">${esc(x.brief)}</div></div></button>`).join("")}
      </div>`;
    $$("#v-speak [data-t]").forEach(b => b.onclick = () => this.open(+b.dataset.t));
    $$("#sp-cats .chip").forEach(b => b.onclick = () => { Speak.cat = b.dataset.c; this.renderList(); });
    $("#sp-reflex").onclick = () => this.startReflex();
    $("#sp-custom-go").onclick = () => {
      const s = $("#sp-custom").value.trim(); if(!s){ $("#sp-custom").focus(); return; }
      Speak.custom = { scene: null, title: "自定义场景", them: "the other person", brief: s, hints: [] };
      Speak.topic = null; Speak.turns = []; this.renderSession();
    };
  },
  open(k){
    Speak.topic = k; Speak.custom = null; Speak.reflex = null;
    const t = TOPICS[k];
    Speak.turns = t.opener ? [{ who: "them", text: t.opener, zh: t.opener_zh }] : [];
    this.renderSession(); window.scrollTo(0, 0);
    if(t.opener) setTimeout(() => { const b = $('[data-play="0"]'); if(b && location.hash === "#speak") playWith(b, t.opener, null, true); }, 350);
  },

  /* 开口反应 */
  startReflex(){
    const pool = Speak.cat === "all" ? ALL_ITEMS : ALL_ITEMS.filter(x => (CATS.find(c => c.key === Speak.cat) || { scenes: [] }).scenes.includes(x.scene));
    Speak.reflex = { items: shuffle(pool).slice(0, 8), i: 0, said: "", t0: 0, rt: null, results: [], phase: "listen" };
    Speak.topic = null; Speak.custom = null;
    this.renderReflex();
  },
  renderReflex(){
    const R = Speak.reflex, it = R.items[R.i];
    stopActiveListen();
    if(!it){
      const ok = R.results.filter(x => x).length;
      Log.add("speak");
      $("#v-speak").innerHTML = `
        <h1>开口反应完成</h1>
        <p class="muted" style="margin:10px 0 20px">${R.items.length} 句里，你张口就回上了 ${ok} 句。卡住的句子已经加入复习。</p>
        <div class="stack">
          <button class="btn line block" style="--c:var(--green);padding:14px" id="rf-more">再来一组</button>
          <button class="btn ghost block" id="rf-back">回到话题</button>
        </div>`;
      $("#rf-more").onclick = () => this.startReflex();
      $("#rf-back").onclick = () => { Speak.reflex = null; this.renderList(); };
      return;
    }
    R.said = ""; R.rt = null; R.phase = "listen";
    const sc = SCENE_BY_KEY[it.scene];
    $("#v-speak").innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="rf-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${R.i + 1} / ${R.items.length}</span>
      </div>
      <div class="progress" style="margin-top:14px">${R.items.map((_, k) => `<i class="${k < R.results.length ? (R.results[k] ? "ok" : "no") : k === R.i ? "cur" : ""}"></i>`).join("")}</div>
      <div class="row" style="justify-content:center;gap:8px">${bulletHTML(it.scene)}<span class="small muted">${esc(sc.name)}</span></div>
      <p style="text-align:center;font-weight:700;margin-top:10px">对方说了一句，用英语回应他</p>
      <button class="play" id="rf-play" style="--c:var(--ink)" aria-label="播放">${ICON.play}</button>
      <div class="row" style="justify-content:center;gap:8px"><button class="chip" id="rf-again">再听一遍</button><button class="chip" id="rf-show">看原句</button></div>
      <p class="en" id="rf-line" hidden style="font-size:19px;text-align:center;margin-top:10px">${renderEn(it.chunks)}</p>
      <div class="row" style="justify-content:center;margin-top:20px"><button class="mic lg" id="rf-mic" aria-label="开始回答">${ICON.mic}</button></div>
      <p id="rf-said" style="text-align:center;font-weight:600;min-height:24px;margin-top:10px"></p>
      <p class="small muted" style="text-align:center" id="rf-tip">听完点麦克风，直接说。不用完美，先开口。</p>
      <div id="rf-res"></div>`;
    $("#rf-quit").onclick = () => { stopActiveListen(); Speak.reflex = null; this.renderList(); };
    const play = $("#rf-play");
    const go = async () => { const ok = await playWith(play, it.en, null, true); if(ok && Speak.reflex === R && R.phase === "listen") R.t0 = performance.now(); };
    play.onclick = go; $("#rf-again").onclick = go;
    $("#rf-show").onclick = e => { $("#rf-line").hidden = false; e.currentTarget.remove(); };
    $("#rf-mic").onclick = () => this.reflexMic();
    setTimeout(() => { if(location.hash === "#speak" && Speak.reflex === R && R.phase === "listen") go(); }, 300);
  },
  async reflexMic(){
    const R = Speak.reflex, it = R.items[R.i], mic = $("#rf-mic"), out = $("#rf-said");
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    R.phase = "speak";
    if(R.t0 && R.rt === null) R.rt = (performance.now() - R.t0) / 1000;
    mic.classList.add("on"); mic.innerHTML = ICON.stop;
    out.textContent = "请说…"; $("#rf-tip").textContent = "说完再点一下";
    activeListen = startListening({ onText: t => out.textContent = t });
    const r = await activeListen.done; activeListen = null;
    if(Speak.reflex !== R || !$("#rf-mic")) return;
    mic.classList.remove("on"); mic.innerHTML = ICON.mic;
    R.said = r.text || "";
    out.textContent = r.text ? "“" + r.text + "”" : srErrorText(r.error);
    this.showReflexAnswer();
  },
  showReflexAnswer(){
    const R = Speak.reflex, it = R.items[R.i];
    $("#rf-tip").hidden = true;
    const hasKey = !!Settings.get("apiKey");
    $("#rf-res").innerHTML = `
      <div class="panel" style="margin-top:14px">
        <div class="small muted">参考回答${R.rt !== null ? `，你的反应时间 ${R.rt.toFixed(1)} 秒` : ""}</div>
        <div class="row" style="align-items:flex-start;margin-top:6px"><button class="play sm" id="rf-ans" style="--c:var(--green)" aria-label="播放">${ICON.play}</button><div class="say grow" style="font-weight:700;font-size:18px">${esc(it.reply)}</div></div>
        <p class="small muted" style="margin-top:8px">对方说的是：${esc(it.en)}（${esc(it.zh)}）</p>
        ${R.said && hasKey ? `<button class="link" id="rf-ai" style="margin-top:10px">让 AI 把我的回答改得更地道</button>` : ""}
      </div>
      <div class="grades" style="grid-template-columns:1fr 1fr;margin-top:12px">
        <button class="grade g0" data-r="0"><b>卡住了</b><span>加入复习</span></button>
        <button class="grade g3" data-r="1"><b>说出来了</b><span>下一句</span></button>
      </div>`;
    $("#rf-ans").onclick = e => playWith(e.currentTarget, it.reply);
    playWith($("#rf-ans"), it.reply);
    $$("#rf-res [data-r]").forEach(b => b.onclick = () => {
      const ok = b.dataset.r === "1";
      if(!ok){ SRS.schedule(it.id, Date.now()); Review.queue = null; }
      R.results.push(ok); R.i++; this.renderReflex();
    });
    const ai = $("#rf-ai");
    if(ai) ai.onclick = () => {
      const said = R.said;
      Speak.reflex = null; Speak.topic = null;
      Speak.custom = { scene: it.scene, title: "开口反应", them: "the other person", brief: `对方对你说：“${it.en}”（${it.zh}）。你自然地回应。`, hints: [] };
      Speak.turns = [{ who: "them", text: it.en, zh: it.zh }];
      this.renderSession();
      $("#sp-input").value = said;
      this.send();
    };
  }
});

/* ================= 连读 ================= */
const Link = { tokens: [], links: [], text: LINK_PRESETS[0], recorder: null, stream: null, chunks: [], recDone: null, recogDone: null, recording: false, recTimer: null };
Views.link = {
  show(){
    $("#v-link").innerHTML = `
      <h1>连读跟读</h1>
      <p class="muted" style="margin:8px 0 16px">自动标出连读点，听美音示范，录下你读的，检查哪里没连上、哪里断开了。</p>
      <div class="chips" id="lk-presets"><button class="chip" id="lk-rand">从句库随机一句</button>${LINK_PRESETS.map((p, i) => `<button class="chip${p === Link.text ? " on" : ""}" data-i="${i}">${esc(p)}</button>`).join("")}</div>
      <textarea id="lk-input" rows="2" spellcheck="false" style="margin-top:10px;min-height:60px" aria-label="练习句子">${esc(Link.text)}</textarea>
      <div class="panel" style="margin-top:14px">
        <div class="lk-sent" id="lk-display"></div>
        <div class="lk-legend" style="margin:6px 0 10px"><span class="c-cv">辅元连读</span><span class="c-vv">元音过渡</span><span class="c-as">音的同化</span><span class="c-lp">失去爆破或合并</span><span class="c-hd">h 弱读</span></div>
        <ul class="links" id="lk-list"></ul>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="speed"><span class="small muted">速度</span><input type="range" id="lk-speed" min="0.5" max="1.5" step="0.05" value="${Settings.get("speed")}" aria-label="速度"><b id="lk-speed-v">${Settings.get("speed").toFixed(2)}×</b></div>
        <div class="row wrap" style="margin-top:14px;gap:8px">
          <button class="btn line" style="--c:var(--purple)" id="lk-model">${ICON.play}<span>美音示范</span></button>
          <button class="btn ghost" id="lk-both" disabled>示范后接我的</button>
        </div>
        <div class="row wrap" style="margin-top:12px;gap:8px">
          <button class="btn" id="lk-rec">${ICON.mic}<span>开始录音</span></button>
          <button class="btn ghost" id="lk-mine" disabled>${ICON.play}<span>我的录音</span></button>
          <label class="btn ghost upload">上传录音<input type="file" accept="audio/*,video/*" id="lk-file"></label>
        </div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="lk-keep" ${Settings.get("keepAudio") ? "checked" : ""}> 同时保存录音，用来回放和分析停顿。安卓上如果识别总失败，可以关掉试试。</label>
        <p class="small muted" id="lk-status" style="margin-top:8px">读完整句后点「停止」。</p>
        <p id="lk-live" style="font-weight:600;min-height:22px"></p>
        <audio id="lk-audio" hidden></audio>
      </div>
      <div id="lk-result" hidden style="margin-top:14px">
        <div class="scores">
          <div class="stat"><b id="lk-sAcc">—</b><span>发音准确度</span></div>
          <div class="stat"><b id="lk-sFlu">—</b><span>连贯度</span></div>
          <div class="stat"><b id="lk-sLink">—</b><span>连读点通过</span></div>
        </div>
        <h3>机器听到的</h3><p id="lk-heard"></p><p class="lk-sent" style="font-size:19px;line-height:1.8" id="lk-compare"></p>
        <h3>停顿 <span class="small muted" id="lk-rate"></span></h3>
        <canvas class="wave" id="lk-wave"></canvas>
        <p class="small muted" id="lk-pauses" style="margin-top:6px"></p>
        <h3>逐个连读点</h3><ul class="links panel" id="lk-check" style="padding:4px 16px"></ul>
        <h3>建议</h3><ul id="lk-tips" style="padding-left:20px;margin:0"></ul>
      </div>`;
    $("#lk-input").oninput = e => { Link.text = e.target.value; $$("#lk-presets .chip").forEach(c => c.classList.remove("on")); this.renderSentence(); };
    $("#lk-rand").onclick = () => { Link.text = shuffle(ALL_ITEMS)[0].en; $("#lk-input").value = Link.text; $$("#lk-presets .chip").forEach(c => c.classList.remove("on")); this.renderSentence(); };
    $$("#lk-presets .chip[data-i]").forEach(b => b.onclick = () => { Link.text = LINK_PRESETS[+b.dataset.i]; $("#lk-input").value = Link.text; $$("#lk-presets .chip").forEach(c => c.classList.toggle("on", c === b)); this.renderSentence(); });
    $("#lk-speed").oninput = e => { const v = +e.target.value; Settings.set("speed", v); $("#lk-speed-v").textContent = v.toFixed(2) + "×"; const a = $("#lk-audio"); if(a.src) a.playbackRate = v; };
    $("#lk-model").onclick = () => Speech.say(Link.text);
    $("#lk-both").onclick = async () => { await Speech.say(Link.text); await sleep(350); this.playMine(); };
    $("#lk-mine").onclick = () => this.playMine();
    $("#lk-rec").onclick = () => Link.recording ? this.stopRec() : this.startRec();
    $("#lk-keep").onchange = e => Settings.set("keepAudio", e.target.checked);
    $("#lk-file").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if(!f) return;
      if(!Link.tokens.length){ this.status("先输入你录音里读的那句英文。", true); return; }
      this.status("分析上传的录音…"); this.setAudio(f); $("#lk-live").textContent = "";
      await this.analyze(f, { unsupported: true }); e.target.value = "";
    };
    $("#lk-list").onclick = e => { const b = e.target.closest("[data-say]"); if(b){ const l = Link.links[+b.dataset.say]; Speech.say(`${l.a} ${l.b}`, Math.min(Settings.get("speed"), 0.8)); } };
    $("#lk-check").onclick = $("#lk-list").onclick;
    this.renderSentence();
  },
  status(msg, err){ const s = $("#lk-status"); if(!s) return; s.textContent = msg; s.className = "small " + (err ? "err" : "muted"); },
  renderSentence(){
    Link.tokens = tokenize(Link.text);
    Link.links = detectLinks(Link.tokens);
    const byI = new Map(Link.links.map(l => [l.i, l]));
    $("#lk-display").innerHTML = Link.tokens.map((t, i) => `<span class="w">${esc(t.raw)}</span>` + (i < Link.tokens.length - 1 ? (byI.get(i) ? `<span class="lk c-${byI.get(i).cls}">‿</span>` : " ") : "")).join("") || `<span class="muted">输入一句英文</span>`;
    $("#lk-list").innerHTML = Link.links.length ? Link.links.map((l, k) => `
      <li><div class="pair c-${l.cls}">${esc(l.a)}‿${esc(l.b)}</div>
      <div class="grow"><div class="kind c-${l.cls}">${esc(l.kind)}</div><div class="hint">读作 <b>${esc(l.hint)}</b>。${esc(l.note)}</div></div>
      <button class="play sm" data-say="${k}" style="--c:var(--purple)" aria-label="播放">${ICON.play}</button></li>`).join("") : `<li class="muted small">这句没有明显的连读点，换一句试试。</li>`;
    $("#lk-result").hidden = true;
  },
  setAudio(blob){
    const a = $("#lk-audio");
    if(a.dataset.url) URL.revokeObjectURL(a.dataset.url);
    a.src = URL.createObjectURL(blob); a.dataset.url = a.src;
    $("#lk-mine").disabled = false; $("#lk-both").disabled = false;
  },
  playMine(){
    const a = $("#lk-audio"); if(!a.src) return;
    a.playbackRate = Settings.get("speed");
    try{ a.preservesPitch = true; a.webkitPreservesPitch = true; }catch(_){}
    a.currentTime = 0; a.play().catch(() => {});
  },
  async startRec(){
    if(!Link.tokens.length){ this.status("先输入一句英文。", true); return; }
    const keep = $("#lk-keep").checked;
    Link.stream = null; Link.recorder = null; Link.chunks = [];
    if(keep){
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){ this.status("这里不能直接录音。请用 Safari 或 Chrome 打开，或者点「上传录音」。", true); return; }
      try{ Link.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch(e){ this.status("没法使用麦克风（" + (e.name || e.message) + "）。请在浏览器里允许麦克风，或者点「上传录音」。", true); return; }
    } else if(!SR){ this.status("这个浏览器不支持语音识别，请勾选「同时保存录音」。", true); return; }
    Speech.stop();
    if(Link.stream){
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m));
      Link.recorder = mime ? new MediaRecorder(Link.stream, { mimeType: mime }) : new MediaRecorder(Link.stream);
      Link.recorder.ondataavailable = e => { if(e.data && e.data.size) Link.chunks.push(e.data); };
      Link.recDone = new Promise(res => Link.recorder.onstop = res);
      Link.recorder.start();
    } else Link.recDone = Promise.resolve();
    activeListen = startListening({ target: Link.text, onText: t => { const l = $("#lk-live"); if(l) l.textContent = t; } });
    Link.recogDone = activeListen.done;
    Link.recording = true;
    const btn = $("#lk-rec"); btn.innerHTML = `${ICON.stop}<span>停止</span>`; btn.style.background = "var(--red)"; btn.style.color = "#fff";
    $("#lk-live").textContent = "";
    this.status("录音中… 读完整句后点「停止」。");
    const t0 = Date.now(); clearInterval(Link.recTimer);
    Link.recTimer = setInterval(() => { if(Date.now() - t0 > 30000) this.stopRec(); }, 300);
  },
  async stopRec(){
    if(!Link.recording) return;
    Link.recording = false; clearInterval(Link.recTimer);
    const btn = $("#lk-rec"); if(btn){ btn.innerHTML = `${ICON.mic}<span>开始录音</span>`; btn.style.background = ""; btn.style.color = ""; }
    this.status("分析中…");
    try{ Link.recorder && Link.recorder.state !== "inactive" && Link.recorder.stop(); }catch(_){}
    if(activeListen){ activeListen.stop(); }
    const timeout = new Promise(res => setTimeout(() => res({ text: "", error: "timeout" }), 3500));
    const [, rec] = await Promise.all([Link.recDone, Promise.race([Link.recogDone, timeout])]);
    activeListen = null;
    Link.stream && Link.stream.getTracks().forEach(t => t.stop());
    let blob = null;
    if(Link.recorder && Link.chunks.length){ blob = new Blob(Link.chunks, { type: Link.recorder.mimeType || "audio/webm" }); this.setAudio(blob); }
    await this.analyze(blob, rec);
    if(rec && rec.error === "audio-capture" && $("#lk-keep").checked) this.status("这台设备不能同时录音和识别。取消勾选「同时保存录音」再试，就能得到识别打分。", true);
  },
  async analyze(blob, rec){
    if(!$("#lk-result")) return;
    rec = rec || { unsupported: true };
    const tokens = Link.tokens, links = Link.links;
    let st = null;
    if(blob){ try{ st = audioStats(await decode(blob)); }catch(_){ st = null; } }
    const hasRecog = !!(rec.text && rec.text.trim());
    $("#lk-result").hidden = false;
    const tn = targetNorm(tokens), wordOk = tokens.map(() => true);
    let matchIdx = [], accuracy = null;
    if(hasRecog){
      matchIdx = align(tn.map(x => x.t), normalize(rec.text));
      tn.forEach((x, k) => { if(matchIdx[k] < 0) wordOk[x.wi] = false; });
      accuracy = Math.round(100 * matchIdx.filter(v => v >= 0).length / Math.max(1, tn.length));
      $("#lk-heard").textContent = "“" + rec.text + "”" + (rec.confidence ? `（置信度 ${Math.round(rec.confidence * 100)}%）` : "");
      $("#lk-compare").innerHTML = tokens.map((t, i) => `<span class="${wordOk[i] ? "m-ok" : "m-no"}">${esc(t.raw)}</span>`).join(" ");
    } else {
      $("#lk-heard").textContent = "没有识别结果：" + (rec.unsupported ? "上传模式只分析停顿。" : srErrorText(rec.error));
      $("#lk-compare").innerHTML = "";
    }
    const gapAt = new Map(); let extra = 0, rate = null;
    if(st && !st.empty){
      st.gaps.forEach(g => { const i = locateGap(g, st, tokens); g.at = i; g.punct = tokens[i] && tokens[i].punct; if(!g.punct){ extra++; gapAt.set(i, g); } });
      rate = tokens.reduce((a, t) => a + syllables(t.w), 0) / Math.max(0.3, st.speech);
      $("#lk-rate").textContent = `语速约 ${rate.toFixed(1)} 音节/秒，用时 ${st.span.toFixed(1)} 秒`;
      drawWave($("#lk-wave"), st);
      $("#lk-pauses").innerHTML = st.gaps.length ? st.gaps.map(g => `${g.punct ? "✓" : "✗"} 约 ${g.dur.toFixed(2)} 秒停顿，大约在 <b>${esc(tokens[g.at].raw)}</b> 和 <b>${esc(tokens[g.at + 1].raw)}</b> 之间${g.punct ? "（标点处，正常）" : ""}`).join("<br>") : "整句中间没有明显停顿。";
    } else {
      drawWave($("#lk-wave"), null); $("#lk-rate").textContent = "";
      $("#lk-pauses").textContent = !blob ? "没有保存录音，跳过停顿分析。" : st && st.empty ? "录音里几乎没有声音，检查一下麦克风。" : "这段录音无法解码，换成 m4a、mp3 或 wav 再试。";
    }
    let pass = 0;
    links.forEach(l => {
      const reasons = [];
      if(hasRecog){
        if(!wordOk[l.i] || !wordOk[l.i + 1]) reasons.push("这两个词没被听对");
        else { const ka = tn.map((x, k) => x.wi === l.i ? k : -1).filter(k => k >= 0).pop(); const kb = tn.findIndex(x => x.wi === l.i + 1); if(matchIdx[kb] - matchIdx[ka] > 1) reasons.push("中间多出了别的音"); }
      }
      const g = gapAt.get(l.i); if(g) reasons.push(`中间断开约 ${g.dur.toFixed(2)} 秒`);
      l.ok = !reasons.length; l.reasons = reasons; if(l.ok) pass++;
    });
    $("#lk-check").innerHTML = links.length ? links.map((l, k) => `<li><div class="pair ${l.ok ? "ok" : "no"}">${l.ok ? "✓" : "✗"} ${esc(l.a)}‿${esc(l.b)}</div><div class="grow hint">${l.ok ? "连上了" : esc(l.reasons.join("，"))}。读作 <b>${esc(l.hint)}</b></div><button class="play sm" data-say="${k}" style="--c:var(--purple)" aria-label="播放">${ICON.play}</button></li>`).join("") : `<li class="muted small">这句没有连读点。</li>`;
    const flu = st && !st.empty ? Math.max(0, 100 - extra * 20 - (rate < 2.2 ? 20 : rate < 3 ? 8 : 0)) : null;
    const tile = (id, v) => { const el = $(id); el.textContent = v === null ? "—" : v; el.className = v === null ? "" : v >= 85 ? "ok" : v >= 60 ? "mid" : "no"; };
    tile("#lk-sAcc", accuracy); tile("#lk-sFlu", flu);
    const sl = $("#lk-sLink"); sl.textContent = links.length ? `${pass}/${links.length}` : "—"; sl.className = links.length ? (pass === links.length ? "ok" : pass >= links.length / 2 ? "mid" : "no") : "";
    const tips = [], bad = links.filter(l => !l.ok);
    bad.slice(0, 3).forEach(l => tips.push(`<b>${esc(l.a)}‿${esc(l.b)}</b>：${esc(l.note)}，练成 <b>${esc(l.hint)}</b>。先单独点播放听几遍，再放回整句。`));
    if(extra && !bad.length) tips.push("句子中间有多余的停顿，试着一口气读完一个意群。");
    if(rate && rate < 2.5) tips.push(`语速偏慢（${rate.toFixed(1)} 音节/秒）。先把速度调到 0.7× 跟读示范，熟了再加快。`);
    if(rate && rate > 6.5) tips.push("语速很快，注意别吞词：快不等于连读，每个词的核心元音还要清楚。");
    if(hasRecog && accuracy !== null && accuracy < 70) tips.push("不少词没被听对，先放慢，把每个词读准，再练连读。");
    if(!tips.length) tips.push("连得很顺。把速度调到 1× 再挑战，或者换一句更长的。");
    $("#lk-tips").innerHTML = tips.map(t => `<li style="margin:6px 0">${t}</li>`).join("");
    Log.add("link");
    this.status("分析完成。可以点「示范后接我的」对比着听。");
    $("#lk-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

/* ================= 我的 ================= */
Views.me = {
  show(){
    const mine = Cards.user();
    $("#v-me").innerHTML = `
      <h1>我的</h1>
      <h3>朗读</h3>
      <div class="panel">
        <div class="field"><label for="me-voice">美音发音人</label>
          <div class="row"><select id="me-voice"></select><button class="icon-btn" id="me-try" aria-label="试听">${ICON.play}</button></div>
          <details class="help"><summary class="link">想要更自然的美音？</summary>
            <p style="margin-top:6px"><b>iPhone</b>：设置 › 辅助功能 › 朗读内容 › 声音 › 英语 › 英语（美国），下载带「优化音质」或 Premium 的声音（比如 Ava、Zoe、Evan），回来刷新就能选。</p>
            <p style="margin-top:6px"><b>安卓</b>：设置 › 无障碍（或系统）› 文字转语音，首选引擎选「Google 语音服务」，语言选英语（美国）并下载高音质语音。</p>
          </details>
        </div>
        <div class="field"><label>默认语速</label>
          <div class="speed"><input type="range" id="me-speed" min="0.5" max="1.5" step="0.05" value="${Settings.get("speed")}" aria-label="默认语速"><b id="me-speed-v">${Settings.get("speed").toFixed(2)}×</b></div></div>
      </div>
      <h3>每日计划</h3>
      <div class="panel">
        <div class="field"><label for="me-new">每天学几句新句</label>
          <select id="me-new">${[5, 8, 12, 20].map(n => `<option value="${n}" ${Settings.get("newPerDay") === n ? "selected" : ""}>${n} 句</option>`).join("")}</select>
          <p class="help">复习到期的句子不受这个限制。</p></div>
      </div>
      <h3>AI 口语批改</h3>
      <div class="panel">
        <div class="field"><label for="me-key">Anthropic API 密钥</label>
          <input type="password" id="me-key" placeholder="sk-ant-…" autocomplete="off" value="${esc(Settings.get("apiKey"))}">
          <p class="help">在 console.anthropic.com 注册并充值后，在「API Keys」里创建。按使用量付费，和 Claude 会员是分开的。密钥只保存在这台手机上。不填也可以：口语页会把内容复制好，你粘贴到 Claude 里批改。</p></div>
        <div class="field"><label for="me-model">模型</label>
          <select id="me-model">
            <option value="claude-sonnet-5-5" ${Settings.get("model") === "claude-sonnet-5-5" ? "selected" : ""}>Claude Sonnet 5.5（推荐，质量好）</option>
            <option value="claude-haiku-5-5" ${Settings.get("model") === "claude-haiku-5-5" ? "selected" : ""}>Claude Haiku 5.5（更快更省）</option>
          </select></div>
        <div class="row" style="padding-top:8px"><button class="btn sm" id="me-test">测试连接</button><span class="small muted" id="me-test-res"></span></div>
      </div>
      <h3>我的句子 <span class="small muted">${mine.length} 句</span></h3>
      <div class="panel">
        ${mine.length ? mine.slice().reverse().map(c => `<div class="mycard"><div class="grow"><div style="font-weight:600">${esc(c.en)}</div>${c.zh ? `<div class="small muted">${esc(c.zh)}</div>` : ""}</div><button class="icon-btn" data-del="${c.id}" aria-label="删除">${ICON.x}</button></div>`).join("") : `<p class="small muted">口语练习里改好的句子、短语，点「加入复习」就会出现在这里。</p>`}
        <div class="field" style="border-top:1px solid var(--rule);margin-top:8px">
          <label>手动添加</label>
          <input type="text" id="me-add-en" placeholder="英文句子，比如从 Claude 那里改好的说法">
          <input type="text" id="me-add-zh" placeholder="中文意思（可选）" style="margin-top:8px">
          <button class="btn sm" id="me-add" style="margin-top:8px">${ICON.plus}<span>加入复习</span></button>
        </div>
      </div>
      <h3>数据</h3>
      <div class="panel">
        <p class="small muted">学习记录只保存在这台手机的浏览器里。换手机或清理浏览器数据前，先复制备份。</p>
        <div class="row wrap" style="margin-top:10px;gap:8px"><button class="btn sm ghost" id="me-export">复制备份</button><button class="btn sm ghost" id="me-import">从备份恢复</button></div>
        <textarea id="me-backup" hidden rows="5" style="margin-top:10px" placeholder="把备份内容粘贴到这里，再点「从备份恢复」"></textarea>
      </div>
      <p class="small muted" style="margin:22px 0 4px;text-align:center">每日美语，英语连读与口语训练</p>`;
    const sel = $("#me-voice");
    const fill = () => {
      sel.innerHTML = Speech.voices.length ? Speech.voices.map((v, i) => `<option value="${esc(v.name)}">${i === 0 ? "★ " : ""}${esc(v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*English \(United States\)/, ""))}</option>`).join("") : `<option>系统默认（没找到美音）</option>`;
      const cur = Speech.voice(); if(cur) sel.value = cur.name;
    };
    fill(); document.addEventListener("voiceschanged", fill);
    sel.onchange = () => { Settings.set("voice", sel.value); Speech.say("Hey! This is how I sound."); };
    $("#me-try").onclick = () => Speech.say("Hey! This is how I sound.");
    $("#me-speed").oninput = e => { const v = +e.target.value; Settings.set("speed", v); $("#me-speed-v").textContent = v.toFixed(2) + "×"; };
    $("#me-new").onchange = e => { Settings.set("newPerDay", +e.target.value); Review.queue = null; };
    $("#me-key").onchange = e => { Settings.set("apiKey", e.target.value.trim()); toast(e.target.value.trim() ? "密钥已保存" : "已清除密钥"); };
    $("#me-model").onchange = e => Settings.set("model", e.target.value);
    $("#me-test").onclick = async () => {
      Settings.set("apiKey", $("#me-key").value.trim());
      const res = $("#me-test-res");
      if(!Settings.get("apiKey")){ res.textContent = "先填密钥"; return; }
      res.textContent = "测试中…";
      try{
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": Settings.get("apiKey"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: Settings.get("model"), max_tokens: 10, messages: [{ role: "user", content: "Say OK" }] }) });
        res.innerHTML = r.ok ? `<span class="ok">连接成功</span>` : `<span class="no">失败（${r.status}）${r.status === 401 ? "：密钥不对" : ""}</span>`;
      }catch(_){ res.innerHTML = `<span class="no">连不上，检查网络</span>`; }
    };
    $$("[data-del]").forEach(b => b.onclick = () => { Cards.removeUser(b.dataset.del); this.show(); });
    $("#me-add").onclick = () => {
      const en = $("#me-add-en").value.trim(); if(!en){ $("#me-add-en").focus(); return; }
      Cards.addUser(en, $("#me-add-zh").value.trim(), "手动添加"); toast("已加入复习"); this.show();
    };
    $("#me-export").onclick = async () => {
      const data = {}; store.keys().forEach(k => data[k] = store.get(k));
      delete data.settings; data._v = 1;
      const text = JSON.stringify(data);
      try{ await navigator.clipboard.writeText(text); toast("备份已复制，存到备忘录里"); }
      catch(_){ const t = $("#me-backup"); t.hidden = false; t.value = text; t.select(); toast("请手动复制下面的内容"); }
    };
    $("#me-import").onclick = () => {
      const t = $("#me-backup");
      if(t.hidden || !t.value.trim()){ t.hidden = false; t.value = ""; t.focus(); return; }
      try{
        const data = JSON.parse(t.value);
        Object.entries(data).forEach(([k, v]) => { if(k !== "_v" && k !== "settings") store.set(k, v); });
        Review.queue = null; toast("恢复好了"); this.show();
      }catch(_){ toast("内容不对，没法恢复"); }
    };
  }
};

/* ================= 路由 ================= */
const ROUTES = ["today", "review", "library", "listen", "speak", "link", "me"];
function route(){
  let v = location.hash.slice(1) || "today";
  if(!ROUTES.includes(v)) v = "today";
  Speech.stop(); stopActiveListen(); clearInterval(Listen.timer);
  if(Listen.state === "hf" && v !== "listen") Views.listen.stopHF();
  if(Link.recording){ Link.recording = false; clearInterval(Link.recTimer); try{ Link.recorder && Link.recorder.stop(); }catch(_){} Link.stream && Link.stream.getTracks().forEach(t => t.stop()); }
  ROUTES.forEach(x => $("#v-" + x).hidden = x !== v);
  const tab = v === "review" || v === "library" ? "today" : v;
  $$(".tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
  Views[v].show();
  window.scrollTo(0, 0);
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-act]");
  if(!a) return;
  const act = a.dataset.act;
  if(act === "today-topic"){ const k = topicOfDay(), t = TOPICS[k]; Speak.reflex = null; Speak.topic = k; Speak.custom = null; Speak.turns = t.opener ? [{ who: "them", text: t.opener, zh: t.opener_zh }] : []; }
  if(act === "hf-learned"){ Listen.scene = "learned"; Listen.state = "setup"; setTimeout(() => Views.listen.startHF(), 50); }
  if(act === "listen-scene"){ Listen.scene = a.dataset.scene; Listen.state = "setup"; }
  if(location.hash === a.getAttribute("href")){ e.preventDefault(); route(); }
});
window.addEventListener("hashchange", route);
route();
if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
