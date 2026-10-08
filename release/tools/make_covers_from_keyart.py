# Builds every cover in release/images/ from the key art (release/source/key_art_1672x941.png).
# Usage: python3 release/tools/make_covers_from_keyart.py   (needs Pillow)
from PIL import Image, ImageFilter, ImageEnhance
import os
HERE = os.path.dirname(os.path.abspath(__file__)); REL = os.path.dirname(HERE)
src = Image.open(os.path.join(REL, 'source', 'key_art_1672x941.png')).convert('RGB')
W, H = src.size
out = os.path.join(REL, 'images'); os.makedirs(out, exist_ok=True)
LOGO_CX = 0.5  # the wordmark is centred horizontally in the key art

def fit(w, h):  # landscape 16:9: plain high-quality resize
    return src.resize((w, h), Image.LANCZOS)

def square(sz):  # full height, centred on the wordmark (the logo fits inside)
    x0 = int(W * LOGO_CX - H / 2)
    return src.crop((x0, 0, x0 + H, H)).resize((sz, sz), Image.LANCZOS)

def portrait(w, h, feather=90, logo_frac=0.92):
    # sharp band: the whole key art scaled so the wordmark (~47% of the art's width) fills ~92% of the portrait width
    s = logo_frac * w / (W * 0.47)
    sw, sh = int(W * s), int(H * s)
    band = src.resize((sw, sh), Image.LANCZOS)
    band = band.crop(((sw - w) // 2, 0, (sw - w) // 2 + w, sh))
    y0 = (h - sh) // 2
    canvas = Image.new('RGB', (w, h))
    # above: a clean sky gradient in the art's own sky colours (stretching pixels smeared the towers into streaks)
    def avg(img):
        return img.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    top_c = avg(band.crop((0, 0, w, 6)))
    deep_c = tuple(int(c * 0.78) for c in top_c)  # a deeper blue higher up
    sky = Image.new('RGB', (w, y0 + feather))
    sp = sky.load()
    for y in range(sky.height):
        t = y / max(1, sky.height - 1)
        col = tuple(int(deep_c[i] + (top_c[i] - deep_c[i]) * t) for i in range(3))
        for x in range(w): sp[x, y] = col
    canvas.paste(sky, (0, 0))
    # below: the lava, mirrored downward and softly blurred (the lava sea continues)
    lava = band.crop((0, sh - (h - y0 - sh) - feather, w, sh)).transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(5))
    lava = ImageEnhance.Brightness(lava).enhance(0.85)
    canvas.paste(lava, (0, y0 + sh - feather))
    # feathered top/bottom edges of the band
    mask = Image.new('L', band.size, 255); px = mask.load()
    for y in range(band.height):
        a = min(1, y / feather, (band.height - 1 - y) / feather)
        v = int(255 * max(0, a))
        for x in range(band.width): px[x, y] = v
    canvas.paste(band, (0, y0), mask)
    return canvas

fit(1920, 1080).save(os.path.join(out, 'cover_1920x1080.png'), optimize=True)
fit(1280, 720).save(os.path.join(out, 'cover_1280x720.png'), optimize=True)
square(800).save(os.path.join(out, 'cover_square_800x800.png'), optimize=True)
portrait(800, 1200).save(os.path.join(out, 'cover_portrait_800x1200.png'), optimize=True)
print('covers written to', out)
