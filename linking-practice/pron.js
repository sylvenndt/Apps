"use strict";
/* 读完之后的评价：
   ① 发音打分：默认用讯飞「语音评测（流式版）」（国内直连，不用信用卡，新用户每天免费 500 次）；
      也可以换成微软 Azure 发音评测。拿录音和「应该读的句子」对比，给总分、准确、流利、完整，
      每个词、每个音节都有分数，指出漏读、多读、读错的地方。
   ② 语法纠错：用「我的 → AI 批改」里选的 DeepSeek 或 Claude，改语法、换更地道的说法。 */
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

const xfDayKey = () => "xfCalls:" + dayKey();
const Pron = {
  provider(){ return Settings.get("pronProvider") === "azure" ? "azure" : "xfyun"; },
  name(){ return this.provider() === "azure" ? "微软 Azure" : "讯飞"; },
  ready(){ return this.provider() === "azure" ? !!Settings.get("azureKey") : !!(Settings.get("xfAppId") && Settings.get("xfKey") && Settings.get("xfSecret")); },
  usedMin(){ return Math.round((store.get(monthKey(), 0) || 0) / 60); },
  usedToday(){ return store.get(xfDayKey(), 0) || 0; },
  params(ref){
    return { ReferenceText: ref, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive",
      EnableMiscue: true, EnableProsodyAssessment: true, PhonemeAlphabet: "IPA", NBestPhonemeCount: 3 };
  },
  /* wav：16kHz 单声道 WAV；ref：应该读的句子 */
  async assess(wav, ref, seconds){
    if(!this.ready()) throw new Error(`还没填${this.name()}的密钥`);
    ref = String(ref || "").trim();
    if(!ref) throw new Error("没有可以对照的句子");
    if(this.provider() === "xfyun"){
      const res = await Xfyun.assess(wav, ref);
      store.set(xfDayKey(), this.usedToday() + 1);
      return res;
    }
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

/* ---------- 讯飞 语音评测（流式版）WebSocket ----------
   文档：wss://ise-api.xfyun.cn/v2/open-ise，HMAC-SHA256 签名放在地址里；先发参数（ssb），再分帧发 16k 16 位单声道 PCM，
   最后一帧 aus=4；服务器回 base64 的 XML。英文分数默认是 5 分制，这里统一换成百分制。 */
const XF_HOST = "ise-api.xfyun.cn", XF_PATH = "/v2/open-ise";
const XF_ERR = {
  10313: "APPID 不对，或者和 APIKey 不是同一个应用的", 11200: "这个应用还没开通「语音评测」，到讯飞控制台的应用里开通一下",
  11201: "今天的免费次数用完了（每天 500 次），明天再来，或者在讯飞控制台领实名认证礼包", 10114: "评测超时，再试一次",
  10200: "网络太慢，评测超时了", 68676: "听起来像在乱读，按句子认真读一遍", 48195: "句子格式讯飞不认，换一句试试",
  40007: "录音格式不对", 10043: "录音格式不对", 68675: "录音格式不对", 10163: "参数不对：", 10160: "请求格式不对", 10139: "参数不对："
};
/* 讯飞英文音素（ARPAbet 风格）→ 国际音标，方便沿用下面的发音提示 */
const XF_PHONE = { aa: "ɑ", ae: "æ", ah: "ʌ", ao: "ɔ", aw: "aʊ", ax: "ə", ay: "aɪ", eh: "ɛ", er: "ɝ", axr: "ɚ", ey: "eɪ", ih: "ɪ", iy: "i", ow: "oʊ", oy: "ɔɪ", uh: "ʊ", uw: "u",
  b: "b", ch: "tʃ", d: "d", dh: "ð", f: "f", g: "g", hh: "h", jh: "dʒ", k: "k", l: "l", m: "m", n: "n", ng: "ŋ", p: "p", r: "ɹ", s: "s", sh: "ʃ", t: "t", th: "θ", v: "v", w: "w", y: "j", z: "z", zh: "ʒ" };
const xfPhone = p => XF_PHONE[String(p).toLowerCase().replace(/[0-9]/g, "")] || p;
const Xfyun = {
  async url(){
    const key = Settings.get("xfKey"), secret = Settings.get("xfSecret");
    const date = new Date().toUTCString();
    const origin = `host: ${XF_HOST}\ndate: ${date}\nGET ${XF_PATH} HTTP/1.1`;
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k, enc.encode(origin));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const auth = btoa(`api_key="${key}", algorithm="hmac-sha256", headers="host date request-line", signature="${sigB64}"`);
    return `wss://${XF_HOST}${XF_PATH}?authorization=${encodeURIComponent(auth)}&date=${encodeURIComponent(date)}&host=${XF_HOST}`;
  },
  /* 讯飞只认半角英文：弯引号、破折号等换掉；数字照读 */
  text(ref){
    return String(ref).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, ", ").replace(/…/g, "...").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  },
  async pcm(wav){
    const buf = new Uint8Array(await wav.arrayBuffer());
    // 跳过 WAV 头（找 "data" 块）
    for(let i = 12; i < Math.min(buf.length - 8, 4096); i++){
      if(buf[i] === 0x64 && buf[i + 1] === 0x61 && buf[i + 2] === 0x74 && buf[i + 3] === 0x61) return buf.subarray(i + 8);
    }
    return buf.subarray(44);
  },
  async assess(wav, ref){
    const [url, pcm] = await Promise.all([this.url(), this.pcm(wav)]);
    const text = this.text(ref);
    if(!/[a-z]/i.test(text)) throw new Error("没有可以对照的英文句子");
    const xml = await new Promise((resolve, reject) => {
      let ws, done = false, opened = false;
      const fail = msg => { if(done) return; done = true; clearTimeout(timer); try{ ws.close(); }catch(_){} reject(new Error(msg)); };
      const timer = setTimeout(() => fail(opened ? "讯飞评测超时了，再试一次" : "连不上讯飞的服务器"), 25000);
      try{ ws = new WebSocket(url); }catch(e){ fail("连不上讯飞的服务器"); return; }
      const b64 = u8 => { let s = ""; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
      ws.onopen = async () => {
        opened = true;
        ws.send(JSON.stringify({
          common: { app_id: Settings.get("xfAppId") },
          business: { sub: "ise", ent: "en_vip", category: "read_sentence", cmd: "ssb", text: "\uFEFF[content]\n" + text, tte: "utf-8", ttp_skip: true,
            aue: "raw", auf: "audio/L16;rate=16000", rstcd: "utf8", rst: "entirety", ise_unite: "1", plev: "0", extra_ability: "multi_dimension" },
          data: { status: 0 }
        }));
        // 每帧最多 0.25 秒声音（讯飞上限 19200 字节）；至少分两帧，第一帧 aus=1，最后一帧 aus=4
        const FR = 8000, frames = [];
        for(let i = 0; i < pcm.length; i += FR) frames.push(pcm.subarray(i, i + FR));
        if(frames.length < 2){ const h = (pcm.length >> 2) << 1; frames.splice(0, frames.length, pcm.subarray(0, h), pcm.subarray(h)); }
        for(let n = 0; n < frames.length; n++){
          if(done || ws.readyState !== 1) return;
          const last = n === frames.length - 1;
          ws.send(JSON.stringify({ business: { cmd: "auw", aus: n === 0 ? 1 : last ? 4 : 2 }, data: { status: last ? 2 : 1, data: b64(frames[n]) } }));
          if(!last) await new Promise(r => setTimeout(r, 15));
        }
      };
      ws.onmessage = e => {
        let j; try{ j = JSON.parse(e.data); }catch(_){ return; }
        if(j.code){ fail((XF_ERR[j.code] ? XF_ERR[j.code] + (/：$/.test(XF_ERR[j.code]) ? j.message : "") : `讯飞返回错误 ${j.code}：${j.message || ""}`)); return; }
        if(j.data && j.data.status === 2 && j.data.data){
          done = true; clearTimeout(timer);
          try{ ws.close(1000); }catch(_){}
          const bin = atob(j.data.data), u = new Uint8Array(bin.length);
          for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          resolve(new TextDecoder("utf-8").decode(u));
        }
      };
      ws.onerror = () => fail(opened ? "和讯飞的连接断了，再试一次" : "讯飞拒绝了连接：多半是 APIKey / APISecret 填错了，或者手机时间不准");
      ws.onclose = () => { if(!done) fail(opened ? "讯飞没返回结果就断开了，再试一次" : "讯飞拒绝了连接：多半是 APIKey / APISecret 填错了，或者手机时间不准"); };
    });
    return parseXfyun(xml);
  }
};

/* 讯飞英文结果 XML → 和 Azure 一样的格式 */
function parseXfyun(xml){
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const top = doc.querySelector("rec_paper > *") || [...doc.getElementsByTagName("*")].find(e => e.hasAttribute("total_score"));
  if(!top) throw new Error("讯飞返回的结果看不懂");
  const ex = top.getAttribute("except_info");
  if(top.getAttribute("is_rejected") === "true" || ex === "28676"){ const e = new Error("讯飞判断像在乱读，按句子认真读一遍"); e.nomatch = true; throw e; }
  if(ex === "28673"){ const e = new Error("没录到声音，或者声音太小，靠近麦克风再读一遍"); e.nomatch = true; throw e; }
  const num = (el, a) => { const v = el && el.getAttribute(a); return v == null || v === "" ? null : +v; };
  const raw = { total: num(top, "total_score"), acc: num(top, "accuracy_score"), flu: num(top, "fluency_score"), comp: num(top, "integrity_score"), std: num(top, "standard_score") };
  // 英文默认 5 分制；有任何一项超过 5 就是百分制了
  const five = Object.values(raw).every(v => v == null || v <= 5.0001);
  const sc = v => v == null || isNaN(v) ? null : Math.max(0, Math.min(100, Math.round(five ? v * 20 : v)));
  const SIL = /^(sil|silv|fil)$/i;
  const words = [...top.getElementsByTagName("word")].filter(w => !SIL.test(w.getAttribute("content") || "")).map(w => {
    const dp = +(w.getAttribute("dp_message") || 0);
    const wAcc = sc(num(w, "total_score")) ?? 0;
    const phon = [];
    [...w.getElementsByTagName("syll")].forEach(sy => {
      if(SIL.test(sy.getAttribute("content") || "")) return;
      const syScore = sc(num(sy, "syll_score"));
      const serr = +(sy.getAttribute("serr_msg") || 0);
      const phs = [...sy.getElementsByTagName("phone")].filter(ph => !SIL.test(ph.getAttribute("content") || ""));
      const bad = ph => +(ph.getAttribute("perr_msg") || 0) || +(ph.getAttribute("dp_message") || 0);
      // 讯飞指出了具体哪个音错：只标那个音；没指出就整个音节一起算
      const pinpoint = phs.some(bad);
      phs.forEach(ph => {
        const pdp = +(ph.getAttribute("dp_message") || 0), perr = +(ph.getAttribute("perr_msg") || 0);
        let acc = syScore ?? wAcc;
        if(pinpoint && !pdp && !perr) acc = Math.max(acc, 70);
        else if(serr === 1 || serr === 2049) acc = Math.min(acc, 55);
        if(perr) acc = Math.min(acc, 45);
        if(pdp === 16) acc = 0; else if(pdp) acc = Math.min(acc, 40);
        phon.push({ p: xfPhone(ph.getAttribute("content")), acc, heard: "" });
      });
    });
    return { w: w.getAttribute("content") || "", acc: dp === 16 ? 0 : wAcc, err: dp === 16 ? "Omission" : dp === 32 ? "Insertion" : dp === 128 ? "Mispronunciation" : "None",
      brk: "", mono: false, phon };
  });
  return { total: sc(raw.total), acc: sc(raw.acc), flu: sc(raw.flu), comp: sc(raw.comp), pros: null, text: top.getAttribute("content") || "", words };
}

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

/* ---------- 语法纠错（DeepSeek 或 Claude） ---------- */
const FIX_SYSTEM = `You check a Chinese learner's spoken English sentence.
Input JSON: "meaning_zh" (what they wanted to say, in Chinese; may be empty), "model_answer" (one natural English way to say it; may be empty), "said" (what speech recognition heard; it may contain small recognition mistakes — ignore obvious ones).
Judge whether "said" is correct, natural spoken American English that expresses the meaning. A different wording than model_answer is fine if it's natural.
Reply with ONLY a JSON object, no markdown:
{"verdict": "perfect" | "good" | "fix", "corrected": string (the learner's sentence fixed with minimal changes; same as said if nothing to fix), "natural": string (how an American would most naturally say it), "errors": [{"from": string, "to": string, "why": string}] (max 3; "why" in Simplified Chinese, short, about grammar or word choice), "tip": string (one short encouraging sentence in Simplified Chinese)}`;
async function grammarFix({ said, zh, model }){
  const t = await AI.chat({ system: FIX_SYSTEM, user: JSON.stringify({ meaning_zh: zh || "", model_answer: model || "", said }), maxTokens: 600 });
  return AI.json(t);
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
  const canFix = grammar && AI.ready() && rec && rec.text;
  if(!canPron && !canFix){
    if(rec && rec.audio && !Pron.ready()){
      box.innerHTML = `<p class="small muted" style="margin-top:8px">想要逐词逐音的发音打分？到「我的 → 发音打分」填上讯飞的密钥（免费，国内直连）。</p>`;
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
