"""Heo Con card deck (CC0, drawn in code) - replaces the Dani Maccari deck, whose license forbids redistributing it.
52 cards + 2 backs + blank, drawn at 400x576 and saved at 300x432 (same 100:144 shape and file names as the old deck).
Suit pips and J/Q/K faces are Fluent 3D emoji (MIT, see emoji-fluent-3d/LICENSE.txt); ranks use Grandstander Black (OFL).
Usage: python3 -E tools/gen_cards.py assets
"""
import sys, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

A = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets')
OUT = A / 'cards-heocon' / 'cards'
FL = A / 'emoji-fluent-3d'
FONT = A / 'fonts' / 'GrandstanderBlack-Regular.ttf'
W, H, S = 400, 576, 2                     # layout size and supersampling factor
OUT_SIZE = (300, 432)                     # saved size: sharp at 150x216 on 2x screens, light enough for the web
SUITS = {'hearts': 'heart_suit', 'diamonds': 'diamond_suit', 'clubs': 'club_suit', 'spades': 'spade_suit'}
RED = {'hearts', 'diamonds'}
RANKS = [('A', 'A')] + [(f'{n:02d}', str(n)) for n in range(2, 11)] + [('J', 'J'), ('Q', 'Q'), ('K', 'K')]
FACES = {'J': 'characters/ninja.png', 'Q': 'characters/princess.png', 'K': 'characters/prince.png'}
INK = {True: (229, 68, 109), False: (58, 45, 79)}
HALO = {True: (255, 230, 239), False: (238, 233, 255)}
_cache = {}


def emoji(rel, size):
    key = (rel, size)
    if key not in _cache:
        im = Image.open(FL / rel).convert('RGBA'); im = im.crop(im.getbbox())   # Fluent PNGs carry empty padding
        k = size / max(im.size); _cache[key] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    return _cache[key]


def shape(fill_top, fill_bot, border, inner=None):
    """Rounded card with a vertical gradient, drawn at S x size."""
    w, h, r = W * S, H * S, 40 * S
    grad = Image.new('RGBA', (1, h))
    for y in range(h):
        t = y / (h - 1); grad.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(fill_top, fill_bot)) + (255,))
    grad = grad.resize((w, h))
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); im.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((3 * S, 3 * S, w - 1 - 3 * S, h - 1 - 3 * S), r - 3 * S, outline=border, width=8 * S)
    if inner: d.rounded_rectangle((22 * S, 22 * S, w - 1 - 22 * S, h - 1 - 22 * S), r - 20 * S, outline=inner, width=3 * S)
    return im


def paste_c(base, im, cx, cy):
    base.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))


def shadowed(im, blur=6, alpha=70, dy=6):
    pad = blur * 3
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2 + dy), (0, 0, 0, 0))
    sh = Image.new('RGBA', im.size, (90, 40, 70, 0)); sh.putalpha(im.getchannel('A').point(lambda a: a * alpha // 255))
    out.alpha_composite(sh, (pad, pad + dy)); out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(im, (pad, pad)); return out


def corner(label, suit, red):
    """Rank + small suit, as a transparent tile that is pasted top-left and (rotated) bottom-right."""
    tile = Image.new('RGBA', (110 * S, 190 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    size = 92 if len(label) == 1 else 76
    f = ImageFont.truetype(str(FONT), size * S)
    d.text((55 * S, 52 * S), label, font=f, fill=INK[red] + (255,), anchor='mm', stroke_width=4 * S, stroke_fill=(255, 255, 255, 255))
    paste_c(tile, emoji(f'game/{SUITS[suit]}.png', 50 * S), 55 * S, 128 * S)
    return tile


def card(suit, rk, label):
    red = suit in RED
    im = shape((255, 255, 255), (255, 244, 249), (243, 193, 214), (255, 227, 238))
    d = ImageDraw.Draw(im)
    cx, cy = W * S // 2, H * S // 2
    if label in FACES:
        r = 138 * S
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=HALO[red] + (255,), outline=(255, 255, 255, 255), width=8 * S)
        paste_c(im, shadowed(emoji(FACES[label], 214 * S), blur=8 * S, dy=6 * S), cx, cy - 4 * S)
        paste_c(im, shadowed(emoji(f'game/{SUITS[suit]}.png', 78 * S), blur=5 * S, dy=4 * S), cx + 108 * S, cy + 108 * S)
    else:
        r = 120 * S if label != 'A' else 140 * S
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=HALO[red] + (255,))
        size = 150 if label != 'A' else 190
        paste_c(im, shadowed(emoji(f'game/{SUITS[suit]}.png', size * S), blur=8 * S, dy=8 * S), cx, cy)
    t = corner(label, suit, red)
    im.alpha_composite(t, (20 * S, 18 * S))
    im.alpha_composite(t.rotate(180), (W * S - t.width - 20 * S, H * S - t.height - 18 * S))
    return im.resize(OUT_SIZE, Image.LANCZOS)


def back(top, bot, border, dot, ring):
    im = shape(top, bot, border, (255, 255, 255, 200))
    d = ImageDraw.Draw(im, 'RGBA'); rnd = random.Random(7)
    for y in range(60, H - 40, 54):
        for x in range(60 + (y // 54 % 2) * 27, W - 40, 54):
            rr = 7 + rnd.random() * 3
            d.ellipse(((x - rr) * S, (y - rr) * S, (x + rr) * S, (y + rr) * S), fill=dot)
    cx, cy, r = W * S // 2, H * S // 2, 96 * S
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ring, outline=(255, 255, 255, 255), width=8 * S)
    paste_c(im, shadowed(emoji('animals/pig_face.png', 150 * S), blur=6 * S, dy=6 * S), cx, cy)
    return im.resize(OUT_SIZE, Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
n = 0
for suit in SUITS:
    for rk, label in RANKS:
        card(suit, rk, label).save(OUT / f'card_{suit}_{rk}.png', optimize=True); n += 1
back((255, 156, 196), (255, 111, 168), (231, 79, 140), (255, 255, 255, 70), (255, 214, 232, 255)).save(OUT / 'card_back_pink.png', optimize=True)
back((92, 72, 134), (46, 36, 71), (255, 210, 90), (255, 210, 90, 60), (120, 98, 168, 255)).save(OUT / 'card_back_black.png', optimize=True)
shape((255, 255, 255), (255, 244, 249), (243, 193, 214), (255, 227, 238)).resize(OUT_SIZE, Image.LANCZOS).save(OUT / 'card_blank.png', optimize=True)
# contact sheet for review
names = [f'card_{s}_{r}.png' for s in SUITS for r, _ in RANKS] + ['card_back_pink.png', 'card_back_black.png', 'card_blank.png']
cols, tw = 13, 120; th = round(tw * H / W)
sheet = Image.new('RGBA', (cols * (tw + 8) + 8, ((len(names) + cols - 1) // cols) * (th + 8) + 8), (255, 236, 245, 255))
for i, nm in enumerate(names):
    sheet.alpha_composite(Image.open(OUT / nm).resize((tw, th), Image.LANCZOS), (8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 8)))
sheet.convert('RGB').save(OUT.parent / '_preview.png', optimize=True)
(OUT.parent / 'LICENSE.txt').write_text('Heo Con Club card deck - CC0 1.0 (public domain), drawn in code by tools/gen_cards.py.\n'
                                         'Suit pips and J/Q/K faces are Microsoft Fluent Emoji (MIT): keep emoji-fluent-3d/LICENSE.txt with it.\n'
                                         'Rank font: Grandstander (SIL OFL 1.1).\n')
print('cards', n + 3)
