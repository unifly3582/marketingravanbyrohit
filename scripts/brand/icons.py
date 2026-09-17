# Favicons, app icons and site logo files from the transparent mark.
#   python scripts/brand/icons.py
from PIL import Image
import os

MARK = 'assets-src/logo/mark.png'
GROUND = (13, 9, 7, 255)
OUT = 'brand-kit/web'
SITE = 'site/public'
os.makedirs(OUT, exist_ok=True); os.makedirs(f'{SITE}/brand', exist_ok=True)

mark = Image.open(MARK).convert('RGBA')

def fit(size, pad, bg=None, circle=False):
    """Mark scaled to fit a size x size box with `pad` px margin."""
    cv = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    box = size - 2 * pad
    m = mark.copy(); m.thumbnail((box, box), Image.LANCZOS)
    cv.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    if circle:
        from PIL import ImageDraw
        msk = Image.new('L', (size, size), 0); ImageDraw.Draw(msk).ellipse([0, 0, size - 1, size - 1], fill=255)
        cv.putalpha(msk)
    return cv

# favicon family (mark on the dark ground so it reads on any tab colour)
for s in (16, 32, 48, 64, 96, 128, 256):
    fit(s, max(1, s // 12), GROUND).save(f'{OUT}/favicon-{s}.png')
fit(180, 14, GROUND).save(f'{OUT}/apple-touch-icon-180.png')
fit(192, 14, GROUND).save(f'{OUT}/icon-192.png')
fit(512, 36, GROUND).save(f'{OUT}/icon-512.png')
fit(512, 96, GROUND).save(f'{OUT}/icon-maskable-512.png')   # safe zone for Android masks
Image.open(f'{OUT}/favicon-256.png').save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# transparent mark exports
for s in (256, 512, 1024, 2048):
    m = mark.copy(); m.thumbnail((s, s), Image.LANCZOS); m.save(f'brand-kit/logo/mark-{s}.png')
mark.save('brand-kit/logo/mark-master.png')

# site files
fit(128, 8, GROUND).save(f'{SITE}/favicon.png')
fit(180, 14, GROUND).save(f'{SITE}/apple-touch-icon.png')
fit(192, 14, GROUND).save(f'{SITE}/icon-192.png')
fit(512, 36, GROUND).save(f'{SITE}/icon-512.png')
m = mark.copy(); m.thumbnail((512, 512), Image.LANCZOS); m.save('site/src/assets/logo-mark.png')
m = mark.copy(); m.thumbnail((160, 160), Image.LANCZOS); m.save(f'{SITE}/brand/mark-160.png')
print('icons done')
