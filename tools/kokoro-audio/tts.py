import json, time, numpy as np, onnxruntime as rt

VOCAB = json.load(open('/home/claude/src/kokoro-onnx/src/kokoro_onnx/config.json'))['vocab']
SR = 24000

class Kokoro:
    def __init__(self, model='/home/claude/kkdl/kokoro-v1.0.onnx', voices='/home/claude/kkdl/voices-v1.0.bin', threads=2):
        so = rt.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.graph_optimization_level = rt.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = rt.InferenceSession(model, so, providers=['CPUExecutionProvider'])
        self.inputs = {i.name: i for i in self.sess.get_inputs()}
        self.tok_name = 'input_ids' if 'input_ids' in self.inputs else 'tokens'
        self.speed_int = 'int' in self.inputs['speed'].type
        self.voices = np.load(voices)

    def tokens(self, ps):
        return [VOCAB[c] for c in ps if c in VOCAB]

    def synth(self, ps, voice, speed=1.0):
        toks = self.tokens(ps)[:510]
        style = self.voices[voice][len(toks) - 1]  # (1, 256)
        feeds = {
            self.tok_name: np.array([[0, *toks, 0]], dtype=np.int64),
            'style': np.asarray(style, dtype=np.float32),
            'speed': np.array([int(speed) if self.speed_int else speed], dtype=np.int32 if self.speed_int else np.float32),
        }
        return self.sess.run(None, feeds)[0].reshape(-1)

def trim(audio, thr=0.004, pad_ms=60):
    a = np.abs(audio)
    idx = np.where(a > thr)[0]
    if not len(idx):
        return audio
    pad = int(SR * pad_ms / 1000)
    s = max(0, idx[0] - pad)
    e = min(len(audio), idx[-1] + pad)
    return audio[s:e]

if __name__ == '__main__':
    import sys
    sys.path.insert(0, '/home/claude/gen')
    from g2p import G2P
    g = G2P()
    tests = ["Can I get a medium iced latte with oat milk?", "Sure. Anything else for you?",
             "I've read that book. Wanna grab a coffee later?", "service"]
    pss = [g.phonemize(t)[0] for t in tests]
    for model in ['/home/claude/kkdl/kokoro-v1.0.int8.onnx', '/home/claude/kkdl/kokoro-v1.0.onnx']:
        k = Kokoro(model)
        print(model, {n: (i.type, i.shape) for n, i in k.inputs.items()})
        k.synth(pss[0], 'af_heart')
        for t, ps in zip(tests, pss):
            t0 = time.time(); a = k.synth(ps, 'af_bella'); dt = time.time() - t0
            print(f'  {dt:.2f}s for {len(a)/SR:.2f}s audio  RTF {dt/(len(a)/SR):.2f}  {t}')
