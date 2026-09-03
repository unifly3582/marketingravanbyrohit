"""Key the white background off the generated botanical props."""
import sys
import numpy as np
from PIL import Image, ImageFilter

JOBS = [
    (r"C:\Users\DELL\Downloads\theblossomgreen\test-out\branch-raw.png",
     r"C:\Users\DELL\Downloads\theblossomgreen\bloom-green-landing\public\img\branch.png"),
    (r"C:\Users\DELL\Downloads\theblossomgreen\test-out\jasmine-raw.png",
     r"C:\Users\DELL\Downloads\theblossomgreen\bloom-green-landing\public\img\jasmine.png"),
]

for src, dst in JOBS:
    img = Image.open(src).convert("RGB")
    if img.width > 900:
        img = img.resize((900, int(img.height * 900 / img.width)), Image.LANCZOS)
    a = np.asarray(img).astype(np.int16)
    brightness = a.mean(axis=2)
    spread = a.max(axis=2) - a.min(axis=2)
    candidate = (brightness > 232) & (spread < 16)

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
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.0))
    out = Image.merge("RGBA", (*img.split(), alpha_img))
    out = out.crop(out.getbbox())
    out.save(dst)
    print(f"{dst.split(chr(92))[-1]}: {out.size}, keyed {mask.mean()*100:.0f}%")
