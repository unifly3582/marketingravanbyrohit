# Cut the mark out of the white re-render (mark-white-v2). Outlines are truly
# black here, so the key is unambiguous: outside = white reachable from the
# border, holes = enclosed white blobs. Edge pixels blended with white get
# their colour pulled from the nearest opaque neighbour (no white fringe).
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi

SRC = 'assets-src/logo/mark-white-v2.png'
rgb = np.array(Image.open(SRC).convert('RGB')).astype(int)
white = (765 - rgb.sum(axis=2)) < 36
lab, n = ndi.label(white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sizes = ndi.sum(white, lab, range(1, n + 1))
outside = np.isin(lab, list(border))
holes = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if (i + 1) not in border and s > 150])
for i, s in enumerate(sizes, 1):
    if i in border or s <= 150: continue
    cy, cx = ndi.center_of_mass(lab == i); print(f'hole size={int(s):6d} at ({int(cx)},{int(cy)})')
mask = ~(outside | holes)
lab, n = ndi.label(mask)
sizes = ndi.sum(mask, lab, range(1, n + 1))
mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 1500])
# de-fringe: replace colours of pixels near the edge with the nearest interior colour
inner = ndi.binary_erosion(mask, iterations=2)
idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
clean = rgb[idx[0], idx[1]]
alpha = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
out = np.dstack([clean.astype(np.uint8), alpha])
ys, xs = np.where(alpha > 0)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
img = Image.fromarray(out, 'RGBA').crop(box)
print('trimmed', img.size)
img.save('assets-src/logo/mark.png')
for name, bgc in (('dark', (13, 9, 7)), ('light', (245, 240, 230))):
    cv = Image.new('RGBA', (img.width + 200, img.height + 200), bgc + (255,))
    cv.alpha_composite(img, (100, 100))
    cv.convert('RGB').save(f'assets-src/logo/mark-preview-{name}.png')
