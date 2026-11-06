"""Emotion presets for Kokoro: pitch shift (semitones), pitch range, speed, energy, breathiness,
tremor, pause stretch and level. All applied to the model's own predicted prosody, so each voice
keeps its timbre and natural intonation shape."""
import numpy as np
from emo import EmoKokoro, SR
# key: (shift_st, range, speed, energy_add, breath, tremor_st, pause, gain_db)
P = {
  'neutral':     (0.0, 1.00, 1.00, 0.0, 0.00, 0.0, 1.0, 0.0),
  'polite':      (0.5, 1.05, 0.99, 0.2, 0.00, 0.0, 1.0, 0.0),
  'friendly':    (1.0, 1.15, 1.00, 0.3, 0.00, 0.0, 1.0, 0.0),
  'cheerful':    (2.0, 1.30, 1.05, 0.5, 0.00, 0.0, 1.0, 0.5),
  'excited':     (3.5, 1.50, 1.12, 1.0, 0.00, 0.0, 0.85, 1.5),
  'surprised':   (3.0, 1.60, 0.98, 0.8, 0.00, 0.0, 1.0, 1.0),
  'playful':     (1.5, 1.40, 1.03, 0.4, 0.05, 0.0, 1.0, 0.0),
  'flirty':      (0.3, 1.25, 0.90, 0.0, 0.30, 0.0, 1.15, -1.0),
  'tender':      (-0.5, 0.90, 0.90, -0.3, 0.35, 0.0, 1.2, -1.5),
  'caring':      (-0.8, 0.85, 0.92, -0.3, 0.20, 0.0, 1.15, -1.0),
  'grateful':    (0.8, 1.10, 0.95, 0.2, 0.15, 0.0, 1.0, 0.0),
  'apologetic':  (-0.6, 0.80, 0.95, -0.4, 0.10, 0.0, 1.1, -1.0),
  'embarrassed': (0.8, 0.85, 1.08, -0.2, 0.15, 0.3, 1.0, -1.0),
  'sad':         (-2.0, 0.60, 0.84, -1.0, 0.25, 0.0, 1.5, -2.5),
  'disappointed':(-1.3, 0.70, 0.90, -0.6, 0.10, 0.0, 1.3, -1.5),
  'tired':       (-2.5, 0.50, 0.86, -1.0, 0.25, 0.0, 1.3, -2.5),
  'worried':     (0.8, 0.80, 1.02, -0.2, 0.15, 0.3, 1.1, -0.5),
  'nervous':     (1.8, 0.85, 1.12, 0.0, 0.10, 0.6, 0.9, -0.5),
  'scared':      (2.8, 0.95, 1.12, 0.0, 0.30, 0.9, 0.9, -1.0),
  'urgent':      (2.0, 1.20, 1.15, 1.2, 0.00, 0.0, 0.8, 1.5),
  'annoyed':     (0.3, 1.15, 1.08, 0.8, 0.00, 0.0, 0.9, 0.5),
  'angry':       (1.0, 1.35, 1.03, 1.5, 0.00, 0.0, 0.9, 2.0),
  'confident':   (-0.6, 1.10, 0.97, 0.6, 0.00, 0.0, 1.0, 0.5),
  'curious':     (1.5, 1.25, 1.00, 0.3, 0.00, 0.0, 1.0, 0.0),
  'relieved':    (-0.8, 0.90, 0.90, -0.3, 0.20, 0.0, 1.25, -0.5),
  'whisper':     (0.0, 1.00, 0.95, 0.0, 1.00, 0.0, 1.1, -4.0),
}
PUNCT = {1, 2, 3, 4, 5, 6, 9, 10}
FPS = 80.0  # F0 frames per second

def shape_f0(F0, shift, rng, tremor, rate=5.5, seed=0):
    F = F0.astype(np.float64).copy(); v = F > 60
    if v.any():
        lf = np.log(F[v]); m = lf.mean()
        F[v] = np.exp(m + rng * (lf - m) + shift * np.log(2) / 12)
        t = (F0 > 10) & ~v; F[t] = F0[t] * 2 ** (shift / 12)
        if tremor:
            n = F.shape[-1]; ph = np.random.default_rng(seed).uniform(0, 6.28)
            rate_t = rate + 0.6 * np.sin(np.arange(n) / FPS * 1.3)
            mod = 2 ** (tremor * np.sin(2 * np.pi * np.cumsum(rate_t) / FPS + ph) / 12)
            F = np.where(F > 10, F * mod, F)
    return F.astype(np.float32)

class EmoVoice(EmoKokoro):
    def render(self, ps, voice, emo='neutral', seed=0):
        sh, rng, speed, nadd, breath, trem, pause, gain = P.get(emo, P['neutral'])
        f, toks = self.stages(ps, voice, speed)
        dur = self.run('D', f)[0]
        if pause != 1.0:
            ids = np.array([0, *toks, 0])
            m = np.isin(ids, list(PUNCT)) & (np.arange(len(ids)) < len(ids) - 2)  # not the final mark
            dur = dur.copy(); dur[0, m] = np.maximum(1, np.round(dur[0, m] * pause))
        F0, N = self.run('P', {**f, 'dur_in': dur})
        Fm = shape_f0(F0, sh, rng, trem, seed=seed)
        Nm = N.copy(); Nm[N > -2] += nadd
        feed = {**f, 'dur_in': dur, 'N_in': Nm.astype(np.float32)}
        a = None
        if breath < 1.0:
            a = self.run('B', {**feed, 'F0_in': Fm})[0].reshape(-1).astype(np.float64)
        if breath > 0:
            w = self.run('B', {**feed, 'F0_in': np.zeros_like(Fm)})[0].reshape(-1).astype(np.float64)
            if a is None: a = w
            else:
                # match loudness of the whispered layer before mixing it in
                ra, rw = np.sqrt(np.mean(a ** 2)) + 1e-9, np.sqrt(np.mean(w ** 2)) + 1e-9
                a = (1 - breath) * a + breath * w * (ra / rw) * 0.8
        return a.astype(np.float32), gain
