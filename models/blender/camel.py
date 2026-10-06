# A friendly low-poly camel for the Dubai desert, built with Blender's Skin modifier: a stick skeleton of vertices with
# a radius at each one grows a smooth body round it, then a subdivision pass rounds it off. A red-and-gold saddle
# blanket and tassels go on the hump.
#
#   blender -b --factory-startup --python models/blender/camel.py -- [--render out.png]
#
# Writes models/camel.glb (Draco) and models/camel.glb.js (base64, loadable from file://, key 'camel').
# The camel faces glTF +Z (Blender -Y) and stands on y = 0, about 2.9 m tall at the head.
import bpy, bmesh, base64, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'camel.glb')


def material(name, rgb, rough=.8, metal=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m


def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def skin_body():
    # (name, position (x, y, z) with the head towards -y, radius)
    P = {
        'tail': ((0, .98, 1.68), .30), 'rump': ((0, .55, 1.86), .48), 'mid': ((0, .02, 1.88), .52), 'chest': ((0, -.62, 1.80), .44),
        'hump': ((0, .08, 2.28), .40), 'humptop': ((0, .1, 2.56), .16),
        'neck0': ((0, -.98, 1.86), .26), 'neck1': ((0, -1.3, 2.08), .19), 'neck2': ((0, -1.46, 2.52), .16), 'head0': ((0, -1.52, 2.86), .17),
        'head1': ((0, -1.86, 2.86), .15), 'snout': ((0, -2.14, 2.76), .11),
        'tail1': ((0, 1.22, 1.5), .06), 'tail2': ((0, 1.27, 1.08), .045),
    }
    E = [('tail', 'rump'), ('rump', 'mid'), ('mid', 'chest'), ('mid', 'hump'), ('hump', 'humptop'), ('chest', 'neck0'), ('neck0', 'neck1'),
         ('neck1', 'neck2'), ('neck2', 'head0'), ('head0', 'head1'), ('head1', 'snout'), ('tail', 'tail1'), ('tail1', 'tail2')]
    for s, x in (('L', 1), ('R', -1)):   # legs: knobbly knees, big flat feet
        for leg, y0, top in (('f', -.58, 'chest'), ('b', .62, 'rump')):
            P[f'{leg}{s}0'] = ((x * .27, y0, 1.52), .21 if leg == 'f' else .24)
            P[f'{leg}{s}1'] = ((x * .3, y0 - .02, .86), .12)
            P[f'{leg}{s}2'] = ((x * .3, y0 + .02, .2), .075)
            P[f'{leg}{s}3'] = ((x * .3, y0 - .06, .06), .13)
            E += [(top, f'{leg}{s}0'), (f'{leg}{s}0', f'{leg}{s}1'), (f'{leg}{s}1', f'{leg}{s}2'), (f'{leg}{s}2', f'{leg}{s}3')]
        P[f'ear{s}'] = ((x * .12, -1.5, 3.02), .05); E.append(('head0', f'ear{s}'))
    names = list(P)
    me = bpy.data.meshes.new('camel'); me.from_pydata([P[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in E], [])
    ob = bpy.data.objects.new('Camel', me); bpy.context.collection.objects.link(ob)
    sk = ob.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    for i, n in enumerate(names):
        r = P[n][1]; me.skin_vertices[0].data[i].radius = (r, r * (1.12 if n in ('mid', 'rump', 'chest') else 1))
    me.skin_vertices[0].data[names.index('mid')].use_root = True
    ob.modifiers.new('sub', 'SUBSURF').levels = 2
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    ob.data.materials.append(material('Fur', srgb('#c8955a'), .95))
    return ob


def box(name, mat, loc, size, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat); return o


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = skin_body()
    red, gold, dark, eye = material('Blanket', srgb('#c8141b'), .8), material('Gold', srgb('#e2b23a'), .35, .6), material('Hoof', srgb('#3a2a1c'), .9), material('Eye', srgb('#111111'), .2)
    # saddle blanket draped over the hump: a bent plate with a gold border and tassels
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.64, depth=1.1, location=(0, .08, 1.98), rotation=(0, math.pi / 2, 0))
    bl = bpy.context.active_object; bl.name = 'Blanket'; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(bl.data)
    for f in [f for f in bm.faces if f.calc_center_median().z < 1.72 or abs(f.normal.x) > .9]: bm.faces.remove(f)   # keep the top of the tube, open ends
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS'); bm.to_mesh(bl.data); bm.free()
    sol = bl.modifiers.new('solid', 'SOLIDIFY'); sol.thickness = .03
    bpy.context.view_layer.objects.active = bl; bpy.ops.object.modifier_apply(modifier='solid'); bl.data.materials.append(red)
    for s in (1, -1):
        for y in (-.4, -.13, .14, .41):   # gold tassels along the blanket's hem
            bpy.ops.mesh.primitive_uv_sphere_add(radius=.06, location=(s * .62, y + .08, 1.72), segments=8, ring_count=6)
            bpy.context.active_object.data.materials.append(gold)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=.04, location=(s * .12, -1.95, 2.95), segments=8, ring_count=6)
        bpy.context.active_object.data.materials.append(eye)
        for y in (-.64, .56):
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.14, depth=.08, location=(s * .3, y, .04))
            bpy.context.active_object.data.materials.append(dark)
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
        f.write("// Generated by models/blender/camel.py from camel.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['camel'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {OUT}: {os.path.getsize(OUT) / 1e3:.0f} kB, {tris} triangles', flush=True)


def render(path):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 48; scn.render.resolution_x, scn.render.resolution_y = 900, 700
    bpy.ops.object.camera_add(location=(-5.6, -5.2, 3.0)); cam = bpy.context.active_object; scn.camera = cam
    d = Vector((0, -.2, 1.6)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 40
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-40))); bpy.context.active_object.data.energy = 4
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (*srgb('#f3dcae'), 1)
    bpy.ops.mesh.primitive_plane_add(size=40); bpy.context.active_object.data.materials.append(material('Sand', srgb('#ecc98c'), 1))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build()
    if '--render' in argv:
        # render a copy, then rebuild so the export holds only the camel
        render(argv[argv.index('--render') + 1]); build()
    export()
