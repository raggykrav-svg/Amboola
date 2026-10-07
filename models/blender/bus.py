# The AMBOOLA City Bus: a 10.5 m, 50-seat bus in AMBOOLA yellow that carries people between Tokyo and the countries.
#
#   blender -b --factory-startup --python models/blender/bus.py -- --car amboolabus [--renders DIR --sheet]
#
# A flat-sided box body with a rounded nose and tail, a big windscreen with a glowing destination sign above it, a long
# row of tinted windows, two doors on the left (kerb side in Japan), a black skirt, an air-conditioning pod on the roof
# and six big wheels' worth of presence on four (the game's wheel rig has four).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, stations, side, both, main

#        x      zb    w     zs    wb    zbl   wg    zg    wr    zr    zt
BUS = [(-5.25, 0.46, 1.08, 0.70, 1.08, 1.20, 1.06, 1.30, 0.98, 2.84, 2.92),
       (-5.16, 0.36, 1.22, 0.66, 1.23, 1.20, 1.21, 1.30, 1.13, 2.98, 3.08),
       (-4.90, 0.34, 1.25, 0.65, 1.25, 1.20, 1.24, 1.30, 1.17, 3.02, 3.12),
       (-2.00, 0.34, 1.25, 0.65, 1.25, 1.20, 1.24, 1.30, 1.17, 3.02, 3.12),
       (1.00, 0.34, 1.25, 0.65, 1.25, 1.20, 1.24, 1.30, 1.17, 3.02, 3.12),
       (4.70, 0.34, 1.25, 0.65, 1.25, 1.20, 1.24, 1.30, 1.17, 3.02, 3.12),
       (5.08, 0.36, 1.22, 0.66, 1.23, 1.20, 1.21, 1.30, 1.12, 2.98, 3.06),
       (5.25, 0.46, 1.08, 0.70, 1.08, 1.20, 1.06, 1.30, 0.96, 2.86, 2.94)]


def bus(k):
    wheels = dict(F=dict(x=3.30, r=0.50, w=0.32, y=0.98, rim=0.32, gap=0.07), R=dict(x=-2.60, r=0.50, w=0.34, y=0.98, rim=0.32, gap=0.07))
    k.loft(stations(BUS), crease_front=0.9, crease_rear=0.9, crease_lines=0.8, crisp_front=9, levels=3)
    k.arches(wheels); k.surface()
    # the window row (tinted, with black pillars), the driver's window and the two doors on the left side
    for s in (1, -1):
        k.decal('windows', 'Glass', side(s), -4.75, 4.70, 1.42, 2.68, 60, 6, off=.006)
        for x in (-3.55, -2.35, -1.15, 0.05, 1.25, 2.45):
            k.decal('pillar', 'Black', side(s), x - .05, x + .05, 1.42, 2.68, 2, 6, off=.009)
        k.decal('skirt', 'Black', side(s), -4.95, 4.95, 0.70, 0.88, 60, 2, off=.006)
    for x0, x1 in ((3.62, 4.62), (-0.55, 0.45)):
        k.decal('door', 'Glass', 'left', x0, x1, 0.70, 2.68, 8, 12, off=.011)
        k.decal('doorframe', 'Gloss', 'left', (x0 + x1) / 2 - .015, (x0 + x1) / 2 + .015, 0.70, 2.68, 1, 12, off=.014)
    # front: a tall windscreen, the glowing destination sign, lamps, a black bumper; rear: window, tail lamps, bumper
    k.decal('windscreen', 'Glass', 'front', -1.00, 1.00, 1.25, 2.50, 20, 12, off=.006)
    k.decal('destination', 'Headlight', 'front', -0.80, 0.80, 2.56, 2.74, 16, 2, off=.008)
    k.decal('rearwin', 'Glass', 'rear', -0.95, 0.95, 2.10, 2.70, 16, 6, off=.006)
    for s in (1, -1):
        k.decal('headlamp', 'Headlight', 'front', s * 0.70, s * 1.04, 0.62, 0.84, 4, 2, off=.008)
        k.decal('taillamp', 'Taillight', 'rear', s * 0.72, s * 1.04, 0.70, 1.20, 4, 4, off=.008)
    k.decal('bumperF', 'Black', 'front', -1.00, 1.00, 0.40, 0.58, 20, 2, off=.008)
    k.decal('bumperR', 'Black', 'rear', -1.00, 1.00, 0.40, 0.58, 20, 2, off=.008)
    k.decal('grille', 'Gloss', 'front', -0.55, 0.55, 0.64, 0.90, 10, 2, off=.008)
    # roof: the air-conditioning pod and an AMBOOLA light bar
    k.box('aircon', 'Paint', (-0.8, 0, 3.22), (3.0, 1.7, 0.26), bevel=0.08)
    k.box('roofbar', 'Taillight', (4.4, 0, 3.14), (0.20, 1.6, 0.08), bevel=0.02)
    k.mirrors(5.0, 1.32, 2.30, size=(0.16, 0.30, 0.42), stalk=0.20, mat='Gloss')
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.04, 0.03), caliper=(0.28, 0.09, 0.12))


CARS = {
    'amboolabus': (bus, '#f2c20f', '#d8d8d8', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'bus.py')
