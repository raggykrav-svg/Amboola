# London for AMBOOLA (see cities.py): brick Georgian terraces with white sash windows, stucco ground floors, black
# railings and colourful doors, Victorian bay windows, pubs, slate roofs with chimney stacks, plane trees, Big Ben,
# the London Eye (its wheel turns in the game), the palace, red phone boxes and double-decker buses.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, arch_wall, storey, band, window, door, outline, gable, hip, chimney, tree_round)

def build():
    M.get('Roof', '#ffffff', .7); M.get('Stucco', '#efe9dc', .8); M.get('Frame', '#f6f4ee', .6); M.get('Stone', '#e6dfcf', .8); M.get('Brick', '#8a4a3a', .9)
    M.get('Pot', '#b5532f', .8); M.get('Pub', '#1f3a2a', .5); M.get('Gold', '#d8b04a', .3, metal=.9); M.get('Basket', '#3f8a2a', .9)
    for c, h in (('DoorR', '#a3161b'), ('DoorB', '#1d3a8a'), ('DoorG', '#1f5a3a'), ('DoorK', '#151517')): M.get(c, h, .35)
    for k in range(3):
        for lo in (False, True): family(k, lo)
    t = Node('T_round'); M.get('Leaves', '#3f6f34', .9); M.get('Bark', '#5a4a38', .9); tree_round(t, h=9, r=3.4)
    ben(); eye(); palace(); phone(); bus()

def family(k, lo):
    """0: Georgian brick terrace with white stucco ground floor, railings and coloured doors. 1: Victorian with stacked
    bay windows. 2: a pub on the corner (dark green front, gold sign, hanging baskets)"""
    W = D = 19.0; GH, FH = 4.0, 3.5; x = 'l' if lo else ''; rnd = random.Random(70 + k)
    S = dict(spacing=3.2, ww=1.05, wh=1.9, v0=.6, frame='Frame', fw=.12, bars='Frame', sill='Stone', margin=1.4, lite=lo)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH)
    g.box('Stucco' if k != 2 else 'Pub', (0, 0, GH / 2), (W, D, GH))
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3
        if k == 2:   # the pub front: big windows, a gold-lettered sign band, flower baskets
            for u in (-L / 3, L / 3): F.quad('Window', u - 2.2, .9, u + 2.2, 3.0, .03); F.ring('Gold', outline(u - 2.2, .9, u + 2.2, 3.0), outline(u - 2.35, .75, u + 2.35, 3.15), .06)
            F.quad('Door', -.7, 0, .7, 2.6, .03); F.block('Pub', -F.L / 2, 3.2, F.L / 2, 3.9, 0, .25)
            if not lo:
                F.quad('Gold', -4, 3.35, 4, 3.75, .27)
                for u in (-L / 2, L / 2): g.ico('Basket', F.P(u, 3.0, .9), .45, sub=1)
            continue
        for i, u in enumerate((-L / 3, 0, L / 3)):
            if i == 1:
                dm = ['DoorR', 'DoorB', 'DoorG', 'DoorK'][(side + k) % 4]
                if lo: F.quad(dm, u - .6, .3, u + .6, 2.6, .04)
                else:
                    door(F, u, 1.1, 2.4, dict(frame='Frame', fw=.12, step='Stone'), dm)
                    F.poly('Window', outline(u - .55, 2.55, u + .55, 3.1, .55, 6), .03)   # the fanlight
                    for s in (-1, 1): F.block('Frame', u + s * .85 - .12, 0, u + s * .85 + .12, 3.0, 0, .3)   # portico columns
            else: window(F, u, .9, 1.1, 1.9, S, rnd)
        if not lo:   # black railings in front of the basement
            F.quad('Metal', -F.L / 2, 0, -1.5, 1.0, 1.4); F.quad('Metal', 1.5, 0, F.L / 2, 1.0, 1.4)
    band(g, 'Stone', W, D, GH - .25, .25, .08)
    for name in (f'U{k}{x}', f'B{k}{x}'):
        u = Node(name, W=W, D=D, H=FH); storey(u, W, D, 0, FH, S, rnd)
        if k == 1:   # bay windows on the front and back
            for side in (0, 2):
                F = Face(u, W, D, side, 0)
                for c in (-F.L / 4, F.L / 4):
                    F.block('Wall', c - 1.8, 0, c + 1.8, FH, 0, .9)
                    if not lo: F.quad('Window', c - 1.2, .6, c + 1.2, 2.6, .92); F.ring('Frame', outline(c - 1.2, .6, c + 1.2, 2.6), outline(c - 1.35, .45, c + 1.35, 2.75), .94)
                    else: F.quad('Window', c - 1.2, .6, c + 1.2, 2.6, .92)
    r = Node(f'R{k}{x}', W=W, D=D)
    band(r, 'Stone', W, D, 0, .35, .15)
    r.box('Wall', (0, 0, .6), (W, D, .5))   # parapet
    gable(r, W - 1, D - 1, .8, 4.0, o=.2, t=.2, ends='Wall')
    for cx in (-W / 2 + 1.2, W / 2 - 1.2):   # chimney stacks on the party walls, full of pots
        chimney(r, cx, 0, .8, w=1.0, d=3.6, h=5.0, m='Brick', pots=0 if lo else 6)

# ---------------------------------------------------------------- Big Ben: game anchor (ox-85, oz-115), 12 x 12
def ben():
    M.get('BenStone', '#c9b98e', .8); M.get('BenGold', '#d8b04a', .35, metal=.8); M.get('Slate2', '#2f3a3a', .5, metal=.4); M.get('ClockF', '#f4ecd2', .4, emit='#fff2c8', strength=0.6)
    n = Node('L_ben')
    n.box('BenStone', (0, 0, 35), (12, 12, 70)); band(n, 'BenStone', 12, 12, 0, 2, .4)
    for side in range(4):   # gothic panels: tall pointed windows up the tower
        F = Face(n, 12, 12, side, 0)
        for u in (-3.5, -1.2, 1.2, 3.5):
            for z0 in (6, 22, 38, 54): F.poly('Dark', [(u - .45, z0), (u + .45, z0), (u + .45, z0 + 11), (u, z0 + 12.2), (u - .45, z0 + 11)], .03)
        for z in (20, 36, 52, 68): F.block('BenStone', -6, z, 6, z + .5, 0, .25)
        for u in (-5.6, 5.6): F.block('BenStone', u - .4, 0, u + .4, 70, 0, .4)                 # corner buttresses
    n.box('BenGold', (0, 0, 77), (13.6, 13.6, 14))                                           # the clock stage
    for side in range(4):
        F = Face(n, 13.6, 13.6, side, 70)
        F.poly('ClockF', [(math.cos(2 * math.pi * i / 32) * 4.8, 7 + math.sin(2 * math.pi * i / 32) * 4.8) for i in range(32)], .05)
        F.ring('BenGold', [(math.cos(2 * math.pi * i / 32) * 4.8, 7 + math.sin(2 * math.pi * i / 32) * 4.8) for i in range(32)], [(math.cos(2 * math.pi * i / 32) * 5.6, 7 + math.sin(2 * math.pi * i / 32) * 5.6) for i in range(32)], .1)
        F.block('Dark', -.12, 7, .12, 10.6, .06, .14); F.block('Dark', -.1, 6.9, 2.6, 7.1, .06, .14)   # the hands
        for k in range(12):
            a = 2 * math.pi * k / 12; F.block('Dark', math.cos(a) * 4.2 - .15, 7 + math.sin(a) * 4.2 - .15, math.cos(a) * 4.2 + .15, 7 + math.sin(a) * 4.2 + .15, .05, .09)
    n.box('BenStone', (0, 0, 86), (12.4, 12.4, 4))
    for side in range(4):   # the belfry arches
        F = Face(n, 12.4, 12.4, side, 84)
        for u in (-3, 0, 3): F.poly('Dark', outline(u - .9, .4, u + .9, 3.6, .9, 5), .03)
    n.cyl('Slate2', (0, 0, 88), 8.4, 24, segs=4, r2=.3, rz=math.pi / 4, smooth=False)     # the spire
    for sx in (-1, 1):
        for sy in (-1, 1): n.cyl('BenGold', (sx * 5.4, sy * 5.4, 88), .5, 8, segs=6, r2=.05, smooth=False)   # pinnacles
    n.cyl('BenGold', (0, 0, 111), .25, 4, segs=6, r2=.05)

# ---------------------------------------------------------------- the London Eye: game anchor (ox+255, oz+185); hub 68 m up
def eye():
    M.get('EyeW', '#f0f2f4', .35, metal=.5); M.get('Pod', '#bfe2f4', .08, metal=.3); M.get('Cable', '#c8ccd0', .4, metal=.6)
    # the wheel turns about its axle, which runs along the game's x; it is modelled with the axle along Blender Y and the
    # game stands it in a group turned 90 degrees (as the old wheel was) so rotateZ spins it
    w = Node('L_eye_wheel'); R = 60
    for y in (-2.0, 2.0):
        pts = [V(math.cos(2 * math.pi * i / 64) * R, y, math.sin(2 * math.pi * i / 64) * R) for i in range(65)]
        w.tube('EyeW', pts, .55, segs=6)
    for i in range(32):   # truss braces between the two rims and the spoke cables to the hub
        a = 2 * math.pi * i / 32; p = V(math.cos(a) * R, 0, math.sin(a) * R)
        w.tube('EyeW', [p + V(0, -2, 0), p + V(0, 2, 0)], .3, segs=4)
        for y in (-2, 2): w.tube('Cable', [V(0, y * 3, 0), p + V(0, y, 0)], .1, segs=3)
        po = V(math.cos(a), 0, math.sin(a)) * (R + 3.2)
        w.sphere('Pod', po, 2.2, segs=10, rings=6, scale=(1, 2.1, 1)); w.cyl('EyeW', po + V(0, -4.6, 0), .4, 9.2, segs=6, rx=-math.pi / 2)
    w.cyl('EyeW', (0, -6, 0), 2.4, 12, segs=12, rx=-math.pi / 2)                                # the hub
    b = Node('L_eye')   # the A-frame legs on the bank (game x), the axle they hold out over the river, the boarding pier
    for s in (-1, 1):
        b.tube('EyeW', [V(0, s * 26, 0), V(3, s * 13, 34), V(5, s * 1.5, 68)], 1.4, segs=8, r_end=1.0)
        b.tube('EyeW', [V(0, s * 26, 0), V(-9, 0, 20)], .8, segs=6)                       # back stays
    b.cyl('EyeW', (4, 0, 68), 1.6, 12.5, segs=10, ry=math.pi / 2)
    b.box('Stone', (10, 0, 1.0), (30, 12, 2.0)); b.box('EyeW', (10, -6.5, 2.1), (12, 2, .3))

# ---------------------------------------------------------------- the palace: game anchor (ox-425, oz+185); front 90 wide at game z -32..-8
def palace():
    M.get('PalaceS', '#e8e2d2', .7); M.get('Slate2', '#2f3a3a', .5, metal=.4); M.get('BenGold', '#d8b04a', .35, metal=.8); M.get('PalaceW', '#1d2a38', .2); M.get('Gate', '#151517', .4, metal=.6)
    n = Node('L_palace'); rnd = random.Random(5); yc = 20.0   # game z -20 -> Blender y +20
    n.box('PalaceS', (0, yc, 11), (90, 24, 22)); hip(n, 87, 21, 22, 3.2, o=0, m='Slate2', at=(0, yc))
    k = n.mark(); band(n, 'PalaceS', 90, 24, 0, 1.6, .3); band(n, 'PalaceS', 90, 24, 7.5, .5, .2); band(n, 'PalaceS', 90, 24, 20.5, 1.5, .5); n.shift(k, (0, yc, 0))
    for side in (2, 0):   # the long fronts (game +z faces the gates)
        F = Face(n, 90, 24, side, 0); F.O = F.O + V(0, yc, 0)
        for i in range(19):
            u = -42 + i * 4.67
            if abs(u) < 9: continue
            for z0, h in ((2.5, 3.6), (9.0, 4.2), (15.5, 3.0)):
                F.quad('Window' if rnd.random() < .5 else 'PalaceW', u - .8, z0, u + .8, z0 + h, .03)
                F.ring('PalaceS', outline(u - .8, z0, u + .8, z0 + h), outline(u - 1.0, z0 - .2, u + 1.0, z0 + h + .2), .1)
        for i in range(6):   # the portico: columns and a pediment in the middle
            u = -7.5 + i * 3; F.n.cyl('PalaceS', F.P(u, 0, 2.2), .7, 18, segs=12)
        F.block('PalaceS', -9, 18, 9, 20, 0, 3.0)
        F.poly('PalaceS', [(-9.5, 20), (9.5, 20), (0, 24)], 2.6)
        F.block('Window', -2, 9.5, 2, 13.5, -.1, .02)
    for i in range(45): n.box('PalaceS', (-44 + i * 2, yc - 12.3, 23), (.6, .6, 1.4)); n.box('PalaceS', (-44 + i * 2, yc + 12.3, 23), (.6, .6, 1.4))   # balustrade
    # the gates and the railings in front (outside the old wall line, inside the plot)
    for x in range(-40, 41, 4): n.cyl('Gate', (x, 6, 0), .12, 3.2, segs=6); n.cyl('BenGold', (x, 6, 3.2), .22, .5, segs=6, r2=.02)
    n.box('Gate', (0, 6, 2.6), (80, .12, .12)); n.box('Gate', (0, 6, .6), (80, .12, .12))

# ---------------------------------------------------------------- the red phone box (placed six times)
def phone():
    M.get('PhoneRed', '#c8141b', .45); M.get('Crown', '#e8d26a', .4, metal=.6)
    n = Node('P_phone')
    n.box('PhoneRed', (0, 0, .1), (1.1, 1.1, .2)); n.box('PhoneRed', (0, 0, 1.3), (.95, .95, 2.2))
    for side in range(4):
        F = Face(n, .95, .95, side, .25)
        for r in range(6):
            for c in range(3): F.quad('Glass', -.33 + c * .23, .25 + r * .27, -.33 + c * .23 + .19, .25 + r * .27 + .22, .01)
        F.quad('Frame', -.32, 2.0, .32, 2.12, .02)
    n.box('PhoneRed', (0, 0, 2.5), (1.05, 1.05, .2)); n.cyl('PhoneRed', (0, 0, 2.6), .52, .35, segs=4, r2=.1, rz=math.pi / 4, smooth=False)
    n.box('Crown', (0, 0, 2.95), (.12, .12, .12))

# ---------------------------------------------------------------- the red double-decker bus (placed four times), long along game z
def bus():
    M.get('BusRed', '#c8141b', .4); M.get('Tyre', '#151517', .9); M.get('Glass', '#24384c', .08, metal=.5)
    n = Node('P_bus')
    n.box('BusRed', (0, 0, 1.55), (2.5, 10.4, 2.3)); n.box('BusRed', (0, 0, 3.55), (2.5, 10.2, 1.8))
    n.box('BusRed', (0, 0, 4.48), (2.44, 10.0, .12))
    for s in (-1, 1):
        n.box('Glass', (s * 1.26, 0, 2.05), (.02, 9.4, .9)); n.box('Glass', (s * 1.26, 0, 3.75), (.02, 9.8, .85))
        n.box('Frame', (s * 1.26, 0, 2.75), (.03, 10.2, .18))
        for y in (-3.4, 3.4): n.cyl('Tyre', (s * 1.1, y, .5), .5, .35, segs=12, ry=math.pi / 2)
    n.box('Glass', (0, 5.21, 3.75), (2.2, .02, .85)); n.box('Glass', (0, 5.21, 2.1), (2.2, .02, 1.0))
    n.box('Frame', (0, 5.22, 2.85), (1.6, .03, .3)); n.box('Glow', (.9, 5.22, 1.0), (.25, .03, .2)); n.box('Glow', (-.9, 5.22, 1.0), (.25, .03, .2))
