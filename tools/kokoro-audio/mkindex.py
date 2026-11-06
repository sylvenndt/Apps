"""Copy newly recorded clips into the app and write audio/index.json.
Clips not re-recorded this time are kept from the app folder. Clips recorded with an emotion are
listed under "rev" so the app requests them with ?e=<revTag> (phones drop the old cached copy)."""
import json, os, shutil, sys
OUT = os.environ.get('OUT', '/home/claude/gen/out')
APP = os.environ.get('APP', '/home/claude/apps/linking-practice/audio')
REV_TAG = os.environ.get('REV_TAG', '1')
items = json.load(open(sys.argv[1]))
voices, rev, total, n, copied, missing = {}, {}, 0, 0, 0, []
seen = set()
for it in items:
    vk = it['voice'] + '|' + it['key']
    if vk in seen: continue
    seen.add(vk)
    src = f"{OUT}/{it['voice']}/{it['key']}.ogg"
    dst = f"{APP}/{it['voice']}/{it['key']}.ogg"
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or open(src, 'rb').read() != open(dst, 'rb').read():
            shutil.copyfile(src, dst); copied += 1
    if not os.path.exists(dst):
        missing.append(vk); continue
    voices.setdefault(it['voice'], []).append(it['key'])
    if it.get('emo'): rev.setdefault(it['voice'], []).append(it['key'])
    total += os.path.getsize(dst); n += 1
idx = {'base': 'audio/', 'bytes': total, 'revTag': REV_TAG,
       'voices': {v: ' '.join(ks) for v, ks in voices.items()},
       'rev': {v: ' '.join(ks) for v, ks in rev.items()}}
json.dump(idx, open(f'{APP}/index.json', 'w'), separators=(',', ':'))
print('clips', n, 'copied', copied, 'missing', len(missing), 'MB', round(total / 1048576, 1),
      'index KB', round(os.path.getsize(f'{APP}/index.json') / 1024))
