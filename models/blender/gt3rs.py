# Porsche 911 GT3 RS (992) for Amboola — built entirely by script in Blender 4.2.
#
#   blender -b --factory-startup --python models/blender/gt3rs.py -- --glb models/gt3rs.glb [--renders DIR] [--blend FILE]
#
# Modelling approach: the body is a loft of 16 cross-sections (a low-poly cage) smoothed with Catmull-Clark
# subdivision, wheel wells are cut with boolean cylinders, and details (vents, louvres, intakes, light bar,
# skirts) are "decals": patches ray-cast onto the body surface. Units are metres, car front = +X while
# building; at export the car is turned so it faces glTF +Z (the game's forward axis).
#
# Contract with the game (index.html, loadCarModels):
#   objects  Body, Wheel_FL/FR/RL/RR (origin at the hub, spin about the lateral axis), Caliper_FL/FR/RL/RR
#   materials Paint (recoloured by the garage), Glass, Headlight, Taillight (driven by the game's lights)
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
GLB, RENDERS, BLEND = arg('--glb'), arg('--renders'), arg('--blend')
SAMPLES = int(arg('--samples', '48'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def material(name, color, metal=0.0, rough=0.5, coat=0.0, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.03
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'
    return m

M = {
    'Paint':     material('Paint', (0.888, 0.539, 0.005), metal=0.15, rough=0.3, coat=1.0),   # Racing Yellow (game recolours)
    'Glass':     material('Glass', (0.01, 0.012, 0.015), rough=0.04, coat=1.0),
    'Black':     material('Black', (0.012, 0.012, 0.013), rough=0.55),
    'Gloss':     material('GlossBlack', (0.008, 0.008, 0.009), rough=0.12, coat=1.0),
    'Carbon':    material('Carbon', (0.022, 0.023, 0.026), metal=0.0, rough=0.4, coat=0.5),
    'Chrome':    material('Chrome', (0.85, 0.86, 0.88), metal=1.0, rough=0.12),
    'Titanium':  material('Titanium', (0.45, 0.42, 0.40), metal=1.0, rough=0.3),
    'Headlight': material('Headlight', (0.9, 0.92, 0.95), rough=0.05, emit=(1, 0.97, 0.92), strength=2.0),
    'Taillight': material('Taillight', (0.35, 0.0, 0.0), rough=0.15, emit=(1, 0.02, 0.01), strength=3.0),
    'Tire':      material('Tire', (0.025, 0.025, 0.027), rough=0.9),
    'Rim':       material('Rim', (0.05, 0.05, 0.055), metal=0.9, rough=0.35),           # satin black forged
    'RimLip':    material('RimLip', (0.7, 0.71, 0.73), metal=1.0, rough=0.2),
    'Disc':      material('Disc', (0.18, 0.18, 0.19), metal=0.9, rough=0.45),
    'Caliper':   material('Caliper', (0.85, 0.62, 0.02), metal=0.1, rough=0.35, coat=0.6),  # yellow PCCB
}

def link(obj):
    scene.collection.objects.link(obj); return obj

def mesh_obj(name, bm, mat=None, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if mat is not None: me.materials.append(M[mat] if isinstance(mat, str) else mat)
    for p in me.polygons: p.use_smooth = smooth
    return link(bpy.data.objects.new(name, me))

def activate(obj):
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)

def apply_mods(obj):
    activate(obj)
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)

def lerp(a, b, t): return a + (b - a) * t
def interp(table, x, key):  # piecewise-linear lookup in a station table (sorted by x descending)
    for a, b in zip(table, table[1:]):
        if b['x'] <= x <= a['x']:
            t = (x - a['x']) / (b['x'] - a['x']); return lerp(a[key], b[key], t)
    return table[0][key] if x > table[0]['x'] else table[-1][key]

# ---------------------------------------------------------------- body: lofted cage + subdivision
# Each station describes one half cross-section (y >= 0), bottom-centre -> top-centre:
#  zb bottom | w,zs widest point | wb,zbl beltline | wg,zg fender crown (front) or window base (cabin)
#  wr,zr hood valley (front) or roof edge (cabin) | zt centre top
COLS = 'x zb w zs wb zbl wg zg wr zr zt'.split()
ST = [dict(zip(COLS, r)) for r in [
    ( 2.27, .27, .66, .41, .64, .47, .55, .50, .30, .51, .505),
    ( 2.20, .18, .84, .45, .82, .55, .68, .625, .44, .565, .555),
    ( 2.05, .155, .89, .50, .875, .64, .71, .725, .50, .615, .60),
    ( 1.80, .15, .915, .55, .90, .72, .73, .785, .52, .67, .655),
    ( 1.50, .15, .925, .585, .91, .77, .745, .83, .53, .715, .70),
    ( 1.22, .15, .93, .61, .915, .80, .755, .855, .53, .755, .74),
    ( 0.92, .13, .92, .625, .905, .845, .77, .89, .52, .835, .82),
    ( 0.58, .13, .905, .615, .89, .865, .78, .955, .60, 1.07, 1.095),
    ( 0.24, .13, .895, .60, .88, .875, .75, 1.09, .635, 1.27, 1.285),
    (-0.30, .13, .895, .60, .88, .885, .735, 1.115, .64, 1.29, 1.305),
    (-0.74, .13, .925, .62, .90, .905, .725, 1.095, .62, 1.255, 1.27),
    (-1.04, .15, .95, .655, .915, .935, .705, 1.035, .585, 1.165, 1.18),
    (-1.25, .17, .955, .675, .92, .955, .685, 1.00, .55, 1.08, 1.095),
    (-1.60, .20, .945, .69, .905, .965, .66, .99, .50, 1.018, 1.03),
    (-1.95, .25, .905, .70, .865, .955, .62, .98, .45, .988, 1.00),
    (-2.19, .30, .82, .68, .78, .925, .55, .955, .36, .953, .965),
    (-2.30, .37, .62, .63, .58, .86, .44, .885, .25, .873, .885),
]]
def half_loop(s):
    return [(0, s['zb']), (s['w'] * .74, s['zb']), (s['w'] * .91, lerp(s['zb'], s['zs'], .17)), (s['w'] * .985, lerp(s['zb'], s['zs'], .70)),
            (s['w'], s['zs']), (s['wb'], s['zbl']), (s['wg'], s['zg']), (s['wr'], s['zr']), (0, s['zt'])]
def full_loop(s):
    h = half_loop(s)
    return [Vector((s['x'], y, z)) for y, z in h] + [Vector((s['x'], -y, z)) for y, z in reversed(h[1:-1])]

bm = bmesh.new()
rings = [[bm.verts.new(p) for p in full_loop(s)] for s in ST]
n = len(rings[0])
for a, b in zip(rings, rings[1:]):
    for j in range(n):
        bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
if max(bm.faces, key=lambda f: f.calc_center_median().z).normal.z < 0:   # make sure the shell faces outward
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
crease = bm.edges.layers.float.new('crease_edge')
def ring_edges(r): return [bm.edges.get((r[j], r[(j + 1) % n])) for j in range(n)]
for e in ring_edges(rings[0]): e[crease] = 0.55          # front face edge
for e in ring_edges(rings[-1]): e[crease] = 0.75         # Kamm-tail rear face edge
for a, b in zip(rings, rings[1:]):                      # longitudinal lines: sill (p2) and beltline (p5)
    for j in (2, 5, n - 2, n - 5): bm.edges.get((a[j], b[j]))[crease] = 0.35
    if a[0].co.x > 0.7:                                 # front lid shut line + fender crowns stay crisp
        for j in (6, 7, n - 6, n - 7): bm.edges.get((a[j], b[j]))[crease] = 0.3
body = mesh_obj('Body', bm, 'Paint')
for k in ['Glass', 'Black', 'Gloss', 'Carbon', 'Chrome', 'Headlight', 'Taillight', 'Titanium']:
    body.data.materials.append(M[k])
MI = {m.name: i for i, m in enumerate(body.data.materials)}
sub = body.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = sub.render_levels = 3
apply_mods(body)

# ---- wheel wells (boolean pockets) — wells get the cutter's black material
WHEELS = dict(F=dict(x=1.22, r=0.350, w=0.275, y=0.775, rim=0.254), R=dict(x=-1.24, r=0.367, w=0.335, y=0.785, rim=0.267))
for k, wd in WHEELS.items():
    for s in (1, -1):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=wd['r'] + .055, radius2=wd['r'] + .055, depth=0.9)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(wd['x'], s * (wd['y'] + .32), wd['r'] + .01))
        cut = mesh_obj('cut', bm, 'Black', smooth=False)
        mod = body.modifiers.new('arch', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'; mod.material_mode = 'TRANSFER'
        apply_mods(body); bpy.data.objects.remove(cut)
for p in body.data.polygons: p.use_smooth = True

# ---------------------------------------------------------------- decals: patches ray-cast onto the body
deps = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(body, deps)
parts = []
def V(*a): return Vector(a)
def project(name, mat, fn, nu, nv, off=.004):
    """fn(u, v) -> (ray origin, ray direction) for u, v in [0, 1]. Builds a quad patch on the first surface hit,
    lifted `off` metres along the surface normal and wound so its faces point the same way as the body."""
    bm = bmesh.new(); grid = []; nsum = Vector()
    for i in range(nu + 1):
        row = []
        for j in range(nv + 1):
            o, d = fn(i / nu, j / nv)
            hit = bvh.ray_cast(Vector(o), Vector(d).normalized(), 20)
            if hit[0] is None: row.append(None); continue
            row.append(bm.verts.new(hit[0] + hit[1] * off)); nsum += hit[1]
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            if all(q):
                try: bm.faces.new(q)
                except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bm.normal_update()
    if sum((f.normal.dot(nsum) for f in bm.faces), 0) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    obj = mesh_obj(name, bm, mat); parts.append(obj); return obj
VIEW = {'front': lambda a, b: (V(4, a, b), V(-1, 0, 0)), 'rear': lambda a, b: (V(-4, a, b), V(1, 0, 0)),
        'top': lambda a, b: (V(a, b, 4), V(0, 0, -1)), 'right': lambda a, b: (V(a, 4, b), V(0, -1, 0)),
        'left': lambda a, b: (V(a, -4, b), V(0, 1, 0))}
def decal(name, mat, view, u0, u1, v0, v1, nu=12, nv=4, off=.004):
    """axis-aligned patch: (u, v) span the rectangle as seen from `view`"""
    return project(name, mat, lambda u, v: VIEW[view](lerp(u0, u1, u), lerp(v0, v1, v)), nu, nv, off)
def side(s): return 'right' if s > 0 else 'left'
def both(fn):  # mirror helper for symmetric left/right decals
    fn(1); fn(-1)
def pl(pts, x):  # piecewise-linear curve through (x, value) points, any x order
    pts = sorted(pts)
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return lerp(y0, y1, (x - x0) / (x1 - x0))
    return pts[-1][1]
def disc_map(u, v):  # unit square -> unit disc, keeps a clean quad grid (no pole)
    x, y = u * 2 - 1, v * 2 - 1
    return x * math.sqrt(1 - y * y / 2), y * math.sqrt(1 - x * x / 2)
def oval(name, mat, centre, facing, rx, ry, off, n=10, ring=None):
    """oval patch projected along -facing; ring=(inner scale) makes an annulus instead"""
    f = Vector(facing).normalized(); e1 = Vector((0, 0, 1)).cross(f).normalized(); e2 = f.cross(e1)
    c = Vector(centre)
    if ring:
        fn = lambda u, v: (c + f * 1.5 + (e1 * rx * math.cos(u * 2 * math.pi) + e2 * ry * math.sin(u * 2 * math.pi)) * lerp(ring, 1, v), -f)
        return project(name, mat, fn, 48, 2, off)
    def fn(u, v):
        x, y = disc_map(u, v); return c + f * 1.5 + e1 * rx * x + e2 * ry * y, -f
    return project(name, mat, fn, n, n, off)

# ---- glasshouse: windscreen, side windows (door glass + quarter glass), rear window, all with black surrounds
WS_N = V(0.50, 0, 0.87).normalized()                                  # windscreen normal (rake ~60 deg)
def ws(u, v, grow=0.0):
    y = lerp(-1, 1, u) * lerp(0.60 + grow, 0.53 + grow, v)
    x = lerp(0.90 + grow * .6, 0.23 - grow * .6, v) - 0.20 * (y / 0.6) ** 2 * (1 - v * .6)
    p = V(x, y, 0.86 + (0.90 - x) * 0.57)
    return p + WS_N * 2, -WS_N
project('ws_trim', 'Gloss', lambda u, v: ws(u, v, 0.035), 20, 10, off=.003)
project('windscreen', 'Glass', ws, 20, 10, off=.005)
RW_N = V(-0.36, 0, 0.93).normalized()
def rw(u, v, grow=0.0):
    y = lerp(-1, 1, u) * lerp(0.40 + grow, 0.47 + grow, v)
    x = lerp(-1.42 - grow * .5, -0.80 + grow * .5, v) + 0.06 * (y / 0.45) ** 2
    p = V(x, y, 1.02 + (x + 1.42) * 0.36)
    return p + RW_N * 2, -RW_N
project('rw_trim', 'Gloss', lambda u, v: rw(u, v, 0.03), 16, 8, off=.003)
project('rearwindow', 'Glass', rw, 16, 8, off=.005)
DLO_TOP = [(0.62, 0.90), (0.42, 1.03), (0.16, 1.205), (-0.20, 1.237), (-0.55, 1.212), (-0.84, 1.105), (-1.02, 0.985)]
DLO_BOT = [(0.62, 0.895), (-0.40, 0.917), (-0.86, 0.945), (-1.02, 0.975)]
def dlo(s, grow=0.0):
    def fn(u, v):
        x = lerp(0.62 + grow * 1.6, -1.02 - grow * 1.8, u)
        zb, zt = pl(DLO_BOT, x) - grow, pl(DLO_TOP, x) + grow
        zt = max(zt, zb + .012)
        return VIEW[side(s)](x, lerp(zb, zt, v))
    return fn
for s in (1, -1):
    project('dlo_trim', 'Gloss', dlo(s, 0.022), 40, 8, off=.003)
    project('sideglass', 'Glass', dlo(s), 40, 8, off=.005)
    decal('bpillar', 'Gloss', side(s), -0.53, -0.505, 0.90, 1.24, 1, 8, off=.007)   # divider: door glass | quarter glass
# carbon roof (Weissach package) between windscreen header and rear window
decal('roof', 'Carbon', 'top', -0.70, 0.17, -0.50, 0.50, 16, 12, off=.003)

# front bumper: big RS intakes, centre radiator mouth, carbon splitter lip
decal('intakeC', 'Gloss', 'front', -0.40, 0.40, 0.235, 0.40, 16, 5)
both(lambda s: decal('intakeS', 'Gloss', 'front', s * 0.48, s * 0.74, 0.235, 0.44, 8, 6))
decal('splitter', 'Carbon', 'front', -0.82, 0.82, 0.19, 0.228, 30, 2)
# hood nostril vents (two big outlets ahead of the windscreen of the 992 RS) + slats
both(lambda s: decal('hoodvent', 'Gloss', 'top', 1.62, 2.00, s * 0.08, s * 0.34, 8, 6))
for k in range(4):
    both(lambda s, k=k: decal('hoodslat', 'Carbon', 'top', 1.62, 2.00, s * (0.11 + k * .065), s * (0.125 + k * .065), 8, 1, off=.010))
# front fender-top louvres
for k in range(7):
    both(lambda s, k=k: decal('louvre', 'Gloss', 'top', 0.98 + k * .062, 1.012 + k * .062, s * 0.62, s * 0.84, 1, 5))
# fender exit vent behind the front wheel, intake ahead of the rear wheel
both(lambda s: project('archvent', 'Gloss', lambda u, v: VIEW[side(s)](lerp(0.70, 0.79, u) - v * .05, lerp(0.42, 0.70, v)), 3, 8))
both(lambda s: project('sideintake', 'Gloss', lambda u, v: VIEW[side(s)](lerp(-0.70, -0.86, u) - v * .08, lerp(0.56, 0.74, v)), 6, 6))
# engine-lid grille with carbon slats, the full-width light bar, rear bumper, diffuser
decal('enginegrille', 'Gloss', 'top', -2.12, -1.68, -0.50, 0.50, 6, 12)
for k in range(9):
    decal('engineslat', 'Carbon', 'top', -2.10 + k * .048, -2.084 + k * .048, -0.48, 0.48, 1, 12, off=.010)
def tailband(z0, z1, ang):  # rays fanned out from inside the tail so the band wraps round the corners
    return lambda u, v: (V(-1.55, 0, lerp(z0, z1, v)), V(-math.cos(lerp(-ang, ang, u)), math.sin(lerp(-ang, ang, u)), 0))
project('taillight_bg', 'Gloss', tailband(0.835, 0.915, 0.86), 60, 3, off=.003)
project('taillight', 'Taillight', tailband(0.856, 0.890, 0.84), 60, 2, off=.006)
project('rearpanel', 'Gloss', tailband(0.47, 0.66, 0.60), 30, 4)
project('diffuser', 'Carbon', tailband(0.35, 0.47, 0.60), 30, 3)
# side skirts, door shut lines + flush handle
both(lambda s: decal('skirt', 'Carbon', side(s), -0.92, 0.86, 0.163, 0.235, 30, 2))
for xg in (0.64, -0.62):
    both(lambda s, xg=xg: decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.25, 0.89, 1, 12, off=.002))
both(lambda s: decal('handle', 'Black', side(s), -0.40, -0.26, 0.835, 0.855, 4, 1, off=.003))

def place_on_surface(origin, direction):
    hit = bvh.ray_cast(Vector(origin), Vector(direction).normalized(), 10)
    return hit[0], hit[1]

# ---- headlights: oval lens in a gloss-black surround with the 4-point LED signature, on the fender fronts
for s in (1, -1):
    c, f = V(2.03, s * 0.62, 0.69), V(0.72, s * 0.22, 0.66)
    oval('headlight_ring', 'Gloss', c, f, 0.128, 0.104, .004, ring=0.80)
    oval('headlight', 'Chrome', c, f, 0.112, 0.090, .006)
    oval('headlight_core', 'Headlight', c, f, 0.036, 0.030, .009, n=6)
    fn = f.normalized(); e1 = V(0, 0, 1).cross(fn).normalized(); e2 = fn.cross(e1)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        oval('drl', 'Headlight', c + (e1 * math.cos(a) * .070 + e2 * math.sin(a) * .056), f, 0.026, 0.020, .010, n=4)

# ---- mirrors on stalks
for s in (1, -1):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.15, 0.20, 0.095))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.47, s * 1.01, 0.995))
    mir = mesh_obj('mirror', bm, 'Paint'); mir.data.materials.append(M['Gloss'])
    m = mir.modifiers.new('sub', 'SUBSURF'); m.levels = 2; apply_mods(mir)
    for p in mir.data.polygons:
        if p.normal.x < -0.6: p.material_index = 1   # mirror glass faces backwards
    parts.append(mir)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.05, 0.13, 0.025))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.47, s * 0.905, 0.955))
    parts.append(mesh_obj('mirrorstalk', bm, 'Gloss'))

# ---- exhausts: twin centre tailpipes
for s in (1, -1):
    pos, nrm = place_on_surface((-3.5, s * 0.075, 0.40), (1, 0, 0))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=.048, radius2=.048, depth=.16)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(pos.x + .02, s * 0.075, 0.40))
    parts.append(mesh_obj('exhaust', bm, 'Titanium'))
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=24, radius=.044)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(pos.x + .03, s * 0.075, 0.40))
    parts.append(mesh_obj('exhaustin', bm, 'Black'))

# ---- swan-neck wing with DRS flap and big end plates
def airfoil(chord, thick, n=14):
    up, lo = [], []
    for i in range(n + 1):
        t = (1 - math.cos(math.pi * i / n)) / 2
        yt = 5 * thick * (0.2969 * math.sqrt(t) - 0.126 * t - 0.3516 * t ** 2 + 0.2843 * t ** 3 - 0.1036 * t ** 4)
        camber = -0.05 * 4 * t * (1 - t)                     # inverted camber -> downforce
        up.append((t, camber + yt)); lo.append((t, camber - yt))
    pts = up + list(reversed(lo[1:-1]))
    return [(-t * chord, z * chord) for t, z in pts]       # leading edge at local x=0, chord runs towards -x
def wing_element(name, le_x, le_z, chord, thick, aoa, span):
    prof = airfoil(chord, thick)
    ca, sa = math.cos(aoa), math.sin(aoa)
    prof = [(le_x + x * ca - z * sa, le_z + x * sa + z * ca) for x, z in prof]
    bm = bmesh.new()
    a = [bm.verts.new((x, -span / 2, z)) for x, z in prof]; b = [bm.verts.new((x, span / 2, z)) for x, z in prof]
    k = len(prof)
    for i in range(k): bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i]))
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, 'Carbon'); parts.append(o); return o
SPAN = 1.80
wing_element('wing_main', -1.66, 1.32, 0.44, 0.13, math.radians(-7), SPAN)
wing_element('wing_flap', -2.04, 1.405, 0.20, 0.10, math.radians(-22), SPAN)
for s in (1, -1):
    bm = bmesh.new()
    pts = [(-1.60, 1.29), (-1.63, 1.45), (-2.18, 1.49), (-2.25, 1.36), (-2.05, 1.27)]
    a = [bm.verts.new((x, s * (SPAN / 2 + .005), z)) for x, z in pts]; b = [bm.verts.new((x, s * (SPAN / 2 + .02), z)) for x, z in pts]
    k = len(pts)
    for i in range(k): bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i]))
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(mesh_obj('endplate', bm, 'Carbon', smooth=False))
    # swan neck: a flat carbon blade that rises from the engine lid, arcs over and holds the wing from above
    deck, _ = place_on_surface((-1.66, s * 0.30, 3), (0, 0, -1))
    ctrl = [V(-1.66, 0, deck.z - .03), V(-1.62, 0, 1.20), V(-1.66, 0, 1.42), V(-1.78, 0, 1.45), V(-1.87, 0, 1.38)]
    path = []
    for i in range(len(ctrl) - 1):   # Catmull-Rom through the control points
        p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, len(ctrl) - 1)]
        for k in range(8):
            t = k / 8
            path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    path.append(ctrl[-1])
    bm = bmesh.new(); secs = []
    for i, p in enumerate(path):
        tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        nn = V(-tg.z, 0, tg.x); w = lerp(0.085, 0.055, i / (len(path) - 1)) / 2
        secs.append([bm.verts.new(p + nn * a + V(0, s * 0.30 + b, 0)) for a, b in ((-w, -.011), (w, -.011), (w, .011), (-w, .011))])
    for a, b in zip(secs, secs[1:]):
        for j in range(4): bm.faces.new((a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]))
    bm.faces.new(secs[0]); bm.faces.new(list(reversed(secs[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(mesh_obj('neck', bm, 'Carbon', smooth=False))

# ---- simple dark cabin so the car doesn't look hollow through the glass
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
bmesh.ops.scale(bm, verts=bm.verts, vec=(1.5, 1.3, 0.36)); bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.25, 0, 0.72))
parts.append(mesh_obj('cabin', bm, 'Black', smooth=False))
for s in (1, -1):  # bucket seats + roll cage hoop hint
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.12, 0.48, 0.50)); bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-14), 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.55, s * 0.36, 0.86))
    parts.append(mesh_obj('seat', bm, 'Black', smooth=False))

# join everything into the Body object
activate(body)
for o in parts: o.select_set(True)
bpy.ops.object.join()
body = bpy.context.object; body.name = 'Body'
activate(body); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

# ---------------------------------------------------------------- wheels
def lathe(profile, segments, mat, name, core=None):
    """profile: list of (radius, y) spun around the lateral (Y) axis. Faces point away from the ring of radius
    `core` (a tyre's carcass), or towards the axle when core is None (a rim barrel seen through the spokes)."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, y, 0)) for r, y in profile]
    es = [bm.edges.new((a, b)) for a, b in zip(vs, vs[1:])]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 1, 0), angle=2 * math.pi, steps=segments, use_merge=True)
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median(); r = math.hypot(c.x, c.z) or 1
        out = Vector((-c.x, 0, -c.z)) if core is None else c - Vector((c.x / r * core, 0, c.z / r * core))
        if f.normal.dot(out) < 0: f.normal_flip()
    return mesh_obj(name, bm, mat)
def build_wheel(key, s):
    wd = WHEELS[key]; R, W, RR = wd['r'], wd['w'], wd['rim']; h = W / 2; out = s
    objs = []
    # tyre with rounded shoulders and three tread grooves
    prof = [(RR + .005, -h + .02), (RR + .03, -h), (R - .035, -h + .002), (R - .008, -h + .022), (R, -h + .05)]
    for g in (-0.3, 0, 0.3):
        prof += [(R, g * W - .018), (R - .008, g * W - .012), (R - .008, g * W + .012), (R, g * W + .018)]
    prof += [(R, h - .05), (R - .008, h - .022), (R - .035, h - .002), (RR + .03, h), (RR + .005, h - .02)]
    prof.sort(key=lambda p: p[1])
    objs.append(lathe(prof, 72, 'Tire', 'tire', core=(R + RR) / 2))
    # rim barrel + polished lip
    objs.append(lathe([(RR - .012, -h + .02), (RR - .012, h - .02)], 48, 'Rim', 'barrel'))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=48, radius1=RR + .008, radius2=RR + .008, depth=.016, cap_ends=False)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .02), 0)); objs.append(mesh_obj('lip', bm, 'RimLip'))
    # 10 forged spokes, concave (hub sits deeper than the rim edge)
    for k in range(10):
        a = k * 2 * math.pi / 10
        bm = bmesh.new()
        r0, r1, w0, w1 = 0.065, RR - .004, 0.022, 0.014
        y_in, y_out = out * (h - .075), out * (h - .028)
        quad = [(r0, -w0, y_in), (r1, -w1, y_out), (r1, w1, y_out), (r0, w0, y_in)]
        vs = []
        for dz in (-.012, .012):
            for r, t, yy in quad:
                vs.append(bm.verts.new((r, yy + out * dz, t)))
        f = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
        for ids in f: bm.faces.new([vs[i] for i in ids])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Y'))
        objs.append(mesh_obj('spoke', bm, 'Rim', smooth=False))
    # hub + centre-lock nut
    bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=24, radius1=.075, radius2=.06, depth=.05, cap_ends=True)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .07), 0)); objs.append(mesh_obj('hub', bm, 'Rim'))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=6, radius1=.042, radius2=.036, depth=.05, cap_ends=True)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-out * math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .035), 0)); objs.append(mesh_obj('nut', bm, 'Chrome', smooth=False))
    # brake disc (spins with the wheel)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, segments=48, radius1=RR - .055, radius2=RR - .055, depth=.034, cap_ends=True)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .13), 0)); objs.append(mesh_obj('disc', bm, 'Disc'))
    activate(objs[0])
    for o in objs: o.select_set(True)
    bpy.ops.object.join(); wheel = bpy.context.object
    wheel.name = f'Wheel_{key}{"R" if s < 0 else "L"}'   # profile +Y is the car's left side
    wheel.location = (wd['x'], s * wd['y'], R)
    # caliper: does not spin; front calipers sit behind the axle, rear ones ahead of it
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.22, 0.075, 0.09))
    m = Matrix.Rotation((-1 if key == 'F' else 1) * math.radians(35), 3, 'Y')
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, RR - .085)); bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=m)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, out * (h - .10), 0))
    cal = mesh_obj(f'Caliper_{key}{"R" if s < 0 else "L"}', bm, 'Caliper')
    cm = cal.modifiers.new('bev', 'BEVEL'); cm.width = .02; cm.segments = 2; apply_mods(cal)
    cal.location = wheel.location.copy()
    activate(wheel); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
for key in ('F', 'R'):
    for s in (1, -1): build_wheel(key, s)

# ---------------------------------------------------------------- previews
VIEWS = {'front34': (5.4, -4.3, 1.45), 'rear34': (-5.2, -4.5, 2.0), 'side': (0.05, -8.4, 0.95),
         'top': (0.3, -3.2, 7.6), 'front': (8.2, 0.0, 1.15), 'rear': (-8.2, 0.0, 1.5)}
def renders(folder, views):
    os.makedirs(folder, exist_ok=True)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Punchy'
    # dim studio: soft sky for reflections, a big overhead softbox, two strip lights for the shoulder lines
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; sky = world.node_tree.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(12); sky.sun_rotation = math.radians(200); sky.sun_intensity = 0.2
    world.node_tree.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.06
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    floor = mesh_obj('floor', bm, material('Floor', (0.025, 0.026, 0.028), rough=0.22))
    lights = []
    for loc, sx, sy, power in (((0, 0, 4.5), 6, 3, 1400), ((1.5, -5, 1.6), 7, 0.4, 500), ((-1.5, 5, 1.6), 7, 0.4, 300), ((-6, -1, 2.2), 0.5, 3, 250), ((6, 1.5, 2), 0.5, 3, 200)):
        ld = bpy.data.lights.new('l', 'AREA'); ld.shape = 'RECTANGLE'; ld.size, ld.size_y = sx, sy; ld.energy = power
        L = link(bpy.data.objects.new('l', ld)); L.location = loc; lights.append(L)
        c = L.constraints.new('TRACK_TO'); c.target = body
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); scene.camera = cam; cam.data.lens = 50
    tgt = link(bpy.data.objects.new('tgt', None)); tgt.location = (0, 0, 0.6)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt
    for name in views:
        cam.location = VIEWS[name]; scene.render.filepath = os.path.join(folder, name + '.png')
        bpy.ops.render.render(write_still=True); print('rendered', name, flush=True)
    for o in [floor, cam, tgt] + lights: bpy.data.objects.remove(o)

if RENDERS: renders(RENDERS, arg('--views', 'front34,rear34,side,front').split(','))
if BLEND: bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))

# ---------------------------------------------------------------- export (front +X -> glTF +Z)
if GLB:
    for o in list(scene.objects):
        if o.type != 'MESH': bpy.data.objects.remove(o)
    R = Matrix.Rotation(-math.pi / 2, 4, 'Z')
    for o in scene.objects:
        o.matrix_world = R @ o.matrix_world
    for o in scene.objects:
        activate(o); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for o in scene.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(GLB), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', use_selection=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10)
    tris = sum(len(p.vertices) - 2 for o in scene.objects for p in o.data.polygons)
    # the same bytes as a classic <script>, so the game can load the model from file:// too (fetch can't)
    import base64
    with open(GLB, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    key = os.path.basename(GLB).split('.')[0]
    with open(GLB + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/{key}.py from {os.path.basename(GLB)} - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")
    print(f'exported {GLB}: {os.path.getsize(GLB) / 1e6:.2f} MB, {tris} triangles, objects:', sorted(o.name for o in scene.objects), flush=True)
