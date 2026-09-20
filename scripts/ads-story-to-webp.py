"""Web copies of the Meta Ads story pictures: lift the white point so the
paper stage can multiply them in, shrink, WebP.
  python scripts/ads-story-to-webp.py            -> all of assets-src/ads-story/*.png
  python scripts/ads-story-to-webp.py dice bulb  -> named ones"""
from PIL import Image, ImageOps
import glob, os, sys
SRC = "assets-src/ads-story"; DST = "site/src/assets/ads-story"
WIDE = {"crowd", "skyline", "walking"}
os.makedirs(DST, exist_ok=True)
names = sys.argv[1:] or [os.path.splitext(os.path.basename(p))[0] for p in sorted(glob.glob(f"{SRC}/*.png"))]
for name in names:
    im = Image.open(f"{SRC}/{name}.png").convert("L")  # the page is monochrome anyway
    if name != "handshake":
        im = im.point(lambda v: min(255, int(v * 255 / 236)))  # near-white -> white
    limit = 1600 if name in WIDE else 1200
    w, h = im.size
    if max(w, h) > limit:
        s = limit / max(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    out = f"{DST}/{name}.webp"
    im.save(out, "WEBP", quality=80, method=6)
    print(f"{name}.webp {im.size[0]}x{im.size[1]} {os.path.getsize(out)//1024} KB")
