"""Small drawing toolkit for cute/candy game art with Pillow + numpy (supersampled)."""
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

SS = 3

PAL = {
    'pink': ('#ffd1e3', '#ff6fa8', '#c2407a'),
    'mint': ('#c9f6e6', '#3ccf9b', '#1f9a70'),
    'sky': ('#d3ecff', '#4fb3ff', '#2a7fd0'),
    'lemon': ('#fff1c2', '#ffc93c', '#d99a00'),
    'lavender': ('#e6dcff', '#a07bff', '#6c4bd1'),
    'peach': ('#ffe1cf', '#ff9e6b', '#d06a35'),
    'grey': ('#ecebf0', '#b8b2c2', '#8a8496'),
    'gold': ('#fff3c4', '#ffcf4a', '#c58a00'),
    'red': ('#ffd6d6', '#ff5a5a', '#c22f3a'),
    'cream': ('#fffaf0', '#fbe8c8', '#d9b47c'),
}


def rgb(h, a=255):
    if isinstance(h, tuple):
        return h if len(h) == 4 else (*h, a)
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(c1, c2, t):
    c1, c2 = rgb(c1), rgb(c2)
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def new(w, h, color=(0, 0, 0, 0)):
    return Image.new('RGBA', (w, h), color)


def down(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


def lin_grad(w, h, c_top, c_bot, horizontal=False):
    t = np.linspace(0, 1, w if horizontal else h)
    a, b = np.array(rgb(c_top), float), np.array(rgb(c_bot), float)
    line = a[None, :] * (1 - t[:, None]) + b[None, :] * t[:, None]
    arr = np.repeat(line[None, :, :], h, 0) if horizontal else np.repeat(line[:, None, :], w, 1)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def rad_grad(w, h, c_in, c_out, cx=0.5, cy=0.5, rx=0.7, ry=0.7, power=1.0):
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt(((x / w - cx) / rx) ** 2 + ((y / h - cy) / ry) ** 2)
    t = np.clip(d, 0, 1) ** power
    a, b = np.array(rgb(c_in), float), np.array(rgb(c_out), float)
    arr = a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None]
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def mask_rr(w, h, box, r):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
    return m


def mask_ellipse(w, h, box):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    return m


def fill_mask(base, src, mask):
    """alpha-composite src onto base through mask (L)."""
    layer = src.copy()
    a = ImageChops.multiply(layer.split()[3], mask)
    layer.putalpha(a)
    base.alpha_composite(layer)


def solid(w, h, color):
    return Image.new('RGBA', (w, h), rgb(color))


def shadow(im, blur=10, alpha=0.35, color=(80, 30, 60), spread=0):
    a = im.split()[3]
    if spread:
        a = a.filter(ImageFilter.MaxFilter(spread * 2 + 1))
    a = a.point(lambda v: int(v * alpha))
    pad = blur * 3
    out = new(im.width + 2 * pad, im.height + 2 * pad)
    s = Image.new('RGBA', im.size, rgb(color)); s.putalpha(a)
    out.alpha_composite(s, (pad, pad))
    return out.filter(ImageFilter.GaussianBlur(blur)), pad


def with_shadow(im, blur=10, alpha=0.35, dy=8, dx=0, color=(80, 30, 60)):
    sh, pad = shadow(im, blur, alpha, color)
    out = new(im.width + 2 * pad, im.height + 2 * pad)
    out.alpha_composite(sh, (dx, dy))
    out.alpha_composite(im, (pad, pad))
    return out.crop(out.getbbox())


def candy_rr(w, h, color, radius=None, depth=None, gloss=True, outline=None, outline_w=0, dot=True):
    """Glossy candy rounded-rect (final size w x h, includes depth)."""
    light, base, dark = (rgb(c) for c in PAL[color]) if color in PAL else (rgb(color[0]), rgb(color[1]), rgb(color[2]))
    W, H = w * SS, h * SS
    r = (radius if radius is not None else min(w, h) * 0.3) * SS
    dp = (depth if depth is not None else max(3, h * 0.08)) * SS
    ow = outline_w * SS
    im = new(W, H)
    body_box = (ow, ow, W - 1 - ow, H - 1 - dp - ow)
    if outline:
        ImageDraw.Draw(im).rounded_rectangle((0, 0, W - 1, H - 1), radius=r + ow, fill=rgb(outline))
    # depth
    fill_mask(im, solid(W, H, dark), mask_rr(W, H, (ow, ow + dp, W - 1 - ow, H - 1 - ow), r))
    # body
    fill_mask(im, lin_grad(W, H, mix(light, base, 0.35), base), mask_rr(W, H, body_box, r))
    if gloss:
        bh = body_box[3] - body_box[1]
        gl = mask_rr(W, H, (body_box[0] + r * 0.35, body_box[1] + bh * 0.07, body_box[2] - r * 0.35, body_box[1] + bh * 0.5), r * 0.7)
        g = lin_grad(W, H, (255, 255, 255, 150), (255, 255, 255, 20))
        fill_mask(im, g, gl)
    if dot:
        rr = min(W, H) * 0.06
        cx, cy = body_box[0] + r * 0.55, body_box[1] + r * 0.5
        ImageDraw.Draw(im).ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(255, 255, 255, 220))
    return down(im, w, h)


def candy_circle(d, color, depth=None, gloss=True, ring=None, ring_w=0):
    light, base, dark = (rgb(c) for c in PAL[color]) if color in PAL else (rgb(color[0]), rgb(color[1]), rgb(color[2]))
    D = d * SS
    dp = (depth if depth is not None else d * 0.06) * SS
    im = new(D, D)
    rw = ring_w * SS
    if ring:
        ImageDraw.Draw(im).ellipse((0, 0, D - 1, D - 1 - dp), fill=rgb(ring))
        ImageDraw.Draw(im).ellipse((0, dp, D - 1, D - 1), fill=rgb(ring))
    fill_mask(im, solid(D, D, dark), mask_ellipse(D, D, (rw, rw + dp, D - 1 - rw, D - 1 - rw)))
    fill_mask(im, rad_grad(D, D, mix(light, base, 0.2), base, 0.4, 0.3, 0.8, 0.8, 1.2), mask_ellipse(D, D, (rw, rw, D - 1 - rw, D - 1 - dp - rw)))
    if gloss:
        fill_mask(im, lin_grad(D, D, (255, 255, 255, 170), (255, 255, 255, 0)), mask_ellipse(D, D, (D * 0.2, D * 0.08, D * 0.8, D * 0.5)))
    return down(im, d, d)


def font(path, size, variation=None):
    f = ImageFont.truetype(str(path), size)
    if variation:
        try:
            f.set_variation_by_name(variation)
        except Exception:
            pass
    return f


def text_mask(text, fnt, stroke=0, anchor_pad=20):
    bbox = fnt.getbbox(text, stroke_width=stroke)
    w, h = bbox[2] - bbox[0] + 2 * anchor_pad, bbox[3] - bbox[1] + 2 * anchor_pad
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).text((anchor_pad - bbox[0], anchor_pad - bbox[1]), text, font=fnt, fill=255, stroke_width=stroke, stroke_fill=255)
    return m


def fancy_text(text, fnt, fill=('#fff27a', '#ff9e2c'), inner='#a5205a', inner_w=None, outer='#ffffff', outer_w=None,
               shadow_alpha=0.35, gloss=True):
    """Big game callout text: gradient fill, dark inner stroke, white outer stroke, soft shadow."""
    size = fnt.size
    iw = inner_w if inner_w is not None else max(2, size // 11)
    ow = outer_w if outer_w is not None else max(3, size // 7)
    pad = ow + 30
    m_outer = text_mask(text, fnt, iw + ow, pad)
    W, H = m_outer.size
    m_inner = _aligned(text, fnt, iw, pad, W, H, iw + ow)
    m_fill = _aligned(text, fnt, 0, pad, W, H, iw + ow)
    im = new(W, H)
    o = Image.new('RGBA', (W, H), rgb(outer)); o.putalpha(m_outer); im.alpha_composite(o)
    i = Image.new('RGBA', (W, H), rgb(inner)); i.putalpha(m_inner); im.alpha_composite(i)
    bb = m_fill.getbbox() or (0, 0, W, H)
    g = new(W, H)
    g.alpha_composite(lin_grad(W, bb[3] - bb[1] + 1, fill[0], fill[1]), (0, bb[1]))
    g.putalpha(m_fill); im.alpha_composite(g)
    if gloss:
        hl = lin_grad(W, H, (255, 255, 255, 120), (255, 255, 255, 0))
        hm = ImageChops.multiply(m_fill, Image.fromarray((np.linspace(1, 0, H)[:, None] > 0.55).repeat(W, 1).astype(np.uint8) * 255, 'L'))
        hl.putalpha(ImageChops.multiply(hl.split()[3], hm)); im.alpha_composite(hl)
    out = with_shadow(im, blur=max(4, size // 18), alpha=shadow_alpha, dy=max(3, size // 14), color=(90, 20, 60))
    return out


def _aligned(text, fnt, stroke, pad, W, H, ref_stroke):
    """Render mask with given stroke but positioned like the ref_stroke mask."""
    bbox = fnt.getbbox(text, stroke_width=ref_stroke)
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).text((pad - bbox[0], pad - bbox[1]), text, font=fnt, fill=255, stroke_width=stroke, stroke_fill=255)
    return m


def paste_c(base, im, cx, cy):
    base.alpha_composite(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2))))


def load(path, w=None, h=None, rot=0):
    im = Image.open(path).convert('RGBA')
    if w or h:
        s = (w / im.width) if w else (h / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    return im


def tint(im, color):
    """Multiply-tint a white/grey sprite with a colour, keep alpha."""
    c = Image.new('RGBA', im.size, rgb(color))
    out = ImageChops.multiply(im.convert('RGBA'), c)
    out.putalpha(im.split()[3])
    return out


def save(im, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    return path
