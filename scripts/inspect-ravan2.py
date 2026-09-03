"""Blender headless: inspect ravan-head2.glb loose parts to find the pedestal."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models\ravan-head2.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')

parts = [o for o in bpy.data.objects if o.type == 'MESH']
rows = []
zmin_all, zmax_all = 1e9, -1e9
for o in parts:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    w = max(max(xs) - min(xs), max(ys) - min(ys))
    h = max(zs) - min(zs)
    o.data.calc_loop_triangles()
    rows.append((w * w * h, o.name, w, h, min(zs), max(zs), len(o.data.loop_triangles)))
    zmin_all = min(zmin_all, min(zs)); zmax_all = max(zmax_all, max(zs))

print(f"TOTAL parts={len(parts)} zrange=[{zmin_all:.4f},{zmax_all:.4f}]")
rows.sort(reverse=True)
for vol, name, w, h, z0, z1, tris in rows[:15]:
    print(f"BIG {name}: w={w:.4f} h={h:.4f} z=[{z0:.4f},{z1:.4f}] tris={tris}")
