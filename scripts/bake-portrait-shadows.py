"""
Bake the hero's contact shadow into the ten portrait cut-outs.

The hero used to draw `filter: drop-shadow(0 26px 40px rgba(28,17,9,.35))` on
each face in CSS. Every face swap (ten a second) re-blurred a 720px alpha
mask on the phone's GPU, which is a good part of why the hero stuttered on
low-end phones. The shadow is a fixed look, so it is painted once, here, into
the WebP files the site serves from site/public/agents.

  python scripts/bake-portrait-shadows.py            # all ten picks
  python scripts/bake-portrait-shadows.py sdr voice  # some of them

Source: site/src/assets/agents/<icon>-3.webp (the locked-frame takes, see
site/src/lib/portraits.js). Output: site/public/agents/<icon>-3.webp.
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'site'
SRC = ROOT / 'src' / 'assets' / 'agents'
OUT = ROOT / 'public' / 'agents'
PICKS = ['uiux', 'ads', 'social', 'campaign', 'sdr', 'voice', 'ecom', 'erp', 'agent', 'geo']

# the CSS shadow, scaled from the ~590px on-screen face to the 720px file
OFFSET_Y = 24      # px down
BLUR = 22          # gaussian radius (CSS 40px blur ~ sigma 20 -> ~22 at file scale)
COLOR = (28, 17, 9)
OPACITY = 0.35
QUALITY = 76


def bake(icon: str) -> None:
    src = SRC / f'{icon}-3.webp'
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A')
    # the shadow: the silhouette, shifted down, blurred, tinted, at 35%
    shadow_a = Image.new('L', (w, h), 0)
    shadow_a.paste(alpha, (0, OFFSET_Y))
    shadow_a = shadow_a.filter(ImageFilter.GaussianBlur(BLUR)).point(lambda v: int(v * OPACITY))
    shadow = Image.new('RGBA', (w, h), COLOR + (0,))
    shadow.putalpha(shadow_a)
    out = Image.alpha_composite(shadow, im)
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f'{icon}-3.webp'
    out.save(dst, 'WEBP', quality=QUALITY, method=6)
    print(f'{icon:9} {dst.stat().st_size // 1024:4d} kB')


if __name__ == '__main__':
    for icon in (sys.argv[1:] or PICKS):
        bake(icon)
