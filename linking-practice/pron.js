"use strict";
/* 读完之后的评价：
   ① 发音打分：微软 Azure 发音评测。拿录音和「应该读的句子」对比，给总分、准确、流利、完整、语调，
      每个词、每个音都有分数，还能听出你把哪个音读成了什么。免费档每月 5 小时。
   ② 语法纠错：用 Claude（「我的」里填的 Anthropic 密钥），改语法、换更地道的说法。 */
const AZURE_REGIONS = [
  ["eastasia", "东亚（香港）"], ["japaneast", "日本东部"], ["southeastasia", "东南亚（新加坡）"],
  ["eastus", "美国东部"], ["westus2", "美国西部 2"], ["westeurope", "西欧"]
];
const SPEECH_SDK_URLS = [
  "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.52.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js",
  "https://unpkg.com/microsoft-cognitiveservices-speech-sdk@1.52.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"
];
const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
const paOf = o => (o && o.PronunciationAssessment) || o || {};
const monthKey = () => "azureSec:" + dayKey().slice(0, 7);

const Pron = {
  ready(){ return !!Settings.get("azureKey"); },
  usedMin(){ return Math.round((store.get(monthKey(), 0) || 0) / 60); },
  params(ref){
    return { ReferenceText: ref, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive",
      EnableMiscue: true, EnableProsodyAssessment: true, PhonemeAlphabet: "IPA", NBestPhonemeCount: 3 };
  },
  /* wav：16kHz 单声道 WAV；ref：应该读的句子 */
  async assess(wav, ref, seconds){
    if(!this.ready()) throw new Error("还没填 Azure 密钥");
    ref = String(ref || "").trim();
    if(!ref) throw new Error("没有可以对照的句子");
    let json;
    try{ json = await this.rest(wav, ref); }
    catch(e){
      if(e.http) throw e;               // 服务器明确拒绝（密钥不对等），换方法也没用
      json = await this.sdk(wav, ref);  // 网络被拦（比如浏览器跨域限制），改用微软的官方程序再试
    }
    if(seconds) store.set(monthKey(), (store.get(monthKey(), 0) || 0) + seconds);
    return normalizePron(json);
  },
  async rest(wav, ref){
    const url = `https://${Settings.get("azureRegion")}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
    let r;
    try{
      r = await fetch(url, { method: "POST", headers: {
        "Ocp-Apim-Subscription-Key": Settings.get("azureKey"),
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
        "Pronunciation-Assessment": b64utf8(JSON.stringify(this.params(ref)))
      }, body: wav });
    }catch(e){ const err = new Error("连不上微软的服务器"); err.net = true; throw err; }
    if(!r.ok){
      const msg = { 400: "请求格式不对", 401: "Azure 密钥不对，或者「区域」选得和创建资源时不一样", 403: "这个密钥没有权限，或者免费额度用完了", 429: "点得太快了，免费档每分钟最多 20 次，稍等一下" }[r.status] || ("Azure 返回错误 " + r.status);
      const err = new Error(msg); err.http = r.status; throw err;
    }
    return r.json();
  },
  sdkLoading: null,
  loadSdk(){
    if(window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
    if(this.sdkLoading) return this.sdkLoading;
    this.sdkLoading = (async () => {
      for(const u of SPEECH_SDK_URLS){
        try{
          await new Promise((res, rej) => { const s = document.createElement("script"); s.src = u; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
          if(window.SpeechSDK) return window.SpeechSDK;
        }catch(_){}
      }
      this.sdkLoading = null;
      throw new Error("连不上微软的服务器（国内网络请打开 VPN）");
    })();
    return this.sdkLoading;
  },
  async sdk(wav, ref){
    const S = await this.loadSdk();
    const cfg = S.SpeechConfig.fromSubscription(Settings.get("azureKey"), Settings.get("azureRegion"));
    cfg.speechRecognitionLanguage = "en-US";
    cfg.outputFormat = S.OutputFormat.Detailed;
    const audio = S.AudioConfig.fromWavFileInput(new File([wav], "speech.wav", { type: "audio/wav" }));
    const pa = S.PronunciationAssessmentConfig.fromJSON(JSON.stringify(this.params(ref)));
    const rec = new S.SpeechRecognizer(cfg, audio);
    pa.applyTo(rec);
    return await new Promise((res, rej) => {
      rec.recognizeOnceAsync(r => {
        try{ rec.close(); }catch(_){}
        if(r.reason === S.ResultReason.Canceled){
          const c = S.CancellationDetails.fromResult(r);
          rej(new Error(/401|auth/i.test(c.errorDetails || "") ? "Azure 密钥不对，或者「区域」选得不对" : "Azure 打分失败：" + (c.errorDetails || "未知原因")));
          return;
        }
        const j = r.properties.getProperty(S.PropertyId.SpeechServiceResponse_JsonResult);
        try{ res(JSON.parse(j)); }catch(e){ rej(new Error("Azure 返回的结果看不懂")); }
      }, e => { try{ rec.close(); }catch(_){} rej(new Error("Azure 打分失败：" + e)); });
    });
  }
};

/* 把 Azure 两种接口返回的格式统一成一种 */
function normalizePron(j){
  const status = j.RecognitionStatus || (j.NBest ? "Success" : "");
  if(status && status !== "Success"){
    const err = new Error({ NoMatch: "Azure 没听出你说了什么，靠近麦克风、读清楚一点再试", InitialSilenceTimeout: "录音开头太安静了，再试一次", BabbleTimeout: "背景太吵了，换个安静的地方" }[status] || "Azure 没能打分（" + status + "）");
    err.nomatch = true; throw err;
  }
  const nb = (j.NBest || [])[0];
  if(!nb) throw new Error("Azure 没返回打分结果");
  const top = paOf(nb);
  const words = (nb.Words || []).map(w => {
    const a = paOf(w), fb = (a.Feedback || w.Feedback || {}).Prosody || {};
    const brk = ((fb.Break || {}).ErrorTypes || []), ito = ((fb.Intonation || {}).ErrorTypes || []);
    return {
      w: w.Word, acc: Math.round(a.AccuracyScore ?? 0), err: a.ErrorType || "None",
      brk: brk.includes("UnexpectedBreak") ? "unexpected" : brk.includes("MissingBreak") ? "missing" : "",
      mono: ito.includes("Monotone"),
      phon: (w.Phonemes || []).map(p => {
        const pp = paOf(p), nbp = pp.NBestPhonemes || p.NBestPhonemes || [];
        const best = nbp[0] && nbp[0].Phoneme;
        return { p: p.Phoneme, acc: Math.round(pp.AccuracyScore ?? 0), heard: best && best !== p.Phoneme ? best : "" };
      })
    };
  });
  const r = v => v == null ? null : Math.round(v);
  return { total: r(top.PronScore), acc: r(top.AccuracyScore), flu: r(top.FluencyScore), comp: r(top.CompletenessScore), pros: r(top.ProsodyScore),
    text: nb.Display || j.DisplayText || "", words };
}

/* 中国人常见的发音难点 */
const PHONE_TIPS = {
  "θ": "舌尖轻轻放在上下牙之间往外送气，不要读成 s 或 f",
  "ð": "舌尖放在上下牙之间，同时喉咙振动，不要读成 d 或 z",
  "v": "上齿轻碰下唇，喉咙振动，不要读成 w",
  "w": "双唇收圆往前突再放开，上齿不要碰嘴唇",
  "ɹ": "舌尖往后卷但不碰上颚，嘴唇微微收圆，不要读成 l",
  "r": "舌尖往后卷但不碰上颚，嘴唇微微收圆，不要读成 l",
  "l": "舌尖顶住上齿后面；在词尾时像一个轻轻的「欧」，不要吞掉",
  "æ": "嘴张大、嘴角往两边拉，介于「啊」和「诶」之间，不要读成「诶」",
  "ɛ": "像「诶」但更短，嘴比 æ 小",
  "ɪ": "短而放松，嘴角不要拉开；和长音 i（像 see）不一样",
  "i": "长音，嘴角往两边拉开，拖长一点",
  "ʊ": "短而放松的「乌」，嘴唇不要太圆",
  "u": "长音「乌」，嘴唇收圆往前",
  "ʌ": "短促的「阿」，嘴半开、放松",
  "ɑ": "嘴张大、舌头放低，像拉长的「啊」",
  "ɔ": "嘴唇稍圆，像「奥」",
  "ə": "弱读，轻轻带过，嘴巴放松，不要读重",
  "ɝ": "舌尖往后卷，像「饿」和「儿」一起发",
  "ɚ": "舌尖往后卷的轻读「儿」",
  "eɪ": "从「诶」滑到「一」，要有滑动",
  "aɪ": "从「啊」滑到「一」",
  "oʊ": "从「欧」滑到「乌」，嘴唇收圆，不要读成「奥」",
  "aʊ": "从「啊」滑到「乌」",
  "ɔɪ": "从「奥」滑到「一」",
  "ŋ": "舌根抵住上颚后部，声音从鼻子出来，像「嗯」的尾音；不要后面加 g",
  "n": "舌尖顶住上齿后面，声音从鼻子出来；词尾不要读成 ŋ",
  "m": "双唇闭上，声音从鼻子出来；词尾要把嘴闭上",
  "z": "和 s 口型一样，但喉咙要振动",
  "s": "舌尖靠近上齿后面送气，不要读成 sh",
  "ʃ": "嘴唇微微往前突，像「嘘」",
  "ʒ": "和 ʃ 口型一样，喉咙振动",
  "tʃ": "像「吃」，嘴唇往前突",
  "dʒ": "像「知」，喉咙振动",
  "h": "轻轻呼气，不要发成喉咙里的「喝」",
  "j": "像「耶」开头那个音",
  "f": "上齿轻碰下唇吹气",
  "p": "双唇闭紧再爆开；在词尾时要轻轻发出来，不要加「呃」",
  "b": "双唇闭紧再爆开，喉咙振动；词尾不要加「呃」",
  "t": "舌尖顶上齿后面再弹开；美国人在词尾常只做口型不爆破，但不能整个吞掉",
  "d": "舌尖顶上齿后面再弹开，喉咙振动；词尾不要加「呃」",
  "k": "舌根顶住上颚后部再放开；词尾要轻轻发出来",
  "g": "舌根顶住上颚后部再放开，喉咙振动"
};
const tipOf = p => PHONE_TIPS[p] || PHONE_TIPS[String(p).replace(/ː/g, "")] || "跟着示范多听几遍，注意口型";
const scoreCls = v => v == null ? "" : v >= 80 ? "ok" : v >= 60 ? "mid" : "no";

const PronUI = {
  /* 总结最该改的几个问题 */
  issues(res){
    const out = [];
    const bad = new Map();
    res.words.forEach(w => {
      if(w.err === "Omission" || w.err === "Insertion") return;
      w.phon.forEach(p => {
        if(p.acc >= 60) return;
        const k = p.p; const e = bad.get(k) || { p: k, n: 0, min: 100, words: [], heard: {} };
        e.n++; e.min = Math.min(e.min, p.acc); if(!e.words.includes(w.w)) e.words.push(w.w); if(p.heard) e.heard[p.heard] = (e.heard[p.heard] || 0) + 1;
        bad.set(k, e);
      });
    });
    [...bad.values()].sort((a, b) => b.n - a.n || a.min - b.min).slice(0, 3).forEach(e => {
      const h = Object.entries(e.heard).sort((a, b) => b[1] - a[1])[0];
      out.push(`<b>/${esc(e.p)}/</b>（${e.words.slice(0, 3).map(esc).join("、")}）${h ? `听起来像 /${esc(h[0])}/。` : "不够准。"}${esc(tipOf(e.p))}`);
    });
    const om = res.words.filter(w => w.err === "Omission").map(w => w.w);
    if(om.length) out.push(`漏读了：<b>${om.slice(0, 5).map(esc).join("、")}</b>。小词也要读出来，可以弱读，但不能没有。`);
    const ins = res.words.filter(w => w.err === "Insertion").map(w => w.w);
    if(ins.length) out.push(`多读了：<b>${ins.slice(0, 5).map(esc).join("、")}</b>。`);
    const brk = res.words.filter(w => w.brk === "unexpected").map(w => w.w);
    if(brk.length) out.push(`在 <b>${brk.slice(0, 3).map(esc).join("、")}</b> 前面停顿了，同一个意群里要一口气连着说。`);
    const miss = res.words.filter(w => w.brk === "missing").map(w => w.w);
    if(miss.length) out.push(`<b>${miss.slice(0, 3).map(esc).join("、")}</b> 后面应该稍微停一下（逗号、句号或者意群的边界）。`);
    if(res.words.some(w => w.mono)) out.push("语调太平了。英语句子里重要的词要读得更重、更高，句尾问句上扬、陈述句下降。");
    return out;
  },
  html(res, opts = {}){
    const bars = [["准确", res.acc], ["流利", res.flu], ["完整", res.comp], ["语调", res.pros]].filter(x => x[1] != null);
    const iss = this.issues(res);
    return `<div class="pron${opts.compact ? " compact" : ""}">
      <div class="pron-top">
        <div class="pron-total ${scoreCls(res.total)}"><b>${res.total ?? "—"}</b><span>发音总分</span></div>
        <div class="pron-bars">${bars.map(([k, v]) => `<div class="pb"><span>${k}</span><i><em class="${scoreCls(v)}" style="width:${Math.max(4, v)}%"></em></i><b class="${scoreCls(v)}">${v}</b></div>`).join("")}</div>
      </div>
      <p class="pron-words">${res.words.map((w, i) => `${w.brk === "unexpected" ? `<span class="pbrk" title="多余的停顿">‖</span>` : ""}<button class="pw ${w.err === "Omission" ? "om" : w.err === "Insertion" ? "ins" : scoreCls(w.acc)}" data-pw="${i}">${esc(w.w)}</button>`).join(" ")}</p>
      <p class="small muted">点单词看每个音的得分。绿色 80 分以上，黄色 60–79，红色要多练${res.words.some(w => w.err === "Omission") ? "，划掉的是漏读的词" : ""}。</p>
      <div class="pron-detail" hidden></div>
      ${iss.length ? `<div class="pron-tips"><div class="small muted" style="margin-bottom:4px">最该改的</div>${iss.map(x => `<p>${x}</p>`).join("")}</div>` : `<p class="pron-good">每个音都读得很准，继续保持。</p>`}
    </div>`;
  },
  bind(box, res){
    const det = box.querySelector(".pron-detail");
    box.querySelectorAll("[data-pw]").forEach(b => b.onclick = () => {
      const w = res.words[+b.dataset.pw];
      box.querySelectorAll("[data-pw]").forEach(x => x.classList.toggle("sel", x === b));
      const worst = [...w.phon].sort((a, c) => a.acc - c.acc)[0];
      det.hidden = false;
      det.innerHTML = w.err === "Omission" ? `<b>${esc(w.w)}</b>：漏读了。`
        : `<div class="row wrap" style="gap:6px;align-items:center"><b style="margin-right:4px">${esc(w.w)}</b> <span class="small muted">${w.acc} 分</span>
            ${w.phon.map(p => `<span class="pp ${scoreCls(p.acc)}">/${esc(p.p)}/ ${p.acc}${p.heard && p.acc < 80 ? `<small>像 /${esc(p.heard)}/</small>` : ""}</span>`).join("")}</div>
           ${worst && worst.acc < 80 ? `<p class="small" style="margin-top:6px"><b>/${esc(worst.p)}/</b>：${esc(tipOf(worst.p))}</p>` : ""}
           <div class="row" style="gap:8px;margin-top:8px"><button class="chip" data-say="${esc(w.w)}">听这个词</button></div>`;
      const sb = det.querySelector("[data-say]"); if(sb) sb.onclick = () => playWith(null, sb.dataset.say);
    });
  }
};

/* ---------- 语法纠错（Claude） ---------- */
const FIX_SYSTEM = `You check a Chinese learner's spoken English sentence.
Input JSON: "meaning_zh" (what they wanted to say, in Chinese; may be empty), "model_answer" (one natural English way to say it; may be empty), "said" (what speech recognition heard; it may contain small recognition mistakes — ignore obvious ones).
Judge whether "said" is correct, natural spoken American English that expresses the meaning. A different wording than model_answer is fine if it's natural.
Reply with ONLY a JSON object, no markdown:
{"verdict": "perfect" | "good" | "fix", "corrected": string (the learner's sentence fixed with minimal changes; same as said if nothing to fix), "natural": string (how an American would most naturally say it), "errors": [{"from": string, "to": string, "why": string}] (max 3; "why" in Simplified Chinese, short, about grammar or word choice), "tip": string (one short encouraging sentence in Simplified Chinese)}`;
async function grammarFix({ said, zh, model }){
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": Settings.get("apiKey"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: Settings.get("model"), max_tokens: 600, system: FIX_SYSTEM, messages: [{ role: "user", content: JSON.stringify({ meaning_zh: zh || "", model_answer: model || "", said }) }] })
  }).catch(() => { throw new Error("连不上 Anthropic 的服务器"); });
  if(!resp.ok) throw new Error(resp.status === 401 ? "Anthropic 密钥不对" : "Claude 返回错误 " + resp.status);
  const j = await resp.json();
  const t = (j.content || []).map(c => c.text || "").join("").trim();
  const m = t.match(/\{[\s\S]*\}/);
  if(!m) throw new Error("Claude 的回复看不懂");
  return JSON.parse(m[0]);
}
function fixHTML(f, said){
  const badge = { perfect: ["ok", "完全正确"], good: ["ok", "意思对，可以更地道"], fix: ["no", "有需要改的地方"] }[f.verdict] || ["mid", "看看建议"];
  return `<div class="gfix">
    <div class="row" style="gap:8px;align-items:center"><span class="small muted">语法和用词</span><b class="${badge[0]}">${badge[1]}</b></div>
    ${f.verdict !== "perfect" && f.corrected && f.corrected !== said ? `<p class="gfix-line"><span class="small muted">改正：</span>${esc(f.corrected)}</p>` : ""}
    ${f.natural && f.natural !== f.corrected ? `<p class="gfix-line"><span class="small muted">更地道：</span><b>${esc(f.natural)}</b> <button class="chip" data-gsay="${esc(f.natural)}">听</button></p>` : ""}
    ${(f.errors || []).map(e => `<p class="small"><s class="no">${esc(e.from)}</s> → <b class="ok">${esc(e.to)}</b>　${esc(e.why)}</p>`).join("")}
    ${f.tip ? `<p class="small muted">${esc(f.tip)}</p>` : ""}
  </div>`;
}

/* ---------- 读完之后统一走这里 ----------
   box：放结果的元素；rec：startListening 的结果；ref：应该读的句子（跟读用原句，自由说用识别出来的话）；
   zh / model：想表达的中文和参考答案（有的话做语法纠错） */
async function evaluateSpeech(box, rec, { ref, zh, model, grammar = false, compact = false } = {}){
  if(!box) return;
  const parts = [];
  const canPron = Pron.ready() && rec && rec.audio && ref;
  const canFix = grammar && Settings.get("apiKey") && rec && rec.text;
  if(!canPron && !canFix){
    if(rec && rec.audio && !Pron.ready()){
      box.innerHTML = `<p class="small muted" style="margin-top:8px">想要逐词逐音的发音打分？到「我的 → 发音打分」填上免费的 Azure 密钥。</p>`;
    }
    return;
  }
  box.innerHTML = `<p class="small muted" style="margin-top:8px">${canPron ? "正在给发音打分…" : "正在检查语法…"}</p>`;
  const jobs = [];
  if(canPron) jobs.push(Pron.assess(rec.audio, ref, rec.seconds || 0).then(r => ({ pron: r }), e => ({ pronErr: e.message })));
  if(canFix) jobs.push(grammarFix({ said: rec.text, zh, model }).then(r => ({ fix: r }), e => ({ fixErr: e.message })));
  const res = Object.assign({}, ...(await Promise.all(jobs)));
  if(!box.isConnected) return res;
  box.innerHTML = (res.pron ? PronUI.html(res.pron, { compact }) : res.pronErr ? `<p class="small no" style="margin-top:8px">发音打分没成功：${esc(res.pronErr)}</p>` : "")
    + (res.fix ? fixHTML(res.fix, rec.text) : res.fixErr ? `<p class="small no">语法检查没成功：${esc(res.fixErr)}</p>` : "");
  if(res.pron) PronUI.bind(box, res.pron);
  box.querySelectorAll("[data-gsay]").forEach(b => b.onclick = () => playWith(null, b.dataset.gsay));
  return res;
}
