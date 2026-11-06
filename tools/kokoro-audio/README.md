# 每日美语 — pre-recorded Kokoro audio

`linking-practice/audio/` holds one Opus clip per library sentence/word, generated offline
with Kokoro-82M (fp32 ONNX) so the phone only has to play a file instead of running the
model. Clips live at `audio/<voice>/<key>.ogg`, where `key = cyrb53(normText(text))`
(base36, same function as `neural.js`). `audio/index.json` lists the keys per voice.

Voices follow the app's own casting (`Voices.pick` in `neural.js`, cast mode "scene"):
line = first voice of the scene pair, reply = second. Extra sets: the 18 voice-sample
lines, US substitutes for British-cast lines (for "只要美音"), link-practice presets and
their linked word pairs.

## Rebuild (paths in the scripts assume /home/claude; adjust if needed)

Inputs (all from GitHub, no pip needed):
- model + voices: `kokoro-v1.0.onnx`, `voices-v1.0.bin` from the
  `thewh1teagle/kokoro-onnx` release `model-files-v1.0` (download URL works with curl)
- vocab: `src/kokoro_onnx/config.json` from a clone of `thewh1teagle/kokoro-onnx`
- G2P lexicon: clone `hexgrad/misaki` (us/gb gold+silver dictionaries)
- OOV fallback: build `espeak-ng/espeak-ng` with CMake (static binary is enough)
- POS tagger weights: `packages/taggers/averaged_perceptron_tagger_eng.zip` from
  `nltk/nltk_data` (sparse checkout of the gh-pages branch), unzipped
- Python: onnxruntime, numpy; ffmpeg with libopus; node

Steps:
1. `node mklist.js list.json` (default cast) and `ACCENT=us node mklist.js list_us.json`
2. `node mkextra.js` → `list_all.json`; `node mklink.js`, then merge `list_link.json` into `list_all.json`
3. `python3 gen.py list_all.json <shard> <nshards> <threads>` (resumable; skips clips that exist)
4. `python3 mkindex.py list_all.json` → copies clips into the app and writes `audio/index.json`
5. Bump `AUDIO_V` in `neural.js` (and the usual `?v=N` / `sw.js` versions)

Sentences added later without a clip still work: they fall back to on-device Kokoro (if
downloaded) or the phone's system voice.
