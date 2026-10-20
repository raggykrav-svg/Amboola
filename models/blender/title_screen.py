# The AMBOOLA title screen: a night-time Tokyo stage. A turntable podium (the game parks your car on it), the big 3D
# AMBOOLA logo in Orbitron Black behind it, a neon grid floor, a striped synthwave sun, the Tokyo skyline with lit
# windows and Tokyo Tower, two light towers with searchlight beams, and two checkered flags.
# Parts the game moves are their own top-level objects:
#   Turntable (spins with your car), BeamL / BeamR (origin at the lamp, they sweep the sky), FlagL / FlagR (wave)
# Materials named Beam are swapped for a soft additive glow in the game.
#
#   blender -b --factory-startup --python models/blender/title_screen.py -- [--render FILE]
#
# Writes models/title.glb and models/title.glb.js (key 'title'). Blender -Y (glTF +Z) faces the camera; the podium top
# is at height 0.36. The font is fonts/Orbitron-Black.ttf (SIL Open Font License, see fonts/Orbitron-OFL.md).
import bpy, base64, math, os, random, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'Orbitron-Black.ttf')
MATS = {}
random.seed(7)


def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]


def mat(name, hexcol, rough=.6, metal=0., emit=0.):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    c = srgb(hexcol); b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = emit
    MATS[name] = m; return m


def active():
    return bpy.context.active_object


def finish(o, m, name):
    o.name = name; o.data.materials.append(m); return o


def box(c, s, m, name='box', rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot); o = active(); o.scale = s
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, name)


def cyl(c, r, d, m, name='cyl', verts=48, rot=(0, 0, 0), r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=c, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=c, rotation=rot)
    return finish(active(), m, name)


def ring(c, R, r, m, name='ring', seg=96):
    bpy.ops.mesh.primitive_torus_add(location=c, major_radius=R, minor_radius=r, major_segments=seg, minor_segments=8)
    o = finish(active(), m, name)
    for p in o.data.polygons: p.use_smooth = True
    return o


def rod(a, b, r, m, name='rod', verts=8):
    a, b = Vector(a), Vector(b); d = b - a
    o = cyl((a + b) / 2, r, d.length, m, name, verts)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def join(objs, name, origin=None):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = active(); o.name = name
    if origin is not None:
        bpy.context.scene.cursor.location = origin; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o


def poly(pts, m, name):
    me = bpy.data.meshes.new(name); me.from_pydata([Vector(p) for p in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(m); return o


def text(body, size, extrude, bevel, m, loc, tilt=90, offset=0., name='text', spacing=1.):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.bevel_depth = bevel; cu.bevel_resolution = 2; cu.offset = offset; cu.resolution_u = 5
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.space_character = spacing
    if os.path.exists(FONT): cu.font = bpy.data.fonts.load(FONT)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.radians(tilt), 0, 0)
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH')
    o = active(); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(m); return o


# ---------------------------------------------------------------- floor, grid and podium
def floor():
    box((0, 10, -.05), (160, 140, .1), mat('Floor', '#07080d', .32, .25), 'Floor')
    grid, cyan = [], mat('GridCyan', '#2fe0ff', emit=3)
    for i in range(-11, 12):   # lines running away from the camera
        grid.append(box((i * 4, 8, .006), (.07, 56, .012), cyan, 'g'))
    for j in range(-5, 10):    # lines across
        grid.append(box((0, -18 + j * 4.5, .006), (88, .07, .012), cyan, 'g'))
    join(grid, 'Grid')


def podium():
    side, top = mat('PodiumSide', '#0c0d11', .25, .85), mat('PodiumTop', '#16181f', .3, .6)
    orange, cyan = mat('RingOrange', '#ff5a1f', emit=7), mat('RingCyan', '#2fe0ff', emit=5)
    base = [cyl((0, 0, .15), 3.35, .3, side, 'base', 96), ring((0, 0, .16), 3.36, .045, orange),
            ring((0, 0, .02), 4.3, .035, cyan), ring((0, 0, .02), 4.7, .02, orange)]
    for k in range(12):   # little lights round the podium edge
        a = k / 12 * math.tau; base.append(cyl((math.cos(a) * 3.37, math.sin(a) * 3.37, .26), .07, .04, cyan, 'led', 12, rot=(math.pi / 2, 0, a + math.pi / 2)))
    join(base, 'Podium')
    tt = [cyl((0, 0, .33), 3.22, .06, top, 'tt', 96), ring((0, 0, .362), 2.95, .03, orange), ring((0, 0, .362), 1.2, .02, cyan)]
    for k in range(8):    # spokes so you can see it turn
        a = k / 8 * math.tau; tt.append(box((math.cos(a) * 2.1, math.sin(a) * 2.1, .362), (1.5, .05, .012), cyan, 'spoke', rot=(0, 0, a)))
    join(tt, 'Turntable', origin=(0, 0, .33))


# ---------------------------------------------------------------- the logo
def logo():
    face, chrome = mat('LogoFace', '#ff4a12', .28, .35, emit=.9), mat('LogoChrome', '#dfe3ea', .14, 1.)
    o = text('AMBOOLA', 2.7, .34, .055, face, (0, 8.5, 5.0), tilt=82, name='Logo', spacing=1.06)
    o.data.materials.append(chrome)
    fwd = Vector((0, -math.cos(math.radians(8)), math.sin(math.radians(8))))   # the way the letters face (toward the camera)
    for p in o.data.polygons: p.material_index = 0 if p.normal.dot(fwd) > .92 else 1
    glow = text('AMBOOLA', 2.7, .03, 0, mat('LogoGlow', '#2fe0ff', emit=6), (0, 9.05, 5.08), tilt=82, offset=.1, name='LogoGlow', spacing=1.06)
    white = mat('Subtitle', '#ffffff', emit=3.5)
    sub = text('TOKYO  OPEN  WORLD', .58, .03, 0, white, (0, 8.0, 2.85), tilt=86, name='Subtitle', spacing=1.25)
    w = sub.dimensions.x / 2 + .6; red = mat('RingOrange', '#ff5a1f')
    bars = [box((s * (w + 2.6 - i * .55), 8.0, 2.85 + (i - 1) * .2), (5 - i * 1.1, .05, .09), red, 'bar') for s in (-1, 1) for i in range(3)]
    join([sub] + bars, 'Subtitle')


# ---------------------------------------------------------------- the city behind
def sun():
    cols = ['#ffe14d', '#ffc23a', '#ff9a2e', '#ff6f3a', '#ff4a6e', '#ea3a96', '#c832b4']
    C, R, parts = Vector((0, 75, 13)), 20, []
    bands = [(R, 7), (6, 2.6), (1.6, -1.1), (-2.1, -4.2), (-5.4, -7.0), (-8.4, -9.6), (-11.2, -12.1)]   # stripes get thinner and the gaps wider lower down
    for k, (z1, z0) in enumerate(bands):
        pts = []
        for i in range(17):   # right edge going down, then left edge going up
            z = z1 - (z1 - z0) * i / 16; x = math.sqrt(max(0, R * R - z * z)); pts.append((C.x + x, C.y, C.z + z))
        pts += [(2 * C.x - p[0], p[1], p[2]) for p in reversed(pts)]
        parts.append(poly(pts, mat(f'Sun{k}', cols[k], emit=3.2), 'band'))
    join(parts, 'Sun')


def skyline():
    dark, parts, wins = mat('Building', '#0b0e16', .8), [], []
    lit = [mat('Window', '#ffd9a0', emit=2.6), mat('WindowCyan', '#8fe8ff', emit=2.2), mat('WindowPink', '#ff7ad9', emit=2.4)]
    red = mat('AirLight', '#ff2a2a', emit=8)
    x = -78
    while x < 78:
        w, d = random.uniform(4, 9), random.uniform(4, 8)
        near = abs(x) < 16   # keep the middle low so the sun shows over the city
        h = random.uniform(5, 11) if near else random.uniform(8, 30) * (1.15 if abs(x) > 40 else 1)
        y = random.uniform(40, 52) + d / 2
        if not (-37 < x < -25):   # room for Tokyo Tower
            parts.append(box((x + w / 2, y, h / 2), (w, d, h), dark, 'bld'))
            m = random.choice(lit); fy = y - d / 2 - .03; z = 1.4
            while z < h - 1:
                cols = int(w / 1.3)
                for c in range(cols):
                    if random.random() < .55: wins.append(box((x + .65 + c * (w - 1.3) / max(1, cols - 1) if cols > 1 else x + w / 2, fy, z), (.6, .06, .45), m, 'win'))
                z += 1.5
            if h > 20: wins.append(cyl((x + w / 2, y, h + .25), .18, .5, red, 'air', 8))
        x += w + random.uniform(.5, 2.5)
    join(parts, 'City'); join(wins, 'Windows')


def tokyo_tower():
    red, white = mat('TowerRed', '#ff4a1f', .5, emit=3.2), mat('TowerWhite', '#fff4e8', .5, emit=2.2)
    X, Y, parts = -31, 58, []
    S = lambda h: 5.2 * (1 - h / 34) ** 1.6 + .25    # half-width of the tower at height h
    for sx in (-1, 1):
        for sy in (-1, 1):
            prev = None
            for h in (0, 6, 12, 17, 22, 27, 31):
                p = (X + sx * S(h), Y + sy * S(h), h)
                if prev: parts.append(rod(prev, p, .22 if h < 18 else .15, red if h % 12 else white, 'leg', 6))
                prev = p
    for h in (6, 12, 17, 22, 27):   # cross braces
        s = S(h)
        for a, b in (((-s, -s), (s, -s)), ((s, -s), (s, s)), ((s, s), (-s, s)), ((-s, s), (-s, -s))):
            parts.append(rod((X + a[0], Y + a[1], h), (X + b[0], Y + b[1], h), .1, red, 'brace', 6))
    parts.append(box((X, Y, 15), (S(15) * 2 + 1, S(15) * 2 + 1, 1.6), white, 'deck'))
    parts.append(box((X, Y, 24.5), (S(24.5) * 2 + .7, S(24.5) * 2 + .7, 1), white, 'deck2'))
    parts.append(cyl((X, Y, 35), .35, 8, red, 'spire', 8, r2=.08))
    join(parts, 'TokyoTower')


# ---------------------------------------------------------------- lights and flags
def light_towers():
    truss, lamp, beam = mat('Truss', '#2a2d35', .45, .7), mat('Lamp', '#fffbe8', emit=14), mat('Beam', '#fff3d0', emit=1)
    for s, nm in ((-1, 'L'), (1, 'R')):
        X, Y, H, parts = s * 13, 20, 9, []
        for dx in (-.5, .5):
            for dy in (-.5, .5): parts.append(rod((X + dx, Y + dy, 0), (X + dx * .6, Y + dy * .6, H), .07, truss, 'post', 6))
        for h in range(1, H, 2):
            parts.append(rod((X - .45, Y - .45, h), (X + .45, Y + .45, h + 1.6), .04, truss, 'x', 6))
        parts.append(box((X, Y, H + .4), (1.8, .8, .9), truss, 'head'))
        for k in range(3): parts.append(cyl((X - .55 + k * .55, Y - .41, H + .4), .22, .04, lamp, 'lens', 16, rot=(math.pi / 2, 0, 0)))
        join(parts, 'LightTower' + nm)
        b = cyl((X, Y, H + .9 + 22), .45, 44, beam, 'Beam' + nm, 24, r2=4.2)   # a cone pointing up; the game swings it from the lamp
        bpy.context.scene.cursor.location = (X, Y, H + .9); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        b.rotation_euler = (math.radians(14), math.radians(s * 24), 0)   # leaning back over the city and out to the side


def flags():
    pole, wht, blk = mat('Pole', '#cfd3da', .2, 1.), mat('CheckW', '#f2f2f2', .7), mat('CheckB', '#111111', .7)
    for s, nm in ((-1, 'L'), (1, 'R')):
        X, Y, H = s * 11.4, 9.5, 8.2
        p = rod((X, Y, 0), (X, Y, H), .07, pole, 'pole', 12)
        cols, rows, W, Hh, cells = 9, 6, 3.4, 2.2, []
        for i in range(cols):
            for j in range(rows):
                q = []
                for (u, v) in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                    x = u / cols * W; z = H - .1 - v / rows * Hh
                    q.append((X - s * (x + .08), Y + .35 * math.sin(x * 1.9) * (x / W), z - .12 * x))   # waves and droops at the free end
                cells.append(poly(q, wht if (i + j) % 2 else blk, 'cell'))
        join(cells, 'Flag' + nm, origin=(X, Y, H)); p.name = 'FlagPole' + nm


def build():
    floor(); podium(); logo(); sun(); skyline(); tokyo_tower(); light_towers(); flags()


def export():
    out = os.path.abspath(os.path.join(HERE, '..', 'title.glb'))
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(out, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(out + '.js', 'w') as f:
        f.write("// Generated by models/blender/title_screen.py from title.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['title'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {out}: {os.path.getsize(out) / 1e3:.0f} kB, {tris} triangles', flush=True)


def render(path):
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 48; scn.render.resolution_x, scn.render.resolution_y = 1280, 720
    scn.view_settings.view_transform = 'AgX'; scn.view_settings.look = 'AgX - Punchy'
    bpy.ops.object.camera_add(location=(0, -11.5, 2.5)); cam = active(); scn.camera = cam; cam.data.lens = 24
    d = Vector((0, 8, 3.4)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.02, .015, .06, 1)
    bpy.ops.object.light_add(type='AREA', location=(0, -6, 7)); L = active(); L.data.energy = 900; L.data.size = 6
    L.rotation_euler = (Vector((0, 4, 2)) - L.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.0)); car = active(); car.scale = (2, 4.4, 1.2)   # a stand-in for the car
    car.data.materials.append(mat('CarStandIn', '#c8141b', .3, .5))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True); build()
    if '--render' in argv:
        render(argv[argv.index('--render') + 1]); bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear(); random.seed(7); build()
    export()
