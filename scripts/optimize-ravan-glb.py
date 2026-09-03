"""Blender headless: decimate + compress the Meshy Ravan bust for the web.
Run: blender --background --python scripts/optimize-ravan-glb.py
"""
import bpy, os

BASE = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models"
SRC = os.path.join(BASE, "ravan-head.glb")
DST = os.path.join(BASE, "ravan-head-web.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for ob in list(bpy.data.objects):
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles()
        tris = len(ob.data.loop_triangles)
        target = 60000
        print(f"ravan-head: {ob.name} {tris} tris")
        if tris > target:
            mod = ob.modifiers.new("dec", 'DECIMATE')
            mod.ratio = target / tris
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=mod.name)

# warm the material toward polished gold
for mat in bpy.data.materials:
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = 0.85
                node.inputs['Roughness'].default_value = 0.38

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
