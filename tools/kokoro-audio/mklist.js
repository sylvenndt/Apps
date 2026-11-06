// Build the canonical list of (voice, text) clips to pre-record, using the app's own casting code.
const fs = require('fs'), vm = require('vm');
const D = '/home/claude/apps/linking-practice/';
const ctx = { console, window: {}, document: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
const DEF = { cast: 'scene', accent: process.env.ACCENT || 'both', voice1: 'af_heart', voice2: 'am_michael' };
vm.runInContext(['data.js', 'words.js', 'vocab.js'].map(f => fs.readFileSync(D + f, 'utf8')).join('\n;\n') +
  `\n;const Settings = { get: k => (${JSON.stringify(DEF)})[k] };\n` + fs.readFileSync(D + 'neural.js', 'utf8') +
  `\n;this.__o = { ALL_ITEMS, EXTRA_CARDS, TOPICS, SCENES, Voices, KOKORO_VOICES, ALL_WORDS };`, ctx);
const o = ctx.__o;

// same hash the app uses (cyrb53, base36)
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
const norm = t => String(t || '').trim().replace(/\s+/g, ' ');

const POS = { '名词': 'NN', '动词': 'VB', '形容词': 'JJ', '副词': 'RB', '介词': 'IN', '连词': 'CC', '代词': 'PRP', '感叹词': 'UH' };
const posHint = c => { const p = String(c.posZh || c.pos || '').split(/[、,，/ ]/)[0]; return POS[p] || null; };

const out = [], seen = new Set();
const add = (text, scene, alt, prio, pos) => {
  text = norm(text); if (!text) return;
  const voice = o.Voices.pick(scene, alt, text);
  const k = voice + '|' + text;
  if (seen.has(k)) return; seen.add(k);
  out.push({ text, voice, key: cyrb53(text), prio, pos: pos || null });
};
['Hi.', 'Hey! This is how I sound.', 'Hello! If you can hear me, the sound is working.'].forEach(t => add(t, 'talk', false, 0));
o.ALL_ITEMS.filter(it => !(o.SCENES.find(s => s.key === it.scene) || {}).pack).forEach(it => { add(it.en, it.scene, false, 1); add(it.reply, it.scene, true, 1); });
o.ALL_ITEMS.forEach(it => { add(it.en, it.scene, false, 2); add(it.reply, it.scene, true, 2); });
const ex = Object.values(o.EXTRA_CARDS);
ex.filter(c => !/^[vw]-/.test(c.id)).forEach(c => { add(c.en, c.scene, false, 3); if (c.reply) add(c.reply, c.scene, true, 3); });
ex.filter(c => c.id.startsWith('v-')).forEach(c => add(c.en, c.scene, false, 4));
o.TOPICS.forEach(t => { if (t.opener) add(t.opener, t.scene || 'talk', true, 4); });
ex.filter(c => c.word).forEach(c => add(c.word, 'vocab', false, c.id.startsWith('v-') ? 5 : 6, posHint(c)));

// collisions check (text key must be unique per text)
const byKey = new Map();
out.forEach(x => { const p = byKey.get(x.key); if (p && p !== x.text) throw new Error('hash collision ' + x.key + ' ' + p + ' / ' + x.text); byKey.set(x.key, x.text); });
out.sort((a, b) => a.prio - b.prio);
fs.writeFileSync(process.argv[2] || '/home/claude/gen/list.json', JSON.stringify(out));
const voices = {}; out.forEach(x => voices[x.voice] = (voices[x.voice] || 0) + 1);
const prios = {}; out.forEach(x => prios[x.prio] = (prios[x.prio] || 0) + 1);
console.log('clips', out.length, 'texts', byKey.size, prios, voices);
