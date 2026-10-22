import json, sys, os, glob
from urllib.parse import quote
files = sorted(set(json.load(open(sys.argv[1]))) | set(glob.glob('assets/3d/js/*.js')))
ENTRY = ['index.html', 'play3d.html', 'pusher.html', 'lobby.html', 'tien-len.html']
ALL = '\n'.join(open(f, encoding='utf-8', errors='ignore').read() for f in ENTRY + glob.glob('js/**/*.js', recursive=True) if os.path.getsize(f) < 3_000_000)
img = [f for f in files if f.startswith('assets/') and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and f not in ALL and quote(f, safe='/') not in ALL]
json.dump({'files': files, 'pack': img}, open(sys.argv[2], 'w'))
print('total', len(files), 'packable', len(img))
