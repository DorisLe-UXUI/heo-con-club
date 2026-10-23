"""Game-specific generated assets: Bầu Cua, Xóc Đĩa, Tài Xỉu, chips, card helpers, Mậu Binh, Bài Màu, Lô Tô, Caro.
Usage: python3 -E gen_games.py <assets_dir>
"""
import sys, math, random, shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
sys.path.insert(0, str(Path(__file__).parent))
from gfx import *

A = Path(sys.argv[1])
G = A / 'games'
F = A / 'fonts'
CB = COINY = F / 'GrandstanderBlack-Regular.ttf'  # Cherry Bomb One draws Đ/ừ/ứ/ử/ữ/ự wrong; Coiny draws V like U
FL = A / 'emoji-fluent-3d'
made = 0


def S(im, rel):
    global made
    save(im, G / rel); made += 1
    return im


# =============================================================== shared pieces
def die_face(n, style='white', size=180):
    s = size * SS
    body = {'white': ('#ffffff', '#f1ecf4', '#c9bfd6'), 'pink': ('#ffe3ef', '#ff9cc4', '#d0558a'), 'mint': ('#e2fbf1', '#7fe0b9', '#2f9f75'),
            'sky': ('#e4f3ff', '#8cc8ff', '#3a84d0'), 'lemon': ('#fff6d6', '#ffd65c', '#c99a00')}[style]
    im = new(s, s)
    fill_mask(im, solid(s, s, body[2]), mask_rr(s, s, (0, s * 0.05, s - 1, s - 1), s * 0.22))
    fill_mask(im, rad_grad(s, s, body[0], body[1], 0.35, 0.3, 0.95, 0.95, 1.4), mask_rr(s, s, (0, 0, s - 1, s * 0.95), s * 0.22))
    fill_mask(im, lin_grad(s, s, (255, 255, 255, 150), (255, 255, 255, 0)), mask_rr(s, s, (s * 0.12, s * 0.06, s * 0.88, s * 0.42), s * 0.16))
    pip = {'white': ('#3b3550', '#ff4a6a'), 'pink': ('#ffffff', '#ffffff'), 'mint': ('#ffffff', '#ffffff'), 'sky': ('#ffffff', '#ffffff'), 'lemon': ('#7a4a00', '#e8402e')}[style]
    col = pip[1] if n in (1, 4) else pip[0]
    P = {1: [(.5, .5)], 2: [(.28, .28), (.72, .72)], 3: [(.27, .27), (.5, .5), (.73, .73)], 4: [(.29, .29), (.71, .29), (.29, .71), (.71, .71)],
         5: [(.27, .27), (.73, .27), (.5, .5), (.27, .73), (.73, .73)], 6: [(.29, .25), (.71, .25), (.29, .5), (.71, .5), (.29, .75), (.71, .75)]}[n]
    r = s * (0.13 if n == 1 else 0.085)
    d = ImageDraw.Draw(im)
    for x, y in P:
        cx, cy = x * s, y * s * 0.95
        d.ellipse((cx - r, cy - r + s * 0.01, cx + r, cy + r + s * 0.01), fill=(0, 0, 0, 40))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb(col))
        d.ellipse((cx - r * 0.45, cy - r * 0.55, cx - r * 0.05, cy - r * 0.15), fill=(255, 255, 255, 110))
    return down(im, size, size)


def flat_face(content, bg=('#ffffff', '#f3eef6'), edge='#d6cce0', S0=300):
    """Square cube face (no depth) for iso cubes."""
    s = S0
    im = lin_grad(s, s, bg[0], bg[1])
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((3, 3, s - 4, s - 4), radius=s * 0.16, outline=rgb(edge), width=6)
    if content is not None:
        c = content.copy(); c.thumbnail((int(s * 0.74), int(s * 0.74)))
        paste_c(im, c, s / 2, s / 2)
    return im


def pip_content(n, s=300, color_main='#3b3550', color_red='#ff4a6a'):
    im = new(s, s)
    P = {1: [(.5, .5)], 2: [(.28, .28), (.72, .72)], 3: [(.27, .27), (.5, .5), (.73, .73)], 4: [(.29, .29), (.71, .29), (.29, .71), (.71, .71)],
         5: [(.27, .27), (.73, .27), (.5, .5), (.27, .73), (.73, .73)], 6: [(.29, .25), (.71, .25), (.29, .5), (.71, .5), (.29, .75), (.71, .75)]}[n]
    r = s * (0.14 if n == 1 else 0.09)
    d = ImageDraw.Draw(im)
    for x, y in P:
        d.ellipse((x * s - r, y * s - r, x * s + r, y * s + r), fill=rgb(color_red if n in (1, 4) else color_main))
    return im


def iso_cube(top, left, right, width=260):
    """Isometric cube from three square face images."""
    W = width * SS
    H = int(W * 1.155)
    Tq = (W / 2, 0); Rq = (W, W * 0.2887); Bq = (W / 2, W * 0.5774); Lq = (0, W * 0.2887)
    down_v = W * 0.5774
    out = new(W, H + 2)

    def put(face, p0, pu, pv, shade):
        S0 = face.width
        ax, ay = (pu[0] - p0[0]) / S0, (pu[1] - p0[1]) / S0
        bx, by = (pv[0] - p0[0]) / S0, (pv[1] - p0[1]) / S0
        M = np.array([[ax, bx], [ay, by]]); Mi = np.linalg.inv(M)
        a, b = Mi[0]; d_, e = Mi[1]
        c = -(a * p0[0] + b * p0[1]); f = -(d_ * p0[0] + e * p0[1])
        f2 = face.convert('RGBA')
        if shade < 1:
            f2 = ImageChops.multiply(f2, Image.new('RGBA', f2.size, (int(255 * shade), int(255 * shade), int(255 * min(1, shade + 0.04)), 255)))
        t = f2.transform((W, H + 2), Image.AFFINE, (a, b, c, d_, e, f), resample=Image.BICUBIC)
        out.alpha_composite(t)

    put(left, Lq, Bq, (Lq[0], Lq[1] + down_v), 0.86)
    put(right, Bq, Rq, (Bq[0], Bq[1] + down_v), 0.74)
    put(top, Tq, Rq, Lq, 1.0)
    return with_shadow(down(out, width, int(width * 1.155)), blur=8, alpha=0.25, dy=6)


def plate(w=640, style='porcelain'):
    h = int(w * 0.5)
    W, H = w * SS, h * SS
    im = new(W, H + 20 * SS)
    rim, band, inner = {'porcelain': ('#ffffff', '#5b8fe0', '#f4f7ff'), 'gold': ('#fff3c4', '#e0a020', '#fffaf0'), 'pink': ('#ffffff', '#ff8fb8', '#fff4f8')}[style]
    fill_mask(im, solid(W, H + 20 * SS, '#c9cfe0' if style == 'porcelain' else '#e3c890'), mask_ellipse(W, H + 20 * SS, (0, 18 * SS, W - 1, H + 18 * SS)))
    fill_mask(im, rad_grad(W, H + 20 * SS, '#ffffff', rim, 0.4, 0.3, 0.8, 0.8), mask_ellipse(W, H + 20 * SS, (0, 0, W - 1, H - 1)))
    d = ImageDraw.Draw(im)
    d.ellipse((W * 0.06, H * 0.08, W * 0.94, H * 0.92), outline=rgb(band), width=int(9 * SS))
    fill_mask(im, rad_grad(W, H + 20 * SS, '#ffffff', inner, 0.5, 0.35, 0.6, 0.6), mask_ellipse(W, H + 20 * SS, (W * 0.13, H * 0.17, W * 0.87, H * 0.83)))
    d.ellipse((W * 0.13, H * 0.17, W * 0.87, H * 0.83), outline=rgb(band, 90), width=int(3 * SS))
    for i in range(16):
        a = i / 16 * 2 * math.pi
        x, y = W / 2 + math.cos(a) * W * 0.47, H / 2 + math.sin(a) * H * 0.46
        d.ellipse((x - 5 * SS, y - 5 * SS, x + 5 * SS, y + 5 * SS), fill=rgb(band, 200))
    return with_shadow(down(im, w, h + 20), blur=10, alpha=0.25, dy=8)


def bowl(w=520, style='porcelain'):
    h = int(w * 0.7)
    W, H = w * SS, h * SS
    im = new(W, H)
    body, band, dark = {'porcelain': ('#dfe8fb', '#5b8fe0', '#8ea3cc'), 'red': ('#ff6a5b', '#ffd34a', '#9e2019'), 'pink': ('#ffb8d4', '#ff5c9a', '#c2558a')}[style]
    # dome = upper half of ellipse + rim ellipse at bottom
    dome = Image.new('L', (W, H), 0)
    dd = ImageDraw.Draw(dome)
    dd.ellipse((0, H * 0.08, W - 1, H * 1.9), fill=255)
    dd.rectangle((0, H * 0.86, W, H), fill=0)
    dd.ellipse((0, H * 0.74, W - 1, H * 0.98), fill=255)
    fill_mask(im, rad_grad(W, H, '#ffffff', body, 0.35, 0.25, 0.85, 1.0, 0.9), dome)
    shade = lin_grad(W, H, (0, 0, 0, 0), (0, 0, 0, 0))
    edge = rad_grad(W, H, (0, 0, 0, 0), rgb(dark, 210), 0.42, 0.42, 0.6, 0.66, 2.0)
    fill_mask(im, edge, dome)
    d = ImageDraw.Draw(im)
    # band and rim
    d.arc((W * 0.03, H * 0.62, W * 0.97, H * 1.05), 190, 350, fill=rgb(band), width=int(10 * SS))
    for i in range(9):
        x = W * (0.16 + i * 0.085)
        d.ellipse((x - 8 * SS, H * 0.6 - 8 * SS + abs(i - 4) * 4 * SS, x + 8 * SS, H * 0.6 + 8 * SS + abs(i - 4) * 4 * SS), fill=rgb(band))
    # foot ring on top
    fill_mask(im, lin_grad(W, H, '#ffffff', dark), mask_ellipse(W, H, (W * 0.36, H * 0.02, W * 0.64, H * 0.16)))
    d.ellipse((W * 0.36, H * 0.02, W * 0.64, H * 0.16), outline=rgb(band), width=int(5 * SS))
    # gloss
    fill_mask(im, lin_grad(W, H, (255, 255, 255, 200), (255, 255, 255, 0)), mask_ellipse(W, H, (W * 0.16, H * 0.2, W * 0.42, H * 0.48)))
    return with_shadow(down(im, w, h), blur=12, alpha=0.3, dy=10)


# =============================================================== BẦU CUA
def gourd(size=256):
    s = size * SS
    im = new(s, s)
    m = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((s * 0.17, s * 0.44, s * 0.83, s * 0.98), fill=255)     # body
    d.ellipse((s * 0.35, s * 0.13, s * 0.65, s * 0.42), fill=255)     # head
    d.rounded_rectangle((s * 0.44, s * 0.33, s * 0.56, s * 0.52), radius=s * 0.04, fill=255)  # neck
    m = m.filter(ImageFilter.GaussianBlur(s * 0.018)).point(lambda v: 255 if v > 120 else 0)
    fill_mask(im, rad_grad(s, s, '#f2ff9e', '#7cc23a', 0.38, 0.35, 0.75, 0.75, 1.1), m)
    fill_mask(im, rad_grad(s, s, (0, 0, 0, 0), (40, 90, 10, 150), 0.42, 0.42, 0.62, 0.62, 2.5), m)
    gl = Image.new('L', (s, s), 0); gd = ImageDraw.Draw(gl)
    gd.ellipse((s * 0.27, s * 0.54, s * 0.45, s * 0.76), fill=170); gd.ellipse((s * 0.41, s * 0.18, s * 0.5, s * 0.29), fill=150)
    fill_mask(im, solid(s, s, (255, 255, 255, 255)), ImageChops.multiply(gl.filter(ImageFilter.GaussianBlur(s * 0.02)), m))
    d2 = ImageDraw.Draw(im)
    d2.rounded_rectangle((s * 0.47, s * 0.03, s * 0.55, s * 0.16), radius=s * 0.03, fill=rgb('#8a5a2b'))
    leaf = Image.new('L', (s, s), 0); ImageDraw.Draw(leaf).ellipse((s * 0.53, s * 0.03, s * 0.8, s * 0.14), fill=255)
    leaf = leaf.rotate(18, center=(s * 0.55, s * 0.09))
    fill_mask(im, lin_grad(s, s, '#7fdc5a', '#2f9a3a'), leaf)
    # tie ribbon (cute red string)
    d2.rounded_rectangle((s * 0.41, s * 0.41, s * 0.59, s * 0.46), radius=s * 0.02, fill=rgb('#ff5a6a'))
    return down(im, size, size)


BC = [('bau', 'BẦU', None, 'mint'), ('cua', 'CUA', 'game-items/crab.png', 'red'), ('tom', 'TÔM', 'game-items/shrimp.png', 'peach'),
      ('ca', 'CÁ', 'game-items/fish.png', 'sky'), ('ga', 'GÀ', 'game-items/rooster.png', 'lemon'), ('nai', 'NAI', 'game-items/deer.png', 'lavender')]
sym = {}
from custom_img import load_art, fit_square
for key, label, src, col in BC:
    art = A.parent / 'custom' / 'bau-cua' / f'{key}.png'     # your own mascot art (no text): frame and label are added here
    im = fit_square(load_art(art), 256) if art.exists() else gourd(256) if src is None else load(FL / src, 256)
    sym[key] = S(im, f'bau-cua/symbols/{key}.png')
fl = font(CB, 52)
for key, label, src, col in BC:
    t = candy_rr(260, 300, col, radius=46, depth=12)
    inner = candy_rr(220, 200, ('#ffffff', '#fffaf6', '#efdbe5'), radius=36, depth=0, gloss=False, dot=False)
    t.alpha_composite(inner, (20, 20))
    paste_c(t, sym[key].resize((180, 180), Image.LANCZOS), 130, 120)
    ImageDraw.Draw(t).text((130, 252), label, font=fl, fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(PAL[col][2]))
    S(t, f'bau-cua/tiles/{key}.png')
    face = flat_face(sym[key])
    S(with_shadow(down(Image.alpha_composite(new(300, 300), face.resize((300, 300))), 180, 180), blur=6, alpha=0.2, dy=4), f'bau-cua/dice-faces/{key}.png')
keys = [k for k, *_ in BC]
for i, k in enumerate(keys):
    S(iso_cube(flat_face(sym[k]), flat_face(sym[keys[(i + 2) % 6]]), flat_face(sym[keys[(i + 4) % 6]])), f'bau-cua/dice-3d/die_{k}.png')
# board
bw, bh = 1320, 900
board = candy_rr(bw, bh, ('#fff1e0', '#ffd9b8', '#d9905a'), radius=70, depth=18, dot=False)
fb = font(CB, 74)
title = fancy_text('BẦU CUA TÔM CÁ', fb, fill=('#fff27a', '#ff9e2c'), inner='#a5205a')
paste_c(board, title, bw / 2, 82)
tiles = [Image.open(G / f'bau-cua/tiles/{k}.png').convert('RGBA') for k in keys]
for i, t in enumerate(tiles):
    t2 = t.resize((340, 392), Image.LANCZOS)
    paste_c(board, t2, 250 + (i % 3) * 410, 340 + (i // 3) * 400 - 30)
S(board, 'bau-cua/board_bau_cua.png')

# =============================================================== shared plate & bowl
for st in ('porcelain', 'gold', 'pink'):
    S(plate(640, st), f'shared/plate_{st}.png')
for st in ('porcelain', 'red', 'pink'):
    S(bowl(520, st), f'shared/bowl_{st}.png')

# =============================================================== XÓC ĐĨA
def xd_coin(red=True, d=160):
    c = candy_circle(d, ('#ffb3a8', '#ff4a3d', '#a82018') if red else ('#ffffff', '#f6efe2', '#bfae8c'), depth=d * 0.08)
    dr = ImageDraw.Draw(c)
    dr.ellipse((d * 0.2, d * 0.17, d * 0.8, d * 0.75), outline=(255, 255, 255, 170) if red else rgb('#d8c49a'), width=max(3, d // 30))
    return c


S(xd_coin(True), 'xoc-dia/coin_red.png'); S(xd_coin(False), 'xoc-dia/coin_white.png')
fx = font(CB, 66)
fs = font(CB, 40)
xb = candy_rr(1400, 820, ('#e8fff4', '#bdf0db', '#2f9f75'), radius=70, depth=18, dot=False)
for i, (lab, col) in enumerate((('CHẴN', 'pink'), ('LẺ', 'sky'))):
    area = candy_rr(620, 330, col, radius=50, depth=12)
    paste_c(area, fancy_text(lab, font(CB, 110), fill=('#ffffff', '#fff3f8'), inner=PAL[col][2]), 310, 150)
    xb.alpha_composite(area, (60 + i * 660, 50))
subs = [('4 ĐỎ', [1, 1, 1, 1]), ('4 TRẮNG', [0, 0, 0, 0]), ('3 ĐỎ 1 TRẮNG', [1, 1, 1, 0]), ('3 TRẮNG 1 ĐỎ', [0, 0, 0, 1])]
cr, cw = xd_coin(True, 52), xd_coin(False, 52)
for i, (lab, coins) in enumerate(subs):
    area = candy_rr(305, 320, ['lemon', 'grey', 'peach', 'lavender'][i], radius=44, depth=10)
    for j, cc in enumerate(coins):
        paste_c(area, cr if cc else cw, 152 + (j - 1.5) * 58, 110)
    ImageDraw.Draw(area).text((152, 220), lab, font=font(CB, 34 if len(lab) < 8 else 28), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb(PAL[['lemon', 'grey', 'peach', 'lavender'][i]][2]))
    xb.alpha_composite(area, (60 + i * 325, 430))
S(xb, 'xoc-dia/board_xoc_dia.png')
for lab, col in (('C', 'pink'), ('L', 'sky')):
    bead = candy_circle(64, col, depth=4)
    ImageDraw.Draw(bead).text((32, 29), lab, font=font(CB, 36), fill='white', anchor='mm')
    S(bead, f'xoc-dia/history_{"chan" if lab == "C" else "le"}.png')

# =============================================================== TÀI XỈU
for st in ('white', 'pink', 'mint', 'sky', 'lemon'):
    for n in range(1, 7):
        S(die_face(n, st), f'tai-xiu/dice/{st}/die_{n}.png')
pc = {n: flat_face(pip_content(n)) for n in range(1, 7)}
for top, l, r in ((6, 5, 3), (1, 2, 4), (4, 1, 2), (5, 3, 6), (3, 6, 5), (2, 4, 1)):
    S(iso_cube(pc[top], pc[l], pc[r]), f'tai-xiu/dice-3d/die_top{top}.png')
pcp = {n: flat_face(pip_content(n, color_main='#ffffff', color_red='#ffffff'), bg=('#ffb3d0', '#ff7fb0'), edge='#d0558a') for n in range(1, 7)}
for top, l, r in ((6, 5, 3), (1, 2, 4), (4, 1, 2)):
    S(iso_cube(pcp[top], pcp[l], pcp[r]), f'tai-xiu/dice-3d/pink_die_top{top}.png')
tb = candy_rr(1500, 760, ('#f1e9ff', '#d8c8ff', '#6c4bd1'), radius=70, depth=18, dot=False)
for i, (lab, rng, col) in enumerate((('TÀI', '11 - 17', 'red'), ('XỈU', '4 - 10', 'sky'))):
    area = candy_rr(600, 560, col, radius=60, depth=14)
    paste_c(area, fancy_text(lab, font(CB, 150), fill=('#ffffff', '#fff0f5'), inner=PAL[col][2]), 300, 200)
    ImageDraw.Draw(area).text((300, 400), rng, font=font(COINY, 64), fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(PAL[col][2]))
    tb.alpha_composite(area, (90 + i * 720, 70))
paste_c(tb, bowl(300, 'pink'), 750, 330)
S(tb, 'tai-xiu/board_tai_xiu.png')
for lab, col in (('T', 'red'), ('X', 'sky')):
    bead = candy_circle(64, col, depth=4)
    ImageDraw.Draw(bead).text((32, 29), lab, font=font(CB, 36), fill='white', anchor='mm')
    S(bead, f'tai-xiu/history_{"tai" if lab == "T" else "xiu"}.png')

# =============================================================== CHIPS (poker, liêng, xì dách, bài cào)
DEN = [('1K', ('#ffffff', '#f4f1f8', '#a59cb5'), '#ff6fa8'), ('5K', PAL['pink'], '#ffffff'), ('10K', PAL['sky'], '#ffffff'), ('50K', PAL['mint'], '#ffffff'),
       ('100K', PAL['lemon'], '#ffffff'), ('500K', PAL['lavender'], '#ffffff'), ('1M', ('#fff1b8', '#ffb92e', '#a86c00'), '#ffffff'), ('10M', ('#4a4060', '#2c2540', '#ffcf4a'), '#ffcf4a')]


def chip(label, pal, stripe, d=150, art=None):
    D = d * SS
    im = new(D, D)
    if art is not None:                                   # your own blank chip (custom/chips): only the value is written here
        im = fit_square(load_art(art), d, pad=.01)
        a = np.array(im.convert('RGB')).reshape(-1, 3); yy, xx = np.divmod(np.arange(d * d), d); rr = np.hypot(xx - d / 2, yy - d / 2)
        plate = tuple(int(v) for v in np.median(a[(rr > d * .27) & (rr < d * .31)], axis=0))   # cover a face or picture in the middle
        cv = new(d * SS, d * SS); cd = ImageDraw.Draw(cv); R0 = d * SS * .29
        cd.ellipse((d * SS / 2 - R0, d * SS / 2 - R0, d * SS / 2 + R0, d * SS / 2 + R0), fill=plate + (255,))
        cd.ellipse((d * SS / 2 - R0 * .8, d * SS / 2 - R0 * .92, d * SS / 2 + R0 * .8, d * SS / 2 - R0 * .1), fill=(255, 255, 255, 60))
        im.alpha_composite(down(cv, d, d))
        f = font(COINY, int(d * (0.3 if len(label) <= 3 else 0.24)))
        ImageDraw.Draw(im).text((d / 2, d * 0.48), label, font=f, fill='white', anchor='mm', stroke_width=5, stroke_fill=rgb(pal[2]))
        return im
    light, base, dark = (rgb(c) for c in pal)
    fill_mask(im, solid(D, D, dark), mask_ellipse(D, D, (0, D * 0.06, D - 1, D - 1)))
    fill_mask(im, rad_grad(D, D, light, base, 0.4, 0.3, 0.8, 0.8), mask_ellipse(D, D, (0, 0, D - 1, D * 0.94)))
    dd = ImageDraw.Draw(im)
    for i in range(8):
        a0 = i * 45 - 9
        dd.pieslice((0, 0, D - 1, D * 0.94), a0, a0 + 18, fill=rgb(stripe))
    fill_mask(im, rad_grad(D, D, light, base, 0.4, 0.3, 0.6, 0.6), mask_ellipse(D, D, (D * 0.14, D * 0.13, D * 0.86, D * 0.81)))
    dd.ellipse((D * 0.2, D * 0.19, D * 0.8, D * 0.75), outline=rgb(stripe), width=int(4 * SS))
    fill_mask(im, lin_grad(D, D, (255, 255, 255, 140), (255, 255, 255, 0)), mask_ellipse(D, D, (D * 0.2, D * 0.08, D * 0.8, D * 0.45)))
    im = down(im, d, d)
    f = font(COINY, int(d * (0.3 if len(label) <= 3 else 0.24)))
    ImageDraw.Draw(im).text((d / 2, d * 0.46), label, font=f, fill=rgb('#ffffff' if label in ('10M',) else stripe), anchor='mm', stroke_width=3 if label != '10M' else 5, stroke_fill=dark if label != '10M' else rgb('#1e1930'))
    return im


def chip_stack(top_chip, pal, n=5, d=150):
    light, base, dark = pal
    h_each = d * 0.11
    H = int(d * 0.94 + h_each * (n - 1) + 10)
    im = new(d, H)
    side = new(d * SS, int(d * 0.3 * SS))
    for i in range(n - 1, 0, -1):
        y = H - d * 0.94 - i * h_each
        e = new(d, int(d * 0.94 + h_each))
        de = ImageDraw.Draw(e)
        de.ellipse((0, h_each * 0.6, d - 1, d * 0.94 + h_each * 0.6 - 1), fill=rgb(dark))
        de.ellipse((0, 0, d - 1, d * 0.94 - 1), fill=rgb(base))
        for k in range(6):
            x = d * (0.1 + k * 0.16)
            de.rectangle((x, d * 0.47 + h_each * 0.2, x + d * 0.06, d * 0.47 + h_each * 0.9), fill=(255, 255, 255, 200))
        im.alpha_composite(e, (0, int(y + (n - 1 - i) * 0 + i * 0)))
    im2 = new(d, H)
    for i in range(n):
        y = H - int(d * 0.94) - i * h_each - 4
        e = new(d, int(d + h_each))
        de = ImageDraw.Draw(e)
        de.ellipse((0, h_each, d - 1, d * 0.94 + h_each - 1), fill=rgb(dark))
        de.rectangle((0, d * 0.47, d - 1, d * 0.47 + h_each), fill=rgb(dark))
        de.ellipse((0, 0, d - 1, d * 0.94 - 1), fill=rgb(base))
        for k in range(5):
            x = d * (0.12 + k * 0.18)
            de.rectangle((x, d * 0.6, x + d * 0.07, d * 0.6 + h_each * 0.8), fill=(255, 255, 255, 170))
        im2.alpha_composite(e, (0, int(y)))
    im2.alpha_composite(top_chip, (0, H - int(d * 0.94) - (n - 1) * int(h_each) - 6 - 4))
    return with_shadow(im2.crop(im2.getbbox()), blur=6, alpha=0.25, dy=5)


for lab, pal, stripe in DEN:
    art = A.parent / 'custom' / 'chips' / f'chip_{lab.lower()}.png'
    c = chip(lab, pal, stripe, art=art if art.exists() else None)
    S(c, f'card-shared/chips/chip_{lab.lower()}.png')
    S(chip_stack(c, pal), f'card-shared/chips/stack_{lab.lower()}.png')
for lab, pal, stripe in (('D', ('#ffffff', '#f4f1f8', '#8a8496'), '#ff6fa8'), ('SB', PAL['sky'], '#ffffff'), ('BB', PAL['peach'], '#ffffff')):
    S(chip(lab, pal, stripe, 110), f'card-shared/chips/marker_{lab.lower()}.png')

# =============================================================== card helpers (sized for the 100x144 Cute deck, scale freely)
cw, ch = 100, 144


def card_glow(color='#ffd94a', pad=16):
    W, H = (cw + 2 * pad) * SS, (ch + 2 * pad) * SS
    im = new(W, H)
    m = mask_rr(W, H, (pad * SS * 0.4, pad * SS * 0.4, W - pad * SS * 0.4, H - pad * SS * 0.4), 18 * SS)
    g = Image.new('RGBA', (W, H), rgb(color)); g.putalpha(m.filter(ImageFilter.GaussianBlur(pad * SS * 0.35)))
    im.alpha_composite(g)
    ImageDraw.Draw(im).rounded_rectangle((pad * SS - 3 * SS, pad * SS - 3 * SS, W - pad * SS + 3 * SS, H - pad * SS + 3 * SS), radius=14 * SS, outline=rgb(color), width=5 * SS)
    hole = mask_rr(W, H, (pad * SS, pad * SS, W - pad * SS, H - pad * SS), 12 * SS)
    a = ImageChops.subtract(im.split()[3], hole)
    im.putalpha(a)
    return down(im, cw + 2 * pad, ch + 2 * pad)


S(card_glow('#ffd94a'), 'card-shared/card_select_glow_gold.png')
S(card_glow('#ff6fa8'), 'card-shared/card_select_glow_pink.png')
S(card_glow('#3ccf9b'), 'card-shared/card_hint_glow_mint.png')


def card_slot(label=None, w=cw, h=ch):
    W, H = w * SS, h * SS
    im = new(W, H)
    fill_mask(im, solid(W, H, (255, 255, 255, 70)), mask_rr(W, H, (0, 0, W - 1, H - 1), 14 * SS))
    d = ImageDraw.Draw(im)
    per = 2 * (W + H)
    dash = 14 * SS
    # dashed border via short rectangles along a rounded rect path (approx)
    for x in range(int(14 * SS), int(W - 14 * SS), int(dash * 1.8)):
        d.line((x, 3 * SS, x + dash, 3 * SS), fill=(255, 255, 255, 230), width=4 * SS)
        d.line((x, H - 3 * SS, x + dash, H - 3 * SS), fill=(255, 255, 255, 230), width=4 * SS)
    for y in range(int(14 * SS), int(H - 14 * SS), int(dash * 1.8)):
        d.line((3 * SS, y, 3 * SS, y + dash), fill=(255, 255, 255, 230), width=4 * SS)
        d.line((W - 3 * SS, y, W - 3 * SS, y + dash), fill=(255, 255, 255, 230), width=4 * SS)
    im = down(im, w, h)
    if label:
        ImageDraw.Draw(im).text((w / 2, h / 2), label, font=font(CB, 26), fill=(255, 255, 255, 220), anchor='mm')
    return im


S(card_slot(), 'card-shared/card_slot.png')
S(card_slot('+'), 'card-shared/card_slot_plus.png')
# shadow under a card
sh = new(cw + 40, ch + 40); ImageDraw.Draw(sh).rounded_rectangle((20, 24, cw + 20, ch + 24), radius=10, fill=(70, 20, 50, 110))
S(sh.filter(ImageFilter.GaussianBlur(7)), 'card-shared/card_shadow.png')
# small tags for Phỏm / Tiến Lên / Xì Dách
for t, c in (('Ăn', 'peach'), ('Phỏm', 'mint'), ('Rác', 'grey'), ('Đôi', 'sky'), ('Sám', 'lavender'), ('Sảnh', 'lemon'), ('Heo', 'pink'), ('Báo', 'red'), ('21', 'lemon'), ('Quắc', 'grey'), ('Dằn', 'sky'), ('Rút', 'mint')):
    b = candy_rr(140, 60, c, radius=26, depth=5)
    ImageDraw.Draw(b).text((70, 27), t, font=font(CB, 32), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb(PAL[c][2]))
    import unicodedata
    sl = ''.join(ch for ch in unicodedata.normalize('NFD', t.replace('Đ', 'D').replace('đ', 'd')) if unicodedata.category(ch) != 'Mn').lower()
    S(b, f'card-shared/tags/tag_{sl}.png')
# score bubble
for c in ('pink', 'sky', 'mint', 'lemon'):
    sb = candy_circle(96, c, depth=6)
    S(sb, f'card-shared/score_bubble_{c}.png')

# =============================================================== MẬU BINH arrangement overlay
mb = candy_rr(760, 620, 'pink', radius=54, depth=14, dot=False)
mbi = new(760, 620)
labels = [('Chi đầu', 3), ('Chi giữa', 5), ('Chi cuối', 5)]
slot = card_slot()
y = 40
for lab, n in labels:
    ImageDraw.Draw(mb).text((40, y + 72), lab, font=font(CB, 32), fill='white', anchor='lm', stroke_width=3, stroke_fill=rgb('#c2407a'))
    x0 = 220 + (5 - n) * 52
    for i in range(n):
        s2 = card_slot(w=96, h=138)
        pink_slot = Image.new('RGBA', s2.size, (255, 255, 255, 60)); pink_slot.putalpha(ImageChops.multiply(pink_slot.split()[3], s2.split()[3].point(lambda v: 255 if v else 0)))
        mb.alpha_composite(pink_slot, (x0 + i * 104 - 20, y))
        mb.alpha_composite(s2, (x0 + i * 104 - 20, y))
    y += 186
S(mb, 'mau-binh/arrangement_board.png')

# =============================================================== BÀI MÀU (UNO-like pastel deck, original design)
BM_COLORS = {'red': ('#ffb3c4', '#ff5c7c', '#c22f52'), 'yellow': ('#fff0b0', '#ffc62e', '#c08f00'), 'green': ('#bff3dd', '#2fc68d', '#1b8a60'), 'blue': ('#cfe8ff', '#3fa3ff', '#2368c4')}
CWd, CHd = 240, 360


def draw_symbol(kind, size, color, dark, white=False):
    s = size * SS
    im = new(s, s)
    d = ImageDraw.Draw(im)
    fill = (255, 255, 255, 255) if white else rgb(color)
    stroke = rgb(dark)
    if kind == 'skip':
        d.ellipse((s * 0.12, s * 0.12, s * 0.88, s * 0.88), outline=stroke, width=int(s * 0.17))
        d.ellipse((s * 0.12, s * 0.12, s * 0.88, s * 0.88), outline=fill, width=int(s * 0.1))
        d.line((s * 0.26, s * 0.74, s * 0.74, s * 0.26), fill=stroke, width=int(s * 0.17))
        d.line((s * 0.28, s * 0.72, s * 0.72, s * 0.28), fill=fill, width=int(s * 0.1))
    elif kind == 'reverse':
        for flip in (0, 1):
            pts = [(0.18, 0.62), (0.18, 0.4), (0.52, 0.4), (0.52, 0.26), (0.82, 0.5), (0.52, 0.74), (0.52, 0.6), (0.32, 0.6), (0.32, 0.62)]
            if flip:
                pts = [(1 - x, 1 - y) for x, y in pts]
            pts = [(x * s, (y - 0.12 + 0.24 * flip) * s) for x, y in pts]
            d.polygon(pts, fill=fill, outline=stroke, width=int(s * 0.04))
    elif kind == 'wild':
        cols = [BM_COLORS[c][1] for c in ('red', 'blue', 'yellow', 'green')]
        for i, c in enumerate(cols):
            d.pieslice((s * 0.08, s * 0.08, s * 0.92, s * 0.92), i * 90 - 90, i * 90, fill=rgb(c))
        d.ellipse((s * 0.08, s * 0.08, s * 0.92, s * 0.92), outline=(255, 255, 255, 255), width=int(s * 0.05))
    im = down(im, size, size)
    return im


def bm_card(color, value):
    light, base, dark = BM_COLORS.get(color, ('#5a4f72', '#3b3352', '#1e1930'))
    W, H = CWd * SS, CHd * SS
    im = new(W, H)
    fill_mask(im, solid(W, H, '#ffffff'), mask_rr(W, H, (0, 0, W - 1, H - 1), 30 * SS))
    fill_mask(im, lin_grad(W, H, light, base), mask_rr(W, H, (12 * SS, 12 * SS, W - 12 * SS, H - 12 * SS), 22 * SS))
    ov = Image.new('L', (W, H), 0)
    ImageDraw.Draw(ov).ellipse((W * 0.14, H * 0.2, W * 0.86, H * 0.8), fill=255)
    ov = ov.rotate(-28, resample=Image.BICUBIC, center=(W / 2, H / 2))
    fill_mask(im, solid(W, H, '#ffffff'), ov)
    fill_mask(im, lin_grad(W, H, (255, 255, 255, 110), (255, 255, 255, 0)), mask_rr(W, H, (24 * SS, 20 * SS, W - 24 * SS, H * 0.35), 18 * SS))
    im = down(im, CWd, CHd)
    d = ImageDraw.Draw(im)
    if value in ('skip', 'reverse'):
        paste_c(im, draw_symbol(value, 130, base, dark), CWd / 2, CHd / 2)
        for (x, y) in ((40, 46), (CWd - 40, CHd - 46)):
            paste_c(im, draw_symbol(value, 52, base, dark, white=True), x, y)
    elif value in ('wild', 'wild4'):
        paste_c(im, draw_symbol('wild', 150, base, dark), CWd / 2, CHd / 2)
        if value == 'wild4':
            paste_c(im, fancy_text('+4', font(COINY, 70), fill=('#ffffff', '#f0f0ff'), inner='#1e1930', outer_w=4, inner_w=6, shadow_alpha=0.2), CWd / 2, CHd / 2 + 4)
        for (x, y) in ((40, 46), (CWd - 40, CHd - 46)):
            if value == 'wild4':
                d.text((x, y), '+4', font=font(COINY, 40), fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb('#1e1930'))
            else:
                paste_c(im, draw_symbol('wild', 50, base, dark), x, y)
    else:
        big = fancy_text(value, font(COINY, 150 if len(value) == 1 else 110), fill=(base, mix(base, dark, 0.3)), inner=dark, outer='#ffffff', outer_w=8, inner_w=10, shadow_alpha=0.2, gloss=False)
        paste_c(im, big, CWd / 2, CHd / 2 + 6)
        for (x, y) in ((38, 44), (CWd - 38, CHd - 44)):
            d.text((x, y), value, font=font(COINY, 44), fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(dark))
    return im


for c in ('red', 'yellow', 'green', 'blue'):
    for v in [str(i) for i in range(10)] + ['+2', 'skip', 'reverse']:
        name = {'+2': 'draw2'}.get(v, v)
        S(bm_card(c, v), f'bai-mau/cards/{c}_{name}.png')
S(bm_card('black', 'wild'), 'bai-mau/cards/wild.png')
S(bm_card('black', 'wild4'), 'bai-mau/cards/wild_draw4.png')
back = new(CWd, CHd)
W2, H2 = CWd * SS, CHd * SS
bk = new(W2, H2)
fill_mask(bk, solid(W2, H2, '#ffffff'), mask_rr(W2, H2, (0, 0, W2 - 1, H2 - 1), 30 * SS))
fill_mask(bk, lin_grad(W2, H2, '#ff8fbf', '#a07bff'), mask_rr(W2, H2, (12 * SS, 12 * SS, W2 - 12 * SS, H2 - 12 * SS), 22 * SS))
ov = Image.new('L', (W2, H2), 0); ImageDraw.Draw(ov).ellipse((W2 * 0.1, H2 * 0.24, W2 * 0.9, H2 * 0.76), fill=255); ov = ov.rotate(-28, resample=Image.BICUBIC, center=(W2 / 2, H2 / 2))
fill_mask(bk, solid(W2, H2, '#ffffff'), ov)
back = down(bk, CWd, CHd)
paste_c(back, fancy_text('BÀI', font(CB, 62), fill=('#ff8fbf', '#ff5c9a'), inner='#7a2650', outer_w=6, inner_w=6, shadow_alpha=0.15).rotate(-20, expand=True, resample=Image.BICUBIC), CWd / 2 - 6, CHd / 2 - 30)
paste_c(back, fancy_text('MÀU', font(CB, 62), fill=('#c9b4ff', '#8f6af0'), inner='#3d2580', outer_w=6, inner_w=6, shadow_alpha=0.15).rotate(-20, expand=True, resample=Image.BICUBIC), CWd / 2 + 6, CHd / 2 + 34)
S(back, 'bai-mau/cards/back.png')

# =============================================================== LÔ TÔ
DEC = ['pink', 'peach', 'lemon', 'mint', 'sky', 'lavender', 'red', 'gold', 'grey']
for n in range(1, 91):
    c = DEC[min(8, n // 10)]
    b = candy_circle(110, c, depth=7)
    inner = candy_circle(70, ('#ffffff', '#ffffff', '#e8e0ee'), depth=0, gloss=False)
    paste_c(b, inner, 55, 51)
    ImageDraw.Draw(b).text((55, 50), str(n), font=font(COINY, 40 if n < 10 else 36), fill=rgb(PAL[c][2]), anchor='mm')
    S(b, f'lo-to/balls/ball_{n:02d}.png')


def loto_ticket(seed, theme='pink'):
    rnd = random.Random(seed)
    cols = [list(range(1, 10))] + [list(range(c * 10, c * 10 + 10)) for c in range(1, 8)] + [list(range(80, 91))]
    for c in cols:
        rnd.shuffle(c)
    grid = [[None] * 9 for _ in range(9)]
    for r in range(9):
        chosen = sorted(rnd.sample(range(9), 5))
        for c in chosen:
            grid[r][c] = cols[c].pop()
    for c in range(9):
        vals = sorted(grid[r][c] for r in range(9) if grid[r][c] is not None)
        it = iter(vals)
        for r in range(9):
            if grid[r][c] is not None:
                grid[r][c] = next(it)
    import json as _j
    (G / 'lo-to').mkdir(parents=True, exist_ok=True)
    (G / 'lo-to' / f'ticket_{theme}.json').write_text(_j.dumps({'cell': 96, 'origin': [40, 150], 'grid': grid}))
    cell = 96
    W, H = cell * 9 + 80, cell * 9 + 200
    light, base, dark = PAL[theme]
    t = candy_rr(W, H, theme, radius=50, depth=14, dot=False)
    paste_c(t, fancy_text('LÔ TÔ', font(CB, 76), fill=('#ffffff', '#fff3f8'), inner=dark), W / 2, 74)
    d = ImageDraw.Draw(t)
    x0, y0 = 40, 150
    fnum = font(COINY, 44)
    for r in range(9):
        for c in range(9):
            x, y = x0 + c * cell, y0 + r * cell
            v = grid[r][c]
            if v is None:
                d.rounded_rectangle((x + 4, y + 4, x + cell - 4, y + cell - 4), radius=16, fill=rgb(mix(light, base, 0.45)))
                paste_c(t, load(FL / 'symbols' / 'red_heart.png', 26) if (r + c) % 3 == 0 else new(1, 1), x + cell / 2, y + cell / 2)
            else:
                d.rounded_rectangle((x + 4, y + 4, x + cell - 4, y + cell - 4), radius=16, fill=(255, 255, 255, 255))
                d.text((x + cell / 2, y + cell / 2 + 2), str(v), font=fnum, fill=rgb(dark), anchor='mm')
        if r in (2, 5):
            d.line((x0, y0 + (r + 1) * cell, x0 + 9 * cell, y0 + (r + 1) * cell), fill='white', width=5)
    return t


for i, th in enumerate(('pink', 'mint', 'sky', 'lemon')):
    S(loto_ticket(100 + i, th), f'lo-to/ticket_{th}.png')
mk = candy_circle(84, ('#ffffff', '#ff6fa8', '#c2407a'), depth=4)
mk.putalpha(mk.split()[3].point(lambda v: int(v * 0.85)))
paste_c(mk, load(FL / 'symbols' / 'red_heart.png', 44), 42, 40)
S(mk, 'lo-to/marker_heart.png')

# =============================================================== CỜ CARO
def caro_x(d=128):
    D = d * SS
    m = Image.new('L', (D, D), 0)
    bar = Image.new('L', (D, D), 0)
    ImageDraw.Draw(bar).rounded_rectangle((D * 0.1, D * 0.38, D * 0.9, D * 0.62), radius=D * 0.12, fill=255)
    m = ImageChops.lighter(bar.rotate(45, resample=Image.BICUBIC), bar.rotate(-45, resample=Image.BICUBIC))
    im = new(D, D + 8 * SS)
    sh = Image.new('RGBA', (D, D + 8 * SS), rgb('#c2407a')); mm = Image.new('L', (D, D + 8 * SS), 0); mm.paste(m, (0, 8 * SS)); sh.putalpha(mm); im.alpha_composite(sh)
    fg = lin_grad(D, D + 8 * SS, '#ffc2da', '#ff5c9a'); mm2 = Image.new('L', (D, D + 8 * SS), 0); mm2.paste(m, (0, 0)); fg.putalpha(mm2); im.alpha_composite(fg)
    gl = lin_grad(D, D + 8 * SS, (255, 255, 255, 150), (255, 255, 255, 0)); gm = Image.new('L', (D, D + 8 * SS), 0); gm.paste(m.filter(ImageFilter.MinFilter(int(D * 0.06) | 1)), (0, -int(D * 0.03))); gl.putalpha(ImageChops.multiply(gm, mm2)); im.alpha_composite(gl)
    return down(im, d, d + 8)


def caro_o(d=128):
    D = d * SS
    m = Image.new('L', (D, D), 0)
    ImageDraw.Draw(m).ellipse((D * 0.12, D * 0.12, D * 0.88, D * 0.88), outline=255, width=int(D * 0.2))
    im = new(D, D + 8 * SS)
    sh = Image.new('RGBA', im.size, rgb('#2a7fd0')); mm = Image.new('L', im.size, 0); mm.paste(m, (0, 8 * SS)); sh.putalpha(mm); im.alpha_composite(sh)
    fg = lin_grad(D, D + 8 * SS, '#c9e6ff', '#4fb3ff'); mm2 = Image.new('L', im.size, 0); mm2.paste(m, (0, 0)); fg.putalpha(mm2); im.alpha_composite(fg)
    gl = Image.new('L', im.size, 0); ImageDraw.Draw(gl).arc((D * 0.2, D * 0.2, D * 0.8, D * 0.8), 200, 300, fill=150, width=int(D * 0.06))
    w = Image.new('RGBA', im.size, (255, 255, 255, 255)); w.putalpha(gl); im.alpha_composite(w)
    return down(im, d, d + 8)


S(caro_x(), 'co-caro/piece_x.png'); S(caro_o(), 'co-caro/piece_o.png')
cell = 64
tile = new(cell, cell, rgb('#fffaf3'))
td = ImageDraw.Draw(tile); td.line((0, 0, cell, 0), fill=rgb('#cfe3ff'), width=2); td.line((0, 0, 0, cell), fill=rgb('#cfe3ff'), width=2)
S(tile, 'co-caro/grid_tile_64.png')
n = 15
brd = new(cell * n + 60, cell * n + 60, rgb('#ffe3ef'))
inner = new(cell * n, cell * n)
for r in range(n):
    for c in range(n):
        inner.alpha_composite(tile, (c * cell, r * cell))
ImageDraw.Draw(inner).rectangle((0, 0, cell * n - 1, cell * n - 1), outline=rgb('#cfe3ff'), width=2)
brd.alpha_composite(inner, (30, 30))
ImageDraw.Draw(brd).rounded_rectangle((0, 0, brd.width - 1, brd.height - 1), radius=40, outline=rgb('#ff9cc4'), width=10)
S(brd, 'co-caro/board_15x15.png')
wl = new(cell * 5, 24); ImageDraw.Draw(wl).rounded_rectangle((0, 0, cell * 5 - 1, 23), radius=12, fill=(255, 217, 74, 220))
S(wl, 'co-caro/win_line.png')

(G / 'LICENSE.txt').write_text('All files in games/ are generated for this project with code (Pillow): CC0.\n'
                               'Exceptions: bau-cua/symbols cua, tom, ca, ga, nai and a few decorations are Microsoft Fluent Emoji (MIT) — keep the MIT notice.\n'
                               'Bài Màu is an original pastel colour-card design (not affiliated with any brand).\n', encoding='utf-8')
print('game files:', made)
