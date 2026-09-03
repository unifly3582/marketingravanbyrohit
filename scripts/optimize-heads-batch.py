"""Blender headless: batch-optimize the Meshy personality heads for the web.
For each head: auto-detect and strip the pedestal disc Meshy adds under the
chin, decimate to ~50k tris, shrink textures to 1024, Draco-compress.

Run: blender --background --python scripts/optimize-heads-batch.py [-- name1 name2 ...]
Defaults to every head-*.glb in assets-src/models.
"""
import bpy, bmesh, os, sys, math, glob

ROOT = r"C:\Users\DELL\Downloads\markting ravan animation"
SRC_DIR = os.path.join(ROOT, "assets-src", "models")
DST_DIR = os.path.join(ROOT, "site", "public", "models")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    names = argv
else:
    names = [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(SRC_DIR, "head-*.glb"))]

def detect_pedestal_cut(verts_world, zmin, zmax):
    """Meshy pedestals are wide flat discs at the very bottom, separated from
    the chin/hair by a radial pinch. Scan max horizontal radius per z-bin in
    the bottom quarter and cut at the narrowest gap above a wide base."""
    H = zmax - zmin
    NB = 60
    lim = zmin + 0.25 * H
    radii = [0.0] * NB
    for (x, y, z) in verts_world:
        if z > lim:
            continue
        b = min(NB - 1, int((z - zmin) / (0.25 * H) * NB))
        r = math.hypot(x, y)
        if r > radii[b]:
            radii[b] = r
    base_r = max(radii[:8]) if any(radii[:8]) else 0
    if base_r <= 0:
        return None
    # look for the pinch: minimum radius between 3% and 80% of the scan window
    lo, hi = 3, int(NB * 0.8)
    pinch_i, pinch_r = None, 1e9
    for i in range(lo, hi):
        if radii[i] > 0 and radii[i] < pinch_r:
            pinch_r, pinch_i = radii[i], i
    if pinch_i is None or pinch_r > 0.6 * base_r:
        return None  # no clear disc/gap — assume no pedestal
    return zmin + (pinch_i + 0.5) / NB * 0.25 * H

for name in names:
    src = os.path.join(SRC_DIR, name + ".glb")
    dst = os.path.join(DST_DIR, name + "-web.glb")
    if not os.path.exists(src):
        print(f"SKIP {name}: no {src}")
        continue

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']

    # gather world-space verts for detection
    verts, zmin, zmax = [], 1e9, -1e9
    for ob in meshes:
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            verts.append((p.x, p.y, p.z))
            zmin = min(zmin, p.z); zmax = max(zmax, p.z)

    cut = detect_pedestal_cut(verts, zmin, zmax)
    if cut is None:
        print(f"{name}: no pedestal detected (zrange {zmin:.3f}..{zmax:.3f})")
    else:
        print(f"{name}: cutting below z={cut:.3f} (zrange {zmin:.3f}..{zmax:.3f})")
        for ob in meshes:
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            doomed = [v for v in bm.verts if (ob.matrix_world @ v.co).z < cut]
            print(f"  {ob.name}: removing {len(doomed)}/{len(bm.verts)} verts")
            bmesh.ops.delete(bm, geom=doomed, context='VERTS')
            bm.to_mesh(ob.data)
            bm.free()

    for ob in meshes:
        ob.data.calc_loop_triangles()
        tris = len(ob.data.loop_triangles)
        target = 50000
        print(f"  {ob.name}: {tris} tris")
        if tris > target:
            mod = ob.modifiers.new("dec", 'DECIMATE')
            mod.ratio = target / tris
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=mod.name)

    for img in bpy.data.images:
        if img.size[0] > 1024 or img.size[1] > 1024:
            img.scale(1024, 1024)

    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_image_format='JPEG',
        export_jpeg_quality=85,
    )
    print(f"EXPORTED {dst} {os.path.getsize(dst)/1e6:.2f} MB")

print("BATCH DONE")
