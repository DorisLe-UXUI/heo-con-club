"""Premium pastel UI kit, callout banners and lobby backgrounds.
Usage: python3 -E gen_ui.py <assets_dir>
"""
import sys, math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).parent))
from gfx import *
from custom_img import load_art, fit_box
CUSTOM = Path(sys.argv[1]).resolve().parent / 'custom'

A = Path(sys.argv[1])
OUT = A / 'ui-premium-generated'
F = A / 'fonts'
CB = F / 'GrandstanderBlack-Regular.ttf'  # Cherry Bomb One draws Đ/ừ/ứ/ử/ữ/ự wrong; Coiny draws V like U
COINY = F / 'Coiny-Regular.ttf'
BALOO = F / 'Baloo2[wght].ttf'
FL = A / 'emoji-fluent-3d'
COLORS = ['pink', 'mint', 'sky', 'lemon', 'lavender', 'peach', 'grey']
made = 0


def S(im, rel):
    global made
    save(im, OUT / rel); made += 1


# ---------------------------------------------------------------- buttons (9-slice friendly)
for c in COLORS:
    S(candy_rr(360, 120, c, radius=48), f'buttons/pill_{c}.png')
    S(candy_rr(360, 120, c, radius=48, depth=3), f'buttons/pill_{c}_pressed.png')
    S(candy_rr(140, 140, c, radius=40), f'buttons/square_{c}.png')
    S(candy_circle(140, c), f'buttons/round_{c}.png')
# labelled examples
LABELS = [('pink', 'Chơi ngay'), ('mint', 'Nhận quà'), ('sky', 'Vào bàn'), ('lemon', 'Nạp xu'), ('lavender', 'Bạn bè'), ('peach', 'Đánh'), ('grey', 'Bỏ lượt')]
fb = font(CB, 48)
for c, t in LABELS:
    b = candy_rr(360, 120, c, radius=48)
    d = ImageDraw.Draw(b)
    d.text((180, 54), t, font=fb, fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(PAL[c][2]))
    S(b, f'buttons/labelled/{c}_{t.lower().replace(" ", "_")}.png'.replace('ơ', 'o').replace('ậ', 'a').replace('à', 'a').replace('ạ', 'a').replace('ỏ', 'o').replace('ượ', 'uo').replace('á', 'a').replace('è', 'e').replace('ạ', 'a').replace('ậ', 'a').replace('ậ', 'a').replace('ã', 'a').replace('ả', 'a').replace('đ', 'd').replace('Đ', 'D').replace('ơ', 'o').replace('ư', 'u'))

# ---------------------------------------------------------------- panels / popups
def panel(w, h, color='pink', title=None, close=True):
    light, base, dark = PAL[color]
    W, H = w * SS, h * SS
    im = new(W, H)
    r = 56 * SS
    top = 46 * SS if title else 0
    # outer frame
    fill_mask(im, solid(W, H, dark), mask_rr(W, H, (0, top + 10 * SS, W - 1, H - 1), r))
    fill_mask(im, lin_grad(W, H, mix(light, base, 0.5), base), mask_rr(W, H, (0, top, W - 1, H - 14 * SS), r))
    # inner cream area
    fill_mask(im, lin_grad(W, H, '#fffdf8', '#fff3ea'), mask_rr(W, H, (22 * SS, top + 26 * SS + (60 * SS if title else 0), W - 22 * SS, H - 38 * SS), r * 0.7))
    # top gloss
    fill_mask(im, lin_grad(W, H, (255, 255, 255, 140), (255, 255, 255, 0)), mask_rr(W, H, (30 * SS, top + 8 * SS, W - 30 * SS, top + 60 * SS), 30 * SS))
    im = down(im, w, h)
    if title:
        rb = ribbon(min(w - 60, 560), 120, color='peach' if color != 'peach' else 'pink', text=title)
        paste_c(im, rb, w / 2, 60)
    if close:
        cb = candy_circle(86, 'red')
        d = ImageDraw.Draw(cb)
        d.line((28, 26, 58, 54), fill='white', width=9); d.line((58, 26, 28, 54), fill='white', width=9)
        im2 = new(w + 30, h + 30); im2.alpha_composite(im, (0, 30)); paste_c(im2, cb, w - 18, 60)
        im = im2
    return im


def ribbon(w, h, color='peach', text=None):
    light, base, dark = PAL[color]
    W, H = w * SS, h * SS
    im = new(W, H)
    d = ImageDraw.Draw(im)
    tail = H * 0.42
    # tails
    for side in (0, 1):
        x0 = 0 if side == 0 else W - tail * 1.6
        pts = [(x0 + (0 if side == 0 else tail * 1.6), H * 0.3), (x0 + (tail * 1.6 if side == 0 else 0), H * 0.3),
               (x0 + (tail * 1.6 if side == 0 else 0), H * 0.95), (x0 + (0 if side == 0 else tail * 1.6), H * 0.95), (x0 + (tail * 0.55 if side == 0 else tail * 1.05), H * 0.62)]
        d.polygon(pts, fill=rgb(dark))
    body = (tail * 0.9, H * 0.1, W - tail * 0.9, H * 0.82)
    fill_mask(im, lin_grad(W, H, mix(light, base, 0.3), base), mask_rr(W, H, body, H * 0.18))
    fill_mask(im, lin_grad(W, H, (255, 255, 255, 120), (255, 255, 255, 0)), mask_rr(W, H, (body[0] + 20, body[1] + 8, body[2] - 20, body[1] + (body[3] - body[1]) * 0.45), H * 0.12))
    im = down(im, w, h)
    if text:
        f = font(CB, int(h * 0.38))
        ImageDraw.Draw(im).text((w / 2, h * 0.44), text, font=f, fill='white', anchor='mm', stroke_width=max(3, h // 28), stroke_fill=rgb(dark))
    return im


for c in ('pink', 'mint', 'sky', 'lavender', 'lemon'):
    S(panel(760, 560, c, title=None, close=False), f'panels/panel_{c}.png')
    S(ribbon(560, 120, c), f'ribbons/ribbon_{c}.png')
S(panel(820, 620, 'pink', title='Thông báo'), 'panels/popup_example_thong_bao.png')
S(panel(820, 620, 'mint', title='Quà mỗi ngày'), 'panels/popup_example_qua_moi_ngay.png')
S(panel(820, 620, 'sky', title='Cài đặt'), 'panels/popup_example_cai_dat.png')

# ---------------------------------------------------------------- avatar frames
def frame(kind, d=320):
    D = d * SS
    im = new(D, D)
    cx = cy = D / 2
    R = D * 0.40
    ring_w = D * 0.07
    styles = {
        'pink': ('#ffb3d0', '#ff5c9a', '#c2407a'), 'mint': ('#bff3e0', '#3ccf9b', '#1f9a70'), 'sky': ('#cfe8ff', '#4fb3ff', '#2a7fd0'),
        'gold': ('#fff1b8', '#ffc83a', '#b07800'), 'silver': ('#ffffff', '#c9cdd8', '#80869a'), 'lavender': ('#e7dcff', '#a07bff', '#6c4bd1'),
        'tet': ('#ffe08a', '#ff5a4a', '#b8231d'), 'rainbow': None,
    }
    st = styles[kind]
    ring = Image.new('L', (D, D), 0)
    ImageDraw.Draw(ring).ellipse((cx - R - ring_w, cy - R - ring_w, cx + R + ring_w, cy + R + ring_w), fill=255)
    ImageDraw.Draw(ring).ellipse((cx - R, cy - R, cx + R, cy + R), fill=0)
    if kind == 'rainbow':
        y, x = np.mgrid[0:D, 0:D]
        ang = (np.arctan2(y - cy, x - cx) / (2 * np.pi) + 0.5)
        hsv = np.stack([(ang * 255).astype(np.uint8), np.full((D, D), 120, np.uint8), np.full((D, D), 255, np.uint8)], -1)
        g = Image.fromarray(hsv, 'HSV').convert('RGBA')
    else:
        g = rad_grad(D, D, st[0], st[1], 0.4, 0.3, 0.9, 0.9)
    fill_mask(im, g, ring)
    dd = ImageDraw.Draw(im)
    dark = st[2] if st else '#9b6bd6'
    dd.ellipse((cx - R - ring_w, cy - R - ring_w, cx + R + ring_w, cy + R + ring_w), outline=rgb(dark), width=int(SS * 3))
    dd.ellipse((cx - R, cy - R, cx + R, cy + R), outline=rgb(dark), width=int(SS * 3))
    # gloss arc
    gm = Image.new('L', (D, D), 0)
    ImageDraw.Draw(gm).arc((cx - R - ring_w * 0.6, cy - R - ring_w * 0.6, cx + R + ring_w * 0.6, cy + R + ring_w * 0.6), 200, 320, fill=200, width=int(ring_w * 0.35))
    fill_mask(im, solid(D, D, (255, 255, 255, 255)), gm)
    im = down(im, d, d)
    # decorations
    if kind in ('gold', 'tet', 'lavender', 'rainbow'):
        crown = load(FL / 'game' / 'crown.png', int(d * 0.36), rot=-12)
        paste_c(im, crown, d * 0.5, d * 0.1)
    if kind in ('pink', 'rainbow'):
        for x, y, s, r in ((0.12, 0.78, 0.2, 10), (0.88, 0.78, 0.2, -10)):
            paste_c(im, load(FL / 'symbols' / 'sparkling_heart.png', int(d * s), rot=r), d * x, d * y)
    if kind == 'tet':
        paste_c(im, load(FL / 'tet' / 'cherry_blossom.png', int(d * 0.22)), d * 0.13, d * 0.8)
        paste_c(im, load(FL / 'tet' / 'red_paper_lantern.png', int(d * 0.2)), d * 0.88, d * 0.78)
    if kind == 'mint':
        paste_c(im, load(FL / 'symbols' / 'sparkles.png', int(d * 0.2)), d * 0.86, d * 0.16)
        paste_c(im, load(FL / 'game' / 'four_leaf_clover.png', int(d * 0.2)), d * 0.14, d * 0.84)
    if kind == 'sky':
        paste_c(im, load(FL / 'symbols' / 'glowing_star.png', int(d * 0.2)), d * 0.86, d * 0.16)
    if kind == 'gold':
        paste_c(im, load(FL / 'game' / 'gem_stone.png', int(d * 0.16)), d * 0.5, d * 0.93)
    if kind == 'silver':
        paste_c(im, load(FL / 'symbols' / 'star.png', int(d * 0.18)), d * 0.5, d * 0.92)
    return im


for k in ('pink', 'mint', 'sky', 'gold', 'silver', 'lavender', 'tet', 'rainbow'):
    S(frame(k), f'avatar-frames/frame_{k}.png')

# ---------------------------------------------------------------- VIP & level badges
def shield(n, colors, label='VIP'):
    w, h = 220, 250
    art = CUSTOM / 'vip' / f'vip_{n}.png'
    if art.exists():                                      # your own blank badge (custom/vip): VIP and the level are written here
        pic = fit_box(load_art(art), w, h); im = new(w, h); im.alpha_composite(pic, ((w - pic.width) // 2, (h - pic.height) // 2))
        d = ImageDraw.Draw(im)
        d.text((w / 2, h * 0.38), label, font=font(CB, 46), fill='white', anchor='mm', stroke_width=5, stroke_fill=rgb(colors[2]))
        d.text((w / 2, h * 0.63), str(n), font=font(COINY, 78), fill='white', anchor='mm', stroke_width=6, stroke_fill=rgb(colors[2]))
        return im
    W, H = w * SS, h * SS
    im = new(W, H)
    pts = [(W * 0.5, H * 0.02), (W * 0.95, H * 0.15), (W * 0.9, H * 0.6), (W * 0.5, H * 0.97), (W * 0.1, H * 0.6), (W * 0.05, H * 0.15)]
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(SS * 2)).point(lambda v: 255 if v > 128 else 0)
    fill_mask(im, solid(W, H, colors[2]), m)
    inner = m.filter(ImageFilter.MinFilter(int(SS * 9) | 1))
    fill_mask(im, rad_grad(W, H, colors[0], colors[1], 0.4, 0.25, 0.9, 0.9), inner)
    gl = Image.new('L', (W, H), 0); ImageDraw.Draw(gl).ellipse((W * 0.15, H * 0.06, W * 0.85, H * 0.42), fill=120)
    fill_mask(im, solid(W, H, (255, 255, 255, 255)), ImageChops.multiply(gl, inner))
    im = down(im, w, h)
    d = ImageDraw.Draw(im)
    d.text((w / 2, h * 0.36), label, font=font(CB, 50), fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(colors[2]))
    d.text((w / 2, h * 0.64), str(n), font=font(COINY, 84), fill='white', anchor='mm', stroke_width=5, stroke_fill=rgb(colors[2]))
    return im


VIPC = [('#e6f0ff', '#9fb8d9', '#5e7699'), ('#d8ffef', '#4fd3a0', '#1f8f68'), ('#d6ecff', '#4fa8ff', '#2a6fc0'), ('#efe2ff', '#a678ff', '#6a3fd0'),
        ('#ffe0ee', '#ff6fa8', '#b8346d'), ('#fff3c0', '#ffc83a', '#b07800'), ('#ffe2d6', '#ff6a4a', '#b0301a'), ('#2f2a3a', '#7b5cff', '#ffd54a')]
for i, cl in enumerate(VIPC, 1):
    S(shield(i, cl), f'badges/vip_{i}.png')
for i, c in enumerate(['sky', 'mint', 'lemon', 'pink', 'lavender']):
    st = candy_circle(120, c)
    ImageDraw.Draw(st).text((60, 56), str((i + 1) * 10), font=font(COINY, 52), fill='white', anchor='mm', stroke_width=4, stroke_fill=rgb(PAL[c][2]))
    S(st, f'badges/level_{(i + 1) * 10}.png')
# tags
for t, c in (('NEW', 'mint'), ('HOT', 'red'), ('SALE', 'lemon'), ('VIP', 'lavender'), ('MỚI', 'pink'), ('x2', 'sky')):
    b = candy_rr(150, 64, c, radius=26, depth=5)
    ImageDraw.Draw(b).text((75, 29), t, font=font(CB, 34), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb(PAL[c][2]))
    S(b, f'badges/tag_{t.lower().replace("ớ", "o").replace("ơ", "o")}.png')
dot = candy_circle(56, 'red', depth=3)
ImageDraw.Draw(dot).text((28, 26), '3', font=font(COINY, 30), fill='white', anchor='mm')
S(dot, 'badges/notify_dot_3.png')
S(candy_circle(40, 'red', depth=2), 'badges/notify_dot.png')

# ---------------------------------------------------------------- currency pills / top bar
def pill(icon, text, color='pink'):
    w, h = 300, 84
    b = candy_rr(w, h, ('#ffffff', '#fff6fa', PAL[color][1]), radius=40, depth=6, dot=False)
    paste_c(b, load(icon, 78), 40, 38)
    fs = 40
    while fs > 18 and font(BALOO, fs, 'ExtraBold').getlength(text) > w - 96 - 76:
        fs -= 2
    ImageDraw.Draw(b).text((92, 40), text, font=font(BALOO, fs, 'ExtraBold'), fill=rgb(PAL[color][2]), anchor='lm')
    plus = candy_circle(60, 'mint')
    ImageDraw.Draw(plus).line((18, 28, 42, 28), fill='white', width=7); ImageDraw.Draw(plus).line((30, 16, 30, 40), fill='white', width=7)
    paste_c(b, plus, w - 38, 38)
    return b


S(pill(FL / 'game' / 'coin.png', '1.250.000', 'lemon'), 'topbar/coin_pill.png')
S(pill(FL / 'game' / 'gem_stone.png', '2.480', 'sky'), 'topbar/gem_pill.png')
S(pill(FL / 'symbols' / 'red_heart.png', '5 / 5', 'pink'), 'topbar/heart_pill.png')
S(pill(FL / 'tet' / 'red_envelope.png', '12', 'red'), 'topbar/lixi_pill.png')
S(candy_rr(300, 84, ('#ffffff', '#fff6fa', '#f3b8cf'), radius=40, depth=6, dot=False), 'topbar/blank_pill.png')

# ---------------------------------------------------------------- toggles, checkbox, progress, tabs, slider
def toggle(on=True, color='pink'):
    w, h = 160, 84
    track = candy_rr(w, h, color if on else 'grey', radius=40, depth=4, dot=False)
    knob = candy_circle(66, ('#ffffff', '#ffffff', '#d9d4e2'), depth=4)
    paste_c(track, knob, w - 44 if on else 44, 38)
    return track


for c in ('pink', 'mint', 'sky'):
    S(toggle(True, c), f'controls/toggle_on_{c}.png')
S(toggle(False), 'controls/toggle_off.png')
for state in (True, False):
    cbx = candy_rr(90, 90, 'mint' if state else ('#ffffff', '#f4f1f8', '#cfc8da'), radius=24, depth=6, dot=False)
    if state:
        ImageDraw.Draw(cbx).line((24, 44, 40, 60, 68, 26), fill='white', width=11, joint='curve')
    S(cbx, f'controls/checkbox_{"on" if state else "off"}.png')


def progress(frac, color='pink', w=520, h=56):
    bg = candy_rr(w, h, ('#f3eef7', '#e9e2f1', '#cfc6dc'), radius=h // 2, depth=4, gloss=False, dot=False)
    if frac > 0:
        fw = max(h, int(w * frac))
        fg = candy_rr(fw, h - 8, color, radius=(h - 8) // 2, depth=4, dot=False)
        bg.alpha_composite(fg, (0, 2))
    return bg


for c in ('pink', 'mint', 'sky', 'lemon', 'lavender'):
    S(progress(0.68, c), f'controls/progress_{c}_68.png')
S(progress(0), 'controls/progress_empty.png')
for c in ('pink', 'mint', 'sky', 'lemon', 'lavender'):
    S(candy_rr(500, 50, c, radius=25, depth=4, dot=False), f'controls/progress_fill_{c}.png')
for active in (True, False):
    t = candy_rr(240, 92, 'pink' if active else ('#ffffff', '#fbf3f7', '#e6cbd8'), radius=34, depth=6, dot=active)
    S(t, f'controls/tab_{"active" if active else "inactive"}.png')
sl = progress(0.45, 'sky')
paste_c(sl, candy_circle(74, ('#ffffff', '#ffffff', '#b9c8dd')), int(520 * 0.45), 26)
S(sl, 'controls/slider_example.png')
S(candy_circle(74, ('#ffffff', '#ffffff', '#b9c8dd')), 'controls/slider_knob.png')

# ---------------------------------------------------------------- stars, timer ring, speech bubbles
def star(d, filled=True):
    D = d * SS
    im = new(D, D)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = D * (0.48 if i % 2 == 0 else 0.22)
        pts.append((D / 2 + rr * math.cos(a), D / 2 + rr * math.sin(a) + D * 0.03))
    m = Image.new('L', (D, D), 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(SS * 4)).point(lambda v: 255 if v > 110 else 0)
    if filled:
        fill_mask(im, solid(D, D, '#e0a000'), m)
        fill_mask(im, rad_grad(D, D, '#fff6b0', '#ffc61a', 0.4, 0.3, 0.8, 0.8), m.filter(ImageFilter.MinFilter(int(SS * 5) | 1)))
        gl = Image.new('L', (D, D), 0); ImageDraw.Draw(gl).ellipse((D * 0.3, D * 0.12, D * 0.6, D * 0.38), fill=170)
        fill_mask(im, solid(D, D, (255, 255, 255, 255)), ImageChops.multiply(gl, m))
    else:
        fill_mask(im, solid(D, D, '#d9cfe0'), m)
        fill_mask(im, solid(D, D, '#efe9f3'), m.filter(ImageFilter.MinFilter(int(SS * 5) | 1)))
    return down(im, d, d)


S(star(128, True), 'misc/star_full.png'); S(star(128, False), 'misc/star_empty.png')
for steps in range(0, 13):
    d = 200; D = d * SS
    im = new(D, D)
    dd = ImageDraw.Draw(im)
    dd.ellipse((10 * SS, 10 * SS, D - 10 * SS, D - 10 * SS), outline=(255, 255, 255, 200), width=16 * SS)
    frac = steps / 12
    col = '#3ccf9b' if frac > 0.5 else ('#ffc93c' if frac > 0.25 else '#ff5a5a')
    if frac > 0:
        dd.arc((10 * SS, 10 * SS, D - 10 * SS, D - 10 * SS), -90, -90 + 360 * frac, fill=rgb(col), width=16 * SS)
    S(down(im, d, d), f'misc/timer_ring_{steps:02d}.png')


def bubble(w=360, h=200, tail='left', color='#ffffff'):
    W, H = w * SS, h * SS
    im = new(W, H)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, W - 1, H * 0.8), radius=H * 0.3, fill=rgb(color))
    tx = W * 0.22 if tail == 'left' else W * 0.78
    d.polygon([(tx - W * 0.07, H * 0.7), (tx + W * 0.07, H * 0.7), (tx - (W * 0.08 if tail == 'left' else -W * 0.08), H * 0.99)], fill=rgb(color))
    return with_shadow(down(im, w, h), blur=8, alpha=0.18, dy=5)


S(bubble(tail='left'), 'misc/speech_bubble_left.png'); S(bubble(tail='right'), 'misc/speech_bubble_right.png')
S(bubble(tail='left', color='#ffe3ef'), 'misc/speech_bubble_pink_left.png')

# ---------------------------------------------------------------- daily reward cards
for day in range(1, 8):
    c = ['sky', 'mint', 'lemon', 'peach', 'lavender', 'pink', 'gold'][day - 1]
    card = candy_rr(220, 280, c, radius=40, depth=10)
    inner = candy_rr(180, 150, ('#ffffff', '#fffaf5', '#ead9e2'), radius=30, depth=0, gloss=False, dot=False)
    card.alpha_composite(inner, (20, 62))
    icon = {1: 'coin', 2: 'coin', 3: 'money_bag', 4: 'gem_stone', 5: 'wrapped_gift', 6: 'money_bag', 7: 'crown'}[day]
    art = CUSTOM / 'daily' / f'day_{day}.png'             # your own reward picture (custom/daily)
    paste_c(card, fit_box(load_art(art), 150, 128) if art.exists() else load(FL / 'game' / f'{icon}.png', 120), 110, 136)
    d = ImageDraw.Draw(card)
    d.text((110, 34), f'Ngày {day}', font=font(CB, 34), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb(PAL[c][2]))
    d.text((110, 240), ['1K', '2K', '5K', '10', 'Quà', '50K', 'VIP'][day - 1], font=font(CB, 38), fill='white', anchor='mm', stroke_width=3, stroke_fill=rgb(PAL[c][2]))
    S(card, f'daily-reward/day_{day}.png')

# ---------------------------------------------------------------- callout banners (Vietnamese card-game juice)
CALLOUTS = [
    ('CHẶT HEO!', ('#fff27a', '#ff9e2c')), ('THỐI 2!', ('#ffe0f0', '#ff5c9a')), ('TỚI TRẮNG!', ('#fff9c4', '#ffc400')), ('ĐỒNG HOA!', ('#e4fff2', '#3ccf9b')),
    ('SẢNH RỒNG!', ('#ffe6c7', '#ff7a2c')), ('TỨ QUÝ!', ('#efe2ff', '#a678ff')), ('3 ĐÔI THÔNG!', ('#dff1ff', '#4fa8ff')), ('4 ĐÔI THÔNG!', ('#dff1ff', '#2a7fd0')),
    ('Ù!', ('#fff27a', '#ff9e2c')), ('Ù KHAN!', ('#ffe0f0', '#ff5c9a')), ('MÓM!', ('#eeeeee', '#9a93a8')), ('PHỎM!', ('#e4fff2', '#3ccf9b')),
    ('XÌ BÀNG!', ('#fff27a', '#ff9e2c')), ('XÌ DÁCH!', ('#ffe0f0', '#ff5c9a')), ('NGŨ LINH!', ('#efe2ff', '#a678ff')), ('QUẮC!', ('#eeeeee', '#8a8496')),
    ('BA TÂY!', ('#fff9c4', '#ffc400')), ('SÁP!', ('#ffe6c7', '#ff7a2c')), ('BÁO SÂM!', ('#dff1ff', '#4fa8ff')), ('MẬU BINH!', ('#efe2ff', '#a678ff')),
    ('BINH LỦNG!', ('#eeeeee', '#8a8496')), ('ALL IN!', ('#fff27a', '#ff5c2c')), ('THẮNG!', ('#fff27a', '#ff9e2c')), ('THUA!', ('#e0e7ff', '#7d8bb5')),
    ('HÒA!', ('#e4fff2', '#3ccf9b')), ('NHẤT!', ('#fff9c4', '#ffc400')), ('NHÌ!', ('#eef2f7', '#a8b3c7')), ('BA!', ('#ffe6c7', '#d07a3a')),
    ('BÉT!', ('#eeeeee', '#8a8496')), ('BỎ LƯỢT', ('#ffffff', '#c9c2d4')), ('TÀI!', ('#ffe0e0', '#ff4a4a')), ('XỈU!', ('#dff1ff', '#2a7fd0')),
    ('CHẴN!', ('#ffe0f0', '#ff5c9a')), ('LẺ!', ('#e4fff2', '#3ccf9b')), ('KINH!', ('#fff27a', '#ff9e2c')), ('CHIẾU TƯỚNG!', ('#ffe0e0', '#ff4a4a')),
    ('JACKPOT!', ('#fff27a', '#ff9e2c')), ('NỔ HŨ!', ('#ffe6c7', '#ff7a2c')), ('ĐẾN LƯỢT BẠN', ('#ffffff', '#ff8fbf')), ('SẴN SÀNG!', ('#e4fff2', '#3ccf9b')),
]
fcall = font(CB, 130)
import unicodedata


def slug(t):
    t = unicodedata.normalize('NFD', t.replace('Đ', 'D').replace('đ', 'd'))
    t = ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn').lower()
    return ''.join(ch if ch.isalnum() else '_' for ch in t).strip('_')


for text, grad in CALLOUTS:
    inner = '#7a2650' if grad[1] not in ('#9a93a8', '#8a8496', '#c9c2d4', '#a8b3c7', '#7d8bb5') else '#4a4458'
    im = fancy_text(text, fcall, fill=grad, inner=inner)
    im = im.rotate(-3, resample=Image.BICUBIC, expand=True)
    S(im, f'callouts/{slug(text)}.png')

# ---------------------------------------------------------------- lobby backgrounds
def lobby_bg(w, h, top, bot, seed=1):
    rnd = random.Random(seed)
    im = lin_grad(w, h, top, bot)
    bok = new(w, h)
    d = ImageDraw.Draw(bok)
    for _ in range(int(w * h / 26000)):
        r = rnd.uniform(10, 90)
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randint(18, 55)))
    im.alpha_composite(bok.filter(ImageFilter.GaussianBlur(6)))
    def fluffy(cw):
        ch = int(cw * 0.55)
        Wc, Hc = cw * 2, ch * 2
        m = Image.new('L', (Wc, Hc), 0); md = ImageDraw.Draw(m)
        md.rounded_rectangle((Wc * 0.08, Hc * 0.55, Wc * 0.92, Hc * 0.95), radius=Hc * 0.2, fill=255)
        for cx_, cy_, rr in ((0.25, 0.62, 0.22), (0.45, 0.45, 0.3), (0.68, 0.52, 0.25), (0.82, 0.68, 0.16), (0.15, 0.75, 0.14)):
            md.ellipse((Wc * cx_ - Hc * rr, Hc * cy_ - Hc * rr, Wc * cx_ + Hc * rr, Hc * cy_ + Hc * rr), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(3))
        c = new(Wc, Hc)
        fill_mask(c, lin_grad(Wc, Hc, (255, 255, 255, 235), (244, 232, 255, 220)), m)
        sh = m.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.25))
        out = new(Wc, Hc + 20); s2 = Image.new('RGBA', (Wc, Hc), (170, 120, 200, 255)); s2.putalpha(sh); out.alpha_composite(s2, (0, 14)); out.alpha_composite(c)
        return out.resize((cw, int((Hc + 20) / 2)), Image.LANCZOS)
    for i in range(6):
        c = fluffy(int(rnd.uniform(0.2, 0.34) * w))
        im.alpha_composite(c, (int(rnd.uniform(-0.1, 0.9) * w), int(rnd.uniform(0.66, 0.86) * h)))
    for i in range(14):
        s = load(FL / 'symbols' / rnd.choice(['sparkles.png', 'glowing_star.png', 'star.png']), int(rnd.uniform(26, 60)))
        s.putalpha(s.split()[3].point(lambda v: int(v * 0.55)))
        im.alpha_composite(s, (int(rnd.uniform(0, w - 60)), int(rnd.uniform(0, h * 0.6))))
    return im.convert('RGB')


for name, top, bot in (('pink', '#ffd6e8', '#ffb3d1'), ('dream', '#ffd6e8', '#c9c2ff'), ('sky', '#d6efff', '#a8d4ff'), ('mint', '#dbfff1', '#a6edd2'),
                       ('sunset', '#ffe3c2', '#ff9fb8'), ('tet', '#fff1c7', '#ffb38a')):
    S(lobby_bg(1920, 1080, top, bot), f'lobby-backgrounds/lobby_{name}_1920x1080.png')
    S(lobby_bg(1080, 1920, top, bot, seed=2), f'lobby-backgrounds/lobby_{name}_1080x1920.png')

(OUT / 'LICENSE.txt').write_text('Generated for this project with code (Pillow). Uses Fluent Emoji (MIT) for a few decorations and Kenney clouds (CC0).\n'
                                 'The generated art itself is CC0; keep the Fluent MIT notice if you ship the decorated frames/rewards/pills.\n', encoding='utf-8')
print('ui files:', made)
