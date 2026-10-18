# The animals of the South Africa jungle: a lion and a monkey. Bodies are metaballs turned into smooth meshes, legs
# and tails are stick skeletons grown by the Skin modifier (like the camel and the dog). Every part that moves is its
# own top-level object with its origin at the joint, so the game can swing it:
#   lion:   Body, Mane (hidden for lionesses), Jaw (opens to roar), LegFL, LegFR, LegBL, LegBR, Tail
#   monkey: Body, ArmL, ArmR, LegL, LegR, Tail
# Eyes, noses, ears and paws are children of their part; the game merges each part into one mesh.
#
#   blender -b --factory-startup --python models/blender/jungle_animals.py -- [--animal lion|monkey|all] [--render DIR]
#
# Writes models/<animal>.glb and models/<animal>.glb.js (key '<animal>'). Each faces glTF +Z (Blender -Y) and stands
# on y = 0. The lion is about 1.25 m tall at the mane and 2.9 m long with its tail, the monkey 0.75 m at the head.
import bpy, base64, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def material(name, hexcol, rough=.85):
    h = hexcol.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
    return m


def smooth(ob):
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def blob(name, parts, mat, res, origin=(0, 0, 0)):
    """parts: [((x, y, z), (sx, sy, sz))] ellipsoids merged into one smooth mesh, origin moved to `origin`"""
    mb = bpy.data.metaballs.new(name + 'Meta'); mb.resolution = res; mb.render_resolution = res
    mo = bpy.data.objects.new(name, mb); bpy.context.collection.objects.link(mo)
    for co, (a, b, c) in parts:
        e = mb.elements.new(); e.type = 'ELLIPSOID'; e.co = co; e.radius = 1; e.size_x, e.size_y, e.size_z = a, b, c; e.stiffness = 2
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = mo; mo.select_set(True); bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object; ob.name = name; ob.data.materials.append(mat)
    o = Vector(origin); ob.data.transform(Matrix.Translation(-o)); ob.location = o
    return smooth(ob)


def skin(name, P, E, mat, root, origin):
    names = list(P); o = Vector(origin)
    me = bpy.data.meshes.new(name); me.from_pydata([Vector(P[n][0]) - o for n in names], [(names.index(a), names.index(b)) for a, b in E], [])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.location = o
    ob.modifiers.new('skin', 'SKIN').use_smooth_shade = True
    for i, n in enumerate(names): r = P[n][1]; me.skin_vertices[0].data[i].radius = (r, r)
    me.skin_vertices[0].data[names.index(root)].use_root = True
    ob.modifiers.new('sub', 'SUBSURF').levels = 1   # one level is smooth enough for animals seen from a car
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    ob.data.materials.append(mat); return smooth(ob)


def attach(o, parent):
    if parent: bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def sphere(loc, r, mat, scale=(1, 1, 1), parent=None, seg=12):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=max(6, seg * 2 // 3))
    o = bpy.context.active_object; o.scale = scale; bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mat)
    return attach(smooth(o), parent)


def cone(loc, r, depth, mat, rot=(0, 0, 0), parent=None, tip=.08):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r, radius2=r * tip, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.data.materials.append(mat); return attach(smooth(o), parent)


def eyes(y, z, dx, r, iris, black, parent, white=None):
    for s in (1, -1):
        if white: sphere((s * dx, y, z), r * 1.15, white, (1, .6, 1), parent)
        sphere((s * dx, y - r * .3, z), r, iris, (1, .7, 1), parent); sphere((s * dx * 1.02, y - r * .85, z), r * .5, black, (1, .6, 1), parent)


def lion():
    fur, light, mane, dark = material('Fur', '#d29a48'), material('LightFur', '#f1d6a2'), material('Mane', '#8a4a1c', .95), material('Dark', '#3b2418', .6)
    amber, black, pink = material('Amber', '#f0b020', .3), material('Black', '#111111', .3), material('Mouth', '#b8434a', .6)
    teeth = material('Teeth', '#fbf6ea', .4)
    body = blob('Body', [((0, .58, .9), (.3, .4, .32)), ((0, .05, .9), (.32, .5, .33)), ((0, -.48, .96), (.34, .34, .4)),
                         ((0, -.78, 1.08), (.2, .22, .22)), ((0, -1.0, 1.16), (.22, .24, .21)), ((0, -1.2, 1.08), (.14, .15, .11))], fur, .055)
    sphere((0, -.2, .74), .3, light, (.95, 1.6, .55), body)                      # light belly
    sphere((0, -1.24, 1.07), .12, light, (1.15, .9, .75), body)                  # light muzzle
    sphere((0, -1.36, 1.13), .05, dark, (1.4, .8, .8), body)                     # nose
    sphere((0, -1.26, 1.03), .07, pink, (1.2, .8, .5), body)                     # inside the mouth (seen when the jaw opens)
    eyes(-1.16, 1.21, .1, .038, amber, black, body, white=light)
    for s in (1, -1): sphere((s * .16, -.86, 1.36), .065, fur, (1, .55, 1), body)   # round ears (hidden in a lion's mane)
    # the mane: a big shaggy ring of blobs round the head and down the chest (a separate object so lionesses can hide it)
    mparts = [((0, -.78, 1.16), (.44, .26, .46)), ((0, -.62, .96), (.4, .3, .4)), ((0, -.72, 1.48), (.3, .22, .2))]
    for k in range(10):
        a = k / 10 * math.pi * 2; mparts.append(((math.cos(a) * .36, -.86, 1.12 + math.sin(a) * .36), (.17, .2, .17)))
    mn = blob('Mane', mparts, mane, .05, origin=(0, -.78, 1.1))
    # the lower jaw, hinged under the ears
    jaw = blob('Jaw', [((0, -1.17, .99), (.12, .15, .05))], light, .02, origin=(0, -1.0, 1.03))
    for s in (1, -1): cone((s * .06, -1.27, 1.03), .016, .05, teeth, (0, 0, 0), jaw)                        # bottom fangs
    for s in (1, -1): cone((s * .06, -1.3, 1.05), .017, .055, teeth, (math.pi, 0, 0), body)                 # top fangs
    for s, nm in ((1, 'L'), (-1, 'R')):
        skin('LegF' + nm, {'sh': ((s * .2, -.48, .9), .16), 'el': ((s * .21, -.52, .5), .12), 'wr': ((s * .21, -.54, .14), .09), 'pw': ((s * .21, -.64, .07), .1)},
             [('sh', 'el'), ('el', 'wr'), ('wr', 'pw')], fur, 'sh', origin=(s * .2, -.48, .9))
        skin('LegB' + nm, {'hip': ((s * .2, .55, .9), .2), 'th': ((s * .22, .64, .58), .17), 'hk': ((s * .21, .74, .26), .09), 'pw': ((s * .21, .64, .07), .1)},
             [('hip', 'th'), ('th', 'hk'), ('hk', 'pw')], fur, 'hip', origin=(s * .2, .55, .9))
    tail = skin('Tail', {'t0': ((0, .88, .98), .06), 't1': ((0, 1.25, .86), .045), 't2': ((0, 1.55, .58), .035), 't3': ((0, 1.66, .4), .03)},
                [('t0', 't1'), ('t1', 't2'), ('t2', 't3')], fur, 't0', origin=(0, .88, .98))
    sphere((0, 1.68, .36), .08, dark, (1, 1, 1.4), tail)                          # the dark tuft
    return body


def monkey():
    fur, face, dark = material('MonkeyFur', '#6e4a2c'), material('Face', '#ebc79c', .7), material('DarkFur', '#3e2817')
    white, black = material('White', '#ffffff', .25), material('Black', '#111111', .3)
    body = blob('Body', [((0, .08, .44), (.15, .22, .16)), ((0, -.14, .5), (.16, .15, .17)), ((0, -.33, .64), (.15, .14, .15)),
                         ((0, -.24, .56), (.08, .08, .08))], fur, .022)
    sphere((0, -.44, .63), .1, face, (1.15, .5, 1.05), body)                     # face
    sphere((0, -.49, .58), .06, face, (1.1, .7, .7), body)                       # muzzle
    sphere((0, -.13, .44), .1, face, (1, 1.2, .9), body)                         # belly
    sphere((0, -.535, .565), .028, dark, (1.6, .6, .5), body)                    # mouth
    eyes(-.49, .66, .045, .024, white, black, body)
    for s in (1, -1): sphere((s * .15, -.32, .67), .05, face, (.45, 1, 1.1), body)   # big round ears
    for s, nm in ((1, 'L'), (-1, 'R')):
        a = skin('Arm' + nm, {'sh': ((s * .12, -.17, .52), .05), 'el': ((s * .14, -.22, .29), .04), 'wr': ((s * .14, -.22, .07), .033)},
                 [('sh', 'el'), ('el', 'wr')], fur, 'sh', origin=(s * .12, -.17, .52))
        sphere((s * .14, -.25, .04), .04, face, (1, 1.3, .6), a)                 # hand
        l = skin('Leg' + nm, {'hip': ((s * .11, .2, .42), .065), 'kn': ((s * .13, .27, .23), .05), 'an': ((s * .13, .2, .07), .035)},
                 [('hip', 'kn'), ('kn', 'an')], fur, 'hip', origin=(s * .11, .2, .42))
        sphere((s * .13, .15, .04), .042, face, (1, 1.5, .55), l)                # foot
    skin('Tail', {'t0': ((0, .28, .46), .03), 't1': ((0, .55, .5), .026), 't2': ((0, .78, .66), .022), 't3': ((0, .86, .88), .019),
                  't4': ((0, .78, 1.0), .017), 't5': ((0, .7, .94), .015)},
         [('t0', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5')], fur, 't0', origin=(0, .28, .46))
    return body


ANIMALS = {'lion': lion, 'monkey': monkey}


def export(key):
    out = os.path.join(HERE, '..', key + '.glb')
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(out, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(out + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/jungle_animals.py from {key}.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {out}: {os.path.getsize(out) / 1e3:.0f} kB, {tris} triangles', flush=True)


def render(path, key):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 24; scn.render.resolution_x, scn.render.resolution_y = 600, 450
    k = 3.2 if key == 'lion' else 1.5
    bpy.ops.object.camera_add(location=(-1.0 * k, -1.25 * k, .55 * k)); cam = bpy.context.active_object; scn.camera = cam
    d = Vector((0, -.1 * k, .28 * k)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 45
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-40))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.data.materials.append(material('Floor', '#9aa0a6', 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    which = argv[argv.index('--animal') + 1] if '--animal' in argv else 'all'
    for key in (ANIMALS if which == 'all' else [which]):
        bpy.ops.wm.read_factory_settings(use_empty=True); ANIMALS[key]()
        if '--render' in argv:
            render(os.path.join(argv[argv.index('--render') + 1], key + '.png'), key); bpy.ops.wm.read_factory_settings(use_empty=True); ANIMALS[key]()
        export(key)
