"""Embed the few 2D images the 3D town draws on (sign icons, rooftop cards, fish) as base64 data URIs.
WebGL refuses images loaded from file:// (they count as cross-origin), but data URIs are fine.
Usage: python3 tools/pack_tex.py assets [bundle ...]  ->  assets/3d/js/tex_<bundle>.js
"""
import base64, io, json, sys
from pathlib import Path
from PIL import Image

A = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets')
GAMES = ['tien-len', 'phom', 'mau-binh', 'xi-dach', 'poker', 'bai-cao', 'sam-loc', 'lieng', 'bau-cua', 'xoc-dia', 'tai-xiu',
         'co-tuong', 'co-ca-ngua', 'co-caro', 'bai-mau', 'lo-to', 'ban-ca', 'day-xu']
items = {f'icon_{g}': (f'games/lobby-icons/{g}.png', 256, 'smooth') for g in GAMES}
items.update({
    'icon_shop': ('emoji-fluent-3d/game/shopping_bags.png', 256, 'smooth'), 'icon_rank': ('emoji-fluent-3d/game/trophy.png', 256, 'smooth'),
    'icon_event': ('emoji-fluent-3d/game/party_popper.png', 256, 'smooth'), 'icon_daily': ('emoji-fluent-3d/game/wrapped_gift.png', 256, 'smooth'),
    'icon_hall': ('emoji-fluent-3d/game/joystick.png', 256, 'smooth'), 'icon_pig': ('emoji-fluent-3d/animals/pig_face.png', 256, 'smooth'),
    'fish_a': ('emoji-fluent-3d/sea/tropical_fish.png', 256, 'smooth'), 'fish_b': ('emoji-fluent-3d/sea/blowfish.png', 256, 'smooth'),
    'fish_c': ('emoji-fluent-3d/sea/octopus.png', 256, 'smooth'),
})
for k, f in [('hA', 'hearts_A'), ('sK', 'spades_K'), ('hQ', 'hearts_Q'), ('sA', 'spades_A'), ('h2', 'hearts_02'), ('back', None)]:
    items['card_' + k] = (f'cards-heocon/cards/card_{f}.png' if f else 'cards-heocon/cards/card_back_pink.png', 288, 'smooth')
SUITS = ['spades', 'clubs', 'diamonds', 'hearts']
RANKS = ['A', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K']
BUNDLES = {'town': items}
BUNDLES['cards'] = {f'c_{s}_{r.lstrip("0")}': (f'cards-heocon/cards/card_{s}_{r}.png', 432, 'smooth') for s in SUITS for r in RANKS}
BUNDLES['cards'].update({'c_back': ('cards-heocon/cards/card_back_pink.png', 432, 'smooth'), 'c_back_black': ('cards-heocon/cards/card_back_black.png', 432, 'smooth')})
BUNDLES['chips'] = {f'chip_{v}': (f'games/card-shared/chips/chip_{v}.png', 160, 'smooth') for v in ['1k', '5k', '10k', '50k', '100k', '500k', '1m', '10m']}
BUNDLES['chips'].update({f'marker_{m}': (f'games/card-shared/chips/marker_{m}.png', 128, 'smooth') for m in ['d', 'sb', 'bb']})
BAU = ['nai', 'bau', 'ga', 'ca', 'cua', 'tom']
BUNDLES['bau-cua'] = {f'bc_face_{k}': (f'games/bau-cua/dice-faces/{k}.png', 256, 'smooth') for k in BAU}
BUNDLES['bau-cua'].update({f'bc_tile_{k}': (f'games/bau-cua/tiles/{k}.png', 256, 'smooth') for k in BAU})
BUNDLES['xoc-dia'] = {'xd_red': ('games/xoc-dia/coin_red.png', 160, 'smooth'), 'xd_white': ('games/xoc-dia/coin_white.png', 160, 'smooth')}
CT = ['general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier']
BUNDLES['co-tuong'] = {f'ct_{c}_{p}': (f'games/co-tuong/pieces-cute/{c}_{p}.png', 182, 'smooth') for c in ['red', 'black'] for p in CT}
BUNDLES['co-tuong']['ct_board'] = ('games/co-tuong/board_cute.png', 1024, 'smooth')
BUNDLES['co-ca-ngua'] = {'cn_board': ('games/co-ca-ngua/board.png', 1024, 'smooth')}
BUNDLES['co-ca-ngua'].update({f'cn_{c}': (f'games/co-ca-ngua/token_{c}.png', 120, 'smooth') for c in ['red', 'blue', 'green', 'yellow']})
BUNDLES['co-caro'] = {'cc_x': ('games/co-caro/piece_x.png', 128, 'smooth'), 'cc_o': ('games/co-caro/piece_o.png', 128, 'smooth')}
BUNDLES['bai-mau'] = {f'bm_{f.stem}': (f'games/bai-mau/cards/{f.name}', 220, 'smooth') for f in sorted((A / 'games/bai-mau/cards').glob('*.png'))}
SEA = ['tropical_fish', 'fish', 'blowfish', 'octopus', 'shark', 'whale', 'turtle', 'jellyfish', 'crab', 'dolphin', 'squid', 'lobster', 'shrimp', 'seal', 'spiral_shell']
BUNDLES['ban-ca'] = {f'sea_{k}': (f'emoji-fluent-3d/sea/{k}.png', 256, 'smooth') for k in SEA}
BUNDLES['ban-ca'].update({f'bc_cannon_{i}': (f'games/ban-ca/{n}', 256, 'smooth') for i, n in enumerate(['cannon_lv1_pink.png', 'cannon_lv2_mint.png', 'cannon_lv3_sky.png', 'cannon_lv4_lavender.png', 'cannon_lv5_gold.png'], 1)})
BUNDLES['ban-ca'].update({'bc_net': ('games/ban-ca/net.png', 220, 'smooth'), 'bc_bullet': ('games/ban-ca/bullet.png', 96, 'smooth')})
BUNDLES['lo-to'] = {'lt_heart': ('games/lo-to/marker_heart.png', 128, 'smooth')}
want = set(sys.argv[2:])
for bname, bitems in BUNDLES.items():
  if want and bname not in want: continue
  out = []
  total = 0
  for key, (path, size, mode) in bitems.items():
    im = Image.open(A / path).convert('RGBA')
    if mode == 'pixel':
        im = im.resize((im.width * size, im.height * size), Image.NEAREST)
    else:
        im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    b = base64.b64encode(buf.getvalue()).decode(); total += len(b)
    out.append(f'T[{json.dumps(key)}]="data:image/png;base64,{b}";')
  js = '(function(){var T=window.HC_TEX=window.HC_TEX||{};\n' + '\n'.join(out) + '\n})();\n'
  (A / f'3d/js/tex_{bname}.js').write_text(js)
  print(f'{bname}: {len(bitems)} textures, {round(total / 1024)} KB base64')
