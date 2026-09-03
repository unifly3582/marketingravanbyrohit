"""Blender headless: decimate + compress Meshy glbs for the web.
Run: blender --background --python scripts/optimize-glb.py
"""
import bpy, os

SRC = r"C:\Users\DELL\Downloads\theblossomgreen\test-out\models"
DST = r"C:\Users\DELL\Downloads\theblossomgreen\bloom-green-landing\public\models"
os.makedirs(DST, exist_ok=True)

for name in ("jade-bottle", "lavender-candle"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))

    for ob in list(bpy.data.objects):
        if ob.type == 'MESH':
            ob.data.calc_loop_triangles()
            tris = len(ob.data.loop_triangles)
            target = 40000
            print(f"{name}: {ob.name} {tris} tris")
            if tris > target:
                mod = ob.modifiers.new("dec", 'DECIMATE')
                mod.ratio = target / tris
                bpy.context.view_layer.objects.active = ob
                bpy.ops.object.modifier_apply(modifier=mod.name)

    for img in bpy.data.images:
        if img.size[0] > 1024 or img.size[1] > 1024:
            img.scale(1024, 1024)

    dst = os.path.join(DST, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_image_format='JPEG',
        export_jpeg_quality=85,
    )
    print(f"EXPORTED {dst} {os.path.getsize(dst)/1e6:.2f} MB")
