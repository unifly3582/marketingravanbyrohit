"""Shrink the Website Development page pictures for the web.

    python scripts/webdev-to-webp.py

assets-src/webdev/*.png  ->  site/src/assets/webdev/*.webp
wall-*   480px wide (the wall shows them at most ~200px wide, 2x screens)
card-*   512px square (inside a sticker at most ~260px)
detail-* 720px wide (a stage-tall card)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'webdev'
DST = ROOT / 'site' / 'src' / 'assets' / 'webdev'
DST.mkdir(parents=True, exist_ok=True)
WIDTH = {'wall': 480, 'card': 512, 'detail': 720}

for png in sorted(SRC.glob('*.png')):
    W = WIDTH[png.stem.split('-')[0]]
    im = Image.open(png).convert('RGB')
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    out = DST / (png.stem + '.webp')
    im.save(out, 'WEBP', quality=80, method=6)
    print(f'{out.name}: {W}x{h}, {out.stat().st_size // 1024} KB')
