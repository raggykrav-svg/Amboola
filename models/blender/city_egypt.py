# Egypt for AMBOOLA (see cities.py): sand-coloured flat-roof houses with wooden shutters, mashrabiya balconies,
# little domes and pigeon towers, date palms, the Sphinx, the three pyramids (stepped stone with gold caps) and an
# obelisk.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, storey, band, window, door, outline, flat_roof, tree_palm)

def build():
    M.get('Frame', '#e9dcc0', .85); M.get('Stone', '#d8bf8e', .9); M.get('Shutter', '#6a4426', .7); M.get('Door', '#3a6a8a', .6); M.get('Paint', '#2a9a9a', .6)
    M.get('Mash', '#5a3a22', .8); M.get('DomeW', '#f2ead8', .8); M.get('Tank', '#d8dde2', .5, metal=.4); M.get('Cloth', '#c8141b', .8, double=True); M.get('Wood', '#7a5434', .8)
    for k in range(3):
        for lo in (False, True): family(k, lo)
    t = Node('T_palm'); M.get('Trunk', '#8a6a48', .9); M.get('Leaf', '#4a8a2a', .8, double=True); M.get('Coconut', '#7a4a1a', .8); tree_palm(t, h=10, lean=.6)
    sphinx(); pyramid(); obelisk()

def family(k, lo):
    """0: plain sandstone house, arched shuttered windows, a roof terrace with a water tank. 1: a wooden mashrabiya bay
    on the front, a small white dome on the roof. 2: painted door frames and a pigeon tower on the roof"""
    W = D = 16.0; GH, FH = 3.2, 3.0; x = 'l' if lo else ''; rnd = random.Random(80 + k)
    S = dict(spacing=3.4, ww=.9, wh=1.3, v0=.9, frame='Frame', fw=.12, shutters='Shutter', sill='Frame', arch=.5, margin=1.6, lite=lo)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH); g.box('Wall', (0, 0, GH / 2), (W, D, GH))
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3
        for i, u in enumerate((-L / 3, 0, L / 3)):
            if i == 1:
                if lo: F.quad('Door', u - .6, 0, u + .6, 2.3, .04)
                else:
                    door(F, u, 1.2, 2.4, dict(frame='Paint' if k == 2 else 'Frame', fw=.25, door_arch=.5, step='Stone'), 'Door')
            else: window(F, u, .9, .9, 1.3, S, rnd)
    if not lo: band(g, 'Stone', W, D, 0, .4, .05)
    for name in (f'U{k}{x}', f'B{k}{x}'):
        u = Node(name, W=W, D=D, H=FH); storey(u, W, D, 0, FH, S, rnd)
        if k == 1 and not lo:   # the mashrabiya: a wooden lattice bay on the front
            F = Face(u, W, D, 0, 0)
            F.block('Mash', -2.4, .3, 2.4, 2.8, 0, 1.1)
            for j in range(9): F.quad('Frame', -2.2 + j * .55, .5, -2.1 + j * .55, 2.6, 1.12)
            for j in range(5): F.quad('Frame', -2.3, .6 + j * .45, 2.3, .66 + j * .45, 1.13)
    r = Node(f'R{k}{x}', W=W, D=D)
    flat_roof(r, W, D, 0, par=1.0, coping='Stone')
    if not lo:
        for side in range(4):   # stepped crenellation along the parapet
            F = Face(r, W, D, side, 1.0)
            for j in range(int(F.L / 1.6)): F.block('Wall', -F.L / 2 + .3 + j * 1.6, 0, -F.L / 2 + 1.0 + j * 1.6, .45, -.3, 0)
    if k == 0:
        r.cyl('Tank', (W / 4, D / 4, .1), 1.0, 1.6, segs=10); r.box('Wall', (-W / 4, -D / 4, 1.2), (3, 3, 2.4))
        if not lo:
            for s in (-1, 1): r.cyl('Wood', (-W / 6 + s * 2, D / 5, .1), .07, 2.4, segs=4, smooth=False)
            r.box('Cloth', (-W / 6, D / 5, 2.5), (4.4, 3, .05))                                 # the shade over the terrace
    elif k == 1:
        r.cyl('DomeW', (0, 0, .1), 2.8, 1.0, segs=12); r.sphere('DomeW', (0, 0, 1.1), 2.8, segs=12, rings=6, hemi=True)
    else:
        r.cyl('Wall', (W / 4, -D / 4, .1), 2.2, 6, segs=10, r2=.6)                           # the pigeon tower
        if not lo:
            for j in range(12): a = j * 2.1; r.box('Dark', (W / 4 + math.cos(a) * (1.9 - j * .1), -D / 4 + math.sin(a) * (1.9 - j * .1), 1 + j * .4), (.25, .25, .25), rz=a)

# ---------------------------------------------------------------- the Sphinx: game anchor (ox-85, oz+35); faces game -z (Blender +y)
def sphinx():
    M.get('Sphinx', '#c9a468', .95); M.get('SphinxDark', '#a8854c', .95); M.get('Nemes', '#d9b878', .9)
    n = Node('L_sphinx'); rnd = random.Random(2)
    n.box('SphinxDark', (0, -2, .4), (14, 46, .8))                                           # the rock bed
    # the lion's body: one smooth form - haunches at the back, a deep chest, front legs stretched out with big paws
    parts = [((0, -11, 3.6), (4.6, 7.5, 3.4)), ((0, -2, 3.8), (4.4, 7.0, 3.4)), ((0, 5.5, 4.4), (4.6, 5.0, 4.0)), ((0, 9.5, 6.2), (3.0, 2.6, 3.6)),
             ((0, -17, 2.4), (3.0, 3.0, 2.2))]
    for s_ in (-1, 1):
        parts += [((s_ * 2.7, 14.5, 1.4), (1.5, 7.5, 1.4)), ((s_ * 2.7, 21.2, 1.0), (1.7, 1.8, 1.0)), ((s_ * 3.6, -12, 2.2), (1.8, 5.0, 2.2))]
    n.blob('Sphinx', parts, res=.7)
    n.tube('Sphinx', [V(3.6, -19, .8), V(5.0, -12, .8), V(5.8, -4, .9)], .5, segs=6)        # the tail along the side
    # the head with the striped nemes head-dress
    n.box('Sphinx', (0, 10.5, 9.5), (4.4, 4.6, 5.0))
    n.cyl('Nemes', (0, 10.2, 12.0), 3.3, 2.0, segs=4, r2=2.1, rz=math.pi / 4, smooth=False)
    for s in (-1, 1):
        n.box('Nemes', (s * 2.8, 10.2, 9.4), (1.2, 3.6, 5.6), rz=s * .05)                      # lappets either side of the face
        for j in range(5): n.box('SphinxDark', (s * 3.42, 10.2, 7.2 + j * 1.1), (.05, 3.6, .25))
    n.box('SphinxDark', (0, 12.85, 10.6), (2.4, .1, .35)); n.box('SphinxDark', (0, 12.85, 9.2), (.7, .4, 1.0))   # brow and nose
    n.box('Sphinx', (0, 12.3, 6.6), (1.4, 1.4, 2.6))                                          # the beard stump
    for s in (-1, 1): n.box('Dark', (s * .9, 12.84, 10.1), (.7, .05, .3))                     # eyes

# ---------------------------------------------------------------- a great pyramid (placed three times, scaled); 226 m base, 140 m high
def pyramid():
    M.get('Block', '#d8b678', 1); M.get('BlockDark', '#c4a062', 1); M.get('GoldCap', '#ffd23a', .2, metal=.85)
    n = Node('P_pyramid'); H, B, steps = 140.0, 113.0, 46
    for j in range(steps):   # stepped courses of stone
        z0, z1 = j * H / steps, (j + 1) * H / steps; b = B * (1 - j / steps) - .4
        n.box('Block' if j % 2 else 'BlockDark', (0, 0, (z0 + z1) / 2), (2 * b, 2 * b, z1 - z0))
    n.cyl('GoldCap', (0, 0, H - 4), B * 4 / H * 1.42, 8, segs=4, r2=.05, rz=math.pi / 4, smooth=False)

# ---------------------------------------------------------------- the obelisk: game anchor (ox+255, oz-115), 3 m wide
def obelisk():
    M.get('Granite', '#b88a6a', .7); M.get('Hiero', '#7a5a3a', .8); M.get('GoldCap', '#ffd23a', .2, metal=.85)
    n = Node('L_obelisk')
    n.box('Stone', (0, 0, .5), (4.2, 4.2, 1.0)); n.box('Stone', (0, 0, 1.4), (3.4, 3.4, .8))
    n.cyl('Granite', (0, 0, 1.8), 2.0, 28, segs=4, r2=1.3, rz=math.pi / 4, smooth=False)
    n.cyl('GoldCap', (0, 0, 29.8), 1.3, 2.6, segs=4, r2=.02, rz=math.pi / 4, smooth=False)
    for side in range(4):   # columns of carved hieroglyphs
        a = side * math.pi / 2; d = V(math.cos(a), math.sin(a), 0); t = V(-d.y, d.x, 0)
        for j in range(14):
            z = 4 + j * 1.7; w = lerp(1.38, .92, (z - 1.8) / 28)
            n.box('Hiero', d * (w + .01) + V(0, 0, z), (.05 if abs(d.x) > .5 else .7, .7 if abs(d.x) > .5 else .05, .9))
