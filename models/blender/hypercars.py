# McLaren and Bugatti models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/hypercars.py -- --car all
#   blender -b --factory-startup --python models/blender/hypercars.py -- --car senna --renders DIR --sheet --samples 8
#
# Each family has one outline drawn from its real cars (carshape.build) that carshape.scaled stretches to every model's
# own length, width, height, wheelbase and front overhang. glasshouse() is the old remapped-Ferrari glass, still used
# by a few other brands' scripts.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap, SOFT, SHARP
from carshape import build, scaled

def glasshouse(k, X, Z, hw=1.0, rear=True):
    """the Ferrari mid-engine glass (windscreen, side windows, small rear window) moved through x/z maps"""
    bx, bz, tx = 0.85, 0.86, 0.20; tz = bz + (bx - tx) * 0.45
    k.windscreen(X(bx), X(tx), Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), 0.62 * hw, 0.50 * hw, sweep=0.24)
    k.side_glass([(X(x), Z(z)) for x, z in [(0.70, 0.86), (0.45, 0.98), (0.15, 1.12), (-0.25, 1.16), (-0.65, 1.10), (-1.0, 0.98)]],
                 [(X(x), Z(z)) for x, z in [(0.70, 0.855), (-0.30, 0.87), (-1.0, 0.95)]])
    if rear: k.rear_window(X(-1.20), X(-0.82), Z(0.99), 0.30, 0.38 * hw, 0.42 * hw, bulge=0.02)

# ======================================================================= McLaren
# 750S: 4.57 x 1.93 x 1.20 m, 2.67 m wheelbase. A low nose with "eye socket" headlights over intakes, a narrow
# teardrop cabin on a wide body, the dihedral door with a deep scoop ahead of the rear wheel, thin C-shaped tail lights
# over a black mesh tail.
P750 = dict(L=4.569, W=1.930, H=1.196, WB=2.67, fo=1.03, clear=0.11, nose_zb=0.22, tail_zb=0.40,
            top=[(2.365, 0.46), (2.27, 0.54), (2.0, 0.61), (1.6, 0.68), (1.25, 0.76), (0.95, 0.82), (0.5, 1.01), (0.1, 1.17),
                 (-0.2, 1.196), (-0.6, 1.15), (-0.95, 1.06), (-1.5, 1.02), (-2.0, 1.0), (-2.204, 0.94)],
            belt=[(2.365, 0.44), (2.1, 0.60), (1.6, 0.74), (1.0, 0.82), (0.4, 0.84), (-0.4, 0.87), (-1.0, 0.95), (-1.6, 0.99),
                  (-2.1, 0.97), (-2.204, 0.88)],
            plan=[(2.365, 0.40), (2.27, 0.66), (2.0, 0.86), (1.335, 0.955), (0.6, 0.92), (0.0, 0.915), (-0.7, 0.95), (-1.335, 0.965),
                  (-1.9, 0.94), (-2.15, 0.86), (-2.204, 0.78)],
            roof=[(0.95, 0.62), (0.4, 0.56), (-0.2, 0.50), (-0.6, 0.44), (-0.95, 0.36)],
            cab=(0.95, 0.10, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.06), (2.0, 0.05)], hip=0.05, side=(0.88, -0.85),
            doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0)
WMCL = (dict(r=0.335, w=0.245, rim=0.254), dict(r=0.35, w=0.305, rim=0.267))

def mclaren(k, P, wheels=WMCL, tail='bar'):
    S = build(k, P, *wheels, crease=dict(crease_lines=0.45, crisp_front=-9, crisp=0.35, crease_front=0.55, crease_rear=0.8))
    xn, xt = S.nose, S.tail
    for s in (1, -1):
        k.slanted('doorscoop', 'Gloss', s, -0.30, -0.95, 0.40, 0.82, lean=0.2, nu=8, nv=8, off=.006)   # the door scoop
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
    # "eye socket" headlights: a tapered housing with an intake in the bottom of it
    k.headlight_quad((xn - 0.28, 0.66, 0.60), (0.66, 0.34, 0.52), 0.26, 0.09, slant=0.04, taper=0.35, dots='row')
    both(lambda s: k.decal('socket', 'Gloss', 'front', s * 0.52, s * 0.80, 0.28, 0.44, 8, 4))
    k.decal('intakeC', 'Gloss', 'front', -0.40, 0.40, 0.18, 0.30, 16, 4)
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.12, 0.17, 30, 2)
    if tail == 'bar': k.light_bar(-1.7, 0.86, 0.89, 0.80, bg=0.015, frac=0.6)
    for s in (1, -1): k.fan('tailC', 'Taillight', -1.7, 0.74, 0.90, s * 0.78, s * 0.86, 3, 5, off=.007)
    k.fan('rearbg', 'Gloss', -1.7, 0.44, 0.74, -0.66, 0.66, 30, 4, off=.003)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.44, -0.70, 0.70, 30, 3)
    return S

# ---- W1: 4.64 x 2.07 x 1.18 m, 2.68 m wheelbase. Ground-effect body, huge front aero, the active long-tail wing
P_W1 = scaled(P750, L=4.635, W=2.074, H=1.182, WB=2.68, fo=1.06)
def w1(k):
    S = mclaren(k, P_W1, (dict(r=0.335, w=0.265, rim=0.254), dict(r=0.355, w=0.335, rim=0.267)))
    k.decal('nosechannel', 'Gloss', 'top', S.nose - 0.75, S.nose - 0.25, -0.14, 0.14, 6, 4)
    k.exhaust(0.0, 0.84, r=0.06, mirror=False)                                   # high centre pipe
    k.spoiler(S.tail + 0.12, 1.06, 0.40, 1.66, aoa=-10, mat='Carbon', strut_y=0.50)  # the long active wing
    k.join(); k.wheels(spokes=10, nut='bolts')

# ---- Senna: 4.74 x 1.96 x 1.23 m. Glass panels in the doors, a roof snorkel, three high pipes and the giant wing
P_SENNA = scaled(P750, L=4.744, W=1.958, H=1.229, WB=2.67, fo=1.10)
def senna(k):
    S = mclaren(k, P_SENNA, tail='clusters')
    for y in (-0.08, 0.0, 0.08): k.exhaust(y, 0.88, r=0.04, mirror=False)
    k.pod('snorkel', 'Carbon', [(0.10, 0, 1.20, 0.04, 0.02), (0.0, 0, 1.26, 0.11, 0.06), (-0.45, 0, 1.24, 0.12, 0.05), (-0.75, 0, 1.15, 0.08, 0.02)], mirror=False, flat=0.7)
    k.post_wing(S.tail + 0.30, 1.38, 0.38, 1.70, S.tail + 0.16, 0.32, aoa=-12,
                endplate=[(S.tail + 0.36, 1.32), (S.tail + 0.34, 1.48), (S.tail - 0.10, 1.52), (S.tail - 0.14, 1.36), (S.tail + 0.02, 1.30)])
    k.wing(S.tail + 0.02, 1.46, 0.18, 1.70, aoa=-24, thick=0.10, mat='Carbon', name='flap')
    for s in (1, -1): k.decal('doorglass', 'Glass', side(s), 0.15, 0.60, 0.50, 0.76, 6, 4, off=.006)   # glass door panels
    k.decal('splitter', 'Carbon', 'front', -0.94, 0.94, 0.10, 0.14, 30, 2)
    k.join(); k.wheels(spokes=10)

# ---- P1: 4.59 x 1.95 x 1.19 m. The bubble cabin, a roof snorkel, the C-shaped tail light around a full mesh tail, two
# big pipes in the middle and an active wing
P_P1 = scaled(P750, L=4.588, W=1.946, H=1.188, WB=2.67, fo=1.03)
def p1(k):
    S = mclaren(k, P_P1, tail='clusters')
    for s in (1, -1): k.fan('tailCtop', 'Taillight', -1.7, 0.88, 0.91, s * 0.30, s * 0.86, 10, 2, off=.007)
    k.pod('snorkel', 'Paint', [(0.05, 0, 1.17, 0.04, 0.02), (-0.05, 0, 1.22, 0.09, 0.05), (-0.45, 0, 1.20, 0.10, 0.04)], mirror=False, flat=0.7)
    for s in (1, -1): k.exhaust(s * 0.09, 0.80, r=0.07, mirror=False)
    k.spoiler(S.tail + 0.20, 1.10, 0.36, 1.66, aoa=-12, mat='Carbon', strut_y=0.46)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- 765LT: 4.60 x 2.05 x 1.16 m. The longtail: longer splitter and tail, carbon spoiler, four pipes in the middle
P_765 = scaled(P750, L=4.600, W=1.96, H=1.159, WB=2.67, fo=1.05)
def lt765(k):
    S = mclaren(k, P_765)
    for y in (-0.15, -0.05, 0.05, 0.15): k.exhaust(y, 0.62, r=0.04, mirror=False)
    k.spoiler(S.tail + 0.16, 1.03, 0.30, 1.56, aoa=-8, mat='Carbon', strut_y=0.42)
    k.decal('splitter', 'Carbon', 'front', -0.94, 0.94, 0.10, 0.14, 30, 2)
    k.join(); k.wheels(spokes=10)

def s750(k):
    S = mclaren(k, P750)
    for s in (1, -1): k.exhaust(s * 0.10, 0.62, r=0.05, mirror=False)
    k.spoiler(S.tail + 0.12, 1.01, 0.26, 1.50, aoa=-6, mat='Paint', strut_y=0.40)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

# ---- Artura: 4.54 x 1.91 x 1.19 m, 2.64 m wheelbase. The hybrid: smoother sides, one high centre pipe, no wing
P_ART = scaled(P750, L=4.539, W=1.913, H=1.193, WB=2.64, fo=1.02)
def artura(k):
    mclaren(k, P_ART)
    k.exhaust(0.0, 0.86, r=0.065, mirror=False)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- GTS: 4.68 x 1.92 x 1.21 m, 2.68 m wheelbase. The grand tourer: a longer glass hatch over the luggage bay
P_GTS = scaled(P750, L=4.683, W=1.924, H=1.213, WB=2.675, fo=1.03,
               top=[(x, z) for x, z in scaled(P750, L=4.683, W=1.924, H=1.213, WB=2.675, fo=1.03)['top'] if not (-1.9 < x < -0.6)]
                   + [(-0.95, 1.12), (-1.35, 1.07), (-1.75, 1.03)],
               cab=(0.95, 0.10, -0.62, -1.75), rw_w=0.85)
def gts(k):
    mclaren(k, P_GTS)
    for s in (1, -1): k.exhaust(s * 0.56, 0.46, r=0.045, mirror=False)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ======================================================================= Bugatti
# Chiron: 4.54 x 2.04 x 1.21 m, 2.71 m wheelbase. The horseshoe grille, four-point lights, the C-line sweeping round
# the door with an intake inside it, a spine down the roof, a tall tail with the long thin LED bar and a wing.
PCHI = dict(L=4.544, W=2.038, H=1.212, WB=2.711, fo=0.98, clear=0.11, nose_zb=0.22, tail_zb=0.40,
            top=[(2.3355, 0.48), (2.25, 0.56), (2.0, 0.63), (1.6, 0.70), (1.25, 0.77), (0.95, 0.83), (0.5, 1.02), (0.1, 1.18),
                 (-0.2, 1.212), (-0.6, 1.18), (-0.95, 1.10), (-1.4, 1.06), (-1.9, 1.04), (-2.1, 1.04), (-2.2085, 0.96)],
            belt=[(2.3355, 0.46), (2.1, 0.62), (1.6, 0.75), (1.0, 0.83), (0.4, 0.86), (-0.4, 0.89), (-1.0, 0.97), (-1.6, 1.01),
                  (-2.1, 1.0), (-2.2085, 0.90)],
            plan=[(2.3355, 0.40), (2.25, 0.66), (2.0, 0.88), (1.3555, 1.0), (0.6, 0.97), (0.0, 0.965), (-0.7, 1.0), (-1.3555, 1.019),
                  (-1.9, 0.99), (-2.15, 0.90), (-2.2085, 0.80)],
            roof=[(0.95, 0.64), (0.4, 0.58), (-0.2, 0.54), (-0.6, 0.50), (-0.95, 0.44)],
            cab=(0.95, 0.10, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.05, side=(0.88, -0.80),
            doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0, rear_glass=False)
WBUG = (dict(r=0.35, w=0.285, rim=0.254), dict(r=0.37, w=0.355, rim=0.267))

def horseshoe(k, xn, z=0.40, s=1.0):
    k.oval('horseshoe_in', 'Black', (xn - 0.05, 0, z), (1, 0, 0.1), 0.12 * s, 0.16 * s, .006, n=8)
    k.oval('horseshoe', 'Chrome', (xn - 0.05, 0, z), (1, 0, 0.1), 0.15 * s, 0.19 * s, .008, ring=0.8)

def c_line(k, cx=-0.30, cz=0.60, r=0.36, mat='Chrome'):
    """Bugatti's C-shaped side sweep, with a dark intake inside it"""
    for s in (1, -1):
        k.project('cline', mat, lambda u, v, s=s: k.VIEW[side(s)](cx + math.cos(lerp(-1.75, 1.75, u)) * (r + v * .045),
                                                                    cz + math.sin(lerp(-1.75, 1.75, u)) * (r + v * .045) * 1.05), 40, 2, off=.006)
        k.slanted('cintake', 'Gloss', s, cx + r * .75, cx + r * .05, cz - r * .6, cz + r * .6, lean=-0.05, nu=6, nv=6)

def bugatti(k, P, wheels=WBUG):
    S = build(k, P, *wheels, crease=dict(crease_lines=0.3, crisp_front=-9, crisp=0.25, crease_front=0.5, crease_rear=0.8))
    for s in (1, -1): k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
    k.decal('spine', 'Chrome', 'top', -1.30, 0.20, -0.012, 0.012, 20, 1, off=.006)     # the spine over the roof
    k.headlight_quad((S.nose - 0.24, 0.70, 0.60), (0.66, 0.34, 0.52), 0.22, 0.08, slant=0.03)   # four-point lights
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.30, s * 0.82, 0.16, 0.36, 12, 4))
    k.decal('splitter', 'Carbon', 'front', -0.90, 0.90, 0.12, 0.17, 30, 2)
    k.fan('rearbg', 'Gloss', -1.7, 0.40, 0.74, -0.66, 0.66, 30, 5, off=.003)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.40, -0.72, 0.72, 30, 3)
    return S

def quad_pipes(k, z=0.56):
    for y in (-0.15, -0.05, 0.05, 0.15): k.exhaust(y, z, r=0.042, mirror=False)

def chiron(k, P, wing):
    S = bugatti(k, P); horseshoe(k, S.nose); c_line(k)
    k.light_bar(-1.7, 0.885, 0.91, 0.82, bg=0.02, frac=0.6)                    # the long thin LED bar
    quad_pipes(k); wing(k, S)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- Chiron Super Sport: 4.73 m long - the longtail, with the pipes stacked in the middle and a low spoiler
P_CSS = scaled(PCHI, L=4.733, fo=1.02)
def chironss(k):
    chiron(k, P_CSS, lambda k, S: k.spoiler(S.tail + 0.25, 1.06, 0.30, 1.50, aoa=-4, mat='Carbon', strut_y=0.40))

# ---- Chiron Pur Sport: 4.65 m long, the fixed wing on its uprights
P_CPS = scaled(PCHI, L=4.647, fo=1.02)
def chironps(k):
    chiron(k, P_CPS, lambda k, S: k.post_wing(S.tail + 0.36, 1.26, 0.34, 1.86, S.tail + 0.22, 0.42, aoa=-8,
                                              endplate=[(S.tail + 0.42, 1.21), (S.tail + 0.40, 1.34), (S.tail - 0.02, 1.37), (S.tail - 0.06, 1.24), (S.tail + 0.10, 1.19)]))

# ---- Divo: 4.64 x 2.02 m - a roof NACA duct, a fin, vertical blade tail lights and the big wing
P_DIVO = scaled(PCHI, L=4.641, W=2.018, fo=1.02)
def divo(k):
    S = bugatti(k, P_DIVO); horseshoe(k, S.nose); c_line(k, mat='Carbon')
    for i in range(8):   # the vertical tail-light fins
        k.fan('fin', 'Taillight', -1.7, 0.74, 0.94, -0.70 + i * 0.2, -0.66 + i * 0.2, 2, 4, off=.006)
    k.naca(-0.30, 0.30, 0.0, 0.05, 0.18)
    k.post_wing(S.tail + 0.38, 1.22, 0.40, 1.92, S.tail + 0.26, 0.46, aoa=-8,
                endplate=[(S.tail + 0.44, 1.17), (S.tail + 0.42, 1.30), (S.tail - 0.06, 1.34), (S.tail - 0.10, 1.20), (S.tail + 0.08, 1.15)])
    k.pod('fin', 'Paint', [(-0.55, 0.0, 1.20, 0.01, 0.01), (-0.80, 0.0, 1.17, 0.012, 0.06), (-1.70, 0.0, 1.07, 0.012, 0.05)], mirror=False, sub=1)
    quad_pipes(k)
    k.join(); k.wheels(spokes=10, nut='bolts')

# ---- Tourbillon: 4.67 x 2.05 x 1.19 m, 2.74 m wheelbase. A pointed nose round the widest horseshoe yet, a bigger
# C-line, a huge exposed diffuser with the lights over it and a deployable wing
P_TOUR = scaled(PCHI, L=4.671, W=2.051, H=1.189, WB=2.74, fo=1.0,
                plan=[(x, w * (0.9 if x > 2.1 else 1.0)) for x, w in scaled(PCHI, L=4.671, W=2.051, H=1.189, WB=2.74, fo=1.0)['plan']])
def tourbillon(k):
    S = bugatti(k, P_TOUR); horseshoe(k, S.nose, s=1.15); c_line(k, cx=-0.25, r=0.40)
    k.light_bar(-1.7, 0.84, 0.90, 0.82, bg=0.03, frac=0.35)
    k.fan('diffusercore', 'Carbon', -1.7, 0.34, 0.62, -0.42, 0.42, 20, 4, off=.006)
    k.exhaust(0.0, 0.72, r=0.05, mirror=False)
    k.spoiler(S.tail + 0.20, 1.06, 0.30, 1.56, aoa=-5, mat='Paint', strut_y=0.42)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.028, 0.018))

# ---- Veyron Super Sport: 4.46 x 2.00 x 1.20 m, 2.71 m wheelbase. Rounder, with the two roof air scoops, round twin
# tail lights and one big pipe in the middle
P_VEY = scaled(PCHI, L=4.462, W=1.998, H=1.204, WB=2.71, fo=0.96)
def veyronss(k):
    S = bugatti(k, P_VEY); horseshoe(k, S.nose, z=0.38, s=0.95); c_line(k, cx=-0.32, r=0.33, mat='Carbon')
    for s in (1, -1):
        for y in (0.55, 0.75): k.oval('tailround', 'Taillight', V(S.tail + 0.10, s * y, 0.84), V(-1, s * 0.3 * y, 0.1), 0.055, 0.055, .006, n=6)
        k.pod('scoop', 'Carbon', [(-0.55, s * 0.30, 1.15, 0.05, 0.03), (-0.75, s * 0.30, 1.20, 0.12, 0.09), (-1.20, s * 0.30, 1.13, 0.12, 0.06)], mirror=False, flat=0.6)
    k.exhaust(0.0, 0.50, r=0.07, mirror=False)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ---- Bolide: 4.84 x 2.10 x 1.05 m, 2.75 m wheelbase - the track car: a tiny canopy, X lights, a roof scoop, a shark
# fin and a huge wing
P_BOL = scaled(PCHI, L=4.835, W=2.10, H=1.047, WB=2.75, fo=1.06,
               roof=[(x, w * 0.85) for x, w in scaled(PCHI, W=2.10, WB=2.75)['roof']])
def bolide(k):
    S = bugatti(k, P_BOL, (dict(r=0.33, w=0.27, rim=0.254), dict(r=0.35, w=0.34, rim=0.254))); horseshoe(k, S.nose, z=0.36, s=0.9)
    for s in (1, -1):   # X-shaped lights front and rear
        for a in (0.6, -0.6):
            k.rect('xlight', 'Headlight', V(S.nose - 0.25, s * 0.62, 0.52), V(0.75, s * 0.25, 0.45), 0.18, 0.02, .010, nu=6, nv=1, slant=a * 0.10 * s)
            k.fan('xtail', 'Taillight', -1.7, 0.72, 0.76, s * (0.55 + a * .1), s * (0.75 - a * .1), 6, 2, off=.006)
    k.pod('roofscoop', 'Carbon', [(0.10, 0, 1.01, 0.04, 0.02), (0.0, 0, 1.09, 0.14, 0.07), (-0.60, 0, 1.06, 0.14, 0.05), (-1.0, 0, 0.97, 0.08, 0.02)], mirror=False, flat=0.7)
    k.pod('fin', 'Carbon', [(-0.90, 0.0, 1.0, 0.01, 0.01), (-1.20, 0.0, 1.02, 0.012, 0.10), (-2.10, 0.0, 0.97, 0.012, 0.08)], mirror=False, sub=1)
    k.post_wing(S.tail + 0.50, 1.16, 0.40, 1.90, S.tail + 0.36, 0.40, aoa=-12,
                endplate=[(S.tail + 0.56, 1.10), (S.tail + 0.54, 1.26), (S.tail + 0.08, 1.30), (S.tail + 0.04, 1.14), (S.tail + 0.22, 1.08)])
    quad_pipes(k, z=0.52)
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
