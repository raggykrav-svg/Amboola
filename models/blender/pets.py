# More pets for Amboola: a ginger cat, a green parrot and a tiny purple dragon. Smooth bodies are metaballs turned
# into meshes, with small primitives for eyes, ears, beak, horns and spikes. The dragon's wings are separate objects
# (WingL, WingR, origin at the shoulder) so the game can flap them.
#
#   blender -b --factory-startup --python models/blender/pets.py -- [--pet cat|parrot|dragon|all] [--render DIR]
#
# Writes models/<pet>.glb and models/<pet>.glb.js (key '<pet>'). Each faces glTF +Z (Blender -Y) and stands on y = 0.
import bpy, base64, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def material(name, hexcol, rough=.7, emit=0):
    h = hexcol.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = emit
    return m


def blob(name, parts, mat, res=.012):
    """parts: [((x, y, z), (sx, sy, sz))] ellipsoids merged into one smooth mesh"""
    mb = bpy.data.metaballs.new(name + 'Meta'); mb.resolution = res; mb.render_resolution = res
    mo = bpy.data.objects.new(name, mb); bpy.context.collection.objects.link(mo)
    for co, (a, b, c) in parts:
        e = mb.elements.new(); e.type = 'ELLIPSOID'; e.co = co; e.radius = 1; e.size_x, e.size_y, e.size_z = a, b, c; e.stiffness = 2
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = mo; mo.select_set(True); bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object; ob.name = name; ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def sphere(loc, r, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10)
    o = bpy.context.active_object; o.scale = scale; bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o


def cone(loc, r, depth, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, radius2=r * .05, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.data.materials.append(mat); return o


def eyes(y, z, dx, r, white, black):
    for s in (1, -1): sphere((s * dx, y, z), r, white); sphere((s * dx * 1.05, y - r * .7, z), r * .55, black)


def cat():
    fur, cream, pink = material('Fur', '#e8892f'), material('Cream', '#f6e7cf'), material('Pink', '#ff9fb4', .5)
    white, black = material('White', '#ffffff', .2), material('Black', '#121214', .2)
    blob('Cat', [((0, .08, .2), (.13, .2, .13)), ((0, -.12, .26), (.12, .12, .13)), ((0, -.2, .4), (.13, .11, .12)), ((0, -.29, .38), (.06, .05, .045))], fur)
    sphere((0, -.17, .22), .085, cream, (1, .7, 1.1))
    for s in (1, -1):
        cone((s * .075, -.18, .53), .045, .1, fur, (math.radians(-8), math.radians(s * 12), 0)); cone((s * .075, -.195, .52), .025, .06, pink, (math.radians(-8), math.radians(s * 12), 0))
        for y in (-.14, .2): sphere((s * .07, y, .05), .05, fur, (1, 1.2, 1.4))
        for k in (-1, 1):   # whiskers
            bpy.ops.mesh.primitive_cylinder_add(radius=.003, depth=.12, location=(s * .09, -.31, .375 + k * .012), rotation=(0, math.radians(90), math.radians(s * 10 * k))); bpy.context.active_object.data.materials.append(white)
    eyes(-.28, .43, .045, .028, white, black); sphere((0, -.335, .395), .014, pink)
    bpy.ops.curve.primitive_bezier_curve_add(location=(0, 0, 0)); t = bpy.context.active_object; sp = t.data.splines[0]   # the tail curling up
    sp.bezier_points[0].co, sp.bezier_points[0].handle_left, sp.bezier_points[0].handle_right = (0, .26, .2), (0, .2, .18), (0, .34, .22)
    sp.bezier_points[1].co, sp.bezier_points[1].handle_left, sp.bezier_points[1].handle_right = (0, .3, .45), (0, .38, .35), (0, .22, .52)
    t.data.bevel_depth = .025; t.data.bevel_resolution = 3; t.data.materials.append(fur); bpy.ops.object.convert(target='MESH')


def parrot():
    green, yel, red, beak = material('Green', '#2fbf4a'), material('Yellow', '#ffd21f'), material('Red', '#e8231f'), material('Beak', '#2b2b2b', .4)
    white, black = material('White', '#ffffff', .2), material('Black', '#121214', .2)
    blob('Parrot', [((0, .02, .14), (.07, .09, .1)), ((0, -.04, .25), (.065, .065, .07))], green)
    sphere((0, -.06, .14), .05, yel, (1, .8, 1.3))
    for s in (1, -1): sphere((s * .06, .04, .16), .04, red, (.5, 1.6, 1))   # wings
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, .17, .07)); t = bpy.context.active_object; t.scale = (.04, .16, .015); t.rotation_euler = (math.radians(30), 0, 0); t.data.materials.append(red)
    cone((0, -.115, .24), .025, .06, beak, (math.radians(-100), 0, 0))
    eyes(-.09, .28, .035, .016, white, black)
    for s in (1, -1): bpy.ops.mesh.primitive_cylinder_add(radius=.008, depth=.06, location=(s * .03, 0, .03)); bpy.context.active_object.data.materials.append(beak)


def dragon():
    purple, belly, horn = material('Purple', '#8a5cff'), material('Belly', '#ffe08a'), material('Horn', '#fff4d6', .4)
    white, black, wing = material('White', '#ffffff', .2), material('Black', '#121214', .2), material('Wing', '#ff6fb0', .5)
    blob('Dragon', [((0, .05, .2), (.11, .15, .11)), ((0, -.1, .3), (.08, .08, .1)), ((0, -.17, .42), (.11, .1, .1)), ((0, -.28, .4), (.06, .07, .05)),
                    ((0, .2, .17), (.05, .1, .05)), ((0, .32, .14), (.03, .08, .03))], purple)
    sphere((0, -.07, .2), .07, belly, (1, .7, 1.4))
    for s in (1, -1):
        cone((s * .06, -.12, .53), .025, .09, horn, (math.radians(25), math.radians(-s * 15), 0))
        for y in (-.1, .14): sphere((s * .07, y, .07), .04, purple, (1, 1.2, 1.5))
    for y, z in ((.0, .32), (.1, .3), (.2, .24), (.3, .19)): cone((0, y, z), .025, .07, wing, (math.radians(-20), 0, 0))
    eyes(-.26, .46, .05, .03, white, black); sphere((0, -.34, .4), .012, black)
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):   # flapping wings: a thin fan, origin at the shoulder
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=.18, radius2=0, depth=.01, location=(0, 0, 0), rotation=(0, math.radians(90), 0))
        w = bpy.context.active_object; w.name = nm; w.data.materials.append(wing)
        for v in w.data.vertices: v.co.x += s * .16
        w.location = (s * .08, 0, .3)


PETS = {'cat': cat, 'parrot': parrot, 'dragon': dragon}


def export(key):
    out = os.path.join(HERE, '..', key + '.glb')
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(out, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(out + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/pets.py from {key}.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")
    print(f'exported {out}: {os.path.getsize(out) / 1e3:.0f} kB', flush=True)


def render(path):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 24; scn.render.resolution_x, scn.render.resolution_y = 500, 500
    bpy.ops.object.camera_add(location=(-.9, -1.1, .65)); cam = bpy.context.active_object; scn.camera = cam
    d = Vector((0, -.05, .25)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 45
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-40))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    bpy.ops.mesh.primitive_plane_add(size=6); bpy.context.active_object.data.materials.append(material('Floor', '#9aa0a6', 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    which = argv[argv.index('--pet') + 1] if '--pet' in argv else 'all'
    for key in (PETS if which == 'all' else [which]):
        bpy.ops.wm.read_factory_settings(use_empty=True); PETS[key]()
        if '--render' in argv:
            render(os.path.join(argv[argv.index('--render') + 1], key + '.png')); bpy.ops.wm.read_factory_settings(use_empty=True); PETS[key]()
        export(key)
