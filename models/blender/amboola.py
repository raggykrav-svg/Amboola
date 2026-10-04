# The AMBOOLA Mega Taxi: the game's own car company, from a drawing by the game's creator.
#
#   blender -b --factory-startup --python models/blender/amboola.py -- --car all
#
# A 6.6 m stretched taxi wagon with 20 seats. It has a taxi sign on the roof with a red spiky crest and two little
# horns, a tall rear fin with red spikes, a long black stripe down each side, light-blue paint and red-spoked wheels.
# The red tiger stripes and the AMBOOLA lettering are painted on in the game (decal livery), so they follow the
# player's paint colour choices.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import remap, SHARP
from porsches import TCAY_SUV
from teslas import glass
from toyota import CAY_WS

TOP = [(0.85, 1.13), (0.60, 1.30), (0.30, 1.55), (-0.30, 1.60), (-1.20, 1.60), (-1.70, 1.55), (-1.95, 1.40), (-2.02, 1.20)]
BOT = [(0.85, 1.12), (-0.60, 1.13), (-1.60, 1.15), (-2.02, 1.17)]
RW = (-2.30, -1.95, 1.22, 0.94, 0.52, 0.58)

def megataxi(k):
    zf = lambda z: z * 1.05 + 0.06
    xs = [(-2.48, -3.30), (-1.40, -2.30), (1.50, 1.70), (2.46, 3.30)]
    X = lambda x: pl(xs, x)
    wheels = dict(F=dict(x=1.70, r=0.39, w=0.26, y=0.86, rim=0.254, gap=0.07), R=dict(x=-2.30, r=0.39, w=0.27, y=0.86, rim=0.254, gap=0.07))
    k.loft(stations(remap(TCAY_SUV, xs, 1.0, zf)), **SHARP); k.arches(wheels); k.surface()
    pillars = [0.25, -0.35, -0.95, -1.45]                     # four doors a side: a long row of windows for 20 people
    glass(k, X, zf, CAY_WS, RW, TOP, BOT, pillars=pillars)
    for s in (1, -1):
        for xg in (0.86,) + tuple(p - .02 for p in pillars): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, zf(0.30), zf(1.13), 1, 14, off=.002)
        k.decal('stripe', 'Gloss', side(s), X(-1.85), X(0.95), zf(0.70), zf(0.80), 40, 2, off=.005)   # the long black side stripe
    k.arch_trim(0.06, mat='Gloss')
    k.mirrors(X(0.80), 1.06, zf(1.20), size=(0.14, 0.19, 0.10))
    k.interior(X(-0.60), 1.40, zf(0.98), l=4.0, h=0.42, seats_x=X(-0.20), seat_z=zf(1.06))
    # friendly face: wide lamps, a big grille with an AMBOOLA bar
    k.lamp((3.17, 0.72, zf(0.84)), (0.80, 0.25, 0.30), 0.30, 0.12, 'quad', slant=0.02)
    k.decal('grille', 'Gloss', 'front', -0.55, 0.55, zf(0.42), zf(0.74), 18, 6)
    for i in range(4): k.decal('bar', 'Chrome', 'front', -0.53, 0.53, zf(0.46) + i * .07, zf(0.46) + i * .07 + .016, 18, 1, off=.009)
    k.decal('skid', 'Black', 'front', -0.62, 0.62, zf(0.24), zf(0.34), 18, 2, off=.006)
    both(lambda s: k.decal('cladding', 'Black', side(s), X(-1.00), X(1.05), zf(0.22), zf(0.34), 40, 3, off=.006))
    k.tail_clusters(X(-1.95), zf(0.95), zf(1.12), 0.60, 0.86)
    k.fan('rearbumper', 'Black', X(-1.95), zf(0.30), zf(0.46), -0.66, 0.66, 30, 3)
    # the roof taxi sign with its red crest and two horns
    roof = k.deck_z(X(-0.20), 0.0)
    k.box('sign', 'Gloss', (X(-0.20), 0, roof + 0.16), (0.95, 0.42, 0.30), bevel=0.04)
    for s in (1, -1): k.box('signlight', 'Headlight', (X(-0.20) + s * 0.478, 0, roof + 0.16), (0.012, 0.36, 0.20))
    for i in range(9):
        x = X(-0.20) - 0.40 + i * 0.10; h = 0.10 + 0.08 * math.sin(i / 8 * math.pi)
        k.cylinder('crest', 'Taillight', (x, 0, roof + 0.31 + h / 2), 0.035, h, axis='Z', segs=8, r2=0.002)
    for s in (1, -1): k.cylinder('horn', 'Taillight', (X(-0.20) + 0.42, s * 0.17, roof + 0.40), 0.03, 0.18, axis='Z', segs=8, r2=0.004)
    # tall rear fin on two posts, red spikes along its top edge
    fin_x, fin_z = X(-1.95), k.deck_z(X(-1.95), 0.0)
    k.post_wing(fin_x + 0.10, fin_z + 0.50, 0.42, 1.70, fin_x + 0.15, 0.45, aoa=-10, mat='Gloss',
                endplate=[(fin_x + 0.14, fin_z + 0.46), (fin_x + 0.15, fin_z + 0.66), (fin_x - 0.32, fin_z + 0.70), (fin_x - 0.34, fin_z + 0.50)])
    for i in range(11):
        y = -0.80 + i * 0.16
        k.cylinder('finspike', 'Taillight', (fin_x - 0.12, y, fin_z + 0.62 + 0.07), 0.03, 0.14, axis='Z', segs=6, r2=0.002)
    k.join(); k.wheels(spokes=8, nut='bolts', spoke_w=(0.03, 0.022), caliper=(0.24, 0.085, 0.10))

CARS = {
    'amboolataxi': (megataxi, '#7cc8e8', '#c8141b', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'amboola.py')
