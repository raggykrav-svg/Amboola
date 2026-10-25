# BMW M, Audi Sport and the Devel Sixteen for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/bmw_audi.py -- --car all
#
# Bodies come from carshape: each car's real measurements and outline. The faces carry the brands: BMW's twin kidneys, Audi's big hexagonal Singleframe with four rings,
# and the Devel's long fighter-jet canopy, fins and a huge V16 exhaust.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import SOFT, SHARP
from carshape import build, scaled

# ----------------------------------------------------------------------------------------------- faces
def kidneys(k, gap, w, z0, z1, slats=6, frame='Chrome'):
    """BMW's twin kidney grille: two tall rounded panels with a chrome frame and vertical slats"""
    for s in (1, -1):
        a, b = s * gap, s * (gap + w)
        k.project('kidneyF', frame, lambda u, v: k.VIEW['front'](lerp(a, b, u), lerp(z0 - .015, z1 + .015, v)), 6, 6, off=.007)
        k.project('kidney', 'Gloss', lambda u, v: k.VIEW['front'](lerp(a + s * .012, b - s * .012, u), lerp(z0, z1, v)), 6, 6, off=.010)
        for i in range(1, slats):
            y = lerp(a, b, i / slats)
            k.decal('slat', frame, 'front', y - .004, y + .004, z0 + .01, z1 - .01, 1, 6, off=.013)

def bmw_face(k, light, kid, intake=(0.62, 0.18, 0.34)):
    k.headlight_quad(light[0], light[1], light[2], light[3], slant=0.04, taper=0.25, dots='row')
    kidneys(k, *kid)
    hw, z0, z1 = intake
    both(lambda s: k.decal('sideintake', 'Gloss', 'front', s * (hw - .24), s * hw, z0, z1, 6, 4))
    k.decal('lowgrille', 'Gloss', 'front', -0.30, 0.30, z0, z0 + (z1 - z0) * .55, 12, 3)

def singleframe(k, hw_top, hw_bot, z0, z1, rings_z=None, mesh=True):
    """Audi's Singleframe: a big hexagon-ish black grille (wider at the bottom), honeycomb bars and four rings"""
    def fn(u, v):
        hw = lerp(hw_bot, hw_top, v) * (1 - .18 * max(0, abs(v - .5) * 2 - .6) / .4)
        return k.VIEW['front'](lerp(-1, 1, u) * hw, lerp(z0, z1, v))
    k.project('singleframe', 'Gloss', fn, 16, 8, off=.006)
    if mesh:
        for i in range(1, 5):
            z = lerp(z0, z1, i / 5)
            k.decal('mesh', 'Black', 'front', -lerp(hw_bot, hw_top, i / 5) * .9, lerp(hw_bot, hw_top, i / 5) * .9, z - .004, z + .004, 14, 1, off=.009)
    rz = rings_z if rings_z is not None else z1 - (z1 - z0) * .12
    for i in range(4):
        k.oval('ring', 'Chrome', V(3.0, (i - 1.5) * .068, rz), V(1, 0, 0), .04, .04, .012, n=12, ring=.72)

def audi_face(k, light, frame, intake=None):
    k.headlight_quad(light[0], light[1], light[2], light[3], slant=0.05, taper=0.3, dots='row')
    k.drl_strip((light[0][0] + .02, light[0][1], light[0][2] - .07), light[1], light[2] * .9, 0.02, slant=0.05)
    singleframe(k, *frame)
    if intake: both(lambda s: k.decal('intake', 'Gloss', 'front', s * intake[0], s * intake[1], intake[2], intake[3], 6, 4))

def quad_pipes(k, y, z, r=0.045, oval=False):
    for s in (1, -1):
        for d in (0, 0.13):
            if oval: k.exhaust(s * (y + d * .9), z, shape='rect', w=0.13, h=0.07, mirror=False)
            else: k.exhaust(s * (y + d), z, r=r, mirror=False)

# ----------------------------------------------------------------------------------------------- BMW
# Every car below is built by carshape.build from its real length, width, height and wheelbase and outline points read
# off photos (the axles at +-wheelbase/2); carshape.scaled stretches a sister car's outline to another's real size.

# M4 CSL: 4.79 x 1.89 x 1.39 m, 2.86 m wheelbase. A long bonnet, a three-box coupe roof, carbon roof and bonnet, a
# ducktail, tall kidneys and the red-ringed laser lights
PM4 = dict(L=4.794, W=1.887, H=1.393, WB=2.857, fo=0.90, clear=0.12, nose_zb=0.27, tail_zb=0.38,
           top=[(2.3285, 0.66), (2.24, 0.74), (1.95, 0.81), (1.4285, 0.87), (0.9, 0.93), (0.55, 0.97), (0.15, 1.20), (-0.25, 1.36),
                (-0.55, 1.393), (-0.85, 1.385), (-1.15, 1.33), (-1.45, 1.19), (-1.75, 1.06), (-2.2, 1.03), (-2.40, 1.05), (-2.4655, 0.98)],
           belt=[(2.3285, 0.64), (1.95, 0.83), (1.4285, 0.90), (0.55, 0.97), (-0.5, 0.99), (-1.4285, 1.01), (-2.2, 1.01), (-2.4655, 0.95)],
           plan=[(2.3285, 0.58), (2.24, 0.78), (1.95, 0.89), (1.4285, 0.935), (0.5, 0.91), (-0.5, 0.915), (-1.4285, 0.9435), (-2.1, 0.92),
                 (-2.40, 0.84), (-2.4655, 0.76)],
           roof=[(0.55, 0.68), (-0.25, 0.62), (-0.85, 0.60), (-1.3, 0.56), (-1.75, 0.50)],
           cab=(0.55, -0.25, -1.15, -1.75), bulge=0.03, hip=0.04, side=(0.48, -1.45), pillars=(-1.05,), doors=(0.50,),
           mirror_x=0.44, rw_w=0.85)
def m4csl(k):
    S = build(k, PM4, dict(r=0.337, w=0.275, rim=0.241), dict(r=0.34, w=0.285, rim=0.254), crease=SHARP)
    bmw_face(k, ((2.18, 0.66, 0.70), (0.72, 0.30, 0.55), 0.26, 0.07), (0.03, 0.25, 0.26, 0.57, 7), (0.80, 0.18, 0.28))
    k.decal('roof', 'Carbon', 'top', -1.10, -0.30, -0.45, 0.45, 12, 10, off=.003)
    k.decal('bonnet', 'Carbon', 'top', 1.20, 1.95, -0.45, 0.45, 12, 10, off=.003)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.14, 0.18, 30, 2)
    for s in (1, -1): k.decal('skirt', 'Gloss', side(s), -1.0, 1.1, 0.12, 0.20, 30, 2)
    k.tail_clusters(-2.0, 0.88, 0.96, 0.45, 0.82)
    k.fan('diffuser', 'Carbon', -2.0, 0.26, 0.42, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.40, 0.36)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# M2 (G87): 4.58 x 1.89 x 1.40 m, 2.75 m wheelbase - shorter and boxier, with square-framed kidneys
PM2 = scaled(PM4, L=4.58, W=1.887, H=1.403, WB=2.747, fo=0.82)
def m2(k):
    S = build(k, PM2, dict(r=0.335, w=0.255, rim=0.241), dict(r=0.345, w=0.285, rim=0.254), crease=SHARP)
    bmw_face(k, ((2.06, 0.66, 0.70), (0.72, 0.30, 0.55), 0.26, 0.07), (0.03, 0.30, 0.30, 0.52, 7), (0.80, 0.18, 0.28))
    for s in (1, -1): k.decal('skirt', 'Gloss', side(s), -1.0, 1.05, 0.12, 0.20, 30, 2)
    k.tail_clusters(-1.9, 0.88, 0.96, 0.45, 0.82)
    k.fan('diffuser', 'Gloss', -1.9, 0.26, 0.42, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.42, 0.36)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.024, 0.016))

# M5 (G90): 5.10 x 1.97 x 1.51 m, 3.01 m wheelbase - the long four-door super saloon: wide kidneys, a boot lip, quad pipes
PM5 = dict(L=5.096, W=1.97, H=1.51, WB=3.006, fo=0.92, clear=0.13, nose_zb=0.28, tail_zb=0.40,
           top=[(2.423, 0.72), (2.33, 0.80), (2.0, 0.88), (1.503, 0.94), (1.0, 1.0), (0.70, 1.04), (0.3, 1.28), (-0.1, 1.48),
                (-0.5, 1.51), (-1.1, 1.50), (-1.55, 1.43), (-1.85, 1.30), (-2.15, 1.12), (-2.5, 1.09), (-2.62, 1.10), (-2.673, 1.03)],
           belt=[(2.423, 0.70), (2.0, 0.90), (1.503, 0.97), (0.70, 1.04), (-0.5, 1.06), (-1.503, 1.09), (-2.3, 1.10), (-2.673, 1.02)],
           plan=[(2.423, 0.62), (2.33, 0.82), (2.0, 0.93), (1.503, 0.975), (0.5, 0.955), (-0.5, 0.96), (-1.503, 0.985), (-2.2, 0.96),
                 (-2.55, 0.88), (-2.673, 0.80)],
           roof=[(0.70, 0.72), (0.0, 0.68), (-0.9, 0.66), (-1.5, 0.62), (-2.15, 0.55)],
           cab=(0.70, -0.10, -1.55, -2.15), bulge=0.03, hip=0.04, side=(0.62, -1.95), pillars=(-0.35, -1.50), pillar_w=0.07,
           doors=(0.62, -0.35), mirror_x=0.56, rw_w=0.85)
def m5(k):
    S = build(k, PM5, dict(r=0.368, w=0.285, rim=0.254), dict(r=0.37, w=0.295, rim=0.267), crease=SOFT)
    bmw_face(k, ((2.26, 0.66, 0.74), (0.72, 0.30, 0.52), 0.30, 0.07), (0.03, 0.32, 0.36, 0.64, 8), (0.84, 0.20, 0.34))
    for s in (1, -1):
        for xh in (0.20, -0.75): k.decal('handle', 'Chrome', side(s), xh - .14, xh, 0.98, 0.998, 4, 1, off=.003)
        k.decal('skirt', 'Gloss', side(s), -1.1, 1.1, 0.14, 0.22, 30, 2)
    k.tail_clusters(-2.2, 0.94, 1.03, 0.45, 0.86)
    k.fan('diffuser', 'Gloss', -2.2, 0.30, 0.46, -0.62, 0.62, 30, 3)
    k.spoiler(S.tail + 0.10, 1.11, 0.10, 1.20, aoa=-4, thick=0.05, mat='Gloss', strut_y=0.35)
    quad_pipes(k, 0.46, 0.38)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# XM: 5.11 x 2.01 x 1.76 m, 3.11 m wheelbase - the big square-jawed SUV: huge lit kidneys, split lights, a sloping rear
PXM = dict(L=5.11, W=2.005, H=1.755, WB=3.105, fo=0.92, clear=0.21, nose_zb=0.42, tail_zb=0.48, nose_run=0.10,
           top=[(2.4725, 0.98), (2.40, 1.08), (2.1, 1.15), (1.5525, 1.20), (1.0, 1.24), (0.75, 1.27), (0.35, 1.53), (0.0, 1.72),
                (-0.4, 1.755), (-1.3, 1.74), (-1.95, 1.68), (-2.3, 1.52), (-2.5, 1.30), (-2.6375, 1.22)],
           belt=[(2.4725, 0.96), (2.1, 1.16), (1.5525, 1.22), (0.75, 1.27), (-0.5, 1.29), (-1.5525, 1.31), (-2.3, 1.32), (-2.6375, 1.20)],
           plan=[(2.4725, 0.76), (2.40, 0.90), (2.1, 0.97), (1.5525, 1.0), (0.5, 0.985), (-0.5, 0.985), (-1.5525, 1.0025), (-2.3, 0.98),
                 (-2.55, 0.92), (-2.6375, 0.84)],
           roof=[(0.75, 0.80), (0.0, 0.76), (-1.0, 0.75), (-1.95, 0.72), (-2.35, 0.66)],
           cab=(0.75, 0.0, -1.95, -2.45), bulge=0.03, hip=0.03, side=(0.68, -2.20), pillars=(-0.45, -1.55), pillar_w=0.08,
           doors=(0.68, -0.45, -1.55), mirror_x=0.60, rw_w=0.85, roof_crown=0.04, mirror_size=(0.18, 0.24, 0.13))
def xm(k):
    S = build(k, PXM, dict(r=0.389, w=0.275, rim=0.279, gap=0.07), dict(r=0.39, w=0.315, rim=0.279, gap=0.07), crease=SHARP)
    k.arch_trim(0.06, mat='Gloss')
    bmw_face(k, ((2.38, 0.72, 1.14), (0.85, 0.25, 0.30), 0.30, 0.05), (0.03, 0.42, 0.60, 1.08, 8), (0.88, 0.34, 0.54))
    k.headlight_quad((2.42, 0.74, 0.86), (0.85, 0.25, 0.30), 0.22, 0.07, slant=0.02, dots='row')   # the lower half of the split lights
    both(lambda s: k.decal('cladding', 'Gloss', side(s), -1.10, 1.15, 0.24, 0.38, 30, 3, off=.006))
    k.tail_clusters(-2.2, 1.18, 1.30, 0.60, 0.86)
    k.fan('rearbumper', 'Gloss', -2.2, 0.48, 0.64, -0.66, 0.66, 30, 3)
    quad_pipes(k, 0.46, 0.54, oval=True)
    k.join(); k.wheels(spokes=6, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# ----------------------------------------------------------------------------------------------- Audi
# R8 V10 GT: 4.43 x 1.94 x 1.24 m, 2.65 m wheelbase - mid-engine, the big carbon "sideblade" behind the doors, a fixed wing
PR8 = dict(L=4.429, W=1.94, H=1.24, WB=2.65, fo=1.0, clear=0.11, nose_zb=0.24, tail_zb=0.40,
           top=[(2.325, 0.50), (2.23, 0.58), (1.95, 0.65), (1.6, 0.71), (1.25, 0.78), (0.95, 0.84), (0.5, 1.03), (0.1, 1.20),
                (-0.2, 1.24), (-0.6, 1.20), (-0.95, 1.10), (-1.5, 1.05), (-1.95, 1.03), (-2.104, 0.97)],
           belt=[(2.325, 0.48), (2.05, 0.64), (1.6, 0.76), (1.0, 0.84), (0.4, 0.87), (-0.4, 0.90), (-1.0, 0.97), (-1.6, 1.0),
                 (-2.0, 0.98), (-2.104, 0.90)],
           plan=[(2.325, 0.44), (2.23, 0.70), (1.95, 0.87), (1.325, 0.96), (0.6, 0.935), (0.0, 0.93), (-0.7, 0.96), (-1.325, 0.97),
                 (-1.85, 0.94), (-2.05, 0.86), (-2.104, 0.78)],
           roof=[(0.95, 0.66), (0.4, 0.60), (-0.2, 0.56), (-0.6, 0.52), (-0.95, 0.46)],
           cab=(0.95, 0.10, -0.62, -0.95), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.04, side=(0.88, -0.85),
           doors=(0.86,), mirror_x=0.80, rw_w=0.9, rw_bulge=0.0)
def r8(k):
    S = build(k, PR8, dict(r=0.335, w=0.255, rim=0.254), dict(r=0.35, w=0.31, rim=0.254), crease=SHARP)
    for s in (1, -1):
        k.slanted('sideblade', 'Carbon', s, -0.45, -1.05, 0.30, 0.92, lean=0.10, nu=8, nv=10, off=.006)
        k.slanted('sideintake', 'Gloss', s, -0.62, -0.95, 0.60, 0.84, lean=0.08, nu=6, nv=6, off=.009)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
    audi_face(k, ((2.04, 0.66, 0.62), (0.66, 0.34, 0.52), 0.30, 0.08), (0.42, 0.50, 0.18, 0.48, 0.45), (0.62, 0.86, 0.16, 0.36))
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.12, 0.17, 30, 2)
    k.light_bar(-1.7, 0.88, 0.92, 0.80, bg=0.015, frac=0.6)
    k.fan('rearpanel', 'Gloss', -1.7, 0.46, 0.66, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.7, 0.26, 0.46, -0.66, 0.66, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.58, 0.38, shape='rect', w=0.16, h=0.08, mirror=False)
    k.post_wing(S.tail + 0.30, 1.22, 0.34, 1.76, S.tail + 0.18, 0.44, aoa=-8,
                endplate=[(S.tail + 0.36, 1.17), (S.tail + 0.34, 1.30), (S.tail - 0.06, 1.32), (S.tail - 0.10, 1.20), (S.tail + 0.06, 1.16)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# RS 6 Avant GT: 5.00 x 1.95 x 1.46 m, 2.93 m wheelbase - the very fast estate: a long roof, flared arches, oval pipes
PRS6 = dict(L=4.995, W=1.951, H=1.46, WB=2.927, fo=0.93, clear=0.12, nose_zb=0.27, tail_zb=0.38, tail_run=0.12,
            top=[(2.3935, 0.70), (2.30, 0.78), (2.0, 0.86), (1.4635, 0.92), (1.0, 0.97), (0.70, 1.01), (0.3, 1.25), (-0.1, 1.43),
                 (-0.5, 1.46), (-1.4, 1.45), (-2.05, 1.40), (-2.35, 1.30), (-2.50, 1.12), (-2.6015, 1.04)],
            belt=[(2.3935, 0.68), (2.0, 0.88), (1.4635, 0.95), (0.70, 1.01), (-0.5, 1.03), (-1.4635, 1.06), (-2.3, 1.08), (-2.6015, 1.0)],
            plan=[(2.3935, 0.62), (2.30, 0.82), (2.0, 0.93), (1.4635, 0.9755), (0.5, 0.945), (-0.5, 0.95), (-1.4635, 0.9755), (-2.2, 0.95),
                  (-2.5, 0.88), (-2.6015, 0.80)],
            roof=[(0.70, 0.70), (0.0, 0.65), (-1.0, 0.63), (-2.0, 0.60), (-2.35, 0.56)],
            cab=(0.70, -0.10, -2.05, -2.45), bulge=0.05, hip=0.05, side=(0.62, -2.20), pillars=(-0.35, -1.45), pillar_w=0.07,
            doors=(0.62, -0.35), mirror_x=0.56, rw_w=0.85, roof_crown=0.04)
def rs6(k):
    S = build(k, PRS6, dict(r=0.365, w=0.285, rim=0.279), dict(r=0.365, w=0.285, rim=0.279), crease=SOFT)
    audi_face(k, ((2.24, 0.66, 0.76), (0.80, 0.28, 0.40), 0.30, 0.06), (0.46, 0.54, 0.24, 0.62, 0.56), (0.66, 0.88, 0.22, 0.42))
    k.wing(-2.06, 1.42, 0.18, 1.15, aoa=-6, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.light_bar(-2.2, 1.02, 1.06, 0.86, bg=0.015, frac=1.0)
    k.fan('diffuser', 'Gloss', -2.2, 0.26, 0.42, -0.62, 0.62, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.60, 0.34, shape='rect', w=0.17, h=0.08, mirror=False)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# RS e-tron GT performance: 5.00 x 1.96 x 1.37 m, 2.90 m wheelbase - the low electric fastback: big rear haunches, a
# closed Singleframe, a carbon roof, a full-width light bar
PETRON = dict(L=4.997, W=1.964, H=1.369, WB=2.90, fo=0.98, clear=0.12, nose_zb=0.26, tail_zb=0.38,
              top=[(2.43, 0.62), (2.34, 0.70), (2.0, 0.78), (1.45, 0.86), (0.95, 0.92), (0.70, 0.96), (0.3, 1.18), (-0.1, 1.34),
                   (-0.5, 1.369), (-1.0, 1.35), (-1.45, 1.26), (-1.85, 1.12), (-2.2, 1.03), (-2.45, 1.03), (-2.567, 0.96)],
              belt=[(2.43, 0.60), (2.0, 0.80), (1.45, 0.89), (0.70, 0.96), (-0.5, 0.99), (-1.45, 1.02), (-2.2, 1.03), (-2.567, 0.94)],
              plan=[(2.43, 0.56), (2.34, 0.80), (2.0, 0.92), (1.45, 0.975), (0.5, 0.94), (-0.5, 0.945), (-1.45, 0.982), (-2.2, 0.95),
                    (-2.48, 0.86), (-2.567, 0.76)],
              roof=[(0.70, 0.68), (0.0, 0.62), (-0.9, 0.58), (-1.45, 0.52), (-1.85, 0.46)],
              cab=(0.70, -0.10, -1.10, -1.85), bulge=0.05, hip=0.06, side=(0.62, -1.65), pillars=(-0.40,), pillar_w=0.07,
              doors=(0.62, -0.40), mirror_x=0.56, rw_w=0.85)
def rsetrongt(k):
    S = build(k, PETRON, dict(r=0.36, w=0.265, rim=0.267), dict(r=0.358, w=0.305, rim=0.267), crease=SOFT)
    k.decal('roof', 'Carbon', 'top', -1.10, 0.20, -0.52, 0.52, 16, 12, off=.003)
    audi_face(k, ((2.20, 0.64, 0.70), (0.70, 0.30, 0.55), 0.30, 0.07), (0.40, 0.48, 0.20, 0.52, 0.48), (0.62, 0.86, 0.18, 0.38))
    k.light_bar(-2.1, 0.94, 0.97, 0.86, bg=0.02, frac=1.0)
    k.fan('diffuser', 'Carbon', -2.1, 0.30, 0.46, -0.66, 0.66, 30, 3)
    k.spoiler(S.tail + 0.20, 1.04, 0.20, 1.30, aoa=-5, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

# RS Q8 performance: 5.01 x 2.01 x 1.69 m, 3.00 m wheelbase - the coupe-SUV: a huge black Singleframe, wide arches and
# a roof that slopes down to the tailgate
PRSQ8 = scaled(PXM, L=5.012, W=2.007, H=1.692, WB=2.998, fo=0.97,
               top=[(2.469, 0.94), (2.39, 1.04), (2.1, 1.10), (1.499, 1.15), (1.0, 1.19), (0.75, 1.22), (0.35, 1.48), (0.0, 1.66),
                    (-0.4, 1.692), (-1.0, 1.67), (-1.6, 1.58), (-2.0, 1.44), (-2.3, 1.30), (-2.45, 1.26), (-2.543, 1.18)],
               cab=(0.75, 0.0, -1.60, -2.30))
def rsq8(k):
    S = build(k, PRSQ8, dict(r=0.39, w=0.29, rim=0.292, gap=0.07), dict(r=0.39, w=0.31, rim=0.292, gap=0.07), crease=SHARP)
    k.arch_trim(0.06, mat='Gloss')
    audi_face(k, ((2.32, 0.70, 1.06), (0.80, 0.25, 0.30), 0.30, 0.06), (0.52, 0.60, 0.40, 0.98, 0.90), (0.72, 0.94, 0.34, 0.56))
    both(lambda s: k.decal('cladding', 'Gloss', side(s), -1.10, 1.15, 0.24, 0.38, 30, 3, off=.006))
    k.light_bar(-2.1, 1.16, 1.20, 0.86, bg=0.015, frac=1.0)
    k.fan('rearbumper', 'Gloss', -2.1, 0.46, 0.62, -0.66, 0.66, 30, 3)
    for s in (1, -1): k.exhaust(s * 0.62, 0.52, shape='rect', w=0.18, h=0.08, mirror=False)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.028, 0.018))

# ----------------------------------------------------------------------------------------------- Devel Sixteen
# 5.30 x 2.11 x 1.27 m: a jet fighter of a car - a long, low, wide body, a narrow bubble canopy far forward, two tall
# rear fins, big side intakes and an enormous round V16 pipe in the middle of the tail
PDEVEL = dict(L=5.304, W=2.11, H=1.272, WB=3.10, fo=1.15, clear=0.11, nose_zb=0.22, tail_zb=0.40,
              top=[(2.70, 0.46), (2.58, 0.54), (2.2, 0.62), (1.8, 0.69), (1.4, 0.76), (1.10, 0.82), (0.6, 1.02), (0.15, 1.22),
                   (-0.25, 1.272), (-0.75, 1.22), (-1.2, 1.10), (-1.8, 1.04), (-2.3, 1.02), (-2.5, 1.02), (-2.604, 0.95)],
              belt=[(2.70, 0.44), (2.3, 0.62), (1.8, 0.76), (1.1, 0.84), (0.4, 0.87), (-0.4, 0.89), (-1.1, 0.97), (-1.8, 1.0),
                    (-2.4, 0.98), (-2.604, 0.90)],
              plan=[(2.70, 0.42), (2.58, 0.72), (2.2, 0.94), (1.55, 1.04), (0.7, 1.0), (0.0, 0.99), (-0.8, 1.04), (-1.55, 1.055),
                    (-2.2, 1.02), (-2.5, 0.92), (-2.604, 0.82)],
              roof=[(1.10, 0.50), (0.4, 0.42), (-0.25, 0.38), (-0.75, 0.32), (-1.2, 0.26)],
              cab=(1.10, 0.15, -0.75, -1.20), bulge=0.06, hip=0.06, side=(1.0, -1.0), doors=(0.98,), mirror_x=0.92, rw_w=0.85,
              rw_bulge=0.0)
def devel16(k):
    S = build(k, PDEVEL, dict(r=0.36, w=0.28, rim=0.267), dict(r=0.38, w=0.36, rim=0.292),
              crease=dict(crease_lines=0.55, crisp_front=-9, crisp=0.45, crease_front=0.7, crease_rear=0.85))
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, -0.30, -1.10, 0.40, 0.88, lean=0.25, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), -1.10, 1.15, 0.11, 0.19, 30, 2)
        k.decal('stripe', 'Gloss', side(s), 0.40, 1.40, 0.58, 0.62, 20, 1, off=.005)
        k.plate('fin', 'Carbon', [(-1.30, 1.04), (-1.95, 1.26), (S.tail + 0.25, 1.28), (S.tail + 0.15, 1.0)], s * 0.62, t=0.015)
    k.headlight_quad((2.44, 0.76, 0.58), (0.66, 0.36, 0.52), 0.30, 0.06, slant=0.06, taper=0.4, dots='row')
    k.decal('mouth', 'Gloss', 'front', -0.64, 0.64, 0.16, 0.34, 20, 4)
    k.decal('splitter', 'Carbon', 'front', -1.0, 1.0, 0.11, 0.15, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.60, 2.10, s * 0.20, s * 0.46, 6, 4))
    k.light_bar(-2.1, 0.90, 0.93, 0.85, bg=0.015, frac=0.85)
    k.fan('rearpanel', 'Gloss', -2.1, 0.44, 0.82, -0.70, 0.70, 30, 5)
    k.fan('diffuser', 'Carbon', -2.1, 0.24, 0.44, -0.74, 0.74, 30, 3)
    k.exhaust(0.0, 0.62, r=0.15, mirror=False)                                                    # the giant V16 pipe
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

CARS = {
    'm2': (m2, '#1d5bd8', '#2a2b2e', '#1d5bd8'),
    'm4csl': (m4csl, '#f2f2ef', '#c8a24a', '#c8141b'),
    'm5': (m5, '#1c3b2e', '#1b1b1d', '#1d5bd8'),
    'xm': (xm, '#0b0b0d', '#1b1b1d', '#d8b04a'),
    'r8': (r8, '#a9adb1', '#1b1b1d', '#c8141b'),
    'rs6': (rs6, '#5a5f62', '#1b1b1d', '#c8141b'),
    'rsetrongt': (rsetrongt, '#2a6cc4', '#1b1b1d', '#c8141b'),
    'rsq8': (rsq8, '#c8141b', '#1b1b1d', '#c8141b'),
    'devel16': (devel16, '#111216', '#1b1b1d', '#c8141b'),
}

if __name__ == '__main__':
    main(CARS, 'bmw_audi.py')
