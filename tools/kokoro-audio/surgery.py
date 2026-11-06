"""Make three views of kokoro-v1.0.onnx for prosody control:
  D: tokens,style,speed -> dur (per-token frame counts, float)
  P: + dur_in -> F0, N (frame-level pitch & energy curves)
  B: + dur_in, F0_in, N_in -> audio
"""
import sys; sys.path.insert(0,'/home/claude/gen')
from pb import *
SRC='/home/claude/kkdl/kokoro-v1.0.onnx'
b = memoryview(open(SRC,'rb').read())
model_fields = list(fields(b))
graph = next(v for f,w,v,raw in model_fields if f == 7)
gf = list(fields(graph))
F0, N, DUR = '/encoder/Reshape_output_0', '/encoder/Reshape_1_output_0', '/encoder/Round_output_0'
def make(path, outs, ren, new_inputs):
    # keep only nodes that the outputs need (ORT does not prune dead branches here)
    nodes = [(i, node_info(v)) for i, (f,w,v,raw) in enumerate(gf) if f == 1]
    need = set(outs); keep = set()
    for i, n in reversed(nodes):
        if set(n['out']) & need:
            keep.add(i); need |= {ren.get(x, x) for x in n['in'] if x}
    g = bytearray()
    for i, (f,w,v,raw) in enumerate(gf):
        if f == 1 and i not in keep: continue
        if f == 5:
            nm = next((bytes(x).decode() for ff,ww,x,rr in fields(v) if ff == 8), None)
            if nm not in need: continue
        if f == 11:
            nm = bytes(next(fields(v))[2]).decode()
            if nm not in need: continue
        if f == 1 and ren:
            info = node_info(v)
            if set(info['in']) & set(ren): g += ld(1, rebuild_node(v, ren)); continue
        if f == 12: continue  # drop original outputs
        g += raw
    for name, dims in new_inputs: g += ld(11, value_info(name, 1, dims))
    for name in outs: g += ld(12, value_info(name, 1))
    m = bytearray()
    for f,w,v,raw in model_fields:
        m += ld(7, bytes(g)) if f == 7 else raw
    open(path,'wb').write(m)
    print('wrote', path, len(m))
make('/home/claude/kkdl/kD.onnx', [DUR], {}, [])
make('/home/claude/kkdl/kP.onnx', [F0, N], {DUR: 'dur_in'}, [('dur_in', [1, 'T'])])
make('/home/claude/kkdl/kB.onnx', ['audio'], {DUR: 'dur_in', F0: 'F0_in', N: 'N_in'}, [('dur_in', [1, 'T']), ('F0_in', [1, 'F']), ('N_in', [1, 'F'])])
