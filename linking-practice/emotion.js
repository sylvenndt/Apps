"use strict";
/* 情绪语气：录音时按这里的情绪调整音高、起伏、语速、气声和颤音（见 tools/kokoro-audio/emotions.py）。
   每句话一个情绪，同一句话不管谁说都是同一个语气。 */
const EMOTIONS = {
  polite:      { zh: "礼貌",     g: "calm" },
  friendly:    { zh: "友好",     g: "warm" },
  cheerful:    { zh: "开心",     g: "warm" },
  excited:     { zh: "兴奋",     g: "hot" },
  surprised:   { zh: "惊讶",     g: "hot" },
  playful:     { zh: "打趣",     g: "warm" },
  flirty:      { zh: "撩人",     g: "soft" },
  tender:      { zh: "温柔",     g: "soft" },
  caring:      { zh: "关心",     g: "soft" },
  grateful:    { zh: "感激",     g: "warm" },
  apologetic:  { zh: "抱歉",     g: "low" },
  embarrassed: { zh: "不好意思", g: "tense" },
  sad:         { zh: "难过",     g: "low" },
  disappointed:{ zh: "失望",     g: "low" },
  tired:       { zh: "疲惫",     g: "low" },
  worried:     { zh: "担心",     g: "tense" },
  nervous:     { zh: "紧张",     g: "tense" },
  scared:      { zh: "害怕",     g: "tense" },
  urgent:      { zh: "着急",     g: "hot" },
  annoyed:     { zh: "不耐烦",   g: "angry" },
  angry:       { zh: "生气",     g: "angry" },
  confident:   { zh: "笃定",     g: "calm" },
  curious:     { zh: "好奇",     g: "calm" },
  relieved:    { zh: "松了口气", g: "soft" },
  whisper:     { zh: "小声说",   g: "soft" }
};
/* 怎么听出这种语气（听力「听语气」题的讲解） */
const EMO_CUES = {
  warm: "声音明亮，音调比平时略高，起伏大一些，句尾常常上扬。",
  hot: "音调明显升高，起伏很大，语速更快，重音更重。",
  soft: "声音轻、慢，带一点气声，音调起伏小。",
  low: "音调偏低、起伏小，语速放慢，句子之间停得更久。",
  tense: "音调偏高但起伏不大，语速偏快，声音有点发抖。",
  angry: "音量大，重音重，语速偏快，每个词都咬得很实。",
  calm: "语气平稳，起伏适中，吐字清楚。"
};
/* 原有句子的情绪：每个场景按句子顺序写「说的人/回应的人」，空着是平常语气 */
const EMO_SCENES = {
  cafe: "/polite /polite polite/ curious/friendly polite/apologetic polite/friendly curious/cheerful polite/friendly /friendly polite/friendly /polite apologetic/polite curious/friendly /friendly",
  dining: "/polite /friendly /polite polite/polite polite/friendly polite/polite /friendly /friendly cheerful/cheerful curious/ curious/friendly curious/playful /cheerful polite/friendly",
  shop: "polite/polite polite/friendly /friendly curious/cheerful /friendly /polite polite/polite embarrassed/friendly curious/apologetic polite/friendly polite/friendly polite/friendly /polite polite/friendly",
  work: "polite/friendly confident/friendly polite/ apologetic/friendly polite/friendly friendly/friendly confident/grateful curious/ polite/friendly /cheerful friendly/friendly confident/grateful /friendly tired/caring",
  talk: "friendly/friendly curious/tired excited/excited curious/relieved curious/ tired/tired curious/friendly curious/ cheerful/cheerful /friendly friendly/friendly curious/ playful/surprised curious/cheerful",
  plans: "curious/curious friendly/cheerful /friendly /cheerful apologetic/friendly apologetic/worried apologetic/friendly /grateful excited/excited / curious/cheerful friendly/friendly apologetic/friendly apologetic/friendly",
  travel: "polite/polite curious/polite curious/polite polite/polite curious/polite polite/friendly polite/polite worried/apologetic polite/polite curious/friendly polite/polite annoyed/apologetic polite/polite curious/cheerful",
  health: "tired/caring tired/caring tired/caring polite/polite curious/polite curious/friendly tired/caring tired/caring relieved/cheerful caring/grateful worried/caring curious/polite worried/caring worried/confident",
  fly: "polite/polite worried/apologetic curious/friendly polite/embarrassed polite/polite nervous/polite curious/ curious/polite polite/ polite/friendly curious/polite curious/polite curious/friendly /caring",
  ride: "polite/friendly curious/ curious/friendly curious/ polite/friendly worried/apologetic curious/friendly polite/friendly polite/cheerful embarrassed/friendly curious/friendly curious/ polite/confident curious/friendly",
  bar: "curious/confident playful/friendly friendly/ cheerful/playful polite/ excited/playful tired/caring polite/friendly playful/playful curious/friendly curious/friendly polite/friendly playful/caring curious/cheerful",
  chat: "curious/friendly cheerful/cheerful curious/friendly curious/friendly curious/friendly embarrassed/cheerful curious/friendly curious/ friendly/friendly friendly/friendly cheerful/cheerful curious/friendly curious/friendly curious/playful",
  date: "flirty/tender flirty/flirty flirty/cheerful flirty/playful tender/tender curious/flirty flirty/playful caring/tender tender/tender apologetic/friendly nervous/flirty flirty/cheerful tender/tender caring/tender",
  phone: "polite/polite curious/ /apologetic polite/polite polite/friendly polite/friendly polite/grateful polite/polite annoyed/apologetic /friendly polite/friendly embarrassed/friendly worried/friendly polite/apologetic",
  fix: "annoyed/caring annoyed/apologetic annoyed/polite annoyed/apologetic angry/polite angry/apologetic annoyed/embarrassed confident/polite annoyed/polite worried/polite annoyed/apologetic annoyed/apologetic polite/polite angry/caring",
  react: "surprised/confident excited/excited excited/excited worried/curious apologetic/friendly excited/playful cheerful/confident sad/disappointed annoyed/disappointed caring/relieved surprised/excited /friendly excited/grateful /grateful",
  party: "cheerful/friendly curious/playful friendly/cheerful friendly/ curious/friendly cheerful/cheerful /cheerful friendly/grateful cheerful/cheerful excited/playful curious/ cheerful/surprised excited/cheerful excited/excited",
  gym: "polite/friendly polite/friendly curious/ tired/tired friendly/cheerful confident/cheerful curious/polite polite/confident tired/caring curious/excited",
  home: "curious/ curious/polite annoyed/ polite/friendly curious/playful polite/embarrassed polite/friendly /friendly /curious curious/polite",
  bank: "polite/polite polite/polite curious/friendly embarrassed/polite curious/ polite/polite curious/friendly curious/polite curious/polite worried/caring",
  grocery: "polite/friendly polite/polite polite/cheerful curious/cheerful annoyed/apologetic polite/friendly curious/cheerful /cheerful curious/confident polite/",
  "s-book": "curious/cheerful curious/excited polite/friendly curious/tired curious/playful polite/friendly",
  "s-dog": "cheerful/cheerful curious/ curious/friendly excited/cheerful curious/friendly friendly/grateful",
  "s-line": "curious/friendly curious/tired curious/ curious/confident relieved/playful friendly/grateful",
  "s-seat": "curious/tired curious/friendly polite/friendly curious/ curious/cheerful curious/excited",
  "s-gig": "curious/excited curious/excited excited/excited curious/cheerful curious/ excited/excited",
  "s-lang": "curious/ cheerful/embarrassed curious/playful polite/friendly curious/cheerful friendly/cheerful",
  "s-comp": "friendly/grateful cheerful/cheerful friendly/embarrassed cheerful/cheerful grateful/confident excited/relieved",
  "s-common": "curious/excited surprised/excited curious/cheerful cheerful/surprised playful/confident curious/",
  "s-job": "curious/ curious/ curious/playful friendly/cheerful curious/ curious/playful",
  "s-trip": "curious/excited curious/playful curious/excited cheerful/cheerful curious/excited curious/confident",
  "s-intro": "friendly/friendly friendly/cheerful cheerful/playful curious/friendly embarrassed/friendly cheerful/playful",
  "s-invite": "friendly/excited friendly/nervous cheerful/cheerful friendly/curious friendly/cheerful friendly/grateful",
  "s-contact": "curious/friendly friendly/cheerful curious/friendly friendly/cheerful friendly/grateful cheerful/cheerful",
  "s-bye": "polite/friendly friendly/cheerful friendly/friendly polite/grateful cheerful/cheerful friendly/friendly",
  "s-awk": "embarrassed/friendly embarrassed/polite curious/curious embarrassed/playful apologetic/excited embarrassed/playful",
  "d-first": "flirty/embarrassed apologetic/friendly nervous/tender curious/cheerful curious/friendly tender/tender",
  "d-talk": "curious/friendly curious/cheerful curious/playful curious/friendly curious/tender tender/tender",
  "d-compl": "flirty/embarrassed flirty/tender flirty/flirty playful/playful flirty/flirty tender/tender",
  "d-test": "curious/flirty playful/flirty flirty/flirty flirty/tender flirty/playful tender/tender",
  "d-app": "cheerful/cheerful excited/excited curious/ flirty/cheerful playful/playful friendly/playful",
  "d-text": "tender/tender tender/cheerful tender/playful excited/excited caring/grateful tender/tired",
  "d-bill": "confident/grateful curious/friendly friendly/playful confident/grateful polite/polite grateful/tender",
  "d-second": "tender/tender curious/curious excited/excited flirty/flirty confident/surprised tender/flirty",
  "d-night": "tender/tender caring/grateful tender/tender whisper/whisper caring/tender tender/tender",
  "d-confess": "nervous/tender nervous/tender nervous/caring tender/tender tender/flirty nervous/caring",
  "d-dtr": "curious/tender nervous/excited worried/tender apologetic/disappointed nervous/tender caring/tender",
  "d-reject": "apologetic/disappointed apologetic/sad apologetic/caring apologetic/disappointed confident/disappointed sad/sad",
  "d-couple": "tender/playful curious/cheerful tender/surprised caring/tired tender/tender curious/tired",
  "d-makeup": "apologetic/apologetic worried/caring apologetic/sad sad/caring caring/tender sad/tender",
  "d-family": "cheerful/nervous cheerful/excited curious/friendly grateful/cheerful cheerful/friendly curious/cheerful",
  "x-clothes": "polite/polite curious/friendly disappointed/friendly curious/friendly curious/confident curious/polite curious/cheerful cheerful/cheerful",
  "x-shoes": "polite/friendly /friendly curious/confident curious/polite polite/friendly excited/cheerful curious/friendly curious/polite",
  "x-salon": "polite/friendly polite/friendly polite/curious curious/cheerful curious/polite excited/cheerful",
  "t-hobby": "curious/tender curious/cheerful curious/cheerful curious/friendly cheerful/excited friendly/relieved",
  "t-shows": "curious/cheerful playful/playful curious/curious playful/excited curious/cheerful confident/playful",
  "t-food": "curious/excited tired/cheerful curious/confident excited/excited confident/disappointed curious/",
  "t-weekend": "curious/cheerful curious/playful excited/tired curious/ relieved/friendly disappointed/disappointed"
};
ALL_ITEMS.forEach(it => {
  if(it.emo || it.remo) return;
  const list = (EMO_SCENES[it.scene] || "").split(" "), k = +it.id.slice(it.scene.length + 1);
  const [a, b] = (list[k] || "/").split("/"); it.emo = a || ""; it.remo = b || "";
});
/* 同一句话只用一种情绪（录音按句子存），先出现的为准 */
const EMO_TEXT = new Map();
{
  const put = (t, e) => { t = String(t || "").trim().replace(/\s+/g, " "); if(t && !EMO_TEXT.has(t)) EMO_TEXT.set(t, e && EMOTIONS[e] ? e : ""); };
  ALL_ITEMS.forEach(it => { put(it.en, it.emo); put(it.reply, it.remo); });
  TOPICS.forEach(t => { if(t.opener) put(t.opener, t.emo); });
}
const emoOf = text => EMO_TEXT.get(String(text || "").trim().replace(/\s+/g, " ")) || "";
function emoTag(text, cls){
  const e = emoOf(text); if(!e) return "";
  return `<span class="emo g-${EMOTIONS[e].g}${cls ? " " + cls : ""}">${EMOTIONS[e].zh}</span>`;
}
/* 「听语气」题：只出音色差别明显的情绪 */
const EMO_QUIZ = new Set(["cheerful","excited","surprised","playful","flirty","tender","caring","apologetic","sad","disappointed","tired","worried","nervous","scared","urgent","annoyed","angry","relieved","whisper","embarrassed"]);
