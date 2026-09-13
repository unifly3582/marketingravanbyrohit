"""Shrink the generated website mockups for the head stack card.

assets-src/web-mockups/*.png  ->  site/src/assets/web-mockups/*.webp
720px wide (the card is at most 420px wide, shown on 2x screens), quality 82.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'web-mockups'
DST = ROOT / 'site' / 'src' / 'assets' / 'web-mockups'
DST.mkdir(parents=True, exist_ok=True)
W = 720

for png in sorted(SRC.glob('*.png')):
    im = Image.open(png).convert('RGB')
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    out = DST / (png.stem + '.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    print(f'{out.name}: {W}x{h}, {out.stat().st_size // 1024} KB')
