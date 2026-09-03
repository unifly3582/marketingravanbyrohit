"""Background-removal for the Jade Breeze bottle photo via border flood-fill keying.
Only near-white pixels CONNECTED TO THE IMAGE BORDER become transparent, so the
white pump cap (enclosed by darker edges) survives intact.
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = r"C:\Users\DELL\Downloads\theblossomgreen\test-out\jade-bottle-crop.png"
OUT = r"C:\Users\DELL\Downloads\theblossomgreen\bloom-green-landing\public\img\bottle-cutout.png"

img = Image.open(SRC).convert("RGB")
# crop off the sliver of product box on the left edge
img = img.crop((52, 0, img.width, img.height))
a = np.asarray(img).astype(np.int16)

# near-background = bright and low-saturation
brightness = a.mean(axis=2)
spread = a.max(axis=2) - a.min(axis=2)
candidate = (brightness > 226) & (spread < 14)

# flood fill from borders through candidate pixels
mask = np.zeros(candidate.shape, dtype=bool)
mask[0, :] = candidate[0, :]
mask[-1, :] = candidate[-1, :]
mask[:, 0] = candidate[:, 0]
mask[:, -1] = candidate[:, -1]
for _ in range(2000):
    grown = mask.copy()
    grown[1:, :] |= mask[:-1, :]
    grown[:-1, :] |= mask[1:, :]
    grown[:, 1:] |= mask[:, :-1]
    grown[:, :-1] |= mask[:, 1:]
    grown &= candidate
    if (grown == mask).all():
        break
    mask = grown

alpha = np.where(mask, 0, 255).astype(np.uint8)
# soften the cut edge by 1px
alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.1))

out = Image.merge("RGBA", (*img.split(), alpha_img))
# trim to content
bbox = out.getbbox()
out = out.crop(bbox)
out.save(OUT)
print(f"saved {OUT} {out.size}, bg removed: {mask.mean()*100:.0f}% of pixels")
