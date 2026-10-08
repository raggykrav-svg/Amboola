# The AMBOOLA work trucks: a tow truck and a fire engine, for the tow and fire jobs.
#
#   blender -b --factory-startup --python models/blender/work_trucks.py -- --car all
#
# Both are boxy lofts like the bus: the tow truck has a tall cab and a low flat bed with a yellow crane boom and a
# hook, an amber light bar and a black bumper; the fire engine is a long red body with a white stripe, chrome
# lockers, a ladder on the roof and a red-and-blue light bar.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, stations, side, both, main, srgb

#        x      zb    w     zs    wb    zbl   wg    zg    wr    zr    zt
TOW = [(-3.05, 0.50, 1.04, 0.66, 1.04, 0.95, 1.02, 1.05, 0.96, 1.12, 1.14),
       (-2.95, 0.44, 1.12, 0.66, 1.12, 0.98, 1.10, 1.08, 1.04, 1.16, 1.18),
       (0.30, 0.44, 1.12, 0.66, 1.12, 0.98, 1.10, 1.08, 1.04, 1.16, 1.18),
       (0.45, 0.44, 1.12, 0.66, 1.12, 1.10, 1.10, 1.20, 1.02, 2.50, 2.56),
       (2.10, 0.44, 1.12, 0.66, 1.12, 1.10, 1.10, 1.22, 1.02, 2.46, 2.52),
       (2.40, 0.46, 1.10, 0.66, 1.10, 1.08, 1.08, 1.18, 1.00, 1.70, 1.74),
       (3.05, 0.48, 1.06, 0.66, 1.06, 1.00, 1.04, 1.10, 0.98, 1.30, 1.34),
       (3.15, 0.56, 0.96, 0.70, 0.96, 0.96, 0.94, 1.02, 0.90, 1.20, 1.22)]


def towtruck(k):
    wheels = dict(F=dict(x=2.20, r=0.45, w=0.30, y=0.92, rim=0.29, gap=0.07), R=dict(x=-1.70, r=0.45, w=0.32, y=0.92, rim=0.29, gap=0.07))
    k.loft(stations(TOW), crease_all=0.8, levels=2); k.arches(wheels); k.surface()
    k.decal('windscreen', 'Glass', 'front', -0.95, 0.95, 1.80, 2.30, 16, 6, off=.006)
    for s in (1, -1):
        k.decal('sidewin', 'Glass', side(s), 0.65, 2.0, 1.55, 2.30, 12, 6, off=.006)
        k.decal('doorline', 'Black', side(s), 0.55, 0.56, 0.55, 2.30, 1, 12, off=.004)
        k.decal('stripe', 'Black', side(s), -2.9, 2.9, 0.80, 0.92, 40, 1, off=.006)
        k.decal('headlamp', 'Headlight', 'front', s * 0.62, s * 0.98, 1.05, 1.22, 4, 2, off=.008)
        k.decal('taillamp', 'Taillight', 'rear', s * 0.70, s * 1.00, 0.70, 0.95, 3, 3, off=.008)
    k.decal('grille', 'Gloss', 'front', -0.55, 0.55, 0.78, 1.22, 10, 4, off=.008)
    k.decal('bumperF', 'Black', 'front', -1.05, 1.05, 0.46, 0.66, 20, 2, off=.008)
    # the crane: a yellow boom (the caliper colour) on the bed, a cable and a hook; the amber light bar on the cab
    k.box('boombase', 'Caliper', (-1.6, 0, 1.45), (1.2, 0.9, 0.55), bevel=0.04)
    k.box('boom', 'Caliper', (-2.4, 0, 1.95), (2.2, 0.32, 0.32), rot=(0, math.radians(22), 0), bevel=0.03)
    k.cylinder('cable', 'Black', (-3.35, 0, 1.75), 0.025, 0.9, axis='Z')
    k.box('hook', 'Chrome', (-3.35, 0, 1.25), (0.14, 0.05, 0.20), bevel=0.02)
    k.box('lightbar', 'Caliper', (1.30, 0, 2.62), (0.30, 1.50, 0.12), bevel=0.03)
    k.mirrors(2.20, 1.22, 1.85, size=(0.14, 0.24, 0.30), stalk=0.18, mat='Gloss')
    k.join(); k.wheels(spokes=8, nut='bolts', spoke_w=(0.04, 0.03), offroad=True, caliper=(0.26, 0.09, 0.10))


FIRE = [(-4.25, 0.56, 1.14, 0.72, 1.14, 1.10, 1.12, 1.20, 1.06, 2.95, 3.00),
        (-4.15, 0.48, 1.24, 0.70, 1.24, 1.10, 1.22, 1.20, 1.16, 3.05, 3.10),
        (2.80, 0.48, 1.24, 0.70, 1.24, 1.10, 1.22, 1.20, 1.16, 3.05, 3.10),
        (3.10, 0.48, 1.24, 0.70, 1.24, 1.10, 1.22, 1.22, 1.14, 2.95, 3.00),
        (4.15, 0.48, 1.22, 0.70, 1.22, 1.08, 1.20, 1.20, 1.12, 2.80, 2.86),
        (4.30, 0.56, 1.10, 0.74, 1.10, 1.04, 1.08, 1.14, 1.00, 2.60, 2.66)]


def firetruck(k):
    wheels = dict(F=dict(x=3.10, r=0.52, w=0.34, y=1.00, rim=0.33, gap=0.07), R=dict(x=-2.30, r=0.52, w=0.36, y=1.00, rim=0.33, gap=0.07))
    k.loft(stations(FIRE), crease_all=0.85, levels=2); k.arches(wheels); k.surface()
    k.M['White'] = k.material('White', srgb('#f2f2f2'), rough=0.4, coat=0.5)       # the stripe (not a lamp, so it doesn't glow)
    k.decal('windscreen', 'Glass', 'front', -1.05, 1.05, 1.60, 2.55, 16, 8, off=.006)
    for s in (1, -1):
        k.decal('cabwin', 'Glass', side(s), 3.15, 4.05, 1.60, 2.55, 8, 6, off=.006)
        k.decal('stripe', 'White', side(s), -4.1, 4.2, 1.15, 1.30, 40, 1, off=.006)
        for x0 in (-3.8, -2.4, -1.0, 0.4, 1.8):
            k.decal('locker', 'Chrome', side(s), x0, x0 + 1.25, 1.40, 2.80, 6, 8, off=.007)
            for z in (1.7, 2.0, 2.3, 2.6): k.decal('shutter', 'Gloss', side(s), x0 + .03, x0 + 1.22, z, z + .012, 6, 1, off=.010)
        k.decal('headlamp', 'Headlight', 'front', s * 0.70, s * 1.05, 0.95, 1.15, 4, 2, off=.008)
        k.decal('taillamp', 'Taillight', 'rear', s * 0.80, s * 1.10, 0.80, 1.10, 3, 3, off=.008)
    k.decal('grille', 'Chrome', 'front', -0.60, 0.60, 0.75, 1.40, 10, 4, off=.008)
    k.decal('bumperF', 'Chrome', 'front', -1.15, 1.15, 0.48, 0.70, 20, 2, off=.008)
    # the ladder on the roof (two rails and rungs) and the light bar
    for s in (1, -1): k.box('ladderrail', 'Chrome', (-0.6, s * 0.40, 3.30), (6.2, 0.06, 0.10))
    for i in range(16): k.box('rung', 'Chrome', (-3.6 + i * 0.4, 0, 3.30), (0.04, 0.80, 0.04))
    k.box('ladderbase', 'Black', (2.4, 0, 3.20), (0.6, 1.0, 0.25), bevel=0.03)
    for s, mat in ((1, 'Taillight'), (-1, 'Headlight')): k.box('lightbar', mat, (3.70, s * 0.40, 3.08), (0.30, 0.75, 0.14), bevel=0.03)
    k.mirrors(4.05, 1.36, 2.20, size=(0.16, 0.28, 0.40), stalk=0.20, mat='Chrome')
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.04, 0.03), caliper=(0.28, 0.09, 0.12))


CARS = {
    'towtruck': (towtruck, '#eceeed', '#d8d8d8', '#f2a20f'),
    'firetruck': (firetruck, '#c8141b', '#d8d8d8', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'work_trucks.py')
