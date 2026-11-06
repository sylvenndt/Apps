"""Kokoro with prosody control: duration, pitch (F0) and energy (N) are exposed between stages."""
import json, time, numpy as np, onnxruntime as rt
VOCAB = json.load(open('/home/claude/src/kokoro-onnx/src/kokoro_onnx/config.json'))['vocab']
SR = 24000
def sess(path, threads):
    so = rt.SessionOptions(); so.intra_op_num_threads = threads; so.inter_op_num_threads = 1
    so.graph_optimization_level = rt.GraphOptimizationLevel.ORT_ENABLE_ALL; so.log_severity_level = 3
    return rt.InferenceSession(path, so, providers=['CPUExecutionProvider'])
class EmoKokoro:
    def __init__(self, threads=2, voices='/home/claude/kkdl/voices-v1.0.bin'):
        d = '/home/claude/kkdl/'
        self.D, self.P, self.B = sess(d+'kD.onnx', threads), sess(d+'kP.onnx', threads), sess(d+'kB.onnx', threads)
        self.voices = np.load(voices)
        self.names = {m: {i.name for i in getattr(self, m).get_inputs()} for m in 'DPB'}
    def run(self, m, feeds): return getattr(self, m).run(None, {k: v for k, v in feeds.items() if k in self.names[m]})
    def tokens(self, ps): return [VOCAB[c] for c in ps if c in VOCAB][:510]
    def style(self, voice, n):
        if isinstance(voice, str): return np.asarray(self.voices[voice][n-1], np.float32)
        # blend: [(voice, weight), ...]
        return np.asarray(sum(w * self.voices[v][n-1] for v, w in voice), np.float32)
    def stages(self, ps, voice, speed=1.0):
        toks = self.tokens(ps); st = self.style(voice, len(toks))
        f = {'tokens': np.array([[0, *toks, 0]], np.int64), 'style': st, 'speed': np.array([speed], np.float32)}
        return f, toks
    def synth(self, ps, voice, speed=1.0, shape=None):
        f, toks = self.stages(ps, voice, speed)
        dur = self.run('D', f)[0]
        if shape and shape.get('dur'): dur = shape['dur'](dur, toks)
        F0, N = self.run('P', {**f, 'dur_in': dur})
        if shape and shape.get('f0n'): F0, N = shape['f0n'](F0, N)
        a = self.run('B', {**f, 'dur_in': dur, 'F0_in': F0.astype(np.float32), 'N_in': N.astype(np.float32)})[0]
        return a.reshape(-1), dur, F0, N
