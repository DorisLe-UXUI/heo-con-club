"""Extend manifest.json with the new packs, render a game mockup + kit overview, and rewrite preview.html.
Usage: python3 -E build_v2.py <assets_dir>
"""
import sys, json, html, math, re
from pathlib import Path
from urllib.parse import quote
from PIL import Image, ImageDraw, ImageFont, ImageFilter

A = Path(sys.argv[1]).resolve()
ROOT = A.parent
M = json.loads((A / 'manifest.json').read_text(encoding='utf-8'))
warn = []


def rel(p: Path) -> str:
    return p.resolve().relative_to(A).as_posix()


def files(folder, pattern='*.png', recursive=False):
    d = A / folder
    if not d.exists():
        warn.append(f'missing folder {folder}')
        return []
    it = d.rglob(pattern) if recursive else d.glob(pattern)
    return sorted(rel(p) for p in it if p.is_file() and not p.name.startswith('_'))


def need(path):
    if not (A / path).exists():
        warn.append(f'missing file {path}')
    return path


# ------------------------------------------------------------------ manifest additions
THEMES = ['sakura', 'mint', 'sky', 'lavender', 'peach', 'classic', 'tet']
M['tables'] = {t: {'scene': need(f'bg-tables-generated/with-table/table_scene_{t}.png'),
                   'background': need(f'bg-tables-generated/background-only/bg_{t}.png'),
                   'table': need(f'bg-tables-generated/table-only/table_{t}.png'),
                   'pattern_tile': need(f'bg-tables-generated/pattern-tiles/pattern_suits_{t}.png')} for t in THEMES}
M['tables']['_about'] = '1920x1080. scene = background + table; table-only is transparent so you can put it on any background. CC0 (generated).'

JB = 'ui-jelly-pzuh/buttons'
jelly = {c: sorted(f for f in files(JB) if f.endswith(f'_{c}.png')) for c in ('blue', 'green', 'red', 'grey')}
for c in ('pink', 'purple', 'yellow', 'orange', 'mint'):
    jelly[c] = files(f'ui-jelly-pzuh/buttons-pastel/{c}')
M['ui']['jelly'] = {'license': 'CC0 (pzUH); pastel colours hue-shifted, CC0', 'buttons': jelly,
                    'extra': [f for f in files(JB) if 'square_locked' in f or 'label_' in f],
                    'windows': files('ui-jelly-pzuh/windows'), 'background': need('ui-jelly-pzuh/background_pink.png'),
                    'naming': 'icon_<name>_<colour>.png, wide_<colour>.png, square_<colour>.png'}
M['ui']['kenney_puzzle'] = {'license': 'CC0', 'coins': files('ui-puzzle-kenney/PNG/Coins'), 'balls': files('ui-puzzle-kenney/PNG/Balls'),
                            'particles': files('ui-puzzle-kenney/PNG/Particles yellow') + files('ui-puzzle-kenney/PNG/Particles blue') + files('ui-puzzle-kenney/PNG/Particles white'),
                            'tiles_pink': files('ui-puzzle-kenney/PNG/Tiles pink')}

FL = 'emoji-fluent-3d'
M['emoji'] = {'fluent_3d': {'license': 'MIT (Microsoft Fluent Emoji)', 'size': [256, 256],
                            **{c: files(f'{FL}/{c}') for c in ('reactions', 'hands', 'symbols', 'game', 'tet', 'animals')}}}

DB = 'avatars-dicebear'
DB_LIC = {s: (A / DB / s / 'LICENSE.txt').read_text(encoding='utf-8').split('\n')[0] for s in sorted(p.name for p in (A / DB).iterdir() if p.is_dir())}
M['avatars']['dicebear'] = {s: {'license': DB_LIC[s], 'png_256_round': files(f'{DB}/{s}/png'), 'svg_transparent': files(f'{DB}/{s}/svg', '*.svg')} for s in DB_LIC}
M['avatars']['ninja_facesets'] = {'license': 'CC0 (Pixel-boy & AAA, Ninja Adventure)', 'size': [38, 38], 'files': files('avatars-ninja-facesets')}

M['characters'] = {
    'jumper_bunnies': {'license': 'CC0', 'files': files('characters-jumper-kenney/PNG/Players')},
    'physics_aliens': {'license': 'CC0', 'files': files('characters-physics-kenney/PNG/Aliens')},
    'shape_characters': {'license': 'CC0', 'note': 'Assemble body_* + part_eye_* + part_mouth_* + hand_* parts', 'files': files('characters-shapes-kenney/PNG/Double')},
}
M['emotes']['ninja'] = {'license': 'CC0', 'files': files('emotes-ninja')}
SMOKE = A / 'fx-smoke-kenney' / 'PNG'
M['fx'] = {
    'kenney_particles': {'license': 'CC0', 'note': 'white on transparent, tint in engine', 'files': files('fx-particles-kenney/PNG (Transparent)')},
    'kenney_smoke': {'license': 'CC0', **{d.name: files(f'fx-smoke-kenney/PNG/{d.name}') for d in sorted(SMOKE.iterdir()) if d.is_dir()}},
    'ninja': {'license': 'CC0', 'spritesheets': files('fx-ninja', '*.png', recursive=True)},
}
M['items'] = {
    'ninja_treasure': {'license': 'CC0', 'files': files('items-ninja/Treasure')},
    'ninja_food': {'license': 'CC0', 'files': files('items-ninja/Food')},
    'jumper_items': {'license': 'CC0', 'files': files('characters-jumper-kenney/PNG/Items') + files('characters-jumper-kenney/PNG/HUD')},
}
M['icons'] = {
    'kenney_game_white_2x': {'license': 'CC0', 'files': files('icons-game-kenney/PNG/White/2x')},
    'kenney_game_black_2x': {'license': 'CC0', 'files': files('icons-game-kenney/PNG/Black/2x')},
    'kenney_boardgame_128': {'license': 'CC0', 'files': files('icons-boardgame-kenney/PNG/Double (128px)')},
}
M['cursors'] = {'kenney': {'license': 'CC0', 'basic': files('cursors-kenney/PNG/Basic/Default'), 'outline': files('cursors-kenney/PNG/Outline/Default')}}
M['backgrounds'] = {
    'kenney_clouds_and_scenery': {'license': 'CC0', 'files': files('bg-clouds-kenney/PNG/Flat') + files('bg-clouds-kenney/PNG'), 'samples': files('bg-clouds-kenney/Samples')},
    'kenney_patterns': {'license': 'CC0', 'note': '256px black/white tileable, recolour in engine', 'files': files('bg-patterns-kenney/PNG/Default')},
    'jelly_pink': need('ui-jelly-pzuh/background_pink.png'),
}
MUSIC = [
    ('music-bgm/opengameart/happy-clappy-loop__OwlishMedia.wav', 'Happy Clappy Loop', 'OwlishMedia', 'CC0', 'vui tươi, piano vỗ tay, loop', 'https://opengameart.org/content/happy-clappy-loop'),
    ('music-bgm/opengameart/menu-loop-tiggo__qubodup.ogg', 'Menu Music Loop (Tiggo)', 'qubodup', 'CC0', 'menu, đáng yêu, loop', 'https://opengameart.org/node/174263'),
    ('music-bgm/opengameart/level-loop-tigrun__qubodup.ogg', 'Level Music Loop (Tigrun)', 'qubodup', 'CC0', 'trong ván, nhộn nhịp, loop', 'https://opengameart.org/node/174263'),
    ('music-bgm/opengameart/happy-adventure__TinyWorlds.mp3', 'Happy Adventure', 'TinyWorlds', 'CC0', '8-bit vui vẻ', 'https://opengameart.org/content/happy-adventure-loop'),
    ('music-bgm/opengameart/happy-vibes__Ruskerdax.mp3', 'Happy Vibes', 'Ruskerdax', 'CC0', 'nhiệt đới, chill vui', 'https://opengameart.org/node/160228'),
    ('music-bgm/opengameart/good-morning__Cakeflaps.ogg', 'Good Morning', 'Cakeflaps (You\'re Perfect Studio)', 'CC0 (chọn CC0 trong 3 license)', 'dễ thương, buổi sáng', 'https://opengameart.org/node/86566'),
    ('music-bgm/opengameart/menu-chill__etrock.wav', 'Menu Chill', 'etrock', 'CC0', 'chill, sảnh chờ', 'https://opengameart.org/content/menu-chill-music'),
    ('music-bgm/opengameart/lofi-loop__omfgdude.ogg', 'Lofi Hip Hop Loop', 'omfgdude', 'CC0', 'lofi, thư giãn', 'https://opengameart.org/node/94031'),
]
for p in files('music-bgm/ninja-adventure', '*.ogg'):
    MUSIC.append((p, Path(p).stem, 'Pixel-boy & AAA (Ninja Adventure)', 'CC0', 'chiptune / RPG nhẹ nhàng', 'https://pixel-boy.itch.io/ninja-adventure-asset-pack'))
M['music'] = [{'file': need(f), 'title': t, 'author': a, 'license': l, 'mood': m, 'source': s} for f, t, a, l, m, s in MUSIC]
M['audio'].update({
    'kenney_interface': {'license': 'CC0', 'files': files('audio-interface-kenney/Audio', '*.ogg')},
    'kenney_ui': {'license': 'CC0', 'files': files('audio-ui-kenney/Audio', '*.ogg')},
    'kenney_jingles': {'license': 'CC0', **{d.name: files(f'audio-jingles-kenney/Audio/{d.name}', '*.ogg') for d in sorted((A / 'audio-jingles-kenney/Audio').iterdir()) if d.is_dir()}},
    'kenney_digital': {'license': 'CC0', 'files': files('audio-digital-kenney/Audio', '*.ogg')},
    'kenney_impact': {'license': 'CC0', 'files': files('audio-impact-kenney/Audio', '*.ogg')},
    'ninja_sfx': {'license': 'CC0', **{d.name: files(f'audio-sfx-ninja/{d.name}', '*.wav', recursive=True) for d in sorted((A / 'audio-sfx-ninja').iterdir()) if d.is_dir()}},
})
FONTS_NEW = {
    'Cherry Bomb One': ('CherryBombOne-Regular.ttf', 'OFL-cherrybombone.txt', 'logo, tiêu đề, chữ "CHẶT HEO!" — tròn mập siêu cute'),
    'Coiny': ('Coiny-Regular.ttf', 'OFL-coiny.txt', 'số tiền, điểm, nút bấm — kiểu kẹo dẻo'),
    'Grandstander': ('Grandstander[wght].ttf', 'OFL-grandstander.txt', 'tiêu đề vui nhộn, variable weight'),
    'Itim': ('Itim-Regular.ttf', 'OFL-itim.txt', 'chữ nội dung tròn mềm'),
    'Mali': ('Mali-Regular.ttf', 'OFL-mali.txt', 'chữ viết tay dễ thương (có Regular/SemiBold/Bold)'),
    'Pangolin': ('Pangolin-Regular.ttf', 'OFL-pangolin.txt', 'chat, bong bóng thoại'),
    'Playpen Sans': ('PlaypenSans[wght].ttf', 'OFL-playpensans.txt', 'viết tay trẻ con, variable weight'),
    'Quicksand': ('Quicksand[wght].ttf', 'OFL-quicksand.txt', 'UI gọn gàng bo tròn'),
    'Lemonada': ('Lemonada[wght].ttf', 'OFL-lemonada.txt', 'tiêu đề mềm mại'),
    'Gluten': ('Gluten[slnt,wght].ttf', 'OFL-gluten.txt', 'chữ dính dính vui tai'),
    'Paytone One': ('PaytoneOne-Regular.ttf', 'OFL-paytoneone.txt', 'số lớn, đậm'),
    'Patrick Hand': ('PatrickHand-Regular.ttf', 'OFL-patrickhand.txt', 'ghi chú viết tay'),
}
for name, (f, lic, use) in FONTS_NEW.items():
    M['fonts'][name] = {'license': 'OFL 1.1', 'file': need(f'fonts/{f}'), 'license_file': need(f'fonts/{lic}'), 'vietnamese': True, 'use': use}
M['fonts']['Mali']['extra_weights'] = [need('fonts/Mali-SemiBold.ttf'), need('fonts/Mali-Bold.ttf')]
EVENTS = {
    'deal_shuffle': 'audio-casino-kenney/Audio/card-shuffle.ogg',
    'deal_card': 'audio-casino-kenney/Audio/card-slide-1.ogg',
    'play_card': 'audio-casino-kenney/Audio/card-place-1.ogg',
    'pass_turn': 'audio-interface-kenney/Audio/drop_001.ogg',
    'your_turn': 'audio-sfx-ninja/Alert/Alert.wav',
    'chat_heo_slash': 'audio-sfx-ninja/Whoosh & Slash/Slash.wav',
    'chat_heo_boom': 'audio-sfx-ninja/Elemental/Explosion.wav',
    'coin_gain': 'audio-sfx-ninja/Bonus/Coin.wav',
    'chips': 'audio-casino-kenney/Audio/chips-stack-1.ogg',
    'win': 'audio-sfx-ninja/Jingles/Success1.wav',
    'lose': 'audio-sfx-ninja/Jingles/GameOver.wav',
    'button_click': 'audio-ui-kenney/Audio/click1.ogg',
    'emoji_pop': 'audio-sfx-ninja/Elemental/Bubble.wav',
    'timer_tick': 'audio-interface-kenney/Audio/tick_001.ogg',
}
M['recommended'] = {
    'deck': 'decks.cute', 'table': 'tables.sakura', 'buttons': 'ui.jelly.buttons.pink', 'panels': 'ui.jelly.windows',
    'avatars': 'avatars.dicebear.fun-emoji', 'reactions': 'emoji.fluent_3d.reactions', 'bgm_lobby': 'music-bgm/opengameart/menu-loop-tiggo__qubodup.ogg',
    'bgm_game': 'music-bgm/opengameart/happy-clappy-loop__OwlishMedia.wav', 'font_title': 'Coiny', 'font_body': 'Nunito',
    'sfx': {k: need(v) for k, v in EVENTS.items()},
}

# ================= v3 additions: more games, premium UI, 3D characters, animated emoji
GAME_NAMES = {'tien-len': 'Tiến Lên', 'phom': 'Phỏm', 'mau-binh': 'Mậu Binh', 'xi-dach': 'Xì Dách', 'poker': 'Poker', 'bai-cao': 'Bài Cào', 'sam-loc': 'Sâm Lốc', 'lieng': 'Liêng',
              'bau-cua': 'Bầu Cua', 'xoc-dia': 'Xóc Đĩa', 'tai-xiu': 'Tài Xỉu', 'co-tuong': 'Cờ Tướng', 'co-ca-ngua': 'Cá Ngựa', 'co-caro': 'Cờ Caro', 'bai-mau': 'Bài Màu', 'lo-to': 'Lô Tô', 'ban-ca': 'Bắn Cá'}
GD = A / 'games'
def tree(folder):
    out = {}
    for p in sorted((GD / folder).rglob('*')):
        if p.is_file() and p.suffix in ('.png', '.json') and not p.name.startswith('_'):
            key = p.parent.relative_to(GD / folder).as_posix() or '.'
            out.setdefault(key, []).append(rel(p))
    return out
M['games'] = {'_about': 'Generated per-game kits (CC0 except Fluent-based symbols, MIT). lobby_icon is 512x512.',
              **{k: {'name': v, 'lobby_icon': need(f'games/lobby-icons/{k}.png')} for k, v in GAME_NAMES.items()}}
for folder in ('bau-cua', 'xoc-dia', 'tai-xiu', 'co-tuong', 'co-ca-ngua', 'co-caro', 'bai-mau', 'lo-to', 'ban-ca', 'mau-binh'):
    M['games'][folder]['assets'] = tree(folder)
M['games']['_shared'] = {'plates_bowls': tree('shared'), 'card_helpers': tree('card-shared')}
UP = A / 'ui-premium-generated'
M['ui']['premium'] = {'license': 'CC0 (generated); decorations from Fluent Emoji (MIT)', **{d.name: sorted(rel(p) for p in d.rglob('*.png')) for d in sorted(UP.iterdir()) if d.is_dir()}}
M['characters']['fluent_3d'] = {'license': 'MIT (Microsoft Fluent Emoji)', 'size': [256, 256], 'files': files('emoji-fluent-3d/characters')}
TOON = A / 'characters-toon-kenney'
M['characters']['kenney_toon'] = {'license': 'CC0', 'note': '6 characters x 45 poses; HD poses 192px', **{d.name: files(f'characters-toon-kenney/{d.name}/PNG/Poses HD') for d in sorted(TOON.iterdir()) if d.is_dir() and (d / 'PNG').exists()}}
PLAT = A / 'characters-platformer-kenney' / 'PNG'
M['characters']['kenney_platformer'] = {'license': 'CC0', **{d.name: files(f'characters-platformer-kenney/PNG/{d.name}/Poses') for d in sorted(PLAT.iterdir()) if d.is_dir()}}
AR = A / 'avatars-animals-remastered-kenney' / 'PNG'
M['avatars']['kenney_animals_remastered'] = {'license': 'CC0', 'note': '30 animals x 8 styles', 'styles': {d.name: files(f'avatars-animals-remastered-kenney/PNG/{d.name}') for d in sorted(AR.iterdir()) if d.is_dir()}}
for c in ('game-items', 'sea'):
    M['emoji']['fluent_3d'][c] = files(f'emoji-fluent-3d/{c}')
NA = A / 'emoji-noto-animated'
M['emoji']['noto_animated'] = {'license': 'CC BY 4.0 (Google Noto Animated Emoji) — credit required', 'formats': 'webp (512 animated), lottie.json, sheet_96.png + sheet_96.json, still_128.png',
                               'items': {d.name: {'webp': rel(d / '512.webp'), 'lottie': rel(d / 'lottie.json'), 'sheet': rel(d / 'sheet_96.png'), 'still': rel(d / 'still_128.png')} for d in sorted(NA.iterdir()) if d.is_dir() and (d / '512.webp').exists()}}
M['backgrounds']['lobby'] = files('ui-premium-generated/lobby-backgrounds')
M['fonts']['LXGW WenKai TC'] = {'license': 'OFL 1.1', 'file': need('fonts/LXGWWenKaiTC-Bold.ttf'), 'license_file': need('fonts/OFL-lxgwwenkaitc.txt'), 'vietnamese': True, 'use': 'chữ Hán phồn thể cho Cờ Tướng cổ điển'}
M['fonts']['ZCOOL KuaiLe'] = {'license': 'OFL 1.1', 'file': need('fonts/ZCOOLKuaiLe-Regular.ttf'), 'license_file': need('fonts/OFL-zcoolkuaile.txt'), 'vietnamese': False, 'use': 'chữ Hán giản thể dễ thương cho Cờ Tướng pastel'}
R3 = A / '3d'
M['models3d'] = {'license': 'CC0 — KayKit by Kay Lousberg (Adventurers, Mini-Game Variety, Board Game Bits, Forest Nature) and Tiny Treats by Isa Lousberg (Fun Playground, Pretty Park, Homely House, House Plants)', 'town_textures': '3d/js/tex_town.js',
                 'glb': files('3d/glb', '*.glb'), 'embedded_js': files('3d/js', '*.js'),
                 'renders': {'avatars': files('3d/renders/avatars'), 'full': files('3d/renders/full'), 'icons': files('3d/renders/icons')},
                 'runtime': {'three': '../js/vendor/three.min.js (r147, MIT)', 'helper': '../js/hc3d.js'},
                 'animations': 'anim_general: Idle_A, Idle_B, Interact, Use_Item, PickUp, Throw, Spawn_Air, Spawn_Ground, Hit_A, Hit_B, Death_A, Death_B · anim_move: Walking_*, Running_*, Jump_*'}
M['town3d'] = {'file': '../index.html', 'code': ['../js/town3d.js', '../js/hc-core.js', '../js/hc3d.js'], 'tests': ['node tests/auth.test.js', 'index.html?selftest=1&screen=town&as=guest'], 'url_params': {'screen=auth|town|loading|aerial': 'jump to a screen', 'as=guest': 'enter as guest', 'look=<game key>': 'start at that shop', 'modal=<name>': 'open a popup', 'tut=1': 'show the tutorial'}}
M['games3d'] = {'page': '../play3d.html?game=<key>', 'framework': '../js/table3d.js', 'modules': '../js/games3d/<key>.js', 'rules': '../js/games3d/rules/<key>.js', 'tests': 'node tests/<key>.test.js', 'guide': '../docs/GAME3D_GUIDE.md', 'texture_bundles': files('3d/js', 'tex_*.js')}
M['map_menu'] = {'file': '../lobby.html', 'image': '3d/renders/town_map.jpg', 'pins': '3d/js/town_map.js', 'classic_2d_lobby': '../lobby-classic.html'}
M['pusher_game'] = {'file': '../pusher.html', 'physics': '../js/pusher-sim.js', 'tests': ['node tests/pusher.test.js', 'pusher.html?machine=1&selftest=1'], 'url_params': {'machine=0..2': 'open a machine directly', 'selftest=1': 'automatic drop test'}}
M['tien_len_game'] = {'file': '../tien-len.html', 'engine': '../js/tienlen-engine.js', 'tests': 'node tests/tienlen.test.js', 'url_params': {'room=0..3': 'join a table directly', 'seed=N': 'deterministic deals', 'auto=1': 'AI plays your seat', 'speed=fast|turbo': 'faster bots', 'uitest=N': 'scripted UI self-test'}}
M['lobby_prototype'] = {'file': '../lobby.html', 'url_params': {'screen=lobby': 'skip loading screen', 'game=<key>': 'open a game directly (keys = games.*)', 'modal=daily|settings|profile|shop|rank|event': 'open a popup', 'demo=1': 'auto-play a sample action'}}
(A / 'manifest.json').write_text(json.dumps(M, ensure_ascii=False, indent=1), encoding='utf-8')

# ------------------------------------------------------------------ fonts for raster work
FONT_DIR = A / 'fonts'


def font(fname, size, variation=None):
    f = ImageFont.truetype(str(FONT_DIR / fname), size)
    if variation:
        try:
            f.set_variation_by_name(variation)
        except Exception:
            pass
    return f


def load(path, w=None, h=None, rot=0, pixel=False):
    im = Image.open(A / path).convert('RGBA')
    if w or h:
        s = (w / im.width) if w else (h / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST if pixel else Image.LANCZOS)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    return im


def paste_c(base, im, cx, cy):
    base.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))


def shadow_of(im, blur=8, alpha=0.35, offset=(0, 8)):
    sh = Image.new('RGBA', (im.width + 4 * blur, im.height + 4 * blur), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: int(v * alpha))
    blk = Image.new('RGBA', im.size, (60, 20, 40, 255)); blk.putalpha(a)
    sh.alpha_composite(blk, (2 * blur, 2 * blur))
    return sh.filter(ImageFilter.GaussianBlur(blur)), (offset[0] - 2 * blur, offset[1] - 2 * blur)


def paste_shadow_c(base, im, cx, cy, **kw):
    sh, (ox, oy) = shadow_of(im, **kw)
    base.alpha_composite(sh, (round(cx - im.width / 2 + ox), round(cy - im.height / 2 + oy)))
    paste_c(base, im, cx, cy)


# ------------------------------------------------------------------ game mockup
def mockup(theme='sakura', out='demo-mockup.png'):
    W, H = 1920, 1080
    img = Image.open(A / M['tables'][theme]['scene']).convert('RGBA')
    dr = ImageDraw.Draw(img)
    F_name = font('CherryBombOne-Regular.ttf', 30)
    F_coin = font('Coiny-Regular.ttf', 26)
    F_btn = font('CherryBombOne-Regular.ttf', 40)
    F_big = font('CherryBombOne-Regular.ttf', 120)
    F_info = font('Baloo2[wght].ttf', 30, 'Bold')
    deck = M['decks']['cute']['cards']
    back = M['decks']['cute']['backs'][1]
    coin = 'emoji-fluent-3d/game/coin.png'

    def nameplate(cx, top, name, money):
        w = 230
        plate = Image.new('RGBA', (w, 86), (0, 0, 0, 0))
        pd = ImageDraw.Draw(plate)
        pd.rounded_rectangle((0, 0, w - 1, 85), 28, fill=(255, 255, 255, 235), outline=(201, 80, 127, 255), width=4)
        pd.text((w / 2, 26), name, font=F_name, fill=(120, 40, 80), anchor='mm')
        c = load(coin, 30)
        plate.alpha_composite(c, (40, 46))
        pd.text((78, 61), money, font=F_coin, fill=(214, 140, 20), anchor='lm')
        paste_shadow_c(img, plate, cx, top + 43, blur=6, alpha=0.25, offset=(0, 5))

    def avatar(cx, cy, path, ring=(255, 255, 255), active=False):
        size = 150
        av = load(path, size)
        mask = Image.new('L', (size, size), 0); ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        av.putalpha(mask)
        disc = Image.new('RGBA', (size + 20, size + 20), (0, 0, 0, 0))
        dd = ImageDraw.Draw(disc)
        dd.ellipse((0, 0, size + 19, size + 19), fill=(*ring, 255))
        disc.alpha_composite(av, (10, 10))
        if active:
            ring_l = Image.new('RGBA', (size + 44, size + 44), (0, 0, 0, 0))
            rd = ImageDraw.Draw(ring_l)
            rd.arc((2, 2, size + 41, size + 41), -90, 200, fill=(255, 196, 0, 255), width=11)
            rd.arc((2, 2, size + 41, size + 41), 200, 270, fill=(255, 255, 255, 140), width=11)
            paste_c(img, ring_l, cx, cy)
        paste_shadow_c(img, disc, cx, cy, blur=7, alpha=0.3, offset=(0, 6))

    def opp_cards(cx, cy, n, rot=0):
        c = load(back, 74, rot=rot)
        for i in range(3):
            paste_c(img, c, cx + i * 6, cy - i * 4)
        b = Image.new('RGBA', (52, 52), (0, 0, 0, 0)); bd = ImageDraw.Draw(b)
        bd.ellipse((0, 0, 51, 51), fill=(255, 92, 154, 255), outline=(255, 255, 255, 255), width=4)
        bd.text((26, 27), str(n), font=F_coin, fill='white', anchor='mm')
        paste_c(img, b, cx + 40, cy - 52)

    # opponents
    seats = [
        ((150, 520), 'avatars-dicebear/fun-emoji/png/meo.png', 'Mèo Mập', '8.200', 11, False),
        ((960, 120), 'avatars-dicebear/fun-emoji/png/heo.png', 'Heo Hồng', '15.6K', 9, True),
        ((1770, 520), 'avatars-dicebear/fun-emoji/png/gau.png', 'Gấu Bông', '3.050', 13, False),
    ]
    for (cx, cy), path, name, money, n, active in seats:
        avatar(cx, cy, path, active=active)
        nameplate(cx, cy + 78, name, money)
    opp_cards(330, 520, 11, rot=0)
    opp_cards(1120, 140, 9, rot=0)
    opp_cards(1590, 520, 13, rot=0)
    # centre: two pigs (2s) + "CHẶT HEO!" moment
    for path, cx, cy, r in ((deck['hearts']['2'], 900, 548, 10), (deck['diamonds']['2'], 1010, 542, -8)):
        paste_shadow_c(img, load(path, 140, rot=r), cx, cy, blur=6, alpha=0.3, offset=(0, 6))
    paste_shadow_c(img, load('emoji-fluent-3d/animals/pig_face.png', 120, rot=-8), 1165, 505, blur=6, alpha=0.25)
    paste_c(img, load('emoji-fluent-3d/symbols/collision.png', 150, rot=10), 765, 480)
    paste_c(img, load('emoji-fluent-3d/game/axe.png', 110, rot=-20), 805, 665)
    for (x, y, s) in ((630, 400, 70), (1300, 410, 60), (1240, 660, 56), (680, 650, 46)):
        paste_c(img, load('emoji-fluent-3d/symbols/sparkles.png', s), x, y)
    banner = Image.new('RGBA', (900, 200), (0, 0, 0, 0))
    bd = ImageDraw.Draw(banner)
    bd.text((450, 100), 'CHẶT HEO!', font=F_big, fill=(255, 92, 154), anchor='mm', stroke_width=12, stroke_fill=(255, 255, 255))
    banner = banner.rotate(-4, resample=Image.BICUBIC, expand=True)
    paste_shadow_c(img, banner, 960, 375, blur=10, alpha=0.35, offset=(0, 10))
    # reaction bubble near left player
    bub = Image.new('RGBA', (130, 130), (0, 0, 0, 0)); bbd = ImageDraw.Draw(bub)
    bbd.ellipse((4, 4, 120, 120), fill=(255, 255, 255, 245)); bbd.polygon([(20, 96), (6, 128), (52, 112)], fill=(255, 255, 255, 245))
    bub.alpha_composite(load('emoji-fluent-3d/reactions/loudly_crying_face.png', 84), (22, 20))
    paste_shadow_c(img, bub, 300, 390, blur=6, alpha=0.2)
    bub2 = Image.new('RGBA', (130, 130), (0, 0, 0, 0)); bbd = ImageDraw.Draw(bub2)
    bbd.ellipse((4, 4, 120, 120), fill=(255, 255, 255, 245)); bbd.polygon([(100, 96), (124, 128), (72, 112)], fill=(255, 255, 255, 245))
    bub2.alpha_composite(load('emoji-fluent-3d/reactions/face_with_tears_of_joy.png', 84), (22, 20))
    paste_shadow_c(img, bub2, 790, 92, blur=6, alpha=0.2)
    # my hand (13 cards fanned)
    hand = [('spades', '3'), ('clubs', '3'), ('diamonds', '4'), ('hearts', '5'), ('spades', '6'), ('clubs', '7'), ('hearts', '7'),
            ('diamonds', '8'), ('spades', '9'), ('hearts', '10'), ('clubs', 'J'), ('diamonds', 'Q'), ('spades', 'A')]
    n = len(hand)
    for i, (s, k) in enumerate(hand):
        t = (i - (n - 1) / 2)
        rot = -t * 3.2
        cx = 960 + t * 76
        cy = 912 + (t * t) * 1.3 - (36 if i in (5, 6) else 0)
        paste_shadow_c(img, load(deck[s][k], 140, rot=rot), cx, cy, blur=5, alpha=0.28, offset=(0, 5))
    # me
    avatar(200, 895, 'avatars-dicebear/fun-emoji/png/bong.png', ring=(255, 220, 90))
    nameplate(200, 1006 - 40, 'Bạn', '20.0K') if False else None
    me_plate = Image.new('RGBA', (200, 60), (0, 0, 0, 0)); md = ImageDraw.Draw(me_plate)
    md.rounded_rectangle((0, 0, 199, 59), 26, fill=(255, 255, 255, 235), outline=(201, 80, 127, 255), width=4)
    me_plate.alpha_composite(load(coin, 32), (20, 14))
    md.text((60, 31), '20.000', font=F_coin, fill=(214, 140, 20), anchor='lm')
    paste_shadow_c(img, me_plate, 200, 1030, blur=5, alpha=0.2)
    # action buttons (pastel jelly)
    for path, label, cx, cy in (('ui-jelly-pzuh/buttons-pastel/pink/wide_pink.png', 'Đánh', 1700, 880),
                                ('ui-jelly-pzuh/buttons/wide_grey.png', 'Bỏ lượt', 1700, 985)):
        b = load(path, 300)
        d2 = ImageDraw.Draw(b)
        d2.text((b.width / 2, b.height / 2 - 2), label, font=F_btn, fill='white', anchor='mm', stroke_width=4, stroke_fill=(150, 60, 100) if 'pink' in path else (110, 110, 120))
        paste_shadow_c(img, b, cx, cy, blur=6, alpha=0.25)
    # top bar
    for i, p in enumerate(('ui-jelly-pzuh/buttons-pastel/pink/icon_back_pink.png',)):
        paste_c(img, load(p, 92), 70, 62)
    for i, p in enumerate(('ui-jelly-pzuh/buttons-pastel/pink/icon_settings_pink.png', 'ui-jelly-pzuh/buttons-pastel/pink/icon_music_pink.png', 'ui-jelly-pzuh/buttons-pastel/pink/icon_users_pink.png')):
        paste_c(img, load(p, 92), 1850 - i * 104, 62)
    info = Image.new('RGBA', (330, 64), (0, 0, 0, 0)); idr = ImageDraw.Draw(info)
    idr.rounded_rectangle((0, 0, 329, 63), 30, fill=(255, 255, 255, 200), outline=(255, 255, 255, 255), width=3)
    info.alpha_composite(load('emoji-fluent-3d/tet/red_envelope.png', 44), (16, 10))
    idr.text((70, 33), 'Bàn 08 · Cược 1K', font=F_info, fill=(150, 60, 100), anchor='lm')
    paste_c(img, info, 300, 62)
    img.convert('RGB').save(ROOT / out, optimize=True)


mockup('sakura', 'demo-mockup.png')
mockup('tet', 'demo-mockup-tet.png')

# ------------------------------------------------------------------ kit overview image
def kit_overview():
    Wd = 1600
    rows = []
    rows.append(('Bàn chơi tự vẽ (7 theme) — CC0', [M['tables'][t]['scene'] for t in THEMES], 110, False))
    rows.append(('Nút jelly pastel (pzUH, CC0) — 9 màu', [f'ui-jelly-pzuh/buttons-pastel/{c}/icon_{n}_{c}.png' for c in ('pink', 'purple', 'yellow', 'mint', 'orange') for n in ('play', 'settings')] +
                 [f'ui-jelly-pzuh/buttons/icon_{n}_{c}.png' for c in ('blue', 'green', 'red') for n in ('home',)], 90, False))
    def _ok(p, minw=150, minh=150, lo=0.45, hi=2.3):
        with Image.open(A / p) as im:
            w, h = im.size
        return w >= minw and h >= minh and lo <= w / h <= hi
    rows.append(('Khung & bảng (pzUH)', [p for p in M['ui']['jelly']['windows'] if _ok(p, 300, 300)][:9], 130, False))
    rows.append(('Emoji 3D Fluent (MIT) — cảm xúc', M['emoji']['fluent_3d']['reactions'][:16], 84, False))
    rows.append(('Emoji 3D — Tết, đồ chơi, thú', M['emoji']['fluent_3d']['tet'][:6] + M['emoji']['fluent_3d']['game'][:5] + M['emoji']['fluent_3d']['animals'][:6], 84, False))
    for st in ('fun-emoji', 'big-smile', 'adventurer', 'lorelei', 'thumbs', 'croodles'):
        rows.append((f'Avatar DiceBear: {st} — {M["avatars"]["dicebear"][st]["license"].split(" — ")[0]}', M['avatars']['dicebear'][st]['png_256_round'][:14], 90, False))
    rows.append(('Avatar pixel Ninja Adventure (CC0)', M['avatars']['ninja_facesets']['files'][:24], 60, True))
    rows.append(('Nhân vật: thỏ & alien Kenney (CC0)', M['characters']['jumper_bunnies']['files'][::2] + [f for f in M['characters']['physics_aliens']['files'] if 'round' in f], 100, False))
    rows.append(('Coin, tiền, quà (Kenney / Fluent)', M['ui']['kenney_puzzle']['coins'][:10] + [f'characters-jumper-kenney/PNG/HUD/coin_{c}.png' for c in ('gold', 'silver', 'bronze')] + [f'emoji-fluent-3d/game/{n}.png' for n in ('coin', 'money_bag', 'gem_stone', 'crown', 'trophy', 'wrapped_gift')] + ['emoji-fluent-3d/tet/red_envelope.png'], 64, False))
    rows.append(('Emote pixel (Ninja) + bong bóng (Kenney)', M['emotes']['ninja']['files'][:16] + M['emotes']['kenney']['styles']['Vector/Style 3'][:6], 60, True))
    TH, PAD, LH = None, 12, 38
    total_h = sum(LH + h + PAD for _, _, h, _ in rows) + PAD
    canvas = Image.new('RGBA', (Wd, total_h), (255, 232, 241, 255))
    d = ImageDraw.Draw(canvas)
    F = font('CherryBombOne-Regular.ttf', 26)
    y = PAD
    for label, paths, h, px in rows:
        d.text((PAD, y), label, font=F, fill=(150, 50, 95))
        y += LH
        x = PAD
        for p in paths:
            try:
                im = Image.open(A / p).convert('RGBA')
            except Exception:
                warn.append(f'overview missing {p}'); continue
            s = h / im.height
            im = im.resize((max(1, round(im.width * s)), h), Image.NEAREST if px else Image.LANCZOS)
            if x + im.width > Wd - PAD:
                break
            canvas.alpha_composite(im, (x, y))
            x += im.width + 8
        y += h + PAD
    canvas.convert('RGB').save(ROOT / 'preview-cute-kit.png', optimize=True)


kit_overview()

# ------------------------------------------------------------------ preview.html
D = M['decks']
SUIT_ORDER = ['spades', 'hearts', 'diamonds', 'clubs']
SUIT_VI = {'spades': 'Bích ♠', 'hearts': 'Cơ ♥', 'diamonds': 'Rô ♦', 'clubs': 'Chuồn ♣'}
KEYS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SHOW_DECKS = ['cute', 'cute_outline', 'cute_pixel', 'kenney_flat', 'kenney_pixel_large', 'kerenel_pixel', 'sylly_large', 'mreliptik_white', 'mreliptik_black', 'mehrasaur_a_large', 'mehrasaur_b_large']
PIXEL = {'cute_pixel': 4, 'kenney_pixel_large': 2, 'kerenel_pixel': 2}


def src(p):
    return 'assets/' + quote(p)


_SIZE = {}


def isize(p):
    if p not in _SIZE:
        try:
            with Image.open(A / p) as im:
                _SIZE[p] = im.size
        except Exception:
            _SIZE[p] = (1, 1)
    return _SIZE[p]


def img(p, h=None, cls='', title=None):
    w0, h0 = isize(p)
    st = f' style="height:{h}px;width:{max(1, round(h * w0 / h0))}px"' if h else ''
    t = html.escape(title if title is not None else Path(p).stem)
    return f'<img loading="lazy" decoding="async" class="{cls}" src="{src(p)}" width="{w0}" height="{h0}" title="{t}" alt="{t}"{st}>'


def thumbs(paths, h=64, cls='', limit=None):
    return ''.join(img(p, h, cls) for p in (paths[:limit] if limit else paths))


def section(id_, title, meta, body, dark=False):
    return f'<section id="{id_}" class="{"dark" if dark else ""}"><h2>{title}</h2><p class="meta">{meta}</p>{body}</section>'


def row(label, content):
    return f'<div class="row"><span class="lab">{label}</span><div class="items">{content}</div></div>'


def path_code(p):
    return f'<code>assets/{html.escape(p)}</code>'


def deck_section(key):
    d = D[key]
    scale = PIXEL.get(key)
    h = (d['card_size'][1] * scale) if scale else min(130, d['card_size'][1])
    cls = 'px' if scale else ''
    first = next(iter(d['cards']['spades'].values()))
    body = ''.join(row(SUIT_VI[s], ''.join(img(d['cards'][s][k], h, cls) for k in KEYS if k in d['cards'][s])) for s in SUIT_ORDER)
    extras = ''.join(img(p, h, cls) for g in ('jokers', 'backs', 'other', 'hicontrast') for p in d.get(g, []))
    if extras:
        body += row('Joker / lưng', extras)
    meta = f'{html.escape(d["author"])} · {html.escape(d["license"])} · {d["card_size"][0]}×{d["card_size"][1]}px · {path_code(str(Path(first).parent))}'
    return section(key, html.escape(d['name']), meta, body)


def sound_buttons(paths, label_fn=lambda p: Path(p).stem):
    return ''.join(f'<button class="snd" data-src="{src(p)}" title="{html.escape(p)}">▶ {html.escape(label_fn(p))}</button>' for p in paths)


secs = []
secs.append(section('demo', 'Demo màn hình game ghép từ asset', 'Ảnh ghép hoàn toàn từ các file trong <code>assets/</code>: bàn sakura, bộ bài Cute, avatar DiceBear, emoji Fluent, nút jelly pastel, font Coiny &amp; Baloo 2.',
                    f'<img class="mock" src="demo-mockup.png" alt="mockup"><img class="mock" src="demo-mockup-tet.png" alt="mockup tết">'))
secs.append(section('tables', 'Bàn chơi pastel (tự vẽ, CC0)', '7 theme × 1920×1080: cảnh hoàn chỉnh, nền riêng, bàn trong suốt, tile họa tiết chất bài. ' + path_code('bg-tables-generated/'),
                    '<div class="grid">' + ''.join(f'<figure>{img(M["tables"][t]["scene"])}<figcaption>{t}</figcaption></figure>' for t in THEMES) + '</div>' +
                    row('Bàn trong suốt', thumbs([M['tables'][t]['table'] for t in THEMES], 90, 'chk')) +
                    row('Tile họa tiết', thumbs([M['tables'][t]['pattern_tile'] for t in THEMES], 90))))
secs += [deck_section(k) for k in SHOW_DECKS]
shots = sorted((ROOT / 'screenshots').glob('*.jpg'))
secs.insert(1, section('lobby', 'Sảnh game tương tác (lobby.html)', '<b>Mở <code>index.html</code>: thị trấn 3D có đăng nhập, 18 game (thêm Máy Đẩy Xu).</b> <b>Tiến Lên chơi thật đủ luật: mở <code>tien-len.html</code></b>. Mở <code>lobby.html</code> để xem bản đồ chọn game (bản sảnh 2D cũ: <code>lobby-classic.html</code>). Link nhanh: <code>lobby.html?game=bau-cua</code>, <code>?modal=profile</code>.',
                    '<div class="grid">' + ''.join(f'<figure><a href="lobby.html"><img loading="lazy" width="1920" height="1080" src="screenshots/{quote(p.name)}" alt="{html.escape(p.stem)}"></a><figcaption>{html.escape(p.stem[3:].replace("_", " "))}</figcaption></figure>' for p in shots) + '</div>'))
icons_html = '<div class="grid icons">' + ''.join(f'<figure>{img(M["games"][k]["lobby_icon"], 150)}<figcaption>{html.escape(v)}</figcaption></figure>' for k, v in GAME_NAMES.items()) + '</div>'
secs.append(section('icons17', 'Icon 18 game cho sảnh', '512×512, bo góc kiểu app. ' + path_code('games/lobby-icons/'), icons_html))
gb = ''
gb += row('Bầu Cua', thumbs(M['games']['bau-cua']['assets'].get('symbols', []), 70) + thumbs(M['games']['bau-cua']['assets'].get('tiles', []), 90) + thumbs(M['games']['bau-cua']['assets'].get('dice-3d', []), 90) + img('games/bau-cua/board_bau_cua.png', 150))
gb += row('Bát & đĩa', thumbs([p for v in M['games']['_shared']['plates_bowls'].values() for p in v], 90))
gb += row('Xóc Đĩa', thumbs([p for v in M['games']['xoc-dia']['assets'].values() for p in v if p.endswith('.png')], 90))
gb += row('Tài Xỉu', thumbs(M['games']['tai-xiu']['assets'].get('dice-3d', []), 90) + thumbs(M['games']['tai-xiu']['assets'].get('dice/white', []), 60) + thumbs(M['games']['tai-xiu']['assets'].get('dice/pink', []), 60) + img('games/tai-xiu/board_tai_xiu.png', 150))
gb += row('Cờ Tướng', img('games/co-tuong/preview_setup_classic.png', 260) + img('games/co-tuong/preview_setup_cute.png', 260) + thumbs(M['games']['co-tuong']['assets'].get('pieces-classic', []), 56) + thumbs(M['games']['co-tuong']['assets'].get('pieces-cute', []), 56))
gb += row('Cá Ngựa', img('games/co-ca-ngua/board.png', 260) + thumbs([p for p in M['games']['co-ca-ngua']['assets'].get('.', []) if 'token' in p], 80))
gb += row('Cờ Caro', thumbs([p for p in M['games']['co-caro']['assets'].get('.', []) if p.endswith('.png')], 90))
gb += row('Bài Màu', thumbs(M['games']['bai-mau']['assets'].get('cards', []), 90))
gb += row('Lô Tô', thumbs([p for p in M['games']['lo-to']['assets'].get('.', []) if p.endswith('.png')], 140) + thumbs(M['games']['lo-to']['assets'].get('balls', []), 40))
gb += row('Bắn Cá', thumbs([p for p in M['games']['ban-ca']['assets'].get('.', []) if p.endswith('.png')], 100))
gb += row('Chip & thẻ', thumbs([p for v in M['games']['_shared']['card_helpers'].values() for p in v], 64))
gb += row('Mậu Binh', img('games/mau-binh/arrangement_board.png', 180))
secs.append(section('gamekits', 'Bộ asset riêng cho từng game (tự vẽ, CC0)', 'Bầu Cua, Xóc Đĩa, Tài Xỉu, Cờ Tướng (2 kiểu), Cá Ngựa, Caro, Bài Màu (54 lá), Lô Tô (90 bóng + tờ dò), Bắn Cá, chip mệnh giá, thẻ Ăn/Phỏm/Heo… ' + path_code('games/'), gb))
P = M['ui']['premium']
pb = row('Nút kẹo', thumbs([p for p in P['buttons'] if '/labelled/' in p], 56) + thumbs([p for p in P['buttons'] if '/pill_' in p and 'pressed' not in p], 46))
pb += row('Khung avatar', thumbs(P['avatar-frames'], 110)) + row('Huy hiệu', thumbs(P['badges'], 70)) + row('Thanh trên', thumbs(P['topbar'], 56))
pb += row('Điều khiển', thumbs([p for p in P['controls'] if 'fill' not in p], 56)) + row('Quà ngày', thumbs(P['daily-reward'], 120))
pb += row('Popup', thumbs(P['panels'], 120) + thumbs(P['ribbons'], 60)) + row('Câu hô', thumbs(P['callouts'], 70))
pb += row('Nền sảnh', thumbs([p for p in P['lobby-backgrounds'] if '1920x1080' in p], 120) + thumbs([p for p in P['lobby-backgrounds'] if '1080x1920' in p], 160))
pb += row('Khác', thumbs([p for p in P['misc'] if 'timer_ring_0' not in p or p.endswith('_06.png')], 80))
secs.append(section('premium', 'UI cao cấp kiểu kẹo pastel (tự vẽ)', 'Nút 7 màu (có bản nhấn), popup, ruy băng, 8 khung avatar VIP, huy hiệu VIP 1–8, thanh tiền, công tắc, tab, thanh tiến trình, 7 thẻ quà ngày, 40 câu hô "CHẶT HEO!", "Ù!", "XÌ BÀNG!"…, 12 nền sảnh. ' + path_code('ui-premium-generated/'), pb))
ch3 = row('Fluent 3D', thumbs(M['characters']['fluent_3d']['files'], 72))
ch3 += ''.join(row(k, thumbs(v[::4], 90)) for k, v in M['characters']['kenney_toon'].items() if isinstance(v, list))
ch3 += ''.join(row(k, thumbs(v[::3], 80)) for k, v in M['characters']['kenney_platformer'].items() if isinstance(v, list))
secs.append(section('chars3d', 'Nhân vật xịn: 106 nhân vật 3D + toon có 45 tư thế', 'Fluent 3D (MIT): ninja, công chúa, tiên, pháp sư, siêu anh hùng, đầu bếp… · Kenney Toon 6 nhân vật × 45 tư thế · Kenney Platformer 5 × 24 tư thế. ' + path_code('emoji-fluent-3d/characters/') + ' ' + path_code('characters-toon-kenney/'), ch3))
M3 = M['models3d']
d3 = row('Avatar 3D', thumbs(M3['renders']['avatars'], 90)) + row('Toàn thân', thumbs(M3['renders']['full'], 120)) + row('Icon 3D', thumbs(M3['renders']['icons'], 70))
secs.append(section('models3d', f'Model 3D thật ({len(M3["glb"])} GLB, KayKit + Tiny Treats, CC0)', 'Nhân vật chibi có xương + hoạt ảnh, thú khối, xu, xúc xắc, đồng hồ cát, tim, sao, kim cương, đồ sân chơi. Có bản .glb cho Unity/Godot/Cocos, bản .js nhúng để three.js chạy từ file://, và ảnh render sẵn. Sảnh và Tiến Lên dùng trực tiếp qua <code>js/hc3d.js</code>. ' + path_code('3d/'), d3))
NAI = M['emoji']['noto_animated']['items']
na = '<div class="items">' + ''.join(f'<img loading="lazy" class="anim" src="{src(v["still"])}" data-anim="{src(v["webp"])}" title="{html.escape(k)}" width="128" height="128" style="height:72px;width:72px">' for k, v in NAI.items()) + '</div>'
secs.append(section('anim', f'Emoji động Noto ({len(NAI)} cái, Google, CC BY 4.0)', 'Rê chuột để xem chuyển động. Mỗi emoji có WebP động 512px, Lottie JSON, sprite sheet 96px + JSON thời gian khung, ảnh tĩnh 128px. ' + path_code('emoji-noto-animated/'), na))
jb = M['ui']['jelly']['buttons']
jelly_body = row('Nút chữ', thumbs(M['ui']['jelly']['extra'] + [p for c in jb for p in jb[c] if Path(p).stem.startswith(('wide_', 'square_'))], 64))
for c in ('pink', 'purple', 'yellow', 'mint', 'orange', 'blue', 'green', 'red', 'grey'):
    jelly_body += row(c, thumbs([p for p in jb[c] if Path(p).stem.startswith('icon_')], 52))
jelly_body += row('Khung / bảng', thumbs(M['ui']['jelly']['windows'], 120))
secs.append(section('jelly', 'Nút & khung jelly kawaii (pzUH, CC0)', '46 icon × 9 màu (4 màu gốc + 5 màu pastel mình đổi hue) + 63 khung, ruy băng, thanh máu, sao. Tên file: <code>icon_settings_pink.png</code>. ' + path_code('ui-jelly-pzuh/'), jelly_body))
secs.append(section('ui', 'UI Kenney (CC0)', 'Nút, slider, checkbox 5 màu + bóng, coin, hạt sáng của Puzzle Pack 2. ' + path_code('ui-kenney/') + ' ' + path_code('ui-puzzle-kenney/'),
                    row('UI Pack', thumbs([p for c in ('Blue', 'Red', 'Green', 'Yellow') for p in M['ui']['kenney']['colors'].get(c, []) if re.search(r'button_(rectangle|round|square)_depth_(gradient|flat)\.png$', p)], 52)) +
                    row('Coin', thumbs(M['ui']['kenney_puzzle']['coins'], 52)) + row('Bóng', thumbs(M['ui']['kenney_puzzle']['balls'], 44)) +
                    row('Hạt sáng', thumbs(M['ui']['kenney_puzzle']['particles'], 40)) + row('Ô hồng', thumbs(M['ui']['kenney_puzzle']['tiles_pink'][:24], 44))))
EMO_VI = {'reactions': 'Cảm xúc', 'hands': 'Bàn tay', 'symbols': 'Biểu tượng', 'game': 'Đồ chơi & thưởng', 'tet': 'Tết & đồ ăn', 'animals': 'Thú cưng', 'game-items': 'Vật phẩm game', 'sea': 'Sinh vật biển'}
secs.append(section('emoji', 'Emoji 3D Fluent (Microsoft, MIT)', f'{sum(len(v) for k, v in M["emoji"]["fluent_3d"].items() if isinstance(v, list) and k != "size")} emoji 256×256 PNG: thả cảm xúc, thưởng, lì xì, pháo, heo, sinh vật biển… ' + path_code('emoji-fluent-3d/'),
                    ''.join(row(EMO_VI[c], thumbs(M['emoji']['fluent_3d'][c], 56)) for c in EMO_VI)))
av_body = ''.join(row(f'{s}<small>{html.escape(v["license"].split(" — ")[0])}</small>', thumbs(v['png_256_round'], 72)) for s, v in M['avatars']['dicebear'].items())
av_body += row('Kenney thú', thumbs(M['avatars']['kenney_animals']['styles']['Round'] + M['avatars']['kenney_animals']['styles']['Square'], 72))
av_body += row('Ninja pixel', thumbs(M['avatars']['ninja_facesets']['files'], 64, 'px'))
av_body += row('Kenney thú mới', thumbs(M['avatars']['kenney_animals_remastered']['styles']['Round'], 72))
secs.append(section('avatars', 'Avatar người chơi', 'DiceBear 8 kiểu × 24 (PNG tròn nền pastel 256px + SVG trong suốt) · Kenney 10 thú × 8 kiểu · 91 chân dung pixel Ninja Adventure. ' + path_code('avatars-dicebear/'), av_body))
secs.append(section('characters', 'Nhân vật dễ thương (Kenney, CC0)', 'Thỏ Jumper, alien Physics, Shape Characters (ghép thân + mắt + miệng + tay). ' + path_code('characters-shapes-kenney/'),
                    row('Thỏ', thumbs(M['characters']['jumper_bunnies']['files'], 90)) + row('Alien', thumbs(M['characters']['physics_aliens']['files'], 80)) +
                    row('Shape (mẫu)', img('characters-shapes-kenney/Preview.png', 220) + img('characters-shapes-kenney/Sample.png', 220)) +
                    row('Shape (thân)', thumbs([p for p in M['characters']['shape_characters']['files'] if '_body_' in p], 60))))
secs.append(section('emotes', 'Emote & bong bóng chat', 'Kenney Emotes 30 × 8 kiểu · Ninja pixel emotes 30. ' + path_code('emotes-kenney/') + ' ' + path_code('emotes-ninja/'),
                    ''.join(row(st, thumbs(fs, 52, 'px' if st.startswith('Pixel') else '')) for st, fs in M['emotes']['kenney']['styles'].items() if st in ('Vector/Style 1', 'Vector/Style 3', 'Vector/Style 6', 'Pixel/Style 1')) +
                    row('Ninja', thumbs(M['emotes']['ninja']['files'], 52, 'px'))))
fx_body = row('Particle Pack', thumbs(M['fx']['kenney_particles']['files'], 64))
fx_body += ''.join(row(k, thumbs(v, 64)) for k, v in M['fx']['kenney_smoke'].items() if isinstance(v, list))
fx_body += row('Ninja FX', img('fx-ninja/AllPreview.png', 260, 'px') + img('fx-ninja/Particle/AllPreview.png', 200, 'px'))
secs.append(section('fx', 'Hiệu ứng: lấp lánh, khói, nổ, chém', 'Ảnh trắng trên nền trong suốt, tint màu trong engine. Dùng cho thắng ván, chặt heo, nổ pháo. ' + path_code('fx-particles-kenney/') + ' ' + path_code('fx-smoke-kenney/') + ' ' + path_code('fx-ninja/'), fx_body, dark=True))
secs.append(section('items', 'Vật phẩm, coin, chip, xúc xắc', 'Coin/cúp/rương pixel, đồ ăn pixel, coin & cà rốt thỏ, chip cute, xúc xắc. ' + path_code('items-ninja/'),
                    row('Treasure', thumbs(M['items']['ninja_treasure']['files'], 56, 'px')) + row('Food', thumbs(M['items']['ninja_food']['files'], 48, 'px')) +
                    row('Jumper', thumbs(M['items']['jumper_items']['files'], 56)) + row('Chip Cute', thumbs(M['chips']['cute']['files'], 60)) +
                    row('Xúc xắc', thumbs([p for p in M['dice']['kenney']['files'] if '_' not in Path(p).stem], 52))))
secs.append(section('icons', 'Icon & con trỏ (Kenney, CC0)', '105 game icon (đen/trắng, 1x/2x) · 255 board-game icon (64/128px + SVG) · 182 con trỏ chuột. ' + path_code('icons-game-kenney/') + ' ' + path_code('icons-boardgame-kenney/') + ' ' + path_code('cursors-kenney/'),
                    row('Game icons', thumbs(M['icons']['kenney_game_black_2x']['files'], 40)) + row('Board-game', thumbs(M['icons']['kenney_boardgame_128']['files'], 40)) +
                    row('Con trỏ', thumbs(M['cursors']['kenney']['basic'][:60], 32))))
secs.append(section('backgrounds', 'Nền phụ: mây, cảnh, pattern', 'Mây/đồi/cây Kenney để làm sảnh chờ, nền hồng icon của pzUH, 84 pattern tileable. ' + path_code('bg-clouds-kenney/') + ' ' + path_code('bg-patterns-kenney/'),
                    row('Mẫu cảnh', thumbs(M['backgrounds']['kenney_clouds_and_scenery']['samples'], 110)) + row('Mây & cây', thumbs([p for p in M['backgrounds']['kenney_clouds_and_scenery']['files'] if 'cloud' in p or 'tree' in p or 'hill' in p][:24], 56)) +
                    row('Nền jelly', img(M['backgrounds']['jelly_pink'], 140)) + row('Pattern', thumbs(M['backgrounds']['kenney_patterns']['files'], 44))))
mus = ''.join(f'<li><div><b>{html.escape(m["title"])}</b><small>{html.escape(m["author"])} · {html.escape(m["license"])} · {html.escape(m["mood"])}</small></div><audio controls preload="none" src="{src(m["file"])}"></audio></li>' for m in M['music'])
secs.append(section('music', f'Nhạc nền ({len(M["music"])} bài, CC0)', '8 bài vui tươi / chill / lofi từ OpenGameArt + 19 bài chọn lọc của Ninja Adventure (bỏ các bài u tối). ' + path_code('music-bgm/'), f'<ul class="music">{mus}</ul>'))
au = M['audio']
snd_rows = row('Gợi ý theo sự kiện', ''.join(f'<button class="snd ev" data-src="{src(p)}" title="{html.escape(p)}">▶ {html.escape(k)}</button>' for k, p in M['recommended']['sfx'].items()))
snd_rows += row('Casino (bài, chip)', sound_buttons(au['kenney_casino']['files']))
for k, lab in (('kenney_jingles', 'Jingle thắng/thua'), ('ninja_sfx', 'Ninja SFX')):
    for sub, fs in au[k].items():
        if isinstance(fs, list):
            snd_rows += row(f'{lab}: {sub}', sound_buttons(fs))
for k, lab in (('kenney_interface', 'Interface'), ('kenney_ui', 'UI click'), ('kenney_digital', 'Digital (power-up)'), ('kenney_impact', 'Va chạm')):
    snd_rows += row(lab, sound_buttons(au[k]['files']))
secs.append(section('sfx', 'Âm thanh hiệu ứng', 'Bấm để nghe. Kenney (.ogg) + Ninja Adventure (.wav), tất cả CC0. Hàng đầu là gợi ý gán sẵn cho game bài (cũng có trong <code>manifest.recommended.sfx</code>).', snd_rows))
font_faces, font_demo = [], []
ALL_FONTS = {'Baloo 2': 'fonts/Baloo2[wght].ttf', 'Nunito': 'fonts/Nunito[wght].ttf', **{n: v['file'] for n, v in M['fonts'].items() if n in FONTS_NEW or n in ('LXGW WenKai TC', 'ZCOOL KuaiLe')}}
for n, f in ALL_FONTS.items():
    font_faces.append(f'@font-face{{font-family:"{n}";src:url("{src(f)}") format("truetype");font-display:swap}}')
    use = M['fonts'][n]['use']
    sample = '帥仕相俥傌炮兵 · 楚河 漢界 · Cờ Tướng' if n == 'LXGW WenKai TC' else ('帅仕相车马炮兵 · 楚河 汉界' if n == 'ZCOOL KuaiLe' else 'Chặt heo nè! Tiến Lên Miền Nam 🐷 1.234.567đ')
    font_demo.append(f'<div class="fd"><p style="font-family:\'{n}\'">{sample}</p><small>{html.escape(n)} — {html.escape(use)} · {path_code(f)}</small></div>')
secs.append(section('fonts', f'Font tiếng Việt dễ thương ({len(ALL_FONTS)} font, OFL)', 'Tất cả đều có đủ dấu tiếng Việt, kèm file OFL.txt.', ''.join(font_demo)))
ORDER = ['demo', 'lobby', 'models3d', 'icons17', 'gamekits', 'premium', 'chars3d', 'anim', 'tables']
import re as _re
def _sid(x):
    m = _re.match(r'<section id="([^"]+)"', x)
    return m.group(1) if m else ''
secs = sorted(secs, key=lambda x: ORDER.index(_sid(x)) if _sid(x) in ORDER else len(ORDER))
nav_items = [('demo', 'Demo'), ('lobby', 'Sảnh game'), ('models3d', 'Model 3D'), ('icons17', 'Icon game'), ('gamekits', 'Asset từng game'), ('premium', 'UI cao cấp'), ('chars3d', 'Nhân vật 3D'), ('anim', 'Emoji động'), ('tables', 'Bàn chơi'), ('cute', 'Bộ bài'), ('jelly', 'Nút jelly'), ('ui', 'UI'), ('emoji', 'Emoji 3D'), ('avatars', 'Avatar'), ('characters', 'Nhân vật'),
             ('emotes', 'Emote'), ('fx', 'Hiệu ứng'), ('items', 'Coin & vật phẩm'), ('icons', 'Icon'), ('backgrounds', 'Nền phụ'), ('music', 'Nhạc nền'), ('sfx', 'Âm thanh'), ('fonts', 'Font')]
deck_nav = ''.join(f'<a href="#{k}">{html.escape(D[k]["name"])}</a>' for k in SHOW_DECKS)
page = f'''<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bộ asset bài dễ thương</title>
<style>
{''.join(font_faces)}
:root{{--bg:#ffe4ef;--card:#fffaf5;--ink:#2a1a1f;--pink:#ff5c9a;--line:#2a1a1f;--muted:#7a5a66}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:Nunito,system-ui,sans-serif;font-size:15px}}
header{{background:var(--pink);color:#fff;padding:26px 16px 22px;text-align:center}}header h1{{font-family:"Cherry Bomb One","Baloo 2";font-weight:400;font-size:46px;margin:0;line-height:1.1}}header p{{margin:8px 0 0}}
nav{{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;justify-content:center;position:sticky;top:0;background:#ffd1e3;z-index:5;border-bottom:3px solid var(--line)}}
nav a{{font-family:"Baloo 2";font-weight:700;background:#fff;color:var(--ink);text-decoration:none;padding:3px 12px;border-radius:999px;border:2px solid var(--ink);box-shadow:0 2px 0 var(--ink);font-size:13px}}
nav.decks{{position:static;background:none;border:0;padding:4px 16px 0}}nav.decks a{{font-size:12px;opacity:.85}}
main{{max-width:1500px;margin:0 auto;padding:12px 16px 40px}}
section{{background:var(--card);border:3px solid var(--line);border-radius:18px;padding:16px;margin:18px 0;box-shadow:0 6px 0 var(--line);scroll-margin-top:110px}}
section.dark{{background:#2b2233;color:#fbe9f2}}section.dark .meta{{color:#d9bfd0}}section.dark img{{background:transparent}}
h2{{font-family:"Cherry Bomb One","Baloo 2";font-weight:400;font-size:28px;margin:0 0 4px;color:var(--pink)}}.meta{{margin:0 0 12px;color:var(--muted)}}
code{{background:#ffd1e3;color:#6b2446;padding:1px 6px;border-radius:6px;font-size:12px;word-break:break-all}}
.row{{display:flex;gap:10px;align-items:flex-start;margin:8px 0}}.lab{{font-family:"Baloo 2";font-weight:800;min-width:118px;max-width:118px;color:var(--pink);padding-top:4px;line-height:1.1}}.lab small{{display:block;font-weight:600;font-size:11px;color:var(--muted)}}
.items{{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}}
img{{display:block;max-width:100%;height:auto;border-radius:6px;object-fit:contain}}img.px{{image-rendering:pixelated}}img.chk{{background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px}}
img.mock{{width:100%;height:auto;border-radius:14px;border:3px solid var(--line);margin:6px 0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}}.grid.icons{{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}.grid.icons img{{width:150px;height:150px;margin:auto}}figure{{margin:0}}figure img{{width:100%;height:auto}}figcaption{{font-family:"Baloo 2";font-weight:700;text-align:center}}
button.snd{{font:600 12px Nunito,sans-serif;border:2px solid var(--line);background:#fff;border-radius:999px;padding:3px 10px;cursor:pointer;box-shadow:0 2px 0 var(--line)}}button.snd:active{{transform:translateY(2px);box-shadow:none}}button.snd.playing{{background:var(--pink);color:#fff}}button.ev{{background:#fff1a8}}
ul.music{{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:8px}}ul.music li{{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#fff;border:2px solid #f3c5d8;border-radius:12px;padding:6px 10px}}ul.music small{{display:block;color:var(--muted);font-size:12px}}audio{{height:30px;width:210px;flex:none}}
.fd p{{font-size:34px;margin:10px 0 0;line-height:1.25}}.fd small{{color:var(--muted)}}
@media (max-width:640px){{header h1{{font-size:32px}}.row{{flex-direction:column;gap:4px}}.lab{{max-width:none}}ul.music{{grid-template-columns:1fr}}ul.music li{{flex-direction:column;align-items:flex-start}}audio{{width:100%}}.fd p{{font-size:26px}}}}
</style></head><body>
<header><h1>🐷 Bộ asset bài dễ thương</h1><p>18 game · {len(D)} biến thể bộ bài · sảnh game chơi thử · UI kẹo pastel · 560+ emoji & nhân vật 3D · 127 emoji động · 800+ avatar · {len(M["music"])} bài nhạc · 900+ âm thanh · {len(ALL_FONTS)} font</p></header>
<nav>{''.join(f'<a href="#{i}">{t}</a>' for i, t in nav_items)}</nav>
<main><nav class="decks">{deck_nav}</nav>
{''.join(secs)}
</main>
<script>
let cur=null,curBtn=null;
window.addEventListener('load',()=>{{if(location.hash){{const t=document.querySelector(location.hash);if(t)setTimeout(()=>t.scrollIntoView(),60);}}}});
document.querySelectorAll('img.anim').forEach(i=>{{const st=i.src;i.addEventListener('mouseenter',()=>i.src=i.dataset.anim);i.addEventListener('mouseleave',()=>i.src=st);}});
document.addEventListener('click',e=>{{const b=e.target.closest('button.snd');if(!b)return;
 if(cur){{cur.pause();curBtn&&curBtn.classList.remove('playing');}}
 if(curBtn===b){{cur=null;curBtn=null;return;}}
 cur=new Audio(b.dataset.src);curBtn=b;b.classList.add('playing');cur.play().catch(()=>{{}});cur.onended=()=>{{b.classList.remove('playing');cur=null;curBtn=null;}};}});
</script>
</body></html>'''
(ROOT / 'preview.html').write_text(page, encoding='utf-8')
print('manifest keys:', list(M))
print('music', len(M['music']), 'emoji', sum(len(v) for k, v in M['emoji']['fluent_3d'].items() if isinstance(v, list) and k != 'size'))
print('warnings:', warn)
