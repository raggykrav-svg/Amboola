# AMBOOLA's friendly giant monster ("Gojira-chan"): a round green dinosaur with a cream belly, orange back spikes,
# big happy eyes and pink cheeks. Built like the dog: stick skeletons grown into bodies by the Skin modifier.
# The legs, arms and tail are separate objects with their origin at the joint, so the game can swing them.
#
#   blender -b --factory-startup --python models/blender/monster.py -- [--render out.png]
#
# Writes models/monster.glb and models/monster.glb.js (key 'monster'). Faces glTF +Z, stands on y = 0, about 3.4 m
# tall (the game scales it up about 10x). Nodes: Body, Tail, LegL, LegR, ArmL, ArmR.
import bpy, base64, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'monster.glb')


def material(name, hexcol, rough=.7):
    h = hexcol.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
    return m


def skin(name, P, E, mat, root, origin=(0, 0, 0)):
    names = list(P); o = Vector(origin)
    me = bpy.data.meshes.new(name); me.from_pydata([Vector(P[n][0]) - o for n in names], [(names.index(a), names.index(b)) for a, b in E], [])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.location = o
    ob.modifiers.new('skin', 'SKIN').use_smooth_shade = True
    for i, n in enumerate(names): r = P[n][1]; me.skin_vertices[0].data[i].radius = (r, r)
    me.skin_vertices[0].data[names.index(root)].use_root = True
    ob.modifiers.new('sub', 'SUBSURF').levels = 2
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    ob.data.materials.append(mat); return ob


def sphere(loc, r, mat, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=20, ring_count=12)
    o = bpy.context.active_object; o.scale = scale; bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mat)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def cone(loc, r, depth, mat, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, radius2=r * .08, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.data.materials.append(mat)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    green, belly, spike = material('Skin', '#4cc35a'), material('Belly', '#f3e7b8'), material('Spikes', '#ff8a1f', .5)
    white, black, pink = material('EyeWhite', '#ffffff', .2), material('Pupil', '#111214', .2), material('Cheek', '#ff8fb0', .6)
    # head towards -y (glTF +z after export)
    # the body: a metaball blob (hips, belly, chest, neck, head, snout) turned into a smooth mesh
    mb = bpy.data.metaballs.new('BodyMeta'); mb.resolution = .06; mb.render_resolution = .06; mo = bpy.data.objects.new('Body', mb); bpy.context.collection.objects.link(mo)
    for (x, y, z), (a, b, c) in [((0, .28, 1.3), (.62, .62, .6)), ((0, 0, 1.62), (.66, .62, .66)), ((0, -.26, 2.0), (.55, .5, .55)), ((0, -.42, 2.4), (.38, .38, .4)),
                                 ((0, -.6, 2.82), (.5, .5, .48)), ((0, -.98, 2.7), (.34, .36, .3))]:
        e = mb.elements.new(); e.type = 'ELLIPSOID'; e.co = (x, y, z); e.radius = 1; e.size_x, e.size_y, e.size_z = a, b, c; e.stiffness = 2
    bpy.context.view_layer.objects.active = mo; mo.select_set(True); bpy.ops.object.convert(target='MESH')
    body = bpy.context.active_object; body.name = 'Body'; body.data.materials.append(green)
    for p in body.data.polygons: p.use_smooth = True
    sphere((0, -.42, 1.62), .46, belly, (1.05, .55, 1.25), body)                     # the cream belly
    for s in (1, -1):
        sphere((s * .24, -.92, 2.98), .14, white, parent=body); sphere((s * .25, -1.04, 3.0), .07, black, parent=body)   # big eyes
        sphere((s * .34, -.98, 2.72), .09, pink, (1, .5, .7), body)                  # pink cheeks
        sphere((s * .09, -1.27, 2.78), .03, black, parent=body)                      # nostrils
    sphere((0, -1.24, 2.6), .1, black, (1.6, .25, .3), body)                          # a little smile
    for k, (y, z, r) in enumerate([(-.6, 3.18, .12), (-.4, 2.75, .18), (-.15, 2.42, .22), (.12, 2.2, .24), (.38, 1.98, .22), (.62, 1.78, .18)]):
        cone((0, y + .08, z + .1), r, r * 2.2, spike, (math.radians(-25), 0, 0), body)  # orange spikes down the back
    tail = skin('Tail', {'t0': ((0, .7, 1.25), .42), 't1': ((0, 1.35, .95), .3), 't2': ((0, 2.0, .65), .19), 't3': ((0, 2.55, .5), .09)},
                [('t0', 't1'), ('t1', 't2'), ('t2', 't3')], green, 't0', origin=(0, .6, 1.3))
    for y, z, r in [(1.2, 1.25, .16), (1.8, .95, .12), (2.3, .72, .08)]: cone((0, y, z), r, r * 2.2, spike, (math.radians(-35), 0, 0), tail)
    for s, nm in ((1, 'L'), (-1, 'R')):
        skin('Leg' + nm, {'hip': ((s * .4, .28, 1.12), .32), 'knee': ((s * .46, .18, .6), .26), 'ankle': ((s * .46, .05, .2), .22), 'toe': ((s * .46, -.3, .14), .18)},
             [('hip', 'knee'), ('knee', 'ankle'), ('ankle', 'toe')], green, 'hip', origin=(s * .4, .28, 1.12))
        skin('Arm' + nm, {'sh': ((s * .44, -.38, 1.9), .16), 'el': ((s * .6, -.62, 1.66), .12), 'ha': ((s * .55, -.84, 1.55), .12)},
             [('sh', 'el'), ('el', 'ha')], green, 'sh', origin=(s * .44, -.38, 1.9))
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            for p in o.data.polygons: p.use_smooth = True
    return body


def export():
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(OUT, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(OUT + '.js', 'w') as f:
        f.write("// Generated by models/blender/monster.py from monster.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['monster'] = '{b64}';\n")
    print(f'exported {OUT}: {os.path.getsize(OUT) / 1e3:.0f} kB', flush=True)


def render(path):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 32; scn.render.resolution_x, scn.render.resolution_y = 700, 700
    bpy.ops.object.camera_add(location=(-5, -7, 3.2)); cam = bpy.context.active_object; scn.camera = cam
    d = Vector((0, 0, 1.6)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 40
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-40))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.data.materials.append(material('Floor', '#9aa0a6', 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build()
    if '--render' in argv: render(argv[argv.index('--render') + 1]); build()
    export()
