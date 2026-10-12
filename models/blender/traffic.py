# The cars of Tokyo's traffic, built with the same car kit as the cars you drive, in a lighter "lite" version
# (fewer polygons in the wheels, no tyre lettering, drilled discs or grille mesh) because dozens are on the road at once.
#
#   blender -b --factory-startup --python models/blender/traffic.py -- --car all [--renders DIR --sheet]
#
#   tr_kei     a tall little kei car (3.4 m) like the boxy minicars that fill Japanese streets, sliding rear door
#   tr_taxi    a Tokyo taxi (4.7 m): tall hatch with round lamps, a chrome grille and a glowing roof sign
#   tr_sedan   a family saloon (4.8 m) on the Taycan body (as the Model S/3 are), chrome grille and bars
#   tr_van     a one-box van (4.7 m) like a HiAce: short sloping nose, tall roof, sliding door
#   tr_truck   a cab-over box truck (6.5 m): flat-front cab and a big white cargo box
#   tr_police  a Japanese patrol car: the saloon in white with a gloss-black lower half (the game adds the light bar)
# Sizes match TRAFFIC_TYPES in index.html; every model faces glTF +Z and stands on y = 0.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, both, side, main, srgb
from supercars import remap, SOFT, SHARP
from porsches import TTAY, TCAY_SUV
from teslas import glass, TAY_WS, TAY_RW, TAY_TOP, TAY_BOT
from toyota import CAY_WS, SUV_RW, SUV_TOP, SUV_BOT

def extras(k):
    k.M['Plate'] = k.material('Plate', (0.86, 0.87, 0.84), rough=0.4)      # white Japanese number plates

def plates(k, front, rear):
    """number plates: front/rear = (x, z) on the nose and tail"""
    k.rect('plate', 'Plate', (front[0], 0, front[1]), (1, 0, 0), 0.33, 0.165, .008, 4, 2)
    k.rect('plate', 'Plate', (rear[0], 0, rear[1]), (-1, 0, 0), 0.33, 0.165, .008, 4, 2)

def two_tone(k, z, nose_x, drop, mat='Gloss'):
    """paint the body below a line in another material (the black lower half of a patrol car): the line runs level at
    height z and dips by `drop` per metre ahead of nose_x so the bonnet stays white. The shell is cut along it first,
    so the edge is clean"""
    import bmesh
    me = k.body.data; idx = [m.name for m in me.materials].index(k.M[mat].name)
    bm = bmesh.new(); bm.from_mesh(me)
    for co, no in (((0, 0, z), (0, 0, 1)), ((nose_x, 0, z), (drop, 0, 1))):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=co, plane_no=no)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.material_index == 0 and c.z < min(z, z - (c.x - nose_x) * drop): f.material_index = idx
    bm.to_mesh(me); bm.free()

# ======================================================================= saloon + patrol car (Taycan base, like the Teslas)
def saloon(k, police=False):
    xs = [(-2.50, -2.40), (-1.40, -1.40), (1.50, 1.45), (2.48, 2.40)]; ys = 0.915
    zf = lambda z: z * 0.93 + 0.08 + max(0.0, z - 0.90) * 0.15
    X = lambda x: pl(xs, x)
    extras(k)
    k.loft(stations(remap(TTAY, xs, ys, zf)), levels=2, **SOFT)
    k.arches(dict(F=dict(x=1.45, r=0.32, w=0.21, y=0.77, rim=0.229), R=dict(x=-1.40, r=0.32, w=0.21, y=0.77, rim=0.229))); k.surface()
    if police: two_tone(k, 0.70, 1.2, 0.22)
    glass(k, X, zf, TAY_WS, TAY_RW, TAY_TOP, TAY_BOT, pillars=[-0.07, -1.08])
    for s in (1, -1):
        for xg in (0.80, -0.08, -1.12): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, 0.30, zf(0.92), 1, 12, off=.002)
        k.decal('beltchrome', 'Chrome', side(s), X(-1.40), X(0.80), zf(0.905), zf(0.915), 30, 1, off=.004)
    # face: wide chrome-barred grille between quad lamps, black lower intake; tail: wrap-round clusters + chrome trunk bar
    k.lamp((2.16, 0.60, zf(0.58)), (0.80, 0.34, 0.30), 0.32, 0.10, 'quad', slant=0.04, taper=0.2)
    k.decal('grille', 'Gloss', 'front', -0.40, 0.40, zf(0.40), zf(0.55), 16, 4, off=.005)
    for i in range(3): k.decal('grillebar', 'Chrome', 'front', -0.40, 0.40, zf(0.42) + i * .045, zf(0.42) + i * .045 + .013, 16, 1, off=.008)
    both(lambda s: k.decal('intake', 'Black', 'front', s * 0.30, s * 0.62, zf(0.20), zf(0.30), 8, 2, off=.005))
    k.tail_clusters(X(-1.90), zf(0.86), zf(0.95), 0.40, 0.86)
    k.fan('trunkbar', 'Chrome', X(-1.90), zf(0.80), zf(0.815), -0.40, 0.40, 20, 1, off=.005)
    k.fan('rearbumper', 'Black', X(-1.90), zf(0.24), zf(0.36), -0.62, 0.62, 30, 2)
    plates(k, (2.6, zf(0.27)), (-2.6, zf(0.62)))
    k.mirrors(X(0.74), 1.0 * ys + .04, zf(1.0), size=(0.13, 0.18, 0.09), mat='Gloss' if police else 'Paint')
    k.interior(X(-0.40), 1.38 * ys, zf(0.74), l=2.2, h=0.38, seats_x=X(-0.20), seat_z=zf(0.84))
    k.exhaust(-0.50, 0.30, r=0.035, mirror=False)
    k.join(); k.wheels(spokes=6, nut='bolts', spoke_w=(0.045, 0.036), caliper=(0.17, 0.05, 0.06))

def sedan(k): saloon(k)
def police(k): saloon(k, police=True)

# ======================================================================= taxi (Cayenne SUV base, like the GR Corolla)
def taxi(k):
    xs = [(-2.48, -2.35), (-1.40, -1.40), (1.50, 1.45), (2.46, 2.35)]; ys = 0.865
    zf = lambda z: z * 0.92 + 0.06
    X = lambda x: pl(xs, x)
    extras(k)
    k.loft(stations(remap(TCAY_SUV, xs, ys, zf)), levels=2, **SOFT)
    k.arches(dict(F=dict(x=1.45, r=0.31, w=0.20, y=0.74, rim=0.20), R=dict(x=-1.40, r=0.31, w=0.20, y=0.74, rim=0.20))); k.surface()
    glass(k, X, zf, CAY_WS, SUV_RW, SUV_TOP, SUV_BOT, pillars=[-0.15, -1.25])
    for s in (1, -1):
        for xg in (0.86, -0.17, -1.27): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, zf(0.30), zf(1.13), 1, 14, off=.002)
        k.decal('sill', 'Gloss', side(s), X(-1.02), X(1.08), zf(0.24), zf(0.32), 30, 2, off=.005)
    # round lamps either side of a big chrome-barred grille (the Tokyo taxi face)
    k.headlight_911((2.10, 0.54, zf(0.80)), (0.72, 0.30, 0.45), rx=0.10, ry=0.088)
    k.decal('grille', 'Gloss', 'front', -0.40, 0.40, zf(0.44), zf(0.70), 16, 6, off=.005)
    for i in range(4): k.decal('grillebar', 'Chrome', 'front', -0.40, 0.40, zf(0.47) + i * .06, zf(0.47) + i * .06 + .014, 16, 1, off=.008)
    k.decal('intake', 'Black', 'front', -0.60, 0.60, zf(0.26), zf(0.36), 16, 2, off=.005)
    k.tail_clusters(X(-1.95), zf(0.98), zf(1.16), 0.52, 0.86)
    k.fan('rearbumper', 'Black', X(-1.95), zf(0.30), zf(0.44), -0.66, 0.66, 30, 2)
    plates(k, (2.6, zf(0.37)), (-2.6, zf(0.62)))
    # the glowing roof sign on a black base
    k.M['Sign'] = k.material('TaxiSign', srgb('#ffcf33'), rough=0.4, emit=srgb('#ffb000'), strength=1.5)
    rz = k.deck_z(X(-0.30))
    k.box('roofsignbase', 'Black', (X(-0.30), 0, rz + .02), (0.24, 0.56, 0.05))
    k.box('roofsign', 'Sign', (X(-0.30), 0, rz + .13), (0.18, 0.50, 0.18), bevel=0.04)
    k.mirrors(X(0.80), 1.0 * ys + .06, zf(1.20), size=(0.14, 0.19, 0.10), mat='Gloss')
    k.interior(X(-0.45), 1.45 * ys, zf(0.98), l=2.4, h=0.42, seats_x=X(-0.20), seat_z=zf(1.06))
    k.join(); k.wheels(spokes=6, nut='bolts', spoke_w=(0.045, 0.036), caliper=(0.17, 0.05, 0.06))

# ======================================================================= kei car (own boxy shell)
#        x      zb    w     zs    wb    zbl   wg    zg    wr    zr    zt
KEI = [(1.70, .32, .64, .46, .64, .66, .62, .76, .54, .82, .83),
       (1.62, .24, .72, .48, .72, .70, .71, .84, .62, .90, .92),
       (1.30, .22, .74, .50, .74, .76, .73, .92, .66, 1.00, 1.03),
       (1.05, .22, .74, .50, .74, .78, .72, .98, .64, 1.62, 1.64),
       (-1.40, .22, .74, .50, .74, .80, .72, 1.00, .66, 1.66, 1.68),
       (-1.62, .24, .73, .50, .73, .80, .71, 1.00, .64, 1.64, 1.66),
       (-1.70, .32, .68, .50, .68, .78, .66, .98, .60, 1.60, 1.62)]

def boxy_face(k, nose_x, lamp, grille, bumper, lamp_w=0.26, lamp_h=0.12):
    """lamps on the front corners, a black grille between them and a black bumper wrapped round the nose"""
    k.lamp((nose_x - .05, lamp[0], lamp[1]), (0.85, 0.32, 0.05), lamp_w, lamp_h, 'quad', taper=0.15)
    k.decal('grille', 'Gloss', 'front', -grille[0], grille[0], grille[1], grille[2], 12, 4, off=.006)
    k.decal('grillebar', 'Chrome', 'front', -grille[0], grille[0], (grille[1] + grille[2]) / 2 - .007, (grille[1] + grille[2]) / 2 + .007, 12, 1, off=.009)
    k.fan('bumperF', 'Black', nose_x - 0.6, bumper[0], bumper[1], -0.95, 0.95, 30, 2, rear=False)

def kei(k):
    extras(k)
    k.loft(stations(KEI), levels=2, crease_lines=0.6, crisp_front=-9, crisp=0.5)
    k.arches(dict(F=dict(x=1.15, r=0.29, w=0.17, y=0.62, rim=0.18), R=dict(x=-1.15, r=0.29, w=0.17, y=0.62, rim=0.18))); k.surface()
    k.windscreen(1.27, 1.09, 1.04, 2.5, 0.56, 0.50, sweep=0.04, trim=0.025)
    k.decal('rearwindow', 'Glass', 'rear', -0.50, 0.50, 1.08, 1.48, 10, 6, off=.006)
    k.side_glass([(1.18, 1.06), (1.00, 1.42), (-1.50, 1.45)], [(1.18, 1.05), (-1.50, 1.06)], pillars=[-0.28, -1.30], pillar_w=0.06)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), -0.31, -0.30, 0.30, 1.04, 1, 10, off=.003)
        k.decal('doorline', 'Black', side(s), 0.98, 0.99, 0.30, 1.04, 1, 10, off=.003)
        k.decal('slidetrack', 'Black', side(s), -1.55, -0.32, 1.035, 1.045, 12, 1, off=.004)
    boxy_face(k, 1.70, (0.50, 0.80), (0.28, 0.62, 0.74), (0.30, 0.46))
    k.tail_clusters(-1.12, 0.84, 1.08, 0.62, 0.86)
    k.fan('bumperR', 'Black', -1.10, 0.30, 0.46, -0.95, 0.95, 30, 2)
    plates(k, (2.2, 0.40), (-2.2, 0.62))
    k.mirrors(1.00, 0.80, 1.12, size=(0.10, 0.14, 0.10), mat='Gloss')
    k.interior(-0.2, 1.3, 0.85, l=2.2, h=0.3, seats_x=0.0, seat_z=0.95)
    k.join(); k.wheels(spokes=5, nut='bolts', spoke_w=(0.05, 0.042), caliper=(0.15, 0.045, 0.05))

# ======================================================================= one-box van
VAN = [(2.35, .34, .76, .48, .76, .66, .74, .80, .64, .92, .94),
       (2.25, .26, .84, .50, .84, .72, .83, .90, .74, 1.06, 1.08),
       (1.95, .24, .85, .52, .85, .80, .84, 1.00, .78, 1.40, 1.44),
       (1.65, .24, .85, .52, .85, .82, .84, 1.04, .80, 1.94, 1.97),
       (-2.20, .24, .85, .52, .85, .82, .84, 1.04, .80, 1.96, 1.98),
       (-2.35, .30, .80, .52, .80, .80, .79, 1.04, .76, 1.90, 1.92)]

def van(k):
    extras(k)
    k.loft(stations(VAN), levels=2, crease_lines=0.7, crisp_front=-9, crisp=0.6)
    k.arches(dict(F=dict(x=1.55, r=0.31, w=0.19, y=0.73, rim=0.19), R=dict(x=-1.45, r=0.31, w=0.21, y=0.73, rim=0.19))); k.surface()
    k.windscreen(2.13, 1.74, 1.12, 1.75, 0.66, 0.60, sweep=0.05, trim=0.025)
    k.decal('rearwindow', 'Glass', 'rear', -0.64, 0.64, 1.22, 1.80, 10, 6, off=.006)
    k.side_glass([(1.98, 1.14), (1.70, 1.66), (-2.05, 1.72)], [(1.98, 1.13), (-2.05, 1.14)], pillars=[0.92, -0.25, -1.30], pillar_w=0.07)
    for s in (1, -1):
        for x in (0.90, -0.20): k.decal('doorline', 'Black', side(s), x, x + .01, 0.32, 1.13, 1, 12, off=.003)
        k.decal('slidetrack', 'Black', side(s), -1.95, -0.22, 1.10, 1.115, 12, 1, off=.004)
    boxy_face(k, 2.35, (0.58, 0.92), (0.40, 0.66, 0.84), (0.32, 0.50))
    k.tail_clusters(-1.75, 0.80, 1.20, 0.62, 0.88)
    k.fan('bumperR', 'Black', -1.75, 0.30, 0.48, -0.95, 0.95, 30, 2)
    plates(k, (3.0, 0.42), (-3.0, 0.62))
    k.mirrors(1.78, 0.96, 1.40, size=(0.12, 0.16, 0.22), mat='Gloss')
    k.interior(0.2, 1.5, 1.05, l=3.2, h=0.45, seats_x=1.0, seat_z=1.1)
    k.join(); k.wheels(spokes=6, nut='bolts', spoke_w=(0.05, 0.042), caliper=(0.17, 0.05, 0.06))

# ======================================================================= cab-over box truck
TRUCK = [(3.25, .40, 1.02, .58, 1.02, .90, 1.00, 1.15, .96, 2.30, 2.32),
         (3.15, .34, 1.05, .58, 1.05, .92, 1.04, 1.20, 1.00, 2.42, 2.45),
         (1.95, .34, 1.05, .58, 1.05, .92, 1.04, 1.20, 1.00, 2.42, 2.45),
         (1.85, .34, 1.00, .58, 1.00, .80, .99, .90, .96, .96, .97),
         (-3.10, .34, 1.00, .58, 1.00, .80, .99, .90, .96, .96, .97),
         (-3.25, .40, .96, .58, .96, .80, .95, .90, .92, .94, .95)]

def truck(k):
    extras(k)
    k.flare_amt = 0.0
    k.loft(stations(TRUCK), levels=2, crease_all=0.85)
    k.arches(dict(F=dict(x=2.40, r=0.38, w=0.24, y=0.86, rim=0.24), R=dict(x=-1.70, r=0.38, w=0.28, y=0.86, rim=0.24))); k.surface()
    k.decal('windscreen', 'Glass', 'front', -0.92, 0.92, 1.50, 2.20, 12, 6, off=.006)
    for s in (1, -1):
        k.decal('sideglass', 'Glass', side(s), 2.40, 3.05, 1.55, 2.20, 6, 6, off=.006)
        k.decal('doorline', 'Black', side(s), 2.15, 2.16, 0.60, 2.22, 1, 12, off=.003)
        k.decal('stripe', 'Accent', side(s), 2.18, 3.20, 1.05, 1.13, 8, 1, off=.006)
        k.rect('lampring', 'Gloss', (3.25, s * 0.74, 0.76), (1, 0, 0), 0.32, 0.18, .005, 4, 2)
        k.rect('headlamp', 'Headlight', (3.25, s * 0.74, 0.76), (1, 0, 0), 0.26, 0.13, .008, 4, 2)
        k.rect('indicator', 'Taillight', (3.25, s * 0.94, 0.76), (1, 0, 0), 0.06, 0.13, .008, 1, 2)
    k.decal('grille', 'Gloss', 'front', -0.50, 0.50, 0.66, 0.88, 12, 3, off=.006)
    k.decal('grillebar', 'Chrome', 'front', -0.50, 0.50, 0.765, 0.785, 12, 1, off=.009)
    k.decal('bumperF', 'Black', 'front', -1.0, 1.0, 0.40, 0.58, 16, 2, off=.008)
    plates(k, (4.0, 0.49), (-4.0, 0.55))
    k.M['Box'] = k.material('CargoBox', srgb('#ececea'), rough=0.6)
    k.box('cargobox', 'Box', (-0.60, 0, 1.75), (4.80, 2.12, 2.20), bevel=0.04)   # the white aluminium cargo box
    for x in (-2.9, -1.7, -0.5, 0.7): k.box('boxrib', 'Chrome', (x, 0, 1.75), (0.04, 2.16, 2.22))
    k.box('boxdoor', 'Black', (-3.005, 0, 1.72), (0.02, 0.014, 2.0))              # the rear doors' seam and handle
    k.box('boxhandle', 'Chrome', (-3.02, 0.12, 1.30), (0.03, 0.03, 0.40))
    for s in (1, -1): k.box('taillamp', 'Taillight', (-3.27, s * 0.80, 0.52), (0.05, 0.26, 0.12))
    k.box('underrun', 'Black', (-3.15, 0, 0.42), (0.12, 1.8, 0.12))
    k.mirrors(3.10, 1.18, 1.95, size=(0.10, 0.10, 0.36), stalk=0.16, mat='Gloss')
    k.interior(2.6, 1.8, 1.4, l=1.0, h=0.5, seats_x=2.5, seat_z=1.5)
    k.join(); k.wheels(spokes=8, nut='bolts', spoke_w=(0.05, 0.045), caliper=(0.2, 0.07, 0.08))

def lite(fn):
    def build(k):
        k.lite = True; return fn(k)
    return build

CARS = {
    'tr_kei': (lite(kei), '#e8d44d', '#c9c9c9', '#3a3a3a'),
    'tr_taxi': (lite(taxi), '#12161c', '#c9c9c9', '#3a3a3a'),
    'tr_sedan': (lite(sedan), '#2d3e5c', '#c9c9c9', '#3a3a3a'),
    'tr_van': (lite(van), '#f4f4f4', '#c9c9c9', '#3a3a3a'),
    'tr_truck': (lite(truck), '#2a5a9a', '#c9c9c9', '#3a3a3a'),
    'tr_police': (lite(police), '#f4f4f4', '#c9c9c9', '#3a3a3a'),
}

if __name__ == '__main__':
    main(CARS, 'traffic.py')
