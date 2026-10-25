# Lamborghini and Ferrari models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/supercars.py -- --car all
#   blender -b --factory-startup --python models/blender/supercars.py -- --car svj --renders DIR --sheet --samples 8
#
# Car ids match index.html CARS. Lamborghinis use high creases for their sharp, faceted wedge shapes; Ferraris use
# soft creases for flowing curves.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from carshape import build

SHARP = dict(crease_lines=0.85, crisp_front=-9, crisp=0.75, crease_front=0.8, crease_rear=0.9)
SOFT = dict(crease_lines=0.2, crisp_front=0.7, crisp=0.15, crease_front=0.45, crease_rear=0.6)

def remap(rows, xs, ys=1.0, zf=lambda z: z):
    """reuse a station table on another car: xs = [(old x, new x), ...] anchor pairs, ys scales widths, zf maps heights"""
    out = []
    for r in rows:
        r = list(r); r[0] = pl(xs, r[0])
        for i in (2, 4, 6, 8): r[i] *= ys
        for i in (1, 3, 5, 7, 9, 10): r[i] = zf(r[i])
        out.append(tuple(r))
    return out

def hex_exhaust(k, y, z, r=0.07, mirror=True):
    """Lamborghini hexagonal tailpipes, high in the rear grille"""
    for s in ((1, -1) if mirror and y else (1,)):
        p, _ = k.hit((-6, s * y, z), (1, 0, 0)); px = (p.x if p else -2.4) + .03
        k.cylinder('exhaust', 'Titanium', (px, s * y, z), r, 0.14, segs=6, caps=False)
        k.cylinder('exhaustin', 'Black', (px + .01, s * y, z), r * .88, 0.12, segs=6)

def y_lights(k, c, f, size=0.15):
    """Lamborghini Y-shaped LED signature inside a slim black headlight"""
    k.headlight_quad(c, f, size * 2.0, size * 0.75, slant=0.03, dots='row')
    for s in (1, -1):
        cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
        _, e1, e2 = k.basis(fs)
        for dx, dy, w, h, sl in ((0, size * .32, size * 1.3, .012, 0.0), (-size * .55, -size * .05, size * .9, .012, size * .5), (size * .55, -size * .05, size * .9, .012, -size * .5)):
            k.rect('ydrl', 'Headlight', cs + e1 * dx * s + e2 * dy, fs, w, h, .012, nu=6, nv=1, slant=sl * s)

def y_tails(k, ox, z0, z1, a0, a1):
    """Y / hexagonal tail lights at the rear corners, over a black rear grille"""
    k.tail_clusters(ox, z0, z1, a0, a1)
    for s in (1, -1):
        k.fan('tailY', 'Taillight', ox, z0 - .06, z0, s * a0, s * (a0 + (a1 - a0) * .4), 6, 2, off=.007)

# ======================================================================= Lamborghini V12 (Revuelto / Aventador SVJ)
# front axle x=1.50, rear axle x=-1.28, 4.95 m long, 2.03 m wide, 1.14 m tall
TLAM = [
    ( 2.47, .24, .70, .34, .68, .38, .56, .40, .30, .41, .41),
    ( 2.38, .14, .88, .38, .86, .46, .72, .50, .42, .50, .49),
    ( 2.15, .13, .96, .44, .94, .58, .80, .62, .48, .58, .57),
    ( 1.85, .12, .99, .50, .975, .68, .84, .72, .50, .66, .645),
    ( 1.50, .12, 1.0, .54, .985, .75, .85, .79, .50, .73, .72),
    ( 1.15, .12, .985, .55, .97, .80, .84, .84, .52, .80, .79),
    ( 0.80, .11, .96, .55, .945, .82, .80, .86, .56, .92, .93),
    ( 0.40, .11, .945, .54, .93, .84, .74, .96, .58, 1.06, 1.08),
    (-0.10, .11, .95, .55, .935, .86, .70, 1.0, .58, 1.12, 1.14),
    (-0.55, .11, .98, .58, .96, .88, .70, .99, .56, 1.08, 1.10),
    (-0.95, .12, 1.01, .62, .99, .92, .72, .98, .50, 1.03, 1.04),
    (-1.28, .14, 1.015, .64, .995, .95, .72, .99, .45, 1.01, 1.02),
    (-1.70, .18, 1.01, .65, .99, .96, .70, .995, .45, 1.0, 1.0),
    (-2.10, .22, .98, .64, .96, .96, .66, .99, .42, .99, .99),
    (-2.38, .28, .90, .62, .88, .94, .58, .97, .36, .97, .97),
    (-2.50, .36, .72, .60, .70, .90, .46, .92, .28, .92, .92),
]
WLAM = dict(F=dict(x=1.50, r=0.345, w=0.255, y=0.86, rim=0.254), R=dict(x=-1.28, r=0.37, w=0.355, y=0.86, rim=0.279))

# Every Lamborghini below is built by carshape.build from its real measurements (the axles at +-wheelbase/2): the
# one-line wedge from the low nose over the cabin to the tail, very flat windscreens, crisp creases.

# ---- Revuelto: 4.95 x 2.03 x 1.16 m, 2.78 m wheelbase. Y-shaped lights, a huge side intake through the door, the
# V12 showing through a gap in the engine cover, hexagon tail lights and two hexagonal pipes up high.
PREV = dict(L=4.947, W=2.033, H=1.160, WB=2.779, fo=1.10, clear=0.11, nose_zb=0.22, tail_zb=0.40,
            top=[(2.49, 0.42), (2.38, 0.50), (2.1, 0.58), (1.7, 0.66), (1.3, 0.74), (1.0, 0.80), (0.5, 1.0), (0.05, 1.13),
                 (-0.25, 1.16), (-0.65, 1.12), (-1.1, 1.06), (-1.6, 1.03), (-2.1, 1.01), (-2.35, 1.0), (-2.457, 0.92)],
            belt=[(2.49, 0.40), (2.2, 0.58), (1.6, 0.72), (1.0, 0.80), (0.4, 0.84), (-0.4, 0.87), (-1.0, 0.95), (-1.6, 0.99),
                  (-2.2, 0.97), (-2.457, 0.86)],
            plan=[(2.49, 0.36), (2.38, 0.66), (2.1, 0.88), (1.39, 1.0), (0.6, 0.96), (0.0, 0.955), (-0.7, 1.0), (-1.39, 1.016),
                  (-2.0, 0.98), (-2.35, 0.88), (-2.457, 0.78)],
            roof=[(1.0, 0.68), (0.4, 0.60), (-0.25, 0.56), (-0.65, 0.50), (-1.1, 0.44)],
            cab=(1.0, 0.05, -0.65, -1.10), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.04, side=(0.92, -0.92),
            doors=(0.90,), mirror_x=0.84, rw_w=0.9, rw_bulge=0.0, roof_crown=0.04)
def lambo_common(k, S, x0=-0.30, x1=-1.0):
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, x0, x1, 0.38, 0.82, lean=0.28, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.05, 0.11, 0.20, 30, 2)
    k.decal('roof', 'Carbon', 'top', -0.55, 0.0, -0.46, 0.46, 12, 10, off=.003)
def revuelto(k):
    S = build(k, PREV, dict(r=0.347, w=0.265, rim=0.254), dict(r=0.37, w=0.345, rim=0.267), crease=SHARP)
    lambo_common(k, S)
    y_lights(k, (2.24, 0.72, 0.58), (0.62, 0.36, 0.55))
    k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.16, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.44, s * 0.90, 0.15, 0.40, 12, 6))
    k.decal('splitter', 'Carbon', 'front', -0.94, 0.94, 0.11, 0.16, 30, 2)
    k.decal('enginegap', 'Gloss', 'top', -2.0, -1.45, -0.32, 0.32, 8, 6)      # the V12 shows through the cover
    for i in range(4): k.decal('enginebar', 'Carbon', 'top', -1.95 + i * .14, -1.92 + i * .14, -0.30, 0.30, 1, 6, off=.008)
    k.fan('rearbg', 'Gloss', -1.9, 0.40, 0.92, -0.66, 0.66, 30, 8, off=.003)
    y_tails(k, -1.9, 0.82, 0.92, 0.42, 0.76)
    k.fan('diffuser', 'Carbon', -1.9, 0.24, 0.40, -0.72, 0.72, 30, 3)
    hex_exhaust(k, 0.10, 0.70, r=0.06)
    k.spoiler(-2.30, 1.06, 0.26, 1.50, aoa=-6, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.03, 0.02))

# ---- Aventador SVJ: 4.94 x 2.10 x 1.14 m, 2.70 m wheelbase. Lower and wider still: a carbon fin down the engine
# cover, the huge wing on its uprights, Y lights, louvres and two big hex pipes.
PSVJ = dict(PREV, L=4.943, W=2.098, H=1.136, WB=2.70, fo=1.17,
            top=[(2.52, 0.40), (2.4, 0.48), (2.1, 0.56), (1.7, 0.64), (1.3, 0.72), (1.0, 0.78), (0.5, 0.98), (0.05, 1.11),
                 (-0.25, 1.136), (-0.65, 1.10), (-1.1, 1.04), (-1.6, 1.01), (-2.1, 1.0), (-2.33, 0.99), (-2.423, 0.90)],
            belt=[(2.52, 0.38), (2.2, 0.56), (1.6, 0.70), (1.0, 0.78), (0.4, 0.82), (-0.4, 0.85), (-1.0, 0.94), (-1.6, 0.98),
                  (-2.2, 0.96), (-2.423, 0.85)],
            plan=[(2.52, 0.36), (2.4, 0.68), (2.1, 0.90), (1.35, 1.03), (0.6, 0.98), (0.0, 0.975), (-0.7, 1.03), (-1.35, 1.049),
                  (-2.0, 1.0), (-2.33, 0.90), (-2.423, 0.80)])
def svj(k):
    S = build(k, PSVJ, dict(r=0.33, w=0.255, rim=0.254), dict(r=0.355, w=0.355, rim=0.267), crease=SHARP)
    lambo_common(k, S)
    for s in (1, -1): k.decal('scoop', 'Gloss', 'top', -1.05, -0.70, s * 0.76, s * 0.96, 4, 4)       # shoulder scoops
    for i in range(6): k.decal('louvre', 'Gloss', 'top', -2.15 + i * .12, -2.08 + i * .12, -0.55, 0.55, 2, 12)
    y_lights(k, (2.26, 0.74, 0.56), (0.62, 0.36, 0.55))
    k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.15, 0.28, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.42, s * 0.92, 0.14, 0.40, 12, 6))
    k.decal('splitter', 'Carbon', 'front', -0.96, 0.96, 0.10, 0.15, 30, 2)
    k.fan('rearbg', 'Gloss', -1.9, 0.38, 0.90, -0.66, 0.66, 30, 8, off=.003)
    y_tails(k, -1.9, 0.80, 0.90, 0.42, 0.76)
    k.fan('diffuser', 'Carbon', -1.9, 0.22, 0.38, -0.72, 0.72, 30, 3)
    hex_exhaust(k, 0.13, 0.70, r=0.065)
    k.post_wing(-1.95, 1.24, 0.40, 1.90, -2.10, 0.44, aoa=-8,
                endplate=[(-1.89, 1.19), (-1.91, 1.34), (-2.41, 1.38), (-2.45, 1.24), (-2.27, 1.17)])
    k.pod('fin', 'Carbon', [(-0.75, 0.0, 1.11, 0.01, 0.01), (-1.10, 0.0, 1.10, 0.012, 0.06), (-1.95, 0.0, 1.05, 0.012, 0.05)], mirror=False, sub=1)
    k.join(); k.wheels(spokes=10)

# ---- Temerario: 4.71 x 2.00 x 1.20 m, 2.66 m wheelbase. Hexagon DRLs, a clean wedge, hexagon tail lights, one big
# hexagonal pipe in the middle and a ducktail spoiler.
PTEM = dict(L=4.706, W=1.996, H=1.201, WB=2.658, fo=1.07, clear=0.11, nose_zb=0.22, tail_zb=0.40,
            top=[(2.399, 0.44), (2.3, 0.52), (2.0, 0.60), (1.6, 0.68), (1.25, 0.76), (0.95, 0.82), (0.5, 1.01), (0.1, 1.17),
                 (-0.2, 1.201), (-0.6, 1.16), (-1.0, 1.08), (-1.6, 1.04), (-2.1, 1.03), (-2.25, 1.04), (-2.307, 0.95)],
            belt=[(2.399, 0.42), (2.1, 0.60), (1.6, 0.74), (1.0, 0.82), (0.4, 0.85), (-0.4, 0.88), (-1.0, 0.96), (-1.6, 0.99),
                  (-2.2, 0.98), (-2.307, 0.88)],
            plan=[(2.399, 0.38), (2.3, 0.66), (2.0, 0.87), (1.33, 0.985), (0.6, 0.95), (0.0, 0.945), (-0.7, 0.985), (-1.33, 0.998),
                  (-1.95, 0.96), (-2.25, 0.86), (-2.307, 0.78)],
            roof=[(0.95, 0.66), (0.4, 0.60), (-0.2, 0.55), (-0.6, 0.50), (-1.0, 0.44)],
            cab=(0.95, 0.10, -0.62, -1.0), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.04, side=(0.88, -0.88),
            doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0, roof_crown=0.04)
def temerario(k):
    S = build(k, PTEM, dict(r=0.347, w=0.265, rim=0.254), dict(r=0.364, w=0.325, rim=0.267), crease=SHARP)
    lambo_common(k, S, -0.35, -0.95)
    k.headlight_quad((2.10, 0.68, 0.60), (0.62, 0.36, 0.55), 0.26, 0.08, slant=0.03, dots='row')
    for s in (1, -1):
        k.oval('hexdrl', 'Headlight', V(2.08, s * 0.68, 0.62), V(0.62, s * 0.36, 0.55), 0.07, 0.06, .012, ring=0.6, n=6)
        k.oval('hextail', 'Taillight', V(-2.25, s * 0.66, 0.84), V(-1, s * 0.3, 0.05), 0.09, 0.075, .007, ring=0.55, n=6)
    k.decal('intakeC', 'Gloss', 'front', -0.32, 0.32, 0.16, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.42, s * 0.86, 0.15, 0.40, 12, 6))
    k.decal('splitter', 'Carbon', 'front', -0.90, 0.90, 0.11, 0.16, 30, 2)
    k.fan('rearbg', 'Gloss', -1.8, 0.40, 0.76, -0.62, 0.62, 30, 6, off=.003)
    k.fan('diffuser', 'Carbon', -1.8, 0.24, 0.40, -0.70, 0.70, 30, 3)
    hex_exhaust(k, 0.0, 0.62, r=0.09, mirror=False)
    k.spoiler(-2.18, 1.10, 0.24, 1.40, aoa=-6, mat='Carbon', strut_y=0.36)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

# ---- Huracán STO: 4.55 x 1.95 x 1.22 m, 2.62 m wheelbase. The one-piece "cofango" bonnet with vents, a roof snorkel,
# a shark fin down the engine cover, a big fixed wing, Y lights and two pipes up high.
PSTO = dict(L=4.549, W=1.945, H=1.22, WB=2.62, fo=1.03, clear=0.11, nose_zb=0.22, tail_zb=0.40,
            top=[(2.34, 0.46), (2.24, 0.54), (1.95, 0.62), (1.6, 0.69), (1.25, 0.76), (0.95, 0.82), (0.5, 1.02), (0.1, 1.19),
                 (-0.2, 1.22), (-0.6, 1.17), (-1.0, 1.08), (-1.6, 1.04), (-2.1, 1.03), (-2.209, 0.95)],
            belt=[(2.34, 0.44), (2.05, 0.62), (1.6, 0.74), (1.0, 0.82), (0.4, 0.85), (-0.4, 0.88), (-1.0, 0.96), (-1.6, 0.99),
                  (-2.1, 0.98), (-2.209, 0.88)],
            plan=[(2.34, 0.40), (2.24, 0.66), (1.95, 0.86), (1.31, 0.96), (0.6, 0.93), (0.0, 0.925), (-0.7, 0.96), (-1.31, 0.9725),
                  (-1.9, 0.94), (-2.15, 0.86), (-2.209, 0.78)],
            roof=[(0.95, 0.64), (0.4, 0.58), (-0.2, 0.54), (-0.6, 0.49), (-1.0, 0.43)],
            cab=(0.95, 0.10, -0.62, -1.0), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.04, side=(0.88, -0.88),
            doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0, roof_crown=0.04)
def huracan_face(k):
    y_lights(k, (2.06, 0.66, 0.60), (0.62, 0.36, 0.55), size=0.13)
    k.decal('intakeC', 'Gloss', 'front', -0.30, 0.30, 0.16, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.40, s * 0.84, 0.15, 0.40, 12, 6))
    k.fan('rearbg', 'Gloss', -1.7, 0.40, 0.92, -0.62, 0.62, 30, 8, off=.003)
    y_tails(k, -1.7, 0.82, 0.92, 0.42, 0.72)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.40, -0.70, 0.70, 30, 3)
def sto(k):
    S = build(k, PSTO, dict(r=0.3275, w=0.245, rim=0.254), dict(r=0.3455, w=0.305, rim=0.254), crease=SHARP)
    lambo_common(k, S, -0.35, -0.95)
    huracan_face(k)
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.11, 0.16, 30, 2)
    for i in range(5): both(lambda s, i=i: k.decal('cofangovent', 'Gloss', 'top', 1.10 + i * .07, 1.14 + i * .07, s * 0.55, s * 0.80, 1, 5))
    k.naca(1.45, 1.85, 0.0, 0.05, 0.22)
    k.pod('snorkel', 'Paint', [(0.10, 0, 1.24, 0.04, 0.02), (-0.02, 0, 1.29, 0.13, 0.07), (-0.45, 0, 1.27, 0.15, 0.06), (-0.75, 0, 1.18, 0.10, 0.03)], mirror=False, flat=0.7)
    k.box('snorkelmouth', 'Gloss', (0.0, 0, 1.30), (0.02, 0.20, 0.06))
    k.pod('fin', 'Paint', [(-0.80, 0.0, 1.15, 0.01, 0.01), (-1.05, 0.0, 1.12, 0.012, 0.07), (-1.85, 0.0, 1.05, 0.012, 0.05)], mirror=False, sub=1)
    k.post_wing(-1.90, 1.22, 0.36, 1.70, -2.02, 0.40, aoa=-9,
                endplate=[(-1.84, 1.17), (-1.86, 1.32), (-2.24, 1.35), (-2.28, 1.22), (-2.14, 1.15)])
    k.exhaust(0.16, 0.80, r=0.05)
    k.join(); k.wheels(spokes=10)

# ---- Huracán Sterrato: 4.53 x 1.96 x 1.25 m - the STO's body lifted 44 mm for dirt, with black arch cladding,
# light pods in the nose, roof rails, a roof scoop and all-terrain tyres.
STER_LIFT = 0.044
PSTER = dict(PSTO, L=4.525, W=1.956, H=1.248, WB=2.629, fo=1.0, clear=0.15, nose_zb=0.27, tail_zb=0.42)
def sterrato(k):
    S = build(k, PSTER, dict(r=0.335, w=0.235, rim=0.241, cz=0.335 - STER_LIFT + 0.01, gap=0.07),
              dict(r=0.355, w=0.285, rim=0.241, cz=0.355 - STER_LIFT + 0.01, gap=0.07), crease=SHARP)
    lambo_common(k, S, -0.35, -0.95)
    huracan_face(k)
    k.arch_trim(0.08)
    both(lambda s: k.decal('cladding', 'Black', side(s), -0.95, 1.05, 0.11, 0.30, 30, 3, off=.006))
    k.decal('skid', 'Black', 'front', -0.60, 0.60, 0.13, 0.22, 20, 2, off=.006)
    for s in (1, -1):   # light pods on the nose, roof rails, roof scoop
        k.cylinder('lightpod', 'Black', (2.10, s * 0.32, 0.58), 0.07, 0.10)
        k.cylinder('lightpodlens', 'Headlight', (2.15, s * 0.32, 0.58), 0.058, 0.004)
        k.blade('rail', 'Black', [(0.05, 0, k.deck_z(0.05, s * .48) + .03), (-0.25, 0, k.deck_z(-0.25, s * .48) + .045), (-0.60, 0, k.deck_z(-0.60, s * .48) + .03)], s * 0.48, 0.03, 0.03, 0.025)
    k.pod('snorkel', 'Black', [(0.0, 0, 1.24, 0.04, 0.02), (-0.10, 0, 1.28, 0.12, 0.06), (-0.55, 0, 1.24, 0.13, 0.05)], mirror=False, flat=0.7)
    k.exhaust(0.16, 0.80, r=0.05)
    k.join(lift=STER_LIFT); k.wheels(spokes=10, spoke_w=(0.03, 0.02), nut='bolts', offroad=True)

# ======================================================================= Lamborghini Urus Performante
# front axle x=1.60, rear axle x=-1.40, 5.12 m long, 2.02 m wide, 1.64 m tall
TURUS = [
    ( 2.56, .38, .72, .58, .70, .70, .60, .74, .38, .76, .76),
    ( 2.48, .28, .90, .62, .88, .80, .76, .84, .50, .85, .85),
    ( 2.28, .25, .98, .68, .965, .90, .82, .95, .58, .93, .92),
    ( 1.95, .23, 1.0, .74, .99, .97, .84, 1.01, .60, .99, .98),
    ( 1.60, .22, 1.01, .78, 1.0, 1.02, .85, 1.05, .60, 1.04, 1.03),
    ( 1.20, .21, 1.0, .79, .99, 1.05, .86, 1.08, .60, 1.09, 1.08),
    ( 0.90, .21, .99, .79, .975, 1.08, .86, 1.15, .68, 1.24, 1.26),
    ( 0.45, .21, .985, .78, .97, 1.10, .83, 1.33, .70, 1.56, 1.60),
    ( 0.00, .21, .985, .78, .97, 1.11, .82, 1.37, .71, 1.62, 1.64),
    (-0.60, .21, .99, .79, .975, 1.12, .81, 1.36, .70, 1.58, 1.61),
    (-1.10, .22, 1.0, .81, .985, 1.14, .79, 1.30, .66, 1.48, 1.51),
    (-1.40, .24, 1.01, .82, .99, 1.15, .77, 1.25, .63, 1.40, 1.42),
    (-1.85, .28, 1.0, .83, .98, 1.15, .73, 1.20, .57, 1.27, 1.29),
    (-2.25, .33, .96, .82, .94, 1.14, .67, 1.17, .49, 1.19, 1.20),
    (-2.48, .38, .87, .79, .85, 1.11, .59, 1.14, .41, 1.15, 1.16),
    (-2.57, .44, .67, .75, .65, 1.05, .47, 1.08, .29, 1.09, 1.09),
]
# ---- Urus Performante: 5.14 x 2.03 x 1.62 m, 3.01 m wheelbase. A super-SUV with a coupe roof: Y lights, a huge
# hexagon grille and side intakes, a carbon roof and bonnet vents, Y tail lights, a roof spoiler and four pipes.
PURUS = dict(L=5.137, W=2.026, H=1.618, WB=3.006, fo=1.04, clear=0.16, nose_zb=0.36, tail_zb=0.46,
             top=[(2.543, 0.80), (2.45, 0.90), (2.15, 0.98), (1.503, 1.05), (1.0, 1.10), (0.75, 1.13), (0.3, 1.42), (-0.1, 1.60),
                  (-0.6, 1.618), (-1.2, 1.59), (-1.7, 1.50), (-2.1, 1.36), (-2.35, 1.24), (-2.5, 1.20), (-2.594, 1.12)],
             belt=[(2.543, 0.80), (2.15, 1.0), (1.5, 1.07), (0.75, 1.12), (-0.5, 1.15), (-1.5, 1.18), (-2.2, 1.18), (-2.594, 1.08)],
             plan=[(2.543, 0.62), (2.45, 0.84), (2.15, 0.96), (1.503, 1.0), (0.6, 0.98), (-0.6, 0.98), (-1.503, 1.013),
                   (-2.15, 0.98), (-2.45, 0.90), (-2.594, 0.80)],
             roof=[(0.75, 0.74), (0.0, 0.68), (-0.8, 0.65), (-1.6, 0.58), (-2.1, 0.50)],
             cab=(0.75, -0.10, -1.60, -2.15), bulge=0.04, hip=0.04, side=(0.68, -2.0), pillars=(-0.45, -1.55), pillar_w=0.07,
             doors=(0.68, -0.45, -1.55), mirror_x=0.60, rw_w=0.85, mirror_size=(0.17, 0.22, 0.12))
def urusp(k):
    S = build(k, PURUS, dict(r=0.406, w=0.285, rim=0.292), dict(r=0.406, w=0.325, rim=0.292), crease=SHARP)
    k.decal('roof', 'Carbon', 'top', -1.40, 0.10, -0.60, 0.60, 16, 12, off=.003)
    both(lambda s: k.decal('hoodvent', 'Carbon', 'top', 1.40, 1.85, s * 0.20, s * 0.40, 6, 4, off=.006))
    for s in (1, -1): k.decal('sill', 'Gloss', side(s), -1.30, 1.10, 0.22, 0.34, 30, 3, off=.005)
    k.arch_trim(0.05, mat='Gloss')
    y_lights(k, (2.38, 0.72, 0.95), (0.72, 0.30, 0.50), size=0.16)
    k.project('grille', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.50, 0.60, v), lerp(0.40, 0.74, v)), 16, 6, off=.006)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.64, s * 0.90, 0.36, 0.70, 10, 8))
    k.decal('lip', 'Carbon', 'front', -0.88, 0.88, 0.32, 0.40, 30, 2)
    k.light_bar(-2.1, 1.06, 1.09, 0.84, bg=0.03, frac=0.5)
    y_tails(k, -2.1, 1.02, 1.13, 0.60, 0.84)
    k.fan('rearpanel', 'Gloss', -2.1, 0.56, 0.70, -0.62, 0.62, 30, 3)
    k.fan('diffuser', 'Carbon', -2.1, 0.44, 0.56, -0.66, 0.66, 30, 3)
    for y in (0.48, 0.62): k.exhaust(y, 0.50, r=0.05)
    k.wing(-1.62, 1.58, 0.18, 1.10, aoa=-4, thick=0.08, mat='Carbon', camber=-0.02, name='roofspoiler')
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.27, 0.09, 0.10))

# ======================================================================= Ferrari mid-engine (SF90 / LaFerrari / 296 GTB / F8)
# front axle x=1.36, rear axle x=-1.30, 4.6 m long, 1.98 m wide, 1.19 m tall
TFER = [
    ( 2.31, .26, .64, .38, .62, .44, .50, .46, .30, .46, .455),
    ( 2.22, .15, .86, .42, .84, .52, .70, .58, .42, .54, .53),
    ( 2.00, .13, .95, .48, .93, .62, .78, .69, .48, .60, .59),
    ( 1.70, .12, .98, .54, .965, .71, .80, .77, .50, .67, .655),
    ( 1.36, .12, .99, .58, .975, .78, .80, .83, .50, .74, .725),
    ( 1.00, .11, .97, .60, .955, .82, .78, .85, .50, .80, .79),
    ( 0.70, .11, .94, .58, .925, .84, .76, .88, .56, .92, .94),
    ( 0.30, .11, .925, .57, .91, .85, .72, 1.02, .60, 1.14, 1.16),
    (-0.15, .11, .93, .58, .915, .86, .70, 1.05, .60, 1.17, 1.19),
    (-0.60, .11, .96, .61, .945, .89, .70, 1.02, .57, 1.11, 1.13),
    (-0.95, .12, .985, .64, .97, .92, .70, .99, .50, 1.03, 1.04),
    (-1.30, .15, .99, .66, .975, .95, .68, .98, .46, .99, 1.0),
    (-1.70, .19, .985, .67, .97, .96, .66, .975, .44, .975, .98),
    (-2.05, .24, .95, .66, .93, .95, .60, .965, .40, .965, .965),
    (-2.24, .29, .86, .64, .84, .93, .54, .945, .34, .945, .945),
    (-2.33, .36, .68, .61, .66, .88, .44, .895, .26, .89, .89),
]
WFER = dict(F=dict(x=1.36, r=0.34, w=0.245, y=0.835, rim=0.254), R=dict(x=-1.30, r=0.35, w=0.315, y=0.835, rim=0.254))

# Every Ferrari below is built by carshape.build from its real length, width, height and wheelbase and outline points
# read off photos (see carshape.py); the axles sit at +-wheelbase/2.

# ---- SF90 Stradale: 4.71 x 1.97 x 1.19 m, 2.65 m wheelbase. Slim lights, a wide mesh mouth, the teardrop cabin
# over a glass engine cover, the "shut-off gurney" tail with two square lamps a side and high twin pipes.
PSF90 = dict(L=4.71, W=1.972, H=1.186, WB=2.65, fo=1.05, clear=0.11, nose_zb=0.24, tail_zb=0.40,
             top=[(2.375, 0.49), (2.27, 0.57), (2.0, 0.64), (1.6, 0.72), (1.25, 0.79), (0.95, 0.85), (0.5, 1.03), (0.12, 1.16),
                  (-0.2, 1.186), (-0.6, 1.15), (-0.9, 1.07), (-1.3, 1.02), (-1.9, 1.0), (-2.2, 1.02), (-2.335, 0.95)],
             belt=[(2.375, 0.47), (2.1, 0.63), (1.6, 0.76), (1.0, 0.84), (0.4, 0.86), (-0.4, 0.88), (-1.0, 0.96), (-1.6, 0.99),
                   (-2.2, 0.97), (-2.335, 0.88)],
             plan=[(2.375, 0.44), (2.27, 0.70), (2.0, 0.87), (1.33, 0.975), (0.6, 0.95), (0.0, 0.95), (-0.7, 0.975), (-1.33, 0.986),
                   (-2.0, 0.95), (-2.25, 0.86), (-2.335, 0.76)],
             roof=[(0.95, 0.66), (0.4, 0.60), (-0.2, 0.55), (-0.6, 0.50), (-0.9, 0.44)],
             cab=(0.95, 0.12, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.06), (2.0, 0.05)], hip=0.04, side=(0.86, -0.85),
             doors=(0.82, -0.35), mirror_x=0.78, rw_w=0.9, rw_bulge=0.0)
def ferrari_sides(k, x0=-0.45, x1=-1.0, z0=0.50, z1=0.82):
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, x0, x1, z0, z1, lean=0.18, nu=8, nv=6, off=.006)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
def sf90(k):
    build(k, PSF90, dict(r=0.343, w=0.255, rim=0.254), dict(r=0.349, w=0.315, rim=0.254), crease=SOFT)
    ferrari_sides(k)
    k.headlight_quad((2.10, 0.68, 0.62), (0.66, 0.36, 0.52), 0.30, 0.06, slant=0.06, taper=0.4, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.52, 0.52, 0.18, 0.36, 18, 5)
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.12, 0.17, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.55, 1.80, s * 0.12, s * 0.30, 6, 4))
    for s in (1, -1):
        for y in (0.56, 0.74): k.rect('tailsq', 'Taillight', V(-2.25, s * y, 0.88), V(-1, s * 0.25 * y, 0.1), 0.11, 0.06, .006, 6, 3)
    k.decal('shutoff', 'Gloss', 'top', -2.28, -2.12, -0.60, 0.60, 4, 10)       # the shut-off gurney slot
    k.fan('rearmesh', 'Gloss', -1.7, 0.42, 0.74, -0.70, 0.70, 30, 5)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.42, -0.66, 0.66, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.13, 0.80, r=0.045, mirror=False)        # high-exit pipes
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- LaFerrari: 4.70 x 1.99 x 1.12 m, 2.65 m wheelbase. Very low, a drooping central nose between tall front
# fenders, a small teardrop canopy, big rear haunches, a deployable spoiler and three pipes in the middle.
PLAF = dict(L=4.702, W=1.992, H=1.116, WB=2.65, fo=1.03, clear=0.10, nose_zb=0.22, tail_zb=0.40,
            top=[(2.355, 0.42), (2.25, 0.50), (2.0, 0.56), (1.6, 0.62), (1.2, 0.70), (0.95, 0.76), (0.5, 0.95), (0.1, 1.09),
                 (-0.2, 1.116), (-0.6, 1.08), (-0.95, 1.0), (-1.5, 0.97), (-2.0, 0.96), (-2.25, 0.97), (-2.347, 0.90)],
            belt=[(2.355, 0.44), (2.1, 0.64), (1.6, 0.78), (1.2, 0.82), (0.6, 0.80), (-0.2, 0.82), (-0.9, 0.93), (-1.5, 0.98),
                  (-2.1, 0.97), (-2.347, 0.88)],
            plan=[(2.355, 0.40), (2.25, 0.70), (2.0, 0.88), (1.33, 0.99), (0.6, 0.94), (0.0, 0.93), (-0.7, 0.985), (-1.33, 0.996),
                  (-2.0, 0.95), (-2.25, 0.84), (-2.347, 0.72)],
            roof=[(0.95, 0.62), (0.4, 0.55), (-0.2, 0.50), (-0.6, 0.44), (-0.95, 0.36)],
            cab=(0.95, 0.10, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.10), (1.9, 0.10), (2.3, 0.04)], hip=0.06, side=(0.86, -0.85),
            doors=(0.82, -0.40), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0)
def laferrari(k):
    build(k, PLAF, dict(r=0.321, w=0.265, rim=0.241), dict(r=0.358, w=0.345, rim=0.254), crease=SOFT)
    ferrari_sides(k, -0.35, -1.0, 0.40, 0.78)
    k.headlight_quad((2.02, 0.70, 0.62), (0.55, 0.40, 0.62), 0.30, 0.05, slant=0.07, taper=0.5, dots='row')
    k.decal('nosevalley', 'Gloss', 'top', 1.30, 2.0, -0.12, 0.12, 8, 3)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.24, s * 0.70, 0.16, 0.38, 10, 5))
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.11, 0.16, 30, 2)
    for s in (1, -1):
        for y in (0.56, 0.76): k.oval('tailround', 'Taillight', V(-2.20, s * y, 0.86), V(-1, s * 0.3 * y, 0.1), 0.07, 0.05, .006, n=6)
    k.fan('rearmesh', 'Gloss', -1.7, 0.38, 0.74, -0.66, 0.66, 30, 5)
    k.fan('diffuser', 'Carbon', -1.7, 0.22, 0.38, -0.66, 0.66, 30, 3)
    k.exhaust(0.0, 0.62, r=0.05, mirror=False); k.exhaust(0.12, 0.62, r=0.05)   # three centre pipes
    k.spoiler(-2.10, 1.03, 0.24, 1.30, aoa=-6, mat='Paint', strut_y=0.35)
    k.join(); k.wheels(spokes=10, nut='bolts')

# ---- 296 GTB: 4.57 x 1.96 x 1.19 m, 2.60 m wheelbase - the most compact Ferrari. Visor windscreen, teardrop lights,
# a small upright rear screen between flying buttresses, a sharp Kammback tail with the spoiler in the bumper and
# a single centre pipe up high.
P296 = dict(L=4.565, W=1.958, H=1.187, WB=2.60, fo=1.04, clear=0.11, nose_zb=0.24, tail_zb=0.40,
            top=[(2.34, 0.50), (2.25, 0.58), (2.0, 0.645), (1.6, 0.72), (1.3, 0.78), (0.95, 0.84), (0.5, 1.03), (0.12, 1.165),
                 (-0.2, 1.187), (-0.55, 1.16), (-0.72, 1.08), (-1.0, 1.02), (-1.6, 1.0), (-2.1, 1.0), (-2.225, 0.96)],
            belt=[(2.34, 0.48), (2.1, 0.64), (1.6, 0.77), (1.0, 0.845), (0.4, 0.86), (-0.3, 0.88), (-0.9, 0.96), (-1.6, 0.99),
                  (-2.1, 0.98), (-2.225, 0.92)],
            plan=[(2.34, 0.44), (2.25, 0.70), (2.0, 0.87), (1.3, 0.97), (0.6, 0.945), (0.0, 0.94), (-0.7, 0.97), (-1.3, 0.979),
                  (-1.9, 0.95), (-2.15, 0.88), (-2.225, 0.80)],
            roof=[(0.95, 0.66), (0.4, 0.60), (-0.2, 0.56), (-0.55, 0.52), (-0.75, 0.48)],
            cab=(0.95, 0.12, -0.55, -0.75), bulge=[(0.0, 0.02), (1.0, 0.06), (2.0, 0.05)], hip=0.04, side=(0.86, -0.62),
            doors=(0.82, -0.35), mirror_x=0.78, rw_w=0.75, rw_bulge=0.0)
def gtb296(k):
    build(k, P296, dict(r=0.34, w=0.245, rim=0.254), dict(r=0.361, w=0.305, rim=0.254), crease=SOFT)
    ferrari_sides(k, -0.40, -0.95, 0.52, 0.82)
    for s in (1, -1):
        k.oval('teardrop', 'Gloss', V(2.06, s * 0.68, 0.62), V(0.66, s * 0.36, 0.52), 0.16, 0.07, .004, n=10)
        k.rect('drl', 'Headlight', V(2.06, s * 0.68, 0.64), V(0.66, s * 0.36, 0.52), 0.20, 0.014, .009, 6, 1, slant=s * 0.03)
        k.decal('buttress', 'Gloss', side(s), -0.55, -0.80, 0.98, 1.06, 6, 3, off=.004)
        k.fan('tail', 'Taillight', -1.7, 0.88, 0.91, s * 0.50, s * 0.86, 10, 2, off=.007)
    k.decal('grille', 'Gloss', 'front', -0.50, 0.50, 0.18, 0.34, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.12, 0.17, 30, 2)
    both(lambda s: k.decal('bonnetvent', 'Gloss', 'top', 1.60, 1.88, s * 0.10, s * 0.26, 6, 4))
    k.fan('rearband', 'Gloss', -1.7, 0.66, 0.80, -0.70, 0.70, 30, 3)          # the active spoiler slot in the bumper
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.46, -0.66, 0.66, 30, 3)
    k.exhaust(0.0, 0.86, r=0.06, mirror=False)                                  # single centre high pipe
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- F8 Tributo: 4.61 x 1.98 x 1.21 m, 2.65 m wheelbase. The S-duct through the nose, slim swept lights, scooped
# intakes in the rear fenders, a louvred Lexan engine cover, two round tail lights a side and outboard pipes.
PF8 = dict(L=4.611, W=1.979, H=1.206, WB=2.65, fo=1.03, clear=0.11, nose_zb=0.24, tail_zb=0.40,
           top=[(2.355, 0.50), (2.25, 0.58), (2.0, 0.645), (1.6, 0.72), (1.25, 0.79), (0.95, 0.845), (0.5, 1.03), (0.12, 1.18),
                (-0.2, 1.206), (-0.6, 1.17), (-0.92, 1.08), (-1.4, 1.03), (-1.9, 1.01), (-2.15, 1.02), (-2.256, 0.95)],
           belt=[(2.355, 0.48), (2.1, 0.64), (1.6, 0.765), (1.0, 0.84), (0.4, 0.86), (-0.4, 0.88), (-1.0, 0.96), (-1.6, 0.99),
                 (-2.15, 0.97), (-2.256, 0.89)],
           plan=[(2.355, 0.44), (2.25, 0.70), (2.0, 0.87), (1.33, 0.98), (0.6, 0.95), (0.0, 0.945), (-0.7, 0.98), (-1.33, 0.99),
                 (-1.95, 0.95), (-2.2, 0.86), (-2.256, 0.77)],
           roof=[(0.95, 0.66), (0.4, 0.60), (-0.2, 0.55), (-0.6, 0.50), (-0.92, 0.44)],
           cab=(0.95, 0.12, -0.62, -0.92), bulge=[(0.0, 0.02), (1.0, 0.06), (2.0, 0.05)], hip=0.04, side=(0.86, -0.85),
           doors=(0.82, -0.35), mirror_x=0.78, rw_w=0.9, rw_bulge=0.0)
def f8(k):
    build(k, PF8, dict(r=0.34, w=0.245, rim=0.254), dict(r=0.346, w=0.305, rim=0.254), crease=SOFT)
    ferrari_sides(k, -0.40, -1.0, 0.50, 0.84)
    k.headlight_quad((2.08, 0.68, 0.62), (0.66, 0.36, 0.52), 0.30, 0.06, slant=0.06, taper=0.45, dots='row')
    k.naca(1.45, 2.10, 0.0, 0.14, 0.40)                                         # the S-duct
    k.decal('grille', 'Gloss', 'front', -0.50, 0.50, 0.18, 0.34, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.12, 0.17, 30, 2)
    for i in range(3): k.decal('louvre', 'Gloss', 'top', -1.55 + i * .2, -1.47 + i * .2, -0.42, 0.42, 2, 10, off=.006)
    for s in (1, -1):
        for y in (0.56, 0.74): k.oval('tailround', 'Taillight', V(-2.15, s * y, 0.86), V(-1, s * 0.25 * y, 0.1), 0.06, 0.06, .006, n=6)
        k.exhaust(s * 0.55, 0.50, r=0.05, mirror=False)
    k.fan('rearmesh', 'Gloss', -1.7, 0.44, 0.74, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.44, -0.66, 0.66, 30, 3)
    k.join(); k.wheels(spokes=10, nut='bolts')

# ======================================================================= Ferrari front-engine V12 (812 Competizione / 12Cilindri)
# front axle x=1.62, rear axle x=-1.10, 4.7 m long, 1.97 m wide, 1.28 m tall
TFGT = [
    ( 2.36, .26, .66, .40, .64, .46, .52, .48, .30, .49, .485),
    ( 2.28, .15, .86, .44, .84, .54, .70, .60, .44, .57, .56),
    ( 2.05, .13, .955, .50, .935, .65, .78, .72, .50, .64, .63),
    ( 1.62, .12, .985, .58, .97, .76, .80, .83, .50, .75, .74),
    ( 1.20, .12, .975, .60, .96, .82, .79, .86, .50, .81, .80),
    ( 0.70, .12, .96, .60, .945, .855, .77, .88, .50, .86, .85),
    ( 0.30, .12, .95, .60, .935, .87, .76, .92, .56, .97, 1.0),
    (-0.05, .12, .945, .59, .93, .88, .73, 1.06, .60, 1.22, 1.25),
    (-0.50, .12, .95, .60, .935, .89, .72, 1.08, .61, 1.25, 1.28),
    (-1.00, .13, .975, .63, .96, .92, .71, 1.04, .58, 1.16, 1.18),
    (-1.40, .16, .985, .65, .97, .94, .68, 1.0, .52, 1.06, 1.07),
    (-1.85, .20, .975, .66, .96, .95, .64, .98, .46, .985, .99),
    (-2.20, .25, .93, .65, .91, .94, .58, .965, .40, .96, .96),
    (-2.38, .33, .72, .62, .70, .89, .46, .91, .28, .905, .905),
]
WFGT = dict(F=dict(x=1.62, r=0.345, w=0.275, y=0.82, rim=0.254), R=dict(x=-1.10, r=0.355, w=0.315, y=0.83, rim=0.254))
# ---- 812 Competizione: 4.70 x 1.97 x 1.28 m, 2.72 m wheelbase. A long bonnet over the front-mid V12 with a carbon
# blade across it, the cabin set well back, an aluminium rear "window" cut by sabre-like slots, a ducktail, twin
# lamps a side and four pipes.
P812 = dict(L=4.696, W=1.971, H=1.276, WB=2.72, fo=0.97, clear=0.12, nose_zb=0.26, tail_zb=0.40,
            top=[(2.33, 0.58), (2.24, 0.66), (1.9, 0.74), (1.36, 0.81), (0.8, 0.87), (0.30, 0.92), (-0.05, 1.10), (-0.40, 1.25),
                 (-0.70, 1.276), (-1.05, 1.24), (-1.4, 1.13), (-1.75, 1.02), (-2.15, 0.99), (-2.30, 1.0), (-2.366, 0.93)],
            belt=[(2.33, 0.56), (2.0, 0.76), (1.36, 0.85), (0.3, 0.90), (-0.6, 0.93), (-1.36, 0.98), (-2.0, 0.98), (-2.366, 0.90)],
            plan=[(2.33, 0.58), (2.24, 0.80), (1.9, 0.93), (1.36, 0.975), (0.5, 0.95), (-0.5, 0.95), (-1.36, 0.986), (-2.0, 0.95),
                  (-2.30, 0.85), (-2.366, 0.75)],
            roof=[(0.30, 0.68), (-0.4, 0.60), (-1.0, 0.56), (-1.5, 0.48), (-1.75, 0.44)],
            cab=(0.30, -0.40, -1.05, -1.75), bulge=0.05, hip=0.04, side=(0.22, -1.30), doors=(0.24,), mirror_x=0.18, rw_w=0.85)
def c812(k):
    build(k, P812, dict(r=0.35, w=0.275, rim=0.254), dict(r=0.364, w=0.315, rim=0.254), crease=SOFT)
    for i in range(6):   # the slotted aluminium rear "window"
        k.decal('blade', 'Gloss', 'top', -1.70 + i * .11, -1.66 + i * .11, -0.40, 0.40, 2, 10, off=.006)
    k.decal('bonnetblade', 'Carbon', 'top', 0.95, 1.15, -0.62, 0.62, 4, 12, off=.006)
    for s in (1, -1):
        k.slanted('fendervent', 'Gloss', s, 1.05, 0.88, 0.48, 0.74, lean=0.06, nu=4, nv=6)
        k.decal('skirt', 'Carbon', side(s), -1.0, 1.0, 0.12, 0.20, 30, 2)
        for y in (0.56, 0.74): k.oval('tailround', 'Taillight', V(-2.30, s * y, 0.88), V(-1, s * 0.25 * y, 0.1), 0.065, 0.055, .006, n=6)
    k.headlight_quad((2.10, 0.70, 0.66), (0.70, 0.34, 0.52), 0.32, 0.07, slant=0.05, taper=0.4, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.64, 0.64, 0.20, 0.40, 18, 5)
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.13, 0.18, 30, 2)
    k.fan('rearpanel', 'Gloss', -1.9, 0.42, 0.62, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.9, 0.26, 0.42, -0.66, 0.66, 30, 3)
    for y in (0.44, 0.58): k.exhaust(y, 0.44, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts')

# ---- 12Cilindri: 4.73 x 2.03 x 1.29 m, 2.70 m wheelbase. The black band across the nose holding the slim lights
# (a nod to the 365 GTB/4 Daytona), a long clamshell bonnet, a fastback with a black delta behind the rear glass,
# thin tail lights and twin pipes a side.
P12C = dict(L=4.733, W=2.03, H=1.292, WB=2.70, fo=0.99, clear=0.12, nose_zb=0.26, tail_zb=0.40,
            top=[(2.34, 0.60), (2.25, 0.68), (1.9, 0.76), (1.35, 0.82), (0.8, 0.875), (0.30, 0.93), (-0.05, 1.10), (-0.40, 1.26),
                 (-0.70, 1.292), (-1.05, 1.25), (-1.5, 1.10), (-1.85, 1.02), (-2.25, 1.0), (-2.393, 0.93)],
            belt=[(2.34, 0.58), (2.0, 0.77), (1.35, 0.86), (0.3, 0.91), (-0.6, 0.935), (-1.35, 0.97), (-2.0, 0.98), (-2.393, 0.90)],
            plan=[(2.34, 0.60), (2.25, 0.82), (1.9, 0.96), (1.35, 1.0), (0.5, 0.975), (-0.5, 0.975), (-1.35, 1.015), (-2.0, 0.98),
                  (-2.3, 0.88), (-2.393, 0.77)],
            roof=[(0.30, 0.70), (-0.4, 0.62), (-1.0, 0.58), (-1.5, 0.50), (-1.85, 0.44)],
            cab=(0.30, -0.40, -1.05, -1.85), bulge=0.04, hip=0.04, side=(0.22, -1.30), doors=(0.24,), mirror_x=0.18, rw_w=0.85)
def cil12(k):
    build(k, P12C, dict(r=0.363, w=0.275, rim=0.267), dict(r=0.377, w=0.315, rim=0.267), crease=SOFT)
    k.decal('delta', 'Gloss', 'top', -2.15, -1.85, -0.55, 0.55, 6, 12)          # black delta behind the rear glass
    k.fan('band', 'Gloss', 1.20, 0.60, 0.68, -0.66, 0.66, 40, 2, rear=False)    # the black band across the nose
    k.drl_strip((2.14, 0.72, 0.66), (0.75, 0.30, 0.40), 0.28, 0.03)
    k.decal('grille', 'Gloss', 'front', -0.46, 0.46, 0.22, 0.36, 18, 4)
    k.decal('splitter', 'Gloss', 'front', -0.88, 0.88, 0.13, 0.18, 30, 2)
    for s in (1, -1):
        k.decal('skirt', 'Gloss', side(s), -1.0, 1.0, 0.12, 0.20, 30, 2)
        k.fan('tail', 'Taillight', -1.9, 0.86, 0.885, s * 0.40, s * 0.86, 12, 2, off=.007)
    k.fan('rearpanel', 'Gloss', -1.9, 0.42, 0.62, -0.62, 0.62, 30, 4)
    for y in (0.48, 0.60): k.exhaust(y, 0.44, r=0.045)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- Purosangue: 4.97 x 2.03 x 1.59 m, 3.02 m wheelbase - Ferrari's four-door. A low bonnet, slim DRLs over lamps
# set low in the big intakes, a fastback roof, rear-hinged back doors, a black tail panel with a thin light and four
# pipes; 22-inch wheels at the front, 23 at the back.
PPURO = dict(L=4.973, W=2.028, H=1.589, WB=3.018, fo=0.97, clear=0.185, nose_zb=0.36, tail_zb=0.46,
             top=[(2.479, 0.78), (2.40, 0.86), (2.1, 0.93), (1.509, 1.0), (1.0, 1.05), (0.65, 1.09), (0.2, 1.38), (-0.15, 1.555),
                  (-0.6, 1.589), (-1.2, 1.565), (-1.55, 1.52), (-1.85, 1.40), (-2.1, 1.22), (-2.35, 1.18), (-2.494, 1.08)],
             belt=[(2.479, 0.78), (2.1, 0.95), (1.5, 1.02), (0.65, 1.08), (-0.5, 1.11), (-1.5, 1.15), (-2.1, 1.17), (-2.494, 1.05)],
             plan=[(2.479, 0.62), (2.40, 0.82), (2.1, 0.95), (1.509, 1.0), (0.6, 0.985), (-0.6, 0.985), (-1.509, 1.014),
                   (-2.1, 0.98), (-2.40, 0.90), (-2.494, 0.80)],
             roof=[(0.65, 0.74), (0.0, 0.68), (-0.8, 0.66), (-1.5, 0.62), (-2.1, 0.55)],
             cab=(0.65, -0.15, -1.55, -2.1), bulge=0.04, hip=0.04, side=(0.58, -1.95), pillars=(-0.40, -1.45), pillar_w=0.07,
             doors=(0.58, -0.40, -1.45), mirror_x=0.52, rw_w=0.85, mirror_size=(0.17, 0.22, 0.12))
def purosangue(k):
    build(k, PPURO, dict(r=0.368, w=0.255, rim=0.279), dict(r=0.387, w=0.315, rim=0.292), crease=SOFT)
    for s in (1, -1):
        k.decal('sill', 'Gloss', side(s), -1.30, 1.10, 0.24, 0.34, 30, 3, off=.005)
        k.fan('tail', 'Taillight', -2.0, 1.04, 1.07, s * 0.30, s * 0.86, 12, 2, off=.007)
    k.arch_trim(0.05, mat='Gloss')
    k.drl_strip((2.36, 0.72, 0.92), (0.78, 0.30, 0.30), 0.30, 0.03)
    k.headlight_quad((2.40, 0.66, 0.70), (0.85, 0.30, 0.10), 0.18, 0.07, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.52, 0.52, 0.42, 0.66, 18, 5)
    k.fan('rearpanel', 'Gloss', -2.0, 0.80, 1.02, -0.66, 0.66, 30, 4)
    k.fan('diffuser', 'Gloss', -2.0, 0.46, 0.62, -0.62, 0.62, 30, 3)
    for y in (0.50, 0.64): k.exhaust(y, 0.52, r=0.045)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.26, 0.085, 0.10))

# ======================================================================= registry
# id: (builder, preview paint, rim, caliper) - the game recolours paint/rims/calipers itself
CARS = {
    'revuelto': (revuelto, '#6fc12a', '#1b1b1d', '#e3c11b'),
    'svj': (svj, '#f0700f', '#1b1b1d', '#1f8a5a'),
    'temerario': (temerario, '#4a1d6c', '#2a2b2e', '#e3c11b'),
    'sto': (sto, '#f0700f', '#1b1b1d', '#1b1b1d'),
    'sterrato': (sterrato, '#6fc12a', '#1b1b1d', '#1b1b1d'),
    'urusp': (urusp, '#f2c20f', '#1b1b1d', '#e3c11b'),
    'sf90': (sf90, '#c1111b', '#1b1b1d', '#e3c11b'),
    'laferrari': (laferrari, '#c1111b', '#1b1b1d', '#e3c11b'),
    '812c': (c812, '#c1111b', '#2a2b2e', '#e3c11b'),
    '12cil': (cil12, '#1d3a70', '#9da1a6', '#c8141b'),
    '296gtb': (gtb296, '#f6d10f', '#1b1b1d', '#1b1b1d'),
    'f8': (f8, '#c1111b', '#2a2b2e', '#e3c11b'),
    'purosangue': (purosangue, '#1d3a70', '#1b1b1d', '#e3c11b'),
}

if __name__ == '__main__':
    main(CARS, 'supercars.py')
