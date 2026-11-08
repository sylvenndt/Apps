// 安卓模拟器上的端到端测试：通过 WebView 调试接口（Chrome DevTools Protocol）在真实 App 里跑检查。
// 用法：node e2e.mjs <阶段 first|again> <clips.json> <输出目录>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [phase, clipsFile, outDir] = process.argv.slice(2);
const PKG = "com.sylvenndt.dailyenglish";
const results = [];
let failed = 0;
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(`${outDir}/report.txt`, s + "\n"); };
const check = (name, ok, info = "") => { results.push({ name, ok }); if(!ok) failed++; log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = cmd => execSync(`adb ${cmd}`, { encoding: "utf8" }).trim();
const shot = name => { try{ execSync(`adb exec-out screencap -p > ${outDir}/${name}.png`); }catch(e){ log("screenshot failed", name); } };

async function target(){
  for(let i = 0; i < 60; i++){
    try{
      const pid = adb(`shell pidof ${PKG}`);
      if(pid){
        try{ execSync("adb forward --remove tcp:9222", { stdio: "ignore" }); }catch(_){}
        adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid.split(" ")[0]}`);
        const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
        const p = list.find(t => t.type === "page" && /appassets\.androidplatform\.net/.test(t.url));
        if(p) return p;
      }
    }catch(_){}
    await sleep(1000);
  }
  throw new Error("找不到 App 的页面（WebView 调试接口没连上）");
}

class Cdp {
  constructor(url){ this.url = url; this.id = 0; this.wait = new Map(); this.errors = []; this.console = []; }
  open(){
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = e => rej(new Error("ws error"));
      this.ws.onmessage = m => {
        const d = JSON.parse(m.data);
        if(d.id && this.wait.has(d.id)){ const w = this.wait.get(d.id); this.wait.delete(d.id); d.error ? w.rej(new Error(JSON.stringify(d.error))) : w.res(d.result); }
        else if(d.method === "Runtime.exceptionThrown"){ const x = d.params.exceptionDetails; this.errors.push((x.exception && x.exception.description || x.text) + " @" + (x.url || "") + ":" + x.lineNumber); }
        else if(d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) this.console.push(d.params.type + ": " + d.params.args.map(a => a.value ?? a.description ?? "").join(" "));
      };
    });
  }
  send(method, params = {}){ const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.wait.set(id, { res, rej })); }
  async eval(expr, timeout = 60000){
    const r = await Promise.race([
      this.send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: true }),
      sleep(timeout).then(() => { throw new Error("eval timeout: " + expr.slice(0, 80)); })
    ]);
    if(r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function connect(){
  const t = await target();
  const c = new Cdp(t.webSocketDebuggerUrl);
  await c.open();
  await c.send("Runtime.enable");
  // 等页面启动完
  for(let i = 0; i < 60; i++){
    try{ if(await c.eval(`return document.readyState === "complete" && !document.getElementById("boot")`, 5000)) break; }catch(_){}
    await sleep(500);
  }
  return c;
}

// （词错率直接用 App 自己的 normalize + lcsLen 在页面里算，数字写法不同不算错）
const words = t => String(t).toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
function wer(ref, hyp){
  const a = words(ref), b = words(hyp);
  let d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for(let i = 1; i <= a.length; i++){ const p = d.slice(); d[0] = i; for(let j = 1; j <= b.length; j++) d[j] = Math.min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (a[i - 1] !== b[j - 1])); }
  return d[b.length] / Math.max(1, a.length);
}

async function first(c){
  const info = await c.eval(`return { href: location.href, title: document.title, bootErr: !!window.__bootErr,
    rec: typeof DSHREC, asr: typeof DSHASR, app: typeof DSHAPP, tts: typeof DSHTTS,
    avail: window.DSHASR && DSHASR.available(), perm: window.DSHREC && DSHREC.permState(), engine: Listener.engine(),
    ver: APP_VERSION, shell: DSHAPP.versionName(), web: DSHAPP.webVersion(), bundled: DSHAPP.bundledWeb() }`);
  log("page:", JSON.stringify(info));
  check("页面从固定地址打开", info.href.startsWith("https://appassets.androidplatform.net/linking-practice/"), info.href);
  check("页面启动没有报错", !info.bootErr);
  check("原生接口都在", info.rec === "object" && info.asr === "object" && info.app === "object" && info.tts === "object");
  check("安装包里有识别模型", info.avail === true);
  check("麦克风权限已允许", info.perm === "granted", info.perm);
  check("识别引擎是 App 内置的", info.engine === "native", info.engine);
  shot("01-today");
  // 记一个值，重启 App 后看还在不在（旧版每次打开换端口，记录全丢）
  const kept = await c.eval(`const v = "kept-" + Date.now(); localStorage.setItem("dshE2E", v); return v;`);
  fs.writeFileSync(`${outDir}/kept.txt`, kept);

  // 识别模型加载
  const t0 = Date.now(); let st = "";
  for(let i = 0; i < 240; i++){ st = await c.eval(`return DSHASR.state()`); if(st === "ready" || st.startsWith("error")) break; await sleep(1000); }
  const lm = await c.eval(`return DSHASR.loadMs()`);
  check("识别模型加载好了", st === "ready", `${st}，加载 ${lm}ms（等了 ${Date.now() - t0}ms）`);

  // 识别：把句库里录好的 .ogg 交给页面解码、转 16kHz，再走 App 的识别（跟真实使用同一条路）
  const clips = JSON.parse(fs.readFileSync(clipsFile, "utf8"));
  let tw = 0, n = 0;
  for(const cl of clips){
    const b64 = fs.readFileSync(cl.file).toString("base64");
    try{
      const r = await c.eval(`
        const bin = atob(${JSON.stringify(b64)}); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        // 用离线的 16kHz 音频环境解码，顺便转成 16kHz（不占用声卡）
        const oc = new OfflineAudioContext(1, 16000, 16000);
        const buf = await oc.decodeAudioData(u.buffer);
        const pcm = new Float32Array(buf.getChannelData(0));
        const t0 = performance.now(); const j = await NativeAsr.pcm(pcm);
        const a = normalize(${JSON.stringify(cl.text)}), b = normalize(j.text);
        return { text: j.text, ms: j.ms, wall: Math.round(performance.now() - t0), sec: pcm.length / 16000, match: lcsLen(a, b), n: a.length, m: b.length };`, 60000);
      const w = 1 - r.match / Math.max(r.n, r.m, 1); tw += w; n++;
      log(`  识别 ${r.sec.toFixed(1)}s 声音用 ${r.ms}ms（含传输 ${r.wall}ms）差异 ${(w * 100).toFixed(0)}%  原文：${cl.text}  听到：${r.text}`);
    }catch(e){ n++; tw += 1; log("  识别出错：", cl.text, String(e.message || e).slice(0, 200)); }
  }
  check("识别准确（平均差异 < 10%）", n > 0 && tw / n < 0.10, `平均 ${(100 * tw / Math.max(1, n)).toFixed(1)}%`);

  // 原生录音：start 必须马上返回 true/false（旧版没有返回值，页面就误报「麦克风打不开」）
  const rec = await c.eval(`
    DSHREC.reset(); const ok = DSHREC.start3(4000, 1000, 2500); const s0 = DSHREC.state(); let st = s0;
    const t0 = Date.now(); while(st === "rec" && Date.now() - t0 < 8000){ await new Promise(r => setTimeout(r, 100)); st = DSHREC.state(); }
    const n = (DSHREC.result() || "").length; DSHREC.reset();
    return { ok, type: typeof ok, s0, st, n, err: DSHREC.error() };`);
  log("  录音：", JSON.stringify(rec));
  check("录音接口马上返回是否成功", rec.type === "boolean", rec.type);
  check("录音开起来并自动结束", rec.ok === true ? (rec.s0 === "rec" && rec.st === "done" && rec.n > 1000) : rec.s0.startsWith("error:"), JSON.stringify(rec));

  // 完整的「说」流程：模拟器的麦克风是静音，应该得到「没听到声音」而不是「麦克风打不开」
  const sl = await c.eval(`const L = startListening({ maxMs: 4000, silenceMs: 1000 }); const r = await L.done; return { text: r.text, error: r.error, msg: srErrorText(r.error) };`, 30000);
  log("  说一句：", JSON.stringify(sl));
  check("跟读流程不再误报麦克风权限", sl.error !== "mic-busy" && sl.error !== "mic-denied" && sl.error !== "mic-blocked", sl.error);

  // 逐个页面点一遍，收集报错
  for(const h of ["#review", "#listen", "#speak", "#link", "#library", "#words", "#me", "#today"]){
    await c.eval(`location.hash = ${JSON.stringify(h)}; await new Promise(r => setTimeout(r, 900)); return true;`);
    shot("02-" + h.slice(1));
  }
  const me = await c.eval(`location.hash = "#me"; await new Promise(r => setTimeout(r, 1200)); const b = document.getElementById("stt-box"); return b ? b.innerText : "";`);
  log("  我的 → 跟读识别：", me.replace(/\n+/g, " | "));
  check("「我的」显示识别模型已就绪", /识别模型已就绪/.test(me) && /麦克风已就绪/.test(me));
  await c.eval(`document.getElementById("stt-box").scrollIntoView(); return true;`);
  shot("03-me-stt");

  // 打开一个口语场景，点麦克风（模拟器麦克风是静音：应该提示没听到声音）
  const sp = await c.eval(`location.hash = "#speak"; await new Promise(r => setTimeout(r, 800));
    const card = document.querySelector("#v-speak [data-t]"); if(card) card.click();
    await new Promise(r => setTimeout(r, 900));
    const mic = document.getElementById("sp-mic"); if(!mic) return { clicked: !!card, mic: false };
    mic.click(); await new Promise(r => setTimeout(r, 400));
    const during = mic.className + " / " + document.getElementById("sp-input").placeholder;
    const t0 = Date.now(); while(document.getElementById("sp-mic").classList.contains("on") && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 200));
    const toastEl = document.getElementById("toast");
    return { clicked: !!card, mic: true, during, after: document.getElementById("sp-mic").className, toast: toastEl ? toastEl.textContent : "" };`, 40000);
  log("  口语：", JSON.stringify(sp));
  check("口语页麦克风能开始录音", sp.mic && /on/.test(sp.during) && !/打不开|权限/.test(sp.toast), JSON.stringify(sp));
  shot("04-speak");

  // 在线更新检查跑过一次（结果写在 updateNote 里）
  await sleep(3000);
  const note = await c.eval(`return DSHAPP.updateNote()`);
  log("  在线更新：", note);
  check("在线更新能读到 GitHub 上的版本", /已是最新|已下载新版|还没发布完整/.test(note), note);

  check("页面没有未捕获的报错", c.errors.length === 0, c.errors.slice(0, 5).join(" || "));
  if(c.console.length) log("  控制台：", c.console.slice(0, 15).join(" || "));
}

async function again(c){
  const want = fs.existsSync(`${outDir}/kept.txt`) ? fs.readFileSync(`${outDir}/kept.txt`, "utf8") : "(第一轮没跑到这一步)";
  const got = await c.eval(`return localStorage.getItem("dshE2E")`);
  check("重开 App 后学习记录还在", got === want, `${got} / ${want}`);
  const href = await c.eval(`return location.href`);
  check("重开后还是同一个地址", href.startsWith("https://appassets.androidplatform.net/"), href);
  shot("05-reopen");
}

try{
  const c = await connect();
  if(phase === "first") await first(c); else await again(c);
  c.ws.close();
}catch(e){ check("测试脚本跑完", false, e.stack || String(e)); }
log(`== ${phase}: ${results.length - failed} 通过，${failed} 失败 ==`);
process.exit(failed ? 1 : 0);
