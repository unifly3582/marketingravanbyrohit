"""Blender headless: assemble the Meshy head + body into one web GLB.

- joins each part into a single mesh, named "Head" / "Body"
- scales the head to fit the body, parks it on the neck socket
- puts the Head origin at the neck pivot (so the site can rotate it)
- decimates, warms the materials, exports draco GLB
- renders a front preview PNG for visual QA

Run: blender --background --python scripts/assemble-robot.py
"""
import bpy, os, math

BASE = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models"
PREVIEW = r"C:\Users\DELL\Downloads\markting ravan animation\scripts\robot-preview.png"

# tweak these if the preview looks off ------------------------------------
HEAD_SCALE = 0.26      # head height (incl crown + plinth) as fraction of body height
NECK_DROP = 0.085      # how far the head sinks into the neck, in body heights
HEAD_FWD = 0.0         # forward nudge (+y is back in blender glTF import)
# -------------------------------------------------------------------------

def import_part(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
    for o in bpy.data.objects:
        o.select_set(False)
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

def bbox(ob):
    xs = [ (ob.matrix_world @ v.co) for v in ob.data.vertices ]
    minv = [min(c[i] for c in xs) for i in range(3)]
    maxv = [max(c[i] for c in xs) for i in range(3)]
    return minv, maxv

def decimate(ob, target):
    ob.data.calc_loop_triangles()
    tris = len(ob.data.loop_triangles)
    print(f"{ob.name}: {tris} tris")
    if tris > target:
        mod = ob.modifiers.new("dec", 'DECIMATE')
        mod.ratio = target / tris
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)

bpy.ops.wm.read_factory_settings(use_empty=True)

body = import_part(os.path.join(BASE, "robot-body.glb"), "Body")
head = import_part(os.path.join(BASE, "robot-head.glb"), "Head")

bmin, bmax = bbox(body)
body_h = bmax[2] - bmin[2]
body_cx = (bmin[0] + bmax[0]) / 2
body_cy = (bmin[1] + bmax[1]) / 2

hmin, hmax = bbox(head)
head_h = hmax[2] - hmin[2]

s = (HEAD_SCALE * body_h) / head_h
head.scale = (s, s, s)
bpy.context.view_layer.objects.active = head
bpy.ops.object.transform_apply(scale=True)

hmin, hmax = bbox(head)
hx = (hmin[0] + hmax[0]) / 2
hy = (hmin[1] + hmax[1]) / 2
# neck pivot: bottom-center of the head
head.location.x += body_cx - hx
head.location.y += body_cy - hy + HEAD_FWD * body_h
head.location.z += (bmax[2] - NECK_DROP * body_h) - hmin[2]
bpy.ops.object.transform_apply(location=True)

# origin at neck pivot so rotation looks natural
hmin, hmax = bbox(head)
bpy.context.scene.cursor.location = ((hmin[0]+hmax[0])/2, (hmin[1]+hmax[1])/2, hmin[2] + 0.02*body_h)
bpy.context.view_layer.objects.active = head
for o in bpy.data.objects: o.select_set(o is head)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

decimate(body, 34000)
decimate(head, 22000)

for mat in bpy.data.materials:
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = 0.75
                node.inputs['Roughness'].default_value = 0.42

for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        img.scale(1024, 1024)

# ---- preview render ----
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (body_cx, bmin[1] - 2.6 * body_h, bmin[2] + 0.6 * body_h)
cam.rotation_euler = (math.radians(88), 0, 0)
bpy.context.scene.camera = cam

def lamp(name, kind, loc, energy, color=(1,1,1)):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    bpy.context.collection.objects.link(o)
    return o

lamp("key", 'AREA', (body_cx + body_h, bmin[1] - 1.5*body_h, bmax[2]), 4000*body_h, (1.0, 0.85, 0.6))
lamp("fill", 'AREA', (body_cx - body_h, bmin[1] - 1.5*body_h, bmin[2] + 0.4*body_h), 1500*body_h, (1.0, 0.6, 0.35))
lamp("rim", 'AREA', (body_cx, bmax[1] + body_h, bmax[2]), 2500*body_h, (1.0, 0.55, 0.25))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 860
scene.render.filepath = PREVIEW
if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
bgn = scene.world.node_tree.nodes.get('Background')
if bgn:
    bgn.inputs[0].default_value = (0.02, 0.013, 0.01, 1)
bpy.ops.render.render(write_still=True)
print("PREVIEW", PREVIEW)

# ---- export ----
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
dst = os.path.join(BASE, "ravan-bot.glb")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    use_selection=True,
    export_draco_mesh_compression_enable=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
    export_yup=True,
)
print(f"EXPORTED {dst} {os.path.getsize(dst)/1e6:.2f} MB")
