"""Cờ Tướng, Cờ Cá Ngựa, Bắn Cá generated assets (+ Fluent sea creatures download).
Usage: python3 -E gen_boards.py <assets_dir> <fluent-3d.txt>
"""
import sys, math, random, re, urllib.parse, urllib.request, concurrent.futures as cf
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
sys.path.insert(0, str(Path(__file__).parent))
from gfx import *

A = Path(sys.argv[1])
G = A / 'games'
F = A / 'fonts'
CB = COINY = F / 'GrandstanderBlack-Regular.ttf'  # Cherry Bomb One draws Đ/ừ/ứ/ử/ữ/ự wrong; Coiny draws V like U
WENKAI, KUAILE = F / 'LXGWWenKaiTC-Bold.ttf', F / 'ZCOOLKuaiLe-Regular.ttf'
FL = A / 'emoji-fluent-3d'
made = 0


def S(im, rel):
    global made
    save(im, G / rel); made += 1
    return im


# =============================================================== CỜ TƯỚNG
NAMES = ['general', 'advisor', 'elephant', 'chariot', 'horse', 'cannon', 'soldier']
CHARS = {
    'classic': {'red': '帥仕相俥傌炮兵', 'black': '將士象車馬砲卒'},
    'cute': {'red': '帅仕相车马炮兵', 'black': '将士象车马炮卒'},
}


def xq_piece(ch, side, style, d=160):
    D = d * SS
    im = new(D, D)
    dp = D * 0.07
    if style == 'classic':
        light, base, dark = '#fbe6be', '#e3b06b', '#8a5a26'
        ink = '#c8231d' if side == 'red' else '#1f1a24'
    else:
        light, base, dark = (('#ffe3ef', '#ff9cc4', '#c2407a') if side == 'red' else ('#e2efff', '#8cb8f0', '#3a62a8'))
        ink = '#c2407a' if side == 'red' else '#2f4f8f'
    fill_mask(im, solid(D, D, dark), mask_ellipse(D, D, (0, dp, D - 1, D - 1)))
    fill_mask(im, rad_grad(D, D, light, base, 0.38, 0.3, 0.85, 0.85, 1.1), mask_ellipse(D, D, (0, 0, D - 1, D - 1 - dp)))
    inner_box = (D * 0.12, D * 0.11, D * 0.88, D * 0.87 - dp)
    if style == 'classic':
        fill_mask(im, rad_grad(D, D, '#fff4dc', '#f1cf95', 0.4, 0.35, 0.8, 0.8), mask_ellipse(D, D, inner_box))
        ImageDraw.Draw(im).ellipse(inner_box, outline=rgb(ink), width=int(D * 0.022))
    else:
        fill_mask(im, solid(D, D, '#ffffff'), mask_ellipse(D, D, inner_box))
        ImageDraw.Draw(im).ellipse(inner_box, outline=rgb(ink, 120), width=int(D * 0.018))
    fill_mask(im, lin_grad(D, D, (255, 255, 255, 140), (255, 255, 255, 0)), mask_ellipse(D, D, (D * 0.2, D * 0.05, D * 0.8, D * 0.4)))
    f = font(WENKAI if style == 'classic' else KUAILE, int(D * (0.5 if style == 'classic' else 0.48)))
    ImageDraw.Draw(im).text((D / 2, (inner_box[1] + inner_box[3]) / 2 + D * 0.005), ch, font=f, fill=rgb(ink), anchor='mm')
    return with_shadow(down(im, d, d), blur=5, alpha=0.25, dy=4)


for style in ('classic', 'cute'):
    for side in ('red', 'black'):
        for name, ch in zip(NAMES, CHARS[style][side]):
            S(xq_piece(ch, side, style), f'co-tuong/pieces-{style}/{side}_{name}.png')


def xq_board(style='classic', cell=90, margin=70):
    w, h = cell * 8 + margin * 2, cell * 9 + margin * 2
    W, H, C, M = w * SS, h * SS, cell * SS, margin * SS
    if style == 'classic':
        bg = rad_grad(W, H, '#f8dfae', '#e2b46e', 0.5, 0.45, 0.8, 0.8)
        line, river_c, frame = '#7a4a1e', '#7a4a1e', '#8a5a26'
    else:
        bg = rad_grad(W, H, '#fff4f8', '#ffd6e7', 0.5, 0.45, 0.8, 0.8)
        line, river_c, frame = '#e07aa6', '#ff6fa8', '#ff9cc4'
    im = new(W, H)
    fill_mask(im, bg, mask_rr(W, H, (0, 0, W - 1, H - 1), 40 * SS))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8 * SS, 8 * SS, W - 8 * SS, H - 8 * SS), radius=34 * SS, outline=rgb(frame), width=10 * SS)
    lw = int(3 * SS)
    X = lambda c: M + c * C
    Y = lambda r: M + r * C
    for r in range(10):
        d.line((X(0), Y(r), X(8), Y(r)), fill=rgb(line), width=lw)
    for c in range(9):
        if c in (0, 8):
            d.line((X(c), Y(0), X(c), Y(9)), fill=rgb(line), width=lw)
        else:
            d.line((X(c), Y(0), X(c), Y(4)), fill=rgb(line), width=lw)
            d.line((X(c), Y(5), X(c), Y(9)), fill=rgb(line), width=lw)
    d.rectangle((X(0) - 8 * SS, Y(0) - 8 * SS, X(8) + 8 * SS, Y(9) + 8 * SS), outline=rgb(line), width=int(5 * SS))
    for r0 in (0, 7):
        d.line((X(3), Y(r0), X(5), Y(r0 + 2)), fill=rgb(line), width=lw)
        d.line((X(5), Y(r0), X(3), Y(r0 + 2)), fill=rgb(line), width=lw)
    # position marks
    def mark(c, r):
        g, L = 6 * SS, 14 * SS
        for sx in (-1, 1):
            if (c == 0 and sx == -1) or (c == 8 and sx == 1):
                continue
            for sy in (-1, 1):
                x, y = X(c) + sx * g, Y(r) + sy * g
                d.line((x, y, x + sx * L, y), fill=rgb(line), width=lw)
                d.line((x, y, x, y + sy * L), fill=rgb(line), width=lw)
    for c, r in ((1, 2), (7, 2), (1, 7), (7, 7)):
        mark(c, r)
    for c in (0, 2, 4, 6, 8):
        mark(c, 3); mark(c, 6)
    im = down(im, w, h)
    if style == 'classic':
        fr = font(WENKAI, 56); left, right = '楚 河', '漢 界'
        ImageDraw.Draw(im).text((margin + cell * 2, margin + cell * 4.5), left, font=fr, fill=rgb(river_c), anchor='mm')
        ImageDraw.Draw(im).text((margin + cell * 6, margin + cell * 4.5), right, font=fr, fill=rgb(river_c), anchor='mm')
    else:
        fr = font(KUAILE, 56)
        ImageDraw.Draw(im).text((margin + cell * 2, margin + cell * 4.5), '楚 河', font=fr, fill=rgb(river_c), anchor='mm')
        ImageDraw.Draw(im).text((margin + cell * 6, margin + cell * 4.5), '汉 界', font=fr, fill=rgb(river_c), anchor='mm')
        for x in (margin + cell * 4,):
            paste_c(im, load(FL / 'tet' / 'cherry_blossom.png', 52), x, margin + cell * 4.5)
    return im


S(xq_board('classic'), 'co-tuong/board_classic.png')
S(xq_board('cute'), 'co-tuong/board_cute.png')
# setup preview (pieces placed)
SETUP = [('chariot', 0, 0), ('horse', 1, 0), ('elephant', 2, 0), ('advisor', 3, 0), ('general', 4, 0), ('advisor', 5, 0), ('elephant', 6, 0), ('horse', 7, 0), ('chariot', 8, 0),
         ('cannon', 1, 2), ('cannon', 7, 2), ('soldier', 0, 3), ('soldier', 2, 3), ('soldier', 4, 3), ('soldier', 6, 3), ('soldier', 8, 3)]
for style in ('classic', 'cute'):
    b = Image.open(G / f'co-tuong/board_{style}.png').convert('RGBA')
    for side in ('black', 'red'):
        for name, c, r in SETUP:
            rr = r if side == 'black' else 9 - r
            p = Image.open(G / f'co-tuong/pieces-{style}/{side}_{name}.png').convert('RGBA').resize((84, 84), Image.LANCZOS)
            paste_c(b, p, 70 + c * 90, 70 + rr * 90 + 2)
    S(b, f'co-tuong/preview_setup_{style}.png')
# markers
sel = new(120, 120); sd = ImageDraw.Draw(sel)
for i, a in enumerate(range(0, 360, 90)):
    sd.arc((6, 6, 114, 114), a + 10, a + 80, fill=rgb('#ffd23a'), width=9)
S(sel.filter(ImageFilter.GaussianBlur(0.6)), 'co-tuong/marker_select.png')
dot = candy_circle(40, 'mint', depth=3); dot.putalpha(dot.split()[3].point(lambda v: int(v * 0.9)))
S(dot, 'co-tuong/marker_move_dot.png')
lm = new(120, 120); ImageDraw.Draw(lm).ellipse((10, 10, 110, 110), outline=(255, 111, 168, 200), width=7)
S(lm, 'co-tuong/marker_last_move.png')

# =============================================================== CỜ CÁ NGỰA (Ludo layout)
LC = {'red': PAL['pink'], 'green': PAL['mint'], 'yellow': PAL['lemon'], 'blue': PAL['sky']}


def ludo_board(cell=64):
    n = 15
    w = cell * n + 40
    im = new(w, w)
    base = candy_rr(w, w, ('#fffaf3', '#fff1e6', '#e8c9b0'), radius=48, depth=12, gloss=False, dot=False)
    im.alpha_composite(base)
    d = ImageDraw.Draw(im)
    o = 20
    X = lambda c: o + c * cell
    Y = lambda r: o + r * cell
    yards = {'red': (0, 0), 'green': (0, 9), 'yellow': (9, 9), 'blue': (9, 0)}
    for col, (r0, c0) in yards.items():
        light, basec, dark = LC[col]
        y = candy_rr(cell * 6 - 8, cell * 6 - 8, LC[col], radius=40, depth=8)
        im.alpha_composite(y, (X(c0) + 4, Y(r0) + 4))
        inner = candy_rr(cell * 4, cell * 4, ('#ffffff', '#fffaf6', '#ead9e2'), radius=34, depth=0, gloss=False, dot=False)
        im.alpha_composite(inner, (X(c0) + cell, Y(r0) + cell - 4))
        for (dr, dc) in ((1.5, 1.5), (1.5, 3.5), (3.5, 1.5), (3.5, 3.5)):
            sp = candy_circle(int(cell * 1.1), col if col in PAL else LC[col], depth=4)
            paste_c(im, sp, X(c0) + dc * cell - cell * 0.5 + cell * 0.5, Y(r0) + dr * cell - cell * 0.5 + cell * 0.45)
    def cellbox(r, c, fillc, outline='#ead6c6'):
        d.rounded_rectangle((X(c) + 3, Y(r) + 3, X(c) + cell - 3, Y(r) + cell - 3), radius=12, fill=rgb(fillc), outline=rgb(outline), width=2)
    track = set()
    for r in range(6, 9):
        for c in list(range(0, 6)) + list(range(9, 15)):
            track.add((r, c))
    for c in range(6, 9):
        for r in list(range(0, 6)) + list(range(9, 15)):
            track.add((r, c))
    for (r, c) in track:
        cellbox(r, c, '#ffffff')
    for c in range(1, 6):
        cellbox(7, c, LC['red'][1], LC['red'][2])
    for r in range(1, 6):
        cellbox(r, 7, LC['green'][1], LC['green'][2])
    for c in range(9, 14):
        cellbox(7, c, LC['yellow'][1], LC['yellow'][2])
    for r in range(9, 14):
        cellbox(r, 7, LC['blue'][1], LC['blue'][2])
    for (r, c), col in (((6, 1), 'red'), ((1, 8), 'green'), ((8, 13), 'yellow'), ((13, 6), 'blue')):
        cellbox(r, c, LC[col][1], LC[col][2])
    star = load(A / 'ui-premium-generated' / 'misc' / 'star_full.png', int(cell * 0.7))
    for (r, c) in ((8, 2), (2, 6), (6, 12), (12, 8), (6, 1), (1, 8), (8, 13), (13, 6)):
        paste_c(im, star, X(c) + cell / 2, Y(r) + cell / 2)
    cx, cy = X(7.5), Y(7.5)
    tri = {'red': [(X(6), Y(6)), (X(6), Y(9)), (cx, cy)], 'green': [(X(6), Y(6)), (X(9), Y(6)), (cx, cy)],
           'yellow': [(X(9), Y(6)), (X(9), Y(9)), (cx, cy)], 'blue': [(X(6), Y(9)), (X(9), Y(9)), (cx, cy)]}
    for col, pts in tri.items():
        d.polygon(pts, fill=rgb(LC[col][1]), outline=(255, 255, 255, 255), width=3)
    paste_c(im, load(FL / 'game-items' / 'trophy.png', int(cell * 1.2)), cx, cy)
    return im


S(ludo_board(), 'co-ca-ngua/board.png')
for col in ('red', 'green', 'yellow', 'blue'):
    t = candy_circle(120, LC[col], depth=10)
    ring = candy_circle(92, ('#ffffff', '#ffffff', '#e5dbe8'), depth=0, gloss=False)
    paste_c(t, ring, 60, 55)
    paste_c(t, load(FL / 'game-items' / 'horse_face.png', 72), 60, 54)
    S(t, f'co-ca-ngua/token_{col}.png')

# =============================================================== BẮN CÁ (fish hunter): Fluent sea creatures + generated scene parts
SEA = ['Fish', 'Tropical fish', 'Blowfish', 'Shark', 'Octopus', 'Squid', 'Crab', 'Lobster', 'Shrimp', 'Jellyfish', 'Spouting whale', 'Whale', 'Dolphin',
       'Turtle', 'Seal', 'Coral', 'Spiral shell', 'Oyster', 'Fishing pole', 'Water wave', 'Mermaid', 'Merman', 'Merperson']
paths = Path(sys.argv[2]).read_text().splitlines()
norm = lambda s: re.sub(r'[^a-z0-9]+', '', s.lower())
index = {}
for p in paths:
    k = norm(p.split('/')[1])
    if k not in index or '/Default/' in p:
        index[k] = p
jobs = [(index[norm(n)], FL / 'sea' / (re.sub(r'[^a-z0-9]+', '_', index[norm(n)].split('/')[1].lower()).strip('_') + '.png')) for n in SEA if norm(n) in index]
(FL / 'sea').mkdir(parents=True, exist_ok=True)


def get(job):
    p, dst = job
    if dst.exists():
        return None
    try:
        with urllib.request.urlopen('https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/' + urllib.parse.quote(p), timeout=60) as r:
            dst.write_bytes(r.read())
    except Exception as e:
        return p


with cf.ThreadPoolExecutor(12) as ex:
    errs = [e for e in ex.map(get, jobs) if e]
print('sea creatures', len(jobs), 'errors', errs)


def underwater(w, h, seed=3):
    rnd = random.Random(seed)
    im = lin_grad(w, h, '#7fe3f0', '#1c5fa8')
    rays = new(w, h)
    rd = ImageDraw.Draw(rays)
    for i in range(7):
        x = rnd.uniform(0, w)
        rd.polygon([(x, 0), (x + rnd.uniform(60, 140), 0), (x + rnd.uniform(200, 420), h), (x + rnd.uniform(40, 120), h)], fill=(255, 255, 255, rnd.randint(16, 34)))
    im.alpha_composite(rays.filter(ImageFilter.GaussianBlur(18)))
    sand = new(w, h)
    sd = ImageDraw.Draw(sand)
    pts = [(0, h)] + [(x, h - 90 - 30 * math.sin(x / 180) - 14 * math.sin(x / 57)) for x in range(0, w + 20, 20)] + [(w, h)]
    sd.polygon(pts, fill=rgb('#ffe2b0'))
    im.alpha_composite(sand)
    im.alpha_composite(lin_grad(w, h, (0, 0, 0, 0), (255, 200, 140, 60)))
    for i in range(int(w / 160)):
        c = load(FL / 'sea' / rnd.choice(['coral.png', 'spiral_shell.png', 'oyster.png']), int(rnd.uniform(70, 130)))
        im.alpha_composite(c, (int(rnd.uniform(0, w - 130)), int(h - rnd.uniform(110, 170))))
    bub = new(w, h)
    bd = ImageDraw.Draw(bub)
    for i in range(int(w * h / 22000)):
        r = rnd.uniform(4, 22)
        x, y = rnd.uniform(0, w), rnd.uniform(0, h * 0.85)
        bd.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, 150), width=2)
        bd.ellipse((x - r * 0.5, y - r * 0.6, x - r * 0.1, y - r * 0.2), fill=(255, 255, 255, 170))
    im.alpha_composite(bub)
    return im.convert('RGB')


S(underwater(1920, 1080), 'ban-ca/bg_underwater_1920x1080.png')
S(underwater(1080, 1920, seed=4), 'ban-ca/bg_underwater_1080x1920.png')


def cannon(color='pink', level=1):
    w, h = 240, 312
    im = new(w, h)
    # turret ring with bolts
    ring = candy_circle(200, 'grey', depth=10)
    paste_c(im, ring, w / 2, 196)
    d = ImageDraw.Draw(im)
    for k in range(10):
        a = math.radians(k * 36)
        x, y = w / 2 + 84 * math.cos(a), 192 + 80 * math.sin(a)
        d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=rgb('#ffffff', 220))
    # barrel (wide, tapered) with stripes
    bw = 96 + level * 8
    barrel = candy_rr(bw, 170, color, radius=bw * 0.45, depth=0)
    bd = ImageDraw.Draw(barrel)
    for yy in (50, 95):
        bd.rounded_rectangle((6, yy, bw - 6, yy + 14), radius=7, fill=rgb('#ffffff', 170))
    paste_c(im, barrel, w / 2, 96)
    # muzzle ring + dark opening
    muzzle = candy_rr(bw + 22, 46, 'lemon', radius=22, depth=6)
    paste_c(im, muzzle, w / 2, 22)
    d.ellipse((w / 2 - bw * 0.32, 10, w / 2 + bw * 0.32, 30), fill=rgb('#5a2342', 230))
    # level star on the turret
    hub = candy_circle(96, color, depth=6)
    paste_c(im, hub, w / 2, 196)
    star = load(A / 'ui-premium-generated' / 'misc' / 'star_full.png', 70)
    paste_c(im, star, w / 2, 192)
    ImageDraw.Draw(im).text((w / 2, 196), str(level), font=font(COINY, 30), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb('#c08f00'))
    return with_shadow(im, blur=8, alpha=0.3, dy=6)


for i, c in enumerate(('pink', 'mint', 'sky', 'lavender', 'gold'), 1):
    S(cannon(c, i), f'ban-ca/cannon_lv{i}_{c}.png')
net = new(220, 220)
nd = ImageDraw.Draw(net)
for r in (100, 70, 40):
    nd.ellipse((110 - r, 110 - r, 110 + r, 110 + r), outline=(255, 255, 255, 220), width=5)
for a in range(0, 360, 30):
    nd.line((110, 110, 110 + 100 * math.cos(math.radians(a)), 110 + 100 * math.sin(math.radians(a))), fill=(255, 255, 255, 200), width=4)
S(net.filter(ImageFilter.GaussianBlur(0.5)), 'ban-ca/net.png')
bullet = candy_circle(40, 'lemon', depth=3)
S(bullet, 'ban-ca/bullet.png')
for c in ('pink', 'mint', 'sky'):
    seat = candy_rr(360, 110, c, radius=50, depth=10)
    S(seat, f'ban-ca/seat_plate_{c}.png')

(G / 'co-tuong' / 'NOTE.txt').write_text('Pieces & boards generated with code. Classic style uses LXGW WenKai TC (OFL), cute style uses ZCOOL KuaiLe (OFL). CC0 output.\n', encoding='utf-8')
print('board files:', made)
