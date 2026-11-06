"""Record clips with emotion. Usage: python3 gen.py list.json [shard nshards threads]
Each item: {text, voice, key, emo, pos}. Skips clips already in OUT."""
import json, os, sys, time, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g2p import G2P, Tagger
from emotions import EmoVoice, SR
from tts import trim

LIST = sys.argv[1]
SHARD = int(sys.argv[2]) if len(sys.argv) > 2 else 0
NSH = int(sys.argv[3]) if len(sys.argv) > 3 else 1
THREADS = int(sys.argv[4]) if len(sys.argv) > 4 else 2
OUT = os.environ.get('OUT', '/home/claude/gen/out')
items = json.load(open(LIST))
tagger = Tagger()
g2p = {'us': G2P(False, tagger), 'gb': G2P(True, tagger)}
k = EmoVoice(threads=THREADS)
procs = []
log = open(f'{OUT}/../phonemes{SHARD}.tsv', 'a')
t_start = time.time(); done = 0; skipped = 0

def encode(audio, path):
    tmp = path + '.tmp'
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                          '-c:a', 'libopus', '-b:a', '28k', '-vbr', 'on', '-application', 'audio',
                          '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-f', 'ogg', tmp],
                         stdin=subprocess.PIPE)
    p.stdin.write(audio.astype(np.float32).tobytes()); p.stdin.close()
    procs.append((p, tmp, path))

def reap(block=False):
    keep = []
    for p, tmp, path in procs:
        if block or p.poll() is not None:
            p.wait()
            if p.returncode == 0: os.replace(tmp, path)
        else: keep.append((p, tmp, path))
    procs[:] = keep

for i, it in enumerate(items):
    if i % NSH != SHARD: continue
    path = f"{OUT}/{it['voice']}/{it['key']}.ogg"
    if os.path.exists(path): skipped += 1; continue
    os.makedirs(os.path.dirname(path), exist_ok=True)
    acc = 'gb' if it['voice'][0] == 'b' else 'us'
    ps, _ = g2p[acc].phonemize(it['text'], it.get('pos'))
    if not ps: print('EMPTY', it); continue
    emo = it.get('emo') or 'neutral'
    a, gain = k.render(ps, it['voice'], emo, seed=i)
    a = trim(a)
    rms = float(np.sqrt(np.mean(a ** 2)) + 1e-9); peak = float(np.max(np.abs(a)) + 1e-9)
    a = a * min(0.075 / rms * 10 ** (gain / 20), 0.95 / peak)
    encode(a, path)
    log.write(f"{it['voice']}\t{it['key']}\t{emo}\t{it['text']}\t{ps}\n")
    done += 1
    if len(procs) > 3:
        reap()
        while len(procs) > 3: time.sleep(0.02); reap()
    if done % 25 == 0:
        el = time.time() - t_start; log.flush()
        print(f"{i+1}/{len(items)} done={done} skip={skipped} {el:.0f}s {el/done:.2f}s/clip", flush=True)
reap(block=True)
print('FINISHED', done, skipped, f"{time.time()-t_start:.0f}s", flush=True)
print('OOV us', dict(g2p['us'].oov)); print('OOV gb', dict(g2p['gb'].oov))
