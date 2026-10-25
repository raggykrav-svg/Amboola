# Toyota (GAZOO Racing) models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/toyota.py -- --car all
#
# Bodies come from carshape.build: each car's real measurements and outline.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFGT, remap, SOFT, SHARP
from porsches import TCAY, TCAY_SUV
from teslas import glass
from carshape import build

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

# Every Toyota below is built by carshape.build from its real length, width, height and wheelbase and outline points
# read off photos (the axles at +-wheelbase/2). gt_coupe() and hatch() are the older remapped bodies, still used by
# the BMW, Audi and Mercedes scripts.

# ---- GR Supra (A90): 4.38 x 1.85 x 1.29 m, 2.47 m wheelbase. A long bonnet with big front fenders, the cabin set far
# back under a double-bubble roof, a ducktail, the big centre mouth and one round pipe each side
PSUPRA = dict(L=4.379, W=1.854, H=1.292, WB=2.47, fo=0.97, clear=0.12, nose_zb=0.26, tail_zb=0.38,
              top=[(2.205, 0.62), (2.12, 0.70), (1.8, 0.77), (1.235, 0.84), (0.6, 0.90), (0.15, 0.95), (-0.15, 1.12), (-0.45, 1.26),
                   (-0.70, 1.292), (-1.0, 1.26), (-1.3, 1.16), (-1.6, 1.05), (-1.95, 1.02), (-2.10, 1.04), (-2.174, 0.97)],
              belt=[(2.205, 0.60), (1.9, 0.78), (1.235, 0.88), (0.15, 0.95), (-0.6, 0.97), (-1.235, 1.0), (-1.9, 1.0), (-2.174, 0.93)],
              plan=[(2.205, 0.56), (2.12, 0.76), (1.8, 0.88), (1.235, 0.92), (0.4, 0.90), (-0.5, 0.90), (-1.235, 0.927), (-1.8, 0.90),
                    (-2.1, 0.82), (-2.174, 0.74)],
              roof=[(0.15, 0.64), (-0.45, 0.58), (-1.0, 0.55), (-1.4, 0.50), (-1.6, 0.46)],
              cab=(0.15, -0.45, -1.0, -1.60), bulge=0.06, hip=0.06, side=(0.08, -1.25), doors=(0.10,), mirror_x=0.04, rw_w=0.85)
def grsupra(k):
    S = build(k, PSUPRA, dict(r=0.33, w=0.255, rim=0.241), dict(r=0.337, w=0.275, rim=0.241), crease=SOFT)
    k.headlight_quad((1.95, 0.62, 0.64), (0.66, 0.34, 0.55), 0.24, 0.08, slant=0.05, taper=0.3, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.44, 0.44, 0.20, 0.42, 18, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.56, s * 0.80, 0.22, 0.40, 8, 4))
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.05, 1.35, s * 0.18, s * 0.30, 4, 3))
    both(lambda s: k.slanted('doorvent', 'Gloss', s, 0.75, 0.55, 0.32, 0.44, lean=0.03, nu=4, nv=3))
    for s in (1, -1): k.decal('bubble', 'Gloss', 'top', -1.0, -0.30, s * 0.18 - .006, s * 0.18 + .006, 10, 1, off=.004)
    k.tail_clusters(-1.80, 0.86, 0.94, 0.42, 0.80)
    k.fan('diffuser', 'Gloss', -1.80, 0.28, 0.44, -0.62, 0.62, 30, 3)
    k.exhaust(0.58, 0.40, r=0.05)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- GR86: 4.27 x 1.78 x 1.31 m, 2.58 m wheelbase. A compact 2+2 with a hexagon mouth, fender gills, a fastback
# roof with a little rear quarter window and a small ducktail
P86 = dict(L=4.265, W=1.775, H=1.31, WB=2.575, fo=0.85, clear=0.13, nose_zb=0.26, tail_zb=0.36,
           top=[(2.1375, 0.62), (2.05, 0.70), (1.75, 0.77), (1.2875, 0.83), (0.8, 0.88), (0.45, 0.92), (0.0, 1.15), (-0.35, 1.29),
                (-0.65, 1.31), (-1.0, 1.28), (-1.35, 1.16), (-1.65, 1.03), (-2.0, 1.0), (-2.1275, 0.95)],
           belt=[(2.1375, 0.60), (1.8, 0.79), (1.2875, 0.87), (0.45, 0.92), (-0.6, 0.95), (-1.2875, 0.98), (-1.9, 0.98), (-2.1275, 0.92)],
           plan=[(2.1375, 0.52), (2.05, 0.72), (1.75, 0.84), (1.2875, 0.885), (0.4, 0.865), (-0.5, 0.865), (-1.2875, 0.8875),
                 (-1.8, 0.87), (-2.05, 0.80), (-2.1275, 0.72)],
           roof=[(0.45, 0.66), (-0.35, 0.58), (-1.0, 0.55), (-1.4, 0.50), (-1.65, 0.46)],
           cab=(0.45, -0.35, -1.05, -1.65), bulge=0.05, hip=0.04, side=(0.38, -1.35), pillars=(-1.0,), doors=(0.40,),
           mirror_x=0.34, rw_w=0.85)
def gr86(k):
    S = build(k, P86, dict(r=0.315, w=0.215, rim=0.229), dict(r=0.315, w=0.215, rim=0.229), crease=SOFT)
    k.headlight_quad((1.90, 0.58, 0.64), (0.66, 0.34, 0.55), 0.26, 0.07, slant=0.05, taper=0.3, dots='row')
    k.project('hexmouth', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.30, 0.42, min(v, 1 - v) * 2), lerp(0.20, 0.44, v)), 12, 6)
    both(lambda s: k.slanted('gill', 'Gloss', s, 0.98, 0.88, 0.44, 0.66, lean=0.02, nu=2, nv=6))
    k.tail_clusters(-1.80, 0.82, 0.90, 0.45, 0.80)
    k.fan('diffuser', 'Gloss', -1.80, 0.28, 0.42, -0.60, 0.60, 30, 3)
    k.exhaust(0.55, 0.36, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.02, 0.014))

# ---- GR GT: 4.82 x 2.00 x 1.20 m, 2.73 m wheelbase. The long-nose front-mid V8 flagship: slim LEDs over a wide
# mouth, a carbon roof, the cabin set back, a light bar, twin centre pipes and an active spoiler
PGRGT = dict(L=4.82, W=2.0, H=1.195, WB=2.725, fo=1.0, clear=0.11, nose_zb=0.24, tail_zb=0.40,
             top=[(2.3625, 0.54), (2.27, 0.62), (1.95, 0.69), (1.3625, 0.76), (0.8, 0.81), (0.35, 0.86), (0.0, 1.03), (-0.35, 1.165),
                  (-0.62, 1.195), (-0.95, 1.16), (-1.3, 1.06), (-1.65, 0.99), (-2.1, 0.97), (-2.35, 0.98), (-2.4575, 0.90)],
             belt=[(2.3625, 0.52), (2.0, 0.70), (1.3625, 0.79), (0.35, 0.85), (-0.6, 0.88), (-1.3625, 0.94), (-2.0, 0.95), (-2.4575, 0.86)],
             plan=[(2.3625, 0.50), (2.27, 0.76), (1.95, 0.92), (1.3625, 0.99), (0.5, 0.96), (-0.5, 0.96), (-1.3625, 1.0), (-2.0, 0.97),
                   (-2.35, 0.88), (-2.4575, 0.78)],
             roof=[(0.35, 0.64), (-0.35, 0.57), (-0.95, 0.52), (-1.4, 0.46), (-1.65, 0.42)],
             cab=(0.35, -0.35, -0.95, -1.65), bulge=0.06, hip=0.05, side=(0.28, -1.10), doors=(0.30,), mirror_x=0.24, rw_w=0.85)
def grgt(k):
    S = build(k, PGRGT, dict(r=0.347, w=0.265, rim=0.254), dict(r=0.35, w=0.325, rim=0.254), crease=SOFT)
    k.drl_strip((2.14, 0.70, 0.60), (0.70, 0.34, 0.40), 0.32, 0.03, slant=0.04)
    k.decal('mouth', 'Gloss', 'front', -0.64, 0.64, 0.16, 0.36, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.92, 0.92, 0.12, 0.17, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.30, 1.75, s * 0.12, s * 0.36, 6, 4))
    k.decal('roof', 'Carbon', 'top', -0.95, -0.30, -0.45, 0.45, 12, 10, off=.003)
    k.light_bar(-1.9, 0.88, 0.91, 0.80, bg=0.015, frac=0.7)
    k.fan('diffuser', 'Carbon', -1.9, 0.26, 0.44, -0.66, 0.66, 30, 3)
    for y in (-0.10, 0.10): k.exhaust(y, 0.44, r=0.05, mirror=False)
    k.spoiler(S.tail + 0.22, 1.02, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.40)
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

def gr_face(k, z, light=(0.62, 0.70), x=1.95):
    """GR 'functional matrix' grille: a big black mesh mouth with the lights tucked above its corners"""
    k.headlight_quad((x, light[0], light[1]), (0.72, 0.30, 0.55), 0.22, 0.07, slant=0.05, taper=0.25, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.48, 0.48, z[0], z[1], 18, 6)
    for i in range(4): k.decal('mesh', 'Black', 'front', -0.46, 0.46, z[0] + .03 + i * (z[1] - z[0]) / 4.5, z[0] + .035 + i * (z[1] - z[0]) / 4.5, 18, 1, off=.008)

# ---- GR Yaris: 4.00 x 1.81 x 1.46 m, 2.56 m wheelbase. The three-door rally hatch: a roof that drops towards the
# back, swollen wheel arches, the GR mesh face, a roof spoiler and one pipe
PYARIS = dict(L=3.995, W=1.805, H=1.455, WB=2.56, fo=0.80, clear=0.13, nose_zb=0.28, tail_zb=0.36, nose_run=0.15, tail_run=0.10,
              top=[(2.08, 0.74), (2.0, 0.82), (1.7, 0.88), (1.28, 0.93), (0.85, 0.98), (0.45, 1.22), (0.05, 1.43), (-0.25, 1.455),
                   (-0.8, 1.42), (-1.30, 1.36), (-1.55, 1.20), (-1.75, 1.06), (-1.915, 1.0)],
              belt=[(2.08, 0.72), (1.7, 0.88), (1.28, 0.94), (0.85, 0.98), (0.0, 1.0), (-1.0, 1.03), (-1.6, 1.06), (-1.915, 0.98)],
              plan=[(2.08, 0.60), (2.0, 0.78), (1.7, 0.87), (1.28, 0.90), (0.4, 0.86), (-0.5, 0.87), (-1.28, 0.9025), (-1.7, 0.88),
                    (-1.915, 0.80)],
              roof=[(0.85, 0.70), (0.0, 0.64), (-0.8, 0.60), (-1.3, 0.56), (-1.75, 0.50)],
              cab=(0.85, 0.05, -1.30, -1.75), bulge=0.04, hip=0.07, side=(0.78, -1.45), pillars=(-0.55,), pillar_w=0.07,
              doors=(0.78,), mirror_x=0.72, rw_w=0.85, roof_crown=0.04)
def gryaris(k):
    S = build(k, PYARIS, dict(r=0.319, w=0.225, rim=0.229), dict(r=0.319, w=0.225, rim=0.229), crease=SOFT)
    k.arch_trim(0.06, mat='Gloss')
    gr_face(k, (0.24, 0.54), (0.62, 0.76), x=1.90)
    k.wing(-1.28, 1.40, 0.20, 1.10, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.tail_clusters(-1.6, 0.98, 1.06, 0.50, 0.86)
    k.fan('diffuser', 'Gloss', -1.6, 0.26, 0.42, -0.60, 0.60, 30, 3)
    k.exhaust(0.50, 0.34, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.022, 0.015))

# ---- GR Corolla: 4.41 x 1.85 x 1.48 m, 2.64 m wheelbase. The five-door hot hatch: bonnet vents, flared arches, the
# GR mesh face, a roof spoiler and the famous three pipes
PCOROLLA = dict(L=4.41, W=1.851, H=1.479, WB=2.64, fo=0.93, clear=0.13, nose_zb=0.28, tail_zb=0.36, tail_run=0.10,
                top=[(2.25, 0.74), (2.16, 0.82), (1.85, 0.88), (1.32, 0.94), (0.95, 0.99), (0.5, 1.24), (0.05, 1.45), (-0.3, 1.479),
                     (-0.9, 1.46), (-1.4, 1.42), (-1.75, 1.32), (-1.95, 1.12), (-2.08, 1.04), (-2.16, 0.98)],
                belt=[(2.25, 0.72), (1.85, 0.89), (1.32, 0.95), (0.95, 0.99), (0.0, 1.01), (-1.0, 1.04), (-1.8, 1.06), (-2.16, 0.98)],
                plan=[(2.25, 0.60), (2.16, 0.80), (1.85, 0.89), (1.32, 0.92), (0.4, 0.89), (-0.5, 0.895), (-1.32, 0.9255), (-1.85, 0.90),
                      (-2.16, 0.80)],
                roof=[(0.95, 0.70), (0.0, 0.65), (-0.9, 0.62), (-1.4, 0.58), (-1.95, 0.50)],
                cab=(0.95, 0.05, -1.45, -1.95), bulge=0.04, hip=0.06, side=(0.88, -1.70), pillars=(-0.30, -1.30), pillar_w=0.07,
                doors=(0.88, -0.30), mirror_x=0.82, rw_w=0.85, roof_crown=0.04)
def grcorolla(k):
    S = build(k, PCOROLLA, dict(r=0.3226, w=0.235, rim=0.229), dict(r=0.3226, w=0.235, rim=0.229), crease=SOFT)
    k.arch_trim(0.06, mat='Gloss')
    gr_face(k, (0.24, 0.54), (0.64, 0.76), x=2.05)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.30, 1.70, s * 0.14, s * 0.30, 5, 4))
    k.wing(-1.45, 1.46, 0.18, 1.15, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.tail_clusters(-1.85, 1.0, 1.08, 0.50, 0.86)
    k.fan('diffuser', 'Gloss', -1.85, 0.26, 0.42, -0.60, 0.60, 30, 3)
    for y in (-0.38, 0.0, 0.38): k.exhaust(y, 0.36, r=0.045, mirror=False)              # the three pipes
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.022, 0.015))

# ---- Land Cruiser 300 GR Sport: 4.97 x 1.99 x 1.93 m, 2.85 m wheelbase. A tall box: an upright black grille with the
# big TOYOTA bars, square lamps, black cladding, roof rails and a near-vertical tailgate
PLC = dict(L=4.965, W=1.99, H=1.925, WB=2.85, fo=0.95, clear=0.23, nose_zb=0.45, tail_zb=0.50, nose_run=0.10, tail_run=0.15,
           top=[(2.375, 1.05), (2.30, 1.15), (2.0, 1.20), (1.425, 1.23), (0.75, 1.27), (0.35, 1.58), (-0.05, 1.88), (-0.4, 1.925),
                (-1.5, 1.92), (-2.25, 1.89), (-2.42, 1.60), (-2.52, 1.32), (-2.59, 1.22)],
           belt=[(2.375, 1.02), (2.0, 1.20), (1.425, 1.24), (0.75, 1.27), (-0.5, 1.29), (-1.5, 1.30), (-2.3, 1.31), (-2.59, 1.22)],
           plan=[(2.375, 0.80), (2.30, 0.92), (2.0, 0.97), (1.425, 0.99), (0.4, 0.98), (-0.6, 0.98), (-1.425, 0.995), (-2.2, 0.99),
                 (-2.5, 0.96), (-2.59, 0.90)],
           roof=[(0.75, 0.82), (0.0, 0.78), (-1.0, 0.78), (-2.0, 0.77), (-2.42, 0.74)],
           cab=(0.75, -0.05, -2.25, -2.45), bulge=0.03, hip=0.03, side=(0.68, -2.30), pillars=(-0.40, -1.55), pillar_w=0.08,
           doors=(0.68, -0.40, -1.55), mirror_x=0.60, rw_w=0.85, roof_crown=0.03, mirror_size=(0.18, 0.24, 0.14))
def lc300(k):
    S = build(k, PLC, dict(r=0.40, w=0.265, rim=0.254, gap=0.07), dict(r=0.40, w=0.265, rim=0.254, gap=0.07), crease=SHARP)
    k.decal('grille', 'Gloss', 'front', -0.56, 0.56, 0.62, 1.10, 18, 6)
    for i in range(5): k.decal('bar', 'Chrome', 'front', -0.54, 0.54, 0.68 + i * .085, 0.68 + i * .085 + .02, 18, 1, off=.009)
    k.headlight_quad((2.32, 0.74, 1.10), (0.90, 0.25, 0.20), 0.30, 0.11, slant=0.02, dots='row')
    k.decal('skid', 'Black', 'front', -0.62, 0.62, 0.32, 0.46, 18, 2, off=.006)
    k.arch_trim(0.07)
    both(lambda s: k.decal('cladding', 'Black', side(s), -1.10, 1.10, 0.26, 0.42, 30, 3, off=.006))
    for s in (1, -1):
        k.blade('rail', 'Gloss', [(0.0, 0, k.deck_z(0.0, s * .66) + .03), (-1.0, 0, k.deck_z(-1.0, s * .66) + .05), (-2.10, 0, k.deck_z(-2.10, s * .66) + .03)], s * 0.66, 0.04, 0.04, 0.03)
    k.tail_clusters(-2.1, 1.08, 1.26, 0.62, 0.88)
    k.fan('rearbumper', 'Black', -2.1, 0.40, 0.58, -0.66, 0.66, 30, 3)
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
