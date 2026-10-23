"""Put your own pictures into the game. Run from the project root after saving images into custom/ (see docs/PROMPTS.md):

    python3 -E tools/apply_custom.py            # everything
    python3 -E tools/apply_custom.py --no-map   # skip re-drawing the town map picture (needs Google Chrome)

  custom/cards/*             -> card deck            (tools/gen_cards.py builds all 52 cards with correct ranks)
  custom/icons/<game>.png    -> game icons           (tools/gen_icons.py adds the frame and the title)
  custom/bau-cua/<con>.png   -> Bầu Cua mascots      (tools/gen_games.py makes dice faces, tiles and the board)
  custom/ban-ca/ca.json      -> new Bắn Cá species   (images next to it; packed into assets/3d/js/tex_custom-fish.js)
  custom/assets/<path>       -> replaces assets/<path>, resized to the original's size
  custom/chips, custom/vip, custom/daily -> blank chip / VIP badge / reward art; the values and labels are written by the scripts
  custom/ban-ca/thay/<id>.png -> new art for a built-in Bắn Cá species
Sheets first: every custom/sheets/<name>.png (one 16:9 image holding many items) is cut into the files above (tools/art_sheets.py).
Then the 3D texture bundles are rebuilt and, when icons or cards changed, the town map picture is re-drawn.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, base64, io
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from PIL import Image
from custom_img import load_art, fit_square, fit_box
import art_sheets

C = ROOT / 'custom'
A = ROOT / 'assets'
PY = [sys.executable, '-E']
FISH_JS = A / '3d' / 'js' / 'tex_custom-fish.js'
BACKUP = C / '.goc'          # originals of assets/ files you replaced (restored when you delete your picture)


def run(*args):
    r = subprocess.run(list(args), cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if out: print('   ' + out.replace('\n', '\n   '))
    if r.returncode: sys.exit(f'Lỗi khi chạy {" ".join(map(str, args[1:3]))}')


def digest(folder, pattern='*.png'):
    h = hashlib.sha1()
    for p in sorted(Path(folder).glob(pattern)): h.update(p.name.encode()); h.update(p.read_bytes())
    return h.hexdigest()


def pngs(folder):
    return sorted(p for p in Path(folder).glob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')) if Path(folder).is_dir() else []


def override(src, dst):
    """Replace dst with the picture src, keeping dst's size and type (transparent images are fitted, opaque ones cover-cropped)."""
    if not dst.exists():
        alt = [p for p in dst.parent.glob(dst.stem + '.*')] if dst.parent.exists() else []
        if not alt:
            print(f'  ! {src.relative_to(ROOT)}: không có file gốc assets/{dst.relative_to(A)} - kiểm tra lại tên file'); return False
        dst = alt[0]
    keep = BACKUP / dst.relative_to(A)
    if not keep.exists(): keep.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(dst, keep)
    ref = Image.open(keep); size, has_alpha = ref.size, ref.mode in ('RGBA', 'LA', 'P')
    if has_alpha:
        im = fit_box(load_art(src), size[0], size[1])
        out = Image.new('RGBA', size, (0, 0, 0, 0)); out.alpha_composite(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
        a = Image.open(keep).convert('RGBA').getchannel('A')
        edge = [out.getpixel((x, y))[3] for x, y in ((1, size[1] // 2), (size[0] - 2, size[1] // 2), (size[0] // 2, 1), (size[0] // 2, size[1] - 2))]
        if min(edge) > 200:                                  # a picture that fills the box: keep the original's rounded corners
            from PIL import ImageChops
            out.putalpha(ImageChops.darker(out.getchannel('A'), a))
    else:
        im = drop_watermark(Image.open(src).convert('RGB')); k = max(size[0] / im.width, size[1] / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        x, y = (im.width - size[0]) // 2, (im.height - size[1]) // 2; out = im.crop((x, y, x + size[0], y + size[1]))
    if dst.suffix.lower() in ('.jpg', '.jpeg'): out.convert('RGB').save(dst, quality=90, optimize=True)
    else: out.save(dst, optimize=True)
    return True


def restore_originals():
    """Put back assets/ files whose replacement picture was deleted from custom/assets/."""
    n = 0
    if not BACKUP.is_dir(): return 0
    for keep in sorted(p for p in BACKUP.rglob('*') if p.is_file()):
        rel = keep.relative_to(BACKUP); src_dir = C / 'assets' / rel.parent
        if src_dir.is_dir() and any(p.stem == rel.stem for p in src_dir.iterdir() if p.is_file()): continue
        shutil.copy2(keep, A / rel); keep.unlink(); n += 1
    for d in sorted((p for p in BACKUP.rglob('*') if p.is_dir()), key=lambda p: -len(p.parts)):
        if not any(d.iterdir()): d.rmdir()
    return n


def drop_watermark(im):
    """Erase the small sparkle some image tools (Gemini) stamp near the bottom-right corner of wide pictures."""
    try:
        import cv2, numpy as np
    except Exception:
        return im
    if im.width / im.height < 1.5: return im
    a = np.array(im); s = im.width / 1376
    mk = np.zeros(a.shape[:2], np.uint8); cv2.circle(mk, (round(im.width - 100 * s), round(im.height - 98 * s)), round(30 * s), 255, -1)
    return Image.fromarray(cv2.inpaint(a, mk, 12, cv2.INPAINT_TELEA))


GENERATED = ('cards-heocon/', 'games/', 'ui-premium-generated/')   # rebuilt by the gen_*.py scripts


def custom_overrides(generated):
    base = C / 'assets'; n = 0
    if not base.is_dir(): return 0
    for src in sorted(base.rglob('*')):
        if not src.is_file() or src.name.startswith('.') or src.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
        rel = src.relative_to(base)
        if str(rel).startswith(GENERATED) != generated: continue
        n += override(src, A / rel)
    return n


def pack_fish():
    cfg = C / 'ban-ca' / 'ca.json'
    rows = json.loads(cfg.read_text(encoding='utf-8')) if cfg.exists() else []
    tex, defs, missing = [], [], []
    for r in rows:
        f = C / 'ban-ca' / str(r.get('file', ''))
        if not f.is_file(): missing.append(r.get('name') or r.get('file')); continue
        fid = 'cus_' + ''.join(ch if ch.isalnum() or ch == '_' else '_' for ch in str(r.get('id') or f.stem))
        im = fit_square(load_art(f), 512 if r.get('tier') in ('big', 'boss') else 384)
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        tex.append(f'T[{json.dumps(fid)}]="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}";')
        d = {k: r[k] for k in ('name', 'tier', 'mult', 'size', 'speed', 'weight', 'school', 'upright', 'faces') if k in r}
        defs.append(dict(d, id=fid, look=fid))
    looks = {}
    for f in pngs(C / 'ban-ca' / 'thay'):                               # new art for the built-in species (file name = species id)
        key = 'cus_old_' + f.stem
        im = fit_square(load_art(f), 448)
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        tex.append(f'T[{json.dumps(key)}]="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}";'); looks[f.stem] = key
    js = ('/* Your own Bắn Cá fish. Generated by tools/apply_custom.py from custom/ban-ca/ - do not edit by hand. */\n'
          '(function(){var T=window.HC_TEX=window.HC_TEX||{};\n' + '\n'.join(tex) +
          f'\nwindow.HC_CUSTOM_FISH={json.dumps(defs, ensure_ascii=False)};\nwindow.HC_CUSTOM_LOOKS={json.dumps(looks)};}})();\n')
    FISH_JS.write_text(js, encoding='utf-8')
    return len(defs), missing, len(looks)


def render_map():
    chrome = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    if not Path(chrome).exists():
        print('  ! không tìm thấy Google Chrome nên chưa vẽ lại bản đồ (đặt biến CHROME=đường_dẫn nếu có)'); return False
    with tempfile.TemporaryDirectory() as t:
        shot = Path(t) / 'map.png'
        subprocess.run(['bash', str(ROOT / 'tools' / 'shot.sh'), 'index.html', 'shot=1&screen=maprender', str(shot), '2400,2000', '40000'], capture_output=True)
        if not shot.exists(): print('  ! vẽ lại bản đồ không thành công'); return False
        Image.open(shot).convert('RGB').save(A / '3d' / 'renders' / 'town_map.jpg', quality=88, optimize=True)
    return True


def main():
    os.chdir(ROOT)
    no_map = '--no-map' in sys.argv
    watch = lambda: digest(A / 'games' / 'lobby-icons') + digest(A / 'cards-heocon' / 'cards') + digest(A / 'emoji-fluent-3d' / 'game')
    before = watch()
    if any(art_sheets.SHEETS_DIR.glob('*.*')):
        print('0/7 Cắt ảnh bảng trong custom/sheets/')
        art_sheets.cut_all()
    back = restore_originals()
    n = custom_overrides(generated=False)                                # emoji, buttons, avatars, tables: used by the scripts below
    print(f'1/7 Thay ảnh gốc trong assets/: {n} ảnh' + (f', trả lại {back} file gốc' if back else ''))
    print('2/7 Bộ bài' + (f' (dùng {len(pngs(C / "cards"))} ảnh trong custom/cards)' if pngs(C / 'cards') else ' (mặc định)'))
    run(*PY, 'tools/gen_cards.py', 'assets')
    print('3/7 Icon game' + (f' (dùng {len(pngs(C / "icons"))} hình trong custom/icons)' if pngs(C / 'icons') else ''))
    run(*PY, 'tools/gen_icons.py', 'assets')
    print('4/7 Asset game và giao diện (Bầu Cua, phỉnh, VIP, quà ngày…)')
    run(*PY, 'tools/gen_games.py', 'assets')
    run(*PY, 'tools/gen_ui.py', 'assets')
    m = custom_overrides(generated=True)
    print(f'5/7 Thay ảnh trong phần được sinh lại: {m} ảnh')
    k, missing, old = pack_fish()
    print(f'6/7 Bắn Cá: {k} loài mới' + (f' (còn {len(missing)} loài chưa có ảnh)' if missing else '') + (f', vẽ lại {old} loài có sẵn' if old else ''))
    run(*PY, 'tools/pack_tex.py', 'assets')
    if watch() != before and not no_map:
        print('7/7 Vẽ lại bản đồ thị trấn (khoảng 1 phút)…'); render_map()
    else:
        print('7/7 Bản đồ thị trấn: ' + ('bỏ qua (--no-map)' if no_map else 'không cần vẽ lại'))
    print('Xong. Mở index.html hoặc play3d.html?game=ban-ca để xem.')


if __name__ == '__main__':
    main()
