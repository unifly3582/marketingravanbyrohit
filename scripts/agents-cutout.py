"""Cut the agent portraits out of their black backgrounds (rembg, isnet) and
write transparent WebPs for the site.
  python scripts/agents-cutout.py            -> all of assets-src/agents/*.png
Sources with alpha land in assets-src/agents-cut/, web copies (720px WebP,
alpha) in site/src/assets/agents/."""
from rembg import remove, new_session
from PIL import Image
import glob, os, sys
SRC = "assets-src/agents"; CUT = "assets-src/agents-cut"; DST = "site/src/assets/agents"
os.makedirs(CUT, exist_ok=True); os.makedirs(DST, exist_ok=True)
sess = new_session("isnet-general-use")
names = sys.argv[1:] or [os.path.splitext(os.path.basename(p))[0] for p in sorted(glob.glob(f"{SRC}/*.png"))]
for name in names:
    im = Image.open(f"{SRC}/{name}.png").convert("RGB")
    cut = remove(im, session=sess)
    cut.save(f"{CUT}/{name}.png")
    web = cut.resize((720, 720), Image.LANCZOS)
    out = f"{DST}/{name}.webp"
    web.save(out, "WEBP", quality=84, method=6)
    print(f"{name}.webp {os.path.getsize(out)//1024} KB")
