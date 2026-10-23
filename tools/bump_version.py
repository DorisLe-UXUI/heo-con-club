"""Stamp a new release id into js/hc-core.js so browsers re-download pictures and data after an update.
Run before committing a release: python3 -E tools/bump_version.py
"""
import re, time
from pathlib import Path
p = Path(__file__).resolve().parent.parent / 'js' / 'hc-core.js'
s = p.read_text(encoding='utf-8')
v = time.strftime('%Y%m%d%H%M')
s2, n = re.subn(r"const V = 'v=[0-9]+';", f"const V = 'v={v}';", s)
assert n == 1, 'version line not found'
p.write_text(s2, encoding='utf-8')
for h in p.parent.parent.glob('*.html'):                 # static <img>/CSS urls that carry ?v=
    t = h.read_text(encoding='utf-8'); t2 = re.sub(r'\?v=[0-9]{10,12}', '?v=' + v, t)
    if t2 != t: h.write_text(t2, encoding='utf-8')
print('version', v)
