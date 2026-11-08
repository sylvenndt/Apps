// 挑几条句库里录好的语音（Kokoro 录的 .ogg）和它们的原文，给安卓自动测试用：把声音交给 App 里的识别，看认得对不对。
// 用法：node clips.js <仓库根目录> <输出 json> [条数]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3], N = +(process.argv[4] || 8);
const D = path.join(ROOT, 'linking-practice') + '/';
const ctx = { console, location: { search: '', href: 'http://x/' }, window: {}, document: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(D + 'data.js', 'utf8') + '\n;this.__o = { ALL_ITEMS };', ctx);
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
const norm = t => String(t || '').trim().replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' ');
const files = {};
for (const v of fs.readdirSync(D + 'audio')) {
  const p = D + 'audio/' + v;
  if (!fs.statSync(p).isDirectory()) continue;
  for (const f of fs.readdirSync(p)) files[f.replace(/\.ogg$/, '')] = p + '/' + f;
}
const items = ctx.__o.ALL_ITEMS, out = [];
for (let i = 0; i < items.length && out.length < N; i += Math.max(1, Math.floor(items.length / (N * 2)))) {
  for (const t of [items[i].en, items[i].reply]) {
    const text = norm(t), k = cyrb53(text);
    if (files[k] && out.length < N && text.split(' ').length >= 4) out.push({ text, file: files[k] });
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('clips:', out.length);
