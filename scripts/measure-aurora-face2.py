"""ASCII-scatter the cyan texels of the Head mesh (x vs z, front-facing only)."""
import bpy, os

BASE = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(BASE, "aurora-bot.glb"))

head = bpy.data.objects["Head"]
me = head.data
uv_layer = me.uv_layers.active.data
# per-material image + cached pixels
slot_img = []
for mat in me.materials:
    img = None
    if mat and mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                img = node.image
                break
    slot_img.append(img)
print("material slots:", [(m.name if m else None, i.name if i else None) for m, i in zip(me.materials, slot_img)])
cache = {}
for img in slot_img:
    if img and img.name not in cache:
        cache[img.name] = (img.size[0], img.size[1], list(img.pixels))

def texel(img, u, v):
    W, Hpx, px = cache[img.name]
    x = min(max(int(u * W), 0), W - 1)
    y = min(max(int(v * Hpx), 0), Hpx - 1)
    i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]

hits = []
for poly in me.polygons:
    img = slot_img[poly.material_index] if poly.material_index < len(slot_img) else None
    if not img:
        continue
    us = vs = 0.0
    for li in poly.loop_indices:
        uv = uv_layer[li].uv
        us += uv.x
        vs += uv.y
    n = len(poly.loop_indices)
    r, g, b = texel(img, us / n, vs / n)
    if g > 0.45 and b > 0.45 and r < 0.6 * g:
        c = poly.center
        hits.append((c.x, c.y, c.z, poly.normal.y))

print(f"total cyan polys: {len(hits)}")
front = [h for h in hits if h[3] < -0.3]
back = [h for h in hits if h[3] >= -0.3]
print(f"front-facing (ny<-0.3): {len(front)}, other: {len(back)}")
for label, data in (("FRONT", front), ("OTHER", back)):
    if not data:
        continue
    xs = [h[0] for h in data]; ys = [h[1] for h in data]; zs = [h[2] for h in data]
    print(f"{label}: x[{min(xs):.3f},{max(xs):.3f}] y[{min(ys):.3f},{max(ys):.3f}] z[{min(zs):.3f},{max(zs):.3f}]")
    # ascii scatter x (cols) vs z (rows, top=high)
    COLS, ROWS = 60, 24
    x0, x1 = -0.45, 0.45
    z0, z1 = -0.05, 0.45
    grid = [[' '] * COLS for _ in range(ROWS)]
    for x, y, z, ny in data:
        cc = int((x - x0) / (x1 - x0) * (COLS - 1))
        rr = int((z1 - z) / (z1 - z0) * (ROWS - 1))
        if 0 <= cc < COLS and 0 <= rr < ROWS:
            ch = grid[rr][cc]
            grid[rr][cc] = '1' if ch == ' ' else ('2' if ch == '1' else '#')
    for rr, row in enumerate(grid):
        z_here = z1 - (z1 - z0) * rr / (ROWS - 1)
        print(f"z={z_here:+.3f} |{''.join(row)}|")

# refined clusters from the scatter
def stats(name, sel):
    if not sel:
        print(f"{name}: EMPTY")
        return
    xs = [h[0] for h in sel]; ys = [h[1] for h in sel]; zs2 = [h[2] for h in sel]
    cx_ = sum(xs) / len(xs); cy_ = sum(ys) / len(ys); cz_ = sum(zs2) / len(zs2)
    print(f"{name}: n={len(sel)} center=({cx_:.4f},{cy_:.4f},{cz_:.4f}) "
          f"w={max(xs)-min(xs):.4f} h={max(zs2)-min(zs2):.4f} y_front={min(ys):.4f}")
    print(f"  three-local: ({cx_:.4f}, {cz_:.4f}, {-cy_:.4f})")

fr = front
stats("eyeL", [h for h in fr if h[2] > 0.22 and -0.25 < h[0] < -0.02])
stats("eyeR", [h for h in fr if h[2] > 0.22 and 0.02 < h[0] < 0.25])
stats("mouth", [h for h in fr if 0.14 < h[2] < 0.21 and -0.15 < h[0] < 0.15])
