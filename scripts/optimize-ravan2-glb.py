"""Blender headless: decimate + compress the Meshy Ravan head (option 1,
realistic bronze) for the web. Unlike the old gold-statue pass this keeps the
original PBR look — skin must not turn metallic.
Run: blender --background --python scripts/optimize-ravan2-glb.py
"""
import bpy, os

ROOT = r"C:\Users\DELL\Downloads\markting ravan animation"
SRC = os.path.join(ROOT, "assets-src", "models", "ravan-head2.glb")
DST = os.path.join(ROOT, "site", "public", "models", "ravan-head2-web.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# --- strip the pedestal Meshy added under the chin ------------------------
# The mesh is triangle soup; per scripts/inspect-ravan2.py the pedestal lives
# entirely below world z = -0.84 and the head's lowest hair ends at -0.78,
# so a flat vertex cut at -0.80 removes exactly the pedestal.
import bmesh
PEDESTAL_Z = -0.80
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    doomed = [v for v in bm.verts if (ob.matrix_world @ v.co).z < PEDESTAL_Z]
    print(f"pedestal cut: {ob.name} removing {len(doomed)}/{len(bm.verts)} verts")
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()

for ob in list(bpy.data.objects):
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles()
        tris = len(ob.data.loop_triangles)
        target = 50000
        print(f"ravan-head2: {ob.name} {tris} tris")
        if tris > target:
            mod = ob.modifiers.new("dec", 'DECIMATE')
            mod.ratio = target / tris
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=mod.name)

for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        img.scale(1024, 1024)

bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
)
print(f"EXPORTED {DST} {os.path.getsize(DST)/1e6:.2f} MB")
