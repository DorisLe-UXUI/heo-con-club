"""Image sheets you generate yourself: one 16:9 picture holds up to 10 items, and this script cuts it into the single files the game uses.

  python3 -E tools/art_sheets.py           # write docs/PROMPTS.md and docs/prompts.html (+ custom/ban-ca/ca.json if missing)
  python3 -E tools/art_sheets.py --cut     # cut every custom/sheets/<name>.png into its items (apply_custom.py does this too)

How cutting works: the plain background is removed, items are found as separate blobs (small sparkles are merged into the
nearest item), then read row by row, left to right, in the order the prompt lists them. Each cut is checked against the
expected count; the result is shown in custom/sheets/_kiem_tra/<name>.png with the file name under every piece.
A piece you replaced by hand (a different file at the target path) is never overwritten.
"""
import hashlib, json, math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from custom_img import remove_background

try:
    from scipy import ndimage as nd
except Exception:
    nd = None

C = ROOT / 'custom'
SHEETS_DIR = C / 'sheets'

STYLE = ('cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, '
         'smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors')
NO_TEXT = 'no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines'
WIDE = 'Wide 16:9 image, 1920x1080'

# ------------------------------------------------------------------ Bắn Cá species (settings go to custom/ban-ca/ca.json)
# id, name, tier, mult, size, upright, sheet description
FISH = [
    ('ca_bay_mau', 'Cá Bảy Màu', 'small', 2, 1.0, False, 'a tiny guppy with a huge flowing rainbow fan tail in pink, orange and turquoise'),
    ('ca_neon', 'Cá Neon', 'small', 3, .9, False, 'a small slender neon tetra with a glowing electric blue stripe and a bright red lower half'),
    ('ca_ngua', 'Cá Ngựa', 'small', 4, 1.0, True, 'a coral pink seahorse with a curled tail, upright, seen from the side facing left'),
    ('sao_bien', 'Sao Biển', 'small', 3, .9, True, 'a peach orange five-armed starfish with tiny white dots and a happy face, seen from the front'),
    ('ca_mo_vet', 'Cá Mỏ Vẹt', 'small', 5, 1.1, False, 'a parrotfish with a little beak, mint green and turquoise scales and pink fins'),
    ('ca_vang_dau_lan', 'Cá Vàng Đầu Lân', 'small', 5, 1.1, False, 'a chubby lionhead goldfish with a bumpy red cap, bright orange body and a double flowing tail'),
    ('ca_buom', 'Cá Bướm', 'medium', 8, 1.0, False, 'a round flat butterflyfish with yellow and white vertical stripes and a black eye stripe'),
    ('oc_anh_vu', 'Ốc Anh Vũ', 'medium', 10, 1.0, False, 'a nautilus with a cream and caramel striped spiral shell and short soft tentacles'),
    ('ca_duoi', 'Cá Đuối Ó', 'medium', 12, 1.15, False, 'a manta ray at a three-quarter angle from above, navy blue back with pastel cyan spots'),
    ('ca_long_den', 'Cá Lồng Đèn', 'medium', 16, 1.0, False, 'a chubby deep purple anglerfish with a glowing golden lantern above its head and small friendly teeth'),
    ('ca_mat_trang', 'Cá Mặt Trăng', 'medium', 18, 1.15, False, 'an ocean sunfish (mola mola) with a round flat lavender-gray body, tall top and bottom fins and rosy cheeks'),
    ('cua_hoang_de', 'Cua Hoàng Đế', 'medium', 20, 1.1, True, 'a ruby red spiky king crab wearing a tiny golden crown, claws raised, seen from the front'),
    ('ca_chep_vang', 'Cá Chép Vàng', 'big', 30, 1.0, False, 'a golden koi carp with gold and red scales, long whiskers and flowing ribbon fins'),
    ('ca_kiem', 'Cá Kiếm', 'big', 40, 1.15, False, 'a swordfish with a long pointed bill, cobalt blue back, pale blue belly and a tall sail fin'),
    ('ky_lan_bien', 'Kỳ Lân Biển', 'big', 45, 1.1, False, 'a pastel blue narwhal with white speckles and a long spiral golden horn'),
    ('ca_map_bua', 'Cá Mập Búa', 'big', 50, 1.15, False, 'a gray-blue hammerhead shark with a wide hammer-shaped head and a friendly smile'),
    ('nang_tien_ca', 'Nàng Tiên Cá', 'big', 60, 1.1, False, 'a chibi mermaid girl with long wavy pink hair, a turquoise fish tail and a pearl tiara, swimming'),
    ('rua_vang', 'Rùa Vàng Kho Báu', 'big', 70, 1.1, False, 'a sea turtle with a golden shell studded with jewels and coins and mint green flippers'),
    ('heo_vang_dai_duong', 'Heo Vàng Đại Dương', 'boss', 120, 1.0, False, 'a chubby golden piggy wearing a diving mask and snorkel, with little fins, swimming'),
    ('tau_ngam_kho_bau', 'Tàu Ngầm Kho Báu', 'boss', 150, 1.05, False, 'a round pastel yellow and pink toy submarine with portholes and a periscope, overflowing with gold coins'),
    ('rua_than_kim_quy', 'Rùa Thần Kim Quy', 'boss', 180, 1.1, False, 'a giant golden sacred turtle from Vietnamese legend with an ornate jade green and gold shell, a glowing jade sword on its back'),
    ('kraken', 'Thủy Quái Kraken', 'boss', 200, 1.1, True, 'a purple and magenta kraken with many curling tentacles, big glossy eyes and a tiny pirate hat, seen from the front'),
    ('long_vuong', 'Long Vương Biển', 'boss', 250, 1.15, False, 'an Asian sea dragon king with a long jade green and gold serpentine body in an S-curve, flowing whiskers and a small golden crown'),
    ('ca_voi_hoang_kim', 'Cá Voi Hoàng Kim', 'boss', 300, 1.2, False, 'a huge golden whale with a glittering body and a fountain of gold coins spouting above its head'),
]
TIER_VI = {'small': 'Cá nhỏ', 'medium': 'Cá vừa', 'big': 'Cá lớn', 'boss': 'Trùm'}
F = {f[0]: f for f in FISH}

SUITS = [('hearts', 'Cơ', 'a heart', 'hot pink and red'), ('diamonds', 'Rô', 'a diamond (rhombus)', 'coral red and orange'),
         ('clubs', 'Chuồn', 'a club (three round leaves and a short stem)', 'dark charcoal with a hint of deep green'),
         ('spades', 'Bích', 'a spade (upside-down heart with a short stem)', 'dark navy and deep purple')]
FACES = {
    ('J', 'hearts'): 'a boy page knight in pink and white holding a heart-shaped shield',
    ('Q', 'hearts'): 'a princess in a pink ball gown holding a red rose, with a small heart tiara',
    ('K', 'hearts'): 'a king with a fluffy red cape, a golden crown with a heart jewel and a heart-topped scepter',
    ('J', 'diamonds'): 'a merchant boy in orange and gold carrying a bag of gold coins',
    ('Q', 'diamonds'): 'a queen in a golden gown with a jeweled tiara and a golden folding fan',
    ('K', 'diamonds'): 'a rich king in coral red and gold robes holding a big shining diamond',
    ('J', 'clubs'): 'a forest archer boy in green with a four-leaf-clover cap and a small bow',
    ('Q', 'clubs'): 'a flower fairy queen in green and white with a four-leaf-clover wand and tiny wings',
    ('K', 'clubs'): 'a wise old king with a white beard, a crown made of leaves and a wooden staff',
    ('J', 'spades'): 'a ninja boy in navy blue with a mask and a tiny throwing star',
    ('Q', 'spades'): 'a moon witch queen in deep purple with a starry hat and a crescent moon staff',
    ('K', 'spades'): 'a knight king in navy armor with a dark purple cape and a crown with a spade-shaped jewel',
}
RANK_VI = {'J': 'Bồi', 'Q': 'Đầm', 'K': 'Già'}
CARDS_NOTE = 'playing cards showing only simple suit symbols, no letters or numbers on them'
ICONS = [
    ('tien-len', 'Tiến Lên', f'three fanned {CARDS_NOTE} with a happy pink piglet peeking from behind'),
    ('phom', 'Phỏm', f'four fanned {CARDS_NOTE} with a golden sparkle burst behind'),
    ('mau-binh', 'Mậu Binh', f'five {CARDS_NOTE} fanned in an arc with a small golden crown on top'),
    ('xi-dach', 'Xì Dách', f'two {CARDS_NOTE} standing next to a short stack of pastel casino chips'),
    ('poker', 'Poker', f'two {CARDS_NOTE} next to tall stacks of pastel casino chips'),
    ('bai-cao', 'Bài Cào', f'three fanned {CARDS_NOTE} next to a money bag full of gold coins'),
    ('sam-loc', 'Sâm Lốc', f'five fanned {CARDS_NOTE} with a cute little flame beside them'),
    ('lieng', 'Liêng', f'three fanned {CARDS_NOTE} next to a stack of lavender casino chips'),
    ('bau-cua', 'Bầu Cua', 'a green gourd, a red crab and one white die with tiny animal pictures, grouped together'),
    ('xoc-dia', 'Xóc Đĩa', 'a round red ceramic bowl lifted slightly above a golden plate holding four coins, two red and two white'),
    ('tai-xiu', 'Tài Xỉu', 'three rounded dice tumbling in the air, white and pastel pink with round dots'),
    ('co-tuong', 'Cờ Tướng', 'two round wooden Chinese chess pieces, one with a red rim and one with a black rim, engraved patterns instead of characters'),
    ('co-ca-ngua', 'Cá Ngựa', 'four horse-head board game tokens in red, blue, green and yellow next to one white die'),
    ('co-caro', 'Cờ Caro', 'a small pastel tic-tac-toe board with chunky pink X pieces and sky blue O pieces'),
    ('bai-mau', 'Bài Màu', 'four colorful pastel game cards in red, yellow, green and blue with swirl patterns, no numbers'),
    ('lo-to', 'Lô Tô', 'a pink bingo card with a grid of empty squares and three colorful lottery balls with stars'),
    ('ban-ca', 'Bắn Cá', 'a tropical fish and a small pastel pink toy cannon with bubbles around them'),
    ('day-xu', 'Đẩy Xu', 'a pastel coin pusher arcade machine with a pile of gold coins and a pink ticket coming out'),
]
BAU_CUA = [('bau', 'Bầu', 'a round green bottle gourd with a little red ribbon at its neck, a small leaf on top and a happy face'),
           ('cua', 'Cua', 'a red crab with big round claws raised happily'), ('tom', 'Tôm', 'an orange-red shrimp with long feelers and a curled tail'),
           ('ca', 'Cá', 'a blue and yellow fish with round fins, facing left'), ('ga', 'Gà', 'a proud rooster with a red comb and colorful tail feathers, standing'),
           ('nai', 'Nai', 'a baby deer with small antlers, light brown with white spots, standing')]
AVATARS = [('bong', 'Bông', 'a fluffy white cotton-ball puppy', 'peach'), ('heo', 'Heo', 'a happy pink piglet', 'pink'),
           ('meo', 'Mèo', 'a playful orange kitten', 'lemon yellow'), ('kem', 'Kem', 'a smiling strawberry ice cream cone', 'mint'),
           ('mochi', 'Mochi', 'a squishy round white mochi with rosy cheeks', 'lavender'), ('xoai', 'Xoài', 'a cheerful ripe mango', 'sky blue'),
           ('gau', 'Gấu', 'a cuddly brown teddy bear', 'cream'), ('tho', 'Thỏ', 'a white bunny with long pink ears', 'pink')]


def fish_items(ids):
    return [(f'ban-ca/{i}.png', f'{F[i][1]} · {TIER_VI[F[i][2]]} ×{F[i][3]}', F[i][6]) for i in ids]


# name, title, cols, rows, kind (for the prompt), facing rule, items [(target under custom/, Vietnamese label, English description)], extra flags
SHEETS = [
    dict(name='ca_1', title='Bắn Cá · bảng 1: 6 cá nhỏ + 4 cá vừa', cols=5, rows=2, kind='cute sea creatures',
         facing='Every fish is seen from the side and faces left (head on the left), unless its description says otherwise',
         items=fish_items(['ca_bay_mau', 'ca_neon', 'ca_ngua', 'sao_bien', 'ca_mo_vet', 'ca_vang_dau_lan', 'ca_buom', 'oc_anh_vu', 'ca_duoi', 'ca_long_den'])),
    dict(name='ca_2', title='Bắn Cá · bảng 2: cá vừa và cá lớn', cols=4, rows=2, kind='cute sea creatures',
         facing='Every creature is seen from the side and faces left (head on the left), unless its description says otherwise',
         items=fish_items(['ca_mat_trang', 'cua_hoang_de', 'ca_chep_vang', 'ca_kiem', 'ky_lan_bien', 'ca_map_bua', 'nang_tien_ca', 'rua_vang'])),
    dict(name='ca_3', title='Bắn Cá · bảng 3: 6 trùm', cols=3, rows=2, kind='cute but majestic boss sea creatures, rich in detail',
         facing='Every creature is seen from the side and faces left (head on the left), unless its description says otherwise',
         items=fish_items(['heo_vang_dai_duong', 'tau_ngam_kho_bau', 'rua_than_kim_quy', 'kraken', 'long_vuong', 'ca_voi_hoang_kim'])),
    dict(name='bai_chat', title='Bộ bài · chất bài và hình lá Át', cols=4, rows=2, kind='cute playing card emblems',
         facing='All are flat front views, perfectly symmetrical',
         items=[(f'cards/suit_{k}.png', f'Chất {vi}', f'a chunky rounded {shape} symbol like a soft jelly candy, glossy {col}') for k, vi, shape, col in SUITS] +
               [(f'cards/ace_{k}.png', f'Át {vi}', f'an ornate {shape} emblem in {col} with small golden wings, a tiny crown and sparkles') for k, vi, shape, col in SUITS]),
    dict(name='bai_nhanvat_1', title='Bộ bài · nhân vật J Q K chất Cơ và Rô', cols=3, rows=2, kind='cute chibi half-body character portraits for playing cards',
         facing='Every character is a half-body portrait, front view, looking at the viewer',
         items=[(f'cards/face_{r}_{s}.png', f'{RANK_VI[r]} {vi}', FACES[(r, s)]) for s, vi in [('hearts', 'Cơ'), ('diamonds', 'Rô')] for r in 'JQK']),
    dict(name='bai_nhanvat_2', title='Bộ bài · nhân vật J Q K chất Chuồn và Bích', cols=3, rows=2, kind='cute chibi half-body character portraits for playing cards',
         facing='Every character is a half-body portrait, front view, looking at the viewer',
         items=[(f'cards/face_{r}_{s}.png', f'{RANK_VI[r]} {vi}', FACES[(r, s)]) for s, vi in [('clubs', 'Chuồn'), ('spades', 'Bích')] for r in 'JQK']),
    dict(name='bai_matsau', title='Bộ bài · 2 mặt sau', cols=2, rows=1, kind='tall playing card back designs, each a vertical card with 2:3 proportions and rounded corners',
         facing='Both cards stand upright side by side, seen flat from the front', fill=True,
         items=[('cards/back.png', 'Mặt sau hồng', 'pastel pink with a symmetrical pattern of tiny white hearts and stars and a round golden medallion with a pink pig face in the center'),
                ('cards/back_dark.png', 'Mặt sau tối', 'deep navy and purple with a symmetrical pattern of tiny golden stars and moons and a round golden medallion with a pink pig face in the center')]),
    dict(name='icon_1', title='Icon game · bảng 1 (10 game)', cols=5, rows=2, kind='cute game icon illustrations, each a compact tight group of objects',
         facing='Each group is drawn from a slightly angled front view', items=[(f'icons/{k}.png', vi, d) for k, vi, d in ICONS[:10]]),
    dict(name='icon_2', title='Icon game · bảng 2 (8 game)', cols=4, rows=2, kind='cute game icon illustrations, each a compact tight group of objects',
         facing='Each group is drawn from a slightly angled front view', items=[(f'icons/{k}.png', vi, d) for k, vi, d in ICONS[10:]]),
    dict(name='bau_cua', title='Bầu Cua · 6 linh vật', cols=3, rows=2, kind='cute mascots for the Vietnamese dice game Bầu Cua',
         facing='All mascots are seen from the front unless their description says otherwise', items=[(f'bau-cua/{k}.png', vi, d) for k, vi, d in BAU_CUA]),
    dict(name='do_choi', title='Súng, đạn, lưới, xu, dấu Lô Tô', cols=5, rows=2, kind='cute game items',
         facing='The five cannons are seen from directly above with the barrel pointing up; the other items are seen from directly above',
         items=[('assets/games/ban-ca/cannon_lv1_pink.png', 'Súng cấp 1', 'a toy cannon turret with a round base and a short thick barrel, pastel pink with one star badge'),
                ('assets/games/ban-ca/cannon_lv2_mint.png', 'Súng cấp 2', 'a toy cannon turret with a thicker barrel, mint green with two star badges'),
                ('assets/games/ban-ca/cannon_lv3_sky.png', 'Súng cấp 3', 'a toy cannon turret with a long barrel, sky blue with three star badges'),
                ('assets/games/ban-ca/cannon_lv4_lavender.png', 'Súng cấp 4', 'a toy cannon turret with a double barrel, lavender purple and gold with four star badges'),
                ('assets/games/ban-ca/cannon_lv5_gold.png', 'Súng cấp 5', 'a deluxe toy cannon turret with a big triple barrel, shiny gold with ruby gems and five star badges'),
                ('assets/games/ban-ca/bullet.png', 'Viên đạn', 'a single glowing round magic pearl with a soft cyan and pink glow'),
                ('assets/games/ban-ca/net.png', 'Lưới', 'a round fishing net like a spider web made of pale aqua blue rope with small knots'),
                ('assets/games/xoc-dia/coin_red.png', 'Xu đỏ (Xóc Đĩa)', 'a round coin with a glossy red lacquer face, a thin gold rim and an embossed flower'),
                ('assets/games/xoc-dia/coin_white.png', 'Xu trắng (Xóc Đĩa)', 'a round coin with a glossy ivory cream face, a thick gold rim and an embossed flower'),
                ('assets/games/lo-to/marker_heart.png', 'Dấu Lô Tô', 'a round glossy pink bingo marker chip with a red heart in the middle')]),
    dict(name='avatar', title='Avatar người chơi', cols=4, rows=2, kind='cute round avatar badges, each a head-and-shoulders character inside a circle with a soft pastel background color',
         facing='All are front views with big shiny friendly eyes',
         items=[(f'assets/avatars-dicebear/fun-emoji/png/{k}.png', vi, f'{who} on a {col} circle') for k, vi, who, col in AVATARS]),
]
BACKGROUNDS = [
    ('assets/ui-premium-generated/lobby-backgrounds/bg_loading.jpg', 'Nền màn loading',
     'A dreamy pastel fantasy sky world for a cute casino game loading screen: soft pink and lavender clouds, a sunburst in the center, a floating pink castle on a cloud island on the right, a winding candy road, a cute flying pink piglet on the left and a teddy bear on the right, gold coins, dice, hearts and gems floating around. '
     f'{STYLE}. Keep the top center and the bottom center calm and simple for a logo and a loading bar. No text, no letters, no watermark. {WIDE}.'),
    ('assets/ui-premium-generated/lobby-backgrounds/bg_login.jpg', 'Nền màn đăng nhập',
     'A cute pastel miniature town seen from above at an angle for a casino game login screen: a fountain plaza in the middle, colorful little shops, cherry blossom trees, a river and the sea on the right, hot air balloons and a pig-shaped airship in the sky, a giant cute pink piglet floating on the left. '
     f'{STYLE}. Leave the right third of the image calm (sky and soft buildings) for a login panel. Shop signs are blank, no text, no letters, no watermark. {WIDE}.'),
    ('assets/ui-premium-generated/lobby-backgrounds/lobby_dream_1920x1080.png', 'Nền sảnh Tiến Lên',
     'A soft dreamy pastel background for a cute card game lobby: pink and lavender gradient sky, fluffy clouds along the bottom, faint floating hearts, stars and playing card suit symbols, gentle bokeh. '
     f'{STYLE}. Calm and low contrast so cards and buttons stay readable. No characters, no text, no letters, no watermark. {WIDE}.'),
]


# ------------------------------------------------------------------ batch 2 (đợt 2): everything else that can be a picture
for s in SHEETS:
    s['dot'] = 1
    s['group'] = 'bau' if s['name'] == 'bau_cua' else {'ca': 'ca', 'ba': 'bai', 'ic': 'icon', 'do': 'do', 'av': 'avatar'}.get(s['name'][:2], 'do')

OLD_FISH = [  # built-in Bắn Cá species redrawn (custom/ban-ca/thay/<id>.png replaces their sprite)
    ('ca_vang', 'Cá Vàng', 'a small chubby golden yellow fish with round fins'),
    ('ca_hong', 'Cá Hồng', 'a small chubby pastel pink fish with big round eyes'),
    ('ca_he', 'Cá Hề', 'a clownfish with orange and white stripes'),
    ('ca_xanh', 'Cá Xanh', 'a round sky blue fish with a yellow tail'),
    ('tom', 'Tôm', 'a small orange-pink shrimp with long feelers'),
    ('ca_noc', 'Cá Nóc', 'a round puffed-up blowfish with soft spikes, peach orange'),
    ('cua', 'Cua', 'a red crab with big claws raised, seen from the front'),
    ('sua', 'Sứa', 'a translucent blue and purple jellyfish with wavy tentacles hanging down, seen from the front'),
    ('ca_than_tien', 'Cá Thần Tiên', 'an angelfish with tall fins and yellow and blue stripes'),
    ('muc', 'Mực', 'a pink squid with big eyes and tentacles hanging down, seen from the front'),
    ('rua', 'Rùa Biển', 'a green sea turtle with a patterned shell, swimming'),
    ('tom_hum', 'Tôm Hùm', 'a bright red lobster with big claws, seen from the front with its tail down'),
    ('hai_cau', 'Hải Cẩu', 'a gray seal with whiskers, swimming'),
    ('ca_heo', 'Cá Heo', 'a blue dolphin, smiling'),
    ('ca_rong', 'Cá Rồng Vàng', 'a golden arowana dragon fish with large shiny scales and long barbels'),
    ('bach_tuoc', 'Bạch Tuộc Khổng Lồ', 'a giant pink-purple octopus with curling tentacles, seen from the front'),
    ('ca_map', 'Cá Mập Trắng', 'a great white shark with a friendly toothy grin'),
    ('ca_voi', 'Cá Voi Xanh', 'a huge blue whale with a pale belly and a small water spout'),
]
HUD = [
    ('coin', 'Xu', 'a shiny gold coin with an embossed pig face'), ('gem_stone', 'Kim cương', 'a sparkling blue diamond gem'),
    ('wrapped_gift', 'Hộp quà', 'a pink gift box with a golden ribbon bow'), ('scroll', 'Cuộn nhiệm vụ', 'a rolled parchment scroll tied with a red ribbon'),
    ('trophy', 'Cúp', 'a golden trophy cup with two handles'), ('shopping_bags', 'Túi mua sắm', 'two shopping bags, pink and mint'),
    ('joystick', 'Cần điều khiển', 'a retro arcade joystick with a red ball top on a purple base'), ('love_letter', 'Thư tình', 'a pink envelope sealed with a red heart'),
    ('envelope', 'Phong thư', 'a plain white envelope with a light blue edge'), ('party_popper', 'Pháo giấy', 'a party popper cone bursting with confetti'),
    ('loudspeaker', 'Loa', 'a pink megaphone'), ('money_bag', 'Túi tiền', 'a burlap money bag tied at the top, full of gold coins'),
    ('crown', 'Vương miện', 'a golden crown with pink and blue jewels'), ('key', 'Chìa khoá', 'a golden key with a heart-shaped head'),
    ('locked', 'Ổ khoá', 'a closed golden padlock'), ('game_die', 'Xúc xắc', 'a white die with pink dots, tilted'),
    ('house', 'Ngôi nhà', 'a small pastel house with a pink roof'), ('joker', 'Lá Joker', 'a playing card showing a cute jester face'),
    ('magic_wand', 'Đũa phép', 'a magic wand with a star tip and sparkles'), ('light_bulb', 'Bóng đèn', 'a glowing yellow light bulb'),
    ('1st_place_medal', 'Huy chương vàng', 'a gold medal on a red ribbon with a star in the middle'), ('2nd_place_medal', 'Huy chương bạc', 'a silver medal on a blue ribbon with a star in the middle'),
    ('3rd_place_medal', 'Huy chương đồng', 'a bronze medal on a green ribbon with a star in the middle'), ('admission_tickets', 'Vé vào cửa', 'two pink admission tickets'),
    ('ticket', 'Vé vàng', 'one golden ticket with a star'), ('alarm_clock', 'Đồng hồ báo thức', 'a pink twin-bell alarm clock'),
    ('stopwatch', 'Đồng hồ bấm giờ', 'a silver stopwatch'), ('bullseye', 'Bia bắn', 'a red and white target with a dart in the center'),
    ('round_pushpin', 'Ghim', 'a red round map pin'), ('spade_suit', 'Chất bích', 'a glossy dark navy spade symbol'),
]
FACE = 'a round glossy yellow 3D emoji face'
EMO = [
    ('reactions/grinning_squinting_face', 'Cười híp mắt', f'{FACE} laughing with squinting eyes and a wide open smile'),
    ('reactions/face_with_tears_of_joy', 'Cười ra nước mắt', f'{FACE} laughing with tears of joy'),
    ('reactions/smiling_face_with_heart_eyes', 'Mắt tim', f'{FACE} smiling with heart-shaped eyes'),
    ('reactions/smiling_face_with_sunglasses', 'Kính râm', f'{FACE} smiling with cool black sunglasses'),
    ('reactions/partying_face', 'Tiệc tùng', f'{FACE} wearing a party hat and blowing a party horn'),
    ('reactions/thinking_face', 'Suy nghĩ', f'{FACE} thinking with a hand on its chin'),
    ('reactions/crying_face', 'Rơi lệ', f'{FACE} sad with a single tear'),
    ('reactions/loudly_crying_face', 'Khóc to', f'{FACE} crying loudly with streams of tears'),
    ('reactions/face_screaming_in_fear', 'Hoảng hốt', f'{FACE} screaming in fear with hands on its cheeks'),
    ('reactions/face_holding_back_tears', 'Rưng rưng', f'{FACE} holding back tears with big trembling eyes'),
    ('reactions/grinning_face_with_sweat', 'Cười toát mồ hôi', f'{FACE} grinning nervously with a drop of sweat'),
    ('reactions/face_savoring_food', 'Thèm', f'{FACE} licking its lips'),
    ('reactions/face_with_monocle', 'Kính lúp', f'{FACE} curious with a monocle'),
    ('reactions/smiling_face_with_halo', 'Thiên thần', f'{FACE} smiling innocently with a golden halo'),
    ('reactions/robot', 'Rô-bốt', 'a cute round gray robot face with a small antenna'),
    ('hands/thumbs_up', 'Like', 'a yellow cartoon hand giving a thumbs up'), ('hands/clapping_hands', 'Vỗ tay', 'two yellow cartoon hands clapping'),
    ('hands/waving_hand', 'Vẫy tay', 'a yellow cartoon hand waving'), ('hands/raising_hands', 'Giơ tay', 'two yellow cartoon hands raised in celebration'),
    ('hands/handshake', 'Bắt tay', 'two yellow cartoon hands shaking'), ('hands/index_pointing_up', 'Chỉ lên', 'a yellow cartoon hand pointing up'),
    ('hands/backhand_index_pointing_left', 'Chỉ trái', 'a yellow cartoon hand pointing left'), ('symbols/fire', 'Lửa', 'a cute flame'),
    ('symbols/glowing_star', 'Ngôi sao', 'a glowing golden star with sparkles'), ('symbols/cross_mark', 'Dấu X', 'a red cross mark made of two rounded bars'),
    ('symbols/speech_balloon', 'Bong bóng chat', 'a white speech bubble'), ('animals/pig_face', 'Mặt heo', 'a pink pig face'),
    ('animals/pig', 'Chú heo', 'a pink pig standing, side view'), ('game-items/horse_face', 'Đầu ngựa', 'a brown horse head'),
    ('game-items/chess_pawn', 'Quân tốt', 'a black chess pawn'),
]
FUN = [('banh', 'Bánh', 'a steamed bun (bánh bao) with rosy cheeks', 'cream'), ('bi', 'Bi', 'a baby penguin', 'sky blue'), ('bin', 'Bin', 'a little green frog', 'mint'),
       ('bo', 'Bơ', 'a cheerful avocado half', 'lemon yellow'), ('bon', 'Bon', 'a corgi puppy', 'peach'), ('com', 'Cốm', 'a rice ball (onigiri) with a strip of seaweed', 'mint'),
       ('cun', 'Cún', 'a shiba inu puppy', 'lavender'), ('dau', 'Dâu', 'a strawberry', 'pink'), ('mit', 'Mít', 'a smiling green jackfruit', 'lemon yellow'),
       ('miu', 'Miu', 'a gray kitten', 'pink'), ('na', 'Na', 'a green sugar-apple fruit', 'peach'), ('su', 'Su', 'a cream puff pastry', 'lavender'),
       ('sua', 'Sữa', 'a milk carton', 'sky blue'), ('teo', 'Tèo', 'a little monkey', 'cream'), ('ti', 'Tí', 'a yellow baby chick', 'mint')]
ANIMALS = ['bear', 'chick', 'duck', 'elephant', 'frog', 'horse', 'monkey', 'owl', 'panda', 'penguin', 'pig', 'rabbit', 'zebra']
ANIMAL_VI = dict(bear='Gấu', chick='Gà con', duck='Vịt', elephant='Voi', frog='Ếch', horse='Ngựa', monkey='Khỉ', owl='Cú', panda='Gấu trúc', penguin='Chim cánh cụt', pig='Heo', rabbit='Thỏ', zebra='Ngựa vằn')
CHARS = [('child', 'Em bé', 'a toddler with a pink bow'), ('dragon', 'Rồng', 'a baby green dragon'), ('guard', 'Lính gác', 'a royal guard with a tall bearskin hat'),
         ('monkey', 'Khỉ', 'a playful monkey'), ('ninja', 'Ninja', 'a ninja in a navy mask'), ('panda', 'Gấu trúc', 'a panda'), ('person_mage', 'Pháp sư', 'a wizard with a starry purple hat'),
         ('prince', 'Hoàng tử', 'a prince with a small golden crown'), ('princess', 'Công chúa', 'a princess with a tiara'), ('robot', 'Rô-bốt', 'a friendly robot'),
         ('santa_claus', 'Ông già Noel', 'Santa Claus'), ('teddy_bear', 'Gấu bông', 'a teddy bear'), ('unicorn', 'Kỳ lân', 'a unicorn with a rainbow mane'),
         ('woman_astronaut', 'Phi hành gia', 'a girl astronaut in a white helmet'), ('woman_fairy', 'Tiên nữ', 'a fairy girl with tiny wings')]
BUTTON = 'a rounded-square glossy jelly game button in'
BUTTONS = [('ui-jelly-pzuh/buttons-pastel/mint/icon_home_mint.png', 'Nút nhà (xanh)', f'{BUTTON} mint green with a chunky white house symbol'),
           ('ui-jelly-pzuh/buttons-pastel/mint/icon_plus_mint.png', 'Nút cộng (xanh)', f'{BUTTON} mint green with a chunky white plus symbol'),
           ('ui-jelly-pzuh/buttons-pastel/mint/icon_sound_mint.png', 'Nút loa (xanh)', f'{BUTTON} mint green with a chunky white speaker symbol'),
           ('ui-jelly-pzuh/buttons-pastel/pink/icon_back_pink.png', 'Nút quay lại', f'{BUTTON} pink with a chunky white triangle pointing left'),
           ('ui-jelly-pzuh/buttons-pastel/pink/icon_home_pink.png', 'Nút nhà (hồng)', f'{BUTTON} pink with a chunky white house symbol'),
           ('ui-jelly-pzuh/buttons-pastel/pink/icon_settings_pink.png', 'Nút cài đặt', f'{BUTTON} pink with a chunky white gear symbol'),
           ('ui-jelly-pzuh/buttons-pastel/pink/icon_sound_pink.png', 'Nút loa (hồng)', f'{BUTTON} pink with a chunky white speaker symbol'),
           ('ui-jelly-pzuh/buttons-pastel/purple/icon_mail_purple.png', 'Nút thư', f'{BUTTON} lavender purple with a chunky white envelope symbol'),
           ('ui-jelly-pzuh/buttons-pastel/yellow/icon_grid_yellow.png', 'Nút danh sách', f'{BUTTON} lemon yellow with a chunky white symbol of four small squares'),
           ('ui-jelly-pzuh/buttons-pastel/yellow/icon_like_yellow.png', 'Nút thích', f'{BUTTON} lemon yellow with a chunky white thumbs-up symbol'),
           ('ui-jelly-pzuh/buttons-pastel/yellow/icon_question_yellow.png', 'Nút trợ giúp', f'{BUTTON} lemon yellow with a chunky white question mark'),
           ('ui-jelly-pzuh/buttons/icon_close_red.png', 'Nút đóng', f'{BUTTON} red with a chunky white X made of two rounded bars'),
           ('ui-jelly-pzuh/buttons/square_locked.png', 'Ô bị khoá', f'{BUTTON} light gray with a chunky white padlock symbol')]
CHIP_COLORS = [('1k', 'white with pink edge stripes'), ('5k', 'pink with white edge stripes'), ('10k', 'sky blue with white edge stripes'), ('50k', 'mint green with white edge stripes'),
               ('100k', 'lemon yellow with white edge stripes'), ('500k', 'lavender purple with white edge stripes'), ('1m', 'shiny gold with white edge stripes'), ('10m', 'dark navy with gold edge stripes')]
VIP_LOOK = ['silver blue, simple', 'mint green with a small star', 'sky blue with two small stars', 'lavender purple with small wings',
            'pink with small wings and a heart gem', 'gold with wings and a ruby', 'coral red and gold with big wings and gems', 'dark navy and gold, the most luxurious, with big golden wings, a crown and diamonds']
DAILY = [('Ngày 1', 'a small stack of three gold coins'), ('Ngày 2', 'a bigger pile of gold coins'), ('Ngày 3', 'a burlap money bag with a gold coin'), ('Ngày 4', 'a big sparkling blue diamond'),
         ('Ngày 5', 'a pink gift box with a golden bow'), ('Ngày 6', 'a big money bag overflowing with gold coins'), ('Ngày 7', 'a golden crown with jewels')]
FRAMES = [('gold', 'gold with a tiny crown on top and a blue gem at the bottom'), ('lavender', 'lavender purple with a tiny crown on top'), ('mint', 'mint green with a four-leaf clover and a tiny star'),
          ('pink', 'pink with two little hearts'), ('rainbow', 'rainbow gradient with a tiny crown and two little hearts'), ('silver', 'silver with a tiny gold star at the bottom'),
          ('sky', 'sky blue with a tiny gold star at the top right'), ('tet', 'red and gold with apricot blossoms and a tiny red lantern for Lunar New Year')]

SHEETS += [
    dict(name='ca_cu_1', dot=2, group='ca', title='Bắn Cá · vẽ lại 10 con có sẵn (bảng 1)', cols=5, rows=2, kind='cute sea creatures',
         facing='Every creature is seen from the side and faces left (head on the left), unless its description says otherwise',
         items=[(f'ban-ca/thay/{i}.png', vi, d) for i, vi, d in OLD_FISH[:10]]),
    dict(name='ca_cu_2', dot=2, group='ca', title='Bắn Cá · vẽ lại 8 con có sẵn (bảng 2, có 3 trùm)', cols=4, rows=2, kind='cute sea creatures',
         facing='Every creature is seen from the side and faces left (head on the left), unless its description says otherwise',
         items=[(f'ban-ca/thay/{i}.png', vi, d) for i, vi, d in OLD_FISH[10:]]),
    dict(name='chip', dot=2, group='bai', noface=True, title='Phỉnh cược (chip) · 8 mệnh giá, chữ số do script viết', cols=4, rows=2, kind='cute casino chips',
         facing='Every chip is seen from directly above and has an empty plain circle in the middle',
         items=[(f'chips/chip_{v}.png', f'Chip {v.upper()}', f'a round chip, {col}') for v, col in CHIP_COLORS]),
    dict(name='hud_1', dot=2, group='ui', title='Icon giao diện · bảng 1', cols=5, rows=2, kind='cute game interface icons', facing='Every icon is a slightly angled front view',
         items=[(f'assets/emoji-fluent-3d/game/{k}.png', vi, d) for k, vi, d in HUD[:10]]),
    dict(name='hud_2', dot=2, group='ui', title='Icon giao diện · bảng 2', cols=5, rows=2, kind='cute game interface icons', facing='Every icon is a slightly angled front view',
         items=[(f'assets/emoji-fluent-3d/game/{k}.png', vi, d) for k, vi, d in HUD[10:20]]),
    dict(name='hud_3', dot=2, group='ui', title='Icon giao diện · bảng 3', cols=5, rows=2, kind='cute game interface icons', facing='Every icon is a slightly angled front view',
         items=[(f'assets/emoji-fluent-3d/game/{k}.png', vi, d) for k, vi, d in HUD[20:]]),
    dict(name='nut', dot=2, group='ui', title='Nút bấm giao diện · 13 nút', cols=5, rows=3, kind='cute glossy game buttons', facing='Every button is a flat front view, all the same size',
         items=[(f'assets/{p}', vi, d) for p, vi, d in BUTTONS]),
    dict(name='vip', dot=2, group='ui', noface=True, title='Huy hiệu VIP 1–8 · chữ VIP và số do script viết', cols=4, rows=2, kind='cute shield-shaped VIP badges, getting fancier from first to last',
         facing='Every badge is a flat front view with an empty smooth area in the middle for a label',
         items=[(f'vip/vip_{i}.png', f'VIP {i}', f'a shield badge, {look}') for i, look in enumerate(VIP_LOOK, 1)]),
    dict(name='qua_ngay', dot=2, group='ui', title='Quà đăng nhập 7 ngày · khung và chữ do script vẽ', cols=4, rows=2, kind='cute reward items', facing='Every item is a slightly angled front view',
         items=[(f'daily/day_{i}.png', vi, d) for i, (vi, d) in enumerate(DAILY, 1)]),
    dict(name='khung', dot=2, group='ui', title='Khung avatar · 8 khung tròn', cols=4, rows=2, kind='cute round avatar frames, each a thin decorated ring',
         facing='Every frame is a flat front view; the inside of each ring is completely empty (plain white)', holes=True, ring=True,
         items=[(f'assets/ui-premium-generated/avatar-frames/frame_{k}.png', f'Khung {k}', f'a ring frame, {d}') for k, d in FRAMES]),
    dict(name='ui_phu', dot=2, group='ui', noface=True, title='Ruy băng tiêu đề, nút dài, công tắc', cols=4, rows=3, kind='cute blank game interface pieces',
         facing='All are flat front views and completely blank, with no symbols on them',
         items=[(f'assets/ui-premium-generated/ribbons/ribbon_{c}.png', f'Ruy băng {c}', f'a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, {col}')
                for c, col in [('pink', 'pink'), ('mint', 'mint green'), ('sky', 'sky blue'), ('lemon', 'lemon yellow'), ('lavender', 'lavender purple')]] +
               [(f'assets/ui-premium-generated/buttons/pill_{c}.png', f'Nút dài {c}', f'a glossy capsule button three times wider than tall, {col}')
                for c, col in [('pink', 'pink'), ('mint', 'mint green'), ('sky', 'sky blue'), ('lemon', 'lemon yellow'), ('grey', 'light gray')]] +
               [('assets/ui-premium-generated/controls/toggle_on_pink.png', 'Công tắc bật', 'a pink toggle switch turned on, the round knob on the right'),
                ('assets/ui-premium-generated/controls/toggle_off.png', 'Công tắc tắt', 'a light gray toggle switch turned off, the round knob on the left')]),
    dict(name='cam_xuc_1', dot=2, group='emo', title='Biểu cảm · bảng 1', cols=5, rows=2, kind='cute 3D emoji stickers', facing='All are front views',
         items=[(f'assets/emoji-fluent-3d/{k}.png', vi, d) for k, vi, d in EMO[:10]]),
    dict(name='cam_xuc_2', dot=2, group='emo', title='Biểu cảm · bảng 2', cols=5, rows=2, kind='cute 3D emoji stickers', facing='All are front views',
         items=[(f'assets/emoji-fluent-3d/{k}.png', vi, d) for k, vi, d in EMO[10:20]]),
    dict(name='cam_xuc_3', dot=2, group='emo', title='Biểu cảm · bảng 3', cols=5, rows=2, kind='cute 3D emoji stickers', facing='All are front views',
         items=[(f'assets/emoji-fluent-3d/{k}.png', vi, d) for k, vi, d in EMO[20:]]),
    dict(name='avatar_2', dot=2, group='avatar', title='Avatar người chơi · 15 avatar còn lại', cols=5, rows=3,
         kind='cute round avatar badges, each a head-and-shoulders character inside a circle with a soft pastel background color', facing='All are front views',
         items=[(f'assets/avatars-dicebear/fun-emoji/png/{k}.png', vi, f'{who} on a {col} circle') for k, vi, who, col in FUN]),
    dict(name='avatar_thu', dot=2, group='avatar', title='Avatar thú (bot Tiến Lên) · 13 con', cols=5, rows=3, kind='cute round animal head avatars', facing='All are front views of the head only',
         items=[(f'assets/avatars-animals-remastered-kenney/PNG/Round/{a}.png', ANIMAL_VI[a], f'a {a} head') for a in ANIMALS]),
    dict(name='nhan_vat', dot=2, group='avatar', title='Nhân vật bot trong bàn 3D · 15 nhân vật', cols=5, rows=3, kind='cute chibi characters, head and shoulders', facing='All are front views',
         items=[(f'assets/emoji-fluent-3d/characters/{k}.png', vi, d) for k, vi, d in CHARS]),
    dict(name='co', dot=2, group='co', title='Quân cờ Cá Ngựa, Caro và mặt sau Bài Màu', cols=4, rows=2, kind='cute board game pieces',
         facing='The horse tokens and the X and O pieces are seen from directly above; the card is a flat front view',
         items=[(f'assets/games/co-ca-ngua/token_{c}.png', f'Quân ngựa {vi}', f'a round {col} board game token with a white horse head emblem')
                for c, vi, col in [('red', 'đỏ', 'red'), ('blue', 'xanh dương', 'blue'), ('green', 'xanh lá', 'green'), ('yellow', 'vàng', 'yellow')]] +
               [('assets/games/co-caro/piece_x.png', 'Quân X', 'a chunky glossy pink X piece made of two rounded bars'),
                ('assets/games/co-caro/piece_o.png', 'Quân O', 'a chunky glossy sky blue ring piece', {'holes': True}),
                ('assets/games/bai-mau/cards/back.png', 'Mặt sau Bài Màu', 'a tall card with rounded corners and a colorful rainbow swirl pattern around a round emblem split into four colored quarters', {'fill': True})]),
]
TABLE = ('A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table '
         'that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a {felt} felt surface with a thin dashed stitch line just inside the rim. '
         'The table is empty: no cards, no chips, no people. Around the table, a soft {wall} wall with a faint repeating pattern of tiny card suit symbols. '
         f'{STYLE}. Even soft lighting. No text, no letters, no watermark. {WIDE}.')
TABLES = [('classic', 'Bàn cổ điển', 'emerald green', 'warm cream'), ('lavender', 'Bàn tím', 'lavender purple', 'pale lilac'), ('mint', 'Bàn bạc hà', 'mint green', 'pale mint'),
          ('peach', 'Bàn đào', 'peach orange', 'pale peach'), ('sakura', 'Bàn hoa anh đào', 'pink', 'pale pink with a few cherry blossom petals'),
          ('sky', 'Bàn xanh trời', 'sky blue', 'pale sky blue'), ('tet', 'Bàn Tết', 'red', 'warm red and gold with apricot blossoms and small red lanterns')]
SINGLES = [(t, vi, p, 'nen', 1) for t, vi, p in BACKGROUNDS] + \
          [(f'assets/bg-tables-generated/with-table/table_scene_{k}.png', f'Bàn Tiến Lên · {vi}', TABLE.format(felt=felt, wall=wall), 'ban', 2) for k, vi, felt, wall in TABLES]
GROUPS = [('ca', 'Bắn Cá'), ('bai', 'Bộ bài & phỉnh'), ('icon', 'Icon game'), ('bau', 'Bầu Cua'), ('do', 'Đồ chơi'), ('ui', 'Giao diện'), ('emo', 'Biểu cảm'),
          ('avatar', 'Avatar & nhân vật'), ('co', 'Cờ & Bài Màu'), ('ban', 'Bàn Tiến Lên'), ('nen', 'Ảnh nền')]
STYLE_TIP = ('Giữ phong cách riêng của Heo Con Club: khi tạo mỗi ảnh, đính kèm 1–2 ảnh bạn đã làm ở đợt 1 (vd. <code>custom/sheets/ca_1.jpg</code> và <code>bai_nhanvat_1.jpg</code>) '
             'và thêm câu sau vào cuối prompt:')
STYLE_LINE = 'Match the art style of the attached images exactly: the same glossy 3D clay-toy rendering, soft lighting, rounded proportions and pastel candy palette.'


def sheet_prompt(s):
    items, cols = s['items'], s['cols']
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    order = ' '.join(f'Row {r + 1} from left to right: ' + '; '.join(it[2] for it in row) + '.' for r, row in enumerate(rows))
    noface = ' The objects have no faces, no eyes and no mouths.' if s.get('noface') else ''
    return (f'A sprite sheet of exactly {len(items)} separate {s["kind"]}, arranged in a neat grid of {cols} columns and {len(rows)} rows with wide empty space between them. '
            f'Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. {order} {s["facing"]}.{noface} '
            f'Style for all: {STYLE}, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, {NO_TEXT}. {WIDE}.')


# ------------------------------------------------------------------ docs/PROMPTS.md and docs/prompts.html
def _entries():
    """Every prompt in page order: batch 2 first, then batch 1; grouped. Each: dict(key, dot, group, title, save, prompt, items)."""
    out = []
    for s in SHEETS:
        out.append(dict(key=s['name'], dot=s['dot'], group=s['group'], title=s['title'], save=f'custom/sheets/{s["name"]}.png', prompt=sheet_prompt(s),
                        items=[(it[1], it[0]) for it in s['items']]))
    for target, vi, prompt, group, dot in SINGLES:
        out.append(dict(key=Path(target).stem, dot=dot, group=group, title=vi, save=f'custom/{target}', prompt=prompt, items=None))
    order = {g: i for i, (g, _) in enumerate(GROUPS)}
    return sorted(out, key=lambda e: (-e['dot'], order[e['group']]))


def write_doc():
    L = []; w = L.append; code = lambda p: w(f'```text\n{p}\n```\n')
    w('# Prompt tạo ảnh cho Heo Con Club\n')
    w('Mỗi prompt tạo **một ảnh**. Ảnh bảng (16:9, nhiều món) được script tự cắt ra từng món; ảnh nền và ảnh bàn là ảnh nguyên tấm. Cách làm:\n')
    w('1. Copy nguyên khối prompt, dán vào công cụ tạo ảnh, tải ảnh về (PNG/JPG, cỡ lớn nhất).')
    w('2. Lưu đúng tên file ghi ở mục đó (ảnh bảng vào `custom/sheets/`, đuôi .png hay .jpg đều được).')
    w('3. Chạy lệnh dưới, rồi mở `custom/sheets/_kiem_tra/` xem từng món đã cắt đúng tên chưa:\n')
    w('```bash\npython3 -E tools/apply_custom.py\n```\n')
    w('Ảnh nào chưa làm thì game giữ ảnh cũ. File này do `tools/art_sheets.py` sinh ra.\n')
    w('## Giữ phong cách riêng\n')
    w(STYLE_TIP.replace('<code>', '`').replace('</code>', '`') + '\n')
    code(STYLE_LINE)
    w('## Mẹo\n')
    w('- **Thứ tự quan trọng:** script đọc từng hàng từ trái sang phải, đúng thứ tự trong prompt. AI vẽ thiếu, thừa hoặc các món dính nhau thì script báo lỗi và bỏ qua bảng đó, bạn tạo lại.')
    w('- **Nền trắng trơn** để script xoá nền. Dấu ✦ ở góc ảnh của Gemini được tự xoá trên ảnh nền.')
    w('- **Một món bị lỗi:** tạo riêng món đó và lưu đè vào đúng đường dẫn trong bảng tên file. Script không ghi đè ảnh bạn tự thay.')
    w('- **Cá quay đầu sang trái**, game tự lật khi cá bơi sang phải.')
    w('- **Không để AI viết chữ:** số trên lá bài và phỉnh, chữ VIP, "Ngày 1", tên game đều do script vẽ.\n')
    n = 0; cur = None
    for e in _entries():
        sec = ('Đợt 2 · mới' if e['dot'] == 2 else 'Đợt 1 · đã làm')
        if sec != cur: cur = sec; w(f'# {sec}\n')
        n += 1
        w(f'## Ảnh {n} · {e["title"]}\n')
        w(f'Lưu: `{e["save"]}`' + ('' if e['items'] else ' (ảnh nguyên tấm, không cắt)') + '\n')
        code(e['prompt'])
        if e['items']:
            w('<details><summary>Thứ tự và tên file sau khi cắt</summary>\n')
            w('| # | Món | File |\n|---|---|---|')
            for i, (vi, target) in enumerate(e['items'], 1): w(f'| {i} | {vi} | `custom/{target}` |')
            w('\n</details>\n')
    w('## Ghi chú\n')
    w('- Bắn Cá: 24 loài mới nằm trong `custom/ban-ca/ca.json` (sửa được hệ số, loại, độ to). Ảnh trong `custom/ban-ca/thay/` vẽ lại 18 loài có sẵn. Xem riêng một loài: `play3d.html?game=ban-ca&fish=cus_kraken` hoặc `&fish=ca_map`.')
    w('- Muốn quay về ảnh mặc định: xoá ảnh trong `custom/` rồi chạy lại `python3 -E tools/apply_custom.py`.')
    w(f'\nTổng cộng {n} prompt.\n')
    (ROOT / 'docs').mkdir(exist_ok=True)
    (ROOT / 'docs' / 'PROMPTS.md').write_text('\n'.join(L), encoding='utf-8')
    return n


def write_html():
    """docs/prompts.html: the same prompts with one copy button each (published as an Artifact)."""
    import html
    esc = html.escape
    names = dict(GROUPS)
    blocks = []; n = 0; cur = None
    for e in _entries():
        n += 1
        sec = (2, 'Đợt 2 · mới', 'Phần còn lại của game. Tạo xong lưu vào đúng tên rồi chạy lệnh như đợt 1.') if e['dot'] == 2 else (1, 'Đợt 1 · bạn đã làm', 'Đã đưa vào game. Giữ lại để tạo lại khi cần.')
        if sec[0] != cur:
            cur = sec[0]; blocks.append(f'<h2 class="batch" id="dot{cur}">{sec[1]}</h2><p class="lead">{sec[2]}</p>')
        if e['items']:
            rows = ''.join(f'<li>{esc(vi)}</li>' for vi, _ in e['items'])
            extra = f'<details><summary>{len(e["items"])} món, đọc theo hàng từ trái sang phải</summary><ol>{rows}</ol></details>'
        else:
            extra = '<p class="note">Ảnh nguyên tấm, không cần cắt.</p>'
        blocks.append(f'''<article class="card" data-g="{e["group"]}" data-d="{e["dot"]}">
  <header><span class="num">{n}</span><span class="tag">{esc(names[e["group"]])}</span><h3>{esc(e["title"])}</h3><label class="done"><input type="checkbox" id="done-{e["key"]}" data-k="{e["key"]}"> Đã tạo</label></header>
  <p class="save">Lưu thành <code>{esc(e["save"])}</code> <button class="ghost" data-copy="{esc(e["save"])}" type="button">Chép tên</button></p>
  <pre class="prompt" id="t{n}">{esc(e["prompt"])}</pre>
  <button class="copy" data-for="t{n}" type="button">Sao chép prompt</button>{extra}
</article>''')
    page = TEMPLATE.replace('%BLOCKS%', '\n'.join(blocks)).replace('%STYLE_TIP%', STYLE_TIP).replace('%STYLE_LINE%', esc(STYLE_LINE)).replace('%N%', str(n))
    (ROOT / 'docs' / 'prompts.html').write_text(page, encoding='utf-8')
    return n


TEMPLATE = '''<title>Prompt ảnh Heo Con</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Be+Vietnam+Pro:wght@400;600&display=swap">
<style>
/* Candy-shop counter: one column of prompt cards, two batches, copy is the main action. */
:root { --bg:#fff4f8; --card:#ffffff; --ink:#3f2236; --muted:#8a6a7e; --accent:#e5487f; --accent-ink:#ffffff; --line:#f3d3e2; --chip:#ffe3ee; --code:#fdf0f6; --ok:#1f9a70; --new:#7a5cff;
  --display:"Baloo 2","Trebuchet MS",system-ui,sans-serif; --body:"Be Vietnam Pro","Segoe UI",system-ui,sans-serif; --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#1f1520; --card:#2b1e2c; --ink:#f8e9f1; --muted:#c6a9ba; --accent:#ff7aa8; --accent-ink:#2a0f1c; --line:#47314a; --chip:#3a283c; --code:#241925; --ok:#5fe0a8; --new:#b9a6ff; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#1f1520; --card:#2b1e2c; --ink:#f8e9f1; --muted:#c6a9ba; --accent:#ff7aa8; --accent-ink:#2a0f1c; --line:#47314a; --chip:#3a283c; --code:#241925; --ok:#5fe0a8; --new:#b9a6ff; color-scheme:dark; }
html,body { background:var(--bg); color:var(--ink); }
body { font:16px/1.6 var(--body); padding-inline:16px; padding-block:0 48px; }
.wrap { max-width:860px; margin:0 auto; }
h1 { font:800 clamp(30px,6vw,44px)/1.1 var(--display); margin:28px 0 6px; text-wrap:balance; }
.lead { color:var(--muted); margin:0 0 14px; max-width:65ch; }
.steps { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin:0 0 14px; padding:0; list-style:none; counter-reset:s; }
.steps li { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px 14px; counter-increment:s; min-width:0; }
.steps li::before { content:counter(s); font:800 15px var(--display); color:var(--accent-ink); background:var(--accent); border-radius:50%; width:24px; height:24px; display:inline-grid; place-items:center; margin-right:8px; }
code { font:13px var(--mono); background:var(--code); border-radius:6px; padding:1px 6px; overflow-wrap:anywhere; }
.style { background:var(--card); border:1px dashed var(--new); border-radius:16px; padding:14px; margin:0 0 16px; }
.style p { margin:0 0 8px; }
nav { position:sticky; top:env(safe-area-inset-top,0px); z-index:5; background:var(--bg); display:flex; gap:8px; overflow-x:auto; padding:10px 0; margin-bottom:6px; }
nav a { flex:none; text-decoration:none; color:var(--ink); background:var(--chip); border-radius:999px; padding:6px 14px; font:600 14px var(--body); }
nav a.b2 { background:var(--new); color:var(--accent-ink); }
nav a:focus-visible, button:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.progress { color:var(--muted); font-size:14px; margin:0 0 12px; font-variant-numeric:tabular-nums; }
.batch { font:800 26px var(--display); margin:30px 0 4px; scroll-margin-top:64px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:16px; margin:0 0 14px; min-width:0; }
.card.is-done { opacity:.55; }
.card header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.card h3 { font:800 19px/1.25 var(--display); margin:0; flex:1; min-width:12ch; text-wrap:balance; }
.num { font:800 15px var(--display); background:var(--chip); color:var(--accent); border-radius:10px; padding:2px 9px; font-variant-numeric:tabular-nums; }
.tag { font:600 12px var(--body); color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:1px 8px; }
.done { font-size:14px; color:var(--muted); display:flex; align-items:center; gap:6px; cursor:pointer; }
.save { margin:10px 0; font-size:14px; color:var(--muted); display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.prompt { font:14px/1.55 var(--mono); background:var(--code); border:1px solid var(--line); border-radius:12px; padding:12px; white-space:pre-wrap; overflow-wrap:anywhere; margin:0 0 10px; max-height:220px; overflow:auto; }
button { font:600 15px var(--body); border-radius:12px; cursor:pointer; }
.copy { background:var(--accent); color:var(--accent-ink); border:0; padding:10px 18px; width:100%; }
.copy.ok { background:var(--ok); }
.ghost { background:transparent; color:var(--accent); border:1px solid var(--line); padding:2px 10px; font-size:13px; }
details, .note { margin-top:10px; font-size:14px; color:var(--muted); }
summary { cursor:pointer; }
ol { margin:8px 0 0; padding-left:22px; }
@media (prefers-reduced-motion:no-preference) { .copy { transition:background .2s; } }
</style>
<div class="wrap">
<h1>Prompt ảnh Heo Con Club</h1>
<p class="lead">%N% prompt cho toàn bộ hình ảnh trong game. Ảnh bảng 16:9 chứa nhiều món, script tự cắt ra từng món; ảnh nền và ảnh bàn là ảnh nguyên tấm.</p>
<ol class="steps">
<li>Bấm <b>Sao chép prompt</b>, dán vào ChatGPT, Gemini hay Midjourney, tải ảnh cỡ lớn nhất.</li>
<li>Lưu ảnh đúng tên ghi ở mục đó (đuôi .png hay .jpg đều được).</li>
<li>Chạy <code>python3 -E tools/apply_custom.py</code>, xem kết quả cắt trong <code>custom/sheets/_kiem_tra/</code>.</li>
</ol>
<div class="style"><p><b>Giữ phong cách riêng.</b> %STYLE_TIP%</p><pre class="prompt" id="styleline">%STYLE_LINE%</pre><button class="copy" data-for="styleline" type="button">Sao chép câu giữ phong cách</button></div>
<nav aria-label="Nhảy tới"><a class="b2" href="#dot2">Đợt 2 · mới</a><a href="#dot1">Đợt 1 · đã làm</a></nav>
<p class="progress" id="prog"></p>
%BLOCKS%
</div>
<script>
(function () {
  function copyText(text, btn, label) {
    function done() { btn.textContent = 'Đã chép'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = label; btn.classList.remove('ok'); }, 1600); }
    function fallback() { var el = document.getElementById(btn.dataset.for || ''); if (el) { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } btn.textContent = 'Đã chọn sẵn, bấm Cmd/Ctrl+C'; }
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.for) copyText(document.getElementById(b.dataset.for).textContent, b, b.textContent);
    else if (b.dataset.copy) copyText(b.dataset.copy, b, 'Chép tên');
  });
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var boxes = document.querySelectorAll('.done input');
  function update() {
    var d2 = 0, t2 = 0;
    boxes.forEach(function (b) { var c = b.closest('.card'); c.classList.toggle('is-done', b.checked); if (c.dataset.d === '2') { t2++; if (b.checked) d2++; } });
    document.getElementById('prog').textContent = 'Đợt 2: đã tạo ' + d2 + ' / ' + t2 + ' ảnh';
  }
  boxes.forEach(function (b) {
    var v = store.get('heocon-done-' + b.dataset.k);
    b.checked = v === null ? b.closest('.card').dataset.d === '1' : v === '1';
    b.addEventListener('change', function () { store.set('heocon-done-' + b.dataset.k, b.checked ? '1' : '0'); update(); });
  });
  update();
})();
</script>
'''


def write_fish_json():
    p = C / 'ban-ca' / 'ca.json'
    if p.exists(): return False
    p.parent.mkdir(parents=True, exist_ok=True)
    rows = [{'file': f'{i}.png', 'id': i, 'name': n, 'tier': t, 'mult': m, 'size': sz, 'upright': up, 'faces': 'left'} for i, n, t, m, sz, up, _ in FISH]
    p.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return True


# ------------------------------------------------------------------ cutting
def _blobs(alpha, grow):
    """Label blobs of the alpha mask after growing it by `grow` px, so loose fins and sparkles stay with their item."""
    if nd is not None:
        lab, n = nd.label(nd.binary_dilation(alpha, iterations=grow))
        return lab, n
    from PIL import ImageFilter
    g = Image.fromarray((alpha * 255).astype(np.uint8))
    for _ in range(max(1, grow // 3)): g = g.filter(ImageFilter.MaxFilter(7))
    m = np.array(g) > 0
    lab = np.zeros(m.shape, np.int32); n = 0
    for y, x in zip(*np.nonzero(m)):   # simple flood fill fallback (slow but only used without scipy)
        if lab[y, x]: continue
        n += 1; stack = [(y, x)]
        while stack:
            cy, cx = stack.pop()
            if 0 <= cy < m.shape[0] and 0 <= cx < m.shape[1] and m[cy, cx] and not lab[cy, cx]:
                lab[cy, cx] = n; stack += [(cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)]
    return lab, n


def find_items(im, expected):
    """Return (pieces, note): pieces are RGBA crops in reading order. note explains a count mismatch ('' when fine).
    Items that come out stuck together are retried with a smaller merge distance."""
    a = np.array(im.getchannel('A')) > 40
    first = None
    for grow in (max(2, round(max(im.size) * .008)), max(2, round(max(im.size) * .003)), 1):
        res = _find(im, a, expected, grow)
        if not res[1]: return res
        first = first or res
        if len(res[0]) > expected: break                               # too many is not fixed by merging less
    return first


def _find(im, a, expected, grow):
    lab, n = _blobs(a, grow)
    comps = []
    for i in range(1, n + 1):
        m = (lab == i) & a
        area = int(m.sum())
        if not area: continue
        ys, xs = np.nonzero(m)
        comps.append({'mask': m, 'area': area, 'box': [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]})
    if not comps: return [], 'không thấy món nào (ảnh trống hoặc nền không xoá được)'
    comps.sort(key=lambda c: -c['area'])
    ref = np.median([c['area'] for c in comps[:expected]])
    comps = [c for c in comps if c['area'] >= ref * .04]              # dust and stray sparkles
    def gap(b1, b2):
        dx = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2])); dy = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3])); return math.hypot(dx, dy)
    while len(comps) > expected:                                         # merge the smallest leftover into its nearest neighbour
        comps.sort(key=lambda c: c['area']); s = comps.pop(0)
        if s['area'] > ref * .35:                                        # a real extra item, not a fragment
            comps.append(s); break
        t = min(comps, key=lambda c: gap(c['box'], s['box']))
        t['mask'] = t['mask'] | s['mask']; t['area'] += s['area']
        t['box'] = [min(t['box'][0], s['box'][0]), min(t['box'][1], s['box'][1]), max(t['box'][2], s['box'][2]), max(t['box'][3], s['box'][3])]
    note = '' if len(comps) == expected else f'tìm thấy {len(comps)} món, cần {expected}'
    # reading order: rows by vertical centre, then left to right
    for c in comps: c['cy'] = (c['box'][1] + c['box'][3]) / 2; c['cx'] = (c['box'][0] + c['box'][2]) / 2; c['h'] = c['box'][3] - c['box'][1]
    comps.sort(key=lambda c: c['cy'])
    medh = np.median([c['h'] for c in comps]); rows = []
    for c in comps:
        if rows and abs(c['cy'] - np.mean([r['cy'] for r in rows[-1]])) < medh * .55: rows[-1].append(c)
        else: rows.append([c])
    ordered = [c for r in rows for c in sorted(r, key=lambda c: c['cx'])]
    arr = np.array(im)
    pieces = []
    for c in ordered:
        m = _main_parts(c['mask'])
        ys, xs = np.nonzero(m); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        sub = arr[y0:y1, x0:x1].copy()
        sub[..., 3] = np.where(m[y0:y1, x0:x1], sub[..., 3], 0)          # keep only this item's pixels
        pieces.append(Image.fromarray(sub))
    return pieces, note


def _main_parts(mask):
    """Drop specks (sparkles, dust) that sit next to an item but are not attached to it."""
    if nd is None: return mask
    lab, n = nd.label(mask)
    if n < 2: return mask
    areas = nd.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i, a in enumerate(areas) if a >= areas.max() * .03]
    return np.isin(lab, keep)


def _clear_holes(p):
    """Make the white hole in the middle of a ring (avatar frames, the O piece) transparent; white highlights on the ring stay."""
    a = np.array(p.convert('RGBA'))
    white = (np.abs(a[..., :3].astype(np.int32) - 255).sum(2) < 40) | (a[..., 3] < 30)
    if nd is not None:
        lab, n = nd.label(white); h, w = white.shape
        k = lab[h // 2, w // 2]
        white = (lab == k) if k else np.zeros_like(white)
    a[..., 3] = np.where(white, 0, a[..., 3])
    return Image.fromarray(a)


def _fit_ring(p, size=320, hole=.66):
    """Scale an avatar frame so its empty middle is `hole` of the image width (the avatar sits there), centred."""
    a = np.array(p.convert('RGBA')); h, w = a.shape[:2]
    empty = a[..., 3] < 30
    if nd is not None:
        lab, n = nd.label(empty); cy, cx = h // 2, w // 2
        k = lab[cy, cx]
        if k:
            ys, xs = np.nonzero(lab == k)
            if xs.min() > 0 and ys.min() > 0 and xs.max() < w - 1 and ys.max() < h - 1:
                hw = xs.max() - xs.min() + 1; mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
                sc = hole * size / hw
                big = p.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
                out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                out.paste(big, (round(size / 2 - mx * sc), round(size / 2 - my * sc)), big)   # paste clips anything past the edges
                return out
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); t = p.copy(); t.thumbnail((size, size))
    out.paste(t, ((size - t.width) // 2, (size - t.height) // 2), t); return out


def _sha(p): return hashlib.sha1(Path(p).read_bytes()).hexdigest()


def check_sheet(name, pieces, labels, note):
    out = SHEETS_DIR / '_kiem_tra'; out.mkdir(parents=True, exist_ok=True)
    tw, th = 240, 250; cols = min(5, max(1, len(pieces)))
    rows = max(1, math.ceil(len(pieces) / cols))
    sheet = Image.new('RGB', (cols * tw, rows * th + (40 if note else 0)), (232, 240, 248))
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype(str(ROOT / 'assets' / 'fonts' / 'Baloo2[wght].ttf'), 17); font.set_variation_by_axes([700])
    except Exception: font = ImageFont.load_default()
    for i, p in enumerate(pieces):
        x, y = (i % cols) * tw, (i // cols) * th
        t = p.copy(); t.thumbnail((tw - 20, th - 60)); bg = Image.new('RGBA', t.size, (180, 215, 235, 255)); bg.alpha_composite(t)
        sheet.paste(bg.convert('RGB'), (x + (tw - t.width) // 2, y + 10))
        short = labels[i].split(' · ')[0] if i < len(labels) else '(thừa)'
        d.text((x + tw // 2, y + th - 28), f'{i + 1}. {short}', font=font, fill=(90, 30, 70), anchor='mm')
    if note: d.text((10, rows * th + 8), 'LỖI: ' + note + ' - chưa dùng bảng này, hãy tạo lại ảnh', font=font, fill=(200, 30, 60))
    sheet.save(out / f'{name}.png')


def cut_all(verbose=True):
    """Cut every custom/sheets/<name>.png. Returns the number of pieces written."""
    if not SHEETS_DIR.is_dir(): return 0
    log_p = SHEETS_DIR / '_cut.json'
    log = json.loads(log_p.read_text()) if log_p.exists() else {}
    total = 0
    for s in SHEETS:
        src = next((p for p in (SHEETS_DIR / (s['name'] + e) for e in ('.png', '.jpg', '.jpeg', '.webp')) if p.exists()), None)
        if not src: continue
        im = remove_background(Image.open(src), src.name)
        pieces, note = find_items(im, len(s['items']))
        labels = [it[1] for it in s['items']]
        check_sheet(s['name'], pieces, labels, note)
        if note:
            print(f'  ! {src.name}: {note} - chưa dùng bảng này (xem custom/sheets/_kiem_tra/{s["name"]}.png)'); continue
        written = kept = 0
        for p, it in zip(pieces, s['items']):
            target = it[0]; flag = dict(s, **(it[3] if len(it) > 3 else {}))
            dst = C / target; dst.parent.mkdir(parents=True, exist_ok=True)
            if flag.get('fill'):                                         # card backs: drop the rounded corners and border
                w, h = p.size; p = p.crop((round(w * .05), round(h * .04), round(w * .95), round(h * .96)))
            if flag.get('holes'): p = _clear_holes(p)                     # white showing through a ring or a net
            if flag.get('ring'): p = _fit_ring(p)
            if dst.exists() and log.get(target) != _sha(dst):
                kept += 1; continue                                      # a file you put there yourself
            p.save(dst); log[target] = _sha(dst); written += 1
        total += written
        if verbose: print(f'  {src.name}: cắt {written} món' + (f', giữ {kept} ảnh bạn tự thay' if kept else ''))
    log_p.write_text(json.dumps(log, indent=1))
    return total


if __name__ == '__main__':
    if '--cut' in sys.argv:
        print('pieces', cut_all())
    else:
        print('prompts', write_doc(), '-> docs/PROMPTS.md')
        print('page', write_html(), 'prompts -> docs/prompts.html')
        print('custom/ban-ca/ca.json', 'written' if write_fish_json() else 'kept (already exists)')
