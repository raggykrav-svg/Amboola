# McLaren and Bugatti models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/hypercars.py -- --car all
#   blender -b --factory-startup --python models/blender/hypercars.py -- --car senna --renders DIR --sheet --samples 8
#
# Both families reuse the Ferrari mid-engine station table (supercars.TFER) remapped to their own wheelbase, length,
# width and height; the glasshouse is remapped the same way.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap, SOFT, SHARP

def glasshouse(k, X, Z, hw=1.0, rear=True):
    """the Ferrari mid-engine glass (windscreen, side windows, small rear window) moved through x/z maps"""
    bx, bz, tx = 0.85, 0.86, 0.20; tz = bz + (bx - tx) * 0.45
    k.windscreen(X(bx), X(tx), Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), 0.62 * hw, 0.50 * hw, sweep=0.24)
    k.side_glass([(X(x), Z(z)) for x, z in [(0.70, 0.86), (0.45, 0.98), (0.15, 1.12), (-0.25, 1.16), (-0.65, 1.10), (-1.0, 0.98)]],
                 [(X(x), Z(z)) for x, z in [(0.70, 0.855), (-0.30, 0.87), (-1.0, 0.95)]])
    if rear: k.rear_window(X(-1.20), X(-0.82), Z(0.99), 0.30, 0.38 * hw, 0.42 * hw, bulge=0.02)

# ======================================================================= McLaren
# front axle x=1.38, rear axle x=-1.29, 4.57 m long, 1.93 m wide, 1.20 m tall; narrow teardrop cabin
MX = [(-2.33, -2.31), (-1.30, -1.29), (1.36, 1.38), (2.31, 2.30)]
def mx(x): return pl(MX, x)
TMCL = [r[:8] + (r[8] * (0.9 if -0.7 < r[0] < 0.8 else 1.0),) + r[9:] for r in remap(TFER, MX, ys=0.975)]
WMCL = dict(F=dict(x=1.38, r=0.335, w=0.245, y=0.81, rim=0.254), R=dict(x=-1.29, r=0.35, w=0.305, y=0.815, rim=0.267))

def mclaren(k, rows=TMCL, tail='bar'):
    k.loft(stations(rows), crease_lines=0.45, crisp_front=-9, crisp=0.35, crease_front=0.55, crease_rear=0.8)
    k.arches(WMCL); k.surface()
    glasshouse(k, mx, lambda z: z, hw=0.95)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), mx(0.70) - .004, mx(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
        # the signature intake scooped into the door, ahead of the rear wheel
        k.slanted('doorscoop', 'Gloss', s, mx(-0.35), mx(-0.95), 0.42, 0.82, lean=0.18, nu=8, nv=8)
        k.decal('skirt', 'Carbon', side(s), mx(-0.95), mx(1.00), 0.13, 0.20, 30, 2)
    # "eye socket" headlights: tapered housing with an intake underneath
    k.headlight_quad((2.06, 0.66, 0.62), (0.72, 0.32, 0.52), 0.26, 0.10, slant=0.04, taper=0.35, dots='row')
    both(lambda s: k.decal('socket', 'Gloss', 'front', s * 0.52, s * 0.78, 0.30, 0.44, 8, 4))
    k.decal('intakeC', 'Gloss', 'front', -0.40, 0.40, 0.20, 0.32, 16, 4)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.15, 0.19, 30, 2)
    if tail == 'bar': k.light_bar(-1.70, 0.83, 0.87, 0.80, bg=0.015, frac=0.6)
    k.tail_clusters(-1.70, 0.80, 0.89, 0.55, 0.82)
    k.fan('rearbg', 'Gloss', -1.70, 0.46, 0.70, -0.62, 0.62, 30, 4, off=.003)
    k.fan('diffuser', 'Carbon', -1.70, 0.28, 0.46, -0.70, 0.70, 30, 3)
    k.mirrors(mx(0.62), 1.04, 0.93, size=(0.14, 0.18, 0.08))
    k.interior(-0.20, 1.22, 0.64, h=0.32, seats_x=-0.42, seat_z=0.74)

def w1(k):
    mclaren(k)
    k.exhaust(0.0, 0.82, r=0.06, mirror=False)                                   # high centre pipe
    k.spoiler(-2.05, 1.06, 0.34, 1.62, aoa=-10, mat='Carbon', strut_y=0.50)      # long active wing
    k.naca(1.30, 1.70, 0.18, 0.03, 0.14)
    k.join(); k.wheels(spokes=10, nut='bolts')

def senna(k):
    mclaren(k, tail='clusters')
    for y in (-0.08, 0.0, 0.08): k.exhaust(y, 0.86, r=0.04, mirror=False)        # three high pipes
    k.post_wing(-1.86, 1.36, 0.38, 1.70, -2.02, 0.32, aoa=-12,
                endplate=[(-1.80, 1.30), (-1.82, 1.46), (-2.26, 1.50), (-2.30, 1.34), (-2.14, 1.28)])
    k.wing(-2.15, 1.44, 0.18, 1.70, aoa=-24, thick=0.10, mat='Carbon', name='flap')
    for s in (1, -1): k.decal('doorglass', 'Glass', side(s), mx(0.55), mx(0.15), 0.50, 0.78, 6, 4, off=.006)   # glass door panels
    k.join(); k.wheels(spokes=10)

def p1(k):
    mclaren(k)
    for s in (1, -1): k.exhaust(s * 0.09, 0.78, r=0.07, mirror=False)            # two big centre pipes
    k.spoiler(-1.98, 1.10, 0.36, 1.66, aoa=-12, mat='Carbon', strut_y=0.46)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

def lt765(k):
    rows = edit(edit(TMCL, TMCL[-2][0], zt=.98, zr=.975, zg=.965), TMCL[-1][0], zt=.99, zr=.985, zg=.96, zbl=.90)   # longtail lip
    mclaren(k, rows)
    for y in (-0.15, -0.05, 0.05, 0.15): k.exhaust(y, 0.60, r=0.04, mirror=False)    # quad centre pipes
    k.spoiler(-2.02, 1.03, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.42)
    k.join(); k.wheels(spokes=10)

def s750(k):
    mclaren(k)
    for s in (1, -1): k.exhaust(s * 0.10, 0.60, r=0.05, mirror=False)
    k.spoiler(-2.08, 1.01, 0.26, 1.50, aoa=-6, mat='Paint', strut_y=0.40)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

def artura(k):
    rows = edit(TMCL, TMCL[-1][0], zt=.95, zr=.945, zg=.93)
    mclaren(k, rows)
    k.exhaust(0.0, 0.84, r=0.065, mirror=False)                                  # single high centre pipe
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

def gts(k):
    # the grand tourer: longer glass hatch over the luggage bay, no wing, outboard pipes
    rows = [r if r[0] > -0.9 else r[:10] + (r[10] + 0.04,) for r in TMCL]
    mclaren(k, rows)
    k.rear_window(mx(-1.95), mx(-0.95), 1.0, 0.18, 0.40, 0.44, bulge=0.02)
    for s in (1, -1): k.exhaust(s * 0.56, 0.44, r=0.045, mirror=False)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ======================================================================= Bugatti
# front axle x=1.40, rear axle x=-1.31, 4.54 m long, 2.04 m wide, 1.21 m tall
BX = [(-2.33, -2.28), (-1.30, -1.31), (1.36, 1.40), (2.31, 2.27)]
def bx(x): return pl(BX, x)
bz = lambda z: z + max(0.0, z - 0.85) * 0.1
TBUG = remap(TFER, BX, ys=1.03, zf=bz)
WBUG = dict(F=dict(x=1.40, r=0.35, w=0.285, y=0.86, rim=0.254), R=dict(x=-1.31, r=0.37, w=0.355, y=0.865, rim=0.267))

def horseshoe(k, z=0.40, s=1.0):
    k.oval('horseshoe_in', 'Black', (2.27, 0, z), (1, 0, 0.1), 0.12 * s, 0.16 * s, .006, n=8)
    k.oval('horseshoe', 'Chrome', (2.27, 0, z), (1, 0, 0.1), 0.15 * s, 0.19 * s, .008, ring=0.8)

def c_line(k, cx=-0.30, cz=0.60, r=0.36, mat='Chrome'):
    """Bugatti's C-shaped side sweep, with a dark intake inside it"""
    for s in (1, -1):
        k.project('cline', mat, lambda u, v, s=s: k.VIEW[side(s)](cx + math.cos(lerp(-1.75, 1.75, u)) * (r + v * .045),
                                                                    cz + math.sin(lerp(-1.75, 1.75, u)) * (r + v * .045) * 1.05), 40, 2, off=.006)
        k.slanted('cintake', 'Gloss', s, cx + r * .75, cx + r * .05, cz - r * .6, cz + r * .6, lean=-0.05, nu=6, nv=6)

def bugatti(k, rows=TBUG, wheels=WBUG, Z=bz, X=bx):
    k.loft(stations(rows), crease_lines=0.3, crisp_front=-9, crisp=0.25, crease_front=0.5, crease_rear=0.8)
    k.arches(wheels); k.surface()
    glasshouse(k, X, Z, hw=1.0, rear=False)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), X(0.70) - .004, X(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
        k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.13, 0.20, 30, 2)
    k.decal('spine', 'Chrome', 'top', X(-1.30), X(0.20), -0.012, 0.012, 20, 1, off=.006)     # centre spine over the roof
    k.headlight_quad((2.10, 0.70, 0.62), (0.72, 0.30, 0.52), 0.22, 0.08, slant=0.03)        # four-point lights
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.30, s * 0.80, 0.18, 0.36, 12, 4))
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.14, 0.18, 30, 2)
    k.fan('rearbg', 'Gloss', -1.70, 0.40, 0.72, -0.64, 0.64, 30, 5, off=.003)
    k.fan('diffuser', 'Carbon', -1.70, 0.26, 0.40, -0.72, 0.72, 30, 3)
    k.mirrors(X(0.62), 1.10, 0.95, size=(0.14, 0.18, 0.08))
    k.interior(-0.20, 1.28, 0.66, h=0.32, seats_x=-0.42, seat_z=0.76)

def quad_pipes(k, z=0.54):
    for y in (-0.15, -0.05, 0.05, 0.15): k.exhaust(y, z, r=0.042, mirror=False)

def chiron(k, wing):
    bugatti(k); horseshoe(k); c_line(k)
    k.light_bar(-1.70, 0.845, 0.875, 0.82, bg=0.02, frac=0.6)                    # the long thin LED bar
    quad_pipes(k); wing(k)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

def chironss(k):
    chiron(k, lambda k: k.spoiler(-2.00, 1.05, 0.30, 1.50, aoa=-4, mat='Carbon', strut_y=0.40))

def chironps(k):
    chiron(k, lambda k: k.post_wing(-1.86, 1.24, 0.34, 1.86, -2.00, 0.42, aoa=-8,
                                    endplate=[(-1.80, 1.19), (-1.82, 1.32), (-2.24, 1.35), (-2.28, 1.22), (-2.12, 1.17)]))

def divo(k):
    def wing(k):
        k.post_wing(-1.84, 1.20, 0.40, 1.92, -1.96, 0.46, aoa=-8, endplate=[(-1.78, 1.15), (-1.80, 1.28), (-2.28, 1.32), (-2.32, 1.18), (-2.14, 1.13)])
        k.pod('fin', 'Paint', [(-0.55, 0.0, 1.20, 0.01, 0.01), (-0.80, 0.0, 1.17, 0.012, 0.06), (-1.70, 0.0, 1.05, 0.012, 0.05)], mirror=False, sub=1)
    bugatti(k); horseshoe(k); c_line(k, mat='Carbon')
    for i in range(8):   # Divo's vertical tail-light fins
        k.fan('fin', 'Taillight', -1.70, 0.72, 0.92, -0.70 + i * 0.2, -0.66 + i * 0.2, 2, 4, off=.006)
    quad_pipes(k); wing(k)
    k.join(); k.wheels(spokes=10, nut='bolts')

def tourbillon(k):
    bugatti(k); horseshoe(k, s=1.1); c_line(k, cx=-0.25, r=0.40)
    k.light_bar(-1.70, 0.80, 0.86, 0.82, bg=0.03, frac=0.35)
    k.fan('diffusercore', 'Carbon', -1.70, 0.34, 0.60, -0.40, 0.40, 20, 4, off=.006)   # huge exposed diffuser
    k.exhaust(0.0, 0.70, r=0.05, mirror=False)
    k.spoiler(-2.02, 1.06, 0.30, 1.56, aoa=-5, mat='Paint', strut_y=0.42)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.028, 0.018))

def veyronss(k):
    bugatti(k); horseshoe(k, z=0.38, s=0.95); c_line(k, cx=-0.32, r=0.33, mat='Carbon')
    for s in (1, -1):   # round twin tail lights and the roof air scoops
        for y in (0.55, 0.75): k.oval('tailround', 'Taillight', V(-2.10, s * y, 0.82), V(-1, s * 0.3 * y, 0.1), 0.055, 0.055, .006, n=6)
        k.pod('scoop', 'Carbon', [(-0.55, 0.30, 1.13, 0.05, 0.03), (-0.75, 0.30, 1.18, 0.12, 0.09), (-1.20, 0.30, 1.12, 0.12, 0.06)], mirror=False, flat=0.6) if s > 0 else None
    k.pod('scoop', 'Carbon', [(-0.55, -0.30, 1.13, 0.05, 0.03), (-0.75, -0.30, 1.18, 0.12, 0.09), (-1.20, -0.30, 1.12, 0.12, 0.06)], mirror=False, flat=0.6)
    k.exhaust(0.0, 0.48, r=0.07, mirror=False)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- Bolide: 1 m tall track car - tiny canopy, X lights, roof scoop, shark fin, huge wing
OX = [(-2.33, -2.38), (-1.30, -1.30), (1.36, 1.45), (2.31, 2.38)]
def ox(x): return pl(OX, x)
oz = lambda z: z if z < 0.80 else 0.80 + (z - 0.80) * 0.55
TBOL = remap(TFER, OX, ys=1.0, zf=oz)
WBOL = dict(F=dict(x=1.45, r=0.33, w=0.27, y=0.86, rim=0.254), R=dict(x=-1.30, r=0.35, w=0.34, y=0.86, rim=0.254))
def bolide(k):
    bugatti(k, TBOL, WBOL, oz, ox); horseshoe(k, z=0.36, s=0.9)
    for s in (1, -1):   # X-shaped lights front and rear
        for a in (0.6, -0.6):
            k.rect('xlight', 'Headlight', V(2.10, s * 0.62, 0.55), V(0.75, s * 0.25, 0.45), 0.18, 0.02, .010, nu=6, nv=1, slant=a * 0.10 * s)
            k.fan('xtail', 'Taillight', -1.70, 0.70, 0.74, s * (0.55 + a * .1), s * (0.75 - a * .1), 6, 2, off=.006)
    k.pod('roofscoop', 'Carbon', [(0.10, 0, 0.98, 0.04, 0.02), (0.0, 0, 1.06, 0.14, 0.07), (-0.60, 0, 1.03, 0.14, 0.05), (-1.0, 0, 0.95, 0.08, 0.02)], mirror=False, flat=0.7)
    k.pod('fin', 'Carbon', [(-0.90, 0.0, 0.98, 0.01, 0.01), (-1.20, 0.0, 1.00, 0.012, 0.10), (-2.10, 0.0, 0.95, 0.012, 0.08)], mirror=False, sub=1)
    k.post_wing(-1.92, 1.16, 0.40, 1.90, -2.05, 0.40, aoa=-12, endplate=[(-1.86, 1.10), (-1.88, 1.26), (-2.34, 1.30), (-2.38, 1.14), (-2.20, 1.08)])
    quad_pipes(k, z=0.50)
    k.join(); k.wheels(spokes=10)

# ======================================================================= registry
CARS = {
    'w1': (w1, '#ff7a00', '#1b1b1d', '#1b1b1d'),
    'senna': (senna, '#1f4fa8', '#1b1b1d', '#1b1b1d'),
    'p1': (p1, '#f2c20f', '#1b1b1d', '#1b1b1d'),
    '765lt': (lt765, '#ff7a00', '#1b1b1d', '#1b1b1d'),
    '750s': (s750, '#1f4fa8', '#2a2b2e', '#1b1b1d'),
    'artura': (artura, '#c4c8cc', '#2a2b2e', '#1b1b1d'),
    'gts': (gts, '#16295c', '#9da1a6', '#1b1b1d'),
    'tourbillon': (tourbillon, '#173a8c', '#1b1b1d', '#173a8c'),
    'chironss': (chironss, '#0b0b0d', '#1b1b1d', '#ff7a00'),
    'chironps': (chironps, '#173a8c', '#1b1b1d', '#1b1b1d'),
    'divo': (divo, '#c4c8cc', '#1b1b1d', '#173a8c'),
    'veyronss': (veyronss, '#2c3a2b', '#9da1a6', '#1b1b1d'),
    'bolide': (bolide, '#173a8c', '#1b1b1d', '#1b1b1d'),
}

if __name__ == '__main__':
    main(CARS, 'hypercars.py')
