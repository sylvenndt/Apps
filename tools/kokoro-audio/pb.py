"""Tiny protobuf wire-format reader/writer, enough to inspect and rewire an ONNX graph
without the onnx package."""
def rv(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i
def wv(n):
    out = bytearray()
    while True:
        c = n & 0x7f; n >>= 7
        if n: out.append(c | 0x80)
        else: out.append(c); return bytes(out)
def fields(b):
    """yield (field_no, wire_type, value_bytes_or_int, raw_slice)"""
    i, n = 0, len(b)
    while i < n:
        st = i
        tag, i = rv(b, i); f, w = tag >> 3, tag & 7
        if w == 0: v, i = rv(b, i)
        elif w == 1: v = b[i:i+8]; i += 8
        elif w == 5: v = b[i:i+4]; i += 4
        elif w == 2:
            l, i = rv(b, i); v = b[i:i+l]; i += l
        else: raise ValueError('wire type %d' % w)
        yield f, w, v, b[st:i]
def ld(f, payload):  # length-delimited field
    return wv((f << 3) | 2) + wv(len(payload)) + payload
def vint(f, n):
    return wv(f << 3) + wv(n)
def node_info(nb):
    d = {'in': [], 'out': [], 'name': '', 'op': ''}
    for f, w, v, _ in fields(nb):
        if f == 1: d['in'].append(bytes(v).decode())
        elif f == 2: d['out'].append(bytes(v).decode())
        elif f == 3: d['name'] = bytes(v).decode()
        elif f == 4: d['op'] = bytes(v).decode()
    return d
def rebuild_node(nb, ren_in):
    out = bytearray()
    for f, w, v, raw in fields(nb):
        if f == 1:
            s = bytes(v).decode(); out += ld(1, ren_in.get(s, s).encode())
        else: out += raw
    return bytes(out)
def value_info(name, elem=1, dims=None):
    shape = b''
    if dims is not None:
        for dname in dims:
            shape += ld(1, ld(2, dname.encode()) if isinstance(dname, str) else vint(1, dname))
    tt = vint(1, elem) + (ld(2, shape) if dims is not None else b'')
    return ld(1, name.encode()) + ld(2, ld(1, tt))
