"""Blender headless: render the Jade Breeze bottle with a transparent background,
front view, for the hero text-behind-product effect.
Run: blender --background --python scripts/render-bottle-cutout.py
"""
import bpy
from mathutils import Vector

GLB = r"C:\Users\DELL\Downloads\theblossomgreen\test-out\models\jade-bottle.glb"
OUT = r"C:\Users\DELL\Downloads\theblossomgreen\bloom-green-landing\public\img\bottle-cutout.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.resolution_x = 900
scene.render.resolution_y = 1700
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUT

# bounding box of all meshes
mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        for corner in ob.bound_box:
            w = ob.matrix_world @ Vector(corner)
            mins = Vector(map(min, mins, w))
            maxs = Vector(map(max, maxs, w))
center = (mins + maxs) / 2
size = maxs - mins
height = size.z

# world light
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.2

# camera straight-on from -Y (glTF front)
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (center.x, center.y - height * 2.3, center.z)
cam.rotation_euler = (1.5708, 0, 0)
scene.camera = cam
cam_data.lens = 85

# key + fill lights
key = bpy.data.lights.new("Key", 'AREA')
key.energy = 400
key.size = 3
key_ob = bpy.data.objects.new("Key", key)
key_ob.location = (center.x - height, center.y - height * 1.5, center.z + height)
key_ob.rotation_euler = (1.2, 0, -0.6)
scene.collection.objects.link(key_ob)

fill = bpy.data.lights.new("Fill", 'AREA')
fill.energy = 200
fill.size = 3
fill_ob = bpy.data.objects.new("Fill", fill)
fill_ob.location = (center.x + height, center.y - height * 1.5, center.z)
fill_ob.rotation_euler = (1.4, 0, 0.6)
scene.collection.objects.link(fill_ob)

bpy.ops.render.render(write_still=True)
print(f"RENDERED {OUT}")
