"""Copy generated clips into the app (audio/<voice>/<key>.ogg) and write audio/index.json."""
import json, os, shutil, sys
OUT = '/home/claude/gen/out'
APP = '/home/claude/apps/linking-practice/audio'
items = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/home/claude/gen/list_all.json'))
voices, total, n = {}, 0, 0
for it in items:
    src = f"{OUT}/{it['voice']}/{it['key']}.ogg"
    if not os.path.exists(src):
        continue
    dst = f"{APP}/{it['voice']}/{it['key']}.ogg"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src):
        shutil.copyfile(src, dst)
    voices.setdefault(it['voice'], []).append(it['key'])
    total += os.path.getsize(src); n += 1
idx = {'base': 'audio/', 'bytes': total, 'voices': {v: ' '.join(ks) for v, ks in voices.items()}}
json.dump(idx, open(f'{APP}/index.json', 'w'), separators=(',', ':'))
print('clips', n, 'MB', round(total / 1048576, 1), 'index KB', round(os.path.getsize(f'{APP}/index.json') / 1024))
