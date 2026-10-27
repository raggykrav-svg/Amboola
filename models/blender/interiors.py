# Car interiors for the INSIDE camera: one cockpit per brand, modelled from photos and descriptions of the real cars'
# cabins. A shared kit, plus each brand's signature parts:
#   - a smooth dashboard (the brand's profile rounded off with chaikin() and swept across the car by sweep(), bent by
#     wrap() so it curves round you), contrast stitching along its edge (dashes()), a metal or carbon trim band and,
#     for brands that have it, a line of ambient light (c['amb'])
#   - a curved, stitched hood over the dials; doors with a rolled, stitched top, an insert panel, ambient light, an
#     armrest, a chrome handle and a speaker; rounded pillars, sun visors and a frameless mirror
#   - a steering wheel with thumb grips, stitching, a sculpted airbag pad, button panels (c['buttons']), metal paddles
#     and a column shroud
#   - a console with cup holders, and a sculpted passenger seat (a carbon bucket shell with c['seatshell'])
# The brands:
#   porsche     GT3 RS: five round dials under a curved hood, a Race-Tex dash, carbon buckets, four mode dials on the
#               wheel, slim screen, toggle row
#   tesla       a long dash strip, one big landscape screen, the yoke
#   lambo       Revuelto: angular dash, hexagon cluster hood, a Y-shaped frame round a tall screen, the passenger's own
#               screen, four rotors on the wheel, a red flip cover over the start switch and aviation toggles
#   ferrari     SF90: the 16-inch curved dial screen, shift lights along the top of the wheel, haptic touch pads, a red
#               start button and the manettino on it, the gated console "bridge", a passenger display
#   mclaren     W1: a thin dash, the dial pod on the steering column, a floating portrait screen, a smaller wheel flat
#               at the top and bottom with only BOOST and AERO buttons and shift lights in the rim, overhead switches
#   bugatti     the C-line (a silver C from the roof down between the seats, with its light conductor glowing), a
#               skeleton console with four round knobs with little screens, watch-like dials, a flat-topped wheel, tan leather
#   koenigsegg  carbon everywhere, the small screen on the wheel (it turns with you), orange leather and details
#   toyota      GR86: big round turbine vents at the ends of the dash, three climate knobs, a manual gear lever
#   bmw         one long curved screen from the dials to the middle, red M1/M2 buttons, the M-stripe
#   audi        a wide Virtual Cockpit hood, a red start button on the wheel, round vents, honeycomb seats
#   devel       a fighter-jet cockpit: guarded toggle switches on the console and the roof, green jet displays
#   amg         four round turbine vents in a row, a wide screen on top, V8-style console buttons, wheel dials
#   rolls       the Starlight roof (hundreds of little stars), the Illuminated Fascia (stars in the passenger's dash),
#               a glass gallery dash with a clock, organ-stop vent pulls, a big thin wheel, white leather
#   ford        Mustang: one glass panel with two screens, a cue-ball gear knob, blue Dark Horse details
#   chevy       Corvette C8: the squared-off wheel and the tall "wall of buttons" between the seats
#   honda       NSX: the big round Dynamic Mode dial on a floating console and P/R/N/D push buttons, red seats
#   pagani      Utopia: the open metal gear gate with its rods, round aluminium dials and porthole vents, tan leather
#   nissan      GT-R NISMO: round vents at both ends, the screen high in the middle, three R-mode switches, a red
#               ENGINE START button, big paddles behind the wheel, red NISMO stitching
#   amboola     the game's own cars: neon light lines, a see-through hologram speed display over the dash, a gold
#               tiger start button, the AMBOOLA name in light; the accent parts take the car's paint colour (AmbAccent)
#
#   blender -b --factory-startup --python models/blender/interiors.py -- [--brand NAME|all] [--render DIR] [--no-export]
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
    if bevel:   # rounded edges, shaded smooth (weighted normals keep the flat faces flat)
        md = o.modifiers.new('b', 'BEVEL'); md.width = min(bevel, min(s) * .49); md.segments = 3; md.harden_normals = True
        bpy.ops.object.modifier_apply(modifier='b')
        for p in o.data.polygons: p.use_smooth = True
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


def text(body, c, size, m, rot=(math.radians(90), 0, math.pi)):
    """letters in light or metal; the default rotation makes them readable from the driver's seat"""
    bpy.ops.object.text_add(location=c, rotation=rot); o = bpy.context.active_object; o.data.body = body; o.data.size = size
    o.data.align_x = 'CENTER'; o.data.extrude = .002; bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object
    return link(o, None, m)


def chaikin(pts, n=2, closed=True):
    """round off a polygon's corners (each pass cuts every corner in two)"""
    for _ in range(n):
        m, out = len(pts), []
        for i in range(m if closed else m - 1):
            p, q = Vector(pts[i]), Vector(pts[(i + 1) % m])
            out += [tuple(p * .75 + q * .25), tuple(p * .25 + q * .75)]
        pts = out if closed else [pts[0]] + out + [pts[-1]]
    return pts


WRAP = dict(bow=.035, droop=.015)   # how much the dash curves back towards the doors and drops at its ends (a wraparound cockpit)
def wrap(x, y, z, half=.95):
    """a point on the dash bent like the dash itself (see sweep)"""
    t = x / half; return (x, y + WRAP['bow'] * t * t, z - WRAP['droop'] * t * t)


def sweep(profile, x0, x1, m, name='panel', segs=24, smooth=True, bend=True):
    """a closed (y, z) profile swept across the car from x0 to x1, bent with wrap() so long dash parts curve round
    the driver; smooth-shaded with crisp corners kept"""
    bm = bmesh.new(); rings = []
    for i in range(segs + 1):
        x = x0 + (x1 - x0) * i / segs
        rings.append([bm.verts.new(wrap(x, y, z) if bend else (x, y, z)) for y, z in profile])
    n = len(profile)
    for a, b in zip(rings, rings[1:]):
        for k in range(n): bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    if smooth:
        for p in me.polygons: p.use_smooth = True
        for x in bpy.context.selected_objects: x.select_set(False)
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    return link(o, None, m)


def dashes(path, m, step=.009, length=.0045, w=.0022, name='Stitch', normal=None):
    """contrast stitching: little dashes along a polyline (one mesh), lying on a surface facing `normal`"""
    bm = bmesh.new(); pts = [Vector(p) for p in path]
    for a, b in zip(pts, pts[1:]):
        d = b - a; L = d.length
        if L < 1e-6: continue
        u = d / L; side = u.cross(Vector(normal) if normal is not None else Vector((0, 0, 1)))
        if side.length < .1: side = u.cross(Vector((1, 0, 0)))
        side.normalize(); up = side.cross(u)   # (= the surface normal: the stitches sit just proud of it)
        s = 0.
        while s < L:
            c = a + u * s; v = [bm.verts.new(c + u * dx + side * dy + up * w * .4) for dx, dy in ((0, -w), (length, -w), (length, w), (0, w))]
            bm.faces.new(v); s += step
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return link(o, None, m)


def vent_slots(c, w, h, frame, m_in, facing=(0, 1, 0), slats=5, chrome=None, parent=None):
    """a rectangular air vent: a rounded bezel, a dark inside and horizontal slats (with bright tips)"""
    rot = Vector(facing).to_track_quat('Z', 'Y').to_euler()
    o = box(c, (w + .02, h + .02, .02), frame, rot=rot, bevel=.008, parent=parent)
    n = Vector(facing).normalized(); cc = Vector(c) + n * .004
    box(cc, (w, h, .012), m_in, rot=rot, parent=parent)
    for k in range(slats):
        z = (k + .5) / slats - .5
        s = box(cc + n * .006, (w * .96, .006, .014), chrome or frame, rot=rot, parent=parent); s.location += Vector((0, 0, z * h))
    return o


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
    dark = c.get('dashmat', L); amb = c.get('amb') and mat('AmbLight', c['amb'], .3, emit=4.)
    # the dashboard: the brand's profile (forward is -y), rounded off and swept across the car, curving round you
    dt = c.get('dash_top', -0.26)
    prof = c.get('dash_prof') or [(-0.70, -0.66), (-0.72, dt - .05), (-0.78, dt), (-0.96, dt - .015), (-1.18, dt - .06), (-1.18, -0.66)]
    sweep(chaikin(prof, 2), -0.95, 0.95, dark, 'Dash')
    # contrast stitching along the dash's top edge (where the smoothed surface touches the profile's edge)
    (y1, z1), (y2, z2) = prof[1], prof[2]; ym, zm = (y1 + y2) / 2, (z1 + z2) / 2
    n = Vector((0, -(z2 - z1), y2 - y1)).normalized(); n = n if n.y > 0 else -n   # pointing at you
    xs = [-0.93 + k * .062 for k in range(31)]
    dashes([wrap(x, ym + n.y * .003, zm + n.z * .003) for x in xs], A, normal=Vector((0, n.y, n.z)))
    if c.get('dash_line', True):   # a trim band across the dash face, and a thin line of ambient light under it
        (fy0, fz0), (fy1, fz1) = prof[0], prof[1]; zb = dt - .12
        yf = fy0 + (fy1 - fy0) * (zb - fz0) / ((fz1 - fz0) or 1)
        sweep(chaikin([(yf + .009, zb - .013), (yf + .009, zb + .013), (yf - .004, zb + .013), (yf - .004, zb - .013)], 1), -0.93, 0.93, T, 'TrimBand')
        if amb: sweep([(yf + .006, zb - .02), (yf + .006, zb - .016), (yf, zb - .016), (yf, zb - .02)], -0.9, 0.9, amb, 'AmbLine', smooth=False)
    # doors: a padded card, a rolled top with stitching, ambient light, an armrest, a chrome handle and a speaker
    for s in (-1, 1):
        x = s * 0.93
        box((x, 0.1, (FLOOR + BELT) / 2), (.07, 1.8, BELT - FLOOR), L, bevel=.025)
        tube([(x - s * .045, -0.8, BELT + .012), (x - s * .05, -0.2, BELT + .014), (x - s * .045, 0.98, BELT + .012)], .034, dark, name='DoorTop')
        dashes([(x - s * .082, -0.72, BELT - .004), (x - s * .086, 0.95, BELT - .004)], A, normal=Vector((-s, 0, .4)))
        box((x - s * .045, 0.15, BELT - .1), (.02, 1.5, .1), c.get('doorinsert', c.get('seat', L)), bevel=.008)   # the insert panel
        if amb: box((x - s * .056, 0.12, BELT - .04), (.005, 1.55, .005), amb)
        box((x - s * .08, 0.05, BELT - .2), (.09, .55, .05), c.get('arm', dark), bevel=.02)
        tube([(x - s * .04, -0.36, BELT - .04), (x - s * .07, -0.32, BELT - .055), (x - s * .072, -0.22, BELT - .055), (x - s * .04, -0.18, BELT - .04)], .007, T, name='Handle')
        torus((x - s * .036, 0.35, BELT - .42), .07, .006, T, (0, math.pi / 2, 0), seg=32)
        cyl((x - s * .033, 0.35, BELT - .42), .066, .006, c.get('speaker', mat('Grille', '#1a1b1e', .7, .4)), (0, math.pi / 2, 0), 32)
    # rounded windscreen pillars, the header over the windscreen, sun visors, the roof lining, the pillar beside your head
    hz = -0.55; pm = c.get('pillar', dark)
    for s in (-1, 1):
        tube([(s * 0.87, -1.12, dt - .02), (s * 0.85, -0.85, (dt + TOP) / 2 - .02), (s * 0.80, hz, TOP - .035)], .042, pm, name='Pillar')
        box((s * 0.88, 0.55, (TOP + BELT) / 2), (.08, .16, TOP - BELT), pm, bevel=.03)
        box((s * 0.42, hz + .13, TOP - .05), (.4, .17, .026), c.get('visor', c['roofmat']), bevel=.012)
    box((0, hz, TOP - .05), (1.66, .1, .07), pm, bevel=.03)
    box((0, hz + .75, TOP - .015), (1.68, 1.5, .03), c['roofmat'], bevel=.01)
    # a frameless rear-view mirror on a short stem
    box((0, hz - .02, TOP - .085), (.016, .016, .06), T, bevel=.005)
    mir = cyl((0, hz - .02, TOP - .13), .085, .024, dark, (math.radians(90), 0, 0), 40); mir.scale = (1.25, .5, .36); bpy.ops.object.transform_apply(scale=True)
    gl = cyl((0, hz - .008, TOP - .13), .081, .004, MAT_MIRROR(), (math.radians(90), 0, 0), 40); gl.scale = (1.25, .46, .33); bpy.ops.object.transform_apply(scale=True)
    # floor and the middle console (between the seats), with two cup holders behind the gear selector
    box((0, -0.1, FLOOR), (1.9, 2.4, .02), c.get('floor', mat('Carpet', '#141416', 1)))
    if c.get('console', True):
        box((0, -0.15, -0.76), (.26, 1.0, .32), c.get('consolemat', dark), bevel=.04)
        box((0, -0.15, -0.6), (.22, .9, .015), T, bevel=.006)
        for sx in (-1, 1):
            torus((sx * .055, 0.12, -0.59), .034, .004, T, seg=28); cyl((sx * .055, 0.12, -0.592), .031, .004, mat('CupHole', '#050506', .6), v=28)
    if c.get('stack', True):
        (y0, z0), (y1, z1) = STACK
        sweep(chaikin([(y0, z0), (y0, -0.66), (y1, -0.66), (y1, z1)], 1), -0.14, 0.14, c.get('consolemat', dark), 'Stack', segs=2, bend=False)
    # the passenger seat beside you: a sculpted bucket with side bolsters (its back is level with your shoulders)
    pb = c.get('seat', L); shell = c.get('seatshell')
    tilt = (math.radians(-14), 0, 0)
    box((-EX, 0.25, -0.35), (.46, .12, .66), pb, rot=tilt, bevel=.05)
    for sx in (-1, 1):
        box((-EX + sx * .23, 0.21, -0.38), (.08, .17, .56), shell or pb, rot=(math.radians(-14), 0, sx * math.radians(-12)), bevel=.035)   # the side bolsters
        box((-EX + sx * .2, -0.08, -0.64), (.09, .48, .12), shell or pb, bevel=.035)                                                    # thigh bolsters
    box((-EX, -0.06, -0.68), (.36, .48, .1), pb, bevel=.035)
    box((-EX, 0.32, 0.03), (.26, .1, .17), shell or pb, rot=tilt, bevel=.04)   # the headrest
    if shell: box((-EX, 0.33, -0.15), (.5, .08, .95), shell, rot=tilt, bevel=.04)   # a carbon shell round the back
    if c.get('seat_stripe'): box((-EX, 0.185, -0.33), (.07, .01, .6), c['seat_stripe'], rot=tilt, bevel=.003)
    return dt


def MAT_MIRROR(): return mat('Mirror', '#c8d0da', .03, 1.)


STACK = ((-0.70, -0.42), (-0.30, -0.60))   # the top of the centre stack runs from under the dash down to the console
SLOPE = math.atan2(STACK[0][1] - STACK[1][1], STACK[1][0] - STACK[0][0])


def on_stack(y, up=0.):
    """the height of the centre stack's top at y (things stand on it, tilted with it by SLOPE)"""
    (y0, z0), (y1, z1) = STACK; return z0 + (y - y0) / (y1 - y0) * (z1 - z0) + up


def gauge(c, center=None, w=.42, h=.158, parent=None, hood=True, hood_w=None):
    """the dial screen (the game draws the live dials on it) and the curved, stitched hood over it"""
    cc = Vector(center or (EX, -0.62, -0.245))
    g = plane_to('Gauge', cc, (EX, 0, 0), w, h, mat('GaugeGlass', '#05070a', .2), parent)
    if hood:
        pm = c.get('dashmat', c['leather']); hw = hood_w or w + .04
        # a visor: its lip over the dials, curving forward and down into the dash (a crescent swept across)
        shell = [(.03, .085), (0, .1), (-.06, .105), (-.12, .09), (-.17, .03), (-.17, -.06), (-.152, -.06), (-.152, .024), (-.11, .072), (-.06, .087), (0, .082), (.03, .067)]
        prof = chaikin([(cc.y + y, cc.z + z) for y, z in shell], 1)
        o = sweep(prof, cc.x - hw / 2, cc.x + hw / 2, pm, 'Hood', segs=4, bend=False)
        if parent: link(o, parent)
        dashes([(cc.x - hw / 2 + .01, cc.y + .03, cc.z + .079), (cc.x + hw / 2 - .01, cc.y + .03, cc.z + .079)], c['accent'], normal=Vector((0, .6, .8)))
        box((cc.x, cc.y - .06, cc.z - .01), (hw - .01, .1, h + .1), pm, bevel=.02, parent=parent)   # the pod behind the dials
    return g


def ring(c, r, m, dx=0., width=.006):
    """a polished bezel round a dial, just in front of the dial screen and facing the driver"""
    c = Vector(c); n = (Vector((EX, 0, 0)) - c).normalized()
    return torus(c + n * .006 + Vector((dx, 0, 0)), r, width, m, n.to_track_quat('Z', 'Y').to_euler(), seg=32)


def screen(c, center=(0, -0.66, -0.36), w=.26, h=.16, frame=True):
    s = plane_to('Screen', center, (EX, 0, 0), w, h, mat('ScreenGlass', '#04060a', .15))
    if frame:   # a thin rounded bezel just behind the glass
        n = (Vector((EX, 0, 0)) - Vector(center)).normalized()
        box(Vector(center) - n * .009, (w + .022, h + .022, .014), c.get('bezel', mat('Bezel', '#0b0b0c', .3)), rot=n.to_track_quat('Z', 'Y').to_euler(), bevel=.007)
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
    rimm = c.get('rim', mat('WheelLeather', '#141416', .55)); face = (math.radians(90), 0, 0); thick = thick * 1.12
    if shape == 'yoke':   # Tesla: open at the top
        pts = [(-R * 1.15, 0, R * .55), (-R * 1.15, 0, -R * .35), (-R * .9, 0, -R * .62), (R * .9, 0, -R * .62), (R * 1.15, 0, -R * .35), (R * 1.15, 0, R * .55)]
        link(tube(chaikin(pts, 2, False), thick * 1.1, rimm), W)
        for sx in (-1, 1): link(tube([(sx * R * 1.15, 0, R * .55), (sx * R * .92, 0, R * .62)], thick * 1.1, rimm), W)
    else:
        rim = rim_points(shape, R); link(tube(rim, thick, rimm, closed=True), W)
        for sx in (-1, 1): sph((sx * R * .99, .002, .018), thick * 1.12, rimm, (1, 1.1, 1.9), W)   # thumb grips at a quarter to three
        # stitching round the inside of the rim, on your side
        ring = [Vector(p) * ((R - thick * .62) / R) + Vector((0, thick * .62, 0)) for p in rim]
        link(dashes([tuple(v) for v in ring[6:27]] , c['accent'], step=.008, normal=Vector((0, 1, 0))), W)
        link(dashes([tuple(v) for v in ring[38:59]], c['accent'], step=.008, normal=Vector((0, 1, 0))), W)
    spm = c.get('spokemat', rimm)
    for a in c.get('spokes', [0, math.pi, -math.pi / 2]):
        box((math.cos(a) * R * .56, -.004, math.sin(a) * R * .56 - .006), (R * .78, .03, .044), spm, rot=(0, -a, 0), bevel=.012, parent=W)
        if abs(math.sin(a)) < .1 and c.get('buttons', True):   # a button panel on each side spoke: four rounded buttons
            sx = 1 if math.cos(a) > 0 else -1
            box((sx * R * .5, .016, -.006), (R * .34, .01, .062), mat('ButtonPanel', '#0a0a0b', .2, .1, coat=1.), bevel=.006, parent=W)
            for bx in (-1, 1):
                for bz in (-1, 1): box((sx * R * .5 + bx * R * .08, .022, -.006 + bz * .016), (R * .12, .008, .022), mat('Button', '#26272b', .35), bevel=.004, parent=W)
    box((0, .012, -.012), (R * .82, .066, R * .64), c.get('hubmat', rimm), bevel=.028, parent=W)   # the airbag pad
    cyl((0, .047, -.006), R * .13, .006, c['badge'], face, 32, W)
    if c.get('marker', True):   # the stripe at 12 o'clock (at the bottom of a yoke)
        box((0, 0, R if shape != 'yoke' else -R * .62), (.03, thick * 2.35, thick * 2.35), c['marker_mat'], bevel=.004, parent=W)
    if c.get('paddles', True) and shape != 'yoke':   # metal shift paddles behind the rim
        for sx in (-1, 1): box((sx * R * .8, -.04, .04), (.07, .006, .1), c.get('paddlemat', mat('PaddleAlu', '#aeb4bb', .25, 1.)), rot=(0, sx * math.radians(-12), 0), bevel=.004, parent=W)
    for sx in (-1, 1):   # your gloves, thumbs on the grips
        sph((R * (1.15 if shape == 'yoke' else 1.0) * sx, .012, .01), .036, c.get('glove', mat('Glove', '#d8261c', .8)), (1, .8, 1.3), W)
        sph((R * (1.06 if shape == 'yoke' else .88) * sx, .03, .03), .015, c.get('glove', mat('Glove', '#d8261c', .8)), (1, 1, 1.7), W)
    cyl((0, -.15, 0), .06, .24, mat('Column', '#121214', .6), face, 24, W, r2=.042)   # the column shroud
    if extra: extra(W)
    W.location = WC; W.rotation_euler = (math.radians(18), 0, 0)   # the top leans away from you
    return W


# ---------------------------------------------------------------- the brands
def porsche():
    L, A, T = mat('Leather', '#121214', .7), mat('GuardsYellow', '#f2c200', .5), mat('Alu', '#b9bdc4', .3, 1.)
    race = mat('RaceTex', '#1d1e21', 1)
    c = dict(leather=L, accent=A, trim=T, roofmat=race, badge=mat('Crest', '#c89a2a', .4, .6), marker_mat=A, dashmat=race, pillar=race,
             seat_stripe=A, seatshell=mat('Carbon', '#121315', .25, .2), doorinsert=race, glove=mat('Glove', '#1a1a1c', .8), buttons=False)
    dt = cabin(c)
    # five round dials under one curved hood (the middle one is the real rev counter)
    gauge(c, w=.46, h=.15, hood_w=.56)
    for k, x in enumerate((-.18, -.09, 0, .09, .18)): ring((EX, -0.62, -0.245), .04 if k != 2 else .05, T, x, .004)
    # slim landscape screen set into the dash, two vents under it and a row of toggle switches
    screen(c, (0.02, -0.67, -0.34), .3, .1)
    for x in (-.08, .1): box((x, -0.66, -0.44), (.12, .02, .05), mat('Vent', '#0a0a0b', .5), bevel=.006)
    for k in range(5): box((-.08 + k * .045, -0.655, -0.5), (.022, .03, .012), T, rot=(math.radians(25), 0, 0))
    box((0, -0.25, -0.58), (.03, .06, .07), T, bevel=.01)   # the little gear selector
    def ex(W):   # the GT3 RS wheel: four mode dials on the spokes (drive modes, PASM, PTV, traction) in yellow and red
        for k, (x, z, col) in enumerate(((-.1, .0, '#f2c200'), (-.09, -.05, '#d01020'), (.1, .0, '#f2c200'), (.09, -.05, '#5a5e66'))):
            cyl((x, .028, z), .016, .018, mat('Knurl', '#c9ced5', .3, 1.), (math.radians(90), 0, 0), 20, W)
            cyl((x, .038, z), .012, .004, mat('Dial' + col, col, .4), (math.radians(90), 0, 0), 20, W)
    wheel(c, 'round', extra=ex)


def tesla():
    L, W_, T = mat('VeganWhite', '#e8e6e1', .55), mat('Wood', '#5a3f2a', .45), mat('Chrome', '#c6ccd4', .2, 1.)
    c = dict(leather=mat('DashBlack', '#1a1b1d', .6), accent=W_, trim=T, roofmat=mat('Glass roof', '#0b0d10', .2), badge=mat('TLogo', '#c8141b', .4),
             marker=False, dash_line=False, seat=L, glove=mat('Glove', '#1a1a1c', .8), console=True, consolemat=mat('PianoBlack', '#060607', .15), amb='#e8f0ff',
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
             glove=mat('Glove', '#1a1a1c', .8), buttons=False, seatshell=carbon)
    cabin(c)
    gauge(c, w=.44, h=.15, hood=False)
    plane_to('PassengerScreen', (0.5, -0.655, -0.31), (0.5, 0, -0.2), .24, .1, mat('PassengerGlow', '#1fd0ff', .3, emit=.6))   # the passenger's own screen
    box((0.5, -0.664, -0.31), (.27, .012, .125), carbon, bevel=.006)
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
        for x, z, col in ((-.1, -.01, '#e0101a'), (-.08, -.06, '#26272b'), (.1, -.01, '#e0101a'), (.08, -.06, '#26272b')):   # four rotors: Anima, lift, wing, hybrid
            cyl((x, .026, z), .018, .02, mat('Rotor', '#9da3ab', .35, 1.), (math.radians(90), 0, 0), 20, W)
            cyl((x, .037, z), .013, .004, mat('Rotor' + col, col, .35), (math.radians(90), 0, 0), 20, W)
    wheel(c, 'flat', extra=ex)


def ferrari():
    L, A, T = mat('Nero', '#111113', .7), mat('RossoStitch', '#d2141c', .5), mat('Carbon', '#121315', .25, .2)
    c = dict(leather=L, accent=A, trim=mat('Alu', '#b9bdc4', .3, 1.), roofmat=mat('Alcantara', '#1a1a1c', 1), badge=mat('Cavallino', '#f6c600', .4),
             marker_mat=A, dashmat=L, seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8), buttons=False, seatshell=mat('Carbon', '#121315', .25, .2))
    cabin(c)
    gauge(c, w=.5, h=.17, hood_w=.62)   # the 16-inch curved screen
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
        for sx in (-1, 1): box((sx * .11, .026, .02), (.05, .006, .03), mat('TouchPad', '#0a0a0c', .1, .2, coat=1.), bevel=.004, parent=W)   # the haptic touch pads
    wheel(c, 'flat', extra=ex)


def mclaren():
    L, A, T = mat('Alcantara', '#141416', .9), mat('Papaya', '#ff8000', .5), mat('Carbon', '#101113', .25, .2)
    c = dict(leather=L, accent=A, trim=mat('Alu', '#aeb3ba', .3, 1.), roofmat=L, badge=mat('Speedmark', '#ff8000', .4), marker_mat=A, dashmat=T,
             seat_stripe=A, dash_prof=[(-0.70, -0.6), (-0.71, -0.34), (-0.78, -0.31), (-1.18, -0.35), (-1.18, -0.6)], dash_top=-0.31, dash_line=False,
             spokes=[0, math.pi], glove=mat('Glove', '#1a1a1c', .8), buttons=False, seatshell=T)
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
    def ex(W):
        for sx, col in ((-1, '#ff8000'), (1, '#2a7bff')):   # BOOST and AERO, under your thumbs
            cyl((sx * .09, .03, .0), .016, .014, mat('W1Btn' + col, col, .35, emit=.4), (math.radians(90), 0, 0), 20, W)
        for k in range(10):   # shift lights in the top of the rim
            a = math.radians(66 + k * 5.3); col = '#2fe05a' if k < 4 else '#ff2a1a' if k < 8 else '#2a7bff'
            sph((math.cos(a) * .158, .014, math.sin(a) * .158 * .74), .006, mat('LED' + col, col, .3, emit=3.), parent=W)
    wheel(c, 'flat2', R=.16, extra=ex)


def bugatti():
    L, A, T = mat('Tan', '#c8a879', .6), mat('Black', '#151516', .6), mat('PolishedAlu', '#d4d8de', .15, 1.)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('TanRoof', '#b89a6c', 1), badge=mat('EB', '#c9cdd3', .25, 1.), marker_mat=T, dashmat=L,
             rim=mat('RimBlack', '#141416', .6), spokemat=T, hubmat=L, glove=mat('Glove', '#1a1a1c', .8), consolemat=A,
             dash_prof=[(-0.68, -0.66), (-0.69, -0.32), (-0.78, -0.27), (-1.18, -0.31), (-1.18, -0.66)], dash_top=-0.27)
    cabin(c)
    # the C-line: a polished C from the roof down the middle of the car
    cl = [(0, -0.62, TOP - .03), (0, -0.66, 0), (0, -0.68, -0.3), (0, -0.62, -0.55), (0, -0.3, -0.6), (0, 0.15, -0.62)]
    tube(chaikin(cl, 2, False), .022, T, name='Cline')
    tube([(x, y + .02, z + .004) for x, y, z in chaikin(cl, 2, False)][1:-1], .005, mat('CLight', '#bfe4ff', .3, emit=5.), name='ClineLight')   # the glowing light conductor
    # the skeleton console with four round knobs standing up
    for k in range(4):   # four knobs, each with a little screen on top
        y = -0.64 + k * .075; cyl((0.0, y, on_stack(y, .03)), .022, .06, T, v=24); cyl((0.0, y, on_stack(y, .061)), .018, .006, mat('KnobFace', '#5aa8ff', .2, emit=.8), v=24)
    # watch-like dials fixed in the hub, the speedometer to 500 in the middle
    gauge(c, (EX, -0.6, -0.27), .3, .13, hood_w=.36)
    for x, r in ((-.09, .045), (0, .06), (.09, .045)): ring((EX, -0.6, -0.27), r, T, x)
    wheel(c, 'squircle', R=.18)


def koenigsegg():
    carbon, A, T = mat('Carbon', '#101114', .2, .25), mat('Orange', '#ff6a13', .5), mat('Alu', '#c3c8cf', .25, 1.)
    c = dict(leather=mat('Alcantara', '#161618', .9), accent=A, trim=T, roofmat=carbon, badge=mat('Shield', '#e8e8ea', .3, .6), marker_mat=A,
             dashmat=carbon, seat_stripe=A, pillar=carbon, glove=mat('Glove', '#1a1a1c', .8), seat=mat('OrangeLeather', '#e2621c', .55), seatshell=carbon, doorinsert=mat('OrangeLeather', '#e2621c', .55))
    cabin(c)
    screen(c, (0.04, -0.66, -0.36), .22, .14)
    # the gated shifter of the CC850 (a silver gate) and chrome toggles
    box((0, -0.55, on_stack(-0.55, .008)), (.12, .14, .012), T, rot=(-SLOPE, 0, 0))
    for k in range(3): box((-.04 + k * .04, -0.55, on_stack(-0.55, .014)), (.006, .1, .01), mat('Gate', '#08080a', .4), rot=(-SLOPE, 0, 0))
    cyl((0, -0.55, on_stack(-0.55, .06)), .006, .1, T); sph((0, -0.55, on_stack(-0.55, .11)), .022, T)
    def ex(W):
        # the SmartCluster: a small screen on the wheel itself, it turns with you
        plane_to('Gauge', (0, .049, .085), (0, 10, .085), .15, .075, mat('GaugeGlass', '#05070a', .2), W)   # (just in front of the carbon frame)
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
             marker_mat=A, dashmat=L, seat_stripe=mat('MBlue', '#1d5fd6', .5), glove=mat('Glove', '#1a1a1c', .8), amb='#3a8bff', seatshell=T)
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
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8), amb='#ff3a3a')
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
             seat_stripe=A, glove=mat('Glove', '#1a1a1c', .8), amb='#5aa8ff', rim=mat('Microfibre', '#1f2023', .95))
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
             dash_prof=[(-0.68, -0.66), (-0.69, -0.3), (-0.76, -0.26), (-1.18, -0.3), (-1.18, -0.66)], dash_top=-0.26, amb='#fff2dc')
    cabin(c)
    # the Illuminated Fascia: the passenger's side of the dash glows with its own stars
    random.seed(9); bm = bmesh.new()
    for _ in range(160):
        x, z = random.uniform(0.15, 0.85), random.uniform(-0.6, -0.36); r = random.choice((.0025, .0025, .004))
        v = [bm.verts.new(wrap(x + dx, -0.682, z + dz)) for dx, dz in ((-r, -r), (r, -r), (r, r), (-r, r))]; bm.faces.new(v)
    me = bpy.data.meshes.new('Fascia'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Fascia', me); bpy.context.collection.objects.link(o); link(o, None, stars)
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


def nissan():
    L, A, T = mat('Alcantara', '#141416', .85), mat('NismoRed', '#d0101a', .45), mat('Alu', '#aab0b8', .3, 1.)
    carbon = mat('Carbon', '#111214', .22, .25)
    c = dict(leather=L, accent=A, trim=T, roofmat=mat('Headliner', '#1e1f22', 1), badge=mat('NissanBadge', '#cfd4da', .25, 1.), marker_mat=A,
             dashmat=mat('DashLeather', '#17181b', .7), seat_stripe=A, consolemat=carbon, glove=mat('Glove', '#1a1a1c', .8), seatshell=carbon)
    dt = cabin(c)
    for s in (-1, 1): vent_round((s * 0.8, -0.7, dt - .08), .06, T, mat('VentIn', '#0a0a0b', .5), (0, 1, 0.1))   # round vents at both ends
    gauge(c, w=.4, h=.15, hood_w=.5)
    # the touchscreen high in the middle with tall vents either side, and red stitching along the dash
    screen(c, (0.05, -0.68, -0.3), .22, .13)
    for x in (-0.11, 0.21): box((x, -0.69, -0.32), (.04, .02, .12), mat('Vent', '#0a0a0b', .5), bevel=.006)
    box((0, -0.706, dt - .05), (1.8, .006, .006), A)
    # the three R-mode switches on carbon, the big red ENGINE START button and the short gear lever
    box((0, -0.58, on_stack(-0.58, .008)), (.2, .12, .012), carbon, rot=(-SLOPE, 0, 0))
    for k in range(3):
        x = -.06 + k * .06; box((x, -0.58, on_stack(-0.58, .03)), (.014, .02, .035), T, rot=(-SLOPE, 0, 0)); box((x, -0.62, on_stack(-0.62, .016)), (.03, .006, .006), A, rot=(-SLOPE, 0, 0))
    cyl((0.09, -0.47, on_stack(-0.47, .02)), .022, .02, mat('StartRed', '#e0101a', .3, emit=.5), (-SLOPE, 0, 0), 20)
    cyl((0, -0.42, on_stack(-0.42, .06)), .02, .1, L, (-SLOPE, 0, 0)); sph((0, -0.42, on_stack(-0.42, .12)), .026, T)
    def ex(W):   # the big magnesium paddles behind the wheel
        for s in (-1, 1): box((s * .2, -.04, .03), (.06, .008, .11), mat('Magnesium', '#9aa0a8', .35, .8), parent=W)
    wheel(c, 'round', extra=ex)


def amboola():
    L, T = mat('Black', '#0d0e12', .6), mat('Chrome', '#cfd6de', .2, 1.)
    acc, neon, gold = mat('AmbAccent', '#c8141b', .45), mat('AmbNeon', '#2fe0ff', .3, emit=2.), mat('TigerGold', '#ffc21f', .3, .8)
    c = dict(leather=L, accent=acc, trim=T, roofmat=mat('AmbRoof', '#101218', .9), badge=gold, marker_mat=neon, dashmat=mat('Dash', '#14161c', .55), seat=acc,
             seat_stripe=neon, consolemat=mat('Gloss', '#0a0b0e', .15, .2, coat=1.), spokes=[0, math.pi], rim=mat('RimBlack', '#121318', .5),
             glove=mat('Glove', '#1a1a1c', .8), dash_line=False, amb='#2fe0ff')
    dt = cabin(c)
    # neon light lines along the dash and both doors
    box((0, -0.706, dt - .04), (1.86, .008, .01), neon)
    for s in (-1, 1): box((s * 0.875, 0.1, BELT - .03), (.008, 1.7, .01), neon)
    # the hologram speed display floating over the dash (the game draws it see-through) and the projector under it
    gauge(c, (EX, -0.7, -0.18), .34, .13, hood=False)
    box((EX, -0.75, -0.255), (.3, .1, .02), mat('Projector', '#0a0b0e', .3)); box((EX, -0.75, -0.244), (.26, .07, .003), neon)
    # a wide screen in the middle and the AMBOOLA name in light on the passenger's side
    screen(c, (0.06, -0.69, -0.33), .3, .13)
    text('AMBOOLA', (0.36, -0.7, dt - .12), .055, neon)
    # the console: a gold tiger start button, a light strip and a little joystick in the car's colour
    cyl((0, -0.6, on_stack(-0.6, .02)), .03, .02, gold, (-SLOPE, 0, 0), 24); cyl((0, -0.6, on_stack(-0.6, .032)), .02, .006, mat('StartRed', '#e0101a', .3, emit=1.), (-SLOPE, 0, 0), 24)
    box((0, -0.5, on_stack(-0.5, .01)), (.2, .1, .006), neon, rot=(-SLOPE, 0, 0))
    cyl((0, -0.42, on_stack(-0.42, .05)), .012, .08, T, (-SLOPE, 0, 0)); sph((0, -0.42, on_stack(-0.42, .1)), .028, acc)
    box((0, 0.1, TOP - .035), (.9, .8, .01), mat('GlassRoof', '#0a1420', .1))   # a glass panel in the roof
    for s in (-1, 1): box((s * .46, 0.1, TOP - .04), (.008, .8, .008), neon)
    def ex(W):   # a light strip across the flat top of the wheel
        box((0, 0, .13), (.16, .03, .012), neon, parent=W)
    wheel(c, 'flat2', extra=ex)


BRANDS = dict(porsche=porsche, tesla=tesla, lambo=lambo, ferrari=ferrari, mclaren=mclaren, bugatti=bugatti, koenigsegg=koenigsegg, toyota=toyota,
              bmw=bmw, audi=audi, devel=devel, amg=amg, rolls=rolls, ford=ford, chevy=chevy, honda=honda, pagani=pagani, nissan=nissan, amboola=amboola)


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
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = int(os.environ.get('SAMPLES', 20)); scn.cycles.use_denoising = True
    scn.render.resolution_x, scn.render.resolution_y = (int(v) for v in os.environ.get('SIZE', '640x360').split('x'))
    scn.view_settings.view_transform = 'AgX'; scn.view_settings.look = 'AgX - Punchy'
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
        if '--no-export' not in argv: export(key)
