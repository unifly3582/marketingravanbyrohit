"""Web copies of the AI-agent frames for the hero's flip stage.
  python scripts/employees-frames.py
Reads assets-src/employees/<key>-wide.png / <key>-tall.png. The flat page
colour around the card is flood-filled away into transparency (from all four
corners, with a small tolerance so the chips' soft shadows survive), so what
turns in the hero is the card and its assets only, over a band painted the
same page colour. Writes 1200px-wide WebPs with alpha to site/src/assets/agents/
and prints each frame's page colour for data/agents.js."""
from PIL import Image, ImageDraw, ImageFilter
import glob, os
SRC = "assets-src/employees"; DST = "site/src/assets/agents"
os.makedirs(DST, exist_ok=True)
MARK = (255, 0, 255)  # the flood-fill marker; never occurs in the frames
for path in sorted(glob.glob(f"{SRC}/*-wide.png") + glob.glob(f"{SRC}/*-tall.png")):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert("RGB")
    W = 1200
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    corners = [(2, 2), (im.width - 3, 2), (2, im.height - 3), (im.width - 3, im.height - 3)]
    px = [im.getpixel(c) for c in corners]
    bg = tuple(sum(c[i] for c in px) // 4 for i in range(3))
    # flood the page area with the marker, then make it the alpha
    flood = im.copy()
    for c in corners:
        ImageDraw.floodfill(flood, c, MARK, thresh=22)
    # alpha = 0 where the marker is, 255 elsewhere
    alpha = Image.new("L", im.size, 255)
    data = flood.getdata()
    alpha.putdata([0 if p == MARK else 255 for p in data])
    # soften the cut by a pixel so the edge does not alias against the band
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    out_im = im.copy()
    out_im.putalpha(alpha)
    out = f"{DST}/{name}.webp"
    out_im.save(out, "WEBP", quality=86, method=6)
    cut = sum(1 for p in data if p == MARK) * 100 // (im.width * im.height)
    print(f"{name}.webp {out_im.size[0]}x{out_im.size[1]} {os.path.getsize(out)//1024} KB  page #{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}  cleared {cut}%")
