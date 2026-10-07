# BMW M, Audi Sport and the Devel Sixteen for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/bmw_audi.py -- --car all
#
# Bodies remap existing station tables: the front-engine GT for the M2 and M4 CSL, the Taycan sedan for the M5 and
# the RS e-tron GT, the Cayenne for the RS 6 Avant, the XM and the RS Q8, the mid-engine table for the R8 and the
# Devel Sixteen. The faces carry the brands: BMW's twin kidneys, Audi's big hexagonal Singleframe with four rings,
# and the Devel's long fighter-jet canopy, fins and a huge V16 exhaust.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap, SOFT, SHARP
from porsches import TTAY, TCAY, TCAY_SUV
from teslas import glass, TAY_WS, TAY_RW, TAY_TOP, TAY_BOT
from toyota import gt_coupe, hatch, CAY_TOP, CAY_BOT, CAY_RW, SUV_TOP, SUV_BOT, SUV_RW
from hypercars import glasshouse

# ----------------------------------------------------------------------------------------------- faces
def kidneys(k, gap, w, z0, z1, slats=6, frame='Chrome'):
    """BMW's twin kidney grille: two tall rounded panels with a chrome frame and vertical slats"""
    for s in (1, -1):
        a, b = s * gap, s * (gap + w)
        k.project('kidneyF', frame, lambda u, v: k.VIEW['front'](lerp(a, b, u), lerp(z0 - .015, z1 + .015, v)), 6, 6, off=.007)
        k.project('kidney', 'Gloss', lambda u, v: k.VIEW['front'](lerp(a + s * .012, b - s * .012, u), lerp(z0, z1, v)), 6, 6, off=.010)
        for i in range(1, slats):
            y = lerp(a, b, i / slats)
            k.decal('slat', frame, 'front', y - .004, y + .004, z0 + .01, z1 - .01, 1, 6, off=.013)

def bmw_face(k, light, kid, intake=(0.62, 0.18, 0.34)):
    k.headlight_quad(light[0], light[1], light[2], light[3], slant=0.04, taper=0.25, dots='row')
    kidneys(k, *kid)
    hw, z0, z1 = intake
    both(lambda s: k.decal('sideintake', 'Gloss', 'front', s * (hw - .24), s * hw, z0, z1, 6, 4))
    k.decal('lowgrille', 'Gloss', 'front', -0.30, 0.30, z0, z0 + (z1 - z0) * .55, 12, 3)

def singleframe(k, hw_top, hw_bot, z0, z1, rings_z=None, mesh=True):
    """Audi's Singleframe: a big hexagon-ish black grille (wider at the bottom), honeycomb bars and four rings"""
    def fn(u, v):
        hw = lerp(hw_bot, hw_top, v) * (1 - .18 * max(0, abs(v - .5) * 2 - .6) / .4)
        return k.VIEW['front'](lerp(-1, 1, u) * hw, lerp(z0, z1, v))
    k.project('singleframe', 'Gloss', fn, 16, 8, off=.006)
    if mesh:
        for i in range(1, 5):
            z = lerp(z0, z1, i / 5)
            k.decal('mesh', 'Black', 'front', -lerp(hw_bot, hw_top, i / 5) * .9, lerp(hw_bot, hw_top, i / 5) * .9, z - .004, z + .004, 14, 1, off=.009)
    rz = rings_z if rings_z is not None else z1 - (z1 - z0) * .12
    for i in range(4):
        k.oval('ring', 'Chrome', V(3.0, (i - 1.5) * .068, rz), V(1, 0, 0), .04, .04, .012, n=12, ring=.72)

def audi_face(k, light, frame, intake=None):
    k.headlight_quad(light[0], light[1], light[2], light[3], slant=0.05, taper=0.3, dots='row')
    k.drl_strip((light[0][0] + .02, light[0][1], light[0][2] - .07), light[1], light[2] * .9, 0.02, slant=0.05)
    singleframe(k, *frame)
    if intake: both(lambda s: k.decal('intake', 'Gloss', 'front', s * intake[0], s * intake[1], intake[2], intake[3], 6, 4))

def quad_pipes(k, y, z, r=0.045, oval=False):
    for s in (1, -1):
        for d in (0, 0.13):
            if oval: k.exhaust(s * (y + d * .9), z, shape='rect', w=0.13, h=0.07, mirror=False)
            else: k.exhaust(s * (y + d), z, r=r, mirror=False)

# ----------------------------------------------------------------------------------------------- BMW
# M2 (G87): short, wide, boxy arches, horizontal-frame kidneys
def m2(k):
    X = gt_coupe(k, [(-2.38, -2.29), (-1.10, -1.37), (1.62, 1.37), (2.36, 2.29)], 0.98, lambda z: z * 1.02 + max(0.0, z - 0.90) * 0.10,
                 dict(F=dict(x=1.37, r=0.335, w=0.255, y=0.83, rim=0.241), R=dict(x=-1.37, r=0.345, w=0.285, y=0.835, rim=0.254)), duck_lift=0.04)
    bmw_face(k, ((2.10, 0.66, 0.66), (0.72, 0.30, 0.55), 0.26, 0.07), (0.03, 0.30, 0.27, 0.48, 7), (0.80, 0.16, 0.26))
    k.tail_clusters(X(-1.80), 0.82, 0.90, 0.45, 0.82)
    k.fan('diffuser', 'Gloss', X(-1.80), 0.26, 0.42, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.42, 0.34)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.024, 0.016))

# M4 CSL: long bonnet, tall kidneys, carbon roof and bonnet, ducktail, red-ringed laser lights
def m4csl(k):
    X = gt_coupe(k, [(-2.38, -2.40), (-1.10, -1.43), (1.62, 1.43), (2.36, 2.40)], 0.97, lambda z: z * 1.0 + max(0.0, z - 0.90) * 0.06,
                 dict(F=dict(x=1.43, r=0.34, w=0.27, y=0.83, rim=0.254), R=dict(x=-1.43, r=0.35, w=0.295, y=0.835, rim=0.254)), duck_lift=0.07, crease=SHARP)
    bmw_face(k, ((2.18, 0.66, 0.66), (0.72, 0.30, 0.55), 0.26, 0.07), (0.03, 0.25, 0.22, 0.53, 7), (0.80, 0.16, 0.24))
    k.decal('roof', 'Carbon', 'top', X(-0.95), X(-0.20), -0.45, 0.45, 12, 10, off=.003)
    k.decal('bonnet', 'Carbon', 'top', 1.30, 1.95, -0.45, 0.45, 12, 10, off=.003)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.14, 0.18, 30, 2)
    k.tail_clusters(X(-1.85), 0.82, 0.90, 0.45, 0.82)
    k.fan('diffuser', 'Carbon', X(-1.85), 0.26, 0.42, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.40, 0.34)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

def bmw_sedan(k, xs, ys, zf, wheels, kid, light, tail_z):
    X = lambda x: pl(xs, x)
    k.loft(stations(remap(TTAY, xs, ys, zf)), **SOFT); k.arches(wheels); k.surface()
    glass(k, X, zf, TAY_WS, TAY_RW, TAY_TOP, TAY_BOT, pillars=[-0.07, -1.08])
    for s in (1, -1):
        for xg in (0.80, -0.08, -1.12): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, 0.25, zf(0.92), 1, 12, off=.002)
        for xh in (0.15, -0.85): k.decal('handle', 'Chrome', side(s), X(xh) - .14, X(xh), zf(0.86), zf(0.86) + .018, 4, 1, off=.003)
        k.decal('skirt', 'Gloss', side(s), X(-1.0), X(1.05), 0.16, 0.24, 30, 2)
    k.mirrors(X(0.74), 1.0 * ys + .04, zf(1.0), size=(0.13, 0.18, 0.09))
    k.interior(X(-0.40), 1.38 * ys, zf(0.74), l=2.2, h=0.38, seats_x=X(-0.20), seat_z=zf(0.84))
    return X

# M5 (G90): long four-door super saloon, wide kidneys, quad pipes, small boot lip
def m5(k):
    xs = [(-2.50, -2.53), (-1.40, -1.50), (1.50, 1.52), (2.48, 2.53)]
    zf = lambda z: z + max(0.0, z - 0.90) * 0.10
    X = bmw_sedan(k, xs, 1.0, zf, dict(F=dict(x=1.52, r=0.36, w=0.275, y=0.84, rim=0.267), R=dict(x=-1.50, r=0.365, w=0.305, y=0.845, rim=0.267)),
                  None, None, None)
    bmw_face(k, ((2.26, 0.66, 0.66), (0.72, 0.30, 0.52), 0.30, 0.07), (0.03, 0.32, 0.33, 0.58, 8), (0.84, 0.18, 0.30))
    k.tail_clusters(X(-1.90), 0.86, 0.95, 0.45, 0.86)
    k.fan('diffuser', 'Gloss', X(-1.90), 0.30, 0.44, -0.62, 0.62, 30, 3)
    k.spoiler(X(-2.40), 1.00, 0.10, 1.20, aoa=-4, thick=0.05, mat='Gloss', strut_y=0.35)
    quad_pipes(k, 0.46, 0.36)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# XM: big, square-jawed performance SUV with huge chrome-framed kidneys and split lights
def xm(k):
    zf = lambda z: z * 1.03 + 0.04
    X = hatch(k, TCAY_SUV, [(-2.48, -2.55), (-1.40, -1.50), (1.50, 1.60), (2.46, 2.55)], 1.01, zf,
              dict(F=dict(x=1.60, r=0.40, w=0.29, y=0.86, rim=0.292, gap=0.07), R=dict(x=-1.50, r=0.40, w=0.31, y=0.865, rim=0.292, gap=0.07)),
              SUV_TOP, SUV_BOT, SUV_RW, [-0.15, -1.25], crease=SHARP)
    bmw_face(k, ((2.34, 0.70, zf(0.92)), (0.80, 0.25, 0.30), 0.30, 0.05), (0.03, 0.40, zf(0.42), zf(0.86), 8), (0.86, zf(0.24), zf(0.40)))
    k.headlight_quad((2.40, 0.72, zf(0.68)), (0.80, 0.25, 0.30), 0.22, 0.07, slant=0.02, dots='row')   # the lower half of the split lights
    both(lambda s: k.decal('cladding', 'Gloss', side(s), X(-1.00), X(1.05), zf(0.22), zf(0.34), 30, 3, off=.006))
    k.tail_clusters(X(-1.95), zf(0.98), zf(1.10), 0.60, 0.86)
    k.fan('rearbumper', 'Gloss', X(-1.95), zf(0.30), zf(0.46), -0.66, 0.66, 30, 3)
    quad_pipes(k, 0.46, zf(0.36), oval=True)
    k.join(); k.wheels(spokes=6, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# ----------------------------------------------------------------------------------------------- Audi
# R8 V10 GT: mid-engine, the big carbon "sideblade" behind the doors, fixed wing
RX = [(-2.33, -2.24), (-1.30, -1.32), (1.36, 1.33), (2.31, 2.19)]
def r8(k):
    X = lambda x: pl(RX, x); Z = lambda z: z + max(0.0, z - 0.90) * 0.06
    k.loft(stations(remap(TFER, RX, 1.0, Z)), **SHARP); k.arches(dict(F=dict(x=1.33, r=0.335, w=0.255, y=0.83, rim=0.254), R=dict(x=-1.32, r=0.35, w=0.31, y=0.835, rim=0.254))); k.surface()
    glasshouse(k, X, Z)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), X(0.70) - .004, X(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
        k.slanted('sideblade', 'Carbon', s, X(-0.45), X(-1.05), 0.30, 0.90, lean=0.10, nu=8, nv=10, off=.006)
        k.slanted('sideintake', 'Gloss', s, X(-0.62), X(-0.95), 0.58, 0.82, lean=0.08, nu=6, nv=6, off=.009)
        k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.13, 0.20, 30, 2)
    audi_face(k, ((2.00, 0.66, 0.60), (0.72, 0.32, 0.52), 0.30, 0.08), (0.42, 0.50, 0.18, 0.46, 0.43), (0.62, 0.84, 0.18, 0.34))
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.14, 0.18, 30, 2)
    k.light_bar(X(-1.70), 0.82, 0.86, 0.80, bg=0.015, frac=0.6)
    k.fan('rearpanel', 'Gloss', X(-1.70), 0.44, 0.62, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', X(-1.70), 0.28, 0.44, -0.66, 0.66, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.58, 0.36, shape='rect', w=0.16, h=0.08, mirror=False)
    k.post_wing(-1.86, 1.20, 0.34, 1.76, -1.98, 0.44, aoa=-8,
                endplate=[(-1.80, 1.15), (-1.82, 1.28), (-2.22, 1.30), (-2.26, 1.18), (-2.10, 1.14)])
    k.mirrors(X(0.62), 1.07, 0.93, size=(0.14, 0.18, 0.08))
    k.interior(X(-0.20), 1.28, Z(0.64), h=0.32, seats_x=X(-0.42), seat_z=Z(0.74))
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# RS 6 Avant GT: a very fast estate car: long roof, flared arches, oval pipes
def rs6(k):
    zf = lambda z: z * 0.86
    X = hatch(k, TCAY_SUV, [(-2.48, -2.50), (-1.40, -1.45), (1.50, 1.48), (2.46, 2.50)], 0.995, zf,
              dict(F=dict(x=1.48, r=0.355, w=0.275, y=0.845, rim=0.267), R=dict(x=-1.45, r=0.36, w=0.295, y=0.85, rim=0.267)),
              SUV_TOP, SUV_BOT, SUV_RW, [-0.15, -1.25])
    audi_face(k, ((2.30, 0.66, zf(0.84)), (0.80, 0.28, 0.40), 0.30, 0.06), (0.46, 0.52, zf(0.26), zf(0.70), zf(0.64)), (0.66, 0.88, zf(0.24), zf(0.44)))
    k.wing(X(-1.93), zf(1.63), 0.18, 1.15, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.light_bar(X(-1.95), zf(1.02), zf(1.06), 0.86, bg=0.015, frac=1.0)
    k.fan('diffuser', 'Gloss', X(-1.95), 0.26, 0.42, -0.62, 0.62, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.60, 0.34, shape='rect', w=0.17, h=0.08, mirror=False)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# RS e-tron GT performance: the electric GT (Taycan cousin), closed Singleframe, full-width light bar
def rsetrongt(k):
    xs = [(-2.50, -2.495), (-1.40, -1.40), (1.50, 1.50), (2.48, 2.495)]
    zf = lambda z: z * 0.99
    X = bmw_sedan(k, xs, 1.0, zf, dict(F=dict(x=1.50, r=0.355, w=0.27, y=0.84, rim=0.267), R=dict(x=-1.40, r=0.36, w=0.305, y=0.845, rim=0.267)), None, None, None)
    k.decal('roof', 'Carbon', 'top', X(-1.05), X(0.25), -0.52, 0.52, 16, 12, off=.003)
    audi_face(k, ((2.22, 0.64, 0.68), (0.70, 0.30, 0.55), 0.30, 0.07), (0.40, 0.48, 0.20, 0.50, 0.46), (0.62, 0.86, 0.18, 0.36))
    k.light_bar(X(-1.90), 0.90, 0.93, 0.86, bg=0.02, frac=1.0)
    k.fan('diffuser', 'Carbon', X(-1.90), 0.30, 0.44, -0.66, 0.66, 30, 3)
    k.spoiler(X(-2.30), 1.02, 0.20, 1.30, aoa=-5, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

# RS Q8 performance: coupe-SUV, huge black Singleframe, wide arches
def rsq8(k):
    zf = lambda z: z * 1.0 + 0.02
    X = hatch(k, TCAY, [(-2.48, -2.50), (-1.40, -1.50), (1.50, 1.50), (2.46, 2.50)], 1.0, zf,
              dict(F=dict(x=1.50, r=0.39, w=0.29, y=0.85, rim=0.292, gap=0.07), R=dict(x=-1.50, r=0.39, w=0.31, y=0.855, rim=0.292, gap=0.07)),
              CAY_TOP, CAY_BOT, CAY_RW, [-0.60], crease=SHARP)
    audi_face(k, ((2.32, 0.70, zf(0.86)), (0.80, 0.25, 0.30), 0.30, 0.06), (0.52, 0.58, zf(0.30), zf(0.80), zf(0.72)), (0.72, 0.92, zf(0.26), zf(0.46)))
    both(lambda s: k.decal('cladding', 'Gloss', side(s), X(-1.00), X(1.05), zf(0.22), zf(0.34), 30, 3, off=.006))
    k.light_bar(X(-1.90), zf(1.00), zf(1.04), 0.86, bg=0.015, frac=1.0)
    k.fan('rearbumper', 'Gloss', X(-1.90), zf(0.30), zf(0.46), -0.66, 0.66, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.62, zf(0.36), shape='rect', w=0.18, h=0.08, mirror=False)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.028, 0.018))

# ----------------------------------------------------------------------------------------------- Devel Sixteen
# A 5.4 m jet-fighter of a car: low wide body, a long narrow bubble canopy far forward, two tall rear fins,
# big side intakes and an enormous round V16 exhaust in the middle of the tail
DX = [(-2.33, -2.70), (-1.30, -1.58), (1.36, 1.55), (2.31, 2.70)]
DZ = lambda z: z * 0.97 + max(0.0, z - 0.90) * 0.18
def devel16(k):
    X = lambda x: pl(DX, x)
    rows = remap(TFER, DX, 1.06, DZ)
    rows = [r[:8] + (r[8] * (0.62 if -0.95 < r[0] < 0.60 else 1.0),) + r[9:] for r in rows]   # a narrow canopy
    k.loft(stations(rows), crease_lines=0.55, crisp_front=-9, crisp=0.45, crease_front=0.7, crease_rear=0.85)
    k.arches(dict(F=dict(x=1.55, r=0.36, w=0.28, y=0.90, rim=0.267), R=dict(x=-1.58, r=0.38, w=0.36, y=0.905, rim=0.292))); k.surface()
    glasshouse(k, X, DZ, hw=0.70)
    k.decal('canopy', 'Glass', 'top', X(-0.70), X(0.55), -0.30, 0.30, 16, 8, off=.005)   # all-glass fighter canopy
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, X(-0.30), X(-1.05), 0.40, 0.88, lean=0.25, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), X(-1.00), X(1.05), 0.12, 0.20, 30, 2)
        k.decal('stripe', 'Gloss', side(s), X(0.40), X(1.30), 0.56, 0.60, 20, 1, off=.005)
        k.plate('fin', 'Carbon', [(X(-1.15), DZ(0.97)), (X(-1.75), DZ(1.16)), (X(-2.22), DZ(1.18)), (X(-2.30), DZ(0.95))], s * 0.62, t=0.015)
    k.headlight_quad((2.40, 0.74, 0.58), (0.72, 0.34, 0.52), 0.30, 0.06, slant=0.06, taper=0.4, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.62, 0.62, 0.18, 0.34, 20, 4)
    k.decal('splitter', 'Carbon', 'front', -1.0, 1.0, 0.12, 0.16, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.50, 2.00, s * 0.20, s * 0.44, 6, 4))
    k.light_bar(X(-1.85), 0.86, 0.89, 0.85, bg=0.015, frac=0.85)
    k.fan('rearpanel', 'Gloss', X(-1.85), 0.42, 0.80, -0.70, 0.70, 30, 5)
    k.fan('diffuser', 'Carbon', X(-1.85), 0.24, 0.42, -0.74, 0.74, 30, 3)
    k.exhaust(0.0, 0.60, r=0.15, mirror=False)                                                    # the giant V16 pipe
    k.mirrors(X(0.55), 0.98, DZ(0.95), size=(0.13, 0.16, 0.08))
    k.interior(X(-0.10), 0.90, DZ(0.64), l=1.4, h=0.30, seats_x=X(-0.30), seat_y=0.24, seat_z=DZ(0.74))
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

CARS = {
    'm2': (m2, '#1d5bd8', '#2a2b2e', '#1d5bd8'),
    'm4csl': (m4csl, '#f2f2ef', '#c8a24a', '#c8141b'),
    'm5': (m5, '#1c3b2e', '#1b1b1d', '#1d5bd8'),
    'xm': (xm, '#0b0b0d', '#1b1b1d', '#d8b04a'),
    'r8': (r8, '#a9adb1', '#1b1b1d', '#c8141b'),
    'rs6': (rs6, '#5a5f62', '#1b1b1d', '#c8141b'),
    'rsetrongt': (rsetrongt, '#2a6cc4', '#1b1b1d', '#c8141b'),
    'rsq8': (rsq8, '#c8141b', '#1b1b1d', '#c8141b'),
    'devel16': (devel16, '#111216', '#1b1b1d', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'bmw_audi.py')
