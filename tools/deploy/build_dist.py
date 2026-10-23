"""Build a self-contained copy of the game for publishing as a multi-file Artifact.
Run from the project root: python3 -E build_dist.py <plan.json> <out_dir>
- main entry index.html becomes home.html; a tiny launcher (launch.html) is the artifact page
- the ~200 smallest images that are only loaded through A() go into assets/pack.js as data URIs
- paths with brackets/spaces are renamed so every published path is plain ASCII
"""
import sys, os, re, json, shutil, base64, glob
from urllib.parse import quote
plan, OUT = json.load(open(sys.argv[1])), sys.argv[2]
files = sorted(set(plan['files']) | set(glob.glob('assets/3d/js/*.js')) | {'CREDITS.md'})
pack = set(sorted(plan['pack'], key=os.path.getsize)[:200])
safe = lambda p: re.sub(r'-+', '-', re.sub(r'[^A-Za-z0-9._/-]', '-', p))
ren = {f: safe(f) for f in files if safe(f) != f}
dest = lambda f: 'home.html' if f == 'index.html' else ren.get(f, f)
TEXT = ('.html', '.js', '.css', '.json')
# replacement pairs: every spelling of a renamed path, longest first
pairs = []
for f, g in ren.items():
    for a, b in ((f, g), (f[7:], g[7:])) if f.startswith('assets/') else ((f, g),):
        pairs += [(quote(a, safe='/'), b), (a, b)]
pairs = sorted(set(pairs), key=lambda x: -len(x[0]))
shutil.rmtree(OUT, ignore_errors=True)
PACK_TAG = '<script src="assets/pack.js"></script>'
for f in files:
    if f in pack: continue
    d = os.path.join(OUT, dest(f)); os.makedirs(os.path.dirname(d), exist_ok=True)
    if f.endswith(TEXT) and os.path.getsize(f) < 1_500_000:
        s = open(f, encoding='utf-8').read()
        for a, b in pairs: s = s.replace(a, b)
        if f.endswith('.html') or f.startswith('js/'): s = s.replace('index.html', 'home.html')
        if f == 'js/hc-core.js':
            old = "const A = p => /^(data:|blob:|https?:)/.test(p) ? p : (window.HC_ASSET_BASE || 'assets/') + p.split('/').map(encodeURIComponent).join('/') + '?' + V;"
            assert old in s; s = s.replace(old, "const A = p => /^(data:|blob:|https?:)/.test(p) ? p : (window.HC_PACK && window.HC_PACK[p]) || (window.HC_ASSET_BASE || 'assets/') + p.split('/').map(encodeURIComponent).join('/') + '?' + V;")
        if f == 'tien-len.html':
            old = "const A = window.HC ? HC.A : p => 'assets/' + p.split('/').map(encodeURIComponent).join('/');"   # HC.A already reads the pack
            assert old in s; s = s.replace(old, "const A = window.HC ? HC.A : p => (window.HC_PACK && window.HC_PACK[p]) || 'assets/' + p.split('/').map(encodeURIComponent).join('/');")
        if f.endswith('.html'):
            i = s.index('<script'); s = s[:i] + PACK_TAG + '\n' + s[i:]
        open(d, 'w', encoding='utf-8').write(s)
    else:
        shutil.copy2(f, d)
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
entries = {dest(f)[7:]: f'data:{MIME[os.path.splitext(f)[1].lower()]};base64,' + base64.b64encode(open(f, 'rb').read()).decode() for f in sorted(pack)}
os.makedirs(os.path.join(OUT, 'assets'), exist_ok=True)
open(os.path.join(OUT, 'assets/pack.js'), 'w').write('window.HC_PACK=Object.assign(window.HC_PACK||{},' + json.dumps(entries) + ');\n')
shutil.copy2(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'launch.html'), os.path.join(OUT, 'launch.html'))
out = sorted(os.path.relpath(p, OUT) for p in glob.glob(OUT + '/**/*', recursive=True) if os.path.isfile(p))
print('renamed', len(ren), {k: v for k, v in list(ren.items())[:6]})
print('files', len(out), 'MB', round(sum(os.path.getsize(os.path.join(OUT, p)) for p in out) / 1e6, 1), 'pack MB', round(os.path.getsize(OUT + '/assets/pack.js') / 1e6, 2))
