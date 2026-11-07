/* App 壳（安卓 WebView）里没有 speechSynthesis，这里用安卓自带的 TextToSpeech 顶上，
   让「手机系统语音」在安装版里也能读英文。浏览器里自带朗读时这段什么也不做。 */
(function(){
  if(("speechSynthesis" in window) && typeof window.SpeechSynthesisUtterance === "function") return;
  const B = window.DSHTTS;
  if(!B) return;

  let timer = 0, cur = null, speaking = false;
  const listeners = [];

  function clearT(){ if(timer){ clearTimeout(timer); timer = 0; } }
  function fire(u, name, arg){ try{ const f = u && u["on" + name]; if(typeof f === "function") f.call(u, arg || {}); }catch(_){} }

  function Utterance(text){
    this.text = String(text == null ? "" : text);
    this.lang = "en-US"; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
    this.onstart = null; this.onend = null; this.onerror = null; this.onboundary = null;
  }

  const VOICE = { name: "手机自带的英语语音", lang: "en-US", localService: true, default: true, voiceURI: "android-tts" };
  const synth = {
    get speaking(){ return speaking; },
    get pending(){ return false; },
    get paused(){ return false; },
    speak(u){
      if(!u) return;
      clearT();
      if(speaking && cur && cur !== u) fire(cur, "end");
      speaking = true; cur = u;
      const text = String(u.text || "");
      const rate = Math.max(0.5, Math.min(2, Number(u.rate) || 1));
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const est = words ? (words * 0.45 / rate + 1.2) * 1000 : 600;
      try{ B.speak(text, rate); }catch(_){}
      setTimeout(() => { if(cur === u) fire(u, "start"); }, 20);
      timer = setTimeout(() => { if(cur === u){ speaking = false; cur = null; fire(u, "end"); } }, Math.round(est));
    },
    cancel(){
      clearT();
      const u = cur; cur = null; speaking = false;
      try{ B.stop(); }catch(_){}
      if(u) fire(u, "end");
    },
    pause(){}, resume(){},
    getVoices(){ return [VOICE]; },
    addEventListener(name, fn){ if(name === "voiceschanged" && typeof fn === "function") listeners.push(fn); },
    removeEventListener(){},
    onvoiceschanged: null
  };

  try{
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true, writable: true });
  }catch(_){
    window.SpeechSynthesisUtterance = Utterance;
    window.speechSynthesis = synth;
  }

  setTimeout(() => {
    const f = synth.onvoiceschanged;
    if(typeof f === "function"){ try{ f(); }catch(_){} }
    listeners.forEach(fn => { try{ fn(); }catch(_){} });
    document.dispatchEvent(new Event("fluent-voices"));
  }, 250);
})();
