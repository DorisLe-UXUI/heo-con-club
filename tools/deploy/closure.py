"""Find every project file the game pages can load (static scan, template literals expanded as globs)."""
import re, os, glob, json, sys
from pathlib import Path
from urllib.parse import unquote
ROOT = Path('.').resolve()
ENTRY = ['index.html', 'play3d.html', 'pusher.html', 'lobby.html', 'tien-len.html']
EXT = r'(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg|m4a|ttf|otf|woff2?|js|json|glb|css)'
STR = re.compile(r"""(['"`])((?:(?!\1)[^\n\\])*?\.""" + EXT + r""")(?:\?[^'"`]*)?\1""")
URL = re.compile(r"""url\(\s*["']?([^"')]+?\.""" + EXT + r""")["']?\s*\)""")
SRC = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+?\.""" + EXT + r""")["']""")
found, todo, unresolved = set(), list(ENTRY), set()
ALLSRC = '\n'.join(open(f, encoding='utf-8', errors='ignore').read() for f in ENTRY + glob.glob('js/**/*.js', recursive=True) if os.path.getsize(f) < 3_000_000)
def resolve(p, frm):
    p = unquote(p.strip()).split('?')[0].split('#')[0]
    if p.startswith(('http:', 'https:', 'data:', '//')): return []
    p = re.sub(r'\$\{[^}]*\}', '*', p)
    if '*' not in p and ('${' in p or '+' in p): return []
    cands = [p, 'assets/' + p, str(Path(frm).parent / p)]
    out = []
    for c in cands:
        c = os.path.normpath(c)
        if c.startswith('..'): continue
        if '*' in c:
            g = [x for x in glob.glob(c, recursive=True) if os.path.isfile(x)]
            rx = re.compile('^' + re.escape(c).replace(r'\*', '([^/]*)') + '$')
            keep = []
            for x in g:
                m = rx.match(x)
                if m and all(re.search(r'(?<![\w-])' + re.escape(part) + r'(?![\w-])', ALLSRC) for part in m.groups() if part): keep.append(x)
            if g: out += keep; break
        elif os.path.isfile(c): out.append(c); break
    if not out: unresolved.add((p, frm))
    return out
while todo:
    f = todo.pop()
    if f in found: continue
    found.add(f)
    if not f.endswith(('.html', '.js', '.css', '.json')) or os.path.getsize(f) > 3_000_000 and f.endswith('.js') and '/3d/js/' in f: continue
    s = open(f, encoding='utf-8', errors='ignore').read()
    refs = [m.group(2) for m in STR.finditer(s)] + URL.findall(s) + SRC.findall(s)
    for r in refs:
        for x in resolve(r, f):
            if x not in found: todo.append(x)
# paths assembled at runtime from 'folder/name' tokens (e.g. emotes 'reactions/partying_face')
TOK = set(re.findall(r'[A-Za-z0-9_][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_.-]+)+', ALLSRC))
TOK |= {t.rsplit('.', 1)[0] for t in TOK}
for f in glob.glob('assets/**/*', recursive=True):
    if f in found or not os.path.isfile(f): continue
    rel = f[7:]; parts = rel.split('/')
    stem = os.path.splitext(rel)[0]
    # match 'cat/name' or 'cat/name.ext' (any tail of at least two path parts)
    tails = {'/'.join(parts[i:]) for i in range(len(parts) - 1)} | {os.path.splitext('/'.join(parts[i:]))[0] for i in range(len(parts) - 1)}
    if any(t in TOK and len(t) > 8 for t in tails): found.add(f)
# 'dir/' + name + '.png' concatenations: small folders whole, big folders by names that appear in the code
for pre in set(re.findall(r"['\"`]([A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/)['\"`]\s*\+", ALLSRC)):
    d = 'assets/' + pre if os.path.isdir('assets/' + pre) else pre
    if not os.path.isdir(d): continue
    fs = [x for x in glob.glob(d + '*') if os.path.isfile(x)]
    for x in fs:
        stem = os.path.splitext(os.path.basename(x))[0]
        if len(fs) <= 40 or re.search(r"['\"`]" + re.escape(stem) + r"['\"`]", ALLSRC): found.add(x)
files = sorted(found)
size = sum(os.path.getsize(f) for f in files)
big = sorted(files, key=os.path.getsize, reverse=True)[:15]
json.dump(files, open(sys.argv[1], 'w'), indent=0)
print('files', len(files), 'MB', round(size / 1e6, 1))
print('largest:'); [print(f'  {os.path.getsize(f)/1e6:6.2f} MB  {f}') for f in big]
from collections import Counter
print('by top dir:', Counter(f.split('/')[1] if f.startswith('assets/') else f.split('/')[0] for f in files).most_common(14))
print('unresolved sample:', sorted(unresolved)[:25])
