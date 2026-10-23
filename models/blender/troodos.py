# The AMBOOLA Troodos 4x4: the off-road truck of the Troodos Hill Climb in Cyprus.
#
#   blender -b --factory-startup --python models/blender/troodos.py -- --car troodos
#
# A boxy, lifted rock crawler on 35-inch mud tyres: short overhangs for steep climbs, a tubular bull bar with a winch,
# rock sliders, wide fender flares, a snorkel up the A-pillar, a roof basket with four spot lights and an LED bar,
# a spare wheel on the tailgate and red tow hooks.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, stations, both, side, main

# x, zb, w, zs, wb, zbl, wg, zg, wr, zr, zt   (front axle x=1.50, rear axle x=-1.40)
TT = [( 2.44, 0.66, 0.90, 0.82, 0.90, 0.98, 0.86, 1.10, 0.78, 1.15, 1.16),
      ( 2.36, 0.58, 0.98, 0.84, 0.98, 1.06, 0.94, 1.20, 0.86, 1.25, 1.26),
      ( 1.50, 0.56, 1.00, 0.86, 1.00, 1.10, 0.96, 1.25, 0.88, 1.31, 1.33),
      ( 0.86, 0.56, 1.00, 0.86, 1.00, 1.12, 0.96, 1.27, 0.86, 1.37, 1.41),
      ( 0.56, 0.56, 1.00, 0.86, 1.00, 1.13, 0.95, 1.29, 0.85, 1.92, 1.96),
      (-1.00, 0.56, 1.00, 0.86, 1.00, 1.13, 0.95, 1.29, 0.86, 1.96, 2.00),
      (-2.28, 0.60, 0.99, 0.86, 0.99, 1.13, 0.95, 1.29, 0.85, 1.93, 1.96),
      (-2.42, 0.68, 0.92, 0.84, 0.92, 1.08, 0.88, 1.24, 0.80, 1.86, 1.88)]
WT = dict(F=dict(x=1.50, r=0.465, w=0.33, y=0.90, rim=0.229, gap=0.08), R=dict(x=-1.40, r=0.465, w=0.33, y=0.90, rim=0.229, gap=0.08))

def troodos(k):
    k.loft(stations(TT), crease_all=0.8, levels=2)
    k.arches(WT); k.surface()
    # glass: a near-upright windscreen, long side windows split by B and C pillars, a square tailgate window
    k.decal('windscreen', 'Glass', 'front', -0.80, 0.80, 1.42, 1.86, 16, 8, off=.006)
    for s in (1, -1):
        k.decal('sideglass', 'Glass', side(s), -2.12, 0.50, 1.33, 1.84, 30, 6, off=.006)
        for x in (-0.36, -1.40): k.decal('pillar', 'Gloss', side(s), x - .06, x + .06, 1.33, 1.84, 2, 6, off=.009)
        for x in (0.62, -0.38): k.decal('doorline', 'Black', side(s), x - .004, x + .004, 0.62, 1.28, 1, 12, off=.002)
        k.decal('handle', 'Black', side(s), 0.30, 0.44, 1.14, 1.165, 4, 1, off=.004)
        k.decal('handle', 'Black', side(s), -0.70, -0.56, 1.14, 1.165, 4, 1, off=.004)
        k.decal('stripe', 'Black', side(s), -2.30, 2.30, 0.92, 0.99, 40, 1, off=.005)     # a black band along the doors
        # rock sliders and a side step under the doors
        k.box('slider', 'Black', (-0.45, s * 0.96, 0.60), (2.30, 0.10, 0.08), bevel=0.02)
        k.box('step', 'Gloss', (-0.45, s * 1.02, 0.66), (1.90, 0.12, 0.03), bevel=0.01)
        # round headlights and square indicators in a black face
        k.oval('lampring', 'Chrome', V(2.40, s * 0.70, 1.04), V(1, 0, 0), .12, .12, .008, ring=.78)
        k.oval('lamp', 'Headlight', V(2.40, s * 0.70, 1.04), V(1, 0, 0), .10, .10, .010, n=6)
        k.box('indicator', 'Taillight', (2.43, s * 0.86, 0.92), (0.03, 0.10, 0.06), bevel=0.005)
        k.decal('taillamp', 'Taillight', 'rear', s * 0.76, s * 0.94, 1.00, 1.30, 3, 6, off=.008)
    k.decal('grille', 'Gloss', 'front', -0.46, 0.46, 0.88, 1.18, 12, 4, off=.008)
    for i in range(1, 7):
        y = lerp(-0.44, 0.44, i / 7)
        k.decal('slat', 'Black', 'front', y - .02, y + .02, 0.90, 1.16, 1, 6, off=.011)
    k.decal('rearwin', 'Glass', 'rear', -0.70, 0.70, 1.40, 1.80, 12, 6, off=.006)
    # the tubular bull bar with a winch, a skid plate and red tow hooks
    for s in (1, -1):
        k.box('bullpost', 'Black', (2.58, s * 0.48, 0.86), (0.06, 0.06, 0.50), bevel=0.015)
        k.box('towhook', 'Accent', (2.56, s * 0.62, 0.60), (0.10, 0.04, 0.07), bevel=0.01)
    k.box('bullbar', 'Black', (2.58, 0, 1.10), (0.06, 1.10, 0.06), bevel=0.015)
    k.box('bullbar', 'Black', (2.56, 0, 0.72), (0.10, 1.70, 0.16), bevel=0.02)
    k.box('winch', 'Gloss', (2.62, 0, 0.74), (0.14, 0.46, 0.14), bevel=0.02)
    k.box('skid', 'Titanium', (2.20, 0, 0.52), (0.70, 1.30, 0.04), rot=(0, math.radians(-14), 0), bevel=0.01)
    k.box('rearbumper', 'Black', (-2.48, 0, 0.72), (0.14, 1.85, 0.16), bevel=0.02)
    both(lambda s: k.box('towhook', 'Accent', (-2.56, s * 0.50, 0.70), (0.10, 0.04, 0.07), bevel=0.01))
    # the snorkel up the passenger-side A-pillar, and the roof basket with an LED bar and spot lights
    k.cylinder('snorkel', 'Black', (0.86, 1.04, 1.40), 0.055, 0.70, axis='Z')
    k.box('snorkelhead', 'Black', (0.92, 1.04, 1.80), (0.20, 0.12, 0.12), bevel=0.02)
    k.roof_rack(-1.90, 0.30, 0.78, 2.10, lights=4)
    k.box('ledbar', 'Black', (0.50, 0, 2.02), (0.10, 1.30, 0.08), bevel=0.015)
    k.box('ledbarlens', 'Headlight', (0.556, 0, 2.02), (0.01, 1.22, 0.05))
    # the spare wheel on the tailgate
    k.cylinder('spare', 'Tire', (-2.60, 0.0, 1.30), 0.44, 0.26, axis='X')
    k.cylinder('sparehub', 'Rim', (-2.74, 0.0, 1.30), 0.24, 0.02, axis='X')
    k.arch_trim(0.11, mat='Black')
    k.mirrors(0.70, 1.08, 1.46, size=(0.14, 0.22, 0.14), mat='Black')
    k.exhaust(0.70, 0.66, r=0.045, mirror=False)
    k.join(); k.wheels(spokes=6, nut='bolts', offroad=True, spoke_w=(0.045, 0.032))

CARS = {'troodos': (troodos, '#e8742a', '#1b1b1d', '#c8141b')}
if __name__ == '__main__': main(CARS, 'troodos.py')
