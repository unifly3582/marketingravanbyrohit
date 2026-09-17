# Cut the mark out of mark-v1 (flat #0F0A06 background).
# The model drew outlines/hair in near-background colours, so:
#   silhouette  = rembg (isnet), hardened to a crisp mask
#   true holes  = fat blobs of pixels within 14 of the bg colour that are either
#                 (a) essentially the bg colour (mean dist <= 6: horn crescents), or
#                 (b) close to the outside edge (earring hoops, min dist < 70px).
#                 Hair shadows (dist ~12, deep inside) and sideburns (dist ~20) survive.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage as ndi
from rembg import remove, new_session

src = Image.open('assets-src/logo/mark-v1.png').convert('RGB')
ImageDraw.Draw(src).rectangle([1400, 1650, 2048, 2048], fill=(15, 10, 6))
rgb = np.array(src).astype(int)
dist = np.abs(rgb - np.array([15, 10, 6])).sum(axis=2)

soft = np.array(remove(src, session=new_session('isnet-general-use')))[..., 3]
mask = soft > 40
mask = ndi.binary_opening(mask, iterations=2)
mask = ndi.binary_closing(mask, iterations=2)
lab, n = ndi.label(mask)
sizes = ndi.sum(mask, lab, range(1, n + 1))
mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2000])
edge = ndi.distance_transform_edt(mask)

cand = (dist <= 14) & mask
R = 10
yy, xx = np.ogrid[-R:R + 1, -R:R + 1]
seed = ndi.binary_opening(cand, structure=(xx ** 2 + yy ** 2) <= R * R)
holes = seed.copy()
for _ in range(24):
    holes = ndi.binary_dilation(holes) & (dist <= 16) & mask
lab, n = ndi.label(holes)
keep = []
for i in range(1, n + 1):
    b = lab == i
    if b.sum() < 300: continue
    md, mn = dist[b].mean(), edge[b].min()
    cy, cx = ndi.center_of_mass(b)
    is_hole = md <= 6 or (mn < 20 and b.sum() > 2000)
    print(f'blob ({int(cx):4d},{int(cy):4d}) size={int(b.sum()):6d} meandist={md:4.1f} edge={mn:5.1f} -> {"HOLE" if is_hole else "keep"}')
    if is_hole: keep.append(i)
holes = np.isin(lab, keep)
dbg = np.array(src).copy(); dbg[holes] = (0, 255, 0); dbg[~mask] = (255, 0, 255)
Image.fromarray(dbg.astype(np.uint8)).resize((1024, 1024)).save('assets-src/logo/_debug-holes.png')

mask &= ~holes
mask = ndi.binary_opening(mask, iterations=1)
alpha = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)))
out = np.dstack([rgb.astype(np.uint8), alpha])
ys, xs = np.where(alpha > 0)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
img = Image.fromarray(out, 'RGBA').crop(box)
print('trimmed', img.size)
img.save('assets-src/logo/mark.png')
for name, bgc in (('dark', (13, 9, 7)), ('light', (245, 240, 230))):
    cv = Image.new('RGBA', (img.width + 200, img.height + 200), bgc + (255,))
    cv.alpha_composite(img, (100, 100))
    cv.convert('RGB').save(f'assets-src/logo/mark-preview-{name}.png')
