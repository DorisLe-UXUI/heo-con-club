"""Lobby game icons (512x512) for 20 games, composed from the kit.
Usage: python3 -E gen_icons.py <assets_dir> [only-key ...]
"""
import sys, random, zlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).parent))
from gfx import *
from custom_img import load_art, fit_box

A = Path(sys.argv[1])
G = A / 'games'
OUT = G / 'lobby-icons'
F = A / 'fonts'
CB = F / 'GrandstanderBlack-Regular.ttf'  # Cherry Bomb One draws Đ/ừ/ứ/ử/ữ/ự wrong; Coiny draws V like U
FL = A / 'emoji-fluent-3d'
CARD = A / 'cards-heocon' / 'cards'
R = {'A': 'A', '2': '02', '3': '03', '4': '04', '5': '05', '6': '06', '7': '07', '8': '08', '9': '09', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K'}


def card(suit, rank, h=200, rot=0):
    return with_shadow(load(CARD / f'card_{suit}_{R[rank]}.png', h=h, rot=rot), blur=5, alpha=0.25, dy=4)


def put(base, im, x, y):
    paste_c(base, im, x, y)


def fan(base, cards, cx, cy, h=200, spread=16, dx=58):
    n = len(cards)
    for i, (s, r) in enumerate(cards):
        t = i - (n - 1) / 2
        put(base, card(s, r, h, rot=-t * spread), cx + t * dx, cy + abs(t) * 10)


def icon_base(color, accent=None):
    im = candy_rr(512, 512, color, radius=118, depth=20, dot=False)
    bok = new(512, 512)
    d = ImageDraw.Draw(bok)
    rnd = random.Random(zlib.crc32(str(color).encode()) & 0xffff)   # stable across runs (hash() is salted per process)
    for _ in range(9):
        r = rnd.uniform(18, 60); x, y = rnd.uniform(30, 480), rnd.uniform(30, 380)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randint(25, 55)))
    m = mask_rr(512, 512, (0, 0, 511, 490), 118)
    bok.putalpha(ImageChops.multiply(bok.split()[3], m))
    im.alpha_composite(bok.filter(ImageFilter.GaussianBlur(2)))
    return im


from PIL import ImageChops


def title(im, text, color):
    t = fancy_text(text, font(CB, 78 if len(text) <= 7 else 66), fill=('#ffffff', '#fff2f8'), inner=PAL[color][2] if color in PAL else color, outer_w=9, inner_w=8, shadow_alpha=0.3)
    if t.width > 470:
        t = t.resize((470, int(t.height * 470 / t.width)), Image.LANCZOS)
    put(im, t, 256, 428)


def tag(im, text='HOT', color='red'):
    b = Image.open(A / 'ui-premium-generated' / 'badges' / f'tag_{text.lower()}.png').convert('RGBA')
    put(im, b.rotate(12, expand=True, resample=Image.BICUBIC), 430, 52)


def emoji(path, size, rot=0):
    return load(FL / path, size, rot=rot)


def gimg(rel, w=None, h=None, rot=0):
    return load(G / rel, w, h, rot)


ICONS = {}
ONLY = set(sys.argv[2:])


def make(key, label, color, draw, hot=None):
    if ONLY and key not in ONLY:
        ICONS[key] = label
        return
    im = icon_base(color)
    art = A.parent / 'custom' / 'icons' / f'{key}.png'          # your own illustration (no text): the title is added here
    if art.exists():
        pic = fit_box(load_art(art), 410, 330)
        put(im, with_shadow(pic, blur=8, alpha=0.28, dy=6), 256, 215)
    else:
        draw(im)
    title(im, label, color)
    if hot:
        tag(im, hot)
    save(im, OUT / f'{key}.png')
    ICONS[key] = label


make('tien-len', 'Tiến Lên', 'pink', lambda im: (fan(im, [('spades', '2'), ('hearts', '2'), ('diamonds', '2')], 230, 200, 210), put(im, emoji('animals/pig_face.png', 130, -10), 385, 285)), 'HOT')
make('phom', 'Phỏm', 'mint', lambda im: (fan(im, [('spades', '7'), ('hearts', '7'), ('diamonds', '7'), ('clubs', '8')], 240, 205, 200, 14, 52),
                                        put(im, load(A / 'ui-premium-generated/callouts/u.png', 150, rot=8), 400, 110)))
make('mau-binh', 'Mậu Binh', 'lavender', lambda im: (fan(im, [('hearts', '10'), ('hearts', 'J'), ('hearts', 'Q'), ('hearts', 'K'), ('hearts', 'A')], 256, 215, 190, 12, 46),
                                                    put(im, emoji('game/crown.png', 120, -12), 256, 78)))
make('xi-dach', 'Xì Dách', 'sky', lambda im: (put(im, card('spades', 'A', 220, 12), 190, 200), put(im, card('hearts', 'K', 220, -10), 300, 210),
                                             put(im, fancy_text('21', font(CB, 120), fill=('#fff27a', '#ff9e2c'), inner='#a5205a'), 400, 300)))
make('poker', 'Poker', 'red', lambda im: (put(im, card('hearts', 'A', 210, 10), 175, 205), put(im, card('spades', 'A', 210, -8), 265, 200),
                                         put(im, gimg('card-shared/chips/stack_100k.png', 150), 395, 265), put(im, gimg('card-shared/chips/chip_1m.png', 110), 380, 120)), 'HOT')
make('bai-cao', 'Bài Cào', 'lemon', lambda im: (fan(im, [('spades', 'J'), ('hearts', 'Q'), ('diamonds', 'K')], 225, 205, 205), put(im, emoji('game/money_bag.png', 130, 8), 395, 280)))
make('sam-loc', 'Sâm Lốc', 'peach', lambda im: (fan(im, [('clubs', '9'), ('clubs', '10'), ('clubs', 'J'), ('clubs', 'Q'), ('clubs', 'K')], 245, 210, 190, 13, 46),
                                               put(im, emoji('symbols/fire.png', 120, 0), 410, 110)))
make('lieng', 'Liêng', 'gold', lambda im: (fan(im, [('hearts', '9'), ('diamonds', '9'), ('spades', '9')], 210, 205, 200), put(im, gimg('card-shared/chips/stack_500k.png', 140), 395, 265)))
make('bau-cua', 'Bầu Cua', 'mint', lambda im: (put(im, gimg('bau-cua/symbols/cua.png', 210), 250, 175), put(im, gimg('bau-cua/symbols/bau.png', 140), 115, 250),
                                               put(im, gimg('bau-cua/dice-3d/die_nai.png', 150), 405, 250)), 'HOT')
make('xoc-dia', 'Xóc Đĩa', 'red', lambda im: (put(im, gimg('shared/plate_gold.png', 400), 256, 255), put(im, gimg('shared/bowl_red.png', 300, rot=-14), 300, 135),
                                             [put(im, gimg(f'xoc-dia/coin_{c}.png', 70), x, y) for c, x, y in (('red', 170, 260), ('white', 225, 285), ('red', 285, 270), ('white', 340, 290))]))
make('tai-xiu', 'Tài Xỉu', 'lavender', lambda im: (put(im, gimg('tai-xiu/dice-3d/die_top6.png', 170), 160, 230), put(im, gimg('tai-xiu/dice-3d/pink_die_top4.png', 170), 350, 230),
                                                  put(im, gimg('tai-xiu/dice-3d/die_top5.png', 150), 256, 130)), 'HOT')
make('co-tuong', 'Cờ Tướng', 'peach', lambda im: (put(im, gimg('co-tuong/pieces-classic/black_horse.png', 200), 330, 150), put(im, gimg('co-tuong/pieces-classic/red_general.png', 240), 200, 240)))
make('co-ca-ngua', 'Cá Ngựa', 'sky', lambda im: (put(im, gimg('co-ca-ngua/token_red.png', 200), 175, 200), put(im, gimg('co-ca-ngua/token_yellow.png', 160), 345, 140),
                                                put(im, gimg('tai-xiu/dice-3d/die_top6.png', 150), 375, 285)))
make('co-caro', 'Cờ Caro', 'pink', lambda im: ([ImageDraw.Draw(im).line((x, 70, x, 360), fill=(255, 255, 255, 140), width=8) for x in (190, 322)],
                                               [ImageDraw.Draw(im).line((80, y, 432, y), fill=(255, 255, 255, 140), width=8) for y in (160, 270)],
                                               put(im, gimg('co-caro/piece_x.png', 110), 130, 110), put(im, gimg('co-caro/piece_o.png', 110), 256, 215),
                                               put(im, gimg('co-caro/piece_x.png', 110), 385, 320), put(im, gimg('co-caro/piece_o.png', 110), 385, 110)))
make('bai-mau', 'Bài Màu', 'lavender', lambda im: (put(im, gimg('bai-mau/cards/red_7.png', h=230, rot=18), 165, 210), put(im, gimg('bai-mau/cards/blue_skip.png', h=230, rot=0), 256, 195),
                                                  put(im, gimg('bai-mau/cards/wild_draw4.png', h=230, rot=-18), 350, 210)), 'NEW')
make('lo-to', 'Lô Tô', 'lemon', lambda im: (put(im, gimg('lo-to/ticket_pink.png', 300, rot=-8), 210, 200), put(im, gimg('lo-to/balls/ball_09.png', 130), 380, 120),
                                           put(im, gimg('lo-to/balls/ball_27.png', 120), 400, 260), put(im, gimg('lo-to/balls/ball_88.png', 110), 300, 300)), 'NEW')


def ban_ca(im):
    bg = Image.open(G / 'ban-ca/bg_underwater_1920x1080.png').convert('RGBA').crop((600, 120, 1260, 780)).resize((512, 512), Image.LANCZOS)
    m = mask_rr(512, 512, (0, 0, 511, 491), 118)
    bg.putalpha(m)
    im.alpha_composite(bg)
    put(im, load(FL / 'sea' / 'tropical_fish.png', 150, rot=-6), 150, 150)
    put(im, load(FL / 'sea' / 'octopus.png', 160), 370, 140)
    put(im, load(FL / 'sea' / 'blowfish.png', 120), 120, 300)
    put(im, gimg('ban-ca/net.png', 170), 370, 140)
    put(im, gimg('ban-ca/cannon_lv5_gold.png', 120), 290, 300)


make('ban-ca', 'Bắn Cá', 'sky', ban_ca, 'HOT')


def day_xu(im):
    put(im, emoji('game/admission_tickets.png', 190, -14), 160, 190)
    for x, y, s in [(300, 300, 120), (380, 250, 112), (250, 245, 104), (335, 190, 98), (410, 330, 96), (200, 320, 92)]:
        put(im, emoji('game/coin.png', s), x, y)
    put(im, load(A / '3d/renders/icons/bgb_coin_10_gold.png', 150, rot=-8), 372, 120)
    put(im, emoji('animals/pig_face.png', 110, 10), 150, 330)


make('day-xu', 'Đẩy Xu', 'lemon', day_xu, 'NEW')


def gap_thu(im):
    """Claw machine: a claw closing on a teddy bear, more plushies around."""
    put(im, emoji('animals/dog_face.png', 104, 12), 118, 300)
    put(im, emoji('animals/rabbit_face.png', 100, -12), 398, 300)
    put(im, emoji('game/teddy_bear.png', 210), 256, 262)
    d = ImageDraw.Draw(im)
    d.line((256, 18, 256, 108), fill=(140, 120, 160, 255), width=12)
    d.line((256, 18, 256, 108), fill=(230, 226, 240, 255), width=6)
    for sx in (-1, 1):   # two prongs hugging the bear's head
        pts = [(256 + sx * 22, 130), (256 + sx * 74, 186), (256 + sx * 58, 236)]
        d.line(pts, fill=(120, 100, 140, 255), width=22, joint='curve')
        d.line(pts, fill=(244, 242, 250, 255), width=13, joint='curve')
        d.ellipse((256 + sx * 58 - 13, 236 - 13, 256 + sx * 58 + 13, 236 + 13), fill=(255, 201, 60, 255), outline=(168, 109, 0, 255), width=4)
    d.ellipse((256 - 44, 96, 256 + 44, 156), fill=(255, 211, 77, 255), outline=(168, 109, 0, 255), width=6)
    d.ellipse((256 - 24, 104, 256 + 4, 122), fill=(255, 246, 200, 255))
    for x, y, s in [(110, 120, 46), (408, 96, 38), (420, 200, 30)]:
        put(im, emoji('symbols/sparkles.png', s), x, y)


def ticket_roll(im, cx, cy, r, top, ring, ink, label, gold=False):
    lay = new(512, 512)
    d = ImageDraw.Draw(lay)
    d.ellipse((cx - r, cy - r + 14, cx + r, cy + r + 14), fill=rgb(ring))          # the roll's side, seen a little from above
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb(top), outline=rgb(ring), width=max(6, r // 7))
    for k in range(int(r * .32), int(r * .86), 9):
        d.ellipse((cx - k, cy - k, cx + k, cy + k), outline=(255, 255, 255, 150) if not gold else (168, 109, 0, 90), width=2)
    f = font(CB, int(r * (.62 if len(label) <= 3 else .5)))
    d.text((cx, cy + 4), label, font=f, fill=rgb(ink), anchor='mm', stroke_width=max(4, r // 12), stroke_fill=(255, 255, 255, 255))
    sh = Image.new('RGBA', (512, 512), (80, 30, 60, 0)); sh.putalpha(lay.split()[3].point(lambda v: int(v * .28)).filter(ImageFilter.GaussianBlur(6)))
    sh2 = new(512, 512); sh2.paste(sh, (0, 6))
    im.alpha_composite(sh2); im.alpha_composite(lay)


def xuc_ve(im):
    """Ticket-roll scoop machine: printed rolls 20K / 10K and the golden 500K."""
    put(im, emoji('game/admission_tickets.png', 120, -16), 120, 112)
    ticket_roll(im, 148, 262, 74, '#d6f3ff', '#3d9bff', '#1f6fc0', '20K')
    ticket_roll(im, 388, 276, 68, '#ffd6e8', '#ff6fa8', '#c2407a', '10K')
    ticket_roll(im, 268, 196, 104, '#fff3b0', '#ffb300', '#a86d00', '500K', gold=True)
    for x, y, s in [(410, 100, 44), (180, 360, 34)]:
        put(im, emoji('game/coin.png', s), x, y)


make('gap-thu', 'Gắp Thú', 'pink', gap_thu, 'NEW')
make('xuc-ve', 'Xúc Vé', 'lemon', xuc_ve, 'NEW')
# grid preview
keys = list(ICONS)
cols = 6
sheet = new(cols * 260, ((len(keys) + cols - 1) // cols) * 260, (255, 236, 244, 255))
for i, k in enumerate(keys):
    ic = Image.open(OUT / f'{k}.png').convert('RGBA').resize((240, 240), Image.LANCZOS)
    sheet.alpha_composite(ic, ((i % cols) * 260 + 10, (i // cols) * 260 + 10))
save(sheet, OUT / '_all_icons_preview.png')
print('icons', len(ICONS))
