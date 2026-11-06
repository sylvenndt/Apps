"use strict";
/* AI 批改用的大模型：DeepSeek 或 Claude（Anthropic）。
   口语教练、看中文说英文的语法纠错、测试连接都走 AI.chat()。 */
const DS_MODELS = [
  ["deepseek-v4-flash", "DeepSeek V4 Flash（推荐，快又便宜）"],
  ["deepseek-v4-pro", "DeepSeek V4 Pro（批改更细，贵一些）"]
];
const DS_PROXY_CODE = `export default {
  async fetch(req) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname;
    const r = await fetch("https://api.deepseek.com" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
      body: await req.text()
    });
    const h = new Headers(r.headers);
    for (const k in cors) h.set(k, cors[k]);
    return new Response(r.body, { status: r.status, headers: h });
  }
};`;

const AI = {
  provider(){ return Settings.get("aiProvider") === "claude" ? "claude" : "deepseek"; },
  name(){ return this.provider() === "claude" ? "Claude" : "DeepSeek"; },
  ready(){ return this.provider() === "claude" ? !!Settings.get("apiKey") : !!Settings.get("dsKey"); },
  /* system：系统提示词；user：这次发的内容。返回模型回复的文字 */
  async chat({ system, user, maxTokens = 1500, json = true }){
    if(!this.ready()) throw new Error(`还没填 ${this.name()} 的密钥，去「我的 → AI 批改」填一下。`);
    return this.provider() === "claude" ? this.claude(system, user, maxTokens) : this.deepseek(system, user, maxTokens, json);
  },
  async deepseek(system, user, maxTokens, json){
    const base = (Settings.get("dsBase") || "https://api.deepseek.com").replace(/\/+$/, "");
    const body = { model: Settings.get("dsModel"), max_tokens: maxTokens, stream: false,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }] };
    if(json) body.response_format = { type: "json_object" };
    let resp;
    try{
      resp = await fetch(base + "/chat/completions", { method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + Settings.get("dsKey") },
        body: JSON.stringify(body) });
    }catch(e){
      throw new Error(Settings.get("dsBase")
        ? "连不上你填的中转地址，检查一下地址和网络。"
        : "手机连不上 DeepSeek。先检查网络；如果网络正常还是不行，可能是 DeepSeek 不让网页直接调用，到「我的 → AI 批改」按说明填一个中转地址。");
    }
    if(!resp.ok){
      let msg = ""; try{ const j = await resp.json(); msg = (j.error && (j.error.message || j.error)) || ""; }catch(_){}
      if(resp.status === 401) throw new Error("DeepSeek 密钥不对，去「我的」里检查一下。");
      if(resp.status === 402) throw new Error("DeepSeek 账户余额不足，去 platform.deepseek.com 充值。");
      if(resp.status === 429) throw new Error("请求太频繁了，稍等一下再试。");
      if(resp.status >= 500) throw new Error("DeepSeek 服务器繁忙，过一会儿再试。");
      throw new Error(`DeepSeek 请求失败（${resp.status}）${msg ? "：" + msg : ""}`);
    }
    const data = await resp.json();
    const m = data.choices && data.choices[0] && data.choices[0].message;
    return (m && m.content) || "";
  },
  async claude(system, user, maxTokens){
    let resp;
    try{
      resp = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
        headers: { "content-type": "application/json", "x-api-key": Settings.get("apiKey"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: Settings.get("model"), max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content: user }] }) });
    }catch(e){ throw new Error("连不上 Anthropic 的服务器。检查一下网络（在中国大陆需要能访问外网）。"); }
    if(!resp.ok){
      let msg = ""; try{ msg = (await resp.json()).error.message; }catch(_){}
      if(resp.status === 401) throw new Error("Anthropic 密钥不对。去「我的」里检查一下。");
      if(resp.status === 429 || resp.status === 529) throw new Error("服务繁忙或额度用完了，过一会儿再试。");
      if(resp.status === 400 && /credit/i.test(msg)) throw new Error("Anthropic 账户余额不足，需要先充值。");
      throw new Error(`请求失败（${resp.status}）${msg ? "：" + msg : ""}`);
    }
    const data = await resp.json();
    return (data.content || []).map(c => c.text || "").join("");
  },
  /* 从回复里取出 JSON（模型偶尔会在前后多写几个字） */
  json(text){
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    try{ return JSON.parse(text.slice(a, b + 1)); }catch(_){ throw new Error("AI 返回的内容没法解析，再试一次。"); }
  }
};
/* 之前只填过 Claude 密钥的，继续用 Claude */
if(!store.get("aiMig20")){ if(Settings.get("apiKey") && !Settings.get("dsKey")) Settings.set("aiProvider", "claude"); store.set("aiMig20", true); }
