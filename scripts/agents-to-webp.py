"""Shrink the nano-banana agent portraits for the site: 720px WebP, black bg.
Run: python scripts/agents-to-webp.py"""
from PIL import Image
import glob, os
SRC = "assets-src/agents"; DST = "site/src/assets/agents"
os.makedirs(DST, exist_ok=True)
for f in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    name = os.path.splitext(os.path.basename(f))[0]
    out = os.path.join(DST, name + ".webp")
    im = Image.open(f).convert("RGB").resize((720, 720), Image.LANCZOS)
    im.save(out, "WEBP", quality=82, method=6)
    print(f"{name}.webp {os.path.getsize(out)//1024} KB")
