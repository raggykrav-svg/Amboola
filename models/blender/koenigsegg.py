# Koenigsegg models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/koenigsegg.py -- --car all
#
# Koenigsegg look: narrow bubble canopy with a carbon targa roof, slanted lights in the fender tips, big side intakes
# behind the dihedral doors, ring-shaped tail lights and a high centre exhaust.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from carshape import build, scaled

# Jesko Attack: 4.63 x 2.03 x 1.21 m, 2.70 m wheelbase, drawn from photos (carshape.build); carshape.scaled stretches
# it to every other Koenigsegg's real length, width, height, wheelbase and overhang.
PJESKO = dict(L=4.626, W=2.03, H=1.21, WB=2.70, fo=1.02, clear=0.11, nose_zb=0.22, tail_zb=0.40,
              top=[(2.37, 0.46), (2.27, 0.54), (2.0, 0.61), (1.6, 0.68), (1.25, 0.75), (0.95, 0.81), (0.5, 1.0), (0.1, 1.18),
                   (-0.2, 1.21), (-0.6, 1.16), (-0.95, 1.07), (-1.5, 1.03), (-2.0, 1.02), (-2.256, 0.95)],
              belt=[(2.37, 0.44), (2.1, 0.60), (1.6, 0.74), (1.0, 0.81), (0.4, 0.84), (-0.4, 0.87), (-1.0, 0.97), (-1.6, 1.0),
                    (-2.1, 0.98), (-2.256, 0.88)],
              plan=[(2.37, 0.40), (2.27, 0.68), (2.0, 0.88), (1.35, 1.0), (0.6, 0.96), (0.0, 0.955), (-0.7, 1.0), (-1.35, 1.015),
                    (-1.9, 0.99), (-2.2, 0.88), (-2.256, 0.80)],
              roof=[(0.95, 0.60), (0.4, 0.52), (-0.2, 0.48), (-0.6, 0.42), (-0.95, 0.34)],
              cab=(0.95, 0.10, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.06, side=(0.88, -0.85),
              doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0)
WK = (dict(r=0.34, w=0.265, rim=0.254), dict(r=0.36, w=0.325, rim=0.267))

def koenigsegg(k, P, wheels=WK, rings=True):
    S = build(k, P, *wheels, crease=dict(crease_lines=0.5, crisp_front=-9, crisp=0.4, crease_front=0.6, crease_rear=0.8))
    k.decal('roof', 'Carbon', 'top', -0.60, 0.12, -0.40, 0.40, 12, 10, off=.003)            # the removable targa roof
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, -0.40, -1.00, 0.46, 0.88, lean=0.22, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.20, 30, 2)
    # slanted lights in the fender tips, a big carbon splitter and the wide front mouth
    k.headlight_quad((S.nose - 0.30, 0.70, 0.58), (0.66, 0.34, 0.52), 0.22, 0.09, slant=0.06, taper=0.3, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.52, 0.52, 0.18, 0.36, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.94, 0.94, 0.12, 0.17, 30, 2)
    k.fan('rearbg', 'Gloss', -1.7, 0.42, 0.76, -0.66, 0.66, 30, 5, off=.003)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.42, -0.72, 0.72, 30, 3)
    if rings:   # ring tail lights, two a side
        for s in (1, -1):
            for y, r in ((0.52, 0.075), (0.72, 0.065)):
                k.oval('tailring', 'Taillight', V(S.tail + 0.12, s * y, 0.84), V(-1, s * 0.35 * y, 0.05), r, r, .006, ring=0.62)
    return S

def big_pipe(k, z=0.80, w=0.20, h=0.09):
    k.exhaust(0.0, z, shape='rect', w=w, h=h, mirror=False)

# ---- Jesko Absolut: 4.85 m long - the low-drag longtail, no wing, two fins at the back
P_ABS = scaled(PJESKO, L=4.845, fo=1.02)
def jesko(k):
    S = koenigsegg(k, P_ABS); big_pipe(k)
    for s in (1, -1): k.plate('fin', 'Carbon', [(-1.55, 1.0), (-1.75, 1.16), (S.tail + 0.05, 1.12), (S.tail + 0.05, 0.95)], s * 0.40, t=0.015)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# ---- Jesko Attack: the huge boomerang wing hung from swan necks and canards on the nose
def jeskoattack(k):
    S = koenigsegg(k, PJESKO); big_pipe(k)
    k.swan_wing(S.tail + 0.38, 1.38, 0.46, 1.96, S.tail + 0.48, 0.36, aoa=-10, flap=(S.tail - 0.02, 1.47, 0.18, -26),
                endplate=[(S.tail + 0.44, 1.32), (S.tail + 0.42, 1.50), (S.tail - 0.16, 1.54), (S.tail - 0.20, 1.36), (S.tail, 1.28)])
    both(lambda s: k.box('canard', 'Carbon', (S.nose - 0.22, s * 0.88, 0.36), (0.18, 0.14, 0.012), rot=(0, math.radians(-8), 0)))
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# ---- Regera: 4.56 x 2.05 x 1.11 m, 2.66 m wheelbase - the grand tourer with an active spoiler
P_REG = scaled(PJESKO, L=4.56, W=2.05, H=1.11, WB=2.662, fo=1.0)
def regera(k):
    S = koenigsegg(k, P_REG); big_pipe(k, z=0.74, w=0.24)
    k.spoiler(S.tail + 0.22, 1.0, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- CC850: 4.36 x 2.02 x 1.13 m, 2.70 m wheelbase - the CC8S tribute: round lights, turbine wheels, a ducktail
P_CC = scaled(PJESKO, L=4.364, W=2.024, H=1.127, WB=2.70, fo=0.86)
def cc850(k):
    S = koenigsegg(k, P_CC, rings=False); big_pipe(k, z=0.74, w=0.16)
    for s in (1, -1):
        k.oval('headlight', 'Chrome', V(S.nose - 0.28, s * 0.68, 0.58), V(0.66, s * 0.34, 0.52), 0.10, 0.07, .007, n=8)
        k.fan('tail', 'Taillight', -1.7, 0.80, 0.88, s * 0.45, s * 0.80, 8, 3, off=.006)
    k.join(); k.wheels(spokes=18, spoke_w=(0.012, 0.008))

# ---- Agera RS: 4.29 x 2.05 x 1.12 m, 2.66 m wheelbase - short and wide, the fixed wing on posts
P_AGR = scaled(PJESKO, L=4.293, W=2.05, H=1.12, WB=2.662, fo=0.88)
def agerars(k):
    S = koenigsegg(k, P_AGR); big_pipe(k, z=0.74)
    k.post_wing(S.tail + 0.36, 1.16, 0.36, 1.80, S.tail + 0.24, 0.42, aoa=-9,
                endplate=[(S.tail + 0.42, 1.11), (S.tail + 0.40, 1.25), (S.tail - 0.04, 1.28), (S.tail - 0.08, 1.14), (S.tail + 0.10, 1.09)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# ---- Gemera: 4.98 x 1.99 x 1.30 m, 3.0 m wheelbase - the four-seat mega-GT: a longer, roomier cabin with a glass roof
P_GEM = scaled(PJESKO, L=4.975, W=1.988, H=1.295, WB=3.0, fo=1.0,
               roof=[(x, w * 1.18) for x, w in scaled(PJESKO, WB=3.0, W=1.988)['roof']], pillars=(-0.45,), pillar_w=0.06)
def gemera(k):
    S = koenigsegg(k, P_GEM, (dict(r=0.355, w=0.265, rim=0.267), dict(r=0.365, w=0.295, rim=0.279)))
    k.decal('roofglass', 'Glass', 'top', -0.60, 0.10, -0.40, 0.40, 12, 10, off=.005)
    big_pipe(k, z=0.84, w=0.16)
    k.join(); k.wheels(spokes=10, nut='bolts')

CARS = {
    'jesko': (jesko, '#ff6a13', '#1b1b1d', '#c8141b'),
    'jeskoattack': (jeskoattack, '#1a1c1f', '#1b1b1d', '#ff6a13'),
    'regera': (regera, '#ff7a00', '#1b1b1d', '#c8141b'),
    'gemera': (gemera, '#16295c', '#1b1b1d', '#ff6a13'),
    'cc850': (cc850, '#f0f0ec', '#9da1a6', '#c8141b'),
    'agerars': (agerars, '#ff6a13', '#1b1b1d', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'koenigsegg.py')
