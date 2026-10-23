"""Helpers for art you make yourself (AI image tools, Photoshop...) and drop into custom/.
- load_art(): open, remove a flat background (white or any plain colour touching the edges), trim the empty margin
- fit_square(): pad to a centred transparent square and resize, for sprites drawn on square planes
Many image generators cannot export real transparency, so a plain background is cut away automatically.
A fake "transparent" checkerboard cannot be cut: remove it first (remove.bg, Canva, Photoshop) or ask for a plain white background.
"""
import numpy as np
from PIL import Image, ImageFilter

try:
    from scipy import ndimage as _nd
except Exception:  # scipy is optional
    _nd = None

_WARNED = set()


def _warn(path, msg):
    if (path, msg) not in _WARNED:
        _WARNED.add((path, msg)); print(f'  ! {path}: {msg}')


def _edge_connected(mask):
    """Pixels of `mask` connected to the image border (4-neighbourhood)."""
    if _nd is not None:
        lab, n = _nd.label(mask)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        return np.isin(lab, list(edge))
    fill = np.zeros_like(mask)
    fill[0], fill[-1], fill[:, 0], fill[:, -1] = mask[0], mask[-1], mask[:, 0], mask[:, -1]
    while True:   # grow inside mask until it stops changing
        g = fill.copy()
        g[1:] |= fill[:-1]; g[:-1] |= fill[1:]; g[:, 1:] |= fill[:, :-1]; g[:, :-1] |= fill[:, 1:]
        g &= mask
        if (g == fill).all(): return fill
        fill = g


def remove_background(im, name='image', tol=42):
    """Make a plain background transparent. Images that already have transparent edges are returned unchanged."""
    im = im.convert('RGBA'); a = np.array(im)
    edges = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    if (edges[:, 3] < 128).mean() > .5:
        return im                                         # already cut out
    rgb = a[..., :3].astype(np.int32)
    border = edges[:, :3].astype(np.int32)
    bg = np.median(border, axis=0)
    if bg.min() < 170 and not (bg[0] > 200 and bg[2] > 200 and bg[1] < 120):
        return im                                         # a dark or coloured edge is part of the picture (full-bleed art), not a backdrop
    if (np.abs(border - bg).sum(1) < tol * 1.5).mean() < .6:
        _warn(name, 'nền không trơn (ảnh chụp, gradient hoặc ô caro giả) - tự xoá nền trước rồi lưu PNG trong suốt')
        return im
    close = np.abs(rgb - bg).sum(2) < tol
    bgmask = _edge_connected(close)
    alpha = np.where(bgmask, 0, 255).astype(np.uint8)
    al = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))   # eat the halo, soften
    out = im.copy(); out.putalpha(Image.fromarray(np.minimum(np.array(al), a[..., 3])))
    return out


def load_art(path, cut=True):
    """Open a user image as RGBA with the background removed and the empty margin trimmed."""
    im = Image.open(path)
    im = remove_background(im, str(path)) if cut else im.convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb:
        _warn(str(path), 'ảnh trong suốt hoàn toàn'); return im
    return im.crop(bb)


def fit_square(im, size, pad=.04):
    """Centre on a transparent square canvas (with a small margin) and resize to size x size."""
    side = int(max(im.size) * (1 + pad * 2))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)


def fit_box(im, w, h):
    """Scale to fit inside w x h (up or down), keeping the aspect ratio."""
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
