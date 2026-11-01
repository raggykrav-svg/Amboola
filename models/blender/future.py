# AMBOOLA 3000: the year-3000 world behind the garage's FUTURE button, built in Blender by script (with citykit.py).
#
#   blender -b --factory-startup --python models/blender/future.py -- --what city,cars,robot,giant,police|all [--render DIR]
#
# It writes:
#   models/fut_city.glb   the building kit and the sky decorations
#       F<k><m>   building family k (0 glass tower, 1 megablock, 2 chrome spire, 3 neon pagoda), module m:
#                 G ground storey (6 m), U one storey (3.6 m), S four storeys (14.4 m), A four storeys with big screens,
#                 R roof. Footprint 20 x 20 m (the game stretches each to its plot). Custom props W, D, H.
#       K, W      a capsule house (8.5 x 8.5, 6 m) and a hangar (26 x 26, 11 m)
#       M_0..M_2  megatowers on a 60 x 60 m block (300-360 m); M_2r is the ring tower's halo rings (the game spins them)
#       H_koi, H_logo   holograms (drawn see-through and glowing by the game)
#   models/fut_cars.glb    flying cars FC_sedan, FC_taxi, FC_sport, FC_van, FC_police (front -Y, as every car)
#   models/fut_robot.glb   robot people: RB_torso, RB_head, RB_crest, RB_leg, RB_arm with the game's PERSON joints
#   models/fut_giant.glb   the giant transformer robot: TF_* parts parented at their joints (the game animates them)
#   models/enforcer.glb    the year-3000 police car: Body and Wheel_FL/FR/RL/RR, like every car in the game
#
# Material names are read by the game: Wall/Armor/Paint are white and tinted there; Win (lit window cells), Neon/Neon2
# (glow strips, tinted per building), Ad (screens with UVs 0..1: the game's animated adverts), Lamp, Holo, Glow, Eye,
# Thruster, Headlight, Taillight, PoliceRed, PoliceBlue, Sign glow. Blender X = game x, Blender Y = game -z.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh, base64
from mathutils import Vector, Matrix
from citykit import Node, M, V, lerp, Face, export, reset, build_all, render, NODES

HERE = os.path.dirname(os.path.abspath(__file__))
TAU = 2 * math.pi

# ==================================================================================================== materials
def mats():
    g = M.get
    g('Wall', '#ffffff', .62); g('Dark', '#16181e', .42, .55); g('Metal', '#6f757e', .32, .85); g('Chrome', '#d8dde3', .12, 1.)
    g('Glass', '#0f1824', .05, .9); g('Win', '#ffffff', .3, emit='#ffd9a0', strength=2.5, double=True); g('Shop', '#ffe2b8', .3, emit='#ffc98a', strength=3)
    g('Neon', '#ffffff', .3, emit='#39f0ff', strength=7); g('Neon2', '#ffffff', .3, emit='#ff38e8', strength=7)
    g('Ad', '#ffffff', .4, emit='#a0f0ff', strength=3, double=True); g('Lamp', '#ff2a2a', .4, emit='#ff2a2a', strength=10)
    g('Holo', '#5ff0ff', .2, emit='#5ff0ff', strength=5, double=True); g('Sign', '#ffd21f', .3, emit='#ffc21f', strength=6)
    g('Paint', '#ffffff', .25, .4); g('Thruster', '#9ff6ff', .2, emit='#39d8ff', strength=9); g('Headlight', '#ffffff', .1, emit='#ffffff', strength=8)
    g('Taillight', '#ff1010', .2, emit='#ff1010', strength=6); g('PoliceRed', '#ff1a1a', .3, emit='#ff1a1a', strength=8)
    g('PoliceBlue', '#2a5bff', .3, emit='#2a5bff', strength=8); g('Glow', '#ffffff', .3, emit='#45f3ff', strength=8); g('Eye', '#ff3030', .3, emit='#ff3030', strength=10)
    g('Body', '#ffffff', .3, .6); g('Joint', '#2b2e35', .45, .7); g('Armor', '#ffffff', .35, .55); g('Armor2', '#ffffff', .35, .55)
    g('Tire', '#151517', .9); g('Rim', '#c9ccd1', .3, .9); g('Black', '#0c0c0e', .6); g('GlossBlack', '#050506', .15, .2)
    g('Accent', '#1d5fc4', .35, .3); g('Disc', '#5a5d62', .5, .9)

# ==================================================================================================== helpers
def uvface(n, m, pts, nrm=None, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    """one polygon with texture coordinates (the advert screens): uvs follow pts"""
    vs = [n.bm.verts.new(p) for p in pts]
    try: f = n.bm.faces.new(vs)
    except ValueError: return None
    f.normal_update()
    if nrm is not None and f.normal.dot(V(*nrm)) < 0: f.normal_flip()
    uvl = n.bm.loops.layers.uv.verify(); tab = {v: uv for v, uv in zip(vs, uvs)}
    for l in f.loops: l[uvl].uv = tab[l.vert]
    f.material_index = n.mi(m); f.smooth = False; return f

def screen(F, u0, v0, u1, v1, w, frame='Dark', fw=.35, depth=.3):
    """an advert screen on face F (u along the wall, v up, w out) in a frame box behind it"""
    F.block(frame, u0 - fw, v0 - fw, u1 + fw, v1 + fw, w - depth, w)
    uvface(F.n, 'Ad', [F.P(u0, v0, w + .02), F.P(u1, v0, w + .02), F.P(u1, v1, w + .02), F.P(u0, v1, w + .02)], F.N)

def strip(F, m, u0, v0, u1, v1, w=.04):
    F.quad(m, u0, v0, u1, v1, w)

def loft(n, m, secs, smooth=False, cap=True):
    """a closed skin through rings [(y, [(x, z), ...]), ...] (same point count each): car bodies, fish, hulls"""
    rings = [[n.bm.verts.new((x, y, z)) for x, z in pts] for y, pts in secs]
    fs = []
    for A, B in zip(rings, rings[1:]):
        k = len(A)
        for i in range(k):
            j = (i + 1) % k
            try: fs.append(n.bm.faces.new([A[i], A[j], B[j], B[i]]))
            except ValueError: pass
    if cap:
        for r, rev in ((rings[0], True), (rings[-1], False)):
            try: fs.append(n.bm.faces.new(list(reversed(r)) if rev else r))
            except ValueError: pass
    bmesh.ops.recalc_face_normals(n.bm, faces=fs)
    k = n.mi(m)
    for f in fs: f.material_index = k; f.smooth = smooth
    return fs

def rrect(w, z0, z1, r, cx=0.0, k=3):
    """a rounded rectangle cross-section (x, z), counter-clockwise, 4 * (k + 1) points"""
    r = min(r, w / 2 - 1e-3, (z1 - z0) / 2 - 1e-3); pts = []
    for (ax, az, a0) in ((w / 2 - r, z0 + r, -math.pi / 2), (w / 2 - r, z1 - r, 0), (-w / 2 + r, z1 - r, math.pi / 2), (-w / 2 + r, z0 + r, math.pi)):
        for i in range(k + 1):
            a = a0 + (math.pi / 2) * i / k; pts.append((cx + ax + math.cos(a) * r, az + math.sin(a) * r))
    return pts

def ring_quads(n, m, W, D, z0, z1, w):
    """a band right round a W x D box from z0 to z1, w out from the walls"""
    for side in range(4):
        F = Face(n, W, D, side, z0); F.quad(m, -F.L / 2 - w, 0, F.L / 2 + w, z1 - z0, w)

def octagon(W, c):
    h = W / 2; return [(-h + c, -h), (h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c)]

def mk(n):
    """remember the vertices made so far (bmesh reuses freed index slots, so an index mark is not safe)"""
    return frozenset(n.bm.verts)

def since(n, k): return [v for v in n.bm.verts if v not in k]

def turn(n, k, rz=0.0, ry=0.0, rx=0.0, at=(0, 0, 0)):
    """rotate everything made since mk() k about point at"""
    R = Matrix.Rotation(rz, 3, 'Z') @ Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rx, 3, 'X')
    bmesh.ops.rotate(n.bm, verts=since(n, k), cent=V(*at), matrix=R)

def move(n, k, d): bmesh.ops.translate(n.bm, vec=V(*d), verts=since(n, k))

# ==================================================================================================== the building kit
SZ = 20.0           # module footprint
STO = 3.6           # one storey

def f0_storey(n, z0, W=SZ):
    """glass tower storey: glass core, a dark slab with a neon edge at the floor, window cells, mullions, corner fins"""
    n.box('Glass', (0, 0, z0 + STO / 2), (W - .4, W - .4, STO))
    n.box('Dark', (0, 0, z0 + .18), (W + .2, W + .2, .36))
    for side in range(4):
        F = Face(n, W, W, side, z0)
        strip(F, 'Neon', -W / 2 - .1, .24, W / 2 + .1, .31, .12)
        strip(F, 'Win', -W / 2 + .8, .7, W / 2 - .8, 3.1, -.18)
        for i in range(1, 8): u = -W / 2 + i * W / 8; F.block('Dark', u - .06, .36, u + .06, STO, -.2, -.1)
    for sx in (-1, 1):
        for sy in (-1, 1): n.box('Dark', (sx * (W / 2 - .25), sy * (W / 2 - .25), z0 + STO / 2), (.55, .55, STO))

def f1_storey(n, z0, rnd, W=SZ):
    """megablock storey: tinted concrete, a ribbon of windows, balconies with cages, air-conditioners"""
    n.box('Wall', (0, 0, z0 + STO / 2), (W, W, STO))
    for side in range(4):
        F = Face(n, W, W, side, z0)
        strip(F, 'Win', -W / 2 + .7, .9, W / 2 - .7, 2.6, .02)
        F.block('Dark', -W / 2, 3.38, W / 2, 3.6, 0, .08)
        if side % 2 == 0:
            for u in (-6, 0, 6):
                F.block('Dark', u - 2, .0, u + 2, .16, 0, 1.3)
                F.quad('Metal', u - 2, .16, u + 2, 1.1, 1.28); F.block('Metal', u - 2.02, .16, u - 1.95, 2.9, 1.2, 1.3); F.block('Metal', u + 1.95, .16, u + 2.02, 2.9, 1.2, 1.3)
        else:
            for u in (-5.5, 4.5):
                if rnd.random() < .8: F.block('Metal', u - .5, 2.65, u + .5, 3.25, 0, .55)

def f2_storey(n, z0, W=SZ):
    """chrome spire storey: an octagonal glass prism, a metal floor plate, amber strips up the cut corners"""
    c = 3.0
    n.prism('Glass', octagon(W - .3, c - .1), z0, z0 + STO)
    n.prism('Metal', octagon(W + .2, c), z0, z0 + .32)
    for side in range(4):
        F = Face(n, W - .3, W - .3, side, z0); strip(F, 'Win', -W / 2 + c + .4, .6, W / 2 - c - .4, 3.2, .01)
    h = (W - .3) / 2
    for a in range(4):   # the four cut corners: a neon strip up the middle of each
        ang = math.pi / 4 + a * math.pi / 2; cx, cy = math.cos(ang) * (h - c / 2 + .12), math.sin(ang) * (h - c / 2 + .12)
        n.box('Neon', (cx, cy, z0 + STO / 2), (.16, .16, STO))

def f3_storey(n, z0, W=SZ):
    """neon pagoda storey: a dark tinted core, window ribbons and a flared eave with a neon edge"""
    w = W - 2.4
    n.box('Wall', (0, 0, z0 + STO / 2), (w, w, STO))
    for side in range(4):
        F = Face(n, w, w, side, z0); strip(F, 'Win', -w / 2 + .6, .5, w / 2 - .6, 2.3, .02)
    o = W / 2 + .6; t = z0 + STO - .25; b = t - .75
    for side in range(4):   # the eave: a sloping skirt from the wall top out to the edge, and its neon lip
        F = Face(n, w, w, side, z0); L = w / 2
        n.face('Dark', [F.P(-L, STO - .25, 0), F.P(L, STO - .25, 0), F.P(L + 1.2, STO - 1.0, o - w / 2), F.P(-L - 1.2, STO - 1.0, o - w / 2)], F.N + V(0, 0, 1))
        n.face('Dark', [F.P(-L, STO - .55, 0), F.P(L, STO - .55, 0), F.P(L + 1.2, STO - 1.05, o - w / 2), F.P(-L - 1.2, STO - 1.05, o - w / 2)], -F.N + V(0, 0, -1) * 0 + V(0, 0, -1))
        strip(F, 'Neon2', -L - 1.2, STO - 1.1, L + 1.2, STO - 1.0, o - w / 2 + .01)

STOREY = {0: lambda n, z, r: f0_storey(n, z), 1: lambda n, z, r: f1_storey(n, z, r), 2: lambda n, z, r: f2_storey(n, z), 3: lambda n, z, r: f3_storey(n, z)}

def ground(n, k, rnd):
    """the 6 m street storey: glowing shop windows, a canopy with a neon edge, little shop signs above"""
    W = SZ; H = 6.0
    n.box('Dark', (0, 0, H - .5), (W, W, 1.0))
    n.box('Wall' if k in (1, 3) else 'Dark', (0, 0, (H - 1.0) / 2), (W - 1.6, W - 1.6, H - 1.0))
    for sx in (-1, 1):
        for sy in (-1, 1): n.box('Dark', (sx * (W / 2 - .4), sy * (W / 2 - .4), (H - 1) / 2), (.8, .8, H - 1))
    for side in range(4):
        F = Face(n, W - 1.6, W - 1.6, side, 0); L = F.L / 2
        for i in range(3):
            u0, u1 = -L + .6 + i * (2 * L - .6) / 3, -L + (i + 1) * (2 * L - .6) / 3
            F.quad('Shop', u0, .1, u1, 3.6, .02)
            F.block('Dark', u0 - .12, 3.6, u1 + .12, 3.8, 0, .1)
            uvface(n, 'Ad', [F.P(u0 + .4, 3.95, .16), F.P(u1 - .4, 3.95, .16), F.P(u1 - .4, 4.65, .16), F.P(u0 + .4, 4.65, .16)], F.N)
        F2 = Face(n, W, W, side, 0)
        F2.block('Dark', -W / 2 - 1.6, 4.9, W / 2 + 1.6, 5.15, 0, 2.2)     # the canopy
        strip(F2, 'Neon' if k != 3 else 'Neon2', -W / 2 - 1.6, 4.92, W / 2 + 1.6, 5.08, 2.22)
        if k == 3:   # paper-lantern style red lamps under the pagoda's canopy
            for u in (-6, -2, 2, 6): n.sphere('Lamp', tuple(F2.P(u, 4.55, 1.6)), .32, segs=8, rings=5)

def roof(n, k, rnd):
    """the roof: a parapet and the rooftop clutter of the year 3000 (masts, holo emitters, a billboard, tanks)"""
    W = SZ
    if k == 2:   # chrome spire: two stepped octagons and a needle
        n.prism('Metal', octagon(W - 1, 3), 0, 2.5); n.prism('Glass', octagon(W - 6, 2), 2.5, 8.5); n.prism('Metal', octagon(W - 6.4, 2), 8.5, 9.2)
        n.box('Neon', (0, 0, 2.55), (W - 1.4, W - 1.4, .12)); n.cyl('Metal', (0, 0, 9.2), 1.6, 22, segs=10, r2=.12)
        n.sphere('Lamp', (0, 0, 31.4), .5, segs=8, rings=5)
        for z in (12, 16, 20): n.lathe('Neon', [(1.6 * (1 - (z - 9.2) / 22) + .25, z), (1.6 * (1 - (z - 9.2) / 22) + .25, z + .25)], segs=12, smooth=False)
        return
    if k == 3:   # neon pagoda: a hipped roof with upturned corners, a neon edge, a spire and a glowing orb
        w = W + 1.2; z = 0
        for i, (a, b, hh) in enumerate(((w, w * .62, 2.6), (w * .62, w * .3, 2.2))):
            pts0 = [(-a / 2, -a / 2), (a / 2, -a / 2), (a / 2, a / 2), (-a / 2, a / 2)]; pts1 = [(-b / 2, -b / 2), (b / 2, -b / 2), (b / 2, b / 2), (-b / 2, b / 2)]
            for j in range(4):
                q = (j + 1) % 4; mid = V((pts0[j][0] + pts0[q][0]) / 2, (pts0[j][1] + pts0[q][1]) / 2, 0)
                n.face('Dark', [(pts0[j][0], pts0[j][1], z), (pts0[q][0], pts0[q][1], z), (pts1[q][0], pts1[q][1], z + hh), (pts1[j][0], pts1[j][1], z + hh)], (mid.x, mid.y, 2))
                n.box('Neon2', (mid.x * 1.005, mid.y * 1.005, z + .08), (abs(pts0[j][0] - pts0[q][0]) + .2 or .2, abs(pts0[j][1] - pts0[q][1]) + .2 or .2, .14))
            for (x, y) in pts0: n.cyl('Dark', (x, y, z - .2), .18, .9, segs=6, rx=.6 * (1 if y > 0 else -1))   # the upturned corners
            z += hh
        n.box('Dark', (0, 0, z + .1), (w * .3, w * .3, .2)); n.cyl('Metal', (0, 0, z), .25, 7, segs=8, r2=.05); n.sphere('Holo', (0, 0, z + 3.2), 1.4, segs=12, rings=8)
        return
    m = 'Wall' if k == 1 else 'Dark'
    for s in (-1, 1):
        n.box(m, (0, s * (W / 2 - .2), .6), (W, .4, 1.2)); n.box(m, (s * (W / 2 - .2), 0, .6), (.4, W - .8, 1.2))
    n.box('Dark', (0, 0, .05), (W - .6, W - .6, .1))
    for s in (-1, 1): n.box('Neon', (0, s * (W / 2 + .02), 1.15), (W, .06, .1))
    # a mast with a red aviation light
    n.cyl('Metal', (6, 6, 0), .22, 12, segs=8, r2=.08); n.sphere('Lamp', (6, 6, 12.2), .35, segs=8, rings=5)
    for z in (4, 8): n.box('Metal', (6, 6, z), (1.6, .08, .08))
    # a holo emitter: a squat drum and a faint cone of light
    n.cyl('Dark', (-5, 5, 0), 1.6, .9, segs=14); n.lathe('Neon', [(1.62, .55), (1.62, .75)], segs=14, smooth=False)
    n.cyl('Holo', (-5, 5, .9), 1.2, 3.2, segs=14, r2=2.6, caps=False)
    # a rooftop billboard on a lattice (facing -Y: the game turns the module)
    F = Face(n, 14, 1, 2, 3.0); n.box('Dark', (0, -6, 1.5), (12.5, .4, 3)); screen(F, -6, 0, 6, 5.5, 5.7)
    # air-conditioners and a water tank
    for (x, y) in ((4, -1), (6.5, -1), (-6, -4)): n.box('Metal', (x, y, .7), (1.8, 1.8, 1.4)); n.cyl('Dark', (x, y, 1.4), .7, .05, segs=10)
    if k == 1: n.cyl('Metal', (-6, 0, 0), 1.5, 3.5, segs=12); n.cyl('Dark', (-6, 0, 3.5), 1.6, .3, segs=12, r2=.2)

def module_set(k):
    rnd = random.Random(100 + k); sto = STOREY[k]
    G = Node(f'F{k}G', W=SZ, D=SZ, H=6.0); ground(G, k, rnd)
    U = Node(f'F{k}U', W=SZ, D=SZ, H=STO); sto(U, 0, rnd)
    S = Node(f'F{k}S', W=SZ, D=SZ, H=STO * 4)
    for i in range(4): sto(S, i * STO, rnd)
    if k == 1:   # a blade sign out from one corner, screens both sides
        k0 = mk(S); S.box('Dark', (0, 0, 7.2), (.35, 2.2, 12.4))
        for sd in (1, 3): Fb = Face(S, .35, 2.2, sd, 1.0); uvface(S, 'Ad', [Fb.P(-1, 0, .02), Fb.P(1, 0, .02), Fb.P(1, 12, .02), Fb.P(-1, 12, .02)], Fb.N)
        turn(S, k0, rz=math.pi / 4); move(S, k0, (SZ / 2 + 1.0, -SZ / 2 - 1.0, 0))
    if k == 0:   # a tall neon line up the middle of two faces
        for side in (1, 3): F = Face(S, SZ, SZ, side, 0); strip(F, 'Neon2', -.12, 0, .12, STO * 4, .14)
    A = Node(f'F{k}A', W=SZ, D=SZ, H=STO * 4)
    for i in range(4): sto(A, i * STO, rnd)
    for side in ((0, 2) if k != 1 else (0,)):   # the big screens of the advert storey (clear of balconies and eaves)
        F = Face(A, SZ, SZ, side, 0); w = {0: .6, 1: 1.6, 2: .45, 3: 1.0}[k]
        screen(F, -7.5, 1.4, 7.5, 12.6, w + .25, fw=.4)
        for (u0, u1) in ((-7.95, -7.75), (7.75, 7.95)): F.quad('Neon', u0, 1.0, u1, 13.0, w + .3)
        F.quad('Neon', -7.95, 12.95, 7.95, 13.1, w + .3); F.quad('Neon', -7.95, .95, 7.95, 1.1, w + .3)
    R = Node(f'F{k}R', W=SZ, D=SZ, H=1.2); roof(R, k, rnd)

def capsule_house():
    """K: a 2-storey capsule home (8.5 x 8.5, 6 m to the eaves): a block, a curved pod on top, round windows, solar fins"""
    n = Node('K', W=8.5, D=8.5, H=6.0); rnd = random.Random(5)
    n.box('Wall', (0, 0, 1.6), (8.5, 8.5, 3.2)); n.box('Dark', (0, 0, 3.3), (8.9, 8.9, .2))
    k = mk(n); n.cyl('Wall', (0, -4.0, 0), 2.9, 8.0, segs=14, rx=-math.pi / 2); move(n, k, (0, 0, 3.4))   # the pod: a lying cylinder
    for side in range(4):
        F = Face(n, 8.5, 8.5, side, 0)
        if side == 2: F.quad('Shop', -1.0, 0, 1.0, 2.3, .02); F.block('Dark', -1.2, 2.3, 1.2, 2.5, 0, .4); uvface(n, 'Ad', [F.P(1.5, 1.6, .05), F.P(3.6, 1.6, .05), F.P(3.6, 2.6, .05), F.P(1.5, 2.6, .05)], F.N)
        else: F.quad('Win', -3.2, .9, 3.2, 2.4, .02)
        F.quad('Neon', -4.25, 3.05, 4.25, 3.15, .47)
    for sx in (-1, 1):   # round windows in the pod's ends
        k = mk(n); n.lathe('Win', [(0, 0), (1.2, 0)], segs=14, smooth=False); turn(n, k, rx=math.pi / 2); move(n, k, (0, sx * 4.02, 4.3))
    for i in range(3): n.box('Glass', (-2.4 + i * 2.4, 0, 6.5), (2.0, 5.6, .08), rx=0, ry=.25)
    n.box('Metal', (0, 0, 6.3), (.2, 5.6, .4))

def hangar():
    """W: a hangar (26 x 26, 11 m): ribbed metal, a glowing door outline, a big logo screen, skylights"""
    n = Node('W', W=26, D=26, H=11.0)
    n.box('Metal', (0, 0, 5.5), (26, 26, 11))
    for side in range(4):
        F = Face(n, 26, 26, side, 0)
        for i in range(13): u = -13 + 1 + i * 2; F.block('Dark', u - .1, 0, u + .1, 11, 0, .25)
        if side in (0, 2):
            F.quad('Dark', -6, 0, 6, 7.5, .3); F.quad('Neon', -6.3, 7.5, 6.3, 7.8, .32); F.quad('Neon', -6.3, 0, -6, 7.5, .32); F.quad('Neon', 6, 0, 6.3, 7.5, .32)
        else: screen(F, -6, 6.5, 6, 10.2, .45)
    for i in range(3): n.box('Win', (-8 + i * 8, 0, 11.05), (3, 20, .12))

def megatowers():
    """three landmark megatowers for whole city blocks (the block is about 64 m: they keep inside 60 m)"""
    # M_0: the arcology, a stepped pyramid with a glowing crown and screens on every tier
    n = Node('M_0', W=60, D=60, H=300.0); z = 0
    for i, (w, h) in enumerate(((58, 70), (48, 70), (38, 60), (28, 55), (18, 45))):
        n.box('Glass', (0, 0, z + h / 2), (w, w, h))
        for side in range(4):
            F = Face(n, w, w, side, z)
            for f in range(int(h / 4)):
                strip(F, 'Win', -w / 2 + 1, f * 4 + .8, w / 2 - 1, f * 4 + 3.2, .02)
            if i < 4: screen(F, -w * .32, h * .3, w * .32, h * .3 + w * .64 * .55, .5, fw=.6)
        n.box('Dark', (0, 0, z + h - .4), (w + 1.2, w + 1.2, .8)); ring_quads(n, 'Neon' if i % 2 else 'Neon2', w + 1.2, w + 1.2, z + h - .7, z + h - .5, .62)
        z += h
    n.cyl('Dark', (0, 0, z), 6, 6, segs=16); n.lathe('Neon', [(6.05, z + 2), (6.05, z + 3)], segs=16, smooth=False); n.cyl('Metal', (0, 0, z + 6), 1.0, 40, segs=8, r2=.2); n.sphere('Lamp', (0, 0, z + 46.5), .9, segs=8, rings=5)
    # M_1: twin spires joined by three sky bridges
    n = Node('M_1', W=60, D=60, H=340.0)
    for (x, h) in ((-15, 340), (15, 300)):
        n.box('Glass', (x, 0, h / 2), (24, 24, h))
        for side in range(4):
            F = Face(n, 24, 24, side, 0); F.O += V(x, 0, 0)
            for f in range(int(h / 4)): strip(F, 'Win', -11, f * 4 + .8, 11, f * 4 + 3.3, .02)
            for u in (-12.1, 11.9): F.quad('Neon2', u, 0, u + .2, h, .05)
            if side in (0, 2): screen(F, -9, h * .45, 9, h * .45 + 30, .45, fw=.6)
        n.box('Dark', (x, 0, h + 1), (25, 25, 2)); n.cyl('Metal', (x, 0, h + 2), 1.2, 30, segs=8, r2=.15); n.sphere('Lamp', (x, 0, h + 32.6), .7, segs=8, rings=5)
    for z in (90, 170, 240):
        n.box('Glass', (0, 0, z), (8, 10, 6)); n.box('Dark', (0, 0, z - 3.2), (8.4, 11, .5)); n.box('Dark', (0, 0, z + 3.2), (8.4, 11, .5))
        for s in (-1, 1): n.box('Neon', (0, s * 5.55, z - 3.0), (8.4, .1, .12)); n.box('Neon', (0, s * 5.55, z + 3.0), (8.4, .1, .12))
    # M_2: the ring tower, a glass cylinder with halo rings (a separate node, M_2r, that the game spins) and a screen band
    n = Node('M_2', W=60, D=60, H=360.0)
    n.lathe('Glass', [(0, 0), (20, 0), (20, 40), (17, 60), (17, 330), (12, 345), (0, 350)], segs=28, smooth=True)
    for z in range(64, 330, 4): n.lathe('Win', [(17.03, z + .8), (17.03, z + 3.0)], segs=28, smooth=True)
    n.lathe('Neon2', [(20.05, 38), (20.05, 39)], segs=28, smooth=False)
    fs = n.lathe('Ad', [(17.4, 175), (17.4, 205)], segs=28, smooth=True)   # a cylindrical screen band: the advert four times round
    uvl = n.bm.loops.layers.uv.verify()
    for f in fs:
        a0 = None
        for l in f.loops:
            co = l.vert.co; a = (math.atan2(co.y, co.x) / TAU) % 1.0
            if a0 is None: a0 = a
            while a - a0 > .5: a -= 1
            while a - a0 < -.5: a += 1
            l[uvl].uv = (a * 4, (co.z - 175) / 30)
    n.cyl('Metal', (0, 0, 350), .9, 30, segs=8, r2=.15); n.sphere('Lamp', (0, 0, 380.5), .7, segs=8, rings=5)
    r = Node('M_2r', W=60, D=60, H=0.0)
    for (z, R) in ((120, 27), (240, 25), (300, 23)):
        r.lathe('Neon', [(R, z - .6), (R + .9, z - .6), (R + .9, z + .6), (R, z + .6), (R, z - .6)], segs=40, smooth=False)
        r.lathe('Dark', [(R - .5, z - .35), (R, z - .35), (R, z + .35), (R - .5, z + .35), (R - .5, z - .35)], segs=40, smooth=False)
        for a in range(6): ang = a * TAU / 6; r.box('Dark', (math.cos(ang) * (R - 5), math.sin(ang) * (R - 5), z), (10, .4, .4), rz=ang)

def holograms():
    """a koi fish and the AMBOOLA 3000 logo, both drawn as glowing holograms"""
    n = Node('H_koi')
    parts = [((0, -9, 0), (2.6, 4.5, 2.4)), ((0, -3, 0), (3.6, 6, 3.2)), ((0, 4, 0), (2.8, 5.5, 2.4)), ((0, 9, 0), (1.4, 4, 1.4))]
    n.blob('Holo', parts, res=.9)
    for s in (-1, 1):   # pectoral fins and the long tail fins
        n.face('Holo', [(s * 2.8, -4, -.6), (s * 7.5, -1, -1.6), (s * 6, 2.5, -1.2), (s * 2.4, 0, -.4)], (0, 0, 1))
        n.face('Holo', [(0, 11.5, 0), (s * 5.5, 19, .4 * s), (s * 2.5, 21, .2), (0, 14, 0)], (0, 0, 1))
    n.face('Holo', [(0, -4, 3.0), (0, 3, 2.4), (0, 1, 5.5)], (1, 0, 0))   # the dorsal fin
    for s in (-1, 1): n.sphere('Holo', (s * 1.9, -11, .9), .55, segs=8, rings=5)
    # the logo: AMBOOLA over 3000, extruded letters standing up (facing -Y)
    logo = Node('H_logo')
    for txt, z, size in (('AMBOOLA', 9.0, 9.0), ('3000', 0.0, 8.0)):
        cu = bpy.data.curves.new('t', 'FONT'); cu.body = txt; cu.align_x = 'CENTER'; cu.size = size; cu.extrude = .8
        o = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(o)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        k0 = len(logo.bm.verts); logo.bm.from_mesh(me); logo.bm.verts.ensure_lookup_table(); logo.bm.faces.ensure_lookup_table()
        for v in logo.bm.verts[k0:]: v.co = V(v.co.x, -v.co.z, v.co.y + z)
        bpy.data.objects.remove(o); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    for f in logo.bm.faces: f.material_index = logo.mi('Holo')
    logo.lathe('Holo', [(14.5, -2.5), (15.5, -2.5), (15.5, -2.1), (14.5, -2.1)], segs=40, smooth=False)   # a ring under it

def build_city():
    for k in range(4): module_set(k)
    capsule_house(); hangar(); megatowers(); holograms()

# ==================================================================================================== flying cars
def thruster_pod(n, x, y, z, r=.3, h=.28, m='Dark'):
    n.cyl(m, (x, y, z), r, h, segs=12); n.cyl('Thruster', (x, y, z - .02), r * .78, .03, segs=12)

def duct_fan(n, x, y, z, r=.62):
    """a ducted fan lying flat: a ring, a glowing disc inside, a hub and two struts"""
    n.lathe('Dark', [(r - .1, -.16), (r + .08, -.16), (r + .1, .14), (r - .1, .16), (r - .12, -.16)], segs=16, c=(x, y, z), smooth=False)
    n.cyl('Thruster', (x, y, z - .06), r - .12, .04, segs=16); n.cyl('Metal', (x, y, z - .05), .12, .2, segs=8)
    for a in (0, math.pi / 2): n.box('Metal', (x, y, z), ((r - .1) * 2, .05, .05), rz=a)

def fc_sedan():
    n = Node('FC_sedan')
    loft(n, 'Paint', [(-2.42, rrect(.95, .42, .62, .1)), (-2.18, rrect(1.6, .32, .78, .18)), (-1.5, rrect(1.98, .28, .9, .26)), (-.4, rrect(2.06, .27, .95, .3)),
                      (1.2, rrect(2.02, .3, .98, .3)), (2.05, rrect(1.8, .36, .95, .25)), (2.42, rrect(1.3, .5, .86, .15))], smooth=True)
    loft(n, 'Glass', [(-1.25, rrect(1.3, .88, .95, .05)), (-.7, rrect(1.62, .88, 1.36, .3)), (.4, rrect(1.66, .9, 1.45, .34)), (1.15, rrect(1.52, .9, 1.34, .3)), (1.55, rrect(1.15, .9, 1.0, .05))], smooth=True)
    n.box('Headlight', (0, -2.36, .64), (1.25, .08, .07)); n.box('Taillight', (0, 2.43, .78), (1.3, .06, .08))
    for s in (-1, 1):
        n.box('Neon', (s * .99, 0, .3), (.05, 3.4, .05))
        n.box('Dark', (s * 1.0, .3, .62), (.08, 2.6, .12))
    for (x, y) in ((-.95, -1.45), (.95, -1.45), (-.95, 1.45), (.95, 1.45)): thruster_pod(n, x, y, .1)
    for s in (-1, 1): n.cyl('Dark', (s * .5, 2.3, .62), .19, .32, segs=12, rx=-math.pi / 2); n.cyl('Thruster', (s * .5, 2.63, .62), .14, .03, segs=12, rx=-math.pi / 2)

def fc_taxi():
    n = Node('FC_taxi')
    loft(n, 'Paint', [(-2.3, rrect(1.4, .36, .9, .2)), (-2.0, rrect(1.92, .3, 1.05, .3)), (-1.1, rrect(2.02, .3, 1.5, .34)), (1.6, rrect(2.02, .32, 1.58, .34)),
                      (2.2, rrect(1.95, .36, 1.5, .3)), (2.35, rrect(1.6, .45, 1.3, .2))], smooth=True)
    loft(n, 'Glass', [(-1.75, rrect(1.8, 1.0, 1.1, .05)), (-1.2, rrect(2.05, 1.0, 1.48, .3)), (1.55, rrect(2.05, 1.0, 1.52, .3)), (1.9, rrect(1.95, 1.02, 1.42, .28))], smooth=True)
    n.box('Sign', (0, .1, 1.72), (.95, .38, .26)); n.box('Dark', (0, .1, 1.6), (1.0, .42, .04))
    n.box('Headlight', (0, -2.28, .78), (1.4, .08, .08)); n.box('Taillight', (0, 2.36, 1.1), (1.5, .06, .1))
    for s in (-1, 1): n.box('Neon', (s * 1.01, 0, .32), (.05, 3.6, .05)); n.box('Dark', (s * 1.02, 0, .55), (.06, 4.2, .25))
    for (x, y) in ((-.98, -1.5), (.98, -1.5), (-.98, 1.55), (.98, 1.55)): thruster_pod(n, x, y, .12, r=.34)

def fc_sport():
    n = Node('FC_sport')
    loft(n, 'Paint', [(-2.45, rrect(.7, .36, .48, .08)), (-2.1, rrect(1.5, .3, .62, .14)), (-1.0, rrect(1.9, .28, .78, .22)), (.6, rrect(1.96, .3, .84, .26)),
                      (1.8, rrect(1.7, .34, .8, .22)), (2.4, rrect(1.2, .42, .7, .12))], smooth=True)
    loft(n, 'Glass', [(-1.2, rrect(.9, .72, .78, .05)), (-.6, rrect(1.15, .72, 1.08, .25)), (.4, rrect(1.15, .74, 1.12, .26)), (1.0, rrect(.9, .76, .9, .05))], smooth=True)
    for s in (-1, 1):   # the big side turbines
        n.cyl('Dark', (s * 1.18, -.3, .55), .38, 2.4, segs=14, rx=-math.pi / 2); n.cyl('Thruster', (s * 1.18, 2.12, .55), .3, .04, segs=14, rx=-math.pi / 2)
        n.box('Paint', (s * .98, -.3, .55), (.5, 1.6, .12))
    n.face('Paint', [(0, 1.4, .82), (0, 2.45, .78), (0, 2.6, 1.45), (0, 2.2, 1.45)], (1, 0, 0)); n.face('Paint', [(0, 1.4, .82), (0, 2.45, .78), (0, 2.6, 1.45), (0, 2.2, 1.45)], (-1, 0, 0))
    n.box('Headlight', (0, -2.42, .45), (.6, .06, .05)); n.box('Taillight', (0, 2.42, .62), (1.1, .06, .06))
    for s in (-1, 1): n.box('Neon', (s * .95, 0, .3), (.05, 3.0, .05))
    for (x, y) in ((-.7, -1.6), (.7, -1.6)): thruster_pod(n, x, y, .1, r=.24)

def fc_van():
    n = Node('FC_van')
    loft(n, 'Paint', [(-2.8, rrect(1.6, .5, 1.4, .25)), (-2.5, rrect(2.15, .42, 1.9, .35)), (2.6, rrect(2.2, .42, 2.05, .3)), (2.8, rrect(2.05, .5, 1.95, .2))], smooth=True)
    loft(n, 'Glass', [(-2.62, rrect(1.6, 1.15, 1.25, .05)), (-2.45, rrect(2.18, 1.15, 1.85, .3)), (-1.3, rrect(2.18, 1.2, 1.9, .3)), (-1.0, rrect(2.1, 1.2, 1.85, .25))], smooth=True)
    for s in (-1, 1):
        n.box('Neon', (s * 1.11, .8, 1.15), (.05, 3.2, .1)); n.box('Dark', (s * 1.11, .8, .75), (.05, 3.4, .5))
        uv = uvface(n, 'Ad', [(s * 1.12, -.6 if s > 0 else 2.3, 1.0), (s * 1.12, 2.3 if s > 0 else -.6, 1.0), (s * 1.12, 2.3 if s > 0 else -.6, 1.85), (s * 1.12, -.6 if s > 0 else 2.3, 1.85)], (s, 0, 0))
    n.box('Headlight', (0, -2.78, .82), (1.5, .08, .1)); n.box('Taillight', (0, 2.82, 1.5), (1.8, .06, .1))
    for (x, y) in ((-1.55, -2.0), (1.55, -2.0), (-1.55, 2.0), (1.55, 2.0)):
        duct_fan(n, x, y, .85, r=.66); n.box('Dark', (x * .78, y, .85), (abs(x) * .5, .18, .14))

def fc_police():
    n = Node('FC_police')
    loft(n, 'Dark', [(-2.62, rrect(1.2, .34, .56, .12)), (-2.3, rrect(1.9, .28, .66, .2)), (2.2, rrect(2.12, .3, .7, .22)), (2.62, rrect(1.6, .36, .66, .14))], smooth=True)
    loft(n, 'Paint', [(-2.55, rrect(1.15, .5, .78, .12)), (-2.2, rrect(1.9, .6, .98, .22)), (2.1, rrect(2.1, .62, 1.06, .26)), (2.58, rrect(1.6, .6, .98, .16))], smooth=True)
    loft(n, 'Glass', [(-1.4, rrect(1.4, .94, 1.0, .05)), (-.8, rrect(1.7, .94, 1.42, .3)), (.8, rrect(1.74, .95, 1.48, .32)), (1.5, rrect(1.5, .96, 1.32, .26)), (1.85, rrect(1.2, .96, 1.04, .05))], smooth=True)
    for s in (-1, 1):   # light bars down the roof sides, and front and back
        n.box('PoliceRed' if s > 0 else 'PoliceBlue', (s * .62, .1, 1.5), (.14, 1.6, .1))
        n.box('Accent', (s * 1.06, 0, .78), (.04, 3.8, .14))
    n.box('PoliceRed', (-.35, -2.56, .7), (.5, .06, .08)); n.box('PoliceBlue', (.35, -2.56, .7), (.5, .06, .08))
    n.box('PoliceBlue', (-.4, 2.6, .9), (.6, .06, .1)); n.box('PoliceRed', (.4, 2.6, .9), (.6, .06, .1))
    n.box('Headlight', (0, -2.6, .52), (1.1, .06, .06)); n.cyl('Headlight', (0, -1.9, .2), .22, .1, segs=12)   # the searchlight under the nose
    for (x, y) in ((-1.5, -1.75), (1.5, -1.75), (-1.5, 1.8), (1.5, 1.8)):
        duct_fan(n, x, y, .62, r=.6); n.box('Dark', (x * .8, y, .62), (abs(x) * .45, .2, .14))

def build_cars():
    fc_sedan(); fc_taxi(); fc_sport(); fc_van(); fc_police()

# ==================================================================================================== robot people
def build_robot():
    """the 7 parts of a robot, with the joints of the game's PERSON: the torso stands on the hips, the head and crest sit
    on the neck (0.64 up), legs hang from the hips (0.9 m) and arms from the shoulders (front is -Y)"""
    t = Node('RB_torso')
    t.box('Joint', (0, 0, .06), (.3, .18, .12)); t.cyl('Joint', (0, 0, .1), .1, .22, segs=10)
    k = mk(t); t.blob('Body', [((0, 0, .44), (.2, .12, .15)), ((0, 0, .3), (.15, .1, .1))], res=.08);
    t.sphere('Joint', (.19, 0, .55), .075, segs=10, rings=6); t.sphere('Joint', (-.19, 0, .55), .075, segs=10, rings=6)
    t.cyl('Glow', (0, -.105, .44), .045, .03, segs=12, rx=math.pi / 2)
    t.box('Glow', (0, -.1, .3), (.12, .02, .015)); t.box('Joint', (0, 0, .61), (.1, .1, .06))
    h = Node('RB_head')
    h.cyl('Joint', (0, 0, 0), .045, .1, segs=8)
    h.sphere('Body', (0, 0, .2), .12, segs=14, rings=9, scale=(1, .95, 1.08))
    h.lathe('Glow', [(.121, .195), (.121, .245)], segs=16, c=(0, 0, 0), a0=-math.pi * .85, a1=-math.pi * .15, smooth=True)   # the visor across the front (-Y)
    for s in (-1, 1): h.cyl('Joint', (s * .118, 0, .2), .04, .03, segs=10, ry=s * math.pi / 2)
    c = Node('RB_crest')
    c.box('Body', (0, .02, .325), (.04, .18, .05)); c.cyl('Joint', (.07, .03, .3), .008, .14, segs=6); c.sphere('Glow', (.07, .03, .45), .018, segs=6, rings=4)
    l = Node('RB_leg')
    l.sphere('Joint', (0, 0, 0), .07, segs=10, rings=6); l.cyl('Body', (0, 0, -.4), .072, .38, segs=10, r2=.062)
    l.sphere('Joint', (0, 0, -.43), .058, segs=10, rings=6); l.cyl('Body', (0, 0, -.82), .055, .37, segs=10, r2=.065)
    l.box('Glow', (0, -.062, -.6), (.03, .01, .16)); l.box('Joint', (0, -.04, -.865), (.12, .25, .07))
    a = Node('RB_arm')
    a.sphere('Joint', (0, 0, 0), .06, segs=10, rings=6); a.cyl('Body', (0, 0, -.29), .05, .27, segs=10, r2=.044)
    a.sphere('Joint', (0, 0, -.31), .045, segs=8, rings=5); a.cyl('Body', (0, 0, -.57), .042, .25, segs=10, r2=.05)
    a.box('Glow', (0, -.045, -.45), (.02, .01, .1)); a.box('Joint', (0, -.01, -.62), (.07, .08, .09))

# ==================================================================================================== the giant transformer
def build_giant():
    """a 13.5 m robot that folds into a giant hover-truck. Each part's origin is its joint (front -Y); the game scales it
    5-25x, tints Armor (main colour) and Armor2 (trim), and turns the joints."""
    P = {}
    def part(name, parent, at):
        n = Node(name); P[name] = (n, parent, at); return n
    pel = part('TF_pelvis', None, (0, 0, 7.0))
    pel.box('Armor', (0, 0, 0), (3.0, 1.7, 1.3)); pel.box('Dark', (0, -.6, -.5), (1.2, .8, 1.2)); pel.box('Armor2', (0, -.92, .05), (1.4, .12, .8))
    for s in (-1, 1):
        pel.box('Dark', (s * 1.55, 0, 0), (.3, 1.4, 1.0))
        pel.box('Armor2', (s * 1.1, -.95, -.55), (.9, .12, 1.2), ry=s * .12)          # the hip skirt
        pel.box('Armor2', (s * 1.75, 0, -.5), (.12, 1.2, 1.3), ry=s * -.15)
    tor = part('TF_torso', 'TF_pelvis', (0, 0, .6))
    tor.cyl('Dark', (0, 0, 0), .85, 1.2, segs=12); tor.box('Dark', (0, 0, .9), (2.2, 1.4, .6))
    for z in (.25, .55, .85): tor.lathe('Joint', [(.88, z), (.88, z + .12)], segs=12, smooth=False)
    tor.prism('Armor', [(-2.2, -1.25), (2.2, -1.25), (2.5, -.4), (2.5, 1.2), (-2.5, 1.2), (-2.5, -.4)], 1.1, 4.0)
    tor.prism('Armor2', [(-1.7, -1.45), (1.7, -1.45), (1.9, -1.2), (-1.9, -1.2)], 2.4, 3.9)   # the chest plate
    tor.prism('Armor2', [(-1.2, -1.3), (1.2, -1.3), (1.5, -.9), (-1.5, -.9)], 1.15, 2.2)      # the belly plate
    tor.cyl('Glow', (0, -1.47, 3.0), .55, .1, segs=16, rx=math.pi / 2)
    k = mk(tor); tor.lathe('Dark', [(.56, 0), (.72, 0), (.72, .14), (.56, .14), (.56, 0)], segs=16, smooth=False); turn(tor, k, rx=math.pi / 2); move(tor, k, (0, -1.45, 3.0))
    for s in (-1, 1):
        for i in range(3): tor.box('Glow', (s * (.9 + i * .28), -1.47, 2.0), (.12, .06, .7))
        tor.box('Glass', (s * 1.05, -1.3, 3.55), (1.2, .1, .55), ry=s * .1)
        tor.box('Armor2', (s * 1.6, -.2, 4.05), (1.0, 1.6, .25), ry=s * .25)             # the collar
    tor.box('Dark', (0, .2, 4.2), (1.6, 1.4, .5))
    tor.box('Dark', (0, 1.6, 2.6), (2.6, .8, 2.6))                                       # a jet pack on the back
    for s in (-1, 1): tor.cyl('Dark', (s * .75, 1.95, 1.0), .42, 1.2, segs=12); tor.cyl('Thruster', (s * .75, 1.95, .98), .32, .04, segs=12)
    hd = part('TF_head', 'TF_torso', (0, .05, 4.45))
    hd.box('Dark', (0, 0, .25), (.8, .8, .5))
    hd.prism('Armor', [(-.6, -.9), (.6, -.9), (.85, -.45), (.85, .7), (-.85, .7), (-.85, -.45)], .45, 1.95)
    hd.prism('Dark', [(-.5, -.95), (.5, -.95), (.62, -.7), (-.62, -.7)], .6, 1.05)            # the face plate
    hd.box('Eye', (0, -.93, 1.32), (1.15, .08, .2)); hd.box('Glow', (0, -.97, .78), (.3, .04, .08))
    for s in (-1, 1):
        hd.box('Armor2', (s * .84, -.1, 1.95), (.14, .7, 1.1), ry=s * .3)                 # ear fins
        hd.cyl('Metal', (s * .62, .35, 1.9), .05, 1.0, segs=6); hd.sphere('Glow', (s * .62, .35, 2.95), .08, segs=6, rings=4)
    hd.prism('Armor2', [(-.1, -1.05), (.1, -1.05), (.1, .5), (-.1, .5)], 1.9, 2.35)          # the crest
    for s, side in ((1, 'L'), (-1, 'R')):   # arms (L = +X)
        au = part(f'TF_armU_{side}', 'TF_torso', (s * 2.85, 0, 3.55))
        au.sphere('Dark', (0, 0, 0), .6, segs=12, rings=8)
        au.box('Armor2', (s * .4, 0, .35), (1.7, 1.9, 1.2), ry=s * -.18); au.box('Glow', (s * .4, -.96, .35), (1.3, .05, .12), ry=s * -.18)   # the shoulder pad
        au.box('Armor', (s * .2, 0, -1.4), (.95, .95, 2.4))
        au.sphere('Dark', (s * .2, 0, -2.75), .45, segs=10, rings=6)
        af = part(f'TF_armF_{side}', f'TF_armU_{side}', (s * .2, 0, -2.8))
        af.box('Armor', (0, 0, -1.25), (1.15, 1.15, 2.4)); af.box('Glow', (0, -.59, -1.2), (.18, .05, 1.4)); af.box('Armor2', (0, 0, -.25), (1.25, 1.25, .35))
        k = mk(af); af.lathe('Tire', [(.25, -.25), (.62, -.25), (.66, 0), (.62, .25), (.25, .25)], segs=16, smooth=True); af.lathe('Rim', [(0, .26), (.42, .26), (.42, .2)], segs=16, smooth=False)
        turn(af, k, ry=s * math.pi / 2); move(af, k, (s * .62, 0, -1.4))
        hn = part(f'TF_hand_{side}', f'TF_armF_{side}', (0, 0, -2.5))
        hn.box('Dark', (0, 0, -.45), (1.0, .85, .9))
        for i in range(4): hn.box('Dark', (-.36 + i * .24, -.3, -1.05), (.18, .24, .55))
        hn.box('Dark', (s * .55, -.25, -.5), (.2, .24, .55))
    for s, side in ((1, 'L'), (-1, 'R')):
        th = part(f'TF_thigh_{side}', 'TF_pelvis', (s * 1.0, 0, -.35))
        th.sphere('Dark', (0, 0, 0), .55, segs=12, rings=8); th.box('Armor', (0, 0, -1.6), (1.2, 1.3, 2.9)); th.box('Armor2', (s * .62, 0, -1.4), (.12, .9, 2.0))
        th.box('Glow', (s * .69, 0, -1.4), (.04, .2, 1.2))
        sh = part(f'TF_shin_{side}', f'TF_thigh_{side}', (0, 0, -3.2))
        sh.sphere('Dark', (0, 0, 0), .5, segs=10, rings=6); sh.box('Armor', (0, .05, -1.5), (1.35, 1.5, 2.9)); sh.box('Armor2', (0, -.82, -.55), (1.0, .3, 1.3))
        sh.box('Glow', (0, -.79, -1.6), (.5, .05, .12)); sh.box('Thruster', (0, .82, -2.2), (.6, .05, .4))
        for zz in (-.9, -2.2):   # two wheels on the outside of each shin (the truck's wheels)
            k = mk(sh); sh.lathe('Tire', [(.3, -.28), (.75, -.28), (.8, 0), (.75, .28), (.3, .28)], segs=18, smooth=True); sh.lathe('Rim', [(0, .29), (.5, .29), (.5, .22)], segs=18, smooth=False)
            turn(sh, k, ry=s * math.pi / 2); move(sh, k, (s * .75, .35, zz))
        ft = part(f'TF_foot_{side}', f'TF_shin_{side}', (0, 0, -3.0))
        ft.box('Dark', (0, -.35, -.35), (1.4, 2.6, .7)); ft.box('Armor', (0, -1.3, -.22), (1.3, .9, .5)); ft.box('Dark', (0, .85, -.45), (1.2, .5, .5))
        ft.box('Armor2', (0, -1.78, -.4), (1.3, .1, .3))
    build_all()
    for name, (n, parent, at) in P.items():   # place each part at its joint, under its parent
        o = bpy.data.objects[name]
        if parent: o.parent = bpy.data.objects[parent]
        o.location = at

# ==================================================================================================== the police car
def wheel(n, side, r=.38, w=.27, rim=.26):
    """a wheel round its own hub, axle along X, its face out to the side (+1 left, -1 right): tyre, a solid rim, a glowing ring"""
    k = mk(n)
    n.lathe('Tire', [(rim - .01, -w / 2), (r - .04, -w / 2), (r, -w / 2 + .05), (r, w / 2 - .05), (r - .04, w / 2), (rim - .01, w / 2), (rim - .01, -w / 2)], segs=24, smooth=True)
    n.lathe('Rim', [(0, w / 2 - .02), (rim, w / 2 - .02), (rim, -w / 2 + .03)], segs=24, smooth=False)
    n.lathe('Disc', [(0, -w / 2 + .03), (rim, -w / 2 + .03)], segs=24, smooth=False)
    n.lathe('PoliceBlue', [(rim * .78, w / 2 - .01), (rim * .9, w / 2 - .01)], segs=24, smooth=False)
    for i in range(5): a = i * TAU / 5; n.box('Black', (math.cos(a) * rim * .45, math.sin(a) * rim * .45, w / 2 - .005), (.06, rim * .5, .02), rz=a + math.pi / 2)
    turn(n, k, ry=side * math.pi / 2)

def build_enforcer():
    """AMBOOLA Enforcer 3000: a wide armoured cruiser, black-and-white (Paint is white for the police), a push bar, glowing
    strips; the game adds the flashing light bars. Wheels: hubs at x +-0.86, y -1.62 (front) and +1.55, radius .38"""
    b = Node('Body')
    loft(b, 'GlossBlack', [(-2.5, rrect(1.5, .26, .66, .12)), (-2.32, rrect(1.98, .22, .78, .18)), (-1.2, rrect(2.06, .22, .8, .2)), (1.4, rrect(2.06, .24, .82, .2)),
                           (2.4, rrect(1.96, .3, .82, .18)), (2.52, rrect(1.6, .34, .8, .12))], smooth=False)
    loft(b, 'Paint', [(-2.45, rrect(1.6, .66, .86, .1)), (-2.2, rrect(2.0, .72, 1.0, .14)), (-1.0, rrect(2.08, .74, 1.08, .16)), (1.5, rrect(2.08, .76, 1.12, .16)),
                      (2.35, rrect(1.98, .76, 1.14, .14)), (2.5, rrect(1.7, .76, 1.1, .1))], smooth=False)
    loft(b, 'Glass', [(-1.3, rrect(1.62, 1.0, 1.06, .05)), (-.6, rrect(1.76, 1.0, 1.46, .16)), (.9, rrect(1.76, 1.02, 1.5, .16)), (1.55, rrect(1.66, 1.04, 1.38, .14)), (1.9, rrect(1.5, 1.04, 1.12, .05))], smooth=False)
    b.box('Paint', (0, .2, 1.485), (1.46, 1.3, .05))   # the roof panel
    for s in (-1, 1):
        b.box('Accent', (s * 1.045, -.2, .9), (.04, 3.6, .08))                 # a blue stripe down each side
        b.box('Headlight', (s * .62, -2.47, .78), (.62, .06, .06)); b.box('Taillight', (s * .6, 2.53, .9), (.66, .05, .08))
        b.box('Black', (s * 1.04, 0, .42), (.05, 2.0, .3))                     # side armour
    for (x, z) in ((0, .45), (0, .62)): b.box('Black', (x, -2.62, z), (1.6, .14, .1))     # the push bar
    for s in (-1, 1): b.box('Black', (s * .55, -2.58, .55), (.1, .2, .4))
    b.box('Black', (0, 2.56, .5), (1.4, .1, .18)); b.box('Chrome', (0, -2.5, .66), (.7, .03, .14))
    for (name, x, y) in (('Wheel_FL', .86, -1.62), ('Wheel_FR', -.86, -1.62), ('Wheel_RL', .86, 1.55), ('Wheel_RR', -.86, 1.55)):
        w = Node(name); wheel(w, 1 if x > 0 else -1); w.at = (x, y, .38)
    build_all()
    for name in ('Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'):
        bpy.data.objects[name].location = next(n.at for n in NODES if n.name == name)

# ==================================================================================================== export and renders
def export_glb(path, key, texcoords=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects: o.select_set(o.type in ('MESH', 'EMPTY'))
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB', export_yup=True, export_texcoords=texcoords, export_normals=True,
                              export_materials='EXPORT', export_extras=True, use_selection=True, export_apply=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
    with open(path, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    with open(path + '.js', 'w') as f:
        f.write(f"// Generated by models/blender/future.py from {os.path.basename(path)} - do not edit.\n"
                f"(window.AMBOOLA_MODELS = window.AMBOOLA_MODELS || {{}})['{key}'] = '{b64}';\n")
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print(f'exported {path}: {os.path.getsize(path) / 1e6:.2f} MB, {tris} triangles', flush=True)

def night_render(path, cam, look, size=(1280, 720), lens=35, samples=24, world=.05):
    """a night still (so the neon, screens and lamps show)"""
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'; scn.cycles.samples = samples; scn.render.resolution_x, scn.render.resolution_y = size
    bpy.ops.object.camera_add(location=cam); c = bpy.context.active_object; scn.camera = c; c.data.lens = lens; c.data.clip_end = 5000
    c.rotation_euler = (V(*look) - V(*cam)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(55), 0, math.radians(-30))); bpy.context.active_object.data.energy = 1.2
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.05, .06, .14, 1); w.node_tree.nodes['Background'].inputs[1].default_value = world * 10
    bpy.ops.mesh.primitive_plane_add(size=4000); g = bpy.context.active_object; g.data.materials.append(M.get('Ground', '#2a2c32', .6))
    scn.render.filepath = os.path.abspath(path); bpy.ops.render.render(write_still=True)
    for o in [c, g] + [o for o in scn.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o)

def lay_out(names, gap=4.0, y=0.0):
    """put objects side by side along X (copies), return them"""
    made, x = [], 0.0
    objs = [bpy.data.objects[n] for n in names]
    width = sum(o.dimensions.x for o in objs) + gap * (len(objs) - 1); x = -width / 2
    for o in objs:
        c = o.copy(); bpy.context.scene.collection.objects.link(c); c.location = (x + o.dimensions.x / 2, y, c.location.z); c.hide_render = False; made.append(c); x += o.dimensions.x + gap
    return made

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    what = argv[argv.index('--what') + 1].split(',') if '--what' in argv else ['all']
    out = argv[argv.index('--render') + 1] if '--render' in argv else None
    allw = 'all' in what
    MOD = os.path.join(HERE, '..')
    if allw or 'city' in what:
        reset(); mats(); build_city(); build_all()
        if out:
            objs = {o.name: o for o in bpy.context.scene.objects}; made = []
            for k in range(4):   # one stacked tower per family, the house, the hangar
                x = -66 + k * 30; z = 0
                for mname, h in (('G', 6), ('S', 14.4), ('A', 14.4), ('S', 14.4), ('U', 3.6), ('U', 3.6), ('R', 0)):
                    c = objs[f'F{k}{mname}'].copy(); bpy.context.scene.collection.objects.link(c); c.location = (x, 0, z); made.append(c); z += h
            for name, x in (('K', 60), ('W', 85)):
                c = objs[name].copy(); bpy.context.scene.collection.objects.link(c); c.location = (x, 0, 0); made.append(c)
            for o in objs.values(): o.hide_render = True
            night_render(os.path.join(out, 'fut-city.png'), (10, -150, 45), (5, 0, 32), lens=32)
            for o in made: bpy.data.objects.remove(o)
            made = lay_out(['M_0', 'M_1', 'M_2', 'M_2r'], gap=30)
            made[-1].location = made[-2].location
            for c in [bpy.data.objects['H_koi'], bpy.data.objects['H_logo']]:
                cc = c.copy(); bpy.context.scene.collection.objects.link(cc); cc.location = (-150 if c.name == 'H_koi' else 150, -40, 120); cc.hide_render = False; made.append(cc)
            night_render(os.path.join(out, 'fut-mega.png'), (0, -620, 170), (0, 0, 150), lens=30)
            for o in made: bpy.data.objects.remove(o)
            for o in objs.values(): o.hide_render = False
        export_glb(os.path.join(MOD, 'fut_city.glb'), 'fut_city', texcoords=True)
    if allw or 'cars' in what:
        reset(); mats(); build_cars(); build_all()
        if out:
            objs = list(bpy.context.scene.objects); made = lay_out([o.name for o in objs], gap=1.5)
            for m in made: m.location.z = 1.2
            for o in objs: o.hide_render = True
            night_render(os.path.join(out, 'fut-cars.png'), (0, -26, 9), (0, 0, 1), lens=40, world=.25)
            for o in made: bpy.data.objects.remove(o)
            for o in objs: o.hide_render = False
        export_glb(os.path.join(MOD, 'fut_cars.glb'), 'fut_cars', texcoords=True)
    if allw or 'robot' in what:
        reset(); mats(); build_robot(); build_all()
        if out:   # stand one robot up from its parts
            objs = {o.name: o for o in bpy.context.scene.objects}; made = []
            for name, at in (('RB_torso', (0, 0, .92)), ('RB_head', (0, 0, 1.56)), ('RB_crest', (0, 0, 1.56)), ('RB_leg', (.1, 0, .92)), ('RB_leg', (-.1, 0, .92)), ('RB_arm', (.25, 0, 1.47)), ('RB_arm', (-.25, 0, 1.47))):
                c = objs[name].copy(); bpy.context.scene.collection.objects.link(c); c.location = at; made.append(c)
            for o in objs.values(): o.hide_render = True
            night_render(os.path.join(out, 'fut-robot.png'), (1.6, -3.6, 1.5), (0, 0, .9), lens=45, world=.4)
            for o in made: bpy.data.objects.remove(o)
            for o in objs.values(): o.hide_render = False
        export_glb(os.path.join(MOD, 'fut_robot.glb'), 'fut_robot')
    if allw or 'giant' in what:
        reset(); mats(); build_giant()
        if out: night_render(os.path.join(out, 'fut-giant.png'), (14, -26, 9), (0, 0, 6.5), lens=35, world=.4)
        export_glb(os.path.join(MOD, 'fut_giant.glb'), 'fut_giant')
    if allw or 'police' in what:
        reset(); mats(); build_enforcer()
        if out: night_render(os.path.join(out, 'fut-enforcer.png'), (4.5, -6.5, 2.2), (0, 0, .6), lens=40, world=.4)
        export_glb(os.path.join(MOD, 'enforcer.glb'), 'enforcer')
