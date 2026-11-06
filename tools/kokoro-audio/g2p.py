"""Kokoro-compatible G2P without spaCy: misaki lexicon (gold/silver) + NLTK-style
averaged-perceptron POS tagger + espeak-ng (local build) fallback for OOV words."""
import sys, types, re, json, subprocess, os
from collections import defaultdict

MISAKI = '/home/claude/src/misaki'
ESPEAK_BIN = '/home/claude/src/espeak-ng/build/src/espeak-ng'
ESPEAK_DATA = '/home/claude/src/espeak-ng/build/espeak-ng-data'
APT = '/home/claude/nltkdl/apt/averaged_perceptron_tagger_eng/averaged_perceptron_tagger_eng'

# ---------- subtokenizer (replacement for the `regex`-based one in misaki) ----------
L = r"[^\W\d_]"
SUB_RE = re.compile(
    r"^['‘’]+|[A-Z](?=[A-Z][a-z])|(?:^-)?(?:\d?[,.]?\d)+|[-_]+|['‘’]{2,}|"
    + L + r"*?(?:['‘’]" + L + r")*?[a-z](?=[A-Z])|" + L + r"+(?:['‘’]" + L + r")*|(?=\W)[^-'‘’]|['‘’]+$")

def _stub(name, **attrs):
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m

def _no_num(*a, **k):
    raise RuntimeError('numbers not supported in this corpus')

class _ADict(dict):
    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError:
            raise AttributeError(k)
    def __setattr__(self, k, v):
        self[k] = v
_stub('addict', Dict=_ADict)
_stub('spacy')
_stub('torch')
_stub('transformers', BartForConditionalGeneration=object)
_stub('num2words', num2words=_no_num)
_stub('regex', compile=lambda p: p, findall=lambda p, w: SUB_RE.findall(w))
sys.path.insert(0, MISAKI)
from misaki import en  # noqa: E402
from misaki.token import MToken  # noqa: E402

# ---------- POS tagger ----------
class Tagger:
    START = ['-START-', '-START2-']
    END = ['-END-', '-END2-']

    def __init__(self):
        self.weights = json.load(open(APT + '.weights.json'))
        self.tagdict = json.load(open(APT + '.tagdict.json'))
        self.classes = json.load(open(APT + '.classes.json'))

    def predict(self, features):
        scores = defaultdict(float)
        for feat, value in features.items():
            if feat not in self.weights or value == 0:
                continue
            for label, weight in self.weights[feat].items():
                scores[label] += value * weight
        return max(self.classes, key=lambda label: (scores[label], label))

    @staticmethod
    def normalize(word):
        if '-' in word and word[0] != '-':
            return '!HYPHEN'
        if word.isdigit() and len(word) == 4:
            return '!YEAR'
        if word and word[0].isdigit():
            return '!DIGITS'
        return word.lower()

    def features(self, i, word, context, prev, prev2):
        f = defaultdict(int)
        def add(name, *args):
            f[' '.join((name,) + tuple(args))] += 1
        i += len(self.START)
        add('bias')
        add('i suffix', word[-3:])
        add('i pref1', word[0] if word else '')
        add('i-1 tag', prev)
        add('i-2 tag', prev2)
        add('i tag+i-2 tag', prev, prev2)
        add('i word', context[i])
        add('i-1 tag+i word', prev, context[i])
        add('i-1 word', context[i - 1])
        add('i-1 suffix', context[i - 1][-3:])
        add('i-2 word', context[i - 2])
        add('i+1 word', context[i + 1])
        add('i+1 suffix', context[i + 1][-3:])
        add('i+2 word', context[i + 2])
        return f

    def tag(self, tokens):
        prev, prev2 = self.START
        out = []
        context = self.START + [self.normalize(w) for w in tokens] + self.END
        for i, word in enumerate(tokens):
            t = self.tagdict.get(word)
            if not t:
                t = self.predict(self.features(i, word, context, prev, prev2))
            out.append(t)
            prev2, prev = prev, t
        return out

# ---------- PTB-style tokenizer ----------
LEAD = set('"“‘([\'')
TRAIL = set('.,!?;:"”’)]…\'')
PUNCT_TAG = {'.': '.', '!': '.', '?': '.', '…': ':', '...': ':', ',': ',', ';': ':', ':': ':', '—': ':', '–': ':', '-': ':',
             '"': "''", '“': '``', '”': "''", '‘': '``', '’': "''", "'": "''", '(': '-LRB-', ')': '-RRB-', '[': '-LRB-', ']': '-RRB-'}
CONTR = re.compile(r"(?i)^(.+?)(n't|'s|'m|'re|'ve|'ll|'d)$")
SPECIAL = {'gonna': ('gon', 'na'), 'wanna': ('wan', 'na'), 'gotta': ('got', 'ta'), 'cannot': ('can', 'not'),
           'gimme': ('gim', 'me'), 'lemme': ('lem', 'me'), 'dunno': ('du', 'n', 'no')}

def ptb_tokens(text):
    """-> list of (text, whitespace_after)"""
    out = []
    for m in re.finditer(r'(\S+)(\s*)', text):
        chunk, ws = m.group(1), m.group(2)
        chunk = chunk.replace('’', "'").replace('‘', "'")
        pre, post = [], []
        while chunk and (chunk[0] in LEAD) and len(chunk) > 1:
            pre.append(chunk[0]); chunk = chunk[1:]
        while chunk and len(chunk) > 1:
            if chunk.endswith('...'):
                post.insert(0, '...'); chunk = chunk[:-3]; continue
            if chunk[-1] in TRAIL and not re.search(r"\w'$", chunk) or (chunk[-1] in TRAIL and chunk[-1] != "'"):
                post.insert(0, chunk[-1]); chunk = chunk[:-1]; continue
            break
        mid = []
        low = chunk.lower()
        if low in SPECIAL:
            parts, i = [], 0
            for p in SPECIAL[low]:
                parts.append(chunk[i:i + len(p)]); i += len(p)
            mid = parts
        else:
            mm = CONTR.match(chunk)
            if mm and re.match(r"^[A-Za-z]", chunk):
                a, b = mm.group(1), mm.group(2)
                if b.lower() == "n't" and a.lower() in ('ca', 'wo', 'sha', 'ai'):
                    mid = [a, b]
                elif b.lower() == "n't":
                    mid = [a, b]
                else:
                    mid = [a, b]
            else:
                mid = [chunk] if chunk else []
        toks = pre + mid + post
        for j, t in enumerate(toks):
            out.append((t, ws if j == len(toks) - 1 else ''))
    return out

POS_HINT = {'名词': 'NN', '动词': 'VB', '形容词': 'JJ', '副词': 'RB', '介词': 'IN', '连词': 'CC', '代词': 'PRP', '感叹词': 'UH'}

class EspeakFallback:
    E2M = en_E2M = None

    def __init__(self, british):
        self.british = british
        self.cache = {}
        import misaki  # noqa
        # same mapping table misaki uses (copied to avoid importing phonemizer)
        self.E2M = sorted({
            'ʔˌn̩': 'ʔn', 'ʔn̩': 'ʔn', 'a^ɪ': 'I', 'a^ʊ': 'W', 'd^ʒ': 'ʤ', 'e^ɪ': 'A', 'e': 'A',
            't^ʃ': 'ʧ', 'ɔ^ɪ': 'Y', 'ə^l': 'ᵊl', 'ʲo': 'jo', 'ʲə': 'jə', 'ʲ': '', 'ɚ': 'əɹ', 'r': 'ɹ',
            'x': 'k', 'ç': 'k', 'ɐ': 'ə', 'ɬ': 'l', '̃': '',
        }.items(), key=lambda kv: -len(kv[0]))

    def __call__(self, token):
        text = token.text
        if text in self.cache:
            return self.cache[text]
        env = dict(os.environ, ESPEAK_DATA_PATH=ESPEAK_DATA)
        r = subprocess.run([ESPEAK_BIN, '-q', '--ipa', '--tie=^', '-v', 'en-gb' if self.british else 'en-us', text],
                           capture_output=True, text=True, env=env)
        ps = ' '.join(r.stdout.split()).strip()
        if not ps:
            self.cache[text] = (None, None)
            return None, None
        for old, new in self.E2M:
            ps = ps.replace(old, new)
        ps = re.sub(r'(\S)̩', r'ᵊ\1', ps).replace(chr(809), '')
        if self.british:
            ps = ps.replace('e^ə', 'ɛː').replace('iə', 'ɪə').replace('ə^ʊ', 'Q')
        else:
            ps = ps.replace('o^ʊ', 'O').replace('ɜːɹ', 'ɜɹ').replace('ɜː', 'ɜɹ').replace('ɪə', 'iə').replace('ː', '')
        ps = ps.replace('o', 'ɔ')
        ps = ps.replace('ɾ', 'T').replace('ʔ', 't').replace('^', '')
        self.cache[text] = (ps, 2)
        return ps, 2

class G2P(en.G2P):
    def __init__(self, british=False, tagger=None):
        self.version = None
        self.british = british
        self.lexicon = en.Lexicon(british)
        self.fallback = EspeakFallback(british)
        self.unk = ''
        self.tagger = tagger or Tagger()
        self.pos_hint = None
        self.oov = defaultdict(int)

    def tokenize(self, text, tokens, features):
        pt = ptb_tokens(text)
        words = [t for t, _ in pt]
        tags = self.tagger.tag(words)
        out = []
        for (t, ws), tg in zip(pt, tags):
            if t in PUNCT_TAG:
                tg = PUNCT_TAG[t]
            out.append(MToken(text=t, tag=tg, whitespace=ws,
                              _=MToken.Underscore(is_head=True, num_flags='', prespace=False)))
        if self.pos_hint and len([x for x in out if x.tag not in PUNCT_TAG.values()]) == 1:
            for x in out:
                if x.tag not in PUNCT_TAG.values():
                    x.tag = self.pos_hint
        return out

    def phonemize(self, text, pos_hint=None):
        self.pos_hint = pos_hint
        text = text.replace('…', '...').replace('é', 'e') if False else text
        _fb = self.fallback
        def counting(tk):
            self.oov[tk.text] += 1
            return _fb(tk)
        self.fallback = counting
        try:
            ps, toks = self(text)
        finally:
            self.fallback = _fb
        ps = re.sub(r'\s+', ' ', ps).strip()
        return ps, toks

if __name__ == '__main__':
    g = G2P()
    b = G2P(british=True, tagger=g.tagger)
    for s in sys.argv[1:] or ["I've read that book. Wanna grab a coffee later?",
                              "Can I get a medium iced latte with oat milk?",
                              "I don't live here, I just used to work nearby.",
                              "So… what are we, exactly?", "You should check out this new café.",
                              "We're gonna close the store at nine, so let's record it now.",
                              "Hey! This is how I sound."]:
        print(s); print('  US', g.phonemize(s)[0]); print('  GB', b.phonemize(s)[0])
    print('oov', dict(g.oov), dict(b.oov))
