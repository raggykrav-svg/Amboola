# New York for AMBOOLA (see cities.py): Art Deco stone towers with water tanks, dark glass towers, brick towers with
# fire escapes, street trees, the Empire State Building and the Statue of Liberty on her island.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, band, outline, flat_roof, tree_round)

def build():
    M.get('Glass', '#2a3a4a', .06, metal=.6); M.get('Spandrel', '#3a3f46', .6); M.get('Brass', '#b08a3a', .3, metal=.9); M.get('Canopy', '#1e2a3a', .6, double=True)
    M.get('TankWood', '#7a5434', .9); M.get('Frame', '#e8e2d6', .7); M.get('Stone', '#d8d0c0', .8)
    for k in range(3):
        for lo in (False, True): family(k, lo)
    t = Node('T_round'); M.get('Leaves', '#4f7a34', .9); M.get('Bark', '#5a4a38', .9); tree_round(t, h=8, r=3.0)
    empire(); liberty()

def water_tank(n, x, y, z):
    """the wooden water tank on legs that sits on top of so many New York buildings"""
    for sx in (-1, 1):
        for sy in (-1, 1): n.cyl('Metal', (x + sx * 1.6, y + sy * 1.6, z), .12, 3.2, segs=4, smooth=False)
    n.cyl('Metal', (x, y, z + 3.0), 2.6, .3, segs=10)
    n.cyl('TankWood', (x, y, z + 3.3), 2.4, 4.2, segs=12)
    for b in (.6, 2.0, 3.4): n.cyl('Metal', (x, y, z + 3.3 + b), 2.45, .12, segs=12)
    n.cyl('TankWood', (x, y, z + 7.5), 2.5, 1.6, segs=12, r2=.2)

def family(k, lo):
    """0: Art Deco stone tower: vertical piers with window columns between dark spandrels, brass doors, water tank.
    1: dark glass curtain wall with thin mullions and a lit crown. 2: brick tower with punched windows, a black iron fire
    escape and a heavy cornice"""
    W = D = 32.0; GH, FH = 6.0, 16.0; x = 'l' if lo else ''; rnd = random.Random(50 + k)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH)
    g.box('Wall', (0, 0, GH / 2), (W, D, GH)); band(g, 'Stone', W, D, GH - .6, .6, .25)
    for side in range(4):
        F = Face(g, W, D, side, 0)
        for i in range(4):
            c = -F.L / 2 + (i + .5) * F.L / 4
            F.quad('Window', c - 2.6, .4, c + 2.6, 4.6, .03)
            if not lo: F.ring('Spandrel' if k else 'Brass', outline(c - 2.6, .4, c + 2.6, 4.6), outline(c - 2.8, .2, c + 2.8, 4.8), .08)
        if not lo: F.block('Canopy', -3, 4.2, 3, 4.45, 0, 3.5); F.quad('Brass', -1.6, 0, 1.6, 3.6, .1)
    u = Node(f'U{k}{x}', W=W, D=D, H=FH)
    if k == 1: u.box('Glass', (0, 0, FH / 2), (W, D, FH))
    else: u.box('Wall', (0, 0, FH / 2), (W, D, FH))
    for side in range(4):
        F = Face(u, W, D, side, 0); L = F.L
        if k == 0:
            cols = 8
            for i in range(cols):
                c = -L / 2 + (i + .5) * L / cols
                for f in range(4):
                    F.quad('Window' if rnd.random() < .5 else 'WindowOff', c - 1.2, f * 4 + .7, c + 1.2, f * 4 + 3.4, .02)
                    if not lo: F.quad('Spandrel', c - 1.2, f * 4 + 3.4, c + 1.2, f * 4 + 4.7, .02)
                if not lo: F.block('Wall', c + L / cols / 2 - .45, 0, c + L / cols / 2 + .45, FH, 0, .5)
        elif k == 1:
            for f in range(4):
                for i in range(6):
                    c = -L / 2 + (i + .5) * L / 6
                    if rnd.random() < .45: F.quad('Window', c - L / 12 + .1, f * 4 + .9, c + L / 12 - .1, f * 4 + 3.9, .02)
                if not lo: F.quad('Spandrel', -L / 2, f * 4, L / 2, f * 4 + .9, .03)
            if not lo:
                for i in range(13): F.block('Metal', -L / 2 + i * L / 12 - .06, 0, -L / 2 + i * L / 12 + .06, FH, 0, .25)
        else:
            for f in range(4):
                for i in range(7):
                    c = -L / 2 + 2 + (i + .5) * (L - 4) / 7
                    F.quad('Window' if rnd.random() < .5 else 'WindowOff', c - .75, f * 4 + 1.0, c + .75, f * 4 + 3.2, .02)
                    if not lo: F.quad('Stone', c - .9, f * 4 + .8, c + .9, f * 4 + 1.0, .1); F.quad('Stone', c - .9, f * 4 + 3.2, c + .9, f * 4 + 3.45, .1)
            if not lo and side == 0:   # the fire escape: landings and zig-zag stairs
                for f in range(4):
                    z = f * 4 + .9; F.block('Metal', -9, z - .1, 3, z, 0, 1.3); F.quad('Metal', -9, z, 3, z + .9, 1.28)
                    a, b = (F.P(-7, z, .7), F.P(1, z + 4, .7)) if f % 2 == 0 else (F.P(1, z, .7), F.P(-7, z + 4, .7))
                    d = b - a; u.box('Metal', (a + b) / 2, (d.length, .9, .08), rz=math.atan2(d.y, d.x), ry=-math.atan2(d.z, math.hypot(d.x, d.y)))
    r = Node(f'R{k}{x}', W=W, D=D)
    if k == 0:   # Art Deco setbacks
        band(r, 'Stone', W, D, 0, .8, .2)
        r.box('Wall', (0, 0, 5), (W - 6, D - 6, 8.4)); band(r, 'Stone', W - 6, D - 6, 9, .6, .2)
        r.box('Wall', (0, 0, 12), (W - 14, D - 14, 6)); r.cyl('Stone', (0, 0, 15), (W - 14) * .7, 6, segs=4, r2=.3, rz=math.pi / 4, smooth=False)
        if not lo:
            for side in range(4):
                F = Face(r, W - 6, D - 6, side, .8)
                for i in range(5): F.quad('Window' if i % 2 else 'WindowOff', -8 + i * 4 - .6, 1.5, -8 + i * 4 + .6, 6.8, .02)
            water_tank(r, W / 2 - 4, D / 2 - 4, .8)
    elif k == 1:
        flat_roof(r, W, D, 0, par=1.5, m='Spandrel', coping='Metal')
        r.box('Spandrel', (0, 0, 3.5), (W * .5, D * .5, 7)); r.box('Glow', (0, 0, 7.1), (W * .5 + .2, D * .5 + .2, .4))
        r.cyl('Metal', (W * .15, 0, 7), .25, 18, segs=6, r2=.05); r.sphere('Glow', (W * .15, 0, 25.2), .5, segs=6, rings=4)
    else:
        r.box('Stone', (0, 0, .9), (W + 1.6, D + 1.6, 1.8))                                    # the heavy cornice
        flat_roof(r, W, D, 1.8, par=.9, m='Wall', coping='Stone')
        r.box('Wall', (-W / 4, D / 4, 3.8), (6, 5, 4))
        if not lo: water_tank(r, W / 4, -D / 5, 1.8)

# ---------------------------------------------------------------- the Empire State Building: game anchor (ox-85, oz-115), 44 x 36 base
def empire():
    M.get('Lime', '#c9c2b2', .6); M.get('Steel', '#b9c0c6', .3, metal=.8); M.get('DecoGlass', '#2a3440', .2, metal=.3)
    n = Node('L_empire'); rnd = random.Random(9)
    tiers = [(44, 36, 0, 26), (38, 30, 26, 150), (30, 24, 150, 205), (22, 18, 205, 236), (14, 12, 236, 258)]
    for w, d, z0, z1 in tiers:
        n.box('Lime', (0, 0, (z0 + z1) / 2), (w, d, z1 - z0))
        for side in range(4):   # window columns between the limestone piers
            F = Face(n, w, d, side, z0); cols = max(3, int(F.L / 2.6))
            for i in range(cols):
                c = -F.L / 2 + (i + .5) * F.L / cols
                F.quad('Window' if rnd.random() < .45 else 'DecoGlass', c - .5, 1.5, c + .5, z1 - z0 - 1.5, .03)
                F.block('Steel', c - .08, 1.5, c + .08, z1 - z0 - 1.5, 0, .12)
        band(n, 'Lime', w, d, z1 - .6, .6, .3)
    # the mooring mast: a glowing crown, a lantern and the antenna
    n.cyl('Lime', (0, 0, 258), 5.0, 10, segs=8, r2=4.0); n.cyl('Glow', (0, 0, 268), 4.0, 6, segs=8, r2=3.0)
    for k in range(8):
        a = 2 * math.pi * k / 8; n.box('Steel', (math.cos(a) * 3.6, math.sin(a) * 3.6, 271), (.5, .5, 6))
    n.cyl('Steel', (0, 0, 274), 2.6, 8, segs=8, r2=1.4); n.cyl('Steel', (0, 0, 282), 1.0, 40, segs=8, r2=.25)
    n.sphere('Glow', (0, 0, 322.5), 1.0, segs=6, rings=4)
    n.box('DecoGlass', (0, 18.05, 3.5), (12, .3, 7))   # the entrance

# ---------------------------------------------------------------- the Statue of Liberty: game anchor (ox-420, C.z1+170), island r 40-46
def liberty():
    M.get('Copper', '#6fae9a', .55, metal=.3); M.get('Gold', '#d5b46a', .25, metal=1.0); M.get('Granite', '#c9b99a', .85); M.get('Grass', '#6f8f4a', 1); M.get('Flame', '#ffc23a', .3, emit='#ffb020', strength=3)
    n = Node('L_liberty')
    n.lathe('Granite', [(46, -3), (40, .8), (0, .8)], segs=32, smooth=False)
    n.lathe('Grass', [(38, .82), (0, .82)], segs=32, smooth=False)
    star = []
    for i in range(22):   # the eleven-point star fort
        a = 2 * math.pi * i / 22; r = 26 if i % 2 == 0 else 18; star.append((math.cos(a) * r, math.sin(a) * r))
    n.prism('Granite', star, .8, 7)
    n.box('Granite', (0, 0, 13), (17, 17, 12)); n.box('Granite', (0, 0, 21), (14, 14, 6)); n.box('Granite', (0, 0, 26), (11, 11, 5))   # pedestal
    for side in range(4):
        F = Face(n, 14, 14, side, 18)
        for u in (-3.5, 0, 3.5): F.poly('Dark', outline(u - .7, 1.2, u + .7, 4.2, .7, 4), .03)
    # the statue: robe, body, head with crown, raised torch arm, tablet
    n.lathe('Copper', [(5.6, 28.5), (5.0, 32), (4.2, 40), (3.8, 46), (3.3, 50), (2.6, 53)], segs=16)
    for k in range(10):   # folds in the robe
        a = 2 * math.pi * k / 10; n.box('Copper', (math.cos(a) * 4.6, math.sin(a) * 4.6, 37), (.8, .8, 16), rz=a)
    n.lathe('Copper', [(2.6, 53), (1.4, 55.5), (1.1, 56.2)], segs=12)
    n.sphere('Copper', (0, .3, 58), 1.9, segs=12, rings=8)
    for k in range(7):
        a = math.pi / 2 + (k - 3) * .42
        n.cyl('Copper', (math.cos(a) * 1.8, .3 + math.sin(a) * 1.8, 59.2), .35, 3.0, segs=4, r2=.02, rx=-math.sin(a) * .9, ry=math.cos(a) * .9, smooth=False)
    n.tube('Copper', [V(1.8, 0, 54), V(3.0, -.2, 59), V(3.6, -.4, 66)], .75, segs=8, r_end=.55)    # the raised right arm
    n.cyl('Copper', (3.6, -.4, 66), .8, 2.2, segs=10, r2=1.2); n.lathe('Gold', [(1.3, 68.2), (1.5, 68.6), (.5, 68.8)], segs=10, c=(3.6, -.4, 0))
    n.cyl('Flame', (3.6, -.4, 68.6), .9, 3.0, segs=8, r2=.05)
    n.box('Copper', (-2.6, -1.2, 48), (1.0, 3.2, 4.4), rz=.3)                                # the tablet
