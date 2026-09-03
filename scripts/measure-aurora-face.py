"""Blender headless: locate the baked-on cyan face features of the Aurora bot.

Samples the Head mesh's base-color texture at each face-corner UV, collects
polygons whose texel is cyan (the glowing eyes/mouth), clusters them into
left eye / right eye / mouth, and prints center, size and outward normal of
each in HEAD-LOCAL coordinates (origin = neck pivot), plus the same converted
to three.js axes (x, y=up, z=toward viewer).

Run: blender --background --python scripts/measure-aurora-face.py
"""
import bpy, os
from mathutils import Vector

BASE = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models"
SRC = os.path.join(BASE, "aurora-bot.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

head = bpy.data.objects["Head"]
me = head.data
uv_layer = me.uv_layers.active.data

# find the image used by the head's material
img = None
for mat in me.materials:
    if mat and mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                img = node.image
                break
    if img:
        break
print(f"image: {img.name} {img.size[0]}x{img.size[1]}")

W, Hpx = img.size
px = list(img.pixels)  # RGBA floats, row-major from bottom

def texel(u, v):
    x = min(max(int(u * W), 0), W - 1)
    y = min(max(int(v * Hpx), 0), Hpx - 1)
    i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]

def is_cyan(r, g, b):
    return g > 0.45 and b > 0.45 and r < 0.6 * g

me.calc_loop_triangles()
hits = []  # (local co, normal)
for poly in me.polygons:
    us = vs = 0.0
    for li in poly.loop_indices:
        uv = uv_layer[li].uv
        us += uv.x
        vs += uv.y
    n = len(poly.loop_indices)
    r, g, b = texel(us / n, vs / n)
    if is_cyan(r, g, b):
        hits.append((poly.center.copy(), poly.normal.copy()))

print(f"cyan polys on head: {len(hits)}")
if not hits:
    raise SystemExit("no cyan features found — tweak is_cyan()")

zs = sorted(c.z for c, _ in hits)
z_mid = zs[0] + (zs[-1] - zs[0]) * 0.45

clusters = {"mouth": [], "eyeL": [], "eyeR": []}
for c, n in hits:
    if c.z < z_mid:
        clusters["mouth"].append((c, n))
    elif c.x < 0:
        clusters["eyeL"].append((c, n))
    else:
        clusters["eyeR"].append((c, n))

for name, items in clusters.items():
    if not items:
        print(f"{name}: EMPTY")
        continue
    cs = [c for c, _ in items]
    ns = [n for _, n in items]
    center = sum(cs, Vector()) / len(cs)
    normal = (sum(ns, Vector()) / len(ns)).normalized()
    w = max(c.x for c in cs) - min(c.x for c in cs)
    h = max(c.z for c in cs) - min(c.z for c in cs)
    d = max(c.y for c in cs) - min(c.y for c in cs)
    print(f"{name}: n={len(items)}")
    print(f"  blender local center=({center.x:.4f},{center.y:.4f},{center.z:.4f}) "
          f"size w={w:.4f} h={h:.4f} depth={d:.4f} normal=({normal.x:.3f},{normal.y:.3f},{normal.z:.3f})")
    # three.js head-local: x -> x, y -> blender z, z -> -blender y
    print(f"  three: center=({center.x:.4f},{center.z:.4f},{-center.y:.4f}) "
          f"normal=({normal.x:.3f},{normal.z:.3f},{-normal.y:.3f})")
