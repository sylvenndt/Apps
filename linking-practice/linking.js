"use strict";
/* ---------------- 连读规则（按拼写推断） ---------------- */
const STOPS = new Set(["p","b","t","d","k","g"]);
const PAIR = {p:"p",b:"p",t:"t",d:"t",k:"k",g:"k",f:"f",v:"f",s:"s",z:"s","θ":"θ","ʃ":"ʃ","tʃ":"tʃ","dʒ":"tʃ",m:"m",n:"n",l:"l",r:"r"};
const C = (ph) => ({type:"C", ph});
const V = (g) => ({type:"V", glide:g});
const LETTER = {c:"k",q:"k",j:"dʒ",x:"s",y:"j"};
const letterPh = l => LETTER[l] || l;

const FINAL_EXC = {
  the:V("ə"), a:V("ə"), i:V("j"), my:V("j"), by:V("j"), buy:V("j"), why:V("j"), eye:V("j"), high:V("j"),
  he:V("j"), she:V("j"), we:V("j"), me:V("j"), be:V("j"),
  to:V("w"), do:V("w"), who:V("w"), you:V("w"), two:V("w"), too:V("w"), through:V("w"), though:V("w"), although:V("w"),
  go:V("w"), so:V("w"), no:V("w"),
  laugh:C("f"), enough:C("f"), rough:C("f"), tough:C("f"), cough:C("f"),
  of:C("v"), is:C("z"), was:C("z"), has:C("z"), his:C("z"), as:C("z"), does:C("z"), says:C("z"), goes:C("z"),
  one:C("n"), done:C("n"), gone:C("n"), none:C("n"), come:C("m"), some:C("m"),
  are:C("r"), were:C("r"), your:C("r"), our:C("r"), hour:C("r")
};
const VOICELESS = new Set(["p","t","k","f","s","x","c","h"]);

function finalSound(w){
  if(!w) return null;
  if(FINAL_EXC[w]) return FINAL_EXC[w];
  if(/n't$/.test(w)) return C("t");
  if(/'ll$/.test(w)) return C("l");
  if(/'re$/.test(w)) return C("r");
  if(/'ve$/.test(w)) return C("v");
  if(/'m$/.test(w)) return C("m");
  if(/'d$/.test(w)) return C("d");
  if(/'s$/.test(w)) return C(/[ptkf]/.test(w[w.length-3]) ? "s" : "z");
  w = w.replace(/'/g,"");
  if(!w) return null;
  if(/ch$/.test(w)) return C("tʃ");
  if(/sh$/.test(w)) return C("ʃ");
  if(/th$/.test(w)) return C("θ");
  if(/ng$/.test(w)) return C("ŋ");
  if(/ck$/.test(w)) return C("k");
  if(/ph$/.test(w)) return C("f");
  if(/igh$/.test(w)) return V("j");
  if(/gh$/.test(w)) return V("w");
  if(/(mb|mn)$/.test(w)) return C("m");
  if(/gn$/.test(w)) return C("n");
  if(/que$/.test(w)) return C("k");
  if(/([aeiou]r|[aeiou]re|[^aeiouyw]re)$/.test(w)) return C("r");
  if(/[bcdfgkmnpstvz]le$/.test(w)) return C("l");
  if(w.length >= 3 && /[^aeiouyw]e$/.test(w)){
    const p = w[w.length-2];
    if(p==="c") return C("s");
    if(p==="g") return C("dʒ");
    if(p==="s") return C("z");
    return C(letterPh(p));
  }
  if(w.length > 3 && /ed$/.test(w) && !/eed$/.test(w)){
    const p = w[w.length-3];
    if(p==="t" || p==="d") return C("d");
    return C(VOICELESS.has(p) ? "t" : "d");
  }
  if(/x$/.test(w)) return C("s");
  if(/s$/.test(w)){
    if(/ss$/.test(w)) return C("s");
    if(/(s|x|z|ch|sh|c|g)es$/.test(w)) return C("z");
    const p = w[w.length-2];
    if(/[ptkf]/.test(p)) return C("s");
    if(/[aeiou]/.test(p) && w.length <= 4) return C("s");
    return C("z");
  }
  if(/(ay|ey|oy|uy)$/.test(w)) return V("j");
  if(/[^aeiou]y$/.test(w)) return V("j");
  if(/(ee|ie|ea|ei|i)$/.test(w)) return V("j");
  if(/(ow|ew|ou|oo|ue|o|u)$/.test(w)) return V("w");
  if(/(aw|a|ah|oh|eh|uh)$/.test(w)) return V("ə");
  if(/e$/.test(w)) return V("j");
  if(/w$/.test(w)) return V("w");
  if(/y$/.test(w)) return V("j");
  return C(letterPh(w[w.length-1]));
}

const INIT_V_EXC = new Set(["hour","hours","honest","honestly","honor","honour","heir"]);
const H_WEAK = new Set(["him","her","his","have","has","had","he"]);
function initialSound(w){
  w = (w||"").replace(/'/g,"");
  if(!w) return null;
  let s;
  if(INIT_V_EXC.has(w)) s = V();
  else if(/^(one|once)$/.test(w)) s = C("w");
  else if(/^(use|usu|uni|eu|ewe)/.test(w)) s = C("j");
  else if(/^[aeiou]/.test(w)) s = V();
  else if(/^y/.test(w)) s = C("j");
  else if(/^th/.test(w)) s = C("θ");
  else if(/^sh/.test(w)) s = C("ʃ");
  else if(/^ch/.test(w)) s = C("tʃ");
  else if(/^ph/.test(w)) s = C("f");
  else if(/^wh/.test(w)) s = C("w");
  else if(/^kn/.test(w)) s = C("n");
  else if(/^wr/.test(w)) s = C("r");
  else if(/^c[eiy]/.test(w)) s = C("s");
  else if(/^x/.test(w)) s = C("z");
  else s = C(letterPh(w[0]));
  s.hWeak = H_WEAK.has(w);
  return s;
}

/* 把词拆成 “前半 + 末尾辅音字母”，用于读法提示 */
function splitTail(w){
  let s = w.replace(/'/g,"");
  if(/[^aeiouyw]ed$/.test(s) && s.length > 3 && !/[td]ed$/.test(s)){
    const fs = finalSound(w);
    return {head:s.slice(0,-2), tail: fs && fs.ph==="t" ? "t" : "d"};
  }
  if(/[bcdfgkmnpstvz]le$/.test(s)) return {head:s.slice(0,-2), tail:"l"};
  let tailOverride = null;
  if(s.length >= 3 && /[^aeiouyw]e$/.test(s)){
    const p = s[s.length-2];
    if(p==="c") tailOverride = "s";
    if(p==="g") tailOverride = "j";
    s = s.slice(0,-1);
  }
  const m = s.match(/(tch|ch|sh|th|ng|ck|ph|ll|ss|[bcdfghjklmnpqrstvxz])$/);
  if(!m) return {head:s, tail:""};
  let tail = m[1];
  if(tail==="ll") tail = "l";
  if(tail==="ss") tail = "s";
  return {head:s.slice(0, s.length - m[1].length) + (m[1]==="ll"||m[1]==="ss" ? m[1][0] : ""), tail: tailOverride || tail};
}

function cleanWord(raw){ return raw.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z']/g,"").replace(/^'+|'+$/g,""); }

function tokenize(text){
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for(const raw of parts){
    const w = cleanWord(raw);
    if(!w) { if(out.length) out[out.length-1].punct = true; continue; }
    out.push({raw, w, punct: /[,.!?;:…—–"”)\]]$/.test(raw)});
  }
  return out;
}

function detectLinks(tokens){
  const links = [];
  for(let i=0; i<tokens.length-1; i++){
    const A = tokens[i], B = tokens[i+1];
    if(A.punct) continue;
    const f = finalSound(A.w), s = initialSound(B.w);
    if(!f || !s) continue;
    const a = A.w, b = B.w;
    let bl = b.replace(/'/g,"");
    if(s.type==="V" && /^h/.test(bl)) bl = bl.slice(1); // hour, honest：h 不发音
    let L = null;
    if(f.type==="C"){
      const {head, tail} = splitTail(a);
      if(s.hWeak && f.ph!=="h"){
        L = {cls:"hd", kind:"h 弱读连读", hint:`${head}-${tail}${bl.slice(1)}`, note:`${b} 不重读时 h 常脱落，和前面的辅音连在一起（可选）`};
      } else if(s.type==="V"){
        const t = f.ph==="t";
        const before = a.replace(/'/g,"").replace(/e$/,"").slice(-2,-1);
        if(f.ph==="r") L = {cls:"cv", kind:"r 连读", hint:`${head}-${tail}${bl}`, note:"词尾 r 和后面元音连起来"};
        else if(t && (/[aeiour]/.test(before) || /ght$/.test(a)) && !/n't$/.test(a))
          L = {cls:"cv", kind:"辅元连读", hint:`${head}-${tail}${bl}`, note:`美式口语里 t 常弱化成轻快的 d：${head}-d${bl}`};
        else L = {cls:"cv", kind:"辅元连读", hint:`${head}-${tail}${bl}`, note:"词尾辅音直接拼到下一个词的元音上"};
      } else if(s.ph==="j" && ["t","d","s","z"].includes(f.ph)){
        const map = {t:"ch", d:"j", s:"sh", z:"zh"};
        const ipa = {t:"/tʃ/", d:"/dʒ/", s:"/ʃ/", z:"/ʒ/"};
        const rest = bl.replace(/^you/,"u").replace(/^y/,"");
        L = {cls:"as", kind:"音的同化", hint:`${head}-${map[f.ph]}${rest}`, note:`/${f.ph}/ + /j/ 融合成 ${ipa[f.ph]}`};
      } else if(PAIR[f.ph] && PAIR[f.ph]===PAIR[s.ph]){
        L = {cls:"lp", kind:"同音合并", hint:`${head}(${tail})‿${bl}`, note:`相同或相近的辅音只发一次，稍微拖长`};
      } else if(STOPS.has(f.ph) && STOPS.has(s.ph)){
        L = {cls:"lp", kind:"失去爆破", hint:`${head}(${tail})‿${bl}`, note:`/${f.ph}/ 只做口型、不送气，紧接着发 /${s.ph}/`};
      } else if(STOPS.has(f.ph) && !["h","w","j"].includes(s.ph)){
        L = {cls:"lp", kind:"不完全爆破", hint:`${head}(${tail})‿${bl}`, note:`/${f.ph}/ 轻收不爆破，直接过渡到下一个音`};
      }
    } else if(s.type==="V"){
      if(a==="the") L = {cls:"vv", kind:"元音过渡", hint:`thee-(y)${bl}`, note:"the 在元音前读 /ði/，中间带一点 /j/"};
      else if(f.glide==="j") L = {cls:"vv", kind:"元音过渡", hint:`${a}-(y)${bl}`, note:"两个元音之间自然滑出一个轻的 /j/"};
      else if(f.glide==="w") L = {cls:"vv", kind:"元音过渡", hint:`${a}-(w)${bl}`, note:"两个元音之间自然滑出一个轻的 /w/"};
      else L = {cls:"vv", kind:"元音连读", hint:`${a}‿${bl}`, note:"两个元音连贯滑过去，不要停顿"};
    }
    if(L){ L.i = i; L.a = A.raw.replace(/[^A-Za-z'’]/g,""); L.b = B.raw.replace(/[^A-Za-z'’]/g,""); links.push(L); }
  }
  return links;
}

/* ---------------- 文本比对 ---------------- */
const CONTR = [[/\bwon't\b/g,"will not"],[/\bcan't\b/g,"can not"],[/\bcannot\b/g,"can not"],[/\bshan't\b/g,"shall not"],
  [/n't\b/g," not"],[/'m\b/g," am"],[/'re\b/g," are"],[/'ve\b/g," have"],[/'ll\b/g," will"],[/'d\b/g," would"],[/'s\b/g," is"],
  [/\bgonna\b/g,"going to"],[/\bwanna\b/g,"want to"],[/\bgotta\b/g,"got to"]];
const DIGITS = {"0":"zero","1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine","10":"ten"};
const HOMO = [["to","too","two"],["for","four"],["right","write"],["there","their"],["i","eye"],["you","u"],["know","no"],["hear","here"],
  ["see","sea"],["by","buy","bye"],["meet","meat"],["piece","peace"],["tea","t"],["whole","hole"],["one","won"],["our","hour"],["a","uh"]];
const HOMO_MAP = new Map(); HOMO.forEach((g, i) => g.forEach(w => HOMO_MAP.set(w, i)));
const same = (a, b) => a === b || (HOMO_MAP.has(a) && HOMO_MAP.get(a) === HOMO_MAP.get(b));

/* 数字读成英文单词（识别模型常把 six 写成 6、把 six a.m. 写成 6am），比对前统一成单词 */
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function numWords(n){
  if(n < 20) return ONES[n];
  if(n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if(n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
  if(n < 1000000) return numWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numWords(n % 1000) : "");
  return String(n);
}
const ORD = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
function ordWords(n){
  const w = numWords(n).split(" "), last = w.pop();
  return w.concat(ORD[last] || (/y$/.test(last) ? last.replace(/y$/, "ieth") : last + "th")).join(" ");
}
const COMPOUND = { anytime: "any time", alright: "all right", ok: "okay", cannot: "can not", everytime: "every time", "o'clock": "oclock" };
function spellNumbers(s){
  return s
    .replace(/\$(\d+)/g, "$1 dollars ")
    .replace(/(\d)\s*%/g, "$1 percent ")
    .replace(/\b(\d{1,2}):00\b/g, "$1 ")
    .replace(/\b(\d{1,2}):0(\d)\b/g, "$1 oh $2 ")
    .replace(/\b(\d{1,2}):(\d\d)\b/g, "$1 $2 ")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, (_, d) => " " + (+d < 1000000 ? ordWords(+d) : d) + " ")
    .replace(/\b(\d+)\s*(a|p)\.?m\b\.?/g, "$1 $2 m ")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => " " + a + " point " + b.split("").join(" ") + " ")
    .replace(/\d+/g, d => " " + (d.length > 1 && d[0] === "0" ? d.split("").map(x => ONES[+x]).join(" ") : +d < 1000000 ? numWords(+d) : d) + " ");
}

function normalize(text){
  let s = " " + String(text || "").toLowerCase().replace(/[’‘]/g,"'") + " ";
  s = s.replace(/\b(a|p)\.m\./g, "$1 m ").replace(/\b(a|p)\.m\b/g, "$1 m ");
  s = spellNumbers(s);
  s = s.replace(/[a-z']+/g, w => COMPOUND[w] || w);
  for(const [re, rep] of CONTR) s = s.replace(re, rep);
  return s.split(/[^a-z0-9']+/).map(x => x.replace(/'/g,"")).filter(Boolean).map(x => DIGITS[x] || x);
}
function lcsTable(a, b){
  const n = a.length, m = b.length;
  const dp = Array.from({length:n+1}, () => new Int16Array(m+1));
  for(let i=n-1; i>=0; i--) for(let j=m-1; j>=0; j--)
    dp[i][j] = same(a[i], b[j]) ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  return dp;
}
function lcsLen(a, b){ return lcsTable(a, b)[0][0]; }
function align(a, b){
  const dp = lcsTable(a, b), match = new Array(a.length).fill(-1);
  let i = 0, j = 0;
  while(i < a.length && j < b.length){
    if(same(a[i], b[j])){ match[i] = j; i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) i++; else j++;
  }
  return match;
}

async function decode(blob){
  const ab = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try{
    return await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if(p && p.then) p.then(res, rej);
    });
  } finally { try{ ctx.close(); }catch(_){} }
}

function audioStats(buf){
  const data = buf.getChannelData(0), sr = buf.sampleRate;
  const hop = Math.round(sr * 0.02);
  const db = [];
  for(let i=0; i+hop <= data.length; i+=hop){
    let s = 0; for(let k=i; k<i+hop; k++) s += data[k]*data[k];
    db.push(10*Math.log10(s/hop + 1e-12));
  }
  if(db.length < 5) return null;
  const sorted = [...db].sort((a,b)=>a-b);
  const pct = p => sorted[Math.min(sorted.length-1, Math.floor(p*sorted.length))];
  const floor = pct(0.1), peak = pct(0.98);
  const thr = Math.max(floor + 10, peak - 32);
  let voiced = db.map(v => v > thr);
  // 去掉过短的“有声”毛刺（<60ms）
  for(let i=0; i<voiced.length;){
    if(!voiced[i]){ i++; continue; }
    let j = i; while(j < voiced.length && voiced[j]) j++;
    if(j - i < 3) for(let k=i; k<j; k++) voiced[k] = false;
    i = j;
  }
  const first = voiced.indexOf(true), last = voiced.lastIndexOf(true);
  if(first < 0) return {db, thr, voiced, empty:true};
  const gaps = [];
  for(let i=first; i<=last;){
    if(voiced[i]){ i++; continue; }
    let j = i; while(j <= last && !voiced[j]) j++;
    const dur = (j - i) * 0.02;
    if(dur >= 0.22) gaps.push({start:i, end:j, dur});
    i = j;
  }
  const span = (last - first + 1) * 0.02;
  const gapTotal = gaps.reduce((a,g)=>a+g.dur, 0);
  // 每个停顿之前累计的有声时长（用来按音节比例估位置）
  gaps.forEach(g => { g.before = (g.start - first) * 0.02 - gaps.filter(h => h.end <= g.start).reduce((a,h)=>a+h.dur,0); });
  return {db, thr, voiced, first, last, gaps, span, speech: span - gapTotal, peak, floor};
}

function syllables(w){
  w = w.replace(/'/g,"");
  let n = (w.match(/[aeiouy]+/g) || []).length;
  if(/[^aeiouyl]e$/.test(w) && n > 1) n--;
  if(/[^aeiouy]le$/.test(w)) n = Math.max(n, 2);
  return Math.max(1, n);
}


function targetNorm(tokens){
  const out = [];
  tokens.forEach((t, wi) => normalize(t.raw).forEach(n => out.push({t:n, wi})));
  return out;
}

function locateGap(g, st, tokens){
  const syl = tokens.map(t => syllables(t.w));
  const total = syl.reduce((a,b)=>a+b, 0);
  const pos = g.before / Math.max(0.01, st.speech) * total;
  let cum = 0, best = 0, bestD = Infinity;
  for(let i=0; i<tokens.length-1; i++){
    cum += syl[i];
    const d = Math.abs(cum - pos);
    if(d < bestD){ bestD = d; best = i; }
  }
  return best;
}

function drawWave(cv, st){
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.clearRect(0,0,W,H);
  if(!st || st.empty) return;
  const css = getComputedStyle(document.documentElement);
  const pad = Math.max(0, st.first - 10), end = Math.min(st.db.length, st.last + 11);
  const n = end - pad, bw = W / n;
  const lo = st.floor, hi = st.peak + 3;
  g.fillStyle = css.getPropertyValue("--red").trim();
  g.globalAlpha = 0.14;
  st.gaps.forEach(gp => g.fillRect((gp.start - pad)*bw, 0, (gp.end - gp.start)*bw, H));
  g.globalAlpha = 1;
  g.fillStyle = css.getPropertyValue("--purple").trim();
  for(let i=0; i<n; i++){
    const v = st.db[pad + i];
    const h = Math.max(1.5*dpr, (v - lo) / (hi - lo) * (H*0.86));
    g.globalAlpha = st.voiced[pad+i] ? 0.95 : 0.22;
    g.fillRect(i*bw, (H - h)/2, Math.max(1, bw - dpr*0.6), h);
  }
  g.globalAlpha = 1;
  g.fillStyle = css.getPropertyValue("--red").trim();
  g.font = `600 ${11*dpr}px Archivo, sans-serif`; g.textAlign = "center";
  st.gaps.forEach(gp => g.fillText(gp.dur.toFixed(2)+"s", ((gp.start+gp.end)/2 - pad)*bw, 13*dpr));
}
