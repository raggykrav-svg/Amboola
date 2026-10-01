# Every Porsche in Amboola, modelled in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/porsches.py -- --car gt3rs        # one car -> models/gt3rs.glb(.js)
#   blender -b --factory-startup --python models/blender/porsches.py -- --car all          # every car
#   ... -- --car gt3,st --renders DIR [--samples 48] [--views front34,rear34,side] [--sheet] [--no-export] [--blend FILE]
#
# Car ids match index.html CARS. Dimensions follow the real cars: wheelbase, track, length, width, height, wheel sizes.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from carkit import Car, V, lerp, stations, edit, both, side

# ======================================================================= 911 (992)
# x, zb, w, zs, wb, zbl, wg, zg, wr, zr, zt   (front axle x=1.22, rear axle x=-1.24)
T911 = [
    ( 2.27, .27, .66, .41, .64, .47, .55, .50, .30, .51, .505),
    ( 2.20, .18, .84, .45, .82, .55, .68, .625, .44, .565, .555),
    ( 2.05, .155, .89, .50, .875, .64, .71, .725, .50, .615, .60),
    ( 1.80, .15, .915, .55, .90, .72, .73, .785, .52, .67, .655),
    ( 1.50, .15, .925, .585, .91, .77, .745, .83, .53, .715, .70),
    ( 1.22, .15, .93, .61, .915, .80, .755, .855, .53, .755, .74),
    ( 0.92, .13, .92, .625, .905, .845, .77, .89, .52, .835, .82),
    ( 0.58, .13, .905, .615, .89, .865, .78, .955, .60, 1.07, 1.095),
    ( 0.24, .13, .895, .60, .88, .875, .75, 1.09, .635, 1.27, 1.285),
    (-0.30, .13, .895, .60, .88, .885, .735, 1.115, .64, 1.29, 1.305),
    (-0.74, .13, .925, .62, .90, .905, .725, 1.095, .62, 1.255, 1.27),
    (-1.04, .15, .95, .655, .915, .935, .705, 1.035, .585, 1.165, 1.18),
    (-1.25, .17, .955, .675, .92, .955, .685, 1.00, .55, 1.08, 1.095),
    (-1.60, .20, .945, .69, .905, .965, .66, .99, .50, 1.018, 1.03),
    (-1.95, .25, .905, .70, .865, .955, .62, .98, .45, .988, 1.00),
    (-2.19, .30, .82, .68, .78, .925, .55, .955, .36, .953, .965),
    (-2.30, .37, .62, .63, .58, .86, .44, .885, .25, .873, .885),
]
W911 = dict(F=dict(x=1.22, r=0.350, w=0.275, y=0.775, rim=0.254), R=dict(x=-1.24, r=0.367, w=0.335, y=0.785, rim=0.267))

def body_911(k, ys=1.0, rows=T911, wheels=W911, rear_intakes=True, roof='Carbon', hood=None):
    """the shared 992 shell: body, wheel wells, glasshouse, door lines, mirrors, engine-lid grille, light bar, cabin"""
    k.loft(stations(rows, ys)); k.arches(wheels); k.surface()
    k.windscreen(0.90, 0.23, 0.86, 0.57, 0.60 * ys, 0.53 * ys)
    k.rear_window(-1.42, -0.80, 1.02, 0.36, 0.40 * ys, 0.47 * ys)
    k.side_glass(top=[(0.62, 0.90), (0.42, 1.03), (0.16, 1.205), (-0.20, 1.237), (-0.55, 1.212), (-0.84, 1.105), (-1.02, 0.985)],
                 bot=[(0.62, 0.895), (-0.40, 0.917), (-0.86, 0.945), (-1.02, 0.975)], pillars=[-0.517])
    if roof: k.decal('roof', roof, 'top', -0.70, 0.17, -0.50 * ys, 0.50 * ys, 16, 12, off=.003)
    if hood: k.decal('hood', hood, 'top', 1.25, 2.10, -0.46 * ys, 0.46 * ys, 16, 12, off=.003)
    for s in (1, -1):
        for xg in (0.64, -0.62): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.25, 0.89, 1, 12, off=.002)
        k.decal('handle', 'Black', side(s), -0.40, -0.26, 0.835, 0.855, 4, 1, off=.003)
        if rear_intakes: k.slanted('sideintake', 'Gloss', s, -0.70, -0.86, 0.56, 0.74, lean=0.08, nu=6)
    k.mirrors(0.47, 1.01 * ys, 0.995)
    k.light_bar(-1.55, 0.856, 0.890, 0.84, bg=0.022, frac=1.0)
    k.interior(-0.25, 1.3 * ys, 0.72)

def engine_grille(k, x0=-2.12, x1=-1.68, hw=0.50, slats=9, mat='Carbon'):
    k.decal('enginegrille', 'Gloss', 'top', x0, x1, -hw, hw, 6, 12)
    step = (x1 - x0) / slats
    for i in range(slats):
        k.decal('engineslat', mat, 'top', x0 + .02 + i * step, x0 + .036 + i * step, -hw + .02, hw - .02, 1, 12, off=.010)

def gt3rs(k):
    body_911(k)
    # front: big RS intakes, carbon splitter, hood nostrils with slats, fender-top louvres, arch exit vents
    k.decal('intakeC', 'Gloss', 'front', -0.40, 0.40, 0.235, 0.40, 16, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.48, s * 0.74, 0.235, 0.44, 8, 6))
    k.decal('splitter', 'Carbon', 'front', -0.82, 0.82, 0.19, 0.228, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.62, 2.00, s * 0.08, s * 0.34, 8, 6))
    for i in range(4):
        both(lambda s, i=i: k.decal('hoodslat', 'Carbon', 'top', 1.62, 2.00, s * (0.11 + i * .065), s * (0.125 + i * .065), 8, 1, off=.010))
    for i in range(7):
        both(lambda s, i=i: k.decal('louvre', 'Gloss', 'top', 0.98 + i * .062, 1.012 + i * .062, s * 0.62, s * 0.84, 1, 5))
    both(lambda s: k.slanted('archvent', 'Gloss', s, 0.70, 0.79, 0.42, 0.70, lean=0.05, nu=3, nv=8))
    k.headlight_911((2.03, 0.62, 0.69), (0.72, 0.22, 0.66))
    # rear: engine-lid grille, black bumper, carbon diffuser, twin centre pipes, side skirts
    engine_grille(k)
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.66, -0.60, 0.60, 30, 4)
    k.fan('diffuser', 'Carbon', -1.55, 0.35, 0.47, -0.60, 0.60, 30, 3)
    both(lambda s: k.decal('skirt', 'Carbon', side(s), -0.92, 0.86, 0.163, 0.235, 30, 2))
    k.exhaust(0.075, 0.40)
    # swan-neck wing with DRS flap and big end plates
    k.swan_wing(-1.66, 1.32, 0.44, 1.80, -1.66, 0.30, flap=(-2.04, 1.405, 0.20, -22),
                endplate=[(-1.60, 1.29), (-1.63, 1.45), (-2.18, 1.49), (-2.25, 1.36), (-2.05, 1.27)])
    k.join(); k.wheels(spokes=10)

def front_911(k, style, ys=1.0):
    """992 front bumpers: 'rs' (huge intakes), 'gt3', 'touring', 'gt2rs', 'turbo', 'dakar'"""
    if style in ('gt3', 'touring', 'dakar'):
        k.decal('intakeC', 'Gloss', 'front', -0.36, 0.36, 0.24, 0.37, 16, 5)
        both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.50, s * 0.72 * ys, 0.25, 0.42, 8, 6))
        k.decal('splitter', 'Carbon' if style == 'gt3' else 'Gloss', 'front', -0.78, 0.78, 0.19, 0.225, 30, 2)
    elif style in ('gt2rs', 'turbo'):
        k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.22, 0.34, 16, 4)
        both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.44, s * 0.80, 0.22, 0.46, 10, 6))
        for i in range(3):   # horizontal slats across the big side intakes
            both(lambda s, i=i: k.decal('intakeslat', 'Paint' if style == 'turbo' else 'Carbon', 'front', s * 0.46, s * 0.78, 0.29 + i * .055, 0.30 + i * .055, 10, 1, off=.010))
        k.decal('splitter', 'Carbon' if style == 'gt2rs' else 'Gloss', 'front', -0.86, 0.86, 0.17, 0.215, 30, 2)
    if style == 'dakar':   # skid plate + red tow hooks
        k.decal('skid', 'Black', 'front', -0.62, 0.62, 0.16, 0.24, 20, 2, off=.006)
        both(lambda s: k.box('towhook', 'Accent', (2.25, s * 0.30, 0.26), (0.10, 0.03, 0.06), bevel=.008))

# ---- 911 GT3: narrow Carrera body, swan-neck single-element wing, no fender louvres
def gt3(k):
    ys = 0.975
    body_911(k, ys, rear_intakes=False, roof=None)
    front_911(k, 'gt3', ys)
    both(lambda s: k.decal('nostril', 'Gloss', 'top', 1.70, 1.98, s * 0.10, s * 0.30, 6, 5))
    k.headlight_911((2.03, 0.62 * ys, 0.69), (0.72, 0.22, 0.66))
    engine_grille(k, hw=0.48)
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.62, -0.55, 0.55, 30, 4)
    k.fan('diffuser', 'Carbon', -1.55, 0.35, 0.47, -0.55, 0.55, 30, 3)
    k.exhaust(0.08, 0.40, r=0.055)
    k.swan_wing(-1.72, 1.22, 0.36, 1.64, -1.72, 0.30, aoa=-6,
                endplate=[(-1.68, 1.19), (-1.70, 1.31), (-2.12, 1.34), (-2.16, 1.24), (-2.02, 1.17)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.026, 0.017))

# ---- 911 GT3 Touring: no fixed wing, deployable spoiler, silver window frames
def gt3t(k):
    ys = 0.975
    body_911(k, ys, rear_intakes=False, roof=None)
    front_911(k, 'touring', ys)
    k.headlight_911((2.03, 0.62 * ys, 0.69), (0.72, 0.22, 0.66))
    engine_grille(k, x0=-2.06, x1=-1.70, hw=0.44, slats=8, mat='Gloss')
    k.spoiler(-1.98, 1.03, 0.26, 1.30, strut_y=0.30)
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.58, -0.50, 0.50, 30, 3)
    k.fan('diffuser', 'Gloss', -1.55, 0.35, 0.47, -0.55, 0.55, 30, 3)
    k.exhaust(0.08, 0.40, r=0.055)
    for s in (1, -1):   # aluminium-look side window frames
        k.project('chromeline', 'Chrome', lambda u, v, s=s: k.VIEW[side(s)](lerp(0.60, -0.98, u), lerp(0.880, 0.893, v) + 0.06 * max(0, -0.40 - lerp(0.60, -0.98, u))), 30, 1, off=.006)
    k.join(); k.wheels(spokes=10, spoke_w=(0.026, 0.017))

# ---- 911 S/T: lightweight Touring with a fixed ducktail, carbon hood and roof, magnesium wheels
T911_DUCK = edit(edit(T911, -2.19, zt=1.035, zr=1.02, zg=1.0, zbl=.945), -2.30, zt=1.04, zr=1.03, zg=1.0, zbl=.90)
def st(k):
    ys = 0.975
    body_911(k, ys, rows=T911_DUCK, rear_intakes=False, roof='Carbon', hood='Carbon')
    front_911(k, 'touring', ys)
    k.headlight_911((2.03, 0.62 * ys, 0.69), (0.72, 0.22, 0.66))
    engine_grille(k, x0=-2.02, x1=-1.68, hw=0.44, slats=8, mat='Gloss')
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.58, -0.50, 0.50, 30, 3)
    k.fan('diffuser', 'Gloss', -1.55, 0.35, 0.47, -0.55, 0.55, 30, 3)
    k.exhaust(0.08, 0.40, r=0.052)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# ---- 911 GT2 RS: wide body, NACA ducts, fender gills, huge wing on uprights, big titanium pipes
def gt2rs(k):
    body_911(k, roof='Carbon', hood='Carbon')
    front_911(k, 'gt2rs')
    k.naca(1.55, 1.95, 0.22, 0.03, 0.16)
    for i in range(6):
        both(lambda s, i=i: k.decal('gill', 'Gloss', 'top', 0.98 + i * .07, 1.015 + i * .07, s * 0.64, s * 0.84, 1, 5))
    k.headlight_911((2.03, 0.62, 0.69), (0.72, 0.22, 0.66))
    engine_grille(k, x0=-2.10, x1=-1.80, hw=0.46, slats=7)
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.66, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.55, 0.33, 0.47, -0.62, 0.62, 30, 3)
    both(lambda s: k.decal('skirt', 'Carbon', side(s), -0.92, 0.86, 0.163, 0.235, 30, 2))
    k.exhaust(0.10, 0.42, r=0.068)
    k.post_wing(-1.66, 1.30, 0.42, 1.74, -1.86, 0.36, aoa=-8,
                endplate=[(-1.60, 1.25), (-1.62, 1.40), (-2.16, 1.44), (-2.20, 1.30), (-2.02, 1.22)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# ---- 911 Turbo S: wide body with big rear-fender intakes, active wing deployed, outboard rectangular pipes
def turbos(k):
    body_911(k, roof=None)
    front_911(k, 'turbo')
    k.headlight_911((2.03, 0.62, 0.69), (0.72, 0.22, 0.66))
    for s in (1, -1): k.slanted('sideintake2', 'Gloss', s, -0.68, -0.90, 0.52, 0.80, lean=0.10, nu=6)
    engine_grille(k, x0=-2.06, x1=-1.70, hw=0.46, slats=10, mat='Gloss')
    k.spoiler(-1.80, 1.10, 0.40, 1.62, aoa=-6, strut_y=0.42)
    k.fan('rearpanel', 'Gloss', -1.55, 0.47, 0.60, -0.62, 0.62, 30, 3)
    k.fan('diffuser', 'Gloss', -1.55, 0.35, 0.47, -0.66, 0.66, 30, 3)
    k.exhaust(0.56, 0.42, shape='rect', w=0.15, h=0.085)
    k.join(); k.wheels(spokes=5, pairs=True, spoke_w=(0.024, 0.016))

# ---- 911 Dakar: rally-raised 911 on all-terrain tyres, arch cladding, roof basket with spot lights
DAKAR_LIFT = 0.06
W_DAKAR = dict(F=dict(x=1.22, r=0.360, w=0.255, y=0.785, rim=0.240, cz=0.36 - DAKAR_LIFT + 0.01, gap=0.07),
               R=dict(x=-1.24, r=0.370, w=0.285, y=0.79, rim=0.245, cz=0.37 - DAKAR_LIFT + 0.01, gap=0.07))
def dakar(k):
    ys = 0.98
    body_911(k, ys, wheels=W_DAKAR, rear_intakes=False, roof=None)
    front_911(k, 'dakar', ys)
    k.headlight_911((2.03, 0.62 * ys, 0.69), (0.72, 0.22, 0.66))
    k.arch_trim(0.07)
    both(lambda s: k.decal('cladding', 'Black', side(s), -0.86, 0.80, 0.14, 0.30, 30, 3, off=.006))
    engine_grille(k, x0=-2.06, x1=-1.70, hw=0.44, slats=8, mat='Gloss')
    k.spoiler(-1.84, 1.06, 0.34, 1.50, aoa=-5, strut_y=0.40, mat='Paint')
    k.fan('rearpanel', 'Black', -1.55, 0.40, 0.60, -0.62, 0.62, 30, 4)
    k.exhaust(0.08, 0.44, r=0.05)
    both(lambda s: k.box('towhook_r', 'Accent', (-2.33, s * 0.32, 0.36), (0.10, 0.03, 0.06), bevel=.008))
    k.roof_rack(-0.78, 0.12, 0.50, 1.40)
    k.join(lift=DAKAR_LIFT); k.wheels(spokes=10, spoke_w=(0.03, 0.02), nut='bolts', offroad=True)

# ======================================================================= 718 (982) - mid-engine
# front axle x=1.34, rear axle x=-1.14, 4.45 m long, 1.82 m wide
T718 = [
    ( 2.22, .27, .62, .40, .60, .46, .52, .49, .30, .50, .495),
    ( 2.15, .17, .80, .44, .78, .54, .65, .61, .42, .555, .545),
    ( 2.00, .15, .86, .49, .845, .62, .68, .71, .48, .60, .59),
    ( 1.75, .14, .89, .54, .875, .70, .70, .77, .50, .655, .645),
    ( 1.34, .14, .905, .60, .89, .79, .72, .845, .51, .74, .725),
    ( 1.00, .13, .90, .615, .885, .835, .74, .875, .50, .815, .80),
    ( 0.70, .13, .89, .61, .875, .86, .76, .93, .58, 1.00, 1.03),
    ( 0.30, .13, .88, .60, .865, .875, .73, 1.08, .62, 1.235, 1.255),
    (-0.20, .13, .885, .60, .87, .885, .72, 1.11, .63, 1.25, 1.267),
    (-0.60, .13, .90, .62, .88, .90, .71, 1.08, .61, 1.19, 1.205),
    (-0.95, .14, .915, .65, .89, .925, .69, 1.02, .57, 1.085, 1.10),
    (-1.14, .16, .915, .665, .89, .94, .67, .995, .53, 1.03, 1.04),
    (-1.45, .19, .91, .68, .885, .95, .64, .985, .48, .99, 1.00),
    (-1.80, .23, .885, .69, .86, .95, .60, .975, .44, .975, .985),
    (-2.08, .28, .82, .68, .79, .93, .54, .955, .36, .955, .965),
    (-2.23, .36, .62, .64, .58, .87, .44, .895, .25, .89, .90),
]
W718 = dict(F=dict(x=1.34, r=0.340, w=0.245, y=0.745, rim=0.254), R=dict(x=-1.14, r=0.343, w=0.295, y=0.755, rim=0.254))

def front_718(k):
    k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.22, 0.36, 16, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.44, s * 0.72, 0.22, 0.42, 8, 6))
    k.decal('splitter', 'Carbon', 'front', -0.80, 0.80, 0.175, 0.215, 30, 2)
    k.headlight_911((1.99, 0.60, 0.665), (0.72, 0.24, 0.62), rx=0.105, ry=0.085)
def rear_718(k, tail_z=(0.80, 0.86)):
    k.fan('tailband', 'Gloss', -1.40, tail_z[0] - .02, tail_z[1] + .02, -0.80, 0.80, 50, 3, off=.003)
    k.tail_clusters(-1.40, tail_z[0], tail_z[1], 0.42, 0.80)
    k.fan('rearpanel', 'Gloss', -1.40, 0.45, 0.62, -0.55, 0.55, 30, 4)
    k.fan('diffuser', 'Carbon', -1.40, 0.33, 0.45, -0.60, 0.60, 30, 3)
    k.exhaust(0.07, 0.42, r=0.05)

# ---- 718 Cayman GT4 RS: NACA ducts, process-air intakes in the rear side windows, swan-neck wing
def gt4rs(k):
    k.loft(stations(T718)); k.arches(W718); k.surface()
    k.windscreen(0.88, 0.12, 0.86, 0.50, 0.58, 0.52)
    k.rear_window(-1.30, -0.66, 1.02, 0.25, 0.40, 0.46, bulge=0.04)
    top = [(0.62, 0.905), (0.42, 1.02), (0.12, 1.20), (-0.25, 1.235), (-0.60, 1.19), (-0.90, 1.08), (-1.10, 0.975)]
    bot = [(0.62, 0.90), (-0.40, 0.915), (-0.95, 0.95), (-1.10, 0.97)]
    k.side_glass(top, bot, pillars=[-0.52])
    for s in (1, -1):
        k.project('quarterintake', 'Gloss', lambda u, v, s=s: k.VIEW[side(s)](lerp(-0.56, -1.00, u), lerp(0.93, 1.14 - 0.25 * u, v)), 8, 6, off=.007)
        for xg in (0.62, -0.46): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.25, 0.89, 1, 12, off=.002)
        k.decal('handle', 'Black', side(s), -0.28, -0.16, 0.835, 0.855, 4, 1, off=.003)
        k.slanted('sideintake', 'Gloss', s, -0.48, -0.86, 0.45, 0.80, lean=0.12, nu=8, nv=8)
        k.decal('skirt', 'Carbon', side(s), -0.70, 0.95, 0.155, 0.225, 30, 2)
    k.decal('roof', 'Carbon', 'top', -0.55, 0.05, -0.48, 0.48, 12, 10, off=.003)
    front_718(k)
    k.naca(1.45, 1.85, 0.20, 0.03, 0.15)
    rear_718(k)
    k.mirrors(0.52, 0.99, 0.99)
    k.swan_wing(-1.80, 1.22, 0.36, 1.62, -1.80, 0.30, aoa=-7,
                endplate=[(-1.76, 1.19), (-1.78, 1.31), (-2.20, 1.34), (-2.24, 1.24), (-2.10, 1.17)])
    k.interior(-0.15, 1.28, 0.72, seats_x=-0.42)
    k.join(); k.wheels(spokes=10)

# ---- 718 Spyder RS: open top, low windscreen, streamlined humps behind the seats, moulded ducktail
T718_SPY = T718[:6] + [
    ( 0.70, .13, .89, .61, .875, .86, .76, .90, .58, .905, .91),
    ( 0.30, .13, .88, .60, .865, .875, .74, .925, .55, .93, .93),
    (-0.20, .13, .885, .60, .87, .885, .74, .935, .55, .94, .94),
    (-0.60, .13, .90, .62, .88, .90, .72, .945, .53, .95, .95),
    (-0.95, .14, .915, .65, .89, .925, .69, .96, .50, .965, .965),
] + edit(edit(T718[11:], -2.08, zt=1.005, zr=1.0, zg=.985), -2.23, zt=1.02, zr=1.01, zg=.99, zbl=.92)
def spyrs(k):
    k.loft(stations(T718_SPY)); k.arches(W718)
    k.cut_box((-0.12, 0, 1.20), (1.40, 1.26, 0.80), round_=0.12)      # the cockpit
    k.surface()
    def ws(u, v):   # free-standing raked windscreen
        y = lerp(-1, 1, u) * lerp(0.62, 0.55, v); x = lerp(0.84, 0.44, v) - 0.10 * (y / 0.62) ** 2
        return V(x, y, lerp(0.89, 1.12, v) - 0.03 * (y / 0.62) ** 2)
    k.panel('windscreen', 'Glass', ws, 16, 6)
    k.panel('ws_frame', 'Gloss', lambda u, v: ws(u, 1.0) + V(-v * .02, 0, v * .03), 16, 1, thick=0.02)
    for s in (1, -1):
        k.panel('apillar', 'Gloss', lambda u, v, s=s: ws(0 if s < 0 else 1, u) + V(0, s * v * .025, 0), 6, 1, thick=0.02)
        k.decal('doorline', 'Black', side(s), 0.62 - .004, 0.62 + .004, 0.25, 0.89, 1, 12, off=.002)
        k.decal('doorline', 'Black', side(s), -0.50 - .004, -0.50 + .004, 0.25, 0.89, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, -0.52, -0.86, 0.45, 0.78, lean=0.12, nu=8, nv=8)
    # humps behind the headrests, with the process-air snorkels at their noses
    k.pod('hump', 'Paint', [(-0.55, 0.36, 0.93, 0.05, 0.03), (-0.65, 0.36, 1.00, 0.16, 0.12), (-1.0, 0.36, 1.00, 0.18, 0.11),
                            (-1.5, 0.36, 0.98, 0.16, 0.07), (-1.95, 0.36, 0.96, 0.10, 0.02)], flat=0.6)
    both(lambda s: k.box('snorkel', 'Gloss', (-0.70, s * 0.36, 1.06), (0.04, 0.16, 0.07), bevel=.01))
    front_718(k)
    k.naca(1.45, 1.85, 0.20, 0.03, 0.14)
    rear_718(k, (0.82, 0.875))
    k.mirrors(0.55, 0.99, 0.99)
    k.interior(-0.10, 1.24, 0.66, h=0.24, seats_x=-0.40, seat_z=0.80, open_top=True, wheel_x=0.30)
    k.join(); k.wheels(spokes=10)

# ======================================================================= 918 Spyder - 1.167 m tall hybrid hypercar
# front axle x=1.33, rear axle x=-1.40
T918 = [
    ( 2.32, .24, .62, .36, .60, .42, .50, .45, .30, .455, .45),
    ( 2.24, .15, .84, .40, .82, .50, .68, .56, .40, .50, .49),
    ( 2.05, .13, .92, .46, .90, .58, .74, .66, .46, .545, .53),
    ( 1.70, .12, .955, .53, .94, .67, .76, .74, .48, .60, .58),
    ( 1.33, .12, .965, .58, .95, .73, .77, .79, .48, .66, .64),
    ( 1.00, .11, .95, .60, .935, .77, .76, .80, .47, .74, .72),
    ( 0.70, .11, .93, .60, .915, .80, .74, .85, .55, .92, .95),
    ( 0.30, .11, .91, .59, .895, .81, .70, .98, .58, 1.10, 1.13),
    (-0.20, .11, .91, .59, .895, .82, .69, 1.00, .58, 1.15, 1.167),
    (-0.55, .11, .935, .61, .915, .84, .70, .98, .58, 1.11, 1.12),
    (-0.90, .12, .965, .64, .94, .87, .70, .96, .42, .965, .955),
    (-1.40, .15, .97, .66, .945, .90, .68, .96, .40, .945, .935),
    (-1.80, .19, .96, .67, .935, .91, .64, .955, .40, .94, .93),
    (-2.15, .24, .92, .66, .89, .90, .56, .93, .35, .925, .915),
    (-2.32, .33, .70, .62, .66, .86, .46, .88, .26, .875, .87),
]
W918 = dict(F=dict(x=1.33, r=0.347, w=0.265, y=0.80, rim=0.254), R=dict(x=-1.40, r=0.364, w=0.325, y=0.80, rim=0.267))
def p918(k):
    k.loft(stations(T918)); k.arches(W918); k.surface()
    k.windscreen(0.80, 0.08, 0.80, 0.46, 0.60, 0.50, sweep=0.22)
    top = [(0.64, 0.835), (0.40, 0.96), (0.10, 1.115), (-0.25, 1.14), (-0.45, 1.11), (-0.58, 1.00)]
    bot = [(0.64, 0.83), (-0.58, 0.855)]
    k.side_glass(top, bot)
    k.decal('roof', 'Carbon', 'top', -0.48, 0.10, -0.48, 0.48, 12, 10, off=.003)      # targa panels
    k.decal('bulkhead', 'Gloss', 'rear', -0.40, 0.40, 0.98, 1.10, 10, 3, off=.004)
    # flying buttresses over the rear deck, top-exit exhausts between them
    k.pod('buttress', 'Paint', [(-0.42, 0.47, 1.04, 0.08, 0.06), (-0.75, 0.48, 1.04, 0.15, 0.09), (-1.30, 0.50, 1.00, 0.15, 0.08),
                                (-1.85, 0.51, 0.965, 0.13, 0.05), (-2.15, 0.51, 0.94, 0.06, 0.02)], flat=0.6)
    for s in (1, -1):
        k.cylinder('toppipe', 'Titanium', (-0.98, s * 0.21, 1.0), 0.055, 0.12, axis='Z', caps=False)
        k.cylinder('toppipein', 'Black', (-0.98, s * 0.21, 0.99), 0.05, 0.10, axis='Z')
        k.decal('doorline', 'Black', side(s), 0.66 - .004, 0.66 + .004, 0.22, 0.82, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, -0.66, -0.98, 0.38, 0.68, lean=0.10, nu=8, nv=6)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.00, 0.14, 0.21, 30, 2)
    k.decal('deckgrille', 'Gloss', 'top', -1.80, -1.20, -0.30, 0.30, 8, 8)
    # front: vertical teardrop headlights, big intakes
    k.headlight_911((2.12, 0.66, 0.60), (0.78, 0.20, 0.58), rx=0.075, ry=0.115)
    k.decal('intakeC', 'Gloss', 'front', -0.30, 0.30, 0.20, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.40, s * 0.78, 0.19, 0.40, 10, 6))
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.15, 0.19, 30, 2)
    # rear: thin full-width light bar, carbon diffuser, active wing
    k.light_bar(-1.70, 0.845, 0.865, 0.78, bg=0.015, frac=1.0)
    k.fan('rearpanel', 'Gloss', -1.70, 0.48, 0.70, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.70, 0.34, 0.48, -0.62, 0.62, 30, 3)
    k.spoiler(-2.02, 1.02, 0.26, 1.16, aoa=-6, mat='Carbon', strut_y=0.30)
    k.mirrors(0.58, 1.03, 0.93, size=(0.13, 0.17, 0.08))
    k.interior(-0.12, 1.22, 0.66, h=0.30, seats_x=-0.35, seat_z=0.78)
    k.join(); k.wheels(spokes=5, pairs=True)

# ======================================================================= Taycan Turbo GT - 4-door electric sports saloon
# front axle x=1.50, rear axle x=-1.40
TTAY = [
    ( 2.48, .26, .64, .42, .62, .50, .52, .53, .32, .54, .535),
    ( 2.40, .17, .86, .46, .84, .58, .70, .64, .44, .60, .59),
    ( 2.20, .15, .94, .51, .92, .66, .76, .73, .52, .655, .645),
    ( 1.90, .14, .965, .56, .95, .74, .78, .80, .54, .72, .705),
    ( 1.50, .14, .975, .61, .96, .80, .79, .855, .54, .80, .785),
    ( 1.15, .13, .965, .63, .95, .845, .79, .88, .53, .865, .85),
    ( 0.85, .13, .955, .63, .94, .88, .80, .95, .62, 1.06, 1.08),
    ( 0.45, .13, .95, .62, .935, .90, .77, 1.12, .65, 1.30, 1.33),
    ( 0.00, .13, .95, .62, .935, .91, .76, 1.16, .66, 1.355, 1.381),
    (-0.50, .13, .955, .63, .94, .92, .755, 1.15, .65, 1.34, 1.365),
    (-1.00, .14, .97, .65, .95, .94, .74, 1.10, .62, 1.25, 1.27),
    (-1.40, .16, .983, .67, .955, .955, .72, 1.05, .58, 1.14, 1.16),
    (-1.80, .19, .975, .68, .945, .96, .68, 1.00, .52, 1.04, 1.05),
    (-2.15, .24, .93, .68, .90, .955, .60, .985, .44, .99, .995),
    (-2.40, .30, .84, .67, .81, .93, .52, .955, .36, .955, .96),
    (-2.50, .38, .64, .63, .60, .87, .42, .89, .26, .885, .885),
]
WTAY = dict(F=dict(x=1.50, r=0.360, w=0.265, y=0.825, rim=0.267), R=dict(x=-1.40, r=0.358, w=0.305, y=0.83, rim=0.267))
def taycangt(k):
    k.loft(stations(TTAY)); k.arches(WTAY); k.surface()
    k.windscreen(1.00, 0.28, 0.87, 0.57, 0.66, 0.60, sweep=0.24)
    k.rear_window(-1.95, -1.10, 1.00, 0.29, 0.45, 0.54)
    top = [(0.80, 0.93), (0.55, 1.06), (0.25, 1.25), (-0.30, 1.30), (-0.85, 1.24), (-1.25, 1.12), (-1.50, 0.99)]
    bot = [(0.80, 0.925), (-0.60, 0.935), (-1.30, 0.955), (-1.50, 0.975)]
    k.side_glass(top, bot, pillars=[-0.07, -1.08], pillar_w=0.05)
    k.decal('roof', 'Carbon', 'top', -1.05, 0.25, -0.54, 0.54, 16, 12, off=.003)
    for s in (1, -1):
        for xg in (0.80, -0.08, -1.12): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.25, 0.92, 1, 12, off=.002)
        for xh in (0.15, -0.85): k.decal('handle', 'Black', side(s), xh - .14, xh, 0.86, 0.875, 4, 1, off=.003)
        k.decal('skirt', 'Carbon', side(s), -1.00, 1.05, 0.16, 0.24, 30, 2)
        k.slanted('aircurtain', 'Gloss', s, 2.30, 2.22, 0.24, 0.52, lean=-0.03, nu=3, nv=8)
    k.headlight_quad((2.24, 0.66, 0.70), (0.72, 0.28, 0.52), 0.17, 0.11)
    k.decal('intakeC', 'Gloss', 'front', -0.52, 0.52, 0.22, 0.38, 18, 5)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.18, 0.215, 30, 2)
    k.light_bar(-1.90, 0.905, 0.935, 0.86, bg=0.02, frac=1.0)
    k.fan('rearpanel', 'Gloss', -1.90, 0.45, 0.58, -0.60, 0.60, 30, 3)
    k.fan('diffuser', 'Carbon', -1.90, 0.32, 0.45, -0.66, 0.66, 30, 3)
    k.spoiler(-2.30, 1.03, 0.22, 1.30, aoa=-5, mat='Carbon', strut_y=0.40)
    k.mirrors(0.74, 1.04, 1.01)
    k.interior(-0.40, 1.40, 0.74, l=2.2, h=0.38, seats_x=-0.20)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

# ======================================================================= SUVs
# Cayenne Turbo GT coupe: front axle x=1.50, rear axle x=-1.40, 4.93 m long, 1.99 m wide, 1.64 m tall
TCAY = [
    ( 2.46, .38, .70, .60, .68, .74, .58, .78, .36, .80, .80),
    ( 2.38, .28, .88, .64, .86, .82, .74, .86, .48, .87, .87),
    ( 2.20, .25, .96, .70, .945, .92, .80, .97, .56, .945, .94),
    ( 1.85, .23, .985, .76, .97, .99, .82, 1.03, .57, 1.00, .99),
    ( 1.50, .22, .995, .79, .98, 1.03, .83, 1.06, .58, 1.04, 1.03),
    ( 1.15, .21, .99, .80, .975, 1.06, .84, 1.09, .58, 1.10, 1.09),
    ( 0.85, .21, .98, .80, .965, 1.09, .85, 1.16, .66, 1.25, 1.27),
    ( 0.45, .21, .975, .79, .96, 1.11, .82, 1.33, .69, 1.56, 1.60),
    ( 0.00, .21, .975, .79, .96, 1.12, .81, 1.37, .70, 1.62, 1.64),
    (-0.60, .21, .98, .80, .965, 1.13, .80, 1.36, .69, 1.58, 1.61),
    (-1.10, .22, .99, .82, .975, 1.15, .78, 1.30, .65, 1.48, 1.51),
    (-1.40, .24, .995, .83, .98, 1.16, .76, 1.25, .62, 1.40, 1.42),
    (-1.80, .28, .985, .84, .97, 1.16, .72, 1.20, .56, 1.27, 1.29),
    (-2.15, .33, .95, .83, .93, 1.15, .66, 1.17, .48, 1.19, 1.20),
    (-2.38, .38, .86, .80, .84, 1.12, .58, 1.14, .40, 1.15, 1.16),
    (-2.48, .44, .66, .76, .64, 1.06, .46, 1.08, .28, 1.09, 1.09),
]
# Cayenne (SUV body): the roof stays high to a steep tailgate
TCAY_SUV = TCAY[:7] + [
    ( 0.45, .21, .975, .79, .96, 1.11, .82, 1.33, .70, 1.62, 1.66),
    ( 0.00, .21, .975, .79, .96, 1.12, .81, 1.38, .72, 1.665, 1.69),
    (-0.60, .21, .98, .80, .965, 1.13, .80, 1.39, .72, 1.665, 1.69),
    (-1.10, .22, .99, .82, .975, 1.15, .79, 1.38, .71, 1.65, 1.675),
    (-1.40, .24, .995, .83, .98, 1.16, .78, 1.36, .70, 1.62, 1.645),
    (-1.80, .28, .985, .84, .97, 1.16, .74, 1.30, .66, 1.53, 1.555),
    (-2.15, .33, .95, .83, .93, 1.15, .68, 1.22, .56, 1.34, 1.36),
    (-2.38, .38, .86, .80, .84, 1.12, .60, 1.16, .44, 1.21, 1.22),
    (-2.48, .44, .66, .76, .64, 1.06, .46, 1.10, .30, 1.12, 1.12),
]
WCAY = dict(F=dict(x=1.50, r=0.379, w=0.285, y=0.845, rim=0.279), R=dict(x=-1.40, r=0.374, w=0.315, y=0.85, rim=0.279))

def suv_common(k, glass_top, glass_bot, pillars, doors, handles, mirror_x, cabin_l=2.4):
    for s in (1, -1):
        for xg in doors: k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.30, 1.13, 1, 14, off=.002)
        for xh in handles: k.decal('handle', 'Black', side(s), xh - .16, xh, 1.06, 1.08, 4, 1, off=.003)
    k.side_glass(glass_top, glass_bot, pillars=pillars, pillar_w=0.06)
    k.arch_trim(0.05, mat='Gloss')
    both(lambda s: k.decal('sill', 'Gloss', side(s), -1.02, 1.08, 0.22, 0.34, 30, 3, off=.005))
    k.mirrors(mirror_x, 1.07, 1.22, size=(0.17, 0.22, 0.12))
    k.interior(-0.45, 1.5, 0.98, l=cabin_l, h=0.42, seats_x=-0.20, seat_z=1.06)

def cayenne_front(k, carbon=False):
    k.headlight_quad((2.30, 0.70, 0.93), (0.75, 0.30, 0.45), 0.24, 0.12)
    k.decal('grille', 'Gloss', 'front', -0.46, 0.46, 0.46, 0.70, 18, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.55, s * 0.84, 0.40, 0.72, 10, 8))
    for i in range(3):
        k.decal('grillebar', 'Gloss' if not carbon else 'Carbon', 'front', -0.44, 0.44, 0.52 + i * .06, 0.53 + i * .06, 18, 1, off=.010)
    k.decal('lip', 'Carbon' if carbon else 'Gloss', 'front', -0.82, 0.82, 0.30, 0.38, 30, 2)
def cayenne_rear(k, ox=-1.90, carbon=False):
    k.light_bar(ox, 1.035, 1.075, 0.84, bg=0.025, frac=0.5)
    k.tail_clusters(ox, 1.00, 1.11, 0.62, 0.84)
    k.fan('rearpanel', 'Gloss', ox, 0.52, 0.66, -0.62, 0.62, 30, 3)
    k.fan('diffuser', 'Carbon' if carbon else 'Gloss', ox, 0.40, 0.52, -0.66, 0.66, 30, 3)

# ---- Cayenne Turbo GT: coupe roofline, carbon roof, roof + tailgate spoilers, central titanium pipes
def cayennegt(k):
    k.loft(stations(TCAY), crease_lines=0.4); k.arches(WCAY); k.surface()
    k.windscreen(1.05, 0.30, 1.10, 0.64, 0.70, 0.63, sweep=0.26)
    k.rear_window(-2.12, -1.15, 1.21, 0.27, 0.50, 0.58)
    suv_common(k, [(0.85, 1.13), (0.60, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.40, 1.36), (-1.75, 1.20)],
               [(0.85, 1.12), (-0.60, 1.135), (-1.40, 1.16), (-1.75, 1.175)], [-0.15, -1.15], (0.86, -0.17, -1.22), (0.15, -0.90), 0.80)
    k.decal('roof', 'Carbon', 'top', -1.10, 0.30, -0.58, 0.58, 16, 12, off=.003)
    cayenne_front(k, carbon=True); cayenne_rear(k, carbon=True)
    k.wing(-1.10, 1.505, 0.18, 1.10, aoa=-4, thick=0.08, mat='Gloss', camber=-0.02, name='roofspoiler')
    k.spoiler(-2.28, 1.24, 0.22, 1.40, aoa=-5, mat='Paint', strut_y=0.45)
    k.exhaust(0.10, 0.47, r=0.065)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.03, 0.018), caliper=(0.26, 0.085, 0.10))

# ---- Cayenne Turbo E-Hybrid: SUV roofline with roof rails and roof spoiler, twin double tailpipes
def cayenneeh(k):
    k.loft(stations(TCAY_SUV), crease_lines=0.4); k.arches(WCAY); k.surface()
    k.windscreen(1.05, 0.30, 1.10, 0.64, 0.70, 0.63, sweep=0.26)
    k.rear_window(-2.30, -1.95, 1.22, 0.94, 0.52, 0.58, bulge=0.03)
    suv_common(k, [(0.85, 1.13), (0.60, 1.30), (0.30, 1.55), (-0.30, 1.605), (-1.20, 1.595), (-1.70, 1.53), (-1.95, 1.38), (-2.02, 1.20)],
               [(0.85, 1.12), (-0.60, 1.135), (-1.60, 1.16), (-2.02, 1.17)], [-0.15, -1.25], (0.86, -0.17, -1.30), (0.15, -0.95), 0.80)
    for s in (1, -1):   # roof rails
        k.blade('rail', 'Gloss', [(0.02, 0, k.deck_z(0.02, s * .58) + .02), (-0.60, 0, k.deck_z(-0.60, s * .58) + .04), (-1.70, 0, k.deck_z(-1.70, s * .58) + .03)], s * 0.58, 0.04, 0.04, 0.03)
    k.wing(-1.93, 1.625, 0.20, 1.20, aoa=-6, thick=0.08, mat='Paint', camber=-0.02, name='roofspoiler')
    cayenne_front(k); cayenne_rear(k, ox=-1.95)
    k.exhaust(0.52, 0.47, shape='rect', w=0.13, h=0.07)
    k.exhaust(0.68, 0.47, shape='rect', w=0.13, h=0.07)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.26, 0.085, 0.10))

# ---- Macan Turbo Electric: smaller coupe-SUV, split headlights, no grille, no pipes
def mx(x):  # Cayenne coupe stations -> Macan (front axle 1.45, rear axle -1.44, 4.78 m)
    from carkit import pl
    return pl([(-2.48, -2.39), (-1.40, -1.44), (1.50, 1.45), (2.46, 2.39)], x)
TMAC = [(mx(r[0]),) + tuple(v * (.975 if i % 2 else .985) if i else v for i, v in enumerate(r[1:])) for r in TCAY]
TMAC = edit(edit(edit(TMAC, TMAC[0][0], zt=.76, zr=.76, zg=.74), TMAC[1][0], zt=.84, zr=.845), TMAC[2][0], zt=.915, zr=.92)
WMAC = dict(F=dict(x=1.45, r=0.368, w=0.255, y=0.82, rim=0.267), R=dict(x=-1.44, r=0.370, w=0.295, y=0.83, rim=0.267))
def macanev(k):
    k.loft(stations(TMAC), crease_lines=0.4); k.arches(WMAC); k.surface()
    k.windscreen(mx(1.05), mx(0.30), 1.085, 0.64, 0.68, 0.61, sweep=0.26)
    k.rear_window(mx(-2.12), mx(-1.15), 1.19, 0.27, 0.48, 0.56)
    top = [(mx(x), z * .985) for x, z in [(0.85, 1.13), (0.60, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.40, 1.36), (-1.75, 1.20)]]
    bot = [(mx(x), z * .985) for x, z in [(0.85, 1.12), (-0.60, 1.135), (-1.40, 1.16), (-1.75, 1.175)]]
    suv_common(k, top, bot, [mx(-0.15), mx(-1.15)], (mx(0.86), mx(-0.17), mx(-1.22)), (mx(0.15), mx(-0.90)), mx(0.80), cabin_l=2.3)
    k.decal('roof', 'Glass', 'top', mx(-1.10), mx(0.30), -0.55, 0.55, 16, 12, off=.003)        # panoramic glass roof
    # split lights: slim LED strip on top, the 4-point main lights low in the bumper corners
    k.drl_strip((2.26, 0.62, 0.86), (0.80, 0.22, 0.55), 0.24, 0.025)
    k.headlight_quad((2.33, 0.68, 0.64), (0.85, 0.35, 0.20), 0.17, 0.10)
    k.decal('intake', 'Gloss', 'front', -0.55, 0.55, 0.32, 0.48, 20, 4)
    k.decal('lip', 'Gloss', 'front', -0.80, 0.80, 0.27, 0.33, 30, 2)
    cayenne_rear(k, ox=-1.85)
    k.spoiler(mx(-2.28), 1.215, 0.20, 1.30, aoa=-5, mat='Paint', strut_y=0.42)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.25, 0.08, 0.10))

# ======================================================================= registry + CLI
# id: (builder, preview paint, rim, caliper) - the game recolours paint/rims/calipers itself
CARS = {
    'gt3rs': (gt3rs, '#f2c20f', '#1b1b1d', '#e3c11b'),
    'gt3': (gt3, '#1d5fc4', '#2a2b2e', '#c8141b'),
    'gt3t': (gt3t, '#a9adb1', '#9da1a6', '#c8141b'),
    'st': (st, '#2c3a2b', '#8a6a3a', '#e3c11b'),
    'gt2rs': (gt2rs, '#0b0b0d', '#d9dadc', '#e3c11b'),
    'turbos': (turbos, '#16295c', '#2a2b2e', '#e3c11b'),
    'dakar': (dakar, '#eceeed', '#e8e8e8', '#c8141b'),
    'gt4rs': (gt4rs, '#16a3cc', '#1b1b1d', '#c8141b'),
    'spyrs': (spyrs, '#cfcec4', '#1b1b1d', '#c8141b'),
    '918': (p918, '#c49ab4', '#1b1b1d', '#1f8a5a'),
    'taycangt': (taycangt, '#e0501a', '#1b1b1d', '#e3c11b'),
    'cayennegt': (cayennegt, '#1d5fc4', '#2a2b2e', '#e3c11b'),
    'cayenneeh': (cayenneeh, '#eceeed', '#9da1a6', '#1f8a5a'),
    'macanev': (macanev, '#16295c', '#2a2b2e', '#c8141b'),
}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
    ids = list(CARS) if arg('--car', 'all') == 'all' else arg('--car').split(',')
    repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for cid in ids:
        fn, paint, rim, cal = CARS[cid]
        k = Car(cid, paint, rim, cal); fn(k)
        if arg('--renders'):
            views = arg('--views', 'front34,rear34,side,front,rear,top').split(',')
            sheet = '--sheet' in argv
            k.renders(arg('--renders'), views, int(arg('--samples', '48')), (640, 360) if sheet else (1280, 720),
                      sheet=os.path.join(arg('--renders'), f'{cid}-sheet.png') if sheet else None)
        if arg('--blend'): bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(arg('--blend')))
        if '--no-export' not in argv: k.export(os.path.join(repo, 'models', f'{cid}.glb'))
