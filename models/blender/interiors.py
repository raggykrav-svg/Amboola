# Car interiors for the INSIDE camera: one cockpit per brand, modelled from photos of the real cars' cabins.
# A shared kit (dashboard, doors, pillars, roof lining, seats, console, steering wheels) plus each brand's signature
# parts:
#   porsche     five round dials under a curved hood, a flat dash with a silver line, slim screen, toggle row
#   tesla       a long dash strip, one big landscape screen, the yoke
#   lambo       angular dash, hexagon cluster hood, a Y-shaped frame round a tall screen, a red flip cover over the
#               start switch and aviation toggles
#   ferrari     shift lights along the top of the wheel, a red start button and the manettino on it, the gated
#               console "bridge", a passenger display
#   mclaren     a thin dash, the dial pod on the steering column, a floating portrait screen, a plain button-free
#               wheel with a papaya stripe, overhead switches
#   bugatti     the C-line (a silver C from the roof down between the seats), a skeleton console with four round
#               knobs, watch-like dials, a flat-topped wheel, tan leather
#   koenigsegg  carbon everywhere, the small SmartCluster screen on the wheel (it turns with you), orange details
#   toyota      GR86: big round turbine vents at the ends of the dash, three climate knobs, a manual gear lever
#   bmw         one long curved screen from the dials to the middle, red M1/M2 buttons, the M-stripe
#   audi        a wide Virtual Cockpit hood, a red start button on the wheel, round vents, honeycomb seats
#   devel       a fighter-jet cockpit: guarded toggle switches on the console and the roof, green jet displays
#   amg         four round turbine vents in a row, a wide screen on top, V8-style console buttons, wheel dials
#   rolls       the Starlight roof (hundreds of little stars), a glass gallery dash with a clock, organ-stop vent
#               pulls, a big thin wheel, white leather
#   ford        Mustang: one glass panel with two screens, a cue-ball gear knob, blue Dark Horse details
#   chevy       Corvette C8: the squared-off wheel and the tall "wall of buttons" between the seats
#   honda       NSX: the big round Dynamic Mode dial on a floating console and P/R/N/D push buttons, red seats
#   pagani      Utopia: the open metal gear gate with its rods, round aluminium dials and porthole vents, tan leather
#
#   blender -b --factory-startup --python models/blender/interiors.py -- [--brand NAME|all] [--render DIR]
#
# Writes models/int_<brand>.glb and .glb.js (key 'int_<brand>'). Space: the origin is the car's centre line at the
# driver's eye height and eye position; the driver sits on the right (Japan) with the eye at x = -0.40; forward is
# glTF +Z (Blender -Y); nominal cabin width 2.0 m (the game stretches it to the car). Named nodes the game uses:
# Wheel (turns about its own axis), Gauge (the live dials are drawn on it), Screen (the middle screen).
import bpy, bmesh, base64, math, os, random, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
EX, BELT, TOP, FLOOR = -0.40, -0.30, 0.26, -0.95   # eye x, window line, roof lining, floor (relative to the eye)
WC = Vector((EX, -0.50, -0.46))                     # steering wheel centre
MATS = {}


def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]


def mat(name, hexcol, rough=.6, metal=0., emit=0., coat=0.):
    key = (name, hexcol, rough, metal, emit)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    c = srgb(hexcol); b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit: b.inputs['Emission Color'].default_value = (*c, 1); b.inputs['Emission Strength'].default_value = emit
    MATS[key] = m; return m


def link(o, parent=None, m=None):
    if m: o.data.materials.append(m)
    if parent: bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def box(c, s, m, rot=(0, 0, 0), bevel=0., parent=None, name='box'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot); o = bpy.context.active_object; o.name = name; o.scale = s
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # keep the origin at the part, so turning it later turns it in place
    if bevel:
        md = o.modifiers.new('b', 'BEVEL'); md.width = bevel; md.segments = 2; bpy.ops.object.modifier_apply(modifier='b')
    return link(o, parent, m)


def cyl(c, r, d, m, rot=(0, 0, 0), v=20, parent=None, r2=None, name='cyl'):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=c, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=d, location=c, rotation=rot)
    o = bpy.context.active_object; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    return link(o, parent, m)


def sph(c, r, m, sc=(1, 1, 1), parent=None, seg=12):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=c, segments=seg, ring_count=max(6, seg * 2 // 3)); o = bpy.context.active_object
    o.scale = sc; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in o.data.polygons: p.use_smooth = True
    return link(o, parent, m)


def torus(c, R, r, m, rot=(0, 0, 0), parent=None, seg=40):
    bpy.ops.mesh.primitive_torus_add(location=c, rotation=rot, major_radius=R, minor_radius=r, major_segments=seg, minor_segments=10); o = bpy.context.active_object
    for p in o.data.polygons: p.use_smooth = True
    return link(o, parent, m)


def tube(pts, r, m, parent=None, closed=False, res=8, name='tube'):
    """a round tube along a list of points (curve with a bevel, turned into a mesh)"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 2; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object
    for p in o.data.polygons: p.use_smooth = True
    return link(o, parent, m)


def extrude(profile, x0, x1, m, name='panel', parent=None):
    """a closed (y, z) profile pushed across from x0 to x1 (dashboards, door tops)"""
    bm = bmesh.new(); A = [bm.verts.new((x0, y, z)) for y, z in profile]; B = [bm.verts.new((x1, y, z)) for y, z in profile]; n = len(profile)
    for i in range(n): bm.faces.new((A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]))
    bm.faces.new(A[::-1]); bm.faces.new(B)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return link(o, parent, m)


def plane_to(name, c, target, w, h, m, parent=None):
    """a flat screen facing a point, with UVs (u to the viewer's right, v up) so the game can paint on it"""
    c = Vector(c); n = (Vector(target) - c).normalized(); right = Vector((0, 0, 1)).cross(n).normalized(); up = n.cross(right)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    vs = [bm.verts.new(c + right * sx * w / 2 + up * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = (u, v)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return link(o, parent, m)


def beam(a, b, t, m, parent=None):
    a, b = Vector(a), Vector(b); d = b - a
    o = box((a + b) / 2, (t, t, d.length), m, parent=parent, name='beam')
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); return o


def vent_round(c, r, m_ring, m_in, facing=(0, 1, 0), parent=None, fins=5):
    """a round turbine vent: a ring, a dark inside and a few fins"""
    rot = Vector(facing).to_track_quat('Z', 'Y').to_euler()
    torus(c, r, r * .18, m_ring, rot, parent, 28)
    cyl(c, r * .95, .03, m_in, rot, 24, parent)
    for k in range(fins):
        a = k / fins * math.pi
        o = box(c, (r * 1.7, .006, .02), m_ring, parent=parent); o.rotation_euler = rot; o.rotation_euler.rotate_axis('Z', a)


# ---------------------------------------------------------------- the shared cabin
def cabin(c):
    """dash, doors, pillars, roof, floor, console and the passenger seat in the brand's colours"""
    L, A, T = c['leather'], c['accent'], c['trim']
    dark = c.get('dashmat', L)
    # the dashboard: a profile (forward is -y) pushed across the car
    dt = c.get('dash_top', -0.26)
    prof = c.get('dash_prof') or [(-0.70, -0.66), (-0.72, dt - .05), (-0.78, dt), (-0.96, dt - .015), (-1.18, dt - .06), (-1.18, -0.66)]
    extrude(prof, -0.95, 0.95, dark, 'Dash')
    if c.get('dash_line', True):   # a trim line along the dash face
        box((0, -0.705, dt - .12), (1.86, .012, .018), T)
    # doors: panel, rounded top, armrest, handle, speaker
    for s in (-1, 1):
        x = s * 0.93
        box((x, 0.1, (FLOOR + BELT) / 2), (.07, 1.8, BELT - FLOOR), L, bevel=.02)
        box((x - s * .03, 0.1, BELT + .005), (.1, 1.8, .05), dark, bevel=.02)
        box((x - s * .08, 0.05, BELT - .17), (.08, .55, .05), c.get('arm', dark), bevel=.015)
        box((x - s * .05, -0.28, BELT - .06), (.025, .13, .03), T, bevel=.008)
        cyl((x - s * .035, 0.35, BELT - .42), .07, .01, c.get('speaker', T), (0, math.pi / 2, 0), 18)
    # windscreen pillars, the bar over the windscreen, the roof lining, the pillars behind and the mirror
    hz = -0.55
    for s in (-1, 1):
        beam((s * 0.86, -1.10, dt), (s * 0.80, hz, TOP - .03), .085, c.get('pillar', dark))
        box((s * 0.88, 0.55, (TOP + BELT) / 2), (.08, .16, TOP - BELT), c.get('pillar', dark))   # the pillar beside your head
    box((0, hz, TOP - .05), (1.64, .1, .07), c.get('pillar', dark))
    box((0, hz + .75, TOP - .015), (1.68, 1.5, .03), c['roofmat'])
    box((0, hz + .02, TOP - .1), (.02, .02, .07), T)
    mir = box((0, hz + .04, TOP - .155), (.24, .03, .07), dark, bevel=.01)
    box((0, hz + .056, TOP - .155), (.22, .004, .055), MAT_MIRROR())
    # floor and the middle console (between the seats)
    box((0, -0.1, FLOOR), (1.9, 2.4, .02), c.get('floor', mat('Carpet', '#141416', 1)))
    if c.get('console', True):
        box((0, -0.15, -0.76), (.26, 1.0, .32), c.get('consolemat', dark), bevel=.02)
        box((0, -0.15, -0.6), (.22, .9, .015), T)
    if c.get('stack', True):
        (y0, z0), (y1, z1) = STACK
        extrude([(y0, z0), (y0, -0.66), (y1, -0.66), (y1, z1)], -0.14, 0.14, c.get('consolemat', dark), 'Stack')
    # the passenger seat (its back is level with your shoulders, beside you)
    pb = c.get('seat', L)
    box((-EX, 0.25, -0.35), (.5, .14, .7), pb, rot=(math.radians(-14), 0, 0), bevel=.05)
    box((-EX, -0.05, -0.68), (.5, .5, .12), pb, bevel=.04)
    if c.get('seat_stripe'): box((-EX, 0.175, -0.33), (.07, .01, .62), c['seat_stripe'], rot=(math.radians(-14), 0, 0))
    return dt


def MAT_MIRROR(): return mat('Mirror', '#c8d0da', .03, 1.)


STACK = ((-0.70, -0.42), (-0.30, -0.60))   # the top of the centre stack runs from under the dash down to the console
SLOPE = math.atan2(STACK[0][1] - STACK[1][1], STACK[1][0] - STACK[0][0])


def on_stack(y, up=0.):
    """the height of the centre stack's top at y (things stand on it, tilted with it by SLOPE)"""
    (y0, z0), (y1, z1) = STACK; return z0 + (y - y0) / (y1 - y0) * (z1 - z0) + up


def gauge(c, center=None, w=.42, h=.158, parent=None, hood=True, hood_w=None):
    """the dial screen (the game draws the live dials on it) and the hood over it"""
    cc = Vector(center or (EX, -0.62, -0.245))
    g = plane_to('Gauge', cc, (EX, 0, 0), w, h, mat('GaugeGlass', '#05070a', .2), parent)
    if hood:
        pm = c.get('dashmat', c['leather']); hw = hood_w or w + .04
        box((cc.x, cc.y - .07, cc.z + .085), (hw, .18, .04), pm, bevel=.012, parent=parent)   # the hood over the dials
        box((cc.x, cc.y - .06, cc.z - .01), (hw, .1, h + .1), pm, bevel=.01, parent=parent)   # the pod behind them
    return g


def ring(c, r, m, dx=0., width=.006):
    """a polished bezel round a dial, just in front of the dial screen and facing the driver"""
    c = Vector(c); n = (Vector((EX, 0, 0)) - c).normalized()
    return torus(c + n * .006 + Vector((dx, 0, 0)), r, width, m, n.to_track_quat('Z', 'Y').to_euler(), seg=32)


def screen(c, center=(0, -0.66, -0.36), w=.26, h=.16, frame=True):
    s = plane_to('Screen', center, (EX, 0, 0), w, h, mat('ScreenGlass', '#04060a', .15))
    if frame:
        n = (Vector((EX, 0, 0)) - Vector(center)).normalized()
        plane_to('ScreenFrame', Vector(center) - n * .006, (EX, 0, 0), w + .025, h + .025, c.get('bezel', mat('Bezel', '#0b0b0c', .3)))
    return s


# ---------------------------------------------------------------- steering wheels
def rim_points(shape, R):
    pts = []
    for k in range(64):
        a = k / 64 * math.tau; x, z = math.cos(a) * R, math.sin(a) * R
        if shape == 'flat' and z < -R * .78: z = -R * .78
        if shape in ('squircle', 'flat2') and abs(z) > R * .74: z = math.copysign(R * .74, z)
        if shape == 'squircle':   # Corvette / Bugatti: flat top and bottom, squarer sides
            x = math.copysign(abs(math.cos(a)) ** .7, math.cos(a)) * R * 1.03
        pts.append((x, 0, z))
    return pts


def wheel(c, shape='round', R=.175, thick=.026, extra=None):
    """the steering wheel: every part is built round the wheel's own centre (the wheel lies in the x-z plane and you
    sit on its +y side) under an empty called Wheel, which is then moved into place and tilted; the game turns it
    about its own axis. extra(W) adds the brand's buttons and lights in the same frame."""
    W = bpy.data.objects.new('Wheel', None); bpy.context.collection.objects.link(W); bpy.context.view_layer.update()
    rimm = c.get('rim', mat('WheelLeather', '#141416', .55)); face = (math.radians(90), 0, 0)
    if shape == 'yoke':   # Tesla: open at the top
        pts = [(-R * 1.15, 0, R * .55), (-R * 1.15, 0, -R * .35), (-R * .9, 0, -R * .62), (R * .9, 0, -R * .62), (R * 1.15, 0, -R * .35), (R * 1.15, 0, R * .55)]
        link(tube(pts, thick * 1.1, rimm), W)
        for sx in (-1, 1): link(tube([(sx * R * 1.15, 0, R * .55), (sx * R * .92, 0, R * .62)], thick * 1.1, rimm), W)
    else:
        link(tube(rim_points(shape, R), thick, rimm, closed=True), W)
    for a in c.get('spokes', [0, math.pi, -math.pi / 2]):
        box((math.cos(a) * R * .52, 0, math.sin(a) * R * .52), (R * .95, .022, .036), c.get('spokemat', rimm), rot=(0, -a, 0), parent=W)
    cyl((0, 0, 0), R * .32, .06, c.get('hubmat', rimm), face, 24, W)
    cyl((0, .032, 0), R * .14, .006, c['badge'], face, 24, W)
    if c.get('marker', True):   # the stripe at 12 o'clock (at the bottom of a yoke)
        box((0, 0, R if shape != 'yoke' else -R * .62), (.03, thick * 2.3, thick * 2.3), c['marker_mat'], parent=W)
    for sx in (-1, 1):   # your gloves
        sph((R * (1.15 if shape == 'yoke' else 1.0) * sx, .012, .01), .036, c.get('glove', mat('Glove', '#d8261c', .8)), (1, .8, 1.3), W)
    cyl((0, -.14, 0), .035, .26, mat('Column', '#121214', .6), face, 12, W)
    if extra: extra(W)
    W.location = WC; W.rotation_euler = (math.radians(18), 0, 0)   # the top leans away from you
    return W


# ---------------------------------------------------------------- the brands
def porsche():
    L, A, T = mat('Leather', '#121214', .7), mat('GuardsYellow', '#f2c200', .5), mat('Alu', '#b9bdc4', .3, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('RaceTex', '#1d1e21', 1), badge=mat('Crest', '#c89a2a', .4, .6), marker_mat=A, dashmat=L,
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8))
    dt = cabin(c)
    # five round dials under one curved hood (the middle one is the real rev counter)
    gauge(c, w=.46, h=.15, hood_w=.56)
    for k, x in enumerate((-.18, -.09, 0, .09, .18)): ring((EX, -0.62, -0.245), .04 if k != 2 else .05, T, x, .004)
    # slim landscape screen set into the dash, two vents under it and a row of toggle switches
    screen(c, (0.02, -0.67, -0.34), .3, .1)
    for x in (-.08, .1): box((x, -0.66, -0.44), (.12, .02, .05), mat('Vent', '#0a0a0b', .5), bevel=.006)
    for k in range(5): box((-.08 + k * .045, -0.655, -0.5), (.022, .03, .012), T, rot=(math.radians(25), 0, 0))
    box((0, -0.25, -0.58), (.03, .06, .07), T, bevel=.01)   # the little gear selector
    wheel(c, 'round')


def tesla():
    L, W_, T = mat('VeganWhite', '#e8e6e1', .55), mat('Wood', '#5a3f2a', .45), mat('Chrome', '#c6ccd4', .2, 1.)
    c = dict(leather=mat('DashBlack', '#1a1b1d', .6), accent=W_, trim=T, roofmat=mat('Glass roof', '#0b0d10', .2), badge=mat('TLogo', '#c8141b', .4),
             marker=False, dash_line=False, seat=L, glove=mat('Glove', '#1a1a1c', .8), console=True, consolemat=mat('PianoBlack', '#060607', .15),
             dash_prof=[(-0.68, -0.6), (-0.69, -0.33), (-0.76, -0.31), (-1.18, -0.33), (-1.18, -0.6)], dash_top=-0.31)
    cabin(c)
    box((0, -0.625, -0.42), (1.86, .02, .07), W_)   # the long wood strip with the hidden vent slot above it
    box((0, -0.622, -0.375), (1.8, .015, .012), mat('Slot', '#050505', .5))
    gauge(c, (EX, -0.66, -0.29), .26, .1, hood=False)   # the small display behind the yoke
    screen(c, (0.05, -0.62, -0.25), .42, .24, frame=False)   # the big one, standing up on the dash
    box((0.05, -0.64, -0.36), (.06, .04, .06), mat('Stand', '#0b0b0c', .4))
    wheel(c, 'yoke', R=.17)


def lambo():
    L, A, T = mat('Alcantara', '#141416', .9), mat('VerdeStitch', '#7fd321', .5), mat('Titanium', '#9da3ab', .35, 1.)
    carbon = mat('Carbon', '#0f1012', .25, .2)
    c = dict(leather=L, accent=A, trim=T, roofmat=L, badge=mat('Bull', '#d4a72c', .4, .7), marker_mat=A, dashmat=carbon, seat_stripe=A,
             dash_prof=[(-0.68, -0.66), (-0.69, -0.33), (-0.75, -0.24), (-0.88, -0.25), (-1.18, -0.33), (-1.18, -0.66)], dash_top=-0.24,
             glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    gauge(c, w=.44, h=.15, hood=False)
    # the sharp hexagon hood over the dials
    bm = bmesh.new(); top = []
    for k in range(6):
        a = k / 6 * math.tau + math.pi / 6; top.append(bm.verts.new((EX + math.cos(a) * .27, -0.72 + math.sin(a) * .1, -0.15)))
    bm.faces.new(top); me = bpy.data.meshes.new('hexhood'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('hexhood', me); bpy.context.collection.objects.link(o)
    o.modifiers.new('s', 'SOLIDIFY').thickness = .03; link(o, None, carbon)
    # the tall screen inside a big Y-shaped titanium frame
    screen(c, (0.03, -0.68, -0.4), .2, .27)
    for s in (-1, 1): beam((0.03 + s * .14, -0.69, -0.24), (0.03 + s * .1, -0.66, -0.56), .03, T)
    beam((0.03 - .17, -0.7, -0.24), (0.03 + .17, -0.7, -0.24), .03, T)
    for s in (-1, 1):   # hexagon vents either side
        cyl((0.03 + s * .3, -0.66, -0.3), .06, .03, mat('Vent', '#0a0a0b', .5), (math.radians(90), 0, 0), 6)
    # the fighter-jet start switch under its red flip cover, between aviation toggles
    box((0, -0.58, on_stack(-0.58, .03)), (.05, .07, .03), mat('RedCover', '#d0101a', .35), rot=(-SLOPE - math.radians(25), 0, 0), bevel=.006)
    for k in (-2, -1, 1, 2): box((k * .045, -0.58, on_stack(-0.58, .025)), (.012, .012, .05), T, rot=(-SLOPE, 0, 0))
    def ex(W):
        for s in (-1, 1): sph((s * .1, .03, -.05), .014, mat('RedButton', '#e0101a', .3), parent=W)   # the red Anima buttons
    wheel(c, 'flat', extra=ex)


def ferrari():
    L, A, T = mat('Nero', '#111113', .7), mat('RossoStitch', '#d2141c', .5), mat('Carbon', '#121315', .25, .2)
    c = dict(leather=L, accent=A, trim=mat('Alu', '#b9bdc4', .3, 1.), roofmat=mat('Alcantara', '#1a1a1c', 1), badge=mat('Cavallino', '#f6c600', .4),
             marker_mat=A, dashmat=L, seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    gauge(c, w=.46, h=.16, hood_w=.6)
    plane_to('PassengerDisplay', (0.42, -0.66, -0.3), (0.42, 0, -0.2), .32, .07, mat('PassengerGlow', '#ff3a2a', .3, emit=1.2))   # the passenger's strip
    screen(c, (0.05, -0.66, -0.38), .18, .1)
    # the console "bridge": a gated gear selector in aluminium
    box((0, -0.55, on_stack(-0.55, .02)), (.16, .26, .03), T, rot=(-SLOPE, 0, 0), bevel=.01)
    for k, y in enumerate((-0.62, -0.55, -0.48)): box((.03 * (k - 1), y, on_stack(y, .045)), (.05, .03, .02), mat('GateBtn', '#d8dde3', .3, 1.), rot=(-SLOPE, 0, 0), bevel=.005)
    def ex(W):
        for k in range(9):   # shift lights along the top of the rim: green, red, blue
            a = math.radians(64 + k * 6.5); col = '#2fe05a' if k < 3 else '#ff2a1a' if k < 6 else '#2a7bff'
            sph((math.cos(a) * .19, .012, math.sin(a) * .19), .007, mat('LED' + col, col, .3, emit=3.), parent=W)
        sph((-.1, .03, -.06), .018, mat('StartRed', '#e0101a', .3, emit=.6), parent=W)   # ENGINE START
        cyl((.1, .03, -.06), .022, .02, mat('Manettino', '#c8141b', .4), (math.radians(90), 0, 0), 16, W)
    wheel(c, 'flat', extra=ex)


def mclaren():
    L, A, T = mat('Alcantara', '#141416', .9), mat('Papaya', '#ff8000', .5), mat('Carbon', '#101113', .25, .2)
    c = dict(leather=L, accent=A, trim=mat('Alu', '#aeb3ba', .3, 1.), roofmat=L, badge=mat('Speedmark', '#ff8000', .4), marker_mat=A, dashmat=T,
             seat_stripe=A, dash_prof=[(-0.70, -0.6), (-0.71, -0.34), (-0.78, -0.31), (-1.18, -0.35), (-1.18, -0.6)], dash_top=-0.31, dash_line=False,
             spokes=[0, math.pi], glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    # the dial pod sits on the steering column, not on the dash
    gauge(c, (EX, -0.62, -0.28), .3, .12, hood_w=.36)
    for s in (-1, 1): box((EX + s * .19, -0.63, -0.3), (.04, .06, .06), T, bevel=.01)   # the mode rockers either side
    # the floating portrait screen on its stalk and the floating console under it
    screen(c, (0.04, -0.6, -0.36), .14, .2)
    box((0.04, -0.64, -0.5), (.03, .04, .14), T)
    box((0, -0.55, on_stack(-0.55, .04)), (.18, .3, .02), T, rot=(-SLOPE, 0, 0), bevel=.01)
    for k in range(3): cyl((-.05 + k * .05, -0.55, on_stack(-0.55, .06)), .016, .02, mat('Knurl', '#c9ced5', .3, 1.), (-SLOPE, 0, 0), 16)
    # switches in the roof
    box((0, -0.3, TOP - .04), (.3, .16, .03), T, bevel=.008)
    for k in range(5): box((-.1 + k * .05, -0.3, TOP - .06), (.012, .03, .02), A)
    wheel(c, 'round', R=.17)


def bugatti():
    L, A, T = mat('Tan', '#c8a879', .6), mat('Black', '#151516', .6), mat('PolishedAlu', '#d4d8de', .15, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('TanRoof', '#b89a6c', 1), badge=mat('EB', '#c9cdd3', .25, 1.), marker_mat=T, dashmat=L,
             rim=mat('RimBlack', '#141416', .6), spokemat=T, hubmat=L, glove=mat('Glove', '#1a1a1c', .8), consolemat=A,
             dash_prof=[(-0.68, -0.66), (-0.69, -0.32), (-0.78, -0.27), (-1.18, -0.31), (-1.18, -0.66)], dash_top=-0.27)
    cabin(c)
    # the C-line: a polished C from the roof down the middle of the car
    tube([(0, -0.62, TOP - .03), (0, -0.66, 0), (0, -0.68, -0.3), (0, -0.62, -0.55), (0, -0.3, -0.6), (0, 0.15, -0.62)], .022, T, name='Cline')
    # the skeleton console with four round knobs standing up
    for k in range(4): y = -0.64 + k * .075; cyl((0.0, y, on_stack(y, .03)), .022, .06, T, v=20); cyl((0.0, y, on_stack(y, .061)), .018, .006, mat('KnobFace', '#0a0b0d', .2), v=20)
    # watch-like dials fixed in the hub, the speedometer to 500 in the middle
    gauge(c, (EX, -0.6, -0.27), .3, .13, hood_w=.36)
    for x, r in ((-.09, .045), (0, .06), (.09, .045)): ring((EX, -0.6, -0.27), r, T, x)
    wheel(c, 'squircle', R=.18)


def koenigsegg():
    carbon, A, T = mat('Carbon', '#101114', .2, .25), mat('Orange', '#ff6a13', .5), mat('Alu', '#c3c8cf', .25, 1.)
    c = dict(leather=mat('Alcantara', '#161618', .9), accent=A, trim=T, roofmat=carbon, badge=mat('Shield', '#e8e8ea', .3, .6), marker_mat=A,
             dashmat=carbon, seat_stripe=A, pillar=carbon, glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    screen(c, (0.04, -0.66, -0.36), .22, .14)
    # the gated shifter of the CC850 (a silver gate) and chrome toggles
    box((0, -0.55, on_stack(-0.55, .008)), (.12, .14, .012), T, rot=(-SLOPE, 0, 0))
    for k in range(3): box((-.04 + k * .04, -0.55, on_stack(-0.55, .014)), (.006, .1, .01), mat('Gate', '#08080a', .4), rot=(-SLOPE, 0, 0))
    cyl((0, -0.55, on_stack(-0.55, .06)), .006, .1, T); sph((0, -0.55, on_stack(-0.55, .11)), .022, T)
    def ex(W):
        # the SmartCluster: a small screen on the wheel itself, it turns with you
        plane_to('Gauge', (0, .045, .085), (0, 10, .085), .15, .075, mat('GaugeGlass', '#05070a', .2), W)
        box((0, .035, .085), (.17, .02, .09), carbon, parent=W)
    wheel(c, 'flat', R=.165, extra=ex)


def toyota():
    L, A, T = mat('BlackFabric', '#18181a', .85), mat('GRRed', '#d01020', .5), mat('Satin', '#7c8088', .4, .6)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Headliner', '#2a2b2e', 1), badge=mat('ToyotaChrome', '#cfd4da', .25, 1.), marker_mat=A,
             dashmat=mat('Soft', '#1e1f22', .8), seat_stripe=A, floor=mat('RedCarpet', '#5a0c12', 1), glove=mat('Glove', '#d8261c', .8))
    dt = cabin(c)
    # big round turbine vents at both ends of the dash
    for s in (-1, 1): vent_round((s * 0.78, -0.66, dt - .08), .07, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0.1))
    gauge(c, w=.36, h=.14, hood_w=.44)
    screen(c, (0.05, -0.68, -0.33), .24, .14)
    for k in range(3): cyl((-.03 + k * .06, -0.65, -0.44), .022, .03, T, (math.radians(90), 0, 0), 20)   # three climate knobs
    # the manual gear lever in its leather boot
    cyl((0, -0.4, on_stack(-0.4, .03)), .05, .06, L, r2=.02, v=16); cyl((0, -0.4, on_stack(-0.4, .1)), .007, .12, T); sph((0, -0.4, on_stack(-0.4, .17)), .028, mat('Knob', '#1a1a1c', .5))
    def ex(W):
        box((0, .03, -.12), (.03, .01, .016), A, parent=W)   # the GR badge on the bottom spoke
    wheel(c, 'round', extra=ex)


def bmw():
    L, A, T = mat('Merino', '#151517', .7), mat('MRed', '#d2141c', .4), mat('Carbon', '#121315', .25, .2)
    c = dict(leather=L, accent=A, trim=mat('Alu', '#a9aeb5', .3, 1.), roofmat=mat('Anthracite', '#26272b', 1), badge=mat('Roundel', '#2a74d8', .3, .3),
             marker_mat=A, dashmat=L, seat_stripe=mat('MBlue', '#1d5fd6', .5), glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    # one long curved screen: the dials and the middle screen behind one piece of glass
    gauge(c, (EX + .02, -0.64, -0.21), .34, .12, hood=False)
    screen(c, (-0.02, -0.66, -0.21), .34, .12, frame=False)
    tube([(EX - .2, -0.635, -0.21), (EX + .05, -0.66, -0.2), (-0.02 + .18, -0.69, -0.21)], .006, mat('GlassEdge', '#2a2d33', .3, .5))
    def ex(W):
        for s in (-1, 1): box((s * .11, .035, .02), (.02, .01, .014), A, parent=W)   # M1 and M2
        for k, col in enumerate(('#2a7bd8', '#3a1f8a', '#d2141c')):   # the M stripe at 12 o'clock
            box((-.012 + k * .012, 0, .175), (.012, .06, .06), mat('M' + col, col, .5), parent=W)
    wheel(c, 'flat', extra=ex)


def audi():
    L, A, T = mat('Nappa', '#141416', .7), mat('RSRed', '#cc1020', .45), mat('Alu', '#aeb3ba', .3, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Alcantara', '#202124', 1), badge=mat('Rings', '#cdd2d8', .25, 1.), marker_mat=A, dashmat=L,
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8))
    dt = cabin(c)
    gauge(c, w=.5, h=.17, hood_w=.62)   # the wide Virtual Cockpit
    # the R8's big arch that sweeps round the driver
    tube([(EX + .38, -0.62, -0.62), (EX + .4, -0.66, -0.3), (EX + .2, -0.72, -0.12), (EX - .2, -0.72, -0.12), (EX - .38, -0.66, -0.3)], .025, mat('Arch', '#2b2d31', .5))
    for x in (-0.05, 0.12, 0.3): vent_round((x, -0.65, dt - .1), .045, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0))
    def ex(W):
        cyl((.12, .03, -.07), .02, .025, A, (math.radians(90), 0, 0), 16, W)   # the red start button
        cyl((-.12, .03, -.07), .02, .025, mat('DriveSelect', '#202124', .5), (math.radians(90), 0, 0), 16, W)
    wheel(c, 'flat', extra=ex)


def devel():
    L, A, T = mat('Black', '#121214', .7), mat('Gold', '#c9a033', .35, .9), mat('Carbon', '#0f1012', .25, .2)
    c = dict(leather=L, accent=A, trim=A, roofmat=T, badge=A, marker_mat=A, dashmat=T, pillar=T, seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8),
             spokes=[0, math.pi])
    cabin(c)
    gauge(c, w=.44, h=.15, hood_w=.54)
    screen(c, (0.04, -0.66, -0.36), .24, .14)
    guard = mat('GuardRed', '#d0101a', .4)
    for k in range(6):   # guarded toggle switches on the console and in the roof, like a fighter jet
        x = -.11 + k * .044
        box((x, -0.56, on_stack(-0.56, .005)), (.03, .04, .01), T, rot=(-SLOPE, 0, 0)); cyl((x, -0.56, on_stack(-0.56, .03)), .004, .04, mat('Chrome', '#d0d5db', .2, 1.)); box((x, -0.575, on_stack(-0.575, .03)), (.026, .01, .04), guard)
        box((x, -0.25, TOP - .055), (.03, .04, .01), T); cyl((x, -0.25, TOP - .08), .004, .04, mat('Chrome', '#d0d5db', .2, 1.))
    box((0, -0.25, TOP - .04), (.3, .12, .02), T)
    wheel(c, 'flat2')


def amg():
    L, A, T = mat('Nappa', '#121214', .7), mat('AMGRed', '#cc1020', .45), mat('Chrome', '#cfd4da', .2, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Microfibre', '#1f2023', 1), badge=mat('Star', '#cfd4da', .25, 1.), marker_mat=A, dashmat=L,
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8))
    dt = cabin(c)
    # one wide screen on top of the dash: the dials and the middle screen side by side
    gauge(c, (EX + .02, -0.66, -0.21), .3, .12, hood=False)
    screen(c, (-0.0, -0.68, -0.21), .3, .12, frame=False)
    box((EX + .17, -0.735, -0.21), (.72, .012, .15), mat('WideGlass', '#08090b', .2))   # the glass panel behind both screens
    # four round turbine vents in a row in the middle
    for k in range(4): vent_round((-0.2 + k * .14, -0.64, dt - .1), .045, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0))
    # the V8 console: two rows of four buttons in a V
    for s in (-1, 1):
        for k in range(4): y = -0.64 + k * .05; box((s * (.03 + k * .015), y, on_stack(y, .008)), (.025, .03, .012), T, rot=(-SLOPE, 0, 0), bevel=.004)
    def ex(W):
        for s in (-1, 1): cyl((s * .1, .03, -.08), .018, .02, mat('DriveDial', '#1c1d20', .4), (math.radians(90), 0, 0), 18, W)
    wheel(c, 'flat', extra=ex)


def rolls():
    L, A, T = mat('Arctic', '#e9e6df', .55), mat('PianoBlack', '#0c0d10', .12, .2, coat=1.), mat('Chrome', '#d5dae0', .15, 1.)
    stars = mat('Star', '#ffffff', .3, emit=6.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Starlight', '#14161c', 1), badge=mat('RR', '#d5dae0', .2, 1.), marker=False, dashmat=A,
             rim=mat('ThinRim', '#141416', .5), spokemat=T, hubmat=mat('Hub', '#1a1a1c', .5), seat=L, glove=mat('Glove', '#ece9e2', .8),
             dash_prof=[(-0.68, -0.66), (-0.69, -0.3), (-0.76, -0.26), (-1.18, -0.3), (-1.18, -0.66)], dash_top=-0.26)
    cabin(c)
    # the Starlight Headliner: hundreds of tiny stars in the roof
    random.seed(4)
    bm = bmesh.new()
    for _ in range(420):
        x, y = random.uniform(-0.8, 0.8), random.uniform(-0.52, 0.94); s = random.choice((.004, .004, .006, .009))
        v = [bm.verts.new((x + dx, y + dy, TOP - .032)) for dx, dy in ((-s, -s), (s, -s), (s, s), (-s, s))]; bm.faces.new(v[::-1])
    me = bpy.data.meshes.new('Stars'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Stars', me); bpy.context.collection.objects.link(o); link(o, None, stars)
    # the glass Gallery across the dash with its clock, the vents with organ-stop pulls
    box((0.25, -0.635, -0.33), (1.0, .01, .1), mat('Gallery', '#6b5a43', .15, .3, coat=1.))
    cyl((0.25, -0.628, -0.33), .035, .01, T, (math.radians(90), 0, 0), 28); cyl((0.25, -0.624, -0.33), .03, .004, mat('ClockFace', '#f4f1ea', .3), (math.radians(90), 0, 0), 28)
    for x in (-0.05, 0.08): vent_round((x, -0.63, -0.45), .04, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0), 0)
    for k in range(4): cyl((-0.08 + k * .055, -0.6, -0.53), .009, .04, T, (math.radians(90), 0, 0), 12)   # organ stops
    gauge(c, w=.4, h=.14, hood_w=.48)
    screen(c, (0.05, -0.68, -0.28), .22, .1)
    wheel(c, 'round', R=.2, thick=.018)


def ford():
    L, A, T = mat('Black', '#141416', .7), mat('DarkHorseBlue', '#1d3fae', .45), mat('Alu', '#a9aeb5', .3, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Headliner', '#232427', 1), badge=mat('Pony', '#cfd4da', .25, 1.), marker_mat=A, dashmat=L,
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    # one glass panel: the dial screen and the middle screen, turned towards you
    gauge(c, (EX + .02, -0.65, -0.22), .32, .13, hood=False)
    screen(c, (-0.03, -0.67, -0.24), .3, .16, frame=False)
    box((EX + .16, -0.735, -0.23), (.72, .012, .2), mat('Glass', '#08090b', .2))
    box((EX + .16, -0.7, -0.14), (.72, .2, .03), L, bevel=.01)
    # the cue-ball gear knob of the six-speed
    cyl((0, -0.4, on_stack(-0.4, .06)), .006, .12, T); sph((0, -0.4, on_stack(-0.4, .13)), .03, mat('CueBall', '#d9dde2', .2, 1.))
    wheel(c, 'flat')


def chevy():
    L, A, T = mat('JetBlack', '#141416', .7), mat('AdrenalineRed', '#c8141b', .45), mat('Alu', '#a9aeb5', .3, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Headliner', '#232427', 1), badge=mat('Bowtie', '#cfd4da', .25, 1.), marker_mat=A, dashmat=L,
             seat_stripe=A, spokes=[0, math.pi], console=False, stack=False, glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    gauge(c, w=.4, h=.15, hood_w=.5)
    screen(c, (-0.02, -0.66, -0.3), .2, .13)   # turned towards the driver
    # the tall "wall of buttons" between the seats, running back from the dash
    extrude([(-0.62, -0.95), (-0.62, -0.32), (-0.4, -0.38), (0.2, -0.62), (0.2, -0.95)], -0.07, 0.07, L, 'ButtonWall')
    for k in range(12): box((-0.075, -0.6 + k * .065, -0.36 - k * .022), (.012, .045, .02), T)
    wheel(c, 'squircle', R=.17)


def honda():
    L, A, T = mat('Black', '#141416', .7), mat('RedLeather', '#a5121b', .6), mat('Alu', '#b4b9c0', .3, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Alcantara', '#1d1e21', 1), badge=mat('H', '#cfd4da', .25, 1.), marker_mat=A, dashmat=L,
             seat=A, console=False, glove=mat('Glove', '#1a1a1c', .8))
    cabin(c)
    gauge(c, w=.36, h=.14, hood_w=.46)
    screen(c, (0.03, -0.68, -0.34), .2, .11)
    # the floating console: a big silver Dynamic Mode dial and P/R/N/D buttons
    box((0, -0.3, -0.62), (.22, .8, .1), L, bevel=.02)
    box((0, -0.58, on_stack(-0.58, .02)), (.2, .2, .02), T, rot=(-SLOPE, 0, 0), bevel=.01)
    cyl((0, -0.6, on_stack(-0.6, .045)), .045, .03, T, (-SLOPE, 0, 0), 28); cyl((0, -0.6, on_stack(-0.6, .062)), .03, .01, mat('DialFace', '#0c0d10', .3), (-SLOPE, 0, 0), 28)
    for k in range(4): y = -0.5; box((-.06 + k * .04, y, on_stack(y, .01)), (.03, .03, .012), T, rot=(-SLOPE, 0, 0), bevel=.004)
    wheel(c, 'flat')


def pagani():
    L, A, T = mat('Cognac', '#8a5230', .6), mat('Cream', '#e9dcc4', .6), mat('MilledAlu', '#d2d6dc', .2, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Suede', '#5e3d27', 1), badge=mat('Pagani', '#cfd4da', .2, 1.), marker=False, dashmat=L,
             rim=L, spokemat=T, hubmat=T, seat=L, seat_stripe=A, glove=mat('Glove', '#2a1a12', .8))
    dt = cabin(c)
    # round dials with polished aluminium rings (the game draws the faces) and porthole vents
    gauge(c, w=.4, h=.15, hood_w=.48)
    for x, r in ((-.11, .06), (0, .07), (.11, .06)): ring((EX, -0.62, -0.245), r, T, x, .008)
    for s in (-1, 1): vent_round((s * 0.72, -0.66, dt - .08), .06, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0.1), 0)
    for x in (-0.06, 0.12): vent_round((x, -0.65, -0.4), .05, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0), 0)
    screen(c, (0.03, -0.67, -0.3), .14, .08)
    # the open gear gate with its rods showing
    box((0, -0.5, on_stack(-0.5, .01)), (.16, .2, .015), T, rot=(-SLOPE, 0, 0))
    for k in range(4): box((-.06 + k * .04, -0.5, on_stack(-0.5, .018)), (.008, .16, .01), mat('Gap', '#08080a', .4), rot=(-SLOPE, 0, 0))
    for s in (-1, 1): cyl((s * .05, -0.52, on_stack(-0.52, .03)), .006, .3, T, (math.radians(90) - SLOPE, 0, 0), 10)
    cyl((0, -0.5, on_stack(-0.5, .07)), .006, .12, T); sph((0, -0.5, on_stack(-0.5, .14)), .024, T)
    wheel(c, 'round', R=.17)


BRANDS = dict(porsche=porsche, tesla=tesla, lambo=lambo, ferrari=ferrari, mclaren=mclaren, bugatti=bugatti, koenigsegg=koenigsegg, toyota=toyota,
              bmw=bmw, audi=audi, devel=devel, amg=amg, rolls=rolls, ford=ford, chevy=chevy, honda=honda, pagani=pagani)


def export(key):
    out = os.path.join(HERE, '..', f'int_{key}.glb')
    for o in bpy.context.scene.objects: o.select_set(o.type in ('MESH', 'EMPTY'))
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT', use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10)
    with open(out, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(out + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/interiors.py from int_{key}.glb - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['int_{key}'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {out}: {os.path.getsize(out) / 1e3:.0f} kB, {tris} triangles', flush=True)


def render(path):
    """the driver's view, to compare with the photos"""
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 20; scn.render.resolution_x, scn.render.resolution_y = 640, 360
    cam_d = bpy.data.cameras.new('cam'); cam_d.sensor_fit = 'VERTICAL'; cam_d.angle = math.radians(70); cam = bpy.data.objects.new('cam', cam_d)
    bpy.context.collection.objects.link(cam); scn.camera = cam; cam.location = (EX, 0.0, 0.0)
    cam.rotation_euler = (Vector((EX + .05, -10, -1.6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); bpy.context.collection.objects.link(sun); sun.data.energy = 3; sun.rotation_euler = (math.radians(35), 0, math.radians(160))
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.55, .7, .9, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam); bpy.data.objects.remove(sun)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    which = argv[argv.index('--brand') + 1] if '--brand' in argv else 'all'
    for key in (BRANDS if which == 'all' else which.split(',')):
        bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear(); BRANDS[key]()
        if '--render' in argv: render(os.path.join(argv[argv.index('--render') + 1], f'int_{key}.png'))
        export(key)
