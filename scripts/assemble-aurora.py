"""Blender headless: prep the Meshy Aurora robot for the web.

- imports the single Meshy mesh (aurora-bot-src.glb)
- splits off the HEAD (top region, minus the raised hand) as "Head",
  origin at the neck pivot so the site can turn it toward the cursor
- splits off the raised FOREARM+HAND as "ArmR", origin at the elbow ball
  so the site can make it point after the cursor
- decimates, exports draco GLB, renders preview PNGs for visual QA

Run: blender --background --python scripts/assemble-aurora.py
"""
import bpy, bmesh, os, math

BASE = r"C:\Users\DELL\Downloads\markting ravan animation\site\public\models"
SRC = r"C:\Users\DELL\Downloads\markting ravan animation\models-src\aurora-bot-src.glb"
DST = os.path.join(BASE, "aurora-bot.glb")
PREVIEW = r"C:\Users\DELL\Downloads\markting ravan animation\scripts\aurora-preview.png"
DEBUG = r"C:\Users\DELL\Downloads\markting ravan animation\scripts\aurora-debug.png"

# region fractions of total height H, measured off the concept art ---------
NECK_Z = 0.70        # head/body boundary
ELBOW_Z = 0.62       # forearm split height
ARM_DX = 0.21        # |x - cx| beyond which top-region verts belong to the arm
# --------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in bpy.data.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
robot = bpy.context.view_layer.objects.active
robot.name = "Body"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def wbbox(ob):
    xs = [(ob.matrix_world @ v.co) for v in ob.data.vertices]
    mn = [min(c[i] for c in xs) for i in range(3)]
    mx = [max(c[i] for c in xs) for i in range(3)]
    return mn, mx

mn, mx = wbbox(robot)
H = mx[2] - mn[2]
z0 = mn[2]

# robot center-x from the feet (bottom 12%), so the raised arm doesn't skew it
feet_x = [v.co.x for v in robot.data.vertices if (v.co.z - z0) < 0.12 * H]
cx = (min(feet_x) + max(feet_x)) / 2

# which side is the raised arm on? the highest vert clearly off-center
side = 0
best = -1
for v in robot.data.vertices:
    if abs(v.co.x - cx) > ARM_DX * H and v.co.z > best:
        best = v.co.z
        side = 1 if v.co.x > cx else -1
print(f"H={H:.3f} cx={cx:.3f} arm side={'+' if side>0 else '-'}x  top arm vert z frac={(best-z0)/H:.2f}")

def separate(pred, new_name):
    """Split verts of object "Body" matching pred(co) into a new object.

    Everything is re-fetched by NAME — python references and .data pointers go
    stale after a previous separate() in this Blender build.
    """
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    ob = bpy.data.objects["Body"]
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='VERT')
    bpy.ops.mesh.select_all(action='DESELECT')
    ob = bpy.context.edit_object
    bm = bmesh.from_edit_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    n = 0
    for v in bm.verts:
        sel = bool(pred(v.co))
        v.select = sel
        n += sel
    bm.select_flush_mode()
    bmesh.update_edit_mesh(ob.data)
    print(f"separate {new_name}: {n} of {len(bm.verts)} verts")
    before = {o.name for o in bpy.data.objects}
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    new_names = [nm for nm in (o.name for o in bpy.data.objects) if nm not in before]
    new = bpy.data.objects[new_names[0]]
    new.name = new_name
    return new

# 1) forearm + hand: high AND far off-center on the arm side
#    (measured: head/ears reach 0.18H off-center, shoulder 0.20H, the raised
#    forearm column 0.24H..0.35H — so 0.21H splits cleanly at the elbow)
arm = separate(
    lambda co: (co.z - z0) > ELBOW_Z * H and (co.x - cx) * side > ARM_DX * H,
    "ArmR",
)

# 2) head: everything above the neck that's left
head = separate(lambda co: (co.z - z0) > NECK_Z * H, "Head")

# re-fetch by name — references go stale across edit-mode ops
robot = bpy.data.objects["Body"]
head = bpy.data.objects["Head"]
arm = bpy.data.objects["ArmR"]

def set_origin(ob, point):
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# head origin at neck pivot (bottom-center of head bbox)
hmn, hmx = wbbox(head)
set_origin(head, ((hmn[0]+hmx[0])/2, (hmn[1]+hmx[1])/2, hmn[2] + 0.02 * H))

# arm origin at the elbow (bottom-center of forearm bbox)
amn, amx = wbbox(arm)
set_origin(arm, ((amn[0]+amx[0])/2, (amn[1]+amx[1])/2, amn[2] + 0.01 * H))

def decimate(ob, target):
    ob.data.calc_loop_triangles()
    tris = len(ob.data.loop_triangles)
    print(f"{ob.name}: {tris} tris")
    if tris > target:
        mod = ob.modifiers.new("dec", 'DECIMATE')
        mod.ratio = target / tris
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)

decimate(robot, 40000)
decimate(head, 22000)
decimate(arm, 9000)

# glossy white plastic, not metal
for mat in bpy.data.materials:
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = 0.0
                node.inputs['Roughness'].default_value = 0.3

for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        img.scale(1024, 1024)

# ---- export ----
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_draco_mesh_compression_enable=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
    export_yup=True,
)
print(f"EXPORTED {DST} {os.path.getsize(DST)/1e6:.2f} MB")

# ---- preview renders ----
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (cx, mn[1] - 2.4 * H, z0 + 0.55 * H)
cam.rotation_euler = (math.radians(88), 0, 0)
bpy.context.scene.camera = cam

def lamp(name, loc, energy, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    bpy.context.collection.objects.link(o)

lamp("key", (cx + H, mn[1] - 1.5 * H, mx[2]), 4000 * H, (1, 1, 1))
lamp("fill", (cx - H, mn[1] - 1.5 * H, z0 + 0.4 * H), 1800 * H, (0.85, 0.95, 1))
lamp("rim", (cx, mx[1] + H, mx[2]), 2500 * H, (0.6, 0.9, 1))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 860
if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
bgn = scene.world.node_tree.nodes.get('Background')
if bgn:
    bgn.inputs[0].default_value = (0.92, 0.96, 1.0, 1)

scene.render.filepath = PREVIEW
bpy.ops.render.render(write_still=True)
print("PREVIEW", PREVIEW)

# debug render: tint + rotate the split parts so the seams/pivots are visible
def tint(ob, rgba):
    m = bpy.data.materials.new(ob.name + "_dbg")
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = rgba
    ob.data.materials.clear()
    ob.data.materials.append(m)

tint(head, (0.2, 0.9, 0.4, 1))
tint(arm, (0.95, 0.2, 0.6, 1))
head.rotation_euler.z = math.radians(25)
arm.rotation_euler.y = math.radians(-20 * side)
scene.render.filepath = DEBUG
bpy.ops.render.render(write_still=True)
print("DEBUG", DEBUG)
