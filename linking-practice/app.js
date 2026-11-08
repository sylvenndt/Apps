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

/* 还剩多久：秒数转「x 分 y 秒」 */
function fmtLeft(s){
  s = Math.round(s); if(!isFinite(s) || s <= 0) return "一小会儿";
  return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`;
}

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

/* 离线纠错：没填 AI key 也能指出最常见的中式英语 */
const FIX_RULES = [
  [/\bI\s+very\s+(like|love|want)\b/gi, "I really $1", "英文不说「I very like」，用 really 加强"],
  [/\bvery\s+very\b/gi, "really", "连用两个 very 不地道，用 really"],
  [/\bhow\s+to\s+say\b/gi, "how do you say", "问说法要加助动词：How do you say…"],
  [/\bdiscuss\s+about\b/gi, "discuss", "discuss 后面不加 about"],
  [/\bopen\s+the\s+(light|lights)\b/gi, "turn on the light", "开灯是 turn on the light"],
  [/\bclose\s+the\s+(light|lights)\b/gi, "turn off the light", "关灯是 turn off the light"],
  [/\bI\s+am\s+agree\b/gi, "I agree", "agree 本身是动词，不用 am"],
  [/\bI\s+(go|went)\s+to\s+home\b/gi, "I went home", "home 前面不加 to"],
  [/\bgive\s+me\s+a\s+help\b/gi, "give me a hand", "give me a hand 才是「帮个忙」"],
  [/\bwhat\s+is\s+your\s+meaning\b/gi, "what do you mean", "问「你什么意思」用 What do you mean"],
  [/\bI\s+think\s+I\s+can'?t\b/gi, "I don't think I can", "英文习惯把否定提前：I don't think I can"],
  [/\bhow\s+much\s+money\b/gi, "how much", "问价格直接说 how much"],
  [/\bso\s+so\b/gi, "not bad", "「马马虎虎」说 not bad / pretty good"],
  [/\bI\s+have\s+ever\s+been\s+to\b/gi, "I've been to", "用现在完成时更自然：I've been to"]
];
function fixText(said){
  let out = String(said || "");
  const changes = [];
  FIX_RULES.forEach(([re, rep, why]) => {
    const m = out.match(re);
    if(m){ const next = out.replace(re, rep); if(next !== out){ changes.push({ from: m[0], to: rep, why }); out = next; } }
  });
  return { text: out, changes };
}
function fixPanel(said){
  if(/[\u4e00-\u9fa5]/.test(said)) return `<div class="panel" style="margin-top:10px"><b>纠错</b><p class="small">这次说的是中文。试着用整句英文说，慢一点、有错都没关系，说错了我才能帮你改。</p></div>`;
  const f = fixText(said);
  if(!f.changes.length) return `<div class="panel" style="margin-top:10px"><b>纠错</b><p class="small ok">这句没有明显的中式英语，很好。想更地道可以填 API key 用 AI 教练。</p></div>`;
  return `<div class="panel" style="margin-top:10px"><b>纠错</b>${f.changes.slice(0, 4).map(c => `<div class="change"><div class="ft"><s>${esc(c.from)}</s> → <b>${esc(c.to)}</b></div><div class="small muted">${esc(c.why)}</div></div>`).join("")}<p class="small" style="margin-top:6px">更自然的说法：<b>${esc(f.text)}</b></p></div>`;
}


const Views = {};

/* ================= 今日 ================= */
function topicOfDay(){
  const days = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return days % TOPICS.length;
}
function warmToday(){
  if(typeof Neural === "undefined" || !Neural.wanted()) return;
  const ids = [...SRS.dueIds(), ...SRS.newIds(Settings.get("newPerDay"))].slice(0, 25);
  Neural.warm(ids.map(id => Cards.get(id)).filter(Boolean).map(c => [c.en, c.scene]));
}
Views.today = {
  show(){
    setTimeout(warmToday, 1200);
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
    const sp = soundProblem();
    $("#v-today").innerHTML = `
      ${sp ? `<a class="banner" href="#me">${sp === "inapp" ? "你在 App 内置浏览器里打开，可能没有声音。" : sp === "unsupported" ? "这个浏览器不能朗读英文。" : sp === "novoice" ? "手机里没有英文语音，所以听不到朗读。" : "朗读好像没有声音。"}<b>点这里检查</b></a>` : ""}
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
      <div class="panel theme" style="margin-top:16px">
        <div class="theme-k">今天的主题</div>
        <div class="theme-t">${esc(((SCENES.find(x => x.key === t.scene) || {}).name || t.title))} · ${esc(t.title)}</div>
        <p class="theme-b">${esc(t.brief)}</p>
        <div class="theme-h">${(t.hints || []).map(h => `<span class="chip">${esc(h)}</span>`).join("")}</div>
        <a class="btn block theme-go" href="#speak" data-act="today-topic">开始练这个话题</a>
      </div>
      <div class="stats">
        <div class="stat"><b>${SRS.learnedCount()}</b><span>学过的句子</span></div>
        <div class="stat"><b>${Log.activeDays()}</b><span>练习天数</span></div>
        <div class="stat"><b>${ALL_ITEMS.length + Cards.user().length}</b><span>句库总数</span></div>
      </div>
      <div class="links2">
        <a class="lib-link" href="#library"><div class="grow"><div class="t">场景句库</div><div class="small muted">${ALL_ITEMS.length} 句，${SCENES.length} 个场景</div></div></a>
        <a class="lib-link" href="#words"><div class="grow"><div class="t">词汇与句型</div><div class="small muted">B1–C1，${ALL_WORDS.length} 词，${PATTERNS.length + STRUCTURES.length} 个句型句式</div></div></a>
      </div>
      <p class="small muted" style="margin-top:10px">明天要复习 ${SRS.forecast(1)[0]} 句。</p>
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
    Speech.scene = card.scene;
    { const nx = Cards.get(Review.queue[Review.idx + 1]); if(nx) Neural.prefetch(nx.en, nx.scene); }
    const sc = SCENE_BY_KEY[card.scene];
    const front = type === "listen" ? `
        <button class="play" id="rv-play" style="--c:var(--blue)" aria-label="播放">${ICON.play}</button>
        <p class="small muted" style="text-align:center" id="rv-tip">${card.single ? "听这个单词，想想它是什么意思、怎么用。" : "只听，别翻译。试着直接想到画面，或者想好怎么回应。"}</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px" id="rv-tools">
          <button class="chip" id="rv-slow">慢速</button>
          <button class="chip" id="rv-chunks">按意群播放</button>
          <button class="chip" id="rv-reveal">显示英文</button>
        </div>` : `
        ${card.single ? `<p class="zh-big">${esc(card.meaning)}</p><p class="small muted" style="text-align:center">${esc(card.posZh)}，${esc(card.level)}</p>
        <p class="small muted" style="text-align:center;margin-top:8px" id="rv-tip">说出这个英文单词。</p>` : card.scene === "vocab" ? `<p class="zh-big">${esc(card.word)}</p><p class="small muted" style="text-align:center">${esc(card.note)}</p>
        <p class="small muted" style="text-align:center;margin-top:8px" id="rv-tip">用这个词说一句你自己的话。</p>` : `<p class="zh-big">${esc(card.zh)}</p>
        ${card.pattern ? `<p style="text-align:center"><button class="chip" id="rv-hint">看句型提示</button></p>` : ""}
        <p class="small muted" style="text-align:center" id="rv-tip">用英语把这句说出来。想不起来就先说个大概。</p>`}
        <div class="row" style="justify-content:center;margin-top:14px"><button class="mic lg" id="rv-say" style="--c:var(--blue)" aria-label="开始说">${ICON.mic}</button></div>
        <p id="rv-said" style="text-align:center;font-weight:600;min-height:24px;margin-top:10px"></p>
        <div id="rv-eval"></div>
        <div class="row" style="justify-content:center"><button class="chip" id="rv-reveal">看答案</button></div>`;
    v.innerHTML = `${this.header(Review.queue.length - Review.idx)}
      <div class="panel" style="margin-top:14px">
        <div class="row">${bulletHTML(card.scene)}<span class="small muted">${sc ? esc(sc.name) : "我的句子"}${isNew ? "，新句" : ""}</span></div>
        ${front}
        <div id="rv-text" hidden style="margin-top:18px">
          ${type === "speak" ? `<div class="row" style="margin-bottom:10px"><button class="play sm" id="rv-play" style="--c:var(--blue)" aria-label="播放">${ICON.play}</button><button class="chip" id="rv-slow">慢速</button><button class="chip" id="rv-chunks">按意群</button></div>` : ""}
          <div class="en">${renderEn(card.chunks)}</div>
          ${emoTag(card.en) ? `<p class="emo-line">语气：${emoTag(card.en)}</p>` : ""}
          ${card.note ? `<p class="note">${esc(card.note)}</p>` : ""}
          ${type === "listen" ? `<p class="zh blur" id="rv-zh" style="margin-top:6px" title="点一下显示中文">${esc(card.zh || "（没有中文）")}</p>` : `<p class="small" id="rv-cmp" style="margin-top:6px"></p>`}
          ${card.reply ? `<div class="row" style="margin-top:14px;align-items:flex-start">
            <button class="play sm" id="rv-reply" style="--c:var(--ink)" aria-label="播放回应">${ICON.play}</button>
            <div><div class="small muted">对方可能这样回</div><div style="font-weight:600">${esc(card.reply)}${emoTag(card.reply, "sm")}</div></div></div>` : ""}
          ${type === "listen" ? `<div class="row" style="margin-top:14px">
            <button class="btn soft sm" id="rv-shadow">${ICON.mic}<span>跟读</span></button>
            <span class="small muted grow" id="rv-shadow-res"></span></div>
          <div id="rv-shadow-eval"></div>` : ""}
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
    const hint = $("#rv-hint"); if(hint) hint.onclick = e => { e.currentTarget.outerHTML = `<b>${esc(card.pattern)}</b>`; };
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
      if(Review.said && card.scene === "vocab"){
        const need = normalize(card.word), got = normalize(Review.said);
        const used = need.every(w => got.includes(w));
        cmp.innerHTML = card.single ? (used ? `<b class="ok">说对了</b>` : `<b class="mid">没听到 ${esc(card.word)}</b>，跟着读几遍。`)
          : used ? `<b class="ok">用上了 ${esc(card.word)}</b>。上面是参考例句，你的句子说得通就算对。` : `<b class="mid">没听到 ${esc(card.word)}</b>，试着把它用进句子里。上面是参考例句。`;
      } else if(Review.said){
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
    const ev = card.single ? { ref: r.text } : card.scene === "vocab" ? { ref: r.text, zh: `用「${card.word}」说一句话`, model: card.en, grammar: true } : { ref: r.text, zh: card.zh, model: card.en, grammar: true };
    evaluateSpeech($("#rv-eval"), r, ev);
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
    const mine = r.audio ? ` <button class="chip" id="rv-mine">听我读的</button>` : "";
    if(!r.text){ res.innerHTML = esc(srErrorText(r.error)) + mine; }
    else {
      const tgt = normalize(card.en), got = normalize(r.text);
      const pct = Math.round(100 * lcsLen(tgt, got) / Math.max(tgt.length, got.length, 1));
      res.innerHTML = `<b class="${pct >= 85 ? "ok" : pct >= 60 ? "mid" : "no"}">${pct}%</b> 听到：“${esc(r.text)}”${mine}`;
    }
    const mb = $("#rv-mine"); if(mb) mb.onclick = () => { Speech.stop(); Neural.play(r.audio, 1); };
    evaluateSpeech($("#rv-shadow-eval"), r, { ref: card.en });
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
            const sc = SCENE_BY_KEY[k], on = focus.includes(k);
            const prog = sc.items.reduce((n, _, i) => n + (s[`${k}-${i}`] && s[`${k}-${i}`].reps > 0 ? 1 : 0), 0);
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
                  <div class="grow"><div style="font-weight:600">${esc(it.en)}${emoTag(it.en, "sm")}</div><div class="small muted">${esc(it.zh)}</div></div>
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
    $$("#v-library [data-p]").forEach(b => b.onclick = () => { const c = Cards.get(b.dataset.p); Speech.scene = c.scene; playWith(b, c.en); });
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
  if(sel === "vocab") return ALL_WORDS.map(w => EXTRA_CARDS[w.id]).filter(Boolean);
  if(sel === "patterns") return PATTERN_CARDS;
  if(sel === "learned") return Object.keys(SRS.all()).map(id => Cards.get(id)).filter(Boolean);
  if(sel.startsWith("cat:")){ const c = CATS.find(x => "cat:" + x.key === sel); return ALL_ITEMS.filter(x => c && c.scenes.includes(x.scene)); }
  if(sel === "all") return ALL_ITEMS;
  return ALL_ITEMS.filter(x => x.scene === sel);
}
function poolLabel(sel){
  if(sel === "all") return "全部场景";
  if(sel === "learned") return "我学过的";
  if(sel === "vocab") return "高频词汇例句";
  if(sel === "patterns") return "句型句式例句";
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
        <button class="chip${sel === "vocab" ? " on" : ""}" data-s="vocab">高频词汇</button>
        <button class="chip${sel === "patterns" ? " on" : ""}" data-s="patterns">句型句式</button>
        ${learnedN ? `<button class="chip${sel === "learned" ? " on" : ""}" data-s="learned">我学过的（${learnedN}）</button>` : ""}
      </div>
      ${(() => {
        const curCat = sel.startsWith("cat:") ? sel.slice(4) : SCENE_BY_KEY[sel] && !SCENE_BY_KEY[sel].virtual ? SCENE_BY_KEY[sel].cat : null;
        const c = CATS.find(x => x.key === curCat);
        return c ? `<div class="chips wrap2" id="ls-scenes" style="margin-top:10px">
          ${c.scenes.map(k => SCENE_BY_KEY[k]).map(s => `<button class="chip${sel === s.key ? " on" : ""}" data-s="${s.key}">${bulletHTML(s.key).replace('class="bullet', 'class="bullet xs')}${esc(s.name)}</button>`).join("")}
        </div>` : `<p class="small muted" style="margin-top:8px">先点一个分类，可以再细选到具体话题。</p>`;
      })()}
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
      <p class="small muted" style="margin-top:12px">题型有四种：听完选怎么回应、听准句子里的小词、判断在哪个场景、听出说话人的语气。答错或超时的句子会自动加入复习。</p>`;
    $$("#ls-cats .chip, #ls-scenes .chip").forEach(b => b.onclick = () => { Listen.scene = b.dataset.s; const y = window.scrollY; this.renderSetup(); window.scrollTo(0, y); });
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
      if(multi && SCENE_BY_KEY[it.scene] && !SCENE_BY_KEY[it.scene].virtual) types.push(["scene", 20]);
      if(it.word) types.push(["word", it.single ? 40 : 55]);
      if(it.single) types.push(["meaning", 60]);
      if(it.chunks && it.chunks.length >= 3) types.push(["order", 25]);
      if(it.pattern) types.push(["pattern", 45]);
      if(EMO_QUIZ.has(emoOf(it.en)) && Neural.wanted() && Clips.find(it.en, Voices.pick(it.scene, false, it.en), false)) types.push(["tone", 30]);
      if(!types.length) return null;
      let r = Math.random() * types.reduce((a, t) => a + t[1], 0), type = types[0][0];
      for(const [t, w] of types){ if((r -= w) <= 0){ type = t; break; } }
      if(type === "reply"){
        const seen = new Set([it.reply]);
        const others = shuffle(ALL_ITEMS.filter(x => x.scene !== it.scene)).filter(x => !seen.has(x.reply) && seen.add(x.reply)).slice(0, 3);
        const src = Object.fromEntries(others.map(x => [x.reply, x]));
        return { it, type, opts: shuffle([it.reply, ...others.map(x => x.reply)]), ans: it.reply, src };
      }
      if(type === "detail") return { it, type, opts: shuffle([it.en, ...dv]), ans: it.en };
      if(type === "tone"){
        // 干扰项选听感差别大的情绪
        const e = emoOf(it.en), g = EMOTIONS[e].g;
        const others = shuffle([...EMO_QUIZ].filter(x => EMOTIONS[x].g !== g));
        const picks = []; const gs = new Set([g]);
        for(const x of others){ if(picks.length >= 3) break; if(!gs.has(EMOTIONS[x].g)){ picks.push(x); gs.add(EMOTIONS[x].g); } }
        for(const x of others){ if(picks.length >= 3) break; if(!picks.includes(x)) picks.push(x); }
        return { it, type, opts: shuffle([EMOTIONS[e].zh, ...picks.map(x => EMOTIONS[x].zh)]), ans: EMOTIONS[e].zh, emo: e };
      }
      if(type === "word"){
        const me = ALL_WORDS.find(x => x.w === it.word) || { cat: "o", l: "B1" };
        // 单词题用拼写相近的词做干扰，例句题用同词性的词
        let pool2 = ALL_WORDS.filter(x => x.w !== it.word && !/\s/.test(x.w) === !/\s/.test(it.word));
        if(it.single){ const near = pool2.filter(x => x.w[0] === it.word[0] && Math.abs(x.w.length - it.word.length) <= 2); if(near.length >= 3) pool2 = near; }
        else { const same = pool2.filter(x => x.cat === me.cat); if(same.length >= 3) pool2 = same; }
        return { it, type, opts: shuffle([it.word, ...shuffle(pool2).slice(0, 3).map(x => x.w)]), ans: it.word };
      }
      if(type === "meaning"){
        const me = ALL_WORDS.find(x => x.w === it.word);
        let pool2 = ALL_WORDS.filter(x => x.w !== it.word && x.cat === me.cat && x.l === me.l && !x.hand);
        const short = z => z.replace(/^[a-z]+\.\s*/, "").split("；")[0];
        const picks = shuffle(pool2).filter(x => short(x.zh) !== short(it.meaning)).slice(0, 3);
        const opts = [short(it.meaning), ...picks.map(x => short(x.zh))];
        const src = Object.fromEntries(picks.map(x => [short(x.zh), x]));
        return { it, type, opts: shuffle(opts), ans: opts[0], src };
      }
      if(type === "order") return { it, type, opts: shuffle(it.chunks), ans: it.chunks.join(" ") };
      if(type === "pattern"){
        const all = [...PATTERNS, ...STRUCTURES].map(x => x.p).filter(x => x !== it.pattern);
        return { it, type, opts: shuffle([it.pattern, ...shuffle(all).slice(0, 3)]), ans: it.pattern };
      }
      const others = shuffle(SCENES.filter(s => s.key !== it.scene)).slice(0, 3).map(s => s.en);
      return { it, type, opts: shuffle([SCENE_BY_KEY[it.scene].en, ...others]), ans: SCENE_BY_KEY[it.scene].en };
    }).filter(Boolean);
    if(!Listen.qs.length){ toast("这些句子还出不了题，换个场景试试"); return; }
    Listen.i = 0; Listen.results = []; Listen.state = "q";
    Listen.qs.forEach(q => Neural.prefetch(q.it.en, q.it.scene));
    this.renderQ();
  },
  renderQ(){
    const q = Listen.qs[Listen.i];
    if(!q){ this.finish(); return; }
    Listen.answered = false; Listen.t0 = 0;
    Speech.scene = q.it.scene;
    { const nq = Listen.qs[Listen.i + 1]; if(nq) Neural.prefetch(nq.it.en, nq.it.scene); if(q.it.reply) Neural.prefetch(q.it.reply, q.it.scene, true); }
    clearInterval(Listen.timer);
    const prompt = { reply: "对方这样说，你会怎么回？", detail: "你听到的是哪一句？注意小词", scene: "这句话最可能在哪里听到？", word: q.it.single ? "你听到的是哪个词？" : "这句话里用到了哪个词？", pattern: "这句话用的是哪个句型？", meaning: "听到的这个词是什么意思？", order: "按听到的顺序点意群", tone: "说话的人是什么语气？" }[q.type];
    $("#v-listen").innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="ls-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${Listen.i + 1} / ${Listen.qs.length}</span>
      </div>
      <div class="progress" style="margin-top:14px">${Listen.qs.map((_, k) => `<i class="${k < Listen.results.length ? (Listen.results[k].ok ? "ok" : "no") : k === Listen.i ? "cur" : ""}"></i>`).join("")}</div>
      <p style="text-align:center;font-weight:700">${prompt}</p>
      <button class="play" id="ls-play" style="--c:var(--orange)" aria-label="播放">${ICON.play}</button>
      <div class="timer"><i id="ls-timer"></i></div>
      ${q.type === "order" ? `<div class="order-ans" id="ls-ans"></div><div class="tiles" id="ls-tiles">${q.opts.map((o, k) => `<button class="tile" data-k="${k}">${esc(o)}</button>`).join("")}</div>`
        : `<div class="opts${q.type === "detail" ? " detail" : ""}" id="ls-opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div>`}
      <div id="ls-fb" style="margin-top:16px"></div>`;
    $("#ls-quit").onclick = () => { clearInterval(Listen.timer); Speech.stop(); this.renderSetup(); };
    const play = $("#ls-play");
    play.onclick = () => playWith(play, q.it.en);
    $$("#ls-opts .opt").forEach(b => b.onclick = () => this.answer(+b.dataset.k));
    if(q.type === "order"){
      q.picked = [];
      $$("#ls-tiles .tile").forEach(b => b.onclick = () => {
        if(Listen.answered || b.disabled) return;
        b.disabled = true; q.picked.push(+b.dataset.k);
        $("#ls-ans").insertAdjacentHTML("beforeend", `<button class="tile on" data-u="${b.dataset.k}">${b.innerHTML}</button>`);
        $$("#ls-ans .tile").forEach(u => u.onclick = () => {
          if(Listen.answered) return;
          const k = +u.dataset.u; q.picked = q.picked.filter(x => x !== k); u.remove();
          $(`#ls-tiles .tile[data-k="${k}"]`).disabled = false;
        });
        if(q.picked.length === q.opts.length) this.answer(q.picked.map(x => q.opts[x]).join(" ") === q.ans ? 0 : 1, true);
      });
    }
    (async () => {
      await sleep(300);
      const ok = await playWith(play, q.it.en);
      if(ok && !Listen.answered && Listen.state === "q" && Listen.qs[Listen.i] === q) this.startTimer();
    })();
  },
  startTimer(){
    const qt = Listen.qs[Listen.i].type, total = Settings.get("reactSec") * 1000 * (qt === "order" ? 2.2 : qt === "detail" ? 1.4 : 1), bar = $("#ls-timer");
    Listen.t0 = performance.now();
    clearInterval(Listen.timer);
    Listen.timer = setInterval(() => {
      const p = (performance.now() - Listen.t0) / total;
      if(bar) bar.style.transform = `scaleX(${Math.max(0, 1 - p)})`;
      if(p >= 1){ clearInterval(Listen.timer); if(!Listen.answered) this.answer(-1); }
    }, 50);
  },
  answer(k, isOrder){
    if(Listen.answered) return;
    Listen.answered = true;
    clearInterval(Listen.timer);
    const q = Listen.qs[Listen.i];
    const rt = Listen.t0 ? (performance.now() - Listen.t0) / 1000 : 0;
    const ok = isOrder ? k === 0 : k >= 0 && q.opts[k] === q.ans;
    if(q.type === "order"){ $$("#ls-ans .tile").forEach(t => t.classList.add(ok ? "ok" : "no")); $$("#ls-tiles .tile").forEach(t => t.disabled = true); }
    Listen.results.push({ ok, rt: k >= 0 ? rt : null, id: q.it.id });
    if(!ok) SRS.schedule(q.it.id, Date.now());
    $$("#ls-opts .opt").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.ans) b.classList.add("ok"); else if(j === k) b.classList.add("no"); });
    const head = k < 0 ? `<b class="no">超时了</b>，听到就要马上反应` : isOrder && !ok ? `<b class="no">顺序不对</b>，再听一遍，注意意群之间是怎么连起来的` : ok ? `<b class="ok">对</b>${Listen.t0 ? `，用时 ${rt.toFixed(1)} 秒` : ""}` : `<b class="no">不对</b>，这句已加入复习`;
    const picked = k >= 0 && !isOrder ? q.opts[k] : null;
    const fb = this.explain(q, picked, ok, isOrder);
    $("#ls-fb").innerHTML = `
      <p>${head}</p>
      <div class="panel fbx" style="margin-top:10px">
        <div class="fb-row"><span class="fb-k">原句</span><div class="grow"><div class="en" style="font-size:19px">${renderEn(q.it.chunks)}</div>${fb.srcZh ? `<div class="zh-line">${esc(fb.srcZh)}</div>` : ""}</div></div>
        <div class="fb-row"><span class="fb-k ok">答案</span><div class="grow"><b>${esc(fb.ans)}</b>${fb.ansZh ? `<div class="zh-line">${esc(fb.ansZh)}</div>` : ""}</div></div>
        ${fb.picked ? `<div class="fb-row"><span class="fb-k no">你选的</span><div class="grow"><b>${esc(fb.picked)}</b>${fb.pickedZh ? `<div class="zh-line">${fb.pickedZh}</div>` : ""}</div></div>` : ""}
        <div class="fb-row"><span class="fb-k">解析</span><div class="grow small">${fb.why}</div></div>
        ${fb.links ? `<div class="fb-row"><span class="fb-k">连读</span><div class="grow small">${fb.links}</div></div>` : ""}
        <div class="row wrap" style="margin-top:12px;gap:8px">
          <button class="chip" id="ls-again">再听</button><button class="chip" id="ls-slow">慢速</button>
          ${q.it.reply ? `<button class="chip" id="ls-reply">听回应</button>` : ""}
          <button class="chip" id="ls-save">加入复习</button>
        </div>
      </div>
      <button class="btn block" style="margin-top:14px;padding:14px" id="ls-next">${Listen.i + 1 < Listen.qs.length ? "下一题" : "看结果"}</button>`;
    const rp = $("#ls-reply"); if(rp) rp.onclick = () => playWith($("#ls-play"), q.it.reply, null, true);
    const play = $("#ls-play");
    $("#ls-again").onclick = () => playWith(play, q.it.en);
    $("#ls-slow").onclick = () => playWith(play, q.it.en, Math.max(0.5, Settings.get("speed") - 0.3));
    $("#ls-save").onclick = e => { SRS.schedule(q.it.id, Date.now()); Review.queue = null; e.currentTarget.textContent = "已加入"; e.currentTarget.disabled = true; };
    if(!ok){ const s = $("#ls-save"); s.textContent = "已加入"; s.disabled = true; Review.queue = null; }
    $("#ls-next").onclick = () => { Speech.stop(); Listen.i++; this.renderQ(); };
  },
  /* 讲解：原句意思、正确答案、你选的为什么不对 */
  explain(q, picked, ok, isOrder){
    const it = q.it, sc = SCENE_BY_KEY[it.scene];
    const srcZh = it.single ? "" : (it.scene === "vocab" ? "" : it.zh);
    const toks = tokenize(it.en), lk = detectLinks(toks).slice(0, 3);
    const links = lk.length ? lk.map(l => `<b>${esc(l.a)}‿${esc(l.b)}</b> 读作 ${esc(l.hint)}`).join("；") : "";
    const r = { srcZh, links, ans: q.ans, ansZh: "", picked: ok ? null : picked, pickedZh: "", why: "" };
    if(q.type === "reply"){
      r.ansZh = REPLY_ZH[q.ans] || "";
      r.why = `对方说「${esc(it.zh)}」，最自然的接话是「${esc(r.ansZh || q.ans)}」。`;
      if(r.picked){ const o = q.src && q.src[r.picked]; r.pickedZh = `${esc(REPLY_ZH[r.picked] || "")}${o ? `<br><span class="muted">这句一般用来回应：${esc(o.en)}（${esc(o.zh)}）</span>` : ""}`; }
    } else if(q.type === "detail"){
      r.ansZh = it.zh;
      const a = q.ans.split(" ");
      if(r.picked){ const b = r.picked.split(" "); const i = a.findIndex((w, j) => w !== b[j]); if(i >= 0){ r.pickedZh = `差别在 <b class="no">${esc(b[i])}</b>，原句是 <b class="ok">${esc(a[i])}</b>`; } }
      r.why = "这类题只差一个小词。连读时 can / can't、do / did、a / the 这些词会被弱读、吞掉，要靠前后的意思和重音来判断。听不出来就用慢速多听几遍。";
    } else if(q.type === "scene"){
      r.ansZh = sc ? sc.name : "";
      r.why = `这句话的意思是「${esc(it.zh)}」，一般出现在「${esc(sc ? sc.name : "")}」的场合。`;
      if(r.picked){ const ps = SCENES.find(x => x.en === r.picked); r.pickedZh = ps ? esc(ps.name) : ""; }
    } else if(q.type === "word"){
      const w = ALL_WORDS.find(x => x.w === q.ans);
      r.ansZh = w ? `${w.pos}，${w.zh.replace(/^[a-z]+\.\s*/, "")}` : "";
      r.why = it.single ? "先听清整个单词的音节和重音，再想意思。拼写相近的词，区别往往在重音和中间的元音。" : `这句话里用到了 <b>${esc(q.ans)}</b>。${esc(it.note || "")}`;
      if(r.picked){ const p = ALL_WORDS.find(x => x.w === r.picked); r.pickedZh = p ? esc(`${p.pos}，${p.zh.replace(/^[a-z]+\.\s*/, "")}`) : ""; }
    } else if(q.type === "meaning"){
      r.ansZh = `${it.word}（${it.posZh || ""}）`;
      r.why = esc(it.note || "");
      if(r.picked){ const p = q.src && q.src[r.picked]; r.pickedZh = p ? `这是 <b>${esc(p.w)}</b> 的意思` : ""; }
    } else if(q.type === "pattern"){
      const pt = [...PATTERNS, ...STRUCTURES].find(x => x.p === q.ans);
      r.ansZh = pt ? pt.zh : "";
      r.why = `这句话用了「${esc(q.ans)}」：${esc(pt ? pt.zh : "")}。`;
      if(r.picked){ const pp = [...PATTERNS, ...STRUCTURES].find(x => x.p === r.picked); r.pickedZh = pp ? esc(pp.zh) : ""; }
    } else if(q.type === "tone"){
      const E = EMOTIONS[q.emo];
      r.why = `「${esc(E.zh)}」的语气：${EMO_CUES[E.g]}美国人很多时候靠语气表达态度，同一句话换个语气，意思可能完全不同。`;
      if(r.picked){ const pk = Object.values(EMOTIONS).find(x => x.zh === r.picked); r.pickedZh = pk ? `「${esc(pk.zh)}」一般是：${EMO_CUES[pk.g]}` : ""; }
    } else if(q.type === "order"){
      r.ans = it.chunks.join(" / ");
      r.ansZh = it.zh;
      r.why = `这句分成 ${it.chunks.length} 个意群。美国人说话是一个意群一口气说完的，意群内部的词会连在一起，意群之间才会有很短的停顿。`;
    }
    if(it.reply && q.type !== "reply") r.why += `<br><span class="muted">对方可能回：${esc(it.reply)}（${esc(REPLY_ZH[it.reply] || "")}）</span>`;
    return r;
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
    if(it){ Speech.scene = it.scene; const nx = h.list[(h.i + 1) % h.list.length]; Neural.prefetch(it.reply, it.scene, true); if(nx) Neural.prefetch(nx.en, nx.scene); }
    if(!it){ this.renderSetup(); return; }
    $("#v-listen").innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="hf-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${esc(poolLabel(Listen.scene))}，${h.i + 1} / ${h.list.length}</span>
      </div>
      <div class="hf-stage">
        <div class="row" style="justify-content:center">${bulletHTML(it.scene, true)}</div>
        <div class="en hf-en${h.showText ? "" : " blur"}" id="hf-en">${renderEn(it.chunks)}</div>
        ${h.showText && emoTag(it.en) ? `<p style="text-align:center;margin-top:6px">${emoTag(it.en)}</p>` : ""}
        <p class="zh blur" id="hf-zh">${esc(it.zh || "")}</p>
        ${h.reply && it.reply ? `<p class="hf-reply${h.showText ? "" : " blur"}">${esc(it.reply)}${h.showText ? emoTag(it.reply, "sm") : ""}</p>` : ""}
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
    conversation: Speak.turns.filter(x => x.who === "me" || x.who === "them").map(x => ({ who: x.who, text: x.who === "me" ? x.natural : x.text })),
    learner_said: said
  };
  const text = await AI.chat({ system: COACH_SYSTEM, user: JSON.stringify(payload), maxTokens: 1500 });
  return AI.json(text);
}

function coachPrompt(said){
  const t = currentTopic();
  const hist = Speak.turns.filter(x => x.who === "me" || x.who === "them").map(x => x.who === "me" ? `我：${x.natural}` : `对方：${x.text}`).join("\n");
  return `我在练美式英语口语，请当我的口语教练。\n场景：${t.brief}\n${hist ? "之前的对话：\n" + hist + "\n" : ""}我刚才说的是：「${said}」\n\n请：\n1. 改成美国人在这个场景里会自然说出口的地道口语；\n2. 再给一个更随意的说法；\n3. 用中文解释最关键的几处改动，为什么这样更地道；\n4. 扮演对方，用一两句话自然地回应我，让我接着练。`;
}

Views.speak = {
  renderSession(){
    const t = currentTopic();
    Speech.scene = t.scene || "talk";
    const hasKey = AI.ready();
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
        <div id="sp-eval"></div>
        ${hasKey ? `<button class="btn block" style="--c:var(--green);background:var(--green);color:#fff;margin-top:12px;padding:13px" id="sp-send">改成地道说法</button>` : ""}
        ${hasKey ? "" : `<p class="small muted" style="margin-top:10px;line-height:1.6">填上密钥后，这里会直接给出地道说法、逐句解释和打分，还能接着对话。密钥在「我的 → AI 批改」里填。</p>`}
        <p class="err" id="sp-err" hidden></p>
      </div>`;
    $("#sp-back").onclick = () => { stopActiveListen(); Speak.topic = null; Speak.custom = null; Speak.turns = []; this.renderList(); };
    $$("#v-speak [data-say]").forEach(b => b.onclick = () => Speech.say(b.dataset.say));
    $("#sp-mic").onclick = () => this.toggleMic();
    const _sendBtn = $("#sp-send"); if(_sendBtn) _sendBtn.onclick = () => this.send();
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
    $$("[data-play]", th).forEach(b => b.onclick = () => { const x = Speak.turns[+b.dataset.play]; playWith(b, x.who === "me" ? x.r.natural : x.text, null, x.who !== "me"); });
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
    const ph = input.placeholder;
    activeListen = startListening({ silenceMs: 2200, onStatus: m => input.placeholder = m, onText: t => input.value = (base ? base + " " : "") + t });
    const r = await activeListen.done; activeListen = null;
    input.placeholder = ph;
    if(r.local && r.text) input.value = (base ? base + " " : "") + r.text;
    mic.classList.remove("on"); mic.innerHTML = ICON.mic;
    if(r.text && r.audio){
      evaluateSpeech($("#sp-eval"), r, { ref: r.text, compact: true });
    }
    if(!r.text && r.error && r.error !== "aborted") { toast(srErrorText(r.error)); }
  },
  async send(){
    stopActiveListen();
    const input = $("#sp-input"), said = input.value.trim(), err = $("#sp-err");
    err.hidden = true;
    if(!said){ input.focus(); toast("先说一句或打一句"); return; }
    if(!AI.ready()){
      const text = coachPrompt(said);
      try{ await copyText(text); toast("已复制，打开 DeepSeek 或 Claude 粘贴就行"); }
      catch(_){ err.hidden = false; err.style.color = "var(--muted)"; err.innerHTML = `复制失败，请手动复制：<textarea style="margin-top:6px" rows="6">${esc(text)}</textarea>`; }
      $("#sp-thread").insertAdjacentHTML("beforeend", fixPanel(said));
      Log.add("speak");
      return;
    }
    if(Speak.busy) return;
    Speak.busy = true;
    const btn = $("#sp-send"); if(btn) btn.disabled = true;
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
      if(r.reply && location.hash === "#speak"){ await sleep(400); await playWith($(`[data-play="${Speak.turns.length - 1}"]`), r.reply, null, true); }
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
    neuralSoon();
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
      <button class="hf-card" id="sp-pattern">
        <div class="grow"><div class="t">句型造句</div><div class="small muted">随机抽一个高频句型，用它说说你自己的事，AI 帮你改。</div></div>
        <span class="bullet" style="--c:var(--indigo)">P</span>
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
    $("#sp-pattern").onclick = () => { const all = [...PATTERNS, ...STRUCTURES]; practicePattern(all[Math.floor(Math.random() * all.length)]); };
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
    Speech.scene = it.scene; Neural.prefetch(it.reply, it.scene); { const nx = R.items[R.i + 1]; if(nx) Neural.prefetch(nx.en, nx.scene, true); }
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
    if(r.text && $("#rf-res")){ $("#rf-res").insertAdjacentHTML("afterbegin", `<div id="rf-eval"></div>`); evaluateSpeech($("#rf-eval"), r, { ref: r.text }); }
  },
  showReflexAnswer(){
    const R = Speak.reflex, it = R.items[R.i];
    $("#rf-tip").hidden = true;
    const hasKey = AI.ready();
    $("#rf-res").innerHTML = `
      <div class="panel" style="margin-top:14px">
        <div class="small muted">参考回答${R.rt !== null ? `，你的反应时间 ${R.rt.toFixed(1)} 秒` : ""}</div>
        <div class="row" style="align-items:flex-start;margin-top:6px"><button class="play sm" id="rf-ans" style="--c:var(--green)" aria-label="播放">${ICON.play}</button><div class="say grow" style="font-weight:700;font-size:18px">${esc(it.reply)}</div></div>
        <p class="small muted" style="margin-top:8px">对方说的是：${esc(it.en)}（${esc(it.zh)}）</p>
        ${R.said ? fixPanel(R.said) : ""}${R.said && hasKey ? `<button class="link" id="rf-ai" style="margin-top:10px">让 AI 把我的回答改得更地道</button>` : ""}
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
    neuralSoon();
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
    Speech.scene = "link";
    $("#lk-model").onclick = () => Speech.say(Link.text);
    $("#lk-both").onclick = async () => { await Speech.say(Link.text); await sleep(350); this.playMine(); };
    $("#lk-mine").onclick = () => this.playMine();
    $("#lk-rec").onclick = () => Link.recording ? this.stopRec() : this.startRec();
    $("#lk-keep").onchange = e => Settings.set("keepAudio", e.target.checked);
    $("#lk-file").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if(!f) return;
      if(!Link.tokens.length){ this.status("先输入你录音里读的那句英文。", true); return; }
      this.status("分析上传的录音…"); this.setAudio(f); $("#lk-live").textContent = "";
      let rec = { unsupported: true };
      /* 安装版：上传的录音也能用内置模型识别（最长 60 秒） */
      if(NATIVE_ASR){
        try{
          const buf = await decode(f), ch = buf.getChannelData(0);
          const pcm = await resample(ch.subarray(0, Math.min(ch.length, buf.sampleRate * 60)), buf.sampleRate, 16000);
          this.status("识别上传的录音…");
          const j = await NativeAsr.pcm(pcm);
          const text = cleanStt(j.text);
          rec = text ? { text, local: true, native: true } : { text: "", error: "no-speech" };
        }catch(err){ rec = { unsupported: true }; }
      }
      await this.analyze(f, rec); e.target.value = "";
      this.status(rec.text ? "分析完成。" : "");
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
    if(Listener.engine() === "local" || Listener.engine() === "native") return this.startRecLocal(); // 自己录音的引擎：录音和识别用同一段声音，不抢麦克风
    const keep = $("#lk-keep").checked;
    Link.stream = null; Link.recorder = null; Link.chunks = [];
    if(keep){
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){ this.status("这里不能直接录音。请用 Safari 或 Chrome 打开，或者点「上传录音」。", true); return; }
      try{ Link.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch(e){ this.status("没法使用麦克风（" + (e.name || e.message) + "）。请在浏览器里允许麦克风，或者点「上传录音」。", true); return; }
    } else if(!Listener.available()){ this.status("这个浏览器不支持语音识别，也不能录音。请用 Safari 或 Chrome 打开。", true); return; }
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
  /* 手机上识别：自己录音，录音和识别用的是同一段声音，不会互相抢麦克风 */
  async startRecLocal(){
    Speech.stop();
    Link.recording = true; Link.local = true; clearInterval(Link.recTimer);
    const btn = $("#lk-rec"); btn.innerHTML = `${ICON.stop}<span>停止</span>`; btn.style.background = "var(--red)"; btn.style.color = "#fff";
    $("#lk-live").textContent = "";
    this.status("录音中… 读完整句后停一下，或者点「停止」。");
    activeListen = startListening({ target: Link.text, maxMs: 29000, silenceMs: 1800, onStatus: m => this.status(m), onText: t => { const l = $("#lk-live"); if(l) l.textContent = t; } });
    const rec = await activeListen.done; activeListen = null;
    Link.recording = false; Link.local = false;
    const b2 = $("#lk-rec"); if(b2){ b2.innerHTML = `${ICON.mic}<span>开始录音</span>`; b2.style.background = ""; b2.style.color = ""; }
    if(!$("#lk-result")) return;
    if(rec.error && !rec.audio){ this.status(srErrorText(rec.error), true); return; }
    this.status("分析中…");
    if(rec.audio) this.setAudio(rec.audio);
    await this.analyze(rec.audio || null, rec.text ? rec : { text: "", error: rec.error });
    if(!rec.text) this.status(srErrorText(rec.error), true);
    const lr = $("#lk-result");
    if(lr && rec.audio){
      let pb = $("#lk-pron"); if(!pb){ lr.insertAdjacentHTML("afterbegin", `<div id="lk-pron"></div>`); pb = $("#lk-pron"); }
      evaluateSpeech(pb, rec, { ref: Link.text });
    }
  },
  async stopRec(){
    if(Link.local){ if(activeListen) activeListen.stop(); return; }
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
      <h1>我的 <span class="small muted" style="font-weight:500">版本 ${APP_VERSION}</span></h1>
      <h3>跟读识别 <span class="small muted">麦克风</span></h3>
      <div class="panel" id="stt-box"></div>
      <h3>发音打分 <span class="small muted">微软 Azure</span></h3>
      <div class="panel" id="pron-box"></div>
      <h3>声音检查</h3>
      <div class="panel" id="me-diag"></div>
      <h3>性能检查</h3>
      <div class="panel" id="me-perf"></div>
      <h3>发音人</h3>
      <div class="panel" id="nv-box"></div>
      <h3>朗读</h3>
      <div class="panel">
        <div class="field"><label for="me-voice">手机系统语音</label>
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
          <select id="me-new">${[5, 8, 10, 15, 20, 30].map(n => `<option value="${n}" ${Settings.get("newPerDay") === n ? "selected" : ""}>${n} 句</option>`).join("")}</select></div>
        <div class="field"><label for="me-neww">每天学几个新单词</label>
          <select id="me-neww">${[0, 10, 15, 20, 30, 50].map(n => `<option value="${n}" ${Settings.get("newWordsPerDay") === n ? "selected" : ""}>${n ? n + " 个" : "不学新词"}</option>`).join("")}</select>
          <p class="help">每天 15 个，大约一年学完 5600 个词。复习到期的内容不受这些限制；新内容从哪里来、从哪个级别开始，在「词汇与句型」页设置。</p></div>
      </div>
      <h3>AI 批改 <span class="small muted">口语教练、语法纠错</span></h3>
      <div class="panel" id="ai-box"></div>
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
    fill(); Views.me.fillVoices = fill;
    this.renderVoices();
    this.renderStt();
    this.renderPron();
    this.renderDiag();
    this.renderPerf();
    sel.onchange = () => { Settings.set("voice", sel.value); Speech.say("Hey! This is how I sound."); };
    $("#me-try").onclick = () => Speech.say("Hey! This is how I sound.");
    $("#me-speed").oninput = e => { const v = +e.target.value; Settings.set("speed", v); $("#me-speed-v").textContent = v.toFixed(2) + "×"; };
    $("#me-new").onchange = e => { Settings.set("newPerDay", +e.target.value); Review.queue = null; };
    $("#me-neww").onchange = e => { Settings.set("newWordsPerDay", +e.target.value); Review.queue = null; };
    this.renderAI();
    $$("[data-del]").forEach(b => b.onclick = () => { Cards.removeUser(b.dataset.del); this.show(); });
    $("#me-add").onclick = () => {
      const en = $("#me-add-en").value.trim(); if(!en){ $("#me-add-en").focus(); return; }
      Cards.addUser(en, $("#me-add-zh").value.trim(), "手动添加"); toast("已加入复习"); this.show();
    };
    $("#me-export").onclick = async () => {
      const data = {}; store.keys().forEach(k => data[k] = store.get(k));
      delete data.settings; data._v = 1;
      const text = JSON.stringify(data);
      try{ await copyText(text); toast("备份已复制，存到备忘录里"); }
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

/* ================= 词汇与句型 ================= */
const Words = { tab: "vocab", level: "B1", type: "all", q: "", shown: 80 };
function practicePattern(p){
  stopActiveListen();
  Speak.reflex = null; Speak.topic = null; Speak.turns = [];
  Speak.custom = { scene: STRUCTURES.includes(p) ? "structure" : "pattern", title: p.p, them: "Coach",
    brief: `用「${p.p}」（${p.zh}）说两三句和你自己生活有关的话。参考例句：${p.ex[0][0]}`, hints: [p.ex[0][0], p.ex[1][0]] };
  if(location.hash === "#speak") Views.speak.renderSession(); else location.hash = "#speak";
}
const lvBadge = l => `<span class="lv lv-${l}">${l}</span>`;
Views.words = {
  filtered(){
    const q = Words.q.trim().toLowerCase();
    return ALL_WORDS.filter(v => (Words.level === "all" || v.l === Words.level) && (Words.type === "all" || v.cat === Words.type)
      && (!q || v.w.toLowerCase().includes(q) || v.zh.includes(q)));
  },
  wordRow(v, s){
    return `
      <div class="wrow">
        <button class="play sm" data-wp="${v.id}" style="--c:var(--teal)" aria-label="播放">${ICON.play}</button>
        <div class="grow">
          <div class="row" style="gap:8px;flex-wrap:wrap"><b class="word">${esc(v.w)}</b>${lvBadge(v.l)}${v.hand ? `<span class="tag-hand">口语精选</span>` : ""}</div>
          <div class="small muted">${esc(v.pos)}，${esc(v.zh.replace(/^[a-z]+\.\s*/, ""))}</div>
          ${v.ex ? `<div class="ex">${esc(v.ex)}</div>` : ""}
        </div>
        ${s[v.id] ? `<span class="small muted">复习中</span>` : `<button class="icon-btn" data-wadd="${v.id}" aria-label="加入复习">${ICON.plus}</button>`}
      </div>`;
  },
  show(){
    const s = SRS.all(), mix = Settings.get("mix"), start = Settings.get("startLevel");
    const lvCount = L => { const ids = ALL_WORDS.filter(v => v.l === L); return `${ids.filter(v => s[v.id] && s[v.id].reps > 0).length}/${ids.length}`; };
    let body = "";
    if(Words.tab === "vocab"){
      const list = this.filtered();
      body = `
        <input type="text" id="wd-q" placeholder="搜索单词或中文" value="${esc(Words.q)}" style="margin-top:12px" aria-label="搜索">
        <div class="chips" id="wd-type" style="margin-top:10px">
          <button class="chip${Words.type === "all" ? " on" : ""}" data-t="all">全部词性</button>
          ${WORD_CATS.map(([k, n]) => `<button class="chip${Words.type === k ? " on" : ""}" data-t="${k}">${n}</button>`).join("")}
        </div>
        <div class="row between" style="margin:14px 0 6px"><span class="small muted">${list.length} 个</span><button class="link" id="wd-addall">把下面显示的全部加入复习</button></div>
        <div class="panel" style="padding:2px 16px" id="wd-list">${list.slice(0, Words.shown).map(v => this.wordRow(v, s)).join("") || `<p class="small muted" style="padding:14px 0">没有找到。</p>`}</div>
        ${list.length > Words.shown ? `<button class="btn ghost block" id="wd-more" style="margin-top:12px">再显示 ${Math.min(80, list.length - Words.shown)} 个</button>` : ""}`;
    } else if(Words.tab === "pattern"){
      const list = PATTERNS.filter(p => Words.level === "all" || p.l === Words.level);
      body = `<p class="small muted" style="margin:12px 0 6px">${list.length} 个。每个配两句经典例句，可以加入复习，也可以直接用它练口语。</p>${list.map(p => this.patCard(p, s)).join("")}`;
    } else {
      body = STRUCT_GROUPS.map(([g, name]) => {
        const list = STRUCTURES.filter(p => p.g === g && (Words.level === "all" || p.l === Words.level));
        return list.length ? `<h3>${esc(name)}</h3>${list.map(p => this.patCard(p, s)).join("")}` : "";
      }).join("");
    }
    $("#v-words").innerHTML = `
      <div class="row" style="margin-bottom:14px"><a class="icon-btn" href="#today" aria-label="返回">${ICON.back}</a><h2 style="margin:0">词汇与句型</h2></div>
      <div class="panel flat">
        <div class="small" style="font-weight:700">每天自动加入复习</div>
        <div class="chips" id="wd-mix" style="margin-top:8px;flex-wrap:wrap">
          <button class="chip${mix.vocab !== false ? " on" : ""}" data-mx="vocab">单词（每天 ${Settings.get("newWordsPerDay")} 个）</button>
          <button class="chip${mix.pattern !== false ? " on" : ""}" data-mx="pattern">句型句式</button>
          <button class="chip${mix.scenes !== false ? " on" : ""}" data-mx="scenes">场景句</button>
        </div>
        <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><span class="small muted">从哪个级别开始</span>
          ${LEVELS.map(L => `<button class="chip${start === L ? " on" : ""}" data-start="${L}">${L}</button>`).join("")}
        </div>
        <p class="small muted" style="margin-top:8px">单词已学：B1 ${lvCount("B1")}，B2 ${lvCount("B2")}，C1 ${lvCount("C1")}。每天学几个新词，在「我的」里调整。</p>
      </div>
      <div class="seg" id="wd-tabs" style="margin-top:16px">
        ${[["vocab", `单词 ${ALL_WORDS.length}`], ["pattern", `句型 ${PATTERNS.length}`], ["structure", `句式 ${STRUCTURES.length}`]].map(([k, n]) => `<button class="${Words.tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}
      </div>
      <div class="chips" id="wd-level" style="margin-top:12px">
        ${["all", ...LEVELS].map(L => `<button class="chip${Words.level === L ? " on" : ""}" data-l="${L}">${L === "all" ? "全部级别" : L}</button>`).join("")}
      </div>
      ${body}
      <p class="small muted" style="margin-top:24px">词汇级别参考 CEFR-J Wordlist 1.5（东京外国语大学 Tono Lab）和 Octanove C1/C2 词表（CC BY-SA 4.0），中文释义来自开源词典 ECDICT。</p>`;
    this.bind();
  },
  patCard(p, s){
    const inSrs = p.ex.every((_, k) => s[`${p.id}-${k}`]);
    return `
      <div class="panel pcard">
        <div class="row between" style="align-items:flex-start;gap:10px"><b class="pat">${esc(p.p)}</b>${lvBadge(p.l)}</div>
        <p class="small muted" style="margin-top:2px">${esc(p.zh)}</p>
        ${p.ex.map(([en, zh], k) => `
          <div class="row exrow">
            <button class="play sm" data-pp="${p.id}-${k}" style="--c:var(--indigo)" aria-label="播放">${ICON.play}</button>
            <div class="grow"><div class="ex-en">${esc(en)}</div><div class="small muted">${esc(zh)}</div></div>
          </div>`).join("")}
        <div class="row" style="gap:8px;margin-top:10px">
          ${inSrs ? `<span class="small muted">例句复习中</span>` : `<button class="chip" data-padd="${p.id}">加入复习</button>`}
          <button class="chip" data-pspeak="${p.id}">用它说一说</button>
        </div>
      </div>`;
  },
  bind(){
    const keep = fn => () => { const y = window.scrollY; fn(); this.show(); window.scrollTo(0, y); };
    $$("#wd-tabs button").forEach(b => b.onclick = () => { Words.tab = b.dataset.tab; Words.shown = 80; this.show(); });
    $$("#wd-level .chip").forEach(b => b.onclick = keep(() => { Words.level = b.dataset.l; Words.shown = 80; }));
    $$("#wd-type .chip").forEach(b => b.onclick = keep(() => { Words.type = b.dataset.t; Words.shown = 80; }));
    const q = $("#wd-q");
    if(q){ let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { Words.q = q.value; Words.shown = 80; this.show(); const n = $("#wd-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); }; }
    const more = $("#wd-more"); if(more) more.onclick = keep(() => Words.shown += 80);
    $$("#wd-mix .chip").forEach(b => b.onclick = keep(() => {
      const m = { ...Settings.get("mix") }; m[b.dataset.mx] = m[b.dataset.mx] === false;
      if(m.vocab === false && m.pattern === false && m.scenes === false){ toast("至少保留一种"); return; }
      Settings.set("mix", m); Review.queue = null;
    }));
    $$("[data-start]").forEach(b => b.onclick = keep(() => { Settings.set("startLevel", b.dataset.start); Review.queue = null; }));
    $$("[data-wp]").forEach(b => b.onclick = async () => { const c = EXTRA_CARDS[b.dataset.wp]; Speech.scene = "vocab"; b.classList.add("speaking"); if(await Speech.say(c.word, 0.8) && !c.single){ await sleep(350); await Speech.say(c.en); } b.classList.remove("speaking"); });
    $$("[data-pp]").forEach(b => b.onclick = () => { const c = EXTRA_CARDS[b.dataset.pp]; Speech.scene = c.scene; playWith(b, c.en); });
    $$("[data-wadd]").forEach(b => b.onclick = () => { SRS.schedule(b.dataset.wadd, Date.now()); Review.queue = null; b.outerHTML = `<span class="small muted">复习中</span>`; });
    const addAll = $("#wd-addall");
    if(addAll) addAll.onclick = keep(() => {
      const list = this.filtered().slice(0, Words.shown);
      list.forEach(v => { if(!SRS.all()[v.id]) SRS.schedule(v.id, Date.now()); });
      Review.queue = null; toast(`已加入 ${list.length} 个词，今天就能复习`);
    });
    $$("[data-padd]").forEach(b => b.onclick = keep(() => { const p = [...PATTERNS, ...STRUCTURES].find(x => x.id === b.dataset.padd); p.ex.forEach((_, k) => SRS.schedule(`${p.id}-${k}`, Date.now())); Review.queue = null; toast("两句例句已加入复习"); }));
    $$("[data-pspeak]").forEach(b => b.onclick = () => practicePattern([...PATTERNS, ...STRUCTURES].find(x => x.id === b.dataset.pspeak)));
  }
};

/* ================= 性能检查 ================= */
Views.me.renderPerf = function(){
  const box = $("#me-perf"); if(!box) return;
  const ms = v => v === null ? "—" : v < 1000 ? v + " 毫秒" : (v / 1000).toFixed(1) + " 秒";
  const iso = window.crossOriginIsolated;
  const ctl = navigator.serviceWorker && navigator.serviceWorker.controller;
  const tap = Perf.avg("tap"), sys = Perf.avg("sys"), ai = Perf.avg("ai"), clip = Perf.avg("clip");
  const rows = [
    ["启动用时", ms(Perf.boot), Perf.boot && Perf.boot < 1500],
    ["点击到界面更新", ms(tap), tap === null || tap < 150],
    ["系统语音开口", ms(sys), sys === null || sys < 800],
    ["AI 录音开口", ms(clip), clip === null || clip < 600],
    ["AI 现场生成（没录过的句子）", ms(ai), ai === null || ai < 1500],
    ["离线缓存（秒开）", ctl ? "已开启" : "未开启，彻底关掉 App 再打开一次", !!ctl],
    ["AI 语音多核加速", iso ? `已开启（${navigator.hardwareConcurrency || "?"} 核）` : "未开启，彻底关掉 App 再打开一次", !!iso]
  ];
  box.innerHTML = rows.map(([k, v, good]) => `<div class="perf-row"><span>${k}</span><b class="${good ? "ok" : "mid"}">${esc(String(v))}</b></div>`).join("") +
    `<p class="small muted" style="margin-top:8px">数字是你这台手机上的实测值，多用一会儿会更准。觉得哪里慢，把这一块截图发给我。</p>`;
};

/* ================= AI 发音人 ================= */
document.addEventListener("fluent-neural", () => { if(location.hash === "#me") Views.me.renderVoices(); });
Views.me.renderVoices = function(){
  const box = $("#nv-box"); if(!box) return;
  const eng = Settings.get("engine"), st = Neural.state, cast = Settings.get("cast"), acc = Settings.get("accent");
  const v1 = Settings.get("voice1"), v2 = Settings.get("voice2");
  const dl = Clips.dl, saved = Views.me._clipSaved;
  const mb = b => (b / 1048576).toFixed(b > 10485760 ? 0 : 1) + "MB";
  const clipLine = !Clips.supported() ? `<span class="no">这个浏览器播不了录好的语音</span>，会用现场生成或系统语音。`
    : !Clips.idx ? "正在读取录好的语音列表…"
    : `<span class="ok">句库里 ${Clips.count} 条句子和单词已经提前录好</span>，点了立即播放，不用等生成。`;
  const dlLine = !Clips.idx ? "" : dl ? `正在存到手机… <b>${dl.done}/${dl.total}</b><div class="bar2"><i style="width:${Math.round(dl.done / dl.total * 100)}%"></i></div>`
    : saved !== undefined && saved >= Clips.count ? `<span class="ok">全部录音已存到手机</span>，不联网也能秒播。`
    : `已存到手机 ${saved == null ? "…" : saved} 条（播过的会自动存）。`;
  const status = st === "ready" ? `<span class="ok">现场生成已就绪</span>，离线也能用`
    : st === "loading" ? `正在${store.get("neuralReady") ? "启动" : "下载"}现场生成模型… <b>${Math.round(Neural.progress * 100)}%</b><div class="bar2"><i style="width:${Math.round(Neural.progress * 100)}%"></i></div>`
    : st === "error" ? `<span class="no">模型加载失败</span>：${esc(Neural.error)}<br><span class="small muted">国内网络请先打开 VPN 再重试。</span>`
    : store.get("neuralReady") ? "模型已下载，进入口语教练或连读跟读时自动启动。" : "没下载。下载约 90MB（只下载一次，建议连 Wi-Fi），AI 教练的回复和你自己输入的句子也能用 AI 声音读。";
  box.innerHTML = `
    <div class="seg" id="nv-eng" style="grid-template-columns:1fr 1fr">
      <button class="${eng === "neural" ? "on" : ""}" data-eng="neural">AI 真人语音</button>
      <button class="${eng === "system" ? "on" : ""}" data-eng="system">手机系统语音</button>
    </div>
    <p class="small" style="margin-top:10px">${clipLine}</p>
    ${Clips.idx ? `<p class="small" style="margin-top:6px">${dlLine}</p>` : ""}
    ${Clips.idx && !dl && !(saved >= Clips.count) ? `<button class="btn line sm" style="--c:var(--teal);margin-top:8px" id="nv-dl">全部存到手机${Clips.bytes ? `（约 ${mb(Clips.bytes)}）` : ""}</button>` : ""}
    <div class="field" style="margin-top:14px"><label>现场生成 <span class="small muted">给没录过的句子用</span></label>
      <p class="small">${status}</p>
      ${eng === "neural" && st !== "ready" && st !== "loading" ? `<button class="btn line sm" style="--c:var(--blue);margin-top:8px" id="nv-load">${store.get("neuralReady") ? "现在启动" : st === "error" ? "重新下载" : "下载模型（约 90MB）"}</button>` : ""}
    </div>
    <p class="small muted" style="margin-top:8px">声音来自开源模型 Kokoro，有 ${KOKORO_VOICES.length} 个美音、英音的男女声，比系统语音自然很多。句库里的对话录音时还按每句话的情绪调了语气（开心、惊讶、抱歉、难过、生气、紧张、温柔、小声说等 ${Object.keys(EMOTIONS).length} 种），在句子旁边能看到。没录过、模型也没准备好的句子，会先用手机系统语音马上读出来。</p>
    <div class="field" style="margin-top:8px"><label>怎么分配声音</label>
      <div class="chips" style="flex-wrap:wrap">
        ${[["scene", "按场景分配角色"], ["random", "每句换一个人"], ["fixed", "固定用我选的"]].map(([k, n]) => `<button class="chip${cast === k ? " on" : ""}" data-cast="${k}">${n}</button>`).join("")}
      </div>
      <p class="help">${cast === "scene" ? "比如咖啡店是活泼的店员，机场是英国空乘，约会是轻声细语的女生；对话里的回应会换另一个人说。录好的语音就是按这个分配的。" : cast === "random" ? "每句话随机换一个口音和性别，最能锻炼听不同的人说话。录好的句子会换成同性别的录音人，没录过的组合现场生成。" : "所有句子都用下面选的「主讲」，回应用「对话」那个人。录音里没有这个人说的版本时，要现场生成（会慢一些）。"}</p>
    </div>
    <label class="check" style="margin:4px 0 6px"><input type="checkbox" id="nv-wait" ${Settings.get("aiInstant") === false ? "checked" : ""}> 每句都等 AI 声音准备好再播放（不勾选时，网络慢或还没生成好的句子会先用系统语音马上读出来，反应更快）</label>
    <div class="field"><label>口音</label>
      <div class="chips">${[["both", "美音英音都要"], ["us", "只要美音"], ["gb", "只要英音"]].map(([k, n]) => `<button class="chip${acc === k ? " on" : ""}" data-acc="${k}">${n}</button>`).join("")}</div>
      ${acc === "gb" ? `<p class="help">录好的句子大多是美音，选「只要英音」后这些句子要在手机上现场生成，会慢一些。</p>` : ""}
    </div>
    <div class="field"><label>声音列表 <span class="small muted">点 ▶ 试听</span></label>
      ${KOKORO_VOICES.map(v => `
        <div class="vrow${acc !== "both" && v.accent !== acc ? " dim" : ""}">
          <button class="play sm" data-vtry="${v.id}" style="--c:${v.gender === "f" ? "var(--pink)" : "var(--blue)"}" aria-label="试听 ${esc(v.name)}">${ICON.play}</button>
          <div class="grow"><div><b>${esc(v.name)}</b> <span class="tagv">${v.accent === "us" ? "美音" : "英音"}${v.gender === "f" ? "女" : "男"}</span>${v.fresh ? ` <span class="tagv new">新</span>` : ""}</div><div class="small muted">${esc(v.desc)}</div></div>
          <div class="vpick">
            <button class="chip${v1 === v.id ? " on" : ""}" data-v1="${v.id}">主讲</button>
            <button class="chip${v2 === v.id ? " on" : ""}" data-v2="${v.id}">对话</button>
          </div>
        </div>`).join("")}
    </div>
    <div class="row" style="gap:8px;margin-top:6px"><button class="link" id="nv-clear">清除已生成的语音缓存</button></div>
    <p class="small muted" style="margin-top:8px">Kokoro-82M（Apache-2.0 开源协议）。</p>`;
  const keep = fn => () => { const y = window.scrollY; fn(); this.renderVoices(); window.scrollTo(0, y); };
  $$("#nv-eng button").forEach(b => b.onclick = keep(() => { Settings.set("engine", b.dataset.eng); if(b.dataset.eng === "neural" && store.get("neuralReady")) Neural.load(); }));
  const ld = $("#nv-load"); if(ld) ld.onclick = keep(() => { Neural.worker = null; Neural.state = "off"; Neural.load(); });
  const dlb = $("#nv-dl"); if(dlb) dlb.onclick = keep(() => { Clips.downloadAll().then(st => { Views.me._clipSaved = undefined; if(st) toast(st.failed ? `存好了 ${st.done} 条，${st.failed} 条没下载成功，可以再点一次` : "全部录音已存到手机"); if(location.hash === "#me") this.renderVoices(); }); });
  if(Clips.idx && Views.me._clipSaved === undefined && !dl){ Views.me._clipSaved = null; Clips.saved().then(n => { Views.me._clipSaved = n; if(location.hash === "#me" && !Clips.dl) this.renderVoices(); }); }
  $("#nv-wait").onchange = e => Settings.set("aiInstant", !e.target.checked);
  $$("[data-cast]").forEach(b => b.onclick = keep(() => Settings.set("cast", b.dataset.cast)));
  $$("[data-acc]").forEach(b => b.onclick = keep(() => Settings.set("accent", b.dataset.acc)));
  $$("[data-v1]").forEach(b => b.onclick = keep(() => { Settings.set("voice1", b.dataset.v1); if(Settings.get("cast") !== "fixed") Settings.set("cast", "fixed"); }));
  $$("[data-v2]").forEach(b => b.onclick = keep(() => { Settings.set("voice2", b.dataset.v2); if(Settings.get("cast") !== "fixed") Settings.set("cast", "fixed"); }));
  $$("[data-vtry]").forEach(b => b.onclick = async () => {
    const v = KV[b.dataset.vtry];
    const text = `Hi, I'm ${v.name}. Nice to meet you! Want to grab a coffee sometime?`;
    const rec = Clips.find(text, v.id, true);
    if(!rec && Neural.state !== "ready"){ toast(Neural.state === "loading" ? "AI 语音还在准备，稍等一下" : "录音还没加载好，稍等一下再试"); return; }
    b.classList.add("speaking");
    try{ const my = ++Speech.token; const blob = rec ? await Clips.blob(rec, text) : await Neural.audio(text, v.id, true); if(my === Speech.token) await Neural.play(blob, 1); }catch(e){ toast("试听失败：" + e.message); }
    b.classList.remove("speaking");
  });
  $("#nv-clear").onclick = async () => { await Neural.clearCache(); toast("语音缓存已清除"); };
};
/* ================= AI 批改设置 ================= */
Views.me.renderAI = function(){
  const box = $("#ai-box"); if(!box) return;
  const pv = AI.provider();
  box.innerHTML = `
    <div class="chips">${[["deepseek", "DeepSeek"], ["claude", "Claude"]].map(([k, n]) => `<button class="chip${pv === k ? " on" : ""}" data-aip="${k}">${n}</button>`).join("")}</div>
    <p class="help">口语页的 AI 教练（改成地道说法、接着对话）、看中文说英文后的语法纠错，都用这里选的模型。${pv === "deepseek" ? "DeepSeek 国内能直接用、价格便宜，日常练习每天几分钱。" : "Claude 批改质量好，国内要开 VPN。"}</p>
    ${pv === "deepseek" ? `
      <div class="field"><label for="ai-dskey">DeepSeek API 密钥</label>
        <input type="password" id="ai-dskey" placeholder="sk-…" autocomplete="off" value="${esc(Settings.get("dsKey"))}">
        <p class="help">在 platform.deepseek.com 注册，充值后在「API keys」里创建。和你在电脑上给 DeepSeek Harness 用的可以是同一个密钥。密钥只保存在这台手机上。</p></div>
      <div class="field"><label for="ai-dsmodel">模型</label>
        <select id="ai-dsmodel">${DS_MODELS.map(([k, n]) => `<option value="${k}"${Settings.get("dsModel") === k ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      <details class="small" style="margin:4px 0 8px"><summary class="link">连不上时：填中转地址（一般不用）</summary>
        <p style="margin:8px 0">如果网络正常、测试却一直「连不上」，可能是 DeepSeek 不让网页直接调用。可以在 Cloudflare 免费建一个中转：登录 dash.cloudflare.com →「Workers 和 Pages」→「创建」→「从 Hello World 开始」→ 部署后点「编辑代码」，把下面的代码整段替换进去，再点「部署」，把它的网址（xxx.workers.dev）填到这里。国内访问 workers.dev 可能要开 VPN。</p>
        <textarea rows="7" readonly style="font-family:ui-monospace,monospace;font-size:11px">${esc(DS_PROXY_CODE)}</textarea>
        <div class="field" style="padding-bottom:0"><label for="ai-dsbase">中转地址</label>
          <input type="url" id="ai-dsbase" placeholder="https://xxx.workers.dev（不用就留空）" value="${esc(Settings.get("dsBase"))}"></div>
      </details>` : `
      <div class="field"><label for="ai-key">Anthropic API 密钥</label>
        <input type="password" id="ai-key" placeholder="sk-ant-…" autocomplete="off" value="${esc(Settings.get("apiKey"))}">
        <p class="help">在 console.anthropic.com 注册并充值后，在「API Keys」里创建。按使用量付费，和 Claude 会员是分开的。密钥只保存在这台手机上。</p></div>
      <div class="field"><label for="ai-model">模型</label>
        <select id="ai-model">
          <option value="claude-sonnet-5-5" ${Settings.get("model") === "claude-sonnet-5-5" ? "selected" : ""}>Claude Sonnet 5.5（推荐，质量好）</option>
          <option value="claude-haiku-5-5" ${Settings.get("model") === "claude-haiku-5-5" ? "selected" : ""}>Claude Haiku 5.5（更快更省）</option>
        </select></div>`}
    <p class="help">不填密钥也可以：口语页会把内容复制好，你粘贴到 DeepSeek 或 Claude 的聊天里批改。</p>
    <div class="row" style="padding-top:8px"><button class="btn sm" id="ai-test">测试连接</button><span class="small muted" id="ai-test-res"></span></div>`;
  $$("[data-aip]").forEach(b => b.onclick = () => { Settings.set("aiProvider", b.dataset.aip); this.renderAI(); });
  const bind = (id, key, msg) => { const el = $(id); if(el) el.onchange = e => { Settings.set(key, e.target.value.trim()); if(msg) toast(e.target.value.trim() ? msg : "已清除"); }; };
  bind("#ai-dskey", "dsKey", "密钥已保存"); bind("#ai-dsmodel", "dsModel"); bind("#ai-dsbase", "dsBase", "中转地址已保存");
  bind("#ai-key", "apiKey", "密钥已保存"); bind("#ai-model", "model");
  $("#ai-test").onclick = async () => {
    ["#ai-dskey:dsKey", "#ai-key:apiKey", "#ai-dsbase:dsBase"].forEach(x => { const [id, k] = x.split(":"); const el = $(id); if(el) Settings.set(k, el.value.trim()); });
    const res = $("#ai-test-res");
    if(!AI.ready()){ res.textContent = "先填密钥"; return; }
    res.textContent = "测试中…";
    try{
      const t = await AI.chat({ system: "Reply with a JSON object only.", user: 'Return {"ok": true} as JSON.', maxTokens: 20 });
      res.innerHTML = t ? `<span class="ok">${AI.name()} 连接成功</span>` : `<span class="no">连上了，但没有返回内容</span>`;
    }catch(e){ res.innerHTML = `<span class="no">${esc(e.message)}</span>`; }
  };
};

/* ================= 发音打分设置 ================= */
Views.me.renderPron = function(){
  const box = $("#pron-box"); if(!box) return;
  const key = Settings.get("azureKey"), reg = Settings.get("azureRegion");
  box.innerHTML = `
    <p class="small">${key ? `<span class="ok">已填好 Azure 密钥</span>。跟读、看中文说英文、口语、连读录完音后会自动打分。本月大约用了 ${Pron.usedMin()} 分钟（免费 300 分钟）。` : "填上微软 Azure 的密钥后，每次读完都会给总分、准确、流利、完整、语调的分数，每个词、每个音单独打分，还会告诉你把哪个音读成了什么。免费档每月 5 小时，自己练完全够用。"}</p>
    <div class="field" style="margin-top:10px"><label for="pr-key">Azure 语音密钥</label>
      <input type="password" id="pr-key" placeholder="一串 32 位或更长的字母数字" autocomplete="off" value="${esc(key)}"></div>
    <div class="field"><label for="pr-reg">区域 <span class="small muted">要和创建资源时选的一样</span></label>
      <select id="pr-reg">${AZURE_REGIONS.map(([k, n]) => `<option value="${k}"${k === reg ? " selected" : ""}>${n}（${k}）</option>`).join("")}</select></div>
    <div class="row wrap" style="gap:8px"><button class="btn ghost sm" id="pr-test">${ICON.mic}<span>读一句试试</span></button></div>
    <p class="small" id="pr-res" style="margin-top:8px"></p>
    <div id="pr-out"></div>
    <details class="small" style="margin-top:10px"><summary class="link">怎么申请免费的 Azure 密钥（约 10 分钟）</summary>
      <ol style="padding-left:20px;margin:8px 0;line-height:1.7">
        <li>打开 azure.microsoft.com，点「免费试用」，用微软账号登录（没有就注册一个）。注册要手机号验证，还要绑一张 Visa 或万事达卡验证身份，免费档不会扣钱。</li>
        <li>登录 portal.azure.com，在顶部搜索框搜「语音服务」（Speech services），点「创建」。</li>
        <li>「订阅」选默认的；「资源组」点「新建」随便起个名；「区域」选 East Asia（香港）或 Japan East；「名称」随便填；<b>「定价层」一定选 Free F0</b>。</li>
        <li>点「查看 + 创建」→「创建」，等一分钟部署完成，点「转到资源」。</li>
        <li>左边菜单点「密钥和终结点」，复制「密钥 1」粘贴到上面，「区域」选和第 3 步一样的。</li>
      </ol>
      <span class="muted">国内网络打开 Azure 网站和打分时都建议开 VPN。密钥只保存在这台手机上。</span>
    </details>`;
  $("#pr-key").onchange = e => { Settings.set("azureKey", e.target.value.trim()); toast(e.target.value.trim() ? "密钥已保存" : "已清除密钥"); this.renderPron(); };
  $("#pr-reg").onchange = e => { Settings.set("azureRegion", e.target.value); toast("区域已保存"); };
  $("#pr-test").onclick = async () => {
    Settings.set("azureKey", $("#pr-key").value.trim());
    const res = $("#pr-res"), out = $("#pr-out");
    if(!Pron.ready()){ res.textContent = "先填密钥"; return; }
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    const ref = "Nice to meet you. How was your weekend?";
    res.innerHTML = `请读：<b>${ref}</b>`; out.innerHTML = "";
    activeListen = startListening({ target: ref, onStatus: m => res.innerHTML = `请读：<b>${ref}</b><br>${esc(m)}`, onText: t => res.innerHTML = `请读：<b>${ref}</b><br>听到：${esc(t)}` });
    const r = await activeListen.done; activeListen = null;
    if(!r.audio){ res.textContent = "没录到声音：" + srErrorText(r.error) + (r.error === "switched" ? "" : "（发音打分要用「手机上识别」录音）"); return; }
    res.innerHTML = `请读：<b>${ref}</b>`;
    const ev = await evaluateSpeech(out, r, { ref });
    if(ev && ev.pron) res.innerHTML = `<span class="ok">Azure 打分正常</span>`;
  };
};

/* ================= 跟读识别 ================= */
["fluent-stt", "fluent-mic", "dsh-mic"].forEach(ev => document.addEventListener(ev, () => { if(location.hash === "#me"){ Views.me._micQueried = false; Views.me.renderStt(); } }));
document.addEventListener("visibilitychange", () => {
  if(document.hidden || location.hash !== "#me") return;
  Views.me._micQueried = false;
  Mic.query().then(() => Views.me.renderStt());
});
Views.me.renderStt = function(){
  const box = $("#stt-box"); if(!box) return;
  if(window.DSHREC && window.DSHREC.ready()) Mic.state = "granted";
  if(!this._micQueried){ this._micQueried = true; Mic.query().then(() => this.renderStt()); }
  const eng = Settings.get("srEngine"), now = Listener.engine(), m = Whisper.model(), st = Whisper.state;
  const natMic = window.DSHREC ? !!window.DSHREC.ready() : null;
  const micLine = natMic === true ? `<span class="ok">麦克风已就绪</span>（App 直接录音，不经过浏览器）`
    : !Mic.supported() ? `<span class="no">这个浏览器不能用麦克风</span>${IN_APP_BROWSER ? "，请复制网址到 Safari 或 Chrome 打开" : "，请用 Safari 或 Chrome 打开"}。`
    : Mic.state === "granted" ? `<span class="ok">已允许使用麦克风</span>`
    : Mic.state === "denied" ? `<span class="no">麦克风权限被拒绝了</span><br><span class="small">${esc(MIC_FIX)}</span>`
    : natMic === false ? `App 还没拿到录音权限。点下面「允许使用麦克风」，系统弹窗里选「允许」；没弹窗的话，点「打开系统设置」，把「权限 → 麦克风」打开，回到这里会自动变成已就绪。`
    : `还没允许使用麦克风。点下面的按钮，手机会弹出「允许使用麦克风」，点「允许」。`;
  const model = st === "ready" ? `<span class="ok">识别模型已就绪</span>（${esc(m.name)}）`
    : st === "loading" ? `正在下载识别模型… <b>${Math.round(Whisper.progress * 100)}%</b>（已下载 ${Whisper.gotMb.toFixed(0)}MB / 约${m.mb}MB${Whisper.rate > 0 ? "，" + (Whisper.rate / 1048576).toFixed(1) + "MB/s，还要 " + fmtLeft((m.mb * 1048576 - Whisper.gotMb * 1048576) / Whisper.rate) : ""}）<div class="bar2"><i style="width:${Math.round(Whisper.progress * 100)}%"></i></div><p class="small muted" style="margin-top:6px">${Whisper.src ? "下载源：" + Whisper.src + "。" : ""}页面别关，关了就从头下。</p>`
    : st === "error" ? `<span class="no">模型加载失败</span>：${esc(Whisper.error)}<br><span class="small muted">网络不稳就再点一次；连 Wi-Fi 下载更省流量。</span>`
    : Whisper.downloaded() ? `识别模型已下载（${esc(m.name)}），用的时候自动启动。` : `还没下载（${esc(m.desc)}）。`;
  const nowTxt = now === "local" ? "现在用的是：手机上识别" : now === "system" ? "现在用的是：手机自带识别" : "这个浏览器没法识别";
  const testRow = `<div class="row wrap" style="gap:8px;margin-top:6px"><button class="btn ghost sm" id="stt-test">${ICON.mic}<span>${this._sttTesting ? "说完了" : "说一句试试"}</span></button></div>
    <p class="small" id="stt-res" style="margin-top:10px">${this._sttMsg || ""}</p>`;
  if(NATIVE_ASR){
    /* 安装版：原生录音 + 内置识别，没有模型可选、也不用下载 */
    const np = Mic.nativePerm(), ast = NativeAsr.state();
    let bundledAsr = true; try{ if(typeof window.DSHASR.bundled === "function") bundledAsr = !!window.DSHASR.bundled(); }catch(_){}
    const nm = esc(NativeAsr.name());
    const mic = np === "granted" ? `<span class="ok">麦克风已就绪</span>（App 直接录音）`
      : np === "blocked" ? `<span class="no">麦克风权限被关掉了</span>，系统不会再弹窗。点「打开系统设置」→「权限」→「麦克风」→「允许」，回到这里会自动变成已就绪。`
      : np === "denied" ? `<span class="no">没给麦克风权限</span>。点「允许使用麦克风」，系统弹窗里选「允许」。`
      : `还没给麦克风权限。点「允许使用麦克风」，系统弹窗里选「允许」。`;
    let lm = 0; try{ lm = window.DSHASR.loadMs(); }catch(_){}
    const prog = /^(download|unpacking)/.test(ast) ? +ast.split(":")[1] || 0 : -1;
    const asr = ast === "ready" ? `<span class="ok">识别模型已就绪</span>${lm ? `（这次打开用了 ${(lm / 1000).toFixed(1)} 秒启动）` : ""}`
      : ast === "need-download" ? `识别模型还没下载（约 410MB，只需这一次）。现在用的是移动数据，所以没有自动下载；连上 Wi-Fi 后打开 App 会自动下。`
      : prog >= 0 ? `${esc(NativeAsr.progressText(ast))}<div class="bar2"><i style="width:${prog}%"></i></div>`
      : ast === "loading" || ast === "verifying" ? esc(NativeAsr.progressText(ast))
      : /^error/.test(ast) ? `<span class="no">识别模型没准备好</span>：${esc(ast.replace(/^error:/, ""))}`
      : `识别模型会在用到时自动启动。`;
    const asrBtn = ast === "need-download" ? `<button class="btn line sm" style="--c:var(--blue);margin-top:8px" id="stt-asr-dl">下载识别模型（约 410MB）</button>`
      : /^error/.test(ast) ? `<button class="btn line sm" style="--c:var(--blue);margin-top:8px" id="stt-asr-dl">重新下载 / 启动</button>` : "";
    let ver = ""; try{ ver = `安装包 ${esc(window.DSHAPP.versionName())} · 页面版本 ${window.DSHAPP.webVersion()}${window.DSHAPP.updateNote() ? " · " + esc(window.DSHAPP.updateNote()) : ""}`; }catch(_){}
    box.innerHTML = `
    <p class="small">${mic}</p>
    ${np !== "granted" ? `<div class="row wrap" style="gap:8px;margin-top:8px">${np !== "blocked" ? `<button class="btn line sm" style="--c:var(--green)" id="stt-mic">${ICON.mic}<span>允许使用麦克风</span></button>` : ""}<button class="btn ghost sm" id="stt-settings">打开系统设置</button></div>` : ""}
    <div class="field" style="margin-top:14px"><label>识别模型 <span class="small muted">${nm}</span></label>
      <p class="help">NVIDIA 出的英文识别模型，公开测评里准确度排在最前面一档，比之前要下载的 Whisper「最准」还准，口音和连读也认得出。${bundledAsr ? "它装在安装包里" : "它只在第一次打开时下载一次（约 410MB），以后更新 App 也不用再下"}，在手机上识别：不用联网、不依赖 Google。</p>
      <p class="small" style="margin-top:8px">${asr}</p>
      ${asrBtn}
    </div>
    ${testRow}
    ${ver ? `<p class="small muted" style="margin-top:12px">${ver} <button class="link" id="stt-upd">检查新版</button></p>` : ""}`;
    if(/^(loading|unpacking|download|verifying)/.test(ast) && !this._asrPoll) this._asrPoll = setTimeout(() => { this._asrPoll = null; if(location.hash === "#me") this.renderStt(); }, 1000);
  } else box.innerHTML = `
    <p class="small">${micLine}</p>
    ${Mic.supported() && Mic.state !== "granted" ? `<div class="row wrap" style="gap:8px;margin-top:8px"><button class="btn line sm" style="--c:var(--green)" id="stt-mic">${ICON.mic}<span>允许使用麦克风</span></button>${window.DSHREC && !window.DSHREC.ready() ? `<button class="btn ghost sm" id="stt-ask">重新申请</button><button class="btn ghost sm" id="stt-settings">打开系统设置</button>` : ""}</div>` : ""}
    <div class="field" style="margin-top:14px"><label>用哪种识别 <span class="small muted">${nowTxt}</span></label>
      <div class="chips" style="flex-wrap:wrap">
        ${[["auto", "自动"], ["local", "手机上识别"], ["system", "手机自带识别"]].map(([k, n]) => `<button class="chip${eng === k ? " on" : ""}" data-sre="${k}">${n}</button>`).join("")}
      </div>
      <p class="help">${eng === "auto" ? "先用手机自带的识别；它在这台手机上用不了时（连不上 Google、从主屏幕打开的 iPhone App 等），会在同一次点击里自动换成手机上识别，不用再点第二次。" : eng === "local" ? "App 自己录音，用开源 Whisper 模型在手机上识别。不联网、不依赖 Google 或 Siri，还能回放自己读的。第一次要下载模型。" : "用浏览器自带的识别：安卓靠 Google，iPhone 靠 Siri 听写。识别快、有实时字幕，但有的手机用不了。"}</p>
      ${store.get("srBroken") && eng === "auto" ? `<p class="small muted">之前手机自带识别失败过，所以自动改成了手机上识别。<button class="link" id="stt-retry">再试试自带识别</button></p>` : ""}
    </div>
    ${eng !== "system" ? `<div class="field"><label>手机上识别的模型</label>
      <div class="chips">${Object.entries(STT_MODELS).map(([k, x]) => `<button class="chip${Settings.get("sttModel") === k ? " on" : ""}" data-stm="${k}">${x.name}（${x.mb}MB）</button>`).join("")}</div>
      <p class="small" style="margin-top:8px">${model}</p>
      <p class="small muted" style="margin-top:4px">换一个模型要重新下载一次；「最准」体积最大也最认口音。</p>
      ${st !== "ready" && st !== "loading" ? `<button class="btn line sm" style="--c:var(--blue);margin-top:8px" id="stt-dl">${Whisper.downloaded() ? "现在启动" : st === "error" ? "重新下载" : `下载模型（约 ${m.mb}MB）`}</button>` : ""}
    </div>` : ""}
    ${testRow}`;
  const keep = fn => () => { const y = window.scrollY; fn(); this.renderStt(); window.scrollTo(0, y); };
  const mb = $("#stt-mic"); if(mb) mb.onclick = async () => { const r = await Mic.ensure(); toast(r.ok ? "麦克风已允许" : srErrorText(r.error)); this.renderStt(); };
  const askB = $("#stt-ask"); if(askB) askB.onclick = () => { try { window.DSHREC.ask(); } catch(e) {} setTimeout(() => { this._micQueried = false; this.renderStt(); }, 800); };
  const setB = $("#stt-settings"); if(setB) setB.onclick = () => { try { window.DSHREC.settings(); } catch(e) { toast("打不开设置，请手动去系统设置里找「每日美语」"); } };
  $$("[data-sre]").forEach(b => b.onclick = keep(() => Settings.set("srEngine", b.dataset.sre)));
  $$("[data-stm]").forEach(b => b.onclick = keep(() => { Settings.set("sttModel", b.dataset.stm); if(Whisper.state === "ready" || Whisper.state === "loading") Whisper.reset(); }));
  const dl = $("#stt-dl"); if(dl) dl.onclick = keep(() => Whisper.load());
  const adl = $("#stt-asr-dl"); if(adl) adl.onclick = () => { try{ window.DSHASR.download(); }catch(_){} setTimeout(() => this.renderStt(), 500); };
  const up = $("#stt-upd"); if(up) up.onclick = () => { try{ window.DSHAPP.checkUpdate(); toast("正在检查新版…"); setTimeout(() => this.renderStt(), 6000); }catch(_){} };
  const rt = $("#stt-retry"); if(rt) rt.onclick = keep(() => { store.set("srBroken", false); Listener.fails = 0; });
  const msg = html => { this._sttMsg = html; const el = $("#stt-res"); if(el) el.innerHTML = html; bindMine(); };
  const bindMine = () => { const pm = $("#stt-mine"); if(pm && this._sttAudio) pm.onclick = () => { Speech.stop(); Neural.play(this._sttAudio, 1); }; };
  bindMine();
  $("#stt-test").onclick = async () => {
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    this._sttTesting = true; this._sttAudio = null;
    const lab = $("#stt-test span"); if(lab) lab.textContent = "说完了";
    msg("请说一句英语，比如 “How are you today?”");
    activeListen = startListening({ onStatus: m => msg(esc(m)), onText: t => msg("听到：" + esc(t)) });
    const r = await activeListen.done; activeListen = null;
    this._sttTesting = false; this._sttAudio = r.audio || null;
    const lab2 = $("#stt-test span"); if(lab2) lab2.textContent = "说一句试试";
    msg((r.text ? `<span class="ok">识别正常</span>，听到：“${esc(r.text)}”` : `<span class="no">没识别出来</span>：${esc(srErrorText(r.error))}`) + (r.audio ? ` <button class="chip" id="stt-mine">听我说的</button>` : ""));
    if(location.hash === "#me") this.renderStt();
  };
};

/* 手机上的 AI 模型只在需要现场生成的页面（口语教练、连读跟读）才启动，平时不占手机算力 */
function neuralSoon(){
  if(!Neural.wanted() || !store.get("neuralReady") || Neural.state !== "off") return;
  const boot = () => Neural.load();
  if("requestIdleCallback" in window) requestIdleCallback(boot, { timeout: 3000 }); else setTimeout(boot, 1500);
}

/* ================= 声音检查 ================= */
let lastSoundProblem = null;
document.addEventListener("fluent-voices", () => {
  if(location.hash === "#me"){ Views.me.fillVoices && Views.me.fillVoices(); Views.me.renderDiag(); }
  const sp = soundProblem();
  if(sp !== lastSoundProblem && (location.hash === "#today" || !location.hash)) Views.today.show();
  lastSoundProblem = sp;
});
document.addEventListener("fluent-ttsfail", () => { if(location.hash === "#today" || !location.hash) Views.today.show(); });
function soundProblem(){
  if(!TTS_OK) return "unsupported";
  if(IN_APP_BROWSER) return "inapp";
  if(Speech.loaded && !Speech.voices.length) return "novoice";
  if(Speech.stats.failed && !Speech.stats.started) return "failed";
  return null;
}
const SOUND_FIX = `
  <ol class="fix">
    <li><b>调大媒体音量</b>：按音量键时如果调的是铃声，点一下展开，把「媒体」音量拉高；关掉静音和勿扰模式。iPhone 还要关掉侧边的静音开关。</li>
    <li><b>用 Chrome 或 Safari 打开</b>：微信、QQ 等 App 里的内置浏览器通常不能发声。</li>
    <li><b>安装英文语音</b>（安卓最常见的原因）：小米、华为、荣耀、OPPO、vivo 自带的语音引擎大多只有中文。打开 <b>设置</b>，搜索「<b>文字转语音</b>」，把首选引擎改成「<b>Google 语音服务</b>」（Speech Services by Google）。如果没有这一项，先在 Google Play 安装「Speech Services by Google」，再到引擎设置里下载「英语（美国）」语音数据。</li>
    <li><b>显示「语音引擎出错」</b>：说明引擎里有英文发音人，但语音包没下载，或者它要联网找 Google 而连不上。两个办法任选：① 打开 VPN 再测试；② 在「文字转语音」里点 Google 语音服务旁边的齿轮 › <b>安装语音数据</b> › 英语（美国），下载离线语音包，以后不开 VPN 也能用。</li>
    <li><b>iPhone</b>：设置 › 辅助功能 › 朗读内容 › 声音 › 英语，确认有英语（美国）的声音，没有就下载一个。</li>
    <li>设置好后，把这个 App 彻底关掉再重新打开，回到这里点「测试声音」。</li>
  </ol>`;
Views.me.renderDiag = function(){
  const box = $("#me-diag"); if(!box) return;
  const p = soundProblem();
  const v = Speech.voice();
  const enCount = Speech.voices.length, allCount = Speech.all.length;
  const status = !TTS_OK ? `<span class="no">这个浏览器不支持朗读</span>`
    : !Speech.loaded ? `<span class="mid">正在读取手机里的语音…</span>`
    : enCount ? `<span class="ok">找到 ${enCount} 个英文发音人</span>（共 ${allCount} 个语音）`
    : `<span class="no">手机里没有英文语音</span>（共 ${allCount} 个语音，都不是英文）`;
  box.innerHTML = `
    <p>${status}</p>
    ${v ? `<p class="small muted">当前使用：${esc(v.name)}（${esc(v.lang)}）</p>` : ""}
    ${Speech.all.length ? `<details class="small muted" style="margin-top:4px"><summary>手机里的全部语音</summary>${Speech.all.map(x => `<div>${esc(x.name)}，${esc(x.lang)}，${x.localService ? "本地" : "联网"}${x.default ? "，默认" : ""}</div>`).join("")}</details>` : ""}
    ${IN_APP_BROWSER ? `<p class="err" style="margin-top:6px">你现在是在 App 的内置浏览器里打开的，请复制网址到 Chrome 或 Safari 打开。</p>` : ""}
    ${Speech.stats.lastError ? `<p class="small muted">上次朗读失败的原因：${esc({ "not-allowed": "浏览器拦截了自动朗读，点一下播放按钮再试", nostart: "发出了朗读指令但没有开始播放", "instant-end": "朗读瞬间结束，通常是没有英文语音", unsupported: "浏览器不支持朗读", "synthesis-failed": "语音引擎出错（通常是英文语音包没下载，或者联网语音连不上 Google）", "language-unavailable": "没有英文语音", "voice-unavailable": "选的发音人不可用", "audio-busy": "音频被占用" }[Speech.stats.lastError] || Speech.stats.lastError)}</p>` : ""}
    <div class="row wrap" style="gap:8px;margin-top:12px">
      <button class="btn line sm" style="--c:var(--blue)" id="dg-tts">${ICON.play}<span>测试声音</span></button>
      <button class="btn ghost sm" id="dg-sr">${ICON.mic}<span>测试语音识别</span></button>
    </div>
    <p class="small" id="dg-res" style="margin-top:10px"></p>
    <div id="dg-fix" ${p ? "" : "hidden"}>${SOUND_FIX}</div>
    ${p ? "" : `<button class="link" id="dg-showfix" style="margin-top:6px">听不到声音？看解决办法</button>`}`;
  $("#dg-tts").onclick = async () => {
    const res = $("#dg-res");
    const before = Speech.stats.started;
    res.innerHTML = "正在播放…";
    await Speech.say("Hello! If you can hear me, the sound is working.", 0.95);
    const started = Speech.stats.started > before;
    res.innerHTML = started
      ? `手机已经开始朗读了。<b>能听到吗？</b> <button class="chip" id="dg-yes">能听到</button> <button class="chip" id="dg-no">听不到</button>`
      : `<span class="no">朗读没有开始。</span>按下面的步骤检查。`;
    if(!started) $("#dg-fix").hidden = false;
    const y = $("#dg-yes"), n = $("#dg-no");
    if(y) y.onclick = () => { res.innerHTML = `<span class="ok">声音正常。</span>`; Speech.stats.failed = 0; };
    if(n) n.onclick = () => { res.innerHTML = `朗读在进行但没声音，多半是<b>媒体音量</b>太小或者开了静音，或者引擎里没有英文语音。`; $("#dg-fix").hidden = false; };
  };
  $("#dg-sr").onclick = async () => {
    const res = $("#dg-res");
    if(!Listener.available()){ res.innerHTML = `<span class="no">这个浏览器不支持语音识别，也不能录音。</span>请用 Safari 或 Chrome 打开。`; return; }
    res.innerHTML = "请说一句英语，比如 “How are you today?”…";
    const L = startListening({ onStatus: m => res.textContent = m, onText: t => res.textContent = "听到：" + t });
    setTimeout(() => L.stop(), 6000);
    const r = await L.done;
    res.innerHTML = r.text ? `<span class="ok">语音识别正常</span>，听到：“${esc(r.text)}”` : `<span class="no">识别失败</span>：${esc(srErrorText(r.error))}`;
  };
  const sf = $("#dg-showfix"); if(sf) sf.onclick = () => { $("#dg-fix").hidden = false; sf.remove(); };
};

/* ================= 路由 ================= */
const ROUTES = ["today", "review", "library", "words", "listen", "speak", "link", "me"];
const VIEW_VER = {}, VIEW_SCROLL = {};
const KEEP_VIEWS = new Set(["today", "library", "words", "listen", "speak", "link", "me"]);
let currentView = null;
function route(){
  let v = location.hash.slice(1) || "today";
  if(!ROUTES.includes(v)) v = "today";
  if(currentView) VIEW_SCROLL[currentView] = window.scrollY;
  Speech.stop(); stopActiveListen(); clearInterval(Listen.timer);
  if(Listen.state === "hf" && v !== "listen") Views.listen.stopHF();
  if(Link.recording){ Link.recording = false; clearInterval(Link.recTimer); try{ Link.recorder && Link.recorder.stop(); }catch(_){} Link.stream && Link.stream.getTracks().forEach(t => t.stop()); }
  ROUTES.forEach(x => { const el = $("#v-" + x); if(el) el.hidden = x !== v; });
  const tab = ["review", "library", "words"].includes(v) ? "today" : v;
  $$(".tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
  const mb = $(".me-btn"); if(mb) mb.classList.toggle("on", tab === "me");
  // 数据没变、页面也渲染过：直接显示，不重画（切换标签瞬间完成）
  const ver = store.ver + "|" + dayKey();
  const keep = KEEP_VIEWS.has(v) && VIEW_VER[v] === ver && $("#v-" + v).childElementCount && !(v === "listen" && Listen.state === "hf");
  if(!keep){ Views[v].show(); VIEW_VER[v] = ver; }
  const y = (keep || ["library", "words", "speak", "me"].includes(v)) ? (VIEW_SCROLL[v] || 0) : 0;
  window.scrollTo(0, y);
  currentView = v;
}
// 页面内部交互也会改数据，记下最新版本，避免下次白白重画
document.addEventListener("click", () => { if(currentView) setTimeout(() => { VIEW_VER[currentView] = store.ver + "|" + dayKey(); }, 0); }, true);
// 统计从手指按下到界面更新的时间
let tapAt = 0;
document.addEventListener("pointerdown", () => { tapAt = performance.now(); }, { passive: true, capture: true });
document.addEventListener("click", () => { const t = tapAt; if(t) requestAnimationFrame(() => setTimeout(() => { Perf.add("tap", Math.round(performance.now() - t)); }, 0)); tapAt = 0; });
// 让手机浏览器显示按下效果
document.addEventListener("touchstart", () => {}, { passive: true });
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
try{ route(); }
catch(e){ window.__bootErr = String((e && e.message) || e); console.error("启动失败", e); }
/* 第一屏画出来之后，撤掉 index.html 里的启动画面（出错就留着，让 index.html 里的修复按钮出来） */
try{
  const boot = document.getElementById("boot");
  if(boot && !window.__bootErr) requestAnimationFrame(() => { boot.classList.add("out"); setTimeout(() => boot.remove(), 320); });
}catch(_){}
/* 新版本：每次打开、每次切回 App 都检查一次；新版本装好后在顶部提示，点一下就换上 */
/* 安装版：页面由 App 自己提供和更新（不用 Service Worker）；App 下好新版后通知这里 */
function showUpdateBar(text){
  if(document.getElementById("upd-bar")) return;
  const bar = document.createElement("button");
  bar.id = "upd-bar"; bar.className = "upd-bar";
  bar.textContent = text;
  bar.onclick = () => location.reload();
  document.body.appendChild(bar);
}
if(IS_APP && window.DSHAPP){
  window.addEventListener("dsh-update", () => showUpdateBar("新版本已经下载好，点这里马上换上"));
  try{ navigator.serviceWorker && navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {}); }catch(_){}
}
else if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") check(); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(!hadController) return;
    showUpdateBar("新版本已经下载好，点这里马上换上");
  });
}
Perf.boot = Math.round(performance.now());

/* 按下反馈（v38）：手指一按下就立刻有反应，不依赖 :active */
(function(){
  var sel = "button,a,.chip,.card,.item,.lib-link,.me-btn,.tabs a,.row[data-act],.field";
  var cur = null, t = 0;
  function clear(){ if(cur){ cur.classList.remove("tap"); cur = null; } }
  document.addEventListener("pointerdown", function(e){
    var el = e.target && e.target.closest ? e.target.closest(sel) : null;
    if(!el) return;
    if(cur && cur !== el) cur.classList.remove("tap");
    el.classList.add("tap"); cur = el;
    clearTimeout(t); t = setTimeout(clear, 240);
  }, { passive: true });
  document.addEventListener("pointerup", function(){
    clearTimeout(t); t = setTimeout(clear, 90);
  }, { passive: true });
  document.addEventListener("pointercancel", clear, { passive: true });
})();