# The classic cars of Amboola (Grandpa Kenji's story), built in Blender by script (see carkit.py for the building
# blocks and carshape.py for the body from measurements).
#
#   blender -b --factory-startup --python models/blender/classics.py -- --car all
#
# Five real classics, each from its real length, width, height, wheelbase, overhangs and tyre sizes, with the things
# that make an old car look old: thin chrome bumpers, round lamps in chrome rings (or under glass covers), wire wheels
# with knock-off spinners, narrow tall tyres, chrome window frames and no modern aero (Car.classic switches off the
# splitter, diffuser, shark-fin antenna, black sills and cross-drilled discs the kit adds to modern cars).
#   tgt    Toyota 2000GT (1967)                 4.175 x 1.600 x 1.160 m, 2.330 m wheelbase, magnesium wheels
#   etype  Jaguar E-Type Series 1 coupe (1961)  4.453 x 1.657 x 1.219 m, 2.438 m wheelbase, wire wheels
#   gto    Ferrari 250 GTO (1962)               4.325 x 1.600 x 1.210 m, 2.400 m wheelbase, wire wheels
#   sl300  Mercedes-Benz 300 SL coupe (1954)    4.520 x 1.790 x 1.300 m, 2.400 m wheelbase, hubcaps, gullwing doors
#   rs27   Porsche 911 Carrera RS 2.7 (1973)    4.147 x 1.652 x 1.320 m, 2.271 m wheelbase, five-leaf forged wheels
# No makers' emblems: the badges are plain chrome shapes.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from carshape import build
from supercars import SOFT, SHARP, remap
from porsches import T911

ROUND = dict(crease_lines=0.1, crisp_front=0.75, crisp=0.08, crease_front=0.35, crease_rear=0.5)   # rounder than SOFT


def old(k):
    """mark the car as a classic (see Car.details) and give it chrome-era materials"""
    k.classic = True
    k.M['Amber'] = k.material('Amber', (0.95, 0.42, 0.02), rough=0.15, coat=1.0, emit=(1.0, 0.45, 0.02), strength=0.4)


def chrome(k, keys=('ws_trim', 'rw_trim', 'dlo_trim', 'pillar', 'mirror', 'mirrorstalk')):
    """the window frames, pillars and mirrors in chrome instead of gloss black / paint"""
    for o in k.parts:
        if o.name.split('.')[0] in keys and o.data.materials:
            o.data.materials.clear(); o.data.materials.append(k.M['Chrome'])


def bumper(k, z, h, ox, a0, a1, rear=False, proud=0.04, name='bumper', mat='Chrome', n=30):
    """a chrome bumper blade wrapped round the nose (rear=False) or the tail at height z, h tall: rays fanned in plan
    view from (ox, 0, z) at angles a0..a1 (radians from straight ahead / back, + is the car's left), the blade
    standing `proud` off the body with a round outer face"""
    sx = -1 if rear else 1; pts = []
    for i in range(n + 1):
        a = lerp(a0, a1, i / n)
        p, nrm = k.hit(V(ox, 0, z), V(sx * math.cos(a), math.sin(a), 0))
        if p is None: continue
        nh = V(nrm.x, nrm.y, 0)
        if nh.length < 1e-4: continue
        pts.append((p, nh.normalized()))
    if len(pts) < 2: return
    bm = bmesh.new(); rings = []; m = 12
    for p, nh in pts:
        c = p + nh * (proud * 0.45)
        rings.append([bm.verts.new(c + nh * (math.cos(2 * math.pi * j / m) * proud * 0.55) + V(0, 0, math.sin(2 * math.pi * j / m) * h * 0.5)) for j in range(m)])
    for A, B in zip(rings, rings[1:]):
        for j in range(m): bm.faces.new((A[j], A[(j + 1) % m], B[(j + 1) % m], B[j]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    k.mesh(name, bm, mat, part=True)


def overrider(k, x_dir, y, z, h=0.15, w=0.045, d=0.07):
    """an upright chrome overrider on a bumper: found by a ray from inside the car towards the nose (x_dir=1) or tail"""
    p, nrm = k.hit(V(0, y, z), V(x_dir, 0, 0))
    if p is None: return
    k.pod('overrider', 'Chrome', [(p.x + x_dir * 0.02, y, z - h / 2, w * 0.6, d * 0.3), (p.x + x_dir * 0.05, y, z - h * 0.2, w, d * 0.5),
                                  (p.x + x_dir * 0.055, y, z + h * 0.2, w, d * 0.5), (p.x + x_dir * 0.03, y, z + h / 2, w * 0.6, d * 0.3)],
          segs=12, sub=1, mirror=False)


def round_lamp(k, c, f, r, cover=None, bezel='Chrome', depth=0.06, mirror=True, name='lamp'):
    """a classic round headlamp: a chrome bezel, a glass lens over a deep silver reflector with the bulb's glow in the
    middle (lit at night, like every 'Headlight' part). cover=(rx, ry, depth) puts it at the back of a scoop under a
    big glass cover flush with the fender (E-Type, 250 GTO)"""
    for s in ((1, -1) if mirror else (1,)):
        cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
        if cover:
            rx, ry, dc = cover
            k.oval(f'{name}scoop', 'Chrome', cs, fs, rx * 1.07, ry * 1.07, .004, ring=0.92)
            cv = k.oval(f'li_{name}cover', 'LensClear', cs, fs, rx, ry, .007, n=12)
            k.pocket(cv, depth=dc, border=0.01, mat='Pocket', wall='Paint')
            for v in cv.data.vertices: v.co += cv.matrix_world.inverted().to_3x3() @ (fs.normalized() * 0.004)
        k.oval(f'{name}bezel', bezel, cs, fs, r * 1.18, r * 1.18, .006, ring=0.82)
        lens = k.oval(f'li_{name}lens', 'LensClear', cs, fs, r, r, .007, n=12)
        if k.pocket(lens, depth=depth, border=0.008, mat='LampBack', wall='LampBack') is None:
            lens.data.materials.clear(); lens.data.materials.append(k.M['LampBack'])
        k.oval(f'li_{name}glow', 'Headlight', cs, fs, r * 0.34, r * 0.34, .010, n=6)
        k.oval(f'li_{name}cap', 'Chrome', cs, fs, r * 0.13, r * 0.13, .013, n=4)


def tail_lamp(k, c, f, rx, ry, mat='Taillight', ring='Chrome', mirror=True, name='tail'):
    for s in ((1, -1) if mirror else (1,)):
        cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
        if ring: k.oval(f'{name}ring', ring, cs, fs, rx * 1.2, ry * 1.2, .005, ring=0.8)
        k.oval(name, mat, cs, fs, rx, ry, .006, n=8)


# ======================================================================= Toyota 2000GT (1967)
# 4.175 m long, 1.600 m wide, 1.160 m tall, 2.330 m wheelbase; 165HR15 tyres. A long, very low bonnet between
# fender humps, the cabin far back under a fastback roof, a short tail. Big round driving lamps behind clear covers
# in the nose corners, pop-up headlamps (shut) in the fender tops, a wide low mouth with a thin chrome bar, chrome
# bumperettes round the corners, fender mirrors, two small round lamps each side at the back, magnesium wheels.
TGT = dict(L=4.175, W=1.600, H=1.160, WB=2.330, fo=0.86, clear=0.15, nose_zb=0.27, tail_zb=0.30,
           top=[(2.025, 0.50), (1.97, 0.57), (1.80, 0.635), (1.40, 0.69), (0.90, 0.735), (0.40, 0.765), (0.10, 0.785),
                (-0.15, 0.95), (-0.40, 1.11), (-0.62, 1.16), (-0.90, 1.14), (-1.20, 1.05), (-1.55, 0.905), (-1.85, 0.86),
                (-2.08, 0.84), (-2.15, 0.76)],
           belt=[(2.025, 0.48), (1.85, 0.64), (1.40, 0.76), (0.80, 0.785), (0.10, 0.80), (-0.70, 0.82), (-1.40, 0.84),
                 (-1.95, 0.83), (-2.15, 0.74)],
           plan=[(2.025, 0.40), (1.96, 0.58), (1.78, 0.71), (1.40, 0.775), (1.00, 0.79), (0.40, 0.775), (-0.40, 0.775),
                 (-1.165, 0.80), (-1.75, 0.775), (-2.05, 0.68), (-2.15, 0.58)],
           roof=[(0.10, 0.60), (-0.40, 0.52), (-0.90, 0.50), (-1.30, 0.46), (-1.58, 0.42)],
           cab=(0.08, -0.42, -0.95, -1.58), bulge=0.05, hip=0.04, side=(0.02, -1.20), pillars=(), doors=(0.06, -0.92),
           mirror_x=1.20, mirror_out=-0.17, mirror_size=(0.075, 0.10, 0.06), rw_w=0.85, roof_crown=0.05)
def tgt(k):
    old(k)
    S = build(k, TGT, dict(r=0.318, w=0.165, rim=0.19), dict(r=0.318, w=0.165, rim=0.19), crease=ROUND)
    k.decal('grillebar', 'Chrome', 'front', -0.42, 0.42, 0.318, 0.330, 16, 1, off=.012)
    k.decal('mouth', 'Gloss', 'front', -0.44, 0.44, 0.25, 0.40, 18, 5)
    round_lamp(k, (1.93, 0.50, 0.475), (1, 0.30, 0.05), 0.072, name='drive')          # the big driving lamps in the nose
    for s in (1, -1):                                                                  # the pop-up headlamps, shut
        for y0, y1, x0, x1 in ((0.50, 0.70, 1.56, 1.565), (0.50, 0.70, 1.84, 1.845), (0.50, 0.505, 1.56, 1.845), (0.695, 0.70, 1.56, 1.845)):
            k.decal('popline', 'Black', 'top', x0, x1, s * y0, s * y1, 3, 3, off=.003)
        k.decal('sidelamp', 'Amber', side(s), 1.70, 1.82, 0.46, 0.50, 4, 2, off=.006)
        k.decal('fillerflap', 'Black', side(s), 0.78, 0.785, 0.52, 0.68, 1, 4, off=.003)   # the battery / air-box lid lines
    bumper(k, 0.37, 0.035, 1.40, 0.42, 1.05, proud=0.035, name='bumperL'); bumper(k, 0.37, 0.035, 1.40, -1.05, -0.42, proud=0.035, name='bumperR')
    k.decal('badge', 'Chrome', 'front', -0.06, 0.06, 0.46, 0.49, 4, 2, off=.008)
    # tail: two small round lamps each side, a thin chrome bumper, twin pipes
    for y in (0.46, 0.60): tail_lamp(k, (-2.14, y, 0.64), (-1, 0.15 + (y - 0.46), 0.05), 0.042, 0.042)
    bumper(k, 0.44, 0.035, -1.60, -0.95, 0.95, rear=True, proud=0.035, name='rearbumper')
    k.decal('rearbadge', 'Chrome', 'rear', -0.10, 0.10, 0.70, 0.715, 6, 1, off=.008)
    for y in (0.24, 0.32): k.exhaust(y, 0.27, r=0.028, mat='Chrome', mirror=False)
    chrome(k)
    k.join(); k.wheels(spokes=16, nut='spinner', caliper=(0.17, 0.06, 0.07))


# ======================================================================= Jaguar E-Type Series 1 3.8 coupe (1961)
# 4.453 m long, 1.657 m wide, 1.219 m tall, 2.438 m wheelbase; 6.40-15 tyres on 15-inch wire wheels. The longest
# bonnet of them all with a power bulge down its middle and louvres either side, an oval mouth with one chrome bar,
# headlamps deep in scoops under glass covers, little chrome bumper blades either side of the mouth and round the tail
# corners, a fastback roof down to a side-hinged tail door, slim tail lamps and twin centre pipes.
ETYPE = dict(L=4.453, W=1.657, H=1.219, WB=2.438, fo=0.95, clear=0.14, nose_zb=0.26, tail_zb=0.32,
             top=[(2.169, 0.46), (2.11, 0.555), (1.95, 0.635), (1.60, 0.715), (1.10, 0.785), (0.50, 0.83), (0.0, 0.855),
                  (-0.20, 0.97), (-0.48, 1.17), (-0.75, 1.219), (-1.05, 1.19), (-1.40, 1.08), (-1.75, 0.95), (-2.05, 0.87),
                  (-2.24, 0.78), (-2.284, 0.68)],
             belt=[(2.169, 0.44), (1.90, 0.66), (1.22, 0.79), (0.50, 0.815), (-0.10, 0.83), (-0.90, 0.85), (-1.50, 0.87),
                   (-2.00, 0.85), (-2.284, 0.66)],
             plan=[(2.169, 0.34), (2.10, 0.52), (1.90, 0.665), (1.50, 0.765), (1.22, 0.80), (0.60, 0.79), (-0.20, 0.81),
                   (-1.22, 0.828), (-1.80, 0.80), (-2.15, 0.70), (-2.284, 0.56)],
             roof=[(-0.02, 0.62), (-0.50, 0.55), (-0.95, 0.52), (-1.35, 0.48), (-1.78, 0.42)],
             cab=(-0.02, -0.50, -1.0, -1.78), bulge=0.0, hip=0.05, side=(-0.08, -1.45), pillars=(-1.00,), pillar_w=0.035,
             doors=(-0.06, -1.02), mirror_x=-0.05, mirror_size=(0.08, 0.11, 0.06), rw_w=0.85, roof_crown=0.05)
def etype(k):
    old(k)
    S = build(k, ETYPE, dict(r=0.33, w=0.165, rim=0.19), dict(r=0.33, w=0.165, rim=0.19), crease=ROUND)
    zt = lambda x: k.deck_z(x)
    k.pod('powerbulge', 'Paint', [(0.05, 0, zt(0.05) - 0.012, 0.20, 0.03), (0.6, 0, zt(0.6) - 0.004, 0.22, 0.04),
                                  (1.3, 0, zt(1.3) - 0.008, 0.19, 0.035), (1.75, 0, zt(1.75) - 0.02, 0.10, 0.025)], segs=16, sub=2, mirror=False, flat=0.9)
    k.rect('grillebar', 'Chrome', V(2.16, 0, 0.375), V(1, 0, 0.1), 0.50, 0.016, .014, 12, 1)
    k.oval('badge', 'Chrome', V(2.16, 0, 0.375), V(1, 0, 0.1), 0.03, 0.03, .018, n=4)
    k.oval('mouth', 'Gloss', V(2.16, 0, 0.375), V(1, 0, 0.1), 0.25, 0.095, .004, n=12)
    round_lamp(k, (1.92, 0.535, 0.565), (1, 0.42, 0.18), 0.072, cover=(0.15, 0.092, 0.08), name='head')
    for s in (1, -1):
        k.oval('sidelamp', 'Amber', V(2.02, s * 0.50, 0.40), V(1, s * 0.6, 0), 0.035, 0.02, .006, n=4)
        for i in range(9):                                                             # bonnet louvres, two banks
            x = 0.98 + i * 0.055
            k.decal('louvre', 'Gloss', 'top', x, x + 0.022, s * 0.30, s * 0.43, 1, 5)
    bumper(k, 0.31, 0.04, 1.60, 0.28, 1.0, proud=0.04, name='bumperL'); bumper(k, 0.31, 0.04, 1.60, -1.0, -0.28, proud=0.04, name='bumperR')
    # tail: slim tail lamps above the bumper corners, the bumper in two halves round the corners, twin centre pipes
    tail_lamp(k, (-2.20, 0.60, 0.62), (-1, 0.55, 0.1), 0.065, 0.03)
    tail_lamp(k, (-2.22, 0.55, 0.52), (-1, 0.45, 0.0), 0.04, 0.025, mat='Amber', name='indicator')
    bumper(k, 0.45, 0.04, -1.70, 0.12, 1.05, rear=True, name='rearbumperL'); bumper(k, 0.45, 0.04, -1.70, -1.05, -0.12, rear=True, name='rearbumperR')
    k.exhaust(0.055, 0.25, r=0.03, mat='Chrome')
    k.decal('reardoorline', 'Black', 'top', -1.80, -1.795, -0.50, 0.50, 2, 12, off=.003)
    chrome(k)
    k.join(); k.wheels(spokes=12, nut='spinner', caliper=(0.17, 0.06, 0.07))


# ======================================================================= Ferrari 250 GTO (1962)
# 4.325 m long, 1.600 m wide, 1.210 m tall, 2.400 m wheelbase; 6.00-15 / 7.00-15 tyres on Borrani wire wheels. A long,
# low nose with a wide oval mouth and three D-shaped ducts above it, round headlamps under clear covers in the fender
# tips, three gills behind each front wheel, a long carburettor bulge down the bonnet, a fastback roof to a short Kamm
# tail with a riveted spoiler lip, two round lamps each side and four pipes. A racing car: no bumpers.
GTO = dict(L=4.325, W=1.600, H=1.210, WB=2.400, fo=0.98, clear=0.12, nose_zb=0.22, tail_zb=0.30,
           top=[(2.18, 0.42), (2.12, 0.52), (1.95, 0.615), (1.60, 0.695), (1.10, 0.765), (0.55, 0.815), (0.16, 0.85),
                (-0.10, 1.02), (-0.40, 1.185), (-0.65, 1.21), (-0.95, 1.18), (-1.30, 1.06), (-1.70, 0.94), (-1.98, 0.925),
                (-2.10, 0.945), (-2.145, 0.90)],
           belt=[(2.18, 0.40), (1.95, 0.62), (1.20, 0.77), (0.40, 0.80), (-0.40, 0.82), (-1.20, 0.86), (-1.90, 0.89),
                 (-2.145, 0.86)],
           plan=[(2.18, 0.30), (2.11, 0.50), (1.92, 0.655), (1.50, 0.76), (1.20, 0.80), (0.60, 0.77), (0.0, 0.76),
                 (-0.60, 0.78), (-1.20, 0.80), (-1.80, 0.78), (-2.08, 0.72), (-2.145, 0.68)],
           roof=[(0.16, 0.62), (-0.40, 0.54), (-0.90, 0.51), (-1.30, 0.47), (-1.72, 0.42)],
           cab=(0.14, -0.42, -0.95, -1.72), bulge=0.035, hip=0.05, side=(0.06, -1.30), pillars=(), doors=(0.10, -0.95),
           mirror_x=0.05, mirror_size=(0.07, 0.10, 0.055), rw_w=0.85, roof_crown=0.05)
def gto(k):
    old(k)
    S = build(k, GTO, dict(r=0.325, w=0.16, rim=0.19), dict(r=0.335, w=0.185, rim=0.19), crease=ROUND)
    zt = lambda x: k.deck_z(x)
    k.pod('carbbulge', 'Paint', [(0.25, 0, zt(0.25) - 0.01, 0.14, 0.02), (0.6, 0, zt(0.6) - 0.002, 0.16, 0.035),
                                 (1.2, 0, zt(1.2) - 0.006, 0.14, 0.03), (1.55, 0, zt(1.55) - 0.016, 0.08, 0.018)], segs=16, sub=2, mirror=False, flat=0.9)
    k.oval('mouth', 'Gloss', V(2.15, 0, 0.345), V(1, 0, 0.12), 0.30, 0.095, .004, n=12)
    for y in (-0.20, 0.0, 0.20):                                                      # the three D ducts on the nose
        k.oval('vent', 'Gloss', V(2.06, y, 0.50), V(0.8, 0, 0.6), 0.055, 0.035, .004, n=6)
    k.decal('badge', 'Chrome', 'front', -0.035, 0.035, 0.455, 0.47, 3, 1, off=.010)
    round_lamp(k, (1.97, 0.53, 0.56), (1, 0.38, 0.22), 0.07, cover=(0.14, 0.09, 0.075), name='head')
    for s in (1, -1):
        for i in range(3):                                                             # three gills behind the front wheel
            x = 0.86 - i * 0.075
            k.slanted('gill', 'Gloss', s, x, x - 0.03, 0.48, 0.68, lean=0.05, nu=2, nv=6)
        k.oval('sidelamp', 'Amber', V(2.08, s * 0.52, 0.40), V(1, s * 0.5, 0), 0.03, 0.018, .006, n=4)
    # Kamm tail: the spoiler lip, two round lamps each side, a fuel cap, four pipes
    k.decal('spoilerlip', 'Paint', 'rear', -0.62, 0.62, 0.90, 0.95, 20, 2, off=.010)
    for y in (0.44, 0.58): tail_lamp(k, (-2.13, y, 0.76), (-1, 0.2 + (y - 0.44) * 2, 0.05), 0.045, 0.045)
    k.oval('fuelcap', 'Chrome', V(-1.62, 0.36, 0.98), V(-0.4, 0, 1), 0.055, 0.055, .010, n=6)
    for y in (0.40, 0.48): k.exhaust(y, 0.22, r=0.027, mat='Chrome')
    chrome(k)
    k.join(); k.wheels(spokes=12, nut='spinner', caliper=(0.17, 0.06, 0.07))


# ======================================================================= Mercedes-Benz 300 SL coupe, W198 (1954)
# 4.520 m long, 1.790 m wide, 1.300 m tall, 2.400 m wheelbase; 6.70-15 tyres. Gullwing doors cut up into the roof,
# a long bonnet with two power bulges, a wide low grille with one chrome bar and a big round emblem, round headlamps
# with small lamps under them, chrome gill vents behind the front wheels, full-width chrome bumpers with overriders,
# tall oval tail lamps and silver steel wheels with domed chrome hubcaps.
SL = dict(L=4.520, W=1.790, H=1.300, WB=2.400, fo=1.02, clear=0.16, nose_zb=0.28, tail_zb=0.30,
          top=[(2.22, 0.52), (2.16, 0.615), (1.98, 0.70), (1.60, 0.785), (1.00, 0.85), (0.45, 0.89), (0.10, 0.915),
               (-0.15, 1.09), (-0.42, 1.27), (-0.70, 1.30), (-1.00, 1.28), (-1.35, 1.18), (-1.70, 1.02), (-2.00, 0.925),
               (-2.24, 0.80), (-2.30, 0.68)],
          belt=[(2.22, 0.50), (2.00, 0.72), (1.20, 0.86), (0.40, 0.88), (-0.30, 0.90), (-1.20, 0.92), (-1.90, 0.90),
                (-2.30, 0.66)],
          plan=[(2.22, 0.46), (2.15, 0.66), (1.95, 0.80), (1.50, 0.875), (1.20, 0.895), (0.60, 0.87), (-0.20, 0.87),
                (-1.20, 0.895), (-1.80, 0.87), (-2.15, 0.78), (-2.30, 0.62)],
          roof=[(0.10, 0.66), (-0.42, 0.60), (-0.90, 0.58), (-1.35, 0.55), (-1.72, 0.50)],
          cab=(0.08, -0.42, -1.00, -1.72), bulge=0.05, hip=0.05, side=(0.02, -1.30), pillars=(), doors=(),
          mirror_x=0.30, mirror_size=(0.08, 0.11, 0.06), rw_w=0.85, roof_crown=0.06)
def sl300(k):
    old(k)
    S = build(k, SL, dict(r=0.34, w=0.17, rim=0.19), dict(r=0.34, w=0.17, rim=0.19), crease=ROUND)
    zt = lambda x, y=0.0: k.deck_z(x, y)
    k.pod('bulge', 'Paint', [(0.25, 0.24, zt(0.25, 0.24) - 0.012, 0.09, 0.02), (0.7, 0.25, zt(0.7, 0.25) - 0.004, 0.10, 0.03),   # the two bonnet bulges
                             (1.3, 0.25, zt(1.3, 0.25) - 0.006, 0.09, 0.025), (1.7, 0.24, zt(1.7, 0.24) - 0.014, 0.05, 0.015)], segs=14, sub=2, flat=0.9)
    k.rect('grillebar', 'Chrome', V(2.20, 0, 0.43), V(1, 0, 0.05), 0.80, 0.026, .014, 14, 1)
    k.oval('emblem', 'Chrome', V(2.20, 0, 0.43), V(1, 0, 0.05), 0.075, 0.075, .018, ring=0.78)
    k.oval('emblemdisc', 'Chrome', V(2.20, 0, 0.43), V(1, 0, 0.05), 0.03, 0.03, .018, n=4)
    k.oval('grille', 'Gloss', V(2.20, 0, 0.43), V(1, 0, 0.05), 0.44, 0.125, .004, n=14)
    round_lamp(k, (2.02, 0.61, 0.62), (1, 0.22, 0.05), 0.088, name='head')
    round_lamp(k, (2.06, 0.62, 0.475), (1, 0.30, 0.0), 0.04, depth=0.03, name='fog')
    for s in (1, -1):                                                                  # the gill vents with chrome strakes
        k.slanted('gill', 'Gloss', s, 0.30, 0.70, 0.56, 0.68, lean=0.0, nu=8, nv=3)
        for z in (0.595, 0.645): k.decal('strake', 'Chrome', side(s), 0.28, 0.72, z, z + 0.012, 10, 1, off=.012)
        # the gullwing door: from the A-pillar to behind the seats, up over the roof to the hinge in its middle
        for x in (0.04, -1.02): k.decal('doorline', 'Black', side(s), x - .004, x + .004, 0.42, 0.90, 1, 12, off=.002)
        k.decal('doorline', 'Black', side(s), -1.02, 0.04, 0.416, 0.424, 12, 1, off=.002)
        k.decal('doorline', 'Black', 'top', -1.0, 0.0, s * 0.055, s * 0.063, 12, 1, off=.003)
        k.oval('tail', 'Taillight', V(-2.20, s * 0.66, 0.62), V(-1, s * 0.75, 0), 0.042, 0.085, .006, n=8)
        k.oval('tailring', 'Chrome', V(-2.20, s * 0.66, 0.62), V(-1, s * 0.75, 0), 0.052, 0.098, .005, ring=0.82)
    bumper(k, 0.34, 0.05, 1.40, -1.05, 1.05, proud=0.05)
    for s in (1, -1): overrider(k, 1, s * 0.34, 0.37)
    bumper(k, 0.34, 0.05, -1.50, -1.05, 1.05, rear=True, proud=0.05, name='rearbumper')
    for s in (1, -1): overrider(k, -1, s * 0.36, 0.37)
    k.exhaust(-0.50, 0.25, r=0.03, mat='Chrome', mirror=False)
    chrome(k)
    k.join(); k.wheels(spokes=5, style='hubcap')


# ======================================================================= Porsche 911 Carrera RS 2.7 (1973)
# 4.147 m long, 1.652 m wide (flared rear wings), 1.320 m tall, 2.271 m wheelbase; 185/70 and 215/60 VR15 on forged
# five-leaf wheels (in the colour of the side stripes). The round headlamps up on tall front fenders, the bonnet
# low between them, horn grilles and amber indicators in the front bumper, the famous ducktail on the engine lid,
# tail lamps across the corners, a single pipe, black window trim and stripes along the sills.
# The shell is the kit's 911 (porsches.T911, traced from drawings of the 992: the 911 silhouette barely changed in fifty
# years) brought to the 1973 car's size: the nose, the 2.271 m wheelbase and the tail each stretched to fit, 13 % narrower,
# and the engine lid lower, ending in the ducktail.
RS_X = [(2.275, 1.976), (1.22, 1.1355), (-1.24, -1.1355), (-2.29, -2.171)]
RS_LID = [(-1.50, 0.0), (-1.72, -0.03), (-1.88, -0.05), (-2.02, -0.065), (-2.14, -0.07), (-2.22, -0.05), (-2.29, -0.03)]
def rs27(k):
    old(k)
    X = lambda x: pl(RS_X, x); ys = 0.865; zf = lambda z: z + 0.015
    rows = []
    for r in T911:   # the lower engine lid of the 1973 car (the 992's sits higher over a bigger engine)
        d = pl(RS_LID, r[0]) if r[0] < -1.5 else 0.0
        r = list(r); r[5] += d * 0.4; r[7] += d; r[9] += d; r[10] += d; rows.append(tuple(r))
    rows = remap(rows, RS_X, ys, zf)
    k.loft(stations(rows), **ROUND)
    k.arches(dict(F=dict(x=1.1355, r=0.32, w=0.185, y=0.686, rim=0.19), R=dict(x=-1.1355, r=0.32, w=0.215, y=0.697, rim=0.19))); k.surface()
    k.windscreen(X(0.82), X(0.22), zf(0.885), 0.585 / 0.923, 0.57 * ys, 0.48 * ys, sweep=0.2)
    k.rear_window(X(-1.60), X(-0.90), zf(0.98) + pl(RS_LID, -1.60) * 0.5, 0.36, 0.48 * ys, 0.50 * ys)
    k.side_glass(top=[(X(x), zf(z)) for x, z in ((0.50, 0.912), (0.40, 0.99), (0.30, 1.06), (0.20, 1.12), (0.11, 1.178), (-0.12, 1.206), (-0.36, 1.200),
                                                 (-0.58, 1.165), (-0.70, 1.129), (-0.89, 1.088), (-1.07, 1.041), (-1.21, 0.985))],
                 bot=[(X(x), zf(z)) for x, z in ((0.50, 0.911), (-0.52, 0.912), (-0.67, 0.950), (-1.21, 0.978))], pillars=[X(-0.555)], pillar_w=0.05)
    for s in (1, -1):
        for xg in (0.62, -0.58): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, 0.27, zf(0.89), 1, 12, off=.002)
    k.mirrors(X(0.34), 0.90 * ys, zf(0.945), size=(0.08, 0.11, 0.07))
    k.interior(X(-0.25), 1.3 * ys, zf(0.72))
    # the face: round headlamps up on the fenders, horn grilles and amber indicators in the bumper, a rubber strip
    round_lamp(k, (X(1.86), 0.665 * ys, zf(0.735)), (1, 0.12, 0.42), 0.094, name='head')
    for s in (1, -1):
        k.oval('grille', 'Gloss', V(1.90, s * 0.42, 0.38), V(1, s * 0.35, 0), 0.07, 0.04, .004, n=6)   # horn grilles
        k.rect('indicator', 'Amber', V(1.88, s * 0.58, 0.45), V(1, s * 0.6, 0), 0.10, 0.04, .006, 4, 2)
        k.decal('stripe', 'Accent', side(s), X(-0.80), X(0.62), 0.27, 0.315, 24, 2, off=.003)       # the side stripes
        k.fan('tailunit', 'Taillight', -1.45, 0.62, 0.69, s * 0.50, s * 0.86, 6, 2, off=.006)
    k.decal('bumperstrip', 'Black', 'front', -0.70, 0.70, 0.31, 0.335, 24, 1, off=.006)
    k.decal('badge', 'Chrome', 'front', -0.035, 0.035, 0.60, 0.63, 3, 2, off=.008)
    # the ducktail: a lip in body colour along the end of the engine lid, with the engine grille's black slats in front
    zl = k.deck_z(X(-2.10))
    k.spoiler(X(-2.02), zl + 0.05, 0.20, 1.06, aoa=-14, mat='Paint', strut_y=0.30, strut_mat='Paint', thick=0.09)
    k.decal('enginegrille', 'Gloss', 'top', X(-2.02), X(-1.78), -0.34, 0.34, 6, 12)
    for i in range(8):
        k.decal('engineslat', 'Black', 'top', X(-2.01) + i * 0.028, X(-2.01) + 0.012 + i * 0.028, -0.32, 0.32, 1, 12, off=.010)
    k.decal('rearbumperstrip', 'Black', 'rear', -0.75, 0.75, 0.36, 0.385, 24, 1, off=.006)
    k.exhaust(0.42, 0.25, r=0.034, mat='Chrome', mirror=False)
    chrome(k, keys=('mirror', 'mirrorstalk'))
    k.join(); k.wheels(spokes=5, style='leaf')


CARS = {
    'tgt': (tgt, '#efece2', '#b8bcc0', '#3a3a3c'),
    'etype': (etype, '#1d3b2a', '#c8ccd0', '#3a3a3c'),
    'gto': (gto, '#c1111b', '#c8ccd0', '#3a3a3c'),
    'sl300': (sl300, '#b9bcbe', '#b9bcbe', '#3a3a3c'),
    'rs27': (rs27, '#f1efe6', '#c8141b', '#3a3a3c'),
}

if __name__ == '__main__':
    main(CARS, 'classics.py')
