# Toyota (GAZOO Racing) models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/toyota.py -- --car all
#
# Bodies remap existing station tables: the front-engine GT (Ferrari 812) for the Supra, GR86 and GR GT, the
# Cayenne coupe/SUV for the GR Yaris, GR Corolla and Land Cruiser.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFGT, remap, SOFT, SHARP
from porsches import TCAY, TCAY_SUV
from teslas import glass

GT_WS = (0.36, -0.22, 0.93, 0.55, 0.62, 0.54)
GT_RW = (-1.85, -0.85, 0.99, 0.24, 0.42, 0.50)
GT_TOP = [(0.30, 0.93), (0.10, 1.06), (-0.20, 1.215), (-0.60, 1.24), (-1.00, 1.15), (-1.35, 1.00)]
GT_BOT = [(0.30, 0.925), (-0.60, 0.94), (-1.35, 0.975)]
CAY_WS = (1.05, 0.30, 1.10, 0.64, 0.70, 0.63)
CAY_RW = (-2.12, -1.15, 1.21, 0.27, 0.50, 0.58)
CAY_TOP = [(0.85, 1.13), (0.60, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.40, 1.36), (-1.75, 1.20)]
CAY_BOT = [(0.85, 1.12), (-0.60, 1.135), (-1.40, 1.16), (-1.75, 1.175)]
SUV_RW = (-2.30, -1.95, 1.22, 0.94, 0.52, 0.58)
SUV_TOP = [(0.85, 1.13), (0.60, 1.30), (0.30, 1.55), (-0.30, 1.605), (-1.20, 1.595), (-1.70, 1.53), (-1.95, 1.38), (-2.02, 1.20)]
SUV_BOT = [(0.85, 1.12), (-0.60, 1.135), (-1.60, 1.16), (-2.02, 1.17)]

def duck(rows, lift):
    return edit(edit(rows, rows[-2][0], zt=rows[-2][10] + lift * .6), rows[-1][0], zt=rows[-1][10] + lift, zr=rows[-1][9] + lift)

def gt_coupe(k, xs, ys, zf, wheels, duck_lift=0.0, crease=SOFT):
    X = lambda x: pl(xs, x)
    rows = remap(TFGT, xs, ys, zf)
    if duck_lift: rows = duck(rows, duck_lift)
    k.loft(stations(rows), **crease); k.arches(wheels); k.surface()
    glass(k, X, zf, GT_WS, GT_RW, GT_TOP, GT_BOT)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), X(0.32) - .004, X(0.32) + .004, 0.22, zf(0.88), 1, 12, off=.002)
        k.decal('skirt', 'Gloss', side(s), X(-0.90), X(1.20), 0.13, 0.20, 30, 2)
    k.mirrors(X(0.24), 0.96 * ys + .08, zf(0.98), size=(0.13, 0.17, 0.09))
    k.interior(X(-0.50), 1.26 * ys, zf(0.68), h=0.34, seats_x=X(-0.75), seat_z=zf(0.78))
    return X

# ---- GR Supra (A90): long nose, double-bubble roof, ducktail, big centre mouth, outboard round pipes
def grsupra(k):
    X = gt_coupe(k, [(-2.38, -2.19), (-1.10, -1.17), (1.62, 1.30), (2.36, 2.19)], 0.947, lambda z: z,
                 dict(F=dict(x=1.30, r=0.345, w=0.255, y=0.79, rim=0.241), R=dict(x=-1.17, r=0.35, w=0.275, y=0.80, rim=0.241)), duck_lift=0.05)
    k.headlight_quad((1.98, 0.62, 0.62), (0.72, 0.30, 0.55), 0.22, 0.08, slant=0.05, taper=0.3, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.42, 0.42, 0.20, 0.40, 18, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.55, s * 0.80, 0.22, 0.38, 8, 4))
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.05, 1.30, s * 0.18, s * 0.30, 4, 3))
    both(lambda s: k.slanted('doorvent', 'Gloss', s, X(0.90), X(0.70), 0.30, 0.42, lean=0.03, nu=4, nv=3))
    for s in (1, -1): k.decal('bubble', 'Gloss', 'top', X(-0.75), X(0.0), s * 0.18 - .006, s * 0.18 + .006, 10, 1, off=.004)
    k.tail_clusters(X(-1.80), 0.82, 0.90, 0.42, 0.80)
    k.fan('diffuser', 'Gloss', X(-1.80), 0.28, 0.44, -0.62, 0.62, 30, 3)
    k.exhaust(0.58, 0.38, r=0.05)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- GR86: compact 2+2, hexagonal mouth, fender gills, small ducktail
def gr86(k):
    X = gt_coupe(k, [(-2.38, -2.13), (-1.10, -1.29), (1.62, 1.29), (2.36, 2.13)], 0.90, lambda z: z + max(0.0, z - 0.90) * 0.10,
                 dict(F=dict(x=1.29, r=0.32, w=0.215, y=0.755, rim=0.229), R=dict(x=-1.29, r=0.32, w=0.215, y=0.76, rim=0.229)), duck_lift=0.03)
    k.headlight_quad((1.95, 0.58, 0.62), (0.72, 0.30, 0.55), 0.24, 0.07, slant=0.05, taper=0.3, dots='row')
    k.project('hexmouth', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.30, 0.40, min(v, 1 - v) * 2), lerp(0.20, 0.42, v)), 12, 6)
    both(lambda s: k.slanted('gill', 'Gloss', s, X(0.98), X(0.90), 0.40, 0.62, lean=0.02, nu=2, nv=6))
    k.tail_clusters(X(-1.80), 0.80, 0.88, 0.45, 0.80)
    k.fan('diffuser', 'Gloss', X(-1.80), 0.28, 0.42, -0.60, 0.60, 30, 3)
    k.exhaust(0.55, 0.36, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.02, 0.014))

# ---- GR GT: long-nose front-mid V8 flagship, slim LEDs, active spoiler, carbon roof
def grgt(k):
    zf = lambda z: z if z < 0.85 else 0.85 + (z - 0.85) * 0.81
    X = gt_coupe(k, [(-2.38, -2.41), (-1.10, -1.33), (1.62, 1.40), (2.36, 2.41)], 1.015, zf,
                 dict(F=dict(x=1.40, r=0.345, w=0.275, y=0.86, rim=0.254), R=dict(x=-1.33, r=0.355, w=0.325, y=0.865, rim=0.267)))
    k.drl_strip((2.16, 0.68, 0.60), (0.75, 0.30, 0.40), 0.30, 0.03, slant=0.04)
    k.decal('mouth', 'Gloss', 'front', -0.62, 0.62, 0.18, 0.36, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.90, 0.90, 0.14, 0.18, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.30, 1.70, s * 0.12, s * 0.36, 6, 4))
    k.decal('roof', 'Carbon', 'top', X(-0.95), X(-0.25), -0.45, 0.45, 12, 10, off=.003)
    k.light_bar(X(-1.80), 0.84, 0.87, 0.80, bg=0.015, frac=0.7)
    k.fan('diffuser', 'Carbon', X(-1.80), 0.28, 0.44, -0.66, 0.66, 30, 3)
    for y in (-0.10, 0.10): k.exhaust(y, 0.42, r=0.05, mirror=False)
    k.spoiler(X(-2.20), 1.0, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=10)

# ---- hot hatches and the Land Cruiser (Cayenne bases)
def hatch(k, base, xs, ys, zf, wheels, top, bot, rw, pillars, crease=SOFT):
    X = lambda x: pl(xs, x)
    k.loft(stations(remap(base, xs, ys, zf)), **crease); k.arches(wheels); k.surface()
    glass(k, X, zf, CAY_WS, rw, top, bot, pillars=pillars)
    for s in (1, -1):
        for xg in (0.86,) + tuple(p - .02 for p in pillars): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, zf(0.30), zf(1.13), 1, 14, off=.002)
    k.arch_trim(0.06, mat='Gloss')
    k.mirrors(X(0.80), 0.98 * ys + .08, zf(1.20), size=(0.14, 0.19, 0.10))
    k.interior(X(-0.45), 1.40 * ys, zf(0.98), l=2.0, h=0.42, seats_x=X(-0.20), seat_z=zf(1.06))
    return X

def gr_face(k, z, light=(0.62, 0.70)):
    """GR 'functional matrix' grille: big black mesh mouth with the lights tucked above its corners"""
    k.headlight_quad((1.95, light[0], light[1]), (0.72, 0.30, 0.55), 0.22, 0.07, slant=0.05, taper=0.25, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.48, 0.48, z[0], z[1], 18, 6)
    for i in range(4): k.decal('mesh', 'Black', 'front', -0.46, 0.46, z[0] + .03 + i * (z[1] - z[0]) / 4.5, z[0] + .035 + i * (z[1] - z[0]) / 4.5, 18, 1, off=.008)

def gryaris(k):
    zf = lambda z: z * 0.885
    X = hatch(k, TCAY, [(-2.48, -2.0), (-1.40, -1.28), (1.50, 1.28), (2.46, 2.0)], 0.905, zf,
              dict(F=dict(x=1.28, r=0.33, w=0.225, y=0.79, rim=0.229), R=dict(x=-1.28, r=0.33, w=0.225, y=0.79, rim=0.229)),
              CAY_TOP, CAY_BOT, CAY_RW, [-0.60])
    gr_face(k, (0.24, 0.52), (0.62, 0.74))
    k.wing(X(-1.15), zf(1.49), 0.20, 1.10, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.tail_clusters(X(-1.90), zf(1.03), zf(1.12), 0.50, 0.86)
    k.fan('diffuser', 'Gloss', X(-1.90), 0.26, 0.42, -0.60, 0.60, 30, 3)
    k.exhaust(0.50, 0.34, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.022, 0.015))

def grcorolla(k):
    zf = lambda z: z * 0.875
    X = hatch(k, TCAY_SUV, [(-2.48, -2.205), (-1.40, -1.32), (1.50, 1.32), (2.46, 2.205)], 0.925, zf,
              dict(F=dict(x=1.32, r=0.335, w=0.235, y=0.81, rim=0.229), R=dict(x=-1.32, r=0.335, w=0.235, y=0.81, rim=0.229)),
              SUV_TOP, SUV_BOT, SUV_RW, [-0.15, -1.25])
    gr_face(k, (0.24, 0.52), (0.64, 0.74))
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.30, 1.65, s * 0.14, s * 0.30, 5, 4))
    k.wing(X(-1.93), zf(1.63), 0.18, 1.15, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.tail_clusters(X(-1.95), zf(1.05), zf(1.13), 0.50, 0.86)
    k.fan('diffuser', 'Gloss', X(-1.95), 0.26, 0.42, -0.60, 0.60, 30, 3)
    for y in (-0.38, 0.0, 0.38): k.exhaust(y, 0.36, r=0.045, mirror=False)              # the three pipes
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.022, 0.015))

LC_LIFT = 0.0
def lc300(k):
    zf = lambda z: z * 1.08 + 0.10
    X = hatch(k, TCAY_SUV, [(-2.48, -2.49), (-1.40, -1.40), (1.50, 1.45), (2.46, 2.49)], 0.99, zf,
              dict(F=dict(x=1.45, r=0.40, w=0.265, y=0.84, rim=0.254, gap=0.07), R=dict(x=-1.40, r=0.40, w=0.265, y=0.84, rim=0.254, gap=0.07)),
              SUV_TOP, SUV_BOT, SUV_RW, [-0.15, -1.25], crease=SHARP)
    # big upright grille with chrome bars, square-jawed lights
    k.decal('grille', 'Gloss', 'front', -0.52, 0.52, zf(0.46), zf(0.80), 18, 6)
    for i in range(5): k.decal('bar', 'Chrome', 'front', -0.50, 0.50, zf(0.50) + i * .075, zf(0.50) + i * .075 + .018, 18, 1, off=.009)
    k.headlight_quad((2.40, 0.70, zf(0.84)), (0.80, 0.25, 0.30), 0.26, 0.10, slant=0.02, dots='row')
    k.decal('skid', 'Black', 'front', -0.60, 0.60, zf(0.24), zf(0.34), 18, 2, off=.006)
    both(lambda s: k.decal('cladding', 'Black', side(s), X(-1.00), X(1.05), zf(0.22), zf(0.36), 30, 3, off=.006))
    for s in (1, -1):
        k.blade('rail', 'Gloss', [(X(0.0), 0, k.deck_z(X(0.0), s * .62) + .03), (X(-0.80), 0, k.deck_z(X(-0.80), s * .62) + .05), (X(-1.70), 0, k.deck_z(X(-1.70), s * .62) + .03)], s * 0.62, 0.04, 0.04, 0.03)
    k.tail_clusters(X(-1.95), zf(0.95), zf(1.12), 0.60, 0.86)
    k.fan('rearbumper', 'Black', X(-1.95), zf(0.30), zf(0.46), -0.66, 0.66, 30, 3)
    k.join(); k.wheels(spokes=6, nut='bolts', spoke_w=(0.04, 0.03), offroad=True, caliper=(0.26, 0.09, 0.10))

CARS = {
    'grsupra': (grsupra, '#f0cc00', '#2a2b2e', '#c8141b'),
    'gr86': (gr86, '#b3121e', '#2a2b2e', '#c8141b'),
    'gryaris': (gryaris, '#eceeed', '#1b1b1d', '#c8141b'),
    'grcorolla': (grcorolla, '#b3121e', '#1b1b1d', '#c8141b'),
    'lc300': (lc300, '#0b0b0d', '#2a2b2e', '#1b1b1d'),
    'grgt': (grgt, '#6d7176', '#1b1b1d', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'toyota.py')
