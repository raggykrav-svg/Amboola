# The AMBOOLA helicopter: a yellow bubble cabin with a black stripe, a long tail boom with a fin, landing skids,
# a 4-blade main rotor and a 2-blade tail rotor. The two rotors are separate objects (origin at their hubs) so the
# game can spin them.
#
#   blender -b --factory-startup --python models/blender/heli.py -- [--render out.png]
#
# Writes models/heli.glb and models/heli.glb.js (key 'heli'). Faces glTF +Z, skids on y = 0, about 10 m long with
# the rotor. Nodes: Body, Rotor (spins about Y), TailRotor (spins about X).
import bpy, base64, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'heli.glb')


def material(name, hexcol, rough=.4, metal=0.0):
    h = hexcol.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m


def act(mat, parent=None, smooth=True):
    o = bpy.context.active_object; o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    paint, black, glass, metal = material('Paint', '#f2c20f', .3), material('Black', '#16171b', .5), material('Glass', '#1a2a38', .05), material('Metal', '#9aa0a8', .3, .9)
    red = material('Light', '#ff2a1a', .3)
    # forward is -y (glTF +z). The cabin: a stretched sphere, glass front, black stripe
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 1.55), segments=32, ring_count=16); body = act(paint); body.name = 'Body'
    body.scale = (1.15, 1.9, 1.05); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, -.62, 1.72), segments=32, ring_count=16); g = act(glass, body)
    g.scale = (1.0, 1.35, .82)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.165, depth=.22, location=(0, .2, 1.35), vertices=32); s = act(black, body); s.scale = (1, 1.62, 1)
    # tail boom, fin, stabiliser
    bpy.ops.mesh.primitive_cylinder_add(radius=.32, depth=4.6, location=(0, 3.6, 1.85), rotation=(math.radians(90), 0, 0), vertices=16); b = act(paint, body)
    bpy.ops.mesh.primitive_cone_add(radius1=.34, radius2=.2, depth=1, location=(0, 1.6, 1.8), rotation=(math.radians(-90), 0, 0), vertices=16); act(paint, body)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5.75, 2.45)); f = act(black, body, False); f.scale = (.08, .7, 1.2); f.rotation_euler = (math.radians(-18), 0, 0)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5.3, 1.9)); f = act(paint, body, False); f.scale = (1.6, .45, .06)
    # skids and struts
    for s in (1, -1):
        bpy.ops.mesh.primitive_cylinder_add(radius=.07, depth=3.4, location=(s * 1.05, -.1, .1), rotation=(math.radians(90), 0, 0), vertices=12); act(metal, body)
        for y in (-.9, .8):
            bpy.ops.mesh.primitive_cylinder_add(radius=.06, depth=.9, location=(s * .9, y, .5), rotation=(0, math.radians(s * 20), 0), vertices=10); act(metal, body)
    # mast, nav lights
    bpy.ops.mesh.primitive_cylinder_add(radius=.16, depth=.5, location=(0, .1, 2.65), vertices=16); act(black, body)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.1, location=(0, 6.15, 2.95)); act(red, body)
    # the main rotor: hub and four long blades (origin at the hub)
    bpy.ops.mesh.primitive_cylinder_add(radius=.28, depth=.22, location=(0, 0, 0), vertices=16); rotor = act(black); rotor.name = 'Rotor'
    for k in range(4):
        a = k * math.pi / 2
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 2.7, math.sin(a) * 2.7, 0)); bl = act(black, None, False)
        bl.scale = (5.2, .32, .05) if k % 2 == 0 else (.32, 5.2, .05); bpy.ops.object.transform_apply(scale=True)
        bl.select_set(True); rotor.select_set(True); bpy.context.view_layer.objects.active = rotor; bpy.ops.object.join()
    rotor.location = (0, .1, 2.95)
    # the tail rotor (spins about x, origin at its hub on the left of the fin)
    bpy.ops.mesh.primitive_cylinder_add(radius=.1, depth=.12, location=(0, 0, 0), rotation=(0, math.radians(90), 0), vertices=12); tr = act(black); tr.name = 'TailRotor'
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); bl = act(black, None, False); bl.scale = (.04, .16, 1.5); bpy.ops.object.transform_apply(scale=True)
    bl.select_set(True); tr.select_set(True); bpy.context.view_layer.objects.active = tr; bpy.ops.object.join()
    tr.location = (.16, 5.95, 2.3)
    return body


def export():
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(OUT, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(OUT + '.js', 'w') as f:
        f.write("// Generated by models/blender/heli.py from heli.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['heli'] = '{b64}';\n")
    print(f'exported {OUT}: {os.path.getsize(OUT) / 1e3:.0f} kB', flush=True)


def render(path):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 32; scn.render.resolution_x, scn.render.resolution_y = 800, 600
    bpy.ops.object.camera_add(location=(-9, -10, 5)); cam = bpy.context.active_object; scn.camera = cam
    d = Vector((0, 1.5, 1.6)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 40
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-40))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.active_object.data.materials.append(material('Floor', '#9aa0a6', 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build()
    if '--render' in argv: render(argv[argv.index('--render') + 1]); build()
    export()
