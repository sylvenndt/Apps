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
async function playWith(btn, text, rate){
  $$(".play.speaking").forEach(b => b.classList.remove("speaking"));
  btn && btn.classList.add("speaking");
  const ok = await Speech.say(text, rate);
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
      <p class="small muted" style="margin-top:18px">每天按顺序走完这四站：先复习巩固，再练听力反应，然后开口表达，最后打磨发音。</p>`;
  }
};

/* ================= 复习 ================= */
const Review = { queue: null, day: null, idx: 0, done: 0, revealed: false };
Views.review = {
  show(){
    if(!Review.queue || Review.day !== dayKey() || Review.idx >= Review.queue.length){
      Review.queue = [...SRS.dueIds(), ...SRS.newIds(Settings.get("newPerDay"))];
      Review.day = dayKey(); Review.idx = 0; Review.done = 0;
    }
    this.render();
  },
  render(){
    const v = $("#v-review");
    const id = Review.queue[Review.idx];
    const card = id && Cards.get(id);
    if(!card){
      v.innerHTML = `
        <div class="row" style="margin-bottom:18px"><a class="icon-btn" href="#today" aria-label="返回">${ICON.back}</a><h2 style="margin:0">复习</h2></div>
        <div class="empty">
          <div class="big">今天的复习完成了</div>
          <p class="muted">${Review.done ? `这一轮复习了 ${Review.done} 次。` : ""}明天会自动安排新的到期句子。</p>
          <div class="row" style="justify-content:center;margin-top:20px;gap:10px">
            <a class="btn line" style="--c:var(--orange)" href="#listen">去练听力</a>
            <a class="btn ghost" href="#today">回到今日</a>
          </div>
        </div>`;
      return;
    }
    Review.revealed = false;
    const isNew = !SRS.all()[id];
    const sc = SCENE_BY_KEY[card.scene];
    const left = Review.queue.length - Review.idx;
    v.innerHTML = `
      <div class="row between" style="margin-bottom:6px">
        <div class="row"><a class="icon-btn" href="#today" aria-label="返回">${ICON.back}</a><h2 style="margin:0">复习</h2></div>
        <span class="small muted">还剩 ${left} 句</span>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="row">${bulletHTML(card.scene)}<span class="small muted">${sc ? esc(sc.name) : "我的句子"}${isNew ? "，新句" : ""}</span></div>
        <button class="play" id="rv-play" style="--c:var(--blue)" aria-label="播放">${ICON.play}</button>
        <p class="small muted" style="text-align:center" id="rv-tip">只听，别翻译。试着直接想到画面，或者想好怎么回应。</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px">
          <button class="chip" id="rv-slow">慢速</button>
          <button class="chip" id="rv-chunks">按意群播放</button>
          <button class="chip" id="rv-reveal">显示英文</button>
        </div>
        <div id="rv-text" hidden style="margin-top:18px">
          <div class="en">${renderEn(card.chunks)}</div>
          <p class="zh blur" id="rv-zh" style="margin-top:6px" title="点一下显示中文">${esc(card.zh || "（没有中文）")}</p>
          ${card.reply ? `<div class="row" style="margin-top:14px;align-items:flex-start">
            <button class="play sm" id="rv-reply" style="--c:var(--ink)" aria-label="播放回应">${ICON.play}</button>
            <div><div class="small muted">对方可能这样回</div><div style="font-weight:600">${esc(card.reply)}</div></div></div>` : ""}
          <div class="row" style="margin-top:14px">
            <button class="btn soft sm" id="rv-shadow">${ICON.mic}<span>跟读</span></button>
            <span class="small muted grow" id="rv-shadow-res"></span>
          </div>
        </div>
      </div>
      <div id="rv-grades" style="margin-top:16px" hidden>
        <p class="small muted" style="margin-bottom:8px">刚才只听的时候，你听懂了吗？</p>
        <div class="grades">
          ${["没听懂", "有点难", "听懂了", "太简单"].map((g, k) => {
            const days = SRS.preview(id, k);
            return `<button class="grade g${k}" data-g="${k}"><b>${g}</b><span>${days ? days + " 天后" : "马上再来"}</span></button>`;
          }).join("")}
        </div>
      </div>`;
    const play = $("#rv-play");
    play.onclick = () => playWith(play, card.en);
    $("#rv-slow").onclick = () => playWith(play, card.en, Math.max(0.5, Settings.get("speed") - 0.3));
    $("#rv-chunks").onclick = async () => { play.classList.add("speaking"); await Speech.chunks(card.chunks, Math.max(0.6, Settings.get("speed") - 0.1)); play.classList.remove("speaking"); };
    $("#rv-reveal").onclick = () => this.reveal();
    $("#rv-zh").onclick = e => e.currentTarget.classList.toggle("show");
    const rp = $("#rv-reply"); if(rp) rp.onclick = () => playWith(rp, card.reply);
    $("#rv-shadow").onclick = () => this.shadow(card);
    $$("#rv-grades .grade").forEach(b => b.onclick = () => this.grade(id, +b.dataset.g));
    setTimeout(() => { if(location.hash === "#review") playWith(play, card.en); }, 250);
  },
  reveal(){
    Review.revealed = true;
    $("#rv-text").hidden = false; $("#rv-grades").hidden = false;
    $("#rv-reveal").remove(); $("#rv-tip").hidden = true;
  },
  async shadow(card){
    const btn = $("#rv-shadow"), res = $("#rv-shadow-res");
    if(activeListen){ stopActiveListen(); return; }
    Speech.stop();
    btn.innerHTML = `${ICON.stop}<span>说完点这里</span>`;
    res.textContent = "请跟读…";
    activeListen = startListening({ target: card.en, onText: t => res.textContent = t });
    const r = await activeListen.done; activeListen = null;
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

/* ================= 听力直通 ================= */
const Listen = { state: "setup", scene: "all", qs: [], i: 0, results: [], timer: null, t0: 0, answered: false };
Views.listen = {
  show(){ if(Listen.state === "q") this.renderQ(); else if(Listen.state === "done") this.renderDone(); else this.renderSetup(); },
  renderSetup(){
    Listen.state = "setup";
    const rs = Settings.get("reactSec");
    $("#v-listen").innerHTML = `
      <h1>听力直通</h1>
      <p class="muted" style="margin:8px 0 20px">只放声音，选项全是英文，听完要马上选。没有时间翻译，大脑只能直接抓意思，练多了就能“听到即懂”。</p>
      <h3>场景</h3>
      <div class="chips" id="ls-scenes">
        <button class="chip${Listen.scene === "all" ? " on" : ""}" data-s="all">全部混合</button>
        ${SCENES.map(s => `<button class="chip${Listen.scene === s.key ? " on" : ""}" data-s="${s.key}"><i class="mini-bullet" style="--c:${s.color}"></i>${esc(s.name)}</button>`).join("")}
      </div>
      <h3>反应时间</h3>
      <div class="chips" id="ls-react">
        ${[[12, "宽松 12 秒"], [8, "标准 8 秒"], [5, "挑战 5 秒"]].map(([s, l]) => `<button class="chip${rs === s ? " on" : ""}" data-r="${s}">${l}</button>`).join("")}
      </div>
      <h3>语速</h3>
      <div class="speed"><input type="range" id="ls-speed" min="0.5" max="1.4" step="0.05" value="${Settings.get("speed")}" aria-label="语速"><b id="ls-speed-v">${Settings.get("speed").toFixed(2)}×</b></div>
      <button class="btn line block" style="--c:var(--orange);margin-top:26px;padding:15px" id="ls-start">开始 10 题</button>
      <p class="small muted" style="margin-top:12px">答错或超时的句子会自动加入复习。</p>`;
    $$("#ls-scenes .chip").forEach(b => b.onclick = () => { Listen.scene = b.dataset.s; $$("#ls-scenes .chip").forEach(x => x.classList.toggle("on", x === b)); });
    $$("#ls-react .chip").forEach(b => b.onclick = () => { Settings.set("reactSec", +b.dataset.r); $$("#ls-react .chip").forEach(x => x.classList.toggle("on", x === b)); });
    $("#ls-speed").oninput = e => { Settings.set("speed", +e.target.value); $("#ls-speed-v").textContent = (+e.target.value).toFixed(2) + "×"; };
    $("#ls-start").onclick = () => this.start();
  },
  start(){
    const pool = Listen.scene === "all" ? ALL_ITEMS : ALL_ITEMS.filter(x => x.scene === Listen.scene);
    const picks = shuffle(pool).slice(0, 10);
    Listen.qs = picks.map((it, k) => {
      const type = (k % 5 === 2 || k % 5 === 4) && Listen.scene === "all" ? "scene" : "reply";
      let opts;
      if(type === "reply"){
        const others = shuffle(ALL_ITEMS.filter(x => x.scene !== it.scene)).slice(0, 3).map(x => x.reply);
        opts = shuffle([it.reply, ...others]);
        return { it, type, opts, ans: it.reply };
      }
      const others = shuffle(SCENES.filter(s => s.key !== it.scene)).slice(0, 3).map(s => s.en);
      opts = shuffle([SCENE_BY_KEY[it.scene].en, ...others]);
      return { it, type, opts, ans: SCENE_BY_KEY[it.scene].en };
    });
    Listen.i = 0; Listen.results = []; Listen.state = "q";
    this.renderQ();
  },
  renderQ(){
    const q = Listen.qs[Listen.i];
    if(!q){ this.finish(); return; }
    Listen.answered = false; Listen.t0 = 0;
    clearInterval(Listen.timer);
    const v = $("#v-listen");
    v.innerHTML = `
      <div class="row between">
        <button class="icon-btn" id="ls-quit" aria-label="退出">${ICON.x}</button>
        <span class="small muted">${Listen.i + 1} / ${Listen.qs.length}</span>
      </div>
      <div class="progress" style="margin-top:14px">${Listen.qs.map((_, k) => `<i class="${k < Listen.results.length ? (Listen.results[k].ok ? "ok" : "no") : k === Listen.i ? "cur" : ""}"></i>`).join("")}</div>
      <p style="text-align:center;font-weight:700">${q.type === "reply" ? "对方这样说，你会怎么回？" : "这句话最可能在哪里听到？"}</p>
      <button class="play" id="ls-play" style="--c:var(--orange)" aria-label="播放">${ICON.play}</button>
      <div class="timer"><i id="ls-timer"></i></div>
      <div class="opts" id="ls-opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div>
      <div id="ls-fb" style="margin-top:16px"></div>`;
    $("#ls-quit").onclick = () => { clearInterval(Listen.timer); Speech.stop(); this.renderSetup(); };
    const play = $("#ls-play");
    play.onclick = () => playWith(play, q.it.en);
    $$("#ls-opts .opt").forEach(b => b.onclick = () => this.answer(+b.dataset.k));
    (async () => {
      await sleep(300);
      const ok = await playWith(play, q.it.en);
      if(ok && !Listen.answered && Listen.state === "q") this.startTimer();
    })();
  },
  startTimer(){
    const total = Settings.get("reactSec") * 1000, bar = $("#ls-timer");
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
    $("#ls-fb").innerHTML = `
      <p>${head}</p>
      <div class="panel" style="margin-top:10px">
        <div class="en" style="font-size:20px">${renderEn(q.it.chunks)}</div>
        <p class="zh blur" id="ls-zh" style="margin-top:4px">${esc(q.it.zh)}</p>
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
    $("#ls-save").onclick = e => { SRS.schedule(q.it.id, Date.now()); e.currentTarget.textContent = "已加入"; e.currentTarget.disabled = true; };
    if(!ok){ const s = $("#ls-save"); s.textContent = "已加入"; s.disabled = true; }
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
        <div class="stat"><b class="${okN >= 8 ? "ok" : okN >= 6 ? "mid" : "no"}">${okN}/${r.length}</b><span>答对</span></div>
        <div class="stat"><b>${avg ? avg.toFixed(1) + "s" : "—"}</b><span>平均反应</span></div>
        <div class="stat"><b>${r.length - okN}</b><span>加入复习</span></div>
      </div>
      <p class="muted">${okN === r.length ? (avg && avg < 3 ? "又快又准。下一组试试「挑战 5 秒」，或者调快语速。" : "全对了！下一组试着更快作答。") : "答错的句子已经放进复习，明天会再遇到它们。"}</p>
      <div class="stack" style="margin-top:22px">
        <button class="btn line block" style="--c:var(--orange);padding:14px" id="ls-more">再来一组</button>
        <a class="btn ghost block" href="#today">回到今日</a>
      </div>`;
    $("#ls-more").onclick = () => this.start();
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

/* ================= 连读 ================= */
const Link = { tokens: [], links: [], text: LINK_PRESETS[0], recorder: null, stream: null, chunks: [], recDone: null, recogDone: null, recording: false, recTimer: null };
Views.link = {
  show(){
    $("#v-link").innerHTML = `
      <h1>连读跟读</h1>
      <p class="muted" style="margin:8px 0 16px">自动标出连读点，听美音示范，录下你读的，检查哪里没连上、哪里断开了。</p>
      <div class="chips" id="lk-presets">${LINK_PRESETS.map((p, i) => `<button class="chip${p === Link.text ? " on" : ""}" data-i="${i}">${esc(p)}</button>`).join("")}</div>
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
    $$("#lk-presets .chip").forEach(b => b.onclick = () => { Link.text = LINK_PRESETS[+b.dataset.i]; $("#lk-input").value = Link.text; $$("#lk-presets .chip").forEach(c => c.classList.toggle("on", c === b)); this.renderSentence(); });
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
const ROUTES = ["today", "review", "listen", "speak", "link", "me"];
function route(){
  let v = location.hash.slice(1) || "today";
  if(!ROUTES.includes(v)) v = "today";
  Speech.stop(); stopActiveListen(); clearInterval(Listen.timer);
  if(Link.recording){ Link.recording = false; clearInterval(Link.recTimer); try{ Link.recorder && Link.recorder.stop(); }catch(_){} Link.stream && Link.stream.getTracks().forEach(t => t.stop()); }
  ROUTES.forEach(x => $("#v-" + x).hidden = x !== v);
  const tab = v === "review" ? "today" : v;
  $$(".tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
  Views[v].show();
  window.scrollTo(0, 0);
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-act='today-topic']");
  if(a){ Speak.topic = topicOfDay(); Speak.custom = null; Speak.turns = []; if(location.hash === "#speak"){ e.preventDefault(); route(); } }
});
window.addEventListener("hashchange", route);
route();
if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
