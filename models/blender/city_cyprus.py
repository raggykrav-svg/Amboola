# Cyprus for AMBOOLA (see cities.py): whitewashed flat-roof houses with blue shutters and solar water heaters,
# stone houses with terracotta roofs and wooden balconies, palms and olive trees, Kolossi Castle, the Kourion theatre,
# Aphrodite's Rock and a Byzantine church.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, arch_wall, storey, band, window, door, outline, hip, gable, flat_roof, chimney, tree_palm, tree_round)

def build():
    M.get('Roof', '#ffffff', .75); M.get('Stone', '#e8d9bc', .9); M.get('Frame', '#f4f0e6', .8); M.get('ShutterB', '#2f6f9f', .6); M.get('ShutterGr', '#4f7a4a', .6)
    M.get('DoorB', '#24578a', .6); M.get('Door', '#6a4426', .6); M.get('Wood', '#7a5434', .8); M.get('Solar', '#1c2c4a', .25, metal=.4); M.get('Tank', '#e9ecef', .4, metal=.5)
    M.get('Flowers', '#d8337f', .8); M.get('Pot', '#b5532f', .8)
    for k in range(3):
        for lo in (False, True): family(k, lo)
    t = Node('T_palm'); M.get('Trunk', '#7a5c3e', .9); M.get('Leaf', '#2f7a35', .8, double=True); M.get('Coconut', '#5a4a2a', .8); tree_palm(t, h=9)
    t = Node('T_round'); M.get('Leaves', '#6a8a3a', .9); M.get('Bark', '#6a5a48', .9); tree_round(t, h=6.5, r=2.8)
    kolossi(); kourion(); rock(); church()

def family(k, lo):
    """0: whitewashed cube house, blue shutters, flat roof with a solar water heater. 1: stone house, green shutters,
    wooden balcony, hipped tile roof. 2: white house with pink bougainvillea and a gable tile roof"""
    W = D = 17.0; GH, FH = 3.2, 3.0; x = 'l' if lo else ''; rnd = random.Random(30 + k)
    sh = ['ShutterB', 'ShutterGr', 'ShutterB'][k]
    S = dict(spacing=3.4, ww=1.0, wh=1.35, v0=.95, frame='Frame', fw=.12, sill='Frame', shutters=sh, margin=1.6, lite=lo)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH); g.box('Wall', (0, 0, GH / 2), (W, D, GH))
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3.2
        for i, u in enumerate((-L / 3, 0, L / 3)):
            if i == 1:
                if lo: F.quad('DoorB' if k != 1 else 'Door', u - .6, 0, u + .6, 2.3, .04)
                else: door(F, u, 1.2, 2.3, dict(frame='Frame', fw=.14, door_arch=.5 if k == 1 else 0, step='Stone'), 'DoorB' if k != 1 else 'Door')
            else: window(F, u, .95, 1.0, 1.35, S, rnd)
        if k == 2 and not lo and side % 2 == 0:   # bougainvillea climbing a corner
            for j in range(7): g.ico('Flowers', F.P(F.L / 2 - .8 - j * .35, 1.2 + j * .3 + rnd.random() * .3, .3), .5 + rnd.random() * .3, sub=1, jitter=.2, rnd=rnd)
    if not lo: band(g, 'Frame', W, D, 0, .25, .05)
    u = Node(f'U{k}{x}', W=W, D=D, H=FH); storey(u, W, D, 0, FH, S, rnd)
    b = Node(f'B{k}{x}', W=W, D=D, H=FH); storey(b, W, D, 0, FH, S, rnd)
    if k == 1:   # a wooden balcony along the front and back
        for side in (0, 2):
            F = Face(b, W, D, side, 0)
            F.block('Wood', -F.L / 2 + 2, -.05, F.L / 2 - 2, .1, 0, 1.2)
            if not lo:
                F.quad('Wood', -F.L / 2 + 2, .9, F.L / 2 - 2, 1.0, 1.18)
                for j in range(int(F.L - 4) * 2): F.block('Wood', -F.L / 2 + 2 + j * .5, .1, -F.L / 2 + 2.06 + j * .5, .9, 1.12, 1.18)
    r = Node(f'R{k}{x}', W=W, D=D)
    if k == 0:
        flat_roof(r, W, D, 0, par=.8, coping='Frame')
        r.box('Frame', (-W / 4, D / 4, 1.3), (3, 3, 2.6))                                   # the stair hut
        r.box('Solar', (W / 5, -D / 5, 1.4), (2.2, 1.6, .08), rx=math.radians(-35)); r.cyl('Tank', (W / 5 - 1.05, -D / 5 + .9, 2.0), .35, 2.1, segs=10, ry=math.pi / 2)
        r.boxa('Metal', W / 5 - 1.1, -D / 5 - .6, .1, W / 5 + 1.1, -D / 5 + .9, .16)
        if not lo:
            for xx in (-W / 3, -W / 6): r.cyl('Metal', (xx, -D / 2 + 1.2, 0), .04, 2.5, segs=4, smooth=False)   # rebar for the next floor
    elif k == 1: hip(r, W + .4, D + .4, 0, 3.2, o=.7)
    else: gable(r, W, D, 0, 3.4, o=.6)
    if k and not lo: chimney(r, -W / 4, 0, 2.0, w=.7, d=.7, h=1.4, m='Frame', pots=1)

# ---------------------------------------------------------------- Kolossi Castle: game anchor (ox-425, oz-115), 22 x 22, 24 m
def kolossi():
    M.get('Castle', '#c9a777', .9); M.get('CastleDark', '#a88a5e', .95)
    n = Node('L_kolossi')
    n.box('Castle', (0, 0, 12), (22, 22, 24)); n.box('CastleDark', (0, 0, .6), (22.6, 22.6, 1.2))
    for z in (8.2, 16.2): n.box('CastleDark', (0, 0, z), (22.3, 22.3, .4))                 # string courses (floors)
    for side in range(4):
        F = Face(n, 22, 22, side, 0)
        for z, w, h in ((4, .5, 1.6), (11, .7, 2.0), (18.5, .8, 2.2)):
            for u in (-6, 0, 6): F.poly('Dark', outline(u - w / 2, z, u + w / 2, z + h, w / 2, 4), .03)
        F.block('Castle', -11, 23.2, 11, 24.4, -.4, .6)                                    # parapet
        for j in range(8): F.block('Castle', -10.2 + j * 2.9, 24.4, -9.0 + j * 2.9, 26.0, -.4, .6)   # merlons
    F = Face(n, 22, 22, 2, 0)   # the machicolation over the door and the outside stair
    F.block('CastleDark', -2.5, 19, 2.5, 21.5, 0, 1.6); F.poly('Dark', outline(-1, 8.6, 1, 11.6, 1, 6), .03)
    for j in range(10): F.block('Castle', -6 + j * .5, 0, -5.5 + j * .5, .9 + j * .85, 0, 2.0)

# ---------------------------------------------------------------- Kourion: game anchor (ox+255, oz+35). Theatre bowl in game z -24..6
def kourion():
    M.get('Ruin', '#d9c7a0', .95); M.get('Marble', '#f2ece0', .6)
    n = Node('L_kourion'); cy = -6.0   # the orchestra centre at game z +6 -> Blender y -6
    # seating rows climbing to the north (Blender +y): half rings from radius 8 to 30
    rows = 14
    for j in range(rows):
        r0, r1, z = 8 + j * 22 / rows, 8 + (j + 1) * 22 / rows, (j + 1) * .85
        prof = [(r0, z - .85), (r0, z), (r1, z)]
        n.lathe('Ruin', prof, segs=24, c=(0, cy, 0), a0=0, a1=math.pi, smooth=False)
    n.lathe('Ruin', [(30, 0), (30, rows * .85)], segs=24, c=(0, cy, 0), a0=0, a1=math.pi, smooth=False)
    for a in (math.pi / 4, math.pi / 2, 3 * math.pi / 4):   # aisle stairs
        n.box('Marble', (math.cos(a) * 19, cy + math.sin(a) * 19, 6), (1.2, 22, .2), rz=a - math.pi / 2, rx=math.atan2(rows * .85, 22) * (1 if a < 7 else 1))
    n.lathe('Marble', [(0, .05), (8, .05)], segs=24, c=(0, cy, 0), a0=math.pi, a1=2 * math.pi, smooth=False)
    n.lathe('Marble', [(0, .05), (8, .05)], segs=24, c=(0, cy, 0), a0=0, a1=math.pi, smooth=False)   # orchestra floor
    n.boxa('Ruin', -14, cy - 1.5, 0, 14, cy - .3, 1.4)                                       # stage front
    # the column ring (18 columns, radius 38, north half), some broken
    for i in range(18):
        a = math.pi + i / 17 * math.pi; x, y = math.cos(a) * 38, -math.sin(a) * 38
        h = 9 if i % 4 else 4.5 + (i % 3)
        n.cyl('Marble', (x, y, 0), .9, .5, segs=10); n.cyl('Marble', (x, y, .5), .75, h - .5, segs=10)
        if h == 9: n.box('Marble', (x, y, 9.2), (2.0, 2.0, .45))
    for i in range(0, 17, 2):   # a few lintels still on top
        a0, a1 = math.pi + i / 17 * math.pi, math.pi + (i + 1) / 17 * math.pi
        if i % 4 == 0: continue
        p0, p1 = V(math.cos(a0) * 38, -math.sin(a0) * 38, 9.65), V(math.cos(a1) * 38, -math.sin(a1) * 38, 9.65); d = p1 - p0
        n.box('Marble', (p0 + p1) / 2, (d.length + 1.6, 1.6, .8), rz=math.atan2(d.y, d.x))

# ---------------------------------------------------------------- Aphrodite's Rock: game anchor (ox+120, C.z1+110), in the sea
def rock():
    M.get('RockC', '#bfae94', 1)
    n = Node('L_rock'); rnd = random.Random(4)
    n.ico('RockC', (0, 0, 10), 24, sub=3, scale=(1, .8, 1.5), jitter=.16, rnd=rnd)
    n.ico('RockC', (14, 6, 4), 12, sub=2, scale=(1, 1, 1.2), jitter=.2, rnd=rnd)
    for k in range(6):
        a = k * 1.1; n.ico('RockC', (math.cos(a) * 30, math.sin(a) * 24, 1), 4 + rnd.random() * 5, sub=1, scale=(1, 1, .7), jitter=.2, rnd=rnd)

# ---------------------------------------------------------------- the church: game anchor (ox-85, oz-265), footprint 18 x 26
def church():
    M.get('ChurchW', '#f2ead8', .8); M.get('Tile', '#b5532f', .7); M.get('Bell', '#8a6a2a', .4, metal=.7)
    n = Node('L_church'); rnd = random.Random(8)
    n.box('ChurchW', (0, 0, 5), (10, 24, 10)); n.box('ChurchW', (0, 2, 5), (18, 8, 10))   # nave and transepts (cross plan)
    gable(n, 10, 24, 10, 3.0, o=.4, m='Tile', ends='ChurchW', ridge='y'); gable(n, 18, 8, 10, 2.6, o=.4, m='Tile', ends='ChurchW', ridge='x')
    n.cyl('ChurchW', (0, 2, 10), 3.6, 4.0, segs=16)                                       # drum
    for k in range(8):
        a = 2 * math.pi * k / 8; F = Frame3(n, V(math.cos(a), math.sin(a) + 2 / 3.6, 0) * 3.6, V(-math.sin(a), math.cos(a), 0), V(math.cos(a), math.sin(a), 0), 10)
        F.O = V(math.cos(a) * 3.6, 2 + math.sin(a) * 3.6, 0); F.poly('Dark', outline(-.35, 1.2, .35, 3.0, .35, 4), .03)
    n.sphere('Tile', (0, 2, 14), 3.9, segs=16, rings=8, hemi=True); n.cyl('Bell', (0, 2, 17.8), .15, 1.6, segs=6)
    n.cyl('ChurchW', (0, -12, 0), 3.5, 8.5, segs=12, smooth=True); n.sphere('Tile', (0, -12, 8.5), 3.6, segs=12, rings=6, hemi=True)   # apse (east end)
    for side in (1, 3):
        F = Face(n, 10, 24, side, 0)
        for u in (-8, -3, 6): F.poly('Window', outline(u - .5, 4, u + .5, 7, .5, 4), .03)
    F = Face(n, 10, 24, 0, 0); door(F, 0, 2, 3.4, dict(frame='ChurchW', fw=.3, door_arch=.5), 'Door')
    # the bell tower beside the west door
    n.box('ChurchW', (6.5, 10.5, 7), (3.5, 3.5, 14))
    for side in range(4):
        F = Frame3(n, V(6.5, 10.5, 0) + [V(0, 1.75, 0), V(1.75, 0, 0), V(0, -1.75, 0), V(-1.75, 0, 0)][side], [V(1, 0, 0), V(0, -1, 0), V(-1, 0, 0), V(0, 1, 0)][side], [V(0, 1, 0), V(1, 0, 0), V(0, -1, 0), V(-1, 0, 0)][side])
        F.poly('Dark', outline(-.7, 10.5, .7, 13, .7, 4), .03)
    n.cyl('Bell', (6.5, 10.5, 10.6), .55, .9, segs=10, r2=.3)
    hip(n, 3.9, 3.9, 14, 1.6, o=.25, m='Tile', at=(6.5, 10.5))
