# Koenigsegg models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/koenigsegg.py -- --car all
#
# Koenigsegg look: narrow bubble canopy with a carbon targa roof, slanted lights in the fender tips, big side intakes
# behind the dihedral doors, ring-shaped tail lights and a high centre exhaust. Bodies remap the mid-engine table.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap
from hypercars import glasshouse

def kx_table(xs, ys, zf, canopy=0.85):
    rows = remap(TFER, xs, ys, zf)
    return [r[:8] + (r[8] * (canopy if -0.75 < r[0] < 0.85 else 1.0),) + r[9:] for r in rows]

KX = [(-2.33, -2.31), (-1.30, -1.33), (1.36, 1.37), (2.31, 2.30)]
KZ = lambda z: z + max(0.0, z - 0.90) * 0.08
TK = kx_table(KX, 1.025, KZ)
WK = dict(F=dict(x=1.37, r=0.34, w=0.265, y=0.86, rim=0.254), R=dict(x=-1.33, r=0.36, w=0.325, y=0.865, rim=0.267))

def koenigsegg(k, rows=TK, X=lambda x: pl(KX, x), Z=KZ, wheels=WK, rings=True, cabin_l=1.2):
    k.loft(stations(rows), crease_lines=0.5, crisp_front=-9, crisp=0.4, crease_front=0.6, crease_rear=0.8)
    k.arches(wheels); k.surface()
    glasshouse(k, X, Z, hw=0.92)
    k.decal('roof', 'Carbon', 'top', X(-0.60), X(0.15), -0.42, 0.42, 12, 10, off=.003)            # removable targa roof
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), X(0.70) - .004, X(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, X(-0.40), X(-1.00), 0.48, 0.86, lean=0.22, nu=8, nv=8)
        k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.13, 0.21, 30, 2)
    # slanted lights in the fender tips, big carbon splitter and front mouth
    k.headlight_quad((2.06, 0.70, 0.60), (0.72, 0.32, 0.52), 0.22, 0.09, slant=0.06, taper=0.3, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.50, 0.50, 0.20, 0.36, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.92, 0.92, 0.14, 0.18, 30, 2)
    k.fan('rearbg', 'Gloss', -1.70, 0.42, 0.74, -0.66, 0.66, 30, 5, off=.003)
    k.fan('diffuser', 'Carbon', -1.70, 0.26, 0.42, -0.72, 0.72, 30, 3)
    if rings:   # ring tail lights, two per side
        for s in (1, -1):
            for y, r in ((0.52, 0.075), (0.72, 0.065)):
                k.oval('tailring', 'Taillight', V(-2.10, s * y, 0.82), V(-1, s * 0.35 * y, 0.05), r, r, .006, ring=0.62)
    k.mirrors(X(0.62), 1.08, 0.94, size=(0.13, 0.17, 0.08))
    k.interior(X(-0.20), 1.14, Z(0.64), l=cabin_l + 0.3, h=0.32, seats_x=X(-0.42), seat_y=0.33, seat_z=Z(0.74))

def big_pipe(k, z=0.78, w=0.20, h=0.09):
    k.exhaust(0.0, z, shape='rect', w=w, h=h, mirror=False)

def jesko(k):          # Absolut: low-drag, no wing, twin rear fins
    koenigsegg(k); big_pipe(k)
    k.plate('fin', 'Carbon', [(-1.55, 0.98), (-1.75, 1.14), (-2.30, 1.10), (-2.30, 0.93)], 0.40, t=0.015)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

def jeskoattack(k):    # huge boomerang wing hung from swan necks, front canards
    koenigsegg(k); big_pipe(k)
    k.swan_wing(-1.88, 1.36, 0.46, 1.96, -1.78, 0.36, aoa=-10, flap=(-2.28, 1.45, 0.18, -26),
                endplate=[(-1.82, 1.30), (-1.84, 1.48), (-2.42, 1.52), (-2.46, 1.34), (-2.26, 1.26)])
    both(lambda s: k.box('canard', 'Carbon', (2.12, s * 0.86, 0.36), (0.18, 0.14, 0.012), rot=(0, math.radians(-8), 0)))
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

def regera(k):         # grand tourer: active rear spoiler, softer face
    koenigsegg(k); big_pipe(k, w=0.24)
    k.spoiler(-2.02, 1.07, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

def cc850(k):          # CC8S tribute: rounder lights, turbine wheels, small ducktail, no wing
    rows = edit(edit(TK, TK[-2][0], zt=TK[-2][10] + .03), TK[-1][0], zt=TK[-1][10] + .05, zr=TK[-1][9] + .05)
    koenigsegg(k, rows, rings=False); big_pipe(k, w=0.16)
    for s in (1, -1):
        k.oval('headlight', 'Chrome', V(2.04, s * 0.68, 0.60), V(0.72, s * 0.32, 0.52), 0.10, 0.07, .007, n=8)
        k.fan('tail', 'Taillight', -1.70, 0.78, 0.86, s * 0.45, s * 0.78, 8, 3, off=.006)
    k.join(); k.wheels(spokes=18, spoke_w=(0.012, 0.008))

def agerars(k):        # fixed wing on posts, roof scoops on the canopy flanks
    koenigsegg(k); big_pipe(k)
    k.post_wing(-1.90, 1.22, 0.38, 1.80, -2.02, 0.42, aoa=-9,
                endplate=[(-1.84, 1.17), (-1.86, 1.31), (-2.30, 1.34), (-2.34, 1.20), (-2.16, 1.15)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# Gemera: four-seat mega-GT, 4.98 m long, 3 m wheelbase, taller cabin with a glass roof
GX = [(-2.33, -2.49), (-1.30, -1.45), (1.36, 1.55), (2.31, 2.49)]
GZ = lambda z: z + max(0.0, z - 0.85) * 0.40
TG = kx_table(GX, 0.985, GZ, canopy=0.95)
WG = dict(F=dict(x=1.55, r=0.355, w=0.265, y=0.84, rim=0.267), R=dict(x=-1.45, r=0.365, w=0.295, y=0.845, rim=0.279))
def gemera(k):
    X = lambda x: pl(GX, x)
    koenigsegg(k, TG, X, GZ, WG, cabin_l=2.0)
    k.decal('roofglass', 'Glass', 'top', X(-0.55), X(0.10), -0.40, 0.40, 12, 10, off=.005)
    big_pipe(k, z=0.80, w=0.16)
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
