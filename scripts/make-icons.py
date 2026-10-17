# Rebuilds every app icon from assets-src/diary-icon-source.jpg (leather diary on white).
# Usage: python3 scripts/make-icons.py   (needs Pillow + numpy)
import numpy as np
from collections import deque
from PIL import Image, ImageDraw, ImageFilter
SRC = 'assets-src/diary-icon-source.jpg'
COVER = (217, 205, 184)     # warm paper tone behind maskable/apple icons (brown book pops on it)
COVER_HI = (243, 234, 214)

def cutout(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    near_white = (a.min(axis=2) >= 238)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x]: q.append((y, x)); seen[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not seen[y, x]: q.append((y, x)); seen[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near_white[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = Image.fromarray(np.where(seen, 0, 255).astype('uint8'), 'L')
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))  # trim halo, soften edge
    rgba = im.copy(); rgba.putalpha(alpha)
    return rgba.crop(rgba.getbbox())

def fit(img, box, pad_ratio):
    side = int(box * (1 - 2 * pad_ratio))
    s = min(side / img.width, side / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)

def canvas(size, bg=None):
    return Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))

def paste_center(base, img):
    base.alpha_composite(img, ((base.width - img.width) // 2, (base.height - img.height) // 2))
    return base

def leather_bg(size, rounded=False):
    g = Image.new('RGBA', (size, size), COVER + (255,))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = max(0.0, 1 - ((x - size * .3) ** 2 + (y - size * .25) ** 2) ** .5 / (size * .9))
            px[x, y] = tuple(int(COVER[i] + (COVER_HI[i] - COVER[i]) * t) for i in range(3)) + (255,)
    if rounded:
        m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), size // 5, fill=255)
        g.putalpha(m)
    return g

mark = cutout(SRC)
for size in (512, 192):
    paste_center(canvas(size), fit(mark, size, 0.04)).save(f'public/icon-{size}.png', optimize=True)
    # maskable: content inside the central 66% safe zone on solid leather
    paste_center(leather_bg(size), fit(mark, size, 0.17)).convert('RGB').save(f'public/icon-maskable-{size}.png', optimize=True)
paste_center(leather_bg(180), fit(mark, 180, 0.12)).convert('RGB').save('public/apple-touch-icon.png', optimize=True)
paste_center(canvas(32), fit(mark, 32, 0.0)).save('public/favicon-32.png', optimize=True)
fit(mark, 128, 0.0).save('public/brand-mark.png', optimize=True)
print('icons written; mark', mark.size)
