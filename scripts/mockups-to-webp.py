"""Shrink a set of generated mockups for the head-stack cards.

    python scripts/mockups-to-webp.py web
    python scripts/mockups-to-webp.py ads

assets-src/<set>-mockups/*.png  ->  site/src/assets/<set>-mockups/*.webp
720px wide (the card is at most 420px wide, shown on 2x screens), quality 82.
"""
import sys
from pathlib import Path
from PIL import Image

if len(sys.argv) < 2:
    sys.exit('usage: mockups-to-webp.py <set>')
name = sys.argv[1]
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / f'{name}-mockups'
DST = ROOT / 'site' / 'src' / 'assets' / f'{name}-mockups'
DST.mkdir(parents=True, exist_ok=True)
W = 720

for png in sorted(SRC.glob('*.png')):
    im = Image.open(png).convert('RGB')
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    out = DST / (png.stem + '.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    print(f'{out.name}: {W}x{h}, {out.stat().st_size // 1024} KB')
